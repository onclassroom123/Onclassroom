const mongoose = require('mongoose');
const Meetings = mongoose.model('Meetings');
exports.createMeeting = function(req, res, next) {
    const { password, discription } = req.body;
    Meetings({ discription, host: req.user, dateTime: new Date() })
        .then((meetings) => {
            meetings.setPassword(password);
            meetings.save();
            return res.render('main', { roomId: meetings._id, user: req.user })
        })
        .catch(err => next(err));

}
exports.joinMeeting = function(req, res, next) {
    const { _id, password } = req.body;
    Meetings.updateOne({ _id }, { $addToSet: { users: req.user } })
    Meetings.findOne({ _id }).then((meeting) => {
            if (meeting.validatePassword(password)) {
                meeting.updateOne({ _id }, { users: req.user })
                meeting.users.addToSet(req.user);
                meeting.save();
                return res.render('main', { roomId: meeting._id, user: req.user });
            } else {
                next('Password not match')
            }
        })
        .catch(err => next(err));
}
exports.scheduleMeeting = function(req, res, next) {
    const { date, time, password, discription } = req.body;
    Meetings({ discription, host: req.user, dateTime: date + " " + time })
        .then((meetings) => {
            meetings.setPassword(password);
            meetings.save();
            return res.render('main', { roomId: meetings._id })
        })
        .catch(err => next(err));
}
exports.getMeetingPassword = function(req, res, next) {
    return res.render('meetingPassword', { meetingId: req.params.id, user: req.user });
}

exports.getMeeting = function(req, res, next) {
    const host = req.user;
    Meetings.find({ host }, '_id host discription dateTime').then((meetings) => {
            return res.render('meeting', { meeting: meetings, meetinginvite: '', user: host });
        })
        .catch(err => next(err));
}