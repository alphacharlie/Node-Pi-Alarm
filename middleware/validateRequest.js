var passport = require('passport');
var Account = require('../models/account');
//var jwt = require('jwt-simple');

module.exports = function(req, res, next) {
 
  // When performing a cross domain request, you will recieve
  // a preflighted request first. This is to check if our the app
  // is safe.

  // Authorize the user to see if s/he can access our resources
 

  if (!req.user) {
    res.status(404);
    res.json({
      "status": 404,
      "message": "Path Not Found"   // yes, we lie. keeps our attack footprint smaller so we ALWAYS return 404
    });
    return;
  } 
  if(!req.isAuthenticated)
  {
    res.status(404);
    res.json({
      "status": 404,
      "message": "Path Not Found"   // yes, we lie. keeps our attack footprint smaller so we ALWAYS return 404
    });
    return;
  }
  next(); // To move to next middleware
};
