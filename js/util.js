(function (SF) {
'use strict';
const U = SF.U = {};
U.TAU = Math.PI * 2;
// 兼容旧版浏览器的 roundRect
if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}
U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
U.lerp = (a, b, t) => a + (b - a) * t;
U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
U.choice = arr => arr[(Math.random() * arr.length) | 0];
U.shuffle = arr => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};
// 确定性哈希 -> [0,1)
U.hash = (x, y, s = 0) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
U.fmtTime = s => {
  s = Math.max(0, s | 0);
  return String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
U.fmtNum = n => {
  n = Math.floor(n);
  return n >= 100000 ? (n / 10000).toFixed(1) + '万' : String(n);
};

/* ---------- 存档 ---------- */
const KEY = 'starfall_survivors_v1';
const Save = SF.Save = {};
function defaults() {
  return {
    gold: 0, totalGold: 0, kills: 0, runs: 0, wins: 0, bosses: 0, bestLv: 0, playTime: 0,
    meta: {}, chars: ['aileen'], stages: ['meadow'], best: {}, ach: {},
    set: { sound: true, music: true, vib: true, dmg: true, hq: true, joy: 'float' },
    sel: { stage: 'meadow', char: 'aileen' }
  };
}
Save.defaults = defaults;
Save.data = defaults();
Save.load = function () {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      for (const k in o) {
        if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && d[k]) Object.assign(d[k], o[k]);
        else d[k] = o[k];
      }
    }
  } catch (e) { /* 忽略 */ }
  Save.data = d;
};
Save.save = function () {
  try { localStorage.setItem(KEY, JSON.stringify(Save.data)); } catch (e) { /* 忽略 */ }
};
Save.reset = function () {
  try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
  Save.data = defaults();
};
})(window.SF = window.SF || {});
