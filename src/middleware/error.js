const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log détaillé pour le développeur
  console.error('------------- ERREUR DÉTECTÉE -------------');
  console.error(`Route: ${req.method} ${req.originalUrl}`);
  console.error(`Statut: ${err.statusCode || 500}`);
  console.error(`Message: ${err.message}`);
  
  if (req.user) {
    console.error(`Utilisateur: ID=${req.user._id}, Rôle=${req.user.role}`);
  } else {
    console.error('Utilisateur: Non authentifié');
  }
  
  // Afficher la trace de la pile d'erreurs
  console.error('Stack trace:');
  console.error(err.stack);
  console.error('-------------------------------------------');

  // Erreur de validation Mongoose (mauvais ObjectId)
  if (err.name === 'CastError') {
    const message = `Ressource introuvable avec l'id ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Erreur de validation Mongoose (champs requis)
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ErrorResponse(message, 400);
  }

  // Erreur de clé dupliquée
  if (err.code === 11000) {
    const message = 'Valeur dupliquée entrée';
    error = new ErrorResponse(message, 400);
  }
  
  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token invalide. Veuillez vous reconnecter.';
    error = new ErrorResponse(message, 401);
  }
  
  // Erreur JWT expiré
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expiré. Veuillez vous reconnecter.';
    error = new ErrorResponse(message, 401);
  }
  
  // Erreur générique pour les exceptions non gérées
  if (!error.statusCode) {
    console.error('Erreur non gérée détectée:', err);
    error.statusCode = 500;
    error.message = process.env.NODE_ENV === 'production' 
      ? 'Erreur serveur' 
      : err.message || 'Erreur serveur';
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Erreur serveur',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = errorHandler; 