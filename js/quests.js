/* 任务系统：每日任务 + 主线任务（局外），进度在每局结束时结算 */
(function (SF) {
'use strict';
const U = SF.U;
const Q = SF.Quests = {};
const D = () => SF.Save.data;

// mode: sum 累计 / max 单局最佳
const DAILY = [
  { id: 'kills',  key: 'kills',     mode: 'sum', n: [300, 600, 900], gold: [60, 100, 150], icon: 'x:skull',   txt: n => `累计击杀 ${n} 个敌人` },
  { id: 'runs',   key: 'runs',      mode: 'sum', n: [2, 3],          gold: [60, 90],       icon: 'x:trophy',  txt: n => `完成 ${n} 次出征` },
  { id: 'time',   key: 'time',      mode: 'max', n: [240, 360],      gold: [80, 130],      icon: 'm:cd',      txt: n => `单局存活 ${n / 60} 分钟` },
  { id: 'dashes', key: 'dashes',    mode: 'sum', n: [25, 50],        gold: [60, 100],      icon: 'a:dash',    txt: n => `使用闪避冲刺 ${n} 次` },
  { id: 'ults',   key: 'ults',      mode: 'sum', n: [2, 4],          gold: [70, 120],      icon: 'a:ult',     txt: n => `释放星陨天降 ${n} 次` },
  { id: 'mapw',   key: 'mapwKills', mode: 'sum', n: [40, 100],       gold: [80, 140],      icon: 'k:cannon',  txt: n => `用地图武器击杀 ${n} 个敌人` },
  { id: 'elites', key: 'elites',    mode: 'sum', n: [3, 6],          gold: [80, 140],      icon: 'w:orbit',   txt: n => `击败 ${n} 个精英或 Boss` },
  { id: 'level',  key: 'level',     mode: 'max', n: [15, 22],        gold: [70, 120],      icon: 'p:growth',  txt: n => `单局达到 ${n} 级` },
  { id: 'chal',   key: 'chal',      mode: 'sum', n: [2, 4],          gold: [70, 120],      icon: 'x:quest',   txt: n => `完成 ${n} 个局内挑战` },
  { id: 'chests', key: 'chests',    mode: 'sum', n: [3, 5],          gold: [60, 100],      icon: 'x:chest',   txt: n => `开启 ${n} 个宝箱` },
  { id: 'gold',   key: 'gold',      mode: 'max', n: [150, 300],      gold: [70, 120],      icon: 'x:coins',   txt: n => `单局获得 ${n} 金币` }
];
const bestTime = d => { let b = 0; for (const id of SF.STAGE_ORDER) b = Math.max(b, d.best[id] || 0); return b; };
const MAIN = [
  { txt: '完成第一次出征',          gold: 100,  n: 1,   icon: 'x:trophy',  cur: d => d.runs },
  { txt: '单局存活 3 分钟',         gold: 150,  n: 180, icon: 'm:cd',      cur: d => bestTime(d), time: true },
  { txt: '在强化商店升级 5 次',      gold: 200,  n: 5,   icon: 'm:might',   cur: d => d.metaBuys || 0 },
  { txt: '完成 3 个局内挑战',        gold: 200,  n: 3,   icon: 'x:quest',   cur: d => d.chalDone || 0 },
  { txt: '用地图武器击杀 50 个敌人',  gold: 250,  n: 50,  icon: 'k:tank',    cur: d => d.mapwKills || 0 },
  { txt: '解锁一名新角色',          gold: 250,  n: 1,   icon: 'p:hp',      cur: d => d.chars.length - 1 },
  { txt: '进化一把武器',            gold: 300,  n: 1,   icon: 'e:bolt',    cur: d => d.evos || 0 },
  { txt: '通关翡翠草原',            gold: 400,  n: 1,   icon: 's:meadow',  cur: d => d.best.meadow_win ? 1 : 0 },
  { txt: '完成 5 个每日任务',        gold: 400,  n: 5,   icon: 'x:quest',   cur: d => d.dailyDone || 0 },
  { txt: '通关赤沙遗迹',            gold: 600,  n: 1,   icon: 's:desert',  cur: d => d.best.desert_win ? 1 : 0 },
  { txt: '单局达到 35 级',          gold: 600,  n: 35,  icon: 'p:growth',  cur: d => d.bestLv },
  { txt: '通关霜冻荒原',            gold: 800,  n: 1,   icon: 's:frost',   cur: d => d.best.frost_win ? 1 : 0 },
  { txt: '累计释放 30 次星陨天降',    gold: 800,  n: 30,  icon: 'a:ult',     cur: d => d.ultsTotal || 0 },
  { txt: '通关熔岩深渊',            gold: 1500, n: 1,   icon: 's:lava',    cur: d => d.best.lava_win ? 1 : 0 }
];
Q.DAILY = DAILY; Q.MAIN = MAIN;

function today() { const t = new Date(); return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate(); }
function makeDaily(exclude) {
  const pool = DAILY.filter(q => !exclude.includes(q.id));
  const q = U.choice(pool), i = (Math.random() * q.n.length) | 0;
  return { id: q.id, n: q.n[i], gold: q.gold[i], prog: 0, claimed: false };
}
Q.ensureDaily = function () {
  const d = D(), day = today();
  if (d.daily && d.daily.day === day && Array.isArray(d.daily.list)) return d.daily;
  const list = [];
  while (list.length < 3) list.push(makeDaily(list.map(x => x.id)));
  d.daily = { day, list, reroll: 1 };
  SF.Save.save();
  return d.daily;
};
Q.def = id => DAILY.find(q => q.id === id);
Q.dailyText = q => Q.def(q.id).txt(q.n);
Q.rerollDaily = function (i) {
  const dl = Q.ensureDaily(), q = dl.list[i];
  if (!q || q.claimed || dl.reroll <= 0) return false;
  dl.reroll--;
  dl.list[i] = makeDaily(dl.list.map(x => x.id));
  SF.Save.save();
  return true;
};
Q.claimDaily = function (i) {
  const dl = Q.ensureDaily(), q = dl.list[i], d = D();
  if (!q || q.claimed || q.prog < q.n) return 0;
  q.claimed = true; d.gold += q.gold; d.totalGold += q.gold; d.dailyDone = (d.dailyDone || 0) + 1;
  SF.Save.save();
  return q.gold;
};
Q.mainCur = function () { const d = D(); return MAIN[d.mainIdx || 0] || null; };
Q.mainProg = function (q) { return Math.min(q.n, q.cur(D())); };
Q.claimMain = function () {
  const d = D(), q = Q.mainCur();
  if (!q || Q.mainProg(q) < q.n) return 0;
  d.mainIdx = (d.mainIdx || 0) + 1; d.gold += q.gold; d.totalGold += q.gold;
  SF.Save.save();
  return q.gold;
};
Q.claimable = function () {
  const dl = Q.ensureDaily();
  let n = dl.list.filter(q => !q.claimed && q.prog >= q.n).length;
  const m = Q.mainCur();
  if (m && Q.mainProg(m) >= m.n) n++;
  return n;
};
// 每局结束：累加终身统计 + 推进每日任务；返回本局新完成的任务文本
Q.onRunEnd = function (run) {
  const d = D();
  d.evos = (d.evos || 0) + (run.evos || 0);
  d.mapwKills = (d.mapwKills || 0) + (run.mapwKills || 0);
  d.chalDone = (d.chalDone || 0) + (run.chal || 0);
  d.ultsTotal = (d.ultsTotal || 0) + (run.ults || 0);
  d.dashesTotal = (d.dashesTotal || 0) + (run.dashes || 0);
  const dl = Q.ensureDaily(), done = [];
  for (const q of dl.list) {
    if (q.claimed) continue;
    const def = Q.def(q.id), v = run[def.key] || 0, before = q.prog;
    q.prog = def.mode === 'sum' ? q.prog + v : Math.max(q.prog, v);
    if (before < q.n && q.prog >= q.n) done.push('每日：' + def.txt(q.n));
  }
  const m = Q.mainCur();
  if (m && Q.mainProg(m) >= m.n) done.push('主线：' + m.txt);
  return done;
};
})(window.SF = window.SF || {});
