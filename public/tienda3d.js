/* Supermercado virtual 3D — Minimercado Luz de María
   Los productos, precios y stock vienen del catálogo publicado desde la app de inventario. */
import * as THREE from 'three';

// =====================================================================
// Utilidades
// =====================================================================
const $ = s => document.querySelector(s);
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const TITLE_FONT = '"Fredoka","Nunito",system-ui,sans-serif';
const V3 = THREE.Vector3;

let CAT = null;                 // catálogo
const P = new Map();            // id -> producto
let cart = {};                  // id -> cantidad

function money(n) {
  const d = CAT?.store?.decimals === 2 ? 2 : 0;
  return (CAT?.store?.currency || '$') + ' ' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
}
const qtyTxt = (q, unit) => unit === 'kg' ? Number(q).toLocaleString('es', { maximumFractionDigits: 2 }) + ' kg' : String(q);

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// =====================================================================
// Íconos, colores y forma física de cada producto
// =====================================================================
const ICON_RULES = [
  [/papas? fritas|chips/, '🍟'], [/leche condensada/, '🥫'], [/panal/, '👶'], [/helado|paleta/, '🍦'],
  [/arroz/, '🍚'], [/fideo|spaghetti|tallarin|corbata|espiral/, '🍝'], [/aceite/, '🫒'], [/\bsal\b/, '🧂'],
  [/azucar/, '🍯'], [/harina/, '🌾'], [/\bte\b/, '🍵'], [/cafe/, '☕'], [/mayonesa|ketchup|salsa|mostaza/, '🥫'],
  [/atun|jurel|sardina|pescado/, '🐟'], [/manjar|miel/, '🍯'], [/mermelada/, '🍓'], [/avena|cereal|granola/, '🥣'],
  [/\bpan\b|pan de molde/, '🍞'], [/galleta|alfajor/, '🍪'], [/caldo|sopa/, '🍜'], [/pure/, '🥔'],
  [/oregano|comino|aji|especia|perejil|cilantro|apio/, '🌿'], [/vinagre/, '🍶'],
  [/lenteja|poroto|garbanzo|arveja/, '🫘'], [/\bmani\b/, '🥜'], [/quinoa|mote|chuchoca|trigo/, '🌾'],
  [/cabrita|maiz|choclo/, '🌽'], [/chupetin|chupete/, '🍭'], [/chicle|caramelo|pastilla|gomita/, '🍬'],
  [/chocolate|oblea|bombon/, '🍫'], [/snack/, '🌽'], [/marshmallow|malvavisco/, '🍡'],
  [/tocino/, '🥓'], [/longaniza|chorizo|vienesa|salchicha/, '🌭'], [/hamburguesa/, '🍔'],
  [/cerdo|costillar|chuleta|pulpa/, '🍖'], [/pollo|pechuga|trutro|alita|nugget|menudencia/, '🍗'],
  [/carne|posta|lomo|asiento|osobuco|vacuno/, '🥩'], [/\bpapa\b/, '🥔'], [/cebolla/, '🧅'], [/tomate/, '🍅'],
  [/zanahoria/, '🥕'], [/zapallo italiano|pepino/, '🥒'], [/zapallo/, '🎃'], [/limon/, '🍋'], [/palta/, '🥑'],
  [/platano/, '🍌'], [/manzana/, '🍎'], [/naranja/, '🍊'], [/pera\b/, '🍐'], [/uva/, '🍇'], [/frutilla/, '🍓'],
  [/lechuga|repollo/, '🥬'], [/pimenton/, '🫑'], [/\bajo\b/, '🧄'], [/betarraga/, '🍠'],
  [/yogur/, '🥛'], [/mantequilla|margarina/, '🧈'], [/queso|quesillo/, '🧀'], [/jamon/, '🍖'], [/huevo/, '🥚'],
  [/leche|crema/, '🥛'], [/jugo|nectar/, '🧃'], [/agua/, '💧'], [/bebida|cola|energetica|gaseosa/, '🥤'],
  [/cerveza/, '🍺'], [/vino/, '🍷'], [/papel|toalla de papel|servilleta/, '🧻'], [/esponja/, '🧽'],
  [/jabon/, '🧼'], [/pasta dental|cepillo/, '🪥'], [/basura/, '🗑️'],
  [/detergente|suavizante|lavaloza|cloro|limpiador|shampoo|desodorante/, '🧴'],
  [/fosforo|encendedor|carbon/, '🔥'], [/vela/, '🕯️'], [/pila/, '🔋'], [/hielo/, '🧊']
];
const CATEGORY_ICON = {
  'abarrotes': '🥫', 'legumbres y granos': '🫘', 'golosinas': '🍭', 'carnes': '🥩', 'pollo': '🍗',
  'verduras y frutas': '🥬', 'lacteos y huevos': '🥛', 'bebidas': '🥤', 'aseo y limpieza': '🧴', 'otros': '🛍️'
};
const CATEGORY_COLOR = {
  'abarrotes': '#f4a259', 'legumbres y granos': '#b5838d', 'golosinas': '#f06595', 'carnes': '#e63946',
  'pollo': '#f4a261', 'verduras y frutas': '#52b788', 'lacteos y huevos': '#74c0fc', 'bebidas': '#4dabf7',
  'aseo y limpieza': '#9775fa', 'otros': '#adb5bd'
};
function iconFor(p) {
  if (p.emoji) return p.emoji;
  const n = norm(p.name);
  for (const [re, ic] of ICON_RULES) if (re.test(n)) return ic;
  return CATEGORY_ICON[norm(p.category)] || '🛒';
}
const catIcon = c => CATEGORY_ICON[norm(c)] || '🛒';
function catColor(c) {
  if (CATEGORY_COLOR[norm(c)]) return CATEGORY_COLOR[norm(c)];
  let h = 0;
  for (const ch of String(c)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return '#' + new THREE.Color().setHSL((Math.abs(h) % 360) / 360, 0.55, 0.58).getHexString();
}
const colorFor = p => p.color || catColor(p.category);
function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(f < 0 ? '#000000' : '#ffffff'), Math.abs(f));
  return '#' + c.getHexString();
}

// Zona del local según la categoría
function zoneOf(cat) {
  const n = norm(cat);
  if (/verdura|fruta|hortaliza/.test(n)) return 'produce';
  if (/carne|pollo|pescad|marisco|carniceria/.test(n)) return 'meat';
  if (/lacteo|bebida|helado|congelad|refriger|fiambre/.test(n)) return 'fridge';
  return 'shelf';
}

// Forma física del envase
const SHAPE_RULES = [
  [/jugo en polvo|galleta/, 'box'],
  [/bebida en lata|\blata\b|energetica/, 'can'],
  [/atun|jurel|sardina|leche condensada/, 'canFlat'],
  [/papas? fritas|snack|gomita|\bmani\b|marshmallow|caramelo/, 'bagSmall'],
  [/laminad|queso|jamon/, 'tray'],
  [/nectar|leche|crema/, 'carton'],
  [/bebida|cola|\bagua\b|aceite|vinagre|jugo|cloro|shampoo|liquido|lavaloza|suavizante|limpiador|cerveza|vino|yogur 1 l/, 'bottle'],
  [/yogur|quesillo/, 'cup'],
  [/mayonesa|ketchup|manjar|mermelada|cafe|mantequilla|margarina|miel/, 'jar'],
  [/papel higienico|toalla|panal|bolsas de basura/, 'pack'],
  [/arroz|azucar|harina|fideo|lenteja|poroto|garbanzo|arveja|mote|quinoa|chuchoca|maiz|cabrita|carbon|hielo|\bsal\b|avena|pan de molde|pure|nugget|hamburguesa|vienesa|detergente en polvo/, 'bag'],
  [/huevos bandeja/, 'eggs'],
  [/\bte\b|caldo|levadura|polvo|fosforo|pila|vela|chicle|pastilla|chupetin|alfajor|barra|oblea|chocolate pequeno|oregano|comino|aji|jabon|pasta dental|cepillo|desodorante|esponja|encendedor|huevos \(unidad\)|sopa|salsa de tomate/, 'small']
];
function shapeOf(p) {
  const n = norm(p.name);
  for (const [re, s] of SHAPE_RULES) if (re.test(n)) return s;
  return 'box';
}
function dims(p, shape) {
  const n = norm(p.name);
  const big = /1 ?kg|1 ?l\b|3 ?l|1,5|1,6|2,5 ?kg|3 ?kg/.test(n);
  switch (shape) {
    case 'small': return { w: 0.1, h: 0.12, d: 0.05 };
    case 'bag': return big ? { w: 0.19, h: 0.29, d: 0.09 } : { w: 0.15, h: 0.22, d: 0.07 };
    case 'bagSmall': return /150|grande/.test(n) ? { w: 0.2, h: 0.28, d: 0.07 } : { w: 0.13, h: 0.17, d: 0.05 };
    case 'pack': return { w: 0.26, h: 0.3, d: 0.2 };
    case 'carton': return /200|125|250/.test(n) ? { w: 0.06, h: 0.11, d: 0.045 } : { w: 0.075, h: 0.2, d: 0.075 };
    case 'tray': return { w: 0.24, h: 0.05, d: 0.17 };
    case 'eggs': return { w: 0.3, h: 0.08, d: 0.3 };
    case 'bottle': return /3 ?l/.test(n) ? { r: 0.058, h: 0.36 } : /(1,5|1,6|1 ?l|2 ?l)/.test(n) ? { r: 0.046, h: 0.31 } : { r: 0.034, h: 0.22 };
    case 'can': return { r: 0.033, h: 0.12 };
    case 'canFlat': return { r: 0.043, h: 0.05 };
    case 'jar': return { r: 0.042, h: 0.11 };
    case 'cup': return { r: 0.034, h: 0.065 };
    default: return { w: 0.19, h: 0.27, d: 0.07 };
  }
}
const widthOf = d => d.w ?? d.r * 2;
// Frentes (unidades visibles lado a lado). m = multiplicador para llenar la repisa
function facingsOf(p, m = 1) {
  const base = p.stock <= 0 ? 0 : p.stock >= 8 ? 3 : p.stock >= 3 ? 2 : 1;
  return base ? Math.min(Math.max(1, Math.floor(p.stock)), base * m, 9) : 0;
}

