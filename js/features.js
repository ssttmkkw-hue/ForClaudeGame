/* 主动技能、可操控地图武器、局内挑战、后期难度 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU, G = SF.G;
const F = SF.Feat = {};
const C = () => SF.Core, V = () => SF.VFX, A = () => SF.Audio, UI = () => SF.UI;
const meta = id => SF.Save.data.meta[id] || 0;
const lvlScale = () => 1 + G.level * 0.07;

/* ======================= 数据 ======================= */
SF.MAPW = {
  cannon: { name: '加农炮台', dur: 22, desc: '摇杆瞄准（松手自动瞄准），连续发射爆炸炮弹' },
  flamer: { name: '喷火塔', dur: 16, desc: '摇杆瞄准，喷射扇形烈焰灼烧敌群' },
  tank:   { name: '战车', dur: 26, hp: 420, desc: '驾驶战车碾压敌人，炮塔自动开火，替你承受伤害' }
};
SF.ACTIVE = {
  dash: { name: '闪避冲刺', desc: '向移动方向冲刺，期间无敌并撞伤敌人' },
  ult:  { name: '星陨天降', desc: '召唤流星雨轰炸敌群，最后冲击波震荡全屏；击杀可加速充能' }
};
const CHAL = [
  { id: 'kill', w: 3, make: () => ({ n: 30 + Math.round(G.level * 2.5), t: 40 }), txt: c => `${c.t} 秒内击杀 ${c.n} 个敌人` },
  { id: 'gems', w: 2, make: () => ({ n: 25 + G.level, t: 40 }), txt: c => `${c.t} 秒内收集 ${c.n} 颗经验` },
  { id: 'nohit', w: 2, make: () => ({ n: 20, t: 20 }), txt: c => `无伤坚持 ${c.n} 秒` },
  { id: 'elite', w: 2, make: () => { spawnElite(true); return { n: 1, t: 45 }; }, txt: c => `${c.t} 秒内击败挑战精英` },
  { id: 'dash', w: 1.5, make: () => ({ n: 10, t: 35 }), txt: c => `${c.t} 秒内用冲刺撞击 ${c.n} 个敌人` },
  { id: 'mapw', w: 2, cond: () => G.mapw.some(m => !m.dead), make: () => ({ n: 25, t: 45 }), txt: c => `${c.t} 秒内用地图武器击杀 ${c.n} 个敌人` }
];
const REWARD = [
  { id: 'chest', txt: '宝箱', w: 3 }, { id: 'heal', txt: '回复 50% 生命', w: 2 },
  { id: 'gold', txt: '金币', w: 2 }, { id: 'ult', txt: '大招立即充能', w: 2 }
];
function pickW(list) {
  let tot = 0; for (const o of list) tot += o.w;
  let r = Math.random() * tot;
  for (const o of list) { r -= o.w; if (r <= 0) return o; }
  return list[list.length - 1];
}

/* ======================= 开局 ======================= */
F.start = function () {
  G.run = { kills: 0, dashes: 0, ults: 0, mapwKills: 0, elites: 0, chests: 0, evos: 0, gems: 0, chal: 0, dashHits: 0 };
  G.sk = {
    dashCd: 0, dashMax: 4.5 * (1 - 0.08 * meta('dashm')),
    ultCd: 20, ultMax: 42 * (1 - 0.06 * meta('ultm')), ultT: 0, ultTick: 0
  };
  G.mapw = []; G.mapwT = 32; G.mount = null; G.near = null;
  G.chal = null; G.chalT = 45;
  G.frenzy = false; G.eliteT = 0;
  const P = G.p; P.dashT = 0; P.dvx = 0; P.dvy = 0; P.ghostT = 0;
};

