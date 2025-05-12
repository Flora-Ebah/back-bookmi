const { PaymentMethod } = require('../models');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Ajouter un nouveau moyen de paiement
 * @route   POST /api/payment-methods
 * @access  Privé (Booker ou Artist)
 */
exports.addPaymentMethod = asyncHandler(async (req, res) => {
  const { type, name, details } = req.body;

  // Déterminer le type d'utilisateur et l'ID
  let userId, userModel;
  if (req.user.role === 'booker') {
    userId = req.user.booker || req.user.id;
    userModel = 'Booker';
  } else if (req.user.role === 'artist') {
    userId = req.user.artist || req.user.id;
    userModel = 'Artist';
  } else {
    return res.status(400).json({
      success: false,
      error: 'Type d\'utilisateur non pris en charge'
    });
  }

  // Vérifier si c'est le premier moyen de paiement pour définir comme défaut
  const existingCount = await PaymentMethod.countDocuments({
    user: userId,
    userModel: userModel
  });

  // Créer un nouveau moyen de paiement
  const paymentMethod = await PaymentMethod.create({
    user: userId,
    userModel: userModel,
    type,
    name,
    details,
    isDefault: existingCount === 0 // Premier moyen de paiement est défaut
  });

  res.status(201).json({
    success: true,
    data: paymentMethod
  });
});

/**
 * @desc    Obtenir tous les moyens de paiement de l'utilisateur
 * @route   GET /api/payment-methods
 * @access  Privé (Booker ou Artist)
 */
exports.getMyPaymentMethods = asyncHandler(async (req, res) => {
  // Déterminer le type d'utilisateur et l'ID
  let userId, userModel;
  if (req.user.role === 'booker') {
    userId = req.user.booker || req.user.id;
    userModel = 'Booker';
  } else if (req.user.role === 'artist') {
    userId = req.user.artist || req.user.id;
    userModel = 'Artist';
  } else {
    return res.status(400).json({
      success: false,
      error: 'Type d\'utilisateur non pris en charge'
    });
  }

  // Récupérer tous les moyens de paiement de l'utilisateur
  const paymentMethods = await PaymentMethod.find({
    user: userId,
    userModel: userModel
  }).sort({ isDefault: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    count: paymentMethods.length,
    data: paymentMethods
  });
});

/**
 * @desc    Obtenir un moyen de paiement spécifique
 * @route   GET /api/payment-methods/:id
 * @access  Privé (Propriétaire du moyen de paiement)
 */
exports.getPaymentMethod = asyncHandler(async (req, res) => {
  const paymentMethod = await PaymentMethod.findById(req.params.id);

  if (!paymentMethod) {
    return res.status(404).json({
      success: false,
      error: `Moyen de paiement non trouvé avec l'id ${req.params.id}`
    });
  }

  // Vérifier que l'utilisateur est le propriétaire du moyen de paiement
  let userId;
  if (req.user.role === 'booker') {
    userId = req.user.booker || req.user.id;
  } else if (req.user.role === 'artist') {
    userId = req.user.artist || req.user.id;
  }

  if (paymentMethod.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Vous n\'êtes pas autorisé à accéder à ce moyen de paiement'
    });
  }

  res.status(200).json({
    success: true,
    data: paymentMethod
  });
});

/**
 * @desc    Mettre à jour un moyen de paiement
 * @route   PUT /api/payment-methods/:id
 * @access  Privé (Propriétaire du moyen de paiement)
 */
exports.updatePaymentMethod = asyncHandler(async (req, res) => {
  const { name, details } = req.body;
  
  let paymentMethod = await PaymentMethod.findById(req.params.id);

  if (!paymentMethod) {
    return res.status(404).json({
      success: false,
      error: `Moyen de paiement non trouvé avec l'id ${req.params.id}`
    });
  }

  // Vérifier que l'utilisateur est le propriétaire du moyen de paiement
  let userId;
  if (req.user.role === 'booker') {
    userId = req.user.booker || req.user.id;
  } else if (req.user.role === 'artist') {
    userId = req.user.artist || req.user.id;
  }

  if (paymentMethod.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Vous n\'êtes pas autorisé à modifier ce moyen de paiement'
    });
  }

  // Mettre à jour les données (uniquement name et details)
  if (name) paymentMethod.name = name;
  if (details) paymentMethod.details = { ...paymentMethod.details, ...details };
  
  await paymentMethod.save();

  res.status(200).json({
    success: true,
    data: paymentMethod
  });
});

/**
 * @desc    Définir un moyen de paiement comme défaut
 * @route   PUT /api/payment-methods/:id/default
 * @access  Privé (Propriétaire du moyen de paiement)
 */
exports.setDefaultPaymentMethod = asyncHandler(async (req, res) => {
  let paymentMethod = await PaymentMethod.findById(req.params.id);

  if (!paymentMethod) {
    return res.status(404).json({
      success: false,
      error: `Moyen de paiement non trouvé avec l'id ${req.params.id}`
    });
  }

  // Vérifier que l'utilisateur est le propriétaire du moyen de paiement
  let userId;
  if (req.user.role === 'booker') {
    userId = req.user.booker || req.user.id;
  } else if (req.user.role === 'artist') {
    userId = req.user.artist || req.user.id;
  }

  if (paymentMethod.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Vous n\'êtes pas autorisé à modifier ce moyen de paiement'
    });
  }

  // Définir ce moyen de paiement comme défaut
  paymentMethod.isDefault = true;
  await paymentMethod.save();

  res.status(200).json({
    success: true,
    data: paymentMethod
  });
});

/**
 * @desc    Supprimer un moyen de paiement
 * @route   DELETE /api/payment-methods/:id
 * @access  Privé (Propriétaire du moyen de paiement)
 */
exports.deletePaymentMethod = asyncHandler(async (req, res) => {
  const paymentMethod = await PaymentMethod.findById(req.params.id);

  if (!paymentMethod) {
    return res.status(404).json({
      success: false,
      error: `Moyen de paiement non trouvé avec l'id ${req.params.id}`
    });
  }

  // Vérifier que l'utilisateur est le propriétaire du moyen de paiement
  let userId;
  if (req.user.role === 'booker') {
    userId = req.user.booker || req.user.id;
  } else if (req.user.role === 'artist') {
    userId = req.user.artist || req.user.id;
  }

  if (paymentMethod.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Vous n\'êtes pas autorisé à supprimer ce moyen de paiement'
    });
  }

  // Si c'est le moyen de paiement par défaut, vérifier s'il y a d'autres moyens de paiement
  if (paymentMethod.isDefault) {
    const count = await PaymentMethod.countDocuments({
      user: userId,
      userModel: paymentMethod.userModel
    });

    if (count > 1) {
      // Il y a d'autres moyens de paiement, supprimer celui-ci
      await paymentMethod.deleteOne();
      
      // Le hook post-save s'occupera de définir un nouveau moyen de paiement par défaut
    } else {
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer votre seul moyen de paiement'
      });
    }
  } else {
    // Ce n'est pas le moyen de paiement par défaut, on peut le supprimer directement
    await paymentMethod.deleteOne();
  }

  res.status(200).json({
    success: true,
    data: {}
  });
}); 