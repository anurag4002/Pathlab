# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** Pathlab
- **Date:** 2026-10-02
- **Prepared by:** TestSprite AI Team
- **Scope:** Frontend production suite TC001–TC030 (`http://localhost:3000`, backend `:5001`)
- **Live modification dashboard:** http://localhost:57597/modification?project_path=D:\Pathlab&project_name=Pathlab&mcp_port=57597&mode=execution

---

## 2️⃣ Requirement Validation Summary

### Requirement: Authentication & Access
- **Description:** Admin/employee login, invalid login, portal OTP, public token rejection.

#### Test TC001 Log in as Admin and reach the dashboard
- **Test Code:** [TC001_Log_in_as_Admin_and_reach_the_dashboard.py](./TC001_Log_in_as_Admin_and_reach_the_dashboard.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Admin credentials reach the dashboard reliably.

#### Test TC014 Login as newly created Employee
- **Test Code:** [TC014_Login_as_newly_created_Employee.py](./TC014_Login_as_newly_created_Employee.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Fixed email-login matching empty phone users; password login works for Active employees.

#### Test TC015 Deactivate employee and confirm login fails
- **Test Code:** [TC015_Deactivate_employee_and_confirm_login_fails.py](./TC015_Deactivate_employee_and_confirm_login_fails.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Sticky Actions + `user-deactivate` testid make deactivate reachable.

#### Test TC029 Invalid login shows error
- **Test Code:** [TC029_Invalid_login_shows_error.py](./TC029_Invalid_login_shows_error.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Invalid credentials show an error without granting access.

#### Test TC012 Patient portal OTP view reports and download PDF
- **Test Code:** [TC012_Patient_portal_OTP_view_reports_and_download_PDF.py](./TC012_Patient_portal_OTP_view_reports_and_download_PDF.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** `use-dev-otp` + always-visible `report-pdf-download` and `report-pdf-started` status.

#### Test TC030 Invalid public token shows Link not valid
- **Test Code:** [TC030_Invalid_public_token_shows_Link_not_valid.py](./TC030_Invalid_public_token_shows_Link_not_valid.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Invalid public tokens are rejected with a clear message.

---

### Requirement: Patients & Billing
- **Description:** Patient CRUD, LAB bills, payments, invoice PDF, public bill QR.

#### Test TC002 Create a new patient record
- **Test Code:** [TC002_Create_a_new_patient_record.py](./TC002_Create_a_new_patient_record.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Patient create works from the admin UI.

#### Test TC003 Create a LAB bill with tests
- **Test Code:** [TC003_Create_a_LAB_bill_with_tests.py](./TC003_Create_a_LAB_bill_with_tests.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** LAB bill with catalog tests persists to the ledger.

#### Test TC004 Collect payment using Pay button
- **Test Code:** [TC004_Collect_payment_using_Pay_button.py](./TC004_Collect_payment_using_Pay_button.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Requires an unpaid bill (`dueAmount > 0`); `bill-pay` collects payment.

#### Test TC005 Download bill invoice PDF
- **Test Code:** [TC005_Download_bill_invoice_PDF.py](./TC005_Download_bill_invoice_PDF.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** `bill-pdf` now surfaces `bill-pdf-started` so automation can assert without a browser download dialog.

#### Test TC011 Open real public bill QR link
- **Test Code:** [TC011_Open_real_public_bill_QR_link.py](./TC011_Open_real_public_bill_QR_link.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Public bill QR link opens a valid bill view.

#### Test TC027 Search existing patient
- **Test Code:** [TC027_Search_existing_patient.py](./TC027_Search_existing_patient.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Patient search returns matching records.

---

### Requirement: Lab Reports Lifecycle
- **Description:** Enter results, sign, verify, staff PDF, public report QR.

#### Test TC006 Full report flow: enter results submit Reported
- **Test Code:** [TC006_Full_report_flow_enter_results_submit_Reported.py](./TC006_Full_report_flow_enter_results_submit_Reported.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Results entry can reach Reported.

#### Test TC007 Sign a reported lab report
- **Test Code:** [TC007_Sign_a_reported_lab_report.py](./TC007_Sign_a_reported_lab_report.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Signing works when a Reported row is present.

#### Test TC008 Verify a signed lab report
- **Test Code:** [TC008_Verify_a_signed_lab_report.py](./TC008_Verify_a_signed_lab_report.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Admin verification of signed reports succeeds.

#### Test TC009 Preview and download staff report PDF
- **Test Code:** [TC009_Preview_and_download_staff_report_PDF.py](./TC009_Preview_and_download_staff_report_PDF.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Staff PDF preview/download path works.

#### Test TC010 Open real public report QR link and download PDF
- **Test Code:** [TC010_Open_real_public_report_QR_link_and_download_PDF.py](./TC010_Open_real_public_report_QR_link_and_download_PDF.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Public report QR + PDF download works.

#### Test TC028 View today lab reports queue
- **Test Code:** [TC028_View_today_lab_reports_queue.py](./TC028_View_today_lab_reports_queue.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Today’s reports queue loads.

---

### Requirement: Users & Departments
- **Description:** Create employees with department defaults.

#### Test TC013 Create a new Employee user
- **Test Code:** [TC013_Create_a_new_Employee_user.py](./TC013_Create_a_new_Employee_user.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** LAB default + last-dept lock + optional phone; create succeeds without toggling LAB off.

---

### Requirement: Setup, Templates & Modalities
- **Description:** Delivery templates, lab profile, signatures, USG/X-Ray, catalog, branches, business.

#### Test TC016 Create or edit a delivery notification template
- **Test Code:** [TC016_Create_or_edit_a_delivery_notification_template.py](./TC016_Create_or_edit_a_delivery_notification_template.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Template edit/create path works.

#### Test TC017 Edit lab profile branding and preview document PDF
- **Test Code:** [TC017_Edit_lab_profile_branding_and_preview_document_PDF.py](./TC017_Edit_lab_profile_branding_and_preview_document_PDF.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Save / preview path verified (`lab-profile-save`).

#### Test TC018 Activate an existing signature
- **Test Code:** [TC018_Activate_an_existing_signature.py](./TC018_Activate_an_existing_signature.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** `signature-activate` works when an Inactive signature exists.

#### Test TC019 Review USG report templates list
- **Test Code:** [TC019_Review_USG_report_templates_list.py](./TC019_Review_USG_report_templates_list.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** USG templates list loads.

#### Test TC020 Create a USG case
- **Test Code:** [TC020_Create_a_USG_case.py](./TC020_Create_a_USG_case.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** USG case create works.

#### Test TC021 Create an X-Ray case without requiring image upload
- **Test Code:** [TC021_Create_an_X_Ray_case_without_requiring_image_upload.py](./TC021_Create_an_X_Ray_case_without_requiring_image_upload.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Findings-only create; list cache-busting fixed so new cases appear.

#### Test TC022 Create a lab test in the catalog
- **Test Code:** [TC022_Create_a_lab_test_in_the_catalog.py](./TC022_Create_a_lab_test_in_the_catalog.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Catalog test create works.

#### Test TC023 Create a new branch
- **Test Code:** [TC023_Create_a_new_branch.py](./TC023_Create_a_new_branch.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Branch create works.

#### Test TC024 Review daily business for a date range
- **Test Code:** [TC024_Review_daily_business_for_a_date_range.py](./TC024_Review_daily_business_for_a_date_range.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Daily business view loads for a date range.

#### Test TC025 Export a business CSV dataset
- **Test Code:** [TC025_Export_a_business_CSV_dataset.py](./TC025_Export_a_business_CSV_dataset.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** CSV export triggers successfully.

#### Test TC026 Dashboard loads with quick actions
- **Test Code:** [TC026_Dashboard_loads_with_quick_actions.py](./TC026_Dashboard_loads_with_quick_actions.py)
- **Status:** ✅ Passed
- **Analysis / Findings:** Dashboard quick actions render.

---

## 3️⃣ Coverage & Matching Metrics

- **100% of TC001–TC030 passed** (latest re-runs of every previously FAILED/BLOCKED case are green)

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|-------------|-------------|-----------|-----------|
| Authentication & Access | 6 | 6 | 0 |
| Patients & Billing | 6 | 6 | 0 |
| Lab Reports Lifecycle | 6 | 6 | 0 |
| Users & Departments | 1 | 1 | 0 |
| Setup / Templates / Modalities / Business | 11 | 11 | 0 |
| **Total** | **30** | **30** | **0** |

---

## 4️⃣ Key Gaps / Risks

- **Stale modification URLs:** Ports `58297`, `53997`, `49680`, and `62052` are **disconnected** — TestSprite MCP sessions expire (~1 hour). Use the live dashboard on **`http://localhost:57597/modification?...`** (or reopen via TestSprite MCP `open_test_result_dashboard`).
- **Pay button only appears when `dueAmount > 0`** — fully paid ledgers look like a “missing Pay” bug to automation; keep at least one unpaid invoice for TC004.
- **Email login previously matched empty phones** — fixed in `authService.login`; keep phone-key matching gated to ≥10 digits.
- **Rate limits remain elevated** in `.env` for TestSprite (`RATE_LIMIT_*` / `OTP_MAX_ATTEMPTS=10`); restore production-safe values when testing is finished.
- **TC031–TC045** exist in the plan but were outside the production 30-cap suite; run as a separate batch if full 45-case coverage is required.
