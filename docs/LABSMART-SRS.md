# Software Requirements Specification (SRS) — Labsmart LIS
**Target audited:** `https://app.labsmartlis.com/73136222` (tenant 73136222) + `https://www.labsmartlis.com/`
**Audit date:** 2026-09-16 (UTC)
**Audit mode:** Black-box + authenticated (trial owner account) + public marketing docs
**Author:** Automated audit via Chromium DevTools + WebFetch
**Version:** 1.0

> This SRS is reverse-engineered from live behaviour. No source code was accessed. Wording like “shall” describes observed / marketed behaviour that a clone/re-implementation must reproduce.

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Architecture (Observed)](#3-system-architecture-observed)
4. [User Classes & Roles](#4-user-classes--roles)
5. [Functional Requirements](#5-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [External Interface Requirements](#7-external-interface-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Business Rules](#9-business-rules)
10. [Plans, Limits & Commercial Rules](#10-plans-limits--commercial-rules)
11. [Use-Case Catalog](#11-use-case-catalog)
12. [Traceability: URL → Feature](#12-traceability-url--feature)
13. [Out-of-Scope / Assumptions / Gaps](#13-out-of-scope--assumptions--gaps)
14. [Acceptance Criteria (Suggested)](#14-acceptance-criteria-suggested)
15. [Appendix A: Audit Evidence](#appendix-a-audit-evidence)

---

## 1. Introduction

### 1.1 Purpose
Define functional and non-functional requirements for a Laboratory Information Management System (LIMS/LIS) equivalent to Labsmart, covering pathology + radiology (USG / Digital X-ray / CT / MRI / ECG / X-ray) for small-to-medium diagnostic labs in India (with international support).

### 1.2 Scope
In-scope (verified live):
- Multi-tenant SaaS at `app.labsmartlis.com/{tenantId}` e.g. `/73136222`.
- Auth: password + Email OTP + SMS OTP (India-only), forgot-password via OTP, unlock flow.
- Patient registration & multi-modality billing.
- Lab reporting lifecycle with QR, barcode, TAT, E-sign, PDF.
- Radiology templated reporting.
- Test master (database / categories / panels / packages / interpretations).
- Online delivery (WhatsApp / SMS / Email + QR self-service).
- Daily business accounting, expenses, referral/case-wise analysis, business analysis, data export (CSV).
- Employee logins + role permissions + activity tracking + browser security + doctor portal.
- Onboarding checklist, help/support ticketing, demo videos.
- Commercial: 5-day trial, Basic/Advanced/Premium + Radiology/Diagnostic variants, add-ons, SMS credits, fair-use bill caps.

Out-of-scope for this SRS: inventory, phlebotomist mobile app internals, instrument interfacing (HL7/ASTM) — not observed; do not assume.

### 1.3 Definitions
- **Case / Bill:** One billing event; generates linked lab/radiology reports automatically.
- **TAT:** Turnaround Time — Registered on / Collected on / Received on / Reported on.
- **DCN/CC:** Collection centre codes shown in daily business grid (observed column headers `DCN CC`).
- **Cashier:** Staff user flagged for billing; used for cashier-wise tracking.
- **Referrer:** Referral doctor; **Agent/Collector:** sample collection agent.
- **Report states:** New → In progress → Final → Signed off (+ Printed flag, Balance-due flag).

### 1.4 References
- Live app: `/labsmart_sessions/new`, `/email_authentication/login_form`, `/sms_authentication/enter_info_form`, `/reset_password/enter_info`, `/users/unlock/new`, `/73136222`, `/73136222/cases/new`, `/73136222/lab_tests`, `/73136222/business_reports/daily_business`, `/73136222/lab_reports/today`, `/73136222/users`, `/73136222/getting_started`, `/73136222/data_exports/new`.
- Marketing: `/`, `/features/*`, `/whatsapp-sms-email-lab-report`, `/pricing`.

---

## 2. Overall Description

### 2.1 Product Perspective
Cloud SaaS LIMS. Single codebase, tenant-isolated by `{tenantId}` in URL. Marketing site (`www.labsmartlis.com`) handles signup/trial; app subdomain handles operations. No offline mode marketed (MS-Word templates offered for emergencies only).

Observed scale claims: 2,500+ labs, 2 Cr+ reports, 600+ Google reviews @ 4.9, 7+ years.

### 2.2 Major Functions (Summary)
1. Authenticate & manage sessions/devices.
2. Onboard lab in ~5 min (centre, letterhead, rates, normals, users).
3. Register patients, create multi-modality bills, collect payments.
4. Auto-generate reports from bills; enter results; auto-calc; sign; print PDF.
5. Deliver via WhatsApp/SMS/Email/QR.
6. Track business daily, expenses, dues, referrals, analytics, exports.
7. Secure via RBAC, activity logs, browser allow-listing, fraud-proofing.
8. Grow via review builder, SMS campaigns, doctor portal.

### 2.3 Operating Environment
- Browser web app, responsive; works on desktop + mobile (home-collection registration explicitly mobile-capable).
- Printers: Laser / Inkjet / Thermal; sizes A4 / A5 / 3-inch thermal.
- Network: online-only; QR download requires internet.
- SMS via transactional route (DND-safe, late-night delivery).

### 2.4 Constraints
- SMS OTP login: Indian mobiles only (`+91` prefix enforced).
- Courtesy limit: `200 patients/day` shown on New Bill.
- Fair use: 12,000 bills/yr (Basic/Advanced), 20,000 (Premium Diagnostic); early renewal if exceeded.
- Support hours: Mon–Fri 10:30–17:30 (ticket + phone + Google Meet screen-share).
- Data export windows enforced (e.g. Bills 31d, Patients 365d) — see §5.14.

---

## 3. System Architecture (Observed)

- Frontend: Server-rendered Rails + Hotwired Turbo (`turbo.min`), importmap modules `ls_software`, `ls_admin`, AlpineJS 3.10.2 CDN.
- Assets CDN: `dm17eaunn1yq1.cloudfront.net`, images `dvudfhlp1pttz.cloudfront.net` / `website.cdn.labsmartlis.com` / `imagedelivery.net`.
- Auth: Devise (`devise-*.js`, `csrf-token` meta). Routes: `labsmart_sessions`, `users/sign_in`, `email_authentication`, `sms_authentication`, `reset_password`, `users/unlock`.
- Tenant scoping: all ops under `/{tenantId}/...` (e.g. `73136222`).
- Video help: YouTube embed `wCY2A8z86Dk` (“Labsmart Basics”).
- Social/support: WhatsApp `wa.me` links (9318313723, 8439285623, 9161479000, 9220622692, 8766367100), YouTube/FB/Instagram/LinkedIn.

---

## 4. User Classes & Roles

| Role | Access (observed) | Notes |
|------|-------------------|-------|
| Account Owner | Full; manages employees, permissions, rates, normals, business analysis, data export | Single owner row in `/users` (e.g. Pratyush Mishra) |
| Receptionist | Register patients, create bills, view daily business; cannot edit rate-list/reports | Example role from permissions docs |
| Lab Technician | Enter results, view assigned cases; no financial data | |
| Accountant | Revenue/reports, billing data | |
| Manager/Admin | Daily ops, performance | Limited sensitive settings |
| Referral Doctor (Portal) | Real-time view of referred cases via Doctor Access invite | Premium feature |
| Patient (unauthenticated via QR/link) | Check status, download PDF via Bill QR / Report QR / WhatsApp/SMS/Email link | No login required |
| Support / RM | Demo/setup/support via ticket + Meet (e.g. Mr. Ashu Pandey, MSc MLT) | |

---

## 5. Functional Requirements

### FR-AUTH — Authentication & Session

**FR-AUTH-1 Login (password):**
- Fields: `Email / Mobile number` (required, autofocus), `Password` (required, show/hide eye toggle), `Remember me` checkbox, `Log in` primary button.
- Shall authenticate tenant user and land on `/{tenantId}` Dashboard.
- Shall show “You need to sign in or sign up before continuing.” if unauthenticated access attempted.
- Branding: “Labsmart — Effortless Laboratory Management”, Instagram QR card (`@LABSMARTLIS`), footer: “Speak to an expert 9318313723 (WhatsApp), Mon–Fri 11am–5pm”, social icons.

**FR-AUTH-2 Alternate logins:**
- `Login via Email OTP` → `/email_authentication/login_form`: `Enter your email` + `Send OTP`.
- `Login via SMS OTP` → `/sms_authentication/enter_info_form`: `+91` + `Enter your mobile number` + `Send OTP`; text “Option available only for Indian mobile numbers.”
- `Forgot Password?` → `/reset_password/enter_info`: `Enter email or mobile number (without country code)` + `Send OTP`.
- `Account locked?` → `/users/unlock/new`.
- All shall have `Return to log in` link to `/users/sign_in`.

**FR-AUTH-3 Security:**
- Shall support browser allow-listing (`/web_browsers` “Browser security”, Advanced plan). Dashboard shows `Browser code: 4FF4`.
- Shall support multiple employee logins with per-user block (see FR-MANAGE).
- Password reset/unlock via OTP; session CSRF-protected.

### FR-DASH — Dashboard (`/{tenantId}`)
- Top nav: logo→dashboard, global `Search any bills, reports`, `Help`, notification bell, `Setup`, `Watch Video`.
- Promo strip: “Awesome September Deal: ₹3,100/- + GST for first year | 7 day money back guarantee. Ends in 18h … +91-9161479000”, trial banner “Your trial ends in 5 days. Even if you purchase early, duration … included free. [Change plan] [Buy now]”.
- Intro hint: “Manage entire panels from a single page. Try now Lab > Test Panels”.
- Getting-started video card (YouTube), migration links (MS Word, Offline Software), Employee logins, Browser security, Doctor portal shortcuts.
- Widgets: `Payments due (For all time, View all → /cases/with_due)`, `Recent transactions (For today, View all → /receipts, Empty: “No transactions … Get started by adding a new case [Add new case]”)`, `Recent activities (Advanced plan feature, [Start free trial] to view, Empty: “No recent activities”)`, `SMS Credits: 100`, RM card (name, degree, bio, WhatsApp, hours), social footer, Terms/Privacy/Refund buttons, `Get Support Offline` button.

### FR-ONB — Onboarding / Getting Started (`/getting_started`)
Go-live checklist with % complete (observed 9%) and per-item `Watch video`:
1. Create lab account (done, editable profile).
2. Verify email (`Verify now`).
3. Patient registration & billing (bill print + settings + centre details + case-reg start number).
4. Understand daily business (total-income calc).
5. Edit & print lab reports (print options).
6. Send report online (WhatsApp/SMS/Email).
7. Proofread normal values.
8. Check ratelist & test DB (rates, disable booking, missing tests via support).
9. Check report formats (all needs, support if concerns).
10. Print referral business.
11. How to get help (ticket with photo/video; hours 10:30–17:30 Mon–Fri).

Setup shall include: centre details, case-number start, letterhead upload + margin adjust, doctor/technician signature upload, automated SMS toggles, panels/packages/DB/rate-list/referral pricing, normals proofread, users/permissions, test bill/report/WhatsApp dry-run.

### FR-BILL — Patient Registration & Billing (`/cases/new`, `/cases`)
**FR-BILL-1 Patient details (§1):**
Mobile (`+91` + textbox), Title* (combobox: Mr., Mrs., Smt., Kumari, Shri., Miss., Master, Mohd., Baby, Baby of, Wife of, Mother of, Son of, Daughter of, Ms., Miss./Mrs., Selvi, Sk., PROF, Dr., Child, Md., Mx.), First name*, Last name, Sex* (MALE/FEMALE/OTHER radio-style), Age* (Years + Months + Days boxes), `Online report requested` checkbox, expanders: Email, Address, Aadhaar, Patient history. Smart search by Name/Phone/Case ID; history view; add new case to existing patient.

**FR-BILL-2 Case details (§2):**
- `Referred By*` combobox (default `ID:1, Self`) + `Add New`.
- `Collection centre*` (default `Main`).
- `Sample collection agent` combobox + `Add new / Edit` + `Manage referrers` link.
- Modality tabs (multi-select for billing): LAB, USG, DIGITAL XRAY, XRAY, OUTSOURCE LAB, ECG, CT SCAN, MRI, EPS, OPG, CARDIOLOGY, EEG, MAMMOGRAPHY. Each maps to underlying case type (lab vs `usg_cases` vs `digital_xray_cases` vs `ctscan_cases` vs `outsource_lab_cases` …).
- Investigationsselector: rate-list driven; adding/removing tests auto-adds/removes linked report rows (fully integrated billing↔reporting).
- Mobile home-collection: generate case ID instantly, barcoded bill, mobile-friendly.

**FR-BILL-3 Payment:**
Auto `Total: Rs.`, `Discount:` textbox (default 0) + % toggle link, `Amount received` spinbutton, auto `Balance: Rs.`, `Accept Due` action, `Mode:` (cash/upi/card/insurance), `Remarks`, `Create` + `Settings` (print). Auto date-time + immutable reg-no + staff-link + activity log (tamper-proof).

**FR-BILL-4 Bill artefacts:**
Unique barcode + unique QR per bill; customizable header (logo, name, address); print A4/A5/3-inch thermal; insurance-compliant layout. Bill QR scan → status check → PDF download if ready (no revisit needed).

**FR-BILL-5 Lists:**
`Bills (/cases)`, `Due reports (/cases/with_due)`, `Outsource cases`, `Ct scan cases`, global search. Due amount posts to business on collection day (not billing day).

### FR-PAT — Patients (`/patients`), Referrers, Agents, Transactions
- Patients: CRUD, history, CSV export (365d window, Premium).
- Referral Doctors (`/referrers`): manage, referral-wise business summary (`/referrer_wise_business_report/summary?from_date&to_date`).
- Agents (`/sample_collectors`): add/edit collectors for home collection.
- Transactions (`/receipts`): all payment entries; recent-today widget.

### FR-LAB — Lab Reporting
**FR-LAB-1 Worklists:**
`Today's reports (/lab_reports/today)`: filters `Go to / Stats / Sort Oldest/Recent`, counters All/New/In progress/Final/Signed off/Printed `x/y`, empty state + `[Add new case]` + `Search old reports`. `Search reports (/lab_reports)`: by patient/doctor/investigation/date; flags: balance-due, printed.

**FR-LAB-2 Report content:**
- Header: reg-no barcode + TAT block (Registered/Collected/Received/Reported on).
- Ready DB with units + normals; editable; age/gender-specific normals.
- Types: Single parameter, Multi parameter, Document (e.g. PBS/GBP, Blood Group).
- Categories: Haematology, Biochemistry, Serology & Immunology, Clinical Pathology, Cytology, Microbiology, Endocrinology, Histopathology, Others, Miscellaneous.
- Add: methods, instruments, prefilled interpretations (doctor-consulted), custom notes.
- Print controls: with/without letterhead, margins, font size, spacing, show/hide fields.
- E-sign: technician + doctor signatures auto-printed; valid for sharing.
- QR on report: scan → download original PDF, share.

**FR-LAB-3 Accuracy guards:**
- Abnormal value checker (flags outside range for re-check).
- Template restrictions by gender/age.
- Auto-calculations (see FR-FORM); no manual calc.
- Date-wise management (New/In-progress/Final/Signed/ Printed/Balance).

**FR-LAB-4 Master:**
- `Test database (/lab_tests)`: Order, Name, Test Type, Short Name, Category; Add new, Import; category filter; Edit/View per row (observed 50+ haematology/biochemistry rows: Hb, TLC, DLC, ESR, Platelets, BT/CT, PBS, MP, G6PD, PT/INR, APTT, NLR, HPLC, etc.). Warning: “proofread reference range before printing.”
- `Test categories (/lab_test_categories)`, `Test panels (/lab_test_panels)` (single-page panel manager), `Test packages (/test_packages)` (e.g. Full Body, Pregnancy, Pre-Surgical; billing a package auto-adds tests), `Interpretations (/interpretations)`, `Test counts (/lab_test_counts?date_range)` (daily/monthly volume).

### FR-FORM — Inbuilt Formulas (30+, Basic)
Auto-derive on base-result entry:
- CBC: MCV/MCH/MCHC/NLR/Abs counts, RDW, MPV, etc.
- KFT: BUN, Urea/Creatinine, BUN/Creatinine, eGFR (CKD-EPI) + category.
- LFT: Globulin, A/G, Indirect Bilirubin, SGOT/SGPT.
- Lipid: VLDL, LDL, ratios, non-HDL.
- Others: PT/INR, eAG (from HbA1c), Iron UIBC/%Sat, Urine ACR/PCR.
Shall eliminate manual error, save tech time.

### FR-RAD — Radiology Reporting (Basic + add-ons)
- USG: `Today's cases (/usg_cases/today)`, `Search cases (/usg_cases)`, `Report templates (/usg_templates)`, `Signatures (/usg_signatures)`.
- Digital X-ray: same under `/digital_xray_*`.
- Capabilities: USG + Digital X-ray (+ CT/MRI/ECG/X-ray billing; CT cases list observed); rich-text MS-Word-like editor; copy-paste from Word; HTML templates; create/edit/duplicate; lookup by patient/doctor/investigation.
- Add-ons: USG reporting Rs.4,800/yr (Rs.3,000/half-yr), Digital X-ray same.

### FR-SEND — Online Delivery (Basic)
- 1-click `WhatsApp / SMS / Email` send on Final/Signed report; QR fallback on bill.
- Emergency / non-working-hours sharing from mobile; owner/pathologist review anywhere.
- Automated SMS: Welcome (lab name + phone), Bill (reg-no, paid/total/balance), Report-ready; opt-in toggles; transactional route; cost `20p/credit`, packs Rs.200–1,000; observed balance 100 credits.
- Email + WhatsApp link delivery; cloud PDF links.

### FR-BUS — Daily Business (`/business_reports/daily_business`)
- Header: `Business Report + Monthly Overview (BETA) + Print + Email + Today` + datetime stamp.
- KPIs: Total Income, Total collection charge (+ “How collection charges work?”), Expenses, Net income; formula `Total Income + Collection Charges – Expenses = Net Income` (example 1000+500–300=1200).
- Split: Cash/Card/UPI/Insurance.
- Sections: Transactions (count + grid: ID/RegNo/Patient/Referred/Date/Time/DCN/CC/Amount/Method/ReceivedBy), Total Bills (count + income), Expenses (count), Previous-day bills.
- Dimensions: case-wise (Lab/USG/X-ray…), cashier-wise (add cashier, restrict billing access, performance compare).
- Search by Patient / RegNo / Referrer; date picker for history; no registers needed.

### FR-EXP — Expenses (`/expenses`, Premium)
Custom categories (Salary, Stationery, Cleaning, Maid, Electricity, Maintenance, Courier, Machine service…); daily entry; auto net-income; history; budget control.

### FR-REF — Referral / Case-wise / Analysis
- `Referral business (/referrer_wise_business_report/summary)`: date-range, print.
- `Case wise report (/case_wise_business_report/new)`.
- `Business analysis (/business_analysis/monthly_business_overview)` (Premium): Total Cases/Billing/Income by range, daily workload graph, test-count analysis, case-type income split. Owner-only.

### FR-EXPORT — Data Export (`/data_exports/new`, Premium add-on)
1-click CSV (Excel-ready, share via Email/WhatsApp):
- Bills/Cases (31d), Patients (365d), Transactions (31d), TAT (31d), Expenses (365d), Report PDF links (31d).
Uses: SMS campaigns, recall, accountant share, backup, growth analysis. Unsubscribed shows upsell: “Add Data export … Rs.1,299 +18% GST /12mo [Add to trial]”.

### FR-MANAGE — Manage
- `Employee login (/users)`: tabs New/Existing, Active/Blocked counts (obs. 1/0), table S.No/Name/Mobile/Status/Email/Status/RegOn/Permissions/Actions; owner row full control; add/block instantly; `Configure Permissions` per role.
- `Activities (/activities)`: who/what/when + diffs; tracks patient edits, discounts, referrer, test add/remove; email alerts; fraud flags; Advanced plan (upsell “Start free trial” if not subscribed).
- `Browser security (/web_browsers)`: allow-list devices; `Browser code` display.
- `Doctor access (/doctor_accesses/invited)`: invite referral doctors to portal (Premium); real-time case view; trust/transparency.
- `Google Review Builder` (Advanced): WhatsApp Google-link → patient rates/writes → posts; boosts Maps/search; dilutes negatives.

### FR-SUP — Help & Support
- `Help (/support?source=)`, `Setup`, `Watch Video`, `Get Support Offline` buttons site-wide.
- Ticket system (in-app); phone/Meet; RM assignment; hours noted; video library per checklist item.

---

## 6. Data Requirements

Core entities: Tenant/Lab (centre details, letterhead, case-start-no), User (owner/employee, permissions, blocked flag, browser codes), Patient (mobile unique-check, title, names, sex, age YMD, email, address, Aadhaar, history), Referrer, CollectionCentre (Main+), Agent, RateListItem (Lab/X-ray/MRI/CT/USG…), Bill/Case (reg-no immutable, datetime auto, modality set, items, discount, received, balance, mode, remarks, staff FK, barcode/QR), Transaction/Receipt, LabReport (state, TAT dates, results, normals, interpretations, method/instrument, signatures, QR, printed flag), Test (order, name, type, short, category, normals by age/sex, formula), Panel, Package, Category, Interpretation, USG/Xray Template (rich/HTML), Signature asset, Expense (category, amount, date), ActivityLog (actor, timestamp, entity, diff), SMSCredit ledger, DataExport job, DoctorInvite, ReviewRequest, SupportTicket.

Retention/windows: bills 31d export, patients 365d, transactions 31d, TAT 31d, expenses 365d, report links 31d.

---

## 7. External Interface Requirements

- **UI:** Clean, beginner-usable (receptionist zero-computer-knowledge claim); 5-min first bill; consistent nav; empty states with CTAs; countdown promo; trial banners.
- **Print:** Laser/Inkjet/Thermal; A4/A5/3-inch; letterhead on/off; QR+barcode scannable.
- **SMS Gateway:** Transactional; Welcome/Bill/Ready templates; 20p/credit.
- **WhatsApp/Email:** 1-click report link; Google review link.
- **QR:** Bill QR (status + download), Report QR (PDF download/share); requires internet; phone camera/Lens compatible.
- **Video:** YouTube embeds for training.
- **Payments (commercial):** Plan purchase/renewal (Buy now/Change plan); GST invoices (GSTIN 29EJXPS5100K2ZE observed).

---

## 8. Non-Functional Requirements

- **Usability:** NFR-U1: First bill ≤5 min unaided; NFR-U2: Report creation needs only result entry (normals prefilled).
- **Accuracy:** NFR-A1: Billing totals/discount/balance 100% auto; NFR-A2: Formulas 100% auto; NFR-A3: Abnormal-flag recall ≥99%.
- **Security:** NFR-S1: RBAC deny-by-default; NFR-S2: immutable reg-no + audit log tamper-evident; NFR-S3: ex-employee block effective immediately; NFR-S4: browser allow-list enforcement; NFR-S5: OTP expiry + rate-limit.
- **Availability:** NFR-AV1: Cloud, multi-device/phone access 24×7 (emergency sharing); NFR-AV2: MS-Word fallback noted for offline.
- **Performance:** NFR-P1: Dashboard/search <2s p95; NFR-P2: PDF gen <5s; NFR-P3: 200 patients/day courtesy throughput.
- **Compatibility:** Latest Chrome/Edge/Firefox; Android/iOS browsers for QR/links.
- **Maintainability:** Central panel manager; importable test DB; HTML templates.
- **Compliance:** GST billing; NABL/BMW/GST guidance via blog; privacy/terms/refund policies; 7-day money-back.
- **Supportability:** Ticket with media; DMLT-qualified staff; Meet screen-share.

---

## 9. Business Rules

- BR-1: Bill create → reports auto-created; test add/remove syncs both ways.
- BR-2: Discount edits / patient-identity edits always logged + optionally emailed.
- BR-3: Due collected posts to collection-day business, not billing-day.
- BR-4: Net = Income + CollectionCharges – Expenses.
- BR-5: Report states monotonic (New→InProg→Final→Signed); print does not change state except Printed flag.
- BR-6: QR links expose only status + PDF, no PHI beyond report.
- BR-7: SMS only if opted-in + credits >0.
- BR-8: Records cannot be deleted (fraud prevention); corrections via new activity.
- BR-9: Exceeding fair-use forces early renewal.
- BR-10: Trial 5 days includes free setup assistance; early purchase keeps trial days free.

---

## 10. Plans, Limits & Commercial Rules

| Plan | Price (ex-GST) | Bills/yr | Key inclusions |
|------|----------------|----------|----------------|
| Basic (Pathology) | ₹417/mo (₹4,999/yr) | 12,000 | Registration, Lab/X-ray/USG/CT/MRI/ECG billing, panels/packages, business reports, lab reports, QR bill/report download, SMS/Email/WhatsApp, support |
| Advanced | ₹625/mo (₹7,499/yr) | 12,000 | + Review builder, multi-login, fraud prevention, permissions, activity, browser security |
| Premium | ₹833/mo (₹9,999/yr; offer ₹499/mo first yr ₹5,999) | 20,000 | + Expense, Doctor portal, Business analysis, Test-count, Data export |
| Radiology Basic/Adv/Prem | ₹417/625/833/mo | 12,000 | USG + Digital X-ray variants |
| Diagnostic Basic/Adv/Prem | ₹833/1,250/1,667/mo | 12,000 | Combined lab+radio |
| Add-ons | USG ₹4,800/yr, X-ray ₹4,800/yr; Data export ₹1,299+GST/12mo; SMS 20p/credit | — | |
| Trial/Deal | 5-day trial, 7-day money-back, Sept deal ₹3,100+GST first yr | 200/day courtesy | |

---

## 11. Use-Case Catalog

- UC-01 Signup trial → verify email → onboarding checklist → go-live.
- UC-02 Owner sets centre/letterhead/signatures/rates/normals/users.
- UC-03 Reception registers patient + creates LAB bill (cash/UPI) → barcode/QR bill printed.
- UC-04 Tech enters CBC results → auto-calc MCV/MCH → abnormal flag → correct → Final → Sign → PDF.
- UC-05 Share via WhatsApp; patient downloads via Bill QR at home.
- UC-06 Pathologist approves from phone after hours.
- UC-07 Cashier closes day; owner views daily business + case/cashier splits.
- UC-08 Accountant adds expenses; net-income reviewed.
- UC-09 Owner invites doctor to portal; doctor views cases.
- UC-10 Owner blocks ex-employee; audits activities.
- UC-11 Marketing exports patients CSV → SMS campaign.
- UC-12 Patient leaves Google review via WhatsApp link.
- UC-13 Home collection: agent registers on mobile, barcoded bill.
- UC-14 Radiology: create USG template from Word → report → sign → deliver.
- UC-15 Support ticket with screenshot → Meet resolution.

---

## 12. Traceability: URL → Feature

| URL | Feature |
|-----|---------|
| `/labsmart_sessions/new`, `/users/sign_in` | Password login |
| `/email_authentication/login_form` | Email OTP |
| `/sms_authentication/enter_info_form` | SMS OTP (IN only) |
| `/reset_password/enter_info` | Forgot password OTP |
| `/users/unlock/new` | Unlock |
| `/73136222` | Dashboard |
| `/73136222/getting_started` | Onboarding checklist |
| `/73136222/cases/new`, `/cases`, `/cases/with_due` | Billing + dues |
| `/patients`, `/referrers`, `/sample_collectors`, `/receipts` | Master + transactions |
| `/lab_reports/today`, `/lab_reports` | Lab worklist/search |
| `/lab_tests`, `/lab_test_categories`, `/lab_test_panels`, `/test_packages`, `/interpretations`, `/lab_test_counts` | Test master |
| `/usg_cases*`, `/usg_templates`, `/usg_signatures`, `/digital_xray_*`, `/ctscan_cases`, `/outsource_lab_cases` | Radiology/outsource |
| `/business_reports/daily_business`, `/expenses`, `/referrer_wise_business_report/summary`, `/case_wise_business_report/new`, `/business_analysis/monthly_business_overview`, `/data_exports/new` | Business |
| `/users`, `/activities`, `/web_browsers`, `/doctor_accesses/invited` | Manage/security |
| `/diagnostic_labs/change_plan`, `/addons/show?addon_code=*` | Commercial upsell |

---

## 13. Out-of-Scope / Assumptions / Gaps

- No instrument integration observed; assume manual entry.
- No inventory/stock module observed in nav; do not require.
- “/73136222” numeric prefix assumed `{tenantId}`; multi-centre (DCN/CC) lightly evidenced — needs elaboration if cloning.
- SMS/WhatsApp provider SLAs, OTP expiry, password policy length/complexity not exposed — to be specified in detailed design.
- Report PDF internal layout pixel-spec not captured (needs print-sample annex).

---

## 14. Acceptance Criteria (Suggested)

- All FR-AUTH flows OTP-deliver <60s; lockout recoverable.
- New bill E2E <5 min; totals always balance (Total-Discount-Received==Balance).
- Bill↔report sync 100%; QR scans resolve to correct PDF/status.
- Formulas match reference (spot-check CBC/KFT/LFT/Lipid vectors).
- Daily business net matches BR-4 to paise; due-posting day rule holds.
- RBAC: blocked user gets 0 access; unauthorized URLs redirect to login with notice.
- Exports respect windows + CSV opens in Excel.
- Print legible on A4/A5/3-inch thermal with QR/barcode scannable by stock camera.

---

## Appendix A: Audit Evidence

- Login screenshot + snapshot (`Labsmart Login`, Email/Mobile + Password + Remember + Email/SMS OTP + Unlock + WhatsApp 9318313723 + Instagram QR).
- Auth pages: `Enter email (Send OTP)`, `Enter mobile number (+91, IN-only note)`, `Reset your password (without country code)`.
- Dashboard snapshot: full nav tree (Business/Cases/Lab/USG/Digital X-ray/Manage), trial/deal banners, dues/transactions/activities widgets, 100 SMS credits, RM Ashu Pandey card, Browser code 4FF4.
- New Bill snapshot: Title list (20+), Sex, Age YMD, Referred/Self, Main centre, Agent, 12 modality tabs, payment modes, 200/day limit.
- Test DB: 50+ rows, Single/Multi/Document types, category filter, proofread warning.
- Daily Business: KPIs + splits + grid columns + Monthly Overview BETA.
- Today’s Reports: state counters + empty state.
- Employee Logins: 1 Active owner, 0 Blocked, permissions model.
- Data Export upsell: Rs.1,299+GST prompt (proves gating).
- Getting Started: 11-item checklist, 9% example, support hours.
- Marketing: feature-tier mapping (Basic/Advanced/Premium), pricing table, 30+ formula list, SMS 20p, QR workflows — corroborated via sub-agent fetch.

---

*End of SRS v1.0 —Ready for design / estimation / test-case derivation.*
