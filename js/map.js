/* 有限地图：地形生成、碰撞、流场寻路、特殊区域 */
(function (SF) {
'use strict';
const U = SF.U, TAU = U.TAU, G = SF.G;
const M = SF.Map = {};
let map = null;
M.get = () => map;

function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
const clamp = U.clamp;

/* ======================= 形状 ======================= */
// 实体障碍 solids（阻挡所有地面单位）/ 液体 liquids（阻挡地面单位，飞行单位可越过）
// c: 圆 {x,y,r} / r: 矩形 {x,y,w,h} / s: 胶囊 {x1,y1,x2,y2,r}
function aabb(s) {
  if (s.t === 'c') return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
  if (s.t === 'r') return [s.x, s.y, s.x + s.w, s.y + s.h];
  return [Math.min(s.x1, s.x2) - s.r, Math.min(s.y1, s.y2) - s.r, Math.max(s.x1, s.x2) + s.r, Math.max(s.y1, s.y2) + s.r];
}
// 返回与形状的穿透情况：把 o 推出形状外（r 为 o 的半径）
function pushOut(o, r, s) {
  if (s.t === 'c') {
    const dx = o.x - s.x, dy = o.y - s.y, d2 = dx * dx + dy * dy, rr = s.r + r;
    if (d2 >= rr * rr) return false;
    const d = Math.sqrt(d2);
    if (d < 0.01) { o.y = s.y + rr; return true; }
    o.x = s.x + dx / d * rr; o.y = s.y + dy / d * rr; return true;
  }
  if (s.t === 'r') {
    const cx = clamp(o.x, s.x, s.x + s.w), cy = clamp(o.y, s.y, s.y + s.h);
    const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); o.x = cx + dx / d * r; o.y = cy + dy / d * r; return true; }
    const l = o.x - s.x, rt = s.x + s.w - o.x, t = o.y - s.y, b = s.y + s.h - o.y, m = Math.min(l, rt, t, b);
    if (m === l) o.x = s.x - r; else if (m === rt) o.x = s.x + s.w + r; else if (m === t) o.y = s.y - r; else o.y = s.y + s.h + r;
    return true;
  }
  const vx = s.x2 - s.x1, vy = s.y2 - s.y1, L2 = vx * vx + vy * vy || 1;
  const t = clamp(((o.x - s.x1) * vx + (o.y - s.y1) * vy) / L2, 0, 1);
  const px = s.x1 + vx * t, py = s.y1 + vy * t, dx = o.x - px, dy = o.y - py, d2 = dx * dx + dy * dy, rr = s.r + r;
  if (d2 >= rr * rr) return false;
  const d = Math.sqrt(d2);
  if (d < 0.01) { const L = Math.sqrt(L2); o.x = px - vy / L * rr; o.y = py + vx / L * rr; return true; }
  o.x = px + dx / d * rr; o.y = py + dy / d * rr; return true;
}
function hits(x, y, r, s) { const o = { x, y }; return pushOut(o, r, s); }

/* ======================= 空间桶 ======================= */
const CELL = 160;
let stamp = 1;
const NEAR = [];
function bucketize(m) {
  m.bw = Math.ceil((m.maxX - m.minX) / CELL); m.bh = Math.ceil((m.maxY - m.minY) / CELL);
  m.buckets = []; for (let i = 0; i < m.bw * m.bh; i++) m.buckets.push([]);
  const add = m.addShape = (s, liquid) => {
    s.liquid = liquid; s._s = 0;
    const [a, b, c, d] = aabb(s);
    const x0 = clamp(((a - m.minX) / CELL) | 0, 0, m.bw - 1), x1 = clamp(((c - m.minX) / CELL) | 0, 0, m.bw - 1);
    const y0 = clamp(((b - m.minY) / CELL) | 0, 0, m.bh - 1), y1 = clamp(((d - m.minY) / CELL) | 0, 0, m.bh - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.buckets[y * m.bw + x].push(s);
  };
  for (const s of m.solids) add(s, false);
  for (const s of m.liquids) add(s, true);
}
// 查询矩形范围内的形状（共享数组）
function near(x0, y0, x1, y1) {
  const m = map; NEAR.length = 0; stamp++;
  const a = clamp(((x0 - m.minX) / CELL) | 0, 0, m.bw - 1), c = clamp(((x1 - m.minX) / CELL) | 0, 0, m.bw - 1);
  const b = clamp(((y0 - m.minY) / CELL) | 0, 0, m.bh - 1), d = clamp(((y1 - m.minY) / CELL) | 0, 0, m.bh - 1);
  for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) {
    const bk = m.buckets[y * m.bw + x];
    for (let i = 0; i < bk.length; i++) { const s = bk[i]; if (s._s !== stamp) { s._s = stamp; NEAR.push(s); } }
  }
  return NEAR;
}
M.near = near;