// =====================================================================
// Texturas dibujadas con canvas
// =====================================================================
const texCache = new Map();
let maxAniso = 4;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function toTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1);
    cut[maxLines - 1] = last + '…';
    return cut;
  }
  return lines;
}
function drawEmoji(ctx, em, x, y, size) {
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(em, x, y);
}
function drawContain(ctx, img, x, y, w, h) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// Etiqueta / envase del producto. wrap=true para latas y botellas (la textura rodea el envase)
function packageTexture(p, wrap) {
  const W = wrap ? 512 : 256, H = 256;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const base = colorFor(p);
  const draw = img => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(base, 0.12));
    g.addColorStop(1, shade(base, -0.28));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // franjas decorativas
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(0, 18, W, 8);
    ctx.fillRect(0, H - 30, W, 6);
    const lx = wrap ? 136 : 18, lw = wrap ? 240 : 220;
    ctx.fillStyle = '#fffaf2';
    roundRect(ctx, lx, 40, lw, 140, 22);
    ctx.fill();
    if (img) drawContain(ctx, img, lx + 8, 46, lw - 16, 128);
    else drawEmoji(ctx, iconFor(p), lx + lw / 2, 112, 96);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 21px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const lines = wrapLines(ctx, p.name, lw + 10, 2);
    lines.forEach((l, i) => ctx.fillText(l, lx + lw / 2, 205 + i * 22 - (lines.length - 1) * 4));
  };
  draw(null);
  const t = toTex(c);
  if (p.photo) {
    const img = new Image();
    img.onload = () => { draw(img); t.needsUpdate = true; markDirty(); };
    img.src = p.photo;
  }
  return t;
}

// Bandeja de carne / cajón de verduras: el producto "a granel" visto desde arriba
function pileTexture(p, kind) {
  const W = 256, H = 150;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const out = p.stock <= 0;
  ctx.fillStyle = kind === 'tray' ? '#f7f7f4' : '#6b4423';
  ctx.fillRect(0, 0, W, H);
  if (kind === 'tray') {
    ctx.fillStyle = '#e9ecef';
    roundRect(ctx, 8, 8, W - 16, H - 16, 16); ctx.fill();
  }
  if (!out) {
    const em = iconFor(p);
    let seed = [...p.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const cols = kind === 'tray' ? 3 : 5, rows = kind === 'tray' ? 2 : 3;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const x = (k + 0.5 + (rnd() - 0.5) * 0.4) * W / cols;
      const y = (r + 0.55 + (rnd() - 0.5) * 0.3) * H / rows;
      drawEmoji(ctx, em, x, y, kind === 'tray' ? 62 : 54);
    }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(0, 0, W, H);
  }
  return toTex(c);
}

// Etiqueta de precio del borde de la repisa
function priceTagTexture(p) {
  const c = canvas(200, 84), ctx = c.getContext('2d');
  const out = p.stock <= 0;
  ctx.fillStyle = out ? '#e4572e' : '#f2b134';
  roundRect(ctx, 0, 0, 200, 84, 10); ctx.fill();
  ctx.fillStyle = out ? '#fff' : '#3d2a00';
  ctx.textAlign = 'center';
  ctx.font = `700 15px ${TITLE_FONT}`;
  ctx.fillText(wrapLines(ctx, p.name, 186, 1)[0], 100, 22);
  ctx.font = `700 ${out ? 30 : 34}px ${TITLE_FONT}`;
  ctx.fillText(out ? 'AGOTADO' : money(p.price) + (p.unit === 'kg' ? '/kg' : ''), 100, 66);
  return toTex(c);
}

// Letrero de categoría
function signTexture(text, emoji, color, w = 1024, h = 180) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = color;
  roundRect(ctx, 0, 0, w, h, 28); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(0, h - 22, w, 10);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  let size = Math.round(h * 0.5);
  ctx.font = `700 ${size}px ${TITLE_FONT}`;
  const tw = () => ctx.measureText(text).width + (emoji ? size * 1.3 : 0);
  while (tw() > w - 60 && size > 20) { size -= 4; ctx.font = `700 ${size}px ${TITLE_FONT}`; }
  const total = tw();
  let x = (w - total) / 2;
  if (emoji) { drawEmoji(ctx, emoji, x + size * 0.55, h / 2, size); x += size * 1.3; ctx.font = `700 ${size}px ${TITLE_FONT}`; }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, h / 2 + 2);
  return toTex(c);
}

function floorTexture() {
  const c = canvas(256, 256), ctx = c.getContext('2d');
  ctx.fillStyle = '#efe6d6'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#e2d5bf'; ctx.fillRect(0, 0, 128, 128); ctx.fillRect(128, 128, 128, 128);
  ctx.strokeStyle = 'rgba(120,90,50,.18)'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 128, 128); ctx.strokeRect(128, 128, 128, 128); ctx.strokeRect(128, 0, 128, 128); ctx.strokeRect(0, 128, 128, 128);
  return toTex(c, [13, 17]);
}
function wallTexture() {
  const c = canvas(256, 512), ctx = c.getContext('2d');
  ctx.fillStyle = '#fbf3e6'; ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = '#2f8f46'; ctx.fillRect(0, 300, 256, 26);
  ctx.fillStyle = '#f2b134'; ctx.fillRect(0, 326, 256, 8);
  ctx.fillStyle = '#e9dcc6'; ctx.fillRect(0, 334, 256, 178);
  ctx.strokeStyle = 'rgba(120,90,50,.15)';
  for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 334); ctx.lineTo(x, 512); ctx.stroke(); }
  return toTex(c, [8, 1]);
}
function woodTexture() {
  const c = canvas(128, 64), ctx = c.getContext('2d');
  ctx.fillStyle = '#c8955b'; ctx.fillRect(0, 0, 128, 64);
  for (let y = 0; y < 64; y += 16) {
    ctx.fillStyle = y % 32 ? '#b98448' : '#d4a46b';
    ctx.fillRect(0, y, 128, 14);
    ctx.fillStyle = 'rgba(80,40,10,.35)'; ctx.fillRect(0, y + 14, 128, 2);
  }
  return toTex(c);
}

// =====================================================================
// Escena
// =====================================================================
let renderer, scene, camera;
let dirty = true;
const markDirty = () => { dirty = true; };
const pickables = [];          // mallas que se pueden tocar (userData.pid)
const prodObj = new Map();     // id -> { mats:[], pos: V3 (mundo), n: V3 (mundo) }
const catView = new Map();     // categoría -> { pos, n }
const obstacles = [];          // cajas en planta {x0,z0,x1,z1}
const mapRects = [];           // para el mapa
const matCache = new Map();
let ROOM = { x0: -10, x1: 10, z0: -12, z1: 12, h: 4 };   // se ajusta a la cantidad de productos

function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
function box(parent, w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function plane(parent, w, h, material, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  parent.add(m);
  return m;
}
// Grupo orientado: x local = a lo largo del mueble, z local = hacia el cliente
function frameGroup(o, n) {
  const g = new THREE.Group();
  g.position.copy(o);
  g.rotation.y = Math.atan2(n.x, n.z);
  scene.add(g);
  g.updateMatrixWorld();
  return g;
}
function addObstacleFromLocal(g, x0, x1, z0, z1, color) {
  g.updateMatrixWorld();
  const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => g.localToWorld(new V3(x, 0, z)));
  const r = { x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)), z0: Math.min(...pts.map(p => p.z)), z1: Math.max(...pts.map(p => p.z)) };
  obstacles.push(r);
  mapRects.push({ ...r, color });
}

function initRenderer() {
  const cv = $('#scene');
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6efe3');
  scene.fog = new THREE.Fog('#f6efe3', 16, 42);
  camera = new THREE.PerspectiveCamera(window.innerWidth < 700 ? 78 : 70, window.innerWidth / window.innerHeight, 0.05, 80);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcdb89a, 2.4));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(4, 10, 6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-6, 5, -8);
  scene.add(fill);
}

