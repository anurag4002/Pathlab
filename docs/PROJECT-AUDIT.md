# Project Audit — PathLab

**Date:** 2026-09-16  
**Phase:** 0 — Audit (no source code modifications)  
**Auditor:** Kilo automated audit  
**Status:** Complete

---

## 1. Executive Summary

PathLab is a diagnostic laboratory management system built as a React 18 + Vite frontend
paired with an Express + Mongoose/MongoDB backend. The application is deployed to Vercel
using a serverless function that mounts the Express app under `/api`.

The codebase is **partially functional** but contains multiple **critical (P0) production
risks** that would prevent safe deployment: hardcoded credentials in source, a broken file
upload/download pipeline, exposed stack traces in production, and weak/missing authorization
checks. Additionally, numerous pages contain hardcoded mock data and simulated behavior that
would render key business features non-functional.

---

## 2. Repository Structure

```
PathLab/
├── frontend/                  # React 18 + Vite (dev port 3000)
│   ├── src/
│   │   ├── pages/             # 32 page components across 7 feature areas
│   │   ├── features/            # Feature-sliced subdirectories
│   │   │   ├── billing/         # BillCreateForm, BillItemsTable, PaymentSummarySection,
│   │   │   │   └── ...          #   DepartmentSelector, BillPrintPreview
│   │   │   ├── patients/
│   │   │   ├── dashboard/
│   │   │   ├── reports/
│   │   │   ├── tests/
│   │   │   ├── transactions/
│   │   │   ├── usg/
│   │   │   └── xray/
│   │   ├── services/           # 16 API service modules
│   │   ├── constants/          # 13 constants files
│   │   ├── context/            # AuthContext.jsx
│   │   ├── hooks/              # 5 custom hooks
│   │   ├── utils/              # 5 utility modules
│   │   ├── components/         # Common + layout components
│   │   ├── routes/             # AppRoutes.jsx, ProtectedRoute.jsx, RoleRoute.jsx
│   │   ├── auth/               # Login, EmployeeLogin, DoctorAccess
│   │   ├── common/             # shared UI components
│   │   └── layouts/
│   ├── vite.config.js          # Proxy: /api → localhost:5001
│   └── package.json
├── backend/                    # Express API (port 5001)
│   ├── src/
│   │   ├── app.js              # Express app — registers routes at /api + empty prefix
│   │   ├── server.js           # HTTP server startup
│   │   ├── config/
│   │   │   ├── database.js      # DB-per-request connect middleware
│   │   │   └── environment.js   # Env loader with insecure fallbacks
│   │   ├── models/             # 20 Mongoose schemas
│   │   ├── controllers/        # 14 controllers
│   │   ├── routes/             # 14 route files
│   │   ├── services/           # 9 service modules
│   │   ├── middleware/         # 7 middleware files
│   │   ├── validators/         # 5 validator files
│   │   ├── utils/              # 5 utility files
│   │   ├── constants/          # 3 constants files
│   │   ├── seed/               # seed.js + seedData.js
│   │   └── uploads/            # User-uploaded files (served statically)
│   ├── .env                    # Live env file (do not print secrets)
│   ├── .env.example
│   └── package.json
├── api/
│   └── index.js                # Vercel serverless entry point
├── vercel.json                 # Deployment config
├── .env.example                 # Root env example
├── .gitignore
└── package.json                # Root workspace (orchestration scripts)
```

---

## 3. Technology Stack

| Layer        | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18, Vite, Axios               |
| Backend     | Express.js, Mongoose, MongoDB       |
| Deployment  | Vercel (serverless functions)       |
| Auth        | JWT (bcrypt password hashing)       |
| File Upload | Multer                              |
| Validation  | Custom middleware (no Joi/Zod)      |

---

## 4. Architecture — Request Flow

### 4.1 Local Development Flow

```
Browser (http://localhost:3000)
  → Vite dev proxy (/api)
  → http://localhost:5000/api/<route>
  → Express app.js
  → Route handler → Controller → Service → Model
  → MongoDB
```

The Vite development server (`vite.config.js`) proxies requests starting with `/api` and
`/uploads` to the backend at `http://localhost:5001`.

