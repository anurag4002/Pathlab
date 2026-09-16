# STRICT Test Cases — Pure Path Lab (All Pages + Manage Tab + All APIs)

Date: 2026-09-16 | Scope: frontend `src/routes/AppRoutes.jsx` (35 routes) + backend `src/app.js` (14 routers) | Strict = FAIL on any deviation.

## Global preconditions
- G1: Backend `MONGO_URI`, `JWT_SECRET` set (no fallbacks), DB reachable.
- G2: Users: Admin, Employee, Doctor (Active), Inactive user, unauthenticated, Patient (phone+OTP).
- G3: Browsers: Chrome desktop 1280px + mobile 390px. Network throttling for race tests.
- Severity on fail: S1 blocker, S2 major, S3 minor. Mark PASS only if ALL asserts hold.

## Conventions per case
`[ID] Page/Route | Role | Steps | Expected (strict) | API contract`

---

## 0. Public
- TC-PUB-01 `/` LandingPage, anon: load with API down → page renders, no blank, no console throw. No API call fired.
- TC-PUB-02 `/login` + `/admin/login` anon: empty submit → inline errors, zero API calls. Wrong creds → generic error (no user-enumeration), no token stored. Valid login → `ppl_token`+`ppl_user` set, redirect `/dashboard`. `POST /api/auth/login {email,password}` 200 `{success,data:{token,user}}`.
- TC-PUB-03 OAuth buttons: click with backend OAuth unconfigured → disabled or clear error; must NOT leak `backend/.env` hint text to user. `GET /api/auth/google/url`, `POST /api/auth/google` must verify ID-token server-side (current code trusts email → S1).
- TC-PUB-04 `/patient/report`, `/reports` anon: request OTP for unknown phone → 404 generic (current 404 leaks existence → S2). `POST /api/patient/auth/request-otp` rate-limited (5/15min). Verify OTP wrong 3x → locked. Correct → `sessionStorage ppl_patient_token`, `GET /api/patient/reports` scoped to that phone only. Download → file bytes, no other patient's file (IDOR test → S1).
- TC-404-01 `/*` typo authenticated → must show 404 page (current: silent `/dashboard` redirect → S3 FAIL). Unauthenticated typo → `/login` with return-url preserved.

## 1. Shell / Auth guard
- TC-AUTH-01 ProtectedRoute: no token → `/login`. Tampered token → 401 → token cleared + `/login` once (no loop). Corrupt `ppl_user` JSON → provider does not crash (current: crash → S1).
- TC-AUTH-02 `localStorage` XSS: token must move to httpOnly cookie or short-lived + refresh (current: readable → S2).

## 2. Dashboard
- TC-DASH-01 `/dashboard` Admin/Employee/Doctor: `GET /api/dashboard/summary` 200, stats render, failure shows banner + retry (no blank). Employee/Doctor must NOT see Admin-only cards if any.

## 3. Cases
- TC-BILL-01 `/cases/bills` + `/cases/bills/new` Admin/Employee: list `GET /api/bills`, create `POST /api/bills` persists + appears on reload (no `alert()` simulation → S1 if simulated). Doctor direct URL → blocked (current: allowed → S2). Payment `POST /api/bills/:id/payment {amount>0}` updates dues.
- TC-PAT-01 `/cases/patients`: CRUD `GET/POST/PUT /api/patients`, `DELETE /api/patients/:id` Admin-only (Employee delete → 403). Detail `/cases/patients/:id` invalid id → 404 page, not crash (CastError must map 400, not 500 → S2).
- TC-TXN-01 `/cases/transactions`: `GET /api/transactions` read-only; POST → 404/405.
- TC-DOC-01 `/cases/doctors`, TC-AGT-01 `/cases/agents`: CRUD wired; delete Admin-only; no validator gap (empty name → 400, current: 500 → S2).

