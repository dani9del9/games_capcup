/* Pantalla completa en móviles: pide permiso con un aviso (el navegador solo la permite tras un toque del usuario) */
(function () {
  const de = document.documentElement;
  const reqFS = de.requestFullscreen || de.webkitRequestFullscreen || de.msRequestFullscreen;
  const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) || window.navigator.standalone === true;
  const mobile = () => window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 900;

  /* icono azul fijo para volver a pantalla completa mientras no se esté en ella (solo móvil) */
  function addIcon() {
    const st = document.createElement('style');
    st.textContent = '#fsbtn{position:fixed;left:8px;top:8px;z-index:99998;width:40px;height:40px;border-radius:50%;border:2px solid #fff;background:linear-gradient(#4fc3ff,#1677e6);color:#fff;font:900 22px/1 "Segoe UI",Arial;display:none;align-items:center;justify-content:center;box-shadow:0 3px 10px #0008;padding:0;opacity:.92;touch-action:manipulation}#fsbtn.on{display:flex}';
    document.head.appendChild(st);
    const b = document.createElement('button'); b.id = 'fsbtn'; b.type = 'button'; b.title = 'Pantalla completa'; b.textContent = '⛶';
    b.onclick = () => {
      if (reqFS) { const p = reqFS.call(de, { navigationUI: 'hide' }); const lk = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nada */ } }; if (p && p.then) p.then(lk, () => {}); else lk(); }
      else { const a = document.getElementById('fsask'); if (!a) { try { sessionStorage.removeItem('cap_fs_no'); } catch (e) { /* nada */ } mount(); } }
    };
    const upd = () => {   // visible solo fuera de pantalla completa; en partida baja un poco para no tapar el dinero
      b.classList.toggle('on', !isFS() && !standalone());
      b.style.top = document.getElementById('hud-money') ? '52px' : '8px';
    };
    const mountB = () => { document.body.appendChild(b); upd(); };
    if (document.body) mountB(); else document.addEventListener('DOMContentLoaded', mountB);
    document.addEventListener('fullscreenchange', upd); document.addEventListener('webkitfullscreenchange', upd);
    setInterval(upd, 700);
  }
  let no = false; try { no = sessionStorage.getItem('cap_fs_no') === '1'; } catch (e) { /* nada */ }
  if (!mobile() || standalone()) return;
  addIcon();
  const skipAsk = isFS() || no;
  const css = document.createElement('style');
  css.textContent = '#fsask{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(4,8,16,.88);font-family:"Segoe UI",Arial,sans-serif}' +
    '#fsask .b{background:linear-gradient(#16233a,#0c1524);border:2px solid #7df0ff;border-radius:18px;padding:18px 22px;max-width:86vw;text-align:center;color:#fff;box-shadow:0 10px 40px #000a}' +
    '#fsask h2{margin:0 0 6px;font-size:clamp(20px,5vh,30px)}#fsask p{margin:0 0 14px;font-size:clamp(14px,3.6vh,20px);color:#cfe}' +
    '#fsask button{display:block;width:100%;margin:8px 0 0;padding:12px 16px;border-radius:14px;border:0;font:800 clamp(16px,4.2vh,24px) "Segoe UI",Arial;cursor:pointer}' +
    '#fsask .go{background:linear-gradient(#7df0ff,#2aa9ff);color:#012}#fsask .no{background:transparent;color:#9ab;border:1px solid #456}';
  document.head.appendChild(css);
  const ask = document.createElement('div'); ask.id = 'fsask';
  const canFS = !!reqFS;
  ask.innerHTML = '<div class="b"><h2>⛶ Pantalla completa</h2>' + (canFS
    ? '<p>CAP CUP se juega mejor a pantalla completa. ¿La activamos?</p><button class="go" id="fsgo">⛶ PANTALLA COMPLETA</button>'
    : '<p>Para jugar a pantalla completa: pulsa Compartir y elige «Añadir a pantalla de inicio»; luego abre CAP CUP desde ese icono.</p>') +
    '<button class="no" id="fsno">Ahora no</button></div>';
  const close = remember => { ask.remove(); if (remember) { try { sessionStorage.setItem('cap_fs_no', '1'); } catch (e) { /* nada */ } } };
  const mount = () => { if (!document.body.contains(ask)) document.body.appendChild(ask);
    const go = ask.querySelector('#fsgo'), nb = ask.querySelector('#fsno');
    if (go) go.onclick = () => {
      const p = reqFS.call(de, { navigationUI: 'hide' });
      const after = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nada */ } close(false); setTimeout(() => window.dispatchEvent(new Event('resize')), 250); };
      if (p && p.then) p.then(after, () => close(true)); else after();
    };
    nb.onclick = () => close(true);
  };
  if (!skipAsk) { if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount); }
  document.addEventListener('fullscreenchange', () => setTimeout(() => window.dispatchEvent(new Event('resize')), 250));
})();
