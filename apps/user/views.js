const mongoose = require('mongoose');
const Users = mongoose.model('Users');
const passport = require('passport');

function sendError(user, res) {
    return new Promise(function(resolve, reject) {
        Object.keys(user).forEach(function(key) {
            if (!user[key]) {
                reject(`${key} is required`);
            }
        });
        resolve();
    })

}

exports.createUser = async function(req, res, next) {
    const user = req.body;
    console.log(user);
    sendError(user, res)
        .then(() => {
            Users.exists({ username: user.username })
                .then(() => {
                    const finalUser = new Users(user);
                    finalUser.setPassword(user.password);
                    return finalUser.save()
                        .then(() => res.redirect('/'));
                }).catch((error) => next(error));

        }).catch((error) => next(error))

}

exports.login = function(req, res, next) {
    const user = req.body;
    sendError(user, res).then(() => {
        passport_login(req, res, next)
    }).catch((error) => next(error));
}

exports.current = function(req, res, next) {
    const { payload: { id } } = req;

    return Users.findById(id)
        .then((user) => {
            if (!user) {
                return res.sendStatus(400);
            }

            return res.json({ user: user.toAuthJSON() });
        })
        .catch(err);
}

//logout
exports.logout = function(req, res) {
        req.logout();
        res.redirect('/')
    }
    //passport login
function passport_login(req, res, next) {
    return passport.authenticate('local', (err, passportUser, info) => {
        if (err) {
            return next(err);
        }
        if (passportUser) {
            const user = passportUser;
            user.token = passportUser.generateJWT();
            req.logIn(user, function(err) {
                if (err) { return next(err); }
                return res.redirect('/');
            });
        }

        return res.status(400).send(info);
    })(req, res, next);
}

function create_user() {

}