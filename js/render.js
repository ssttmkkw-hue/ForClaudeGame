/* 画布渲染：地面、实体、特效 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU, Sp = SF.Sprites, G = SF.G;
const R = SF.Render = {};
let cv, ctx, W = 0, H = 0, dpr = 1, scale = 1, groundPat = null, patStage = null;
let tex = null; // 全局时间
const CHUNK = 300;

R.init = function (canvas) {
  cv = canvas; ctx = cv.getContext('2d');
  R.resize();
  window.addEventListener('resize', R.resize);
  window.addEventListener('orientationchange', () => setTimeout(R.resize, 200));
  cv.addEventListener('contextlost', e => e.preventDefault());
  cv.addEventListener('contextrestored', R.reset);
};
R.resize = function () {
  W = window.innerWidth; H = window.innerHeight;
  dpr = SF.Save.data.set.hq ? Math.min(2, window.devicePixelRatio || 1) : 1;
  cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  scale = U.clamp(Math.sqrt(W * H) / 540, 0.6, 1.6);
  SF.view.hw = W / scale / 2; SF.view.hh = H / scale / 2;
  groundPat = null;
};
R.onStart = function () { groundPat = null; };
// 画布/贴图被系统回收或绘制出错后的恢复：重建全部缓存
R.reset = function () {
  groundPat = null; patStage = null;
  Sp.clear();
  if (G.enemies) for (const e of G.enemies) e.spr = Sp.enemy(e.def);
  R.resize();
};

function getPattern() {
  if (groundPat && patStage === G.stage.id) return groundPat;
  patStage = G.stage.id;
  groundPat = ctx.createPattern(Sp.ground(G.stage), 'repeat');
  try { groundPat.setTransform(new DOMMatrix([1 / Sp.S, 0, 0, 1 / Sp.S, 0, 0])); } catch (e) { /* 忽略 */ }
  return groundPat;
}
function glowAt(col, x, y, r, a) {
  ctx.globalAlpha = a; const g = Sp.glow(col);
  ctx.drawImage(g, x - r, y - r, r * 2, r * 2);
}

