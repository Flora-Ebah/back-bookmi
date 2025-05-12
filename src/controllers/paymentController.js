const mongoose = require('mongoose');
const { Payment, Reservation, Artist, PaymentMethod } = require('../models');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const notificationService = require('../utils/notificationService');

/**
 * @desc    Créer un nouveau paiement
 * @route   POST /api/payments
 * @access  Privé (Booker)
 */
exports.createPayment = asyncHandler(async (req, res) => {
  const {
    reservationId,
    amount,
    serviceFee,
    paymentMethod,
    paymentType,
    paymentMethodId, // ID du moyen de paiement enregistré
    paymentDetails,
    notes
  } = req.body;

  // Vérifier que la réservation existe
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw new ErrorResponse(`Réservation non trouvée avec l'id ${reservationId}`, 404);
  }

  // Vérifier que le booker est le propriétaire de la réservation
  const bookerId = req.user.booker || req.user.id;
  if (reservation.booker.toString() !== bookerId.toString()) {
    throw new ErrorResponse('Vous n\'êtes pas autorisé à effectuer un paiement pour cette réservation', 403);
  }

  // Si un paymentMethodId est fourni, vérifier qu'il existe et appartient au booker
  let savedPaymentMethod = null;
  if (paymentMethodId) {
    savedPaymentMethod = await PaymentMethod.findById(paymentMethodId);
    
    if (!savedPaymentMethod) {
      throw new ErrorResponse(`Moyen de paiement non trouvé avec l'id ${paymentMethodId}`, 404);
    }
    
    if (savedPaymentMethod.user.toString() !== bookerId.toString()) {
      throw new ErrorResponse('Ce moyen de paiement ne vous appartient pas', 403);
    }
  }

  // Calculer le montant total
  const totalAmount = Number(amount) + Number(serviceFee);

  // Créer le paiement avec les détails du moyen de paiement enregistré si fourni
  const paymentData = {
    reservation: reservationId,
    payer: bookerId,
    payee: reservation.artistId,
    amount,
    serviceFee,
    totalAmount,
    paymentMethod: savedPaymentMethod ? savedPaymentMethod.type : paymentMethod,
    paymentType: paymentType || 'full',
    status: 'pending',
    notes
  };

  // Utiliser les détails du moyen de paiement enregistré ou ceux fournis dans la requête
  if (savedPaymentMethod) {
    paymentData.paymentDetails = savedPaymentMethod.details;
  } else if (paymentDetails) {
    // Pour les paiements par carte, ne stockez que les 4 derniers chiffres
    if (paymentMethod === 'credit_card' && paymentDetails?.cardNumber) {
      paymentData.paymentDetails = {
        ...paymentDetails,
        cardLast4: paymentDetails.cardNumber.slice(-4),
        cardNumber: undefined // Ne pas stocker le numéro complet
      };
    } else {
      paymentData.paymentDetails = paymentDetails;
    }
  }

  try {
    const payment = await Payment.create(paymentData);

    // Simuler un traitement de paiement réussi
    // Dans un système réel, cela serait géré par un service de paiement externe
    payment.status = 'completed';
    payment.transactionId = 'sim_' + Math.random().toString(36).substring(2, 15);
    await payment.save();

    // Mettre à jour le statut de paiement de la réservation
    if (payment.status === 'completed') {
      // Si c'est un paiement complet ou si c'est un acompte
      const prevPaymentStatus = reservation.paymentStatus;
      reservation.paymentStatus = payment.paymentType === 'advance' ? 'partial' : 'paid';
      
      // Si la réservation est en attente et le paiement est réussi, confirmer la réservation
      if (reservation.status === 'pending') {
        reservation.status = 'confirmed';
      }
      
      reservation.transactionId = payment.transactionId;
      await reservation.save();

      // Créer des notifications pour le paiement
      try {
        await notificationService.notifyPayment(payment, reservation, 'created');
        console.log(`Notifications de paiement créées pour la réservation ${reservation._id}`);
      } catch (notifError) {
        console.error('Erreur lors de la création des notifications de paiement:', notifError);
        // Ne pas bloquer le processus en cas d'erreur de notification
      }

      // Si le statut de la réservation a changé, créer une notification de changement de statut
      if (reservation.status === 'confirmed' && prevPaymentStatus !== 'paid') {
        try {
          await notificationService.notifyReservationStatusChange(reservation, 'pending');
          console.log(`Notification de confirmation créée suite au paiement pour la réservation ${reservation._id}`);
        } catch (notifError) {
          console.error('Erreur lors de la création de la notification de changement de statut:', notifError);
        }
      }
    }

    res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Erreur lors du traitement du paiement:', error);
    throw new ErrorResponse(`Erreur lors du traitement du paiement: ${error.message}`, 500);
  }
});

