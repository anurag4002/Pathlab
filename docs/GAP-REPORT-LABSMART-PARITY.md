# Gap Report: Pure Path Lab vs Labsmart LIS Parity

**Date:** 2026-09-16 **Basis:** Live audit of `app.labsmartlis.com/73136222` → `docs/LABSMART-SRS.md` v1.0 vs codebase `D:\Pathlab` (frontend React18 + backend Express/Mongo + `docs/PROJECT-AUDIT.md`) **Verdict:** \~55-60% parity by module count. Core CRUD + billing math + business reports exist. Critical Labsmart differentiators (QR/barcode, PDF/letterhead/e-sign, formula engine, online delivery, OTP-for-staff, browser allow-list, onboarding checklist, credits/subscriptions/tickets/reviews) are missing or mocked.

---

## 1. Executive Summary

| Category | Status |
| --- | --- |
| **DONE (usable)** | Patient CRUD, Doctor/Agent CRUD, Test DB/Categories/Panels/Packages/Interpretations, Billing totals + cash/upi/card/insurance + dues + transactions, Expenses + categories, Daily business net + payment split, Referral + Case-wise reports, Data export CSV (client-side), Activity log, Patient portal OTP (console-only sender), Dashboard summary |
| **PARTIAL (works but incomplete / mocked)** | Multi-modality billing (13 depts listed, only LAB/USG/XRAY filter works), Daily business (<mark data-color="#ffd700aa" style="background-color: rgba(255, 215, 0, 0.667); color: inherit;">no cashier-wise</mark>; Add Cashier = `alert`), Business analysis (CSS bars, no chart lib), RBAC (role toggle only, no matrix), Doctor access (no separate portal), Browser security (read-only mock), <mark data-color="#ffd700aa" style="background-color: rgba(255, 215, 0, 0.667); color: inherit;">USG/Xray cases</mark> (no delete, no rich templates), SMS OTP infra (console log, no provider) |
| **MISSING (0 implementation)** | Email OTP staff login, Forgot-password OTP (stub “contact admin”), Remember-me, Browser allow-list enforcement, Getting Started checklist, Barcode, QR (bill/report) + QR download, Formula engine (30+), Abnormal flag, TAT (4 dates), E-sign upload, Letterhead on/off PDF, WhatsApp/SMS/Email send + templates + credits ledger, Google Review Builder, Support tickets, Trial/Plan/Subscriptions + fair-use caps, CT/MRI/ECG/etc. case modules beyond billing tag |

No QR/barcode/PDF/SMS/WhatsApp/Email dependencies exist in either `package.json` — parity requires new integrations.

---

## 2. Methodology

- Re-ran SRS FRs (FR-AUTH … FR-SUP) against file evidence: `AppRoutes.jsx`, `features/*`, `pages/*`, `services/*`, `models/*`, `controllers/*`, `routes/*`, `constants/*`, `utils/*`.
- Grades: FOUND = end-to-end real; PARTIAL = API/UI exists but mocked/gated/single-path; MISSING = no code/dependency/route.
- Cross-checked with `PROJECT-AUDIT.md` P0s (hardcoded creds, upload path bug, stack-trace leak, billing mocks — since fixed for billing calc, still broken for uploads).

---

## 3. DONE — What Works Today (keep)

### 3.1 Auth (staff password)

- `features/auth/pages/Login.jsx` + `authController.login` + `authService` + JWT 7d + `AuthContext.jsx` + `ProtectedRoute/RoleRoute`. Evidence: login/me/logout real.

### 3.2 Patients / Doctors / Agents

- `PatientsPage/PatientDetailsPage/PatientFormModal` + `patientController` full CRUD (delete Admin-only). Search by name/phone/CaseID concept via `useGlobalSearch`.
- `ReferralDoctors.jsx` + `doctorController`, `Agents.jsx` + `agentController` with commission %.

### 3.3 Test Master

- `TestDatabase/TestCategories/TestPanels/TestPackages/Interpretations` + `testController` 5×CRUD + models `Test/TestCategory/TestPanel/TestPackage/Interpretation` with `referenceRange/male/femaleReferenceRange/price`. This matches Labsmart Basic test DB requirement minus formulas/normals-by-age logic.

