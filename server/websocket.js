// WebSocket minimal (RFC 6455), sans dépendance : poignée de main, lecture des trames, envoi de texte.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(str) {
  const p = Buffer.from(str), n = p.length;
  let h;
  if (n < 126) h = Buffer.from([0x81, n]);
  else if (n < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, p]);
}

// Connexion : émet 'message' (texte) et 'close'
export class Socket extends EventEmitter {
  constructor(sock) {
    super();
    this.sock = sock; this.buf = Buffer.alloc(0); this.parts = []; this.closed = false;
    sock.setNoDelay(true);
    sock.on('data', d => this.#read(d));
    sock.on('close', () => this.#end());
    sock.on('error', () => this.#end());
  }
  send(msg) {
    if (this.closed || this.sock.destroyed) return;
    this.sock.write(frame(typeof msg === 'string' ? msg : JSON.stringify(msg)));
  }
  close() { if (!this.closed) { this.sock.end(Buffer.from([0x88, 0])); this.#end(); } }
  #end() { if (this.closed) return; this.closed = true; this.emit('close'); }
  #read(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      const mk = off; if (masked) off += 4;
      if (b.length < off + len) return;
      const p = Buffer.from(b.subarray(off, off + len));
      if (masked) for (let i = 0; i < len; i++) p[i] ^= b[mk + (i & 3)];
      this.buf = b.subarray(off + len);
      if (op === 0x8) { this.close(); return; }                                    // fermeture
      if (op === 0x9) { this.sock.write(Buffer.concat([Buffer.from([0x8a, p.length]), p])); continue; } // ping → pong
      if (op === 0xa) continue;                                                     // pong
      this.parts.push(p);
      if (fin) { const msg = Buffer.concat(this.parts).toString(); this.parts = []; this.emit('message', msg); }
    }
  }
}

// À brancher sur l'événement 'upgrade' du serveur HTTP
export function accept(req, sock) {
  const key = req.headers['sec-websocket-key'];
  if (!key || req.headers.upgrade?.toLowerCase() !== 'websocket') { sock.destroy(); return null; }
  const acc = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  return new Socket(sock);
}
