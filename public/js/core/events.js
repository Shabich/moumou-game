// Bus d'événements : la simulation annonce ce qui se passe (sons, particules, textes...)
// sans savoir qui l'affiche. Le rendu local s'y abonne, l'hôte les relaie aussi à l'invité.
const handlers = new Set();
export const on = h => { handlers.add(h); return () => handlers.delete(h); };
export function emit(type, ...args) { for (const h of handlers) h(type, args); }
