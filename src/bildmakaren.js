/**
 * Bildmakaren: gör en 2D-bild av blisstext, foton, geometriska figurer – med knappar som är Bliss.
 *
 * Symbolerna (både knapparnas och bildens) är de färdiga ritningarna som originalmotorn BlissEngine gjorde vid
 * bygget (src/vendor/bliss-ritningar.js, bliss-former.js). Appen ritar inga egna Bliss-tecken: den lägger
 * originalritningen på plats, och flytta/storlek/vrida/spegla/färg gäller hela ritningen som den är.
 * Varje knapp är ett BCI-AV-ord (id i CMD) med en av BCI:s egna glosor som text under.
 *
 * Bilden: doc = { id, bg, items: [...], assets: { aid: dataURL } }. Ett item har x, y (mitten), s (skala),
 * r (grader), flip, color och type: 'bliss' (ord ur skrivfältets tolkning), 'shape' eller 'image'.
 * Bilder sparas i IndexedDB (Mina bilder) automatiskt; inställningarna i localStorage.
 * Styrning med kontakter, ögon och tangentbord ligger i src/bildmakaren-styrning.js.
 */
(() => {
const G = window.Glosor;
const { deck, esc } = G;
const L = (sv, en) => (G.lang() === 'en' ? en : sv);

// ---------------------------------------------------------------- kommandona (BCI-AV-id + BCI:s glosa)
const CMD = {
  skriva: [18285, 'skriva', 'write'], bild: [16172, 'bild', 'picture'], kamera: [13111, 'kamera', 'camera'],
  klistra: [14448, 'klistra', 'paste'], form: [16940, 'form', 'shape'], farg: [13377, 'färg', 'colour'],
  valja: [13178, 'välja', 'choose'], fil: [23500, 'fil', 'file'], angra: [23701, 'ångra', 'undo'],
  tillbaka: [12613, 'tillbaka', 'back'], klar: [24844, 'klar', 'done'], flytta: [15667, 'flytta', 'move'],
  forstora: [14936, 'förstora', 'enlarge'], forminska: [13651, 'förminska', 'reduce'], vrida: [16690, 'vrida', 'rotate'],
  spegel: [20527, 'spegel', 'mirror'], lager: [25748, 'lager', 'layer'], framfor: [12656, 'framför', 'in front of'],
  bakom: [12348, 'bakom', 'behind'], kopiera: [16487, 'kopiera', 'copy'], tabort: [17498, 'ta bort', 'remove'],
  redigera: [29847, 'redigera', 'edit'], text: [29846, 'text', 'text'], upp: [17983, 'upp', 'up'],
  ner: [13869, 'ner', 'down'], vanster: [15187, 'vänster', 'left'], hoger: [16673, 'höger', 'right'],
  ny: [15710, 'ny', 'new'], oppna: [15922, 'öppna', 'open'], sparasom: [23649, 'spara som', 'save as'],
  skrivaut: [23624, 'skriva ut', 'print'], dela: [16941, 'dela', 'share'], importera: [23540, 'importera', 'import'],
  ja: [18294, 'ja', 'yes'], mitt: [15464, 'mitt', 'middle'],
  saga: [16728, 'säga', 'say'], berattelse: [17272, 'berättelse', 'story'], nara: [15697, 'nära', 'near'],
  langtbort: [26002, 'långt bort', 'far'], bubbla: [12916, 'bubbla', 'bubble'], rektangel: [16472, 'rektangel', 'rectangle'],
};
/** Siffrorna 1–4 (BCI:s siffertecken): antal rutor i en bildserie, och vilken ruta något ska ligga i. */
const DIGITS = [null, [8497, '1', '1'], [8498, '2', '2'], [8499, '3', '3'], [8500, '4', '4']];
const SHAPES = {
  cirkel: [13347, 'cirkel', 'circle'], kvadrat: [17242, 'kvadrat', 'square'], triangel: [17776, 'triangel', 'triangle'],
  linje: [15214, 'linje', 'line'], pil: [21852, 'pil', 'arrow'], stjarna: [17252, 'stjärna', 'star'],
  hjarta: [29042, 'hjärta', 'heart'],
};
const COLORS = {
  svart: [12849, 'svart', 'black', '#1B1B1B'], vit: [18242, 'vit', 'white', '#FFFFFF'], gra: [14639, 'grå', 'grey', '#8A8A8A'],
  rod: [16474, 'röd', 'red', '#D62839'], orange: [15931, 'orange', 'orange', '#F08A24'], gul: [18291, 'gul', 'yellow', '#F5C80E'],
  gron: [14641, 'grön', 'green', '#2E9A4E'], bla: [12864, 'blå', 'blue', '#1F6FD0'], lila: [16436, 'lila', 'purple', '#7A3FB4'],
  rosa: [16184, 'rosa', 'pink', '#EE6FA8'], brun: [12910, 'brun', 'brown', '#8A5A2B'],
};
const HEX = /^#[0-9A-Fa-f]{6}$/;
const colorName = (hex) => { const e = Object.values(COLORS).find((c) => c[3].toLowerCase() === String(hex).toLowerCase()); return e ? L(e[1], e[2]) : ''; };
const cmdLabel = (c) => L(c[1], c[2]);

/** En färdig ritning som knappsymbol, utan stödlinjerna (samma fasta ram för alla, så storleken bär betydelse). */
const plain = (svg) => svg.replace(/<line class="staff[^>]*\/>/g, '');
// Knapparna: samma ram för alla (himmel- och jordlinjen på samma höjd), men med mindre luft än i glosprogrammet.
const BTN_FRAME = [380, 1900];
const symbolOf = (id, unit) => { const c = deck.get(id); return c ? plain(G.symbolSVG(c, unit, '', BTN_FRAME, 90)) : ''; };

// ---------------------------------------------------------------- inställningar
const SKEY = 'bm-bildmakaren-v1';
const DEFAULTS = { level: 1, caps: true, size: 'm', contrast: 'normal', dwell: 0, scan: 'av', scanMode: 'knapp', scanTime: 1500,
  hold: 0, speakButtons: false, step: 'litet', drag: true, last: null };
const SET = { ...DEFAULTS };
/**
 * Elever (profiler) på en delad enhet: varje elev har egna inställningar och egna bilder. Namnet finns bara
 * här på enheten. Standardprofilen har id 'standard' och använder den ursprungliga nyckeln.
 */
const PKEY = 'bm-bildmakaren-elever';
let PROF = { list: [{ id: 'standard', name: '' }], cur: 'standard' };
try { const p = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (p?.list?.some((x) => x.id === 'standard')) PROF = p; } catch (_) { /* börja om */ }
if (!PROF.list.some((x) => x.id === PROF.cur)) PROF.cur = 'standard';
const skeyOf = (id) => (id === 'standard' ? SKEY : `${SKEY}:${id}`);
function loadSet() {
  Object.keys(SET).forEach((k) => delete SET[k]);
  Object.assign(SET, DEFAULTS);
  try { Object.assign(SET, JSON.parse(localStorage.getItem(skeyOf(PROF.cur)) || '{}')); } catch (_) { /* standardvärden */ }
}
loadSet();
const saveSet = () => { try { localStorage.setItem(skeyOf(PROF.cur), JSON.stringify(SET)); } catch (_) { /* privat fönster */ } };
const saveProf = () => { try { localStorage.setItem(PKEY, JSON.stringify(PROF)); } catch (_) { /* privat fönster */ } };
const profName = (id) => PROF.list.find((x) => x.id === id)?.name || L('Standard', 'Default');

// ---------------------------------------------------------------- bilden
const W = 1600, H = 1000;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const newDoc = () => ({ id: uid(), created: Date.now(), updated: Date.now(), bg: '#FFFFFF', panels: 1, profile: PROF.cur, items: [], assets: {} });
const st = { doc: newDoc(), sel: null, page: 'start', hist: [], last: null, dirty: false };
const item = (id) => st.doc.items.find((i) => i.id === id) || null;
const selItem = () => item(st.sel);

// ---- ritningar för böjda former (dåtid, plural …) laddas när de behövs, som i skrivfältet
let forms = window.BLISS_FORMER ? 'done' : null;
const formWaiters = [];
function loadForms(cb) {
  if (forms === 'done') { cb?.(); return; }
  if (cb) formWaiters.push(cb);
  if (forms === 'loading') return;
  forms = 'loading';
  const s = document.createElement('script');
  s.src = 'src/vendor/bliss-former.js';
  s.onload = () => { G.addDrawings(window.BLISS_FORMER); forms = 'done'; formWaiters.splice(0).forEach((f) => f()); };
  s.onerror = () => { forms = 'error'; s.remove(); formWaiters.splice(0).forEach((f) => f()); };
  document.head.appendChild(s);
}

// ---- mått
const SYM_H = 240;           // en Bliss-rad i bildens enheter (hela ramen, himmel till jord med marginal)
const CAP = 44, CAP_GAP = 62; // texten under symbolen
let meter = null;
function textW(t, size, bold = true) {
  meter = meter || document.createElement('canvas').getContext('2d');
  meter.font = `${bold ? 700 : 400} ${size}px "Atkinson Hyperlegible", Arial, sans-serif`;
  return meter.measureText(t).width;
}
/** Ett ords ritning: { vb: [x, y, w, h], inner } ur den färdiga ritningen (frameSVG = meningarnas ram). */
const pieceCache = new Map();
function piece(key) {
  if (pieceCache.has(key)) return pieceCache.get(key);
  if (!G.hasDrawing(key)) return null;
  const svg = plain(G.frameSVG(key, 1, '', true));
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const p = { vb, inner: svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') };
  pieceCache.set(key, p);
  return p;
}

/**
 * Egna sammansatta ord ("tjock+skalle"), enligt Fundamental Rules:
 *  - 4.3.5: tecknen i ett ord står med 1/4 rutas mellanrum (200 i ritningarnas enheter, där en ruta är 800 –
 *    samma mellanrum som originalmotorn har i BCI:s sammansatta ord).
 *  - 6.5.4.5: ett ord som användaren själv skapar inramas av combine-tecknet (BCI-AV 13382) i början och
 *    slutet, så att det syns att det inte är ett ord ur BCI:s ordförråd.
 *  - 7.0: grammatiska indikatorer tas bort inne i ett sammansatt ord; sakindikatorn står kvar.
 * Delarna är originalmotorns färdiga ritningar, oförändrade – bara placerade efter varandra. Finns redan ett
 * BCI-ord med exakt de delarna används BCI:s ord (utan combine-tecken).
 */
const COMBINE = '13382', WORD_GAP = 200;
// Grammatiska indikatorer (tas bort inne i ordet). Sak- och diminutivindikatorerna bär betydelse och står kvar.
const GRAMMAR_IND = new Set([8993, 8994, 8995, 8996, 8997, 8998, 8999, 9000, 9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008,
  9011, 24665, 24667, 24670, 24674, 24675, 24677, 24807, 28043, 28044]);
let byParts = null;
/** BCI-ordet som består av exakt de här delarna (id-lista), om det finns. */
function wordOfParts(ids) {
  if (!byParts) {
    byParts = new Map();
    for (const c of deck.values()) {
      if (c.v.c === 'GRAY' || c.raw.length < 1 || !c.raw.every((x) => typeof x === 'number')) continue;
      const k = c.raw.join(',');
      if (!byParts.has(k) && G.hasDrawing(String(c.id))) byParts.set(k, c.id);
    }
  }
  return byParts.get(ids.join(',')) ?? null;
}
/** Delens ritning inne i ett sammansatt ord: utan böjning och utan grammatisk indikator (7.0). */
function compoundBase(o) {
  const c = deck.get(o.id);
  if (c && c.raw.length >= 2 && GRAMMAR_IND.has(c.raw[c.raw.length - 1])) {
    const rest = c.raw.slice(0, -1);
    if (rest.length === 1 && typeof rest[0] === 'number' && G.hasDrawing(String(rest[0]))) return String(rest[0]);
    const same = rest.every((x) => typeof x === 'number') ? wordOfParts(rest) : null;
    if (same != null) return String(same);
  }
  return String(o.id);
}
/** Ett sammansatt ord ur valda alternativ: { key } för ett BCI-ord, annars { compound: [delarnas nycklar] }. */
function compoundOf(opts) {
  const base = opts.map(compoundBase);
  const bci = wordOfParts(base.map(Number));
  return bci != null ? { key: String(bci) } : { compound: base };
}
/** Ritningen för ett eget sammansatt ord: combine-tecken, delarna, combine-tecken, med 1/4 rutas mellanrum. */
function compoundPiece(keys) {
  const all = [COMBINE, ...keys, COMBINE].map(piece);
  if (all.some((p) => !p)) return null;
  // frameSVG(…, spaced) har 400 luft på var sida om ritningen: ritningens egen bredd är vb[2] − 800.
  let cursor = 0, inner = '';
  for (const p of all) {
    const bx = p.vb[0] + 400, bw = p.vb[2] - 800;
    inner += `<g transform="translate(${(cursor - bx).toFixed(1)} 0)">${p.inner}</g>`;
    cursor += bw + WORD_GAP;
  }
  const total = cursor - WORD_GAP;
  return { vb: [-400, all[0].vb[1], total + 800, all[0].vb[3]], inner };
}
/** Storlek (w, h) och innehåll (SVG i 0..w, 0..h) för ett item. */
function shapeSVG(kind, c) {
  switch (kind) {
    case 'cirkel': return [320, 320, `<circle cx="160" cy="160" r="150" fill="${c}"/>`];
    case 'kvadrat': return [320, 320, `<rect x="10" y="10" width="300" height="300" rx="8" fill="${c}"/>`];
    case 'triangel': return [320, 300, `<polygon points="160,10 310,290 10,290" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`];
    case 'linje': return [440, 60, `<line x1="25" y1="30" x2="415" y2="30" stroke="${c}" stroke-width="22" stroke-linecap="round"/>`];
    case 'pil': return [440, 160, `<line x1="25" y1="80" x2="330" y2="80" stroke="${c}" stroke-width="22" stroke-linecap="round"/>`
      + `<polygon points="300,18 425,80 300,142" fill="${c}" stroke="${c}" stroke-width="10" stroke-linejoin="round"/>`];
    case 'stjarna': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 62 : 155;
        pts.push(`${(160 + r * Math.cos(a)).toFixed(1)},${(168 + r * Math.sin(a)).toFixed(1)}`);
      }
      return [320, 320, `<polygon points="${pts.join(' ')}" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`];
    }
    case 'hjarta': return [320, 300, `<path d="M160 290 C 60 215 10 160 10 95 C 10 45 50 12 95 12 C 125 12 148 30 160 55 C 172 30 195 12 225 12 C 270 12 310 45 310 95 C 310 160 260 215 160 290 Z" fill="${c}"/>`];
    default: return [10, 10, ''];
  }
}
function blissSVG(it) {
  const k = SYM_H / 2120;   // ramens höjd (SENTENCE_FRAME i src/glosor.js: -60..2060)
  let x = 0, out = '', pending = false;
  for (const w of it.words) {
    if (w.key || w.compound) {
      const p = w.key ? piece(w.key) : compoundPiece(w.compound);
      if (!p) { pending = true; const pw = 160; out += `<text x="${x + pw / 2}" y="${SYM_H * 0.6}" font-size="64" text-anchor="middle" fill="${it.color}">…</text>`; x += pw; continue; }
      const sw = p.vb[2] * k, capW = it.caps ? textW(w.label, CAP) + 30 : 0, pw = Math.max(sw, capW);
      out += `<svg x="${(x + (pw - sw) / 2).toFixed(1)}" y="0" width="${sw.toFixed(1)}" height="${SYM_H}" viewBox="${p.vb.join(' ')}" overflow="visible"`
        + ` stroke="currentColor" stroke-width="38" stroke-linecap="round" stroke-linejoin="round" fill="none" color="${it.color}">${p.inner}</svg>`;
      if (it.caps) out += `<text x="${(x + pw / 2).toFixed(1)}" y="${SYM_H + CAP_GAP - 14}" font-size="${CAP}" text-anchor="middle" fill="${it.color}" font-weight="700">${esc(w.label)}</text>`;
      x += pw;
    } else {
      const pw = textW(w.text, 64) + 60;
      out += `<text x="${(x + pw / 2).toFixed(1)}" y="${SYM_H * 0.62}" font-size="64" text-anchor="middle" fill="${it.color}" font-weight="700">${esc(w.text)}</text>`;
      x += pw;
    }
  }
  if (pending && forms !== 'error') loadForms(() => render());
  return [Math.max(x, 60), SYM_H + (it.caps ? CAP_GAP : 0), out];
}
/** Pratbubbla runt blisstext: vit yta med kant i textens färg och en spets nere till vänster. */
const BUB = 46, TAIL = 70;
function bubbleSVG(w, h, c) {
  const W2 = w + 2 * BUB, H2 = h + 2 * BUB, r = 40;
  const d = `M ${r} 0 H ${W2 - r} Q ${W2} 0 ${W2} ${r} V ${H2 - r} Q ${W2} ${H2} ${W2 - r} ${H2} H 150 L 60 ${H2 + TAIL} L 90 ${H2} H ${r}`
    + ` Q 0 ${H2} 0 ${H2 - r} V ${r} Q 0 0 ${r} 0 Z`;
  return `<path d="${d}" fill="#FFFFFF" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`;
}
function contentOf(it) {
  if (it.type === 'bliss' && it.bubble) {
    const [w, h, body] = blissSVG(it);
    return [w + 2 * BUB, h + 2 * BUB + TAIL, `${bubbleSVG(w, h, it.color)}<g transform="translate(${BUB} ${BUB})">${body}</g>`];
  }
  if (it.type === 'shape') return shapeSVG(it.kind, it.color);
  if (it.type === 'image') {
    const src = st.doc.assets[it.aid] || '';
    return [it.w, it.h, `<image href="${esc(src)}" x="0" y="0" width="${it.w}" height="${it.h}" preserveAspectRatio="none"/>`];
  }
  return blissSVG(it);
}
const transformOf = (it, w, h) => `translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.r}) scale(${(it.flip ? -it.s : it.s).toFixed(4)} ${it.s.toFixed(4)}) translate(${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)})`;
function itemSVG(it, live) {
  const [w, h, body] = contentOf(it);
  const hit = live ? `<rect class="hit" x="0" y="0" width="${w}" height="${h}" fill="transparent"/>` : '';
  return `<g ${live ? `data-oid="${it.id}" ` : ''}transform="${transformOf(it, w, h)}">${hit}${body}</g>`;
}
/** Ramen runt det valda, överst i bilden så att den syns även när saken ligger bakom andra. */
function selSVG() {
  const it = selItem();
  if (!it) return '';
  const [w, h] = contentOf(it), m = 18 / it.s;
  const r = (c) => `<rect class="${c}" x="${-m}" y="${-m}" width="${w + 2 * m}" height="${h + 2 * m}" rx="${10 / it.s}" vector-effect="non-scaling-stroke"/>`;
  return `<g class="sel" transform="${transformOf(it, w, h)}" pointer-events="none">${r('sel-a')}${r('sel-b')}</g>`;
}
/** Rutorna i en bildserie (1–4): två eller tre i bredd, fyra som 2 × 2. */
function panelRects(n = st.doc.panels || 1) {
  if (n === 4) return [0, 1, 2, 3].map((i) => ({ x: (i % 2) * W / 2, y: Math.floor(i / 2) * H / 2, w: W / 2, h: H / 2 }));
  return Array.from({ length: n }, (_, i) => ({ x: i * W / n, y: 0, w: W / n, h: H }));
}
function framesSVG(n) {
  if (!n || n < 2) return '';
  return panelRects(n).map((r) => `<rect x="${r.x + 14}" y="${r.y + 14}" width="${r.w - 28}" height="${r.h - 28}" rx="10" fill="none" stroke="#1B1B1B" stroke-width="8"/>`).join('');
}
/** Hela bilden som fristående SVG (för PNG, utskrift och miniatyrer). */
function docSVG(doc = st.doc, width = W) {
  const prev = st.doc; st.doc = doc;
  try {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${width}" height="${Math.round(width * H / W)}"`
      + ` font-family="Atkinson Hyperlegible, Arial, sans-serif"><style>.bfill{fill:currentColor}</style>`
      + `<rect width="${W}" height="${H}" fill="${doc.bg}"/>${framesSVG(doc.panels)}${doc.items.map((i) => itemSVG(i, false)).join('')}</svg>`;
  } finally { st.doc = prev; }
}

// ---------------------------------------------------------------- historik (ångra) och sparande
const snapshot = () => JSON.stringify({ bg: st.doc.bg, panels: st.doc.panels || 1, items: st.doc.items });
/** Spara läget före en ändring. Samma kommando på samma sak inom 1,5 s blir ett enda steg att ångra. */
function before(cmd) {
  const key = `${cmd}:${st.sel}`, now = Date.now();
  if (!(st.last && st.last.key === key && now - st.last.t < 1500)) {
    st.hist.push(snapshot());
    if (st.hist.length > 60) st.hist.shift();
  }
  st.last = { key, t: now };
}
function undo() {
  const s = st.hist.pop();
  if (!s) return;
  const o = JSON.parse(s);
  st.doc.bg = o.bg; st.doc.panels = o.panels || 1; st.doc.items = o.items;
  if (!item(st.sel)) { st.sel = null; st.page = 'start'; }
  st.last = null;
  changed();
  say(L('Ångrat', 'Undone'));
}

const DB = (() => {
  let p = null;
  const open = () => (p = p || new Promise((res, rej) => {
    const r = indexedDB.open('bildmakaren', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('bilder', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('bilder', mode);
      const req = fn(t.objectStore('bilder'));
      t.oncomplete = () => res(req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    put: (d) => run('readwrite', (s) => s.put(d)), get: (id) => run('readonly', (s) => s.get(id)),
    all: () => run('readonly', (s) => s.getAll()), del: (id) => run('readwrite', (s) => s.delete(id)),
    /** Hela databasen bort (Radera allt): stäng förbindelsen först, annars väntar borttagningen. */
    async drop() {
      if (p) { try { (await p).close(); } catch (_) { /* redan stängd */ } p = null; }
      await new Promise((res) => { const r = indexedDB.deleteDatabase('bildmakaren'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    },
  };
})();

let saveTimer = null;
function changed() { st.dirty = true; st.doc.updated = Date.now(); render(); clearTimeout(saveTimer); saveTimer = setTimeout(persist, 900); }
async function persist() {
  clearTimeout(saveTimer);
  if (!st.dirty) return;
  st.dirty = false;
  const doc = st.doc;
  if (!doc.items.length && doc.bg === '#FFFFFF') return;   // en tom bild sparas inte
  // Bara de foton som används ligger kvar.
  const used = new Set(doc.items.filter((i) => i.type === 'image').map((i) => i.aid));
  for (const a of Object.keys(doc.assets)) if (!used.has(a)) delete doc.assets[a];
  let thumb = '';
  try { thumb = await pngURL(doc, 360); } catch (_) { /* miniatyren är valfri */ }
  try { await DB.put({ ...doc, thumb }); SET.last = doc.id; saveSet(); } catch (_) { /* utan lagring: fortsätt */ }
}
window.addEventListener('pagehide', () => { persist(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;
  persist();
  // Kameran stängs när appen läggs undan – den ska aldrig vara på i bakgrunden.
  if (stream) closeDialog();
});

// ---------------------------------------------------------------- PNG, utskrift, projektfil
async function pngCanvas(doc, width) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(docSVG(doc, width))}`;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = Math.round(width * H / W);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv;
}
const pngURL = async (doc, width) => (await pngCanvas(doc, width)).toDataURL('image/png');
const touchy = () => matchMedia('(pointer: coarse)').matches;
async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (touchy() && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const stamp = () => new Date().toLocaleDateString('sv-SE');
async function savePNG() {
  const cv = await pngCanvas(st.doc, 2400);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  await deliver(blob, `bliss-bild-${stamp()}.png`);
}
function printDoc() {
  const p = document.getElementById('print');
  p.innerHTML = docSVG(st.doc, W);
  setTimeout(() => window.print(), 50);
}
async function shareFile() {
  await persist();
  const blob = new Blob([JSON.stringify({ app: 'bildmakaren', v: 1, doc: st.doc })], { type: 'application/json' });
  await deliver(blob, `bliss-bild-${stamp()}.json`);
}
/** En bild ur en fil eller Mina bilder: bara kända fält och säkra värden (texten ritas in i SVG). */
function cleanDoc(d) {
  if (!d || !Array.isArray(d.items)) return null;
  const doc = newDoc();
  doc.bg = HEX.test(d.bg) ? d.bg : '#FFFFFF';
  const num = (v, a, b, def) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : def);
  doc.panels = Math.round(num(d.panels, 1, 4, 1));
  doc.profile = PROF.list.some((x) => x.id === d.profile) ? d.profile : PROF.cur;
  for (const [k, v] of Object.entries(d.assets || {})) {
    if (/^[\w-]{1,40}$/.test(k) && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) doc.assets[k] = v;
  }
  for (const i of d.items) {
    const base = { id: uid(), x: num(i.x, -W, 2 * W, W / 2), y: num(i.y, -H, 2 * H, H / 2), s: num(i.s, 0.05, 20, 1),
      r: num(i.r, -360, 360, 0), flip: !!i.flip, color: HEX.test(i.color) ? i.color : '#1B1B1B' };
    if (i.type === 'shape' && SHAPES[i.kind]) doc.items.push({ ...base, type: 'shape', kind: i.kind });
    else if (i.type === 'image' && doc.assets[i.aid]) doc.items.push({ ...base, type: 'image', aid: i.aid, w: num(i.w, 1, 4000, 400), h: num(i.h, 1, 4000, 400) });
    else if (i.type === 'bliss' && Array.isArray(i.words)) {
      const words = i.words.map((w) => (w && typeof w.key === 'string' && /^(\d+|f:\d+:\w+)$/.test(w.key)
        ? { key: w.key, label: String(w.label || '').slice(0, 80) }
        : w && Array.isArray(w.compound) && w.compound.length >= 2 && w.compound.length <= 8 && w.compound.every((k) => /^\d+$/.test(k))
          ? { compound: w.compound.map(String), label: String(w.label || '').slice(0, 80) }
          : { text: String(w?.text || '').slice(0, 80) }));
      doc.items.push({ ...base, type: 'bliss', text: String(i.text || '').slice(0, 2000), words, caps: i.caps !== false, bubble: !!i.bubble,
        picks: Array.isArray(i.picks) ? i.picks.map(String).slice(0, 200) : [] });
    }
  }
  return doc;
}
function openDoc(d, keepId) {
  const doc = cleanDoc(d);
  if (!doc) return false;
  if (keepId && d.id) { doc.id = d.id; doc.created = d.created || Date.now(); } else doc.profile = PROF.cur;   // kopia eller fil: till den här eleven
  if (doc.items.some((i) => i.type === 'bliss' && i.words.some((w) => w.key?.startsWith('f:')))) loadForms(() => render());
  st.doc = doc; st.sel = null; st.page = 'start'; st.hist = []; st.last = null;
  SET.last = doc.id; saveSet();
  render();
  return true;
}

// ---------------------------------------------------------------- att lägga till saker
/**
 * Något nytt läggs inte in direkt: först frågas var – mitt (förstavalet), upp, vänster, höger eller ner.
 * Tillbaka ångrar att man valde att lägga till.
 */
function add(it) {
  st.pending = it; st.sel = null; st.page = 'plats';
  render();
  say((st.doc.panels || 1) > 1 ? L(`I vilken ruta ska ${nameOf(it)} ligga?`, `Which panel should ${nameOf(it)} go in?`)
    : L(`Var ska ${nameOf(it)} ligga? Mitt, upp, vänster, höger eller ner.`, `Where should ${nameOf(it)} go? Middle, up, left, right or down.`));
}
const SPOTS = { mitt: [W / 2, H / 2], upp: [W / 2, H * 0.25], ner: [W / 2, H * 0.75], vanster: [W * 0.25, H / 2], hoger: [W * 0.75, H / 2] };
function place(spot) {
  const it = st.pending;
  const panel = /^ruta\d$/.test(spot) ? panelRects()[+spot.slice(4) - 1] : null;
  if (!it || (!SPOTS[spot] && !panel)) return;
  st.pending = null;
  before('add');
  let [x, y] = panel ? [panel.x + panel.w / 2, panel.y + panel.h / 2] : SPOTS[spot];
  if (panel) {
    // Saken görs mindre om den inte ryms i rutan.
    const [w, h] = contentOf(it);
    it.s = Math.min(it.s || 1, (panel.w * 0.82) / w, (panel.h * 0.82) / h);
  }
  // Ligger något redan just där hamnar det nya en bit snett nedanför, så att båda syns.
  while (st.doc.items.some((o) => Math.abs(o.x - x) < 12 && Math.abs(o.y - y) < 12)) { x += 36; y += 36; }
  Object.assign(it, { id: uid(), x: Math.min(W, x), y: Math.min(H, y), s: it.s || 1, r: 0, flip: false });
  st.doc.items.push(it);
  st.sel = it.id; st.page = 'edit';
  changed();
  say(L(`${nameOf(it)} tillagd`, `${nameOf(it)} added`));
}
function nameOf(it) {
  if (!it) return '';
  if (it.type === 'shape') return cmdLabel(SHAPES[it.kind]);
  if (it.type === 'image') return L('Bild', 'Picture');
  return it.text || L('Blisstext', 'Bliss text');
}
function addShape(kind) {
  const c = st.doc.bg.toLowerCase() === COLORS.bla[3].toLowerCase() ? COLORS.gul[3] : COLORS.bla[3];
  add({ type: 'shape', kind, color: c });
}
/** En bildfil -> foto i bilden (förminskas till högst 1600 px, så att bilden går att spara). */
async function addImageBlob(blob) {
  if (!blob || !/^image\//.test(blob.type)) return;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const max = 1600, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const data = blob.type === 'image/jpeg' ? cv.toDataURL('image/jpeg', 0.86) : cv.toDataURL('image/png');
    const aid = uid();
    st.doc.assets[aid] = data;
    const fit = Math.min(1, 640 / Math.max(cv.width, cv.height) * (cv.width > cv.height ? 1.2 : 1));
    add({ type: 'image', aid, w: Math.round(cv.width * fit), h: Math.round(cv.height * fit), color: '#1B1B1B' });
  } catch (_) {
    say(L('Bilden gick inte att öppna', 'The picture could not be opened'));
  } finally { URL.revokeObjectURL(url); }
}

// ---------------------------------------------------------------- att ändra det valda
const STEP = () => (SET.step === 'stort' ? 60 : 20);
function edit(cmd, fn) {
  const it = selItem();
  if (!it) return;
  before(cmd);
  fn(it);
  changed();
}
function move(dx, dy) {
  edit('flytta', (it) => {
    it.x = Math.min(W, Math.max(0, it.x + dx * STEP()));
    it.y = Math.min(H, Math.max(0, it.y + dy * STEP()));
  });
}
const resize = (k) => edit(k > 1 ? 'forstora' : 'forminska', (it) => { it.s = Math.min(8, Math.max(0.12, it.s * k)); });
const rotate = (d) => edit('vrida', (it) => { it.r = ((it.r + d + 540) % 360) - 180; });
function layer(d) {
  edit('lager', (it) => {
    const a = st.doc.items, i = a.indexOf(it), j = Math.min(a.length - 1, Math.max(0, i + d));
    a.splice(i, 1); a.splice(j, 0, it);
  });
}
/** Nära: större och längst fram. Långt bort: mindre och längst bak. (Perspektiv med två ord.) */
function depth(near) {
  edit(near ? 'nara' : 'langtbort', (it) => {
    it.s = Math.min(8, Math.max(0.12, it.s * (near ? 1.2 : 1 / 1.2)));
    const a = st.doc.items;
    a.splice(a.indexOf(it), 1);
    if (near) a.push(it); else a.unshift(it);
  });
}
function copySel() {
  const it = selItem();
  if (!it) return;
  before('kopiera');
  const c = JSON.parse(JSON.stringify(it));
  Object.assign(c, { id: uid(), x: Math.min(W, it.x + 50), y: Math.min(H, it.y + 50) });
  st.doc.items.push(c);
  st.sel = c.id;
  changed();
  say(L('Kopierad', 'Copied'));
}
function removeSel() {
  const it = selItem();
  if (!it) return;
  before('tabort');
  st.doc.items = st.doc.items.filter((i) => i !== it);
  st.sel = null; st.page = 'start';
  changed();
  say(L(`${nameOf(it)} borttagen`, `${nameOf(it)} removed`));
}
/** Välja: nästa sak i bilden (överst först), runt till början. */
function selectNext() {
  const a = st.doc.items;
  if (!a.length) return;
  const i = a.findIndex((x) => x.id === st.sel);
  const next = a[i <= 0 ? a.length - 1 : i - 1];
  select(next.id);
}
function select(id) {
  st.pending = null;
  st.sel = id; st.page = id ? 'edit' : 'start';
  render();
  if (id) say(L(`Vald: ${nameOf(item(id))}`, `Selected: ${nameOf(item(id))}`));
}

// ---------------------------------------------------------------- panelen (knapparna)
const grid = () => document.getElementById('grid');
function btn(c, act, o = {}) {
  const label = o.label || cmdLabel(c);
  const sw = o.swatch ? `<span class="swatch" style="background:${o.swatch}"></span>` : '';
  return `<button type="button" class="cmd${o.primary ? ' primary' : ''}${o.cls ? ` ${o.cls}` : ''}" data-act="${act}" data-scan`
    + `${o.repeat ? ' data-repeat' : ''}${o.first ? ' data-first' : ''}${o.disabled ? ' disabled' : ''}${o.pressed != null ? ` aria-pressed="${o.pressed}"` : ''}`
    + ` aria-label="${esc(label)}"><span class="sym-wrap" aria-hidden="true">${symbolOf(c[0], 6)}${sw}</span><span class="cap" aria-hidden="true">${esc(label)}</span></button>`;
}
const back = () => btn(CMD.tillbaka, 'back', { cls: 'back' });
function colorButtons(current) {
  return Object.entries(COLORS).map(([k, c]) => btn(c, `color:${k}`, { swatch: c[3], pressed: String(current).toLowerCase() === c[3].toLowerCase() })).join('');
}
/**
 * Nivåer (väljs av pedagogen i inställningarna): 1 Enkel, 2 Mer, 3 Allt. En högre nivå lägger alltid till
 * knappar EFTER de lägre, så att det eleven redan kan står kvar på samma plats. Ångra, inställningarna och
 * platsvalet finns på alla nivåer, liksom "välja" (utan den kan den med ögon eller kontakt inte välja om något).
 */
const lv = (n) => (SET.level || 1) >= n;
const at = (n, html) => (lv(n) ? html : '');
const SHAPE_LEVEL = { cirkel: 1, kvadrat: 1, triangel: 1, stjarna: 1, hjarta: 1, linje: 2, pil: 2 };
const PAGES = {
  start: () => [
    btn(CMD.skriva, 'skriva'), btn(CMD.bild, 'bild'), btn(CMD.kamera, 'kamera'), btn(CMD.form, 'page:form'),
    btn(CMD.valja, 'valja', { disabled: !st.doc.items.length }), btn(CMD.fil, 'page:fil'),
    at(2, btn(CMD.klistra, 'klistra')), at(2, btn(CMD.farg, 'page:bg')),
    at(2, speech.can() ? btn(CMD.berattelse, 'berattelse', { disabled: !st.doc.items.length }) : ''),
    at(3, btn(CMD.rektangel, 'page:rutor')),
  ],
  rutor: () => [back(), ...[1, 2, 3, 4].map((n) => btn(DIGITS[n], `panels:${n}`, { pressed: (st.doc.panels || 1) === n }))],
  form: () => [back(), ...Object.keys(SHAPE_LEVEL).filter((k) => lv(SHAPE_LEVEL[k])).map((k) => btn(SHAPES[k], `shape:${k}`))],
  bg: () => [back(), colorButtons(st.doc.bg)],
  fil: () => [back(), btn(CMD.ny, 'ny'), btn(CMD.oppna, 'oppna'), btn(CMD.sparasom, 'png'), btn(CMD.skrivaut, 'print'),
    at(3, btn(CMD.dela, 'dela')), at(3, btn(CMD.importera, 'importera'))],
  // Klar står först (uppe till vänster), som tillbaka på de andra sidorna: där lämnar man sidan.
  edit: () => {
    const it = selItem();
    return [
      btn(CMD.klar, 'klar', { primary: true }), btn(CMD.flytta, 'page:flytta'),
      btn(CMD.forstora, 'forstora', { repeat: true }), btn(CMD.forminska, 'forminska', { repeat: true }), btn(CMD.tabort, 'tabort'),
      at(2, btn(CMD.kopiera, 'kopiera')), at(2, btn(CMD.valja, 'valja', { disabled: st.doc.items.length < 2 })),
      at(2, btn(CMD.lager, 'page:lager')), at(3, btn(CMD.vrida, 'page:vrida')),
      // Knappar som bara gäller vissa saker sist, så att de andra inte flyttar sig mellan sakerna.
      it?.type === 'bliss' && speech.can() ? btn(CMD.saga, 'saga') : '',
      it?.type !== 'image' ? at(2, btn(CMD.farg, 'page:farg')) : '',
      it?.type === 'bliss' ? at(2, btn(CMD.redigera, 'redigera')) : '',
      it?.type === 'bliss' ? at(3, btn(CMD.bubbla, 'bubbla', { pressed: !!it.bubble })) : '',
      it?.type === 'bliss' ? at(3, btn(CMD.text, 'caps', { pressed: !!it.caps })) : '',
    ];
  },
  flytta: () => [back(), btn(CMD.upp, 'move:0:-1', { repeat: true, cls: 'd-up' }), btn(CMD.vanster, 'move:-1:0', { repeat: true, cls: 'd-left' }),
    btn(CMD.hoger, 'move:1:0', { repeat: true, cls: 'd-right' }), btn(CMD.ner, 'move:0:1', { repeat: true, cls: 'd-down' })],
  vrida: () => [back(), btn(CMD.vanster, 'rot:-15', { repeat: true }), btn(CMD.hoger, 'rot:15', { repeat: true }),
    btn(CMD.spegel, 'spegel')],
  farg: () => [back(), colorButtons(selItem()?.color)],
  lager: () => [back(), btn(CMD.nara, 'nara', { repeat: true }), btn(CMD.langtbort, 'langtbort', { repeat: true }),
    at(3, btn(CMD.framfor, 'layer:1')), at(3, btn(CMD.bakom, 'layer:-1'))],
  // Mitt först, så att den är förvald för tangentbord och kontakter; knapparna ligger där de placerar.
  plats: () => ((st.doc.panels || 1) > 1
    ? [...panelRects().map((_, i) => btn(DIGITS[i + 1], `place:ruta${i + 1}`, { first: i === 0, primary: i === 0, cls: `d-p${i + 1}` })), back()]
    : [btn(CMD.mitt, 'place:mitt', { cls: 'd-mid', primary: true, first: true }), btn(CMD.upp, 'place:upp', { cls: 'd-up' }),
    btn(CMD.vanster, 'place:vanster', { cls: 'd-left' }), btn(CMD.hoger, 'place:hoger', { cls: 'd-right' }),
    btn(CMD.ner, 'place:ner', { cls: 'd-down' }), back()]),
};
function renderPanel() {
  const g = grid();
  const had = document.activeElement?.closest?.('#panel') ? document.activeElement.dataset.act : null;
  g.className = `grid page-${st.page}${st.page === 'plats' && (st.doc.panels || 1) > 1 ? ` rutor-${st.doc.panels}` : ''}`;
  g.innerHTML = PAGES[st.page]().join('');
  document.getElementById('bar').innerHTML = btn(CMD.angra, 'undo', { disabled: !st.hist.length, cls: 'small' })
    + `<button type="button" class="cmd small gear" data-act="settings" data-scan aria-label="${L('Inställningar', 'Settings')}">`
    + `<span class="sym-wrap" aria-hidden="true">${GEAR}</span><span class="cap" aria-hidden="true">${L('Inställningar', 'Settings')}</span></button>`;
  if (st.page === 'plats' && !dlg().open) g.querySelector('[data-first]')?.focus({ preventScroll: true });
  else if (had) {
    const el = document.querySelector(`#panel [data-act="${had}"]`) || g.querySelector('button:not(:disabled)');
    el?.focus({ preventScroll: true });
  }
}
const GEAR = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

function renderCanvas() {
  document.getElementById('frames').innerHTML = framesSVG(st.doc.panels);
  document.getElementById('items').innerHTML = st.doc.items.map((i) => itemSVG(i, true)).join('') + selSVG();
  document.getElementById('paper').setAttribute('fill', st.doc.bg);
}
function applySettings() {
  const b = document.body.classList;
  b.toggle('no-caps', !SET.caps);
  b.remove('size-m', 'size-l', 'size-xl'); b.add(`size-${SET.size}`);
  b.toggle('hc', SET.contrast === 'hog');
}
function render() { renderCanvas(); renderPanel(); }

/**
 * Uppläsning med enhetens egna röster. Bara röster som finns lokalt (localService) används: vissa
 * webbläsare har röster som skickar texten till en server, och det ska aldrig hända här.
 */
const speech = (() => {
  const ok = 'speechSynthesis' in window;
  let voice = null;
  const pick = () => {
    if (!ok) return;
    const want = G.lang() === 'en' ? /^en/i : /^sv/i;
    voice = speechSynthesis.getVoices().find((v) => v.localService && want.test(v.lang)) || null;
    // Rösterna kan komma efter att sidan ritats: rita om knapparna (säga, berättelse) när de finns.
    setTimeout(() => { if (document.getElementById('grid')) renderPanel(); }, 0);
  };
  if (ok) { pick(); speechSynthesis.addEventListener?.('voiceschanged', pick); }
  return {
    can: () => !!voice,
    say(t) {
      if (!voice || !t) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(t));
      u.voice = voice; u.lang = voice.lang; u.rate = 0.9;
      speechSynthesis.speak(u);
    },
    stop() { if (ok) speechSynthesis.cancel(); },
  };
})();
/** Det som läses upp för en sak i bilden. */
function spokenOf(it) {
  // ord+ord läses som ett ord; ett fristående plustecken som "plus".
  if (it.type === 'bliss') {
    return plusSigns(it.text).replace(/(?<=[\p{L}\p{N}])\+(?=[\p{L}\p{N}])/gu, '').replace(/\+/g, ' plus ').replace(/\s+/g, ' ').trim();
  }
  if (it.type === 'image') return L('bild', 'picture');
  const c = colorName(it.color);
  return `${cmdLabel(SHAPES[it.kind])}${c ? `, ${c}` : ''}`;
}
/** Berättelse: allt i bilden uppläst i läsordning (ruta för ruta, uppifrån och ner, från vänster). */
function storyText() {
  const rects = panelRects();
  const panelOf = (it) => Math.max(0, rects.findIndex((r) => it.x >= r.x && it.x < r.x + r.w && it.y >= r.y && it.y < r.y + r.h));
  const items = st.doc.items.map((it) => ({ it, p: panelOf(it), row: Math.round(it.y / 220) }))
    .sort((a, b) => a.p - b.p || a.row - b.row || a.it.x - b.it.x);
  const out = [];
  let last = -1;
  for (const { it, p } of items) {
    if (rects.length > 1 && p !== last) { out.push(L(`Ruta ${p + 1}.`, `Panel ${p + 1}.`)); last = p; }
    out.push(`${spokenOf(it)}.`);
  }
  return out.join(' ');
}
const say = (t) => { const l = document.getElementById('live'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); };

// ---------------------------------------------------------------- dialoger
const dlg = () => document.getElementById('dlg');
let onClose = null;
function openDialog(cls, html, wire) {
  const d = dlg();
  d.className = cls;
  d.innerHTML = html;
  if (!d.open) d.showModal();
  wire?.(d);
  d.querySelector('[autofocus]')?.focus();
}
function closeDialog() {
  const d = dlg();
  if (d.open) d.close();
  d.innerHTML = '';
  const f = onClose; onClose = null; f?.();
  renderPanel();
}
dlg().addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(); });

// ---- skriva: svensk text -> blisstext (tolkningen är skrivfältets, src/glosor-skriv.js)
const ws = { text: '', words: [], group: [], groups: [], picks: new Map(), sel: null, editId: null };
/**
 * Texten -> ord (skrivfältets tolkning). "ord+ord" (utan mellanslag) blir en grupp: varje del tolkas för sig
 * (och kan bytas som vanligt) och sätts ihop till ett ord. group[i] = gruppens nummer för ord i, annars null.
 * Ett plustecken med mellanslag ("tjock + skalle", eller ensamt) sätter inte ihop något: det skrivs som
 * BCI:s plustecken (12374 och, också, plus) med "+" under.
 */
const PLUS = 12374;
const plusSigns = (t) => String(t || '').replace(/[\uFF0B\uFE62\u2795]/g, '+');   // ＋ ﹢ ➕ från andra tangentbord
const plusWord = (w) => (w.text === '+' && !w.options.length
  ? { ...w, options: [{ id: PLUS, form: null, key: String(PLUS) }, { text: true, key: 'text' }] } : w);
function parseWrite(text) {
  const toks = plusSigns(text).split(/\s+/).filter(Boolean);
  const words = [], group = [], groups = [];
  let buf = [];
  const push = (list, g) => {
    const off = words.length;
    for (const w0 of list) {
      const w = plusWord(w0);
      if (w.futureFrom != null) w.futureFrom += off;
      words.push(w); group.push(g);
    }
  };
  const flush = () => { if (buf.length) push(G.writeWords(buf.join(' ')), null); buf = []; };
  for (const t of toks) {
    // Ihop bara när plustecknet står direkt mellan två ord; annars blir plustecknet ett eget ord.
    const parts = t.split('+');
    if (parts.length < 2 || !parts.every((x) => /[\p{L}\p{N}]/u.test(x))) { buf.push(...t.split(/(\+)/).filter(Boolean)); continue; }
    flush();
    const g = groups.length;
    // Ett ord: bara första delen behåller stor bokstav ("Tjock+Skalle" -> "Tjockskalle").
    groups.push({ text: parts.map((x, i) => { const w = x.replace(/[^\p{L}\p{N}-]/gu, ''); return i ? w.toLowerCase() : w; }).join('') });
    for (const part of parts) push(G.writeWords(part), g);
  }
  flush();
  return { words, group, groups };
}
function writeDialog(editIt) {
  ws.editId = editIt?.id || null;
  ws.text = editIt?.text || '';
  ws.picks = new Map(); ws.sel = null;
  if (editIt) {
    // Tidigare val står kvar för samma ord på samma plats.
    parseWrite(ws.text).words.forEach((w, i) => { const j = w.options.findIndex((o) => o.key === editIt.picks?.[i]); if (j > 0) ws.picks.set(i, j); });
  }
  loadForms(() => { if (dlg().classList.contains('write')) updateWrite(); });
  openDialog('write', `
    <label class="w-label" for="w-text">${L('Skriv på svenska', 'Write in English')}</label>
    <textarea id="w-text" rows="2" lang="${G.lang()}" autocomplete="off" autocapitalize="sentences" spellcheck="false" autofocus>${esc(ws.text)}</textarea>
    <div id="w-out" class="w-out" aria-live="polite"></div>
    <div id="w-opts" class="w-opts"></div>
    <div class="dlg-actions">${back()}${btn(CMD.klar, 'w-done', { primary: true })}</div>`, (d) => {
    const ta = d.querySelector('#w-text');
    ta.addEventListener('input', () => { ws.text = ta.value; ws.picks = new Map(); ws.sel = null; updateWrite(); });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); act('w-done'); } });
    updateWrite();
  });
}
function chosenWrite() { return G.chosenOptions(ws.words, (i) => ws.picks.get(i)); }
/** Det sammansatta ordet för grupp g: { key } / { compound } / null (någon del saknar symbol). */
function groupWord(g, ch) {
  const opts = ws.words.map((_, i) => i).filter((i) => ws.group[i] === g).map((i) => ch[i]);
  if (opts.some((o) => !o || o.skip || o.text || o.id == null)) return null;
  return compoundOf(opts);
}
/** Förhandsvisning av ett ord (enkel ritning eller sammansatt) i skrivrutan. */
function wordPreview(w, unit) {
  const p = w.key ? piece(w.key) : compoundPiece(w.compound);
  if (!p) return '<span class="w-txt">…</span>';
  return `<svg viewBox="${p.vb.join(' ')}" width="${(p.vb[2] * unit / 100).toFixed(0)}" height="${(p.vb[3] * unit / 100).toFixed(0)}"`
    + ` stroke="currentColor" stroke-width="38" stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true">${p.inner}</svg>`;
}
function updateWrite() {
  Object.assign(ws, parseWrite(ws.text));
  const ch = chosenWrite();
  const out = document.getElementById('w-out'), opts = document.getElementById('w-opts');
  if (!out) return;
  if (!ws.words.length) {
    out.innerHTML = `<p class="w-empty">${symbolOf(CMD.skriva[0], 4)}</p>`;
  } else {
    const groupEnd = (i) => ws.group[i] != null && ws.group[i + 1] !== ws.group[i];
    const groupStart = (i) => ws.group[i] != null && ws.group[i - 1] !== ws.group[i];
    out.innerHTML = ws.words.map((w, i) => {
      const o = ch[i];
      let html = '';
      if (groupStart(i)) html += '<span class="w-compound"><span class="w-parts">';
      html += wordButton(w, i, o);
      if (groupEnd(i)) {
        const g = ws.group[i], gw = groupWord(g, ch), text = ws.groups[g].text;
        const res = gw ? wordPreview(gw, 4.2) : `<span class="w-txt">${esc(text)}</span>`;
        const note = !gw ? L('blir text: en del saknar symbol', 'becomes text: a part has no symbol')
          : gw.key ? L('BCI:s eget ord', 'BCI’s own word') : L('eget ord', 'own word');
        html += `</span><span class="w-result" aria-label="${esc(text)}, ${esc(note)}">${res}<span class="cap-always">${esc(text)}</span><small class="w-note">${esc(note)}</small></span></span>`;
      }
      return html;
    }).join('');
  }
  renderOptions(ch, opts);
}
/** Ett ord i skrivrutan; har det flera tolkningar trycker man på det för att byta. */
function wordButton(w, i, o) {
  if (o?.skip) return '';
  const pic = !o || o.text ? `<span class="w-txt">${esc(w.text)}</span>`
    : G.hasDrawing(o.key) ? plain(G.frameSVG(o.key, 4.2, '', true)) : '<span class="w-txt">…</span>';
  const many = w.options.length > 1;
  return `<button type="button" class="w-word${ws.sel === i ? ' open' : ''}" data-act="w-word:${i}" data-scan ${many ? '' : 'disabled'}`
    + ` aria-label="${esc(w.text)}${many ? ` – ${L('byt', 'change')}` : ''}">${pic}<span class="cap-always">${esc(w.text)}</span>${many ? '<span class="more" aria-hidden="true">▾</span>' : ''}</button>`;
}
function renderOptions(ch, opts) {
  if (ws.sel != null && ws.words[ws.sel]) {
    const w = ws.words[ws.sel], cur = ch[ws.sel];
    opts.innerHTML = w.options.map((o, j) => {
      const pic = o.skip || o.text ? `<span class="w-txt">${o.skip ? '–' : esc(w.text)}</span>`
        : G.hasDrawing(o.key) ? plain(G.frameSVG(o.key, 3.2, '', true)) : '…';
      const label = o.skip ? L('utan', 'without') : o.text ? L('text', 'text') : G.optionLabel(o);
      return `<button type="button" class="w-opt" data-act="w-opt:${j}" data-scan aria-pressed="${o.key === cur?.key}" aria-label="${esc(label)}">${pic}<span class="cap-always">${esc(label)}</span></button>`;
    }).join('');
  } else opts.innerHTML = '';
  const done = dlg().querySelector('[data-act="w-done"]');
  if (done) done.disabled = !ws.words.some((w, i) => ch[i] && !ch[i].skip);
}
function finishWrite() {
  const ch = chosenWrite();
  const words = [];
  ws.words.forEach((w, i) => {
    const g = ws.group[i];
    if (g != null) {
      // Ett sammansatt ord läggs in en gång, vid sin sista del.
      if (ws.group[i + 1] === g) return;
      const gw = groupWord(g, ch), text = ws.groups[g].text;
      words.push(gw ? { ...gw, label: text } : { text });
      return;
    }
    const o = ch[i];
    if (!o || o.skip) return;
    words.push(o.text || !o.key ? { text: w.text } : { key: o.key, label: w.text });
  });
  if (!words.length) return;
  const picks = ch.map((o) => o?.key || '');
  const old = item(ws.editId);
  closeDialog();
  if (old) {
    before('redigera');
    Object.assign(old, { text: ws.text.trim(), words, picks });
    changed();
  } else {
    const it = { type: 'bliss', text: ws.text.trim(), words, picks, caps: true, color: COLORS.svart[3] };
    // En lång mening görs mindre så att den ryms i bilden.
    const [w] = blissSVG(it);
    it.s = Math.min(1, (W - 160) / w);
    add(it);
  }
}

// ---- kamera
let stream = null;
async function cameraDialog() {
  if (!navigator.mediaDevices?.getUserMedia) { document.getElementById('file-cam').click(); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (_) { document.getElementById('file-cam').click(); return; }
  onClose = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  openDialog('camera', `<video id="cam" autoplay playsinline muted></video>
    <div class="dlg-actions">${back()}${btn(CMD.kamera, 'snap', { primary: true })}</div>`, (d) => {
    d.querySelector('#cam').srcObject = stream;
  });
}
async function snap() {
  const v = document.getElementById('cam');
  if (!v || !v.videoWidth) return;
  const cv = document.createElement('canvas');
  cv.width = v.videoWidth; cv.height = v.videoHeight;
  cv.getContext('2d').drawImage(v, 0, 0);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.88));
  closeDialog();
  addImageBlob(blob);
}

