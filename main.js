const getBuses = require('./buses');

(async function() {
    const buses = await getBuses();
    console.log(JSON.stringify(buses, null, 2))
})()
// setInterval(async function () {
//     const buses = await getBuses();
//     // process.stdout.write('\x1b[2J');
//     console.log(JSON.stringify(buses, null, 2))
// }, 5000)
