// Constantes du jeu : carte, règles, armes. Aucune dépendance.

export const MAP = [
  "#####################",
  "#.........#.........#",
  "#o###.###.#.###.###o#",
  "#...................#",
  "#.###.#.#####.#.###.#",
  "#.....#...#...#.....#",
  "#####.### # ###.#####",
  "    #.#       #.#    ",
  "#####.# ##-## #.#####",
  "     .  #GGG#  .     ",
  "#####.# ##### #.#####",
  "    #.#       #.#    ",
  "#####.# ##### #.#####",
  "#.........#.........#",
  "#.###.###.#.###.###.#",
  "#o..#.....P.....#..o#",
  "###.#.#.#####.#.#.###",
  "#.....#...#...#.....#",
  "#.#######.#.#######.#",
  "#...................#",
  "#####################",
];
export const W = 21, H = 21, OX = (W-1)/2, OZ = (H-1)/2;
export const DIRS = [{x:0,y:-1},{x:-1,y:0},{x:0,y:1},{x:1,y:0}];
export const CORNERS = [{x:W-2,y:-2},{x:1,y:-2},{x:W-1,y:H+1},{x:0,y:H+1}];
export const SCHEDULE = [7, 20, 7, 20, 5, Infinity];
export const GAME_SPEED = 0.25;           // ralenti global du jeu
export const ENEMY_COLORS = ['#c8102e', '#5b2a86', '#1f8fd6', '#f07c1a'];
export const FRIGHT_COLOR = '#a9c3d6';
export const WALL_H = 1.0;
export const START_AMMO = 6, CRATE_AMMO = 6;
export const TURN_SPEED = 2.6, PLAYER_R = 0.26, MAX_HEARTS = 3, INVULN = 2.5;
export const SLASH_TIME = 0.3, SLASH_RANGE = 1.35;

export const WEAPONS = {
  rifle:   { name:'Fusil',        cd:0.30,  speed:16, recoil:1.0,  flash:0.07, max:30 },
  glock:   { name:'Double Glock', cd:0.13,  speed:15, recoil:0.6,  flash:0.05, max:120, drop:40 },
  minigun: { name:'Minigun',      cd:0.065, speed:18, recoil:0.35, flash:0.04, max:400, drop:150, spread:0.06 },
  bazooka: { name:'Bazooka',      cd:1.0,   speed:12, recoil:1.6,  flash:0.12, max:9,   drop:2, rocket:true },
  katana:  { name:'Katana',       cd:0.45,  recoil:0, flash:0, melee:true },
};
export const WEAPON_ORDER = ['rifle', 'glock', 'minigun', 'bazooka', 'katana'];
export const DROP_TYPES = ['glock', 'minigun', 'bazooka'];

// Joueurs (6 max) : point de départ et couleurs. p1 est l'hôte (ou le joueur solo).
export const PLAYERS = {
  p1: { spawn:[10, 15], shirt:'#5b6b3a', helmet:'#4a5530', color:'#7cb342' },
  p2: { spawn:[19, 19], shirt:'#2f6fb3', helmet:'#1f4f86', color:'#42a5f5' },
  p3: { spawn:[1, 19],  shirt:'#b3402f', helmet:'#86281f', color:'#ef5350' },
  p4: { spawn:[19, 1],  shirt:'#7b4fb3', helmet:'#55308a', color:'#ab47bc' },
  p5: { spawn:[1, 1],   shirt:'#c58a1d', helmet:'#8a5f12', color:'#ffa726' },
  p6: { spawn:[9, 13],  shirt:'#2a8f86', helmet:'#1c635d', color:'#26a69a' },
};
export const MAX_PLAYERS = Object.keys(PLAYERS).length;

// Affrontement (2 joueurs ou plus)
export const MATCH_TIME = 180;            // durée d'une manche (s)
export const RESPAWN_TIME = 3;            // délai avant de revenir en jeu (s)
export const PVP_INVULN = 1.0;            // invulnérabilité après un tir reçu (s)
export const KILL_POINTS = 300;           // points pour avoir éliminé un joueur
export const MAX_ENEMIES = 8;             // 4 en solo, +2 par joueur en plus
