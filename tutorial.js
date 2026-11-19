'use strict';
/* =====================================================================
   TUTORIAL completo: pantallas con ◀ ▶, campo jugable, práctica de
   penaltis y ejemplos reales de cartas / reliquias / habilidades.
   ===================================================================== */
const TUT = { i: 0, stop: null, fld: null, st: { POT: 6, PES: 5, PRE: 9, VIS: 8 } };

/* ---------- campo jugable ---------- */
function tutField(host, cfg) {
  const CW = STAGE_W, CH = STAGE_H - 80, OY = 40, K = 0.62;   // resolución interna reducida (más fluido)
  host.innerHTML = `<div class="tf"><canvas width="${Math.round(CW * K)}" height="${Math.round(CH * K)}"></canvas><div class="tf-msg"></div><button class="btn ghost tf-reset" data-a="tutreset">🔄 REPETIR</button></div>`;
  const cvs = host.querySelector('canvas'), ctx = cvs.getContext('2d'), msgEl = host.querySelector('.tf-msg');
  const kit0 = kitOf('ESP'), kit1 = kitOf('FRA', 'ESP');
  let S = null, pitch = null, alive = true, raf = 0, last = 0, dirty = true;

  const build = () => {
    const d = [[], []];
    cfg.caps.forEach(c => {
      const def = makeCap(c.role, c.team ? 'FRA' : 'ESP'); if (c.st) Object.assign(def.stats, c.st);
      d[c.team][ROLES.findIndex(r => r.k === c.role)] = def;
    });
    const w = makeWorld(ROLES.map((r, i) => d[0][i] || null), ROLES.map((r, i) => d[1][i] || null), { gwL: cfg.gw, gwR: cfg.gw });
    w.bodies.forEach(b => {
      if (b.kind === 'cap') { const c = cfg.caps.find(c => c.team === b.team && c.role === b.role); b.x = b.hx = c.x; b.y = b.hy = c.y; }
      else { b.x = cfg.ball[0]; b.y = cfg.ball[1]; }
    });
    S = { w, phase: 'aim', drag: null, ptr: { x: 0, y: 0 }, aim: null, touched: false, foul: false, goal: false, acc: 0, still: 0, sel: null, hover: null, t: 0 };
    if (!pitch) { pitch = document.createElement('canvas'); pitch.width = Math.round(CW * K); pitch.height = Math.round(CH * K); const c = pitch.getContext('2d'); c.scale(K, K); c.translate(0, -OY); drawPitch(c, w.geo, 'normal', { pat: 0, col: 0 }); }
    setMsg(cfg.hint || '', ''); dirty = true;
  };
  const setMsg = (t, cls) => { msgEl.textContent = t; msgEl.className = 'tf-msg ' + cls + (t ? ' on' : ''); };
  const capById = id => S.w.bodies.find(b => b.id === id);
  let rect = null;
  const pos = e => { const r = rect || (rect = cvs.getBoundingClientRect()); return { x: (e.clientX - r.left) / r.width * CW - FIELD.MX, y: (e.clientY - r.top) / r.height * CH + OY - FIELD.MY }; };
  const aimUpdate = () => { S.aimDirty = true; dirty = true; };
  const aimCalc = () => {
    S.aimDirty = false;
    const c = capById(S.drag.id), dx = c.x - S.ptr.x, dy = c.y - S.ptr.y, len = Math.hypot(dx, dy), pw = Math.min(1, len / 170);
    S.drag.power = pw; S.drag.len = len;
    if (len < 18) { S.aim = null; return; }
    S.drag.ang = Math.atan2(dy, dx);
    S.aim = aimPath(S.w, c.id, S.drag.ang, pw, visFrac(c.st));
  };
  const down = e => {
    rect = cvs.getBoundingClientRect(); dirty = true;
    if (S.phase !== 'aim' || e.button === 2) { if (e.button === 2) { S.drag = null; S.aim = null; S.sel = null; } return; }
    const p = pos(e); S.ptr = p; let best = null, bd = 1e9;
    S.w.bodies.forEach(b => { if (b.kind === 'cap' && b.team === 0) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < b.r + 16 && d < bd) { bd = d; best = b; } } });
    if (best) { S.sel = best.id; S.drag = { id: best.id }; cvs.setPointerCapture && cvs.setPointerCapture(e.pointerId); aimUpdate(); }
  };
  const move = e => {
    if (S.drag && (e.buttons & 2)) { S.drag = null; S.aim = null; S.sel = null; dirty = true; return; }
    const p = pos(e); S.ptr = p;
    if (S.drag) aimUpdate();
    else { let h = null; if (S.phase === 'aim') S.w.bodies.forEach(b => { if (b.kind === 'cap' && b.team === 0 && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 12) h = b.id; }); if (h !== S.hover) { S.hover = h; dirty = true; cvs.style.cursor = h != null ? 'grab' : 'default'; } }
  };
  const up = () => {
    dirty = true;
    if (!S.drag) return;
    if (S.aimDirty) aimCalc(); const d = S.drag; S.drag = null; S.aim = null;
    if (d.len >= 18 && d.ang != null && S.phase === 'aim') {
      const c = capById(d.id); launch(c, d.ang, d.power); S.phase = 'move'; S.touched = false; S.foul = false; S.goal = false; S.still = 0; S.t = 0; setMsg('', '');
    }
  };
  cvs.addEventListener('pointerdown', down); cvs.addEventListener('pointermove', move); cvs.addEventListener('pointerup', up); cvs.addEventListener('contextmenu', e => { e.preventDefault(); if (S.drag) { S.drag = null; S.aim = null; S.sel = null; dirty = true; } });

  const finish = () => {
    S.phase = 'done';
    if (S.foul) setMsg(cfg.foulTxt || '🚩 ¡FALTA! Tocaste a un rival ANTES de tocar el balón. En un partido, el rival tiraría 2 veces seguidas.', 'bad');
    else if (S.goal) setMsg(cfg.goalTxt || '⚽ ¡GOOOL! Así se marca. Pulsa REPETIR para probar otra vez.', 'ok');
    else if (!S.touched) setMsg('🚩 No tocaste el balón: eso también es FALTA. ¡Apunta al balón!', 'bad');
    else setMsg('No ha entrado. Pulsa REPETIR e inténtalo con otro ángulo o con más/menos fuerza.', '');
  };
  const sim = dt => {
    const w = S.w; S.acc += dt; S.t += dt; w.xd = S.t > 5 ? 1 + (S.t - 5) * 2 : 1; let g = 0;
    while (S.acc >= 1 / 200 && g++ < 40) { stepWorld(w, 1 / 200); S.acc -= 1 / 200; if (w.goal) { S.goal = true; break; } }
    for (const e of w.events) {
      if (e.a == null) continue;
      const A = capById(e.a), B = capById(e.b);
      if (e.t === 'ball') { const cp = (A && A.kind === 'cap') ? A : (B && B.kind === 'cap') ? B : null; if (cp && cp.team === 0) S.touched = true; }
      else if (e.t === 'cap' && !S.touched && A && B && A.team !== B.team && (A.team === 0 || B.team === 0)) S.foul = true;
    }
    w.events.length = 0;
    if (S.goal) { S.phase = 'goalwait'; S.gt = 0; }
  };
  const drawAim = () => {
    const c = capById(S.drag.id), a = S.aim, pw = S.drag.power;
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([2, 8]);
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(S.ptr.x, S.ptr.y); ctx.stroke(); ctx.setLineDash([]);
    const col = pw < 0.5 ? '#35e0ff' : pw < 0.85 ? '#c6ff3d' : '#ff4d6d';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pw); ctx.lineWidth = 6; ctx.strokeStyle = col; ctx.stroke();
    if (!a) return;
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([1, 12]); ctx.beginPath(); a.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
    if (a.ballPts && a.ballPts.length > 1) {
      const p0 = a.ballPts[0], p1 = a.ballPts[1], d0 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), half = Math.min(1.1, 2 * (c.dev || 0));
      if (half > 0.012) {
        const L = 200, gr = ctx.createRadialGradient(p0[0], p0[1], 0, p0[0], p0[1], L); gr.addColorStop(0, 'rgba(255,255,255,.34)'); gr.addColorStop(1, 'rgba(255,255,255,.08)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.arc(p0[0], p0[1], L, d0 - half, d0 + half); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([2, 10]); ctx.beginPath(); a.ballPts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
    }
  };
  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(pitch, 0, 0);
    ctx.setTransform(K, 0, 0, K, FIELD.MX * K, (FIELD.MY - OY) * K);
    const w = S.w;
    w.bodies.forEach(b => {
      if (b.kind !== 'cap') return;
      if (S.phase === 'aim' && b.team === 0) {
        const act = b.id === S.sel || b.id === S.hover;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); ctx.lineWidth = act ? 4 : 3; ctx.strokeStyle = act ? '#c6ff3d' : 'rgba(198,255,61,.5)'; ctx.stroke();
      }
      drawCap(ctx, b.x, b.y, b.r, b.team ? kit1 : kit0, { num: b.num });
      if (b.role === 'POR') { ctx.font = '900 ' + Math.round(b.r * 0.4) + 'px "Segoe UI",Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText('GK', b.x, b.y + b.r * 0.98); }
    });
    w.balls.forEach(bl => drawBall(ctx, bl));
    if (S.drag) drawAim();
    (cfg.labels || []).forEach(l => {
      ctx.font = '900 22px "Segoe UI",Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(l.txt).width + 22; ctx.fillStyle = 'rgba(6,12,20,.82)'; ctx.strokeStyle = l.col || '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(l.x - tw / 2, l.y - 17, tw, 34, 10) : ctx.rect(l.x - tw / 2, l.y - 17, tw, 34); ctx.fill(); ctx.stroke();
      ctx.fillStyle = l.col || '#fff'; ctx.fillText(l.txt, l.x, l.y + 1);
    });
    if (cfg.zone) { ctx.strokeStyle = 'rgba(255,209,102,.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.strokeRect(cfg.zone[0], cfg.zone[1], cfg.zone[2], cfg.zone[3]); ctx.setLineDash([]); }
    if (S.phase === 'goalwait') { ctx.font = '900 110px "Arial Black",Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#c6ff3d'; ctx.globalAlpha = Math.min(1, S.gt * 5); ctx.fillText('¡GOOOL!', FIELD.W / 2, FIELD.H / 2); ctx.globalAlpha = 1; }
  };
  const loop = ts => {
    if (!alive) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    if (S.aimDirty && S.drag) aimCalc();
    if (S.phase === 'move') { dirty = true; sim(dt); if (S.phase === 'move') { if (settled(S.w)) { S.still += dt; if (S.still > 0.3) finish(); } else S.still = 0; } }
    else if (S.phase === 'goalwait') { dirty = true; S.gt += dt; for (let i = 0; i < 6; i++) stepWorld(S.w, 1 / 200); S.w.events.length = 0; S.w.goal = null; if (S.gt > 1.1) finish(); }
    if (dirty) { dirty = false; draw(); }
  };
  build(); raf = requestAnimationFrame(loop);
  return {
    reset: build, rebuild: c => { if (c) Object.assign(cfg, c); pitch = null; build(); },
    stop: () => { alive = false; cancelAnimationFrame(raf); },
  };
}

