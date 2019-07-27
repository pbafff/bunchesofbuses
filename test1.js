require('dotenv').config();
const getBuses = require('./buses');
const RefWatcher = require('./RefWatcher');

(async function () {
    const data = await getBuses();
    RefWatcher.scanRefs(data[1].flat());

    console.log(JSON.stringify(data, null, 2));
})()
