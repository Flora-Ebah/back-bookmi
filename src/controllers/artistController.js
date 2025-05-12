const { User, Artist, Service, Reservation, Payment } = require('../models');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Obtenir tous les artistes (filtrable)
 * @route   GET /api/artists
 * @access  Public
 */
exports.getArtists = asyncHandler(async (req, res, next) => {
  // Options de filtres
  const query = {};

  // Filtrer par discipline
  if (req.query.discipline) {
    query.discipline = req.query.discipline;
  }

  // Filtrer par localisation
  if (req.query.city) {
    query.city = new RegExp(req.query.city, 'i');
  }

  if (req.query.country) {
    query.country = req.query.country;
  }

  // Options de pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  // Compter le nombre total d'artistes
  const total = await Artist.countDocuments(query);

  // Obtenir les artistes avec pagination
  const artists = await Artist.find(query)
    .populate('user', 'firstName lastName email profilePhoto')
    .skip(startIndex)
    .limit(limit)
    .sort({ createdAt: -1 });

  // Informations de pagination
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: artists.length,
    pagination,
    data: artists
  });
});

/**
 * @desc    Obtenir les détails d'un artiste spécifique
 * @route   GET /api/artists/:id
 * @access  Public
 */
exports.getArtist = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findById(req.params.id)
    .populate('user', 'firstName lastName email profilePhoto');

  if (!artist) {
    return next(new ErrorResponse(`Artiste non trouvé avec l'id ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: artist
  });
});

/**
 * @desc    Obtenir les services actifs d'un artiste
 * @route   GET /api/artists/:id/services
 * @access  Public
 */
exports.getArtistServices = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findById(req.params.id);

  if (!artist) {
    return next(new ErrorResponse(`Artiste non trouvé avec l'id ${req.params.id}`, 404));
  }

  // Obtenir tous les services actifs de l'artiste
  const query = {
    artist: req.params.id,
    active: true
  };

  const services = await Service.find(query).sort('-createdAt');

  res.status(200).json({
    success: true,
    count: services.length,
    data: services
  });
});

/**
 * @desc    Obtenir le profil de l'artiste connecté
 * @route   GET /api/artists/me
 * @access  Privé (Artiste)
 */
exports.getMyProfile = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findById(req.user.artist)
    .populate('user', 'firstName lastName email profilePhoto');

  if (!artist) {
    return next(new ErrorResponse('Profil d\'artiste non trouvé', 404));
  }

  res.status(200).json({
    success: true,
    data: artist
  });
});

/**
 * @desc    Mettre à jour le profil d'artiste
 * @route   PUT /api/artists/me
 * @access  Privé (Artiste)
 */
exports.updateMyProfile = asyncHandler(async (req, res, next) => {
  // Champs autorisés à être mis à jour
  const fieldsToUpdate = {};
  const allowedFields = [
    'artistName', 
    'projectName', 
    'discipline', 
    'hasProfessionalCard',
    'address', 
    'city', 
    'postalCode', 
    'country', 
    'phone'
  ];

  // Ne garder que les champs autorisés
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      fieldsToUpdate[key] = req.body[key];
    }
  });

  const artist = await Artist.findByIdAndUpdate(
    req.user.artist,
    fieldsToUpdate,
    {
      new: true,
      runValidators: true
    }
  ).populate('user', 'firstName lastName email profilePhoto');

  res.status(200).json({
    success: true,
    data: artist
  });
});

/**
 * @desc    Obtenir les statistiques de l'artiste connecté
 * @route   GET /api/artists/me/stats
 * @access  Privé (Artiste)
 */
