'use strict';
/* =====================================================================
   JUGADORES — juego (render canvas 3D cenital, UI, flujo del torneo).
   Depende de engine.js
   ===================================================================== */

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STAGE_W = FIELD.W + 2 * FIELD.MX, STAGE_H = FIELD.H + 2 * FIELD.MY;
const CONFIG = { startMoney: 15, perkSlots: 4, itemSlots: 3, turns: 10, statMax: 12, rerollCost: 3, debugMoney: 99999 };
const LEVELS = [0, 2, 4, 6, 9], LEVEL_NAMES = ['Fácil', 'Normal', 'Difícil', 'Experto', 'Leyenda'];

/* ===================== AUDIO ===================== */
let muted = false, AC = null, NOISE = null;
function actx() { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); return AC; }
function tone(f, d = 0.09, type = 'square', v = 0.04, when = 0, slide = 0) {
  if (muted) return;
  try {
    const a = actx(), t0 = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + 0.02);
  } catch (e) { /* sin audio */ }
}
function crowd(d = 1.4, v = 0.08) {
  if (muted) return;
  try {
    const a = actx();
    if (!NOISE) { NOISE = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const ch = NOISE.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const s = a.createBufferSource(); s.buffer = NOISE;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(v, a.currentTime + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d);
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(); s.stop(a.currentTime + d);
  } catch (e) { /* sin audio */ }
}
const sfx = {
  click() { tone(660, 0.05, 'triangle', 0.04); },
  shot(p = 1) { tone(140 + 120 * p, 0.12, 'sawtooth', 0.05, 0, -80); },
  cap(v) { tone(300 + Math.min(v, 600) * 0.3, 0.05, 'square', Math.min(0.05, 0.01 + v / 8000)); },
  ball(v) { tone(520 + Math.min(v, 900) * 0.2, 0.07, 'triangle', Math.min(0.08, 0.02 + v / 6000)); },
  wall() { tone(110, 0.06, 'triangle', 0.04); },
  post() { tone(1300, 0.25, 'sine', 0.06); tone(980, 0.3, 'sine', 0.04, 0.02); },
  goal() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.06, i * 0.09)); crowd(2, 0.14); },
  coin() { tone(880, 0.06, 'square', 0.04); tone(1320, 0.09, 'square', 0.04, 0.06); },
  win() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.06, i * 0.1)); crowd(2.4, 0.12); },
  lose() { [330, 262, 196, 130].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.05, i * 0.17)); },
  combo(n) { for (let i = 0; i < Math.min(6, n + 2); i++) tone(520 * Math.pow(1.122, i * 2), 0.12, 'triangle', 0.05, i * 0.06); },
  bounce(n) { tone(420 + n * 150, 0.09, 'square', 0.05, 0, 120); },
  zap() { tone(1500, 0.12, 'sawtooth', 0.04, 0, -900); },
  whistle() { tone(2000, 0.35, 'sine', 0.05, 0, 300); },
  barbreak() { [2400, 3100, 1800, 2700, 3500].forEach((f, i) => tone(f, 0.12, 'triangle', 0.04, i * 0.025, -900)); tone(420, 0.3, 'sawtooth', 0.04, 0, -300); },
  whoosh() { tone(300, 0.7, 'sawtooth', 0.025, 0, 500); tone(520, 0.6, 'sine', 0.03, 0.05, 700); },
  stomp(k = 1) { tone(95, 0.45, 'sine', 0.12 * k, 0, -55); tone(60, 0.5, 'square', 0.05 * k, 0.02, -25); if (k > 0.8) tone(200, 0.2, 'sawtooth', 0.03, 0.05, -120); },
};

/* ===================== COLORES / BANDERAS ===================== */
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function shade(hex, f) { // f -1..1
  const c = hex2rgb(hex).map(v => f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return rgb(c);
}
const colorDist = (a, b) => { const x = hex2rgb(a), y = hex2rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const FLAGS = {};
function preloadFlags() {
  ALL_CODES.forEach(c => { const im = new Image(); im.onload = () => { FLAGS[c] = im; if (window.__flagsLoaded) window.__flagsLoaded(); }; im.src = flagURI(c); });
}
const AWAY = {
  ESP:['#f4f4f4','#d62828'],FRA:['#ffffff','#1d46c4'],ITA:['#ffffff','#1c6fe6'],ALE:['#7a1f5c','#ffffff'],BRA:['#1d3fa0','#ffffff'],ARG:['#2a1a5e','#7ec8ff'],ING:['#1a2a5e','#f4f4f4'],POR:['#ffffff','#b3121f'],
  PBA:['#21468b','#ff7a00'],BEL:['#111111','#fdda24'],JPN:['#ffffff','#1c3a8a'],MEX:['#ffffff','#0a7a3d'],CRO:['#101a4a','#e31b23'],SUE:['#006aa7','#ffcd00'],COL:['#0a2a7a','#ffd100'],USA:['#ffffff','#bf0a30'],
  URU:['#ffffff','#7ec8ff'],MAR:['#006233','#ffffff'],COR:['#1b2a5e','#c60c30'],SUI:['#ffffff','#d52b1e'],DIN:['#0e1a3a','#c8102e'],TUR:['#ffffff','#e30a17'],NOR:['#00205b','#ba0c2f'],SEN:['#ffffff','#00853f'],
  POL:['#dc143c','#ffffff'],EGI:['#ffffff','#c8102e'],NIG:['#ffffff','#008751'],CHI:['#0039a6','#ffffff'],AUT:['#0a2a5e','#ed2939'],GHA:['#fcd116','#006b3f'],SCO:['#ffd24a','#0a4aa0'],UCR:['#0057b7','#ffd700'],
  CAN:['#ffffff','#d52b1e'],CIV:['#ffffff','#f77f00'],SMR:['#1b3a8a','#5eb6e4'],PAR:['#0038a8','#ffffff'],
  CMR:['#fcd116','#00a35a'],PER:['#ffffff','#d91023'],AUS:['#00843d','#ffcd00'],CHN:['#ffde00','#de2910'],IRL:['#ffffff','#169b62'],GRE:['#ffffff','#0d5eaf'],THA:['#e3262e','#2b3a8c'],
  LRD:['#ffffff','#2ad4b8'],
  MCI:['#1c1c28','#6cabdd'],ARS:['#f4e04d','#ef0107'],LIV:['#111111','#00b2a9'],RMA:['#2a1a5e','#febe10'],BAR:['#f2c500','#a50044'],ATM:['#101a3a','#cb3524'],INT:['#ffffff','#0068a8'],NAP:['#ffffff','#12a0d7'],
  JUV:['#2a4aa0','#ffffff'],PSG:['#ffffff','#004170'],MON:['#111111','#e0202c'],OLM:['#111111','#2faee0'],BAY:['#1a1a3a','#dc052d'],LEV:['#ffffff','#e32221'],BVB:['#111111','#fde100'],CHE:['#ffffff','#034694'],
  MUN:['#ffffff','#da291c'],TOT:['#132257','#ffffff'],CEL:['#1a2a5e','#8ac3ee'],VAL:['#111111','#ff8a00'],SEV:['#111a3a','#d4001f'],MIL:['#ffffff','#fb090b'],ROM:['#ffffff','#8e1f2f'],ATA:['#ffffff','#1e71b8'],
  LYO:['#1d3c87','#ffffff'],LIL:['#ffffff','#e01e13'],NIC:['#ffffff','#e3001b'],RBL:['#0b1a3a','#dd0741'],SGE:['#ffffff','#e1000f'],VFB:['#e32219','#ffffff']
};
if (typeof applyMyTeam === 'function') applyMyTeam();
const kitOf = (code, other) => {
  let c1 = COUNTRIES[code].c1, c2 = COUNTRIES[code].c2;
  const clash = (a, b) => colorDist(a, b) < 120;
  if (other) {
    const oc = COUNTRIES[other].c1;
    if (clash(c1, oc)) {
      const aw = AWAY[code];
      if (aw && !clash(aw[0], oc)) { c1 = aw[0]; c2 = aw[1]; }
      else if (!clash(c2, oc)) { [c1, c2] = [c2, c1]; }
      else c1 = '#222a38';
    }
  }
  return { code, c1, c2 };
};

/* ===================== DIBUJO 3D CENITAL ===================== */
function shadowEllipse(ctx, x, y, r, k = 1) {
  const g = ctx.createRadialGradient(x + r * 0.28, y + r * 0.42, r * 0.2, x + r * 0.28, y + r * 0.42, r * 1.25);
  g.addColorStop(0, `rgba(0,0,0,${0.5 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + r * 0.28, y + r * 0.42, r * 1.25, r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
}
function crownPath(ctx, x, y, r, teeth = 18, amp = 0.045) {
  ctx.beginPath();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, rr = r * (1 - amp + amp * (0.5 + 0.5 * Math.cos(a * teeth)));
    i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
/* jugador: borde de corona metálica + inserto con la bandera + brillo */
function drawCap(ctx, x, y, r, kit, opt = {}) {
  if (opt.shadow !== false) shadowEllipse(ctx, x, y, r);
  const depth = Math.max(3, r * 0.2);
  const side = shade(kit.c1, -0.55);
  for (let k = depth; k >= 1; k -= 1) { crownPath(ctx, x, y + k, r); ctx.fillStyle = side; ctx.fill(); }
  // cara superior
  crownPath(ctx, x, y, r);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, shade(kit.c1, 0.55)); g.addColorStop(0.45, kit.c1); g.addColorStop(1, shade(kit.c1, -0.4));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.04); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.stroke();
  // surco
  ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.lineWidth = r * 0.07; ctx.strokeStyle = shade(kit.c1, -0.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.74, 0, Math.PI * 2); ctx.lineWidth = r * 0.025; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
  // inserto con bandera
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.clip();
  const im = FLAGS[kit.code];
  if (im) { const w = r * 1.32 * 1.5, h = r * 1.32; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); } else { ctx.fillStyle = kit.c2; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  const ig = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.05, x, y, r * 0.7);
  ig.addColorStop(0, 'rgba(255,255,255,.28)'); ig.addColorStop(0.6, 'rgba(255,255,255,0)'); ig.addColorStop(1, 'rgba(0,0,0,.32)');
  ctx.fillStyle = ig; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.lineWidth = r * 0.05; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
  // número de camiseta
  if (opt.num != null) {
    ctx.save(); ctx.font = '900 ' + Math.round(r * 0.78) + 'px "Arial Black","Segoe UI",Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = r * 0.2; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(opt.num, x, y + r * 0.04);
    ctx.fillStyle = '#fff'; ctx.fillText(opt.num, x, y + r * 0.04); ctx.restore();
  }
  // brillo especular de la corona
  ctx.save(); crownPath(ctx, x, y, r); ctx.clip();
  const sg = ctx.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.2);
  sg.addColorStop(0, 'rgba(255,255,255,.6)'); sg.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.42, r * 0.7, r * 0.28, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
const BALL_COL = { invisible: ['#f6f0ff', '#b79cff', '#3a2680'], tres_d: ['#5fe0ff', '#1a5fe0', '#050f33'], venenosa: ['#e3b0ff', '#9a3be8', '#3a0a60'], hielo: ['#f2fcff', '#8fd8f5', '#2c7fb0'], pesado: ['#9aa6b8', '#4a5568', '#1a202c'], loca: ['#ff9bf5', '#a45cff', '#3a1a8a'] };
const ballHid = b => b.btype === 'invisible' && ((b._ia == null ? 1 : b._ia) < 0.95 || Math.hypot(b.vx || 0, b.vy || 0) > 5);   // balón invisible: sin brillos ni estela mientras se ve poco
function drawBall(ctx, b, shadow = true) {
  if (b.btype === 'invisible') {
    const now = performance.now(), dt = Math.min(0.1, (now - (b._it || now)) / 1000); b._it = now;
    const mv = Math.hypot(b.vx || 0, b.vy || 0) > 5;
    b._ia = Math.max(0.1, Math.min(1, (b._ia == null ? 1 : b._ia) + (mv ? -2 : 5) * dt));   // nunca desaparece del todo: opacidad mínima 0.1
    ctx.save(); ctx.globalAlpha *= b._ia; drawBall0(ctx, b, shadow); ctx.restore(); return;
  }
  drawBall0(ctx, b, shadow);
}
function drawBall0(ctx, b, shadow) {
  let { x, y, r } = b; const bt = b.btype || 'normal'; let col = BALL_COL[bt];
  if (bt === 'loca') {
    const sp = Math.hypot(b.vx || 0, b.vy || 0); b._rk = (b._rk == null ? 1 : b._rk) + ((sp > 40 ? 1 : 0) - (b._rk == null ? 1 : b._rk)) * (sp > 40 ? 0.2 : 0.012);
    const hh = (performance.now() / 8) % 360, k = b._rk;
    col = ['hsl(' + hh + ',' + Math.round(100 * k) + '%,' + Math.round(85 - 10 * (1 - k)) + '%)', 'hsl(' + hh + ',' + Math.round(90 * k) + '%,' + Math.round(55 + 10 * (1 - k)) + '%)', 'hsl(' + (hh + 40) % 360 + ',' + Math.round(90 * k) + '%,' + Math.round(28 + 14 * (1 - k)) + '%)'];
  }
  const h = b.airH != null ? b.airH : (b.air > 0 ? Math.sin(Math.PI * (1 - b.air / b.air0)) * 46 : 0);
  if (shadow) shadowEllipse(ctx, x, y, r * (1 - h / 150), 0.9 * (1 - h / 120));
  if (h > 0) { y -= h; r *= 1 + h / 80; }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  if (col) { g.addColorStop(0, col[0]); g.addColorStop(0.6, col[1]); g.addColorStop(1, col[2]); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e3e8ef'); g.addColorStop(1, '#8e98a8'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const ang = b.ang || 0;
  if (!col) {
    ctx.fillStyle = '#1a1f2b';
    const pent = (cx2, cy2, s2, rot) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + i * Math.PI * 2 / 5; ctx.lineTo(cx2 + Math.cos(a) * s2, cy2 + Math.sin(a) * s2); } ctx.closePath(); ctx.fill(); };
    pent(x + Math.cos(ang) * r * 0.1, y + Math.sin(ang) * r * 0.1, r * 0.34, ang);
    for (let i = 0; i < 5; i++) { const a = ang + i * Math.PI * 2 / 5 + 0.6; pent(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98, r * 0.36, a); }
  } else if (bt === 'hielo') {
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x - r * 0.1, y + r * 0.05); ctx.lineTo(x + r * 0.5, y - r * 0.4); ctx.moveTo(x - r * 0.1, y + r * 0.05); ctx.lineTo(x + r * 0.15, y + r * 0.6); ctx.stroke();
  } else if (bt === 'pesado') {
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = '900 ' + Math.round(r * 0.6) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillText('8', 0, 1); ctx.restore();
  } else if (bt === 'tres_d') {
    // globo de rejilla: meridianos que giran y paralelos, con núcleo brillante
    ctx.strokeStyle = 'rgba(190,250,255,.9)'; ctx.lineWidth = Math.max(1, r * 0.09);
    for (let k = 0; k < 4; k++) { const w2 = Math.abs(Math.cos(ang + k * Math.PI / 4)); ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, r * 0.96 * w2), r * 0.96, 0, 0, Math.PI * 2); ctx.stroke(); }
    for (const f of [-0.55, 0, 0.55]) { const yy = y + f * r, hw = r * Math.sqrt(1 - f * f); ctx.beginPath(); ctx.ellipse(x, yy, hw, hw * 0.28, 0, 0, Math.PI * 2); ctx.stroke(); }
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r * 0.5); cg.addColorStop(0, 'rgba(255,255,255,.85)'); cg.addColorStop(1, 'rgba(120,230,255,0)');
    ctx.fillStyle = cg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  } else if (bt === 'invisible') {
    // balón fantasma: sábana blanca con ondas abajo y cara de fantasma
    ctx.fillStyle = 'rgba(80,60,170,.55)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    const gy = y + r * 0.46, sc = r * 0.4;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - r * 1.2, y - r * 1.2); ctx.lineTo(x + r * 1.2, y - r * 1.2); ctx.lineTo(x + r * 1.2, gy);
    for (let i = 0; i < 3; i++) { const x0 = x + r * 1.2 - i * sc * 2 * 1.0; ctx.quadraticCurveTo(x0 - sc * 0.5 * 1.0 + 0, gy + sc * 0.9, x0 - sc, gy); ctx.quadraticCurveTo(x0 - sc * 1.5, gy - sc * 0.5, x0 - sc * 2, gy); }
    ctx.lineTo(x - r * 1.2, gy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#23134f'; ctx.beginPath(); ctx.ellipse(x - r * 0.28, y - r * 0.22, r * 0.14, r * 0.22, 0, 0, Math.PI * 2); ctx.ellipse(x + r * 0.28, y - r * 0.22, r * 0.14, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 0.13, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,140,190,.55)'; ctx.beginPath(); ctx.arc(x - r * 0.5, y + r * 0.02, r * 0.1, 0, Math.PI * 2); ctx.arc(x + r * 0.5, y + r * 0.02, r * 0.1, 0, Math.PI * 2); ctx.fill();
  } else if (bt === 'venenosa') {
    ctx.fillStyle = '#1b0630'; ctx.font = '900 ' + Math.round(r * 1.25) + 'px "Segoe UI Emoji",Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('☠', x, y + 1);
  } else if (bt === 'loca') {
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = r * 0.16;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x, y, r * (0.3 + k * 0.28), ang + k, ang + k + 3.2); ctx.stroke(); }
  }
  const sh = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, 0, x - r * 0.4, y - r * 0.45, r * 0.9);
  sh.addColorStop(0, 'rgba(255,255,255,.75)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
}

/* ---- campo (se dibuja una vez en caché) ---- */
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const GRASS_COLS = ['#1b7a37', '#23863d', '#2f9340', '#16673a', '#3f8a2c', '#1d7a56'];
function drawPitch(ctx, geo, field, grass) {
  grass = grass || { pat: 0, col: 0 };
  const { W, H, MX, MY, pocket } = FIELD;
  // gradas / fondo
  const bg = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  bg.addColorStop(0, '#0b111a'); bg.addColorStop(0.5, '#101a27'); bg.addColorStop(1, '#0a0f17');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  const rnd = seeded(7);
  const colors = ['#e84a5f', '#ffd166', '#06d6a0', '#4cc9f0', '#f8f9fa', '#c6ff3d'];
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * STAGE_W, y = rnd() * STAGE_H;
    if (x > MX - 38 && x < MX + W + 38 && y > MY - 38 && y < MY + H + 38) continue;
    ctx.fillStyle = colors[(rnd() * colors.length) | 0]; ctx.globalAlpha = 0.18 + rnd() * 0.3;
    ctx.beginPath(); ctx.arc(x, y, 1.4 + rnd() * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // vallas LED
  ctx.save(); ctx.translate(MX, MY);
  const bx = -pocket - 26, by = -34, bw = W + 2 * pocket + 52, bh = H + 68;
  const led = (x, y, w, h, hor) => {
    const g = hor ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#0e3a5a'); g.addColorStop(0.25, '#1b7ab5'); g.addColorStop(0.5, '#c6ff3d'); g.addColorStop(0.75, '#1b7ab5'); g.addColorStop(1, '#0e3a5a');
    ctx.fillStyle = '#05080c'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = g; ctx.globalAlpha = 0.9; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
  };
  led(bx, by, bw, 20, true); led(bx, by + bh - 20, bw, 20, true);
  ctx.font = '900 14px "Segoe UI",Arial'; ctx.fillStyle = '#04121c'; ctx.textBaseline = 'middle';
  { const lab = typeof G !== 'undefined' && G && G.lab, step = lab ? 340 : 230;
    for (let x = bx + 20; x < bx + bw - 120; x += step) { ctx.fillText('CAP CUP · ROGUE CUP', x, by + 10); ctx.fillText(lab ? '★ LABORATORIO DE JUGADORES ★' : '★ MUNDIAL ★', x + (lab ? 20 : 60), by + bh - 10); } }
  ctx.restore();
  // césped
  ctx.save(); ctx.translate(MX, MY);
  const gx0 = -pocket - 10, gy0 = -14, gw = W + 2 * pocket + 20, gh = H + 28;
  const PAL = { hielo: ['#a9d9f5', 'rgba(255,255,255,.22)', 'rgba(60,120,180,.12)'], barro: ['#7a4e2a', 'rgba(255,214,160,.04)', 'rgba(0,0,0,.08)'], espacio: ['#0a0630', 'rgba(120,80,255,.10)', 'rgba(0,0,0,.2)'], playa: ['#ecd495', 'rgba(255,244,210,.22)', 'rgba(196,150,80,.12)'], jurasico: ['#2e5c2c', 'rgba(130,210,90,.10)', 'rgba(0,30,0,.16)'], ensueno: ['#ff9fd2', 'rgba(255,255,255,.2)', 'rgba(224,90,170,.14)'], oscuro: ['#07140d', 'rgba(255,255,255,.02)', 'rgba(0,0,0,.25)'], lluvia: ['#2f6f58', 'rgba(170,205,230,.10)', 'rgba(0,25,60,.20)'] }[field];
  const lineCol = field === 'hielo' ? 'rgba(30,80,150,.85)' : field === 'barro' ? 'rgba(248,232,205,.88)' : field === 'espacio' ? 'rgba(120,230,255,.85)' : field === 'playa' ? 'rgba(255,255,255,.9)' : field === 'jurasico' ? 'rgba(246,238,205,.9)' : field === 'ensueno' ? 'rgba(255,255,255,.95)' : field === 'oscuro' ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.86)';
  ctx.fillStyle = PAL ? PAL[0] : GRASS_COLS[grass.col % GRASS_COLS.length]; ctx.fillRect(0 - 14, gy0, W + 28, gh);
  if (PAL) { const stripes = 14, sw = (W + 28) / stripes; for (let i = 0; i < stripes; i++) { ctx.fillStyle = i % 2 ? PAL[1] : PAL[2]; ctx.fillRect(-14 + i * sw, gy0, sw, gh); } }
  else {
    const lt = 'rgba(255,255,255,.07)', dk = 'rgba(0,0,0,.07)', X0 = -14, GW = W + 28, pat = grass.pat % 7;
    ctx.save(); ctx.beginPath(); ctx.rect(X0, gy0, GW, gh); ctx.clip();
    if (pat === 0 || pat === 4) { const n = pat === 0 ? 14 : 8, sw = GW / n; for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? lt : dk; ctx.fillRect(X0 + i * sw, gy0, sw, gh); } }
    else if (pat === 1 || pat === 6) { const n = pat === 1 ? 10 : 6, sh = gh / n; for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? lt : dk; ctx.fillRect(X0, gy0 + i * sh, GW, sh); } }
    else if (pat === 2) { const nx = 14, ny = 9, sw = GW / nx, sh = gh / ny; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { ctx.fillStyle = (i + j) % 2 ? lt : dk; ctx.fillRect(X0 + i * sw, gy0 + j * sh, sw + 1, sh + 1); } }
    else if (pat === 3) { ctx.lineWidth = 46; for (let k = -12; k < 30; k++) { ctx.strokeStyle = k % 2 ? lt : dk; ctx.beginPath(); ctx.moveTo(X0 + k * 46, gy0 + gh); ctx.lineTo(X0 + k * 46 + gh, gy0); ctx.stroke(); } }
    else if (pat === 5) { for (let k = 12; k >= 0; k--) { ctx.fillStyle = k % 2 ? lt : dk; ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 70 + k * 50, 50 + k * 34, 0, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
  }
  // textura de hierba
  const r2 = seeded(21);
  for (let i = 0; i < (PAL ? 0 : 5200); i++) { const x = -14 + r2() * (W + 28), y = gy0 + r2() * gh; ctx.fillStyle = r2() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,30,0,.07)'; ctx.fillRect(x, y, 1.4, 5); }
  // luces del estadio
  const l1 = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.75);
  l1.addColorStop(0, 'rgba(255,255,255,.12)'); l1.addColorStop(1, 'rgba(0,0,0,.38)');
  ctx.fillStyle = l1; ctx.fillRect(-14, gy0, W + 28, gh);
  // líneas
  ctx.strokeStyle = lineCol; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.strokeRect(0, 0, W, H);
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 92, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = lineCol; ctx.beginPath(); ctx.arc(W / 2, H / 2, 6, 0, Math.PI * 2); ctx.fill();
  const box = (side, d, h) => { const x = side ? W - d : 0; ctx.strokeRect(x, H / 2 - h / 2, d, h); };
  box(0, 165, 390); box(1, 165, 390); box(0, 62, 240); box(1, 62, 240);
  ctx.beginPath(); ctx.arc(120, H / 2, 5, 0, Math.PI * 2); ctx.arc(W - 120, H / 2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(165, H / 2, 70, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W - 165, H / 2, 70, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
  // porterías: red + fondo
  const goal = (left, t, b) => {
    const x0 = left ? -pocket : W, x1 = left ? 0 : W + pocket;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(left ? 0 : 1, 'rgba(5,10,16,.92)'); g.addColorStop(left ? 1 : 0, 'rgba(25,40,55,.7)');
    ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), t, pocket, b - t);
    ctx.save(); ctx.beginPath(); ctx.rect(Math.min(x0, x1), t, pocket, b - t); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
    for (let k = -b; k < pocket + b; k += 11) { ctx.beginPath(); ctx.moveTo(Math.min(x0, x1) + k, t); ctx.lineTo(Math.min(x0, x1) + k - (b - t), b); ctx.stroke(); ctx.beginPath(); ctx.moveTo(Math.min(x0, x1) + k, t); ctx.lineTo(Math.min(x0, x1) + k + (b - t), b); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(left ? 0 : W, t); ctx.lineTo(left ? -pocket : W + pocket, t); ctx.lineTo(left ? -pocket : W + pocket, b); ctx.lineTo(left ? 0 : W, b); ctx.stroke();
  };
  const dynG = field === 'ensueno' || field === 'oscuro';   // porterías que se dibujan aparte (se mueven / brillan)
  if (!dynG) { goal(true, geo.lt, geo.lb); goal(false, geo.rt, geo.rb); }
  // postes
  if (!dynG) geo.posts.forEach(p => {
    shadowEllipse(ctx, p[0], p[1], 9, 0.7);
    const g = ctx.createRadialGradient(p[0] - 2, p[1] - 3, 1, p[0], p[1], FIELD.post + 2);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#8fa0b5');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], FIELD.post + 1, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
  // tinte según el tipo de campo
  ctx.save(); ctx.translate(MX, MY);
  const r3 = seeded(99);
  if (field === 'hielo') {
    const ig = ctx.createLinearGradient(0, 0, W, H); ig.addColorStop(0, 'rgba(255,255,255,.5)'); ig.addColorStop(0.5, 'rgba(255,255,255,0)'); ig.addColorStop(1, 'rgba(255,255,255,.35)');
    ctx.fillStyle = ig; ctx.fillRect(-14, -14, W + 28, H + 28);
  } else if (field === 'ensueno') {
    for (let i = 0; i < 9; i++) { const x = r3() * W, y = r3() * H, rr = 100 + r3() * 140, c0 = ['255,255,255', '190,150,255', '255,200,120', '140,220,255'][i % 4], bg = ctx.createRadialGradient(x, y, 0, x, y, rr); bg.addColorStop(0, `rgba(${c0},.22)`); bg.addColorStop(1, `rgba(${c0},0)`); ctx.fillStyle = bg; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  } else if (field === 'espacio') {
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + r3() * 0.7})`; ctx.beginPath(); ctx.arc(r3() * W, r3() * H, 0.6 + r3() * 1.8, 0, Math.PI * 2); ctx.fill(); }
    [[250, 160, '#7a3cff'], [760, 470, '#ff3c9e'], [520, 300, '#2c7aff']].forEach(([x, y, c]) => { const ng = ctx.createRadialGradient(x, y, 10, x, y, 240); ng.addColorStop(0, c + '55'); ng.addColorStop(1, c + '00'); ctx.fillStyle = ng; ctx.fillRect(-14, -14, W + 28, H + 28); });
  } else if (field === 'jurasico') {
    const lava = ctx.createRadialGradient(W * 0.92, H * 0.06, 10, W * 0.92, H * 0.06, 360); lava.addColorStop(0, 'rgba(255,110,30,.38)'); lava.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = lava; ctx.fillRect(-14, -14, W + 28, H + 28);
    for (let i = 0; i < 7; i++) { const x = r3() * W, y = r3() * H, rr = 90 + r3() * 130, bg = ctx.createRadialGradient(x, y, 0, x, y, rr); bg.addColorStop(0, 'rgba(10,40,10,.28)'); bg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = bg; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 4; i++) dinoPrint(ctx, 140 + r3() * (W - 280), 60 + r3() * (H - 120), 1.3 + r3() * 0.6, r3() * 6.28, 'rgba(20,40,14,.22)');
    const fern = (x, y, s, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = '#1d4a1e'; ctx.fillStyle = '#2f7a32'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.25, -s * 0.5, 0, -s); ctx.stroke(); for (let k = 1; k < 8; k++) { const yy = -s * k / 8.5, ww = s * 0.34 * (1 - k / 9); [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(sd * ww * 0.6, yy - ww * 0.35, sd * ww, yy + ww * 0.1); ctx.quadraticCurveTo(sd * ww * 0.5, yy + ww * 0.05, 0, yy + 2); ctx.fill(); }); } ctx.restore(); };
    for (let i = 0; i < 16; i++) { const top = i % 2 === 0, x = 10 + r3() * (W - 20); fern(x, top ? -6 : H + 8, 54 + r3() * 36, (top ? Math.PI : 0) + (r3() - 0.5) * 0.9); }
    for (let i = 0; i < 5; i++) fern(r3() * W, r3() * H, 40 + r3() * 24, r3() * 6.28);
    ctx.save(); ctx.globalAlpha = 0.2; ctx.strokeStyle = '#f4ecd0'; ctx.fillStyle = '#f4ecd0'; ctx.lineWidth = 6; ctx.lineCap = 'round';   // costillas fósiles
    ctx.translate(W * 0.27, H * 0.82); ctx.beginPath(); ctx.moveTo(-110, 0); ctx.lineTo(110, 0); ctx.stroke(); for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(k * 24, 0); ctx.quadraticCurveTo(k * 26, -52 + Math.abs(k) * 5, k * 18, -66 + Math.abs(k) * 7); ctx.stroke(); } ctx.restore();
  } else if (field === 'playa') {
    for (let i = 0; i < 420; i++) { ctx.fillStyle = r3() > 0.5 ? 'rgba(150,110,50,.22)' : 'rgba(255,255,255,.3)'; ctx.fillRect(r3() * W, r3() * H, 1.4 + r3() * 1.6, 1.4 + r3() * 1.2); }
    for (let i = 0; i < 9; i++) { const x = r3() * W, y = r3() * H, rr = 80 + r3() * 120, bg = ctx.createRadialGradient(x, y, 0, x, y, rr); bg.addColorStop(0, 'rgba(190,140,70,.16)'); bg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = bg; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  } else if (field === 'barro') {
    // tierra marrón lisa: solo manchas muy suaves del mismo tono
    for (let i = 0; i < 14; i++) {
      const x = r3() * W, y = r3() * H, rr = 90 + r3() * 140, dark = r3() > 0.5;
      const bg = ctx.createRadialGradient(x, y, 0, x, y, rr);
      bg.addColorStop(0, dark ? 'rgba(70,42,18,.28)' : 'rgba(150,100,55,.2)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  } else if (field === 'pinball') {
    ctx.fillStyle = 'rgba(30,0,60,.55)'; ctx.fillRect(-14, -14, W + 28, H + 28);
    ctx.strokeStyle = 'rgba(255,60,200,.35)'; ctx.lineWidth = 1.5;
    for (let x = 0; x <= W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  } else if (field === 'iman') {
    const cx0 = W / 2, cy0 = H / 2;
    const hg = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, 300);
    hg.addColorStop(0, 'rgba(8,0,30,.85)'); hg.addColorStop(0.2, 'rgba(60,15,130,.45)'); hg.addColorStop(0.6, 'rgba(90,40,170,.14)'); hg.addColorStop(1, 'rgba(90,40,170,0)');
    ctx.fillStyle = hg; ctx.fillRect(-14, -14, W + 28, H + 28);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [[95, 0.5], [160, 0.32], [225, 0.2]].forEach(([r, a]) => {
      ctx.setLineDash([3, 11]); ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(200,160,255,${a})`;
      ctx.beginPath(); ctx.arc(cx0, cy0, r, 0, 6.283); ctx.stroke();
    });
    ctx.setLineDash([]);
    // flechitas hacia el centro (indican que atrae)
    [[128, 12, 0.5], [192, 16, 0.3]].forEach(([r, n, a]) => {
      for (let k = 0; k < n; k++) {
        const ang = k / n * 6.283 + (r > 150 ? 0.13 : 0), px = cx0 + Math.cos(ang) * r, py = cy0 + Math.sin(ang) * r, ux = -Math.cos(ang), uy = -Math.sin(ang), s = r > 150 ? 9 : 7;
        ctx.strokeStyle = `rgba(215,185,255,${a})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px - uy * s - ux * s, py + ux * s - uy * s); ctx.lineTo(px, py); ctx.lineTo(px + uy * s - ux * s, py - ux * s - uy * s); ctx.stroke();
      }
    });
    ctx.save(); ctx.shadowColor = '#9a5cff'; ctx.shadowBlur = 26; ctx.beginPath(); ctx.arc(cx0, cy0, 46, 0, 6.283); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(190,150,255,.95)'; ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(cx0, cy0, 56, 0, 6.283); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,220,255,.5)'; ctx.stroke();
    const core = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, 44); core.addColorStop(0, '#000'); core.addColorStop(0.7, '#06001a'); core.addColorStop(1, 'rgba(40,10,90,.95)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx0, cy0, 44, 0, 6.283); ctx.fill();
  } else if (field === 'tilt') {
    const tg = ctx.createLinearGradient(0, 0, W, H); tg.addColorStop(0, 'rgba(0,160,255,.2)'); tg.addColorStop(1, 'rgba(0,0,0,.25)'); ctx.fillStyle = tg; ctx.fillRect(-14, -14, W + 28, H + 28);
  }
  ctx.restore();
  // viñeta general
  const v = ctx.createRadialGradient(STAGE_W / 2, STAGE_H / 2, STAGE_H * 0.35, STAGE_W / 2, STAGE_H / 2, STAGE_W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
}

/* ===================== ESTADO ===================== */
let G = { screen: 'title' };
let M = null;            // estado del partido
let cv, cx, view = { S: 1, ox: 0, oy: 0, dpr: 1 }, pitchCache = null, pitchKey = '';
const CHG_COL = ['#fff', '#fff3a0', '#ffc23d', '#ff7a2d', '#ff3d9e', '#35e0ff', '#b56bff'];
const chgCol = n => CHG_COL[n > 5 ? 6 : n];
const fx = { conf: [], rings: [], trail: [], pops: [], arcs: [], bars: [], dust: [], shake: 0, slow: 0 };
let FR = { kind: 'match', money: [0, 0], cards: false, f0: '2-2', f1: '1-3', c0: 'ESP', c1: 'BRA', lg0: 'SEL', lg1: 'SEL', mode: 'cpu', diff: 1, field: 'normal', ballType: 'normal', nBalls: 1, turns: 10 };

const money = () => G.debug ? '∞' : '$' + G.money;
const afford = n => G.debug || G.money >= n;
const spend = n => { if (!G.debug) G.money -= n; };
const gain = n => { if (!G.debug) G.money += n; };
const hasPerk = k => G.perks && G.perks.includes(k);
/* reliquias por equipo: en amistoso con tienda cada jugador tiene las suyas (M.S.fp); en torneo/liga solo el equipo 0 */
const pk = (s, k) => (M && M.S && M.S.fp) ? M.S.fp[s].includes(k) : (s === 0 && hasPerk(k));
const FR_NOPERK = ['freestyler', 'aforo', 'junta', 'botas', 'prima', 'mecenas', 'goleada', 'pretemp'];   // reliquias de dinero: sin sentido en un amistoso
const PERK_LIFE = 3;   // todas las reliquias duran 3 partidos
const perkLeft = k => (G.pu && G.pu[k] != null) ? G.pu[k] : PERK_LIFE;
const itemSlots = () => CONFIG.itemSlots + (G.slotBonus || 0);
const getBest = () => { try { return +localStorage.getItem('chapas_best') || 0; } catch (e) { return 0; } };
const saveBest = n => { try { if (n > getBest()) localStorage.setItem('chapas_best', n); } catch (e) { /* nada */ } };

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}

const poolOf = code => CODES.filter(c => !COUNTRIES[c].custom);   // el equipo del jugador nunca sale de rival en torneo/liga
let TOUR_RAND = true;
const TOUR_OPT = { turns: 10, groups: true };   // opciones del torneo (turnos por equipo y fase de grupos)
/* ===== partida guardada (se conserva al cerrar el navegador): se guarda en cada pantalla entre partidos ===== */
const RUN_KEY = 'cap_run_v1';
const runAlive = () => {
  if (!G || G.mode !== 'run' || G.debug || G.lab || G.ro || !G.caps || !G.caps.length) return false;
  if (G.league) return !(G.league.results && G.league.fix && G.league.results.length >= G.league.fix.length);
  if (G.tour) return !(G.tour.over || G.tour.champion);
  return true;
};
function saveRun() {
  try {
    if (!['versus', 'shop', 'league', 'tour'].includes(G.screen) || G.inMatch || G.fromRoul || !runAlive()) return;
    localStorage.setItem(RUN_KEY, JSON.stringify({ v: 1, t: Date.now(), G, TOUR_OPT, TOUR_RAND }));
  } catch (e) { /* sin almacenamiento o lleno: no pasa nada */ }
}
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) { /* nada */ } }
function loadRun() {
  try {
    // partidas guardadas con habilidades que ya no existen: Ojo de halcón pasa a Instinto goleador y Explosivo desaparece
    const raw = (localStorage.getItem(RUN_KEY) || 'null').replace(/"halcon"/g, '"instinto"').replace(/"resbaladiza",/g, '').replace(/,"resbaladiza"/g, '').replace(/"resbaladiza"/g, '"bulldozer"').replace(/"(explosivo|congelador|efecto)",/g, '').replace(/,"(congelador|efecto)"/g, '').replace(/"(congelador|efecto)"/g, '"control"').replace(/"explosivo",/g, '').replace(/,"explosivo"/g, '').replace(/"explosivo"/g, '"instinto"');
    if (/"HUN"/.test(raw)) return null;   // partida guardada con Hungría (ya no existe)
    const o = JSON.parse(raw); if (o && o.G && Array.isArray(o.G.cards)) o.G.cards = o.G.cards.filter(x => !x || !['onda', 'super'].includes(x.k)).map(x => Object.assign(x, { lv: 1 }));
    return o && o.v === 1 && o.G && o.G.caps ? o : null; } catch (e) { return null; }
}
function newRun(code, opts = {}) {
  G = {
    rand: TOUR_RAND,
    screen: 'versus', mode: 'run', debug: !!opts.debug, money: opts.debug ? CONFIG.debugMoney : CONFIG.startMoney,
    code, caps: playerTeam(code), perks: [], cards: [], round: opts.round || 0, form: teamForm(code), enemyQueue: shuffle(poolOf(code).filter(c => c !== code)),
    shop: null, pending: null, stats: { goals: 0, wins: 0 }, turns: TOUR_OPT.turns,
  };
  if (!opts.round && !opts.liga) G.tour = tourInit(code);
  nextEnemy();
  render();
}
/* cada Mundial ganado sube el nivel del siguiente: Mundial ★, ★★… (rivales mejores desde el primer partido) */
const tierStars = t => !t ? '' : ' ' + (t <= 5 ? '★'.repeat(t) : '★×' + t);
const tierName = t => 'MUNDIAL' + tierStars(t);
const curTier = () => (G.league ? G.ltier : G.tier) || 0;   // la liga tiene su propio nivel
const eRound = () => G.round + curTier() * 2;
function nextEnemy() {
  if (G.league) {
    const p = G.league.fix[Math.min(G.round, G.league.fix.length - 1)].find(q => q.includes(0));
    G.enemy = G.league.teams[p[0] === 0 ? p[1] : p[0]];
    G.enemyDefs = enemyTeam(G.enemy, Math.floor(G.round * 0.5) + (G.ltier || 0) * 2);
  } else if (tourOn()) {
    G.enemy = tourOpp();
    G.enemyDefs = enemyTeam(G.enemy, eRound());
  } else {
    if (!G.enemyQueue.length) G.enemyQueue = shuffle(poolOf(G.code).filter(c => c !== G.code));
    G.enemy = G.enemyQueue.pop();
    G.enemyDefs = enemyTeam(G.enemy, eRound());
  }
  const r = G.round;
  G.field = r === 0 || !G.rand ? 'normal' : (Math.random() < 0.55 ? pick(FIELD_KEYS) : 'normal');
  G.ballType = r < 1 || !G.rand ? 'normal' : (Math.random() < 0.4 ? pick(BALL_KEYS) : 'normal');
  let n = 1;
  if (G.rand && r >= 1 && Math.random() < Math.min(0.6, 0.2 + 0.08 * r)) n = 2 + (r >= 4 && Math.random() < 0.5 ? 1 : 0) + (r >= 6 && Math.random() < 0.4 ? 1 : 0);
  G.nBalls = Math.min(4, n);
}

