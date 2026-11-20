import { useState } from 'react';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, PageHead, Locked } from '../ui';
import { REPAIR_STAGES, createRepair, updateRepair, jobCharge, jobCost, jobPaid } from '../logic';
import { money, fmtDate, printHTML } from '../utils';

export default function Repairs() {
  const { s, run, user, can, toast } = useApp();
  const [form, setForm] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [over, setOver] = useState(null);
  const [dragId, setDragId] = useState(null);
  if (!can('repairs')) return <Locked what="manage repairs" />;
  const seeCost = can('seeCost');
  const job = openId && s.repairs.find((j) => j.id === openId);
  const techs = s.users.filter((u) => u.role === 'Technician' || u.role === 'Admin');

  const create = () => {
    const j = { ...form };
    if (j.internal) {
      const p = s.phones.find((x) => x.id === j.phoneId);
      if (!p) return toast('Choose a stock phone', 'err');
      j.deviceDesc = `${p.brand} ${p.model}`; j.imei = p.imei1; j.customerName = 'Shop stock';
    } else {
      const c = s.customers.find((x) => x.id === j.customerId);
      if (!j.deviceDesc) return toast('Enter the device', 'err');
      j.customerName = c?.name || j.customerName || 'Walk-in';
    }
    if (run((d) => createRepair(d, j, user.name), 'Job card created').ok) setForm(null);
  };
  const patch = (p) => run((d) => updateRepair(d, job.id, p, user.name));
  const [part, setPart] = useState({ name: '', cost: '', price: '' });
  const [pay, setPay] = useState('');

  const printCard = () => printHTML('Job card', `<h1>${s.settings.shopName}</h1><div class="muted">Repair job card</div><h2>${job.no} · ${fmtDate(job.date)}</h2>
    <p>Customer: <b>${job.customerName}</b><br>Device: ${job.deviceDesc} (IMEI ${job.imei || '—'})<br>Problem: ${job.problem}</p>
    <table><tr><th>Part / service</th><th>Price</th></tr>${job.parts.map((p) => `<tr><td>${p.name}</td><td>${money(p.price)}</td></tr>`).join('')}<tr><td>Labour</td><td>${money(job.labour)}</td></tr><tr><td>Service charge</td><td>${money(job.service)}</td></tr>
    <tr><td><b>Total</b></td><td><b>${money(jobCharge(job))}</b></td></tr><tr><td>Paid</td><td>${money(jobPaid(job))}</td></tr><tr><td><b>Balance</b></td><td><b>${money(jobCharge(job) - jobPaid(job))}</b></td></tr></table>`);

  return (
    <>
      <PageHead title="Repairs & Service" sub="Job cards for customer devices and in-house refurbishment"><button className="btn primary" onClick={() => setForm({ internal: false, customerId: '', deviceDesc: '', imei: '', problem: '', technicianId: techs[0]?.id, advance: '', phoneId: '' })}><Icon name="plus" size={15} /> New job</button></PageHead>
      <div className="kanban">{REPAIR_STAGES.slice(0, 5).map((st) => (
        <div key={st} className={'col' + (over === st ? ' over' : '')}
          onDragOver={(e) => { e.preventDefault(); if (over !== st) setOver(st); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
          onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); const j = s.repairs.find((x) => x.id === id); if (j && j.stage !== st) run((d) => updateRepair(d, id, { stage: st }, user.name), `${j.no} moved to ${st}`); setDragId(null); }}>
          <h4>{st}<span>{s.repairs.filter((j) => j.stage === st).length}</span></h4>
          {s.repairs.filter((j) => j.stage === st).map((j) => <div key={j.id} className={'job' + (dragId === j.id ? ' dragging' : '')} draggable
            onDragStart={(e) => { e.dataTransfer.setData('text/plain', j.id); e.dataTransfer.effectAllowed = 'move'; setDragId(j.id); }} onDragEnd={() => { setDragId(null); setOver(null); }}
            onClick={() => setOpenId(j.id)}>
            <b>{j.no}</b> {j.internal && <Badge tone="blue">stock</Badge>}<div>{j.deviceDesc}</div><div className="small muted">{j.problem}</div>
            <div className="small" style={{ marginTop: 4 }}>{j.customerName} · {money(jobCharge(j))}</div></div>)}
          {!s.repairs.some((j) => j.stage === st) && <div className="col-empty">Drop a job here</div>}
        </div>))}</div>

      {form && <Modal title="New repair job" onClose={() => setForm(null)} footer={<button className="btn primary" onClick={create}>Create job card</button>}>
        <div className="form">
          <Field label="Job type" span={2}><select value={form.internal ? 'in' : 'out'} onChange={(e) => setForm({ ...form, internal: e.target.value === 'in' })}><option value="out">Customer's device (paid service)</option><option value="in">Shop stock phone (refurbishment)</option></select></Field>
          {form.internal ? <Field label="Stock phone" span={2}><select value={form.phoneId} onChange={(e) => setForm({ ...form, phoneId: e.target.value })}><option value="">Select…</option>{s.phones.filter((p) => ['available', 'inspection'].includes(p.status)).map((p) => <option key={p.id} value={p.id}>{p.stockId} · {p.brand} {p.model}</option>)}</select></Field> : <>
            <Field label="Customer"><select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Walk-in / not registered</option>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></Field>
            <Field label="Device"><input value={form.deviceDesc} onChange={(e) => setForm({ ...form, deviceDesc: e.target.value })} placeholder="iPhone 12" /></Field>
            <Field label="IMEI"><input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} /></Field>
            <Field label="Advance payment"><input type="number" value={form.advance} onChange={(e) => setForm({ ...form, advance: +e.target.value })} /></Field></>}
          <Field label="Reported problem" span={2}><textarea rows={2} value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} /></Field>
          <Field label="Technician" span={2}><select value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        </div></Modal>}

      {job && <Modal wide title={`${job.no} · ${job.deviceDesc}`} onClose={() => setOpenId(null)} footer={<button className="btn" onClick={printCard}><Icon name="printer" size={15} /> Job card / bill</button>}>
        <div className="row" style={{ marginBottom: 12 }}><Badge tone="blue">{job.customerName}</Badge><span className="muted">{job.problem}</span><span className="grow" />
          <select style={{ width: 'auto' }} value={job.stage} onChange={(e) => patch({ stage: e.target.value })}>{REPAIR_STAGES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="grid g2">
          <div><h3>Parts & costs</h3>
            {job.parts.map((p, i) => <div key={i} className="list-item"><span>{p.name}</span><span>{seeCost && <span className="muted small">cost {money(p.cost)} · </span>}{!job.internal && money(p.price)}</span></div>)}
            <div className="row" style={{ marginTop: 8 }}><input placeholder="Part" value={part.name} onChange={(e) => setPart({ ...part, name: e.target.value })} /><input style={{ width: 90 }} type="number" placeholder="Cost" value={part.cost} onChange={(e) => setPart({ ...part, cost: e.target.value })} />
              {!job.internal && <input style={{ width: 90 }} type="number" placeholder="Price" value={part.price} onChange={(e) => setPart({ ...part, price: e.target.value })} />}
              <button className="btn sm" onClick={() => { if (!part.name) return; patch({ parts: [...job.parts, { name: part.name, cost: +part.cost || 0, price: +part.price || 0 }] }); setPart({ name: '', cost: '', price: '' }); }}>Add</button></div>
            <div className="form" style={{ marginTop: 10 }}><Field label="Labour charge"><input type="number" value={job.labour} onChange={(e) => patch({ labour: +e.target.value })} /></Field>
              <Field label="Service charge"><input type="number" value={job.service} onChange={(e) => patch({ service: +e.target.value })} /></Field>
              <Field label="Other internal cost"><input type="number" value={job.internalCost} onChange={(e) => patch({ internalCost: +e.target.value })} /></Field></div>
          </div>
          <div>{job.internal ? <div className="card">Internal job – when marked <b>Ready</b>, parts + labour ({money(jobCost(job) + (+job.labour || 0))}) are added to the phone's true cost and it returns to stock.{job.costApplied && <p className="green"><Icon name="check" size={15} /> Cost already applied to stock record.</p>}</div> : <>
            <h3>Billing</h3>
            <div className="totals"><div><span>Charge total</span><b>{money(jobCharge(job))}</b></div><div><span>Paid</span><span>{money(jobPaid(job))}</span></div><div className="big"><span>Balance</span><span>{money(jobCharge(job) - jobPaid(job))}</span></div>
              {seeCost && <div className="green"><span>Est. profit</span><span>{money(jobCharge(job) - jobCost(job))}</span></div>}</div>
            {job.payments.map((p, i) => <div key={i} className="list-item small"><span>{p.method}</span><span>{money(p.amount)}</span></div>)}
            <div className="row" style={{ marginTop: 8 }}><input type="number" placeholder="Receive payment" value={pay} onChange={(e) => setPay(e.target.value)} />
              <button className="btn sm primary" onClick={() => { if (+pay > 0) { patch({ payments: [...job.payments, { at: new Date().toISOString(), amount: +pay, method: 'Cash' }] }); setPay(''); } }}>Cash in</button></div></>}
          </div>
        </div></Modal>}
    </>
  );
}
