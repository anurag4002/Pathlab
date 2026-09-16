# Supplement: Hidden + Paywalled Pages (Missed in v1)
**Date:** 2026-09-16 | **Method:** Full `<a href>` enumeration (58 URLs under `/73136222`) + authenticated visit of each unseen URL + `frontend/backend` grep.
**Enumeration result:** 58 unique links. v1 covered ~22. This supplement covers the remaining ~20: 9 Setup steps, Support, Profile/Account/Subscription/Plans, Test Categories detail, Test Panels detail, USG/Xray paywalls, Activities paywall, Lab counts/Receipts/Referrers tails.

---

## 24. Setup shell (all 9 steps share this chrome)
**Labsmart:** `Setup Guide | KYC | Center details | Ratelist | Letterhead | Google review | SMS | Case reg. no. | Panels | Proofread | [Skip setup][Prev][Next]`.
**Ours:** `pages/setup/LabProfile.jsx` (single page: name/phone/email/address + Google Review Link + Case Start Number + toggles SMS/WhatsApp/Email/Letterhead-default + Logo/Letterhead upload) + `backend/constants/onboarding.js` (13-step list: verify-email, centre-profile, letterhead, rates, normals, users, browser-code, sms-setup, signature, first-bill, first-report) + `setupRoutes (/lab-profile, /onboarding, /signatures, /browsers)`. No 9-step wizard UI, no Skip/Prev/Next, no per-step videos.
**Gap:** ⚠️ Backend ~60%, frontend wizard ❌. **To-do:** 9-step wizard shell reusing LabProfile + Ratelist + Panels + Proofread components.

## 25. KYC `/onboarding/kyc`
**Labsmart exact:** `Ownership verification details: Lab owner name, Lab owner mobile (+91), Lab name, Lab address | No documents uploaded yet. Allowed Documents | Upload files [Update] | More details: Previous software, Per day patient count (0-5/5-10/10-20/20-30/30-50/50-100/100-300/300-500) [Update]`.
**Ours:** None (no KYC model/route/UI).
**Gap:** ❌. **To-do:** `Kyc {ownerName, ownerPhone, labName, address, docs[], prevSoftware, perDayCount}` + upload + Admin review flag.

## 26. Centre Details `/onboarding/centre_details`
**Labsmart exact:** `* Name | Case types (13 checkboxes): Lab/Usg/DigitalXray/Xray/Outsource/Ecg/CtScan/Mri/Eps/Opg/Cardiology/Eeg/Mammo | Centre phone | Address 1/2 | City | Postal code | State (36-state dropdown, default Uttar Pradesh) [Update] | Note: details print on bills; phone used in welcome SMS | Country: India, Currency: Rs., Timezone: New Delhi (locked)`.
**Ours:** `LabProfile.jsx` (name/phone/email/address only) + `LabProfile.js (showLetterheadByDefault)`. No case-type checkboxes, no address2/city/pin/state, no locked country/currency/tz note.
**Gap:** ⚠️ 30%. **To-do:** extend LabProfile with address2/city/postal/state + enabledCaseTypes[13] + read-only IN/Rs./Asia-Kolkata note.

## 27. Ratelist `/ratelists/default?status=active`
**Labsmart exact:** Tabs `Lab/USG/Digital X-ray/X-ray/Outsource Lab/ECG/CT Scan/MRI/EPS/OPG/Cardiology/EEG/Mammography` (13), `Bulk update revenue share by %`, `Download CSV | Add New | Print ratelist`, `Use TAB to change rates one by one`, `Active 295 | Inactive 0`, `Tests | Packages | Panels | Bill only` sub-tabs, rows `NAME | ENTRY TYPE (Test/Panel/Package) | FEE | REVENUE SHARE AMOUNT | FOR GENDER (Both/Male/Female/Other radio) | Remove` — 100s of rows (ABG/ADA/AEC/AFB/AFP/A-G…).
**Ours:** Test DB/Panels/Packages pages separate; no unified Ratelist, no 13 tabs, no bulk-% update, no CSV download/print, no Active/Inactive counts, no revenue-share, no Bill-only tab.
**Gap:** ❌ Unified Ratelist module (biggest setup gap). **To-do:** `RatelistEntry {scope13, entryType, fee, revenueShare, gender, active}` + bulk-% + CSV + print + counts.

## 28. Letterhead `/onboarding/letterhead`
**Labsmart exact:** `Watch Video | (jpeg/jpg/png) | Letterhead PDF | Don't have one? Labsmart Letterhead Generator App! | Header height cm | Footer height cm | More setting | ✓ A4 aspect check (Header 4.60cm Footer 3.40cm) | Notes: record settings to restore; JPG from printer/designer ~100kb; measure with cm scale; A4 21×29.7cm resized 1000×1414px max 400kb`.
**Ours:** `LabProfile` letterhead upload + `showLetterheadByDefault` + `setupController.uploadLetterhead` + `BillPrintPreview letterhead checkbox`. No header/footer cm, no aspect check, no size guidance, no Generator link, no PDF preview.
**Gap:** ⚠️ 40%. **To-do:** `letterheadHeaderCm/FooterCm` fields + client aspect/size validation + PDF preview.

