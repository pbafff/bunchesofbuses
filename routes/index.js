var express = require('express');
var router = express.Router();
var usStates = require('../us-states');
var b8 = require('../b8-route');
var BayRidgeModels = require('../modules/bayridge');
var precount;

/* GET home page. */
router.get('/', function (req, res, next) {
  BayRidgeModels.count({}, function (err, count) {
    if (err) return handleError(err);
    precount = count;
    console.log(precount)
  });
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.render('index', { title: 'B8 the dumb bus', bayridgenumber: precount });
  
});

router.get('/map-zooming', function (req, res, next) {
  res.render('map-zooming', { title: 'Map Zooming example' });
});

router.get('/us-states.json', function (req, res, next) {
  res.json(usStates)
});

router.get('/b8-route.json', function (req, res, next) {
  res.json(b8)
});
module.exports = router;
