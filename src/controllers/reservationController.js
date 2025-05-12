const { Reservation, Service, Artist } = require('../models');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const notificationService = require('../utils/notificationService');

/**
 * @desc    Créer une nouvelle réservation
 * @route   POST /api/reservations
 * @access  Privé (Booker)
 */
exports.createReservation = asyncHandler(async (req, res) => {
  const { 
    serviceId, 
    artistId,
    booker,  // Accepter l'ID du booker depuis la requête
    date, 
    startTime, 
    endTime, 
    location, 
    eventType, 
    notes,
    paymentMethod,
    paymentNumber,
    cardNumber,
    expiryDate,
    cvv,
    cardName,
    amount,
    serviceFee
  } = req.body;

  // Vérifier que le service existe
  const service = await Service.findById(serviceId);
  if (!service) {
    throw new ErrorResponse(`Service non trouvé avec l'id ${serviceId}`, 404);
  }

  // Vérifier que le service est actif
  if (service.active === false) {
    throw new ErrorResponse(`Ce service n'est pas disponible pour réservation`, 400);
  }

  // Déterminer l'ID du booker - utiliser plusieurs sources possibles
  const bookerId = req.user?.booker || 
                  (req.user?.role === 'booker' ? req.user.id : null) ||
                  booker;
  
  // Vérifier qu'un ID de booker est disponible et valide
  if (!bookerId) {
    console.error('ID du booker manquant dans la requête:', {
      reqUser: req.user,
      reqBody: req.body,
      headers: req.headers
    });
    throw new ErrorResponse(`ID du booker requis pour créer une réservation`, 400);
  }

  // Créer l'objet de réservation
  const reservationData = {
    booker: bookerId,
    serviceId,
    artistId,
    date,
    startTime,
    endTime,
    location,
    eventType,
    notes,
    paymentMethod,
    amount,
    serviceFee
  };

  // Ajouter les détails de paiement selon la méthode
  if (['orange', 'mtn', 'moov', 'wave'].includes(paymentMethod)) {
    reservationData.paymentNumber = paymentNumber;
  } else if (paymentMethod === 'visa') {
    reservationData.cardNumber = cardNumber;
    reservationData.expiryDate = expiryDate;
    reservationData.cvv = cvv;
    reservationData.cardName = cardName;
  }

  try {
    // Créer la réservation
    const reservation = await Reservation.create(reservationData);

    // Créer une notification pour l'artiste
    try {
      await notificationService.notifyNewReservation(reservation);
      console.log(`Notification créée pour l'artiste ${artistId} pour la réservation ${reservation._id}`);
    } catch (notifError) {
      console.error('Erreur lors de la création de la notification:', notifError);
      // Ne pas bloquer la création de la réservation en cas d'erreur de notification
    }

    // Retourner la réponse
    res.status(201).json({
      success: true,
      data: reservation
    });
  } catch (err) {
    console.error('Erreur lors de la création de la réservation:', err);
    if (err.name === 'ValidationError') {
      throw new ErrorResponse(`Erreur de validation: ${err.message}`, 400);
    }
    throw err;
  }
});

/**
 * @desc    Obtenir les réservations du booker connecté
 * @route   GET /api/reservations
 * @access  Privé (Booker)
 */
exports.getMyReservations = asyncHandler(async (req, res) => {
  console.log('GET /api/reservations appelé');
  console.log('Utilisateur authentifié:', req.user);
  console.log('ID Booker:', req.user?.booker);
  
  if (!req.user) {
    console.error('Utilisateur non authentifié');
    return res.status(401).json({
      success: false,
      error: 'Authentification requise pour accéder aux réservations'
    });
  }

  // Utiliser l'ID du booker depuis le token ou l'ID de l'utilisateur comme fallback
  // car nous avons modifié la génération du token pour inclure booker=_id pour les bookers
  const bookerId = req.user.booker || (req.user.role === 'booker' ? req.user.id : null);
  
  if (!bookerId) {
    console.error('ID booker manquant et utilisateur non booker');
    return res.status(401).json({
      success: false,
      error: 'Compte booker requis pour accéder aux réservations'
    });
  }

  const reservations = await Reservation.find({ booker: bookerId })
    .populate({
      path: 'serviceId',
      select: 'title price category duration'
    })
    .populate({
      path: 'artistId',
      select: 'artistName projectName profilePhoto'
    })
    .sort('-createdAt');

  console.log(`${reservations.length} réservations trouvées pour le booker ${bookerId}`);
  
  res.status(200).json({
    success: true,
    count: reservations.length,
    data: reservations
  });
});

/**
 * @desc    Obtenir une réservation spécifique
 * @route   GET /api/reservations/:id
 * @route   GET /api/reservations/artist/:id
 * @access  Privé (Booker propriétaire ou Artiste concerné)
 */
