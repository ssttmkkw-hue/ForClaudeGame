/* 15 种武器的发射/更新逻辑 */
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
      C.addProj({ k: 'bolt', x: P.x, y: P.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: 7 * Math.sqrt(S.area) * (w.evo ? 1.25 : 1), dmg, pierce: s.pierce, life: 1.8, slot: w.slot, kb: 110, col: w.evo ? '#ffd86a' : '#6fd0ff', evo: w.evo, upd: boltUpd });
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
      const col = w.evo ? '#c890ff' : '#8fd8ff';
      for (const e of visited) { C.hurt(e, dmg, 0, 0); e.stun = Math.max(e.stun, 0.15); SF.VFX.hit(e.x, e.y - e.r * 0.3, 0, 0, col); }
      C.fx({ k: 'bolt', pts, life: 0.3, T: 0.3, col, seed: Math.random() * 1000 });
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
      C.fx({ k: 'meteor', x: e.x + U.rand(-24, 24), y: e.y + U.rand(-24, 24), t: 0.85, T: 0.85, r: s.radius * S.area, dmg: s.dmg * S.might, slot: w.slot, evo: w.evo, rot: Math.random() * 6 });
    }
    w.t = cdOf(w);
  },

  nova(w, dt) {
    const S = G.stats, s = w.s;
    const fire = () => {
      const max = s.radius * S.area;
      C.fx({ k: 'nova', x: G.p.x, y: G.p.y, r: 0, max, sp: max / 0.5, id: G.nextId++, dmg: s.dmg * S.might, slowMul: s.slow, slowT: s.slowT, slot: w.slot, col: w.evo ? '#e0f6ff' : '#8fdcff', evo: w.evo });
      SF.VFX.frost(G.p.x, G.p.y, 40, w.evo ? '#e0f6ff' : '#8fdcff');
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
      C.addProj({ k: 'axe', x: P.x, y: P.y, vx: 100, vy: 0, dir: a, phase: 0, travel: 0, maxD: s.range * Math.sqrt(S.area), speed: s.speed, rot: Math.random() * TAU, r: s.size * Math.sqrt(S.area), dmg: s.dmg * S.might, pierce: 999, rehit: 0.4, life: 5, slot: w.slot, kb: 90, col: '#c9d4e6', evo: w.evo, upd: axeUpd });
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
      G.zones.push({ x, y, r: s.radius * S.area, t: s.dur, T: s.dur, dmg: s.dmg * S.might, slot: w.slot, dead: false, ph: Math.random() * 6, evo: w.evo });
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
      C.fx({ k: 'beam', x0: P.x, y0: P.y, x1, y1, w: width, life: 0.32, T: 0.32, evo: w.evo });
      SF.VFX.sparkLine(P.x, P.y, x1, y1, w.evo ? '#ffffff' : '#ffe08a', 10);
    }
    w.t = cdOf(w); C.sfx('beam'); C.shake(1.5);
  }
};


