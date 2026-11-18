/* ===================== MI EQUIPO · formulario de creación (estilo laboratorio) ===================== */
const MY_SLOTS = ['Portero', 'Defensa', 'Mediocentro', 'Extremo', 'Delantero'];
const MY_NUM = [1, 4, 8, 7, 9];
const esc2 = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const mySel = () => (G && G.mysel) || 0;
function myPreview() {
  const t = MYTEAM, kit = (c) => [0, 2, 4].map(i => capPreview(i, { code: 'MIO', c1: c[0], c2: contrastOf(c[0]) }, 30)).join('');
  return `<div class="my-flag"><svg viewBox="0 0 30 20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${myFlagSVG(t.flag)}</svg></div>
    <div class="my-kits"><div><span>${kit(t.home)}</span><small>LOCAL</small></div><div><span>${kit(t.away)}</span><small>VISITANTE</small></div></div>
    <div class="my-sb"><b>${esc2(t.s)}</b> <span>${esc2(t.n)}</span></div>`;
}
function myCapBtn(i) {
  let bg = ''; try { bg = `background-image:url('${flagURI('MIO')}')`; } catch (e) { bg = `background:${MYTEAM.home[0]}`; }
  return `<button class="my-cap ${mySel() === i ? 'on' : ''}" style="${bg}" data-a="mypick" data-i="${i}" title="${esc2(MYTEAM.players[i].name)} · ${MY_SLOTS[i]}">${MY_NUM[i]}</button>`;
}
function myPlayerHTML() {
  const i = mySel(), p = MYTEAM.players[i], slots = abSlots(p.stars), used = p.abs.length;
  const stats = STAT_KEYS.map(k => `<div class="my-rowst"><span title="${STATS[k].d}">${STATS[k].icon} ${STATS[k].n}</span><input type="range" min="1" max="12" step="1" value="${p.stats[k]}" data-my="stat" data-k="${k}" style="accent-color:${svCol(p.stats[k])}"><b id="mst-${k}" class="sv sv${svc(p.stats[k])}">${p.stats[k]}</b></div>`).join('');
  const chips = Object.keys(ABILITIES).map(k => { const n = abCount(p.abs, k); return `<button class="chip ${n ? 'on' : ''} ${!n && used >= slots ? 'off' : ''}" data-a="myab" data-k="${k}" data-atip="${k}">${ABILITIES[k].icon} ${ABILITIES[k].n}${n ? ' ×' + n : ''}</button>`; }).join('');
  return `<div class="my-h">JUGADOR <small>(${MY_SLOTS[i]}${i === 2 ? ' · capitán' : ''})</small></div>
    <div class="my-tabs">${[0, 1, 2, 3, 4].map(myCapBtn).join('')}</div>
    <div class="my-pname"><input type="text" maxlength="22" data-my="pname" value="${esc2(p.name)}" placeholder="Nombre">
      <span class="gold">${'★'.repeat(p.stars)}</span><button class="my-star" data-a="mystar" data-d="-1">−★</button><button class="my-star" data-a="mystar" data-d="1">+★</button></div>
    <div class="my-h">ESTADÍSTICAS</div>${stats}
    <div class="my-h">ITEMS <small>(${used}/${slots} huecos · más estrellas, más huecos)</small></div>
    <div class="my-chips">${chips}</div>
    <div class="my-note">Toca un item para añadir una copia (máx. 3). Con el máximo, vuelve a tocar para quitarlos. Clic derecho: quitar una.</div>`;
}
function myLeftHTML() {
  const t = MYTEAM, f = t.flag, nc = f.style === 'liso' ? 1 : f.n;
  const sw = (id, v) => `<input type="color" class="my-cp" data-my="${id}" value="${v}">`;
  return `<div class="my-h">EQUIPO</div>
    <div class="my-grid">
      <label class="my-f" style="grid-column:span 4"><span>Nombre del equipo</span><input type="text" maxlength="22" data-my="n" value="${esc2(t.n)}"></label>
      <label class="my-f" style="grid-column:span 2"><span>3 letras</span><input type="text" class="s3" maxlength="3" data-my="s" value="${esc2(t.s)}"></label>
      <div class="my-f" style="grid-column:span 2"><span>Chapas local</span>${sw('home0', t.home[0])}</div>
      <div class="my-f" style="grid-column:span 2"><span>Chapas visitante</span>${sw('away0', t.away[0])}</div>
      <label class="my-f" style="grid-column:span 2"><span>Formación</span><select data-my="form">${FORM_KEYS.map(k => `<option value="${k}" ${t.form === k ? 'selected' : ''}>${k} · ${FORMS[k].n}</option>`).join('')}</select></label>
      <label class="my-f" style="grid-column:span 4"><span>Tipo de bandera</span><select data-my="fstyle">${Object.keys(FLAG_STYLES).map(k => `<option value="${k}" ${f.style === k ? 'selected' : ''}>${FLAG_STYLES[k]}</option>`).join('')}</select></label>
      <label class="my-f" style="grid-column:span 2"><span>Nº de colores</span><select data-my="fn" ${f.style === 'liso' ? 'disabled' : ''}>${[1, 2, 3, 4, 5].map(k => `<option value="${k}" ${nc === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <div class="my-f" style="grid-column:span 6"><span>Colores de la bandera</span><div class="my-cps">${[...Array(nc).keys()].map(i => sw('flag' + i, f.c[i])).join('')}</div></div>
    </div>
    <div class="my-prev" id="myprev">${myPreview()}</div>`;
}
function renderMyTeam() {
  return `<div class="screen myteam">
    <div class="p-head"><button class="btn ghost mini" data-a="mydone">← Volver</button><h2>🛠 CREA TU EQUIPO</h2><span></span></div>
    <div class="my-body">
      <div class="my-col" id="myleft">${myLeftHTML()}</div>
      <div class="my-col" id="myplayer">${myPlayerHTML()}</div>
      <div class="my-foot"><button class="btn big alt tx" data-a="myreset">↺ RESTABLECER</button><button class="btn big tx" data-a="mydone">✔ GUARDAR Y VOLVER</button></div>
    </div>
  </div>`;
}
function myRefresh() { const pv = document.getElementById('myprev'); if (pv) pv.innerHTML = myPreview(); drawPreviews(); document.querySelectorAll('.my-cap').forEach((b, i) => { try { b.style.backgroundImage = `url('${flagURI('MIO')}')`; } catch (e) { /* sin bandera aún */ } b.title = MYTEAM.players[i].name; }); }
function myChanged() { applyMyTeam(); saveMyTeam(); myRefresh(); }
function myRepaint() { const c = document.getElementById('myplayer'); if (c) { const y = c.scrollTop; c.innerHTML = myPlayerHTML(); c.scrollTop = y; } }
Object.assign(ACTIONS, {
  mkteam() { G = { screen: 'myteam', mysel: 0, back: G && G.screen === 'pick' ? 'pick' : 'title' }; render(); sfx.click(); },
  mydone() { const b = G && G.back; if (b === 'pick') { G = { screen: 'pick', pickSel: 'MIO', pickLeague: 'SEL' }; render(); } else ACTIONS.title(); sfx.click(); },
  myreset() { if (!confirm('¿Restablecer tu equipo a los valores iniciales?')) return; MYTEAM = sanitizeMyTeam(null); myChanged(); render(); },
  mypick(el) { G.mysel = +el.dataset.i; document.querySelectorAll('.my-cap').forEach((b, i) => b.classList.toggle('on', i === G.mysel)); myRepaint(); sfx.click(); },
  mystar(el) { const p = MYTEAM.players[mySel()]; p.stars = clamp(p.stars + (+el.dataset.d), 1, 5); p.abs = p.abs.slice(0, abSlots(p.stars)); myChanged(); myRepaint(); sfx.click(); },
  myab(el) {
    const p = MYTEAM.players[mySel()], k = el.dataset.k, n = abCount(p.abs, k);
    if (n >= AB_MAX) p.abs = p.abs.filter(x => x !== k);
    else if (p.abs.length >= abSlots(p.stars)) return toast('Sin huecos: sube de estrella (3★ y 5★) o quita un item');
    else p.abs.push(k);
    myChanged(); myRepaint(); sfx.click();
  },
});
document.addEventListener('contextmenu', e => {
  const el = e.target.closest && e.target.closest('[data-a=myab]'); if (!el || !G || G.screen !== 'myteam') return;
  e.preventDefault(); const p = MYTEAM.players[mySel()], ix = p.abs.lastIndexOf(el.dataset.k); if (ix >= 0) p.abs.splice(ix, 1); myChanged(); myRepaint();
});
document.addEventListener('input', e => {
  const f = e.target.dataset && e.target.dataset.my; if (!f || !G || G.screen !== 'myteam') return;
  const t = MYTEAM, v = e.target.value, i = mySel();
  if (f === 'n') t.n = v.slice(0, 22) || 'Mi Equipo';
  else if (f === 's') { const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); if (s !== v) e.target.value = s; t.s = s.padEnd(3, 'X'); }
  else if (f === 'pname') t.players[i].name = v.slice(0, 22) || MY_SLOTS[i];
  else if (f === 'stat') { const k = e.target.dataset.k; t.players[i].stats[k] = clamp(+v, 1, 12); const b = document.getElementById('mst-' + k); e.target.style.accentColor = svCol(+v); if (b) { b.textContent = v; b.className = 'sv sv' + svc(+v); } }
  else if (f === 'home0') t.home[0] = v;
  else if (f === 'away0') t.away[0] = v;
  else if (/^flag\d$/.test(f)) t.flag.c[+f[4]] = v;
  else return;
  myChanged();
});
document.addEventListener('change', e => {
  const f = e.target.dataset && e.target.dataset.my; if (!f || !G || G.screen !== 'myteam') return;
  if (f === 'fstyle') { MYTEAM.flag.style = e.target.value; if (e.target.value === 'liso') MYTEAM.flag.n = 1; else if (MYTEAM.flag.n < 2) MYTEAM.flag.n = 2; }
  else if (f === 'fn') MYTEAM.flag.n = clamp(+e.target.value, 1, 5);
  else if (f === 'form') MYTEAM.form = e.target.value; else return;
  myChanged();
  if (f !== 'form') { const l = document.getElementById('myleft'); if (l) { const y = l.scrollTop; l.innerHTML = myLeftHTML(); l.scrollTop = y; drawPreviews(); } }
});
/* clic en una parte de la bandera de la vista previa: abre el selector de color de ese color */
document.addEventListener('click', e => {
  const r = e.target.closest && e.target.closest('.my-flag [data-ci]'); if (!r || !G || G.screen !== 'myteam') return;
  const inp = document.querySelector(`.my-cp[data-my="flag${r.dataset.ci}"]`); if (inp) { try { inp.showPicker(); } catch (er) { inp.click(); } }
});