/* ===================== PARTIDO ===================== */
/* comodines de la CPU en torneo/liga: crecen con la ronda */
function enemyHand(r) {
  const n = r < 1 ? 0 : r < 3 ? 1 : r < 5 ? 2 : 3;
  return wPick(CARD_KEYS, k => CARDS[k].price, n).map(k => ({ k, lv: 1, used: false }));
}
function startMatch() {
  const mods0 = { pot: hasPerk('hinchada') ? 1.12 : 1, gk: hasPerk('guantes') ? 3 : 0, form: G.form, capMen: hasPerk('brazalete') };
  const defs1 = G.enemyDefs.map(d => ({ role: d.role, stats: Object.assign({}, d.stats), abs: d.abs.slice(), stars: d.stars, name: d.name, num: d.num, captain: d.captain }));
  if (hasPerk('roja')) { defs1[1 + rnd(4)] = null; }
  beginMatch({
    codes: [G.code, G.enemy], defs: [G.caps, defs1], human: [true, false], field: G.field, ballType: G.ballType, nBalls: G.nBalls,
    hands: [G.cards.map(c => ({ k: c.k, lv: 1, used: false })), enemyHand(eRound())], turns: [(G.turns || CONFIG.turns) + (hasPerk('entrenador') ? 2 : 0), G.turns || CONFIG.turns], mods: [mods0, { form: teamForm(G.enemy) }], gwR: FIELD.gw * (hasPerk('arco') ? 1.25 : 1), round: G.round, tierR: curTier() * 2, run: true,
  });
}
function startFriendly() {
  const j2 = FR.mode === 'j2';
  const sides = (FR.money[0] > 0 ? [0] : []).concat(j2 && FR.money[1] > 0 ? [1] : []);
  FR.pre = sides.length ? { caps: [playerTeam(FR.c0), j2 ? playerTeam(FR.c1) : null], perks: [[], []], cards: [[], []], sides, i: 0 } : null;
  if (sides.length) friendlyShop(sides[0]); else playFriendly();
}
/* tienda previa del amistoso: dinero elegido con el slider; si juegan J1 y J2, primero J1 y luego J2 */
function friendlyShop(side) {
  const P = FR.pre;
  G = { screen: 'shop', mode: 'friendly', fshop: side, debug: false, money: FR.money[side], code: FR['c' + side], enemy: FR['c' + (1 - side)], enemyDefs: [], caps: P.caps[side], perks: P.perks[side], cards: P.cards[side],
    round: 0, stats: { goals: 0, wins: 0 }, form: FR['f' + side], field: FR.field, ballType: FR.ballType, nBalls: FR.nBalls, shop: null, pending: null, shopTab: 'team', turns: FR.turns };
  genShop(); render();
}
function playFriendly() {
  const j2 = FR.mode === 'j2', lvl = LEVELS[FR.diff], P = FR.pre, cl = o => JSON.parse(JSON.stringify(o));
  G = { screen: 'match', mode: 'friendly', debug: false, money: 0, code: FR.c0, enemy: FR.c1, caps: [], perks: [], cards: [], round: 0, stats: { goals: 0, wins: 0 } };
  const defs0 = P ? cl(P.caps[0]) : playerTeam(FR.c0);
  const defs1 = j2 ? (P ? cl(P.caps[1]) : playerTeam(FR.c1)) : enemyTeam(FR.c1, lvl);
  const fp = P ? [P.perks[0], j2 ? P.perks[1] : []] : [[], []], has = (s, k) => fp[s].includes(k);
  const mods = s => {
    const o = { form: FR['f' + s] };
    if (has(s, 'hinchada')) o.pot = 1.12; if (has(s, 'guantes')) o.gk = 3; if (has(s, 'brazalete')) o.capMen = true;
    return o;
  };
  const m0 = mods(0), m1 = mods(1);
  if (has(0, 'roja')) defs1[1 + rnd(4)] = null;
  if (has(1, 'roja')) defs0[1 + rnd(4)] = null;
  const hand = s => ((P && P.cards[s]) || []).map(c => ({ k: c.k, lv: 1, used: false })).concat(FR.cards ? randHand() : []);
  FR.pre = null;
  beginMatch({
    codes: [FR.c0, FR.c1], defs: [defs0, defs1], human: [true, j2], field: FR.field, ballType: FR.ballType, nBalls: FR.nBalls,
    turns: [FR.turns + (has(0, 'entrenador') ? 2 : 0), FR.turns + (has(1, 'entrenador') ? 2 : 0)], mods: [m0, m1], gwL: FIELD.gw * (has(1, 'arco') ? 1.25 : 1), gwR: FIELD.gw * (has(0, 'arco') ? 1.25 : 1), round: lvl, run: false, j2, fp,
    hands: [hand(0), hand(1)],
  });
}
const randHand = () => wPick(CARD_KEYS, k => CARDS[k].price, 3).map(k => ({ k, lv: 1, used: false }));

/* ---------- TANDA DE PENALTIS ---------- */
function startShootout() {
  const j2 = FR.mode === 'j2', lvl = LEVELS[FR.diff];
  G = { screen: 'match', mode: 'friendly', debug: false, money: 0, code: FR.c0, enemy: FR.c1, caps: [], perks: [], cards: [], round: 0, stats: { goals: 0, wins: 0 } };
  beginMatch({
    codes: [FR.c0, FR.c1], defs: [playerTeam(FR.c0), j2 ? playerTeam(FR.c1) : enemyTeam(FR.c1, lvl)], human: [true, j2], field: 'normal', ballType: 'normal', nBalls: 1,
    turns: [0, 0], mods: [{ form: FR.f0 }, { form: FR.f1 }], gwR: FIELD.gw, round: lvl, run: false, j2,
  });
  M.so = { kicks: [[], []], next: M.turn === 1 ? 1 : 0, idx: [0, 0], sc: [0, 0] };   // empieza quien salió en la moneda
  M.S.pens = true;
  M.w.noGoal = false; M.phase = 'wait'; M.over = false;
  hudScore(); hudCap(); hudHand();
  setTimeout(() => { if (M && M.so && G.screen === 'match') shootoutNext(); }, 1800);
}
function startShootoutHere() {
  if (M.so) return;
  M.regScore = M.score.slice();
  M.so = { kicks: [[], []], next: Math.random() < 0.5 ? 0 : 1, idx: [0, 0], sc: [0, 0] };
  M.w.noGoal = false; M.phase = 'wait'; M.seq++; M.extra = [0, 0]; M.sel = null;
  banner('🥅 PENALTIS', 'Nadie marcó en la prórroga', 1800); sfx.whistle();
  hudScore(); hudCap(); hudHand();
  setTimeout(() => { if (M && M.so && G.screen === 'match' && !M.over) shootoutNext(); }, 1900);
}
function shootoutNext() {
  if (!M || !M.so || M.over) return;
  const so = M.so, team = so.next;
  const att = M.w.bodies.filter(b => b.kind === 'cap' && b.team === team && b.role !== 'POR');
  const taker = att[so.idx[team]++ % att.length];
  resetKickoff(M.w); fx.trail = [];
  startPenalty(team, taker.id, { shoot: true });
}
function shootoutKick(team, ok) {
  const so = M.so, W = FIELD.W;
  so.kicks[team].push(ok); so.next = 1 - team; M.pen = null; M.phase = 'wait';
  if (ok) {
    M.score[team]++; M.goals[team]++; so.sc[team]++; sfx.goal(); fx.shake = 0.4;
    banner('¡GOOOL!', tn(M.codes[team]), 1300, M.human[team] ? 'good' : 'bad');
    for (let i = 0; i < 60; i++) fx.conf.push({ x: team === 0 ? W - 20 : 20, y: FIELD.H / 2 + (Math.random() - 0.5) * 120, vx: (Math.random() - 0.5) * 800 + (team === 0 ? -400 : 400), vy: (Math.random() - 0.5) * 800, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, c: pick(['#c6ff3d', '#35e0ff', '#ffd166', '#ff4d6d', '#fff']), life: 1.4 + Math.random() });
  } else banner('🧤 ¡PARADA!', 'Falla ' + tn(M.codes[team]), 1300);
  hudScore();
  const a = so.kicks[0], b = so.kicks[1], ga = so.sc[0], gb = so.sc[1];
  let done = false;
  if (a.length < 5 || b.length < 5) { const ra = Math.max(0, 5 - a.length), rb = Math.max(0, 5 - b.length); done = ga > gb + rb || gb > ga + ra; }
  else done = a.length === b.length && ga !== gb;
  if (done) { M.over = true; setTimeout(() => { if (M && M.so) { M.over = false; endMatch(); } }, 1500); }
  else setTimeout(() => { if (M && M.so && G.screen === 'match') shootoutNext(); }, 1700);
}
function beginMatch(S) {
  ZM.k = 1; ZM.x = 0; ZM.y = 0; TP.clear(); pinch = null;
  const w = makeWorld(S.defs[0], S.defs[1], { mods0: S.mods[0], mods1: S.mods[1], gwL: S.gwL || FIELD.gw, gwR: S.gwR, field: S.field, ballType: S.ballType, nBalls: S.nBalls });
  w.noGoal = true; w.ngOff = [false, false];
  const starter = (S.so || S.lab) ? 0 : (Math.random() < 0.5 ? 0 : 1);
  M = { ngLeft: 1,
    S, w, codes: S.codes, human: S.human, run: S.run, round: S.round, maxTurns: S.turns,
    score: S.fp ? [S.fp[0].includes('ventaja') ? 1 : 0, S.fp[1].includes('ventaja') ? 1 : 0] : [hasPerk('ventaja') && S.run ? 1 : 0, 0], turn: starter, rot: starter, shots: S.turns.slice(), extra: [0, 0], free: false, lastFree: false,
    phase: 'aim', sudden: 0, sel: null, drag: null, ptr: { x: 0, y: 0 }, aim: null,
    kits: [kitOf(S.codes[0]), kitOf(S.codes[1], S.codes[0])],
    goals: [0, 0], over: false, hover: null, acc: 0, seq: 0, skip: [0, 0], invert: [0, 0], lockPlays: [0, 0], immune: [false, false], pardon: [0, 0], windLeft: [0, 0], windOn: false, buffs: [], gold: [null, null], bonus: [0, 0], boostMul: 1.5,
    boostId: null, picking: null, touched: true, playTeam: null, pen: null, penAward: null, keepTurn: false, grass: { pat: rnd(7), col: rnd(6) }, gkHome: S.fp ? [S.fp[0].includes('guardian') ? 999 : 0, S.fp[1].includes('guardian') ? 999 : 0] : [hasPerk('guardian') && S.run ? 999 : 0, 0], open: [0, 0], star: null, homing: null, rec: null, replay: null, gw: [FIELD.gw, S.gwR],
    hands: S.hands || [[], []], play: null, cash: 0, tipCap: null, lastGoalVal: 0, so: null,
  };
  fx.conf = []; fx.rings = []; fx.trail = []; fx.pops = []; fx.arcs = []; fx.shake = 0; fx.slow = 0;
  pitchKey = '';
  G.screen = 'match';
  render(); resize();
  const tags = [];
  if (S.field !== 'normal') tags.push(FIELDS[S.field].icon + ' ' + FIELDS[S.field].n.toUpperCase());
  if (S.ballType !== 'normal') tags.push(BALLS[S.ballType].icon + ' BALÓN ' + BALLS[S.ballType].n.toUpperCase());
  if (S.nBalls > 1) tags.push('⚽×' + S.nBalls);
  const startName = S.j2 ? 'J' + (starter + 1) : (starter === 0 ? 'TÚ' : COUNTRIES[S.codes[1]].n);
  if (!S.so && !S.lab) coinFlip(S.codes, starter, startName);
  M.log = []; w.bodies.forEach(b => { if (b.kind === 'cap' && b.actB) { const o = {}; Object.keys(b.actB).forEach(k => { if (b.actB[k] > 0) o[k] = b.actB[k]; }); if (Object.keys(o).length) M.log.push({ m: '0', icon: '😎', txt: `${flagSVG(S.codes[b.team], 'sm')} <b>${b.name}</b> salta con mentalidad: ${deltaTxt(o)}` }); } });
  { const gs = w.bodies.filter(b => b.kind === 'cap' && b.goat); gs.forEach(b => M.log.push({ m: '0', icon: '🐐', txt: `${flagSVG(S.codes[b.team], 'sm')} <b>${b.name}</b> está en modo GOAT: todas las estadísticas a 12` }));
    if (gs.length) setTimeout(() => { if (M && M.S === S) { gs.forEach(b => { fx.pops.push({ x: b.x, y: b.y - 50, txt: '🐐 ¡MODO GOAT!', t: 0, col: '#ffe36a', big: 1.5 }); fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1.6 }); }); fx.shake = 0.35; sfx.win(); } }, S.so ? 400 : 1700); }
  setTimeout(() => { if (M && M.S === S) banner('¡PITIDO INICIAL!', (tags.length ? tags.join(' · ') + ' · ' : '') + (S.so ? 'PENALTIS' : S.run ? roundName(S.round) : 'AMISTOSO') + (tags.length ? ' · 🔒 Porterías cerradas en la primera jugada' : ''), 2600, 'start'); }, S.so ? 0 : 1300);
  sfx.whistle(); multiGK();
  if (!S.so && !M.human[starter]) { const sq = M.seq; setTimeout(() => { if (M && M.seq === sq && M.phase === 'aim' && !M.human[M.turn] && G.screen === 'match') aiTurn(); }, S.so ? 1800 : 1700); }
}
const matchTitle = () => M.so ? 'TANDA DE PENALTIS' : M.run ? roundName(G.round) : 'AMISTOSO';
const who = t => M.S.j2 ? 'J' + (t + 1) : (t === 0 ? 'TÚ' : 'RIVAL');

const vic0 = (A, B, pt) => A.team === pt ? B : A;
function startPlay(team, id) {
  M.touched = false; M.penCand = null; M.ballStart = M.w.balls.map(q => [q.x, q.y]); M.hitRival = false; M.vamp = {}; M.pushed = false; M.theater = false; M.playTeam = team; M.w.ballTouchedPlay = false; M.w.balls.forEach(q => { q.playHit = false; q.fireTeam = null; }); M.w.bodies.forEach(b => { b.spiderDone = false; b.spiderT = 0; b.spiderArm = undefined; });
  M.play = { team, shooter: id, relays: 0, touch: new Set(), posts: 0, walls: 0 };
  M.w.balls.forEach(b => { b.chg = 0; b.lastId = null; b.curve = null; if (b.btype === 'tres_d') b.fresh = true; });
  M.w.poisonArm = { shooter: id, armed: true };
  M.openSaved = null;
  if (M.open[team] > 0 && !M.free && !M.pen) {
    M.open[team]--; const w = M.w; M.openSaved = { lock: w.lock.slice(), team };
    if (w.noGoal) { w.noGoal = false; w.lock[team] = true; }
    w.lock[1 - team] = false;
    fx.pops.push({ x: FIELD.W / 2, y: FIELD.H / 2 - 60, txt: '¡PORTERÍA ABIERTA!', t: 0, col: '#ffd166', big: 1.2 });
  }
  M.homing = null; M.rec = { fr: [], acc: 0, on: true }; recFrame();
  if (M.windLeft[team] > 0) { M.windLeft[team]--; const dir = windDir(team); M.windPrev = M.w.tilt; M.w.tilt = { ax: 240 * dir, ay: 0, ang: dir > 0 ? 0 : Math.PI }; M.windOn = true; }
}
/* hacia dónde ataca el equipo: +1 = hacia la derecha */
function windDir(team) { return physSide(M.w, team) === 0 ? 1 : -1; }
function gkReturn(side, now) {
  const perkOn = side === 0 && M.run && !M.S.fp && hasPerk('guardian');   // también si la reliquia se compra en la tienda en pleno partido
  if (!M.gkHome[side] && !perkOn) return;
  const gk = M.w.bodies.find(b => b.kind === 'cap' && b.team === side && b.role === 'POR'); if (!gk) return;
  if (Math.hypot(gk.x - gk.hx, gk.y - gk.hy) > 4) { fx.rings.push({ x: gk.x, y: gk.y, t: 0, v: 1.2 }); gk.x = gk.hx; gk.y = gk.hy; fx.rings.push({ x: gk.x, y: gk.y, t: 0, v: 1.2 }); }
  gk.vx = gk.vy = 0;
  if (!now && M.gkHome[side] > 0) M.gkHome[side]--;
}
function recFrame() {
  const R = M.rec; if (!R || !R.on || R.fr.length > 1100) return;
  R.fr.push(M.w.bodies.map(b => [b.x, b.y, b.ang || 0, b.air > 0 ? Math.sin(Math.PI * (1 - b.air / b.air0)) * 46 : 0]));
}
function capById(id) { return M.w.bodies.find(b => b.id === id); }

function pointerField(e) {
  const r = cv.getBoundingClientRect();
  return { x: (((e.clientX - r.left) / UK - ZM.x) / ZM.k - view.ox) / view.S, y: (((e.clientY - r.top) / UK - ZM.y) / ZM.k - view.oy) / view.S };
}
/* zoom con dos dedos (solo táctil): cámara ZM aplicada al dibujar; k=1 es la vista normal */
const ZM = { k: 1, x: 0, y: 0 }, TP = new Map();
let pinch = null;
function clampZoom() {
  ZM.k = Math.max(1, Math.min(2.6, ZM.k));
  if (ZM.k < 1.03) { ZM.k = 1; ZM.x = 0; ZM.y = 0; return; }
  ZM.x = Math.max(view.w * (1 - ZM.k), Math.min(0, ZM.x)); ZM.y = Math.max(view.h * (1 - ZM.k), Math.min(0, ZM.y));
}
function pinchStart() {
  const [a, b] = [...TP.values()], r = cv.getBoundingClientRect();
  pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: ((a.x + b.x) / 2 - r.left) / UK, my: ((a.y + b.y) / 2 - r.top) / UK, k: ZM.k, x: ZM.x, y: ZM.y };
}
function pinchMove() {
  if (!pinch || TP.size < 2) return;
  const [a, b] = [...TP.values()], r = cv.getBoundingClientRect();
  const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = ((a.x + b.x) / 2 - r.left) / UK, my = ((a.y + b.y) / 2 - r.top) / UK;
  const k = Math.max(1, Math.min(2.6, pinch.k * d / pinch.d));
  // el punto del mundo bajo el centro inicial queda bajo el centro actual
  const wx = (pinch.mx - pinch.x) / pinch.k, wy = (pinch.my - pinch.y) / pinch.k;
  ZM.k = k; ZM.x = mx - wx * k; ZM.y = my - wy * k; clampZoom();
}
const canShoot = () => M && M.phase === 'aim' && M.human[M.turn];
/* reliquia Reflejos: se pueden usar comodines mientras la CPU se prepara para tirar */
const oppWin = () => !!(M && !M.over && !M.S.j2 && !M.human[M.turn] && M.human[0] && M.waitWin && hasPerk('reflejos'));

const starOn = c => M.star && M.star.id === c.id && M.star.left > 0;
const nearBall = c => M.w.balls.reduce((a, b) => Math.hypot(a.x - c.x, a.y - c.y) < Math.hypot(b.x - c.x, b.y - c.y) ? a : b);
function updateAim() {
  if (!M.drag) { M.aim = null; return; }
  const c = capById(M.drag.id);
  const dx = c.x - M.ptr.x, dy = c.y - M.ptr.y, len = Math.hypot(dx, dy);
  const power = Math.min(1, len / 170);
  M.drag.power = power; M.drag.len = len;
  if (len < 18) { M.aim = null; return; }
  let ang = Math.atan2(dy, dx);
  M.drag.ang = ang;
  M.aim = aimPath(M.w, c.id, ang, power, M.blind && M.blind[c.team] > 0 ? 0 : visOf(c, pk(c.team, 'visor') ? 1.4 : 1));
}

function cancelAim() {
  if (!M) return;
  if (M.drag) { M.drag = null; M.aim = null; M.sel = null; hudCap(); sfx.click(); }
  else if (M.picking) { M.picking = null; hudCap(); toast('Carta cancelada (no se ha gastado)'); }
}

/* ---------- cartas (sirven para cualquiera de los dos equipos) ---------- */
const PICKS = ['energia', 'tele', 'congelar', 'superestrella', 'motivado', 'soborno'];
const PICK_HELP = { soborno: '💶 Elige el jugador RIVAL (no el portero) que juega para ti', motivado: '✨ Elige el jugador que se motiva', super: '💪 Elige el jugador del Supertiro', energia: '⚡ Elige el jugador que recibe la bebida', tele: '🌀 Elige el jugador a teletransportar', congelar: '❄ Elige el jugador RIVAL a congelar', superestrella: '🌟 Elige a la SUPERESTRELLA', corona: '🐐 Elige el jugador que será GOAT (de cualquier equipo)' };
const handSide = () => (M.S.j2 && M.human[M.turn]) ? M.turn : (M.human[0] ? 0 : M.turn);
function addBuff(name, left, undo) { M.buffs.push({ name, left, undo, c: M.curC }); }
// ¿el comodín usado sigue pendiente de tener efecto?
function cardLeft(c, side) {   // false = sin efecto pendiente · true = pendiente sin contador · número = turnos que quedan
  const k = c.k, o = 1 - side, n = (a, t) => a && a[t] > 0 ? (a[t] < 99 ? a[t] : true) : false;
  const bl = M.buffs.filter(b => b.c === c && b.left > 0); if (bl.length) { const m = Math.min(...bl.map(b => b.left)); return m < 99 ? m : true; }
  if (k === 'fuerajuego') return n(M.offs, side);
  if (k === 'invisible') return n(M.invis, side);
  if (k === 'ceguera') return n(M.blind, o);
  if (k === 'desorden') return n(M.scat, side);
  if (k === 'pasetiro') return n(M.rkick, side);
  if (k === 'pase') return n(M.pase, side);
  if (k === 'marrullero') return n(M.marr, side);
  if (k === 'portero') return n(M.gkHome, side);
  if (k === 'viento') return n(M.windLeft, side);
  if (k === 'abierta') return n(M.open, side);
  if (k === 'silbato') return n(M.skip, o);
  if (k === 'invertir') return n(M.invert, o);
  if (k === 'perdon') return n(M.pardon, side);
  if (k === 'rush') return n(M.rush, side);
  if (k === 'oro') return !!(M.gold[side] && M.gold[side].left > 0);
  if (k === 'amarilla') { const l = (M.sent || []).filter(s => s.team === o).map(s => s.left); return l.length ? Math.max(...l) : false; }
  if (k === 'congelar') { const l = M.w.bodies.filter(b => b.kind === 'cap' && b.team === o && b.frozen > 0).map(b => b.frozen); return l.length ? Math.max(...l) : false; }
  if (k === 'apagon') return n(M.cardBan, o);
  if (k === 'gdoble' || k === 'gtriple') return !!(M.ng && M.ng.mul > 1);
  if (k === 'ginv') return !!(M.ng && M.ng.inv);
  if (k === 'blindada' || k === 'puertacerrada') return !!(M.w.lock && M.w.lock[side]) && (M.lockPlays && M.lockPlays[side] > 0 ? M.lockPlays[side] : true);
  if (k === 'superestrella') return !!(M.star && M.star.team === side && M.star.left > 0);
  if (k === 'penalti') return !!M.penAward;
  return false;
}
const cardPending = (c, side) => !!cardLeft(c, side);
/* anuncio grande en el centro cuando el equipo contrario usa un comodín */
function cardAnnounce(side, k, lv) {
  const old = document.getElementById('cardann'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'cardann';
  const modal = side === 1 && !M.S.j2 && !M.so;   // la CPU usa un comodín: el juego espera a que el jugador pulse ACEPTAR
  el.innerHTML = `<div class="ca-in">${flagSVG(M.codes[side], 'ca-flag')}<div class="ca-txt"><small>${tn(M.codes[side])} usa un comodín</small><b>${CARDS[k].n}</b><span>${CARDS[k].d(lv)}</span>${modal ? '<button class="btn big ca-ok">ACEPTAR</button>' : ''}</div><div class="ca-art">${ART[k]}</div></div>`;
  document.body.appendChild(el);
  if (!modal) { setTimeout(() => el.classList.add('out'), 1400); setTimeout(() => el.remove(), 1800); return; }
  el.classList.add('modal');
  M.annP = new Promise(res => {
    const done = () => { document.removeEventListener('keydown', kd, true); el.classList.add('out'); setTimeout(() => el.remove(), 300); M.annP = null; res(); };
    const kd = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); done(); } };
    document.addEventListener('keydown', kd, true);
    el.querySelector('.ca-ok').onclick = done;
    M.annDone = done;
  });
}
/* aviso en modal del penalti (igual que el de un comodín del rival): el penalti espera a que se pulse ACEPTAR */
function penAnnounce(team, taker, shoot) {
  const old = document.getElementById('cardann'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'cardann'; el.className = 'modal';
  el.innerHTML = `<div class="ca-in">${flagSVG(M.codes[team], 'ca-flag')}<div class="ca-txt"><small>Penalti para ${tn(M.codes[team])}</small><b>🥅 ¡PENALTI!</b><span>${taker.name} lanza desde los 11 metros${M.human[team] ? ': para la flecha en la zona verde' : ''}.</span>${M.penWhy ? `<span class="mut">${M.penWhy}</span>` : ''}<button class="btn big ca-ok">ACEPTAR</button>${M.penRec ? '<button class="btn ghost" data-a="penrep">📹 VER REPETICIÓN</button>' : ''}</div><div class="ca-art"><div class="emo" style="font-size:64px">⚽</div></div></div>`;
  document.body.appendChild(el);
  const P = M.pen; if (P) P.hold = true;
  const done = () => { document.removeEventListener('keydown', kd, true); el.classList.add('out'); setTimeout(() => el.remove(), 300); if (P) P.hold = false; };
  const kd = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (M && M.phase === 'replay') return; done(); } };
  document.addEventListener('keydown', kd, true);
  el.querySelector('.ca-ok').onclick = done;
}
/* comodín de la CPU: primero sale el aviso y el efecto se aplica DESPUÉS de pulsar ACEPTAR */
function runCard(side, idx, tg) {
  const c = M.hands[side][idx];
  if (side === 1 && !M.S.j2 && !M.so && c) {
    const M0 = M; cardAnnounce(side, c.k, 1);
    if (M.annP) {
      c.used = true; hudHand();   // reservada mientras se espera el ACEPTAR
      M.annP = M.annP.then(() => { if (M !== M0) return; M.annP = null; c.used = false; runCard0(side, idx, tg, true); });
      return;
    }
  }
  runCard0(side, idx, tg, false);
}
function runCard0(side, idx, tg, announced) {
  if (M.lab && typeof labSnap === 'function') labSnap();
  const c = M.hands[side][idx], lv = 1, k = c.k, w = M.w, opp = 1 - side; M.curC = c;
  if (!announced && (side === 1 || M.S.j2)) cardAnnounce(side, k, lv);
  logEv('🃏', (side === 0 || M.S.j2 ? '' : 'Rival: ') + CARDS[k].n);
  const instantMove = () => { M.keepTurn = true; M.phase = 'move'; M.acc = 0; M.stillT = 0; M.moveT = 0; M.playTeam = null; M.touched = true; M.play = null; M.sel = null; };
  if (k === 'energia') { tg.vmax = Math.min(1500, tg.vmax * [1.2, 1.35, 1.5][lv - 1]); fx.pops.push({ x: tg.x, y: tg.y - 40, txt: '⚡ +POTENCIA', t: 0, col: '#ffe36a', big: 1 }); }
  else if (k === 'tele') {
    const bl = w.balls.reduce((a, b) => Math.hypot(a.x - tg.x, a.y - tg.y) < Math.hypot(b.x - tg.x, b.y - tg.y) ? a : b);
    const dir = physSide(w, side) === 0 ? -1 : 1;
    let nx = bl.x + dir * (tg.r + bl.r + 8), ny = bl.y;
    for (let it = 0; it < 4; it++) w.bodies.forEach(o => { if (o === tg || o.kind === 'ball') return; const dx = nx - o.x, dy = ny - o.y, d = Math.hypot(dx, dy), rr = tg.r + o.r + 2; if (d < rr) { const q = d < 1e-6 ? 1 : d; nx = o.x + dx / q * rr; ny = o.y + (d < 1e-6 ? rr : dy / q * rr); } });
    fx.rings.push({ x: tg.x, y: tg.y, t: 0, v: 1.4 }); tg.x = Math.min(FIELD.W - tg.r - 4, Math.max(tg.r + 4, nx)); tg.y = Math.min(FIELD.H - tg.r - 4, Math.max(tg.r + 4, ny)); tg.vx = tg.vy = 0;
    fx.rings.push({ x: tg.x, y: tg.y, t: 0, v: 1.4 }); sfx.zap();
    M.boostMul = [1.2, 1.5, 1.9][lv - 1]; M.boostMax = false; M.boostId = tg.id;
  }
  else if (k === 'corona') {
    { const all = w.bodies.filter(b => b.kind === 'cap' && !b.goat && !b.out), mine = all.filter(b => b.team === side), rival = all.filter(b => b.team !== side);
      tg = pick(mine.length && (!rival.length || Math.random() < 0.7) ? mine : rival.length ? rival : all); }   // 70% de un jugador de quien usa el comodín, 30% del rival
    if (!tg) { toast('Todos los jugadores ya son GOAT'); } else {
      const o = Object.assign({}, tg.st), t12 = (12 - 1) / 11;
      tg.vmax = Math.min(1500, tg.vmax * potV(12) / potV(o.POT));
      tg.m *= massFor(12) / massFor(o.PES); tg.dec += 9 * (12 - o.PES); tg.r *= 1 + 0.012 * (12 - o.PES);
      STAT_KEYS.forEach(s2 => { tg.st[s2] = Math.max(tg.st[s2], 12); }); tg.dev = devFor(tg.st.PRE); tg.goat = true; tg.irid = true;
      fx.pops.push({ x: tg.x, y: tg.y - 50, txt: '🐐 ¡MODO GOAT!', t: 0, col: '#ffe36a', big: 1.5 }); fx.rings.push({ x: tg.x, y: tg.y, t: 0, v: 1.8 }); fx.shake = 0.4; sfx.win();
      banner('🐐 ' + tg.name.toUpperCase() + ' ES GOAT', 'Todas las estadísticas a 12 el resto del partido', 2000); logEv('🐐', `<b>${tg.name}</b> (${tn(M.codes[tg.team])}) se convierte en GOAT`); hudCap();
    }
  }
  else if (k === 'motivado') {
    const d0 = {}; STAT_KEYS.forEach(s => { const n = Math.min(12, tg.st[s] + lv); d0[s] = n - tg.st[s]; tg.st[s] = n; });
    tg.vmax = Math.min(1500, tg.vmax * potV(tg.st.POT) / potV(tg.st.POT - d0.POT)); tg.m += massFor(tg.st.PES) - massFor(tg.st.PES - d0.PES); tg.dec += 9 * d0.PES; tg.r *= 1 + 0.012 * d0.PES; tg.dev = devFor(tg.st.PRE); tg.mot = true;
    fx.pops.push({ x: tg.x, y: tg.y - 44, txt: '✨ ¡MOTIVADO!', t: 0, col: '#ff9be8', big: 1.3 }); fx.rings.push({ x: tg.x, y: tg.y, t: 0, v: 1.4 });
  }
  else if (k === 'amarilla') {
    const cand = w.bodies.filter(b => b.kind === 'cap' && b.team === opp && b.role !== 'POR');
    const n = lv >= 3 ? 2 : 1, turns = lv === 1 ? 2 : 3; let names = [];
    shuffle(cand).slice(0, n).forEach(b => {
      w.bodies.splice(w.bodies.indexOf(b), 1); (M.sent = M.sent || []).push({ b, team: opp, left: turns }); names.push(b.name);
      fx.pops.push({ x: b.x, y: b.y - 40, txt: '🟨 ¡EXPULSADO!', t: 0, col: '#ffe14a', big: 1.2 }); fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1.4 });
    });
    if (names.length) { sfx.whistle(); logEv('🟨', 'Expulsado ' + names.join(' y ') + ' (' + tn(M.codes[opp]) + ')'); } else toast('No hay jugadores que expulsar');
  }
  else if (k === 'abierta') { M.open[side] += [3, 5, 8][lv - 1]; fx.pops.push({ x: FIELD.W / 2, y: FIELD.H / 2, txt: '🥅 ¡PORTERÍA ABIERTA!', t: 0, col: '#ffd166', big: 1.3 }); }
  else if (k === 'portero') { M.gkHome[side] = [3, 6, 999][lv - 1]; gkReturn(side, true); }
  else if (k === 'superestrella') { M.star = { id: tg.id, name: tg.name, team: tg.team, left: [2, 4, 999][lv - 1] }; fx.pops.push({ x: tg.x, y: tg.y - 44, txt: '🌟 SUPERESTRELLA', t: 0, col: '#ffe36a', big: 1.3 }); fx.shake = 0.25; }
  else if (k === 'congelar') { tg.frozen = lv + 1; tg.mOrig = tg.m; tg.m = 1e6; tg.vx = tg.vy = 0; fx.pops.push({ x: tg.x, y: tg.y - 40, txt: '❄ ¡CONGELADA!', t: 0, col: '#bff2ff', big: 1.2 }); sfx.whistle(); }
  else if (k === 'doble') { M.extra[side] += lv === 3 ? 2 : 1; if (lv >= 2) M.immune[side] = true; }
  else if (k === 'triple') { M.extra[side] += lv === 3 ? 3 : 2; if (lv >= 2) M.immune[side] = true; }
  else if (k === 'blindada') { w.lock[side] = true; M.lockPlays[side] = lv; }
  else if (k === 'puertacerrada') { w.lock[side] = true; M.lockPlays[side] = lv + 1; fx.shake = 0.2; banner('🚪 PUERTA CERRADA', 'La portería queda bloqueada durante ' + (lv + 1) + ' turnos del rival', 1600); logEv('🚪', 'Puerta cerrada: portería bloqueada ' + (lv + 1) + ' turnos'); }
  else if (k === 'silbato') M.skip[opp] += lv === 3 ? 2 : 1;
  else if (k === 'invertir') M.invert[opp] += lv;
  else if (k === 'var') { clearField(w); M.S.field = 'normal'; pitchKey = ''; if (lv >= 2) M.score[opp] = Math.max(0, M.score[opp] - (lv - 1)); }
  else if (k === 'viento') { M.windLeft[side] += lv + 2; M.windFx = { dir: windDir(side), t: 3 }; sfx.whoosh(); banner('🌬️ VIENTO A FAVOR', 'Empuja los tiros de quien lo activa'); }
  else if (k === 'perdon') M.pardon[side] += lv;
  else if (k === 'oro') M.gold[side] = { mul: lv === 3 ? 3 : 2, left: lv === 2 ? 2 : 1 };
  else if (k === 'gigante') { w.balls.forEach(b => { b.r0 = b.r; b.r *= 1.7; }); addBuff('🔵 Balón gigante', [4, 8, 12][lv - 1], () => w.balls.forEach(b => { b.r = b.r0 || b.r; })); }
  else if (k === 'muro') { const gk = w.bodies.find(b => b.kind === 'cap' && b.team === side && b.role === 'POR'); if (gk) { gk.r0 = gk.r; gk.m0g = gk.m; gk.r *= 1.5; gk.m *= 1.5; addBuff('🧱 Muro humano', lv === 3 ? 999 : [4, 8][lv - 1], () => { gk.r = gk.r0; gk.m = gk.m0g; }); } }
  else if (k === 'pista') { const old = w.fdec; w.fdec = 0.26; addBuff('🧊 Pista de hielo', [4, 6, 8][lv - 1], () => { w.fdec = w.field === 'normal' ? 1 : old; }); }
  else if (k === 'cambio') {
    const opts = FIELD_KEYS.filter(f => f !== w.field), nf = pick(opts);
    applyField(w, nf); M.S.field = nf; pitchKey = '';
    if (lv >= 2) M.extra[side] += lv - 1;
    fx.shake = 0.5; banner('🔀 ' + FIELDS[nf].icon + ' ' + FIELDS[nf].n.toUpperCase(), FIELDS[nf].d, 1800);
  }
  else if (k === 'gdoble' || k === 'gtriple' || k === 'ginv') { M.ng = M.ng || { mul: 1, inv: false }; if (k === 'ginv') M.ng.inv = true; else M.ng.mul = Math.max(M.ng.mul, k === 'gtriple' ? 3 : 2); fx.shake = 0.2; }
  else if (k === 'caos') {
    // los dos equipos intercambian sus posiciones: cada jugador ocupa exactamente el sitio de un rival (portero con portero, resto ordenados por altura)
    const ord = t => w.bodies.filter(b => b.kind === 'cap' && b.team === t).sort((p, q) => (p.role === 'POR' ? -1e6 : p.y) - (q.role === 'POR' ? -1e6 : q.y));
    const A = ord(0), B = ord(1), n = Math.min(A.length, B.length);
    for (let i = 0; i < n; i++) { const a0 = A[i], b0 = B[i], ax = a0.x, ay = a0.y; a0.x = b0.x; a0.y = b0.y; b0.x = ax; b0.y = ay; }
    w.bodies.forEach(b => { if (b.kind === 'cap') { b.vx = b.vy = 0; fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1.2 }); } });
    if (lv >= 2) M.extra[side] += lv - 1;
    fx.shake = 0.5; banner('🔄 INTERCAMBIO TOTAL', 'Los equipos intercambian sus posiciones', 1600);
  }
  else if (k === 'presion') { w.bodies.filter(b => b.kind === 'cap' && b.team === opp).forEach(b => { b.st.MEN = 1; }); for (let i = 0; i < lv; i++) mentalDrop(w.bodies.filter(b => b.kind === 'cap' && b.team === opp), i ? '' : tn(M.codes[side]) + ' presiona: ' + tn(M.codes[opp]) + ' pierde la cabeza (mentalidad 1)'); banner('😞 PRESIÓN', 'Mentalidad 1 para todo el rival', 1500); fx.shake = 0.3; }
  else if (k === 'ladron') {
    const oh = M.hands[opp], mine = M.hands[side], shared = oh === mine;
    const n = lv >= 3 ? 2 : 1; let got = [];
    for (let q = 0; q < n; q++) {
      if (shared) { const rk = wPick(CARD_KEYS.filter(x => x !== 'ladron'), k => CARDS[k].price, 1)[0]; mine.push({ k: rk, lv: 1, used: false }); got.push(CARDS[rk].n); continue; }   // laboratorio: manos comunes, se simula
      const av = oh.filter(x => !x.used && !x.gone); if (!av.length) break;
      const v = pick(av); v.used = true; v.gone = true; mine.push({ k: v.k, lv: 1, used: false }); got.push(CARDS[v.k].n);
    }
    if (lv === 2) M.extra[side] += 1;
    fx.shake = 0.25; banner('🦹 ' + (got.length ? 'ROBAS: ' + got.join(' + ').toUpperCase() : 'EL RIVAL NO TENÍA COMODINES'), got.length ? 'El comodín pasa a la mano' : 'No había nada que robar', 1800); logEv('🦹', got.length ? 'Roba: ' + got.join(', ') : 'No había comodines que robar'); hudHand();
  }
  else if (k === 'apagon') { M.cardBan = M.cardBan || [0, 0]; M.cardBan[opp] = Math.max(M.cardBan[opp], lv + 1); fx.shake = 0.25; banner('🚫 APAGÓN', 'El rival no puede usar comodines ' + (lv + 1) + ' turnos', 1800); logEv('🚫', 'Apagón: ' + (lv + 1) + ' turnos sin comodines para el rival'); hudHand(); }
  else if (k === 'soborno') {
    if (tg.role === 'POR') { toast('El portero no se deja sobornar'); M.hands[side][idx].used = false; return; }
    tg.origTeam = tg.team; tg.team = side; M.sel = tg.id; M.extra[side] += lv - 1;
    fx.pops.push({ x: tg.x, y: tg.y - 44, txt: '💶 ¡SOBORNADO!', t: 0, col: '#7dff9a', big: 1.4 }); fx.rings.push({ x: tg.x, y: tg.y, t: 0, v: 1.4 }); fx.shake = 0.25; sfx.coin && sfx.coin();
    logEv('💶', tg.name + ' juega para ' + tn(M.codes[side]) + ' este turno');
  }
  else if (k === 'pasetiro') { M.rkick = M.rkick || [0, 0]; M.rkick[side] = 3; fx.shake = 0.2; banner('💀 PASE DE LA MUERTE', 'El que recibe un pase dispara a portería', 1600); logEv('💀', 'Pase de la muerte: el que recibe un pase dispara a portería'); }
  else if (k === 'lesion') {
    const mine = w.bodies.filter(b => b.kind === 'cap' && b.team === side && b.role !== 'POR');
    if (mine.length < 3 || (M.lesion && M.lesion[side])) { toast(mine.length < 3 ? 'No quedan jugadores suficientes para lesionar a uno' : 'Ya hay un jugador lesionado'); M.hands[side][idx].used = false; return; }
    const v = pick(mine); w.bodies.splice(w.bodies.indexOf(v), 1); if (M.sel === v.id) M.sel = null;
    M.lesion = M.lesion || [0, 0]; M.lesion[side] = 1; if (lv >= 2) M.extra[side] += lv - 1;
    fx.rings.push({ x: v.x, y: v.y, t: 0, v: 1.4 }); fx.pops.push({ x: v.x, y: v.y - 30, txt: '🤕', t: 0, col: '#ff8a8a', big: 1.4 }); fx.shake = 0.3;
    banner('🤕 LESIÓN', v.name + ' se lesiona: un jugador menos, ×3 de dinero', 1800); logEv('🤕', v.name + ' se lesiona: ' + tn(M.codes[side]) + ' ×3 de dinero');
  }
  else if (k === 'desorden') { M.scat = M.scat || [0, 0]; M.scat[side] = 999; if (lv >= 2) M.extra[side] += lv - 1; banner('🌪️ RIVAL DESORDENADO', 'Tras cada gol, el rival se coloca al azar', 1600); logEv('🌪️', 'Rival desordenado: tras cada gol se colocan al azar'); }
  else if (k === 'cesped') { w.tall = w.tall || [0, 0]; w.tall[side] = 1; fx.shake = 0.2; addBuff('🌿 Césped alto' + (M.S.j2 || side ? ' (' + tn(M.codes[side]) + ')' : ''), 3, () => { w.tall[side] = 0; }); banner('🌿 CÉSPED ALTO', 'El balón se frena en el área de ' + (side === 0 && !M.S.j2 ? 'tu equipo' : tn(M.codes[side])), 1600); }
  else if (k === 'ceguera') { M.blind = M.blind || [0, 0]; M.blind[opp] = [3, 4, 5][lv - 1]; fx.shake = 0.2; banner('🕶️ CEGUERA', 'El rival pierde toda la visión de juego durante ' + M.blind[opp] + ' turnos', 1700); logEv('🕶️', 'Ceguera: visión 0 para el rival durante ' + M.blind[opp] + ' turnos'); hudCap(); }
  else if (k === 'desmotivacion') {
    const dn = lv, foes = w.bodies.filter(b => b.kind === 'cap' && b.team === opp);
    foes.forEach(b => {
      STAT_KEYS.forEach(s2 => {
        const n2 = Math.max(1, b.st[s2] - dn), real = Math.round((n2 - b.st[s2]) * 10) / 10; if (!real) return;
        b.st[s2] = n2;
        if (s2 === 'POT') b.vmax = Math.max(200, b.vmax * potV(b.st.POT) / potV(b.st.POT - real));
        if (s2 === 'PES') { b.m += massFor(b.st.PES) - massFor(b.st.PES - real); b.dec += 9 * real; b.r *= 1 + 0.012 * real; }
        if (s2 === 'PRE') b.dev = devFor(b.st.PRE);
        b.actB = b.actB || {}; b.actB[s2] = Math.round(((b.actB[s2] || 0) + real) * 10) / 10;
      });
      fx.pops.push({ x: b.x, y: b.y - 40, txt: '😞 −' + dn, t: 0, col: '#ff8a8a', big: 0.9 });
    });
    fx.shake = 0.3; banner('😞 DESMOTIVACIÓN', 'Todo el rival baja −' + dn + ' en todas las estadísticas', 1700); logEv('😞', 'Desmotivación: el rival baja −' + dn + ' en todo'); hudCap();
  }
  else if (k === 'intoxicados') {
    let n3 = 0; w.bodies.filter(b => b.kind === 'cap' && b.team === opp && !hierroOn(M.w, b) && !b.poison).forEach(b => { b.poison = true; n3++; fx.pops.push({ x: b.x, y: b.y - 44, txt: '☠ ENVENENADO', t: 0, col: '#dba0ff', big: 1 }); });
    if (lv >= 2) M.extra[side] += lv - 1;
    fx.shake = 0.3; banner('🤢 INTOXICADOS', n3 ? 'Todo el rival pierde la puntería' : 'Nadie se pudo envenenar', 1700); logEv('🤢', 'Intoxicados: ' + n3 + ' jugadores sin puntería'); hudCap();
  }
  else if (k === 'invisible') { M.invis = M.invis || [0, 0]; M.invis[side] = [3, 4, 5][lv - 1]; banner('👻 INVISIBLES', 'El rival no os ve en ' + M.invis[side] + ' jugadas', 1600); logEv('👻', 'Equipo invisible durante ' + M.invis[side] + ' jugadas del rival'); }
  else if (k === 'fuerajuego') { M.offs = M.offs || [0, 0]; M.offs[side] = 1; banner('🚩 FUERA DE JUEGO', 'Se anula el primer gol que meta el rival', 1600); logEv('🚩', 'Fuera de juego preparado (' + M.offs[side] + ')'); }
  else if (k === 'penalti') {
    const caps = M.w.bodies.filter(b => b.kind === 'cap' && b.team === side && b.role !== 'POR'), tk = caps.sort((a, b2) => b2.st.PRE - a.st.PRE)[0];
    if (tk) { sfx.whistle(); logEv('🥅', 'Penalti injusto a favor de ' + tn(M.codes[side])); M.penWhy = '🃏 Comodín «Penalti injusto»'; startPenalty(side, tk.id, { shoot: true, gmul: [1, 1.4, 1.9][lv - 1] }); }
  }
  else if (k === 'pase') { M.pase = M.pase || [0, 0]; M.pase[side] = [3, 5, 999][lv - 1]; fx.shake = 0.2; banner('🤝 PASE DE ORO', 'Los goles de pase valen doble', 1600); logEv('🤝', 'Pase de oro: los goles de pase valen doble'); }
  else if (k === 'plantilla') {
    const n = lv + rnd(5 - lv);   // jugadores por equipo: de lv a 4
    [0, 1].forEach(t => {
      const mine = w.bodies.filter(b => b.kind === 'cap' && b.team === t), gk = mine.find(b => b.role === 'POR'), field = shuffle(mine.filter(b => b !== gk));
      const keep = new Set(n === 1 ? [field[0] || gk] : [gk, ...field.slice(0, n - 1)].filter(Boolean));
      mine.forEach(b => { if (!keep.has(b)) { w.bodies.splice(w.bodies.indexOf(b), 1); fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1.3 }); fx.pops.push({ x: b.x, y: b.y - 30, txt: '👋', t: 0, col: '#fff', big: 1 }); } });
    });
    M.sel = null; fx.shake = 0.4; banner('👥 ' + n + ' × ' + n, 'Cambio de plantilla: ' + n + ' jugador' + (n > 1 ? 'es' : '') + ' por equipo', 2000); logEv('👥', 'Cambio de plantilla: ' + n + '×' + n);
  }
  else if (k === 'marrullero') { M.marr = M.marr || [0, 0]; M.marr[side] = [3, 5, 999][lv - 1]; fx.shake = 0.2; banner('😈 MARRULLERO', 'Los goles empujando a un rival valen doble', 1600); logEv('😈', 'Marrullero: los goles empujando a un rival valen doble'); }
  else if (k === 'rush') { M.rush = M.rush || [0, 0]; M.rush[side] = Math.max(M.rush[side], lv + 2); fx.shake = 0.2; }
  else if (k === 'areas') {
    const W = FIELD.W;   // los jugadores se intercambian de campo; las porterías NO cambian de sitio
    w.bodies.forEach(b => { if (b.kind !== 'cap') return; b.x = W - b.x; b.vx = b.vy = 0; });
    if (w.bumpers || w.kz) { if (w.bumpers) avoidBumpers(w); if (w.kz) w.kz.forEach((p, h) => { if (p.bumpers) avoidBumpers({ bumpers: p.bumpers, bodies: w.bodies.filter(o => (o.x < W / 2 ? 0 : 1) === h) }); }); }
    pitchKey = '';
    if (lv >= 2) M.extra[side] += lv - 1;
    w.bodies.forEach(b => { if (b.kind === 'cap') fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1.2 }); });
    fx.shake = 0.5; banner('🔄 CAMBIO DE ÁREAS', 'Los jugadores intercambian sus posiciones; las porterías no se mueven', 1800);
  }
  else if (k === 'minigol') { const g0 = M.gw[side]; M.gw[side] = FIELD.gw * [0.5, 0.4, 0.3][lv - 1]; setGoalWidths(w, M.gw[physSide(w, 0)], M.gw[physSide(w, 1)]); pitchKey = ''; fx.shake = 0.3; addBuff('🥅 Portería mini', 3, () => { M.gw[side] = g0; setGoalWidths(M.w, M.gw[physSide(M.w, 0)], M.gw[physSide(M.w, 1)]); pitchKey = ''; }); }
  else if (k === 'extra') {
    const spots = [[0, 0], [0, -100], [0, 100], [0, -190], [0, 190], [-90, 0], [90, 0]]; let n = lv;
    for (const [ox, oy] of spots) {
      if (!n || w.balls.length >= 4) break;
      if (w.bodies.some(o => Math.hypot(o.x - (FIELD.W / 2 + ox), o.y - (FIELD.H / 2 + oy)) < o.r + 30)) continue;
      const b = ballBody(M.S.ballType); b.ox = ox; b.oy = oy; b.x += ox; b.y += oy; b.id = 90 + w.balls.length; b.chg = 0; w.bodies.push(b); w.balls.push(b); w.ball = b; n--;
      fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1.5 });
    }
  }
  else if (k === 'terremoto') {
    const sp = [220, 320, 430][lv - 1];
    w.bodies.forEach(b => { if (b.kind === 'cap' && b.team === opp && !b.frozen) { const a = Math.random() * Math.PI * 2, v = sp * (0.6 + Math.random() * 0.8); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1 }); } });
    fx.shake = 0.6; instantMove();
  }
  c.used = true; if (M.lab) c.gone = true; sfx.coin();
  if (!PICKS.includes(k)) banner(CARDS[k].n.toUpperCase(), CARDS[k].d(lv), 1500);
  hudScore(); hudCap(); hudHand();
}
function applyPick(tg) {
  const pk = M.picking; M.picking = null; const win = M.waitWin;
  if (pk.k === 'congelar' && hierroOn(M.w, tg)) { toast('🩹 Salud de hierro: no se puede congelar (carta no gastada)'); hudCap(); return; }
  runCard(pk.side, pk.idx, tg); if (win && M.phase === 'move') M.seq++;
}
function applyBoost(c) { if (M.boostId === c.id) { let f = M.boostMul; if (M.boostMax) { f *= Math.max(1, 1480 / Math.max(1, c.vmax)); M.fire = true; M.boostMax = false; } c.vx *= f; c.vy *= f; c.m0 = c.m; c.m *= 2; M.boostCap = c; M.boostId = null; } }