### 4.2 Production (Vercel) Flow

```
Browser
  → Vercel
  → api/index.js (serverless function)
  → requires ../backend/src/app.js
  → Express app handles request
  → MongoDB
```

`vercel.json` rewrites `/uploads/*` to `/api/index.js`, allowing uploaded files to be
served through the serverless function. The backend's `app.js` mounts routes at both
`/api` and `` (empty string) prefix via `registerAllRoutes(app, '/api')` and
`registerAllRoutes(app, '')`.

### 4.3 Database Connection Strategy

`backend/src/config/database.js` implements a **DB-per-request** pattern: it connects to
MongoDB before each request (when `req.db` is not already set) and assigns the connection
to `req.db`. This is designed for Vercel serverless functions where connections can't
persist across invocations. However, this middleware only runs on routes that explicitly
use it — not all routes are confirmed to use this middleware, which could cause issues on
Vercel.

---

## 5. Authentication & Authorization

### 5.1 JWT Flow

1. User submits credentials to `/api/auth/login` (or `/auth/login` via empty prefix).
2. `AuthController.login` verifies password via `bcrypt.compare`.
3. On success, generates JWT via `jwt.sign({ id, role, name }, JWT_SECRET)`
   (7-day expiry) and returns it.
4. Frontend stores token in `localStorage` and sets it in `apiClient.js` as
   `Authorization: Bearer <token>`.
5. `AuthContext.jsx` manages auth state (login, logout, token persistence).

### 5.2 Authorization Middleware

- **`authMiddleware.js` `protect`**: Verifies JWT, attaches `req.user`. **Critically, it
  denies access if `req.user.role === 'Patient'`** — this forces patients to use a separate
  patient portal flow.
- **`roleAuthorization`**: Checks `req.user.role` against allowed roles passed as arguments.

### 5.3 Session Management

- No server-side session store — stateless JWT.
- `Activity` model exists for audit logging but is **not actively used** in middleware
  (only seeded once in seed.js).
- No token refresh mechanism — users must re-login after 7 days.

---

## 6. Feature Inventory

| Feature Area        | Key Pages / Components                              | Backend Modules                      | Status          |
|---------------------|-----------------------------------------------------|--------------------------------------|-----------------|
| **Dashboard**       | DashboardPage, BusinessSummaryCard, QuickActions    | dashboardController, dashboardService | Partially working |
| **Authentication**  | Login, EmployeeLogin, DoctorAccess, AuthContext     | authController, authRoutes, authMiddleware | Working (security concerns) |
| **Patients**        | PatientsPage, PatientDetailsPage, PatientDetailsSection | patientController, patientRoutes, patientService | Working (minor issues) |
| **Billing**         | BillsPage, BillCreateForm, BillItemsTable, PaymentSummarySection, DepartmentSelector, BillPrintPreview, PaymentCollectModal | billController, billRoutes, billService | **Not working** (hardcoded mock data) |
| **Tests**           | TestDatabase, TestPackages, TestPanels, TestCategories | testController, testRoutes, testService | Working |
| **Reports**         | TodaysReports, SearchReports, ReportUpload, ReportView | reportController, reportRoutes, reportService | **Broken** (file path mismatch) |
| **USG**             | TodaysUSGCases, SearchUSGCases, USGCaseForm         | usgController, usgRoutes, usgService   | **Partially broken** (hardcoded findings) |
| **X-Ray**           | TodaysXrayCases, SearchXrayCases, XrayReportForm    | xrayController, xrayRoutes, xrayService | **Partially broken** (hardcoded findings) |
| **Interpretations** | Interpretations, InterpretationManagement           | interpretationController, interpretationRoutes | Working |
| **Transactions**    | Transactions, DailyBusiness                         | transactionController, transactionRoutes | Partially working (some hardcoded) |
| **Referral**        | ReferralDoctors, AgentManagement                    | doctorController, doctorRoutes, agentController, agentRoutes | Working |
| **Employees**       | EmployeesPage, EmployeeForm, EmployeeLogin          | userController, userRoutes, userMiddleware | Working |
| **Reports Portal**   | PatientReportPortal (patient self-service download) | reportController, storageService     | **Broken** (path resolution bug) |
| **Browser Security**| BrowserSecurity                                     | (frontend-only)                      | **Hardcoded/simulated** |

