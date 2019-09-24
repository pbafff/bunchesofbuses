const express = require('express'),
        router = express.Router(),
        db = require('../db/index');

router.get('/data/:boro/:route/:begin/:end', (req, res) => {
	db.query(`SELECT * FROM ${req.params.boro} WHERE publishedlinename = '${req.params.route}' AND recordedattime >= TIMESTAMP '${req.params.begin}' AT TIME ZONE 'America/New_York' AND recordedattime < TIMESTAMP '${req.params.end}' AT TIME ZONE 'America/New_York';`)
                .then(rows => res.json(rows));
});

module.exports = router;
