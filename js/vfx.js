/* 视觉特效：粒子、命中火花、死亡、爆炸、地面贴花 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU;
const V = SF.VFX = {};
const CAP = 560, CAP_DECAL = 36;
const G = () => SF.G;

// k: dot / spark / glow / fire / smoke / shard / star / ember
V.p = function (k, x, y, vx, vy, life, sz, col, o) {
  const ps = G().parts;
  if (ps.length >= CAP) return null;
  const p = { k, x, y, vx, vy, life, max: life, sz, col, g: 0, drag: 3, grow: 0, rot: 0, vr: 0, dead: false };
  if (o) Object.assign(p, o);
  ps.push(p);
  return p;
};
const room = f => G().parts.length < CAP * (f || 1);
V.room = room;

V.burst = function (x, y, col, n, spd, life, size, k) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = (spd || 100) * (0.3 + Math.random() * 0.8);
    if (!V.p(k || 'dot', x, y, Math.cos(a) * s, Math.sin(a) * s, (life || 0.5) * (0.6 + Math.random() * 0.6), (size || 3) * (0.6 + Math.random() * 0.8), col)) return;
  }
};
V.decal = function (k, x, y, r, col, life) {
  const ds = G().decals;
  if (!ds) return;
  if (ds.length >= CAP_DECAL) ds.shift();
  ds.push({ k, x, y, r, col: col || '#000000', life: life || 4, max: life || 4, rot: Math.random() * TAU, dead: false });
};
// 命中火花：dx,dy 为击打方向
V.hit = function (x, y, dx, dy, col) {
  if (!room(0.7)) return;
  let a = (dx || dy) ? Math.atan2(dy, dx) : Math.random() * TAU;
  for (let i = 0; i < 3; i++) {
    const b = a + U.rand(-0.7, 0.7), s = U.rand(160, 300);
    V.p('spark', x, y, Math.cos(b) * s, Math.sin(b) * s, U.rand(0.12, 0.22), U.rand(1.6, 2.6), col || '#fff6c0', { drag: 6 });
  }
  V.p('glow', x, y, 0, 0, 0.08, 12, col || '#fff6c0', { a: 0.5 });
};
V.death = function (e) {
  const c1 = e.def.c1, c2 = e.def.c2, r = e.r, big = r > 20;
  V.p('glow', e.x, e.y, 0, 0, 0.14, r * 1.7, e.def.c2);
  if (!room(0.85)) { V.decal('splat', e.x, e.y + r * 0.4, r * 1.3, c1, 3); return; }
  const n = big ? 12 : 6;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = U.rand(60, 190);
    V.p(i % 3 ? 'dot' : 'shard', e.x, e.y, Math.cos(a) * s, Math.sin(a) * s - 40, U.rand(0.35, 0.6), U.rand(2.5, 4.5) * (big ? 1.4 : 1), i % 2 ? c1 : c2, { g: 260, drag: 2.2, vr: U.rand(-12, 12) });
  }
  V.p('smoke', e.x, e.y, 0, -20, 0.45, r * 0.9, '#ffffff', { grow: r * 1.3, a: 0.3 });
  V.decal('splat', e.x, e.y + r * 0.4, r * 1.2, c1, 2.5);
};
V.explosion = function (x, y, R, cols, o) {
  o = o || {};
  if (SF.Map && SF.Map.hitProps && !o.noProp) SF.Map.hitProps(x, y, R * 0.9, 60);
  const [cA, cB] = cols || ['#ff8a3a', '#ffd24a'];
  V.p('glow', x, y, 0, 0, 0.16, R * 1.3, '#ffffff');
  V.p('glow', x, y, 0, 0, 0.35, R * 2.0, cA);
  const f = room(0.8) ? 1 : 0.35;
  for (let i = 0; i < 14 * f; i++) { const a = Math.random() * TAU, s = U.rand(40, 200) * R / 60; V.p('fire', x + U.rand(-R, R) * 0.3, y + U.rand(-R, R) * 0.3, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.3, 0.6), U.rand(10, 20) * R / 60, i % 2 ? cA : cB, { drag: 4, grow: -10 }); }
  for (let i = 0; i < 4 * f; i++) { const a = Math.random() * TAU, s = U.rand(30, 90); V.p('smoke', x, y, Math.cos(a) * s, Math.sin(a) * s - 20, U.rand(0.5, 0.85), R * 0.4, o.smoke || '#3a3030', { grow: R * 0.6, drag: 2, a: 0.45 }); }
  for (let i = 0; i < 10 * f; i++) { const a = Math.random() * TAU, s = U.rand(220, 420); V.p('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.2, 0.4), U.rand(2, 3), cB, { drag: 4 }); }
  for (let i = 0; i < 5 * f; i++) { const a = Math.random() * TAU, s = U.rand(120, 260); V.p('shard', x, y, Math.cos(a) * s, Math.sin(a) * s - 80, U.rand(0.4, 0.7), U.rand(3, 5), o.debris || '#4a3a34', { g: 500, drag: 1.5, vr: U.rand(-15, 15) }); }
  G().fx.push({ k: 'ring', x, y, r: R * 0.2, max: R * 1.35, life: 0.32, T: 0.32, col: cA });
  if (o.decal !== false) V.decal('scorch', x, y, R * 0.8, null, 4);
};
V.frost = function (x, y, R, col) {
  col = col || '#9fe6ff';
  const f = room(0.75) ? 1 : 0.3;
  for (let i = 0; i < 16 * f; i++) { const a = Math.random() * TAU, s = U.rand(R * 1.2, R * 2.4); V.p('shard', x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.35, 0.55), U.rand(3, 5), i % 2 ? col : '#ffffff', { drag: 3, vr: U.rand(-10, 10) }); }
  for (let i = 0; i < 10 * f; i++) { const a = Math.random() * TAU, rr = Math.random() * R; V.p('star', x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0, -15, U.rand(0.4, 0.8), U.rand(6, 10), col); }
  V.decal('frost', x, y, R * 0.9, null, 2.5);
};
V.sparkLine = function (x0, y0, x1, y1, col, n) {
  if (!room(0.75)) return;
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  for (let i = 0; i < n; i++) {
    const t = Math.random(), s = U.rand(60, 180) * (Math.random() < 0.5 ? -1 : 1);
    V.p(i % 2 ? 'spark' : 'star', x0 + dx * t, y0 + dy * t, nx * s + dx / d * 40, ny * s + dy / d * 40, U.rand(0.2, 0.45), i % 2 ? 2 : U.rand(5, 8), col, { drag: 4 });
  }
};
V.levelUp = function () {
  const P = G().p;
  G().fx.push({ k: 'pillar', x: P.x, y: P.y, life: 1.0, T: 1.0, follow: true });
  G().fx.push({ k: 'ring', x: P.x, y: P.y, r: 10, max: 150, life: 0.6, T: 0.6, col: '#ffd86a', follow: true });
  for (let i = 0; i < 22; i++) { const a = Math.random() * TAU, s = U.rand(40, 160); V.p('star', P.x, P.y - 10, Math.cos(a) * s, Math.sin(a) * s - 60, U.rand(0.5, 1.0), U.rand(6, 11), i % 3 ? '#ffd86a' : '#ffffff', { drag: 2.5 }); }
};
V.heal = function () {
  const P = G().p;
  for (let i = 0; i < 10; i++) V.p('plus', P.x + U.rand(-16, 16), P.y + U.rand(-10, 10), 0, U.rand(-70, -40), U.rand(0.6, 0.9), U.rand(4, 6), '#6aff8a', { drag: 1 });
};
V.sparkle = function (x, y, col, n) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = U.rand(30, 90); V.p('star', x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.3, 0.55), U.rand(5, 8), col); }
};
// 粒子/贴花更新（由 Game.update 调用）
V.update = function (dt) {
  const ps = G().parts;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) { p.dead = true; continue; }
    const f = Math.max(0, 1 - dt * p.drag);
    p.vx *= f; p.vy = p.vy * f + p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.grow) p.sz = Math.max(0.5, p.sz + p.grow * dt);
    if (p.vr) p.rot += p.vr * dt;
  }
  const ds = G().decals;
  for (let i = 0; i < ds.length; i++) { const d = ds[i]; d.life -= dt; if (d.life <= 0) d.dead = true; }
};
})(window.SF = window.SF || {});
