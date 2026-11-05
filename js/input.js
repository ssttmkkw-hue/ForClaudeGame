/* 输入：触摸虚拟摇杆（浮动/固定）+ 键盘 */
(function (SF) {
'use strict';
const In = SF.Input = { ax: 0, ay: 0, active: false, keys: {}, onPause: null };
const R = 56;
let touchId = null, ox = 0, oy = 0, joyEl, baseEl, knobEl, area;

In.init = function () {
  joyEl = document.getElementById('joy');
  baseEl = joyEl.querySelector('b'); knobEl = joyEl.querySelector('i');
  area = document.getElementById('touch');
  area.addEventListener('pointerdown', e => {
    if (touchId !== null) return;
    touchId = e.pointerId;
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    const fixed = SF.Save.data.set.joy === 'fixed';
    if (fixed) { ox = Math.min(110, innerWidth * .28); oy = innerHeight - 130; }
    else { ox = e.clientX; oy = e.clientY; }
    joyEl.style.display = 'block';
    joyEl.style.transform = `translate(${ox}px,${oy}px)`;
    In.active = true;
    move(e);
  });
  area.addEventListener('pointermove', e => { if (e.pointerId === touchId) move(e); });
  const end = e => {
    if (e.pointerId !== touchId) return;
    touchId = null; In.active = false; In.ax = In.ay = 0;
    knobEl.style.transform = 'translate(0,0)';
    if (SF.Save.data.set.joy !== 'fixed') joyEl.style.display = 'none';
  };
  area.addEventListener('pointerup', end);
  area.addEventListener('pointercancel', end);
  area.addEventListener('lostpointercapture', end);
  area.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    In.keys[k] = true;
    if (k === 'escape' || k === 'p') { if (In.onPause) In.onPause(); }
    if (!e.repeat && SF.Feat && SF.G.state === 'play') {
      if (k === ' ' || k === 'shift') SF.Feat.dash();
      else if (k === 'q') SF.Feat.ult();
      else if (k === 'f' || k === 'e') SF.Feat.toggleMount();
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { In.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { In.keys = {}; });
};
// 在进入对局时调用：固定摇杆模式下一直显示底座
In.showJoy = function (on) {
  if (!joyEl) return;
  if (on && SF.Save.data.set.joy === 'fixed') {
    ox = Math.min(110, innerWidth * .28); oy = innerHeight - 130;
    joyEl.style.display = 'block'; joyEl.style.transform = `translate(${ox}px,${oy}px)`;
  } else if (!In.active) joyEl.style.display = 'none';
};
function move(e) {
  let dx = e.clientX - ox, dy = e.clientY - oy;
  const d = Math.hypot(dx, dy);
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  knobEl.style.transform = `translate(${dx}px,${dy}px)`;
  const m = Math.min(1, d / R);
  if (m < .12) { In.ax = In.ay = 0; return; }
  In.ax = dx / (d || 1) * m; In.ay = dy / (d || 1) * m;
}
// 读取最终移动向量
In.vec = function () {
  if (In.active) return [In.ax, In.ay];
  const k = In.keys;
  let x = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
  let y = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
  if (x && y) { x *= .7071; y *= .7071; }
  if (x || y) return [x, y];
  return [In.ax, In.ay]; // 测试/机器人可直接写入
};
})(window.SF = window.SF || {});
