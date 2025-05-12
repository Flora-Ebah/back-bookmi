const express = require('express');
const {
  registerBooker,
  registerArtist,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  verifyAccount,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  refreshToken
} = require('../controllers/authController');

const router = express.Router();

// Importer le middleware d'authentification
const { protect } = require('../middleware/auth');

// Routes publiques
router.post('/register/booker', registerBooker);
router.post('/register/artist', registerArtist);
router.post('/login', login);
router.post('/verify', verifyAccount);
router.post('/resend-verification', resendVerificationCode);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);

// Routes protégées
router.get('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);

module.exports = router; 