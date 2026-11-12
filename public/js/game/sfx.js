// Raccourcis utilisés par la simulation pour annoncer sons et effets visuels (voir core/events.js).
import { emit } from '../core/events.js';

export const beep = (f, d, type = 'sine', v = 0.06, slide = 0) => emit('beep', f, d, type, v, slide);
export const noise = (f0, f1, dur, gain, type = 'lowpass') => emit('noise', f0, f1, dur, gain, type);
export const sound = name => emit('sound', name);            // 'bang' | 'whoosh'
export const boing = (f = 300) => beep(f, .25, 'sine', .07, f*2.2);
export const later = (ms, fn) => setTimeout(fn, ms);

export const burst = (x, y, color, n, h = 0.4) => emit('burst', x, y, color, n, h);
export const popup = (x, y, text) => emit('popup', x, y, text);
export const smoke = (x, y, h, size, life) => emit('smoke', x, y, h, size, life);
export const explosion = (x, y) => emit('explosion', x, y);
export const slashFx = (x, y, a) => emit('slash', x, y, a);
export const shake = t => emit('shake', t);
