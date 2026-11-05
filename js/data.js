(function (SF) {
'use strict';

/* =====================================================================
 * 武器：base 为 1 级属性，lv[i].d 为升到 i+2 级时的增量
 * ===================================================================== */
SF.WEAPONS = {
  bolt: {
    name: '魔法飞弹', icon: '🔮', col: '#7fd0ff', desc: '自动锁定最近的敌人发射追踪魔弹',
    evo: { need: 'might', name: '星辰飞弹', icon: '🌠', desc: '飞弹更多、更强、可穿透' },
    base: { dmg: 9, cd: 0.9, amount: 1, pierce: 0, speed: 380 },
    lv: [
      { t: '飞弹 +1', d: { amount: 1 } },
      { t: '伤害 +4', d: { dmg: 4 } },
      { t: '穿透 +1', d: { pierce: 1 } },
      { t: '飞弹 +1', d: { amount: 1 } },
      { t: '冷却 -0.2秒', d: { cd: -0.2 } },
      { t: '伤害 +5', d: { dmg: 5 } },
      { t: '飞弹 +1，穿透 +1', d: { amount: 1, pierce: 1 } }
    ]
  },
  orbit: {
    name: '旋转利刃', icon: '⚔️', col: '#ffd27a', desc: '利刃环绕自身旋转，切割并抵挡弹幕',
    evo: { need: 'armor', name: '圣剑之环', icon: '🗡️', desc: '圣剑数量与范围大幅提升' },
    base: { dmg: 7, cd: 0.4, amount: 2, radius: 68, rot: 3.2, size: 12 },
    lv: [
      { t: '利刃 +1', d: { amount: 1 } },
      { t: '伤害 +3', d: { dmg: 3 } },
      { t: '半径 +14，转速提升', d: { radius: 14, rot: 0.6 } },
      { t: '利刃 +1', d: { amount: 1 } },
      { t: '伤害 +4', d: { dmg: 4 } },
      { t: '半径 +14，刃体变大', d: { radius: 14, size: 3 } },
      { t: '利刃 +1，伤害 +4', d: { amount: 1, dmg: 4 } }
    ]
  },
  chain: {
    name: '闪电链', icon: '⚡', col: '#fff27a', desc: '雷电在敌人之间跳跃传导',
    evo: { need: 'cd', name: '雷神之怒', icon: '🌩️', desc: '雷电落点增多并连锁更远' },
    base: { dmg: 13, cd: 1.7, amount: 1, chain: 2, range: 150 },
    lv: [
      { t: '连锁 +1', d: { chain: 1 } },
      { t: '伤害 +6', d: { dmg: 6 } },
      { t: '冷却 -0.3秒', d: { cd: -0.3 } },
      { t: '连锁 +1', d: { chain: 1 } },
      { t: '同时落雷 +1', d: { amount: 1 } },
      { t: '伤害 +8', d: { dmg: 8 } },
      { t: '连锁 +2，冷却 -0.2秒', d: { chain: 2, cd: -0.2 } }
    ]
  },
  meteor: {
    name: '陨石术', icon: '☄️', col: '#ff9a4a', desc: '召唤陨石轰击敌群，造成范围伤害',
    evo: { need: 'area', name: '陨星雨', icon: '🌋', desc: '陨石数量与爆炸范围提升' },
    base: { dmg: 30, cd: 3.0, amount: 1, radius: 56 },
    lv: [
      { t: '伤害 +12', d: { dmg: 12 } },
      { t: '陨石 +1', d: { amount: 1 } },
      { t: '范围 +14', d: { radius: 14 } },
      { t: '冷却 -0.6秒', d: { cd: -0.6 } },
      { t: '陨石 +1', d: { amount: 1 } },
      { t: '伤害 +20', d: { dmg: 20 } },
      { t: '陨石 +1，范围 +14', d: { amount: 1, radius: 14 } }
    ]
  },
  nova: {
    name: '霜冻新星', icon: '❄️', col: '#9fe6ff', desc: '释放寒冰冲击波，击退并减速敌人',
    evo: { need: 'luck', name: '绝对零度', icon: '🧊', desc: '冲击波更大、更频繁' },
    base: { dmg: 12, cd: 3.2, amount: 0, radius: 130, slow: 0.5, slowT: 1.6 },
    lv: [
      { t: '范围 +28', d: { radius: 28 } },
      { t: '伤害 +8', d: { dmg: 8 } },
      { t: '冷却 -0.6秒', d: { cd: -0.6 } },
      { t: '范围 +28', d: { radius: 28 } },
      { t: '伤害 +10，减速更久', d: { dmg: 10, slowT: 1 } },
      { t: '追加一次脉冲', d: { amount: 1 } },
      { t: '范围 +36，伤害 +14', d: { radius: 36, dmg: 14 } }
    ]
  },
  axe: {
    name: '回旋飞斧', icon: '🪓', col: '#c9d4e6', desc: '掷出飞斧，飞出后回旋返回，反复切割',
    evo: { need: 'move', name: '旋风斩', icon: '🌪️', desc: '飞斧更多更大，伤害翻倍' },
    base: { dmg: 15, cd: 1.9, amount: 1, range: 230, size: 15, speed: 300 },
    lv: [
      { t: '伤害 +6', d: { dmg: 6 } },
      { t: '飞斧 +1', d: { amount: 1 } },
      { t: '斧刃变大，射程 +40', d: { size: 5, range: 40 } },
      { t: '飞斧 +1', d: { amount: 1 } },
      { t: '冷却 -0.4秒', d: { cd: -0.4 } },
      { t: '伤害 +10', d: { dmg: 10 } },
      { t: '飞斧 +1，伤害 +6', d: { amount: 1, dmg: 6 } }
    ]
  },
  poison: {
    name: '剧毒沼泽', icon: '🧪', col: '#8be05a', desc: '在敌人脚下制造毒池，持续伤害并减速',
    evo: { need: 'growth', name: '瘟疫之源', icon: '☣️', desc: '毒池更广、更持久' },
    base: { dmg: 6, cd: 3.4, amount: 1, radius: 62, dur: 3.2 },
    lv: [
      { t: '范围 +14', d: { radius: 14 } },
      { t: '伤害 +3', d: { dmg: 3 } },
      { t: '毒池 +1', d: { amount: 1 } },
      { t: '持续 +1.6秒', d: { dur: 1.6 } },
      { t: '伤害 +4', d: { dmg: 4 } },
      { t: '毒池 +1', d: { amount: 1 } },
      { t: '范围 +24，伤害 +6', d: { radius: 24, dmg: 6 } }
    ]
  },
  beam: {
    name: '圣光射线', icon: '✨', col: '#fff0a8', desc: '发射贯穿全部敌人的光束',
    evo: { need: 'hp', name: '审判之光', icon: '🌟', desc: '光束更粗、数量增加' },
    base: { dmg: 20, cd: 2.4, amount: 1, width: 24, len: 480 },
    lv: [
      { t: '伤害 +8', d: { dmg: 8 } },
      { t: '光束 +1', d: { amount: 1 } },
      { t: '光束变宽', d: { width: 8 } },
      { t: '冷却 -0.5秒', d: { cd: -0.5 } },
      { t: '光束 +1', d: { amount: 1 } },
      { t: '伤害 +12', d: { dmg: 12 } },
      { t: '光束 +1，宽度 +10', d: { amount: 1, width: 10 } }
    ]
  }
};
SF.weaponStats = function (id, lv, evo) {
  const W = SF.WEAPONS[id];
  const s = Object.assign({}, W.base);
  for (let i = 0; i < lv - 1; i++) {
    const d = W.lv[i].d;
    for (const k in d) s[k] = (s[k] || 0) + d[k];
  }
  if (evo) { // 进化：全面强化
    s.dmg *= 1.7; s.cd *= 0.8; s.amount = (s.amount || 0) + 1;
    for (const k of ['radius', 'width', 'size', 'range']) if (s[k]) s[k] *= 1.25;
    if (s.pierce !== undefined) s.pierce += 2;
    if (s.chain !== undefined) s.chain += 2;
    if (s.dur) s.dur *= 1.3;
  }
  return s;
};
// 取武器当前展示信息（进化后改名换图标）
SF.weaponInfo = function (id, evo) {
  const W = SF.WEAPONS[id];
  return evo ? { name: W.evo.name, icon: W.evo.icon } : { name: W.name, icon: W.icon };
};
SF.MAX_WLV = 8;

/* =====================================================================
 * 被动道具 / 局外强化：统一用 key + per（每级增量）
 * ===================================================================== */
SF.PASSIVES = {
  might:  { name: '力量指环', icon: '💍', key: 'might',  per: 0.12, max: 5, txt: '攻击力 +12%' },
  cd:     { name: '时之沙漏', icon: '⏳', key: 'cd',     per: -0.07, max: 5, txt: '冷却 -7%' },
  area:   { name: '扩张卷轴', icon: '📜', key: 'area',   per: 0.12, max: 5, txt: '作用范围 +12%' },
  move:   { name: '疾风之靴', icon: '👢', key: 'move',   per: 0.08, max: 5, txt: '移动速度 +8%' },
  hp:     { name: '生命之心', icon: '❤️', key: 'hpMul',  per: 0.15, max: 5, txt: '最大生命 +15%' },
  regen:  { name: '再生之叶', icon: '🌿', key: 'regen',  per: 0.4, max: 5, txt: '每秒回复 +0.4' },
  armor:  { name: '坚固护甲', icon: '🛡️', key: 'armor',  per: 1, max: 5, txt: '护甲 +1' },
  magnet: { name: '引力磁石', icon: '🧲', key: 'magnet', per: 0.3, max: 5, txt: '拾取范围 +30%' },
  growth: { name: '智慧之书', icon: '📖', key: 'growth', per: 0.1, max: 5, txt: '经验获取 +10%' },
  amount: { name: '双生之镜', icon: '🪞', key: 'amount', per: 1, max: 2, txt: '所有武器数量 +1' },
  luck:   { name: '四叶草',   icon: '🍀', key: 'luck',   per: 0.12, max: 5, txt: '幸运 +12%（暴击/掉落）' },
  greed:  { name: '贪婪金币', icon: '💰', key: 'greed',  per: 0.15, max: 5, txt: '金币获取 +15%' }
};

SF.META = {
  might:  { name: '力量训练', icon: '💪', key: 'might',  per: 0.04, max: 5, base: 80,  txt: '攻击力 +4%' },
  hp:     { name: '强健体魄', icon: '❤️', key: 'hp',     per: 10, max: 6, base: 60,  txt: '最大生命 +10' },
  armor:  { name: '铁壁',     icon: '🛡️', key: 'armor',  per: 1, max: 3, base: 300, txt: '护甲 +1' },
  move:   { name: '轻身术',   icon: '👟', key: 'move',   per: 0.04, max: 5, base: 70,  txt: '移动速度 +4%' },
  regen:  { name: '自愈',     icon: '🌿', key: 'regen',  per: 0.15, max: 5, base: 100, txt: '每秒回复 +0.15' },
  growth: { name: '求知',     icon: '📖', key: 'growth', per: 0.05, max: 5, base: 90,  txt: '经验获取 +5%' },
  greed:  { name: '财运',     icon: '💰', key: 'greed',  per: 0.08, max: 5, base: 90,  txt: '金币获取 +8%' },
  magnet: { name: '引力场',   icon: '🧲', key: 'magnet', per: 0.1, max: 5, base: 60,  txt: '拾取范围 +10%' },
  cd:     { name: '疾速',     icon: '⏳', key: 'cd',     per: -0.03, max: 5, base: 120, txt: '冷却 -3%' },
  luck:   { name: '好运',     icon: '🍀', key: 'luck',   per: 0.04, max: 5, base: 120, txt: '幸运 +4%' },
  revive: { name: '凤凰羽',   icon: '🪶', key: 'revive', per: 1, max: 2, base: 800, txt: '每局复活 +1 次' },
  reroll: { name: '命运骰子', icon: '🎲', key: 'reroll', per: 1, max: 3, base: 250, txt: '每局刷新 +1 次' },
  skip:   { name: '果断放弃', icon: '⏭️', key: 'skip',   per: 1, max: 3, base: 150, txt: '每局跳过 +1 次' },
  dashm:  { name: '冲刺精通', icon: '💨', key: 'dashm',  per: 1, max: 5, base: 120, txt: '冲刺冷却 -8%，伤害 +15%' },
  ultm:   { name: '星陨之力', icon: '☄️', key: 'ultm',   per: 1, max: 5, base: 180, txt: '大招冷却 -6%，伤害 +20%' },
  mapwm:  { name: '机械专精', icon: '🛠️', key: 'mapwm',  per: 1, max: 5, base: 100, txt: '地图武器持续时间 +20%' }
};
SF.metaCost = (id, lv) => Math.round(SF.META[id].base * Math.pow(1.7, lv) / 5) * 5;

/* =====================================================================
 * 角色
 * ===================================================================== */
SF.CHARS = {
  aileen: { name: '艾琳', title: '见习魔法师', start: 'bolt', cost: 0, hat: 'wizard', c1: '#7a5cff', c2: '#4a3aa0',
            mod: {}, perk: '均衡之选，适合新手' },
  kane:   { name: '凯恩', title: '重甲战士', start: 'orbit', cost: 400, hat: 'helm', c1: '#c8cfdc', c2: '#6a7388',
            mod: { hp: 30, armor: 1, move: -0.05 }, perk: '生命 +30，护甲 +1，移速 -5%' },
  vera:   { name: '薇拉', title: '林地游侠', start: 'axe', cost: 700, hat: 'hood', c1: '#4fae6a', c2: '#2b6b3f',
            mod: { move: 0.1, cd: -0.05 }, perk: '移速 +10%，冷却 -5%' },
  yuki:   { name: '雪见', title: '冰霜巫女', start: 'nova', cost: 1000, hat: 'ice', c1: '#8fd8ff', c2: '#3d84c4',
            mod: { luck: 0.15, area: 0.1 }, perk: '幸运 +15%，范围 +10%' },
  sael:   { name: '赛尔', title: '雷霆术士', start: 'chain', cost: 1400, hat: 'spark', c1: '#ffd84a', c2: '#a8731a',
            mod: { area: 0.15, might: 0.05 }, perk: '范围 +15%，攻击 +5%' },
  rock:   { name: '洛克', title: '疯狂炼金师', start: 'poison', cost: 1800, hat: 'alch', c1: '#7ed44a', c2: '#3f7a22',
            mod: { greed: 0.25, growth: 0.1 }, perk: '金币 +25%，经验 +10%' },
  odin:   { name: '奥丁', title: '圣光骑士', start: 'beam', cost: 2600, hat: 'halo', c1: '#fff0b8', c2: '#c89a3a',
            mod: { regen: 0.6, hp: 20, might: 0.1 }, perk: '回复 +0.6/秒，生命 +20，攻击 +10%' },
  ignis:  { name: '伊格', title: '炎之召唤师', start: 'meteor', cost: 3600, hat: 'flame', c1: '#ff7a3a', c2: '#a8321a',
            mod: { might: 0.15, amount: 0, cd: -0.08 }, perk: '攻击 +15%，冷却 -8%' }
};

/* =====================================================================
 * 敌人
 * ===================================================================== */
const E = SF.ENEMIES = {};
function def(id, shape, name, c1, c2, o) {
  E[id] = Object.assign({ id, shape, name, c1, c2, r: 12, hp: 12, spd: 50, dmg: 5, xp: 1, ai: 'chase' }, o);
}
const SLIME = { r: 12, hp: 8, spd: 52, dmg: 5, xp: 1 };
const BAT = { r: 9, hp: 5, spd: 100, dmg: 4, xp: 1, ai: 'sine' };
const SKEL = { r: 13, hp: 20, spd: 62, dmg: 8, xp: 2 };
const ORC = { r: 19, hp: 110, spd: 48, dmg: 14, xp: 5 };
const ARCH = { r: 11, hp: 24, spd: 55, dmg: 6, xp: 3, ai: 'ranged', shoot: { cd: 2.2, n: 1, spread: 0, spd: 150, dmg: 7 } };
const BOMB = { r: 11, hp: 14, spd: 108, dmg: 18, xp: 2, ai: 'bomber' };
const GOLEM = { r: 26, hp: 300, spd: 38, dmg: 22, xp: 12 };
const MAGE = { r: 12, hp: 32, spd: 48, dmg: 8, xp: 4, ai: 'mage', shoot: { cd: 3.0, n: 3, spread: 0.34, spd: 135, dmg: 8 } };
const CHRG = { r: 17, hp: 70, spd: 58, dmg: 16, xp: 5, ai: 'charger' };
const GHOST = { r: 12, hp: 34, spd: 78, dmg: 9, xp: 3 };
const X = Object.assign;

// 关卡 1：翡翠草原
def('slime', 'slime', '史莱姆', '#58c46a', '#c8ffd0', SLIME);
def('bat', 'bat', '紫蝠', '#7a4fb0', '#d2b0ff', BAT);
def('skeleton', 'skeleton', '骷髅兵', '#e8e2cf', '#ff5a5a', SKEL);
def('orc', 'orc', '兽人', '#6b9b3a', '#ffe9a0', ORC);
def('archer', 'archer', '哥布林射手', '#8a6a3a', '#d9b36c', ARCH);
def('bomber', 'bomber', '爆裂虫', '#d44a4a', '#ffd24a', BOMB);
// 关卡 2：赤沙遗迹
def('sslime', 'slime', '沙粒史莱姆', '#e0b84a', '#fff0b0', X({}, SLIME, { hp: 18, r: 13 }));
def('sbat', 'bat', '沙漠蝙蝠', '#d8873a', '#ffd29a', BAT);
def('mummy', 'skeleton', '木乃伊', '#d9cba6', '#6fe0ff', X({}, SKEL, { hp: 38, r: 14 }));
def('scarab', 'bomber', '圣甲虫', '#2a5b9a', '#f2c94c', BOMB);
def('nomad', 'archer', '沙漠弓手', '#c46a3a', '#ffd29a', ARCH);
def('sgolem', 'golem', '沙石傀儡', '#b89a62', '#ffe08a', GOLEM);
def('dmage', 'mage', '沙漠术士', '#b8602d', '#ffd24a', MAGE);
// 关卡 3：霜冻荒原
def('islime', 'slime', '冰霜史莱姆', '#6ad0f0', '#e6faff', X({}, SLIME, { hp: 22, r: 13 }));
def('fbat', 'bat', '霜翼蝠', '#cfe8ff', '#6fb7ff', BAT);
def('ghost', 'ghost', '寒冰幽灵', '#a9d8ff', '#ffffff', GHOST);
def('yeti', 'orc', '雪怪', '#e8f0f8', '#6fb7ff', X({}, ORC, { hp: 150, r: 20 }));
def('image', 'mage', '冰霜法师', '#3f78d8', '#bfe6ff', MAGE);
def('farcher', 'archer', '冰原猎手', '#5a7aa8', '#bfe6ff', ARCH);
def('icecharger', 'charger', '冰原野猪', '#9fc0e0', '#ffffff', CHRG);
// 关卡 4：熔岩深渊
def('lslime', 'slime', '熔岩史莱姆', '#e2582a', '#ffd08a', X({}, SLIME, { hp: 28, r: 13 }));
def('fbat2', 'bat', '火焰蝙蝠', '#e0402a', '#ffd24a', BAT);
def('ember', 'skeleton', '余烬骷髅', '#3a3a44', '#ff7a2a', X({}, SKEL, { hp: 50, r: 14 }));
def('imp', 'mage', '小恶魔', '#c4262e', '#ffd24a', MAGE);
def('mgolem', 'golem', '岩浆傀儡', '#5a2a22', '#ff8a2a', X({}, GOLEM, { hp: 380 }));
def('hound', 'charger', '地狱犬', '#3a2222', '#ff4a2a', X({}, CHRG, { hp: 90 }));
def('lbomb', 'bomber', '爆炎虫', '#ff6a2a', '#fff0a0', BOMB);
def('lorc', 'orc', '熔岩兽人', '#a03a2a', '#ffd24a', X({}, ORC, { hp: 180 }));

// Boss：pat 为循环释放的招式
function boss(id, shape, name, c1, c2, o) {
  E[id] = Object.assign({ id, shape, name, c1, c2, boss: true, ai: 'boss', xp: 0, cd: 2.4, minion: 'slime' }, o);
}
boss('mid1', 'orc', '兽人酋长·格罗姆', '#4f7d2a', '#ff6a3a',
  { r: 38, hp: 2600, spd: 52, dmg: 22, cd: 2.6, pat: ['dash', 'slam', 'summon'], minion: 'slime' });
boss('boss1', 'crownSlime', '史莱姆之王', '#4fbf5f', '#c8ffd0',
  { r: 58, hp: 6500, spd: 42, dmg: 24, cd: 2.4, pat: ['aim', 'dash', 'ring', 'summon', 'slam'], minion: 'slime' });
boss('mid2', 'golem', '沙石巨像', '#c9a85c', '#ffe08a',
  { r: 44, hp: 4200, spd: 44, dmg: 26, cd: 2.4, pat: ['slam', 'aim', 'dash'], minion: 'scarab' });
boss('boss2', 'scorpion', '沙之蝎王', '#c4673a', '#ffd24a',
  { r: 60, hp: 9500, spd: 50, dmg: 28, cd: 2.2, pat: ['dash', 'aim', 'slam', 'ring', 'summon'], minion: 'scarab' });
boss('mid3', 'ghost', '寒冰幽魂', '#8fd0ff', '#ffffff',
  { r: 42, hp: 5200, spd: 56, dmg: 24, cd: 2.2, pat: ['aim', 'ring', 'summon'], minion: 'ghost' });
boss('boss3', 'lich', '冰霜巫妖', '#5a7ad8', '#9fffff',
  { r: 58, hp: 12500, spd: 46, dmg: 30, cd: 2.1, pat: ['spiral', 'summon', 'ring', 'aim', 'slam'], minion: 'ghost' });
boss('mid4', 'charger', '熔岩野猪王', '#7a2a1a', '#ffb04a',
  { r: 44, hp: 7000, spd: 60, dmg: 32, cd: 2.2, pat: ['dash', 'ring', 'slam'], minion: 'lbomb' });
boss('boss4', 'demon', '炎魔领主', '#b81e2a', '#ffd24a',
  { r: 64, hp: 18000, spd: 50, dmg: 36, cd: 1.9, pat: ['slam', 'ring', 'spiral', 'dash', 'aim', 'summon'], minion: 'imp' });

/* =====================================================================
 * 关卡
 * w(敌人, 起始秒, 初始每秒生成数, 结束每秒生成数)
 * ===================================================================== */
function mk(o) {
  const w = (e, t0, r0, r1) => ({ e, t0, r0, r1 });
  return Object.assign({ w }, o);
}
SF.STAGES = {
  meadow: mk({
    id: 'meadow', name: '翡翠草原', icon: '🌿', desc: '新手的试炼场。击败史莱姆之王。',
    bossAt: 480, hpMul: 1, dmgMul: 1, xpMul: 1, goldMul: 1, diff: 1, rate: 1,
    ground: ['#3d6d3f', '#366337', '#447a45'], deco: 'meadow', music: 0,
    waves(w) {
      return [
        w('slime', 0, 0.9, 3.0), w('bat', 40, 0.15, 1.4), w('skeleton', 80, 0.15, 1.5),
        w('archer', 140, 0.08, 0.5), w('orc', 200, 0.08, 0.55), w('bomber', 260, 0.1, 0.6)
      ];
    },
    events: [
      { t: 25, k: 'swarm', e: 'bat', n: 12 }, { t: 100, k: 'ring', e: 'slime', n: 24 },
      { t: 170, k: 'elite', e: 'orc' }, { t: 240, k: 'boss', e: 'mid1' },
      { t: 310, k: 'swarm', e: 'bat', n: 30 }, { t: 360, k: 'ring', e: 'skeleton', n: 30 },
      { t: 420, k: 'elite', e: 'orc' }, { t: 480, k: 'boss', e: 'boss1', final: true }
    ]
  }),
  desert: mk({
    id: 'desert', name: '赤沙遗迹', icon: '🏜️', desc: '烈日下的古老遗迹，蝎王盘踞于此。',
    bossAt: 540, hpMul: 1.25, dmgMul: 1.15, xpMul: 1.5, goldMul: 1.6, diff: 2, rate: 0.8,
    ground: ['#c9a463', '#bf9a58', '#d3b072'], deco: 'desert', music: 1,
    waves(w) {
      return [
        w('sslime', 0, 1.0, 3.0), w('sbat', 20, 0.2, 1.5), w('mummy', 60, 0.2, 1.6),
        w('scarab', 120, 0.1, 0.7), w('nomad', 160, 0.1, 0.55), w('sgolem', 240, 0.05, 0.3),
        w('dmage', 300, 0.06, 0.4)
      ];
    },
    events: [
      { t: 25, k: 'swarm', e: 'sbat', n: 16 }, { t: 90, k: 'ring', e: 'sslime', n: 26 },
      { t: 150, k: 'elite', e: 'sgolem' }, { t: 270, k: 'boss', e: 'mid2' },
      { t: 330, k: 'swarm', e: 'scarab', n: 24 }, { t: 400, k: 'ring', e: 'mummy', n: 32 },
      { t: 460, k: 'elite', e: 'sgolem' }, { t: 540, k: 'boss', e: 'boss2', final: true }
    ]
  }),
  frost: mk({
    id: 'frost', name: '霜冻荒原', icon: '❄️', desc: '暴风雪中的亡灵军团，小心巫妖。',
    bossAt: 540, hpMul: 1.5, dmgMul: 1.35, xpMul: 1.95, goldMul: 2.4, diff: 3, rate: 0.68,
    ground: ['#d6e6f2', '#c8dcec', '#e4f0fa'], deco: 'frost', music: 2,
    waves(w) {
      return [
        w('islime', 0, 1.0, 3.0), w('fbat', 15, 0.2, 1.6), w('ghost', 50, 0.15, 1.5),
        w('farcher', 100, 0.1, 0.6), w('icecharger', 150, 0.06, 0.5), w('yeti', 210, 0.06, 0.5),
        w('image', 270, 0.06, 0.45)
      ];
    },
    events: [
      { t: 25, k: 'swarm', e: 'fbat', n: 18 }, { t: 90, k: 'ring', e: 'islime', n: 28 },
      { t: 150, k: 'elite', e: 'yeti' }, { t: 270, k: 'boss', e: 'mid3' },
      { t: 330, k: 'swarm', e: 'ghost', n: 24 }, { t: 400, k: 'ring', e: 'ghost', n: 32 },
      { t: 460, k: 'elite', e: 'yeti' }, { t: 540, k: 'boss', e: 'boss3', final: true }
    ]
  }),
  lava: mk({
    id: 'lava', name: '熔岩深渊', icon: '🌋', desc: '最终的试炼。击败炎魔领主，成为传说。',
    bossAt: 600, hpMul: 1.8, dmgMul: 1.6, xpMul: 2.5, goldMul: 3.5, diff: 4, rate: 0.68,
    ground: ['#3a2a2e', '#322428', '#443236'], deco: 'lava', music: 3,
    waves(w) {
      return [
        w('lslime', 0, 1.1, 3.2), w('fbat2', 15, 0.25, 1.7), w('ember', 45, 0.2, 1.7),
        w('imp', 100, 0.1, 0.6), w('lbomb', 130, 0.1, 0.8), w('hound', 170, 0.08, 0.55),
        w('lorc', 220, 0.06, 0.5), w('mgolem', 300, 0.04, 0.3)
      ];
    },
    events: [
      { t: 25, k: 'swarm', e: 'fbat2', n: 20 }, { t: 90, k: 'ring', e: 'lslime', n: 30 },
      { t: 150, k: 'elite', e: 'lorc' }, { t: 300, k: 'boss', e: 'mid4' },
      { t: 360, k: 'swarm', e: 'lbomb', n: 28 }, { t: 430, k: 'ring', e: 'ember', n: 34 },
      { t: 490, k: 'elite', e: 'mgolem' }, { t: 600, k: 'boss', e: 'boss4', final: true }
    ]
  })
};
SF.STAGE_ORDER = ['meadow', 'desert', 'frost', 'lava'];

/* =====================================================================
 * 成就
 * ===================================================================== */
SF.ACHS = [
  { id: 'k100',   name: '初出茅庐', desc: '累计击杀 100 个敌人', gold: 50,  chk: d => d.kills >= 100 },
  { id: 'k1000',  name: '屠戮者',   desc: '累计击杀 1000 个敌人', gold: 150, chk: d => d.kills >= 1000 },
  { id: 'k10000', name: '万人斩',   desc: '累计击杀 10000 个敌人', gold: 600, chk: d => d.kills >= 10000 },
  { id: 's180',   name: '站稳脚跟', desc: '单局存活 3 分钟', gold: 60,  chk: d => d.bestTime >= 180 },
  { id: 's420',   name: '身经百战', desc: '单局存活 7 分钟', gold: 200, chk: d => d.bestTime >= 420 },
  { id: 'lv15',   name: '渐入佳境', desc: '单局达到 15 级', gold: 80,  chk: d => d.bestLv >= 15 },
  { id: 'lv30',   name: '登峰造极', desc: '单局达到 30 级', gold: 300, chk: d => d.bestLv >= 30 },
  { id: 'win1',   name: '草原之王', desc: '通关翡翠草原', gold: 200, chk: d => d.stages.includes('desert') },
  { id: 'win2',   name: '沙漠征服者', desc: '通关赤沙遗迹', gold: 350, chk: d => d.stages.includes('frost') },
  { id: 'win3',   name: '霜之终结', desc: '通关霜冻荒原', gold: 500, chk: d => d.stages.includes('lava') },
  { id: 'win4',   name: '星陨传说', desc: '通关熔岩深渊', gold: 1000, chk: d => !!d.best.lava_win },
  { id: 'boss5',  name: '猎头者',   desc: '累计击败 5 个 Boss', gold: 150, chk: d => d.bosses >= 5 },
  { id: 'rich',   name: '腰缠万贯', desc: '累计获得 5000 金币', gold: 300, chk: d => d.totalGold >= 5000 },
  { id: 'chars',  name: '群英荟萃', desc: '解锁全部角色', gold: 500, chk: d => d.chars.length >= Object.keys(SF.CHARS).length }
];
})(window.SF = window.SF || {});