### 3.4 Billing Math

- `BillCreateForm (91-94)` + `billService (9-25)`: subtotal-discount=total, paid/due, Paid/Partial/Pending. Modes Cash/Card/UPI/Insurance (`Bill.js:52`). `BillsPage + PaymentCollectModal + BillPrintPreview (window.print)`.
- Due flow: `DueReports.jsx` + `POST /:id/payment` + Transaction auto-create. Matches BR-3 collection-day intent (verify date logic).

### 3.5 Business

- `DailyBusiness.jsx (44-47)` Net = Income+Collection-Expenses + split Cash/Card/UPI/Insurance + tabs txns/bills/expenses. Backend `dashboardService.getDailyBusiness`.
- `Expenses.jsx` + `EXPENSE_CATEGORIES` + `expenseRoutes` full CRUD.
- `ReferralBusiness.jsx` + `getReferralBusiness` (billed + commission), `CaseWiseReport.jsx`, `Transactions.jsx` (Income/Refund + method filter).
- `DataExport.jsx:triggerCSVDownload` for bills/patients/expenses (client-side).
- `Activities.jsx` + `Activity.js` + logging in auth/bill/report controllers.

### 3.6 Radiology shell + Patient portal

- `TodaysUSGCases/SearchUSGCases/ReportTemplates` + `usgController/Service`, same for Xray. Case CRUD real.
- `PatientReportPortal.jsx` + `patientPortalController (request-otp/verify-otp/reports)` + `OtpSession (otpHash/TTL/attempts)` + `protectPatient (2h JWT)` + rate-limit 5/15m. Flow real except sender.

---

## 4. PARTIAL — Needs Completion (highest ROI)

| \# | Feature | Current | To Complete |
| --- | --- | --- | --- |
| P-1 | Multi-modality billing | `billingConstants DEPARTMENTS` 13 items, `filterTestsByDepartment` only LAB/USG/XRAY else `[]` | Implement filtering + rate-list scoping + case creation for CT/MRI/ECG/XRAY/OUTSOURCE/EPS/OPG/Cardio/EEG/Mammo; add `CtscanCase`-like modules or generic `ModalityCase` |
| P-2 | Daily business cashier/case-wise | Net+split done; `Add Cashier` = `alert('simulated')`; case-wise separate page | Add `Cashier` (User flag) model, `receivedBy` aggregation, cashier filter; embed case-type split (Lab/USG/Xray) into daily page |
| P-3 | Business analysis charts | Real data, CSS bars | Add `recharts` (already expected) or `chart.js`; daily workload graph, 6-mo trends, test-count analysis |
| P-4 | RBAC granular | Roles Admin/Employee/Doctor + `authorize('Admin')` + `permissions.js`, but `EmployeeLogin.jsx` only role toggle | Permission matrix (billing/reports/rates/finance/settings) per Labsmart FR-MANAGE; `Configure Permissions` UI + middleware checks per route |
| P-5 | Doctor portal | `DoctorAccess.jsx` creates Doctor users, same login/dashboard | Separate `/doctor` portal (own cases only, real-time), invite flow (`DoctorInvite`) |
| P-6 | Browser security | `BrowserSecurity.jsx` filters Activity for logins, hardcoded `1 Session Active`, fake IP `slice(0,12)` | Capture IP/UA, device allow-list CRUD, `Browser code` display, block enforcement |
| P-7 | USG/Xray templates | Template picker + findings/impression text | Rich-text editor (TipTap/Quill), MS-Word paste, HTML templates, duplicate, signatures linkage |
| P-8 | Patient OTP sender | `otpService.sendOtp → console.log / return true`, `SMS_PROVIDER=console` | Wire SMS gateway (MSG91/Twilio/Exotel transactional) + Email OTP option; add resend/cooldown UX |
| P-9 | Bills/USG/Xray delete-update | Bills no PUT/DELETE; USG/Xray no DELETE | Add update/delete with activity log + fraud guard (no hard delete — status `Voided`) |

---

## 5. MISSING — To Build for Labsmart Parity

### 5.1 Auth gaps (FR-AUTH)