function onDown(e) {
  if (!M || G.screen !== 'match') return;
  if (e.button === 2) { cancelAim(); return; }
  if (e.pointerType === 'touch') {
    TP.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (TP.size >= 2) { if (M.drag) cancelAim(); if (TP.size === 2) pinchStart(); return; }   // segundo dedo: cancela la puntería y permite zoom
  }
  const p = pointerField(e); M.ptr = p;
  if (M.lab && !M.picking && typeof labPick === 'function') labPick(p);
  if (M.phase === 'pen') { if (M.pen && M.pen.human) penStop(); else gkStop(); return; }
  if (M.picking && (canShoot() || oppWin())) {
    const team = ['congelar', 'soborno'].includes(M.picking.k) ? 1 - M.picking.side : M.picking.side, anyTeam = M.picking.k === 'corona';
    let tg = null, td = 1e9;
    M.w.bodies.forEach(b => { if (b.kind === 'cap' && (anyTeam || b.team === team)) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < b.r + 20 && d < td) { td = d; tg = b; } } });
    if (tg) applyPick(tg); else { M.picking = null; toast('Carta cancelada (no se ha gastado)'); hudCap(); }
    return;
  }
  if (!canShoot()) return;
  let best = null, bd = 1e9;
  M.w.bodies.forEach(b => { if (b.kind === 'cap' && b.team === M.turn) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < b.r + 16 && d < bd) { bd = d; best = b; } } });
  if (best) { M.sel = best.id; M.drag = { id: best.id, p0: { x: p.x, y: p.y } }; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); updateAim(); hudCap(); sfx.click(); }
}
function onMove(e) {
  if (!M || G.screen !== 'match') return;
  if (e.pointerType === 'touch' && TP.has(e.pointerId)) {
    TP.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (TP.size >= 2) { pinchMove(); return; }
  }
  capTip(e);
  const p = pointerField(e); M.ptr = p;
  if (M.drag) updateAim();
  else {
    let h = null;
    if (canShoot()) M.w.bodies.forEach(b => { if (b.kind === 'cap' && b.team === M.turn && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 12) h = b.id; });
    M.hover = h; cv.style.cursor = h != null ? 'grab' : (M.phase === 'pen' ? 'pointer' : 'default');
  }
}
function onUp(e) {
  if (e && e.pointerType === 'touch') { TP.delete(e.pointerId); if (TP.size < 2) pinch = null; if (e.type === 'pointercancel' && M && M.drag) cancelAim(); }
  hideTip();
  if (!M || !M.drag) return;
  const d = M.drag; M.drag = null; M.aim = null;
  const moved = !d.p0 || Math.hypot(M.ptr.x - d.p0.x, M.ptr.y - d.p0.y) >= 10;   // un simple clic (sin arrastrar) solo selecciona, nunca tira
  if (moved && d.len >= 18 && d.ang != null && canShoot()) shoot(d.id, d.ang, d.power);
}
/* gasta el tiro: los tiros extra (M.free) no restan del cupo; los normales sí y pasan la rotación */
function consumeShot(team) {
  M.lastFree = M.free;
  if (M.free) M.free = false; else { M.shots[team]--; M.rot = 1 - team; }
}
function invertIfNeeded(team, ang) {
  if (M.invert[team] > 0) { M.invert[team]--; fx.pops.push({ x: FIELD.W / 2, y: FIELD.H / 2 - 120, txt: '🔄 ¡CONTROLES INVERTIDOS!', t: 0, col: '#d66bff', big: 1 }); return ang + Math.PI; }
  return ang;
}
function shoot(id, ang, power) {
  const c = capById(id);
  if (M.lab && typeof labSnap === 'function') { labSnap(); M.labCapt = false; }   // laboratorio: foto antes del tiro para poder repetirlo
  ang = invertIfNeeded(M.turn, ang);
  launch(c, ang, power);
  applyBoost(c);
  startPlay(M.turn, id);
  consumeShot(M.turn);
  M.phase = 'move'; M.acc = 0; M.sel = id; M.moveT = 0; G.fromRoul = false;
  sfx.shot(power);
  M.stillT = 0;
  hudScore(); hudCap();
}

/* IA */
function aiUseCard(team) {
  const hand = M.hands[team]; if (!hand || !hand.length || Math.random() > 0.32 || (M.cardBan && M.cardBan[team] > 0)) return false;
  const trailing = M.score[team] < M.score[1 - team];
  const opts = hand.map((c, i) => i).filter(i => !hand[i].used && !hand[i].gone && (hand[i].k !== 'ginv' || trailing) && hand[i].k !== 'lesion');   // todos los comodines, el gol invertido solo si va perdiendo
  if (!opts.length) return false;
  const i = pick(opts), k = hand[i].k, w = M.w;
  let tg = null;
  if (PICKS.includes(k)) {
    const rival = k === 'congelar' || k === 'soborno';
    const caps = w.bodies.filter(b => b.kind === 'cap' && b.team === (rival ? 1 - team : team) && !(k === 'soborno' && b.role === 'POR'));
    if (!caps.length) return false;
    const bl = w.balls[0];
    tg = caps.reduce((a, b) => Math.hypot(a.x - bl.x, a.y - bl.y) < Math.hypot(b.x - bl.x, b.y - bl.y) ? a : b);
    if (k === 'congelar' && hierroOn(M.w, tg)) return false;
  }
  runCard(team, i, tg);
  return true;
}
/* red de seguridad: si la CPU se queda sin jugar (error o turno perdido), tira sola a los pocos segundos */
function aiFallback(team) {
  const w = M.w, mine = w.bodies.filter(b => b.kind === 'cap' && b.team === team);
  if (!mine.length) { M.phase = 'aim'; nextTurn && nextTurn(); return; }
  const bl = w.balls[0];
  const c = mine.reduce((a, b) => Math.hypot(a.x - bl.x, a.y - bl.y) < Math.hypot(b.x - bl.x, b.y - bl.y) ? a : b);
  const ang = Math.atan2(bl.y - c.y, bl.x - c.x), power = 0.85;
  M.sel = c.id; M.fake = null;
  launch(c, ang, power); applyBoost(c); startPlay(team, c.id); consumeShot(team);
  M.phase = 'move'; M.acc = 0; M.stillT = 0; M.moveT = 0; sfx.shot(power); hudScore();
}
let aiWd = { key: '', t: 0, n: 0 };
function penWatchdog(dt) {
  const P = M && M.pen; if (!P || P.hold || document.querySelector('#pause')) { penWd = { t: 0, k: '' }; return; }
  const k = P.state + '|' + Math.round((P.state === 'meter' ? P.t : P.tt) * 20) + '|' + (P.shDone ? 1 : 0) + '|' + (P.gkStopped ? 1 : 0);
  if (k !== penWd.k) { penWd = { t: 0, k }; return; }
  penWd.t += dt;
  if (penWd.t > 6 && P.state === 'meter' && !(P.shDone && !P.gkStopped && !P.human && P.gkHuman)) { console.warn('Penalti atascado: se lanza solo'); penWd = { t: 0, k: '' }; P.shDone = false; finishPenaltyAim(); }
}
let penWd = { t: 0, k: '' };
function aiWatchdog(dt) {
  if (M && M.waitWin) { aiWd.key = ''; return; }
  if (!M || M.over || G.screen !== 'match' || M.pen || M.annP || document.querySelector('#pause') || M.phase === 'goal' || M.phase === 'move' || M.phase === 'replay') { aiWd.key = ''; return; }
  const cpu = (M.phase === 'ai') || (M.phase === 'aim' && !M.human[M.turn]);
  if (!cpu) { aiWd.key = ''; aiWd.n = 0; return; }
  const key = M.seq + '|' + M.phase + '|' + M.turn + '|' + M.shots[0] + M.shots[1];
  if (key !== aiWd.key) { aiWd.key = key; aiWd.t = 0; return; }
  aiWd.t += dt;
  if (aiWd.t < 4) return;
  aiWd.t = 0; aiWd.n++;
  console.warn('CPU atascada: reintento ' + aiWd.n);
  try { M.fake = null; M.keepTurn = false; M.seq++; if (aiWd.n >= 2) { aiWd.n = 0; aiFallback(M.turn); } else aiTurn(); } catch (e) { console.error(e); try { aiFallback(M.turn); } catch (e2) { console.error(e2); } }
}
async function aiTurn() {
  try { await aiTurn0(); } catch (e) { console.error('aiTurn', e); }
}
async function aiTurn0() {
  M.phase = 'ai'; hudScore();
  const mySeq = ++M.seq, team = M.turn;
  await sleep(650);
  if (!M || M.seq !== mySeq || G.screen !== 'match') return;
  if (hasPerk('reflejos') && !M.S.j2 && M.human[0] && M.hands[0].some(c => !c.used && !c.gone)) {   // ventana para usar comodines en el turno del rival
    M.waitWin = true; toast('⚡ Reflejos: puedes usar comodines antes de que tire el rival'); await sleep(2500);
    for (let n = 0; M && M.picking && n < 80; n++) await sleep(100);
    if (M) M.waitWin = false;
    if (!M || M.seq !== mySeq || G.screen !== 'match') { if (M) M.waitWin = false; return; }
  }
  if (!M.free && aiUseCard(team)) { if (M.annP) { M.phase = 'ai'; await M.annP; } if (!M || M.seq !== mySeq || G.screen !== 'match') return; if (M.pen || M.keepTurn || M.phase === 'goal') return; M.phase = 'ai'; await sleep(350); if (!M || M.seq !== mySeq || G.screen !== 'match') return; }
  const ch = aiChoose(M.w, team, (M.round || 0) + (M.S.tierR || 0));
  ch.ang = invertIfNeeded(team, ch.ang);
  if (M.invis && M.invis[1 - team] > 0) ch.ang += gauss() * 0.35;
  if (M.blind && M.blind[team] > 0) ch.ang += gauss() * 0.4;   // ceguera: tira sin ver la flecha   // no ve al rival: tira a ciegas
  const c = capById(ch.capId);
  M.sel = c.id;
  M.fake = { id: c.id, ang: ch.ang, power: ch.power };
  hudCap();
  await sleep(520);
  if (!M || M.seq !== mySeq || G.screen !== 'match') return;
  M.fake = null;
  launch(c, ch.ang, ch.power);
  applyBoost(c);
  startPlay(team, c.id);
  consumeShot(team);
  M.phase = 'move'; M.acc = 0; M.stillT = 0; M.moveT = 0;
  sfx.shot(ch.power);
  hudScore();
}

