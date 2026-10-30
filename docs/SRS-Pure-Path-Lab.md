# Software Requirements Specification (SRS) — Pure Path Lab
**Product:** Pure Path Lab — Laboratory Management System (Single Lab)
**Stack:** React (Vite) Frontend + Express.js REST API Backend + MongoDB
**Version:** 2.0 | **Date:** 03 October 2026 (proper hybrid format; no scope or commercial changes)
**Prepared by:** KSpark Digital Services (legal name: Kalpana Singh) • GSTIN 09HULPS0015P1ZY

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Tech Stack & Architecture](#3-tech-stack--architecture)
4. [User Roles](#4-user-roles)
5. [Functional Requirements](#5-functional-requirements)
6. [Patient Portal (OTP Login)](#6-patient-portal-otp-login)
7. [Notifications — SMS / Email](#7-notifications--sms--email)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Deployment & Hosting](#9-deployment--hosting)
10. [Commercials](#10-commercials)
11. [Recurring / Third-Party Costs](#11-recurring--third-party-costs)
12. [Out of Scope](#12-out-of-scope)
13. [Assumptions](#13-assumptions)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Client Dependencies](#15-client-dependencies)
16. [Delivery Risks](#16-delivery-risks)
Annexure A. [Commercial & Billing Terms](#annexure-a-commercial--billing-terms)
Appendix B. [Data Entities (As-Built)](#appendix-b-data-entities-as-built)
Appendix C. [API Route Inventory (As-Built)](#appendix-c-api-route-inventory-as-built)
[Approval & Sign-off](#approval--sign-off)

---

## 1. Introduction

### 1.1 Purpose
This SRS defines what will be built, delivered, and charged for the **Pure Path Lab** project — a single-lab pathology + basic radiology (USG / X-ray) management system covering patient registration, billing, report entry → verification → print/PDF, QR verification, barcode labels, business accounts, and patient report access via Mobile + OTP.

### 1.2 Scope
- **In-scope:** Everything in §5–§7 as implemented in the current codebase (`frontend/` React + `backend/src/` Express + MongoDB models), finished to a production-usable state and deployed per §9.
- **Single lab only.** No SaaS/multi-tenancy, no subscriptions/trials/paywalls, no multi-branch (existing branch/modality scaffolding stays minimal/as-is).
- **Out-of-scope:** §12.

### 1.3 Definitions
- **Case / Bill:** One billing event; auto-generates linked lab report(s).
- **TAT:** Turnaround Time in hours (`tatHours`).
- **Verify/Sign:** Pathologist sign-off that finalises a report.
- **WABA:** WhatsApp Business Account — excluded from this phase.

### 1.4 Intended audience

| Audience | Uses this SRS for |
|---|---|
| Lab owner (client) | Scope acceptance (§5–§8), acceptance sign-off (§14), commercials (Annexure A), inputs (§15) |
| Build team | Implementation baseline: requirements, architecture, and acceptance criteria |
| UAT sign-off authority | Verifying each acceptance check in §14 against the delivered build |

### 1.5 Document conventions
- **SHALL** denotes a binding requirement on the delivered build.
- Items marked **‘to be completed’** are delivered within the fixed-price build; items marked **‘as-is / minimal’** are retained in their current working state with no further build-out.
- Cross-references: **§** = section, **FR** = functional requirement, **NFR** = non-functional requirement, **A** = acceptance check; `code font` denotes routes, models, and paths.
- Amounts are in Indian rupees (₹); commercial terms are consolidated in **Annexure A** and referenced from the body.

---

## 2. Overall Description

### 2.1 Product Perspective
Full-stack web app: Vite React SPA served as static build + Express REST API (`/api/*`) on serverless/hosted Node, MongoDB Atlas for data, file uploads for images/signatures/report files, PDF generation (pdfkit) + QR (qrcode) for report verification.

### 2.2 Operating Environment
- Desktop-first responsive web app (mobile usable; patient portal mobile-friendly).
- Online-only. Printing on Laser/Inkjet (A4) plus configurable sticker stock.
- Browsers: latest Chrome/Edge/Firefox.

---

## 3. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Axios, Vite build (`frontend/`) |
| Backend | Node + Express 4, JWT auth, bcryptjs, multer uploads, pdfkit, qrcode (`backend/src/`, `api/index.js` serverless entry) |
| Database | MongoDB (Mongoose 8) — **Atlas Free tier (M0)** at launch |
| Hosting | **Vercel** (frontend static + API rewrites per `vercel.json`) — cost separate, §9 |
| Auth | JWT (staff), Mobile + OTP sessions (patients, `OtpSession`) |
| Integrations | MSG91 OTP/SMS (client-funded), Email via SMTP / generic send API, WhatsApp channel excluded |

**Key backend routes (as-built):** `auth, users, patients, bills, reports, tests, usg, xray, modalities, doctors, doctor-portal, appointments, transactions, expenses, dashboard, analysis, export, notify, public/patient-portal, signatures, settings/setup, support/tickets, jobs, audit-log, branch, inquiry` (full inventory: Appendix C).

**Key data entities:** `Patient, Bill, BillItem, Report, Test, TestCategory, TestPanel, TestPackage, Interpretation, USGCase, XrayCase, ModalityCase, Doctor, Agent, Transaction, Expense, LabProfile, Signature, TatConfig, NotificationTemplate, DeliveryAttempt, OtpSession, SmsCredit, User, SupportTicket, Activity/Job` (full inventory: Appendix B).

---

## 4. User Roles

| Role | Access |
|---|---|
| Superadmin / Admin | Everything: settings, lab profile, users/roles, rates, accounts, verification |
| Pathologist (`canSign`) | Verify/sign/reject reports, signatures |
| Technician / Lab staff | Registration, billing, sample collection, result entry, image upload, print |
| Radiologist / USG / X-ray staff | Modality cases, image upload, findings, sign-off |
| Accountant / Cashier | Billing, collect/due/void, cashbook, expenses |
| Patient (no staff login) | Mobile + OTP → view/download own reports, bills |

Permissions enforced via `User.permissions` map + role checks (frontend permission matrix + backend middleware).

---

## 5. Functional Requirements

### FR-1 Staff Auth & Employee Management
- Login (email/password), Google/Facebook OAuth hooks (IDs configurable), JWT sessions, rate-limited login.
- Employee CRUD (`/api/users`), roles, departments, designation/joining fields, activate/deactivate, reset password.
- Role/permission matrix UI; session list/revoke (to be completed).

### FR-2 Patient Management
- Registration (demographics, contact, referral doctor/agent), search, patient-wise case/bill/report history.

### FR-3 Billing & Cases
- New bill with test/panel/package picker (search/autocomplete), rates, discounts, payment status (paid/partial/pending/due), invoice numbers.
- Collect payment (full/partial, payment modes), due list, void-with-reason, bill barcode (SVG), print invoice.
- Cashbook (`GET /api/bills/cashbook`) with filters + date-range summary; expenses module.

### FR-4 Lab Tests Master
- Test database: code/name/department/rate, normal ranges (`normalLow/High`, critical limits, age/sex applicability, unit, method), `tatHours`, derived-test flag + formula, interpretations.
- Categories, panels, packages; bulk rate revision (single-rate update exists; bulk flow to be completed).

### FR-5 Report Lifecycle (Pathology)
- Auto-generate reports from bills; Today's / Due / Pending worklist with search, department filter, TAT countdown/badges (2h/4h due-soon), result entry with range flags (HIGH/LOW/CRITICAL).
- Pathologist verify flow: sign (`POST /api/reports/:id/sign`), verify/reject-with-reason/request-changes + comments (outstanding endpoints delivered within the build), unsigned list, `/lab/verify` screen.
- PDF/print preview (same template for preview + print), QR code (`qrDataUrl` + `verificationUrl`, public verify route `/r/:token`), branded letterhead (lab profile: name, address, phones, registration no., disclaimer, timings).
- Barcode stickers + sample/case labels (bill barcode live; case/sample endpoints + sticker sheet to be completed).

### FR-6 Radiology (USG / X-ray)
- USG cases + my-cases, X-ray cases + my-cases: create, findings entry, image upload (drag-drop, progress/retry), print-preview, sign-off.
- Images stored via upload endpoints (`POST /api/usg|cases/:id/images`, `/api/xray/...`); delete-image + image-in-PDF to be completed.

### FR-7 Signatures
- Signature CRUD + department assignment (`/api/signatures`); signature manager UI + auto-pick by department at sign time; render in PDF.

### FR-8 TAT
- Per-report `tatHours`, per-test `tatHours`, default + emergency/urgent TAT config screen (to be completed); due/overdue highlighting; lab-local-time convention.

### FR-9 Business & Analytics
- Accounts/ledger, due reports, department filter, referral/agent tracking, daily business grid, test-usage analytics, data export (JSON live; CSV + history to be completed).

### FR-10 Referral Doctors, Agents, Settings
- Doctor master, referral linkage; agent/collector tracking; lab-profile setup, registration-number config (prefix/format — `PPL-` default), branding/white-labelling, notification templates (SMS screen live).

### FR-11 Doctor Portal / Online Booking / Support (minimal, as-is)
- Existing minimal doctor portal + appointments/booking + support ticketing (`/api/tickets`) retained; no slot-availability engine, no advanced portal build-out.

### FR-12 Audit / Jobs
- Activity/audit log viewer (to be completed once capture middleware lands); failed-job/retry dashboard for notification sends (to be completed).

---

## 6. Patient Portal (OTP Login)

```
Mobile Number → OTP (MSG91) → Verify → Report list → View / Download PDF
```
- No patient password. OTP expiry (default 5 min) + max attempts (default 3), rate-limited resend.
- Public bill/report verification via token URLs + QR scan.
- OTP sessions are modelled in `OtpSession`; development and testing proceed on test credentials pending live MSG91 and DLT cutover.

---

## 7. Notifications — SMS / Email

- Generic send API (`POST /api/notify/send`) + per-report send modal (patient/doctors/cc/bcc), single + bulk, template-driven SMS / Email.
- Delivery status (Sent/Failed/Retry) + per-report history (to be completed).
- **OTP/SMS provider: MSG91** — wallet recharge and API key are client-provided; Sender ID and DLT template are wired by the build. See Annexure A.4.
- **WhatsApp channel: excluded** from this phase (no WABA work). The `whatsappReportsEnabled` toggle remains disabled by default; WhatsApp messaging may be taken up as a Phase-2 enhancement.

---

## 8. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Responsive UI; usable on 1366px desktop + mobile patient portal |
| NFR-2 | JWT-secured APIs; role checks server-side; no passwords exposed; rate limits on auth/OTP |
| NFR-3 | Preview layout == print/PDF layout (single template); QR survives PDF render |
| NFR-4 | Idempotent verify/sign (double-click safe); failed sends never show false-success |
| NFR-5 | Time handling in lab-local timezone consistently |
| NFR-6 | Basic SEO + Lighthouse snapshot hygiene for public pages |

---

## 9. Deployment & Hosting

**Excluded from the fixed build price (Annexure A)** — paid by the client at actuals:

| Item | Plan |
|---|---|
| Hosting | **Vercel** — deployed from this repo (`vercel.json`: Vite build → `frontend/dist`, `/api/*` → serverless). The application is deployed to accounts owned by the client; any Pro usage/bandwidth/function overages are client-borne |
| Database | **MongoDB Atlas Free (M0)** at launch. Storage/RAM/backup limits accepted; upgrades are client-borne |
| Domain | **New registration (lump sum, client-borne)** — the domain is owned by the client; DNS connection to Vercel with sender setup is included |
| TLS | Via Vercel (included with platform) |
| Backups/Uploads | DB backups per Atlas tier; uploaded images/files per host storage — persistent-storage upgrades if needed are extra |

---

## 10. Commercials

The fixed-price build, milestone schedule, billing entity, and payment terms are defined in **Annexure A**. The technical scope they cover is §5–§8.

---

## 11. Recurring / Third-Party Costs

Hosting, domain, messaging, and other recurring or third-party costs are excluded from the build price and itemised in **Annexure A.4**. Deployment responsibilities are defined in §9.

---

## 12. Out of Scope
Multi-branch/SaaS tenancy, subscriptions/paywalls, inventory & stock, HR/payroll, instrument interfacing (HL7/ASTM), phlebotomist mobile app, native Android/iOS apps, advanced analytics/BI, payment-gateway collection, regional-language report templates (English-only scope), WhatsApp / WABA channel.

---

## 13. Assumptions
1. Single lab, single brand/letterhead; one Vercel project + one Atlas cluster, both held in the client's name.
2. The client provides: lab profile artwork and content, test masters/rates, doctor/agent lists, MSG91 wallet + API key (~1,000 OTPs/month), and SMTP access. DLT registration and Sender ID approval are pending client action; live SMS/OTP deployment is subject to their completion (§16).
3. Domain: new registration, client-borne (name to be finalised).
4. Migration source is Labsmart (`labsmartlis.com`) exports — scope = one-shot masters import (tests/rates/doctors) included; full history migration estimated separately after export review (§16).
5. Staff list and signatories to be confirmed prior to UAT (interim provision: up to 10 logins, 1–2 signatories); printing on A4 with configurable sticker sizes.
6. English-only reports. Free-tier limits (Vercel/Atlas) accepted at launch; upgrades are client-borne.
7. 30-day defect-fix window post go-live (agreed). UAT in a maximum of two consolidated rounds; delays in client inputs extend timelines accordingly.

---

## 14. Acceptance Criteria

### 14.1 Sign-off checklist

- [ ] **A1** — Staff login → register patient → bill → enter results → sign → print/PDF with QR + letterhead works end-to-end.
- [ ] **A2** — Patient Mobile+OTP login → report list → view/download works (live MSG91 credits).
- [ ] **A3** — Billing: collect/partial/due/void + cashbook totals reconcile for a test date range.
- [ ] **A4** — USG + X-ray: create case → upload image → preview → sign works.
- [ ] **A5** — Barcode (bill) + QR-scan verification works; sticker/label sheet per agreed stock size.
- [ ] **A6** — Deployed on client's Vercel + Atlas Free + domain connected; admin handover + training done.

### 14.2 Requirement traceability

| Requirement | Verified by | Notes |
|---|---|---|
| FR-1 | A1, A6 | Logins, roles; handover |
| FR-2 | A1 | Covered in end-to-end flow |
| FR-3 | A1, A3 | Billing flow + reconciliation |
| FR-4 | A1 | Ranges and rates in entered results |
| FR-5 | A1, A5, A6 | Lifecycle, codes/labels, handover |
| FR-6 | A4 | Modality flow |
| FR-7 | A1 | Signature on printed report |
| FR-8 | A1 | TAT behaviour in worklist |
| FR-9 | A3 | Accounts reconciliation |
| FR-10 | A1 | Doctors, numbering, branding on reports |
| FR-11 | A6 | Retained as-is; verified at handover |
| FR-12 | A6 | Viewers verified at handover |
| §6 (patient portal) | A2 | OTP flow on live credits |
| §7 (notifications) | A1, A2 | Send + delivery status |

---

## 15. Client Dependencies

The following inputs are required from the client; each gates the deliverable shown. Commercial positions agreed on 03 October 2026 are recorded in **Annexure A.6**.

| # | Input | Dependent deliverable |
|---|---|---|
| 1 | Lab identity: name, address, phones, reg. no., timings, disclaimer/footer + logo file | Letterhead / PDF / QR page |
| 2 | Two to three preferred domain names | Registration + go-live URLs |
| 3 | Labsmart CSV exports (tests/rates, doctors, patients, bills) + 2–3 sample report PDFs | Master import, migration estimate, template alignment |
| 4 | DLT registration started; Sender ID + template on approval | Live SMS / OTP |
| 5 | MSG91 account + starter recharge + API key | OTP wiring |
| 6 | Staff list + pathologist name(s) / title(s) / signature images | Logins + UAT + sign-off |
| 7 | Acceptance of the payment schedule (or an agreed alternative) | Work commencement / billing |

*Requirements outside §5 shall be handled under change control and estimated separately.*

---

## 16. Delivery Risks

| Risk | Mitigation |
|---|---|
| DLT dependency | Development proceeds on MSG91 test credentials; cutover to the approved Sender ID upon DLT completion; OTP login validated with test credentials in the interim |
| Labsmart export windows (bills ~31 days, patients ~365 days) | Masters imported first; full history estimated only after review of actual CSVs; multi-batch exports where required |
| Free-tier limits (Vercel / Atlas) | Accepted at launch; monitor usage; upgrade path and cost owned by client |
| Content delays (logo, disclaimer, rates) | Interim branding placeholders in the initial build; content frozen before the second UAT round |

---

## Annexure A — Commercial & Billing Terms

This annexure consolidates all commercial terms and forms part of the agreement. The technical scope it prices is §5–§8.

### A.1 Fixed build price

**Total fixed build cost: ₹60,000 (fixed price).** Covers design, development, integration wiring, QA, deployment to the client's Vercel + Atlas Free, and handover / training for §5–§7.

| # | Head | Amount (₹) | Covers |
|---|---|---|---|
| 1 | **Backend team** | **25,000** | REST APIs, auth/JWT + OTP sessions, billing/accounts logic, report lifecycle + sign/verify, USG/X-ray cases, upload + PDF/QR/barcode generation, notify-service + MSG91 wiring, roles/permissions, seed + test fixes |
| 2 | **Frontend team** | **25,000** | All screens/flows (registration, billing, worklists, result entry, verify, print preview, labels/stickers, cashbook/accounts, employees, settings/branding, patient + doctor portals), responsive polish, template–print parity |
| 3 | **Other (QA, integration & handover)** | **10,000** | End-to-end testing + bug-fix pass, MSG91/Email wiring, Vercel + Atlas + domain connect, data import of masters (tests/rates/doctors, one shot), user training (1 session) + handover docs |
| | **Total** | **60,000** | |

The fixed price does **not** include recurring / third-party costs (A.4) or out-of-scope items (§12). Extra requests are separately estimated.

### A.2 Milestone schedule & payment terms

| Milestone | Trigger | Amount (₹) |
|---|---|---|
| M1 — Advance | SRS sign-off and commencement of work | 24,000 (40%) |
| M2 — UAT build | Feature-complete build delivered for user acceptance testing | 24,000 (40%) |
| M3 — Go-live | Production deployment, acceptance checklist (§14) completed, training delivered | 12,000 (20%) |
| | **Total (fixed)** | **60,000** |

- Milestone invoices fall due within **7 days** of issue; subsequent phases commence on receipt of prior milestone dues.
- UAT feedback is consolidated in a maximum of two rounds within 14 days of the UAT build; a milestone is deemed accepted if no defect list against this SRS is received in that window.
- Work outside §5 requires prior written approval with a separate estimate under change control.
- Third-party charges (hosting, domain, OTP/SMS, email delivery) are billed at actuals against client-owned accounts (A.4) and form no part of the build price.
- Commercial validity: 30 days from 03 October 2026.

### A.3 Billing entity

| Field | Detail |
|---|---|
| Billing entity | **KSpark Digital Services** (legal name: Kalpana Singh) |
| GSTIN | 09HULPS0015P1ZY |
| Price basis | Fixed-price build of ₹60,000 (A.1); tax treatment as recorded in A.6 |

### A.4 Recurring / third-party costs (not included)

| Item | Borne by | Notes (Oct 2026) |
|---|---|---|
| Vercel hosting / overages | Client (separate) | Deployment included; platform charges, if any, are client-borne |
| MongoDB Atlas beyond Free | Client (separate) | Free M0 now; upgrade if limits hit |
| Domain (lump sum) | Client (separate) | Registration + yearly renewal; client owns it |
| **OTP/SMS — MSG91** | Client (separate, pay-as-you-go) | Per [msg91.com/in/pricing/otp](https://msg91.com/in/pricing/otp): starter packs e.g. **5,000 OTPs @ ~₹0.25/OTP (~₹1,250 + 18% GST)**; ~₹0.22 @ 15k, ~₹0.20 @ 27k, down to **~₹0.18 @ high volume** (all + GST). At ~1,000 OTPs/month the starter pack covers roughly five months. Wallet recharge and API key are client-provided |
| DLT registration / Sender ID (SMS India) | Client (separate) | Regulatory; registration is client action, approved template/ID wired by the build |
| **WhatsApp** | Excluded | Excluded from this phase; may be taken up as a Phase-2 enhancement |
| Email delivery (SMTP/provider) | Client (separate) | Client SMTP or provider account |
| Design / migration beyond one-shot masters | Extra | Estimated separately |

### A.5 Support billing (AMC)
AMC Basic of ₹24,000 per annum is billed at **₹2,000 per month in advance**, effective after the 30-day defect-fix window. **Includes:** defect fixes against this SRS, platform and dependency upkeep, MSG91 re-configuration, and break-fix support. **Excludes:** new features or modules, third-party charges, and data entry or migration. Termination on 30 days' notice, with dues cleared up to the effective date of termination.

### A.6 Record of agreed terms (03 October 2026)

| Item | Agreed position | Implication |
|---|---|---|
| Domain | New registration | Two to three candidate names to be shortlisted; registration and renewal are client-borne; DNS connection included |
| Vercel + Atlas ownership | Client-owned accounts | Deployment included; platform overages, if any, are client-borne |
| MSG91 OTP volume | Approx. 1,000/month | 5,000-OTP starter pack (~₹1,250 + GST) covers roughly five months; wallet recharge and API key are client-provided |
| DLT + Sender ID | Pending (client action) | Live SMS/OTP deployment is subject to DLT completion; development proceeds on test credentials in parallel |
| WhatsApp | Excluded | Excluded from this phase; no associated cost or timeline |
| Language | English only | Single-language report scope |
| Staff/signatories | To be confirmed | Interim provision: up to 10 logins with 1–2 signatories; confirmation required before UAT |
| Migration | Labsmart exports | Masters import included; full history migration estimated separately after CSV review |
| Tax treatment | Not applicable | ₹60,000 fixed price |
| Milestones 40/40/20 | For acceptance | Proposed 24k / 24k / 12k schedule, subject to acceptance |
| Printers | A4 + custom sticker stock | Reports on A4; configurable label layouts subject to stock approval |
| Defect-fix window | 30 days post go-live | Defect fixes against this SRS for 30 days following go-live |

---

## Appendix B — Data Entities (As-Built)

Mongoose models in `backend/src/models`. Supporting entities are retained minimal under the single-lab scope.

| Entity | Records |
|---|---|
| Activity | Audit trail events (viewer FR-12) |
| Agent | Sample-collection agents / collectors |
| Bill | Billing events and invoices |
| BillItem | Per-test line items of a bill |
| Branch | Branch scaffolding (minimal, single-lab scope) |
| DeliveryAttempt | Notification send attempts and outcomes |
| Doctor | Referral doctor master |
| DoctorInvite | Doctor onboarding invites (minimal) |
| Expense | Laboratory expenses |
| Inquiry | Enquiries (minimal) |
| Interpretation | Test interpretations |
| Job | Background jobs and retry state |
| LabProfile | Laboratory profile, letterhead, branding |
| ModalityCase | Generic modality cases |
| NotificationTemplate | SMS / notification templates |
| OnboardingProgress | Onboarding checklist state (minimal) |
| OtpSession | Patient OTP sessions |
| Patient | Patient master records |
| Report | Diagnostic reports and lifecycle state |
| ReviewRequest | Review requests (minimal) |
| Signature | Signatory signatures and department assignment |
| SmsCredit | SMS credit tracking |
| Subscription | Subscription scaffolding (out of scope, minimal) |
| SupportTicket | Support tickets |
| TatConfig | Turnaround-time configuration |
| Test | Test master with ranges, rates, TAT |
| TestCategory | Test categories |
| TestPackage | Health packages |
| TestPanel | Test panels |
| Transaction | Payments and ledger transactions |
| User | Staff users, roles, permissions |
| USGCase | Ultrasonography cases |
| WebBrowser | Browser allow-list (minimal) |
| XrayCase | X-ray cases |

---

## Appendix C — API Route Inventory (As-Built)

Express routers in `backend/src/routes`; handler-level contract per controller.

| Router | Serves |
|---|---|
| authRoutes | Staff authentication and sessions |
| userRoutes | Employee management and roles |
| patientRoutes | Patient registration and history |
| billRoutes | Billing, collection, cashbook |
| reportRoutes | Reports, verification, print payloads |
| testRoutes | Test master, categories, panels, packages |
| usgRoutes | USG cases, images, sign-off |
| xrayRoutes | X-ray cases, images, sign-off |
| modalityRoutes | Generic modality cases |
| doctorRoutes | Referral doctor master |
| doctorPortalRoutes | Doctor portal and appointments |
| transactionRoutes | Ledger transactions |
| expenseRoutes | Expense entries |
| dashboardRoutes | Dashboard aggregates |
| analysisRoutes | Business analytics |
| exportRoutes | Dataset exports |
| notifyRoutes | SMS / email dispatch |
| publicRoutes | Public verification and barcodes |
| patientPortalRoutes | Patient OTP sessions and report access |
| settingsRoutes | Application settings |
| setupRoutes | Laboratory profile setup |
| supportRoutes | Support tickets |
| jobRoutes | Background jobs |
| auditLogRoutes | Activity / audit log |
| branchRoutes | Branches (minimal) |
| inquiryRoutes | Enquiries |

---

## Approval & Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Prepared by (build team) | | | |
| Reviewed by (lab owner) | | | |
| Approved by (sign-off authority) | | | |

**Client**

Name: ______________________

Signature / Date: ______________________

**KSpark Digital Services**

Name: ______________________

Signature / Date: ______________________

---

*End of SRS v2.0 — Pure Path Lab (₹60,000 fixed-price build, Annexure A; billing entity KSpark Digital Services, GSTIN 09HULPS0015P1ZY; 30-day defect-fix window; AMC Basic ₹2,000/month).*
