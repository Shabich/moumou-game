// Interface : bandeau du haut, classement en direct, fil des éliminations, messages au centre,
// résultats de manche et leaderboard de tous les temps.
import { MAX_HEARTS, WEAPONS, PLAYERS } from '../core/config.js';
import { isVersus, ranking, canStart } from '../core/state.js';
import { net } from '../net/client.js';

const $ = id => document.getElementById(id);
const overlay = $('overlay'), boardEl = $('board'), feedEl = $('feed');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
let lastOverlay = '', lastBoard = '', lastView = null, lastState = null;
let hi = 0; try { hi = +(localStorage.getItem('moumou-hi') || localStorage.getItem('luciole-hi')) || 0; } catch(e) {}

// Fil des éliminations (événement 'feed' émis par la simulation)
export function handleHudEvent(type, args) {
  if (type !== 'feed') return;
  const el = document.createElement('div'); el.className = 'feed-item'; el.textContent = args[0];
  feedEl.prepend(el);
  setTimeout(() => el.remove(), 4000);
  while (feedEl.children.length > 4) feedEl.lastChild.remove();
}

function netLine() {
  if (net.role === 'guest') return `Connecté en tant que ${net.id.toUpperCase()}`;
  if (net.role === 'host') {
    const ip = net.ips[0], url = ip ? `<b>http://${ip}:${location.port || 80}</b>` : '';
    return net.peers ? `${net.peers + 1} joueurs connectés` + (url ? ` · d'autres peuvent rejoindre : ${url}` : '')
                     : url ? `Pour s'affronter, tes amis ouvrent ${url}` : 'En attente d\'adversaires';
  }
  return '';
}
const fmtTime = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2, '0')}`;
const dot = id => `<i class="dot" style="background:${PLAYERS[id]?.color || '#999'}"></i>`;

function rankTable(rows, meId, title) {
  return `<table class="rank"><caption>${title}</caption><tr><th></th><th>Joueur</th><th>Score</th><th>Élim.</th><th>Morts</th></tr>` +
    rows.map((r, i) => `<tr class="${r.id === meId ? 'me' : ''}"><td>${i + 1}</td><td>${dot(r.id)}${esc(r.name)}</td><td>${r.score}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`).join('') + '</table>';
}
function allTimeTable() {
  if (!net.board.length) return '';
  return `<table class="rank alltime"><caption>Tableau d'honneur</caption><tr><th></th><th>Joueur</th><th>Score</th><th>Élim.</th><th>Mode</th></tr>` +
    net.board.slice(0, 8).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.score}</td><td>${r.kills}</td><td>${r.mode === 'versus' ? 'duel' : 'solo'}</td></tr>`).join('') + '</table>';
}

export function hud(G, me) {
  if (me.score > hi) hi = me.score;
  if (G.state === 'over' && lastState !== 'over') { try { localStorage.setItem('moumou-hi', hi); } catch(e) {} }
  lastState = G.state;
  const versus = isVersus();
  $('score').textContent = me.score; $('hi').textContent = hi;
  $('level').textContent = versus ? fmtTime(G.timeLeft) : G.level;
  $('levelLbl').textContent = versus ? 'TEMPS' : 'NIVEAU';
  $('lives').textContent = '♥'.repeat(Math.max(0, me.lives)) + '♡'.repeat(Math.max(0, MAX_HEARTS - me.lives));
  const melee = WEAPONS[me.weapon].melee, n = melee ? Infinity : me.ammo[me.weapon];
  $('wname').textContent = WEAPONS[me.weapon].name.toUpperCase();
  $('ammo').textContent = melee ? '∞' : n; $('ammo').classList.toggle('empty', n === 0);
  $('net').textContent = net.role === 'guest' || net.peers ? `${G.players.length} · ${net.id.toUpperCase()}` : net.role === 'host' ? 'attente' : 'solo';

  $('viewBtn').hidden = versus && !canStart();  // à plusieurs : vue choisie avant la manche, puis figée
  if (me.view !== lastView) {
    lastView = me.view;
    $('minimap').style.display = me.view === 'fp' ? 'block' : 'none';
    $('cross').style.display = me.view === 'fp' ? 'block' : 'none';
    $('viewBtn').textContent = me.view === 'fp' ? 'Vue de dessus' : 'Vue 1re personne';
  }
  const eaten = G.state === 'eaten' ? Math.min(0.85, Math.max(0, (G.stateT-2.6)/1.2)) : 0;
  $('hurt').style.opacity = Math.max(me.hurtT/0.7, eaten, me.dead ? 0.6 : 0);

  // Classement en direct pendant une manche d'affrontement
  const live = versus && (G.state === 'play' || G.state === 'ready');
  const bhtml = live ? rankTable(ranking(), me.id, 'Classement') : '';
  if (bhtml !== lastBoard) { boardEl.innerHTML = bhtml; boardEl.style.display = bhtml ? 'block' : 'none'; lastBoard = bhtml; }

  const nl = netLine(), sub = nl ? `<div class="small net">${nl}</div>` : '';
  let html = '';
  const viewLine = `<div class="small">Vue de la partie : <b>${G.viewMode === 'fp' ? '1re personne' : 'du ciel'}</b>${versus ? ' (pour tous)' : ''} · V pour changer</div>`;
  if (G.state === 'title') html = `<div class="big">MOUMOU</div><div class="small">Espace pour partir au combat${versus ? ' · tous contre tous' : ''}</div>${viewLine}${sub}${allTimeTable()}`;
  else if (G.state === 'ready') html = `<div class="big">${versus ? 'Au combat !' : 'Mission ' + G.level}</div><div class="small">En position…</div>`;
  else if (G.state === 'over') {
    const res = G.results || ranking(), win = res[0];
    const head = versus ? `<div class="big">${win?.id === me.id ? 'Victoire !' : esc(win?.name ?? '') + ' gagne'}</div>`
                        : `<div class="big">Tombé au combat</div><div class="small">Score ${me.score}</div>`;
    html = `${head}${versus ? rankTable(res, me.id, 'Rapport de mission') : ''}<div class="small">Espace pour rejouer</div>${viewLine}${allTimeTable()}`;
  }
  else if (G.state === 'clear') html = '<div class="big">Secteur nettoyé !</div>';
  else if (me.dead) html = `<div class="big">Éliminé</div><div class="small">par ${esc(me.killedBy || '?')} · retour dans ${Math.ceil(me.respawnT)} s</div>`;
  else if (G.paused) html = '<div class="big">Cessez-le-feu</div><div class="small">P pour reprendre</div>';
  if (net.status) html += `<div class="small net">${net.status}</div>`;
  if (html !== lastOverlay) { overlay.innerHTML = html; lastOverlay = html; }
}
