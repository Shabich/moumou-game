// Serveur de Moumou : fichiers du jeu + relais WebSocket (/ws) + leaderboard (/api/leaderboard)
// + rechargement auto (/__livereload).
// Lancer : npm start   (ou PORT=8080 npm start)
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accept } from './websocket.js';
import { Room } from './room.js';
import { Leaderboard } from './leaderboard.js';
import { serveStatic } from './static.js';

const PORT = +process.env.PORT || 5500;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', 'public');
const ips = Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
const log = msg => console.log(new Date().toLocaleTimeString('fr-FR'), msg);

// Rechargement auto : chaque page ouverte en localhost écoute ce flux et se recharge quand public/ change
const watchers = new Set();
let debounce = null;
fs.watch(PUBLIC, { recursive:true }, (event, file) => {
  // fichiers cachés / temporaires d'éditeur ou du Finder (.DS_Store...) : pas de rechargement
  if (!file || path.basename(file).startsWith('.') || /~$|\.swp$|\.tmp$/.test(file)) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    if (watchers.size) log(`fichier modifié : ${file} → rechargement proposé à ${watchers.size} page(s) localhost`);
    for (const res of watchers) res.write('data: reload\n\n');
  }, 120);
});
function livereload(req, res) {
  res.writeHead(200, { 'content-type':'text/event-stream', 'cache-control':'no-store', connection:'keep-alive' });
  res.write(': ok\n\n');
  watchers.add(res);
  req.on('close', () => watchers.delete(res));
}

const files = serveStatic(PUBLIC);
const board = new Leaderboard(path.join(HERE, 'data', 'leaderboard.json'));
const room = new Room({ ips, log, onResult: m => {
  if (board.add(m.entries, m.mode)) { log(`leaderboard : manche ${m.mode} enregistrée`); room.broadcast({ t:'board', top:board.top() }); }
} });
function api(req, res) {
  res.writeHead(200, { 'content-type':'application/json', 'cache-control':'no-store' });
  res.end(JSON.stringify(board.top()));
}
const server = http.createServer((req, res) =>
  req.url === '/__livereload' ? livereload(req, res) : req.url === '/api/leaderboard' ? api(req, res) : files(req, res));
server.on('upgrade', (req, sock) => {
  if (!req.url.startsWith('/ws')) { sock.destroy(); return; }
  const c = accept(req, sock);
  if (c) room.join(c, req.socket.remoteAddress);
});
server.listen(PORT, '0.0.0.0', () => {
  log(`Moumou sur http://localhost:${PORT}`);
  for (const ip of ips) log(`  sur le réseau : http://${ip}:${PORT}`);
});
