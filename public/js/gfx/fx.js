// Effets éphémères : particules, fumée, boules de feu, coups de katana, textes flottants, secousses.
import { THREE, scene, stage } from './scene.js';
import { OX, OZ, SLASH_RANGE } from '../core/config.js';
import { terrainH } from '../core/terrain.js';

export const partGeo = new THREE.SphereGeometry(0.06, 8, 6);
const puffGeo = new THREE.SphereGeometry(1, 12, 8);
const slashGeo = new THREE.RingGeometry(0.35, SLASH_RANGE, 28, 1, -Math.PI/2.6, Math.PI/1.3);
const boomLight = new THREE.PointLight('#ffa040', 0, 8, 2); scene.add(boomLight);
let fx = [], particles = [], popups = [], boomT = 0;
export const shakeState = { t: 0 };

export function smoke(gx, gy, h, size, life) {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshStandardMaterial({ color:'#8a8580', transparent:true, opacity:0.6, roughness:1, depthWrite:false }));
  m.position.set(gx-OX, h + terrainH(gx, gy), gy-OZ); m.scale.setScalar(size); scene.add(m);
  fx.push({ m, t:0, life, size, kind:'smoke', vy:0.3 + Math.random()*0.5, vx:(Math.random()-0.5)*0.4, vz:(Math.random()-0.5)*0.4 });
}
function fireball(gx, gy) {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color:'#ffb347', transparent:true, depthWrite:false }));
  m.position.set(gx-OX, 0.5 + terrainH(gx, gy), gy-OZ); scene.add(m);
  fx.push({ m, t:0, life:0.5, kind:'fire' });
}
export function burst(gx, gy, color, n, y = 0.4) {
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness:0.2, clearcoat:1 });
  for (let i=0; i<n; i++) {
    const m = new THREE.Mesh(partGeo, mat);
    m.position.set(gx-OX, y + terrainH(gx, gy), gy-OZ); scene.add(m);
    const a = Math.random()*Math.PI*2, s = 1.5 + Math.random()*3.5;
    particles.push({ m, vx:Math.cos(a)*s, vy:2+Math.random()*4, vz:Math.sin(a)*s, life:1 });
  }
}
function popup(gx, gy, text) {
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = text;
  stage.appendChild(el);
  popups.push({ el, x:gx-OX, z:gy-OZ, h:terrainH(gx, gy), t:0 });
}
function slash(x, y, a) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color:'#eef6ff', transparent:true, opacity:0.75, side:THREE.DoubleSide, depthWrite:false });
  const m = new THREE.Mesh(slashGeo, mat); m.rotation.x = -Math.PI/2; g.add(m);
  g.position.set(x-OX, 0.55 + terrainH(x, y), y-OZ); g.rotation.y = a - Math.PI/2; scene.add(g);
  fx.push({ m:g, mat, t:0, life:0.22, kind:'slash' });
}
function explosion(x, y) {
  fireball(x, y);
  burst(x, y, '#ff9a3c', 10, 0.5);
  for (let k=0; k<7; k++) smoke(x + (Math.random()-0.5)*0.6, y + (Math.random()-0.5)*0.6, 0.3 + Math.random()*0.5, 0.18 + Math.random()*0.15, 1.4 + Math.random()*0.8);
  boomLight.position.set(x-OX, 0.9 + terrainH(x, y), y-OZ); boomT = 0.5;
  shakeState.t = Math.max(shakeState.t, 0.45);
}

// Abonné au bus d'événements de la simulation
const HANDLERS = { burst, popup, smoke, explosion, slash, shake: t => { shakeState.t = Math.max(shakeState.t, t); } };
export function handleFx(type, args) { const h = HANDLERS[type]; if (h) h(...args); }

export function updateFx(dt) {
  for (const f of fx) {
    f.t += dt; const k = f.t/f.life;
    if (f.kind === 'slash') { f.mat.opacity = 0.75*(1-k); f.m.scale.setScalar(0.85 + 0.3*k); }
    else if (f.kind === 'fire') { f.m.scale.setScalar(0.25 + k*1.4); f.m.material.opacity = 1-k; f.m.material.color.setHSL(0.09 - 0.07*k, 1, 0.62 - 0.25*k); }
    else { f.m.position.x += f.vx*dt; f.m.position.y += f.vy*dt; f.m.position.z += f.vz*dt; f.m.scale.setScalar(f.size*(1 + k*2.5)); f.m.material.opacity = 0.6*(1-k); }
  }
  fx = fx.filter(f => { if (f.t < f.life) return true; scene.remove(f.m); (f.mat || f.m.material).dispose(); return false; });
  boomT = Math.max(0, boomT - dt); boomLight.intensity = boomT > 0 ? 30*boomT/0.5 : 0;
  shakeState.t = Math.max(0, shakeState.t - dt);

  for (const pt of particles) {
    pt.vy -= 14*dt;
    pt.m.position.x += pt.vx*dt; pt.m.position.y += pt.vy*dt; pt.m.position.z += pt.vz*dt;
    const fl = terrainH(pt.m.position.x+OX, pt.m.position.z+OZ) + 0.06;
    if (pt.m.position.y < fl) { pt.m.position.y = fl; pt.vy *= -0.4; pt.vx *= 0.7; pt.vz *= 0.7; }
    pt.life -= dt*0.9;
    pt.m.scale.setScalar(Math.max(0.01, pt.life));
  }
  particles = particles.filter(pt => { if (pt.life > 0) return true; scene.remove(pt.m); return false; });
}
// Textes flottants : projetés après le placement final de la caméra
const _v = new THREE.Vector3();
export function updatePopups(dt, camera) {
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const pp of popups) {
    pp.t += dt;
    _v.set(pp.x, 1 + pp.h + pp.t*1.5, pp.z).project(camera);
    pp.el.style.left = (_v.x*0.5+0.5)*w + 'px';
    pp.el.style.top = (-_v.y*0.5+0.5)*h + 'px';
    pp.el.style.opacity = _v.z > 1 ? 0 : 1 - pp.t;
  }
  popups = popups.filter(pp => { if (pp.t < 1) return true; pp.el.remove(); return false; });
}
