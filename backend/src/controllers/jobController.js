const Job = require('../models/Job');
const { sendTemplated } = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/response');

const getJobs = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const [jobs, total] = await Promise.all([
      Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Job.countDocuments(query)
    ]);
    return successResponse(res, 'Jobs retrieved successfully', {
      jobs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

// Idempotent retry: Done jobs return as-is; otherwise attempts++ and
// notify-type jobs are re-dispatched via sendTemplated.
const retryJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', 404);
    if (job.status === 'Done') {
      return successResponse(res, 'Job already completed (idempotent)', job);
    }
    job.attempts = (job.attempts || 0) + 1;
    if (job.type === 'notify') {
      const p = job.payload || {};
      try {
        const result = await sendTemplated(p.channel, p.templateKey, p.to, p.vars || {});
        if (result && result.ok) {
          job.status = 'Done';
          job.error = '';
        } else {
          job.status = 'Failed';
          job.error = (result && result.error) || 'Re-dispatch failed';
        }
      } catch (err) {
        job.status = 'Failed';
        job.error = err.message || 'Re-dispatch threw';
      }
    } else {
      // Export-type retries are a no-op keeper: bump attempts, leave for
      // the export worker. Never mark Done without real work.
      if (job.status !== 'Failed') job.status = 'Pending';
    }
    await job.save();
    return successResponse(res, 'Job retry processed', job);
  } catch (error) {
    next(error);
  }
};

module.exports = { getJobs, retryJob };
