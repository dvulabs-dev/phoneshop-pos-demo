import { DEFAULT_SETTINGS, createPurchase, createSale, createRepair, createReservation, addPayment } from './logic';
import { uid, daysAgoISO, localISO, addDays } from './utils';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const imei = () => '35' + Array.from({ length: 13 }, () => Math.floor(rnd() * 10)).join('');

const CAT = [
  ['Apple', 'iPhone 11', '64GB', 'Black', 52000, 64000], ['Apple', 'iPhone 12', '128GB', 'Blue', 78000, 92000],
  ['Apple', 'iPhone 13', '128GB', 'Midnight', 98000, 115000], ['Apple', 'iPhone 13 Pro', '256GB', 'Graphite', 145000, 168000],
  ['Apple', 'iPhone 14', '128GB', 'Purple', 128000, 148000], ['Apple', 'iPhone 14 Pro Max', '256GB', 'Deep Purple', 210000, 238000],
  ['Apple', 'iPhone XR', '64GB', 'Red', 38000, 47000], ['Apple', 'iPhone 15', '128GB', 'Pink', 175000, 198000],
  ['Samsung', 'Galaxy S21', '128GB', 'Phantom Gray', 72000, 86000], ['Samsung', 'Galaxy S22 Ultra', '256GB', 'Burgundy', 135000, 158000],
  ['Samsung', 'Galaxy A54', '128GB', 'Violet', 58000, 69000], ['Samsung', 'Galaxy A34', '128GB', 'Graphite', 46000, 56000],
  ['Samsung', 'Galaxy S23', '256GB', 'Cream', 142000, 164000], ['Samsung', 'Galaxy Note 20', '256GB', 'Bronze', 70000, 84000],
  ['Xiaomi', 'Redmi Note 12', '128GB', 'Blue', 32000, 40000], ['Xiaomi', 'Poco X5 Pro', '256GB', 'Black', 44000, 54000],
  ['Google', 'Pixel 7', '128GB', 'Obsidian', 82000, 97000], ['Google', 'Pixel 6a', '128GB', 'Chalk', 55000, 66000],
  ['Oppo', 'Reno 8', '256GB', 'Gold', 52000, 63000], ['OnePlus', 'OnePlus 9', '128GB', 'Winter Mist', 60000, 72000],
  ['Huawei', 'P30 Pro', '256GB', 'Crystal', 42000, 52000], ['Vivo', 'V25', '256GB', 'Blue', 45000, 55000],
  ['Realme', 'GT Neo 3', '256GB', 'White', 48000, 58000], ['Apple', 'iPhone SE (2022)', '64GB', 'Starlight', 68000, 80000],
];
const SELLERS = [['Kamal Silva', '0712345601'], ['Nuwan Jayasinghe', '0762345602'], ['Tharindu Fernando', '0772345603'], ['Mobile Traders (Pvt) Ltd', '0112345604'], ['Sanduni Weerasinghe', '0702345605']];
const CUSTOMERS = [
  ['Ayesha Perera', '0771112233', 'Regular'], ['Chamara Bandara', '0712223344', 'VIP'], ['Dinesh Kumar', '0753334455', 'Regular'],
  ['Eranga Wijesinghe', '0764445566', 'Wholesale'], ['Fathima Rizwan', '0725556677', 'Regular'], ['Gayan Rajapaksha', '0786667788', 'Regular'],
  ['Hasini De Silva', '0707778899', 'VIP'], ['Isuru Madushanka', '0778889900', 'Regular'],
];
const ACC = [
  ['Silicone Phone Case', 'ACC-001', 40, 350, 1500, 10], ['Tempered Glass', 'ACC-002', 60, 200, 800, 15], ['20W Fast Charger', 'ACC-003', 25, 1400, 2900, 8],
  ['USB-C Cable 1m', 'ACC-004', 30, 450, 1200, 10], ['Lightning Cable 1m', 'ACC-005', 4, 900, 2200, 8], ['Wireless Earbuds', 'ACC-006', 12, 3200, 5900, 5],
  ['Power Bank 10000mAh', 'ACC-007', 9, 3000, 5200, 5], ['Car Phone Holder', 'ACC-008', 14, 700, 1600, 5],
];
const STAFF = [['Nimal Perera', 'Admin', 100000, 20000], ['Kasun Gunawardena', 'Manager', 75000, 10000], ['Dilani Herath', 'Cashier', 45000, 5000], ['Ruwan Pathirana', 'Inventory', 48000, 5000], ['Saman Kumara', 'Technician', 55000, 7000], ['Ishara Dissanayake', 'Accountant', 60000, 5000]];

