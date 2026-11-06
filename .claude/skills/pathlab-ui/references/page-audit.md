# Page audit - Pure Path Lab (Nov 2026)

Every staff screen reviewed at 1440×900 and 390×844 against `../SKILL.md`, with seeded data (`node e2e/page-shots.cjs`; phone: `W=390 H=844`). Screens are ordered by daily use. Section numbers (§) refer to SKILL.md.

Status markers: `[ ]` to do · `[x]` done · `[~]` partly done. When you change a screen, update its entry here.


## Progress (new look, Nov 2026)

The revamp ships behind the **Classic / New look** switch (user menu → "New look",
dashboard banner). Classic stays exactly as before; `[x]` on a B item means done in
the new look. Check with `node e2e/v2-flow.cjs` (new look) and
`node e2e/full-flow.cjs` (classic).

Round 3: short sentence-case page titles (PageHeader), developer subtitles and
notes hidden (`dev-note`), new bill (optional fields folded behind "+ Email"
chips, quiet ₹/% toggle, muted balance until there is a total), daily business
figures grouped.

Round 4-5: top-bar "New look" switch and `?ui=new` link; quiet delete buttons and "Not set" in every table; grouped figures on business and test screens; bill details side panel; sidebar "Daily work"; identity cells on USG, X-ray, transactions, cashbook, users, agents, referral doctors (age · sex on imaging); cashbook mismatch as a warning callout; empty USG/X-ray lists offer "Create case".

Not done (decided): scope dropdown instead of tabs (B6) - the status tabs read well and staff know them; pager footer on every list (B11) - lists that load all rows stay as they are.

Revamped so far: dashboard (key figures, quick actions, no setup card once billing),
bills, today's reports, result entry list, verification queue, patients, reviews,
dues - identity cell (age · sex always shown on clinical screens), one action + ⋯,
right-aligned money, filter strip with chips, phone cards.

---

## A. Bugs found during the audit

| \# | Where | Problem | Status |
| --- | --- | --- | --- |
| A1 | API `POST /bills` | Paid amount is not capped at the bill total (only the form checks it): ₹500 accepted on a ₹450 bill, which inflates collections and makes Dashboard / Monthly / Dues disagree | \[x\] server rejects payments above the bill total / amount due (Nov 2026) |
| A2 | /business/analysis | "7 days" shows ₹0 everywhere while today has collections (Cashbook, Daily, Dashboard show them) - date window query | \[x\] date-only windows now cover the whole IST day (`utils/dateRange`) |
| A3 | /business/cashbook | "Reconcile note: cash-in differs from ledger" shows when the totals match; also shown as bare red text, not a callout | \[x\] fixed; real mismatches show as a warning callout |
| A4 | /business/cases, /business/referrals | Table wider than its card at 1440px: last column cut off | \[ \] |
| A5 | /lab/export | Duplicate of /business/export; no sidebar item highlighted | \[ \] redirect to /business/export |
| A6 | /manage/branches | Created date in US format (9/24/2026); use the shared formatter | \[ \] |
| A7 | /settings/audit-log | Money as "INR 810"; use ₹ / `formatCurrency` | \[ \] |
| A8 | /settings/tat | Per-test TAT placeholder cut off ("Default (:") | \[ \] |
| A9 | /analytics/test-usage | "(1 orders)" - singular/plural | \[ \] |
| A10 | /doctor | Doctor portal shows the full staff sidebar (Business, Manage…) - check role scoping | \[ \] verify |
| A11 | /business/referrals (phone) | Print button icon renders as a grey dot | \[ \] |
| Data | doctors, templates, signatures, packages | Junk/test records in the catalog copy: phone numbers inside doctor names, "0000000000" phones, `autotest_*` templates, signature "dvcx", packages all ₹100, truncated test codes | \[ \] clean data (not code) |

---

## B. Cross-cutting fixes (do these once, every screen improves)

