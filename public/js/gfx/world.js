// Décor du niveau (sol, herbe, arbres, murs, perles, cœurs, bonus) et sa synchronisation avec la carte vivante G.grid.
import { THREE, scene, M, solidMat, uTime, grassTex, pathTex } from './scene.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAP, W, H, OX, OZ, WALL_H } from '../core/config.js';
import { reach, isReach, terrainH, wallTiles, dotTiles } from '../core/terrain.js';
import { burst } from './fx.js';

function windy(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      float sw = sin(uTime*1.8 + ip.x*0.5 + ip.z*0.35)*0.6 + sin(uTime*3.1 + ip.x*1.7)*0.25;
      transformed.x += sw*position.y*position.y*0.12;
      transformed.z += sw*position.y*position.y*0.06;`);
  };
  return mat;
}

// ---------- Sol, chemin, nature ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map:grassTex, roughness:0.95 }));
ground.rotation.x = -Math.PI/2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);
function terrainGeo(lift) {
  const g = new THREE.PlaneGeometry(W+2, H+2, (W+2)*6, (H+2)*6);
  g.rotateX(-Math.PI/2);
  const pa = g.attributes.position;
  for (let i=0; i<pa.count; i++) pa.setY(i, terrainH(pa.getX(i)+OX, pa.getZ(i)+OZ) + lift);
  g.computeVertexNormals();
  return g;
}
const boardGrass = grassTex.clone(); boardGrass.repeat.set((W+2)/3.7, (H+2)/3.7); boardGrass.needsUpdate = true;
const terrain = new THREE.Mesh(terrainGeo(0), new THREE.MeshStandardMaterial({ map:boardGrass, roughness:0.95 }));
terrain.receiveShadow = true; scene.add(terrain);
const pathMesh = new THREE.Mesh(terrainGeo(0.012),
  new THREE.MeshStandardMaterial({ map:pathTex, transparent:true, roughness:1, depthWrite:false }));
pathMesh.receiveShadow = true; scene.add(pathMesh);

// Brins d'herbe (bords des couloirs + prairie autour)
{
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.018,0,0, 0.018,0,0, 0,1,0.01], 3));
  blade.computeVertexNormals();
  const pts = [];
  for (const k of reach) {
    const [x,y] = k.split(',').map(Number);
    for (let i=0; i<14; i++) {
      const a = Math.random()*Math.PI*2, r = 0.3 + Math.random()*0.2;
      pts.push([x + Math.cos(a)*r, y + Math.sin(a)*r, 0.08 + Math.random()*0.12]);
    }
  }
  for (let i=0; i<9000; i++) {
    const a = Math.random()*Math.PI*2, r = 12.5 + Math.random()*26;
    pts.push([OX + Math.cos(a)*r, OZ + Math.sin(a)*r, 0.12 + Math.random()*0.25]);
  }
  const grass = new THREE.InstancedMesh(blade, windy(M('#ffffff', { side:THREE.DoubleSide, roughness:0.9 })), pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const tones = ['#6b6a3a', '#57532f', '#7d7444', '#4a4527', '#8a8050'];
  pts.forEach(([x,y,h], i) => {
    q.setFromEuler(e.set((Math.random()-0.5)*0.3, Math.random()*Math.PI, (Math.random()-0.5)*0.3));
    m.compose(ps.set(x-OX, terrainH(x, y) - 0.01, y-OZ), q, sc.set(1, h, 1));
    grass.setMatrixAt(i, m); grass.setColorAt(i, c.set(tones[i % tones.length]));
  });
  scene.add(grass);
}
// Fleurs, rochers, arbres autour du labyrinthe
{
  const n = 260, fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), M('#ffffff', { roughness:0.6 }), n);
  const m = new THREE.Matrix4(), c = new THREE.Color(), cols = ['#b08d3c', '#6d6a62', '#8a7f6a', '#4d4a42'];   // douilles et cailloux
  for (let i=0; i<n; i++) {
    const a = Math.random()*Math.PI*2, r = 12.5 + Math.random()*22;
    m.makeTranslation(Math.cos(a)*r, 0.18 + Math.random()*0.1, Math.sin(a)*r);
    fl.setMatrixAt(i, m); fl.setColorAt(i, c.set(cols[i%4]));
  }
  scene.add(fl);
  const rockMat = M('#8f8a80', { roughness:0.9, flatShading:true });
  for (let i=0; i<26; i++) {
    const a = Math.random()*Math.PI*2, r = 12.5 + Math.random()*20, s = 0.2 + Math.random()*0.6;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(Math.cos(a)*r, s*0.35, Math.sin(a)*r);
    rock.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    rock.scale.y = 0.6; rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
  }
  const trunkMat = M('#2e2620', { roughness:1 }), leafMats = ['#3d4128', '#33361f', '#474a2c'].map(c => M(c, { roughness:0.9, flatShading:true }));   // arbres calcinés
  for (let i=0; i<34; i++) {
    const a = i/34*Math.PI*2 + Math.random()*0.15, r = 15 + Math.random()*18, s = 0.8 + Math.random()*0.8;
    const t = new THREE.Group(); t.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12*s, 0.18*s, 1.6*s, 8), trunkMat);
    trunk.position.y = 0.8*s; trunk.castShadow = true; t.add(trunk);
    for (let k=0; k<3; k++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((0.9 - k*0.15)*s, 0), leafMats[(i+k)%3]);
      leaf.position.set((Math.random()-0.5)*0.5*s, (1.7 + k*0.55)*s, (Math.random()-0.5)*0.5*s);
      leaf.castShadow = true; t.add(leaf);
    }
    scene.add(t);
  }
}

// Décor de guerre autour du labyrinthe : hérissons antichars, cratères, barbelés
{
  const outside = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > 12.4;    // hors de la zone de jeu
  const around = (rMin, rMax) => { for (;;) { const a = Math.random()*Math.PI*2, r = rMin + Math.random()*(rMax-rMin), x = Math.cos(a)*r, z = Math.sin(a)*r; if (outside(x, z)) return [x, z]; } };
  const steel = M('#3b3a36', { metalness:0.6, roughness:0.55 });
  const dummy = new THREE.Object3D(), part = new THREE.Object3D();
  // regroupe des pièces identiques en un seul maillage instancié (un seul appel de dessin)
  const instanced = (geo, mat, list, shadow = true) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = shadow; scene.add(im);
  };
  const beams = [];
  for (let i=0; i<22; i++) {
    const [hx, hz] = around(13.5, 30);
    dummy.position.set(hx, 0.32, hz); dummy.rotation.set(0, Math.random()*3, 0); dummy.updateMatrix();
    for (const [rx, ry, rz] of [[0.95, 0, 0], [-0.95, 0, 0], [0, Math.PI/4, 0.95]]) {
      part.rotation.set(rx, ry, rz); part.updateMatrix();
      beams.push(dummy.matrix.clone().multiply(part.matrix));
    }
  }
  instanced(new THREE.BoxGeometry(0.12, 1.1, 0.12), steel, beams);
  const craterMat = new THREE.MeshStandardMaterial({ color:'#2c261b', roughness:1, transparent:true, opacity:0.85 });
  const rimMat = M('#4a3f2c', { roughness:1, flatShading:true });
  for (let i=0; i<18; i++) {
    const s = 0.6 + Math.random()*1.2, [cx, cz] = around(14 + s, 34);
    const c = new THREE.Mesh(new THREE.CircleGeometry(s, 18), craterMat);
    c.rotation.x = -Math.PI/2; c.position.set(cx, 0.005, cz); scene.add(c);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(s, 0.12*s, 5, 16), rimMat);
    rim.rotation.x = -Math.PI/2; rim.position.copy(c.position); rim.scale.z = 0.5; rim.receiveShadow = true; scene.add(rim);
  }
  // clôture de barbelés tout autour du labyrinthe (carrée, juste à l'extérieur)
  const postMat = M('#3a2e22', { roughness:1 }), wireMat = new THREE.MeshStandardMaterial({ color:'#5a5853', metalness:0.7, roughness:0.4 });
  const E = 12.6, step = 1.8, corners = [[-E,-E],[E,-E],[E,E],[-E,E]], posts = [], wires = [];
  let segLen = 0;
  for (let k=0; k<4; k++) {
    const [x0, z0] = corners[k], [x1, z1] = corners[(k+1)%4], len = Math.hypot(x1-x0, z1-z0), n = Math.round(len/step);
    segLen = len/n;
    for (let i=0; i<n; i++) {
      const t0 = i/n, t1 = (i+1)/n, ax = x0 + (x1-x0)*t0, az = z0 + (z1-z0)*t0, bx = x0 + (x1-x0)*t1, bz = z0 + (z1-z0)*t1;
      dummy.position.set(ax, 0.45, az); dummy.rotation.set(0, 0, (Math.random()-0.5)*0.2); dummy.updateMatrix(); posts.push(dummy.matrix.clone());
      for (const hgt of [0.35, 0.7]) {
        const y = hgt + (Math.random()-0.5)*0.05;
        dummy.position.set((ax+bx)/2, y, (az+bz)/2); dummy.rotation.set(0, 0, 0);
        dummy.lookAt(bx, y, bz); dummy.rotateX(Math.PI/2); dummy.updateMatrix(); wires.push(dummy.matrix.clone());
      }
    }
  }
  instanced(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), postMat, posts);
  instanced(new THREE.CylinderGeometry(0.008, 0.008, segLen, 4), wireMat, wires, false);
}

function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function brickCanvas(bump) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), rnd = seeded(1234);
  g.fillStyle = bump ? '#1a1a1a' : '#4a4944'; g.fillRect(0, 0, S, S); // joints
  const rows = 6, cols = 3, bh = S/rows, bw = S/cols, m = 8;
  const stones = ['#8d8c86', '#7c7b75', '#9a9890', '#6f6e68', '#878680', '#82807a'];   // blocs de béton
  for (let r=0; r<rows; r++) {
    const off = r % 2 ? bw/2 : 0;
    for (let i=-1; i<=cols; i++) {
      const x = i*bw + off, y = r*bh, shade = rnd(), pick = stones[Math.floor(rnd()*stones.length)];
      if (bump) { const v = 190 + shade*50 | 0; g.fillStyle = `rgb(${v},${v},${v})`; }
      else g.fillStyle = pick;
      g.beginPath(); g.roundRect(x + m/2, y + m/2, bw - m, bh - m, 6); g.fill();
      for (let k=0; k<60; k++) { // usure de la pierre
        const px = x + m/2 + rnd()*(bw-m), py = y + m/2 + rnd()*(bh-m), sz = 1 + rnd()*4, v = rnd() < 0.5;
        g.fillStyle = bump ? (v ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.35)') : (v ? 'rgba(255,255,255,.08)' : 'rgba(40,30,20,.15)');
        g.fillRect(px, py, sz, sz);
      }
      if (!bump) { // léger dégradé pour le volume
        const gr = g.createLinearGradient(0, y, 0, y + bh);
        gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,0,0,.12)');
        g.fillStyle = gr; g.fillRect(x + m/2, y + m/2, bw - m, bh - m);
      }
    }
  }
  if (!bump) { // mousse en bas du mur
    for (let k=0; k<500; k++) {
      const px = rnd()*S, py = S - Math.pow(rnd(), 2.2)*S*0.45, r = 2 + rnd()*7;
      g.fillStyle = `rgba(${30+rnd()*20|0},${28+rnd()*18|0},${22+rnd()*12|0},${0.2+rnd()*0.35})`;   // suie et éclats
      g.beginPath(); g.arc(px, py, r, 0, Math.PI*2); g.fill();
    }
  }
  return c;
}
const brickTex = new THREE.CanvasTexture(brickCanvas(false));
brickTex.colorSpace = THREE.SRGBColorSpace; brickTex.anisotropy = 8;
const brickBump = new THREE.CanvasTexture(brickCanvas(true));
// Sacs de sable sur le dessus des murs
const sandbagTex = (() => {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), rnd = seeded(77);
  g.fillStyle = '#5a5236'; g.fillRect(0, 0, S, S);
  for (let r = 0; r < 4; r++) for (let i = -1; i < 3; i++) {
    const x = i*S/2 + (r % 2 ? S/4 : 0), y = r*S/4, v = 0.85 + rnd()*0.25;
    const gr = g.createRadialGradient(x + S/4, y + S/8, 4, x + S/4, y + S/8, S/4);
    gr.addColorStop(0, `rgb(${196*v|0},${178*v|0},${128*v|0})`); gr.addColorStop(1, `rgb(${130*v|0},${116*v|0},${80*v|0})`);
    g.fillStyle = gr; g.beginPath(); g.roundRect(x + 3, y + 3, S/2 - 6, S/4 - 6, 14); g.fill();
    g.strokeStyle = 'rgba(70,60,35,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + S/4, y + 6); g.lineTo(x + S/4, y + S/4 - 6); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const wallSide = M('#ffffff', { map:brickTex, bumpMap:brickBump, bumpScale:2, roughness:0.92 });
const wallTop = M('#ffffff', { map:sandbagTex, roughness:1 });
const wallMats = [wallSide, wallSide, wallTop, wallSide, wallSide, wallSide];
function wallMatrix(x, y) {
  let lo = Infinity;
  for (const [ox, oy] of [[-0.5,-0.5],[0.5,-0.5],[-0.5,0.5],[0.5,0.5],[0,0]]) lo = Math.min(lo, terrainH(x+ox, y+oy));
  const base = lo - 0.05, top = WALL_H + 0.3*terrainH(x, y);
  return new THREE.Matrix4().compose(new THREE.Vector3(x-OX, (top+base)/2, y-OZ), new THREE.Quaternion(), new THREE.Vector3(1, (top-base)/WALL_H, 1));
}
const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_H, 1), wallMats, wallTiles.length);
walls.castShadow = true; walls.receiveShadow = true;
{
  const m = new THREE.Matrix4(), c = new THREE.Color(), dark = new THREE.Color('#cfc6b8');
  wallTiles.forEach(([x,y], i) => {
    walls.setMatrixAt(i, wallMatrix(x, y));
    walls.setColorAt(i, c.set('#ffffff').lerp(dark, Math.random()*0.6));
  });
}
scene.add(walls);
const wallIndex = {};
wallTiles.forEach(([x,y], i) => { wallIndex[x+','+y] = i; });
function restoreWalls() {
  const m = new THREE.Matrix4();
  wallTiles.forEach(([x,y], i) => walls.setMatrixAt(i, wallMatrix(x, y)));
  walls.instanceMatrix.needsUpdate = true;
}
const rubbleGeo = new THREE.DodecahedronGeometry(1, 0), rubbleMat = M('#8f8576', { roughness:0.95, flatShading:true });
const door = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.18, 0.18, 2, 0.08), solidMat('#6b4423', { roughness:0.8, clearcoat:0 }));
door.position.set(10-OX, 0.3, 8-OZ); scene.add(door);


// ---------- Perles, cœurs, bonus ----------
const dotIndex = {};
dotTiles.forEach(([x,y], i) => { dotIndex[x+','+y] = i; });
// les perles sont des cartouches en laiton plantées dans la boue
const dotMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.04, 0.1, 4, 10),
  new THREE.MeshStandardMaterial({ color:'#d4a73a', emissive:'#6b4a10', emissiveIntensity:0.35, metalness:0.85, roughness:0.3 }), dotTiles.length);
dotMesh.castShadow = true; scene.add(dotMesh);
const _m = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0,0,0);
function showAllDots() {
  dotTiles.forEach(([x,y], i) => { _m.makeTranslation(x-OX, 0.3 + terrainH(x, y), y-OZ); dotMesh.setMatrixAt(i, _m); });
  dotMesh.instanceMatrix.needsUpdate = true;
}
function hideDot(x, y) {
  const i = dotIndex[x+','+y]; if (i === undefined) return;
  dotMesh.setMatrixAt(i, _zero); dotMesh.instanceMatrix.needsUpdate = true;
}
const powerMeshes = {};
// les cœurs (+1 vie) sont des trousses de soin
const medkitTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e4d4'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#b8b09a'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  g.fillStyle = '#c62828'; g.fillRect(50, 22, 28, 84); g.fillRect(22, 50, 84, 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const crossGlow = (() => {                    // seule la croix rouge brille
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; g.fillRect(50, 22, 28, 84); g.fillRect(22, 50, 84, 28);
  return new THREE.CanvasTexture(c);
})();
const powerGeo = new RoundedBoxGeometry(0.36, 0.24, 0.26, 2, 0.03);
for (let y=0; y<H; y++) for (let x=0; x<W; x++) if (MAP[y][x]==='o') {
  const m = new THREE.Mesh(powerGeo, M('#ffffff', { map:medkitTex, emissive:'#ff3030', emissiveIntensity:0.45, roughness:0.6 }));
  m.material.emissiveMap = crossGlow;
  m.position.set(x-OX, 0.4, y-OZ); m.castShadow = true;
  scene.add(m); powerMeshes[x+','+y] = m;
}
// bonus : une médaille dorée en forme d'étoile
const starGeo = (() => {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.1 : 0.24, a = i/10*Math.PI*2 - Math.PI/2; i ? sh.lineTo(Math.cos(a)*r, Math.sin(a)*r) : sh.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth:0.05, bevelEnabled:true, bevelSize:0.015, bevelThickness:0.015, bevelSegments:2 });
  g.center(); return g;
})();
const bonusMesh = new THREE.Mesh(starGeo, solidMat('#e8a317', { metalness:0.85, roughness:0.25 }));
bonusMesh.position.set(10-OX, 0.5, 11-OZ); bonusMesh.castShadow = true; bonusMesh.visible = false;
scene.add(bonusMesh);

// ---------- Synchronisation avec la carte vivante ----------
// Le rendu compare G.grid à ce qu'il affiche : perles mangées, cœurs pris, murs détruits.
// Marche à l'identique chez l'hôte et chez l'invité (qui reçoit G.grid par le réseau).
const pristine = (() => {
  const g = MAP.map(r => r.replace('P', ' ').split(''));
  for (const [x,y] of wallTiles) g[y][x] = '#';
  return g;
})();
let shownGen = -1, shown = null, rubble = [];
function breakWall(x, y) {
  const i = wallIndex[x+','+y];
  if (i !== undefined) { walls.setMatrixAt(i, _zero); walls.instanceMatrix.needsUpdate = true; }
  burst(x, y, '#9c8f80', 22, 0.6); burst(x, y, '#6f665a', 12, 0.3);
  for (let k=0; k<8; k++) {
    const r = new THREE.Mesh(rubbleGeo, rubbleMat), sz = 0.04 + Math.random()*0.08;
    r.scale.set(sz, sz*0.7, sz); r.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    r.position.set(x-OX + (Math.random()-0.5)*0.8, sz*0.4 + terrainH(x, y), y-OZ + (Math.random()-0.5)*0.8);
    r.castShadow = true; r.receiveShadow = true; scene.add(r); rubble.push(r);
  }
}
export function syncWorld(G) {
  if (G.gen !== shownGen) {
    shownGen = G.gen;
    restoreWalls(); showAllDots();
    for (const k in powerMeshes) powerMeshes[k].visible = true;
    for (const r of rubble) scene.remove(r);
    rubble = [];
    shown = pristine.map(r => r.slice());
  }
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const was = shown[y][x], now = G.grid[y][x];
    if (was === now) continue;
    if (was === '.') hideDot(x, y);
    else if (was === 'o') powerMeshes[x+','+y].visible = false;
    else if (was === '#') breakWall(x, y);
    shown[y][x] = now;
  }
}
export { wallSide, wallTop, bonusMesh, powerMeshes };
