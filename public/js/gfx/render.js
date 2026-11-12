// Rendu d'une image à partir de l'état G : place les modèles, crée/supprime les meshes des balles et caisses,
// gère la caméra du joueur local et la cinématique « Dévoré ». Ne modifie jamais G.
import { THREE, renderer, scene, camera, stage, uTime } from './scene.js';
import { W, OX, OZ, GAME_SPEED, FRIGHT_COLOR, WEAPON_ORDER, SLASH_TIME, PLAYERS } from '../core/config.js';
import { pos, playerPos, faceAngle } from '../core/state.js';
import { terrainH } from '../core/terrain.js';
import { enemySpeed } from '../game/enemies.js';
import { syncWorld, wallSide, wallTop, bonusMesh, powerMeshes } from './world.js';
import { makeHero, VM, vmMini, weaponFlash, monsterViews, applyKind, crateTpl, dropTpls, makeRocket } from './models.js';
import { updateFx, updatePopups, shakeState, burst, partGeo } from './fx.js';
import { beep, noiseHit } from '../audio.js';

const _v = new THREE.Vector3();
const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return a + d*k; };

// ---- Caméra ----
let topDist = 27, camX = 0, camGround = 0, camPitch = 0, shownView = null;
export function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  topDist = 27 * Math.max(1, 1.05 / camera.aspect);
  camera.updateProjectionMatrix();
}
function applyView(v) {
  shownView = v;
  camera.fov = v === 'fp' ? 72 : 38;
  camera.near = v === 'fp' ? 0.03 : 0.1;
  camera.updateProjectionMatrix();
  scene.fog.near = v === 'fp' ? 3 : 40;
  scene.fog.far = v === 'fp' ? 22 : 90;
}

// ---- Explorateurs : un modèle par joueur ----
const heroes = {};
const heroFor = id => heroes[id] ||= makeHero(PLAYERS[id].shirt, PLAYERS[id].helmet);
function animHero(h, p, moving, dt, time) {
  const pp = playerPos(p);
  h.root.position.set(pp.x-OX, terrainH(pp.x, pp.y), pp.y-OZ);
  h.root.rotation.y = lerpAngle(h.root.rotation.y, faceAngle(p.face), Math.min(1, dt*14));
  const ph = p.walk * 9.5, swing = moving ? Math.sin(ph) : 0;
  h.legs[0].rotation.x = swing*0.7; h.legs[1].rotation.x = -swing*0.7;
  h.body.position.y = moving ? Math.abs(Math.cos(ph))*0.03 : Math.sin(time*2)*0.005;
  h.arms.forEach(a => { a.rotation.x = -1.35 + p.recoil*0.25 + (moving ? Math.sin(ph*2)*0.03 : 0); });
  for (const w of WEAPON_ORDER) { h.weapons[w].visible = w === p.weapon; weaponFlash(h.weapons[w], p.flashT > 0 && w === p.weapon, p.glockSide); }
  h.gun.position.z = 0.2 - p.recoil*0.05;
  const k = p.slashT > 0 ? 1 - p.slashT/SLASH_TIME : 0;
  h.katana.rotation.set(p.slashT > 0 ? -0.2 : -0.9, p.slashT > 0 ? 1.4 - k*2.8 : 0.3, 0);
  h.light.intensity = p.flashT > 0 ? 6 : 0;
  h.mini.userData.barrels.rotation.z += p.spinV*dt;
}

// ---- Balles et caisses : meshes créés/supprimés selon G (repérés par id) ----
const bulletGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), bulletMat = new THREE.MeshBasicMaterial({ color:'#ffe08a' });
function makeBulletMesh(b) {
  let mesh;
  if (b.rocket) {
    mesh = makeRocket(); mesh.rotation.y = b.ang;
    const glow = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color:'#ffb347' })); glow.position.z = -0.15; glow.scale.setScalar(1.5); mesh.add(glow);
  } else {
    mesh = new THREE.Mesh(bulletGeo, bulletMat); mesh.rotation.order = 'YXZ'; mesh.rotation.set(Math.PI/2, b.ang, 0);
  }
  scene.add(mesh); return mesh;
}
const bulletMeshes = new Map(), crateViews = new Map();
function syncList(list, views, create, remove) {
  const alive = new Set();
  for (const it of list) { alive.add(it.id); if (!views.has(it.id)) views.set(it.id, create(it)); }
  for (const [id, v] of views) if (!alive.has(id)) { remove(v); views.delete(id); }
}

