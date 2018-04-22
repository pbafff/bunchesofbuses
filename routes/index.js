var express = require('express');
var router = express.Router();
var usStates = require('../us-states');
var b8 = require('../filtered-b8-routes-and-stops');
var buses = require('../busLocations');
var BayRidgeModels = require('../modules/bayridge');
var precount;

/* GET home page. */
router.get('/', function (req, res, next) {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.render('index', { title: 'B8 the dumb bus', bayridgenumber: precount });
  
});

router.get('/map-zooming', function (req, res, next) {
  res.render('map-zooming', { title: 'Map Zooming example' });
});

router.get('/us-states.json', function (req, res, next) {
  res.json(usStates)
});

router.get('/filtered-b8-routes-and-stops.json', function (req, res, next) {
  res.json(b8)
});

router.get('/busLocations.json', function (req, res, next) {
  res.json(buses)
});
module.exports = router;
module.exports = function (io) {
  //Socket.IO
  io.on('connection', function (socket) {
      console.log('#####User has connected to Index####');
      //ON Events
      socket.on('admin', function () {
          console.log('Successful Socket Test');
      });

      socket.emit('message', 'You are connected');

      //End ON Events
  });
  return router;
};
