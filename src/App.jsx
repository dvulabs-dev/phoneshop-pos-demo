import { useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useApp } from './store';
import { Icon } from './icons';
import { ROLES } from './logic';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Purchases from './pages/Purchases';
import Customers from './pages/Customers';
import { InvoiceList, InvoiceView } from './pages/Invoices';
import Warranty from './pages/Warranty';
import Repairs from './pages/Repairs';
import Reservations from './pages/Reservations';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import CustomerDisplay from './pages/CustomerDisplay';

const NAV = [
  ['/', 'dashboard', 'dashboard', () => true],
  ['/inventory', 'inventory', 'inventory', (c) => c('sell') || c('stock')],
  ['/purchases', 'purchases', 'purchases', (c) => c('purchase')],
  ['/customers', 'customers', 'customers', (c) => c('customers') || c('sell')],
  ['/invoices', 'invoices', 'invoices', (c) => c('sell') || c('reports')],
  ['/reservations', 'reservations', 'reservations', (c) => c('sell')],
  ['/warranty', 'warranty', 'warranty', (c) => c('sell') || c('repairs')],
  ['/repairs', 'repairs', 'repairs', (c) => c('repairs')],
  ['/cash', 'cash', 'cash', (c) => c('sell') || c('expenses')],
  ['/reports', 'reports', 'reports', (c) => c('reports')],
  ['/settings', 'settings', 'settings', (c) => c('settings') || c('staff')],
];

export default function App() {
  const { s, user, can, T, run } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const st = s.settings;
  const setUser = (id) => run((d) => { d.session.userId = id; });
  const toggleTheme = () => run((d) => { d.settings.theme = d.settings.theme === 'dark' ? 'light' : 'dark'; });
  const toggleLang = () => run((d) => { d.settings.invoiceLang = d.settings.invoiceLang === 'en' ? 'si' : 'en'; });

  if (loc.pathname === '/display') return <CustomerDisplay />;

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={'side' + (open ? ' open' : '')} onClick={() => setOpen(false)}>
        <div className="brand"><div className="logo">{st.logo ? <img src={st.logo} alt="" /> : <Icon name="inventory" size={20} />}</div><span>{st.shopName}</span></div>
        {can('sell') && <NavLink to="/pos" className="newsale" title="New sale"><Icon name="plus" size={16} /><span className="nl">{T('pos')}</span></NavLink>}
        <nav className="nav">
          {NAV.filter(([, , , ok]) => ok(can)).map(([to, key, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} title={T(key)} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={icon} /><span className="nl">{T(key)}</span></NavLink>
          ))}
        </nav>
        <div className="side-foot">Demo build · data is stored in this browser only</div>
      </aside>
      <div className="main">
        <header className="top">
          <button className="btn burger" onClick={() => setOpen(!open)}><Icon name="menu" size={15} /> </button>
          <div className="muted small grow date">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <button className="btn sm" onClick={toggleLang} title="Menu & invoice language">{st.invoiceLang === 'en' ? 'English' : 'සිංහල'}</button>
          <button className="btn sm" onClick={toggleTheme}><Icon name={st.theme === 'dark' ? 'sun' : 'moon'} size={16} /></button>
          <select style={{ width: 'auto' }} value={user.id} onChange={(e) => setUser(e.target.value)} title="Demo: switch user to see role permissions">
            {s.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </header>
        <main className="content" key={loc.pathname.split('/')[1]}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/invoices/:id" element={<InvoiceView />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/warranty" element={<Warranty />} />
            <Route path="/repairs" element={<Repairs />} />
            <Route path="/cash" element={<Finance />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
