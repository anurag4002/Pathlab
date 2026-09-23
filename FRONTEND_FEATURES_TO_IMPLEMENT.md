# Pure Path Lab — Frontend Features To Implement

Phase-by-phase implementation roadmap for the frontend engineer.

**How to read this document**

* Every row in the summary table maps to one phase of the product (Phases 1–32).
* Each phase has a detailed section with the same 17 sub-headings.
* **Status** values used: `Missing`, `Partial`, `Improvement Required`, and for Phases 29–32 `Existing (minimal) — OPTIONAL / FUTURE`.
* **Priority** bands: Phases 1–11 = Critical, Phases 12–21 = High, Phases 22–28 = Medium, Phases 29–32 = Optional.
* **Scope**: single-lab product. SaaS concepts (subscriptions, trials, multi-tenancy, paywalls, usage limits) are **not** part of this roadmap. A few SaaS-shaped artifacts already exist in the codebase and are flagged in the relevant sections as *out of scope* — they are not features to build.
* **Backend Dependency** describes what the backend must provide. Items marked *(does not exist)* are verified gaps in `backend/` — the frontend must not invent or mock them.
* Everything in this document was verified against the current code (frontend routes in `frontend/src/routes/AppRoutes.jsx`, service layer in `frontend/src/services/`, backend routers in `backend/src/routes/`).

---

## Feature Summary Table

| Phase | Feature | Status | Priority | Frontend Work Required | Backend Dependency | Depends On |
|---|---|---|---|---|---|---|
| 1 | Report Inbox & Worklist (due / pending / sample-wise) | Partial | Critical | Due/pending tabs + filters on `/lab/reports`; wire unused `getPendingLabCases`/`getReportForEntry`; TAT countdown from report `tatHours` | Pending/due report-list endpoints *(do not exist)*; `tatHours` already returned | 6 |
| 2 | Normal Ranges & Derived Tests | Partial | Critical | Range editor UI in test form; derived-test flag + formula field; range-aware result validation | Range fields exist on `Test` but are **not** accepted by `POST/PUT /api/tests` *(gap)*; derived-test API *(does not exist)* | — |
| 3 | Pathologist Verification Workflow | Partial | Critical | Verify / reject / request-changes actions + comments panel in report detail | Verify/reject/comments endpoints *(do not exist)*; `Verified`/`Rejected` statuses *(do not exist)* | 4 |
| 4 | Report PDF Preview | Partial | Critical | Client-side PDF preview before printing/sending; consistent `printReportPdf` usage | Print endpoint already exists (`GET /api/reports/:id/print`) | 24 |
| 5 | Image Upload (USG / X-Ray) | Partial | Critical | Upload progress, error, retry states; wire `uploadImages` service (currently dead code) | `POST /api/cases/:caseId/images` exists; sequential upload only | 13, 14 |
| 6 | Auto TAT / Due Logic | Partial | Critical | Show per-report TAT countdown; “due today / overdue” derived from `tatHours` | No due-list endpoint; `tatHours` already returned on reports | 1 |
| 7 | SMS / Email / WhatsApp Delivery | Partial | Critical | Real delivery status UI (Sent / Failed / Retry); send-history per report | Generic send API exists (`POST /api/notify/send`); per-report status/history endpoints *(do not exist)* | 1 |
| 8 | Printable Barcode Stickers | Partial | Critical | Case-wise + sample-wise sticker printing; use `fetchBarcodeSvgUrl` (defined, unused) | Bill barcode endpoint exists (`GET /api/public/bill/:billNumber/barcode`); case/sample barcode endpoints *(do not exist)* | 11 |
| 9 | Rejection & Resend | Missing | Critical | Entire flow: reject dialog, reason capture, rejected list, resend action | Rejection status/endpoints *(do not exist)* | 3 |
| 10 | QR Code on Report | Partial | Critical | Verify/enable `qrDataUrl` in print templates (endpoint returns it; templates ignore it) | Already provided (`qrDataUrl`, `verificationUrl`) | 4 |
| 11 | Label Printing | Partial | Critical | Print templates for barcodes/labels; wire `fetchBarcodeSvgUrl`; case/sample labels | Case/sample label endpoints *(do not exist)* | 8 |
| 12 | Smart Test Suggestions (autocomplete) | Partial | High | Unified `Combobox`-based test selector across booking, test DB, packages | `GET /api/tests?search=` exists | — |
| 13 | Radiologist / USG Technician Workflow | Partial | High | My-cases view with department filter; image upload with progress/retry; sign-off | Case-assignment filter on `/api/usg/cases` *(does not exist)* | 5 |
| 14 | X-Ray Image Handling | Partial | High | X-ray image upload UI + print preview (USG has print preview; X-ray does not) | `POST /api/xray/cases/:id/images` exists | 5 |
| 15 | Multiple Signature Handling | Partial | High | Signature manager (assign signatories per department/report type) | Signature CRUD + assignment API exist (`/api/signatures`) | 3 |
| 16 | TAT Configuration Screen | Missing | High | Full screen: default TAT, per-test TAT, emergency TAT, urgent thresholds | Default TAT config endpoint *(does not exist)*; per-test `tatHours` exists | 6 |
| 17 | Accounts & Due Reports (collect, due, refund, void) | Partial | High | Department filter on ledger; package-discount entry; real void reason; bill edit flow | No bill-edit/refund endpoints; `POST /api/bills/:id/void` uses hardcoded reason | 22 |
| 18 | Cash Book | Partial | High | Transaction list, filters, date-range summary | `GET /api/bills/cashbook` exists; no manual-entry API | 17 |
| 19 | Employee Management | Partial | High | Full employee form (designation, department, joining date, docs); sessions panel; profile | Employee CRUD exists (`/api/users`); session list/revoke endpoints *(do not exist)* | 25 |
| 20 | Activity / Audit Log | Missing | High | Log viewer with actor / action / date / entity filters | Audit-log API *(does not exist)* | 19 |
| 21 | Rate Revision | Partial | High | Bulk rate-revision flow with effective date + audit preview | Bulk rate-revision endpoint *(does not exist)*; single rate update exists (`PUT /api/tests/:id/rate`) | 2 |
| 22 | Discount / Package Handling | Partial | Medium | Package selector in billing (prop exists, never wired); custom discounts; combo indicators | No bill-edit endpoint (package/discount corrections impossible post-bill) | 17 |
| 23 | Registration Number Configuration | Partial | Medium | Settings UI for prefix/format (today only a start number is editable) | Backend accepts only `caseStartNumber`; prefix/date-format/barcode config *(do not exist — `PPL-` hardcoded)* | — |
| 24 | Report Branding / White Labeling | Partial | Medium | Full branding form (website, registration no., disclaimer, logo upload); remove hardcoded lab name from templates/SMS | `POST /api/setup/lab-profile` accepts a subset of fields; logo upload *(does not exist)* | — |
| 25 | Role / Permission Management | Partial | Medium | Consume `user.permissions` in UI (currently never read); permission matrix screen; align EmployeeLogin checkbox array with backend `Map` | Permission keys exist; `User.permissions` is a `Map`, frontend sends an `Array` *(shape mismatch)* | 19 |
| 26 | Data Export Center | Partial | Medium | CSV preview/download wiring for all datasets; export history | `GET /api/export/:dataset` returns JSON; CSV/history endpoints *(do not exist)* | — |
| 27 | Failed Job / Retry Dashboard | Missing | Medium | Job list with status, error, retry action | Job/queue API *(does not exist)* | 7 |
| 28 | Test Usage & Reorder Analytics | Missing | Medium | Analytics: test frequency, slowest-moving, suggested reorder | Test-analysis endpoint *(does not exist)* | — |
| 29 | Doctor Portal (online booking) | Existing (minimal) — **OPTIONAL / FUTURE** | Optional | None required for core roadmap; optional enhancement of existing portal | `/api/doctor` + `/api/appointments` exist | — |
| 30 | Online Booking | Partial — **OPTIONAL / FUTURE** | Optional | Optional polish of existing booking flow | Appointment APIs exist; slot availability check *(does not exist)* | 29 |
| 31 | Support Ticketing | Existing (minimal) — **OPTIONAL / FUTURE** | Optional | None required for core roadmap | Ticket APIs exist (`/api/tickets`) | — |
| 32 | Multi-Branch (out of scope for single lab) | Existing (minimal) — **OPTIONAL / FUTURE** | Optional | None — single-lab product; do not build SaaS multi-tenancy | Modality/case APIs exist; branch concept *(does not exist)* | — |

---

## Dependency Flow

