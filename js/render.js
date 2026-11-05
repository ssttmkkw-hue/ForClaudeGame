/* 画布渲染：地面、贴花、装饰、实体、技能特效、粒子、氛围光照 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU, Sp = SF.Sprites, G = SF.G, V = SF.VFX;
const R = SF.Render = {};
let cv, ctx, W = 0, H = 0, dpr = 1, scale = 1, lastNow = 0;
const CHUNK = 260;
const amb = []; let ambStage = null;
const FLY = { bat: 1, ghost: 1, lich: 1, edrone: 1, wyvern: 1 };

R.init = function (canvas) {
  cv = canvas; ctx = cv.getContext('2d');
  R.resize();
  window.addEventListener('resize', R.resize);
  window.addEventListener('orientationchange', () => setTimeout(R.resize, 200));
  cv.addEventListener('contextlost', e => e.preventDefault());
  cv.addEventListener('contextrestored', R.reset);
};
let RS = 1; // 动态分辨率系数
R.resize = function () {
  W = window.innerWidth; H = window.innerHeight;
  dpr = (SF.Save.data.set.hq ? Math.min(2, window.devicePixelRatio || 1) : 1) * RS;
  cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  scale = U.clamp(Math.sqrt(W * H) / 540, 0.6, 1.6);
  SF.view.hw = W / scale / 2; SF.view.hh = H / scale / 2;
};
R.onStart = function () { ambStage = null; perf.t = 0; perf.n = 0; perf.good = 0; };
// 根据实际帧耗时自动调节内部分辨率（低端机保帧率）
const perf = { t: 0, n: 0, good: 0 };
R.perfSample = function (dt) {
  perf.t += dt; perf.n++;
  if (perf.t < 2) return;
  const avg = perf.t / perf.n; perf.t = 0; perf.n = 0;
  if (avg > 0.024 && RS > 0.55) { RS = Math.max(0.55, RS - 0.15); perf.good = 0; R.resize(); }
  else if (avg < 0.0175) { if (++perf.good >= 3 && RS < 1) { RS = Math.min(1, RS + 0.1); perf.good = 0; R.resize(); } }
  else perf.good = 0;
};
R.renderScale = () => RS;
// 小地图
R.drawMini = function (c) {
  const mp = SF.Map.get();
  if (!mp || !G.p) return;
  const g = c.getContext('2d'), W2 = c.width, sc = W2 / (mp.maxX - mp.minX);
  const X = x => (x - mp.minX) * sc, Y = y => (y - mp.minY) * sc;
  if (!mp.mini) {
    const b = document.createElement('canvas'); b.width = W2; b.height = W2;
    const q = b.getContext('2d');
    q.fillStyle = G.stage.ground[0]; q.fillRect(0, 0, W2, W2);
    q.lineCap = 'round';
    for (const s of mp.liquids) {
      const col = { lava: '#ff6a1a', chasm: '#0c1830', bog: '#3a4a22', acid: '#6aff3a', void: '#0a0c24' }[s.k] || '#3a8ad0';
      if (s.t === 's') { q.strokeStyle = col; q.lineWidth = Math.max(2, s.r * 2 * sc); q.beginPath(); q.moveTo(X(s.x1), Y(s.y1)); q.lineTo(X(s.x2), Y(s.y2)); q.stroke(); }
      else { q.fillStyle = col; q.beginPath(); q.arc(X(s.x), Y(s.y), Math.max(2, s.r * sc), 0, TAU); q.fill(); }
    }
    q.fillStyle = 'rgba(20,16,24,.75)';
    for (const s of mp.solids) { if (s.t === 'c') { q.beginPath(); q.arc(X(s.x), Y(s.y), Math.max(1.2, s.r * sc), 0, TAU); q.fill(); } else q.fillRect(X(s.x), Y(s.y), Math.max(1.5, s.w * sc), Math.max(1.5, s.h * sc)); }
    const ZC = { tesla: '#9fd8ff', obelisk: '#4a8aff', curse: '#c060ff', boost: '#7affff', spikes: '#8a8a96', spring: '#5ae0ff', might: '#ff4a5a', haste: '#3affd0', shrine: '#ffd24a', swamp: '#6a7a3a', sand: '#d8b060', frost: '#e8f8ff', pool: '#ff8a3a', vent: '#ff4a1a', toxic: '#8aff3a', storm: '#ffe84a' };
    for (const z of mp.zones) { q.fillStyle = ZC[z.k] || '#fff'; q.globalAlpha = 0.85; q.beginPath(); q.arc(X(z.x), Y(z.y), Math.max(3, z.r * sc), 0, TAU); q.fill(); }
    q.globalAlpha = 1; q.fillStyle = '#c890ff';
    for (const p of mp.portals) { q.beginPath(); q.arc(X(p.x), Y(p.y), 4, 0, TAU); q.fill(); }
    q.strokeStyle = 'rgba(255,255,255,.5)'; q.lineWidth = 2; q.strokeRect(1, 1, W2 - 2, W2 - 2);
    mp.mini = b;
  }
  g.clearRect(0, 0, W2, W2);
  g.drawImage(mp.mini, 0, 0);
  const cam = SF.Map.camera();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
  g.strokeRect(X(cam[0] - SF.view.hw), Y(cam[1] - SF.view.hh), SF.view.hw * 2 * sc, SF.view.hh * 2 * sc);
  g.fillStyle = '#ffd24a';
  for (const m of G.mapw || []) g.fillRect(X(m.x) - 3.5, Y(m.y) - 3.5, 7, 7);
  for (const e of G.bigs) { if (e.dead) continue; g.fillStyle = e.boss ? '#ff2a3a' : '#ff8a5a'; g.beginPath(); g.arc(X(e.x), Y(e.y), e.boss ? 6 : 3.5, 0, TAU); g.fill(); }
  for (const e of G.enemies) if (e.elite && !e.dead && !e.big) { g.fillStyle = '#ffb04a'; g.beginPath(); g.arc(X(e.x), Y(e.y), 3.5, 0, TAU); g.fill(); }
  g.fillStyle = '#ffffff'; g.strokeStyle = '#1a1030'; g.lineWidth = 2;
  g.beginPath(); g.arc(X(G.p.x), Y(G.p.y), 5, 0, TAU); g.fill(); g.stroke();
};
R.reset = function () {
  ambStage = null;
  Sp.clear();
  if (G.enemies) for (const e of G.enemies) e.spr = Sp.enemy(e.def);
  R.resize();
};

let FXA = 1; // 叠加发光强度（亮色地图降低，避免过曝）
const FXA_STAGE = { meadow: 0.7, desert: 0.62, frost: 0.48, lava: 0.95, swamp: 0.9, city: 0.92, sky: 0.5 };
function glowAt(col, x, y, r, a) {
  ctx.globalAlpha = ctx.globalCompositeOperation === 'lighter' ? Math.min(1, a * FXA) : a;
  ctx.drawImage(Sp.glow(col), x - r, y - r, r * 2, r * 2);
}
let K = 1, TX = 0, TY = 0; // 当前相机变换
// 直接设置变换矩阵绘制旋转贴图（避免 save/restore 的开销）
function rotDraw(img, x, y, ang, w, h, ax, ay) {
  const c = Math.cos(ang) * K, s = Math.sin(ang) * K;
  ctx.setTransform(c, s, -s, c, TX + K * x, TY + K * y);
  ctx.drawImage(img, -w * (ax === undefined ? 0.5 : ax), -h * (ay === undefined ? 0.5 : ay), w, h);
  ctx.setTransform(K, 0, 0, K, TX, TY);
}
// 水平翻转绘制（敌人/英雄朝向）
function flipDraw(img, x, y, face, w, h, ax, ay) {
  ctx.setTransform(K * face, 0, 0, K, TX + K * x, TY + K * y);
  ctx.drawImage(img, -w * ax, -h * ay, w, h);
  ctx.setTransform(K, 0, 0, K, TX, TY);
}
// 位图数字
function drawNum(txt, x, y, h, style) {
  const D = Sp.digits(style), sc = h / D.H;
  let tw = 0;
  for (let i = 0; i < txt.length; i++) tw += (D.w[txt[i]] || 16) * sc * 0.82;
  let cx = x - tw / 2;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i], idx = D.idx(ch);
    const w = (D.w[ch] || 16) * sc * 0.82;
    if (idx >= 0) ctx.drawImage(D.c, idx * D.cw, 0, D.cw, D.H, cx + w / 2 - D.cw * sc / 2, y - h / 2, D.cw * sc, h);
    cx += w;
  }
}
// 简单 LCG，用于可复现的闪电抖动
function lcg(seed) { let s = seed | 0 || 1; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }

/* ------------------------- 氛围粒子 ------------------------- */
function ambient(dt, cx, cy, hw, hh) {
  const kind = G.stage.deco;
  const N = { meadow: 22, desert: 32, frost: 60, lava: 30, swamp: 34, city: 40, sky: 18 }[kind] || 26;
  if (ambStage !== kind) {
    amb.length = 0; ambStage = kind;
    for (let i = 0; i < N; i++) amb.push({ x: cx + U.rand(-hw, hw), y: cy + U.rand(-hh, hh), ph: Math.random() * TAU, s: Math.random() });
  }
  const now = lastNow;
  const addOn = kind === 'meadow' || kind === 'lava' || kind === 'swamp';
  ctx.globalCompositeOperation = addOn ? 'lighter' : 'source-over';
  for (const a of amb) {
    if (kind === 'meadow') { a.x += Math.cos(now * 0.6 + a.ph) * 18 * dt; a.y += Math.sin(now * 0.8 + a.ph * 1.3) * 14 * dt - 4 * dt; }
    else if (kind === 'desert') { a.x += (70 + a.s * 60) * dt; a.y += Math.sin(now * 2 + a.ph) * 10 * dt; }
    else if (kind === 'frost') { a.x += (Math.sin(now * 1.2 + a.ph) * 22 - 10) * dt; a.y += (35 + a.s * 45) * dt; }
    else if (kind === 'swamp') { a.x += Math.cos(now * 0.4 + a.ph) * 12 * dt; a.y += Math.sin(now * 0.5 + a.ph * 1.7) * 10 * dt - 6 * dt; }
    else if (kind === 'city') { a.x -= (20 + a.s * 30) * dt; a.y += (220 + a.s * 160) * dt; }
    else if (kind === 'sky') { a.x += (26 + a.s * 30) * dt; a.y += Math.sin(now * 0.4 + a.ph) * 6 * dt; }
    else { a.y -= (30 + a.s * 50) * dt; a.x += Math.sin(now * 2 + a.ph) * 16 * dt; }
    const mx = hw + 40, my = hh + 40;
    if (a.x < cx - mx) a.x += mx * 2; else if (a.x > cx + mx) a.x -= mx * 2;
    if (a.y < cy - my) a.y += my * 2; else if (a.y > cy + my) a.y -= my * 2;
    if (kind === 'meadow') { const k = 0.5 + 0.5 * Math.sin(now * 3 + a.ph * 3); glowAt(a.s > 0.5 ? '#e8ff8a' : '#fff6b0', a.x, a.y, 5 + a.s * 4, 0.35 + 0.55 * k); }
    else if (kind === 'desert') { ctx.globalAlpha = 0.25 + a.s * 0.3; ctx.fillStyle = '#fff2d0'; ctx.fillRect(a.x, a.y, 2 + a.s * 2, 1.2); if (a.s > 0.75) { ctx.globalAlpha = 0.18; ctx.fillRect(a.x - 26, a.y, 22, 1); } }
    else if (kind === 'frost') { ctx.globalAlpha = 0.55 + a.s * 0.4; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(a.x, a.y, 1 + a.s * 2.2, 0, TAU); ctx.fill(); }
    else if (kind === 'swamp') { const k = 0.5 + 0.5 * Math.sin(now * 2 + a.ph * 3); if (a.s > 0.35) glowAt(a.s > 0.7 ? '#d8ff6a' : '#8aff9a', a.x, a.y, 4 + a.s * 4, 0.3 + 0.6 * k); else { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.08; ctx.fillStyle = '#c8e8b0'; ctx.beginPath(); ctx.ellipse(a.x, a.y, 90, 30, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; } }
    else if (kind === 'city') { ctx.globalAlpha = 0.18 + a.s * 0.2; ctx.strokeStyle = '#bcd0ff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - 3, a.y + 14 + a.s * 8); ctx.stroke(); }
    else if (kind === 'sky') { ctx.globalAlpha = 0.05 + a.s * 0.07; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(a.x, a.y, 70 + a.s * 80, 22 + a.s * 18, 0, 0, TAU); ctx.fill(); }
    else { const k = 0.5 + 0.5 * Math.sin(now * 8 + a.ph * 5); glowAt(a.s > 0.6 ? '#ffd06a' : '#ff6a2a', a.x, a.y, 3 + a.s * 4, 0.4 + 0.5 * k); }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

/* ------------------------- 主绘制 ------------------------- */
R.draw = function () {
  if (!G.stage || !G.p) return;
  const PROF = SF.__prof; let pt = PROF ? performance.now() : 0, pn = 'start';
  const prof = (n) => { ctx.getImageData(0, 0, 1, 1); const t = performance.now(); PROF[pn] = (PROF[pn] || 0) + t - pt; pt = t; pn = n; };
  const now = performance.now() / 1000;
  const rdt = lastNow ? Math.min(0.05, now - lastNow) : 0.016; lastNow = now;
  const P = G.p, k = dpr * scale, hw = SF.view.hw, hh = SF.view.hh;
  const shx = G.shake > 0 ? U.rand(-G.shake, G.shake) : 0, shy = G.shake > 0 ? U.rand(-G.shake, G.shake) : 0;
  const cam = SF.Map.camera(), mp = SF.Map.get();
  const cx = cam[0] + shx, cy = cam[1] + shy;
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  K = k; TX = cv.width / 2 - cx * k; TY = cv.height / 2 - cy * k;
  ctx.setTransform(K, 0, 0, K, TX, TY);
  const x0 = cx - hw - 20, y0 = cy - hh - 20, x1 = cx + hw + 20, y1 = cy + hh + 20;
  const vis = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
  const kind = G.stage.deco;
  FXA = FXA_STAGE[kind] || 0.8;

  if (PROF) prof('地面');
  // 地图外背景
  const OUTC = { meadow: '#173018', desert: '#2e1c10', frost: '#0e2440', lava: '#a8300c', swamp: '#141c10', city: '#12141c', sky: '#5a8ad8' }[kind] || '#101018';
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = OUTC; ctx.fillRect(0, 0, cv.width, cv.height);
  if (kind === 'lava') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.1 * Math.sin(now * 1.5); ctx.fillStyle = '#ff8a2a'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  ctx.setTransform(K, 0, 0, K, TX, TY);
  if (kind === 'sky') { // 浮岛外的云海
    for (let i = 0; i < 14; i++) { const yy = Math.floor(y0 / 120) * 120 + i * 90, xx = x0 + ((U.hash(i, Math.floor(y0 / 120), 5) * 1400 + now * 18) % (x1 - x0 + 400)) - 200; ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(xx, yy, 160, 36, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (kind === 'frost' || kind === 'lava') {
    ctx.strokeStyle = kind === 'frost' ? 'rgba(160,210,255,.25)' : 'rgba(255,220,120,.35)'; ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const yy = Math.floor(y0 / 80) * 80 + i * 110 + ((now * 20) % 80); ctx.beginPath(); for (let xx = x0 - 40; xx < x1 + 40; xx += 40) ctx.lineTo(xx, yy + Math.sin(xx * 0.02 + now + i) * 8); ctx.stroke(); }
  }
  // 地面（只在地图范围内）
  ctx.save(); ctx.beginPath(); ctx.rect(mp.minX, mp.minY, mp.maxX - mp.minX, mp.maxY - mp.minY); ctx.clip();
  {
    const tile = Sp.ground(G.stage), TS = Sp.TILE;
    const gx0 = Math.floor(x0 / TS), gx1 = Math.floor(x1 / TS), gy0 = Math.floor(y0 / TS), gy1 = Math.floor(y1 / TS);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) ctx.drawImage(tile, gx * TS - 0.5, gy * TS - 0.5, TS + 1, TS + 1);
  }
  // 散布小装饰
  {
    const SC = 110, a0x = Math.floor((x0 - 30) / SC), a1x = Math.floor((x1 + 30) / SC), a0y = Math.floor((y0 - 30) / SC), a1y = Math.floor((y1 + 30) / SC);
    for (let gy = a0y; gy <= a1y; gy++) for (let gx = a0x; gx <= a1x; gx++) {
      const h = U.hash(gx, gy, 21);
      if (h > 0.42) continue;
      const sx = gx * SC + U.hash(gx, gy, 22) * SC, sy = gy * SC + U.hash(gx, gy, 23) * SC;
      ctx.drawImage(Sp.small(kind, (U.hash(gx, gy, 24) * 3) | 0), sx - 22, sy - 24, 44, 44);
    }
  }
  // 边缘内阴影
  {
    const E = 70, ec = kind === 'lava' ? 'rgba(255,90,20,' : 'rgba(0,0,0,';
    const band = (gx0, gy0, gx1, gy1, x, y, w, h) => { const gr = ctx.createLinearGradient(gx0, gy0, gx1, gy1); gr.addColorStop(0, ec + '.55)'); gr.addColorStop(1, ec + '0)'); ctx.fillStyle = gr; ctx.fillRect(x, y, w, h); };
    if (y0 < mp.minY + E) band(0, mp.minY, 0, mp.minY + E, mp.minX, mp.minY, mp.maxX - mp.minX, E);
    if (y1 > mp.maxY - E) band(0, mp.maxY, 0, mp.maxY - E, mp.minX, mp.maxY - E, mp.maxX - mp.minX, E);
    if (x0 < mp.minX + E) band(mp.minX, 0, mp.minX + E, 0, mp.minX, mp.minY, E, mp.maxY - mp.minY);
    if (x1 > mp.maxX - E) band(mp.maxX, 0, mp.maxX - E, 0, mp.maxX - E, mp.minY, E, mp.maxY - mp.minY);
  }
  ctx.restore();
  ctx.setTransform(K, 0, 0, K, TX, TY);

  if (PROF) prof('地图边界');
  // 边界外的植被/岩石带
  {
    const FR = { meadow: [['meadow', 0], ['meadow', 1]], desert: [['desert', 3], ['desert', 0]], frost: [['frost', 0], ['frost', 1]], lava: [['lava', 0], ['lava', 2]], swamp: [['swamp', 0], ['swamp', 3]], city: [['city', 3], ['city', 0]], sky: [['sky', 3], ['sky', 1]] }[kind];
    const step = 64;
    const edgeProp = (x, y, h) => { const v = FR[(h * 2) | 0]; const sc = 1.05 + h * 0.5; ctx.drawImage(Sp.deco(v[0], v[1]), x - 50 * sc, y - 80 * sc, 100 * sc, 100 * sc); };
    for (let x = Math.floor(x0 / step) * step - step; x < x1 + step; x += step) {
      if (y0 < mp.minY + 40) for (let row = 0; row < 3; row++) { const h = U.hash(x, row, 61); edgeProp(x + h * 30, mp.minY - 18 - row * 48, U.hash(x, row, 62)); }
      if (y1 > mp.maxY - 40) for (let row = 0; row < 3; row++) { const h = U.hash(x, row, 63); edgeProp(x + h * 30, mp.maxY + 46 + row * 48, U.hash(x, row, 64)); }
    }
    for (let y = Math.floor(y0 / step) * step - step; y < y1 + step * 2; y += step) {
      if (x0 < mp.minX + 40) for (let col = 0; col < 3; col++) { const h = U.hash(col, y, 65); edgeProp(mp.minX - 22 - col * 50, y + h * 30, U.hash(col, y, 66)); }
      if (x1 > mp.maxX - 40) for (let col = 0; col < 3; col++) { const h = U.hash(col, y, 67); edgeProp(mp.maxX + 22 + col * 50, y + h * 30, U.hash(col, y, 68)); }
    }
  }

  if (PROF) prof('液体');
  // 河流 / 岩浆 / 裂谷
  const near = SF.Map.near(x0 - 80, y0 - 80, x1 + 80, y1 + 120);
  const liq = [], sol = [];
  for (let i = 0; i < near.length; i++) (near[i].liquid ? liq : sol).push(near[i]);
  {
    const LQ = { water: ['#7a6440', '#2f7fc0', '#5ab8ea', 'rgba(255,255,255,.4)'], lava: ['#2a1210', '#e8441a', '#ffb43a', 'rgba(255,240,170,.35)'], chasm: ['#eef8ff', '#0c1830', '#1c2c50', null],
      bog: ['#3a2e1a', '#2a3618', '#4e5e2c', 'rgba(190,230,140,.28)'], acid: ['#5a5e68', '#2a8a1e', '#6ae83a', 'rgba(220,255,170,.45)'], void: ['#f4f8ff', '#16224e', '#2a3a78', 'rgba(200,220,255,.25)'] };
    const shapeStroke = (s, extra, col) => {
      if (s.t === 's') { ctx.strokeStyle = col; ctx.lineWidth = (s.r + extra) * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
      else if (s.t === 'c') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1, s.r + extra), 0, TAU); ctx.fill(); }
    };
    for (const s of liq) shapeStroke(s, 12, LQ[s.k][0]);
    for (const s of liq) shapeStroke(s, 0, LQ[s.k][1]);
    for (const s of liq) shapeStroke(s, -s.r * 0.45, LQ[s.k][2]);
    ctx.setLineDash([5, 28, 12, 46]); ctx.lineDashOffset = -now * 40; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const s of liq) { const c = LQ[s.k][3]; if (!c || s.t !== 's') continue; ctx.strokeStyle = c; for (const o of [-0.4, 0.35]) { const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1, nx = -(s.y2 - s.y1) / L * s.r * o, ny = (s.x2 - s.x1) / L * s.r * o; ctx.beginPath(); ctx.moveTo(s.x1 + nx, s.y1 + ny); ctx.lineTo(s.x2 + nx, s.y2 + ny); ctx.stroke(); } }
    ctx.setLineDash([]);
    if (liq.some(s => s.k === 'lava' || s.k === 'acid')) { ctx.globalCompositeOperation = 'lighter'; for (const s of liq) if (s.k === 'lava' || s.k === 'acid') { const mx = s.t === 's' ? (s.x1 + s.x2) / 2 : s.x, my = s.t === 's' ? (s.y1 + s.y2) / 2 : s.y; glowAt(s.k === 'lava' ? '#ff6a1a' : '#6aff3a', mx, my, s.r * 3, (s.k === 'lava' ? 0.3 : 0.18) + 0.08 * Math.sin(now * 2 + mx)); } ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    // 虚空中的星点 / 沼泽气泡
    for (const s of liq) {
      if (s.k !== 'void' && s.k !== 'bog') continue;
      const L = s.t === 's' ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1) : 0, n = s.t === 's' ? Math.max(2, (L / 60) | 0) : 4;
      for (let i = 0; i < n; i++) {
        const h = U.hash(i, (s.x1 || s.x) | 0, 31), q = (i + 0.5) / n, off = (U.hash(i, (s.y1 || s.y) | 0, 32) - 0.5) * s.r * 1.2;
        let x, y;
        if (s.t === 's') { const nx = -(s.y2 - s.y1) / L, ny = (s.x2 - s.x1) / L; x = s.x1 + (s.x2 - s.x1) * q + nx * off; y = s.y1 + (s.y2 - s.y1) * q + ny * off; }
        else { const a = h * TAU; x = s.x + Math.cos(a) * s.r * 0.5 * q; y = s.y + Math.sin(a) * s.r * 0.5 * q; }
        if (s.k === 'void') { ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(now * 2 + h * 9)); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x - 1, y - 1, 2.4, 2.4); }
        else { const ph = (now * 0.6 + h) % 1; ctx.globalAlpha = (1 - ph) * 0.7; ctx.strokeStyle = 'rgba(190,230,140,.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 2 + ph * 6, 0, TAU); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
    }
    // 桥
    for (const b of mp.bridges) {
      if (!vis(b.x, b.y, b.w)) continue;
      const g = b.len / 2, w = b.w / 2;
      const cA = { water: ['#9a6a3a', '#6a4422'], lava: ['#6a5a5a', '#3a2e30'], bog: ['#7a5a34', '#4a3420'], acid: ['#6a707e', '#2e323c'], void: ['#f0ece4', '#b0a890'] }[b.k] || ['#d8f0ff', '#8ab8dc'];
      ctx.setTransform(Math.cos(b.ang) * K, Math.sin(b.ang) * K, -Math.sin(b.ang) * K, Math.cos(b.ang) * K, TX + K * b.x, TY + K * b.y);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-g + 6, -w + 6, g * 2 - 12, w * 2);
      ctx.fillStyle = cA[0]; ctx.fillRect(-g + 8, -w, g * 2 - 16, w * 2);
      ctx.strokeStyle = cA[1]; ctx.lineWidth = 2;
      for (let yy = -w + 10; yy < w; yy += 12) { ctx.beginPath(); ctx.moveTo(-g + 8, yy); ctx.lineTo(g - 8, yy); ctx.stroke(); }
      ctx.fillStyle = cA[1]; ctx.fillRect(-g + 2, -w - 4, 10, w * 2 + 8); ctx.fillRect(g - 12, -w - 4, 10, w * 2 + 8);
      ctx.setTransform(K, 0, 0, K, TX, TY);
    }
  }

  if (PROF) prof('特殊区域');
  // 特殊区域
  for (const z of mp.zones) {
    if (!vis(z.x, z.y, z.r + 40)) continue;
    const pulse = 0.5 + 0.5 * Math.sin(now * 3 + z.x);
    if (z.k === 'spring') {
      const s2 = z.r * 2.3; ctx.drawImage(Sp.mobj('spring'), z.x - s2 / 2, z.y - s2 / 2, s2, s2);
      ctx.globalCompositeOperation = 'lighter'; glowAt('#7fe8ff', z.x, z.y, z.r * 1.3, 0.25 + 0.15 * pulse);
      if (((now * 2 + z.x) % 1) < 0.05 && V.room(0.6)) V.p('star', z.x + U.rand(-z.r, z.r) * 0.6, z.y + U.rand(-z.r, z.r) * 0.5, 0, -30, 0.6, 7, '#bff8ff');
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (z.k === 'might' || z.k === 'haste') {
      const col = z.k === 'might' ? '#ff4a5a' : '#3affd0';
      ctx.globalCompositeOperation = 'lighter'; glowAt(col, z.x, z.y, z.r * 1.4, 0.25 + 0.2 * pulse);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.65 + 0.3 * pulse; rotDraw(Sp.rune(col), z.x, z.y, now * (z.k === 'might' ? 0.6 : -1.2), z.r * 2.1, z.r * 2.1);
      ctx.globalAlpha = 0.9; ctx.drawImage(Sp.star(col), z.x - 14, z.y - 30 + Math.sin(now * 3) * 4, 28, 28); ctx.globalAlpha = 1;
    } else if (z.k === 'shrine') {
      const ready = z.cd <= 0;
      ctx.globalAlpha = ready ? 0.8 : 0.3; rotDraw(Sp.rune('#ffd86a'), z.x, z.y + 6, now * 0.4, z.r * 2.4, z.r * 2.4); ctx.globalAlpha = 1;
      const b2 = Sp.MOBOX.altar; ctx.drawImage(Sp.mobj('altar'), z.x - b2[2], z.y - b2[3] + 10, b2[0], b2[1]);
      if (ready) { ctx.globalCompositeOperation = 'lighter'; glowAt('#ffd24a', z.x, z.y - 44 + Math.sin(now * 2) * 4, 24, 0.8); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(Sp.gem(2), z.x - 9, z.y - 56 + Math.sin(now * 2) * 4, 18, 22); }
      if (z.p > 0) { ctx.strokeStyle = '#ffd86a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, z.p / 3)); ctx.stroke(); }
    } else if (z.k === 'swamp' || z.k === 'sand' || z.k === 'frost' || z.k === 'pool' || z.k === 'toxic') {
      const col = { swamp: '#4a5a24', sand: '#c49a52', frost: '#d8f2ff', pool: '#ff5a1a', toxic: '#5ad82a' }[z.k];
      ctx.globalAlpha = 0.9; ctx.drawImage(Sp.pool(col), z.x - z.r * 1.08, z.y - z.r * 1.08, z.r * 2.16, z.r * 2.16); ctx.globalAlpha = 1;
      if (z.k === 'sand') { ctx.strokeStyle = 'rgba(120,80,30,.45)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (0.25 + i * 0.22), now * (1 + i * 0.3), now * (1 + i * 0.3) + 4); ctx.stroke(); } }
      else if (z.k === 'pool' || z.k === 'toxic') { ctx.globalCompositeOperation = 'lighter'; glowAt(z.k === 'pool' ? '#ff7a2a' : '#7aff3a', z.x, z.y, z.r * 1.4, (z.k === 'pool' ? 0.35 : 0.22) + 0.15 * pulse); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      if (z.k !== 'sand') { ctx.strokeStyle = z.k === 'frost' ? 'rgba(255,255,255,.8)' : z.k === 'pool' ? '#ffe08a' : z.k === 'toxic' ? '#d8ff8a' : 'rgba(170,190,110,.8)'; ctx.lineWidth = 1.6; for (let i = 0; i < 5; i++) { const ph = (now * 0.8 + i * 0.37) % 1, an = i * 2.4 + z.x, rr = z.r * 0.6 * ((i * 0.31 + 0.2) % 1); ctx.globalAlpha = (1 - ph) * 0.8; ctx.beginPath(); ctx.arc(z.x + Math.cos(an) * rr, z.y + Math.sin(an) * rr, 1.5 + ph * 5, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
    } else if (z.k === 'storm') {
      ctx.globalAlpha = 0.28 + (z.warn ? 0.25 * pulse : 0); ctx.fillStyle = '#1a2a50'; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r * 1.15, z.r * 0.9, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = z.warn ? 0.5 + 0.45 * Math.abs(Math.sin(now * 14)) : 0.35; rotDraw(Sp.rune(z.warn ? '#ffe84a' : '#8ab8ff'), z.x, z.y, now * 0.8, (z.r + 30) * 2.1, (z.r + 30) * 2.1); ctx.globalAlpha = 1;
      if (Math.random() < 0.04 && V.room(0.6)) V.p('spark', z.x + U.rand(-z.r, z.r) * 0.7, z.y + U.rand(-z.r, z.r) * 0.5, 0, -40, 0.4, 3, '#ffe84a');
    } else if (z.k === 'vent') {
      const s2 = z.r * 2; ctx.drawImage(Sp.mobj('crater'), z.x - s2 / 2, z.y - s2 / 2, s2, s2);
      ctx.globalCompositeOperation = 'lighter'; glowAt('#ff6a1a', z.x, z.y, z.r * (0.8 + (z.warn ? 0.6 * pulse : 0.15)), z.warn ? 0.8 : 0.35); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      if (z.warn) { ctx.globalAlpha = 0.5 + 0.45 * Math.abs(Math.sin(now * 14)); rotDraw(Sp.rune('#ff3a2a'), z.x, z.y, now * 2, (z.r + 30) * 2.1, (z.r + 30) * 2.1); ctx.globalAlpha = 1; }
      if (Math.random() < 0.08 && V.room(0.6)) V.p('ember', z.x + U.rand(-12, 12), z.y, U.rand(-20, 20), U.rand(-90, -50), 0.9, 4, '#ffb44a', { drag: 0.5 });
    }
  }
  for (const z of mp.zones) {
    if (!vis(z.x, z.y, 90)) continue;
    if (z.k === 'boost') {
      ctx.setTransform(Math.cos(z.ang) * K, Math.sin(z.ang) * K, -Math.sin(z.ang) * K, Math.cos(z.ang) * K, TX + K * z.x, TY + K * z.y);
      ctx.fillStyle = 'rgba(20,30,50,.8)'; ctx.beginPath(); ctx.roundRect(-34, -22, 68, 44, 10); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#7affff'; ctx.stroke();
      for (let i = 0; i < 3; i++) { const o = ((now * 1.6 + i / 3) % 1) * 44 - 22; ctx.globalAlpha = 1 - Math.abs(o) / 30; ctx.strokeStyle = '#bff8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(o - 8, -12); ctx.lineTo(o + 4, 0); ctx.lineTo(o - 8, 12); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.setTransform(K, 0, 0, K, TX, TY);
    } else if (z.k === 'spikes') {
      ctx.fillStyle = '#4a4a54'; ctx.fillRect(z.x - 40, z.y - 34, 80, 68); ctx.strokeStyle = '#1a1a24'; ctx.lineWidth = 2; ctx.strokeRect(z.x - 40, z.y - 34, 80, 68);
      if (z.warn && ((now * 10) | 0) % 2) { ctx.fillStyle = 'rgba(255,40,40,.35)'; ctx.fillRect(z.x - 40, z.y - 34, 80, 68); }
      for (let yy = -24; yy <= 24; yy += 16) for (let xx = -30; xx <= 30; xx += 15) {
        const h = z.up ? 13 : z.warn ? 4 : 1.5;
        ctx.fillStyle = z.up ? '#e8eef8' : '#2a2a34'; ctx.beginPath(); ctx.moveTo(z.x + xx - 4, z.y + yy + 3); ctx.lineTo(z.x + xx, z.y + yy + 3 - h); ctx.lineTo(z.x + xx + 4, z.y + yy + 3); ctx.fill();
      }
    } else if (z.k === 'tesla' || z.k === 'obelisk' || z.k === 'curse') {
      const nm = z.k === 'curse' ? 'cursealtar' : z.k, b2 = Sp.MOBOX[nm], ready = !(z.cd > 0), col = z.k === 'tesla' ? '#9fd8ff' : z.k === 'obelisk' ? '#7fd8ff' : '#c060ff';
      ctx.globalAlpha = ready ? 0.75 : 0.25; rotDraw(Sp.rune(col), z.x, z.y + 4, now * 0.5, z.r * 2.2, z.r * 2.2); ctx.globalAlpha = 1;
      if (!ready) ctx.globalAlpha = 0.6;
      ctx.drawImage(Sp.mobj(nm), z.x - b2[2], z.y - b2[3] + 14, b2[0], b2[1]);
      ctx.globalAlpha = 1;
      if (z.on > 0 || (ready && z.k !== 'tesla')) { ctx.globalCompositeOperation = 'lighter'; glowAt(col, z.x, z.y - (z.k === 'curse' ? 30 : 56), 26 + 4 * Math.sin(now * 6), z.on > 0 ? 0.9 : 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      if (z.p > 0) { ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, z.p / (z.k === 'tesla' ? 1.2 : z.k === 'obelisk' ? 2 : 1.5))); ctx.stroke(); }
    }
  }
  // 挑战：坚守区域
  if (G.hold) {
    const hz = G.hold;
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#5aff8a'; ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9; rotDraw(Sp.rune('#5aff8a'), hz.x, hz.y, now * 0.8, hz.r * 2.1, hz.r * 2.1); ctx.globalAlpha = 1;
  }
  for (const pt of mp.portals) {
    if (!vis(pt.x, pt.y, 70)) continue;
    const s2 = pt.r * 3; ctx.drawImage(Sp.mobj('portal'), pt.x - s2 / 2, pt.y - s2 / 2, s2, s2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#d0a0ff'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.6 * FXA; ctx.beginPath(); ctx.ellipse(pt.x, pt.y, pt.r * (0.4 + i * 0.25), pt.r * (0.34 + i * 0.21), 0, now * (2 + i) + i, now * (2 + i) + i + 3.6); ctx.stroke(); }
    glowAt('#a86aff', pt.x, pt.y, pt.r * 1.7, 0.45);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  for (const pd of mp.pads) {
    if (!vis(pd.x, pd.y, 50) || (G.mapw || []).some(m => Math.hypot(m.x - pd.x, m.y - pd.y) < 40)) continue;
    ctx.drawImage(Sp.mobj('pad'), pd.x - 34, pd.y - 30, 68, 68);
  }

  if (PROF) prof('地面贴花');
  // 地面贴花
  for (const d of G.decals) {
    if (!vis(d.x, d.y, d.r)) continue;
    const base = d.k === 'splat' ? 0.5 : d.k === 'scorch' ? 0.5 : 0.6;
    ctx.globalAlpha = base * Math.min(1, d.life / 1.2);
    rotDraw(Sp.decal(d.k, d.col), d.x, d.y, d.rot, d.r * 2, d.r * 2);
  }
  ctx.globalAlpha = 1;

  // 障碍物（地形实体）：在玩家前方的先画，后方的在实体之后画，形成遮挡
  const OBS = { tree: ['meadow', 0, 26], rock: ['meadow', 2, 20], drock: ['desert', 3, 20], pillar: ['desert', 1, 11], cactus: ['desert', 0, 13], crystal: ['frost', 1, 18], pine: ['frost', 0, 21], snowrock: ['frost', 2, 20], spire: ['lava', 0, 16], deadtree: ['lava', 2, 9],
    mangrove: ['swamp', 0, 26], shroom: ['swamp', 1, 20], stump: ['swamp', 2, 15], reeds: ['swamp', 3, 13], car: ['city', 0, 20], lamp: ['city', 1, 6], hydrant: ['city', 2, 14], junk: ['city', 3, 18],
    column: ['sky', 0, 11], ctree: ['sky', 1, 20], statue: ['sky', 2, 15], cloudbush: ['sky', 3, 17] };
  const WALL = { ruin: ['#a4a498', '#6e6e64', 24], sand: ['#e2c68c', '#b0925a', 26], ice: ['#d6f0ff', '#8ab8dc', 22], basalt: ['#4e3e46', '#2a1e24', 26], cliff: ['#b08654', '#6a4a2a', 40],
    rotwood: ['#7a6040', '#4a3a24', 22], building: ['#5a6070', '#343844', 58], building2: ['#6a6070', '#3a3444', 30], marble: ['#f0ece4', '#bab4a8', 26] };
  const sortY = s => s.t === 'r' ? s.y + s.h : s.y;
  const drawSolid = (s, fade) => {
    if (fade) ctx.globalAlpha = 0.45;
    if (s.prop) {
      if (s.dead) { ctx.globalAlpha = 1; return; }
      ctx.drawImage(Sp.mobj(s.k), s.x - 24, s.y - 30, 48, 48);
      if (s.hp < s.max) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(s.x - 14, s.y - 32, 28, 4); ctx.fillStyle = '#ffd24a'; ctx.fillRect(s.x - 14, s.y - 32, 28 * Math.max(0, s.hp / s.max), 4); }
    } else if (s.t === 'c') {
      if (s.k === 'palm') { const b2 = Sp.MOBOX.palm, sc = s.r / 14; ctx.drawImage(Sp.mobj('palm'), s.x - b2[2] * sc, s.y - b2[3] * sc + s.r * 0.3, b2[0] * sc, b2[1] * sc); }
      else { const o = OBS[s.k] || OBS.rock, sc = s.r / o[2]; ctx.drawImage(Sp.deco(o[0], o[1]), s.x - 50 * sc, s.y - 80 * sc + s.r * 0.3, 100 * sc, 100 * sc); if (s.k === 'crystal') { ctx.globalCompositeOperation = 'lighter'; glowAt('#7fd8ff', s.x, s.y - s.r, s.r * 1.6, 0.25); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade ? 0.45 : 1; } }
    } else if (s.t === 'r') {
      const c = WALL[s.k] || WALL.ruin, Hh = c[2];
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(s.x + 4, s.y + s.h - 2, s.w, 10);
      ctx.fillStyle = c[1]; ctx.fillRect(s.x, s.y + s.h - Hh, s.w, Hh);
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
      for (let xx = s.x + 18; xx < s.x + s.w; xx += 22) { ctx.beginPath(); ctx.moveTo(xx, s.y + s.h - Hh); ctx.lineTo(xx, s.y + s.h); ctx.stroke(); }
      ctx.fillStyle = c[0]; ctx.fillRect(s.x, s.y - Hh, s.w, s.h);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(s.x, s.y - Hh, s.w, 4);
      ctx.strokeStyle = 'rgba(18,10,30,.85)'; ctx.lineWidth = 2; ctx.strokeRect(s.x, s.y - Hh, s.w, s.h + Hh);
      ctx.beginPath(); ctx.moveTo(s.x, s.y + s.h - Hh); ctx.lineTo(s.x + s.w, s.y + s.h - Hh); ctx.stroke();
      if (s.k === 'building') { // 窗户 + 屋顶设备
        const fy = s.y + s.h - Hh + 8;
        for (let yy = fy; yy < s.y + s.h - 8; yy += 16) for (let xx = s.x + 8; xx < s.x + s.w - 12; xx += 18) { const h = U.hash(xx | 0, yy | 0, 41); ctx.fillStyle = h < 0.28 ? '#ffe08a' : h < 0.36 ? '#7affff' : '#1e2230'; ctx.fillRect(xx, yy, 10, 9); }
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(s.x + 8, s.y - Hh + 8, s.w - 16, s.h - 16);
        const n = Math.max(1, (s.w / 90) | 0);
        for (let i = 0; i < n; i++) { const ax = s.x + 18 + i * (s.w - 50) / Math.max(1, n - 1 || 1), ay = s.y - Hh + 14 + U.hash(i, s.x | 0, 43) * (s.h - 50); ctx.fillStyle = '#8a90a0'; ctx.fillRect(ax, ay, 26, 18); ctx.strokeStyle = '#2a2e38'; ctx.lineWidth = 1.5; ctx.strokeRect(ax, ay, 26, 18); ctx.beginPath(); ctx.arc(ax + 13, ay + 9, 6, 0, TAU); ctx.stroke(); }
        if (U.hash(s.x | 0, s.y | 0, 44) < 0.5) { const nx = s.x + s.w * 0.2, ny = s.y + s.h - Hh - 2; ctx.fillStyle = '#1a1a2a'; ctx.fillRect(nx, ny - 14, s.w * 0.45, 12); ctx.strokeStyle = U.hash(s.x | 0, 1, 45) < 0.5 ? '#ff6ad8' : '#4affff'; ctx.lineWidth = 2; ctx.strokeRect(nx + 2, ny - 12, s.w * 0.45 - 4, 8); }
      } else if (s.k === 'marble') { ctx.strokeStyle = 'rgba(160,150,130,.5)'; ctx.lineWidth = 1.2; for (let xx = s.x + 12; xx < s.x + s.w; xx += 24) { ctx.beginPath(); ctx.moveTo(xx, s.y + s.h - Hh); ctx.lineTo(xx, s.y + s.h); ctx.stroke(); } ctx.fillStyle = '#d8c070'; ctx.fillRect(s.x, s.y - Hh, s.w, 3); }
      else if (s.k === 'rotwood') { ctx.fillStyle = 'rgba(90,130,50,.45)'; for (let xx = s.x + 10; xx < s.x + s.w - 10; xx += 37) ctx.fillRect(xx, s.y - Hh + 2, 14, 5); }
      if (s.k === 'basalt') { ctx.strokeStyle = 'rgba(255,120,40,.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); for (let xx = s.x + 10; xx < s.x + s.w - 10; xx += 46) { ctx.moveTo(xx, s.y - Hh + 6); ctx.lineTo(xx + 10, s.y - Hh + s.h * 0.5); ctx.lineTo(xx + 4, s.y + s.h - Hh - 4); } ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  };
  for (const s of sol) if (sortY(s) < P.y && vis(s.t === 'r' ? s.x + s.w / 2 : s.x, s.t === 'r' ? s.y + s.h / 2 : s.y, 140)) drawSolid(s, false);

  if (PROF) prof('毒池');
  // 地雷与漩涡
  for (const t of G.traps || []) {
    if (!vis(t.x, t.y, 30)) continue;
    ctx.drawImage(Sp.mine(), t.x - 15, t.y - 14, 30, 25);
    if (t.arm <= 0 && ((now * 3 + t.t) % 1) < 0.5) { ctx.globalCompositeOperation = 'lighter'; glowAt('#ff3a3a', t.x, t.y - 3, 8, 0.9); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  }
  for (const v of G.vortex || []) {
    if (!vis(v.x, v.y, v.r * 1.6)) continue;
    const a = Math.min(1, v.t / 0.4, (v.T - v.t) / 0.25 + 0.2), col = v.evo ? '#ff7ad8' : '#b07aff';
    const gr = ctx.createRadialGradient(v.x, v.y, 2, v.x, v.y, v.r);
    gr.addColorStop(0, 'rgba(10,0,20,' + (0.85 * a) + ')'); gr.addColorStop(0.5, 'rgba(60,20,110,' + (0.5 * a) + ')'); gr.addColorStop(1, 'rgba(60,20,110,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.5 * a * FXA; ctx.lineWidth = 4 - i * 0.5; const r2 = v.r * (0.25 + i * 0.17), st = -now * (5 - i * 0.6) + i; ctx.beginPath(); ctx.arc(v.x, v.y, r2, st, st + 3.4); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // 毒池
  for (const z of G.zones) {
    if (!vis(z.x, z.y, z.r)) continue;
    const col = z.evo ? '#9a5aff' : '#5ac83a', lit = z.evo ? '#e0b0ff' : '#c8ff8a';
    const grow = Math.min(1, (z.T - z.t) / 0.18), a = Math.min(1, z.t / 0.45);
    const r = z.r * 1.08 * (0.4 + 0.6 * grow);
    ctx.globalAlpha = a; ctx.drawImage(Sp.pool(col), z.x - r, z.y - r, r * 2, r * 2);
    ctx.strokeStyle = lit; ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const ph = (now * 0.9 + i * 0.37 + z.ph) % 1, ang = z.ph * 7 + i * 2.3, rr = z.r * 0.65 * ((i * 0.29 + 0.2) % 1);
      ctx.globalAlpha = a * (1 - ph) * 0.85;
      ctx.beginPath(); ctx.arc(z.x + Math.cos(ang) * rr, z.y + Math.sin(ang) * rr, 1.5 + ph * 5, 0, TAU); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  if (PROF) prof('地面预警（法阵、冲锋路线）');
  // 地面预警（法阵、冲锋路线）
  for (const f of G.fx) {
    if (f.k === 'meteor' && f.src === 'ult') {
      const a = 1 - f.t / f.T;
      ctx.globalCompositeOperation = 'lighter'; glowAt('#ff6ad8', f.x, f.y, f.r * (0.5 + 0.6 * a), 0.25 + 0.35 * a);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (f.k === 'meteor') {
      const a = 1 - f.t / f.T, col = f.evo ? '#ff4a9a' : '#ff7a2a';
      ctx.globalAlpha = 0.2 * a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * a, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.35 + 0.55 * a;
      rotDraw(Sp.rune(col), f.x, f.y, f.rot + now * 1.6, f.r * 2.15, f.r * 2.15);
    } else if (f.k === 'slam') {
      const a = 1 - f.t / f.T;
      ctx.globalAlpha = 0.15 + 0.25 * a; ctx.fillStyle = '#ff2a3a'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.2 + 0.8 * a), 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5 + 0.45 * Math.abs(Math.sin(now * 14));
      rotDraw(Sp.rune('#ff3a4a'), f.x, f.y, -now * 2, f.r * 2.1, f.r * 2.1);
    }
  }
  ctx.globalAlpha = 1;
  for (const e of G.enemies) {
    if (e.dead || !(e.bst === 'tele' || (e.ai === 'charger' && e.st === 1))) continue;
    const dx = P.x - e.x, dy = P.y - e.y, ang = Math.atan2(dy, dx), wdt = Math.max(16, e.r * 1.7), L = 430;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang);
    ctx.globalAlpha = 0.16 + 0.08 * Math.sin(now * 20); ctx.fillStyle = '#ff2a3a'; ctx.fillRect(0, -wdt / 2, L, wdt);
    ctx.strokeStyle = '#ff6a7a'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      const o = ((now * 1.8 + i / 5) % 1) * L;
      ctx.globalAlpha = 0.8 * (1 - o / L);
      ctx.beginPath(); ctx.moveTo(o - wdt * 0.3, -wdt * 0.35); ctx.lineTo(o, 0); ctx.lineTo(o - wdt * 0.3, wdt * 0.35); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (PROF) prof('拾取物');
  // 拾取物
  const gemCols = ['#4aa8ff', '#3ae07a', '#ff4a6a'];
  ctx.globalCompositeOperation = 'lighter';
  for (const g of G.gems) { if (g.tier && vis(g.x, g.y, 10)) glowAt(gemCols[g.tier], g.x, g.y, 10 + g.tier * 3, 0.32); }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  for (const g of G.gems) {
    if (!vis(g.x, g.y, 10)) continue;
    const bob = Math.sin(now * 5 + g.t) * 1.6, w = 11 + g.tier * 3;
    ctx.drawImage(Sp.gem(g.tier), g.x - w / 2, g.y - w * 0.6 + bob, w, w * 1.2);
    if (((now * 0.8 + g.t * 0.37) % 2.4) < 0.18) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Sp.star('#ffffff'), g.x - 7, g.y - 9 + bob, 14, 14); ctx.globalCompositeOperation = 'source-over'; }
  }
  for (const p of G.picks) {
    if (!vis(p.x, p.y, 30)) continue;
    if (p.k !== 'chest' && p.k !== 'coin' && p.life < 6 && ((now * 6) | 0) % 2) continue;
    const bob = Math.sin(now * 4 + p.t) * 2;
    ctx.drawImage(Sp.shadow(), p.x - 9, p.y + 6, 18, 6);
    if (p.k === 'chest') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5; rotDraw(Sp.rays('#ffd24a'), p.x, p.y - 4, now * 0.6, 90, 90);
      glowAt('#ffd24a', p.x, p.y, 34 + Math.sin(now * 5) * 4, 0.45);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.drawImage(Sp.pickup('chest'), p.x - 20, p.y - 22 + bob, 40, 40);
    } else if (p.k === 'coin') {
      const sx = Math.max(0.18, Math.abs(Math.cos(now * 5 + p.t * 3)));
      ctx.drawImage(Sp.pickup('coin'), p.x - 10 * sx, p.y - 12 + bob, 20 * sx, 20);
    } else {
      const s = p.k === 'heart' ? 22 * (1 + 0.08 * Math.sin(now * 8)) : 22;
      if (p.k === 'heart') { ctx.globalCompositeOperation = 'lighter'; glowAt('#ff4a6a', p.x, p.y, 16, 0.35); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      ctx.drawImage(Sp.pickup(p.k), p.x - s / 2, p.y - s / 2 - 4 + bob, s, s);
    }
  }

  if (PROF) prof('阴影');
  // 地图武器底座
  const MWB = Sp.MWBOX;
  const mwDraw = (name, x, y, ang, sc) => { const b = MWB[name]; rotDraw(Sp.mapw(name), x, y, ang, b[0] * (sc || 1), b[1] * (sc || 1), b[2] / b[0], b[3] / b[1]); };
  for (const mw of G.mapw || []) {
    if (!vis(mw.x, mw.y, 60)) continue;
    if (G.near === mw) {
      const pr = 0.5 + 0.5 * Math.sin(now * 6);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 + 0.35 * pr;
      ctx.drawImage(Sp.ring('#ffd86a'), mw.x - 44, mw.y - 40, 88, 88);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (!mw.mounted) {
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now * 3);
      rotDraw(Sp.rune('#ffd86a'), mw.x, mw.y + 6, now * 0.5, 74, 62);
      ctx.globalAlpha = 1;
    }
    if (mw.kind === 'cannon') mwDraw('cannonBase', mw.x, mw.y, 0);
    else if (mw.kind === 'flamer') mwDraw('flamerBase', mw.x, mw.y, 0);
  }
  // 阴影
  const shd = Sp.shadow(); // 敌人阴影已烘焙进动画帧，这里只画玩家阴影
  ctx.globalAlpha = 0.85; ctx.drawImage(shd, P.x - 18, P.y + 12, 36, 12); ctx.globalAlpha = 1;

  if (PROF) prof('敌人');
  // 敌人
  const drawEnemy = (e) => {
    const m = e.r * 2 + 12;
    if (!vis(e.x, e.y, m)) return;
    const spr = e.spr, fi = ((e.t * spr.fps) | 0) % spr.nf, sz = spr.size * e.sc;
    if (e.elite) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45; rotDraw(Sp.rays('#ffcf3a'), e.x, e.y, now * 0.8 + e.id, e.r * 4.2, e.r * 4.2);
      glowAt('#ffcf3a', e.x, e.y, e.r * 2.2, 0.45);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (e.boss) {
      ctx.globalCompositeOperation = 'lighter';
      glowAt(e.def.c2.length === 7 ? e.def.c2 : '#ff4a4a', e.x, e.y, e.r * (2.2 + 0.15 * Math.sin(now * 3)), 0.3);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    const fc = e.face < 0 ? -1 : 1;
    flipDraw(Sp.frame(spr, fi, 'n'), e.x, e.y, fc, sz, sz, 0.5, 0.5);
    if (e.slowT > 0) { ctx.globalAlpha = 0.8; flipDraw(Sp.frame(spr, fi, 'i'), e.x, e.y, fc, sz, sz, 0.5, 0.5); }
    if (e.flash > 0) { ctx.globalAlpha = Math.min(0.75, e.flash / 0.09 * 0.75); flipDraw(Sp.frame(spr, fi, 'w'), e.x, e.y, fc, sz, sz, 0.5, 0.5); }
    ctx.globalAlpha = 1;
    if (e.bounty) { ctx.textAlign = 'center'; ctx.font = '900 13px system-ui, sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#3a2000'; ctx.strokeText('💰 赏金', e.x, e.y - e.r * 1.6 - 14); ctx.fillStyle = '#ffd24a'; ctx.fillText('💰 赏金', e.x, e.y - e.r * 1.6 - 14); }
    if (e.chal) { ctx.globalAlpha = 0.8; rotDraw(Sp.rune('#ff4a6a'), e.x, e.y + e.r * 0.5, now * 2, e.r * 3.4, e.r * 2.6); ctx.globalAlpha = 1; }
    if (e.elite && !e.boss) {
      const bw = e.r * 1.8, by = e.y - e.r * 1.35 - 8;
      ctx.fillStyle = 'rgba(10,8,20,.75)'; ctx.beginPath(); ctx.roundRect(e.x - bw / 2 - 2, by - 2, bw + 4, 7, 3.5); ctx.fill();
      const gr = ctx.createLinearGradient(0, by, 0, by + 3); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(1, '#e0a020');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(e.x - bw / 2, by, Math.max(0.1, bw * Math.max(0, e.hp / e.maxHp)), 3, 1.5); ctx.fill();
    }
  };
  for (let i = 0; i < G.enemies.length; i++) { const e = G.enemies[i]; if (!e.big) drawEnemy(e); }

  if (PROF) prof('玩家');
  // 玩家
  {
    if (P.inv > 0 && ((now * 14) | 0) % 2) ctx.globalAlpha = 0.45;
    if (G.mount && G.mount.kind === 'tank') ctx.globalAlpha = 0;
    const HB = Sp.HERO_BOX, blink = !P.moving && (P.t % 3.4) < 0.12;
    const fi = P.moving ? ((P.t * 13 / TAU * 8) | 0) % 8 : ((P.t * 2.6 / TAU * 8) | 0) % 8;
    flipDraw(Sp.heroFrame(G.chId, P.moving, fi, blink), P.x, P.y + 3, P.face < 0 ? -1 : 1, HB.w, HB.h, HB.ox / HB.w, HB.oy / HB.h);
    ctx.globalAlpha = 1;
  }
  {
    const bw = 38, by = P.y + 26, f = Math.max(0, P.hp / P.maxHp);
    ctx.fillStyle = 'rgba(10,8,20,.75)'; ctx.beginPath(); ctx.roundRect(P.x - bw / 2 - 2, by - 2, bw + 4, 8, 4); ctx.fill();
    const gr = ctx.createLinearGradient(0, by, 0, by + 4);
    if (f > 0.5) { gr.addColorStop(0, '#9affb0'); gr.addColorStop(1, '#2ec05a'); }
    else if (f > 0.25) { gr.addColorStop(0, '#fff09a'); gr.addColorStop(1, '#e0a020'); }
    else { gr.addColorStop(0, '#ff9aa8'); gr.addColorStop(1, '#e02a44'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(P.x - bw / 2, by, Math.max(0.1, bw * f), 4, 2); ctx.fill();
  }
  for (let i = 0; i < G.bigs.length; i++) drawEnemy(G.bigs[i]);

  // 哨兵炮台（道具）
  for (const t of G.turrets || []) {
    if (!vis(t.x, t.y, 50)) continue;
    mwDraw('cannonBase', t.x, t.y, 0, 0.72);
    mwDraw('cannonBarrel', t.x - Math.cos(t.aim) * (t.recoil || 0) * 4, t.y - 5 - Math.sin(t.aim) * (t.recoil || 0) * 4, t.aim, 0.72);
    const bw = 34; ctx.fillStyle = 'rgba(10,8,20,.7)'; ctx.fillRect(t.x - bw / 2, t.y + 22, bw, 4); ctx.fillStyle = '#5ad0ff'; ctx.fillRect(t.x - bw / 2, t.y + 22, bw * Math.max(0, t.t / t.T), 4);
  }
  // 护盾 / 狂暴光效
  if (G.shieldHp > 0 || G.berserkT > 0) {
    ctx.globalCompositeOperation = 'lighter';
    if (G.berserkT > 0) glowAt('#ff3a2a', P.x, P.y - 4, 34 + 4 * Math.sin(now * 10), 0.55 * FXA + 0.2);
    if (G.shieldHp > 0) {
      const k2 = Math.max(0.25, G.shieldHp / (G.shieldMax || 1));
      ctx.globalAlpha = 0.25 * k2; ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.arc(P.x, P.y - 6, 28, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.85 * k2; ctx.drawImage(Sp.ring('#7fd8ff'), P.x - 31, P.y - 37, 62, 62);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // 障碍物（玩家身后的部分，挡住玩家时半透明）
  for (const s of sol) {
    const sy2 = sortY(s);
    if (sy2 < P.y) continue;
    const cx2 = s.t === 'r' ? s.x + s.w / 2 : s.x;
    if (!vis(cx2, sy2, 160)) continue;
    let fade = false;
    if (s.t === 'c') fade = Math.abs(P.x - s.x) < s.r * 1.6 + 8 && P.y > sy2 - s.r * 3.4;
    else fade = P.x > s.x - 10 && P.x < s.x + s.w + 10 && P.y > s.y - 40;
    drawSolid(s, fade);
  }
  // 地图武器炮管、战车与能量条
  for (const mw of G.mapw || []) {
    if (!vis(mw.x, mw.y, 70)) continue;
    const rc = (mw.recoil || 0) * 6;
    if (mw.kind === 'cannon') mwDraw('cannonBarrel', mw.x - Math.cos(mw.aim) * rc, mw.y - 6 - Math.sin(mw.aim) * rc, mw.aim);
    else if (mw.kind === 'flamer') {
      if (mw.firing) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= 4; i++) glowAt(i % 2 ? '#ff7a2a' : '#ffd24a', mw.x + Math.cos(mw.aim) * (26 + i * 34), mw.y - 8 + Math.sin(mw.aim) * (26 + i * 34), 18 + i * 9, 0.5 - i * 0.07);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      mwDraw('flamerNozzle', mw.x, mw.y - 6, mw.aim);
    } else if (mw.kind === 'tank') {
      mwDraw('tankBody', mw.x, mw.y, mw.ang);
      mwDraw('tankTurret', mw.x - Math.cos(mw.tAng) * rc, mw.y - 4 - Math.sin(mw.tAng) * rc, mw.tAng);
      if (mw.mounted) {
        const HB = Sp.HERO_BOX;
        ctx.save(); ctx.beginPath(); ctx.rect(mw.x - 30, mw.y - 60, 60, 54); ctx.clip();
        flipDraw(Sp.heroFrame(G.chId, false, 0, false), mw.x - 2, mw.y - 6, P.face < 0 ? -1 : 1, HB.w * 0.8, HB.h * 0.8, HB.ox / HB.w, HB.oy / HB.h);
        ctx.restore();
      }
      if (mw.flash > 0) { ctx.globalCompositeOperation = 'lighter'; glowAt('#ffffff', mw.x, mw.y, 44, mw.flash * 5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    }
    if (mw.energy < mw.max || mw.mounted) {
      const bw = 46, by = mw.kind === 'tank' || !mw.mounted ? mw.y - 44 : mw.y + 30;
      ctx.fillStyle = 'rgba(10,8,20,.75)'; ctx.beginPath(); ctx.roundRect(mw.x - bw / 2 - 2, by - 2, bw + 4, mw.maxHp ? 11 : 7, 3); ctx.fill();
      ctx.fillStyle = '#5ad0ff'; ctx.fillRect(mw.x - bw / 2, by, bw * Math.max(0, mw.energy / mw.max), 3);
      if (mw.maxHp) { ctx.fillStyle = '#ff7a5a'; ctx.fillRect(mw.x - bw / 2, by + 4, bw * Math.max(0, mw.hp / mw.maxHp), 3); }
    }
    if (G.near === mw) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 12px system-ui, sans-serif';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(10,6,20,.9)'; ctx.strokeText(SF.MAPW[mw.kind].name, mw.x, mw.y - 52);
      ctx.fillStyle = '#ffd86a'; ctx.fillText(SF.MAPW[mw.kind].name, mw.x, mw.y - 52); ctx.textBaseline = 'alphabetic';
    }
  }

  if (PROF) prof('旋转圣剑');
  // 圣光领域 / 石像守卫 / 无人机
  for (const w of G.weapons) {
    if (w.id === 'aura' && w.rad) {
      const col = w.evo ? '#ffd86a' : '#fff3a0';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.12 + 0.05 * Math.sin(now * 4)) * FXA; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(P.x, P.y, w.rad, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5 * FXA; ctx.drawImage(Sp.ring(col), P.x - w.rad * 1.09, P.y - w.rad * 1.09, w.rad * 2.18, w.rad * 2.18);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35; rotDraw(Sp.rune(w.evo ? '#ffb43a' : '#ffe08a'), P.x, P.y, now * 0.7, w.rad * 1.9, w.rad * 1.9); ctx.globalAlpha = 1;
    } else if (w.id === 'summon' && w.pets) {
      const spr = Sp.enemy(w.evo ? Sp.PET_EVO : Sp.PET), sz = spr.size * w.s.size * (w.evo ? 1.25 : 1);
      for (const pet of w.pets) {
        if (!vis(pet.x, pet.y, 60)) continue;
        const fi = pet.moving ? ((pet.t * spr.fps) | 0) % spr.nf : 0;
        const sq = pet.smash > 0 ? 1 + pet.smash * 1.2 : 1;
        flipDraw(Sp.frame(spr, fi, 'n'), pet.x, pet.y, pet.face, sz * sq, sz / sq, 0.5, 0.5);
      }
    } else if (w.id === 'drone' && w.dr) {
      const img = Sp.drone(w.evo);
      for (const d of w.dr) { ctx.drawImage(Sp.shadow(), d.x - 10, d.y + 30, 20, 6); ctx.drawImage(img, d.x - 16, d.y - 12, 32, 24); }
    }
  }
  // 旋转圣剑
  for (const w of G.weapons) if (w.id === 'orbit' && w.n) {
    const col = w.evo ? '#ffd86a' : '#8fd0ff', dir = Math.sign(w.s.rot) || 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < w.n; i++) {
      const a = w.a + i * TAU / w.n;
      ctx.strokeStyle = col; ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        ctx.globalAlpha = (0.32 - k * 0.07) * FXA; ctx.lineWidth = w.br * (0.75 - k * 0.12);
        ctx.beginPath(); ctx.arc(P.x, P.y, w.rad, a - dir * (0.18 + k * 0.16), a - dir * k * 0.16, dir < 0); ctx.stroke();
      }
      glowAt(col, P.x + Math.cos(a) * w.rad, P.y + Math.sin(a) * w.rad, w.br * 2, 0.4);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const sw = Sp.sword(w.evo);
    for (let i = 0; i < w.n; i++) {
      const a = w.a + i * TAU / w.n;
      rotDraw(sw, P.x + Math.cos(a) * w.rad, P.y + Math.sin(a) * w.rad, a + Math.PI / 2 + dir * 0.35, w.br * 1.6, w.br * 3.2, 0.5, 0.55);
    }
  }

  if (PROF) prof('玩家弹体');
  // 玩家弹体
  for (const p of G.proj) {
    if (!vis(p.x, p.y, 50)) continue;
    if (p.k === 'bolt') {
      const a = Math.atan2(p.vy, p.vx);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.95 * FXA; rotDraw(Sp.comet(p.col), p.x, p.y, a, p.r * 8, p.r * 2.4, 0.9, 0.5);
      glowAt(p.col, p.x, p.y, p.r * 3.4, 0.75);
      ctx.globalAlpha = 1; rotDraw(Sp.star(p.col), p.x, p.y, now * 6, p.r * 3, p.r * 3);
      ctx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.35 && V.room(0.6)) V.p('star', p.x, p.y, U.rand(-20, 20), U.rand(-20, 20), 0.3, U.rand(3, 5), p.col);
    } else if (p.k === 'dart') {
      const a = Math.atan2(p.vy, p.vx);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * FXA;
      rotDraw(Sp.comet(p.col), p.x, p.y, a, 34, 8, 0.92, 0.5);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10); ctx.stroke();
    } else if (p.k === 'disc') {
      ctx.globalCompositeOperation = 'lighter'; glowAt(p.col, p.x, p.y, p.r * 2.6, 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      rotDraw(Sp.disc(p.evo), p.x, p.y, p.rot || 0, p.r * 3, p.r * 3);
    } else if (p.k === 'shell') {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8 * FXA;
      rotDraw(Sp.comet('#ffb44a'), p.x, p.y, Math.atan2(p.vy, p.vx), 46, 16, 0.92, 0.5);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.drawImage(Sp.mapw('shell'), p.x - 12, p.y - 12, 24, 24);
    } else if (p.k === 'axe') {
      const img = Sp.axe(p.evo), s = p.r * 2.7;
      if (p.evo) { ctx.globalCompositeOperation = 'lighter'; glowAt('#5affc0', p.x, p.y, s * 0.9, 0.45); ctx.globalCompositeOperation = 'source-over'; }
      for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.14 * (4 - i); rotDraw(img, p.x, p.y, p.rot - i * 0.42, s, s); }
      ctx.globalAlpha = 1; rotDraw(img, p.x, p.y, p.rot, s, s);
    }
  }
  ctx.globalAlpha = 1;

  if (PROF) prof('敌方弹幕');
  // 敌方弹幕
  ctx.globalCompositeOperation = 'lighter';
  for (const b of G.eproj) {
    if (!vis(b.x, b.y, 20)) continue;
    const c = b.col.length === 7 ? b.col : '#ff6a8a';
    ctx.globalAlpha = 0.55; rotDraw(Sp.comet(c), b.x, b.y, Math.atan2(b.vy, b.vx), b.r * 6, b.r * 2, 0.9, 0.5);
    glowAt(c, b.x, b.y, b.r * 2.8, 0.6);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  for (const b of G.eproj) {
    if (!vis(b.x, b.y, 20)) continue;
    const c = b.col.length === 7 ? b.col : '#ff6a8a', s = b.r * 2.6;
    ctx.drawImage(Sp.orb(c), b.x - s / 2, b.y - s / 2, s, s);
  }

  if (PROF) prof('技能光效');
  // 技能光效
  for (const f of G.fx) {
    if (f.k === 'meteor') {
      const a = f.t / f.T, h = a * a * 380, mx = f.x + h * 0.35, my = f.y - h, ang = Math.atan2(1, -0.35);
      const cA = f.evo ? '#ff4a9a' : '#ff7a2a', cB = f.evo ? '#ffb0f0' : '#ffd24a';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9 * FXA; rotDraw(Sp.comet(cA), mx, my, ang, 150, 42, 0.92, 0.5);
      glowAt(cB, mx, my, 40, 0.8);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const rs = U.clamp(f.r * 0.5, 30, 50);
      rotDraw(Sp.meteorRock(), mx, my, now * 5, rs, rs);
      if (V.room(0.7)) V.p('fire', mx + U.rand(-8, 8), my + U.rand(-8, 8), U.rand(-30, 30) + 40, U.rand(-80, -40), 0.35, U.rand(8, 14), Math.random() < 0.5 ? cA : cB, { drag: 2, grow: -14 });
    } else if (f.k === 'nova') {
      const a = 1 - f.r / f.max, col = f.col || '#8fdcff', rr = Math.max(4, f.r);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.1 * a * FXA; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); ctx.fill();
      ctx.globalAlpha = (0.3 + 0.6 * a) * FXA; ctx.drawImage(Sp.ring(col), f.x - rr * 1.09, f.y - rr * 1.09, rr * 2.18, rr * 2.18);
      ctx.globalCompositeOperation = 'source-over';
      const n = f.evo ? 22 : 16, sh = Sp.shard(col);
      ctx.globalAlpha = 0.4 + 0.6 * a;
      for (let i = 0; i < n; i++) {
        const an = i / n * TAU + (f.id % 7);
        rotDraw(sh, f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr, an + Math.PI / 2, 7, 18 * (0.6 + 0.4 * a));
      }
      ctx.globalAlpha = 1;
    } else if (f.k === 'ring') {
      const a = f.life / f.T, rr = f.r + (f.max - f.r) * (1 - a * a);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.85 * FXA;
      ctx.drawImage(Sp.ring(f.col), f.x - rr * 1.09, f.y - rr * 1.09, rr * 2.18, rr * 2.18);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (f.k === 'beam') {
      const a = f.life / f.T * FXA, wd = f.w * (0.3 + 0.7 * f.life / f.T) * 0.85;
      const cO = f.evo ? '#ffb43a' : '#ffa82a', cM = f.evo ? '#ffe9a0' : '#ffd86a';
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.16 * a; ctx.strokeStyle = cO; ctx.lineWidth = wd * 2.0;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.globalAlpha = 0.55 * a; ctx.strokeStyle = cM; ctx.lineWidth = wd * 0.8;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = wd * 0.28;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.setLineDash([wd * 0.9, wd * 1.8]); ctx.lineDashOffset = -now * 900;
      ctx.globalAlpha = 0.45 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = wd * 0.5;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.setLineDash([]);
      glowAt(cM, f.x0, f.y0, wd * 1.8, f.life / f.T * 0.8);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (f.k === 'bolt') {
      const a = f.life / f.T, pts = f.pts, col = f.col || '#8fd8ff';
      const rnd = lcg((f.seed | 0) + ((now * 28) | 0) * 7919);
      const path = [];
      const branches = [];
      for (let i = 2; i < pts.length; i += 2) {
        const ax = pts[i - 2], ay = pts[i - 1], bx = pts[i], by = pts[i + 1];
        const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, segs = Math.max(3, (d / 22) | 0);
        if (i === 2) path.push(ax, ay);
        for (let s = 1; s < segs; s++) {
          const t = s / segs, o = (rnd() - 0.5) * 20;
          const px = ax + dx * t - dy / d * o, py = ay + dy * t + dx / d * o;
          path.push(px, py);
          if (rnd() < 0.18) { const ba = Math.atan2(dy, dx) + (rnd() - 0.5) * 2.2, bl = 14 + rnd() * 26; branches.push(px, py, px + Math.cos(ba) * bl * 0.5 + (rnd() - 0.5) * 8, py + Math.sin(ba) * bl * 0.5 + (rnd() - 0.5) * 8, px + Math.cos(ba) * bl, py + Math.sin(ba) * bl); }
        }
        path.push(bx, by);
      }
      ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const passes = [[11, 0.22, col], [5, 0.6, col], [1.8, 1, '#ffffff']];
      for (const [lw, al, c] of passes) {
        ctx.globalAlpha = al * a * (c === '#ffffff' ? 1 : FXA); ctx.strokeStyle = c; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(path[0], path[1]); for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]); ctx.stroke();
        ctx.lineWidth = lw * 0.55; ctx.beginPath();
        for (let i = 0; i < branches.length; i += 6) { ctx.moveTo(branches[i], branches[i + 1]); ctx.lineTo(branches[i + 2], branches[i + 3]); ctx.lineTo(branches[i + 4], branches[i + 5]); }
        ctx.stroke();
      }
      for (let i = 2; i < pts.length; i += 2) glowAt(col, pts[i], pts[i + 1], 18, 0.7 * a);
      glowAt('#ffffff', pts[0], pts[1], 14, 0.6 * a);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (f.k === 'laser') {
      const a = f.life / f.T;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.45 * a * FXA; ctx.strokeStyle = f.col; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      glowAt(f.col, f.x1, f.y1, 10, a);
      ctx.globalAlpha = 1;
    } else if (f.k === 'ghost') {
      const HB = Sp.HERO_BOX, fi = ((f.t * 13 / TAU * 8) | 0) % 8;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.4 * f.life / f.T;
      flipDraw(Sp.heroFrame(G.chId, true, fi, false), f.x, f.y + 3, f.face < 0 ? -1 : 1, HB.w, HB.h, HB.ox / HB.w, HB.oy / HB.h);
      ctx.globalCompositeOperation = 'lighter'; glowAt('#7fd8ff', f.x, f.y - 6, 22, 0.35 * f.life / f.T);
      ctx.globalAlpha = 1;
    } else if (f.k === 'pillar') {
      const a = f.life / f.T, wd = 46 * (0.3 + 0.7 * a);
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, f.y + 10, 0, f.y - 260);
      gr.addColorStop(0, 'rgba(255,220,120,' + (0.8 * a * FXA) + ')'); gr.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(f.x - wd / 2, f.y - 260, wd, 270);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * a * FXA) + ')'; ctx.fillRect(f.x - wd * 0.15, f.y - 260, wd * 0.3, 270);
      glowAt('#ffd86a', f.x, f.y + 6, 50, a * 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  if (PROF) prof('粒子（普通混合）');
  // 粒子（普通混合）
  const ps = G.parts;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.k !== 'dot' && p.k !== 'shard' && p.k !== 'smoke' && p.k !== 'plus') continue;
    if (!vis(p.x, p.y, p.sz * 2)) continue;
    const lr = Math.max(0, p.life / p.max);
    if (p.k === 'dot') { ctx.globalAlpha = Math.min(1, lr * 1.5); ctx.fillStyle = p.col; const d = p.sz * 1.1; ctx.fillRect(p.x - d / 2, p.y - d / 2, d, d); }
    else if (p.k === 'shard') { ctx.globalAlpha = Math.min(1, lr * 1.6); rotDraw(Sp.tri(p.col), p.x, p.y, p.rot, p.sz * 2, p.sz * 2); } else if (p.k === 'smoke') { ctx.globalAlpha = (p.a || 0.4) * lr; const s = p.sz; ctx.drawImage(Sp.glow(p.col), p.x - s, p.y - s, s * 2, s * 2); }
    else { ctx.globalAlpha = lr; ctx.fillStyle = p.col; const s = p.sz; ctx.fillRect(p.x - s, p.y - s * 0.3, s * 2, s * 0.6); ctx.fillRect(p.x - s * 0.3, p.y - s, s * 0.6, s * 2); }
  }
  if (PROF) prof('粒子（叠加发光）');
  // 粒子（叠加发光）
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.k === 'dot' || p.k === 'shard' || p.k === 'smoke' || p.k === 'plus') continue;
    if (!vis(p.x, p.y, p.sz * 3)) continue;
    const lr = Math.max(0, p.life / p.max);
    if (p.k === 'spark') {
      const sp = Math.hypot(p.vx, p.vy) || 1, len = U.clamp(sp * 0.04, 2, 20);
      ctx.globalAlpha = lr * FXA; ctx.strokeStyle = p.col; ctx.lineWidth = p.sz; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / sp * len, p.y - p.vy / sp * len); ctx.stroke();
    } else if (p.k === 'glow') { const s = p.sz * (0.5 + 0.5 * lr); glowAt(p.col, p.x, p.y, s, lr * (p.a || 1)); }
    else if (p.k === 'fire') { const s = p.sz * (0.4 + 0.6 * lr); glowAt(p.col, p.x, p.y, s, Math.min(1, lr * 1.4)); }
    else if (p.k === 'star') { const s = p.sz * (0.7 + 0.3 * Math.sin(now * 20 + i)); ctx.globalAlpha = lr * FXA; rotDraw(Sp.star(p.col), p.x, p.y, now * 3 + i, s * 2, s * 2); }
    else { glowAt(p.col, p.x, p.y, p.sz, lr); }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  if (PROF) prof('伤害数字');
  // 伤害数字
  if (G.texts.length) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const t of G.texts) {
      const age = t.max - t.life, pop = age < 0.12 ? 1 + (0.12 - age) / 0.12 * 0.7 : 1;
      const sz = (t.big ? 18 : 13) * pop;
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2.2);
      const txt = String(t.txt);
      if (/^[-+]?\d+$/.test(txt)) {
        const st = t.col === '#ffd24a' ? (t.big ? 'c' : 'y') : t.col === '#ff6a7a' ? 'r' : t.col === '#7aff9a' ? 'g' : 'n';
        drawNum(txt, t.x, t.y, sz * 1.25, st);
      } else {
        ctx.font = '900 ' + sz.toFixed(1) + 'px system-ui, sans-serif';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,6,20,.85)'; ctx.strokeText(txt, t.x, t.y);
        ctx.fillStyle = t.col; ctx.fillText(txt, t.x, t.y);
      }
    }
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  }

  if (PROF) prof('氛围粒子');
  // 氛围粒子
  ambient(rdt, cx, cy, hw, hh);

  if (PROF) prof('光照叠加（暗角');
  // 光照叠加（暗角 + 色调）
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(Sp.overlay(kind, cv.width, cv.height), 0, 0, cv.width, cv.height);

  if (PROF) prof('屏幕白闪');
  // 大招与狂潮的屏幕色调
  if (G.sk && G.sk.ultT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16 + 0.06 * Math.sin(now * 12); ctx.fillStyle = '#a03aff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  else if (G.frenzy) { const k2 = 0.06 + 0.04 * Math.sin(now * 2.5); const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height / 2, Math.hypot(cv.width, cv.height) * 0.55); vg.addColorStop(0, 'rgba(255,0,30,0)'); vg.addColorStop(1, 'rgba(255,20,40,' + (k2 * 3).toFixed(3) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (G.freezeT > 0) { ctx.globalAlpha = Math.min(0.16, G.freezeT * 0.12); ctx.fillStyle = '#8fd8ff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1; }
  // 屏幕外地图武器指示
  if (G.mapw) {
    const mg = 34 * dpr;
    for (const mw of G.mapw) {
      if (mw.mounted) continue;
      const sx = TX + K * mw.x, sy = TY + K * mw.y;
      if (sx > mg && sx < cv.width - mg && sy > mg * 3 && sy < cv.height - mg) continue;
      const cxs = cv.width / 2, cys = cv.height / 2, dx = sx - cxs, dy = sy - cys;
      const t2 = Math.min((cv.width / 2 - mg) / Math.abs(dx || 1e-3), (cv.height / 2 - mg * 2) / Math.abs(dy || 1e-3));
      const ex = cxs + dx * t2, ey = cys + dy * t2, ang = Math.atan2(dy, dx), R2 = 20 * dpr;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(16,14,30,.8)'; ctx.beginPath(); ctx.arc(ex, ey, R2, 0, TAU); ctx.fill();
      ctx.lineWidth = 2.5 * dpr; ctx.strokeStyle = '#ffd86a'; ctx.stroke();
      ctx.fillStyle = '#ffd86a'; ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ang) * (R2 + 9 * dpr), ey + Math.sin(ang) * (R2 + 9 * dpr));
      ctx.lineTo(ex + Math.cos(ang + 0.5) * (R2 + 1), ey + Math.sin(ang + 0.5) * (R2 + 1));
      ctx.lineTo(ex + Math.cos(ang - 0.5) * (R2 + 1), ey + Math.sin(ang - 0.5) * (R2 + 1)); ctx.fill();
      const nm = mw.kind === 'tank' ? 'tankBody' : mw.kind + 'Base', bb = MWB[nm];
      ctx.drawImage(Sp.mapw(nm), ex - R2 * 0.8, ey - R2 * 0.8 * bb[1] / bb[0], R2 * 1.6, R2 * 1.6 * bb[1] / bb[0]);
      ctx.globalAlpha = 1;
    }
  }
  // 屏幕白闪
  if (G.flash > 0) { ctx.globalAlpha = Math.min(0.7, G.flash); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1; }
  if (PROF) prof('end');
};
})(window.SF = window.SF || {});
