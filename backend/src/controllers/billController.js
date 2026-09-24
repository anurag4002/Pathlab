const billService = require('../services/billService');
const { successResponse, errorResponse } = require('../utils/response');
const { validateBill } = require('../validators/billValidator');
const MESSAGES = require('../constants/messages');
const Activity = require('../models/Activity');

const getBills = async (req, res, next) => {
  try {
    const filters = {
      paymentStatus: req.query.paymentStatus,
      patientId: req.query.patientId,
      search: req.query.search,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      department: req.query.department,
      duration: req.query.duration,
      regNo: req.query.regNo || req.query.regno,
      firstName: req.query.firstName || req.query.patientName,
      referredBy: req.query.referredBy || req.query.referrer,
      collectionCentre: req.query.collectionCentre || req.query.centre,
      agent: req.query.agent || req.query.sampleCollector,
      hasDue: req.query.hasDue,
      cancelled: req.query.cancelled,
      excludeCancelled: req.query.excludeCancelled,
      caseType: req.query.caseType,
      uhid: req.query.uhid,
      dailyCaseNo: req.query.dailyCaseNo,
      includeVoided: req.query.includeVoided === 'true' || req.query.includeVoided === '1',
      page: req.query.page,
      limit: req.query.limit
    };
    const data = await billService.getBills(filters);
    return successResponse(res, 'Bills retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

const getBillById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bill = await billService.getBillById(id);
    if (!bill) {
      return errorResponse(res, MESSAGES.BILL.NOT_FOUND, 404);
    }
    return successResponse(res, 'Bill loaded successfully', bill);
  } catch (error) {
    next(error);
  }
};

const createBill = async (req, res, next) => {
  try {
    const { errors, isValid } = validateBill(req.body);
    if (!isValid) {
      return errorResponse(res, MESSAGES.GENERAL.VALIDATION_ERROR, 400, errors);
    }

    const bill = await billService.createBill(req.body, req.user._id);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create Bill',
      module: 'Cases',
      description: `Generated invoice ${bill.billNumber} for amount INR ${bill.totalAmount}.`
    });

    return successResponse(res, MESSAGES.BILL.CREATED, bill, 201);
  } catch (error) {
    next(error);
  }
};

const collectPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod } = req.body;

    if (!amount || Number(amount) <= 0) {
      return errorResponse(res, 'Amount must be greater than 0', 400);
    }

    const updatedBill = await billService.addPayment(id, { amount, paymentMethod }, req.user._id);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Collect Payment',
      module: 'Cases',
      description: `Collected payment of INR ${amount} on invoice ${updatedBill.billNumber}.`
    });

    return successResponse(res, MESSAGES.BILL.PAYMENT_ADDED, updatedBill);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBills,
  getBillById,
  createBill,
  collectPayment,
  voidBill,
  refundBill,
  updateBill,
  getCashbook,
  createManualCashEntry,
  billPdfDownload,
  billQr,
  billBarcode
};

const Bill = require('../models/Bill');
const LabProfile = require('../models/LabProfile');
const { billPdf } = require('../services/pdfService');
const { qrDataURL, qrBuffer, billVerifyUrl } = require('../services/qrService');
const { toSVG: barcodeSVG } = require('../services/code39Service');

async function voidBill(req, res, next) {
  try {
    const bill = await billService.voidBill(req.params.id, req.body.reason, req.user._id);
    await Activity.create({
      user: req.user._id,
      action: 'Void Bill',
      module: 'Cases',
      description: `Voided invoice ${bill.billNumber}. Reason: ${req.body.reason || 'not specified'}.`
    });
    return successResponse(res, 'Bill voided (kept in history)', bill);
  } catch (error) {
    next(error);
  }
}

async function billPdfDownload(req, res, next) {
  try {
    const letterhead = req.query.letterhead !== '0';
    const bill = await Bill.findById(req.params.id).populate('patient').populate('referringDoctor').populate('agent').populate('items');
    if (!bill) return errorResponse(res, MESSAGES.BILL.NOT_FOUND, 404);
    const token = await billService.ensureBillQrToken(bill);
    let profile = null;
    try { profile = await LabProfile.findOne(); } catch (e) { profile = null; }
    const qrPng = await qrBuffer(billVerifyUrl(token));
    const pdf = await billPdf(
      { bill, patient: bill.patient, doctor: bill.referringDoctor, agent: bill.agent, items: bill.items, profile },
      { letterhead, qrPng }
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Bill-PDF', 'v2-table-engine');
    res.setHeader('Content-Disposition', `attachment; filename="Bill_${bill.billNumber}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    next(error);
  }
}

async function billQr(req, res, next) {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return errorResponse(res, MESSAGES.BILL.NOT_FOUND, 404);
    const token = await billService.ensureBillQrToken(bill);
    const dataUrl = await qrDataURL(billVerifyUrl(token));
    return successResponse(res, 'Bill QR generated', { qrToken: token, verifyUrl: billVerifyUrl(token), qrDataUrl: dataUrl });
  } catch (error) {
    next(error);
  }
}

async function billBarcode(req, res, next) {
  try {
    const bill = await Bill.findById(req.params.id).select('billNumber');
    if (!bill) return errorResponse(res, MESSAGES.BILL.NOT_FOUND, 404);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(barcodeSVG(bill.billNumber));
  } catch (error) {
    next(error);
  }
}

async function refundBill(req, res, next) {
  try {
    const bill = await billService.refundBill(req.params.id, req.body || {}, req.user._id);
    return successResponse(res, 'Refund recorded', bill);
  } catch (error) {
    next(error);
  }
}

async function updateBill(req, res, next) {
  try {
    const bill = await billService.updateBill(req.params.id, req.body || {}, req.user);
    await Activity.create({
      user: req.user._id,
      action: 'Update Bill',
      module: 'Cases',
      description: `Updated invoice ${bill.billNumber}.`
    });
    return successResponse(res, 'Bill updated', bill);
  } catch (error) {
    next(error);
  }
}

async function getCashbook(req, res, next) {
  try {
    const data = await billService.getCashbook({
      from: req.query.from || req.query.startDate,
      to: req.query.to || req.query.endDate,
      mode: req.query.mode || req.query.paymentMethod,
      type: req.query.type,
      page: req.query.page,
      limit: req.query.limit
    });
    return successResponse(res, 'Cashbook loaded', data);
  } catch (error) {
    next(error);
  }
}

async function createManualCashEntry(req, res, next) {
  try {
    const txn = await billService.createManualCashEntry(req.body || {}, req.user._id);
    return successResponse(res, 'Manual cash entry recorded', txn, 201);
  } catch (error) {
    next(error);
  }
}