// ---- klistra in
async function pasteCmd() {
  try {
    if (!navigator.clipboard?.read) throw new Error('no');
    for (const ci of await navigator.clipboard.read()) {
      const t = ci.types.find((x) => x.startsWith('image/'));
      if (t) { await addImageBlob(await ci.getType(t)); return; }
      if (ci.types.includes('text/plain')) {
        const txt = await (await ci.getType('text/plain')).text();
        if (txt.trim()) { writeDialog({ text: txt.trim() }); return; }
      }
    }
    say(L('Inget att klistra in', 'Nothing to paste'));
  } catch (_) {
    infoDialog(L('Kopiera en bild i ett annat program och tryck sedan Ctrl+V (⌘V på Mac).',
      'Copy a picture in another program, then press Ctrl+V (⌘V on a Mac).'));
  }
}
document.addEventListener('paste', (e) => {
  if (e.target.closest?.('textarea, input')) return;
  const items = [...(e.clipboardData?.items || [])];
  const img = items.find((i) => i.type.startsWith('image/'));
  if (img) { e.preventDefault(); addImageBlob(img.getAsFile()); return; }
  const txt = e.clipboardData?.getData('text/plain');
  if (txt?.trim()) { e.preventDefault(); writeDialog({ text: txt.trim() }); }
});
function infoDialog(text) {
  openDialog('info', `<p class="info-text">${esc(text)}</p><div class="dlg-actions">${btn(CMD.klar, 'close', { primary: true })}</div>`);
}

