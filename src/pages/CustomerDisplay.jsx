import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { Icon } from '../icons';
import { listenDisplay } from '../display';
import { money } from '../utils';

// Customer-facing screen: shows the live bill while the cashier works, adverts when idle, and a thank-you after payment.
export default function CustomerDisplay() {
  const { s } = useApp();
  const st = s.settings;
  const [view, setView] = useState({ stage: 'idle' });
  const holdUntil = useRef(0);
  const [slide, setSlide] = useState(0);

  useEffect(() => listenDisplay((d) => {
    if (d.stage === 'done') { holdUntil.current = Date.now() + 12000; setView(d); setTimeout(() => setView((v) => (v.stage === 'done' ? { stage: 'idle' } : v)), 12000); return; }
    if (Date.now() < holdUntil.current && d.stage === 'idle') return; // keep the thank-you visible
    holdUntil.current = 0; setView(d);
  }), []);

  const feature = s.phones.filter((p) => p.status === 'available');
  useEffect(() => { const t = setInterval(() => setSlide((n) => n + 1), 4500); return () => clearInterval(t); }, []);
  const ph = feature.length ? feature[slide % feature.length] : null;

  return (
    <div className="cd">
      <header className="cd-top"><div className="cd-logo">{st.logo ? <img src={st.logo} alt="" /> : <Icon name="inventory" size={26} />}</div>
        <div><b>{st.shopName}</b><span>{st.address}{st.phone && ` · ${st.phone}`}</span></div></header>

      {view.stage === 'cart' && <div className="cd-body">
        <div className="cd-items">
          <h2>{view.customerName ? `Hello, ${view.customerName.split(' ')[0]}` : 'Your items'}</h2>
          {view.items.map((it, i) => <div key={i} className="cd-line"><div><b>{it.name}</b>{it.meta && <span>{it.meta}</span>}</div><div className="cd-q">{it.qty > 1 ? `${it.qty} × ` : ''}{money(it.price)}</div></div>)}
        </div>
        <div className="cd-sum">
          <div><span>Subtotal</span><span>{money(view.subtotal)}</span></div>
          {view.discAmt > 0 && <div className="g"><span>Discount</span><span>– {money(view.discAmt)}</span></div>}
          {view.tradeVal > 0 && <div className="g"><span>Trade-in value</span><span>– {money(view.tradeVal)}</span></div>}
          <div className="cd-total"><span>Total to pay</span><b>{money(view.total)}</b></div>
          {view.tender > 0 && <div><span>Received</span><span>{money(Math.min(view.tender, view.total))}</span></div>}
          {view.balance > 0 && view.tender > 0 && <div className="r"><span>Balance</span><span>{money(view.balance)}</span></div>}
          {view.change > 0 && <div className="cd-change"><span>Your change</span><b>{money(view.change)}</b></div>}
          <p className="cd-note"><Icon name="warranty" size={16} /> Warranty details are printed on your invoice.</p>
        </div>
      </div>}

      {view.stage === 'done' && <div className="cd-done">
        <div className="cd-check"><Icon name="check" size={46} /></div>
        <h1>Thank you{view.customerName && view.customerName !== 'Walk-in Customer' ? `, ${view.customerName.split(' ')[0]}` : ''}!</h1>
        <p>Payment received · Invoice {view.invoiceNo}</p>
        <div className="cd-paid">{money(view.total)}</div>
        {view.change > 0 && <div className="cd-change big"><span>Your change</span><b>{money(view.change)}</b></div>}
        <p className="muted">{st.tagline}</p>
      </div>}

      {view.stage !== 'cart' && view.stage !== 'done' && <div className="cd-idle">
        <h1>Welcome to {st.shopName}</h1><p>{st.tagline}</p>
        {ph && <div className="cd-ad" key={ph.id}>
          <div className="cd-ad-ic"><Icon name="inventory" size={34} /></div>
          <div><small>Available today</small><h2>{ph.brand} {ph.model}</h2>
            <span>{ph.storage} · {ph.color} · {ph.condition}{ph.grade && ` ${ph.grade}`}{ph.battery && ` · Battery ${ph.battery}%`}</span>
            <span>{ph.warrantyMonths ? `${ph.warrantyMonths}-month warranty` : 'No warranty'}</span></div>
          <div className="cd-ad-p">{money(ph.listPrice)}</div>
        </div>}
        <p className="cd-foot">Ask our team about trade-ins, repairs and warranty · {st.phone}</p>
      </div>}
    </div>
  );
}
