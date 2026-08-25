// Loud kitchen alert generated with the Web Audio API (no external assets).
let ctx = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return true;
}

function ding(at, volume, freq) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const osc2 = ctx.createOscillator();
  osc.type = "square";
  osc2.type = "triangle";
  osc.frequency.value = freq;
  osc2.frequency.value = freq * 2;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.34);
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc2.start(at);
  osc.stop(at + 0.36);
  osc2.stop(at + 0.36);
}

// DING DING DING — loud, cuts through kitchen noise
export function playAlert({ volume = 0.9, repeat = 1 } = {}) {
  if (!unlockAudio()) return;
  const v = Math.min(1, Math.max(0.05, volume));
  const t0 = ctx.currentTime + 0.02;
  const cycle = 1.3;
  for (let r = 0; r < Math.max(1, repeat); r++) {
    const base = t0 + r * cycle;
    ding(base, v, 1180);
    ding(base + 0.32, v, 1180);
    ding(base + 0.64, v * 0.95, 1480);
  }
}

export function playTestBeep(volume = 0.8) {
  if (!unlockAudio()) return;
  ding(ctx.currentTime + 0.02, Math.min(1, volume), 1320);
}
