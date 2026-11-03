/* 对局核心：实体、碰撞、刷怪、Boss、掉落、升级、结算 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU, Save = SF.Save;
const G = SF.G = { state: 'menu' };
const Game = SF.Game = {};
const Core = SF.Core = {};
SF.view = { hw: 220, hh: 420 };

const MAX_WEAPONS = 6, MAX_PASSIVES = 6;
const CAP_ENEMY = 300, CAP_PROJ = 260, CAP_GEM = 300, CAP_PART = 380, CAP_TEXT = 40, CAP_EPROJ = 220;
const Audio = () => SF.Audio;
const UIx = () => SF.UI;

/* ------------------------- 空间网格 ------------------------- */
const GS = 64, GN = 44;
let gx0 = 0, gy0 = 0;
const gHead = new Int32Array(GN * GN);
const gNext = new Int32Array(2048);
const QR = [];
function buildGrid() {
  const P = G.p;
  gx0 = P.x - GN * GS / 2; gy0 = P.y - GN * GS / 2;
  gHead.fill(-1);
  const arr = G.enemies;
  for (let i = 0; i < arr.length && i < 2048; i++) {
    const e = arr[i];
    if (e.dead) continue;
    const cx = ((e.x - gx0) / GS) | 0, cy = ((e.y - gy0) / GS) | 0;
    if (e.x < gx0 || e.y < gy0 || cx >= GN || cy >= GN) continue;
    const idx = cy * GN + cx;
    gNext[i] = gHead[idx]; gHead[idx] = i;
  }
}
// 返回圆形范围内（含边缘格）的敌人候选；结果为共享数组，须立即使用
function query(x, y, r) {
  QR.length = 0;
  const x0 = Math.max(0, ((x - r - gx0) / GS) | 0), x1 = Math.min(GN - 1, ((x + r - gx0) / GS) | 0);
  const y0 = Math.max(0, ((y - r - gy0) / GS) | 0), y1 = Math.min(GN - 1, ((y + r - gy0) / GS) | 0);
  if (x + r < gx0 || y + r < gy0) return QR;
  const arr = G.enemies;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    for (let j = gHead[cy * GN + cx]; j !== -1; j = gNext[j]) { const e = arr[j]; if (!e.dead) QR.push(e); }
  }
  return QR;
}
Core.query = query;

// 最近的 n 个敌人（共享数组）
const NR = [], ND = [];
Core.nearest = function (n, maxD, fromX, fromY) {
  const P = G.p, px = fromX === undefined ? P.x : fromX, py = fromY === undefined ? P.y : fromY;
  NR.length = 0; ND.length = 0;
  const m2 = maxD * maxD, arr = G.enemies;
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    if (e.dead) continue;
    const dx = e.x - px, dy = e.y - py, d2 = dx * dx + dy * dy;
    if (d2 > m2) continue;
    if (NR.length < n) {
      let j = NR.length; NR.push(e); ND.push(d2);
      while (j > 0 && ND[j - 1] > d2) { NR[j] = NR[j - 1]; ND[j] = ND[j - 1]; j--; }
      NR[j] = e; ND[j] = d2;
    } else if (d2 < ND[n - 1]) {
      let j = n - 1;
      while (j > 0 && ND[j - 1] > d2) { NR[j] = NR[j - 1]; ND[j] = ND[j - 1]; j--; }
      NR[j] = e; ND[j] = d2;
    }
  }
  return NR;
};

/* ------------------------- 通用工具 ------------------------- */
function compact(arr) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) { const o = arr[i]; if (!o.dead) arr[j++] = o; }
  arr.length = j;
}
function burst(x, y, col, n, spd, life, size, k) { SF.VFX.burst(x, y, col, n, spd, life, size, k); }
Core.burst = burst;
function popText(x, y, txt, col, big) {
  if (!Save.data.set.dmg || G.texts.length >= CAP_TEXT) return;
  G.texts.push({ x: x + U.rand(-8, 8), y, txt, col: col || '#fff', life: 0.75, max: 0.75, big: !!big, vx: U.rand(-20, 20) });
}
Core.popText = popText;
function addProj(o) {
  if (G.proj.length >= CAP_PROJ) return null;
  const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, r: 6, dmg: 1, pierce: 0, life: 2, hit: [], slot: 0, kb: 60, dead: false, k: 'bolt', col: '#fff' }, o);
  G.proj.push(p);
  return p;
}
Core.addProj = addProj;
function shootAt(x, y, ang, spd, dmg, col, r) {
  if (G.eproj.length >= CAP_EPROJ) return;
  G.eproj.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: r || 6, dmg, life: 7, col: col || '#ff6a8a', dead: false });
}
Core.shootAt = shootAt;
Core.sfx = n => Audio().sfx(n);
Core.fx = o => { G.fx.push(o); };
Core.shake = v => { G.shake = Math.max(G.shake, v); };

/* ------------------------- 属性 ------------------------- */
function recalc() {
  const S = { might: 0, cd: 0, area: 0, move: 0, hp: 0, hpMul: 0, regen: 0, armor: 0, magnet: 0, growth: 0, greed: 0, luck: 0, amount: 0, revive: 0, reroll: 0, skip: 0 };
  const meta = Save.data.meta;
  for (const id in SF.META) { const lv = meta[id] || 0; if (lv) S[SF.META[id].key] += SF.META[id].per * lv; }
  const m = G.ch.mod;
  for (const k in m) S[k] = (S[k] || 0) + m[k];
  for (const id in G.passives) { const p = SF.PASSIVES[id]; S[p.key] += p.per * G.passives[id]; }
  const st = G.stats || (G.stats = {});
  st.might = 1 + S.might; st.cd = Math.max(0.35, 1 + S.cd); st.area = 1 + S.area; st.move = 1 + S.move;
  const oldMax = G.p.maxHp || 0;
  G.p.maxHp = Math.round((100 + S.hp) * (1 + S.hpMul));
  if (oldMax) G.p.hp = Math.min(G.p.maxHp, G.p.hp + Math.max(0, G.p.maxHp - oldMax)); else G.p.hp = G.p.maxHp;
  st.regen = S.regen; st.armor = S.armor; st.magnet = S.magnet; st.growth = S.growth;
  st.greed = S.greed; st.luck = S.luck; st.amount = S.amount; st.revive = S.revive; st.reroll = S.reroll; st.skip = S.skip;
}
const xpNeed = lv => 4 + (lv - 1) * 5 + Math.floor(Math.pow(lv, 1.7) * 0.5);
Game.xpNeed = xpNeed;

