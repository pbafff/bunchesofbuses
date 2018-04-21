var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('<h1 contenteditable="true">respond with a resource</h1>');
});

router.get('/cool', function(req, res, next) {
  res.send('you\'re so cool');
});
module.exports = router;
module.exports = function (io) {
  //Socket.IO
  io.on('connection', function (socket) {
      console.log('User has connected to Users');
      //ON Events
      socket.on('admin', function () {
          console.log('Successful Socket Test');
      });

      //End ON Events
  });
  return router;
};
