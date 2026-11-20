import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Tabs, Locked, Section } from '../ui';
import { createPurchase, findDupImei, purchasePaid } from '../logic';
import { money, fmtDate, printHTML } from '../utils';

const blank = (st) => ({
  seller: { name: '', phone: '', idNo: '' }, price: '', paid: '', status: 'inspection',
  phone: { brand: 'Apple', model: '', storage: '', color: '', ram: '', imei1: '', imei2: '', serial: '', condition: 'Used', grade: 'B', battery: '', accessories: '', notes: '',
    checklist: Object.fromEntries(st.checklist.map((k) => [k, 'Pass'])), listPrice: '', minPrice: '', warrantyMonths: st.warrantyByCondition.Used },
});

export default function Purchases() {
  const { s, run, user, can } = useApp();
  const [tab, setTab] = useState('purchases');
  const loc = useLocation();
  const st = s.settings;
  const [f, setF] = useState(() => (loc.state?.new ? blank(s.settings) : null));
  if (!can('purchase')) return <Locked what="record purchases" />;
  const seeCost = can('seeCost');

  const setP = (k, v) => setF((x) => {
    const phone = { ...x.phone, [k]: v };
    if (k === 'condition') phone.warrantyMonths = st.warrantyByCondition[v] ?? 0;
    return { ...x, phone };
  });
  const setS = (k, v) => setF((x) => ({ ...x, seller: { ...x.seller, [k]: v } }));
  const margin = f ? (+f.phone.listPrice || 0) - (+f.price || 0) : 0;
  const dup = f && f.phone.imei1.length === 15 ? findDupImei(s, f.phone.imei1) : null;

  const submit = () => {
    const res = run((d) => createPurchase(d, { ...f, paid: f.paid === '' ? f.price : f.paid }, user.name), 'Purchase recorded & stock created');
    if (res.ok) {
      const { purchase, phone } = res.value;
      setF(null);
      if (confirm('Print the purchase receipt / seller acknowledgment?')) printHTML('Purchase receipt', `<h1>${st.shopName}</h1><div class="muted">Purchase receipt & seller acknowledgment</div>
        <h2>${purchase.no} · ${fmtDate(purchase.date)}</h2><p>Seller: <b>${purchase.sellerName}</b></p>
        <p>Device: ${phone.brand} ${phone.model} ${phone.storage} · IMEI ${phone.imei1} · Condition: ${phone.condition}</p>
        <p>Included: ${phone.accessories || '—'}</p><p>Price paid: <b>${money(purchase.price)}</b></p>
        <p style="margin-top:50px">I confirm that I am the lawful owner of this device and sell it to ${st.shopName}.</p><p style="margin-top:40px">__________________ Seller signature &nbsp;&nbsp;&nbsp;&nbsp; __________________ Staff (${user.name})</p>`);
    }
  };

  return (
    <>
      <PageHead title="Purchases" sub="Buying used phones and keeping a trustworthy history of each device">
        <button className="btn primary" onClick={() => setF(blank(st))}><Icon name="plus" size={15} /> New purchase</button>
      </PageHead>
      <Tabs tabs={[['purchases', 'Purchase records'], ['sellers', 'Sellers & suppliers']]} value={tab} onChange={setTab} />
      {tab === 'purchases' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>No.</th><th>Date</th><th>Device</th><th>Seller</th><th>Source</th>{seeCost && <><th className="num">Price</th><th className="num">Owed</th></>}<th>By</th></tr></thead>
        <tbody>{[...s.purchases].reverse().map((p) => <tr key={p.id}><td><b>{p.no}</b></td><td>{fmtDate(p.date)}</td><td>{p.desc}<div className="small muted">{p.stockId}</div></td><td>{p.sellerName}</td>
          <td><Badge tone={p.source === 'trade-in' ? 'blue' : 'gray'}>{p.source}</Badge></td>
          {seeCost && <><td className="num">{money(p.price)}</td><td className={'num ' + (p.price - purchasePaid(p) > 0 && p.source !== 'trade-in' ? 'red bold' : '')}>{p.source === 'trade-in' ? '—' : money(p.price - purchasePaid(p))}</td></>}<td className="small">{p.by}</td></tr>)}</tbody></table></div>}
      {tab === 'sellers' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Phone</th><th className="num">Devices supplied</th></tr></thead>
        <tbody>{s.sellers.map((x) => <tr key={x.id}><td><b>{x.name}</b></td><td>{x.phone}</td><td className="num">{s.purchases.filter((p) => p.sellerId === x.id).length}</td></tr>)}</tbody></table></div>}

      {f && <Modal wide title="New purchase" onClose={() => setF(null)} footer={<><button className="btn" onClick={() => setF(null)}>Cancel</button><button className="btn primary" onClick={submit}><Icon name="check" size={16} /> Save purchase</button></>}>
        <Section title="Seller / supplier" icon="customers" sub="Who is selling this phone to the shop">
          <Field label="Name"><div className="ico"><Icon name="user" size={16} /><input value={f.seller.name} onChange={(e) => setS('name', e.target.value)} placeholder="Seller's full name" autoFocus /></div></Field>
          <Field label="Phone"><div className="ico"><Icon name="inventory" size={16} /><input value={f.seller.phone} onChange={(e) => setS('phone', e.target.value)} placeholder="07X XXX XXXX" /></div></Field>
          <Field label="ID number" hint="Protected – shown to authorised staff only"><div className="ico"><Icon name="lock" size={16} /><input value={f.seller.idNo} onChange={(e) => setS('idNo', e.target.value)} placeholder="NIC / passport" /></div></Field>
        </Section>

        <Section title="Device" icon="inventory" sub="Identify the exact unit">
          <Field label="Brand" req><select value={f.phone.brand} onChange={(e) => setP('brand', e.target.value)}>{st.brands.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Model" req><input value={f.phone.model} onChange={(e) => setP('model', e.target.value)} placeholder="e.g. iPhone 13" /></Field>
          <Field label="Storage"><input value={f.phone.storage} placeholder="128GB" onChange={(e) => setP('storage', e.target.value)} /></Field>
          <Field label="IMEI 1" req hint={dup ? undefined : '15 digits – dial *#06# on the phone'}>
            <input className={dup ? 'bad' : ''} maxLength={15} inputMode="numeric" value={f.phone.imei1} onChange={(e) => setP('imei1', e.target.value.replace(/\D/g, ''))} placeholder="000000000000000" />
            {dup && <small className="red bold">Already in stock as {dup.stockId}</small>}</Field>
          <Field label="IMEI 2" hint="Dual-SIM phones"><input maxLength={15} inputMode="numeric" value={f.phone.imei2} onChange={(e) => setP('imei2', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Serial number"><input value={f.phone.serial} onChange={(e) => setP('serial', e.target.value)} /></Field>
          <Field label="Colour"><input value={f.phone.color} onChange={(e) => setP('color', e.target.value)} placeholder="Black" /></Field>
          <Field label="Included items" span={2}><input value={f.phone.accessories} placeholder="Charger, cable, box…" onChange={(e) => setP('accessories', e.target.value)} /></Field>
        </Section>

        <Section title="Condition & inspection" icon="clipboard" sub="Tap a test to mark it as failed">
          <Field label="Condition"><select value={f.phone.condition} onChange={(e) => setP('condition', e.target.value)}>{st.conditions.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Grade"><div className="choice">{['', ...st.grades].map((g) => <button type="button" key={g || 'none'} className={f.phone.grade === g ? 'on' : ''} onClick={() => setP('grade', g)}>{g || '—'}</button>)}</div></Field>
          <Field label="Battery health %"><input value={f.phone.battery} inputMode="numeric" onChange={(e) => setP('battery', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 88" /></Field>
          <div className="checks" style={{ gridColumn: '1/-1' }}>{st.checklist.map((k) => {
            const ok = f.phone.checklist[k] === 'Pass';
            return <button type="button" key={k} className={ok ? 'ok' : 'fail'} onClick={() => setP('checklist', { ...f.phone.checklist, [k]: ok ? 'Fail' : 'Pass' })}>
              <Icon name={ok ? 'check' : 'x'} size={14} />{k}</button>;
          })}</div>
          <Field label="Fault remarks" span={3}><input value={f.phone.notes} onChange={(e) => setP('notes', e.target.value)} placeholder="Scratches, repairs done, anything the next staff should know" /></Field>
        </Section>

        <Section title="Pricing & status" icon="wallet" sub="What you pay now and how you plan to sell it">
          <Field label="Buying price (Rs.)" req><input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0" /></Field>
          <Field label="Paid now (Rs.)" hint="Leave blank if paid in full"><input type="number" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} placeholder={f.price || '0'} /></Field>
          <Field label="Stock status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="inspection">Inspection pending</option><option value="repair">Repair required</option><option value="available">Sale-ready</option></select></Field>
          <Field label="Planned list price (Rs.)"><input type="number" value={f.phone.listPrice} onChange={(e) => setP('listPrice', e.target.value)} placeholder="0" /></Field>
          <Field label="Minimum price (Rs.)" hint="Cashiers can't sell below this"><input type="number" value={f.phone.minPrice} onChange={(e) => setP('minPrice', e.target.value)} placeholder="0" /></Field>
          <Field label="Warranty (months)"><input type="number" value={f.phone.warrantyMonths} onChange={(e) => setP('warrantyMonths', e.target.value)} /></Field>
          {+f.price > 0 && +f.phone.listPrice > 0 && <div className={'fsum ' + (margin < 0 ? 'neg' : '')} style={{ gridColumn: '1/-1' }}>
            <span>Estimated margin at list price</span><b>{money(margin)} · {((margin / +f.phone.listPrice) * 100).toFixed(1)}%</b></div>}
        </Section>
      </Modal>}
    </>
  );
}
