const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Clé secrète par défaut (identique à celle dans User.js)
const DEFAULT_JWT_SECRET = 'bookmi_default_jwt_secret_key';

// Protéger les routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  console.log('Middleware protect - Vérification du token');
  console.log('Headers:', req.headers);
  
  // Vérifier si le token est dans les headers ou les cookies
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Extraire le token du header
    token = req.headers.authorization.split(' ')[1];
    console.log('Token extrait du header Authorization:', token ? token.substring(0, 20) + '...' : 'absent');
  } else if (req.cookies && req.cookies.token) {
    // Utiliser le token depuis les cookies
    token = req.cookies.token;
    console.log('Token extrait des cookies:', token ? token.substring(0, 20) + '...' : 'absent');
  } else {
    console.log('Aucun token trouvé dans les headers ou cookies');
  }

  // S'assurer que le token existe
  if (!token) {
    return next(new ErrorResponse('Accès non autorisé', 401));
  }

  try {
    // Vérifier le token avec la même clé utilisée pour le générer
    console.log('Vérification du token JWT...');
    const decoded = jwt.verify(token, DEFAULT_JWT_SECRET);
    console.log('Token vérifié avec succès:', decoded);
    
    // Ajouter l'utilisateur à la requête
    const user = await User.findById(decoded.id);
    console.log('Utilisateur trouvé:', user ? 'oui' : 'non');
    
    if (user) {
      console.log('ID Utilisateur:', user._id);
      console.log('Rôle Utilisateur:', user.role);
      console.log('ID booker dans token:', decoded.booker);
      console.log('ID artist dans token:', decoded.artist);
    }
    
    // Vérifier que l'utilisateur a été trouvé
    if (!user) {
      console.error('Token valide mais utilisateur introuvable:', decoded);
      return next(new ErrorResponse('Accès non autorisé - utilisateur introuvable', 401));
    }
    
    // Assigner l'utilisateur à la requête avec les informations du token
    req.user = user;
    
    // Ajouter les informations booker et artist du token à req.user
    // Ces informations peuvent être absentes dans le modèle mais présentes dans le token
    if (decoded.booker) {
      req.user.booker = decoded.booker;
    }
    
    if (decoded.artist) {
      req.user.artist = decoded.artist;
    }
    
    console.log('Middleware protect - Authentification réussie');
    console.log('req.user après mise à jour:', {
      id: req.user._id,
      role: req.user.role,
      booker: req.user.booker,
      artist: req.user.artist
    });
    
    next();
  } catch (err) {
    console.error('Erreur de vérification du token:', err);
    return next(new ErrorResponse('Accès non autorisé - token invalide', 401));
  }
});

// Accorder l'accès aux rôles spécifiés
exports.authorize = (roles) => {
  return (req, res, next) => {
    console.log('Middleware authorize - Vérification du rôle');
    console.log('Rôles autorisés:', roles);
    console.log('req.user:', req.user);
    
    if (!req.user || !req.user.role) {
      console.error('Informations utilisateur incomplètes - pas de role ou de user');
      return next(
        new ErrorResponse('Informations utilisateur incomplètes', 401)
      );
    }
    
    // Convertir roles en tableau s'il est passé comme une chaîne de caractères
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    console.log('Rôle de l\'utilisateur:', req.user.role);
    console.log('Rôles autorisés (après conversion):', allowedRoles);

    if (!allowedRoles.includes(req.user.role)) {
      console.error(`Le rôle ${req.user.role} n'est pas autorisé - roles acceptés: ${allowedRoles.join(', ')}`);
      return next(
        new ErrorResponse(
          `Le rôle ${req.user.role} n'est pas autorisé à accéder à cette ressource`,
          403
        )
      );
    }
    
    console.log('Middleware authorize - Accès autorisé');
    next();
  };
};

// Vérifier si le compte est vérifié
exports.verifiedOnly = asyncHandler(async (req, res, next) => {
  if (!req.user.isVerified) {
    return next(
      new ErrorResponse('Ce compte n\'a pas été vérifié', 403)
    );
  }
  next();
}); 