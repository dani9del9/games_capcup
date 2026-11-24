/* ===================== MODO LIGA (10 equipos, todos contra todos) ===================== */
const LG_N = 10;
const LG_POSW = [0.03, 0.14, 0.24, 0.27, 0.32];   // probabilidad de que marque cada puesto (POR, DEF, MED, EXT, DEL)
const _qc = {};
const lgQ = c => (_qc[c] = _qc[c] || rating(playerTeam(c)) / 10 * 2.5);   // nivel real del equipo (media de sus chapas)

function lgFixtures() {
  let a = Array.from({ length: LG_N }, (_, i) => i); const out = [];
  for (let r = 0; r < LG_N - 1; r++) {
    const pairs = []; for (let i = 0; i < LG_N / 2; i++) pairs.push([a[i], a[LG_N - 1 - i]]);
    out.push(pairs); a = [a[0], a[LG_N - 1], ...a.slice(1, LG_N - 1)];
  }
  return out;
}
function lgSetup() { G.lgSel = shuffle(poolOf(G.code).filter(c => c !== G.code)).slice(0, LG_N - 1); G.screen = 'lgsetup'; render(); }
function renderLgSetup() {
  const pool = poolOf(G.code).filter(c => c !== G.code), sel = G.lgSel, n = sel.length;
  return `<div class="screen pick lgsetup">
    <div class="p-head"><button class="btn ghost mini" data-a="title">← Menú</button><h2>🏆 ELIGE LOS ${LG_N - 1} RIVALES DE LA LIGA</h2><span class="lg-cnt ${n === LG_N - 1 ? 'ok' : ''}">${n} / ${LG_N - 1}</span></div>
    <div class="lg-fl">${sortCodes(pool).map(c => `<button class="fcard ${sel.includes(c) ? 'on' : ''}" data-a="lgpick" data-c="${c}">${flagSVG(c)}<b>${COUNTRIES[c].n}</b></button>`).join('')}</div>
    <div class="row"><button class="btn big alt" data-a="lgrand">🎲 ALEATORIO</button><button class="btn big" data-a="lgstart" ${n === LG_N - 1 ? '' : 'disabled'}>EMPEZAR LIGA ▶</button></div>
  </div>`;
}
function initLeague() {
  const teams = [G.code, ...G.lgSel];
  const table = {}; teams.forEach(c => { table[c] = { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }; });
  G.league = { teams, fix: lgFixtures(), table, scorers: {}, results: [], done: false };
  G.round = 0; G.lgJ = 0; G.screen = 'versus'; nextEnemy(); render();
}
function lgApply(a, b, ga, gb) {
  const A = G.league.table[a], B = G.league.table[b];
  A.pj++; B.pj++; A.gf += ga; A.gc += gb; B.gf += gb; B.gc += ga;
  if (ga > gb) { A.g++; B.p++; A.pts += 3; } else if (ga < gb) { B.g++; A.p++; B.pts += 3; } else { A.e++; B.e++; A.pts++; B.pts++; }
}
function lgCredit(code, name, n = 1) {
  const S = G.league.scorers, k = code + '|' + name;
  (S[k] = S[k] || { code, name, goals: 0 }).goals += n;
}
function lgRandScorer(code, roster) {
  let r = Math.random() * LG_POSW.reduce((a, b) => a + b, 0), i = 0;
  for (; i < 4; i++) { r -= LG_POSW[i]; if (r <= 0) break; }
  return roster ? roster[i] : playerName(code, i);
}
const lgPois = l => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L && k < 9); return k - 1; };
function lgSim(a, b) {
  const d = lgQ(a) - lgQ(b), cl = v => Math.max(0.4, Math.min(3.4, v));
  const ga = lgPois(cl(1.45 * Math.exp(0.12 * d))), gb = lgPois(cl(1.45 * Math.exp(-0.12 * d)));
  for (let i = 0; i < ga; i++) lgCredit(a, lgRandScorer(a));
  for (let i = 0; i < gb; i++) lgCredit(b, lgRandScorer(b));
  return [ga, gb];
}
/* se llama al acabar tu partido: apunta el resultado, goleadores y simula el resto de la jornada */
function leagueRecord() {
  const L = G.league, r = G.round, res = [];
  const sa = M.score[0], sb = M.score[1];
  lgApply(G.code, G.enemy, sa, sb);
  const mine = [G.caps.map(c => c.name), G.enemyDefs.map(c => c.name)];
  [0, 1].forEach(t => {
    const code = t ? G.enemy : G.code; let left = t ? sb : sa;
    (M.goalList || []).filter(x => x.team === t).forEach(x => { lgCredit(code, x.name, Math.min(left, x.n)); left -= x.n; });
    while (left-- > 0) lgCredit(code, lgRandScorer(code, mine[t]));
  });
  res.push({ a: G.code, b: G.enemy, ga: sa, gb: sb, me: true });
  L.fix[r].forEach(([i, j]) => {
    if (i === 0 || j === 0) return;
    const a = L.teams[i], b = L.teams[j], [ga, gb] = lgSim(a, b);
    lgApply(a, b, ga, gb); res.push({ a, b, ga, gb });
  });
  L.results[r] = res; L.done = r >= L.fix.length - 1; G.lgJ = r;
}
const lgSorted = () => {
  const T = G.league.table;
  return G.league.teams.slice().sort((x, y) => T[y].pts - T[x].pts || (T[y].gf - T[y].gc) - (T[x].gf - T[x].gc) || T[y].gf - T[x].gf || COUNTRIES[x].n.localeCompare(COUNTRIES[y].n));
};
function renderLeague() {
  const L = G.league, T = L.table, rows = lgSorted(), J = Math.max(0, Math.min(L.fix.length - 1, G.lgJ || 0));
  const sc = Object.values(L.scorers).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 8);
  const played = L.results[J];
  const names = c => COUNTRIES[c].n;
  const matches = played ? played.map(m => `<div class="lg-m ${m.me ? 'me' : ''}"><span class="a">${names(m.a)}</span>${flagSVG(m.a)}<b>${m.ga} - ${m.gb}</b>${flagSVG(m.b)}<span class="b">${names(m.b)}</span></div>`).join('')
    : L.fix[J].map(([i, j]) => `<div class="lg-m ${i === 0 || j === 0 ? 'me' : ''}"><span class="a">${names(L.teams[i])}</span>${flagSVG(L.teams[i])}<b>vs</b>${flagSVG(L.teams[j])}<span class="b">${names(L.teams[j])}</span></div>`).join('');
  const all = Object.values(L.scorers).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 15);
  const scTab = G.lgTab === 'sc';
  const leftBox = scTab ? `<div class="lg-card lg-table"><div class="lg-row hd sc"><span>#</span><span class="tn">JUGADOR</span><span>EQUIPO</span><span>GOLES</span></div>
        ${all.length ? all.map((s, i) => `<div class="lg-row sc ${s.code === G.code ? 'me' : ''} ${i === 0 ? 'top' : ''}"><span>${i + 1}</span><span class="tn">${flagSVG(s.code)}${s.name}</span><span>${names(s.code)}</span><b>${s.goals}</b></div>`).join('') : '<div class="mut lg-none">Aún no hay goles</div>'}</div>` : null;
  const champ = rows[0], myPos = rows.indexOf(G.code) + 1;
  const foot = L.done
    ? `<div class="lg-end">${champ === G.code ? '🏆 ¡ERES EL CAMPEÓN DE LIGA' + tierStars(G.ltier) + '!' : '🏆 Campeón: <b>' + names(champ) + '</b> · Has acabado <b>' + myPos + 'º</b>'}</div><button class="btn big gold" data-a="rerun">🔁 ${champ === G.code ? 'LIGA' + tierStars((G.ltier || 0) + 1) + ' ▶' : 'REJUGAR'}</button><button class="btn big" data-a="title">MENÚ</button>`
    : G.lgMode === 'post'
      ? `<button class="btn huge" data-a="lgnext">SIGUIENTE JORNADA ▶</button><button class="btn big alt" data-a="toshop">🛒 TIENDA</button>`
      : `<button class="btn big" data-a="lgback">← VOLVER</button>`;
  return `<div class="screen league">
    <div class="lg-head"><h2>🏆 LIGA${tierStars(G.ltier)}</h2><span class="mut">Jornada ${Math.min(L.results.length + (L.done ? 0 : 1), L.fix.length)} de ${L.fix.length} · victoria 3 pts, empate 1</span></div>
    <div class="lg-tabs"><button class="tab ${scTab ? '' : 'on'}" data-a="lgtab" data-k="table">📊 Clasificación</button><button class="tab ${scTab ? 'on' : ''}" data-a="lgtab" data-k="sc">⚽ Tabla de goleadores</button></div>
    <div class="lg-main">
      ${leftBox || `<div class="lg-card lg-table"><div class="lg-row hd"><span>#</span><span class="tn">EQUIPO</span><span>PJ</span><span>G</span><span>E</span><span>P</span><span>GF</span><span>GC</span><span>DG</span><span>PTS</span></div>
        ${rows.map((c, i) => { const t = T[c]; return `<div class="lg-row ${c === G.code ? 'me' : ''} ${i === 0 ? 'top' : ''}"><span>${i + 1}</span><span class="tn">${flagSVG(c)}${names(c)}</span><span>${t.pj}</span><span>${t.g}</span><span>${t.e}</span><span>${t.p}</span><span>${t.gf}</span><span>${t.gc}</span><span>${t.gf - t.gc > 0 ? '+' : ''}${t.gf - t.gc}</span><b>${t.pts}</b></div>`; }).join('')}
      </div>`}
      <div class="lg-side">
        <div class="lg-card"><div class="lg-t">⚽ GOLEADORES</div>${sc.length ? sc.map((s, i) => `<div class="lg-s ${s.code === G.code ? 'me' : ''}"><span>${i + 1}</span>${flagSVG(s.code)}<em>${s.name}</em><b>${s.goals}</b></div>`).join('') : '<div class="mut lg-none">Aún no hay goles</div>'}</div>
        <div class="lg-card"><div class="lg-t"><button class="chip" data-a="lgj" data-d="-1">◀</button> JORNADA ${J + 1} ${played ? '' : '<small>(pendiente)</small>'} <button class="chip" data-a="lgj" data-d="1">▶</button></div>${matches}</div>
      </div>
    </div>
    <div class="row lg-foot">${foot}</div>
  </div>`;
}
Object.assign(ACTIONS, {
  liga() { G = { screen: 'pick', pickSel: 'ESP', pickLeague: 'SEL', liga: true }; render(); },
  lgview() { G.lgMode = 'view'; G.lgJ = Math.max(0, G.league.results.length - 1); G.screen = 'league'; render(); sfx.click(); },
  lgres() { document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); M = null; G.lgMode = 'post'; G.lgJ = G.league.results.length - 1; G.screen = 'league'; render(); },
  lgtab(el) { G.lgTab = el.dataset.k; render(); sfx.click(); },
  lgpick(el) { const c = el.dataset.c, i = G.lgSel.indexOf(c); if (i >= 0) G.lgSel.splice(i, 1); else if (G.lgSel.length < LG_N - 1) G.lgSel.push(c); else return toast('Ya tienes ' + (LG_N - 1) + ' rivales: quita alguno primero'); render(); sfx.click(); },
  lgrand() { G.lgSel = shuffle(poolOf(G.code).filter(c => c !== G.code)).slice(0, LG_N - 1); render(); sfx.click(); },
  lgstart() { if (G.lgSel.length === LG_N - 1) initLeague(); },
  lgback() { G.screen = 'versus'; render(); },
  lgnext() { ACTIONS.nextnow(); },
  lgj(el) { G.lgJ = Math.max(0, Math.min(G.league.fix.length - 1, (G.lgJ || 0) + +el.dataset.d)); render(); sfx.click(); },
});

