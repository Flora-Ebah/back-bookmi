// const twilio = require('twilio');

// Configuration Twilio
// const TWILIO_ACCOUNT_SID = '...';
// const TWILIO_AUTH_TOKEN = '...';
// const TWILIO_PHONE_NUMBER = '...';

// Création du client Twilio
// const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Envoie un code de vérification via SMS (simulation uniquement en développement)
 * @param {string} phoneNumber - Le numéro de téléphone du destinataire (format international)
 * @param {string} message - Le message complet à envoyer
 * @returns {Promise<boolean>} - True si l'envoi est simulé avec succès
 */
const sendSMS = async (phoneNumber, message) => {
  // Extraire le code de vérification du message
  const codeMatch = message.match(/(\d{6})/);
  if (!codeMatch) {
    console.error('Code de vérification non trouvé dans le message');
    return false;
  }

  // Afficher le message dans la console (simulation)
  console.log(`SMS simulé à ${phoneNumber}: ${message}`);

  // Toujours simuler l'envoi en développement
  console.log('Mode simulation: SMS considéré comme envoyé avec succès');
  return true;
};

module.exports = sendSMS; 