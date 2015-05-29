var passport = require('passport');
var Account = require('./models/account');
var fs = require('fs');
var jwt = require('jwt-simple');

module.exports = function (app) {

// Auth Middleware - This will check if the user is logged in
// Any URL's that do not follow the below pattern should be avoided unless you
// are sure that authentication is not needed

  app.all('/rest/*', [require('./middleware/validateRequest')]);
  app.all('/pictures/camera/*', [require('./middleware/validateRequest')]);
  app.all('/pictures/entry/*', [require('./middleware/validateRequest')]);
  app.all('/logs/*', [require('./middleware/validateRequest')]);
  app.all('/logs', [require('./middleware/validateRequest')]);

  var isAuthBase = function(req, res, next) { //lighter auth that redirects to /login
    if(req.isAuthenticated())
      return next();
    res.redirect('/login');
 };

  app.get('/', isAuthBase, function (req, res) { 
    res.render('index', { user : req.user });
  });

  //

//comment out the 'register' routes below after user creation to secure ALARM system.

 // app.get('/register', function(req, res) {
 //     res.render('register', { });
 // });

 // app.post('/register', function(req, res) {
 //   Account.register(new Account({ username : req.body.username, email : req.body.email, phone : req.body.phone }), req.body.password, function(err, account) {
 //       if (err) {
 //           return res.render('register', { account : account });
 //       }

 //       passport.authenticate('local')(req, res, function () {
 //         res.redirect('/');
 //       });
 //   });
 // });

  app.get('/login', function(req, res) {
      res.render('login', { user : req.user });
  });


  app.post('/login', passport.authenticate('local'), function(req, res) {       
    res.redirect('/');
  });

  app.get('/logout', function(req, res) {
      req.logout();
      res.redirect('/');
  });

};
