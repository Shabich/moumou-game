// Service des fichiers statiques du dossier public/ (sans cache, pour le développement).
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

export function serveStatic(root) {
  root = path.resolve(root);
  return (req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }   // pas de sortie de public/
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' }).end('Introuvable'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control':'no-store' });
      res.end(data);
    });
  };
}
