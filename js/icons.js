/* UI 图标：统一风格的徽章底框 + 矢量图形（替代 emoji） */
(function (SF) {
'use strict';
const TAU = Math.PI * 2;
const Ic = SF.Icons = {};
const cache = {};
const L = () => SF.Sprites.lib;

const FRAME = {
  w: ['#4a3478', '#1c1434', '#9a86ff'],
  a: ['#7a2a3a', '#2a0c14', '#ff8a9a'],
  i: ['#1e4a6a', '#0c1c2e', '#6ad0ff'],
  k: ['#4a4a2a', '#1c1c0e', '#d8c86a'],
  e: ['#7a4a10', '#2e1806', '#ffd24a'],
  p: ['#1e5a50', '#0c2622', '#62e0b8'],
  m: ['#4a2468', '#1a0e2a', '#c88aff'],
  s: ['#2a3a5a', '#121a2e', '#8ab0ff'],
  n: ['#3a3a4a', '#16161e', '#9aa0c8']
};

/* ---------------- 图形 ---------------- */
const GL = {
  bolt(g, evo) {
    const { circ } = L(), col = evo ? '#ffd86a' : '#6fd0ff';
    g.save(); g.globalCompositeOperation = 'lighter'; g.rotate(-0.7);
    g.drawImage(SF.Sprites.comet(col), -40, -10, 64, 20);
    g.restore();
    g.save(); g.shadowColor = col; g.shadowBlur = 16;
    const gr = g.createRadialGradient(6, -6, 0, 8, -8, 14); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, col); gr.addColorStop(1, SF.Color.shade(col, -0.4));
    circ(g, 8, -8, 12, gr); g.restore();
    if (evo) for (const [x, y] of [[-14, 10], [-4, 20], [18, 12]]) g.drawImage(SF.Sprites.star('#fff2b0'), x - 7, y - 7, 14, 14);
  },
  orbit(g, evo) {
    const sw = SF.Sprites.sword(evo);
    if (evo) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45; g.drawImage(SF.Sprites.glow('#ffd24a'), -30, -34, 60, 60); g.restore(); }
    for (const a of [-0.62, 0.62]) { g.save(); g.rotate(a); g.drawImage(sw, -19, -48, 38, 76); g.restore(); }
  },
  chain(g, evo) {
    const { polyPath } = L(), col = evo ? '#c890ff' : '#ffe84a';
    g.save(); g.shadowColor = col; g.shadowBlur = 14;
    polyPath(g, [6, -32, -14, 2, -1, 2, -8, 32, 16, -6, 3, -6]);
    const gr = g.createLinearGradient(-14, -32, 16, 32); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, SF.Color.shade(col, -0.35));
    g.fillStyle = gr; g.fill(); g.restore();
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(30,20,10,.85)'; g.lineJoin = 'round'; polyPath(g, [6, -32, -14, 2, -1, 2, -8, 32, 16, -6, 3, -6]); g.stroke();
    if (evo) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-16, -20); g.lineTo(-24, -12); g.lineTo(-20, -8); g.lineTo(-28, 2); g.stroke(); }
  },
  meteor(g, evo) {
    const cA = evo ? '#ff4a9a' : '#ff7a2a';
    g.save(); g.globalCompositeOperation = 'lighter'; g.rotate(-2.3); g.drawImage(SF.Sprites.comet(cA), -10, -14, 56, 28); g.restore();
    g.drawImage(SF.Sprites.meteorRock(), -24, -8, 38, 38);
    if (evo) for (const [x, y, s] of [[14, -18, 14], [20, 10, 10]]) g.drawImage(SF.Sprites.meteorRock(), x - s / 2, y - s / 2, s, s);
  },
  nova(g, evo) {
    const col = evo ? '#e0f6ff' : '#8fdcff';
    g.save(); g.shadowColor = col; g.shadowBlur = 12; g.strokeStyle = col; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      g.save(); g.rotate(i * TAU / 6);
      g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -28); g.stroke();
      g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, -14); g.lineTo(-8, -21); g.moveTo(0, -14); g.lineTo(8, -21); g.moveTo(0, -22); g.lineTo(-5, -27); g.moveTo(0, -22); g.lineTo(5, -27); g.stroke();
      g.restore();
    }
    g.restore();
    L().circ(g, 0, 0, 6, '#ffffff');
    if (evo) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 33, 0, TAU); g.stroke(); }
  },
  axe(g, evo) {
    g.save(); g.rotate(-0.55); g.drawImage(SF.Sprites.axe(evo), -30, -30, 60, 60); g.restore();
    if (evo) { g.strokeStyle = 'rgba(120,255,200,.75)'; g.lineWidth = 3; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, 22 + i * 5, 2.2 + i * 0.3, 3.6 + i * 0.3); g.stroke(); } }
  },
  poison(g, evo) {
    const { part, circ } = L(), liq = evo ? '#a86aff' : '#6ae03a';
    part(g, () => { g.beginPath(); g.arc(0, 8, 20, 0, TAU); }, '#bfeaff', 0, 8, 20, { lw: 3, hl: 0.7 });
    g.save(); g.beginPath(); g.arc(0, 8, 17, 0, TAU); g.clip(); const gr = g.createLinearGradient(0, 4, 0, 26); gr.addColorStop(0, SF.Color.shade(liq, 0.3)); gr.addColorStop(1, SF.Color.shade(liq, -0.3)); g.fillStyle = gr; g.fillRect(-20, 4, 40, 24); g.restore();
    part(g, () => { g.beginPath(); g.rect(-6, -22, 12, 14); }, '#bfeaff', 0, -15, 8, { lw: 2.5 });
    part(g, () => { g.beginPath(); g.roundRect(-8, -28, 16, 8, 2); }, '#8a5a30', 0, -24, 8, { lw: 2.5 });
    for (const [x, y, r] of [[-6, 14, 3], [5, 10, 2.2], [2, 20, 1.8]]) circ(g, x, y, r, 'rgba(255,255,255,.75)');
    circ(g, 9, -30, 3, SF.Color.rgba(liq, 0.8)); circ(g, 14, -36, 2, SF.Color.rgba(liq, 0.6));
  },
  beam(g, evo) {
    const col = evo ? '#fff2b0' : '#ffd86a';
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(SF.Sprites.rays(col), -38, -38, 76, 76);
    g.drawImage(SF.Sprites.glow(col), -26, -26, 52, 52);
    g.restore();
    g.save(); g.shadowColor = col; g.shadowBlur = 12;
    const gr = g.createLinearGradient(-6, 0, 6, 0); gr.addColorStop(0, SF.Color.rgba(col, 0.2)); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, SF.Color.rgba(col, 0.2));
    g.fillStyle = gr; g.fillRect(-6, -34, 12, 68); g.restore();
    if (evo) g.drawImage(SF.Sprites.star('#ffffff'), -16, -16, 32, 32);
  },
  ring(g) {
    const { part, glowEye } = L();
    g.beginPath(); g.ellipse(0, 6, 22, 18, 0, 0, TAU); g.lineWidth = 12; g.strokeStyle = 'rgba(30,20,10,.85)'; g.stroke();
    g.lineWidth = 8; g.strokeStyle = L().metal(g, -22, 0, 22, 0, '#ffc83a'); g.stroke();
    part(g, () => { g.beginPath(); g.moveTo(-10, -12); g.lineTo(10, -12); g.lineTo(14, -20); g.lineTo(0, -32); g.lineTo(-14, -20); g.closePath(); }, '#ff3a5e', 0, -20, 14, { lw: 2.5, hl: 0.7 });
    glowEye(g, -4, -22, 2, '#ffffff');
  },
  hourglass(g) {
    const { part, polyPath } = L();
    part(g, () => { g.beginPath(); g.roundRect(-20, -32, 40, 8, 3); }, '#a8742f', 0, -28, 20, { lw: 2.5 });
    part(g, () => { g.beginPath(); g.roundRect(-20, 24, 40, 8, 3); }, '#a8742f', 0, 28, 20, { lw: 2.5 });
    polyPath(g, [-15, -24, 15, -24, 3, 0, 15, 24, -15, 24, -3, 0]); g.fillStyle = 'rgba(200,240,255,.45)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(30,20,10,.85)'; g.stroke();
    polyPath(g, [-9, -16, 9, -16, 2, -2, -2, -2]); g.fillStyle = '#ffd86a'; g.fill();
    polyPath(g, [0, 4, 12, 22, -12, 22]); g.fillStyle = '#ffc83a'; g.fill();
    g.fillStyle = '#ffd86a'; g.fillRect(-1, -2, 2, 10);
  },
  scroll(g) {
    const { part, line } = L();
    part(g, () => { g.beginPath(); g.rect(-20, -22, 40, 44); }, '#f2e2b8', 0, 0, 24, { lw: 2.5 });
    for (const y of [-22, 22]) part(g, () => { g.beginPath(); g.ellipse(0, y, 24, 6, 0, 0, TAU); }, '#d8b880', 0, y, 22, { lw: 2.5 });
    for (let i = 0; i < 4; i++) line(g, [-12, -10 + i * 7, 12 - (i % 2) * 6, -10 + i * 7], 2, '#a8865a');
    g.strokeStyle = '#7a5ad8'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.stroke();
  },
  boot(g) {
    const { part } = L();
    part(g, () => { g.beginPath(); g.moveTo(-10, -26); g.lineTo(8, -26); g.lineTo(8, 6); g.quadraticCurveTo(24, 8, 24, 18); g.lineTo(24, 24); g.lineTo(-12, 24); g.closePath(); }, '#c86a2a', 6, 0, 26, { lw: 3 });
    g.fillStyle = '#8a4a1a'; g.fillRect(-12, 18, 36, 6);
    for (const [y, w] of [[-18, 20], [-8, 16], [2, 12]]) { L().part(g, () => { g.beginPath(); g.moveTo(-10, y); g.quadraticCurveTo(-10 - w, y - 8, -10 - w - 4, y + 2); g.quadraticCurveTo(-12 - w * 0.5, y + 4, -10, y + 6); g.closePath(); }, '#ffffff', -10 - w / 2, y, 10, { lw: 2 }); }
  },
  heart(g) { g.drawImage(SF.Sprites.pickup('heart'), -52, -48, 104, 104); },
  leaf(g) {
    const { part, line } = L();
    g.rotate(-0.6);
    part(g, () => { g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(-26, 0, 0, -32); g.quadraticCurveTo(26, 0, 0, 30); g.closePath(); }, '#4fc05a', 0, 0, 26, { lw: 3, hl: 0.5 });
    line(g, [0, 30, 0, -26], 2.5, '#2a7a30');
    for (let i = 0; i < 3; i++) { line(g, [0, 14 - i * 12, -10, 6 - i * 12], 1.8, '#2a7a30'); line(g, [0, 14 - i * 12, 10, 6 - i * 12], 1.8, '#2a7a30'); }
  },
  shield(g) {
    const { part } = L();
    part(g, () => { g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(18, -24, 26, -24); g.quadraticCurveTo(26, 14, 0, 32); g.quadraticCurveTo(-26, 14, -26, -24); g.quadraticCurveTo(-18, -24, 0, -30); g.closePath(); }, '#c8d2e2', 0, 0, 28, { lw: 3, hl: 0.6 });
    part(g, () => { g.beginPath(); g.moveTo(0, -20); g.quadraticCurveTo(10, -16, 16, -16); g.quadraticCurveTo(16, 8, 0, 20); g.quadraticCurveTo(-16, 8, -16, -16); g.quadraticCurveTo(-10, -16, 0, -20); g.closePath(); }, '#3a6ad8', 0, 0, 18, { lw: 2 });
    g.fillStyle = '#ffd24a'; g.fillRect(-2, -12, 4, 22); g.fillRect(-9, -4, 18, 4);
  },
  magnet(g) { g.drawImage(SF.Sprites.pickup('magnet'), -46, -46, 92, 92); },
  book(g) {
    const { part, line } = L();
    part(g, () => { g.beginPath(); g.moveTo(0, -18); g.quadraticCurveTo(-16, -26, -30, -20); g.lineTo(-30, 22); g.quadraticCurveTo(-16, 16, 0, 24); g.quadraticCurveTo(16, 16, 30, 22); g.lineTo(30, -20); g.quadraticCurveTo(16, -26, 0, -18); g.closePath(); }, '#7a3ad8', 0, 0, 30, { lw: 3 });
    part(g, () => { g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(-14, -21, -26, -16); g.lineTo(-26, 18); g.quadraticCurveTo(-14, 13, 0, 19); g.quadraticCurveTo(14, 13, 26, 18); g.lineTo(26, -16); g.quadraticCurveTo(14, -21, 0, -14); g.closePath(); }, '#fff6e0', 0, 0, 26, { lw: 2, hl: false });
    line(g, [0, -14, 0, 19], 2, '#c8b080');
    for (let i = 0; i < 3; i++) { line(g, [-20, -6 + i * 7, -6, -4 + i * 7], 1.6, '#a89070'); line(g, [6, -4 + i * 7, 20, -6 + i * 7], 1.6, '#a89070'); }
    g.drawImage(SF.Sprites.star('#ffe08a'), 8, -34, 22, 22);
  },
  mirror(g) {
    const { part } = L();
    part(g, () => { g.beginPath(); g.ellipse(0, -6, 20, 25, 0, 0, TAU); }, '#ffc83a', 0, -6, 24, { lw: 3 });
    const gr = g.createLinearGradient(-14, -28, 14, 14); gr.addColorStop(0, '#e8f6ff'); gr.addColorStop(0.5, '#8ab8e8'); gr.addColorStop(1, '#4a6ac8');
    g.beginPath(); g.ellipse(0, -6, 14, 19, 0, 0, TAU); g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-7, -16); g.lineTo(3, -24); g.moveTo(-8, -6); g.lineTo(6, -18); g.stroke();
    part(g, () => { g.beginPath(); g.roundRect(-4, 18, 8, 14, 3); }, '#c89a3a', 0, 25, 6, { lw: 2.5 });
  },
  clover(g) {
    const { part, line } = L();
    line(g, [0, 4, 6, 32], 3.5, '#2a7a30');
    for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2 + Math.PI / 4); part(g, () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-16, -6, -14, -26, 0, -18); g.bezierCurveTo(14, -26, 16, -6, 0, 0); g.closePath(); }, '#4fc05a', 0, -12, 14, { lw: 2.5 }); g.restore(); }
    L().circ(g, 0, 0, 3, '#2a7a30');
  },
  coins(g) {
    const c = SF.Sprites.pickup('coin');
    for (const [x, y] of [[-14, 14], [14, 14], [0, 2], [0, -14]]) g.drawImage(c, x - 26, y - 26, 52, 52);
  },
  sword(g) { g.save(); g.rotate(0.5); g.drawImage(SF.Sprites.sword(true), -24, -56, 48, 96); g.restore(); },
  feather(g) {
    const { part, line } = L();
    g.rotate(0.5);
    g.save(); g.shadowColor = '#ff8a3a'; g.shadowBlur = 14;
    part(g, () => { g.beginPath(); g.moveTo(0, 32); g.quadraticCurveTo(-20, 0, -4, -32); g.quadraticCurveTo(22, -8, 0, 32); g.closePath(); }, '#ff6a2a', 0, 0, 26, { lw: 3, hl: 0.5 });
    g.restore();
    line(g, [0, 34, -2, -26], 2.5, '#ffd24a');
    for (let i = 0; i < 4; i++) line(g, [-1, 14 - i * 10, 9, 6 - i * 10], 1.6, '#ffb44a');
  },
  dice(g) {
    const { part, circ } = L();
    g.rotate(-0.25);
    part(g, () => { g.beginPath(); g.roundRect(-24, -24, 48, 48, 9); }, '#f4f0ea', 0, 0, 30, { lw: 3, hl: 0.6 });
    for (const [x, y] of [[-12, -12], [12, -12], [0, 0], [-12, 12], [12, 12]]) circ(g, x, y, 4.5, '#d82a3a');
  },
  skip(g) {
    const { polyPath } = L();
    for (const x of [-16, 4]) { polyPath(g, [x, -20, x + 20, 0, x, 20]); g.fillStyle = '#7ad8ff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,20,40,.85)'; g.stroke(); }
    g.fillStyle = '#7ad8ff'; g.fillRect(24, -20, 6, 40); g.strokeRect(24, -20, 6, 40);
  },
  meat(g) {
    const { part, circ } = L();
    g.rotate(-0.6);
    part(g, () => { g.beginPath(); g.ellipse(-4, -6, 20, 18, 0, 0, TAU); }, '#b8562a', -4, -6, 22, { lw: 3 });
    for (const [x, y] of [[-10, -12], [2, -2], [-8, 4]]) circ(g, x, y, 2.4, 'rgba(255,220,160,.6)');
    g.lineWidth = 9; g.strokeStyle = 'rgba(30,20,10,.85)'; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, 8); g.lineTo(24, 24); g.stroke();
    g.lineWidth = 6; g.strokeStyle = '#f6eedc'; g.stroke();
    circ(g, 25, 22, 5, '#f6eedc'); circ(g, 22, 27, 5, '#f6eedc');
  },
  skull(g) {
    const { part, ell } = L();
    part(g, () => { g.beginPath(); g.arc(0, -4, 24, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(12, 22); g.lineTo(-12, 22); g.closePath(); }, '#efe8d8', 0, -2, 26, { lw: 3 });
    ell(g, -9, -2, 7, 8, '#1a1020'); ell(g, 9, -2, 7, 8, '#1a1020');
    for (let i = 0; i < 3; i++) { g.fillStyle = '#1a1020'; g.fillRect(-7 + i * 6, 14, 2, 8); }
  },
  trophy(g) {
    const { part } = L();
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 20, -12, 9, sx > 0 ? -1.6 : 1.6, sx > 0 ? 1.6 : 4.7, sx < 0); g.lineWidth = 8; g.strokeStyle = 'rgba(30,20,10,.85)'; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#ffc83a'; g.stroke(); }
    part(g, () => { g.beginPath(); g.moveTo(-18, -26); g.lineTo(18, -26); g.quadraticCurveTo(18, 6, 0, 8); g.quadraticCurveTo(-18, 6, -18, -26); g.closePath(); }, '#ffc83a', 0, -10, 22, { lw: 3, hl: 0.6 });
    part(g, () => { g.beginPath(); g.rect(-4, 8, 8, 12); }, '#e0a020', 0, 14, 6, { lw: 2.5 });
    part(g, () => { g.beginPath(); g.roundRect(-14, 20, 28, 9, 2); }, '#8a5a30', 0, 24, 14, { lw: 2.5 });
    g.drawImage(SF.Sprites.star('#ffffff'), -16, -26, 18, 18);
  }
