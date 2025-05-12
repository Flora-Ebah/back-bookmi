const { User, Booker, Artist, Service } = require('../models');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Récupérer le profil du booker connecté
 * @route   GET /api/bookers/me
 * @access  Privé (Booker)
 */
exports.getMyProfile = asyncHandler(async (req, res, next) => {
  const booker = await Booker.findById(req.user.booker).populate('user', 'firstName lastName email profilePhoto');

  if (!booker) {
    return next(new ErrorResponse('Profil de booker non trouvé', 404));
  }

  res.status(200).json({
    success: true,
    data: booker
  });
});

/**
 * @desc    Mettre à jour le profil du booker
 * @route   PUT /api/bookers/me
 * @access  Privé (Booker)
 */
exports.updateMyProfile = asyncHandler(async (req, res, next) => {
  // Champs autorisés à être mis à jour
  const fieldsToUpdate = {};
  const allowedFields = ['companyName', 'address', 'city', 'postalCode', 'country', 'phone'];

  // Ne garder que les champs autorisés
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      fieldsToUpdate[key] = req.body[key];
    }
  });

  const booker = await Booker.findByIdAndUpdate(
    req.user.booker,
    fieldsToUpdate,
    {
      new: true,
      runValidators: true
    }
  ).populate('user', 'firstName lastName email profilePhoto');

  res.status(200).json({
    success: true,
    data: booker
  });
});

/**
 * @desc    Rechercher des artistes (avec filtres)
 * @route   GET /api/bookers/search/artists
 * @access  Privé (Booker)
 */
exports.searchArtists = asyncHandler(async (req, res, next) => {
  // Construire la requête de filtrage
  const query = {};

  // Filtrer par discipline
  if (req.query.discipline) {
    query.discipline = req.query.discipline;
  }

  // Filtrer par localisation (ville, pays)
  if (req.query.city) {
    query.city = new RegExp(req.query.city, 'i');
  }

  if (req.query.country) {
    query.country = req.query.country;
  }

  // Recherche textuelle
  if (req.query.search) {
    query.$or = [
      { artistName: new RegExp(req.query.search, 'i') },
      { projectName: new RegExp(req.query.search, 'i') },
      { firstName: new RegExp(req.query.search, 'i') },
      { lastName: new RegExp(req.query.search, 'i') }
    ];
  }

  // Options de pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  // Compter le nombre total d'artistes correspondant à la requête
  const total = await Artist.countDocuments(query);

  // Rechercher les artistes avec pagination
  const artists = await Artist.find(query)
    .select('artistName projectName discipline city country firstName lastName profilePhoto')
    .populate({
      path: 'services',
      match: { active: true },
      select: 'title price category photos'
    })
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
 * @desc    Obtenir les détails d'un artiste avec ses services
 * @route   GET /api/bookers/artists/:artistId
 * @access  Privé (Booker)
 */
exports.getArtistWithServices = asyncHandler(async (req, res, next) => {
  // Récupérer l'artiste avec ses informations de base
  const artist = await Artist.findById(req.params.artistId)
    .select('artistName projectName discipline city country firstName lastName profilePhoto bio availability rating gallery profileViews');

  if (!artist) {
    return next(new ErrorResponse(`Artiste non trouvé avec l'id ${req.params.artistId}`, 404));
  }

  // Incrémenter le compteur de vues du profil
  artist.profileViews = (artist.profileViews || 0) + 1;
  await artist.save();

  // Récupérer les services actifs de l'artiste
  const services = await Service.find({
    artist: req.params.artistId,
    active: true
  })
  .select('title description price category photos active')
  .sort('-createdAt');

  res.status(200).json({
    success: true,
    data: {
      ...artist.toObject(),
      services: {
        count: services.length,
        items: services
      }
    }
  });
});

/**
 * @desc    Ajouter un artiste aux favoris
 * @route   POST /api/bookers/favorites/artists/:artistId
 * @access  Privé (Booker)
 */
exports.addFavoriteArtist = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Ajout de l'artiste ID:${req.params.artistId} aux favoris - Booker ID:${req.user.booker}`);
    
    // Vérifier l'ID de l'artiste
    if (!req.params.artistId) {
      console.error('addFavoriteArtist: ID artiste manquant');
      return next(new ErrorResponse('ID artiste manquant', 400));
    }
    
    // Vérifier l'ID du booker
    if (!req.user || !req.user.booker) {
      console.error('addFavoriteArtist: ID booker manquant');
      return next(new ErrorResponse('ID booker manquant ou invalide', 400));
    }
    
    // Vérifier si l'artiste existe
    const artist = await Artist.findById(req.params.artistId);
    if (!artist) {
      console.error(`addFavoriteArtist: Artiste non trouvé avec l'ID ${req.params.artistId}`);
      return next(new ErrorResponse(`Artiste non trouvé avec l'id ${req.params.artistId}`, 404));
    }
    
    console.log(`Artiste trouvé: ${artist.artistName || artist.firstName + ' ' + artist.lastName}`);

    // Récupérer le booker
    const booker = await Booker.findById(req.user.booker);
    if (!booker) {
      console.error(`addFavoriteArtist: Booker non trouvé avec l'ID ${req.user.booker}`);
      return next(new ErrorResponse(`Booker non trouvé`, 404));
    }
    
    console.log(`Booker trouvé: ${booker.companyName || booker.firstName + ' ' + booker.lastName}`);
    
    // Initialiser le tableau des favoris s'il n'existe pas
    if (!booker.favorites) {
      booker.favorites = [];
    }

    // Vérifier si l'artiste est déjà dans les favoris
    if (booker.favorites.some(favId => favId.toString() === req.params.artistId)) {
      console.log('addFavoriteArtist: Artiste déjà dans les favoris');
      return next(new ErrorResponse('Cet artiste est déjà dans vos favoris', 400));
    }

    // Ajouter l'artiste aux favoris
    booker.favorites.push(req.params.artistId);
    await booker.save();
    
    console.log('Artiste ajouté aux favoris avec succès');

    res.status(200).json({
      success: true,
      message: 'Artiste ajouté aux favoris',
      data: booker.favorites
    });
  } catch (err) {
    console.error('Erreur addFavoriteArtist:', err);
    return next(new ErrorResponse('Erreur lors de l\'ajout aux favoris', 500));
  }
});

