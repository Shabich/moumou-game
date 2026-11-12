// Cycle de la partie : niveaux, caisses, boucle de simulation et actions des joueurs.
// Seul l'hôte (ou le joueur solo) fait avancer la simulation ; l'invité reçoit l'état résultant.
import { MAP, W, SCHEDULE, GAME_SPEED, DROP_TYPES, MATCH_TIME, MAX_ENEMIES } from '../core/config.js';
import { G, makePlayer, resetBody, resetArsenal, resetScore, playerById, setState, canStart, isVersus, ranking } from '../core/state.js';
import { emit } from '../core/events.js';
import { reach, wallTiles } from '../core/terrain.js';
import { boing, later } from './sfx.js';
import { movePlayer, collisions, setView, respawn } from './players.js';
import { mkEnemy, moveEnemy, reverse, updateEnemyTimers } from './enemies.js';
import { shoot, updateBullets, setWeapon, cycleWeapon } from './combat.js';

function resetGrid() {
  G.gen++;
  G.grid = MAP.map(r => r.split(''));
  G.dots = 0; G.dotsEaten = 0;
  for (const row of G.grid) for (let x=0; x<W; x++) {
    if (row[x]==='.'||row[x]==='o') G.dots++;
    if (row[x]==='P') row[x] = ' ';
  }
  for (const [x,y] of wallTiles) G.grid[y][x] = '#';      // les zones fermées sont de vrais murs
  for (const k of G.destroyed) reach.delete(k);
  G.destroyed = [];
  G.crates = []; G.crateT = 0; G.rocketT = 0;
  spawnCrate('ammo'); spawnCrate('ammo'); spawnCrate(DROP_TYPES[Math.random()*3|0]);
}
function resetActors() {
  for (const p of G.players) { resetBody(p); setView(p, p.view); }
  const k = 1 + 0.25*(G.level-1);
  G.enemies = [
    mkEnemy(0, 0, 10, 7, 'scatter', 0),
    mkEnemy(1, 1,  9, 9, 'house', 1.5/k),
    mkEnemy(2, 2, 10, 9, 'house', 4/k),
    mkEnemy(3, 3, 11, 9, 'house', 7/k),
  ];
  // monstres supplémentaires en affrontement : +2 par joueur en plus, ils sortent de la maison peu à peu
  const total = Math.min(MAX_ENEMIES, 4 + 2*(G.players.length - 1));
  for (let i = 4; i < total; i++) G.enemies.push(mkEnemy(i, i % 4, 9 + i % 3, 9, 'house', (7 + (i-3)*2.5)/k));
  G.enemies[0].dir = {x:-1,y:0};
  G.globalMode = 'scatter'; G.modeIdx = 0; G.modeT = 0;
  G.frightT = 0; G.combo = 0; G.freezeT = 0; G.bonus = null; G.eat = null;
  G.bullets = [];
}
function newGame() {
  G.level = 1; G.paused = false; G.timeLeft = MATCH_TIME; G.results = null;
  for (const p of G.players) { resetArsenal(p); resetScore(p); }
  resetGrid(); resetActors();
  setState('ready'); boing(260); later(150, () => boing(390)); later(300, () => boing(520));
}
export function init(name) {
  if (!playerById('p1')) G.players.push(makePlayer('p1', name));
  resetActors(); resetGrid(); setState('title');
}
export function addPlayer(id) {
  if (playerById(id)) return;
  const p = makePlayer(id);
  if (G.state !== 'title' && G.state !== 'over') { p.dead = true; p.respawnT = 1; }   // arrive en cours de manche
  G.players.push(p);
}
// Fin d'une manche d'affrontement : classement figé et envoyé au leaderboard
function endMatch() {
  G.results = ranking();
  setState('over');
  emit('matchEnd', G.results);
}
export function removePlayer(id) { G.players = G.players.filter(p => p.id !== id); }

function spawnCrate(type) {
  if (type === 'ammo' ? G.crates.filter(c => c.type === 'ammo').length >= 3 : G.crates.filter(c => c.type !== 'ammo').length >= 2) return;
  const free = [];
  for (const k of reach) {
    const [x,y] = k.split(',').map(Number);
    if (y === 9 || MAP[y][x] === 'G' || MAP[y][x] === '-' || (y === 7 && x >= 8 && x <= 12)) continue;
    if (G.players.some(p => Math.abs(x-p.cx) + Math.abs(y-p.cy) < 4)) continue;
    if (G.crates.some(c => c.x === x && c.y === y)) continue;
    free.push([x,y]);
  }
  if (!free.length) return;
  const [x,y] = free[Math.random()*free.length|0];
  G.crates.push({ id:G.nextId++, x, y, type });
}

