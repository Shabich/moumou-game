// Leaderboard de tous les temps : meilleurs scores, enregistrés dans server/data/leaderboard.json.
import fs from 'node:fs';
import path from 'node:path';

const SIZE = 20;

export class Leaderboard {
  constructor(file) {
    this.file = file;
    try { this.entries = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { this.entries = []; }
  }
  // entries : [{ name, score, kills, deaths }] d'une manche ; mode : 'solo' | 'versus'
  add(entries, mode) {
    if (!Array.isArray(entries)) return false;
    const date = new Date().toISOString();
    const clean = entries.slice(0, 6).map(e => ({
      name: String(e?.name ?? '?').trim().slice(0, 14) || '?',
      score: Math.max(0, Math.floor(+e?.score || 0)),
      kills: Math.max(0, Math.floor(+e?.kills || 0)),
      deaths: Math.max(0, Math.floor(+e?.deaths || 0)),
      mode: mode === 'versus' ? 'versus' : 'solo', date,
    })).filter(e => e.score > 0);
    if (!clean.length) return false;
    this.entries = [...this.entries, ...clean].sort((a, b) => b.score - a.score).slice(0, SIZE);
    fs.mkdirSync(path.dirname(this.file), { recursive:true });
    fs.writeFileSync(this.file, JSON.stringify(this.entries, null, 2));
    return true;
  }
  top() { return this.entries; }
}