---

## 7. Data Models (20 Schemas)

| Model           | Key Fields Summary                                 | Relationships                        |
|-----------------|----------------------------------------------------|--------------------------------------|
| User            | name, email, phone, role, password, status         | Created by Admin                     |
| Patient         | name, age, gender, phone, address, registrationNumber | referringDoctor, agent, createdBy    |
| Doctor          | name, phone, clinicHospital, address, referralPercentage | —                                |
| Agent           | name, phone, commissionPercentage, status          | —                                    |
| TestCategory    | name, description, status                            | —                                    |
| Test            | name, code, category, sampleType, unit, price, referenceRange, male/femaleReferenceRange, interpretation | TestCategory |
| TestPackage     | name, price, gender, includedTests, description     | Test[]                               |
| Bill            | billNumber, patient, items, discount, totalAmount, paidAmount, dueAmount, paymentMethod, paymentStatus | Patient, Doctor, Agent, User, BillItem[] |
| BillItem        | billId, itemType, itemId, name, price               | Bill                                 |
| Report          | invoiceNumber, testName, patientName, fileUrl, fileType, uploadedBy | —                    |
| Interpretation  | test, category, interpretation, notes               | Test, TestCategory                   |
| Transaction     | patient, bill, amount, paymentMethod, type, receivedBy | Patient, Bill, User                |
| Expense         | category, amount, description, paymentMethod        | —                                    |
| USGCase         | patient, doctor, findings, impression, reportFile, date | —                                 |
| XrayCase        | patient, doctor, findings, impression, reportFile, date | —                                 |
| OtpSession      | phone, otp, expiresAt                               | —                                    |
| Activity        | user, action, module, description, timestamp        | User                                 |

---

## 8. API Endpoint Summary

### 8.1 Auth Routes (`/api/auth`)
| Method | Path              | Controller Action     | Auth      |
|--------|-------------------|-----------------------|-----------|
| POST   | `/login`          | AuthController.login  | Public    |
| POST   | `/register`       | AuthController.register | Admin    |
| GET    | `/profile`        | AuthController.getProfile | Protect |
| PUT    | `/profile`        | AuthController.updateProfile | Protect |

### 8.2 Patient Routes (`/api/patients`)
| Method | Path              | Controller Action      | Auth      |
|--------|-------------------|------------------------|-----------|
| GET    | `/`               | PatientController.getAllPatients | Protect |
| POST   | `/`               | PatientController.createPatient | Protect |
| GET    | `/:id`            | PatientController.getPatientById | Protect |
| PUT    | `/:id`            | PatientController.updatePatient | Protect |
| DELETE | `/:id`            | PatientController.deletePatient | Protect |

### 8.3 Billing Routes (`/api/bills`)
| Method | Path              | Controller Action     | Auth      |
|--------|-------------------|-----------------------|-----------|
| GET    | `/`               | BillController.getAllBills | Protect |
| POST   | `/`               | BillController.createBill | Protect |
| GET    | `/:id`            | BillController.getBillById | Protect |
| PUT    | `/:id`            | BillController.updateBill | Protect |
| DELETE | `/:id`            | BillController.deleteBill | Protect |

### 8.4 Test Routes (`/api/tests`)
| Method | Path                    | Controller Action       | Auth      |
|--------|-------------------------|---------------------------|-----------|
| GET    | `/`                    | TestController.getAllTests | Protect |
| POST   | `/`                    | TestController.createTest | Protect/Admin |
| GET    | `/:id`                  | TestController.getTestById | Protect |
| PUT    | `/:id`                  | TestController.updateTest | Protect/Admin |
| DELETE | `/:id`                  | TestController.deleteTest | Protect/Admin |
| GET    | `/by-category/:catId`   | TestController.getTestsByCategory | Protect |

### 8.5 Report Routes (`/api/reports`)
| Method | Path              | Controller Action      | Auth      |
|--------|-------------------|------------------------|-----------|
| GET    | `/`               | ReportController.getAllReports | Protect |
| POST   | `/`               | ReportController.uploadReport | Protect |
| GET    | `/:id`            | ReportController.getReportById | Protect |
| GET    | `/download/:id`   | ReportController.downloadReport | Protect |

