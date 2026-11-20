import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Stat, Tabs, Locked } from '../ui';
import { STATUS, STATUS_TONE, log } from '../logic';
import { money, sum, today, daysBetween, fmtDate, fmtTime, downloadCSV, printHTML, uid } from '../utils';

export default function Inventory() {
  const { s, can } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState('phones');
  const [f, setF] = useState({ q: '', brand: '', status: 'live', cond: '' });
  const [open, setOpen] = useState(null);
  const [accEdit, setAccEdit] = useState(null);
  const seeCost = can('seeCost');
  const st = s.settings;
  if (!can('sell') && !can('stock')) return <Locked what="view inventory" />;

  const list = s.phones.filter((p) => {
    const t = f.q.toLowerCase();
    return (f.status === 'live' ? !['sold'].includes(p.status) : f.status === 'all' || p.status === f.status) &&
      (!f.brand || p.brand === f.brand) && (!f.cond || p.condition === f.cond) &&
      (!t || [p.brand, p.model, p.imei1, p.imei2, p.stockId, p.serial, p.storage, p.color].some((v) => (v || '').toLowerCase().includes(t)));
  });
  const instock = s.phones.filter((p) => ['available', 'reserved', 'inspection', 'repair'].includes(p.status));

  return (
    <>
      <PageHead title="Inventory" sub="Every phone is tracked individually by IMEI">
        {can('purchase') && tab === 'phones' && <button className="btn primary" onClick={() => nav('/purchases', { state: { new: true } })}><Icon name="plus" size={15} /> Add phone</button>}
        {can('stock') && tab === 'acc' && <button className="btn primary" onClick={() => setAccEdit({ name: '', sku: '', qty: 0, cost: 0, price: 0, lowAt: 5 })}><Icon name="plus" size={15} /> Accessory</button>}
        <button className="btn" onClick={() => downloadCSV('stock.csv', [['Stock ID', 'Brand', 'Model', 'Storage', 'IMEI', 'Condition', 'Status', 'Price', ...(seeCost ? ['Cost'] : [])],
          ...list.map((p) => [p.stockId, p.brand, p.model, p.storage, p.imei1, p.condition, STATUS[p.status], p.listPrice, ...(seeCost ? [p.cost + p.repairCost] : [])])])}><Icon name="download" size={15} /> Export CSV</button>
      </PageHead>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat icon="inventory" label="Phones in stock" value={instock.length} />
        <Stat icon="check" label="Available for sale" tone="green" value={s.phones.filter((p) => p.status === 'available').length} />
        {seeCost && <Stat icon="wallet" label="Stock value (cost)" tone="blue" value={money(sum(instock, (p) => p.cost + p.repairCost))} />}
        <Stat icon="alert" label="Low-stock accessories" tone="red" value={s.accessories.filter((a) => a.qty <= a.lowAt).length} />
      </div>
      <Tabs tabs={[['phones', 'Phones'], ['acc', 'Accessories & parts']]} value={tab} onChange={setTab} />

      {tab === 'phones' && <>
        <div className="row" style={{ marginBottom: 12 }}>
          <input style={{ width: 260 }} placeholder="Brand, model, IMEI, stock ID…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <select style={{ width: 'auto' }} value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })}><option value="">All brands</option>{st.brands.map((b) => <option key={b}>{b}</option>)}</select>
          <select style={{ width: 'auto' }} value={f.cond} onChange={(e) => setF({ ...f, cond: e.target.value })}><option value="">All conditions</option>{st.conditions.map((b) => <option key={b}>{b}</option>)}</select>
          <select style={{ width: 'auto' }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="live">In shop (not sold)</option><option value="all">All incl. sold</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Stock ID</th><th>Phone</th><th>IMEI</th><th>Condition</th><th>Status</th><th className="num">Age</th>{seeCost && <th className="num">Cost</th>}<th className="num">Price</th></tr></thead>
          <tbody>{list.map((p) => {
            const age = daysBetween(p.purchaseDate, today());
            return <tr key={p.id} className="click" onClick={() => setOpen(p.id)}>
              <td><b>{p.stockId}</b></td><td>{p.brand} {p.model}<div className="small muted">{p.storage} · {p.color}</div></td><td className="small">{p.imei1}</td>
              <td>{p.condition}{p.grade && ` · ${p.grade}`}</td><td><Badge tone={STATUS_TONE[p.status]}>{STATUS[p.status]}</Badge></td>
              <td className="num">{p.status === 'sold' ? '—' : <span className={age >= st.agingDays ? 'red bold' : ''}>{age}d</span>}</td>
              {seeCost && <td className="num">{money(p.cost + p.repairCost)}</td>}<td className="num">{money(p.listPrice)}</td></tr>;
          })}</tbody></table>{!list.length && <div className="empty">No phones match</div>}</div>
      </>}

      {tab === 'acc' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>SKU</th><th>Item</th><th className="num">Qty</th>{seeCost && <th className="num">Cost</th>}<th className="num">Price</th><th></th></tr></thead>
        <tbody>{s.accessories.map((a) => <tr key={a.id}><td>{a.sku}</td><td>{a.name}</td><td className="num"><Badge tone={a.qty <= a.lowAt ? 'red' : 'green'}>{a.qty}</Badge></td>
          {seeCost && <td className="num">{money(a.cost)}</td>}<td className="num">{money(a.price)}</td>
          <td className="num">{can('stock') && <button className="btn sm" onClick={() => setAccEdit(a)}>Edit / adjust</button>}</td></tr>)}</tbody></table></div>}

      {open && <PhoneModal id={open} onClose={() => setOpen(null)} />}
      {accEdit && <AccModal a={accEdit} onClose={() => setAccEdit(null)} />}
    </>
  );
}

function AccModal({ a, onClose }) {
  const { run, user, toast } = useApp();
  const [f, setF] = useState({ ...a });
  const [reason, setReason] = useState('');
  const num = (k) => (e) => setF({ ...f, [k]: +e.target.value });
  const save = () => {
    if (!f.name) return toast('Name required', 'err');
    if (a.id && f.qty !== a.qty && !reason) return toast('Enter a reason for the stock adjustment', 'err');
    run((d) => {
      if (a.id) { Object.assign(d.accessories.find((x) => x.id === a.id), f); if (f.qty !== a.qty) log(d, user.name, 'Stock adjustment', `${f.name}: ${a.qty} → ${f.qty} (${reason})`); }
      else d.accessories.push({ ...f, id: uid('a') });
    }, 'Saved'); onClose();
  };
  return <Modal title={a.id ? 'Edit accessory' : 'New accessory'} onClose={onClose} footer={<button className="btn primary" onClick={save}>Save</button>}>
    <div className="form"><Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="SKU"><input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
      <Field label="Quantity"><input type="number" value={f.qty} onChange={num('qty')} /></Field><Field label="Low-stock alert at"><input type="number" value={f.lowAt} onChange={num('lowAt')} /></Field>
      <Field label="Cost"><input type="number" value={f.cost} onChange={num('cost')} /></Field><Field label="Selling price"><input type="number" value={f.price} onChange={num('price')} /></Field>
      {a.id && f.qty !== a.qty && <Field label="Reason for adjustment (logged)" span={2}><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. new stock received, damaged, count correction" /></Field>}</div>
  </Modal>;
}

function PhoneModal({ id, onClose }) {
  const { s, run, user, can, toast } = useApp();
  const p = s.phones.find((x) => x.id === id);
  const [cost, setCost] = useState({ amount: '', note: '' });
  const [edit, setEdit] = useState({ listPrice: p.listPrice, minPrice: p.minPrice, warrantyMonths: p.warrantyMonths });
  const seeCost = can('seeCost'), manage = can('stock');
  const seller = s.sellers.find((x) => x.id === p.sellerId);
  const total = p.cost + p.repairCost;
  const hist = (d, text) => d.phones.find((x) => x.id === id).history.push({ at: new Date().toISOString(), by: user.name, text });

  const saveEdit = () => run((d) => {
    const x = d.phones.find((q) => q.id === id);
    if (x.listPrice !== +edit.listPrice) hist(d, `Price changed ${x.listPrice} → ${edit.listPrice}`);
    Object.assign(x, { listPrice: +edit.listPrice, minPrice: +edit.minPrice, warrantyMonths: +edit.warrantyMonths });
  }, 'Updated');
  const addCost = () => {
    if (!(+cost.amount > 0)) return toast('Enter amount', 'err');
    run((d) => { d.phones.find((x) => x.id === id).repairCost += +cost.amount; hist(d, `Refurbishment cost +${cost.amount}: ${cost.note || '—'}`); }, 'Cost added – profit recalculated');
    setCost({ amount: '', note: '' });
  };
  const setStatus = (status) => run((d) => { d.phones.find((x) => x.id === id).status = status; hist(d, `Status → ${STATUS[status]}`); }, 'Status updated');
  const printCert = () => printHTML('Inspection certificate', `<h1>${s.settings.shopName}</h1><div class="muted">Phone Inspection Certificate</div>
    <h2>${p.brand} ${p.model} ${p.storage || ''} (${p.stockId})</h2><p>IMEI: ${p.imei1} · Condition: ${p.condition} ${p.grade ? 'Grade ' + p.grade : ''} · Battery: ${p.battery || '—'}%</p>
    <table>${Object.entries(p.checklist || {}).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    <p>Warranty: ${p.warrantyMonths || 0} months. Inspected ${fmtDate(p.purchaseDate)}.</p>`);
  const printLabel = () => printHTML('Label', `<div class="label"><b style="font-size:18px">${p.stockId}</b><br>${p.brand} ${p.model} ${p.storage || ''}<br>${p.condition}${p.grade ? ' ' + p.grade : ''}<br>IMEI ${p.imei1}<br><b style="font-size:22px">${money(p.listPrice)}</b></div>`);

  return (
    <Modal wide title={`${p.stockId} · ${p.brand} ${p.model} ${p.storage || ''}`} onClose={onClose}
      footer={<><button className="btn" onClick={printLabel}><Icon name="tag" size={15} /> Price label</button><button className="btn" onClick={printCert}><Icon name="clipboard" size={15} /> Inspection certificate</button></>}>
      <div className="grid g2">
        <div>
          <div className="row" style={{ marginBottom: 10 }}><Badge tone={STATUS_TONE[p.status]}>{STATUS[p.status]}</Badge><Badge>{p.condition}{p.grade && ` · Grade ${p.grade}`}</Badge>{p.battery && <Badge><Icon name="battery" size={15} /> {p.battery}%</Badge>}</div>
          <table className="tbl" style={{ marginBottom: 12 }}><tbody>
            <tr><td>IMEI 1 / 2</td><td>{p.imei1} {p.imei2 && ' / ' + p.imei2}</td></tr><tr><td>Serial</td><td>{p.serial || '—'}</td></tr><tr><td>Colour</td><td>{p.color} {p.ram && '· ' + p.ram}</td></tr>
            <tr><td>Included</td><td>{p.accessories || '—'}</td></tr><tr><td>Purchased</td><td>{fmtDate(p.purchaseDate)} from {seller?.name || '—'}</td></tr>
            {seeCost && <><tr><td>Purchase cost</td><td>{money(p.cost)}</td></tr><tr><td>Refurbishment</td><td>{money(p.repairCost)}</td></tr><tr><td><b>True cost</b></td><td><b>{money(total)}</b></td></tr>
              <tr><td>Est. profit @ list</td><td className={p.listPrice - total < 0 ? 'red bold' : 'green bold'}>{money(p.listPrice - total)}</td></tr></>}
          </tbody></table>
          <h3>Inspection</h3>
          <div className="row">{Object.entries(p.checklist || {}).map(([k, v]) => <Badge key={k} tone={v === 'Pass' ? 'green' : 'red'}>{k}: {v}</Badge>)}</div>
          {p.notes && <p className="muted"><Icon name="note" size={15} /> {p.notes}</p>}
        </div>
        <div>
          {manage && p.status !== 'sold' && <div className="card" style={{ marginBottom: 12 }}>
            <h3>Pricing & warranty</h3>
            <div className="form c3"><Field label="List price"><input type="number" value={edit.listPrice} onChange={(e) => setEdit({ ...edit, listPrice: e.target.value })} /></Field>
              <Field label="Minimum"><input type="number" value={edit.minPrice} onChange={(e) => setEdit({ ...edit, minPrice: e.target.value })} /></Field>
              <Field label="Warranty (mo)"><input type="number" value={edit.warrantyMonths} onChange={(e) => setEdit({ ...edit, warrantyMonths: e.target.value })} /></Field></div>
            <div className="row" style={{ marginTop: 8 }}><button className="btn sm primary" onClick={saveEdit}>Save</button>
              <select style={{ width: 'auto' }} value="" onChange={(e) => e.target.value && setStatus(e.target.value)}><option value="">Change status…</option>
                {['available', 'inspection', 'repair', 'damaged'].filter((x) => x !== p.status && p.status !== 'reserved').map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}</select></div>
            <h3 style={{ margin: '14px 0 6px' }}>Add refurbishment cost</h3>
            <div className="row"><input style={{ width: 110 }} type="number" placeholder="Amount" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} /><input className="grow" placeholder="What for? (screen, battery…)" value={cost.note} onChange={(e) => setCost({ ...cost, note: e.target.value })} /><button className="btn sm" onClick={addCost}>Add</button></div>
          </div>}
          <h3>History</h3>
          {[...p.history].reverse().map((h, i) => <div key={i} className="list-item"><span>{h.text}</span><span className="small muted">{h.by} · {fmtTime(h.at)}</span></div>)}
        </div>
      </div>
    </Modal>
  );
}