## 29. Google Review `/onboarding/build_google_review` (PAYWALLED — Advanced)
**Labsmart exact:** `Advanced feature | Get more business by building Google reviews | Watch tutorial | Bring lab on top of Google search | Build positives, reduce negative impact | [Start free trial]`.
**Ours:** `LabProfile.googleReviewLink` + `pages/delivery/Reviews.jsx` (Credit Balance + Review Requests stats, Send Review Request name/phone, Topup Credits modal, Clicked/Reviewed marking, Credit History) + `ReviewRequest.js` + `notifyController` (requires link set). Actually ahead on credits UI; missing tutorial + Advanced gate + WhatsApp send copy.
**Gap:** ⚠️ 60% — add `Advanced` gate + tutorial video slot + `googleReviewLink` required validation. Price: part of Advanced plan (no separate addon price shown; cf. Change-plan page).

## 30. SMS `/onboarding/sms_setting`
**Labsmart exact:** `SMS 20p/credit. Buy credits from SMS credits page. | How it works? | Transactional, pre-approved templates, DND-safe incl. 12am, TRAI brand-name (Labsmart) anti-spam | Send welcome sms [HP-LABSMT]: "Welcome to LAL SHREE LAB. Please save for any enquiries. --LabSmart Software" | Send bill sms: "Hello, Your Reg.no REG_NO You paid FEE_PAID, Total Fee: TOTAL_FEE Balance: BALANCE - From LAL SHREE LAB" | Send report-ready: "Your report is ready. Kindly collect from lab/centre." [Update]`.
**Ours:** `LabProfile smsEnabled/whatsappEnabled/emailEnabled/smsSenderId` + notify infra (console-only sender). No template editor with REG_NO/FEE_PAID variables, no HP-LABSMT header display, no TRAI explainer, no credits-page link.
**Gap:** ⚠️ 35%. **To-do:** `SmsTemplate {welcome/bill/ready, header, body with vars}` + preview + Update + credits link + 20p note.

## 31. Case Reg No `/onboarding/sample_tracking` (labelled “Case reg. no.” in nav)
**Labsmart exact:** `Reg. no. alias | Set reg. no. starting point | Current starting point is 1001 | Use UHID (toggle)`.
**Ours:** `LabProfile.caseStartNumber` (number input) only. No alias, no current-value display, no UHID toggle.
**Gap:** ⚠️ 40%. **To-do:** `regNoAlias + currentRegNo (read-only) + useUhid` fields.

## 32. Panels onboarding `/lab_test_panels?layout=onboarding` + `/lab_test_panels` detail
**Labsmart exact (captured):** `Add new | How to reorder?` grid `ORDER | NAME | CATEGORY | TESTS | RATELIST ENTRIES` — e.g. 1. CBC (Haem, 14 tests: Hb/TLC/DLC/Platelet/RBC/Hct/MCV/MCH/MCHC/MPV/RDW-SD/CV/P-LCR/PDW; used in CBC+GBP, CBC) … 15. Torch (9 tests)… each `Edit | View`. Nudge `Manage entire panels from a single page`.
**Ours:** `TestPanels.jsx` (Panel Name/Included code chips/Price/Status; modal name/price/checkbox grid/desc/status). No ORDER, no CATEGORY col, no RATELIST ENTRIES usage list, no reorder, no View.
**Gap:** ⚠️ 55%. **To-do:** `order` field + drag reorder + category col + usage (packages/ratelist) col + View drawer.

## 33. Proofread `/onboarding/proofread`
**Labsmart exact:** `Select category: Haem/Biochem/Sero/ClinPath/Cyto/Micro/Endo/Histo/Others/Misc | IMPORTANT: verify/update normals | Haematology tests` — per-test `Edit normal values` with M/F + age bands, e.g. Hb `M/F 17-23 (0D-21D), 11.2-16.5 (21D-10Y), M 13-17 (10Y-120Y), F 12-15…`; TLC/DLC/Absolute/ESR/Platelet/AEC/BT-CT/RBC/Hct/MCV/MCH/MCHC/MPV/Retic/G6PD/PT-APTT/WBC/P-LCR/RDW/PDW/RBC Indices/Platelet Indices/DLC-3Parts… (full age-banded table).
**Ours:** `Test.js male/femaleReferenceRange` single-range; `onboarding.js` has `normals` step but no proofread UI.
**Gap:** ❌ Age-banded normals engine + proofread grid. **To-do P0:** `ReferenceRange {sex, ageMin/Max+unit, low/high}` + proofread matrix UI + `proofread:boolean` gate before go-live.

