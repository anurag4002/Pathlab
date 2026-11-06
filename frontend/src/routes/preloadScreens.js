// The screens staff open all day load in the background after sign-in, so
// switching to them never waits for a download. Same paths as AppRoutes'
// lazy imports, so the browser reuses the downloaded code.
export const preloadBusyScreens = () => Promise.all([
  import('../features/dashboard/pages/DashboardPage'),
  import('../features/patients/pages/PatientsPage'),
  import('../features/billing/pages/BillsPage'),
  import('../pages/cases/GoogleReviews'),
  import('../pages/lab/TodaysReports'),
  import('../pages/lab/ResultEntry'),
  import('../pages/lab/ResultVerification')
]).catch(() => {});
