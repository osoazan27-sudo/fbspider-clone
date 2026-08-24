const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

// ensure schema + seed exist on boot
require('./seed');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// request log (compact)
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(new Date().toISOString(), req.method, req.path);
  next();
});

app.get('/api/health', (_req, res) => res.json({ status: 1, data: { ok: true }, info: 'ok' }));

app.use('/api/user', require('./routes/user'));
app.use('/api/ems', require('./routes/user').ems);
app.use('/api/optconfig', require('./routes/user').optconfig);
app.use('/api/pay', require('./routes/pay'));
app.use('/api/account', require('./routes/fbmodules').account);
app.use('/api/mock', require('./routes/fbmodules').mock);
app.use('/api/keywordsx', require('./routes/target').keywordsx);
app.use('/api/keywords_item', require('./routes/target').keywordsItem);
app.use('/api/support', require('./routes/support'));

// misc endpoints the SPA pings
app.post('/api/module_statistics_visit/save', (_req, res) => res.json({ status: 1, data: [], info: 'ok' }));
app.get('/api/message_notification/unseen', (_req, res) => res.json({ status: 1, data: { count: 0 }, info: 'ok' }));

// serve built frontend if present
const webDist = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(webDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(webDist, 'index.html'), (err) => { if (err) next(); });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`fbspider-clone server listening on http://localhost:${PORT}`);
});
