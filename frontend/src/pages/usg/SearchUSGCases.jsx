import TodaysUSGCases from './TodaysUSGCases';

// Merged: Today's Cases + Search Cases are now a single unified "USG Cases"
// page (TodaysUSGCases) with date scope, search bar, filters and pagination.
// This module is kept so old imports keep working; /usg/search redirects to
// /usg/today in AppRoutes.
export default TodaysUSGCases;
