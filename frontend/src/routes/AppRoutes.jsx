import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import AppLayout from '../components/layout/AppLayout';

// Public Landing Page
import LandingPage from '../pages/public/LandingPage';
import VerifyReportPage from '../pages/public/VerifyReport';
import VerifyBill from '../pages/public/VerifyBill';

// Auth
import Login from '../features/auth/pages/Login';

// Patient Portal
import PatientReportPortal from '../pages/patient/PatientReportPortal';

// Dashboard
import DashboardPage from '../features/dashboard/pages/DashboardPage';

// Patients (feature-based)
import PatientsPage from '../features/patients/pages/PatientsPage';
import PatientDetailsPage from '../features/patients/pages/PatientDetailsPage';

// Billing (feature-based)
import BillsPage from '../features/billing/pages/BillsPage';

// Cases
import Transactions from '../pages/cases/Transactions';
import Inquiries from '../pages/cases/Inquiries';
import ReferralDoctors from '../pages/cases/ReferralDoctors';
import Agents from '../pages/cases/Agents';
import ModalityCases from '../pages/cases/ModalityCases';

// Lab
import TodaysReports from '../pages/lab/TodaysReports';
import ReportPreview from '../pages/lab/ReportPreview';
import ResultEntry from '../pages/lab/ResultEntry';
import ResultVerification from '../pages/lab/ResultVerification';
import SearchReports from '../pages/lab/SearchReports';
import TestDatabase from '../pages/lab/TestDatabase';
import NormalRanges from '../pages/lab/NormalRanges';
import TestPackages from '../pages/lab/TestPackages';
import TestPanels from '../pages/lab/TestPanels';
import TestCategories from '../pages/lab/TestCategories';
import Interpretations from '../pages/lab/Interpretations';
import TestCounts from '../pages/lab/TestCounts';
import TestAnalysis from '../pages/lab/TestAnalysis';
import RateList from '../pages/lab/RateList';

// Business
import DailyBusiness from '../pages/business/DailyBusiness';
import MonthlyBusiness from '../pages/business/MonthlyBusiness';
import Expenses from '../pages/business/Expenses';
import DueReports from '../pages/business/DueReports';
import ReferralBusiness from '../pages/business/ReferralBusiness';
import CaseWiseReport from '../pages/business/CaseWiseReport';
import BusinessAnalysis from '../pages/business/BusinessAnalysis';
import DataExport from '../pages/business/DataExport';
import Activities from '../pages/business/Activities';
import Cashbook from '../pages/business/Cashbook';
import AuditLog from '../pages/settings/AuditLog';
import TestUsage from '../pages/analytics/TestUsage';
import Jobs from '../pages/settings/Jobs';

// USG
import TodaysUSGCases from '../pages/usg/TodaysUSGCases';
import ReportTemplates from '../pages/usg/ReportTemplates';

// X-Ray
import TodaysXrayCases from '../pages/xray/TodaysXrayCases';
import XrayReports from '../pages/xray/XrayReports';

// Manage
import EmployeeLogin from '../pages/manage/EmployeeLogin';
import Branches from '../pages/manage/Branches';
import DoctorAccess from '../pages/manage/DoctorAccess';
import BrowserSecurity from '../pages/manage/BrowserSecurity';
import RateRevision from '../pages/settings/RateRevision';
import Signatures from '../pages/settings/Signatures';

// Setup / Delivery / Support / Doctor
import LabProfile from '../pages/setup/LabProfile';
import Onboarding from '../pages/setup/Onboarding';
import TatConfig from '../pages/settings/TatConfig';
import Templates from '../pages/delivery/Templates';
import Tickets from '../pages/support/Tickets';
import DoctorPortal from '../pages/doctor/DoctorPortal';

const AppRoutes = () => {
  return (
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
        <Route path="/cases/transactions" element={<Transactions />} />
        <Route path="/cases/inquiries" element={<Inquiries />} />
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
        <Route path="/usg/today" element={<TodaysUSGCases />} />
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
  );
};

export default AppRoutes;
