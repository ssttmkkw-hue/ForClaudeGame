/* 入口与主循环 */
(function (SF) {
'use strict';
const G = SF.G;

function boot() {
  SF.Save.load();
  { const d = SF.Save.data, ord = SF.STAGE_ORDER; let last = 0; ord.forEach((id, i) => { if (d.stages.includes(id) || d.best[id + '_win']) last = Math.max(last, i + (d.best[id + '_win'] ? 1 : 0)); });
    for (let i = 0; i <= Math.min(last, ord.length - 1); i++) if (!d.stages.includes(ord[i])) d.stages.push(ord[i]); }
  const s = SF.Save.data.set;
  SF.Audio.set(s.sound, s.music);
  SF.Render.init(document.getElementById('cv'));
  SF.Input.init();
  document.documentElement.style.setProperty('--coin', 'url(' + SF.Sprites.pickupURL('coin') + ')');
  SF.UI.init();
  SF.UI.goMenu();

  // 首次交互后解锁音频
  const unlock = () => { SF.Audio.resume(); if (G.state === 'menu') SF.Audio.music('menu'); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // 阻止手势缩放/橡皮筋
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (document.body.classList.contains('playing')) e.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouchEnd < 300) e.preventDefault(); lastTouchEnd = n; }, { passive: false });

  let last = performance.now(), errCount = 0;
  // 从后台回来：重建画布与贴图，并保证暂停弹窗可见
  const revive = () => {
    last = performance.now();
    try { SF.Render.reset(); } catch (e) { /* 忽略 */ }
    SF.UI.ensurePause();
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revive(); });
  window.addEventListener('pageshow', revive);
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    if (G.state === 'play') {
      SF.Render.perfSample(dt);
      const n = Math.max(1, Math.ceil(dt / 0.034));
      for (let i = 0; i < n; i++) SF.Game.update(dt / n);
    }
    if (G.stage && G.p && G.state !== 'menu') {
      try { SF.Render.draw(); errCount = 0; }
      catch (e) {
        // 绘制出错（如贴图被回收）：重置缓存后下一帧重试
        if (errCount++ < 3) console.error('render error', e);
        try { SF.Render.reset(); } catch (e2) { /* 忽略 */ }
      }
    }
    try { SF.UI.updateHud(); } catch (e) { /* 忽略 */ }
  }
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.SF = window.SF || {});
