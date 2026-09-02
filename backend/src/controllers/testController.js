const testService = require('../services/testService');
const { successResponse, errorResponse } = require('../utils/response');
const { validateTest } = require('../validators/testValidator');
const Activity = require('../models/Activity');

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
    const { errors, isValid } = validateTest(req.body);
    if (!isValid) return errorResponse(res, 'Validation failed', 400, errors);

    const test = await testService.createTest(req.body);
    
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
    const { errors, isValid } = validateTest(req.body);
    if (!isValid) return errorResponse(res, 'Validation failed', 400, errors);

    const test = await testService.updateTest(id, req.body);
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
    return successResponse(res, 'Interpretation record deleted successfully');
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