function addWeapon(id) {
  G.weapons.push({ id, lv: 1, evo: false, t: 0.4, s: SF.weaponStats(id, 1), slot: G.weapons.length, a: 0, q: [] });
}

/* ------------------------- 开局 ------------------------- */
Game.start = function (stageId, charId) {
  const st = SF.STAGES[stageId], ch = SF.CHARS[charId];
  const P = { x: 0, y: 0, r: 12, hp: 100, maxHp: 0, face: 1, inv: 0, t: 0, moving: false, vx: 0, vy: 0, dead: false };
  const meta = Save.data.meta;
  Object.assign(G, {
    state: 'play', stage: st, ch, chId: charId, p: P, time: 0, frame: 0, kills: 0, gold: 0, level: 1, xp: 0, xpNeed: xpNeed(1),
    pending: 0, chests: 0, bossKills: 0, enemies: [], bigs: [], proj: [], eproj: [], gems: [], picks: [], parts: [], texts: [], fx: [], zones: [], decals: [],
    weapons: [], passives: {}, shake: 0, hurtFlash: 0, nextId: 1, evIdx: 0, endT: undefined, victory: false, slowmo: 0,
    waveDefs: st.waves(st.w), acc: [], opts: null, bossRef: null, flash: 0, lastGemSfx: 0, damageTaken: 0
  });
  G.acc = G.waveDefs.map(() => 0);
  G.stats = null;
  recalc();
  G.revives = G.stats.revive; G.rerolls = G.stats.reroll; G.skips = G.stats.skip;
  addWeapon(ch.start);
  // 开场预热：少量敌人，避免空等
  for (let i = 0; i < 7; i++) { const pt = edgePoint(Math.random() * TAU, -10 + Math.random() * 40); spawnEnemy(G.waveDefs[0].e, pt[0], pt[1]); }
  SF.Render && SF.Render.onStart && SF.Render.onStart();
  Audio().music('battle');
  UIx().onStart();
};

/* ------------------------- 敌人 ------------------------- */
function spawnEnemy(id, x, y, o) {
  const def = SF.ENEMIES[id], st = G.stage, t = G.time / 60;
  const ts = def.boss ? 1 : 1 + t * 0.25 + t * t * 0.008;
  const hp = def.hp * (def.boss ? Math.sqrt(st.hpMul) : st.hpMul) * ts;
  const e = {
    id: G.nextId++, def, ai: def.ai, x, y, r: def.r, hp, maxHp: hp, spd: def.spd * (0.92 + Math.random() * 0.16),
    dmg: def.dmg * st.dmgMul * (1 + t * 0.06), xp: def.xp * st.xpMul, kx: 0, ky: 0, flash: 0, slow: 1, slowT: 0, stun: 0,
    t: Math.random() * 6, face: 1, hitT: [0, 0, 0, 0, 0, 0], cd: 1 + Math.random() * 2, st: 0, dead: false, boss: !!def.boss,
    elite: false, spr: SF.Sprites.enemy(def), sc: 1, nv: 0, pi: 0, bst: '', bt: 0, spiral: 0, sp: 0, sa: 0, dx: 0, dy: 0, big: false
  };
  if (o && o.elite) { e.elite = true; e.hp = e.maxHp = e.maxHp * 6; e.r *= 1.3; e.sc = 1.3; e.dmg *= 1.3; e.xp *= 6; }
  if (e.r >= 26) { e.big = true; G.bigs.push(e); }
  if (e.boss) { e.hitFlashNone = true; e.cd = 2.5; }
  G.enemies.push(e);
  return e;
}
Core.spawnEnemy = spawnEnemy;
// 沿屏幕外矩形边缘取点（竖屏上也能较快接敌）
function edgePoint(a, extra) {
  const hw = SF.view.hw + 40 + (extra || 0), hh = SF.view.hh + 40 + (extra || 0);
  const c = Math.cos(a), s = Math.sin(a);
  const r = Math.min(hw / Math.max(1e-3, Math.abs(c)), hh / Math.max(1e-3, Math.abs(s)));
  return [G.p.x + c * r, G.p.y + s * r];
}
function ringPos(extra) { return edgePoint(Math.random() * TAU, extra); }

