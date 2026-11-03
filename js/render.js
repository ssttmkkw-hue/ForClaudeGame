/* 画布渲染：地面、贴花、装饰、实体、技能特效、粒子、氛围光照 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU, Sp = SF.Sprites, G = SF.G, V = SF.VFX;
const R = SF.Render = {};
let cv, ctx, W = 0, H = 0, dpr = 1, scale = 1, lastNow = 0;
const CHUNK = 260;
const amb = []; let ambStage = null;
const FLY = { bat: 1, ghost: 1, lich: 1 };

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
R.reset = function () {
  ambStage = null;
  Sp.clear();
  if (G.enemies) for (const e of G.enemies) e.spr = Sp.enemy(e.def);
  R.resize();
};

let FXA = 1; // 叠加发光强度（亮色地图降低，避免过曝）
const FXA_STAGE = { meadow: 0.7, desert: 0.62, frost: 0.48, lava: 0.95 };
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
  const N = { meadow: 22, desert: 32, frost: 60, lava: 30 }[kind] || 26;
  if (ambStage !== kind) {
    amb.length = 0; ambStage = kind;
    for (let i = 0; i < N; i++) amb.push({ x: cx + U.rand(-hw, hw), y: cy + U.rand(-hh, hh), ph: Math.random() * TAU, s: Math.random() });
  }
  const now = lastNow;
  const addOn = kind === 'meadow' || kind === 'lava';
  ctx.globalCompositeOperation = addOn ? 'lighter' : 'source-over';
  for (const a of amb) {
    if (kind === 'meadow') { a.x += Math.cos(now * 0.6 + a.ph) * 18 * dt; a.y += Math.sin(now * 0.8 + a.ph * 1.3) * 14 * dt - 4 * dt; }
    else if (kind === 'desert') { a.x += (70 + a.s * 60) * dt; a.y += Math.sin(now * 2 + a.ph) * 10 * dt; }
    else if (kind === 'frost') { a.x += (Math.sin(now * 1.2 + a.ph) * 22 - 10) * dt; a.y += (35 + a.s * 45) * dt; }
    else { a.y -= (30 + a.s * 50) * dt; a.x += Math.sin(now * 2 + a.ph) * 16 * dt; }
    const mx = hw + 40, my = hh + 40;
    if (a.x < cx - mx) a.x += mx * 2; else if (a.x > cx + mx) a.x -= mx * 2;
    if (a.y < cy - my) a.y += my * 2; else if (a.y > cy + my) a.y -= my * 2;
    if (kind === 'meadow') { const k = 0.5 + 0.5 * Math.sin(now * 3 + a.ph * 3); glowAt(a.s > 0.5 ? '#e8ff8a' : '#fff6b0', a.x, a.y, 5 + a.s * 4, 0.35 + 0.55 * k); }
    else if (kind === 'desert') { ctx.globalAlpha = 0.25 + a.s * 0.3; ctx.fillStyle = '#fff2d0'; ctx.fillRect(a.x, a.y, 2 + a.s * 2, 1.2); if (a.s > 0.75) { ctx.globalAlpha = 0.18; ctx.fillRect(a.x - 26, a.y, 22, 1); } }
    else if (kind === 'frost') { ctx.globalAlpha = 0.55 + a.s * 0.4; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(a.x, a.y, 1 + a.s * 2.2, 0, TAU); ctx.fill(); }
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
  const cx = P.x + shx, cy = P.y + shy;
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  K = k; TX = cv.width / 2 - cx * k; TY = cv.height / 2 - cy * k;
  ctx.setTransform(K, 0, 0, K, TX, TY);
  const x0 = cx - hw - 20, y0 = cy - hh - 20, x1 = cx + hw + 20, y1 = cy + hh + 20;
  const vis = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
  const kind = G.stage.deco;
  FXA = FXA_STAGE[kind] || 0.8;

  if (PROF) prof('地面');
  // 地面
  {
    const tile = Sp.ground(G.stage), TS = Sp.TILE;
    const gx0 = Math.floor(x0 / TS), gx1 = Math.floor(x1 / TS), gy0 = Math.floor(y0 / TS), gy1 = Math.floor(y1 / TS);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) ctx.drawImage(tile, gx * TS - 0.5, gy * TS - 0.5, TS + 1, TS + 1);
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

  if (PROF) prof('散布小装饰');
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
  if (PROF) prof('场景装饰');
  // 场景装饰
  const nDeco = Sp.decoCount(kind);
  const c0x = Math.floor((x0 - 60) / CHUNK), c1x = Math.floor((x1 + 60) / CHUNK);
  const c0y = Math.floor((y0 - 30) / CHUNK), c1y = Math.floor((y1 + 90) / CHUNK);
  for (let gy = c0y; gy <= c1y; gy++) for (let gx = c0x; gx <= c1x; gx++) {
    if (U.hash(gx, gy, 1) > 0.55) continue;
    const dx = gx * CHUNK + 30 + U.hash(gx, gy, 2) * (CHUNK - 60), dy = gy * CHUNK + 30 + U.hash(gx, gy, 3) * (CHUNK - 60);
    const vi = Math.min(nDeco - 1, (U.hash(gx, gy, 4) * nDeco) | 0);
    ctx.drawImage(Sp.deco(kind, vi), dx - 50, dy - 80, 100, 100);
    if (kind === 'lava' && vi === 1) { ctx.globalCompositeOperation = 'lighter'; glowAt('#ff7a2a', dx, dy, 46 + Math.sin(now * 2 + gx) * 6, 0.45); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (kind === 'frost' && vi === 1) { ctx.globalCompositeOperation = 'lighter'; glowAt('#7fd8ff', dx + 4, dy - 18, 30, 0.25 + 0.1 * Math.sin(now * 2 + gy)); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  }

  if (PROF) prof('毒池');
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
    if (f.k === 'meteor') {
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

  if (PROF) prof('旋转圣剑');
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
  // 屏幕白闪
  if (G.flash > 0) { ctx.globalAlpha = Math.min(0.7, G.flash); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1; }
  if (PROF) prof('end');
};
})(window.SF = window.SF || {});
