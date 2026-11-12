// Moteur 3D : renderer, scène, caméra, lumières et matériaux de base.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, H } from '../core/config.js';
import { isReach } from '../core/terrain.js';

export { THREE };
export const stage = document.getElementById('stage');
export const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.domElement.className = 'gl';
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.prepend(renderer.domElement);

const SKY = '#a9ad9b';                    // ciel brumeux de champ de bataille
export const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 34, 80);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
scene.add(camera);
scene.add(new THREE.HemisphereLight('#d9dccb', '#4a4430', 0.85));
const sun = new THREE.DirectionalLight('#ffe2b8', 2.1);
sun.position.set(-8, 24, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-16, right:16, top:16, bottom:-16, near:1, far:70 });
sun.shadow.bias = -0.0005;
sun.shadow.radius = 3;
scene.add(sun);

export const uTime = { value:0 };
export const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness:0.75, ...o });

// ---------- Textures procédurales ----------
export function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

export const grassTex = canvasTex(512, (g, S) => {
  g.fillStyle = '#58522f'; g.fillRect(0, 0, S, S);
  for (let i=0; i<40; i++) {                                // plaques de boue
    g.fillStyle = `rgba(${60+Math.random()*20|0},${48+Math.random()*12|0},${30+Math.random()*10|0},.5)`;
    g.beginPath(); g.ellipse(Math.random()*S, Math.random()*S, 10+Math.random()*40, 6+Math.random()*24, Math.random()*3, 0, Math.PI*2); g.fill();
  }
  const greens = ['#6b6a3a', '#4f4a2a', '#7a7344', '#5a5230', '#857a4a', '#3f3a22'];   // herbe sèche
  for (let i=0; i<9000; i++) {
    const x = Math.random()*S, y = Math.random()*S, l = 3 + Math.random()*9;
    g.strokeStyle = greens[i % greens.length]; g.globalAlpha = 0.5 + Math.random()*0.5;
    g.lineWidth = 0.8 + Math.random()*1.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random()-0.5)*4, y - l); g.stroke();
  }
  g.globalAlpha = 1;
}, 70);
export const pathTex = canvasTex(1024, (g, S) => {
  const ts = S/(W+2), c = (v) => (v+1.5)*ts;
  g.save();
  g.filter = 'blur(7px)';
  g.strokeStyle = '#5e4a33'; g.lineCap = 'round'; g.lineWidth = ts*0.78;   // pistes de boue
  g.beginPath();
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) if (isReach(x,y)) {
    g.moveTo(c(x), c(y)); g.lineTo(c(x)+0.1, c(y));
    if (x+1 < W && isReach(x+1,y)) { g.moveTo(c(x), c(y)); g.lineTo(c(x+1), c(y)); }
    if (isReach(x,y+1)) { g.moveTo(c(x), c(y)); g.lineTo(c(x), c(y+1)); }
  }
  g.stroke();
  g.restore();
  // grain de la terre + cailloux
  g.globalCompositeOperation = 'source-atop';
  for (let i=0; i<14000; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(40,30,20,.4)' : 'rgba(150,125,90,.25)';
    g.fillRect(Math.random()*S, Math.random()*S, 1.5, 1.5);
  }
  for (let i=0; i<700; i++) {
    const x = Math.random()*S, y = Math.random()*S, r = 1 + Math.random()*3;
    g.fillStyle = ['#6d6458', '#4f463c', '#857a68', '#3d342a'][i%4];
    g.beginPath(); g.ellipse(x, y, r, r*0.75, Math.random()*3, 0, Math.PI*2); g.fill();
  }
});

// ---------- Matériaux & vent ----------
export const solidMat = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness:0.5, clearcoat:0.25, clearcoatRoughness:0.5, sheen:0.4, sheenColor:'#ffffff', ...extra,
});
