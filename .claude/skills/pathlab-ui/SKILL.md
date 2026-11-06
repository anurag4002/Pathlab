---
name: pathlab-ui
description: Pure Path Lab's UI rules - the calm, data-dense SaaS look (reference - Navattic "Visitors" screen) mapped to this app's components and tokens. Use whenever building, changing or reviewing any screen, table, filter, form, drawer, sidebar or empty state in frontend/src, and when asked to "improve the UI/UX" of a page. Includes a page-by-page improvement backlog in references/page-audit.md.
---

# Pure Path Lab UI

Staff use this app **100+ times a day**. Every rule below serves one goal:
*the data is loud, the chrome is quiet, and the next action is one click (or
one key) away.* The reference is a modern B2B table screen (Navattic
"Visitors", curated by Mobbin): neutral greys, one accent, generous white
space, a list on the left and the selected record in a side panel on the right.

Before changing a screen: read this file, check the screen's entry in
`references/page-audit.md`, reuse the components listed in **Building blocks**,
then verify with `node e2e/full-flow.cjs` (and `e2e/crawl.cjs` with
`W=390 H=844` for phones).

## 0. Classic and New UI

The revamp ships behind a per-user switch (user menu → "New look", and a
banner on the dashboard). New styles are scoped under the root class
`ui-v2`; layout changes branch on `useUiVersion()`. The classic UI must look
exactly as before when the switch is off. Correctness fixes apply to both.

