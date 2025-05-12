const { Notification } = require('../models');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const notificationService = require('../utils/notificationService');

/**
 * @desc    Obtenir les notifications de l'utilisateur connecté
 * @route   GET /api/notifications
 * @access  Privé
 */
exports.getMyNotifications = asyncHandler(async (req, res) => {
  // Déterminer le rôle et l'ID de l'utilisateur
  const { role } = req.user;
  let recipientId, recipientModel;
  
  if (role === 'artist') {
    recipientId = req.user.artist || req.user.id;
    recipientModel = 'Artist';
  } else if (role === 'booker') {
    recipientId = req.user.booker || req.user.id;
    recipientModel = 'Booker';
  } else {
    return res.status(400).json({
      success: false,
      error: 'Type d\'utilisateur non supporté pour les notifications'
    });
  }
  
  // Récupérer les paramètres de pagination et filtrage
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const options = { 
    page: parseInt(page), 
    limit: parseInt(limit),
    unreadOnly: unreadOnly === 'true'
  };
  
  try {
    // Utiliser le service de notification pour récupérer les notifications
    const notifications = await notificationService.getUserNotifications(
      recipientId, 
      recipientModel,
      options
    );
    
    // Compter le nombre total de notifications non lues
    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      recipientModel,
      isRead: false
    });
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    throw new ErrorResponse('Erreur lors de la récupération des notifications', 500);
  }
});

/**
 * @desc    Marquer une notification comme lue
 * @route   PATCH /api/notifications/:id/read
 * @access  Privé
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const notificationId = req.params.id;
  
  // Vérifier que la notification existe
  const notification = await Notification.findById(notificationId);
  
  if (!notification) {
    return res.status(404).json({
      success: false,
      error: 'Notification non trouvée'
    });
  }
  
  // Vérifier que l'utilisateur est bien le destinataire
  let userId;
  if (req.user.role === 'artist') {
    userId = req.user.artist || req.user.id;
  } else if (req.user.role === 'booker') {
    userId = req.user.booker || req.user.id;
  }
  
  if (notification.recipient.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Vous n\'êtes pas autorisé à modifier cette notification'
    });
  }
  
  // Marquer comme lue
  const updatedNotification = await notificationService.markAsRead(notificationId);
  
  res.status(200).json({
    success: true,
    data: updatedNotification
  });
});

/**
 * @desc    Marquer toutes les notifications comme lues
 * @route   PATCH /api/notifications/read-all
 * @access  Privé
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  // Déterminer le rôle et l'ID de l'utilisateur
  const { role } = req.user;
  let recipientId, recipientModel;
  
  if (role === 'artist') {
    recipientId = req.user.artist || req.user.id;
    recipientModel = 'Artist';
  } else if (role === 'booker') {
    recipientId = req.user.booker || req.user.id;
    recipientModel = 'Booker';
  } else {
    return res.status(400).json({
      success: false,
      error: 'Type d\'utilisateur non supporté pour les notifications'
    });
  }
  
  // Marquer toutes comme lues
  const result = await notificationService.markAllAsRead(recipientId, recipientModel);
  
  res.status(200).json({
    success: true,
    count: result.modifiedCount || 0,
    message: 'Toutes les notifications ont été marquées comme lues'
  });
});

/**
 * @desc    Supprimer une notification
 * @route   DELETE /api/notifications/:id
 * @access  Privé
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const notificationId = req.params.id;
  
  // Vérifier que la notification existe
  const notification = await Notification.findById(notificationId);
  
  if (!notification) {
    return res.status(404).json({
      success: false,
      error: 'Notification non trouvée'
    });
  }
  
  // Vérifier que l'utilisateur est bien le destinataire
  let userId;
  if (req.user.role === 'artist') {
    userId = req.user.artist || req.user.id;
  } else if (req.user.role === 'booker') {
    userId = req.user.booker || req.user.id;
  }
  
  if (notification.recipient.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Vous n\'êtes pas autorisé à supprimer cette notification'
    });
  }
  
  // Supprimer la notification
  await notification.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
}); 