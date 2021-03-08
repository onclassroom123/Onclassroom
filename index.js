const express = require("express");
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');
const errorHandler = require('errorhandler');
const io = require("./lib/socketserver");
const passport = require('passport');

//Configure mongoose's promise to global promise
mongoose.promise = global.Promise;

//Configure isProduction variable
const isProduction = process.env.NODE_ENV === 'production';

//Initiate our app
const app = express();

//Configure our app
app.use(cors());
app.use(require('morgan')('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use('/', express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'Onclassroom', cookie: { maxAge: 60000000 }, resave: false, saveUninitialized: false }));

if (!isProduction) {
    app.use(errorHandler());
}

//Configure Mongoose
mongoose.connect('mongodb://localhost/Onclassroom', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });
mongoose.set('debug', true);

// models and routes
require('./models/Users');
require('./models/Meetings');

//passort intitialize
require('./config/passport');
app.use(passport.initialize())
app.use(passport.session())
app.get('/', (req, res) => {
    res.render('meetingpage', { roomId: '1324945d79384579342', user: 'Rampravesh' })
})
app.use(require('./routes'));


//Error handlers & middlewares
if (!isProduction) {
    app.use((err, req, res, next) => {
        res.status(err.status || 500);
        console.log(err)
        res.json({
            errors: {
                message: err.message,
                error: err,
            },
        });
    });
}

const server = require("http").Server(app);
server.listen(process.env.PORT || 3030, () => console.log('Server running on http://localhost:3030/'));
io.ioserver(server);