function tickBuffs() {
  M.buffs.forEach(bf => { bf.left--; if (bf.left <= 0) { bf.undo(); fx.pops.push({ x: FIELD.W / 2, y: 80, txt: bf.name + ' terminó', t: 0, col: '#cfd8e6', big: 0.8 }); } });
  M.buffs = M.buffs.filter(bf => bf.left > 0);
}
/* fin de una jugada: limpieza, falta / penalti y siguiente turno */
/* sube/baja una característica en mitad del partido (mentalidad) */
function bumpStat(b, k, d) {
  const cur = (b.actB && b.actB[k]) || 0;
  const ab = b.actB || {}, sumP = Object.keys(ab).reduce((a, x) => a + Math.max(0, ab[x]), 0), sumN = Object.keys(ab).reduce((a, x) => a + Math.min(0, ab[x]), 0);
  if (d < 0) d = Math.max(d, -1 - cur, -1 - sumN); else d = Math.max(0, Math.min(d, 1 - cur, 1 - sumP));   // en total, las mejoras (o bajadas) de un jugador no pasan de 1 punto   // la mentalidad mueve cada característica entre −1 y +1; si sube solo sube, si baja solo baja
  if (!d) return 0;
  const n = Math.max(1, Math.min(12, b.st[k] + d)), real = Math.round((n - b.st[k]) * 10) / 10; if (!real) return 0;
  b.st[k] = n;
  if (k === 'POT') b.vmax = Math.min(1500, b.vmax * potV(b.st.POT) / potV(b.st.POT - real));
  if (k === 'PES') { b.m += massFor(b.st.PES) - massFor(b.st.PES - real); b.dec += 9 * real; b.r *= 1 + 0.012 * real; }
  if (k === 'PRE') b.dev = devFor(b.st.PRE);
  b.actB = b.actB || {}; b.actB[k] = Math.round(((b.actB[k] || 0) + real) * 10) / 10;
  b.irid = Object.keys(b.actB).some(x => b.actB[x] > 0);
  return real;
}
const deltaTxt = o => Object.keys(o).map(k => k + ' ' + (o[k] > 0 ? '+' : '−') + Math.abs(o[k]).toFixed(1)).join(' · ');
function mentalUp(bodies, amount, why) {
  bodies.forEach(b => {
    const ch = {};
    ['POT', 'PES', 'PRE', 'VIS'].forEach(k => { if (Math.random() < 0.6) { const d = Math.round((0.1 + Math.random() * amount) * 10) / 10, r = bumpStat(b, k, d); if (r > 0) ch[k] = r; } });
    if (Object.keys(ch).length) { fx.pops.push({ x: b.x, y: b.y - 40, txt: '😎 MENTALIDAD ALTA', t: 0, col: '#9dff8a', big: 0.9 }); logEv('📈', `${flagSVG(M.codes[b.team], 'sm')} <b>${b.name}</b> sube: ${deltaTxt(ch)}`); }
  });
  hudCap();
}
function mentalDrop(bodies, why) {
  if (why) logEv('😞', why);
  bodies.forEach(b => {
    const ch = {};
    ['POT', 'PES', 'PRE', 'VIS'].forEach(k => { if (Math.random() < 0.7) { const d = -Math.round((0.1 + Math.random() * 0.9) * 10) / 10, r = bumpStat(b, k, d); if (r) ch[k] = r; } });
    if (Object.keys(ch).length) { fx.pops.push({ x: b.x, y: b.y - 40, txt: '😞 MENTALIDAD BAJA', t: 0, col: '#ff8a8a', big: 0.9 }); logEv('📉', `${flagSVG(M.codes[b.team], 'sm')} <b>${b.name}</b> baja: ${deltaTxt(ch)}`); }
  });
  hudCap();
}
function returnSent(x) {
  const b = x.b, w = M.w; b.vx = b.vy = 0; b.x = b.hx; b.y = b.hy;
  for (let k = 0; k < 40; k++) {
    if (!w.bodies.some(o => o !== b && Math.hypot(o.x - b.x, o.y - b.y) < o.r + b.r + 2)) break;
    const a = k * 2.4, d = 14 + k * 5; b.x = clamp(b.hx + Math.cos(a) * d, b.r + 6, FIELD.W - b.r - 6); b.y = clamp(b.hy + Math.sin(a) * d, b.r + 6, FIELD.H - b.r - 6);
  }
  w.bodies.push(b); fx.pops.push({ x: b.x, y: b.y - 40, txt: '¡VUELVE!', t: 0, col: '#b8ff6a', big: 1 }); fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1.2 });
  logEv('✅', b.name + ' vuelve al campo');
}
/* ---- resumen del partido ---- */
function matchMin() {
  if (!M) return '0';
  if (M.sudden) return '90+' + M.sudden;
  const tot = M.maxTurns[0] + M.maxTurns[1], left = M.shots[0] + M.shots[1];
  return String(Math.max(1, Math.min(90, Math.round(90 * (tot - left) / tot))));
}
const tn = c => flagSVG(c, 'sm') + ' ' + COUNTRIES[c].n;
function logEv(icon, txt) {
  if (!M) return;
  (M.log = M.log || []).push({ m: matchMin(), icon, txt }); hudLog();
}
function hudLog() {
  const el = $('#hud-log'); if (!el || !M) return;
  const L = M.log || [];
  el.innerHTML = '<div class="lg-h">📋 RESUMEN</div><div class="lg-list">' + (L.length ? L.map(e => `<div class="lg-r"><b>${e.m}'</b><span>${e.icon} ${e.txt}</span></div>`).join('') : '<div class="lg-r mut">Aún no ha pasado nada…</div>') + '</div>';
  const ls = el.querySelector('.lg-list'); if (ls) ls.scrollTop = ls.scrollHeight;
}
// Multiportero: el jugador (no portero) más cercana a la portería propia crece un 30%; se recalcula cada turno
function multiGK() {
  if (!M || !M.w) return; M.mg = M.mg || [null, null];
  for (const s of [0, 1]) {
    if (M.mg[s]) { const o = M.mg[s]; o.b.r = o.r0; o.b.m = o.m0; M.mg[s] = null; }
    if (!pk(s, 'multiporteros')) continue;
    const gx = physSide(M.w, s) === 0 ? 0 : FIELD.W;
    let best = null; M.w.bodies.forEach(b => { if (b.kind === 'cap' && b.team === s && b.role !== 'POR' && !b.frozen && (!best || Math.abs(b.x - gx) < Math.abs(best.x - gx))) best = b; });
    if (best) { M.mg[s] = { b: best, r0: best.r, m0: best.m }; best.r *= 1.3; best.m *= 1.3; fx.pops.push({ x: best.x, y: best.y - 44, txt: '🧤 MULTIPORTERO', t: 0, col: '#8dd7ff', big: 0.9 }); }
  }
}
/* items que actúan con el paso de los turnos: Corazón (cada turno) y Motivado (segunda mitad); Salud de hierro de 1 copia caduca a mitad de partido */
function itemsTurnEnd(pt) {
  if (!M || M.over || M.so || M.lab) return;
  const caps = M.w.bodies.filter(b => b.kind === 'cap');
  if (pt != null) caps.filter(b => b.team === pt).forEach(b => {
    const n = abCount(b.abs, 'corazon'); if (!n) return;
    const ks = BUMP_KEYS.filter(k => b.st[k] < 12); if (!ks.length) return;
    const k = pick(ks), r = bumpCap(b, k, n, '💙'); if (r) { fx.pops.push({ x: b.x, y: b.y - 44, txt: '💙 ' + STATS[k].icon + ' +' + r, t: 0, col: '#6ab7ff', big: 1 }); }
  });
  if (!M.half2 && M.shots[0] + M.shots[1] <= (M.maxTurns[0] + M.maxTurns[1]) / 2) {
    M.half2 = true; M.w.half2 = true;
    caps.forEach(b => {
      const n = abCount(b.abs, 'motiv'); if (n) { BUMP_KEYS.forEach(k => bumpCap(b, k, n, '✨')); fx.pops.push({ x: b.x, y: b.y - 44, txt: '✨ MOTIVADO +' + n, t: 0, col: '#fff3a0', big: 1.2 }); logEv('✨', `<b>${b.name}</b> sale motivado en la segunda mitad: todas sus estadísticas +${n}`); }
      if (abCount(b.abs, 'hierro') === 1 && !caps.some(c => c.team === b.team && abCount(c.abs, 'hierro') >= 3)) fx.pops.push({ x: b.x, y: b.y - 44, txt: '🩹 Fin de la protección', t: 0, col: '#9dff8a', big: 0.9 });
    });
  }
  hudCap();
}
function nextTurn() {
  M.fire = false;
  if (M.boostCap) { M.boostCap.m = M.boostCap.m0; M.boostCap = null; }
  if (M.w.noGoal) { M.ngLeft = (M.ngLeft || 1) - 1; if (M.ngLeft <= 0) M.w.noGoal = false; }
  if (M.openSaved) { const sv = M.openSaved; M.openSaved = null; M.w.lock[sv.team] = sv.lock[sv.team]; M.w.lock[1 - sv.team] = sv.lock[1 - sv.team]; }
  if (M.keepTurn) { gkReturn(0); gkReturn(1); M.keepTurn = false; M.moveT = 0; M.sel = null; M.phase = 'aim'; hudScore(); hudCap(); hudHand(); if (!M.human[M.turn]) aiTurn(); return; }
  if (M.windOn) { M.windOn = false; M.w.tilt = M.windPrev || null; M.windPrev = null; }
  if (M.w.field === 'tilt') newTilt(M.w);
  if (M.w.kz) {
    M.w.kz.forEach(p => { if (p.field === 'tilt') newTilt(p); });
  }
  unbribe();
  const pt = M.playTeam; M.playTeam = null;
  itemsTurnEnd(pt);
  setTimeout(() => { if (M && M.phase === 'aim') multiGK(); }, 0);
  if (pt != null && M.pase && M.pase[pt] > 0 && M.pase[pt] < 900) M.pase[pt]--;
  if (pt != null && M.marr && M.marr[pt] > 0 && M.marr[pt] < 900) M.marr[pt]--;
  if (pt != null && M.fstyle && M.fstyle[pt] > 0 && M.fstyle[pt] < 900) M.fstyle[pt]--;
  if (pt != null && M.rkick && M.rkick[pt] > 0) M.rkick[pt]--;
  if (pt != null && M.invis && M.invis[1 - pt] > 0) M.invis[1 - pt]--;
  if (pt != null && M.blind && M.blind[pt] > 0) M.blind[pt]--;
  hudHand();
  if (pt != null && M.cardBan && M.cardBan[pt] > 0) { M.cardBan[pt]--; if (!M.cardBan[pt]) { logEv('🔌', 'Vuelven los comodines de ' + tn(M.codes[pt])); hudHand(); } }
  for (const s of [0, 1]) if (pt === 1 - s && M.lockPlays[s] > 0) { M.lockPlays[s]--; if (!M.lockPlays[s]) M.w.lock[s] = false; }
  tickBuffs();
  if (M.sent && M.sent.length) M.sent = M.sent.filter(x => { if (pt !== x.team) return true; if (--x.left > 0) return true; returnSent(x); return false; });
  if (pt === 1) M.w.bodies.forEach(b => { if (b.frozen) { b.frozen--; if (!b.frozen) { b.m = b.mOrig; fx.pops.push({ x: b.x, y: b.y - 40, txt: '¡DESCONGELADA!', t: 0, col: '#ffd166', big: 0.9 }); } } });
  if (pt === 0) M.w.bodies.forEach(b => { if (b.frozen && b.team === 0) { b.frozen--; if (!b.frozen) { b.m = b.mOrig; } } });
  M.moveT = 0; M.sel = null;
  gkReturn(0); gkReturn(1);
  // penalti: se tocó a un rival dentro de su área y el balón no se movió (ningún jugador de ningún equipo lo tocó)
  // además de que nadie tocara el balón, ninguno se ha podido mover de su sitio (imán, viento, bumpers...)
  const ballMoved = M.ballStart && M.w.balls.some((q, i) => M.ballStart[i] && Math.hypot(q.x - M.ballStart[i][0], q.y - M.ballStart[i][1]) > 3);
  if (!M.penAward && M.penCand && !M.touched && !ballMoved && !M.over) { const pc = M.penCand; M.penWhy = '🚩 Falta dentro del área: se tocó a un jugador rival y nadie tocó el balón'; logEv('🥅', M.penWhy); M.penAward = { team: pc.team, victim: pc.victim }; (M.fouls = M.fouls || [0, 0])[1 - pc.team]++; fx.pops.push({ x: pc.x, y: pc.y - 40, txt: '¡PENALTI!', t: 0, col: '#ff4d6d', big: 1.4 }); sfx.whistle(); }
  M.penCand = null;
  if (M.penAward && !M.over) {
    const pa = M.penAward; M.penAward = null;
    if (pt != null) { M.extra[pt] = 0; M.immune[pt] = false; }
    M.penRec = M.rec && M.rec.fr.length > 12 && !M.so ? M.rec.fr : null;   // la repetición de la falta se ve desde el aviso del penalti
    return startPenalty(pa.team, pa.victim);
  }
  // falta: la jugada no tocó el balón → el rival gana 1 tiro extra gratis (2 tiros seguidos en total)
  if (pt != null && (!M.touched || M.theater) && !M.immune[pt] && !M.over && (M.shots[1 - pt] > 0 || M.lastFree)) {   // también hay falta si fallas durante un tiro extra, aunque al rival ya no le queden tiros normales
    if (M.pardon[pt] > 0) { M.pardon[pt]--; banner('😇 PERDÓN ARBITRAL', 'Sin falta esta vez', 1500, 'good'); }
    else {
      const opp = 1 - pt;
      M.extra[opp]++; M.extra[pt] = 0;
      (M.fouls = M.fouls || [0, 0])[pt]++;
      logEv('🚩', 'Falta de ' + tn(M.codes[pt])); const why = M.theater ? '🎭 El rival se tira al suelo (teatrero)' : M.hitRival ? 'Tocó a un rival sin tocar el balón' : 'Ningún jugador tocó el balón'; logEv('🚩', why); banner('¡FALTA! · ' + why, '2 tiros seguidos para ' + tn(M.codes[opp]), 2600, 'bad'); sfx.whistle(); M.foulT = performance.now();
    }
  }
  if (pt != null && !M.extra[pt]) M.immune[pt] = false;
  if (M.w.jura && pt != null && !M.over && !M.so && !M.pen) { M.stompN = (M.stompN || 0) + 1; if (M.stompN >= 2 && !M.stomp) { M.stompN = 0; planStomp(); } }
  if (M.w.field === 'playa' && pt != null && !M.over && !M.so && !M.pen) {   // playa: cada 3 jugadas una gaviota se lleva el balón al centro
    M.gullN = (M.gullN || 0) + 1;
    if (M.gullN >= 3) { M.gullN = 0; return startGull(() => { if (M) chooseNext(pt); }); }
  }
  chooseNext(pt);
}
/* gaviota de la playa */
function startGull(cb) {
  const w = M.w, cxm = FIELD.W / 2, cym = FIELD.H / 2;
  const items = w.balls.map((b, i) => ({ b, x0: b.x, y0: b.y, tx: cxm + (b.ox || 0) + (b.child ? ((i % 4) - 1.5) * 16 : 0), ty: cym + (b.oy || 0) + (b.child ? (Math.floor(i / 4) - 1) * 16 : 0) }));
  const lead = items[0];
  M.gull = { t: 0, items, cb, sx: lead.x0 + (lead.x0 < cxm ? -600 : 600), sy: -80, x: 0, y: 0 };
  M.phase = 'gull'; hudScore(); sfx.whistle && sfx.whistle();
  fx.pops.push({ x: lead.x0, y: Math.max(40, lead.y0 - 60), txt: '🐦 ¡LA GAVIOTA SE LLEVA EL BALÓN!', t: 0, col: '#ffffff', big: 1.2 });
  logEv('🐦', 'Una gaviota se lleva el balón al centro');
}
function updateGull(dt) {
  const G2 = M.gull; if (!G2) return; G2.t += dt;
  const t = G2.t, lead = G2.items[0], ease = k => k * k * (3 - 2 * k), lerp = (a, b, k) => a + (b - a) * k;
  if (t < 0.7) { const k = ease(t / 0.7); G2.x = lerp(G2.sx, lead.x0, k); G2.y = lerp(G2.sy, lead.y0 - 30, k); }
  else if (t < 1.7) { const k = ease((t - 0.7) / 1.0); G2.x = lerp(lead.x0, lead.tx, k); G2.y = lerp(lead.y0 - 30, lead.ty - 30, k) - Math.sin(k * Math.PI) * 30;
    G2.items.forEach(it => { it.b.x = lerp(it.x0, it.tx, k); it.b.y = lerp(it.y0, it.ty, k); it.b.airH = 26 + Math.sin(k * Math.PI) * 18; it.b.vx = it.b.vy = 0; }); }
  else if (t < 2.3) { const k = ease((t - 1.7) / 0.6); G2.x = lerp(lead.tx, G2.sx, k); G2.y = lerp(lead.ty - 30, -120, k); G2.items.forEach(it => { it.b.x = it.tx; it.b.y = it.ty; it.b.airH = (1 - k) * 26; if (k > 0.99) it.b.airH = null; }); }
  else { G2.items.forEach(it => { it.b.x = it.tx; it.b.y = it.ty; it.b.airH = null; it.b.vx = it.b.vy = 0; it.b.chg = 0; }); const cb = G2.cb; M.gull = null; cb && cb(); }
}
function drawGull() {
  const G2 = M && M.gull; if (!G2) return;
  const t = performance.now() / 1000;
  // rumbo: hacia donde se mueve (suavizado)
  if (G2.px != null && Math.hypot(G2.x - G2.px, G2.y - G2.py) > 0.6) { const tg = Math.atan2(G2.y - G2.py, G2.x - G2.px); let d = tg - (G2.ang || 0); d = Math.atan2(Math.sin(d), Math.cos(d)); G2.ang = (G2.ang || 0) + d * 0.2; }
  else if (G2.ang == null) G2.ang = G2.sx < FIELD.W / 2 ? 0.4 : Math.PI - 0.4;
  G2.px = G2.x; G2.py = G2.y;
  const f = 0.55 + 0.45 * Math.abs(Math.sin(t * 9)), gy = G2.items[0].b.y;
  // sombra en el suelo
  cx.fillStyle = 'rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(G2.x + 10, gy + 14, 30 * f + 8, 9, 0, 0, Math.PI * 2); cx.fill();
  cx.save(); cx.translate(G2.x, G2.y); cx.rotate(G2.ang); cx.scale(1.9, 1.9);
  cx.lineJoin = 'round';
  // patitas colgando (sujetan el balón)
  cx.strokeStyle = '#f29e2e'; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(3, -2.5); cx.lineTo(-1, -5); cx.moveTo(3, 2.5); cx.lineTo(-1, 5); cx.stroke();
  // cola
  cx.fillStyle = '#f4f7fb'; cx.strokeStyle = '#aab6c6'; cx.lineWidth = 0.9;
  cx.beginPath(); cx.moveTo(-12, -2.5); cx.lineTo(-25, -5.5); cx.lineTo(-27, 0); cx.lineTo(-25, 5.5); cx.lineTo(-12, 2.5); cx.closePath(); cx.fill(); cx.stroke();
  // alas (mitad, espejada): gris por encima, puntas negras, plumas al borde
  [-1, 1].forEach(sd => {
    cx.save(); cx.scale(1, sd);
    const wing = () => { cx.beginPath(); cx.moveTo(6, 2); cx.quadraticCurveTo(5, 14 * f, -1 - (1 - f) * 7, 36 * f); cx.lineTo(-8 - (1 - f) * 7, 33 * f); cx.lineTo(-7, 26 * f); cx.lineTo(-14, 25 * f); cx.lineTo(-10, 17 * f); cx.lineTo(-17, 15 * f); cx.lineTo(-11, 8 * f); cx.quadraticCurveTo(-12, 4, -9, 2); cx.closePath(); };
    const g = cx.createLinearGradient(0, 0, 0, 36 * f); g.addColorStop(0, '#f6f9fc'); g.addColorStop(1, '#bfcad8');
    cx.fillStyle = g; wing(); cx.fill();
    cx.save(); wing(); cx.clip(); cx.fillStyle = '#2b3440'; cx.fillRect(-30, 27 * f, 50, 30); cx.restore();
    cx.strokeStyle = '#8f9db0'; cx.lineWidth = 0.9; wing(); cx.stroke();
    cx.restore();
  });
  // cuerpo
  const bg = cx.createLinearGradient(0, -6, 0, 6); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#d9e1ec');
  cx.fillStyle = bg; cx.strokeStyle = '#aab6c6'; cx.lineWidth = 0.9;
  cx.beginPath(); cx.ellipse(0, 0, 15, 6.2, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
  // cabeza
  cx.beginPath(); cx.arc(15, 0, 4.6, 0, Math.PI * 2); cx.fill(); cx.stroke();
  // pico amarillo con puntito rojo
  cx.fillStyle = '#ffc533'; cx.beginPath(); cx.moveTo(18.6, -1.8); cx.lineTo(26, -0.4); cx.lineTo(26.6, 1.1); cx.lineTo(18.6, 2); cx.closePath(); cx.fill();
  cx.fillStyle = '#e63946'; cx.beginPath(); cx.arc(24.3, 0.9, 0.9, 0, Math.PI * 2); cx.fill();
  // ojos
  cx.fillStyle = '#111'; cx.beginPath(); cx.arc(16.2, -2.6, 0.95, 0, Math.PI * 2); cx.arc(16.2, 2.6, 0.95, 0, Math.PI * 2); cx.fill();
  cx.restore();
}
function chooseNext(pt) {
  let t = null, free = false;
  if (pt != null && M.extra[pt] > 0) { t = pt; free = true; M.extra[pt]--; }
  if (t == null) {
    if (M.shots[0] + M.shots[1] <= 0) {
      if (M.extra[0] + M.extra[1] > 0) { t = M.extra[M.rot] > 0 ? M.rot : 1 - M.rot; free = true; M.extra[t]--; }
      else {
        if (M.score[0] !== M.score[1] || G.league || inGroup()) return endMatch();
        if (M.sudden >= 3) return startShootoutHere();
        M.sudden++; M.shots = [1, 1]; M.extra = [0, 0];
        banner('¡MUERTE SÚBITA!', 'El próximo gol gana', 1700); sfx.whistle();
      }
    }
    if (t == null) {
      t = M.rot;
      if (M.skip[t] > 0 && M.shots[t] > 0 && M.shots[1 - t] > 0) { M.skip[t]--; M.shots[t]--; M.rot = 1 - t; t = 1 - t; banner('🔔 SILBATO', 'Turno perdido', 1200); }
      if (!M.shots[t]) t = 1 - t;
    }
  }
  M.turn = t; M.free = free; M.phase = 'aim';
  hudScore(); hudCap(); hudHand();
  if (!M.human[t]) aiTurn();
  else if (!M.foulT || performance.now() - M.foulT > 2400) banner(free ? '✌️ TIRO EXTRA' : (M.S.j2 ? 'TURNO DE J' + (t + 1) : 'TU TURNO'), '', 700);
}

/* ---------- penaltis ---------- */
const penPos = (t, spd) => 1 - Math.abs(((t * spd) % 2) - 1);
const penGreen = st => clamp(0.04 + 0.034 * st.PRE, 0.1, 0.42);
function startPenalty(team, takerId, opts = {}) {
  const w = M.w, W = FIELD.W, H = FIELD.H, def = 1 - team;
  const taker = capById(takerId);
  const gk = w.bodies.find(b => b.kind === 'cap' && b.team === def && b.role === 'POR') || w.bodies.find(b => b.kind === 'cap' && b.team === def);
  const ball = w.balls[0], right = physSide(w, team) === 0, spotX = right ? W - 120 : 120;
  w.bodies.forEach(b => { b.vx = b.vy = 0; });
  ball.x = spotX; ball.y = H / 2; ball.chg = 0;
  taker.x = spotX + (right ? -1 : 1) * (taker.r + ball.r + 14); taker.y = H / 2;
  gk.x = right ? W - gk.r - 4 : gk.r + 4; gk.y = H / 2;
  const slots = [[770, 160], [770, 480], [745, 320], [860, 62], [940, 62], [860, 578], [940, 578], [690, 235], [690, 405], [800, 62], [800, 578], [640, 320], [640, 150], [640, 490]];
  let si = 0;
  const akGk = w.bodies.find(b => b.kind === 'cap' && b.team === team && b.role === 'POR' && b !== taker);
  w.bodies.forEach(b => {
    if (b === taker || b === gk || b === ball) return;
    if (b === akGk) { b.x = b.hx; b.y = b.hy; b.vx = b.vy = 0; return; }
    const sl = slots[si++ % slots.length]; b.x = right ? sl[0] : W - sl[0]; b.y = sl[1];
    if (b.kind === 'ball') { b.x = W / 2 + (si % 3) * 30; b.y = H / 2 + ((si % 2) ? 40 : -40); }
    b.vx = b.vy = 0;
  });
  M.rec = null;
  if (!opts.shoot) { if (M.shots[team] > 0) M.shots[team]--; M.rot = 1 - team; }
  const gw = Math.min(0.9, penGreen(taker.st) * (opts.gmul || 1)), gc = gw / 2 + 0.06 + Math.random() * (1 - gw - 0.12), spd = 2.7 + Math.random() * 0.6;
  M.pen = { team, taker: takerId, ball: ball.id, gk: gk.id, state: 'meter', t: 0, p: 0, green: gw, gc, spd, human: M.human[team], gkHuman: M.human[def] && !M.human[team], gp: 0.5, gt: Math.random() * 2, gspd: 2.8 + Math.random() * 0.7, gkStopped: false, shDone: false, doneT: 0, so: !!opts.shoot, ok: false, tt: 0, stopAt: null, aiP: null };
  if (!M.human[team]) {
    const pSucc = clamp(0.35 + gw * 0.7 + ((M.round || 0) + (M.S.tierR || 0)) * 0.03, 0.3, 0.9);
    const tgt = Math.random() < pSucc ? clamp(gc + (Math.random() - 0.5) * gw * 0.8, 0.02, 0.98) : (Math.random() < 0.5 ? Math.max(0.02, gc - gw / 2 - 0.08 - Math.random() * 0.2) : Math.min(0.98, gc + gw / 2 + 0.08 + Math.random() * 0.2));
    let tt = tgt / spd; while (tt < 0.8) tt += 2 / spd;
    M.pen.stopAt = tt;
  }
  M.phase = 'pen'; M.turn = team; M.sel = takerId; M.touched = true;
  fx.rings.push({ x: ball.x, y: ball.y, t: 0, v: 1.6 });
  if (!M.so) penAnnounce(team, taker, !!opts.shoot); else
  banner(opts.shoot ? '🥅 PENALTI' : '¡PENALTI!', taker.name + ' (' + tn(M.codes[team]) + ')' + (M.human[team] ? ' · ¡PARA LA FLECHA EN VERDE!' : ''), 2000, M.human[team] ? 'good' : 'bad');
  M.penWhy = null; sfx.whistle(); hudScore(); hudCap(); hudHand();
}
function gkStop() {
  const P = M.pen; if (!P || P.state !== 'meter' || !P.gkHuman || P.gkStopped) return;
  P.gkStopped = true; sfx.click();
}
function penStop() {
  const P = M.pen; if (!P || P.state !== 'meter') return;
  P.p = penPos(P.t, P.spd);
  finishPenaltyAim();
}
function finishPenaltyAim() {
  const P = M.pen, w = M.w, ball = capById(P.ball) || w.balls[0], gk = capById(P.gk);
  P.state = 'shot'; P.tt = 0; P.ok = Math.abs(P.p - P.gc) <= P.green / 2;
  if (P.ok && P.gkHuman && Math.abs(P.gp - P.gc) < Math.abs(P.p - P.gc)) P.ok = false;   // el portero está más cerca del centro: la para
  if (pk(P.team, 'sangre')) P.ok = true;   // Sangre fría: todos los penaltis entran
  const right = physSide(w, P.team) === 0, geo = w.geo, half = right ? (geo.rb - geo.rt) / 2 : (geo.lb - geo.lt) / 2;
  P.from = { x: ball.x, y: ball.y }; P.gk0 = { x: gk.x, y: gk.y };
  if (P.ok) { const off = clamp((P.p - P.gc) / (P.green / 2), -0.9, 0.9); P.to = { x: right ? FIELD.W + 28 : -28, y: FIELD.H / 2 + off * half * 0.78 }; P.gkTo = { x: gk.x, y: FIELD.H / 2 - off * half * 0.9 }; }
  else { const gy = FIELD.H / 2 + (Math.random() - 0.5) * 60; P.to = { x: gk.x + (right ? -gk.r : gk.r), y: gy }; P.gkTo = { x: gk.x, y: gy }; }
  sfx.shot(1);
}
function updatePen(dt) {
  const P = M.pen; if (!P) return;
  if (P.hold) {   // P.hold: esperando a que se pulse ACEPTAR en el aviso de penalti; si el aviso desaparece (o tarda demasiado), el penalti sigue solo
    P.holdT = (P.holdT || 0) + dt;
    if (!document.getElementById('cardann') || P.holdT > 12) P.hold = false; else return;
  }
  const ball = capById(P.ball) || M.w.balls[0], gk = capById(P.gk);
  if (P.state === 'meter') {
    if (!P.shDone) { P.t += dt; P.p = penPos(P.t, P.spd); }
    if (P.gkHuman) { P.gt += dt; if (!P.gkStopped) P.gp = penPos(P.gt, P.gspd); }
    if (P.stopAt != null && !P.shDone && P.t >= P.stopAt) { P.p = penPos(P.stopAt, P.spd); if (P.gkHuman) { P.shDone = true; P.doneT = 0; } else finishPenaltyAim(); }
    if (P.shDone) { P.doneT += dt; if (P.gkStopped || P.doneT > 1.1) finishPenaltyAim(); }
  } else if (P.state === 'shot') {
    P.tt += dt; const k = Math.min(1, P.tt / 0.42), e = k * k * (3 - 2 * k);
    ball.x = P.from.x + (P.to.x - P.from.x) * e; ball.y = P.from.y + (P.to.y - P.from.y) * e;
    gk.x = P.gk0.x + (P.gkTo.x - P.gk0.x) * Math.min(1, e * 1.4); gk.y = P.gk0.y + (P.gkTo.y - P.gk0.y) * Math.min(1, e * 1.4);
    if (Math.random() < 0.9) fx.trail.push({ x: ball.x, y: ball.y, t: 0, r: ball.r, c: P.ok ? '#ffd166' : '#fff', life: 0.3 });
    if (k >= 1) {
      const team = P.team; M.pen = null;
      if (P.ok) {
        if (M.so) return shootoutKick(team, true);
        M.w.goal = { scorer: team, x: P.to.x, y: P.to.y, lastX: physSide(M.w, team) === 0 ? FIELD.W - 120 : 120, lastTeam: team, chg: 0, bid: ball.id };
        M.play = { team, shooter: P.taker, relays: 0, touch: new Set([P.taker]), posts: 0, walls: 0 };
        M.phase = 'move'; goalScored();
      } else {
        fx.pops.push({ x: ball.x, y: ball.y - 40, txt: '🧤 ¡PARADA!', t: 0, col: '#35e0ff', big: 1.6 }); fx.shake = 0.35; sfx.post();
        banner('🧤 ¡PARADA!', '', 1200);
        if (M.so) return shootoutKick(team, false);
        const right = physSide(M.w, team) === 0, a = (right ? Math.PI : 0) + (Math.random() - 0.5) * 1.5;
        ball.vx = Math.cos(a) * 720; ball.vy = Math.sin(a) * 720;
        M.phase = 'move'; M.playTeam = null; M.touched = true; M.acc = 0; M.stillT = 0; M.moveT = 0; M.w.noGoal = false; M.play = null;
        hudScore();
      }
    }
  }
}
function drawPenMeter() {
  const P = M.pen; if (!P) return;
  const x0 = 400, x1 = 600, y = FIELD.H - 44, h = 20, W2 = x1 - x0;
  cx.save();
  cx.fillStyle = 'rgba(0,0,0,.55)'; cx.beginPath(); cx.roundRect(x0 - 14, y - 30, W2 + 28, h + 62 + (P.gkHuman ? 26 : 0), 12); cx.fill();
  const g = cx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#b3122a'); g.addColorStop(0.5, '#ff3b57'); g.addColorStop(1, '#b3122a');
  cx.fillStyle = g; cx.beginPath(); cx.roundRect(x0, y, W2, h, 10); cx.fill();
  const gx = x0 + (P.gc - P.green / 2) * W2;
  const gg = cx.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, '#9dff6a'); gg.addColorStop(1, '#1fb34a');
  cx.fillStyle = gg; cx.shadowColor = '#7dff5a'; cx.shadowBlur = 14; cx.beginPath(); cx.roundRect(gx, y, P.green * W2, h, 8); cx.fill(); cx.shadowBlur = 0;
  cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.beginPath(); cx.roundRect(x0, y, W2, h, 10); cx.stroke();
  const ax = x0 + P.p * W2;
  cx.fillStyle = '#fff'; cx.strokeStyle = '#111'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(ax, y - 3); cx.lineTo(ax - 9, y - 18); cx.lineTo(ax + 9, y - 18); cx.closePath(); cx.stroke(); cx.fill();
  cx.fillRect(ax - 2, y, 4, h);
  if (P.gkHuman) {
    const gx2 = x0 + P.gp * W2;
    cx.fillStyle = P.gkStopped ? '#35e0ff' : '#aef3ff'; cx.strokeStyle = '#111'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(gx2, y + h + 3); cx.lineTo(gx2 - 9, y + h + 18); cx.lineTo(gx2 + 9, y + h + 18); cx.closePath(); cx.stroke(); cx.fill();
    cx.fillRect(gx2 - 2, y, 4, h);
  }
  cx.font = '900 15px "Segoe UI",Arial'; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.textBaseline = 'middle';
  const txt = P.state === 'shot' ? (P.ok ? '¡DISPARA…!' : '…') : (P.human ? '¡CLIC o ESPACIO para disparar!' : P.gkHuman ? '🧤 ¡CLIC o ESPACIO: PARA!' : 'El rival va a tirar…');
  cx.fillText(txt, FIELD.W / 2, y + h + (P.gkHuman ? 40 : 14));
  cx.restore();
}

function goalScored() {
  const g = M.w.goal; let s = g.scorer;
  const ng = M.ng; M.ng = null; if (ng && ng.inv) { s = 1 - s; g.scorer = s; }
  if (M.offs && M.offs[1 - s] > 0 && !M.so && !M.sudden) {   // fuera de juego: el gol se anula, no cuenta
    M.offs[1 - s]--; M.phase = 'goal'; M.seq++; M.pen = null; M.penAward = null; M.immune = [false, false]; M.extra = [0, 0]; M.lockPlays = [0, 0]; M.w.lock = [false, false];
    logEv('🚩', 'Fuera de juego: gol de <b>' + tn(M.codes[s]) + '</b> anulado'); fx.shake = 0.3; sfx.whistle();
    goalFx('🚩 ¡FUERA DE JUEGO!', 'Gol anulado a ' + tn(M.codes[s]), s === 1 || M.S.j2, false); hudScore();
    const sq = M.seq; setTimeout(() => { if (M && G.screen === 'match' && M.seq === sq) afterGoal(); }, 1300); return;
  }
  if (M.theater && !M.so && !M.sudden && M.playTeam != null && s === M.playTeam && pk(1 - M.playTeam, 'teatrero')) {   // teatrero: el rival golpeó antes de tocar el balón → falta, el gol no vale
    const v = 1 - M.playTeam; M.fouls = M.fouls || [0, 0]; M.fouls[M.playTeam]++;
    M.phase = 'goal'; M.seq++; M.pen = null; M.penAward = null; M.immune = [false, false]; M.extra = [0, 0]; M.lockPlays = [0, 0]; M.w.lock = [false, false];
    logEv('🎭', 'Teatro de <b>' + tn(M.codes[v]) + '</b>: falta, gol anulado'); fx.shake = 0.3; sfx.whistle();
    goalFx('🎭 ¡FALTA!', 'Gol anulado · 2 tiros para ' + tn(M.codes[v]), v === 0 || M.S.j2, false); hudScore();
    const sq = M.seq; setTimeout(() => { if (M && G.screen === 'match' && M.seq === sq) { afterGoal(); if (M && !M.over) { M.extra[v] = 1; M.turn = v; hudScore(); hudHand(); } } }, 1300); return;
  }
  { const c = 1 - s;   // seguro de autogoles: los goles en propia no cuentan en los 5 primeros turnos del equipo
    if (!M.so && !M.sudden && M.play && M.playTeam === c && pk(c, 'vaina') && M.maxTurns[c] - M.shots[c] <= 5) {
      M.phase = 'goal'; M.seq++; M.pen = null; M.penAward = null; M.immune = [false, false]; M.extra = [0, 0]; M.lockPlays = [0, 0]; M.w.lock = [false, false];
      logEv('🛡️', 'Autogol de <b>' + tn(M.codes[c]) + '</b> anulado'); fx.shake = 0.3; sfx.whistle();
      goalFx('🛡️ ¡AUTOGOL ANULADO!', 'No cuenta para ' + tn(M.codes[s]), s === 1 || M.S.j2, false); hudScore();
      const sq = M.seq; setTimeout(() => { if (M && G.screen === 'match' && M.seq === sq) afterGoal(); }, 1300); return;
    } }
  let val = 1;
  if (pk(s, 'manoplas') && g.lastTeam === s && g.lastRole === 'POR') val *= 2;
  if (pk(s, 'regalo') && g.lastTeam === 1 - s) val *= 2;
  if (pk(s, 'golazo') && (s === 0 ? g.lastX < FIELD.W / 2 : g.lastX > FIELD.W / 2) && g.lastTeam === s) val = 2;
  if (M.gold[s] && M.gold[s].left > 0) { val *= M.gold[s].mul; M.gold[s].left--; }
  if (ng && ng.mul > 1) val *= ng.mul;
  if (M.star && M.star.left > 0 && g.lastTeam === s && g.lastName === M.star.name && M.star.team === s) { val *= 2; M.star.left--; }
  if (M.rush && M.rush[s] && M.shots[s] < M.rush[s]) val *= 2;
  { const pl0 = M.play, sc0 = g.lastTeam === s && g.lastName ? M.w.bodies.find(b => b.kind === 'cap' && b.team === s && b.name === g.lastName) : null;
    if (M.pase && M.pase[s] > 0 && pl0 && pl0.team === s && sc0 && sc0.id !== pl0.shooter) { val *= 2; fx.pops.push({ x: sc0.x, y: sc0.y - 40, txt: '🤝 ¡GOL DE PASE!', t: 0, col: '#7ad0ff', big: 1.2 }); } }
  if (pk(s, 'freestyler') && M.play && M.play.team === s && M.play.walls > 4 && !M.so) { const mny = M.play.walls - 4; M.bonus[s] += mny; fx.pops.push({ x: FIELD.W / 2, y: FIELD.H / 2, txt: '🕺 FREESTYLER +$' + mny + ' (' + M.play.walls + ' rebotes)', t: 0, col: '#ffd166', big: 1.5 }); }
  if (M.marr && M.marr[s] > 0 && M.pushed && M.playTeam === s && !M.so) { val *= 2; fx.pops.push({ x: FIELD.W / 2, y: FIELD.H / 2 - 40, txt: '😈 ¡GOL MARRULLERO!', t: 0, col: '#ff9a5a', big: 1.3 }); }
  M.score[s] += val; M.goals[s] += val;
  if (M.run && g.lastTeam === s && g.lastName) (M.goalList = M.goalList || []).push({ team: s, name: g.lastName, n: val });
  if (s === 0 && G.stats) { G.stats.goals += val; }
  if (g.lastTeam != null && g.lastTeam !== -1 && g.lastTeam !== s && !M.so) { const og = M.w.bodies.find(b => b.kind === 'cap' && b.team === g.lastTeam && b.name === g.lastName); if (og) mentalDrop([og], og.name + ' se hunde por el gol en propia'); }
  if (!M.so && g.lastTeam === s) {
    const sc = M.w.bodies.find(b => b.kind === 'cap' && b.team === s && b.name === g.lastName);
    if (sc) { sc.goalsM = (sc.goalsM || 0) + 1; mentalUp([sc], Math.min(0.9, 0.3 + 0.2 * (sc.goalsM - 1)), sc.name + ' se crece (' + sc.goalsM + ' gol' + (sc.goalsM > 1 ? 'es' : '') + ')'); }
    if (M.score[s] >= 3) mentalUp(M.w.bodies.filter(b => b.kind === 'cap' && b.team === s && b !== sc), 0.2, tn(M.codes[s]) + ' se viene arriba');
  }
  M.defl = M.defl || [0, 0];
  for (const t of [0, 1]) { const df = M.score[1 - t] - M.score[t]; if ((df >= 3 && M.defl[t] < 1) || (df >= 5 && M.defl[t] < 2)) { M.defl[t] = df >= 5 ? 2 : 1; mentalDrop(M.w.bodies.filter(b => b.kind === 'cap' && b.team === t), tn(M.codes[t]) + ' se hunde (−' + df + ')'); } }
  const pl = M.play; let combo = 0;
  if (pl && pl.team === s) combo = (g.chg || 0) + pl.relays + Math.max(0, pl.touch.size - 1) + pl.posts;
  let cash = s === 0 && M.run ? 2 + 2 * combo : 0;
  if (cash && g.lastTeam === s && g.lastName) { const dsc = M.w.bodies.find(b => b.kind === 'cap' && b.team === s && b.name === g.lastName), nD = dsc ? abCount(dsc.abs, 'diamante') : 0; if (nD) { const dm = [1, 2, 4][Math.min(3, nD) - 1]; cash += dm; fx.pops.push({ x: dsc.x, y: dsc.y - 44, txt: '💎 +$' + dm, t: 0, col: '#7ee8ff', big: 1.2 }); } }
  M.cash += cash; M.lastGoalVal = cash;
  { const og = g.lastTeam != null && g.lastTeam !== -1 && g.lastTeam !== s; logEv('⚽', `<b>${tn(M.codes[s])}</b> ${g.lastName ? g.lastName : ''}${og ? ' (en propia)' : ''}${val > 1 ? ' ×' + val : ''}${cash ? ' · 💰+$' + cash : ''}`); }
  if (combo >= 1) sfx.combo(combo);
  if (cash) { for (let i = 0; i < 14 + combo * 6; i++) fx.conf.push({ x: g.x < 0 ? 20 : FIELD.W - 20, y: FIELD.H / 2, vx: (Math.random() - 0.5) * 900 + (g.x < 0 ? 500 : -500), vy: -300 - Math.random() * 600, rot: 0, vr: 0, c: '#ffd166', coin: true, life: 1.8 + Math.random() }); }
  if (combo >= 3) fx.slow = 0.9;
  const own = M.play && M.playTeam != null && M.playTeam !== s;
  if (own && !M.lastFree) M.shots[M.playTeam]++;
  M.ownGoal = !!own;
  M.phase = 'goal'; M.seq++; M.pen = null; M.penAward = null; M.immune = [false, false]; M.extra = [0, 0]; M.lockPlays = [0, 0]; M.w.lock = [false, false];
  fx.shake = 0.5;
  for (let i = 0; i < 70 + 30 * Math.min(4, combo); i++) fx.conf.push({ x: g.x < 0 ? 20 : FIELD.W - 20, y: FIELD.H / 2 + (Math.random() - 0.5) * 120, vx: (Math.random() - 0.5) * 900 + (g.x < 0 ? 400 : -400), vy: (Math.random() - 0.5) * 900, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, c: pick(['#c6ff3d', '#35e0ff', '#ffd166', '#ff4d6d', '#fff']), life: 1.6 + Math.random() });
  sfx.goal();
  goalFx(own ? '¡GOL EN PROPIA!' : val > 1 ? '¡GOLAZO ×' + val + '!' : (combo >= 1 ? '¡GOL COMBO ×' + combo + '!' : '¡GOOOL!'), tn(M.codes[s]) + (cash ? '  ·  +$' + cash : ''), s === 0 || M.S.j2 || own, own);
  hudScore();
  const mySeq = M.seq;
  setTimeout(() => {
    if (!M || G.screen !== 'match' || M.seq !== mySeq) return;
    if (M.rec && M.rec.fr.length > 12 && !M.so) showGoalBar(mySeq); else afterGoal();
  }, 1000);
}