Ordered by how many daily screens they fix.

 1. **Row actions: one primary +** `⋯` (§2 Table). Bills has 8 controls perx no · bill no · phone, with `CopyButton`). Removes duplicate columns (reg no = bill no = invoice no today). Model already in the app: /lab/normal-ranges. Affects: bills, lab/reports, lab/result-entry, lab/search, lab/verification, patients, dues, reviews, transactions, cashbook, business/cases, agents, doctors, employees, templates, packages, panels, usg/*, xray/*. `[x]` new look: bills, today's reports, patients, reviews, dues; other lists keep their buttons but no solid red (quiet outlined delete)
 2. **Filters: search +** `Filter (n)` **+ removable chips** (§2) instead of permanent cards of labelled selects (Bills shows 7 + 11 hidden, Search Reports 6, Patients 6, Cases 13 checkboxes). One search box per screen (lab/search, lab/reports, usg/\* have two). On phone, "Filters (n more)" counts hidden fields, not active filters - must show active count. Build once in `AdvancedFilterBar` (chip mode) → every list. `[x]` new look: `AdvancedFilterBar` strip (Filters panel + chips) on every screen that uses it
 3. **Phone tables → stacked row cards under 600px** (§5.2). Today almost every list scrolls sideways and hides the action or amount: Dues (Collect hidden), Bills (Pay hidden), Reviews (Ask hidden), Cashbook / Transactions (Amount hidden), Result Entry, Verification. Build in `DataTable` (`mobileCard` render: identity line, key value, primary action). `[x]` new look: `DataTable` labelled cards under 640px on every list
 4. **Sentence-case headers and labels** (§1 Type): every table and tile uses ALL CAPS. One CSS change in `DataTable.css` / tile styles + label text cleanup. `[x]` new look (CSS)
 5. **Stat tiles grouped in one bordered card** (§2 Stat tiles) instead of floating cards with coloured icon squares (dashboard 6, monthly 10, analysis, test-usage, lab/counts, doctor; cashbook/daily float with no container). Build a `StatGroup` component; 2×2 on phone. `[x]` `StatGroup` + grouped figure cards (dashboard, dues, cashbook, daily, monthly, analysis, test counts/usage)
 6. **Scope dropdown instead of in-page tabs** (§2 Top bar): Today/Due/Pending, Not asked/Asked/All, Today's cases/All, modality buttons, date presets. Affects: lab/reports, reviews, usg/*, xray/*, cases/modality, business/analysis, daily, monthly, inquiries. `[ ]`
 7. **Remove developer wording** from staff screens ("5,000-row cap", "endpoint does not expose…", "Labsmart parity", "existing user API", "real API", "URL-based filtering", "completion date: pending"). Affects: daily, monthly, business/export, lab/export, lab/analysis, business/cases, referrals, lab/search, employees, onboarding, profile. `[x]` new look: developer subtitles hidden by `PageHeader`, notes marked `dev-note`; monthly copy rewritten
 8. **Empty values as muted italic** (§1): "N/A", "—", "-", "0000000000", "Migrated from Labsmart" → "No notes", "No unit", "Not set", "Unknown". Add `.cell-empty`. Affects: expenses, doctors, test-usage, normal-ranges, categories, lab/rates, lab/tests, rate-revision, signatures, security, profile. `[x]` new look: `DataTable` shows "N/A" / "—" / "-" cells as muted "Not set"
 9. **One accent per screen** (§1): two blue buttons on result-entry (Search + Upload), manage/doctors, business/export (4 solid blue), onboarding (blue hero + blue buttons); amber WhatsApp buttons on reviews. Live search removes most "Search" buttons. `[x]` new look: one primary per row on revamped screens; review button neutral; no solid red row buttons
10. **Right-side** `Drawer` (§2) for record view: bill details, patient details, report review, template/interpretation edit, agent/doctor history. Build once; open on row click; `?view=<id>` in the URL. `[~]` bill details open as a right-side panel (`Modal variant="drawer"`); other record views still dialogs
11. **Pager footer everywhere** (§2 Footer): missing on activities, dues, transactions, patients, doctors, templates, categories, packages, panels, reviews. `[ ]`
12. **Empty states with a call to action**: usg/today, xray/today, xray/reports, manage/doctors, support/tickets, inquiries, modality. `[~]` `DataTable emptyAction`; USG and X-ray empty lists offer "Create case"
13. **Sidebar: section labels instead of collapsible folders** (§2 Sidebar): group into Daily work (Dashboard, New bill, Bills, Today's reports, Result entry, Verification, Reviews) · Patients · Business · Imaging · Setup; /lab/analysis and /lab/counts sit under "Test Setup" though routes are /lab. `[x]` new look: "Daily work" section (Bills, Today's reports, Result entry, Verification, Patients, Dues) above the sections

---

## C. Screens - daily use: High

### /cases/bills/new - New bill

Purpose: register/pick patient, add tests, take payment, create invoice.

1. `[ ]` Collapse optional patient fields (Email, Aadhaar, Address, Symptoms) under "More details" so test search is visible on load.
2. `[x]` Create Invoice shows its keys (Ctrl B, Enter in payment fields).
3. `[ ]` "Balance due ₹0.00" in big green before anything is entered → muted until tests added.
4. `[ ]` Discount "%" toggle is a solid blue button → quiet ₹/% segmented control.
5. `[x]` "Back to Ledger" button → small "← Bills" link (new look). Title "New bill".
6. `[x]` New look checkout layout (user feedback: page must fit one screen, scrolling was "messy"): Patient | Referred by on one row; Add tests | Tests in this bill; payment bar pinned at the bottom (Total · + Add discount · Amount received now · Still to pay · Paid by · Create bill). Test list scrolls inside its box. A three-column version was tried and rejected as worse.
7. `[x]` Referred by (Doctor) and Collection agent always visible - the user said they are important. "+ New doctor / + New agent" add one in place (name + phone) without leaving the bill.
8. `[x]` Department filter is a small link in the "Add tests" header; Test/Package/Panel tabs gone (one search finds all).

### /cases/bills - Bills

Purpose: find bills; take payment, print, share, open results.

1. `[ ]` B1: one primary (Pay if due, else Results) + `⋯` - rows drop from \~107px to \~56px.
2. `[ ]` B3: 7 visible + 11 hidden filters → scope dropdown (All / Today / Due / Voided) + Filter (n) + chips.
3. `[ ]` B2: identity cell (patient bold; bill no · date sub-line; copy) - bill no first today.
4. `[ ]` "Bill paper size" select above filters → into the Print action / settings.
5. `[ ]` Row click opens Drawer (replaces the eye icon). Phone: only Bill/Patient/Total visible; Pay off-screen.

### /lab/reports - Today's reports

Purpose: track today's reports; print, send, edit, upload.

1. `[ ]` \~8 controls per row on 3 lines → `Edit results`/`Enter results` + `⋯` (no red delete per row).
2. `[ ]` Two tab groups + Department/Sort/Search → scope dropdown (Today/Due/Pending) + status chips; one search.
3. `[ ]` Reg no / name / bill no (reg = bill) → one identity cell with copy.
4. `[ ]` TAT "23h 59m left" over 3 lines → one line "On time · 23h 59m".
5. `[ ]` Status text + "Not sent" pill → StatusBadge + muted "Not sent" sub-line; drop ALL-CAPS and the vertical rule before Actions. Phone: tabs overflow; rows \~180px; Test/Status/Actions off-screen.

### /lab/result-entry - Result entry (case list)

Purpose: pick a pending case; enter or upload results.

1. `[ ]` Patient first as identity cell (initials, name, reg · age/sex); drop Invoice and Age/Gender columns.
2. `[ ]` Filter card with blue Search + Clear → live search + Filter (n); removes second blue button.
3. `[ ]` Items cut at "Compl…" → first item + "+4 more".
4. `[ ]` "In-house" on every row → show only "Outsourced" pill when it applies.
5. `[ ]` Action labels: sentence case ("Enter results"), consistent. Phone: name wraps, Items/Status/Action off-screen.

### /lab/verification - Result verification

Purpose: review reported results and sign off.

1. `[ ]` Filter card wraps ("To" alone on row 2) → Status chip (Reported) + Filter (n), single date-range control.
2. `[ ]` Reg no / Invoice / sub-line all "000018" → one identity cell.
3. `[ ]` TAT "&lt;1m" unclear → "Reported 2m ago".
4. `[ ]` Status badge identical on every row of a filtered view → show department instead.
5. `[ ]` Review opens the Drawer so the queue stays visible. Phone: Status/TAT/Review off-screen.

### /lab/search - Search reports

Purpose: find any past report; print or send it.

1. `[ ]` 6 permanent fields + "Show all filters" + second search → one search + Filter (n) + chips ("Past 7 days ×" default chip).
2. `[ ]` Subtitle "Advanced URL-based filtering…" → "Find any report by patient, date or reg no".
3. `[ ]` Print▾ + WhatsApp + PDF stacked, layout differs per row → Print + `⋯`.
4. `[ ]` Status plain text → StatusBadge; date "03:57 / pm" → time as sub-line.
5. `[ ]` "CC: Main" on every row → show only with &gt;1 branch. Phone: Tests/Status/Actions off-screen.

### /cases/patients - Patients

Purpose: find a patient, view history, edit.

1. `[ ]` 6 always-visible inputs duplicate the table search → one search + Filter (n) (Branch, Gender, Referred by).
2. `[ ]` Details / Edit / red Delete → row click opens Drawer; Edit visible; Delete in `⋯`.
3. `[ ]` Identity cell (initials, name, "000018 · phone" + copy).
4. `[ ]` "Referred by: Self" on every row → muted italic or drop.
5. `[ ]` Pager footer. Phone: Phone/Referred/Actions off-screen.

### /business/dues - Outstanding dues

Purpose: chase and collect unpaid balances.

1. `[ ]` Lone Department select in a tall card → Filter chip in toolbar.
2. `[ ]` Identity cell (name, phone · bill no); date only (no "03:57 / pm" wrap).
3. `[ ]` "Paid ₹0.00" green → muted; red only for Outstanding.
4. `[ ]` Total outstanding stat at top + pager footer. (Collect as single primary is good.) Phone: Collect off-screen - the screen's one job needs sideways scroll. (Totals disagree with Dashboard: see A1.)

### /business/cashbook - Cashbook

Purpose: day's cash in/out, reconcile before closing.

1. `[ ]` A3 reconcile note false positive; make it a warning callout.
2. `[ ]` From/To/Mode/Type + Search row → date scope + Filter (n); search in toolbar.
3. `[ ]` Stats float, red for ₹0.00 → grouped stat card; colour only when meaningful.
4. `[ ]` Income pill on every row, Card/UPI in status colours → plain text / neutral pill.
5. `[ ]` Patient identity cell with bill no sub-line + copy (drops "Bill ref"). Phone: Amount off-screen; stats take \~350px.

### /business/daily - Daily business

Purpose: end-of-day summary.

1. `[ ]` 3 header buttons (one 40 chars) → "Export CSV" + `⋯` (Print, Email summary).
2. `[ ]` Developer paragraph about the 5,000-row cap → tooltip or remove.
3. `[ ]` "Today / Share URL / 03:58 pm, 6/11/2026" → scope dropdown; drop timestamp.
4. `[ ]` 6 floating stats → grouped stat card.
5. `[x]` Charts redrawn full-width (Nov 2026). `[ ]` Payment-mode bars both 100% wide at 50% each → one stacked bar; hide the daily chart for a 1-day range. Phone: 3 header buttons stack full width.

### /dashboard - Dashboard

Purpose: today's overview, quick jumps.

1. `[ ]` 6 floating stat cards (4+2) → one grouped stat card, today first.
2. `[ ]` "Getting started 0/11" on a working lab → hide/dismiss.
3. `[ ]` 8 quick-action cards duplicate the sidebar → "Pending work" list (results to enter, to verify, dues).
4. `[ ]` Date pill looks like a button → muted subtitle. Phone: \~650px of tiles before anything actionable.

### /reviews - Google reviews

Purpose: ask billed patients for a review; track who was asked.

1. `[ ]` Amber "Ask on WhatsApp" + "Mark asked" per row → one primary + `⋯` (or auto-mark after sending).
2. `[ ]` Date first → identity cell (name, phone · bill no), date to the right.
3. `[ ]` "Not asked" column on the Not-asked tab → hide.
4. `[ ]` Tabs → scope dropdown; pager footer. Phone: Ask action off-screen.

### /usg/today, /usg/reports, /xray/today, /xray/reports - Imaging

Purpose: worklist and archive for USG / X-ray.

1. `[ ]` Two search boxes (USG) / inconsistent with X-ray → one table search on both.
2. `[ ]` Today/All segmented control → scope dropdown; hide From/To in Today scope.
3. `[ ]` Merge sidebar "Cases" + "Reports" (same component) into one item with scope.
4. `[ ]` Empty states with CTA ("Create USG case"); page-specific subtitles ("Archive" vs "enter findings" mismatch on X-ray).
5. `[ ]` Identity cell (reg no + name); ALL-CAPS headers; vertical rule before Actions. Phone: headers cut ("PATIENT NAI").

### /patient/report, /reports - Patient portal (consumer)

1. `[ ]` Sentence-case labels ("Mobile number", "Birth year"); drop the repeated bottom card.
2. `[ ]` Make /reports a redirect to one canonical URL. Phone: OK.

---

## D. Screens - daily use: Medium

- **/business/monthly** - `[ ]` 5 header buttons → "Export ▾"; `[ ]` 10 tiles → one stat card (Money / Counts); `[ ]` two developer paragraphs → tooltips; `[ ]` "November 2026" shown twice → compact month picker. (Figures: see A1.)
- **/business/analysis** - `[ ]` A2; `[ ]` segmented period card → header scope dropdown; `[ ]` grouped stats; `[ ]` collapse empty cards to one line.
- **/business/cases** - `[ ]` 13 raw-enum checkboxes ("CtScanCase") → Case type chip with human labels; `[ ]` A4 + drop duplicate reg-code column; `[ ]` identity cell; `[ ]` remove "Labsmart parity"; `[ ]` Print/Email/Export → one + `⋯`.
- **/business/referrals** - `[ ]` A4/A11; `[ ]` Period select + From/To duplicate → one scope dropdown (Custom reveals dates); `[ ]` 3 print buttons → "Export ▾"; `[ ]` remove "Labsmart parity".
- **/business/expenses** - `[ ]` Notes "N/A" bold → muted italic / hide; `[ ]` red trash per row → Edit + `⋯`; `[ ]` live search, no blue Search button; `[ ]` merge "Spent on"/"Added on".
- **/cases/transactions** - `[ ]` filters → chips + date scope; `[ ]` identity cell (drops Related invoice); `[ ]` neutral mode pills; amounts plain tabular; `[ ]` consider merging with Cashbook.
- **/cases/inquiries** - `[ ]` lone Status select → scope dropdown; `[ ]` empty state explains the portal source.
- **/cases/modality** - `[ ]` 9 ALL-CAPS modality buttons → scope dropdown "Modality / CT ▾"; `[ ]` stable title; `[ ]` empty-state CTA.
- **/lab/rates** - `[ ]` filters → chips; `[ ]` identity cell (type icon, name, code); `[ ]` right-align Rate; `[ ]` "—" → muted italic; `[ ]` default to Active, flag only Inactive.
- **/doctor** (doctor portal) - `[ ]` A10; `[ ]` grouped tiles; `[ ]` 3 stacked tables → tabs on one table.