function buildRoom() {
  const { x0, x1, z0, z1, h } = ROOM;
  const W = x1 - x0, D = z1 - z0;
  const ftex = floorTexture();
  ftex.repeat.set(W / 2, D / 2);
  const floor = plane(scene, W, D, new THREE.MeshLambertMaterial({ map: ftex }), 0, 0, 0, -Math.PI / 2);
  floor.userData.floor = true;
  pickables.push(floor);
  plane(scene, W, D, mat('#fbf8f2'), 0, h, 0, Math.PI / 2);
  const wtD = wallTexture(); wtD.repeat.set(D / 3, 1);
  const wtW = wallTexture(); wtW.repeat.set(W / 3, 1);
  const wallD = new THREE.MeshLambertMaterial({ map: wtD }), wallMat = new THREE.MeshLambertMaterial({ map: wtW });
  // pared izquierda, derecha y fondo
  const left = plane(scene, D, h, wallD, x0, h / 2, 0); left.rotation.y = Math.PI / 2;
  const right = plane(scene, D, h, wallD, x1, h / 2, 0); right.rotation.y = -Math.PI / 2;
  plane(scene, W, h, wallMat, 0, h / 2, z0);
  // pared del frente con la puerta
  const front = new THREE.Group(); scene.add(front);
  const fw = (W - 4) / 2;
  const fl = plane(front, fw, h, wallMat, x0 + fw / 2, h / 2, z1); fl.rotation.y = Math.PI;
  const fr = plane(front, fw, h, wallMat, x1 - fw / 2, h / 2, z1); fr.rotation.y = Math.PI;
  const top = plane(front, 4, 1.2, mat('#fbf3e6'), 0, h - 0.6, z1); top.rotation.y = Math.PI;
  const glass = new THREE.MeshLambertMaterial({ color: '#cfe8f3', transparent: true, opacity: 0.35, depthWrite: false });
  box(front, 1.9, 2.75, 0.04, glass, -0.98, 1.4, z1 - 0.02);
  box(front, 1.9, 2.75, 0.04, glass, 0.98, 1.4, z1 - 0.02);
  box(front, 4.1, 0.1, 0.12, '#2f8f46', 0, 2.82, z1 - 0.05);
  box(front, 2.6, 0.01, 1.4, '#7a4a2a', 0, 0.006, z1 - 1.0); // alfombra de entrada
  // luces de techo
  const lightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (let x = x0 + 2.5; x <= x1 - 2; x += 4) for (let z = z0 + 2; z <= z1 - 1.5; z += 3.5) {
    plane(scene, 1.6, 0.35, lightMat, x, h - 0.01, z, Math.PI / 2);
  }
  // gran letrero del fondo
  const name = CAT.store.name || 'Minimercado';
  const sw = Math.min(9, W - 4);
  plane(scene, sw, sw * 170 / 1400, new THREE.MeshBasicMaterial({ map: signTexture(name, '🧺', '#2f8f46', 1400, 170) }), 0, 3.45, z0 + 0.03);
  mapRects.push({ x0: -2, x1: 2, z0: z1 - 0.2, z1: z1, color: '#cfe8f3' });
}

// =====================================================================
// Distribución del local
// =====================================================================
const LEVELS_SHELF = [0.14, 0.56, 0.98, 1.4, 1.82];
const LEVELS_FRIDGE = [0.22, 0.6, 0.98, 1.36, 1.74];

function groupProducts() {
  const order = CAT.categories || [];
  const map = new Map();
  [...P.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach(p => {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category).push(p);
  });
  const cats = [...map.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
  });
  return cats.map(c => ({ name: c, items: map.get(c), zone: zoneOf(c), color: catColor(c) }));
}

const needOf = (p, m = 1) => {
  const f = facingsOf(p, m);
  return f ? f * (widthOf(dims(p, shapeOf(p))) + 0.014) + 0.04 : 0.2;
};

// Simula el llenado de repisas de izquierda a derecha, de arriba hacia abajo
function fits(items, width, levels, m = 1) {
  let li = levels - 1, x = 0.06;
  for (const p of items) {
    const need = needOf(p, m);
    if (need > width - 0.1) return false;
    if (x + need > width - 0.04) { li--; x = 0.06; if (li < 0) return false; }
    x += need;
  }
  return true;
}
function segmentWidth(items, levels) {
  const total = items.reduce((s, p) => s + needOf(p), 0);
  let w = Math.max(1.2, total / levels * 1.12 + 0.25);
  while (!fits(items, w, levels) && w < 40) w += 0.25;
  return Math.ceil(w * 4) / 4;
}
// Mayor multiplicador de frentes que cabe: repisas llenas como en un súper real
function bestMult(items, width, levels) {
  for (let m = 4; m > 1; m--) if (fits(items, width, levels, m)) return m;
  return 1;
}

// Coloca productos en repisas dentro de un mueble (coordenadas locales del grupo)
function fillShelves(g, items, a0, width, levels, zItem, zTag) {
  // 1) Repartir los productos en todas las repisas, con un largo parecido en cada una
  const L = levels.length, nRows = Math.min(L, items.length);
  const total = items.reduce((s, p) => s + needOf(p), 0), target = total / nRows;
  const bal = [];
  let cur = [], acc = 0;
  items.forEach((p, i) => {
    cur.push(p); acc += needOf(p);
    const leftItems = items.length - i - 1, leftRows = nRows - bal.length - 1;
    if (leftRows > 0 && (acc >= target || leftItems === leftRows)) { bal.push(cur); cur = []; acc = 0; }
  });
  if (cur.length) bal.push(cur);
  const usable = width - 0.12;
  if (bal.every(r => r.reduce((s, p) => s + needOf(p), 0) <= usable)) {
    const order = nRows === L ? bal.map((_, i) => L - 1 - i) : [L - 2, L - 3, L - 1, L - 4, L - 5].filter(i => i >= 0);
    bal.forEach((r, i) => {
      // 2) Repetir frentes hasta llenar la repisa
      let rm = 6;
      while (rm > 1 && r.reduce((s, p) => s + needOf(p, rm), 0) > usable) rm--;
      const used = r.reduce((s, p) => s + needOf(p, rm), 0);
      const extra = Math.max(0, (usable - used) / r.length);
      let cx = a0 + 0.06;
      for (const p of r) {
        const need = needOf(p, rm);
        placeProduct(g, p, cx + extra / 2, levels[order[i]], zItem, zTag, need, rm);
        cx += need + extra;
      }
    });
    return;
  }
  // Repisas muy cargadas: llenado corrido de arriba hacia abajo
  const m = bestMult(items, width, levels.length);
  // reparte el espacio sobrante entre los productos de cada repisa
  const rows = [];
  let row = [], x = 0.06;
  for (const p of items) {
    const need = needOf(p, m);
    if (x + need > width - 0.04 && row.length) { rows.push(row); row = []; x = 0.06; }
    row.push({ p, need });
    x += need;
  }
  if (row.length) rows.push(row);
  rows.slice(0, levels.length).forEach((r, i) => {
    const li = levels.length - 1 - i;
    const used = r.reduce((s, it) => s + it.need, 0);
    const extra = rows.length > 1 || i > 0 ? Math.max(0, (width - 0.12 - used) / r.length) : Math.min(0.08, Math.max(0, (width - 0.12 - used) / r.length));
    let cx = a0 + 0.06;
    for (const it of r) {
      placeProduct(g, it.p, cx + extra / 2, levels[li], zItem, zTag, it.need, m);
      cx += it.need + extra;
    }
  });
}