,
  dash(g) {
    const { line } = L();
    g.save(); g.shadowColor = '#7fe0ff'; g.shadowBlur = 10;
    for (let i = 0; i < 4; i++) line(g, [-30 + i * 4, -14 + i * 9, -4 + i * 4, -14 + i * 9], 4, i % 2 ? '#bff0ff' : '#7fd8ff');
    g.restore();
    L().polyPath(g, [-2, -26, 30, 0, -2, 26, 6, 0]);
    const gr = g.createLinearGradient(-2, 0, 30, 0); gr.addColorStop(0, '#7fd8ff'); gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(16,20,40,.9)'; g.lineJoin = 'round'; g.stroke();
  },
  ult(g) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [x, y, s, r] of [[-14, -16, 46, 0.7], [10, -4, 40, 0.75], [-2, 14, 30, 0.7]]) { g.save(); g.translate(x, y); g.rotate(-2.3); g.drawImage(SF.Sprites.comet('#ff6ad8'), -4, -s * 0.16, s, s * 0.32); g.restore(); }
    g.restore();
    g.drawImage(SF.Sprites.star('#ffd86a'), -6, -6, 40, 40);
    g.drawImage(SF.Sprites.meteorRock(), -26, -24, 22, 22); g.drawImage(SF.Sprites.meteorRock(), 2, -12, 18, 18);
  },
  cannon(g) { g.drawImage(SF.Sprites.mapw('cannonBase'), -34, -30, 68, 68); g.save(); g.translate(0, -4); g.rotate(-0.6); g.drawImage(SF.Sprites.mapw('cannonBarrel'), -14, -16, 60, 32); g.restore(); },
  flamer(g) {
    g.drawImage(SF.Sprites.mapw('flamerBase'), -34, -30, 68, 68);
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(SF.Sprites.glow('#ff8a2a'), 6, -42, 40, 40); g.restore();
    g.save(); g.translate(0, -4); g.rotate(-0.6); g.drawImage(SF.Sprites.mapw('flamerNozzle'), -12, -16, 56, 32); g.restore();
  },
  tank(g) { g.save(); g.rotate(-0.35); g.drawImage(SF.Sprites.mapw('tankBody'), -40, -30, 80, 60); g.drawImage(SF.Sprites.mapw('tankTurret'), -16, -18, 56, 30); g.restore(); },
  quest(g) {
    const { part, line } = L();
    part(g, () => { g.beginPath(); g.roundRect(-22, -28, 44, 56, 6); }, '#f2e2b8', 0, 0, 30, { lw: 3 });
    part(g, () => { g.beginPath(); g.roundRect(-10, -33, 20, 10, 3); }, '#a8742f', 0, -28, 10, { lw: 2.5 });
    for (let i = 0; i < 3; i++) { line(g, [-14, -12 + i * 13, -9, -7 + i * 13, -2, -17 + i * 13], 3, '#3ab05a'); line(g, [3, -12 + i * 13, 15, -12 + i * 13], 2.5, '#a8865a'); }
  },
  chest(g) { g.drawImage(SF.Sprites.pickup('chest'), -40, -40, 80, 80); }
