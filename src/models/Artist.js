const mongoose = require('mongoose');
const User = require('./User');

// Schéma pour les avis/reviews
const ReviewSchema = new mongoose.Schema({
  booker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booker',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  artistResponse: {
    text: {
      type: String,
      trim: true
    },
    date: {
      type: Date
    }
  }
});

// Schéma spécifique aux artistes
const ArtistSchema = new mongoose.Schema({
  artistName: {
    type: String,
    required: [true, "Le nom d'artiste est requis"],
    trim: true
  },
  projectName: {
    type: String,
    trim: true
  },
  birthDate: {
    type: Date,
    required: [true, "La date de naissance est requise"]
  },
  discipline: {
    type: String,
    required: [true, "La discipline est requise"],
    enum: ['music', 'dance', 'theater', 'visual', 'circus', 'other']
  },
  eventTypes: {
    type: [String],
    required: [true, "Au moins un type d'événement est requis"],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: "Veuillez sélectionner au moins un type d'événement"
    }
  },
  hasProfessionalCard: {
    type: Boolean,
    default: false
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: [true, "La ville est requise"],
    trim: true
  },
  postalCode: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    required: [true, "Le pays est requis"],
    trim: true
  },
  profilePhoto: {
    type: String
  },
  gallery: [{
    type: String
  }],
  biography: {
    type: String
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  availability: {
    type: mongoose.Schema.Types.Mixed
  },
  rating: {
    value: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [ReviewSchema],
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }],
  profileViews: {
    type: Number,
    default: 0
  }
});

// Créer le modèle Artist en utilisant la discrimination
const Artist = User.discriminator('Artist', ArtistSchema);

module.exports = Artist; 