```
Foundations
  Phase 24 (Branding) ──────────────► Phase 4 (PDF Preview)
  Phase 2  (Ranges/Derived) ─┬──────► Phase 21 (Rate Revision)
                             └──────► Phase 12 (Test Suggestions)

Core Reporting
  Phase 6  (TAT/Due) ──► Phase 1  (Inbox/Worklist) ──► Phase 3  (Verification)
                                                        │
Phase 4 (PDF Preview) ◄─────────────────────────────────┤
   │                │                                   │
   ▼                ▼                                   ▼
Phase 10 (QR)   Phase 24 (Branding)            Phase 9  (Reject/Resend)
                                                       │
                                                       ▼
                                               Phase 7  (Delivery + Retry)
                                                       │
                                                       ▼
                                               Phase 27 (Failed Jobs)

Images & Labels
  Phase 13 (USG workflow) ──► Phase 5  (Image Upload) ──► Phase 14 (X-Ray)
  Phase 8  (Barcode) ───────► Phase 11 (Label Printing) ─► Phase 3 (sign-off on print)

Finance
  Phase 22 (Discount/Package) ──► Phase 17 (Accounts/Due) ──► Phase 18 (Cash Book)

People & Governance
  Phase 25 (Roles/Perms) ──► Phase 19 (Employees) ──► Phase 20 (Audit Log)

Configuration
  Phase 16 (TAT Config) ─► Phase 6/1    Phase 23 (Registration Config) ─► Phase 1/8
  Phase 26 (Export) , Phase 28 (Analytics) — independent

Optional (not in core scope): Phase 29 ─► 30, Phase 31, Phase 32
```

---

# Phase 1 — Report Inbox & Worklist

### Priority
Critical.

### Current Status
**Partial.** `/lab/reports` shows today's reports with search, department filter, TAT-sort, and modals for result entry, signing, TAT display, and sending (`TodaysReports.jsx`). Missing: due/pending worklist tabs, per-report TAT countdown, and the sample-wise (pending specimens) view — both backed by service functions that already exist but are never called.

### What Already Exists
* Route `/lab/reports` → `TodaysReports`.
* Today's reports with search, department filter, manual TAT field, “Due ≤ 2h / ≤ 4h” badges, report detail drawer, result-entry modal, sign modal, Send modal, print invoice.
* `reportService.js`: `getTodaysReports`, `getReportById`, plus **unused** `getPendingLabCases`, `getReportForEntry` (would 404 — no matching backend route), `saveReportResultsDraft`, `submitReportResults`.
* Quick action link from the dashboard (dead target — see Notes).
* `tatHours` is stored per report and returned by `GET /api/reports/today`.

### What Is Missing
* “Due” and “Pending” worklist tabs (server-side due list does not exist).
* Sample-wise pending list (`getPendingLabCases` has no backend counterpart).
* Per-report TAT countdown using `tatHours` + registration time (currently a static badge).
* Department quick-filter on the inbox (department filter exists only inside the result-entry modal).

### Frontend Screens Required
* `TodaysReports` gains tabs: **Today | Due | Pending (samples)**.
* Department chip row above the table.

### Frontend Components Required
* `TatCountdown` (computed from `tatHours` and report creation time).
* `WorklistTabs`, `DepartmentFilterChips`.

### Existing Routes
`/lab/reports` (TodaysReports), `/lab/dashboard` (quick-action source).

### Existing APIs
* `GET /api/reports/today`
* `GET /api/reports/:id`
* `GET /api/departments`

### Required Backend APIs
* `GET /api/reports/due?date=&department=` — due list *(does not exist)*.
* `GET /api/reports/pending-lab-cases` — sample-wise pending list *(does not exist; frontend `getPendingLabCases` already targets this path but would 404)*.

### Data Required From Backend
* Due reports with `tatHours`, registration time, current status.
* Pending specimens with test/panel, department, collector, status.

### User Actions
* Switch tabs, filter by department, search, open report, enter results, sign, send, print invoice.

### Validation Requirements
* Results entry: numeric values, required fields per test, reject save when a required result is empty (client-side today; backend does not validate).

### Permission Requirements
* Reports permission (`permissions.reports`); signing additionally requires pathologist role or `canSign`.

### UI States
* Loading, empty per tab, error, and the existing toast notifications.

### Dependencies
Phase 6 (TAT definitions), Phase 16 (TAT configuration).

### Production Requirements
* Tabs must degrade gracefully: if the due/pending endpoints are unavailable, show the today list with an explanatory empty state — never a broken table.

### Notes for Implementing Engineer
* Do not wire `getReportForEntry` — it targets a non-existent backend route.
* The dashboard quick action points at `/lab/reports/today?upload=true`, which does not exist (`AppRoutes.jsx` has `/lab/reports`). Fixing that constant is a code change outside this document's scope — record it as a required correction when implementing.
* Hardcoded-data finding: SMS preview in this page hardcodes `lab: 'Pure Path Lab'` (line ~219) — must come from lab profile (Phase 24).

---

# Phase 2 — Normal Ranges & Derived Tests

### Priority
Critical.

### Current Status
**Partial.** The `Test` backend model already defines full range fields (`normalLow/normalHigh`, `criticalLow/criticalHigh`, `ageMin/ageMax`, `sexApplicable`, `unit`, `method`) and derived flags (`isDerived`, `formula`). The `TestDatabase` result-entry UI already captures **range strings** (`normalRange`, `criticalLow`, `criticalHigh`, `ageSexSpecific`, `unit`, `method`). Missing: low/high numeric fields, age/sex applicability inputs, derived-test UI, backend acceptance of these fields on create/update, and result validation against ranges.

### What Already Exists
* `backend/src/models/Test.js` — complete schema including derived-test fields.
* `TestDatabase.jsx` result modal with range string inputs (local state, submitted to `/api/tests`).
* `DEPARTMENTS` constant with 13 departments covering every modality (lab, USG, X-ray, ECG, etc.).

### What Is Missing
* `normalLow/normalHigh` (numeric) and `ageMin/ageMax`/`sexApplicable` inputs in the test form.
* Derived-test UI (checkbox + formula/child-test selector).
* Backend `createTest`/`updateTest` allowed-field lists do not include any range fields — the UI's range inputs are accepted only if the spread lands in `data`; low/high numeric fields are not sent at all.
* Result-entry validation against ranges (flag HIGH/LOW/CRITICAL in the entry modal).

### Frontend Screens Required
* Extended test editor inside `/lab/test-database` (no new route).

### Frontend Components Required
* `RangeEditor` (numeric low/high + age/sex applicability), `DerivedTestEditor`, `RangeFlagBadge` in result entry.

### Existing Routes
`/lab/test-database`.

### Existing APIs
* `GET /api/tests`
* `POST /api/tests`
* `PUT /api/tests/:id`

### Required Backend APIs
* Extend allowed fields on `POST /api/tests` and `PUT /api/tests/:id` to include `normalLow`, `normalHigh`, `criticalLow`, `criticalHigh`, `ageMin`, `ageMax`, `sexApplicable`, `isDerived`, `formula` *(currently not in the allowed list — gap)*.
* Derived-test resolution endpoint (evaluate formula server-side) *(does not exist)*.

### Data Required From Backend
* Test records with full range metadata returned by `GET /api/tests`.

### User Actions
* Enter low/high ranges, set age/sex applicability, mark a test derived, save.

### Validation Requirements
* `normalLow <= normalHigh`; `criticalLow <= normalLow`; `criticalHigh >= normalHigh`; derived tests require a formula/child list.

### Permission Requirements
* Settings/tests management permission.

### UI States
* Clean/invalid form states, save success/failure.

### Dependencies
None.

### Production Requirements
* Range validation must be pure client-side until the backend enforces it; never block result entry if ranges are absent.

### Notes for Implementing Engineer
* Do not remove the existing range string inputs — they are consumed by display templates; add numeric fields alongside.
* The `isDerived`/`formula` fields exist only in the model; no controller/service logic reads them.

---

# Phase 3 — Pathologist Verification Workflow

### Priority
Critical.

### Current Status
**Partial.** Sign-off exists: `POST /api/reports/:id/sign` with pathologist name/signature/time, plus an unsigned-reports list (`GET /api/reports/unsigned`) and a dedicated `/lab/verify` review screen with sign & reject **UI** (reject only clears local state — no backend call). Missing: verification as a distinct status (backend enum has no `Verified`/`Rejected`), reject/request-changes endpoints, and per-report comments.

### What Already Exists
* Sign modal in `TodaysReports` (pathologist dropdown from lab profile, signature URL, confirmation checkbox).
* `POST /api/reports/:id/sign` (requires `canSign` or pathologist role); sets status `Signed` and `signedBy/signedAt`.
* `GET /api/reports/unsigned` and `/lab/verify` review screen (`VerifyReport.jsx`) with tabs Pending/Reviewed/Signed.
* Signature model + `GET /api/signatures` (Phase 15).

