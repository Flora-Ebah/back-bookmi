const express = require('express');
const router = express.Router();

// Importer les routes
const authRoutes = require('./auth');
const serviceRoutes = require('./services');
const artistRoutes = require('./artists');
const bookerRoutes = require('./bookers');
const reservationRoutes = require('./reservations');
const notificationRoutes = require('./notifications');
const paymentRoutes = require('./payments');
const paymentMethodRoutes = require('./payment-methods');

// Monter les routes
router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/artists', artistRoutes);
router.use('/bookers', bookerRoutes);
router.use('/reservations', reservationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/payments', paymentRoutes);
router.use('/payment-methods', paymentMethodRoutes);

module.exports = router;