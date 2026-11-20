import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Locked } from '../ui';
import { createReservation, cancelReservation } from '../logic';
import { money, fmtDate, addDays, today } from '../utils';

export default function Reservations() {
  const { s, run, user, can } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState(null);
  if (!can('sell')) return <Locked what="manage reservations" />;
  const methods = Object.keys(s.settings.paymentMethods).filter((m) => s.settings.paymentMethods[m] && m !== 'Store Credit');
  const tone = { active: 'amber', completed: 'green', cancelled: 'gray' };

  return (
    <>
      <PageHead title="Reservations" sub="Hold a phone for a customer after an advance deposit">
        <button className="btn primary" onClick={() => setF({ phoneId: '', customerId: '', deposit: '', method: methods[0], expires: addDays(today(), 7), note: '' })}><Icon name="plus" size={15} /> New reservation</button>
      </PageHead>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>No.</th><th>Phone</th><th>Customer</th><th className="num">Deposit</th><th>Expires</th><th>Status</th><th></th></tr></thead>
        <tbody>{[...s.reservations].reverse().map((r) => {
          const p = s.phones.find((x) => x.id === r.phoneId); const c = s.customers.find((x) => x.id === r.customerId);
          const late = r.status === 'active' && r.expires < today();
          return <tr key={r.id}><td><b>{r.no}</b></td><td>{p?.brand} {p?.model}<div className="small muted">{p?.stockId} · {money(p?.listPrice)}</div></td><td>{c?.name}<div className="small muted">{c?.phone}</div></td>
            <td className="num">{money(r.deposit)}</td><td>{fmtDate(r.expires)} {late && <Badge tone="red">overdue</Badge>}</td><td><Badge tone={tone[r.status]}>{r.status}</Badge></td>
            <td className="num">{r.status === 'active' && <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn sm primary" onClick={() => nav('/pos', { state: { reservationId: r.id } })}>Complete sale</button>
              <button className="btn sm danger" onClick={() => { if (confirm('Cancel reservation?')) run((d) => cancelReservation(d, r.id, confirm('Refund the deposit to the customer? (Cancel = keep deposit)'), user.name), 'Reservation cancelled'); }}>Cancel</button></div>}</td></tr>;
        })}</tbody></table>{!s.reservations.length && <div className="empty">No reservations</div>}</div>

      {f && <Modal title="New reservation" onClose={() => setF(null)} footer={<button className="btn primary" onClick={() => { if (run((d) => createReservation(d, f, user.name), 'Phone reserved').ok) setF(null); }}>Reserve phone</button>}>
        <div className="form">
          <Field label="Phone" span={2}><select value={f.phoneId} onChange={(e) => setF({ ...f, phoneId: e.target.value })}><option value="">Select available phone…</option>{s.phones.filter((p) => p.status === 'available').map((p) => <option key={p.id} value={p.id}>{p.stockId} · {p.brand} {p.model} {p.storage} – {money(p.listPrice)}</option>)}</select></Field>
          <Field label="Customer" span={2}><select value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}><option value="">Select…</option>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></Field>
          <Field label="Deposit"><input type="number" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} /></Field>
          <Field label="Method"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Hold until"><input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field>
          <Field label="Note"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div></Modal>}
    </>
  );
}