function runEvent(ev) {
  const P = G.p;
  if (ev.k === 'swarm') {
    const a = Math.random() * TAU;
    for (let i = 0; i < ev.n; i++) {
      if (G.enemies.length >= CAP_ENEMY + 40) break;
      const pt = edgePoint(a + U.rand(-0.55, 0.55), U.rand(0, 70));
      spawnEnemy(ev.e, pt[0], pt[1]);
    }
    UIx().banner('⚠ 大群敌人来袭！', 1800);
    Audio().sfx('warn');
  } else if (ev.k === 'ring') {
    const off = Math.random() * TAU;
    for (let i = 0; i < ev.n; i++) {
      if (G.enemies.length >= CAP_ENEMY + 40) break;
      const pt = edgePoint(off + i / ev.n * TAU, 10);
      spawnEnemy(ev.e, pt[0], pt[1]);
    }
    UIx().banner('⚠ 敌人正在包围你！', 1800);
    Audio().sfx('warn');
  } else if (ev.k === 'elite') {
    const [x, y] = ringPos(); spawnEnemy(ev.e, x, y, { elite: true });
    UIx().banner('★ 精英怪出现', 1500);
    Audio().sfx('warn');
  } else if (ev.k === 'boss') {
    const [x, y] = ringPos(30);
    const e = spawnEnemy(ev.e, x, y);
    e.final = !!ev.final;
    UIx().banner('💀 ' + e.def.name + ' 降临！', 2600);
    Audio().sfx('boss'); Audio().music('boss'); G.shake = 8;
  }
}
function director(dt) {
  const st = G.stage, t = G.time;
  if (G.endT !== undefined) return;
  for (let i = 0; i < G.waveDefs.length; i++) {
    const w = G.waveDefs[i];
    if (t < w.t0) continue;
    const k = Math.min(1, (t - w.t0) / Math.max(1, st.bossAt - w.t0));
    G.acc[i] += (w.r0 + (w.r1 - w.r0) * k) * dt * st.rate;
    while (G.acc[i] >= 1) {
      G.acc[i] -= 1;
      if (G.enemies.length < CAP_ENEMY) { const [x, y] = ringPos(Math.random() * 50); spawnEnemy(w.e, x, y); }
    }
  }
  while (G.evIdx < st.events.length && t >= st.events[G.evIdx].t) runEvent(st.events[G.evIdx++]);
}

/* ------------------------- 伤害 ------------------------- */
function hurt(e, dmg, kx, ky, noText) {
  if (e.dead) return;
  let crit = false;
  if (Math.random() < 0.05 + G.stats.luck * 0.5) { crit = true; dmg *= 2; }
  e.hp -= dmg; e.flash = 0.09;
  if (!e.boss) { const k = e.big ? 0.25 : 1; e.kx += kx * k; e.ky += ky * k; }
  if (kx || ky) { const d = Math.hypot(kx, ky) || 1; SF.VFX.hit(e.x - kx / d * e.r * 0.6, e.y - ky / d * e.r * 0.6 - e.r * 0.2, kx, ky, crit ? '#ffd24a' : null); }
  if (!noText) popText(e.x, e.y - e.r, Math.round(dmg), crit ? '#ffd24a' : '#fff', crit);
  Audio().sfx('hit');
  if (e.hp <= 0) kill(e);
}
Core.hurt = hurt;
// 圆形范围伤害（按武器槽位的命中冷却）
Core.hitCircle = function (x, y, r, slot, interval, dmg, kb, onHit) {
  const list = query(x, y, r + 34);
  let n = 0;
  const test = (e) => {
    if (e.dead) return;
    const dx = e.x - x, dy = e.y - y, rr = r + e.r;
    if (dx * dx + dy * dy > rr * rr) return;
    if (e.hitT[slot] > G.time) return;
    e.hitT[slot] = G.time + interval;
    const d = Math.hypot(dx, dy) || 1;
    hurt(e, dmg, dx / d * kb, dy / d * kb);
    if (onHit) onHit(e);
    n++;
  };
  for (let i = 0; i < list.length; i++) test(list[i]);
  const bigs = G.bigs;
  for (let i = 0; i < bigs.length; i++) if (!bigs[i].dead) test(bigs[i]);
  return n;
};
Core.blockBullets = function (x, y, r) {
  const arr = G.eproj;
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    if (b.dead) continue;
    const dx = b.x - x, dy = b.y - y, rr = r + b.r;
    if (dx * dx + dy * dy < rr * rr) { b.dead = true; burst(b.x, b.y, b.col, 3, 60, 0.25, 2); }
  }
};

function hurtPlayer(dmg) {
  const P = G.p;
  if (P.inv > 0 || P.dead || G.endT !== undefined) return;
  dmg = Math.max(1, Math.round(dmg - G.stats.armor));
  P.hp -= dmg; P.inv = 0.5; G.hurtFlash = 1; G.shake = Math.max(G.shake, 5); G.damageTaken += dmg;
  popText(P.x, P.y - 24, '-' + dmg, '#ff6a7a', true);
  Audio().sfx('hurt');
  if (Save.data.set.vib && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* 忽略 */ } }
  burst(P.x, P.y, '#ff4a5a', 8, 120, 0.4, 3);
  if (P.hp <= 0) die();
}
function healPlayer(v) {
  const P = G.p;
  P.hp = Math.min(P.maxHp, P.hp + v);
  popText(P.x, P.y - 24, '+' + Math.round(v), '#7aff9a', true);
  SF.VFX.heal();
  Audio().sfx('heal');
}
function die() {
  const P = G.p;
  if (G.revives > 0) {
    G.revives--;
    P.hp = Math.round(P.maxHp * 0.5); P.inv = 3; G.hurtFlash = 0;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
      if (d < 320) { if (e.boss) continue; e.kx += dx / d * 700; e.ky += dy / d * 700; e.stun = 0.6; }
    }
    for (const b of G.eproj) b.dead = true;
    G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 10, max: 320, life: 0.6, T: 0.6, col: '#ffe08a', follow: true });
    SF.VFX.levelUp();
    UIx().banner('🪶 凤凰羽复活！', 1800);
    Audio().sfx('levelup');
    return;
  }
  P.dead = true;
  Audio().sfx('lose');
  finish(false);
}