/**
 * @desc    Supprimer un artiste des favoris
 * @route   DELETE /api/bookers/favorites/artists/:artistId
 * @access  Privé (Booker)
 */
exports.removeFavoriteArtist = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Suppression de l'artiste ID:${req.params.artistId} des favoris - Booker ID:${req.user.booker}`);
    
    // Vérifier l'ID de l'artiste
    if (!req.params.artistId) {
      console.error('removeFavoriteArtist: ID artiste manquant');
      return next(new ErrorResponse('ID artiste manquant', 400));
    }
    
    // Vérifier l'ID du booker
    if (!req.user || !req.user.booker) {
      console.error('removeFavoriteArtist: ID booker manquant');
      return next(new ErrorResponse('ID booker manquant ou invalide', 400));
    }
    
    // Récupérer le booker
    const booker = await Booker.findById(req.user.booker);
    if (!booker) {
      console.error(`removeFavoriteArtist: Booker non trouvé avec l'ID ${req.user.booker}`);
      return next(new ErrorResponse(`Booker non trouvé`, 404));
    }
    
    console.log(`Booker trouvé: ${booker.companyName || booker.firstName + ' ' + booker.lastName}`);
    console.log('Favoris actuels:', booker.favorites || []);

    // Initialiser le tableau des favoris s'il n'existe pas
    if (!booker.favorites) {
      booker.favorites = [];
    }

    // Vérifier si l'artiste est dans les favoris
    const artistIdString = req.params.artistId.toString();
    const isInFavorites = booker.favorites.some(id => id.toString() === artistIdString);
    
    if (!isInFavorites) {
      console.log('removeFavoriteArtist: Artiste non trouvé dans les favoris');
      return next(new ErrorResponse('Cet artiste n\'est pas dans vos favoris', 400));
    }

    // Supprimer l'artiste des favoris
    booker.favorites = booker.favorites.filter(id => id.toString() !== artistIdString);
    
    await booker.save();
    
    console.log('Artiste retiré des favoris avec succès');
    console.log('Nouveaux favoris:', booker.favorites);

    res.status(200).json({
      success: true,
      message: 'Artiste retiré des favoris',
      data: booker.favorites
    });
  } catch (err) {
    console.error('Erreur removeFavoriteArtist:', err);
    return next(new ErrorResponse('Erreur lors de la suppression des favoris', 500));
  }
});

/**
 * @desc    Obtenir la liste des artistes favoris
 * @route   GET /api/bookers/favorites/artists
 * @access  Privé (Booker)
 */
