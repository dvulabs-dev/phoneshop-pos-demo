// Pure business logic. Every function mutates a *draft* copy of the state and may throw an Error
// (the store only commits the draft when nothing was thrown).
import { uid, pad, addMonths, sum } from './utils';

export const STATUS = {
  available: 'Available', reserved: 'Reserved', sold: 'Sold', returned: 'Returned',
  repair: 'Under repair', inspection: 'Inspection pending', damaged: 'Damaged',
};
export const STATUS_TONE = {
  available: 'green', reserved: 'amber', sold: 'gray', returned: 'red', repair: 'blue', inspection: 'amber', damaged: 'red',
};

export const PERMS = {
  seeCost: 'See cost price & margins',
  reports: 'View financial reports & profit',
  sell: 'Create sales / use POS',
  bigDiscount: 'Exceed discount limit / sell below minimum',
  refund: 'Approve refunds, returns & big trade-ins',
  editPrice: 'Change price during sale',
  stock: 'Manage phone & accessory stock',
  purchase: 'Record purchases',
  repairs: 'Manage repair jobs',
  expenses: 'Manage expenses & supplier payments',
  customers: 'Manage customers',
  deleteInvoice: 'Void invoices',
  settings: 'Edit shop settings',
  staff: 'Manage staff & permissions',
};
const ALL = Object.keys(PERMS);
export const ROLE_PERMS = {
  Admin: ALL,
  Manager: ALL.filter((p) => !['settings', 'staff'].includes(p)),
  Cashier: ['sell', 'customers'],
  Inventory: ['stock', 'purchase', 'seeCost'],
  Technician: ['repairs'],
  Accountant: ['reports', 'expenses', 'seeCost'],
};
export const ROLES = Object.keys(ROLE_PERMS);
export const can = (user, perm) => {
  if (!user) return false;
  if (user.overrides && perm in user.overrides) return user.overrides[perm];
  return ROLE_PERMS[user.role]?.includes(perm);
};

export const DEFAULT_SETTINGS = {
  shopName: 'CN Lanka Mobiles (Pvt) Ltd', tagline: 'Quality new & used phones you can trust', logo: '',
  address: 'Battaramulla, Sri Lanka', phone: '071 618 1598', whatsapp: '0716181598', email: '',
  regNo: '', taxNo: '', hours: 'Mon–Sat 9:00 – 19:00', social: '',
  // POS
  allowGuest: true, allowPartial: true, maxDiscountPct: 5, tradeInApprovalLimit: 100000, roundOff: true,
  // Invoice
  invoicePrefix: 'CNL-', invoicePad: 6, invoiceLayout: 'A4', invoiceLang: 'en',
  showImei: true, maskImei: true, showSerial: false, showCondition: true, showSignature: true, showStamp: true, showQR: true,
  taxLabel: 'VAT', taxRate: 0,
  invoiceFooter: 'Thank you for shopping with us!',
  warrantyText: 'Warranty covers hardware faults only. It does not cover physical damage, water damage or software tampering.',
  returnPolicy: 'Used phones may be exchanged within 7 days with the original invoice and unopened condition.',
  // Inventory
  brands: ['Apple', 'Samsung', 'Xiaomi', 'Google', 'Oppo', 'OnePlus', 'Huawei', 'Vivo', 'Realme', 'Nokia', 'Other'],
  conditions: ['New', 'Used', 'Refurbished', 'Damaged'],
  grades: ['A', 'B', 'C'],
  checklist: ['Display', 'Battery', 'Cameras', 'Speakers', 'Buttons', 'Charging port', 'Network / SIM', 'Wi-Fi / Bluetooth', 'Biometrics'],
  warrantyByCondition: { New: 12, Refurbished: 6, Used: 3, Damaged: 0 },
  agingDays: 45, lowMarginPct: 5,
  // Finance
  paymentMethods: { Cash: true, Card: true, 'Bank Transfer': true, 'Store Credit': true },
  expenseCategories: ['Rent', 'Utilities', 'Internet & Telecom', 'Salaries', 'Transport & Delivery', 'Repairs & Spare parts', 'Advertising', 'Other'],
  returnWindowDays: 7,
  // Appearance
  theme: 'light', brandColor: '#0e7490', compact: false,
  dashboardCards: { sales: true, profit: true, sold: true, stock: true, outstanding: true, repairs: true, reservations: true, payables: true },
  showChart: true,
  notifications: { lowStock: true, aging: true, warranty: true, payment: true, daily: true },
};

