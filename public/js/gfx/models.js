// Modèles 3D procéduraux : armes, explorateurs (un par joueur), arme en vue 1re personne, monstres, caisses.
import { THREE, scene, camera, M, solidMat } from './scene.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ENEMY_COLORS, MAX_ENEMIES } from '../core/config.js';

// ---------- Fusil ----------
const metalMat = M('#2a2c2e', { metalness:0.7, roughness:0.35 }), woodMat = M('#6b4423', { roughness:0.6 });
function makeGun() {
  const g = new THREE.Group();
  const box = (w,h,d,mat,x,y,z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); m.position.set(x,y,z); m.castShadow = true; g.add(m); return m; };
  box(0.07, 0.085, 0.34, metalMat, 0, 0, 0.05);
  box(0.06, 0.1, 0.2, woodMat, 0, -0.02, -0.21);
  box(0.035, 0.13, 0.06, metalMat, 0, -0.1, 0.08);
  box(0.06, 0.05, 0.16, woodMat, 0, -0.045, 0.2);
  box(0.015, 0.035, 0.04, metalMat, 0, 0.055, 0.15);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 10), metalMat);
  barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.012, 0.34); g.add(barrel);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color:'#ffd27a' }));
  flash.position.set(0, 0.012, 0.5); flash.visible = false; g.add(flash);
  g.userData.flash = flash;
  return g;
}

function makeBazooka() {
  const g = new THREE.Group();
  const olive = M('#4a5530', { roughness:0.6, side:THREE.DoubleSide }), dark = M('#23261f', { roughness:0.5, metalness:0.4 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.7, 16, 1, true), olive);
  tube.rotation.x = Math.PI/2; tube.castShadow = true; g.add(tube);
  for (const z of [-0.33, 0.33]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.06, 16), dark); r.rotation.x = Math.PI/2; r.position.z = z; g.add(r); }
  for (const z of [0.08, -0.08]) { const gr = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.05), dark); gr.position.set(0, -0.09, z); g.add(gr); }
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.08), dark); sight.position.set(-0.07, 0.05, 0.12); g.add(sight);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color:'#ffb347' }));
  flash.position.z = 0.42; flash.visible = false; g.add(flash);
  g.userData.flash = flash;
  return g;
}
const rocketBodyMat = M('#5b6440', { roughness:0.5, metalness:0.3 }), rocketNoseMat = M('#8a2a1e', { roughness:0.5 });
export function makeRocket() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), rocketBodyMat); body.rotation.x = Math.PI/2; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 10), rocketNoseMat); nose.rotation.x = Math.PI/2; nose.position.z = 0.16; g.add(nose);
  for (let i=0; i<4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.06), rocketBodyMat);
    fin.position.set(Math.cos(i*Math.PI/2)*0.04, Math.sin(i*Math.PI/2)*0.04, -0.1); fin.rotation.z = i*Math.PI/2; g.add(fin);
  }
  return g;
}

function makeGlock() {
  const g = new THREE.Group();
  const poly = M('#1f2124', { roughness:0.45, metalness:0.3 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.17), poly); slide.position.set(0, 0.01, 0.02); slide.castShadow = true; g.add(slide);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.05), poly); grip.position.set(0, -0.05, -0.04); grip.rotation.x = 0.28; g.add(grip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.04), poly); guard.position.set(0, -0.025, 0.02); g.add(guard);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color:'#ffd27a' }));
  flash.position.set(0, 0.012, 0.13); flash.visible = false; g.add(flash);
  g.userData.flash = flash;
  return g;
}
function makeDualGlocks(spread) {
  const g = new THREE.Group(), l = makeGlock(), r = makeGlock();
  l.position.x = -spread; r.position.x = spread; g.add(l, r);
  g.userData.flashes = [l.userData.flash, r.userData.flash];
  return g;
}
function makeMinigun() {
  const g = new THREE.Group();
  const metal = M('#2b2d30', { metalness:0.8, roughness:0.35 }), olive = M('#4a5530', { roughness:0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.2), metal); body.position.z = -0.05; body.castShadow = true; g.add(body);
  const barrels = new THREE.Group(); barrels.position.z = 0.17; g.add(barrels);
  for (let i=0; i<6; i++) {
    const a = i/6*Math.PI*2, b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 8), metal);
    b.rotation.x = Math.PI/2; b.position.set(Math.cos(a)*0.032, Math.sin(a)*0.032, 0); barrels.add(b);
  }
  for (const z of [-0.1, 0.12]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.02, 14), metal); ring.rotation.x = Math.PI/2; ring.position.z = z; barrels.add(ring); }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.12), metal); handle.position.set(0, 0.08, -0.04); g.add(handle);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.12), olive); box.position.set(-0.1, -0.02, -0.06); box.castShadow = true; g.add(box);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color:'#ffd27a' }));
  flash.position.z = 0.4; flash.visible = false; g.add(flash);
  g.userData.flash = flash; g.userData.barrels = barrels;
  return g;
}

