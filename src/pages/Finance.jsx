import { useState } from 'react';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Stat, Tabs, Locked } from '../ui';
import { cashSince, purchasePaid, paySalary, salaryOf } from '../logic';
import { money, sum, today, fmtDate, fmtTime, uid, addDays, printHTML } from '../utils';

export default function Finance() {
  const { s, run, user, can, toast } = useApp();
  const [tab, setTab] = useState('register');
  if (!can('sell') && !can('expenses')) return <Locked what="view cash & expenses" />;
  const tabs = [['register', 'Cash register'], ...(can('expenses') ? [['expenses', 'Expenses'], ['salaries', 'Salaries'], ['payables', 'Supplier payables']] : [])];
  return (
    <>
      <PageHead title="Cash & Expenses" sub="Shift reconciliation, running costs and supplier payments" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'register' && <Register />}
      {tab === 'expenses' && <Expenses />}
      {tab === 'salaries' && <Salaries />}
      {tab === 'payables' && <Payables />}
    </>
  );
}

function Register() {
  const { s, run, user, toast } = useApp();
  const [open, setOpen] = useState('');
  const [counted, setCounted] = useState('');
  const sh = s.shift;
  const live = sh ? cashSince(s, sh.openedAt) : null;
  const expected = sh ? sh.openingCash + live.net : 0;

  return (
    <div className="grid g2">
      <div className="card">
        <h3>{sh ? 'Shift open' : 'No open shift'}</h3>
        {!sh ? <>
          <Field label="Opening cash in drawer (Rs.)"><input type="number" value={open} onChange={(e) => setOpen(e.target.value)} /></Field>
          <button className="btn primary" style={{ marginTop: 10 }} onClick={() => run((d) => { d.shift = { id: uid('sh'), openedAt: new Date().toISOString(), openedBy: user.name, openingCash: +open || 0 }; }, 'Shift opened')}>Open shift</button>
        </> : <>
          <p className="muted">Opened {fmtTime(sh.openedAt)} by {sh.openedBy}</p>
          <div className="totals"><div><span>Opening cash</span><span>{money(sh.openingCash)}</span></div><div><span>+ Cash sales (net of change)</span><span>{money(live.salesIn)}</span></div>
            <div><span>+ Repairs & deposits</span><span>{money(live.repairIn + live.depositsIn)}</span></div><div><span>– Refunds / deposit refunds</span><span>{money(live.refundsOut + live.depositsOut)}</span></div>
            <div><span>– Cash expenses & seller payments</span><span>{money(live.expensesOut + live.purchasesOut)}</span></div><div className="big"><span>Expected in drawer</span><span>{money(expected)}</span></div></div>
          <Field label="Counted cash (Rs.)"><input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} /></Field>
          {counted !== '' && <p className={+counted - expected === 0 ? 'green' : 'red bold'}>Difference: {money(+counted - expected)}</p>}
          <button className="btn primary" onClick={() => { if (counted === '') return toast('Enter the counted cash', 'err');
            run((d) => { d.shifts.unshift({ ...d.shift, closedAt: new Date().toISOString(), closedBy: user.name, expected, counted: +counted, diff: +counted - expected }); d.shift = null; }, 'Shift closed'); setCounted(''); }}>Close shift & reconcile</button>
        </>}
      </div>
      <div className="card"><h3>Previous shifts</h3>
        {s.shifts.length === 0 && <div className="muted">No closed shifts yet</div>}
        {s.shifts.map((x) => <div key={x.id} className="list-item"><div>{fmtTime(x.openedAt)} → {fmtTime(x.closedAt)}<div className="small muted">{x.openedBy}</div></div>
          <div className="right">{money(x.counted)}<div><Badge tone={x.diff === 0 ? 'green' : 'red'}>{x.diff === 0 ? 'balanced' : (x.diff > 0 ? '+' : '') + money(x.diff)}</Badge></div></div></div>)}</div>
    </div>
  );
}

