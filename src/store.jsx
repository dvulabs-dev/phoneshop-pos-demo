import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { buildSeed } from './seed';
import { can as canFn, DEFAULT_SETTINGS } from './logic';
import { T as TR } from './i18n';

const KEY = 'cn-lanka-pos-demo-v1';
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      d.settings = { ...DEFAULT_SETTINGS, ...d.settings };
      d.salaryPayments = d.salaryPayments || [];
      return d;
    }
  } catch { /* ignore corrupt data */ }
  return buildSeed();
}

export function AppProvider({ children }) {
  const [s, setS] = useState(load);
  const ref = useRef(s);
  const [toasts, setToasts] = useState([]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ } }, [s]);
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = s.settings.theme;
    r.dataset.compact = s.settings.compact ? '1' : '0';
    r.style.setProperty('--brand', s.settings.brandColor);
  }, [s.settings.theme, s.settings.brandColor, s.settings.compact]);

  const toast = useCallback((msg, tone = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // run(fn, successMessage): fn mutates a draft; throwing cancels the whole change.
  const run = useCallback((fn, msg) => {
    try {
      const d = structuredClone(ref.current);
      const value = fn(d);
      ref.current = d; setS(d);
      if (msg) toast(msg);
      return { ok: true, value };
    } catch (e) { toast(e.message, 'err'); return { ok: false }; }
  }, [toast]);

  const user = s.users.find((u) => u.id === s.session.userId) || s.users[0];
  const can = (p) => canFn(user, p);
  const lang = s.settings.invoiceLang;
  const T = (k) => TR[lang]?.[k] || TR.en[k] || k;
  const reset = () => { localStorage.removeItem(KEY); const d = buildSeed(); ref.current = d; setS(d); toast('Demo data restored'); };
  const replace = (d) => { ref.current = d; setS(d); };

  return <Ctx.Provider value={{ s, run, toast, user, can, T, reset, replace }}>
    {children}
    <div className="toasts">{toasts.map((t) => <div key={t.id} className={'toast ' + t.tone}>{t.msg}</div>)}</div>
  </Ctx.Provider>;
}
