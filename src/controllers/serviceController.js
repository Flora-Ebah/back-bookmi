const { Service, Artist } = require('../models');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Créer un nouveau service
 * @route   POST /api/services
 * @access  Privé (Artiste)
 */
exports.createService = asyncHandler(async (req, res, next) => {
  // Récupérer l'ID de l'artiste depuis l'utilisateur connecté
  const artistId = req.user.artist;

  // Ajouter l'ID de l'artiste au service
  req.body.artist = artistId;

  // Créer le nouveau service
  const service = await Service.create(req.body);

  // Mettre à jour l'artiste pour ajouter ce service à sa liste de services
  await Artist.findByIdAndUpdate(
    artistId,
    { $push: { services: service._id } },
    { new: true }
  );

  res.status(201).json({
    success: true,
    data: service
  });
});

/**
 * @desc    Obtenir tous les services (avec filtres)
 * @route   GET /api/services
 * @access  Public
 */
exports.getServices = asyncHandler(async (req, res, next) => {
  // Construire la requête de filtrage
  const query = {};

  // Filtrer par artiste si spécifié
  if (req.query.artist) {
    query.artist = req.query.artist;
  }

  // Filtrer par catégorie si spécifiée
  if (req.query.category) {
    query.category = req.query.category;
  }

  // Filtrer par statut actif/inactif (si demandé)
  if (req.query.active !== undefined) {
    query.active = req.query.active === 'true';
  }

  // Filtrer par recherche textuelle
  if (req.query.search) {
    query.$text = { $search: req.query.search };
  }

  // Options de pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Service.countDocuments(query);

  // Exécuter la requête avec pagination
  const services = await Service.find(query)
    .populate({
      path: 'artist',
      select: 'artistName projectName user',
      populate: {
        path: 'user',
        select: 'firstName lastName profilePhoto'
      }
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
    count: services.length,
    pagination,
    data: services
  });
});

/**
 * @desc    Obtenir un service par son ID
 * @route   GET /api/services/:id
 * @access  Public
 */
exports.getService = asyncHandler(async (req, res, next) => {
  const service = await Service.findById(req.params.id)
    .populate({
      path: 'artist',
      select: 'artistName projectName user discipline',
      populate: {
        path: 'user',
        select: 'firstName lastName email profilePhoto'
      }
    });

  if (!service) {
    return next(
      new ErrorResponse(`Service non trouvé avec l'id ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: service
  });
});

/**
 * @desc    Mettre à jour un service
 * @route   PUT /api/services/:id
 * @access  Privé (Artiste propriétaire)
 */
exports.updateService = asyncHandler(async (req, res, next) => {
  let service = await Service.findById(req.params.id);

  if (!service) {
    return next(
      new ErrorResponse(`Service non trouvé avec l'id ${req.params.id}`, 404)
    );
  }

  // Vérifier que l'utilisateur est le propriétaire du service
  if (service.artist.toString() !== req.user.artist.toString()) {
    return next(
      new ErrorResponse(`Vous n'êtes pas autorisé à modifier ce service`, 403)
    );
  }

  // Mettre à jour avec les nouvelles données
  service = await Service.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: service
  });
});

/**
 * @desc    Supprimer un service
 * @route   DELETE /api/services/:id
 * @access  Privé (Artiste propriétaire)
 */
exports.deleteService = asyncHandler(async (req, res, next) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    return next(
      new ErrorResponse(`Service non trouvé avec l'id ${req.params.id}`, 404)
    );
  }

  // Vérifier que l'utilisateur est le propriétaire du service
  if (service.artist.toString() !== req.user.artist.toString()) {
    return next(
      new ErrorResponse(`Vous n'êtes pas autorisé à supprimer ce service`, 403)
    );
  }

  // Retirer le service de la liste des services de l'artiste
  await Artist.findByIdAndUpdate(
    service.artist,
    { $pull: { services: service._id } }
  );

  // Supprimer le service
  await service.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Obtenir tous les services d'un artiste
 * @route   GET /api/artists/:artistId/services
 * @access  Public
 */
exports.getArtistServices = asyncHandler(async (req, res, next) => {
  // Construire la requête
  const query = {
    artist: req.params.artistId,
    active: true // Par défaut, récupérer uniquement les services actifs
  };

  // Si l'artiste consulte ses propres services, montrer aussi les inactifs
  if (req.user && req.user.artist && req.user.artist.toString() === req.params.artistId) {
    delete query.active;
  }

  const services = await Service.find(query).sort('-createdAt');

  res.status(200).json({
    success: true,
    count: services.length,
    data: services
  });
});

/**
 * @desc    Activer/désactiver un service
 * @route   PATCH /api/services/:id/toggle-status
 * @access  Privé (Artiste propriétaire)
 */
exports.toggleServiceStatus = asyncHandler(async (req, res, next) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    return next(
      new ErrorResponse(`Service non trouvé avec l'id ${req.params.id}`, 404)
    );
  }

  // Vérifier que l'utilisateur est le propriétaire du service
  if (service.artist.toString() !== req.user._id.toString()) {
    return next(
      new ErrorResponse(`Vous n'êtes pas autorisé à modifier ce service`, 403)
    );
  }

  // Inverser le statut actif
  service.active = !service.active;
  await service.save();

  res.status(200).json({
    success: true,
    data: service
  });
}); 