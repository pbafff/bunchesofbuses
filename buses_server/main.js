const express = require('express');
const app = express();
const port = 3000;

app.use('/', require('./controller/index'));
app.get('/test', (req,res) => res.sendFile('/home/pi/buses_server/index.html'));
app.get('/index.js', (req,res) => res.sendFile('/home/pi/buses_server/index.js'));
app.listen(port, () => console.log(`listening on port ${port}`));