/* ======================= 主动技能 ======================= */
F.dash = function () {
  const P = G.p, sk = G.sk;
  if (G.state !== 'play' || !sk || sk.dashCd > 0 || G.mount || P.dashT > 0) return false;
  const v = SF.Input.vec();
  let dx = v[0], dy = v[1];
  const m = Math.hypot(dx, dy);
  if (m < 0.2) { dx = P.face; dy = 0; } else { dx /= m; dy /= m; }
  P.dashT = 0.2; P.dvx = dx * 820; P.dvy = dy * 820; P.inv = Math.max(P.inv, 0.45);
  sk.dashCd = sk.dashMax; G.run.dashes++;
  A().sfx('dash');
  V().burst(P.x, P.y, '#9fe6ff', 10, 180, 0.35, 3, 'spark');
  return true;
};
F.ult = function () {
  const sk = G.sk;
  if (G.state !== 'play' || !sk || sk.ultCd > 0 || sk.ultT > 0) return false;
  sk.ultT = 2.4; sk.ultTick = 0; sk.ultCd = sk.ultMax; G.run.ults++;
  G.p.inv = Math.max(G.p.inv, 2.7);
  G.flash = 0.45; G.shake = Math.max(G.shake, 6);
  A().sfx('ult');
  UI().banner('☄ 星陨天降！', 1600);
  return true;
};
function inView(e) { const c = SF.Map.camera(); return Math.abs(e.x - c[0]) < SF.view.hw + 20 && Math.abs(e.y - c[1]) < SF.view.hh + 20; }
function updateSkills(dt) {
  const sk = G.sk, P = G.p;
  if (sk.dashCd > 0) sk.dashCd -= dt;
  if (sk.ultT > 0) {
    sk.ultT -= dt; sk.ultTick -= dt;
    const dmg = 55 * G.stats.might * lvlScale() * (1 + 0.2 * meta('ultm'));
    if (sk.ultTick <= 0) {
      sk.ultTick = 0.1;
      const cand = G.enemies.filter(e => !e.dead && inView(e));
      let x, y;
      if (cand.length) { const e = cand[(Math.random() * cand.length) | 0]; x = e.x + U.rand(-20, 20); y = e.y + U.rand(-20, 20); }
      else { const c = SF.Map.camera(); x = c[0] + U.rand(-SF.view.hw, SF.view.hw) * 0.8; y = c[1] + U.rand(-SF.view.hh, SF.view.hh) * 0.8; }
      G.fx.push({ k: 'meteor', x, y, t: 0.45, T: 0.45, r: 72, dmg, slot: 7, evo: true, rot: Math.random() * 6, src: 'ult' });
    }
    if (sk.ultT <= 0) {
      C().src = 'ult';
      for (const e of G.enemies) {
        if (e.dead || !inView(e)) continue;
        const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
        C().hurt(e, dmg * 2, dx / d * 420, dy / d * 420);
      }
      C().src = null;
      G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 20, max: Math.hypot(SF.view.hw, SF.view.hh), life: 0.6, T: 0.6, col: '#ff8ae0', follow: true });
      G.flash = 0.8; G.shake = 14; A().sfx('explode');
    }
  } else if (sk.ultCd > 0) sk.ultCd -= dt;
}
// 冲刺/驾驶时接管玩家移动，返回 true 表示已处理
F.movePlayer = function (dt) {
  const P = G.p, mw = G.mount;
  if (P.dashT > 0) {
    P.dashT -= dt; P.x += P.dvx * dt; P.y += P.dvy * dt; P.moving = true;
    if (Math.abs(P.dvx) > 1) P.face = P.dvx > 0 ? 1 : -1;
    P.ghostT -= dt;
    if (P.ghostT <= 0) { P.ghostT = 0.035; G.fx.push({ k: 'ghost', x: P.x, y: P.y, face: P.face, t: P.t, life: 0.28, T: 0.28 }); }
    C().src = 'dash';
    const n = C().hitCircle(P.x, P.y, P.r + 16, 6, 0.6, 20 * G.stats.might * lvlScale() * (1 + 0.15 * meta('dashm')), 460);
    C().src = null;
    if (n) { G.run.dashHits += n; if (G.chal && G.chal.id === 'dash') G.chal.p += n; }
    return true;
  }
  if (!mw) return false;
  const v = SF.Input.vec(), m = Math.hypot(v[0], v[1]);
  if (mw.kind === 'tank') {
    const sp = 150 * G.stats.move * 1.3;
    P.x += v[0] * sp * dt; P.y += v[1] * sp * dt;
    mw.x = P.x; mw.y = P.y; P.moving = m > 0.05;
    if (m > 0.1) {
      const want = Math.atan2(v[1], v[0]);
      let da = want - mw.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      mw.ang += U.clamp(da, -8 * dt, 8 * dt);
      P.face = v[0] >= 0 ? 1 : -1;
    }
  } else {
    P.x = mw.x; P.y = mw.y - 14; P.moving = false;
    if (m > 0.2) { mw.aim = Math.atan2(v[1], v[0]); mw.manual = true; } else mw.manual = false;
    P.face = Math.cos(mw.aim) >= 0 ? 1 : -1;
  }
  return true;
};

