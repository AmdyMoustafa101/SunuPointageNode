const express = require('express');
const router = express.Router();
const { enregistrerPointage } = require('../controllers/pointageController');

router.post('/pointages', enregistrerPointage);

module.exports = router;