exports.getMyStats = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Récupération des stats pour l'artiste ID:${req.user.artist}`);
    
    // Rechercher l'artiste avec ses données
    const artist = await Artist.findById(req.user.artist)
      .select('profileViews rating reviews')
      .populate({
        path: 'reviews.booker',
        select: 'companyName firstName lastName profilePhoto',
        model: 'Booker'
      });

    if (!artist) {
      console.error(`Artiste non trouvé avec l'ID ${req.user.artist}`);
      return next(new ErrorResponse('Profil d\'artiste non trouvé', 404));
    }

    // Calculer les statistiques
    const stats = {
      profileViews: artist.profileViews || 0,
      rating: artist.rating || { value: 0, count: 0 },
      reviewsCount: artist.reviews ? artist.reviews.length : 0,
      // Ajouter d'autres statistiques si nécessaire
    };

    console.log('Statistiques récupérées avec succès:', stats);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erreur getMyStats:', error);
    next(new ErrorResponse('Erreur lors de la récupération des statistiques', 500));
  }
});

/**
 * @desc    Obtenir tous les avis reçus par l'artiste connecté
 * @route   GET /api/artists/me/reviews
 * @access  Privé (Artiste)
 */
exports.getMyReviews = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Récupération des avis pour l'artiste ID:${req.user.artist}`);
    
    // Rechercher l'artiste et récupérer ses avis
    const artist = await Artist.findById(req.user.artist)
      .select('artistName firstName lastName reviews rating')
      .populate({
        path: 'reviews.booker',
        select: 'companyName firstName lastName profilePhoto',
        model: 'Booker'
      });

    if (!artist) {
      console.error(`Artiste non trouvé avec l'ID ${req.user.artist}`);
      return next(new ErrorResponse('Profil d\'artiste non trouvé', 404));
    }

    console.log(`Artiste trouvé: ${artist.artistName || artist.firstName + ' ' + artist.lastName}`);
    console.log(`Nombre d'avis: ${artist.reviews ? artist.reviews.length : 0}`);
    
    // Si aucun avis, retourner un tableau vide
    if (!artist.reviews || artist.reviews.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: {
          artistName: artist.artistName || `${artist.firstName} ${artist.lastName}`,
          rating: artist.rating,
          reviews: []
        }
      });
    }
    
    // Trier les avis par date (les plus récents d'abord)
    const sortedReviews = artist.reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.status(200).json({
      success: true,
      count: sortedReviews.length,
      data: {
        artistName: artist.artistName || `${artist.firstName} ${artist.lastName}`,
        rating: artist.rating,
        reviews: sortedReviews
      }
    });
  } catch (error) {
    console.error('Erreur getMyReviews:', error);
    next(new ErrorResponse('Erreur lors de la récupération des avis', 500));
  }
});