/* ======================= 地图武器 ======================= */
function spawnMapw() {
  const P = G.p, kinds = ['cannon', 'flamer', 'tank'];
  const kind = U.choice(kinds), pads = SF.Map.get().pads;
  const free = pads.filter(p => !G.mapw.some(m => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < 40));
  if (!free.length) return;
  free.sort((a, b) => Math.abs(Math.hypot(a.x - P.x, a.y - P.y) - 450) - Math.abs(Math.hypot(b.x - P.x, b.y - P.y) - 450));
  const pad = free[Math.min(free.length - 1, (Math.random() * 2) | 0)];
  const def = SF.MAPW[kind], dur = def.dur * (1 + 0.2 * meta('mapwm'));
  G.mapw.push({ kind, x: pad.x, y: pad.y, aim: -Math.PI / 2, ang: 0, tAng: 0, manual: false, energy: dur, max: dur,
    hp: def.hp || 0, maxHp: def.hp || 0, fireT: 0, tick: 0, mounted: false, dead: false, t: 0, flash: 0, firing: false });
  G.fx.push({ k: 'pillar', x: pad.x, y: pad.y, life: 1.2, T: 1.2 });
  UI().banner('🛠 武器台出现「' + def.name + '」！靠近后点「操控」', 2400);
  A().sfx('chest');
}
function nearestTarget(x, y, range) {
  const t = C().nearest(1, range, x, y);
  return t.length ? t[0] : null;
}
function turn(cur, want, rate) {
  let da = want - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
  return cur + U.clamp(da, -rate, rate);
}
function shellUpd(p, dt) {
  p.x += p.vx * dt; p.y += p.vy * dt; p.dist += Math.hypot(p.vx, p.vy) * dt;
  if (p.dist >= p.range) { explode(p.x, p.y, p.aoe, p.adm); p.dead = true; }
}
function shellHit(p) { explode(p.x, p.y, p.aoe, p.adm); }
function explode(x, y, R, dmg) {
  const Co = C();
  Co.src = 'mapw';
  const list = Co.query(x, y, R + 36).slice();
  for (const b of G.bigs) if (list.indexOf(b) < 0) list.push(b);
  for (const e of list) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    const d = Math.hypot(dx, dy) || 1;
    Co.hurt(e, dmg, dx / d * 260, dy / d * 260);
  }
  Co.src = null;
  V().explosion(x, y, R, ['#ff9a3a', '#ffe08a']);
  G.shake = Math.max(G.shake, 3); A().sfx('explode');
}
function fireShell(mw, ang, dmg, aoe) {
  const ox = mw.x + Math.cos(ang) * 30, oy = mw.y + Math.sin(ang) * 30 - 8;
  C().addProj({ k: 'shell', x: ox, y: oy, vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560, r: 9, dmg: dmg * 0.3, pierce: 0, life: 2,
    slot: 7, kb: 80, src: 'mapw', dist: 0, range: 430, aoe, adm: dmg, upd: shellUpd, onHit: shellHit });
  V().p('glow', ox, oy, 0, 0, 0.12, 26, '#ffd27a');
  V().burst(ox, oy, '#c8c0b0', 4, 120, 0.4, 4, 'smoke');
  A().sfx('cannon');
}
function updateMapw(dt) {
  const P = G.p;
  if (G.endT === undefined) {
    G.mapwT -= dt;
    if (G.mapwT <= 0) { G.mapwT = U.rand(60, 85); if (G.mapw.filter(m => !m.dead).length < 2) spawnMapw(); }
  }
  const ls = lvlScale(), might = G.stats.might;
  for (const mw of G.mapw) {
    if (mw.dead) continue;
    mw.t += dt;
    if (mw.flash > 0) mw.flash -= dt;
    if (!mw.mounted) {
      continue;
    }
    mw.energy -= dt;
    if (mw.energy <= 0) { F.dismount(true); continue; }
    mw.fireT -= dt;
    mw.firing = false;
    if (mw.kind === 'cannon') {
      if (!mw.manual) { const t = nearestTarget(mw.x, mw.y, 520); if (t) mw.aim = turn(mw.aim, Math.atan2(t.y - mw.y, t.x - mw.x), 9 * dt); }
      if (mw.fireT <= 0) { mw.fireT = 0.5; fireShell(mw, mw.aim, 48 * might * ls, 78); mw.recoil = 1; }
    } else if (mw.kind === 'flamer') {
      if (!mw.manual) { const t = nearestTarget(mw.x, mw.y, 230); if (t) mw.aim = turn(mw.aim, Math.atan2(t.y - mw.y, t.x - mw.x), 7 * dt); }
      mw.firing = true;
      const ca = Math.cos(mw.aim), sa = Math.sin(mw.aim), ox = mw.x + ca * 26, oy = mw.y + sa * 26 - 8;
      for (let i = 0; i < 3; i++) {
        if (!V().room(0.85)) break;
        const a = mw.aim + U.rand(-0.32, 0.32), s = U.rand(320, 440);
        V().p('fire', ox, oy, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.35, 0.5), U.rand(9, 15), Math.random() < 0.5 ? '#ff7a2a' : '#ffd24a', { drag: 1.6, grow: 18 });
      }
      mw.tick -= dt;
      if (mw.tick <= 0) {
        mw.tick = 0.12;
        const Co = C(), R = 205, list = Co.query(mw.x, mw.y, R + 36).slice();
        for (const b of G.bigs) if (list.indexOf(b) < 0) list.push(b);
        Co.src = 'mapw';
        for (const e of list) {
          if (e.dead) continue;
          const dx = e.x - mw.x, dy = e.y - mw.y, d = Math.hypot(dx, dy);
          if (d > R + e.r) continue;
          let da = Math.atan2(dy, dx) - mw.aim; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          if (Math.abs(da) > 0.48) continue;
          Co.hurt(e, 10 * might * ls, ca * 50, sa * 50, Math.random() < 0.6);
          e.burn = 0.6;
        }
        Co.src = null;
        A().sfx('flame');
      }
    } else if (mw.kind === 'tank') {
      const Co = C();
      Co.src = 'mapw';
      Co.hitCircle(mw.x, mw.y, 30, 7, 0.35, 24 * might * ls, 380);
      Co.src = null;
      const t = nearestTarget(mw.x, mw.y, 440);
      if (t) mw.tAng = turn(mw.tAng, Math.atan2(t.y - mw.y, t.x - mw.x), 7 * dt);
      if (t && mw.fireT <= 0) { mw.fireT = 0.75; fireShell(mw, mw.tAng, 38 * might * ls, 62); mw.recoil = 1; }
      if (P.moving && V().room(0.6) && Math.random() < 0.4) V().p('smoke', mw.x - Math.cos(mw.ang) * 26, mw.y - Math.sin(mw.ang) * 26 + 6, 0, -10, 0.6, 8, '#6a6058', { grow: 18, a: 0.35 });
    }
    if (mw.recoil > 0) mw.recoil = Math.max(0, mw.recoil - dt * 6);
  }
  // 附近可操控的武器
  let best = null, bd = 56;
  if (!G.mount) for (const mw of G.mapw) {
    if (mw.dead) continue;
    const d = Math.hypot(P.x - mw.x, P.y - mw.y);
    if (d < bd) { bd = d; best = mw; }
  }
  G.near = best;
}
F.toggleMount = function () {
  if (G.state !== 'play') return;
  if (G.mount) { F.dismount(false); return; }
  const mw = G.near;
  if (!mw || G.p.dashT > 0) return;
  G.mount = mw; mw.mounted = true;
  const P = G.p;
  if (mw.kind === 'tank') { P.x = mw.x; P.y = mw.y; }
  else { mw.aim = P.face > 0 ? 0 : Math.PI; }
  A().sfx('pick');
  UI().toast('操控「' + SF.MAPW[mw.kind].name + '」');
};
F.dismount = function (broken) {
  const mw = G.mount, P = G.p;
  if (!mw) return;
  G.mount = null; mw.mounted = false; mw.firing = false;
  P.inv = Math.max(P.inv, 0.8);
  if (broken) {
    mw.dead = true;
    V().explosion(mw.x, mw.y, 50, ['#ff8a3a', '#ffd24a'], { smoke: '#3a3030' });
    UI().toast('「' + SF.MAPW[mw.kind].name + '」已' + (mw.kind === 'tank' && mw.hp <= 0 ? '被摧毁' : '耗尽能量'));
    A().sfx('explode');
  }
  if (mw.kind !== 'tank') P.y = mw.y + 34;
};
// 玩家受伤前的修正：返回最终伤害（0 表示被吸收）
F.onPlayerHurt = function (dmg) {
  if (G.chal && G.chal.id === 'nohit' && !G.chal.done) failChal();
  const mw = G.mount;
  if (mw && mw.kind === 'tank') {
    mw.hp -= dmg; mw.flash = 0.12;
    if (mw.hp <= 0) F.dismount(true);
    return 0;
  }
  if (mw) return dmg * 0.6;
  return dmg;
};

