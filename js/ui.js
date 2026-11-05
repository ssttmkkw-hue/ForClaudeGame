/* DOM 界面：菜单、商店、成就、设置、弹窗、HUD */
(function (SF) {
'use strict';
const U = SF.U, Save = SF.Save, G = SF.G;
const UI = SF.UI = {};
const $ = s => document.querySelector(s);
let scr, modal, cur = 'menu', focusChar = null, lockUntil = 0;
const hud = {};
const I = k => SF.Icons.img(k);
const COIN = () => '<i class="coin"></i>';

UI.init = function () {
  scr = $('#screens'); modal = $('#modal');
  for (const id of ['xpbar', 'lvl', 'hpbar', 'hptxt', 'timer', 'kills', 'gold', 'items', 'bossbar', 'bossname', 'banner', 'vig']) hud[id] = document.getElementById(id);
  hud.kills.innerHTML = `<img class="ico" src="${SF.Icons.url('x:skull')}" alt=""><b>0</b>`;
  hud.gold.innerHTML = `${COIN()}<b>0</b>`;
  hud.killsN = hud.kills.querySelector('b'); hud.goldN = hud.gold.querySelector('b');
  hud.xpi = hud.xpbar.querySelector('i'); hud.hpi = hud.hpbar.querySelector('i'); hud.bossi = hud.bossbar.querySelector('i');
  document.getElementById('app').addEventListener('click', onClick);
  document.getElementById('btn-pause').addEventListener('click', e => { e.stopPropagation(); SF.Audio.resume(); SF.Game.pause(); });
  SF.Input.onPause = () => { if (G.state === 'play') SF.Game.pause(); else if (G.state === 'paused') SF.Game.resume(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { SF.Game.pause(); SF.Audio.suspend(); } else SF.Audio.resume(); });
  focusChar = Save.data.sel.char;
  // 主动技能 / 操控按钮（pointerdown 立即响应，不影响摇杆）
  hud.mini = $('#mini'); hud.zone = $('#zonetag');
  hud.chal = $('#chal'); hud.chalT = hud.chal.querySelector('.ct'); hud.chalP = hud.chal.querySelector('.pb i');
  hud.chalTl = hud.chal.querySelector('.tl'); hud.chalRw = hud.chal.querySelector('.rw');
  const bind = (id, fn, icon) => {
    const el = document.getElementById(id);
    if (icon) el.querySelector('img').src = SF.Icons.url(icon);
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); SF.Audio.resume(); fn(); });
    el.addEventListener('click', e => e.stopPropagation());
    return el;
  };
  hud.bDash = bind('btn-dash', () => SF.Feat.dash(), 'a:dash');
  hud.bUlt = bind('btn-ult', () => SF.Feat.ult(), 'a:ult');
  hud.bMount = bind('btn-mount', () => SF.Feat.toggleMount());
  hud.bMountImg = hud.bMount.querySelector('img'); hud.bMountTx = hud.bMount.querySelector('span');
  hud.bI = [bind('btn-i0', () => SF.Feat.useItem(0)), bind('btn-i1', () => SF.Feat.useItem(1))];
  for (const b of [hud.bDash, hud.bUlt].concat(hud.bI)) { b._cd = b.querySelector('.cd'); b._em = b.querySelector('em'); }
};

function stars() {
  let s = '<div class="stars">';
  for (let i = 0; i < 26; i++) s += `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;animation-delay:${(Math.random() * 3).toFixed(1)}s;transform:scale(${(0.5 + Math.random()).toFixed(2)})"></i>`;
  return s + '</div>';
}
function goldChip() { return `<div class="gold-chip">${COIN()}${U.fmtNum(Save.data.gold)}</div>`; }
function pips(lv, max) { let s = '<div class="pips">'; for (let i = 0; i < max; i++) s += `<i class="${i < lv ? 'on' : ''}"></i>`; return s + '</div>'; }
function bar(title, back) {
  return `<div class="bar"><button class="back" data-act="${back || 'goMenu'}" aria-label="返回">‹</button><h2>${title}</h2>${goldChip()}</div>`;
}

