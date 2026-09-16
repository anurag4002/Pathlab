const Bill = require('../models/Bill');
const Patient = require('../models/Patient');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const { successResponse, errorResponse } = require('../utils/response');

// Server-side CSV export with date windows (31d / 365d parity).
// GET /api/export/:dataset.csv?startDate&endDate  (finance permission or Admin)

function toCsv(headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

function windowed(query, { startDate, endDate }, field = 'date') {
  if (startDate || endDate) {
    query[field] = {};
    if (startDate) query[field].$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query[field].$lte = end;
    }
  }
  return query;
}

const exportCsv = async (req, res, next) => {
  try {
    const { dataset } = req.params;
    const { startDate, endDate } = req.query;
    let headers = [];
    let rows = [];
    let filename = `${dataset}.csv`;

    if (dataset === 'bills') {
      const bills = await Bill.find(windowed({}, { startDate, endDate }))
        .populate('patient', 'name registrationNumber phone')
        .sort({ date: -1 })
        .limit(5000);
      headers = ['Bill No', 'Date', 'Patient', 'Reg No', 'Department', 'Total', 'Paid', 'Due', 'Status', 'Method', 'Voided'];
      rows = bills.map((b) => [b.billNumber, b.date.toISOString(), b.patient ? b.patient.name : '', b.patient ? b.patient.registrationNumber : '', b.department, b.totalAmount, b.paidAmount, b.dueAmount, b.paymentStatus, b.paymentMethod, b.isVoided ? 'Yes' : 'No']);
    } else if (dataset === 'patients') {
      const patients = await Patient.find(windowed({}, { startDate, endDate })).sort({ date: -1 }).limit(5000);
      headers = ['Reg No', 'Name', 'Age', 'Gender', 'Phone', 'Address', 'Date'];
      rows = patients.map((p) => [p.registrationNumber, p.name, p.age, p.gender, p.phone, p.address, p.date.toISOString()]);
    } else if (dataset === 'expenses') {
      const expenses = await Expense.find(windowed({}, { startDate, endDate })).sort({ date: -1 }).limit(5000);
      headers = ['Date', 'Category', 'Description', 'Method', 'Amount'];
      rows = expenses.map((e) => [e.date.toISOString(), e.category, e.description, e.paymentMethod, e.amount]);
    } else if (dataset === 'transactions') {
      const txns = await Transaction.find(windowed({}, { startDate, endDate }))
        .populate('patient', 'name registrationNumber')
        .populate('receivedBy', 'name')
        .sort({ date: -1 })
        .limit(5000);
      headers = ['Date', 'Type', 'Patient', 'Amount', 'Method', 'Received By'];
      rows = txns.map((t) => [t.date.toISOString(), t.type, t.patient ? t.patient.name : '', t.amount, t.paymentMethod, t.receivedBy ? t.receivedBy.name : '']);
    } else {
      return errorResponse(res, 'Unknown dataset. Use bills|patients|expenses|transactions.', 400);
    }

    filename = `${dataset}_${startDate || 'all'}_${endDate || 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('\uFEFF' + toCsv(headers, rows));
  } catch (error) {
    next(error);
  }
};

module.exports = { exportCsv };
