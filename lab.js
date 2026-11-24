/* ===================== LABORATORIO DE DEBUG =====================
   Campo con 2 equipos y un panel lateral para probar de todo:
   estadísticas de cada jugador (subir/bajar), habilidades, comodines, reliquias, balón, campo...   */
const LABW = 350;
const LAB = { c0: 'ESP', c1: 'ARG', defs: null, perks: [], field: 'normal', ballType: 'normal', nBalls: 1, ai: false, side: 0, sel: 0, lv: 1, rf: null, rs: 'none', open: { cards: true, perks: true, abs: true }, form: ['2-2', '1-3'] };

LAB.act = [[], []]; LAB.goat = [{}, {}];
const svcl = v => Math.min(12, Math.max(7, Math.round(v)));
const svCol = v => v >= 11 ? '#c77dff' : v >= 10 ? '#ff4d4d' : v >= 9 ? '#ff8a00' : v >= 8 ? '#ffd000' : '#ffffff';
const RAR_N = ['Común', 'Rara', 'Épica'], RAR_C = ['#9fb4d2', '#4aa8ff', '#c77dff'];
function labList(keys, rarOf) {
  let l = keys.filter(k => LAB.rf == null || rarOf(k) === LAB.rf);
  if (LAB.rs !== 'none') l = l.slice().sort((a, b) => (rarOf(a) - rarOf(b)) * (LAB.rs === 'asc' ? 1 : -1));
  return l;
}
const labBadge = (a, k) => (a && a[k]) ? (a[k] < 0 ? '−' : '+') + Math.abs(a[k]).toFixed(1) : '';
function labBadges() { const a = LAB.act[LAB.side][LAB.sel]; STAT_KEYS.forEach(k => { const e = document.getElementById('lbb-' + k); if (e) { e.textContent = labBadge(a, k); e.classList.toggle('neg', !!(a && a[k] < 0)); } }); }
const labOn = () => !!(G && G.lab && M);
const labDefs = code => playerTeam(code).map(d => Object.assign({}, d, { stats: Object.assign({}, d.stats), abs: (d.abs || []).slice() }));

function labMods(team) {
  return { noAct: false, form: LAB.form[team], pot: LAB.perks.includes('hinchada') ? 1.12 : 1, gk: 0, capMen: LAB.perks.includes('brazalete') };
}

/* foto de todos los jugadores y balones justo antes de un tiro (o de un comodín) para poder repetir la jugada */
function labSnap() {
  if (!M || !M.lab || M.labCapt) return;
  M.labCapt = true;
  M.labSnap = { bodies: M.w.bodies.map(b => ({ id: b.id, x: b.x, y: b.y })), score: M.score.slice(), turn: M.turn, rot: M.rot };
}
function labRepeat() {
  const S = M && M.lab && M.labSnap; if (!S) { toast('Aún no has hecho ningún tiro'); return; }
  const w = M.w, ids = new Set(S.bodies.map(b => b.id));
  clearTimeout(M.goalTimer); ['goalbar', 'replaybar', 'cardann'].forEach(i => { const e = document.getElementById(i); if (e) e.remove(); });
  document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove());
  M.seq++; M.over = false; M.pen = null; M.penAward = null; M.penCand = null; M.picking = null; M.drag = null; M.aim = null; M.keepTurn = false; M.free = false; M.extra = [0, 0];
  w.bodies = w.bodies.filter(b => ids.has(b.id)); w.balls = w.balls.filter(b => ids.has(b.id));
  S.bodies.forEach(p => { const b = w.bodies.find(q => q.id === p.id); if (!b) return; b.x = p.x; b.y = p.y; b.vx = b.vy = 0; b.spin = 0; b.shotNow = false; if (b.frozen) { b.frozen = 0; if (b.mOrig) b.m = b.mOrig; } b.airH = null; });
  w.goal = null; M.score = S.score.slice(); M.turn = S.turn; M.rot = S.rot; M.phase = 'aim'; M.playTeam = null; M.play = null; M.sel = null; M.labCapt = false; fx.trail = [];
  hudScore(); hudCap(); hudHand(); sfx.click();
  toast('↩ Jugada repetida: todo vuelve a estar como antes del último tiro');
}

