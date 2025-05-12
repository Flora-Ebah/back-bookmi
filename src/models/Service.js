const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Le titre du service est requis'],
    trim: true,
    maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères']
  },
  description: {
    type: String,
    required: [true, 'La description du service est requise'],
    trim: true,
    maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères']
  },
  category: {
    type: String,
    required: [true, 'La catégorie du service est requise'],
    enum: {
      values: ['Concert', 'Animation', 'Atelier', 'Cours', 'Festival', 'Autre'],
      message: 'Veuillez sélectionner une catégorie valide'
    }
  },
  duration: {
    type: Number,
    required: [true, 'La durée du service est requise'],
    min: [0.5, 'La durée minimum est de 0.5 heure']
  },
  price: {
    type: Number,
    required: [true, 'Le prix du service est requis'],
    min: [0, 'Le prix ne peut pas être négatif']
  },
  active: {
    type: Boolean,
    default: true
  },
  features: [{
    type: String,
    trim: true
  }],
  photos: [{
    type: String, // URL des images
    trim: true
  }],
  videos: [{
    type: String, // URL des vidéos YouTube
    trim: true
  }],
  socialLinks: {
    facebook: {
      type: String,
      trim: true
    },
    instagram: {
      type: String,
      trim: true
    },
    youtube: {
      type: String,
      trim: true
    },
    tiktok: {
      type: String,
      trim: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Mettre à jour le timestamp updatedAt avant de sauvegarder
serviceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Après avoir supprimé un service, le retirer également de l'artiste
serviceSchema.post('remove', async function() {
  try {
    const Artist = mongoose.model('Artist');
    await Artist.findByIdAndUpdate(
      this.artist,
      { $pull: { services: this._id } }
    );
  } catch (err) {
    console.error('Erreur lors de la suppression du service de l\'artiste:', err);
  }
});

// Créer un index pour améliorer les performances de recherche
serviceSchema.index({ artist: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ 
  title: 'text', 
  description: 'text',
  features: 'text'
}, {
  weights: {
    title: 10,
    description: 5,
    features: 3
  }
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service; 