// Minuteries d'un joueur, en temps réel (non ralenties), y compris le tir automatique
function tickPlayer(p, dt) {
  p.recoil = Math.max(0, p.recoil - dt*6);
  p.flashT = Math.max(0, p.flashT - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.slashT = Math.max(0, p.slashT - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  if (p.dead) { if (G.state === 'play' && !G.paused && (p.respawnT -= dt) <= 0) respawn(p); return; }
  if (p.ctl.fire && G.state === 'play') shoot(p);
  if (G.state === 'play' && !G.paused) p.inv = Math.max(0, p.inv - dt);
  p.spinV = p.weapon === 'minigun' && p.ctl.fire && G.state === 'play' ? Math.min(40, p.spinV + dt*80) : Math.max(0, p.spinV - dt*25);
}

export function step(dt) {
  // à plusieurs, tout le monde a la vue choisie pour la partie
  if (isVersus()) for (const p of G.players) if (p.view !== G.viewMode) setView(p, G.viewMode);
  for (const p of G.players) tickPlayer(p, dt);
  if (G.paused) return;
  G.stateT += dt;
  if (G.state === 'ready') { if (G.stateT > 2) setState('play'); return; }
  if (G.state === 'eaten') { if (G.stateT > 4) { G.results = ranking(); setState('over'); emit('matchEnd', G.results); } return; }
  if (G.state === 'over' && !G.results) { G.results = ranking(); emit('matchEnd', G.results); }   // dernière perle mangée
  if (G.state === 'clear') {
    if (G.stateT > 2.4) { G.level++; resetGrid(); resetActors(); setState('ready'); }
    return;
  }
  if (G.state !== 'play') return;
  if (isVersus() && (G.timeLeft -= dt) <= 0) { G.timeLeft = 0; endMatch(); return; }
  if (G.freezeT > 0) { G.freezeT -= dt; return; }
  dt *= GAME_SPEED;

  if (G.frightT > 0) {
    G.frightT -= dt;
    if (G.frightT <= 0) for (const e of G.enemies) if (e.mode === 'fright') e.mode = G.globalMode;
  } else {
    G.modeT += dt;
    if (G.modeT >= SCHEDULE[G.modeIdx]) {
      G.modeT = 0; G.modeIdx++;
      G.globalMode = G.modeIdx % 2 ? 'chase' : 'scatter';
      for (const e of G.enemies) if (e.mode==='scatter'||e.mode==='chase') { e.mode = G.globalMode; reverse(e); }
    }
  }
  updateEnemyTimers(dt);
  if (G.bonus) { G.bonus.t -= dt; if (G.bonus.t <= 0) G.bonus = null; }
  G.crateT += dt; G.rocketT += dt;
  if (G.crateT > 8) { G.crateT = 0; spawnCrate('ammo'); }
  if (G.rocketT > 12) { G.rocketT = 0; spawnCrate(DROP_TYPES[Math.random()*3|0]); }

  for (const p of G.players) { if (!p.dead) movePlayer(p, dt); if (G.state !== 'play') return; }
  for (const p of G.players) collisions(p);
  if (G.state !== 'play') return;
  for (const e of G.enemies) moveEnemy(e, dt);
  updateBullets(dt);
  for (const p of G.players) collisions(p);
}

// Actions ponctuelles d'un joueur (clavier local, ou message de l'invité)
export function act(p, action, arg) {
  switch (action) {
    case 'start':  if (canStart()) newGame(); break;
    case 'fire':   if (canStart()) newGame(); else shoot(p); break;
    case 'enter':  if (canStart()) newGame(); else G.paused = !G.paused; break;
    case 'pause':  if (!canStart()) G.paused = !G.paused; break;
    case 'cycle':  cycleWeapon(p); break;
    case 'weapon': setWeapon(p, arg); break;
    case 'view':
      // la vue se choisit avant la partie (pour tous) ; en solo on peut aussi en changer en jeu
      if ((arg !== 'fp' && arg !== 'top') || (!canStart() && isVersus())) break;
      G.viewMode = arg;
      for (const q of G.players) setView(q, arg);
      break;
    case 'name':   if (typeof arg === 'string') p.name = arg.trim().slice(0, 14) || p.name; break;
    case 'want':
      if (canStart()) newGame();
      if (p.view !== 'fp' && arg) p.want = { x:Math.sign(arg.x), y:Math.sign(arg.y) };
      break;
  }
}
