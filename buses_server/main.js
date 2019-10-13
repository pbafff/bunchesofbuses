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
app.use('/test', express.static('index.html'));
app.use('/index.js', nocache, express.static('index.js'));
app.use('/Chart.js', nocache, express.static('Chart.js'));
app.listen(port, () => console.log(`listening on port ${port}`));