### 8.6 USG Routes (`/api/usg-cases`)
| Method | Path              | Controller Action      | Auth      |
|--------|-------------------|------------------------|-----------|
| GET    | `/`               | USGController.getAllCases | Protect |
| POST   | `/`               | USGController.createCase | Protect |
| GET    | `/:id`            | USGController.getCaseById | Protect |
| PUT    | `/:id`            | USGController.updateCase | Protect |

### 8.7 X-Ray Routes (`/api/xray-cases`)
| Method | Path              | Controller Action      | Auth      |
|--------|-------------------|------------------------|-----------|
| GET    | `/`               | XrayController.getAllCases | Protect |
| POST   | `/`               | XrayController.createCase | Protect |
| GET    | `/:id`            | XrayController.getCaseById | Protect |
| PUT    | `/:id`            | XrayController.updateCase | Protect |

### 8.8 Other Route Groups
- **Doctors** (`/api/doctors`): CRUD for referral doctors
- **Agents** (`/api/agents`): CRUD for referral agents
- **Transactions** (`/api/transactions`): Financial transaction records
- **Expenses** (`/api/expenses`): Operational expense tracking
- **Interpretations** (`/api/interpretations`): Test interpretation management
- **Users** (`/api/users`): Employee/user management
- **Activities** (`/api/activities`): Audit log entries

### 8.9 Patient Portal Routes (`/api/patient-portal`)
| Method | Path              | Controller Action      | Auth      |
|--------|-------------------|------------------------|-----------|
| POST   | `/send-otp`       | PatientPortalController.sendOtp | Public |
| POST   | `/verify-otp`     | PatientPortalController.verifyOtp | Public |
| GET    | `/reports`        | PatientPortalController.getReports | OTP-based session |
| GET    | `/reports/download/:id` | PatientPortalController.downloadReport | OTP-based session |

---

## 9. Frontend Architecture

### 9.1 State Management
- **Auth state**: `AuthContext.jsx` + `localStorage` for token persistence.
- **Data fetching**: `useFetch` hook (generic) + per-feature service modules.
- **No global state manager** (Redux/Zustand) — each page manages its own local state.

### 9.2 API Client
- `frontend/src/services/apiClient.js` — Axios instance with `baseURL: '/api'`.
- Automatically injects JWT from `localStorage` via request interceptor.
- Response interceptor handles 401 errors by clearing auth state.

### 9.3 Routing
- `AppRoutes.jsx` defines all routes using `react-router-dom` v6.
- `ProtectedRoute.jsx` gates authenticated routes.
- `RoleRoute.jsx` gates role-specific routes (e.g., Admin-only).
- **Patient Report Portal** uses its own flow outside the main protected routes.

### 9.4 Environment Configuration
- `frontend/src/constants/appConstants.js` — `API_BASE_URL = '/api'`.
- Vite config handles proxy in development.
- **No `.env` consumption on frontend** — relies on relative `/api` paths.

---

## 10. File Upload & Storage

### 10.1 Backend Upload Pipeline

1. `uploadMiddleware.js` — Multer configuration with disk storage.
2. Files written to `backend/src/uploads/<type>/<filename>`.
3. `fileUrl` stored in DB as `uploads/<type>/<filename>` (**P0**: missing `src/` prefix).
4. `reportService.js` and `storageService.js` handle path construction.

### 10.2 Static File Serving