/**
 * @desc    Obtenir les statistiques détaillées pour le tableau de bord de l'artiste
 * @route   GET /api/artists/me/dashboard
 * @access  Privé (Artiste)
 */
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Récupération des stats tableau de bord pour l'artiste ID:${req.user.artist}`);
    
    // Rechercher l'artiste pour obtenir les vues de profil et les évaluations
    const artist = await Artist.findById(req.user.artist)
      .select('profileViews rating reviews services')
      .populate({
        path: 'reviews.booker',
        select: 'companyName firstName lastName',
        model: 'Booker'
      });

    if (!artist) {
      console.error(`Artiste non trouvé avec l'ID ${req.user.artist}`);
      return next(new ErrorResponse('Profil d\'artiste non trouvé', 404));
    }

    // Calculer les données sur les avis
    const reviewsData = {
      total: artist.reviews ? artist.reviews.length : 0,
      averageRating: artist.rating?.value || 0,
      ratingCount: artist.rating?.count || 0,
      recentReviews: artist.reviews 
        ? artist.reviews
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3)
        : []
    };

    // Récupérer les réservations de l'artiste
    const { Reservation, Payment } = require('../models');
    
    // Déterminer les dates pour le mois en cours
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Convertir les dates au format utilisé dans le modèle (YYYY-MM-DD)
    const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
    const lastDayStr = lastDayOfMonth.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // Récupérer toutes les réservations de l'artiste
    const reservations = await Reservation.find({ 
      artistId: req.user.artist
    });
    
    // Compter les réservations par statut
    const pending = reservations.filter(r => r.status === 'pending').length;
    const confirmed = reservations.filter(r => r.status === 'confirmed').length;
    const completed = reservations.filter(r => r.status === 'completed').length;
    const cancelled = reservations.filter(r => r.status === 'cancelled').length;
    
    // Réservations à venir (date >= aujourd'hui ET statut confirmed)
    const upcoming = reservations.filter(r => 
      r.date >= todayStr && 
      (r.status === 'confirmed' || r.status === 'pending')
    ).length;

    // Récupérer les paiements du mois en cours pour calculer les revenus
    const payments = await Payment.find({
      payee: req.user.artist,
      status: 'completed',
      createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
    });
    
    // Calculer le revenu total du mois (somme des montants des paiements)
    const revenueThisMonth = payments.reduce((total, payment) => {
      return total + (payment.amount || 0);
    }, 0);

    // Assembler les statistiques de réservation
    const bookingsStats = {
      total: reservations.length,
      pending,
      confirmed,
      completed, 
      cancelled,
      upcoming,
      revenueThisMonth
    };

    // Assembler toutes les statistiques
    const dashboardStats = {
      profileViews: artist.profileViews || 0,
      rating: artist.rating || { value: 0, count: 0 },
      reviews: reviewsData,
      bookings: bookingsStats
    };

    console.log('Statistiques du tableau de bord récupérées avec succès');

    res.status(200).json({
      success: true,
      data: dashboardStats
    });
  } catch (error) {
    console.error('Erreur getDashboardStats:', error);
    next(new ErrorResponse('Erreur lors de la récupération des statistiques du tableau de bord', 500));
  }
});

/**
 * @desc    Répondre à un avis d'un booker
 * @route   POST /api/artists/me/reviews/:reviewId/respond
 * @access  Privé (Artiste)
 */
exports.respondToReview = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Ajout d'une réponse à l'avis ID:${req.params.reviewId} par l'artiste ID:${req.user.artist}`);
    
    // Vérifier que la réponse est présente
    if (!req.body.response || req.body.response.trim() === '') {
      console.error('respondToReview: Réponse vide');
      return next(new ErrorResponse('La réponse ne peut pas être vide', 400));
    }
    
    // Rechercher l'artiste
    const artist = await Artist.findById(req.user.artist);

    if (!artist) {
      console.error(`Artiste non trouvé avec l'ID ${req.user.artist}`);
      return next(new ErrorResponse('Profil d\'artiste non trouvé', 404));
    }
    
    // Vérifier que l'artiste a des avis
    if (!artist.reviews || artist.reviews.length === 0) {
      console.error('Aucun avis trouvé pour cet artiste');
      return next(new ErrorResponse('Aucun avis trouvé', 404));
    }
    
    // Trouver l'avis spécifique
    const reviewIndex = artist.reviews.findIndex(
      review => review._id.toString() === req.params.reviewId
    );
    
    if (reviewIndex === -1) {
      console.error(`Avis avec ID ${req.params.reviewId} non trouvé`);
      return next(new ErrorResponse('Avis non trouvé', 404));
    }
    
    // Ajouter la réponse à l'avis
    artist.reviews[reviewIndex].artistResponse = {
      text: req.body.response,
      date: new Date()
    };
    
    // Enregistrer les modifications
    await artist.save();
    
    console.log('Réponse à l\'avis ajoutée avec succès');
    
    res.status(200).json({
      success: true,
      message: 'Réponse ajoutée avec succès',
      data: artist.reviews[reviewIndex]
    });
  } catch (error) {
    console.error('Erreur respondToReview:', error);
    next(new ErrorResponse('Erreur lors de l\'ajout de la réponse', 500));
  }
});

module.exports = exports; 