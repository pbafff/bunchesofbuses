require('dotenv').config();
const getBuses = require('./buses');
const RefWatcher = require('./RefWatcher');
const db = require('./db/index');

setInterval(async function () {
    const [positions, stops] = await getBuses();
    RefWatcher.scanRefs(stops.flat());

    positions.forEach((direction, i) => {
        if (direction.length > 0) {
            db.query('INSERT INTO positions VALUES (NOW(),$1,$2)', [`${i}`, direction])
                .catch(err => console.log('POSITIONS ERROR\n', err, JSON.stringify(direction, null, 2)));
        }
    });

    stops.forEach(direction => {
        direction.forEach(x => {
            db.query('INSERT INTO stops VALUES ($1,$2,$3,$4,$5,$6,$7) WHERE NOT EXISTS (SELECT recordedattime, journeyid FROM stops WHERE recordedattime = $1 AND journeyid = $7)', Object.values(x))
                .catch(err => console.log('STOPS ERROR\n', err, JSON.stringify(x, null, 2)));
        });
    });

}, 15000);