`app.js` serves `backend/src/uploads` at `/uploads` route:
```js
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

### 10.3 Download Pipeline

`storageService.js` `getFilePath()`:
- Receives a `fileUrl` like `uploads/reports/file.pdf`.
- Uses `path.basename` to strip the subfolder path.
- Returns `path.join(UPLOAD_DIR, basename)` → `uploads/file.pdf`.
- **P0 Bug**: This loses subfolder context, breaking organized downloads.

### 10.4 Vercel Considerations

`vercel.json` rewrites `/uploads/*` to `/api/index.js`. On Vercel, the static middleware
must still serve files from the correct path relative to the serverless function's
filesystem.

---

## 11. Error Handling

### 11.1 Backend
- Express async handler wrapper catches errors and sends JSON response.
- **`/api/index.js` (P0)**: In `VERCEL` environment, returns 500 with full stack trace in
  response body — exposes internal paths and code structure.
- `errorHandler.js` middleware formats errors but does not log to file/monitoring.

### 11.2 Frontend
- `apiClient.js` response interceptor handles 401 by redirecting to login.
- Most API calls lack try/catch with user-facing error messages.
- Toast notifications used inconsistently for error feedback.

---

## 12. Environment Configuration

### 12.1 Environment Files
- `backend/.env` — live environment (exists, do not print secrets)
- `backend/.env.example` — template for backend
- `.env.example` — root-level template
- `frontend/.env.example` — template for frontend

### 12.2 Key Variables
| Variable        | Location                | Purpose                          |
|-----------------|-------------------------|----------------------------------|
| `MONGO_URI`     | backend/.env            | MongoDB connection string         |
| `JWT_SECRET`    | backend/.env            | JWT signing key                  |
| `JWT_EXPIRES_IN`| backend/.env            | Token expiry (default 7d)        |
| `PORT`          | backend/.env            | Backend port (default 5001)      |
| `NODE_ENV`      | backend/.env            | Environment mode                 |

### 12.3 Insecure Fallbacks (P0)
- `environment.js` line 16: `process.env.MONGO_URI || 'mongodb://root:purepathlab@...'`
  — embeds DB credentials in source code.
- `environment.js`: `process.env.JWT_SECRET || 'purepathlabsecretkey1234567890'` —
  hardcoded fallback secret.

---

## 13. Testing Infrastructure

- **No automated tests** exist (no `__tests__`, `test/`, `*.spec.js`, or `*.test.js` files).
- No CI/CD pipeline configured (`.github/workflows` absent).
- No linting config found (eslint, prettier configs absent).
- No TypeScript — all JavaScript with JSDoc-style comments in some files.

---

## 14. Deployment Configuration

### 14.1 Vercel Config (`vercel.json`)
```json
{
  "rewrites": [
    { "source": "/uploads/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/api/index.js" }
  ]
}
```
All routes funnel through `api/index.js`, which requires the Express app.

### 14.2 Vercel Function
`api/index.js`:
- Creates Express app instance.
- Sets `trust proxy` for correct IP resolution.
- Exports handler function for Vercel serverless.
- **P0**: Wraps in try/catch that returns 500 + stack trace in production.

### 14.3 Package.json Scripts
- Root `package.json`: `dev` (concurrently runs frontend + backend), `build`, `start`.
- Frontend: `dev`, `build`, `preview`, `lint`.
- Backend: `start`, `dev` (nodemon), `start:prod`, `seed`.

---

## 15. Third-Party Dependencies

### 15.1 Frontend (package.json)
Core: `react@18`, `react-dom@18`, `react-router-dom@6`, `axios`.
UI: `lucide-react`, `recharts`.
Utilities: `date-fns`, `jsPDF`, `html2canvas`.
No state management, no form library (manual validation), no HTTP interceptors library.

### 15.2 Backend (package.json)
Core: `express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`.
Upload: `multer`.
Development: `nodemon` (dev dependency).
No rate limiting, no Helmet, no input sanitization middleware, no validation library.

---

## 16. Known Issues & Concerns

See `PRODUCTION-RISKS.md` for the prioritized list. Key areas:

1. **Security**: Hardcoded credentials, weak JWT secret, stack trace exposure, no rate limiting.
2. **Broken Functionality**: File upload/download path mismatch, billing mock data,
   hardcoded USG/X-ray findings.
3. **Data Integrity**: No audit logging, weak seed credentials, no input validation.
4. **Deployment**: DB-per-request pattern may not be applied to all routes; potential cold
   start issues on Vercel.

---

## 17. Audit Methodology

- Full source code review of all backend and frontend files.
- Static analysis of configuration, environment, and deployment files.
- Pattern matching for hardcoded values, security anti-patterns, and broken logic.
- No runtime testing was performed (audit-only scope).
- No changes were made to any source files.
