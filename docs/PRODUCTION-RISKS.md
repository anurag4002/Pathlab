# Production Risks — PathLab

**Date:** 2026-09-16  
**Phase:** 0 — Audit (no source code modifications)  
**Severity Levels:** P0 (Critical), P1 (High), P2 (Medium)

---

## P0 — Critical (Must fix before any production deployment)

| ID  | Title                        | Location                                      | Risk |
|-----|------------------------------|-----------------------------------------------|------|

### P0-1: Hardcoded Production Credentials in Source Code

**File:** `backend/src/config/environment.js:16`

**Description:**
The `DEFAULT_MONGO_URI` fallback contains a full MongoDB connection string with embedded
username and password:
```js
process.env.MONGO_URI || 'mongodb://root:purepathlab@cluster0...'
```
If `MONGO_URI` is not set, the application will attempt to connect to a cluster using
these hardcoded credentials, which are now exposed in version control.

**Impact:** Complete database compromise. An attacker with source access can authenticate
to the MongoDB cluster.

**Remediation:** Remove the hardcoded URI. Fail fast if `MONGO_URI` is not set.

---

### P0-2: Hardcoded JWT Secret

**File:** `backend/src/config/environment.js`

**Description:**
The `JWT_SECRET` falls back to the hardcoded value `purepathlabsecretkey1234567890` when
the environment variable is not set.

**Impact:** Any JWT issued with this secret can be forged by anyone who reads the source
code. An attacker can create admin-level tokens, bypassing all authentication.

**Remediation:** Remove the fallback. Generate a cryptographically random secret in
deployment. Fail fast if `JWT_SECRET` is missing.

---

### P0-3: Stack Trace Exposure in Production (Vercel)

**File:** `api/index.js`

**Description:**
The Vercel serverless function handler wraps the Express app in a try/catch that, when
`VERCEL` env is set, returns a 500 response containing the full stack trace:
```js
if (process.env.VERCEL) {
  return res.status(500).json({ error: error.message, stack: error.stack });
}
```

**Impact:** Exposes internal file paths, library versions, and code structure to any
client who can trigger an unhandled error — a goldmine for attackers.

**Remediation:** Return a generic error message in production. Log full errors server-side
only.

---

### P0-4: Broken File Upload/Download — Path Mismatch

**Files:** `backend/src/services/reportService.js`, `backend/src/services/storageService.js`,
`backend/src/middleware/uploadMiddleware.js`

**Description:**
Files are written to `backend/src/uploads/<type>/<filename>` but `fileUrl` is stored in the
database as `uploads/<type>/<filename>` (missing the `src/` prefix). When downloading,
`storageService.getFilePath` uses `path.basename` on the stored URL, stripping subfolder
context. The download path resolves to `uploads/<filename>` instead of
`uploads/reports/<filename>`, causing file-not-found errors.

**Impact:** Report upload and download functionality is completely broken. The patient
portal download route is non-functional. USG and X-ray report attachments cannot be
retrieved.

**Remediation:**
1. Store `fileUrl` consistently with the actual filesystem path.
2. Fix `storageService.getFilePath` to preserve subfolder structure instead of using
   `path.basename`.
3. Ensure static serving path matches storage path.

---

### P0-5: Billing Page Uses Mock Data — No Real API Integration

**File:** `frontend/src/features/billing/BillCreateForm.jsx`,
`frontend/src/features/billing/BillItemsTable.jsx`,
`frontend/src/features/billing/PaymentSummarySection.jsx`

**Description:**
The billing workflow uses `alert('Add cashier configuration simulated.')` and
`alert('Payment collection simulated.')` for critical business actions. Bill calculations
use hardcoded values rather than fetching real test prices from the API.

**Impact:** The billing system cannot generate real invoices or collect payments.
Generating a bill does not persist data to the backend.

**Remediation:** Replace all simulated behavior with actual API calls. Remove all
`alert()` calls. Implement proper bill calculation using real test/test-package data.

---

### P0-6: Broken Patient Portal File Download

**File:** `backend/src/services/storageService.js:12`

**Description:**
The `getFilePath` function uses `path.basename(fileUrl)` which strips all directory
information from the stored path. For a URL like `uploads/reports/report.pdf`, it returns
`uploads/report.pdf` instead of `uploads/reports/report.pdf`. The static middleware then
cannot find the file since it's stored in a subdirectory.

