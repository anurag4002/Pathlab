import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import AppLayout from '../components/layout/AppLayout';

// Public Landing Page
const LandingPage = lazy(() => import('../pages/public/LandingPage'));
const VerifyReportPage = lazy(() => import('../pages/public/VerifyReport'));
const VerifyBill = lazy(() => import('../pages/public/VerifyBill'));

// Auth
const Login = lazy(() => import('../features/auth/pages/Login'));

// Patient Portal
const PatientReportPortal = lazy(() => import('../pages/patient/PatientReportPortal'));

// Dashboard
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'));

// Patients (feature-based)
const PatientsPage = lazy(() => import('../features/patients/pages/PatientsPage'));
const PatientDetailsPage = lazy(() => import('../features/patients/pages/PatientDetailsPage'));

// Billing (feature-based)
const BillsPage = lazy(() => import('../features/billing/pages/BillsPage'));

// Cases
const Transactions = lazy(() => import('../pages/cases/Transactions'));
const Inquiries = lazy(() => import('../pages/cases/Inquiries'));
const GoogleReviews = lazy(() => import('../pages/cases/GoogleReviews'));
const ReferralDoctors = lazy(() => import('../pages/cases/ReferralDoctors'));
const Agents = lazy(() => import('../pages/cases/Agents'));
const ModalityCases = lazy(() => import('../pages/cases/ModalityCases'));

// Lab
const TodaysReports = lazy(() => import('../pages/lab/TodaysReports'));
const ReportPreview = lazy(() => import('../pages/lab/ReportPreview'));
const ResultEntry = lazy(() => import('../pages/lab/ResultEntry'));
const ResultVerification = lazy(() => import('../pages/lab/ResultVerification'));
const SearchReports = lazy(() => import('../pages/lab/SearchReports'));
const TestDatabase = lazy(() => import('../pages/lab/TestDatabase'));
const NormalRanges = lazy(() => import('../pages/lab/NormalRanges'));
const TestPackages = lazy(() => import('../pages/lab/TestPackages'));
const TestPanels = lazy(() => import('../pages/lab/TestPanels'));
const TestCategories = lazy(() => import('../pages/lab/TestCategories'));
const Interpretations = lazy(() => import('../pages/lab/Interpretations'));
const TestCounts = lazy(() => import('../pages/lab/TestCounts'));
const TestAnalysis = lazy(() => import('../pages/lab/TestAnalysis'));
const RateList = lazy(() => import('../pages/lab/RateList'));

// Business
const DailyBusiness = lazy(() => import('../pages/business/DailyBusiness'));
const MonthlyBusiness = lazy(() => import('../pages/business/MonthlyBusiness'));
const Expenses = lazy(() => import('../pages/business/Expenses'));
const DueReports = lazy(() => import('../pages/business/DueReports'));
const ReferralBusiness = lazy(() => import('../pages/business/ReferralBusiness'));
const CaseWiseReport = lazy(() => import('../pages/business/CaseWiseReport'));
const BusinessAnalysis = lazy(() => import('../pages/business/BusinessAnalysis'));
const DataExport = lazy(() => import('../pages/business/DataExport'));
const Activities = lazy(() => import('../pages/business/Activities'));
const Cashbook = lazy(() => import('../pages/business/Cashbook'));
const AuditLog = lazy(() => import('../pages/settings/AuditLog'));
const TestUsage = lazy(() => import('../pages/analytics/TestUsage'));
const Jobs = lazy(() => import('../pages/settings/Jobs'));

// USG
const TodaysUSGCases = lazy(() => import('../pages/usg/TodaysUSGCases'));
const ReportTemplates = lazy(() => import('../pages/usg/ReportTemplates'));

// X-Ray
const TodaysXrayCases = lazy(() => import('../pages/xray/TodaysXrayCases'));
const XrayReports = lazy(() => import('../pages/xray/XrayReports'));

// Manage
const EmployeeLogin = lazy(() => import('../pages/manage/EmployeeLogin'));
const Branches = lazy(() => import('../pages/manage/Branches'));
const DoctorAccess = lazy(() => import('../pages/manage/DoctorAccess'));
const BrowserSecurity = lazy(() => import('../pages/manage/BrowserSecurity'));
const RateRevision = lazy(() => import('../pages/settings/RateRevision'));
const Signatures = lazy(() => import('../pages/settings/Signatures'));

// Setup / Delivery / Support / Doctor
const LabProfile = lazy(() => import('../pages/setup/LabProfile'));
const Onboarding = lazy(() => import('../pages/setup/Onboarding'));
const TatConfig = lazy(() => import('../pages/settings/TatConfig'));
const Templates = lazy(() => import('../pages/delivery/Templates'));
const Tickets = lazy(() => import('../pages/support/Tickets'));
const DoctorPortal = lazy(() => import('../pages/doctor/DoctorPortal'));