/* moneda rápida antes del partido: decide quién saca */
function coinFlip(codes, starter, name) {
  const old = $('#coin'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'coin'; el.className = 'coinw';
  el.innerHTML = `<div class="coin" style="--end:${starter === 0 ? 1800 : 1980}deg"><div class="cf f">${flagSVG(codes[0])}</div><div class="cf b">${flagSVG(codes[1])}</div></div><div class="coin-t">SAQUE: <b>${String(name).toUpperCase()}</b></div>`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1500);
}
function goalFx(title, sub, good, own) {
  const old = $('#goalfx'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'goalfx'; el.className = 'goalfx ' + (own ? 'own' : good ? 'good' : 'bad');
  const big = title.length < 11;
  el.innerHTML = '<div class="gf-flash"></div><div class="gf-rays"></div><div class="gf-txt' + (big ? ' big' : '') + '">' + [...title].map((ch, i) => `<span style="animation-delay:${i * 0.03}s">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('') + '</div><div class="gf-sub">' + sub + '</div>';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
}
function showGoalBar(seq) {
  M.rec.on = false;
  const el = document.createElement('div'); el.id = 'goalbar'; el.className = 'goalbar';
  el.innerHTML = '<button class="btn big" data-a="replay">📹 VER REPETICIÓN</button><button class="btn big alt" data-a="goon">CONTINUAR ▶</button>';
  document.body.appendChild(el);
  M.goalTimer = setTimeout(() => { if (M && M.seq === seq && $('#goalbar')) goOn(); }, 2500);
}
function goOn() { clearTimeout(M.goalTimer); const e = $('#goalbar'); if (e) e.remove(); if (M.repNext) { const f = M.repNext; M.repNext = null; f(); } else afterGoal(); }
function startReplay() {
  clearTimeout(M.goalTimer); const e = $('#goalbar'); if (e) e.remove();
  cv.style.filter = 'sepia(.5)';
  M.replay = { fr: M.rec.fr, i: 0, acc: 0, hold: 0 }; M.phase = 'replay'; fx.trail = []; fx.conf = [];
  const el = document.createElement('div'); el.id = 'replaybar'; el.className = 'goalbar';
  el.innerHTML = '<button class="btn big alt" data-a="skiprep">SALTAR ▶</button>'; document.body.appendChild(el);
}
function endReplay() {
  cv.style.filter = '';
  const e = $('#replaybar'); if (e) e.remove();
  if (M.replay && M.replay.back) {   // repetición del penalti: se restauran las posiciones y vuelve el aviso
    const R = M.replay; R.back.forEach(([b, x, y, a, h]) => { b.x = x; b.y = y; b.ang = a; b.airH = h; }); fx.trail = [];
    if (R.el) R.el.style.display = ''; M.replay = null; M.phase = 'pen'; return;
  }
  M.replay = null; M.w.bodies.forEach(b => { b.airH = null; }); M.phase = 'goal';
  if (M.repNext) { const f = M.repNext; M.repNext = null; f(); } else afterGoal();
}
/* soborno: el jugador sobornado vuelve a su equipo al acabar la jugada */
function unbribe() { if (M && M.w) M.w.bodies.forEach(b => { if (b.origTeam != null) { b.team = b.origTeam; b.origTeam = null; } }); }
/* comodín «rival desordenado»: tras cada gol, el rival se coloca al azar en su campo (el portero no) */
function scatterAfterGoal() {
  if (!M.scat) return;
  const w = M.w;
  [0, 1].forEach(t => {
    if (!(M.scat[1 - t] > 0)) return;
    const left = physSide(w, t) === 0, x0 = left ? 50 : FIELD.W / 2 + 40, x1 = left ? FIELD.W / 2 - 40 : FIELD.W - 50;
    const caps = w.bodies.filter(b => b.kind === 'cap' && b.team === t && b.role !== 'POR'), placed = w.bodies.filter(b => b.kind === 'cap' && !caps.includes(b));
    const bump = [].concat(w.bumpers || [], w.kz ? w.kz[0].bumpers || [] : [], w.kz ? w.kz[1].bumpers || [] : []);
    caps.forEach(b => {
      for (let i = 0; i < 400; i++) {
        const x = x0 + Math.random() * (x1 - x0), y = 50 + Math.random() * (FIELD.H - 100);
        const bad = placed.some(o => Math.hypot(o.x - x, o.y - y) < o.r + b.r + 6) || w.balls.some(bl => Math.hypot(bl.x - x, bl.y - y) < bl.r + b.r + 10) || bump.some(p => Math.hypot(p[0] - x, p[1] - y) < p[2] + b.r + 10);
        if (!bad || i === 399) { b.x = x; b.y = y; break; }
      }
      b.vx = b.vy = 0; placed.push(b); fx.rings.push({ x: b.x, y: b.y, t: 0, v: 1.2 });
    });
  });
}
function afterGoal() {
  if (!M || G.screen !== 'match') return;
  unbribe();
  const s = M.w.goal ? M.w.goal.scorer : 0;
  M.rec = null;
  if (M.sudden) return endMatch();
  resetKickoff(M.w); scatterAfterGoal(); M.w.noGoal = true; M.w.ngOff = [false, false]; M.ngLeft = 1; fx.trail = []; M.free = false; fx.pops.push({ x: FIELD.W / 2, y: FIELD.H / 2 - 90, txt: '🛡️ PORTERÍAS BLINDADAS', t: 0, col: '#ff6b87', big: 1.1 });
  M.rot = 1 - s; M.turn = M.rot; if (!M.shots[M.turn]) M.turn = 1 - M.turn;
  M.phase = 'aim'; M.sel = null;
  if (M.shots[0] + M.shots[1] <= 0) return chooseNext(null);
  hudScore(); hudCap(); hudHand();
  if (!M.human[M.turn]) aiTurn(); else banner(M.S.j2 ? 'SACA J' + (M.turn + 1) : 'SACAS TÚ', '', 800);
}
/* dinero del partido: reglas generales + reliquias + multiplicadores. Devuelve el desglose para mostrarlo en los resultados */
/* el dinero ganado en el partido (combos) pasa a la cartera al abrir la tienda o la ruleta, para poder gastarlo */
function bankCash() { if (!M || !M.run || !(M.cash > 0)) return; gain(M.cash); M.cashBanked = (M.cashBanked || 0) + M.cash; M.cash = 0; if (typeof hudScore === 'function') hudScore(); }
function matchMoney(win, draw, knock) {
  const items = [], add = (ic, l, v) => { if (v) items.push({ ic, l, v }); };
  const sc = M.score, goals = M.goals[0];
  add(win ? '🏆' : '🤝', win ? 'Victoria' : 'Empate', win ? 5 : draw ? 3 : 0);
  add('⚽', 'Goles marcados (×$1)', goals);
  add('📊', 'Goles de diferencia (×$1)', Math.max(0, sc[0] - sc[1]));
  { const per = {}; (M.goalList || []).forEach(g => { if (g.team === 0) per[g.name] = (per[g.name] || 0) + g.n; }); add('⭐', 'Jugadores con 3 o más goles (×$1)', Object.values(per).filter(n => n >= 3).length); }
  add('🕊️', 'Sin faltas', (M.fouls && M.fouls[0]) ? 0 : 1);
  add('🔥', 'Combos y rebotes', M.cash);
  add('🎁', 'Bonus', M.bonus[0]);
  if (hasPerk('botas')) add('👟', 'Botas de oro (×$2 por gol)', goals * 2);
  if (hasPerk('prima') && win) add('💶', 'Prima de fichaje', 4);
  if (hasPerk('goleada') && win) add('📈', 'Prima por goleada', Math.max(0, sc[0] - sc[1]));
  if (knock && hasPerk('mecenas') && win) add('🏦', 'Mecenas', G.caps.reduce((a, c) => a + (c.stars || 1), 0));
  const sub = items.reduce((a, b) => a + b.v, 0), mults = [];
  if (M.lesion && M.lesion[0]) mults.push({ ic: '🤕', l: 'Lesión', x: 3 });
  if (hasPerk('doble')) mults.push({ ic: '💸', l: 'Doble paga', x: 2 });
  const total = Math.round(mults.reduce((a, m) => a * m.x, sub));
  return { items, sub, mults, total, paid: M.cashBanked || 0 };
}
function moneyBox(R) {
  const b = R.bd; if (!b) return '';
  return `<div class="rmoney" tabindex="0"><div class="rm-big">💰 <b>+$${R.reward}</b></div><div class="rm-sub">ganado por el equipo · pasa el ratón para ver el desglose</div>
    <div class="rm-tip"><div class="rm-h">DESGLOSE DEL DINERO</div>${b.items.map(i => `<div class="rm-r"><span>${i.ic} ${i.l}</span><b>+$${i.v}</b></div>`).join('')}${b.mults.length ? `<div class="rm-r st"><span>Subtotal</span><b>$${b.sub}</b></div>` + b.mults.map(m => `<div class="rm-r"><span>${m.ic} ${m.l}</span><b>×${m.x}</b></div>`).join('') : ''}${b.paid ? `<div class="rm-r st"><span>🔥 Combos ya cobrados en el partido</span><b>$${b.paid}</b></div>` : ''}<div class="rm-r tot"><span>TOTAL</span><b>+$${b.total}</b></div></div></div>`;
}
function endMatch(pens) {
  if (M.over) return;
  hideEndHud();
  M.over = true; M.phase = 'over'; M.seq++;
  document.body.classList.remove("ng-on");
  banner('🏁 FINAL', M.score[0] + ' - ' + M.score[1], 2100); sfx.whistle(); setTimeout(() => sfx.whistle(), 480);   // pitido final doble
  let win = M.score[0] > M.score[1];
  if (M.score[0] === M.score[1]) {
    const bx = M.w.balls.reduce((a, b) => a + b.x, 0) / M.w.balls.length;
    win = bx > FIELD.W / 2 ? true : bx < FIELD.W / 2 ? false : Math.random() < 0.5;
  }
  const goals = M.goals[0];
  let reward = 0, bd = null;
  if (M.run && (G.league || inGroup())) {
    const draw = M.score[0] === M.score[1]; win = M.score[0] > M.score[1];
    bd = matchMoney(win, draw, false); reward = bd.total;
    gain(reward);
    if (win) { G.stats.wins++; sfx.win(); if (hasPerk('pretemp')) { const c = pick(G.caps), k = pick(STAT_KEYS); c.stats[k] = Math.min(CONFIG.statMax, c.stats[k] + 1); } } else if (draw) sfx.win(); else sfx.lose();
    M.draw = draw; if (G.league) leagueRecord(); else tourRecord(win);
  } else if (M.run) {
    tourRecord(win);
    bd = matchMoney(win, false, true); reward = win ? bd.total : 0;
    if (win) {
      gain(reward); G.stats.wins++; saveBest(G.round + 1); sfx.win();
      if (hasPerk('pretemp')) { const c = pick(G.caps), k = pick(STAT_KEYS); c.stats[k] = Math.min(CONFIG.statMax, c.stats[k] + 1); }
    } else { saveBest(G.round); sfx.lose(); }
  } else sfx.win();
  if (M.run) G.perks.slice().forEach(k => { G.pu = G.pu || {}; G.pu[k] = perkLeft(k) - 1; if (G.pu[k] <= 0) { G.perks.splice(G.perks.indexOf(k), 1); delete G.pu[k]; (M.expired = M.expired || []).push(k); toast('💥 ' + PERKS[k].n + ' se ha destruido'); } });
  if (M.run) G.cards = G.cards.filter((c, i) => !(M.hands[0][i] && M.hands[0][i].used));   // las cartas usadas se gastan
  if (M.run && !runAlive()) clearRun();
  else if (M.run && !G.league && !G.tour && !win) clearRun();
  M.result = { win, draw: !!M.draw, reward, bd, pens: !!M.regScore, reg: M.regScore, goals, cash: M.cash, bonus: M.bonus[0], les: !!(M.lesion && M.lesion[0]) };
  setTimeout(showResult, 2400);
}

/* ===================== BUCLE ===================== */
/* calidad adaptativa: si el equipo va justo, baja la resolución del canvas y quita los desenfoques (sombras brillantes) */
let QUAL = 0, qAcc = 0, qN = 0;
function adaptQuality(raw) {
  if (QUAL >= 2 || raw > 250) return;
  qAcc += raw; qN++;
  if (qN < 90) return;
  const avg = qAcc / qN; qAcc = qN = 0;
  if (avg > 25) {
    QUAL++;
    if (QUAL >= 1) try { Object.defineProperty(cx, 'shadowBlur', { set() {}, get() { return 0; }, configurable: true }); } catch (e) { /* nada */ }
    fogCv = null; resize();
  }
}
let UK = 1;   // factor de escalado de la interfaz (móviles / pantallas bajas)
function applyScale() {
  const k = Math.min(1, window.innerHeight / 580), r = document.documentElement;
  UK = k < 0.999 ? k : 1;
  r.classList.toggle('sc', UK < 1);
  r.style.setProperty('--k', UK);
  // unidades basadas en el tamaño visible real (en móviles 100vh incluye la barra del navegador y el contenido no cabía)
  r.style.setProperty('--vh', (window.innerHeight / 100 / UK) + 'px');
  r.style.setProperty('--vw', (window.innerWidth / 100 / UK) + 'px');
}
applyScale();
function resize() {
  if (!cv) return;
  applyScale();
  const w = window.innerWidth / UK, h = window.innerHeight / UK;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1, Math.sqrt(2200000 / (w * h * UK * UK))) * [1, 0.8, 0.6][QUAL] * UK;   // limita los píxeles del canvas para ir fluido
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const wa = w - (G && G.lab ? LABW : 0);
  const S = Math.min(wa / STAGE_W, h / STAGE_H);
  view = { S, dpr, ox: (wa - STAGE_W * S) / 2 + FIELD.MX * S, oy: (h - STAGE_H * S) / 2 + FIELD.MY * S, w, h };
  pitchKey = '';
  document.documentElement.style.setProperty('--capw', Math.max(150, Math.min(230, view.ox - 22)) + 'px');
}
function buildCache() {
  const key = view.S.toFixed(3) + '|' + view.dpr + '|' + (M.w.dream ? 'd' : M.w.geo.rt.toFixed(1) + '|' + M.w.geo.lt.toFixed(1)) + '|' + M.w.field + (M.w.kz ? M.w.kz[0].field + M.w.kz[1].field : '') + '|' + M.grass.pat + M.grass.col;
  if (key === pitchKey) return;
  pitchKey = key;
  pitchCache = document.createElement('canvas');
  pitchCache.width = Math.ceil(STAGE_W * view.S * view.dpr); pitchCache.height = Math.ceil(STAGE_H * view.S * view.dpr);
  const c = pitchCache.getContext('2d');
  c.scale(view.S * view.dpr, view.S * view.dpr);
  if (M.w.kz) {
    const hx = FIELD.MX + FIELD.W / 2;
    [0, 1].forEach(h => { c.save(); c.beginPath(); c.rect(h ? hx : 0, 0, h ? STAGE_W - hx : hx, STAGE_H); c.clip(); drawPitch(c, M.w.geo, M.w.kz[h].field, M.grass); c.restore(); });
  } else drawPitch(c, M.w.geo, M.w.field, M.grass);
}

function frame(ts) {
  requestAnimationFrame(frame);
  if (!cx) return;
  frame.raw = frame.last ? ts - frame.last : 0;
  const dt = Math.min(0.05, (ts - (frame.last || ts)) / 1000); frame.last = ts;
  if (G.screen !== 'match' || !M) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); return; }
  if (fx.slow > 0) fx.slow -= dt;
  if (frame.raw) adaptQuality(frame.raw);
  if (M && (M.phase === 'goal' || M.phase === 'replay') && fx.pops.length) fx.pops = fx.pops.filter(p => p.keep);
  if (G.screen === 'match' && !document.getElementById('pause')) update(fx.slow > 0 ? dt * 0.35 : dt);
  draw(dt);
}

function comboEvent(e) {
  const pl = M.play; if (!pl) return;
  if (e.t === 'ball') {
    const id = e.a < 90 ? e.a : e.b, cp = id < 90 ? capById(id) : null;
    if (cp && cp.team === pl.team && !pl.touch.has(id)) { pl.touch.add(id); if (pl.touch.size > 1) fx.pops.push({ x: e.x, y: e.y - 30, txt: '¡PASE!', t: 0, col: '#35e0ff', big: 1 }); }
  } else if (e.t === 'cap' && e.a < 90 && e.b < 90) {
    const A = capById(e.a), B = capById(e.b);
    if (A && B && A.team === pl.team && B.team === pl.team && e.v > 120) { pl.relays++; fx.arcs.push({ a: e.a, b: e.b, t: 0 }); sfx.zap(); fx.pops.push({ x: e.x, y: e.y - 30, txt: '¡RELEVO!', t: 0, col: '#ffe36a', big: 1 }); }
  } else if (e.t === 'wall' && e.ball != null && e.chg >= 1 && (M.w.balls.find(q => q.id === e.ball) || {}).btype !== 'invisible') {
    pl.walls++; sfx.bounce(e.chg);
    fx.pops.push({ x: Math.min(FIELD.W - 30, Math.max(30, e.x)), y: Math.min(FIELD.H - 40, Math.max(40, e.y)), txt: 'REBOTE ×' + e.chg, t: 0, col: chgCol(e.chg), big: 0.9 + 0.12 * e.chg });
    for (let i = 0; i < 6 + Math.min(10, e.chg) * 2; i++) fx.conf.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 500, vy: (Math.random() - 0.5) * 500, rot: 0, vr: 0, c: '#ffe36a', spark: true, life: 0.35 + Math.random() * 0.25 });
    fx.shake = Math.max(fx.shake, 0.06 + Math.min(8, e.chg) * 0.02);
  } else if (e.t === 'post' && e.ball != null) { pl.posts++; fx.pops.push({ x: e.x, y: e.y - 30, txt: '¡POSTE!', t: 0, col: '#ffd166', big: 1 }); }
}
function homingStep(dt) {
  const H = M.homing, w = M.w;
  if (!H.hit) return;
  H.t += dt;
  if (H.t > 3.2 || w.noGoal || w.lock[1 - H.team]) { M.homing = null; return; }
  const hR = physSide(w, H.team) === 0, tx = hR ? FIELD.W + 40 : -40, ty = FIELD.H / 2;
  w.balls.forEach(b => {
    let sp = Math.hypot(b.vx, b.vy); if (sp < 20) { sp = 20; b.vx = hR ? 20 : -20; b.vy = 0; }
    const want = Math.atan2(ty - b.y, tx - b.x); let cur = Math.atan2(b.vy, b.vx), d = want - cur;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    cur += clamp(d, -6 * dt, 6 * dt); sp = Math.max(sp, 600);
    b.vx = Math.cos(cur) * sp; b.vy = Math.sin(cur) * sp;
    if (Math.random() < 0.8) fx.trail.push({ x: b.x, y: b.y, t: 0, r: b.r, c: '#ffe36a', life: 0.35 });
  });
}
function updateReplay(dt) {
  const R = M.replay; R.acc += dt * 0.8;
  while (R.acc >= 1 / 60 && R.i < R.fr.length - 1) {
    R.acc -= 1 / 60; R.i++;
    const f = R.fr[R.i]; M.w.bodies.forEach((b, k) => { if (f[k]) { b.x = f[k][0]; b.y = f[k][1]; b.ang = f[k][2]; b.airH = f[k][3]; } });
  }
  if (R.i >= R.fr.length - 1) { R.hold = (R.hold || 0) + dt; if (R.hold > 0.7) endReplay(); }
}
function update(dt) {
  const w = M.w;
  if (w.dream && !M.pen) moveGoals(w, dt);
  aiWatchdog(dt); penWatchdog(dt);
  if (M.gull) updateGull(dt);
  if (M.phase === 'replay' && M.replay) updateReplay(dt);
  if (M.phase === 'pen') { updatePen(dt); }
  if (M.phase === 'move' || M.phase === 'goal') {
    M.acc += dt;
    if (M.phase === 'move') { M.moveT = (M.moveT || 0) + dt; w.xd = M.moveT > 6 ? 1 + (M.moveT - 6) * 2 : 1; }
    if (M.homing && M.phase === 'move') homingStep(dt);
    let guard = 0;
    w.playTeam = M.phase === 'move' ? M.playTeam : null; w.playT = M.moveT || 0; w.shooterId = M.play ? M.play.shooter : null; w.rkick = (w.playTeam != null && M.rkick && M.rkick[w.playTeam] > 0) ? w.playTeam : null; if (M.touched && M.playTeam != null) w.ballTouchedPlay = true;
    while (M.acc >= 1 / 200 && guard++ < 40) {
      stepWorld(w, 1 / 200); M.acc -= 1 / 200;
      // contacto físico con el balón aunque no genere evento (solapes, imán…): cuenta como tocar el balón, nunca falta
      if (!M.touched && M.playTeam != null && M.phase === 'move') {
        for (const c of w.bodies) { if (c.kind !== 'cap' || c.team !== M.playTeam || (c.vx * c.vx + c.vy * c.vy) < 16) continue;   // un jugador parado junto al balón no lo está tocando
          for (const bl of w.balls) { const dx = bl.x - c.x, dy = bl.y - c.y, rr = bl.r + c.r + 1.5; if (dx * dx + dy * dy <= rr * rr && !(bl.air > 0)) { M.touched = true; break; } }
          if (M.touched) break; }
      }
      if (M.phase === 'move' && w.goal) { goalScored(); break; }
    }
    // eventos de sonido / efectos
    for (const e of w.events) {
      if (e.t === 'cap' && M.playTeam != null && e.a < 90 && e.b < 90) { const A0 = capById(e.a), B0 = capById(e.b); if (A0 && B0 && A0.team !== B0.team) M.pushed = true; }
      if (e.t === 'cap' && M.playTeam != null && !M.touched && !M.so && e.a < 90 && e.b < 90) {   // vampiro: choca con un rival antes de tocar el balón
        const A1 = capById(e.a), B1 = capById(e.b);
        if (A1 && B1 && A1.team !== B1.team) {
          const vm = A1.team === M.playTeam ? A1 : B1, vc = vm === A1 ? B1 : A1, nV = abCount(vm.abs, 'vampiro'), key = vm.id + '>' + vc.id;
          M.vamp = M.vamp || {};
          if (nV && !M.vamp[key]) {
            M.vamp[key] = 1; const k = pick(BUMP_KEYS.filter(q => vc.st[q] > 1)); const r = k ? bumpCap(vc, k, -nV, '🧛') : 0;
            if (r) { fx.pops.push({ x: vc.x, y: vc.y - 44, txt: '🧛 ' + STATS[k].icon + ' ' + r, t: 0, col: '#ff5a7a', big: 1.2 }); logEv('🧛', `<b>${vm.name}</b> drena a <b>${vc.name}</b>: ${STATS[k].n} ${r}`); hudCap(); }
          }
        }
      }
      if (e.t === 'cap' && M.playTeam != null && !M.touched && !M.penAward && !M.penCand && !M.so && e.a < 90 && e.b < 90) {
        const A = capById(e.a), B = capById(e.b), pt = M.playTeam;
        if (A && B && A.team !== B.team) {
          M.hitRival = true;
          const mine = A.team === pt ? A : B, vic = mine === A ? B : A;
          if (pk(vic.team, 'teatrero') && !M.theater) { M.theater = true; sfx.whistle(); fx.pops.push({ x: e.x, y: e.y - 44, txt: '🎭 ¡TEATRO! FALTA', t: 0, col: '#ffd166', big: 1.4 }); w.bodies.forEach(q => { q.vx = 0; q.vy = 0; }); }   // se pita al instante y se corta la jugada
          const inArea = physSide(w, pt) === 0 ? (e.x < 165) : (e.x > FIELD.W - 165);
          const vIn = physSide(w, pt) === 0 ? (vic.x < 165) : (vic.x > FIELD.W - 165);   // el jugador derribado también debe estar dentro del área
          if (inArea && vIn && e.y > 125 && e.y < 515 && vic.y > 125 && vic.y < 515) M.penCand = { team: vic.team, victim: vic.id, x: e.x, y: e.y };   // candidato: solo es penalti si al acabar la jugada nadie ha tocado el balón
        }
      }
      comboEvent(e);
      if (e.t === 'ball' && M.homing && (e.a === M.homing.id || e.b === M.homing.id)) M.homing.hit = true;
      if (e.t === 'jump') { sfx.zap(); fx.pops.push({ x: e.x, y: e.y - 34, txt: '¡SALTA!', t: 0, col: '#9be7ff', big: 0.9 }); }
      else if (e.t === 'goatshot') { fx.pops.push({ x: e.x, y: e.y - 40, txt: '🐐 ¡A PORTERÍA!', t: 0, col: '#ffe36a', big: 1.1 }); fx.rings.push({ x: e.x, y: e.y, t: 0, v: 1.3 }); }
      else if (e.t === 'demonshot') { fx.pops.push({ x: e.x, y: e.y - 40, txt: '😈 ¡A PORTERÍA!', t: 0, col: '#ff6a4a', big: 1.1 }); fx.rings.push({ x: e.x, y: e.y, t: 0, v: 1.3 }); }
      else if (e.t === 'cure') { fx.pops.push({ x: e.x, y: e.y - 44, txt: '🩹 ¡CURADO!', t: 0, col: '#9dff8a', big: 1.1 }); hudCap(); }
      else if (e.t === 'poison') { sfx.whistle(); fx.pops.push({ x: e.x, y: e.y - 44, txt: '☠ ENVENENADA', t: 0, col: '#dba0ff', big: 1.1 }); { const tp = $('#tip'); if (tp) tp.dataset.h = ''; } hudCap(); hudHand(); }
      if (w.dark) { const nowT = performance.now(); if (e.t === 'plit') (M.litP = M.litP || []).push({ x: e.x, y: e.y, t: nowT }); else if (e.t === 'ball') { M.litC = M.litC || {}; if (e.a < 90) M.litC[e.a] = nowT; if (e.b < 90) M.litC[e.b] = nowT; } }
      if (e.t === 'ball') { const cp0 = e.a < 90 ? capById(e.a) : e.b < 90 ? capById(e.b) : null; if (M.playTeam == null || cp0) M.touched = true; sfx.ball(e.v); fx.rings.push({ x: e.x, y: e.y, t: 0, v: Math.min(1, e.v / 700) }); }
      else if (e.t === 'cap') sfx.cap(e.v);
      else if (e.t === 'wall') sfx.wall();
      else if (e.t === 'bump') { sfx.post(); fx.rings.push({ x: e.x, y: e.y, t: 0, v: 1.4 }); fx.bump = fx.bump || {}; fx.bump[e.x + ',' + e.y] = 0.25; }
      else if (e.t === 'post') { sfx.post(); fx.rings.push({ x: e.x, y: e.y, t: 0, v: 1 }); }
      else if (e.t === 'dev') { fx.pops.push({ x: e.x, y: e.y - 26, txt: '¡DESVÍO!', t: 0, col: '#ff9b9b', big: 0.8 }); }
      else if (e.t === 'barbreak') { const gg = w.geo, left = e.li === 0; fx.bars.push({ x: left ? 0 : FIELD.W, a: left ? gg.lt : gg.rt, b: left ? gg.lb : gg.rb, t: 0, left }); sfx.barbreak(); fx.shake = Math.max(fx.shake, 0.12); fx.rings.push({ x: e.x, y: e.y, t: 0, v: 1.4 }); fx.pops.push({ x: left ? 90 : FIELD.W - 90, y: (left ? gg.lt + gg.lb : gg.rt + gg.rb) / 2, txt: '💥 ¡BARRA ROTA!', t: 0, col: '#ff9aa8', big: 1 }); }
      else if (e.t === 'boom') { fx.rings.push({ x: e.x, y: e.y, t: 0, v: 1.6 }); fx.shake = Math.max(fx.shake, 0.18); }
    }
    w.events.length = 0;
    if (M.rec && M.rec.on) { M.rec.acc += dt; while (M.rec.acc >= 1 / 60) { M.rec.acc -= 1 / 60; recFrame(); } }
    if (M.stomp && M.phase === 'move') { M.stomp.t += dt; if (M.stomp.t > 0.9) doStomp(); }
    if (M.phase === 'move') {
      if (settled(w)) { w.balls.forEach(b => { b.chg = 0; }); M.stillT = (M.stillT || 0) + dt; if (M.stillT > 0.25) { M.stillT = 0; nextTurn(); } } else M.stillT = 0;
    }
    // estela del balón
    if (M.fire) for (const b of w.balls) { if (!ballHid(b) && Math.hypot(b.vx, b.vy) > 60) { for (let q = 0; q < 2; q++) fx.trail.push({ x: b.x + (Math.random() - 0.5) * b.r, y: b.y + (Math.random() - 0.5) * b.r, t: 0, r: b.r * (0.9 + Math.random() * 0.6), c: ['#ff3b1a', '#ff7a1a', '#ffc21a'][(Math.random() * 3) | 0], life: 0.45 }); } }
    for (const b of w.balls) { if (!ballHid(b) && (Math.hypot(b.vx, b.vy) > 380 || b.chg)) fx.trail.push({ x: b.x, y: b.y, t: 0, r: b.r, c: b.chg ? chgCol(b.chg) : '#fff', life: b.chg ? 0.4 : 0.28 }); }
    if (w.field === 'hielo') for (const b of w.bodies) { if (b.btype !== 'invisible' && Math.hypot(b.vx, b.vy) > 260 && fx.trail.length < 160) fx.trail.push({ x: b.x, y: b.y, t: 0, r: b.r * 0.7, c: '#d6f0ff', life: 0.4 }); }
    if (w.mud) for (const b of w.bodies) { if ((b.vx || b.vy) && fx.trail.length < 160 && w.mud.some(z => Math.hypot(b.x - z.x, b.y - z.y) < z.r)) fx.trail.push({ x: b.x + (Math.random() - 0.5) * b.r, y: b.y + (Math.random() - 0.5) * b.r, t: 0, r: 4 + Math.random() * 4, c: '#4a2a10', life: 0.45 }); }
  }
  if (fx.trail.length > 220) fx.trail.splice(0, fx.trail.length - 220);
  fx.trail.forEach(t => t.t += dt); fx.trail = fx.trail.filter(t => t.t < (t.life || 0.28));
  // un cartel nuevo en la misma zona hace desaparecer rápido al anterior
  fx.pops.forEach(p => {
    if (p.placed) return; p.placed = true;
    fx.pops.forEach(o => { if (o !== p && o.placed && Math.abs(o.x - p.x) < 200 && Math.abs((o.y - o.t / 1.1 * 50) - p.y) < 70) o.t = Math.max(o.t, 0.97); });
  });
  fx.pops.forEach(p => p.t += dt); fx.pops = fx.pops.filter(p => p.t < 1.1);
  fx.arcs.forEach(a => a.t += dt); fx.arcs = fx.arcs.filter(a => a.t < 0.35);
  if (fx.conf.length > 260) fx.conf.splice(0, fx.conf.length - 260);
  fx.rings.forEach(r => r.t += dt); fx.rings = fx.rings.filter(r => r.t < 0.4);
  fx.bars.forEach(p => p.t += dt); fx.bars = fx.bars.filter(p => p.t < 1);
  fx.dust.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }); fx.dust = fx.dust.filter(p => p.t < p.life);
  fx.conf.forEach(c => { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 600 * dt; c.vx *= 0.985; c.rot += c.vr * dt; c.life -= dt; });
  fx.conf = fx.conf.filter(c => c.life > 0);
  if (fx.shake > 0) fx.shake -= dt;
}

function draw(dt) {
  if (document.body.dataset.ph !== M.phase) { document.body.dataset.ph = M.phase; if (M.phase !== 'aim') hideTip(); }
  buildCache();
  const { S, dpr, ox, oy } = view;
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.fillStyle = '#070b10'; cx.fillRect(0, 0, cv.width, cv.height);
  cx.setTransform(ZM.k, 0, 0, ZM.k, ZM.x * dpr, ZM.y * dpr);
  cx.drawImage(pitchCache, (ox - FIELD.MX * S) * dpr, (oy - FIELD.MY * S) * dpr);
  let sx = 0, sy = 0;
  if (fx.shake > 0) { sx = (Math.random() - 0.5) * 10 * fx.shake; sy = (Math.random() - 0.5) * 10 * fx.shake; }
  cx.setTransform(dpr * S * ZM.k, 0, 0, dpr * S * ZM.k, dpr * (ZM.k * (ox + sx) + ZM.x), dpr * (ZM.k * (oy + sy) + ZM.y));
  const w = M.w, bodies = w.bodies;
  if (w.dream) drawDynGoals(w, false);
  if (w.pud) drawPuddles(w);
  // sombras ya van con cada cuerpo; estela
  fx.trail.forEach(t => { const L = t.life || 0.28; cx.globalAlpha = (1 - t.t / L) * 0.45; cx.fillStyle = t.c || '#fff'; cx.beginPath(); cx.arc(t.x, t.y, (t.r || FIELD.ballR) * (1 - t.t / L * 0.7), 0, Math.PI * 2); cx.fill(); });
  cx.globalAlpha = 1;
  // chapas seleccionables brillan
  const canPick = canShoot();
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
  const actor = M.phase === 'move' ? M.playTeam : M.turn;
  bodies.forEach(b => {
    if (b.kind !== 'cap') return;
    if (M.invis && M.invis[b.team] > 0 && actor === 1 - b.team) return;   // equipo invisible durante las jugadas del rival
    if (canPick && b.team === M.turn) {
      const act = b.id === M.sel || b.id === M.hover;
      cx.beginPath(); cx.arc(b.x, b.y, b.r + 7 + pulse * 2, 0, Math.PI * 2);
      cx.lineWidth = act ? 4 : 2; cx.strokeStyle = act ? '#c6ff3d' : 'rgba(198,255,61,.35)';
      cx.shadowColor = '#c6ff3d'; cx.shadowBlur = act ? 18 : 6; cx.stroke(); cx.shadowBlur = 0;
    } else if (M.phase === 'ai' && b.id === M.sel) {
      cx.beginPath(); cx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); cx.lineWidth = 4; cx.strokeStyle = '#ff4d6d'; cx.shadowColor = '#ff4d6d'; cx.shadowBlur = 16; cx.stroke(); cx.shadowBlur = 0;
    }
    if (M.boostId === b.id) { cx.beginPath(); cx.arc(b.x, b.y, b.r + 10, 0, Math.PI * 2); cx.lineWidth = 4; cx.strokeStyle = '#ffd166'; cx.shadowColor = '#ffd166'; cx.shadowBlur = 20; cx.stroke(); cx.shadowBlur = 0; }
    if (M.star && M.star.id === b.id && M.star.left > 0) {
      const R = b.r * (1.9 + 0.2 * Math.sin(performance.now() / 150)), g = cx.createRadialGradient(b.x, b.y, b.r * 0.6, b.x, b.y, R);
      g.addColorStop(0, 'rgba(255,240,120,.9)'); g.addColorStop(1, 'rgba(255,200,40,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(b.x, b.y, R, 0, Math.PI * 2); cx.fill();
    }
    const actSum = b.actB ? Object.keys(b.actB).reduce((a, k) => a + (k === 'MEN' ? 0 : b.actB[k]), 0) : 0;
    if (b.goat) { const t = performance.now() / 1000, g = cx.createRadialGradient(b.x, b.y, b.r * 0.6, b.x, b.y, b.r * (2.1 + 0.25 * Math.sin(t * 5))); g.addColorStop(0, 'rgba(255,240,150,.75)'); g.addColorStop(1, 'rgba(255,200,60,0)'); cx.save(); cx.fillStyle = g; cx.beginPath(); cx.arc(b.x, b.y, b.r * 2.4, 0, Math.PI * 2); cx.fill(); cx.restore(); }
    if ((actSum > 0 || b.goat) && cx.createConicGradient) {
      const al = b.goat ? 1 : Math.max(0.2, Math.min(1, actSum / 3));
      const cg = cx.createConicGradient(performance.now() / 700 + b.id, b.x, b.y);
      ['#ff3b3b', '#ffb02e', '#f5ff3d', '#3dff7a', '#3dd2ff', '#7a5cff', '#ff4fd8', '#ff3b3b'].forEach((c, k, a) => cg.addColorStop(k / (a.length - 1), c));
      cx.save(); cx.globalAlpha = al; cx.beginPath(); cx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2); cx.lineWidth = 4; cx.strokeStyle = cg; cx.stroke(); cx.restore();
    }
    drawCap(cx, b.x, b.y, b.r, M.kits[b.team], { num: b.num });
    if (b.mot || b.goat) {
      const t = performance.now() / 1000; cx.save(); cx.fillStyle = '#fff3a0'; cx.shadowColor = '#ffd84a'; cx.shadowBlur = 8;
      for (let k = 0; k < 5; k++) { const ph = (t * 0.8 + k / 5) % 1, a = k * 2.4 + b.id, sx = b.x + Math.cos(a) * b.r * 0.9, sy = b.y + Math.sin(a) * b.r * 0.5 - ph * b.r * 1.6, s = (1 - ph) * 4.5; cx.globalAlpha = 1 - ph; cx.beginPath(); cx.moveTo(sx, sy - s); cx.lineTo(sx + s * 0.3, sy - s * 0.3); cx.lineTo(sx + s, sy); cx.lineTo(sx + s * 0.3, sy + s * 0.3); cx.lineTo(sx, sy + s); cx.lineTo(sx - s * 0.3, sy + s * 0.3); cx.lineTo(sx - s, sy); cx.lineTo(sx - s * 0.3, sy - s * 0.3); cx.closePath(); cx.fill(); }
      cx.restore();
    }
    if (M.star && M.star.id === b.id && M.star.left > 0) { cx.font = '900 ' + Math.round(b.r * 0.9) + 'px "Segoe UI Emoji",Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🌟', b.x, b.y - b.r * 1.35); }
    if (b.goat) { cx.font = '900 ' + Math.round(b.r * 0.8) + 'px "Segoe UI Emoji",Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🐐', b.x, b.y - b.r * 1.5 - 3 * Math.sin(performance.now() / 220)); }
    if (b.poison) {
      const t = performance.now() / 1000; cx.save(); cx.beginPath(); cx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2); cx.fillStyle = 'rgba(150,40,220,.35)'; cx.fill(); cx.lineWidth = 3; cx.strokeStyle = '#c56bff'; cx.shadowColor = '#b04bff'; cx.shadowBlur = 14; cx.stroke(); cx.shadowBlur = 0;
      cx.fillStyle = 'rgba(214,140,255,.9)'; for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k / 3) % 1; cx.globalAlpha = 1 - ph; cx.beginPath(); cx.arc(b.x + Math.sin(k * 2.3 + t) * b.r * 0.6, b.y - ph * b.r * 1.5, 2.5 + (1 - ph) * 2.5, 0, Math.PI * 2); cx.fill(); }
      cx.globalAlpha = 1; cx.font = '900 ' + Math.round(b.r * 0.6) + 'px "Segoe UI Emoji",Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('☠', b.x, b.y + b.r * 1.5); cx.restore();
    }
    if (b.captain) { const px = b.x + b.r * 0.82, py = b.y + b.r * 0.82, rr = Math.max(9, b.r * 0.36); cx.fillStyle = '#ffd23f'; cx.strokeStyle = '#5a3d00'; cx.lineWidth = 2; cx.beginPath(); cx.arc(px, py, rr, 0, Math.PI * 2); cx.fill(); cx.stroke(); cx.font = '900 ' + Math.round(rr * 1.3) + 'px "Segoe UI",Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#3a2600'; cx.fillText('C', px, py + 1); }
    if (b.abs.length) {
      const pos = [[0.8, -0.8], [-0.8, -0.8], [0, -1.15]];
      b.abs.slice(0, 3).forEach((k, i) => { const px = b.x + b.r * pos[i][0], py = b.y + b.r * pos[i][1], rr = Math.max(9, b.r * 0.42);
        cx.fillStyle = 'rgba(8,14,24,.85)'; cx.strokeStyle = '#35e0ff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(px, py, rr, 0, Math.PI * 2); cx.fill(); cx.stroke();
        cx.font = Math.round(rr * 1.25) + 'px "Segoe UI Emoji",Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#fff'; cx.fillText(ABILITIES[k].icon, px, py + 1); });
    }
    if (b.frozen) {
      cx.save(); cx.beginPath(); cx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2); cx.fillStyle = 'rgba(150,220,255,.55)'; cx.fill(); cx.lineWidth = 3; cx.strokeStyle = '#e6f8ff'; cx.shadowColor = '#7fd8ff'; cx.shadowBlur = 16; cx.stroke(); cx.shadowBlur = 0;
      cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 2; for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; cx.beginPath(); cx.moveTo(b.x + Math.cos(a) * b.r * 0.9, b.y + Math.sin(a) * b.r * 0.9); cx.lineTo(b.x - Math.cos(a) * b.r * 0.9, b.y - Math.sin(a) * b.r * 0.9); cx.stroke(); }
      cx.font = '900 ' + Math.round(b.r * 0.7) + 'px "Segoe UI Emoji",Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#fff'; cx.fillText('❄' + b.frozen, b.x, b.y + b.r * 1.45); cx.restore();
    }
  });
  w.balls.forEach(bl => { if (bl.chg && !ballHid(bl)) drawGlow(bl); drawBall(cx, bl); });
  drawField(w);
  if (w.dream) drawSparks(performance.now() / 1000);
  if (w.rain) { w.balls.forEach(bl => { if (bl.wet > 0 && !ballHid(bl)) { cx.fillStyle = `rgba(60,110,175,${0.32 * bl.wet + 0.08})`; cx.beginPath(); cx.arc(bl.x, bl.y, bl.r, 0, Math.PI * 2); cx.fill(); cx.fillStyle = 'rgba(220,240,255,.8)'; cx.beginPath(); cx.arc(bl.x - bl.r * 0.35, bl.y - bl.r * 0.4, bl.r * 0.16, 0, Math.PI * 2); cx.fill(); } }); drawRain(performance.now() / 1000); }
  drawArcs();
  drawUmbrellas(w);
  drawGull();
  drawBarBreak();
  drawJura(w);
  if (w.kz) { w.kz.forEach((p, h) => { if (p.fog) { cx.save(); cx.beginPath(); cx.rect(h ? FIELD.W / 2 : -FIELD.MX, -FIELD.MY, h ? FIELD.W / 2 + FIELD.MX : FIELD.W / 2 + FIELD.MX, STAGE_H); cx.clip(); drawFog(); cx.restore(); } }); }
  else if (w.fog) drawFog();
  if (w.dark) drawDark(w);
  // anillos de impacto
  fx.dust.forEach(p => { const k = p.t / p.life; cx.globalAlpha = (1 - k) * 0.55; cx.fillStyle = '#a58a5a'; cx.beginPath(); cx.arc(p.x, p.y, p.r * (0.6 + k), 0, Math.PI * 2); cx.fill(); cx.globalAlpha = 1; });
  fx.rings.forEach(r => { if (r.t < 0) return; const k = r.t / 0.4; cx.globalAlpha = (1 - k) * 0.8; cx.strokeStyle = '#fff'; cx.lineWidth = 3 * (1 - k); cx.beginPath(); cx.arc(r.x, r.y, 10 + k * 40 * r.v, 0, Math.PI * 2); cx.stroke(); });
  cx.globalAlpha = 1;
  // apuntado
  if (M.drag && M.aim) drawAim();
  if (M.fake) drawFake();
  // confeti
  fx.conf.forEach(c => {
    cx.save(); cx.translate(c.x, c.y); cx.globalAlpha = Math.min(1, c.life);
    if (c.coin) { cx.fillStyle = '#ffd166'; cx.strokeStyle = '#a56a00'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(0, 0, 7, 7 * Math.abs(Math.cos(c.life * 9)) + 1, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); }
    else if (c.spark) { cx.fillStyle = c.c; cx.beginPath(); cx.arc(0, 0, 3, 0, Math.PI * 2); cx.fill(); }
    else { cx.rotate(c.rot); cx.fillStyle = c.c; cx.fillRect(-5, -3, 10, 6); }
    cx.restore();
  });
  drawPops();
  if (M.pen) drawPenMeter();
  if (M.phase === 'replay' && M.replay) { cx.save(); cx.fillStyle = 'rgba(0,0,0,.55)'; cx.beginPath(); cx.roundRect(FIELD.W / 2 - 120, 8, 240, 40, 12); cx.fill(); cx.fillStyle = '#ff4d6d'; cx.beginPath(); cx.arc(FIELD.W / 2 - 88, 28, 8 + 2 * Math.sin(performance.now() / 150), 0, 6.3); cx.fill(); cx.fillStyle = '#fff'; cx.font = '900 22px "Segoe UI",Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('REPETICIÓN', FIELD.W / 2 + 10, 29); cx.fillStyle = '#ff4d6d'; cx.fillRect(FIELD.W / 2 - 110, 44, 220 * M.replay.i / Math.max(1, M.replay.fr.length - 1), 3); cx.restore(); }
  cx.globalAlpha = 1;
}

function drawBarBreak() {
  for (const p of fx.bars) {
    const k = p.t, n = 14, len = p.b - p.a;
    cx.save(); cx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const y0 = p.a + len * i / n, y1 = p.a + len * (i + 1) / n, my = (y0 + y1) / 2, dir = (i % 2 ? 1 : -1), s = (p.left ? 1 : -1);
      const ox = s * (k * 70 * (0.5 + (i * 37 % 10) / 10)), oy = (my - (p.a + p.b) / 2) * k * 0.6 + dir * k * 24, rot = dir * k * 3.2;
      cx.save(); cx.translate(p.x + ox, my + oy); cx.rotate(rot); cx.globalAlpha = Math.max(0, 1 - k * 1.15);
      cx.strokeStyle = '#ff4d6d'; cx.shadowColor = '#ff4d6d'; cx.shadowBlur = 14 * (1 - k); cx.lineWidth = 7 * (1 - k * 0.6);
      cx.beginPath(); cx.moveTo(0, -(y1 - y0) / 2); cx.lineTo(0, (y1 - y0) / 2); cx.stroke(); cx.restore();
    }
    for (let i = 0; i < 16; i++) {   // chispas
      const a = i * 2.4 + 0.5, d = 14 + k * (60 + (i * 53 % 40)), yy = p.a + len * ((i * 0.618) % 1);
      cx.globalAlpha = Math.max(0, 1 - k * 1.3); cx.fillStyle = i % 3 ? '#ffd1d9' : '#fff';
      const sx = p.x + (p.left ? 1 : -1) * Math.abs(Math.cos(a)) * d, sy = yy + Math.sin(a) * d * 0.5, sz = 3.2 * (1 - k);
      cx.beginPath(); cx.moveTo(sx, sy - sz * 2); cx.lineTo(sx + sz, sy); cx.lineTo(sx, sy + sz * 2); cx.lineTo(sx - sz, sy); cx.closePath(); cx.fill();
    }
    cx.globalAlpha = Math.max(0, 0.7 - k * 1.4); cx.strokeStyle = '#fff'; cx.lineWidth = 3 * (1 - k); cx.beginPath(); cx.ellipse(p.x, (p.a + p.b) / 2, 18 + k * 50, len / 2 * (0.6 + k * 0.5), 0, 0, Math.PI * 2); cx.stroke();
    cx.restore();
  }
}
function dinoPrint(c, x, y, s, rot, fill) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.fillStyle = fill;
  c.beginPath(); c.ellipse(0, 14, 15, 17, 0, 0, Math.PI * 2); c.fill();
  [[-22, -8, -0.45], [0, -22, 0], [22, -8, 0.45]].forEach(([tx, ty, a]) => { c.save(); c.translate(tx, ty); c.rotate(a); c.beginPath(); c.ellipse(0, 0, 8, 15, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(-4, -12); c.lineTo(0, -26); c.lineTo(4, -12); c.closePath(); c.fill(); c.restore(); });
  c.restore();
}
function drawJura(w) {
  if (!w.jura || !M) return;
  const t = performance.now() / 1000;
  (M.prints || []).forEach(p => { cx.globalAlpha = 0.28; dinoPrint(cx, p.x, p.y, 2.4, p.rot, '#1a2a12'); cx.globalAlpha = 1; });
  const sp = M.stomp; if (!sp) return;
  const k = sp.t ? Math.min(1, sp.t / 0.9) : 0, pulse = 0.5 + 0.5 * Math.sin(t * 8 + k * 10);
  cx.save();
  cx.strokeStyle = `rgba(255,${120 - 60 * k | 0},60,${0.55 + 0.35 * pulse})`; cx.lineWidth = 4; cx.setLineDash([14, 10]); cx.lineDashOffset = -t * 30;
  cx.beginPath(); cx.arc(sp.x, sp.y, sp.r * (1.1 - 0.1 * k), 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]);
  const g2 = cx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r); g2.addColorStop(0, `rgba(255,90,40,${0.18 + 0.2 * k})`); g2.addColorStop(1, 'rgba(255,90,40,0)'); cx.fillStyle = g2; cx.beginPath(); cx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); cx.fill();
  cx.globalAlpha = 0.5 + 0.4 * pulse; dinoPrint(cx, sp.x, sp.y - (1 - k) * 40, 2.2 + (1 - k) * 0.9, sp.rot, `rgba(255,${150 - 90 * k | 0},70,.9)`);
  cx.restore();
}
function planStomp() {
  const w = M.w; let best = null;
  for (let i = 0; i < 10; i++) {
    const x = 200 + Math.random() * (FIELD.W - 400), y = 120 + Math.random() * (FIELD.H - 240);
    const n = w.bodies.filter(b => Math.hypot(b.x - x, b.y - y) < 190).length + Math.random() * 1.5;
    if (!best || n > best.n) best = { x, y, n };
  }
  M.stomp = { x: best.x, y: best.y, r: 120, t: 0, rot: (Math.random() - 0.5) * 0.6 + (Math.random() < 0.5 ? 0 : Math.PI) };
  fx.pops.push({ x: best.x, y: best.y - 50, txt: '🦖 ¡SE OYEN PISADAS!', t: 0, col: '#ffb347', big: 1.2 }); sfx.stomp(0.45);
  logEv('🦖', 'Un T-Rex se acerca: pisará la zona marcada en la próxima jugada');
}
function doStomp() {
  const sp = M.stomp, w = M.w; if (!sp) return; M.stomp = null;
  const R = sp.r * 1.7;
  w.bodies.forEach(b => {
    if (b.frozen || b.rockFix) return;
    let dx = b.x - sp.x, dy = b.y - sp.y, d = Math.hypot(dx, dy);
    if (d > R + b.r) return; if (d < 1) { const a = Math.random() * 6.28; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
    const f = 1 - Math.min(1, d / R), dv = (b.kind === 'ball' ? 760 : 560) * (0.35 + 0.65 * f);
    b.vx += dx / d * dv; b.vy += dy / d * dv;
  });
  (M.prints = M.prints || []).push({ x: sp.x, y: sp.y, rot: sp.rot }); if (M.prints.length > 4) M.prints.shift();
  for (let i = 0; i < 3; i++) fx.rings.push({ x: sp.x, y: sp.y, t: -i * 0.07, v: 2 + i * 0.7 });
  for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 260; fx.dust.push({ x: sp.x, y: sp.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.6 + Math.random() * 0.5, r: 4 + Math.random() * 7 }); }
  fx.shake = 0.9; sfx.stomp(1); fx.pops.push({ x: sp.x, y: sp.y - 40, txt: '🦖 ¡PISADA!', t: 0, col: '#ffd166', big: 1.5 });
}
function drawUmbrellas(w) {
  if (!w.umb) return;
  const tc = t => { const C = M && M.codes && COUNTRIES[M.codes[t]]; return C ? (C.c1 === C.c2 ? [C.c1, '#fff4e6'] : [C.c1, C.c2]) : (t ? ['#27b6e8', '#fff4e6'] : ['#ff4d5e', '#fff4e6']); };   // colores de la bandera de cada equipo
  const pal = [tc(0), tc(1)];
  for (const u of w.umb) {
    const [a, b] = pal[u.c];
    cx.save(); cx.translate(u.x, u.y);
    const oct = (rad, ox = 0, oy = 0) => { cx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4; cx.lineTo(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad); } cx.closePath(); };
    cx.fillStyle = 'rgba(0,0,0,.22)'; oct(u.r, 10, 12); cx.fill();
    for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? b : a; const a0 = (i + 0.5) * Math.PI / 4, a1 = (i + 1.5) * Math.PI / 4; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.cos(a0) * u.r, Math.sin(a0) * u.r); cx.lineTo(Math.cos(a1) * u.r, Math.sin(a1) * u.r); cx.closePath(); cx.fill(); }
    cx.strokeStyle = 'rgba(0,0,0,.28)'; cx.lineWidth = 2; oct(u.r); cx.stroke();
    cx.strokeStyle = 'rgba(0,0,0,.14)'; cx.lineWidth = 1; for (let i = 0; i < 8; i++) { const a0 = (i + 0.5) * Math.PI / 4; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.cos(a0) * u.r, Math.sin(a0) * u.r); cx.stroke(); }
    cx.fillStyle = '#ffd84a'; cx.strokeStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.arc(0, 0, u.r * 0.1, 0, Math.PI * 2); cx.fill(); cx.stroke();
    cx.restore();
  }
}
/* porterías de Ensueño (suben y bajan) y de Oscuro (brillan): se dibujan cada fotograma */
function drawDynGoals(w, glow) {
  const g = w.geo, W = FIELD.W, pocket = FIELD.pocket, t = performance.now() / 1000;
  [[true, g.lt, g.lb], [false, g.rt, g.rb]].forEach(([left, a, b]) => {
    const x0 = left ? -pocket : W;
    cx.save();
    if (glow) { cx.shadowColor = '#7fe8ff'; cx.shadowBlur = 26 + 6 * Math.sin(t * 3); }
    cx.fillStyle = glow ? 'rgba(20,50,70,.9)' : 'rgba(10,20,34,.8)'; cx.fillRect(x0, a, pocket, b - a);
    cx.shadowBlur = 0;
    cx.save(); cx.beginPath(); cx.rect(x0, a, pocket, b - a); cx.clip();
    cx.strokeStyle = glow ? 'rgba(170,240,255,.55)' : 'rgba(255,255,255,.3)'; cx.lineWidth = 1;
    for (let k = -(b - a); k < pocket + (b - a); k += 11) { cx.beginPath(); cx.moveTo(x0 + k, a); cx.lineTo(x0 + k - (b - a), b); cx.moveTo(x0 + k, a); cx.lineTo(x0 + k + (b - a), b); cx.stroke(); }
    cx.restore();
    if (glow) { cx.shadowColor = '#7fe8ff'; cx.shadowBlur = 22; }
    cx.strokeStyle = glow ? '#e8fbff' : 'rgba(255,255,255,.95)'; cx.lineWidth = 5; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(left ? 0 : W, a); cx.lineTo(left ? -pocket : W + pocket, a); cx.lineTo(left ? -pocket : W + pocket, b); cx.lineTo(left ? 0 : W, b); cx.stroke();
    cx.shadowBlur = 0;
    [a, b].forEach(y => { const px = left ? 0 : W; shadowEllipse(cx, px, y, 9, 0.7); cx.fillStyle = glow ? '#fff' : '#e8eef6'; if (glow) { cx.shadowColor = '#7fe8ff'; cx.shadowBlur = 18; } cx.beginPath(); cx.arc(px, y, FIELD.post + 1, 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0; });
    cx.restore();
  });
}
/* Oscuro: todo se oscurece salvo el balón y las porterías, que brillan */
function drawDark(w) {
  const tr = cx.getTransform(); cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.fillStyle = 'rgba(2,4,14,.86)'; cx.fillRect(0, 0, cv.width, cv.height);
  cx.setTransform(tr);
  drawDynGoals(w, true);
  const now = performance.now(), t = now / 1000;
  // medio segundo de luz: esquinas golpeadas por el balón y jugadores tocados por él
  if (M.litP) { M.litP = M.litP.filter(l => now - l.t < 500); M.litP.forEach(l => { const k = 1 - (now - l.t) / 500, R = 70, gr = cx.createRadialGradient(l.x, l.y, 4, l.x, l.y, R); gr.addColorStop(0, `rgba(255,255,255,${0.95 * k})`); gr.addColorStop(0.4, `rgba(150,235,255,${0.5 * k})`); gr.addColorStop(1, 'rgba(150,235,255,0)'); cx.fillStyle = gr; cx.beginPath(); cx.arc(l.x, l.y, R, 0, Math.PI * 2); cx.fill(); }); }
  if (M.litC) w.bodies.forEach(b => {
    const lt = M.litC[b.id]; if (b.kind !== 'cap' || lt == null) return;
    const age = now - lt; if (age >= 500) { delete M.litC[b.id]; return; }
    const k = 1 - age / 500, gr = cx.createRadialGradient(b.x, b.y, b.r * 0.5, b.x, b.y, b.r * 2.6);
    gr.addColorStop(0, `rgba(255,250,210,${0.55 * k})`); gr.addColorStop(1, 'rgba(255,250,210,0)'); cx.fillStyle = gr; cx.beginPath(); cx.arc(b.x, b.y, b.r * 2.6, 0, Math.PI * 2); cx.fill();
    cx.save(); cx.globalAlpha = k; drawCap(cx, b.x, b.y, b.r, M.kits[b.team], { num: b.num }); cx.restore();
  });
  w.balls.forEach(bl => {
    if (ballHid(bl)) return;
    const R = bl.r * 4.2 * (1 + 0.05 * Math.sin(t * 5)), gr = cx.createRadialGradient(bl.x, bl.y, bl.r * 0.4, bl.x, bl.y, R);
    gr.addColorStop(0, 'rgba(255,250,200,.75)'); gr.addColorStop(0.35, 'rgba(255,240,160,.28)'); gr.addColorStop(1, 'rgba(255,240,160,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(bl.x, bl.y, R, 0, Math.PI * 2); cx.fill();
    drawBall(cx, bl);
  });
}
/* Lluvioso: charcos (debajo de los jugadores) y lluvia ligera (una sola pasada de líneas, casi gratis) */
function drawPuddles(w) {
  const t = performance.now() / 1000;
  w.pud.forEach((z, i) => {
    const rx = z.r * 1.2, ry = z.r * 0.85;
    const g = cx.createRadialGradient(z.x - rx * 0.2, z.y - ry * 0.3, 2, z.x, z.y, rx);
    g.addColorStop(0, 'rgba(150,200,235,.75)'); g.addColorStop(1, 'rgba(70,120,175,.65)');
    cx.fillStyle = g; cx.beginPath(); cx.ellipse(z.x, z.y, rx, ry, 0, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = 'rgba(225,242,255,.55)'; cx.lineWidth = 1.5; cx.stroke();
    const k = ((t * 0.7 + i * 0.37) % 1);   // una onda que crece y se apaga
    cx.strokeStyle = `rgba(235,247,255,${0.6 * (1 - k)})`; cx.lineWidth = 1.2; cx.beginPath(); cx.ellipse(z.x + (i - 1) * 6, z.y, rx * 0.8 * k + 3, ry * 0.8 * k + 2, 0, 0, Math.PI * 2); cx.stroke();
  });
}
function drawRain(t) {
  cx.save(); cx.strokeStyle = 'rgba(205,225,245,.38)'; cx.lineWidth = 1.1; cx.beginPath();
  const W = FIELD.W, H = FIELD.H;
  for (let i = 0; i < 70; i++) {
    const sx = (i * 137.5) % W, sp = 520 + (i % 5) * 70, y = ((i * 53 + t * sp) % (H + 40)) - 20, x = (sx + y * 0.18) % W;
    cx.moveTo(x, y); cx.lineTo(x - 3.2, y + 14);
  }
  cx.stroke(); cx.restore();
}
/* Ensueño: brillitos que titilan sobre el césped rosa */
const DREAM_SPARKS = (() => { const r = seeded(7), a = []; for (let i = 0; i < 46; i++) a.push([r() * FIELD.W, r() * FIELD.H, 3 + r() * 5, r() * 6.28, 0.8 + r() * 1.6]); return a; })();
function drawSparks(t) {
  cx.save(); cx.fillStyle = '#fff'; cx.shadowColor = '#fff'; cx.shadowBlur = 6;
  DREAM_SPARKS.forEach(([x, y, s, ph, sp]) => {
    const k = Math.max(0, Math.sin(t * sp + ph)); if (k < 0.05) return;
    const r = s * k; cx.globalAlpha = 0.85 * k;
    cx.beginPath(); cx.moveTo(x, y - r * 1.6); cx.lineTo(x + r * 0.32, y - r * 0.32); cx.lineTo(x + r * 1.6, y); cx.lineTo(x + r * 0.32, y + r * 0.32); cx.lineTo(x, y + r * 1.6); cx.lineTo(x - r * 0.32, y + r * 0.32); cx.lineTo(x - r * 1.6, y); cx.lineTo(x - r * 0.32, y - r * 0.32); cx.closePath(); cx.fill();
  });
  cx.restore();
}
function drawField(w) {
  const t = performance.now() / 1000;
  { const on = !!(w.noGoal && w.ngOff && !(w.ngOff[0] && w.ngOff[1])); if (document.body.classList.contains('ng-on') !== on) document.body.classList.toggle('ng-on', on); }
  if (w.tall) for (const s of [0, 1]) if (w.tall[s]) { const left = physSide(w, s) === 0; cx.save(); cx.fillStyle = 'rgba(30,110,40,.38)'; cx.fillRect(left ? 0 : FIELD.W - 165, 125, 165, 390); cx.restore(); }
  if (w.noGoal || w.lock[0] || w.lock[1]) {
    const g = w.geo;
    [[0, g.lt, g.lb], [FIELD.W, g.rt, g.rb]].forEach(([x, a, b], gi) => {
      if (!w.noGoal && !w.lock[gi]) return;
      if (w.noGoal && w.ngOff && w.ngOff[gi] && !w.lock[gi]) return;
      cx.save(); cx.lineCap = 'round'; cx.lineWidth = w.noGoal ? 10 : 7; cx.strokeStyle = `rgba(255,77,109,${0.7 + 0.3 * Math.sin(t * 6)})`; cx.shadowColor = '#ff4d6d'; cx.shadowBlur = 20;
      cx.beginPath(); cx.moveTo(x, a); cx.lineTo(x, b); cx.stroke(); cx.restore();
    });
  }
  if (w.zones) w.zones.forEach((z, zi) => {
    const fl = 0.85 + 0.15 * Math.sin(t * 9 + zi * 2);
    const g = cx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r * 1.15 * fl);
    g.addColorStop(0, 'rgba(255,240,150,.95)'); g.addColorStop(0.35, 'rgba(255,140,20,.8)'); g.addColorStop(0.75, 'rgba(220,40,0,.45)'); g.addColorStop(1, 'rgba(120,0,0,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(z.x, z.y, z.r * 1.2, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = 'rgba(255,220,90,.85)';
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + t * 1.5 + zi, rr = z.r * (0.25 + 0.45 * ((t * 0.8 + k * 0.17) % 1)); cx.globalAlpha = 1 - ((t * 0.8 + k * 0.17) % 1); cx.beginPath(); cx.arc(z.x + Math.cos(a) * rr * 0.8, z.y + Math.sin(a) * rr * 0.8 - rr * 0.4, 3.2, 0, Math.PI * 2); cx.fill(); }
    cx.globalAlpha = 1;
  });
  if (w.kz) w.kz.forEach((p, h) => { cx.save(); cx.beginPath(); cx.rect(h ? FIELD.W / 2 : -FIELD.MX, -FIELD.MY, FIELD.W / 2 + FIELD.MX, STAGE_H); cx.clip(); drawFieldFx(p, t); cx.restore(); });
  else drawFieldFx(w, t);
}
function drawFieldFx(w, t) {
  if (w.bumpers) w.bumpers.forEach(p => {
    const k = fx.bump && fx.bump[p[0] + ',' + p[1]] > 0 ? 1 : 0;
    const g = cx.createRadialGradient(p[0] - 8, p[1] - 8, 2, p[0], p[1], p[2] + 4);
    g.addColorStop(0, k ? '#fff' : '#ff9bf5'); g.addColorStop(0.5, k ? '#ffe36a' : '#e12bd0'); g.addColorStop(1, '#4a0a6a');
    shadowEllipse(cx, p[0], p[1], p[2], 0.8);
    cx.shadowColor = '#ff4bf0'; cx.shadowBlur = k ? 30 : 14; cx.fillStyle = g; cx.beginPath(); cx.arc(p[0], p[1], p[2], 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0;
    cx.lineWidth = 3; cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,.85)'; cx.font = '900 18px Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('★', p[0], p[1] + 1);
  });
  if (w.pull < 0) {
    for (let k = 0; k < 4; k++) { const ph = ((t * 0.5 + k / 4) % 1); cx.strokeStyle = `rgba(130,230,255,${0.5 * (1 - ph)})`; cx.lineWidth = 3; cx.beginPath(); cx.arc(FIELD.W / 2, FIELD.H / 2, 14 + ph * 300, 0, Math.PI * 2); cx.stroke(); }
    const cg = cx.createRadialGradient(FIELD.W / 2, FIELD.H / 2, 2, FIELD.W / 2, FIELD.H / 2, 26); cg.addColorStop(0, '#fff'); cg.addColorStop(0.4, '#7ae6ff'); cg.addColorStop(1, 'rgba(120,80,255,0)');
    cx.fillStyle = cg; cx.beginPath(); cx.arc(FIELD.W / 2, FIELD.H / 2, 26, 0, Math.PI * 2); cx.fill();
  }
  if (w.pull > 0) {
    // ondas que se encogen hacia el centro: el agujero atrae
    for (let k = 0; k < 4; k++) { const ph = ((t * 0.4 + k / 4) % 1), r = 58 + (1 - ph) * 250; cx.strokeStyle = `rgba(200,160,255,${(0.42 * Math.sin(ph * Math.PI)).toFixed(3)})`; cx.lineWidth = 2 + 3 * ph; cx.beginPath(); cx.arc(FIELD.W / 2, FIELD.H / 2, r, 0, Math.PI * 2); cx.stroke(); }
  }
  if (fx.bump) for (const k in fx.bump) { fx.bump[k] -= 0.016; }
  // bandera de cada equipo, pequeña, encima de su portería
  if (M && M.codes) {
    const g = w.geo;
    [[0, g.lt, g.lb], [1, g.rt, g.rb]].forEach(([gi, a, b]) => {
      const im = FLAGS[M.codes[physSide(w, gi)]]; if (!im || !im.width) return;
      const pk2 = FIELD.pocket, fw = 34, fh = fw * im.height / im.width, cx0 = gi === 0 ? -pk2 / 2 : FIELD.W + pk2 / 2, cy0 = a - 8 - fh / 2;
      cx.save(); cx.globalAlpha = 0.92; cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 6; cx.drawImage(im, cx0 - fw / 2, cy0 - fh / 2, fw, fh);
      cx.shadowBlur = 0; cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = 2; cx.strokeRect(cx0 - fw / 2, cy0 - fh / 2, fw, fh); cx.restore();
    });
  }
  if (M && M.windFx && M.windFx.t > 0) M.windFx.t -= 0.016;
  const wt = w.tilt || (M && M.windFx && M.windFx.t > 0 ? { ang: M.windFx.dir > 0 ? 0 : Math.PI, fx: 1 } : null);
  if (wt) {
    const ux = Math.cos(wt.ang), uy = Math.sin(wt.ang);
    cx.save(); cx.globalAlpha = 0.28; cx.fillStyle = (M && M.windOn) || wt.fx ? '#bff4ff' : '#35e0ff'; const wA = (M && M.windOn) || wt.fx ? 2.2 : 1;
    for (let i = -5; i <= 5; i++) for (let j = -3; j <= 3; j++) {
      const k = ((t * 0.9 + (i + j * 3) * 0.13) % 1);
      const px = FIELD.W / 2 + i * 90 + ux * (k - 0.5) * 70, py = FIELD.H / 2 + j * 90 + uy * (k - 0.5) * 70;
      cx.globalAlpha = Math.min(0.75, 0.3 * wA * Math.sin(k * Math.PI));
      cx.save(); cx.translate(px, py); cx.rotate(wt.ang); cx.beginPath(); cx.moveTo(14, 0); cx.lineTo(-8, 9); cx.lineTo(-3, 0); cx.lineTo(-8, -9); cx.closePath(); cx.fill(); cx.restore();
    }
    cx.restore();
  }
}
function drawGlow(b) {
  const col = chgCol(b.chg), R = b.r * (2 + 0.5 * Math.min(5, b.chg)), t = performance.now() / 1000;
  const g = cx.createRadialGradient(b.x, b.y, b.r * 0.5, b.x, b.y, R * (1 + 0.08 * Math.sin(t * 14)));
  g.addColorStop(0, col); g.addColorStop(0.4, col + 'aa'); g.addColorStop(1, col + '00');
  cx.globalAlpha = 0.85; cx.fillStyle = g; cx.beginPath(); cx.arc(b.x, b.y, R * 1.1, 0, Math.PI * 2); cx.fill(); cx.globalAlpha = 1;
  if (b.chg >= 2) { cx.strokeStyle = col; cx.lineWidth = 2.5; cx.shadowColor = col; cx.shadowBlur = 14; for (let k = 0; k < Math.min(5, b.chg); k++) { const a = t * 6 + k * 2.1; cx.beginPath(); cx.arc(b.x, b.y, b.r * 1.5 + k * 3, a, a + 1.1); cx.stroke(); } cx.shadowBlur = 0; }
}
function drawArcs() {
  fx.arcs.forEach(a => {
    const A = capById(a.a), B = capById(a.b); if (!A || !B) return;
    cx.save(); cx.globalAlpha = 1 - a.t / 0.35; cx.strokeStyle = '#fff6a0'; cx.lineWidth = 4; cx.shadowColor = '#ffd166'; cx.shadowBlur = 20; cx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      cx.beginPath(); cx.moveTo(A.x, A.y);
      const n = 7; for (let i = 1; i < n; i++) { const k = i / n; cx.lineTo(A.x + (B.x - A.x) * k + (Math.random() - 0.5) * 26, A.y + (B.y - A.y) * k + (Math.random() - 0.5) * 26); }
      cx.lineTo(B.x, B.y); cx.stroke(); cx.lineWidth = 2; cx.strokeStyle = '#fff';
    }
    cx.restore();
  });
}
function drawPops() {
  fx.pops.forEach(p => {
    const k = p.t / 1.1, sc = Math.min(1.25, 0.8 + (p.big || 1) * 0.2) * (k < 0.12 ? 0.7 + k / 0.12 * 0.3 : 1);
    cx.save(); cx.translate(p.x, p.y - k * 40); cx.scale(sc, sc); cx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    cx.font = '800 26px Bahnschrift,"Segoe UI Semibold","Trebuchet MS",Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.lineJoin = 'round'; cx.lineWidth = 6; cx.strokeStyle = 'rgba(10,5,0,.85)'; cx.strokeText(p.txt, 0, 1);
    cx.shadowColor = p.col; cx.shadowBlur = 18; cx.fillStyle = p.col; cx.fillText(p.txt, 0, 1);
    cx.shadowBlur = 8; cx.fillText(p.txt, 0, 1); cx.shadowBlur = 0;
    cx.restore();
  });
}
let fogCv = null;
function drawFog() {
  const w = M.w, f = QUAL ? 0.33 : 0.5, W = Math.ceil(cv.width * f), H = Math.ceil(cv.height * f);
  if (!fogCv) fogCv = document.createElement('canvas');
  if (fogCv.width !== W || fogCv.height !== H) { fogCv.width = W; fogCv.height = H; }
  const c = fogCv.getContext('2d'), k = view.dpr * f * view.S * ZM.k, t = performance.now() / 1000;
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
  c.fillStyle = 'rgba(196,208,220,.95)'; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => { const X = (ZM.k * (view.ox + x * view.S) + ZM.x) * view.dpr * f, Y = (ZM.k * (view.oy + y * view.S) + ZM.y) * view.dpr * f, R = r * k; const g = c.createRadialGradient(X, Y, R * 0.35, X, Y, R); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fill(); };
  w.bodies.forEach(b => { if (b.kind === 'ball') hole(b.x, b.y, 130); else if (M.human[b.team]) hole(b.x, b.y, 105); });
  c.globalCompositeOperation = 'source-over';
  const tr = cx.getTransform(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.drawImage(fogCv, 0, 0, cv.width, cv.height); cx.setTransform(tr);
}
function drawAim() {
  const c = capById(M.drag.id), a = M.aim, pw = M.drag.power;
  // goma elástica hacia el puntero
  cx.lineCap = 'round';
  cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 3; cx.setLineDash([2, 8]);
  cx.beginPath(); cx.moveTo(c.x, c.y); cx.lineTo(M.ptr.x, M.ptr.y); cx.stroke(); cx.setLineDash([]);
  // anillo de potencia
  const col = pw < 0.5 ? '#35e0ff' : pw < 0.85 ? '#c6ff3d' : '#ff4d6d';
  cx.beginPath(); cx.arc(c.x, c.y, c.r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pw); cx.lineWidth = 6; cx.strokeStyle = col; cx.shadowColor = col; cx.shadowBlur = 14; cx.stroke(); cx.shadowBlur = 0;
  if (M.blind && M.blind[c.team] > 0) return;   // ceguera: sin visión de juego (ni trayectoria, ni flechita, ni abanico)
  // trayectoria
  cx.strokeStyle = col; cx.lineWidth = 4; cx.shadowColor = col; cx.shadowBlur = 10; cx.setLineDash([1, 12]);
  cx.beginPath(); a.pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.stroke(); cx.setLineDash([]); cx.shadowBlur = 0;
  if (a.ballPts && a.ballPts.length > 1) {
    // zona de precisión: abanico semitransparente con las direcciones posibles del balón
    const p0 = a.ballPts[0], p1 = a.ballPts[1], d0 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    const half = Math.min(c.poison ? 1.6 : 1.1, 2 * (c.poison ? POISON_DEV : (c.dev || 0)));
    if (half > 0.012) {
      let Lw = 0; for (let i = 1; i < a.ballPts.length; i++) Lw += Math.hypot(a.ballPts[i][0] - a.ballPts[i - 1][0], a.ballPts[i][1] - a.ballPts[i - 1][1]);
      Lw = Math.max(90, Math.min(260, Lw));
      const gr = cx.createRadialGradient(p0[0], p0[1], 0, p0[0], p0[1], Lw);
      gr.addColorStop(0, 'rgba(255,255,255,.34)'); gr.addColorStop(1, 'rgba(255,255,255,.08)');
      cx.fillStyle = gr; cx.beginPath(); cx.moveTo(p0[0], p0[1]); cx.arc(p0[0], p0[1], Lw, d0 - half, d0 + half); cx.closePath(); cx.fill();
      cx.strokeStyle = 'rgba(255,255,255,.4)'; cx.lineWidth = 1.5; cx.beginPath();
      cx.moveTo(p0[0] + Math.cos(d0 - half) * Lw, p0[1] + Math.sin(d0 - half) * Lw); cx.lineTo(p0[0], p0[1]); cx.lineTo(p0[0] + Math.cos(d0 + half) * Lw, p0[1] + Math.sin(d0 + half) * Lw); cx.stroke();
    }
    cx.strokeStyle = '#fff'; cx.lineWidth = 4; cx.shadowColor = '#fff'; cx.shadowBlur = 8; cx.setLineDash([2, 10]);
    cx.beginPath(); a.ballPts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.stroke(); cx.setLineDash([]); cx.shadowBlur = 0;
    const n = a.ballPts.length, q = a.ballPts[n - 1], q0 = a.ballPts[Math.max(0, n - 3)], an = Math.atan2(q[1] - q0[1], q[0] - q0[0]);
    if (!a.full || true) { cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(q[0] + Math.cos(an) * 14, q[1] + Math.sin(an) * 14); cx.lineTo(q[0] + Math.cos(an + 2.5) * 12, q[1] + Math.sin(an + 2.5) * 12); cx.lineTo(q[0] + Math.cos(an - 2.5) * 12, q[1] + Math.sin(an - 2.5) * 12); cx.closePath(); cx.fill(); }
  }
  if (a.hit) {
    cx.beginPath(); cx.arc(a.hit.x, a.hit.y, c.r, 0, Math.PI * 2); cx.lineWidth = 2; cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.setLineDash([5, 6]); cx.stroke(); cx.setLineDash([]);
  }
}
function drawFake() {
  const c = capById(M.fake.id), L = 120 + 200 * M.fake.power;
  cx.strokeStyle = '#ff4d6d'; cx.lineWidth = 4; cx.setLineDash([1, 12]); cx.lineCap = 'round'; cx.shadowColor = '#ff4d6d'; cx.shadowBlur = 10;
  cx.beginPath(); cx.moveTo(c.x, c.y); cx.lineTo(c.x + Math.cos(M.fake.ang) * L, c.y + Math.sin(M.fake.ang) * L); cx.stroke(); cx.setLineDash([]); cx.shadowBlur = 0;
}

/* ===================== HUD ===================== */
function dots(n, max, cls) { let s = ''; for (let i = 0; i < max; i++) s += `<i class="${i < n ? 'on ' : ''}${cls}"></i>`; return s; }
function matchTags() {
  const S = M.S, t = [];
  if (S.field !== 'normal') t.push(FIELDS[S.field].icon + ' ' + FIELDS[S.field].n.toUpperCase());
  if (S.ballType !== 'normal') t.push(BALLS[S.ballType].icon + ' ' + BALLS[S.ballType].n.toUpperCase());
  if (S.nBalls > 1) t.push('⚽×' + S.nBalls);
  return t;
}
function hudScore() {
  const el = $('#hud-score'); if (!el || !M) return;
  const hm = $('#hud-money'); if (hm) hm.innerHTML = M.run ? '💰 <b>' + (G.debug ? '∞' : '$' + (G.money + (M.cash || 0))) + '</b>' + (M.cash ? '<small>+$' + M.cash + ' este partido</small>' : '') : '';
  const rb = $('#hud-roul'); if (rb) { rb.style.display = M.run && !M.so ? '' : 'none'; rb.disabled = !(M.phase === 'aim' && M.human[M.turn]); }
  const sb = $('#hud-shop'); if (sb) { sb.style.display = M.run && !M.so ? '' : 'none'; sb.disabled = !(M.phase === 'aim' && M.human[M.turn]); }
  const act = M.phase === 'aim' && M.human[M.turn], over = M.phase === 'over';
  const maxS = M.sudden ? 1 : null;
  const label = M.so ? '' : M.phase === 'pen' ? '🥅 PENALTI' : act ? (M.S.j2 ? 'TURNO J' + (M.turn + 1) : 'TU TURNO') : M.phase === 'ai' ? 'RIVAL…' : M.phase === 'move' ? '⚽' : M.phase === 'goal' ? '¡GOL!' : '';
  const tags = matchTags();
  const chainTxt = M.extra[M.turn] > 0 ? ` · ✌️+${M.extra[M.turn]}` : '';
  el.innerHTML = `
    <div class="sb-round">${matchTitle()}${M.sudden ? ' · MUERTE SÚBITA' : ''}${tags.length ? ' · ' + tags.join(' · ') : ''}${M.w.noGoal ? ' · 🔒 SAQUE' : ''}</div>
    <div class="sb-main">
      <div class="sb-team a ${M.turn === 0 && !over ? 'active' : ''}">${flagSVG(M.codes[0])}<b>${scode(M.codes[0])}</b></div>
      <div class="sb-score"><span>${M.score[0]}</span><i>:</i><span>${M.score[1]}</span></div>
      <div class="sb-team b ${M.turn === 1 && !over ? 'active' : ''}"><b>${scode(M.codes[1])}</b>${flagSVG(M.codes[1])}</div>
    </div>
    ${M.so ? soMarks() : `<div class="sb-turns"><span class="dots l">${dots(M.shots[0], maxS || M.maxTurns[0], 'a')}</span><em>${label}${chainTxt}</em><span class="dots r">${dots(M.shots[1], maxS || M.maxTurns[1], 'b')}</span></div>`}`;
}
function soMarks() {
  const row = t => { const k = M.so.kicks[t], n = Math.max(5, k.length + (k.length >= 5 ? 1 : 0)); let h = ''; for (let i = 0; i < n; i++) h += `<i class="pm ${i < k.length ? (k[i] ? 'ok' : 'ko') : ''}">${i < k.length ? (k[i] ? '⚽' : '✖') : ''}</i>`; return h; };
  return `<div class="sb-turns so"><span class="dots l">${row(0)}</span><em>${M.phase === 'pen' ? '🥅 PENALTI' : ''}</em><span class="dots r">${row(1)}</span></div>`;
}
function statusHTML() {
  if (!M.hands[0].length && !M.hands[1].length && !M.buffs.length) return '';
  const st = [], me = handSide(), op = 1 - me;
  if (M.picking) st.push('👆 ' + PICK_HELP[M.picking.k]);
  if (M.boostId != null) st.push('💪 Supertiro preparado');
  for (const t of [0, 1]) { const nm = M.S.j2 ? tn(M.codes[t]) + ': ' : '';
    if (M.rkick && M.rkick[t] > 0) st.push('💀 ' + nm + 'pase de la muerte (' + M.rkick[t] + ')');
    if (M.blind && M.blind[t] > 0) st.push('🕶️ ' + nm + 'ceguera (' + M.blind[t] + ')');
    if (M.invis && M.invis[t] > 0) st.push('👻 ' + nm + 'invisibles (' + M.invis[t] + ')');
    if (M.offs && M.offs[t] > 0) st.push('🚩 ' + nm + 'fuera de juego ×' + M.offs[t]); }
  for (const t of [0, 1]) if (M.marr && M.marr[t] > 0) st.push('😈 ' + (M.S.j2 ? tn(M.codes[t]) + ': ' : '') + 'goles empujando ×2' + (M.marr[t] > 99 ? '' : ' (' + M.marr[t] + ' turnos)'));
  for (const t of [0, 1]) if (M.pase && M.pase[t] > 0) st.push('🤝 ' + (M.S.j2 ? tn(M.codes[t]) + ': ' : '') + 'goles de pase ×2' + (M.pase[t] > 99 ? '' : ' (' + M.pase[t] + ' turnos)'));
  for (const t of [0, 1]) if (M.cardBan && M.cardBan[t] > 0) st.push('🚫 ' + (M.S.j2 ? tn(M.codes[t]) : t === 0 ? 'Comodines' : 'Comodines rivales') + ' desactivados ×' + M.cardBan[t]);
  for (const t of [0, 1]) if (M.open[t] > 0) st.push('🥅 Portería abierta ×' + M.open[t]);
  for (const t of [0, 1]) if (M.gkHome[t] > 0) st.push('🧤 Portero a casa' + (M.gkHome[t] > 99 ? '' : ' ×' + M.gkHome[t]));
  if (M.star && M.star.left > 0) st.push('🌟 Superestrella: ' + (M.star.left > 99 ? 'todos los goles' : M.star.left + ' gol' + (M.star.left > 1 ? 'es' : '')) + ' x2');
  for (const t of [0, 1]) {
    const nm = M.S.j2 || M.hands[1].length ? tn(M.codes[t]) + ': ' : '';
    if (M.skip[t] > 0) st.push('🔔 ' + nm + 'sin turno');
    if (M.invert[t] > 0) st.push('🔄 ' + nm + 'invertido ×' + M.invert[t]);
    if (M.lockPlays[t] > 0) st.push('🛡️ ' + nm + 'portería blindada ×' + M.lockPlays[t]);
    if (M.extra[t] > 0) st.push('✌️ ' + nm + 'tiros extra: ' + M.extra[t]);
    if (M.windLeft[t] > 0) st.push('🌬️ ' + nm + 'viento ×' + M.windLeft[t]);
    if (M.pardon[t] > 0) st.push('😇 ' + nm + 'perdón ×' + M.pardon[t]);
    if (M.rush && M.rush[t]) st.push('🔥 ' + nm + 'arreón final (últimos ' + M.rush[t] + ' turnos ×2)');
    if (t === 0 && M.ng) st.push('🎲 próximo gol ' + (M.ng.mul > 1 ? '×' + M.ng.mul : '') + (M.ng.inv ? ' para el contrario' : ''));
    if (M.gold[t] && M.gold[t].left > 0) st.push('🌟 ' + nm + 'gol de oro ×' + M.gold[t].mul + ' (' + M.gold[t].left + ')');
    if (M.gw[t] < FIELD.gw - 1) st.push('🥅 ' + nm + 'mini portería');
  }
  (M.sent || []).forEach(x => st.push('🟨 ' + (x.team === 0 ? '' : 'Rival: ') + x.b.name + ' expulsado ×' + x.left));
  M.buffs.forEach(b => st.push(b.name + ' · ' + (b.left > 99 ? 'todo el partido' : b.left + ' jug.')));
  return st.map(x => `<div class="mut st">${x}</div>`).join('');
}
function hudHand() {
  const el = $('#hud-hand'); if (!el || !M) return;
  if (M.lab && typeof labHave === 'function') labHave();
  const side = handSide(), hand = M.hands[side] || [];
  el.innerHTML = hand.map((c, i) => (c.gone || (c.used && !cardPending(c, side))) ? '' : `<div class="hc r${rarityOf(CARDS[c.k].price)} ${c.used ? 'used' : ''} ${M.cardBan && M.cardBan[side] > 0 && !c.used ? 'banned' : ''}" data-a="usecard" data-i="${i}" style="--c1:${CAT.comodin[0]};--c2:${CAT.comodin[1]}">
      <div class="hc-art">${ART[c.k]}</div><div class="hc-name">${CARDS[c.k].n}</div>${c.used ? (typeof cardLeft(c, side) === 'number' ? '<div class="hc-left">' + cardLeft(c, side) + '</div><div class="hc-used sm">TURNOS</div>' : '<div class="hc-used">USADA</div>') : ''}
      <div class="hc-tip"><b>${CARDS[c.k].n}</b><span>${CARDS[c.k].d(1)}</span><em>${c.used ? 'Usada: se gasta al acabar el partido' : 'Clic para usar · se gasta al usarla'}</em></div></div>`).join('');
  /* comodines de la CPU a la vista (si los tiene) */
  const ee = $('#hud-ehand'); if (!ee) return;
  const eh = M.human[1 - side] ? [] : (M.hands[1 - side] || []);
  ee.innerHTML = eh.length ? `<div class="eh-t">🤖 COMODINES DEL RIVAL</div><div class="eh-row">` + eh.map(c => `<div class="eh ${c.used ? 'used' : ''}"><span class="eh-i">${ART[c.k]}</span><small class="eh-lv">NV ${c.lv}</small><div class="hc-tip"><b>${CARDS[c.k].n} · Nivel ${c.lv}${c.used ? ' · USADA' : ''}</b><span>${CARDS[c.k].d(c.lv)}</span></div></div>`).join('') + '</div>' : '';
}
const svc = v => Math.min(12, Math.max(7, Math.round(v)));
/* mejoras de items (🎖️ 💙 ✨ 🧛…) agrupadas por icono: [{i, v}] → suma de cada icono */
const ibSum = (ib, k) => (ib && ib[k] || []).reduce((a, x) => a + x.v, 0);
const ibChips = (ib, k) => { const g = {}; (ib && ib[k] || []).forEach(x => { g[x.i] = Math.round(((g[x.i] || 0) + x.v) * 10) / 10; }); return Object.keys(g).filter(i => g[i]).map(i => `<small class="actb ib ${g[i] < 0 ? 'neg' : ''}">${g[i] > 0 ? '+' : '−'}${Math.abs(g[i])}${i}</small>`).join(''); };
function hudCap() {
  const el = $('#hud-cap'); if (!el || !M) return;
  let c = M.sel != null ? capById(M.sel) : null;
  const inPlay = false;
  if (inPlay && M.play && M.play.shooter != null) c = capById(M.play.shooter) || c;
  if ((M.phase === 'pen' || M.so) && !(c && M.human[c.team] && c.team === M.turn && M.phase === 'pen')) { el.innerHTML = '<div class="hint">🥅 <b>Penalti</b>: para la flecha en la zona <b class="warn">verde</b> con clic o ESPACIO. Si defiendes, para TU flecha más cerca del centro verde que la del rival.</div>'; return; }
  if (!c || (!inPlay && (!M.human[c.team] || c.team !== M.turn))) { el.innerHTML = `<div class="hint">${M.S.j2 ? `Turno de <b>J${M.turn + 1}</b>: ` : ''}Arrastra <b>un jugador</b> hacia atrás y suelta.<br><b class="warn">⚠ Toca el balón o el rival tira 2 veces.</b><br>${M.so ? '' : 'No toques a un rival en el área propia antes del balón (penalti).'}<br><span class="mouse-only">Clic derecho: cancelar · Esc: menú</span><span class="touch-only">Para cancelar, toca con un segundo dedo</span></div>${statusHTML()}`; return; }
  const R = ROLES.find(r => r.k === c.role);
  const st = c.st;
  el.innerHTML = `<div class="cc-head"><b>${c.name}${c.captain ? ' <span class="capt">C</span>' : ''} <span class="gold">${'★'.repeat(c.stars || 1)}</span></b><em>${R.n}</em><span class="shirt">#${c.num}</span></div>
    <div class="cc-abs">${[...new Set(c.abs)].map(k => `<span class="cc-ab" title="${ABILITIES[k].d}"><i>${ABILITIES[k].icon}</i>${ABILITIES[k].n}${abCount(c.abs, k) > 1 ? ' ×' + abCount(c.abs, k) : ''}</span>`).join('')}</div>
    ${STAT_KEYS.map(k => `<div class="cc-row"><span>${STATS[k].icon} ${k}</span><div class="bar"><i style="width:${Math.min(100, st[k] / 12 * 100)}%"></i></div><b class="sv sv${svc(st[k])}">${Math.round(st[k] - ibSum(c.ib, k))}${ibChips(c.ib, k)}${c.actB && c.actB[k] ? `<small class="actb ${c.actB[k] < 0 ? 'neg' : ''}">${c.actB[k] > 0 ? '+' : '−'}${Math.abs(c.actB[k]).toFixed(1)}</small>` : ''}${c.psn && c.psn[k] ? `<small class="actb neg">−${c.psn[k]}</small>` : ''}</b></div>`).join('')}
    ${statusHTML()}`;
}
function hudPerks() {
  const el = $('#hud-perks'); if (!el) return;
  const fp = M && M.S.fp, nm = s => (M && (M.S.j2 || fp)) ? tn(M.codes[s]) : '';
  const one = (k, rival) => { const left = !rival ? `<em>Quedan ${perkLeft(k)} partidos</em>` : '', num = !rival && !fp ? `<i class="pkn">${perkLeft(k)}</i>` : '';
    return `<span class="pk${rival ? ' rv' : ''}">${PERKS[k].icon}${num}<div class="pk-tip"><small>${rival ? '🔴 RELIQUIA DEL RIVAL' + (nm(1) ? ' · ' + nm(1) : '') : '🟢 RELIQUIA DE TU EQUIPO' + (nm(0) ? ' · ' + nm(0) : '')}</small><b>${PERKS[k].icon} ${PERKS[k].n}</b><span>${PERKS[k].d}</span>${left}</div></span>`; };
  const mine = (fp ? fp[0] : G.perks) || [], rv = (fp ? fp[1] : []) || [];
  el.innerHTML = mine.filter(k => PERKS[k]).map(k => one(k, false)).join('') + rv.filter(k => PERKS[k]).map(k => one(k, true)).join('');
}
let bannerT = 0;
function banner(txt, sub = '', ms = 1500, cls = '') {
  const b = $('#banner'); if (!b) return;
  b.className = 'banner show ' + cls;
  b.innerHTML = `<div class="bt">${txt}</div>${sub ? `<div class="bs">${sub}</div>` : ''}`;
  clearTimeout(bannerT); bannerT = setTimeout(() => { b.className = 'banner'; }, ms);
}

/* ===================== PANTALLAS ===================== */
function rating(defs) { return Math.round(defs.reduce((s, c) => s + capOvr(c), 0) / defs.length); }
function capPreview(i, kit, r = 46) { return `<canvas class="capv" data-i="${i}" data-num="${SHIRT[ROLES[i].k]}" data-c1="${kit.c1}" data-c2="${kit.c2 || ''}" data-code="${kit.code}" width="${r * 3}" height="${r * 3}"></canvas>`; }
/* ajusta el panel de selección de equipo para que nunca se salga de la pantalla */
function fitPick() {
  const d = document.querySelector('.pick .pdetail'); if (!d) return;
  d.classList.remove('tight1', 'tight2', 'tight3');
  for (const c of ['tight1', 'tight2', 'tight3']) { if (d.scrollHeight <= d.clientHeight + 1) break; d.classList.add(c); }
}
window.addEventListener('resize', () => setTimeout(fitPick, 60));
function drawPreviews() {
  document.querySelectorAll('canvas.capv').forEach(c => {
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    const kit = { code: c.dataset.code, c1: c.dataset.c1, c2: c.dataset.c2 || COUNTRIES[c.dataset.code].c2 };
    drawCap(ctx, c.width / 2, c.height / 2 - 3, c.width * 0.34, kit, { num: c.dataset.num });
  });
}
window.__flagsLoaded = () => { drawPreviews(); drawHero(); };
function drawHero() {
  const c = $('#hero'); if (!c) return;
  const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
  const codes = ['ESP', 'FRA', 'BRA', 'ARG', 'ALE', 'ING'];
  codes.forEach((code, i) => { const kit = { code, c1: COUNTRIES[code].c1, c2: COUNTRIES[code].c2 }; drawCap(ctx, 90 + i * 150, 110 + (i % 2) * 40, 62, kit); });
  drawBall(ctx, { x: 480, y: 215, r: 30, ang: 0.6 });
}

function renderTitle() {
  const best = getBest(), saved = loadRun();
  return `<div class="screen title">
    <div class="glow g1"></div><div class="glow g2"></div>
    <div class="t-box">
      <div class="kicker">ROGUELIKE · FÚTBOL JUGADORES · 5 vs 5</div>
      <h1 class="logo"><span class="lg1">CAP</span><span class="lg2">CUP</span></h1>
      <div class="sub">SELECCIONES · LIGAS · FORMACIONES · CAMPOS LOCOS</div>
      <canvas id="hero" width="960" height="280"></canvas>
      <p>Torneo roguelike: mejora a el equipo partido a partido, una derrota y fuera. O juega un amistoso contra la CPU o contra un amigo, eligiendo campo, balón y equipos.</p>
      <div class="row">
        ${saved ? `<button class="btn big pur" data-a="continuar">▶ CONTINUAR</button>` : ''}
        <button class="btn big" data-a="pick">⚔️ TORNEO</button>
        <button class="btn big alt" data-a="friendly">🤝 AMISTOSO</button>
        <button class="btn big gold" data-a="liga">🏆 LIGA</button>
        <button class="btn ghost" data-a="help">📖 TUTORIAL</button>
        <button class="btn ghost" data-a="mute">${muted ? '🔇' : '🔊'}</button>
      </div>
      <div class="row title-extra"><button class="btn big pink tx" data-a="mkteam">🛠 CREAR MI EQUIPO</button>
        <button class="btn big pur tx" data-a="lab">🧪 LAB DE JUGADORES</button></div>
      <div class="row langs nolang">${[['es', 'Español'], ['en', 'English'], ['gl', 'Galego']].map(([c, n]) => `<button class="btn mini lang${LANG === c ? ' on' : ''}" data-a="lang" data-l="${c}">${n}</button>`).join('')}</div>
      ${best ? `<div class="best">Mejor racha: <b>${best}</b> partido${best > 1 ? 's' : ''} ganado${best > 1 ? 's' : ''}</div>` : ''}
    </div>
  </div>`;
}

function teamInfo(sel) {
  const C = COUNTRIES[sel];
  const bias = Object.keys(C.bias).filter(k => C.bias[k]).map(k => `${STATS[k].icon} +${C.bias[k]} ${STATS[k].n}`).join(' · ') || 'Equilibrada';
  return { C, bias };
}
let PICK_SORT = 'lvl';
const TCACHE = {};
const tInfo = c => TCACHE[c] || (TCACHE[c] = (() => { const d = playerTeam(c); let best = d[0]; d.forEach(x => { if (capOvr(x) > capOvr(best)) best = x; }); return { lvl: rating(d), best, ovr: capOvr(best), form: teamForm(c) }; })());
const SORTS = { lvl: 'Nivel', form: 'Formación', best: 'Mejor jugador', az: 'A-Z' };
function sortCodes(codes) {
  const a = codes.slice(), nm = c => COUNTRIES[c].n;
  if (PICK_SORT === 'lvl') a.sort((x, y) => tInfo(y).lvl - tInfo(x).lvl || nm(x).localeCompare(nm(y)));
  else if (PICK_SORT === 'form') a.sort((x, y) => tInfo(x).form.localeCompare(tInfo(y).form) || nm(x).localeCompare(nm(y)));
  else if (PICK_SORT === 'best') a.sort((x, y) => tInfo(y).ovr - tInfo(x).ovr || nm(x).localeCompare(nm(y)));
  else a.sort((x, y) => nm(x).localeCompare(nm(y)));
  return a;
}
const sortNote = c => PICK_SORT === 'lvl' ? 'Nv ' + tInfo(c).lvl : PICK_SORT === 'form' ? tInfo(c).form : PICK_SORT === 'best' ? '⭐ ' + tInfo(c).best.name.split(' ').slice(-1)[0] + ' ' + tInfo(c).ovr : '';
function renderPick() {
  const lg = 'SEL', L = LEAGUES.find(l => l.k === lg);
  const sel = L.codes.includes(G.pickSel) ? G.pickSel : L.codes[0];
  const { C, bias } = teamInfo(sel);
  return `<div class="screen pick">
    <div class="p-head"><button class="btn ghost mini" data-a="title">← Menú</button><h2>${G.liga ? '🏆 LIGA · ' : ''}ELIGE TU EQUIPO</h2><span></span></div>
    <div class="sortrow"><span>ORDENAR POR</span>${Object.keys(SORTS).map(k => `<button class="chip ${PICK_SORT === k ? 'on' : ''}" data-a="psort" data-k="${k}">${SORTS[k]}</button>`).join('')}</div>
    <div class="p-main">
      <div class="flags ${L.codes.length < 6 ? 'few' : L.codes.length > 12 ? 'many' : ''}">${sortCodes(L.codes).map(c => `<button class="fcard ${c === sel ? 'on' : ''}" data-a="psel" data-c="${c}">${flagSVG(c)}<b>${COUNTRIES[c].n}</b><small class="fnote">${sortNote(c)}</small></button>`).join('')}</div>
      <div class="pdetail">
        <div class="pinfo">
        <div class="pflagrow"><div class="bigflag">${flagSVG(sel)}</div><div class="pkits"><div>${capPreview(2, { code: sel, c1: C.c1, c2: C.c2 }, 30)}<small>LOCAL</small></div><div>${capPreview(2, { code: sel, c1: (AWAY[sel] || [C.c2, C.c1])[0], c2: (AWAY[sel] || [C.c2, C.c1])[1] }, 30)}<small>VISITANTE</small></div></div></div>
        <h3>${C.n}</h3>
        ${C.lg ? `<div class="tag">${C.lg}</div>` : ''}
        <div class="bias">${bias}${C.best ? ' · ★★★ de inicio' : ''}</div>
        <div class="prow"><div class="pcaps">${ROLES.map((r, i) => capPreview(i, { code: sel, c1: C.c1, c2: C.c2 }, 34)).join('')}</div><button class="btn ghost" data-a="squad" data-c="${sel}">👥 VESTUARIO</button>${C.custom ? '<button class="btn ghost" data-a="mkteam">✏️ EDITAR</button>' : ''}</div>
        <div class="ft-bars pbars">${statBars(teamAvg(sel).o)}</div>
        </div>
        <div class="popts">
        <div class="chips"><button class="chip big ${TOUR_RAND ? 'on' : ''}" data-a="trand" data-v="1">🎲 Campo y balón aleatorios</button><button class="chip big ${TOUR_RAND ? '' : 'on'}" data-a="trand" data-v="0">⚽ Campo y bola clásicos</button></div>
        <div class="chips topt"><span>🎯 Turnos por equipo</span>${[3, 6, 8, 10, 12, 15].map(n => `<button class="chip ${TOUR_OPT.turns === n ? 'on' : ''}" data-a="topt" data-k="turns" data-v="${n}">${n}</button>`).join('')}</div>
        ${G.liga ? '' : `<div class="chips topt"><span>👥 Fase de grupos</span><button class="chip ${TOUR_OPT.groups ? 'on' : ''}" data-a="topt" data-k="groups" data-v="1">Sí (grupos de 4)</button><button class="chip ${TOUR_OPT.groups ? '' : 'on'}" data-a="topt" data-k="groups" data-v="0">No (directo a eliminatorias)</button></div>`}
        <button class="btn big" data-a="go" data-c="${sel}">EMPEZAR TORNEO</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---- amistoso ---- */
const teamAvg = code => { const d = playerTeam(code), o = {}; STAT_KEYS.forEach(k => { o[k] = d.reduce((a, c) => a + c.stats[k], 0) / d.length; }); return { o, ovr: rating(d) }; };
const statBars = o => STAT_KEYS.map(k => `<div class="tb"><span>${STATS[k].icon} ${k}</span><div class="bar"><i style="width:${Math.min(100, o[k] / 12 * 100)}%"></i></div><b class="sv sv${svc(o[k])}">${o[k].toFixed(1)}</b></div>`).join('');
function teamSel(side) {
  const code = FR['c' + side], C = COUNTRIES[code], { o, ovr } = teamAvg(code);
  return `<div class="fr-team v2">
    <div class="ft-top">
      <div class="fr-flag">${flagSVG(code)}</div>
      <div class="ft-info"><h3>${C.n}</h3><div class="ft-ovr">MEDIA <b class="sv sv${svc(ovr / 10)}">${ovr}</b></div><button class="btn small" data-a="frpick" data-side="${side}">🔄 Cambiar equipo</button><button class="btn small ghost" data-a="squad" data-c="${code}">👥 Ver jugadores</button></div>
    </div>
    <div class="ft-bars">${statBars(o)}</div>
    ${FR.kind === 'pens' ? '' : `<div class="ft-forms">${FORM_KEYS.map(k => `<button class="fchip ${FR['f' + side] === k ? 'on' : ''}" data-a="frform" data-side="${side}" data-v="${k}" title="${FORMS[k].n}">${formSVG(k)}<b>${k}</b></button>`).join('')}</div>`}
  </div>`;
}
let SQ_LIST = [];
function squadHTML(code) {
  const C = COUNTRIES[code], defs = playerTeam(code), cols = ['#c6ff3d', '#4dd2ff', '#ffb347', '#ff6fa8', '#c77dff'];
  return `<div class="overlay" id="squad"><div class="sq-box"><div class="sq-head"><div class="sq-t">${flagSVG(code, 'sm')}<h2>${C.n} · PLANTILLA</h2></div>${SQ_LIST.length > 1 ? `<div class="sq-nav"><button class="btn ghost mini" data-a="squadnav" data-d="-1" data-c="${code}" title="Equipo anterior">◀</button><span>${SQ_LIST.indexOf(code) + 1} / ${SQ_LIST.length}</span><button class="btn ghost mini" data-a="squadnav" data-d="1" data-c="${code}" title="Equipo siguiente">▶</button></div>` : ''}<button class="btn ghost mini" data-a="squadx">✕ Cerrar</button></div>
    <div class="sq-grid">${defs.map((c, i) => `<div class="sq-card"><div class="fut-top"><div class="ovr sv sv${svc(capOvr(c) / 10)}">${capOvr(c)}</div><div class="role">${ROLES[i].k}</div></div>
      <div class="fut-name">${c.name}${c.captain ? ' <span class="capt">C</span>' : ''}</div><div class="fut-role">${ROLES[i].n} · <i class="gold">${'★'.repeat(c.stars || 1)}</i></div>
      <div class="fut-stats">${STAT_KEYS.map(k => `<div class="fs" title="${STATS[k].d}"><span>${k}</span><div class="bar"><i style="width:${Math.min(100, c.stats[k] / 12 * 100)}%"></i></div><b class="sv sv${svc(c.stats[k])}">${Math.round(c.stats[k])}</b></div>`).join('')}</div>
      ${radarSVG(c.stats, cols[i % 5])}</div>`).join('')}</div></div></div>`;
}
function frPicker() {
  const side = FR.picking; if (side == null) return '';
  const lg = 'SEL', L = LEAGUES.find(l => l.k === lg);
  const cur = FR['c' + side];
  const list = L.codes.map(c => ({ c, ...teamAvg(c) })).sort((a, b) => b.ovr - a.ovr);
  return `<div class="overlay frpick" id="frpick"><div class="frp-box">
    <div class="frp-head"><h2>ELIGE EL EQUIPO ${side === 0 ? '1 · LOCAL' : '2 · VISITANTE'}</h2><button class="btn ghost mini" data-a="frclose">✕ Cerrar</button></div>
    <div class="frp-grid">${list.map(t => `<button class="frp-card ${t.c === cur ? 'on' : ''}" data-a="frchoose" data-side="${side}" data-c="${t.c}">
      <div class="frp-h">${flagSVG(t.c)}<b>${COUNTRIES[t.c].n}</b><em class="sv sv${svc(t.ovr / 10)}">${t.ovr}</em></div>
      <div class="ft-bars">${statBars(t.o)}</div></button>`).join('')}</div>
  </div></div>`;
}
const chip = (k, v, label, cur) => `<button class="chip ${cur === v ? 'on' : ''}" data-a="frset" data-k="${k}" data-v="${v}">${label}</button>`;
function renderFriendly() {
  return `<div class="screen friendly">
    <div class="p-head"><button class="btn ghost mini" data-a="title">← Menú</button><h2>AMISTOSO</h2><span></span></div>
    <div class="fr-top">
      ${teamSel(0)}
      <div class="fr-mid"><div class="v-vs sm">VS</div>
        <div class="chips">${chip('mode', 'cpu', '🤖 CPU', FR.mode)}${chip('mode', 'j2', '👥 J2', FR.mode)}</div>
        <div class="chips"><button class="chip big ${FR.kind === 'pens' ? 'on' : ''}" data-a="frpens">🥅 Tanda de penaltis: ${FR.kind === 'pens' ? 'SÍ' : 'NO'}</button></div>
        ${FR.mode === 'cpu' ? `<div class="chips">${LEVEL_NAMES.map((n, i) => chip('diff', i, n, FR.diff)).join('')}</div>` : '<div class="mut">J1 y J2 juegan por turnos en el mismo ratón</div>'}
      </div>
      ${teamSel(1)}
    </div>
    ${FR.kind === 'pens' ? '<div class="mut fr-desc">🥅 5 penaltis cada uno, alternando. Para la flecha en la zona verde para marcar; si falla, lo para el portero. Si hay empate, muerte súbita.</div>' : `    <div class="fr-sec"><span>CAMPO</span><div class="chips big">${['normal', ...FIELD_KEYS].map(k => `<button class="chip ${FR.field === k ? 'on' : ''}" data-a="frset" data-k="field" data-v="${k}" title="${FIELDS[k].d}">${FIELDS[k].icon} ${FIELDS[k].n}</button>`).join('')}</div></div>
    <div class="fr-sec"><span>BALÓN</span><div class="chips big">${['normal', ...BALL_KEYS].map(k => `<button class="chip ${FR.ballType === k ? 'on' : ''}" data-a="frset" data-k="ballType" data-v="${k}" title="${BALLS[k].d}">${BALLS[k].icon} ${BALLS[k].n}</button>`).join('')}</div></div>
    <div class="fr-row2">
      <div class="fr-sec"><span>Nº DE BALONES</span><div class="chips">${[1, 2, 3, 4].map(n => chip('nBalls', n, n, FR.nBalls)).join('')}</div></div>
      <div class="fr-sec"><span>TURNOS POR EQUIPO</span><div class="chips">${[3, 5, 8, 10, 15].map(n => chip('turns', n, n, FR.turns)).join('')}</div></div>
    </div>
    <div class="mut fr-desc">${FIELDS[FR.field].icon} ${FIELDS[FR.field].d} &nbsp;·&nbsp; ${BALLS[FR.ballType].icon} ${BALLS[FR.ballType].d}</div>
    <div class="fr-row2"><div class="fr-sec"><span>COMODINES (MODO VS)</span><div class="chips"><button class="chip big ${FR.cards ? 'on' : ''}" data-a="frcards">🎲 3 comodines aleatorios por equipo: ${FR.cards ? 'SÍ' : 'NO'}</button></div></div>
    <div class="fr-sec mny"><span>💰 DINERO PARA LA TIENDA (0 = sin tienda)</span><div class="fr-money">${(FR.mode === 'j2' ? [0, 1] : [0]).map(s => `<label>${FR.mode === 'j2' ? '<em>J' + (s + 1) + '</em>' : ''}<input type="range" min="0" max="100" step="1" value="${FR.money[s]}" data-frm="${s}"><b id="frm${s}">$${FR.money[s]}</b></label>`).join('')}</div></div></div>`}
    <button class="btn big" data-a="frstart2">${FR.kind === 'pens' ? '¡A TIRAR PENALTIS!' : (FR.money[0] > 0 || (FR.mode === 'j2' && FR.money[1] > 0)) ? '🛒 A LA TIENDA ▶' : '¡A JUGAR!'}</button>
    ${frPicker()}
  </div>`;
}

function formSVG(id) {
  const dots = formSlots(id).map((p, i) => `<circle cx="${(p[0] * 1.5 * 100).toFixed(1)}" cy="${(p[1] * 56).toFixed(1)}" r="${i ? 4.2 : 4.6}" fill="${i ? '#c6ff3d' : '#ffd166'}"/>`).join('');
  return `<svg viewBox="0 0 76 56" width="54" height="40"><rect x="1" y="1" width="74" height="54" rx="4" fill="#1b7a37" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/><path d="M38 1v54" stroke="#fff" stroke-opacity=".45"/>${dots}</svg>`;
}
function renderVersus() {
  const E = COUNTRIES[G.enemy], P = COUNTRIES[G.code];
  const ab = G.enemyDefs.reduce((a, c) => a + c.abs.length, 0);
  return `<div class="screen versus">
    <div class="v-round">${G.tour && !G.league ? tierName(G.tier) + ' · ' : ''}${roundName(G.round)}</div>
    <div class="v-main">
      <div class="v-team l">${flagSVG(G.code, 'xl')}<h3>${P.n}</h3><div class="ovr">Media <b>${rating(G.caps)}</b></div></div>
      <div class="v-vs">VS</div>
      <div class="v-team r">${flagSVG(G.enemy, 'xl')}<h3>${E.n}</h3><div class="ovr">Media <b>${rating(G.enemyDefs)}</b></div><div class="mut">${ab ? `${ab} ${ab > 1 ? 'habilidades' : 'habilidad'} en la plantilla` : 'Sin habilidades'}</div></div>
    </div>
    <div class="v-muts">
      <div class="v-mut ${G.field !== 'normal' ? 'crazy' : ''}"><span>${FIELDS[G.field].icon}</span><b>${FIELDS[G.field].n}</b><em>${FIELDS[G.field].d}</em></div>
      <div class="v-mut ${G.ballType !== 'normal' || G.nBalls > 1 ? 'crazy' : ''}"><span>${BALLS[G.ballType].icon}${G.nBalls > 1 ? '×' + G.nBalls : ''}</span><b>Balón ${BALLS[G.ballType].n}${G.nBalls > 1 ? ' · ' + G.nBalls + ' balones' : ''}</b><em>${BALLS[G.ballType].d}</em></div>
    </div>
    <div class="v-form"><span>TU FORMACIÓN <small>(se mantiene entre partidos)</small></span>${FORM_KEYS.map(k => `<button class="fchip ${G.form === k ? 'on' : ''}" data-a="form" data-v="${k}" title="${FORMS[k].d}">${formSVG(k)}<b>${k}</b><small>${FORMS[k].n}</small></button>`).join('')}<em class="mut vs-form">Rival (${COUNTRIES[G.enemy].n}): ${formSVG(teamForm(G.enemy))}<b>${teamForm(G.enemy)}</b> ${FORMS[teamForm(G.enemy)].n}</em></div>
    <div class="row"><button class="btn big" data-a="play">¡A JUGAR!</button><button class="btn big alt" data-a="myteam">👕 MI VESTUARIO</button><button class="btn big gold" data-a="tienda">🛒 TIENDA</button><button class="btn big alt" data-a="rival">👁 VESTUARIO RIVAL</button>${tourOn() ? '<button class="btn big pur" data-a="tourview">🏆 CUADRO</button>' : ''}${G.league ? '<button class="btn big pur" data-a="lgview">📊 CLASIFICACIÓN</button>' : ''}</div>
    <div class="v-money">Dinero ${money()} · Partidos ganados ${G.stats.wins}</div>
  </div>`;
}

const STATITEMS = {
  POT: { n: '+2 Potencia', icon: '💥', price: 5, d: 'Aumenta +2 la POTENCIA del jugador elegido: sus tiros llegan más lejos.' },
  PES: { n: '+2 Peso', icon: '⚖️', price: 5, d: 'Aumenta +2 el PESO del jugador elegido: empuja con más fuerza y cuesta más moverlo.' },
  PRE: { n: '+2 Precisión', icon: '🎯', price: 5, d: 'Aumenta +2 la PRECISIÓN del jugador elegido: el balón se desvía menos al golpearlo.' },
  MEN: { n: '+2 Mentalidad', icon: '🔥', price: 5, d: 'Aumenta +2 la MENTALIDAD del jugador elegido.' },
  STAR: { n: '+1 Estrella', icon: '⭐', price: 14, d: 'Añade una ESTRELLA al jugador elegido: +1 en todas sus estadísticas.' },
  VIS: { n: '+2 Visión de juego', icon: '👁️', price: 5, d: 'Aumenta +2 la VISIÓN del jugador elegido: la flecha de ayuda muestra más trayectoria.' },
};
const itemDef = it => it.kind === 'perk' ? PERKS[it.key] : it.kind === 'item' ? CARDS[it.key] : (it.kind === 'stat' || it.kind === 'star') ? STATITEMS[it.key] : ABILITIES[it.key];
const PM = () => G.inMatch ? 2 : 1;
const disc = p => hasPerk('rebajas') ? Math.max(1, Math.ceil(p / 2)) : p;   // Rebajas: TODO en la tienda cuesta la mitad
function itemPrice(it) { if (it.free) return 0; return disc(itemDef(it).price * PM()); }
function genShop(rc = CONFIG.rerollCost) {
  const owned = new Set(G.perks);
  const items = [];
  wPick(Object.keys(PERKS).filter(k => !owned.has(k) && !(k === 'bolsillo' && (G.slotBonus || 0) >= 2) && !(G.fshop != null && FR_NOPERK.includes(k))), k => PERKS[k].price, 1).forEach(k => items.push({ kind: 'perk', key: k }));
  wPick(Object.keys(ABILITIES), k => ABILITIES[k].price, 1).forEach(k => items.push({ kind: 'ab', key: k }));
  wPick(CARD_KEYS, k => CARDS[k].price, 2).forEach(k => items.push({ kind: 'item', key: k }));
  shuffle(STAT_KEYS).slice(0, 1).forEach(k => items.push({ kind: 'stat', key: k }));
  if (Math.random() < 0.22) items.push({ kind: 'star', key: 'STAR' });   // la estrella ya no sale en todas las tiendas
  /* premios gratis de la ruleta (y los que aún no cogiste de la tienda anterior) */
  const keep = (G.freeItems || []).slice().reverse().concat(G.shop ? G.shop.items.filter(i => i.free && !i.bought) : []); G.freeItems = [];
  const base = Math.max(0, items.length - keep.length);
  const seenPk = new Set(), keepU = keep.filter(i => { if (i.kind !== 'perk') return true; if (seenPk.has(i.key) || (owned.has(i.key) && !PERKS[i.key].use)) return false; seenPk.add(i.key); return true; });
  const pool = shuffle(items.filter(i => !(i.kind === 'perk' && seenPk.has(i.key))));
  while (keepU.length > 6) keepU.pop();   // los premios nuevos van primero; nunca más de 6 cartas en el vestuario
  G.shop = { items: keepU.map(i => ({ kind: i.kind, key: i.key, free: true })).concat(pool.slice(0, Math.max(0, items.length - keepU.length))), rc }; G.pending = null;
}
const statCost = lv => disc((2 + lv) * PM());
const cardUpP = (k, lv) => disc(cardUpCost(k, lv) * PM());

const KIND_COL = { perk: ['#ffd166', '#7a4a00', 'RELIQUIA'], ab: ['#35e0ff', '#0a3a6a', 'HABILIDAD'], stat: ['#9dff6a', '#1a5a2a', 'MEJORA'] };
function marketCard(it, i, pend) {
  const d = itemDef(it), price = itemPrice(it);
  let card;
  if (it.kind === 'item') {
    const own = G.cards.find(c => c.k === it.key);
    card = cardOf({ k: it.key, lv: 1 }, { badge: own ? 'OTRA COPIA' : 'CARTA' });
  } else {
    const K = KIND_COL[it.kind];
    card = cardHTML({ cat: it.kind === 'perk' ? 'reliquia' : 'mejora', rar: rarityOf(d.price), art: `<div class="emo">${d.icon}</div>`, name: d.n, desc: d.d, badge: it.kind === 'ab' ? 'HABILIDAD' : '' });
  }
  const dis = !afford(price) || pend || it.bought;
  return `<div class="mk2 ${it.bought ? 'sold' : ''} ${it.free ? 'isfree' : ''}">${it.free && !it.bought ? '<div class="freetag">🎁 GRATIS</div>' : ''}${card}<button class="btn small buy" data-a="buy" data-i="${i}" ${dis ? 'disabled' : ''}>${it.bought ? (it.free ? 'COGIDO' : 'COMPRADO') : it.free ? '🎁 GRATIS · $0' : '$' + (G.debug ? 0 : price)}</button></div>`;
}
/* gráfico de pentágono (radar) con las 5 características */
function radarSVG(st, col = '#c6ff3d') {
  const C = 60, R = 38, n = STAT_KEYS.length, max = 12;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [C + Math.cos(a) * R * v / max, C + Math.sin(a) * R * v / max]; };
  const poly = v => STAT_KEYS.map((k, i) => pt(i, typeof v === 'function' ? v(k) : v).map(x => x.toFixed(1)).join(',')).join(' ');
  const rings = [3, 6, 9, 12].map(v => `<polygon points="${poly(v)}" fill="none" stroke="rgba(255,255,255,${v === 12 ? .5 : .22})" stroke-width="${v === 12 ? 1.2 : 1}"/>`).join('');
  const spokes = STAT_KEYS.map((k, i) => { const p = pt(i, max); return `<line x1="${C}" y1="${C}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="rgba(255,255,255,.22)"/>`; }).join('');
  const labs = STAT_KEYS.map((k, i) => { const p = pt(i, max * 1.3); return `<text x="${p[0].toFixed(1)}" y="${(p[1] + 3.5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="800" fill="#cfe0f5">${k}</text>`; }).join('');
  const dots = STAT_KEYS.map((k, i) => { const p = pt(i, Math.min(max, st[k])); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="${col}"/>`; }).join('');
  return `<svg class="radar" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">${rings}${spokes}<polygon points="${poly(k => Math.min(max, st[k]))}" fill="${col}" fill-opacity=".38" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>${dots}${labs}</svg>`;
}
function renderShop(preview) {
  const r = G.reward || { total: 0 };
  const kit = kitOf(G.code);
  const pend = G.pending, tab = G.shopTab || 'team';
  const cards = G.caps.map((c, i) => {
    const R = ROLES[i];
    const fl = G.flash === i;
    return `<div class="fut ${c.captain ? 'iscap' : ''} ${pend && (pend.kind === 'star' ? (c.stars || 1) < 5 : pend.kind === 'stat' ? c.stats[pend.key] < CONFIG.statMax : c.abs.length < abSlots(c.stars || 1) && abCount(c.abs, pend.key) < AB_MAX) ? 'pending' : ''} ${fl ? 'flash' : ''}" data-tipi="${i}" ${pend ? `data-a="apply" data-i="${i}"` : ''}>
      <div class="fut-top"><div class="ovr sv sv${svc(capOvr(c) / 10)}">${capOvr(c)}</div><div class="role">${R.k}</div>${flagSVG(G.code, 'sm')}</div>
      ${capPreview(i, kit, 34)}
      <div class="fut-name">${c.name}</div>${c.captain ? '<div class="capband">🎖️ CAPITÁN · +1 MEN</div>' : ''}<div class="fut-role">${R.n}</div>
      <div class="stars"><span class="st">${'★'.repeat(c.stars || 1)}<i>${'★'.repeat(5 - (c.stars || 1))}</i></span>${(c.stars || 1) < 5 && !pend ? `<button data-a="star" data-i="${i}" title="+1 a todas las estadísticas${[2, 4].includes(c.stars) ? ' y desbloquea otra habilidad' : ''}" ${afford(disc(STAR_COST[c.stars || 1] * PM())) ? '' : 'disabled'}>+★ <small>$${G.debug ? 0 : disc(STAR_COST[c.stars || 1] * PM())}</small></button>` : '<em></em>'}</div>
      <div class="fut-abs">${Array.from({ length: 3 }, (_, j) => {
        const slots = Math.max(abSlots(c.stars || 1), c.abs.length), k = c.abs[j];
        if (j >= slots) return `<div class="abslot locked" title="Se desbloquea con ${j === 1 ? '3' : '5'} estrellas">🔒<small>${j === 1 ? '3' : '5'}★</small></div>`;
        if (k) return `<div class="abslot on" data-itip="${k}"><i>${ABILITIES[k].icon}</i><small>${ABILITIES[k].n}</small>${pend ? '' : `<button class="abx" data-a="rmab" data-i="${i}" data-j="${j}" title="Vender habilidad por $${Math.floor(ABILITIES[k].price / 2)}">+$${Math.floor(ABILITIES[k].price / 2)}</button>`}</div>`;
        return `<div class="abslot empty" title="Hueco libre: compra una habilidad"><i>＋</i><small>libre</small></div>`;
      }).join('')}</div>
      <div class="fut-stats">${STAT_KEYS.map(k => {
        const v = c.stats[k], cost = statCost(v);
        return `<div class="fs" title="${STATS[k].d}"><span>${k}</span><div class="bar"><i style="width:${Math.min(100, v / 12 * 100)}%"></i>${pend && pend.kind === 'stat' && pend.key === k && v < CONFIG.statMax ? `<u class="gain" style="left:${Math.min(100, v / 12 * 100)}%;width:${(Math.min(CONFIG.statMax, v + 2) - v) / 12 * 100}%"></u>` : ''}</div><b class="sv sv${svc(v)}">${v}</b>
        ${v < CONFIG.statMax && !pend ? `<button data-a="stat" data-i="${i}" data-k="${k}" ${afford(cost) ? '' : 'disabled'}>+<small>$${G.debug ? 0 : cost}</small></button>` : '<em></em>'}</div>`;
      }).join('')}</div>
      ${radarSVG(c.stats, ['#c6ff3d', '#4dd2ff', '#ffb347', '#ff6fa8', '#c77dff'][i % 5])}
    </div>`;
  }).join('');
  if (G.ro) return `<div class="screen shop rival"><div class="s-head"><h2>👁 VESTUARIO RIVAL · ${COUNTRIES[G.code].n}</h2></div>
    <div class="starhint">Solo lectura: así llega el rival a este partido</div><div class="s-cards">${cards.replace(/<button[^>]*data-a="(star|stat|rmab)"[^>]*>[\s\S]*?<\/button>/g, '<em></em>')}</div>
    <div class="s-foot"><span class="mut">${COUNTRIES[G.code].n} · media ${rating(G.caps)}</span><button class="btn big" data-a="rivalback">← VOLVER</button></div></div>`;
  const market = G.shop.items.map((it, i) => marketCard(it, i, pend)).join('');
  const mine = Array.from({ length: itemSlots() }, (_, i) => {
    const c = G.cards[i];
    if (!c) return `<div class="mk2 empty"><div class="card slot"><div class="cd-art"><div class="emo">＋</div></div><div class="cd-name">Hueco de carta</div><div class="cd-desc">Compra una carta en el mercado</div></div></div>`;
    return `<div class="mk2 own ${G.flashCard === c.k ? 'flashc' : ''}">${cardOf(c)}<div class="hc-tip"><b>${CARDS[c.k].n}</b><span>${CARDS[c.k].d(1)}</span><em>Se gasta al usarla en el partido</em></div><div class="mk2-btns"><button class="btn small sell" data-a="cardsell" data-i="${i}">Vender +$${cardSell(c)}</button></div></div>`;
  }).join('');
  const perks = Array.from({ length: CONFIG.perkSlots }, (_, i) => G.perks[i]
    ? `<button class="pslot on tipw" data-a="sellperk" data-i="${i}"><span>${PERKS[G.perks[i]].icon}</span><i class="pkn">${perkLeft(G.perks[i])}</i><b>${PERKS[G.perks[i]].n}</b><small>${PERKS[G.perks[i]].d}</small><em>vender +$${Math.floor(PERKS[G.perks[i]].price / 2)}</em></button>`
    : `<div class="pslot"><span>＋</span><small>hueco de reliquia</small></div>`).join('');
  G.flashCard = null;
  const body = tab === 'team'
    ? `<div class="starhint">★ Cada estrella sube <b>+1</b> todas las estadísticas · con <b>3★</b> el jugador admite 2 habilidades y con <b>5★</b> hasta 3 · 🎯 Precisión baja = el balón se desvía</div><div class="s-cards">${cards}</div>`
    : `<div class="mtab">
        <div class="s-sec">MERCADO <button class="btn mini ghost" data-a="reroll" ${(!afford(G.shop.rc * PM()) || pend) ? 'disabled' : ''}>🔄 Renovar $${G.debug ? 0 : G.shop.rc * PM()}</button></div>
        <div class="mrow ${G.shop.items.length > 6 ? 'dense' : ''}" style="grid-template-rows:repeat(${Math.ceil(G.shop.items.length / 3)},1fr)!important">${market}</div>
        <div class="mbot">
          <div class="mmine"><div class="s-sec">TUS CARTAS COMODÍN <span class="mut">${G.cards.length}/${itemSlots()} · se gastan al usarlas</span></div><div class="mrow3" style="grid-template-columns:repeat(${itemSlots()},1fr)">${mine}</div></div>
          <div class="mperks"><div class="s-sec">RELIQUIAS <span class="mut">${G.perks.length}/${CONFIG.perkSlots} · clic para vender</span></div><div class="pslots">${perks}</div></div>
        </div>
      </div>`;
  return `<div class="screen shop">
    <div class="s-head">
      <h2>VESTUARIO</h2>
      
      <div class="reward">${r.win ? `<span>Victoria <b>${r.score}</b></span><span>Premio <b>+$${r.total}</b></span>` : ''}</div>
      <div class="cash">DINERO <b>${money()}</b></div>
      <button class="btn ghost mini" data-a="mute">${muted ? '🔇' : '🔊'}</button>
    </div>
    ${pend ? `<div class="banner-pend">Elige el jugador que recibirá <b>${pend.kind === 'stat' || pend.kind === 'star' ? STATITEMS[pend.key].icon + ' ' + STATITEMS[pend.key].n : ABILITIES[pend.key].icon + ' ' + ABILITIES[pend.key].n}</b>${pend.kind === 'stat' ? '' : ''} <button class="btn mini ghost" data-a="cancel">Cancelar</button></div>` : ''}
    ${body}
    <div class="s-foot"><span class="mut">${G.inMatch ? '⚠ Tienda en pleno partido: <b>todo cuesta el doble (×2)</b>' : G.fshop != null ? `🛒 Tienda del amistoso · <b>${FR.mode === 'j2' ? 'J' + (G.fshop + 1) + ' (' + COUNTRIES[G.code].n + ')' : COUNTRIES[G.code].n}</b> · ${FIELDS[G.field].icon} ${FIELDS[G.field].n}` : `Próximo rival: <b>${COUNTRIES[G.enemy].n}</b> · ${roundName(G.round)} · ${FIELDS[G.field].icon} ${FIELDS[G.field].n}`}</span><span class="foot-btns"><button class="btn big alt" data-a="stab" data-k="${tab === 'team' ? 'market' : 'team'}">${tab === 'team' ? '🛒 MERCADO Y CARTAS' : '👕 EQUIPO'}</button>${G.inMatch ? `${G.fromRoul ? `<button class="btn big gold" data-a="mrback" ${pend ? 'disabled' : ''}>🎡 VOLVER A LA RULETA</button>` : ''}<button class="btn big" data-a="mback" ${pend ? 'disabled' : ''}>🏟 VOLVER AL PARTIDO ▶</button>` : G.fshop != null ? `<button class="btn ghost" data-a="fcancel">← Cancelar</button><button class="btn big" data-a="fdone" ${pend ? 'disabled' : ''}>${FR.pre && FR.pre.i + 1 < FR.pre.sides.length ? 'LISTO · J2 ▶' : '¡A JUGAR! ▶'}</button>` : `<button class="btn big" data-a="versus" ${pend ? 'disabled' : ''}>SIGUIENTE PARTIDO ▶</button>`}</span></div>
  </div>`;
}

function renderMatch() {
  return `<div class="hud">
    <div id="hud-score" class="scoreboard"></div><div id="hud-money" class="hudmoney"></div><div id="hud-log" class="hudlog"></div><button id="hud-roul" class="shopbtn roulbtn" data-a="mroul" title="Ruleta: apuesta de $1 a $5 por un premio">🎡 RULETA</button><button id="hud-shop" class="shopbtn" data-a="mshop" title="Abrir la tienda en pleno partido (en pleno partido todo cuesta el doble)">🛒 TIENDA</button>
    <div class="topr"><div id="hud-perks"></div><button class="btn ghost mini" data-a="menu">☰</button></div>
    <div id="hud-cap" class="capcard"></div>
    <div id="hud-hand" class="hand"></div><div id="hud-ehand" class="ehand"></div>
    <div id="banner" class="banner"></div>
  </div>`;
}

/* al acabar el partido desaparecen los paneles de info (ficha de jugador, mano, tooltip) */
function hideEndHud() {
  ['hud-cap', 'hud-hand', 'hud-ehand'].forEach(id => { const e = $('#' + id); if (e) e.style.display = 'none'; });
  hideTip();
}
function showResult() {
  if (!M || G.screen !== 'match') return;
  hideEndHud();
  const R = M.result;
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'result';
  if (!M.run) {
    const wn = R.win ? 0 : 1;
    ov.innerHTML = `<div class="res win">
      <div class="kicker">${M.S.pens ? 'TANDA DE PENALTIS' : 'AMISTOSO'}${M.S.j2 ? ' · J1 vs J2' : ''}</div>
      <h2>${M.S.j2 ? '¡GANA J' + (wn + 1) + '!' : (R.win ? 'VICTORIA' : 'DERROTA')}</h2>
      <div class="rscore">${flagSVG(M.codes[0])}<b>${M.score[0]}</b><i>-</i><b>${M.score[1]}</b>${flagSVG(M.codes[1])}</div>
      ${R.pens ? `<div class="mut">Empate a ${R.reg[0]}-${R.reg[1]} · decidido en los penaltis</div>` : ''}
      <div class="row"><button class="btn big" data-a="rematch">REVANCHA</button><button class="btn ghost" data-a="settings">CAMBIAR AJUSTES</button><button class="btn ghost" data-a="title">MENÚ</button></div>
    </div>`;
    document.body.appendChild(ov); return;
  }
  if (G.tour && G.tour.champion && !G.league) { document.body.appendChild(ov); return showChampion(ov); }
  if (inGroup()) {
    const T = G.tour, last = G.round === 2, out = last && T.over;
    ov.innerHTML = `<div class="res ${R.win ? 'win' : R.draw ? '' : 'lose'}">
      <div class="kicker">${roundName(G.round)}</div>
      <h2>${R.win ? 'VICTORIA' : R.draw ? 'EMPATE' : 'DERROTA'}</h2>
      <div class="rscore">${flagSVG(G.code)}<b>${M.score[0]}</b><i>-</i><b>${M.score[1]}</b>${flagSVG(G.enemy)}</div>
      <div class="rrow">Goles <b>${R.goals}</b></div>${moneyBox(R)}
      ${last ? `<div class="rrow grpend ${out ? 'bad' : 'ok'}">${out ? '❌ Eliminado en la fase de grupos' : '✅ ¡Clasificado para la eliminatoria!'}</div>` : ''}
      <div class="row res-btns"><button class="btn huge" data-a="tourview">📊 GRUPOS</button>${out ? '<button class="btn big alt" data-a="title">MENÚ</button>' : '<button class="btn big alt" data-a="toshop">🛒 TIENDA</button><button class="btn big" data-a="nextnow">SIGUIENTE ▶</button>'}</div>
    </div>`;
    document.body.appendChild(ov); showRoulette(ov); return;
  }
  if (G.league) {
    const L = G.league;
    ov.innerHTML = `<div class="res ${R.win ? 'win' : R.draw ? '' : 'lose'}">
      <div class="kicker">LIGA${tierStars(G.ltier)} · ${roundName(G.round)}</div>
      <h2>${R.win ? 'VICTORIA' : R.draw ? 'EMPATE' : 'DERROTA'}</h2>
      <div class="rscore">${flagSVG(G.code)}<b>${M.score[0]}</b><i>-</i><b>${M.score[1]}</b>${flagSVG(G.enemy)}</div>
      <div class="rrow">Goles <b>${R.goals}</b></div>${moneyBox(R)}
      <div class="row res-btns"><button class="btn huge" data-a="lgres">📊 CLASIFICACIÓN</button>${L.done ? '' : '<button class="btn big alt" data-a="toshop">🛒 TIENDA</button>'}</div>
    </div>`;
    document.body.appendChild(ov); showRoulette(ov); return;
  }
  ov.innerHTML = `<div class="res ${R.win ? 'win' : 'lose'}">
    <div class="kicker">${roundName(G.round)}</div>
    <h2>${R.win ? 'VICTORIA' : 'ELIMINADO'}</h2>
    <div class="rscore">${flagSVG(G.code)}<b>${M.score[0]}</b><i>-</i><b>${M.score[1]}</b>${flagSVG(G.enemy)}</div>
    ${R.pens ? `<div class="mut">Empate a ${R.reg[0]}-${R.reg[1]} · decidido en los penaltis</div>` : ''}
    ${R.win ? `<div class="rrow">Goles <b>${R.goals}</b></div>${moneyBox(R)}` : `<div class="rrow">Llegaste al partido <b>${G.round + 1}</b> · Goles totales <b>${G.stats.goals}</b></div>`}
    ${R.win ? `<div class="row res-btns"><button class="btn huge" data-a="toshop">🛒 TIENDA</button><button class="btn big alt" data-a="nextnow">SIGUIENTE PARTIDO ▶</button></div>` : `<div class="row res-btns">${G.tour ? '<button class="btn big alt" data-a="tourview">🏆 VER CUADRO</button>' : ''}<button class="btn big gold" data-a="rerun">🔁 REJUGAR</button><button class="btn big" data-a="title">VOLVER AL MENÚ</button></div>`}
  </div>`;
  document.body.appendChild(ov);
  showRoulette(ov);
}

/* al volver de la tienda en pleno partido: cartas nuevas/mejoradas y estadísticas de jugadores cambiadas */
function syncAfterShop() {
  if (!M) return;
  { const old = M.hands[0].slice(), nh = []; G.cards.forEach(c => { const j = old.findIndex(h => h.k === c.k); if (j >= 0) { const h = old.splice(j, 1)[0]; if (!h.used) h.lv = c.lv; nh.push(h); } else nh.push({ k: c.k, lv: c.lv, used: false }); }); M.hands[0] = nh; }
  let old = []; try { old = JSON.parse(G.shopSnap || '[]'); } catch (e) { /* nada */ }
  G.caps.forEach((def, i) => {
    if (JSON.stringify(def) === JSON.stringify(old[i])) return;
    const b = M.w.bodies.find(x => x.kind === 'cap' && x.team === 0 && x.idx === i); if (!b) return;
    const nb = capBody(def, 0, i, Object.assign({}, M.S.mods && M.S.mods[0], { noAct: true })); nb.irid = b.irid; nb.actB = b.actB; if (b.actB) Object.keys(b.actB).forEach(k => { nb.st[k] = Math.min(12, nb.st[k] + b.actB[k]); });
    ['x', 'y', 'vx', 'vy', 'hx', 'hy', 'id', 'frozen', 'ang'].forEach(p => { nb[p] = b[p]; });
    Object.keys(b).forEach(p => delete b[p]); Object.assign(b, nb);
  });
  hudHand(); hudCap();
}
function render() {
  if (cv) cv.style.filter = '';
  hideTip();
  { const ca = document.getElementById('cardann'); if (ca) ca.remove(); }
  const ui = $('#ui');
  document.body.className = G.screen + (G.lab ? ' lab-on' : '');
  const s = G.screen;
  ui.innerHTML = s === 'title' ? renderTitle() : s === 'pick' ? renderPick() : s === 'friendly' ? renderFriendly() : s === 'versus' ? renderVersus() : s === 'shop' ? renderShop() : s === 'league' ? renderLeague() : s === 'tour' ? renderTour() : s === 'lgsetup' ? renderLgSetup() : s === 'match' ? renderMatch() : s === 'myteam' && typeof renderMyTeam === 'function' ? renderMyTeam() : '';
  if (s === 'match') { hudScore(); hudCap(); hudPerks(); hudHand(); hudLog(); }
  G.flash = null;
  if (s !== 'title' && s !== 'match' && !G.ro && !ui.querySelector('.p-head')) {
    const inRun = (s === 'shop' || s === 'versus' || s === 'league' || s === 'tour') && G.caps && G.caps.length;
    ui.insertAdjacentHTML('beforeend', `<button class="homebtn" data-a="gohome" data-run="${inRun ? 1 : 0}">⌂ MENÚ</button>`);
  }
  saveRun();
  drawPreviews(); drawHero(); fitPick();
}

/* ===================== TOOLTIP DE JUGADOR ===================== */
function tipHTML(o) {
  const st = o.st, dev = o.dev || 0, nst = o.stars || 1;
  const now = { POT: `vel. <b>${Math.round(o.vmax)}</b>`, PES: `masa <b>${(+o.m).toFixed(1)}</b>`, PRE: dev > 0 ? `desvío <b>±${(dev * 2).toFixed(0)}°</b>` : `<b>sin desvío</b>`, VIS: `ves el <b>${Math.round(visFrac(st) * 100)}%</b>`, MEN: st.MEN >= 7 ? `<b>${Math.round(Math.min(0.75, 0.2 + (st.MEN - 7) * 0.1) * 100)}%</b> de subir cada stat` : `<b>no sube</b> (hace falta 7+)` };
  return `<div class="tip-h"><b>${o.name}${o.captain ? ' <span class="capt">C</span>' : ''} <small>#${o.num}</small></b><span>${o.role} · <i class="gold">${'★'.repeat(nst)}</i></span></div>
    ${STAT_KEYS.map(k => `<div class="tip-r"><span class="tk">${STATS[k].icon} ${STATS[k].n}</span><b class="tn sv sv${svc(st[k])}">${Math.round(st[k] - ibSum(o.ib, k))}${ibChips(o.ib, k)}${o.actB && o.actB[k] ? `<small class="actb ${o.actB[k] < 0 ? 'neg' : ''}">${o.actB[k] > 0 ? '+' : '−'}${Math.abs(o.actB[k]).toFixed(1)}</small>` : ''}${o.psn && o.psn[k] ? `<small class="actb neg">−${o.psn[k]}</small>` : ''}</b><span class="tv">${now[k]}</span></div>`).join('')}
    ${[...new Set(o.abs || [])].map(k => { const n = abCount(o.abs, k); return `<div class="tip-a"><b>${ABILITIES[k].icon} ${ABILITIES[k].n}${n > 1 ? ' ×' + n : ''}</b> ${ABILITIES[k].d}</div>`; }).join('')}`;
}
function showTip(html, x, y) {
  const t = $('#tip'); if (!t) return;
  if (t.dataset.h !== html) { t.innerHTML = html; t.dataset.h = html; }
  t.classList.remove('hidden');
  const w = t.offsetWidth, h = t.offsetHeight;
  x /= UK; y /= UK;
  t.style.left = Math.min(window.innerWidth / UK - w - 8, x + 18) + 'px';
  t.style.top = Math.max(8, Math.min(window.innerHeight / UK - h - 8, y + 14)) + 'px';
}
const hideTip = () => { const t = $('#tip'); if (t) t.classList.add('hidden'); };
function capTip(e) {
  if (!M || M.over || G.screen !== 'match' || M.drag || M.phase === 'pen') return hideTip();
  const p = pointerField(e); let hit = null;
  M.w.bodies.forEach(b => { if (b.kind === 'cap' && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 6) hit = b; });
  if (!hit) return hideTip();
  showTip(tipHTML({ name: hit.name, num: hit.num, role: ROLES.find(r => r.k === hit.role).n + (hit.team === 0 ? '' : ' (rival)'), stars: hit.stars, abs: hit.abs, st: hit.st, ib: hit.ib, actB: hit.actB, psn: hit.psn, captain: hit.captain, vmax: hit.vmax, m: hit.m, r: hit.r, dev: (hit.poison ? POISON_DEV : hit.dev) * 180 / Math.PI }), e.clientX, e.clientY);
}
document.addEventListener('mousemove', e => {
  if (G.screen === 'pick') {
    const cv2 = e.target.closest && e.target.closest('.pcaps canvas.capv');
    if (!cv2) return hideTip();
    const d = playerTeam(cv2.dataset.code)[+cv2.dataset.i], inf = capInfo(d);
    return showTip(tipHTML({ name: d.name, num: d.num, role: ROLES[+cv2.dataset.i].n, stars: d.stars, abs: d.abs, st: inf.st, vmax: inf.vmax, m: inf.mass, r: inf.r, dev: inf.dev }), e.clientX, e.clientY);
  }
  /* en el vestuario (propio y rival) la ficha del jugador ya muestra todo: solo se explica el item sobre el que estás */
  if (G.screen !== 'shop') return;
  const it = e.target.closest && e.target.closest('[data-itip]');
  if (!it) return hideTip();
  const ab = ABILITIES[it.dataset.itip]; if (!ab) return hideTip();
  showTip(`<div class="tip-h"><b>${ab.icon} ${ab.n}</b></div><div class="tip-a" style="font-size:15px;line-height:1.4;white-space:normal;max-width:300px">${ab.d}</div>`, e.clientX, e.clientY);
});

/* ===================== ACCIONES ===================== */
function buy(i) {
  const it = G.shop.items[i]; if (!it || it.bought || G.pending) return;
  const price = itemPrice(it);
  if (!afford(price)) return toast('No tienes suficiente dinero 💸');
  if (it.kind === 'perk') {
    if (PERKS[it.key].use) {   // se activa al comprarla y no ocupa hueco de reliquia
      spend(price); it.bought = true; sfx.coin();
      if (it.key === 'aforo') { const add = G.money; G.money += add; toast('🏟 Aforo completo: +$' + add); }
      else if (it.key === 'junta') { G.money += 50; toast('💼 Junta de accionistas: +$50'); }
      else { G.slotBonus = (G.slotBonus || 0) + 1; toast('🎒 +1 hueco para comodines'); }
      render(); return;
    }   // se gasta al comprarla: no ocupa hueco de reliquia
    if (G.perks.length >= CONFIG.perkSlots) return toast('Tienes 4 reliquias: vende una (clic) para hacer hueco');
    if (G.perks.includes(it.key)) return toast('Ya tienes esa reliquia');
    spend(price); G.perks.push(it.key); (G.pu = G.pu || {})[it.key] = PERK_LIFE; it.bought = true; sfx.coin(); render(); return;
  }
  if (it.kind === 'item') {
    if (G.cards.length >= itemSlots()) return toast('Máximo ' + itemSlots() + ' cartas: vende una de las que tienes');
    spend(price); G.cards.push({ k: it.key, lv: 1 }); it.bought = true; G.flashCard = it.key; sfx.coin(); render(); return;
  }
  G.pending = { key: it.key, price, idx: i, kind: it.kind }; G.shopTab = 'team'; render();
}
function cardSellAct(i) { const c = G.cards[i]; if (!c) return; gain(cardSell(c)); G.cards.splice(i, 1); sfx.coin(); render(); }
function apply(i) {
  const pd = G.pending; if (!pd) return;
  if (!afford(pd.price)) { G.pending = null; return render(); }
  const cp = G.caps[i];
  if (pd.kind === 'star') {
    if ((cp.stars || 1) >= 5) return toast('Ese jugador ya tiene todas las estrellas');
    spend(pd.price); cp.stars = (cp.stars || 1) + 1; STAT_KEYS.forEach(k => { cp.stats[k] = Math.min(CONFIG.statMax, cp.stats[k] + STAR_BONUS); });
    G.shop.items[pd.idx].bought = true; G.pending = null; G.flash = i; G.shopTab = 'market'; sfx.coin(); render(); upgradeFx(cp, { kind: 'star', to: cp.stars }); return;
  }
  if (pd.kind === 'stat') {
    if (cp.stats[pd.key] >= CONFIG.statMax) return toast('Esa estadística ya está al máximo');
    const from = cp.stats[pd.key];
    spend(pd.price); cp.stats[pd.key] = Math.min(CONFIG.statMax, from + 2); G.shop.items[pd.idx].bought = true; G.pending = null; G.flash = i; G.shopTab = 'market'; sfx.coin(); render();
    upgradeFx(cp, { kind: 'stat', key: pd.key, from, to: cp.stats[pd.key] }); return;
  }
  if (abCount(cp.abs, pd.key) >= AB_MAX) return toast('Máximo 3 copias de la misma habilidad');
  if (cp.abs.length >= abSlots(cp.stars || 1)) return toast('Sin huecos: sube de estrella (3★ y 5★) o quita una habilidad ✕');
  spend(pd.price); cp.abs.push(pd.key); G.shop.items[pd.idx].bought = true; G.pending = null; G.flash = i; G.shopTab = 'market';
  sfx.coin(); render(); upgradeFx(cp, { kind: 'ab', key: pd.key });
}
/* animación corta al aplicar una mejora o habilidad a un jugador y vuelta a la tienda */
function upgradeFx(cp, o) {
  const old = $('#upfx'); if (old) old.remove();
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'upfx';
  let inner;
  if (o.kind === 'stat') inner = `<div class="up-stat"><div class="up-lbl">${STATS[o.key].icon} ${STATS[o.key].n}</div><div class="up-bar"><i style="width:${Math.min(100, o.from / 12 * 100)}%"></i></div><div class="up-num"><span>${Math.round(o.from)}</span> → <b>${Math.round(o.to)}</b><em>+${Math.round(o.to - o.from)}</em></div></div>`;
  else if (o.kind === 'star') inner = `<div class="up-star">${[1, 2, 3, 4, 5].map(n => `<span class="${n <= o.to ? 'on' : ''}${n === o.to ? ' new' : ''}">★</span>`).join('')}</div><div class="up-num"><b>+1 a todas las estadísticas</b></div>`;
  else inner = `<div class="up-ab"><div class="up-ic">${ABILITIES[o.key].icon}</div><b>${ABILITIES[o.key].n}</b><small>${ABILITIES[o.key].d}</small></div>`;
  ov.innerHTML = `<div class="res upcard"><div class="up-t">${o.kind === 'stat' ? '⬆ ¡MEJORA!' : o.kind === 'star' ? '⭐ ¡NUEVA ESTRELLA!' : '✨ ¡NUEVA HABILIDAD!'}</div><div class="up-who"><b>${cp.name}</b><span>${ROLES.find(r => r.k === cp.role).n} · ${'★'.repeat(cp.stars || 1)}</span></div>${inner}</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => requestAnimationFrame(() => { ov.classList.add('go'); const bar = ov.querySelector('.up-bar i'); if (bar) bar.style.width = Math.min(100, o.to / 12 * 100) + '%'; }));
  const close = () => { if (ov.parentNode) ov.remove(); };
  ov.onclick = close; setTimeout(close, o.kind === 'star' ? 1400 : 1500);
}
function starUp(i) {
  const c = G.caps[i], cost = disc(STAR_COST[c.stars || 1] * PM());
  if ((c.stars || 1) >= 5) return;
  if (!afford(cost)) return toast('No tienes suficiente dinero 💸');
  spend(cost); c.stars = (c.stars || 1) + 1; STAT_KEYS.forEach(k => { c.stats[k] = Math.min(CONFIG.statMax, c.stats[k] + STAR_BONUS); }); G.flash = i; sfx.coin(); render(); upgradeFx(c, { kind: 'star', to: c.stars }); toast(c.name + (c.stars === 3 || c.stars === 5 ? ': ¡nueva habilidad desbloqueada!' : ': +1 a todas las estadísticas')); render();
}
function statUp(i, k) {
  const c = G.caps[i], cost = statCost(c.stats[k]);
  if (c.stats[k] >= CONFIG.statMax) return;
  if (!afford(cost)) return toast('No tienes suficiente dinero 💸');
  spend(cost); c.stats[k]++; G.flash = i; sfx.coin(); render();
}

const ACTIONS = {
  gohome(el) {
    const b = el || document.querySelector('.homebtn');
    if (b && b.dataset.run === '1' && !b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = '¿Salir? Podrás pulsar CONTINUAR'; setTimeout(() => { if (b.isConnected) { b.classList.remove('arm'); b.textContent = '⌂ MENÚ'; } }, 2800); sfx.click(); return; }
    ACTIONS.title();
  },
  continuar() { const o = loadRun(); if (!o) { render(); return; } document.querySelectorAll('.overlay:not(#help)').forEach(x => x.remove()); M = null; G = o.G; Object.assign(TOUR_OPT, o.TOUR_OPT || {}); if (o.TOUR_RAND != null) TOUR_RAND = o.TOUR_RAND; render(); },
  title() { document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); G = { screen: 'title' }; M = null; render(); },
  help() { $('#help').classList.remove('hidden'); },
  closeHelp() { $('#help').classList.add('hidden'); },
  mute() { muted = !muted; render(); },
  pick() { G = { screen: 'pick', pickSel: 'ESP', pickLeague: 'SEL' }; render(); },
  plg(el) { G.pickLeague = el.dataset.k; G.pickSel = null; render(); sfx.click(); },
  friendly() { document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); M = null; FR.kind = 'match'; FR.picking = null; G = { screen: 'friendly' }; render(); },
  settings() { document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); M = null; G = { screen: 'friendly' }; render(); },
  squad(el) {
    document.querySelectorAll('#squad').forEach(o => o.remove());
    const Lg = LEAGUES.find(l => l.k === 'SEL'); SQ_LIST = Lg && Lg.codes.includes(el.dataset.c) ? sortCodes(Lg.codes) : [el.dataset.c];
    $('#ui').insertAdjacentHTML('beforeend', squadHTML(el.dataset.c));
  },
  squadnav(el) {
    const i = SQ_LIST.indexOf(el.dataset.c), n = SQ_LIST[(i + (+el.dataset.d) + SQ_LIST.length) % SQ_LIST.length];
    document.querySelectorAll('#squad').forEach(o => o.remove()); $('#ui').insertAdjacentHTML('beforeend', squadHTML(n)); sfx.click();
  },
  squadx() { document.querySelectorAll('#squad').forEach(o => o.remove()); },
  frpick(el) { FR.picking = +el.dataset.side; render(); sfx.click(); },
  frclose() { FR.picking = null; render(); },
  frlg(el) { FR['lg' + el.dataset.side] = el.dataset.k; render(); sfx.click(); },
  frchoose(el) { const sd = el.dataset.side, c = el.dataset.c; FR['c' + sd] = c; FR['f' + sd] = teamForm(c); FR.picking = null; render(); sfx.click(); },
  frform(el) { FR['f' + el.dataset.side] = el.dataset.v; render(); sfx.click(); },
  frset(el) { const v = el.dataset.v; FR[el.dataset.k] = isNaN(+v) ? v : +v; render(); sfx.click(); },
  frstart() { startFriendly(); },
  fdone() { const P = FR.pre; if (!P) return; P.i++; if (P.i < P.sides.length) friendlyShop(P.sides[P.i]); else playFriendly(); sfx.click(); },
  fcancel() { FR.pre = null; G = { screen: 'friendly' }; render(); },
  rerun() {   // rejugar torneo/liga manteniendo equipo, dinero, comodines y reliquias
    document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); M = null;
    G.stats = { goals: 0, wins: 0 }; G.shop = null; G.pending = null; G.reward = null; G.pu = {}; G.round = 0; G.tourFrom = null; G.inMatch = false; G.shopTab = 'team';
    if (G.league) { if (lgSorted()[0] === G.code && G.league.done) G.ltier = (G.ltier || 0) + 1; G.league = null; lgSetup(); return; }   // campeón de liga: sube de nivel
    if (G.tour && G.tour.champion) G.tier = (G.tier || 0) + 1;   // ganar el Mundial desbloquea el siguiente: más estrellas, rivales mejores
    G.tour = tourInit(G.code); G.enemyQueue = shuffle(poolOf(G.code).filter(c => c !== G.code)); nextEnemy(); G.screen = 'versus'; render();
  },
  frcards() { FR.cards = !FR.cards; render(); sfx.click(); },
  rematch() { const so = M && M.S.pens; document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); so ? startShootout() : startFriendly(); },
    frstart2() { FR.kind === 'pens' ? startShootout() : startFriendly(); },
  usecard(el) {
    if (!M || M.over) return;
    const side = handSide(), hand = M.hands[side]; if (!hand) return;
    const i = +el.dataset.i, c = hand[i]; if (!c) return;
    if (c.used) { c.gone = true; hudHand(); if (M.lab) labRender(); sfx.click(); return; }   // clic en una carta usada: se quita de la lista
    if (!oppWin() && (M.phase !== 'aim' || !M.human[M.turn] || (M.S.j2 && M.turn !== side))) return toast('Solo se pueden usar cartas en el turno propio');
    if (M.drag) return;
    if (M.cardBan && M.cardBan[side] > 0) return toast('🚫 Apagón: no puedes usar comodines (' + M.cardBan[side] + ' turno' + (M.cardBan[side] > 1 ? 's' : '') + ')');
    if (c.k === 'ladron' && M.hands[1 - side] !== M.hands[side] && !M.hands[1 - side].some(x => !x.used && !x.gone)) return toast('El rival no tiene comodines que robar');
    if (PICKS.includes(c.k)) { M.picking = { idx: i, k: c.k, side }; hudCap(); banner(CARDS[c.k].n.toUpperCase(), 'Haz clic en el jugador · clic derecho cancela', 1800); return; }
    runCard(side, i, null); if (M.waitWin && M.phase === 'move') M.seq++;   // la CPU cancela su tiro si el comodín cambia la jugada
  },
  pfin(el) { penStop(); },
  form(el) { G.form = el.dataset.v; render(); sfx.click(); },
  rmab(el) { const c = G.caps[+el.dataset.i]; if (!c) return; const k = c.abs[+el.dataset.j]; if (!k) return; gain(Math.floor(ABILITIES[k].price / 2)); c.abs.splice(+el.dataset.j, 1); G.flash = +el.dataset.i; sfx.coin(); render(); },
  nextnow() { document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); M = null; G.round++; nextEnemy(); G.reward = null; genShop(); G.screen = 'versus'; render(); },
  topt(el) { if (el.dataset.k === 'turns') TOUR_OPT.turns = +el.dataset.v; else TOUR_OPT.groups = el.dataset.v === '1'; render(); sfx.click(); },
  trand(el) { TOUR_RAND = el.dataset.v === '1'; render(); sfx.click(); },
  psort(el) { PICK_SORT = el.dataset.k; render(); sfx.click(); },
  psel(el) { G.pickSel = el.dataset.c; render(); sfx.click(); },
  go(el) { newRun(el.dataset.c); },
  play() { startMatch(); },
  rival() { G.roMatch = G.screen === 'match'; G.roBak = { caps: G.caps, code: G.code, tab: G.shopTab }; G.caps = G.enemyDefs; G.code = G.enemy; G.ro = true; G.shopTab = 'team'; G.screen = 'shop'; render(); },
  rivalback() { if (G.roBak) { G.caps = G.roBak.caps; G.code = G.roBak.code; G.shopTab = G.roBak.tab; G.roBak = null; } G.ro = false; if (G.roMatch) { G.roMatch = false; G.screen = 'match'; render(); syncAfterShop(); ACTIONS.menu(); return; } G.screen = 'versus'; render(); },
  myteam() { G.reward = null; if (!G.shop) genShop(); G.screen = 'shop'; G.fromVersus = true; render(); },
  tienda() { G.reward = null; G.shopTab = 'market'; if (!G.shop) genShop(); G.screen = 'shop'; G.fromVersus = true; render(); },
  versus() { G.screen = 'versus'; render(); },
  toshop() { G.shopTab = 'market'; document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); M = null; G.round++; nextEnemy(); G.screen = 'shop'; genShop(); G.reward = null; render(); },
  buy(el) { buy(+el.dataset.i); },
  apply(el) { apply(+el.dataset.i); },
  cancel() { G.pending = null; render(); },
  star(el) { starUp(+el.dataset.i); },
  stab(el) { G.shopTab = el.dataset.k; render(); sfx.click(); },
  cardsell(el) { cardSellAct(+el.dataset.i); },
  mshop() {
    if (!M || !M.run || M.phase !== 'aim') return;
    bankCash();
    const p = $('#pause'); if (p) p.remove();
    G.cards = G.cards.filter((c, i) => !(M.hands[0][i] && M.hands[0][i].used)); M.hands[0] = M.hands[0].filter(h => !h.used);   // los comodines ya usados se gastan: no aparecen en la tienda
    G.inMatch = true; G.shopSnap = JSON.stringify(G.caps); G.shopTab = 'market'; if (!G.shop) genShop(); G.pending = null; G.screen = 'shop'; render();
  },
  mroul() { if (!M || !M.run || M.so || M.phase !== 'aim' || !M.human[M.turn]) return; const p = $('#pause'); if (p) p.remove(); openMatchRoulette(); },
  mrclose() { closeMatchRoulette(); },
  mrgo() { mrSpin(); },
  mrtake() { closeMatchRoulette(); ACTIONS.mshop(); },
  mrback() { ACTIONS.mback(); if (M && M.phase === 'aim' && M.human[M.turn]) openMatchRoulette(); },
  mback() {
    G.fromRoul = false; G.inMatch = false; G.pending = null; G.screen = 'match'; render(); syncAfterShop();
  },
  stat(el) { statUp(+el.dataset.i, el.dataset.k); },
  reroll() { const c = G.shop.rc, p = c * PM(); if (!afford(p)) return toast('No tienes suficiente dinero 💸'); spend(p); genShop(c + 1); sfx.click(); render(); },
  sellperk(el) { const i = +el.dataset.i, k = G.perks[i]; if (!k) return; gain(Math.floor(PERKS[k].price / 2)); G.perks.splice(i, 1); sfx.coin(); render(); },
  menu() {
    if ($('#pause')) return;
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'pause';
    ov.innerHTML = '<div class="res"><h2>PAUSA</h2><div class="row"><button class="btn big" data-a="resume">SEGUIR</button>' + (M && M.run && !M.so ? '<button class="btn big gold" data-a="mshop" ' + (M.phase === 'aim' && M.human[M.turn] ? '' : 'disabled title="Solo en el turno propio, con el balón parado"') + '>🛒 TIENDA</button>' : '') + (G.enemyDefs && M && !M.lab ? '<button class="btn big alt" data-a="rival">👁 VESTUARIO RIVAL</button>' : '') + '<button class="btn big pen" data-a="restart">🔄 REINICIAR PARTIDO</button>'  + '<button class="btn ghost" data-a="title">ABANDONAR</button></div></div>';
    document.body.appendChild(ov);
  },
  replay() { startReplay(); },
  goon() { goOn(); },
  skiprep() { endReplay(); },
  penrep() {
    const el = $('#cardann'); if (!M || !M.penRec || !el || M.phase !== 'pen') return;
    el.style.display = 'none'; cv.style.filter = 'sepia(.5)'; fx.trail = [];
    M.replay = { fr: M.penRec, i: 0, acc: 0, hold: 0, el, back: M.w.bodies.map(b => [b, b.x, b.y, b.ang, b.airH]) }; M.phase = 'replay';
    const bar = document.createElement('div'); bar.id = 'replaybar'; bar.className = 'goalbar';
    bar.innerHTML = '<button class="btn big alt" data-a="skiprep">SALTAR ▶</button>'; document.body.appendChild(bar);
  },
  restart() { const p = $('#pause'); if (p) p.remove(); M.seq++; clearTimeout(M.goalTimer); ['goalbar', 'replaybar'].forEach(i => { const e = $('#' + i); if (e) e.remove(); }); M.S.pens ? startShootout() : M.run ? startMatch() : startFriendly(); },
  frpens() { FR.kind = FR.kind === 'pens' ? 'match' : 'pens'; render(); sfx.click(); },
  resume() { const p = $('#pause'); if (p) p.remove(); },
};
/* el primer enfrentamiento puede venir del modo debug con ronda inicial */
const _go = ACTIONS.go;
ACTIONS.go = el => { const dbg = G.debug, sr = G.startRound || 0, lg = G.liga; newRun(el.dataset.c, { debug: dbg, round: lg ? 0 : sr, liga: lg }); if (lg) lgSetup(); };

ACTIONS.lang = el => { setLang(el.dataset.l); render(); };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const f = ACTIONS[el.dataset.a];
  if (f) { try { actx().resume(); } catch (er) { /* nada */ } f(el); }
});
document.addEventListener('input', e => {
  const s = e.target.dataset && e.target.dataset.frm; if (s == null) return;
  FR.money[+s] = +e.target.value; const b = document.getElementById('frm' + s); if (b) b.textContent = '$' + e.target.value;
  const st = document.querySelector('[data-a="frstart2"]'); if (st && FR.kind !== 'pens') st.textContent = (FR.money[0] > 0 || (FR.mode === 'j2' && FR.money[1] > 0)) ? '🛒 A LA TIENDA ▶' : '¡A JUGAR!';
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.s; if (!k) return;
  FR[k] = e.target.value;
  if (k === 'lg0') FR.c0 = LEAGUES.find(l => l.k === FR.lg0).codes[0];
  if (k === 'lg1') FR.c1 = LEAGUES.find(l => l.k === FR.lg1).codes[0];
  if (k === 'lg0' || k === 'c0') FR.f0 = teamForm(FR.c0);
  if (k === 'lg1' || k === 'c1') FR.f1 = teamForm(FR.c1);
  render();
});
document.addEventListener('keydown', e => {
  if (!M || G.screen !== 'match') return;
  if (e.key === ' ' && M.phase === 'pen') { e.preventDefault(); if (M.pen && M.pen.human) penStop(); else gkStop(); }
  else if (e.key === 'Escape') ACTIONS.menu();
});

/* ===================== ARRANQUE ===================== */
function boot() {
  cv = $('#cv'); cx = cv.getContext('2d');
  preloadFlags();
  window.addEventListener('resize', resize);
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('contextmenu', e => { e.preventDefault(); cancelAim(); });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  resize(); render();
  requestAnimationFrame(frame);
}
if (typeof document !== 'undefined' && document.getElementById('cv')) boot();