function productParts(p) {
  const shape = shapeOf(p), d = dims(p, shape);
  const base = colorFor(p);
  const side = mat(shade(base, -0.12)), top = mat(shade(base, 0.2));
  const parts = [];
  const mats = [];
  if (d.w) {
    const front = new THREE.MeshLambertMaterial({ map: packageTexture(p, false) });
    mats.push(front);
    const back = shape === 'bag' || shape === 'bagSmall' ? front : side;
    parts.push({ geo: new THREE.BoxGeometry(d.w, d.h, d.d), mat: [side, side, top, side, front, back], y: d.h / 2 });
    if (shape === 'bag' || shape === 'bagSmall') {
      parts.push({ geo: new THREE.BoxGeometry(d.w * 1.02, d.h * 0.06, d.d * 0.4), mat: top, y: d.h * 1.0 }); // cierre de la bolsa
    }
  } else {
    const label = new THREE.MeshLambertMaterial({ map: packageTexture(p, true) });
    mats.push(label);
    const n = norm(p.name);
    if (shape === 'bottle') {
      const tint = /agua/.test(n) ? '#bfe3f7' : /cola/.test(n) ? '#3a1d12' : /naranja/.test(n) ? '#f39c12'
        : /aceite/.test(n) ? '#e9c46a' : /vinagre/.test(n) ? '#efe2b8' : /yogur|leche/.test(n) ? '#ffffff' : shade(base, 0.25);
      const glassy = mat(tint);
      const cap = mat(shade(base, -0.2));
      const r = d.r, h = d.h;
      parts.push({ geo: new THREE.CylinderGeometry(r, r, h * 0.62, 20, 1, false, Math.PI, Math.PI * 2), mat: [label, glassy, glassy], y: h * 0.31 });
      parts.push({ geo: new THREE.CylinderGeometry(r * 0.4, r, h * 0.2, 20, 1, true), mat: glassy, y: h * 0.72 });
      parts.push({ geo: new THREE.CylinderGeometry(r * 0.36, r * 0.38, h * 0.11, 14, 1, true), mat: glassy, y: h * 0.875 });
      parts.push({ geo: new THREE.CylinderGeometry(r * 0.42, r * 0.42, h * 0.07, 14), mat: cap, y: h * 0.965 });
    } else {
      const metal = shape === 'can' || shape === 'canFlat' ? mat('#c9ced3') : top;
      parts.push({ geo: new THREE.CylinderGeometry(d.r, d.r, d.h, 22, 1, false, Math.PI, Math.PI * 2), mat: [label, metal, metal], y: d.h / 2 });
      if (shape === 'jar') parts.push({ geo: new THREE.CylinderGeometry(d.r * 1.04, d.r * 1.04, d.h * 0.16, 22), mat: mat(shade(base, -0.25)), y: d.h * 1.06 });
    }
  }
  return { parts, mats, d, shape };
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new V3();
function placeProduct(g, p, x, y, zItem, zTag, need, m = 1) {
  const f = facingsOf(p, m);
  const reg = registerProduct(p);
  if (f > 0) {
    const { parts, mats, d } = productParts(p);
    const w = widthOf(d) + 0.014;
    const sc = d.h > 0.38 ? 0.38 / d.h : 1;
    let seed = [...p.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const jitter = () => (((seed = (seed * 9301 + 49297) % 233280) / 233280) - 0.5);
    const rots = Array.from({ length: f }, () => jitter() * 0.12);
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, f);
      for (let k = 0; k < f; k++) {
        tmpE.set(0, rots[k], 0);
        tmpQ.setFromEuler(tmpE);
        tmpS.set(sc, sc, sc);
        tmpM.compose(new V3(x + 0.02 + w * (k + 0.5), y + part.y * sc, zItem), tmpQ, tmpS);
        im.setMatrixAt(k, tmpM);
      }
      im.userData.pid = p.id;
      g.add(im);
      pickables.push(im);
    }
    reg.mats.push(...mats);
  }
  // etiqueta de precio
  const tag = plane(g, Math.min(0.17, Math.max(0.1, need - 0.02)), 0.068, new THREE.MeshLambertMaterial({ map: priceTagTexture(p) }), x + need / 2, y - 0.036, zTag);
  tag.userData.pid = p.id;
  pickables.push(tag);
  reg.mats.push(tag.material);
  g.updateMatrixWorld();
  reg.pos = g.localToWorld(new V3(x + need / 2, y + 0.12, zItem));
  reg.n = new V3(0, 0, 1).transformDirection(g.matrixWorld);
}
function registerProduct(p) {
  if (!prodObj.has(p.id)) prodObj.set(p.id, { mats: [], pos: new V3(), n: new V3(0, 0, 1) });
  return prodObj.get(p.id);
}
function registerCategory(g, name, a, width, y, z, dist = 1.8) {
  g.updateMatrixWorld();
  catView.set(name, { pos: g.localToWorld(new V3(a + width / 2, y, z)), n: new V3(0, 0, 1).transformDirection(g.matrixWorld), dist });
}
function categorySign(g, name, color, a, width, y, z, height = 0.3) {
  const w = Math.min(width - 0.1, 3.2);
  const ratio = w / height;
  const tex = signTexture(name, catIcon(name), color, Math.round(180 * ratio), 180);
  plane(g, w, height, new THREE.MeshBasicMaterial({ map: tex }), a + width / 2, y, z);
}

// ---------- Plan del local ----------
const GZ0 = -7.6, GZ1 = 2.6;      // largo de las góndolas (eje z)
const GL = GZ1 - GZ0;

// Cada categoría ocupa un lado de góndola; las chicas se juntan; las grandes se reparten en varios lados
function makeSides(shelfGroups) {
  const sides = [];
  for (const grp of shelfGroups) {
    let chunks = [grp.items];
    while (chunks.some(c => segmentWidth(c, LEVELS_SHELF.length) > GL - 0.2) && chunks.length < 6) {
      const n = chunks.length + 1, all = grp.items, size = Math.ceil(all.length / n);
      chunks = Array.from({ length: n }, (_, i) => all.slice(i * size, (i + 1) * size)).filter(c => c.length);
    }
    for (const items of chunks) {
      const w = segmentWidth(items, LEVELS_SHELF.length);
      const last = sides[sides.length - 1];
      const lastSmall = last && last.segs.every(s => s.items.length < 10);
      if (last && (items.length < 10 || lastSmall) && last.need + w + 0.3 <= GL) {
        last.segs.push({ grp, items, need: w });
        last.need += w;
      } else sides.push({ segs: [{ grp, items, need: w }], need: w });
    }
  }
  return sides;
}

function wallSegs() {
  const { x0, x1, z0 } = ROOM;
  return [
    { o: new V3(x0 + 0.05, 0, 6.4), n: new V3(1, 0, 0), len: 6.4 - (z0 + 1.25) },
    { o: new V3(x0 + 1.2, 0, z0 + 0.05), n: new V3(0, 0, 1), len: (x1 - 1.2) - (x0 + 1.2) },
    { o: new V3(x1 - 0.05, 0, z0 + 1.25), n: new V3(-1, 0, 0), len: 6.4 - (z0 + 1.25) }
  ];
}
// Verduras → pared izquierda, carnicería → fondo, refrigerados → derecha
function assignWalls(fresh) {
  const segs = wallSegs();
  const pref = { produce: 0, meat: 1, fridge: 2 };
  const lists = [[], [], []], used = [0, 0, 0], overflow = [];
  for (const grp of fresh) {
    const len = unitLength(grp);
    const p0 = pref[grp.zone];
    const order = [p0, (p0 + 1) % 3, (p0 + 2) % 3];
    const si = order.find(i => used[i] + len + (lists[i].length ? 0.5 : 0) <= segs[i].len - 0.3);
    if (si === undefined) { overflow.push(grp); continue; }
    lists[si].push({ grp, len });
    used[si] += len + 0.5;
  }
  // estirar los muebles para aprovechar la pared (con más frentes de producto)
  lists.forEach((list, si) => {
    if (!list.length) return;
    const gaps = (list.length - 1) * 0.5 + 0.4;
    const sum = list.reduce((s, x) => s + x.len, 0);
    const k = Math.min(2.2, Math.max(1, (segs[si].len * 0.95 - gaps) / sum));
    list.forEach(x => { x.len *= k; });
  });
  return { walls: lists.map((list, si) => ({ seg: segs[si], list })), overflow };
}

function planLayout(groups) {
  let shelf = groups.filter(g => g.zone === 'shelf');
  let fresh = groups.filter(g => g.zone !== 'shelf');
  let sides, G, walls;
  for (let pass = 0; pass < 2; pass++) {
    sides = makeSides(shelf);
    G = Math.min(6, Math.max(1, Math.ceil(sides.length / 2)));
    const W = Math.min(26, Math.max(15, G * 0.9 + (G + 1) * 3.1 + 2.3));
    ROOM = { x0: -W / 2, x1: W / 2, z0: -12, z1: 12, h: 4 };
    const res = assignWalls(fresh);
    walls = res.walls;
    if (!res.overflow.length) break;
    shelf = shelf.concat(res.overflow);
    fresh = fresh.filter(g => !res.overflow.includes(g));
  }
  return { sides, G, walls };
}

// ---------- Góndolas centrales ----------
function buildGondolas(sides, G) {
  if (!sides.length) return [];
  const L = GL;
  const inner0 = ROOM.x0 + 1.15, inner1 = ROOM.x1 - 1.15;
  const aisle = Math.min(3.1, (inner1 - inner0 - G * 0.9) / (G + 1));
  const block = G * 0.9 + (G - 1) * aisle;
  const xs = Array.from({ length: G }, (_, i) => -block / 2 + 0.45 + i * (0.9 + aisle));
  const aisles = [];
  xs.forEach((gx, gi) => {
    // estructura
    const cz = (GZ0 + GZ1) / 2;
    box(scene, 0.9, 0.12, L, '#5d6b63', gx, 0.06, cz);
    box(scene, 0.05, 2.08, L, '#ece5d8', gx, 1.12, cz);
    box(scene, 0.94, 0.06, L + 0.04, '#2f8f46', gx, 2.16, cz);
    box(scene, 0.94, 2.2, 0.06, '#d9cfbf', gx, 1.1, GZ0 - 0.03);
    box(scene, 0.94, 2.2, 0.06, '#d9cfbf', gx, 1.1, GZ1 + 0.03);
    obstacles.push({ x0: gx - 0.47, x1: gx + 0.47, z0: GZ0 - 0.06, z1: GZ1 + 0.06 });
    mapRects.push({ x0: gx - 0.45, x1: gx + 0.45, z0: GZ0, z1: GZ1, color: '#8aa595' });
    for (const s of [0, 1]) {
      const si = gi * 2 + s;
      const n = new V3(s === 0 ? -1 : 1, 0, 0);
      const g = frameGroup(new V3(gx, 0, s === 0 ? GZ0 : GZ1), n);
      for (const ly of LEVELS_SHELF) {
        box(g, L, 0.025, 0.42, '#f3efe8', L / 2, ly - 0.0125, 0.24);
        box(g, L, 0.045, 0.012, '#ffffff', L / 2, ly - 0.03, 0.452);
      }
      const side = sides[si];
      const segs = side ? side.segs : [];
      let a = 0;
      for (const sg of segs) {
        const w = segs.length === 1 ? L : L * sg.need / side.need;
        fillShelves(g, sg.items, a, w, LEVELS_SHELF, 0.25, 0.464);
        categorySign(g, sg.grp.name, sg.grp.color, a, w, 2.38, 0.3, 0.3);
        if (!catView.has(sg.grp.name)) registerCategory(g, sg.grp.name, a, w, 1.1, 0.25);
        // franja de color en el borde de las repisas
        for (const ly of LEVELS_SHELF) box(g, w - 0.04, 0.008, 0.004, mat(sg.grp.color), a + w / 2, ly - 0.012, 0.459);
        a += w;
      }
      aisles.push({ x: gx + n.x * (0.45 + aisle / 2), cats: [...new Set(segs.map(s2 => s2.grp.name))], side: s });
    }
    // cabecera de la góndola (mirando a la entrada)
    const names = [...new Set([...(sides[gi * 2]?.segs || []), ...(sides[gi * 2 + 1]?.segs || [])].map(s => s.grp.name))];
    if (names.length) {
      const t = signTexture(names.slice(0, 2).join(' · '), catIcon(names[0]), '#2f8f46', 900, 180);
      plane(scene, 0.9, 0.18, new THREE.MeshBasicMaterial({ map: t }), gx, 2.38, GZ1 + 0.07);
    }
  });
  // si quedaron categorías sin espacio, avisar en consola
  if (sides.length > G * 2) console.warn('Hay más categorías que espacio en góndolas');
  return aisles;
}

