const express = require('express');
const router = express.Router();

// Inclure d'autres routes
const serviceRouter = require('./services');

// Contrôleurs
const { 
  getArtists, 
  getArtist, 
  getArtistServices,
  getMyProfile,
  updateMyProfile,
  getMyStats,
  getMyReviews,
  getDashboardStats,
  respondToReview
} = require('../controllers/artistController');

const { protect, authorize } = require('../middleware/auth');

// Re-router vers d'autres routeurs pour les services
router.use('/:artistId/services', serviceRouter);

// Routes publiques pour les artistes
router.get('/', getArtists);
router.get('/:id', getArtist);
router.get('/:id/services', getArtistServices);

// Routes protégées pour le profil de l'artiste connecté
router
  .route('/me')
  .get(protect, authorize('artist'), getMyProfile)
  .put(protect, authorize('artist'), updateMyProfile);

// Routes pour les statistiques et les avis de l'artiste connecté
router.get('/me/stats', protect, authorize('artist'), getMyStats);
router.get('/me/reviews', protect, authorize('artist'), getMyReviews);
router.get('/me/dashboard', protect, authorize('artist'), getDashboardStats);

// Route pour répondre à un avis
router.post('/me/reviews/:reviewId/respond', protect, authorize('artist'), respondToReview);

module.exports = router; 