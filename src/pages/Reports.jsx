import { useMemo, useState } from 'react';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, BarChart, PageHead, Stat, Tabs, Locked } from '../ui';
import { saleFigures, purchasePaid, jobCharge, jobCost, warrantyList, STATUS } from '../logic';
import { money, sum, today, addDays, daysBetween, downloadCSV, fmtDate } from '../utils';

const TABS = [['sales', 'Sales'], ['profit', 'Phone profit'], ['net', 'Net profitability'], ['stock', 'Stock valuation'], ['aging', 'Stock aging'], ['brands', 'Brand & model'],
  ['warranty', 'Warranty'], ['balances', 'Balances'], ['staff', 'Staff activity']];

function Table({ head, rows, name, right = [], plain = [] }) {
  return <>
    <div className="row" style={{ marginBottom: 8 }}><div className="grow" /><button className="btn sm" onClick={() => downloadCSV(name + '.csv', [head, ...rows])}><Icon name="download" size={15} /> Export CSV (Excel)</button><button className="btn sm" onClick={() => window.print()}><Icon name="printer" size={15} /> Print / PDF</button></div>
    <div className="tbl-wrap print-area"><table className="tbl"><thead><tr>{head.map((h, i) => <th key={h} className={right.includes(i) ? 'num' : ''}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={right.includes(j) ? 'num' : ''}>{typeof c === 'number' && !plain.includes(j) ? money(c) : c}</td>)}</tr>)}</tbody></table>
      {!rows.length && <div className="empty">No data for the selected filters</div>}</div></>;
}