// ---- Mina bilder (öppna)
/** Mina bilder: den här elevens bilder, nyast först, med datum (en portfolio). Kopiera = använd som mall. */
const mine = { mode: null, list: [] };
const ownDoc = (d) => (d.profile || 'standard') === PROF.cur;
const dateOf = (t) => new Date(t).toLocaleString(G.lang() === 'en' ? 'en-GB' : 'sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
async function openList() {
  await persist();
  try { mine.list = (await DB.all()).filter(ownDoc).sort((a, b) => b.updated - a.updated); } catch (_) { mine.list = []; }
  mine.mode = null;
  drawList();
}
function drawList() {
  const cards = mine.list.map((d, i) => `<button type="button" class="thumb${d.id === st.doc.id ? ' current' : ''}" data-act="pick:${i}" data-scan`
    + ` aria-label="${L('Bild', 'Picture')} ${i + 1}, ${dateOf(d.updated)}">`
    + `${d.thumb ? `<img src="${esc(d.thumb)}" alt="">` : '<span class="thumb-empty"></span>'}<span class="thumb-date" aria-hidden="true">${dateOf(d.updated)}</span></button>`).join('');
  const empty = mine.list.length ? '' : `<p class="info-text">${L('Inga sparade bilder än.', 'No saved pictures yet.')}</p>`;
  openDialog(`list${mine.mode ? ` mode-${mine.mode}` : ''}`, `<div class="thumbs">${cards}</div>${empty}
    <div class="dlg-actions">${back()}${mine.list.length ? btn(CMD.kopiera, 'list-mode:copy', { pressed: mine.mode === 'copy' })
      + btn(CMD.tabort, 'list-mode:del', { pressed: mine.mode === 'del' }) : ''}</div>`);
}
function pickFromList(i) {
  const d = mine.list[i];
  if (!d) return;
  if (mine.mode === 'copy') {
    // En kopia som ny bild: originalet (mallen) står kvar orört.
    closeDialog();
    openDoc(d, false);
    st.dirty = true; persist();
    say(L('Kopia av bilden', 'Copy of the picture'));
    return;
  }
  if (mine.mode === 'del') {
    openDialog('confirm', `<div class="confirm-pic">${d.thumb ? `<img src="${esc(d.thumb)}" alt="">` : ''}</div>
      <div class="confirm-q">${symbolOf(CMD.tabort[0], 6)}<span>?</span></div>
      <div class="dlg-actions">${btn(CMD.tillbaka, 'list-back', { cls: 'back' })}${btn(CMD.ja, `del:${i}`, { primary: true })}</div>`);
    return;
  }
  closeDialog();
  openDoc(d, true);
}
async function deleteFromList(i) {
  const d = mine.list[i];
  if (!d) return;
  try { await DB.del(d.id); } catch (_) { /* inget att göra */ }
  if (d.id === st.doc.id) { st.doc = newDoc(); st.sel = null; st.page = 'start'; st.hist = []; st.dirty = false; render(); }
  mine.list.splice(i, 1);
  drawList();
}

// ---- inställningar (för den som hjälper till; text, med kugghjulet)
function settingsDialog() {
  const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, t]) => `<button type="button" data-act="set:${key}:${v}" data-scan aria-pressed="${String(SET[key]) === String(v)}">${t}</button>`).join('')}</div>`;
  const row = (label, html) => `<div class="row"><span>${label}</span>${html}</div>`;
  const elever = PROF.list.map((x) => `<button type="button" data-act="prof:${x.id}" data-scan aria-pressed="${x.id === PROF.cur}">${esc(profName(x.id))}</button>`).join('');
  openDialog('settings', `<h2>${L('Inställningar', 'Settings')}</h2>
    <h3>${L('Elev', 'Student')}</h3>
    <div class="row"><div class="seg" role="group">${elever}</div>
      ${PROF.cur !== 'standard' ? `<button type="button" class="danger small-danger" data-act="prof-del-ask" data-scan>${L('Ta bort eleven', 'Remove student')}</button>` : ''}</div>
    <div class="row new-prof"><input id="p-name" maxlength="30" autocomplete="off" placeholder="${L('Namn', 'Name')}" aria-label="${L('Ny elev: namn', 'New student: name')}">
      <button type="button" class="plain-btn" data-act="prof-add" data-scan>${L('Ny elev', 'New student')}</button></div>
    <p class="help">${L('Varje elev har egna inställningar och bilder. Använd gärna bara förnamn eller ett smeknamn.', 'Each student has their own settings and pictures. Preferably use only a first name or a nickname.')}</p>

    <h3>${L('Knappar', 'Buttons')}</h3>
    ${row(L('Nivå', 'Level'), seg('level', [[1, L('1 Enkel', '1 Simple')], [2, L('2 Mer', '2 More')], [3, L('3 Allt', '3 All')]]))}
    <p class="help level-help">${[
    L('1: skriva, bild, kamera, form, välja, fil – flytta, förstora, förminska, ta bort, säga.', '1: write, picture, camera, shape, choose, file – move, enlarge, reduce, remove, say.'),
    L('2: dessutom klistra, bakgrundsfärg, berättelse, linje, pil – kopiera, nära/långt bort, färg, redigera.', '2: also paste, background colour, story, line, arrow – copy, near/far, colour, edit.'),
    L('3: dessutom rutor (bildserie), vrida, spegla, framför/bakom, bubbla, text av/på, dela och importera fil.', '3: also panels (picture series), rotate, mirror, in front/behind, bubble, text on/off, share and import file.'),
  ][(SET.level || 1) - 1]}</p>
    ${row(L('Text under knapparna', 'Text under the buttons'), seg('caps', [[true, L('Visa', 'Show')], [false, L('Dölj', 'Hide')]]))}
    ${row(L('Knappstorlek', 'Button size'), seg('size', [['m', L('Normal', 'Normal')], ['l', L('Stor', 'Large')], ['xl', L('Störst', 'Largest')]]))}
    ${row(L('Kontrast', 'Contrast'), seg('contrast', [['normal', L('Normal', 'Normal')], ['hog', L('Hög', 'High')]]))}

    <h3>${L('Styrning', 'Access')}</h3>
    ${row(L('Ögonstyrning: välj genom att titta', 'Eye gaze: choose by looking'), seg('dwell', [[0, L('Av', 'Off')], [800, '0,8 s'], [1200, '1,2 s'], [1800, '1,8 s'], [2500, '2,5 s']]))}
    ${row(L('Kontakter (scanning)', 'Switches (scanning)'), seg('scan', [['av', L('Av', 'Off')], ['auto', L('1 kontakt', '1 switch')], ['steg', L('2 kontakter', '2 switches')]]))}
    ${row(L('Scanning', 'Scanning'), seg('scanMode', [['knapp', L('Knapp för knapp', 'Button by button')], ['rad', L('Rad för rad', 'Row by row')]]))}
    ${row(L('Scanningens takt', 'Scanning speed'), seg('scanTime', [[1000, '1 s'], [1500, '1,5 s'], [2000, '2 s'], [3000, '3 s']]))}
    ${row(L('Håll kontakten nere minst', 'Hold the switch down at least'), seg('hold', [[0, L('Direkt', 'At once')], [300, '0,3 s'], [600, '0,6 s'], [1000, '1 s']]))}
    ${row(L('Steg när man flyttar', 'Step when moving'), seg('step', [['litet', L('Litet', 'Small')], ['stort', L('Stort', 'Large')]]))}
    ${row(L('Dra i bilden med finger eller mus', 'Drag in the picture with finger or mouse'), seg('drag', [[true, L('På', 'On')], [false, L('Av', 'Off')]]))}
    <p class="help">${L('1 kontakt: knapparna markeras en i taget – tryck (mellanslag eller Enter) när rätt är markerat. 2 kontakter: mellanslag går vidare, Enter väljer. Rad för rad: välj först raden, sedan knappen. Tangentbord: piltangenterna flyttar, + och − ändrar storlek, Delete tar bort, Ctrl+Z ångrar.',
      '1 switch: the buttons are highlighted one at a time – press (space or Enter) at the right one. 2 switches: space moves on, Enter chooses. Row by row: first choose the row, then the button. Keyboard: arrow keys move, + and − change size, Delete removes, Ctrl+Z undoes.')}</p>

    <h3>${L('Tal', 'Speech')}</h3>
    ${speech.can() ? row(L('Läs upp knappen som markeras', 'Read out the highlighted button'), seg('speakButtons', [[false, L('Av', 'Off')], [true, L('På', 'On')]]))
    : `<p class="help">${L('Det finns ingen svensk röst på den här enheten. Lägg till en i enhetens inställningar för tal, så kan appen läsa upp.', 'There is no voice for this language on this device. Add one in the device speech settings and the app can read aloud.')}</p>`}

    <h3>${L('Integritet', 'Privacy')}</h3>
    <ul class="privacy">
      <li>${L('Allt stannar på den här enheten. Appen skickar inget till någon.', 'Everything stays on this device. The app sends nothing to anyone.')}</li>
      <li>${L('Ingen inloggning, ingen statistik, inga kakor.', 'No login, no statistics, no cookies.')}</li>
      <li>${L('Uppläsningen använder bara enhetens egna röster.', 'Reading aloud only uses the device’s own voices.')}</li>
      <li>${L('Kameran används bara när du trycker på kamera.', 'The camera is only used when you press camera.')}</li>
      <li>${L('Foton rensas från plats och annan dold information.', 'Photos are cleaned of location and other hidden information.')}</li>
      <li>${L('Det du själv lägger in, delar eller skriver ut ansvarar du för.', 'You are responsible for what you add, share or print.')}</li>
    </ul>
    <button type="button" class="danger" data-act="wipe-ask" data-scan>${L('Radera allt på enheten', 'Delete everything on this device')}</button>
    <p class="credits">${L('Symbolerna ur BCI-AV (© Blissymbolics Communication International, CC BY-SA 4.0), ritade med BlissEngine (© AnyCom AB – P-O Hedvall och Jonas Paulsson, CC BY 4.0).',
      'Symbols from BCI-AV (© Blissymbolics Communication International, CC BY-SA 4.0), drawn with BlissEngine (© AnyCom AB – P-O Hedvall and Jonas Paulsson, CC BY 4.0).')}</p>
    <div class="dlg-actions">${btn(CMD.klar, 'close', { primary: true })}</div>`, (d) => {
    d.querySelector('#p-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addProfile(); } });
  });
}

// ---- elever
/** Byt elev: den nuvarande bilden sparas, elevens inställningar och senaste bild öppnas. */
async function switchProfile(id) {
  if (!PROF.list.some((x) => x.id === id) || (id === PROF.cur && PROF.list.some((x) => x.id === PROF.cur))) return;
  await persist();
  PROF.cur = id; saveProf(); loadSet(); applySettings();
  window.Bildmakaren.onSettings?.();
  st.doc = newDoc(); st.sel = null; st.page = 'start'; st.hist = []; st.last = null; st.pending = null; st.dirty = false;
  let d = null;
  try { if (SET.last) d = await DB.get(SET.last); } catch (_) { /* ny bild */ }
  if (d && ownDoc(d)) openDoc(d, true); else render();
  settingsDialog();
  say(L(`Elev: ${profName(id)}`, `Student: ${profName(id)}`));
}
function addProfile() {
  const inp = document.getElementById('p-name');
  const name = (inp?.value || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (!name) { inp?.focus(); return; }
  const id = uid();
  PROF.list.push({ id, name }); saveProf();
  switchProfile(id);
}
function profDelAsk() {
  openDialog('confirm', `<p class="info-text">${L(`Ta bort ${esc(profName(PROF.cur))} och alla elevens bilder från den här enheten? Det går inte att ångra.`,
    `Remove ${esc(profName(PROF.cur))} and all their pictures from this device? This cannot be undone.`)}</p>
    <div class="confirm-q">${symbolOf(CMD.tabort[0], 6)}<span>?</span></div>
    <div class="dlg-actions">${btn(CMD.tillbaka, 'settings', { cls: 'back' })}${btn(CMD.ja, 'prof-del', { primary: true })}</div>`);
}
/** Eleven bort: namnet, inställningarna och elevens alla bilder. */
async function deleteProfile() {
  const id = PROF.cur;
  if (id === 'standard') return;
  clearTimeout(saveTimer); st.dirty = false;
  try { for (const d of await DB.all()) if (d.profile === id) await DB.del(d.id); } catch (_) { /* inget att radera */ }
  try { localStorage.removeItem(skeyOf(id)); } catch (_) { /* privat fönster */ }
  const name = profName(id);
  PROF.list = PROF.list.filter((x) => x.id !== id);
  saveProf();
  await switchProfile('standard');
  say(L(`${name} är borttagen`, `${name} is removed`));
}
/** Radera allt: alla bilder och inställningar på enheten. Frågar först (ja / tillbaka). */
function wipeAsk() {
  openDialog('confirm', `<p class="info-text">${L('Radera alla bilder och inställningar på den här enheten? Det går inte att ångra.',
    'Delete all pictures and settings on this device? This cannot be undone.')}</p>
    <div class="confirm-q">${symbolOf(CMD.tabort[0], 6)}<span>?</span></div>
    <div class="dlg-actions">${btn(CMD.tillbaka, 'settings', { cls: 'back' })}${btn(CMD.ja, 'wipe', { primary: true })}</div>`);
}
async function wipe() {
  clearTimeout(saveTimer);
  st.dirty = false;
  await DB.drop();
  try {
    for (const k of Object.keys(localStorage)) if (k === PKEY || k === SKEY || k.startsWith(`${SKEY}:`)) localStorage.removeItem(k);
  } catch (_) { /* privat fönster */ }
  PROF = { list: [{ id: 'standard', name: '' }], cur: 'standard' };
  loadSet();
  st.doc = newDoc(); st.sel = null; st.page = 'start'; st.hist = []; st.last = null; st.pending = null;
  pieceCache.clear();
  applySettings();
  window.Bildmakaren.onSettings?.();
  closeDialog();
  render();
  say(L('Allt är raderat', 'Everything is deleted'));
}
function setSetting(key, raw) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key) || key === 'last') return;
  if (key === 'speakButtons' && raw === 'true') speech.say(L('Uppläsning på', 'Reading aloud on'));
  const v = raw === 'true' ? true : raw === 'false' ? false : /^\d+$/.test(raw) ? +raw : raw;
  SET[key] = v; saveSet(); applySettings();
  if (key === 'level') { st.page = st.sel ? 'edit' : 'start'; renderPanel(); }
  window.Bildmakaren.onSettings?.();
  settingsDialog();
  dlg().querySelector(`[data-act="set:${key}:${raw}"]`)?.focus();
}

// ---------------------------------------------------------------- alla kommandon
function act(a) {
  const [k, p1, p2] = a.split(':');
  switch (k) {
    case 'page': st.page = p1; render(); break;
    case 'back':
      if (dlg().open) closeDialog();
      else { if (st.page === 'plats') { st.pending = null; say(L('Inget tillagt', 'Nothing added')); } st.page = st.sel ? 'edit' : 'start'; render(); }
      break;
    case 'place': place(p1); break;
    case 'panels': before('panels'); st.doc.panels = Math.min(4, Math.max(1, +p1)); changed(); break;
    case 'nara': depth(true); break;
    case 'langtbort': depth(false); break;
    case 'bubbla': edit('bubbla', (it) => { it.bubble = !it.bubble; }); break;
    case 'saga': if (selItem()) speech.say(spokenOf(selItem())); break;
    case 'berattelse': speech.say(storyText()); break;
    case 'prof': switchProfile(p1); break;
    case 'prof-add': addProfile(); break;
    case 'prof-del-ask': profDelAsk(); break;
    case 'prof-del': deleteProfile(); break;
    case 'close': closeDialog(); break;
    case 'undo': undo(); break;
    case 'settings': settingsDialog(); break;
    case 'set': setSetting(p1, p2); break;
    case 'skriva': writeDialog(); break;
    case 'redigera': writeDialog(selItem()); break;
    case 'w-word': { const i = +p1; ws.sel = ws.sel === i ? null : i; updateWrite(); break; }
    case 'w-opt': ws.picks.set(ws.sel, +p1); ws.sel = null; updateWrite(); break;
    case 'w-done': finishWrite(); break;
    case 'bild': document.getElementById('file-img').click(); break;
    case 'kamera': cameraDialog(); break;
    case 'snap': snap(); break;
    case 'klistra': pasteCmd(); break;
    case 'shape': addShape(p1); break;
    case 'color': {
      const hex = COLORS[p1][3];
      if (st.page === 'bg') { before('bg'); st.doc.bg = hex; changed(); } else edit('farg', (it) => { it.color = hex; });
      say(cmdLabel(COLORS[p1]));
      break;
    }
    case 'valja': selectNext(); break;
    case 'klar': select(null); break;
    case 'forstora': resize(1.2); break;
    case 'forminska': resize(1 / 1.2); break;
    case 'move': move(+p1, +p2); break;
    case 'rot': rotate(+p1); break;
    case 'spegel': edit('spegel', (it) => { it.flip = !it.flip; }); break;
    case 'layer': layer(+p1); break;
    case 'caps': edit('caps', (it) => { it.caps = !it.caps; }); break;
    case 'kopiera': copySel(); break;
    case 'tabort': removeSel(); break;
    case 'ny': persist().then(() => { st.doc = newDoc(); st.sel = null; st.page = 'start'; st.hist = []; st.last = null; render(); say(L('Ny bild', 'New picture')); }); break;
    case 'oppna': openList(); break;
    case 'pick': pickFromList(+p1); break;
    case 'list-mode': mine.mode = mine.mode === p1 ? null : p1; drawList(); break;
    case 'list-back': drawList(); break;
    case 'del': deleteFromList(+p1); break;
    case 'wipe-ask': wipeAsk(); break;
    case 'wipe': wipe(); break;
    case 'png': savePNG().catch(() => say(L('Bilden kunde inte sparas', 'The picture could not be saved'))); break;
    case 'print': printDoc(); break;
    case 'dela': shareFile(); break;
    case 'importera': document.getElementById('file-proj').click(); break;
    default: break;
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  act(b.dataset.act);
});

// ---- filval
document.getElementById('file-img').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; addImageBlob(f); });
document.getElementById('file-cam').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; addImageBlob(f); });
document.getElementById('file-proj').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  await persist();
  try {
    const o = JSON.parse(await f.text());
    if (o?.app !== 'bildmakaren' || !openDoc(o.doc, false)) throw new Error('fel');
    st.dirty = true; persist();
    say(L('Bilden är öppnad', 'The picture is open'));
  } catch (_) { infoDialog(L('Filen är inte en bild från Bildmakaren.', 'The file is not a picture from Bildmakaren.')); }
});

// ---------------------------------------------------------------- att peka och dra i bilden
const svg = () => document.getElementById('canvas');
function toSvg(e) {
  const p = svg().createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg().getScreenCTM().inverse());
}
let drag = null;
svg().addEventListener('pointerdown', (e) => {
  const g = e.target.closest('[data-oid]');
  if (!g) { if (st.sel) select(null); return; }
  const id = g.dataset.oid;
  if (st.sel !== id) select(id);
  if (!SET.drag) return;
  const it = item(id), p = toSvg(e);
  drag = { id, x0: it.x, y0: it.y, px: p.x, py: p.y, moved: false, pid: e.pointerId };
  svg().setPointerCapture(e.pointerId);
});
svg().addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  const p = toSvg(e), dx = p.x - drag.px, dy = p.y - drag.py;
  if (!drag.moved && Math.hypot(dx, dy) < 14) return;   // darrningar och små ryck flyttar inget
  if (!drag.moved) { before('drag'); drag.moved = true; }
  const it = item(drag.id);
  it.x = Math.min(W, Math.max(0, drag.x0 + dx)); it.y = Math.min(H, Math.max(0, drag.y0 + dy));
  const g = svg().querySelector(`[data-oid="${drag.id}"]`), [w, h] = contentOf(it);
  g?.setAttribute('transform', transformOf(it, w, h));
  svg().querySelector('.sel')?.setAttribute('transform', transformOf(it, w, h));
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  const moved = drag.moved; drag = null;
  if (moved) { st.last = null; changed(); }
};
svg().addEventListener('pointerup', endDrag);
svg().addEventListener('pointercancel', endDrag);

// ---------------------------------------------------------------- start
async function start() {
  applySettings();
  render();
  if (SET.last) {
    try { const d = await DB.get(SET.last); if (d && ownDoc(d)) openDoc(d, true); } catch (_) { /* börja med en tom bild */ }
  }
  document.fonts?.ready.then(() => { if (st.doc.items.some((i) => i.type === 'bliss')) render(); });
}

window.Bildmakaren = {
  act, st, SET, saveSet, move, resize, rotate, undo, removeSel, select, selectNext, closeDialog,
  dialogOpen: () => dlg().open, hasSel: () => !!st.sel, goBack: () => act('back'), onSettings: null,
  speak: (t) => speech.say(t),
};
start();
})();