function Expenses() {
  const { s, run, user, toast } = useApp();
  const [f, setF] = useState(null);
  const month = today().slice(0, 7);
  const monthly = s.expenses.filter((e) => e.date.startsWith(month));
  const byCat = {};
  monthly.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const wk = sum(s.expenses.filter((e) => e.date >= addDays(today(), -6)), (e) => e.amount);
  const save = () => {
    if (!(+f.amount > 0)) return toast('Enter an amount', 'err');
    run((d) => {
      d.expenses.push({ id: uid('ex'), at: new Date().toISOString(), by: user.name, ...f, amount: +f.amount });
      if (f.recurring) d.expenses[d.expenses.length - 1].note += ' (recurring monthly)';
    }, 'Expense recorded'); setF(null);
  };
  return <>
    <div className="row" style={{ marginBottom: 12 }}><div className="grow" /><button className="btn primary" onClick={() => setF({ date: today(), category: s.settings.expenseCategories[0], amount: '', method: 'Cash', note: '', recurring: false })}><Icon name="plus" size={15} /> Add expense</button></div>
    <div className="grid g3" style={{ marginBottom: 14 }}><Stat label="This month" value={money(sum(monthly, (e) => e.amount))} /><Stat label="Last 7 days" value={money(wk)} />
      <div className="card"><div className="stat-l muted small">BY CATEGORY (MONTH)</div>{Object.entries(byCat).map(([k, v]) => <div key={k} className="list-item"><span>{k}</span><b>{money(v)}</b></div>)}</div></div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Category</th><th>Method</th><th>Note</th><th className="num">Amount</th></tr></thead>
      <tbody>{[...s.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.category}</td><td>{e.method}</td><td className="small">{e.note}</td><td className="num">{money(e.amount)}</td></tr>)}</tbody></table></div>
    {f && <Modal title="New expense" onClose={() => setF(null)} footer={<button className="btn primary" onClick={save}>Save</button>}>
      <div className="form"><Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Category"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{s.settings.expenseCategories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Amount"><input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Paid by"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option>Cash</option><option>Card</option><option>Bank Transfer</option></select></Field>
        <Field label="Note" span={2}><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <label className="row"><input type="checkbox" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} /> Recurring monthly</label></div></Modal>}
  </>;
}

function Payables() {
  const { s, run, toast } = useApp();
  const [pay, setPay] = useState(null);
  const owed = s.purchases.filter((p) => p.source !== 'trade-in' && p.price - purchasePaid(p) > 0);
  return <>
    <div className="card" style={{ marginBottom: 12 }}>Total owed to sellers / suppliers: <b className="red">{money(sum(owed, (p) => p.price - purchasePaid(p)))}</b></div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Purchase</th><th>Seller</th><th>Device</th><th className="num">Price</th><th className="num">Owed</th><th></th></tr></thead>
      <tbody>{owed.map((p) => <tr key={p.id}><td>{p.no}<div className="small muted">{fmtDate(p.date)}</div></td><td>{p.sellerName}</td><td>{p.desc}</td><td className="num">{money(p.price)}</td><td className="num red bold">{money(p.price - purchasePaid(p))}</td>
        <td className="num"><button className="btn sm primary" onClick={() => setPay({ id: p.id, amount: p.price - purchasePaid(p), max: p.price - purchasePaid(p) })}>Pay</button></td></tr>)}</tbody></table>
      {!owed.length && <div className="empty">Nothing owed</div>}</div>
    {pay && <Modal title="Pay seller" onClose={() => setPay(null)} footer={<button className="btn primary" onClick={() => {
      if (!(+pay.amount > 0) || +pay.amount > pay.max) return toast('Invalid amount', 'err');
      run((d) => d.purchases.find((p) => p.id === pay.id).payments.push({ at: new Date().toISOString(), amount: +pay.amount, method: 'Cash' }), 'Payment recorded'); setPay(null); }}>Record cash payment</button>}>
      <Field label={`Amount (max ${money(pay.max)})`}><input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field></Modal>}
  </>;
}

