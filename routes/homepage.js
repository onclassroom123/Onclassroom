const router = require('express').Router();
const auth = require('./auth');
const controller = require('../controller/homepage');

router.get('/', auth.optional, controller.index);

module.exports = router;