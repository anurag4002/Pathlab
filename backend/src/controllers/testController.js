const testService = require('../services/testService');
const { successResponse, errorResponse } = require('../utils/response');
const { validateTest } = require('../validators/testValidator');
const Activity = require('../models/Activity');

// Whitelisted fields for POST/PUT /api/tests (backward compatible:
// legacy string ranges kept, numeric ranges/derived fields added Phase 2).
const ALLOWED_TEST_FIELDS = [
  'name', 'code', 'category', 'sampleType', 'unit',
  'referenceRange', 'maleReferenceRange', 'femaleReferenceRange',
  'price', 'description', 'interpretation', 'status',
  'normalLow', 'normalHigh', 'criticalLow', 'criticalHigh',
  'ageMin', 'ageMax', 'sexApplicable', 'isDerived', 'formula'
];

const sanitizeTestPayload = (body = {}) => {
  const out = {};
  for (const key of ALLOWED_TEST_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key] === '' ? null : body[key];
  }
  // Keep string empties as '' for legacy display fields
  for (const key of ['unit', 'referenceRange', 'maleReferenceRange', 'femaleReferenceRange', 'description', 'interpretation', 'formula']) {
    if (body[key] === '') out[key] = '';
  }
  if (out.formula === null) out.formula = '';
  return out;
};

// Categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await testService.getCategories();
    return successResponse(res, 'Test categories fetched successfully', categories);
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return errorResponse(res, 'Category name is required', 400);

    const category = await testService.createCategory({ name, description });
    return successResponse(res, 'Category created successfully', category, 201);
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await testService.updateCategory(id, req.body);
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, 'Category updated successfully', category);
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await testService.deleteCategory(id);
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
};

// Tests
const getTests = async (req, res, next) => {
  try {
    const filters = {
      category: req.query.category,
      status: req.query.status,
      search: req.query.search
    };
    const tests = await testService.getTests(filters);
    return successResponse(res, 'Tests loaded successfully', tests);
  } catch (error) {
    next(error);
  }
};

const createTest = async (req, res, next) => {
  try {
    const payload = sanitizeTestPayload(req.body);
    const { errors, isValid } = validateTest({ ...req.body, ...payload });
    if (!isValid) return errorResponse(res, 'Validation failed', 400, errors);

    const test = await testService.createTest(payload);
    
    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Create Test',
      module: 'Lab',
      description: `Created laboratory test ${test.name} (${test.code}).`
    });

    return successResponse(res, 'Test created successfully', test, 201);
  } catch (error) {
    next(error);
  }
};

const updateTest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = sanitizeTestPayload(req.body);
    // Merge with existing record so partial updates (e.g. rate-only) still
    // pass required-field validation (backward compat).
    const existing = await testService.getTests({});
    const current = existing.find((t) => String(t._id) === String(id));
    const merged = { ...(current ? current.toObject() : {}), ...payload };
    const { errors, isValid } = validateTest(merged);
    if (!isValid) return errorResponse(res, 'Validation failed', 400, errors);

    const test = await testService.updateTest(id, payload);
    if (!test) return errorResponse(res, 'Test not found', 404);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Update Test',
      module: 'Lab',
      description: `Updated laboratory test ${test.name} (${test.code}).`
    });

    return successResponse(res, 'Test updated successfully', test);
  } catch (error) {
    next(error);
  }
};

const deleteTest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const test = await testService.deleteTest(id);
    if (!test) return errorResponse(res, 'Test not found', 404);

    // Log Activity
    await Activity.create({
      user: req.user._id,
      action: 'Delete Test',
      module: 'Lab',
      description: `Deleted laboratory test ${test.name}.`
    });

    return successResponse(res, 'Test deleted successfully');
  } catch (error) {
    next(error);
  }
};

// Panels
const getPanels = async (req, res, next) => {
  try {
    const panels = await testService.getPanels();
    return successResponse(res, 'Panels fetched successfully', panels);
  } catch (error) {
    next(error);
  }
};

const createPanel = async (req, res, next) => {
  try {
    const { name, tests, price, description, status } = req.body;
    if (!name || !tests || tests.length === 0 || price === undefined) {
      return errorResponse(res, 'Name, tests list, and price are required', 400);
    }
    const panel = await testService.createPanel({ name, tests, price, description, status });
    return successResponse(res, 'Panel created successfully', panel, 201);
  } catch (error) {
    next(error);
  }
};