export default function Reports() {
  const { s, can } = useApp();
  const [tab, setTab] = useState('sales');
  const [from, setFrom] = useState(today().slice(0, 8) + '01');
  const [to, setTo] = useState(today());
  const [brand, setBrand] = useState('');
  const [staff, setStaff] = useState('');
  const t = today();

  const sales = useMemo(() => s.sales.filter((x) => x.status === 'completed' && x.date >= from && x.date <= to && (!staff || x.by === staff) &&
    (!brand || x.items.some((i) => s.phones.find((p) => p.id === i.refId)?.brand === brand))), [s, from, to, brand, staff]);
  if (!can('reports')) return <Locked what="view reports" />;

  const phoneRows = sales.flatMap((x) => x.items.filter((i) => i.type === 'phone' && !i.returned).map((i) => {
    const p = s.phones.find((q) => q.id === i.refId);
    const ratio = x.subtotal ? x.net / x.subtotal : 1;
    const rev = i.price * ratio;
    return [x.date, x.invoiceNo, `${p?.brand} ${p?.model} ${p?.storage}`, i.imei, i.cost - (p?.repairCost || 0), p?.repairCost || 0, Math.round(rev), Math.round(rev - i.cost), `${(((rev - i.cost) / rev) * 100).toFixed(1)}%`];
  }));
  const fig = sales.map(saleFigures);
  const gross = sum(fig, (f) => f.profit), revenue = sum(fig, (f) => f.revenue);
  const repairProfit = sum(s.repairs.filter((j) => !j.internal && j.stage !== 'Cancelled' && j.date >= from && j.date <= to), (j) => jobCharge(j) - jobCost(j));
  const exps = s.expenses.filter((e) => e.date >= from && e.date <= to);
  const expTotal = sum(exps, (e) => e.amount);
  const byCat = Object.entries(exps.reduce((a, e) => ({ ...a, [e.category]: (a[e.category] || 0) + e.amount }), {}));
  const nDays = Math.min(31, Math.max(1, daysBetween(from, to) + 1));
  const daily = Array.from({ length: nDays }, (_, i) => addDays(to, i - nDays + 1)).map((day) => ({ label: day.slice(8), value: Math.round(sum(sales.filter((x) => x.date === day), (x) => saleFigures(x).revenue)) }));
  const live = s.phones.filter((p) => ['available', 'reserved', 'inspection', 'repair'].includes(p.status) && (!brand || p.brand === brand));

  const brandMap = {};
  sales.forEach((x) => x.items.filter((i) => i.type === 'phone' && !i.returned).forEach((i) => {
    const p = s.phones.find((q) => q.id === i.refId); const k = `${p?.brand}|${p?.model}`;
    const rev = i.price * (x.subtotal ? x.net / x.subtotal : 1);
    brandMap[k] = brandMap[k] || { n: 0, rev: 0, profit: 0 }; brandMap[k].n++; brandMap[k].rev += rev; brandMap[k].profit += rev - i.cost;
  }));

  const staffMap = {};
  s.sales.filter((x) => x.date >= from && x.date <= to).forEach((x) => {
    const r = (staffMap[x.by] = staffMap[x.by] || { n: 0, rev: 0, disc: 0, ref: 0, void: 0 });
    if (x.status === 'void') r.void++; else { r.n++; r.rev += saleFigures(x).revenue; r.disc += x.discountAmt; }
  });
  s.returns.filter((r) => r.at.slice(0, 10) >= from && r.at.slice(0, 10) <= to).forEach((r) => { const m = (staffMap[r.by] = staffMap[r.by] || { n: 0, rev: 0, disc: 0, ref: 0, void: 0 }); m.ref += r.amount; });

  return (
    <>
      <PageHead title="Reports & Analytics" sub="Filter by date, brand and staff · export to Excel (CSV) or print to PDF">
        <input type="date" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} /><span>→</span><input type="date" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} />
        <select style={{ width: 'auto' }} value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">All brands</option>{s.settings.brands.map((b) => <option key={b}>{b}</option>)}</select>
        <select style={{ width: 'auto' }} value={staff} onChange={(e) => setStaff(e.target.value)}><option value="">All staff</option>{s.users.map((u) => <option key={u.id}>{u.name}</option>)}</select>
      </PageHead>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'sales' && <>
        <div className="grid g4" style={{ marginBottom: 12 }}><Stat label="Invoices" value={sales.length} /><Stat label="Sales value" value={money(revenue)} />
          {['Cash', 'Card', 'Bank Transfer'].map((m) => <Stat key={m} tone="blue" label={m} value={money(sum(sales.flatMap((x) => x.payments.filter((p) => p.method === m)), (p) => p.amount))} />).slice(0, 2)}</div>
        <div className="card" style={{ marginBottom: 12 }}><h3>Daily sales</h3><BarChart data={daily} fmt={money} /></div>
        <Table name="sales" head={['Date', 'Invoice', 'Customer', 'Payment', 'Total', 'Balance', 'By']} right={[4, 5]}
          rows={sales.map((x) => [x.date, x.invoiceNo, x.customerName, [...new Set(x.payments.map((p) => p.method))].join(' + ') || 'Deposit', x.total, Math.round(x.balance), x.by])} /></>}
      {tab === 'profit' && <><div className="grid g3" style={{ marginBottom: 12 }}><Stat label="Phones sold" value={phoneRows.length} /><Stat tone="green" label="Phone profit" value={money(sum(phoneRows, (r) => r[7]))} />
        <Stat label="Avg margin" value={phoneRows.length ? (sum(phoneRows, (r) => r[7]) / sum(phoneRows, (r) => r[6]) * 100).toFixed(1) + '%' : '—'} /></div>
        <Table name="phone-profit" head={['Date', 'Invoice', 'Phone', 'IMEI', 'Buy cost', 'Repair cost', 'Sold for', 'Profit', 'Margin']} right={[4, 5, 6, 7]} rows={phoneRows} /></>}
      {tab === 'net' && <div className="card" style={{ maxWidth: 560 }}><h3>Net profitability ({fmtDate(from)} – {fmtDate(to)})</h3>
        <div className="totals"><div><span>Sales (net of discounts & returns)</span><span>{money(revenue)}</span></div><div><span>Gross profit on phones & accessories</span><span>{money(gross)}</span></div>
          <div><span>+ Repair service profit</span><span>{money(repairProfit)}</span></div>{byCat.map(([k, v]) => <div key={k} className="muted"><span>– {k}</span><span>{money(v)}</span></div>)}
          <div><span>– Total expenses</span><span>{money(expTotal)}</span></div><div className="big"><span>Net profit</span><span className={gross + repairProfit - expTotal < 0 ? 'red' : 'green'}>{money(gross + repairProfit - expTotal)}</span></div></div></div>}
      {tab === 'stock' && <><div className="grid g3" style={{ marginBottom: 12 }}><Stat label="Devices in stock" value={live.length} /><Stat tone="blue" label="Stock value (true cost)" value={money(sum(live, (p) => p.cost + p.repairCost))} /><Stat tone="green" label="Potential sale value" value={money(sum(live, (p) => p.listPrice))} /></div>
        <Table name="stock" head={['Stock ID', 'Phone', 'IMEI', 'Status', 'Cost', 'List price']} right={[4, 5]} rows={live.map((p) => [p.stockId, `${p.brand} ${p.model} ${p.storage}`, p.imei1, STATUS[p.status], p.cost + p.repairCost, p.listPrice])} /></>}
      {tab === 'aging' && <Table name="aging" head={['Stock ID', 'Phone', 'Days in stock', 'Status', 'Cost', 'List price']} right={[2, 4, 5]} plain={[2]}
        rows={live.map((p) => [p.stockId, `${p.brand} ${p.model}`, daysBetween(p.purchaseDate, t), STATUS[p.status], p.cost + p.repairCost, p.listPrice]).sort((a, b) => b[2] - a[2])} />}
      {tab === 'brands' && <Table name="brands" head={['Brand', 'Model', 'Units sold', 'Revenue', 'Profit', 'Avg margin']} right={[2, 3, 4]} plain={[2]}
        rows={Object.entries(brandMap).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [...k.split('|'), v.n, Math.round(v.rev), Math.round(v.profit), (v.profit / v.rev * 100).toFixed(1) + '%'])} />}
      {tab === 'warranty' && <Table name="warranty" head={['Invoice', 'Phone', 'IMEI', 'Customer', 'Expiry', 'Status', 'Claims']} right={[6]} plain={[6]}
        rows={warrantyList(s, t).map((w) => [w.sale.invoiceNo, w.item.name, w.item.imei, w.sale.customerName, fmtDate(w.expiry), w.status, w.claims])} />}
      {tab === 'balances' && <div className="grid g2"><div><h3 style={{ marginBottom: 8 }}>Customers owe us</h3><Table name="receivables" head={['Invoice', 'Customer', 'Phone', 'Balance']} right={[3]}
        rows={s.sales.filter((x) => x.status === 'completed' && x.balance > 0.5).map((x) => [x.invoiceNo, x.customerName, x.customerPhone, Math.round(x.balance)])} /></div>
        <div><h3 style={{ marginBottom: 8 }}>We owe sellers</h3><Table name="payables" head={['Purchase', 'Seller', 'Owed']} right={[2]}
          rows={s.purchases.filter((p) => p.source !== 'trade-in' && p.price - purchasePaid(p) > 0).map((p) => [p.no, p.sellerName, p.price - purchasePaid(p)])} /></div></div>}
      {tab === 'staff' && <Table name="staff" head={['Staff', 'Invoices', 'Sales value', 'Discounts given', 'Refunds', 'Voided']} right={[1, 2, 3, 4, 5]} plain={[1, 5]}
        rows={Object.entries(staffMap).map(([n, v]) => [n, v.n, Math.round(v.rev), Math.round(v.disc), Math.round(v.ref), v.void])} />}
      {!s && <Badge />}
    </>
  );
}
