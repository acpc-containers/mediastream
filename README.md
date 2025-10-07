# LAN-only WebRTC Presentation System

A containerized, LAN-only WebRTC system where one Host shares a screen to 50–500 Clients on the same subnet. All signaling is local (no Internet, no TURN).

- Signaling Server: Node.js + Express + Socket.IO
- Host App: HTTPS site, captures screen via `getDisplayMedia()`
- Client App: HTTPS site, fullscreen canvas viewer, auto-connect and reconnect

## Quick Start

```bash
# In repo root
docker-compose up --build -d
```

Open in LAN browsers (accept self-signed certs on first visit):
- Host App: https://<server-ip>:4000
- Client App: https://<server-ip>:5001
- Signaling (WSS): wss://<server-ip>:3000
- Presence API (HTTPS): https://<server-ip>:3443/presence

Tip: Replace <server-ip> with your machine’s LAN IP (e.g., 192.168.1.23).

## Why HTTPS/WSS?

- Browsers require a secure context for screen capture (getDisplayMedia).
- WebSocket signaling uses WSS to avoid mixed-content blocks between HTTPS pages and signaling.

Self-signed certificates are included for local use. The first time you visit each service, your browser will warn; proceed/allow to trust them.

## Architecture

- signaling-server/: Express + Socket.IO
  - REST: GET /presence, GET /hostname
  - Events: identify, presence:update, heartbeat:ping/pong, heartbeat:latency
  - WebRTC relay: webrtc:offer/answer/ice-candidate
  - Chat relay: chat:private
  - Listens on HTTPS :3000 (WSS) and HTTP :3443 (secondary)
- host-app/: HTTPS static site for broadcasting (screen share, presence, private chat)
- client-app/: HTTPS static site for fullscreen viewing, canvas overlay, auto-connect, a settings.js contains t variable SIGNALING_DEFAULT with value of the signaling server host

All services run on Docker bridge `webrtc_lan_net`. Internal DNS name for signaling is `signaling`.

## Repo Layout