### What Is Missing
* `Verified` / `Rejected` statuses (absent from `Report.status` enum).
* Verify / reject / request-changes endpoints (reject button in `VerifyReport` is UI-only).
* Comment thread between technician and pathologist.

### Frontend Screens Required
* Existing `/lab/verify` enhanced with reject/request-changes dialog and comments panel.

### Frontend Components Required
* `RejectDialog`, `CommentThread`, `VerificationTimeline`.

### Existing Routes
`/lab/verify`, `/lab/reports`.

### Existing APIs
* `POST /api/reports/:id/sign`
* `GET /api/reports/unsigned`

### Required Backend APIs
* `POST /api/reports/:id/verify` *(does not exist)*.
* `POST /api/reports/:id/reject` with reason *(does not exist)*.
* `POST /api/reports/:id/comments` *(does not exist)*.
* Add `Verified`, `Rejected` to `Report.status` enum *(does not exist)*.

### Data Required From Backend
* Verification state, reject reason, comment history per report.

### User Actions
* Open report, review results, sign, verify, reject with reason, comment, request changes.

### Validation Requirements
* Cannot verify/reject without opening the report; reject requires a reason.

### Permission Requirements
* `canSign` or pathologist role for sign/verify; technicians can comment.

### UI States
* Pending, verified, rejected (with reason banner), commented.

### Dependencies
Phase 4 (preview before sign), Phase 15 (signatures).

### Production Requirements
* Verification actions must be idempotent (double-click must not double-sign).

### Notes for Implementing Engineer
* The verify screen's existing “Reject” button currently only clears local state — do not present it as working until the backend endpoint exists.
* Note the backend gap: draft-saving service code writes status `'Draft'`, which is also not in the enum.

---

# Phase 4 — Report PDF Preview

### Priority
Critical.

### Current Status
**Partial.** Print rendering exists (report print page, invoice print page, print popup window via `handlePrint`), and `publicService.printReportPdf` is defined but **never called**. Missing: an in-app PDF preview before print/send, and consistent use of the PDF endpoint.

### What Already Exists
* Print popup flow (`window.open` + `print()`) in TodaysReports; invoice print page (`/print/invoice/:id`).
* `GET /api/reports/:id/print` returning lab profile + report data.
* `publicService.printReportPdf(token)` — defined, unused.

### What Is Missing
* On-screen preview (modal or route) showing the exact printed layout before print/send.
* Consistent `printReportPdf` usage for downloadable PDFs.

### Frontend Screens Required
* Preview modal inside report detail / sign / send flows (no new route strictly required).

### Frontend Components Required
* `ReportPreviewModal` reusing the print template component.

### Existing Routes
`/lab/reports`, `/lab/verify`, `/print/invoice/:id`, `/lab/settings/print-preview`.

### Existing APIs
* `GET /api/reports/:id/print`
* `GET /api/printers`
* `GET /api/public/report/:token/pdf` (`printReportPdf`, unused)

### Required Backend APIs
* None new (print endpoint exists).

### Data Required From Backend
* Print payload incl. ranges, signature, QR (see Phase 10), branding (Phase 24).

### User Actions
* Preview, print, download PDF, close.

### Validation Requirements
* Preview must not render unsigned reports as final (show watermark/banner when unsigned).

### Permission Requirements
* Reports permission.

### UI States
* Loading preview, render error, print success.

### Dependencies
Phase 24 (branding on the printed header), Phase 10 (QR).

### Production Requirements
* Preview layout must match print output (same component, no divergent markup).

### Notes for Implementing Engineer
* Reuse the existing print template component; do not duplicate markup.

---

# Phase 5 — Image Upload (USG / X-Ray)

### Priority
Critical.

### Current Status
**Partial.** Backend endpoints exist for both modalities and `reportService.uploadImages` exists but is **never called by any UI**. No upload progress, error, or retry states anywhere.

### What Already Exists
* `POST /api/usg/cases/:id/images` (technician/radiologist).
* `POST /api/xray/cases/:id/images` (radiologist/assistant).
* `reportService.uploadImages(caseId, files, modality)` — unused; sequential upload, no per-file status.

### What Is Missing
* Upload UI on case pages with per-file progress, failure handling, retry, and remove.
* Concurrent upload and validation (size/type limits client-side).

### Frontend Screens Required
* Image uploader inside USG (`/lab/usg/my-cases`) and X-ray (`/lab/xray/cases`) case forms.

### Frontend Components Required
* `ImageUploader` (drag-drop, progress bar, retry, thumbnail grid).

### Existing Routes
`/lab/usg/my-cases`, `/lab/xray/cases`, `/lab/modality/cases`.

### Existing APIs
* `POST /api/usg/cases/:id/images`
* `POST /api/xray/cases/:id/images`

### Required Backend APIs
* None new for upload; consider a delete-image endpoint *(does not exist)* if remove-after-upload is required.

### Data Required From Backend
* Stored image URLs per case on case fetch.

### User Actions
* Select images, watch progress, retry failed ones, remove, save case.

### Validation Requirements
* Accept only image MIME types; enforce max size; block submit if an upload is in progress.

### Permission Requirements
* Technician/radiologist roles per modality.

### UI States
* Idle, uploading (n%), per-file error, success, retrying.

### Dependencies
Phases 13, 14.

### Production Requirements
* Uploads must not block form save; failed files must be visibly retryable.

### Notes for Implementing Engineer
* `uploadImages` currently uploads sequentially and aborts on first error — improve when implementing (documented here; not yet changed).

---

# Phase 6 — Auto TAT / Due Logic

### Priority
Critical.

### Current Status
**Partial.** Per-report `tatHours` exists (manual numeric field in result entry, saved on the report), due-soon sorting exists, and a “Due ≤ 2h / Due ≤ 4h” badge is computed client-side using hardcoded thresholds. Missing: automated due computation server-side, per-test default TAT, and a real due list.

### What Already Exists
* `tatHours` field on reports (set manually in the entry modal).
* Due-soon badge + sort in `TodaysReports` (thresholds hardcoded 2h/4h).

### What Is Missing
* Default TAT sourced from test or lab settings (defaults to 24h client-side).
* Server-computed due timestamps / due list (Phase 1 backend dependency).
* Emergency/urgent TAT variants.

### Frontend Screens Required
* Countdown display in the worklist (Phase 1); TAT defaults in test editor (Phase 16).

### Frontend Components Required
* `TatCountdown`, `DueBadge` (thresholds configurable).

### Existing Routes
`/lab/reports`.

### Existing APIs
* `GET /api/reports/today` (includes `tatHours`)

### Required Backend APIs
* `GET /api/reports/due` (Phase 1) *(does not exist)*.
* Default-TAT config endpoint *(does not exist)* — see Phase 16.

### Data Required From Backend
* `tatHours`, registration time, status per report; per-test default TAT.

### User Actions
* View countdowns, sort by due, open overdue reports first.

### Validation Requirements
* `tatHours > 0`; overdue reports highlighted (visual only).

### Permission Requirements
* Reports permission.

### UI States
* On-time, due-soon, overdue (distinct colors).

### Dependencies
Phase 1 (worklist), Phase 16 (config).

### Production Requirements
* Time computations must use a single timezone convention (lab local time) consistently.

### Notes for Implementing Engineer
* The 2h/4h thresholds are hardcoded in `TodaysReports.jsx` — move to settings when Phase 16 lands.

---

# Phase 7 — SMS / Email / WhatsApp Delivery

### Priority
Critical.

### Current Status
**Partial.** Send UI exists (Send modal with patient/doctors/cc/bcc/whatsapp, single & bulk; SMS templates screen at `/lab/settings/notifications`). Backend has a generic `POST /api/notify/send`. Missing: actual per-report delivery status, failure visibility, history, and retry.

### What Already Exists
* `NotificationContext` with `sendSms/sendEmail/sendWhatsApp/sendBulkSms`.
* `POST /api/notify/send` (admin) with template-based sms/email/whatsapp.
* SMS template editor (`/lab/settings/notifications`), report-share action, View Bill page send buttons.
* WhatsApp patient toggle saved to lab profile (`whatsappReportsEnabled`).

### What Is Missing
* Per-report delivery status (Sent / Failed) in the UI — the frontend does not read any status back.
* Delivery history per report; failed-send list.
* Retry for failed sends (ties to Phase 27).

### Frontend Screens Required
* Delivery status column/panel in report detail; failed-sends list (ties to Phase 27).

### Frontend Components Required
* `DeliveryStatusBadge`, `ResendButton`.

### Existing Routes
`/lab/reports`, `/lab/settings/notifications`, `/view/bill/:token`.

### Existing APIs
* `POST /api/notify/send`

### Required Backend APIs
* `GET /api/reports/:id/delivery-status` *(does not exist)*.
* `POST /api/notify/retry/:id` *(does not exist)*.
* WhatsApp provider integration *(backend has no provider integration beyond the generic send API)*.