## E. Screens - daily use: Low (setup)

- **/lab/tests** - `[ ]` name first, code + range as sub-line; `[ ]` "N/A" unit → "No unit"; `[ ]` Edit + `⋯`; `[ ]` title "Tests".
- **/lab/panels, /lab/packages** - `[ ]` raw truncated code chips (25 per row, \~180px rows) → "25 tests" + first 3 names, full list in Drawer; `[ ]` identity cell with test count; `[ ]` Edit + `⋯`.
- **/lab/categories** - `[ ]` "Migrated from Labsmart" → muted; add test count per category; `[ ]` 24px icon buttons → 40px touch targets.
- **/lab/normal-ranges** - good identity cell (model); `[ ]` "—" → "No range set"; `[ ]` "Missing range" filter chip; `[ ]` edit in Drawer.
- **/lab/interpretations** - `[ ]` "Catalog interpretations" heading as large as the page title → 15-16px; `[ ]` native `<details>` list → table + Drawer; `[ ]` explain custom vs catalog.
- **/lab/analysis, /lab/counts** - `[ ]` remove API/developer paragraphs; `[ ]` redundant tiles; `[ ]` merge the two pages (same category counts 3 times).
- **/analytics/test-usage** - `[ ]` A9; `[ ]` grouped tiles; `[ ]` date-range chip; reorder lists as callouts.
- **/business/export, /lab/export** - `[ ]` A5; `[ ]` 4 solid blue buttons → one table with Download; `[ ]` "Last 31d" → "Last 30 days".
- **/business/activities, /settings/audit-log** - `[ ]` A7; `[ ]` filters → chips incl. date; `[ ]` timeline layout grouped by day; role in sub-line; `[ ]` pager.
- **/cases/agents, /cases/doctors** - `[ ]` identity cells; `[ ]` Edit + `⋯`; `[ ]` empty columns (Address N/A, Clinic Walk-in) hidden or muted; `[ ]` data cleanup (names with phone numbers).
- **/manage/employees** - `[ ]` remove "existing user API" note; `[ ]` identity cell (email · phone); "You" pill.
- **/manage/doctors** - `[ ]` two blue buttons → one; `[ ]` merge invites + accounts into one table with status; empty-state CTA.
- **/manage/branches** - `[ ]` A6; `[ ]` no delete on the last/current branch.
- **/manage/security** - `[ ]` parse user agent ("Chrome 151 · Windows"); `[ ]` login feed as timeline.
- **/settings/tat** - `[ ]` A8; `[ ]` narrow number inputs in a 2-col grid; `[ ]` one Save, not per row.
- **/settings/rate-revision** - `[ ]` sticky bulk bar only after selection; select-all checkbox; no dead per-row Apply.
- **/settings/signatures** - `[ ]` StatusBadge; Edit + `⋯`; data cleanup.
- **/settings/jobs** - `[ ]` remove nested cards; scope dropdown; "No failed jobs" success callout.
- **/setup/profile** - `[ ]` view mode as definition list (not disabled inputs); "Not set"; plain-language copy.
- **/setup/onboarding** - `[ ]` one accent (neutral card + progress bar); developer copy; stretched collapsed cards.
- **/delivery/templates** - `[ ]` readable names with key as mono sub-line; highlight `{{placeholders}}`; edit in Drawer; "+" on New template.
- **/usg/templates** - `[ ]` full findings inline (25 lines per row on phone) → first line + Drawer; add/edit actions.
- **/support/tickets** - `[ ]` "+ New ticket"; empty-state CTA; subject with "#123 · 2 days ago".
- **/shortcuts** - good; `[ ]` auto-height grid.

Redirect-only routes (not screens): /usg/search → /usg/today, /xray/search → /xray/today.