const jwt = require('express-jwt');

const getTokenFromHeaders = (req) => {
    const { headers: { authorization } } = req;

    if (authorization && authorization.split(' ')[0] === 'Token') {
        return authorization.split(' ')[1];
    }
    return null;
};

const auth = {
    required: required(true),
    optional: required(false),
    login_required: (req, res, next) => {
        if (req.isAuthenticated()) {
            next()
        } else {
            res.redirect('/')
        }
    }
};

const authentication = {
    required: (req, res, next) => {
        if (req.isAuthenticated) {
            next()
        } else {
            res.redirect('/')
        }
    }
}

function required(value) {
    try {
        return jwt({
            secret: 'secret',
            userProperty: 'payload',
            getToken: getTokenFromHeaders,
            algorithms: ['HS256'],
            credentialsRequired: value
        })
    } catch (err) {
        return res.status(401).json({
            errors: {
                message: 'User token not found',
            },
        });
    }
}

module.exports = auth;