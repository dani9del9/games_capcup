/* Idiomas: español (original), English, Galego. Traduce el DOM, los textos del canvas y los avisos.
   Los textos del juego están escritos en español; los diccionarios (lang-en.js / lang-gl.js) usan esas frases como clave. */
var LANG = 'es';
try { LANG = localStorage.getItem('capLang') || 'es'; } catch (e) { /* sin almacenamiento */ }
if (!/^(es|en|gl)$/.test(LANG)) LANG = 'es';
(function () {
  const COMP = {}, CACHE = { en: new Map(), gl: new Map() };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile(l) {
    if (COMP[l]) return COMP[l];
    const d = (window.LANGDATA && LANGDATA[l]) || { m: {}, x: [] };
    const ex = new Set(d.x), keys = Object.keys(d.m).filter(k => !ex.has(k)).sort((a, b) => b.length - a.length);
    const L = '\\p{L}';
    const parts = keys.map(k => (/^\p{L}/u.test(k) ? '(?<!' + L + ')' : '') + esc(k) + (/\p{L}$/u.test(k) ? '(?!' + L + ')' : ''));
    COMP[l] = { m: d.m, ex, re: parts.length ? new RegExp(parts.join('|'), 'gu') : null };
    return COMP[l];
  }
  function tr(s) {
    if (LANG === 'es' || typeof s !== 'string' || s.length < 2 && !/\S/.test(s)) return s;
    const cache = CACHE[LANG], hit = cache.get(s);
    if (hit !== undefined) return hit;
    const c = compile(LANG);
    let out = s;
    const t = s.trim();
    if (c.ex.has(t) || (c.m[t] !== undefined && t.length <= 2)) out = s.replace(t, c.m[t]);
    else if (c.re) out = s.replace(c.re, k => c.m[k] !== undefined ? c.m[k] : k);
    if (cache.size > 6000) cache.clear();
    cache.set(s, out);
    return out;
  }
  window.tr = tr;

  const ATTRS = ['title', 'placeholder', 'aria-label'];
  const skip = n => { const p = n.parentNode; return !p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || (p.closest && p.closest('.nolang')); };
  function doText(n) {
    if (skip(n)) return;
    const src = (n.__t !== undefined && n.data === n.__t) ? n.__o : n.data;
    n.__o = src;
    const t = LANG === 'es' ? src : tr(src);
    n.__t = t;
    if (n.data !== t) n.data = t;
  }
  function doAttrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      const cur = el.getAttribute(a), k = '__a_' + a, kt = '__at_' + a;
      const src = (el[kt] !== undefined && cur === el[kt]) ? el[k] : cur;
      el[k] = src;
      const t = LANG === 'es' ? src : tr(src);
      el[kt] = t;
      if (cur !== t) el.setAttribute(a, t);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    if (root.closest && root.closest('.nolang')) return;
    doAttrs(root);
    const w = document.createTreeWalker(root, 5);   // texto + elementos
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  let busy = false;
  const mo = new MutationObserver(muts => {
    if (busy) return;
    busy = true;
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
    mo.takeRecords();
    busy = false;
  });
  function start() {
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    apply();
  }
  function apply() {
    document.documentElement.lang = LANG;
    if (document.body) walk(document.body);
    if (!document.__ot) document.__ot = document.title;
    document.title = LANG === 'es' ? document.__ot : tr(document.__ot);
  }
  window.setLang = function (l) {
    if (!/^(es|en|gl)$/.test(l)) return;
    LANG = l;
    try { localStorage.setItem('capLang', l); } catch (e) { /* nada */ }
    apply();
  };

  /* canvas */
  const P = CanvasRenderingContext2D.prototype;
  ['fillText', 'strokeText'].forEach(f => { const o = P[f]; P[f] = function (t, x, y, w) { return o.call(this, LANG === 'es' ? t : tr(String(t)), x, y, w); }; });
  const mt = P.measureText; P.measureText = function (t) { return mt.call(this, LANG === 'es' ? t : tr(String(t))); };
  /* avisos del navegador */
  ['alert', 'confirm', 'prompt'].forEach(f => { const o = window[f]; if (o) window[f] = function (m, d) { return o.call(window, tr(String(m)), d); }; });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
