const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Publicly read tests, categories, packages, panels
router.get('/', testController.getTests);
router.get('/categories', testController.getCategories);
router.get('/panels', testController.getPanels);
router.get('/packages', testController.getPackages);
router.get('/interpretations', testController.getInterpretations);

// Require admin rights to modify test definitions
router.use(protect);
router.use(authorize('Admin'));

// Tests CRUD
router.post('/', testController.createTest);
// Bulk + single rate updates must precede '/:id' so they are not captured as ids
router.put('/bulk-rate-update', testController.bulkUpdateTestRates);
router.put('/:id/rate', testController.updateTestRate);
router.put('/:id', testController.updateTest);
router.delete('/:id', testController.deleteTest);

// Categories CRUD
router.post('/categories', testController.createCategory);
router.put('/categories/:id', testController.updateCategory);
router.delete('/categories/:id', testController.deleteCategory);

// Panels CRUD
router.post('/panels', testController.createPanel);
router.put('/panels/:id', testController.updatePanel);
router.delete('/panels/:id', testController.deletePanel);

// Packages CRUD
router.post('/packages', testController.createPackage);
router.put('/packages/:id', testController.updatePackage);
router.delete('/packages/:id', testController.deletePackage);

// Interpretations CRUD
router.post('/interpretations', testController.createInterpretation);
router.put('/interpretations/:id', testController.updateInterpretation);
router.delete('/interpretations/:id', testController.deleteInterpretation);

module.exports = router;
