var express = require('express');
var router = express.Router();
var b8 = require('../filtered-b8-routes-and-stops.json');
var brooklyn = require('../topo-brooklyn.json');

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
