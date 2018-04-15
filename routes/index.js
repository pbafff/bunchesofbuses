var express = require('express');
var router = express.Router();
var usStates = require('../us-states');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'B8 the dumb bus' });
});

router.get('/us-states.json', function(req, res, next) {
  res.json(usStates)
});

module.exports = router;
