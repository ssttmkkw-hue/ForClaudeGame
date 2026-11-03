/* 8 种武器的发射/更新逻辑 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU, C = SF.Core, G = SF.G;
const WL = SF.WL = {};

function cdOf(w) { return Math.max(0.12, w.s.cd * G.stats.cd); }

/* ---- 魔法飞弹：带轻微追踪 ---- */
function boltUpd(p, dt) {
  if (!p.tgt || p.tgt.dead) {
    p.ta = (p.ta || 0) - dt;
    if (p.ta <= 0) {
      p.ta = 0.15;
      const t = C.nearest(1, 260, p.x, p.y);
      p.tgt = t.length ? t[0] : null;
    }
  }
  if (p.tgt && !p.tgt.dead) {
    const sp = Math.hypot(p.vx, p.vy);
    let a = Math.atan2(p.vy, p.vx);
    const want = Math.atan2(p.tgt.y - p.y, p.tgt.x - p.x);
    let da = want - a;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    a += U.clamp(da, -4.5 * dt, 4.5 * dt);
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
}
/* ---- 回旋斧 ---- */
function axeUpd(p, dt) {
  const P = G.p;
  p.rot += 14 * dt;
  if (p.phase === 0) {
    const step = p.speed * dt;
    p.x += Math.cos(p.dir) * step; p.y += Math.sin(p.dir) * step; p.travel += step;
    if (p.travel >= p.maxD) p.phase = 1;
  } else {
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
    const step = p.speed * 1.25 * dt;
    if (d < 20 || step > d) { p.dead = true; return; }
    p.x += dx / d * step; p.y += dy / d * step;
  }
  p.vx = Math.cos(p.dir) * 100; p.vy = Math.sin(p.dir) * 100; // 用于击退方向
}

function aimAngle() {
  const P = G.p;
  const t = C.nearest(1, 520);
  if (t.length) return Math.atan2(t[0].y - P.y, t[0].x - P.x);
  return null;
}

const LOGIC = {
  bolt(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    const tg = C.nearest(n, 480);
    if (!tg.length) { w.t = 0.12; return; }
    const dmg = s.dmg * S.might, m = tg.length;
    const angs = [];
    for (let i = 0; i < n; i++) {
      const e = tg[i % m];
      let a = Math.atan2(e.y - P.y, e.x - P.x);
      if (i >= m) a += ((i - m) % 2 ? 1 : -1) * (Math.floor((i - m) / 2) + 1) * 0.14;
      angs.push(a);
    }
    for (let i = 0; i < n; i++) {
      const a = angs[i];
      C.addProj({ k: 'bolt', x: P.x, y: P.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: 7 * Math.sqrt(S.area), dmg, pierce: s.pierce, life: 1.8, slot: w.slot, kb: 110, col: '#7fd0ff', upd: boltUpd });
    }
    w.t = cdOf(w); C.sfx('shoot');
  },

  orbit(w, dt) {
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    const rad = s.radius * S.area, br = s.size * Math.sqrt(S.area);
    w.a += s.rot * dt; w.n = n; w.rad = rad; w.br = br;
    const dmg = s.dmg * S.might;
    for (let i = 0; i < n; i++) {
      const a = w.a + i * TAU / n, x = P.x + Math.cos(a) * rad, y = P.y + Math.sin(a) * rad;
      C.hitCircle(x, y, br, w.slot, s.cd, dmg, 150);
      C.blockBullets(x, y, br + 4);
    }
  },

  chain(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    const starts = C.nearest(n, 430).slice();
    if (!starts.length) { w.t = 0.15; return; }
    const dmg = s.dmg * S.might, range = s.range * Math.sqrt(S.area);
    for (const first of starts) {
      const visited = [first], pts = [P.x, P.y, first.x, first.y];
      let cur = first;
      for (let j = 0; j < s.chain; j++) {
        let best = null, bd = range * range;
        for (const e of G.enemies) {
          if (e.dead || visited.indexOf(e) !== -1) continue;
          const dx = e.x - cur.x, dy = e.y - cur.y, d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = e; }
        }
        if (!best) break;
        visited.push(best); pts.push(best.x, best.y); cur = best;
      }
      for (const e of visited) { C.hurt(e, dmg, 0, 0); e.stun = Math.max(e.stun, 0.15); C.burst(e.x, e.y, '#fff27a', 3, 90, 0.25, 2); }
      C.fx({ k: 'bolt', pts, life: 0.25, T: 0.25 });
    }
    w.t = cdOf(w); C.sfx('lightning');
  },

  meteor(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    const cand = C.nearest(30, 400).slice();
    if (!cand.length) { w.t = 0.2; return; }
    for (let i = 0; i < n; i++) {
      const e = cand[(Math.random() * cand.length) | 0];
      C.fx({ k: 'meteor', x: e.x + U.rand(-24, 24), y: e.y + U.rand(-24, 24), t: 0.85, T: 0.85, r: s.radius * S.area, dmg: s.dmg * S.might, slot: w.slot });
    }
    w.t = cdOf(w);
  },

  nova(w, dt) {
    const S = G.stats, s = w.s;
    const fire = () => {
      const max = s.radius * S.area;
      C.fx({ k: 'nova', x: G.p.x, y: G.p.y, r: 0, max, sp: max / 0.5, id: G.nextId++, dmg: s.dmg * S.might, slowMul: s.slow, slowT: s.slowT, slot: w.slot, col: '#9fe6ff' });
      C.sfx('nova');
    };
    for (let i = w.q.length - 1; i >= 0; i--) { w.q[i] -= dt; if (w.q[i] <= 0) { w.q.splice(i, 1); fire(); } }
    w.t -= dt; if (w.t > 0) return;
    // 周围无敌人时不浪费
    if (!C.nearest(1, s.radius * S.area + 40).length) { w.t = 0.2; return; }
    fire();
    const extra = s.amount + S.amount;
    for (let i = 1; i <= extra; i++) w.q.push(0.4 * i);
    w.t = cdOf(w);
  },

  axe(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    let a0 = aimAngle();
    if (a0 === null) a0 = P.face > 0 ? 0 : Math.PI;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 0.5;
      C.addProj({ k: 'axe', x: P.x, y: P.y, vx: 100, vy: 0, dir: a, phase: 0, travel: 0, maxD: s.range * Math.sqrt(S.area), speed: s.speed, rot: Math.random() * TAU, r: s.size * Math.sqrt(S.area), dmg: s.dmg * S.might, pierce: 999, rehit: 0.4, life: 5, slot: w.slot, kb: 90, col: '#c9d4e6', upd: axeUpd });
    }
    w.t = cdOf(w); C.sfx('shoot');
  },

  poison(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    const cand = C.nearest(24, 330).slice();
    for (let i = 0; i < n; i++) {
      let x, y;
      if (cand.length) { const e = cand[(Math.random() * cand.length) | 0]; x = e.x + U.rand(-20, 20); y = e.y + U.rand(-20, 20); }
      else { const a = Math.random() * TAU, r = U.rand(40, 150); x = P.x + Math.cos(a) * r; y = P.y + Math.sin(a) * r; }
      G.zones.push({ x, y, r: s.radius * S.area, t: s.dur, T: s.dur, dmg: s.dmg * S.might, slot: w.slot, dead: false, ph: Math.random() * 6 });
    }
    w.t = cdOf(w);
  },

  beam(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    const a0 = aimAngle();
    if (a0 === null) { w.t = 0.15; return; }
    const dmg = s.dmg * S.might, width = s.width * Math.sqrt(S.area), len = s.len;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 0.32;
      const ca = Math.cos(a), sa = Math.sin(a);
      const x1 = P.x + ca * len, y1 = P.y + sa * len;
      const test = e => {
        if (e.dead) return;
        const ex = e.x - P.x, ey = e.y - P.y;
        const t = U.clamp(ex * ca + ey * sa, 0, len);
        const px = ca * t - ex, py = sa * t - ey;
        const rr = width / 2 + e.r * 0.8;
        if (px * px + py * py < rr * rr) C.hurt(e, dmg, ca * 140, sa * 140);
      };
      for (const e of G.enemies) test(e);
      C.fx({ k: 'beam', x0: P.x, y0: P.y, x1, y1, w: width, life: 0.28, T: 0.28 });
    }
    w.t = cdOf(w); C.sfx('beam'); C.shake(1.5);
  }
};

WL.update = function (w, dt) { LOGIC[w.id](w, dt); };
})(window.SF = window.SF || {});