/* ------------------------- 击杀与掉落 ------------------------- */
function dropGem(x, y, v) {
  v = Math.max(1, Math.round(v));
  if (G.gems.length >= CAP_GEM) {
    const g = G.gems[(Math.random() * G.gems.length) | 0];
    if (g && !g.dead) { g.v += v; g.tier = g.v >= 20 ? 2 : g.v >= 5 ? 1 : 0; return; }
  }
  G.gems.push({ x: x + U.rand(-5, 5), y: y + U.rand(-5, 5), v, tier: v >= 20 ? 2 : v >= 5 ? 1 : 0, mag: false, sp: 0, dead: false, t: Math.random() * 6 });
}
function dropPick(k, x, y, v) {
  G.picks.push({ k, x, y, v: v || 0, dead: false, t: 0, life: k === 'chest' ? 9999 : 40 });
}
function dropLoot(e) {
  const luck = 1 + G.stats.luck;
  dropGem(e.x, e.y, e.xp);
  const r = Math.random();
  if (r < 0.075 * luck) dropPick('coin', e.x + U.rand(-8, 8), e.y + U.rand(-8, 8), Math.max(1, Math.round(G.stage.goldMul * U.rand(1, 4))));
  else if (r < 0.075 * luck + 0.008 * luck) dropPick('heart', e.x, e.y);
  else if (r < 0.075 * luck + 0.008 * luck + 0.003) dropPick('magnet', e.x, e.y);
  else if (r < 0.075 * luck + 0.008 * luck + 0.003 + 0.0025) dropPick('bomb', e.x, e.y);
  if (e.elite) {
    if (Math.random() < 0.7) dropPick('chest', e.x, e.y);
    for (let i = 0; i < 4; i++) dropPick('coin', e.x + U.rand(-26, 26), e.y + U.rand(-26, 26), Math.max(1, Math.round(G.stage.goldMul * U.rand(2, 4))));
  }
}
function kill(e) {
  if (e.dead) return;
  e.dead = true; G.kills++;
  const col = e.def.c1;
  if (e.boss) {
    G.bossKills++;
    SF.VFX.explosion(e.x, e.y, e.r * 2.2, [e.def.c2, '#ffffff'], { debris: col });
    burst(e.x, e.y, col, 24, 300, 0.9, 5, 'shard'); SF.VFX.sparkle(e.x, e.y, '#ffffff', 14);
    G.shake = 12; Audio().sfx('explode');
    dropPick('chest', e.x, e.y);
    for (let i = 0; i < 12; i++) dropPick('coin', e.x + U.rand(-50, 50), e.y + U.rand(-50, 50), Math.max(1, Math.round(G.stage.goldMul * U.rand(2, 5))));
    for (let i = 0; i < 8; i++) dropGem(e.x + U.rand(-50, 50), e.y + U.rand(-50, 50), 25 * G.stage.xpMul);
    G.fx.push({ k: 'ring', x: e.x, y: e.y, r: 10, max: 400, life: 0.7, T: 0.7, col: '#ffffff' });
    for (const b of G.eproj) b.dead = true;
    if (e.final) {
      G.victory = true; G.endT = 2.4; G.slowmo = 1;
      for (const o of G.enemies) if (!o.dead && o !== e) { o.dead = true; SF.VFX.death(o); }
      UIx().banner('🏆 胜利！', 2400);
      Audio().sfx('win');
    } else {
      Audio().music('battle');
      UIx().banner('Boss 已被击败！', 1800);
    }
    return;
  }
  SF.VFX.death(e);
  if (e.elite) SF.VFX.sparkle(e.x, e.y, '#ffd24a', 12);
  Audio().sfx('kill');
  if (e.ai === 'bomber') explodeBomber(e);
  dropLoot(e);
}
function explodeBomber(e) {
  const P = G.p, R = 64;
  SF.VFX.explosion(e.x, e.y, R * 0.8, [e.def.c1, '#ffd24a']);
  Audio().sfx('explode');
  if (Math.hypot(P.x - e.x, P.y - e.y) < R + P.r) hurtPlayer(e.dmg);
}

/* ------------------------- Boss 招式 ------------------------- */
function bossAttack(e, pat, ph2) {
  const P = G.p, def = e.def;
  const bd = e.dmg * 0.5;
  const toP = Math.atan2(P.y - e.y, P.x - e.x);
  if (pat === 'ring') {
    const n = ph2 ? 24 : 16, off = Math.random() * TAU;
    for (let i = 0; i < n; i++) shootAt(e.x, e.y, off + i / n * TAU, 120, bd, def.c2, 7);
    Audio().sfx('shoot');
  } else if (pat === 'aim') {
    const n = ph2 ? 7 : 5;
    for (let i = 0; i < n; i++) shootAt(e.x, e.y, toP + (i - (n - 1) / 2) * 0.2, 175, bd, def.c2, 7);
    Audio().sfx('shoot');
  } else if (pat === 'spiral') {
    e.spiral = 2.2; e.sp = 0; e.sa = Math.random() * TAU;
  } else if (pat === 'summon') {
    const n = ph2 ? 9 : 6;
    for (let i = 0; i < n; i++) {
      if (G.enemies.length >= CAP_ENEMY + 30) break;
      const a = i / n * TAU;
      spawnEnemy(def.minion, e.x + Math.cos(a) * (e.r + 24), e.y + Math.sin(a) * (e.r + 24));
    }
    burst(e.x, e.y, def.c2, 14, 160, 0.5, 3);
  } else if (pat === 'dash') {
    e.bst = 'tele'; e.bt = 0.75;
  } else if (pat === 'slam') {
    G.fx.push({ k: 'slam', x: e.x, y: e.y, r: e.r + 120, t: 1.0, T: 1.0, dmg: e.dmg * 1.1, owner: e, col: def.c2 });
  }
}
function bossAI(e, dt, dx, dy, d) {
  const def = e.def, ph2 = e.hp < e.maxHp * 0.5;
  let vx = 0, vy = 0;
  if (e.spiral > 0) {
    e.spiral -= dt; e.sp -= dt;
    if (e.sp <= 0) {
      e.sp = ph2 ? 0.06 : 0.08; e.sa += 0.42;
      shootAt(e.x, e.y, e.sa, 140, e.dmg * 0.45, def.c2, 6);
      if (ph2) shootAt(e.x, e.y, e.sa + Math.PI, 140, e.dmg * 0.45, def.c2, 6);
    }
  }
  if (e.bst === 'tele') {
    e.bt -= dt; e.flash = 0.05;
    if (e.bt <= 0) { e.bst = 'dash'; e.bt = 0.75; e.dx = dx / d; e.dy = dy / d; }
  } else if (e.bst === 'dash') {
    e.bt -= dt; vx = e.dx * 400; vy = e.dy * 400;
    if (e.bt <= 0) { e.bst = ''; e.cd = 0.9; }
  } else {
    const sp = e.spd * (e.slowT > 0 ? e.slow : 1);
    if (d > e.r + 70) { vx = dx / d * sp; vy = dy / d * sp; }
    e.cd -= dt;
    if (e.cd <= 0) {
      bossAttack(e, def.pat[e.pi % def.pat.length], ph2); e.pi++;
      e.cd = def.cd * (ph2 ? 0.7 : 1);
    }
  }
  return [vx, vy];
}