function startLab(keepDefs, keepPos) {
  /* foto de las posiciones actuales para conservarlas al cambiar equipo, balones, etc. */
  let snap = null;
  if (keepPos && M && M.lab) snap = { caps: M.w.bodies.filter(b => b.kind === 'cap').map(b => ({ t: b.team, i: b.idx, x: b.x, y: b.y })), balls: M.w.balls.map(b => ({ x: b.x, y: b.y })), hands: M.hands, score: M.score.slice(), turn: M.turn };
  document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove());
  ['goalbar', 'replaybar', 'pause'].forEach(i => { const e = document.getElementById(i); if (e) e.remove(); });
  if (M) { M.seq++; clearTimeout(M.goalTimer); }
  if (!keepDefs || !LAB.defs) LAB.defs = [labDefs(LAB.c0), labDefs(LAB.c1)];
  LAB.defs.forEach((t, k) => t.forEach(d => { d.captain = (k === 0 ? LAB.c0 : LAB.c1) === 'GLO' ? d.role === 'EXT' : d.role === 'MED'; }));
  G = { screen: 'match', mode: 'friendly', lab: true, debug: false, money: 0, code: LAB.c0, enemy: LAB.c1, caps: [], perks: LAB.perks, cards: [], round: 0, stats: { goals: 0, wins: 0 } };
  const d1 = LAB.defs[1].slice();
  LAB.rojaIdx = null; if (LAB.perks.includes('roja')) { LAB.rojaIdx = 1 + rnd(4); d1[LAB.rojaIdx] = null; }
  const gwR = FIELD.gw * (LAB.perks.includes('arco') ? 1.25 : 1);
  beginMatch({
    codes: [LAB.c0, LAB.c1], defs: [LAB.defs[0], d1], human: [true, !LAB.ai], field: LAB.field, ballType: LAB.ballType, nBalls: LAB.nBalls,
    turns: [999, 999], mods: [labMods(0), labMods(1)], gwR, round: 0, run: false, j2: !LAB.ai,
    hands: [[], []], lab: true,
  });
  if (snap) {
    snap.caps.forEach(p => { const c = M.w.bodies.find(b => b.kind === 'cap' && b.team === p.t && b.idx === p.i); if (c) { c.x = p.x; c.y = p.y; } });
    snap.balls.forEach((p, i) => { const b = M.w.balls[i]; if (b) { b.x = p.x; b.y = p.y; } });
    M.hands = snap.hands.slice(); M.score = snap.score; M.turn = snap.turn; M.rot = snap.turn;
  }
  if (!LAB.ai) M.hands[1] = M.hands[0];   // comodines comunes a los dos equipos
  LAB.act = [[], []]; LAB.goat = [{}, {}]; M.w.bodies.filter(b => b.kind === 'cap').forEach(b => { LAB.goat[b.team][b.idx] = b.goat; LAB.act[b.team][b.idx] = b.actB || null; });
  if (LAB.perks.includes('ventaja')) M.score[0] = 1;
  if (LAB.perks.includes('guardian')) M.gkHome[0] = 999;
  M.lab = true;
  document.body.classList.add('lab-on');
  render(); labRender();
}

/* marca en el listado los comodines que ya están en la mano (los usados vuelven a estar disponibles) */
function labHave() { if (!M || !M.lab) return; const h = M.hands[handSide()] || []; document.querySelectorAll('.lb-card').forEach(e => e.classList.toggle('have', h.some(c => c.k === e.dataset.k && !c.used && !c.gone))); }

/* clic sobre un jugador del campo: se selecciona en el panel para editarla */
function labPick(p) {
  let best = null, bd = 1e9;
  M.w.bodies.forEach(b => { if (b.kind === 'cap') { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < b.r + 16 && d < bd) { bd = d; best = b; } } });
  if (best && !LAB.ai && M.phase === 'aim' && !M.over && !M.pen && best.team !== M.turn) { M.turn = best.team; M.rot = best.team; M.keepTurn = false; hudScore(); hudHand(); }   // al clicar una chapa, el turno pasa a su equipo
  if (best && (best.team !== LAB.side || best.idx !== LAB.sel)) { LAB.side = best.team; LAB.sel = best.idx; labRender(); }
}

