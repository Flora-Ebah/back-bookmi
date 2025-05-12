const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Utilisateur destinataire (artiste ou booker)
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientModel'
  },
  
  // Type de destinataire (Artist ou Booker)
  recipientModel: {
    type: String,
    required: true,
    enum: ['Artist', 'Booker']
  },
  
  // L'utilisateur qui a déclenché la notification (optionnel)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel'
  },
  
  // Type d'expéditeur (Artist ou Booker)
  senderModel: {
    type: String,
    enum: ['Artist', 'Booker']
  },
  
  // Objet associé (réservation, service, etc.)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel'
  },
  
  // Type d'objet associé
  relatedModel: {
    type: String,
    enum: ['Reservation', 'Service']
  },
  
  // Type de notification
  type: {
    type: String,
    required: true,
    enum: [
      'new_reservation',         // Nouvelle réservation créée
      'reservation_confirmed',   // Réservation confirmée par l'artiste
      'reservation_completed',   // Réservation terminée
      'reservation_cancelled',   // Réservation annulée
      'payment_received',        // Paiement reçu
      'payment_confirmed',       // Paiement confirmé
      'payment_refunded',        // Paiement remboursé
      'payment_failed',          // Échec du paiement
      'message_received',        // Message reçu
      'review_received',         // Avis reçu
      'service_booked'           // Service réservé
    ]
  },
  
  // Titre de la notification
  title: {
    type: String,
    required: true
  },
  
  // Message de la notification
  message: {
    type: String,
    required: true
  },
  
  // Données supplémentaires spécifiques au type de notification
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // État de lecture de la notification
  isRead: {
    type: Boolean,
    default: false
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Créer des index pour améliorer les performances
notificationSchema.index({ recipient: 1, recipientModel: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 