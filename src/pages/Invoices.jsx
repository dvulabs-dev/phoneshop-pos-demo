import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Locked } from '../ui';
import { addPayment, payStatus, saleFigures, voidSale } from '../logic';
import { money, fmtDate, addMonths, maskImei, fmtTime } from '../utils';

const tone = (s) => ({ Paid: 'green', Partial: 'amber', Unpaid: 'red', Void: 'gray' }[s]);

export function InvoiceList() {
  const { s, can } = useApp();
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  if (!can('sell') && !can('reports')) return <Locked what="view invoices" />;
  const t = q.toLowerCase();
  const list = [...s.sales].sort((a, b) => b.at.localeCompare(a.at)).filter((x) =>
    (f === 'all' || payStatus(x).toLowerCase() === f) &&
    (!t || [x.invoiceNo, x.customerName, x.customerPhone, ...x.items.map((i) => (i.imei || '') + i.name)].some((v) => (v || '').toLowerCase().includes(t))));
  return (
    <>
      <PageHead title="Invoices" sub="Search by invoice number, customer, phone number or IMEI">
        <input style={{ width: 260 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ width: 'auto' }} value={f} onChange={(e) => setF(e.target.value)}><option value="all">All</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option><option value="void">Void</option></select>
      </PageHead>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th><th>By</th></tr></thead>
        <tbody>{list.map((x) => (
          <tr key={x.id}><td><Link to={'/invoices/' + x.id} className="bold">{x.invoiceNo}</Link></td><td>{fmtDate(x.date)}</td><td>{x.customerName}<div className="small muted">{x.customerPhone}</div></td>
            <td className="small">{x.items.map((i) => i.name).join(', ')}</td><td className="num">{money(x.total)}</td>
            <td className={'num ' + (x.balance > 0.5 && x.status !== 'void' ? 'red' : '')}>{x.balance > 0.5 && x.status !== 'void' ? money(x.balance) : '—'}</td><td><Badge tone={tone(payStatus(x))}>{payStatus(x)}</Badge></td><td className="small">{x.by}</td></tr>
        ))}</tbody></table></div>
    </>
  );
}

export function InvoiceDoc({ sale, settings: st, T, layout }) {
  const thermal = layout === 'Thermal';
  const imei = (i) => (st.maskImei ? maskImei(i) : i);
  return (
    <div className={'invoice' + (thermal ? ' thermal' : '')}>
      <div className="inv-top" style={thermal ? { flexDirection: 'column', textAlign: 'center', alignItems: 'center' } : null}>
        <div>
          {st.logo && <img src={st.logo} className="inv-logo" alt="" />}
          <h2>{st.shopName}</h2>
          <div>{st.address}</div><div>Tel: {st.phone}{st.email && ` · ${st.email}`}</div>
          {st.regNo && <div>Reg: {st.regNo}{st.taxNo && ` · Tax: ${st.taxNo}`}</div>}
        </div>
        <div style={thermal ? null : { textAlign: 'right' }}>
          <div className="bold" style={{ fontSize: 15 }}>{T('invoice')}</div>
          <div>No: <b>{sale.invoiceNo}</b></div><div>{T('date')}: {fmtDate(sale.date)}</div>
          <div>{T('billTo')}: {sale.customerName}{sale.customerPhone && ` (${sale.customerPhone})`}</div>
          {sale.status === 'void' && <div className="stamp">VOID</div>}
        </div>
      </div>
      <table>
        <thead><tr><th>{T('item')}</th><th className="n">{T('qty')}</th><th className="n">{T('price')}</th><th className="n">Amount</th></tr></thead>
        <tbody>{sale.items.map((i, k) => (
          <tr key={k}><td><b>{i.name}</b>
            {i.type === 'phone' && <div style={{ color: '#555', fontSize: '0.92em' }}>
              {st.showCondition && i.desc}{st.showImei && ` • IMEI ${imei(i.imei)}`}{st.showSerial && i.serial && ` • S/N ${i.serial}`}
              <div>{T('warrantyL')}: {i.warrantyMonths ? `${i.warrantyMonths} ${T('months')} (until ${fmtDate(addMonths(sale.date, i.warrantyMonths))})` : T('none')}</div></div>}
            {i.returned && <div style={{ color: '#b91c1c' }}>Returned – {i.returned.resolution.replace('_', ' ')}</div>}</td>
            <td className="n">{i.qty}</td><td className="n">{money(i.price, '')}</td><td className="n">{money(i.price * i.qty, '')}</td></tr>
        ))}</tbody>
      </table>
      <div className="tot">
        <div><span>{T('subtotal')}</span><span>{money(sale.subtotal)}</span></div>
        {sale.discountAmt > 0 && <div><span>{T('discount')}</span><span>– {money(sale.discountAmt)}</span></div>}
        {sale.tradeIn && <div><span>{T('tradeIn')} ({sale.tradeIn.desc})</span><span>– {money(sale.tradeIn.value)}</span></div>}
        {st.taxRate > 0 && <div><span>{st.taxLabel} ({st.taxRate}% incl.)</span><span>{money(sale.total - sale.total / (1 + st.taxRate / 100))}</span></div>}
        <div className="gt"><span>{T('total')}</span><span>{money(sale.total)}</span></div>
        <div><span>{T('paid')}</span><span>{money(sale.paid)}</span></div>
        {sale.balance > 0.5 && <div style={{ color: '#b91c1c', fontWeight: 700 }}><span>{T('balance')}</span><span>{money(sale.balance)}</span></div>}
      </div>
      <div style={{ marginTop: 10 }}>
        {T('payment')}: {[...new Set(sale.payments.map((p) => p.method))].join(' + ') || (sale.deposit ? 'Deposit' : '—')}{sale.deposit > 0 && ` (incl. deposit ${money(sale.deposit)})`} · {T('status')}: <b>{payStatus(sale)}</b>
        {sale.tradeIn && <div style={{ fontSize: '0.92em' }}>Trade-in received: {sale.tradeIn.desc} • IMEI {imei(sale.tradeIn.imei)} • stock {sale.tradeIn.stockId}</div>}
      </div>
      {st.warrantyText && <div className="legal"><b>{T('warrantyL')}:</b> {st.warrantyText}</div>}
      {st.returnPolicy && <div className="legal">{st.returnPolicy}</div>}
      <div className="inv-top" style={{ marginTop: 18, alignItems: 'flex-end' }}>
        <div>{st.showSignature && <div style={{ borderTop: '1px solid #333', width: 160, paddingTop: 3, fontSize: 11 }}>Authorised signature</div>}</div>
        {st.showStamp && !thermal && <div className="stamp">{st.shopName.split(' ')[0].toUpperCase()}</div>}
        {st.showQR && !thermal && <div className="qr">QR<br />{sale.invoiceNo}</div>}
      </div>
      <p style={{ textAlign: 'center', fontWeight: 600, marginBottom: 0 }}>{st.invoiceFooter || T('thanks')}</p>
    </div>
  );
}

