const express = require('express');
const router = express.Router();

const {
  getMyProfile,
  updateMyProfile,
  searchArtists,
  getArtistWithServices,
  addFavoriteArtist,
  removeFavoriteArtist,
  getFavoriteArtists,
  reviewArtist,
  getArtistReviews,
  getDashboardStats
} = require('../controllers/bookerController');

const { protect, authorize } = require('../middleware/auth');

// Toutes les routes de booker nécessitent authentification et rôle booker
router.use(protect);
router.use(authorize('booker'));

// Routes pour le profil booker
router
  .route('/me')
  .get(getMyProfile)
  .put(updateMyProfile);

// Routes pour la recherche d'artistes
router.get('/search/artists', searchArtists);

// Routes pour obtenir les détails d'un artiste avec ses services
router.get('/artists/:artistId', getArtistWithServices);

// Route pour évaluer un artiste et récupérer les avis
router.post('/artists/:artistId/review', reviewArtist);
router.get('/artists/:artistId/reviews', getArtistReviews);

// Routes pour les favoris
router
  .route('/favorites/artists')
  .get(getFavoriteArtists);

router
  .route('/favorites/artists/:artistId')
  .post(addFavoriteArtist)
  .delete(removeFavoriteArtist);

// Route pour les statistiques du tableau de bord
router.get('/me/dashboard', getDashboardStats);

module.exports = router; 