### Data Required From Backend
* Per-report notification records (channel, status, timestamp, error).

### User Actions
* Send report/bill, view status, retry failed sends.

### Validation Requirements
* At least one recipient/channel selected before send.

### Permission Requirements
* Reports/delivery permission.

### UI States
* Sending, sent, failed (with error), retried.

### Dependencies
Phase 1 (send from worklist), Phase 27 (retry dashboard).

### Production Requirements
* A failed send must never silently succeed in the UI — surface the backend response.

### Notes for Implementing Engineer
* `sendSms` etc. currently fire-and-forget; capture and store the response for status display.
* Hardcoded-data finding: the SMS preview in `TodaysReports.jsx` hardcodes `lab: 'Pure Path Lab'` — source it from lab profile (Phase 24).

---

# Phase 8 — Printable Barcode Stickers

### Priority
Critical.

### Current Status
**Partial.** A bill barcode endpoint exists and `billService.getBillBarcodeUrl` is wired in billing. The generic public service exposes `fetchBarcodeSvgUrl` (defined, **never used**). No case-wise or sample-wise sticker printing exists.

### What Already Exists
* `GET /api/public/bill/:billNumber/barcode` (SVG) + `getBillBarcodeUrl`.
* `publicService.fetchBarcodeSvgUrl(type, value)` — unused; designed for arbitrary barcode values.

### What Is Missing
* Case barcode and sample barcode endpoints.
* Sticker print templates (label size, fields, multiple-per-sheet).
* Sticker print action anywhere in the UI.

### Frontend Screens Required
* “Print stickers” action in report/bill/collection screens; a sticker preview modal.

### Frontend Components Required
* `StickerPreview`, `BarcodeSvg` (consuming `fetchBarcodeSvgUrl`).

### Existing Routes
`/lab/reports`, billing screens.

### Existing APIs
* `GET /api/public/bill/:billNumber/barcode`

### Required Backend APIs
* `GET /api/public/case/:caseId/barcode` *(does not exist)*.
* `GET /api/public/sample/:sampleId/barcode` *(does not exist)*.

### Data Required From Backend
* Stable barcode values (registration number / sample ID) for cases and samples.

### User Actions
* Select reports, preview sticker, print.

### Validation Requirements
* At least one item selected; barcode value non-empty.

### Permission Requirements
* Reports permission.

### UI States
* Loading SVG, print error, empty selection.

### Dependencies
Phase 11 (label printing), Phase 23 (barcode configuration).

### Production Requirements
* Sticker layout must match physical label stock (configurable dimensions).

### Notes for Implementing Engineer
* Do not call case/sample barcode endpoints until they exist — the calls would 404. Wire the bill barcode first.

---

# Phase 9 — Rejection & Resend

### Priority
Critical.

### Current Status
**Missing.** The verify screen shows a “Reject” button, but it only clears local state; there is no rejection status, endpoint, list, or resend flow.

### What Already Exists
* Reject **UI affordance** in `VerifyReport.jsx` (non-functional).
* Sign flow (Phase 3) as the counterpart action.

### What Is Missing
* Rejected status + reason; rejected-reports list; resend-for-correction action; notification of rejection to the responsible technician.

### Frontend Screens Required
* Reject dialog (reason capture); “Rejected” tab/list in worklist; resend action.

### Frontend Components Required
* `RejectDialog`, `RejectionBanner`, `ResendButton`.

### Existing Routes
`/lab/verify`, `/lab/reports`.

### Existing APIs
* None (only the unused UI button).

### Required Backend APIs
* `POST /api/reports/:id/reject` *(does not exist)*.
* `GET /api/reports?status=Rejected` *(status does not exist in enum)*.
* `POST /api/reports/:id/resend` (return to technician) *(does not exist)*.

### Data Required From Backend
* Rejection reason, rejectedBy, rejectedAt; original author for redirect.

### User Actions
* Reject with mandatory reason; view rejected list; resend for correction.

### Validation Requirements
* Reason required (min length), cannot reject an already-rejected report.

### Permission Requirements
* Pathologist/`canSign` to reject; original technician to receive/resend.

### UI States
* Rejected (banner with reason), resubmitted, resolved.

### Dependencies
Phase 3 (verification).

### Production Requirements
* Rejection must be auditable (who/when/why) — depends on Phase 20 for full audit.

### Notes for Implementing Engineer
* Block frontend work until the backend endpoints exist; do not simulate rejection locally.

---

# Phase 10 — QR Code on Report

### Priority
Critical.

### Current Status
**Partial.** `GET /api/reports/:id/print` already returns `qrDataUrl` and `verificationUrl`, and the public route `/r/:token` exists for verification. The gap is that report print templates do not currently render `qrDataUrl`.

### What Already Exists
* `qrDataUrl` + `verificationUrl` in the print payload.
* Public verification route `/r/:token` (`PatientReportPortal`).

### What Is Missing
* QR rendering in the report print/PDF template (verify per template; wire if absent).

### Frontend Screens Required
* None new — template change only.

### Frontend Components Required
* `QrBlock` in the report print template.

### Existing Routes
`/r/:token`, print views.

### Existing APIs
* `GET /api/reports/:id/print` (includes `qrDataUrl`)
* `GET /api/public/report/:token`

### Required Backend APIs
* None.

### Data Required From Backend
* `qrDataUrl` (already provided).

### User Actions
* Scan → open verification URL.

### Validation Requirements
* QR must encode the verification URL, not internal IDs.

### Permission Requirements
* None (printed artifact) / reports permission to print.

### UI States
* QR present; fallback to plain URL text if image fails.

### Dependencies
Phase 4 (preview/print).

### Production Requirements
* QR must survive PDF rendering (vector/PNG, correct size).

### Notes for Implementing Engineer
* This phase is likely near-complete; verify each print template and wire `qrDataUrl` where missing.

---

# Phase 11 — Label Printing

### Priority
Critical.

### Current Status
**Partial.** Bill barcode printing works; generic label printing (case/sample labels) does not exist, and `fetchBarcodeSvgUrl` is unused.

### What Already Exists
* Bill barcode URL + billing print flow.
* `fetchBarcodeSvgUrl` helper (unused).

### What Is Missing
* Label templates (patient label, sample label, case label) and a label-print action.
* Case/sample barcode endpoints (same gap as Phase 8).

### Frontend Screens Required
* Label preview/print modal from collection and report screens.

### Frontend Components Required
* `LabelTemplate`, `LabelPrintSheet`.

### Existing Routes
`/lab/reports`, billing.

### Existing APIs
* `GET /api/public/bill/:billNumber/barcode`

### Required Backend APIs
* Case/sample barcode + label endpoints *(do not exist)*.

### Data Required From Backend
* Patient name/age/sex, registration number, test list, date for label fields.

### User Actions
* Select items → preview labels → print.

### Validation Requirements
* Truncate long names to label width; require registration number.

### Permission Requirements
* Reports permission.

### UI States
* Preview, printing, error.

### Dependencies
Phase 8.

### Production Requirements
* Label dimensions configurable (label printer stock).

### Notes for Implementing Engineer
* Bill labels can ship first (endpoint exists); case/sample labels are blocked on backend.

---

# Phase 12 — Smart Test Suggestions (autocomplete)

### Priority
High.

### Current Status
**Partial.** Native datalists and plain selects are used for test selection; no unified, debounced, keyboard-navigable combobox; test-search UX is inconsistent between Test Database, booking, and packages.

### What Already Exists
* `GET /api/tests?search=` (server-side search) and `testService.getTests`.
* Native `<datalist>` in some forms.

### What Is Missing
* Shared debounced combobox component (code, name, department, price grouping); recent/frequent test shortcuts.

### Frontend Screens Required
* None new — component reused in booking, test DB, packages.

### Frontend Components Required
* `TestCombobox` (debounce, keyboard nav, grouping, “create new” shortcut).

### Existing Routes
`/lab/test-database`, booking/new-bill screens, package screens.

### Existing APIs
* `GET /api/tests?search=`

### Required Backend APIs
* None.

### Data Required From Backend
* Tests with code, name, department, rate, panel membership.

### User Actions
* Type → suggestions → select; create test inline.

### Validation Requirements
* Duplicate-test warning on inline create.

### Permission Requirements
* Varies by screen (tests management to create).

### UI States
* Idle, loading, no-results, error.

### Dependencies
None.

### Production Requirements
* Debounce ≥ 250ms; cancel in-flight requests on keystroke.

### Notes for Implementing Engineer
* Keep existing datalists working until the combobox replaces them screen-by-screen.

---

# Phase 13 — Radiologist / USG Technician Workflow

### Priority
High.

### Current Status
**Partial.** USG cases, my-cases view (`/lab/usg/my-cases`), create-case, and a print-preview modal exist. Missing: department/case filtering for “my cases”, image upload UI (Phase 5), and a streamlined sign-off from the case list.