function makeKatana() {
  const g = new THREE.Group();
  const steel = M('#dfe4ea', { metalness:1, roughness:0.12 }), edge = M('#ffffff', { metalness:1, roughness:0.05 });
  const gold = M('#b08a3a', { metalness:0.8, roughness:0.35 }), wrap = M('#1a1a1d', { roughness:0.8 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.028, 0.62), steel); blade.position.z = 0.36; blade.castShadow = true; g.add(blade);
  const bevel = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.6), edge); bevel.position.set(0, -0.014, 0.36); g.add(bevel);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 4), steel); tip.rotation.x = Math.PI/2; tip.position.z = 0.7; tip.scale.set(0.5, 1, 1); g.add(tip);
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16), gold); tsuba.rotation.x = Math.PI/2; tsuba.position.z = 0.045; g.add(tsuba);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.032, 0.17), wrap); handle.position.z = -0.045; g.add(handle);
  for (let i=0; i<5; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.034, 0.008), gold); d.position.z = -0.11 + i*0.035; d.rotation.z = 0.6; g.add(d); }
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.036, 0.015), gold); pommel.position.z = -0.135; g.add(pommel);
  g.userData.flash = new THREE.Object3D();
  return g;
}

// ---------- Personnage principal : explorateur armé ----------
export const eyeGeo = new THREE.SphereGeometry(1, 16, 12);
function part(parent, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
function makePerson(shirtCol, helmetCol) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = M('#d9a77c', { roughness:0.6 }), shirt = M(shirtCol), pants = M('#3b3a34'), boots = M('#2a2420'),
        helmet = M(helmetCol, { roughness:0.5 }), pack = M('#7a6440'), dark = M('#1d1712', { roughness:0.3 });
  const legGeo = new THREE.CapsuleGeometry(0.055, 0.2, 4, 8);
  const legs = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(s*0.075, 0.34, 0); body.add(pv);
    part(pv, legGeo, pants, 0, -0.16, 0);
    part(pv, new THREE.BoxGeometry(0.09, 0.06, 0.15), boots, 0, -0.31, 0.03);
    return pv;
  });
  part(body, new RoundedBoxGeometry(0.28, 0.3, 0.17, 2, 0.05), shirt, 0, 0.5, 0);
  part(body, new THREE.BoxGeometry(0.3, 0.04, 0.18), pants, 0, 0.36, 0); // ceinture
  part(body, new RoundedBoxGeometry(0.2, 0.24, 0.09, 2, 0.03), pack, 0, 0.52, -0.13);
  part(body, new THREE.CylinderGeometry(0.04, 0.045, 0.05, 10), skin, 0, 0.67, 0);
  part(body, new THREE.SphereGeometry(0.095, 20, 16), skin, 0, 0.76, 0);
  part(body, new THREE.SphereGeometry(0.108, 20, 12, 0, Math.PI*2, 0, Math.PI/2), helmet, 0, 0.775, 0);
  part(body, new THREE.CylinderGeometry(0.135, 0.135, 0.014, 20), helmet, 0, 0.78, 0.01);
  for (const s of [-1, 1]) { const e = part(body, eyeGeo, dark, s*0.035, 0.765, 0.088); e.scale.setScalar(0.014); }
  const armGeo = new THREE.CapsuleGeometry(0.042, 0.2, 4, 8);
  const arms = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(s*0.17, 0.61, 0); body.add(pv);
    part(pv, armGeo, shirt, 0, -0.12, 0);
    part(pv, new THREE.SphereGeometry(0.045, 10, 8), skin, 0, -0.26, 0);
    pv.rotation.set(-1.35, 0, -s*0.38);
    return pv;
  });
  const gun = makeGun(); gun.position.set(0.02, 0.53, 0.2); body.add(gun);
  return { root, body, legs, arms, gun };
}
// Un explorateur complet, avec toutes ses armes (une seule visible à la fois)
export function makeHero(shirt, helmet) {
  const hero = makePerson(shirt, helmet);
  hero.baz = makeBazooka(); hero.baz.position.set(0.1, 0.66, 0.05); hero.baz.visible = false; hero.body.add(hero.baz);
  hero.glocks = makeDualGlocks(0.1); hero.glocks.position.set(0, 0.53, 0.27); hero.glocks.visible = false; hero.body.add(hero.glocks);
  hero.mini = makeMinigun(); hero.mini.position.set(0.03, 0.5, 0.2); hero.mini.visible = false; hero.body.add(hero.mini);
  hero.katana = makeKatana(); hero.katana.position.set(0.12, 0.55, 0.18); hero.katana.visible = false; hero.body.add(hero.katana);
  hero.weapons = { rifle:hero.gun, glock:hero.glocks, minigun:hero.mini, bazooka:hero.baz, katana:hero.katana };
  hero.light = new THREE.PointLight('#ffd27a', 0, 5, 2); hero.light.position.set(0, 0.55, 0.6); hero.root.add(hero.light);
  scene.add(hero.root);
  return hero;
}

