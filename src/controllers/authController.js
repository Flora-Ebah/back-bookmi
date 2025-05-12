const { User, Booker, Artist } = require('../models');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const sendSMS = require('../utils/sendSMS');
const jwt = require('jsonwebtoken');

// Clés secrètes par défaut (identiques à celles définies dans User.js)
const DEFAULT_JWT_SECRET = 'bookmi_default_jwt_secret_key';
const DEFAULT_REFRESH_SECRET = 'bookmi_default_refresh_secret_key';

// @desc    Inscription d'un booker
// @route   POST /api/auth/register/booker
// @access  Public
exports.registerBooker = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, companyName, address, country, city, postalCode, email, password, phone } = req.body;

  // Vérifier si l'email existe déjà
  const userExists = await User.findOne({ email });
  if (userExists) {
    return next(new ErrorResponse('Cet email est déjà utilisé', 400));
  }

  // Créer le booker
  const booker = await Booker.create({
    firstName,
    lastName,
    companyName,
    address,
    country,
    city,
    postalCode,
    email,
    password,
    phone,
    role: 'booker'
  });

  // Générer un code de vérification
  const verificationCode = booker.generateVerificationCode();
  await booker.save();

  // Envoyer le code par SMS
  // À implémenter avec un service comme Twilio ou autre
  try {
    await sendSMS(phone, `Votre code de vérification BookMi est: ${verificationCode}`);
  } catch (error) {
    console.error('Erreur lors de l\'envoi du SMS:', error);
    // On continue même si l'envoi du SMS échoue
  }

  sendTokenResponse(booker, 201, res);
});

// @desc    Inscription d'un artiste
// @route   POST /api/auth/register/artist
// @access  Public
exports.registerArtist = asyncHandler(async (req, res, next) => {
  const { 
    firstName, lastName, birthDate, artistName, projectName, 
    discipline, eventTypes, hasProfessionalCard, 
    country, address, city, postalCode, 
    email, password, phone 
  } = req.body;

  // Vérifier si l'email existe déjà
  const userExists = await User.findOne({ email });
  if (userExists) {
    return next(new ErrorResponse('Cet email est déjà utilisé', 400));
  }

  // Créer l'artiste
  const artist = await Artist.create({
    firstName,
    lastName,
    birthDate,
    artistName,
    projectName,
    discipline,
    eventTypes,
    hasProfessionalCard,
    country,
    address,
    city,
    postalCode,
    email,
    password,
    phone,
    role: 'artist'
  });

  // Générer un code de vérification
  const verificationCode = artist.generateVerificationCode();
  await artist.save();

  // Envoyer le code par SMS
  try {
    await sendSMS(phone, `Votre code de vérification BookMi est: ${verificationCode}`);
  } catch (error) {
    console.error('Erreur lors de l\'envoi du SMS:', error);
    // On continue même si l'envoi du SMS échoue
  }

  sendTokenResponse(artist, 201, res);
});

// @desc    Connexion d'un utilisateur
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Valider l'email et le mot de passe
  if (!email || !password) {
    return next(new ErrorResponse('Veuillez fournir un email et un mot de passe', 400));
  }

  // Chercher l'utilisateur
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Identifiants invalides', 401));
  }

  // Vérifier si le mot de passe correspond
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Identifiants invalides', 401));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Déconnexion / effacement du cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  // Si un refresh token est stocké dans la base de données, le supprimer
  if (req.user) {
    req.user.refreshToken = undefined;
    await req.user.save();
  }

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Obtenir l'utilisateur actuellement connecté
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  // L'utilisateur est déjà disponible dans req.user
  const user = req.user;

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Mise à jour des informations utilisateur
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    phone: req.body.phone
  };

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Mise à jour du mot de passe
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  // Vérifier le mot de passe actuel
  if (!(await user.comparePassword(req.body.currentPassword))) {
    return next(new ErrorResponse('Mot de passe incorrect', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Vérification du compte avec le code reçu par SMS
// @route   POST /api/auth/verify
// @access  Public
exports.verifyAccount = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;

  // Trouver l'utilisateur par email
  const user = await User.findOne({ 
    email, 
    verificationCode: code,
    verificationCodeExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Code de vérification invalide ou expiré', 400));
  }

  // Marquer l'utilisateur comme vérifié
  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  // Renvoyer un token comme pour login/register
  sendTokenResponse(user, 200, res);
});

// @desc    Demande de nouveau code de vérification
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerificationCode = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new ErrorResponse('Aucun compte trouvé avec cet email', 404));
  }

  if (user.isVerified) {
    return next(new ErrorResponse('Ce compte est déjà vérifié', 400));
  }

  // Générer un nouveau code
  const verificationCode = user.generateVerificationCode();
  await user.save();

  // Envoyer le code par SMS
  try {
    await sendSMS(user.phone, `Votre nouveau code de vérification BookMi est: ${verificationCode}`);
  } catch (error) {
    console.error('Erreur lors de l\'envoi du SMS:', error);
    return next(new ErrorResponse('Erreur lors de l\'envoi du SMS', 500));
  }

  res.status(200).json({
    success: true,
    message: 'Un nouveau code de vérification a été envoyé par SMS'
  });
});

// @desc    Demande de réinitialisation du mot de passe
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new ErrorResponse('Aucun compte trouvé avec cet email', 404));
  }

  // Générer un code pour réinitialiser le mot de passe
  const resetCode = user.generateVerificationCode();
  await user.save();

  // Envoyer le code par SMS
  try {
    await sendSMS(
      user.phone,
      `Votre code de réinitialisation de mot de passe BookMi est: ${resetCode}`
    );
  } catch (error) {
    console.error('Erreur lors de l\'envoi du SMS:', error);
    return next(new ErrorResponse('Erreur lors de l\'envoi du SMS', 500));
  }

  res.status(200).json({
    success: true,
    message: 'Un code de réinitialisation a été envoyé par SMS'
  });
});

// @desc    Réinitialisation du mot de passe
// @route   PUT /api/auth/reset-password
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { email, code, newPassword } = req.body;

  // Trouver l'utilisateur par email et code
  const user = await User.findOne({
    email,
    verificationCode: code,
    verificationCodeExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Code invalide ou expiré', 400));
  }

  // Définir le nouveau mot de passe
  user.password = newPassword;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Mot de passe réinitialisé avec succès'
  });
});

// @desc    Rafraîchir le token d'accès avec un refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new ErrorResponse('Refresh token requis', 400));
  }

  // Vérifier le refresh token
  try {
    // Utilisation directe de la clé par défaut
    const decoded = jwt.verify(refreshToken, DEFAULT_REFRESH_SECRET);
    
    // Trouver l'utilisateur
    const user = await User.findById(decoded.id);
    
    if (!user || user.refreshToken !== refreshToken) {
      return next(new ErrorResponse('Refresh token invalide', 401));
    }
    
    // Générer un nouveau token d'accès
    const token = user.generateAuthToken();
    
    res.status(200).json({
      success: true,
      token
    });
  } catch (err) {
    return next(new ErrorResponse('Refresh token invalide ou expiré', 401));
  }
});

// Helper pour envoyer la réponse avec token
const sendTokenResponse = (user, statusCode, res) => {
  // Créer un token
  const token = user.generateAuthToken();

  // Créer un refresh token
  const refreshToken = user.generateRefreshToken();
  user.save();

  const options = {
    // Expire dans 1 jour (valeur fixe)
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    httpOnly: true
  };

  // Activer HTTPS en production
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
}; 