- **Email OTP staff login:** new `POST /api/auth/email-otp/request|verify`, UI link on Login, magic-link or 6-digit code, same JWT.
- **Forgot-password OTP:** replace stub (`requestPasswordReset → contact admin`) with phone/email → OTP → reset.
- **Remember-me:** checkbox → 30d vs session token; `AuthContext` persist flag.
- **Browser allow-list enforcement:** middleware check on login (`web_browsers` collection).

### 5.2 Onboarding (FR-ONB)

- **Getting Started checklist:** 11-item model (`OnboardingProgress`), % bar, `Verify email`, centre/letterhead/rates/normals/users steps, per-item video links, `Setup` wizard (case-start-no, letterhead upload+margins, signature upload, SMS toggles).

### 5.3 Bill artefacts (FR-BILL-4)

- **Barcode:** `bwip-js` or `jsbarcode` on bill print + scan-search.
- **QR:** `qrcode` (backend) + `react-qr-code` (frontend); Bill QR → public status+download URL; Report QR → PDF URL. Public unauth routes with signed tokens.
- **Letterhead PDF:** `pdfkit`/`puppeteer` or `jspdf` + toggle with/without letterhead, margins, font/spacing, show/hide fields. Replace `window.print()`-only.

### 5.4 Lab intelligence (FR-LAB-3 / FR-FORM)

- **Formula engine:** service `formulaService.js` with 30+ rules (CBC MCV/MCH/MCHC/NLR, KFT BUN/eGFR CKD-EPI, LFT Globulin/A-G, Lipid VLDL/LDL/non-HDL, PT/INR, eAG, Iron UIBC/%Sat, ACR/PCR). Trigger on result entry; store derived + audit.
- **Result entry (not just upload):** `Report` model needs `results[{test, value, unit, flag}]`, `TAT {registered/collected/received/reported}`, `signatures[]`, `qrToken`. Current `Report.js` only `fileUrl` — requires migration.
- **Abnormal checker + template restrictions (age/sex):** validation on entry + UI flags.
- **E-signatures:** upload (Multer already) + auto-place on PDF; `Signatures` per modality.

### 5.5 Delivery (FR-SEND)

- **1-click WhatsApp/SMS/Email:** provider abstraction (`notificationService`), templates (Welcome/Bill/Ready), opt-in toggles, credit deduction.
- **Credits ledger:** `SmsCredit {balance, history}`, initial 100, packs Rs.200-1000, 20p/credit, low-balance warning.
- **QR self-service:** public `GET /r/:token` status + download (no login).

### 5.6 Growth & Support (FR-MANAGE / FR-SUP)

- **Google Review Builder:** per-lab Google link config + WhatsApp send + conversion log.
- **Support tickets:** `Ticket {subject, photo/video, status}` + list + Meet link; hours notice.
- **Subscriptions:** `Plan {Basic/Adv/Prem/Radio/Diagnostic}`, `Subscription {trialEnds, fairUseCount}`, caps 12k/20k/yr + 200/day courtesy, `Change plan/Buy now`, 7-day refund flag, GST invoice fields.

---

## 6. Module-wise Scorecard (SRS → Pathlab)

| SRS Module | Score | Notes |
| --- | --- | --- |
| AUTH password | 80% | Missing OTP-for-staff, forgot, remember, allow-list |
| Dashboard | 60% | No checklist, promo/subscription banners, deal logic |
| Onboarding/Setup | 10% | No checklist/wizard; centre/letterhead/signatures missing |
| Billing (reg+bill) | 75% | Modalities, barcode/QR, letterhead missing |
| Patients/Referrers/Agents/Txns | 90% | Solid; needs Aadhaar/Email/Address expanders parity |
| Lab worklist | 50% | Upload-only; no states machine (New→Signed), no TAT |
| Test master | 85% | Needs age/sex normals + proofread flag + import |
| Formulas | 0% | Greenfield |
| Radiology | 55% | Shell done; templates/signatures weak |
| Delivery | 5% | Only portal download; no send |
| Daily business | 70% | No cashier-wise; Monthly Overview BETA missing |
| Expenses | 90% | Done |
| Referral/Case-wise | 85% | Done; needs print/email parity |
| Analysis | 40% | Data yes, viz no |
| Export | 60% | Client CSV only; needs windows (31d/365d) + PDF links + server export |
| Employees/Activities | 70% | Coarse RBAC; activity needs diffs + email alerts |
| Browser/Doctor/Review/Tickets/Credits/Plans | 10% | Mock or absent |

