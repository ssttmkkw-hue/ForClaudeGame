/* 所有美术均由 Canvas 矢量绘制并预烘焙，无外部素材 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU;
const Sp = SF.Sprites = {};
const S = 2; // 烘焙倍率
Sp.S = S;
const OUT = 'rgba(12,10,24,.6)';

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
function circ(c, x, y, r, fill, stroke, lw) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
}
function ell(c, x, y, rx, ry, fill, rot) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  c.fillStyle = fill; c.fill();
}
function eye(c, x, y, r, look) {
  circ(c, x, y, r, '#fff');
  circ(c, x + (look || 0) * r * 0.3, y + r * 0.1, r * 0.55, '#16121f');
}
function poly(c, pts, fill, stroke, lw) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.lineJoin = 'round'; c.stroke(); }
}

/* ------------------------- 敌人形状 ------------------------- */
const SHAPES = {
  slime(c, R, c1, c2) {
    c.beginPath(); c.moveTo(-R, R * .55);
    c.bezierCurveTo(-R * 1.1, -R * 1.0, R * 1.1, -R * 1.0, R, R * .55);
    c.quadraticCurveTo(0, R * 1.0, -R, R * .55);
    c.fillStyle = c1; c.fill(); c.strokeStyle = OUT; c.lineWidth = R * .13; c.stroke();
    ell(c, -R * .38, -R * .42, R * .3, R * .16, 'rgba(255,255,255,.55)', -.5);
    eye(c, -R * .3, -R * .02, R * .22, 0); eye(c, R * .3, -R * .02, R * .22, 0);
  },
  bat(c, R, c1, c2) {
    c.fillStyle = c2;
    for (const sx of [-1, 1]) {
      c.beginPath(); c.moveTo(sx * R * .3, -R * .1);
      c.quadraticCurveTo(sx * R * 1.5, -R * 1.5, sx * R * 1.6, R * .2);
      c.lineTo(sx * R * 1.1, R * .05); c.lineTo(sx * R * .9, R * .6); c.lineTo(sx * R * .55, R * .25);
      c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = R * .12; c.stroke();
    }
    circ(c, 0, 0, R * .62, c1, OUT, R * .12);
    poly(c, [-R * .5, -R * .4, -R * .35, -R * .95, -R * .12, -R * .5], c1, OUT, R * .1);
    poly(c, [R * .5, -R * .4, R * .35, -R * .95, R * .12, -R * .5], c1, OUT, R * .1);
    circ(c, -R * .22, -R * .05, R * .14, '#ff4a4a'); circ(c, R * .22, -R * .05, R * .14, '#ff4a4a');
  },
  skeleton(c, R, c1, c2) {
    // 躯干肋骨
    c.fillStyle = c1;
    c.fillRect(-R * .38, R * .15, R * .76, R * .75);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = R * .08;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-R * .38, R * (.35 + i * .2)); c.lineTo(R * .38, R * (.35 + i * .2)); c.stroke(); }
    circ(c, 0, -R * .3, R * .72, c1, OUT, R * .12);
    c.fillStyle = c1; c.fillRect(-R * .4, R * .15, R * .8, R * .25);
    circ(c, -R * .27, -R * .32, R * .22, '#1a1224'); circ(c, R * .27, -R * .32, R * .22, '#1a1224');
    circ(c, -R * .27, -R * .32, R * .1, c2); circ(c, R * .27, -R * .32, R * .1, c2);
    poly(c, [0, -R * .1, -R * .08, R * .08, R * .08, R * .08], '#1a1224');
  },
  ghost(c, R, c1, c2) {
    c.globalAlpha = .88;
    c.beginPath(); c.arc(0, -R * .1, R * .9, Math.PI, 0);
    c.lineTo(R * .9, R * .9);
    for (let i = 0; i < 4; i++) c.quadraticCurveTo(R * (.9 - i * .45 - .22), R * (i % 2 ? .6 : 1.2), R * (.9 - (i + 1) * .45), R * .9);
    c.closePath(); c.fillStyle = c1; c.fill(); c.strokeStyle = OUT; c.lineWidth = R * .1; c.stroke();
    c.globalAlpha = 1;
    ell(c, -R * .32, -R * .2, R * .17, R * .26, '#1a1f3a'); ell(c, R * .32, -R * .2, R * .17, R * .26, '#1a1f3a');
    circ(c, -R * .32, -R * .26, R * .07, c2); circ(c, R * .32, -R * .26, R * .07, c2);
    ell(c, 0, R * .3, R * .2, R * .26, '#1a1f3a');
  },
  orc(c, R, c1, c2) {
    // 角
    poly(c, [-R * .7, -R * .55, -R * 1.0, -R * 1.1, -R * .35, -R * .8], c2, OUT, R * .08);
    poly(c, [R * .7, -R * .55, R * 1.0, -R * 1.1, R * .35, -R * .8], c2, OUT, R * .08);
    circ(c, 0, R * .05, R * .95, c1, OUT, R * .1);
    ell(c, 0, R * .55, R * .55, R * .28, 'rgba(0,0,0,.12)');
    // 眉毛 + 眼
    c.strokeStyle = '#1a1224'; c.lineWidth = R * .12; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-R * .55, -R * .45); c.lineTo(-R * .1, -R * .2); c.moveTo(R * .55, -R * .45); c.lineTo(R * .1, -R * .2); c.stroke();
    circ(c, -R * .3, -R * .08, R * .16, c2); circ(c, R * .3, -R * .08, R * .16, c2);
    circ(c, -R * .3, -R * .08, R * .07, '#1a1224'); circ(c, R * .3, -R * .08, R * .07, '#1a1224');
    // 獠牙
    poly(c, [-R * .3, R * .35, -R * .18, R * .75, -R * .06, R * .35], '#fff', OUT, R * .05);
    poly(c, [R * .3, R * .35, R * .18, R * .75, R * .06, R * .35], '#fff', OUT, R * .05);
  },
  archer(c, R, c1, c2) {
    // 弓
    c.strokeStyle = '#5a3a1a'; c.lineWidth = R * .16; c.lineCap = 'round';
    c.beginPath(); c.arc(R * .7, 0, R * .9, -1.1, 1.1); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = R * .05;
    c.beginPath(); c.moveTo(R * .7 + Math.cos(-1.1) * R * .9, Math.sin(-1.1) * R * .9);
    c.lineTo(R * .7 + Math.cos(1.1) * R * .9, Math.sin(1.1) * R * .9); c.stroke();
    // 披风
    poly(c, [-R * .7, R * .9, -R * .5, -R * .1, R * .5, -R * .1, R * .7, R * .9], c1, OUT, R * .1);
    circ(c, 0, -R * .35, R * .55, '#e8c9a0', OUT, R * .08);
    c.beginPath(); c.arc(0, -R * .4, R * .66, Math.PI * 1.05, Math.PI * -0.05); c.lineTo(R * .1, -R * .1);
    c.lineTo(-R * .1, -R * .1); c.closePath();
    c.fillStyle = c2; c.fill(); c.strokeStyle = OUT; c.lineWidth = R * .08; c.stroke();
    circ(c, -R * .2, -R * .3, R * .1, '#1a1224'); circ(c, R * .2, -R * .3, R * .1, '#1a1224');
  },
  bomber(c, R, c1, c2) {
    c.strokeStyle = '#1a1224'; c.lineWidth = R * .1; c.lineCap = 'round';
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(sx * R * .6, R * (-.2 + i * .4)); c.lineTo(sx * R * 1.2, R * (-.5 + i * .55)); c.stroke();
    }
    ell(c, 0, R * .1, R * .9, R * .8, c1);
    c.strokeStyle = OUT; c.lineWidth = R * .1; c.beginPath(); c.ellipse(0, R * .1, R * .9, R * .8, 0, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(0, -R * .65); c.lineTo(0, R * .9); c.stroke();
    circ(c, -R * .38, R * .05, R * .2, c2); circ(c, R * .38, R * .05, R * .2, c2); circ(c, 0, R * .5, R * .16, c2);
    eye(c, -R * .25, -R * .55, R * .16, 0); eye(c, R * .25, -R * .55, R * .16, 0);
    // 引信
    c.strokeStyle = '#8a6a3a'; c.lineWidth = R * .1; c.beginPath(); c.moveTo(0, -R * .75); c.quadraticCurveTo(R * .3, -R * 1.1, R * .1, -R * 1.25); c.stroke();
    circ(c, R * .1, -R * 1.25, R * .17, '#ffe26a'); circ(c, R * .1, -R * 1.25, R * .08, '#fff');
  },
  golem(c, R, c1, c2) {
    poly(c, [-R * .9, R * .8, -R * 1.0, -R * .1, -R * .55, -R * .85, R * .55, -R * .85, R * 1.0, -R * .1, R * .9, R * .8], c1, OUT, R * .1);
    poly(c, [-R * .55, -R * .85, R * .55, -R * .85, R * .3, -R * .3, -R * .3, -R * .3], 'rgba(255,255,255,.18)');
    poly(c, [-R * .9, R * .8, -R * 1.0, -R * .1, -R * .5, R * .2, -R * .4, R * .8], 'rgba(0,0,0,.18)');
    // 手臂岩块
    poly(c, [-R * 1.25, 0, -R * .95, -R * .3, -R * .85, R * .5, -R * 1.2, R * .6], c1, OUT, R * .08);
    poly(c, [R * 1.25, 0, R * .95, -R * .3, R * .85, R * .5, R * 1.2, R * .6], c1, OUT, R * .08);
    c.fillStyle = c2; c.shadowColor = c2;
    c.fillRect(-R * .5, -R * .35, R * .3, R * .16); c.fillRect(R * .2, -R * .35, R * .3, R * .16);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = R * .06;
    c.beginPath(); c.moveTo(-R * .2, R * .1); c.lineTo(R * .1, R * .3); c.lineTo(R * .3, R * .1); c.stroke();
  },
  mage(c, R, c1, c2) {
    poly(c, [0, -R * .2, -R * .95, R * 1.0, R * .95, R * 1.0], c1, OUT, R * .1);
    circ(c, 0, -R * .3, R * .5, '#241a30', OUT, R * .08);
    circ(c, -R * .18, -R * .3, R * .1, c2); circ(c, R * .18, -R * .3, R * .1, c2);
    // 帽子
    poly(c, [-R * .8, -R * .55, R * .8, -R * .55, R * .35, -R * .6, 0, -R * 1.5, -R * .35, -R * .6], c1, OUT, R * .1);
    c.fillStyle = c2; c.fillRect(-R * .38, -R * .72, R * .76, R * .12);
    circ(c, R * .95, -R * .1, R * .26, c2); circ(c, R * .95, -R * .1, R * .12, '#fff');
    c.strokeStyle = '#5a3a1a'; c.lineWidth = R * .1; c.beginPath(); c.moveTo(R * .95, R * .1); c.lineTo(R * .8, R * 1.0); c.stroke();
  },
  charger(c, R, c1, c2) {
    // 野猪：朝右
    for (const dx of [-.5, .35]) { c.fillStyle = '#2a1c1c'; c.fillRect(R * dx, R * .5, R * .22, R * .5); }
    ell(c, 0, 0, R * 1.05, R * .75, c1);
    c.strokeStyle = OUT; c.lineWidth = R * .1; c.beginPath(); c.ellipse(0, 0, R * 1.05, R * .75, 0, 0, TAU); c.stroke();
    ell(c, R * .75, R * .1, R * .45, R * .38, c1); c.beginPath(); c.ellipse(R * .75, R * .1, R * .45, R * .38, 0, 0, TAU); c.stroke();
    poly(c, [R * .8, R * .2, R * 1.35, -R * .15, R * 1.05, R * .35], c2, OUT, R * .06);
    poly(c, [R * .5, -R * .25, R * .35, -R * .85, R * .8, -R * .3], c2, OUT, R * .06);
    circ(c, R * .75, -R * .1, R * .12, '#ff4a4a'); circ(c, R * 1.15, R * .1, R * .06, '#1a1224');
    c.fillStyle = 'rgba(0,0,0,.2)'; poly(c, [-R * .9, -R * .5, -R * .4, -R * .75, -R * .6, -R * .1]);
  },
  crownSlime(c, R, c1, c2) {
    SHAPES.slime(c, R, c1, c2);
    // 皇冠
    c.save(); c.translate(0, -R * .95);
    poly(c, [-R * .45, R * .2, -R * .5, -R * .25, -R * .25, 0, 0, -R * .4, R * .25, 0, R * .5, -R * .25, R * .45, R * .2], '#ffd24a', OUT, R * .05);
    circ(c, 0, -R * .05, R * .07, '#ff4a6a'); circ(c, -R * .25, R * .08, R * .05, '#6ae0ff'); circ(c, R * .25, R * .08, R * .05, '#6ae0ff');
    c.restore();
  },
  scorpion(c, R, c1, c2) {
    // 尾巴
    c.strokeStyle = c1; c.lineWidth = R * .22; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, R * .3); c.bezierCurveTo(-R * 1.1, R * .4, -R * 1.2, -R * 1.0, -R * .3, -R * 1.0); c.stroke();
    poly(c, [-R * .1, -R * 1.25, -R * .55, -R * .85, -R * .05, -R * .8], c2, OUT, R * .05);
    // 钳
    for (const sx of [-1, 1]) {
      c.strokeStyle = c1; c.lineWidth = R * .18;
      c.beginPath(); c.moveTo(sx * R * .5, -R * .1); c.lineTo(sx * R * 1.0, -R * .6); c.stroke();
      poly(c, [sx * R * .8, -R * .55, sx * R * 1.3, -R * .85, sx * R * 1.3, -R * .35, sx * R * 1.0, -R * .55], c1, OUT, R * .06);
    }
    // 腿
    c.strokeStyle = '#2a1c14'; c.lineWidth = R * .09;
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(sx * R * .5, R * (.1 + i * .22)); c.lineTo(sx * R * 1.0, R * (.35 + i * .25)); c.stroke(); }
    ell(c, 0, R * .1, R * .75, R * .65, c1);
    c.strokeStyle = OUT; c.lineWidth = R * .08; c.beginPath(); c.ellipse(0, R * .1, R * .75, R * .65, 0, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, R * (.1 + i * .05), R * (.35 + i * .15), .3, Math.PI - .3); c.stroke(); }
    eye(c, -R * .25, -R * .2, R * .15, 0); eye(c, R * .25, -R * .2, R * .15, 0);
    circ(c, -R * .25, -R * .2, R * .05, '#ff4a4a');
  },
  lich(c, R, c1, c2) {
    // 飘动长袍
    c.beginPath(); c.moveTo(-R * .8, -R * .4);
    c.quadraticCurveTo(-R * 1.2, R * .5, -R * .9, R * 1.0);
    for (let i = 0; i < 5; i++) c.quadraticCurveTo(-R * .9 + (i + .5) * R * .36, R * (i % 2 ? .75 : 1.25), -R * .9 + (i + 1) * R * .36, R * 1.0);
    c.quadraticCurveTo(R * 1.2, R * .5, R * .8, -R * .4);
    c.quadraticCurveTo(0, -R * 1.2, -R * .8, -R * .4); c.closePath();
    c.fillStyle = c1; c.fill(); c.strokeStyle = OUT; c.lineWidth = R * .08; c.stroke();
    circ(c, 0, -R * .25, R * .5, '#e9e4d2', OUT, R * .06);
    ell(c, -R * .2, -R * .3, R * .12, R * .16, '#10122a'); ell(c, R * .2, -R * .3, R * .12, R * .16, '#10122a');
    circ(c, -R * .2, -R * .3, R * .06, c2); circ(c, R * .2, -R * .3, R * .06, c2);
    c.fillStyle = '#10122a'; c.fillRect(-R * .2, R * -.02, R * .4, R * .06);
    // 冠刺
    poly(c, [-R * .55, -R * .6, -R * .45, -R * 1.25, -R * .2, -R * .75, 0, -R * 1.4, R * .2, -R * .75, R * .45, -R * 1.25, R * .55, -R * .6], c2, OUT, R * .05);
    // 法球
    circ(c, R * 1.05, -R * .1, R * .25, c2); circ(c, R * 1.05, -R * .1, R * .12, '#fff');
  },
  demon(c, R, c1, c2) {
    // 翼
    for (const sx of [-1, 1]) {
      c.beginPath(); c.moveTo(sx * R * .5, -R * .2);
      c.quadraticCurveTo(sx * R * 1.5, -R * 1.5, sx * R * 1.65, -R * .2);
      c.quadraticCurveTo(sx * R * 1.35, -R * .1, sx * R * 1.3, R * .4);
      c.quadraticCurveTo(sx * R * 1.0, R * .1, sx * R * .9, R * .6);
      c.quadraticCurveTo(sx * R * .7, R * .3, sx * R * .5, R * .5); c.closePath();
      c.fillStyle = '#5a1018'; c.fill(); c.strokeStyle = OUT; c.lineWidth = R * .06; c.stroke();
    }
    // 角
    poly(c, [-R * .55, -R * .55, -R * .95, -R * 1.25, -R * .2, -R * .8], c2, OUT, R * .06);
    poly(c, [R * .55, -R * .55, R * .95, -R * 1.25, R * .2, -R * .8], c2, OUT, R * .06);
    circ(c, 0, R * .05, R * .85, c1, OUT, R * .08);
    ell(c, 0, R * .5, R * .5, R * .25, 'rgba(0,0,0,.2)');
    c.strokeStyle = '#1a0a10'; c.lineWidth = R * .1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-R * .6, -R * .45); c.lineTo(-R * .12, -R * .15); c.moveTo(R * .6, -R * .45); c.lineTo(R * .12, -R * .15); c.stroke();
    circ(c, -R * .32, -R * .08, R * .17, c2); circ(c, R * .32, -R * .08, R * .17, c2);
    circ(c, -R * .32, -R * .08, R * .07, '#1a0a10'); circ(c, R * .32, -R * .08, R * .07, '#1a0a10');
    // 大嘴
    c.beginPath(); c.moveTo(-R * .5, R * .3); c.quadraticCurveTo(0, R * .9, R * .5, R * .3); c.quadraticCurveTo(0, R * .5, -R * .5, R * .3);
    c.fillStyle = '#2a0810'; c.fill();
    for (let i = -2; i <= 2; i++) poly(c, [i * R * .18 - R * .06, R * .4, i * R * .18, R * .6, i * R * .18 + R * .06, R * .4], '#fff');
  }
};