// ---------- Muebles de pared: verduras, carnicería y refrigeradores ----------
function uOf(n) { return new V3(n.z, 0, -n.x); } // a lo largo del mueble

function unitLength(grp) {
  const n = grp.items.length;
  if (grp.zone === 'produce') return Math.ceil(n / 2) * 0.85 + 0.3;
  if (grp.zone === 'meat') return Math.max(2.4, Math.ceil(n / 2) * 0.52 + 0.5);
  const w = segmentWidth(grp.items, LEVELS_FRIDGE.length);
  return Math.max(1.8, Math.ceil((w + 0.2) / 0.9) * 0.9);
}

function buildWallUnits(walls) {
  for (const { seg, list } of walls) {
    let s = 0.2;
    for (const { grp, len } of list) {
      const o = seg.o.clone().add(uOf(seg.n).multiplyScalar(s));
      const g = frameGroup(o, seg.n);
      if (grp.zone === 'produce') buildProduce(g, grp, len);
      else if (grp.zone === 'meat') buildMeat(g, grp, len);
      else buildFridge(g, grp, len);
      s += len + 0.5;
    }
  }
}

const woodMatCache = {};
function woodMat() { return woodMatCache.m || (woodMatCache.m = new THREE.MeshLambertMaterial({ map: woodTexture() })); }

function buildProduce(g, grp, len) {
  box(g, len, 0.5, 1.0, '#7a5230', len / 2, 0.25, 0.5);
  box(g, len, 0.9, 0.45, '#6b4423', len / 2, 0.45, 0.225);
  const pcols = Math.ceil(grp.items.length / 2), pcw = (len - 0.3) / pcols;
  grp.items.forEach((p, i) => {
    const col = Math.floor(i / 2), tier = i % 2;
    const x = 0.15 + pcw * (col + 0.5);
    const crate = new THREE.Group();
    crate.position.set(x, tier ? 0.98 : 0.57, tier ? 0.25 : 0.74);
    crate.rotation.x = 0.32;
    g.add(crate);
    const body = box(crate, 0.8, 0.2, 0.45, woodMat(), 0, 0, 0);
    const pile = plane(crate, 0.74, 0.4, new THREE.MeshLambertMaterial({ map: pileTexture(p, 'crate') }), 0, 0.102, 0, -Math.PI / 2);
    const tag = plane(crate, 0.22, 0.092, new THREE.MeshLambertMaterial({ map: priceTagTexture(p) }), 0, -0.02, 0.228);
    const reg = registerProduct(p);
    for (const m of [body, pile, tag]) { m.userData.pid = p.id; pickables.push(m); }
    reg.mats.push(pile.material, tag.material);
    g.updateMatrixWorld();
    reg.pos = crate.localToWorld(new V3(0, 0.1, 0));
    reg.n = new V3(0, 0, 1).transformDirection(g.matrixWorld);
  });
  plane(g, Math.min(len - 0.2, 4), 0.5, new THREE.MeshBasicMaterial({ map: signTexture(grp.name, catIcon(grp.name), grp.color, 1100, 140) }), len / 2, 2.3, 0.03);
  registerCategory(g, grp.name, 0, len, 1.0, 0.6, 2.6);
  addObstacleFromLocal(g, 0, len, 0, 1.05, grp.color);
}