/* ------------------------- 更新：敌人 ------------------------- */
function updateEnemies(dt) {
  const P = G.p, arr = G.enemies, n = arr.length, frame = G.frame;
  for (let i = 0; i < n; i++) {
    const e = arr[i];
    if (e.dead) continue;
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.slowT > 0) e.slowT -= dt;
    if (e.stun > 0) e.stun -= dt;
    let dx = P.x - e.x, dy = P.y - e.y;
    let d = Math.hypot(dx, dy);
    if (d < 0.001) { d = 0.001; dx = 0.001; }
    if (Math.abs(dx) > 3) e.face = dx > 0 ? 1 : -1;
    // 过远则传送回环带，保证密度
    if (!e.boss && d > 880) { const [x, y] = ringPos(); e.x = x; e.y = y; continue; }
    const sp = e.spd * (e.slowT > 0 ? e.slow : 1);
    let vx = 0, vy = 0;
    const ai = e.ai;
    if (e.stun > 0) { /* 眩晕 */ }
    else if (ai === 'boss') { const v = bossAI(e, dt, dx, dy, d); vx = v[0]; vy = v[1]; }
    else if (ai === 'sine') {
      const a = Math.atan2(dy, dx) + Math.sin(e.t * 4 + e.id) * 0.9;
      vx = Math.cos(a) * sp; vy = Math.sin(a) * sp;
    } else if (ai === 'ranged' || ai === 'mage') {
      const keep = ai === 'ranged' ? 230 : 260;
      if (d > keep + 30) { vx = dx / d * sp; vy = dy / d * sp; }
      else if (d < keep - 60) { vx = -dx / d * sp * 0.9; vy = -dy / d * sp * 0.9; }
      else { vx = -dy / d * sp * 0.35; vy = dx / d * sp * 0.35; }
      e.cd -= dt;
      if (e.cd <= 0 && d < 470) {
        const s = e.def.shoot, a = Math.atan2(dy, dx);
        for (let k = 0; k < s.n; k++) shootAt(e.x, e.y, a + (k - (s.n - 1) / 2) * s.spread, s.spd, e.dmg * (s.dmg / e.def.dmg) * 0.9, e.def.c2, 5);
        e.cd = s.cd * U.rand(0.85, 1.15);
      }
    } else if (ai === 'charger') {
      if (e.st === 0) {
        vx = dx / d * sp; vy = dy / d * sp; e.cd -= dt;
        if (e.cd <= 0 && d < 380) { e.st = 1; e.bt = 0.6; }
      } else if (e.st === 1) {
        e.bt -= dt; e.flash = 0.04;
        if (e.bt <= 0) { e.st = 2; e.bt = 0.65; e.dx = dx / d; e.dy = dy / d; }
      } else {
        e.bt -= dt; vx = e.dx * 330; vy = e.dy * 330;
        if (e.bt <= 0) { e.st = 0; e.cd = U.rand(2.2, 3.6); }
      }
    } else { vx = dx / d * sp; vy = dy / d * sp; }

    // 击退衰减
    e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
    const decay = Math.min(1, dt * 7); e.kx -= e.kx * decay; e.ky -= e.ky * decay;

    // 软分离（错帧处理）
    if (!e.boss && ((frame + e.id) % 3) === 0) {
      const list = query(e.x, e.y, e.r + 8);
      let c = 0;
      for (let k = 0; k < list.length && c < 4; k++) {
        const o = list[k];
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y, rr = (e.r + o.r) * 0.85, od2 = ox * ox + oy * oy;
        if (od2 < rr * rr && od2 > 0.01) {
          const od = Math.sqrt(od2), push = (rr - od) * (o.big ? 0.8 : 0.4);
          e.x += ox / od * push; e.y += oy / od * push; c++;
        }
      }
    }
    // 接触伤害
    if (d < e.r + P.r * 0.85) {
      if (ai === 'bomber') kill(e);
      else hurtPlayer(e.dmg);
    }
  }
}