export function InvoiceView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { s, run, can, user, T } = useApp();
  const [pay, setPay] = useState(null);
  const [layout, setLayout] = useState(null);
  const sale = s.sales.find((x) => x.id === id);
  if (!sale) return <div className="empty">Invoice not found. <Link to="/invoices">Back</Link></div>;
  const st = s.settings;
  const lay = layout || st.invoiceLayout;
  const methods = Object.keys(st.paymentMethods).filter((m) => st.paymentMethods[m] && m !== 'Store Credit');
  const phone = '94' + (sale.customerPhone || '').replace(/\D/g, '').replace(/^0/, '');
  const msg = `Hello ${sale.customerName}, thank you for shopping at ${st.shopName}.\nInvoice ${sale.invoiceNo} – ${money(sale.total)} (${payStatus(sale)}).\n` +
    sale.items.filter((i) => i.type === 'phone').map((i) => `${i.name} – warranty until ${fmtDate(addMonths(sale.date, i.warrantyMonths))}`).join('\n');
  const fig = saleFigures(sale);

  return (
    <>
      <div className="no-print">
        <PageHead title={sale.invoiceNo} sub={`${sale.customerName} · ${fmtTime(sale.at)} · served by ${sale.by}`}>
          <select style={{ width: 'auto' }} value={lay} onChange={(e) => setLayout(e.target.value)}><option>A4</option><option>Thermal</option></select>
          <button className="btn primary" onClick={() => window.print()}><Icon name="printer" size={15} /> Print / Save PDF</button>
          {sale.customerPhone && <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}><Icon name="message" size={15} /> WhatsApp</a>}
          <a className="btn" href={`mailto:?subject=${encodeURIComponent('Invoice ' + sale.invoiceNo)}&body=${encodeURIComponent(msg)}`}><Icon name="mail" size={15} /> Email</a>
          {sale.balance > 0.5 && sale.status !== 'void' && <button className="btn" onClick={() => setPay({ method: methods[0], amount: sale.balance })}><Icon name="plus" size={15} /> Receive payment</button>}
          {can('refund') && sale.status !== 'void' && <Link className="btn" to="/warranty" state={{ tab: 'returns', invoice: sale.invoiceNo }}><Icon name="undo" size={15} /> Return / exchange</Link>}
          {can('deleteInvoice') && sale.status !== 'void' && <button className="btn danger" onClick={() => confirm('Void this invoice and return the items to stock?') && run((d) => voidSale(d, sale.id, user.name), 'Invoice voided')}>Void</button>}
        </PageHead>
        {can('seeCost') && <div className="card" style={{ marginBottom: 14 }}><b>Profit on this sale:</b> {money(fig.profit)} <span className="muted">(revenue {money(fig.revenue)} – cost {money(fig.cost)})</span></div>}
        {sale.payments.length > 0 && <div className="card" style={{ marginBottom: 14 }}><h3>Payments</h3>{sale.payments.map((p, i) => <div key={i} className="list-item"><span>{p.method}</span><span>{money(p.amount)} <span className="muted small">{fmtTime(p.at)}</span></span></div>)}</div>}
      </div>
      <div className="inv-wrap print-area"><InvoiceDoc sale={sale} settings={st} T={T} layout={lay} /></div>
      {pay && <Modal title="Receive payment" onClose={() => setPay(null)} footer={<button className="btn primary" onClick={() => { if (run((d) => addPayment(d, sale.id, pay, user.name), 'Payment recorded').ok) setPay(null); }}>Record payment</button>}>
        <div className="form"><Field label="Method"><select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label={`Amount (balance ${money(sale.balance)})`}><input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field></div>
      </Modal>}
      {!nav && null}
    </>
  );
}
