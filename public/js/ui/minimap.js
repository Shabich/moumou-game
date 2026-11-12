// Minimap (vue 1re personne) : carte, perles, caisses, monstres et le joueur local (les adversaires restent cachés).
import { W, H, ENEMY_COLORS, FRIGHT_COLOR } from '../core/config.js';
import { pos, playerPos } from '../core/state.js';
import { initialReach, terrainH } from '../core/terrain.js';

const mm = document.getElementById('minimap'), mctx = mm.getContext('2d');
const MS = 9, MPAD = 6, MDPR = Math.min(2, devicePixelRatio || 1), MW = W*MS + MPAD*2;
mm.width = mm.height = MW * MDPR;
mctx.scale(MDPR, MDPR);
const mmBase = document.createElement('canvas');
mmBase.width = mmBase.height = MW * MDPR;
{
  const g = mmBase.getContext('2d'); g.scale(MDPR, MDPR);
  g.fillStyle = '#4f4a2c'; g.beginPath(); g.roundRect(0, 0, MW, MW, 10); g.fill();
  for (const k of initialReach) {
    const [x,y] = k.split(',').map(Number), hh = terrainH(x, y);
    g.fillStyle = `hsl(30, ${24 - hh*8}%, ${30 + hh*22}%)`; g.fillRect(MPAD + x*MS, MPAD + y*MS, MS, MS);
  }
  g.fillStyle = '#e8a317'; g.fillRect(MPAD + 10*MS + 1, MPAD + 8*MS + MS/2 - 1, MS-2, 2);
}
const cx = x => MPAD + x*MS + MS/2, cy = y => MPAD + y*MS + MS/2;
function arrow(p, color) {
  const pp = playerPos(p), a = p.view === 'fp' ? Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw)) : Math.atan2(p.face.y, p.face.x);
  mctx.save(); mctx.translate(cx(pp.x), cy(pp.y)); mctx.rotate(a);
  mctx.fillStyle = color; mctx.strokeStyle = '#2f2a22'; mctx.lineWidth = 1.5;
  mctx.beginPath(); mctx.moveTo(6, 0); mctx.lineTo(-4, 4.5); mctx.lineTo(-2, 0); mctx.lineTo(-4, -4.5); mctx.closePath();
  mctx.fill(); mctx.stroke();
  mctx.restore();
}
export function drawMinimap(G, me, time) {
  mctx.clearRect(0, 0, MW, MW);
  mctx.drawImage(mmBase, 0, 0, MW, MW);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    if (G.grid[y][x] === '#') { mctx.fillStyle = (x+y) % 2 ? '#8d8c86' : '#7c7b75'; mctx.beginPath(); mctx.roundRect(MPAD + x*MS + 0.5, MPAD + y*MS + 0.5, MS-1, MS-1, 2.5); mctx.fill(); }
  }
  for (const k of G.destroyed) { const [x,y] = k.split(',').map(Number); mctx.fillStyle = '#a08a70'; mctx.fillRect(MPAD + x*MS, MPAD + y*MS, MS, MS); }
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const c = G.grid[y][x];
    if (c === '.') { mctx.fillStyle = '#d4a73a'; mctx.fillRect(cx(x)-1, cy(y)-1, 2, 2); }
    else if (c === 'o') { mctx.fillStyle = '#d81b2c'; mctx.beginPath(); mctx.arc(cx(x), cy(y), 2.6 + Math.sin(time*6), 0, Math.PI*2); mctx.fill(); }
  }
  for (const c of G.crates) { mctx.fillStyle = c.type === 'ammo' ? '#4a4720' : '#ffd24a'; mctx.strokeStyle = '#c9a14a'; mctx.lineWidth = 1; mctx.fillRect(cx(c.x)-3, cy(c.y)-2.5, 6, 5); mctx.strokeRect(cx(c.x)-3, cy(c.y)-2.5, 6, 5); }
  if (G.bonus) { mctx.fillStyle = '#e8a317'; mctx.beginPath(); mctx.arc(cx(G.bonus.x), cy(G.bonus.y), 3, 0, Math.PI*2); mctx.fill(); }
  for (const b of G.bullets) { mctx.fillStyle = '#ffe08a'; mctx.fillRect(cx(b.x)-1, cy(b.y)-1, 2, 2); }
  for (const e of G.enemies) {
    if (e.mode === 'dead') continue;
    const ep = pos(e);
    mctx.fillStyle = e.mode === 'fright' ? FRIGHT_COLOR : ENEMY_COLORS[e.kind];
    mctx.strokeStyle = '#2f2a22'; mctx.lineWidth = 1;
    mctx.beginPath(); mctx.arc(cx(ep.x), cy(ep.y), 3.6, 0, Math.PI*2); mctx.fill(); mctx.stroke();
  }
  // seul le joueur local apparaît : la position des adversaires reste secrète
  if (!me.dead) arrow(me, '#ffffff');
}
