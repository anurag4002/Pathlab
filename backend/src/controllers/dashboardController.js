const dashboardService = require('../services/dashboardService');
const { successResponse } = require('../utils/response');

const { getBranchFilter } = require('../middleware/branchMiddleware');

const getDashboardSummary = async (req, res, next) => {
  try {
    const scope = getBranchFilter(req);
    const stats = await dashboardService.getDashboardStats(scope.branch || null);
    return successResponse(res, 'Dashboard statistics loaded successfully', stats);
  } catch (error) {
    next(error);
  }
};

const getDailyBusinessReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const scope = getBranchFilter(req);
    const report = await dashboardService.getDailyBusiness(startDate, endDate, scope.branch || null);
    return successResponse(res, 'Daily business report loaded successfully', report);
  } catch (error) {
    next(error);
  }
};

const getReferralReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const scope = getBranchFilter(req);
    const report = await dashboardService.getReferralBusiness(startDate, endDate, scope.branch || null);
    return successResponse(res, 'Referral doctor business report loaded successfully', report);
  } catch (error) {
    next(error);
  }
};

const getActivityLogs = async (req, res, next) => {
  try {
    const activities = await dashboardService.getActivities();
    return successResponse(res, 'Audit log activities loaded successfully', activities);
  } catch (error) {
    next(error);
  }
};

const getMonthlyTrendsReport = async (req, res, next) => {
  try {
    const scope = getBranchFilter(req);
    const trends = await dashboardService.getMonthlyTrends(scope.branch || null);
    return successResponse(res, 'Monthly trends aggregated successfully', trends);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary,
  getDailyBusinessReport,
  getReferralReport,
  getActivityLogs,
  getMonthlyTrendsReport
};
