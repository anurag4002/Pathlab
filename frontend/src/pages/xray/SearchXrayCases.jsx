import TodaysXrayCases from './TodaysXrayCases';

// Merged: Today's Cases + Search Cases are now a single unified "X-Ray Cases"
// page (TodaysXrayCases) with date scope, search bar, filters and pagination.
// This module is kept so old imports keep working; /xray/search redirects to
// /xray/today in AppRoutes.
export default TodaysXrayCases;