/* ===================== MUNDIAL: GRUPOS + CUADRO + GOLEADORES ===================== */
const GRP_FX = { 4: [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]], 3: [[[1, 2]], [[0, 2]], [[0, 1]]] };
const TOUR_NAMES = ['Dieciseisavos de final', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'];
const TOUR_SHORT = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinales', 'Final'];
const tourOn = () => !!(G.tour && !G.league && (G.round < G.tour.off || G.round - G.tour.off < G.tour.nr));
const inGroup = () => !!(G.tour && !G.league && G.tour.groups && G.round < 3);
const tourKR = () => G.round - G.tour.off;
function tourRoundName(r) {
  const T = G.tour; if (T.groups && r < 3) return `Fase de grupos · Jornada ${r + 1}`;
  const ti = r - T.off + (T.groups ? 1 : 0); return TOUR_NAMES[ti] || `Partido ${r + 1}`;
}
function tourCredit(code, name, n = 1) {
  const S = G.tour.scorers, k = code + '|' + name;
  (S[k] = S[k] || { code, name, goals: 0 }).goals += n;
}
function tourSim(a, b, draw = false) {
  const d = (lgQ(a) - lgQ(b)) * 0.12, cl = v => Math.max(0.5, Math.min(3.3, v));
  let ga = lgPois(cl(1.45 * Math.exp(d))), gb = lgPois(cl(1.45 * Math.exp(-d)));
  const sc = [];   // los goleadores se apuntan al revelar la ronda (cuando acabas tu partido)
  for (let i = 0; i < ga; i++) sc.push([a, lgRandScorer(a)]);
  for (let i = 0; i < gb; i++) sc.push([b, lgRandScorer(b)]);
  if (draw) return { a, b, ga, gb, sc };
  let pens = false, w = ga > gb ? a : b;
  if (ga === gb) { pens = true; w = Math.random() < 0.5 + 0.03 * (lgQ(a) - lgQ(b)) ? a : b; }
  return { a, b, ga, gb, w, pens, played: true, sc };
}
function tourInit(code) {
  const groups = !!TOUR_OPT.groups, fixed = [code].concat(shuffle(poolOf(code).filter(c => c !== code)).slice(0, 31));
  const T = { groups, off: groups ? 3 : 0, nr: groups ? 4 : 5, rounds: [], scorers: {}, teams: fixed };
  if (groups) {
    const gs = Array.from({ length: 8 }, () => []); fixed.forEach((c, i) => gs[i % 8].push(c));   // si faltan equipos, los últimos grupos son de 3
    T.G = gs.map(teams => ({ teams, tab: Object.fromEntries(teams.map(c => [c, { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }])), res: [] }));
  } else {
    const byes = 32 - fixed.length, nul = new Set();
    for (let k = 0; k < byes; k++) nul.add(31 - 2 * k);   // si faltan equipos, algunos pasan directos (nunca tú en la 1ª ronda)
    const slots = []; let fi = 0; for (let i = 0; i < 32; i++) slots.push(nul.has(i) ? null : fixed[fi++]);
    G.tour = T; T.rounds[0] = tourBuild(slots, code);
  }
  return T;
}
function tourBuild(teams, me) {
  const R = [];
  for (let i = 0; i < teams.length; i += 2) {
    const a = teams[i], b = teams[i + 1];
    if (!b) { R.push({ a, b: null, ga: '', gb: '', w: a, played: true, bye: true, sc: [] }); continue; }
    R.push(a === me || b === me ? { a: a === me ? a : b, b: a === me ? b : a, me: true, played: false } : tourSim(a, b));
  }
  return R;
}
function tourOpp() {
  const T = G.tour;
  if (inGroup()) { const g = T.G[0], p = GRP_FX[g.teams.length][G.round].find(q => q.includes(0)); return g.teams[p[0] === 0 ? p[1] : p[0]]; }
  return T.rounds[tourKR()].find(x => x.me).b;
}
function grpApply(g, a, b, ga, gb) {
  const A = g.tab[a], B = g.tab[b]; A.pj++; B.pj++; A.gf += ga; A.gc += gb; B.gf += gb; B.gc += ga;
  if (ga > gb) { A.g++; B.p++; A.pts += 3; } else if (ga < gb) { B.g++; A.p++; B.pts += 3; } else { A.e++; B.e++; A.pts++; B.pts++; }
}
const grpSorted = g => g.teams.slice().sort((x, y) => { const X = g.tab[x], Y = g.tab[y]; return Y.pts - X.pts || (Y.gf - Y.gc) - (X.gf - X.gc) || Y.gf - X.gf || COUNTRIES[x].n.localeCompare(COUNTRIES[y].n); });
/* al acabar tu partido: apunta el resultado y goleadores y prepara lo siguiente */
function tourRecord(win) {
  const T = G.tour; if (!T || G.league || !tourOn()) return;
  if (inGroup()) {
    const d = G.round, g0 = T.G[0];
    grpApply(g0, G.code, G.enemy, M.score[0], M.score[1]);
    g0.res[d] = [{ a: G.code, b: G.enemy, ga: M.score[0], gb: M.score[1], me: true }];
    (M.goalList || []).forEach(x => tourCredit(x.team === 0 ? G.code : G.enemy, x.name, x.n || 1));
    T.G.forEach((g, gi) => GRP_FX[g.teams.length][d].forEach(p => {
      if (gi === 0 && p.includes(0)) return;
      const a = g.teams[p[0]], b = g.teams[p[1]], r = tourSim(a, b, true);
      grpApply(g, a, b, r.ga, r.gb); (g.res[d] = g.res[d] || []).push({ a, b, ga: r.ga, gb: r.gb }); r.sc.forEach(s => tourCredit(s[0], s[1]));
    }));
    if (d === 2) {
      const tops = T.G.map(grpSorted), seed = [];
      for (let i = 0; i < 8; i += 2) seed.push(tops[i][0], tops[i + 1][1], tops[i + 1][0], tops[i][1]);
      T.gdone = true;
      if (tops[0].indexOf(G.code) < 2) T.rounds[0] = tourBuild(seed, G.code); else T.over = true;
    }
    return;
  }
  const kr = tourKR(), R = T.rounds[kr]; if (!R) return;
  const m = R.find(x => x.me); if (!m || m.played) return;
  m.ga = M.score[0]; m.gb = M.score[1]; m.played = true; m.pens = !!M.regScore; m.w = win ? m.a : m.b;
  (M.goalList || []).forEach(g => tourCredit(g.team === 0 ? G.code : m.b, g.name, g.n || 1));
  R.forEach(x => { if (!x.me) (x.sc || []).forEach(s => tourCredit(s[0], s[1])); });   // ahora se revelan los otros partidos
  T.over = !win;
  if (win && kr < T.nr - 1) T.rounds[kr + 1] = tourBuild(R.map(x => x.w), G.code);
  if (win && kr === T.nr - 1) T.champion = G.code;
}
/* simula el resto del Mundial cuando ya estás eliminado */
function tourFinish() {
  const T = G.tour; if (!T || !T.over || T.simDone) return;
  const credit = R => R.forEach(x => (x.sc || []).forEach(s => tourCredit(s[0], s[1])));
  if (T.groups && !T.gdone) {
    for (let d = T.G[0].res.length; d < 3; d++) T.G.forEach(g => GRP_FX[g.teams.length][d].forEach(p => {
      const a = g.teams[p[0]], b = g.teams[p[1]], r = tourSim(a, b, true);
      grpApply(g, a, b, r.ga, r.gb); (g.res[d] = g.res[d] || []).push({ a, b, ga: r.ga, gb: r.gb }); r.sc.forEach(s => tourCredit(s[0], s[1]));
    }));
    T.gdone = true;
  }
  if (T.groups && !T.rounds[0]) {
    const tops = T.G.map(grpSorted), seed = [];
    for (let i = 0; i < 8; i += 2) seed.push(tops[i][0], tops[i + 1][1], tops[i + 1][0], tops[i][1]);
    T.rounds[0] = tourBuild(seed, null); credit(T.rounds[0]);
  }
  for (let r = 1; r < T.nr; r++) if (!T.rounds[r]) { T.rounds[r] = tourBuild(T.rounds[r - 1].map(x => x.w), null); credit(T.rounds[r]); }
  const fin = T.rounds[T.nr - 1][0]; T.simDone = true; T.simChamp = fin.w;
}
function renderTour() {
  const T = G.tour, nm = c => COUNTRIES[c].n, k0 = T.groups ? 1 : 0;
  const tab = G.tourTab || (T.groups && (G.round < 3 || T.over && !T.rounds[0]) ? 'grp' : 'ko');
  const sc = Object.values(T.scorers).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 12);
  let main;
  if (tab === 'grp' && T.groups) {
    main = `<div class="gp-grid">${T.G.map((g, gi) => `<div class="gp-card ${gi === 0 ? 'me' : ''}"><div class="gp-h">GRUPO ${String.fromCharCode(65 + gi)}</div>
      <div class="gp-r hd"><span></span><span class="tn">EQUIPO</span><span>PJ</span><span>DG</span><span>PTS</span></div>
      ${grpSorted(g).map((c, i) => { const t = g.tab[c]; return `<div class="gp-r ${i < 2 ? 'q' : ''} ${c === G.code ? 'mine' : ''}"><span>${i + 1}</span><span class="tn">${flagSVG(c)}${nm(c)}</span><span>${t.pj}</span><span>${t.gf - t.gc > 0 ? '+' : ''}${t.gf - t.gc}</span><b>${t.pts}</b></div>`; }).join('')}</div>`).join('')}</div>`;
  } else {
    const cols = Array.from({ length: T.nr }, (_, r) => {
      const R = T.rounds[r], cnt = 16 >> (r + k0), mm = R && R.find(x => x.me), reveal = !!R && (G.round - T.off > r || (mm && mm.played) || T.simDone);
      const boxes = Array.from({ length: cnt }, (_, i) => {
        const m = R && R[i];
        if (!m) return '<div class="tb-m empty"><div class="tb-t"><span>?</span></div><div class="tb-t"><span>?</span></div></div>';
        const show = reveal || (m.me && m.played);
        const row = (c, g, won) => c ? `<div class="tb-t ${show && won ? 'w' : ''} ${c === G.code ? 'me' : ''}">${flagSVG(c)}<span>${nm(c)}</span><b>${show ? g : ''}${show && m.pens && won ? '<sup> p</sup>' : ''}</b></div>` : '<div class="tb-t"><span>— pasa directo —</span></div>';
        return `<div class="tb-m ${m.me ? 'me' : ''}">${row(m.a, m.ga, show && m.w === m.a)}${row(m.b, m.gb, show && m.w === m.b)}</div>`;
      }).join('');
      return `<div class="tb-col c${cnt} ${G.round - T.off === r && !T.over ? 'cur' : ''}"><h4>${TOUR_SHORT[r + k0]}</h4><div class="tb-list">${boxes}</div></div>`;
    }).join('');
    main = `<div class="tb-cols" style="grid-template-columns:repeat(${T.nr},1fr)!important">${cols}</div>`;
  }
  const myRes = T.groups ? T.G[0].res.map((r, d) => `<div class="lg-d">Jornada ${d + 1}</div>` + r.map(m => `<div class="lg-g ${m.me ? 'me' : ''}">${flagSVG(m.a)}<span class="${m.ga > m.gb ? 'w' : ''}">${nm(m.a)}</span><b class="${m.ga > m.gb ? 'w' : ''}">${m.ga}</b>${flagSVG(m.b)}<span class="${m.gb > m.ga ? 'w' : ''}">${nm(m.b)}</span><b class="${m.gb > m.ga ? 'w' : ''}">${m.gb}</b></div>`).join('')).join('') : '';
  const side = `${tab === 'grp' && myRes ? `<div class="lg-t">TU GRUPO · RESULTADOS</div>${myRes}` : ''}<div class="lg-t">⚽ GOLEADORES</div>${sc.length ? sc.map((s, i) => `<div class="lg-s ${s.code === G.code ? 'me' : ''}"><span>${i + 1}</span>${flagSVG(s.code)}<em>${s.name}</em><b>${s.goals}</b></div>`).join('') : '<div class="mut lg-none">Aún no hay goles</div>'}`;
  const status = T.champion ? '¡Eres el campeón!' : T.simDone ? 'Torneo simulado · Campeón: ' + nm(T.simChamp) : T.over ? (T.groups && !T.rounds[0] ? 'Eliminado en grupos' : 'Has sido eliminado') : tab === 'grp' ? 'Se clasifican los 2 primeros de cada grupo' : 'Eliminatoria a partido único · los otros resultados salen al acabar tu partido';
  const simB = T.over && !T.simDone && !T.champion ? '<button class="btn big pur" data-a="tsim">⏩ SIMULAR</button>' : '';
  const foot = simB + (G.tourFrom === 'over' ? (T.over || T.champion ? '<button class="btn big gold" data-a="rerun">🔁 REJUGAR</button><button class="btn big" data-a="title">MENÚ</button>' : '<button class="btn big alt" data-a="toshop">🛒 TIENDA</button><button class="btn huge" data-a="nextnow">SIGUIENTE PARTIDO ▶</button>') : '<button class="btn big" data-a="tourback">← VOLVER</button>');
  return `<div class="screen tour">
    <div class="lg-head"><h2>🏆 ${tierName(G.tier)}</h2><span class="mut">${status}</span></div>
    ${T.groups ? `<div class="lg-tabs"><button class="tab ${tab === 'grp' ? 'on' : ''}" data-a="ttab" data-k="grp">👥 Fase de grupos</button><button class="tab ${tab === 'ko' ? 'on' : ''}" data-a="ttab" data-k="ko">🏆 Eliminatorias</button></div>` : ''}
    <div class="tb-main"><div class="tb-wrap">${main}</div><div class="lg-card tb-sc">${side}</div></div>
    <div class="row lg-foot">${foot}</div>
  </div>`;
}
Object.assign(ACTIONS, {
  tourview() { document.querySelectorAll('.overlay:not(#help)').forEach(o => o.remove()); G.tourFrom = G.screen === 'match' ? 'over' : G.screen; G.tourTab = null; G.screen = 'tour'; render(); sfx.click(); },
  tourback() { if (G.tourFrom === 'over') return ACTIONS.title(); G.screen = G.tourFrom || 'versus'; render(); },
  tsim() { tourFinish(); G.tourTab = 'ko'; render(); sfx.win(); },
  ttab(el) { G.tourTab = el.dataset.k; render(); sfx.click(); },
});
/* celebración del campeón */
function showChampion(ov) {
  const T = G.tour, mine = Object.values(T.scorers).filter(s => s.code === G.code).sort((a, b) => b.goals - a.goals)[0];
  const conf = Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${['#ffd23f', '#c6ff3d', '#35e0ff', '#ff4d6d', '#fff'][i % 5]};animation-delay:${-(i * 0.37 % 4).toFixed(2)}s;animation-duration:${(3 + (i % 4) * 0.6).toFixed(1)}s"></i>`).join('');
  ov.classList.add('champov');
  ov.innerHTML = `<div class="conf">${conf}</div><div class="res champ">
    <div class="ch-cup">🏆</div><h1>¡CAMPEONES!</h1>
    <div class="ch-team">${flagSVG(G.code)}<b>${COUNTRIES[G.code].n}</b>${flagSVG(G.code)}</div>
    <div class="ch-sub">¡Has ganado el ${tierName(G.tier)}!</div>
    <div class="ch-stats"><div><b>${G.stats.wins}</b><span>victorias</span></div><div><b>${G.stats.goals}</b><span>goles</span></div><div><b>${mine ? mine.goals : 0}</b><span>${mine ? mine.name : 'máx. goleador'}</span></div></div>
    <div class="ch-squad">${G.caps.map(c => `<span>${c.name}${c.captain ? ' <span class="capt">C</span>' : ''}</span>`).join('')}</div>
    <div class="row"><button class="btn big alt" data-a="tourview">🏆 VER CUADRO</button><button class="btn huge gold" data-a="rerun">🔁 ${tierName((G.tier || 0) + 1)} ▶</button><button class="btn big" data-a="title">MENÚ</button></div></div>`;
  sfx.win();
}

