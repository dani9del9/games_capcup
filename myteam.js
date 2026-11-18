/* ===================== MI EQUIPO (equipo creado por el jugador) =====================
   Datos y utilidades. Se guarda en el navegador (localStorage). El código interno del equipo es siempre 'MIO'. */
const MY_KEY = 'cap_myteam_v1';
const scode = c => (COUNTRIES[c] && COUNTRIES[c].s) || c;   // nombre corto de 3 letras que se ve en el marcador
const FLAG_STYLES = { h: 'Franjas horizontales', v: 'Franjas verticales', diag: 'Diagonal', cruz: 'Cruz', circ: 'Círculo', liso: 'Color liso' };
const contrastOf = hex => { const n = parseInt(hex.slice(1), 16), l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 150 ? '#14202e' : '#ffffff'; };   // color secundario de la chapa, automático
function defaultMyTeam() {
  const mk = (name, st) => ({ name, stats: { POT: st[0], PES: st[1], PRE: st[2], VIS: st[3], MEN: st[4] }, stars: 1, abs: [] });
  return {
    n: 'Mi Equipo', s: 'MIO', form: '2-2',
    home: ['#ff3d71'], away: ['#ffffff'],
    flag: { style: 'h', n: 3, c: ['#ff3d71', '#ffffff', '#1d46c4', '#ffd23f', '#1f9d55'] },
    players: [mk('Manolo Guante', [4, 6, 5, 2, 4]), mk('Pepe Muro', [5, 6, 4, 2, 5]), mk('Luis Cerebro', [5, 4, 6, 4, 5]), mk('Carlos Veloz', [6, 3, 5, 6, 4]), mk('Dani Goleador', [7, 3, 6, 5, 5])]
  };
}
function sanitizeMyTeam(t) {
  const d = defaultMyTeam(), o = Object.assign({}, d, t || {});
  const col = (v, f) => /^#[0-9a-f]{6}$/i.test(v) ? v : f;
  o.n = String(o.n || d.n).slice(0, 22); o.s = String(o.s || 'MIO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
  o.form = FORMS[o.form] ? o.form : d.form;
  o.home = [col((o.home || [])[0], d.home[0])]; o.away = [col((o.away || [])[0], d.away[0])];
  const f = o.flag || {}, st = { h3: 'h', v3: 'v' }[f.style] || f.style; const style = FLAG_STYLES[st] ? st : 'h';
  o.flag = { style, n: style === 'liso' ? 1 : clamp(Math.round(+f.n || 3), 1, 5), c: [0, 1, 2, 3, 4].map(i => col((f.c || [])[i], d.flag.c[i])) };
  o.players = d.players.map((dp, i) => {
    const p = (t && t.players && t.players[i]) || dp, st = {};
    STAT_KEYS.forEach(k => { st[k] = clamp(Math.round(+(p.stats || {})[k] || dp.stats[k]), 1, 12); });
    const stars = clamp(Math.round(+p.stars || 1), 1, 5), abs = (Array.isArray(p.abs) ? p.abs : []).filter(k => ABILITIES[k]).slice(0, abSlots(stars));
    return { name: String(p.name || dp.name).slice(0, 22), stats: st, stars, abs };
  });
  return o;
}
let MYTEAM = (() => { try { return sanitizeMyTeam(JSON.parse(localStorage.getItem(MY_KEY) || 'null')); } catch (e) { return sanitizeMyTeam(null); } })();
function saveMyTeam() { try { localStorage.setItem(MY_KEY, JSON.stringify(MYTEAM)); } catch (e) { /* sin almacenamiento */ } }
function myFlagSVG(f) {
  const n = f.style === 'liso' ? 1 : f.n, c = f.c, W = 30, H = 20; let o = '';
  const bg = `<rect data-ci="0" width="${W}" height="${H}" fill="${c[0]}"/>`;
  if (n === 1) return bg;
  switch (f.style) {
    case 'v': for (let i = 0; i < n; i++) o += `<rect data-ci="${i}" x="${(W / n * i).toFixed(2)}" width="${(W / n + 0.05).toFixed(2)}" height="${H}" fill="${c[i]}"/>`; return o;
    case 'diag': o = bg; for (let i = 1; i < n; i++) { const k = 2 * i / n, p = k <= 1 ? [[k, 0], [1, 0], [1, 1], [0, 1], [0, k]] : [[1, k - 1], [1, 1], [k - 1, 1]]; o += `<polygon data-ci="${i}" points="${p.map(q => (q[0] * W).toFixed(2) + ',' + (q[1] * H).toFixed(2)).join(' ')}" fill="${c[i]}"/>`; } return o;
    case 'cruz': o = bg; for (let j = 1; j < n; j++) { const w = 6 / j; o += `<rect data-ci="${j}" x="${(11 - w / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${H}" fill="${c[j]}"/><rect data-ci="${j}" y="${(10 - w / 2).toFixed(2)}" width="${W}" height="${w.toFixed(2)}" fill="${c[j]}"/>`; } return o;
    case 'circ': o = bg; for (let j = 1; j < n; j++) o += `<circle data-ci="${j}" cx="15" cy="10" r="${(8.5 * (n - j) / (n - 1)).toFixed(2)}" fill="${c[j]}"/>`; return o;
    default: for (let i = 0; i < n; i++) o += `<rect data-ci="${i}" y="${(H / n * i).toFixed(2)}" width="${W}" height="${(H / n + 0.05).toFixed(2)}" fill="${c[i]}"/>`; return o;
  }
}
/* registra (o actualiza) el equipo en las tablas del juego */
function applyMyTeam() {
  const t = MYTEAM;
  COUNTRIES.MIO = { n: t.n, s: t.s, c1: t.home[0], c2: contrastOf(t.home[0]), bias: {}, tag: 'Tu equipo', svg: myFlagSVG(t.flag), custom: true };
  if (!CODES.includes('MIO')) CODES.push('MIO');
  TEAM_FORM.MIO = t.form;
  if (typeof AWAY !== 'undefined') AWAY.MIO = [t.away[0], contrastOf(t.away[0])];
  try { delete TCACHE.MIO; } catch (e) { /* aún no existe la caché */ }
  if (typeof FLAGS !== 'undefined' && typeof flagURI === 'function') { const im = new Image(); im.onload = () => { FLAGS.MIO = im; if (window.__flagsLoaded) window.__flagsLoaded(); }; im.src = flagURI('MIO'); }
}
/* jugador del equipo (lo usa makeCap en engine.js) */
function myCap(role) {
  const i = ROLES.findIndex(r => r.k === role), p = MYTEAM.players[i];
  return { role, stats: Object.assign({}, p.stats), abs: p.abs.slice(), name: p.name, num: SHIRT[role], stars: p.stars, captain: role === 'MED' };
}
applyMyTeam();
