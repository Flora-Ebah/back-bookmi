const { Notification } = require('../models');

/**
 * Service de gestion des notifications
 */
const notificationService = {
  /**
   * Créer une nouvelle notification
   * @param {Object} notificationData - Données de la notification
   * @returns {Promise<Object>} - La notification créée
   */
  async createNotification(notificationData) {
    try {
      const notification = await Notification.create(notificationData);
      return notification;
    } catch (error) {
      console.error('Erreur lors de la création de la notification:', error);
      throw error;
    }
  },

  /**
   * Créer une notification pour une nouvelle réservation
   * @param {Object} reservation - La réservation créée
   * @returns {Promise<Object>} - La notification créée
   */
  async notifyNewReservation(reservation) {
    try {
      // Notification pour l'artiste
      const artistNotification = {
        recipient: reservation.artistId,
        recipientModel: 'Artist',
        sender: reservation.booker,
        senderModel: 'Booker',
        relatedId: reservation._id,
        relatedModel: 'Reservation',
        type: 'new_reservation',
        title: 'Nouvelle réservation',
        message: `Vous avez une nouvelle réservation pour le ${reservation.date}`,
        data: {
          reservationId: reservation._id,
          serviceId: reservation.serviceId,
          date: reservation.date,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          location: reservation.location
        }
      };

      return await this.createNotification(artistNotification);
    } catch (error) {
      console.error('Erreur lors de la notification de nouvelle réservation:', error);
      throw error;
    }
  },

  /**
   * Créer une notification pour un changement de statut de réservation
   * @param {Object} reservation - La réservation mise à jour
   * @param {String} previousStatus - Le statut précédent
   * @returns {Promise<Object>} - La notification créée
   */
  async notifyReservationStatusChange(reservation, previousStatus) {
    try {
      let type, title, message;

      switch (reservation.status) {
        case 'confirmed':
          type = 'reservation_confirmed';
          title = 'Réservation confirmée';
          message = `Votre réservation pour le ${reservation.date} a été confirmée par l'artiste`;
          break;
        case 'completed':
          type = 'reservation_completed';
          title = 'Réservation terminée';
          message = `Votre réservation pour le ${reservation.date} est maintenant terminée`;
          break;
        case 'cancelled':
          type = 'reservation_cancelled';
          title = 'Réservation annulée';
          message = `Votre réservation pour le ${reservation.date} a été annulée`;
          break;
        default:
          return null; // Ne pas créer de notification pour les autres statuts
      }

      // Notification pour le booker
      const bookerNotification = {
        recipient: reservation.booker,
        recipientModel: 'Booker',
        sender: reservation.artistId,
        senderModel: 'Artist',
        relatedId: reservation._id,
        relatedModel: 'Reservation',
        type,
        title,
        message,
        data: {
          reservationId: reservation._id,
          serviceId: reservation.serviceId,
          previousStatus,
          newStatus: reservation.status,
          date: reservation.date,
          startTime: reservation.startTime,
          endTime: reservation.endTime
        }
      };

      return await this.createNotification(bookerNotification);
    } catch (error) {
      console.error('Erreur lors de la notification de changement de statut:', error);
      throw error;
    }
  },

  /**
   * Récupérer les notifications d'un utilisateur
   * @param {String} recipientId - ID du destinataire
   * @param {String} recipientModel - Type de destinataire (Artist/Booker)
   * @param {Object} options - Options de pagination et filtrage
   * @returns {Promise<Array>} - Liste des notifications
   */
  async getUserNotifications(recipientId, recipientModel, options = {}) {
    try {
      const { limit = 20, page = 1, unreadOnly = false } = options;
      
      const query = {
        recipient: recipientId,
        recipientModel
      };
      
      if (unreadOnly) {
        query.isRead = false;
      }
      
      const skip = (page - 1) * limit;
      
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
      
      return notifications;
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
      throw error;
    }
  },

  /**
   * Marquer une notification comme lue
   * @param {String} notificationId - ID de la notification
   * @returns {Promise<Object>} - La notification mise à jour
   */
  async markAsRead(notificationId) {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { isRead: true },
        { new: true }
      );
      
      return notification;
    } catch (error) {
      console.error('Erreur lors du marquage de la notification comme lue:', error);
      throw error;
    }
  },

  /**
   * Marquer toutes les notifications d'un utilisateur comme lues
   * @param {String} recipientId - ID du destinataire
   * @param {String} recipientModel - Type de destinataire (Artist/Booker)
   * @returns {Promise<Object>} - Résultat de la mise à jour
   */
  async markAllAsRead(recipientId, recipientModel) {
    try {
      const result = await Notification.updateMany(
        { recipient: recipientId, recipientModel, isRead: false },
        { isRead: true }
      );
      
      return result;
    } catch (error) {
      console.error('Erreur lors du marquage de toutes les notifications comme lues:', error);
      throw error;
    }
  },
  
  /**
   * Créer des notifications pour un paiement
   * @param {Object} payment - Le paiement effectué
   * @param {Object} reservation - La réservation associée au paiement
   * @param {String} action - L'action de paiement ('created', 'confirmed', 'refunded', etc.)
   * @returns {Promise<Array>} - Les notifications créées
   */
  async notifyPayment(payment, reservation, action = 'created') {
    try {
      const notifications = [];
      const isAdvancePayment = payment.paymentType === 'advance';
      const formattedAmount = payment.amount.toLocaleString();
      let artistTitle, artistMessage, bookerTitle, bookerMessage;
      
      // Déterminer les messages en fonction de l'action et du type de paiement
      switch (action) {
        case 'created':
          artistTitle = 'Paiement reçu';
          artistMessage = isAdvancePayment 
            ? `Un acompte de ${formattedAmount} FCFA a été reçu pour la réservation du ${reservation.date}`
            : `Un paiement de ${formattedAmount} FCFA a été reçu pour la réservation du ${reservation.date}`;
            
          bookerTitle = 'Paiement effectué';
          bookerMessage = isAdvancePayment
            ? `Votre acompte de ${formattedAmount} FCFA pour la réservation du ${reservation.date} a été traité avec succès`
            : `Votre paiement de ${formattedAmount} FCFA pour la réservation du ${reservation.date} a été traité avec succès`;
          break;
          
        case 'confirmed':
          artistTitle = 'Paiement confirmé';
          artistMessage = isAdvancePayment
            ? `Un acompte de ${formattedAmount} FCFA a été confirmé pour la réservation du ${reservation.date}`
            : `Un paiement de ${formattedAmount} FCFA a été confirmé pour la réservation du ${reservation.date}`;
            
          bookerTitle = 'Paiement confirmé';
          bookerMessage = isAdvancePayment
            ? `Votre acompte de ${formattedAmount} FCFA pour la réservation du ${reservation.date} a été confirmé`
            : `Votre paiement de ${formattedAmount} FCFA pour la réservation du ${reservation.date} a été confirmé`;
          break;
          
        case 'refunded':
          artistTitle = 'Paiement remboursé';
          artistMessage = isAdvancePayment
            ? `Un acompte de ${formattedAmount} FCFA a été remboursé pour la réservation du ${reservation.date}`
            : `Un paiement de ${formattedAmount} FCFA a été remboursé pour la réservation du ${reservation.date}`;
            
          bookerTitle = 'Paiement remboursé';
          bookerMessage = isAdvancePayment
            ? `Votre acompte de ${formattedAmount} FCFA pour la réservation du ${reservation.date} a été remboursé`
            : `Votre paiement de ${formattedAmount} FCFA pour la réservation du ${reservation.date} a été remboursé`;
          break;
          
        default:
          artistTitle = 'Mise à jour de paiement';
          artistMessage = `Le paiement pour la réservation du ${reservation.date} a été mis à jour`;
          bookerTitle = 'Mise à jour de paiement';
          bookerMessage = `Le paiement pour votre réservation du ${reservation.date} a été mis à jour`;
      }
      
      // Données communes pour les notifications
      const paymentData = {
        paymentId: payment._id,
        reservationId: reservation._id,
        amount: payment.amount,
        paymentType: payment.paymentType,
        paymentMethod: payment.paymentMethod,
        action,
        date: new Date()
      };
      
      // Déterminer le type de notification en fonction de l'action
      let notificationType = 'payment_received';
      switch (action) {
        case 'confirmed':
          notificationType = 'payment_confirmed';
          break;
        case 'refunded':
          notificationType = 'payment_refunded';
          break;
        case 'failed':
          notificationType = 'payment_failed';
          break;
      }
      
      // Créer la notification pour l'artiste
      const artistNotification = {
        recipient: reservation.artistId,
        recipientModel: 'Artist',
        sender: reservation.booker,
        senderModel: 'Booker',
        relatedId: reservation._id,
        relatedModel: 'Reservation',
        type: notificationType,
        title: artistTitle,
        message: artistMessage,
        data: paymentData
      };
      
      // Créer la notification pour le booker
      const bookerNotification = {
        recipient: reservation.booker,
        recipientModel: 'Booker',
        sender: reservation.artistId,
        senderModel: 'Artist',
        relatedId: reservation._id,
        relatedModel: 'Reservation',
        type: notificationType,
        title: bookerTitle,
        message: bookerMessage,
        data: paymentData
      };
      
      // Créer les notifications
      const artistNotif = await this.createNotification(artistNotification);
      const bookerNotif = await this.createNotification(bookerNotification);
      
      notifications.push(artistNotif, bookerNotif);
      return notifications;
    } catch (error) {
      console.error('Erreur lors de la création des notifications de paiement:', error);
      throw error;
    }
  }
};

module.exports = notificationService; 