/* ===================== RULETA tras cada partido ===================== */
const ROULETTE = [
  { k: 'x2', ic: '💰', t: '×2', c: '#f5b82e' }, { k: 'none', ic: '❌', t: 'Nada', c: '#3a4658' },
  { k: 'card', ic: '🃏', t: 'Comodín', c: '#8a5cf0' }, { k: 'lose', ic: '💸', t: '−$', c: '#d9404f' },
  { k: 'perk', ic: '🏅', t: 'Reliquia', c: '#e8892f' }, { k: 'card', ic: '🃏', t: 'Comodín', c: '#a070f5' },
  { k: 'stat', ic: '💪', t: 'Mejora', c: '#2fc46a' }, { k: 'x15', ic: '💰', t: '×1.5', c: '#20b3c9' },
];
function roulettePrize(k) {
  if (k === 'x2' || k === 'x15') {
    const base = Math.max(0, (M && M.result && M.result.reward) || 0);   // el multiplicador solo se aplica al dinero ganado en este partido
    const add = Math.round(base * (k === 'x2' ? 1 : 0.5)); if (add <= 0) { gain(3); return '💰 No ganaste dinero en el partido… ¡toma $3 de consuelo!'; }
    gain(add); return `💰 ¡El dinero del partido se multiplica! $${base} → <b>+$${add}</b> (ahora $${G.money})`;
  }
  if (k === 'lose') { const l = Math.min(G.money, Math.max(2, Math.round(G.money * 0.3))); G.money -= l; return `💸 ¡Ouch! Pierdes <b>$${l}</b> (ahora $${G.money}).`; }
  if (k === 'card') {
    const key = pick(Object.keys(CARDS)); (G.freeItems = G.freeItems || []).push({ kind: 'item', key });
    return `🃏 ¡Comodín GRATIS: <b>${CARDS[key].n}</b>! Te espera en la tienda (cuesta $0).`;
  }
  if (k === 'perk') {
    const left = Object.keys(PERKS).filter(x => !G.perks.includes(x)), key = pick(left.length ? left : Object.keys(PERKS));
    (G.freeItems = G.freeItems || []).push({ kind: 'perk', key });
    return `🏅 ¡Reliquia GRATIS: <b>${PERKS[key].icon} ${PERKS[key].n}</b>! Te espera en la tienda (cuesta $0).`;
  }
  if (k === 'stat') {
    const key = pick(STAT_KEYS); (G.freeItems = G.freeItems || []).push({ kind: 'stat', key });
    return `💪 ¡Mejora GRATIS: <b>${STATS[key].icon} +2 ${STATS[key].n}</b>! Elige jugador en la tienda (cuesta $0).`;
  }
  return '😶 Casilla en blanco. ¡Otra vez será!';
}
function showRoulette(ov) {
  const card = ov && ov.querySelector('.res'); if (!card || G.debug || card.querySelector('.rw-side')) return;
  /* ganar: ruleta normal (1 casilla de NADA) · empatar: una casilla de premio más se convierte en NADA (2) */
  let SL = shuffle(ROULETTE.map(x => Object.assign({}, x))), RS = M && M.result;
  if (RS && !RS.win && !RS.draw) return;   // tras perder (eliminado / derrota) no hay ruleta
  if (RS && !RS.win) { const pr = SL.map((x, i) => i).filter(i => !['none', 'lose'].includes(SL[i].k)), j = pick(pr); SL[j] = { k: 'none', ic: '❌', t: 'Nada', c: '#3a4658' }; }
  for (let t = 0; t < 50 && SL.some((s, i) => s.k === 'none' && SL[(i + 1) % 8].k === 'none'); t++) SL = shuffle(SL);   // las casillas de NADA no van pegadas
  const left = document.createElement('div'); left.className = 'res-left';
  while (card.firstChild) left.appendChild(card.firstChild);
  const btns = left.querySelector('.res-btns'); if (btns) btns.classList.add('locked');
  const grad = SL.map((s, i) => `${s.c} ${i * 45}deg ${(i + 1) * 45}deg`).join(',');
  const labels = SL.map((s, i) => `<span class="rw-l" style="transform:rotate(${i * 45 + 22.5}deg) translateY(calc(var(--rw) * -0.34))"><i>${s.ic}</i><b>${s.t}</b></span>`).join('');
  const side = document.createElement('div'); side.className = 'rw-side';
  side.innerHTML = `<div class="rw-title">🎡 RULETA</div>
    <div class="rw" style="--rw:min(calc(36 * var(--vh)),310px)"><div class="rw-ptr">▼</div><div class="rw-wheel" style="background:conic-gradient(${grad})">${labels}<div class="rw-hub"></div></div></div>
    <div class="rw-res" id="rwRes">¡Gira para ver qué te toca!</div>
    <div class="rw-money" id="rwMoney">💰 Dinero actual: <b>$${G.money}</b></div>
    <button class="btn big" id="rwGo">🎡 GIRAR</button>`;
  card.classList.add('withwheel'); card.append(left, side);
  const go = side.querySelector('#rwGo'), wheel = side.querySelector('.rw-wheel'), res = side.querySelector('#rwRes');
  go.onclick = () => {
    go.disabled = true; go.style.visibility = 'hidden'; sfx.click();
    const idx = Math.floor(Math.random() * 8), R = 360 * 5 - (idx * 45 + 22.5) + (Math.random() - 0.5) * 30;
    wheel.style.transition = 'transform 3.6s cubic-bezier(.12,.7,.1,1)'; wheel.style.transform = `rotate(${R}deg)`;
    setTimeout(() => {
      const k = SL[idx].k; res.innerHTML = roulettePrize(k); res.className = 'rw-res ' + (k === 'lose' ? 'bad' : k === 'none' ? '' : 'ok');
      if (k === 'lose') sfx.lose(); else if (k === 'none') sfx.click(); else sfx.win();
      const rm = side.querySelector('#rwMoney'); if (rm) rm.innerHTML = '💰 Dinero actual: <b>$' + G.money + '</b>';
      if (btns) btns.classList.remove('locked');
    }, 3800);
  };
}

