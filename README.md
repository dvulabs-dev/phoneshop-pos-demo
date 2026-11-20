# CN Lanka Mobiles (Pvt) Ltd – Mobile Shop POS (frontend demo)

Frontend-only React + Vite demo of the *Used Mobile Phone Shop POS & Management System* plan.
No backend: all data is stored in the browser (`localStorage`) and seeded with sample data.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs ./dist (static files)
npm run preview
```

## Deploy (static hosting)

`vite.config.js` uses `base: './'` and the app uses hash routing, so the `dist` folder works anywhere:

- **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`, output directory `dist`
- **GitHub Pages / S3 / any web server**: upload the contents of `dist`

## What's included

Dashboard · POS (IMEI search, discounts with limits, split/partial payments, hold & resume, trade-in, reservation → sale) ·
A4 / thermal invoices (print / PDF, WhatsApp, email, Sinhala/English) · IMEI-level inventory with history & refurbishment costs ·
Used-phone purchasing & seller records · Customers · Warranty, claims, returns & exchanges · Repair job cards ·
Reservations · Cash register shifts, expenses, supplier payables · Reports (CSV export) · Full settings panel ·
Staff roles & per-user permission overrides (use the user switcher in the top bar to test cashier vs. manager).

Settings → Data & Security: backup / restore JSON and "Reset demo data".