/* recalcula el cuerpo de un jugador (stats, tamaño, masa...) conservando su posición */
function labRebuild(team, i) {
  if (!labOn()) return;
  // los items de equipo (Gran Capitán…) afectan a los compañeros: se recalcula todo el equipo y se vuelven a aplicar
  LAB.defs[team].forEach((x, j) => labRebuild1(team, j));
  applyCaptain(M.w, team);
  hudCap(); hudScore();
}
function labRebuild1(team, i) {
  const def = LAB.defs[team][i]; if (!def) return;
  const cap = M.w.bodies.find(b => b.kind === 'cap' && b.team === team && b.idx === i); if (!cap) return;
  const nb = capBody(def, team, i, Object.assign(labMods(team), { fixAct: LAB.act[team][i], fixGoat: LAB.goat[team][i] }));
  LAB.goat[team][i] = nb.goat;
  LAB.act[team][i] = nb.actB || null;
  ['r', 'm', 'dec', 'vmax', 'abs', 'st', 'stars', 'dev', 'irid', 'actB', 'captain', 'role', 'name', 'num', 'mot', 'poison', 'psn', 'goat', 'rock', 'ib'].forEach(k => { cap[k] = nb[k]; });
  cap.m0 = cap.m;
  if (team === LAB.side && i === LAB.sel) labBadges();
}
/* tarjeta roja en vivo: al activarla desaparece un jugador rival (no el portero); al quitarla vuelve a la posición inicial */
function labRoja(on) {
  const w = M.w;
  if (on) {
    const c = w.bodies.filter(b => b.kind === 'cap' && b.team === 1 && b.idx >= 1);
    if (!c.length) return;
    const v = pick(c); LAB.rojaIdx = v.idx; w.bodies.splice(w.bodies.indexOf(v), 1);
    fx.rings.push({ x: v.x, y: v.y, t: 0, v: 1.4 }); toast('🟥 Tarjeta roja: ' + v.name + ' fuera');
  } else if (LAB.rojaIdx != null) {
    const idx = LAB.rojaIdx; LAB.rojaIdx = null;
    if (w.bodies.some(b => b.kind === 'cap' && b.team === 1 && b.idx === idx)) return;
    const nb = capBody(LAB.defs[1][idx], 1, idx, labMods(1)); w.bodies.unshift(nb);
    fx.rings.push({ x: nb.x, y: nb.y, t: 0, v: 1.4 }); toast('🟥 ' + nb.name + ' vuelve al campo');
  }
}
function labRebuildAll() { for (const t of [0, 1]) LAB.defs[t].forEach((d, i) => labRebuild(t, i)); const w = M.w; setGoalWidths(w, M.gw ? M.gw[0] : FIELD.gw, FIELD.gw * (LAB.perks.includes('arco') ? 1.25 : 1)); pitchKey = ''; }

const labCurDef = () => LAB.defs[LAB.side][LAB.sel];

