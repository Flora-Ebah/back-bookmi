const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  // Utilisateur propriétaire du moyen de paiement
  user: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'userModel',
    required: true
  },
  
  // Type d'utilisateur (Booker ou Artist)
  userModel: {
    type: String,
    required: true,
    enum: ['Booker', 'Artist']
  },
  
  // Type de moyen de paiement
  type: {
    type: String,
    required: true,
    enum: ['credit_card', 'mobile_money', 'orange', 'mtn', 'moov', 'wave', 'visa']
  },
  
  // Nom du moyen de paiement (ex: "Ma carte Visa", "Mon compte Orange Money")
  name: {
    type: String,
    required: true
  },
  
  // Détails spécifiques selon le type
  details: {
    // Pour cartes de crédit
    cardNumber: String, // Stocké de manière sécurisée ou seulement les derniers chiffres
    cardholderName: String,
    expiryDate: String,
    
    // Pour Mobile Money
    phoneNumber: String,
    operator: String,
  },
  
  // Moyen de paiement par défaut
  isDefault: {
    type: Boolean,
    default: false
  },
  
  // Métadonnées
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Mettre à jour le timestamp updatedAt avant de sauvegarder
paymentMethodSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Assurer qu'un seul moyen de paiement est défini comme défaut par utilisateur
paymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault) {
    // Si ce moyen de paiement est défini comme défaut, désactiver les autres pour cet utilisateur
    await this.constructor.updateMany(
      { 
        user: this.user, 
        userModel: this.userModel, 
        _id: { $ne: this._id }, 
        isDefault: true 
      },
      { isDefault: false }
    );
  }
  next();
});

// Assurer qu'un utilisateur a toujours un moyen de paiement par défaut s'il en a au moins un
paymentMethodSchema.post('save', async function() {
  // Compter le nombre de moyens de paiement par défaut pour cet utilisateur
  const defaultCount = await this.constructor.countDocuments({
    user: this.user,
    userModel: this.userModel,
    isDefault: true
  });
  
  // S'il n'y a pas de moyen de paiement par défaut, définir le premier comme défaut
  if (defaultCount === 0) {
    const firstPaymentMethod = await this.constructor.findOne({
      user: this.user,
      userModel: this.userModel
    }).sort('createdAt');
    
    if (firstPaymentMethod) {
      firstPaymentMethod.isDefault = true;
      await firstPaymentMethod.save();
    }
  }
});

// Créer un index pour améliorer les performances des requêtes courantes
paymentMethodSchema.index({ user: 1, userModel: 1, isDefault: 1 });

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

module.exports = PaymentMethod; 