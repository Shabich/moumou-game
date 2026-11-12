// Armes : tir, katana, projectiles, explosions et murs destructibles.
import { W, H, WEAPONS, WEAPON_ORDER, SLASH_RANGE, SLASH_TIME } from '../core/config.js';
import { G, cell, pos, playerPos, aimAngle, wrapX, wrapDist2, playerById } from '../core/state.js';
import { reach } from '../core/terrain.js';
import { beep, noise, sound, smoke, burst, explosion, slashFx, shake } from './sfx.js';
import { kill } from './enemies.js';
import { damage } from './players.js';

// Les autres joueurs vivants (cibles possibles d'un joueur)
const rivals = p => G.players.filter(q => q !== p && !q.dead);

export function setWeapon(p, w) {
  if (!p.owned[w] || w === p.weapon) return;
  p.weapon = w; beep(w === 'bazooka' ? 300 : 500, 0.06, 'square', 0.04);
}
export function cycleWeapon(p) {
  const owned = WEAPON_ORDER.filter(w => p.owned[w]);
  setWeapon(p, owned[(owned.indexOf(p.weapon) + 1) % owned.length]);
}
const hasAmmo = (p, w) => WEAPONS[w].melee || p.ammo[w] > 0;

export function shoot(p) {
  if (G.state !== 'play' || G.paused || p.fireCd > 0 || p.dead) return;
  const Wp = WEAPONS[p.weapon];
  if (!hasAmmo(p, p.weapon)) {
    const alt = WEAPON_ORDER.find(w => p.owned[w] && hasAmmo(p, w));
    if (alt) setWeapon(p, alt); else beep(900, 0.05, 'square', 0.03);
    p.fireCd = 0.25; return;
  }
  if (!Wp.melee) p.ammo[p.weapon]--;
  p.fireCd = Wp.cd; p.recoil = Wp.recoil; p.flashT = Wp.flash;
  if (Wp.melee) { slash(p); return; }
  const pp = playerPos(p);
  let ang = aimAngle(p);
  if (Wp.spread) ang += (Math.random()-0.5)*Wp.spread*2;
  const dx = Math.sin(ang), dy = Math.cos(ang);
  let ox = 0, oy = 0;
  if (p.weapon === 'glock') { p.glockSide = -p.glockSide; ox = Math.cos(ang)*0.12*p.glockSide; oy = -Math.sin(ang)*0.12*p.glockSide; }
  const rocket = !!Wp.rocket;
  if (rocket) smoke(pp.x - dx*0.3, pp.y - dy*0.3, 0.6, 0.15, 0.8);
  G.bullets.push({ id:G.nextId++, owner:p.id, ang, x:pp.x + ox + dx*0.35, y:pp.y + oy + dy*0.35, dx, dy, speed:Wp.speed, range:24, alive:true, rocket, trail:0 });
  if (rocket) sound('whoosh');
  else if (p.weapon === 'minigun') noise(3200, 700, 0.07, 0.14);
  else if (p.weapon === 'glock') { noise(3500, 600, 0.1, 0.18); beep(260, 0.06, 'square', 0.04, 90); }
  else sound('bang');
}

function slash(p) {
  p.slashT = SLASH_TIME;
  const pp = playerPos(p), a = aimAngle(p), fx = Math.sin(a), fy = Math.cos(a);
  let hits = 0;
  for (const e of G.enemies) {
    if (e.mode === 'dead' || e.mode === 'house') continue;
    const ep = pos(e);
    let dx = ep.x - pp.x; if (Math.abs(dx) > W/2) dx -= Math.sign(dx)*W;
    const dy = ep.y - pp.y, d = Math.hypot(dx, dy);
    if (d > SLASH_RANGE) continue;
    if (d > 0.5 && (dx*fx + dy*fy)/d < 0.3) continue;      // seulement devant soi
    kill(e, e.mode === 'fright' ? 'fright' : 'shot', p); hits++;
    burst(ep.x, ep.y, '#ffffff', 8, 0.6);
  }
  for (const q of rivals(p)) {
    const qp = playerPos(q);
    let dx = qp.x - pp.x; if (Math.abs(dx) > W/2) dx -= Math.sign(dx)*W;
    const dy = qp.y - pp.y, d = Math.hypot(dx, dy);
    if (d > SLASH_RANGE || (d > 0.5 && (dx*fx + dy*fy)/d < 0.3)) continue;
    if (damage(q, p)) hits++;
  }
  slashFx(pp.x, pp.y, a);
  noise(5200, 1200, 0.18, 0.22, 'bandpass');
  if (hits) { beep(1800, .2, 'triangle', .06, 2800); shake(0.12); }
}

