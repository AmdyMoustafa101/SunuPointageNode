const express = require('express');
const router = express.Router();
const { sendEmail } = require('../controllers/forgotController');

// Route pour envoyer un email
router.post('/send-email', sendEmail);

module.exports = router;