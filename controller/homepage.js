exports.index = function(req, res, next) {
    if (req.isAuthenticated()) {
        return res.render('index', { user: req.user })
    } else { return res.render('index', { user: '' }) }
}