export function buildSeed() {
  const d = {
    v: 1, settings: structuredClone(DEFAULT_SETTINGS), session: { userId: null },
    users: STAFF.map(([name, role, salary, allowance], i) => ({ id: 'u' + i, name, role, salary, allowance, active: true, overrides: {} })),
    phones: [], accessories: [], customers: [], sellers: [], purchases: [], sales: [], returns: [], claims: [], repairs: [],
    reservations: [], salaryPayments: [], expenses: [], drafts: [], shifts: [], shift: null, activity: [],
    counters: { phone: 1, purchase: 1, invoice: 1, ret: 1, job: 1, res: 1, claim: 1 },
  };
  d.session.userId = d.users[0].id;
  CUSTOMERS.forEach(([name, phone, group], i) => d.customers.push({ id: 'c' + i, name, phone, email: '', address: 'Colombo', group, notes: '', credit: 0, createdAt: daysAgoISO(90) }));
  ACC.forEach(([name, sku, qty, cost, price, lowAt], i) => d.accessories.push({ id: 'a' + i, name, sku, qty, cost, price, lowAt }));

  const grades = ['A', 'A', 'B', 'B', 'C'];
  const checklist = () => Object.fromEntries(DEFAULT_SETTINGS.checklist.map((k) => [k, rnd() > 0.06 ? 'Pass' : 'Fail']));
  const phoneIds = [];
  CAT.forEach(([brand, model, storage, color, cost, list], i) => {
    const cond = i === 7 ? 'New' : i % 9 === 4 ? 'Refurbished' : 'Used';
    const [sn, sp] = SELLERS[i % SELLERS.length];
    const { phone } = createPurchase(d, {
      seller: { name: sn, phone: sp, idNo: '' }, price: cost, paid: i % 11 === 3 ? Math.round(cost * 0.6) : cost, status: 'available',
      phone: { brand, model, storage, color, ram: '', imei1: imei(), imei2: '', serial: 'SN' + Math.floor(rnd() * 1e9), condition: cond,
        grade: cond === 'New' ? '' : pick(grades), battery: cond === 'New' ? '100' : String(78 + Math.floor(rnd() * 20)), accessories: i % 3 ? 'Charger, cable' : 'Box, charger, cable',
        notes: '', checklist: checklist(), listPrice: list, minPrice: Math.round(list * 0.94 / 500) * 500, warrantyMonths: DEFAULT_SETTINGS.warrantyByCondition[cond] },
    }, 'Ruwan Pathirana', daysAgoISO(34 + Math.floor(rnd() * 40)));
    phoneIds.push(phone.id);
  });
  // a few phones haven't moved for a long time → stock aging alert
  [0, 20].forEach((i) => { const p = d.phones.find((x) => x.id === phoneIds[i]); p.purchaseDate = localISO(new Date(Date.now() - 80 * 864e5)); });

  // sales spread across the last 3 weeks + today
  const sold = [2, 4, 8, 10, 11, 14, 16, 18, 5, 1, 9, 12];
  const days = [20, 17, 15, 13, 11, 9, 7, 5, 3, 1, 0, 0];
  sold.forEach((pi, k) => {
    const ph = d.phones.find((x) => x.id === phoneIds[pi]);
    const items = [{ type: 'phone', refId: ph.id, qty: 1, price: ph.listPrice }];
    if (k % 2 === 0) items.push({ type: 'acc', refId: 'a' + (k % 4), qty: 1, price: ACC[k % 4][4] });
    const disc = k % 3 === 0 ? { type: 'amt', value: 1500 } : null;
    const credit = k === 5;
    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0) - (disc?.value || 0);
    const total = subtotal;
    const payments = credit ? [{ method: 'Cash', amount: Math.round(total * 0.5) }] : k % 4 === 1 ? [{ method: 'Card', amount: total - 20000 }, { method: 'Cash', amount: 20000 }] : [{ method: k % 3 === 2 ? 'Bank Transfer' : 'Cash', amount: total }];
    const sale = createSale(d, { customerId: 'c' + (k % CUSTOMERS.length), items, discount: disc, payments }, k % 2 ? 'Dilani Herath' : 'Kasun Gunawardena', daysAgoISO(days[k], 10 + (k % 8)));
    if (k === 8) sale.payments.forEach((p) => { p.at = sale.at; });
  });
  // one older sale already warranty-expiring soon
  const old = d.sales[0]; old.at = daysAgoISO(88); old.date = old.at.slice(0, 10); old.items.forEach((i) => { if (i.type === 'phone') i.warrantyMonths = 3; });

  // reservation, repairs, in-shop statuses
  createReservation(d, { phoneId: phoneIds[13], customerId: 'c3', deposit: 15000, method: 'Cash', expires: addDays(localISO(), 5), note: 'Will collect on Saturday' }, 'Dilani Herath');
  createRepair(d, { deviceDesc: 'Samsung Galaxy S21', imei: d.phones.find((x) => x.id === phoneIds[8])?.imei1 || '', phoneId: phoneIds[20], internal: true, problem: 'Battery swell – replace battery', technicianId: 'u4' }, 'Saman Kumara');
  d.repairs[0].parts.push({ name: 'Replacement battery', cost: 6500, price: 0 });
  d.repairs[0].stage = 'In repair';
  createRepair(d, { customerId: 'c2', customerName: 'Dinesh Kumar', deviceDesc: 'iPhone 12', imei: '350000000000123', problem: 'Cracked screen', technicianId: 'u4', advance: 10000 }, 'Saman Kumara');
  d.repairs[1].parts.push({ name: 'Screen assembly', cost: 14000, price: 19000 }); d.repairs[1].labour = 3000; d.repairs[1].stage = 'Diagnosing';
  d.phones.find((x) => x.id === phoneIds[22]).status = 'inspection';
  d.phones.find((x) => x.id === phoneIds[6]).status = 'damaged';
  d.phones.find((x) => x.id === phoneIds[6]).history.push({ at: new Date().toISOString(), by: 'Ruwan Pathirana', text: 'Marked damaged – motherboard fault' });
  d.claims.push({ id: uid('cl'), no: 'CLM-0001', at: daysAgoISO(2), saleId: d.sales[8].id, invoiceNo: d.sales[8].invoiceNo, customerName: d.sales[8].customerName,
    device: d.sales[8].items[0].name, imei: d.sales[8].items[0].imei, fault: 'Speaker crackling at high volume', status: 'Inspecting', assessment: '', resolution: '' });

  // expenses (last 30 days)
  const ex = [['Rent', 150000, 28], ['Utilities', 18500, 20], ['Internet & Telecom', 6500, 18], ['Salaries', 210000, 14], ['Transport & Delivery', 4200, 9], ['Advertising', 12000, 6], ['Utilities', 3200, 2]];
  ex.forEach(([category, amount, ago]) => d.expenses.push({ id: uid('ex'), date: daysAgoISO(ago).slice(0, 10), at: daysAgoISO(ago), category, amount, method: category === 'Rent' ? 'Bank Transfer' : 'Cash', note: '', by: 'Ishara Dissanayake' }));
  return d;
}