/* ===================== RULETA EN PLENO PARTIDO =====================
   Botón 🎡 en tu turno: pausa el partido y abre una ruleta de 8 casillas. Apuestas de $1 a $5:
   cuanto más apuestas, mejores comodines / reliquias / habilidades y menos casillas de NADA (2 con $1, ninguna con $4 o más). */
const MR_COL = { money: '#f5b82e', card: '#8a5cf0', perk: '#e8892f', stat: '#2fc46a', ab: '#20b3c9', none: '#3a4658' };
const MR_IC = { money: '💰', card: '🃏', perk: '🏅', stat: '💪', ab: '🧩', none: '❌' };
const MR = { bet: 1, slots: [], spinning: false, rot: 0, last: null };
const mrN = () => (M && M.mrSpins) || 0;   // cada tirada extra de la partida sube $1 el rango de apuesta
function mrBuild(b) {
  const nada = b === 1 ? 2 : b <= 3 ? 1 : 0;
  const list = ['money', 'card', 'card', 'perk', 'stat', 'ab'].concat(['money', 'stat'].slice(0, 2 - nada));
  for (let i = 0; i < nada; i++) list.push('none');
  let s = shuffle(list);
  for (let t = 0; t < 60 && s.some((x, i) => x === 'none' && s[(i + 1) % 8] === 'none'); t++) s = shuffle(list);
  let m = 0;
  return s.map(k => k === 'money' ? { k, amt: (m++ ? 3 : 2) * (b + mrN()) } : { k });
}
function mrW(keys, price, b) {   // elige 1 clave con peso precio^apuesta: apostar más favorece lo caro
  const w = keys.map(k => Math.pow(price(k), b)); let r = Math.random() * w.reduce((s, x) => s + x, 0), i = 0;
  while (i < keys.length - 1 && (r -= w[i]) > 0) i++;
  return keys[i];
}
function mrPrize(k, b, amt) {
  const lv = b >= 5 ? 3 : b >= 3 ? 2 : 1;
  if (k === 'money') return { money: amt, txt: `💰 ¡<b>+$${amt}</b>!` };
  if (k === 'none') return { txt: '😶 Casilla en blanco. ¡Otra vez será!' };
  if (k === 'card') { const key = mrW(CARD_KEYS, x => CARDS[x].price, b); return { item: { kind: 'item', key, lv, free: true }, txt: `🃏 ¡Premio <b>comodín</b>!` }; }
  if (k === 'perk') {
    const pool = Object.keys(PERKS).filter(x => !G.perks.includes(x) && !(x === 'bolsillo' && (G.slotBonus || 0) >= 2));
    if (!pool.length) return { money: 2 * b, txt: `💰 ¡<b>+$${2 * b}</b>!` };
    const key = mrW(pool, x => PERKS[x].price, b); return { item: { kind: 'perk', key, free: true }, txt: '🏅 ¡Premio <b>reliquia</b>!' };
  }
  if (k === 'ab') { const key = mrW(Object.keys(ABILITIES), x => ABILITIES[x].price, b); return { item: { kind: 'ab', key, free: true }, txt: '🧩 ¡Premio <b>habilidad</b>!' }; }
  if (b >= 4 && Math.random() < (b - 3) * 0.14) return { item: { kind: 'star', key: 'STAR', free: true }, txt: '⭐ ¡Premio <b>estrella</b>!' };
  const key = pick(STAT_KEYS); return { item: { kind: 'stat', key, free: true }, txt: '💪 ¡Premio <b>mejora</b>!' };
}
function mrDraw() {
  const ov = document.getElementById('mroul'); if (!ov) return;
  const b = MR.bet, grad = MR.slots.map((s, i) => `${MR_COL[s.k]} ${i * 45}deg ${(i + 1) * 45}deg`).join(',');
  const lab = MR.slots.map((s, i) => {
    const top = s.k === 'money' ? `<i>💰</i><b>$${s.amt}</b>` : s.k === 'none' ? '<i>❌</i><b>Nada</b>' : `<i class="q q${b}">${MR_IC[s.k]}</i><b class="stars">★${b}</b>`;
    return `<span class="rw-l" style="transform:rotate(${i * 45 + 22.5}deg) translateY(calc(var(--rw) * -0.34))">${top}</span>`;
  }).join('');
  const wheel = ov.querySelector('.rw-wheel');
  wheel.style.transition = 'none'; wheel.style.transform = 'rotate(0deg)'; MR.rot = 0;
  wheel.style.background = `conic-gradient(${grad})`; wheel.style.boxShadow = `0 0 ${8 + b * 7}px rgba(255,209,102,${0.15 + b * 0.13})`;
  wheel.innerHTML = lab + '<div class="rw-hub"></div>';
  const n = mrN(), rg = ov.querySelector('#mrRange');
  rg.min = 1 + n; rg.max = 5 + n; rg.value = b + n;
  ov.querySelector('.mr-scale').innerHTML = [1, 2, 3, 4, 5].map(i => `<span>$${i + n}</span>`).join('');
  ov.querySelector('#mrBet').textContent = '$' + (b + n);
  const nada = MR.slots.filter(s => s.k === 'none').length;
  ov.querySelector('#mrInfo').textContent = nada ? `${nada} casilla${nada > 1 ? 's' : ''} de NADA` : 'Sin casillas de NADA';
  const can = G.debug || G.money >= b + n;
  ov.querySelector('#mrGo').disabled = MR.spinning || !can;
  ov.querySelector('#mrMoney').innerHTML = '💰 TIENES <b>' + (G.debug ? '∞' : '$' + G.money) + '</b>' + (can ? '' : '<small>No te llega para esta apuesta</small>');
}
function openMatchRoulette() {
  if (document.getElementById('mroul')) return;
  if (typeof bankCash === 'function') bankCash();
  G.fromRoul = true;   // la tienda mostrará «volver a la ruleta» hasta que se tire a balón
  MR.bet = Math.max(1, Math.min(5, MR.bet || 1)); MR.spinning = false; MR.slots = mrBuild(MR.bet);
  const ov = document.createElement('div'); ov.id = 'mroul'; ov.className = 'mr-ov';
  ov.innerHTML = `<div class="mr-card"><button class="mr-x" data-a="mrclose" title="Cerrar y seguir con el partido">✕</button>
    <div class="rw-side"><div class="rw-title">🎡 RULETA</div>
      <div class="rw" style="--rw:min(calc(40 * var(--vh)),340px)"><div class="rw-ptr">▼</div><div class="rw-wheel"></div></div></div>
    <div class="mr-ctl">
      <div class="mr-money" id="mrMoney"></div>
      <div class="mr-bet">Apuesta <b id="mrBet">$1</b></div>
      <input id="mrRange" type="range" min="${1 + mrN()}" max="${5 + mrN()}" step="1" value="${MR.bet + mrN()}">
      <div class="mr-scale"><span>$1</span><span>$2</span><span>$3</span><span>$4</span><span>$5</span></div>
      <div class="mut" id="mrInfo"></div><div class="mut mr-leg">💰 dinero · 🃏 comodín · 🏅 reliquia · 💪 mejora · 🧩 habilidad</div>
      <button class="btn big" id="mrGo" data-a="mrgo">🎡 TIRAR</button>
      <div class="rw-res" id="mrRes">Más apuesta = mejores premios (★1 a ★5) y menos casillas de NADA.</div>
      <div class="row" id="mrAct"></div></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('#mrRange').oninput = e => { if (MR.spinning) { e.target.value = MR.bet + mrN(); return; } MR.bet = +e.target.value - mrN(); MR.slots = mrBuild(MR.bet); ov.querySelector('#mrRes').textContent = 'Más apuesta = mejores premios (★1 a ★5) y menos casillas de NADA.'; ov.querySelector('#mrAct').innerHTML = ''; mrDraw(); };
  mrDraw();
}
function closeMatchRoulette() { const ov = document.getElementById('mroul'); if (ov) ov.remove(); MR.spinning = false; if (typeof hudScore === 'function' && M) hudScore(); }
function mrSpin() {
  const ov = document.getElementById('mroul'); if (!ov || MR.spinning) return;
  const b = MR.bet, cost = b + mrN(); if (!G.debug && G.money < cost) return;
  if (!G.debug) G.money -= cost;
  MR.spinning = true; sfx.click();
  const mm = ov.querySelector('#mrMoney'); if (mm) mm.innerHTML = '💰 TIENES <b>' + (G.debug ? '∞' : '$' + G.money) + '</b>';
  if (typeof hudScore === 'function' && M) hudScore();
  const idx = Math.floor(Math.random() * 8), R = 360 * 5 - (idx * 45 + 22.5) + (Math.random() - 0.5) * 30;
  ov.querySelector('#mrAct').innerHTML = ''; ov.querySelector('#mrRes').textContent = '…';
  ov.querySelector('#mrGo').disabled = true; ov.querySelector('#mrRange').disabled = true; ov.querySelector('.mr-x').style.visibility = 'hidden';
  const wheel = ov.querySelector('.rw-wheel');
  wheel.style.transition = 'transform 3.6s cubic-bezier(.12,.7,.1,1)'; wheel.style.transform = `rotate(${R}deg)`;
  setTimeout(() => {
    if (!document.getElementById('mroul')) return;
    const s = MR.slots[idx], pz = mrPrize(s.k, b, s.amt), res = ov.querySelector('#mrRes');
    res.innerHTML = '<div>' + pz.txt + '</div>'; res.className = 'rw-res ' + (s.k === 'none' ? '' : 'ok');
    if (pz.money) { gain(pz.money); sfx.win(); }
    else if (pz.item) {
      if (!G.shop) genShop();
      G.shop.items.unshift(pz.item); while (G.shop.items.length > 6) G.shop.items.pop();   // el premio va el primero; máximo 6 cartas: se elimina la última
      sfx.win();
      ov.querySelector('#mrAct').innerHTML = '<button class="btn big gold" data-a="mrtake">🎁 COGER PREMIO</button>';
      res.innerHTML += '<div><small>Búscalo GRATIS en la tienda.</small></div>';
    } else sfx.click();
    MR.spinning = false; M.mrSpins = mrN() + 1; MR.slots = mrBuild(b);
    const rg = ov.querySelector('#mrRange'); rg.disabled = false; ov.querySelector('.mr-x').style.visibility = '';
    const keep = ov.querySelector('#mrRes').innerHTML, act = ov.querySelector('#mrAct').innerHTML;
    mrDraw(); ov.querySelector('#mrRes').innerHTML = keep; ov.querySelector('#mrRes').className = 'rw-res ' + (s.k === 'none' ? '' : 'ok'); ov.querySelector('#mrAct').innerHTML = act;
    if (typeof hudScore === 'function' && M) hudScore();
  }, 3800);
}