/**
 * @desc    Obtenir tous les paiements d'un booker
 * @route   GET /api/payments
 * @access  Privé (Booker)
 */
exports.getMyPayments = asyncHandler(async (req, res) => {
  const bookerId = req.user.booker || req.user.id;
  
  // Extraire les paramètres de filtrage optionnels
  const { status, startDate, endDate, limit = 10, page = 1 } = req.query;
  
  // Construire le filtre de requête
  const query = { payer: bookerId };
  
  // Ajouter des filtres conditionnels
  if (status) {
    query.status = status;
  }
  
  // Filtrage par date
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }
  
  // Calculer le nombre total de paiements correspondant à la requête
  const total = await Payment.countDocuments(query);
  
  // Pagination
  const skip = (page - 1) * limit;
  
  // Récupérer les paiements
  const payments = await Payment.find(query)
    .populate({
      path: 'reservation',
      select: 'date startTime endTime location status',
      populate: {
        path: 'artistId',
        select: 'artistName projectName'
      }
    })
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit));
  
  // Informations de pagination
  const pagination = {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit)
  };

  res.status(200).json({
    success: true,
    count: payments.length,
    pagination,
    data: payments
  });
});

/**
 * @desc    Obtenir les statistiques de paiement du booker
 * @route   GET /api/payments/stats
 * @access  Privé (Booker)
 */
exports.getPaymentStats = asyncHandler(async (req, res) => {
  const bookerId = req.user.booker || req.user.id;
  
  // Statistiques globales
  const totalPaid = await Payment.aggregate([
    { $match: { payer: new mongoose.Types.ObjectId(bookerId), status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  
  // Paiements par mois (dernière année)
  const now = new Date();
  const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  
  const monthlyPayments = await Payment.aggregate([
    { 
      $match: { 
        payer: new mongoose.Types.ObjectId(bookerId), 
        status: 'completed',
        createdAt: { $gte: lastYear }
      } 
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 },
        total: { $sum: '$totalAmount' },
        amount: { $sum: '$amount' },
        fees: { $sum: '$serviceFee' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  // Paiements par méthode de paiement
  const paymentsByMethod = await Payment.aggregate([
    { $match: { payer: new mongoose.Types.ObjectId(bookerId), status: 'completed' } },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        total: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  // Statistiques récentes (dernier mois)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const recentStats = await Payment.aggregate([
    { 
      $match: { 
        payer: new mongoose.Types.ObjectId(bookerId), 
        createdAt: { $gte: lastMonth }
      } 
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      totalPaid: totalPaid.length > 0 ? totalPaid[0].total : 0,
      monthlyPayments,
      paymentsByMethod,
      recentStats
    }
  });
});

/**
 * @desc    Obtenir les paiements reçus par un artiste
 * @route   GET /api/payments/received
 * @access  Privé (Artist)
 */
exports.getReceivedPayments = asyncHandler(async (req, res) => {
  const artistId = req.user.artist || req.user.id;
  
  // Paramètres de pagination et filtrage
  const { status, startDate, endDate, limit = 10, page = 1 } = req.query;
  
  // Construire le filtre de requête
  const query = { payee: artistId };
  
  // Ajouter des filtres conditionnels
  if (status) {
    query.status = status;
  }
  
  // Filtrage par date
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }
  
  // Calculer le nombre total de paiements correspondant à la requête
  const total = await Payment.countDocuments(query);
  
  // Pagination
  const skip = (page - 1) * limit;

  const payments = await Payment.find(query)
    .populate({
      path: 'reservation',
      select: 'date startTime endTime location status',
      populate: {
        path: 'booker',
        select: 'firstName lastName companyName'
      }
    })
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit));
  
  // Informations de pagination
  const pagination = {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit)
  };

  res.status(200).json({
    success: true,
    count: payments.length,
    pagination,
    data: payments
  });
});

/**
 * @desc    Obtenir un paiement spécifique
 * @route   GET /api/payments/:id
 * @access  Privé (Booker qui a effectué le paiement ou Artiste qui l'a reçu)
 */
exports.getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate({
      path: 'reservation',
      select: 'date startTime endTime location eventType status paymentStatus',
      populate: [
        {
          path: 'artistId',
          select: 'artistName projectName profilePhoto'
        },
        {
          path: 'booker',
          select: 'firstName lastName companyName email phone'
        }
      ]
    });

  if (!payment) {
    throw new ErrorResponse(`Paiement non trouvé avec l'id ${req.params.id}`, 404);
  }

  // Vérifier les droits d'accès
  const userId = req.user.role === 'booker' ? (req.user.booker || req.user.id) : (req.user.artist || req.user.id);
  
  if (payment.payer.toString() !== userId.toString() && payment.payee.toString() !== userId.toString()) {
    throw new ErrorResponse('Vous n\'êtes pas autorisé à accéder à ce paiement', 403);
  }

  res.status(200).json({
    success: true,
    data: payment
  });
});

/**
 * @desc    Simuler un webhook de confirmation de paiement
 * @route   POST /api/payments/:id/webhook
 * @access  Public (mais sécurisé avec une clé API en production)
 */
exports.paymentWebhook = asyncHandler(async (req, res) => {
  const { paymentId, status, transactionId } = req.body;

  // En production, vérifier une signature ou une clé API
  // pour sécuriser cet endpoint

  const payment = await Payment.findById(paymentId || req.params.id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Paiement non trouvé'
    });
  }

  // Mettre à jour le statut du paiement
  payment.status = status;
  if (transactionId) {
    payment.transactionId = transactionId;
  }
  
  await payment.save();

  // Si le paiement est confirmé, mettre à jour la réservation
  if (status === 'completed') {
    const reservation = await Reservation.findById(payment.reservation);
    
    if (reservation) {
      reservation.paymentStatus = payment.paymentType === 'advance' ? 'partial' : 'paid';
      
      // Si la réservation était en attente, la confirmer
      if (reservation.status === 'pending') {
        const previousStatus = reservation.status;
        reservation.status = 'confirmed';
        
        // Créer une notification de changement de statut
        try {
          await notificationService.notifyReservationStatusChange(reservation, previousStatus);
        } catch (error) {
          console.error('Erreur lors de la création de la notification:', error);
        }
      }
      
      await reservation.save();
      
      // Envoyer des notifications de confirmation de paiement
      try {
        await notificationService.notifyPayment(payment, reservation, 'confirmed');
        console.log('Notifications de confirmation de paiement envoyées');
      } catch (error) {
        console.error('Erreur lors de l\'envoi des notifications de confirmation de paiement:', error);
      }
    }
  }

  res.status(200).json({
    success: true,
    data: payment
  });
});

