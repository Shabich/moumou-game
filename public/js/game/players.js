// Déplacement des joueurs, ramassage (perles, cœurs, caisses) et contacts avec les monstres.
import { W, H, DIRS, PLAYER_R, MAX_HEARTS, CRATE_AMMO, INVULN, WEAPONS, PLAYERS, RESPAWN_TIME, PVP_INVULN, KILL_POINTS } from '../core/config.js';
import { G, cell, passable, pos, playerPos, faceAngle, wrapX, wrapDist2, setState, isVersus, resetBody, resetArsenal, idleCtl } from '../core/state.js';
import { emit } from '../core/events.js';
import { beep, boing, later, burst, popup, shake } from './sfx.js';
import { kill, reverse, startEaten } from './enemies.js';

export const playerSpeed = () => Math.min(9, 7.4 + G.level*0.2);
export function movePlayer(p, dt) { if (p.view === 'fp') moveFP(p, dt); else moveTop(p, dt); }

// Vue de dessus : avance automatiquement, la direction demandée est mémorisée jusqu'au prochain croisement
function moveTop(p, dt) {
  p.moving = false;
  if (p.want && (p.dir.x||p.dir.y) && p.want.x===-p.dir.x && p.want.y===-p.dir.y && p.t>0) {
    p.cx = wrapX(p.cx+p.dir.x); p.cy += p.dir.y; p.t = 1-p.t; p.dir = p.want;
  }
  let d = playerSpeed()*dt, guard = 0;
  while (d > 0 && guard++ < 5) {
    if (!p.dir.x && !p.dir.y) {
      if (p.want && passable(p.cx+p.want.x, p.cy+p.want.y)) p.dir = p.want; else break;
    }
    if (p.t === 0 && !passable(p.cx+p.dir.x, p.cy+p.dir.y)) { p.dir = {x:0,y:0}; break; }
    p.moving = true;
    const rem = 1 - p.t;
    if (d < rem) { p.t += d; p.walk += d; break; }
    d -= rem; p.walk += rem; p.t = 0;
    p.cx = wrapX(p.cx+p.dir.x); p.cy += p.dir.y;
    arrive(p);
    if (G.state !== 'play') return;
    if (p.want && passable(p.cx+p.want.x, p.cy+p.want.y)) p.dir = p.want;
    else if (!passable(p.cx+p.dir.x, p.cy+p.dir.y)) { p.dir = {x:0,y:0}; break; }
  }
  if (p.dir.x||p.dir.y) p.face = p.dir;
}

// Vue 1re personne : déplacement libre et fluide (glisse le long des murs)
const cardinal = yaw => { const sx = Math.sin(yaw), sy = Math.cos(yaw); return Math.abs(sx) > Math.abs(sy) ? { x:Math.sign(sx), y:0 } : { x:0, y:Math.sign(sy) }; };
const solidForPlayer = (tx, ty) => { const c = cell(tx, ty); return c === '#' || c === '-' || c === 'G'; };
function collideFree(p) {
  for (let it=0; it<2; it++) {
    const bx = Math.round(p.px), by = Math.round(p.py);
    for (let ty=by-1; ty<=by+1; ty++) for (let tx=bx-1; tx<=bx+1; tx++) {
      if (!solidForPlayer(tx, ty)) continue;
      const qx = Math.max(tx-0.5, Math.min(p.px, tx+0.5)), qy = Math.max(ty-0.5, Math.min(p.py, ty+0.5));
      const dx = p.px-qx, dy = p.py-qy, d = Math.hypot(dx, dy);
      if (d < PLAYER_R && d > 1e-5) { p.px += dx/d*(PLAYER_R-d); p.py += dy/d*(PLAYER_R-d); }
    }
  }
}
function moveFP(p, dt) {
  p.moving = false;
  if (p.ctl.fwd) {
    const step = playerSpeed()*dt, n = Math.max(1, Math.ceil(step/0.08));
    const fx = Math.sin(p.yaw), fy = Math.cos(p.yaw), ox = p.px, oy = p.py;
    for (let i=0; i<n; i++) {
      const sx = p.px, sy = p.py;
      p.px += fx*step/n; p.py += fy*step/n;
      collideFree(p);
      if (solidForPlayer(Math.round(p.px), Math.round(p.py))) { p.px = sx; p.py = sy; }
      if (p.px < -0.5) p.px += W; else if (p.px > W-0.5) p.px -= W;
    }
    let mdx = p.px-ox; if (Math.abs(mdx) > W/2) mdx -= Math.sign(mdx)*W;
    const moved = Math.hypot(mdx, p.py-oy);
    if (moved > 1e-4) { p.moving = true; p.walk += moved; }
  }
  const f = cardinal(p.yaw);
  p.face = f; p.dir = p.moving ? f : { x:0, y:0 }; p.t = 0;
  const tx = Math.round(p.px), ty = Math.round(p.py);
  p.cx = wrapX(tx); p.cy = Math.max(0, Math.min(H-1, ty));
  if (Math.hypot(p.px-tx, p.py-ty) < 0.45) arrive(p);
}
function snapToGrid(p) {
  let cx = wrapX(Math.round(p.px)), cy = Math.round(p.py);
  if (!passable(cx, cy)) for (const d of DIRS) if (passable(cx+d.x, cy+d.y)) { cx = wrapX(cx+d.x); cy += d.y; break; }
  p.cx = cx; p.cy = cy; p.t = 0;
  const f = cardinal(p.yaw); p.face = f;
  p.dir = passable(cx+f.x, cy+f.y) ? f : { x:0, y:0 };
}
export function setView(p, v) {
  const prev = p.view;
  p.view = v;
  if (v === 'fp' && prev !== 'fp') {
    const pp = pos(p); p.px = pp.x; p.py = pp.y; p.yaw = faceAngle(p.face); p.spin = 0;
  } else if (v !== 'fp' && prev === 'fp') snapToGrid(p);
  p.want = null;
}