function Salaries() {
  const { s, run, user, toast } = useApp();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [method, setMethod] = useState('Bank Transfer');
  const [ded, setDed] = useState({});
  const staff = s.users.filter((u) => u.active);
  const paid = (u) => (s.salaryPayments || []).find((x) => x.userId === u.id && x.month === month);
  const net = (u) => Math.max(0, salaryOf(u) - (+ded[u.id] || 0));
  const unpaid = staff.filter((u) => !paid(u) && salaryOf(u) > 0);
  const payroll = sum(staff, (u) => salaryOf(u));
  const paidTotal = sum(staff.map(paid).filter(Boolean), (x) => x.net);
  const label = new Date(month + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const pay = (u) => run((d) => paySalary(d, { userId: u.id, month, deduction: ded[u.id], method }, user.name), `Salary sent to ${u.name}`);
  const payAll = () => {
    if (!unpaid.length) return toast('Everyone is already paid for this month', 'err');
    if (!confirm(`Pay ${unpaid.length} staff member(s) a total of ${money(sum(unpaid, net))} for ${label}?`)) return;
    run((d) => unpaid.forEach((u) => paySalary(d, { userId: u.id, month, deduction: ded[u.id], method }, user.name)), `${unpaid.length} salaries paid`);
  };
  const slip = (x) => printHTML('Payslip', `<h1>${s.settings.shopName}</h1><div class="muted">Payslip – ${label}</div><h2>${x.name} (${x.role})</h2>
    <table><tr><td>Basic salary</td><td>${money(x.base)}</td></tr><tr><td>Allowance</td><td>${money(x.allowance)}</td></tr><tr><td>Deductions / advances</td><td>– ${money(x.deduction)}</td></tr>
    <tr><td><b>Net pay</b></td><td><b>${money(x.net)}</b></td></tr></table><p class="muted">Paid by ${x.method} on ${fmtDate(x.at.slice(0, 10))}</p>
    <p style="margin-top:50px">__________________ Employee signature</p>`);

  return <>
    <div className="row" style={{ marginBottom: 14 }}>
      <input type="month" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)} />
      <select style={{ width: 'auto' }} value={method} onChange={(e) => setMethod(e.target.value)}><option>Bank Transfer</option><option>Cash</option></select>
      <div className="grow" />
      <button className="btn primary" onClick={payAll} disabled={!unpaid.length}>Pay all unpaid ({unpaid.length})</button>
    </div>
    <div className="grid g3" style={{ marginBottom: 14 }}>
      <Stat icon="customers" label={`Payroll – ${label}`} value={money(payroll)} sub={`${staff.length} active staff`} />
      <Stat icon="check" tone="green" label="Paid" value={money(paidTotal)} />
      <Stat icon="clock" tone="amber" label="Remaining" value={money(sum(unpaid, net))} sub={`${unpaid.length} unpaid`} />
    </div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Staff</th><th className="num">Basic</th><th className="num">Allowance</th><th className="num">Deduction / advance</th><th className="num">Net pay</th><th>Status</th><th></th></tr></thead>
      <tbody>{staff.map((u) => { const p = paid(u); return <tr key={u.id}>
        <td><b>{u.name}</b><div className="small muted">{u.role}</div></td>
        <td className="num">{money(p ? p.base : u.salary)}</td><td className="num">{money(p ? p.allowance : u.allowance)}</td>
        <td className="num">{p ? money(p.deduction) : <input type="number" min="0" style={{ width: 110, height: 34, textAlign: 'right' }} placeholder="0" value={ded[u.id] || ''} onChange={(e) => setDed({ ...ded, [u.id]: e.target.value })} />}</td>
        <td className="num bold">{money(p ? p.net : net(u))}</td>
        <td>{p ? <Badge tone="green">Paid {fmtDate(p.at.slice(0, 10))}</Badge> : salaryOf(u) > 0 ? <Badge tone="amber">Unpaid</Badge> : <Badge>No salary set</Badge>}</td>
        <td className="num">{p ? <button className="btn sm" onClick={() => slip(p)}>Payslip</button> : <button className="btn sm primary" disabled={salaryOf(u) <= 0} onClick={() => pay(u)}>Send salary</button>}</td></tr>; })}</tbody></table></div>
    <p className="small muted" style={{ marginTop: 10 }}>Set each person's salary in Settings → Staff &amp; Permissions. Every payment is saved as a "Salaries" expense and appears in reports and the cash register (if paid by cash). This demo records the payment only – it doesn't move real money.</p>
  </>;
}
