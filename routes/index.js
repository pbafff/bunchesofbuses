var express = require('express');
var router = express.Router();
var b8 = require('../filtered-b8-routes-and-stops.json');
var brooklyn = require('../topo-brooklyn.json');
var Trip = require('../models/trip.js');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.render('index', { title: 'B8 the dumb bus'});
});


router.get('/filtered-b8-routes-and-stops.json', function (req, res, next) {
  res.json(b8)
});

router.get('/brooklyn.json', function (req, res, next) {
  res.json(brooklyn)
});

router.get('/index', function(req, res, next) {
  console.log('get')
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  Trip.find({}, '_id begin')
    .exec(function (err, trips) {
      if (err) { return next(err); }
      //Successful, so render
      res.json(trips);
    });
})

// module.exports = router;
module.exports = function (io) {
  //Socket.IO
  io.on('connection', function (socket) {
      console.log('----User has connected to Index----');
      //ON Events

      socket.emit('message', 'You are connected');

      //End ON Events
  });
  return router;
};