R.draw = function () {
  if (!G.stage || !G.p) return;
  const P = G.p, k = dpr * scale, now = performance.now() / 1000;
  const hw = SF.view.hw, hh = SF.view.hh;
  const shx = G.shake > 0 ? U.rand(-G.shake, G.shake) : 0, shy = G.shake > 0 ? U.rand(-G.shake, G.shake) : 0;
  const cx = P.x + shx, cy = P.y + shy;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = G.stage.ground[0]; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(k, 0, 0, k, cv.width / 2 - cx * k, cv.height / 2 - cy * k);
  const x0 = cx - hw - 20, y0 = cy - hh - 20, x1 = cx + hw + 20, y1 = cy + hh + 20;

  // 地面
  ctx.fillStyle = getPattern();
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // 大型装饰
  const kind = G.stage.deco;
  const c0x = Math.floor((x0 - 40) / CHUNK), c1x = Math.floor((x1 + 40) / CHUNK);
  const c0y = Math.floor((y0 - 60) / CHUNK), c1y = Math.floor((y1 + 60) / CHUNK);
  for (let cy2 = c0y; cy2 <= c1y; cy2++) for (let cx2 = c0x; cx2 <= c1x; cx2++) {
    const h = U.hash(cx2, cy2, 1);
    if (h > 0.62) continue;
    const dx = cx2 * CHUNK + 30 + U.hash(cx2, cy2, 2) * (CHUNK - 60);
    const dy = cy2 * CHUNK + 30 + U.hash(cx2, cy2, 3) * (CHUNK - 60);
    if (Math.abs(dx - P.x) < 30 && Math.abs(dy - P.y) < 30) continue;
    Sp.bigDeco(ctx, kind, dx, dy, U.hash(cx2, cy2, 4));
  }

  // 毒池
  for (const z of G.zones) {
    const f = Math.min(1, z.t / 0.5, (z.T - z.t) / 0.25 + 0.2);
    const gr = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
    gr.addColorStop(0, 'rgba(120,220,70,.45)'); gr.addColorStop(0.85, 'rgba(70,170,50,.4)'); gr.addColorStop(1, 'rgba(70,170,50,0)');
    ctx.globalAlpha = Math.min(1, f);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,255,100,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * 0.92, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 地面特效（预警圈）
  for (const f of G.fx) {
    if (f.k === 'meteor') {
      const a = 1 - f.t / f.T;
      ctx.globalAlpha = 0.25 + a * 0.35;
      ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + a * 0.6), 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.k === 'slam') {
      const a = 1 - f.t / f.T;
      ctx.globalAlpha = 0.18 + a * 0.35;
      ctx.fillStyle = '#ff2a3a'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + a * 0.7), 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ff6a7a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // 拾取物
  for (const g of G.gems) {
    if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue;
    const bob = Math.sin(now * 5 + g.t) * 1.5, sz = 13 + g.tier * 3;
    ctx.drawImage(Sp.gem(g.tier), g.x - sz / 2, g.y - sz / 2 + bob, sz, sz);
  }
  for (const p of G.picks) {
    if (p.x < x0 - 20 || p.x > x1 + 20 || p.y < y0 - 20 || p.y > y1 + 20) continue;
    const bob = Math.sin(now * 4 + p.t) * 2, sz = p.k === 'chest' ? 30 : p.k === 'coin' ? 16 : 20;
    if (p.k === 'chest') { ctx.globalCompositeOperation = 'lighter'; glowAt('#ffd24a', p.x, p.y, 34 + Math.sin(now * 5) * 4, 0.55); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if (p.k !== 'coin' && p.life < 6 && p.life > 0 && ((now * 6) | 0) % 2) continue;
    ctx.drawImage(Sp.pickup(p.k), p.x - sz / 2, p.y - sz / 2 + bob, sz, sz);
  }

  // 敌人
  const drawEnemy = (e) => {
    const m = e.r * 1.8 + 12;
    if (e.x < x0 - m || e.x > x1 + m || e.y < y0 - m || e.y > y1 + m) return;
    const spr = e.spr, sz = spr.size * e.sc;
    if (e.elite) {
      ctx.globalCompositeOperation = 'lighter'; glowAt('#ffcf3a', e.x, e.y, e.r * 2.2, 0.5);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    const sy = 1 + Math.sin(e.t * 9 + e.id) * 0.045;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.scale(e.face, sy);
    if (e.ai === 'ghost' || e.def.shape === 'ghost') ctx.globalAlpha = 0.85;
    ctx.drawImage(spr.n, -sz / 2, -sz / 2, sz, sz);
    if (e.slowT > 0) ctx.drawImage(spr.ice, -sz / 2, -sz / 2, sz, sz);
    if (e.flash > 0) ctx.drawImage(spr.w, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (e.bst === 'tele' || e.st === 1) {
      const a = 0.25 + 0.2 * Math.sin(now * 30);
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
      ctx.globalAlpha = a; ctx.strokeStyle = '#ff3a4a'; ctx.lineWidth = Math.max(10, e.r * 1.2); ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + dx / d * 420, e.y + dy / d * 420); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (e.elite && !e.boss) {
      const bw = e.r * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(e.x - bw / 2 - 1, e.y - e.r - 12, bw + 2, 5);
      ctx.fillStyle = '#ffcf3a'; ctx.fillRect(e.x - bw / 2, e.y - e.r - 11, bw * Math.max(0, e.hp / e.maxHp), 3);
    }
  };
  const P0 = P;
  for (let i = 0; i < G.enemies.length; i++) { const e = G.enemies[i]; if (!e.big) drawEnemy(e); }

  // 玩家（在小怪之上，大怪之下以保持可读性）
  ctx.save();
  ctx.translate(P.x, P.y);
  if (P.inv > 0 && ((now * 14) | 0) % 2) ctx.globalAlpha = 0.45;
  if (P.face < 0) ctx.scale(-1, 1);
  ctx.scale(1.05, 1.05);
  Sp.drawChar(ctx, G.ch, P.t, P.moving, 13);
  ctx.restore();
  ctx.globalAlpha = 1;
  // 脚下血条
  {
    const bw = 34, by = P.y + 17;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(P.x - bw / 2 - 1, by - 1, bw + 2, 6);
    const f = Math.max(0, P.hp / P.maxHp);
    ctx.fillStyle = f > 0.5 ? '#5ae07a' : f > 0.25 ? '#ffd24a' : '#ff4a5a';
    ctx.fillRect(P.x - bw / 2, by, bw * f, 4);
  }
  for (let i = 0; i < G.bigs.length; i++) drawEnemy(G.bigs[i]);

  // 旋转利刃
  for (const w of G.weapons) if (w.id === 'orbit' && w.n) {
    for (let i = 0; i < w.n; i++) {
      const a = w.a + i * TAU / w.n, x = P.x + Math.cos(a) * w.rad, y = P.y + Math.sin(a) * w.rad;
      ctx.globalCompositeOperation = 'lighter'; glowAt('#ffd27a', x, y, w.br * 2.4, 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2 + now * 8);
      const b = w.br;
      ctx.fillStyle = '#e8eef8'; ctx.strokeStyle = '#2a2f44'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -b * 1.6); ctx.lineTo(b * .55, b * .3); ctx.lineTo(0, b * .1); ctx.lineTo(-b * .55, b * .3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c89a3a'; ctx.fillRect(-b * .6, b * .3, b * 1.2, b * .28);
      ctx.restore();
    }
  }

  // 玩家弹体
  for (const p of G.proj) {
    if (p.x < x0 - 40 || p.x > x1 + 40 || p.y < y0 - 40 || p.y > y1 + 40) continue;
    if (p.k === 'bolt') {
      const a = Math.atan2(p.vy, p.vx);
      ctx.globalCompositeOperation = 'lighter';
      glowAt('#7fd0ff', p.x, p.y, p.r * 3.2, 0.7);
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#9fe0ff'; ctx.lineWidth = p.r * 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * p.r * 4, p.y - Math.sin(a) * p.r * 4); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.7, 0, TAU); ctx.fill();
    } else if (p.k === 'axe') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      const s = p.r;
      ctx.fillStyle = '#7a5a34'; ctx.fillRect(-s * 0.12, -s, s * 0.24, s * 1.8);
      ctx.fillStyle = '#d6dff0'; ctx.strokeStyle = '#2a2f44'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s); ctx.quadraticCurveTo(s * 1.5, -s * 0.9, s * 1.1, 0.1 * s); ctx.quadraticCurveTo(s * 0.7, -s * 0.2, s * 0.1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.1, -s); ctx.quadraticCurveTo(-s * 1.5, -s * 0.9, -s * 1.1, 0.1 * s); ctx.quadraticCurveTo(-s * 0.7, -s * 0.2, -s * 0.1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // 敌方弹幕
  ctx.globalCompositeOperation = 'lighter';
  for (const b of G.eproj) {
    if (b.x < x0 - 20 || b.x > x1 + 20 || b.y < y0 - 20 || b.y > y1 + 20) continue;
    glowAt(b.col.length === 7 ? b.col : '#ff6a8a', b.x, b.y, b.r * 3, 0.8);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  for (const b of G.eproj) {
    if (b.x < x0 - 20 || b.x > x1 + 20 || b.y < y0 - 20 || b.y > y1 + 20) continue;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); ctx.fill();
  }

  // 特效（光效层）
  ctx.globalCompositeOperation = 'lighter';
  for (const f of G.fx) {
    if (f.k === 'meteor') {
      const a = f.t / f.T, fall = a * 320;
      glowAt('#ff8a3a', f.x + fall * 0.35, f.y - fall, 34, 0.9);
      ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x + fall * 0.35, f.y - fall); ctx.lineTo(f.x + fall * 0.35 + 40, f.y - fall - 120); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.k === 'nova') {
      const a = 1 - f.r / f.max;
      ctx.globalAlpha = 0.25 + a * 0.5; ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 14 * a + 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.18 * a; ctx.fillStyle = '#9fe6ff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (f.k === 'ring') {
      const a = f.life / f.T, rr = f.r + (f.max - f.r) * (1 - a);
      ctx.globalAlpha = a; ctx.strokeStyle = f.col; ctx.lineWidth = 6 * a + 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.k === 'beam') {
      const a = f.life / f.T, w = f.w * (0.4 + a * 0.6);
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.45 * a; ctx.strokeStyle = '#ffd860'; ctx.lineWidth = w * 1.8;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.4;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.k === 'bolt') {
      const a = f.life / f.T, pts = f.pts;
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = a * (pass ? 1 : 0.5); ctx.strokeStyle = pass ? '#ffffff' : '#ffe84a'; ctx.lineWidth = pass ? 2 : 6; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          const ax = pts[i - 2], ay = pts[i - 1], bx = pts[i], by = pts[i + 1];
          const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, segs = Math.max(2, (d / 28) | 0);
          for (let s = 1; s < segs; s++) {
            const t = s / segs, o = (Math.random() - 0.5) * 16;
            ctx.lineTo(ax + dx * t - dy / d * o, ay + dy * t + dx / d * o);
          }
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // 粒子
  const ps = G.parts;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
  }
  ctx.globalAlpha = 1;

  // 伤害数字
  if (G.texts.length) {
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const t of G.texts) {
      const a = Math.min(1, t.life / t.max * 1.6);
      ctx.globalAlpha = a;
      ctx.font = 'bold ' + (t.big ? 17 : 13) + 'px sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // 屏幕白闪
  if (G.flash > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(0.7, G.flash); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1;
  }
};
})(window.SF = window.SF || {});