,
  gatling(g, evo) {
    const { part, limb, polyPath } = L();
    g.rotate(-0.5);
    limb(g, [-24, 6, 20, 6], 7, '#8a5a30', 2);
    g.beginPath(); g.arc(-6, 6, 26, -1.0, 1.0); g.lineWidth = 9; g.strokeStyle = 'rgba(20,14,30,.9)'; g.stroke(); g.lineWidth = 5; g.strokeStyle = '#c89a5a'; g.stroke();
    for (let i = -1; i <= 1; i++) { L().line(g, [-10, 6 + i * 7, 30, 6 + i * 7], 2.5, evo ? '#7affd0' : '#ffe08a'); polyPath(g, [30, 2 + i * 7, 38, 6 + i * 7, 30, 10 + i * 7]); g.fillStyle = '#e8eef8'; g.fill(); }
    part(g, () => { g.beginPath(); g.roundRect(-30, 0, 10, 14, 3); }, '#5a3018', -25, 7, 6, { lw: 1.6 });
  },
  ricochet(g, evo) {
    g.drawImage(SF.Sprites.disc(evo), -30, -30, 60, 60);
    g.strokeStyle = evo ? 'rgba(255,154,240,.8)' : 'rgba(159,255,224,.8)'; g.lineWidth = 3; g.setLineDash([6, 6]);
    g.beginPath(); g.moveTo(-34, 30); g.lineTo(-10, 8); g.moveTo(10, -8); g.lineTo(34, 24); g.stroke(); g.setLineDash([]);
  },
  aura(g, evo) {
    const col = evo ? '#ffe08a' : '#fff3a0';
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(SF.Sprites.glow(col), -36, -36, 72, 72); g.drawImage(SF.Sprites.ring(col), -34, -34, 68, 68); g.restore();
    g.drawImage(SF.Sprites.rune(evo ? '#ffb43a' : '#ffe08a'), -30, -30, 60, 60);
    L().circ(g, 0, 0, 7, '#ffffff');
  },
  drone(g, evo) {
    g.drawImage(SF.Sprites.drone(evo), -34, -30, 68, 52);
    if (evo) g.drawImage(SF.Sprites.drone(evo), -6, 2, 40, 30);
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = evo ? '#ff7ad8' : '#7affff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(26, 30); g.stroke(); g.restore();
  },
  mine(g, evo) {
    g.drawImage(SF.Sprites.mine(), -30, -20, 60, 50);
    if (evo) { g.drawImage(SF.Sprites.mine(), -36, -36, 30, 25); g.drawImage(SF.Sprites.mine(), 8, -36, 30, 25); }
    L().glowEye(g, 0, -2, 3, '#ff3a3a');
  },
  vortex(g, evo) {
    const col = evo ? '#ff7ad8' : '#b07aff';
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(SF.Sprites.glow(col), -34, -34, 68, 68); g.restore();
    g.strokeStyle = col; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { g.lineWidth = 4 - i * 0.6; g.beginPath(); g.arc(0, 0, 8 + i * 7, i * 1.6, i * 1.6 + 4); g.stroke(); }
    L().circ(g, 0, 0, 6, evo ? '#000000' : '#1a0830');
  },
  summon(g, evo) {
    const spr = SF.Sprites.enemy(evo ? SF.Sprites.PET_EVO : SF.Sprites.PET), f = SF.Sprites.frame(spr, 0, 'n');
    g.drawImage(f, -38, -40, 76, 76);
  }
