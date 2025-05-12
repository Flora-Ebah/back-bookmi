const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  // Relations avec d'autres collections
  booker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booker',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  artistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  
  // Statut de la réservation
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // Statut du paiement
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partial'],
    default: 'pending'
  },
  
  // ID de transaction du paiement
  transactionId: {
    type: String,
    default: ''
  },
  
  // Informations sur l'événement
  date: {
    type: String, // Format YYYY-MM-DD
    required: true
  },
  startTime: {
    type: String, // Format HH:MM
    required: true
  },
  endTime: {
    type: String, // Format HH:MM
    required: true
  },
  location: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  
  // Informations de prix
  amount: {
    type: Number,
    required: true
  },
  serviceFee: {
    type: Number,
    required: true
  },
  
  // Informations de paiement
  paymentMethod: {
    type: String, 
    enum: ['orange', 'mtn', 'moov', 'wave', 'visa'],
    required: true
  },
  
  // Détails du paiement selon la méthode
  paymentNumber: String, // Pour mobile money
  
  // Pour carte de crédit
  cardNumber: String,
  expiryDate: String,
  cvv: String,
  cardName: String,
  
  // Informations de suivi
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
reservationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Créer des index pour améliorer les performances
reservationSchema.index({ booker: 1 });
reservationSchema.index({ serviceId: 1 });
reservationSchema.index({ artistId: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ date: 1 });
reservationSchema.index({ paymentMethod: 1 });
reservationSchema.index({ paymentStatus: 1 });

const Reservation = mongoose.model('Reservation', reservationSchema);

module.exports = Reservation; 