exports.getFavoriteArtists = asyncHandler(async (req, res, next) => {
  try {
    console.log('Requête getFavoriteArtists - ID booker:', req.user.booker);
    
    // Vérifier si l'ID booker est valide
    if (!req.user || !req.user.booker) {
      console.error('Erreur getFavoriteArtists: ID booker manquant');
      return next(new ErrorResponse('ID booker manquant ou invalide', 400));
    }
    
    const booker = await Booker.findById(req.user.booker);
    
    // Vérifier si le booker existe
    if (!booker) {
      console.error(`Erreur getFavoriteArtists: Booker non trouvé avec l'ID ${req.user.booker}`);
      return next(new ErrorResponse(`Booker non trouvé avec l'ID ${req.user.booker}`, 404));
    }
    
    console.log('Booker trouvé:', booker._id);
    console.log('Favoris du booker:', booker.favorites || []);

    // Si aucun favori, retourner un tableau vide
    if (!booker.favorites || booker.favorites.length === 0) {
      console.log('Aucun favori trouvé pour ce booker');
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    // Récupérer les détails complets des artistes favoris
    const favoriteArtists = await Artist.find({
      _id: { $in: booker.favorites }
    })
    .select('_id artistName projectName discipline city country profilePhoto rating profileViews firstName lastName')
    .lean(); // Utiliser lean() pour des performances améliorées
    
    console.log(`${favoriteArtists.length} artistes favoris trouvés`);

    res.status(200).json({
      success: true,
      count: favoriteArtists.length,
      data: favoriteArtists
    });
  } catch (err) {
    console.error('Erreur getFavoriteArtists:', err);
    return next(new ErrorResponse('Erreur lors de la récupération des favoris', 500));
  }
});

/**
 * @desc    Ajouter ou mettre à jour une évaluation pour un artiste
 * @route   POST /api/bookers/artists/:artistId/review
 * @access  Privé (Booker)
 */
exports.reviewArtist = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Ajout/Mise à jour d'une évaluation pour l'artiste ID:${req.params.artistId} - Booker ID:${req.user.booker}`);
    
    // Vérifier que l'évaluation est présente
    if (!req.body.rating || req.body.rating < 1 || req.body.rating > 5) {
      console.error('reviewArtist: Évaluation invalide');
      return next(new ErrorResponse('L\'évaluation doit être un nombre entre 1 et 5', 400));
    }
    
    // Vérifier l'ID du booker
    if (!req.user || !req.user.booker) {
      console.error('reviewArtist: ID booker manquant');
      return next(new ErrorResponse('ID booker manquant ou invalide', 400));
    }
    
    // Vérifier si l'artiste existe
    const artist = await Artist.findById(req.params.artistId);
    if (!artist) {
      console.error(`reviewArtist: Artiste non trouvé avec l'ID ${req.params.artistId}`);
      return next(new ErrorResponse(`Artiste non trouvé avec l'id ${req.params.artistId}`, 404));
    }
    
    console.log(`Artiste trouvé: ${artist.artistName || artist.firstName + ' ' + artist.lastName}`);
    
    // Créer ou mettre à jour la revue et calculer la nouvelle note moyenne
    // Structure d'une review: { booker: ObjectId, rating: Number, comment: String, date: Date }
    
    // Initialiser les tableaux si nécessaire
    if (!artist.reviews) {
      artist.reviews = [];
    }
    
    if (!artist.rating) {
      artist.rating = { value: 0, count: 0 };
    }
    
    // Vérifier si ce booker a déjà laissé un avis
    const existingReviewIndex = artist.reviews.findIndex(
      review => review.booker && review.booker.toString() === req.user.booker.toString()
    );

    // Préparer la nouvelle review
    const reviewData = {
      booker: req.user.booker,
      rating: req.body.rating,
      comment: req.body.review || '',
      date: new Date()
    };
    
    // Mise à jour du calcul de la note moyenne
    let totalRating, newCount;
    
    if (existingReviewIndex >= 0) {
      // Mettre à jour l'avis existant
      const oldRating = artist.reviews[existingReviewIndex].rating;
      artist.reviews[existingReviewIndex] = reviewData;
      
      // Recalculer la moyenne
      totalRating = (artist.rating.value * artist.rating.count) - oldRating + req.body.rating;
      newCount = artist.rating.count;
    } else {
      // Ajouter un nouvel avis
      artist.reviews.push(reviewData);
      
      // Recalculer la moyenne
      totalRating = (artist.rating.value * artist.rating.count) + req.body.rating;
      newCount = artist.rating.count + 1;
    }
    
    // Mettre à jour la note moyenne
    artist.rating.value = totalRating / newCount;
    artist.rating.count = newCount;
    
    await artist.save();
    
    console.log(`Évaluation ajoutée/mise à jour avec succès. Nouvelle moyenne: ${artist.rating.value.toFixed(1)}`);
    
    res.status(200).json({
      success: true,
      message: 'Évaluation ajoutée avec succès',
      data: {
        rating: artist.rating,
        review: reviewData
      }
    });
  } catch (err) {
    console.error('Erreur reviewArtist:', err);
    return next(new ErrorResponse('Erreur lors de l\'ajout de l\'évaluation', 500));
  }
});

/**
 * @desc    Récupérer les avis d'un artiste
 * @route   GET /api/bookers/artists/:artistId/reviews
 * @access  Privé (Booker)
 */
