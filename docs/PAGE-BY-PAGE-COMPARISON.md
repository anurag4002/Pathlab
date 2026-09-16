# Page-by-Page Comparison: Labsmart vs Pure Path Lab

**Date:** 2026-09-16 | **Tenant audited:** 73136222 (owner login) | **Method:** Authenticated Chromium snapshot + in-page `innerText` per URL + `frontend/` code inspection **Legend:** ✅ Done | ⚠️ Partial | ❌ Missing. File evidence in `()`.

Global Labsmart chrome (all pages): top `Search any bills, reports` with `Search by: Reg.no / First name / Mobile / UHID` + `Duration: Last 7 / 30 / 90 days / All`, `Help`, `Setup (KYC, Center details, Ratelist, Letterhead, Google review, SMS, Case reg.no., Panels, Proofread)`, `Watch Video`, user menu (My today's total Cash/UPI/Card/Insurance + count, My account, Lab account, Setup new lab, Email prefs, Logout), promo `Sept Deal ₹3,100+GST / 7-day money-back`, trial `ends in 5 days [Change plan][Buy now]`, `Lab > Test Panels` nudge, `Get Support Offline`.

Our app has none of that global chrome: only `?search=` invoice free-text, no search-by selector, no duration, no Setup wizard, no trial banners.

---

## 1. Dashboard `/{tenantId}` → `/dashboard`

**Labsmart:** Getting-started video (YouTube `wCY2A8z86Dk`), migration links (MS Word / Offline SW), Employee logins / Browser security / Doctor portal shortcuts, `Payments due (For all time)`, `Recent transactions (For today)`, `Recent activities (Advanced upsell [Start free trial])`, `SMS Credits: 100`, RM card (Ashu Pandey MSc MLT + WhatsApp + hours), `Browser code: 4FF4`, Terms/Privacy/Refund buttons. **Ours (**`features/dashboard/pages/DashboardPage.jsx` **+** `dashboardService.summary`**):** Hero welcome + stats + recent txns + quick actions. Real data. **Gap:** ❌ No video/migration/RM/credits/browser-code widgets; ❌ No dues-for-all-time vs today split; ❌ No activity upsell pattern. **To-do:** add widget grid + credits ledger + RM config + video links.

## 2. Getting Started `/getting_started` → (none)

**Labsmart:** `Welcome Pratyush Mishra!`, `Go-live Checklist 9%` — 11 items each with Watch video: create account, verify email (`Verify now`), billing print + centre + reg-start-no, daily business calc, edit/print reports, send online (WA/SMS/Email), proofread normals (`Proofread`), ratelist/DB, report formats, referral print, help ticket (photo/video, 10:30–17:30 Mon–Fri). **Ours:** No checklist component (`DashboardPage.jsx:55` Hero only). **Gap:** ❌ Entire module. **To-do:** `OnboardingProgress` model + checklist UI + Verify-email + Setup links.

## 3. Daily Business `/business_reports/daily_business` → `/business/daily`

**Labsmart exact:** Tabs `Business Report | Monthly Overview (BETA)`, buttons `Print | Email`, `Today` picker, KPIs `Total Income / Total collection charge (+How collection charges work?) / Expenses / Net income` + `Date - 11:48 PM, 16/09/2026`, `Total income split Cash/Card/UPI/Insurance`, counters `Transactions / Bills / Expenses / Previous day bills`, `Add cashier`, grid `ID | REG.NO. | PATIENT NAME | REFERRED BY | DATE | TIME | DCN | CC | AMOUNT | METHOD | RECEIVED BY` + `Total income: Rs.0`. **Ours (**`DailyBusiness.jsx`**):** Start/End DatePicker + in-page search; tabs Transactions/Bills/Expenses with counts; `Add Cashier → alert('simulated')`; cols Tx(ID Ref/Patient/DateTime/Method/ReceivedBy/Amount), Bills(BillNo/Patient/Date/Gross/Paid/Due/Status), Expenses(Date/Category/Desc/Method/Amount). Net formula ✅, split ✅. **Gap:** ❌ <mark data-color="#57b35b66" style="background-color: rgba(87, 179, 91, 0.4); color: inherit;">Print, ❌ Email, ❌ Monthly Overview BETA, ❌ Today shortcut + timestamp, ❌ How-charges explainer, ❌ Previous-day-bills counter, ❌ Cashier-wise (mock), ❌ DCN/CC cols, ❌ case-wise split here, ❌ URL/date-share. </mark>**To-do P0:** Print/Email (window.print + nodemailer), Monthly Overview tab, cashier model + filter, DCN/CC fields, previous-day query.

## 4. Expenses `/expenses` → `/business/expenses`

**Labsmart exact:** `Premium feature BETA`, `Have feedback? share here`, buttons `Export | Manage categories`, upsell `You can now only view past expenses, adding new is PREMIUM. Rs.799/12mo [Add to trial] [WhatsApp RM]`, `How expenses work?`, `Select month Jan–Dec + Select year 2018–2027`, tabs `Expenses | Analysis`, `Add new | Filters`, cols `SPENT ON | NAME | AMOUNT | CATEGORY | MODE | ADDED BY | ADDED ON | NOTES`, `Records in page: 0/0`. **Ours (**`Expenses.jsx`**):** Summary `Gross Operating Costs + Top 3 Categories`; table `Voucher Date/Category/Description/Paid via/Amount/Actions(Edit/Delete)`; `Record Expense` modal (Category from `EXPENSE_CATEGORIES`, Amount/Date/Method/Desc). Real CRUD. **<mark data-color="#4a9ee866" style="background-color: rgba(74, 158, 232, 0.4); color: inherit;">Gap:</mark>**<mark data-color="#4a9ee866" style="background-color: rgba(74, 158, 232, 0.4); color: inherit;"> ❌ Export, ❌ Manage categories (ours hardcoded const, theirs CRUD), ❌ Month/Year selectors (ours no filter), ❌ Analysis tab, ❌ Filters button, ❌ SPENT ON/ADDED BY/ADDED ON/NOTES cols, ❌ Premium gating + addon pricing, ❌ feedback link. </mark>**To-do:** ExpenseCategory CRUD + month/year filter + Analysis tab + Export CSV + columns migration.

## 5. Case-wise `/case_wise_business_report/new` → `/business/cases`

**Labsmart exact:** `Exclude cancelled cases` checkbox, `Collection centre: Main`, `On` (date toggle), `Case types` 13 checkboxes: `LabCase, UsgCase, DigitalXrayCase, XrayCase, OutsourceLabCase, EcgCase, CtScanCase, MriCase, EpsCase, OpgCase, CardiologyCase, EegCase, MammographyCase`. **Ours (**`CaseWiseReport.jsx`**):** From/To DatePicker + `Search by invoice` + paginate 10; cols `Invoice Ref/Patient Reg Code/Name/Age-Gender/Referred By/Registered Date/Gross/Status`. No actions. **<mark data-color="#ff8c0066" style="background-color: rgba(255, 140, 0, 0.4); color: inherit;">Gap:</mark>**<mark data-color="#ff8c0066" style="background-color: rgba(255, 140, 0, 0.4); color: inherit;"> ❌ Exclude-cancelled, ❌ Centre filter, ❌ All 13 case-type filters (core ask), ❌ Print/Email/Export. </mark>**<mark data-color="#ff8c0066" style="background-color: rgba(255, 140, 0, 0.4); color: inherit;">To-do:</mark>**<mark data-color="#ff8c0066" style="background-color: rgba(255, 140, 0, 0.4); color: inherit;"> Bill needs </mark>`caseType + collectionCentre + cancelled + uhid + dailyCaseNo`<mark data-color="#ff8c0066" style="background-color: rgba(255, 140, 0, 0.4); color: inherit;"> fields; filter bar with 13 checkboxes + centre + exclude-cancelled; result grid must show type/centre.</mark>

## 6. Referral Business `/referrer_wise.../summary` → `/business/referrals`

**Labsmart exact:** `Watch Video`, `Referreral doctor wise report`, `Download cases data`, `Filter by period: Today/Yesterday/Last Week/September/August/July/Custom`, `Print`, cols `S.NO. | REFERRER ID | NAME | CONTACT | TOTAL CASES | CASES (PATIENTS) IN FILTER`, `PRINT BUSINESS`. **Ours (**`ReferralBusiness.jsx`**):** From/To only; cols `Doctor/Hospital/Commission %/Gross Bills/Share payable/Case Details`; `View Cases → modal Date/Patient/BillNo/Total/Commission`. **Gap:** ❌ Period presets + month names + Custom, ❌ Download cases data, ❌ Print + Print Business, ❌ Referrer ID/Contact/Total vs In-filter split. **To-do:** period preset bar + download CSV + print stylesheet.

## 7. Business Analysis `/business_analysis/monthly_business_overview` → `/business/analysis`

**Labsmart:** Gated addon — `Add Business & test count analysis to trial! Rs.1,299+18% GST/12mo [Add to trial]`. **Ours (**`BusinessAnalysis.jsx`**):** Ungated; `Revenue Trends (Last 6 Months)` + `Operating Margin Split` CSS bars via `getSummary/getMonthlyTrends/getDailyBusiness`. **Gap:** ⚠️ Data ✅ but viz mock-grade, no gating, no test-count analysis, no monthly overview table. **To-do:** charts lib + TestCount tab + premium gate.

## 8. Data Export `/data_exports/new` → `/business/export`

**Labsmart:** Gated `Rs.1,299+GST/12mo [Add to trial]`; windows marketed: Bills 31d, Patients 365d, Txns 31d, TAT 31d, Expenses 365d, Report PDF links 31d. **Ours (**`DataExport.jsx:triggerCSVDownload` **limit 500):** 3 cards `Invoices / Patients / Expenses (CSV)` client-side, no filters/windows. **Gap:** ❌ Server export, ❌ windows enforcement, ❌ TAT + PDF-links datasets, ❌ Email/WhatsApp share, ❌ gating. **To-do:** server jobs + window params.

## 9. Bills List `/cases` → `/cases/bills`

**Labsmart exact filters:** `Duration: Past 7 days`, `Reg.no.`, `Patient first name`, `Referred by: ID:1, Self`, `Collection centre: Main`, `Sample collection agent`, `Has due` toggle, `Cancelled` toggle, `Search | Clear`. Grid `REG.NO. | DATE | PATIENT | REFERRED BY | TOTAL | PAID | DISCOUNT | STATUS | ACTIONS`. Empty `Add new case`. **Ours (**`BillsPage.jsx` **+** `BILL_TABLE_HEADERS`**):** `All Payment Statuses (Paid/Partial/Pending)` + `Search by invoice`; `?search=` URL prefill; cols `BillNo/Patient/Total/Paid/Due/Status/Date/Actions`; row `Print + conditional Pay`. **Gap:** ❌ Past-7-days + duration, ❌ Reg-no/first-name/referrer/centre/agent split filters, ❌ Has-due/Cancelled toggles, ❌ Discount column, ❌ Clear. Partial URL filtering only. **To-do:** filter bar parity + Bill fields (`collectionCentre, agent, cancelled, uhid`).

## 10. New Bill `/cases/new` → `BillCreateForm`

**Labsmart exact:** §1 Mobile +91, Title\* 24 options (Mr/Mrs/Smt/Kumari/Shri/Miss/Master/Mohd/Baby/Baby of/Wife of/Mother of/Son of/Daughter of/Ms/Miss-Mrs/Selvi/Sk/PROF/Dr/Child/Md/Mx), First\* / Last, Sex\* M/F/Other, Age\* Y/M/D, `Online report requested`, expanders Email/Address/Aadhaar/History; §2 Referred By\* (Self), Collection centre\* (Main), Agent + Add/Edit + Manage referrers; modality tabs 12: LAB/USG/DIGITAL XRAY/XRAY/OUTSOURCE/ECG/CT/MRI/EPS/OPG/CARDIOLOGY/EEG/MAMMO; Payment Total auto, Discount + % toggle, Received spin, Balance auto, `Accept Due`, Mode cash/upi/card/insurance, Remarks, `Create + Settings`; `Courtesy limit 200/day`; barcode+QR; tamper-proof (auto datetime, immutable reg-no, staff link). **Ours:** PatientDetailsSection (Existing/New, phone/title/name/gender/age YMD, +Email/Address/Aadhaar/History toggles) + Case Details (Referred +Add Doctor, Agent +Add Agent, DepartmentSelector LAB, Tests picker) + Items + PaymentSummary (subtotal/discount%/paid/method/remarks/total/due). Math ✅. **Gap:** ❌ 12-tab modalities (only LAB/USG/XRAY filter works, else `[]`), ❌ Title list parity check, ❌ Online-report flag → delivery hookup, ❌ Discount-% toggle + Accept Due action, ❌ Settings (print) , ❌ 200/day guard, ❌ barcode/QR gen, ❌ immutable reg-no enforcement. **To-do P0.**

## 11. Patients `/patients` → `/cases/patients`

**Labsmart exact filters:** `UHID`, `First name`, `Last name`, `Mobile number`, `ID`, `From/To`, `Search | Clear`. Grid `ID | NAME | ADDRESS | MOBILE | REGISTERED ON`. **Ours (**`PatientsPage.jsx`**):** `Search by name, phone or reg no` + paginate; `?add=true` opens create; cols `RegNo/Name/Age/Gender/Phone/Referred By/Actions(Details/Edit/Delete)`. **Gap:** ❌ UHID/ID/From-To split + Clear, ❌ Address + Registered-On columns (ours Age/Gender instead). **To-do:** Patient `uhid` field + advanced filter bar.

## 12. Outsource `/outsource_lab_cases` + CT `/ctscan_cases` → (none)

**Labsmart:** Both lists `Reg no. | Date | Patient | Investigations | Status`. **Ours:** No routes/models. Only billing tag. **Gap:** ❌ Two modules. **To-do:** Generic `ModalityCase` or `OutsourceCase/CtCase` CRUD + status workflow (mirrors USG/Xray).

## 13. Transactions `/receipts` → `/cases/transactions`

**Labsmart:** Part of daily grid (see §3) + global search. **Ours (**`Transactions.jsx`**):** `Filter by Type (Income/Refund/Expense) + Method (Cash/Card/UPI/Insurance) + Search patient` + paginate; cols `DateTime/Patient/Related Invoice/Amount/Mode/Received By`. **Gap:** ⚠️ Ours actually richer filters; missing ❌ date/centre filter + Print/Export. Minor.

## 14. Referrers `/referrers` + Agents `/sample_collectors` → `/cases/doctors|agents`

**Labsmart Referrers:** managed via New-bill `Manage referrers`; Doctor portal invite model (see §20). **Ours:** Full CRUD + commission % — ✅ parity for basic. Missing ❌ Referrer ID/contact columns in business view, ❌ invite linkage.

## 15. Lab Today's `/lab_reports/today` → `/lab/reports`

**Labsmart:** `Reports for today`, `Recent changes`, `Go to`, `Stats`, `Sort: Oldest/Recent`, counters `All/New/In progress/Final/Signed off/Printed x/y`, empty `Add new case`. **Ours (**`TodaysReports.jsx`**):** No date/sort/counters/URL params; `getReports({registrationNumber:''})`; cols `RegNo/Patient/BillNo/Test/Completed Date/Uploader/Actions(Upload/Download/Delete)`. **Gap:** ❌ State machine (ours file-upload only, no New→Signed), ❌ sort/counters/stats, ❌ Print/Email. **To-do:** Report `status` enum + TAT + result entry (see §21).

## 16. Lab Search `/lab_reports` → `/lab/search`

**Labsmart advanced URL-based filtering (user-flagged):** `Duration: Past 7 days`, `Patient first name`, `Status: New/In progress/Final/Signed off`, `Referred by (Self)`, `Reg.no.`, `Daily case no.`, `UHID`, `Show all filters`, `Search | Clear`, `Select test` (200+ dropdown: LDH … Hemoglobin list captured), grid `REG.NO. | DATE/TIME | PATIENT | REFERRED BY | TESTS | CC | STATUS | ACTIONS`. **Ours (**`SearchReports.jsx`**):** Single debounced `registrationNumber` box; cols `RegNo/Patient/Invoice/Test/Completed/Actions(Download)`. No URL params/Print/Email. **Gap:** ❌ All 8 filters + test dropdown + CC column + Clear + shareable URLs. This is the biggest lab gap. **To-do P0:** filter bar component + query-param sync (`?status&regNo&uhid&test&from&to`) + CC field.

## 17. Test DB `/lab_tests` → `/lab/tests`

**Labsmart:** `Add new | Import`, `proofread reference range` warning, `Filter by category: All/Haem/Biochem/Sero/ClinPath/Cyto/Micro/Endo/Histo/Others/Misc`, `ProTip: Select category to order`, cols `ORDER | NAME | TEST TYPE (Single/Multi/Document) | SHORT NAME | CATEGORY | Edit/view`. 50+ rows verified. **Ours (**`TestDatabase.jsx`**):** `Search by name/code`; cols `Code/Name/Category/Sample/Unit/Price/Status/Actions`; modal Code/Name/Category/Sample/Unit/Price/3 ranges/Desc/Interp/Status. **Gap:** ❌ Import, ❌ Order field, ❌ Test Type + Short Name cols, ❌ category-order tip, ❌ proofread flag. **To-do:** add `order/shortName/testType` + import CSV + proofread boolean.

## 18. Packages `/test_packages` → `/lab/packages`

**Labsmart exact:** `Add new | How it works? | Watch Video`, counters `In ratelist 20 / Not in ratelist 0`, grid `S.NO. | NAME | FEE | FOR GENDER | INCLUDED TESTS AND PANELS | ACTION(Edit)` — 17 rows (Anemia/Antenatal/Arthritis/BOH/CBC+GBP/Cardiac/Diabetic/Dialysis/Fever/Fitness/Full-body M-F/HB-TLC-DLC/Pregnancy/Preop/Electrolyte…) all Rs.100 Both. **Ours (**`TestPackages.jsx`**):** Same as Panels + `Applicable Gender (All/Male/Female)`; checkbox grid; no counters/videos. **Gap:** ❌ In/Not-in-ratelist counters, ❌ How-it-works + video, ❌ Fee vs Price label, ❌ ratelist linkage toggle. **To-do:** `inRatelist` flag + counters.

## 19. Panels `/lab_test_panels` + Categories `/lab_test_categories` + Counts `/lab_test_counts`

**Labsmart:** Single-page panel manager nudge; package rows show included panels. **Ours:** `TestPanels` (Panel Name/Included code chips/Price/Status), `TestCategories` IS category mgmt (Add Category; Name/Desc/Actions) ✅, `TestCounts` (StatCards Active Tests/Today Bills/Outstanding + Category list + Summary). **Gap:** ⚠️ Mostly ✅; missing ❌ panel single-page bulk edit, ❌ test-count date-range param (`?lab_test_count[date_range]`), ❌ Export.

## 20. USG `/usg_*` + Xray `/digital_xray_*` → `/usg/*` + `/xray/*`

**Labsmart:** `Today's cases | Search cases | Report templates | Signatures` per modality; templates + signatures are **paid addons**: `Add USG reporting Rs.4,800+18% GST/12mo [Add to trial]` (same Xray). Trial tenant blocked. **Ours:** USG Today (hardcoded today, cols Date/RegNo/Patient/Doctor/Template/Status/Actions Findings-Edit + Print with hardcoded `Dr. Anil Mehta` + window.print), Search (name only), Templates read-only (`Template Name/Default Findings`), no Signatures UI. Xray Today (cols Date/RegNo/Patient/Doctor/Status/Download/Action) + FileUploader jpg/png/pdf, Search name-only, `XrayReports` auto-Completed. **Gap:** ❌ Template create/edit/duplicate + rich editor + Word-paste + HTML, ❌ Signatures CRUD + auto-place, ❌ addon gating, ❌ Print parity for Xray. **To-do:** TipTap editor + Signature model + gating.

## 21. Cross-cutting: Results/Formula/TAT/E-sign/Delivery (affects Lab + Bills)

**Labsmart:** Result entry (tech types values, normals prefilled), 30+ auto-calcs (CBC/KFT/LFT/Lipid/PT-eAG/Iron/ACR), abnormal checker, gender/age template restrictions, TAT 4 dates, method/instrument/interpretation print, font/spacing/show-hide, letterhead on/off + margins, E-sign (tech+doctor), QR on report, WA/SMS/Email 1-click + auto SMS (Welcome/Bill/Ready @20p, 100 credits, DND route). **Ours:** `Report.js {patient,bill,test,fileUrl*,reportDate,uploadedBy,status Pending/Completed}` — file-upload only; `generateReport.js:44` hardcodes `AUTHORIZED SIGNATORY`; no deps (`qrcode/jsbarcode/pdfkit/nodemailer/twilio` absent). **Gap:** ❌ All. **To-do P0 (largest epic):** migrate Report → `{results[], flags, tat{}, signatures[], qrToken, status New→Signed}` + `formulaService` + QR/barcode + PDF + notificationService + credits.

## 22. Manage: Employees `/users`, Browser `/web_browsers`, Doctor `/doctor_accesses/invited`

**Labsmart Employees:** `New/Existing, Active 1 / Blocked 0`, `S.NO. | NAME | MOBILE | STATUS | EMAIL | STATUS | REG.ON | PERMISSIONS | ACTIONS`, owner full, `Configure Permissions` per role. **Ours (**`EmployeeLogin.jsx`**):** `Search name/email`; `Name/Email/Role/Status/Actions(Edit/Delete)`; role toggle Employee/Admin only. **Gap:** ❌ Mobile/RegOn/Permissions cols, ❌ Active/Blocked tabs, ❌ granular matrix. **Labsmart Browser exact:** Tabs `DASHBOARD | MANAGE BROWSERS`, `Beta`, `Control browser access. Block browsers not in lab`, `Security is off [Turn on security]`, `All browsers Filter`, `Pratyush Mishra's browser, Last login 16 Sep 26 11:06 PM, Browser code: 4FF4 [Block] [Current browser]`. **Ours (**`BrowserSecurity.jsx`**):** Cards `1 Session Active / SSL Secure`; table Auth-filtered `Access Date/User/Role/IP(Session ID from _id+localhost)/Action`. Read-only mock. **Gap:** ❌ On/off enforcement, ❌ Block/Allow, ❌ code display, ❌ Manage tab. **Labsmart Doctor exact:** `BETA`, `Invite limit: 5 doctors - Upgrade to premium`, `Grant live access… same login as labs`, `ID:1, Self [Invite]`, tabs `Invited | Access Granted | Access Revoked`, grid `S.NO. | ID | REFERRER | ADDRESS | INVITED ON | RESEND | DELETE`. **Ours (**`DoctorAccess.jsx`**):** Doctor-role CRUD, same `/login`+dashboard, no portal/invite/limit/tabs. **Gap:** ❌ Invite flow + 5-limit + tabs + Resend/Delete + separate portal.

## 23. Commercial gating (Change plan / Addons)

**Labsmart:** Trial banners everywhere; addons: Expenses Rs.799/12mo, Data export Rs.1,299, Business analysis Rs.1,299, USG/Xray Rs.4,800 each; Sept deal Rs.3,100+GST; fair-use 12k/20k; 7-day refund; 200/day courtesy. **Ours:** No Plan/Subscription/Addon models, routes, or UI. **Gap:** ❌ Entire monetization layer. **To-do:** Plan/Subscription/Credit models + `[Add to trial]` pattern + enforcement middleware.

---

## Priority Fix List (user-flagged first)

1. **Lab advanced filtering** (§16) + Bills filtering (§9) + Patients filtering (§11) — one reusable `AdvancedFilterBar` with URL sync.
2. **Case-wise 13 types + centre + exclude-cancelled** (§5).
3. **Daily Print/Email + Monthly Overview BETA** (§3).
4. **Expenses Export + Manage categories + Month/Year + Analysis** (§4).
5. **Outsource + CT cases modules** (§12).
6. Then §21 epic (formulas/QR/PDF/delivery), §22 (permissions/browser/doctor), §23 (plans).

*Evidence: snapshots 2026-09-16 18:09–18:48 UTC; local grep:* `cancelled|hasDue|collectionCentre|caseType|UHID|dailyCase|Past.?7|Manage.*categor` *→ 0 hits in listed pages.*