function labRender() {
  let p = document.getElementById('lab');
  if (!labOn()) { if (p) p.remove(); document.body.classList.remove('lab-on'); return; }
  if (!p) { p = document.createElement('div'); p.id = 'lab'; document.body.appendChild(p); }
  const d = labCurDef(), R = ROLES.find(r => r.k === d.role);
  const teamOpts = c => CODES.map(k => `<option value="${k}" ${k === c ? 'selected' : ''}>${COUNTRIES[k].n}</option>`).join('');
  const caps = [0, 1].map(t => `<div class="lb-team">${LAB.defs[t].map((x, i) => `<button class="lb-cap ${LAB.side === t && LAB.sel === i ? 'on' : ''} t${t}" style="background-image:url('${flagURI(t ? LAB.c1 : LAB.c0)}')" data-a="labcap" data-t="${t}" data-i="${i}" title="${x.name} · ${x.role}"><span>${x.num}</span></button>`).join('')}</div>`).join('');
  const stats = STAT_KEYS.map(k => `<div class="lb-row"><span>${STATS[k].icon} ${k}</span><input type="range" min="1" max="12" step="0.5" value="${d.stats[k]}" data-lab="stat" data-k="${k}" style="accent-color:${svCol(d.stats[k])}"><b id="lbv-${k}" class="sv sv${svcl(d.stats[k])}">${d.stats[k]}</b><small id="lbb-${k}" class="lbb ${((LAB.act[LAB.side][LAB.sel] || {})[k] || 0) < 0 ? 'neg' : ''}">${labBadge(LAB.act[LAB.side][LAB.sel], k)}</small></div>`).join('');
  const abs = Object.keys(ABILITIES).map(k => { const n = abCount(d.abs, k); return `<button class="chip ${n ? 'on' : ''}" data-a="labab" data-k="${k}" data-atip="${k}">${ABILITIES[k].icon} ${ABILITIES[k].n}${n ? ' ×' + n : ''}</button>`; }).join('');
  const cRar = k => rarityOf(CARDS[k].price), pRar = k => rarityOf(PERKS[k].price);
  const filt = `<div class="lb-line lb-filt"><button class="chip ${LAB.rf == null ? 'on' : ''}" data-a="labrf" data-v="">Todas</button>${RAR_N.map((n, i) => `<button class="chip ${LAB.rf === i ? 'on' : ''}" style="border-color:${RAR_C[i]}" data-a="labrf" data-v="${i}">${n}</button>`).join('')}<button class="chip ${LAB.rs !== 'none' ? 'on' : ''}" data-a="labrs">Orden: ${LAB.rs === 'none' ? 'normal' : LAB.rs === 'asc' ? 'rareza ↑' : 'rareza ↓'}</button></div>`;
  const cards = labList(CARD_KEYS, cRar).map(k => `<button class="lb-card r${cRar(k)} ${(M.hands[handSide()] || []).some(c => c.k === k && !c.used && !c.gone) ? 'have' : ''}" data-a="labcard" data-k="${k}" title="${CARDS[k].n}: ${CARDS[k].d(LAB.lv)}"><i>${ART[k]}</i><span>${CARDS[k].n}</span></button>`).join('');
  const perks = labList(Object.keys(PERKS), pRar).map(k => `<button class="chip lbr${pRar(k)} ${LAB.perks.includes(k) ? 'on' : ''}" data-a="labperk" data-k="${k}" data-ptip="${k}">${PERKS[k].icon} ${PERKS[k].n}</button>`).join('');
  const sec = (id, title, body) => `<div class="lb-sec"><button class="lb-h" data-a="labopen" data-k="${id}">${LAB.open[id] ? '▼' : '▶'} ${title}</button>${LAB.open[id] ? body : ''}</div>`;
  p.innerHTML = `<div class="lb-top"><b>🧪 LABORATORIO</b><button class="btn mini ghost" data-a="labexit">✕ Salir</button></div>
    <div class="lb-sec"><div class="lb-line"><label>Equipo 1 <select data-lab="c0">${teamOpts(LAB.c0)}</select></label><label>Equipo 2 <select data-lab="c1">${teamOpts(LAB.c1)}</select></label></div>
      <div class="lb-line"><button class="btn mini ${LAB.ai ? '' : 'alt'}" data-a="labai">🤖 Rival CPU: ${LAB.ai ? 'SÍ' : 'NO (manejo ambos)'}</button></div>
      <div class="lb-line"><span class="mut">Turno:</span><button class="btn mini ${handSide() === 0 ? '' : 'ghost'}" data-a="labturn" data-t="0">▶ Equipo 1</button><button class="btn mini ${handSide() === 1 ? '' : 'ghost'}" data-a="labturn" data-t="1">▶ Equipo 2</button></div>
      <div class="lb-line"><button class="btn mini" data-a="labreset">↺ Recolocar</button><button class="btn mini gold" data-a="labrepeat" title="Vuelve a dejar a todos los jugadores y el balón donde estaban justo antes del último tiro (o comodín)">↩ Repetir tiro</button><button class="btn mini" data-a="labrestart">⟳ Reiniciar partido</button><button class="btn mini ghost" data-a="labscore">0-0</button></div></div>
    <div class="lb-sec"><div class="lb-h2">JUGADOR <small>(o pulsa Equipo/rol)</small></div>${caps}
      <div class="lb-name"><b>${d.name}</b> · ${R.n} · <span class="gold">${'★'.repeat(d.stars || 1)}</span>
        <button class="s" data-a="labstars" data-d="-1">−★</button><button class="s" data-a="labstars" data-d="1">+★</button></div>
      ${stats}
      <div class="lb-line"><button class="btn mini" data-a="labmen">🎲 Recalcular mentalidad</button><button class="btn mini ghost" data-a="labgoat">🐐 GOAT sí/no</button><button class="btn mini ghost" data-a="labset" data-v="1">Todo a 1</button><button class="btn mini ghost" data-a="labset" data-v="6">Todo a 6</button><button class="btn mini ghost" data-a="labset" data-v="12">Todo a 12</button><button class="btn mini ghost" data-a="labteam">Copiar a todo el equipo</button></div></div>
    ${sec('abs', 'HABILIDADES del jugador', `<div class="lb-chips">${abs}</div>`)}
    ${sec('cards', 'COMODINES' + (LAB.ai ? ' (mano de Equipo 1)' : ' (comunes a los dos equipos)'), `${filt}<div class="lb-line"><button class="btn mini ghost" data-a="labclear">Vaciar mano</button></div><div class="lb-cards">${cards}</div>`)}
    ${sec('perks', 'RELIQUIAS (Equipo 1)', `${filt}<div class="lb-chips">${perks}</div><div class="mut" style="font-size:11px">Algunas (ventaja, roja, guardián…) se aplican al «Reiniciar partido».</div>`)}
    <div class="lb-sec"><div class="lb-h2">CAMPO Y BALÓN</div><div class="lb-line">
      <label>Campo <select data-lab="field">${['normal', ...FIELD_KEYS].map(k => `<option value="${k}" ${LAB.field === k ? 'selected' : ''}>${k === 'normal' ? 'Normal' : FIELDS[k].n}</option>`).join('')}</select></label>
      <label>Balón <select data-lab="ball">${['normal', ...BALL_KEYS].map(k => `<option value="${k}" ${LAB.ballType === k ? 'selected' : ''}>${k === 'normal' ? 'Normal' : BALLS[k].n}</option>`).join('')}</select></label>
      <label>Nº balones <select data-lab="nb">${[1, 2, 3, 4].map(n => `<option value="${n}" ${LAB.nBalls === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div></div>`;
}

const labSetStat = (d, k, v) => { d.stats[k] = Math.max(1, Math.min(12, Math.round(v * 2) / 2)); };
Object.assign(ACTIONS, {
  labcap(el) { LAB.side = +el.dataset.t; LAB.sel = +el.dataset.i; const c = M.w.bodies.find(b => b.kind === 'cap' && b.team === LAB.side && b.idx === LAB.sel); if (c) M.sel = c.id; hudCap(); labRender(); },
  labstat(el) { const d = labCurDef(); labSetStat(d, el.dataset.k, d.stats[el.dataset.k] + +el.dataset.d); labRebuild(LAB.side, LAB.sel); labRender(); },
  labgoat() { const d = labCurDef(); if (!d.abs.includes('goat')) return toast('Primero ponle la habilidad GOAT'); LAB.goat[LAB.side][LAB.sel] = !LAB.goat[LAB.side][LAB.sel]; labRebuild(LAB.side, LAB.sel); labRender(); },
  labmen() { LAB.act[LAB.side][LAB.sel] = undefined; delete LAB.goat[LAB.side][LAB.sel]; labRebuild(LAB.side, LAB.sel); labRender(); },
  labset(el) { const d = labCurDef(); STAT_KEYS.forEach(k => labSetStat(d, k, +el.dataset.v)); LAB.act[LAB.side][LAB.sel] = undefined; labRebuild(LAB.side, LAB.sel); labRender(); },
  labteam() { const d = labCurDef(); LAB.defs[LAB.side].forEach((x, i) => { STAT_KEYS.forEach(k => { x.stats[k] = d.stats[k]; }); x.stars = d.stars; LAB.act[LAB.side][i] = undefined; labRebuild(LAB.side, i); }); labRender(); },
  labstars(el) { const d = labCurDef(); d.stars = Math.max(1, Math.min(5, (d.stars || 1) + +el.dataset.d)); labRebuild(LAB.side, LAB.sel); labRender(); },
  labab(el) { const d = labCurDef(), k = el.dataset.k; if (abCount(d.abs, k) >= AB_MAX) return toast('Máximo 3 copias de la misma habilidad (clic derecho para quitar una)');
    if (d.abs.length >= 3) return toast('Máximo 3 habilidades por jugador: quita una con clic derecho');
    d.abs.push(k); delete LAB.goat[LAB.side][LAB.sel]; labRebuild(LAB.side, LAB.sel); labRender(); },
  labcard(el) {
    const h = M.hands[handSide()], k = el.dataset.k;
    if (h.some(c => c.k === k && !c.used && !c.gone)) return toast('Ya tienes ese comodín en la mano');
    h.push({ k, lv: 1, used: false }); hudHand(); labRender(); sfx.click();
  },
  labclear() { M.hands[handSide()].length = 0; hudHand(); labRender(); },
  labperk(el) {
    const k = el.dataset.k, i = LAB.perks.indexOf(k);
    if (i >= 0) LAB.perks.splice(i, 1); else LAB.perks.push(k);
    if (k === 'roja') labRoja(i < 0);
    labRebuildAll(); labRender();
  },
  labrf(el) { LAB.rf = el.dataset.v === '' ? null : +el.dataset.v; labRender(); },
  labrs() { LAB.rs = LAB.rs === 'none' ? 'asc' : LAB.rs === 'asc' ? 'desc' : 'none'; labRender(); },
  labopen(el) { LAB.open[el.dataset.k] = !LAB.open[el.dataset.k]; labRender(); },
  labturn(el) { if (M.over || M.pen) return; M.turn = +el.dataset.t; M.rot = M.turn; M.phase = 'aim'; M.sel = null; M.play = null; M.playTeam = null; M.keepTurn = false; hudScore(); hudCap(); hudHand(); labRender(); },
  labai() { LAB.ai = !LAB.ai; startLab(true, true); },
  labrepeat() { labRepeat(); },
  labreset() { resetKickoff(M.w); M.w.noGoal = true; fx.trail = []; M.phase = 'aim'; M.sel = null; M.play = null; M.playTeam = null; M.turn = M.turn || 0; hudScore(); hudCap(); },
  labrestart() { startLab(true); },
  labscore() { M.score = [0, 0]; M.goals = [0, 0]; hudScore(); },
  labexit() { const p = document.getElementById('lab'); if (p) p.remove(); document.body.classList.remove('lab-on'); ACTIONS.title(); },
  lab() { startLab(false); },
});

/* sliders de estadísticas: se actualizan en vivo sin recrear el panel (para poder arrastrar) */
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || t.dataset.lab !== 'stat' || !labOn()) return;
  const d = labCurDef(), k = t.dataset.k; labSetStat(d, k, +t.value);
  const v = document.getElementById('lbv-' + k); if (v) { v.textContent = d.stats[k]; v.className = 'sv sv' + svcl(d.stats[k]); }
  t.style.accentColor = svCol(d.stats[k]);
  if (k === 'MEN') LAB.act[LAB.side][LAB.sel] = undefined;   // al cambiar la mentalidad se recalculan sus mejoras
  labRebuild(LAB.side, LAB.sel);
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.lab; if (!k || !labOn() || k === 'stat') return;
  const v = e.target.value, w = M.w;
  if (k === 'c0' || k === 'c1') { LAB[k] = v; LAB.defs = null; LAB.sel = 0; startLab(false, true); return; }
  if (k === 'lv') { LAB.lv = +v; labRender(); return; }
  if (k === 'nb') { LAB.nBalls = +v; startLab(true, true); return; }
  if (k === 'field') { LAB.field = v; if (v === 'normal') clearField(w); else applyField(w, v); M.S.field = v; pitchKey = ''; hudScore(); }
  else if (k === 'ball') {
    LAB.ballType = v; M.S.ballType = v;
    w.balls.forEach(b => { const nb = ballBody(v); ['x', 'y', 'vx', 'vy', 'id', 'ox', 'oy', 'ang', 'lastTeam', 'lastX'].forEach(p => { if (b[p] !== undefined) nb[p] = b[p]; }); nb.chg = 0; Object.keys(b).forEach(p => delete b[p]); Object.assign(b, nb); });
    hudScore();
  }
  e.target.blur();
});

/* el panel desaparece si se sale del laboratorio */
setInterval(() => { const p = document.getElementById('lab'); if (p && !labOn()) { p.remove(); document.body.classList.remove('lab-on'); } }, 600);

/* clic derecho sobre una habilidad del listado: quita una copia del jugador elegido */
document.addEventListener('contextmenu', e => {
  const b = e.target.closest && e.target.closest('[data-a="labab"]'); if (!b || !labOn()) return;
  e.preventDefault();
  const d = labCurDef(), i = d.abs.lastIndexOf(b.dataset.k); if (i < 0) return;
  d.abs.splice(i, 1); delete LAB.goat[LAB.side][LAB.sel]; labRebuild(LAB.side, LAB.sel); labRender(); sfx.click();
});

/* arrastrar el balón (clic izquierdo) o clic derecho + arrastrar un jugador/balón: lo coloca donde lo sueltes (solo laboratorio) */
(() => {
  let mv = null, mvBtn = 2;
  const field = e => pointerField(e);
  document.addEventListener('pointerdown', e => {
    if ((e.button !== 2 && e.button !== 0) || !e.target || e.target.id !== 'cv' || !labOn() || M.phase === 'pen') return;
    const p = field(e); let best = null, bd = 1e9;
    M.w.bodies.forEach(b => { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < b.r + (b.kind === 'ball' ? 20 : 14) && d < bd - (b.kind === 'ball' ? 8 : 0)) { bd = d; best = b; } });   // también el balón
    if (e.button === 0) { best = null; M.w.balls.forEach(b => { if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + 8) best = b; }); }   // clic izquierdo: solo el balón
    if (!best) return;
    mvBtn = e.button === 0 ? 1 : 2; mv = best; best.vx = best.vy = 0; if (best.kind === 'cap') labPick(p);
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
  }, true);
  document.addEventListener('pointermove', e => {
    if (!mv || !labOn()) return;
    if (!(e.buttons & mvBtn)) { mv = null; return; }
    const p = field(e);
    mv.x = Math.max(mv.r, Math.min(FIELD.W - mv.r, p.x)); mv.y = Math.max(mv.r, Math.min(FIELD.H - mv.r, p.y)); mv.vx = mv.vy = 0;
  });
  const end = () => { mv = null; };
  document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true);
})();

/* modal al pasar el ratón por las reliquias del laboratorio */
let labTipOn = false;
document.addEventListener('mousemove', e => {
  const c = e.target.closest && e.target.closest('[data-ptip],[data-atip]');
  if (!c) { if (labTipOn) { labTipOn = false; hideTip(); } return; }
  const isA = c.dataset.atip != null, p = isA ? ABILITIES[c.dataset.atip] : PERKS[c.dataset.ptip]; if (!p) return; labTipOn = true;
  const sub = isA ? 'Habilidad · $' + p.price : 'Reliquia · $' + p.price;
  const extra = isA ? '<div class="mut" style="font-size:12px;margin-top:6px">Clic: +1 copia (máx. 3) · Clic derecho: quitar una</div>' : '';
  showTip(`<div class="tip-h"><b>${p.icon} ${p.n}</b><span>${sub}</span></div><div class="tip-a" style="font-size:15px;line-height:1.4;white-space:normal">${p.d}</div>${extra}`, e.clientX - 330, e.clientY);
});
