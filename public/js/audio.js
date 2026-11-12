// Sons synthétisés (WebAudio). Le contexte audio ne démarre qu'après un geste de l'utilisateur.
let AC = null, noiseBuf = null;
export const audio = { muted: false };

export function initAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext||window.webkitAudioContext)();
      noiseBuf = AC.createBuffer(1, AC.sampleRate*0.3, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i=0; i<d.length; i++) d[i] = Math.random()*2-1;
    } catch(e) {}
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
export function beep(f, d, type='sine', v=0.06, slide=0) {
  if (!AC || audio.muted) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t+d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t+d);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t+d);
}
export function noiseHit(f0, f1, dur, gain, type = 'lowpass') {
  if (!AC || audio.muted || !noiseBuf) return;
  const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t+dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t+dur+0.05);
}
function bang() {
  if (!AC || audio.muted || !noiseBuf) return;
  const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(300, t+0.2);
  g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.22);
  s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t+0.25);
  beep(140, 0.12, 'square', 0.05, 50);
}
const SOUNDS = {
  bang,
  boom: () => { noiseHit(1000, 70, 1.2, 0.7); beep(70, 0.9, 'sine', 0.3, 28); },
  whoosh: () => { noiseHit(1600, 300, 0.6, 0.25, 'bandpass'); beep(160, 0.25, 'sawtooth', 0.05, 60); },
};

// Abonné au bus d'événements de la simulation
export function handleAudio(type, args) {
  if (type === 'beep') beep(...args);
  else if (type === 'noise') noiseHit(...args);
  else if (type === 'sound') SOUNDS[args[0]]?.();
  else if (type === 'explosion') SOUNDS.boom();
}
