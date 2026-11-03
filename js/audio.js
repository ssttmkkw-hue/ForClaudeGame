/* 程序合成音效与背景音乐（无需任何音频资源） */
(function (SF) {
'use strict';
const A = SF.Audio = {};
let ctx = null, master = null, sfxGain = null, musGain = null, noiseBuf = null;
let soundOn = true, musicOn = true;
const last = {};
const GAP = { hit: 0.05, kill: 0.04, shoot: 0.08, gem: 0.04, coin: 0.05, lightning: 0.1, explode: 0.08, hurt: 0.15 };

A.init = function () {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
    musGain = ctx.createGain(); musGain.gain.value = 0.22; musGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
};
A.resume = function () {
  if (!ctx) A.init();
  if (ctx && ctx.state === 'suspended') ctx.resume();
};
A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
A.set = function (sound, music) {
  soundOn = sound; musicOn = music;
  if (ctx) { sfxGain.gain.value = soundOn ? 0.5 : 0; musGain.gain.value = musicOn ? 0.22 : 0; }
};

function tone(freq, dur, type, vol, slide, delay) {
  const t = ctx.currentTime + (delay || 0);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, delay) {
  const t = ctx.currentTime + (delay || 0);
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  s.buffer = noiseBuf;
  f.type = 'lowpass'; f.frequency.value = freq || 2000;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxGain);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const SFX = {
  ui:        () => tone(660, 0.07, 'triangle', 0.25, 1.4),
  back:      () => tone(440, 0.08, 'triangle', 0.22, 0.7),
  shoot:     () => tone(520, 0.09, 'square', 0.07, 1.8),
  hit:       () => noise(0.05, 0.12, 3000),
  kill:      () => { tone(260, 0.1, 'square', 0.08, 0.5); noise(0.08, 0.1, 1500); },
  gem:       () => tone(900 + Math.random() * 300, 0.08, 'sine', 0.16, 1.5),
  coin:      () => { tone(1200, 0.06, 'square', 0.1); tone(1600, 0.1, 'square', 0.1, 1, 0.05); },
  hurt:      () => { tone(160, 0.2, 'sawtooth', 0.25, 0.5); noise(0.15, 0.2, 800); },
  explode:   () => { noise(0.35, 0.35, 900); tone(90, 0.3, 'sine', 0.3, 0.4); },
  lightning: () => { noise(0.14, 0.2, 5000); tone(1400, 0.12, 'sawtooth', 0.07, 0.3); },
  heal:      () => { tone(520, 0.1, 'sine', 0.2); tone(780, 0.14, 'sine', 0.2, 1, 0.08); },
  levelup:   () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.25, 1, i * 0.08)); },
  pick:      () => { tone(784, 0.1, 'triangle', 0.25); tone(1047, 0.18, 'triangle', 0.25, 1, 0.08); },
  chest:     () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.12, 1, i * 0.07)); },
  boss:      () => { tone(110, 0.9, 'sawtooth', 0.3, 0.6); tone(165, 0.9, 'sawtooth', 0.2, 0.6, 0.05); noise(0.6, 0.2, 400); },
  warn:      () => { tone(300, 0.15, 'square', 0.12); tone(300, 0.15, 'square', 0.12, 1, 0.25); },
  win:       () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.28, 1, i * 0.12)); },
  lose:      () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.2, 0.9, i * 0.18)); },
  magnet:    () => tone(300, 0.4, 'sine', 0.25, 4),
  nova:      () => { tone(300, 0.4, 'sine', 0.2, 2.5); noise(0.3, 0.1, 6000); },
  beam:      () => { tone(900, 0.25, 'sawtooth', 0.1, 0.3); },
  slam:      () => { noise(0.25, 0.25, 600); tone(70, 0.25, 'sine', 0.3, 0.5); }
};

A.sfx = function (name) {
  if (!ctx || !soundOn || ctx.state !== 'running') return;
  const now = ctx.currentTime, g = GAP[name] || 0;
  if (g && last[name] && now - last[name] < g) return;
  last[name] = now;
  const f = SFX[name];
  if (f) { try { f(); } catch (e) { /* 忽略 */ } }
};

/* ---------------- 背景音乐 ---------------- */
// 和弦根音（半音偏移，基准 A2=110Hz）：Am F C G 之类的循环
const PROG = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
const SETS = {
  menu:   { bpm: 84,  lead: 0.5, drums: false, base: 0 },
  battle: { bpm: 112, lead: 0.7, drums: true,  base: 0 },
  boss:   { bpm: 138, lead: 0.9, drums: true,  base: -5 }
};
let mus = { kind: null, timer: null, step: 0, next: 0 };
const mtof = n => 110 * Math.pow(2, n / 12);

function mTone(freq, t, dur, type, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function mNoise(t, dur, vol, freq) {
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(musGain);
  s.start(t); s.stop(t + dur + 0.02);
}
function scheduleStep(set, step, t) {
  const bar = (step / 16) | 0, s = step % 16;
  const ch = PROG[bar % PROG.length], root = ch[0] + set.base;
  const dur = 60 / set.bpm / 4;
  if (s % 4 === 0) mTone(mtof(root - 12), t, dur * 3.6, 'triangle', 0.5);
  // 琶音
  const arp = [0, 1, 2, 1, 2, 1, 0, 2];
  const note = ch[arp[s % 8]] + set.base + (s % 8 > 3 ? 12 : 0) + 12;
  if (s % 2 === 0 || set.drums) mTone(mtof(note), t, dur * 1.8, 'square', 0.07 * set.lead);
  if (set.drums) {
    if (s % 8 === 0 || s % 8 === 6) { mTone(120, t, 0.1, 'sine', 0.7); }
    if (s % 8 === 4) mNoise(t, 0.12, 0.35, 1500);
    if (s % 2 === 1) mNoise(t, 0.03, 0.12, 7000);
  }
}
function tick() {
  if (!ctx || !mus.kind) return;
  const set = SETS[mus.kind];
  const stepDur = 60 / set.bpm / 4;
  if (mus.next < ctx.currentTime) mus.next = ctx.currentTime + 0.05;
  while (mus.next < ctx.currentTime + 0.35) {
    scheduleStep(set, mus.step++, mus.next);
    mus.next += stepDur;
  }
}
A.music = function (kind) {
  if (mus.kind === kind) return;
  mus.kind = kind; mus.step = 0; mus.next = 0;
  if (kind && !mus.timer) mus.timer = setInterval(tick, 120);
  if (!kind && mus.timer) { clearInterval(mus.timer); mus.timer = null; }
};
})(window.SF = window.SF || {});
