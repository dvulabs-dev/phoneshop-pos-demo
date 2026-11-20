import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Stat, PageHead, BarChart, Badge } from '../ui';
import { saleFigures, jobCharge, jobCost, jobPaid, purchasePaid, warrantyList, payStatus } from '../logic';
import { money, sum, today, addDays, localISO, daysBetween, fmtDate } from '../utils';

const RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', '7 days'], ['month', 'This month'], ['year', 'This year']];

export default function Dashboard() {
  const { s, can } = useApp();
  const [range, setRange] = useState('today');
  const st = s.settings;
  const showMoney = can('reports');
  const t = today();

  const d = useMemo(() => {
    const [from, to] = {
      today: [t, t], yesterday: [addDays(t, -1), addDays(t, -1)], week: [addDays(t, -6), t],
      month: [t.slice(0, 8) + '01', t], year: [t.slice(0, 5) + '01-01', t],
    }[range];
    const inR = (x) => x >= from && x <= to;
    const sales = s.sales.filter((x) => x.status === 'completed' && inR(x.date));
    const fig = sales.map(saleFigures);
    const revenue = sum(fig, (f) => f.revenue), gross = sum(fig, (f) => f.profit);
    const repairProfit = sum(s.repairs.filter((j) => !j.internal && j.stage !== 'Cancelled' && inR(j.date)), (j) => jobCharge(j) - jobCost(j));
    const expenses = sum(s.expenses.filter((e) => inR(e.date)), (e) => e.amount);
    const phonesSold = sum(sales, (x) => x.items.filter((i) => i.type === 'phone' && !i.returned).length);
    const phonesBought = s.purchases.filter((p) => inR(p.date)).length;
    const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)).map((day) => ({
      label: day.slice(8), value: Math.round(sum(s.sales.filter((x) => x.status === 'completed' && x.date === day), (x) => saleFigures(x).revenue)),
    }));
    const stock = s.phones.filter((p) => p.status === 'available');
    const cnt = (k) => s.phones.filter((p) => p.status === k).length;
    const owed = sum(s.sales.filter((x) => x.status === 'completed'), (x) => x.balance);
    const payables = sum(s.purchases, (p) => p.price - purchasePaid(p));
    const w = warrantyList(s, t);
    const brands = {};
    s.sales.filter((x) => x.status === 'completed').forEach((x) => x.items.forEach((i) => {
      if (i.type !== 'phone') return;
      const b = s.phones.find((p) => p.id === i.refId)?.brand || 'Other'; brands[b] = (brands[b] || 0) + 1;
    }));
    const staff = {};
    sales.forEach((x) => { staff[x.by] = (staff[x.by] || 0) + saleFigures(x).revenue; });
    return {
      revenue, gross, net: gross + repairProfit - expenses, expenses, phonesSold, phonesBought, days, stock, cnt, owed, payables,
      aging: stock.filter((p) => daysBetween(p.purchaseDate, t) >= st.agingDays),
      lowAcc: s.accessories.filter((a) => a.qty <= a.lowAt),
      expiring: w.filter((x) => x.status === 'expiring'),
      pendingRepairs: s.repairs.filter((j) => !['Delivered', 'Cancelled'].includes(j.stage)).length,
      activeRes: s.reservations.filter((r) => r.status === 'active').length,
      debtors: s.sales.filter((x) => x.status === 'completed' && x.balance > 0.5),
      brands: Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 5),
      staff: Object.entries(staff).sort((a, b) => b[1] - a[1]),
      recent: [...s.sales].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6),
      lowMargin: s.sales.filter((x) => x.status === 'completed' && x.date >= addDays(t, -14) && saleFigures(x).revenue > 0 && (saleFigures(x).profit / saleFigures(x).revenue) * 100 < st.lowMarginPct),
      bigDisc: s.sales.filter((x) => x.status === 'completed' && x.subtotal && (x.discountAmt / x.subtotal) * 100 > st.maxDiscountPct),
    };
  }, [s, range, t, st.agingDays, st.lowMarginPct, st.maxDiscountPct]);

  const c = st.dashboardCards;
  const alerts = [
    ...(st.notifications.aging && d.aging.length ? [[`${d.aging.length} phone(s) unsold for ${st.agingDays}+ days`, '/inventory', 'amber']] : []),
    ...(st.notifications.lowStock && d.lowAcc.length ? [[`${d.lowAcc.length} accessory item(s) low on stock`, '/inventory', 'red']] : []),
    ...(st.notifications.warranty && d.expiring.length ? [[`${d.expiring.length} warranty(ies) expiring within 30 days`, '/warranty', 'amber']] : []),
    ...(st.notifications.payment && d.debtors.length ? [[`${d.debtors.length} invoice(s) with outstanding balance`, '/invoices', 'red']] : []),
    ...(showMoney && d.lowMargin.length ? [[`${d.lowMargin.length} recent sale(s) below the ${st.lowMarginPct}% margin alert`, '/invoices', 'red']] : []),
    ...(showMoney && d.bigDisc.length ? [[`${d.bigDisc.length} sale(s) with discount above the ${st.maxDiscountPct}% limit`, '/invoices', 'amber']] : []),
  ];

  return (
    <>
      <PageHead title="Dashboard" sub="Business overview at a glance">
        <select style={{ width: 'auto' }} value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </PageHead>
      <div className="grid g4">
        {c.sales && showMoney && <Stat icon="trend" label="Sales" value={money(d.revenue)} sub={`${d.phonesSold} phone(s) sold`} />}
        {c.profit && showMoney && <Stat icon="wallet" tone="green" label="Gross profit" value={money(d.gross)} sub={`Net after expenses: ${money(d.net)}`} />}
        {c.sold && <Stat icon="swap" tone="blue" label="Phones sold / bought" value={`${d.phonesSold} / ${d.phonesBought}`} sub="selected period" />}
        {c.stock && <Stat icon="inventory" label="Phones in stock" value={d.stock.length} sub={`${d.cnt('reserved')} reserved · ${d.cnt('repair')} repair · ${d.cnt('inspection')} inspection`} />}
        {c.outstanding && showMoney && <Stat icon="invoices" tone="red" label="Customer balances" value={money(d.owed)} sub={`${d.debtors.length} open invoice(s)`} />}
        {c.repairs && <Stat icon="repairs" tone="amber" label="Pending repairs" value={d.pendingRepairs} sub="job cards not yet delivered" />}
        {c.reservations && <Stat icon="reservations" tone="amber" label="Active reservations" value={d.activeRes} />}
        {c.payables && showMoney && <Stat icon="cash" tone="red" label="Owed to sellers" value={money(d.payables)} sub="supplier payments pending" />}
      </div>

      <div className="grid g2" style={{ marginTop: 14, gridTemplateColumns: st.showChart && showMoney ? '2fr 1fr' : '1fr' }}>
        {st.showChart && showMoney && <div className="card"><h3>Sales – last 14 days</h3><BarChart data={d.days} fmt={money} /></div>}
        <div className="card">
          <h3>Alerts</h3>
          {alerts.length === 0 && <div className="muted">All clear</div>}
          {alerts.map(([msg, to, tone], i) => <div key={i} className="list-item"><span>{msg}</span><Link to={to}><Badge tone={tone}>View</Badge></Link></div>)}
        </div>
      </div>

      <div className="grid g3" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Recent transactions</h3>
          {d.recent.map((x) => (
            <div key={x.id} className="list-item">
              <div><Link to={'/invoices/' + x.id} className="bold">{x.invoiceNo}</Link><div className="small muted">{x.customerName} · {fmtDate(x.date)}</div></div>
              <div className="right"><div>{money(x.total)}</div><Badge tone={payStatus(x) === 'Paid' ? 'green' : 'amber'}>{payStatus(x)}</Badge></div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Top-selling brands</h3>
          {d.brands.map(([b, n]) => <div key={b} className="list-item"><span>{b}</span><b>{n} sold</b></div>)}
          {can('reports') && <><h3 style={{ marginTop: 14 }}>Staff sales ({RANGES.find((r) => r[0] === range)[1]})</h3>
            {d.staff.length === 0 && <div className="muted">No sales in this period</div>}
            {d.staff.map(([n, v]) => <div key={n} className="list-item"><span>{n}</span><b>{money(v)}</b></div>)}</>}
        </div>
        <div className="card">
          <h3>Needs attention</h3>
          {d.aging.slice(0, 4).map((p) => <div key={p.id} className="list-item"><span>{p.brand} {p.model} <span className="muted small">{p.stockId}</span></span><Badge tone="amber">{daysBetween(p.purchaseDate, t)}d old</Badge></div>)}
          {d.lowAcc.slice(0, 4).map((a) => <div key={a.id} className="list-item"><span>{a.name}</span><Badge tone="red">{a.qty} left</Badge></div>)}
          {d.expiring.slice(0, 3).map((w) => <div key={w.key} className="list-item"><span>{w.item.name} <span className="muted small">{w.sale.customerName}</span></span><Badge tone="amber">warranty {w.days}d</Badge></div>)}
          {!d.aging.length && !d.lowAcc.length && !d.expiring.length && <div className="muted">Nothing urgent</div>}
        </div>
      </div>
    </>
  );
}