// Arme en vue 1re personne
const vmGun = makeGun();
{
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M('#d9a77c', { roughness:0.6 }));
  hand.position.set(0, -0.06, 0.1); vmGun.add(hand);
  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), M('#5b6b3a'));
  sleeve.rotation.x = Math.PI/2; sleeve.position.set(0.02, -0.08, -0.08); vmGun.add(sleeve);
}
vmGun.rotation.y = Math.PI; vmGun.visible = false;
camera.add(vmGun);
const vmBase = new THREE.Vector3(0.16, -0.16, -0.34);
const vmBaz = makeBazooka();
{
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M('#d9a77c', { roughness:0.6 }));
  hand.position.set(0, -0.12, 0.08); vmBaz.add(hand);
}
vmBaz.rotation.y = Math.PI; vmBaz.visible = false;
camera.add(vmBaz);
const vmBazBase = new THREE.Vector3(0.2, -0.13, -0.3);
const vmGlocks = makeDualGlocks(0.17);
for (const gl of vmGlocks.children) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), M('#d9a77c', { roughness:0.6 })); h.position.set(0, -0.06, -0.04); gl.add(h); }
vmGlocks.rotation.y = Math.PI; vmGlocks.visible = false; camera.add(vmGlocks);
export const vmMini = makeMinigun(); vmMini.rotation.y = Math.PI; vmMini.visible = false; camera.add(vmMini);
export const VM = {
  rifle:   { m:vmGun,    base:vmBase },
  glock:   { m:vmGlocks, base:new THREE.Vector3(0, -0.15, -0.3) },
  minigun: { m:vmMini,   base:new THREE.Vector3(0.17, -0.18, -0.36) },
  bazooka: { m:vmBaz,    base:vmBazBase },
  katana:  { m:null,     base:new THREE.Vector3(0.2, -0.2, -0.32) },
};
{
  const k = makeKatana(), hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), M('#d9a77c', { roughness:0.6 }));
  hand.position.set(0, 0, -0.05); k.add(hand);
  k.visible = false; camera.add(k); VM.katana.m = k;
}
export function weaponFlash(model, on, glockSide = 1) {
  if (model.userData.flashes) model.userData.flashes.forEach((f, i) => f.visible = on && i === (glockSide > 0 ? 1 : 0));
  else model.userData.flash.visible = on;
}