/* ======================= 局内挑战 ======================= */
function strongestEnemy() {
  let id = G.waveDefs[0].e;
  for (const w of G.waveDefs) if (G.time >= w.t0) id = w.e;
  return id;
}
function spawnElite(isChal) {
  const pt = C().ringPos(10);
  const e = C().spawnEnemy(strongestEnemy(), pt[0], pt[1], { elite: true });
  if (isChal) e.chal = true;
  return e;
}
function startChal() {
  const pool = CHAL.filter(c => !c.cond || c.cond());
  const def = pickW(pool), o = def.make(), rw = pickW(REWARD);
  G.chal = { id: def.id, n: o.n, t: o.t, left: o.t, p: 0, done: false, txt: def.txt(o), reward: rw.id, rtxt: rw.txt };
  UI().banner('📜 新挑战：' + G.chal.txt, 2200);
  A().sfx('warn');
}
function giveReward(id) {
  if (id === 'chest') G.chests++;
  else if (id === 'heal') { G.p.hp = Math.min(G.p.maxHp, G.p.hp + G.p.maxHp * 0.5); V().heal(); }
  else if (id === 'gold') G.gold += Math.round(40 * G.stage.goldMul * (1 + G.stats.greed));
  else if (id === 'ult') G.sk.ultCd = 0;
}
function doneChal() {
  const c = G.chal;
  c.done = true; G.run.chal++;
  giveReward(c.reward);
  UI().banner('✔ 挑战完成！获得：' + c.rtxt, 2000);
  A().sfx('levelup');
  V().levelUp();
  G.chalEnd = 1.6; G.chalT = U.rand(32, 46);
}
function failChal() {
  const c = G.chal;
  c.done = true; c.fail = true;
  UI().toast('✘ 挑战失败');
  A().sfx('back');
  G.chalEnd = 1.4; G.chalT = U.rand(32, 46);
}
function updateChal(dt) {
  const c = G.chal;
  if (c) {
    if (c.done) { G.chalEnd -= dt; if (G.chalEnd <= 0) G.chal = null; return; }
    c.left -= dt;
    if (c.id === 'nohit') c.p = c.t - c.left;
    if (c.p >= c.n) { doneChal(); return; }
    if (c.left <= 0) failChal();
    return;
  }
  if (G.endT !== undefined || G.bossRef) return;
  G.chalT -= dt;
  if (G.chalT <= 0) startChal();
}