exports.getReservation = asyncHandler(async (req, res) => {
  console.log(`GET ${req.originalUrl} appelé`);
  console.log('Utilisateur authentifié:', req.user ? {
    id: req.user.id,
    role: req.user.role,
    artist: req.user.artist,
    booker: req.user.booker
  } : 'Non authentifié');

  // Vérifier que l'utilisateur est authentifié
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentification requise pour accéder à cette réservation'
    });
  }

  // Identifier si la requête vient d'une route d'artiste
  const isArtistRoute = req.originalUrl.includes('/artist/');

  // Trouver la réservation et la peupler avec les informations associées
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate({
        path: 'serviceId',
        select: 'title price category duration description'
      })
      .populate({
        path: 'artistId',
        select: 'artistName projectName profilePhoto'
      })
      .populate({
        path: 'booker',
        select: 'user firstName lastName companyName email phone',
        populate: {
          path: 'user',
          select: 'firstName lastName email profilePhoto'
        }
      });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: `Réservation non trouvée avec l'id ${req.params.id}`
      });
    }

    // Vérifier les autorisations d'accès
    let isAuthorized = false;
    
    // Cas 1: L'utilisateur est un booker et c'est sa réservation
    if (req.user.role === 'booker' && req.user.booker) {
      const bookerId = req.user.booker.toString();
      const reservationBookerId = reservation.booker._id ? reservation.booker._id.toString() : 
                                 (typeof reservation.booker === 'string' ? reservation.booker : null);
      
      if (bookerId === reservationBookerId) {
        console.log('Accès autorisé: booker propriétaire');
        isAuthorized = true;
      }
    }
    
    // Cas 2: L'utilisateur est un artiste et c'est sa réservation
    if (req.user.role === 'artist') {
      // Si c'est une route spécifique pour artiste, on autorise
      if (isArtistRoute) {
        console.log('Accès autorisé: route spécifique pour artiste');
        isAuthorized = true;
      } 
      // Sinon, on vérifie si l'ID de l'artiste correspond
      else if (req.user.artist) {
        const artistId = req.user.artist.toString();
        const reservationArtistId = reservation.artistId._id ? reservation.artistId._id.toString() : 
                                   (typeof reservation.artistId === 'string' ? reservation.artistId : null);
        
        if (artistId === reservationArtistId) {
          console.log('Accès autorisé: artiste concerné');
          isAuthorized = true;
        }
      }
      // Si l'ID de l'artiste est dans l'URL ou si l'ID de l'utilisateur correspond à l'artiste de la réservation
      else {
        const userId = req.user.id;
        const reservationArtistId = reservation.artistId._id ? reservation.artistId._id.toString() : 
                                   (typeof reservation.artistId === 'string' ? reservation.artistId : null);
        
        if (userId === reservationArtistId) {
          console.log('Accès autorisé: ID utilisateur correspond à l\'artiste de la réservation');
          isAuthorized = true;
        }
      }
    }

    // Si l'utilisateur n'est pas autorisé, renvoyer une erreur 403
    if (!isAuthorized) {
      console.log('Accès refusé: utilisateur non autorisé');
      return res.status(403).json({
        success: false,
        error: "Vous n'êtes pas autorisé à accéder à cette réservation"
      });
    }

    // Renvoyer la réservation si tout est en ordre
    res.status(200).json({
      success: true,
      data: reservation
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération de la réservation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur lors de la récupération de la réservation'
    });
  }
});

/**
 * @desc    Mettre à jour le statut d'une réservation
 * @route   PATCH /api/reservations/:id/status
 * @access  Privé (Booker propriétaire ou Artiste concerné)
 */
