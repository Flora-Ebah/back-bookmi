const express = require('express');
const router = express.Router();
const {
  createPayment,
  getMyPayments,
  getReceivedPayments,
  getPayment,
  paymentWebhook,
  generateReceipt,
  getPaymentStats
} = require('../controllers/paymentController');
const { authorize, protect } = require('../middleware/auth');

/**
 * Routes pour les paiements
 * 
 * POST /api/payments - Créer un nouveau paiement
 * GET /api/payments - Obtenir tous les paiements d'un booker
 * GET /api/payments/stats - Obtenir les statistiques de paiement du booker
 * GET /api/payments/received - Obtenir les paiements reçus par un artiste
 * GET /api/payments/:id - Obtenir un paiement spécifique
 * POST /api/payments/:id/webhook - Simuler un webhook de confirmation de paiement
 * GET /api/payments/:id/receipt - Générer un reçu de paiement
 */

// Routes pour les paiements du booker
// Utiliser un tableau pour le middleware authorize
router.route('/')
  .post(protect, authorize(['booker']), createPayment)
  .get(protect, authorize(['booker']), getMyPayments);

// Route pour les statistiques de paiement du booker
router.get('/stats', protect, authorize(['booker']), getPaymentStats);

// Route pour les paiements reçus par l'artiste
router.get('/received', protect, authorize(['artist']), getReceivedPayments);

// Route pour accéder à un paiement spécifique (booker ou artiste)
router.get('/:id', protect, authorize(['booker', 'artist']), getPayment);

// Route webhook pour les confirmations de paiement
// Note: En production, cet endpoint devrait être sécurisé avec une clé API ou une signature
router.post('/:id/webhook', paymentWebhook);

// Route pour générer un reçu de paiement
router.get('/:id/receipt', protect, authorize(['booker', 'artist']), generateReceipt);

module.exports = router; 