/* ------------------------- 更新：弹体 ------------------------- */
function updateProj(dt) {
  const arr = G.proj;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.dead) continue;
    p.life -= dt;
    if (p.life <= 0) { p.dead = true; continue; }
    if (p.upd) p.upd(p, dt); else { p.x += p.vx * dt; p.y += p.vy * dt; }
    if (p.dead) continue;
    const list = query(p.x, p.y, p.r + 36);
    let stop = false;
    const test = (e) => {
      if (stop || e.dead) return;
      const dx = e.x - p.x, dy = e.y - p.y, rr = p.r + e.r;
      if (dx * dx + dy * dy > rr * rr) return;
      if (p.rehit) { if (e.hitT[p.slot] > G.time) return; e.hitT[p.slot] = G.time + p.rehit; }
      else { if (p.hit.indexOf(e.id) !== -1) return; p.hit.push(e.id); }
      const sp = Math.hypot(p.vx, p.vy) || 1;
      hurt(e, p.dmg, p.vx / sp * p.kb, p.vy / sp * p.kb);
      if (p.onHit) p.onHit(p, e);
      if (!p.rehit) { if (p.pierce <= 0) { p.dead = true; stop = true; } else p.pierce--; }
    };
    for (let k = 0; k < list.length; k++) test(list[k]);
    const bigs = G.bigs;
    for (let k = 0; k < bigs.length; k++) test(bigs[k]);
  }
}
function updateEProj(dt) {
  const P = G.p, arr = G.eproj;
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    if (b.dead) continue;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const dx = b.x - P.x, dy = b.y - P.y, rr = b.r + P.r * 0.8;
    if (dx * dx + dy * dy < rr * rr) { hurtPlayer(b.dmg); b.dead = true; burst(b.x, b.y, b.col, 4, 80, 0.3, 2); }
  }
}

/* ------------------------- 更新：拾取物 ------------------------- */
function addXp(v) {
  G.xp += v * (1 + G.stats.growth);
  while (G.xp >= G.xpNeed) {
    G.xp -= G.xpNeed; G.level++; G.xpNeed = xpNeed(G.level); G.pending++;
  }
}
function updatePickups(dt) {
  const P = G.p, magR = 90 * (1 + G.stats.magnet), m2 = magR * magR;
  const gems = G.gems;
  for (let i = 0; i < gems.length; i++) {
    const g = gems[i];
    if (g.dead) continue;
    const dx = P.x - g.x, dy = P.y - g.y, d2 = dx * dx + dy * dy;
    if (!g.mag && d2 < m2) g.mag = true;
    if (g.mag) {
      g.sp = Math.min(900, g.sp + 1800 * dt);
      const d = Math.sqrt(d2) || 1;
      g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt;
      if (d < P.r + 8) {
        g.dead = true; addXp(g.v);
        if (G.time - G.lastGemSfx > 0.04) { Audio().sfx('gem'); G.lastGemSfx = G.time; }
      }
    }
  }
  const picks = G.picks;
  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    if (p.dead) continue;
    p.t += dt;
    if (p.k !== 'chest') { p.life -= dt; if (p.life <= 0) { p.dead = true; continue; } }
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (p.k === 'coin' && d < magR) { p.x += dx / d * 520 * dt; p.y += dy / d * 520 * dt; }
    if (d < P.r + 14) {
      p.dead = true;
      if (p.k === 'coin') { const v = Math.max(1, Math.round(p.v * (1 + G.stats.greed))); G.gold += v; Audio().sfx('coin'); SF.VFX.sparkle(p.x, p.y, '#ffd24a', 3); popText(P.x, P.y - 26, '+' + v, '#ffd24a'); }
      else if (p.k === 'heart') healPlayer(Math.round(G.p.maxHp * 0.3));
      else if (p.k === 'magnet') { for (const g of gems) g.mag = true; Audio().sfx('magnet'); UIx().toast('🧲 吸附全屏经验'); }
      else if (p.k === 'bomb') {
        for (const e of G.enemies) {
          if (e.dead) continue;
          if (Math.abs(e.x - P.x) < SF.view.hw + 30 && Math.abs(e.y - P.y) < SF.view.hh + 30) hurt(e, 220, 0, 0, true);
        }
        G.flash = 1; G.shake = 10; Audio().sfx('explode'); UIx().toast('💣 屏幕爆炸！');
      } else if (p.k === 'chest') { G.chests++; Audio().sfx('chest'); }
    }
  }
}

