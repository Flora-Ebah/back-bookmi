const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Référence à la réservation associée
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    required: true
  },

  // Utilisateur qui a effectué le paiement (booker)
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booker',
    required: true
  },

  // Bénéficiaire du paiement (artiste)
  payee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },

  // Montant du paiement
  amount: {
    type: Number,
    required: true
  },

  // Frais de service (commission plateforme)
  serviceFee: {
    type: Number,
    required: true
  },

  // Montant total (montant + frais)
  totalAmount: {
    type: Number,
    required: true
  },

  // Type de paiement
  paymentType: {
    type: String,
    enum: ['full', 'advance', 'balance'],
    default: 'full'
  },

  // Méthode de paiement
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'mobile_money', 'orange', 'mtn', 'moov', 'wave', 'visa'],
    required: true
  },

  // Statut du paiement
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },

  // ID de transaction externe (fourni par le service de paiement)
  transactionId: {
    type: String,
    default: ''
  },

  // Référence unique du paiement
  reference: {
    type: String,
    unique: true
  },

  // Détails du paiement selon la méthode
  paymentDetails: {
    // Pour mobile money
    phoneNumber: String,
    operator: String,
    
    // Pour carte de crédit
    cardLast4: String,
    expiryDate: String,
    cardholderName: String
  },

  // Notes / commentaires
  notes: {
    type: String,
    default: ''
  },

  // Dates
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Mettre à jour le timestamp updatedAt avant de sauvegarder
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Si le statut change à completed, mettre à jour completedAt
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = Date.now();
  }
  
  next();
});

// Générer une référence unique avant l'enregistrement
paymentSchema.pre('save', async function(next) {
  if (!this.reference) {
    // Créer une référence au format PAY-YYYYMMDD-XXXXX
    const date = new Date();
    const dateStr = date.getFullYear() + 
                   ('0' + (date.getMonth() + 1)).slice(-2) + 
                   ('0' + date.getDate()).slice(-2);
    
    // Générer un nombre aléatoire à 5 chiffres
    const randomStr = Math.floor(10000 + Math.random() * 90000).toString();
    
    this.reference = `PAY-${dateStr}-${randomStr}`;
  }
  next();
});

// Créer des index pour améliorer les performances
paymentSchema.index({ reservation: 1 });
paymentSchema.index({ payer: 1 });
paymentSchema.index({ payee: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ reference: 1 }, { unique: true });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment; 