## 34. Support `/support` (+ `?source=`)
**Labsmart exact:** `Free telephonic + Google Meet screen-share. Mon-Fri 10:30-17:30. Ticket mandatory. [RAISE A SUPPORT TICKET] | Guaranteed support: Get call back | Google meet | Request support | Timings + holidays note | Customer Support Policy | 6 tiles (Issues/Feedbacks/Feature requests/Demo/Online Session/Training — each count 0 + History + CTA: Report issue / Share feedback / Request feature / Request demo / Request session / Request training) | Have complaint? support@labsmartlis.com | Download remote desktop: Rustdesk/Ultraviewer (desktop only, give address; no phone) | Support access: Allow support access (limited staff, revoke after) | Troubleshooting guide [Read] | Support ticket history: No tickets.`
**Ours:** `supportRoutes (/tickets, /subscription/plan, /subscription/refund)` + `Tickets.jsx` + `Subscription.jsx` + nav `Tickets|Subscription`. No 6-tile taxonomy, no Meet/callback buttons, no Rustdesk/Ultraviewer block, no support-access toggle, no complaint email, no troubleshooting guide, no policy link.
**Gap:** ⚠️ 35%. **To-do:** ticket `category` enum (6) + Meet/callback actions + remote-desktop help block + `allowSupportAccess` toggle + guide/policy links.

## 35. Account / Subscription / Plans (paywall hub)
**Labsmart exact pages:**
- `/diagnostic_labs/account`: `Lab account | Subscription details | SMS credits | Invoices | Annual Subscription | Your current plan is…`
- `/diagnostic_labs/change_plan`: `6 months | yearly | Billing only (20% off)` toggle; `PATHOLOGY BASIC ₹4,999+GST/yr (registration, Lab/Xray/USG/CT/MRI/ECG billing, panels/packages, business+lab reports, SMS/Email/WA, QR, support, 12,000 bills)`; `ADVANCED ₹7,499 (Basic + Review builder, multi-login, fraud prevention, permissions, activity, browser security, 12k)`; `PREMIUM ₹5,999 1st purchase (₹9,999 renew) (Adv + Expense, Doctor portal, Business+Test-count analysis, Data export, 20k)`; `Add-ons: USG Rs.4,800/yr (Rs.3,000 half-yr), Digital X-ray same. Talk to sales.`
- `/select_plan`, `/plan_trials/choose`, `/subscription_preferences`, `/profile` (My account), `/home/permitted_browser` exist (shell verified).
- Addon paywalls (all `…/addons/show?addon_code=…&redirect_path=…` + `[Add to trial]`): `activity_tracking Rs.999+GST/12mo`, `business_test_count_analysis Rs.1,299+GST`, `data_export Rs.1,299+GST`, `usg_reporting Rs.4,800+GST`, `digital_xray_reporting Rs.4,800+GST`, `expenses Rs.799/12mo` (view-free/add-gated), `google review` (Advanced-gated, no separate price).
**Ours:** `supportController (subscription/plans/refund)` + `Subscription.jsx` + `getSubscription/changePlan/requestRefund` + `DashboardPage Manage subscription` link. No plan-cards UI parity, no 6mo/yearly/Bill-only toggle, no addon catalogue with prices, no trial banners, no fair-use (12k/20k) or 200/day enforcement, no invoices/SMS-credits tabs.
**Gap:** ⚠️ 30%. **To-do:** Plan catalogue UI (3 cards + addons 4) + billing-period toggle + `[Add to trial]` pattern + enforcement middleware + Invoices + SMS-credits ledger link.

## 36. Remaining master tails (verified reachable, content = shell/nav only via fetch)
- `/interpretations` (200, no paywall — needs snapshot for grid detail; ours `Interpretations.jsx` exists).
- `/lab_test_counts?date_range` (200 — needs snapshot; ours `TestCounts.jsx` stat-cards only, no date-range param).
- `/usg_cases`, `/digital_xray_cases` (search lists — paywalled same as today: Rs.4,800).
- `/usg_signatures`, `/digital_xray_signatures` (both paywalled Rs.4,800 — confirms Signatures are addon-only; ours has no signature CRUD yet → build `Signature` model).
- `/receipts`, `/referrers` (200 — Transactions/ReferralDoctors parity already scored).
- `/doctor_accesses/access_granted|revoked` (tabs of Invited hub — ours no tabs).
- `/migrations/ms_word`, `/migrations/offline_software` (dashboard links — new: migration guides; ours none → docs-only).

---

## Revised totals
- **New pages discovered:** 20. **Paywalled (addon) confirmations:** 7 codes with prices (999 / 1,299×2 / 4,800×2 / 799 + Advanced-gated review).
- **Ours ahead of v1 assumption:** LabProfile/onboarding constants/setupRoutes/signatures/browsers/tickets/subscription/Reviews-credits already scaffolded (~30-60% per area) — upgrade those rows from ❌ to ⚠️.
- **Still zero:** KYC, unified Ratelist, age-banded proofread, support 6-tiles + remote-desktop + access-toggle, plan catalogue + enforcement, signatures CRUD UI, USG/Xray gated flows.
