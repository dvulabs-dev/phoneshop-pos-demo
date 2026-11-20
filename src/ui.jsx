import { Icon } from './icons';
import { useEffect } from 'react';

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')}>
        <div className="modal-h"><h3>{title}</h3><button className="btn ghost" onClick={onClose}><Icon name="x" size={14} /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
export const Badge = ({ tone = 'gray', children }) => <span className={'badge ' + tone}>{children}</span>;
export const Field = ({ label, hint, children, span, req }) => (
  <label className="field" style={span ? { gridColumn: `span ${span}` } : null}>
    <span>{label}{req && <i className="req">*</i>}</span>{children}{hint && <small>{hint}</small>}
  </label>
);
export const Stat = ({ label, value, sub, tone, icon }) => (
  <div className={'stat ' + (tone || '')}>
    {icon && <div className="stat-i"><Icon name={icon} size={20} /></div>}
    <div className="stat-body"><div className="stat-l">{label}</div><div className="stat-v">{value}</div>{sub && <div className="stat-s">{sub}</div>}</div>
  </div>
);
export const PageHead = ({ title, sub, children }) => (
  <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="row">{children}</div></div>
);
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs">{tabs.map((t) => <button key={t[0]} className={value === t[0] ? 'on' : ''} onClick={() => onChange(t[0])}>{t[1]}</button>)}</div>
);
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Locked = ({ what }) => <div className="empty"><div className="empty-i"><Icon name="lock" size={24} /></div>Your role does not have permission to {what}. Switch user (top right) to try another role.</div>;

export function BarChart({ data, fmt = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 600, H = 190, base = 165, top = 14;
  const w = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {[0, 0.5, 1].map((g) => <line key={g} x1="0" x2={W} y1={base - g * (base - top)} y2={base - g * (base - top)} stroke="var(--line)" strokeDasharray={g ? '3 4' : ''} />)}
      {data.map((d, i) => {
        const h = (d.value / max) * (base - top);
        return <g key={i}>
          <rect x={i * w + w * 0.18} y={base - h} width={w * 0.64} height={Math.max(h, 2)} rx="5" fill="var(--brand)" opacity={d.value ? 0.9 : 0.15}><title>{`${d.label}: ${fmt(d.value)}`}</title></rect>
          {(data.length <= 16 || i % 2 === 0) && <text x={i * w + w / 2} y={base + 18} fontSize="11" textAnchor="middle" fill="var(--muted)">{d.label}</text>}
        </g>;
      })}
    </svg>
  );
}

export const Section = ({ title, sub, icon, cols = 3, children }) => (
  <section className="fsec">
    <div className="fsec-h">{icon && <span className="fsec-i"><Icon name={icon} size={17} /></span>}<div><h4>{title}</h4>{sub && <p>{sub}</p>}</div></div>
    <div className={'form' + (cols === 3 ? ' c3' : '')}>{children}</div>
  </section>
);
