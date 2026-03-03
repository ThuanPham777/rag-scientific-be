#!/usr/bin/env node
/**
 * Yjs WebSocket Server for real-time notebook collaboration.
 *
 * This is a standalone server that runs alongside the NestJS backend.
 * It uses the y-websocket package to handle Yjs CRDT document sync.
 *
 * Usage: node yjs-server.cjs
 * Port: 1234 (default) or YJS_PORT env var
 */

const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = process.env.YJS_PORT || 1234;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Yjs WebSocket Server running');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
    // The room name (notebook ID) is extracted from the URL path
    // e.g., ws://localhost:1234/notebook-uuid-here
    setupWSConnection(conn, req);
    console.log(`[Yjs] New connection. Total: ${wss.clients.size}`);
});

server.listen(PORT, () => {
    console.log(`🔄 Yjs WebSocket server running on ws://localhost:${PORT}`);
});
