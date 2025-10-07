import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
app.get('/hostname', (req, res) => {
  res.json({ hostname: process.env.HOSTNAME || 'client-app' });
});

// Try to load SSL certificates, fallback to HTTP if not available
try {
  const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
  };
  https.createServer(options, app).listen(PORT, () => {
    console.log(`Client app listening on HTTPS :${PORT}`);
  });
} catch (error) {
  console.log('Certificates not found, using HTTP server');
  http.createServer(app).listen(PORT, () => {
    console.log(`Client app listening on HTTP :${PORT}`);
  });
}