**Impact:** Patients cannot download their reports through the patient portal
(`PatientReportPortal`). This is a core feature for a diagnostic lab.

**Remediation:** Use `path.join(UPLOAD_DIR, fileUrl)` or resolve the path relative to
the static root without basename stripping.

---

### P0-7: DB-Per-Request Middleware Not Applied to All Routes

**File:** `backend/src/config/database.js`, `backend/src/app.js`

**Description:**
The DB-per-request pattern connects MongoDB before each request and assigns the connection
to `req.db`. However, not all route handlers use a service that reads from `req.db`.
On Vercel's serverless platform, the connection may not be available in every invocation
context, and some controllers may use the direct Mongoose model instead.

**Impact:** Database operations may fail with "connection not established" errors during
cold starts or when routes bypass the connection middleware.

**Remediation:** Ensure all routes and services use the `req.db` connection pattern
consistently, or switch to a connection-pool approach suitable for serverless.

---

## P1 — High (Should fix before production deployment)

### P1-1: Weak Seed Credentials

**File:** `backend/src/seed/seedData.js`

**Description:**
Seed creates users with passwords `admin123`, `staff123`, `doctor123` — all trivially
guessable and known to anyone with source access.

**Impact:** If seed data is loaded in any environment, default credentials are immediately
compromisable.

**Remediation:** Generate strong random passwords during seeding, or require explicit
password configuration. Never commit default credentials.

---

### P1-2: Hardcoded Lab Contact Information in Billing Print

**File:** `frontend/src/features/billing/components/BillPrintPreview.jsx`

**Description:**
The bill print preview hardcodes lab phone (`+91 98765 43210`) and address
(`Sector 15, Dwarka`) directly in the component rather than reading from configuration.

**Impact:** If the lab relocates or changes phone number, every printed invoice becomes
incorrect until the code is changed and redeployed.

**Remediation:** Move lab contact information to `frontend/src/constants/landingContent.js`
LAB_PROFILE or a dedicated config constant and reference it here.

---

### P1-3: Hardcoded USG/X-Ray Findings Text

**Files:** `frontend/src/pages/usg/TodaysUSGCases.jsx` (lines ~58, ~301),
`frontend/src/pages/xray/TodaysXrayCases.jsx` (line ~59)

**Description:**
Ultrasound and X-ray case entries show hardcoded placeholder text like
"No significant abnormality detected" and "Findings: Normal" regardless of actual
diagnosis entered. The actual `findings` and `impression` fields from the database are
not displayed.

**Impact:** Medical findings are not accurately reported — a serious clinical and
legal liability in a diagnostic lab context.

**Remediation:** Replace hardcoded text with dynamic rendering of the actual `findings`
and `impression` fields from the API response.

---

### P1-4: Missing Input Validation on Backend

**Files:** All controller files, `backend/src/validators/`

**Description:**
Backend validators exist (`src/validators/`) but are inconsistently applied. Most
controllers directly use `req.body` values without sanitization or validation. There is
no use of a validation library (Joi/Zod); validation is done with custom, minimal checks.

**Impact:** Malformed or malicious input could cause database errors, NoSQL injection
(via Mongoose), or data corruption.

**Remediation:** Apply validators consistently across all routes. Use a schema-based
validation library. Sanitize all inputs.

---

### P1-5: No Rate Limiting on Authentication Endpoints

**File:** `backend/src/app.js`, `backend/src/routes/authRoutes.js`

**Description:**
The login endpoint has no rate limiting. An attacker can brute-force passwords
indefinitely.

**Impact:** Account compromise through brute-force or credential stuffing attacks.

**Remediation:** Add rate limiting middleware (e.g., `express-rate-limit`) specifically
on `/auth/login` and `/patient-portal/send-otp` endpoints.

---

### P1-6: Token-Based Auth Without Revocation

**File:** `backend/src/middleware/authMiddleware.js`

**Description:**
JWTs are stateless with no revocation mechanism. If a token is compromised, there is no
way to invalidate it before the 7-day expiry.

**Impact:** A stolen JWT grants full access for up to 7 days.

**Remediation:** Implement a token blacklist/revocation store, or shorten token expiry
and implement refresh tokens.

---

### P1-7: Activity Logging Not Implemented

**File:** `backend/src/models/Activity.js` exists but is unused in middleware.

**Description:**
The `Activity` model exists for audit logging but is never called during user operations.
The seed script creates one activity record for seeding, but no middleware or service
logs actual user actions.

