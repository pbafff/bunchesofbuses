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
