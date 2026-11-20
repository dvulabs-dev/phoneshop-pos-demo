import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Locked } from '../ui';
import { saleFigures, warrantyList, payStatus } from '../logic';
import { money, sum, uid, fmtDate, today } from '../utils';

export function CustomerForm({ initial, onDone, onCancel }) {
  const { s, run, toast } = useApp();
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    if (!f.name?.trim()) return toast('Name is required', 'err');
    if (!/^\d{9,12}$/.test((f.phone || '').replace(/\s/g, ''))) return toast('Enter a valid phone number', 'err');
    if (s.customers.some((c) => c.phone === f.phone && c.id !== f.id)) return toast('A customer with this phone number already exists', 'err');
    const id = f.id || uid('c');
    run((d) => {
      if (f.id) Object.assign(d.customers.find((c) => c.id === f.id), f);
      else d.customers.push({ credit: 0, notes: '', email: '', address: '', ...f, id, createdAt: new Date().toISOString() });
    }, 'Customer saved');
    onDone(id);
  };
  const onKey = (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') save(); };
  return <div onKeyDown={onKey}>
    <div className="form">
      <div className="form-sec">Contact</div>
      <Field label="Full name" req><div className="ico"><Icon name="user" size={16} /><input value={f.name} onChange={set('name')} placeholder="e.g. Nimal Perera" autoFocus /></div></Field>
      <Field label="Mobile number" req><div className="ico"><Icon name="inventory" size={16} /><input value={f.phone} onChange={set('phone')} placeholder="07X XXX XXXX" inputMode="tel" /></div></Field>
      <Field label="Email" hint="Used for sending invoices"><div className="ico"><Icon name="mail" size={16} /><input type="email" value={f.email || ''} onChange={set('email')} placeholder="name@example.com" /></div></Field>
      <Field label="Customer group">
        <div className="choice">{['Regular', 'VIP', 'Wholesale'].map((g) => <button type="button" key={g} className={(f.group === g ? 'on ' : '') + g.toLowerCase()} onClick={() => setF({ ...f, group: g })}>{g}</button>)}</div>
      </Field>
      <div className="form-sec">Other details</div>
      <Field label="Address" span={2}><input value={f.address || ''} onChange={set('address')} placeholder="Street, city" /></Field>
      <Field label="Notes" span={2}><textarea rows={2} value={f.notes || ''} onChange={set('notes')} placeholder="Preferences, reminders… (optional)" /></Field>
    </div>
    <div className="form-actions">
      {onCancel && <button className="btn" onClick={onCancel}>Cancel</button>}
      <button className="btn primary" onClick={save}><Icon name="check" size={16} /> Save customer</button>
    </div>
  </div>;
}

export default function Customers() {
  const { s, can, user } = useApp();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  if (!can('customers') && !can('sell')) return <Locked what="view customers" />;

  const bal = (c) => sum(s.sales.filter((x) => x.customerId === c.id && x.status === 'completed'), (x) => x.balance);
  const list = s.customers.filter((c) => (c.name + c.phone + c.group).toLowerCase().includes(q.toLowerCase()));
  const v = view && s.customers.find((c) => c.id === view);

  return (
    <>
      <PageHead title="Customers" sub="Profiles, purchase timeline, balances and warranties">
        <input style={{ width: 240 }} placeholder="Search name / phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => setEdit({ name: '', phone: '', group: 'Regular' })}><Icon name="plus" size={15} /> New customer</button>
      </PageHead>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Phone</th><th>Group</th><th className="num">Purchases</th><th className="num">Balance due</th><th>Last purchase</th></tr></thead>
        <tbody>{list.map((c) => {
          const n = s.sales.filter((x) => x.customerId === c.id && x.status === 'completed');
          return <tr key={c.id} className="click" onClick={() => setView(c.id)}>
            <td><b>{c.name}</b></td><td>{c.phone}</td><td><Badge tone={c.group === 'VIP' ? 'amber' : c.group === 'Wholesale' ? 'blue' : 'gray'}>{c.group}</Badge></td>
            <td className="num">{n.length} · {money(sum(n, (x) => saleFigures(x).revenue))}</td>
            <td className={'num ' + (bal(c) > 0 ? 'red bold' : '')}>{bal(c) > 0 ? money(bal(c)) : '—'}</td><td>{fmtDate(c.lastPurchase)}</td></tr>;
        })}</tbody></table></div>

      {edit && <Modal title={edit.id ? 'Edit customer' : 'New customer'} onClose={() => setEdit(null)}><CustomerForm initial={edit} onDone={() => setEdit(null)} onCancel={() => setEdit(null)} /></Modal>}

      {v && <Modal wide title={`${v.name} · ${v.group}`} onClose={() => setView(null)}
        footer={<>{can('customers') && <button className="btn" onClick={() => { setEdit(v); setView(null); }}>Edit</button>}
          {bal(v) > 0 && <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/94${v.phone.replace(/^0/, '')}?text=${encodeURIComponent(`Dear ${v.name}, a friendly reminder of your outstanding balance of ${money(bal(v))} at ${s.settings.shopName}. Thank you.`)}`}><Icon name="message" size={15} /> WhatsApp reminder</a>}</>}>
        <div className="grid g3" style={{ marginBottom: 12 }}>
          <div className="card"><div className="muted small">Phone</div><b>{v.phone}</b><div className="small muted">{v.email}</div></div>
          <div className="card"><div className="muted small">Outstanding</div><b className={bal(v) > 0 ? 'red' : ''}>{money(bal(v))}</b></div>
          <div className="card"><div className="muted small">Store credit</div><b>{money(v.credit || 0)}</b></div>
        </div>
        {v.notes && <p className="muted"><Icon name="note" size={15} /> {v.notes}</p>}
        <h3>Purchase timeline</h3>
        {s.sales.filter((x) => x.customerId === v.id).sort((a, b) => b.at.localeCompare(a.at)).map((x) => (
          <div key={x.id} className="list-item"><div><Link to={'/invoices/' + x.id} className="bold">{x.invoiceNo}</Link> <span className="muted small">{fmtDate(x.date)}</span>
            <div className="small">{x.items.map((i) => i.name + (i.imei ? ` (…${i.imei.slice(-4)})` : '')).join(', ')}</div></div>
            <div className="right">{money(x.total)} <Badge tone={payStatus(x) === 'Paid' ? 'green' : 'amber'}>{payStatus(x)}</Badge></div></div>
        ))}
        <h3 style={{ marginTop: 14 }}>Warranties</h3>
        {warrantyList(s, today()).filter((w) => w.sale.customerId === v.id).map((w) => (
          <div key={w.key} className="list-item"><span>{w.item.name} <span className="muted small">IMEI …{w.item.imei.slice(-4)}</span></span><Badge tone={w.status === 'active' ? 'green' : w.status === 'expiring' ? 'amber' : 'red'}>{w.status} · {fmtDate(w.expiry)}</Badge></div>
        ))}
        <h3 style={{ marginTop: 14 }}>Repairs & claims</h3>
        {s.repairs.filter((j) => j.customerId === v.id).map((j) => <div key={j.id} className="list-item"><span>{j.no} {j.deviceDesc} – {j.problem}</span><Badge>{j.stage}</Badge></div>)}
        {s.claims.filter((c) => s.sales.find((x) => x.id === c.saleId)?.customerId === v.id).map((c) => <div key={c.id} className="list-item"><span>{c.no} {c.device} – {c.fault}</span><Badge tone="amber">{c.status}</Badge></div>)}
        {!user.name && null}
      </Modal>}
    </>
  );
}