/* ---------- práctica de penaltis ---------- */
function tutPen(host) {
  host.innerHTML = `<div class="tpen">
    <div class="tpen-tabs"><button class="on" data-m="shoot">⚽ SOY EL TIRADOR</button><button data-m="keep">🧤 SOY EL PORTERO</button></div>
    <div class="tpen-pre"><label>Precisión del tirador: <b id="tpPre">6</b></label><input type="range" id="tpRange" min="1" max="12" value="6"></div>
    <div class="tpen-bar"><div class="tpen-green"></div><div class="tpen-ctr"></div><div class="tpen-mark s"></div><div class="tpen-mark g"></div></div>
    <div class="tpen-leg"><span>◀ palo izquierdo</span><span>centro</span><span>palo derecho ▶</span></div>
    <button class="btn big" id="tpGo">¡CHUTA!</button>
    <div class="tpen-res" id="tpRes"></div></div>`;
  let mode = 'shoot', pre = 6, t = 0, gt = 0, stopped = false, sp = 0.5, gp = 0.5, stopAt = 0, alive = true, raf = 0, last = 0;
  const bar = host.querySelector('.tpen-bar'), green = host.querySelector('.tpen-green'), mS = host.querySelector('.tpen-mark.s'), mG = host.querySelector('.tpen-mark.g'), res = host.querySelector('#tpRes'), go = host.querySelector('#tpGo');
  const SPD = 1.35, GC = 0.5;
  const setGreen = () => { const g = penGreen({ PRE: pre }); green.style.left = ((GC - g / 2) * 100) + '%'; green.style.width = (g * 100) + '%'; };
  const reset = () => {
    t = 0; gt = 0; stopped = false; res.textContent = ''; res.className = 'tpen-res'; stopAt = 0.7 + Math.random() * 1.2; sp = 0.5; gp = 0.5;
    mS.style.display = mode === 'shoot' || true ? 'block' : 'none'; mG.style.display = mode === 'keep' ? 'block' : 'none';
    go.textContent = mode === 'shoot' ? '¡CHUTA! (clic o ESPACIO)' : '¡PARA! (clic o ESPACIO)';
    setGreen();
  };
  const act = () => {
    if (!alive) return;
    if (stopped) { reset(); return; }
    stopped = true;
    if (mode === 'shoot') {
      const ok = Math.abs(sp - GC) <= penGreen({ PRE: pre }) / 2;
      res.textContent = ok ? '⚽ ¡GOL! La flecha paró en la zona VERDE.' : '🧤 ¡Parada! La flecha quedó en zona roja.'; res.className = 'tpen-res ' + (ok ? 'ok' : 'bad');
    } else {
      const ok = Math.abs(sp - GC) <= penGreen({ PRE: pre }) / 2, saved = ok && Math.abs(gp - GC) < Math.abs(sp - GC);
      if (!ok) { res.textContent = '😅 El tirador falló solo (cayó en zona roja).'; res.className = 'tpen-res ok'; }
      else if (saved) { res.textContent = '🧤 ¡PARADÓN! Tu flecha quedó más cerca del centro que la del tirador.'; res.className = 'tpen-res ok'; }
      else { res.textContent = '⚽ Gol: tu flecha quedó más lejos del centro que la del tirador.'; res.className = 'tpen-res bad'; }
    }
    go.textContent = '🔄 OTRA VEZ';
  };
  const loop = ts => {
    if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    if (!stopped) {
      if (mode === 'shoot') { t += dt; sp = penPos(t, SPD); }
      else { t += dt; if (t < stopAt) sp = penPos(t, SPD); else sp = penPos(stopAt, SPD); gt += dt; gp = penPos(gt, SPD * 1.1); }
    }
    mS.style.left = (sp * 100) + '%'; mG.style.left = (gp * 100) + '%';
  };
  host.querySelectorAll('.tpen-tabs button').forEach(b => b.onclick = () => { mode = b.dataset.m; host.querySelectorAll('.tpen-tabs button').forEach(x => x.classList.toggle('on', x === b)); host.querySelector('.tpen-pre label').firstChild.textContent = mode === 'shoot' ? 'Tu precisión: ' : 'Precisión del tirador rival: '; reset(); });
  host.querySelector('#tpRange').oninput = e => { pre = +e.target.value; host.querySelector('#tpPre').textContent = pre; setGreen(); };
  go.onclick = act; bar.onclick = act;
  const key = e => { if (e.code === 'Space' && !$('#help').classList.contains('hidden')) { e.preventDefault(); act(); } };
  document.addEventListener('keydown', key);
  reset(); raf = requestAnimationFrame(loop);
  return { stop: () => { alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', key); } };
}

/* ---------- helpers de contenido ---------- */
const tcard = (c, lv = 1, cap) => `<figure class="tc">${cardOf({ k: c, lv })}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
const tperk = (k, cap) => { const d = PERKS[k]; return `<figure class="tc">${cardHTML({ cat: 'reliquia', rar: rarityOf(d.price), art: `<div class="emo">${d.icon}</div>`, name: d.n, desc: d.d })}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`; };
const tabil = (k, cap) => { const d = ABILITIES[k]; return `<figure class="tc">${cardHTML({ cat: 'mejora', rar: rarityOf(d.price || 6), art: `<div class="emo">${d.icon}</div>`, name: d.n, desc: d.d, badge: 'HABILIDAD' })}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`; };
const ex = t => `<div class="tx"><b>EJEMPLO</b>${t}</div>`;
const KEYS = t => `<kbd>${t}</kbd>`;
const GOALPOS = [{ x: 500, y: 320 }];

/* ---------- pantallas ---------- */
const TSTEPS = [
  { t: 'Bienvenido a CAP CUP', ic: '👋', cls: 'wide', body: () => `
    <div class="t-intro"><div class="t-big">⚽ Mete más goles que tu rival</div>
    <p>CAP CUP es fútbol con jugadores: <b>lanzas un jugador contra el balón</b> y todo rebota como en una mesa. Entre partido y partido <b>compras mejoras</b> para tu equipo, como en un roguelike.</p>
    <div class="t-tiles">
      <div><span>🏆</span><b>Torneo</b><small>5 rondas (de dieciseisavos a la final). Si pierdes, se acaba.</small></div>
      <div><span>📊</span><b>Liga</b><small>Todos contra todos. Los empates cuentan.</small></div>
      <div><span>🤝</span><b>Amistoso</b><small>Elige los dos equipos, sin presión. También 2 jugadores.</small></div>
      <div><span>🥅</span><b>Penaltis</b><small>Tandas de penaltis para practicar.</small></div>
    </div>
    <p class="t-sm">Este tutorial tiene ${'{N}'} pantallas. Avanza con <b>SIGUIENTE ▶</b> o con las teclas ${KEYS('←')} ${KEYS('→')}. Hay partes <b>jugables</b>: ¡pruébalas!</p></div>` },

  { t: 'El campo', ic: '🏟️', fld: { caps: [
      { team: 0, role: 'POR', x: 60, y: 320 }, { team: 0, role: 'DEF', x: 220, y: 200 }, { team: 0, role: 'MED', x: 380, y: 330 }, { team: 0, role: 'EXT', x: 450, y: 120 }, { team: 0, role: 'DEL', x: 450, y: 520 },
      { team: 1, role: 'POR', x: 940, y: 320 }, { team: 1, role: 'DEF', x: 780, y: 440 }, { team: 1, role: 'MED', x: 620, y: 310 }, { team: 1, role: 'EXT', x: 550, y: 520 }, { team: 1, role: 'DEL', x: 550, y: 120 }],
      ball: [500, 320], hint: 'Puedes mover tus jugadores: arrastra uno hacia atrás y suelta.',
      labels: [{ x: 120, y: 585, txt: 'TU PORTERÍA', col: '#c6ff3d' }, { x: 880, y: 585, txt: 'PORTERÍA RIVAL', col: '#ff8a8a' }, { x: 500, y: 595, txt: '⚽ BALÓN', col: '#fff' }] },
    body: () => `<ul class="t-list">
      <li><b>Tu equipo</b> (halo verde) ataca hacia la <b>derecha</b>. El rival ataca hacia la izquierda.</li>
      <li>Cada equipo tiene <b>5 jugadores</b>: 1 portero 🧤, defensa, mediocentro, extremo y delantero.</li>
      <li>Las <b>paredes rebotan</b> el balón y los jugadores: úsalas a tu favor.</li>
      <li>Para marcar, el balón tiene que <b>entrar en la portería</b> (el hueco blanco de los extremos).</li>
      <li>Al empezar el partido y tras cada gol, las dos porterías están cerradas con una barra rojiza. Es un escudo que aguanta un solo golpe: si el balón la toca, esa barra desaparece. Y cuando termina la primera jugada, las dos se desactivan solas.</li>
      <li>Si el balón se queda parado, los dos pueden tirar: gana quien tenga más tiros acertados. Mira los puntos junto al marcador.</li>
    </ul>` },

  { t: 'Tu primer tiro', ic: '🎯', fld: { caps: [{ team: 0, role: 'DEL', x: 330, y: 320, st: { POT: 7, PRE: 10, VIS: 10 } }, { team: 1, role: 'POR', x: 940, y: 320 }], ball: [560, 320], gw: 260,
      hint: '👉 Arrastra tu jugador HACIA ATRÁS (como una catapulta) y suelta para golpear el balón.' },
    body: () => `<ul class="t-list">
      <li><b>1.</b> Pon el ratón sobre tu jugador (se ilumina) y <b>arrastra hacia atrás</b>, en dirección contraria a donde quieres tirar.</li>
      <li><b>2.</b> Cuanto más estires, <b>más fuerza</b>: el anillo se pone azul → verde → <b>rojo (máxima)</b>.</li>
      <li><b>3.</b> Las líneas de puntos te enseñan el camino del jugador y del balón.</li>
      <li><b>4.</b> <b>Suelta</b> para lanzar. ¡Mete gol en la portería de la derecha!</li>
      <li class="t-tip">🖱️ <b>Clic derecho</b> mientras apuntas cancela el tiro y te deja elegir otro jugador.</li></ul>` },

  { t: 'Rebotes y pared', ic: '🧱', fld: { caps: [{ team: 0, role: 'DEL', x: 300, y: 500, st: { POT: 8, PRE: 10, VIS: 12 } }, { team: 1, role: 'DEF', x: 720, y: 320, st: { PES: 9 } }, { team: 1, role: 'POR', x: 940, y: 320 }], ball: [520, 480], gw: 280,
      hint: 'Hay un rival tapando el camino recto. ¡Rebota el balón en la pared de arriba o abajo!', labels: [{ x: 720, y: 255, txt: 'rival tapando', col: '#ff8a8a' }] },
    body: () => `<ul class="t-list">
      <li>El balón <b>rebota en las paredes</b> casi sin perder fuerza. Apunta a la pared para rodear a los defensas.</li>
      <li>La guía de puntos blancos <b>dibuja el rebote</b> antes de tirar (si tu visión es alta).</li>
      <li>Si el balón pasa <b>entre varios de tus jugadores</b> o rebota mucho antes de entrar, hay <b>COMBO</b>: el gol vale más dinero.</li>
      <li>Los jugadores también chocan entre sí: un jugador pesado empuja a uno ligero.</li>
      <li class="t-tip">💡 Prueba: apunta un poco por encima del rival para que el balón bote en la pared de arriba y vuelva hacia la portería.</li></ul>` },

  { t: 'Faltas y penaltis', ic: '🚩', fld: { caps: [{ team: 0, role: 'DEL', x: 330, y: 320, st: { POT: 8, PRE: 10, VIS: 12 } }, { team: 1, role: 'DEF', x: 460, y: 320, st: { PES: 8 } }, { team: 1, role: 'POR', x: 940, y: 320 }], ball: [590, 320], gw: 260,
      hint: 'El rival está entre tu jugador y el balón. Dispara recto y verás qué pasa…', labels: [{ x: 460, y: 255, txt: 'rival en medio', col: '#ff8a8a' }],
      foulTxt: '🚩 ¡FALTA! Tocaste a un rival antes del balón: el contrario tiraría 2 veces seguidas.' },
    body: () => `<ul class="t-list">
      <li>Si tu jugador <b>toca a un rival ANTES de tocar el balón</b>, es <b>falta</b>: el rival tira 2 veces seguidas.</li>
      <li>Si no tocas el balón en toda la jugada, también es falta.</li>
      <li><b>Penalti:</b> si cometes esa falta <b>dentro de TU área</b> (la zona dorada de la portería de tu lado), el rival lanza un penalti.</li>
      <li>Los tiros extra de una falta <b>no gastan</b> el cupo de tiros.</li>
      <li class="t-tip">🟨 Existe la carta <b>Tarjeta amarilla</b> para expulsar durante unos turnos a jugadores del rival (lo verás en los comodines).</li></ul>`, zone: true },

  { t: 'Turnos y tiros', ic: '🔁', cls: 'wide', body: () => `
    <div class="t-two"><div>
    <ul class="t-list">
      <li>Los equipos juegan <b>por turnos</b>: tiras tú, tira el rival, y así.</li>
      <li>Cada equipo tiene un <b>cupo de tiros</b> por partido: son los puntos junto al marcador. Un partido normal son <b>10 tiros</b> cada uno.</li>
      <li>Los <b>tiros extra</b> (faltas, cartas) no gastan cupo.</li>
      <li>Al acabar los tiros gana quien tenga más goles.</li>
      <li><b>Empate</b> en torneo = <b>prórroga</b>: 3 tiros más por equipo, de oro. Si sigue igual, <b>tanda de penaltis</b>.</li>
      <li>Un tiro con mucho <b>combo</b> puede cambiar un partido. Piensa dónde dejas el balón para el siguiente.</li>
    </ul></div>
    <div class="t-demo">
      <div class="pipdemo"><b>TÚ</b> <span>${'<i class="on"></i>'.repeat(7)}${'<i></i>'.repeat(3)}</span><em>7 tiros restantes</em></div>
      <div class="pipdemo"><b>RIVAL</b> <span>${'<i class="on"></i>'.repeat(8)}${'<i></i>'.repeat(2)}</span><em>8 tiros restantes</em></div>
      <div class="pipdemo extra"><b>EXTRA</b> <span><i class="on x"></i><i class="on x"></i></span><em>tiros extra (no gastan cupo)</em></div>
    </div></div>` },

  { t: 'Estadísticas de los jugadores', ic: '📊', fld: 'stats',
    body: () => `<div class="t-stats">
      ${['POT', 'PES', 'PRE', 'VIS'].map(k => `<div class="t-sl"><label>${STATS[k].icon} <b>${STATS[k].n}</b><output id="o${k}">${TUT.st[k]}</output></label><input type="range" min="1" max="12" value="${TUT.st[k]}" data-k="${k}"><small class="t-sd">${STATS[k].d}</small></div>`).join('')}
      <div class="t-ro" id="tRO"></div>
      <p class="t-sm">Mueve las barras y <b>dispara</b> con el jugador. Fíjate en el abanico blanco: es el <b>desvío</b> que puede tener el balón.</p></div>` },

  { t: 'Mentalidad 🔥', ic: '🔥', cls: 'wide', body: () => `
    <div class="t-two"><div><ul class="t-list">
      <li>Cada jugador tiene una 5ª estadística: la <b>MENTALIDAD</b>.</li>
      <li>Mentalidad 5: no cambia nada. Con 6 o más, el jugador puede empezar con una mejora repartida entre potencia, peso, precisión y visión: hasta +0.3 con 6 y hasta +0.5 con 8 en total (al azar, puede ser menos). Con 11 siempre +1 y con 12 siempre +2. Con menos de 5 ocurre al revés: puede perder hasta −0.3 (hasta −0.5 con 2 o menos).</li>
      <li>Si te toca, el jugador luce un <b>reborde arcoíris</b> (más opaco cuanto más ha subido) y ves <span class="g">+0.7</span> junto al valor.</li>
      <li>Durante el partido cambia: <b>meter goles</b> la sube (más al goleador, algo a todo el equipo).</li>
      <li>Un <b>gol en propia</b> o ir perdiendo por <b>3 o más goles</b> la baja (hasta −1), y verás <span class="r">−0.5</span> en rojo.</li>
      <li>Se mejora con dinero (<b>+2 Mentalidad</b> en la tienda) o con cartas. El RESUMEN del partido apunta cada subida y bajada.</li>
    </ul></div>
    <div class="t-demo"><div class="rimcap"><i></i></div>
      <div class="t-vals"><div><span>💥 Potencia</span><b>7.0 <em class="g">+0.7</em></b></div><div><span>🎯 Precisión</span><b>8.0 <em class="g">+0.4</em></b></div><div><span>⚖️ Peso</span><b>5.0 <em class="r">−0.5</em></b></div></div>
      <small>Jugador con reborde arcoíris y valores que suben (verde) o bajan (rojo).</small></div></div>` },

  { t: 'Tu plantilla', ic: '🧑‍🤝‍🧑', cls: 'wide', body: () => `
    <div class="t-two"><div><ul class="t-list">
      <li><b>${ROLES.map(r => r.n).join(' · ')}</b>: cada puesto tiene sus fortalezas (el portero es grande, el delantero potente…).</li>
      <li>Cada selección tiene su propio estilo y <b>nivel real</b>: Brasil, España o Argentina son más fuertes que Tailandia o Irlanda.</li>
      <li>⭐ Cada <b>estrella</b> extra (hasta 5★) cuesta dinero (<b>$8, $14, $22, $32</b>) y da <b>+1 a TODAS las estadísticas</b> para siempre.</li><li>Las estrellas también dan <b>huecos de habilidad</b>: 1 hueco con 1★–2★, <b>2 con 3★</b> y <b>3 con 5★</b>. Los rivales tienen más estrellas según avanzas de ronda.</li><li>En la tienda hay un item <b>⭐ +1 Estrella</b>: elige el jugador que la recibe (si ya tiene 5★ no se puede).</li>
      <li>Antes del partido puedes cambiar la <b>formación</b> (cómo se colocan los 5 jugadores en el campo).</li>
      <li>En el <b>vestuario</b> (la tienda) ves a todos tus jugadores con un <b>pentágono</b> de estadísticas: cuanto más grande, mejor.</li>
      <li>Con <b>Ver jugadores</b> puedes mirar un equipo antes de elegirlo.</li>
    </ul></div>
    <div class="t-demo"><div class="t-radar">${radarSVG({ POT: 8, PES: 6, PRE: 9, VIS: 7, MEN: 5 })}</div><small>Pentágono de un delantero: Potencia, Peso, Precisión, Visión y Mentalidad.</small>
    <div class="t-roles">${ROLES.map(r => `<span>${r.k}<small>${r.n}</small></span>`).join('')}</div></div></div>` },

  { t: 'Dinero y tienda', ic: '💰', cls: 'wide', body: () => `
    <div class="t-two"><div><ul class="t-list">
      <li>Empiezas con <b>$15</b>. Al acabar el partido cobras: <b>victoria $5</b> o <b>empate $3</b>, <b>$1 por gol</b>, <b>$1 por cada gol de diferencia</b>, <b>$1 por cada jugador con 3 o más goles</b> y <b>$1 por no hacer faltas</b>. Los <b>combos y rebotes</b> suman más. Después se aplican las reliquias. Pasa el ratón por el dinero de los resultados para ver el desglose.</li>
      <li>Entre partido y partido entras a la <b>TIENDA</b>: compras con el dinero de la partida.</li>
      <li>Ahí hay: <b>mejoras de estadística</b> (+2 a un jugador), <b>+1 Estrella</b>, <b>cartas comodín</b>, <b>reliquias</b> y <b>habilidades</b>.</li>
      <li>Después de ganar un partido gira la <b>🎡 RULETA</b>: 8 casillas, 6 con premio (×2 o ×1.5 sobre el dinero que ganaste en ese partido, comodín, reliquia o mejora GRATIS que aparecen en la tienda a $0), 1 en blanco y 1 que te quita dinero. Si empatas, otra casilla de premio pasa a blanco (2 en blanco). Si pierdes no hay ruleta.</li>
      <li>Algunas reliquias dan dinero: <b>Aforo completo</b> (×2 tu dinero) y <b>Junta de accionistas</b> (+$50) se activan al comprarlas y no ocupan hueco; <b>Freestyler</b> te da $1 por cada rebote por encima de 4 en tus goles.</li>
      <li>Si no te gusta lo que hay, puedes <b>refrescar</b> la tienda por <b>$3</b>.</li>
      <li>Tienes <b>4 huecos de reliquia</b> y <b>3 de comodines</b>. Puedes <b>vender</b> una reliquia por la mitad de su precio.</li>
      <li>En mitad del partido hay un botón <b>🛒 TIENDA</b> para comprar cuando es tu turno (en pleno partido todo cuesta el doble) y otro <b>🎡 RULETA</b> para apostar de $1 a $5 por un premio.</li>
    </ul></div>
    <div class="t-demo"><div class="shopmock"><span>💥 +2 Potencia <b>$5</b></span><span>🎯 +2 Precisión <b>$5</b></span><span>🃏 Comodín <b>$5–10</b></span><span>🏅 Reliquia <b>$8–12</b></span><span>🔄 Refrescar <b>$3</b></span></div><small>Precios orientativos de la tienda.</small></div></div>` },

  { t: 'Ruleta en el partido', ic: '🎡', cls: 'wide', body: () => `
    <div class="t-two"><div><ul class="t-list">
      <li>En tu turno, con el balón parado, pulsa <b>🎡 RULETA</b> (bajo el botón de tienda). El partido se <b>pausa</b> y se abre la ruleta.</li>
      <li>Cada tirada extra en el mismo partido sube $1 el rango: la primera va de $1 a $5, la segunda de $2 a $6, la tercera de $3 a $7… La calidad del premio depende de la posición en el deslizador, no del precio.</li>
      <li>Elige con el deslizador cuánto <b>apuestas: de $1 a $5</b>. Al pulsar <b>TIRAR</b> se te cobra y la ruleta gira.</li>
      <li>Tiene <b>8 casillas</b>: <b>💰 dinero</b>, <b>🃏 comodín</b>, <b>🏅 reliquia</b>, <b>💪 mejora de jugador</b>, <b>🧩 habilidad</b> y casillas de <b>❌ NADA</b>.</li>
      <li><b>Cuanto más apuestas, mejor premio</b>: los iconos de comodín, reliquia, mejora y habilidad llevan <b>★1 a ★5</b> y brillan más. Con más estrellas salen cartas más raras (con ★5 puede tocar una Estrella). Las cartas no tienen niveles.</li>
      <li>Las casillas de <b>NADA</b> son <b>2</b> si apuestas $1, <b>1</b> con $2 o $3 y <b>ninguna</b> con $4 o más.</li>
      <li>Al parar te muestra el premio. El dinero se suma al instante y el <b>dinero actual</b> del cuadro se actualiza con lo ganado o perdido. Lo demás es <b>GRATIS</b>: pulsa <b>COGER PREMIO</b> y en el vestuario colocas la mejora en un jugador, o añades el comodín o la reliquia a tu barra (si no tienes hueco, <b>vende</b> uno para hacerlo).</li>
      <li>Después puedes <b>seguir jugando</b>. La <b>✕</b> de la esquina cierra la ruleta y continúa el partido normal.</li>
    </ul></div>
    <div class="t-demo"><div class="shopmock"><span>🎡 Apuesta <b>$1</b> → 2 casillas de NADA</span><span>🎡 Apuesta <b>$3</b> → 1 casilla de NADA</span><span>🎡 Apuesta <b>$5</b> → sin NADA y premios ★5</span></div><small>Más dinero = menos NADA y mejores premios.</small></div></div>` },

  { t: 'Comodines (1/2): tiros', ic: '🃏', cls: 'cards', body: () => `
    <p class="t-lead">Las <b>cartas comodín</b> se usan en tu turno (clic en la carta) y <b>se gastan</b> al usarlas; si ya usaste una, <b>desaparece de la lista</b> también en la tienda y en el resto del partido. Los comodines de la partida (tuyos o de la CPU) se aplican <b>después de pulsar ACEPTAR</b> en el aviso que explica su efecto. Estas dan <b>tiros</b> o quitan tiros al rival:</p>
    <div class="t-cards">${tcard('doble', 1, 'Tiras dos veces seguidas')}${tcard('triple', 1, '¡Y a la tercera!')}${tcard('silbato', 1, 'El rival se queda sin turno')}</div>
    ${ex('Vas 0-1 y te quedan pocos tiros. Usas <b>Jugada doble</b>: tiras con un jugador, y sin esperar al rival, tiras otra vez. Si el 2º tiro es gol, empatas. Con el <b>Silbato</b> el rival pierde su siguiente turno y tú juegas dos veces.')}` },

  { t: 'Comodines (2/2): control', ic: '🎴', cls: 'cards', body: () => `
    <p class="t-lead">Otras cartas <b>cambian las reglas</b> del partido. Las cartas <b>no tienen niveles</b>: todas funcionan siempre igual.</p>
    <div class="t-cards">${tcard('amarilla', 1, 'Expulsa jugadores rivales unos turnos')}${tcard('blindada', 1, 'Tu portería cerrada')}${tcard('congelar', 1, 'Un jugador rival no se mueve')}${tcard('terremoto', 1, 'Todo se sacude')}</div>
    ${ex('Tu portería está en peligro: usas <b>Portería blindada</b> y el balón rebota en una pared invisible durante la jugada del rival. O le pones una <b>Tarjeta amarilla</b> a su delantero para que el rival no pueda usarlo.')}` },

  { t: 'Comodines (nuevos)', ic: '🎴', cls: 'cards', body: () => `
    <p class="t-lead">Más comodines para <b>fastidiar al rival</b> o dar golpes de efecto:</p>
    <div class="t-cards">${tcard('presion', 1, 'Mentalidad rival a 1')}${tcard('plantilla', 1, 'Cambia cuántos juegan')}${tcard('ladron', 1, 'Robas un comodín')}${tcard('apagon', 1, 'Sin comodines 2 turnos')}${tcard('puertacerrada', 1, 'Tu portería cerrada 2 turnos')}${tcard('ceguera', 1, 'Rival sin flecha 3 turnos')}${tcard('desmotivacion', 1, 'Rival −1 en todo')}${tcard('intoxicados', 1, 'Rival sin puntería')}${tcard('corona', 1, 'GOAT al azar')}${tcard('pase', 1, 'Goles de pase doble')}</div>
    ${ex('<b>Pase de oro</b>: tiras con un jugador pero mete gol OTRO de tu equipo con el balón rodando; ese gol cuenta doble. <b>Elegido GOAT</b>: un jugador AL AZAR juega con todo a 12: 70% de tu equipo, 30% del rival. <b>Superestrella</b>: sus próximos goles valen doble. <b>Pase de la muerte</b>: durante 3 turnos, quien recibe un pase dispara a portería a máxima potencia. <b>Invisibles</b>: el rival no ve al equipo durante sus próximas jugadas. <b>Fuera de juego</b>: se anula el próximo gol del rival. <b>Penalti injusto</b>: penalti a favor sin gastar tiro. <b>Lesión</b>: un jugador tuyo se lesiona y juegas con uno menos, pero el premio del partido se multiplica por 3. <b>Marrullero</b>: los goles que marcas empujando a un rival (un jugador tuyo choca con uno rival antes del gol) valen doble. <b>Césped alto</b>: en tu área el balón se frena muchísimo; solo lo cruzan los tiros muy fuertes. <b>Teatrero</b>: durante unas jugadas del rival, cualquier roce a tus jugadores antes de tocar el balón es falta a tu favor. <b>Soborno</b>: en tu turno controlas un jugador rival (el portero no); los niveles altos dan tiros extra. La CPU también usa todos los comodines. Si el rival usa un comodín, sale un aviso grande con su bandera en el centro. Los comodines se conservan al cambiar de equipo, igual que las reliquias.')}` },

  { t: 'Reliquias', ic: '🏅', cls: 'cards', body: () => `
    <p class="t-lead">Las <b>reliquias</b> son mejoras que duran <b>3 partidos</b>: el número de arriba a la derecha te dice cuántos te quedan. Funcionan solas y tienes 4 huecos:</p>
    <div class="t-cards">${tperk('hinchada', 'Más potencia siempre')}${tperk('ventaja', 'Empiezas 1-0')}${tperk('botas', 'Más dinero por gol')}${tperk('goleada', '+$1 por gol de diferencia')}${tperk('bolsillo', '+1 hueco de comodín')}${tperk('rebajas', 'Comodines a mitad de precio')}${tperk('reflejos', 'Comodines también en el turno rival')}</div>
    ${ex('Con <b>Hinchada</b> todos tus jugadores pegan un 12% más fuerte en todos los partidos. Si compras <b>Ventaja de oro</b> y <b>Botas de oro</b>, empiezas ganando y cada gol te da más dinero. ¡Combínalas! <b>Reflejos</b>: puedes usar tus comodines también durante el turno del rival, justo antes de que tire. <b>Guantes</b>: el portero atrae el balón durante las jugadas del rival. <b>Sangre fría</b>: todos tus penaltis son gol, aunque la barra no pare en verde. <b>Multiportero</b>: el jugador más cercano a tu portería crece un 30% (se recalcula cada turno).')}` },

  { t: 'Habilidades de jugador', ic: '🎖️', cls: 'cards', body: () => `
    <p class="t-lead">Las <b>habilidades</b> se ponen a UN jugador (necesitas huecos: dependen de sus ⭐). Salen como iconos alrededor del jugador:</p>
    <div class="t-cards">${tabil('canon', '+30% de potencia por copia')}${tabil('bulldozer', 'Masa ×1.7')}${tabil('iman', 'Atrae el balón')}${tabil('instinto', 'Dispara tras un pase')}</div>
    <p class="t-lead">Puedes repetir la misma habilidad hasta <b>3 veces</b> en un jugador (no tienen niveles, se suman las copias). Las nuevas:</p>
    <div class="t-cards">${tabil('motiv', 'Segunda mitad: sube todo')}${tabil('control', 'Amortigua el balón')}${tabil('piedra', 'No la mueve nadie')}${tabil('hierro', 'Inmune a veneno y hielo')}${tabil('goat', 'Probabilidad de todo a 12')}${tabil('arana', 'Corre hacia el balón')}</div>
    <p class="t-lead">Y los que <b>mejoran o fastidian durante el partido</b> (todo se reinicia al cambiar de partido):</p>
    <div class="t-cards">${tabil('capitan', 'Compañeros +N en una stat')}${tabil('corazon', 'Cada turno mejora una stat')}${tabil('vampiro', 'Resta stats al rival')}${tabil('demonio', 'Tira solo tras rebote rival')}${tabil('diamante', 'Sus goles dan más dinero')}</div>
    ${ex('Un portero con <b>Gigante</b> ocupa más portería. Un delantero con <b>Cañonero</b> pega un 30% más fuerte por copia. <b>🎖️ Gran Capitán</b>: al empezar el partido todos sus compañeros ganan +1 (con 2 copias +2, con 3 +3) en una estadística al azar, y lo verás en su ficha. <b>✨ Motivado</b>: en la segunda mitad sube todas sus estadísticas +1, +2 o +3. <b>🩹 Salud de hierro</b>: 1 copia protege la primera mitad, 2 todo el partido, 3 a todo el equipo. <b>💙 Corazón</b> sube una estadística cada turno. <b>🧛 Vampiro</b> resta estadísticas al rival que toca antes del balón. <b>😈 Demonio</b> tira a portería cuando le llega un balón tocado por el rival (dispersión 30%, 20% o 5%). <b>💎 Diamante</b>: sus goles dan $1, $2 o $4 más. <b>Araña</b>: 1 copia se acerca poco al balón, 2 bastante y 3 mucho; se para cuando alguien lo toca. Solo reacciona si el balón está a menos de 3 veces su tamaño. Con 3 <b>GOAT</b> el balón va siempre a portería.')}` },

  { t: 'Campos y balones especiales', ic: '🌍', cls: 'wide', body: () => `
    <p class="t-lead">A veces el campo o el balón <b>no son normales</b>. Cambian cómo se juega:</p>
    <div class="t-two cols"><div><h4>Campos</h4><div class="t-icons">${Object.keys(FIELDS).filter(k => k !== 'normal').map(k => `<div><span>${FIELDS[k].icon}</span><b>${FIELDS[k].n}</b><small>${FIELDS[k].d}</small></div>`).join('')}</div></div>
    <div><h4>Balones</h4><div class="t-icons">${Object.keys(BALLS).filter(k => k !== 'normal').map(k => `<div><span>${BALLS[k].icon}</span><b>${BALLS[k].n}</b><small>${BALLS[k].d}</small></div>`).join('')}</div></div></div>` },

  { t: 'Penaltis', ic: '🥅', pen: true,
    body: () => `<ul class="t-list">
      <li>Una flecha <b>va y viene</b> por la barra. Pulsa <b>clic o ESPACIO</b> para pararla.</li>
      <li>Si queda en la <b>zona verde</b> (centro) es <b>GOL</b>; si queda en rojo, lo para el portero.</li>
      <li>La zona verde es <b>más grande cuanto más precisión</b> tiene el tirador.</li>
      <li><b>Si eres el portero</b> también te sale una flecha: para. Si queda <b>más cerca del centro</b> que la del tirador, ¡penalti parado!</li>
      <li>Hay penaltis por <b>falta en el área</b>, en <b>tandas</b> tras la prórroga y en el modo amistoso.</li>
      <li class="t-tip">Prueba los dos papeles aquí a la derecha. Sube y baja la precisión para ver cómo cambia el verde.</li></ul>` },

  { t: 'Reglas y detalles del partido', ic: '📜', cls: 'wide', body: () => `
    <div class="t-two"><div><h4>Reglas de juego</h4><ul class="t-list">
      <li>🚩 <b>Falta</b>: si el tiro termina sin que nadie toque el balón (ni rival ni tú), o tocas antes a un rival, se pita falta. Dentro del <b>área</b> es <b>penalti</b>; fuera del área, nunca.</li>
      <li>📹 Al pitar un penalti, el aviso incluye el botón <b>Ver repetición</b>.</li>
      <li>⚽ Con <b>varios balones</b>, las flechas de puntería (blanca y roja) toman como referencia el balón <b>más cercano a la línea recta</b> del tiro.</li>
      <li>🧤 <b>Control de balón</b> (habilidad): para el balón en seco tanto si viene de un tiro rival como de tu propia jugada.</li>
      <li>🔴 Con la <b>pelota pequeña</b> no entra gol si la portería tiene la barrera roja.</li>
      <li>🔄 <b>Intercambio total</b>: los jugadores de un equipo pasan a las posiciones exactas del otro, y viceversa.</li>
      <li>🏁 Al terminar el partido sale el cartel <b>FINAL</b> y el árbitro pita dos veces.</li>
    </ul></div><div><h4>Interfaz</h4><ul class="t-list">
      <li>🛒 En la tienda a mitad de partido, los comodines que ya usaste no aparecen.</li>
      <li>✅ El botón <b>Continuar</b> tras un gol tiene fondo de color.</li>
      <li>🧪 En el <b>laboratorio</b>: <b>Repetir tiro</b> devuelve balón y jugadores a las posiciones previas al último tiro.</li>
      <li>📱 En móvil los comodines de la mano son más pequeños para no tapar el campo, y el juego se abre a <b>pantalla completa</b> (te lo pregunta).</li>
    </ul></div></div>` },

  { t: 'Modos de juego', ic: '🏆', cls: 'wide', body: () => `
    <div class="t-modes">
      <div><h4>🏆 Torneo</h4>Antes de empezar eliges los <b>turnos por equipo</b> y si hay <b>fase de grupos</b> (grupos de 4: pasan los 2 primeros y se juega desde Octavos). Después: <b>Octavos, Cuartos, Semis y Final</b>; al ganar la final eres <b>CAMPEÓN</b> 🏆 y se acaba el torneo. Si pierdes, se acaba, pero en el cuadro puedes pulsar <b>⏩ SIMULAR</b> para ver cómo habrían acabado el resto de partidos y los goleadores. Mira el <b>🏆 CUADRO</b> con los otros partidos y los goleadores (los resultados salen al acabar tu partido). El rival también tiene comodines y los ves arriba a la derecha.</p></div>
      <div><h4>📊 Liga</h4><p><b>10 equipos</b>, todos contra todos (9 jornadas). Se puede empatar. Hay clasificación y goleadores, y tienda entre jornadas.</p></div>
      <div><h4>🤝 Amistoso</h4><p>Elige los dos equipos mirando sus estadísticas. Puedes jugar contra la CPU o <b>2 jugadores</b>, con tandas de penaltis y repeticiones 📹.</p></div>
      <div><h4>📋 Resumen y mentalidad</h4><p>A la izquierda ves el <b>RESUMEN</b> del partido con goles, tarjetas, subidas de mentalidad y minutos (como si durara 90').</p></div>
    </div>` },

  { t: 'Controles y consejos', ic: '🎮', cls: 'wide', body: () => `
    <div class="t-two"><div><h4>Controles</h4><ul class="t-list">
      <li>🖱️ <b>Arrastrar</b> un jugador hacia atrás y soltar = tirar.</li>
      <li>🖱️ <b>Clic derecho</b> = cancelar el tiro.</li>
      <li>📱 <b>Móvil</b>: toca con un <b>segundo dedo</b> mientras apuntas para cancelar y elegir otro jugador. <b>Pellizca</b> con dos dedos para acercar/alejar el campo (y arrastra para moverlo). Si no estás en pantalla completa, sale un icono azul ⛶ para volver.</li>
      <li>⌨️ ${KEYS('ESPACIO')} / clic = parar la flecha en penaltis.</li>
      <li>🛒 <b>TIENDA</b>: compra en mitad del partido (precio doble).</li>
      <li>🎡 <b>RULETA</b>: apuesta $1–$5 en tu turno por premios.</li>
      <li>⌂ <b>MENÚ</b>: vuelve al menú principal cuando quieras.</li>
    </ul></div><div><h4>Consejos</h4><ul class="t-list">
      <li>👁️ Sube la <b>visión</b> para ver los rebotes antes de tirar.</li>
      <li>🎯 La <b>precisión</b> evita desvíos; la potencia no sirve de nada sin ella.</li>
      <li>🧤 Un buen portero y la <b>Portería blindada</b> salvan partidos.</li>
      <li>💰 Gasta pronto en mejoras: se acumulan en toda la partida.</li>
      <li>🔥 Marca primero: la mentalidad del equipo sube.</li>
    </ul></div></div><button class="btn big" data-a="closeHelp">¡A JUGAR! ⚽</button>` },
];

/* ---------- navegación ---------- */
function tutRender() {
  const root = $('#help'); if (!root) return;
  if (TUT.stop) { TUT.stop(); TUT.stop = null; }
  const s = TSTEPS[TUT.i], N = TSTEPS.length;
  const bodyHTML = '<div class="tut-in">' + s.body().replace('{N}', N) + '</div>';
  root.innerHTML = `<div class="tut">
    <div class="tut-head"><span class="tut-ic">${s.ic}</span><h2>${s.t}</h2><span class="tut-n">${TUT.i + 1} / ${N}</span><button class="tut-x" data-a="closeHelp" title="Cerrar">✕</button></div>
    <div class="tut-main ${s.fld || s.pen ? 'split' : s.cls || ''}">
      ${s.fld || s.pen ? `<div class="tut-vis" id="tutVis"></div><div class="tut-txt">${bodyHTML}</div>` : `<div class="tut-txt full">${bodyHTML}</div>`}
    </div>
    <div class="tut-foot"><button class="btn ghost" data-a="tutprev" ${TUT.i === 0 ? 'disabled' : ''}>◀ ATRÁS</button>
      <div class="tut-dots">${TSTEPS.map((_, i) => `<button class="${i === TUT.i ? 'on' : i < TUT.i ? 'done' : ''}" data-a="tutgo" data-i="${i}" title="${TSTEPS[i].t}"></button>`).join('')}</div>
      ${TUT.i === N - 1 ? `<button class="btn" data-a="closeHelp">TERMINAR ✓</button>` : `<button class="btn" data-a="tutnext">SIGUIENTE ▶</button>`}</div></div>`;
  tutFit();
  const vis = $('#tutVis');
  if (s.fld === 'stats') {
    const mkCfg = () => ({ caps: [{ team: 0, role: 'DEL', x: 300, y: 320, st: { ...TUT.st } }, { team: 1, role: 'POR', x: 940, y: 320 }], ball: [560, 330], gw: 260, hint: 'Cambia las barras de la derecha y dispara: mira el abanico, la fuerza y el alcance.' });
    const f = tutField(vis, mkCfg()); TUT.fld = f; TUT.stop = f.stop;
    const upd = () => {
      const i = capInfo({ role: 'DEL', stats: { ...TUT.st, MEN: 5 }, abs: [], stars: 1 });
      const r = $('#tRO'); if (r) r.innerHTML = `<div>💥 Velocidad máx.<b>${i.vmax}</b></div><div>⚖️ Masa<b>${i.mass}</b></div><div>🎯 Desvío<b>±${i.dev}°</b></div><div>👁️ Ves el<b>${i.vis}%</b> del recorrido</div>`;
    };
    root.querySelectorAll('.t-sl input').forEach(inp => inp.oninput = () => { TUT.st[inp.dataset.k] = +inp.value; $('#o' + inp.dataset.k).textContent = inp.value; upd(); f.rebuild(mkCfg()); });
    upd();
  } else if (s.fld) {
    const cfg = JSON.parse(JSON.stringify(s.fld)); if (s.zone) cfg.zone = [0, 125, 165, 390];
    const f = tutField(vis, cfg); TUT.fld = f; TUT.stop = f.stop;
  } else if (s.pen) { const p = tutPen(vis); TUT.stop = p.stop; }
}
Object.assign(ACTIONS, {
  help() { TUT.i = 0; $('#help').classList.remove('hidden'); document.body.classList.add('helpopen'); tutRender(); },
  closeHelp() { if (TUT.stop) { TUT.stop(); TUT.stop = null; } $('#help').classList.add('hidden'); document.body.classList.remove('helpopen'); },
  tutnext() { if (TUT.i < TSTEPS.length - 1) { TUT.i++; tutRender(); } },
  tutprev() { if (TUT.i > 0) { TUT.i--; tutRender(); } },
  tutgo(el) { TUT.i = +el.dataset.i; tutRender(); },
  tutreset() { if (TUT.fld && TUT.fld.reset) TUT.fld.reset(); },
});
document.addEventListener('keydown', e => {
  const h = $('#help'); if (!h || h.classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') ACTIONS.tutnext(); else if (e.key === 'ArrowLeft') ACTIONS.tutprev(); else if (e.key === 'Escape') ACTIONS.closeHelp();
});

/* encoge el contenido de texto hasta que quepa sin scroll */
function tutFit() {
  const box = document.querySelector('.tut-txt'), inn = box && box.firstElementChild; if (!box || !inn) return;
  inn.style.zoom = 1; let z = 1;
  while (box.scrollHeight > box.clientHeight + 1 && z > 0.45) { z -= 0.04; inn.style.zoom = z.toFixed(2); }
}
window.addEventListener('resize', () => { const h = $('#help'); if (h && !h.classList.contains('hidden')) tutFit(); });