// ---- Cinématique « Dévoré » ----
const camCine = new THREE.Vector3();
let cine = null;                       // { sfx } pendant la cinématique
function resetPoses() {
  for (const h of Object.values(heroes)) { h.root.scale.setScalar(1); h.root.rotation.x = 0; h.root.position.y = 0; }
  for (const v of monsterViews) { v.mouth.scale.set(0.15, 0.055, 0.04); v.body.scale.set(1, 1, 1); v.root.scale.setScalar(v.kind === 3 ? 1.08 : 1); }
}
function eatenCinematic(G, time, dt) {
  const e = G.enemies[G.eat.slot], victim = G.players.find(p => p.id === G.eat.who) || G.players[0];
  const vh = heroFor(victim.id), T = G.stateT, v = monsterViews[e.slot], pp = playerPos(victim), kp = G.eat.from;
  const ease = k => { k = Math.min(1, Math.max(0, k)); return k*k*(3-2*k); };
  let dx = pp.x - kp.x; if (Math.abs(dx) > W/2) dx -= Math.sign(dx)*W;
  const dy = pp.y - kp.y;
  const ang = Math.atan2(dx, dy), ux = Math.sin(ang), uy = Math.cos(ang);
  const a1 = ease(T/0.7);
  // le monstre se jette sur le joueur et grossit
  const tx = pp.x - ux*0.5, ty = pp.y - uy*0.5;
  const mx = kp.x + (tx - kp.x)*a1, my = kp.y + (ty - kp.y)*a1;
  v.root.visible = true;
  const gh = terrainH(mx, my);
  v.root.position.set(mx-OX, gh, my-OZ); v.root.rotation.y = ang;
  v.root.scale.setScalar((e.kind === 3 ? 1.08 : 1) * (1 + 0.7*a1));
  const chewing = T > 1.5 && T < 3.0, chew = chewing ? Math.sin((T-1.5)*20) : 0;
  const open = T < 1.5 ? a1 : (chewing ? Math.max(0, chew) : 0);
  v.mouth.scale.set(0.15 + 0.08*open, 0.055 + 0.17*open, 0.04 + 0.03*open);
  const belly = T > 3.0 ? ease((T-3.0)/0.5)*0.15 : 0;
  v.body.scale.set(1 + Math.abs(chew)*0.07 + belly, 1 - Math.abs(chew)*0.09, 1 + Math.abs(chew)*0.07 + belly);
  v.arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(T < 1.5 ? -1.6 - a1*0.3 : -2.9 + chew*0.35, 0, -s*(T < 1.5 ? 0.15 : 0.45)); });
  v.sign.rotation.z = chew*0.15;
  // le joueur est soulevé puis avalé
  v.root.updateMatrixWorld(true);
  v.mouth.getWorldPosition(_v);
  const a2 = ease((T-0.7)/0.8);
  vh.root.visible = a2 < 0.98;
  const ph0 = terrainH(pp.x, pp.y);
  vh.root.position.set(pp.x-OX + (_v.x - (pp.x-OX))*a2, ph0 + (_v.y - 0.35 - ph0)*a2 + Math.sin(a2*Math.PI)*0.4, pp.y-OZ + (_v.z - (pp.y-OZ))*a2);
  vh.root.scale.setScalar(1 - a2*0.92);
  vh.root.rotation.x = -a2*1.4; vh.root.rotation.y = ang + Math.PI + a2*6;
  vh.legs[0].rotation.x = Math.sin(time*30)*0.9*(a2 > 0 ? 1 : 0); vh.legs[1].rotation.x = -vh.legs[0].rotation.x;
  // bruitages (joués localement de chaque côté)
  if (cine.sfx === 0 && T > 0.7) { cine.sfx = 1; beep(520, 0.4, 'triangle', 0.08, 900); }
  if (cine.sfx === 1 && T > 1.45) { cine.sfx = 2; noiseHit(900, 120, 0.25, 0.4); beep(110, 0.25, 'square', 0.08, 50); }
  if (cine.sfx >= 2 && cine.sfx < 6 && T > 1.5 + (cine.sfx-1)*0.32) { cine.sfx++; noiseHit(700, 150, 0.12, 0.3); burst(mx + ux*0.3, my + uy*0.3, '#5b6b3a', 4, 0.6); }
  if (cine.sfx === 6 && T > 3.1) { cine.sfx = 7; beep(90, 0.7, 'sawtooth', 0.09, 55); }
  // caméra cinématique
  const px_ = -uy, py_ = ux;
  _v.set(mx-OX + ux*2.4 + px_*0.9, 1.3 + gh, my-OZ + uy*2.4 + py_*0.9);
  camCine.lerp(_v, Math.min(1, dt*2.5));
  camera.position.copy(camCine);
  camera.lookAt(mx-OX, 0.65 + gh, my-OZ);
  camera.fov += (50 - camera.fov)*Math.min(1, dt*3); camera.updateProjectionMatrix();
}