/* ------------------------- 敌人烘焙 ------------------------- */
const enemyCache = {};

Sp.enemy = function (def) {
  let e = enemyCache[def.id];
  if (e) return e;
  const size = Math.ceil(def.r * 3.4);
  const c = mkCanvas(size * S, size * S);
  const g = c.getContext('2d');
  g.scale(S, S); g.translate(size / 2, size / 2);
  // 阴影
  ell(g, 0, def.r * .85, def.r * .85, def.r * .3, 'rgba(0,0,0,.28)');
  SHAPES[def.shape](g, def.r, def.c1, def.c2);
  // 白闪 & 冰冻版本
  const sil = (col) => {
    const k = mkCanvas(c.width, c.height), kg = k.getContext('2d');
    kg.drawImage(c, 0, 0);
    kg.globalCompositeOperation = 'source-atop';
    kg.fillStyle = col; kg.fillRect(0, 0, k.width, k.height);
    return k;
  };
  e = enemyCache[def.id] = { n: c, w: sil('rgba(255,255,255,.85)'), ice: sil('rgba(120,200,255,.5)'), size, half: size / 2 };
  return e;
};

/* ------------------------- 光晕 / 宝石 ------------------------- */
const glowCache = {};
Sp.glow = function (col) {
  let c = glowCache[col];
  if (c) return c;
  c = glowCache[col] = mkCanvas(64, 64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(.35, col.length === 7 ? col + '88' : col); gr.addColorStop(1, col.length === 7 ? col + '00' : 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
};
const gemCache = [];
Sp.gem = function (tier) {
  if (gemCache[tier]) return gemCache[tier];
  const cols = [['#4aa8ff', '#bfe4ff'], ['#4adf7a', '#c6ffd8'], ['#ff4a5a', '#ffc0c8']][tier];
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  g.translate(16, 16);
  poly(g, [0, -11, 8, 0, 0, 11, -8, 0], cols[0], 'rgba(10,10,30,.7)', 1.6);
  poly(g, [0, -11, 8, 0, 0, -1, -8, 0], cols[1]);
  return (gemCache[tier] = c);
};
const iconCache = {};
Sp.pickup = function (k) {
  if (iconCache[k]) return iconCache[k];
  const c = mkCanvas(40, 40), g = c.getContext('2d');
  g.translate(20, 20);
  if (k === 'coin') {
    circ(g, 0, 0, 9, '#ffcf3a', '#8a5a00', 2); circ(g, 0, 0, 5.5, null, '#ffe98a', 1.6);
  } else if (k === 'heart') {
    g.fillStyle = '#ff4a6a'; g.strokeStyle = '#7a1028'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 9); g.bezierCurveTo(-14, -2, -8, -12, 0, -5); g.bezierCurveTo(8, -12, 14, -2, 0, 9); g.fill(); g.stroke();
    ell(g, -4, -4, 2.5, 1.6, 'rgba(255,255,255,.7)', -.6);
  } else if (k === 'magnet') {
    g.strokeStyle = '#e24a4a'; g.lineWidth = 6; g.lineCap = 'butt';
    g.beginPath(); g.arc(0, 1, 8, Math.PI, 0); g.stroke();
    g.fillStyle = '#e24a4a'; g.fillRect(-11, 1, 6, 8); g.fillRect(5, 1, 6, 8);
    g.fillStyle = '#eee'; g.fillRect(-11, 6, 6, 4); g.fillRect(5, 6, 6, 4);
  } else if (k === 'bomb') {
    circ(g, 0, 3, 10, '#2a2a38', '#0a0a14', 2); ell(g, -3, 0, 3, 2, 'rgba(255,255,255,.35)', -.6);
    g.strokeStyle = '#a07a3a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(3, -6); g.quadraticCurveTo(8, -12, 10, -10); g.stroke();
    circ(g, 10, -10, 3, '#ffd24a');
  } else if (k === 'chest') {
    g.fillStyle = '#8a5a2a'; g.strokeStyle = '#3a220e'; g.lineWidth = 2;
    g.beginPath(); g.rect(-13, -4, 26, 16); g.fill(); g.stroke();
    g.fillStyle = '#a8742f'; g.beginPath(); g.moveTo(-13, -4); g.quadraticCurveTo(0, -17, 13, -4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffd24a'; g.fillRect(-13, 1, 26, 3); g.fillRect(-3, -2, 6, 8);
    g.strokeStyle = '#3a220e'; g.lineWidth = 1; g.strokeRect(-3, -2, 6, 8);
  }
  return (iconCache[k] = c);
};

/* ------------------------- 角色 ------------------------- */
// 在 ctx 上以 (0,0) 为脚底中心绘制角色（面向右），R 为尺寸基准
Sp.drawChar = function (g, ch, t, moving, R) {
  R = R || 13;
  const bob = moving ? Math.sin(t * 14) * R * .08 : Math.sin(t * 3) * R * .04;
  const step = moving ? Math.sin(t * 14) * R * .25 : 0;
  ell(g, 0, R * .95, R * .85, R * .28, 'rgba(0,0,0,.3)');
  // 腿
  g.fillStyle = '#2a2236';
  g.fillRect(-R * .45 + step * .3, R * .45, R * .35, R * .5);
  g.fillRect(R * .1 - step * .3, R * .45, R * .35, R * .5);
  g.translate(0, bob);
  // 披风/身体
  poly(g, [-R * .8, R * .6, -R * .45, -R * .3, R * .45, -R * .3, R * .8, R * .6], ch.c2, OUT, R * .09);
  g.beginPath(); g.roundRect(-R * .55, -R * .35, R * 1.1, R * 1.0, R * .3);
  g.fillStyle = ch.c1; g.fill(); g.strokeStyle = OUT; g.lineWidth = R * .09; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-R * .35, -R * .2, R * .25, R * .7);
  // 腰带
  g.fillStyle = ch.c2; g.fillRect(-R * .55, R * .25, R * 1.1, R * .14);
  // 头
  circ(g, 0, -R * .75, R * .72, '#ffe0c4', OUT, R * .09);
  const hat = ch.hat;
  // 帽/发
  if (hat === 'wizard') {
    poly(g, [-R * 1.0, -R * 1.0, R * 1.0, -R * 1.0, R * .45, -R * 1.1, R * .1, -R * 2.2, -R * .45, -R * 1.1], ch.c1, OUT, R * .09);
    g.fillStyle = '#ffd24a'; g.fillRect(-R * .5, -R * 1.28, R * 1.0, R * .16);
  } else if (hat === 'helm') {
    g.beginPath(); g.arc(0, -R * .85, R * .8, Math.PI, 0); g.closePath();
    g.fillStyle = ch.c1; g.fill(); g.strokeStyle = OUT; g.lineWidth = R * .09; g.stroke();
    g.fillStyle = ch.c2; g.fillRect(-R * .08, -R * 1.65, R * .16, R * .8);
    poly(g, [-R * .06, -R * 1.65, -R * .06, -R * 2.0, R * .5, -R * 1.7], '#e24a4a');
  } else if (hat === 'hood') {
    g.beginPath(); g.arc(0, -R * .8, R * .85, Math.PI * .95, Math.PI * .05, false); g.lineTo(R * .5, -R * .55); g.lineTo(-R * .5, -R * .55); g.closePath();
    g.fillStyle = ch.c1; g.fill(); g.strokeStyle = OUT; g.lineWidth = R * .09; g.stroke();
    poly(g, [-R * .8, -R * .8, -R * 1.2, -R * .2, -R * .5, -R * .6], ch.c2, OUT, R * .05);
  } else if (hat === 'ice') {
    g.beginPath(); g.arc(0, -R * .9, R * .8, Math.PI, 0); g.fillStyle = '#e8f8ff'; g.fill(); g.strokeStyle = OUT; g.lineWidth = R * .09; g.stroke();
    for (let i = -1; i <= 1; i++) poly(g, [i * R * .4 - R * .16, -R * 1.5, i * R * .4, -R * 2.1, i * R * .4 + R * .16, -R * 1.5], '#9fe6ff', OUT, R * .05);
  } else if (hat === 'spark') {
    g.beginPath(); g.arc(0, -R * .9, R * .78, Math.PI, 0); g.fillStyle = '#f5d04a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = R * .09; g.stroke();
    poly(g, [-R * .5, -R * 1.4, -R * .1, -R * 2.1, R * .1, -R * 1.5, R * .5, -R * 2.0, R * .6, -R * 1.3], '#fff27a', OUT, R * .05);
  } else if (hat === 'alch') {
    g.beginPath(); g.arc(0, -R * .9, R * .78, Math.PI, 0); g.fillStyle = '#6a4a2a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = R * .09; g.stroke();
    g.fillStyle = '#3a3a48'; g.fillRect(-R * .75, -R * 1.0, R * 1.5, R * .22);
    circ(g, -R * .3, -R * .88, R * .28, '#8be05a', OUT, R * .06); circ(g, R * .3, -R * .88, R * .28, '#8be05a', OUT, R * .06);
    circ(g, -R * .3, -R * .88, R * .12, '#fff'); circ(g, R * .3, -R * .88, R * .12, '#fff');
  } else if (hat === 'halo') {
    g.beginPath(); g.arc(0, -R * .9, R * .78, Math.PI, 0); g.fillStyle = '#e8d28a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = R * .09; g.stroke();
    g.strokeStyle = '#fff2a8'; g.lineWidth = R * .14; g.beginPath(); g.ellipse(0, -R * 1.85, R * .6, R * .2, 0, 0, TAU); g.stroke();
  } else if (hat === 'flame') {
    g.beginPath(); g.arc(0, -R * .9, R * .78, Math.PI, 0); g.fillStyle = '#7a2a1a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = R * .09; g.stroke();
    poly(g, [-R * .5, -R * 1.5, -R * .25, -R * 2.2, 0, -R * 1.6, R * .3, -R * 2.4, R * .55, -R * 1.5], '#ff7a3a', OUT, R * .05);
    poly(g, [-R * .25, -R * 1.5, 0, -R * 1.95, R * .25, -R * 1.5], '#ffd24a');
  }
  // 眼睛 (面向右)
  circ(g, R * .08, -R * .7, R * .1, '#2a1c30'); circ(g, R * .4, -R * .7, R * .1, '#2a1c30');
  circ(g, R * .1, -R * .74, R * .035, '#fff'); circ(g, R * .42, -R * .74, R * .035, '#fff');
  ell(g, R * .22, -R * .5, R * .08, R * .04, 'rgba(255,100,100,.5)');
};
const iconImgCache = {};
Sp.charIcon = function (id) {
  if (iconImgCache[id]) return iconImgCache[id];
  const c = mkCanvas(128, 128), g = c.getContext('2d');
  g.translate(64, 84); g.scale(2.3, 2.3);
  Sp.drawChar(g, SF.CHARS[id], 0, false, 13);
  return (iconImgCache[id] = c.toDataURL());
};

/* ------------------------- 地面烘焙 ------------------------- */
const TILE = 512;
const groundCache = {};
function bladeGrass(g, x, y, col) {
  g.strokeStyle = col; g.lineWidth = 1.6; g.lineCap = 'round';
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 3, y); g.quadraticCurveTo(x + i * 4, y - 5, x + i * 6, y - 9 - Math.abs(i) * -2); g.stroke(); }
}
const DECO = {
  meadow(g, x, y, r) {
    if (r < .5) bladeGrass(g, x, y, 'rgba(20,70,30,.55)');
    else if (r < .72) { circ(g, x, y, 2.5, ['#fff', '#ffd24a', '#ff9ab8', '#bfe0ff'][(x + y) % 4 | 0]); circ(g, x, y, 1, '#f5a'); }
    else if (r < .85) { ell(g, x, y, 6, 3.5, 'rgba(0,0,0,.18)'); ell(g, x, y - 1, 6, 3.5, '#8a9088'); ell(g, x - 1, y - 2, 3.5, 1.6, 'rgba(255,255,255,.3)'); }
    else { ell(g, x, y, 9, 4, 'rgba(0,0,0,.1)'); }
  },
  desert(g, x, y, r) {
    if (r < .45) { g.strokeStyle = 'rgba(150,110,50,.4)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 12, y); g.quadraticCurveTo(x, y - 5, x + 12, y); g.stroke(); }
    else if (r < .7) { ell(g, x, y, 5, 3, 'rgba(0,0,0,.15)'); ell(g, x, y - 1, 5, 3, '#a8885a'); }
    else if (r < .85) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y - 8); g.moveTo(x, y); g.lineTo(x + 3, y - 9); g.moveTo(x, y); g.lineTo(x + 7, y - 6); g.stroke(); }
    else { circ(g, x, y, 2, 'rgba(255,255,255,.35)'); }
  },
  frost(g, x, y, r) {
    if (r < .5) { ell(g, x, y, 9, 4, 'rgba(255,255,255,.7)'); }
    else if (r < .75) { g.strokeStyle = 'rgba(120,170,210,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x - 2, y + 2); g.lineTo(x + 3, y - 2); g.lineTo(x + 9, y + 1); g.stroke(); }
    else if (r < .88) { circ(g, x, y, 1.6, '#fff'); circ(g, x + 5, y + 3, 1.2, '#fff'); }
    else { ell(g, x, y, 6, 3, 'rgba(0,0,0,.08)'); }
  },
  lava(g, x, y, r) {
    if (r < .4) { g.strokeStyle = 'rgba(255,110,40,.55)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 5); g.lineTo(x + 11, y + 14); g.moveTo(x + 8, y + 5); g.lineTo(x + 16, y + 3); g.stroke(); }
    else if (r < .7) { ell(g, x, y, 6, 3.5, '#241a1e'); ell(g, x - 1, y - 1.5, 3.5, 1.5, 'rgba(255,255,255,.12)'); }
    else if (r < .85) { circ(g, x, y, 1.8, 'rgba(255,170,60,.7)'); }
    else { ell(g, x, y, 8, 3, 'rgba(0,0,0,.2)'); }
  }
};
Sp.ground = function (stage) {
  if (groundCache[stage.id]) return groundCache[stage.id];
  const c = mkCanvas(TILE * S, TILE * S), g = c.getContext('2d');
  g.scale(S, S);
  g.fillStyle = stage.ground[0]; g.fillRect(0, 0, TILE, TILE);
  // 柔和斑块（环绕以保证无缝）
  for (let i = 0; i < 46; i++) {
    const x = U.rand(0, TILE), y = U.rand(0, TILE), r = U.rand(30, 80);
    const col = stage.ground[1 + (i % 2)];
    for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) {
      if (x + ox < -r || x + ox > TILE + r || y + oy < -r || y + oy > TILE + r) continue;
      g.globalAlpha = .55; ell(g, x + ox, y + oy, r, r * U.rand(.6, 1), col);
    }
  }
  g.globalAlpha = 1;
  const f = DECO[stage.deco];
  for (let i = 0; i < 90; i++) {
    const x = U.rand(10, TILE - 10), y = U.rand(10, TILE - 10);
    f(g, x | 0, y | 0, Math.random());
  }
  return (groundCache[stage.id] = c);
};

// 大型场景装饰（按区块确定性散布）：在世界坐标系下绘制
Sp.bigDeco = function (g, kind, x, y, h) {
  if (kind === 'meadow') {
    if (h < .5) { // 树
      ell(g, x, y + 4, 22, 8, 'rgba(0,0,0,.22)');
      g.fillStyle = '#6a4424'; g.fillRect(x - 4, y - 14, 8, 20);
      circ(g, x, y - 28, 20, '#2f8a3c', OUT, 2); circ(g, x - 12, y - 18, 14, '#3a9a48'); circ(g, x + 12, y - 20, 14, '#3a9a48');
      circ(g, x - 5, y - 34, 7, 'rgba(255,255,255,.18)');
    } else { // 灌木
      ell(g, x, y + 3, 16, 6, 'rgba(0,0,0,.2)'); circ(g, x - 7, y - 4, 10, '#3f9a4a'); circ(g, x + 7, y - 4, 10, '#3f9a4a'); circ(g, x, y - 8, 11, '#4aae56');
    }
  } else if (kind === 'desert') {
    if (h < .5) { // 仙人掌
      ell(g, x, y + 4, 14, 5, 'rgba(0,0,0,.2)');
      g.fillStyle = '#3f8a4a'; g.strokeStyle = OUT; g.lineWidth = 1.5;
      g.beginPath(); g.roundRect(x - 5, y - 30, 10, 36, 5); g.fill(); g.stroke();
      g.beginPath(); g.roundRect(x - 15, y - 20, 8, 5, 3); g.roundRect(x - 15, y - 28, 6, 12, 3); g.fill(); g.stroke();
      g.beginPath(); g.roundRect(x + 7, y - 16, 8, 5, 3); g.roundRect(x + 9, y - 25, 6, 14, 3); g.fill(); g.stroke();
    } else { // 残柱
      ell(g, x, y + 4, 18, 6, 'rgba(0,0,0,.2)');
      g.fillStyle = '#d8c090'; g.strokeStyle = OUT; g.lineWidth = 1.5;
      g.beginPath(); g.rect(x - 9, y - 30, 18, 34); g.fill(); g.stroke();
      g.fillStyle = '#c4aa78'; g.fillRect(x - 11, y - 34, 22, 6); g.fillRect(x - 11, y, 22, 5);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(x - 3, y - 28); g.lineTo(x - 3, y - 2); g.moveTo(x + 3, y - 28); g.lineTo(x + 3, y - 2); g.stroke();
    }
  } else if (kind === 'frost') {
    if (h < .5) { // 雪松
      ell(g, x, y + 4, 18, 6, 'rgba(0,0,0,.16)');
      g.fillStyle = '#5a3d24'; g.fillRect(x - 3, y - 6, 6, 12);
      for (let i = 0; i < 3; i++) poly(g, [x - 20 + i * 4, y - 6 - i * 15, x, y - 30 - i * 15, x + 20 - i * 4, y - 6 - i * 15], '#2d6a58', OUT, 1.5);
      for (let i = 0; i < 3; i++) poly(g, [x - 12 + i * 3, y - 14 - i * 15, x, y - 30 - i * 15, x + 12 - i * 3, y - 14 - i * 15], 'rgba(255,255,255,.75)');
    } else { // 冰晶
      ell(g, x, y + 4, 16, 6, 'rgba(0,0,0,.15)');
      poly(g, [x - 10, y + 2, x - 4, y - 28, x + 2, y + 2], '#a8e4ff', OUT, 1.5);
      poly(g, [x - 2, y + 4, x + 6, y - 38, x + 14, y + 4], '#7fcfff', OUT, 1.5);
      poly(g, [x + 8, y + 3, x + 14, y - 20, x + 20, y + 3], '#bff0ff', OUT, 1.5);
    }
  } else if (kind === 'lava') {
    if (h < .5) { // 岩柱
      ell(g, x, y + 4, 18, 6, 'rgba(0,0,0,.3)');
      poly(g, [x - 16, y + 4, x - 10, y - 26, x - 2, y - 36, x + 8, y - 24, x + 16, y + 4], '#3a2a30', OUT, 2);
      poly(g, [x - 2, y - 36, x + 8, y - 24, x + 2, y - 8, x - 4, y - 20], 'rgba(255,255,255,.1)');
      g.strokeStyle = 'rgba(255,120,40,.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 4, y - 24); g.lineTo(x, y - 12); g.lineTo(x - 6, y); g.stroke();
    } else { // 熔岩池
      ell(g, x, y, 28, 12, '#2a1a1c'); ell(g, x, y, 23, 9, '#ff6a2a'); ell(g, x, y - 1, 15, 5, '#ffb44a');
    }
  }
};
// 清空所有烘焙缓存（移动端切后台后画布可能被系统回收）
Sp.clear = function () {
  for (const k in enemyCache) delete enemyCache[k];
  for (const k in glowCache) delete glowCache[k];
  for (const k in iconCache) delete iconCache[k];
  for (const k in groundCache) delete groundCache[k];
  gemCache.length = 0;
};
})(window.SF = window.SF || {});