/* ======================= 新武器 ======================= */
function dartUpd(p, dt) { p.x += p.vx * dt; p.y += p.vy * dt; }
// 弹射刃：命中后转向下一个目标
function discHit(p, e) {
  if (p.bounce <= 0) { p.dead = true; return; }
  let best = null, bd = 260 * 260;
  for (const o of G.enemies) {
    if (o.dead || o === e || p.hit.indexOf(o.id) !== -1) continue;
    const dx = o.x - p.x, dy = o.y - p.y, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = o; }
  }
  if (!best) { p.dead = true; return; }
  p.bounce--;
  const a = Math.atan2(best.y - p.y, best.x - p.x), sp = Math.hypot(p.vx, p.vy);
  p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.life = Math.max(p.life, 0.8);
  SF.VFX.p('glow', p.x, p.y, 0, 0, 0.12, 18, p.col);
}
function discUpd(p, dt) { p.x += p.vx * dt; p.y += p.vy * dt; p.rot = (p.rot || 0) + 18 * dt; }
Object.assign(LOGIC, {
  gatling(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    let a;
    if (P.moving && Math.hypot(P.vx || 0, P.vy || 0) > 5) a = Math.atan2(P.vy, P.vx);
    else { const t = C.nearest(1, 520); if (!t.length) { w.t = 0.1; return; } a = Math.atan2(t[0].y - P.y, t[0].x - P.x); }
    w.aim = a;
    for (let i = 0; i < n; i++) {
      const aa = a + (i - (n - 1) / 2) * 0.09 + U.rand(-0.04, 0.04);
      C.addProj({ k: 'dart', x: P.x + Math.cos(aa) * 14, y: P.y - 6 + Math.sin(aa) * 14, vx: Math.cos(aa) * s.speed, vy: Math.sin(aa) * s.speed, r: 5, dmg: s.dmg * S.might, pierce: s.pierce, life: 0.95, slot: w.slot, kb: 40, col: w.evo ? '#7affd0' : '#ffcf6a', evo: w.evo, upd: dartUpd });
    }
    w.t = cdOf(w); C.sfx('shoot');
  },
  ricochet(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    const tg = C.nearest(n, 480);
    if (!tg.length) { w.t = 0.15; return; }
    for (let i = 0; i < n; i++) {
      const e = tg[i % tg.length], a = Math.atan2(e.y - P.y, e.x - P.x) + (i >= tg.length ? 0.3 * i : 0);
      C.addProj({ k: 'disc', x: P.x, y: P.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: 9 * Math.sqrt(S.area), dmg: s.dmg * S.might, pierce: 999, bounce: s.bounce, life: 1.6, slot: w.slot, kb: 70, col: w.evo ? '#ff9af0' : '#9fffe0', evo: w.evo, upd: discUpd, onHit: discHit });
    }
    w.t = cdOf(w); C.sfx('shoot');
  },
  aura(w, dt) {
    const S = G.stats, s = w.s, P = G.p;
    w.rad = s.radius * S.area;
    C.hitCircle(P.x, P.y, w.rad, w.slot, Math.max(0.12, s.cd * S.cd), s.dmg * S.might, s.kb);
    if (w.evo && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 1.2 * dt);
  },
  drone(w, dt) {
    const S = G.stats, s = w.s, P = G.p, n = Math.min(8, s.amount + S.amount);
    w.a = (w.a || 0) + dt * 1.4;
    if (!w.dr) w.dr = [];
    while (w.dr.length < n) w.dr.push({ x: P.x, y: P.y, t: Math.random() * cdOf(w), ang: 0 });
    w.dr.length = n;
    for (let i = 0; i < n; i++) {
      const d = w.dr[i], a = w.a + i * TAU / n;
      const tx = P.x + Math.cos(a) * 48, ty = P.y - 26 + Math.sin(a) * 22 + Math.sin(G.time * 3 + i) * 4;
      d.x += (tx - d.x) * Math.min(1, dt * 8); d.y += (ty - d.y) * Math.min(1, dt * 8);
      d.t -= dt;
      if (d.t <= 0) {
        const tg = C.nearest(1, s.range, d.x, d.y);
        if (tg.length) {
          const e = tg[0];
          d.ang = Math.atan2(e.y - d.y, e.x - d.x);
          C.hurt(e, s.dmg * S.might, Math.cos(d.ang) * 50, Math.sin(d.ang) * 50);
          C.fx({ k: 'laser', x0: d.x, y0: d.y, x1: e.x, y1: e.y, life: 0.12, T: 0.12, col: w.evo ? '#ff7ad8' : '#7affff' });
          d.t = cdOf(w);
        } else d.t = 0.15;
      }
    }
  },
  mine(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s, P = G.p, n = s.amount + S.amount;
    const mine = G.traps.filter(t => t.slot === w.slot);
    for (let i = 0; i < n; i++) {
      if (mine.length + i >= s.max) { const old = mine.shift(); if (old) old.dead = true; }
      const a = Math.random() * TAU, r = U.rand(20, 80);
      const p = SF.Map.nearestValid(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r);
      G.traps.push({ x: p[0], y: p[1], arm: 0.5, life: 25, r: s.radius * S.area, dmg: s.dmg * S.might, slot: w.slot, evo: w.evo, dead: false, t: Math.random() * 3 });
    }
    w.t = cdOf(w);
  },
  vortex(w, dt) {
    w.t -= dt; if (w.t > 0) return;
    const S = G.stats, s = w.s;
    const cand = C.nearest(20, 380).slice();
    if (!cand.length) { w.t = 0.3; return; }
    const e = cand[(Math.random() * Math.min(6, cand.length)) | 0];
    G.vortex.push({ x: e.x, y: e.y, r: s.radius * S.area, t: s.dur, T: s.dur, dmg: s.dmg * S.might, pull: s.pull, slot: w.slot, tick: 0, evo: w.evo, dead: false });
    C.sfx('nova');
    w.t = cdOf(w);
  },
  summon(w, dt) {
    const S = G.stats, s = w.s, P = G.p, n = Math.min(3, s.amount + Math.min(1, S.amount));
    if (!w.pets) w.pets = [];
    while (w.pets.length < n) { const p = SF.Map.nearestValid(P.x + U.rand(-40, 40), P.y + 30); w.pets.push({ x: p[0], y: p[1], t: 0, cd: 0.5, face: 1, smash: 0, moving: false }); SF.VFX.sparkle(p[0], p[1], '#ffd86a', 10); }
    w.pets.length = n;
    const sz = s.size * (w.evo ? 1.25 : 1), reach = 30 * sz;
    for (const pet of w.pets) {
      pet.t += dt; pet.cd -= dt; if (pet.smash > 0) pet.smash -= dt;
      let tx = P.x, ty = P.y + 40;
      const tg = C.nearest(1, 420, pet.x, pet.y);
      const target = tg.length && Math.hypot(tg[0].x - P.x, tg[0].y - P.y) < 520 ? tg[0] : null;
      if (target) { tx = target.x; ty = target.y; }
      const dx = tx - pet.x, dy = ty - pet.y, d = Math.hypot(dx, dy) || 1;
      pet.moving = d > (target ? reach : 50);
      if (pet.moving) {
        let ux = dx / d, uy = dy / d;
        if (d > 80) { const f = SF.Map.flowDir(pet.x, pet.y); if (f && !target) { ux = f[0]; uy = f[1]; } }
        const sp = (target ? 150 : 200) * (d > 300 ? 1.6 : 1);
        pet.x += ux * sp * dt; pet.y += uy * sp * dt;
        if (Math.abs(ux) > 0.1) pet.face = ux > 0 ? 1 : -1;
        SF.Map.collide(pet, 14 * sz, false);
      }
      if (target && d < reach + target.r + 6 && pet.cd <= 0) {
        pet.cd = Math.max(0.3, s.cd * S.cd); pet.smash = 0.25;
        const R = 58 * sz * Math.sqrt(S.area), sx = pet.x + pet.face * 14 * sz, sy = pet.y;
        const list = C.query(sx, sy, R + 36).slice();
        for (const b of G.bigs) if (list.indexOf(b) < 0) list.push(b);
        for (const e of list) { if (e.dead) continue; const ex = e.x - sx, ey = e.y - sy, dd = Math.hypot(ex, ey) || 1; if (dd < R + e.r) C.hurt(e, s.dmg * S.might * (w.evo ? 1.3 : 1), ex / dd * 280, ey / dd * 280); }
        G.fx.push({ k: 'ring', x: sx, y: sy, r: 8, max: R, life: 0.28, T: 0.28, col: '#ffd86a' });
        SF.VFX.burst(sx, sy, '#a89070', 8, 160, 0.4, 4, 'shard');
        C.shake(2); C.sfx('slam');
      }
    }
  }
});
// 场上持续存在的武器实体：地雷、漩涡
WL.world = function (dt) {
  for (const t of G.traps) {
    if (t.dead) continue;
    t.life -= dt; t.t += dt;
    if (t.arm > 0) { t.arm -= dt; continue; }
    let trig = t.life <= 0;
    if (!trig) { const list = C.query(t.x, t.y, 60); for (const e of list) { if (!e.dead && !e.fly && Math.hypot(e.x - t.x, e.y - t.y) < 18 + e.r) { trig = true; break; } } }
    if (!trig) continue;
    t.dead = true;
    const boom = (x, y, R, dmg) => {
      const list = C.query(x, y, R + 36).slice();
      for (const b of G.bigs) if (list.indexOf(b) < 0) list.push(b);
      for (const e of list) { if (e.dead) continue; const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1; if (d < R + e.r) C.hurt(e, dmg, dx / d * 240, dy / d * 240); }
      SF.VFX.explosion(x, y, R, ['#ff7a2a', '#ffe08a'], { decal: R > 40 });
    };
    boom(t.x, t.y, t.r, t.dmg);
    if (t.evo) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; G.traps.push({ x: t.x + Math.cos(a) * 60, y: t.y + Math.sin(a) * 60, arm: 0.35 + i * 0.12, life: 0.4 + i * 0.12, r: t.r * 0.6, dmg: t.dmg * 0.5, slot: t.slot, evo: false, dead: false, t: 0 }); }
    C.shake(3); C.sfx('explode');
  }
  for (const v of G.vortex) {
    if (v.dead) continue;
    v.t -= dt;
    if (v.t <= 0) { v.dead = true; SF.VFX.burst(v.x, v.y, '#b07aff', 14, 220, 0.4, 3, 'spark'); continue; }
    const R = v.r * 1.5, list = C.query(v.x, v.y, R + 30);
    v.tick -= dt;
    const hitNow = v.tick <= 0; if (hitNow) v.tick = 0.4;
    for (const e of list) {
      if (e.dead) continue;
      const dx = v.x - e.x, dy = v.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d > R + e.r) continue;
      if (!e.boss) { const f = v.pull * (e.big ? 0.3 : 1) * dt; e.x += dx / d * Math.min(f, d); e.y += dy / d * Math.min(f, d); }
      if (hitNow && d < v.r + e.r) C.hurt(e, v.dmg, 0, 0);
    }
    if (Math.random() < dt * 20 && SF.VFX.room(0.7)) { const a = Math.random() * TAU; SF.VFX.p('spark', v.x + Math.cos(a) * R, v.y + Math.sin(a) * R, -Math.cos(a - 0.6) * 220, -Math.sin(a - 0.6) * 220, 0.35, 2, v.evo ? '#ff7ad8' : '#c08aff', { drag: 2 }); }
  }
  let j = 0; for (const t of G.traps) if (!t.dead) G.traps[j++] = t; G.traps.length = j;
  j = 0; for (const v of G.vortex) if (!v.dead) G.vortex[j++] = v; G.vortex.length = j;
};
WL.update = function (w, dt) { LOGIC[w.id](w, dt); };
})(window.SF = window.SF || {});
