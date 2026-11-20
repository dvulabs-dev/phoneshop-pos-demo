import { useRef, useState } from 'react';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Tabs, Locked } from '../ui';
import { PERMS, ROLES, ROLE_PERMS, salaryOf } from '../logic';
import { download, fmtTime, uid, money } from '../utils';
import { InvoiceDoc } from './Invoices';

const CARDS = { sales: 'Sales total', profit: 'Gross & net profit', sold: 'Phones sold / bought', stock: 'Phones in stock', outstanding: 'Customer balances', repairs: 'Pending repairs', reservations: 'Reservations', payables: 'Owed to sellers' };

export default function Settings() {
  const { s, run, can, T, reset, replace, toast } = useApp();
  const [tab, setTab] = useState(can('settings') ? 'business' : 'staff');
  const st = s.settings;
  if (!can('settings') && !can('staff')) return <Locked what="open settings" />;
  const set = (k, v) => run((d) => { d.settings[k] = v; });
  const inp = (k, type = 'text') => <input type={type} value={st[k] ?? ''} onChange={(e) => set(k, type === 'number' ? +e.target.value : e.target.value)} />;
  const chk = (k, label) => <label className="row"><input type="checkbox" checked={!!st[k]} onChange={(e) => set(k, e.target.checked)} /> {label}</label>;
  const tabs = [...(can('settings') ? [['business', 'Business'], ['pos', 'POS & Sales'], ['invoice', 'Invoice'], ['inventory', 'Products & Inventory'], ['finance', 'Payments & Warranty'], ['appearance', 'Appearance'], ['notify', 'Notifications']] : []),
    ...(can('staff') ? [['staff', 'Staff & Permissions']] : []), ...(can('settings') ? [['data', 'Data & Security']] : [])];
  const listEditor = (key, label) => <ListEditor label={label} items={st[key]} onChange={(v) => set(key, v)} />;

  const sampleSale = s.sales[s.sales.length - 1];

  return (
    <>
      <PageHead title="Settings" sub="Everything here can be changed by the shop owner – no technical knowledge needed" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'business' && <div className="card"><div className="form">
        <Field label="Shop name">{inp('shopName')}</Field><Field label="Tagline">{inp('tagline')}</Field>
        <Field label="Address" span={2}>{inp('address')}</Field><Field label="Telephone">{inp('phone')}</Field><Field label="WhatsApp number">{inp('whatsapp')}</Field>
        <Field label="Email">{inp('email')}</Field><Field label="Business registration no.">{inp('regNo')}</Field><Field label="Tax / VAT no.">{inp('taxNo')}</Field><Field label="Opening hours">{inp('hours')}</Field>
        <Field label="Social media">{inp('social')}</Field>
        <Field label="Shop logo (max 300 KB)"><input type="file" accept="image/*" onChange={(e) => {
          const file = e.target.files[0]; if (!file) return;
          if (file.size > 300000) return toast('Logo is too large (max 300 KB)', 'err');
          const r = new FileReader(); r.onload = () => set('logo', r.result); r.readAsDataURL(file);
        }} />{st.logo && <button className="btn sm" onClick={() => set('logo', '')}>Remove logo</button>}</Field></div></div>}

      {tab === 'pos' && <div className="card"><div className="form">
        <Field label="Max cashier discount (%)" hint="Higher needs manager permission">{inp('maxDiscountPct', 'number')}</Field>
        <Field label="Trade-in value needing manager approval (Rs.)">{inp('tradeInApprovalLimit', 'number')}</Field>
        {chk('allowGuest', 'Allow guest (walk-in) sales')}{chk('allowPartial', 'Allow partial payments / balance on credit')}{chk('roundOff', 'Round discounts to whole rupees')}</div></div>}

      {tab === 'invoice' && <div className="grid g2"><div className="card"><div className="form">
        <Field label="Layout"><select value={st.invoiceLayout} onChange={(e) => set('invoiceLayout', e.target.value)}><option>A4</option><option>Thermal</option></select></Field>
        <Field label="Language"><select value={st.invoiceLang} onChange={(e) => set('invoiceLang', e.target.value)}><option value="en">English</option><option value="si">සිංහල (Sinhala)</option></select></Field>
        <Field label="Invoice prefix">{inp('invoicePrefix')}</Field><Field label="Number digits">{inp('invoicePad', 'number')}</Field>
        <Field label="Tax label">{inp('taxLabel')}</Field><Field label="Tax rate % (included in prices)">{inp('taxRate', 'number')}</Field>
        <Field label="Footer / thank-you message" span={2}>{inp('invoiceFooter')}</Field>
        <Field label="Warranty wording" span={2}><textarea rows={2} value={st.warrantyText} onChange={(e) => set('warrantyText', e.target.value)} /></Field>
        <Field label="Return policy" span={2}><textarea rows={2} value={st.returnPolicy} onChange={(e) => set('returnPolicy', e.target.value)} /></Field>
        {chk('showImei', 'Show IMEI')}{chk('maskImei', 'Mask IMEI (******1234)')}{chk('showSerial', 'Show serial number')}{chk('showCondition', 'Show condition / grade')}
        {chk('showSignature', 'Signature line')}{chk('showStamp', 'Shop stamp')}{chk('showQR', 'QR code box')}</div></div>
        <div style={{ overflow: 'auto' }}><b>Live preview</b>{sampleSale && <div style={{ transform: 'scale(.62)', transformOrigin: 'top left', width: 800, marginBottom: -380 }}><InvoiceDoc sale={sampleSale} settings={st} T={T} layout={st.invoiceLayout} /></div>}</div></div>}

      {tab === 'inventory' && <div className="grid g2">
        <div className="card">{listEditor('brands', 'Brands')}</div><div className="card">{listEditor('conditions', 'Condition types')}</div>
        <div className="card">{listEditor('grades', 'Condition grades')}</div><div className="card">{listEditor('checklist', 'Inspection checklist')}</div>
        <div className="card"><h3>Default warranty (months) by condition</h3>{st.conditions.map((c) => <div key={c} className="list-item"><span>{c}</span>
          <input style={{ width: 80 }} type="number" value={st.warrantyByCondition[c] ?? 0} onChange={(e) => set('warrantyByCondition', { ...st.warrantyByCondition, [c]: +e.target.value })} /></div>)}</div>
        <div className="card"><h3>Alerts</h3><div className="form"><Field label="Stock-aging alert after (days)">{inp('agingDays', 'number')}</Field><Field label="Low-margin alert below (%)">{inp('lowMarginPct', 'number')}</Field></div></div></div>}

      {tab === 'finance' && <div className="grid g2">
        <div className="card"><h3>Payment methods</h3>{Object.keys(st.paymentMethods).map((m) => <label key={m} className="row" style={{ marginBottom: 6 }}><input type="checkbox" checked={st.paymentMethods[m]} onChange={(e) => set('paymentMethods', { ...st.paymentMethods, [m]: e.target.checked })} /> {m}</label>)}
          <h3 style={{ marginTop: 14 }}>Returns</h3><Field label="Return / exchange window (days)">{inp('returnWindowDays', 'number')}</Field></div>
        <div className="card">{listEditor('expenseCategories', 'Expense categories')}</div></div>}

      {tab === 'appearance' && <div className="grid g2"><div className="card"><div className="form">
        <Field label="Theme"><select value={st.theme} onChange={(e) => set('theme', e.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></Field>
        <Field label="Brand colour"><input type="color" style={{ height: 40, padding: 3 }} value={st.brandColor} onChange={(e) => set('brandColor', e.target.value)} /></Field>
        {chk('compact', 'Compact view')}{chk('showChart', 'Show sales chart on dashboard')}</div></div>
        <div className="card"><h3>Dashboard cards</h3>{Object.entries(CARDS).map(([k, l]) => <label key={k} className="row" style={{ marginBottom: 6 }}><input type="checkbox" checked={st.dashboardCards[k]} onChange={(e) => set('dashboardCards', { ...st.dashboardCards, [k]: e.target.checked })} /> {l}</label>)}</div></div>}

      {tab === 'notify' && <div className="card"><h3>Dashboard alerts</h3>{[['lowStock', 'Low-stock accessories'], ['aging', 'Old-stock phones'], ['warranty', 'Warranty expiry reminders'], ['payment', 'Customer payment reminders'], ['daily', 'Daily sales summary']].map(([k, l]) =>
        <label key={k} className="row" style={{ marginBottom: 6 }}><input type="checkbox" checked={st.notifications[k]} onChange={(e) => set('notifications', { ...st.notifications, [k]: e.target.checked })} /> {l}</label>)}
        <p className="muted small">WhatsApp/e-mail sending in this demo opens a pre-filled message (wa.me / mailto). Automatic sending needs a backend service.</p></div>}

      {tab === 'staff' && <Staff />}

      {tab === 'data' && <div className="grid g2">
        <div className="card"><h3>Backup & restore</h3><p className="muted">All data lives in this browser. Download a backup regularly.</p>
          <div className="row"><button className="btn" onClick={() => download(`pos-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(s))}><Icon name="download" size={15} /> Download backup</button>
            <label className="btn"><Icon name="upload" size={15} /> Restore backup<input type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { try { const d = JSON.parse(t); if (!d.phones || !d.sales) throw 0; replace(d); toast('Backup restored'); } catch { toast('Invalid backup file', 'err'); } }); }} /></label>
            <button className="btn danger" onClick={() => confirm('Reset to the sample demo data? Your current data will be lost.') && reset()}>Reset demo data</button></div></div>
        <div className="card"><h3>Staff activity & change history</h3><div style={{ maxHeight: 380, overflow: 'auto' }}>{s.activity.slice(0, 80).map((a) => <div key={a.id} className="list-item small"><span><b>{a.action}</b> {a.detail}</span><span className="muted">{a.by} · {fmtTime(a.at)}</span></div>)}</div></div></div>}
    </>
  );
}

function ListEditor({ label, items, onChange }) {
  const [v, setV] = useState('');
  return <><h3>{label}</h3><div className="row" style={{ marginBottom: 8 }}>{items.map((x) => <Badge key={x}>{x} <a style={{ cursor: 'pointer' }} onClick={() => onChange(items.filter((i) => i !== x))}><Icon name="x" size={15} /> </a></Badge>)}</div>
    <div className="row"><input value={v} placeholder="Add…" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onChange([...items, v.trim()]); setV(''); } }} />
      <button className="btn sm" onClick={() => { if (v.trim()) { onChange([...items, v.trim()]); setV(''); } }}>Add</button></div></>;
}

function Staff() {
  const { s, run } = useApp();
  const [edit, setEdit] = useState(null);
  const permsOf = (u) => Object.keys(PERMS).filter((p) => (u.overrides && p in u.overrides ? u.overrides[p] : ROLE_PERMS[u.role].includes(p)));
  return <>
    <div className="row" style={{ marginBottom: 12 }}><div className="grow muted">Roles give default access; the owner can grant or remove individual permissions per person.</div><button className="btn primary" onClick={() => setEdit({ name: '', role: 'Cashier', active: true, overrides: {} })}><Icon name="plus" size={15} /> Add staff</button></div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Role</th><th className="num">Monthly pay</th><th>Permissions</th><th>Status</th><th></th></tr></thead>
      <tbody>{s.users.map((u) => <tr key={u.id}><td><b>{u.name}</b></td><td>{u.role}</td><td className="num">{salaryOf(u) > 0 ? money(salaryOf(u)) : <span className="muted">not set</span>}</td><td className="small">{permsOf(u).length} of {Object.keys(PERMS).length}{Object.keys(u.overrides || {}).length > 0 && <Badge tone="amber">custom</Badge>}</td>
        <td><Badge tone={u.active ? 'green' : 'gray'}>{u.active ? 'active' : 'deactivated'}</Badge></td><td className="num"><button className="btn sm" onClick={() => setEdit(structuredClone(u))}>Edit</button></td></tr>)}</tbody></table></div>
    {edit && <Modal wide title={edit.id ? `Edit ${edit.name}` : 'New staff member'} onClose={() => setEdit(null)} footer={<button className="btn primary" onClick={() => {
      if (!edit.name) return;
      run((d) => { if (edit.id) Object.assign(d.users.find((u) => u.id === edit.id), edit); else d.users.push({ ...edit, id: uid('u') }); }, 'Staff saved'); setEdit(null); }}>Save</button>}>
      <div className="form c3"><Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Role"><select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value, overrides: {} })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <label className="row"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active account</label></div>
      <h3 style={{ margin: '18px 0 8px' }}>Salary</h3>
      <div className="form c3"><Field label="Monthly basic salary (Rs.)"><input type="number" value={edit.salary || ''} onChange={(e) => setEdit({ ...edit, salary: +e.target.value })} placeholder="0" /></Field>
        <Field label="Monthly allowance (Rs.)"><input type="number" value={edit.allowance || ''} onChange={(e) => setEdit({ ...edit, allowance: +e.target.value })} placeholder="0" /></Field>
        <Field label="Total per month"><input disabled value={money(salaryOf(edit))} /></Field></div>
      <p className="small muted">Pay salaries from Cash &amp; Expenses → Salaries. Each payment is recorded as an expense.</p>
      <h3 style={{ margin: '14px 0 8px' }}>Permissions {edit.role === 'Admin' && <span className="muted small">(owner – full access)</span>}</h3>
      <div className="grid g2">{Object.entries(PERMS).map(([k, label]) => {
        const val = k in edit.overrides ? edit.overrides[k] : ROLE_PERMS[edit.role].includes(k);
        return <label key={k} className="row"><input type="checkbox" checked={val} disabled={edit.role === 'Admin'} onChange={(e) => {
          const o = { ...edit.overrides }; if (e.target.checked === ROLE_PERMS[edit.role].includes(k)) delete o[k]; else o[k] = e.target.checked; setEdit({ ...edit, overrides: o }); }} /> {label} {k in edit.overrides && <Badge tone="amber">override</Badge>}</label>;
      })}</div></Modal>}
  </>;
}