/**
 * @desc    Générer un reçu de paiement (facture)
 * @route   GET /api/payments/:id/receipt
 * @access  Privé (Booker qui a effectué le paiement ou Artiste qui l'a reçu)
 */
exports.generateReceipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate({
      path: 'reservation',
      select: 'date startTime endTime location eventType',
      populate: [
        {
          path: 'artistId',
          select: 'artistName projectName'
        },
        {
          path: 'booker',
          select: 'firstName lastName companyName email phone'
        },
        {
          path: 'serviceId',
          select: 'title price'
        }
      ]
    });

  if (!payment) {
    throw new ErrorResponse(`Paiement non trouvé avec l'id ${req.params.id}`, 404);
  }

  // Vérifier les droits d'accès
  const userId = req.user.role === 'booker' ? (req.user.booker || req.user.id) : (req.user.artist || req.user.id);
  
  if (payment.payer.toString() !== userId.toString() && payment.payee.toString() !== userId.toString()) {
    throw new ErrorResponse('Vous n\'êtes pas autorisé à accéder à ce reçu', 403);
  }

  // En production, utiliser un service de génération de PDF
  // et renvoyer le PDF généré
  
  // Pour l'instant, renvoyons simplement les données formatées
  const receiptData = {
    receiptNumber: payment.reference,
    date: payment.createdAt,
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    
    client: {
      name: payment.reservation.booker.companyName || `${payment.reservation.booker.firstName} ${payment.reservation.booker.lastName}`,
      email: payment.reservation.booker.email,
      phone: payment.reservation.booker.phone
    },
    
    artist: {
      name: payment.reservation.artistId.artistName || payment.reservation.artistId.projectName
    },
    
    reservation: {
      service: payment.reservation.serviceId.title,
      date: payment.reservation.date,
      time: `${payment.reservation.startTime} - ${payment.reservation.endTime}`,
      location: payment.reservation.location,
      eventType: payment.reservation.eventType
    },
    
    payment: {
      subtotal: payment.amount,
      serviceFee: payment.serviceFee,
      total: payment.totalAmount,
      paymentType: payment.paymentType
    }
  };

  res.status(200).json({
    success: true,
    data: receiptData
  });
}); 