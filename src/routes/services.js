const express = require('express');
const router = express.Router({ mergeParams: true });

const {
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
  toggleServiceStatus
} = require('../controllers/serviceController');

const { protect, authorize } = require('../middleware/auth');

// Routes pour les services
router
  .route('/')
  .get(getServices)
  .post(protect, authorize('artist'), createService);

router
  .route('/:id')
  .get(getService)
  .put(protect, authorize('artist'), updateService)
  .delete(protect, authorize('artist'), deleteService);

router
  .route('/:id/toggle-status')
  .patch(protect, authorize('artist'), toggleServiceStatus);

module.exports = router; 