exports.updateReservationStatus = asyncHandler(async (req, res) => {
  console.log(`PATCH ${req.originalUrl} appelé`);
  console.log('Données reçues:', req.body);
  console.log('Utilisateur authentifié:', req.user ? {
    id: req.user.id,
    role: req.user.role,
    artist: req.user.artist,
    booker: req.user.booker
  } : 'Non authentifié');

  // Vérifier que l'utilisateur est authentifié
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentification requise pour mettre à jour une réservation'
    });
  }

  const { status } = req.body;

  // Vérifier que le statut est valide
  if (!status || !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Statut invalide'
    });
  }

  try {
    // Trouver la réservation
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: `Réservation non trouvée avec l'id ${req.params.id}`
      });
    }

    // Vérifier les autorisations d'accès
    let isBooker = false;
    let isArtist = false;
    
    // Cas 1: L'utilisateur est un booker et c'est sa réservation
    if (req.user.role === 'booker' && req.user.booker) {
      const bookerId = req.user.booker.toString();
      const reservationBookerId = reservation.booker._id ? reservation.booker._id.toString() : 
                                 (typeof reservation.booker === 'string' ? reservation.booker : null);
      
      if (bookerId === reservationBookerId) {
        console.log('Accès autorisé: booker propriétaire');
        isBooker = true;
      }
    }
    
    // Cas 2: L'utilisateur est un artiste et c'est sa réservation
    if (req.user.role === 'artist') {
      // Si l'utilisateur a un ID artiste dans le token, l'utiliser
      if (req.user.artist) {
        const artistId = req.user.artist.toString();
        const reservationArtistId = reservation.artistId._id ? reservation.artistId._id.toString() : 
                                  (typeof reservation.artistId === 'string' ? reservation.artistId : null);
        
        if (artistId === reservationArtistId) {
          console.log('Accès autorisé: artiste concerné (via token)');
          isArtist = true;
        }
      } 
      // Sinon, vérifier si l'ID de l'utilisateur correspond à l'artiste de la réservation
      else {
        const userId = req.user.id;
        // Vérifier si la route contient /artist/ ce qui indique une demande spécifique pour artiste
        const isArtistRoute = req.originalUrl.includes('/artist/');
        
        if (isArtistRoute) {
          // Si c'est une route d'artiste, autoriser l'accès si l'utilisateur est un artiste
          console.log('Accès autorisé: route spécifique pour artiste');
          isArtist = true;
        } else {
          // Vérifier si l'ID de l'utilisateur correspond à l'artistId de la réservation
          const reservationArtistId = reservation.artistId._id ? reservation.artistId._id.toString() : 
                                    (typeof reservation.artistId === 'string' ? reservation.artistId : null);
          
          if (userId === reservationArtistId) {
            console.log('Accès autorisé: ID utilisateur correspond à l\'artiste de la réservation');
            isArtist = true;
          }
        }
      }
    }

    // Règles métier pour les modifications de statut
    if (isBooker && status !== 'cancelled') {
      return res.status(403).json({
        success: false,
        error: 'Les bookers ne peuvent que annuler une réservation'
      });
    }

    if (isArtist && !['confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(403).json({
        success: false,
        error: 'Les artistes ne peuvent que confirmer, compléter ou annuler une réservation'
      });
    }

    if (!isBooker && !isArtist) {
      console.log('Accès refusé: utilisateur non autorisé');
      return res.status(403).json({
        success: false,
        error: "Vous n'êtes pas autorisé à modifier cette réservation"
      });
    }

    // Enregistrer le statut précédent pour la notification
    const previousStatus = reservation.status;

    // Mettre à jour le statut
    reservation.status = status;
    await reservation.save();

    // Créer une notification pour le changement de statut
    try {
      if (isArtist) {
        // Si c'est l'artiste qui fait la modification, notifier le booker
        await notificationService.notifyReservationStatusChange(reservation, previousStatus);
        console.log(`Notification créée pour le booker ${reservation.booker} pour le changement de statut de la réservation ${reservation._id}`);
      } else if (isBooker && status === 'cancelled') {
        // Si c'est le booker qui annule, créer une notification pour l'artiste
        const artistNotification = {
          recipient: reservation.artistId,
          recipientModel: 'Artist',
          sender: reservation.booker,
          senderModel: 'Booker',
          relatedId: reservation._id,
          relatedModel: 'Reservation',
          type: 'reservation_cancelled',
          title: 'Réservation annulée',
          message: `La réservation pour le ${reservation.date} a été annulée par le client`,
          data: {
            reservationId: reservation._id,
            previousStatus,
            newStatus: status,
            serviceId: reservation.serviceId,
            date: reservation.date
          }
        };
        await notificationService.createNotification(artistNotification);
        console.log(`Notification d'annulation créée pour l'artiste ${reservation.artistId}`);
      }
    } catch (notifError) {
      console.error('Erreur lors de la création de la notification de changement de statut:', notifError);
      // Ne pas bloquer la mise à jour du statut en cas d'erreur de notification
    }

    console.log(`Statut de la réservation ${req.params.id} mis à jour: ${status}`);
    
    res.status(200).json({
      success: true,
      data: reservation
    });
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de la réservation:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur lors de la mise à jour du statut'
    });
  }
});

/**
 * @desc    Obtenir les réservations d'un artiste
 * @route   GET /api/reservations/artist
 * @access  Privé (Artist)
 */
