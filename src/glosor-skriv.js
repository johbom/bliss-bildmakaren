/**
 * Skrivfältet "Skriv en egen mening": text med bokstäver -> Bliss-ord. Bara logiken; vyn är src/ui/skriv.js.
 *
 * Ärlighetsregeln (som i src/lemmatize.js): ett ord får bara en symbol när ordet är en av BCI:s egna
 * glosor för symbolen, eller en böjd form vars grundform är det (med rätt ordklass). Annars visas ordet
 * som text – hellre en synlig lucka än fel symbol. Inget gissas med likhet eller stavningsförslag.
 *
 * Böjningar skrivs som i de godkända meningarna i övningen (data/meningar.json):
 *   plural (katter), dåtid (åt) och framtid ("ska läsa") får BCI:s indikator,
 *   nutid (leker) och bestämd form (hunden) skrivs utan, och artiklarna en/ett hoppas över.
 * De böjda formerna är ritade i förväg av originalmotorn (scripts/build-former.mjs).
 *
 * Varje ord får en lista med alternativ: symboler med samma ord (man = han/hon, man = karl …),
 * andra tolkningar av böjningen och, för artiklar, att hoppa över ordet. Det första används;
 * i vyn trycker man på symbolen för att välja ett annat.
 */
(() => {
const G = window.Glosor;
const { deck, lang } = G;
const LEMMA = window.BlissLemma;

/** Former med färdiga ritningar, per ordklass (samma som FORMS i scripts/build-former.mjs). */
const FORMS = { RED: ['past_action', 'future_action'], YELLOW: ['plural'], BLUE: ['plural'] };
const formKey = (id, form) => (form ? `f:${id}:${form}` : String(id));
const canForm = (c, form) => !form || (FORMS[c.v.c] || []).includes(form);
const FORM_NAME = {
  action: ['handling', 'action'], past_action: ['dåtid', 'past'], future_action: ['framtid', 'future'], plural: ['plural', 'plural'],
};
const formName = (form) => (FORM_NAME[form] ? FORM_NAME[form][lang() === 'en' ? 1 : 0] : '');

const norm = (s) => String(s).toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const bare = (s) => s.replace(/\s*\([^()]*\)\s*$/, '').trim();

// ---- uppslag: ord -> kort, per språk ----
const index = { sv: null, en: null };
function indexFor(l) {
  if (index[l]) return index[l];
  const m = new Map();
  const add = (k, c, rank) => {
    if (!k) return;
    if (!m.has(k)) m.set(k, new Map());
    const byId = m.get(k);
    if (!byId.has(c.id) || byId.get(c.id) > rank) byId.set(c.id, rank);
  };
  for (const c of deck.values()) {
    if (c.v.c === 'GRAY') continue;   // markörer (indikatorer) skrivs inte som egna ord
    const syns = l === 'en' ? c.synsEn : c.synsSv;
    const head = norm(l === 'en' ? c.headEn[0] : c.headSv[0]);
    syns.forEach((s0) => {
      const s = norm(s0);
      // 0: ordet är kortets huvudord, 1: huvudordet utan BCI:s parentes ("jag (fem.)"), 2: en synonym
      const rank = s === head ? 0 : 2;
      add(s, c, rank);
      add(bare(s), c, s === head ? 1 : 3);
      if (l === 'en' && /^to /.test(s)) add(s.slice(3), c, rank);
    });
  }
  index[l] = m;
  return m;
}
/** Korten för ett ord, bäst först: huvudord före synonym, sedan det vanligaste. */
function lookup(word, l = lang()) {
  const hit = indexFor(l).get(norm(word));
  if (!hit) return [];
  return [...hit].map(([id, rank]) => ({ c: deck.get(id), rank }))
    .sort((a, b) => a.rank - b.rank || b.c.freq - a.c.freq).map((x) => x.c);
}

// ---- böjningar ----
// Svenska: projektets morfologi (src/lemmatize.js via src/vendor/bliss-lemma.js), validerad mot korten.
const toForm = (keys) => (keys.includes('past_action') ? 'past_action' : keys.includes('plural') ? 'plural' : null);
const POS = { V: ['RED'], N: ['YELLOW', 'BLUE'], A: ['GREEN', 'WHITE'] };
// Engelska: bara de regelbundna ändelserna och en liten tabell med vanliga oregelbundna former.
const EN_PAST = {
  ate: 'eat', saw: 'see', went: 'go', was: 'be', were: 'be', had: 'have', did: 'do', made: 'make', came: 'come',
  took: 'take', gave: 'give', got: 'get', said: 'say', ran: 'run', sat: 'sit', slept: 'sleep', drank: 'drink',
  wrote: 'write', read: 'read', bought: 'buy', thought: 'think', felt: 'feel', found: 'find', knew: 'know',
  told: 'tell', met: 'meet', left: 'leave', sang: 'sing', swam: 'swim', drove: 'drive', flew: 'fly', fell: 'fall',
  heard: 'hear', held: 'hold', kept: 'keep', lost: 'lose', paid: 'pay', sold: 'sell', sent: 'send', spoke: 'speak',
  stood: 'stand', taught: 'teach', threw: 'throw', understood: 'understand', won: 'win', woke: 'wake', wore: 'wear',
  brought: 'bring', built: 'build', caught: 'catch', chose: 'choose', cut: 'cut', drew: 'draw', fought: 'fight',
  forgot: 'forget', grew: 'grow', hid: 'hide', hit: 'hit', hurt: 'hurt', lay: 'lie', let: 'let', meant: 'mean',
  put: 'put', rode: 'ride', rose: 'rise', shut: 'shut', spent: 'spend', stole: 'steal', struck: 'strike',
};
const EN_PLURAL = {
  men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose',
  people: 'person', sheep: 'sheep', fish: 'fish', oxen: 'ox', wives: 'wife', knives: 'knife', leaves: 'leaf',
  wolves: 'wolf', lives: 'life', halves: 'half', loaves: 'loaf', shelves: 'shelf', thieves: 'thief',
};
function analyzeEn(t, senses) {
  const out = [];
  const take = (lemma, keys, pos) => {
    const s = senses(lemma).filter((e) => POS[pos].includes(e.c));
    if (s.length) out.push({ lemma, keys, pos, senses: s });
  };
  if (EN_PAST[t]) { take(EN_PAST[t], ['past_action'], 'V'); out.forEach((a) => { a.rule = 'irr-verb'; }); }
  if (EN_PLURAL[t]) take(EN_PLURAL[t], ['plural'], 'N');
  const m = [
    [/ies$/, ['y'], ['plural'], 'N'], [/(s|x|z|ch|sh)es$/, ['$1'], ['plural'], 'N'], [/([^s])s$/, ['$1'], ['plural'], 'N'],
    [/ied$/, ['y'], ['past_action'], 'V'], [/([^aeiou])\1ed$/, ['$1'], ['past_action'], 'V'],
    [/ed$/, ['', 'e'], ['past_action'], 'V'],
    [/(s|x|z|ch|sh)es$/, ['$1'], [], 'V'], [/ies$/, ['y'], [], 'V'], [/([^s])s$/, ['$1'], [], 'V'],   // he eats
  ];
  for (const [re, adds, keys, pos] of m) {
    if (!re.test(t)) continue;
    for (const a of adds) take(t.replace(re, a), keys, pos);
  }
  return out;
}

const PRONOUNS = new Set(['i', 'me', 'you', 'he', 'she', 'it', 'we', 'they', 'him', 'her', 'us', 'them', 'one']);
const isPronoun = (c) => c.v.c === 'BLUE' && c.synsEn.some((s) => PRONOUNS.has(norm(s)));

/** Tolkningar av ett böjt ord: [{ c, form }], bäst först (ordet före kan avgöra verb/substantiv). */
function inflected(t, prev, l) {
  const senses = (k) => lookup(k, l).map((c) => ({ c: c.v.c, card: c }));
  let analyses = l === 'en' ? analyzeEn(t, senses) : LEMMA ? LEMMA.analyze(t, senses) : [];
  const want = l === 'en' ? null : analyses.length > 1 && LEMMA ? LEMMA.contextPrefers(prev) : null;
  if (want) analyses = [...analyses.filter((a) => a.pos === want), ...analyses.filter((a) => a.pos !== want)];
  const out = [];
  for (const a of analyses) {
    // Ett böjt substantiv (mannen, männen) är inte pronomenet med samma ord (man = han/hon): det sist.
    const senses = a.pos === 'N' ? [...a.senses.filter((s) => !isPronoun(s.card)), ...a.senses.filter((s) => isPronoun(s.card))] : a.senses;
    for (const s of senses) {
      const form = toForm(a.keys);
      out.push({ c: s.card, form: canForm(s.card, form) ? form : null, lemma: a.lemma, irr: a.rule === 'irr-verb' });
    }
  }
  return out;
}

// ---- meningen ----
const ARTICLES = { sv: new Set(['en', 'ett']), en: new Set(['a', 'an', 'the']) };
const FUTURE = { sv: new Set(['ska', 'skall']), en: new Set(['will', 'shall']) };
// Ord som brukar stå efter en preposition ("åt mig", "åt någon", "åt en vän").
const OBJECTS = {
  sv: new Set(('mig dig sig honom henne hen oss er dem någon något några alla ingen inget den det denna detta dessa ' +
    'en ett min mitt mina din ditt dina sin sitt sina vår vårt våra er ert era hans hennes deras varandra').split(' ')),
  en: new Set(('me you him her it us them someone somebody something everyone a an the my your his its our their').split(' ')),
};
// Samma ord, annan stavning än BCI:s glosa: "ska" är dagens form av BCI:s "skall" (shall, will).
const SPELLING = { sv: { ska: 'skall' }, en: {} };
const PUNCT = /^[\s"'«»“”‘’.,!?;:()[\]…–—-]+|[\s"'«»“”‘’.,!?;:()[\]…–—-]+$/g;

/**
 * Alternativen för ett ord, utan dubletter: { id, form, key }, { skip: true } eller { text: true }.
 * via: synonymen (BCI:s ord) när symbolen hittats genom synonymordlistan ("brand" ≈ eld).
 */
function optionsList(list) {
  const seen = new Set(), out = [];
  for (const o of list) {
    const k = o.skip ? 'skip' : o.text ? 'text' : formKey(o.c.id, o.form);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o.skip ? { skip: true, key: k } : o.text ? { text: true, key: k }
      : { id: o.c.id, form: o.form || null, key: k, ...(o.via ? { via: o.via } : {}), ...(o.derived ? { derived: true } : {}) });
  }
  return out;
}

// ---- härledda verb (src/vendor/bliss-harledda.js) ----
// Verb som BCI inte har men som är bildade av ett BCI-ord: tystna <- tystnad. I Bliss blir ordet ett
// verb med handlingsindikatorn ovanpå; formerna (handling, dåtid, framtid) är ritade i förväg.
/** [{ c, form, derived: true, sure }] för ett verb eller dess böjda form (tystnar, tystnade). */
function derived(t, l) {
  const H = window.BLISS_HARLEDDA;
  if (l !== 'sv' || !H) return [];
  const cardsOf = (v) => (H[v] || []).map(([id, sure]) => ({ c: deck.get(id), sure: !!sure, derived: true })).filter((x) => x.c);
  const out = cardsOf(t).map((x) => ({ ...x, form: 'action' }));
  if (LEMMA) {
    for (const a of LEMMA.analyze(t, (k) => cardsOf(k).map((x) => ({ c: 'RED', x })))) {
      if (a.pos !== 'V') continue;
      const form = a.keys.includes('past_action') ? 'past_action' : 'action';
      for (const s of a.senses) out.push({ ...s.x, form });
    }
  }
  return out;
}

// ---- synonymordlistan (Swesaurus, src/vendor/bliss-synonymer.js) ----
// Ord som BCI inte har -> BCI-ord med samma betydelse. Bara svenska. Synonymen används direkt när
// Swesaurus är säker (grad minst SYN_SURE), annars är ordet text och synonymen ett förslag.
const SYN_SURE = 80;
/** [{ c, form, via, deg }] för ett ord eller dess böjda form ("bränder" -> brand -> eld, plural). */
function synonyms(t, l) {
  const SYN = window.BLISS_SYNONYMER;
  if (l !== 'sv' || !SYN) return [];
  const cardsOf = (w) => (SYN[w] || []).flatMap(([to, deg]) => lookup(to, l).map((c) => ({ c, via: to, deg })));
  const out = cardsOf(t);
  if (LEMMA) {
    const seen = new Map();
    const senses = (k) => { if (!seen.has(k)) seen.set(k, cardsOf(k)); return seen.get(k).map((x) => ({ c: x.c.v.c, x })); };
    for (const a of LEMMA.analyze(t, senses)) {
      const form = toForm(a.keys);
      for (const s of a.senses) out.push({ ...s.x, form: canForm(s.x.c, form) ? form : null });
    }
  }
  return out.sort((a, b) => b.deg - a.deg);
}

/**
 * Ord som BCI inte har: symboler vars glosa börjar likadant ("tystnar" -> tyst, tystnad). Bara förslag –
 * ordet visas som text tills man själv väljer ett av dem.
 */
function similar(word, l) {
  if (word.length < 4) return [];
  const pre = word.slice(0, Math.max(4, word.length - 3));
  const hits = [];
  for (const [k, ids] of indexFor(l)) {
    if (!k.startsWith(pre) || /[()]/.test(k)) continue;
    for (const id of ids.keys()) hits.push({ c: deck.get(id), k });
  }
  hits.sort((a, b) => a.k.length - b.k.length || b.c.freq - a.c.freq);
  const seen = new Set();
  return hits.filter((h) => !seen.has(h.c.id) && seen.add(h.c.id)).slice(0, 8);
}

/**
 * Texten som Bliss: [{ text, options }] – ett ord eller en fras ("tycker om") per post, i skriven ordning.
 * Det första alternativet är förvalt. guess: ordet finns inte hos BCI; först "som text", sedan förslag.
 * future: "ska"/"will" – hoppar man över ordet får nästa handlingsord framtidsformen (alternativet futureAt).
 */
function writeWords(text, l = lang()) {
  const raw = String(text || '').split(/\s+/).filter(Boolean);
  const toks = raw.map((r) => ({ raw: r.replace(/["'«»“”‘’)\]]+$/, ''), text: r.replace(PUNCT, '') || r, clean: norm(r.replace(PUNCT, '')) }));
  const out = [];
  let futureFrom = -1;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!t.clean) continue;
    const prev = i ? toks[i - 1].clean : '';
    // Fraser först (tre eller två ord): "tycka om", "tycker om" (första ordet får vara böjt).
    let phrase = null;
    for (let n = Math.min(3, toks.length - i); n >= 2 && !phrase; n--) {
      const words = toks.slice(i, i + n).map((x) => x.clean);
      if (words.some((w) => !w)) continue;
      const rest = words.slice(1).join(' ');
      const exact = lookup(words.join(' '), l).map((c) => ({ c }));
      const infl = inflected(words[0], prev, l).filter((x) => x.c)
        .flatMap((x) => lookup(`${x.lemma} ${rest}`, l)
          .map((c) => ({ c, form: canForm(c, x.form) ? x.form : null })));
      const found = [...exact, ...infl];
      if (found.length) phrase = { n, found };
    }
    let found;
    if (phrase) {
      found = phrase.found;
      out.push({ text: toks.slice(i, i + phrase.n).map((x) => x.text).join(' '), options: [] });
      i += phrase.n - 1;
    } else {
      const exact = [...lookup(t.clean, l), ...(SPELLING[l][t.clean] ? lookup(SPELLING[l][t.clean], l) : [])].map((c) => ({ c }));
      const infl = inflected(t.clean, prev, l);
      // Oregelbundna verbformer (såg, var, åt) före samma ord som substantiv – utom efter en artikel
      // eller ett räkneord ("en såg"). Det andra finns kvar som alternativ.
      const nounCtx = ARTICLES[l].has(prev) || (l === 'sv' && LEMMA?.contextPrefers(prev) === 'N');
      const irr = nounCtx ? [] : infl.filter((x) => x.irr);
      // BCI:s egennamn ("Himlen" = himmelriket) efter vanliga ord, om man inte själv skrivit stor bokstav mitt i meningen.
      const proper = (c) => /^\p{Lu}/u.test(l === 'en' ? c.headEn[0] : c.headSv[0]);
      const asName = i > 0 && !/[.!?…]$/.test(toks[i - 1].raw) && /^\p{Lu}/u.test(t.text);
      const names = asName ? [] : exact.filter((x) => proper(x.c));
      const plain = exact.filter((x) => !names.includes(x));
      found = exact.length ? [...irr, ...plain, ...infl, ...names] : infl;
      // Ett ord som BCI inte har men som också är en böjd form: "åt" = äta i dåtid, eller åt (någon) ≈ till.
      // Synonymen först när ett objekt följer ("åt mig", "åt någon") och inget subjekt står före ("jag åt").
      if (!exact.length && infl.length) {
        const syn = synonyms(t.clean, l).filter((x) => x.deg >= SYN_SURE && !x.form);
        if (syn.length) {
          const next = toks[i + 1];
          const objNext = !!next && (OBJECTS[l].has(next.clean) || /^\p{Lu}/u.test(next.text));
          const subjBefore = l === 'sv' ? LEMMA?.contextPrefers(prev) === 'V' : false;
          found = objNext && !subjBefore ? [...syn, ...infl] : [...infl, ...syn];
        }
      }
      out.push({ text: t.text, options: [] });
    }
    const w = out[out.length - 1];
    const last = i === toks.length - 1;
    if (!phrase && ARTICLES[l].has(t.clean) && !last) {
      // Artikeln före en sak: BCI:s artikel (en, ett = a, an) först, sedan ordets andra betydelser
      // ("ett" = siffran 1). Den kan också hoppas över, som i meningsövningen.
      const isArticle = (x) => x.c.synsEn.some((s) => ['a', 'an', 'the'].includes(norm(s)));
      w.options = optionsList([...found.filter(isArticle), ...found, { skip: true }]);
      continue;
    }
    if (!phrase && FUTURE[l].has(t.clean) && !last) {
      // "ska läsa": BCI:s skall + läsa, eller – hoppar man över "ska" – läsa med framtidsformen,
      // som i meningsövningen ("Barnet ska läsa en bok").
      w.options = optionsList([...found, { skip: true }]);
      w.future = true;
      futureFrom = out.length - 1;
      continue;
    }
    if (!found.length && !phrase) {
      // BCI har inte ordet: synonymer och härledda verb (säkra först, annars efter "som text"),
      // sist ord som börjar likadant.
      const syn = synonyms(t.clean, l), der = derived(t.clean, l);
      const list = [...syn.filter((x) => x.deg >= SYN_SURE), ...der.filter((x) => x.sure), { text: true }, ...syn, ...der,
        ...similar(t.clean, l)];
      if (list.length > 1) { found = list; w.guess = true; }
    }
    if (futureFrom >= 0) {
      const verbs = found.filter((x) => x.c && ((x.c.v.c === 'RED' && !x.form) || (x.derived && x.form === 'action')));
      w.options = optionsList([...found, ...verbs.map((x) => ({ ...x, form: 'future_action' }))]);
      const at = w.options.findIndex((o) => o.form === 'future_action');
      if (at >= 0) { w.futureFrom = futureFrom; w.futureAt = at; }
      futureFrom = -1;
      continue;
    }
    w.options = optionsList(found);
  }
  return out;
}

/**
 * Det valda alternativet för varje ord. picks(i) = det man själv valt (index) eller undefined.
 * Hoppar man över "ska" och inte valt något annat för verbet efter, får verbet framtidsformen.
 */
function chosenOptions(words, picks = () => undefined) {
  const res = [];
  words.forEach((w, i) => {
    let j = picks(i);
    if (j == null) j = w.futureFrom != null && res[w.futureFrom]?.skip ? w.futureAt : 0;
    res.push(w.options[Math.min(j, w.options.length - 1)] || null);
  });
  return res;
}

/** Ordet som ett alternativ står för, för knappar och uppläsning: "katt", med formen bredvid i vyn. */
const optionLabel = (o) => (o.skip || o.text ? '' : deck.get(o.id).word);

Object.assign(G, { writeWords, chosenOptions, formKey, formName, optionLabel, WRITE_FORMS: FORMS });
})();