// ---------- Monstres en gelée ----------
const gumGeo = (() => {
  const g = new THREE.SphereGeometry(0.42, 40, 28), p = g.attributes.position;
  for (let i=0; i<p.count; i++) { const y = p.getY(i); p.setY(i, y < 0 ? y*0.4 : y*1.15); }
  g.computeVertexNormals(); return g;
})();
const eyeWhite = M('#ffffff', { roughness:0.2 }), eyeDark = M('#1a1020', { roughness:0.1 });
const hornMat = M('#3a2a1a', { roughness:0.5 }), mouthMat = M('#2a0a0a', { roughness:0.4 }), toothMat = M('#f4f0e4', { roughness:0.3 });
const signTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 210;
  const g = c.getContext('2d');
  g.fillStyle = '#e9dcbc'; g.fillRect(0, 0, 512, 210);
  for (let i=0; i<900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(120,90,50,.08)' : 'rgba(255,255,255,.1)'; g.fillRect(Math.random()*512, Math.random()*210, 2, 2); }
  g.strokeStyle = '#a8895a'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 200);
  g.fillStyle = '#1b1612'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 96; const txt = 'ABDELHADI';
  do { g.font = `900 ${size}px "Marker Felt", "Comic Sans MS", "Arial Black", sans-serif`; size -= 4; } while (g.measureText(txt).width > 470);
  g.save(); g.translate(256, 108); g.rotate(-0.03); g.fillText(txt, 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const signFace = M('#ffffff', { map:signTex, roughness:0.9 }), signEdge = M('#a8895a', { roughness:0.9 });
const signBoardGeo = new THREE.BoxGeometry(0.62, 0.26, 0.025), stickGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6);
export function makeMonster() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = solidMat('#c8102e');
  const torso = part(body, gumGeo, mat, 0, 0.3, 0); torso.scale.set(0.85, 0.95, 0.85);
  const legGeo = new THREE.CapsuleGeometry(0.07, 0.1, 4, 10);
  const legs = [-1, 1].map(s => { const pv = new THREE.Group(); pv.position.set(s*0.13, 0.2, 0); body.add(pv); part(pv, legGeo, mat, 0, -0.1, 0); return pv; });
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.22, 4, 10);
  const arms = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(s*0.3, 0.46, 0); body.add(pv);
    part(pv, armGeo, mat, 0, -0.14, 0);
    for (let k=-1; k<=1; k++) { const cl = part(pv, new THREE.ConeGeometry(0.015, 0.06, 6), hornMat, k*0.03, -0.31, 0); cl.rotation.x = Math.PI; }
    return pv;
  });
  const horns = [-1, 1].map(s => { const h = part(body, new THREE.ConeGeometry(0.045, 0.17, 10), hornMat, s*0.15, 0.8, 0); h.rotation.z = -s*0.45; return h; });
  const pupils = [];
  for (const s of [-1, 1]) {
    const w = part(body, eyeGeo, eyeWhite, s*0.12, 0.57, 0.3); w.scale.setScalar(0.085);
    const p = part(body, eyeGeo, eyeDark, s*0.12, 0.57, 0.375); p.scale.setScalar(0.04); pupils.push(p);
  }
  const mouth = part(body, eyeGeo, mouthMat, 0, 0.4, 0.33); mouth.scale.set(0.15, 0.055, 0.04);
  for (const s of [-1, 1]) { const t = part(body, new THREE.ConeGeometry(0.02, 0.05, 6), toothMat, s*0.06, 0.425, 0.355); t.rotation.x = Math.PI; }
  const sign = new THREE.Group(); sign.position.set(0, 0.95, 0.24); body.add(sign);
  const board = new THREE.Mesh(signBoardGeo, [signEdge, signEdge, signEdge, signEdge, signFace, signFace]);
  board.castShadow = true; sign.add(board);
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(stickGeo, woodMat); st.position.set(sx*0.14, -0.2, -0.02); st.castShadow = true; sign.add(st); }
  return { root, body, torso, mat, legs, arms, horns, pupils, sign, mouth, base:new THREE.Color(), phase:Math.random()*6 };
}
export const monsterViews = Array.from({ length:MAX_ENEMIES }, (_, i) => i).map(() => { const v = makeMonster(); scene.add(v.root); return v; });
export function applyKind(v, kind) {
  v.base.set(ENEMY_COLORS[kind]);
  v.horns.forEach(h => { h.visible = kind !== 2; h.scale.setScalar(kind === 0 ? 1.3 : 1); });
  v.root.scale.setScalar(kind === 3 ? 1.08 : 1);
}

// ---------- Caisses de munitions ----------
export const crateTpl = (() => {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.2, 0.24, 2, 0.02), M('#5d5a2c', { roughness:0.8 }));
  box.position.y = 0.1; box.castShadow = true; g.add(box);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.25), M('#3b3a1e')); band.position.y = 0.14; g.add(band);
  const brass = M('#c9a14a', { metalness:0.8, roughness:0.3 });
  for (let i=-1; i<=1; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 10), brass);
    b.position.set(i*0.07, 0.26, 0); b.castShadow = true; g.add(b);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.04, 10), M('#8a5a2a', { metalness:0.6, roughness:0.4 }));
    tip.position.set(i*0.07, 0.34, 0); g.add(tip);
  }
  return g;
})();

export const dropTpls = (() => {
  const ringMat = new THREE.MeshStandardMaterial({ color:'#ffd24a', emissive:'#ffb000', emissiveIntensity:0.9, roughness:0.4 });
  const make = (model, s) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 32), ringMat); ring.rotation.x = -Math.PI/2; ring.position.y = 0.42; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ color:'#ffe08a', transparent:true, opacity:0.25, depthWrite:false }));
    disc.rotation.x = -Math.PI/2; disc.position.y = 0.42; g.add(disc);
    model.scale.setScalar(s); model.position.y = 0.55; model.rotation.y = Math.PI/2; g.add(model);
    return g;
  };
  return { bazooka:make(makeBazooka(), 1.0), minigun:make(makeMinigun(), 1.3), glock:make(makeDualGlocks(0.09), 1.6) };
})();
