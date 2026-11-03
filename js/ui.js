/* DOM 界面：菜单、商店、成就、设置、弹窗、HUD */
(function (SF) {
'use strict';
const U = SF.U, Save = SF.Save, G = SF.G;
const UI = SF.UI = {};
const $ = s => document.querySelector(s);
let scr, modal, cur = 'menu', focusChar = null, lockUntil = 0;
const hud = {};

UI.init = function () {
  scr = $('#screens'); modal = $('#modal');
  for (const id of ['xpbar', 'lvl', 'hpbar', 'hptxt', 'timer', 'kills', 'gold', 'items', 'bossbar', 'bossname', 'banner', 'vig']) hud[id] = document.getElementById(id);
  hud.xpi = hud.xpbar.querySelector('i'); hud.hpi = hud.hpbar.querySelector('i'); hud.bossi = hud.bossbar.querySelector('i');
  document.getElementById('app').addEventListener('click', onClick);
  document.getElementById('btn-pause').addEventListener('click', e => { e.stopPropagation(); SF.Audio.resume(); SF.Game.pause(); });
  SF.Input.onPause = () => { if (G.state === 'play') SF.Game.pause(); else if (G.state === 'paused') SF.Game.resume(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { SF.Game.pause(); SF.Audio.suspend(); } else SF.Audio.resume(); });
  focusChar = Save.data.sel.char;
};

function stars() {
  let s = '<div class="stars">';
  for (let i = 0; i < 26; i++) s += `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;animation-delay:${(Math.random() * 3).toFixed(1)}s;transform:scale(${(0.5 + Math.random()).toFixed(2)})"></i>`;
  return s + '</div>';
}
function goldChip() { return `<div class="gold-chip">🪙 ${U.fmtNum(Save.data.gold)}</div>`; }
function pips(lv, max) { let s = '<div class="pips">'; for (let i = 0; i < max; i++) s += `<i class="${i < lv ? 'on' : ''}"></i>`; return s + '</div>'; }
function bar(title, back) {
  return `<div class="bar"><button class="back" data-act="${back || 'goMenu'}" aria-label="返回">‹</button><h2>${title}</h2>${goldChip()}</div>`;
}

/* ------------------------- 各界面 ------------------------- */
const VIEWS = {
  menu() {
    const d = Save.data;
    return `<div class="screen menu">${stars()}
      ${goldChip()}
      <div class="logo">星陨战记</div>
      <div class="sub">STARFALL SURVIVORS</div>
      <img class="hero" alt="" src="${SF.Sprites.charIcon(d.sel.char)}">
      <div class="btns">
        <button class="btn gold" data-act="goSelect">⚔ 出 征</button>
        <button class="btn" data-act="goShop">⬆ 强化商店</button>
        <div class="row"><button class="btn sec" data-act="goAch">🏆 成就</button><button class="btn sec" data-act="goSet">⚙ 设置</button></div>
      </div>
      <div class="foot">拖动屏幕移动 · 武器自动攻击 · 存活并击败 Boss</div>
    </div>`;
  },
  select() {
    const d = Save.data;
    let h = `<div class="screen">${bar('选择关卡')}<div class="stage-grid">`;
    for (const id of SF.STAGE_ORDER) {
      const s = SF.STAGES[id], ok = d.stages.includes(id), best = d.best[id] ? U.fmtTime(d.best[id]) : '--:--';
      const win = d.best[id + '_win'] ? ' ✔' : '';
      h += `<button class="card stage-card ${d.sel.stage === id && ok ? 'sel' : ''} ${ok ? '' : 'lock'}" data-act="stage" data-id="${id}">
        <div class="top"><div class="ic">${ok ? s.icon : '🔒'}</div><div class="nm">${s.name}<div class="st">${'★'.repeat(s.diff)}${'☆'.repeat(4 - s.diff)}</div></div></div>
        <div class="ds meta">${ok ? '最长 ' + best + win + ' · 金币×' + s.goldMul : '🔒 通关上一关解锁'}</div></button>`;
    }
    h += `</div><div class="stage-desc">${SF.STAGES[d.sel.stage].icon} ${SF.STAGES[d.sel.stage].desc}</div><div>`;
        h += `</div><div class="sec-t">选择角色</div><div class="chars">`;
    for (const id in SF.CHARS) {
      const c = SF.CHARS[id], own = d.chars.includes(id);
      h += `<button class="chr ${focusChar === id ? 'sel' : ''} ${own ? '' : 'lock'}" data-act="char" data-id="${id}">
        <img alt="" src="${SF.Sprites.charIcon(id)}"><div class="n">${c.name}</div>${own ? '<div class="pr">&nbsp;</div>' : `<div class="pr">🪙${c.cost}</div>`}</button>`;
    }
    h += '</div>';
    const c = SF.CHARS[focusChar], own = d.chars.includes(focusChar), W = SF.WEAPONS[c.start];
    h += `<div class="detail"><div class="t">${c.name} · ${c.title}</div>
      <div class="s">初始武器：<b>${W.icon} ${W.name}</b> — ${W.desc}<br>天赋：${c.perk}</div></div>`;
    h += `<div class="startbar">`;
    if (own) h += `<button class="btn gold" data-act="start">▶ 开始战斗</button>`;
    else h += `<button class="btn ${d.gold >= c.cost ? 'gold' : 'sec dis'}" data-act="buyChar">🔓 解锁 ${c.name}　🪙 ${c.cost}</button>`;
    return h + '</div></div>';
  },
  shop() {
    const d = Save.data;
    let h = `<div class="screen">${bar('强化商店')}<div class="list">`;
    for (const id in SF.META) {
      const m = SF.META[id], lv = d.meta[id] || 0, max = lv >= m.max, cost = max ? 0 : SF.metaCost(id, lv);
      h += `<div class="card"><div class="ic">${m.icon}</div><div class="bd"><div class="nm">${m.name} <span style="color:var(--dim);font-size:12px">Lv.${lv}/${m.max}</span></div>
        <div class="ds">${m.txt}</div>${pips(lv, m.max)}</div>
        <button class="btn sm ${max ? 'sec dis' : d.gold >= cost ? 'gold' : 'sec dis'}" style="min-width:76px" data-act="buy" data-id="${id}">${max ? '已满' : '🪙' + cost}</button></div>`;
    }
    return h + '</div></div>';
  },
  ach() {
    const d = Save.data;
    let bt = 0; for (const id of SF.STAGE_ORDER) bt = Math.max(bt, d.best[id] || 0);
    let h = `<div class="screen">${bar('成就与统计')}
      <div class="stat-grid"><div><b>${U.fmtNum(d.kills)}</b><span>累计击杀</span></div><div><b>${d.runs}</b><span>出征次数</span></div>
      <div><b>${d.wins}</b><span>通关次数</span></div><div><b>${U.fmtTime(bt)}</b><span>最长存活</span></div>
      <div><b>${d.bestLv}</b><span>最高等级</span></div><div><b>${d.bosses}</b><span>击败 Boss</span></div></div><div class="list">`;
    const ctx = Object.assign({}, d, { bestTime: bt });
    for (const a of SF.ACHS) {
      const done = !!d.ach[a.id];
      h += `<div class="card ach ${done ? 'done' : ''}"><div class="ic">${done ? '🏆' : '🔘'}</div><div class="bd"><div class="nm">${a.name}</div><div class="ds">${a.desc}</div></div>
        <div style="font:800 13px system-ui;color:${done ? '#7aff9a' : 'var(--gold)'}">${done ? '已达成' : '🪙' + a.gold}</div></div>`;
    }
    return h + '</div></div>';
  },
  set() {
    const s = Save.data.set;
    const row = (k, t) => `<div class="set-row"><span>${t}</span><button class="sw ${s[k] ? 'on' : ''}" data-act="tog" data-k="${k}" aria-label="${t}"></button></div>`;
    const full = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    return `<div class="screen">${bar('设置')}<div class="list">
      ${row('sound', '🔊 音效')}${row('music', '🎵 背景音乐')}${row('vib', '📳 受伤震动')}${row('dmg', '💥 伤害数字')}${row('hq', '✨ 高清画质（耗电）')}
      <div class="set-row"><span>🕹 摇杆模式</span><div class="seg"><button class="${s.joy === 'float' ? 'on' : ''}" data-act="joy" data-v="float">浮动</button><button class="${s.joy === 'fixed' ? 'on' : ''}" data-act="joy" data-v="fixed">固定</button></div></div>
      ${full ? '<button class="btn sec" data-act="fs">⛶ 切换全屏</button>' : ''}
      <button class="btn red" data-act="reset">🗑 重置存档</button>
      <div class="ds" style="text-align:center;color:var(--dim);font-size:12px;margin-top:6px">星陨战记 v1.0 · 数据仅保存在本机浏览器</div>
    </div></div>`;
  }
};
function show(name) {
  const old = scr.firstElementChild, st = old ? old.scrollTop : 0;
  cur = name;
  scr.innerHTML = VIEWS[name]();
  if (old && (name === 'select' || name === 'shop')) scr.firstElementChild.scrollTop = st;
}
UI.goMenu = function () {
  document.body.classList.remove('playing');
  UI.hideModal(); SF.Input.showJoy(false);
  G.state = 'menu';
  show('menu');
  SF.Audio.music('menu');
};
UI.onStart = function () {
  document.body.classList.add('playing');
  scr.innerHTML = ''; UI.hideModal(); SF.Input.showJoy(true);
  hud.timer.textContent = '00:00'; hud.bossbar.style.display = 'none';
  hud.cache = {};
  UI.refreshItems();
  if (!Save.data.runs) UI.banner('👆 按住屏幕拖动移动\n武器会自动攻击', 3200);
};

/* ------------------------- 事件 ------------------------- */
function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  SF.Audio.resume();
  if (performance.now() < lockUntil && modal.classList.contains('on')) return;
  const act = t.dataset.act, d = Save.data;
  const rer = () => show(cur);
  const click = (n) => SF.Audio.sfx(n || 'ui');
  switch (act) {
    case 'goMenu': click('back'); show('menu'); break;
    case 'goSelect': click(); focusChar = d.sel.char; show('select'); break;
    case 'goShop': click(); show('shop'); break;
    case 'goAch': click(); show('ach'); break;
    case 'goSet': click(); show('set'); break;
    case 'stage': if (d.stages.includes(t.dataset.id)) { click(); d.sel.stage = t.dataset.id; Save.save(); rer(); } else UI.toast('🔒 通关上一关后解锁'); break;
    case 'char': {
      click(); focusChar = t.dataset.id;
      if (d.chars.includes(focusChar)) { d.sel.char = focusChar; Save.save(); }
      rer(); break;
    }
    case 'buyChar': {
      const c = SF.CHARS[focusChar];
      if (d.gold >= c.cost) { d.gold -= c.cost; d.chars.push(focusChar); d.sel.char = focusChar; Save.save(); SF.Audio.sfx('pick'); UI.toast('已解锁 ' + c.name); }
      else UI.toast('金币不足');
      rer(); break;
    }
    case 'start': {
      if (!d.chars.includes(focusChar)) break;
      click(); d.sel.char = focusChar; Save.save();
      SF.Audio.resume();
      SF.Game.start(d.sel.stage, d.sel.char);
      break;
    }
    case 'buy': {
      const id = t.dataset.id, m = SF.META[id], lv = d.meta[id] || 0;
      if (lv >= m.max) break;
      const cost = SF.metaCost(id, lv);
      if (d.gold >= cost) { d.gold -= cost; d.meta[id] = lv + 1; Save.save(); SF.Audio.sfx('pick'); }
      else UI.toast('金币不足');
      rer(); break;
    }
    case 'tog': {
      const k = t.dataset.k; d.set[k] = !d.set[k]; Save.save(); click(); applySettings(); rer(); break;
    }
    case 'joy': click(); d.set.joy = t.dataset.v; Save.save(); rer(); break;
    case 'fs': {
      const el = document.documentElement;
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (el.requestFullscreen) el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch (err) { /* 忽略 */ }
      break;
    }
    case 'reset': confirmBox('重置存档', '将清除所有金币、强化、角色与成就，且无法恢复。确定吗？', 'doReset'); break;
    case 'doReset': Save.reset(); applySettings(); UI.hideModal(); focusChar = 'aileen'; SF.Audio.sfx('back'); show('menu'); UI.toast('存档已重置'); break;
    case 'cancel': click('back'); UI.hideModal(); break;
    // 对局内
    case 'pick': SF.Game.pick(+t.dataset.i); break;
    case 'reroll': click(); SF.Game.reroll(); break;
    case 'skipLv': click(); SF.Game.skipLevel(); break;
    case 'chestOk': SF.Game.closeChest(); break;
    case 'resume': click(); SF.Game.resume(); break;
    case 'quit': confirmBox('放弃本局', '现在退出将直接结算已获得的金币。', 'doQuit'); break;
    case 'doQuit': UI.hideModal(); SF.Game.quit(); break;
    case 'again': click(); SF.Game.start(G.stage.id, G.chId); break;
    case 'home': click(); UI.goMenu(); break;
  }
}
function applySettings() {
  const s = Save.data.set;
  SF.Audio.set(s.sound, s.music);
  SF.Render.resize();
}
UI.applySettings = applySettings;
function confirmBox(title, text, yes) {
  openModal(`<div class="dlg"><h3>${title}</h3><div class="hint" style="margin:10px 0 16px;font-size:14px">${text}</div>
    <div class="row"><button class="btn sec" data-act="cancel">取消</button><button class="btn red" data-act="${yes}">确定</button></div></div>`);
}
function openModal(html, lock) {
  modal.innerHTML = html; modal.classList.add('on');
  lockUntil = performance.now() + (lock || 0);
}
// 回到前台时若处于暂停但弹窗丢失，则重新显示
UI.ensurePause = function () {
  if (G.state === 'paused' && !modal.classList.contains('on')) UI.showPause();
};
UI.hideModal = function () { modal.classList.remove('on'); modal.innerHTML = ''; };

/* ------------------------- 对局内弹窗 ------------------------- */
function buildHtml() {
  let h = '<div class="build">';
  for (const w of G.weapons) { const i = SF.weaponInfo(w.id, w.evo); h += `<span title="${i.name}">${i.icon}<em>${w.lv}</em></span>`; }
  for (const id in G.passives) h += `<span title="${SF.PASSIVES[id].name}">${SF.PASSIVES[id].icon}<em>${G.passives[id]}</em></span>`;
  return h + '</div>';
}
function optHtml(o, i) {
  let icon, name, desc, cls = '', tag = '';
  if (o.type === 'evo') {
    const W = SF.WEAPONS[o.id]; icon = W.evo.icon; name = W.evo.name; cls = 'w evo';
    desc = W.evo.desc + '（' + W.name + ' 进化）'; tag = '<span class="lv new">进化</span>';
  } else if (o.type === 'w' || o.type === 'wn') {
    const W = SF.WEAPONS[o.id]; icon = W.icon; name = W.name; cls = 'w';
    if (o.type === 'wn') { desc = W.desc; tag = '<span class="lv new">NEW</span>'; }
    else { desc = W.lv[o.lv - 2].t; if (o.lv >= SF.MAX_WLV) desc += `<br><span style="color:#ffd24a">搭配 ${SF.PASSIVES[W.evo.need].icon}${SF.PASSIVES[W.evo.need].name} 可进化</span>`; tag = `<span class="lv ${o.lv >= SF.MAX_WLV ? 'max' : ''}">Lv.${o.lv - 1} → ${o.lv}${o.lv >= SF.MAX_WLV ? ' MAX' : ''}</span>`; }
  } else if (o.type === 'p' || o.type === 'pn') {
    const P = SF.PASSIVES[o.id]; icon = P.icon; name = P.name; desc = P.txt; cls = 'p';
    tag = o.type === 'pn' ? '<span class="lv new">NEW</span>' : `<span class="lv ${o.lv >= P.max ? 'max' : ''}">Lv.${o.lv - 1} → ${o.lv}${o.lv >= P.max ? ' MAX' : ''}</span>`;
  } else if (o.type === 'heal') { icon = '🍖'; name = '美味烤肉'; desc = '回复 40% 最大生命'; }
  else { icon = '💰'; name = '金币袋'; desc = '获得一笔金币'; }
  return `<button class="opt ${cls}" data-act="pick" data-i="${i}"><div class="ic">${icon}</div><div class="bd"><div class="nm">${name} ${tag}</div><div class="ds">${desc}</div></div></button>`;
}
UI.showLevelUp = function (opts) {
  openModal(`<div class="dlg"><h3>⬆ 升级！Lv.${G.level}</h3><div class="hint">选择一项强化${G.pending > 1 ? '（还有 ' + (G.pending - 1) + ' 次升级）' : ''}</div>
    <div class="opts">${opts.map(optHtml).join('')}</div>
    <div class="row"><button class="btn sec sm ${G.rerolls > 0 ? '' : 'dis'}" data-act="reroll">🎲 刷新 ×${G.rerolls}</button><button class="btn sec sm ${G.skips > 0 ? '' : 'dis'}" data-act="skipLv">⏭ 跳过 ×${G.skips}</button></div>
    ${buildHtml()}</div>`, 420);
};
UI.showChest = function (list, gold) {
  let h = '<div class="opts">';
  for (const o of list) h += optHtml(o, 0).replace('data-act="pick"', 'data-act="noop"');
  h += '</div>';
  openModal(`<div class="dlg"><h3 style="color:var(--gold)">🎁 宝箱开启！</h3><div class="hint">获得以下强化，以及 🪙 ${gold}</div>${h}
    <button class="btn gold" data-act="chestOk">太棒了！</button></div>`, 500);
};
UI.showPause = function () {
  openModal(`<div class="dlg"><h3>⏸ 已暂停</h3><div class="hint">${G.stage.name} · ${U.fmtTime(G.time)} · 击杀 ${G.kills}</div>${buildHtml()}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
    <button class="btn gold" data-act="resume">▶ 继续战斗</button>
    <button class="btn red sm" style="width:100%" data-act="quit">放弃本局</button></div></div>`, 150);
};
UI.showResult = function (r) {
  document.body.classList.remove('playing'); SF.Input.showJoy(false);
  hud.bossbar.style.display = 'none';
  let ach = '';
  for (const a of r.newAch) ach += `<div class="ach-new">🏆 成就达成：<b>${a.name}</b>　+🪙${a.gold}</div>`;
  if (r.unlocked) ach += `<div class="ach-new">🔓 新关卡解锁：<b>${r.unlocked.name}</b></div>`;
  const title = r.win ? '🏆 战斗胜利！' : r.quit ? '已撤退' : '💀 你倒下了';
  openModal(`<div class="dlg"><h3 class="${r.win ? 'win' : 'lose'}">${title}</h3><div class="hint">${r.stage.name}</div>
    <div class="res-grid"><div><b>${U.fmtTime(r.time)}</b><span>存活时间</span></div><div><b>${r.kills}</b><span>击杀数</span></div>
    <div><b>Lv.${r.level}</b><span>最终等级</span></div><div><b>${r.bosses}</b><span>击败 Boss</span></div>
    <div><b>🪙 ${r.gold}</b><span>拾取金币</span></div><div><b>🪙 ${r.bonus}</b><span>表现奖励${r.win ? '（通关 ×1.5）' : ''}</span></div></div>
    <div class="res-total">获得 🪙 ${r.total}</div>${ach}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
    <button class="btn gold" data-act="again">↻ 再来一局</button><button class="btn sec" data-act="home">返回主界面</button></div></div>`, 700);
};

/* ------------------------- HUD ------------------------- */
let bannerTimer = 0;
UI.banner = function (text, ms) {
  const b = hud.banner;
  b.textContent = text; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  b.style.animationDuration = ((ms || 2000) / 1000) + 's';
};
UI.toast = function (text) {
  const box = $('#toasts'), t = document.createElement('div');
  while (box.children.length >= 3) box.firstChild.remove();
  t.className = 'toast'; t.textContent = text; box.appendChild(t);
  setTimeout(() => t.remove(), 1900);
};
UI.refreshItems = function () {
  let h = '';
  for (const w of G.weapons) h += `<span class="${w.evo ? 'evo' : ''}">${SF.weaponInfo(w.id, w.evo).icon}<em class="${w.lv >= SF.MAX_WLV ? 'max' : ''}">${w.lv}</em></span>`;
  for (const id in G.passives) h += `<span class="p">${SF.PASSIVES[id].icon}<em class="${G.passives[id] >= SF.PASSIVES[id].max ? 'max' : ''}">${G.passives[id]}</em></span>`;
  hud.items.innerHTML = h;
};
UI.updateHud = function () {
  if (!document.body.classList.contains('playing') || !G.p) return;
  const c = hud.cache || (hud.cache = {}), P = G.p;
  const xp = Math.min(100, G.xp / G.xpNeed * 100).toFixed(1);
  if (c.xp !== xp) { c.xp = xp; hud.xpi.style.width = xp + '%'; }
  if (c.lv !== G.level) { c.lv = G.level; hud.lvl.textContent = 'Lv.' + G.level; }
  const hp = Math.max(0, Math.ceil(P.hp)), hpKey = hp + '/' + P.maxHp;
  if (c.hp !== hpKey) { c.hp = hpKey; hud.hptxt.textContent = hpKey; hud.hpi.style.width = Math.max(0, P.hp / P.maxHp * 100) + '%'; }
  const tm = U.fmtTime(G.time);
  if (c.tm !== tm) { c.tm = tm; hud.timer.textContent = tm; }
  if (c.k !== G.kills) { c.k = G.kills; hud.kills.textContent = '💀 ' + G.kills; }
  if (c.g !== G.gold) { c.g = G.gold; hud.gold.textContent = '🪙 ' + G.gold; }
  const v = Math.max(0, G.hurtFlash).toFixed(2);
  if (c.v !== v) { c.v = v; hud.vig.style.opacity = v; }
  const b = G.bossRef;
  if (b) {
    if (c.b !== b.id) { c.b = b.id; hud.bossname.textContent = '💀 ' + b.def.name; hud.bossbar.style.display = 'block'; }
    hud.bossi.style.width = Math.max(0, b.hp / b.maxHp * 100).toFixed(1) + '%';
  } else if (c.b) { c.b = 0; hud.bossbar.style.display = 'none'; }
};
})(window.SF = window.SF || {});
