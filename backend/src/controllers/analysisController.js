const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Test = require('../models/Test');
const { successResponse, errorResponse } = require('../utils/response');

// GET /api/analysis/test-usage?from=&to=&page=&limit=
// Server-side aggregation: Bills (window) -> BillItems (group by test) ->
// Test catalog (code/name). Paginated; only the page is sent to the client.
const getTestUsage = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const billMatch = { isVoided: { $ne: true } };
    if (from || to) {
      billMatch.date = {};
      if (from) billMatch.date.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        billMatch.date.$lte = end;
      }
      if (billMatch.date.$gte && billMatch.date.$lte && billMatch.date.$gte > billMatch.date.$lte) {
        return errorResponse(res, 'Invalid date range: from is after to', 400);
      }
    }

    // Bill ids in window (ids only — never shipped to the client).
    const bills = await Bill.find(billMatch).select('_id').lean();
    const billIds = bills.map((b) => b._id);
    if (billIds.length === 0) {
      return successResponse(res, 'Test usage loaded', {
        items: [],
        slowest: [],
        totals: { orders: 0, revenue: 0, distinctTests: 0, bills: 0 },
        pagination: { total: 0, page, limit, pages: 0 }
      });
    }

    // Group BillItems by itemId within the window.
    const grouped = await BillItem.aggregate([
      { $match: { billId: { $in: billIds } } },
      {
        $group: {
          _id: '$itemId',
          name: { $first: '$name' },
          itemType: { $first: '$itemType' },
          count: { $sum: 1 },
          revenue: { $sum: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Enrich Test-type rows with catalog code/name.
    const testIds = grouped
      .filter((g) => g.itemType === 'Test' && mongoose.Types.ObjectId.isValid(String(g._id)))
      .map((g) => new mongoose.Types.ObjectId(String(g._id)));
    const tests = testIds.length ? await Test.find({ _id: { $in: testIds } }).select('code name').lean() : [];
    const testMap = {};
    tests.forEach((t) => { testMap[String(t._id)] = t; });

    const all = grouped.map((g) => {
      const catalog = testMap[String(g._id)];
      return {
        testId: String(g._id),
        code: catalog ? catalog.code : '',
        name: catalog ? catalog.name : (g.name || ''),
        count: g.count,
        revenue: g.revenue
      };
    });

    const totals = {
      orders: all.reduce((s, r) => s + r.count, 0),
      revenue: all.reduce((s, r) => s + r.revenue, 0),
      distinctTests: all.length,
      bills: billIds.length
    };
    const slowest = [...all].sort((a, b) => a.count - b.count).slice(0, 5);
    const total = all.length;
    const items = all.slice((page - 1) * limit, page * limit);

    return successResponse(res, 'Test usage loaded', {
      items,
      slowest,
      totals,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTestUsage };
