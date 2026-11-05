/* 美术：全部由 Canvas 矢量绘制（带光影、描边、逐帧动画）并按需烘焙 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU;
const Sp = SF.Sprites = {};
const S = 2.4;          // 小型精灵烘焙倍率
const S_BIG = 1.7;      // 大型（Boss）烘焙倍率
Sp.S = 1.5;             // 地面图案烘焙倍率
const OUTC = 'rgba(18,10,30,.9)';

/* ======================= 颜色工具 ======================= */
const rgbCache = {};
function rgbOf(h) {
  let c = rgbCache[h];
  if (c) return c;
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(x => x + x).join('');
  const n = parseInt(s, 16);
  c = rgbCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return c;
}
const hx = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
const toHex = c => '#' + hx(c[0]) + hx(c[1]) + hx(c[2]);
// k>0 提亮，k<0 压暗
function shade(h, k) {
  const c = rgbOf(h);
  return toHex(k >= 0 ? c.map(v => v + (255 - v) * k) : c.map(v => v * (1 + k)));
}
function mix(a, b, t) { const x = rgbOf(a), y = rgbOf(b); return toHex([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t)); }
function rgba(h, a) { const c = rgbOf(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
SF.Color = { shade, mix, rgba };

/* ======================= 画布 / 图元 ======================= */
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
function circ(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, Math.abs(r), 0, TAU); g.fillStyle = fill; g.fill(); }
function ell(g, x, y, rx, ry, fill, rot) { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); g.fillStyle = fill; g.fill(); }
function line(g, pts, w, col) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.lineWidth = w; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
}
function polyPath(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
// 带描边的粗线（骨骼、四肢）
function limb(g, pts, w, col, lw) {
  line(g, pts, w + (lw || w * 0.5) * 2, OUTC);
  line(g, pts, w, col);
  line(g, pts.map((v, i) => i % 2 ? v - w * 0.18 : v - w * 0.12), w * 0.35, rgba('#ffffff', 0.28));
}
/* 立体部件：path() 构建路径；以 (cx,cy) 半径 pr 为光照参考
 * 左上受光、右下背光，内阴影 + 高光 + 描边 */
function part(g, path, base, cx, cy, pr, o) {
  o = o || {};
  path();
  const gr = g.createRadialGradient(cx - pr * 0.45, cy - pr * 0.55, pr * 0.05, cx - pr * 0.1, cy - pr * 0.15, pr * 1.55);
  gr.addColorStop(0, shade(base, o.light === undefined ? 0.42 : o.light));
  gr.addColorStop(0.45, base);
  gr.addColorStop(1, shade(base, -0.5));
  g.fillStyle = gr; g.fill();
  if (o.ao !== false) {
    g.save(); path(); g.clip();
    g.globalAlpha = o.aoA === undefined ? 0.22 : o.aoA; ell(g, cx + pr * 0.35, cy + pr * 0.85, pr * 1.2, pr * 0.6, '#000');
    if (o.hl !== false) { g.globalAlpha = o.hl === undefined ? 0.35 : o.hl; ell(g, cx - pr * 0.35, cy - pr * 0.5, pr * 0.45, pr * 0.25, '#fff', -0.5); }
    g.globalAlpha = 1; g.restore();
  }
  if (o.lw !== 0) { path(); g.lineWidth = o.lw || Math.max(1.1, pr * 0.13); g.strokeStyle = o.out || OUTC; g.lineJoin = 'round'; g.stroke(); }
}
function eye(g, x, y, r, o) {
  o = o || {};
  g.beginPath(); g.ellipse(x, y, r, r * 1.12, 0, 0, TAU);
  const gr = g.createLinearGradient(x, y - r, x, y + r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cfd5ee');
  g.fillStyle = gr; g.fill(); g.lineWidth = r * 0.24; g.strokeStyle = OUTC; g.stroke();
  const ix = x + (o.look === undefined ? 0.3 : o.look) * r * 0.45, iy = y + r * 0.1;
  const ig = g.createRadialGradient(ix, iy - r * 0.2, r * 0.05, ix, iy, r * 0.66);
  ig.addColorStop(0, shade(o.iris || '#3a2a6a', 0.4)); ig.addColorStop(1, o.iris || '#3a2a6a');
  circ(g, ix, iy, r * 0.64, ig);
  circ(g, ix, iy + r * 0.05, r * 0.34, '#0a0612');
  circ(g, ix - r * 0.22, iy - r * 0.26, r * 0.2, '#fff');
  circ(g, ix + r * 0.2, iy + r * 0.22, r * 0.09, 'rgba(255,255,255,.85)');
}
function glowEye(g, x, y, r, col) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.6);
  gr.addColorStop(0, rgba(col, 0.9)); gr.addColorStop(0.4, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0));
  circ(g, x, y, r * 2.6, gr);
  circ(g, x, y, r, col); circ(g, x - r * 0.25, y - r * 0.25, r * 0.45, '#fff');
}
function brow(g, x1, y1, x2, y2, w) { line(g, [x1, y1, x2, y2], w, '#1a0f1e'); }
function spikes(g, pts, base) { polyPath(g, pts); const gr = g.createLinearGradient(pts[0], pts[1] - 10, pts[0], pts[1] + 10); gr.addColorStop(0, shade(base, 0.5)); gr.addColorStop(1, shade(base, -0.3)); g.fillStyle = gr; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUTC; g.stroke(); }
function metal(g, x0, y0, x1, y1, base) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, shade(base, 0.6)); gr.addColorStop(0.45, base); gr.addColorStop(0.55, shade(base, -0.35)); gr.addColorStop(1, shade(base, 0.2));
  return gr;
}

/* ======================= 敌人形状（朝右，ph∈[0,1) 为动画相位） ======================= */
const SH = {};
SH.slime = function (g, R, p, ph) {
  const s = Math.sin(ph * TAU), sx = 1 + 0.08 * s, sy = 1 - 0.08 * s;
  g.save(); g.translate(0, R * 0.62); g.scale(sx, sy); g.translate(0, -R * 0.62);
  const path = () => {
    g.beginPath(); g.moveTo(-R, R * 0.55);
    g.bezierCurveTo(-R * 1.14, -R * 0.98, R * 1.14, -R * 0.98, R, R * 0.55);
    g.quadraticCurveTo(R * 0.5, R * 0.8, 0, R * 0.72); g.quadraticCurveTo(-R * 0.5, R * 0.8, -R, R * 0.55); g.closePath();
  };
  part(g, path, p.c1, 0, -R * 0.05, R, { hl: 0.15 });
  g.save(); path(); g.clip();
  g.globalAlpha = 0.35; ell(g, R * 0.15, R * 0.18, R * 0.6, R * 0.38, shade(p.c1, 0.55)); g.globalAlpha = 1;
  circ(g, R * 0.5, R * 0.28, R * 0.1, 'rgba(255,255,255,.4)'); circ(g, R * 0.32, R * 0.46, R * 0.06, 'rgba(255,255,255,.35)'); circ(g, -R * 0.5, R * 0.35, R * 0.07, 'rgba(255,255,255,.3)');
  g.restore();
  ell(g, -R * 0.4, -R * 0.5, R * 0.3, R * 0.14, 'rgba(255,255,255,.78)', -0.55);
  circ(g, -R * 0.72, -R * 0.12, R * 0.07, 'rgba(255,255,255,.85)');
  eye(g, -R * 0.05, -R * 0.06, R * 0.21, { look: 0.7, iris: shade(p.c1, -0.65) });
  eye(g, R * 0.45, -R * 0.06, R * 0.21, { look: 0.7, iris: shade(p.c1, -0.65) });
  g.beginPath(); g.arc(R * 0.2, R * 0.2, R * 0.12, 0.25, Math.PI - 0.25); g.lineWidth = R * 0.07; g.strokeStyle = OUTC; g.lineCap = 'round'; g.stroke();
  ell(g, -R * 0.28, R * 0.18, R * 0.1, R * 0.05, 'rgba(255,120,150,.45)'); ell(g, R * 0.68, R * 0.18, R * 0.08, R * 0.05, 'rgba(255,120,150,.45)');
  g.restore();
};
SH.bat = function (g, R, p, ph) {
  const f = Math.sin(ph * TAU), by = -f * R * 0.14;
  const wingC = shade(p.c1, -0.18);
  for (const sx of [-1, 1]) {
    const ty = by - R * (0.35 + 0.95 * f);
    const path = () => {
      g.beginPath(); g.moveTo(sx * R * 0.25, by - R * 0.15);
      g.quadraticCurveTo(sx * R * 0.9, ty - R * 0.25, sx * R * 1.65, ty);
      g.quadraticCurveTo(sx * R * 1.38, by + (ty - by) * 0.3 + R * 0.3, sx * R * 1.18, by + (ty - by) * 0.15 + R * 0.3);
      g.quadraticCurveTo(sx * R * 1.0, by + R * 0.12, sx * R * 0.78, by + R * 0.45);
      g.quadraticCurveTo(sx * R * 0.58, by + R * 0.2, sx * R * 0.3, by + R * 0.32); g.closePath();
    };
    part(g, path, wingC, sx * R * 0.9, (by + ty) / 2, R * 0.8, { hl: 0.2 });
    line(g, [sx * R * 0.32, by - R * 0.1, sx * R * 1.18, by + (ty - by) * 0.15 + R * 0.3], R * 0.06, rgba('#000000', 0.35));
    line(g, [sx * R * 0.32, by - R * 0.1, sx * R * 0.78, by + R * 0.45], R * 0.06, rgba('#000000', 0.35));
  }
  for (const sx of [-1, 1]) part(g, () => polyPath(g, [sx * R * 0.48, by - R * 0.3, sx * R * 0.38, by - R * 1.0, sx * R * 0.1, by - R * 0.5]), p.c1, sx * R * 0.3, by - R * 0.6, R * 0.3, { lw: R * 0.08 });
  part(g, () => { g.beginPath(); g.ellipse(0, by, R * 0.56, R * 0.6, 0, 0, TAU); }, p.c1, 0, by, R * 0.6);
  ell(g, R * 0.08, by + R * 0.2, R * 0.32, R * 0.3, rgba(p.c2, 0.45));
  glowEye(g, R * 0.02, by - R * 0.1, R * 0.12, '#ff3a4a'); glowEye(g, R * 0.32, by - R * 0.1, R * 0.12, '#ff3a4a');
  polyPath(g, [R * 0.12, by + R * 0.22, R * 0.18, by + R * 0.4, R * 0.24, by + R * 0.22]); g.fillStyle = '#fff'; g.fill();
};
SH.skeleton = function (g, R, p, ph) {
  const s = Math.sin(ph * TAU), bob = Math.abs(s) * R * 0.06;
  const bone = p.c1, boneD = shade(p.c1, -0.25), hy = R * 0.3 - bob;
  limb(g, [-R * 0.12, hy, -R * 0.12 - s * R * 0.25, hy + R * 0.28, -R * 0.12 - s * R * 0.3, R * 0.85], R * 0.13, boneD);
  limb(g, [R * 0.05, -R * 0.12 - bob, R * 0.05 - s * R * 0.25, R * 0.12 - bob, -R * 0.05 - s * R * 0.35, R * 0.3 - bob], R * 0.11, boneD);
  // 脊柱与肋骨
  limb(g, [0, hy, R * 0.02, -R * 0.2 - bob], R * 0.12, bone);
  for (let i = 0; i < 3; i++) {
    const y = -R * 0.12 - bob + i * R * 0.13, w = R * (0.34 - i * 0.04);
    g.beginPath(); g.ellipse(R * 0.02, y, w, R * 0.07, 0, Math.PI * 1.05, Math.PI * 1.95, true);
    g.lineWidth = R * 0.13; g.strokeStyle = OUTC; g.stroke(); g.lineWidth = R * 0.07; g.strokeStyle = bone; g.stroke();
  }
  part(g, () => { g.beginPath(); g.ellipse(0, hy, R * 0.25, R * 0.12, 0, 0, TAU); }, bone, 0, hy, R * 0.25, { lw: R * 0.07 });
  limb(g, [R * 0.12, hy, R * 0.12 + s * R * 0.25, hy + R * 0.28, R * 0.12 + s * R * 0.3, R * 0.85], R * 0.13, bone);
  // 前臂 + 生锈短剑
  const hx2 = R * 0.38 + s * R * 0.2, hy2 = R * 0.22 - bob;
  limb(g, [R * 0.05, -R * 0.12 - bob, R * 0.25 + s * R * 0.12, R * 0.08 - bob, hx2, hy2], R * 0.11, bone);
  g.save(); g.translate(hx2, hy2); g.rotate(-1.1 + s * 0.25);
  polyPath(g, [-R * 0.06, 0, R * 0.06, 0, R * 0.05, -R * 0.75, 0, -R * 0.9, -R * 0.05, -R * 0.75]);
  g.fillStyle = metal(g, -R * 0.06, 0, R * 0.06, 0, '#a8a4a0'); g.fill(); g.lineWidth = R * 0.05; g.strokeStyle = OUTC; g.stroke();
  g.fillStyle = '#6a3a1a'; g.fillRect(-R * 0.17, -R * 0.02, R * 0.34, R * 0.08);
  g.restore();
  // 头骨
  const kx = R * 0.08, ky = -R * 0.58 - bob;
  part(g, () => {
    g.beginPath(); g.arc(kx, ky, R * 0.55, Math.PI * 0.85, Math.PI * 2.15);
    g.quadraticCurveTo(kx + R * 0.5, ky + R * 0.5, kx + R * 0.25, ky + R * 0.55); g.lineTo(kx - R * 0.25, ky + R * 0.55);
    g.quadraticCurveTo(kx - R * 0.5, ky + R * 0.5, kx - R * 0.47, ky + R * 0.28); g.closePath();
  }, bone, kx, ky, R * 0.55);
  ell(g, kx - R * 0.08, ky - R * 0.02, R * 0.16, R * 0.19, '#1a1020'); ell(g, kx + R * 0.3, ky - R * 0.02, R * 0.15, R * 0.18, '#1a1020');
  glowEye(g, kx - R * 0.06, ky, R * 0.07, p.c2); glowEye(g, kx + R * 0.31, ky, R * 0.07, p.c2);
  polyPath(g, [kx + R * 0.12, ky + R * 0.15, kx + R * 0.06, ky + R * 0.28, kx + R * 0.18, ky + R * 0.28]); g.fillStyle = '#1a1020'; g.fill();
  for (let i = 0; i < 4; i++) line(g, [kx - R * 0.12 + i * R * 0.12, ky + R * 0.38, kx - R * 0.12 + i * R * 0.12, ky + R * 0.53], R * 0.04, rgba('#1a1020', 0.7));
};
SH.ghost = function (g, R, p, ph) {
  const t = ph * TAU, fy = Math.sin(t) * R * 0.08;
  const path = () => {
    g.beginPath(); g.arc(0, -R * 0.15 + fy, R * 0.85, Math.PI, 0);
    g.lineTo(R * 0.85, R * 0.65 + fy);
    for (let i = 0; i < 4; i++) {
      const x0 = R * 0.85 - i * R * 0.425, x1 = x0 - R * 0.425, w = Math.sin(t + i * 1.4) * R * 0.12;
      g.quadraticCurveTo((x0 + x1) / 2, R * (i % 2 ? 0.55 : 1.05) + fy + w, x1, R * 0.75 + fy);
    }
    g.closePath();
  };
  path();
  const gr = g.createLinearGradient(0, -R + fy, 0, R + fy);
  gr.addColorStop(0, shade(p.c1, 0.55)); gr.addColorStop(0.45, rgba(p.c1, 0.95)); gr.addColorStop(1, rgba(p.c1, 0.15));
  g.fillStyle = gr; g.fill();
  g.save(); path(); g.clip(); g.globalAlpha = 0.5; ell(g, -R * 0.35, -R * 0.55 + fy, R * 0.35, R * 0.2, '#fff', -0.5); g.globalAlpha = 1; g.restore();
  path(); g.lineWidth = R * 0.08; g.strokeStyle = rgba(shade(p.c1, -0.6), 0.6); g.stroke();
  for (const sx of [-1, 1]) {
    g.beginPath(); g.moveTo(sx * R * 0.75, R * 0.05 + fy);
    g.quadraticCurveTo(sx * R * 1.25, R * 0.1 + fy + Math.sin(t * 2 + sx) * R * 0.15, sx * R * 1.15, R * 0.4 + fy);
    g.lineWidth = R * 0.22; g.strokeStyle = rgba(p.c1, 0.8); g.lineCap = 'round'; g.stroke();
  }
  ell(g, R * 0.02, -R * 0.2 + fy, R * 0.17, R * 0.26, '#141a36'); ell(g, R * 0.42, -R * 0.2 + fy, R * 0.15, R * 0.24, '#141a36');
  glowEye(g, R * 0.05, -R * 0.24 + fy, R * 0.06, p.c2); glowEye(g, R * 0.44, -R * 0.24 + fy, R * 0.06, p.c2);
  ell(g, R * 0.25, R * 0.2 + fy, R * 0.13, R * 0.18 * (1 + 0.2 * Math.sin(t * 2)), '#141a36');
};
SH.orc = function (g, R, p, ph) {
  const s = Math.sin(ph * TAU), bob = Math.abs(s) * R * 0.05, skin = p.c1;
  // 腿
  for (const k of [-1, 1]) {
    const lx = k * R * 0.32 + s * k * R * 0.12;
    part(g, () => { g.beginPath(); g.roundRect(lx - R * 0.17, R * 0.4 - bob, R * 0.34, R * 0.42, R * 0.1); }, shade('#5a3a22', k < 0 ? -0.2 : 0), lx, R * 0.6, R * 0.25, { hl: false });
  }
  // 后臂
  limb(g, [-R * 0.55, -R * 0.2 - bob, -R * 0.82, R * 0.15 - bob - s * R * 0.08, -R * 0.7, R * 0.4 - bob], R * 0.24, shade(skin, -0.25));
  // 躯干
  const ty = -bob;
  part(g, () => { g.beginPath(); g.moveTo(-R * 0.75, -R * 0.3 + ty); g.quadraticCurveTo(-R * 0.95, R * 0.55 + ty, -R * 0.25, R * 0.55 + ty); g.lineTo(R * 0.35, R * 0.55 + ty); g.quadraticCurveTo(R * 0.95, R * 0.5 + ty, R * 0.75, -R * 0.3 + ty); g.quadraticCurveTo(0, -R * 0.75 + ty, -R * 0.75, -R * 0.3 + ty); g.closePath(); }, skin, 0, R * 0.05 + ty, R * 0.85);
  ell(g, R * 0.08, R * 0.2 + ty, R * 0.42, R * 0.3, rgba(shade(skin, 0.4), 0.55));
  // 腰带
  g.fillStyle = '#4a2c18'; g.fillRect(-R * 0.82, R * 0.32 + ty, R * 1.64, R * 0.16);
  part(g, () => { g.beginPath(); g.roundRect(-R * 0.1, R * 0.29 + ty, R * 0.24, R * 0.22, R * 0.04); }, '#e0b040', R * 0.02, R * 0.4 + ty, R * 0.14, { lw: R * 0.04 });
  // 肩甲
  part(g, () => { g.beginPath(); g.ellipse(-R * 0.55, -R * 0.32 + ty, R * 0.32, R * 0.22, -0.3, 0, TAU); }, shade(p.c2, -0.35), -R * 0.55, -R * 0.32 + ty, R * 0.3);
  spikes(g, [-R * 0.75, -R * 0.42 + ty, -R * 0.82, -R * 0.75 + ty, -R * 0.58, -R * 0.5 + ty], '#d8d0c0');
  spikes(g, [-R * 0.45, -R * 0.5 + ty, -R * 0.45, -R * 0.82 + ty, -R * 0.28, -R * 0.52 + ty], '#d8d0c0');
  // 头
  const hx2 = R * 0.22, hy2 = -R * 0.5 + ty;
  part(g, () => polyPath(g, [hx2 + R * 0.4, hy2 - R * 0.12, hx2 + R * 0.75, hy2 - R * 0.35, hx2 + R * 0.5, hy2 + R * 0.05]), skin, hx2 + R * 0.5, hy2 - R * 0.15, R * 0.25, { lw: R * 0.07 });
  part(g, () => { g.beginPath(); g.ellipse(hx2, hy2, R * 0.5, R * 0.45, 0, 0, TAU); }, skin, hx2, hy2, R * 0.5);
  part(g, () => { g.beginPath(); g.ellipse(hx2 + R * 0.12, hy2 + R * 0.25, R * 0.36, R * 0.2, 0, 0, TAU); }, shade(skin, -0.1), hx2 + R * 0.12, hy2 + R * 0.25, R * 0.3, { hl: false, lw: R * 0.06 });
  for (const tx of [-0.05, 0.3]) spikes(g, [hx2 + R * tx - R * 0.07, hy2 + R * 0.2, hx2 + R * tx, hy2 - R * 0.15, hx2 + R * tx + R * 0.07, hy2 + R * 0.2], '#fff8e0');
  brow(g, hx2 - R * 0.25, hy2 - R * 0.28, hx2 + R * 0.08, hy2 - R * 0.12, R * 0.12);
  brow(g, hx2 + R * 0.45, hy2 - R * 0.28, hx2 + R * 0.18, hy2 - R * 0.12, R * 0.12);
  glowEye(g, hx2 - R * 0.06, hy2 - R * 0.04, R * 0.08, p.c2); glowEye(g, hx2 + R * 0.28, hy2 - R * 0.04, R * 0.08, p.c2);
  // 前臂 + 狼牙棒
  const ax = R * 0.92, ay = R * 0.28 - bob + s * R * 0.06;
  g.save(); g.translate(ax, ay); g.rotate(0.35 - s * 0.25);
  part(g, () => { g.beginPath(); g.moveTo(-R * 0.08, 0); g.lineTo(-R * 0.18, -R * 1.0); g.quadraticCurveTo(0, -R * 1.25, R * 0.18, -R * 1.0); g.lineTo(R * 0.08, 0); g.closePath(); }, '#8a5a30', 0, -R * 0.6, R * 0.4, { lw: R * 0.06 });
  for (let i = 0; i < 3; i++) spikes(g, [R * 0.12, -R * (0.55 + i * 0.18), R * 0.32, -R * (0.62 + i * 0.18), R * 0.13, -R * (0.69 + i * 0.18)], '#c8ccd8');
  g.restore();
  limb(g, [R * 0.55, -R * 0.2 - bob, R * 0.8, R * 0.05 - bob, ax, ay], R * 0.24, skin);
  circ(g, ax, ay, R * 0.15, shade(skin, -0.1));
};
SH.archer = function (g, R, p, ph) {
  const s = Math.sin(ph * TAU), bob = Math.abs(s) * R * 0.06;
  const face = mix(p.c2, '#f2d2b0', 0.55);
  for (const k of [-1, 1]) limb(g, [k * R * 0.18, R * 0.4 - bob, k * R * 0.18 + s * k * R * 0.22, R * 0.85], R * 0.17, shade('#3a2a20', k < 0 ? -0.2 : 0));
  // 箭袋
  g.save(); g.translate(-R * 0.45, -R * 0.15 - bob); g.rotate(-0.35);
  part(g, () => { g.beginPath(); g.roundRect(-R * 0.15, -R * 0.35, R * 0.3, R * 0.75, R * 0.08); }, '#7a4a28', 0, 0, R * 0.35, { lw: R * 0.06 });
  for (let i = 0; i < 3; i++) polyPath(g, [-R * 0.1 + i * R * 0.1, -R * 0.35, -R * 0.14 + i * R * 0.1, -R * 0.6, -R * 0.02 + i * R * 0.1, -R * 0.35]), g.fillStyle = p.c2, g.fill();
  g.restore();
  // 斗篷
  part(g, () => { g.beginPath(); g.moveTo(-R * 0.55, R * 0.55 - bob); g.quadraticCurveTo(-R * 0.6, -R * 0.1 - bob, -R * 0.2, -R * 0.35 - bob); g.lineTo(R * 0.3, -R * 0.35 - bob); g.quadraticCurveTo(R * 0.65, -R * 0.1 - bob, R * 0.6, R * 0.55 - bob); for (let i = 0; i < 4; i++) g.quadraticCurveTo(R * (0.45 - i * 0.29), R * (0.75 + (i % 2) * 0.08) - bob, R * (0.31 - i * 0.29), R * 0.55 - bob); g.closePath(); }, p.c1, 0, R * 0.1 - bob, R * 0.65);
  // 头与兜帽
  const hy2 = -R * 0.55 - bob;
  part(g, () => { g.beginPath(); g.arc(R * 0.08, hy2, R * 0.45, 0, TAU); }, face, R * 0.08, hy2, R * 0.45);
  part(g, () => { g.beginPath(); g.arc(R * 0.0, hy2 - R * 0.05, R * 0.55, Math.PI * 0.82, Math.PI * 2.02); g.quadraticCurveTo(R * 0.4, hy2 - R * 0.2, R * 0.2, hy2 - R * 0.3); g.quadraticCurveTo(-R * 0.1, hy2 - R * 0.1, -R * 0.2, hy2 + R * 0.25); g.lineTo(-R * 0.52, hy2 + R * 0.35); g.closePath(); }, shade(p.c1, -0.12), 0, hy2 - R * 0.1, R * 0.55);
  eye(g, R * 0.2, hy2 + R * 0.02, R * 0.11, { look: 0.8, iris: '#2a1a10' }); eye(g, R * 0.42, hy2 + R * 0.02, R * 0.1, { look: 0.8, iris: '#2a1a10' });
  // 弓
  const bx = R * 0.62, by2 = -R * 0.05 - bob;
  g.beginPath(); g.arc(bx - R * 0.3, by2, R * 0.85, -1.05, 1.05); g.lineWidth = R * 0.2; g.strokeStyle = OUTC; g.lineCap = 'round'; g.stroke();
  g.lineWidth = R * 0.11; g.strokeStyle = metal(g, bx, by2 - R, bx, by2 + R, '#9a6a3a'); g.stroke();
  const ex = bx - R * 0.3 + Math.cos(1.05) * R * 0.85, ey = Math.sin(1.05) * R * 0.85;
  const pull = (0.5 + 0.5 * s) * R * 0.18;
  line(g, [ex, by2 - ey, bx - R * 0.15 - pull, by2, ex, by2 + ey], R * 0.035, 'rgba(255,255,255,.8)');
  line(g, [bx - R * 0.2 - pull, by2, bx + R * 0.55, by2], R * 0.05, '#c8a070');
  polyPath(g, [bx + R * 0.55, by2 - R * 0.07, bx + R * 0.72, by2, bx + R * 0.55, by2 + R * 0.07]); g.fillStyle = '#ccd'; g.fill();
};
SH.bomber = function (g, R, p, ph) {
  const s = Math.sin(ph * TAU);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const k = (i % 2 ? s : -s) * R * 0.12, y0 = R * (-0.15 + i * 0.32);
    limb(g, [sx * R * 0.55, y0, sx * R * 0.95 + k, y0 - R * 0.2, sx * R * 1.15 + k, y0 + R * 0.25], R * 0.07, '#2a1a24', R * 0.03);
  }
  part(g, () => { g.beginPath(); g.ellipse(-R * 0.08, R * 0.1, R * 0.9, R * 0.78, 0, 0, TAU); }, p.c1, -R * 0.08, R * 0.1, R * 0.88, { hl: 0.5 });
  line(g, [-R * 0.08, -R * 0.65, -R * 0.08, R * 0.86], R * 0.06, rgba('#000000', 0.4));
  for (const [x, y, r] of [[-0.45, -0.1, 0.17], [0.28, -0.1, 0.15], [-0.4, 0.42, 0.13], [0.25, 0.45, 0.14]]) part(g, () => { g.beginPath(); g.arc(R * x, R * y, R * r, 0, TAU); }, p.c2, R * x, R * y, R * r, { lw: R * 0.04, ao: false });
  part(g, () => { g.beginPath(); g.ellipse(R * 0.78, R * 0.05, R * 0.38, R * 0.33, 0, 0, TAU); }, '#2a2030', R * 0.78, R * 0.05, R * 0.38);
  eye(g, R * 0.78, -R * 0.03, R * 0.13, { look: 0.9, iris: '#000' }); eye(g, R * 1.0, -R * 0.03, R * 0.11, { look: 0.9, iris: '#000' });
  line(g, [R * 0.9, -R * 0.22, R * 1.15, -R * 0.62], R * 0.05, '#2a2030'); line(g, [R * 0.75, -R * 0.24, R * 0.85, -R * 0.68], R * 0.05, '#2a2030');
  // 引信与火花
  g.beginPath(); g.moveTo(-R * 0.3, -R * 0.62); g.quadraticCurveTo(-R * 0.1, -R * 1.05, -R * 0.42, -R * 1.18);
  g.lineWidth = R * 0.1; g.strokeStyle = '#8a6a3a'; g.stroke();
  const fl = 0.7 + 0.3 * Math.sin(ph * TAU * 3);
  glowEye(g, -R * 0.42, -R * 1.18, R * 0.12 * fl, '#ffcf4a');
  for (let i = 0; i < 4; i++) { const a = ph * TAU * 2 + i * 1.57; line(g, [-R * 0.42, -R * 1.18, -R * 0.42 + Math.cos(a) * R * 0.32 * fl, -R * 1.18 + Math.sin(a) * R * 0.32 * fl], R * 0.04, '#fff3a0'); }
};
SH.golem = function (g, R, p, ph) {
  const s = Math.sin(ph * TAU), bob = Math.abs(s) * R * 0.04, base = p.c1, glow = p.c2;
  const facet = (pts, k) => { polyPath(g, pts); g.fillStyle = shade(base, k); g.fill(); g.lineWidth = Math.max(1, R * 0.06); g.strokeStyle = OUTC; g.lineJoin = 'round'; g.stroke(); };
  for (const k of [-1, 1]) { const lx = k * R * 0.45 + s * k * R * 0.08; facet([lx - R * 0.25, R * 0.45 - bob, lx + R * 0.25, R * 0.45 - bob, lx + R * 0.3, R * 0.9, lx - R * 0.3, R * 0.9], -0.2); }
  // 后拳
  const fy = R * 0.1 - bob - s * R * 0.1;
  facet([-R * 1.25, fy - R * 0.3, -R * 0.85, fy - R * 0.45, -R * 0.75, fy + R * 0.2, -R * 1.2, fy + R * 0.35], -0.35);
  // 躯干多面体
  const ty = -bob;
  facet([-R * 0.95, R * 0.5 + ty, -R * 1.0, -R * 0.15 + ty, -R * 0.55, -R * 0.8 + ty, R * 0.55, -R * 0.8 + ty, R * 1.0, -R * 0.15 + ty, R * 0.92, R * 0.55 + ty], 0);
  facet([-R * 0.55, -R * 0.8 + ty, R * 0.55, -R * 0.8 + ty, R * 0.25, -R * 0.25 + ty, -R * 0.35, -R * 0.3 + ty], 0.35);
  facet([-R * 1.0, -R * 0.15 + ty, -R * 0.55, -R * 0.8 + ty, -R * 0.35, -R * 0.3 + ty, -R * 0.5, R * 0.2 + ty], 0.18);
  facet([R * 0.25, -R * 0.25 + ty, R * 1.0, -R * 0.15 + ty, R * 0.92, R * 0.55 + ty, R * 0.35, R * 0.4 + ty], -0.28);
  facet([-R * 0.5, R * 0.2 + ty, -R * 0.35, -R * 0.3 + ty, R * 0.25, -R * 0.25 + ty, R * 0.35, R * 0.4 + ty, -R * 0.1, R * 0.55 + ty], -0.08);
  // 发光裂纹
  g.save(); g.shadowColor = glow; g.shadowBlur = R * 0.35;
  line(g, [-R * 0.3, R * 0.05 + ty, -R * 0.05, R * 0.2 + ty, R * 0.15, R * 0.05 + ty, R * 0.35, R * 0.22 + ty], R * 0.07, glow);
  line(g, [-R * 0.7, -R * 0.05 + ty, -R * 0.5, R * 0.25 + ty], R * 0.05, glow);
  // 头
  facet([-R * 0.25, -R * 0.75 + ty, -R * 0.15, -R * 1.15 + ty, R * 0.35, -R * 1.2 + ty, R * 0.5, -R * 0.8 + ty], 0.1);
  g.fillStyle = glow; g.fillRect(R * 0.0, -R * 1.02 + ty, R * 0.14, R * 0.08); g.fillRect(R * 0.25, -R * 1.02 + ty, R * 0.14, R * 0.08);
  g.restore();
  // 前拳
  const fx2 = R * 1.05, fy2 = R * 0.12 - bob + s * R * 0.1;
  facet([fx2 - R * 0.3, fy2 - R * 0.4, fx2 + R * 0.25, fy2 - R * 0.35, fx2 + R * 0.35, fy2 + R * 0.25, fx2 - R * 0.2, fy2 + R * 0.35], 0.05);
  facet([fx2 - R * 0.3, fy2 - R * 0.4, fx2 + R * 0.25, fy2 - R * 0.35, fx2 + R * 0.05, fy2 - R * 0.1], 0.35);
  // 苔藓/尘土斑
  ell(g, -R * 0.62, -R * 0.45 + ty, R * 0.18, R * 0.08, rgba(mix(base, '#6a9a4a', 0.6), 0.6));
};
SH.mage = function (g, R, p, ph) {
  const s = Math.sin(ph * TAU), fl = Math.sin(ph * TAU) * R * 0.06;
  // 长袍
  part(g, () => { g.beginPath(); g.moveTo(-R * 0.25, -R * 0.35 + fl); g.lineTo(R * 0.3, -R * 0.35 + fl); g.quadraticCurveTo(R * 0.75, R * 0.3, R * 0.85, R * 0.88); for (let i = 0; i < 5; i++) g.quadraticCurveTo(R * (0.85 - (i + 0.5) * 0.34), R * (0.95 + Math.sin(ph * TAU + i) * 0.06), R * (0.85 - (i + 1) * 0.34), R * 0.88); g.quadraticCurveTo(-R * 0.7, R * 0.3, -R * 0.25, -R * 0.35 + fl); g.closePath(); }, p.c1, 0, R * 0.3, R * 0.85);
  line(g, [R * 0.02, -R * 0.2 + fl, R * 0.02, R * 0.88], R * 0.08, rgba(p.c2, 0.7));
  // 法杖（后）
  const sx = R * 0.85, sy = -R * 0.2 + fl;
  limb(g, [sx, sy - R * 0.35, sx - R * 0.1, R * 0.95], R * 0.09, '#6a4428', R * 0.03);
  // 袖子与手
  part(g, () => { g.beginPath(); g.ellipse(R * 0.6, -R * 0.05 + fl, R * 0.3, R * 0.17, -0.4, 0, TAU); }, shade(p.c1, -0.1), R * 0.6, -R * 0.05 + fl, R * 0.3);
  // 兜帽 + 脸
  const hy2 = -R * 0.55 + fl;
  part(g, () => { g.beginPath(); g.arc(R * 0.05, hy2, R * 0.48, 0, TAU); }, shade(p.c1, -0.15), R * 0.05, hy2, R * 0.48);
  ell(g, R * 0.15, hy2 + R * 0.08, R * 0.3, R * 0.28, '#0e0a18');
  glowEye(g, R * 0.07, hy2 + R * 0.05, R * 0.07, p.c2); glowEye(g, R * 0.28, hy2 + R * 0.05, R * 0.07, p.c2);
  // 尖帽
  part(g, () => { g.beginPath(); g.moveTo(-R * 0.68, hy2 - R * 0.2); g.quadraticCurveTo(R * 0.05, hy2 - R * 0.42, R * 0.78, hy2 - R * 0.2); g.lineTo(R * 0.35, hy2 - R * 0.35); g.quadraticCurveTo(R * 0.2, hy2 - R * 1.0, -R * 0.35 + s * R * 0.05, hy2 - R * 1.25); g.quadraticCurveTo(-R * 0.05, hy2 - R * 0.75, -R * 0.3, hy2 - R * 0.35); g.closePath(); }, p.c1, 0, hy2 - R * 0.55, R * 0.6);
  g.fillStyle = p.c2; g.fillRect(-R * 0.3, hy2 - R * 0.45, R * 0.64, R * 0.1);
  // 法球
  g.save(); g.shadowColor = p.c2; g.shadowBlur = R * 0.6;
  const og = g.createRadialGradient(sx - R * 0.05, sy - R * 0.5, 0, sx, sy - R * 0.45, R * 0.25);
  og.addColorStop(0, '#ffffff'); og.addColorStop(0.4, p.c2); og.addColorStop(1, shade(p.c2, -0.4));
  circ(g, sx, sy - R * 0.45, R * 0.22 * (1 + 0.1 * s), og);
  g.restore();
  for (let i = 0; i < 3; i++) { const a = ph * TAU + i * 2.1; circ(g, sx + Math.cos(a) * R * 0.38, sy - R * 0.45 + Math.sin(a) * R * 0.2, R * 0.04, rgba(p.c2, 0.9)); }
};
SH.charger = function (g, R, p, ph) {
  const t = ph * TAU, s = Math.sin(t), pitch = Math.sin(t) * 0.06;
  g.save(); g.rotate(pitch);
  const legs = [[-0.6, 0], [-0.35, 0.5], [0.4, 0.25], [0.65, 0.75]];
  for (const [x, o] of legs) {
    const a = Math.sin(t + o * TAU) * 0.6;
    limb(g, [R * x, R * 0.2, R * x + Math.sin(a) * R * 0.3, R * 0.55, R * x + Math.sin(a) * R * 0.38, R * 0.85], R * 0.15, shade(p.c1, x < 0 ? -0.35 : -0.2));
  }
  // 尾巴
  line(g, [-R * 1.0, -R * 0.1, -R * 1.25, -R * 0.35 + s * R * 0.1], R * 0.08, shade(p.c1, -0.3));
  part(g, () => { g.beginPath(); g.ellipse(-R * 0.05, 0, R * 1.05, R * 0.62, 0, 0, TAU); }, p.c1, -R * 0.05, 0, R * 0.95);
  // 鬃毛
  for (let i = 0; i < 6; i++) spikes(g, [R * (-0.75 + i * 0.25), -R * 0.42, R * (-0.65 + i * 0.25), -R * (0.85 + (i % 2) * 0.1), R * (-0.5 + i * 0.25), -R * 0.5], shade(p.c1, -0.45));
  // 头
  part(g, () => { g.beginPath(); g.ellipse(R * 0.85, R * 0.05, R * 0.48, R * 0.4, 0.15, 0, TAU); }, p.c1, R * 0.85, R * 0.05, R * 0.48);
  part(g, () => { g.beginPath(); g.ellipse(R * 1.22, R * 0.18, R * 0.2, R * 0.17, 0, 0, TAU); }, shade(p.c1, 0.2), R * 1.22, R * 0.18, R * 0.2, { lw: R * 0.05 });
  circ(g, R * 1.28, R * 0.15, R * 0.04, '#1a1020'); circ(g, R * 1.2, R * 0.15, R * 0.04, '#1a1020');
  spikes(g, [R * 1.05, R * 0.28, R * 1.42, -R * 0.12, R * 1.15, R * 0.36], p.c2);
  spikes(g, [R * 0.6, -R * 0.22, R * 0.48, -R * 0.75, R * 0.85, -R * 0.3], shade(p.c1, -0.3));
  glowEye(g, R * 0.95, -R * 0.08, R * 0.09, '#ff3a3a');
  g.restore();
};
SH.crownSlime = function (g, R, p, ph) {
  SH.slime(g, R, p, ph);
  const s = Math.sin(ph * TAU);
  g.save(); g.translate(0, -R * 0.9 + s * R * 0.04);
  part(g, () => polyPath(g, [-R * 0.48, R * 0.18, -R * 0.55, -R * 0.3, -R * 0.27, -R * 0.02, 0, -R * 0.45, R * 0.27, -R * 0.02, R * 0.55, -R * 0.3, R * 0.48, R * 0.18]), '#ffc83a', 0, -R * 0.05, R * 0.5, { lw: R * 0.04 });
  g.fillStyle = shade('#ffc83a', -0.3); g.fillRect(-R * 0.48, R * 0.08, R * 0.96, R * 0.1);
  for (const [x, y, c] of [[0, -0.1, '#ff3a6a'], [-0.27, 0.05, '#3ad0ff'], [0.27, 0.05, '#3ad0ff']]) glowEye(g, R * x, R * y, R * 0.06, c);
  for (const x of [-0.55, 0, 0.55]) circ(g, R * x, x ? -R * 0.32 : -R * 0.47, R * 0.05, '#fff2b0');
  g.restore();
  // 口水
  ell(g, R * 0.32, R * 0.36, R * 0.04, R * 0.08 * (1 + 0.3 * s), 'rgba(220,255,240,.8)');
};
SH.scorpion = function (g, R, p, ph) {
  const t = ph * TAU, s = Math.sin(t);
  // 腿
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const k = Math.sin(t + i * 2 + (sx > 0 ? 0 : 1)) * R * 0.08;
    limb(g, [sx * R * 0.45, R * (0.05 + i * 0.22), sx * R * 0.9, R * (0.0 + i * 0.25) + k, sx * R * 1.05, R * (0.4 + i * 0.22)], R * 0.08, shade(p.c1, -0.4), R * 0.03);
  }
  // 尾巴：沿曲线排列的甲壳节段
  const tx0 = -R * 0.15, ty0 = -R * 0.15, tx1 = -R * 1.05, ty1 = -R * 1.45, tx2 = R * 0.3 + s * R * 0.1, ty2 = -R * 1.4 + s * R * 0.08;
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const u = i / (segs - 1), iu = 1 - u;
    const x = iu * iu * tx0 + 2 * iu * u * tx1 + u * u * tx2, y = iu * iu * ty0 + 2 * iu * u * ty1 + u * u * ty2;
    const rr = R * (0.24 - u * 0.1);
    part(g, () => { g.beginPath(); g.arc(x, y, rr, 0, TAU); }, shade(p.c1, -0.05 * (i % 2)), x, y, rr, { lw: R * 0.04 });
    if (i === segs - 1) {
      g.save(); g.translate(x, y); g.rotate(0.6 + s * 0.15);
      part(g, () => { g.beginPath(); g.moveTo(-R * 0.12, -R * 0.05); g.quadraticCurveTo(R * 0.3, -R * 0.05, R * 0.38, R * 0.32); g.quadraticCurveTo(R * 0.12, R * 0.12, -R * 0.05, R * 0.12); g.closePath(); }, p.c2, R * 0.12, R * 0.1, R * 0.25, { lw: R * 0.04 });
      g.restore();
      glowEye(g, x + R * 0.1, y + R * 0.05, R * 0.06, p.c2);
    }
  }
  // 钳
  for (const sx of [-1, 1]) {
    const op = (0.25 + 0.2 * Math.sin(t * 2 + sx)) ;
    limb(g, [sx * R * 0.45, -R * 0.15, sx * R * 0.85, -R * 0.45, sx * R * 1.05, -R * 0.75], R * 0.14, shade(p.c1, -0.1));
    g.save(); g.translate(sx * R * 1.08, -R * 0.82);
    part(g, () => { g.beginPath(); g.ellipse(0, 0, R * 0.28, R * 0.2, sx * 0.6, 0, TAU); }, p.c1, 0, 0, R * 0.28);
    for (const k of [-1, 1]) { g.save(); g.rotate(-Math.PI / 2 + k * op); part(g, () => { g.beginPath(); g.moveTo(-R * 0.08, 0); g.quadraticCurveTo(-R * 0.1, R * 0.35, R * 0.02, R * 0.45); g.quadraticCurveTo(R * 0.08, R * 0.25, R * 0.08, 0); g.closePath(); }, shade(p.c1, 0.1), 0, R * 0.2, R * 0.2, { lw: R * 0.035 }); g.restore(); }
    g.restore();
  }
  // 身体甲壳
  part(g, () => { g.beginPath(); g.ellipse(0, R * 0.12, R * 0.68, R * 0.6, 0, 0, TAU); }, p.c1, 0, R * 0.12, R * 0.68, { hl: 0.45 });
  for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, R * (0.25 + i * 0.14), R * (0.62 - i * 0.12), R * 0.18, 0, 0.15, Math.PI - 0.15); g.lineWidth = R * 0.04; g.strokeStyle = rgba('#000000', 0.35); g.stroke(); }
  eye(g, -R * 0.2, -R * 0.2, R * 0.13, { look: 0.2, iris: '#5a0a0a' }); eye(g, R * 0.2, -R * 0.2, R * 0.13, { look: 0.2, iris: '#5a0a0a' });
  brow(g, -R * 0.35, -R * 0.38, -R * 0.08, -R * 0.3, R * 0.06); brow(g, R * 0.35, -R * 0.38, R * 0.08, -R * 0.3, R * 0.06);
};
SH.lich = function (g, R, p, ph) {
  const t = ph * TAU, fl = Math.sin(t) * R * 0.06;
  // 灵魂丝带
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * R * 0.6, -R * 0.1 + fl); g.bezierCurveTo(sx * R * 1.2, R * 0.0, sx * R * 0.9, R * 0.7, sx * R * 1.4, R * 0.9 + Math.sin(t + sx) * R * 0.1); g.lineWidth = R * 0.1; g.strokeStyle = rgba(p.c2, 0.45); g.lineCap = 'round'; g.stroke(); }
  // 长袍
  const path = () => {
    g.beginPath(); g.moveTo(-R * 0.8, -R * 0.4 + fl); g.quadraticCurveTo(-R * 1.15, R * 0.4, -R * 0.95, R * 0.95);
    for (let i = 0; i < 6; i++) g.quadraticCurveTo(-R * 0.95 + (i + 0.5) * R * 0.32, R * (i % 2 ? 0.75 : 1.2) + Math.sin(t + i) * R * 0.06, -R * 0.95 + (i + 1) * R * 0.32, R * 0.95);
    g.quadraticCurveTo(R * 1.15, R * 0.4, R * 0.8, -R * 0.4 + fl); g.quadraticCurveTo(0, -R * 1.15 + fl, -R * 0.8, -R * 0.4 + fl); g.closePath();
  };
  path(); const gr = g.createLinearGradient(0, -R + fl, 0, R * 1.2);
  gr.addColorStop(0, shade(p.c1, 0.2)); gr.addColorStop(0.6, p.c1); gr.addColorStop(1, rgba(shade(p.c1, -0.4), 0.3));
  g.fillStyle = gr; g.fill(); g.lineWidth = R * 0.06; g.strokeStyle = OUTC; g.stroke();
  line(g, [0, -R * 0.2 + fl, 0, R * 0.95], R * 0.1, rgba(p.c2, 0.5));
  // 头骨
  const ky = -R * 0.25 + fl;
  part(g, () => { g.beginPath(); g.arc(0, ky, R * 0.48, 0, TAU); }, '#e9e4d2', 0, ky, R * 0.48);
  ell(g, -R * 0.18, ky - R * 0.02, R * 0.13, R * 0.16, '#10122a'); ell(g, R * 0.18, ky - R * 0.02, R * 0.13, R * 0.16, '#10122a');
  glowEye(g, -R * 0.18, ky, R * 0.07, p.c2); glowEye(g, R * 0.18, ky, R * 0.07, p.c2);
  for (let i = 0; i < 5; i++) line(g, [-R * 0.16 + i * R * 0.08, ky + R * 0.25, -R * 0.16 + i * R * 0.08, ky + R * 0.38], R * 0.04, '#10122a');
  // 冠
  part(g, () => polyPath(g, [-R * 0.52, ky - R * 0.32, -R * 0.45, ky - R * 1.0, -R * 0.2, ky - R * 0.55, 0, ky - R * 1.15, R * 0.2, ky - R * 0.55, R * 0.45, ky - R * 1.0, R * 0.52, ky - R * 0.32]), shade(p.c2, -0.2), 0, ky - R * 0.6, R * 0.5, { lw: R * 0.04 });
  glowEye(g, 0, ky - R * 0.5, R * 0.07, '#ffffff');
  // 法杖
  const sx = R * 1.0, sy = -R * 0.2 + fl;
  limb(g, [sx, sy - R * 0.2, sx - R * 0.15, R * 1.05], R * 0.08, '#3a3050', R * 0.03);
  g.save(); g.shadowColor = p.c2; g.shadowBlur = R * 0.5;
  const og = g.createRadialGradient(sx, sy - R * 0.35, 0, sx, sy - R * 0.35, R * 0.26);
  og.addColorStop(0, '#fff'); og.addColorStop(0.5, p.c2); og.addColorStop(1, shade(p.c2, -0.5));
  circ(g, sx, sy - R * 0.35, R * 0.24, og); g.restore();
};
SH.demon = function (g, R, p, ph) {
  const t = ph * TAU, f = Math.sin(t);
  for (const sx of [-1, 1]) {
    const ty = -R * (0.3 + 0.35 * f);
    part(g, () => {
      g.beginPath(); g.moveTo(sx * R * 0.5, -R * 0.2);
      g.quadraticCurveTo(sx * R * 1.4, ty - R * 1.1, sx * R * 1.68, ty - R * 0.1);
      g.quadraticCurveTo(sx * R * 1.4, ty + R * 0.1, sx * R * 1.35, R * 0.4);
      g.quadraticCurveTo(sx * R * 1.05, R * 0.15, sx * R * 0.95, R * 0.6);
      g.quadraticCurveTo(sx * R * 0.75, R * 0.3, sx * R * 0.5, R * 0.5); g.closePath();
    }, '#5a1018', sx * R * 1.0, ty * 0.3, R * 0.8, { hl: 0.15 });
    line(g, [sx * R * 0.55, -R * 0.15, sx * R * 1.68, ty - R * 0.1], R * 0.06, '#2a0610');
  }
  for (const sx of [-1, 1]) part(g, () => { g.beginPath(); g.moveTo(sx * R * 0.45, -R * 0.55); g.quadraticCurveTo(sx * R * 1.15, -R * 0.75, sx * R * 0.95, -R * 1.35); g.quadraticCurveTo(sx * R * 0.75, -R * 0.95, sx * R * 0.2, -R * 0.78); g.closePath(); }, p.c2, sx * R * 0.7, -R * 0.9, R * 0.4, { lw: R * 0.05 });
  part(g, () => { g.beginPath(); g.arc(0, R * 0.05, R * 0.85, 0, TAU); }, p.c1, 0, R * 0.05, R * 0.85);
  // 火焰鬃
  g.save(); g.shadowColor = '#ff8a2a'; g.shadowBlur = R * 0.3;
  for (let i = 0; i < 5; i++) { const x = R * (-0.4 + i * 0.2), h = R * (0.35 + 0.15 * Math.sin(t * 2 + i)); spikes(g, [x - R * 0.12, -R * 0.62, x, -R * 0.62 - h, x + R * 0.12, -R * 0.62], i % 2 ? '#ffb43a' : '#ff6a2a'); }
  g.restore();
  brow(g, -R * 0.62, -R * 0.45, -R * 0.12, -R * 0.15, R * 0.12); brow(g, R * 0.62, -R * 0.45, R * 0.12, -R * 0.15, R * 0.12);
  glowEye(g, -R * 0.32, -R * 0.08, R * 0.13, p.c2); glowEye(g, R * 0.32, -R * 0.08, R * 0.13, p.c2);
  g.beginPath(); g.moveTo(-R * 0.52, R * 0.28); g.quadraticCurveTo(0, R * (0.95 + 0.08 * f), R * 0.52, R * 0.28); g.quadraticCurveTo(0, R * 0.5, -R * 0.52, R * 0.28);
  const mg = g.createRadialGradient(0, R * 0.55, 0, 0, R * 0.55, R * 0.4); mg.addColorStop(0, '#ffcf4a'); mg.addColorStop(1, '#5a0810');
  g.fillStyle = mg; g.fill(); g.lineWidth = R * 0.05; g.strokeStyle = OUTC; g.stroke();
  for (let i = -2; i <= 2; i++) polyPath(g, [i * R * 0.18 - R * 0.06, R * 0.38, i * R * 0.18, R * 0.58, i * R * 0.18 + R * 0.06, R * 0.38]), g.fillStyle = '#fff6e0', g.fill();
};

// 机器人：方头身 + 单目镜 + 天线 + 交替行走
SH.robot = function (g, R, p, ph) {
  const t = ph * TAU, s = Math.sin(t), bob = Math.abs(s) * R * 0.08, base = p.c1, glow = p.c2;
  for (const k of [-1, 1]) {
    const lx = k * R * 0.35, sw = s * k * R * 0.22;
    limb(g, [lx, R * 0.35 - bob, lx + sw, R * 0.82], R * 0.16, shade(base, -0.35));
    part(g, () => { g.beginPath(); g.roundRect(lx + sw - R * 0.2, R * 0.75, R * 0.4, R * 0.2, R * 0.06); }, shade(base, -0.2), lx + sw, R * 0.85, R * 0.2, { ao: false });
  }
  // 后臂
  limb(g, [-R * 0.6, -R * 0.1 - bob, -R * 0.85, R * 0.25 - bob + s * R * 0.08], R * 0.14, shade(base, -0.3));
  // 躯体
  const ty = -bob;
  part(g, () => { g.beginPath(); g.roundRect(-R * 0.7, -R * 0.85 + ty, R * 1.4, R * 1.25, R * 0.22); }, base, 0, -R * 0.2 + ty, R * 0.8);
  g.fillStyle = metal(g, -R * 0.5, ty, R * 0.5, ty, shade(base, -0.15));
  g.fillRect(-R * 0.48, R * 0.0 + ty, R * 0.96, R * 0.22);
  for (let i = 0; i < 3; i++) circ(g, -R * 0.3 + i * R * 0.3, R * 0.11 + ty, R * 0.05, i === 1 ? glow : '#1a1e28');
  // 面罩
  part(g, () => { g.beginPath(); g.roundRect(-R * 0.5, -R * 0.68 + ty, R * 1.05, R * 0.46, R * 0.18); }, '#141824', 0, -R * 0.45 + ty, R * 0.5, { hl: 0.5, light: 0.25 });
  glowEye(g, R * 0.2 + s * R * 0.06, -R * 0.45 + ty, R * 0.13, glow);
  // 天线
  line(g, [-R * 0.3, -R * 0.85 + ty, -R * 0.4, -R * 1.25 + ty], R * 0.06, OUTC);
  glowEye(g, -R * 0.4, -R * 1.28 + ty, R * 0.08, glow);
  // 前臂 + 枪管
  const ay = -R * 0.05 + ty - s * R * 0.05;
  limb(g, [R * 0.55, -R * 0.15 + ty, R * 0.85, ay + R * 0.1], R * 0.15, shade(base, 0.05));
  part(g, () => { g.beginPath(); g.roundRect(R * 0.72, ay - R * 0.04, R * 0.52, R * 0.22, R * 0.06); }, '#3a3e4a', R * 0.95, ay + R * 0.06, R * 0.3, { ao: false });
  circ(g, R * 1.24, ay + R * 0.07, R * 0.05, glow);
  // 铆钉 & 划痕
  circ(g, -R * 0.55, -R * 0.75 + ty, R * 0.04, shade(base, 0.5)); circ(g, R * 0.55, -R * 0.75 + ty, R * 0.04, shade(base, 0.5));
  line(g, [-R * 0.55, R * 0.28 + ty, -R * 0.3, R * 0.18 + ty], R * 0.03, rgba('#000', 0.35));
};
// 攻击无人机：四旋翼 + 红色目镜 + 下挂炮管
SH.edrone = function (g, R, p, ph) {
  const t = ph * TAU, bob = Math.sin(t) * R * 0.1, base = p.c1, glow = p.c2;
  const arms = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [ax, ay] of arms) line(g, [0, bob, ax * R * 0.95, ay * R * 0.55 + bob - R * 0.2], R * 0.14, OUTC), line(g, [0, bob, ax * R * 0.95, ay * R * 0.55 + bob - R * 0.2], R * 0.08, shade(base, -0.2));
  for (const [ax, ay] of arms) {
    const x = ax * R * 0.95, y = ay * R * 0.55 + bob - R * 0.2;
    circ(g, x, y, R * 0.16, '#20242e');
    g.save(); g.translate(x, y - R * 0.08); g.rotate(t * 3 + ax);
    ell(g, 0, 0, R * 0.55, R * 0.16, rgba('#dfe8ff', 0.35));
    ell(g, 0, 0, R * 0.5, R * 0.05, rgba('#ffffff', 0.55));
    g.restore();
    circ(g, x, y + R * 0.06, R * 0.06, ay < 0 ? '#5aff8a' : glow);
  }
  // 机身
  part(g, () => { g.beginPath(); g.ellipse(0, bob, R * 0.62, R * 0.45, 0, 0, TAU); }, base, 0, bob, R * 0.6);
  part(g, () => { g.beginPath(); g.ellipse(0, bob - R * 0.12, R * 0.4, R * 0.22, 0, Math.PI, TAU); g.closePath(); }, shade(base, 0.25), 0, bob - R * 0.2, R * 0.4, { ao: false });
  // 目镜
  circ(g, R * 0.25, bob + R * 0.05, R * 0.22, '#0e1018');
  glowEye(g, R * 0.27, bob + R * 0.05, R * 0.12, glow);
  // 炮管
  part(g, () => { g.beginPath(); g.roundRect(-R * 0.1, bob + R * 0.32, R * 0.6, R * 0.16, R * 0.05); }, '#2a2e3a', R * 0.2, bob + R * 0.4, R * 0.3, { ao: false });
  // 警示条
  g.fillStyle = '#ffd24a'; g.fillRect(-R * 0.45, bob - R * 0.04, R * 0.2, R * 0.08);
  g.fillStyle = '#1a1a1a'; g.fillRect(-R * 0.38, bob - R * 0.04, R * 0.06, R * 0.08);
};
// 腐朽古树：树冠 + 树干面孔 + 摆动枝臂 + 根须
SH.treant = function (g, R, p, ph) {
  const t = ph * TAU, s = Math.sin(t), base = p.c1, glow = p.c2;
  const bark = base, leaf = '#3e5a2a', leafD = '#26381c';
  // 根须
  for (let i = 0; i < 5; i++) {
    const x = R * (-0.7 + i * 0.35), k = (i % 2 ? 1 : -1) * s * R * 0.08;
    limb(g, [x * 0.6, R * 0.5, x + k, R * 0.78, x * 1.25 + k, R * 0.92], R * 0.13, shade(bark, -0.3));
  }
  // 后枝臂
  limb(g, [-R * 0.45, -R * 0.15, -R * 1.0, -R * 0.35 + s * R * 0.12, -R * 1.35, R * 0.05 + s * R * 0.15], R * 0.16, shade(bark, -0.35));
  // 树冠（后层）
  for (const [x, y, r] of [[-R * 0.75, -R * 1.0, 0.5], [R * 0.7, -R * 1.05, 0.48], [0, -R * 1.2, 0.55]]) part(g, () => { g.beginPath(); g.arc(x + s * R * 0.03, y, R * r, 0, TAU); }, leafD, x, y, R * r, { hl: 0.12 });
  // 树干
  part(g, () => {
    g.beginPath(); g.moveTo(-R * 0.6, R * 0.6);
    g.quadraticCurveTo(-R * 0.75, -R * 0.2, -R * 0.5, -R * 0.85);
    g.lineTo(R * 0.5, -R * 0.85); g.quadraticCurveTo(R * 0.78, -R * 0.2, R * 0.6, R * 0.6); g.closePath();
  }, bark, 0, -R * 0.1, R * 0.8, { hl: 0.2 });
  // 树皮纹理
  for (let i = 0; i < 6; i++) { const x = R * (-0.45 + i * 0.18); line(g, [x, R * 0.5, x + R * 0.05 * Math.sin(i * 2.1), R * 0.05, x - R * 0.04, -R * 0.65], R * 0.035, rgba('#140a04', 0.45)); }
  // 树冠（前层）
  for (const [x, y, r, c] of [[-R * 0.45, -R * 1.15, 0.48, leaf], [R * 0.4, -R * 1.2, 0.5, leaf], [0, -R * 1.38, 0.42, shade(leaf, 0.1)]]) part(g, () => { g.beginPath(); g.arc(x + s * R * 0.04, y, R * r, 0, TAU); }, c, x, y, R * r, { hl: 0.2 });
  // 发光孢子 / 蘑菇
  g.save(); g.shadowColor = glow; g.shadowBlur = R * 0.2;
  for (let i = 0; i < 7; i++) { const a = i * 1.7 + t * 0.3; circ(g, Math.cos(a) * R * 0.75, -R * 1.2 + Math.sin(a * 1.3) * R * 0.35, R * 0.05, glow); }
  g.restore();
  for (const [x, y] of [[-R * 0.52, R * 0.25], [R * 0.48, -R * 0.4]]) { part(g, () => { g.beginPath(); g.ellipse(x, y, R * 0.14, R * 0.08, 0, Math.PI, TAU); g.closePath(); }, '#c85a3a', x, y - R * 0.04, R * 0.14, { ao: false }); circ(g, x - R * 0.04, y - R * 0.05, R * 0.025, '#fff'); }
  // 面孔：深陷眼窝 + 发光眼 + 裂口
  ell(g, -R * 0.24, -R * 0.38, R * 0.18, R * 0.12, '#1a0c06'); ell(g, R * 0.26, -R * 0.38, R * 0.18, R * 0.12, '#1a0c06');
  glowEye(g, -R * 0.22, -R * 0.37, R * 0.08, glow); glowEye(g, R * 0.28, -R * 0.37, R * 0.08, glow);
  brow(g, -R * 0.42, -R * 0.56, -R * 0.08, -R * 0.46, R * 0.08); brow(g, R * 0.44, -R * 0.56, R * 0.1, -R * 0.46, R * 0.08);
  g.beginPath(); g.moveTo(-R * 0.3, R * 0.0); g.quadraticCurveTo(0, R * (0.3 + 0.08 * s), R * 0.32, R * 0.0); g.quadraticCurveTo(0, R * 0.12, -R * 0.3, R * 0.0);
  const mg = g.createRadialGradient(0, R * 0.12, 0, 0, R * 0.12, R * 0.3); mg.addColorStop(0, rgba(glow, 0.9)); mg.addColorStop(1, '#100804');
  g.fillStyle = mg; g.fill(); g.lineWidth = R * 0.04; g.strokeStyle = OUTC; g.stroke();
  // 前枝臂（爪状）
  const hx2 = R * 1.25, hy = R * 0.05 - s * R * 0.15;
  limb(g, [R * 0.45, -R * 0.2, R * 0.95, -R * 0.3 - s * R * 0.1, hx2, hy], R * 0.17, shade(bark, 0.05));
  for (const a of [-0.6, 0, 0.6]) limb(g, [hx2, hy, hx2 + Math.cos(a) * R * 0.3, hy + Math.sin(a) * R * 0.3 + R * 0.08], R * 0.06, shade(bark, -0.1));
  // 苔藓挂
  for (let i = 0; i < 4; i++) line(g, [R * (-0.4 + i * 0.28), -R * 0.82, R * (-0.42 + i * 0.28), -R * (0.6 - 0.05 * i)], R * 0.05, rgba('#7aa04a', 0.8));
};
// 钢铁巨神：双足机甲 + 肩炮 + 核心
SH.mech = function (g, R, p, ph) {
  const t = ph * TAU, s = Math.sin(t), bob = Math.abs(s) * R * 0.05, base = p.c1, glow = p.c2;
  const plate = (fn, col, cx, cy, pr) => part(g, fn, col, cx, cy, pr, { hl: 0.3 });
  // 腿
  for (const k of [-1, 1]) {
    const lx = k * R * 0.42, sw = s * k * R * 0.16;
    limb(g, [lx, R * 0.25 - bob, lx + sw * 0.5, R * 0.55, lx + sw, R * 0.82], R * 0.2, shade(base, -0.35));
    plate(() => { g.beginPath(); g.roundRect(lx + sw * 0.5 - R * 0.17, R * 0.42, R * 0.34, R * 0.24, R * 0.06); }, shade(base, -0.1), lx, R * 0.54, R * 0.2);
    plate(() => { g.beginPath(); g.roundRect(lx + sw - R * 0.28, R * 0.78, R * 0.56, R * 0.16, R * 0.05); }, '#3a3e48', lx + sw, R * 0.86, R * 0.28);
  }
  const ty = -bob;
  // 后肩炮
  plate(() => { g.beginPath(); g.roundRect(-R * 1.05, -R * 0.95 + ty, R * 0.5, R * 0.42, R * 0.08); }, shade(base, -0.3), -R * 0.8, -R * 0.75 + ty, R * 0.3);
  for (let i = 0; i < 3; i++) circ(g, -R * 0.92 + i * R * 0.14, -R * 0.74 + ty, R * 0.05, '#0e1016');
  // 后臂
  limb(g, [-R * 0.65, -R * 0.35 + ty, -R * 0.95, R * 0.1 + ty + s * R * 0.08], R * 0.2, shade(base, -0.4));
  // 躯干
  plate(() => { g.beginPath(); g.moveTo(-R * 0.75, -R * 0.75 + ty); g.lineTo(R * 0.75, -R * 0.75 + ty); g.lineTo(R * 0.6, R * 0.3 + ty); g.lineTo(-R * 0.6, R * 0.3 + ty); g.closePath(); }, base, 0, -R * 0.25 + ty, R * 0.8);
  g.fillStyle = metal(g, -R * 0.6, 0, R * 0.6, 0, shade(base, -0.2)); g.fillRect(-R * 0.58, R * 0.05 + ty, R * 1.16, R * 0.12);
  // 黄黑警示
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#1a1a1a' : '#ffc23a'; g.fillRect(-R * 0.58 + i * R * 0.193, R * 0.17 + ty, R * 0.193, R * 0.07); }
  // 核心
  g.save(); g.shadowColor = glow; g.shadowBlur = R * 0.4;
  circ(g, 0, -R * 0.3 + ty, R * 0.22, '#140a0a');
  const cg = g.createRadialGradient(0, -R * 0.3 + ty, 0, 0, -R * 0.3 + ty, R * 0.18); cg.addColorStop(0, '#fff'); cg.addColorStop(0.4, glow); cg.addColorStop(1, shade(glow, -0.5));
  circ(g, 0, -R * 0.3 + ty, R * (0.16 + 0.02 * s), cg);
  g.restore();
  // 头部驾驶舱
  plate(() => { g.beginPath(); g.roundRect(-R * 0.3, -R * 1.12 + ty, R * 0.66, R * 0.4, R * 0.12); }, shade(base, 0.1), R * 0.03, -R * 0.92 + ty, R * 0.35);
  g.fillStyle = glow; g.save(); g.shadowColor = glow; g.shadowBlur = R * 0.2;
  g.beginPath(); g.moveTo(-R * 0.12, -R * 0.98 + ty); g.lineTo(R * 0.32, -R * 0.98 + ty); g.lineTo(R * 0.28, -R * 0.88 + ty); g.lineTo(-R * 0.08, -R * 0.88 + ty); g.closePath(); g.fill(); g.restore();
  // 前肩甲 + 前臂加特林
  plate(() => { g.beginPath(); g.ellipse(R * 0.7, -R * 0.62 + ty, R * 0.32, R * 0.24, 0.3, 0, TAU); }, shade(base, 0.15), R * 0.7, -R * 0.62 + ty, R * 0.3);
  const ay = -R * 0.1 + ty - s * R * 0.06;
  limb(g, [R * 0.7, -R * 0.45 + ty, R * 0.9, ay], R * 0.2, shade(base, -0.1));
  plate(() => { g.beginPath(); g.roundRect(R * 0.75, ay - R * 0.16, R * 0.7, R * 0.32, R * 0.08); }, '#3a3e48', R * 1.1, ay, R * 0.35);
  for (let i = -1; i <= 1; i++) line(g, [R * 1.4, ay + i * R * 0.08, R * 1.68, ay + i * R * 0.08], R * 0.05, '#20222a');
  circ(g, R * 1.68, ay, R * 0.06, rgba(glow, 0.8));
  // 铆钉
  for (const [x, y] of [[-R * 0.62, -R * 0.65], [R * 0.6, -R * 0.65], [-R * 0.5, R * 0.18], [R * 0.5, R * 0.18]]) circ(g, x, y + ty, R * 0.035, shade(base, 0.6));
};
// 雷霆巨龙：大翼扑动 + 长颈 + 尾巴 + 雷纹
SH.wyvern = function (g, R, p, ph) {
  const t = ph * TAU, f = Math.sin(t), base = p.c1, glow = p.c2;
  // 尾巴
  limb(g, [-R * 0.4, R * 0.15, -R * 0.95, R * 0.35 + f * R * 0.1, -R * 1.4, R * 0.15 + f * R * 0.18, -R * 1.65, -R * 0.1 + f * R * 0.2], R * 0.16, shade(base, -0.15));
  spikes(g, [-R * 1.55, -R * 0.15 + f * R * 0.2, -R * 1.76, -R * 0.15 + f * R * 0.2, -R * 1.62, R * 0.08 + f * R * 0.2], glow);
  // 翅膀（远端暗、近端亮）
  for (const sx of [-1, 1]) {
    const far = sx < 0, ty = -R * (0.15 + 0.3 * f) * (far ? 0.85 : 1), ox = far ? -R * 0.15 : R * 0.05;
    const col = far ? shade(base, -0.35) : base;
    part(g, () => {
      g.beginPath(); g.moveTo(ox, -R * 0.2);
      g.quadraticCurveTo(ox + sx * R * 0.6, ty - R * 1.15, ox + sx * R * 0.2 - R * 0.55, ty - R * 1.3);
      g.quadraticCurveTo(ox - R * 0.9, ty - R * 0.7, ox - R * 1.25, ty - R * 0.1);
      g.quadraticCurveTo(ox - R * 0.85, ty - R * 0.05, ox - R * 0.8, R * 0.15);
      g.quadraticCurveTo(ox - R * 0.45, R * 0.0, ox - R * 0.3, R * 0.25); g.closePath();
    }, col, ox - R * 0.4, ty * 0.4 - R * 0.4, R * 0.9, { hl: 0.15, aoA: 0.3 });
    // 翼骨
    line(g, [ox, -R * 0.2, ox + sx * R * 0.2 - R * 0.55, ty - R * 1.3], R * 0.06, shade(base, -0.55));
    line(g, [ox - R * 0.15, -R * 0.4 + ty * 0.3, ox - R * 1.25, ty - R * 0.1], R * 0.045, shade(base, -0.55));
    line(g, [ox - R * 0.2, -R * 0.2 + ty * 0.2, ox - R * 0.8, R * 0.15], R * 0.04, shade(base, -0.55));
    if (!far) { g.save(); g.shadowColor = glow; g.shadowBlur = R * 0.25; line(g, [ox - R * 0.3, ty - R * 0.9, ox - R * 0.5, ty - R * 0.6, ox - R * 0.4, ty - R * 0.45, ox - R * 0.65, ty - R * 0.15], R * 0.05, glow); g.restore(); }
  }
  // 身体
  part(g, () => { g.beginPath(); g.ellipse(0, R * 0.12, R * 0.62, R * 0.42, -0.15, 0, TAU); }, base, 0, R * 0.1, R * 0.62);
  part(g, () => { g.beginPath(); g.ellipse(R * 0.05, R * 0.28, R * 0.45, R * 0.22, -0.15, 0, TAU); }, mix(base, '#e8d8a0', 0.55), 0, R * 0.28, R * 0.4, { ao: false });
  // 腿爪
  for (const k of [-0.25, 0.25]) limb(g, [R * k, R * 0.4, R * (k + 0.1), R * 0.7 + f * R * 0.04], R * 0.12, shade(base, -0.25));
  // 颈 + 头
  const hx = R * 1.05, hy = -R * 0.55 + f * R * 0.06;
  limb(g, [R * 0.35, -R * 0.05, R * 0.7, -R * 0.4, hx - R * 0.15, hy + R * 0.05], R * 0.24, base);
  part(g, () => { g.beginPath(); g.moveTo(hx - R * 0.35, hy - R * 0.22); g.quadraticCurveTo(hx + R * 0.1, hy - R * 0.32, hx + R * 0.6, hy - R * 0.05); g.lineTo(hx + R * 0.58, hy + R * 0.1); g.quadraticCurveTo(hx + R * 0.1, hy + R * 0.26, hx - R * 0.3, hy + R * 0.2); g.closePath(); }, base, hx, hy, R * 0.4);
  // 下颚（张合）
  const jaw = 0.08 + 0.08 * Math.max(0, f);
  part(g, () => { g.beginPath(); g.moveTo(hx - R * 0.1, hy + R * 0.12); g.lineTo(hx + R * 0.5, hy + R * 0.12 + R * jaw); g.lineTo(hx - R * 0.1, hy + R * 0.25); g.closePath(); }, shade(base, -0.2), hx + R * 0.1, hy + R * 0.18, R * 0.25, { ao: false });
  // 角
  for (const k of [0, 1]) spikes(g, [hx - R * (0.25 - k * 0.12), hy - R * 0.2, hx - R * (0.75 - k * 0.1), hy - R * (0.55 + k * 0.08), hx - R * (0.05 - k * 0.1), hy - R * 0.25], mix(glow, '#ffffff', 0.4));
  glowEye(g, hx + R * 0.15, hy - R * 0.08, R * 0.08, glow);
  // 口中雷光
  g.save(); g.globalAlpha = 0.6 + 0.4 * Math.max(0, f); g.shadowColor = glow; g.shadowBlur = R * 0.3;
  circ(g, hx + R * 0.52, hy + R * 0.12, R * 0.07, '#ffffff'); g.restore();
  // 背刺
  for (let i = 0; i < 4; i++) spikes(g, [-R * 0.35 + i * R * 0.22, -R * 0.22 + i * R * 0.0, -R * 0.28 + i * R * 0.22, -R * 0.45, -R * 0.2 + i * R * 0.22, -R * 0.24], shade(glow, -0.2));
};

/* 每种形状的动画帧数与播放速度（帧/秒） */
const ANIM = { slime: [8, 9], bat: [6, 16], skeleton: [8, 10], ghost: [8, 7], orc: [8, 8], archer: [8, 9], bomber: [6, 14], golem: [8, 6], mage: [8, 7], charger: [8, 12], crownSlime: [8, 7], scorpion: [8, 8], lich: [8, 6], demon: [8, 8], robot: [8, 10], edrone: [6, 14], treant: [8, 5], mech: [8, 7], wyvern: [8, 7] };

/* ======================= 敌人烘焙（按需逐帧） ======================= */
const enemyCache = {};
Sp.enemy = function (def) {
  let e = enemyCache[def.id];
  if (e) return e;
  const big = def.r >= 30, sc = big ? S_BIG : S;
  const size = Math.ceil(def.r * 3.7);
  const a = ANIM[def.shape] || [6, 8];
  e = enemyCache[def.id] = { def, size, half: size / 2, sc, nf: a[0], fps: a[1], n: [], b: [], w: [], i: [] };
  return e;
};
const FLY = { bat: 1, ghost: 1, lich: 1, edrone: 1, wyvern: 1 };
function bakeBody(spr, fi) {
  const c = mk(spr.size * spr.sc, spr.size * spr.sc), g = c.getContext('2d');
  g.scale(spr.sc, spr.sc); g.translate(spr.size / 2, spr.size / 2);
  SH[spr.def.shape](g, spr.def.r, spr.def, fi / spr.nf);
  return c;
}
// 正常帧 = 柔和阴影 + 身体（阴影直接烘焙进帧，省去单独的阴影绘制）
function bakeFrame(spr, fi) {
  const body = spr.b[fi] || (spr.b[fi] = bakeBody(spr, fi));
  const c = mk(body.width, body.height), g = c.getContext('2d');
  const r = spr.def.r, fly = FLY[spr.def.shape];
  g.scale(spr.sc, spr.sc); g.translate(spr.size / 2, spr.size / 2);
  g.globalAlpha = fly ? 0.45 : 0.8;
  g.drawImage(Sp.shadow(), -r * 1.05, r * (fly ? 1.0 : 0.66), r * 2.1, r * 0.66);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.drawImage(body, 0, 0);
  return c;
}
function tint(src, col) {
  const k = mk(src.width, src.height), kg = k.getContext('2d');
  kg.drawImage(src, 0, 0); kg.globalCompositeOperation = 'source-atop';
  kg.fillStyle = col; kg.fillRect(0, 0, k.width, k.height);
  return k;
}
// kind: 'n' 正常 / 'w' 受击白闪 / 'i' 冰冻
Sp.frame = function (spr, fi, kind) {
  if (kind === 'w' || kind === 'i') {
    const arr = kind === 'w' ? spr.w : spr.i;
    if (arr[fi]) return arr[fi];
    const body = spr.b[fi] || (spr.b[fi] = bakeBody(spr, fi));
    return (arr[fi] = tint(body, kind === 'w' ? 'rgba(255,255,255,.88)' : 'rgba(140,215,255,.38)'));
  }
  return spr.n[fi] || (spr.n[fi] = bakeFrame(spr, fi));
};

/* ======================= 通用特效贴图 ======================= */
const glowCache = {};
Sp.glow = function (col) {
  let c = glowCache[col];
  if (c) return c;
  c = glowCache[col] = mk(64, 64);
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.25, rgba(col, 0.55)); gr.addColorStop(0.6, rgba(col, 0.15)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
};
const fxCache = {};
function fx(key, w, h, draw) {
  let c = fxCache[key];
  if (c) return c;
  c = fxCache[key] = mk(w, h);
  draw(c.getContext('2d'), w, h);
  return c;
}
Sp.shadow = () => fx('shadow', 64, 32, (g) => {
  const gr = g.createRadialGradient(32, 16, 0, 32, 16, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(0.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 0); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
// 彗星拖尾（朝 +x，头部在右）
Sp.comet = col => fx('comet' + col, 128, 32, (g) => {
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.7, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0.95));
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 16); g.quadraticCurveTo(90, 2, 120, 4); g.arc(116, 16, 12, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(90, 30, 0, 16); g.fill();
  const cg = g.createLinearGradient(40, 0, 128, 0); cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(255,255,255,.95)');
  g.fillStyle = cg; g.beginPath(); g.moveTo(40, 16); g.quadraticCurveTo(100, 9, 118, 10); g.arc(116, 16, 6, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(100, 23, 40, 16); g.fill();
});
Sp.star = col => fx('star' + col, 48, 48, (g) => {
  g.translate(24, 24);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 24); gr.addColorStop(0, rgba(col, 0.8)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(-24, -24, 48, 48);
  g.fillStyle = '#fff';
  g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 3 : 22; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
});
Sp.smoke = () => fx('smoke', 64, 64, (g) => {
  for (let i = 0; i < 5; i++) {
    const x = 32 + U.rand(-10, 10), y = 32 + U.rand(-10, 10), r = U.rand(12, 20);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
});
Sp.ring = col => fx('ring' + col, 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64);
  gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.6, rgba(col, 0.6)); gr.addColorStop(0.85, rgba('#ffffff', 0.9)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
// 法阵（陨石/砸地预警）
Sp.rune = col => fx('rune' + col, 256, 256, (g) => {
  g.translate(128, 128); g.strokeStyle = rgba(col, 0.95); g.fillStyle = rgba(col, 0.95);
  g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 120, 0, TAU); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 104, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.save(); g.rotate(a); g.fillRect(-2, -118, 4, i % 3 ? 8 : 14); g.restore(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.save(); g.rotate(a); g.translate(0, -84); g.beginPath(); g.moveTo(-6, 6); g.lineTo(0, -8); g.lineTo(6, 6); g.moveTo(-4, 0); g.lineTo(4, 0); g.stroke(); g.restore(); }
  g.beginPath(); for (let i = 0; i < 7; i++) { const a = i * TAU * 2 / 6 - Math.PI / 2; g.lineTo(Math.cos(a) * 100, Math.sin(a) * 100); } g.stroke();
  g.beginPath(); for (let i = 0; i < 7; i++) { const a = i * TAU * 2 / 6 + Math.PI / 2; g.lineTo(Math.cos(a) * 100, Math.sin(a) * 100); } g.stroke();
});
Sp.meteorRock = () => fx('meteorRock', 96, 96, (g) => {
  g.translate(48, 48);
  g.save(); g.shadowColor = '#ff7a2a'; g.shadowBlur = 18;
  part(g, () => polyPath(g, [-26, -10, -14, -26, 10, -28, 28, -8, 24, 18, 4, 28, -20, 22, -30, 4]), '#5a3a30', 0, 0, 30);
  g.restore();
  g.save(); g.shadowColor = '#ffb43a'; g.shadowBlur = 10;
  line(g, [-14, -6, -2, 4, 10, -2, 18, 10], 3.5, '#ffb43a'); line(g, [-6, 14, 0, 6], 3, '#ff8a3a'); line(g, [4, -18, 8, -8], 3, '#ffd06a');
  g.restore();
});
// 毒池
Sp.pool = col => fx('pool' + col, 256, 256, (g) => {
  g.translate(128, 128);
  const gr = g.createRadialGradient(0, 0, 10, 0, 0, 124);
  gr.addColorStop(0, rgba(shade(col, 0.35), 0.75)); gr.addColorStop(0.7, rgba(col, 0.62)); gr.addColorStop(0.92, rgba(shade(col, -0.35), 0.75)); gr.addColorStop(1, rgba(shade(col, -0.5), 0));
  g.fillStyle = gr; g.beginPath();
  for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, r = 118 + Math.sin(i * 1.7) * 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.fill();
  for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, r = Math.random() * 90; ell(g, Math.cos(a) * r, Math.sin(a) * r, U.rand(6, 16), U.rand(4, 9), rgba(shade(col, 0.6), 0.35)); }
  g.lineWidth = 4; g.strokeStyle = rgba(shade(col, 0.55), 0.7); g.beginPath(); g.arc(0, 0, 112, 0, TAU); g.stroke();
});
// 旋转圣剑（剑尖朝上）
Sp.sword = evo => fx('sword' + (evo ? 1 : 0), 64, 128, (g) => {
  g.translate(32, 70);
  const blade = evo ? '#fff2b8' : '#dfe6f2';
  g.save(); g.shadowColor = evo ? '#ffd24a' : '#9fd8ff'; g.shadowBlur = 14;
  polyPath(g, [-7, 0, 7, 0, 6, -48, 0, -62, -6, -48]);
  g.fillStyle = metal(g, -7, 0, 7, 0, blade); g.fill(); g.lineWidth = 2; g.strokeStyle = OUTC; g.stroke();
  g.restore();
  line(g, [0, -4, 0, -50], 1.6, rgba('#ffffff', 0.8));
  part(g, () => { g.beginPath(); g.roundRect(-17, 0, 34, 7, 3); }, evo ? '#ffc83a' : '#c89a3a', 0, 3, 16, { lw: 1.6 });
  part(g, () => { g.beginPath(); g.roundRect(-3.5, 7, 7, 16, 2); }, '#6a3a1a', 0, 14, 8, { lw: 1.4 });
  circ(g, 0, 26, 5, evo ? '#ff4a6a' : '#4ac0ff');
});
// 飞斧
Sp.axe = evo => fx('axe' + (evo ? 1 : 0), 96, 96, (g) => {
  g.translate(48, 48);
  limb(g, [0, 34, 0, -30], 6, '#8a5a30', 2);
  for (const sx of [-1, 1]) {
    part(g, () => { g.beginPath(); g.moveTo(sx * 3, -28); g.quadraticCurveTo(sx * 40, -34, sx * 36, 0); g.quadraticCurveTo(sx * 22, -10, sx * 3, -4); g.closePath(); }, evo ? '#bff5e0' : '#cfd8e8', sx * 18, -16, 20, { lw: 2 });
    line(g, [sx * 34, -26, sx * 36, -2], 2, '#ffffff');
  }
  circ(g, 0, -16, 5, evo ? '#3affc0' : '#ffcf4a');
});
// 敌方弹幕
Sp.orb = col => fx('orb' + col, 48, 48, (g) => {
  const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, '#ffffff'); gr.addColorStop(0.42, col); gr.addColorStop(0.7, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
});
Sp.shard = col => fx('shard' + col, 32, 64, (g) => {
  g.translate(16, 32);
  polyPath(g, [0, -30, 8, 6, 0, 30, -8, 6]);
  const gr = g.createLinearGradient(-8, 0, 8, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.3));
  g.fillStyle = gr; g.fill(); g.lineWidth = 1.5; g.strokeStyle = rgba('#ffffff', 0.8); g.stroke();
});
// 地面贴花
Sp.decal = (k, col) => fx('decal' + k + col, 128, 128, (g) => {
  g.translate(64, 64);
  if (k === 'scorch') {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62);
    gr.addColorStop(0, 'rgba(20,10,8,.85)'); gr.addColorStop(0.55, 'rgba(30,16,10,.55)'); gr.addColorStop(1, 'rgba(30,16,10,0)');
    g.fillStyle = gr; g.beginPath(); for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU, r = 50 + Math.random() * 14; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill();
    g.strokeStyle = 'rgba(255,120,40,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const a = Math.random() * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); g.lineTo(Math.cos(a + 0.2) * 30, Math.sin(a + 0.2) * 30); g.lineTo(Math.cos(a - 0.1) * 46, Math.sin(a - 0.1) * 46); g.stroke(); }
  } else if (k === 'splat') {
    g.fillStyle = rgba(shade(col, -0.25), 0.85);
    g.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU, r = 26 + Math.random() * 12; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.7); } g.fill();
    for (let i = 0; i < 9; i++) { const a = Math.random() * TAU, r = 36 + Math.random() * 22; circ(g, Math.cos(a) * r, Math.sin(a) * r * 0.7, 2 + Math.random() * 5, rgba(shade(col, -0.25), 0.85)); }
    ell(g, -8, -6, 10, 4, rgba('#ffffff', 0.18));
  } else if (k === 'frost') {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62); gr.addColorStop(0, 'rgba(220,245,255,.5)'); gr.addColorStop(0.7, 'rgba(200,240,255,.25)'); gr.addColorStop(1, 'rgba(200,240,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.fill();
    for (let i = 0; i < 9; i++) { const a = Math.random() * TAU, r = 18 + Math.random() * 34, h = 5 + Math.random() * 7; g.save(); g.translate(Math.cos(a) * r, Math.sin(a) * r); polyPath(g, [-2.5, 2, 0, -h, 2.5, 2]); g.fillStyle = 'rgba(235,250,255,.85)'; g.fill(); g.restore(); }
  }
});
// 精英光芒
Sp.rays = col => fx('rays' + col, 128, 128, (g) => {
  g.translate(64, 64);
  for (let i = 0; i < 12; i++) {
    g.save(); g.rotate(i / 12 * TAU);
    const gr = g.createLinearGradient(0, 0, 0, -64); gr.addColorStop(0, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(-6, 0); g.lineTo(0, -64); g.lineTo(6, 0); g.fill(); g.restore();
  }
});

/* ======================= 拾取物 ======================= */
const GEM_COL = [['#3a9cff', '#bfe6ff'], ['#2fd06a', '#c6ffd8'], ['#ff3a5a', '#ffc0c8']];
Sp.gem = tier => fx('gem' + tier, 40, 48, (g) => {
  g.translate(20, 24);
  const [c, l] = GEM_COL[tier];
  polyPath(g, [0, -20, 13, -6, 0, 20, -13, -6]); g.fillStyle = shade(c, -0.25); g.fill();
  polyPath(g, [0, -20, 13, -6, 0, -2]); g.fillStyle = l; g.fill();
  polyPath(g, [0, -20, -13, -6, 0, -2]); g.fillStyle = shade(c, 0.35); g.fill();
  polyPath(g, [-13, -6, 0, -2, 0, 20]); g.fillStyle = c; g.fill();
  polyPath(g, [0, -20, 13, -6, 0, 20, -13, -6]); g.lineWidth = 2; g.strokeStyle = OUTC; g.lineJoin = 'round'; g.stroke();
  line(g, [-5, -12, -2, -16], 2.2, '#ffffff');
});
Sp.pickup = k => fx('pk' + k, 64, 64, (g) => {
  g.translate(32, 32);
  if (k === 'coin') {
    part(g, () => { g.beginPath(); g.arc(0, 0, 15, 0, TAU); }, '#ffc21a', 0, 0, 15, { lw: 2.5, out: '#7a4a00' });
    g.beginPath(); g.arc(0, 0, 10.5, 0, TAU); g.lineWidth = 1.8; g.strokeStyle = '#c88a00'; g.stroke();
    g.fillStyle = '#fff1a0'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 3 : 7; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
  } else if (k === 'heart') {
    part(g, () => { g.beginPath(); g.moveTo(0, 15); g.bezierCurveTo(-24, -2, -13, -21, 0, -9); g.bezierCurveTo(13, -21, 24, -2, 0, 15); g.closePath(); }, '#ff3a5e', 0, -2, 17, { lw: 2.5, hl: 0.6 });
  } else if (k === 'magnet') {
    g.rotate(-0.5);
    g.beginPath(); g.arc(0, 2, 13, Math.PI, 0); g.lineWidth = 14; g.strokeStyle = OUTC; g.stroke(); g.lineWidth = 9; g.strokeStyle = metal(g, -13, 0, 13, 0, '#e8343a'); g.stroke();
    for (const sx of [-1, 1]) { part(g, () => { g.beginPath(); g.rect(sx * 13 - 5, 2, 10, 13); }, '#e8343a', sx * 13, 8, 8, { lw: 2 }); part(g, () => { g.beginPath(); g.rect(sx * 13 - 5, 10, 10, 7); }, '#e8ecf4', sx * 13, 13, 6, { lw: 2 }); }
  } else if (k === 'bomb') {
    part(g, () => { g.beginPath(); g.arc(0, 4, 15, 0, TAU); }, '#2a2a3a', 0, 4, 15, { hl: 0.6 });
    part(g, () => { g.beginPath(); g.rect(-5, -14, 10, 6); }, '#7a7a8a', 0, -11, 6, { lw: 1.6 });
    g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(6, -24, 12, -20); g.lineWidth = 2.5; g.strokeStyle = '#a07a3a'; g.stroke();
    glowEye(g, 12, -20, 3, '#ffd24a');
  } else if (k === 'chest') {
    part(g, () => { g.beginPath(); g.roundRect(-20, -4, 40, 22, 3); }, '#9a5a24', 0, 7, 20, { lw: 2.5 });
    part(g, () => { g.beginPath(); g.moveTo(-20, -4); g.quadraticCurveTo(-20, -22, 0, -22); g.quadraticCurveTo(20, -22, 20, -4); g.closePath(); }, '#b06e2e', 0, -12, 20, { lw: 2.5 });
    for (const x of [-14, 14]) { g.fillStyle = metal(g, x - 3, 0, x + 3, 0, '#ffd24a'); g.fillRect(x - 3, -20, 6, 38); }
    g.fillStyle = metal(g, 0, -6, 0, 0, '#ffd24a'); g.fillRect(-20, -6, 40, 5);
    part(g, () => { g.beginPath(); g.roundRect(-6, -8, 12, 14, 3); }, '#ffd24a', 0, -1, 7, { lw: 1.8 });
    circ(g, 0, -1, 2.2, '#3a1a08');
  }
});

Sp.pickupURL = k => Sp.pickup(k).toDataURL();

/* ======================= 英雄 ======================= */
const HERO = {
  aileen: { hair: '#6a3ac8', eye: '#3a6aff', skin: '#ffe2c8', item: 'staff' },
  kane:   { hair: '#8a5a2a', eye: '#2a5a8a', skin: '#f2cfae', item: 'sword' },
  vera:   { hair: '#c86a2a', eye: '#2a8a4a', skin: '#ffe0c4', item: 'axe' },
  yuki:   { hair: '#e8f4ff', eye: '#4ab8ff', skin: '#fff0e6', item: 'wand' },
  sael:   { hair: '#ffd84a', eye: '#a86aff', skin: '#ffe2c8', item: 'rod' },
  rock:   { hair: '#4a3a2a', eye: '#6aa83a', skin: '#f0cfa8', item: 'flask' },
  odin:   { hair: '#ffe8a0', eye: '#3a7ad8', skin: '#ffe4cc', item: 'holy' },
  ignis:  { hair: '#e8402a', eye: '#ff8a2a', skin: '#ffdcc0', item: 'tome' }
};
function heldItem(g, kind, R, t, ch) {
  const glowOrb = (x, y, r, col) => {
    g.save(); g.shadowColor = col; g.shadowBlur = R * 0.8;
    const og = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    og.addColorStop(0, '#ffffff'); og.addColorStop(0.45, col); og.addColorStop(1, shade(col, -0.4));
    circ(g, x, y, r, og); g.restore();
  };
  const pulse = 1 + 0.08 * Math.sin(t * 6);
  if (kind === 'staff') { limb(g, [0, R * 0.9, 0, -R * 1.0], R * 0.12, '#8a5a30', R * 0.04); g.beginPath(); g.arc(0, -R * 1.18, R * 0.25, Math.PI * 0.9, Math.PI * 2.1); g.lineWidth = R * 0.08; g.strokeStyle = '#c89a3a'; g.stroke(); glowOrb(0, -R * 1.2, R * 0.2 * pulse, '#6ad0ff'); }
  else if (kind === 'sword') { g.save(); g.rotate(-0.3); polyPath(g, [-R * 0.1, 0, R * 0.1, 0, R * 0.08, -R * 1.3, 0, -R * 1.5, -R * 0.08, -R * 1.3]); g.fillStyle = metal(g, -R * 0.1, 0, R * 0.1, 0, '#e0e6f0'); g.fill(); g.lineWidth = R * 0.06; g.strokeStyle = OUTC; g.stroke(); part(g, () => { g.beginPath(); g.roundRect(-R * 0.3, -R * 0.02, R * 0.6, R * 0.12, R * 0.04); }, '#c89a3a', 0, 0, R * 0.3, { lw: R * 0.05 }); limb(g, [0, R * 0.12, 0, R * 0.38], R * 0.1, '#5a3018', R * 0.03); g.restore(); }
  else if (kind === 'axe') { g.save(); g.rotate(-0.4); limb(g, [0, R * 0.4, 0, -R * 0.9], R * 0.1, '#8a5a30', R * 0.04); part(g, () => { g.beginPath(); g.moveTo(R * 0.05, -R * 0.85); g.quadraticCurveTo(R * 0.7, -R * 0.95, R * 0.62, -R * 0.35); g.quadraticCurveTo(R * 0.35, -R * 0.5, R * 0.05, -R * 0.45); g.closePath(); }, '#d0d8e6', R * 0.35, -R * 0.65, R * 0.35, { lw: R * 0.05 }); g.restore(); }
  else if (kind === 'wand') { limb(g, [0, R * 0.5, 0, -R * 0.6], R * 0.08, '#cfe8ff', R * 0.03); g.save(); g.shadowColor = '#7fd8ff'; g.shadowBlur = R * 0.7; polyPath(g, [0, -R * 1.15 * pulse, R * 0.18, -R * 0.75, 0, -R * 0.55, -R * 0.18, -R * 0.75]); g.fillStyle = metal(g, -R * 0.18, 0, R * 0.18, 0, '#9fe6ff'); g.fill(); g.restore(); }
  else if (kind === 'rod') { limb(g, [0, R * 0.7, 0, -R * 0.85], R * 0.1, '#3a3050', R * 0.04); g.save(); g.shadowColor = '#ffe84a'; g.shadowBlur = R; line(g, [-R * 0.2, -R * 0.85, R * 0.12, -R * 1.15, -R * 0.08, -R * 1.2, R * 0.22, -R * 1.55], R * 0.09 * pulse, '#fff27a'); g.restore(); }
  else if (kind === 'flask') { part(g, () => { g.beginPath(); g.arc(0, -R * 0.1, R * 0.32, 0, TAU); }, '#a8e8ff', 0, -R * 0.1, R * 0.32, { lw: R * 0.06, hl: 0.7 }); g.save(); g.beginPath(); g.arc(0, -R * 0.1, R * 0.28, 0, TAU); g.clip(); g.fillStyle = '#6ae03a'; g.fillRect(-R * 0.4, -R * 0.12 + Math.sin(t * 5) * R * 0.04, R * 0.8, R * 0.5); g.restore(); part(g, () => { g.beginPath(); g.rect(-R * 0.1, -R * 0.62, R * 0.2, R * 0.25); }, '#a8e8ff', 0, -R * 0.5, R * 0.15, { lw: R * 0.05 }); g.fillStyle = '#8a5a30'; g.fillRect(-R * 0.12, -R * 0.72, R * 0.24, R * 0.12); circ(g, R * 0.05, -R * 0.85 - (t * 0.8 % 1) * R * 0.4, R * 0.06, 'rgba(160,255,120,.7)'); }
  else if (kind === 'holy') { g.save(); g.rotate(-0.2); g.shadowColor = '#ffe08a'; g.shadowBlur = R * 0.8; polyPath(g, [-R * 0.12, 0, R * 0.12, 0, R * 0.1, -R * 1.45, 0, -R * 1.7, -R * 0.1, -R * 1.45]); g.fillStyle = metal(g, -R * 0.12, 0, R * 0.12, 0, '#fff6d0'); g.fill(); g.restore(); g.save(); g.rotate(-0.2); part(g, () => { g.beginPath(); g.moveTo(-R * 0.4, 0); g.quadraticCurveTo(0, -R * 0.2, R * 0.4, 0); g.lineTo(R * 0.3, R * 0.12); g.lineTo(-R * 0.3, R * 0.12); g.closePath(); }, '#ffc83a', 0, 0, R * 0.35, { lw: R * 0.05 }); limb(g, [0, R * 0.14, 0, R * 0.42], R * 0.1, '#f0f0f8', R * 0.03); g.restore(); }
  else if (kind === 'tome') { part(g, () => { g.beginPath(); g.roundRect(-R * 0.35, -R * 0.4, R * 0.7, R * 0.55, R * 0.06); }, '#8a2a1a', 0, -R * 0.12, R * 0.4, { lw: R * 0.06 }); g.fillStyle = '#ffd24a'; g.fillRect(-R * 0.35, -R * 0.4, R * 0.08, R * 0.55); glowOrb(R * 0.05, -R * 0.75 + Math.sin(t * 3) * R * 0.06, R * 0.17 * pulse, '#ff8a2a'); }
}
// 在 (0,0) 脚底中心绘制英雄（朝右）；R 为尺寸基准
Sp.drawHero = function (g, ch, t, moving, R, id, blinkOv) {
  R = R || 13;
  const st = HERO[id] || HERO.aileen;
  const run = moving ? t * 13 : 0, sw = Math.sin(run);
  const bob = moving ? Math.abs(Math.sin(run)) * R * 0.12 : Math.sin(t * 2.6) * R * 0.035;
  const c1 = ch.c1, c2 = ch.c2;
  // 披风（身后）
  const capeWave = Math.sin(t * (moving ? 13 : 2.6)) * R * 0.08;
  part(g, () => { g.beginPath(); g.moveTo(-R * 0.45, -R * 0.35 - bob); g.quadraticCurveTo(-R * (0.95 + (moving ? 0.2 : 0)), R * 0.3, -R * (0.9 + (moving ? 0.25 : 0)), R * 0.72 + capeWave); g.quadraticCurveTo(-R * 0.4, R * 0.62 - capeWave, R * 0.1, R * 0.7); g.lineTo(R * 0.3, -R * 0.3 - bob); g.closePath(); }, c2, -R * 0.4, R * 0.2, R * 0.75, { hl: 0.15 });
  // 靴子
  for (const k of [-1, 1]) {
    const lx = k * R * 0.22 + (moving ? sw * k * R * 0.28 : 0), ly = R * 0.62 - (moving ? Math.max(0, sw * k) * R * 0.18 : 0);
    limb(g, [lx, R * 0.35 - bob, lx, ly], R * 0.22, shade('#3a2a3a', k < 0 ? -0.3 : 0), R * 0.05);
    part(g, () => { g.beginPath(); g.ellipse(lx + R * 0.08, ly + R * 0.14, R * 0.2, R * 0.13, 0, 0, TAU); }, shade('#4a3020', k < 0 ? -0.3 : 0), lx + R * 0.08, ly + R * 0.14, R * 0.2, { lw: R * 0.06 });
  }
  g.translate(0, -bob);
  // 后臂
  const arm = moving ? sw * R * 0.2 : Math.sin(t * 2.6) * R * 0.04;
  limb(g, [-R * 0.38, -R * 0.2, -R * 0.5 - arm * 0.5, R * 0.18 + arm * 0.3], R * 0.2, shade(c1, -0.25), R * 0.05);
  // 身体
  part(g, () => { g.beginPath(); g.moveTo(-R * 0.5, -R * 0.32); g.quadraticCurveTo(0, -R * 0.48, R * 0.5, -R * 0.32); g.quadraticCurveTo(R * 0.62, R * 0.25, R * 0.58, R * 0.5); g.quadraticCurveTo(0, R * 0.62, -R * 0.58, R * 0.5); g.quadraticCurveTo(-R * 0.62, R * 0.25, -R * 0.5, -R * 0.32); g.closePath(); }, c1, 0, R * 0.05, R * 0.6);
  // 衣襟/花纹
  line(g, [R * 0.05, -R * 0.35, R * 0.1, R * 0.52], R * 0.06, rgba(shade(c1, 0.5), 0.6));
  g.fillStyle = shade(c2, -0.1); g.fillRect(-R * 0.58, R * 0.18, R * 1.16, R * 0.14);
  part(g, () => { g.beginPath(); g.roundRect(-R * 0.1, R * 0.14, R * 0.22, R * 0.22, R * 0.05); }, '#ffd24a', 0, R * 0.25, R * 0.12, { lw: R * 0.04 });
  part(g, () => { g.beginPath(); g.ellipse(0, -R * 0.36, R * 0.38, R * 0.12, 0, 0, TAU); }, shade(c2, 0.15), 0, -R * 0.36, R * 0.35, { lw: R * 0.05, hl: false });
  // 头
  const hx2 = R * 0.05, hy2 = -R * 0.95, hr = R * 0.72;
  const hair = st.hair;
  // 后发（在头部之下）
  part(g, () => { g.beginPath(); g.arc(hx2 - R * 0.1, hy2 - R * 0.06, hr * 1.06, 0, TAU); g.moveTo(hx2 - R * 0.75, hy2); g.quadraticCurveTo(hx2 - R * 0.95, hy2 + R * 0.6, hx2 - R * 0.55 + Math.sin(t * 3) * R * 0.05, hy2 + R * 0.85); g.lineTo(hx2 - R * 0.2, hy2 + R * 0.3); g.closePath(); }, hair, hx2 - R * 0.3, hy2 - R * 0.1, hr, { hl: 0.2 });
  part(g, () => { g.beginPath(); g.arc(hx2, hy2, hr, 0, TAU); }, st.skin, hx2, hy2, hr, { hl: 0.2, aoA: 0.08, light: 0.3 });
  ell(g, hx2 - R * 0.42, hy2 + R * 0.08, R * 0.13, R * 0.18, shade(st.skin, -0.12));
  // 头顶发盖 + 刘海
  part(g, () => {
    g.beginPath(); g.arc(hx2 - R * 0.04, hy2 - R * 0.06, hr * 1.06, Math.PI * 0.98, Math.PI * 2.08);
    g.lineTo(hx2 + R * 0.62, hy2 - R * 0.08); g.lineTo(hx2 + R * 0.5, hy2 - R * 0.32); g.lineTo(hx2 + R * 0.38, hy2 - R * 0.12);
    g.lineTo(hx2 + R * 0.22, hy2 - R * 0.36); g.lineTo(hx2 + R * 0.06, hy2 - R * 0.14); g.lineTo(hx2 - R * 0.12, hy2 - R * 0.4);
    g.lineTo(hx2 - R * 0.36, hy2 - R * 0.12); g.lineTo(hx2 - R * 0.5, hy2 + R * 0.28); g.lineTo(hx2 - R * 0.8, hy2 + R * 0.05); g.closePath();
  }, hair, hx2, hy2 - R * 0.45, hr, { hl: 0.35 });
  g.beginPath(); g.arc(hx2 - R * 0.1, hy2 - R * 0.1, hr * 0.78, Math.PI * 1.15, Math.PI * 1.55); g.lineWidth = R * 0.08; g.strokeStyle = rgba('#ffffff', 0.45); g.lineCap = 'round'; g.stroke();
  // 眼睛（眨眼）
  const blink = blinkOv === undefined ? (t % 3.4) < 0.12 : blinkOv;
  if (blink) { line(g, [hx2 + R * 0.08, hy2 + R * 0.02, hx2 + R * 0.3, hy2 + R * 0.02], R * 0.06, '#2a1c30'); line(g, [hx2 + R * 0.45, hy2 + R * 0.02, hx2 + R * 0.62, hy2 + R * 0.02], R * 0.06, '#2a1c30'); }
  else { eye(g, hx2 + R * 0.2, hy2 + R * 0.0, R * 0.15, { look: 0.6, iris: st.eye }); eye(g, hx2 + R * 0.52, hy2 + R * 0.0, R * 0.13, { look: 0.6, iris: st.eye }); }
  ell(g, hx2 + R * 0.12, hy2 + R * 0.3, R * 0.11, R * 0.06, 'rgba(255,110,130,.45)'); ell(g, hx2 + R * 0.6, hy2 + R * 0.3, R * 0.08, R * 0.05, 'rgba(255,110,130,.45)');
  g.beginPath(); g.arc(hx2 + R * 0.4, hy2 + R * 0.3, R * 0.07, 0.2, Math.PI - 0.2); g.lineWidth = R * 0.05; g.strokeStyle = '#7a2a3a'; g.stroke();
  // 帽子/头饰
  const hat = ch.hat;
  if (hat === 'wizard') {
    part(g, () => { g.beginPath(); g.ellipse(hx2, hy2 - R * 0.52, R * 1.0, R * 0.22, -0.08, 0, TAU); }, c1, hx2, hy2 - R * 0.52, R * 0.9);
    part(g, () => { g.beginPath(); g.moveTo(hx2 - R * 0.55, hy2 - R * 0.6); g.quadraticCurveTo(hx2 - R * 0.2, hy2 - R * 1.4, hx2 - R * 0.75 + Math.sin(t * 3) * R * 0.05, hy2 - R * 2.05); g.quadraticCurveTo(hx2 + R * 0.25, hy2 - R * 1.5, hx2 + R * 0.55, hy2 - R * 0.6); g.closePath(); }, c1, hx2, hy2 - R * 1.1, R * 0.7);
    g.fillStyle = metal(g, 0, hy2 - R * 0.85, 0, hy2 - R * 0.65, '#ffd24a'); g.fillRect(hx2 - R * 0.52, hy2 - R * 0.82, R * 1.04, R * 0.16);
    g.save(); g.translate(hx2 - R * 0.15, hy2 - R * 1.15); g.fillStyle = '#ffe86a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? R * 0.07 : R * 0.16; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore();
  } else if (hat === 'helm') {
    part(g, () => { g.beginPath(); g.arc(hx2, hy2 - R * 0.12, hr * 1.08, Math.PI * 1.0, Math.PI * 2.0); g.lineTo(hx2 + hr * 1.08, hy2 - R * 0.05); g.lineTo(hx2 - hr * 1.08, hy2 - R * 0.05); g.closePath(); }, '#c8d0de', hx2, hy2 - R * 0.4, hr);
    g.fillStyle = metal(g, 0, hy2 - R * 0.2, 0, hy2, '#8a94a8'); g.fillRect(hx2 - hr * 1.05, hy2 - R * 0.18, hr * 2.1, R * 0.14);
    part(g, () => { g.beginPath(); g.moveTo(hx2 - R * 0.05, hy2 - R * 0.85); g.quadraticCurveTo(hx2 - R * 0.6, hy2 - R * 1.6, hx2 - R * 1.1 - Math.sin(t * 4) * R * 0.08, hy2 - R * 1.1); g.quadraticCurveTo(hx2 - R * 0.5, hy2 - R * 1.05, hx2 + R * 0.1, hy2 - R * 0.75); g.closePath(); }, '#e2343a', hx2 - R * 0.5, hy2 - R * 1.2, R * 0.5, { lw: R * 0.05 });
  } else if (hat === 'hood') {
    part(g, () => { g.beginPath(); g.arc(hx2 - R * 0.05, hy2 - R * 0.05, hr * 1.12, Math.PI * 0.75, Math.PI * 1.95); g.quadraticCurveTo(hx2 + R * 0.5, hy2 - R * 0.55, hx2 + R * 0.3, hy2 - R * 0.62); g.quadraticCurveTo(hx2 - R * 0.3, hy2 - R * 0.5, hx2 - R * 0.55, hy2 + R * 0.5); g.closePath(); }, c1, hx2 - R * 0.2, hy2 - R * 0.3, hr);
    part(g, () => { g.beginPath(); g.ellipse(hx2 - R * 0.6, hy2 + R * 0.5, R * 0.15, R * 0.09, 0.6, 0, TAU); }, '#8ad04a', hx2 - R * 0.6, hy2 + R * 0.5, R * 0.15, { lw: R * 0.04 });
  } else if (hat === 'ice') {
    g.save(); g.shadowColor = '#9fe6ff'; g.shadowBlur = R * 0.5;
    for (let i = -2; i <= 2; i++) { const h = R * (i === 0 ? 0.7 : Math.abs(i) === 1 ? 0.5 : 0.32); polyPath(g, [hx2 + i * R * 0.24 - R * 0.09, hy2 - R * 0.62, hx2 + i * R * 0.24, hy2 - R * 0.62 - h, hx2 + i * R * 0.24 + R * 0.09, hy2 - R * 0.62]); g.fillStyle = metal(g, -R, 0, R, 0, '#bff0ff'); g.fill(); }
    g.restore(); g.fillStyle = '#8fd8ff'; g.fillRect(hx2 - R * 0.6, hy2 - R * 0.66, R * 1.2, R * 0.08);
  } else if (hat === 'spark') {
    for (let i = 0; i < 5; i++) spikes(g, [hx2 - R * 0.6 + i * R * 0.28, hy2 - R * 0.45, hx2 - R * 0.75 + i * R * 0.3, hy2 - R * 1.15 - (i % 2) * R * 0.2, hx2 - R * 0.35 + i * R * 0.28, hy2 - R * 0.5], hair);
    g.save(); g.shadowColor = '#fff27a'; g.shadowBlur = R * 0.6; const k = Math.sin(t * 9) > 0 ? 1 : -1; line(g, [hx2 + R * 0.5, hy2 - R * 1.0, hx2 + R * 0.7, hy2 - R * 1.25 * k, hx2 + R * 0.6, hy2 - R * 1.3, hx2 + R * 0.85, hy2 - R * 1.55], R * 0.06, '#fff27a'); g.restore();
  } else if (hat === 'alch') {
    g.fillStyle = '#3a3a48'; g.fillRect(hx2 - hr, hy2 - R * 0.5, hr * 2, R * 0.13);
    for (const x of [-0.08, 0.4]) { part(g, () => { g.beginPath(); g.arc(hx2 + R * x, hy2 - R * 0.45, R * 0.2, 0, TAU); }, '#c89a3a', hx2 + R * x, hy2 - R * 0.45, R * 0.2, { lw: R * 0.05 }); circ(g, hx2 + R * x, hy2 - R * 0.45, R * 0.13, '#7ad44a'); circ(g, hx2 + R * x - R * 0.05, hy2 - R * 0.5, R * 0.05, '#fff'); }
  } else if (hat === 'halo') {
    g.save(); g.shadowColor = '#fff2a8'; g.shadowBlur = R * 0.7;
    g.beginPath(); g.ellipse(hx2, hy2 - R * 1.0 + Math.sin(t * 2) * R * 0.05, R * 0.55, R * 0.16, 0, 0, TAU); g.lineWidth = R * 0.12; g.strokeStyle = '#fff2a8'; g.stroke(); g.restore();
  } else if (hat === 'flame') {
    g.save(); g.shadowColor = '#ff7a2a'; g.shadowBlur = R * 0.6;
    for (let i = 0; i < 4; i++) { const h = R * (0.45 + 0.18 * Math.sin(t * 8 + i * 1.7)); spikes(g, [hx2 - R * 0.55 + i * R * 0.32, hy2 - R * 0.55, hx2 - R * 0.5 + i * R * 0.32, hy2 - R * 0.6 - h, hx2 - R * 0.25 + i * R * 0.32, hy2 - R * 0.55], i % 2 ? '#ffb43a' : '#ff5a2a'); }
    g.restore();
  }
  // 前臂与武器
  const ax = R * 0.48 + arm * 0.6, ay = R * 0.12 - arm * 0.3;
  g.save(); g.translate(ax + R * 0.1, ay); heldItem(g, st.item, R, t, ch); g.restore();
  limb(g, [R * 0.38, -R * 0.2, ax, ay], R * 0.2, c1, R * 0.05);
  circ(g, ax + R * 0.08, ay, R * 0.13, st.skin);
};
Sp.drawChar = function (g, ch, t, moving, R) {
  let id = 'aileen'; for (const k in SF.CHARS) if (SF.CHARS[k] === ch) id = k;
  Sp.drawHero(g, ch, t, moving, R, id);
};
/* 英雄动画帧烘焙：idle/run 各 8 帧 + 眨眼帧 */
const heroCache = {};
const HB = { w: 66, h: 62, ox: 31, oy: 44, sc: 1.3 }; // 世界单位包围盒（已含 1.3 倍显示缩放）
Sp.HERO_BOX = HB;
Sp.heroFrame = function (id, moving, fi, blink) {
  const key = id + (blink ? 'b' : moving ? 'r' + fi : 'i' + fi);
  let c = heroCache[key];
  if (c) return c;
  const s2 = S * 1.15;
  c = heroCache[key] = mk(HB.w * s2, HB.h * s2);
  const g = c.getContext('2d');
  g.scale(s2, s2); g.translate(HB.ox, HB.oy); g.scale(HB.sc, HB.sc);
  const t = moving ? fi / 8 * TAU / 13 : fi / 8 * TAU / 2.6;
  Sp.drawHero(g, SF.CHARS[id], blink ? 0.6 : t, moving, 13, id, !!blink);
  return c;
};
// 位图数字字库（伤害数字）
const digitCache = {};
const DSTY = { n: ['#ffffff', 'rgba(10,6,20,.9)'], c: ['#ffd24a', '#7a2a00'], r: ['#ff6a7a', 'rgba(40,0,10,.9)'], g: ['#7aff9a', 'rgba(0,30,10,.9)'], y: ['#ffd24a', 'rgba(40,20,0,.9)'] };
Sp.digits = function (style) {
  if (digitCache[style]) return digitCache[style];
  const chars = '0123456789+-', H = 40, c = mk(chars.length * 30, H), g = c.getContext('2d');
  const [fill, stroke] = DSTY[style] || DSTY.n;
  g.font = '900 32px system-ui, -apple-system, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const w = {};
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], x = i * 30 + 15;
    g.lineWidth = 7; g.strokeStyle = stroke; g.strokeText(ch, x, H / 2 + 1);
    if (style === 'c') { const gr = g.createLinearGradient(0, 6, 0, H - 6); gr.addColorStop(0, '#fff6b0'); gr.addColorStop(1, '#ff9a2a'); g.fillStyle = gr; } else g.fillStyle = fill;
    g.fillText(ch, x, H / 2 + 1);
    w[ch] = Math.min(30, g.measureText(ch).width + 6);
  }
  return (digitCache[style] = { c, w, H, cw: 30, idx: ch => chars.indexOf(ch) });
};
Sp.tri = col => fx('tri' + col, 16, 16, (g) => { polyPath(g, [8, 1, 15, 13, 1, 12]); g.fillStyle = col; g.fill(); g.lineWidth = 1; g.strokeStyle = rgba(shade(col, -0.5), 0.8); g.stroke(); });

const iconImgCache = {};
Sp.charIcon = function (id) {
  if (iconImgCache[id]) return iconImgCache[id];
  const c = mk(160, 160), g = c.getContext('2d');
  g.translate(80, 116); g.scale(2.6, 2.6);
  const sh = Sp.shadow(); g.drawImage(sh, -14, 4, 28, 9);
  Sp.drawHero(g, SF.CHARS[id], 0.6, false, 13, id);
  return (iconImgCache[id] = c.toDataURL());
};

/* ======================= 地面（可平铺噪声纹理 + 细节） ======================= */
const TILE = 768;
Sp.TILE = TILE;
const groundCache = {};
function periodicNoise(n, cells, seed) {
  const lat = new Float32Array(cells * cells);
  for (let i = 0; i < lat.length; i++) lat[i] = U.hash(i, seed, 7);
  const out = new Float32Array(n * n), sc = cells / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fx2 = x * sc, fy2 = y * sc, x0 = fx2 | 0, y0 = fy2 | 0, tx = fx2 - x0, ty = fy2 - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = lat[(y0 % cells) * cells + (x0 % cells)], b = lat[(y0 % cells) * cells + ((x0 + 1) % cells)];
    const c = lat[((y0 + 1) % cells) * cells + (x0 % cells)], d = lat[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
    out[y * n + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  return out;
}
function wrapDraw(g, x, y, m, fn) {
  for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) {
    if (x + ox < -m || x + ox > TILE + m || y + oy < -m || y + oy > TILE + m) continue;
    fn(x + ox, y + oy);
  }
}
const DETAIL = {
  meadow(g, x, y, r) {
    if (r < 0.5) { // 草丛
      for (let i = 0; i < 5; i++) { const a = -0.7 + i * 0.35, h = 7 + (i % 2) * 4; const gr = g.createLinearGradient(x, y, x, y - h); gr.addColorStop(0, '#244a22'); gr.addColorStop(1, '#7ec85a'); g.beginPath(); g.moveTo(x + i * 1.6 - 3, y); g.quadraticCurveTo(x + i * 1.6 - 3 + a * 4, y - h * 0.6, x + i * 1.6 - 3 + a * 7, y - h); g.lineWidth = 1.6; g.strokeStyle = gr; g.lineCap = 'round'; g.stroke(); }
    } else if (r < 0.66) { // 花
      const col = ['#ffffff', '#ffd24a', '#ff8ab8', '#a8c8ff', '#ff6a5a'][(x * 7 + y) % 5 | 0];
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(g, x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.2, 1.5, col, a); }
      circ(g, x, y, 1.5, '#ffb02a');
    } else if (r < 0.71) { // 鹅卵石
      ell(g, x + 1, y + 1.5, 6, 3.5, 'rgba(0,0,0,.22)'); part(g, () => { g.beginPath(); g.ellipse(x, y, 5.5, 3.6, 0.2, 0, TAU); }, '#9aa092', x, y, 5.5, { lw: 1 });
    } else if (r < 0.9) { // 三叶草
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; circ(g, x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5, 2.4, '#4f9a3a'); }
    } else { ell(g, x, y, 10, 4, 'rgba(255,255,200,.08)'); }
  },
  desert(g, x, y, r) {
    if (r < 0.45) { g.beginPath(); g.moveTo(x - 14, y); g.quadraticCurveTo(x, y - 5, x + 14, y); g.lineWidth = 2; g.strokeStyle = 'rgba(255,240,200,.35)'; g.stroke(); g.beginPath(); g.moveTo(x - 14, y + 2); g.quadraticCurveTo(x, y - 3, x + 14, y + 2); g.lineWidth = 1.5; g.strokeStyle = 'rgba(120,80,30,.3)'; g.stroke(); }
    else if (r < 0.65) { ell(g, x + 1, y + 1.5, 5, 3, 'rgba(0,0,0,.2)'); part(g, () => { g.beginPath(); g.ellipse(x, y, 4.5, 3, 0.3, 0, TAU); }, '#b08a5a', x, y, 4.5, { lw: 0.9 }); }
    else if (r < 0.8) { g.strokeStyle = '#7a5a30'; g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y - 8); g.moveTo(x, y); g.lineTo(x + 3, y - 9); g.moveTo(x, y); g.lineTo(x + 7, y - 5); g.stroke(); }
    else if (r < 0.9) { g.strokeStyle = 'rgba(110,70,30,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x - 2, y + 2); g.lineTo(x + 3, y - 3); g.lineTo(x + 9, y); g.moveTo(x + 3, y - 3); g.lineTo(x + 5, y - 8); g.stroke(); }
    else circ(g, x, y, 1.5, 'rgba(255,255,255,.4)');
  },
  frost(g, x, y, r) {
    if (r < 0.45) { ell(g, x + 2, y + 2, 11, 4.5, 'rgba(90,130,180,.18)'); ell(g, x, y, 11, 4.5, 'rgba(255,255,255,.75)'); }
    else if (r < 0.65) { g.strokeStyle = 'rgba(110,160,210,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 3, y + 2); g.lineTo(x + 3, y - 2); g.lineTo(x + 10, y + 1); g.moveTo(x - 3, y + 2); g.lineTo(x - 1, y + 7); g.stroke(); }
    else if (r < 0.8) { for (let i = 0; i < 4; i++) line(g, [x + i * 2 - 3, y, x + i * 2 - 3 + (i - 1.5) * 1.5, y - 7], 1.2, '#cfe6f2'); }
    else if (r < 0.92) { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 0.6 : 2.6; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
    else ell(g, x, y, 7, 3, 'rgba(60,90,130,.1)');
  },
  lava(g, x, y, r) {
    if (r < 0.4) { g.save(); g.shadowColor = '#ff6a1a'; g.shadowBlur = 6; line(g, [x, y, x + 8, y + 5, x + 11, y + 14], 2, 'rgba(255,120,40,.85)'); line(g, [x + 8, y + 5, x + 16, y + 3], 1.6, 'rgba(255,160,60,.7)'); g.restore(); }
    else if (r < 0.65) { ell(g, x + 1, y + 2, 7, 3.5, 'rgba(0,0,0,.35)'); part(g, () => polyPath(g, [x - 6, y + 2, x - 3, y - 4, x + 4, y - 4, x + 7, y + 2]), '#3a2a30', x, y, 6, { lw: 1 }); }
    else if (r < 0.8) { circ(g, x, y, 1.6, 'rgba(255,170,60,.85)'); circ(g, x + 4, y + 3, 1, 'rgba(255,120,40,.7)'); }
    else ell(g, x, y, 9, 4, 'rgba(90,90,100,.18)');
  }
};
Object.assign(DETAIL, {
  swamp(g, x, y, r) {
    if (r < 0.35) { for (let i = 0; i < 4; i++) { const h = 8 + (i % 2) * 5; line(g, [x + i * 2 - 3, y, x + i * 2 - 3 + (i - 1.5) * 1.6, y - h], 1.4, i % 2 ? '#4a5a2a' : '#6a7a34'); } }
    else if (r < 0.55) { ell(g, x, y, 9, 4, 'rgba(20,30,16,.45)'); ell(g, x - 2, y - 1, 5, 2, 'rgba(120,150,80,.25)'); }
    else if (r < 0.68) { circ(g, x, y, 2.2, 'rgba(180,255,120,.5)'); circ(g, x + 5, y + 3, 1.4, 'rgba(180,255,120,.35)'); }
    else if (r < 0.82) { line(g, [x - 8, y + 2, x - 2, y - 1, x + 5, y + 1, x + 10, y - 2], 1.6, 'rgba(50,40,20,.55)'); }
    else ell(g, x, y, 4, 4, 'rgba(90,120,50,.35)');
  },
  city(g, x, y, r) {
    if (r < 0.3) { g.strokeStyle = 'rgba(20,20,26,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 3, y + 2); g.lineTo(x + 2, y - 3); g.lineTo(x + 10, y + 1); g.stroke(); }
    else if (r < 0.45) { ell(g, x, y, 10, 5, 'rgba(10,10,14,.35)'); }
    else if (r < 0.58) { g.fillStyle = 'rgba(220,200,90,.35)'; g.fillRect(x - 10, y - 1.5, 20, 3); }
    else if (r < 0.7) { circ(g, x, y, 1.4, 'rgba(200,200,210,.4)'); circ(g, x + 4, y + 2, 1, 'rgba(200,200,210,.3)'); circ(g, x - 3, y + 3, 1.2, 'rgba(150,150,160,.3)'); }
    else if (r < 0.8) { g.fillStyle = 'rgba(120,220,90,.22)'; g.beginPath(); g.ellipse(x, y, 6, 3, 0.4, 0, TAU); g.fill(); }
    else { g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.strokeRect(x - 12, y - 12, 24, 24); }
  },
  sky(g, x, y, r) {
    if (r < 0.4) { for (let i = 0; i < 5; i++) { const h = 6 + (i % 2) * 4; line(g, [x + i * 1.8 - 3, y, x + i * 1.8 - 3 + (i - 2) * 1.4, y - h], 1.3, i % 2 ? '#5a9a4a' : '#9ad87a'); } }
    else if (r < 0.58) { const col = ['#ffffff', '#ffe08a', '#c8b0ff', '#9ad8ff'][(x * 3 + y) % 4 | 0]; for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; ell(g, x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 2, 1.3, col, a); } circ(g, x, y, 1.2, '#ffd24a'); }
    else if (r < 0.7) { ell(g, x, y, 7, 3.5, 'rgba(255,255,255,.22)'); }
    else if (r < 0.74) { ell(g, x + 1, y + 1.5, 6, 3, 'rgba(0,0,0,.15)'); part(g, () => { g.beginPath(); g.ellipse(x, y, 5, 3.2, 0.2, 0, TAU); }, '#c8c4b8', x, y, 5, { lw: 0.8 }); }
    else circ(g, x, y, 1.4, 'rgba(255,255,200,.5)');
  }
});
Sp.ground = function (stage) {
  if (groundCache[stage.id]) return groundCache[stage.id];
  const N = 256;
  const n1 = periodicNoise(N, 4, 1), n2 = periodicNoise(N, 8, 2), n3 = periodicNoise(N, 32, 3);
  const nc = mk(N, N), ng = nc.getContext('2d'), img = ng.createImageData(N, N);
  const a = rgbOf(stage.ground[1]), b = rgbOf(stage.ground[0]), c = rgbOf(stage.ground[2]);
  for (let i = 0; i < N * N; i++) {
    const v = n1[i] * 0.55 + n2[i] * 0.3 + n3[i] * 0.15;
    const t = Math.max(0, Math.min(1, (v - 0.25) / 0.5));
    let col;
    if (t < 0.5) { const k = t * 2; col = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    else { const k = (t - 0.5) * 2; col = [b[0] + (c[0] - b[0]) * k, b[1] + (c[1] - b[1]) * k, b[2] + (c[2] - b[2]) * k]; }
    const gr = (U.hash(i, 9, 4) - 0.5) * 8;
    img.data[i * 4] = col[0] + gr; img.data[i * 4 + 1] = col[1] + gr; img.data[i * 4 + 2] = col[2] + gr; img.data[i * 4 + 3] = 255;
  }
  ng.putImageData(img, 0, 0);
  const SG = Sp.S, cv = mk(TILE * SG, TILE * SG), g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  // 平铺放大（多画一圈避免边缘插值缝）
  for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) g.drawImage(nc, ox * TILE * SG, oy * TILE * SG, TILE * SG, TILE * SG);
  g.scale(SG, SG);
  const f = DETAIL[stage.deco];
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) {
    const x = rnd() * TILE, y = rnd() * TILE, r = rnd();
    wrapDraw(g, x, y, 20, (xx, yy) => f(g, xx, yy, r));
  }
  return (groundCache[stage.id] = cv);
};

/* ======================= 场景大型装饰（预烘焙） ======================= */
const DECO = {
  meadow: [
    (g) => { // 大树
      g.drawImage(Sp.shadow(), -34, -6, 68, 22);
      limb(g, [0, 4, -2, -22], 9, '#7a4a24', 2);
      const blobs = [[-14, -36, 17], [14, -38, 17], [0, -52, 19], [-6, -30, 15], [10, -26, 14]];
      for (const [x, y, r] of blobs) part(g, () => { g.beginPath(); g.arc(x, y, r, 0, TAU); }, '#3f9a4a', 0, -44, 32, { lw: 2.2, hl: 0.2 });
      for (const [x, y] of [[-10, -50], [8, -46], [-16, -34]]) circ(g, x, y, 3, 'rgba(255,255,220,.35)');
      for (const [x, y] of [[12, -32], [-4, -40]]) circ(g, x, y, 2.4, '#e2343a');
    },
    (g) => { // 灌木
      g.drawImage(Sp.shadow(), -24, -4, 48, 14);
      for (const [x, y, r] of [[-10, -8, 11], [10, -8, 11], [0, -16, 12]]) part(g, () => { g.beginPath(); g.arc(x, y, r, 0, TAU); }, '#4fae56', 0, -12, 18, { lw: 2 });
      for (const [x, y] of [[-6, -14], [6, -6], [2, -20]]) circ(g, x, y, 1.8, '#ffffff');
    },
    (g) => { // 苔石
      g.drawImage(Sp.shadow(), -24, -2, 48, 14);
      part(g, () => polyPath(g, [-20, 4, -16, -12, -4, -20, 12, -16, 20, -2, 14, 6]), '#8a9088', 0, -6, 20, { lw: 2 });
      ell(g, -6, -15, 9, 4, '#5a9a3a'); ell(g, 6, -14, 6, 3, '#6aae44');
    }
  ],
  desert: [
    (g) => { // 仙人掌
      g.drawImage(Sp.shadow(), -20, -4, 40, 14);
      const cac = (path, cx, cy, r) => part(g, path, '#3f9a52', cx, cy, r, { lw: 2 });
      cac(() => { g.beginPath(); g.roundRect(-6, -40, 12, 44, 6); }, 0, -18, 14);
      cac(() => { g.beginPath(); g.roundRect(-18, -28, 8, 18, 4); }, -14, -20, 8);
      cac(() => { g.beginPath(); g.roundRect(-14, -14, 10, 7, 3); }, -9, -10, 6);
      cac(() => { g.beginPath(); g.roundRect(10, -34, 8, 22, 4); }, 14, -24, 8);
      cac(() => { g.beginPath(); g.roundRect(4, -16, 10, 7, 3); }, 9, -12, 6);
      for (let i = 0; i < 6; i++) line(g, [-2 + (i % 2) * 4, -36 + i * 6, -1 + (i % 2) * 4, -35 + i * 6], 1, 'rgba(255,255,220,.7)');
      circ(g, 0, -42, 3, '#ff6a9a');
    },
    (g) => { // 残柱
      g.drawImage(Sp.shadow(), -24, -4, 48, 14);
      part(g, () => { g.beginPath(); g.rect(-11, -36, 22, 40); }, '#dcc490', 0, -16, 20, { lw: 2 });
      for (let i = -1; i <= 1; i++) line(g, [i * 6, -32, i * 6, 0], 1.6, 'rgba(120,90,50,.35)');
      part(g, () => polyPath(g, [-14, -36, 14, -36, 10, -42, 2, -38, -6, -44, -14, -40]), '#e8d4a0', 0, -39, 14, { lw: 2 });
      part(g, () => { g.beginPath(); g.rect(-15, 0, 30, 6); }, '#c8b07a', 0, 3, 15, { lw: 2 });
    },
    (g) => { // 兽骨
      g.drawImage(Sp.shadow(), -20, -2, 40, 12);
      part(g, () => { g.beginPath(); g.ellipse(0, -6, 10, 8, 0, 0, TAU); }, '#efe6d0', 0, -6, 10, { lw: 1.6 });
      ell(g, -3, -7, 2.5, 3, '#3a2a20'); ell(g, 4, -7, 2.5, 3, '#3a2a20');
      limb(g, [-18, 2, -8, 0], 3, '#efe6d0', 1); limb(g, [10, 1, 20, 3], 3, '#efe6d0', 1);
    },
    (g) => { // 砂岩巨石
      g.drawImage(Sp.shadow(), -26, -2, 52, 15);
      part(g, () => polyPath(g, [-22, 4, -18, -14, -6, -24, 10, -22, 22, -6, 18, 6]), '#c89a5a', 0, -8, 22, { lw: 2 });
      line(g, [-14, -8, 12, -10], 1.6, 'rgba(110,70,30,.45)'); line(g, [-10, -1, 14, -2], 1.6, 'rgba(110,70,30,.35)');
    }
  ],
  frost: [
    (g) => { // 雪松
      g.drawImage(Sp.shadow(), -26, -4, 52, 16);
      limb(g, [0, 4, 0, -8], 6, '#5a3d24', 2);
      for (let i = 0; i < 3; i++) {
        const y = -6 - i * 15, w = 22 - i * 5;
        part(g, () => polyPath(g, [-w, y, 0, y - 24, w, y]), '#2d6a58', 0, y - 10, w, { lw: 2 });
        polyPath(g, [-w * 0.6, y - 8, 0, y - 24, w * 0.6, y - 8, w * 0.2, y - 12, -w * 0.15, y - 9]); g.fillStyle = 'rgba(255,255,255,.88)'; g.fill();
      }
    },
    (g) => { // 冰晶簇
      g.drawImage(Sp.shadow(), -22, -4, 44, 14);
      g.save(); g.shadowColor = '#8fdcff'; g.shadowBlur = 10;
      for (const [x, h, w, c] of [[-9, 26, 6, '#a8e4ff'], [5, 40, 8, '#7fcfff'], [15, 22, 5, '#bff0ff']]) {
        polyPath(g, [x - w, 2, x - w * 0.7, -h * 0.8, x, -h, x + w * 0.7, -h * 0.8, x + w, 2]);
        g.fillStyle = metal(g, x - w, 0, x + w, 0, c); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUTC; g.stroke();
      }
      g.restore();
    },
    (g) => { // 雪岩
      g.drawImage(Sp.shadow(), -24, -2, 48, 14);
      part(g, () => polyPath(g, [-20, 4, -16, -10, -4, -18, 12, -14, 20, 0, 14, 6]), '#7a8a9a', 0, -6, 20, { lw: 2 });
      part(g, () => polyPath(g, [-16, -10, -4, -18, 12, -14, 16, -6, 2, -9, -10, -6]), '#ffffff', 0, -12, 14, { lw: 1.4, hl: false });
    }
  ],
  lava: [
    (g) => { // 黑曜石尖塔
      g.drawImage(Sp.shadow(), -24, -4, 48, 14);
      part(g, () => polyPath(g, [-16, 4, -10, -28, -2, -40, 8, -26, 16, 4]), '#3a2a34', 0, -16, 20, { lw: 2.2 });
      part(g, () => polyPath(g, [-2, -40, 8, -26, 2, -8, -4, -22]), '#5a4a5a', 2, -24, 8, { lw: 0, ao: false });
      g.save(); g.shadowColor = '#ff6a1a'; g.shadowBlur = 8; line(g, [-4, -26, 0, -14, -6, -2], 2, '#ff8a3a'); line(g, [6, -18, 9, -6], 1.6, '#ffb44a'); g.restore();
    },
    (g) => { // 熔岩池
      ell(g, 0, 0, 30, 13, '#241a1e');
      const gr = g.createRadialGradient(0, -1, 2, 0, 0, 26); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.35, '#ffb44a'); gr.addColorStop(0.8, '#ff5a1a'); gr.addColorStop(1, '#a8240a');
      ell(g, 0, 0, 25, 10, gr);
      ell(g, -6, -2, 6, 2, 'rgba(255,255,220,.6)'); circ(g, 8, 2, 2, 'rgba(255,240,180,.8)');
      g.beginPath(); g.ellipse(0, 0, 25, 10, 0, 0, TAU); g.lineWidth = 2; g.strokeStyle = '#140a0c'; g.stroke();
    },
    (g) => { // 焦枯树
      g.drawImage(Sp.shadow(), -22, -4, 44, 14);
      limb(g, [0, 4, 0, -24, -10, -38], 5, '#2a1e20', 2); limb(g, [0, -16, 12, -30, 16, -40], 4, '#2a1e20', 1.6); limb(g, [-6, -32, -16, -36], 3, '#2a1e20', 1.4);
      g.save(); g.shadowColor = '#ff6a1a'; g.shadowBlur = 6; circ(g, -10, -38, 2, '#ff8a3a'); circ(g, 16, -40, 2, '#ffb44a'); g.restore();
    }
  ]
};
Object.assign(DECO, {
  swamp: [
    (g) => { // 红树（气根）
      g.drawImage(Sp.shadow(), -32, -6, 64, 20);
      for (const k of [-14, -6, 6, 14]) limb(g, [k * 0.4, -14, k, 2], 2.6, '#4a3a24', 1.2);
      limb(g, [0, -6, 0, -26], 7, '#5a4428', 2);
      for (const [x, y, r] of [[-14, -38, 15], [12, -40, 15], [0, -50, 16], [-4, -32, 13]]) part(g, () => { g.beginPath(); g.arc(x, y, r, 0, TAU); }, '#3e5a2a', 0, -42, 28, { lw: 2.2, hl: 0.16 });
      for (let i = 0; i < 5; i++) line(g, [-16 + i * 8, -30, -17 + i * 8, -18 + (i % 2) * 6], 1.4, 'rgba(120,150,80,.85)');
      g.save(); g.shadowColor = '#b0ff5a'; g.shadowBlur = 6; circ(g, -8, -44, 2, '#d8ff8a'); circ(g, 9, -36, 1.6, '#d8ff8a'); g.restore();
    },
    (g) => { // 巨型发光蘑菇
      g.drawImage(Sp.shadow(), -26, -4, 52, 14);
      limb(g, [0, 4, 2, -20], 7, '#e8dcc0', 1.6);
      part(g, () => { g.beginPath(); g.ellipse(0, -24, 24, 14, 0, Math.PI, TAU); g.quadraticCurveTo(0, -18, -24, -24); g.closePath(); }, '#a85ac8', 0, -30, 24, { lw: 2 });
      for (const [x, y, r] of [[-12, -30, 3], [6, -34, 3.6], [14, -27, 2.4], [-2, -27, 2]]) circ(g, x, y, r, '#ffe8ff');
      limb(g, [14, 4, 16, -6], 3.5, '#e8dcc0', 1); part(g, () => { g.beginPath(); g.ellipse(16, -7, 9, 6, 0, Math.PI, TAU); g.closePath(); }, '#d87a3a', 16, -9, 9, { lw: 1.4 });
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(Sp.glow('#d08aff'), -30, -50, 60, 44); g.restore();
    },
    (g) => { // 腐朽树桩
      g.drawImage(Sp.shadow(), -24, -2, 48, 14);
      part(g, () => polyPath(g, [-16, 4, -14, -14, -8, -18, -2, -12, 4, -20, 10, -14, 15, -16, 16, 4]), '#5a4428', 0, -6, 16, { lw: 2 });
      ell(g, -2, -14, 10, 3.5, '#7a6038');
      ell(g, -8, -4, 5, 2.4, '#6a8a3a'); ell(g, 9, -9, 4, 2, '#6a8a3a');
      for (const [x, y] of [[-12, 2], [12, 0]]) { part(g, () => { g.beginPath(); g.ellipse(x, y - 3, 4, 2.6, 0, Math.PI, TAU); g.closePath(); }, '#e8c84a', x, y - 4, 4, { lw: 1, ao: false }); }
    },
    (g) => { // 芦苇丛
      g.drawImage(Sp.shadow(), -20, -2, 40, 12);
      for (let i = 0; i < 9; i++) { const x = -12 + i * 3, h = 22 + (i % 3) * 8; line(g, [x, 4, x + (i - 4) * 1.2, 4 - h], 2, i % 2 ? '#5a6a2a' : '#7a8a3a'); if (i % 3 === 1) { ell(g, x + (i - 4) * 1.2, 2 - h, 2.4, 6, '#6a4a24'); } }
    }
  ],
  city: [
    (g) => { // 废弃汽车
      g.drawImage(Sp.shadow(), -32, -4, 64, 16);
      part(g, () => { g.beginPath(); g.roundRect(-28, -18, 56, 18, 5); }, '#a83a3a', 0, -9, 28, { lw: 2 });
      part(g, () => { g.beginPath(); g.moveTo(-16, -18); g.lineTo(-10, -30); g.lineTo(12, -30); g.lineTo(18, -18); g.closePath(); }, '#8a2e2e', 0, -24, 16, { lw: 2 });
      g.fillStyle = '#6a8ab0'; g.beginPath(); g.moveTo(-12, -19); g.lineTo(-8, -27); g.lineTo(0, -27); g.lineTo(0, -19); g.fill(); g.beginPath(); g.moveTo(3, -19); g.lineTo(3, -27); g.lineTo(10, -27); g.lineTo(14, -19); g.fill();
      for (const x of [-17, 17]) { circ(g, x, 0, 6.5, '#1a1a20'); circ(g, x, 0, 3, '#5a5a64'); }
      circ(g, 26, -12, 2.4, '#ffe08a'); line(g, [-6, -10, 8, -14], 1.4, 'rgba(40,20,20,.6)');
      ell(g, -10, -14, 5, 2, 'rgba(120,80,40,.6)');
    },
    (g) => { // 路灯
      g.drawImage(Sp.shadow(), -14, -2, 28, 10);
      limb(g, [0, 4, 0, -44], 3.2, '#3a3e4a', 1.2); limb(g, [0, -44, 10, -48], 2.6, '#3a3e4a', 1);
      part(g, () => { g.beginPath(); g.roundRect(6, -50, 12, 5, 2); }, '#5a5e6a', 12, -48, 6, { lw: 1.2 });
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.85; g.drawImage(Sp.glow('#ffe08a'), -6, -60, 36, 30); g.restore();
      part(g, () => { g.beginPath(); g.roundRect(-5, 0, 10, 5, 1.5); }, '#4a4e5a', 0, 2, 5, { lw: 1.2 });
    },
    (g) => { // 消防栓 + 路障
      g.drawImage(Sp.shadow(), -22, -2, 44, 12);
      part(g, () => { g.beginPath(); g.roundRect(-20, -10, 24, 10, 2); }, '#ffb43a', -8, -5, 12, { lw: 1.6 });
      g.fillStyle = '#1a1a1a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-18 + i * 8, -10); g.lineTo(-14 + i * 8, -10); g.lineTo(-18 + i * 8, 0); g.lineTo(-20 + i * 8, 0); g.fill(); }
      limb(g, [-16, 0, -16, 4], 2, '#5a5a5a', 0.8); limb(g, [0, 0, 0, 4], 2, '#5a5a5a', 0.8);
      part(g, () => { g.beginPath(); g.roundRect(8, -16, 10, 18, 3); }, '#d83a3a', 13, -7, 8, { lw: 1.6 });
      part(g, () => { g.beginPath(); g.arc(13, -16, 5, Math.PI, TAU); g.closePath(); }, '#e84a4a', 13, -18, 5, { lw: 1.4 });
      circ(g, 7, -8, 2, '#c8c8d0'); circ(g, 19, -8, 2, '#c8c8d0');
    },
    (g) => { // 废铁堆 + 霓虹招牌
      g.drawImage(Sp.shadow(), -26, -2, 52, 14);
      part(g, () => polyPath(g, [-22, 4, -18, -10, -8, -16, 4, -12, 14, -18, 22, -6, 20, 4]), '#5a5e6a', 0, -6, 20, { lw: 2 });
      line(g, [-14, -8, 2, -14], 2.2, '#8a8e9a'); line(g, [4, -6, 18, -12], 2, '#7a5a3a');
      circ(g, -6, -4, 4, '#3a3e4a'); circ(g, -6, -4, 1.6, '#8a8e9a');
      part(g, () => { g.beginPath(); g.roundRect(-10, -36, 22, 14, 3); }, '#1a1a2a', 1, -29, 11, { lw: 1.6, ao: false });
      g.save(); g.shadowColor = '#ff4ad8'; g.shadowBlur = 8; g.strokeStyle = '#ff7ae8'; g.lineWidth = 1.6; g.strokeRect(-7, -33, 16, 8); g.fillStyle = '#4affff'; g.fillRect(-3, -31, 8, 4); g.restore();
      line(g, [-6, -22, -6, -14], 1.4, '#3a3e4a'); line(g, [8, -22, 8, -14], 1.4, '#3a3e4a');
    }
  ],
  sky: [
    (g) => { // 断裂石柱
      g.drawImage(Sp.shadow(), -22, -4, 44, 14);
      part(g, () => { g.beginPath(); g.rect(-15, 0, 30, 6); }, '#d8d4cc', 0, 3, 15, { lw: 2 });
      part(g, () => polyPath(g, [-10, 0, -10, -36, -4, -42, 2, -38, 8, -44, 10, -40, 10, 0]), '#f0ece4', 0, -20, 18, { lw: 2 });
      for (let i = -1; i <= 1; i++) line(g, [i * 5, -36, i * 5, -2], 1.4, 'rgba(120,110,100,.35)');
      line(g, [-10, -18, 10, -22], 1.2, 'rgba(90,80,70,.4)');
      for (const [x, y] of [[-12, -10], [11, -26]]) { ell(g, x, y, 4, 2, '#6aae54'); }
      line(g, [-10, -30, -14, -20, -12, -8], 1.6, '#4a9a44');
    },
    (g) => { // 水晶树
      g.drawImage(Sp.shadow(), -28, -4, 56, 16);
      limb(g, [0, 4, 0, -18, -10, -30], 5, '#e8e4dc', 1.6); limb(g, [0, -16, 12, -28], 4, '#e8e4dc', 1.4);
      g.save(); g.shadowColor = '#9ad8ff'; g.shadowBlur = 10;
      for (const [x, y, h, c] of [[-12, -30, 16, '#bfe8ff'], [12, -28, 18, '#ffd8f8'], [0, -40, 22, '#d8f4ff'], [-4, -26, 12, '#c8b0ff']]) {
        polyPath(g, [x - h * 0.35, y, x, y - h, x + h * 0.35, y, x, y + h * 0.4]);
        g.fillStyle = metal(g, x - h * 0.35, 0, x + h * 0.35, 0, c); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUTC; g.stroke();
      }
      g.restore();
    },
    (g) => { // 守护者雕像
      g.drawImage(Sp.shadow(), -24, -4, 48, 14);
      part(g, () => { g.beginPath(); g.rect(-16, -6, 32, 10); }, '#c8c4bc', 0, -1, 16, { lw: 2 });
      part(g, () => { g.beginPath(); g.moveTo(-9, -6); g.lineTo(-7, -30); g.lineTo(7, -30); g.lineTo(9, -6); g.closePath(); }, '#e8e4dc', 0, -18, 12, { lw: 2 });
      part(g, () => { g.beginPath(); g.arc(0, -36, 7, 0, TAU); }, '#f0ece4', 0, -36, 7, { lw: 1.8 });
      for (const sx of [-1, 1]) part(g, () => { g.beginPath(); g.moveTo(sx * 6, -28); g.quadraticCurveTo(sx * 22, -44, sx * 20, -18); g.quadraticCurveTo(sx * 14, -22, sx * 7, -14); g.closePath(); }, '#dcd8d0', sx * 13, -28, 10, { lw: 1.6 });
      limb(g, [8, -26, 10, -50], 1.8, '#c8a050', 0.8); g.save(); g.shadowColor = '#ffe08a'; g.shadowBlur = 8; circ(g, 10, -51, 2.6, '#ffe08a'); g.restore();
    },
    (g) => { // 云团花丛
      g.drawImage(Sp.shadow(), -24, -2, 48, 12);
      for (const [x, y, r] of [[-10, -6, 10], [10, -6, 10], [0, -13, 11]]) part(g, () => { g.beginPath(); g.arc(x, y, r, 0, TAU); }, '#7ac85a', 0, -9, 16, { lw: 2 });
      for (const [x, y, c] of [[-8, -12, '#ffffff'], [6, -16, '#ffe08a'], [10, -6, '#c8b0ff'], [-2, -4, '#ff9ad8']]) circ(g, x, y, 2.4, c);
    }
  ]
});
Sp.decoCount = kind => DECO[kind].length;
/* 小型散布装饰：按世界坐标哈希放置，打破地面平铺的重复感 */
const SMALL = {
  meadow: [
    (g) => { for (const [x, y, c] of [[-8, 2, '#ffffff'], [6, -2, '#ffd24a'], [0, 8, '#ff8ab8'], [12, 7, '#ffffff'], [-12, 9, '#a8c8ff']]) { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(g, x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.3, 1.5, c, a); } circ(g, x, y, 1.4, '#ffaa2a'); } },
    (g) => { for (let i = 0; i < 9; i++) { const x = -10 + i * 2.5, h = 10 + (i % 3) * 5; const gr = g.createLinearGradient(x, 8, x, 8 - h); gr.addColorStop(0, '#1f4a20'); gr.addColorStop(1, '#8ad864'); g.beginPath(); g.moveTo(x, 8); g.quadraticCurveTo(x + (i - 4) * 0.8, 8 - h * 0.6, x + (i - 4) * 1.6, 8 - h); g.lineWidth = 2; g.strokeStyle = gr; g.lineCap = 'round'; g.stroke(); } },
    (g) => { g.drawImage(Sp.shadow(), -12, 4, 24, 8); for (const [x, sz, c] of [[-5, 7, '#e2343a'], [7, 5, '#e8a03a']]) { limb(g, [x, 8, x, 0], sz * 0.55, '#f2ead8', 1); part(g, () => { g.beginPath(); g.arc(x, 0, sz, Math.PI, 0); g.closePath(); }, c, x, -sz * 0.4, sz, { lw: 1.4 }); circ(g, x - sz * 0.35, -sz * 0.4, sz * 0.18, '#fff'); circ(g, x + sz * 0.3, -sz * 0.6, sz * 0.14, '#fff'); } }
  ],
  desert: [
    (g) => { for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.9 + i * 0.3; line(g, [0, 8, Math.cos(a) * 12, 8 + Math.sin(a) * 14, Math.cos(a) * 16, 8 + Math.sin(a) * 18], 1.4, i % 2 ? '#8a6a3a' : '#a08048'); } },
    (g) => { for (const [x, y, r] of [[-7, 4, 5], [5, 6, 4], [1, -1, 3.5]]) { ell(g, x + 1, y + 2, r, r * 0.55, 'rgba(0,0,0,.2)'); part(g, () => { g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0.3, 0, TAU); }, '#b89060', x, y, r, { lw: 1 }); } },
    (g) => { g.strokeStyle = 'rgba(110,70,30,.45)'; g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-5, 3); g.lineTo(2, -4); g.lineTo(12, 1); g.moveTo(2, -4); g.lineTo(5, -12); g.moveTo(-5, 3); g.lineTo(-6, 10); g.stroke(); }
  ],
  frost: [
    (g) => { for (let i = 0; i < 6; i++) line(g, [-6 + i * 2.4, 8, -6 + i * 2.4 + (i - 2.5) * 2, -4 - (i % 2) * 4], 1.4, '#d8ecf6'); ell(g, 0, 8, 10, 3, 'rgba(255,255,255,.8)'); },
    (g) => { ell(g, 2, 3, 14, 5, 'rgba(90,130,180,.2)'); ell(g, 0, 0, 14, 6, '#ffffff'); ell(g, -4, -2, 6, 2, 'rgba(200,230,255,.8)'); },
    (g) => { g.save(); g.shadowColor = '#8fdcff'; g.shadowBlur = 6; polyPath(g, [-4, 6, -1, -10, 2, 6]); g.fillStyle = metal(g, -4, 0, 2, 0, '#bff0ff'); g.fill(); polyPath(g, [1, 6, 5, -4, 8, 6]); g.fill(); g.restore(); }
  ],
  lava: [
    (g) => { g.save(); g.shadowColor = '#ff6a1a'; g.shadowBlur = 8; line(g, [-14, -2, -4, 2, 3, -3, 13, 3], 2.2, '#ff8a3a'); line(g, [3, -3, 6, -10], 1.6, '#ffb44a'); g.restore(); },
    (g) => { for (const [x, h] of [[-6, 10], [2, 14], [8, 8]]) part(g, () => polyPath(g, [x - 4, 6, x, 6 - h, x + 4, 6]), '#2e2430', x, 6 - h / 2, 6, { lw: 1.2 }); },
    (g) => { ell(g, 0, 4, 12, 5, 'rgba(110,110,120,.45)'); ell(g, -2, 2, 7, 3, 'rgba(160,160,170,.35)'); g.save(); g.shadowColor = '#ff6a1a'; g.shadowBlur = 5; circ(g, 3, 2, 1.6, '#ffb44a'); circ(g, -4, 4, 1.2, '#ff7a2a'); g.restore(); }
  ]
};
Object.assign(SMALL, {
  swamp: [
    (g) => { ell(g, 0, 4, 13, 6, 'rgba(30,40,20,.5)'); ell(g, -3, 3, 7, 3, 'rgba(110,140,70,.35)'); circ(g, 4, 2, 1.6, 'rgba(200,255,150,.6)'); },
    (g) => { for (let i = 0; i < 6; i++) line(g, [-6 + i * 2.4, 8, -6 + i * 2.4 + (i - 2.5) * 1.8, -6 - (i % 2) * 5], 1.5, i % 2 ? '#5a6a2a' : '#7a8a3a'); },
    (g) => { for (const [x, sz] of [[-4, 4], [4, 3]]) { limb(g, [x, 8, x, 2], sz * 0.5, '#e8dcc0', 0.8); part(g, () => { g.beginPath(); g.arc(x, 2, sz, Math.PI, 0); g.closePath(); }, '#b06ad0', x, 0, sz, { lw: 1 }); } g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(Sp.glow('#d08aff'), -12, -8, 24, 18); g.restore(); }
  ],
  city: [
    (g) => { part(g, () => { g.beginPath(); g.arc(0, 2, 9, 0, TAU); }, '#4a4e58', 0, 2, 9, { lw: 1.4 }); for (let i = -1; i <= 1; i++) line(g, [-6, 2 + i * 3.5, 6, 2 + i * 3.5], 1.2, '#22242c'); },
    (g) => { line(g, [-12, 4, -2, 0, 4, 6, 12, 2], 1.4, 'rgba(10,10,14,.6)'); ell(g, 4, 6, 6, 2.5, 'rgba(120,230,90,.3)'); },
    (g) => { for (const [x, y, r, c] of [[-6, 4, 4, '#7a7e8a'], [4, 6, 3, '#a83a3a'], [1, 0, 2.6, '#5a5e6a']]) part(g, () => polyPath(g, [x - r, y + r * 0.5, x - r * 0.4, y - r, x + r, y - r * 0.3, x + r * 0.6, y + r * 0.6]), c, x, y, r, { lw: 0.9 }); }
  ],
  sky: [
    (g) => { for (const [x, y, c] of [[-7, 2, '#ffffff'], [6, -1, '#ffe08a'], [0, 7, '#c8b0ff'], [10, 6, '#9ad8ff']]) { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(g, x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 2.1, 1.4, c, a); } circ(g, x, y, 1.3, '#ffcc3a'); } },
    (g) => { ell(g, 0, 4, 14, 5, 'rgba(255,255,255,.35)'); ell(g, -4, 2, 7, 3, 'rgba(255,255,255,.45)'); },
    (g) => { for (let i = 0; i < 8; i++) { const x = -9 + i * 2.5, h = 8 + (i % 3) * 4; const gr = g.createLinearGradient(x, 8, x, 8 - h); gr.addColorStop(0, '#3f7a34'); gr.addColorStop(1, '#b0e88a'); g.beginPath(); g.moveTo(x, 8); g.quadraticCurveTo(x + (i - 3.5) * 0.8, 8 - h * 0.6, x + (i - 3.5) * 1.5, 8 - h); g.lineWidth = 1.8; g.strokeStyle = gr; g.lineCap = 'round'; g.stroke(); } }
  ]
});
Sp.small = function (kind, i) {
  return fx('small' + kind + i, 44 * S, 44 * S, (g) => { g.scale(S, S); g.translate(22, 24); SMALL[kind][i](g); });
};
Sp.deco = function (kind, i) {
  return fx('deco' + kind + i, 100 * S, 100 * S, (g) => { g.scale(S, S); g.translate(50, 80); DECO[kind][i](g); });
};
// 兼容旧接口
Sp.bigDeco = function (g, kind, x, y, h) {
  const n = DECO[kind].length, i = Math.min(n - 1, (h * n) | 0);
  g.drawImage(Sp.deco(kind, i), x - 50, y - 80, 100, 100);
};

/* ======================= 屏幕光照叠加（暗角 + 关卡色调） ======================= */
const overlayCache = {};
const TINT = {
  meadow: [['rgba(255,240,170,.16)', 0, 0], ['rgba(10,30,20,.45)']],
  desert: [['rgba(255,200,120,.2)', 0.5, 0], ['rgba(60,20,0,.42)']],
  frost: [['rgba(200,235,255,.22)', 0.5, 0], ['rgba(20,40,80,.4)']],
  lava: [['rgba(255,90,30,.22)', 0.5, 1], ['rgba(20,0,0,.6)']],
  swamp: [['rgba(150,255,120,.12)', 0.3, 0.2], ['rgba(10,20,10,.62)']],
  city: [['rgba(255,90,220,.14)', 0.8, 0.1], ['rgba(10,12,30,.58)']],
  sky: [['rgba(255,250,220,.24)', 0.5, 0], ['rgba(40,80,140,.32)']]
};
Sp.overlay = function (kind, w, h) {
  const key = kind + w + 'x' + h;
  if (overlayCache[key]) return overlayCache[key];
  for (const k in overlayCache) delete overlayCache[k];
  const cw = Math.ceil(w / 4), chh = Math.ceil(h / 4), c = mk(cw, chh), g = c.getContext('2d');
  const tn = TINT[kind] || TINT.meadow;
  // 环境光
  const [lc, lx, ly] = tn[0];
  const lg = g.createRadialGradient(cw * lx, chh * ly, 0, cw * lx, chh * ly, Math.max(cw, chh) * 1.1);
  lg.addColorStop(0, lc); lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.fillRect(0, 0, cw, chh);
  // 暗角
  const vg = g.createRadialGradient(cw / 2, chh / 2, Math.min(cw, chh) * 0.32, cw / 2, chh / 2, Math.hypot(cw, chh) * 0.58);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, tn[1][0]);
  g.fillStyle = vg; g.fillRect(0, 0, cw, chh);
  return (overlayCache[key] = c);
};

/* ======================= 地图武器 ======================= */
const MW = {
  cannonBase(g) { // 64x64，中心
    g.drawImage(Sp.shadow(), -30, 10, 60, 18);
    part(g, () => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; g.lineTo(Math.cos(a) * 27, Math.sin(a) * 22 + 4); } g.closePath(); }, '#8a8478', 0, 4, 27, { lw: 2.5 });
    part(g, () => { g.beginPath(); g.ellipse(0, 2, 19, 15, 0, 0, TAU); }, '#5a5e6a', 0, 2, 19, { lw: 2 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; circ(g, Math.cos(a) * 15, Math.sin(a) * 11 + 2, 1.8, '#c8ccd8'); }
    for (const sx of [-1, 1]) { g.fillStyle = '#ffd24a'; g.fillRect(sx * 24 - 2, -2, 4, 10); }
  },
  cannonBarrel(g) { // 指向 +x，原点为旋转轴
    part(g, () => { g.beginPath(); g.roundRect(0, -7, 40, 14, 4); }, '#4a4e5a', 20, 0, 18, { lw: 2.2 });
    part(g, () => { g.beginPath(); g.roundRect(34, -9, 10, 18, 3); }, '#6a6e7a', 39, 0, 9, { lw: 2 });
    line(g, [6, -3, 32, -3], 2, 'rgba(255,255,255,.35)');
    part(g, () => { g.beginPath(); g.arc(0, 0, 13, 0, TAU); }, '#6a7080', 0, 0, 13, { lw: 2.2, hl: 0.5 });
    circ(g, 0, 0, 4, '#ffd24a');
  },
  flamerBase(g) {
    g.drawImage(Sp.shadow(), -30, 10, 60, 18);
    part(g, () => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(Math.cos(a) * 26, Math.sin(a) * 21 + 4); } g.closePath(); }, '#6a5a50', 0, 4, 26, { lw: 2.5 });
    for (const x of [-12, 12]) { part(g, () => { g.beginPath(); g.roundRect(x - 7, -14, 14, 26, 6); }, '#d8342a', x, -1, 12, { lw: 2, hl: 0.5 }); g.fillStyle = '#ffd24a'; g.fillRect(x - 7, -4, 14, 3); }
    circ(g, 0, 8, 5, '#ff8a2a');
  },
  flamerNozzle(g) {
    part(g, () => { g.beginPath(); g.moveTo(0, -6); g.lineTo(30, -5); g.lineTo(38, -9); g.lineTo(38, 9); g.lineTo(30, 5); g.lineTo(0, 6); g.closePath(); }, '#7a7068', 20, 0, 18, { lw: 2.2 });
    part(g, () => { g.beginPath(); g.arc(0, 0, 11, 0, TAU); }, '#8a5a3a', 0, 0, 11, { lw: 2 });
    g.save(); g.shadowColor = '#ff7a2a'; g.shadowBlur = 8; circ(g, 38, 0, 4, '#ffb44a'); g.restore();
  },
  tankBody(g) { // 指向 +x，76x52
    g.drawImage(Sp.shadow(), -40, 12, 80, 22);
    for (const sy of [-1, 1]) {
      part(g, () => { g.beginPath(); g.roundRect(-34, sy * 18 - 7, 68, 14, 7); }, '#2e2a26', 0, sy * 18, 30, { lw: 2.2, hl: 0.2 });
      for (let i = 0; i < 9; i++) line(g, [-29 + i * 7.3, sy * 18 - 6, -29 + i * 7.3, sy * 18 + 6], 1.6, 'rgba(120,110,100,.8)');
    }
    part(g, () => { g.beginPath(); g.moveTo(-30, -14); g.lineTo(26, -14); g.lineTo(34, -6); g.lineTo(34, 6); g.lineTo(26, 14); g.lineTo(-30, 14); g.closePath(); }, '#6a7a42', 0, 0, 32, { lw: 2.4 });
    part(g, () => { g.beginPath(); g.rect(-26, -10, 14, 20); }, '#5a6a36', -19, 0, 10, { lw: 1.6, hl: false });
    for (const [x, y] of [[-28, -11], [-28, 11], [24, -11], [24, 11]]) circ(g, x, y, 1.6, '#c8d0a0');
    g.fillStyle = '#ffd24a'; g.fillRect(28, -3, 4, 6);
  },
  tankTurret(g) { // 指向 +x，原点为旋转轴
    part(g, () => { g.beginPath(); g.roundRect(4, -4.5, 34, 9, 3); }, '#4a5430', 20, 0, 16, { lw: 2 });
    part(g, () => { g.beginPath(); g.roundRect(34, -6, 8, 12, 2); }, '#3a4226', 38, 0, 6, { lw: 1.8 });
    part(g, () => { g.beginPath(); g.ellipse(0, 0, 15, 13, 0, 0, TAU); }, '#7a8a4c', 0, 0, 15, { lw: 2.2, hl: 0.5 });
    part(g, () => { g.beginPath(); g.arc(-3, -2, 5, 0, TAU); }, '#5a6a36', -3, -2, 5, { lw: 1.5 });
  },
  shell(g) {
    g.save(); g.shadowColor = '#ffb44a'; g.shadowBlur = 8;
    part(g, () => { g.beginPath(); g.arc(0, 0, 9, 0, TAU); }, '#3a3a44', 0, 0, 9, { lw: 2, hl: 0.7 });
    g.restore();
  }
};
const MWBOX = { cannonBase: [64, 64, 32, 30], cannonBarrel: [60, 32, 14, 16], flamerBase: [64, 64, 32, 30], flamerNozzle: [56, 32, 12, 16],
  tankBody: [84, 64, 42, 32], tankTurret: [60, 32, 18, 16], shell: [28, 28, 14, 14] };
Sp.MWBOX = MWBOX;
Sp.mapw = function (name) {
  const [w, h, ox, oy] = MWBOX[name];
  return fx('mw' + name, w * S, h * S, (g) => { g.scale(S, S); g.translate(ox, oy); MW[name](g); });
};

/* ======================= 地图物件 ======================= */
const MO = {
  palm(g) { // 原点为树干底部
    g.drawImage(Sp.shadow(), -26, -6, 52, 16);
    g.beginPath(); g.moveTo(-3, 2); g.quadraticCurveTo(-8, -26, 4, -52); g.lineWidth = 10; g.strokeStyle = OUTC; g.lineCap = 'round'; g.stroke();
    g.lineWidth = 7; g.strokeStyle = '#a8743a'; g.stroke();
    for (let i = 0; i < 5; i++) line(g, [-6 + i * 0.6, -6 - i * 9, 1 + i * 0.6, -8 - i * 9], 1.4, 'rgba(60,30,10,.5)');
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.62;
      g.save(); g.translate(4, -52); g.rotate(a);
      part(g, () => { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(18, -9, 36, 5); g.quadraticCurveTo(18, 2, 0, 0); g.closePath(); }, i % 2 ? '#3fae4a' : '#4fc05a', 18, 0, 18, { lw: 1.8 });
      g.restore();
    }
    circ(g, 1, -50, 3.5, '#6a4a1a'); circ(g, 7, -49, 3.5, '#6a4a1a');
  },
  spring(g) { // 128，中心
    g.translate(64, 64);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; part(g, () => { g.beginPath(); g.ellipse(Math.cos(a) * 56, Math.sin(a) * 50, 11, 8, a, 0, TAU); }, '#9aa0a8', Math.cos(a) * 56, Math.sin(a) * 50, 11, { lw: 1.5 }); }
    const gr = g.createRadialGradient(-10, -10, 4, 0, 0, 52); gr.addColorStop(0, '#d0fbff'); gr.addColorStop(0.5, '#5ad0f0'); gr.addColorStop(1, '#2a7ac8');
    g.beginPath(); g.ellipse(0, 0, 50, 44, 0, 0, TAU); g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
    ell(g, -16, -14, 14, 6, 'rgba(255,255,255,.55)', -0.4);
  },
  altar(g) { // 96，中心偏下
    g.translate(48, 60);
    g.drawImage(Sp.shadow(), -36, 8, 72, 22);
    part(g, () => { g.beginPath(); g.roundRect(-34, -6, 68, 22, 5); }, '#8a8478', 0, 5, 34, { lw: 2.5 });
    part(g, () => { g.beginPath(); g.roundRect(-24, -26, 48, 22, 4); }, '#a8a294', 0, -15, 24, { lw: 2.5 });
    for (const x of [-26, 26]) part(g, () => { g.beginPath(); g.rect(x - 4, -40, 8, 34); }, '#c8b07a', x, -23, 6, { lw: 1.8 });
    line(g, [-20, -10, 20, -10], 2, '#ffd24a');
  },
  pad(g) { // 80，中心
    g.translate(40, 40);
    part(g, () => { g.beginPath(); g.ellipse(0, 0, 34, 28, 0, 0, TAU); }, '#5a5e6a', 0, 0, 34, { lw: 2.5 });
    g.save(); g.beginPath(); g.ellipse(0, 0, 30, 24, 0, 0, TAU); g.clip();
    for (let i = -6; i <= 6; i++) { g.save(); g.translate(i * 10, 0); g.rotate(0.6); g.fillStyle = i % 2 ? '#ffd24a' : '#2a2a34'; g.fillRect(-3, -40, 6, 80); g.restore(); }
    g.restore();
    part(g, () => { g.beginPath(); g.ellipse(0, 0, 20, 16, 0, 0, TAU); }, '#7a7e8a', 0, 0, 20, { lw: 2 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.78; circ(g, Math.cos(a) * 14, Math.sin(a) * 11, 2, '#c8ccd8'); }
  },
  crater(g) { // 128，中心
    g.translate(64, 64);
    const gr = g.createRadialGradient(0, 0, 8, 0, 0, 60); gr.addColorStop(0, '#ff9a3a'); gr.addColorStop(0.35, '#7a2a14'); gr.addColorStop(0.7, '#2a1a1c'); gr.addColorStop(1, 'rgba(42,26,28,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fill();
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; part(g, () => polyPath(g, [Math.cos(a) * 30, Math.sin(a) * 26, Math.cos(a + 0.25) * 46, Math.sin(a + 0.25) * 40, Math.cos(a - 0.1) * 48, Math.sin(a - 0.1) * 42]), '#3a2a30', Math.cos(a) * 40, Math.sin(a) * 36, 10, { lw: 1.5 }); }
    circ(g, 0, 0, 12, '#ffd06a');
  },
  portal(g) { // 128，中心
    g.translate(64, 64);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; part(g, () => { g.beginPath(); g.rect(Math.cos(a) * 52 - 6, Math.sin(a) * 44 - 6, 12, 12); }, '#6a6080', Math.cos(a) * 52, Math.sin(a) * 44, 8, { lw: 1.5 }); }
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, 46); gr.addColorStop(0, '#1a0830'); gr.addColorStop(0.6, '#6a2ac8'); gr.addColorStop(1, 'rgba(200,140,255,.15)');
    g.beginPath(); g.ellipse(0, 0, 44, 38, 0, 0, TAU); g.fillStyle = gr; g.fill();
  }
};
Object.assign(MO, {
  crate(g) { // 48，中心偏下
    g.translate(24, 26);
    g.drawImage(Sp.shadow(), -18, 6, 36, 12);
    part(g, () => { g.beginPath(); g.rect(-15, -14, 30, 26); }, '#b07a3a', 0, -1, 16, { lw: 2 });
    part(g, () => { g.beginPath(); g.rect(-15, -20, 30, 8); }, '#c88e48', 0, -16, 15, { lw: 2 });
    g.strokeStyle = '#6a4220'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-13, -10); g.lineTo(13, 10); g.moveTo(13, -10); g.lineTo(-13, 10); g.stroke();
    for (const [x, y] of [[-12, -11], [12, -11], [-12, 9], [12, 9]]) circ(g, x, y, 1.6, '#3a2a1a');
  },
  barrel(g) {
    g.translate(24, 26);
    g.drawImage(Sp.shadow(), -17, 6, 34, 12);
    part(g, () => { g.beginPath(); g.roundRect(-13, -18, 26, 30, 7); }, '#d8342a', 0, -3, 15, { lw: 2, hl: 0.5 });
    part(g, () => { g.beginPath(); g.ellipse(0, -18, 13, 5, 0, 0, TAU); }, '#ff6a4a', 0, -18, 13, { lw: 1.8 });
    g.fillStyle = '#3a3a44'; g.fillRect(-13, -9, 26, 3); g.fillRect(-13, 4, 26, 3);
    g.fillStyle = '#ffd24a'; polyPath(g, [0, -6, 6, 3, -6, 3]); g.fill(); g.fillStyle = '#1a1a1a'; g.fillRect(-0.8, -3, 1.6, 4);
  },
  tesla(g) { // 80x112，底部
    g.translate(40, 96);
    g.drawImage(Sp.shadow(), -30, -6, 60, 18);
    part(g, () => { g.beginPath(); g.roundRect(-22, -14, 44, 18, 5); }, '#5a5e6a', 0, -5, 22, { lw: 2.2 });
    part(g, () => { g.beginPath(); g.moveTo(-8, -14); g.lineTo(8, -14); g.lineTo(5, -62); g.lineTo(-5, -62); g.closePath(); }, '#7a7e8a', 0, -38, 10, { lw: 2 });
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(0, -20 - i * 7, 10 - i * 0.6, 3, 0, 0, TAU); g.lineWidth = 2.5; g.strokeStyle = '#c8783a'; g.stroke(); }
    part(g, () => { g.beginPath(); g.arc(0, -68, 10, 0, TAU); }, '#a8b4c8', 0, -68, 10, { lw: 2, hl: 0.7 });
  },
  obelisk(g) {
    g.translate(40, 96);
    g.drawImage(Sp.shadow(), -26, -6, 52, 16);
    part(g, () => { g.beginPath(); g.rect(-20, -10, 40, 12); }, '#8a8a96', 0, -4, 20, { lw: 2 });
    part(g, () => polyPath(g, [-12, -10, 12, -10, 8, -74, 0, -86, -8, -74]), '#5a5e78', 0, -46, 14, { lw: 2.2 });
    g.save(); g.shadowColor = '#7fd8ff'; g.shadowBlur = 8;
    for (let i = 0; i < 4; i++) { line(g, [-4, -22 - i * 13, 4, -26 - i * 13], 2, '#9fe8ff'); line(g, [-3, -28 - i * 13, 0, -24 - i * 13], 1.6, '#9fe8ff'); }
    g.restore();
  },
  cursealtar(g) {
    g.translate(40, 80);
    g.drawImage(Sp.shadow(), -30, -4, 60, 18);
    part(g, () => { g.beginPath(); g.roundRect(-28, -14, 56, 20, 4); }, '#3a2a40', 0, -4, 28, { lw: 2.2 });
    part(g, () => { g.beginPath(); g.roundRect(-18, -30, 36, 18, 4); }, '#4a3450', 0, -21, 18, { lw: 2 });
    part(g, () => { g.beginPath(); g.arc(0, -42, 11, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(6, -32); g.lineTo(-6, -32); g.closePath(); }, '#e8e0d0', 0, -40, 11, { lw: 1.8 });
    circ(g, -4, -42, 2.6, '#c060ff'); circ(g, 4, -42, 2.6, '#c060ff');
    for (const x of [-22, 22]) { line(g, [x, -14, x, -40], 3, '#2a1a2a'); circ(g, x, -43, 4, '#c060ff'); }
  }
});
const MOBOX = { crate: [48, 48, 24, 26], barrel: [48, 48, 24, 26], tesla: [80, 112, 40, 96], obelisk: [80, 112, 40, 96], cursealtar: [80, 96, 40, 80], palm: [80, 90, 40, 76], spring: [128, 128, 64, 64], altar: [96, 96, 48, 60], pad: [80, 80, 40, 40], crater: [128, 128, 64, 64], portal: [128, 128, 64, 64] };
Sp.MOBOX = MOBOX;
Sp.mobj = function (name) {
  const [w, h, ox, oy] = MOBOX[name];
  return fx('mo' + name, w * S, h * S, (g) => { g.scale(S, S); if (name === 'palm') g.translate(ox, oy); MO[name](g); });
};

/* ======================= 新武器贴图 ======================= */
Sp.disc = evo => fx('disc' + (evo ? 1 : 0), 64, 64, (g) => {
  g.translate(32, 32);
  const c = evo ? '#ff9af0' : '#9fffe0';
  g.save(); g.shadowColor = c; g.shadowBlur = 10;
  g.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = i % 2 ? 16 : 27; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
  g.fillStyle = metal(g, -27, 0, 27, 0, evo ? '#ffd0f4' : '#d8f4ff'); g.fill(); g.lineWidth = 2.5; g.strokeStyle = OUTC; g.stroke();
  g.restore();
  circ(g, 0, 0, 9, c); circ(g, 0, 0, 4, '#ffffff');
});
Sp.drone = evo => fx('drone' + (evo ? 1 : 0), 64, 48, (g) => {
  g.translate(32, 24);
  for (const sx of [-1, 1]) { limb(g, [sx * 8, 0, sx * 22, -6], 3, '#5a6070', 1); ell(g, sx * 22, -8, 10, 3, 'rgba(200,240,255,.55)'); }
  part(g, () => { g.beginPath(); g.ellipse(0, 0, 13, 9, 0, 0, TAU); }, evo ? '#c86aff' : '#5a7a9a', 0, 0, 13, { lw: 2, hl: 0.6 });
  glowEye(g, 0, 1, 3.5, evo ? '#ff7ad8' : '#7affff');
});
Sp.mine = () => fx('mine', 48, 40, (g) => {
  g.translate(24, 22);
  g.drawImage(Sp.shadow(), -16, 2, 32, 10);
  part(g, () => { g.beginPath(); g.ellipse(0, 0, 15, 10, 0, 0, TAU); }, '#4a4e44', 0, 0, 15, { lw: 2 });
  part(g, () => { g.beginPath(); g.ellipse(0, -3, 8, 5, 0, 0, TAU); }, '#7a7e70', 0, -3, 8, { lw: 1.5 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; circ(g, Math.cos(a) * 11, Math.sin(a) * 7, 1.6, '#c8ccbe'); }
});
Sp.PET = { id: 'pet_golem', shape: 'golem', name: '石像守卫', r: 16, c1: '#c8b28a', c2: '#7affff' };
Sp.PET_EVO = { id: 'pet_titan', shape: 'golem', name: '泰坦守护者', r: 16, c1: '#e0c070', c2: '#ffd24a' };

/* 供图标等模块复用的绘图工具 */
Sp.lib = { part, limb, line, circ, ell, polyPath, metal, glowEye, spikes, shade, rgba, mix, mk, OUTC };

/* ======================= 缓存清理 ======================= */
Sp.clear = function () {
  for (const k in enemyCache) delete enemyCache[k];
  for (const k in glowCache) delete glowCache[k];
  for (const k in fxCache) delete fxCache[k];
  for (const k in heroCache) delete heroCache[k];
  for (const k in digitCache) delete digitCache[k];
  for (const k in groundCache) delete groundCache[k];
  for (const k in overlayCache) delete overlayCache[k];
};
})(window.SF = window.SF || {});