,
  potion(g) {
    const { part, circ } = L();
    part(g, () => { g.beginPath(); g.arc(0, 8, 22, 0, TAU); }, '#ffd0d8', 0, 8, 22, { lw: 3, hl: 0.7 });
    g.save(); g.beginPath(); g.arc(0, 8, 19, 0, TAU); g.clip(); const gr = g.createLinearGradient(0, 0, 0, 28); gr.addColorStop(0, '#ff6a8a'); gr.addColorStop(1, '#c81a3a'); g.fillStyle = gr; g.fillRect(-22, 2, 44, 30); g.restore();
    part(g, () => { g.beginPath(); g.rect(-7, -22, 14, 14); }, '#ffd0d8', 0, -15, 9, { lw: 2.5 });
    part(g, () => { g.beginPath(); g.roundRect(-9, -30, 18, 9, 2); }, '#8a5a30', 0, -26, 9, { lw: 2.5 });
    g.fillStyle = '#ffffff'; g.fillRect(-2.5, 4, 5, 14); g.fillRect(-7, 8.5, 14, 5);
    circ(g, -8, 0, 3, 'rgba(255,255,255,.7)');
  },
  bombi(g) { g.drawImage(SF.Sprites.pickup('bomb'), -42, -40, 84, 84); },
  blink(g) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(SF.Sprites.glow('#c890ff'), -34, -34, 68, 68); g.restore();
    for (const [x, a] of [[-14, 0.35], [2, 0.65], [16, 1]]) { g.globalAlpha = a; L().polyPath(g, [x - 8, -18, x + 6, -2, x - 2, -2, x + 8, 18, x - 8, 0, x, 0]); g.fillStyle = '#e8d0ff'; g.fill(); }
    g.globalAlpha = 1;
  },
  freeze(g) {
    const { part, line, circ } = L();
    part(g, () => { g.beginPath(); g.arc(0, 2, 26, 0, TAU); }, '#bfeaff', 0, 2, 26, { lw: 3, hl: 0.6 });
    circ(g, 0, 2, 20, '#e8f8ff');
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; line(g, [Math.cos(a) * 16, 2 + Math.sin(a) * 16, Math.cos(a) * 19, 2 + Math.sin(a) * 19], 2, '#5a8ab0'); }
    line(g, [0, 2, 0, -12], 3.5, '#2a4a6a'); line(g, [0, 2, 10, 8], 3, '#2a4a6a');
    for (const [x, y] of [[-24, -20], [24, -18], [22, 24]]) g.drawImage(SF.Sprites.star('#bff0ff'), x - 8, y - 8, 16, 16);
  },
  berserk(g) {
    const { part } = L();
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(SF.Sprites.glow('#ff3a2a'), -34, -34, 68, 68); g.restore();
    part(g, () => { g.beginPath(); g.moveTo(-10, -26); g.lineTo(10, -26); g.lineTo(10, -14); g.lineTo(20, 10); g.quadraticCurveTo(20, 28, 0, 28); g.quadraticCurveTo(-20, 28, -20, 10); g.lineTo(-10, -14); g.closePath(); }, '#ff4a2a', 0, 4, 22, { lw: 3, hl: 0.5 });
    L().line(g, [-8, 4, -2, 12, 4, 0, 10, 10], 3, '#ffe08a');
  }