const updatePanel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const panel = await testService.updatePanel(id, req.body);
    if (!panel) return errorResponse(res, 'Panel not found', 404);
    return successResponse(res, 'Panel updated successfully', panel);
  } catch (error) {
    next(error);
  }
};

const deletePanel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const panel = await testService.deletePanel(id);
    if (!panel) return errorResponse(res, 'Panel not found', 404);
    return successResponse(res, 'Panel deleted successfully');
  } catch (error) {
    next(error);
  }
};

// Packages
const getPackages = async (req, res, next) => {
  try {
    const packages = await testService.getPackages();
    return successResponse(res, 'Packages fetched successfully', packages);
  } catch (error) {
    next(error);
  }
};

const createPackage = async (req, res, next) => {
  try {
    const { name, price, gender, includedTests, description, status } = req.body;
    if (!name || price === undefined || !includedTests || includedTests.length === 0) {
      return errorResponse(res, 'Name, price, and included tests list are required', 400);
    }
    const pkg = await testService.createPackage({ name, price, gender, includedTests, description, status });
    return successResponse(res, 'Package created successfully', pkg, 201);
  } catch (error) {
    next(error);
  }
};

const updatePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await testService.updatePackage(id, req.body);
    if (!pkg) return errorResponse(res, 'Package not found', 404);
    return successResponse(res, 'Package updated successfully', pkg);
  } catch (error) {
    next(error);
  }
};

const deletePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await testService.deletePackage(id);
    if (!pkg) return errorResponse(res, 'Package not found', 404);
    return successResponse(res, 'Package deleted successfully');
  } catch (error) {
    next(error);
  }
};

// Interpretations
const getInterpretations = async (req, res, next) => {
  try {
    const { testId } = req.query;
    const interpretations = await testService.getInterpretations(testId);
    return successResponse(res, 'Interpretations loaded successfully', interpretations);
  } catch (error) {
    next(error);
  }
};

const createInterpretation = async (req, res, next) => {
  try {
    const { test, resultCondition, interpretationText, normalAbnormalGuidance, status } = req.body;
    if (!test || !resultCondition || !interpretationText) {
      return errorResponse(res, 'Test ID, condition, and interpretation text are required', 400);
    }
    const interpretation = await testService.createInterpretation({
      test,
      resultCondition,
      interpretationText,
      normalAbnormalGuidance,
      status
    });
    return successResponse(res, 'Interpretation condition record added', interpretation, 201);
  } catch (error) {
    next(error);
  }
};

const updateInterpretation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const interpretation = await testService.updateInterpretation(id, req.body);
    if (!interpretation) return errorResponse(res, 'Interpretation record not found', 404);
    return successResponse(res, 'Interpretation record updated successfully', interpretation);
  } catch (error) {
    next(error);
  }
};

const deleteInterpretation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const interpretation = await testService.deleteInterpretation(id);
    if (!interpretation) return errorResponse(res, 'Interpretation record not found', 404);
    return successResponse(res, 'Interpretation record deleted successfully', interpretation);
  } catch (error) {
    next(error);
  }
};

// Single rate update: PUT /api/tests/:id/rate { price }
const updateTestRate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const price = Number(req.body.price);
    if (req.body.price === undefined || isNaN(price) || price < 0) {
      return errorResponse(res, 'Valid price is required', 400);
    }
    const test = await testService.updateTestRate(id, price);
    if (!test) return errorResponse(res, 'Test not found', 404);

    await Activity.create({
      user: req.user._id,
      action: 'Update Test Rate',
      module: 'Lab',
      description: `Revised rate of ${test.name} (${test.code}) to ${price}.`
    });

    return successResponse(res, 'Test rate updated successfully', test);
  } catch (error) {
    next(error);
  }
};

// Bulk rate update: PUT /api/tests/bulk-rate-update { updates: [{ id, price }] }
const bulkUpdateTestRates = async (req, res, next) => {
  try {
    const updates = Array.isArray(req.body.updates) ? req.body.updates : req.body.tests;
    if (!Array.isArray(updates) || updates.length === 0) {
      return errorResponse(res, 'updates array [{ id, price }] is required', 400);
    }
    const result = await testService.bulkUpdateTestRates(updates);

    await Activity.create({
      user: req.user._id,
      action: 'Bulk Rate Revision',
      module: 'Lab',
      description: `Bulk rate revision: ${result.ok} updated, ${result.failed} failed.`
    });

    return successResponse(res, `Bulk rate update complete: ${result.ok} updated, ${result.failed} failed`, result);
  } catch (error) {
    next(error);
  }
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
