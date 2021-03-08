const express = require('express');
const router = express.Router();
const auth = require('../auth');
const views = require('./views');


router.get('/', auth.optional, views.index);
router.get('/profile', auth.login_required, views.profile);
router.get('/question', auth.login_required, views.question);
router.get('/test', auth.login_required, views.test);
router.get('/result', auth.login_required, views.result);

module.exports = router;