## 4. Lab (8 pages)
- TC-LAB-01 `/lab/reports` (Today): `GET /api/reports`, upload `POST /api/reports/upload` multipart 10MB limit, ext+magic-byte check; download `GET /api/reports/:id/download` auth-required (direct `/uploads/...` URL without token → 401; current: public → S1).
- TC-LAB-02 `/lab/search`: query/500ms debounce, cancel prior request (no out-of-order render).
- TC-LAB-03 `/lab/tests|packages|panels|categories|interpretations`: GET public OK; POST/PUT/DELETE without Admin token → 403 (route-guard + server). Direct URL as Employee/Doctor → frontend `RoleRoute` block (current: renders → S2). Empty name → 400.
- TC-LAB-04 `/lab/counts`: `GET /api/dashboard/summary` + categories render; zero-state handled.

## 5. Business (8 pages, Admin-only server+client)
- TC-BIZ-01 `/business/daily`: `GET /api/dashboard/business?startDate&endDate` date validation (end<start → 400). No `alert('Add cashier...')` (S1 if present).
- TC-BIZ-02 `/business/expenses`: CRUD + `GET /api/expenses/summary` totals match list; negative amount → 400 (current update allows → S2); delete Employee → 403.
- TC-BIZ-03 `/business/dues`: dues = bills pending/partial; collect payment updates txn ledger atomically.
- TC-BIZ-04 `/business/referrals`: `GET /api/dashboard/referral` sums per doctor.
- TC-BIZ-05 `/business/cases`: `GET /api/bills` case-wise grouping paginated.
- TC-BIZ-06 `/business/analysis`: summary+trends+charts; API 500 → banner, not blank.
- TC-BIZ-07 `/business/export`: export CSV/XLS row-count equals filtered count; large export does not OOM/timeout.
- TC-BIZ-08 `/business/activities`: `GET /api/dashboard/activities` paginated; filter/search server-side.

## 6. USG (3 pages)
- TC-USG-01 `/usg/today`: `GET/POST/PUT /api/usg`; missing patient/findings → 400; template select from `GET /api/usg/templates`. Findings render real DB text (hardcoded "No abnormality" → S1 clinical FAIL).
- TC-USG-02 `/usg/search`: same debounce/cancel contract as LAB-02.
- TC-USG-03 `/usg/templates` Admin: currently read-only → either wire CRUD or remove link (dead-end → S3). Employee direct URL → blocked.

## 7. X-Ray (3 pages)
- TC-XRAY-01 `/xray/today`: multipart `POST/PUT /api/xray` stores under `uploads/xray/`, download resolves same path (current middleware vs controller mismatch → 404 → S1). Old file deleted on replace. Non-image/PDF → 400.
- TC-XRAY-02 `/xray/search`, TC-XRAY-03 `/xray/reports`: list scoping correct; hardcoded "Findings: Normal" → S1 FAIL.

## 8. Manage tab (Admin-only, `/manage/*` under RoleRoute) — DEEP
- TC-MNG-01 `/manage/employees` + TC-MNG-02 `/manage/doctors`:
  1. Non-Admin direct URL → `/dashboard` (PASS today).
  2. Load: `GET /api/users?search=` 200; backend should accept `?role=` (current: over-fetch all + client filter → S2 perf/leak FAIL).
  3. Search typing fast "a→ab→abc": max 1 request (500ms debounce + AbortController); results match last query only (current: request per keystroke, race → S2 FAIL).
  4. Create: name/email required, email regex, phone format, password min 8 + strength (current: non-empty only, min 4 server → S2 FAIL). Duplicate email (case-insensitive) → 409, not 500.
  5. Edit with blank password → keeps hash (verify login with old pw). Role escalation attempt via crafted PUT → 403/400.
  6. Self-delete: Employee page hides own row ("Active Session" PASS); Doctor page must also block self-delete (current: allowed → S1 FAIL). Delete → confirm dialog, success refetch, failure shows inline error (current `alert()` → S3 FAIL).
  7. Load failure (API 500/offline) → error banner + retry (current: console-only → S2 FAIL).
  8. Pagination: >50 users paginated server-side (current: all at once → S2).
