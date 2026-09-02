import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import AppLayout from '../components/layout/AppLayout';

// Public Landing Page
import LandingPage from '../pages/public/LandingPage';

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
import ReferralDoctors from '../pages/cases/ReferralDoctors';
import Agents from '../pages/cases/Agents';

// Lab
import TodaysReports from '../pages/lab/TodaysReports';
import SearchReports from '../pages/lab/SearchReports';
import TestDatabase from '../pages/lab/TestDatabase';
import TestPackages from '../pages/lab/TestPackages';
import TestPanels from '../pages/lab/TestPanels';
import TestCategories from '../pages/lab/TestCategories';
import Interpretations from '../pages/lab/Interpretations';
import TestCounts from '../pages/lab/TestCounts';

// Business
import DailyBusiness from '../pages/business/DailyBusiness';
import Expenses from '../pages/business/Expenses';
import DueReports from '../pages/business/DueReports';
import ReferralBusiness from '../pages/business/ReferralBusiness';
import CaseWiseReport from '../pages/business/CaseWiseReport';
import BusinessAnalysis from '../pages/business/BusinessAnalysis';
import DataExport from '../pages/business/DataExport';
import Activities from '../pages/business/Activities';

// USG
import TodaysUSGCases from '../pages/usg/TodaysUSGCases';
import SearchUSGCases from '../pages/usg/SearchUSGCases';
import ReportTemplates from '../pages/usg/ReportTemplates';

// X-Ray
import TodaysXrayCases from '../pages/xray/TodaysXrayCases';
import SearchXrayCases from '../pages/xray/SearchXrayCases';
import XrayReports from '../pages/xray/XrayReports';

// Manage
import EmployeeLogin from '../pages/manage/EmployeeLogin';
import DoctorAccess from '../pages/manage/DoctorAccess';
import BrowserSecurity from '../pages/manage/BrowserSecurity';

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
        <Route path="/cases/doctors" element={<ReferralDoctors />} />
        <Route path="/cases/agents" element={<Agents />} />

        {/* Lab */}
        <Route path="/lab/reports" element={<TodaysReports />} />
        <Route path="/lab/search" element={<SearchReports />} />
        <Route path="/lab/tests" element={<TestDatabase />} />
        <Route path="/lab/packages" element={<TestPackages />} />
        <Route path="/lab/panels" element={<TestPanels />} />
        <Route path="/lab/categories" element={<TestCategories />} />
        <Route path="/lab/interpretations" element={<Interpretations />} />
        <Route path="/lab/counts" element={<TestCounts />} />

        {/* Business */}
        <Route path="/business/daily" element={<DailyBusiness />} />
        <Route path="/business/expenses" element={<Expenses />} />
        <Route path="/business/dues" element={<DueReports />} />
        <Route path="/business/referrals" element={<ReferralBusiness />} />
        <Route path="/business/cases" element={<CaseWiseReport />} />
        <Route path="/business/analysis" element={<BusinessAnalysis />} />
        <Route path="/business/export" element={<DataExport />} />
        <Route path="/business/activities" element={<Activities />} />

        {/* USG */}
        <Route path="/usg/today" element={<TodaysUSGCases />} />
        <Route path="/usg/search" element={<SearchUSGCases />} />
        <Route path="/usg/templates" element={<ReportTemplates />} />

        {/* X-Ray */}
        <Route path="/xray/today" element={<TodaysXrayCases />} />
        <Route path="/xray/search" element={<SearchXrayCases />} />
        <Route path="/xray/reports" element={<XrayReports />} />

        {/* Manage — Admin Only */}
        <Route element={<RoleRoute allowedRoles={['Admin']} />}>
          <Route path="/manage/employees" element={<EmployeeLogin />} />
          <Route path="/manage/doctors" element={<DoctorAccess />} />
          <Route path="/manage/security" element={<BrowserSecurity />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