export const log = (d, by, action, detail = '') => {
  d.activity.unshift({ id: uid('a'), at: new Date().toISOString(), by: by || 'System', action, detail });
  if (d.activity.length > 400) d.activity.length = 400;
};
const addHistory = (p, text, by, at) => p.history.push({ at: at || new Date().toISOString(), by, text });
export const findDupImei = (d, imei, exceptId) =>
  imei ? d.phones.find((p) => p.id !== exceptId && (p.imei1 === imei || p.imei2 === imei)) : null;

// ---------- purchases ----------
export function createPurchase(d, data, by, when) {
  const at = when || new Date().toISOString();
  const ph = data.phone;
  if (!ph.brand || !ph.model) throw new Error('Brand and model are required');
  if (!/^\d{15}$/.test(ph.imei1 || '')) throw new Error('IMEI 1 must be 15 digits');
  const dup = findDupImei(d, ph.imei1) || findDupImei(d, ph.imei2);
  if (dup) throw new Error(`Duplicate IMEI – already registered as ${dup.stockId}`);
  if (!(+data.price >= 0)) throw new Error('Enter the buying price');
  let seller = null;
  if (data.seller?.name) {
    seller = data.seller.phone && d.sellers.find((s) => s.phone === data.seller.phone);
    if (!seller) { seller = { id: uid('sl'), ...data.seller }; d.sellers.push(seller); }
  }
  const phone = {
    id: uid('ph'), stockId: 'PH-' + pad(d.counters.phone++), ...ph,
    cost: +data.price, repairCost: 0, listPrice: +ph.listPrice || 0, minPrice: +ph.minPrice || 0,
    status: data.status || 'inspection', purchaseDate: at.slice(0, 10), sellerId: seller?.id || null, history: [],
    warrantyMonths: +ph.warrantyMonths || 0,
  };
  addHistory(phone, `Purchased for Rs. ${(+data.price).toLocaleString()} from ${seller?.name || '—'} (${data.source || 'purchase'})`, by, at);
  d.phones.push(phone);
  const purchase = {
    id: uid('pu'), no: 'PUR-' + pad(d.counters.purchase++, 4), date: at.slice(0, 10), at,
    sellerId: seller?.id || null, sellerName: seller?.name || '—', phoneId: phone.id, stockId: phone.stockId,
    desc: `${phone.brand} ${phone.model} ${phone.storage || ''}`.trim(), price: +data.price,
    payments: +data.paid > 0 ? [{ at, amount: +data.paid, method: 'Cash' }] : [], source: data.source || 'purchase', by,
  };
  d.purchases.push(purchase);
  log(d, by, 'Purchase', `${purchase.no} ${purchase.desc}`);
  return { phone, purchase };
}
export const purchasePaid = (p) => sum(p.payments, (x) => x.amount);

// ---------- sales ----------
export const saleFigures = (s) => {
  const live = s.items.filter((i) => !i.returned);
  const sub = sum(live, (i) => i.price * i.qty);
  const ratio = s.subtotal ? s.net / s.subtotal : 1;
  const revenue = sub * ratio;
  const cost = sum(live, (i) => i.cost * i.qty);
  return { revenue, cost, profit: revenue - cost };
};