- TC-MNG-03 `/manage/security`:
  1. Cards "1 Session Active / SSL Secure / Token clearance" must be data-driven or removed (current: hardcoded → S2 FAIL).
  2. Table `GET /api/dashboard/activities` filtered server-side `?module=Auth`; case-insensitive login match (current misses `Login` → S3 FAIL).
  3. IP column must show real IP/user-agent from server (current: `ObjectId.slice` + "(localhost)" → S1 misleading FAIL).
  4. Must expose revoke/force-logout; patient tokens excluded or labeled.
  5. Empty state "No login authorization logs recorded." + error banner on failure.

## 9. Backend API contract matrix (strict)
- `POST /api/auth/login` no rate-limit today → brute-force S1; add limiter + generic errors.
- `POST /api/auth/forgot-password` no-op ("contact Super Admin") → either implement or remove route (S3).
- `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id` Admin-only (PASS server); add `?role`, pagination, case-insensitive unique email, role-enum 400.
- `GET/POST /api/patients`, `PUT /api/patients/:id` auth; `DELETE` Admin. Validators on create+update.
- `GET/POST/PUT /api/doctors|agents`, `DELETE` Admin. Add validators.
- `GET/POST /api/bills`, `GET /api/bills/:id`, `POST /api/bills/:id/payment` auth; bill/reg numbers atomic (counter collection), no reuse on delete, no `INV-TEMP` collision.
- `GET /api/tests|/categories|/panels|/packages|/interpretations` public; writes Admin. Add validators for all writes.
- `GET /api/reports`, `POST /api/reports/upload` (auth+file checks), `GET /api/reports/:id/download` (auth), `DELETE` Admin. Fix `storageService` basename bug + `src/uploads` vs `uploads` prefix mismatch (S1).
- `GET/POST/PUT /api/expenses`, `DELETE` Admin, `GET /api/expenses/summary`. Reject negative.
- `GET /api/transactions` auth read-only.
- `GET/POST/PUT /api/usg`, `GET /api/usg/templates` auth. `GET/POST /api/xray`, `PUT /api/xray/:id` auth+upload. Fix usg/xray path routing (double-mount breaks `getUploadPath`).
- `GET /api/dashboard/summary|business|referral|activities|trends` auth (add Admin check for business/referral/activities).
- `POST /api/patient/auth/request-otp` (limiter PASS) + `POST /api/patient/auth/verify-otp` (add limiter S1); OTP crypto-random, daily limit enforced, SMS provider real or removed; patient JWT short-lived (2h PASS) on separate secret.
- `GET / (/health, /api/health)` 200 `{status:'ok'}` no secrets.
- Double-mount (`/api/*` + `/*`) → remove bare mount (S2). `errorMiddleware` precedence bug `err.statusCode || res.statusCode === 200 ? 500 : ...` → parenthesize (S2). CORS `origin:true` → whitelist `CLIENT_URL` (S1). Add helmet + global limiter. `api/index.js` must not return stack in prod (S1).

## 10. Deploy / config checks
- TC-DEP-01 Vercel: `vercel.json` rewrite `/(.*) → /index.html` is wrong (output `frontend/dist`); must be `/frontend/dist/index.html` or framework preset; `/uploads/(.*) → /api/index.js` serves uploads via function (ephemeral `/tmp`) → use object storage. `vite build` must pass with no `file:..` self-deps (`pure-path-lab: file:..` in both frontend+backend → S2 bloat FAIL).
- TC-DEP-02 Ports/env: `vite.config` proxy `:5001` but `CLIENT_URL` default `:5173` vs vite port `:3000` mismatch → unify + add `frontend/.env*` (`VITE_API_URL`). `backend/.env` is git-tracked (verified `git ls-files`) → `git rm --cached`, rotate MONGO/JWT creds (S1). Remove `DEFAULT_MONGO_URI`/JWT fallbacks → fail-fast (S1).
- TC-DEP-03 No tests/lint gate: add Vitest + Playwright/Cypress + CI; `oxlint` only today (S2).

## Sign-off rule
Ship-blocker if any S1 fails: secrets tracked, CORS *, OAuth takeover, OTP brute-force, private uploads public, patient IDOR, hardcoded clinical findings, billing simulation, upload/download 404, stack-trace leak, self-delete, errorMiddleware masking.