/* ======================= 后期难度 ======================= */
function updateDifficulty(dt) {
  const st = G.stage, t = G.time;
  if (!G.frenzy && t >= st.bossAt * 0.72) {
    G.frenzy = true;
    UI().banner('⚠ 狂潮来袭！敌人变得更加凶猛', 2600);
    A().sfx('boss');
  }
  if (t >= st.bossAt * 0.5 && G.endT === undefined) {
    G.eliteT -= dt;
    if (G.eliteT <= 0) {
      G.eliteT = G.frenzy ? 22 : 40;
      const n = G.frenzy ? 2 : 1;
      for (let i = 0; i < n; i++) spawnElite(false);
    }
  }
}

/* ======================= 事件钩子 ======================= */
F.onKill = function (e) {
  if (!G.run) return;
  G.run.kills++;
  if (e.lastSrc === 'mapw') { G.run.mapwKills++; if (G.chal && G.chal.id === 'mapw' && !G.chal.done) G.chal.p++; }
  if (e.elite || e.boss) G.run.elites++;
  if (G.sk.ultT <= 0 && G.sk.ultCd > 0) G.sk.ultCd = Math.max(0, G.sk.ultCd - 0.06);
  const c = G.chal;
  if (c && !c.done) {
    if (c.id === 'kill') c.p++;
    else if (c.id === 'elite' && e.chal) c.p++;
  }
};
F.onGem = function () {
  G.run.gems++;
  if (G.chal && G.chal.id === 'gems' && !G.chal.done) G.chal.p++;
};
F.update = function (dt) {
  updateSkills(dt);
  updateMapw(dt);
  updateChal(dt);
  updateDifficulty(dt);
  let j = 0;
  for (const m of G.mapw) if (!m.dead) G.mapw[j++] = m;
  G.mapw.length = j;
};
})(window.SF = window.SF || {});