function buildMeat(g, grp, len) {
  box(g, len, 0.82, 0.95, '#f4f4f2', len / 2, 0.41, 0.475);
  box(g, len, 0.1, 0.02, '#9aa3a8', len / 2, 0.05, 0.96);
  box(g, len, 0.08, 0.01, mat(grp.color), len / 2, 0.68, 0.958);
  box(g, len - 0.08, 0.03, 0.62, '#dfe9ee', len / 2, 0.84, 0.55);
  box(g, len, 1.3, 0.08, '#e9eef1', len / 2, 1.5, 0.04);
  const glass = new THREE.MeshLambertMaterial({ color: '#dff3fb', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  plane(g, len, 0.5, glass, len / 2, 1.08, 0.92, -0.45);
  plane(g, len, 0.32, glass, len / 2, 1.32, 0.74, -Math.PI / 2 + 0.1);
  const mcols = Math.ceil(grp.items.length / 2), mcw = (len - 0.5) / mcols;
  grp.items.forEach((p, i) => {
    const col = Math.floor(i / 2), row = i % 2;
    const x = 0.25 + mcw * (col + 0.5);
    const tray = new THREE.Group();
    tray.position.set(x, row ? 0.9 : 0.87, row ? 0.42 : 0.72);
    tray.rotation.x = 0.28;
    g.add(tray);
    const body = box(tray, 0.46, 0.03, 0.27, '#ffffff', 0, 0, 0);
    const top = plane(tray, 0.44, 0.25, new THREE.MeshLambertMaterial({ map: pileTexture(p, 'tray') }), 0, 0.017, 0, -Math.PI / 2);
    const tag = plane(g, 0.2, 0.084, new THREE.MeshLambertMaterial({ map: priceTagTexture(p) }), x + (row ? 0.12 : -0.12), 0.76, 0.962);
    const reg = registerProduct(p);
    for (const m of [body, top, tag]) { m.userData.pid = p.id; pickables.push(m); }
    reg.mats.push(top.material, tag.material);
    g.updateMatrixWorld();
    reg.pos = tray.localToWorld(new V3(0, 0.05, 0));
    reg.n = new V3(0, 0, 1).transformDirection(g.matrixWorld);
  });
  plane(g, Math.min(len - 0.2, 4), 0.55, new THREE.MeshBasicMaterial({ map: signTexture(grp.name, catIcon(grp.name), grp.color, 1100, 150) }), len / 2, 2.55, 0.03);
  registerCategory(g, grp.name, 0, len, 1.0, 0.7, 2.3);
  addObstacleFromLocal(g, 0, len, 0, 1.0, grp.color);
}

function buildFridge(g, grp, len) {
  const back = new THREE.MeshLambertMaterial({ color: '#eef4f8', emissive: '#334455', emissiveIntensity: 0.25 });
  box(g, len, 2.1, 0.04, back, len / 2, 1.05, 0.02);
  box(g, 0.05, 2.2, 0.8, '#e6ebee', 0.025, 1.1, 0.4);
  box(g, 0.05, 2.2, 0.8, '#e6ebee', len - 0.025, 1.1, 0.4);
  box(g, len, 0.22, 0.8, '#e6ebee', len / 2, 2.21, 0.4);
  box(g, len, 0.18, 0.8, '#5d6b63', len / 2, 0.09, 0.4);
  for (const ly of LEVELS_FRIDGE) box(g, len - 0.1, 0.02, 0.66, '#d5e3ea', len / 2, ly - 0.01, 0.4);
  fillShelves(g, grp.items, 0.03, len - 0.06, LEVELS_FRIDGE, 0.42, 0.742);
  const doors = Math.max(1, Math.round(len / 0.9));
  for (let k = 0; k <= doors; k++) box(g, 0.035, 2.0, 0.04, '#9aa3a8', (len / doors) * k, 1.12, 0.78);
  const glass = new THREE.MeshLambertMaterial({ color: '#e2f4fb', transparent: true, opacity: 0.13, depthWrite: false });
  plane(g, len, 2.0, glass, len / 2, 1.12, 0.8);
  box(g, len, 0.02, 0.02, new THREE.MeshBasicMaterial({ color: '#9fdcff' }), len / 2, 2.08, 0.75);
  plane(g, len - 0.1, 0.19, new THREE.MeshBasicMaterial({ map: signTexture(grp.name, catIcon(grp.name), grp.color, Math.round(180 * (len - 0.1) / 0.19), 180) }), len / 2, 2.21, 0.805);
  registerCategory(g, grp.name, 0, len, 1.1, 0.5, 2.3);
  addObstacleFromLocal(g, 0, len, 0, 0.82, grp.color);
}

function buildCheckout() {
  const g = frameGroup(new V3(ROOM.x1 - 2.4, 0, 8.2), new V3(-1, 0, 0));
  box(g, 2.4, 0.9, 0.7, '#2f8f46', 1.2, 0.45, 0.35);
  box(g, 2.5, 0.05, 0.8, '#f3efe8', 1.2, 0.92, 0.35);
  box(g, 0.4, 0.25, 0.3, '#3d3d3d', 1.8, 1.07, 0.3);
  box(g, 0.35, 0.22, 0.03, '#222', 1.8, 1.32, 0.18);
  plane(g, 1.6, 0.42, new THREE.MeshBasicMaterial({ map: signTexture('Caja', '🧾', '#e4572e', 760, 200) }), 1.2, 2.7, 0.35);
  addObstacleFromLocal(g, 0, 2.4, 0, 0.75, '#2f8f46');
}

// Letreros colgantes sobre cada pasillo
function hangAisleSigns(aisles) {
  const byX = [];
  aisles.forEach(a => {
    const near = byX.find(b => Math.abs(b.x - a.x) < 0.6);
    if (near) near.cats.push(...a.cats); else byX.push({ x: a.x, cats: [...a.cats] });
  });
  byX.sort((a, b) => a.x - b.x).forEach((a, i) => {
    if (!a.cats.length) return;
    const t = signTexture(`Pasillo ${i + 1}`, '', '#2f8f46', 700, 150);
    const sub = signTexture(a.cats.slice(0, 3).join(' · '), '', '#f2b134', 1400, 150);
    const g = new THREE.Group();
    g.position.set(a.x, 3.15, (GZ0 + GZ1) / 2 + 2.5);
    scene.add(g);
    const m1 = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    const m2 = new THREE.MeshBasicMaterial({ map: sub, side: THREE.DoubleSide });
    plane(g, 1.4, 0.3, m1, 0, 0.2, 0);
    plane(g, 2.2, 0.24, m2, 0, -0.1, 0);
    box(g, 0.01, 0.6, 0.01, '#999', -0.6, 0.6, 0);
    box(g, 0.01, 0.6, 0.01, '#999', 0.6, 0.6, 0);
  });
}

// =====================================================================
// Movimiento por la tienda
// =====================================================================
const player = { pos: new V3(0, 1.6, 11.2), yaw: 0, pitch: -0.05 };
const keys = {};
let anim = null;
const RADIUS = 0.32;

function collide(pos) {
  pos.x = Math.min(ROOM.x1 - RADIUS, Math.max(ROOM.x0 + RADIUS, pos.x));
  pos.z = Math.min(ROOM.z1 - RADIUS, Math.max(ROOM.z0 + RADIUS, pos.z));
  for (const o of obstacles) {
    const x0 = o.x0 - RADIUS, x1 = o.x1 + RADIUS, z0 = o.z0 - RADIUS, z1 = o.z1 + RADIUS;
    if (pos.x > x0 && pos.x < x1 && pos.z > z0 && pos.z < z1) {
      const dx = Math.min(pos.x - x0, x1 - pos.x), dz = Math.min(pos.z - z0, z1 - pos.z);
      if (dx < dz) pos.x = pos.x - x0 < x1 - pos.x ? x0 : x1;
      else pos.z = pos.z - z0 < z1 - pos.z ? z0 : z1;
    }
  }
}
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function angleTo(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(to.y - from.y, Math.hypot(dx, dz)) };
}
function flyTo(pos, look, onDone) {
  const target = pos.clone();
  collide(target);
  const a = angleTo(target, look);
  let dy = a.yaw - player.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const dist = player.pos.distanceTo(target);
  anim = {
    from: player.pos.clone(), to: target, yaw0: player.yaw, yaw1: player.yaw + dy, p0: player.pitch, p1: Math.max(-0.7, Math.min(0.5, a.pitch)),
    t: 0, dur: Math.min(2.2, 0.5 + dist * 0.09), arc: dist > 3 ? Math.min(1.9, dist * 0.12) : 0, onDone
  };
}
function viewProduct(id, open = true) {
  const o = prodObj.get(id);
  if (!o) return;
  const from = o.pos.clone().add(o.n.clone().multiplyScalar(1.35));
  from.y = 1.55;
  flyTo(from, o.pos, () => { pulse(id); if (open) openProduct(id); });
}
function viewCategory(name) {
  const v = catView.get(name);
  if (!v) return;
  const from = v.pos.clone().add(v.n.clone().multiplyScalar(v.dist));
  from.y = 1.6;
  flyTo(from, v.pos);
}

// Resaltado de productos
let hovered = null, pulsing = null;
function setGlow(id, amount) {
  const o = prodObj.get(id);
  if (!o) return;
  for (const m of o.mats) { m.emissive.setRGB(amount, amount * 0.75, amount * 0.2); }
  markDirty();
}
function pulse(id) {
  if (pulsing) setGlow(pulsing.id, 0);
  pulsing = { id, t: 0 };
}

// =====================================================================
// Entrada del usuario
// =====================================================================
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.far = 30;
  const hit = raycaster.intersectObjects(pickables, false)[0];
  return hit || null;
}

function setupInput() {
  const cv = renderer.domElement;
  let down = null, lastTap = { t: 0, x: 0, y: 0 };
  cv.addEventListener('pointerdown', e => {
    closeMenus();
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (down) {
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      down.lx = e.clientX; down.ly = e.clientY;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down.moved = true; cv.classList.add('dragging'); }
      if (down.moved) {
        anim = null;
        player.yaw += dx * 0.0042;
        player.pitch = Math.max(-0.75, Math.min(0.55, player.pitch + dy * 0.0035));
        markDirty();
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const hit = pick(e.clientX, e.clientY);
    const id = hit && hit.object.userData.pid;
    if (id !== hovered) {
      if (hovered && (!pulsing || pulsing.id !== hovered)) setGlow(hovered, 0);
      hovered = id || null;
      if (hovered) setGlow(hovered, 0.22);
      cv.classList.toggle('hovering', !!hovered);
      const p = hovered && P.get(hovered);
      showHint(p ? `${p.name} — ${p.stock > 0 ? money(p.price) + (p.unit === 'kg' ? '/kg' : '') : 'Agotado'}` : '');
    }
  });
  const end = e => {
    if (!down) return;
    cv.classList.remove('dragging');
    const wasClick = !down.moved && performance.now() - down.t < 600;
    down = null;
    if (!wasClick) return;
    const hit = pick(e.clientX, e.clientY);
    if (!hit) return;
    const now = performance.now();
    const dbl = now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (hit.object.userData.pid) { openProduct(hit.object.userData.pid); return; }
    if (hit.object.userData.floor) {
      if (dbl || e.pointerType !== 'mouse') {
        const target = new V3(hit.point.x, 1.6, hit.point.z);
        const look = target.clone().add(new V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)));
        const dir = target.clone().sub(player.pos); dir.y = 0;
        if (dir.length() > 0.5) look.copy(target).add(dir.normalize());
        look.y = 1.55;
        flyTo(target, look);
      }
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', () => { down = null; cv.classList.remove('dragging'); });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    anim = null;
    const step = -Math.sign(e.deltaY) * 0.45;
    player.pos.x += -Math.sin(player.yaw) * step;
    player.pos.z += -Math.cos(player.yaw) * step;
    collide(player.pos);
    markDirty();
  }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  const keyMap = { ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyQ: 'left', ArrowRight: 'right', KeyE: 'right', KeyA: 'sl', KeyD: 'sr' };
  window.addEventListener('keydown', e => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'Escape') { closeAll(); return; }
    const k = keyMap[e.code];
    if (k) { keys[k] = true; anim = null; e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { const k = keyMap[e.code]; if (k) keys[k] = false; });
  window.addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));

  document.querySelectorAll('#pad [data-move]').forEach(b => {
    const k = b.dataset.move;
    const on = e => { e.preventDefault(); keys[k] = true; anim = null; b.classList.add('on'); };
    const off = () => { keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    markDirty();
  });
}
let hintT;
function showHint(text) {
  const h = $('#hint');
  clearTimeout(hintT);
  if (!text) { h.classList.add('hidden'); return; }
  h.textContent = text;
  h.classList.remove('hidden');
}

