// Géométrie statique du niveau, calculée une fois depuis la carte : cases accessibles, relief, murs, perles.
import { MAP, W, H, DIRS } from './config.js';

// Cases accessibles depuis le départ (les murs détruits y sont ajoutés en cours de partie)
export const reach = (() => {
  const seen = new Set(['10,15']), q = [[10,15]];
  while (q.length) {
    const [x,y] = q.shift();
    for (const d of DIRS) {
      const nx = (x+d.x+W)%W, ny = y+d.y;
      if (ny<0 || ny>=H || MAP[ny][nx]==='#' || seen.has(nx+','+ny)) continue;
      seen.add(nx+','+ny); q.push([nx,ny]);
    }
  }
  return seen;
})();
export const initialReach = new Set(reach);
export const isReach = (x,y) => initialReach.has(x+','+y);

// Relief : collines dans les passages (coordonnées de la grille → hauteur)
const HILLS = [ // x, y, hauteur, largeur
  [3, 3, 0.8, 2.0], [17, 3, 0.65, 2.0], [10, 19, 0.85, 2.6], [4, 16, 0.55, 1.8],
  [16, 15, 0.7, 2.0], [10, 4.5, 0.5, 1.6], [1.5, 12, 0.45, 1.5], [18.5, 12, 0.45, 1.5], [7, 13, 0.35, 1.3],
];
export function terrainH(gx, gy) {
  let h = 0;
  for (const [cx, cy, a, sg] of HILLS) h += a*Math.exp(-((gx-cx)**2 + (gy-cy)**2)/(sg*sg));
  h += 0.05*(1 + Math.sin(gx*0.9)*Math.cos(gy*0.7));                  // petites ondulations
  const hd = Math.hypot(gx-10, (gy-8.7)*1.2);                           // maison des monstres à plat
  h *= Math.min(1, Math.max(0, (hd-2.2)/1.5));
  const edge = Math.min(gx+1, W-gx, gy+1, H-gy);                        // rejoint la prairie au bord
  h *= Math.min(1, Math.max(0, edge/1.5));
  return h;
}

// Murs : les '#' et les zones fermées inaccessibles
export const wallTiles = [];
for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
  if (MAP[y][x]==='#' || (MAP[y][x]===' ' && !isReach(x,y))) wallTiles.push([x,y]);
}
export const dotTiles = [];
for (let y=0; y<H; y++) for (let x=0; x<W; x++) if (MAP[y][x]==='.') dotTiles.push([x,y]);
