export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
export const pad = (n, l = 5) => String(n).padStart(l, '0');

export const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => localISO();
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return localISO(d); };
export const addMonths = (iso, m) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + m); return localISO(d); };
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
export const daysAgoISO = (n, hour = 12) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hour, Math.floor(Math.random() * 59), 0, 0); return d.toISOString(); };
export const fmtDate = (d) => d ? new Date(d.length > 10 ? d : d + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtTime = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const money = (n, cur = 'Rs.') =>
  `${cur} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const maskImei = (i) => (i ? '*'.repeat(Math.max(0, i.length - 4)) + i.slice(-4) : '');
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);

export function downloadCSV(name, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  download(name, csv, 'text/csv');
}
export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
export function printHTML(title, body) {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return alert('Please allow pop-ups to print.');
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>
  body{font-family:Segoe UI,Arial,sans-serif;color:#111;padding:24px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
  table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;padding:5px 8px;text-align:left}
  .muted{color:#666}.label{border:2px dashed #333;padding:10px;width:260px;display:inline-block;margin:6px}
  </style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`);
  w.document.close();
}