exports.getArtistReviews = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Récupération des avis pour l'artiste ID:${req.params.artistId}`);
    
    // Vérifier si l'artiste existe
    const artist = await Artist.findById(req.params.artistId)
      .select('artistName firstName lastName reviews rating')
      .populate({
        path: 'reviews.booker',
        select: 'companyName firstName lastName profilePhoto',
        model: 'Booker'
      });
    
    if (!artist) {
      console.error(`getArtistReviews: Artiste non trouvé avec l'ID ${req.params.artistId}`);
      return next(new ErrorResponse(`Artiste non trouvé avec l'id ${req.params.artistId}`, 404));
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
  } catch (err) {
    console.error('Erreur getArtistReviews:', err);
    return next(new ErrorResponse('Erreur lors de la récupération des avis', 500));
  }
});

/**
 * @desc    Obtenir les statistiques détaillées pour le tableau de bord du booker
 * @route   GET /api/bookers/me/dashboard
 * @access  Privé (Booker)
 */
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  try {
    console.log(`Récupération des stats tableau de bord pour le booker ID:${req.user.booker}`);
    
    // Rechercher le booker pour obtenir les favoris
    const booker = await Booker.findById(req.user.booker)
      .select('favorites');

    if (!booker) {
      console.error(`Booker non trouvé avec l'ID ${req.user.booker}`);
      return next(new ErrorResponse('Profil de booker non trouvé', 404));
    }

    // Récupérer les modèles nécessaires
    const { Reservation, Payment, Artist } = require('../models');
    
    // Déterminer les dates pour le mois en cours
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const todayStr = now.toISOString().split('T')[0];

    // Récupérer toutes les réservations du booker
    const reservations = await Reservation.find({ 
      booker: req.user.booker
    }).populate({
      path: 'artistId',
      select: 'artistName projectName'
    });
    
    // Compter les réservations par statut
    const pending = reservations.filter(r => r.status === 'pending').length;
    const confirmed = reservations.filter(r => r.status === 'confirmed').length;
    const completed = reservations.filter(r => r.status === 'completed').length;
    const cancelled = reservations.filter(r => r.status === 'cancelled').length;
    
    // Réservations à venir (date >= aujourd'hui ET statut confirmed ou pending)
    const upcoming = reservations.filter(r => 
      r.date >= todayStr && 
      (r.status === 'confirmed' || r.status === 'pending')
    );

    // Réservations à payer (payment status pending)
    const toPay = reservations.filter(r => r.paymentStatus === 'pending').length;
    
    // Calculer les dépenses du mois
    const payments = await Payment.find({
      payer: req.user.booker,
      status: 'completed',
      createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
    });
    
    const expensesThisMonth = payments.reduce((total, payment) => {
      return total + (payment.totalAmount || 0);
    }, 0);

    // Nombre d'artistes contactés (artistes uniques dans les réservations)
    const artistsContactedIds = new Set(reservations.map(r => r.artistId?._id?.toString() || r.artistId?.toString()));
    const artistsContactedCount = artistsContactedIds.size;

    // Favoris
    const favoriteArtistsCount = booker.favorites?.length || 0;
    
    // Récupérer les artistes favoris pour les recommandations
    let favoriteArtists = [];
    if (booker.favorites && booker.favorites.length > 0) {
      favoriteArtists = await Artist.find({
        _id: { $in: booker.favorites }
      })
      .select('artistName projectName discipline profilePhoto rating')
      .limit(3);
    }

    // Obtenir les 3 prochaines réservations
    const upcomingReservations = upcoming.slice(0, 3).map(r => ({
      id: r._id,
      date: r.date,
      time: `${r.startTime} - ${r.endTime}`,
      location: r.location,
      eventType: r.eventType,
      status: r.status,
      paymentStatus: r.paymentStatus,
      artist: r.artistId ? (r.artistId.artistName || r.artistId.projectName) : 'Artiste inconnu'
    }));

    // Assembler les statistiques
    const dashboardStats = {
      bookings: {
        total: reservations.length,
        pending,
        confirmed,
        completed,
        cancelled,
        upcoming: upcoming.length,
        toPay,
        upcomingEvents: upcomingReservations
      },
      artists: {
        contacted: artistsContactedCount,
        favorites: favoriteArtistsCount,
        favoriteArtists
      },
      finances: {
        expensesThisMonth,
        pendingPayments: toPay
      }
    };

    console.log('Statistiques du tableau de bord récupérées avec succès');

    res.status(200).json({
      success: true,
      data: dashboardStats
    });
  } catch (error) {
    console.error('Erreur getDashboardStats booker:', error);
    next(new ErrorResponse('Erreur lors de la récupération des statistiques du tableau de bord', 500));
  }
});

module.exports = exports; 