exports.index = function(req, res, next) {
    if (req.isAuthenticated()) {
        return res.render('index', { user: req.user, page: 'dashboard' })
    } else { return res.render('index', { user: '', page: 'index' }) }
}
exports.profile = function(req, res, next) {
    return res.render('index', { user: req.user, page: 'profile' });
}
exports.result = function(req, res, next) {
    return res.render('index', { user: req.user, page: 'result' });
}
exports.question = function(req, res, next) {
    return res.render('index', { user: req.user, page: 'question' });
}
exports.test = function(req, res, next) {
    return res.render('index', { user: req.user, page: 'test' });
}