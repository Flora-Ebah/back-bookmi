const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Clés secrètes par défaut (à utiliser si les variables d'environnement ne sont pas définies)
const DEFAULT_JWT_SECRET = 'bookmi_default_jwt_secret_key';
const DEFAULT_REFRESH_SECRET = 'bookmi_default_refresh_secret_key';

// Schéma de base pour tous les utilisateurs
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "L'email est requis"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Veuillez fournir un email valide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Le numéro de téléphone est requis'],
    trim: true
  },
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true
  },
  role: {
    type: String,
    enum: ['booker', 'artist', 'admin'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String
  },
  verificationCodeExpires: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  refreshToken: {
    type: String
  }
}, {
  // Active les timestamps automatiques
  timestamps: true,
  // Active le discriminator pour les sous-collections
  discriminatorKey: 'userType' 
});

// Méthode pour hasher le mot de passe avant de sauvegarder
UserSchema.pre('save', async function(next) {
  // Ne hash le mot de passe que s'il a été modifié
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Générer un salt et hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour générer un token JWT
UserSchema.methods.generateAuthToken = function() {
  // Créer le payload de base
  const payload = { id: this._id, role: this.role, email: this.email };
  
  // Ajouter l'ID du booker si l'utilisateur est un booker
  if (this.role === 'booker') {
    payload.booker = this._id;
  }
  
  // Ajouter l'ID de l'artiste si l'utilisateur est un artiste
  if (this.role === 'artist') {
    payload.artist = this._id;
  }
  
  // Utilisation directe de la clé par défaut, plus simple et plus fiable
  return jwt.sign(
    payload,
    DEFAULT_JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Méthode pour générer un refresh token
UserSchema.methods.generateRefreshToken = function() {
  // Utilisation directe de la clé par défaut, plus simple et plus fiable
  const refreshToken = jwt.sign(
    { id: this._id },
    DEFAULT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  // Stocker le token dans la base de données
  this.refreshToken = refreshToken;
  return refreshToken;
};

// Méthode pour comparer les mots de passe
UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Méthode pour générer un code de vérification
UserSchema.methods.generateVerificationCode = function() {
  // Générer un code à 6 chiffres
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Définir le code et sa date d'expiration (1 heure)
  this.verificationCode = code;
  this.verificationCodeExpires = Date.now() + 3600000; // 1 heure
  
  return code;
};

const User = mongoose.model('User', UserSchema);

module.exports = User; 