const express = require('express');
const router = express.Router();
const {
  addPaymentMethod,
  getMyPaymentMethods,
  getPaymentMethod,
  updatePaymentMethod,
  setDefaultPaymentMethod,
  deletePaymentMethod
} = require('../controllers/paymentMethodController');
const { authorize, protect } = require('../middleware/auth');

/**
 * Routes pour les moyens de paiement
 * 
 * POST /api/payment-methods - Ajouter un nouveau moyen de paiement
 * GET /api/payment-methods - Obtenir tous les moyens de paiement de l'utilisateur
 * GET /api/payment-methods/:id - Obtenir un moyen de paiement spécifique
 * PUT /api/payment-methods/:id - Mettre à jour un moyen de paiement
 * PUT /api/payment-methods/:id/default - Définir un moyen de paiement comme défaut
 * DELETE /api/payment-methods/:id - Supprimer un moyen de paiement
 */

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes pour la gestion des moyens de paiement
router.route('/')
  .post(authorize(['booker', 'artist']), addPaymentMethod)
  .get(authorize(['booker', 'artist']), getMyPaymentMethods);

router.route('/:id')
  .get(authorize(['booker', 'artist']), getPaymentMethod)
  .put(authorize(['booker', 'artist']), updatePaymentMethod)
  .delete(authorize(['booker', 'artist']), deletePaymentMethod);

router.put('/:id/default', authorize(['booker', 'artist']), setDefaultPaymentMethod);

module.exports = router; 