export function createSale(d, p, by, when) {
  const at = when || new Date().toISOString();
  const st = d.settings;
  if (!p.items.length) throw new Error('Add at least one item');
  if (!p.customerId && !st.allowGuest) throw new Error('Guest sales are disabled – choose a customer');
  const reservation = p.reservationId ? d.reservations.find((r) => r.id === p.reservationId) : null;
  const items = p.items.map((it) => {
    if (it.type === 'phone') {
      const ph = d.phones.find((x) => x.id === it.refId);
      if (!ph) throw new Error('Phone not found');
      const ok = ph.status === 'available' || (ph.status === 'reserved' && reservation?.phoneId === ph.id);
      if (!ok) throw new Error(`${ph.stockId} is not available for sale`);
      return {
        type: 'phone', refId: ph.id, stockId: ph.stockId, name: `${ph.brand} ${ph.model} ${ph.storage || ''}`.trim(),
        desc: `${ph.condition}${ph.grade ? ' Grade ' + ph.grade : ''}`, imei: ph.imei1, serial: ph.serial, qty: 1,
        price: +it.price, cost: ph.cost + ph.repairCost, warrantyMonths: ph.warrantyMonths || 0,
      };
    }
    const a = d.accessories.find((x) => x.id === it.refId);
    if (!a) throw new Error('Accessory not found');
    if (a.qty < it.qty) throw new Error(`Only ${a.qty} × ${a.name} in stock`);
    return { type: 'acc', refId: a.id, name: a.name, qty: +it.qty, price: +it.price, cost: a.cost };
  });
  const subtotal = sum(items, (i) => i.price * i.qty);
  let discountAmt = p.discount?.type === 'pct' ? (subtotal * (+p.discount.value || 0)) / 100 : +p.discount?.value || 0;
  discountAmt = Math.min(Math.max(0, discountAmt), subtotal);
  if (st.roundOff) discountAmt = Math.round(discountAmt);
  const net = subtotal - discountAmt;
  const tradeValue = Math.min(+p.tradeIn?.value || 0, net);
  const total = net - tradeValue;
  const deposit = reservation ? reservation.deposit : 0;
  const payments = (p.payments || []).filter((x) => +x.amount > 0).map((x) => ({ method: x.method, amount: +x.amount, at }));
  const tender = deposit + sum(payments, (x) => x.amount);
  const paid = Math.min(total, tender);
  const change = Math.max(0, tender - total);
  const balance = total - paid;
  if (balance > 0.5 && !p.customerId) throw new Error('Choose a customer to leave a balance on credit');
  if (balance > 0.5 && !st.allowPartial) throw new Error('Partial payments are disabled in settings');
  const customer = p.customerId ? d.customers.find((c) => c.id === p.customerId) : null;
  const credit = sum(payments.filter((x) => x.method === 'Store Credit'), (x) => x.amount);
  if (credit > 0) {
    if (!customer || (customer.credit || 0) < credit) throw new Error('Not enough store credit');
    customer.credit -= credit;
  }

  const sale = {
    id: uid('s'), invoiceNo: st.invoicePrefix + pad(d.counters.invoice++, st.invoicePad), at, date: at.slice(0, 10),
    customerId: customer?.id || null, customerName: customer?.name || 'Walk-in Customer', customerPhone: customer?.phone || '',
    items, subtotal, discountAmt, discountInput: p.discount || null, net, tradeIn: null, total, payments, deposit, paid, change,
    balance, status: 'completed', by, note: p.note || '', shiftId: d.shift?.id || null,
  };
  // side effects
  items.forEach((it) => {
    if (it.type === 'phone') {
      const ph = d.phones.find((x) => x.id === it.refId);
      ph.status = 'sold';
      addHistory(ph, `Sold on ${sale.invoiceNo} for Rs. ${it.price.toLocaleString()} to ${sale.customerName}`, by, at);
    } else d.accessories.find((x) => x.id === it.refId).qty -= it.qty;
  });
  if (p.tradeIn && tradeValue > 0) {
    const t = p.tradeIn;
    const { phone } = createPurchase(d, {
      seller: { name: sale.customerName, phone: sale.customerPhone }, source: 'trade-in', status: 'inspection',
      price: tradeValue, paid: 0,
      phone: { brand: t.brand, model: t.model, storage: t.storage, color: t.color, imei1: t.imei1, imei2: '', condition: t.condition || 'Used',
        grade: t.grade || '', battery: t.battery || '', accessories: '', notes: `Trade-in on ${sale.invoiceNo}. ${t.notes || ''}`, checklist: {},
        listPrice: 0, minPrice: 0, warrantyMonths: st.warrantyByCondition?.[t.condition || 'Used'] ?? 0 },
    }, by, at);
    sale.tradeIn = { phoneId: phone.id, stockId: phone.stockId, desc: `${t.brand} ${t.model} ${t.storage || ''}`.trim(), imei: t.imei1, value: tradeValue };
  }
  if (reservation) { reservation.status = 'completed'; reservation.saleId = sale.id; }
  if (customer) customer.lastPurchase = sale.date;
  d.sales.push(sale);
  log(d, by, 'Sale', `${sale.invoiceNo} · Rs. ${total.toLocaleString()}`);
  return sale;
}

export function addPayment(d, saleId, pay, by) {
  const s = d.sales.find((x) => x.id === saleId);
  if (!(+pay.amount > 0)) throw new Error('Enter an amount');
  if (+pay.amount > s.balance + 0.01) throw new Error('Amount is more than the balance due');
  s.payments.push({ method: pay.method, amount: +pay.amount, at: new Date().toISOString() });
  s.paid += +pay.amount; s.balance = Math.max(0, s.total - s.paid);
  log(d, by, 'Payment', `${s.invoiceNo} +Rs. ${(+pay.amount).toLocaleString()}`);
}
export const payStatus = (s) => (s.status === 'void' ? 'Void' : s.balance <= 0.5 ? 'Paid' : s.paid > 0 ? 'Partial' : 'Unpaid');

