import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Create both HTTP and HTTPS servers
const httpServer = http.createServer(app);
let httpsServer = null;

try {
  const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
  };
  httpsServer = https.createServer(options, app);
  console.log('Created both HTTP and HTTPS servers');
} catch (error) {
  console.log('Certificates not found, using HTTP server only');
}

// Use HTTPS server for Socket.IO to support both WS and WSS
const server = httpsServer || httpServer;
const io = new SocketIOServer(server, {
	cors: {
		origin: '*'
	}
});

const PORT = process.env.PORT || 3000;

// In-memory presence registry
const clients = new Map(); // socketId -> { role, hostname, lastPingMs, latencyMs, roomId }

function getPresence() {
	return Array.from(clients.entries()).map(([socketId, info]) => ({ socketId, ...info }));
}

// REST endpoints
app.get('/presence', (req, res) => {
	res.json({ clients: getPresence() });
});

app.get('/hostname', (req, res) => {
	// Helpful for clients to know their container/host name if passed as env
	const hostname = process.env.HOSTNAME || 'unknown-host';
	res.json({ hostname });
});

io.on('connection', (socket) => {
	// Register minimal record
	clients.set(socket.id, {
		role: 'unknown',
		hostname: undefined,
		lastPingMs: Date.now(),
		latencyMs: undefined,
		roomId: 'default'
	});

	// Identify (role/hostname)
	socket.on('identify', ({ role, hostname, roomId = 'default' } = {}) => {
		const entry = clients.get(socket.id);
		if (!entry) return;
		entry.role = role || 'unknown';
		entry.hostname = hostname;
		entry.roomId = roomId;
		clients.set(socket.id, entry);
		io.to(roomId).emit('presence:update', getPresence().filter(c => c.roomId === roomId));
		if (roomId) socket.join(roomId);
	});

	// Heartbeat ping/pong to compute latency
	socket.on('heartbeat:ping', (clientTs) => {
		socket.emit('heartbeat:pong', clientTs);
	});

	// Client reports measured latency
	socket.on('heartbeat:latency', (latencyMs) => {
		const entry = clients.get(socket.id);
		if (!entry) return;
		entry.lastPingMs = Date.now();
		entry.latencyMs = latencyMs;
		clients.set(socket.id, entry);
		io.to(entry.roomId).emit('presence:update', getPresence().filter(c => c.roomId === entry.roomId));
	});

	// WebRTC signaling relays
	socket.on('webrtc:offer', ({ toSocketId, sdp, roomId = 'default' }) => {
		io.to(toSocketId).emit('webrtc:offer', { fromSocketId: socket.id, sdp, roomId });
	});

	socket.on('webrtc:answer', ({ toSocketId, sdp, roomId = 'default' }) => {
		io.to(toSocketId).emit('webrtc:answer', { fromSocketId: socket.id, sdp, roomId });
	});

	socket.on('webrtc:ice-candidate', ({ toSocketId, candidate, roomId = 'default' }) => {
		io.to(toSocketId).emit('webrtc:ice-candidate', { fromSocketId: socket.id, candidate, roomId });
	});

	// Presence join/leave notifications
	socket.on('room:join', (roomId = 'default') => {
		socket.join(roomId);
		const entry = clients.get(socket.id);
		if (entry) {
			entry.roomId = roomId;
			clients.set(socket.id, entry);
		}
		io.to(roomId).emit('presence:update', getPresence().filter(c => c.roomId === roomId));
	});

	// Private chat relay
	socket.on('chat:private', ({ toSocketId, message }) => {
		io.to(toSocketId).emit('chat:private', { fromSocketId: socket.id, message, ts: Date.now() });
	});

	socket.on('disconnect', () => {
		const entry = clients.get(socket.id);
		clients.delete(socket.id);
		if (entry) {
			io.to(entry.roomId).emit('presence:update', getPresence().filter(c => c.roomId === entry.roomId));
		}
	});
});

// Start the main server (HTTPS if available, otherwise HTTP)
server.listen(PORT, () => {
	const protocol = server instanceof https.Server ? 'HTTPS' : 'HTTP';
	console.log(`Signaling server listening on ${protocol} :${PORT}`);
});

// Also start HTTP server on different port if we have HTTPS
if (httpsServer) {
	httpServer.listen(3443, () => {
		console.log(`Signaling server also listening on HTTP :3443`);
	});
}