/* ======================= 碰撞 API ======================= */
M.collide = function (o, r, fly) {
  const m = map;
  if (!m) return;
  o.x = clamp(o.x, m.minX + r, m.maxX - r); o.y = clamp(o.y, m.minY + r, m.maxY - r);
  if (fly) return;
  const list = near(o.x - r - 4, o.y - r - 4, o.x + r + 4, o.y + r + 4);
  for (let k = 0; k < 2; k++) {
    let moved = false;
    for (let i = 0; i < list.length; i++) if (!list[i].dead && pushOut(o, r, list[i])) moved = true;
    if (!moved) break;
  }
  o.x = clamp(o.x, m.minX + r, m.maxX - r); o.y = clamp(o.y, m.minY + r, m.maxY - r);
};
M.blocked = function (x, y, r, fly) {
  const m = map;
  if (!m) return false;
  if (x < m.minX + r || x > m.maxX - r || y < m.minY + r || y > m.maxY - r) return true;
  if (fly) return false;
  const list = near(x - r, y - r, x + r, y + r);
  for (let i = 0; i < list.length; i++) if (!list[i].dead && hits(x, y, r, list[i])) return true;
  return false;
};
M.valid = (x, y, r) => !M.blocked(x, y, r || 14, false);
M.nearestValid = function (x, y) {
  if (M.valid(x, y, 14)) return [x, y];
  for (let rad = 30; rad < 600; rad += 30) for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (M.valid(px, py, 14)) return [px, py];
  }
  return [map.spawn.x, map.spawn.y];
};
M.randomValid = function (fx, fy, minD) {
  const m = map;
  for (let i = 0; i < 40; i++) {
    const x = U.rand(m.minX + 60, m.maxX - 60), y = U.rand(m.minY + 60, m.maxY - 60);
    if (Math.hypot(x - fx, y - fy) >= minD && M.valid(x, y, 16)) return [x, y];
  }
  return [m.spawn.x, m.spawn.y];
};
// 相机：跟随玩家，但不越过地图边界
M.camera = function () {
  const m = map, P = G.p, hw = SF.view.hw, hh = SF.view.hh;
  if (!m || !P) return [P ? P.x : 0, P ? P.y : 0];
  const cx = m.maxX - m.minX <= hw * 2 ? (m.minX + m.maxX) / 2 : clamp(P.x, m.minX + hw - 40, m.maxX - hw + 40);
  const cy = m.maxY - m.minY <= hh * 2 ? (m.minY + m.maxY) / 2 : clamp(P.y, m.minY + hh - 40, m.maxY - hh + 40);
  return [cx, cy];
};

/* ======================= 流场寻路 ======================= */
const FC = 40;
function buildFlow(m) {
  m.fw = Math.ceil((m.maxX - m.minX) / FC); m.fh = Math.ceil((m.maxY - m.minY) / FC);
  const n = m.fw * m.fh;
  m.fblk = new Uint8Array(n); m.fdist = new Int16Array(n).fill(-1); m.fq = new Int32Array(n);
  for (let y = 0; y < m.fh; y++) for (let x = 0; x < m.fw; x++) {
    const cx = m.minX + (x + 0.5) * FC, cy = m.minY + (y + 0.5) * FC;
    m.fblk[y * m.fw + x] = M.blocked(cx, cy, 13, false) ? 1 : 0;
  }
  m.fLast = -1; m.fT = 0;
}
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function cellOf(m, x, y) {
  const cx = clamp(((x - m.minX) / FC) | 0, 0, m.fw - 1), cy = clamp(((y - m.minY) / FC) | 0, 0, m.fh - 1);
  return cy * m.fw + cx;
}
function updateFlow(dt) {
  const m = map, P = G.p;
  m.fT -= dt;
  let start = cellOf(m, P.x, P.y);
  if (m.fblk[start]) { const nv = M.nearestValid(P.x, P.y); start = cellOf(m, nv[0], nv[1]); }
  if (start === m.fLast && m.fT > 0) return;
  m.fLast = start; m.fT = 0.3;
  const dist = m.fdist, q = m.fq, w = m.fw, h = m.fh;
  dist.fill(-1);
  let qh = 0, qt = 0;
  dist[start] = 0; q[qt++] = start;
  while (qh < qt) {
    const c = q[qh++], cx = c % w, cy = (c / w) | 0, dc = dist[c];
    for (let k = 0; k < 8; k++) {
      const nx = cx + NB[k][0], ny = cy + NB[k][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (m.fblk[ni] || dist[ni] >= 0) continue;
      if (k >= 4 && (m.fblk[cy * w + nx] || m.fblk[ny * w + cx])) continue; // 不切墙角
      dist[ni] = dc + 1; q[qt++] = ni;
    }
  }
}
const FD = [0, 0];
// 地面敌人的寻路方向；返回 null 表示直接追击
M.flowDir = function (x, y) {
  const m = map;
  if (!m) return null;
  const c = cellOf(m, x, y), dc = m.fdist[c];
  if (dc < 0 || dc <= 1) return null;
  const w = m.fw, cx = c % w, cy = (c / w) | 0;
  let best = -1, bd = dc;
  for (let k = 0; k < 8; k++) {
    const nx = cx + NB[k][0], ny = cy + NB[k][1];
    if (nx < 0 || ny < 0 || nx >= w || ny >= m.fh) continue;
    const ni = ny * w + nx, d = m.fdist[ni];
    if (d >= 0 && d < bd) { bd = d; best = ni; }
  }
  if (best < 0) return null;
  const tx = m.minX + (best % w + 0.5) * FC - x, ty = m.minY + (((best / w) | 0) + 0.5) * FC - y, l = Math.hypot(tx, ty) || 1;
  FD[0] = tx / l; FD[1] = ty / l;
  return FD;
};

/* ======================= 地图生成 ======================= */
function base(size, kind, seed) {
  const h = size / 2;
  return { kind, size, minX: -h, maxX: h, minY: -h, maxY: h, solids: [], liquids: [], zones: [], pads: [], portals: [], bridges: [], spawn: { x: 0, y: 180 }, rand: rng(seed) };
}
function isFree(m, x, y, r, gap) {
  gap = gap === undefined ? 34 : gap;
  if (x < m.minX + r + 50 || x > m.maxX - r - 50 || y < m.minY + r + 50 || y > m.maxY - r - 50) return false;
  if (Math.hypot(x - m.spawn.x, y - m.spawn.y) < 230 + r) return false;
  for (const s of m.solids) if (hits(x, y, r + gap, s)) return false;
  for (const s of m.liquids) if (hits(x, y, r + gap + 10, s)) return false;
  for (const z of m.zones) if (Math.hypot(x - z.x, y - z.y) < z.r + r + 40) return false;
  for (const p of m.pads) if (Math.hypot(x - p.x, y - p.y) < r + 70) return false;
  for (const p of m.portals) if (Math.hypot(x - p.x, y - p.y) < r + 80) return false;
  for (const b of m.bridges) if (Math.hypot(x - b.x, y - b.y) < r + b.len) return false;
  return true;
}
function solidC(m, x, y, r, k) { m.solids.push({ t: 'c', x, y, r, k }); }
function solidR(m, x, y, w, h, k) { m.solids.push({ t: 'r', x, y, w, h, k }); }
// 折线河流，bridges 为带桥的线段下标
function river(m, pts, r, k, bridges) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    if (bridges.includes(i)) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2, L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, g = r + 62;
      m.liquids.push({ t: 's', x1: ax, y1: ay, x2: mx - ux * g, y2: my - uy * g, r, k });
      m.liquids.push({ t: 's', x1: mx + ux * g, y1: my + uy * g, x2: bx, y2: by, r, k });
      m.bridges.push({ x: mx, y: my, ang: Math.atan2(uy, ux), len: g * 2, w: r * 2 + 40, k });
    } else m.liquids.push({ t: 's', x1: ax, y1: ay, x2: bx, y2: by, r, k });
  }
}
// 带门洞的围墙
function walls(m, cx, cy, w, h, th, doors, k) {
  const x0 = cx - w / 2, y0 = cy - h / 2, D = 100;
  const side = (dir, horizontal, x, y, len) => {
    if (doors.includes(dir)) {
      const a = (len - D) / 2;
      if (horizontal) { solidR(m, x, y, a, th, k); solidR(m, x + a + D, y, a, th, k); }
      else { solidR(m, x, y, th, a, k); solidR(m, x, y + a + D, th, a, k); }
    } else if (horizontal) solidR(m, x, y, len, th, k); else solidR(m, x, y, th, len, k);
  };
  side('n', true, x0, y0, w); side('s', true, x0, y0 + h - th, w);
  side('w', false, x0, y0 + th, h - th * 2); side('e', false, x0 + w - th, y0 + th, h - th * 2);
}
function grove(m, cx, cy, n, rad, k, rmin, rmax) {
  for (let i = 0, tries = 0; i < n && tries < n * 12; tries++) {
    const a = m.rand() * TAU, d = Math.sqrt(m.rand()) * rad, r = rmin + m.rand() * (rmax - rmin);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    if (isFree(m, x, y, r, 26)) { solidC(m, x, y, r, k); i++; }
  }
}
function scatter(m, n, k, rmin, rmax) {
  for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
    const r = rmin + m.rand() * (rmax - rmin), x = U.lerp(m.minX, m.maxX, m.rand()), y = U.lerp(m.minY, m.maxY, m.rand());
    if (isFree(m, x, y, r, 50)) { solidC(m, x, y, r, k); i++; }
  }
}
const zone = (m, k, x, y, r, o) => m.zones.push(Object.assign({ k, x, y, r, t: 0, p: 0, cd: 0, tick: 0 }, o));