const AppRoutes = () => {
  return (
    <Suspense fallback={<div className="route-loading" role="status" aria-label="Loading" />}>
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Admin & Staff Login Routes */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/login" element={<Login />} />

      {/* Public Patient Report Portal Routes */}
      <Route path="/patient/report" element={<PatientReportPortal />} />
      <Route path="/reports" element={<PatientReportPortal />} />

      {/* Public report verification (Labsmart parity) */}
      <Route path="/r/:token" element={<VerifyReportPage />} />
      <Route path="/r/bill/:token" element={<VerifyBill />} />

      {/* Protected Master Admin/Staff Portal Layout */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Cases */}
        <Route path="/cases/patients" element={<PatientsPage />} />
        <Route path="/cases/patients/:id" element={<PatientDetailsPage />} />
        <Route path="/cases/bills" element={<BillsPage />} />
        <Route path="/cases/bills/new" element={<BillsPage />} />
        <Route path="/cases/bills/edit/:id" element={<BillsPage />} />
        <Route path="/cases/transactions" element={<Transactions />} />
        <Route path="/cases/inquiries" element={<Inquiries />} />
        <Route path="/reviews" element={<GoogleReviews />} />
        <Route path="/cases/doctors" element={<ReferralDoctors />} />
        <Route path="/cases/agents" element={<Agents />} />
        <Route element={<RoleRoute allowedRoles={['Admin', 'Employee']} />}>
          <Route path="/cases/modality" element={<ModalityCases />} />
        </Route>

        {/* Lab */}
        <Route path="/lab/reports" element={<TodaysReports />} />
        <Route path="/lab/reports/:id/preview" element={<ReportPreview />} />
        <Route path="/lab/result-entry" element={<ResultEntry />} />
        <Route path="/lab/search" element={<SearchReports />} />
        <Route element={<RoleRoute allowedRoles={['Admin']} />}>
          <Route path="/lab/verification" element={<ResultVerification />} />
        </Route>
        <Route path="/lab/tests" element={<TestDatabase />} />
        <Route path="/lab/normal-ranges" element={<NormalRanges />} />
        <Route path="/lab/packages" element={<TestPackages />} />
        <Route path="/lab/panels" element={<TestPanels />} />
        <Route path="/lab/categories" element={<TestCategories />} />
        <Route path="/lab/interpretations" element={<Interpretations />} />
        <Route path="/lab/counts" element={<TestCounts />} />
        <Route element={<RoleRoute allowedRoles={['Admin', 'Employee']} />}>
          <Route path="/lab/analysis" element={<TestAnalysis />} />
        </Route>
        <Route path="/lab/rates" element={<RateList />} />

        {/* Business — Admin only, matching the sidebar's Business group roles */}
        <Route element={<RoleRoute allowedRoles={['Admin']} />}>
          <Route path="/business/daily" element={<DailyBusiness />} />
          <Route path="/business/monthly" element={<MonthlyBusiness />} />
          <Route path="/business/expenses" element={<Expenses />} />
          <Route path="/business/dues" element={<DueReports />} />
          <Route path="/business/referrals" element={<ReferralBusiness />} />
          <Route path="/business/cases" element={<CaseWiseReport />} />
          <Route path="/business/analysis" element={<BusinessAnalysis />} />
          <Route path="/business/export" element={<DataExport />} />
          <Route path="/lab/export" element={<DataExport />} />
          <Route path="/business/activities" element={<Activities />} />
          <Route path="/business/cashbook" element={<Cashbook />} />
          <Route path="/analytics/test-usage" element={<TestUsage />} />
        </Route>

        {/* USG — Today + Search merged into one Cases page */}
        <Route path="/usg/today" element={<TodaysUSGCases key="cases" />} />
        <Route path="/usg/reports" element={<TodaysUSGCases key="reports" reportsView />} />
        <Route path="/usg/search" element={<Navigate to="/usg/today" replace />} />
        <Route path="/usg/templates" element={<ReportTemplates />} />

        {/* X-Ray — Today + Search merged into one Cases page */}
        <Route path="/xray/today" element={<TodaysXrayCases />} />
        <Route path="/xray/search" element={<Navigate to="/xray/today" replace />} />
        <Route path="/xray/reports" element={<XrayReports />} />

        {/* Manage — Admin Only */}
        <Route element={<RoleRoute allowedRoles={['Admin']} />}>
          <Route path="/manage/employees" element={<EmployeeLogin />} />
          <Route path="/manage/branches" element={<Branches />} />
          <Route path="/manage/doctors" element={<DoctorAccess />} />
          <Route path="/manage/security" element={<BrowserSecurity />} />
          <Route path="/settings/rate-revision" element={<RateRevision />} />
          <Route path="/settings/signatures" element={<Signatures />} />
          <Route path="/setup/profile" element={<LabProfile />} />
          <Route path="/setup/onboarding" element={<Onboarding />} />
          <Route path="/settings/jobs" element={<Jobs />} />
          <Route path="/settings/tat" element={<TatConfig />} />
          <Route path="/settings/audit-log" element={<AuditLog />} />
          <Route path="/delivery/templates" element={<Templates />} />
          <Route path="/support/tickets" element={<Tickets />} />
        </Route>

        {/* Doctor portal */}
        <Route element={<RoleRoute allowedRoles={['Doctor', 'Admin']} />}>
          <Route path="/doctor" element={<DoctorPortal />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
};

export default AppRoutes;
