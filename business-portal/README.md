# Business Hub

Business Hub module inside the unified repository. The full repository deploys Path Lab and Business Hub together; their logins, staff and databases remain separate. See `../docs/UNIFIED-DEPLOYMENT.md` for the one-project Vercel setup.

## Stack and theme

- React, React Router and Vite; Node/Express; Mongoose and MongoDB.
- The design tokens in `src/tokens.css` were copied from the existing Path Lab theme: blue `#2563eb`, white surfaces, slate text, subtle borders and rounded controls.
- Node 22.13 or newer is required. No SQLite, browser-local persistence or mock API is used.

## Run locally

```powershell
cd D:\Pathlab\business-portal
npm install
npm run dev
```

Website: `http://127.0.0.1:5178` • API: `http://127.0.0.1:4318/api/health` (internal) / `http://127.0.0.1:5178/hub-api/health` (browser)

Without `MONGODB_URI`, development starts a real isolated local `mongod` using the development runner. Its WiredTiger database files persist in ignored `data/mongo/`. This runner is for local development, not production hosting. The first run may download an official MongoDB binary; an existing cached binary is reused.

On the first launch, a randomly generated owner password is printed in the local server terminal, along with `owner@business.local`. Save it securely. It is not embedded in the frontend or committed to source. Later starts use the same account. Owners can create staff or reset credentials in **Staff & access**.

For your own MongoDB instance/Atlas cluster, copy `.env.example` to `.env`, set `MONGODB_URI` and choose a **dedicated** `MONGODB_DATABASE`. Do not point it at the existing Path Lab database. Optional `INITIAL_OWNER_EMAIL` and `INITIAL_OWNER_PASSWORD` apply only when that database has no users.

## Available workflows

- Public portal with four destinations. Path Lab opens the original application at `/pathlab/` and keeps its own login. Run the combined preview from the repository root to serve it locally.
- Hotel/room listings and request form; legal service descriptions and service-specific forms. Both issue references and store requests in MongoDB.
- Public form validation, honeypot, throttling, duplicate-safe submission, on-screen acknowledgement; no notification integrations or payment gateway.
- Owner, restaurant administrator, cashier, hotel staff and legal staff roles enforced on the server.
- POS menu/category filters, cart, quantities, customer/reference fields, cash/UPI/card recording, owner/admin discount, tax/charge configuration, cash change, saved drafts and finalisation.
- Server-calculated integer-paise bill totals, immutable price/receipt snapshots, unique numbers, unique submission keys, admin cancellation with reason and reprint activity.
- Bill search/date filters, payment and item reports, CSV export. Bill/request lists currently retrieve the latest 1,000 records; reports describe the loaded/filter-selected records.
- Hotel/manual requests, staff assignment, rates, follow-up dates, notes, statuses and confirmed arrival/departure list. Availability is checked **manually**, not against live inventory.
- Legal enquiry search, staff assignment, private contact notes, service/status counts and follow-up records. No legal document uploads.
- Editable menu, rooms, service descriptions/questions, portal/receipt/hotel settings and staff access. Archive by marking inactive; final bills cannot be silently edited/deleted.

## Printing

Finalise a bill before printing. The receipt opens separately from the app layout; **Print / save PDF** opens the ordinary browser dialog. Select the installed receipt printer and its matching 58/80 mm paper; disable browser headers/footers and check scaling/margins. For PDF, choose Save as PDF.

Reprints retain the original bill number/prices, are marked COPY and do not create another sale. Opening the dialog logs an attempt, not physical paper confirmation. Cancelling the dialog leaves the saved bill intact. Paper cutting/driver behaviour depends on hardware. Actual thermal-printer acceptance is still required on the client's printer; no printer has been connected during development. There is no direct/silent printing bridge.

## Configuration before launch

The included menu, room types, prices, legal descriptions and branding are **sample content**, not client-approved operating information. Replace them in the owner workspace. Room illustrations are labelled; add client-provided HTTPS photo URLs under Room types. Provide hotel/business contacts, policies, approved taxes/charges and receipt registration details. Path Lab is already mounted at `/pathlab/`.

For the combined Vercel release, use the repository-root build and `../docs/UNIFIED-DEPLOYMENT.md`. Production uses a dedicated external MongoDB for Hub and HTTPS; credentials go in Vercel's environment settings. Sessions use secure cookies in production. HTTPS is not enabled on the local development URL.

```powershell
cd D:\Pathlab
npm run build
```

No deployment has been published and no existing site audience has changed.

## Validation

```powershell
npm test
npm run build
```

The automated workflow suite starts its own isolated MongoDB and checks public/staff isolation, login, role permissions, cross-origin rejection, server-side bill calculations, duplicate-safe billing, immutable prices, reprint/cancellation rules, booking dates/capacity, enquiry-specific questions, honeypot, draft persistence and session invalidation. Browser checks also cover owner login, actual bill/receipt creation, hotel acknowledgement and service-specific legal enquiries.

## Delivery boundary

No online payments, notifications, offline billing, live room inventory, legal uploads, kitchen/inventory management or post-delivery warranty/support are included. Any subsequent work is subject to a separate agreement. Physical printer testing and production domain/MongoDB setup remain client-environment tasks.