const LAYOUT = {
  meadow(m) {
    river(m, [[-1250, -430], [-720, -280], [-220, -400], [300, -180], [820, -280], [1250, -140]], 56, 'water', [1, 3]);
    walls(m, 680, 620, 380, 320, 30, ['w', 'n'], 'ruin');
    zone(m, 'shrine', 700, 640, 60);
    zone(m, 'spring', -640, 520, 72);
    zone(m, 'might', -760, -860, 64);
    zone(m, 'haste', 560, -820, 64);
    zone(m, 'swamp', -180, 860, 140);
    m.portals.push({ x: -1000, y: 1000, r: 40, to: 1 }, { x: 1000, y: -1010, r: 40, to: 0 });
    m.pads.push({ x: 300, y: 420 }, { x: -900, y: -60 }, { x: 980, y: -620 }, { x: -420, y: -920 }, { x: 160, y: 980 });
    for (const [x, y, n] of [[-720, 170, 9], [330, 120, 6], [-980, -720, 8], [120, -920, 8], [980, 220, 9], [-320, -700, 7], [-950, 820, 7], [940, 960, 6]]) grove(m, x, y, n, 170, 'tree', 24, 32);
    scatter(m, 22, 'rock', 16, 26);
  },
  desert(m) {
    m.spawn = { x: 0, y: 320 };
    walls(m, 0, -720, 980, 720, 34, ['s', 'w', 'e'], 'sand');
    walls(m, 0, -800, 380, 300, 28, ['s'], 'sand');
    zone(m, 'shrine', 0, -810, 60);
    for (let i = -2; i <= 2; i++) { solidC(m, i * 130, -470, 20, 'pillar'); if (i) solidC(m, i * 170, -585, 20, 'pillar'); }
    m.liquids.push({ t: 'c', x: 920, y: -160, r: 120, k: 'water' });
    zone(m, 'spring', 920, 50, 66);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU - 0.9; solidC(m, 920 + Math.cos(a) * 165, -160 + Math.sin(a) * 160, 22, 'palm'); }
    zone(m, 'sand', -780, 320, 150); zone(m, 'sand', 720, 640, 150); zone(m, 'sand', -260, 980, 130);
    solidR(m, -1180, -180, 440, 60, 'cliff'); solidR(m, 420, 1020, 540, 60, 'cliff'); solidR(m, -1180, 640, 60, 420, 'cliff'); solidR(m, 1080, 320, 60, 420, 'cliff');
    zone(m, 'might', -980, -980, 64); zone(m, 'haste', 1000, 960, 64);
    m.portals.push({ x: -1140, y: 1120, r: 40, to: 1 }, { x: 1140, y: -1120, r: 40, to: 0 });
    m.pads.push({ x: 320, y: 300 }, { x: -720, y: -260 }, { x: 960, y: 780 }, { x: -960, y: 960 }, { x: 0, y: -520 + 70 });
    scatter(m, 26, 'cactus', 16, 22);
    scatter(m, 14, 'drock', 18, 28);
  },
  frost(m) {
    m.spawn = { x: 250, y: 260 };
    river(m, [[-1300, 200], [-800, 80], [-450, 260], [-60, 120], [-20, -300], [300, -700], [700, -900], [1300, -1000]], 48, 'chasm', [1, 3, 5]);
    river(m, [[400, 1300], [520, 700], [960, 420], [1300, 380]], 44, 'chasm', [1]);
    zone(m, 'frost', 700, -260, 230);
    zone(m, 'frost', -760, 760, 190);
    zone(m, 'spring', -820, -700, 70);
    zone(m, 'shrine', 940, 860, 60);
    walls(m, 940, 860, 340, 300, 28, ['w'], 'ice');
    zone(m, 'might', -1000, -260, 64); zone(m, 'haste', 200, 1000, 64);
    m.portals.push({ x: -1120, y: 1130, r: 40, to: 1 }, { x: 1120, y: -1160, r: 40, to: 0 });
    m.pads.push({ x: 320, y: 360 }, { x: -620, y: -360 }, { x: 980, y: -560 }, { x: -980, y: 300 }, { x: 140, y: -1060 });
    for (const [x, y, n] of [[-420, -920, 8], [1000, 60, 7], [-200, 620, 6], [-1050, 1000, 6], [400, -320, 5]]) grove(m, x, y, n, 170, 'pine', 24, 30);
    scatter(m, 18, 'crystal', 18, 26);
    scatter(m, 10, 'snowrock', 18, 26);
  },
  lava(m) {
    river(m, [[-1400, -300], [-900, -150], [-420, -320], [0, -80]], 54, 'lava', [1, 2]);
    river(m, [[0, -80], [450, -360], [900, -260], [1400, -420]], 54, 'lava', [1]);
    river(m, [[0, -80], [80, 380], [-120, 860], [60, 1400]], 50, 'lava', [1, 2]);
    zone(m, 'vent', -700, 520, 90); zone(m, 'vent', 640, 480, 90); zone(m, 'vent', -620, -820, 90); zone(m, 'vent', 760, -900, 90);
    zone(m, 'pool', -1000, 900, 120); zone(m, 'pool', 1040, 1020, 110);
    zone(m, 'spring', 520, 980, 62);
    zone(m, 'shrine', -980, -1020, 60);
    walls(m, -980, -1020, 340, 300, 30, ['e', 's'], 'basalt');
    zone(m, 'might', 1100, 160, 64); zone(m, 'haste', -1100, 160, 64);
    m.portals.push({ x: -380, y: 1180, r: 40, to: 1 }, { x: 1200, y: -1200, r: 40, to: 0 });
    m.pads.push({ x: -300, y: 300 }, { x: 420, y: 140 }, { x: -820, y: -480 }, { x: 900, y: -620 }, { x: 300, y: 1060 });
    m.spawn = { x: -260, y: 120 };
    scatter(m, 30, 'spire', 18, 28);
    scatter(m, 12, 'deadtree', 16, 22);
  }
};
Object.assign(LAYOUT, {
  swamp(m) {
    m.spawn = { x: 0, y: 60 };
    river(m, [[-1300, 520], [-760, 380], [-240, 580], [300, 400], [820, 560], [1300, 320]], 62, 'bog', [1, 3]);
    river(m, [[-420, -1300], [-300, -760], [-520, -260]], 54, 'bog', [0]);
    for (const [x, y, r] of [[760, -300, 120], [-980, -620, 100], [480, 1000, 110], [-860, 1040, 90]]) m.liquids.push({ t: 'c', x, y, r, k: 'bog' });
    walls(m, 760, -900, 380, 300, 26, ['s', 'w'], 'rotwood');
    zone(m, 'shrine', 760, -900, 60);
    zone(m, 'swamp', -760, -80, 160); zone(m, 'swamp', 300, -560, 140); zone(m, 'swamp', 1000, 860, 130);
    zone(m, 'toxic', -200, 980, 110); zone(m, 'toxic', 1060, 100, 100); zone(m, 'toxic', -1060, 220, 96);
    zone(m, 'spring', 120, -1000, 66);
    zone(m, 'might', -1020, -1020, 64); zone(m, 'haste', 1080, -1080, 64);
    m.portals.push({ x: -1140, y: 1140, r: 40, to: 1 }, { x: 1140, y: 1150, r: 40, to: 0 });
    m.pads.push({ x: 300, y: 160 }, { x: -640, y: -540 }, { x: 900, y: -560 }, { x: -620, y: 860 }, { x: 640, y: 760 });
    for (const [x, y, n] of [[-700, -880, 8], [320, -260, 6], [-960, 640, 7], [1000, -620, 6], [-260, -560, 5], [180, 820, 6]]) grove(m, x, y, n, 170, 'mangrove', 24, 30);
    scatter(m, 16, 'shroom', 18, 24);
    scatter(m, 12, 'stump', 16, 22);
    scatter(m, 10, 'reeds', 14, 18);
  },
  city(m) {
    m.spawn = { x: 0, y: 0 };
    m.mech = { tesla: 3, obelisk: 1, curse: 1, boost: 5, spikes: 5 };
    m.propN = [20, 22];
    const COLS = [-1100, -660, -220, 220, 660, 1100], ROWS = [-1100, -660, -220, 220, 660, 1100];
    const open = { '-220,-220': 1, '220,-220': 1, '-220,220': 1, '220,220': 1, '-660,-660': 'shrine', '660,660': 'spring', '1100,-660': 'park', '-1100,660': 'park', '660,-1100': 'park', '-660,1100': 'park', '-1100,-220': 'park', '1100,220': 'park' };
    for (const cx of COLS) for (const cy of ROWS) {
      const o = open[cx + ',' + cy];
      if (o) {
        if (o === 'shrine') { walls(m, cx, cy, 300, 260, 24, ['s', 'e'], 'building2'); zone(m, 'shrine', cx, cy, 58); }
        else if (o === 'spring') zone(m, 'spring', cx, cy, 64);
        else if (o === 'park' && m.rand() < 0.5) zone(m, 'toxic', cx, cy, 96);
        continue;
      }
      const w = 250 + m.rand() * 50, h = 200 + m.rand() * 50;
      if (m.rand() < 0.3) { // 两栋楼中间夹一条小巷
        const a = (w - 70) / 2;
        solidR(m, cx - w / 2, cy - h / 2, a, h, 'building'); solidR(m, cx - w / 2 + a + 70, cy - h / 2, a, h, 'building');
      } else solidR(m, cx - w / 2, cy - h / 2, w, h, 'building');
    }
    river(m, [[-1400, 440], [-1060, 440], [-700, 440], [-300, 440], [300, 440], [700, 440], [1060, 440], [1400, 440]], 46, 'acid', [1, 3, 5]);
    // 街道上的汽车与路灯
    const VS = [-880, -440, 0, 440, 880];
    for (const x of VS) for (const y of ROWS) if (Math.abs(y - 440) > 200 && m.rand() < 0.45 && !(Math.abs(x) < 450 && Math.abs(y) < 450)) solidC(m, x + (m.rand() < 0.5 ? -42 : 42), y + U.rand(-50, 50), 19, 'car');
    for (const y of VS) for (const x of COLS) if (y !== 440 && m.rand() < 0.4 && !(Math.abs(x) < 450 && Math.abs(y) < 450)) solidC(m, x + U.rand(-60, 60), y + (m.rand() < 0.5 ? -42 : 42), 19, 'car');
    for (const x of VS) for (const y of VS) if (y !== 440 && !(x === 0 && y === 0)) solidC(m, x + 62, y - 62, 8, 'lamp');
    m.solids = m.solids.filter(o => !(o.k === 'car' && Math.hypot(o.x + 660, o.y + 660) < 260));
    m.portals.push({ x: -1250, y: -1250, r: 40, to: 1 }, { x: 1250, y: 1250, r: 40, to: 0 });
    m.pads.push({ x: 260, y: 200 }, { x: -300, y: -250 }, { x: -880, y: 880 }, { x: 880, y: -880 }, { x: 0, y: 1100 });
    for (const [x, y] of [[-200, -330], [330, -180], [-330, 180], [180, 300]]) solidC(m, x, y, 18, 'junk');
    for (const [x, y] of [[0, -300], [-300, 0], [300, 0], [0, 260]]) solidC(m, x, y, 12, 'hydrant');
  },
  sky(m) {
    m.spawn = { x: 100, y: 0 };
    m.mech = { tesla: 1, obelisk: 2, curse: 1, boost: 4, spikes: 2 };
    river(m, [[-1400, -420], [-800, -520], [-200, -380], [400, -520], [1000, -400], [1400, -480]], 66, 'void', [1, 3]);
    river(m, [[-1400, 520], [-800, 420], [-200, 560], [400, 420], [1000, 560], [1400, 460]], 66, 'void', [1, 3]);
    river(m, [[-650, -470], [-600, 0], [-650, 470]], 58, 'void', [0]);
    river(m, [[-300, -1400], [-250, -900], [-260, -420]], 58, 'void', [0]);
    river(m, [[200, 500], [150, 1000], [220, 1400]], 58, 'void', [0]);
    walls(m, 860, -980, 360, 300, 26, ['s', 'w'], 'marble');
    zone(m, 'shrine', 860, -980, 58);
    for (const [x, y] of [[-1000, 0], [500, 40], [-900, 960], [900, 960]]) zone(m, 'storm', x, y, 100);
    zone(m, 'spring', -900, -980, 66);
    zone(m, 'might', 1100, 100, 64); zone(m, 'haste', -1100, -260, 64); zone(m, 'haste', 600, 1150, 64);
    m.portals.push({ x: -1200, y: 1220, r: 40, to: 1 }, { x: 1220, y: -1220, r: 40, to: 0 });
    m.pads.push({ x: 320, y: -180 }, { x: -1040, y: 300 }, { x: 960, y: 220 }, { x: -520, y: -1000 }, { x: -300, y: 1000 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; solidC(m, 100 + Math.cos(a) * 250, Math.sin(a) * 200, 14, 'column'); }
    for (const [x, y, n] of [[-1000, -900, 5], [1000, 900, 5], [-900, 300, 4], [700, -200, 4], [400, 960, 4]]) grove(m, x, y, n, 150, 'ctree', 20, 26);
    scatter(m, 10, 'statue', 18, 22);
    scatter(m, 14, 'cloudbush', 16, 22);
    scatter(m, 10, 'column', 13, 16);
  }
});
// 通用地图机关：雷霆塔、智慧方尖碑、诅咒祭坛、加速带、地刺；可破坏木箱与火药桶
function freeSpot(m, r, tries) {
  for (let i = 0; i < (tries || 60); i++) {
    const x = U.lerp(m.minX + 140, m.maxX - 140, m.rand()), y = U.lerp(m.minY + 140, m.maxY - 140, m.rand());
    if (isFree(m, x, y, r, 40)) return [x, y];
  }
  return null;
}
function mechanisms(m) {
  const cfg = m.mech || { tesla: 1, obelisk: 1, curse: 1, boost: 3, spikes: 3 };
  for (const k of ['tesla', 'obelisk', 'curse']) for (let i = 0; i < (cfg[k] || 0); i++) { const p = freeSpot(m, 60); if (p) zone(m, k, p[0], p[1], 50); }
  for (let i = 0; i < (cfg.boost || 0); i++) { const p = freeSpot(m, 40); if (p) zone(m, 'boost', p[0], p[1], 34, { ang: m.rand() * TAU }); }
  for (let i = 0; i < (cfg.spikes || 0); i++) { const p = freeSpot(m, 46); if (p) zone(m, 'spikes', p[0], p[1], 46, { t: m.rand() * 3 }); }
}
function props(m) {
  m.props = [];
  const n = m.propN || [26, 12];
  for (const [k, cnt, r] of [['crate', n[0], 16], ['barrel', n[1], 15]]) for (let i = 0; i < cnt; i++) {
    const p = freeSpot(m, r + 10, 30);
    if (!p || !M.valid(p[0], p[1], r + 8)) continue;
    const pr = { t: 'c', x: p[0], y: p[1], r, k, prop: true, hp: k === 'crate' ? 30 : 20, max: k === 'crate' ? 30 : 20, dead: false, re: 0 };
    m.props.push(pr); m.addShape(pr, false);
  }
}
const SIZE = { meadow: 2400, desert: 2600, frost: 2600, lava: 2800, swamp: 2600, city: 2800, sky: 2800 };
const SEED = { meadow: 11, desert: 23, frost: 37, lava: 53, swamp: 71, city: 89, sky: 97 };

M.build = function (stage) {
  const kind = stage.deco;
  const m = base(SIZE[kind] || 2400, kind, SEED[kind] || 7);
  map = m;
  m.solids.length = 0;
  (LAYOUT[kind] || LAYOUT.meadow)(m);
  mechanisms(m);
  bucketize(m);
  buildFlow(m);
  props(m);
  // 武器台、传送门、区域中心都必须可走
  for (const p of m.pads) { const v = M.nearestValid(p.x, p.y); p.x = v[0]; p.y = v[1]; }
  for (const p of m.portals) { const v = M.nearestValid(p.x, p.y); p.x = v[0]; p.y = v[1]; }
  // 确保出生点可走
  const sp = M.nearestValid(m.spawn.x, m.spawn.y); m.spawn.x = sp[0]; m.spawn.y = sp[1];
  G.portalCd = 0; G.zoneTag = '';
  m.mini = null;
  return m;
};

/* ======================= 区域效果 ======================= */
const TAGS = { boost: '加速带：冲刺！', spikes: '小心地刺陷阱！', spring: '治愈泉：持续回复生命', might: '狂暴符文：伤害 +35%', haste: '疾风符文：移速 +40%', swamp: '沼泽：移动减速',
  sand: '流沙：移动减速', frost: '寒霜冻土：移动减速', pool: '熔岩池：持续灼烧！', shrine: '宝藏祭坛：停留激活',
  toxic: '腐蚀毒沼：持续中毒！（敌人同样受伤）', storm: '雷暴区：注意落雷！' };
function slowEnemies(z, mul) {
  const list = SF.Core.query(z.x, z.y, z.r + 30);
  for (const e of list) {
    if (e.dead || e.fly || e.boss) continue;
    const dx = e.x - z.x, dy = e.y - z.y;
    if (dx * dx + dy * dy < z.r * z.r) { e.slow = Math.min(e.slow || 1, mul); e.slowT = Math.max(e.slowT, 0.15); }
  }
}
function damageArea(z, R, dmgE, dmgP, src) {
  const P = G.p, C = SF.Core;
  if (dmgP && Math.hypot(P.x - z.x, P.y - z.y) < R + P.r * 0.5) C.hurtPlayer(dmgP);
  const list = C.query(z.x, z.y, R + 30).slice();
  C.src = src || null;
  for (const e of list) {
    if (e.dead || e.fly) continue;
    if (Math.hypot(e.x - z.x, e.y - z.y) < R + e.r * 0.5) C.hurt(e, dmgE, 0, 0, true);
  }
  C.src = null;
}
M.update = function (dt) {
  const m = map, P = G.p, st = G.stats;
  if (!m) return;
  updateFlow(dt);
  let mightMul = 1, moveMul = 1, tag = '';
  const t = G.time / 60, dmgS = G.stage.dmgMul * (1 + t * 0.08);
  for (const z of m.zones) {
    const inP = Math.hypot(P.x - z.x, P.y - z.y) < z.r;
    if (inP && TAGS[z.k]) tag = TAGS[z.k];
    if (z.k === 'spring') {
      if (inP && P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.03 * dt); if (Math.random() < dt * 8) SF.VFX.p('plus', P.x + U.rand(-14, 14), P.y + U.rand(-8, 8), 0, -50, 0.7, 4, '#6aff8a', { drag: 1 }); }
    } else if (z.k === 'might') { if (inP) mightMul = 1.35; }
    else if (z.k === 'haste') { if (inP) moveMul *= 1.4; }
    else if (z.k === 'swamp' || z.k === 'sand' || z.k === 'frost') {
      const mul = z.k === 'frost' ? 0.65 : 0.55;
      if (inP && !(G.mount && G.mount.kind === 'tank')) moveMul *= mul;
      slowEnemies(z, mul);
    } else if (z.k === 'pool' || z.k === 'toxic') {
      z.tick -= dt;
      if (z.tick <= 0) { z.tick = 0.5; damageArea(z, z.r, 18 * G.stats.might, inP && !(G.mount && G.mount.kind === 'tank') ? 6 * dmgS : 0, null); }
    } else if (z.k === 'vent' || z.k === 'storm') {
      if (z.t <= 0) z.t = U.rand(4, 7);
      z.t -= dt;
      z.warn = z.t < 1.2;
      if (z.t <= 0) {
        z.t = U.rand(5, 8);
        damageArea(z, z.r + 30, 80 * (1 + G.level * 0.06), 22 * dmgS, null);
        if (z.k === 'storm') {
          for (let i = 0; i < 3; i++) { const a = U.rand(0, TAU), d = U.rand(0, z.r * 0.6); G.fx.push({ k: 'bolt', pts: [z.x + Math.cos(a) * d + U.rand(-60, 60), z.y - 520, z.x + Math.cos(a) * d, z.y + Math.sin(a) * d], life: 0.3, T: 0.3, col: '#ffe84a', seed: Math.random() * 999 }); }
          SF.VFX.explosion(z.x, z.y, z.r + 30, ['#bff0ff', '#ffe84a'], { decal: false });
          SF.Audio.sfx('lightning');
        } else
        SF.VFX.explosion(z.x, z.y, z.r + 30, ['#ff6a1a', '#ffd24a'], { decal: false });
        G.shake = Math.max(G.shake, Math.hypot(P.x - z.x, P.y - z.y) < 500 ? 5 : 0);
        SF.Audio.sfx('slam');
      }
    } else if (z.k === 'boost') {
      if (inP && (G.boostCd || 0) <= 0 && !G.mount && P.dashT <= 0) {
        P.dashT = 0.3; P.dvx = Math.cos(z.ang) * 760; P.dvy = Math.sin(z.ang) * 760; P.inv = Math.max(P.inv, 0.35);
        G.boostCd = 0.8; SF.Audio.sfx('dash'); SF.VFX.burst(P.x, P.y, '#7affff', 10, 180, 0.35, 3, 'spark');
      }
    } else if (z.k === 'spikes') {
      z.t += dt; const ph = z.t % 3.2;
      z.warn = ph > 2.0 && ph < 2.6; z.up = ph >= 2.6;
      if (z.up && !z.hit) { z.hit = true; damageArea(z, z.r, 45 * (1 + G.level * 0.06), 10 * dmgS, null); SF.Audio.sfx('hit'); }
      if (!z.up) z.hit = false;
    } else if (z.k === 'tesla' || z.k === 'obelisk' || z.k === 'curse') {
      const need = z.k === 'tesla' ? 1.2 : z.k === 'obelisk' ? 2 : 1.5;
      if (z.on > 0) {
        z.on -= dt; z.tick -= dt;
        if (inP) tag = '雷霆塔：运转中 ' + Math.ceil(z.on) + ' 秒';
        if (z.tick <= 0) {
          z.tick = 0.6;
          const C = SF.Core, tg = C.nearest(4, 320, z.x, z.y - 60).slice();
          C.src = 'mapw';
          for (const e of tg) { C.hurt(e, 30 * (1 + G.level * 0.07) * G.stats.might, 0, 0); e.stun = Math.max(e.stun, 0.2); G.fx.push({ k: 'bolt', pts: [z.x, z.y - 62, e.x, e.y], life: 0.22, T: 0.22, col: '#9fd8ff', seed: Math.random() * 999 }); }
          C.src = null;
          if (tg.length) SF.Audio.sfx('lightning');
        }
        if (z.on <= 0) z.cd = 45;
      } else if (z.cd > 0) { z.cd -= dt; if (inP) tag = MECH_NAME[z.k] + '：' + Math.ceil(z.cd) + ' 秒后可再次激活'; }
      else if (inP) {
        z.p += dt; tag = MECH_NAME[z.k] + '：激活中 ' + Math.min(100, (z.p / need * 100) | 0) + '%';
        if (z.p >= need) { z.p = 0; activateMech(z); }
      } else z.p = Math.max(0, z.p - dt * 2);
    } else if (z.k === 'shrine') {
      if (z.cd > 0) { z.cd -= dt; if (inP) tag = '宝藏祭坛：' + Math.ceil(z.cd) + ' 秒后可再次激活'; }
      else if (inP) {
        z.p += dt;
        tag = '宝藏祭坛：激活中 ' + Math.min(100, (z.p / 3 * 100) | 0) + '%';
        if (z.p >= 3) activateShrine(z);
      } else z.p = Math.max(0, z.p - dt * 2);
    }
  }
  if (G.boostCd > 0) G.boostCd -= dt;
  if (G.curseT > 0) { G.curseT -= dt; if (!tag) tag = '☠ 诅咒中：敌人更强，经验金币 ×2（' + Math.ceil(G.curseT) + ' 秒）'; }
  updateProps(dt);
  // 传送门
  if (G.portalCd > 0) G.portalCd -= dt;
  else if (!G.mount || G.mount.kind === 'tank') {
    for (const pt of m.portals) {
      if (Math.hypot(P.x - pt.x, P.y - pt.y) < pt.r) {
        const to = m.portals[pt.to];
        G.fx.push({ k: 'pillar', x: P.x, y: P.y, life: 0.7, T: 0.7 });
        P.x = to.x; P.y = to.y + to.r + 26; P.inv = Math.max(P.inv, 0.8);
        if (G.mount) { G.mount.x = P.x; G.mount.y = P.y; }
        G.fx.push({ k: 'pillar', x: P.x, y: P.y, life: 0.9, T: 0.9 });
        SF.VFX.sparkle(P.x, P.y, '#c890ff', 16);
        G.portalCd = 3; SF.Audio.sfx('magnet');
        break;
      }
    }
  }
  if (G.portalCd > 2.2) tag = '传送门：瞬间移动！';
  if (G.berserkT > 0) mightMul *= 1.4;
  st.might = st.mightBase * mightMul;
  st.move = st.moveBase * moveMul;
  st.cd = st.cdBase * (G.berserkT > 0 ? 0.7 : 1);
  G.zoneTag = tag;
};
const MECH_NAME = { tesla: '雷霆塔', obelisk: '智慧方尖碑', curse: '诅咒祭坛' };
function activateMech(z) {
  G.run.mech = (G.run.mech || 0) + 1;
  G.fx.push({ k: 'pillar', x: z.x, y: z.y, life: 1.1, T: 1.1 });
  if (z.k === 'tesla') { z.on = 20; z.tick = 0; SF.UI.banner('⚡ 雷霆塔启动！自动电击附近敌人', 2000); SF.Audio.sfx('lightning'); }
  else if (z.k === 'obelisk') {
    z.cd = 120; const n = 1 + (G.level >= 15 ? 1 : 0); G.pending += n; G.level += 0;
    SF.VFX.sparkle(z.x, z.y - 40, '#9fd8ff', 24); SF.UI.banner('📘 智慧方尖碑：获得 ' + n + ' 次升级！', 2000); SF.Audio.sfx('levelup');
  } else if (z.k === 'curse') {
    z.cd = 150; G.curseT = 60;
    SF.VFX.sparkle(z.x, z.y - 30, '#c060ff', 24); SF.UI.banner('☠ 接受诅咒：60 秒内敌人更强，经验金币翻倍', 2600); SF.Audio.sfx('boss');
  }
}
// 可破坏物：被投射物 / 范围攻击 / 爆炸破坏，之后重生
function updateProps(dt) {
  const m = map, P = G.p;
  const cam = M.camera(), hw = SF.view.hw + 60, hh = SF.view.hh + 60;
  const vis = [];
  for (const p of m.props) {
    if (p.dead) {
      p.re -= dt;
      if (p.re <= 0 && (Math.abs(p.x - P.x) > hw + 100 || Math.abs(p.y - P.y) > hh + 100)) { p.dead = false; p.hp = p.max; }
      continue;
    }
    if (Math.abs(p.x - cam[0]) < hw && Math.abs(p.y - cam[1]) < hh) vis.push(p);
  }
  if (!vis.length) return;
  for (const pj of G.proj) {
    if (pj.dead) continue;
    for (const p of vis) {
      if (p.dead) continue;
      const dx = pj.x - p.x, dy = pj.y - p.y, rr = p.r + pj.r;
      if (dx * dx + dy * dy < rr * rr && !(pj.hitP && pj.hitP.includes(p))) {
        (pj.hitP || (pj.hitP = [])).push(p);
        damageProp(p, pj.dmg);
        if (!pj.rehit && pj.k !== 'disc') { if (pj.pierce <= 0) pj.dead = true; else pj.pierce--; }
      }
    }
  }
}
function damageProp(p, dmg) {
  if (p.dead) return;
  p.hp -= dmg; p.flash = 0.1;
  if (p.hp > 0) return;
  p.dead = true; p.re = p.k === 'crate' ? 30 : 45;
  const C = SF.Core, U2 = U;
  if (p.k === 'crate') {
    G.run.crates = (G.run.crates || 0) + 1; SF.Feat.onProp('crate');
    SF.VFX.burst(p.x, p.y, '#a8743a', 10, 200, 0.5, 4, 'shard');
    for (let i = 0; i < 3; i++) C.dropGem(p.x + U2.rand(-14, 14), p.y + U2.rand(-14, 14), 2 * G.stage.xpMul);
    const r = Math.random(), l = 1 + G.stats.luck;
    if (r < 0.35 * l) C.dropPick('coin', p.x, p.y, Math.max(1, Math.round(G.stage.goldMul * U2.rand(2, 5))));
    else if (r < 0.5 * l) C.dropPick('heart', p.x, p.y);
    else if (r < 0.55 * l) C.dropPick('magnet', p.x, p.y);
    else if (r < 0.6 * l) C.dropPick('bomb', p.x, p.y);
    else if (r < 0.63 * l) C.dropPick('chest', p.x, p.y);
    SF.Audio.sfx('hit');
  } else {
    G.run.barrels = (G.run.barrels || 0) + 1; SF.Feat.onProp('barrel');
    const z = { x: p.x, y: p.y };
    damageArea(z, 115, 90 * (1 + G.level * 0.07) * G.stats.might, Math.hypot(G.p.x - p.x, G.p.y - p.y) < 115 ? 12 * G.stage.dmgMul : 0, 'prop');
    SF.VFX.explosion(p.x, p.y, 105, ['#ff6a1a', '#ffe08a']);
    G.shake = Math.max(G.shake, 6); SF.Audio.sfx('explode');
  }
}
// 范围伤害波及可破坏物（爆炸、近战武器等调用）
M.hitProps = function (x, y, r, dmg) {
  const m = map;
  if (!m || !m.props) return;
  const list = near(x - r - 20, y - r - 20, x + r + 20, y + r + 20);
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p.prop || p.dead) continue;
    if (Math.hypot(p.x - x, p.y - y) < r + p.r) damageProp(p, dmg);
  }
};
function activateShrine(z) {
  G.run.mech = (G.run.mech || 0) + 1;
  z.p = 0; z.cd = 90;
  const C = SF.Core;
  let id = G.waveDefs[0].e;
  for (const w of G.waveDefs) if (G.time >= w.t0) id = w.e;
  const n = 2 + Math.min(3, Math.floor(G.time / 180));
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, p = M.nearestValid(z.x + Math.cos(a) * 200, z.y + Math.sin(a) * 200);
    C.spawnEnemy(id, p[0], p[1], { elite: true });
  }
  C.dropPick('chest', z.x, z.y + z.r + 20);
  for (let i = 0; i < 6; i++) C.dropPick('coin', z.x + U.rand(-60, 60), z.y + z.r + U.rand(10, 60), Math.max(1, Math.round(G.stage.goldMul * U.rand(2, 4))));
  G.fx.push({ k: 'pillar', x: z.x, y: z.y, life: 1.4, T: 1.4 });
  G.fx.push({ k: 'ring', x: z.x, y: z.y, r: 10, max: 260, life: 0.6, T: 0.6, col: '#ffd86a' });
  SF.UI.banner('⚜ 祭坛激活！精英守卫出现，宝箱已降下', 2400);
  SF.Audio.sfx('boss');
}
})(window.SF = window.SF || {});