### What Already Exists
* `GET /api/usg/cases`, `GET /api/usg/my-cases`, `POST /api/usg/cases`, `POST /api/usg/cases/:id/sign`.
* USG print preview modal (`TodaysUSGCases.jsx`), read-only case view, department selector.

### What Is Missing
* Department-wise case filtering in “my cases” (department selector exists but list isn't filtered server-side).
* Image upload with progress (Phase 5) on case forms.
* Sign-off action directly from the case list.

### Frontend Screens Required
* Enhanced `/lab/usg/my-cases` (filters + inline sign).

### Frontend Components Required
* `CaseFilterBar`, `InlineSignButton`, `ImageUploader` (Phase 5).

### Existing Routes
`/lab/usg/cases`, `/lab/usg/my-cases`, `/lab/departments`.

### Existing APIs
* `GET /api/usg/cases`
* `GET /api/usg/my-cases`
* `POST /api/usg/cases`
* `POST /api/usg/cases/:id/sign`

### Required Backend APIs
* Department/assigned-to filter query params on `/api/usg/cases` *(not supported)*.

### Data Required From Backend
* Cases with assigned radiologist, department, image count, sign state.

### User Actions
* Filter cases, create case, upload images, sign off, preview print.

### Validation Requirements
* Cannot sign a case without required findings fields.

### Permission Requirements
* Radiologist/technician roles (enforced server-side).

### UI States
* List loading/empty/error; sign success/failure.

### Dependencies
Phase 5 (images), Phase 15 (signatures).

### Production Requirements
* Print preview must reflect final template (see hardcoded header note).

### Notes for Implementing Engineer
* Hardcoded-data finding: USG print preview hardcodes header (`2D / 3D / 4D ULTRASONOGRAPHY`) and signatory titles (“Consultant Radiologist”, “Sonologist”) around lines 302–340 of `TodaysUSGCases.jsx` — must come from lab profile/designation (Phase 24).

---

# Phase 14 — X-Ray Image Handling

### Priority
High.

### Current Status
**Partial.** X-ray cases list/create/sign and a print-preview modal exist (`XrayCases.jsx`), backend image upload exists — but there is **no X-ray print preview of the image** (USG has a print preview; X-ray's preview does not render an image pane) and no upload UI.

### What Already Exists
* `GET /api/xray/cases`, `POST /api/xray/cases`, `POST /api/xray/cases/:id/sign`, `GET /api/xray/my-cases`.
* Print preview modal (report text only).

### What Is Missing
* Image upload UI (Phase 5) on X-ray cases.
* Image rendering in X-ray print preview / report PDF.

### Frontend Screens Required
* `/lab/xray/cases` enhanced with uploader + image pane in preview.

### Frontend Components Required
* `ImageUploader`, `XrayImagePane` in print preview.

### Existing Routes
`/lab/xray/cases`, `/lab/xray/my-cases`, `/lab/xray/print-preview`.

### Existing APIs
* `POST /api/xray/cases/:id/images`
* `GET /api/xray/cases`

### Required Backend APIs
* None new (delete-image optional).

### Data Required From Backend
* Image URLs on case fetch (currently may not be returned — verify case payload).

### User Actions
* Upload images, view in preview, sign.

### Validation Requirements
* Image type/size checks (client-side).

### Permission Requirements
* Radiologist/assistant roles.

### UI States
* Upload states as Phase 5; preview with/without image.

### Dependencies
Phase 5.

### Production Requirements
* Image quality/size limits for report PDF (compression client-side if needed).

### Notes for Implementing Engineer
* USG preview and X-ray preview diverge — align them when implementing.

---

# Phase 15 — Multiple Signature Handling

### Priority
High.

### Current Status
**Partial.** Full signature CRUD exists (`/api/signatures`, assigned to departments) and reports store `signedBy/signedAt`. Missing: a signature **manager UI** (create/assign signatures), and selection of the correct signature per report/department at sign time (the sign modal currently picks from lab-profile pathologist fields).

### What Already Exists
* `GET/POST/PUT/DELETE /api/signatures` with `assignedDepartments`.
* Sign modal pathologist dropdown (from lab profile) + signature URL.

### What Is Missing
* Signature management screen (upload/preview/assign signatures).
* Signature auto-selection by report department at sign time.

### Frontend Screens Required
* `/settings/signatures` (new screen).

### Frontend Components Required
* `SignatureManager`, `SignaturePicker`.

### Existing Routes
`/lab/reports` (sign modal); no signature route exists yet.

### Existing APIs
* `GET /api/signatures`, `POST /api/signatures`, `PUT /api/signatures/:id`, `DELETE /api/signatures/:id`

### Required Backend APIs
* None (assignment already supported via `assignedDepartments`).

### Data Required From Backend
* Signature list with owner name, title, departments, URL.

### User Actions
* Create, preview, assign to departments, deactivate, delete; pick at sign time.

### Validation Requirements
* Image type/size; at least one active signature before signing.

### Permission Requirements
* Settings permission to manage; pathologist to use.

### UI States
* List/empty/loading; upload success/failure.

### Dependencies
Phase 3.

### Production Requirements
* Stored signatures must render in PDF at sufficient resolution.

### Notes for Implementing Engineer
* The pathologist dropdown in the sign modal currently reads lab profile fields (`pathologist1/2/3` etc.), not `/api/signatures` — reconcile during implementation.

---

# Phase 16 — TAT Configuration Screen

### Priority
High.

### Current Status
**Missing.** No settings screen for TAT; `tatHours` is typed manually per report; thresholds (2h/4h) hardcoded; per-test TAT field not exposed.

### What Already Exists
* Per-report `tatHours` manual field; per-test `tatHours` exists in the `Test` model.

### What Is Missing
* Settings screen: default TAT, per-test TAT, emergency/urgent TAT, due-soon thresholds.
* Backend default-TAT config storage.

### Frontend Screens Required
* `/settings/tat` (new).

### Frontend Components Required
* `TatDefaultsForm`, `TestTatTable`.

### Existing Routes
`/lab/settings` (index) — no TAT screen.

### Existing APIs
* `PUT /api/setup/lab-profile` (general settings save pattern to follow).

### Required Backend APIs
* Default TAT + threshold config endpoint *(does not exist)*; alternatively extend `Test.tatHours` handling (field exists).

### Data Required From Backend
* Current TAT defaults and thresholds.

### User Actions
* Edit defaults, set per-test TAT, save.

### Validation Requirements
* Positive integers; thresholds ordered (due-soon < urgent < default).

### Permission Requirements
* Settings permission.

### UI States
* Dirty/clean form, saving, success/failure.

### Dependencies
Phase 6.

### Production Requirements
* Changes must affect new reports only (do not retroactively change existing `tatHours` without explicit action).

### Notes for Implementing Engineer
* Per-test `tatHours` can be surfaced in the existing test editor (Phase 2) — no new backend needed for that part.

---

# Phase 17 — Accounts & Due Reports (collect, due, refund, void)

### Priority
High.

### Current Status
**Partial.** Ledger (collect/due/void + payment modes), due-report bill cards with links, cashbook, and pending/rate-changed reports all exist. Missing: department filter on the ledger, package discount entry in billing, real void reasons, bill edit and refund flows.

### What Already Exists
* `/business/accounts` — collect payment modal, due list with payment modes, void (with `POST /api/bills/:id/void`), tabs collect/due/paid, date-range search.
* `/business/due-reports` — due bill cards, share payment link, quick actions; constants for reference lists, 10% referral / 5% agent defaults, void placeholder text.
* Billing service with full bill CRUD and `getCashbook`.

### What Is Missing
* Department-wise filter on the ledger (department filter exists on due-reports' report list, **not** on the ledger itself — no server-side department filter either).
* Package discount handling in billing (the `packages` prop is passed to `BillingPage` but `getPanels` is never called — packages are effectively dead).
* Real void reason: frontend sends the hardcoded string `'Voided from ledger'` (the editable reason field in constants is never wired into the API call).
* Refunds and bill edits — no backend endpoints exist.

### Frontend Screens Required
* Enhanced `/business/accounts` (department filter, real void reason), package selector in billing.

### Frontend Components Required
* `PackageSelector` (wire `getPanels`), `VoidReasonDialog`, `DepartmentFilter`.

### Existing Routes
`/business/accounts`, `/business/due-reports`, `/lab/billing`, cashbook route.

### Existing APIs
* `POST /api/bills/:id/void`
* `GET /api/bills` (filters: dateRange, paymentStatus, search)
* `GET /api/bills/cashbook`
* `GET /api/departments`
* `GET /api/panels` (exists via billing service; unused by UI)

### Required Backend APIs
* `POST /api/bills/:id/refund` *(does not exist)*.
* `PUT /api/bills/:id` edit-after-payment *(does not exist)*.
* Department filter param on bill list/ledger *(not supported)*.

### Data Required From Backend
* Department on bill items; refund records.

### User Actions
* Collect payment (full/partial), mark due, void with reason, print, share link, filter by department.

### Validation Requirements
* Amount > 0 and ≤ due; payment mode required; void reason non-empty and sent to API.

### Permission Requirements
* `permissions.billing` (server: billing admin/superadmin).

### UI States
* Collecting, paid, due, voided (with reason), refunds.

### Dependencies
Phase 22 (packages/discounts), Phase 18 (cashbook).

### Production Requirements
* Void/refund must be auditable (Phase 20).

### Notes for Implementing Engineer
* Verified: `billingConstants.js` defines `DEFAULT_VOID_REASON = 'Voided from ledger'` and a richer editable reason list — the API call currently uses the former. Wire the latter.
* Verified: department filter does exist on the due-reports **report** table (`DueReports.jsx`); the claim that it's absent everywhere is wrong — the ledger lacks it.
* Out of scope: no SaaS payment/subscription features.

---

# Phase 18 — Cash Book

### Priority
High.

### Current Status
**Partial.** `GET /api/bills/cashbook` exists and a cashbook UI route/service method exist. Missing: transaction list presentation with filters (payment mode, type in/out), date-range summary, and manual cash-entry (no API).

### What Already Exists
* `billService.getCashbook` → `GET /api/bills/cashbook`.
* Cashbook route/page.

### What Is Missing
* Filterable transaction table (mode/type/date), summary cards, manual expense entries.

### Frontend Screens Required
* Enhanced cashbook page.

### Frontend Components Required
* `TransactionTable`, `CashSummaryCards`, `ModeFilter`.

### Existing Routes
Cashbook route under `/business` (see `AppRoutes.jsx`).

### Existing APIs
* `GET /api/bills/cashbook`

### Required Backend APIs
* Manual cash in/out entry endpoint *(does not exist)*.

### Data Required From Backend
* Transactions with mode, type, bill ref, user, timestamp.

### User Actions
* Filter, view summary, (later) add manual entry.

### Validation Requirements
* Date range start ≤ end.

### Permission Requirements
* Finance/billing permission.

### UI States
* Loading, empty, error.

### Dependencies
Phase 17.

### Production Requirements
* Totals must reconcile with bill collection totals for the same period.

### Notes for Implementing Engineer
* Verify the exact shape returned by `GET /api/bills/cashbook` before building filters — the frontend currently passes `payments`-style objects.

---

# Phase 19 — Employee Management

### Priority
High.

### Current Status
**Partial.** Employee list/create exist (`/api/users`, `POST /api/users` with employee-code generation, departments). Missing: richer profile fields (designation, qualification, joining date, documents), sessions view, and profile editing of those fields.

### What Already Exists
* `/employees` list with search + add-employee modal (name, email, phone, password, role, departments).
* `POST /api/users` (role, employeeCode auto-generated), `GET /api/users`, `PUT /api/users/:id` (admin), `POST /api/users/:id/reset-password`, deactivate/activate.
* Seed employee login with permission checkboxes (`EmployeeLogin.jsx`).

### What Is Missing
* Designation/qualification/joining-date/documents fields (model has `joinedOn`, `designation`, `department`; UI doesn't fully expose them).
* Active sessions view + revoke (no backend endpoints).
* Employee profile detail/edit screen.

### Frontend Screens Required
* Employee detail/edit route (e.g., `/employees/:id`), sessions panel.

### Frontend Components Required
* `EmployeeForm` (extended fields), `SessionsList`, `PermissionMatrix` (Phase 25).

### Existing Routes
`/employees`, employee login screen.

### Existing APIs
* `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `POST /api/users/:id/reset-password`, `POST /api/auth/login`.

### Required Backend APIs
* `GET /api/users/:id/sessions` *(does not exist)*.
* `POST /api/users/:id/revoke-sessions` *(does not exist)*.

### Data Required From Backend
* Full employee profile fields (model already stores them — ensure update endpoint accepts them).

### User Actions
* Create, edit, deactivate, reset password, view/revoke sessions.

### Validation Requirements
* Unique email/employee code; password rules; at least one department.

### Permission Requirements
* Superadmin/admin (server-enforced).

### UI States
* List/empty/error; form validation states.

### Dependencies
Phase 25 (permissions).

### Production Requirements
* Never display stored passwords; mask reset flows.

### Notes for Implementing Engineer
* `POST /api/users` accepts `role` and `departments`; confirm which profile fields `updateUser` whitelists before adding form fields.

---

# Phase 20 — Activity / Audit Log

### Priority
High.

### Current Status
**Missing.** No audit-log screen and no audit-log API.

### What Already Exists
* Actor identity available on most mutations (e.g., `signedBy`, bill `user`) — partial implicit trail.

### What Is Missing
* Centralized event log (who/what/when/where) with filters; backend capture middleware.

### Frontend Screens Required
* `/settings/audit-log` (new).

### Frontend Components Required
* `AuditTable`, `AuditFilters` (actor, action, date, entity).

### Existing Routes
`/lab/settings` (index) — no audit screen.

### Existing APIs
* None.

### Required Backend APIs
* `GET /api/audit-log?actor=&action=&from=&to=&entity=` *(does not exist)* + capture on mutations *(does not exist)*.

### Data Required From Backend
* Log entries: actor, role, action, entity type/id, before/after summary, timestamp, IP.

### User Actions
* Search/filter, export (Phase 26).

### Validation Requirements
* Date range; page size caps.

### Permission Requirements
* Superadmin/admin only.

### UI States
* Loading, empty, error, pagination.

### Dependencies
Phase 19 (actors).

### Production Requirements
* Log must be append-only from the UI perspective (no edit/delete actions).

### Notes for Implementing Engineer
* Blocked on backend; build the screen only after the endpoint exists.

---

# Phase 21 — Rate Revision

### Priority
High.

### Current Status
**Partial.** Individual rate updates exist (`PUT /api/tests/:id/rate` + a bulk rate update endpoint). Missing: a revision flow with effective date, before/after preview, and audit trail; package rate updates.

### What Already Exists
* `PUT /api/tests/:id/rate` (admin) and `PUT /api/tests/bulk-rate-update`.
* Rate display/edit UI in test database.

### What Is Missing
* Effective-dated revisions; preview of impact (N tests affected); package rate handling.

### Frontend Screens Required
* `/settings/rate-revision` (new) or a modal in test database.

### Frontend Components Required
* `RateRevisionWizard`, `ImpactPreview`.

### Existing Routes
`/lab/test-database`.

### Existing APIs
* `PUT /api/tests/:id/rate`
* `PUT /api/tests/bulk-rate-update`

### Required Backend APIs
* Effective-dated rate history endpoint *(does not exist)*; package rate update *(verify `/api/panels` update support — not confirmed)*.

### Data Required From Backend
* Current rates per test/panel; rate history if implemented.

### User Actions
* Select tests/percentage or absolute change → preview → apply.

### Validation Requirements
* Rate ≥ 0; change % bounded; confirmation before bulk apply.

### Permission Requirements
* Admin (server: `isAdmin` on rate endpoints).

### UI States
* Draft, previewed, applied, error.

### Dependencies
Phase 2 (test data quality).

### Production Requirements
* Bulk changes must be atomic and reported (success/failure counts).

### Notes for Implementing Engineer
* Confirm `PUT /api/tests/bulk-rate-update` payload shape from `backend/src/controllers` before wiring.

---

# Phase 22 — Discount / Package Handling

### Priority
Medium.

### Current Status
**Partial.** Panels/packages exist server-side (`/api/panels` with included tests, price, active), and billing accepts a `packages` prop — but `getPanels` is never called, so packages never reach the bill UI. Package price calculation in `BillingPage` exists but is fed no data.

### What Already Exists
* `GET /api/panels` via billing service (`getPanels` — unused by UI).
* `BillingPage` package price calculation + `packages` prop (empty).
* Line-item discount field in the billing constants/model (`discount` per item, `totalDiscount` per bill).

### What Is Missing
* Package selector UI wired to `getPanels`; combo-package indicators; custom discount entry at bill level; applying package price over item prices.
* Post-bill corrections (blocked — no bill edit endpoint; see Phase 17).

### Frontend Screens Required
* Package picker inside `/lab/billing`.

### Frontend Components Required
* `PackageSelector`, `DiscountRow`, `ComboIndicator`.

### Existing Routes
`/lab/billing`.

### Existing APIs
* `GET /api/panels` (exists in billing service)
* Bill create with `discounts` array (bill model supports it).

### Required Backend APIs
* Bill edit endpoint for post-bill package/discount corrections *(does not exist — Phase 17)*.

### Data Required From Backend
* Active panels with included test IDs and price.

### User Actions
* Pick package → items auto-added with package pricing → apply custom discount → validate totals.

### Validation Requirements
* `totalDiscount ≤ subtotal`; package price ≥ 0; item prices reconcile to package total.

### Permission Requirements
* Billing permission; discount limits by role if configured.

### UI States
* Package selected/cleared, discount applied, validation errors.

### Dependencies
Phase 17.

### Production Requirements
* Printed bill must show package and discount breakdown.

### Notes for Implementing Engineer
* Root cause: `BillingPage` receives `packages={packages}` but `packages` is never fetched — wire `getPanels` when implementing.

---

# Phase 23 — Registration Number Configuration

### Priority
Medium.

### Current Status
**Partial.** Lab profile settings allow editing only `caseStartNumber` (`PPL` prefix is hardcoded server-side in `generateRegistrationNumber.js`; format is `PREFIX-YYYYMMDD-000N`). No prefix, date-format, or barcode-format configuration.

### What Already Exists
* `caseStartNumber` field in `LabProfile.jsx` and accepted by `POST /api/setup/lab-profile`.
* `generateRegistrationNumber(caseStartNumber)` — prefix `PPL-` and date format hardcoded.

### What Is Missing
* Settings UI for prefix/format/next-number preview.
* Backend support for a configurable prefix and format.

### Frontend Screens Required
* Registration-number section inside `/setup/profile` (settings form).

### Frontend Components Required
* `RegNumberConfig` with live preview.

### Existing Routes
`/setup/profile`.

### Existing APIs
* `POST /api/setup/lab-profile` (accepts `caseStartNumber` only)

### Required Backend APIs
* Extend lab-profile to accept `registrationPrefix`, `dateFormat`, `barcodeFormat` *(not in allowed-keys list — gap)*.

### Data Required From Backend
* Current prefix/format + next number preview.

### User Actions
* Edit prefix/format, preview next registration number, save.

### Validation Requirements
* Prefix uppercase alphanumeric; no spaces; preview must show a valid sample.

### Permission Requirements
* Settings/admin.

### UI States
* Dirty form, preview, save states.

### Dependencies
Phases 1, 8 (barcodes embed the number).

### Production Requirements
* Changing prefix must not break lookup of historical numbers (both must remain searchable).

### Notes for Implementing Engineer
* The frontend already sends `registrationNumber` lab-profile values under different key names — verify key alignment with `setupController` allowed-keys (line ~23) when implementing.

---

# Phase 24 — Report Branding / White Labeling

### Priority
Medium.

### Current Status
**Partial.** Lab profile settings exist (`/setup/profile`) and print payloads include lab profile. The `LabProfile` model/allowed-keys lack website, registration number, disclaimer, and logo upload; hardcoded lab identity remains in several templates (see findings).

### What Already Exists
* `GET/POST /api/setup/lab-profile` with allowed key list (labName, address, contactEmail, contactPhone, whatsappNumber, registrationNumber, upiId, gstNumber, pathologists, sampleCollectionText, printHeader, invoiceFooter, whatsappReportsEnabled, smsReportsEnabled, caseStartNumber, …).
* Print endpoints inject lab profile.

### What Is Missing
* Fields: website, report registration number/disclaimer, logo upload.
* Removal of hardcoded identity from templates/SMS/landing content (documented below — do not delete without replacements).

**Hardcoded-data findings (document, do not remove until replaced):**
* Sidebar/logo/lab name hardcoded in layout components.
* `landingContent.js` — fake contact numbers/addresses on the landing page.
* USG print header + signatory titles hardcoded (`TodaysUSGCases.jsx:302–340`).
* SMS preview `lab: 'Pure Path Lab'` (`TodaysReports.jsx:219`).
* Invoice/report footer fallbacks in `DailyBusiness.jsx:82–83` (`daily-summary` fallback).

### Frontend Screens Required
* Extended `/setup/profile` branding tab (logo upload, website, disclaimer).

### Frontend Components Required
* `BrandingForm`, `LogoUploader`, `FooterDisclaimerEditor`.

### Existing Routes
`/setup/profile`.

### Existing APIs
* `GET /api/setup/lab-profile`
* `POST /api/setup/lab-profile`

### Required Backend APIs
* Accept `website`, `disclaimer`, `logoUrl` keys *(not in allowed list — gap)*.
* Logo upload endpoint *(does not exist)*.

### Data Required From Backend
* Full lab profile in print payloads (already largely present).

### User Actions
* Edit branding, upload logo, preview report header/footer, save.

### Validation Requirements
* URL format for website; image type/size for logo; required lab name/contact.

### Permission Requirements
* Settings/admin.

### UI States
* Dirty/saving/success/failure; logo upload progress.

### Dependencies
Phase 4 (preview), Phase 13 (USG header), Phase 7 (SMS lab name).

### Production Requirements
* Branding must flow to every printed/PDF/SMS artifact — audit each template during implementation.

### Notes for Implementing Engineer
* Key mismatch to verify: frontend sends `form.name` while backend expects `labName` (check `LabProfile.jsx` field mapping against `setupController` allowed keys).

---

# Phase 25 — Role / Permission Management

### Priority
Medium.

### Current Status
**Partial.** Backend defines granular permission keys (`billing, reports, rates, finance, settings, patients, delivery`) enforced by `permissionMiddleware`. Frontend **never reads `user.permissions`** (no UI gating by granular permission), and `EmployeeLogin` sends permissions as an **array** while the backend model stores a **Map of Boolean** — a shape mismatch to resolve.

### What Already Exists
* `User.permissions` (Map), `permissionMiddleware.can(...)` on financial routes.
* Permission checkboxes in the employee/seed login form (array payload).
* Role strings (assistant, technician, radiologist, admin, superadmin) used for coarse gating.

### What Is Missing
* Reading `user.permissions` to show/hide UI (frontend relies on role only).
* A permission-matrix management screen.
* Alignment of array-vs-map payload when creating/updating users.

### Frontend Screens Required
* Permission matrix inside employee edit (Phase 19).

### Frontend Components Required
* `PermissionMatrix`, `usePermission` hook.

### Existing Routes
`/employees`, employee login.

### Existing APIs
* `POST /api/users`, `PUT /api/users/:id` (permissions field)
* Login response includes `user` (verify `permissions` included).

### Required Backend APIs
* Ensure create/update accept the chosen permissions shape (Map) — frontend must send Map, not array *(contract fix required)*.

### Data Required From Backend
* `user.permissions` on session/user payloads.

### User Actions
* Toggle permissions per employee, save, verify UI reflects them.

### Validation Requirements
* Superadmin cannot have permissions stripped; at least one role retained.

### Permission Requirements
* Admin/superadmin to edit; users see only what their permissions allow.

### UI States
* Matrix states, save feedback, denied-action states (403 handling).

### Dependencies
Phase 19.

### Production Requirements
* UI hiding is cosmetic — server enforcement already exists; keep both aligned.

### Notes for Implementing Engineer
* Verified gap: no frontend file references `user.permissions`. Build `usePermission` first, then gate billing/rates/finance/settings screens.

---

# Phase 26 — Data Export Center

### Priority
Medium.

### Current Status
**Partial.** Export screen exists (`/lab/export`, dataset cards, date range, `exportService.exportCsv(dataset, dateRange)`) and the backend endpoint `GET /api/export/:dataset` exists. Missing: CSV streaming (endpoint returns JSON), export history, and per-dataset column mapping.

### What Already Exists
* `DataExport.jsx` with dataset cards (reports, bills, tests, patients, due…), date-range picker, progress bar UI, `exportService.exportCsv`.

### What Is Missing
* True CSV response (`text/csv` / file download) or client-side CSV generation from JSON.
* Export history/audit of exports.

### Frontend Screens Required
* Existing `/lab/export` — wire actual download.

### Frontend Components Required
* `ExportProgress`, CSV serializer (client-side fallback).

### Existing Routes
`/lab/export`.

### Existing APIs
* `GET /api/export/:dataset`

### Required Backend APIs
* `GET /api/export/:dataset?format=csv` returning a CSV file *(current endpoint returns JSON — gap)*.
* Export history endpoint *(does not exist)*.

### Data Required From Backend
* Dataset rows with stable column sets.

### User Actions
* Pick dataset + range → preview count → download.

### Validation Requirements
* Range required; dataset must be in allowed list.

### Permission Requirements
* Admin (verify server-side gate on export route).

### UI States
* Idle, generating, success (download), error.

### Dependencies
None.

### Production Requirements
* Large exports must stream or paginate — avoid loading entire datasets into memory in the browser.

### Notes for Implementing Engineer
* Until the backend returns CSV, generate CSV client-side from the JSON response (keep the same column order).

---

# Phase 27 — Failed Job / Retry Dashboard

### Priority
Medium.

### Current Status
**Missing.** No job/queue concept exists in backend or frontend; notification failures are invisible (Phase 7).

### What Already Exists
* Notification send actions (fire-and-forget) that could enqueue jobs.

### What Is Missing
* Job records (type, status, error, attempts), retry endpoint, dashboard.

### Frontend Screens Required
* `/settings/jobs` or `/business/jobs` (new).

### Frontend Components Required
* `JobTable`, `RetryButton`, `JobStatusBadge`.

### Existing Routes
None.

### Existing APIs
* `POST /api/notify/send` (the job source).

### Required Backend APIs
* `GET /api/jobs?status=failed`, `POST /api/jobs/:id/retry` *(both do not exist)*.

### Data Required From Backend
* Job records with payload summary, error, attempts, timestamps.

### User Actions
* View failed jobs, inspect error, retry, mark resolved.

### Validation Requirements
* Retry only on failed jobs; max attempts surfaced.

### Permission Requirements
* Admin/settings.

### UI States
* Empty (no failures), loading, failed list, retrying.

### Dependencies
Phase 7 (notifications).

### Production Requirements
* Retries must be idempotent (server-side dedupe by job id).

### Notes for Implementing Engineer
* Blocked on backend queue design; do not fabricate job data.

---

# Phase 28 — Test Usage & Reorder Analytics

### Priority
Medium.

### Current Status
**Missing.** No analytics screen; no test-analysis endpoint.

### What Already Exists
* Business dashboards (`DailyBusiness`, `BusinessAnalysis`) with sales/booking analytics — adjacent but not test-usage oriented.
* Tests + bills data that would feed the analysis.

### What Is Missing
* Test frequency, slowest-moving stock/consumables, suggested reorder quantities; UI with charts/tables.

### Frontend Screens Required
* `/analytics/test-usage` (new).

### Frontend Components Required
* `UsageTable`, `ReorderSuggestList`.

### Existing Routes
`/business/business-analysis` (adjacent).

### Existing APIs
* `GET /api/reports/today`, `GET /api/bills` (raw data only).

### Required Backend APIs
* `GET /api/analysis/test-usage?from=&to=` *(does not exist)*.

### Data Required From Backend
* Aggregated test counts, revenue per test, stock levels (if inventory exists — currently not modeled).

### User Actions
* Filter date range, sort by usage, export (Phase 26).

### Validation Requirements
* Range required; empty-period handling.

### Permission Requirements
* Finance/admin.

### UI States
* Loading, empty, error.

### Dependencies
Phase 26 (export).

### Production Requirements
* Aggregations must be computed server-side (do not scan all reports client-side).

### Notes for Implementing Engineer
* Inventory/reorder can only be fully real if backend models stock — currently no inventory model exists; scope accordingly.

---

# Phase 29 — Doctor Portal (online booking)

### Priority
Optional — **OPTIONAL / FUTURE**.

### Current Status
**Existing (minimal).** Routes for doctor-facing pages exist (`/doctor`, `/doctor/book`, `/doctor/appointments`) along with a complete `/api/doctor` router (doctor auth/register/login, appointments CRUD with slot checks, bills, reports). Not part of the core single-lab roadmap; no work required.

### What Already Exists
* Doctor routes + `DoctorPortal`/`DoctorBooking`/`DoctorAppointments` pages.
* Backend: doctor register/login, appointment create/update/cancel with slot availability, doctor bills/reports endpoints.

### What Is Missing
* Optional polish only (UI consistency, notifications). No core gaps identified.

### Frontend Screens Required
* None required.

### Frontend Components Required
* None required.

### Existing Routes
`/doctor`, `/doctor/book`, `/doctor/appointments`.

### Existing APIs
* `POST /api/doctor/register`, `POST /api/doctor/login`, `GET/POST /api/appointments` (doctor-scoped), `GET /api/doctor/bills`, `GET /api/doctor/reports`.

### Required Backend APIs
* None for core scope.

### Data Required From Backend
* Already available.

### User Actions
* Doctor registers, books slots, views appointments/bills/reports.

### Validation Requirements
* Slot conflict checks exist server-side.

### Permission Requirements
* Doctor auth (JWT).

### UI States
* Existing states.

### Dependencies
None.

### Production Requirements
* Only if this phase is activated later.

### Notes for Implementing Engineer
* Marked **OPTIONAL / FUTURE** — do not schedule in the core roadmap.

---

# Phase 30 — Online Booking

### Priority
Optional — **OPTIONAL / FUTURE**.

### Current Status
**Partial (existing).** Public appointment booking exists on the landing page and via doctor booking routes; backend supports appointment creation with slot availability. Core roadmap does not require further work.

### What Already Exists
* Landing-page appointment modal → `POST /api/appointments`; slot availability check server-side; appointment list at `/lab/appointments`.

### What Is Missing
* Optional: public slot calendar, cancellation notifications.

### Frontend Screens Required
* None required for core scope.

### Frontend Components Required
* Optional `SlotCalendar`.

### Existing Routes
`/`, `/lab/appointments`.

### Existing APIs
* `POST /api/appointments`, `GET /api/appointments`, `GET /api/appointments/stats`.

### Required Backend APIs
* None for core scope.

### Data Required From Backend
* Slot grid data.

### User Actions
* Book, view, cancel appointments.

### Validation Requirements
* Existing server-side slot checks.

### Permission Requirements
* Public for booking; staff for management.

### UI States
* Existing.

### Dependencies
Phase 29.

### Production Requirements
* Only if activated later.

### Notes for Implementing Engineer
* **OPTIONAL / FUTURE.**

---

# Phase 31 — Support Ticketing

### Priority
Optional — **OPTIONAL / FUTURE**.

### Current Status
**Existing (minimal).** A `/support` route and full `/api/tickets` router (list/create/detail/comment/close) exist, plus `pages/support/Subscription.jsx` (SaaS artifact — **out of scope**, not a feature to build).

### What Already Exists
* Support page + ticket service with list/create/comment/close.

### What Is Missing
* Nothing required for core scope; optional admin ticket list screen if needed later.

### Frontend Screens Required
* None required.

### Frontend Components Required
* None required.

### Existing Routes
`/support`.

### Existing APIs
* `GET/POST /api/tickets`, `GET /api/tickets/:id`, `POST /api/tickets/:id/comments`, `PATCH /api/tickets/:id/status`.

### Required Backend APIs
* None for core scope.

### Data Required From Backend
* Available.

### User Actions
* Create/view/comment on tickets.

### Validation Requirements
* Subject/body required (verify server).

### Permission Requirements
* Auth for ticket APIs.

### UI States
* Existing.

### Dependencies
None.

### Production Requirements
* Only if activated later.

### Notes for Implementing Engineer
* **OPTIONAL / FUTURE.** The subscription screen under support is a SaaS artifact — flag, do not extend.

---

# Phase 32 — Multi-Branch

### Priority
Optional — **OPTIONAL / FUTURE** (out of scope for a single-lab product).

### Current Status
**Existing (minimal) — but conceptually out of scope.** Backend has `/api/modality` with `ModalityCases` (department-scoped cases with sign-off and images) and frontend `/lab/modality/cases`; `User` has a `branch` field. True multi-branch/multi-tenant operation does not exist and **should not be built** (single-lab product; no SaaS multi-tenancy).

### What Already Exists
* `/api/modality` router (cases, my-cases, sign-off, images) + `ModalityCases` page.
* `branch` field on `User`.

### What Is Missing
* Nothing to implement for core scope. Branch entity, branch-scoped data, and cross-branch reporting are intentionally not planned.

### Frontend Screens Required
* None.

### Frontend Components Required
* None.

### Existing Routes
`/lab/modality/cases`.

### Existing APIs
* `GET/POST /api/modality/cases`, `POST /api/modality/cases/:id/sign-off`, `POST /api/modality/cases/:id/images`.

### Required Backend APIs
* None (do not build branch/multi-tenant APIs).

### Data Required From Backend
* N/A.

### User Actions
* Modality case entry/sign-off (existing single-site behavior).

### Validation Requirements
* Existing.

### Permission Requirements
* Technician/radiologist roles.

### UI States
* Existing.

### Dependencies
Phases 5, 13, 14 (shares image/sign-off patterns).

### Production Requirements
* None beyond current single-site operation.

### Notes for Implementing Engineer
* **OPTIONAL / FUTURE.** Explicitly excluded: multi-tenancy, branch subscription/billing, per-branch paywalls — SaaS concepts out of scope.

---

## Verification

Run after producing/altering this document:

```bash
git status
git diff --stat
git diff
```

Expected result: the only change in the repository is this file (`FRONTEND_FEATURES_TO_IMPLEMENT.md`). No source files, routes, APIs, hooks, styles, or data files were modified.