// =====================================================================
// Bucle de dibujo
// =====================================================================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let moving = false;
  if (anim) {
    anim.t += dt / anim.dur;
    const k = ease(Math.min(1, anim.t));
    player.pos.lerpVectors(anim.from, anim.to, k);
    player.pos.y += Math.sin(Math.PI * k) * anim.arc;
    player.yaw = anim.yaw0 + (anim.yaw1 - anim.yaw0) * k;
    player.pitch = anim.p0 + (anim.p1 - anim.p0) * k - Math.sin(Math.PI * k) * anim.arc * 0.25;
    moving = true;
    if (anim.t >= 1) { const cb = anim.onDone; anim = null; if (cb) cb(); }
  } else {
    const sp = 2.6 * dt, rs = 1.7 * dt;
    let f = 0, s = 0;
    if (keys.fwd) f += sp;
    if (keys.back) f -= sp;
    if (keys.sl) s -= sp;
    if (keys.sr) s += sp;
    if (keys.left) player.yaw += rs;
    if (keys.right) player.yaw -= rs;
    if (f || s || keys.left || keys.right) {
      player.pos.x += -Math.sin(player.yaw) * f + Math.cos(player.yaw) * s;
      player.pos.z += -Math.cos(player.yaw) * f - Math.sin(player.yaw) * s;
      collide(player.pos);
      moving = true;
    }
  }
  if (pulsing) {
    pulsing.t += dt;
    const a = pulsing.t > 2.4 ? 0 : (Math.sin(pulsing.t * 7) * 0.5 + 0.5) * 0.45;
    setGlow(pulsing.id, a);
    if (pulsing.t > 2.4) pulsing = null;
  }
  if (moving || dirty) {
    camera.position.copy(player.pos);
    camera.rotation.set(player.pitch, player.yaw, 0);
    renderer.render(scene, camera);
    drawMinimap();
    dirty = false;
  }
  requestAnimationFrame(loop);
}

// =====================================================================
// Mapa
// =====================================================================
let mapBase = null;
function mapXY(x, z, w, h) {
  return [((x - ROOM.x0) / (ROOM.x1 - ROOM.x0)) * (w - 16) + 8, ((z - ROOM.z0) / (ROOM.z1 - ROOM.z0)) * (h - 16) + 8];
}
function drawMinimap() {
  const cv = $('#minimap'), ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  if (!mapBase) {
    mapBase = canvas(w, h);
    const m = mapBase.getContext('2d');
    m.fillStyle = '#efe6d6';
    m.fillRect(8, 8, w - 16, h - 16);
    m.strokeStyle = '#7a6b5d'; m.lineWidth = 2;
    m.strokeRect(8, 8, w - 16, h - 16);
    for (const r of mapRects) {
      const [a, b] = mapXY(r.x0, r.z0, w, h), [c, d] = mapXY(r.x1, r.z1, w, h);
      m.fillStyle = r.color;
      m.fillRect(a, b, Math.max(2, c - a), Math.max(2, d - b));
    }
    m.fillStyle = '#fff';
    const [ea, eb] = mapXY(-2, ROOM.z1, w, h), [ec] = mapXY(2, ROOM.z1, w, h);
    m.fillRect(ea, eb - 2, ec - ea, 4);
  }
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(mapBase, 0, 0);
  const [px, py] = mapXY(player.pos.x, player.pos.z, w, h);
  ctx.fillStyle = 'rgba(228,87,46,.25)';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, 26, -Math.PI / 2 - player.yaw - 0.55, -Math.PI / 2 - player.yaw + 0.55);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e4572e';
  ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
}
$('#minimap').addEventListener('click', e => {
  const cv = e.currentTarget, r = cv.getBoundingClientRect();
  const mx = (e.clientX - r.left) * cv.width / r.width, my = (e.clientY - r.top) * cv.height / r.height;
  const x = ROOM.x0 + (mx - 8) / (cv.width - 16) * (ROOM.x1 - ROOM.x0);
  const z = ROOM.z0 + (my - 8) / (cv.height - 16) * (ROOM.z1 - ROOM.z0);
  const target = new V3(x, 1.6, z);
  const look = target.clone().add(new V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)));
  look.y = 1.5;
  flyTo(target, look);
});

// =====================================================================
// Ficha de producto, carrito y pago
// =====================================================================
const CART_KEY = 'carrito-luzdemaria';
function loadCart() { try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '{}') || {}; } catch { cart = {}; } }
function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* sin almacenamiento */ } }
const stepOf = p => p.unit === 'kg' ? 0.25 : 1;
const maxOf = p => Math.max(0, Math.min(p.stock, p.unit === 'kg' ? 20 : 100));

let sheetProduct = null, sheetQty = 1;
function imageHtml(p, cls = 'em') {
  return p.photo ? `<img src="${p.photo}" alt="">` : `<span class="${cls}">${iconFor(p)}</span>`;
}
function openProduct(id) {
  const p = P.get(id);
  if (!p) return;
  closeMenus();
  sheetProduct = p;
  const inCart = cart[id] || 0;
  const max = maxOf(p) - inCart;
  sheetQty = p.unit === 'kg' ? Math.min(0.5, Math.max(0.25, max)) : 1;
  $('#psImage').innerHTML = imageHtml(p);
  $('#psCat').textContent = catIcon(p.category) + ' ' + p.category;
  $('#psName').textContent = p.name;
  $('#psPrice').textContent = money(p.price) + (p.unit === 'kg' ? ' / kg' : '');
  const st = $('#psStock');
  if (p.stock <= 0) { st.textContent = '❌ Agotado por ahora'; st.className = 'ps-stock out'; }
  else if ((p.unit === 'kg' && p.stock <= 3) || (p.unit !== 'kg' && p.stock <= 5)) { st.textContent = `⚠️ ¡Quedan solo ${qtyTxt(p.stock, p.unit)}!`; st.className = 'ps-stock low'; }
  else { st.textContent = '✅ Disponible'; st.className = 'ps-stock ok'; }
  $('#psNote').textContent = inCart ? `Ya tiene ${qtyTxt(inCart, p.unit)} en el carrito.` : (p.unit === 'kg' ? 'Se vende por kilo, de a 250 g.' : '');
  updateSheetQty();
  $('#productSheet').classList.remove('hidden');
}
function updateSheetQty() {
  const p = sheetProduct;
  const max = maxOf(p) - (cart[p.id] || 0);
  $('#psQty').textContent = qtyTxt(sheetQty, p.unit);
  $('#psAdd').disabled = max < stepOf(p) || p.stock <= 0;
  $('#psAdd').textContent = p.stock <= 0 ? 'Agotado' : max < stepOf(p) ? 'Ya tiene todo el stock disponible'
    : `Agregar · ${money(p.price * sheetQty)}`;
  $('#psMinus').disabled = sheetQty <= stepOf(p);
  $('#psPlus').disabled = sheetQty + stepOf(p) > max;
}
$('#psMinus').onclick = () => { sheetQty = Math.max(stepOf(sheetProduct), +(sheetQty - stepOf(sheetProduct)).toFixed(2)); updateSheetQty(); };
$('#psPlus').onclick = () => { sheetQty = +(sheetQty + stepOf(sheetProduct)).toFixed(2); updateSheetQty(); };
$('#psAdd').onclick = () => {
  const p = sheetProduct;
  cart[p.id] = +((cart[p.id] || 0) + sheetQty).toFixed(2);
  saveCart();
  renderCart();
  $('#productSheet').classList.add('hidden');
  toast(`🛒 ${p.name} agregado`);
  const b = $('#btnCart'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
};

function cartLines() {
  return Object.entries(cart).map(([id, q]) => ({ p: P.get(id), q })).filter(l => l.p);
}
function renderCart() {
  const lines = cartLines();
  const count = lines.length;
  $('#cartCount').textContent = count;
  $('#btnCart').classList.toggle('has', count > 0);
  const total = lines.reduce((s, l) => s + l.p.price * l.q, 0);
  $('#cartTotal').textContent = money(total);
  $('#cartItems').innerHTML = count ? lines.map(({ p, q }) => `
    <div class="cart-line">
      <div class="em">${imageHtml(p, '')}</div>
      <div class="nm">${esc(p.name)}<small>${money(p.price)}${p.unit === 'kg' ? '/kg' : ''}</small></div>
      <div class="q"><button data-id="${p.id}" data-d="-1" aria-label="Menos">−</button><span>${qtyTxt(q, p.unit)}</span><button data-id="${p.id}" data-d="1" aria-label="Más">+</button></div>
      <div class="st">${money(p.price * q)}</div>
    </div>`).join('')
    : '<div class="cart-empty"><div>🧺</div>Su carrito está vacío.<br>Recorra la tienda y toque los productos para agregarlos.</div>';
  $('#checkoutForm').classList.toggle('hidden', !count);
}
$('#cartItems').addEventListener('click', e => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  const p = P.get(b.dataset.id);
  let q = +((cart[p.id] || 0) + Number(b.dataset.d) * stepOf(p)).toFixed(2);
  if (q > maxOf(p)) { toast('No hay más stock disponible'); q = maxOf(p); }
  if (q <= 0) delete cart[p.id]; else cart[p.id] = q;
  saveCart();
  renderCart();
});
$('#btnCart').onclick = () => { closeMenus(); renderCart(); $('#cartPanel').classList.remove('hidden'); };
document.querySelectorAll('input[name=entrega]').forEach(r => r.addEventListener('change', () => {
  const desp = $('input[name=entrega]:checked').value === 'despacho';
  const dir = $('input[name=direccion]');
  dir.classList.toggle('hidden', !desp);
  dir.required = desp;
}));

