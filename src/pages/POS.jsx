import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';
import { Badge, Field, Modal, Locked } from '../ui';
import { createSale } from '../logic';
import { money, sum, uid } from '../utils';
import { CustomerForm } from './Customers';
import { sendDisplay, openDisplay } from '../display';

const emptyTrade = { brand: 'Apple', model: '', storage: '', color: '', imei1: '', condition: 'Used', grade: 'B', battery: '', value: '', notes: '' };

export default function POS() {
  const { s, run, user, can, toast } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const st = s.settings;
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('phones');
  const [brand, setBrand] = useState('');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [custQ, setCustQ] = useState('');
  const [disc, setDisc] = useState({ type: 'amt', value: '' });
  const [trade, setTrade] = useState(null);
  const [tradeForm, setTradeForm] = useState(null);
  const [payments, setPayments] = useState([]);
  const [reservationId, setReservationId] = useState(null);
  const [note, setNote] = useState('');
  const [newCust, setNewCust] = useState(false);
  const [held, setHeld] = useState(false);
  const [done, setDone] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [cmp, setCmp] = useState([]);
  const [cmpOpen, setCmpOpen] = useState(false);
  const searchRef = useRef();

  const methods = Object.keys(st.paymentMethods).filter((m) => st.paymentMethods[m]);
  const reservation = reservationId ? s.reservations.find((r) => r.id === reservationId) : null;

  // convert a reservation into a sale
  useEffect(() => {
    const rid = loc.state?.reservationId;
    if (!rid) return;
    const r = s.reservations.find((x) => x.id === rid);
    const p = r && s.phones.find((x) => x.id === r.phoneId);
    if (!p) return;
    setReservationId(rid); setCustomerId(r.customerId);
    setCart([{ key: uid('k'), type: 'phone', refId: p.id, qty: 1, price: p.listPrice }]);
    window.history.replaceState({}, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const inCart = (id) => cart.some((c) => c.refId === id);
    if (tab === 'phones') {
      return s.phones.filter((p) => p.status === 'available' && !inCart(p.id) && (!brand || p.brand === brand) &&
        (!t || [p.brand, p.model, p.imei1, p.imei2, p.stockId, p.serial, p.storage, p.color].some((v) => (v || '').toLowerCase().includes(t)))).slice(0, 60);
    }
    return s.accessories.filter((a) => a.qty > 0 && (!t || (a.name + a.sku).toLowerCase().includes(t)));
  }, [q, tab, brand, s.phones, s.accessories, cart]);

  const lines = cart.map((c) => {
    const ph = c.type === 'phone' ? s.phones.find((p) => p.id === c.refId) : null;
    const ac = c.type === 'acc' ? s.accessories.find((a) => a.id === c.refId) : null;
    return { ...c, ph, ac, name: ph ? `${ph.brand} ${ph.model} ${ph.storage}` : ac?.name };
  });
  const subtotal = sum(lines, (l) => l.price * l.qty);
  let discAmt = disc.type === 'pct' ? (subtotal * (+disc.value || 0)) / 100 : +disc.value || 0;
  discAmt = Math.min(subtotal, Math.max(0, st.roundOff ? Math.round(discAmt) : discAmt));
  const net = subtotal - discAmt;
  const tradeVal = Math.min(+trade?.value || 0, net);
  const total = net - tradeVal;
  const deposit = reservation?.deposit || 0;
  const tender = deposit + sum(payments, (p) => p.amount);
  const balance = Math.max(0, total - tender);
  const change = Math.max(0, tender - total);
  const discPct = subtotal ? (discAmt / subtotal) * 100 : 0;
  const customer = s.customers.find((c) => c.id === customerId);
  const belowMin = lines.filter((l) => l.ph && l.ph.minPrice && l.price < l.ph.minPrice);

  const addPhone = (p) => setCart((c) => [...c, { key: uid('k'), type: 'phone', refId: p.id, qty: 1, price: p.listPrice }]);
  const addAcc = (a) => setCart((c) => {
    const ex = c.find((x) => x.refId === a.id);
    if (ex) return c.map((x) => (x === ex ? { ...x, qty: Math.min(a.qty, x.qty + 1) } : x));
    return [...c, { key: uid('k'), type: 'acc', refId: a.id, qty: 1, price: a.price }];
  });
  const onSearchKey = (e) => {
    if (e.key !== 'Enter') return;
    const t = q.trim();
    const exact = s.phones.find((p) => p.status === 'available' && (p.imei1 === t || p.imei2 === t || p.stockId.toLowerCase() === t.toLowerCase()));
    if (exact && !cart.some((c) => c.refId === exact.id)) { addPhone(exact); setQ(''); toast(`Added ${exact.brand} ${exact.model}`); }
  };
  const patchLine = (key, patch) => setCart((c) => c.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const reset = () => { setCart([]); setCustomerId(''); setDisc({ type: 'amt', value: '' }); setTrade(null); setPayments([]); setReservationId(null); setNote(''); setQ(''); };

  const hold = () => {
    if (!cart.length) return;
    run((d) => d.drafts.push({ id: uid('dr'), at: new Date().toISOString(), by: user.name, cart, customerId, disc, trade, payments, note }), 'Sale held – resume it from "Held sales"');
    reset();
  };
  const resume = (dr) => {
    setCart(dr.cart); setCustomerId(dr.customerId); setDisc(dr.disc); setTrade(dr.trade); setPayments(dr.payments); setNote(dr.note);
    run((d) => { d.drafts = d.drafts.filter((x) => x.id !== dr.id); }); setHeld(false);
  };

  useEffect(() => {
    sendDisplay({
      stage: lines.length ? 'cart' : 'idle', customerName: customer?.name || '', subtotal, discAmt, tradeVal, total, tender, balance, change,
      items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price, meta: l.ph ? `${l.ph.condition}${l.ph.grade ? ' ' + l.ph.grade : ''} · ${l.ph.warrantyMonths ? l.ph.warrantyMonths + ' mo warranty' : 'no warranty'}` : '' })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, disc, trade, payments, customerId]);
  const toggleCmp = (id) => setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? (toast('You can compare up to 3 phones', 'err'), c) : [...c, id]));

  const complete = () => {
    if (!can('sell')) return;
    if (discPct > st.maxDiscountPct + 0.001 && !can('bigDiscount')) return toast(`Discount ${discPct.toFixed(1)}% exceeds your limit of ${st.maxDiscountPct}% – manager approval required`, 'err');
    if (belowMin.length && !can('bigDiscount')) return toast('A price is below the approved minimum – manager approval required', 'err');
    if (trade && trade.value > st.tradeInApprovalLimit && !can('refund')) return toast(`Trade-in over ${money(st.tradeInApprovalLimit)} needs manager approval`, 'err');
    const res = run((d) => createSale(d, {
      customerId: customerId || null, reservationId, note, discount: { type: disc.type, value: +disc.value || 0 },
      items: cart.map((c) => ({ type: c.type, refId: c.refId, qty: c.qty, price: c.price })),
      tradeIn: trade ? { ...trade, value: tradeVal } : null, payments,
    }, user.name), 'Sale completed');
    if (res.ok) {
      const sale = res.value;
      sendDisplay({ stage: 'done', invoiceNo: sale.invoiceNo, total: sale.total, change: sale.change, customerName: sale.customerName });
      setDone(sale); reset(); setSheet(false);
    }
  };

  if (!can('sell')) return <Locked what="use the POS" />;
  const custMatches = custQ ? s.customers.filter((c) => (c.name + c.phone).toLowerCase().includes(custQ.toLowerCase())).slice(0, 5) : [];

  const avail = s.phones.filter((p) => p.status === 'available' && !cart.some((c) => c.refId === p.id));
  const brandList = [...new Set(avail.map((p) => p.brand))].sort();
  const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const itemCount = lines.reduce((a, l) => a + l.qty, 0);
  const payChips = methods.filter((m) => m !== 'Store Credit' || (customer?.credit || 0) > 0);

  return (
    <>
      <div className="pos-head"><h1>New Sale</h1>
        <div className="row"><button className="btn" onClick={() => setHeld(true)}><Icon name="pause" size={15} /> Held sales{s.drafts.length > 0 && <span className="pill">{s.drafts.length}</span>}</button>
          <button className="btn" onClick={openDisplay} title="Open the customer-facing screen on a second monitor or tablet"><Icon name="monitor" size={15} /> Customer display</button>
          <button className="btn danger" disabled={!cart.length} onClick={() => confirm('Cancel this sale and clear the cart?') && reset()}><Icon name="x" size={15} /> Cancel sale</button></div></div>
      <div className="pos">
        {/* ---------- catalog ---------- */}
        <section className="catalog">
          <div className="searchbar">
            <Icon name="search" size={20} />
            <input ref={searchRef} autoFocus placeholder="Search or scan IMEI, stock ID, brand, model…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} />
            {q && <button className="btn ghost sm" onClick={() => setQ('')}><Icon name="x" size={14} /></button>}
            <kbd>Enter</kbd>
          </div>
          <div className="cat-tools">
            <div className="seg">
              <button className={tab === 'phones' ? 'on' : ''} onClick={() => setTab('phones')}><Icon name="inventory" size={15} /> Phones <span>{avail.length}</span></button>
              <button className={tab === 'acc' ? 'on' : ''} onClick={() => setTab('acc')}><Icon name="box" size={15} /> Accessories <span>{s.accessories.filter((a) => a.qty > 0).length}</span></button>
            </div>
            {tab === 'phones' && <div className="chips">
              <button className={!brand ? 'on' : ''} onClick={() => setBrand('')}>All</button>
              {brandList.map((b) => <button key={b} className={brand === b ? 'on' : ''} onClick={() => setBrand(brand === b ? '' : b)}>{b}</button>)}
            </div>}
          </div>
          <div className="prods">
            {results.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}><div className="empty-i"><Icon name="search" size={22} /></div>No matching items available</div>}
            {tab === 'phones' ? results.map((p) => (
              <button key={p.id} className="pcard" onClick={() => addPhone(p)}>
                <span role="button" className={'pc-cmp' + (cmp.includes(p.id) ? ' on' : '')} title="Compare phones" onClick={(e) => { e.stopPropagation(); toggleCmp(p.id); }}><Icon name="swap" size={14} /> {cmp.includes(p.id) ? 'Selected' : 'Compare'}</span>
                <div className="pc-top"><div className="pc-av"><Icon name="inventory" size={20} /></div>
                  <div className="pc-name"><b>{p.model}</b><span>{p.brand} · {p.storage} · {p.color}</span></div></div>
                <div className="pc-tags">
                  <span className={'tag ' + (p.condition === 'New' ? 'g' : '')}>{p.condition}{p.grade && ` ${p.grade}`}</span>
                  {p.battery && <span className="tag"><Icon name="battery" size={12} /> {p.battery}%</span>}
                  <span className="tag"><Icon name="warranty" size={12} /> {p.warrantyMonths ? p.warrantyMonths + ' mo' : 'No warranty'}</span>
                </div>
                <div className="pc-imei">IMEI …{p.imei1.slice(-6)} · {p.stockId}</div>
                <div className="pc-foot"><div><div className="pc-price">{money(p.listPrice)}</div>{can('seeCost') && <div className="pc-margin">+{money(p.listPrice - p.cost - p.repairCost)} margin</div>}</div>
                  <span className="pc-add"><Icon name="plus" size={18} /></span></div>
              </button>
            )) : results.map((a) => (
              <button key={a.id} className="pcard" onClick={() => addAcc(a)}>
                <div className="pc-top"><div className="pc-av"><Icon name="box" size={20} /></div><div className="pc-name"><b>{a.name}</b><span>{a.sku}</span></div></div>
                <div className="pc-tags"><span className={'tag ' + (a.qty <= a.lowAt ? 'r' : '')}>{a.qty} in stock</span></div>
                <div className="pc-foot"><div className="pc-price">{money(a.price)}</div><span className="pc-add"><Icon name="plus" size={18} /></span></div>
              </button>
            ))}
          </div>
          {cmp.length > 0 && <div className="cmp-bar"><span><b>{cmp.length}</b> selected to compare</span>
            <div className="row"><button className="btn sm" onClick={() => setCmp([])}>Clear</button><button className="btn primary sm" disabled={cmp.length < 2} onClick={() => setCmpOpen(true)}>Compare{cmp.length < 2 ? ' (pick 2+)' : ''}</button></div></div>}
        </section>

        {/* ---------- ticket ---------- */}
        {sheet && <div className="sheet-scrim" onClick={() => setSheet(false)} />}
        <aside className={'ticket' + (sheet ? ' open' : '')}>
          <div className="tk-head"><h3>Current sale</h3><button className="btn ghost sm sheet-x" onClick={() => setSheet(false)} aria-label="Close cart"><Icon name="x" size={16} /></button>{itemCount > 0 && <span className="pill">{itemCount} item{itemCount > 1 ? 's' : ''}</span>}
            {reservation && <Badge tone="amber">Reservation {reservation.no}</Badge>}</div>
          <div className="tk-body">
            <div className="tk-sec">
              <div className="tk-lbl">Customer</div>
              {customer ? (
                <div className="cust-card"><div className="cust-av">{initials(customer.name)}</div>
                  <div className="grow"><b>{customer.name}</b><div className="small muted">{customer.phone} · {customer.group}</div></div>
                  {customer.credit > 0 && <Badge tone="green">credit {money(customer.credit)}</Badge>}
                  <button className="btn sm ghost" onClick={() => setCustomerId('')}>Change</button></div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div className="row" style={{ flexWrap: 'nowrap' }}><div className="inp-ic grow"><Icon name="user" size={16} /><input placeholder={st.allowGuest ? 'Customer phone or name (or guest)' : 'Customer phone or name'} value={custQ} onChange={(e) => setCustQ(e.target.value)} /></div>
                    <button className="btn sm" onClick={() => setNewCust(true)}><Icon name="plus" size={14} /> New</button></div>
                  {custMatches.length > 0 && <div className="dropdown">{custMatches.map((c) => <div key={c.id} className="dd-item" onClick={() => { setCustomerId(c.id); setCustQ(''); }}><span>{c.name}</span><span className="muted small">{c.phone}</span></div>)}</div>}
                </div>
              )}
            </div>

            <div className="tk-sec">
              <div className="tk-lbl">Items</div>
              {lines.length === 0 && <div className="tk-empty"><div className="empty-i"><Icon name="purchases" size={22} /></div><b>Cart is empty</b><span>Pick a phone or accessory from the left</span></div>}
              {lines.map((l) => (
                <div key={l.key} className="line">
                  <div className="line-main"><b>{l.name}</b>
                    {l.ph && <div className="small muted">{l.ph.condition}{l.ph.grade && ` ${l.ph.grade}`} · IMEI …{l.ph.imei1.slice(-4)} · {l.ph.warrantyMonths ? l.ph.warrantyMonths + ' mo warranty' : 'no warranty'}</div>}
                    {l.type === 'acc' && <div className="qty"><button onClick={() => patchLine(l.key, { qty: Math.max(1, l.qty - 1) })}>−</button><span>{l.qty}</span><button onClick={() => patchLine(l.key, { qty: Math.min(l.ac?.qty || 1, l.qty + 1) })}>+</button></div>}
                    {l.ph && l.ph.minPrice > 0 && l.price < l.ph.minPrice && <div className="small red">Below minimum {money(l.ph.minPrice)}</div>}</div>
                  <div className="line-price"><input type="number" disabled={!can('editPrice')} title={can('editPrice') ? 'Edit price' : 'Price changes need manager permission'} value={l.price} onChange={(e) => patchLine(l.key, { price: +e.target.value })} /></div>
                  <button className="line-x" title="Remove" onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}><Icon name="x" size={14} /></button>
                </div>
              ))}
            </div>

            {lines.length > 0 && <>
              <div className="tk-sec">
                <div className="tk-lbl">Adjustments</div>
                <div className="adj"><span><Icon name="tag" size={15} /> Discount</span>
                  <div className="seg sm"><button className={disc.type === 'amt' ? 'on' : ''} onClick={() => setDisc({ ...disc, type: 'amt' })}>Rs.</button><button className={disc.type === 'pct' ? 'on' : ''} onClick={() => setDisc({ ...disc, type: 'pct' })}>%</button></div>
                  <input type="number" min="0" placeholder="0" value={disc.value} onChange={(e) => setDisc({ ...disc, value: e.target.value })} /></div>
                {discPct > st.maxDiscountPct && <div className={'warn ' + (can('bigDiscount') ? 'amber' : 'red')}><Icon name="alert" size={14} /> {discPct.toFixed(1)}% is above the {st.maxDiscountPct}% limit{can('bigDiscount') ? ' (you can approve)' : ' – manager approval needed'}</div>}
                <div className="adj"><span><Icon name="swap" size={15} /> Trade-in</span>
                  {trade ? <div className="trade-pill"><b>{trade.brand} {trade.model}</b><span>– {money(tradeVal)}</span><button onClick={() => setTrade(null)}><Icon name="x" size={13} /></button></div>
                    : <button className="btn sm" onClick={() => setTradeForm({ ...emptyTrade })}><Icon name="plus" size={14} /> Add old phone</button>}</div>
              </div>

              <div className="tk-sec">
                <div className="tk-lbl">Payment {deposit > 0 && <span className="muted">· deposit {money(deposit)} already received</span>}</div>
                <div className="pay-chips">{payChips.map((m) => <button key={m} className={payments.length === 1 && payments[0].method === m ? 'on' : ''} onClick={() => setPayments([{ method: m, amount: Math.max(0, total - deposit) }])}>
                  <Icon name={m === 'Cash' ? 'cash' : m === 'Card' ? 'wallet' : 'trend'} size={16} />{m}</button>)}</div>
                {payments.map((p, i) => (
                  <div key={i} className="pay-row">
                    <select value={p.method} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>{methods.map((m) => <option key={m}>{m}</option>)}</select>
                    <input type="number" min="0" value={p.amount} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, amount: +e.target.value } : x)))} />
                    <button className="line-x" onClick={() => setPayments(payments.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
                  </div>
                ))}
                <button className="link" onClick={() => setPayments([...payments, { method: methods[0], amount: Math.max(0, total - tender) }])}><Icon name="plus" size={13} /> Split / add another payment</button>
                <input style={{ marginTop: 10 }} placeholder="Sale note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </>}
          </div>

          <div className="tk-foot">
            {(discAmt > 0 || tradeVal > 0) && <div className="sum"><div><span>Subtotal</span><span>{money(subtotal)}</span></div>
              {discAmt > 0 && <div className="neg"><span>Discount</span><span>– {money(discAmt)}</span></div>}
              {tradeVal > 0 && <div className="neg"><span>Trade-in</span><span>– {money(tradeVal)}</span></div>}</div>}
            <div className="grand"><span>Total</span><b>{money(total)}</b></div>
            {lines.length > 0 && <div className={'recv ' + (balance > 0 ? 'due' : change > 0 ? 'chg' : 'ok')}>
              {balance > 0 ? <>Balance due (on credit) <b>{money(balance)}</b></> : change > 0 ? <>Change to return <b>{money(change)}</b></> : tender >= total ? <><Icon name="check" size={14} /> Fully paid</> : null}</div>}
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button className="btn lg" disabled={!lines.length} onClick={hold} title="Hold this sale"><Icon name="pause" size={18} /></button>
              <button className="btn primary lg grow charge" disabled={!lines.length} onClick={complete}><Icon name="check" size={18} /> Charge {money(total)}</button>
            </div>
          </div>
        </aside>
        {itemCount > 0 && <div className="cart-fab"><button onClick={() => setSheet(true)}><span className="fab-count"><Icon name="purchases" size={17} />{itemCount}</span><span>View cart &amp; pay</span><b>{money(total)}</b></button></div>}
      </div>

      {done && <Modal title="Sale completed" onClose={() => setDone(null)} footer={<>
        <button className="btn" onClick={() => nav('/invoices/' + done.id)}><Icon name="printer" size={15} /> View / print invoice</button>
        {done.customerPhone && <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/94${done.customerPhone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(`Thank you for shopping at ${st.shopName}! Invoice ${done.invoiceNo}: ${money(done.total)}.`)}`}><Icon name="message" size={15} /> WhatsApp</a>}
        <button className="btn primary" onClick={() => setDone(null)}><Icon name="plus" size={15} /> New sale</button></>}>
        <div className="done">
          <div className="done-ic"><Icon name="check" size={30} /></div>
          <h2>{done.balance > 0.5 ? 'Sale saved – balance pending' : 'Payment received'}</h2>
          <p className="muted">{done.invoiceNo} · {done.customerName}</p>
          <div className="done-total">{money(done.total)}</div>
          {done.change > 0 && <div className="done-row chg"><span>Give change back</span><b>{money(done.change)}</b></div>}
          {done.balance > 0.5 && <div className="done-row due"><span>Balance still due</span><b>{money(done.balance)}</b></div>}
        </div>
      </Modal>}

      {cmpOpen && (() => {
        const list = cmp.map((id) => s.phones.find((p) => p.id === id)).filter(Boolean);
        const rows = [['Price', (p) => money(p.listPrice)], ['Storage', (p) => p.storage || '—'], ['Colour', (p) => p.color || '—'], ['Condition', (p) => p.condition + (p.grade ? ' · Grade ' + p.grade : '')],
          ['Battery health', (p) => (p.battery ? p.battery + '%' : '—')], ['Warranty', (p) => (p.warrantyMonths ? p.warrantyMonths + ' months' : 'None')], ['Included', (p) => p.accessories || '—'], ['IMEI', (p) => '…' + p.imei1.slice(-6)],
          ...(can('seeCost') ? [['Margin', (p) => money(p.listPrice - p.cost - p.repairCost)]] : [])];
        const best = Math.min(...list.map((p) => p.listPrice));
        return <Modal wide title="Compare phones" onClose={() => setCmpOpen(false)}>
          <div className="tbl-wrap"><table className="tbl cmp"><thead><tr><th></th>{list.map((p) => <th key={p.id}><b>{p.brand} {p.model}</b><div className="small muted" style={{ textTransform: 'none', letterSpacing: 0 }}>{p.stockId}</div></th>)}</tr></thead>
            <tbody>{rows.map(([label, fn]) => <tr key={label}><td className="muted">{label}</td>{list.map((p) => <td key={p.id} className={label === 'Price' && p.listPrice === best && list.length > 1 ? 'green bold' : ''}>{fn(p)}</td>)}</tr>)}
              <tr><td></td>{list.map((p) => <td key={p.id}><button className="btn primary sm" onClick={() => { addPhone(p); setCmp((c) => c.filter((x) => x !== p.id)); setCmpOpen(false); }}><Icon name="plus" size={14} /> Add to sale</button></td>)}</tr></tbody></table></div>
        </Modal>;
      })()}

      {newCust && <Modal title="New customer" onClose={() => setNewCust(false)}>
        <CustomerForm initial={{ name: '', phone: custQ.replace(/\D/g, ''), group: 'Regular' }} onDone={(id) => { setCustomerId(id); setNewCust(false); setCustQ(''); }} onCancel={() => setNewCust(false)} />
      </Modal>}

      {held && <Modal title="Held sales" onClose={() => setHeld(false)}>
        {s.drafts.length === 0 && <div className="empty">No held sales</div>}
        {s.drafts.map((dr) => <div key={dr.id} className="list-item"><div><b>{dr.cart.length} item(s)</b> <span className="muted small">held by {dr.by} · {new Date(dr.at).toLocaleTimeString()}</span></div>
          <div className="row"><button className="btn sm primary" onClick={() => resume(dr)}>Resume</button><button className="btn sm danger" onClick={() => run((d) => { d.drafts = d.drafts.filter((x) => x.id !== dr.id); })}>Delete</button></div></div>)}
      </Modal>}

      {tradeForm && <Modal title="Trade-in: inspect customer's old phone" onClose={() => setTradeForm(null)}
        footer={<><button className="btn" onClick={() => setTradeForm(null)}>Cancel</button>
          <button className="btn primary" onClick={() => {
            const t = tradeForm;
            if (!t.model || !/^\d{15}$/.test(t.imei1)) return toast('Model and a 15-digit IMEI are required', 'err');
            if (s.phones.some((p) => p.imei1 === t.imei1)) return toast('This IMEI already exists in stock', 'err');
            if (!(+t.value > 0)) return toast('Enter the agreed trade-in value', 'err');
            setTrade({ ...t, value: +t.value }); setTradeForm(null);
          }}>Apply trade-in</button></>}>
        <div className="form">
          <Field label="Brand"><select value={tradeForm.brand} onChange={(e) => setTradeForm({ ...tradeForm, brand: e.target.value })}>{st.brands.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Model"><input value={tradeForm.model} onChange={(e) => setTradeForm({ ...tradeForm, model: e.target.value })} /></Field>
          <Field label="Storage"><input value={tradeForm.storage} placeholder="128GB" onChange={(e) => setTradeForm({ ...tradeForm, storage: e.target.value })} /></Field>
          <Field label="IMEI (15 digits)"><input value={tradeForm.imei1} maxLength={15} onChange={(e) => setTradeForm({ ...tradeForm, imei1: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Condition"><select value={tradeForm.condition} onChange={(e) => setTradeForm({ ...tradeForm, condition: e.target.value })}>{st.conditions.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Grade"><select value={tradeForm.grade} onChange={(e) => setTradeForm({ ...tradeForm, grade: e.target.value })}>{st.grades.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Battery health %"><input value={tradeForm.battery} onChange={(e) => setTradeForm({ ...tradeForm, battery: e.target.value })} /></Field>
          <Field label="Agreed trade-in value (Rs.)" hint={`Over ${money(st.tradeInApprovalLimit)} needs manager approval`}><input type="number" value={tradeForm.value} onChange={(e) => setTradeForm({ ...tradeForm, value: e.target.value })} /></Field>
          <Field label="Inspection notes" span={2}><textarea rows={2} value={tradeForm.notes} onChange={(e) => setTradeForm({ ...tradeForm, notes: e.target.value })} /></Field>
        </div>
        <p className="small muted">On completing the sale, a purchase record and a stock entry (status: inspection pending) are created automatically for this phone.</p>
      </Modal>}
    </>
  );
}