/* ------------------------- 更新：特效/区域 ------------------------- */
function updateFx(dt) {
  const P = G.p, arr = G.fx;
  for (let i = 0; i < arr.length; i++) {
    const f = arr[i];
    if (f.dead) continue;
    if (f.k === 'meteor') {
      f.t -= dt;
      if (f.t <= 0) {
        f.dead = true;
        const list = query(f.x, f.y, f.r + 36);
        const test = e => {
          if (e.dead) return;
          const dx = e.x - f.x, dy = e.y - f.y, rr = f.r + e.r;
          if (dx * dx + dy * dy < rr * rr) { const d = Math.hypot(dx, dy) || 1; hurt(e, f.dmg, dx / d * 260, dy / d * 260); e.hitT[f.slot] = 0; }
        };
        for (let k = 0; k < list.length; k++) test(list[k]);
        for (let k = 0; k < G.bigs.length; k++) test(G.bigs[k]);
        SF.VFX.explosion(f.x, f.y, f.r, f.evo ? ['#ff3a6a', '#ffb0f0'] : ['#ff7a2a', '#ffd24a']);
        G.shake = Math.max(G.shake, 4); Audio().sfx('explode');
      }
    } else if (f.k === 'nova') {
      f.r += f.sp * dt;
      if (f.follow !== false) { f.x = P.x; f.y = P.y; }
      const list = query(f.x, f.y, f.r + 36);
      const test = e => {
        if (e.dead || e.nv === f.id) return;
        const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy) || 1;
        if (d - e.r <= f.r) {
          e.nv = f.id; hurt(e, f.dmg, dx / d * 320, dy / d * 320);
          e.slow = f.slowMul; e.slowT = f.slowT;
        }
      };
      for (let k = 0; k < list.length; k++) test(list[k]);
      for (let k = 0; k < G.bigs.length; k++) test(G.bigs[k]);
      if (f.r >= f.max) f.dead = true;
    } else if (f.k === 'slam') {
      f.t -= dt;
      if (f.owner && f.owner.dead) { f.dead = true; continue; }
      if (f.t <= 0) {
        f.dead = true;
        if (Math.hypot(P.x - f.x, P.y - f.y) < f.r + P.r * 0.5) hurtPlayer(f.dmg);
        SF.VFX.explosion(f.x, f.y, f.r * 0.75, [f.col, '#ffffff'], { smoke: '#4a4040' });
        G.shake = Math.max(G.shake, 7); Audio().sfx('slam');
        const n = 10;
        for (let k = 0; k < n; k++) shootAt(f.x, f.y, k / n * TAU, 130, f.dmg * 0.35, f.col, 6);
      }
    } else if (f.k === 'ring' || f.k === 'bolt' || f.k === 'beam' || f.k === 'pillar') {
      f.life -= dt;
      if (f.follow) { f.x = P.x; f.y = P.y; }
      if (f.life <= 0) f.dead = true;
    }
  }
  // 毒池
  const zs = G.zones;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    z.t -= dt;
    if (z.t <= 0) { z.dead = true; continue; }
    const list = query(z.x, z.y, z.r + 36);
    const test = e => {
      if (e.dead) return;
      const dx = e.x - z.x, dy = e.y - z.y, rr = z.r + e.r * 0.6;
      if (dx * dx + dy * dy > rr * rr) return;
      e.slow = 0.6; e.slowT = Math.max(e.slowT, 0.25);
      if (e.hitT[z.slot] <= G.time) { e.hitT[z.slot] = G.time + 0.5; hurt(e, z.dmg, 0, 0); }
    };
    for (let k = 0; k < list.length; k++) test(list[k]);
    for (let k = 0; k < G.bigs.length; k++) test(G.bigs[k]);
    if (Math.random() < dt * 6 && SF.VFX.room(0.6)) { const a = Math.random() * TAU, rr = Math.random() * z.r * 0.8; SF.VFX.p('smoke', z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr * 0.7, 0, -24, 0.9, z.r * 0.35, z.evo ? '#b06aff' : '#7ad84a', { grow: z.r * 0.4, drag: 1, a: 0.35 }); }
  }
}
function updateParts(dt) {
  SF.VFX.update(dt);
  const ts = G.texts;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    t.life -= dt; t.y -= 42 * dt; t.x += t.vx * dt;
    if (t.life <= 0) t.dead = true;
  }
}

/* ------------------------- 升级选项 ------------------------- */
Game.makeOptions = function (n) {
  const pool = [];
  const passCount = Object.keys(G.passives).length;
  for (const w of G.weapons) {
    if (w.lv < SF.MAX_WLV) pool.push({ type: 'w', id: w.id, lv: w.lv + 1, wt: 1.2 });
    else if (!w.evo && G.passives[SF.WEAPONS[w.id].evo.need] > 0) pool.push({ type: 'evo', id: w.id, lv: w.lv, wt: 5 });
  }
  if (G.weapons.length < MAX_WEAPONS) for (const id in SF.WEAPONS) if (!G.weapons.some(w => w.id === id)) pool.push({ type: 'wn', id, lv: 1, wt: 0.9 });
  for (const id in G.passives) if (G.passives[id] < SF.PASSIVES[id].max) pool.push({ type: 'p', id, lv: G.passives[id] + 1, wt: 1 });
  if (passCount < MAX_PASSIVES) for (const id in SF.PASSIVES) if (!(id in G.passives)) pool.push({ type: 'pn', id, lv: 1, wt: 0.8 });
  const out = [];
  while (out.length < n && pool.length) {
    let tot = 0; for (const o of pool) tot += o.wt;
    let r = Math.random() * tot, idx = 0;
    for (; idx < pool.length; idx++) { r -= pool[idx].wt; if (r <= 0) break; }
    idx = Math.min(idx, pool.length - 1);
    out.push(pool.splice(idx, 1)[0]);
  }
  if (!out.length) {
    out.push({ type: 'heal', id: 'heal', lv: 0 });
    out.push({ type: 'gold', id: 'gold', lv: 0 });
  }
  return out;
};
Game.applyOption = function (o) {
  if (o.type === 'w') { const w = G.weapons.find(x => x.id === o.id); if (w && w.lv < SF.MAX_WLV) { w.lv++; w.s = SF.weaponStats(w.id, w.lv, w.evo); } }
  else if (o.type === 'evo') {
    const w = G.weapons.find(x => x.id === o.id);
    if (w && !w.evo) { w.evo = true; w.s = SF.weaponStats(w.id, w.lv, true); G.flash = 0.8; UIx().banner('✨ ' + SF.WEAPONS[w.id].evo.name + ' · 武器进化！', 2200); }
  }
  else if (o.type === 'wn') { if (G.weapons.length < MAX_WEAPONS && !G.weapons.some(x => x.id === o.id)) addWeapon(o.id); }
  else if (o.type === 'p' || o.type === 'pn') {
    const cur = G.passives[o.id] || 0;
    if (cur < SF.PASSIVES[o.id].max && (cur > 0 || Object.keys(G.passives).length < MAX_PASSIVES)) { G.passives[o.id] = cur + 1; recalc(); }
  }
  else if (o.type === 'heal') healPlayer(G.p.maxHp * 0.4);
  else if (o.type === 'gold') { G.gold += Math.round(40 * G.stage.goldMul); popText(G.p.x, G.p.y - 30, '+金币', '#ffd24a', true); }
};
function openLevelUp() {
  G.state = 'levelup';
  G.opts = Game.makeOptions(G.stats.luck >= 0.35 ? 4 : 3);
  Audio().sfx('levelup');
  UIx().showLevelUp(G.opts);
}
Game.pick = function (i) {
  if (G.state !== 'levelup') return;
  Game.applyOption(G.opts[i]);
  G.pending = Math.max(0, G.pending - 1);
  G.state = 'play'; G.opts = null;
  Audio().sfx('pick');
  SF.VFX.levelUp();
  UIx().hideModal();
  UIx().refreshItems();
};
Game.reroll = function () {
  if (G.state !== 'levelup' || G.rerolls <= 0) return;
  G.rerolls--;
  G.opts = Game.makeOptions(G.stats.luck >= 0.35 ? 4 : 3);
  UIx().showLevelUp(G.opts);
};
Game.skipLevel = function () {
  if (G.state !== 'levelup' || G.skips <= 0) return;
  G.skips--; G.pending = Math.max(0, G.pending - 1);
  G.gold += Math.round(15 * G.stage.goldMul);
  G.state = 'play'; G.opts = null;
  UIx().hideModal();
};
function openChest() {
  G.state = 'levelup'; G.chests--;
  const opts = Game.makeOptions(3).filter(o => o.type !== 'heal' && o.type !== 'gold');
  const list = [];
  for (const o of opts) { Game.applyOption(o); list.push(o); }
  const gold = Math.round(30 * G.stage.goldMul * (1 + G.stats.greed));
  G.gold += gold;
  G.opts = null; G.chestMode = true;
  Audio().sfx('chest');
  UIx().showChest(list, gold);
}
Game.closeChest = function () {
  G.chestMode = false; G.state = 'play';
  UIx().hideModal(); UIx().refreshItems();
};

