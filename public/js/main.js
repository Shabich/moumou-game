// Point d'entrée : branche la simulation, le rendu, l'interface et le réseau, puis lance la boucle.
import { G } from './core/state.js';
import { on } from './core/events.js';
import * as game from './game/game.js';
import { render, resize } from './gfx/render.js';
import { handleFx } from './gfx/fx.js';
import { handleAudio } from './audio.js';
import { hud, handleHudEvent } from './ui/hud.js';
import { drawMinimap } from './ui/minimap.js';
import { bindInput, updateControls } from './ui/input.js';
import { bindIntro, savedName } from './ui/intro.js';
import { startNet, netTick, local, isGuest, net } from './net/client.js';
import { canStart } from './core/state.js';

const present = (type, args) => { handleFx(type, args); handleAudio(type, args); handleHudEvent(type, args); };
on(present);                                   // événements de notre propre simulation
const name = savedName();
startNet({ name, onEvent: present });          // événements relayés par l'hôte (côté invité)

game.init(name);
// lu par dev/livereload.js : ne pas recharger la page pendant une manche à plusieurs
window.moumouBusy = () => (net.peers > 0 || isGuest()) && !canStart();
bindInput();
bindIntro();                                   // écran d'accueil : choix du pseudo
resize(); addEventListener('resize', resize);

let last = performance.now();
function frame(now) {
  const dt = Math.min(1/30, (now - last)/1000); last = now;
  updateControls(dt);
  if (!isGuest()) game.step(dt);               // les invités ne simulent pas : ils affichent l'état reçu
  const me = local();
  render(G, me, now/1000, dt);
  if (me.view === 'fp') drawMinimap(G, me, now/1000);
  hud(G, me);
  netTick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