exports.getArtistReservations = asyncHandler(async (req, res) => {
  console.log('GET /api/reservations/artist appelé');
  console.log('Utilisateur authentifié:', req.user ? {
    id: req.user.id,
    role: req.user.role,
    artist: req.user.artist
  } : 'Non authentifié');
  console.log('Headers de la requête:', req.headers);
  
  if (!req.user) {
    console.error('Utilisateur non authentifié');
    return res.status(401).json({
      success: false,
      error: 'Authentification requise pour accéder aux réservations'
    });
  }

  // Extraction de l'ID artiste à partir de plusieurs sources possibles
  let artistId = null;
  
  // 1. D'abord essayer de le récupérer depuis le champ artist du token
  if (req.user.artist) {
    artistId = req.user.artist;
    console.log('ID artiste trouvé dans req.user.artist:', artistId);
  } 
  // 2. Sinon, si l'utilisateur est un artiste, utiliser son ID directement
  else if (req.user.role === 'artist') {
    artistId = req.user.id;
    console.log('ID artiste récupéré depuis req.user.id (utilisateur est un artiste):', artistId);
  }
  // 3. Vérifier s'il y a un ID artiste dans le corps de la requête
  else if (req.body && req.body.artistId) {
    artistId = req.body.artistId;
    console.log('ID artiste trouvé dans le corps de la requête:', artistId);
  }
  // 4. Vérifier s'il y a un ID artiste dans les paramètres de requête
  else if (req.query && req.query.artistId) {
    artistId = req.query.artistId;
    console.log('ID artiste trouvé dans les paramètres de requête:', artistId);
  }
  
  if (!artistId) {
    console.error('Impossible de déterminer l\'ID de l\'artiste');
    return res.status(400).json({
      success: false,
      error: 'ID artiste requis pour accéder aux réservations'
    });
  }

  console.log(`Recherche des réservations pour l'artiste ID: ${artistId}`);
  
  try {
    // Rechercher les réservations avec le champ artistId correspondant à l'ID de l'artiste
    const reservations = await Reservation.find({ artistId: artistId })
      .populate({
        path: 'serviceId',
        select: 'title price category duration'
      })
      .populate({
        path: 'booker',
        select: 'user firstName lastName companyName email phone',
        populate: {
          path: 'user',
          select: 'firstName lastName email profilePhoto'
        }
      })
      .sort('-createdAt');

    console.log(`${reservations.length} réservations trouvées pour l'artiste ${artistId}`);
    console.log('Réservations trouvées:', JSON.stringify(reservations.map(r => ({
      id: r._id,
      date: r.date,
      status: r.status,
      booker: r.booker
    }))));
    
    res.status(200).json({
      success: true,
      count: reservations.length,
      data: reservations
    });
  } catch (error) {
    console.error(`Erreur lors de la recherche des réservations:`, error);
    throw new ErrorResponse(`Erreur lors de la recherche des réservations: ${error.message}`, 500);
  }
});

/**
 * @desc    Mettre à jour le statut de paiement d'une réservation
 * @route   PATCH /api/reservations/:id/payment
 * @access  Privé (Booker propriétaire)
 */
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus, transactionId } = req.body;

  // Vérifier que le statut est valide
  if (!paymentStatus || !['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
    throw new ErrorResponse('Statut de paiement invalide', 400);
  }

  let reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    throw new ErrorResponse(`Réservation non trouvée avec l'id ${req.params.id}`, 404);
  }

  // Vérifier que le booker est le propriétaire de la réservation
  if (reservation.booker.toString() !== req.user.booker.toString()) {
    throw new ErrorResponse('Vous n\'êtes pas autorisé à modifier cette réservation', 403);
  }

  // Mettre à jour le statut de paiement
  reservation.paymentStatus = paymentStatus;
  if (transactionId) {
    reservation.transactionId = transactionId;
  }
  
  await reservation.save();

  res.status(200).json({
    success: true,
    data: reservation
  });
});

/**
 * @desc    Supprimer une réservation
 * @route   DELETE /api/reservations/:id
 * @access  Privé (Booker propriétaire ou Admin)
 */
exports.deleteReservation = asyncHandler(async (req, res) => {
  console.log(`DELETE /api/reservations/${req.params.id} appelé`);
  console.log('Utilisateur authentifié:', req.user ? {
    id: req.user.id,
    role: req.user.role,
    booker: req.user.booker
  } : 'Non authentifié');

  // Trouver la réservation
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({
      success: false,
      error: `Réservation non trouvée avec l'id ${req.params.id}`
    });
  }

  // Vérifier les autorisations (booker propriétaire ou admin)
  let isAuthorized = false;
  
  // Cas 1: L'utilisateur est un admin
  if (req.user.role === 'admin') {
    isAuthorized = true;
  }
  
  // Cas 2: L'utilisateur est le booker propriétaire
  if (req.user.role === 'booker' && req.user.booker) {
    const bookerId = req.user.booker.toString();
    const reservationBookerId = reservation.booker.toString();
    
    if (bookerId === reservationBookerId) {
      isAuthorized = true;
    }
  }

  // Vérifier l'autorisation
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      error: "Vous n'êtes pas autorisé à supprimer cette réservation"
    });
  }

  // Supprimer la réservation
  await reservation.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
}); 