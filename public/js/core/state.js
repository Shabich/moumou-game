// État de la partie : un seul objet sérialisable (c'est lui que l'hôte envoie à l'invité).
import { W, H, MAP, MAX_HEARTS, START_AMMO, PLAYERS, MATCH_TIME } from './config.js';

export const G = {
  grid: MAP.map(r => r.split('')),   // carte vivante : '.' perle, 'o' cœur, '#' mur, ' ' vide, '-'/'G' maison
  gen: 0,                            // incrémenté à chaque remise à zéro de la carte
  dots: 0, dotsEaten: 0,
  level: 1,
  state: 'title', stateT: 0, paused: false,
  viewMode: 'top',                   // vue de la partie, choisie avant de lancer et commune à tous
  timeLeft: MATCH_TIME,              // compte à rebours d'une manche en affrontement
  results: null,                     // classement final de la dernière manche
  players: [],                       // un objet joueur par participant (voir makePlayer)
  enemies: [],
  globalMode: 'scatter', modeIdx: 0, modeT: 0, frightT: 0, combo: 0, freezeT: 0,
  bonus: null,                       // { x, y, t }
  bullets: [], crates: [], crateT: 0, rocketT: 0,
  destroyed: [],                     // murs détruits "x,y"
  eat: null,                         // { slot, from:{x,y}, who } pendant la cinématique « Dévoré »
  nextId: 1,
};

// Un joueur : position sur la grille (vue de dessus) ou libre (vue 1re personne), arsenal et minuteries.
export const idleCtl = () => ({ fwd:false, left:false, right:false, fire:false });
export function makePlayer(id, name) {
  const p = { id, name: name || 'Joueur ' + id.slice(1), view:'top', ctl:idleCtl() };
  resetBody(p); resetArsenal(p); resetScore(p);
  return p;
}
export function resetScore(p) { Object.assign(p, { score:0, kills:0, deaths:0, lives:MAX_HEARTS, dead:false, respawnT:0, killedBy:null }); }
export function resetBody(p, spawn = PLAYERS[p.id].spawn) {
  const [cx, cy] = spawn;
  Object.assign(p, { cx, cy, dir:{x:0,y:0}, want:null, t:0, face:{x:0,y:-1}, walk:0, moving:false,
    px:cx, py:cy, yaw:Math.PI, spin:0, inv:0, fireCd:0, recoil:0, flashT:0, slashT:0, spinV:0, hurtT:0, glockSide:1 });
}
export function resetArsenal(p) {
  p.weapon = 'rifle';
  p.owned = { rifle:true, katana:true };
  p.ammo = { rifle:START_AMMO, glock:0, minigun:0, bazooka:0 };
}
export const playerById = id => G.players.find(p => p.id === id);
export const isVersus = () => G.players.length > 1;
export const alivePlayers = () => G.players.filter(p => !p.dead);
export const ranking = () => [...G.players].sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths)
  .map(p => ({ id:p.id, name:p.name, score:p.score, kills:p.kills, deaths:p.deaths }));

export function setState(s) { G.state = s; G.stateT = 0; }
export const canStart = () => G.state === 'title' || G.state === 'over';

// ---- Aides sur la grille ----
export const wrapX = x => (x + W) % W;
export const cell = (x,y) => (y<0||y>=H) ? '#' : G.grid[y][wrapX(x)];
export function passable(x, y, e) {
  const c = cell(x,y);
  if (c === '#') return false;
  if (c === '-' || c === 'G') return !!(e && e.door);
  return true;
}
export const pos = e => ({ x: e.cx + e.dir.x*e.t, y: e.cy + e.dir.y*e.t });
export const playerPos = p => p.view === 'fp' ? { x:p.px, y:p.py } : pos(p);
export const faceAngle = d => Math.atan2(d.x, d.y);
export const aimAngle = p => p.view === 'fp' ? p.yaw : faceAngle(p.face);
export const wrapDist2 = (a, b) => { let dx = a.x-b.x; if (Math.abs(dx) > W/2) dx -= Math.sign(dx)*W; const dy = a.y-b.y; return dx*dx + dy*dy; };
