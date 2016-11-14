var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');
var M_interface = require('./routes/interface')

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

app.set('env', G_config.env);

var Logic = null;

if(G_config.srv.logic){
    try {
        Logic = require(G_path + G_config.srv.logic);
    }
    catch(p_err){
        console.log('Load local logic fail ' + G_path + G_config.srv.logic);
        //process.exit();
    }
}

if(!Logic){
    Logic = require('./config/sample_logic');
    console.log('use local sample logic. Find format at ./config/sample_logic');
}

var M_logic = new Logic(this);

M_interface.f_regLogic(M_logic);
app.use('/interface', M_interface);

var WechatSrv = require('./wechat/wechat_srv');
var M_srv = new WechatSrv(app, null, G_config.srv);
M_srv.f_regLogic(M_logic);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    console.log('Not Found ' + req.path);
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        //console.log(err);
        if(err.status != 404){
            //console.log(err.stack);
            console.log(err);
        }
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}
else {
    //production error handler
    //no stacktraces leaked to user
    app.use(function (err, req, res, next) {
        console.log(err);
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {}
        });
    });
}

module.exports = app;