function arrive(p) {
  const c = G.grid[p.cy][p.cx];
  if (c === '.' || c === 'o') {
    G.grid[p.cy][p.cx] = ' '; G.dots--; G.dotsEaten++;
    if (c === '.') { p.score += 10; const alt = G.dotsEaten & 1; beep(alt ? 660 : 780, .06, 'sine', .04, alt ? 880 : 990); }
    else {
      if (p.lives < MAX_HEARTS) { p.lives++; popup(p.cx, p.cy, '+1 ♥'); } else { p.score += 100; popup(p.cx, p.cy, '+100'); }
      burst(p.cx, p.cy, '#d81b2c', 14);
      beep(660, .12, 'sine', .07, 990); later(110, () => beep(990, .18, 'sine', .07, 1320));
    }
    if (G.dotsEaten === 70 || G.dotsEaten === 150) G.bonus = { x:10, y:11, t:9 };
    if (G.dots === 0) { setState(isVersus() ? 'over' : 'clear'); boing(400); later(180, () => boing(600)); later(360, () => boing(800)); }
  }
  const b = G.bonus;
  if (b && p.cx === b.x && p.cy === b.y) {
    const pts = 100*G.level + 200;
    p.score += pts; popup(b.x, b.y, '+'+pts); burst(b.x, b.y, '#e8a317', 16); G.bonus = null;
    beep(700,.3,'sine',.07,1600);
  }
  const ci = G.crates.findIndex(cr => cr.x === p.cx && cr.y === p.cy);
  if (ci >= 0) {
    const cr = G.crates[ci];
    if (cr.type === 'ammo') {
      const gain = Math.min(CRATE_AMMO, WEAPONS.rifle.max - p.ammo.rifle); p.ammo.rifle += gain; popup(p.cx, p.cy, '+' + gain + ' balles');
    } else {
      const w = WEAPONS[cr.type], gain = Math.min(w.drop, w.max - p.ammo[cr.type]);
      p.owned[cr.type] = true; p.ammo[cr.type] += gain; p.weapon = cr.type;
      popup(p.cx, p.cy, w.name + ' +' + gain);
      beep(440, .1, 'square', .05); later(90, () => beep(660, .1, 'square', .05)); later(180, () => beep(880, .15, 'square', .05));
    }
    G.crates.splice(ci, 1);
    beep(520, .08, 'square', .04); later(70, () => beep(780, .1, 'square', .04));
  }
}

// Contact avec un monstre
export function collisions(p) {
  if (G.state !== 'play' || p.dead) return;
  const pp = playerPos(p);
  for (const e of G.enemies) {
    if (e.mode === 'house' || e.mode === 'dead') continue;
    if (wrapDist2(pos(e), pp) > 0.45) continue;
    if (e.mode === 'fright') { kill(e, 'fright', p); continue; }
    if (p.inv > 0) continue;
    if (!isVersus() && p.lives <= 1) { p.lives = 0; startEaten(e, p); return; }   // solo : fin de partie
    reverse(e);
    damage(p, null);
    return;
  }
}

// Un joueur perd un cœur (attacker = joueur responsable, ou null pour un monstre)
export function damage(p, attacker) {
  if (p.dead || p.inv > 0 || G.state !== 'play') return false;
  const pp = playerPos(p);
  p.lives--; p.hurtT = 0.7;
  burst(pp.x, pp.y, '#d81b2c', 16);
  beep(240, 0.35, 'square', 0.07, 110);
  if (p.lives > 0) {
    p.inv = attacker ? PVP_INVULN : INVULN; shake(0.3);
    popup(pp.x, pp.y, '-1 ♥');
    return true;
  }
  // éliminé : il réapparaîtra ailleurs après RESPAWN_TIME
  Object.assign(p, { dead:true, respawnT:RESPAWN_TIME, killedBy: attacker ? attacker.name : 'un monstre', ctl:idleCtl() });
  p.deaths++;
  burst(pp.x, pp.y, PLAYERS[p.id].color, 30, 0.6); shake(0.4);
  beep(160, 0.6, 'sawtooth', 0.08, 50);
  if (attacker) {
    attacker.kills++; attacker.score += KILL_POINTS;
    const ap = playerPos(attacker); popup(ap.x, ap.y, '+' + KILL_POINTS);
  }
  emit('feed', attacker ? `${attacker.name} a éliminé ${p.name}` : `${p.name} s'est fait dévorer`);
  return true;
}

// Réapparition sur le point de départ le plus éloigné des monstres et des autres joueurs
export function respawn(p) {
  const threats = [...G.enemies.filter(e => e.mode !== 'dead' && e.mode !== 'house').map(pos), ...G.players.filter(q => q !== p && !q.dead).map(playerPos)];
  const score = s => Math.min(99, ...threats.map(t => wrapDist2(t, { x:s[0], y:s[1] })));
  const spawn = Object.values(PLAYERS).map(c => c.spawn).sort((a, b) => score(b) - score(a))[0];
  const view = p.view;
  resetBody(p, spawn); resetArsenal(p);
  p.view = 'top'; setView(p, view);
  Object.assign(p, { dead:false, lives:MAX_HEARTS, inv:INVULN, killedBy:null });
  burst(spawn[0], spawn[1], PLAYERS[p.id].color, 14, 0.6);
  beep(520, .15, 'sine', .06, 1040);
}