export function voidSale(d, saleId, by) {
  const s = d.sales.find((x) => x.id === saleId);
  if (s.tradeIn) throw new Error('This sale has a trade-in – use the Returns flow instead');
  s.items.forEach((it) => {
    if (it.returned) return;
    if (it.type === 'phone') { const p = d.phones.find((x) => x.id === it.refId); p.status = 'available'; addHistory(p, `Invoice ${s.invoiceNo} voided`, by); }
    else d.accessories.find((x) => x.id === it.refId).qty += it.qty;
  });
  s.status = 'void';
  log(d, by, 'Void invoice', s.invoiceNo);
}

export function processReturn(d, r, by) {
  const s = d.sales.find((x) => x.id === r.saleId);
  const it = s.items[r.itemIdx];
  if (it.returned) throw new Error('Item already returned');
  const amount = +r.amount || 0;
  if (amount > it.price * it.qty) throw new Error('Refund is more than the item price');
  it.returned = { at: new Date().toISOString(), reason: r.reason, resolution: r.resolution, amount, by };
  if (it.type === 'phone') {
    const p = d.phones.find((x) => x.id === it.refId);
    p.status = r.restock; // inspection | available | damaged
    addHistory(p, `Returned from ${s.invoiceNo} (${r.reason}) – ${r.resolution}`, by);
  } else if (r.restock === 'available') d.accessories.find((x) => x.id === it.refId).qty += it.qty;
  if (r.resolution === 'store_credit' && s.customerId) d.customers.find((c) => c.id === s.customerId).credit = (d.customers.find((c) => c.id === s.customerId).credit || 0) + amount;
  d.returns.push({ id: uid('rt'), no: 'RET-' + pad(d.counters.ret++, 4), at: it.returned.at, saleId: s.id, invoiceNo: s.invoiceNo, item: it.name, imei: it.imei || '',
    reason: r.reason, resolution: r.resolution, amount, method: r.resolution === 'refund' ? r.method || 'Cash' : '-', by, customerName: s.customerName });
  log(d, by, 'Return', `${s.invoiceNo} ${it.name} → ${r.resolution}`);
}

// ---------- warranty ----------
export function warrantyList(d, todayISO) {
  const rows = [];
  d.sales.filter((s) => s.status === 'completed').forEach((s) => s.items.forEach((it, idx) => {
    if (it.type !== 'phone') return;
    const expiry = addMonths(s.date, it.warrantyMonths);
    const days = Math.round((new Date(expiry + 'T12:00:00') - new Date(todayISO + 'T12:00:00')) / 864e5);
    const status = it.returned ? 'void' : it.warrantyMonths === 0 ? 'none' : days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'active';
    rows.push({ key: s.id + idx, sale: s, item: it, expiry, days, status, claims: d.claims.filter((c) => c.saleId === s.id && c.imei === it.imei).length });
  }));
  return rows;
}

// ---------- repairs ----------
export const REPAIR_STAGES = ['Received', 'Diagnosing', 'In repair', 'Ready', 'Delivered', 'Cancelled'];
export const jobCharge = (j) => sum(j.parts, (p) => p.price) + (+j.labour || 0) + (+j.service || 0);
export const jobCost = (j) => sum(j.parts, (p) => p.cost) + (+j.internalCost || 0);
export const jobPaid = (j) => sum(j.payments, (p) => p.amount);

export function createRepair(d, j, by) {
  if (!j.problem) throw new Error('Describe the reported problem');
  const job = { id: uid('rj'), no: 'JOB-' + pad(d.counters.job++, 4), date: new Date().toISOString().slice(0, 10), stage: 'Received',
    parts: [], labour: 0, service: 0, internalCost: 0, payments: [], notes: '', ...j };
  if (j.advance > 0) job.payments.push({ at: new Date().toISOString(), amount: +j.advance, method: j.advanceMethod || 'Cash' });
  delete job.advance; delete job.advanceMethod;
  if (job.phoneId) {
    const p = d.phones.find((x) => x.id === job.phoneId);
    p.status = 'repair'; addHistory(p, `Sent for repair (${job.no}): ${job.problem}`, by);
  }
  d.repairs.push(job);
  log(d, by, 'Repair job', `${job.no} ${job.deviceDesc}`);
  return job;
}
export function updateRepair(d, id, patch, by) {
  const j = d.repairs.find((x) => x.id === id);
  Object.assign(j, patch);
  if (j.phoneId && !j.costApplied && ['Ready', 'Delivered'].includes(j.stage)) {
    const p = d.phones.find((x) => x.id === j.phoneId);
    const cost = jobCost(j) + (+j.labour || 0);
    p.repairCost += cost; j.costApplied = true;
    if (p.status === 'repair') p.status = 'available';
    addHistory(p, `Repair ${j.no} completed – refurbishment cost Rs. ${cost.toLocaleString()} added`, by);
  }
  if (patch.stage === 'Delivered' || patch.stage === 'Ready') j.completedAt = j.completedAt || new Date().toISOString();
}

