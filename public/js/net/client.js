// Multijoueur en réseau local, modèle « hôte autoritaire » :
//  - le 1er navigateur connecté est l'hôte (p1) : il simule toute la partie et envoie l'état G à chaque image ;
//  - les suivants (p2...p6) sont des invités : ils envoient leurs commandes et affichent l'état reçu.
// Sans serveur joignable, le jeu tourne simplement en solo.
import { G, makePlayer, playerById, isVersus } from '../core/state.js';
import { on } from '../core/events.js';
import * as game from '../game/game.js';

export const net = { role:'solo', id:'p1', peers:0, ips:[], status:'', board:[] };
let ws = null, outbox = [], onRemoteEvent = () => {}, myName = '';
const placeholders = {};                               // joueur local d'un invité avant le 1er état reçu

export const local = () => playerById(net.id) || (placeholders[net.id] ||= makePlayer(net.id, myName));
export const isGuest = () => net.role === 'guest';
const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

// Action ponctuelle du joueur local : appliquée directement, ou transmise à l'hôte
export function act(action, arg) {
  const p = local();
  if (action === 'name') myName = arg;
  if (!isGuest()) return game.act(p, action, arg);
  if (action === 'name') p.name = arg;
  send({ t:'a', a:action, v:arg });
}

// ---- Côté hôte : commandes reçues d'un invité ----
function fromGuest(id, m) {
  const p = playerById(id);
  if (!p || !m) return;
  if (m.t === 'in') {
    if (!p.dead) p.ctl = m.ctl;
    if (p.view === 'fp') p.yaw = m.yaw;           // la vue elle-même est imposée par la partie (G.viewMode)
  } else if (m.t === 'a') game.act(p, m.a, m.v);
}
function sendSnapshot() {
  send({ t:'s', g:{ ...G, grid: G.grid.map(r => r.join('')) }, ev:outbox });
  outbox = [];
}

// ---- Côté invité : état reçu de l'hôte ----
function applySnapshot(m) {
  const s = m.g, mine = local();
  s.grid = s.grid.map(r => r.split(''));
  for (const p of s.players) {
    if (p.id !== net.id) continue;
    // ce qui est piloté sur ce poste (orientation, touches) n'est pas écrasé
    p.ctl = mine.ctl; p.spin = mine.spin;
    if (mine.view === 'fp' && p.view === 'fp' && !p.dead) p.yaw = mine.yaw;
  }
  Object.assign(G, s);
  for (const [type, args] of m.ev) onRemoteEvent(type, args);
}

// Appelé à chaque image par la boucle principale
export function netTick() {
  if (net.role === 'host' && net.peers > 0) sendSnapshot();
  else if (isGuest()) { const p = local(); send({ t:'in', ctl:p.ctl, yaw:p.yaw }); }
}

function onMessage(m) {
  switch (m.t) {
    case 'role':
      net.role = m.role; net.id = m.id; net.ips = m.ips || []; net.status = '';
      if (m.role === 'guest') send({ t:'a', a:'name', v:myName });
      break;
    case 'join': net.peers++; game.addPlayer(m.id); break;
    case 'leave': net.peers = Math.max(0, net.peers - 1); game.removePlayer(m.id); break;
    case 'from': if (net.role === 'host') fromGuest(m.id, m.m); break;
    case 's': if (isGuest()) applySnapshot(m); break;
    case 'board': net.board = m.top; break;
    case 'hostgone': net.status = 'L\'hôte a quitté la partie…'; setTimeout(() => location.reload(), 1200); break;
    case 'full': net.status = 'Partie pleine : 6 joueurs maximum'; break;
  }
}

function connect() {
  if (!location.host) return;                         // ouvert en file:// : solo
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  ws.onclose = () => {
    if (isGuest()) { net.status ||= 'Connexion à l\'hôte perdue…'; setTimeout(() => location.reload(), 1500); return; }
    if (net.status.startsWith('Partie pleine')) return;
    net.role = 'solo'; net.peers = 0;
    for (const p of [...G.players]) if (p.id !== 'p1') game.removePlayer(p.id);
    setTimeout(connect, 2000);
  };
}
async function loadBoard() {
  try { const r = await fetch('/api/leaderboard', { cache:'no-store' }); if (r.ok) net.board = await r.json(); } catch {}
}

export function startNet({ name, onEvent }) {
  myName = name; onRemoteEvent = onEvent;
  on((type, args) => {
    if (net.role !== 'host') return;
    if (net.peers > 0) outbox.push([type, args]);
    // fin de manche : l'hôte transmet le classement au serveur (un seul envoi par manche)
    if (type === 'matchEnd') send({ t:'result', entries:args[0], mode: isVersus() ? 'versus' : 'solo' });
  });
  loadBoard();
  connect();
}
