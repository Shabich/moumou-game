// Salle de jeu jusqu'à `max` joueurs : le 1er connecté est l'hôte (p1), les suivants des invités (p2, p3...).
// Le serveur ne fait pas tourner le jeu : il relaie l'état de l'hôte vers tous les invités,
// et les commandes de chaque invité vers l'hôte (en indiquant de qui elles viennent).
export class Room {
  constructor({ ips = [], max = 6, log = console.log, onResult = () => {} } = {}) {
    Object.assign(this, { ips, max, log, onResult });
    this.host = null; this.guests = new Map();          // id → socket
  }
  #freeId() { for (let i = 2; i <= this.max; i++) if (!this.guests.has('p' + i)) return 'p' + i; return null; }
  #count() { return (this.host ? 1 : 0) + this.guests.size; }
  join(c, addr) {
    if (!this.host) { c.id = 'p1'; this.host = c; c.send({ t:'role', role:'host', id:'p1', ips:this.ips }); }
    else {
      const id = this.#freeId();
      if (!id) { c.send({ t:'full' }); c.close(); return; }
      c.id = id; this.guests.set(id, c);
      c.send({ t:'role', role:'guest', id });
      this.host.send({ t:'join', id });
    }
    this.log(`connexion ${addr} → ${c.id}${c === this.host ? ' (hôte)' : ''} — ${this.#count()} joueur(s)`);
    c.on('message', msg => c === this.host ? this.#fromHost(msg) : this.#fromGuest(c, msg));
    c.on('close', () => this.#leave(c));
  }
  #fromHost(msg) {
    if (msg.startsWith('{"t":"result"')) { try { this.onResult(JSON.parse(msg)); } catch {} return; }
    for (const g of this.guests.values()) g.send(msg);   // état de la partie → tous les invités
  }
  #fromGuest(c, msg) {
    try { JSON.parse(msg); } catch { return; }           // on ne relaie que du JSON valide
    this.host?.send(`{"t":"from","id":"${c.id}","m":${msg}}`);
  }
  #leave(c) {
    if (c === this.host) {
      // sans hôte la partie s'arrête : les invités rechargent, le premier revenu devient hôte
      this.host = null;
      for (const g of this.guests.values()) g.send({ t:'hostgone' });
      this.guests.clear();
    } else if (this.guests.get(c.id) === c) {
      this.guests.delete(c.id);
      this.host?.send({ t:'leave', id:c.id });
    } else return;
    this.log(`déconnexion ${c.id} — ${this.#count()} joueur(s)`);
  }
  broadcast(msg) { this.host?.send(msg); for (const g of this.guests.values()) g.send(msg); }
}
