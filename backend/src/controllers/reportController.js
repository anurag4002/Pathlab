const reportService = require('../services/reportService');
const { successResponse, errorResponse } = require('../utils/response');
const Activity = require('../models/Activity');

const getReports = async (req, res, next) => {
  try {
    const filters = {
      patientId: req.query.patientId,
      billId: req.query.billId,
      registrationNumber: req.query.registrationNumber,
      page: req.query.page,
      limit: req.query.limit
    };
    const data = await reportService.getReports(filters);
    return successResponse(res, 'Reports loaded successfully', data);
  } catch (error) {
    next(error);
  }
};

const uploadReport = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload a file', 400);
    }

    const { patient, bill, test } = req.body;
    if (!patient || !bill) {
      return errorResponse(res, 'Patient ID and Bill ID are required', 400);
    }

    const report = await reportService.createReport(
      { patient, bill, test },
      req.file,
      req.user
    );

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Upload Report',
      module: 'Lab',
      description: `Uploaded laboratory findings report for patient registration ${report.registrationNumber}.`
    });

    return successResponse(res, 'Report uploaded successfully', report, 201);
  } catch (error) {
    next(error);
  }
};

const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    await reportService.deleteReport(id);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Delete Report',
      module: 'Lab',
      description: `Deleted laboratory report ID ${id}.`
    });

    return successResponse(res, 'Report deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReports,
  uploadReport,
  deleteReport
};
