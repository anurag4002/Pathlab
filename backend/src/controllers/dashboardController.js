const dashboardService = require('../services/dashboardService');
const { successResponse } = require('../utils/response');

const getDashboardSummary = async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats();
    return successResponse(res, 'Dashboard statistics loaded successfully', stats);
  } catch (error) {
    next(error);
  }
};

const getDailyBusinessReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await dashboardService.getDailyBusiness(startDate, endDate);
    return successResponse(res, 'Daily business report loaded successfully', report);
  } catch (error) {
    next(error);
  }
};

const getReferralReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await dashboardService.getReferralBusiness(startDate, endDate);
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
    const trends = await dashboardService.getMonthlyTrends();
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
