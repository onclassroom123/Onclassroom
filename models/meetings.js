const mongoose = require('mongoose');
const { Schema } = mongoose;
const Users = mongoose.model('Users');
const crypto = require('crypto');

const MeetingSchema = new Schema({
    hash: String,
    salt: String,
    host: { requied: true, type: Schema.Types.ObjectId, ref: 'Users' },
    islocked: { type: Boolean, default: false },
    users: [{ type: Schema.Types.ObjectId, ref: 'Users' }],
    discription: { require: true, type: String },
    dateTime: { type: Date, require: true }
});
MeetingSchema.methods.setPassword = function(password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};

MeetingSchema.methods.validatePassword = function(password) {
    const hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
    return this.hash === hash;
};

MeetingSchema.methods.getMeetingId = function() {
    return this.id;
};
MeetingSchema.methods.getHost = function() {
    return this.host;
};
MeetingSchema.methods.is_lock = function() {
    return this.islocked;
};

MeetingSchema.methods.lock = function() {
    return this.islocked = true;
};
MeetingSchema.methods.unLock = function() {
    return this.islocked = false;
};

mongoose.model('Meetings', MeetingSchema);