// Clavier, souris et tactile → commandes du joueur local (via net/client.act, qui route vers l'hôte si besoin).
import { TURN_SPEED } from '../core/config.js';
import { G, canStart, isVersus } from '../core/state.js';
import { initAudio, audio } from '../audio.js';
import { stage } from '../gfx/scene.js';
import { act, local } from '../net/client.js';
import { introOpen } from './intro.js';

const KEYS = {
  ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1],
  q:[-1,0], a:[-1,0], d:[1,0], z:[0,-1], w:[0,-1], s:[0,1],
  tL:[-1,0], tR:[1,0], tU:[0,-1], tD:[0,1],   // glissements tactiles
};
const WEAPON_KEYS = { '1':'rifle', '&':'rifle', '2':'glock', 'é':'glock', '3':'minigun', '"':'minigun',
  '4':'bazooka', "'":'bazooka', '5':'katana', '(':'katana', 'k':'katana' };
const held = new Set();                       // directions maintenues (vue 1re personne)

function refreshCtl() {
  const c = local().ctl, dirs = [...held].map(k => KEYS[k]);
  c.fwd = dirs.some(v => v[1] === -1); c.left = dirs.some(v => v[0] === -1); c.right = dirs.some(v => v[0] === 1);
}
const setFire = on => { local().ctl.fire = on; };
function press(k, repeat) {
  initAudio();
  if (canStart()) act('start');
  const v = KEYS[k], p = local();
  if (p.view !== 'fp') { act('want', { x:v[0], y:v[1] }); return; }
  held.add(k); refreshCtl();
  if (!repeat && v[1] === 1 && !p.spin) p.spin = Math.PI;   // ↓ : demi-tour fluide
}
function release(k) { held.delete(k); refreshCtl(); }
function fireOrStart() { initAudio(); act('fire'); }
function toggleView() {
  if (isVersus() && !canStart()) return;       // à plusieurs, la vue est figée pendant la manche
  const fp = local().view === 'fp';
  if (fp && document.pointerLockElement) document.exitPointerLock();
  act('view', fp ? 'top' : 'fp');
}

// Rotation en vue 1re personne : calculée localement (fluide même pour l'invité), puis transmise
export function updateControls(dt) {
  const p = local();
  if (p.view === 'fp' && !G.paused && (G.state === 'play' || G.state === 'ready')) {
    if (p.ctl.left && !p.ctl.right) p.yaw += TURN_SPEED*dt; else if (p.ctl.right && !p.ctl.left) p.yaw -= TURN_SPEED*dt;
    if (p.spin) {
      const step = Math.sign(p.spin) * Math.min(Math.abs(p.spin), Math.max(3, Math.abs(p.spin)*8)*dt);
      p.yaw += step; p.spin -= step;
      if (Math.abs(p.spin) < 1e-3) p.spin = 0;
    }
  }
  if (G.state === 'eaten' && document.pointerLockElement) { held.clear(); document.exitPointerLock(); }
}

export function bindInput() {
  addEventListener('keydown', e => {
    if (introOpen() || e.target.tagName === 'INPUT') return;          // pseudo en cours de saisie
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k] && (k.length > 2 || 'qadzws'.includes(k))) { e.preventDefault(); press(k, e.repeat); return; }
    if (k === ' ' || k === 'f') { e.preventDefault(); if (!e.repeat) { fireOrStart(); setFire(true); } }
    else if (k === 'Enter') { initAudio(); act('enter'); }
    else if (k === 'p' || k === 'Escape') act('pause');
    else if (k === 'm') audio.muted = !audio.muted;
    else if (k === 'e') act('cycle');
    else if (WEAPON_KEYS[k]) act('weapon', WEAPON_KEYS[k]);
    else if (k === 'v' || k === 'c') toggleView();
  });
  addEventListener('keyup', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === ' ' || k === 'f') setFire(false);
    release(k);
  });
  addEventListener('mouseup', e => { if (e.button === 0) setFire(false); });
  addEventListener('blur', () => { held.clear(); refreshCtl(); setFire(false); });
  document.getElementById('viewBtn').addEventListener('click', e => { e.currentTarget.blur(); toggleView(); });
  document.getElementById('weaponBtn').addEventListener('click', e => { e.currentTarget.blur(); act('cycle'); });
  stage.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (local().view === 'fp' && !canStart() && document.pointerLockElement !== stage) {
      try { const r = stage.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {}
    }
    const starting = canStart();
    fireOrStart(); setFire(!starting);
  });
  addEventListener('mousemove', e => {
    const p = local();
    if (p.view === 'fp' && document.pointerLockElement === stage && !G.paused) p.yaw -= e.movementX * 0.0028;
  });
  let touch0 = null, touchKey = null;
  stage.addEventListener('touchstart', e => { const t = e.touches[0]; touch0 = { x:t.clientX, y:t.clientY }; touchKey = null; e.preventDefault(); }, { passive:false });
  stage.addEventListener('touchmove', e => {
    if (!touch0 || touchKey) return;
    const t = e.touches[0], dx = t.clientX - touch0.x, dy = t.clientY - touch0.y;
    if (Math.hypot(dx, dy) < 24) return;
    touchKey = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'tR' : 'tL') : (dy > 0 ? 'tD' : 'tU');
    press(touchKey, false);
    e.preventDefault();
  }, { passive:false });
  stage.addEventListener('touchend', () => {
    if (!touch0) return;
    if (touchKey) release(touchKey); else fireOrStart();
    touch0 = null; touchKey = null;
  }, { passive:false });
}
