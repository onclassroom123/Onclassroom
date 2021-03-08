const express = require('express');
const router = express.Router();
const auth = require('../auth');
const views = require('./views');

router.post('/createMeeting', auth.login_required, views.createMeeting);
router.post('/scheduleMeeting', auth.login_required, views.scheduleMeeting);
router.get('/', auth.login_required, views.getMeeting);
router.post('/getpassword', auth.login_required, views.redirectMeetingPassword);
router.get('/:id', auth.login_required, views.getMeetingPassword);
router.post('/:id', auth.login_required, views.joinMeeting);


module.exports = router;