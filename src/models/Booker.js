const mongoose = require('mongoose');
const User = require('./User');

// Schéma spécifique aux bookers
const BookerSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, "Le nom de l'entreprise est requis"],
    trim: true
  },
  address: {
    type: String,
    required: [true, "L'adresse est requise"],
    trim: true
  },
  city: {
    type: String,
    required: [true, "La ville est requise"],
    trim: true
  },
  postalCode: {
    type: String,
    required: [true, "Le code postal est requis"],
    trim: true
  },
  country: {
    type: String,
    required: [true, "Le pays est requis"],
    trim: true
  },
  events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist'
  }],
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }]
});

// Créer le modèle Booker en utilisant la discrimination
const Booker = User.discriminator('Booker', BookerSchema);

module.exports = Booker; 