---

## 7. Prioritized Build Plan

### Phase 1 — Parity blockers (P0, 2–3 weeks)

1. Migrate `Report` → result-entry + TAT + flags (blocks formulas/accuracy story).
2. Formula engine + abnormal flags + age/sex normals.
3. QR + Barcode + public download routes.
4. PDF with/without letterhead + E-sign placement.
5. Real SMS/Email sender + templates + credits ledger + opt-in toggles.
6. WhatsApp send (Cloud API) 1-click from report.
7. Forgot-password OTP + Remember-me + Email OTP login.
8. Fix P0s from PROJECT-AUDIT: remove hardcoded creds, fix upload path (`fileUrl src/` prefix + `getFilePath` subfolder), hide stack traces, add Helmet/rate-limit/validation.

### Phase 2 — Business close (P1, 2 weeks)

 9. Cashier-wise + case-type split in Daily Business; Monthly Overview BETA + Print/Email.
10. Server-side export with windows + PDF-link export.
11. Granular RBAC matrix + browser allow-list enforcement.
12. Getting Started checklist + Setup wizard + Verify-email.
13. Rich USG/Xray templates + signatures + duplicate.
14. Charts (workload, trends, test counts).

### Phase 3 — Growth (P2, 1–2 weeks)

15. Doctor portal (separate UI + invites).
16. Review Builder + Ticket system + Subscription/billing + fair-use enforcement + Trial banners.
17. CT/MRI/ECG/etc. generic modality cases; Outsource flow.
18. SMS campaigns + recall lists from exports.
19. Tests: `TEST-CASES-STRICT.md` → automated (Vitest/Jest + Supertest); CI + lint.

---

## 8. File-level To-Do (actionable)

- `backend/src/models/Report.js` → add results/TAT/signatures/qrToken/states.
- `backend/src/services/formulaService.js` (new) + `reportController` entry endpoints.
- `backend/src/services/notificationService.js` (new: SMS/Email/WhatsApp) + `SmsCredit.js` + `NotificationTemplate.js`.
- `backend/src/routes/authRoutes.js` → add `/email-otp/*`, real `/forgot-password`, remember flag in `generateToken`.
- `backend/src/models/WebBrowser.js` + middleware + `BrowserSecurity.jsx` rewrite.
- `frontend/src/features/billing/BillPrintPreview.jsx` → barcode+QR+letterhead toggle + PDF download (add `qrcode`, `jsbarcode`, `jspdf`).
- `frontend/src/pages/business/DailyBusiness.jsx` → cashier filter + case split + print/email.
- `frontend/src/pages/manage/*` → permissions matrix UI; `DoctorAccess.jsx` → portal.
- `frontend/src/pages/lab/*` → result-entry grid + TAT inputs + sign-off buttons.
- `frontend/src/features/dashboard/DashboardPage.jsx` → checklist component + trial widget.
- New: `OnboardingProgress`, `SupportTicket`, `ReviewRequest`, `Subscription/Plan` models + pages.
- Deps to add: `qrcode, jsbarcode/bwip-js, pdfkit or puppeteer, nodemailer, twilio/msg91 sdk, helmet, express-validator/zod`.

---

## 9. Risks if Shipped As-Is

- No online-delivery story (Labsmart’s core pitch) → competitive gap.
- Upload-only reports → cannot claim auto-calc/accuracy; formula parity 0%.
- Console-only OTP → patient portal unusable in prod.
- Print-only bills without QR/barcode → extra lab visits/calls (Labsmart solves this).
- Coarse RBAC + no allow-list + hardcoded secrets → fraud/security exposure (see PRODUCTION-RISKS.md).
- No subscription/fair-use → revenue leakage.

---

*End — Next: pick Phase 1 items to schedule; this file pairs with* `docs/LABSMART-SRS.md` *(target) and* `docs/PROJECT-AUDIT.md` *(current risks).*