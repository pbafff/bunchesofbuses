const express = require('express');
const app = express();
const port = 3000;

function nocache(req, res, next) {
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.header('Expires', '0');
      res.header('Pragma', 'no-cache');
      next();
}

app.use('/', require('./controller/index'));
app.get('/test', (req, res) => res.sendFile('/home/andre/bunchesofbuses/buses_server/index.html'));
app.get('/index.js', nocache, (req, res) => res.sendFile('/home/andre/bunchesofbuses/buses_server/index.js'));
app.listen(port, () => console.log(`listening on port ${port}`));