// ---- Image complète ----
export function render(G, me, time, dt) {
  uTime.value = time;
  syncWorld(G);
  if (me.view !== shownView && !cine) applyView(me.view);
  const flash = G.state === 'clear' && Math.floor(G.stateT*6) % 2;
  for (const wm of [wallSide, wallTop]) { wm.emissive.set(flash ? '#ffffff' : '#000000'); wm.emissiveIntensity = flash ? 0.4 : 0; }
  const live = G.state === 'play' && !G.paused && G.freezeT <= 0;
  vmMini.userData.barrels.rotation.z += me.spinV*dt;
  updateFx(dt);

  for (const k in powerMeshes) {
    const m = powerMeshes[k];
    m.position.y = 0.45 + terrainH(m.position.x+OX, m.position.z+OZ) + Math.sin(time*2 + m.position.x)*0.06;
    m.rotation.y = time*1.6 + m.position.x;
    const beat = Math.max(0, Math.sin(time*6)) ** 6;
    m.scale.setScalar(1 + beat*0.15);
    m.material.emissiveIntensity = 0.35 + beat*0.5;
  }
  bonusMesh.visible = !!G.bonus && (G.bonus.t > 2 || Math.floor(time*8) % 2 === 0);
  bonusMesh.rotation.y = time*2; bonusMesh.position.y = 0.5 + terrainH(10, 11) + Math.sin(time*3)*0.12;

  syncList(G.crates, crateViews, c => {
    const mesh = (c.type === 'ammo' ? crateTpl : dropTpls[c.type]).clone(); mesh.position.set(c.x-OX, 0, c.y-OZ); scene.add(mesh);
    return { mesh, t:0 };
  }, v => scene.remove(v.mesh));
  for (const c of G.crates) {
    const v = crateViews.get(c.id); v.t += dt;
    v.mesh.rotation.y = time*0.8; v.mesh.position.y = terrainH(c.x, c.y) + Math.min(0, -0.4 + v.t*2) + Math.abs(Math.sin(time*2))*0.04;
  }
  syncList(G.bullets, bulletMeshes, makeBulletMesh, m => scene.remove(m));
  for (const b of G.bullets) {
    const m = bulletMeshes.get(b.id);
    m.position.set(b.x-OX, 0.55 + terrainH(b.x, b.y), b.y-OZ); if (b.rocket) m.rotation.z += dt*12;
  }

  // Explorateurs
  for (const id in heroes) if (!G.players.some(p => p.id === id)) heroes[id].root.visible = false;
  for (const p of G.players) {
    const h = heroFor(p.id);
    animHero(h, p, !!p.moving && live, dt, time);
    const blink = p.inv > 0 && Math.floor(time*12) % 2 === 0;
    h.root.visible = G.state !== 'over' && !p.dead && (p.id !== me.id || me.view !== 'fp' || G.state === 'eaten') && !blink;
  }

  // Monstres (les emplacements inutilisés restent cachés)
  monsterViews.forEach((v, i) => { if (i >= G.enemies.length) v.root.visible = false; });
  G.enemies.forEach(e => {
    const v = monsterViews[e.slot], ep = pos(e);
    if (v.kind !== e.kind) { v.kind = e.kind; applyKind(v, e.kind); }
    v.root.position.set(ep.x-OX, terrainH(ep.x, ep.y), ep.y-OZ);
    v.root.visible = G.state !== 'title' && e.mode !== 'dead';
    if (!v.root.visible) return;
    const fright = e.mode === 'fright', blink = fright && G.frightT < 2 && Math.floor(time*8) % 2;
    const col = fright ? (blink ? '#ffffff' : FRIGHT_COLOR) : v.base;
    v.mat.color.set(col); v.mat.attenuationColor.set(col);
    v.pupils.forEach(pu => pu.visible = !fright);
    const dir = (e.dir.x || e.dir.y) ? e.dir : {x:0, y:1};
    v.root.rotation.y = lerpAngle(v.root.rotation.y, faceAngle(dir), Math.min(1, dt*10));
    const walking = live && e.mode !== 'house';
    if (walking) v.phase += dt * enemySpeed(e) * GAME_SPEED * 9;
    const sw = walking ? Math.sin(v.phase) : 0;
    v.legs[0].rotation.x = sw*0.8; v.legs[1].rotation.x = -sw*0.8;
    // bras levés qui brandissent la pancarte
    const lift = fright ? Math.sin(time*20)*0.12 : Math.sin(v.phase*0.5)*0.05;
    v.arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(-2.5 + lift, 0, -s*0.45); });
    v.sign.rotation.z = fright ? Math.sin(time*25)*0.12 : Math.sin(v.phase*0.5)*0.04;
    v.sign.position.y = 0.95 + lift*0.15;
    v.body.rotation.z = fright ? Math.sin(time*30)*0.05 : 0;
    v.body.position.y = (walking ? Math.abs(Math.cos(v.phase))*0.04 : 0) +
      (e.mode === 'house' ? Math.abs(Math.sin(time*3 + e.slot))*0.08 : 0);
  });

  // Caméra du joueur local
  const p = playerPos(me), moving = !!me.moving && live;
  if (me.view === 'fp') {
    const sx = Math.sin(me.yaw), sz = Math.cos(me.yaw);
    const bob = moving ? Math.sin(me.walk*19)*0.02 : 0;
    const ground_ = terrainH(p.x, p.y);
    camGround += (ground_ - camGround)*Math.min(1, dt*10);
    const eyeH = camGround + 0.68 + bob;
    const slope = terrainH(p.x + sx*0.9, p.y + sz*0.9) - ground_;
    camPitch += (slope*0.7 - camPitch)*Math.min(1, dt*5);
    camera.position.set(p.x-OX - sx*0.12, eyeH, p.y-OZ - sz*0.12);
    camera.lookAt(camera.position.x + sx, eyeH - 0.06 + camPitch, camera.position.z + sz);
    scene.fog.far = 22 + camGround*35;                       // en hauteur on voit plus loin
    scene.fog.near = 3 + camGround*10;
    const show = G.state !== 'eaten' && G.state !== 'over';
    for (const w of WEAPON_ORDER) VM[w].m.visible = show && w === me.weapon;
    const vm = VM[me.weapon].m, base = VM[me.weapon].base;
    vm.position.set(base.x + (moving ? Math.sin(me.walk*9.5)*0.012 : 0),
                    base.y + (moving ? Math.abs(Math.cos(me.walk*9.5))*0.012 : 0),
                    base.z + me.recoil*0.07);
    vm.rotation.x = -me.recoil*0.18;
    weaponFlash(vm, me.flashT > 0, me.glockSide);
    if (me.weapon === 'katana') {
      const k = me.slashT > 0 ? 1 - me.slashT/SLASH_TIME : 0, sw = me.slashT > 0 ? Math.sin(k*Math.PI) : 0;
      vm.rotation.set(0.5 - sw*0.9, Math.PI + 0.25 - (me.slashT > 0 ? (k - 0.35)*2.6 : 0), 0.6 - sw*0.9);
      vm.position.x = base.x - (me.slashT > 0 ? k*0.32 : 0);
      vm.position.y = base.y + sw*0.06;
    }
  } else {
    for (const w of WEAPON_ORDER) VM[w].m.visible = false;
    camX += ((p.x-OX)*0.12 - camX)*Math.min(1, dt*3);
    camera.position.set(camX, topDist*0.86, topDist*0.52);
    camera.lookAt(0, 0, 0.6);
  }
  if (G.state === 'eaten' && G.eat) {
    if (!cine) { cine = { sfx:0 }; camCine.copy(camera.position); }
    eatenCinematic(G, time, dt);
  } else if (cine) { cine = null; resetPoses(); applyView(me.view); }
  if (shakeState.t > 0) {
    const a = shakeState.t*(me.view === 'fp' ? 0.12 : 0.5);
    camera.position.x += (Math.random()-0.5)*a; camera.position.y += (Math.random()-0.5)*a; camera.position.z += (Math.random()-0.5)*a;
  }
  updatePopups(dt, camera);
  renderer.render(scene, camera);
}
