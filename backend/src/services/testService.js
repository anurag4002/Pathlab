const Test = require('../models/Test');
const TestCategory = require('../models/TestCategory');
const TestPanel = require('../models/TestPanel');
const TestPackage = require('../models/TestPackage');
const Interpretation = require('../models/Interpretation');

// Test Categories
const getCategories = async () => {
  return await TestCategory.find().sort({ name: 1 });
};

const createCategory = async (data) => {
  return await TestCategory.create(data);
};

const updateCategory = async (id, data) => {
  return await TestCategory.findByIdAndUpdate(id, data, { new: true });
};

const deleteCategory = async (id) => {
  return await TestCategory.findByIdAndDelete(id);
};

// Tests
const getTests = async (filters = {}) => {
  const query = {};
  if (filters.category) query.category = filters.category;
  if (filters.status) query.status = filters.status;
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { code: { $regex: filters.search, $options: 'i' } }
    ];
  }
  return await Test.find(query).populate('category').sort({ name: 1 });
};

const createTest = async (data) => {
  return await Test.create(data);
};

const updateTest = async (id, data) => {
  return await Test.findByIdAndUpdate(id, data, { new: true });
};

const deleteTest = async (id) => {
  return await Test.findByIdAndDelete(id);
};

const updateTestRate = async (id, price) => {
  return await Test.findByIdAndUpdate(id, { price }, { new: true });
};

// Atomic-ish bulk rate update: sequential updates with per-item outcome counts.
const bulkUpdateTestRates = async (updates = []) => {
  const results = { ok: 0, failed: 0, errors: [] };
  for (const u of updates) {
    try {
      if (!u || !u.id || u.price === undefined || u.price === null || isNaN(Number(u.price)) || Number(u.price) < 0) {
        results.failed += 1;
        results.errors.push({ id: u && u.id, error: 'Invalid id or price' });
        continue;
      }
      const updated = await Test.findByIdAndUpdate(u.id, { price: Number(u.price) }, { new: true });
      if (!updated) {
        results.failed += 1;
        results.errors.push({ id: u.id, error: 'Test not found' });
      } else {
        results.ok += 1;
      }
    } catch (err) {
      results.failed += 1;
      results.errors.push({ id: u && u.id, error: err.message });
    }
  }
  return results;
};

// Panels
const getPanels = async () => {
  return await TestPanel.find().populate('tests').sort({ name: 1 });
};

const createPanel = async (data) => {
  return await TestPanel.create(data);
};

const updatePanel = async (id, data) => {
  return await TestPanel.findByIdAndUpdate(id, data, { new: true });
};

const deletePanel = async (id) => {
  return await TestPanel.findByIdAndDelete(id);
};

// Packages
const getPackages = async () => {
  return await TestPackage.find().populate('includedTests').sort({ name: 1 });
};

const createPackage = async (data) => {
  return await TestPackage.create(data);
};

const updatePackage = async (id, data) => {
  return await TestPackage.findByIdAndUpdate(id, data, { new: true });
};

const deletePackage = async (id) => {
  return await TestPackage.findByIdAndDelete(id);
};

// Interpretations
const getInterpretations = async (testId = null) => {
  const query = {};
  if (testId) query.test = testId;
  return await Interpretation.find(query).populate('test', 'name code').sort({ resultCondition: 1 });
};

const createInterpretation = async (data) => {
  return await Interpretation.create(data);
};

const updateInterpretation = async (id, data) => {
  return await Interpretation.findByIdAndUpdate(id, data, { new: true });
};

const deleteInterpretation = async (id) => {
  return await Interpretation.findByIdAndDelete(id);
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getTests,
  createTest,
  updateTest,
  deleteTest,
  updateTestRate,
  bulkUpdateTestRates,
  getPanels,
  createPanel,
  updatePanel,
  deletePanel,
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
  getInterpretations,
  createInterpretation,
  updateInterpretation,
  deleteInterpretation
};