/* ------------------------- 各界面 ------------------------- */
const VIEWS = {
  menu() {
    const d = Save.data, qn = SF.Quests.claimable();
    return `<div class="screen menu">${stars()}
      ${goldChip()}
      <div class="logo">星陨战记</div>
      <div class="sub">STARFALL SURVIVORS</div>
      <img class="hero" alt="" src="${SF.Sprites.charIcon(d.sel.char)}">
      <div class="btns">
        <button class="btn gold" data-act="goSelect">⚔ 出 征</button>
        <button class="btn" data-act="goShop">⬆ 强化商店</button>
        <div class="row three"><button class="btn sec" data-act="goQuest">${I('x:quest')}任务${qn ? `<i class="badge">${qn}</i>` : ''}</button><button class="btn sec" data-act="goAch">${I('x:trophy')}成就</button><button class="btn sec" data-act="goSet">⚙ 设置</button></div>
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
        <div class="top"><div class="ic">${ok ? I('s:' + id) : '🔒'}</div><div class="nm">${s.name}<div class="st">${'★'.repeat(s.diff)}${'☆'.repeat(5 - s.diff)}</div></div></div>
        <div class="ds meta">${ok ? '最长 ' + best + win + ' · 金币×' + s.goldMul : '🔒 通关上一关解锁'}</div></button>`;
    }
    h += `</div><div class="stage-desc">${SF.STAGES[d.sel.stage].desc}</div><div>`;
        h += `</div><div class="sec-t">选择角色</div><div class="chars">`;
    for (const id in SF.CHARS) {
      const c = SF.CHARS[id], own = d.chars.includes(id);
      h += `<button class="chr ${focusChar === id ? 'sel' : ''} ${own ? '' : 'lock'}" data-act="char" data-id="${id}">
        <img alt="" src="${SF.Sprites.charIcon(id)}"><div class="n">${c.name}</div>${own ? '<div class="pr">&nbsp;</div>' : `<div class="pr">${COIN()}${c.cost}</div>`}</button>`;
    }
    h += '</div>';
    const c = SF.CHARS[focusChar], own = d.chars.includes(focusChar), W = SF.WEAPONS[c.start];
    h += `<div class="detail"><div class="t">${c.name} · ${c.title}</div>
      <div class="s"><span class="wpn">${SF.Icons.weapon(c.start)}<span>初始武器：<b>${W.name}</b> — ${W.desc}<br>天赋：${c.perk}</span></span></div></div>`;
    const slots = 1 + (d.meta.belt || 0), eq = (d.equip || []).slice(0, slots);
    h += `<div class="sec-t">携带道具（${eq.filter(Boolean).length}/${slots}）${slots < 2 ? '　<span style="font-size:11px;letter-spacing:0">商店购买「道具腰带」解锁第 2 格</span>' : ''}</div><div class="itemrow">`;
    for (const id in SF.ITEMS) {
      const lv = (d.items || {})[id] || 0;
      if (!lv) continue;
      h += `<button class="ichip ${eq.includes(id) ? 'on' : ''}" data-act="equip" data-id="${id}">${I('i:' + id)}<span>${SF.ITEMS[id].name}</span><em>Lv${lv}</em></button>`;
    }
    h += `</div>`;
    h += `<div class="startbar">`;
    if (own) h += `<button class="btn gold" data-act="start">▶ 开始战斗</button>`;
    else h += `<button class="btn ${d.gold >= c.cost ? 'gold' : 'sec dis'}" data-act="buyChar">🔓 解锁 ${c.name}　${COIN()}${c.cost}</button>`;
    return h + '</div></div>';
  },
  shop() {
    const d = Save.data, tab = UI.stab || 'meta';
    let h = `<div class="screen">${bar('强化商店')}
      <div class="tabs"><button class="${tab === 'meta' ? 'on' : ''}" data-act="stab" data-v="meta">永久强化</button><button class="${tab === 'item' ? 'on' : ''}" data-act="stab" data-v="item">主动道具</button></div><div class="list">`;
    if (tab === 'item') {
      h += `<div class="ds" style="text-align:center;color:var(--dim);font-size:12px">解锁后可在出征前携带，战斗中点击右下角按钮使用（键盘 1 / 2）</div>`;
      for (const id in SF.ITEMS) {
        const it = SF.ITEMS[id], lv = (d.items || {})[id] || 0, max = lv >= SF.ITEM_MAX;
        const cost = lv === 0 ? it.cost : max ? 0 : SF.itemUpCost(id, lv);
        h += `<div class="card"><div class="ic${lv ? '' : ' off'}">${I('i:' + id)}</div><div class="bd"><div class="nm">${it.name} <span style="color:var(--dim);font-size:12px">${lv ? 'Lv.' + lv + '/' + SF.ITEM_MAX : '未解锁'} · 冷却 ${it.cd}秒</span></div>
          <div class="ds">${it.desc}${lv && !max ? '<br>升级：' + it.up : ''}</div>${pips(lv, SF.ITEM_MAX)}</div>
          <button class="btn sm ${max ? 'sec dis' : d.gold >= cost ? 'gold' : 'sec dis'}" style="min-width:76px" data-act="buyItem" data-id="${id}">${max ? '已满' : (lv ? '' : '解锁 ') + COIN() + cost}</button></div>`;
      }
      return h + '</div></div>';
    }
    for (const id in SF.META) {
      const m = SF.META[id], lv = d.meta[id] || 0, max = lv >= m.max, cost = max ? 0 : SF.metaCost(id, lv);
      h += `<div class="card"><div class="ic">${I('m:' + id)}</div><div class="bd"><div class="nm">${m.name} <span style="color:var(--dim);font-size:12px">Lv.${lv}/${m.max}</span></div>
        <div class="ds">${m.txt}</div>${pips(lv, m.max)}</div>
        <button class="btn sm ${max ? 'sec dis' : d.gold >= cost ? 'gold' : 'sec dis'}" style="min-width:76px" data-act="buy" data-id="${id}">${max ? '已满' : COIN() + cost}</button></div>`;
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
      h += `<div class="card ach ${done ? 'done' : ''}"><div class="ic${done ? '' : ' off'}">${I('x:trophy')}</div><div class="bd"><div class="nm">${a.name}</div><div class="ds">${a.desc}</div></div>
        <div style="font:800 13px system-ui;color:${done ? '#7aff9a' : 'var(--gold)'}">${done ? '已达成' : COIN() + a.gold}</div></div>`;
    }
    return h + '</div></div>';
  },
  quest() {
    const d = Save.data, dl = SF.Quests.ensureDaily(), tab = UI.qtab || 'daily';
    let h = `<div class="screen">${bar('任务')}
      <div class="tabs"><button class="${tab === 'daily' ? 'on' : ''}" data-act="qtab" data-v="daily">每日任务</button><button class="${tab === 'main' ? 'on' : ''}" data-act="qtab" data-v="main">主线任务</button></div><div class="list">`;
    if (tab === 'daily') {
      h += `<div class="ds" style="text-align:center;color:var(--dim);font-size:12px">每天 0 点刷新 · 进度在每局结束时结算 · 今日可免费更换 ${dl.reroll} 次</div>`;
      dl.list.forEach((q, i) => {
        const def = SF.Quests.def(q.id), done = q.prog >= q.n, pc = Math.min(100, q.prog / q.n * 100);
        const pv = def.key === 'time' ? `${U.fmtTime(Math.min(q.prog, q.n))} / ${U.fmtTime(q.n)}` : `${Math.min(q.prog, q.n)} / ${q.n}`;
        h += `<div class="card quest ${q.claimed ? 'claimed' : done ? 'done' : ''}"><div class="ic">${I(def.icon)}</div><div class="bd">
          <div class="nm">${def.txt(q.n)}</div><div class="qbar"><i style="width:${pc}%"></i><span>${pv}</span></div>
          <div class="ds">奖励 ${COIN()}${q.gold}${!q.claimed && !done && dl.reroll > 0 ? `　<button class="link" data-act="qreroll" data-i="${i}">🎲 换一个</button>` : ''}</div></div>
          <button class="btn sm ${q.claimed ? 'sec dis' : done ? 'gold' : 'sec dis'}" data-act="qclaim" data-i="${i}">${q.claimed ? '已领取' : done ? '领取' : '进行中'}</button></div>`;
      });
    } else {
      const idx = d.mainIdx || 0, M = SF.Quests.MAIN;
      h += `<div class="ds" style="text-align:center;color:var(--dim);font-size:12px">主线进度 ${Math.min(idx, M.length)} / ${M.length}</div>`;
      M.forEach((q, i) => {
        if (i < idx - 1 || i > idx + 3) return;
        const cur = i === idx, past = i < idx, pg = SF.Quests.mainProg(q), done = cur && pg >= q.n;
        const pv = q.time ? `${U.fmtTime(pg)} / ${U.fmtTime(q.n)}` : `${pg} / ${q.n}`;
        h += `<div class="card quest ${past ? 'claimed' : done ? 'done' : cur ? '' : 'lock'}"><div class="ic">${I(q.icon)}</div><div class="bd">
          <div class="nm">${i + 1}. ${q.txt}</div>${cur ? `<div class="qbar"><i style="width:${Math.min(100, pg / q.n * 100)}%"></i><span>${pv}</span></div>` : ''}
          <div class="ds">奖励 ${COIN()}${q.gold}</div></div>
          ${cur ? `<button class="btn sm ${done ? 'gold' : 'sec dis'}" data-act="mclaim">${done ? '领取' : '进行中'}</button>` : past ? '<span class="qok">✔</span>' : '<span class="qok">🔒</span>'}</div>`;
      });
      if (idx >= M.length) h += `<div class="card quest done"><div class="bd"><div class="nm">🏆 主线任务已全部完成！</div></div></div>`;
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
UI.show = n => show(n);
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
  if (!Save.data.runs) UI.banner('👆 拖动屏幕移动，武器自动攻击\n右下角按钮释放技能', 3600);
  hud.chal.style.display = 'none'; c0 = {};
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
    case 'goQuest': click(); show('quest'); break;
    case 'stab': click(); UI.stab = t.dataset.v; rer(); break;
    case 'buyItem': {
      const id = t.dataset.id, it = SF.ITEMS[id]; d.items = d.items || {};
      const lv = d.items[id] || 0;
      if (lv >= SF.ITEM_MAX) break;
      const cost = lv === 0 ? it.cost : SF.itemUpCost(id, lv);
      if (d.gold >= cost) {
        d.gold -= cost; d.items[id] = lv + 1; d.metaBuys = (d.metaBuys || 0) + 1;
        if (!lv) { d.equip = d.equip || []; const slots = 1 + (d.meta.belt || 0); if (d.equip.filter(Boolean).length < slots) { const k = d.equip[0] ? 1 : 0; d.equip[k] = id; } }
        Save.save(); SF.Audio.sfx('pick'); UI.toast(lv ? '已升级 ' + it.name : '已解锁 ' + it.name);
      } else UI.toast('金币不足');
      rer(); break;
    }
    case 'equip': {
      const id = t.dataset.id, slots = 1 + (d.meta.belt || 0);
      let eq = (d.equip || []).slice(0, slots).filter(Boolean);
      if (eq.includes(id)) eq = eq.filter(x => x !== id);
      else { if (eq.length >= slots) eq.shift(); eq.push(id); }
      d.equip = eq; Save.save(); click(); rer(); break;
    }
    case 'qtab': click(); UI.qtab = t.dataset.v; rer(); break;
    case 'qclaim': { const g = SF.Quests.claimDaily(+t.dataset.i); if (g) { SF.Audio.sfx('chest'); UI.toast('获得 ' + g + ' 金币'); } rer(); break; }
    case 'qreroll': { if (SF.Quests.rerollDaily(+t.dataset.i)) click(); rer(); break; }
    case 'mclaim': { const g = SF.Quests.claimMain(); if (g) { SF.Audio.sfx('chest'); UI.toast('获得 ' + g + ' 金币'); } rer(); break; }
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
      if (d.gold >= cost) { d.gold -= cost; d.meta[id] = lv + 1; d.metaBuys = (d.metaBuys || 0) + 1; Save.save(); SF.Audio.sfx('pick'); }
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
  for (const w of G.weapons) h += `<span>${SF.Icons.weapon(w.id, w.evo)}<em>${w.lv}</em></span>`;
  for (const id in G.passives) h += `<span>${I('p:' + id)}<em>${G.passives[id]}</em></span>`;
  return h + '</div>';
}
function optHtml(o, i) {
  let icon, name, desc, cls = '', tag = '';
  if (o.type === 'evo') {
    const W = SF.WEAPONS[o.id]; icon = I('e:' + o.id); name = W.evo.name; cls = 'w evo';
    desc = W.evo.desc + '（' + W.name + ' 进化）'; tag = '<span class="lv new">进化</span>';
  } else if (o.type === 'w' || o.type === 'wn') {
    const W = SF.WEAPONS[o.id]; icon = I('w:' + o.id); name = W.name; cls = 'w';
    if (o.type === 'wn') { desc = W.desc; tag = '<span class="lv new">NEW</span>'; }
    else { desc = W.lv[o.lv - 2].t; if (o.lv >= SF.MAX_WLV) desc += `<br><span style="color:#ffd24a">搭配「${SF.PASSIVES[W.evo.need].name}」可进化</span>`; tag = `<span class="lv ${o.lv >= SF.MAX_WLV ? 'max' : ''}">Lv.${o.lv - 1} → ${o.lv}${o.lv >= SF.MAX_WLV ? ' MAX' : ''}</span>`; }
  } else if (o.type === 'p' || o.type === 'pn') {
    const P = SF.PASSIVES[o.id]; icon = I('p:' + o.id); name = P.name; desc = P.txt; cls = 'p';
    tag = o.type === 'pn' ? '<span class="lv new">NEW</span>' : `<span class="lv ${o.lv >= P.max ? 'max' : ''}">Lv.${o.lv - 1} → ${o.lv}${o.lv >= P.max ? ' MAX' : ''}</span>`;
  } else if (o.type === 'heal') { icon = I('x:meat'); name = '美味烤肉'; desc = '回复 40% 最大生命'; }
  else { icon = I('x:coins'); name = '金币袋'; desc = '获得一笔金币'; }
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
  openModal(`<div class="dlg"><h3 style="color:var(--gold)">🎁 宝箱开启！</h3><div class="hint">获得以下强化，以及 ${COIN()}${gold}</div>${h}
    <button class="btn gold" data-act="chestOk">太棒了！</button></div>`, 500);
};
UI.showPause = function () {
  const pool = (G.wpool || []).map(id => `<span class="${G.weapons.some(w => w.id === id) ? 'got' : ''}">${SF.Icons.weapon(id)}</span>`).join('');
  openModal(`<div class="dlg"><h3>⏸ 已暂停</h3><div class="hint">${G.stage.name} · ${U.fmtTime(G.time)} · 击杀 ${G.kills}</div>${buildHtml()}
    <div class="hint" style="margin:12px 0 4px">本局武器池（共 15 种中随机 10 种）</div><div class="build pool">${pool}</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
    <button class="btn gold" data-act="resume">▶ 继续战斗</button>
    <button class="btn red sm" style="width:100%" data-act="quit">放弃本局</button></div></div>`, 150);
};
UI.showResult = function (r) {
  document.body.classList.remove('playing'); SF.Input.showJoy(false);
  hud.bossbar.style.display = 'none';
  let ach = '';
  for (const a of r.newAch) ach += `<div class="ach-new">🏆 成就达成：<b>${a.name}</b>　+${COIN()}${a.gold}</div>`;
  if (r.unlocked) ach += `<div class="ach-new">🔓 新关卡解锁：<b>${r.unlocked.name}</b></div>`;
  for (const q of r.questDone || []) ach += `<div class="ach-new quest">📜 任务完成：<b>${q}</b>（前往「任务」领取）</div>`;
  if (r.run) ach += `<div class="runline">冲刺 ${r.run.dashes} 次 · 大招 ${r.run.ults} 次 · 地图武器击杀 ${r.run.mapwKills} · 挑战完成 ${r.run.chal}</div>`;
  const title = r.win ? '🏆 战斗胜利！' : r.quit ? '已撤退' : '💀 你倒下了';
  openModal(`<div class="dlg"><h3 class="${r.win ? 'win' : 'lose'}">${title}</h3><div class="hint">${r.stage.name}</div>
    <div class="res-grid"><div><b>${U.fmtTime(r.time)}</b><span>存活时间</span></div><div><b>${r.kills}</b><span>击杀数</span></div>
    <div><b>Lv.${r.level}</b><span>最终等级</span></div><div><b>${r.bosses}</b><span>击败 Boss</span></div>
    <div><b>${COIN()}${r.gold}</b><span>拾取金币</span></div><div><b>${COIN()}${r.bonus}</b><span>表现奖励${r.win ? '（通关 ×1.5）' : ''}</span></div></div>
    <div class="res-total">获得 ${COIN()}${r.total}</div>${ach}
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
  for (const w of G.weapons) h += `<span class="${w.evo ? 'evo' : ''}">${SF.Icons.weapon(w.id, w.evo)}<em class="${w.lv >= SF.MAX_WLV ? 'max' : ''}">${w.lv}</em></span>`;
  for (const id in G.passives) h += `<span class="p">${I('p:' + id)}<em class="${G.passives[id] >= SF.PASSIVES[id].max ? 'max' : ''}">${G.passives[id]}</em></span>`;
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
  if (c.k !== G.kills) { c.k = G.kills; hud.killsN.textContent = G.kills; }
  if (c.g !== G.gold) { c.g = G.gold; hud.goldN.textContent = G.gold; }
  const v = Math.max(0, G.hurtFlash).toFixed(2);
  if (c.v !== v) { c.v = v; hud.vig.style.opacity = v; }
  const b = G.bossRef;
  if (b) {
    if (c.b !== b.id) { c.b = b.id; hud.bossname.textContent = b.def.name; hud.bossbar.style.display = 'block'; }
    hud.bossi.style.width = Math.max(0, b.hp / b.maxHp * 100).toFixed(1) + '%';
  } else if (c.b) { c.b = 0; hud.bossbar.style.display = 'none'; }
  updateActs();
  // 小地图与区域提示（降频刷新）
  const now = performance.now();
  if (!c.mt || now - c.mt > 200) { c.mt = now; SF.Render.drawMini(hud.mini); }
  const zt = G.zoneTag || '';
  if (c.zt !== zt) { c.zt = zt; hud.zone.textContent = zt; hud.zone.style.display = zt ? 'block' : 'none'; }
};
let c0 = {};
function setCd(btn, p, txt, key) {
  if (c0[key + 'p'] !== p) { c0[key + 'p'] = p; btn._cd.style.setProperty('--p', p); btn.classList.toggle('ready', p === 0); }
  if (c0[key + 't'] !== txt) { c0[key + 't'] = txt; btn._em.textContent = txt; }
}
function updateActs() {
  const sk = G.sk;
  if (!sk) return;
  const dp = sk.dashCd > 0 ? Math.round(sk.dashCd / sk.dashMax * 50) / 50 : 0;
  setCd(hud.bDash, dp, sk.dashCd > 0 ? Math.ceil(sk.dashCd) : '', 'd');
  const up = sk.ultT > 0 ? 1 : sk.ultCd > 0 ? Math.round(sk.ultCd / sk.ultMax * 50) / 50 : 0;
  setCd(hud.bUlt, up, sk.ultT > 0 ? '' : sk.ultCd > 0 ? Math.ceil(sk.ultCd) : '', 'u');
  for (let i = 0; i < 2; i++) {
    const it = G.items && G.items[i], b = hud.bI[i];
    const key = it ? it.id : '';
    if (c0['ik' + i] !== key) { c0['ik' + i] = key; b.style.display = it ? 'block' : 'none'; if (it) b.querySelector('img').src = SF.Icons.url('i:' + it.id); }
    if (it) setCd(b, it.cd > 0 ? Math.round(it.cd / it.max * 50) / 50 : 0, it.cd > 0 ? Math.ceil(it.cd) : '', 'i' + i);
  }
  const mw = G.mount || G.near, mk = mw ? (G.mount ? 'x' : 'm') + mw.kind : '';
  if (c0.mk !== mk) {
    c0.mk = mk;
    hud.bMount.style.display = mw ? 'block' : 'none';
    if (mw) { hud.bMountImg.src = SF.Icons.url('k:' + mw.kind); hud.bMountTx.textContent = G.mount ? '离开' : '操控'; hud.bMount.classList.toggle('on', !!G.mount); }
  }
  // 局内挑战面板
  const ch = G.chal;
  const key = ch ? ch.txt + (ch.done ? (ch.fail ? 'F' : 'D') : '') : '';
  if (c0.ck !== key) {
    c0.ck = key;
    hud.chal.style.display = ch ? 'block' : 'none';
    if (ch) { hud.chalT.textContent = ch.txt; hud.chalRw.textContent = '奖励：' + ch.rtxt; hud.chal.className = ch.done ? (ch.fail ? 'fail' : 'ok') : ''; }
  }
  if (ch) {
    const pc = Math.min(100, ch.p / ch.n * 100).toFixed(0), tl = ch.done ? (ch.fail ? '失败' : '完成！') : Math.max(0, Math.ceil(ch.left)) + ' 秒';
    if (c0.cp !== pc) { c0.cp = pc; hud.chalP.style.width = pc + '%'; }
    if (c0.ct !== tl) { c0.ct = tl; hud.chalTl.textContent = (ch.id === 'nohit' ? '' : Math.min(ch.p, ch.n) + '/' + ch.n + ' · ') + tl; }
  }
}
})(window.SF = window.SF || {});
