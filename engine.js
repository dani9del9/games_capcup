'use strict';
/* =====================================================================
   JUGADORES — motor (datos, física y IA). Sin DOM: se puede probar en Node.
   ===================================================================== */

/* desviación (sigma, rad): con PRE 12 = 0; con PRE 1 el balón puede desviarse hasta 15º (2 sigma) */
const POISON_DEV = Math.PI / 4;   // envenenado: sin puntería (±90° de error con 2σ)
const devFor = pre => Math.max(0, (12 - Math.min(12, pre)) / 11 * 15 / 2) * Math.PI / 180;
const FIELD = { W: 1000, H: 640, MX: 112, MY: 100, pocket: 70, gw: 190, post: 6, ballR: 13, capR: 26 };

/* ---------- selecciones (banderas en SVG compacto) ---------- */
const V3 = (a, b, c) => `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
const H3 = (a, b, c) => `<rect width="30" height="7" fill="${a}"/><rect y="7" width="30" height="6" fill="${b}"/><rect y="13" width="30" height="7" fill="${c}"/>`;
const ST = (x, y, r, f) => `<polygon fill="${f}" points="${[0,1,2,3,4].map(k => { const a = -Math.PI / 2 + k * 2 * Math.PI / 5, b = a + Math.PI / 5; return (x + Math.cos(a) * r).toFixed(2) + ',' + (y + Math.sin(a) * r).toFixed(2) + ' ' + (x + Math.cos(b) * r * 0.4).toFixed(2) + ',' + (y + Math.sin(b) * r * 0.4).toFixed(2); }).join(' ')}"/>`;
const COUNTRIES = {
  ESP: { n: 'España', c1: '#d62828', c2: '#ffc300', bias: { POT: 1, PES: 1, PRE: 2, VIS: 1 }, best: true, tag: 'La mejor plantilla del mundo', svg: '<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>' },
  FRA: { n: 'Francia', c1: '#1d46c4', c2: '#ffffff', bias: { POT: 1, PRE: 1, VIS: 1, PES: 1 }, tag: 'Pegada', svg: V3('#0055a4', '#fff', '#ef4135') },
  ITA: { n: 'Italia', c1: '#1c6fe6', c2: '#ffffff', bias: { PES: 2, PRE: 1, POT: 1, VIS: 1 }, tag: 'Catenaccio', svg: V3('#009246', '#fff', '#ce2b37') },
  ALE: { n: 'Alemania', c1: '#f1f1f1', c2: '#111111', bias: { POT: 1, PRE: 1, PES: 1, VIS: 1 }, tag: 'Máquina', svg: H3('#000', '#dd0000', '#ffce00') },
  BRA: { n: 'Brasil', c1: '#ffd400', c2: '#0a8a3c', bias: { VIS: 2, POT: 1, PRE: 1, PES: 1 }, tag: 'Jogo bonito', svg: '<rect width="30" height="20" fill="#009c3b"/><path d="M15 2 27 10 15 18 3 10Z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/>' },
  ARG: { n: 'Argentina', c1: '#7ec8ff', c2: '#ffffff', bias: { POT: 1, VIS: 1, PRE: 1, PES: 1 }, tag: 'Garra', svg: H3('#74acdf', '#fff', '#74acdf') + '<circle cx="15" cy="10" r="2" fill="#f6b40e"/>' },
  ING: { n: 'Inglaterra', c1: '#f4f4f4', c2: '#c8102e', bias: { PES: 1, POT: 1, VIS: 1, PRE: 1 }, tag: 'Fútbol directo', svg: '<rect width="30" height="20" fill="#fff"/><rect x="13" width="4" height="20" fill="#c8102e"/><rect y="8" width="30" height="4" fill="#c8102e"/>' },
  POR: { n: 'Portugal', c1: '#b3121f', c2: '#0a7a3d', bias: { POT: 1, PRE: 1, VIS: 1, PES: 1 }, tag: 'Estrella', svg: '<rect width="30" height="20" fill="#d6001c"/><rect width="12" height="20" fill="#006600"/><circle cx="12" cy="10" r="3.6" fill="#ffd800"/>' },
  PBA: { n: 'Países Bajos', c1: '#ff7a00', c2: '#21468b', bias: { PRE: 1, VIS: 1, POT: 1, PES: 1 }, tag: 'Fútbol total', svg: H3('#ae1c28', '#fff', '#21468b') },
  BEL: { n: 'Bélgica', c1: '#d71920', c2: '#111111', bias: { PRE: 1, PES: 1, VIS: 1, POT: 1 }, tag: 'Generación dorada', svg: V3('#111', '#fdda24', '#ef3340') },
  JPN: { n: 'Japón', c1: '#1c3a8a', c2: '#ffffff', bias: { PRE: 2, VIS: 1 }, tag: 'Samuráis', svg: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>' },
  MEX: { n: 'México', c1: '#0a7a3d', c2: '#ffffff', bias: { VIS: 1, POT: 1, PES: 1 }, tag: 'Tri', svg: V3('#006847', '#fff', '#ce1126') + '<circle cx="15" cy="10" r="2" fill="#8a5a2b"/>' },
  CRO: { n: 'Croacia', c1: '#e31b23', c2: '#ffffff', bias: { PES: 1, PRE: 1, VIS: 1, POT: 1 }, tag: 'Cuadrados', svg: H3('#f00', '#fff', '#171796') + '<defs><clipPath id="croClip"><path d="M9.6 6.6H20.4V11.4Q20.4 15.9 15 18.2Q9.6 15.9 9.6 11.4Z"/></clipPath></defs><path d="M9.6 6.6H20.4V11.4Q20.4 15.9 15 18.2Q9.6 15.9 9.6 11.4Z" fill="#fff" stroke="#fff" stroke-width="1"/><g clip-path="url(#croClip)"><rect x="9.6" y="6.6" width="2.16" height="2.3" fill="#e31b23"/><rect x="11.76" y="6.6" width="2.16" height="2.3" fill="#fff"/><rect x="13.92" y="6.6" width="2.16" height="2.3" fill="#e31b23"/><rect x="16.08" y="6.6" width="2.16" height="2.3" fill="#fff"/><rect x="18.24" y="6.6" width="2.16" height="2.3" fill="#e31b23"/><rect x="9.6" y="8.9" width="2.16" height="2.3" fill="#fff"/><rect x="11.76" y="8.9" width="2.16" height="2.3" fill="#e31b23"/><rect x="13.92" y="8.9" width="2.16" height="2.3" fill="#fff"/><rect x="16.08" y="8.9" width="2.16" height="2.3" fill="#e31b23"/><rect x="18.24" y="8.9" width="2.16" height="2.3" fill="#fff"/><rect x="9.6" y="11.2" width="2.16" height="2.3" fill="#e31b23"/><rect x="11.76" y="11.2" width="2.16" height="2.3" fill="#fff"/><rect x="13.92" y="11.2" width="2.16" height="2.3" fill="#e31b23"/><rect x="16.08" y="11.2" width="2.16" height="2.3" fill="#fff"/><rect x="18.24" y="11.2" width="2.16" height="2.3" fill="#e31b23"/><rect x="9.6" y="13.5" width="2.16" height="2.3" fill="#fff"/><rect x="11.76" y="13.5" width="2.16" height="2.3" fill="#e31b23"/><rect x="13.92" y="13.5" width="2.16" height="2.3" fill="#fff"/><rect x="16.08" y="13.5" width="2.16" height="2.3" fill="#e31b23"/><rect x="18.24" y="13.5" width="2.16" height="2.3" fill="#fff"/><rect x="9.6" y="15.8" width="2.16" height="2.3" fill="#e31b23"/><rect x="11.76" y="15.8" width="2.16" height="2.3" fill="#fff"/><rect x="13.92" y="15.8" width="2.16" height="2.3" fill="#e31b23"/><rect x="16.08" y="15.8" width="2.16" height="2.3" fill="#fff"/><rect x="18.24" y="15.8" width="2.16" height="2.3" fill="#e31b23"/></g><path d="M9.6 6.6H20.4V11.4Q20.4 15.9 15 18.2Q9.6 15.9 9.6 11.4Z" fill="none" stroke="#d8dbe6" stroke-width=".4"/><path d="M9.7 3.2H11.66V4.6Q11.66 5.8 10.68 5.8Q9.7 5.8 9.7 4.6Z" fill="#e31b23" stroke="#fff" stroke-width=".25"/><path d="M11.86 3.2H13.82V4.6Q13.82 5.8 12.84 5.8Q11.86 5.8 11.86 4.6Z" fill="#fff" stroke="#fff" stroke-width=".25"/><path d="M14.02 3.2H15.98V4.6Q15.98 5.8 15 5.8Q14.02 5.8 14.02 4.6Z" fill="#2b4fd0" stroke="#fff" stroke-width=".25"/><path d="M16.18 3.2H18.14V4.6Q18.14 5.8 17.16 5.8Q16.18 5.8 16.18 4.6Z" fill="#fff" stroke="#fff" stroke-width=".25"/><path d="M18.34 3.2H20.3V4.6Q20.3 5.8 19.32 5.8Q18.34 5.8 18.34 4.6Z" fill="#e31b23" stroke="#fff" stroke-width=".25"/>' },
  SUE: { n: 'Suecia', c1: '#ffcd00', c2: '#006aa7', bias: { PES: 2, PRE: 1 }, tag: 'Muro nórdico', svg: '<rect width="30" height="20" fill="#006aa7"/><rect x="9" width="4" height="20" fill="#fecc00"/><rect y="8" width="30" height="4" fill="#fecc00"/>' },
  COL: { n: 'Colombia', c1: '#ffd100', c2: '#003893', bias: { POT: 1, VIS: 1, PRE: 1 }, tag: 'Cafeteros', svg: '<rect width="30" height="20" fill="#fcd116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#ce1126"/>' },
  USA: { n: 'EE. UU.', c1: '#1b3a7a', c2: '#bf0a30', bias: { POT: 1, PES: 1, VIS: 1 }, tag: 'Stars & Stripes', svg: '<rect width="30" height="20" fill="#fff"/>' + [0, 2, 4, 6, 8, 10, 12].map(i => `<rect y="${i * 20 / 13}" width="30" height="${20 / 13}" fill="#b22234"/>`).join('') + '<rect width="13" height="10.8" fill="#3c3b6e"/>' },
  URU: { n: 'Uruguay', c1: '#7ec8ff', c2: '#ffffff', bias: { PES: 1, POT: 1, PRE: 1, VIS: 1 }, tag: 'Garra charrúa', svg: '<rect width="30" height="20" fill="#fff"/>' + [1, 3, 5, 7].map(i => `<rect y="${i * 20 / 9}" width="30" height="${20 / 9}" fill="#0038a8"/>`).join('') + '<rect width="11" height="11" fill="#fff"/><circle cx="5.5" cy="5.5" r="3" fill="#fcd116"/>' },
  MAR: { n: 'Marruecos', c1: '#c1272d', c2: '#006233', bias: { PRE: 1, PES: 1, POT: 1 }, tag: 'Leones del Atlas', svg: '<rect width="30" height="20" fill="#c1272d"/><path d="M15.00 5.60 L17.82 14.28 L10.43 8.92 L19.57 8.92 L12.18 14.28 L15.00 5.60Z" fill="none" stroke="#006233" stroke-width=".95" stroke-linejoin="miter"/>' },
  COR: { n: 'Corea del Sur', c1: '#ffffff', c2: '#c60c30', bias: { PRE: 2, VIS: 1 }, tag: 'Tigres de Asia', svg: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.8" fill="#cd2e3a"/><path d="M10.2 10a4.8 4.8 0 0 0 9.6 0z" fill="#0047a0"/><path d="M3 3l3 -1 M3.6 4.2l3 -1 M27 17l-3 1 M26.4 15.8l-3 1" stroke="#111" stroke-width="1.2"/>' },
  SUI: { n: 'Suiza', c1: '#d52b1e', c2: '#ffffff', bias: { PES: 1, PRE: 1, VIS: 1 }, tag: 'Reloj suizo', svg: '<rect width="30" height="20" fill="#d52b1e"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>' },
  DIN: { n: 'Dinamarca', c1: '#c8102e', c2: '#ffffff', bias: { PRE: 1, VIS: 1, PES: 1 }, tag: 'Dinamita roja', svg: '<rect width="30" height="20" fill="#c8102e"/><rect x="9" width="3" height="20" fill="#fff"/><rect y="8.5" width="30" height="3" fill="#fff"/>' },
  TUR: { n: 'Turquía', c1: '#e30a17', c2: '#ffffff', bias: { POT: 1, VIS: 1, PRE: 1 }, tag: 'Luna creciente', svg: '<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.4" cy="10" r="4" fill="#e30a17"/><circle cx="17.5" cy="10" r="1.6" fill="#fff"/>' },
  NOR: { n: 'Noruega', c1: '#ba0c2f', c2: '#00205b', bias: { POT: 2, VIS: 1 }, tag: 'Vikingos', svg: '<rect width="30" height="20" fill="#ba0c2f"/><rect x="8" width="5" height="20" fill="#fff"/><rect y="7.5" width="30" height="5" fill="#fff"/><rect x="9.2" width="2.6" height="20" fill="#00205b"/><rect y="8.7" width="30" height="2.6" fill="#00205b"/>' },
  SEN: { n: 'Senegal', c1: '#00853f', c2: '#fdef42', bias: { POT: 1, VIS: 1, PES: 1 }, tag: 'Leones de la Teranga', svg: V3('#00853f', '#fdef42', '#e31b23') + '<path d="M15 6l1.3 3.6h3.7l-3 2.2 1.1 3.6-3.1-2.2-3.1 2.2 1.1-3.6-3-2.2h3.7z" fill="#00853f"/>' },
  POL: { n: 'Polonia', c1: '#ffffff', c2: '#dc143c', bias: { PES: 1, POT: 1 }, tag: 'Águilas blancas', svg: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#dc143c"/>' },
  EGI: { n: 'Egipto', c1: '#c8102e', c2: '#111111', bias: { POT: 1, PRE: 1 }, tag: 'Faraones', svg: H3('#ce1126', '#fff', '#000') + '<circle cx="15" cy="10" r="2" fill="#c09300"/>' },
  NIG: { n: 'Nigeria', c1: '#008751', c2: '#ffffff', bias: { POT: 2 }, tag: 'Águilas Verdes', svg: V3('#008751', '#fff', '#008751') },
  CHI: { n: 'Chile', c1: '#d52b1e', c2: '#0039a6', bias: { VIS: 1, PES: 1 }, tag: 'La Roja', svg: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d52b1e"/><rect width="10" height="10" fill="#0039a6"/><circle cx="5" cy="5" r="1.8" fill="#fff"/>' },
  AUT: { n: 'Austria', c1: '#ed2939', c2: '#ffffff', bias: { PES: 1, POT: 1 }, tag: 'Presión alta', svg: H3('#ed2939', '#fff', '#ed2939') },
  GHA: { n: 'Ghana', c1: '#ffffff', c2: '#ce1126', bias: { POT: 1, VIS: 1 }, tag: 'Estrellas Negras', svg: H3('#ce1126', '#fcd116', '#006b3f') + '<path d="M15 6.5l1.2 3.4h3.6l-2.9 2.1 1.1 3.4-3-2.1-3 2.1 1.1-3.4-2.9-2.1h3.6z" fill="#111"/>' },
  SCO: { n: 'Escocia', c1: '#0a4aa0', c2: '#ffffff', bias: { PES: 1, POT: 1 }, tag: 'Tartan Army', svg: '<rect width="30" height="20" fill="#0065bd"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="3.2"/>' },
  UCR: { n: 'Ucrania', c1: '#ffd700', c2: '#0057b7', bias: { PRE: 1, VIS: 1 }, tag: 'Azul y amarillo', svg: '<rect width="30" height="10" fill="#0057b7"/><rect y="10" width="30" height="10" fill="#ffd700"/>' },
  LRD: { n: 'Leirado', c1: '#2ad4b8', c2: '#1a9c88', bias: { POT: -1, PES: -1, PRE: -1, VIS: -1 }, allStat: 3, men: 10, abs3: 'arana', tag: 'El peor equipo del mundo', svg: '<rect width="30" height="20" fill="#2ad4b8"/>' },
  CMR: { n: 'Camerún', c1: '#00a35a', c2: '#fcd116', bias: { POT: 2 }, tag: 'Leones Indomables', svg: V3('#007a5e', '#ce1126', '#fcd116') + '<path d="M15 6.5l1.2 3.4h3.6l-2.9 2.1 1.1 3.4-3-2.1-3 2.1 1.1-3.4-2.9-2.1h3.6z" fill="#fcd116"/>' },
  PER: { n: 'Perú', c1: '#d91023', c2: '#ffffff', bias: { PRE: 1, PES: 1 }, tag: 'La Blanquirroja', svg: V3('#d91023', '#fff', '#d91023') },
  AUS: { n: 'Australia', c1: '#ffcd00', c2: '#00843d', bias: { PES: 1, VIS: 1 }, tag: 'Socceroos', svg: '<rect width="30" height="20" fill="#00247d"/><path d="M0 0L13 8M13 0L0 8" stroke="#fff" stroke-width="1.6"/><circle cx="21" cy="11" r="1.6" fill="#fff"/><circle cx="24" cy="5" r="1.4" fill="#fff"/><circle cx="24" cy="16" r="1.4" fill="#fff"/><circle cx="18" cy="16" r="1.4" fill="#fff"/>' },
  CHN: { n: 'China', c1: '#e8222a', c2: '#ffde00', bias: { PRE: 1 }, tag: 'El Dragón Rojo', svg: '<rect width="30" height="20" fill="#de2910"/>' + ST(6, 5.5, 3.2, '#ffde00') + ST(11.5, 2.2, 1, '#ffde00') + ST(13.4, 4.4, 1, '#ffde00') + ST(13.4, 7.2, 1, '#ffde00') + ST(11.5, 9.2, 1, '#ffde00') },
  IRL: { n: 'Irlanda', c1: '#169b62', c2: '#ffffff', bias: { POT: 1, PES: 1 }, tag: 'Los Chicos de Verde', svg: V3('#169b62', '#fff', '#ff883e') },
  GRE: { n: 'Grecia', c1: '#0d5eaf', c2: '#ffffff', bias: { PES: 1, PRE: 1 }, tag: 'Campeones de 2004', svg: '<rect width="30" height="20" fill="#0d5eaf"/>' + [1, 3, 5, 7].map(i => `<rect y="${(i * 20 / 9).toFixed(2)}" width="30" height="${(20 / 9).toFixed(2)}" fill="#fff"/>`).join('') + '<rect width="11.1" height="11.1" fill="#0d5eaf"/><rect x="4.45" width="2.2" height="11.1" fill="#fff"/><rect y="4.45" width="11.1" height="2.2" fill="#fff"/>' },
  THA: { n: 'Tailandia', c1: '#2b3a8c', c2: '#e3262e', bias: { VIS: 1, PRE: 1 }, tag: 'Elefantes de Guerra', svg: '<rect width="30" height="20" fill="#a51931"/><rect y="3.33" width="30" height="13.34" fill="#f4f5f8"/><rect y="6.67" width="30" height="6.66" fill="#2d2a4a"/>' },
  CAN: { n: 'Canadá', c1: '#d52b1e', c2: '#ffffff', bias: { PES: 1, POT: 1 }, tag: 'Los Rojos del Norte', svg: '<rect width="30" height="20" fill="#d52b1e"/><rect x="7.5" width="15" height="20" fill="#fff"/><polygon points="15 3.2 16.2 5.6 17.7 4.9 17.2 8.1 19.5 6.8 19.1 8.6 21.4 9 19.5 10.9 20.2 11.7 15.9 12.6 16.1 14.3 15.4 14.3 15.4 16.2 14.6 16.2 14.6 14.3 13.9 14.3 14.1 12.6 9.8 11.7 10.5 10.9 8.6 9 10.9 8.6 10.5 6.8 12.8 8.1 12.3 4.9 13.8 5.6" fill="#d52b1e"/>' },
  CIV: { n: 'Costa de Marfil', c1: '#f77f00', c2: '#009e60', bias: { POT: 1, PES: 1 }, tag: 'Los Elefantes', svg: V3('#f77f00', '#fff', '#009e60') },
  HUN: { n: 'Hungría', c1: '#ce2939', c2: '#477050', bias: { PRE: 1, VIS: 1 }, tag: 'Los Magiares', svg: H3('#ce2939', '#fff', '#477050') },
  SMR: { n: 'San Marino', c1: '#5eb6e4', c2: '#ffffff', bias: { MEN: 1 }, tag: 'La Serenísima', svg: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#5eb6e4"/><circle cx="15" cy="10" r="3" fill="#f2c200"/><circle cx="15" cy="10" r="1.6" fill="#2a8a3c"/>' },
  PAR: { n: 'Paraguay', c1: '#d52b1e', c2: '#ffffff', bias: { PES: 1, PRE: 1 }, tag: 'La Albirroja', svg: H3('#d52b1e', '#fff', '#0038a8') + '<circle cx="15" cy="10" r="2.2" fill="none" stroke="#2a8a3c" stroke-width=".6"/>' },
};
/* nivel real de cada equipo (ránking FIFA / fuerza de los clubes): +3 élite mundial, +2 gran equipo, +1 muy bueno, 0 resto. Se suma a TODAS las estadísticas */
const TIER = { ESP: 1, ARG: 3, FRA: 3, ING: 2, BRA: 2, POR: 2, PBA: 2, ALE: 2, BEL: 1, ITA: 1, CRO: 1, MAR: 1, COL: 1, URU: 1,
  SUI: 0, JPN: 0, SEN: 0, MEX: 0, USA: 0, DIN: 0, NOR: 0, AUT: 0, COR: 0, TUR: 0, UCR: 0, POL: 0, SUE: 0, EGI: 0, NIG: 0, CMR: 0, GHA: 0, CHI: 0, AUS: 0, PER: 0, SCO: 0, CHN: -1, IRL: 0, GRE: 0, THA: -1, CAN: 0, CIV: 0, HUN: 0, PAR: 0, SMR: -2,
  RMA: 3, MCI: 3, PSG: 3, BAR: 1, BAY: 2, LIV: 2, INT: 2, ARS: 2, LEV: 1, ATM: 1, NAP: 1, JUV: 1, MIL: 1, ATA: 1,
  BVB: 0, CHE: 0, RBL: 0, MUN: 0, TOT: 0, ROM: 0, MON: 0, SEV: 0, OLM: 0, LYO: 0, VAL: 0, CEL: 0, LIL: 0, NIC: 0, SGE: 0, VFB: 0 };
const CODES = Object.keys(COUNTRIES);
const CLUB_CODES = [];
const ALL_CODES = CODES;
const LEAGUES = [
  { k: 'SEL', n: 'Selecciones', codes: CODES },
];
const flagSVG = (code, cls = '') => `<svg class="flag ${cls}" viewBox="0 0 30 20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${COUNTRIES[code].svg}</svg>`;
const flagURI = code => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="300" height="200" preserveAspectRatio="none">${COUNTRIES[code].svg}</svg>`);

/* ---------- roles, estadísticas, habilidades, reliquias ---------- */
const STATS = {
  POT: { n: 'Potencia',  icon: '💥', d: 'Velocidad máxima del tiro.' },
  PES: { n: 'Peso',      icon: '⚖️', d: 'Masa del jugador: empuja más y lo empujan menos.' },
  PRE: { n: 'Precisión', icon: '🎯', d: 'Si es baja, el balón se desvía al golpearlo. También alarga la guía de apuntado.' },
  VIS: { n: 'Visión',    icon: '👁️', d: 'Visión de juego: cuánto de la trayectoria ves al apuntar. Con 10 ves TODO el recorrido del balón; con 1, nada.' },
  MEN: { n: 'Mentalidad', icon: '🔥', d: 'Con mentalidad alta empieza el partido mejorado: hasta +0.5 con 8, siempre +1 con 11 y siempre +2 con 12. Con menos de 2 puede perder hasta 0.5.' },
};
const STAT_KEYS = Object.keys(STATS);
const ROLES = [
  { k: 'POR', n: 'Portero',   base: { POT: 3, PES: 5, PRE: 3, VIS: 1, MEN: 3 }, rk: 1.15 },
  { k: 'DEF', n: 'Defensa',   base: { POT: 4, PES: 5, PRE: 3, VIS: 1, MEN: 4 }, rk: 1 },
  { k: 'MED', n: 'Mediocentro', base: { POT: 4, PES: 3, PRE: 4, VIS: 2, MEN: 4 }, rk: 1 },
  { k: 'EXT', n: 'Extremo', base: { POT: 4, PES: 2, PRE: 3, VIS: 4, MEN: 3 }, rk: 0.96 },
  { k: 'DEL', n: 'Delantero', base: { POT: 5, PES: 2, PRE: 4, VIS: 3, MEN: 4 }, rk: 1 },
];
const STAR_COST = [0, 8, 14, 22, 32];
const STAR_BONUS = 1;                 // cada estrella extra suma +1 a todas las estadísticas (permanente)
const abSlots = stars => stars >= 5 ? 3 : stars >= 3 ? 2 : 1;   // más estrellas = más habilidades
const SHIRT = { POR: 1, DEF: 4, MED: 8, EXT: 7, DEL: 9 };
const ABILITIES = {
  capitan:     { n: 'Gran Capitán', icon: '🎖️', price: 12, d: 'El equipo obtiene +2 en todas las estadísticas durante las 3 primeras rondas, y +2 más por cada copia.' },
  canon:       { n: 'Cañonazo',     icon: '🚀', price: 9, d: 'Los tiros salen un 40% más rápidos.' },
  bulldozer:   { n: 'Bulldozer',    icon: '🚜', price: 9, d: 'Masa ×1.7: desplaza con facilidad a los demás.' },
  iman:        { n: 'Imán',         icon: '🧲', price: 9, d: 'Atrae el balón cuando está cerca.' },
  gigante:     { n: 'Gigante',      icon: '🗿', price: 8, d: 'Tamaño y masa ×1.3.' },
  resbaladiza: { n: 'Resbaladiza',  icon: '🧊', price: 8, d: 'Se desliza mucho más lejos tras el golpe.' },
  instinto:    { n: 'Instinto goleador', icon: '🎯', price: 10, d: 'Cuando un compañero le hace un pase, dispara directo a portería. 1 copia: poca fuerza y la dirección puede errar un 20%. 2: fuerza media y error del 10%. 3: máxima fuerza y sin errores.' },
  control:     { n: 'Control de balón', icon: '🛑', price: 8, d: 'Para el balón en seco cuando le llega (de un pase o de un tiro rival). 1 copia: el jugador se mueve hacia donde lo empuja el golpe. 2 copias: se mueve con la mitad de fuerza. 3 copias: el jugador no se mueve.' },
  motiv:       { n: 'Motivado',     icon: '✨', price: 8, d: 'En cada turno, una estadística al azar (potencia, peso o precisión) sube al máximo (12) y al acabar la jugada vuelve a su valor. 2 copias: dos estadísticas a la vez. 3 copias: las tres.' },
  piedra:      { n: 'Piedra',       icon: '⚪', price: 9, d: 'Resiste los golpes del balón y de otros jugadores: con 1 copia se mueve poco, con 2 muy poco y con 3 no se mueve. Solo se desplaza cuando tira.' },
  hierro:      { n: 'Salud de hierro', icon: '🩹', price: 6, d: 'Inmune al veneno y a la congelación; si ya está afectado, se recupera.' },
  goat:        { n: 'GOAT',         icon: '🐐', price: 14, d: 'Un 10% de probabilidad de jugar el partido con todo a 12. Con 2 copias, 30%; con 3, 50% y el balón siempre va a portería.' },
  arana:       { n: 'Araña',        icon: '🕷️', price: 9, d: 'Durante la jugada del rival se desplaza sola hacia el balón, siempre que esté a menos de 3 veces su tamaño.' },
};
const abCount = (abs, k) => { let n = 0; for (const x of abs || []) if (x === k) n++; return n; };   // las habilidades se pueden repetir hasta 3 veces: cada copia mejora el efecto
const AB_MAX = 3;
const PERKS = {
  reflejos:  { n: 'Reflejos',        icon: '⚡', price: 13, d: 'Puedes usar tus comodines también durante el turno del rival, justo antes de que tire.' },
  hinchada:  { n: 'Hinchada',        icon: '📣', price: 9,  d: '+12% de potencia en todos los jugadores.' },
  entrenador:{ n: 'Entrenador',      icon: '📋', price: 8,  d: '+2 turnos en cada partido.' },
  manoplas:  { n: 'Portero goleador', icon: '🧤', price: 11, d: 'Los goles marcados por el portero valen doble.' },
  vaina:     { n: 'Seguro de autogoles', icon: '🛡️', price: 9, d: 'Los goles en propia puerta no cuentan durante los 5 primeros turnos de cada partido.' },
  regalo:    { n: 'Regalo del rival', icon: '🎁', price: 9, d: 'Los autogoles del rival valen doble.' },
  golazo:    { n: 'Golazo',          icon: '🌠', price: 10, d: 'Los goles marcados desde el propio campo valen doble.' },
  roja:      { n: 'Tarjeta roja',    icon: '🟥', price: 16, d: 'El rival empieza con un jugador menos (nunca el portero). Dura 2 partidos.' },
  botas:     { n: 'Botas de oro',    icon: '👟', price: 7,  d: '+$2 por cada gol marcado.' },
  arco:      { n: 'Portería ancha',  icon: '🥅', price: 9,  d: 'La portería rival es un 25% más ancha.' },
  guantes:   { n: 'Guantes',         icon: '🧤', price: 6,  d: 'El portero atrae el balón.' },
  prima:     { n: 'Prima de fichaje', icon: '💶', price: 8,  d: '+$4 adicionales por cada victoria.' },
  goleada:   { n: 'Prima por goleada', icon: '📈', price: 9, d: 'Al ganar, +$1 por cada gol de diferencia.' },
  multiporteros: { n: 'Multiportero', icon: '🧤', price: 9, d: 'El jugador más cercano a la portería propia crece un 30%; se recalcula cada turno.' },
  sangre:    { n: 'Sangre fría', icon: '🧊', price: 12, d: 'Todos los penaltis propios son gol, aunque la barra se detenga fuera de la zona verde.' },
  aforo:     { n: 'Aforo completo', icon: '🏟', price: 22, use: true, d: 'Multiplica tu dinero por 2 al comprarla. Se activa al instante y no ocupa espacio de reliquia.' },
  junta:     { n: 'Junta de accionistas', icon: '💼', price: 14, use: true, d: 'Aporta $50 al comprarla. Se activa al instante y no ocupa espacio de reliquia.' },
  freestyler:{ n: 'Freestyler', icon: '🕺', price: 9, d: 'Si un gol llega tras más de 4 rebotes, ganas $1 por cada rebote extra. Funciona siempre.' },
  bolsillo:  { n: 'Bolsillo extra', icon: '🎒', price: 7, use: true, d: '+1 espacio para comodines. Se consume al comprarla y no ocupa espacio de reliquia.' },
  rebajas:   { n: 'Rebajas', icon: '🏷️', price: 8, d: 'Todo en la tienda cuesta la mitad: reliquias, habilidades, mejoras, comodines y estrellas.' },
  doble:     { n: 'Doble paga', icon: '💸', price: 16, d: 'Ganas el doble de dinero por partido.' },
  mecenas:   { n: 'Mecenas',         icon: '🏦', price: 8,  d: '+$1 por cada estrella de la plantilla al ganar.' },
  visor:     { n: 'Visor láser',     icon: '🔭', price: 7,  d: 'Ves un 40% más de la trayectoria al apuntar.' },
  pretemp:   { n: 'Pretemporada',    icon: '🏋️', price: 11, d: 'Tras cada victoria, una estadística al azar sube +1.' },
  guardian:  { n: 'Portero guardián', icon: '🧤', price: 14, d: 'El portero regresa solo a su posición inicial al terminar cada jugada, durante todo el partido.' },
  ventaja:   { n: 'Ventaja de oro',  icon: '🏆', price: 18, d: 'El partido empieza 1-0 a favor. Dura 2 partidos y después se destruye.' },
  teatrero:  { n: 'Teatrero', icon: '🎭', price: 9, d: 'Si un jugador rival golpea a uno de los tuyos antes de tocar el balón, se señala falta a tu favor.' },
  brazalete: { n: 'Brazalete de capitán', icon: '🎖️', price: 12, d: 'El capitán tiene siempre mentalidad 12.' },
};
const ITEMS = {
  doble:   { n: 'Jugada doble',  icon: '✌️', price: 6, d: 'Tiras dos veces seguidas.' },
  triple:  { n: 'Jugada triple', icon: '🔱', price: 10, d: 'Tiras tres veces seguidas.' },
  bloqueo: { n: 'Portería blindada', icon: '🛡️', price: 6, d: 'La portería queda bloqueada durante la próxima jugada del rival.' },
  silbato: { n: 'Silbato',       icon: '🔔', price: 5, d: 'El rival pierde el próximo turno.' },
  var:     { n: 'VAR',           icon: '📺', price: 4, d: 'Anula el efecto del campo el resto del partido.' },
};
const FIELDS = {
  normal:  { n: 'Césped normal',  icon: '🏟️', d: 'Condiciones estándar.' },
  hielo:   { n: 'Campo de hielo', icon: '🧊', d: 'Superficie helada: jugadores y balón deslizan mucho más.' },
  barro:   { n: 'Campo de barro', icon: '🟤', d: 'Todo frena antes y los charcos detienen casi por completo.' },
  pinball: { n: 'Pinball',        icon: '🎰', d: 'Bumpers que lanzan a jugadores y balones.' },
  tilt:    { n: 'Campo inclinado', icon: '🌊', d: 'El campo se inclina y cambia de sentido cada turno.' },
  iman:    { n: 'Agujero central', icon: '🌀', d: 'Una fuerza gravitatoria atrae todo hacia el centro.' },
  espacio: { n: 'Espacio', icon: '🪐', d: 'Gravedad inversa: todo es repelido desde el centro y flota.' },
  playa:   { n: 'Playa', icon: '🏖️', d: 'Arena que frena un poco, con sombrillas que tapan lo que haya debajo. Cada 3 jugadas una gaviota se lleva el balón al centro.' },
  jurasico: { n: 'Jurásico', icon: '🦖', d: 'Selva prehistórica: cada 2 jugadas se marca la huella de un T-Rex y, en la jugada siguiente, la pisa y lanza por los aires todo lo que haya cerca.' },
  ensueno: { n: 'Ensueño', icon: '🦄', d: 'Césped rosa lleno de brillitos. Las porterías suben y bajan despacio durante todo el partido.' },
  oscuro:  { n: 'A oscuras', icon: '🌑', d: 'Todo está muy oscuro: solo el balón y las porterías brillan.' },
  lluvia: { n: 'Lluvioso', icon: '🌧️', d: 'Llueve ligeramente y hay algún charco: si el balón pasa por uno se moja y se frena un poco.' },
  niebla:  { n: 'Niebla', icon: '🌫️', d: 'Visibilidad reducida: solo se distingue lo cercano a los jugadores y al balón.' },
};
const FIELD_KEYS = ['hielo', 'barro', 'pinball', 'tilt', 'iman', 'espacio', 'niebla', 'playa', 'jurasico', 'ensueno', 'oscuro', 'lluvia'];
const SUB_FIELDS = ['hielo', 'barro', 'pinball', 'tilt', 'iman', 'espacio', 'niebla'];
const BALLS = {
  normal:   { n: 'Clásico',   icon: '⚽', d: 'Balón estándar.' },
  hielo: { n: 'Hielo',  icon: '🧊', d: 'Resbala sobre el campo y apenas frena.' },
  pesado:   { n: 'Pesado',    icon: '🎱', d: 'Muy pesado: cuesta moverlo.' },
  gigante:  { n: 'Gigante',   icon: '🔵', d: 'Enorme: más fácil de tocar y de meter.' },
  mini:     { n: 'Mini',      icon: '🔹', d: 'Diminuto y muy rápido.' },
  loca:     { n: 'Loca',      icon: '🌈', d: 'Cambia de trayectoria de forma impredecible.' },
  tres_d:   { n: '3D',        icon: '🪂', d: 'En cada tiro describe una parábola y pasa por encima de los jugadores.' },
  invisible: { n: 'Fantasma', icon: '👻', d: 'Tras el tiro se va volviendo invisible mientras rueda; al pararse reaparece.' },
  venenosa: { n: 'Venenosa',  icon: '☠️', d: 'Cada jugador que toca queda envenenado: pierde toda la puntería (±90° de error) durante todo el partido.' },
};
const BALL_KEYS = ['hielo', 'pesado', 'gigante', 'mini', 'loca', 'tres_d', 'venenosa', 'invisible'];
/* nombres ficticios inspirados en nombres reales */
const NAME_POOLS = {
  ESP: [['Oker', 'Sargio', 'Xevi', 'Álvaro', 'Podro', 'Dani', 'Marc', 'Lomín'], ['Cosillos', 'Ramírez', 'Inuesto', 'Bosquel', 'Murato', 'Olmedo', 'Gavilán', 'Yemal-Diaz']],
  FRA: [['Kylion', 'Antoune', 'Paul', 'Ousmene', 'Raphoël', 'Hugo', 'Lucas', 'Théo'], ['Mbopé', 'Grozmann', 'Pugbé', 'Dombelé', 'Varène', 'Llaris-Fontaine', 'Hernán', 'Giraux-Bellec']],
  ITA: [['Gianlaigi', 'Fabeo', 'Andrea', 'Marco', 'Larenzo', 'Federaco', 'Nicolò', 'Alessio'], ['Boffone', 'Cannivaro', 'Perlo-Rossi', 'Virrati', 'Chiesano', 'Berella-Conti', 'Insugni', 'Totto']],
  ALE: [['Manuel', 'Thomas', 'Jemal', 'Toni', 'Leon', 'Koi', 'Joshua', 'Florian'], ['Neurar', 'Müllan', 'Mosialo', 'Kraos-Weber', 'Goratzko', 'Hevertz-Klein', 'Kommicht', 'Wertzen']],
  BRA: [['Ronaldanho', 'Vinócius', 'Naymar', 'Casomiro', 'Rodrego', 'Marcelo', 'Alesson', 'Raphenha'], ['Gaúchu', 'Júnior-Silva', 'da Silvera', 'Moreira', 'Cofú-Lima', 'Backer-Souza', 'Paquitá', 'Dos Santos']],
  ARG: [['Lionil', 'Ángel', 'Emiliono', 'Julián', 'Rodrigo', 'Lautoro', 'Inzo', 'Alaxis'], ['Massina', 'Di Murío', 'Martánez-Cuervo', 'Álvaro-Díaz', 'Di Paulo', 'Martánez-Toro', 'Fernándaz-Ruiz', 'Mac Allistar']],
  ING: [['Herry', 'Jode', 'Bukeyo', 'Phil', 'Declen', 'Marcas', 'Jurdan', 'Kale'], ['Kana-Wright', 'Bollingam', 'Suko', 'Fodan-Hill', 'Rici-Clarke', 'Rashferd-Pierce', 'Pickferth', 'Walkerson']],
  POR: [['Cristiona', 'Brano', 'Rúban', 'João', 'Bernardo', 'Diago', 'Rafael', 'Pipe'], ['Ronoldão', 'Fernandos-Pinto', 'Díaz-Costa', 'Fólix-Moura', 'Silvano', 'Jota-Almeida', 'Lião-Ferraz', 'Patrócio']],
  PBA: [['Virgel', 'Fronkie', 'Memphas', 'Cady', 'Denzal', 'Matthejs', 'Xevi', 'Nethan'], ['van Dyka', 'de Jongi', 'Depaoy', 'Gokpoh', 'Domfriez', 'de Lugt-Bos', 'Simons-Vermeer', 'Oké-Jansen']],
  BEL: [['Kovin', 'Romalu', 'Thibout', 'Edon', 'Jérémy', 'Youri', 'Axel', 'Leandro'], ['De Brayna', 'Lukeku-Peeters', 'Courtait', 'Hezar', 'Daku-Maes', 'Tielomans-Dubois', 'Witsal-Claes', 'Trossird-Janssens']],
  JPN: [['Takefisa', 'Kaoru', 'Daichi', 'Wataru', 'Hiroki', 'Ritsu', 'Takumi', 'Junya'], ['Kibo-Sato', 'Mutoma-Ito', 'Komada-Suzuki', 'Indo-Tanaka', 'Sakai-Mori', 'Duan-Hayashi', 'Minomino-Abe', 'Ito-Nakamura']],
  MEX: [['Hirvang', 'Guillermo', 'Raúl', 'Edson', 'Santiago', 'Luis', 'Jesús', 'César'], ['Lozani', 'Ochea-Reyes', 'Jimónez-Cruz', 'Álverez-Ríos', 'Gimánez-Soto', 'Chávez-Luna', 'Carona-Vega', 'Montes-Orta']],
  CRO: [['Luko', 'Ivan', 'Mateo', 'Jasko', 'Dominik', 'Marcelo', 'Andrej', 'Mario'], ['Modrico', 'Rekitik-Babić', 'Kovačoc-Horvat', 'Gvardial-Jurić', 'Luvaković-Knez', 'Brozavić-Pavlić', 'Kremarić-Novak', 'Perašić-Marić']],
  SUE: [['Zlatin', 'Viktor', 'Emil', 'Alexander', 'Dejen', 'Victar', 'Robin', 'Albin'], ['Ibrahomovich', 'Gyökares-Berg', 'Forsborg-Lund', 'Isek-Nilsson', 'Kulusovsky', 'Landelöf-Ek', 'Olsen-Strand', 'Ekdel-Holm']],
  COL: [['Jemes', 'Luis', 'Radimel', 'Juan', 'David', 'Jhon', 'Davonson', 'Yorry'], ['Rodrígoez-Ortiz', 'Díaz-Manjarrés', 'Fulcón', 'Cuedrado-Mena', 'Ospena-Rojas', 'Larma-Palacio', 'Sánchez-Varela', 'Mena-Córdoba']],
  USA: [['Christion', 'Westin', 'Tylor', 'Gio', 'Matt', 'Brinden', 'Timothy', 'Sergeño'], ['Pulosic-Hayes', 'McKonnie-Ford', 'Edams-Cole', 'Reynoldo', 'Turner-Boyd', 'Aaronsen-Reed', 'Weeh-Dean', 'Dist-Marshall']],
  URU: [['Federaco', 'Dorwin', 'Luis', 'Ronold', 'José', 'Rodrigo', 'Manuel', 'Nicolás'], ['Valverdi', 'Núñoz-Gil', 'Soárez-Pino', 'Aroújo-Vera', 'Gimánez-Sosa', 'Bentoncor', 'Ugarta', 'De la Cruz-Paz']],
  MAR: [['Achref', 'Hakom', 'Yessine', 'Sofione', 'Naussair', 'Youssef', 'Azzedine', 'Romain'], ['Hekimi-Idrissi', 'Ziyach-Amrani', 'Baunou-Alaoui', 'Amrebat-Tazi', 'Mazreoui', 'En-Nasyri-Haddad', 'Ounehi-Berrada', 'Soïss-Fassi']],
  COR: [['Hiung-min', 'Min-joe', 'Kung-in', 'Hee-chin', 'Woo-yeong', 'Seung-ho', 'Jae-sung', 'Ui-jo'], ['Sun-Park', 'Kim-Lee', 'Lee-Choi', 'Hwang-Jung', 'Jeong-Han', 'Paik-Kang', 'Cho-Yoon', 'Oh-Shin']],
  SUI: [['Granot', 'Yonn', 'Manuel', 'Xherdin', 'Brael', 'Ricardo', 'Fabian', 'Remo'], ['Xhokar', 'Summerli', 'Akenjo', 'Shiqiro', 'Imbolo-Keller', 'Rodrígoez-Meier', 'Freular-Frei', 'Zekaria-Huber']],
  DIN: [['Christion', 'Kesper', 'Pierro', 'Rasmas', 'Andreas', 'Joekim', 'Mikkel', 'Yossuf'], ['Ariksson', 'Schmeichalsen', 'Højbjarg-Holm', 'Højland-Dahl', 'Christansen', 'Mæhla-Nygaard', 'Damsgeard-Moll', 'Poulsen-Lund']],
  TUR: [['Ardo', 'Hekan', 'Kenen', 'Meroh', 'Fardi', 'Çağlor', 'Orkan', 'Congiz'], ['Gülor-Aydın', 'Çalhenoğlu', 'Yıldaz-Kaya', 'Demirel-Şahin', 'Kadıağlu', 'Söyencü-Çelik', 'Kökçi-Demir', 'Ündar-Yılmaz']],
  NOR: [['Erlang', 'Martin', 'Alexander', 'Ørjan', 'Sonder', 'Oscor', 'Leo', 'Kristaffer'], ['Haalondsen', 'Ødegeard-Berg', 'Sørlath-Hagen', 'Nylend-Dahl', 'Bergi-Lie', 'Bobb-Aas', 'Østagård', 'Ejer-Holm']],
  SEN: [['Sodio', 'Kolidou', 'Édoard', 'Ismoïla', 'Idrassa', 'Nicolas', 'Papo', 'Boulaya'], ['Mano-Diop', 'Koulibeli-Ndiaye', 'Mendo-Fall', 'Surr-Diallo', 'Guaye-Sow', 'Jeckson-Ba', 'Matar-Cissé', 'Dio-Seck']],
  EGI: [['Mohimed', 'Omor', 'Ahmed', 'Mahmaud', 'Mostefa', 'Ramedan', 'Trezeguit', 'Amr'], ['Solaj', 'Marmesh-Ali', 'Hagazy-Nour', 'Elnany-Said', 'Zizo-Hany', 'Sobha-Adel', 'Kouka-Reda', 'Fathy-Gaber']],
  NIG: [['Victar', 'Ademula', 'Alex', 'Wilfrid', 'Samuel', 'Kelichi', 'Mases', 'Ola'], ['Osimhan-Obi', 'Lookmen-Eze', 'Iwobo-Nwosu', 'Ndodi-Okoye', 'Chukwuaze-Ade', 'Iheanecho-Uche', 'Simen-Bello', 'Aino-Okafor']],
  CHI: [['Alaxis', 'Artaro', 'Claodio', 'Gery', 'Eduardo', 'Maurecio', 'Charlos', 'Ben'], ['Sánchaz-Rojas', 'Vedal-Soto', 'Bravu-Muñoz', 'Madel-Pizarro', 'Vergas-Araya', 'Isle-Tapia', 'Arángoiz-Díaz', 'Brereten-Silva']],
  AUT: [['David', 'Marcel', 'Marko', 'Konrad', 'Christoph', 'Stefan', 'Florian', 'Kovin'], ['Alebert', 'Sebitzer-Huber', 'Arnautovec-Bauer', 'Laimar-Gruber', 'Baumgartlar', 'Pesch-Wolf', 'Grollitsch-Maier', 'Dunso-Fuchs']],
  GHA: [['Thomas', 'Mohommed', 'André', 'Jurdan', 'Inoki', 'Antoune', 'Daniel', 'Tariq'], ['Partay-Mensah', 'Kudos-Boateng', 'Ayow-Owusu', 'Ayow-Asante', 'Williams-Tetteh', 'Semanyo-Addo', 'Amertey-Quaye', 'Lemptey-Osei']],
  POL: [['Robart', 'Wojcioch', 'Piator', 'Jakab', 'Arkadiasz', 'Metty', 'Sebastian', 'Nicolo'], ['Lewandawsky', 'Szczęsni-Nowak', 'Zielińsko-Wójcik', 'Kiwiar-Kamiński', 'Malik-Lewicki', 'Cesh-Dąbrowski', 'Szymeński', 'Zalewsko-Kozioł']],
  SCO: [['Callan', 'Euan', 'Fraser', 'Angus', 'Lachlan', 'Murray', 'Cameron', 'Rory'], ['MacRae', 'Sinclair', 'Buchanan', 'Gillespie', 'Drummond', 'Menzies', 'Laidlaw', 'Cochrane']],
  UCR: [['Bohdan', 'Danylo', 'Mykyta', 'Yaroslav', 'Maksym', 'Roman', 'Zakhar', 'Ostap'], ['Kovalenko', 'Shevchuk', 'Tkachenko', 'Melnyk', 'Havrylyuk', 'Petrenko', 'Lysenko', 'Bondar']],
  LRD: [['Lei', 'Rado', 'Leiro', 'Radi', 'Leirin', 'Rodo', 'Lero', 'Dado'], ['Leirado', 'Del Rado', 'Leirez', 'Radoso', 'Leirón', 'Radina', 'Leiradez', 'Lerado']],
  CMR: [['Brice', 'Serge', 'Fabrice', 'Yannick', 'Jérémie', 'Cédric', 'Rodrigue', 'Aurélien'], ['Mbarga', 'Kamga', 'Ebeng', 'Fomba', 'Ngassa', 'Essomba', 'Tchatchoua', 'Biyik']],
  PER: [['Diego', 'Piero', 'Álvaro', 'Marcos', 'Jhonatan', 'Rodrigo', 'Joao', 'Anderson'], ['Huamán', 'Cárdenas', 'Salazar', 'Mendívil', 'Ccopa', 'Valdivia', 'Chumpitaz', 'Callirgos']],
  AUS: [['Jack', 'Lachie', 'Riley', 'Mitchell', 'Jurdan', 'Brodie', 'Flynn', 'Hayden'], ['Pearce', 'Whitlock', 'Garrity', 'McAllister', 'Kershaw', 'Treloar', 'Banfield', 'Dunmore']],
  CHN: [['Haoran', 'Zimo', 'Yichen', 'Jiawei', 'Boyu', 'Hanyu', 'Mingxuan', 'Zihao'], ['Lu', 'Shen', 'Tang', 'Cai', 'Ding', 'Pan', 'Xiong', 'Du']],
  IRL: [['Cian', 'Oisín', 'Darragh', 'Conor', 'Fionn', 'Eoin', 'Ronan', 'Cillian'], ['Gallagher', 'Brennan', 'Fitzgerald', 'Donnelly', 'Moran', 'McCarthy', 'Quigley', 'Hennessy']],
  GRE: [['Nikos', 'Stelios', 'Alexandros', 'Lefteris', 'Manolis', 'Thanos', 'Christos', 'Yannis'], ['Papadakis', 'Karamanlis', 'Vlachos', 'Anagnostou', 'Kontos', 'Zervas', 'Galanis', 'Roussos']],
  THA: [['Somchai', 'Nattapong', 'Kritsada', 'Anucha', 'Pichai', 'Thanawat', 'Weerapat', 'Chaiwat'], ['Srisai', 'Boonyarit', 'Wongsawat', 'Prasert', 'Kaewmanee', 'Intarapong', 'Chaiyasit', 'Sukhum']],
  CAN: [['Alphanso', 'Jonethan', 'Tajon', 'Stephan', 'Ismoël', 'Liam', 'Mathiu', 'Jacub'], ['Davias-Clark', 'David-Lacroix', 'Bucanen', 'Larón-Smith', 'Eustáquia-Roy', 'Cornelias-Gill', 'Osório-Nolen', 'Millor-Tran']],
  CIV: [['Sebastien', 'Franck', 'Wilfrid', 'Simen', 'Sarge', 'Nicolo', 'Odelon', 'Mox'], ['Hollar-Koné', 'Kessó-Traoré', 'Zihe-Diomandé', 'Adingro-Bamba', 'Aurieb-Coulibaly', 'Pépo-Kouassi', 'Kossunou-Yoa', 'Gradal-Ouattara']],
  HUN: [['Dominek', 'Willo', 'Péter', 'Ádám', 'Milas', 'Barnabás', 'Roland', 'Attela'], ['Szoboszlói', 'Orbán-Kiss', 'Gulácsa', 'Sallei-Nagy', 'Kerkez-Tóth', 'Vargo-Horváth', 'Lovrencsecs', 'Schäfer-Szabó']],
  SMR: [['Mattio', 'Nicolo', 'Filippe', 'Alix', 'Davede', 'Luco', 'Marcó', 'Enia'], ['Tomassoni', 'Righe', 'Zafferoni', 'Palezzi', 'Stolfe', 'Gasperone', 'Valentina', 'Benedettoni']],
  PAR: [['Miguol', 'Julio', 'Antonio', 'Gustavo', 'Ramón', 'Diego', 'Mathías', 'Ángol'], ['Almarón-Cuevas', 'Enceso-Duarte', 'Sanabrea-Cáceres', 'Gámez-Benítez', 'Alderete-Ayala', 'Bobadella-Rojas', 'Arzamendio-Vera', 'Samudeo-Franco']],
};
const CLUB_NATION = { MCI: 'ING', ARS: 'ING', LIV: 'ING', CHE: 'ING', MUN: 'ING', TOT: 'ING', RMA: 'ESP', BAR: 'ESP', ATM: 'ESP', CEL: 'ESP', VAL: 'ESP', SEV: 'ESP', INT: 'ITA', NAP: 'ITA', JUV: 'ITA', MIL: 'ITA', ROM: 'ITA', ATA: 'ITA', PSG: 'FRA', MON: 'FRA', OLM: 'FRA', LYO: 'FRA', LIL: 'FRA', NIC: 'FRA', BAY: 'ALE', LEV: 'ALE', BVB: 'ALE', RBL: 'ALE', SGE: 'ALE', VFB: 'ALE' };
const NAME_OVERRIDE = {
  ESP: ['Oker Cosillos', 'Sargio Ramón', 'Podro Gavilán', 'Lomín Yemal-Diaz', 'Álvaro Murato'],
  BRA: ['Alesson Backer-Souza', 'Marcelo Júnior', 'Casomiro Lima', 'Vinócius Jr. Silva', 'Ronaldanho Gaúchu'],
  ARG: ['Emiliono Martánez-Cuervo', 'Cristian Rumerio', 'Inzo Fernándaz-Ruiz', 'Ángel Di Murío', 'Lionil Massina'],
  FRA: ['Hugo Llaris-Fontaine', 'Raphoël Varène', 'Paul Pugbé', 'Ousmene Dombelé', 'Kylion Mbopé'],
  POR: ['Rui Patrócio', 'Rúban Díaz-Costa', 'Brano Fernandos-Pinto', 'João Fólix-Moura', 'Cristiona Ronoldão'],
  ING: ['Jurdan Pickferth', 'Kale Walkerson', 'Declen Rici-Clarke', 'Jode Bollingam', 'Herry Kana-Wright'],
  ALE: ['Manuel Neurar', 'Antonio Rüdeger-Wolf', 'Toni Kraos-Weber', 'Jemal Mosialo', 'Koi Hevertz-Klein'],
  ITA: ['Gianlaigi Boffone', 'Fabeo Cannivaro', 'Andrea Perlo-Rossi', 'Larenzo Insugni', 'Marco Virrati'],
  PBA: ['Nethan Oké-Jansen', 'Virgel van Dyka', 'Fronkie de Jongi', 'Memphas Depaoy', 'Cady Gokpoh'],
};
/* ajustes por jugador famoso (POT, PES, PRE, VIS, MEN): reflejan su perfil real. Los equipos de élite quedan compensados; España sigue siendo la mejor */
const STAR_DELTA = {
  ESP: [[-1, 1, 1, 1, 1], [1, 1, -1, -1, 1], [-1, -1, 1, 2, 1], [1, -1, 1, 2, 0], [1, 1, -1, 0, 0]],
  ARG: [[-2, -1, 2, 1, 1], [1, 1, -2, -2, 0], [-1, -2, 1, 2, 0], [-1, -2, 1, 2, -1], [-2, -3, 3, 3, 1]],
  FRA: [[-2, 0, 1, 1, 0], [1, 1, -1, -2, 0], [1, 1, -1, 0, -1], [2, -2, 0, 1, -1], [3, -1, 1, 0, -2]],
  BRA: [[-2, 0, 1, 1, 0], [1, -1, -1, 1, -1], [0, 2, -1, -1, 0], [2, -3, 1, 1, -1], [-1, -2, 3, 3, -3]],
  POR: [[-2, 0, 1, 1, 0], [1, 2, -1, -1, 0], [0, -1, 1, 2, 0], [-1, -2, 1, 2, -1], [3, 1, 1, -2, 0]],
  ING: [[-2, 0, 1, 1, 0], [1, 1, -1, -1, 0], [0, 2, 0, -1, 0], [0, -2, 1, 2, 0], [2, 0, 1, 0, 0]],
  ALE: [[-2, 0, 2, 1, 0], [1, 2, -1, -2, 1], [-1, 0, 1, 2, 0], [0, -2, 1, 2, 0], [1, 0, 0, 0, 0]],
  ITA: [[-2, 1, 1, 0, 0], [0, 3, 0, -2, 1], [-1, -1, 1, 3, 1], [1, -1, 0, 0, 0], [1, 1, 0, -1, 0]],
  PBA: [[-1, 0, 0, 0, 0], [1, 2, -1, -1, 0], [-1, -1, 1, 2, 0], [1, -2, 1, 1, 0], [0, 0, 1, 0, 0]],
};
function playerName(code, idx) {
  if (NAME_OVERRIDE[code]) return NAME_OVERRIDE[code][idx];
  const nat = CLUB_NATION[code] || code, P = NAME_POOLS[nat] || NAME_POOLS.ESP;
  let h = 0; for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return P[0][(h + idx * 3) % P[0].length] + ' ' + P[1][(h * 7 + idx * 5 + 1) % P[1].length];
}
/* ---------- formaciones (4 jugadores de campo + portero) ---------- */
const FORMS = {
  '2-2':   { n: 'Cuadrado',   d: 'Dos atrás y dos arriba: formación equilibrada.',   p: [[0.22, 0.3], [0.22, 0.7], [0.39, 0.3], [0.39, 0.7]] },
  '3-1':   { n: 'Muro',       d: 'Tres defensas y un punta.',            p: [[0.2, 0.2], [0.2, 0.5], [0.2, 0.8], [0.39, 0.5]] },
  '1-3':   { n: 'Ataque',     d: 'Un defensa y tres arriba.',            p: [[0.2, 0.5], [0.39, 0.2], [0.39, 0.5], [0.39, 0.8]] },
  '1-2-1': { n: 'Rombo',      d: 'Centro reforzado: favorece pases y relevos.',       p: [[0.18, 0.5], [0.3, 0.24], [0.3, 0.76], [0.4, 0.5]] },
  '2-1-1': { n: 'Pirámide',   d: 'Dos atrás, un enlace y un punta.',     p: [[0.2, 0.28], [0.2, 0.72], [0.31, 0.5], [0.4, 0.5]] },
  '1-1-2': { n: 'Clásica',    d: 'Formación clásica con dos delanteros.',           p: [[0.2, 0.5], [0.31, 0.5], [0.39, 0.22], [0.39, 0.78]] },
};
const FORM_KEYS = Object.keys(FORMS);
const TEAM_FORM = { ESP: '2-2', FRA: '1-3', ITA: '3-1', ALE: '1-2-1', BRA: '1-3', ARG: '2-1-1', ING: '1-1-2', POR: '2-1-1', PBA: '1-2-1', BEL: '2-2', JPN: '2-2', MEX: '1-1-2', CRO: '2-1-1', SUE: '3-1', COL: '1-3', USA: '1-1-2',
  URU: '3-1', MAR: '2-2', COR: '1-2-1', SUI: '3-1', DIN: '2-2', TUR: '1-3', NOR: '1-3', SEN: '2-1-1', POL: '3-1', EGI: '1-3', NIG: '1-3', CHI: '2-1-1', AUT: '1-2-1', GHA: '2-2', SCO: '1-2-1', UCR: '2-1-1', CMR: '1-3', PER: '3-1', AUS: '2-2', CHN: '2-2', IRL: '1-1-2', GRE: '3-1', THA: '1-2-1', CAN: '1-3', CIV: '1-3', HUN: '2-2', SMR: '3-1', PAR: '3-1',
  MCI: '1-2-1', ARS: '2-2', LIV: '1-3', CHE: '2-1-1', MUN: '1-1-2', TOT: '2-2', BAR: '1-2-1', RMA: '1-3', ATM: '3-1', CEL: '2-1-1', VAL: '1-1-2', SEV: '2-2',
  INT: '3-1', NAP: '1-3', JUV: '3-1', MIL: '2-1-1', ROM: '2-2', ATA: '1-3', PSG: '1-3', MON: '2-2', OLM: '1-1-2', LYO: '1-2-1', LIL: '2-2', NIC: '1-1-2',
  BAY: '1-3', LEV: '1-2-1', BVB: '2-1-1', RBL: '1-3', SGE: '2-2', VFB: '1-2-1' };
const teamForm = code => TEAM_FORM[code] || '1-1-2';
/* posiciones (fracción del campo) de los 5 jugadores: portero + 4 ordenados de atrás hacia delante */
function formSlots(id) {
  const F = FORMS[id] || FORMS['1-1-2'];
  const s = F.p.slice().sort((a, b) => a[0] - b[0] || Math.abs(a[1] - 0.5) - Math.abs(b[1] - 0.5));
  return [[0.075, 0.5]].concat(s);
}
const ROUND_NAMES = ['Dieciseisavos de final', 'Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'];
const roundName = r => (typeof G !== 'undefined' && G && G.league) ? `Jornada ${r + 1}` : (typeof G !== 'undefined' && G && G.tour) ? tourRoundName(r) : (r < 5 ? ROUND_NAMES[r] : `Leyendas ${r - 4}`);

/* ---------- utilidades ---------- */
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/* ---------- equipos ---------- */
/* perfil propio de cada jugador: unos puntos más en lo que destaca y menos en lo demás (suma ≈ 0, para no cambiar el nivel del equipo) */
function playerSpread(code, role) {
  let h = 2166136261; const key = code + '|' + role;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rn = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  for (let i = 0; i < 4; i++) rn();
  const d = STAT_KEYS.map(() => { const r = rn(); return r < 0.06 ? -2 : r < 0.36 ? -1 : r < 0.64 ? 0 : r < 0.94 ? 1 : 2; });
  for (let n = 0; n < 12; n++) {
    const sum = d.reduce((a, b) => a + b, 0);
    if (sum > 1) { const i = d.indexOf(Math.max(...d)); d[i]--; } else if (sum < -1) { const i = d.indexOf(Math.min(...d)); d[i]++; } else break;
  }
  return d;
}
function makeCap(role, code, boost = 0) {
  const R = ROLES.find(r => r.k === role);
  const stars = COUNTRIES[code].best ? 3 : 1, stats = {};
  const bias = COUNTRIES[code].bias, key1 = Object.keys(bias)[0], tier = TIER[code] || 0;
  STAT_KEYS.forEach(s => { const acc = s === key1 ? 1 : 0; stats[s] = clamp(R.base[s] + acc + tier + boost + (stars - 1) * STAR_BONUS + (COUNTRIES[code].allStat ? 0 : 1), 1, 12); });
  if (STAR_DELTA[code] && !COUNTRIES[code].allStat) { const d = STAR_DELTA[code][ROLES.findIndex(r => r.k === role)]; if (d) STAT_KEYS.forEach((s, i) => { stats[s] = clamp(stats[s] + d[i], 1, 12); }); }
  else if (!COUNTRIES[code].allStat) {   // sin ajustes a mano: cada jugador tiene su propio perfil (determinista por equipo y posición)
    const d = playerSpread(code, role); STAT_KEYS.forEach((s, i) => { stats[s] = clamp(stats[s] + d[i], 1, 12); });
  }
  const captain = role === 'MED';   // cada equipo tiene un capitán: el mediocentro (+1 Mentalidad)
  if (captain) stats.MEN = clamp(stats.MEN + 1, 1, 12);
  const ri = ROLES.findIndex(r => r.k === role);
  if (COUNTRIES[code].allStat) { STAT_KEYS.forEach(s => { stats[s] = COUNTRIES[code].allStat; }); if (COUNTRIES[code].men) stats.MEN = COUNTRIES[code].men; return { role, captain, stats, abs: COUNTRIES[code].abs3 ? [COUNTRIES[code].abs3, COUNTRIES[code].abs3, COUNTRIES[code].abs3] : [], name: playerName(code, ri), num: SHIRT[role], stars: 1 }; }
  return { role, stats, abs: [], name: playerName(code, ri), num: SHIRT[role], stars, captain };
}
// todo equipo (salvo los de nivel fijo) tiene al menos un jugador «normalito tirando a bueno» (media 6)
function ensureGood(team, code) {
  if (COUNTRIES[code].allStat) return team;
  const avg = c => STAT_KEYS.reduce((a, k) => a + c.stats[k], 0) / STAT_KEYS.length;
  let best = team[0]; team.forEach(c => { if (avg(c) > avg(best) || (avg(c) === avg(best) && c.role === 'DEL')) best = c; });
  for (let n = 0; avg(best) < 6 && n < 30; n++) { const k = STAT_KEYS.filter(s => s !== 'MEN').reduce((a, s) => best.stats[s] < best.stats[a] ? s : a); best.stats[k] = Math.min(12, best.stats[k] + 1); }
  if (best.stars < 2) { best.stars = 2; STAT_KEYS.forEach(s => { best.stats[s] = Math.min(12, best.stats[s] + STAR_BONUS); }); }   // al menos una chapa de 2 estrellas
  if (!team.some(c => c.abs.length)) {   // y al menos una con una habilidad
    const others = team.filter(c => c !== best && c.role !== 'POR'), who = pick(others.length ? others : team);
    who.abs.push(pick(Object.keys(ABILITIES).filter(k => k !== 'capitan' && k !== 'goat')));
  }
  return team;
}
function playerTeam(code) { return ensureGood(ROLES.map(r => makeCap(r.k, code)), code); }
function enemyTeam(code, round) {
  const base = ensureGood(ROLES.map(r => makeCap(r.k, code)), code);
  return ROLES.map((r, ri) => {
    const cap = base[ri];
    if (COUNTRIES[code].allStat) return cap;
    STAT_KEYS.forEach(s => { cap.stats[s] = clamp(Math.round(cap.stats[s] + round * 0.6 + (Math.random() * 1.6 - 0.6) - 0.5), 1, 12); });
    const extra = Math.floor(round / 3) + (Math.random() < 0.25 ? 1 : 0), st0 = cap.stars;
    cap.stars = clamp(st0 + extra, 1, 5);
    const add = (cap.stars - st0) * STAR_BONUS;
    STAT_KEYS.forEach(s => { cap.stats[s] = clamp(cap.stats[s] + add, 1, 12); });
    const pAb = round < 1 ? 0 : round < 3 ? 0.3 : round < 5 ? 0.6 : 0.9;
    for (let i = 0; i < abSlots(cap.stars); i++) {
      if (Math.random() < pAb * (i ? 0.55 : 1)) { const k = pick(Object.keys(ABILITIES).filter(k => k !== 'capitan' && !cap.abs.includes(k))); cap.abs.push(k); }
    }
    return cap;
  });
}
const capOvr = c => Math.round(STAT_KEYS.reduce((a, k) => a + c.stats[k], 0) / STAT_KEYS.length * 10);

/* ---------- mundo físico ---------- */
function buildSegs(gwL, gwR, off) {
  const { W, H, pocket } = FIELD, segs = [];
  const lim = g => H / 2 - g / 2 - 24, oL = off ? clamp(off[0], -lim(gwL), lim(gwL)) : 0, oR = off ? clamp(off[1], -lim(gwR), lim(gwR)) : 0;   // ensueño: porterías desplazadas
  const lt = H / 2 - gwL / 2 + oL, lb = H / 2 + gwL / 2 + oL, rt = H / 2 - gwR / 2 + oR, rb = H / 2 + gwR / 2 + oR;
  const S = (a, b, c, d) => segs.push([a, b, c, d]);
  S(0, 0, W, 0); S(0, H, W, H);
  S(0, 0, 0, lt); S(0, lb, 0, H); S(-pocket, lt, 0, lt); S(-pocket, lt, -pocket, lb); S(-pocket, lb, 0, lb);
  S(W, 0, W, rt); S(W, rb, W, H); S(W, rt, W + pocket, rt); S(W + pocket, rt, W + pocket, rb); S(W, rb, W + pocket, rb);
  return { segs, posts: [[0, lt], [0, lb], [W, rt], [W, rb]], lt, lb, rt, rb };
}

/* masa según el peso: a partir de 5 crece rápido (peso 12 ≈ 3.5 veces más masa que un peso medio) */
function massFor(p) { return 1.2 + 0.15 * p + 0.06 * Math.pow(Math.max(0, p - 5), 2); }
function capBody(def, team, i, mods) {
  const has0 = k => (def.abs || []).includes(k);
  const R = ROLES.find(r => r.k === def.role), abs = def.abs || [], stars = def.stars || 1, st = {};
  STAT_KEYS.forEach(k => { st[k] = Math.min(12.5, def.stats[k] + ((mods && mods.bonus) || 0)); });
  if (mods && mods.capMen && def.captain) st.MEN = 12;   // reliquia Brazalete
  // MENTALIDAD: a partir de 7, CADA característica tiene su propia probabilidad de subir hasta +1 (con un decimal)
  let irid = false, actB = null, goat = false;
  if (has0('goat')) {   // GOAT: 10% / 30% / 50% de jugar el partido con todo a 12
    const pg = [0.1, 0.3, 0.5][Math.min(3, abCount(abs, 'goat')) - 1];
    goat = mods && mods.fixGoat !== undefined ? !!mods.fixGoat : Math.random() < pg;
    if (goat) { STAT_KEYS.forEach(k => { st[k] = 12; }); irid = true; }
  }
  if (goat) { /* GOAT: sin mejoras de mentalidad */ }
  else if (mods && mods.fixAct !== undefined) {   // laboratorio: mejoras de mentalidad ya tiradas (se reutilizan hasta que se pida recalcular)
    if (mods.fixAct) { actB = {}; Object.keys(mods.fixAct).forEach(k => { st[k] = Math.min(12.5, st[k] + mods.fixAct[k]); actB[k] = mods.fixAct[k]; if (mods.fixAct[k] > 0) irid = true; }); }
  } else if (mods && !mods.noAct && st.MEN < 2) {
    // mentalidad muy baja: pierde hasta 0.5 de estadísticas en total (valor al azar), repartido entre sus características
    let left = Math.round(Math.random() * 5) / 10;
    ['POT', 'PES', 'PRE', 'VIS'].sort(() => Math.random() - 0.5).forEach(k => {
      if (left >= 0.1 && Math.random() < 0.5) {
        const g = Math.min(left, Math.round((0.1 + Math.random() * 0.4) * 10) / 10), n = Math.max(1, st[k] - g), real = Math.round((st[k] - n) * 10) / 10;
        if (real > 0) { st[k] = n; (actB = actB || {})[k] = -real; left = Math.round((left - real) * 10) / 10; }
      }
    });
  } else if (mods && !mods.noAct && st.MEN >= 7) {
    const p = clamp(0.2 + (st.MEN - 7) * 0.1, 0, 0.75);
    // mentalidad 11: mejora total SIEMPRE de 1; mentalidad 12: SIEMPRE de 2 (repartida al azar). Por debajo: tope 0.4…0.75 y total al azar entre 0 y ese tope
    if (st.MEN >= 11) {
      const T = st.MEN >= 12 ? 2 : 1, ks = ['POT', 'PES', 'PRE', 'VIS'], wts = ks.map(() => 0.15 + Math.random());
      const sw = wts.reduce((a, b) => a + b, 0); let rest = T;
      ks.forEach((k, i) => {
        let g = i === ks.length - 1 ? rest : Math.round(wts[i] / sw * T * 10) / 10; g = Math.min(g, rest);
        const n = Math.min(12.5, st[k] + g), real = Math.round((n - st[k]) * 10) / 10;
        if (real > 0) { st[k] = n; (actB = actB || {})[k] = real; irid = true; }
        rest = Math.round((rest - g) * 10) / 10;
      });
    } else {
    const capG = clamp(0.5 + (st.MEN - 8) * 0.125, 0.4, 1);
    let left = Math.round(Math.random() * capG * 10) / 10;
    ['POT', 'PES', 'PRE', 'VIS'].sort(() => Math.random() - 0.5).forEach(k => {
      if (left >= 0.1 && Math.random() < p) {
        const g = Math.min(left, Math.round((0.3 + Math.random() * 0.7) * 10) / 10), n = Math.min(12.5, st[k] + g), real = Math.round((n - st[k]) * 10) / 10;
        if (real > 0) { st[k] = n; (actB = actB || {})[k] = real; irid = true; left = Math.round((left - real) * 10) / 10; }
      }
    });
    }
  }
  const has = k => abs.includes(k), nA = k => abCount(abs, k);
  let r = FIELD.capR * R.rk * (1 + 0.012 * (st.PES - 3));
  let m = massFor(st.PES);
  let dec = 330 + 9 * st.PES;
  let vmax = 380 + 1100 * Math.pow(clamp((st.POT - 1) / 11, 0, 1), 1.6);   // curva no lineal
  if (has('canon')) vmax *= 1 + 0.4 * nA('canon');
  if (has('bulldozer')) m *= 1 + 0.7 * nA('bulldozer');
  if (has('gigante')) { r *= 1 + 0.3 * nA('gigante'); m *= 1 + 0.3 * nA('gigante'); }
  if (has('resbaladiza')) dec *= 1 / (1 + 0.82 * nA('resbaladiza'));
  if (mods && mods.pot) vmax *= mods.pot;
  
  const sl = formSlots(mods && mods.form)[i];
  const gkMag = mods && mods.gk && def.role === 'POR' ? 3 : 0;
  const hx = team === 0 ? sl[0] * FIELD.W : (1 - sl[0]) * FIELD.W, hy = sl[1] * FIELD.H;
  return { kind: 'cap', gkMag, team, idx: i, x: hx, y: hy, hx, hy, vx: 0, vy: 0, r, m, dec, vmax: Math.min(vmax, 1500), spin: 0, abs, st, stars, name: def.name || R.n, num: def.num || SHIRT[def.role], role: def.role, ang: 0, id: team * 5 + i,
    dev: devFor(st.PRE), frozen: 0, mot: !!(mods && mods.bonus), irid, actB, captain: !!def.captain, goat, rock: nA('piedra') };
}
/* números reales de un jugador para el tooltip */
function capInfo(def) {
  const b = capBody(def, 0, 0, null);
  return { vmax: Math.round(b.vmax), mass: b.m.toFixed(1), r: Math.round(b.r), dec: Math.round(b.dec), vis: Math.round(visOf(b) * 100), dev: +(b.dev * 180 / Math.PI).toFixed(1), st: b.st };
}
function ballBody(type = 'normal') {
  const b = { kind: 'ball', team: -1, idx: -1, x: FIELD.W / 2, y: FIELD.H / 2, vx: 0, vy: 0, r: FIELD.ballR, m: 0.55, dec: 170, spin: 0, ang: 0, id: 99, lastTeam: -1, lastX: FIELD.W / 2, btype: type, bounce: 0.86, cb: 0.9, pf: 1.9 };
  if (type === 'hielo') { b.dec = 38; b.bounce = 0.96; b.m = 0.5; }
  else if (type === 'pesado') { b.m = 2.4; b.dec = 260; b.r = 15; b.bounce = 0.7; b.cb = 0.75; }
  else if (type === 'gigante') { b.r = 34; b.m = 1.8; b.dec = 150; }
  else if (type === 'mini') { b.r = 5.5; b.m = 0.2; b.dec = 130; b.bounce = 0.92; }
  else if (type === 'loca') { b.dec = 150; b.ct = 0; }
  else if (type === 'tres_d') { b.fresh = true; b.air = 0; b.air0 = 1; }
  return b;
}
const BALL_OFFS = [[], [[0, 0]], [[0, -70], [0, 70]], [[0, -120], [0, 0], [0, 120]], [[-70, -90], [-70, 90], [70, -90], [70, 90]]];

/* defs0/defs1: arrays de capas (equipo 0 / equipo 1), opts: {mods0, mods1, gwL, gwR} */
function makeWorld(defs0, defs1, opts = {}) {
  const geo = buildSegs(opts.gwL || FIELD.gw, opts.gwR || FIELD.gw);
  const bodies = [];
  defs0.forEach((d, i) => { if (d) bodies.push(capBody(d, 0, i, opts.mods0)); });
  defs1.forEach((d, i) => { if (d) bodies.push(capBody(d, 1, i, opts.mods1)); });
  const field = opts.field || 'normal', bt = opts.ballType || 'normal', nb = clamp(opts.nBalls || 1, 1, 4);
  BALL_OFFS[nb].forEach(([ox, oy], i) => { const b = ballBody(bt); b.ox = ox; b.oy = oy; b.x += ox; b.y += oy; b.id = 90 + i; bodies.push(b); });
  const ball = bodies[bodies.length - 1];
  const w = { bodies, ball, balls: bodies.filter(b => b.kind === 'ball'), segs: geo.segs, posts: geo.posts, geo, gwL: opts.gwL || FIELD.gw, gwR: opts.gwR || FIELD.gw, goff: null, gt: 0, goal: null, events: [], field, noGoal: false, tilt: null, xd: 1, fdec: 1, lock: [false, false], pull: 0, zones: null, bumpers: null, mud: null, noDev: false, poisonArm: { shooter: -1, armed: true },
    lines: [[0, geo.lt, 0, geo.lb], [FIELD.W, geo.rt, FIELD.W, geo.rb]] };
  applyField(w, field);
  return w;
}
function clearField(w) { if (w.dream) { w.dream = false; w.goff = null; setGoalWidths(w, w.gwL, w.gwR); } w.dark = false; w.kz = null; w.kplays = 0; w.mud = null; w.pud = null; w.rain = false; w.fog = false; w.umb = null; w.jura = false; w.tilt = null; w.zones = null; w.bumpers = null; w.pull = 0; w.fdec = 1; w.field = 'normal'; }
function newTilt(w) {
  const a = Math.random() * Math.PI * 2;
  w.tilt = { ax: Math.cos(a) * 100, ay: Math.sin(a) * 100, ang: a };
}
function resetKickoff(w) {
  w.xd = 1;
  w.bodies.forEach(b => {
    if (b.kind === 'ball') { b.x = FIELD.W / 2 + (b.ox || 0); b.y = FIELD.H / 2 + (b.oy || 0); b.lastTeam = -1; b.lastRole = null; b.lastX = FIELD.W / 2; b.chg = 0; }
    else { b.x = b.hx; b.y = b.hy; }
    b.vx = b.vy = 0; b.spin = 0;
    if (b.btype === 'tres_d') { b.air = 0; b.fresh = true; }
  });
  w.goal = null;
}
/* lado físico (0 = izquierda) que ocupa el equipo; 'cambio de áreas' lo invierte */
const physSide = (w, t) => (w && w.flip) ? 1 - t : t;
function cloneWorld(w) {
  const bodies = w.bodies.map(b => Object.assign({}, b));
  return Object.assign({}, w, { bodies, ball: bodies[bodies.length - 1], balls: bodies.filter(b => b.kind === 'ball'), goal: null, events: [], zones: w.zones, bumpers: w.bumpers, ngOff: w.ngOff ? w.ngOff.slice() : w.ngOff, lock: w.lock ? w.lock.slice() : w.lock });
}

const speedOf = b => Math.hypot(b.vx, b.vy);
function settled(w) { return w.bodies.every(b => b.vx * b.vx + b.vy * b.vy < 16); }

function segCollide(b, x1, y1, x2, y2, e) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = ((b.x - x1) * dx + (b.y - y1) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = x1 + t * dx, py = y1 + t * dy;
  let nx = b.x - px, ny = b.y - py, d = Math.hypot(nx, ny);
  if (d >= b.r) return false;
  if (d < 1e-6) { const l = Math.sqrt(l2); nx = -dy / l; ny = dx / l; d = 0; } else { nx /= d; ny /= d; }
  b.x = px + nx * b.r; b.y = py + ny * b.r;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.spin *= 0.5; return -vn; }
  return 0;
}

function stepWorld(w, dt) {
  const B = w.bodies;
  for (const b of B) {
    const P = w.kz ? w.kz[b.x < FIELD.W / 2 ? 0 : 1] : w, fd = w.xd * P.fdec * (P !== w ? w.fdec : 1);
    if (b.kind === 'cap' && b.frozen && b.abs.includes('hierro')) { b.frozen = 0; if (b.mOrig) b.m = b.mOrig; }
    if (b.kind === 'cap' && !b.frozen && (b.abs.includes('iman') || (b.gkMag && w.playTeam != null && w.playTeam !== b.team))) {
      const n = b.gkMag || abCount(b.abs, 'iman'), R = 130 + 75 * (n - 1), F = 520 + 290 * (n - 1);   // más imanes: más radio y más fuerza
      let ball = w.ball, bd = 1e9;
      for (const q of w.balls) { const dd = Math.hypot(q.x - b.x, q.y - b.y); if (dd < bd) { bd = dd; ball = q; } }
      const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy);
      if (d < R && d > b.r + ball.r) { const f = F * (1 - d / R) * dt; ball.vx -= dx / d * f; ball.vy -= dy / d * f; }
    }
    if (b.kind === 'cap') {
      b.rockFix = b.rock >= 3 && !b.shotNow;   // piedra: 3 copias = inmóvil salvo cuando tira ella
      b.rockK = b.rock && !b.shotNow ? [1, 0.3, 0.1, 0][Math.min(3, b.rock)] : 1;   // 1 copia: se mueve poco · 2: muy poco
      if (b.shotNow) { b.shotAge = (b.shotAge || 0) + dt; if (b.shotAge > 0.5 && Math.hypot(b.vx, b.vy) < 8) { b.shotNow = false; b.shotAge = 0; } }
      if (b.poison && b.abs.includes('hierro')) { STAT_KEYS.forEach(k => { if (b.psn && b.psn[k]) b.st[k] += b.psn[k]; }); if (b.psnV) b.vmax = b.psnV; b.dev = devFor(b.st.PRE); b.poison = false; b.psn = null; w.events.push({ t: 'cure', x: b.x, y: b.y, id: b.id }); }   // salud de hierro: se cura
      if (b.rockFix) { b.vx = b.vy = 0; continue; }
      if (b.abs.includes('arana') && !b.spiderDone && w.ballTouchedPlay && !b.frozen && w.playTeam != null && w.playTeam !== b.team && (w.playT || 0) > 0.25) {   // araña: va a por el balón durante la jugada rival
        const n = abCount(b.abs, 'arana'), vt = [220, 340, 500][n - 1], ac = 3200 * dt;
        b.spiderT = (b.spiderT || 0) + dt;   // 1 araña: poco rato · 2: bastante · 3: mucho
        const on = b.spiderT <= [0.5, 1.1, 1.9][n - 1];
        let ball = null;   // cada instante: el balón jugado más cercano, solo si está a menos de 3 veces su tamaño
        { let bd = 1e9; const hitB = w.balls.some(q => q.playHit);
          for (const q of w.balls) { if (q.air > 0 || (hitB && !q.playHit)) continue; const dd = Math.hypot(q.x - b.x, q.y - b.y); if (dd < bd && dd <= b.r * 6) { bd = dd; ball = q; } } }
        if (on && ball) {
          const dx0 = ball.x - b.x, dy0 = ball.y - b.y, d0 = Math.hypot(dx0, dy0) || 1;
          if (d0 > b.r + ball.r + 3) {
            const lead = Math.min(0.35, d0 / vt), px = ball.x + ball.vx * lead, py = ball.y + ball.vy * lead, dp = Math.hypot(px - b.x, py - b.y) || 1;   // apunta a donde estará el balón
            const tx = (px - b.x) / dp * vt, ty = (py - b.y) / dp * vt, ex = tx - b.vx, ey = ty - b.vy, el = Math.hypot(ex, ey);
            if (el > 1e-6) { const k = Math.min(1, ac / el); b.vx += ex * k; b.vy += ey * k; }
          }
        }
      }
    }
    if (b.frozen) { b.vx = b.vy = 0; continue; }
    const moving = b.vx || b.vy;
    if (b.btype === 'loca' && moving) { b.ct -= dt; if (b.ct <= 0) { b.ct = 0.3 + Math.random() * 0.4; b.spin = (Math.random() - 0.5) * 6; } }
    if (b.spin && moving) {
      const a = b.spin * dt, c = Math.cos(a), s = Math.sin(a);
      const vx = b.vx * c - b.vy * s; b.vy = b.vx * s + b.vy * c; b.vx = vx;
    }
    if (moving) {
      if (P.tilt) { b.vx += P.tilt.ax * dt; b.vy += P.tilt.ay * dt; }
      if (P !== w && w.tilt) { b.vx += w.tilt.ax * dt; b.vy += w.tilt.ay * dt; }
      if (P.pull) { const dx = FIELD.W / 2 - b.x, dy = FIELD.H / 2 - b.y, d = Math.hypot(dx, dy) || 1; b.vx += dx / d * P.pull * dt; b.vy += dy / d * P.pull * dt; }
      if (w.zones) for (const z of w.zones) { const dx = b.x - z.x, dy = b.y - z.y; if (dx * dx + dy * dy < z.r * z.r) { const sp0 = Math.hypot(b.vx, b.vy) || 1; b.vx += b.vx / sp0 * 640 * dt; b.vy += b.vy / sp0 * 640 * dt; } }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      let kf = 1; if (P.mud) for (const z of P.mud) { const dx = b.x - z.x, dy = b.y - z.y; if (dx * dx + dy * dy < z.r * z.r) { kf = 5; break; } }
      let vk = 0;
      if (P.pud && b.kind === 'ball') { for (const z of P.pud) { const dx = b.x - z.x, dy = b.y - z.y; if (dx * dx + dy * dy < z.r * z.r) { kf = 5; vk = 7; b.wet = 1; break; } } if (b.wet > 0) b.wet = Math.max(0, b.wet - dt * 0.06); }   // charco: el balón se moja y frena
      let tg = 0; if (w.tall && b.kind === 'ball') for (const s of [0, 1]) if (w.tall[s]) { const left = physSide(w, s) === 0; if ((left ? b.x < 165 : b.x > FIELD.W - 165) && b.y > 125 && b.y < 515) tg = 2400; }   // césped alto: el balón se frena muchísimo en el área
      let ns = sp - b.dec * fd * kf * dt - tg * dt;
      if (vk) ns *= Math.exp(-vk * dt);   // charco: freno extra que solo vence un disparo muy potente
      if (ns > 2100) ns = 2100;
      if (ns < 5) { b.vx = b.vy = 0; b.spin = 0; } else { const k = ns / sp; b.vx *= k; b.vy *= k; }
      b.ang += sp * dt / b.r;
    }
  }
  for (const q of B) { if (q.air > 0) q.air = Math.max(0, q.air - dt); if (q.cd > 0) q.cd -= dt; }
  for (let i = 0; i < B.length; i++) {
    const a = B[i];
    for (let j = i + 1; j < B.length; j++) {
      const b = B[j];
      if ((a.air > 0 && b.kind === 'cap') || (b.air > 0 && a.kind === 'cap')) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, im1 = a.rockFix ? 0 : (a.rockK == null ? 1 : a.rockK) / a.m, im2 = b.rockFix ? 0 : (b.rockK == null ? 1 : b.rockK) / b.m, ov = rr - d;
      if (im1 + im2 === 0) continue;
      a.x -= nx * ov * im1 / (im1 + im2); a.y -= ny * ov * im1 / (im1 + im2);
      b.x += nx * ov * im2 / (im1 + im2); b.y += ny * ov * im2 / (im1 + im2);
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const ballHit = a.kind === 'ball' || b.kind === 'ball';
        const ball = a.kind === 'ball' ? a : b.kind === 'ball' ? b : null;
        const e = ballHit ? (a.kind === 'ball' && b.kind === 'ball' ? 0.95 : ball.cb) : 0.8;
        const j2 = -(1 + e) * vn / (im1 + im2), pre = [a.vx, a.vy, b.vx, b.vy];   // velocidades antes del choque
        a.vx -= j2 * im1 * nx; a.vy -= j2 * im1 * ny; b.vx += j2 * im2 * nx; b.vy += j2 * im2 * ny;
        a.spin = 0; b.spin = 0;
        const cap = a.kind === 'cap' ? a : b.kind === 'cap' ? b : null;
        if (ballHit && cap) {
          if (cap.abs.includes('arana') && w.playTeam != null && w.playTeam !== cap.team && !cap.spiderDone) { cap.spiderDone = true; cap.vx = cap.vy = 0; }   // araña: al tocar el balón se queda parada
          w.ballTouchedPlay = true;
          ball.playHit = true;
          if (ball.fireTeam != null && cap.team !== ball.fireTeam) { ball.fireTeam = null; ball.vx = ball.vy = 0; cap.vx *= 0.1; cap.vy *= 0.1; w.events.push({ t: 'firestop', x: ball.x, y: ball.y }); }   // la bola de fuego se para al chocar con un rival
          if (abCount(cap.abs, 'goat') >= 3) {   // 3 GOAT: el balón siempre sale hacia la portería rival
            const sp = Math.hypot(ball.vx, ball.vy);
            if (sp > 60) { const gx = physSide(w, cap.team) === 0 ? FIELD.W : 0, gy = FIELD.H / 2, dd = Math.hypot(gx - ball.x, gy - ball.y) || 1; ball.vx = (gx - ball.x) / dd * sp; ball.vy = (gy - ball.y) / dd * sp; if (sp > 220) ball.fireTeam = cap.team; if (sp > 220) w.events.push({ t: 'goatshot', x: ball.x, y: ball.y }); }
          }
          const passFrom = ball.lastTeam === cap.team && ball.lastId != null && ball.lastId !== cap.id && cap.id !== w.shooterId;
          ball.lastTeam = cap.team; ball.lastX = ball.x; ball.lastRole = cap.role; ball.lastName = cap.name;
          if (w.rkick != null && cap.team === w.rkick && cap.id !== w.shooterId && -vn > 60) {   // pase letal: el que recibe el pase dispara a portería a máxima potencia
            const gx = physSide(w, cap.team) === 0 ? FIELD.W : 0, gy = FIELD.H / 2 + (Math.random() - 0.5) * FIELD.gw * 0.5, dd = Math.hypot(gx - ball.x, gy - ball.y) || 1, sp = Math.max(Math.hypot(ball.vx, ball.vy), cap.vmax * 1.7);
            ball.vx = (gx - ball.x) / dd * sp; ball.vy = (gy - ball.y) / dd * sp; ball.fireTeam = cap.team; w.events.push({ t: 'goatshot', x: ball.x, y: ball.y });
          }
          if (ball.btype === 'tres_d' && ball.fresh && -vn > 100) { ball.fresh = false; ball.air0 = ball.air = clamp(Math.hypot(ball.vx, ball.vy) / 950, 0.4, 1.0); w.events.push({ t: 'jump', x: ball.x, y: ball.y }); }
          if (ball.btype === 'venenosa' && w.poisonArm && w.poisonArm.armed && cap.id !== w.poisonArm.shooter && !w.noDev && !cap.abs.includes('hierro')) {
            w.poisonArm.armed = false;
            if (!cap.poison) {
              cap.poison = true;
              w.events.push({ t: 'poison', x: cap.x, y: cap.y, id: cap.id });
            }
          }
          if (!w.noDev && (cap.poison ? POISON_DEV : cap.dev) > 0 && -vn > 90) {
            const an = clamp(gauss(), -2, 2) * (cap.poison ? POISON_DEV : cap.dev), c = Math.cos(an), s = Math.sin(an), vx = ball.vx * c - ball.vy * s;
            ball.vy = ball.vx * s + ball.vy * c; ball.vx = vx;
            if (Math.abs(an) > 0.045) w.events.push({ t: 'dev', x: ball.x, y: ball.y, a: an });
          }
          // control de balón: para el balón en seco (si no es ella la que tira). 1 copia: el jugador se mueve con el golpe · 2: con la mitad de fuerza · 3: no se mueve
          const nCt = abCount(cap.abs, 'control');
          const ownKick = (cap.id === w.shooterId || cap.shotNow) && (ball.lastId == null || ball.lastId === cap.id);   // solo el golpe del propio tirador al balón no se frena; si el balón rebota y vuelve a él, sí
          if (nCt && !ownKick) {
            ball.vx = ball.vy = 0;
            const v0 = cap === a ? [pre[0], pre[1]] : [pre[2], pre[3]], k = [1, 0.5, 0][Math.min(3, nCt) - 1];
            if (nCt >= 3) { cap.vx = cap.vy = 0; } else { cap.vx = v0[0] + (cap.vx - v0[0]) * k; cap.vy = v0[1] + (cap.vy - v0[1]) * k; }   // 3 copias: el jugador se queda quieto del todo
          }
          // instinto goleador: al recibir un pase de un compañero, dispara directo a portería
          const nIn = abCount(cap.abs, 'instinto');
          if (nIn && passFrom && -vn > 40) {
            const gx = physSide(w, cap.team) === 0 ? FIELD.W : 0, gy = FIELD.H / 2, er = w.noDev ? 0 : (Math.random() * 2 - 1) * [0.31, 0.157, 0][nIn - 1];
            const an = Math.atan2(gy - ball.y, gx - ball.x) + er, sp = Math.min(1500, cap.vmax * [0.45, 0.75, 1.1][nIn - 1]);
            ball.vx = Math.cos(an) * sp; ball.vy = Math.sin(an) * sp; w.events.push({ t: 'goatshot', x: ball.x, y: ball.y });
          }
          ball.lastId = cap.id;
        }
        w.events.push({ t: ballHit ? 'ball' : 'cap', v: -vn, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a: a.id, b: b.id });
      }
    }
  }
  let segs = w.segs;
  if (!w.noGoal) w.ngOff = [false, false];
  if (w.noGoal) { if (!w.ngOff) w.ngOff = [false, false]; segs = segs.concat(w.lines.filter((_, i) => !w.ngOff[i] || (w.lock && w.lock[physSide(w, i)]))); }
  else if (w.lock && (w.lock[0] || w.lock[1])) segs = segs.concat(w.lock[physSide(w, 0)] ? [w.lines[0]] : [], w.lock[physSide(w, 1)] ? [w.lines[1]] : []);
  for (const b of B) {
    if (b.frozen) { b.vx = b.vy = 0; continue; }
    const e = b.kind === 'ball' ? b.bounce : 0.75, pf = b.kind === 'ball' ? b.pf : 1.9;
    for (const s of segs) {
      const v = segCollide(b, s[0], s[1], s[2], s[3], e);
      if (v > 20 && b.kind === 'ball' && w.noGoal) { const li = w.lines.indexOf(s); if (li >= 0 && !w.ngOff[li]) { w.ngOff[li] = true; w.events.push({ t: 'barbreak', li, x: b.x, y: b.y }); } }   // la barra del saque aguanta un solo golpe del balón
      if (v > 120) {
        if (b.kind === 'ball') { b.chg = (b.chg || 0) + 1; b.vx *= 1.06; b.vy *= 1.06; }
        w.events.push({ t: 'wall', v, x: b.x, y: b.y, ball: b.kind === 'ball' ? b.id : null, chg: b.chg || 0 });
      }
    }
    if (b.kind === 'ball') for (const s of segs) {   // la barrera roja nunca se atraviesa (balón pequeño y rápido que salta la línea de un paso)
      if (s !== w.lines[0] && s !== w.lines[1]) continue;
      const left = s[0] < FIELD.W / 2, ylo = Math.min(s[1], s[3]), yhi = Math.max(s[1], s[3]);
      if (b.y < ylo - b.r || b.y > yhi + b.r) continue;
      if (left ? b.x < s[0] : b.x > s[0]) { b.x = s[0] + (left ? b.r : -b.r); if (left ? b.vx < 0 : b.vx > 0) b.vx = -b.vx * 0.6; }
    }
    for (const p of w.posts) {
      const dx = b.x - p[0], dy = b.y - p[1], d = Math.hypot(dx, dy), rr = b.r + FIELD.post;
      if (d < rr && d > 1e-6) {
        const nx = dx / d, ny = dy / d; b.x = p[0] + nx * rr; b.y = p[1] + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { if (w.dark && b.kind === 'ball') w.events.push({ t: 'plit', x: p[0], y: p[1] }); b.vx -= pf * vn * nx; b.vy -= pf * vn * ny; if (-vn > 150) w.events.push({ t: 'post', v: -vn, x: p[0], y: p[1], ball: b.kind === 'ball' ? b.id : null }); }
      }
    }
    const PB = (w.kz ? w.kz[b.x < FIELD.W / 2 ? 0 : 1] : w).bumpers;
    if (PB) for (const p of PB) {
      const dx = b.x - p[0], dy = b.y - p[1], d = Math.hypot(dx, dy), rr = b.r + p[2];
      if (d < rr && d > 1e-6) {
        const nx = dx / d, ny = dy / d; b.x = p[0] + nx * rr; b.y = p[1] + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { const f = b.kind === 'ball' ? 2.6 : 1.8; b.vx -= f * vn * nx; b.vy -= f * vn * ny; if (-vn > 80) w.events.push({ t: 'bump', v: -vn, x: p[0], y: p[1] }); }
        else if (Math.hypot(b.vx, b.vy) < 80) { b.vx += nx * 140; b.vy += ny * 140; }
      }
    }
  }
  if (!w.goal) for (const q of w.balls) {
    if (q.x < -q.r) { w.goal = { scorer: w.flip ? 0 : 1, x: q.x, y: q.y, lastX: q.lastX, lastTeam: q.lastTeam, lastRole: q.lastRole, lastName: q.lastName, chg: q.chg || 0, bid: q.id }; break; }
    else if (q.x > FIELD.W + q.r) { w.goal = { scorer: w.flip ? 1 : 0, x: q.x, y: q.y, lastX: q.lastX, lastTeam: q.lastTeam, lastRole: q.lastRole, lastName: q.lastName, chg: q.chg || 0, bid: q.id }; break; }
  }
}

/* visión de juego 0..1: stat 1 → 0 % · stat 10 → 100 % */
/* Ojo de halcón: cada copia reduce a ~la mitad lo que te falta por ver de la trayectoria */
const visOf = (b, mult = 1) => visFrac(b.st, mult);
const visFrac = (st, mult = 1) => clamp((0.05 + 0.95 * Math.pow(clamp((st.VIS - 1) / 11, 0, 1), 2.6)) * mult, 0, 1);   // curva no lineal: 1 casi nada, 12 todo, medios intermedio
/* lanza un jugador: dir en radianes, power 0..1 */
function launch(cap, ang, power) {
  const v = cap.vmax * clamp(power, 0.05, 1);
  cap.vx = Math.cos(ang) * v; cap.vy = Math.sin(ang) * v; cap.shotNow = true; cap.shotAge = 0;
}

/* ---------- IA ---------- */
function evalAI(sim, team, shooterId) {
  const { W, H } = FIELD;
  if (sim.goal) return sim.goal.scorer === team ? 1e6 : -1e6;
  const ps = physSide(sim, team), ax = ps === 0 ? W : 0, ox = ps === 0 ? 0 : W;
  const sh = sim.bodies.find(b => b.id === shooterId);
  let sc = 0;
  for (const ball of sim.balls) {
    sc += -Math.hypot(ball.x - ax, ball.y - H / 2) * 1.0 + Math.hypot(ball.x - ox, ball.y - H / 2) * 0.55;
    const dOwn = Math.hypot(ball.x - ox, ball.y - H / 2);
    if (dOwn < 220) sc -= (220 - dOwn) * 1.6;
    if (sh) sc -= 0.25 * Math.hypot(sh.x - ball.x, sh.y - ball.y) / sim.balls.length;
  }
  return sc / sim.balls.length;
}
function simulateShot(w, capId, ang, power, team) {
  const sim = cloneWorld(w); sim.noDev = true;
  const cap = sim.bodies.find(b => b.id === capId);
  launch(cap, ang, power, 0); sim.shooterId = capId; sim.playTeam = team; sim.balls.forEach(bl => { bl.lastId = null; bl.curve = null; });
  for (let i = 0; i < 260; i++) { stepWorld(sim, 1 / 90); if (sim.goal || settled(sim)) break; }
  sim.touched = sim.events.some(e => e.t === 'ball');
  return sim;
}
/* devuelve {capId, ang, power} para el equipo `team`. level 0..1+ (más alto = mejor) */
function aiChoose(w, team, round) {
  const { W, H } = FIELD;
  let mine = w.bodies.filter(b => b.kind === 'cap' && b.team === team && !b.frozen);
  if (!mine.length) mine = w.bodies.filter(b => b.kind === 'cap' && b.team === team);
  const gx = physSide(w, team) === 0 ? W : 0;
  { const ownX = physSide(w, team) === 0 ? 0 : W, nearOwn = w.balls.some(b => Math.abs(b.x - ownX) < 230), fld = mine.filter(c => c.role !== 'POR'); if (fld.length && !nearOwn) mine = fld; }   // el portero no se mueve de su portería salvo que el balón esté pegado a ella
  const ball = w.balls.reduce((a, b) => Math.abs(b.x - gx) < Math.abs(a.x - gx) ? b : a);
  const ux = gx - ball.x, uy = H / 2 - ball.y, ul = Math.hypot(ux, uy) || 1;
  const cands = [];
  for (const c of mine) {
    const angs = [];
    const toBall = Math.atan2(ball.y - c.y, ball.x - c.x);
    const px = ball.x - ux / ul * (ball.r + c.r - 3), py = ball.y - uy / ul * (ball.r + c.r - 3);
    const toP = Math.atan2(py - c.y, px - c.x);
    [0, -0.07, 0.07].forEach(o => { angs.push(toBall + o); angs.push(toP + o); });
    // tiros a la portería rival esquivando
    angs.push(Math.atan2(H / 2 - c.y, gx - c.x));
    angs.push(Math.random() * Math.PI * 2);
    for (const a of angs) for (const p of [0.6, 1]) cands.push({ capId: c.id, ang: a, power: p });
  }
  let best = null;
  const scored = [];
  for (const cd of cands) {
    const sim = simulateShot(w, cd.capId, cd.ang, cd.power, team);
    cd.score = evalAI(sim, team, cd.capId) - (sim.touched ? 0 : 5000) + Math.random() * (round < 2 ? 160 : round < 4 ? 70 : 20);
    scored.push(cd);
  }
  scored.sort((a, b) => b.score - a.score);
  best = scored[0];
  if (round < 1 && Math.random() < 0.35) best = pick(scored.slice(0, 6));
  // errores humanos: más al principio
  const sigma = Math.max(0.4, 7 - round * 1.1) * Math.PI / 180;
  return { capId: best.capId, ang: best.ang + gauss() * sigma, power: clamp(best.power * (1 + gauss() * 0.05), 0.2, 1) };
}

/* trayectoria de apuntado: simula el jugador hasta el contacto y luego el recorrido del balón golpeado.
   devuelve la parte visible según la visión de juego (vis 0..1) */
function aimPath(w, capId, ang, power, vis) {
  const sim = cloneWorld(w); sim.noDev = true;
  const cap = sim.bodies.find(b => b.id === capId);
  launch(cap, ang, power); sim.shooterId = capId; sim.balls.forEach(bl => { bl.lastId = null; bl.curve = null; });
  const capPts = [[cap.x, cap.y]], ballPts = [];
  let hit = null, tb = null;
  for (let i = 0; i < 900; i++) {
    stepWorld(sim, 1 / 120);
    if (!hit) {
      if (i % 3 === 0) capPts.push([cap.x, cap.y]);
      // solo cuentan los choques del jugador que tira (no los de balones entre sí); si toca varios balones a la vez, el más cercano a la recta del tiro
      const evs = sim.events.filter(e => (e.t === 'ball' || e.t === 'cap') && (e.a === capId || e.b === capId));
      let ev = evs[0];
      if (evs.length > 1) {
        const dirx = Math.cos(ang), diry = Math.sin(ang);
        let bd = 1e9; evs.forEach(e => { const oid = e.a === capId ? e.b : e.a, o = sim.bodies.find(q => q.id === oid); if (!o) return; const d = e.t === 'ball' ? Math.abs((o.x - cap.x) * diry - (o.y - cap.y) * dirx) : 1e8; if (d < bd) { bd = d; ev = e; } });
      }
      if (ev) {
        const isBall = ev.t === 'ball', bid = isBall ? (ev.a === capId ? ev.b : ev.a) : -1;
        tb = isBall ? sim.bodies.find(b => b.id === bid) : null;
        hit = { x: cap.x, y: cap.y, ball: isBall };
        capPts.push([cap.x, cap.y]);
        if (tb) ballPts.push([tb.x, tb.y]);
        else break;
      }
    } else if (tb) {
      if (i % 3 === 0) ballPts.push([tb.x, tb.y]);
      if (sim.goal) break;
    }
    if (!hit && !cap.vx && !cap.vy) break;
    if (hit && tb && settled(sim)) break;
  }
  const pl = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
  const Lc = pl(capPts), Lb = pl(ballPts);
  const cut = (pts, L) => { if (L <= 0) return []; const out = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc + d >= L) { const f = (L - acc) / (d || 1); out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]); return out; } acc += d; out.push(pts[i]); } return out; };
  const capVis = cut(capPts, Math.min(Lc, 520));
  const ballVis = ballPts.length > 1 ? cut(ballPts, Math.min(Lb, Math.max(60, Lb * vis))) : [];
  return { pts: capVis, ballPts: ballVis, hit, full: vis >= 0.999 };
}

/* ---------- campos y porterías (cambio en pleno partido) ---------- */
function applyField(w, field) {
  clearField(w); w.field = field;
  if (field === 'hielo') w.fdec = 0.26;
  if (field === 'barro') {
    w.fdec = 1.45; w.mud = [];
    for (let k = 0; k < 40 && w.mud.length < 5; k++) {
      const z = { x: 170 + Math.random() * 660, y: 90 + Math.random() * 460, r: 52 + Math.random() * 26 };
      if (w.mud.every(o => Math.hypot(o.x - z.x, o.y - z.y) > o.r + z.r + 20)) w.mud.push(z);
    }
  }
  if (field === 'tilt') newTilt(w);
  if (field === 'iman') w.pull = 150;
  if (field === 'espacio') { w.pull = -150; w.fdec = 0.7; }
  if (field === 'niebla') w.fog = true;
  if (field === 'ensueno') w.dream = true;
  if (field === 'oscuro') w.dark = true;
  if (field === 'lluvia') {   // pocos charcos pequeños: el balón se moja y se frena un poco
    w.rain = true; w.fdec = 1.06; w.pud = [];
    // 4 charcos: 2 en cada mitad, con los mismos tamaños (uno grande y uno pequeño por mitad)
    const rs = Math.random() < 0.5 ? [46, 26] : [26, 46];
    [0, 1].forEach(half => rs.forEach(r => {
      for (let k = 0; k < 80; k++) {
        const z = { x: (half ? 540 : 190) + Math.random() * 270, y: 100 + Math.random() * 440, r };
        if (Math.hypot(z.x - FIELD.W / 2, z.y - FIELD.H / 2) > r + 70 && w.pud.every(o => Math.hypot(o.x - z.x, o.y - z.y) > o.r + z.r + 50)) { w.pud.push(z); break; }
      }
    }));
  }
  if (field === 'jurasico') w.jura = true;
  if (field === 'playa') {   // sombrillas: solo visuales, tapan lo que haya debajo
    w.fdec = 1.22; w.umb = [];
    for (let k = 0; k < 60 && w.umb.length < 4; k++) {
      const z = { x: 140 + Math.random() * 720, y: 90 + Math.random() * 460, r: 62 + Math.random() * 22, c: w.umb.length % 2 };
      if (w.umb.every(o => Math.hypot(o.x - z.x, o.y - z.y) > o.r + z.r + 30)) w.umb.push(z);
    }
  }
  if (field === 'pinball') { w.bumpers = [[300, 320, 26], [700, 320, 26], [500, 150, 26], [500, 490, 26]]; avoidBumpers(w); }
}
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
/* separa los jugadores de los bumpers del pinball (y fija su posición base) */
function avoidBumpers(w) {
  if (!w.bumpers) return;
  const push = (b, kx, ky) => {
    for (let it = 0; it < 6; it++) {
      w.bumpers.forEach(p => {
        const dx = b[kx] - p[0], dy = b[ky] - p[1], d = Math.hypot(dx, dy) || 0.01, need = b.r + p[2] + 10;
        if (d < need) { b[kx] = p[0] + dx / d * need; b[ky] = p[1] + (d < 0.02 ? need : dy / d * need); }
      });
      b[kx] = clamp(b[kx], b.r + 6, FIELD.W - b.r - 6); b[ky] = clamp(b[ky], b.r + 6, FIELD.H - b.r - 6);
    }
  };
  w.bodies.forEach(b => { if (b.kind === 'cap') { if (b.hx == null) { b.hx = b.x; b.hy = b.y; } push(b, 'x', 'y'); push(b, 'hx', 'hy'); } });
}
/* ensueño: las porterías suben y bajan despacio (cada una a su ritmo) */
function moveGoals(w, dt) {
  if (!w.dream) return;
  w.gt = (w.gt || 0) + dt;
  w.goff = [105 * Math.sin(w.gt * 0.55), 105 * Math.sin(w.gt * 0.55 + 2.4)];
  setGoalWidths(w, w.gwL, w.gwR);
}
function setGoalWidths(w, gwL, gwR) {
  w.gwL = gwL; w.gwR = gwR;
  const geo = buildSegs(gwL, gwR, w.goff);
  w.geo = geo; w.segs = geo.segs; w.posts = geo.posts;
  w.lines = [[0, geo.lt, 0, geo.lb], [FIELD.W, geo.rt, FIELD.W, geo.rb]];
}
