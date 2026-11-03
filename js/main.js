/* 入口与主循环 */
(function (SF) {
'use strict';
const G = SF.G;

function boot() {
  SF.Save.load();
  const s = SF.Save.data.set;
  SF.Audio.set(s.sound, s.music);
  SF.Render.init(document.getElementById('cv'));
  SF.Input.init();
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

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    if (G.state === 'play') {
      const n = Math.max(1, Math.ceil(dt / 0.034));
      for (let i = 0; i < n; i++) SF.Game.update(dt / n);
    }
    if (G.stage && G.p && G.state !== 'menu') SF.Render.draw();
    SF.UI.updateHud();
  }
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.SF = window.SF || {});