$('#checkoutForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#payMsg');
  msg.textContent = '';
  if (CAT.__demo) { msg.textContent = 'Esta tienda está en modo demostración: los pagos aún no están activos.'; return; }
  const f = e.target;
  const body = {
    items: cartLines().map(l => ({ id: l.p.id, qty: l.q })),
    cliente: {
      nombre: f.nombre.value, telefono: f.telefono.value, email: f.email.value,
      entrega: f.entrega.value, direccion: f.direccion.value, nota: f.nota.value
    }
  };
  try { localStorage.setItem('cliente-luzdemaria', JSON.stringify({ ...body.cliente, nota: '' })); } catch { /* opcional */ }
  const btn = $('#btnPay');
  btn.disabled = true;
  btn.textContent = 'Conectando con Mercado Pago…';
  try {
    const r = await fetch('/api/crear-pago', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.error || 'No se pudo iniciar el pago');
    location.href = d.url;
  } catch (err) {
    msg.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Pagar con Mercado Pago';
  }
});
function prefillCustomer() {
  try {
    const c = JSON.parse(localStorage.getItem('cliente-luzdemaria') || 'null');
    if (!c) return;
    const f = $('#checkoutForm');
    ['nombre', 'telefono', 'email', 'direccion'].forEach(k => { if (c[k]) f[k].value = c[k]; });
    if (c.entrega === 'despacho') { f.querySelector('input[value=despacho]').checked = true; f.direccion.classList.remove('hidden'); f.direccion.required = true; }
  } catch { /* nada */ }
}

// Al volver de Mercado Pago
async function handleReturn() {
  const q = new URLSearchParams(location.search);
  const estado = q.get('pago'), id = q.get('pedido');
  if (!estado || !id) return;
  history.replaceState(null, '', location.pathname);
  let info = null;
  try { const r = await fetch('/api/pedido?id=' + encodeURIComponent(id)); if (r.ok) info = await r.json(); } catch { /* sin datos */ }
  let html;
  if (estado === 'ok') {
    cart = {}; saveCart(); renderCart();
    html = `<div class="big">🎉</div><h2>¡Gracias por su compra!</h2>
      <p>Pedido <b>${esc(id)}</b>${info ? ' · Total <b>' + money(info.total) + '</b>' : ''}</p>
      <p>${info && info.entrega === 'despacho' ? 'Le contactaremos para coordinar el despacho.' : 'Le avisaremos cuando su pedido esté listo para retirar.'}</p>`;
  } else if (estado === 'pendiente') {
    html = `<div class="big">⏳</div><h2>Pago pendiente</h2><p>Su pedido <b>${esc(id)}</b> quedará confirmado cuando Mercado Pago apruebe el pago.</p>`;
  } else {
    html = `<div class="big">😕</div><h2>El pago no se completó</h2><p>No se realizó ningún cobro. Su carrito sigue guardado para intentarlo de nuevo.</p>`;
  }
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
}

// =====================================================================
// Búsqueda, pasillos y lista
// =====================================================================
function renderAisleMenu() {
  const groups = groupProducts();
  $('#aisleMenu').innerHTML = `<button data-go="entrada"><span class="sw" style="background:#e4f4e6">🚪</span>Volver a la entrada</button>` +
    groups.map(g => `<button data-cat="${esc(g.name)}"><span class="sw" style="background:${g.color}33">${catIcon(g.name)}</span>${esc(g.name)}<small>${g.items.length}</small></button>`).join('');
}
$('#btnAisles').onclick = e => { e.stopPropagation(); $('#aisleMenu').classList.toggle('hidden'); };
$('#aisleMenu').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  $('#aisleMenu').classList.add('hidden');
  if (b.dataset.go) flyTo(new V3(0, 1.6, 10.4), new V3(0, 1.4, 4));
  else viewCategory(b.dataset.cat);
});

let results = [], resSel = 0;
$('#search').addEventListener('input', () => {
  const q = norm($('#search').value.trim());
  const ul = $('#searchResults');
  if (!q) { ul.classList.add('hidden'); return; }
  results = [...P.values()].filter(p => norm(p.name).includes(q) || norm(p.category).includes(q)).slice(0, 8);
  resSel = 0;
  ul.innerHTML = results.map((p, i) => `<li data-i="${i}" class="${i ? '' : 'sel'}"><span class="em">${iconFor(p)}</span>${esc(p.name)}<span class="pr">${p.stock > 0 ? money(p.price) : 'Agotado'}</span></li>`).join('')
    || '<li class="muted">No encontramos ese producto</li>';
  ul.classList.remove('hidden');
});
$('#search').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    resSel = Math.max(0, Math.min(results.length - 1, resSel + (e.key === 'ArrowDown' ? 1 : -1)));
    document.querySelectorAll('#searchResults li').forEach((li, i) => li.classList.toggle('sel', i === resSel));
  } else if (e.key === 'Enter' && results[resSel]) { goToResult(results[resSel]); }
  else if (e.key === 'Escape') closeMenus();
});
$('#searchResults').addEventListener('click', e => {
  const li = e.target.closest('li[data-i]');
  if (li) goToResult(results[Number(li.dataset.i)]);
});
function goToResult(p) {
  $('#search').value = '';
  $('#search').blur();
  closeMenus();
  viewProduct(p.id);
}

function renderList() {
  $('#listBody').innerHTML = groupProducts().map(g => `
    <h3><span>${catIcon(g.name)}</span>${esc(g.name)}</h3>
    ${g.items.map(p => `<div class="list-row" data-id="${p.id}">
      <span class="em">${iconFor(p)}</span>
      <span class="nm">${esc(p.name)}<small class="${p.stock > 0 ? 'muted' : ''}" style="${p.stock > 0 ? '' : 'color:#e4572e'}">${p.stock > 0 ? 'Disponible' : 'Agotado'}</small></span>
      <span class="pr">${money(p.price)}${p.unit === 'kg' ? '/kg' : ''}</span>
    </div>`).join('')}`).join('');
}
$('#btnList').onclick = () => { closeMenus(); renderList(); $('#listView').classList.remove('hidden'); };
$('#listBody').addEventListener('click', e => {
  const row = e.target.closest('[data-id]');
  if (!row) return;
  $('#listView').classList.add('hidden');
  if (renderer) viewProduct(row.dataset.id); else openProduct(row.dataset.id);
});

function closeMenus() {
  $('#aisleMenu').classList.add('hidden');
  $('#searchResults').classList.add('hidden');
}
function closeAll() {
  closeMenus();
  ['#productSheet', '#cartPanel', '#listView', '#modal'].forEach(s => $(s).classList.add('hidden'));
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) c.closest('.sheet, .drawer, .list-view, .modal').classList.add('hidden');
  if (!e.target.closest('.search, #aisleMenu, #btnAisles')) closeMenus();
});

// =====================================================================
// Inicio
// =====================================================================
async function loadCatalog() {
  for (const url of ['/api/catalogo', 'catalogo-demo.json']) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const d = await r.json();
      if (d && Array.isArray(d.products)) { d.__demo = url !== '/api/catalogo'; return d; }
    } catch { /* probar el siguiente */ }
  }
  throw new Error('No se pudo cargar el catálogo de productos.');
}

async function start() {
  const msg = $('#loadingMsg');
  try {
    CAT = await loadCatalog();
  } catch (err) {
    msg.textContent = err.message + ' Revise su conexión e intente de nuevo.';
    return;
  }
  CAT.store = CAT.store || {};
  CAT.products.forEach(p => P.set(p.id, p));
  const name = CAT.store.name || 'Minimercado';
  document.title = name + ' — Tienda virtual';
  $('#storeName').textContent = name;
  $('#loadingName').textContent = name;
  $('#demoBanner').classList.toggle('hidden', !CAT.__demo);
  if (CAT.__demo) setTimeout(() => $('#demoBanner').classList.add('hidden'), 12000);
  loadCart();
  for (const id of Object.keys(cart)) {
    const p = P.get(id);
    if (!p || p.stock <= 0) delete cart[id]; else cart[id] = Math.min(cart[id], maxOf(p));
  }
  saveCart();
  renderCart();
  prefillCustomer();
  renderAisleMenu();

  try {
    if (document.fonts) await Promise.race([document.fonts.load(`700 40px Fredoka`), new Promise(r => setTimeout(r, 2500))]);
  } catch { /* fuente opcional */ }

  msg.textContent = 'Ordenando las estanterías…';
  await new Promise(r => setTimeout(r, 30));
  try {
    initRenderer();
    const plan = planLayout(groupProducts());
    buildRoom();
    buildWallUnits(plan.walls);
    const aisles = buildGondolas(plan.sides, plan.G);
    hangAisleSigns(aisles);
    buildCheckout();
    setupInput();
    camera.position.copy(player.pos);
    renderer.compile(scene, camera);
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    renderer = null;
    msg.textContent = 'Su dispositivo no puede mostrar la tienda en 3D. Le mostramos la lista de productos.';
    $('#btnEnter').textContent = 'Ver productos';
  }
  $('#btnEnter').classList.remove('hidden');
  msg.textContent = renderer ? `${P.size} productos esperándole en las estanterías.` : msg.textContent;
  $('#btnEnter').onclick = () => {
    $('#loading').classList.add('fade');
    setTimeout(() => $('#loading').classList.add('hidden'), 500);
    if (!renderer) { renderList(); $('#listView').classList.remove('hidden'); }
    else flyTo(new V3(0, 1.6, 8.6), new V3(0, 1.35, 2));
    handleReturn();
  };
  if (new URLSearchParams(location.search).get('pago')) $('#btnEnter').click();
}
start();
