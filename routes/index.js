const express = require('express');
const router = express.Router();
const controller = require('../controller/homepage')

router.use('/api', require('./api'));
router.use('/meeting', require('./meeting'));
router.use('/', require('./homepage'));
module.exports = router;