New-look rules learned from the user:
- **One search box per screen** (top bar). On a list page it filters that list
  (`PageSearchField` types into the page's own hidden search); its "Everywhere"
  button opens the global search (Ctrl K). Elsewhere it is the global search.
- **Tips are visible**: `PageTip` shows one closable line under the page title
  on busy screens (texts in `components/common/PageTip.jsx`).
- **New bill is the most-used screen**: it must fit one screen, keep Doctor and
  Collection agent visible, and never send the user to another page mid-bill.
- Type and colour follow the reference: zinc text (#18181b / #3f3f46 / #71717a),
  #e4e4e7 borders, #fafafa canvas, 15px body, 600-weight titles.

## 1. Look and feel (from the reference)

| Element | Rule | Token / class |
|---|---|---|
| Canvas | White content area on a near-white app background; separation by 1px borders, not shadows | `--color-surface`, `--color-background`, `--color-border` |
| Accent | **One** accent (blue) for the primary action, the current nav item marker, links and focus. Never two blue buttons side by side | `--color-primary` |
| Neutral states | Hover = light grey fill (`--color-surface-hover`), selected = slightly darker grey or primary-light + bold text. Hover must never look like "selected" | |
| Type | Inter. Page title 28-30px semibold; section titles 15-16px semibold; body 14px; meta 12-13px muted. Sentence case everywhere (no ALL-CAPS table headers) | `--font-size-*` |
| Numbers | Tabular figures in tables and money columns; ₹ with Indian grouping via `formatCurrency` | `font-variant-numeric: tabular-nums` |
| Radius | 8px for controls and cards, 12px for drawers/large cards, full for avatars/pills | `--radius-md`, `--radius-lg` |
| Density | Table rows 52-64px when they carry two lines (name + sub-line), 44px for single line. Never cram action buttons into two rows | |
| Empty value | Muted italic text ("Not identified", "No doctor") - never "-", "N/A" in bold, or blank | `.cell-empty` |
| Icons | Lucide, 16-18px, stroke 1.75-2, same grey as the text they sit with | |

## 2. Page anatomy

```
┌ Sidebar (grouped) ┐┌ Top bar: breadcrumb / scope dropdown ............ user ┐
│ App name          ││ Page title (large)                     [Primary action]│
│ ─ Section label   ││ [Search…] [Filter (n)]                                 │
│   Item            ││ ┌ chips: Status: Pending ×  Branch: Main ×  [+ Add filter] [× Clear] ┐
│   ▌Item (current) ││ ┌ Table: avatar · name / sub-line │ col │ col │ ⋯ ┐   ┌ Drawer ┐
│ ─ Section label   ││ └ 25 ▾ rows per page          1-25 of 240  ‹ › ┘   │ record │
│ ...               ││                                                     └────────┘
│ Usage / invite    │
```

- **Sidebar**: items grouped under small muted *section labels* (e.g. Daily
  work · Lab · Business · Setup) instead of one long list of collapsible
  folders. Current item = grey fill + bold, with the accent only on the icon
  or a 2px marker. Utility actions (search, help, profile) pinned to the
  bottom. Keep the `New bill (Ctrl B)` button at the top.
- **Top bar**: breadcrumb (`Bills / All bills ▾`) whose last part is a *scope
  dropdown* (All / Today / Due / Voided; or branch). It replaces the row of
  status tabs where possible.
- **Page header**: title + one-line subtitle only when it adds information.
  One primary action on the right; secondary actions as quiet buttons or in a
  `⋯` menu.
- **Search + Filter**: a compact search box and a `Filter` button with a
  count badge. Active filters show as removable **chips** in a light grey
  strip (`Field: value ×`), followed by `+ Add filter` and `× Clear`. Do not
  show 6-8 select boxes permanently - that is what "Show all filters" used to
  hide; chips make the active ones visible and the rest one click away.
- **Table**: first column = identity (avatar/initials or type icon + bold
  name + muted sub-line such as phone / reg no / bill no).
  **Clinical screens are the exception to trimming:** wherever results are
  entered, reviewed, signed or reported (Result Entry, Verification, Today's
  Reports, report preview) the patient's **age and sex stay prominent**
  (e.g. `Asha Devi · 23 Y F`), never folded away, truncated or moved into a
  drawer - the practitioner reads them against reference ranges. Sentence-case
  headers, no vertical rules except a light divider after the identity
  column, money right-aligned. Row hover = grey fill; clicking a row opens
  the drawer. Row actions: at most **one** visible primary action
  (e.g. `Pay`, `Results`) + `⋯` menu; icon-only buttons need `aria-label`
  and a tooltip.
- **Footer**: `25 ▾ rows per page` left, range + pager right.
- **Drawer (side panel)** for "view / quick edit one record" instead of a
  centred modal: title + close, identity block (avatar, name, copyable
  email/phone), key fields in a 2-column definition list, tabs (Activity /
  Details), stat tiles row, timeline, properties with `⋯` per row. Modals
  stay for confirm / destructive / short forms only.
- **Stat tiles**: label (muted, sentence case) over value (20-24px
  semibold); grouped in one bordered card with dividers, not separate
  floating cards.
- **Timeline**: icon on a thin vertical line, title + muted sub-line, time
  right-aligned ("2 hours ago").
- **Callouts**: tinted background + matching border + icon + bold title +
  one sentence (`--color-warning-bg/-border`). Never a bare red line of text.

## 3. Interaction rules (already in the app - keep them)

- Notifications: `notify()` / `toast` from `components/common` - never
  `window.alert`. Errors stay until dismissed; confirmations fade.
- Keyboard: `Ctrl B` new bill / create invoice, `/` search on this screen,
  `?` shortcuts page, `Ctrl K` global search, Enter/↑↓ in result entry,
  `Ctrl S` save, `Ctrl Enter` final. Show the key next to the control it
  triggers (`kbd` pill, `.kbd-tip`) and list it in
  `pages/help/KeyboardShortcuts.jsx`.
- Option groups (department, Tests/Panels) = one Tab stop, arrows switch
  (`utils/rovingFocus`). Long pick lists are not Tab stops.
- Lists keep rows while refreshing (`DataTable` dims + thin bar); first load
  shows skeleton rows. Never swap a list for a spinner.
- Anything that appears/disappears near the pointer must reserve its space
  (no layout shift under the mouse).
- Copy affordances (`CopyButton`) next to bill no, phone, reg no, email.
- Destructive actions: modal with reason (void) or `ConfirmDialog`; never
  `window.confirm`.
- Search text is literal on the server (`utils/escapeRegex`) - keep it that
  way for every new `$regex`.

## 4. Building blocks (reuse before writing new)

| Need | Use | Notes |
|---|---|---|
| Page title + action | `PageHeader` | |
| Table, search, paging | `DataTable` | add identity cell + drawer open on row click |
| Filters | `AdvancedFilterBar` | **to do:** chip mode (see audit) |
| Row actions | `RowMenu` (`⋯`, portal, keyboard) | |
| Status | `StatusBadge` | colour + text, never colour alone |
| Forms | `Input`, `Select`, `DatePicker` (auto-linked labels) | |
| Dialogs | `Modal`, `ConfirmDialog` | short tasks only |
| Side panel | **to build:** `Drawer` (right, 480px, focus-trapped, Esc closes, URL `?view=<id>`) | reference pattern; replaces details modals |
| Charts | `components/charts/SvgCharts` | rules in the dataviz skill; validated palette |
| Notices | `notify`, `toast` | |
| Copy | `CopyButton` | |
| WhatsApp | `WhatsAppShare` | |
| Document results | `components/lab/DocumentResultEditor` | |

## 5. Definition of done for any UI change

1. Matches sections 1-3; no new colours outside `tokens.css`.
2. Works at 1440px and 390px (`e2e/crawl.cjs`, `W=390 H=844`): no sideways
   page scroll, nothing cut off, touch targets ≥ 40px.
3. Keyboard: reachable by Tab in a sensible order, visible focus ring,
   shortcut (if any) shown next to the control and on the shortcuts page.
4. Empty, loading (skeleton) and error (callout + retry) states exist.
5. `npm run lint` clean, `npm run build` passes, `node e2e/full-flow.cjs`
   all PASS; update the screen's entry in `references/page-audit.md`.

## References

- `references/page-audit.md` - every screen: what it is for, what to change
  (ordered by daily impact), and status.
