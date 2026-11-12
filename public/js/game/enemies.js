// Monstres : sortie de la maison, poursuite (du joueur le plus proche), mort et réapparition.
import { W, DIRS, CORNERS, ENEMY_COLORS, FRIGHT_COLOR } from '../core/config.js';
import { G, passable, pos, wrapX, setState, idleCtl } from '../core/state.js';
import { beep, later, burst, popup } from './sfx.js';

export const mkEnemy = (slot, kind, cx, cy, mode, release) =>
  ({ slot, kind, cx, cy, dir:{x:0,y:0}, t:0, mode, release, door:false, respawn:0 });

export function reverse(e) {
  if (!e.dir.x && !e.dir.y) return;
  if (e.t > 0) { e.cx = wrapX(e.cx+e.dir.x); e.cy += e.dir.y; e.t = 1-e.t; }
  e.dir = { x:-e.dir.x, y:-e.dir.y };
}
// Les monstres chassent le joueur vivant le plus proche, quel qu'il soit
function nearestPlayer(e) {
  const d = q => { let dx = Math.abs(q.cx - e.cx); dx = Math.min(dx, W - dx); return dx*dx + (q.cy - e.cy)**2; };
  const alive = G.players.filter(p => !p.dead);
  return (alive.length ? alive : G.players).reduce((a, b) => d(b) < d(a) ? b : a);
}
function getTarget(e) {
  if (e.mode === 'leave') return {x:10,y:7};
  if (e.mode === 'scatter') return CORNERS[e.kind];
  const p = nearestPlayer(e), pd = p.dir;
  if (e.kind === 0) return {x:p.cx, y:p.cy};
  if (e.kind === 1) return {x:p.cx+pd.x*4, y:p.cy+pd.y*4};
  if (e.kind === 2) {
    const a = {x:p.cx+pd.x*2, y:p.cy+pd.y*2};
    const r = G.enemies.find(o => o.kind === 0 && o.mode !== 'dead' && o.mode !== 'house') || e;
    return {x:2*a.x-r.cx, y:2*a.y-r.cy};
  }
  const dx = e.cx-p.cx, dy = e.cy-p.cy;
  return dx*dx+dy*dy > 64 ? {x:p.cx,y:p.cy} : CORNERS[3];
}
function chooseDir(e) {
  const opts = [];
  for (const d of DIRS) {
    if (d.x===-e.dir.x && d.y===-e.dir.y && (e.dir.x||e.dir.y)) continue;
    if (passable(e.cx+d.x, e.cy+d.y, e)) opts.push(d);
  }
  if (!opts.length) return { x:-e.dir.x, y:-e.dir.y };
  if (e.mode === 'fright') return opts[Math.random()*opts.length|0];
  const tg = getTarget(e);
  let best = opts[0], bd = Infinity;
  for (const d of opts) {
    const nx = e.cx+d.x, ny = e.cy+d.y, dd = (nx-tg.x)**2 + (ny-tg.y)**2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
export function enemySpeed(e) {
  if (e.mode === 'fright') return 4.2;
  if (e.mode === 'leave') return 4.5;
  let s = Math.min(8.6, 6.3 + G.level*0.35);
  if (e.cy === 9 && (e.cx <= 4 || e.cx >= 16)) s *= 0.55;
  return s;
}
export function moveEnemy(e, dt) {
  if (e.mode === 'house' || e.mode === 'dead') return;
  let d = enemySpeed(e)*dt, guard = 0;
  while (d > 0 && guard++ < 6) {
    if (!e.dir.x && !e.dir.y) { e.dir = chooseDir(e); if (!e.dir.x && !e.dir.y) break; }
    const rem = 1 - e.t;
    if (d < rem) { e.t += d; break; }
    d -= rem; e.t = 0;
    e.cx = wrapX(e.cx+e.dir.x); e.cy += e.dir.y;
    if (e.mode === 'leave' && e.cx === 10 && e.cy === 7) { e.mode = G.globalMode; e.door = false; }
    e.dir = chooseDir(e);
  }
}
export function updateEnemyTimers(dt) {
  for (const e of G.enemies) {
    if (e.mode === 'house') {
      e.release -= dt;
      if (e.release <= 0) { e.mode = 'leave'; e.door = true; e.dir = {x:0,y:0}; e.t = 0; }
    } else if (e.mode === 'dead') {
      e.respawn -= dt;
      if (e.respawn <= 0) respawn(e);
    }
  }
}
export function kill(e, how, by) {             // by : joueur qui marque les points
  const ep = pos(e);
  let pts;
  if (how === 'fright') { pts = 200 * 2**G.combo; G.combo++; G.freezeT = 0.35; }
  else pts = 150;
  if (by) by.score += pts;
  popup(ep.x, ep.y, '+'+pts);
  burst(ep.x, ep.y, e.mode === 'fright' ? FRIGHT_COLOR : ENEMY_COLORS[e.kind], 24);
  e.mode = 'dead'; e.respawn = 3; e.door = false;
  beep(320, .3, 'sine', .08, 90); later(90, () => beep(200, .2, 'triangle', .06, 60));
}
function respawn(e) {
  // un nouveau monstre (souvent d'une autre espèce) sort de la maison
  let kind; do { kind = Math.random()*4|0; } while (kind === e.kind && Math.random() < 0.8);
  Object.assign(e, { kind, cx:10, cy:9, t:0, dir:{x:0,y:0}, mode:'house', release:0.6, door:false });
  burst(10, 9, ENEMY_COLORS[kind], 10, 0.6);
}
export function startEaten(e, p) {
  G.eat = { slot:e.slot, from:pos(e), who:p.id };
  setState('eaten');
  for (const q of G.players) q.ctl = idleCtl();
  beep(180, 0.5, 'sawtooth', 0.07, 60);
}
