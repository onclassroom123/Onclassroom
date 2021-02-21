const router = require('express').Router();
const auth = require('../auth');
const controller = require('../../controller/users');

//POST new user route (optional, everyone has access)
router.post('/', auth.optional, controller.createUser);

//POST login route (optional, everyone has access)
router.post('/login', auth.optional, controller.login);

//GET current route (required, only authenticated users have access)
router.get('/current', auth.required, controller.current);

router.get('/logout', auth.login_required, controller.logout);

module.exports = router;