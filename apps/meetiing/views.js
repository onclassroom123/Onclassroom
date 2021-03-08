const mongoose = require('mongoose');
const Meetings = mongoose.model('Meetings');
exports.createMeeting = function(req, res, next) {
    const { password, discription } = req.body;
    try {
        const meetings = new Meetings({ discription, host: req.user, dateTime: new Date() });
        meetings.setPassword(password);
        meetings.save();
        return res.render('meetingpage', { roomId: meetings._id, user: req.user })
    } catch (err) {
        next(err)
    };

}
exports.joinMeeting = function(req, res, next) {
    const { _id, password } = req.body;
    Meetings.updateOne({ _id }, { $addToSet: { users: req.user } })
    Meetings.findOne({ _id }).then((meeting) => {
            if (meeting.validatePassword(password)) {
                meeting.updateOne({ _id }, { users: req.user })
                meeting.users.addToSet(req.user);
                meeting.save();
                let is_host = meeting.is_host(req.user._id);
                return res.render('meetingpage', { roomId: meeting._id, user: req.user, is_host });
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
            return res.render('meetinpage', { roomId: meetings._id })
        })
        .catch(err => next(err));
}
exports.getMeetingPassword = function(req, res, next) {
    console.log(req.body)
    return res.render('meetingPassword', { meetingId: req.params.id, user: req.user });
}
exports.redirectMeetingPassword = function(req, res, next) {
    const { _id } = req.body;
    console.log(_id)
    return res.redirect(`/meeting/${_id}`);
}
exports.getMeeting = function(req, res, next) {
    const host = req.user;
    Meetings.find({ host }, '_id host discription dateTime').then((meetings) => {
            return res.render('index', { meeting: meetings, meetinginvite: '', user: host, page: 'meeting' });
        })
        .catch(err => next(err));
}