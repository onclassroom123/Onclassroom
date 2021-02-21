const router = require('express').Router();
const auth = require('./auth');
const controller = require('../controller/meeting');

router.post('/createMeeting', auth.login_required, controller.createMeeting);
router.post('/joinMeeting', auth.login_required, controller.joinMeeting);
router.post('/scheduleMeeting', auth.login_required, controller.scheduleMeeting);
router.get('/', auth.login_required, controller.getMeeting);
router.get('/:id', auth.login_required, controller.getMeetingPassword);


module.exports = router;