// Écran d'accueil : le joueur choisit son pseudo avant d'entrer dans la partie.
// Il réapparaît quand on clique sur son nom dans le bandeau, pour en changer.
import { initAudio } from '../audio.js';
import { act } from '../net/client.js';

const KEY = 'moumou-name';
const intro = document.getElementById('intro'), form = document.getElementById('introForm');
const input = document.getElementById('pseudo'), who = document.getElementById('who');

export function savedName() {
  try { return localStorage.getItem(KEY) || localStorage.getItem('luciole-name') || ''; } catch { return ''; }
}
export const introOpen = () => !intro.hidden;

function open() {
  intro.hidden = false;
  input.value = savedName();
  setTimeout(() => { input.focus(); input.select(); }, 0);
}
function submit(e) {
  e.preventDefault();
  const name = input.value.trim().replace(/\s+/g, ' ').slice(0, 14);
  if (!name) { input.focus(); form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
  try { localStorage.setItem(KEY, name); } catch {}
  act('name', name);
  who.textContent = name;
  intro.hidden = true;
  initAudio();                       // le clic/Entrée compte comme geste utilisateur pour l'audio
}

export function bindIntro() {
  form.addEventListener('submit', submit);
  who.addEventListener('click', open);
  who.textContent = savedName() || '—';
  open();
}