// ---------- reservations ----------
export function createReservation(d, r, by) {
  const ph = d.phones.find((x) => x.id === r.phoneId);
  if (!ph || ph.status !== 'available') throw new Error('Phone is not available');
  if (!r.customerId) throw new Error('Choose a customer');
  if (!(+r.deposit > 0)) throw new Error('Enter the advance deposit');
  ph.status = 'reserved';
  const res = { id: uid('rs'), no: 'RES-' + pad(d.counters.res++, 4), at: new Date().toISOString(), status: 'active', ...r, deposit: +r.deposit };
  addHistory(ph, `Reserved for ${d.customers.find((c) => c.id === r.customerId)?.name} (deposit Rs. ${res.deposit.toLocaleString()})`, by);
  d.reservations.push(res);
  log(d, by, 'Reservation', `${res.no} ${ph.stockId}`);
}
export function cancelReservation(d, id, refund, by) {
  const r = d.reservations.find((x) => x.id === id);
  r.status = 'cancelled'; r.refunded = !!refund; r.cancelledAt = new Date().toISOString();
  const p = d.phones.find((x) => x.id === r.phoneId);
  if (p.status === 'reserved') { p.status = 'available'; addHistory(p, `Reservation ${r.no} cancelled`, by); }
  log(d, by, 'Cancel reservation', r.no);
}

// ---------- cash register ----------
export function cashSince(d, sinceISO) {
  const after = (t) => t >= sinceISO;
  const salesIn = sum(d.sales.filter((s) => s.status === 'completed').flatMap((s) => s.payments.filter((p) => p.method === 'Cash' && after(p.at))), (p) => p.amount)
    - sum(d.sales.filter((s) => after(s.at)), (s) => s.change);
  const repairIn = sum(d.repairs.flatMap((j) => j.payments.filter((p) => p.method === 'Cash' && after(p.at))), (p) => p.amount);
  const depositsIn = sum(d.reservations.filter((r) => r.method === 'Cash' && after(r.at)), (r) => r.deposit);
  const depositsOut = sum(d.reservations.filter((r) => r.refunded && after(r.cancelledAt || '')), (r) => r.deposit);
  const refundsOut = sum(d.returns.filter((r) => r.method === 'Cash' && after(r.at)), (r) => r.amount);
  const expensesOut = sum(d.expenses.filter((e) => e.method === 'Cash' && after(e.at)), (e) => e.amount);
  const purchasesOut = sum(d.purchases.flatMap((p) => p.payments.filter((x) => x.method === 'Cash' && after(x.at))), (x) => x.amount);
  return { salesIn, repairIn, depositsIn, depositsOut, refundsOut, expensesOut, purchasesOut,
    net: salesIn + repairIn + depositsIn - depositsOut - refundsOut - expensesOut - purchasesOut };
}

// ---------- payroll ----------
export const salaryOf = (u) => (+u.salary || 0) + (+u.allowance || 0);
export function paySalary(d, p, by) {
  d.salaryPayments = d.salaryPayments || [];
  const u = d.users.find((x) => x.id === p.userId);
  if (!(salaryOf(u) > 0)) throw new Error(`Set a salary for ${u.name} first (Settings → Staff & Permissions)`);
  if (d.salaryPayments.some((x) => x.userId === u.id && x.month === p.month)) throw new Error(`${u.name} is already paid for ${p.month}`);
  const gross = salaryOf(u);
  const deduction = Math.min(+p.deduction || 0, gross);
  const net = gross - deduction;
  const at = new Date().toISOString();
  const method = p.method || 'Bank Transfer';
  d.salaryPayments.push({ id: uid('sp'), userId: u.id, name: u.name, role: u.role, month: p.month, base: +u.salary || 0, allowance: +u.allowance || 0, deduction, net, method, at, by });
  d.expenses.push({ id: uid('ex'), date: at.slice(0, 10), at, category: 'Salaries', amount: net, method, note: `Salary ${p.month} – ${u.name}`, by });
  log(d, by, 'Salary paid', `${u.name} ${p.month} · Rs. ${net.toLocaleString()}`);
}
