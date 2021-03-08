const express = require('express');
const router = express.Router();
const auth = require('../auth');
const views = require('./views');

//POST new user route (optional, everyone has access)
router.post('/', auth.optional, views.createUser);

//POST login route (optional, everyone has access)
router.post('/login', auth.optional, views.login);

//GET current route (required, only authenticated users have access)
router.get('/current', auth.required, views.current);

router.get('/logout', auth.login_required, views.logout);

module.exports = router;