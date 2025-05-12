const express = require('express');
const router = express.Router();

const {
  createReservation,
  getMyReservations,
  getReservation,
  updateReservationStatus,
  getArtistReservations,
  updatePaymentStatus,
  deleteReservation
} = require('../controllers/reservationController');

const { protect, authorize } = require('../middleware/auth');

// Toutes les routes nécessitent authentification
router.use(protect);

// Routes pour les bookers
router
  .route('/')
  .post(authorize(['booker']), createReservation)
  .get(authorize(['booker']), getMyReservations);

// Routes pour les artistes
router.get('/artist', authorize(['artist']), getArtistReservations);
// Route pour qu'un artiste puisse accéder à une réservation spécifique
router.get('/artist/:id', authorize(['artist']), getReservation);
// Route pour qu'un artiste puisse mettre à jour le statut d'une réservation
router.patch('/artist/:id/status', authorize(['artist']), updateReservationStatus);

// Routes communes avec vérification d'autorisation dans le contrôleur
router.get('/:id', authorize(['booker']), getReservation);
router.patch('/:id/status', authorize(['booker']), updateReservationStatus);
router.patch('/:id/payment', authorize(['booker']), updatePaymentStatus);

// Route pour supprimer une réservation (pour booker ou admin)
router.delete('/:id', authorize(['booker', 'admin']), deleteReservation);

// Route de développement pour créer des réservations de test
if (process.env.NODE_ENV === 'development') {
  // Cette route ajoutera directement la réservation de test dans la base de données
  router.post('/dev/test-reservation', async (req, res) => {
    try {
      const { Reservation } = require('../models');
      const reservationData = req.body;
      
      console.log('Création d\'une réservation de test avec les données:', reservationData);
      
      const reservation = await Reservation.create(reservationData);
      
      res.status(201).json({
        success: true,
        data: reservation
      });
    } catch (error) {
      console.error('Erreur lors de la création de la réservation de test:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Route pour créer une réservation spécifique pour l'exemple
  router.get('/dev/create-sample-reservation', async (req, res) => {
    try {
      const { Reservation } = require('../models');
      
      // Créer la réservation avec les données fournies par l'utilisateur
      const reservation = {
        _id: '681b46f9104a806c04e944a7',
        booker: '681a422ed8a4df63ce922cbd',
        serviceId: '681a952ec49894d2a181de80',
        artistId: '681a434b4db6cfef3ce68be3',
        status: 'pending',
        paymentStatus: 'pending',
        transactionId: '',
        date: '2025-05-08',
        startTime: '12:41',
        endTime: '13:41',
        location: 'plateua',
        eventType: 'anniversaire',
        notes: '',
        amount: 525000,
        serviceFee: 25000,
        paymentMethod: 'mtn',
        paymentNumber: '0700954748'
      };
      
      console.log('Création d\'une réservation exemple avec les données:', reservation);
      
      // Vérifier si la réservation existe déjà
      const existingReservation = await Reservation.findById(reservation._id);
      
      if (existingReservation) {
        console.log('La réservation existe déjà, retour des données existantes');
        return res.status(200).json({
          success: true,
          message: 'La réservation existe déjà',
          data: existingReservation
        });
      }
      
      // Créer la réservation
      const createdReservation = await Reservation.create(reservation);
      
      res.status(201).json({
        success: true,
        message: 'Réservation exemple créée avec succès',
        data: createdReservation
      });
    } catch (error) {
      console.error('Erreur lors de la création de la réservation exemple:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = router; 