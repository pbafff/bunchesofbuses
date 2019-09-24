const express = require('express'),
        router = express.Router();

router.use('/', require('./data'));

module.exports = router;
