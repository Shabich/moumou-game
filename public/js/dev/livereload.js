// Rechargement automatique en développement (uniquement sur localhost) : le serveur prévient quand un fichier change.
// Pendant une manche à plusieurs, on ne recharge pas (ça couperait la partie de tout le monde) :
// un bandeau l'annonce et le rechargement attend la fin de la manche.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  let pending = false, banner = null;
  const busy = () => typeof window.moumouBusy === 'function' && window.moumouBusy();
  const tryReload = () => {
    if (!busy()) { location.reload(); return; }
    if (!banner) {
      banner = document.createElement('div');
      banner.textContent = 'Nouvelle version du jeu prête : elle se chargera à la fin de la manche';
      banner.style.cssText = 'position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:20;padding:6px 14px;' +
        'background:#2b2f1e;color:#e3dcc0;border:1px solid #57603a;border-radius:4px;font:600 13px Oswald,system-ui,sans-serif;pointer-events:none';
      document.body.append(banner);
    }
    setTimeout(tryReload, 1000);
  };
  const es = new EventSource('/__livereload');
  es.onmessage = e => { if (e.data === 'reload' && !pending) { pending = true; tryReload(); } };
}