**Impact:** No audit trail for sensitive operations (patient data access, bill creation,
report uploads). Cannot investigate security incidents.

**Remediation:** Implement an activity logging middleware that records user actions,
timestamps, and IP addresses.

---

## P2 — Medium (Address before scaling to production)

### P2-1: No CORS Origin Configuration

**File:** `backend/src/app.js`

**Description:**
CORS is configured with `origin: true` and `credentials: true`, which reflects the
requesting origin. This is overly permissive.

**Impact:** Any website can make authenticated requests to this API, enabling potential
CSRF-like attacks in combination with credential theft.

**Remediation:** Restrict CORS to known frontend origins only.

---

### P2-2: Hardcoded "Browser Security" Dashboard Values

**File:** `frontend/src/pages/manage/BrowserSecurity.jsx`

**Description:**
The browser security dashboard hardcodes "1 Session Active", "SSL Secure", and
"localhost" — this is mock content, not actual session security monitoring.

**Impact:** Misleads users about actual security posture. No real session management
or monitoring exists.

**Remediation:** Either implement real session monitoring or remove this page.

---

### P2-3: Missing Error Boundaries in Frontend

**Files:** All pages, `frontend/src/App.jsx`

**Description:**
No React error boundaries are implemented. A JavaScript error in any component will
crash the entire application with a blank screen.

**Impact:** Poor user experience; errors are not caught or reported.

**Remediation:** Add error boundaries at the route and application level.

---

### P2-4: No Automated Testing

**Repository-wide**

**Description:**
No test files exist (unit, integration, or E2E). No CI/CD pipeline.

**Impact:** No safety net for changes. Bugs can be introduced without detection.

**Remediation:** Add test framework (Jest/Vitest for unit, Cypress/Playwright for E2E).
Set up CI/CD with GitHub Actions or similar.

---

### P2-5: Missing Linting and Type Checking

**Files:** All source files

**Description:**
No ESLint, Prettier, or TypeScript configuration exists. Code style is inconsistent
across files.

**Impact:** Harder to maintain; potential for subtle bugs; inconsistent code quality.

**Remediation:** Add ESLint + Prettier configuration. Consider migrating to TypeScript.

---

### P2-6: Inconsistent Use of DB Connection Pattern

**File:** `backend/src/config/database.js`

**Description:**
The `connectDB` middleware assigns `req.db`, but Mongoose models are defined at module
level using the default Mongoose connection, not `req.db`. On Vercel serverless
functions, this means models may use a different connection than the one established
per-request.

**Impact:** Potential for "connection not established" errors or using stale connections
in production.

**Remediation:** Either use `req.db` consistently in all services (create model instances
from the per-request connection), or use connection pooling suitable for serverless.

---

### P2-7: Hardcoded Date in Registration Number Generation

**File:** `backend/src/utils/registrationNumber.js` (or wherever used)

**Description:**
If registration numbers are generated with hardcoded dates or non-sequential logic,
uniqueness cannot be guaranteed at scale.

**Impact:** Potential for duplicate registration numbers under high load.

**Remediation:** Use a database-backed counter or UUID-based approach for guaranteed
uniqueness.

---

### P2-8: No Input Sanitization on File Uploads

**File:** `backend/src/middleware/uploadMiddleware.js`

**Description:**
Multer upload configuration does not validate file types, sizes, or filenames.
Malicious files could be uploaded.

**Impact:** Potential for malicious file upload attacks, disk exhaustion.

**Remediation:** Add file type whitelisting, size limits, and filename sanitization.

---

### P2-9: Hardcoded Payment Method Simulation

**File:** `frontend/src/pages/business/DailyBusiness.jsx`

**Description:**
The "Add Cashier" functionality uses `alert('Add cashier configuration simulated.')` —
this is not a real feature.

**Impact:** Users cannot configure cashiers; the business management feature is incomplete.

**Remediation:** Either implement the cashier feature fully or remove the page.

---

## Summary

| Severity | Count | Total Risk |
|----------|-------|------------|
| P0       | 7     | Critical — blocks production deployment |
| P1       | 7     | High — must fix before production is reliable |
| P2       | 9     | Medium — addresses maintainability and scalability |

**Total identified risks: 23**

The most urgent items are the **7 P0 risks**, all of which must be resolved before the
application can be considered production-ready. The file upload/download path mismatch
(P0-4, P0-6) and the billing mock data (P0-5) are particularly concerning as they render
core business functionality non-operational.