,
  crate(g) { g.drawImage(SF.Sprites.mobj('crate'), -36, -38, 72, 72); },
  barrel(g) { g.drawImage(SF.Sprites.mobj('barrel'), -36, -38, 72, 72); g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(SF.Sprites.glow('#ff8a2a'), 0, -40, 40, 40); g.restore(); },
  obelisk(g) { g.drawImage(SF.Sprites.mobj('obelisk'), -30, -48, 60, 84); }
};
const PASS_GL = { might: 'ring', cd: 'hourglass', area: 'scroll', move: 'boot', hp: 'heart', regen: 'leaf', armor: 'shield', magnet: 'magnet', growth: 'book', amount: 'mirror', luck: 'clover', greed: 'coins' };
const ITEM_GL = { potion: 'potion', bomb: 'bombi', magnet: 'magnet', blink: 'blink', shield: 'shield', turret: 'cannon', freeze: 'freeze', berserk: 'berserk' };
const META_GL = { belt: 'chest', dashm: 'dash', ultm: 'ult', mapwm: 'cannon', might: 'sword', hp: 'heart', armor: 'shield', move: 'boot', regen: 'leaf', growth: 'book', greed: 'coins', magnet: 'magnet', cd: 'hourglass', luck: 'clover', revive: 'feather', reroll: 'dice', skip: 'skip' };