/* ------------------------- 主更新 ------------------------- */
function updatePlayer(dt) {
  const P = G.p, v = SF.Input.vec();
  const sp = 150 * G.stats.move;
  P.vx = v[0] * sp; P.vy = v[1] * sp;
  P.x += P.vx * dt; P.y += P.vy * dt;
  P.moving = (v[0] !== 0 || v[1] !== 0);
  if (Math.abs(v[0]) > 0.1) P.face = v[0] > 0 ? 1 : -1;
  P.t += dt;
  if (P.inv > 0) P.inv -= dt;
  if (G.hurtFlash > 0) G.hurtFlash -= dt * 2.5;
  if (G.stats.regen > 0 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + G.stats.regen * dt);
}
Game.update = function (dt) {
  if (G.state !== 'play') return;
  if (G.pending > 0) { openLevelUp(); return; }
  if (G.chests > 0) { openChest(); return; }
  if (G.slowmo) dt *= 0.45;
  if (G.endT !== undefined) {
    G.endT -= dt;
    if (G.endT <= 0) { finish(true); return; }
  }
  G.time += dt; G.frame++;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.flash > 0) G.flash -= dt * 2;
  updatePlayer(dt);
  director(dt);
  buildGrid();
  for (let i = 0; i < G.weapons.length; i++) SF.WL.update(G.weapons[i], dt);
  updateProj(dt);
  updateEnemies(dt);
  updateEProj(dt);
  updatePickups(dt);
  updateFx(dt);
  updateParts(dt);
  compact(G.enemies); compact(G.bigs); compact(G.proj); compact(G.eproj);
  compact(G.gems); compact(G.picks); compact(G.fx); compact(G.zones);
  compact(G.parts); compact(G.texts); compact(G.decals);
  // Boss 血条引用
  let b = null;
  for (let i = 0; i < G.bigs.length; i++) if (G.bigs[i].boss && !G.bigs[i].dead) { b = G.bigs[i]; break; }
  G.bossRef = b;
};

/* ------------------------- 暂停 / 结算 ------------------------- */
Game.pause = function () {
  if (G.state !== 'play') return false;
  G.state = 'paused'; SF.Audio.sfx('back'); UIx().showPause(); return true;
};
Game.resume = function () {
  if (G.state !== 'paused') return;
  G.state = 'play'; UIx().hideModal();
};
Game.quit = function () {
  if (G.state === 'over') return;
  finish(false, true);
};
function finish(win, quit) {
  if (G.state === 'over') return;
  G.state = 'over';
  const d = Save.data, st = G.stage, t = G.time;
  const bonus = Math.floor(G.kills / 10) + Math.floor(t / 8);
  let total = G.gold + bonus;
  if (win) total = Math.round(total * 1.5) + 100 * st.diff;
  d.gold += total; d.totalGold += total; d.kills += G.kills; d.runs++; d.bosses += G.bossKills; d.playTime += t;
  d.bestLv = Math.max(d.bestLv, G.level);
  d.best[st.id] = Math.max(d.best[st.id] || 0, Math.floor(t));
  let unlocked = null;
  if (win) {
    d.wins++; d.best[st.id + '_win'] = 1;
    const i = SF.STAGE_ORDER.indexOf(st.id), nx = SF.STAGE_ORDER[i + 1];
    if (nx && !d.stages.includes(nx)) { d.stages.push(nx); unlocked = SF.STAGES[nx]; }
  }
  d.sel.stage = st.id;
  const ctx = Object.assign({}, d);
  ctx.bestTime = 0; for (const id of SF.STAGE_ORDER) ctx.bestTime = Math.max(ctx.bestTime, d.best[id] || 0);
  const newAch = [];
  for (const a of SF.ACHS) {
    if (!d.ach[a.id] && a.chk(ctx)) { d.ach[a.id] = 1; d.gold += a.gold; d.totalGold += a.gold; newAch.push(a); ctx.totalGold = d.totalGold; ctx.chars = d.chars; }
  }
  Save.save();
  Audio().music(null);
  if (!win && !quit) { /* 失败音效已播放 */ }
  UIx().showResult({ win, quit: !!quit, time: t, kills: G.kills, level: G.level, gold: G.gold, bonus, total, newAch, stage: st, unlocked, bosses: G.bossKills });
}
})(window.SF = window.SF || {});
