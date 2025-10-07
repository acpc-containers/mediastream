import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;
app.get('/hostname', (req, res) => {
  res.json({ hostname: process.env.HOSTNAME || 'host-app' });
});

// Load SSL certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
};

https.createServer(options, app).listen(PORT, () => {
  console.log(`Host app listening on HTTPS :${PORT}`);
});