function frame(g, cat) {
  const { mk } = L();
  const [a, b, br] = FRAME[cat];
  const gr = g.createLinearGradient(0, 4, 0, 92); gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.beginPath(); g.roundRect(4, 4, 88, 88, 20); g.fillStyle = gr; g.fill();
  const hl = g.createRadialGradient(36, 22, 2, 40, 30, 60); hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.fill();
  g.lineWidth = 4; g.strokeStyle = br; g.stroke();
  g.beginPath(); g.roundRect(9, 9, 78, 78, 16); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.18)'; g.stroke();
  if (cat === 'e') { g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(SF.Sprites.glow('#ffd24a'), 8, 8, 80, 80); g.restore(); }
}
function make(key) {
  const [cat, id] = key.split(':');
  const c = L().mk(96, 96), g = c.getContext('2d');
  let glyph = id, evo = false;
  if (cat === 'w' || cat === 'e') { evo = cat === 'e'; }
  else if (cat === 'p') glyph = PASS_GL[id];
  else if (cat === 'm') glyph = META_GL[id];
  else if (cat === 'i') glyph = ITEM_GL[id];
  if (cat === 's') {
    frame(g, 's');
    g.save(); g.beginPath(); g.roundRect(8, 8, 80, 80, 16); g.clip();
    const st = SF.STAGES[id];
    g.fillStyle = st.ground[0]; g.fillRect(0, 0, 96, 96);
    g.drawImage(SF.Sprites.deco(st.deco, 0), -2, 2, 100, 100);
    g.restore();
    g.beginPath(); g.roundRect(4, 4, 88, 88, 20); g.lineWidth = 4; g.strokeStyle = FRAME.s[2]; g.stroke();
    return c.toDataURL();
  }
  frame(g, cat === 'x' ? 'n' : cat);
  g.translate(48, 48);
  if (GL[glyph]) GL[glyph](g, evo);
  return c.toDataURL();
}
// key: w:武器 / e:进化武器 / p:被动 / m:局外强化 / s:关卡 / a:主动技能 / k:地图武器 / x:杂项
Ic.url = function (key) { return cache[key] || (cache[key] = make(key)); };
Ic.img = function (key, cls) { return `<img class="ico${cls ? ' ' + cls : ''}" src="${Ic.url(key)}" alt="">`; };
Ic.weapon = (id, evo) => Ic.img((evo ? 'e:' : 'w:') + id);
Ic.clear = function () { for (const k in cache) delete cache[k]; };
})(window.SF = window.SF || {});
