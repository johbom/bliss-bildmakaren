/**
 * Glosprogram för Bliss — öva symboler OCH deras beståndsdelar.
 *
 * Bliss är kompositionellt: "amfibie" ÄR djur + vatten + jord. Därför lärs
 * grundtecknen (BCI-AV:s "Characters" utan egna delar) ut först, i ordningen
 * "flest ord bygger på det", och ett sammansatt ord låses upp först när du
 * kan alla dess delar. Delarna kommer ur BCI:s egen härledningskolumn
 * (src/vendor/bliss-derivations.js, genererad av scripts/build-derivations.js).
 *
 * Repetition: Leitner-lådor 0–7 med växande intervall (10 min → 90 dagar).
 * Rätt svar flyttar kortet en låda upp, fel svar tillbaka till låda 0 (kommer
 * igen om några kort). Framstegen sparas i localStorage.
 *
 * Övningar per kort: symbol → ord, ord → symbol, beståndsdelar (vilka delar
 * ser du i symbolen?) och bygg symbolen (vilka delar behövs för ordet?).
 */

(() => {
// Vanligt skript, inte ES-modul: webbläsare blockerar moduler när sidan öppnas
// direkt från disken (file://). Kräver att bliss-data.js, bliss-ritningar.js (window.BLISS_RITNINGAR)
// och bliss-derivations.js (window.DERIV) laddats före, och exponerar window.Glosor.
const DERIV = window.DERIV;
const BLISS = new Map(window.BLISS_DATA.map((s) => [s.id, s]));
/** Samma sammanslagning som src/vocabulary.js: svensk glosa ur arket, engelska som reserv. */
const getById = (id) => {
  const s = BLISS.get(+id);
  return s ? { id: s.id, en: s.n, sv: (DERIV[s.id] && DERIV[s.id][5]) || s.n, c: s.c, e: s.e } : null;
};

const MIN = 60e3;
const INTERVALS = [0, 10, 1440, 3 * 1440, 7 * 1440, 16 * 1440, 35 * 1440, 90 * 1440].map((m) => m * MIN);
const UNLOCK_BOX = 1;   // en del räknas som känd när den besvarats rätt minst en gång sedan senaste missen
const LEARNED_BOX = 3;  // "lärd" = klarat en repetition efter minst ett dygn
const KEY = 'bm-glosor-v1';

// ---- språk: svenska eller engelska (S.settings.lang). Ord, förklaringar och anteckningar finns på båda. ----
let LANG = 'sv';
const L = (sv, en) => (LANG === 'en' ? en : sv);
const MODE_TEXT = {
  sym: ['Symbol → ord', 'Symbol → word'], word: ['Ord → symbol', 'Word → symbol'],
  parts: ['Beståndsdelar', 'Parts'], build: ['Bygg symbolen', 'Build the symbol'],
};
/** Övningarnas namn på valt språk (Object.entries fungerar som förut). */
const MODES = {};
for (const [k, [sv, en]] of Object.entries(MODE_TEXT)) Object.defineProperty(MODES, k, { enumerable: true, get: () => L(sv, en) });
const CLASS = {
  YELLOW: ['sak', 'thing'], RED: ['handling', 'action'], GREEN: ['beskrivning', 'description'], BLUE: ['person', 'person'],
  WHITE: ['funktionsord', 'function word'], GRAY: ['markör', 'marker'],
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const today = () => new Date().toLocaleDateString('sv-SE');

// ---------------------------------------------------------------- kortleken

/** Kommaseparerade synonymer — men inte komman inuti parentes ("operator (handling, infinitiv)"). */
function splitSyns(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** BCI:s engelska glosa för visning: "be,am,are,is,exist-(to)" -> ["to be", "am", "are", "is", "exist"]. */
function enSyns(en) {
  const verb = /-\(to\)$/.test(en);
  const out = splitSyns(en.replace(/-\(to\)$/, ''))
    .map((s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (verb && out.length) out[0] = 'to ' + out[0];
  return out;
}

// Svenska ord som går före BCI:s svenska glosa, när BCI:s ord är ovanligt i svenskan. BCI:s egna ord
// ligger kvar som synonymer. Bara ord som användaren bett om – symbolen och delarna är BCI:s.
const SV_FIRST = {
  15930: 'oralsex',   // BCI: "munsex, oralt samlag" (norska listan: "munnsex, oralsex")
};

// Delar som BCI:s förklaringsark missar eller namnger med ett enklare ord än det som syns i BCI:s
// egen symbol. Bara ord som granskats mot symbolen (Bliss-delgranskning, oktober 2026).
const PARTS_FIX = {
  20526: [17506, 16225, 8998],          // god: arket "taste + description indicator"; symbolen har också +! (gärna)
  12628: [16161, 14661],                // frisör: "hair" är ritat som hår på huvudet
  12629: [16430, 14661],                // frisersalong: d:o
  16938: [17200, 14661],                // schampo: d:o
  21075: [12875, 12334, 20561],         // mässbok: "religion" är ritad som religion (Gud), inte tro
  12871: [14183, 14377, 18209, 14947, 8993],   // koka (mat): symbolen har också mat (eld + mat = laga mat)
  16184: [13377, 15666, 17192],         // rosa: "röd och vit" – symbolen har snö (vit), inte sol
  23491: [15943, 23467, 8993],          // exportera (dator): symbolen har datainformation, inte bara siffrorna
  24175: [12383, 14647, 17236],         // jaguar: "animal" är ritat som katt
  24405: [16164, 15701, 12359],         // alkoholism: symbolen har också dryck med alkohol
  24607: [13423, 17731],                // Bangladesh: "land" är ritat som land (flagga + mark)
  25333: [12655, 17236],                // nyckelpiga: skalbagge + fläck (arket: "bug + dot")
  29105: [16728, 12380, 29412],         // gnälla (hund): symbolen har också hund
};

const deck = new Map();
for (const [k, [raw0, expl, isChar, freq, old, , notes, merged, en]] of Object.entries(DERIV)) {
  const v = getById(+k);
  if (old || !v || !v.e?.length) continue;
  const raw = PARTS_FIX[v.id] || raw0;
  if (/_\((lower|upper)case\)|half_sized|\(OLD\)/i.test(v.en)) continue;
  const synsSv = [SV_FIRST[v.id], ...splitSyns(v.sv)].filter(Boolean).map((s) => s.replace(/\s*\(etc\)/, '').trim()).filter(Boolean);
  const synsEn = enSyns(v.en);
  // notes: BCI:s anteckning per del ("halv storlek", "förkortning"), samma ordning som raw.
  // merged: sammanslaget tecken (BCI: "Character (superimposed)") — delarna är sammanfogade till ett tecken.
  // en: [förklaring, textdelar, anteckningar] – BCI:s engelska original.
  const c = {
    id: v.id, v, raw, merged: !!merged, isChar: !!isChar, freq, users: [],
    synsSv, synsEn, explSv: expl, explEn: (en && en[0]) || '',
    notesSv: (notes || []).slice(), notesEn: ((en && en[2]) || []).slice(), textEn: (en && en[1]) || [],
  };
  // Ord, synonymer, förklaring och anteckningar följer valt språk.
  Object.defineProperties(c, {
    word: { get: () => (LANG === 'en' ? c.headEn[0] : c.headSv[0]) || c.v.sv },
    wordSv: { get: () => c.headSv[0] || c.v.sv },
    syns: { get: () => (LANG === 'en' ? c.synsEn : c.synsSv) },
    // Övriga synonymer, utan den som visas som huvudord.
    others: { get: () => { const [, i] = LANG === 'en' ? c.headEn : c.headSv; return c.syns.filter((_, j) => j !== i); } },
    expl: { get: () => (LANG === 'en' ? c.explEn : c.explSv) },
    notes: { get: () => (LANG === 'en' ? c.notesEn : c.notesSv) },
  });
  deck.set(v.id, c);
}
// "ability_(half_sized)" är samma tecken som "ability" i halv storlek (BCI:s egen variant) —
// räkna det som den delen, men visa att den står i halv storlek.
const byFirstEn = new Map([...deck.values()].map((c) => [c.v.en.split(',')[0], c.id]));
const baseOf = (p) => {
  if (typeof p !== 'number' || deck.has(p)) return p;
  const en = getById(p)?.en || '';
  return /_\(half_sized\)/.test(en) ? byFirstEn.get(en.replace(/_\(half_sized\)/, '').split(',')[0]) ?? p : p;
};
for (const c of deck.values()) {
  c.raw = c.raw.map((p, i) => {
    const b = baseOf(p);
    if (b !== p && !c.notesSv[i]) { c.notesSv[i] = 'halv storlek'; c.notesEn[i] = 'half-sized'; }
    return b;
  });
  c.parts = c.raw.filter((p) => typeof p === 'number' && deck.has(p));
  c.complete = c.raw.length >= 2 && c.parts.length === c.raw.length;
  // Delar som bara finns som BCI-text ("referenslinje", "reference dot") – se unlockedCompounds().
  c.hasTextPart = c.parts.length < c.raw.length;
  c.shapes = new Set(c.v.e.filter((e) => /^[A-Y]$/.test(e[0])).map((e) => e[0] + e[1]));
}
for (const c of deck.values()) for (const p of new Set(c.parts)) deck.get(p).users.push(c.id);

// Huvudord: BCI:s glosor ger ibland flera symboler samma första ord ("man, make" = husband,
// "man, karl …" = man). Då behåller ett kort ordet (det som är del i de andra, annars ett
// grundtecken, annars det vanligaste) och de övriga visas med en egen BCI-synonym ("make")
// eller BCI:s egen kvalificering ("jag (fem.)"). Inget nytt ord hittas på.
const VARIANT_Q = /\((fem\.?|mask\.?|plur\.?|(fem|mask)\.? plur\.?|obestämd plur\.?|opersonligt|könsneutral|\d+|(feminine|masculine)[^)]*)\)$/i;
const OBJ_FORMS = new Set(['mig', 'dig', 'sig', 'oss', 'er', 'dem', 'honom', 'henne', 'me', 'him', 'her', 'hers',
  'us', 'them', 'myself', 'yourself', 'himself', 'herself', 'oneself', 'ourselves', 'yourselves', 'themselves']);
function pickHeads(key, head) {
  const norm = (s) => s.toLowerCase().trim();
  const qual = (c) => (c[key][c[key].length - 1] || '').match(/[\s_-]\([^()]*\)$/)?.[0].slice(1) || '';
  const bare = (c) => c[key][0].replace(/\s*\([^()]*\)$/, '');
  const firsts = new Map();
  for (const c of deck.values()) {
    c[head] = [c[key][0] || '', 0];
    const w = norm(c[key][0] || '');
    if (!firsts.has(w)) firsts.set(w, []);
    firsts.get(w).push(c);
  }
  const taken = new Set(firsts.keys());
  for (const cs of firsts.values()) {
    if (cs.length < 2) continue;
    // Ett eget ord för de övriga: BCI-synonym som ingen annan i gruppen har, eller BCI:s kvalificering.
    const altOf = (c) => c[key].findIndex((s, j) => j > 0 && !/[()]/.test(s) && !OBJ_FORMS.has(norm(s)) && !taken.has(norm(s))
      && !cs.some((o) => o !== c && o[key].some((t) => norm(t) === norm(s))));
    // Har ett kort en BCI-synonym som preciserar ordet ("gå framåt") och ett annat bara ordet, får det
    // första synonymen och det andra ordet: gå (ben och fötter) är "gå", gå (fram) "gå framåt".
    const bareOnly = cs.some((o) => altOf(o) < 0 && !qual(o));
    const refines = (c) => { const i = altOf(c); return bareOnly && i > 0 && norm(c[key][i]).startsWith(norm(bare(c)) + ' '); };
    const rank = (c) => [VARIANT_Q.test(c[key].join(', ')) ? 1 : 0, cs.some((o) => o.parts.includes(c.id)) ? 0 : 1,
      refines(c) ? 1 : 0, c.isChar ? 0 : 1, -c.freq];
    const [keep, ...rest] = [...cs].sort((a, b) => {
      const x = rank(a), y = rank(b), i = x.findIndex((v, k) => v !== y[k]);
      return i < 0 ? 0 : x[i] - y[i];
    });
    const kq = qual(keep);
    if (kq && (VARIANT_Q.test(kq) || rest.some(qual))) keep[head] = [`${bare(keep)} ${kq}`, 0];
    for (const c of rest) {
      const q = qual(c);
      if (q && VARIANT_Q.test(q)) { c[head] = [`${bare(c)} ${q}`, 0]; continue; }
      const i = altOf(c);
      if (i > 0) { taken.add(norm(c[key][i])); c[head] = [c[key][i], i]; } else if (q) c[head] = [`${bare(c)} ${q}`, 0];
    }
  }
}
pickHeads('synsSv', 'headSv');
pickHeads('synsEn', 'headEn');
// Engelska huvudord när det som blir kvar efter pickHeads är tvetydigt. Alla BCI:s synonymer visas
// kvar (index -1). Bara ord som användaren bett om.
const EN_HEAD = {
  14688: 'he/she',   // BCI: "he,she,him,her,one" (sv. "man"). "he" och "she" är egna ord, och "one" togs för siffran
  14716: 'his/her',  // BCI: "his,her,hers,one's" (sv. "sin") = he/she + hör till; "one's" var lika oklart
};
for (const [id, w] of Object.entries(EN_HEAD)) if (deck.has(+id)) deck.get(+id).headEn = [w, -1];
// Svenska huvudord som användaren valt framför det pickHeads ger. Ordet är en av BCI:s egna synonymer,
// och de övriga står kvar. Två kort kan då heta likadant – det klarar övningarna (distractors(), twin).
const SV_HEAD = {
  15912: 'barn',   // BCI: "barn, avkomma" (offspring, child); pickHeads gav "avkomma" eftersom 13166 (child, kid) heter barn
};
for (const [id, w] of Object.entries(SV_HEAD)) {
  const c = deck.get(+id);
  if (c) c.headSv = [w, c.synsSv.indexOf(w)];
}

// Nivå (0 = grundtecken) och hur många ord som bygger på kortet, direkt eller indirekt.
const levelMemo = new Map();
function level(id, seen = new Set()) {
  if (levelMemo.has(id)) return levelMemo.get(id);
  if (seen.has(id)) return 0;
  seen.add(id);
  const c = deck.get(id);
  const l = c.parts.length ? 1 + Math.max(...c.parts.map((p) => level(p, seen))) : 0;
  levelMemo.set(id, l);
  return l;
}
for (const c of deck.values()) {
  c.level = level(c.id);
  let reach = 0;
  if (c.users.length) {
    const seen = new Set(), stack = [...c.users];
    while (stack.length) {
      const u = stack.pop();
      if (seen.has(u)) continue;
      seen.add(u);
      stack.push(...deck.get(u).users);
    }
    reach = seen.size;
  }
  c.reach = reach;
  c.score = c.parts.length
    ? Math.log1p(c.freq) * 2 + Math.log1p(reach) - c.level * 0.3
    : Math.log1p(reach) * 3 + Math.log1p(c.freq) * 0.5;
}
// ---- vardagsord ----
// Ord som behövs tidigt i vardagen: mat och dryck, fordon, vardagssysslor, familj, känslor och
// småord som vill, mer och sluta. Grundtecken som ingår i dem (i alla led) lärs före andra
// grundtecken; sammansatta vardagsord får en bonus (EVERYDAY_BONUS = ett ord ~400 gånger vanligare),
// så att även ovanliga vardagsord (badrum) kommer före vanliga ord utanför listan, och de väntar
// inte på grundtecken som inget vardagsord behöver (pickNew). Bara BCI-id, inga nya ord.
const EVERYDAY = [
  // mat och dryck
  14377, 13906, 13882, 18209, 15468, 12895, 23196, 14405, 12405, 12623, 13373, 17511, 14406, 14921,
  22369, 22376, 13157, 16726, 16192, 17218, 16230, 15444, 14189, 22371, 20526, 12898, 15405, 17468,
  14912, 17719, 14442, 22578, 13690, 17233, 14389,
  // fordon och resor
  13121, 13089, 17767, 12834, 12357, 16509, 17772,
  // vardagssysslor, saker och platser
  17009, 12649, 18038, 16969, 17747, 12637, 12913, 13366, 13371, 15961, 28080, 16959, 16200, 12621,
  17763, 16747, 14692, 16465, 13873, 18285, 16990, 13631, 16699, 16995, 17249, 12343, 13383, 16496,
  13099, 23223, 14885, 16734, 18273, 15942, 12875, 17518, 15679, 17519, 23447,
  // familj och vänner
  15662, 14157, 12909, 16994, 14401, 13166,
  // känslor
  14676, 16702, 12377, 27146, 15955, 12347, 16973,
  // småord
  14932, 15918, 17739, 14403, 18267, 12374, 14916, 18465, 12639, 15733, 18231, 18237, 14708, 17707,
  18035, 13114, 14685, 13131, 14440, 15654, 17268, 18294, 15722, 14463, 12615, 15210, 14704,
];
const EVERYDAY_BONUS = 12;
const everyday = new Set();
(function need(ids) {
  for (const id of ids) if (deck.has(id) && !everyday.has(id)) { everyday.add(id); need(deck.get(id).parts); }
})(EVERYDAY);
const atomOrder = [...deck.values()].filter((c) => !c.parts.length)
  .sort((a, b) => (everyday.has(b.id) - everyday.has(a.id)) || b.score - a.score);
const priority = (c) => c.score + (everyday.has(c.id) ? EVERYDAY_BONUS : 0);
// Ord som ska läras efter ett annat, oavsett frekvens: lunch (måltid + två) väntar på frukost (måltid + ett).
const TEACH_AFTER = { 15405: 12898 };

// ---- "Utan operatorn": samma ritning utan indikatorn ovanpå ----
// vara (12639) = H2 + W2 + handlingsindikatorn; utan indikatorn är ritningen exakt
// tillvaro, existens (2) (24443, BCI: "life [half sized]"). Bara exakt lika ritningar räknas
// (form, storlek, riktning och läge), så kopplingen är BCI:s egen – inget gissas.
const INDICATOR_CODES = new Set([...deck.values()].filter((c) => /^indicator_\(/.test(c.v.en))
  .flatMap((c) => c.v.e.map((e) => `${e[0]}${e[1]}/${e[2]}`)));
const isIndicatorEl = (e) => e[5] < 8 && INDICATOR_CODES.has(`${e[0]}${e[1]}/${e[2]}`);
// Hela ritningen, även text (landsymbolerna skiljs åt av sina bokstäver).
const drawingKey = (els) => {
  if (!els.length) return '';
  const x0 = Math.min(...els.map((e) => e[4]));
  return els.map((e) => `${e[0]}${e[1]}/${e[2]}@${e[4] - x0},${e[5]}${e[0] === 'Z' ? ':' + e[8] : ''}`).sort().join(' ');
};
const isIndicatorCard = (id) => /^indicator_\(/.test(deck.get(id)?.v.en || '');
const byDrawing = new Map();
for (const c of deck.values()) {
  if (/^indicator_\(/.test(c.v.en)) continue;
  const k = drawingKey(c.v.e);
  if (k) { if (!byDrawing.has(k)) byDrawing.set(k, []); byDrawing.get(k).push(c.id); }
}
for (const c of deck.values()) {
  // Bara när BCI:s egen härledning anger en indikator ("+ action indicator") – en likadan form
  // ovanpå kan annars vara något annat (t.ex. skydd i "fridlyst fågel").
  if (!c.parts.some(isIndicatorCard)) continue;
  const inds = c.v.e.filter(isIndicatorEl);
  if (!inds.length || inds.length === c.v.e.length) continue;
  const same = (byDrawing.get(drawingKey(c.v.e.filter((e) => !isIndicatorEl(e)))) || [])
    .filter((id) => id !== c.id && !c.parts.includes(id));
  if (same.length) c.bare = same;
}
// ---- Delarnas operatorer i sammansatta ord ----
// bli = gå + vara + operator: gå och vara har var sin operator när de står ensamma, men när ord sätts
// ihop tappar delarna sina operatorer och hela ordet får en enda (BCI-AV-ritningen av bli har bara en,
// över pilen). Den operatorn står i BCI:s formel och visas därför, men i övningarna är den frivillig
// när en del redan ritas med samma operator.
const indCode = (id) => drawingKey(deck.get(id).v.e);
for (const c of deck.values()) {
  const inds = c.parts.filter(isIndicatorCard);
  if (!inds.length) continue;
  const carried = new Set(c.parts.filter((p) => !isIndicatorCard(p)).flatMap((p) => {
    const o = deck.get(p);
    return [...o.parts.filter(isIndicatorCard).map(indCode), ...o.v.e.filter(isIndicatorEl).map((e) => drawingKey([e]))];
  }));
  if (!carried.size) continue;
  c.opDropped = true;
  const opt = inds.filter((id) => carried.has(indCode(id)));
  if (opt.length) c.optInd = [...new Set(opt)];
}
// Utan egen operator: smärta = känsla + sjuk, men sjuks operator syns inte i ordet. Indikatorer som
// grammatiska markörer tas bort inne i sammansatta ord (Fundamental Rules 7.0).
const opCode = (e) => `${e[0]}${e[1]}/${e[2]}`;
const opDrawn = (c, id) => {
  const own = new Set(c.v.e.filter(isIndicatorEl).map(opCode));
  return deck.get(id).v.e.every((e) => own.has(opCode(e)));
};
for (const c of deck.values()) {
  c.opHidden = !c.opDropped && c.parts.some((p) => !isIndicatorCard(p)
    && deck.get(p).parts.some((id) => isIndicatorCard(id) && !opDrawn(c, id)));
}
// Former (familj + storlek) som minst ett grundtecken är ritat med – de går att lära sig.
const ATOM_SHAPES = new Set(atomOrder.flatMap((c) => [...c.shapes]));
const compoundCount = deck.size - atomOrder.length;

const card = (id) => deck.get(+id) || null;
const className = (c) => (CLASS[c.v.c] ? L(...CLASS[c.v.c]) : '');

// ---------------------------------------------------------------- framsteg

// ---- dagar i rad
const dayStr = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('sv-SE'); };
/** Sparningar från före räknaren: dagarna då nya ord introducerades (kortens t) är säkra övningsdagar. */
function seedStreak(cards) {
  const days = new Set(Object.values(cards || {}).map((c) => c && c.t && new Date(c.t).toLocaleDateString('sv-SE')));
  let off = days.has(dayStr()) ? 0 : -1, n = 0;
  const last = days.has(dayStr(off)) ? dayStr(off) : null;
  while (days.has(dayStr(off))) { n++; off--; }
  return { last, n };
}
/** Rekordet är aldrig lägre än raden (sparningar från innan rekordet fanns saknar det). */
const bestOf = (st) => ({ ...st, best: Math.max(st.best || 0, st.n || 0) });
/** Anropas vid varje svar: första svaret en ny dag förlänger raden (eller börjar om efter ett uppehåll). */
function practiced() {
  const t = today();
  if (S.streak.last === t) return;
  S.streak.n = S.streak.last === dayStr(-1) ? S.streak.n + 1 : 1;
  S.streak.last = t;
  S.streak.best = Math.max(S.streak.best || 0, S.streak.n);
}
/** Dagar i rad just nu – raden lever kvar i dag även om man ännu inte övat (då räknas t.o.m. i går). */
const streak = () => (S.streak.last === today() || S.streak.last === dayStr(-1) ? S.streak.n : 0);
const bestStreak = () => S.streak.best || 0;

function defaults() {
  return {
    cards: {},
    // settings.track (sätts när man väljer): 'core' = vardagsord först (CORE), 'basics' = från grunden; saknas = som 'basics'.
    settings: { modes: { sym: true, word: true, parts: true, build: true }, newPerDay: 10, staff: true, lang: null },
    day: { date: today(), n: 0, extra: 0 },
    alt: false,
    mine: [],   // "Mina ord": BCI-id:n som användaren valt att träna särskilt
    milestone: 0,       // högsta nådda milstolpe, lärda ord – försvinner inte om ett ord glöms
    milestoneAtoms: 0,  // högsta nådda milstolpe, lärda grundtecken
    streak: { last: null, n: 0, best: 0 },   // dagar i rad med minst ett svar: senaste övningsdagen, antal, rekord
    confused: {},       // förväxlade ord: "<lägre id>-<högre id>" -> 1–3 (se noteConfusion)
  };
}
/** Sparat läge kompletterat med standardvärden (nya inställningar i senare versioner). */
function normalize(s) {
  const d = defaults();
  return { ...d, ...s, settings: { ...d.settings, ...s.settings, modes: { ...d.settings.modes, ...s.settings?.modes } },
    streak: bestOf(s.streak || seedStreak(s.cards)) };
}
// Andra appar som bara lånar kortleken (Bildmakaren) sätter window.GLOSOR_UTAN_SPARNING: då läses och
// skrivs inga framsteg – en annan app ska inte röra glosprogrammets uppgifter om eleven.
const NO_STORE = window.GLOSOR_UTAN_SPARNING === true;
function load() {
  if (NO_STORE) return defaults();
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.cards) return normalize(s);
  } catch (_) { /* tom eller blockerad lagring -> börja om */ }
  return defaults();
}
const S = load();
// Språk: sparat val, annars webbläsarens (svenska för sv/nb/nn/no/da, annars engelska).
LANG = S.settings.lang || (/^(sv|nb|nn|no|da)\b/i.test(navigator.language || '') ? 'sv' : 'en');
const lang = () => LANG;
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'sv';
  S.settings.lang = LANG;
  save();
}
function save() {
  if (NO_STORE) return;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* privat fönster: fortsätt utan att spara */ }
}
// ---- Säkerhetskopia: framstegen finns bara på den egna enheten (på iPhone raderas de om appen
// tas bort från hemskärmen), så de kan sparas som en fil och läsas in igen, även på en annan enhet.
const BACKUP_APP = 'bliss-glosor';
function exportBackup() {
  return JSON.stringify({ app: BACKUP_APP, format: 1, saved: new Date().toISOString(), state: S });
}
/** Läser en säkerhetskopia utan att ändra något: { saved, words } eller null om filen inte är en kopia. */
function readBackup(text) {
  try {
    const o = JSON.parse(text);
    const st = o && o.app === BACKUP_APP ? o.state : null;
    if (!st || typeof st.cards !== 'object' || Array.isArray(st.cards)) return null;
    return { saved: o.saved || '', words: Object.keys(st.cards).length, state: st };
  } catch (_) { return null; }
}
/** Ersätter alla framsteg och inställningar med säkerhetskopians. */
function importBackup(text) {
  const b = readBackup(text);
  if (!b) return false;
  const next = normalize(b.state);
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, next);
  if (S.settings.lang) LANG = S.settings.lang;
  save();
  return true;
}

/** Nollställer inlärningen men behåller inställningar och listan Mina ord (den är ett val, inte framsteg). */
function resetProgress() {
  const keep = S.settings, mine = S.mine;
  Object.assign(S, defaults(), { settings: keep, mine });
  save();
}

function dayState() {
  if (S.day.date !== today()) S.day = { date: today(), n: 0, extra: 0 };
  return S.day;
}
const newLeft = () => { const d = dayState(); return Math.max(0, S.settings.newPerDay + d.extra - d.n); };
const boxOf = (id) => (S.cards[id] ? S.cards[id].b : -1);
/** Hur väl ett ord sitter, i fyra steg (för ordlistan och detaljrutan): 'new' (låda 0), 'practising' (1–2),
 *  'learned' (LEARNED_BOX–5, rätt igen efter minst ett dygn), 'known' (6–7). null = inte påbörjat. */
const stageOf = (id) => { const b = boxOf(id); return b < 0 ? null : b === 0 ? 'new' : b < LEARNED_BOX ? 'practising' : b < 6 ? 'learned' : 'known'; };
const introduced = () => Object.keys(S.cards).map(Number).filter((id) => deck.has(id));

/** När nästa ord ska repeteras (ms från nu), eller null. */
function nextDue(now = Date.now()) {
  const d = introduced().map((id) => S.cards[id].d).filter((t) => t > now);
  return d.length ? Math.min(...d) - now : null;
}

function dueIds(now = Date.now()) {
  return introduced().filter((id) => S.cards[id].d <= now).sort((a, b) => S.cards[a].d - S.cards[b].d);
}

/**
 * Sammansatta ord som kan introduceras: alla kopplade delar är kända. Har ordet dessutom en
 * del som bara finns som BCI-text ("under (marknivå)" = mark + "reference dot") kan appen inte
 * veta vilket tecken texten avser – i stället väntar ordet tills varje form i dess ritning finns
 * i något tecken du redan kan (här pricken i punkt). Former som inget grundtecken har räknas inte.
 */
function unlockedCompounds() {
  let known = null;
  const knownShapes = () => {
    if (!known) {
      known = new Set();
      for (const id of introduced()) if (S.cards[id].b >= UNLOCK_BOX) for (const code of deck.get(id).shapes) known.add(code);
    }
    return known;
  };
  const out = [];
  for (const c of deck.values()) {
    if (!c.parts.length || S.cards[c.id]) continue;
    if (!c.parts.every((p) => boxOf(p) >= UNLOCK_BOX)) continue;
    if (TEACH_AFTER[c.id] && !S.cards[TEACH_AFTER[c.id]]) continue;
    if (c.hasTextPart && ![...c.shapes].every((code) => !ATOM_SHAPES.has(code) || knownShapes().has(code))) continue;
    out.push(c);
  }
  return out.sort((a, b) => priority(b) - priority(a));
}
const nextAtom = () => atomOrder.find((c) => !S.cards[c.id]) || null;

// ---- Mina ord ----
const isMine = (id) => S.mine.includes(+id);
const mineCards = () => S.mine.map((id) => deck.get(id)).filter(Boolean);
function toggleMine(id) {
  id = +id;
  const k = S.mine.indexOf(id);
  if (k < 0) S.mine.push(id); else S.mine.splice(k, 1);
  save();
  return k < 0;
}

/**
 * Nästa nya kort: först ord ur Mina ord som inte påbörjats (oavsett om delarna
 * kan), sedan växelvis grundtecken och upplåsta sammansatta ord – vardagsord först.
 */
// Ovanliga sammansatta ord väntar: frekvensgränsen (SUC 3.0) sänks i takt med hur många ord man lärt sig,
// så att t.ex. medborgare (63) inte kommer direkt bara för att det låses upp av person. Vardagsord väntar inte.
const FREQ_STEPS = [[300, 100], [600, 50], [1000, 20]];
const minFreq = () => (FREQ_STEPS.find(([n]) => introduced().length < n) || [0, 0])[1];

// ---- Spåret "Vardagsord först" ----
// Kärnord: de ord som används mest när man kommunicerar med AKK (jag, vill, mer, sluta, hjälp …), i den
// ordning de lärs ut. Ett ord i taget: först de delar som saknas (i alla led, grundtecken och indikatorer
// när ordet behöver dem), sedan själva ordet när delarna klarats en gång. Bara BCI-id, inga nya ord.
const CORE = [
  // de första: vem, vilja, mer eller sluta, hjälp, ja och nej
  14916, 18465, 18035, 15733, 15654, 17268, 14704, 18294, 15722,
  // tycka och göra
  15210, 14463, 12615, 13906, 13882, 18031, 16747, 16728, 13860, 14685, 13383, 14440, 13131, 16200, 17009,
  // personer, platser och saker
  15662, 14157, 14401, 14885, 17747, 14377, 18209,
  // känslor och hur man mår
  14676, 16702, 12377, 12347, 15955, 27146, 16973,
  // frågor, platser, småord
  18228, 18245, 18236, 18234, 14708, 17707, 17983, 13869, 12350, 24844, 15922, 17533, 14702, 12835, 15221, 24011,
];
const coreTrack = () => S.settings.track === 'core';
/** Första delen (i alla led) som inte påbörjats, annars ordet självt. */
function nextNeeded(c) {
  for (const p of new Set(c.parts)) if (!S.cards[p]) return nextNeeded(deck.get(p));
  return c;
}
/** { c: ordet att lära nu, goal: kärnordet det behövs för } eller null när kärnorden är klara. */
function pickCore() {
  for (const id of CORE) {
    const goal = deck.get(id);
    if (!goal || S.cards[id]) continue;
    const c = nextNeeded(goal);
    if (c.parts.length && !c.parts.every((p) => boxOf(p) >= UNLOCK_BOX)) continue;   // delarna först, sedan ordet
    return { c, goal };
  }
  return null;
}
/** Kärnordet som lärs härnäst (visas på startsidan), eller null. */
const nextGoal = () => (coreTrack() ? CORE.map((id) => deck.get(id)).find((c) => c && !S.cards[c.id]) || null : null);

let newGoal = null;   // kärnordet som det senast valda nya ordet behövs för (intro-kortet visar det)
function pickNew() {
  newGoal = null;
  const chosen = mineCards().find((c) => !S.cards[c.id]);
  if (chosen) return chosen;
  if (coreTrack()) {
    const core = pickCore();
    if (core) { newGoal = core.goal === core.c ? null : core.goal; return core.c; }
  }
  const atom = nextAtom();
  const all = unlockedCompounds();
  const comps = atom ? all.filter((c) => everyday.has(c.id) || c.freq >= minFreq()) : all;   // utan grundtecken kvar: ingen gräns
  // Väntar ett vardagsord går det före grundtecken som inget vardagsord behöver (båt).
  const waiting = comps.length && everyday.has(comps[0].id) && !everyday.has(atom?.id);
  if (comps.length && (S.alt || !atom || waiting)) { S.alt = false; return comps[0]; }
  if (atom) { S.alt = true; return atom; }
  return null;
}

function stats() {
  const ids = introduced();
  let atoms = 0, learned = 0;
  for (const id of ids) {
    if (!deck.get(id).parts.length) atoms++;
    if (S.cards[id].b >= LEARNED_BOX) learned++;
  }
  return {
    atoms, atomTotal: atomOrder.length,
    compounds: ids.length - atoms, compoundTotal: compoundCount,
    learned, due: dueIds().length, newLeft: newLeft(), unlocked: unlockedCompounds().length,
  };
}

// ---- milstolpar: lärda ord och lärda grundtecken (klarat en repetition efter minst ett dygn) ----
// Titlar: varje milstolpe har en titel som finns som Blissymbol i BCI-AV (id), i stigande rang.
// Nyckeln 'all' är den sista milstolpen – hela ordförrådet resp. alla grundtecken.
const RANKS = {
  words: {
    5: [12603, 'Baby', 'Baby'], 10: [13166, 'Barn', 'Child'], 25: [17446, 'Elev', 'Pupil'], 50: [17516, 'Tonåring', 'Teenager'],
    75: [23693, 'Resenär', 'Traveller'], 100: [25059, 'Upptäcktsresande', 'Explorer'], 150: [25045, 'Detektiv', 'Detective'],
    200: [23652, 'Forskare', 'Researcher'], 300: [29239, 'Expert', 'Expert'], 400: [17513, 'Lärare', 'Teacher'],
    500: [25746, 'Riddare', 'Knight'], 750: [23528, 'Hjälte', 'Hero'], 1000: [23713, 'Trollkarl', 'Wizard'],
    1500: [12590, 'Astronaut', 'Astronaut'], 2000: [23612, 'Filosof', 'Philosopher'], 3000: [23626, 'Drottning', 'Queen'],
    4000: [22828, 'Viking', 'Viking'], 5000: [25381, 'Superman', 'Superman'], all: [24520, 'Universum', 'Universe'],
  },
  atoms: {
    10: [12395, 'Myra', 'Ant'], 25: [15665, 'Mus', 'Mouse'], 50: [12383, 'Katt', 'Cat'], 100: [12380, 'Hund', 'Dog'],
    150: [14897, 'Häst', 'Horse'], 200: [12643, 'Björn', 'Bear'], 300: [15217, 'Lejon', 'Lion'], all: [26159, 'Drake', 'Dragon'],
  },
};
/** Titeln för en milstolpe: { id, name } eller null. */
function rankOf(track, n) {
  if (!n) return null;
  const t = TRACKS[track], r = n === t.total() ? RANKS[track].all : RANKS[track][n];
  return r ? { id: r[0], name: L(r[1], r[2]) } : null;
}

const TRACKS = {
  words: { key: 'milestone', steps: [5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000],
    total: () => deck.size, atomsOnly: false },
  atoms: { key: 'milestoneAtoms', steps: [10, 25, 50, 100, 150, 200, 300],
    total: () => atomOrder.length, atomsOnly: true },
};
function learnedCount(atomsOnly = false) {
  let n = 0;
  for (const id of introduced()) {
    if (S.cards[id].b >= LEARNED_BOX && (!atomsOnly || !deck.get(id).parts.length)) n++;
  }
  return n;
}
const trackSteps = (t) => [...t.steps.filter((m) => m < t.total()), t.total()];
/** { learned, next, prev, reached, steps, total } – next = nästa milstolpe ovanför den högsta nådda (null när allt är lärt). */
function milestoneState(track = 'words') {
  const t = TRACKS[track], steps = trackSteps(t);
  const learned = learnedCount(t.atomsOnly);
  const best = Math.max(S[t.key] || 0, ...steps.filter((m) => m <= learned), 0);
  const next = steps.find((m) => m > best) ?? null;
  return { learned, next, prev: best, reached: steps.filter((m) => m <= best), steps, total: t.total(),
    rankNow: rankOf(track, best), rankNext: next ? rankOf(track, next) : null };
}
/** Anropas efter varje svar: returnerar nyss nådda milstolpar, t.ex. [{ track: 'atoms', n: 25 }]. */
function checkMilestones() {
  const hits = [];
  for (const [track, t] of Object.entries(TRACKS)) {
    const learned = learnedCount(t.atomsOnly);
    const hit = trackSteps(t).filter((m) => m <= learned && m > (S[t.key] || 0)).pop();
    if (hit) { S[t.key] = hit; hits.push({ track, n: hit, rank: rankOf(track, hit) }); }
  }
  if (hits.length) save();
  return hits;
}

function introduce(id, countToday = true) {
  S.cards[id] = { b: 0, d: Date.now(), n: 0, w: 0, t: Date.now() };
  if (countToday) dayState().n++;
  save();
}

/** @returns {number} ms till nästa repetition */
function grade(id, ok) {
  const s = S.cards[id], now = Date.now();
  if (focus) {
    // Mina ord-pass och fri repetition: rätt -> klart för det här passet, fel -> sist i kön igen.
    const k = focus.queue.indexOf(+id);
    if (k >= 0) { focus.queue.splice(k, 1); if (!ok) focus.queue.push(+id); }
  }
  s.n++;
  practiced();
  // Fri repetition före utsatt tid: rätt svar flyttar inte fram ordet (då skulle intervallen tappa
  // sin mening), men ett fel räknas som vanligt så att ordet kommer tillbaka snart.
  if (focus?.review && ok && s.d > now) { save(); return s.d - now; }
  if (ok) s.b = Math.min(s.b + 1, INTERVALS.length - 1);
  else { s.w++; s.b = 0; }
  s.d = now + INTERVALS[s.b];
  save();
  return INTERVALS[s.b];
}

function fmtInterval(ms) {
  const m = Math.round(ms / MIN);
  if (m < 1) return L('om en stund', 'in a moment');
  if (m < 60) return L(`om ${m} min`, `in ${m} min`);
  if (m < 1440) { const h = Math.round(m / 60); return L(`om ${h} tim`, `in ${h} h`); }
  const d = Math.round(m / 1440);
  return d === 1 ? L('i morgon', 'tomorrow') : L(`om ${d} dagar`, `in ${d} days`);
}

// ---------------------------------------------------------------- frågor

function pickMode(c) {
  const on = S.settings.modes;
  let m = [];
  if (on.sym) m.push('sym');
  if (on.word) m.push('word');
  // Del- och byggövningarna bara när det finns minst två olika delar – par = person + person blir annars bara "person".
  const several = new Set(c.parts).size > 1;
  if (c.complete && several && on.parts) m.push('parts', 'parts');
  if (c.complete && several && !c.isChar && on.build) m.push('build', 'build');
  if (!m.length) m = ['sym'];
  if (S.cards[c.id].b === 0) {
    const easy = m.filter((x) => x === 'sym' || x === 'parts');
    if (easy.length) m = easy;
  }
  return m[Math.floor(Math.random() * m.length)];
}

/** Fel alternativ som liknar målet: delar gemensamma delar, samma ordklass, helst redan kända. */
function distractors(c, n) {
  const mine = new Set(c.parts);
  const words = new Set([c.word]);
  const scored = [];
  for (const id of introduced()) {
    if (id === c.id) continue;
    const o = deck.get(id);
    let s = Math.random() * 1.5;
    for (const p of o.parts) if (mine.has(p)) s += 3;
    if (mine.has(id) || o.parts.includes(c.id)) s += 2;
    if (o.v.c === c.v.c) s += 1;
    scored.push([s, o]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const out = [];
  const take = (o) => { if (out.length < n && !words.has(o.word)) { words.add(o.word); out.push(o); } };
  for (const [, o] of scored) take(o);
  for (const o of atomOrder) { if (out.length >= n) break; if (o.id !== c.id) take(o); }
  return out;
}

/** Palett för delövningarna: rätt delar + troliga förväxlingar (delar som syskonord använder). */
function palette(c, size = 8) {
  const correct = [...new Set(c.parts)];
  const score = new Map();
  // Indikatorer (t.ex. handlingsindikatorn, en "^" i kvarts storlek) liknar vanliga tecken i liten
  // storlek – som lockbete bara när symbolen själv innehåller en indikator.
  const isInd = (id) => /^indicator_\(/.test(deck.get(id)?.v.en || '');
  const indOk = correct.some(isInd);
  const bump = (id, s) => {
    if (id !== c.id && !correct.includes(id) && (indOk || !isInd(id))) score.set(id, (score.get(id) || 0) + s);
  };
  for (const p of correct) {
    for (const u of deck.get(p).users.slice(0, 400)) for (const q of deck.get(u).parts) bump(q, boxOf(q) >= 0 ? 0.5 : 0.2);
  }
  for (const id of introduced()) if (deck.get(id).users.length) bump(id, 2);
  const words = new Set(correct.map((id) => deck.get(id).word));
  const extra = [...score.entries()]
    .map(([id, s]) => [s + Math.random() * 2, deck.get(id)])
    .sort((a, b) => b[0] - a[0])
    .map(([, o]) => o)
    .filter((o) => !words.has(o.word) && (words.add(o.word), true))
    .slice(0, Math.max(0, size - correct.length));
  return shuffle([...correct.map((id) => deck.get(id)), ...extra]);
}

const recent = [];
// Mina ord-pass och fri repetition: en kö med ord; varje ord stannar kvar tills det besvarats rätt en gång.
let focus = null;
const REVIEW_SIZE = 20;
function startFocus(kind = 'mine') {
  const review = kind === 'review', pairs = kind === 'pairs';
  const queue = review ? reviewPick(REVIEW_SIZE) : pairs ? shuffle(confusedPairs()) : shuffle(mineCards().map((c) => c.id));
  focus = { queue, total: 0, review, pairs };
  focus.total = focus.queue.length;
  recent.length = 0;
}
/** Fri repetition: de svagaste av de inlärda orden (låg låda, många fel), med lite slump så att passen varierar. */
function reviewPick(n) {
  const weak = (id) => S.cards[id].b * 2 - S.cards[id].w + Math.random() * 3;
  return shuffle(introduced().sort((a, b) => weak(a) - weak(b)).slice(0, n));
}
const reviewCount = () => introduced().length;
const endFocus = () => { focus = null; };
const focusState = () => (focus ? { left: focus.queue.length, total: focus.total, review: focus.review, pairs: focus.pairs } : null);

// ---------------------------------------------------------------- förväxlingar
// Ord man blandat ihop: fel svar i Symbol → ord, Ord → symbol och meningarna sparar paret (rätt ord och
// det man valde). Övningen "Förväxlade ord" visar paret med bara de två som alternativ. Rätt svar räknar
// ned, fel svar upp (högst PAIR_MAX); vid 0 är paret klart. Påverkar inte repetitionsschemat.
const PAIR_MAX = 3;
const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const pairIds = (k) => k.split('-').map(Number);
function noteConfusion(a, b) {
  a = +a; b = +b;
  if (a === b || !deck.has(a) || !deck.has(b) || deck.get(a).word === deck.get(b).word) return;
  const k = pairKey(a, b);
  S.confused[k] = Math.min(PAIR_MAX, (S.confused[k] || 0) + 1);
  save();
}
const confusedPairs = () => Object.keys(S.confused || {}).filter((k) => S.confused[k] > 0 && pairIds(k).every((id) => deck.has(id)))
  .sort((x, y) => S.confused[y] - S.confused[x]);
function answerPair(k, ok) {
  if (focus?.pairs) {
    const i = focus.queue.indexOf(k);
    if (i >= 0) { focus.queue.splice(i, 1); if (!ok) focus.queue.push(k); }
  }
  const n = (S.confused[k] || 0) + (ok ? -1 : 1);
  if (n > 0) S.confused[k] = Math.min(PAIR_MAX, n); else delete S.confused[k];
  practiced();
  save();
}
function pairStep() {
  const k = focus.queue.find((x) => !recent.includes(x)) ?? focus.queue[0];
  recent.push(k);
  if (recent.length > 2) recent.shift();
  const [a, b] = pairIds(k).map((id) => deck.get(id));
  const c = Math.random() < 0.5 ? a : b;
  const mode = Math.random() < 0.5 ? 'sym' : 'word';
  const options = shuffle([a, b]);
  return { kind: 'quiz', mode, c, options, answer: options.indexOf(c), pair: k };
}

/**
 * Vad skiljer två ord åt, med BCI:s egna delar (ett grundtecken räknas som sin egen del):
 * onlyA/onlyB = delar som bara finns i det ena; sameParts = exakt samma delar (då är skillnaden placeringen);
 * sameSet = samma slags delar men olika många; atoms = båda är grundtecken. unknown: något ord har en del
 * som bara finns som BCI-text – då sägs inget om skillnaden.
 */
function compareParts(a, b) {
  const partsOf = (c) => (c.parts.length ? c.parts : [c.id]);
  const pa = partsOf(a), pb = partsOf(b), sa = new Set(pa), sb = new Set(pb);
  const onlyA = [...sa].filter((x) => !sb.has(x)), onlyB = [...sb].filter((x) => !sa.has(x));
  const sorted = (x) => x.slice().sort((m, n) => m - n).join();
  const same = !onlyA.length && !onlyB.length;
  return {
    onlyA, onlyB, atoms: !a.parts.length && !b.parts.length, unknown: a.hasTextPart || b.hasTextPart,
    sameParts: same && sorted(pa) === sorted(pb), sameSet: same && sorted(pa) !== sorted(pb),
  };
}

/** Nästa steg i passet: förfallna repetitioner först, sedan nya kort, null när dagens pass är klart. */
function nextStep() {
  if (focus) return focusStep();
  const due = dueIds();
  let id = due.find((x) => !recent.includes(x));
  let kind = 'quiz';
  if (id == null && newLeft() > 0) {
    const c = pickNew();
    if (c) { id = c.id; kind = 'intro'; introduce(id); }
  }
  if (id == null) id = due[0];
  if (id == null) return null;
  const step = makeStep(id, kind);
  if (kind === 'intro' && newGoal) step.goal = newGoal;
  return step;
}

/** Mina ord / fri repetition: nästa ord i kön (inte samma som nyss om det går); ej påbörjade ord visas först som introduktion. */
function focusStep() {
  if (!focus.queue.length) return null;
  if (focus.pairs) return pairStep();
  const id = focus.queue.find((x) => !recent.includes(x)) ?? focus.queue[0];
  let kind = 'quiz';
  if (!S.cards[id]) { introduce(id, false); kind = 'intro'; }
  return makeStep(id, kind);
}

function makeStep(id, kind) {
  recent.push(id);
  if (recent.length > 2) recent.shift();
  const c = deck.get(id);
  if (kind === 'intro') return { kind, c };
  const mode = pickMode(c);
  if (mode === 'sym' || mode === 'word') {
    const options = shuffle([c, ...distractors(c, 3)]);
    return { kind, mode, c, options, answer: options.indexOf(c) };
  }
  return { kind, mode, c, palette: palette(c), sel: [] };
}

/** Rätt om valda delar (som mängd för 'parts', som multimängd för 'build') stämmer. */
/** skipped = rätt utan den frivilliga operatorn (se "Delarnas operatorer" ovan). */
function checkParts(step) {
  const opt = new Set(step.c.optInd || []);
  const sorted = (a) => a.slice().sort((x, y) => x - y);
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const full = step.c.parts, short = full.filter((x) => !opt.has(x));
  const skipped = opt.size > 0 && !step.sel.some((x) => opt.has(x));
  const ref = skipped ? short : full;
  const uniq = (a) => sorted([...new Set(a)]);
  const match = step.mode === 'parts' ? (a) => same(uniq(a), uniq(step.sel)) : (a) => same(sorted(a), sorted(step.sel));
  if (match(ref)) return { ok: true, order: step.mode === 'parts' || step.sel.every((x, i) => x === ref[i]), skipped };
  // En del uppdelad i sina egna delar är också rätt (inte = utan + uppmaning).
  for (const alt of splitParts(full)) {
    if (match(alt)) return { ok: true, order: step.mode === 'parts' || step.sel.every((x, i) => x === alt[i]), skipped: false, split: alt };
  }
  // Delen utan den operator som inte syns i ordet är också rätt (sömn = öga + sluten enhet, BCI: stänga).
  for (const alt of splitParts(full)) {
    const plain = alt.filter((id, i) => !isIndicatorCard(id) || (opDrawn(step.c, id) && alt.indexOf(id) === i));
    if (plain.length < alt.length && match(plain)) {
      return { ok: true, order: step.mode === 'parts' || step.sel.every((x, i) => x === plain[i]), skipped: false, split: plain, plain: true };
    }
  }
  if (step.mode === 'parts') return { ok: false, order: true, skipped };
  // Ett annat ord som visas likadant (två kort som båda heter "gå") räknas också som rätt.
  const twin = [...deck.values()].find((o) => o !== step.c && o.word === step.c.word && o.parts.length
    && same(sorted(o.parts), sorted(step.sel)));
  if (twin) return { ok: true, order: step.sel.every((x, i) => x === twin.parts[i]), skipped: false, twin };
  return { ok: false, order: false, skipped };
}

// Delarna med en eller flera delar ersatta av sina egna (högst två steg ner).
function splitParts(list, depth = 2) {
  const out = [];
  if (!depth) return out;
  list.forEach((id, i) => {
    const p = deck.get(id);
    if (!p.complete) return;
    const alt = [...list.slice(0, i), ...p.parts, ...list.slice(i + 1)];
    out.push(alt, ...splitParts(alt, depth - 1));
  });
  return out;
}

// ---------------------------------------------------------------- rendering

// Ritningarna är färdiga: originalmotorn BlissEngine ritade dem vid bygget (scripts/build-ritningar.js).
// Appen ritar inget själv – saknas en ritning visas ingen symbol, hellre det än en egen variant.
const RITNINGAR = window.BLISS_RITNINGAR || {};
const bodyCache = new Map();
let meter = null;
function geometry(c) {
  if (bodyCache.has(c.id)) return bodyCache.get(c.id);
  const body = RITNINGAR[c.id] || '';
  if (!meter) {
    meter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    meter.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:10px;height:10px';
    document.body.appendChild(meter);
  }
  meter.innerHTML = `<g>${body}</g>`;
  let bb = { x: 0, y: 800, width: 800, height: 800 };
  try { const b = meter.firstChild.getBBox(); if (b.width || b.height) bb = b; } catch (_) { /* ej renderbar */ }
  const g = { body, bb };
  bodyCache.set(c.id, g);
  return g;
}

/**
 * Symbolen i en fast ram (samma höjd för alla, med himmels- och jordlinje),
 * så att storlek och läge — som bär betydelse i Bliss — syns.
 * unit = px per åttondels-kvadrat.
 */
function symbolSVG(c, unit = 8, cls = '', frame = null, padX = null) {
  const { body, bb } = geometry(c);
  const pad = padX ?? 140, minW = padX == null ? 800 + 2 * pad : 0;
  let x0 = bb.x - pad, w = bb.width + 2 * pad;
  if (w < minW) { x0 -= (minW - w) / 2; w = minW; }
  // frame: gemensam höjd för alla ord i en mening, så att himmels- och jordlinjen går rakt igenom.
  const y0 = frame ? frame[0] : Math.min(250, bb.y - pad), y1 = frame ? frame[1] : Math.max(2050, bb.y + bb.height + pad), h = y1 - y0;
  const staff = S.settings.staff
    ? `<line class="staff" x1="${x0}" x2="${x0 + w}" y1="800" y2="800"/><line class="staff earth" x1="${x0}" x2="${x0 + w}" y1="1600" y2="1600"/>`
    : '';
  return `<svg class="sym ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="${x0.toFixed(0)} ${y0.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" ` +
    `width="${(w * unit / 100).toFixed(0)}" height="${(h * unit / 100).toFixed(0)}" stroke="currentColor" stroke-width="38" ` +
    `stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true">` +
    `<style>.bfill{fill:currentColor}</style>${staff}${body}</svg>`;
}

function classChip(c) {
  const n = className(c);
  return n ? `<span class="cls cls-${c.v.c}">${n}</span>` : '';
}

function chip(c, unit = 3.2, extra = '', note = '') {
  const n = note ? `<small class="note">${esc(note)}</small>` : '';
  return `<button type="button" class="chip" data-detail="${c.id}"${extra}>${symbolSVG(c, unit)}<span>${esc(c.word)}</span>${n}</button>`;
}

/**
 * "djur + vatten + jord", med symbol per del och BCI:s anteckning under
 * ("halv storlek", "förkortning"). En del som BCI-AV:s namn inte entydigt pekar
 * ut visas som BCI:s text, utan symbol — hellre det än en gissning.
 */
function formulaHTML(c, unit = 3.2) {
  if (!c.raw.length) return bareFormHTML(c, unit);
  const label = (p, i) => (typeof p === 'number'
    ? deck.get(p)?.word || (LANG === 'en' ? enSyns(getById(p)?.en || '')[0] : getById(p)?.sv.split(',')[0]) || p
    : (LANG === 'en' && c.textEn[i]) || String(p).replace(/_/g, ' '));
  const parts = c.raw.map((p, i) => {
    const note = c.notes[i] || '';
    if (typeof p === 'number' && deck.has(p)) return chip(deck.get(p), unit, '', note);
    return `<span class="chip txt" title="${L('BCI:s text – ingen entydig symbol', 'BCI text – no unambiguous symbol')}">${esc(label(p, i))}${note ? `<small class="note">${esc(note)}</small>` : ''}</span>`;
  });
  return `<div class="formula">${parts.join('<span class="op">+</span>')}</div>` + mergedNote(c) + opNote(c) + bareFormHTML(c, unit);
}

/** "Utan operatorn: …" – symbolen med exakt samma ritning men utan indikatorn ovanpå. */
function bareFormHTML(c, unit = 2.8) {
  if (!c.bare) return '';
  // Hela BCI-glosan ("tillvaro, existens (2)"), så att det syns vilken betydelse som avses.
  const one = (o) => `<button type="button" class="chip" data-detail="${o.id}">${symbolSVG(o, unit)}<span>${esc(o.syns.join(', '))}</span></button>`;
  return `<div class="bare-form"><span class="bare-label">${L('Utan operatorn:', 'Without the indicator:')}</span>${c.bare.map((id) => one(deck.get(id))).join('')}</div>`;
}

/** Förklaring under formeln för sammanslagna tecken (BCI: superimposed, Fundamental Rules 5.1.4). */
function mergedNote(c) {
  if (!c.merged) return '';
  return `<p class="merged-note">${L('Sammanslaget tecken – delarna kan vara ritade i ändrad form.',
    'Composite character – the parts may be drawn in a changed form.')}</p>`;
}

/** Förklaring när delar har egna operatorer (bli = gå + vara + operator): bara en operator syns i ordet. */
function opNote(c) {
  if (c.opHidden) {
    return `<p class="merged-note">${L('Delarnas operatorer tas bort när ord sätts ihop.',
      'The parts’ indicators are removed when words are combined.')}</p>`;
  }
  if (!c.opDropped) return '';
  return `<p class="merged-note">${L('Delarnas operatorer ersätts av en enda för hela ordet.',
    'The parts’ indicators are replaced by one for the whole word.')}</p>`;
}

// ---------------------------------------------------------------- meningar
// Övningen "Färdigställ meningen": meningar ur src/vendor/bliss-meningar.js (byggd av
// scripts/build-meningar.mjs ur data/meningar.json). Bara status "godkänd" används —
// utkasten granskas först. ?utkast=1 i adressen tar med utkasten (för granskare).
const SHOW_DRAFTS = /[?&]utkast=1\b/.test(location.search);
const SENTENCES = (window.MENINGAR || []).filter((m) => m.status === 'godkänd' || (SHOW_DRAFTS && m.status === 'utkast'));
let sfocus = null;
// En mening låses upp när man har mött minst ett av dess ord – resten får man upptäcka (översättningen
// visas under symbolerna efter svaret). Granskare (?utkast=1) ser alla.
const sentenceOpen = (m) => SHOW_DRAFTS || m.ord.some((w) => S.cards[w.id]);
const openSentences = () => SENTENCES.filter(sentenceOpen);
const sentenceCount = () => openSentences().length;
const sentenceTotal = () => SENTENCES.length;
function startSentences() {
  const open = openSentences();
  sfocus = { queue: shuffle(open.map((m) => m.nr)), total: open.length };
}
const endSentences = () => { sfocus = null; };
const sentenceState = () => (sfocus ? { left: sfocus.queue.length, total: sfocus.total } : null);
function nextSentence() {
  if (!sfocus || !sfocus.queue.length) return null;
  // samma mening inte två gånger i rad om det går att undvika
  const nr = sfocus.queue.find((x) => x !== sfocus.last) ?? sfocus.queue[0];
  sfocus.last = nr;
  const m = SENTENCES.find((x) => x.nr === nr);
  // Rätt ord + tre slumpvis valda ur meningens pool av felaktiga alternativ – varierar varje gång.
  const wrong = shuffle(m.alt.slice(1)).slice(0, 3);
  const opts = shuffle([{ ...m.alt[0], ok: true }, ...wrong.map((a) => ({ ...a, ok: false }))]);
  return { kind: 'sentence', m, options: opts, answer: opts.findIndex((o) => o.ok) };
}
function answerSentence(nr, ok) {
  const k = sfocus.queue.indexOf(nr);
  if (k >= 0) { sfocus.queue.splice(k, 1); if (!ok) sfocus.queue.push(nr); }
  practiced();
  save();
}
/** Ett ord i en mening (elementlista ur bygget) ritat i meningens gemensamma ram. */
const SENTENCE_FRAME = [-60, 2060];
// spaced: ett helt symbolavstånd (800 = en ruta, himmel till jord) mellan orden i en mening – halva på var sida.
function wordSVG(key, e, unit, cls = '', spaced = false) {
  return frameSVG('w:' + key, unit, cls, spaced);
}
/** En färdig ritning (nyckel i RITNINGAR) i meningarnas gemensamma ram – även skrivfältets ord. */
function frameSVG(key, unit, cls = '', spaced = false) {
  return symbolSVG({ id: key, v: { e: [] } }, unit, cls, SENTENCE_FRAME, spaced ? 400 : null);
}
/** Lägg till färdiga ritningar (de böjda formerna i src/vendor/bliss-former.js, som laddas när de behövs). */
function addDrawings(more) {
  for (const [k, body] of Object.entries(more || {})) { RITNINGAR[k] = body; bodyCache.delete(k); }
}
const hasDrawing = (key) => Object.prototype.hasOwnProperty.call(RITNINGAR, key);

/**
 * Det som läses upp: ordet utan BCI:s parentes ("tro (verb)" → "tro"), med mellanslag för _ ("en_annan_gång")
 * och en kort paus för / ("he/she" → "he, she").
 */
function speechText(word) {
  let w = String(word || ''), prev;
  do { prev = w; w = w.replace(/\s*-?\([^()]*\)\s*$/, ''); } while (w !== prev);
  return w.replace(/_/g, ' ').replace(/\s*\/\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

window.Glosor = {
  MODES, S, save, resetProgress, stats, streak, bestStreak, nextStep, grade, checkParts, fmtInterval, boxOf, card, className, deck,
  symbolSVG, chip, classChip, formulaHTML, esc, unlockedCompounds, nextAtom, newLeft, dueIds, LEARNED_BOX,
  isMine, mineCards, toggleMine, startFocus, endFocus, focusState, mergedNote, reviewCount, nextDue,
  noteConfusion, confusedPairs, answerPair, compareParts, nextGoal, CORE, stageOf,
  exportBackup, readBackup, importBackup,
  sentenceCount, sentenceTotal, startSentences, endSentences, sentenceState, nextSentence, answerSentence, wordSVG,
  frameSVG, addDrawings, hasDrawing, splitSyns,
  milestoneState, checkMilestones, rankOf, lang, setLang, speechText,
  sentenceDrafts: SHOW_DRAFTS, shuffle,
};
})();