function destructible(tx, ty) {
  if (tx <= 0 || tx >= W-1 || ty <= 0 || ty >= H-1) return false;   // bordure extérieure
  if (ty >= 8 && ty <= 10 && tx >= 8 && tx <= 12) return false;      // maison des monstres
  return G.grid[ty][tx] === '#';
}
function destroyWall(tx, ty) {                    // le rendu voit la case vidée et montre les gravats
  if (!destructible(tx, ty)) return;
  G.grid[ty][tx] = ' ';
  const key = tx+','+ty;
  if (!reach.has(key)) { reach.add(key); G.destroyed.push(key); }
}
function explode(x, y, wallTile, owner) {
  if (wallTile) destroyWall(wallTile[0], wallTile[1]);
  for (const e of G.enemies) {
    if (e.mode === 'dead' || e.mode === 'house') continue;
    if (wrapDist2(pos(e), { x, y }) < 1.6*1.6) kill(e, e.mode === 'fright' ? 'fright' : 'shot', owner);
  }
  for (const q of rivals(owner)) if (wrapDist2(playerPos(q), { x, y }) < 1.4*1.4) damage(q, owner);
  explosion(x, y);
}
export function updateBullets(dt) {
  for (const b of G.bullets) {
    const owner = playerById(b.owner);        // peut être absent si le tireur a quitté la partie
    let dist = b.speed*dt;
    while (dist > 0 && b.alive) {
      const st = Math.min(0.1, dist); dist -= st; b.range -= st;
      b.x += b.dx*st; b.y += b.dy*st;
      if (b.x < -0.5) b.x += W; if (b.x > W-0.5) b.x -= W;
      if (b.rocket && (b.trail += st) > 0.22) { b.trail = 0; smoke(b.x - b.dx*0.25, b.y - b.dy*0.25, 0.55, 0.07, 0.9); }
      const tx = Math.round(b.x), ty = Math.round(b.y), c = cell(tx, ty);
      if (c === '#' || c === '-' || c === 'G' || b.range <= 0) {
        b.alive = false;
        if (b.rocket) explode(b.x - b.dx*0.35, b.y - b.dy*0.35, c === '#' ? [wrapX(tx), ty] : null, owner);
        else burst(b.x - b.dx*0.1, b.y - b.dy*0.1, '#d8c9a0', 5, 0.55);
        break;
      }
      for (const e of G.enemies) {
        if (e.mode === 'dead' || e.mode === 'house') continue;
        if (wrapDist2(pos(e), b) < (b.rocket ? 0.3 : 0.22)) {
          b.alive = false;
          if (b.rocket) explode(b.x, b.y, null, owner); else kill(e, e.mode === 'fright' ? 'fright' : 'shot', owner);
          break;
        }
      }
      if (!b.alive) break;
      for (const q of rivals(owner)) {          // tir sur un autre joueur
        if (q.inv > 0 || wrapDist2(playerPos(q), b) >= (b.rocket ? 0.3 : 0.2)) continue;
        b.alive = false;
        if (b.rocket) explode(b.x, b.y, null, owner); else { damage(q, owner); burst(b.x, b.y, '#d81b2c', 6, 0.55); }
        break;
      }
    }
  }
  G.bullets = G.bullets.filter(b => b.alive);
}
