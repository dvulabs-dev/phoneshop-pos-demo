import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Tabs, Locked } from '../ui';
import { processReturn, warrantyList, log } from '../logic';
import { money, today, fmtDate, fmtTime, uid, pad, daysBetween } from '../utils';

const wTone = { active: 'green', expiring: 'amber', expired: 'red', void: 'gray', none: 'gray' };
const CLAIM_STATUS = ['Reported', 'Inspecting', 'Repair approved', 'Replacement approved', 'Refund approved', 'Rejected', 'Resolved'];

export default function Warranty() {
  const { s, run, user, can, toast } = useApp();
  const loc = useLocation();
  const [tab, setTab] = useState(loc.state?.tab || 'warranty');
  const [q, setQ] = useState(loc.state?.invoice || '');
  const [claim, setClaim] = useState(null);
  const [editClaim, setEditClaim] = useState(null);
  const [ret, setRet] = useState(null);
  if (!can('sell') && !can('repairs')) return <Locked what="view warranties" />;

  const rows = warrantyList(s, today()).filter((w) => {
    const t = q.toLowerCase();
    return !t || [w.item.imei, w.sale.invoiceNo, w.sale.customerName, w.sale.customerPhone, w.item.name].some((v) => (v || '').toLowerCase().includes(t));
  }).sort((a, b) => a.days - b.days);

  const submitClaim = () => {
    if (!claim.fault) return toast('Describe the reported fault', 'err');
    const w = claim.w;
    run((d) => {
      d.claims.push({ id: uid('cl'), no: 'CLM-' + pad(d.counters.claim++, 4), at: new Date().toISOString(), saleId: w.sale.id, invoiceNo: w.sale.invoiceNo, customerName: w.sale.customerName,
        device: w.item.name, imei: w.item.imei, fault: claim.fault, status: 'Reported', assessment: '', resolution: '' });
      log(d, user.name, 'Warranty claim', w.sale.invoiceNo);
    }, 'Claim registered'); setClaim(null); setTab('claims');
  };

  // returns: find the original sale
  const t = q.toLowerCase();
  const found = tab === 'returns' && t ? s.sales.filter((x) => x.status === 'completed' && [x.invoiceNo, x.customerName, x.customerPhone, ...x.items.map((i) => i.imei || '')].some((v) => (v || '').toLowerCase().includes(t))).slice(0, 6) : [];

  return (
    <>
      <PageHead title="Warranty, Returns & Exchanges" sub="Search by IMEI, customer or invoice"><input style={{ width: 260 }} placeholder="IMEI / customer / invoice…" value={q} onChange={(e) => setQ(e.target.value)} /></PageHead>
      <Tabs tabs={[['warranty', 'Warranties'], ['claims', `Claims (${s.claims.length})`], ['returns', 'Returns & exchanges']]} value={tab} onChange={setTab} />

      {tab === 'warranty' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Phone</th><th>IMEI</th><th>Customer</th><th>Invoice</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map((w) => <tr key={w.key}><td><b>{w.item.name}</b><div className="small muted">{w.item.desc}</div></td><td className="small">{w.item.imei}</td><td>{w.sale.customerName}</td><td>{w.sale.invoiceNo}</td>
          <td>{w.item.warrantyMonths ? fmtDate(w.expiry) : '—'}{w.status === 'active' || w.status === 'expiring' ? <div className="small muted">{w.days} days left</div> : null}</td>
          <td><Badge tone={wTone[w.status]}>{w.status}</Badge>{w.claims > 0 && <Badge tone="blue">{w.claims} claim</Badge>}</td>
          <td className="num">{(w.status === 'active' || w.status === 'expiring') && <button className="btn sm" onClick={() => setClaim({ w, fault: '' })}>New claim</button>}</td></tr>)}</tbody></table>
        {!rows.length && <div className="empty">No warranty records found</div>}</div>}

      {tab === 'claims' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Claim</th><th>Device</th><th>Customer</th><th>Fault</th><th>Status</th><th></th></tr></thead>
        <tbody>{[...s.claims].reverse().map((c) => <tr key={c.id}><td><b>{c.no}</b><div className="small muted">{fmtTime(c.at)}</div></td><td>{c.device}<div className="small muted">{c.imei}</div></td><td>{c.customerName}</td>
          <td>{c.fault}{c.assessment && <div className="small muted">Assessment: {c.assessment}</div>}</td><td><Badge tone={c.status === 'Resolved' ? 'green' : c.status === 'Rejected' ? 'red' : 'amber'}>{c.status}</Badge></td>
          <td className="num"><button className="btn sm" onClick={() => setEditClaim({ ...c })}>Update</button></td></tr>)}</tbody></table>
        {!s.claims.length && <div className="empty">No warranty claims</div>}</div>}

      {tab === 'returns' && <>
        {!can('refund') && <div className="card" style={{ marginBottom: 12 }}><Icon name="lock" size={15} /> Returns, refunds and exchanges need manager approval. Switch to a Manager/Admin user to process them.</div>}
        {!t && <div className="empty">Type an invoice number, customer name or IMEI above to find the original sale.</div>}
        {found.map((x) => <div key={x.id} className="card" style={{ marginBottom: 10 }}>
          <b>{x.invoiceNo}</b> · {x.customerName} · {fmtDate(x.date)} <span className="muted small">({daysBetween(x.date, today())} days ago)</span>
          {x.items.map((i, idx) => <div key={idx} className="list-item"><span>{i.name} {i.imei && <span className="muted small">…{i.imei.slice(-4)}</span>} – {money(i.price * i.qty)}</span>
            {i.returned ? <Badge tone="red">returned ({i.returned.resolution.replace('_', ' ')})</Badge> : can('refund') && <button className="btn sm" onClick={() => setRet({ sale: x, idx, item: i, reason: '', resolution: 'refund', amount: i.price * i.qty, method: 'Cash', restock: 'inspection' })}>Return…</button>}</div>)}
        </div>)}
        <h3 style={{ margin: '16px 0 8px' }}>Return history</h3>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>No.</th><th>Invoice</th><th>Item</th><th>Reason</th><th>Resolution</th><th className="num">Amount</th><th>By</th></tr></thead>
          <tbody>{[...s.returns].reverse().map((r) => <tr key={r.id}><td>{r.no}</td><td>{r.invoiceNo}</td><td>{r.item}</td><td>{r.reason}</td><td>{r.resolution.replace('_', ' ')}</td><td className="num">{money(r.amount)}</td><td className="small">{r.by}</td></tr>)}</tbody></table>
          {!s.returns.length && <div className="empty">No returns yet</div>}</div>
      </>}

      {claim && <Modal title={`New warranty claim – ${claim.w.item.name}`} onClose={() => setClaim(null)} footer={<button className="btn primary" onClick={submitClaim}>Register claim</button>}>
        <p className="muted">IMEI {claim.w.item.imei} · {claim.w.sale.customerName} · {claim.w.sale.invoiceNo}</p>
        <Field label="Reported fault"><textarea rows={3} value={claim.fault} onChange={(e) => setClaim({ ...claim, fault: e.target.value })} /></Field></Modal>}

      {editClaim && <Modal title={`Claim ${editClaim.no}`} onClose={() => setEditClaim(null)} footer={<button className="btn primary" onClick={() => {
        if (['Refund approved', 'Replacement approved'].includes(editClaim.status) && !can('refund')) return toast('Refund / replacement needs manager approval', 'err');
        run((d) => Object.assign(d.claims.find((c) => c.id === editClaim.id), editClaim), 'Claim updated'); setEditClaim(null);
      }}>Save</button>}>
        <div className="form"><Field label="Status" span={2}><select value={editClaim.status} onChange={(e) => setEditClaim({ ...editClaim, status: e.target.value })}>{CLAIM_STATUS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Assessment" span={2}><textarea rows={2} value={editClaim.assessment} onChange={(e) => setEditClaim({ ...editClaim, assessment: e.target.value })} /></Field>
          <Field label="Resolution notes" span={2}><textarea rows={2} value={editClaim.resolution} onChange={(e) => setEditClaim({ ...editClaim, resolution: e.target.value })} /></Field></div></Modal>}

      {ret && <Modal title={`Return – ${ret.item.name}`} onClose={() => setRet(null)} footer={<button className="btn primary" onClick={() => {
        if (!ret.reason) return toast('Enter the reason for return', 'err');
        const late = daysBetween(ret.sale.date, today()) > s.settings.returnWindowDays;
        if (late && !confirm(`Outside the ${s.settings.returnWindowDays}-day return window. Approve anyway?`)) return;
        if (run((d) => processReturn(d, { saleId: ret.sale.id, itemIdx: ret.idx, ...ret }, user.name), 'Return processed').ok) setRet(null);
      }}>Process return</button>}>
        <div className="form">
          <Field label="Reason" span={2}><input value={ret.reason} onChange={(e) => setRet({ ...ret, reason: e.target.value })} placeholder="Faulty, changed mind, wrong model…" /></Field>
          <Field label="Resolution"><select value={ret.resolution} onChange={(e) => setRet({ ...ret, resolution: e.target.value })}><option value="refund">Cash / card refund</option><option value="store_credit">Store credit</option><option value="exchange">Exchange (new sale follows)</option></select></Field>
          <Field label="Refund / credit amount"><input type="number" value={ret.amount} onChange={(e) => setRet({ ...ret, amount: e.target.value })} /></Field>
          {ret.resolution === 'refund' && <Field label="Refund method"><select value={ret.method} onChange={(e) => setRet({ ...ret, method: e.target.value })}><option>Cash</option><option>Card</option><option>Bank Transfer</option></select></Field>}
          <Field label="Return item to stock as" hint="Phones go back on sale only after inspection"><select value={ret.restock} onChange={(e) => setRet({ ...ret, restock: e.target.value })}><option value="inspection">Inspection pending</option><option value="available">Sale-ready</option><option value="damaged">Damaged</option></select></Field>
        </div></Modal>}
    </>
  );
}
