// AUTO-GENERERAD av scripts/build-lemma.js ur src/inflect.js och src/lemmatize.js – ändra där, inte här.
(() => {
/**
 * Svenska ytformer under symbolen — portad från BlissEngine/"workbench 2"/app.js
 * (svInflect + W_SV_VERBS, Håkan Larsson, 2026-10-15: "gå #2" ska visa "går").
 *
 * ÄRLIGHETSREGELN (från källan): en FEL form är värre än grundformen — ordet
 * under symbolen ÄR kommunikationen. Därför: en kuraterad tabell bär de
 * starka och grupp-2-verben (slutna klasser), två säkra regler bär de
 * produktiva klasserna, och allt annat behåller grundformen (returnerar null).
 * Ett ord användaren själv skrivit i etikettfältet skrivs aldrig över.
 */

// base: [presens, dåtid, uppmaning]
const SV_VERBS = {
  'vara': ['är', 'var', 'var'], 'ha': ['har', 'hade', 'ha'], 'bli': ['blir', 'blev', 'bli'],
  'gå': ['går', 'gick', 'gå'], 'stå': ['står', 'stod', 'stå'], 'få': ['får', 'fick', 'få'],
  'förstå': ['förstår', 'förstod', 'förstå'], 'se': ['ser', 'såg', 'se'], 'ge': ['ger', 'gav', 'ge'],
  'ta': ['tar', 'tog', 'ta'], 'dra': ['drar', 'drog', 'dra'], 'dö': ['dör', 'dog', 'dö'],
  'le': ['ler', 'log', 'le'], 'slå': ['slår', 'slog', 'slå'],
  'komma': ['kommer', 'kom', 'kom'], 'äta': ['äter', 'åt', 'ät'], 'dricka': ['dricker', 'drack', 'drick'],
  'sova': ['sover', 'sov', 'sov'], 'springa': ['springer', 'sprang', 'spring'],
  'sitta': ['sitter', 'satt', 'sitt'], 'ligga': ['ligger', 'låg', 'ligg'],
  'lägga': ['lägger', 'la', 'lägg'], 'sätta': ['sätter', 'satte', 'sätt'],
  'säga': ['säger', 'sa', 'säg'], 'göra': ['gör', 'gjorde', 'gör'], 'veta': ['vet', 'visste', 'vet'],
  'vilja': ['vill', 'ville'], 'kunna': ['kan', 'kunde'], 'finnas': ['finns', 'fanns'],
  'heta': ['heter', 'hette'], 'betyda': ['betyder', 'betydde'],
  'läsa': ['läser', 'läste', 'läs'], 'skriva': ['skriver', 'skrev', 'skriv'],
  'åka': ['åker', 'åkte', 'åk'], 'köra': ['kör', 'körde', 'kör'], 'ringa': ['ringer', 'ringde', 'ring'],
  'köpa': ['köper', 'köpte', 'köp'], 'tycka': ['tycker', 'tyckte', 'tyck'],
  'tänka': ['tänker', 'tänkte', 'tänk'], 'känna': ['känner', 'kände', 'känn'],
  'höra': ['hör', 'hörde', 'hör'], 'hjälpa': ['hjälper', 'hjälpte', 'hjälp'],
  'leka': ['leker', 'lekte', 'lek'], 'söka': ['söker', 'sökte', 'sök'], 'byta': ['byter', 'bytte', 'byt'],
  'stänga': ['stänger', 'stängde', 'stäng'], 'möta': ['möter', 'mötte', 'möt'],
  'leva': ['lever', 'levde', 'lev'], 'välja': ['väljer', 'valde', 'välj'],
  'sälja': ['säljer', 'sålde', 'sälj'], 'falla': ['faller', 'föll', 'fall'],
  'hålla': ['håller', 'höll', 'håll'], 'bjuda': ['bjuder', 'bjöd', 'bjud'],
  'sjunga': ['sjunger', 'sjöng', 'sjung'], 'gråta': ['gråter', 'grät', 'gråt'],
  'vinna': ['vinner', 'vann', 'vinn'], 'brinna': ['brinner', 'brann', 'brinn'],
  'flyga': ['flyger', 'flög', 'flyg'], 'rida': ['rider', 'red', 'rid'],
  'krypa': ['kryper', 'kröp', 'kryp'], 'bita': ['biter', 'bet', 'bit'],
  'blåsa': ['blåser', 'blåste', 'blås'], 'frysa': ['fryser', 'frös', 'frys'],
  'växa': ['växer', 'växte', 'väx'], 'behöva': ['behöver', 'behövde', 'behöv'],
  'följa': ['följer', 'följde', 'följ'], 'glömma': ['glömmer', 'glömde', 'glöm'],
  'gömma': ['gömmer', 'gömde', 'göm'], 'resa': ['reser', 'reste', 'res'],
  'bära': ['bär', 'bar', 'bär'], 'skära': ['skär', 'skar', 'skär'], 'stiga': ['stiger', 'steg', 'stig'],
  'lyfta': ['lyfter', 'lyfte', 'lyft'], 'trycka': ['trycker', 'tryckte', 'tryck'],
  'släppa': ['släpper', 'släppte', 'släpp'], 'klippa': ['klipper', 'klippte', 'klipp'],
  'bygga': ['bygger', 'byggde', 'bygg'], 'riva': ['river', 'rev', 'riv'],
  'skjuta': ['skjuter', 'sköt', 'skjut'], 'steka': ['steker', 'stekte', 'stek'],
  'skölja': ['sköljer', 'sköljde', 'skölj'], 'gräva': ['gräver', 'grävde', 'gräv'],
  'drömma': ['drömmer', 'drömde', 'dröm'], 'svälja': ['sväljer', 'svalde', 'svälj'],
  'räcka': ['räcker', 'räckte', 'räck'], 'väga': ['väger', 'vägde', 'väg'],
  'mäta': ['mäter', 'mätte', 'mät'], 'lära': ['lär', 'lärde', 'lär'],
  'skrika': ['skriker', 'skrek', 'skrik'], 'kyssa': ['kysser', 'kysste', 'kyss'],
  'störa': ['stör', 'störde', 'stör'], 'böja': ['böjer', 'böjde', 'böj'],
  'stryka': ['stryker', 'strök', 'stryk'], 'hänga': ['hänger', 'hängde', 'häng'],
  'finna': ['finner', 'fann', 'finn'], 'binda': ['binder', 'band', 'bind'], 'fara': ['far', 'for', 'far'],
  'ljuga': ['ljuger', 'ljög', 'ljug'], 'skina': ['skiner', 'sken', 'skin'], 'slita': ['sliter', 'slet', 'slit'],
  'stjäla': ['stjäl', 'stal', 'stjäl'], 'svära': ['svär', 'svor', 'svär'], 'tiga': ['tiger', 'teg', 'tig'],
  'dölja': ['döljer', 'dolde', 'dölj'], 'äga': ['äger', 'ägde', 'äg'], 'bryta': ['bryter', 'bröt', 'bryt'],
  'driva': ['driver', 'drev', 'driv'], 'duga': ['duger', 'dög', 'dug'], 'fly': ['flyr', 'flydde', 'fly'],
  'gälla': ['gäller', 'gällde', 'gäll'], 'knyta': ['knyter', 'knöt', 'knyt'], 'smyga': ['smyger', 'smög', 'smyg'],
  'sy': ['syr', 'sydde', 'sy'], 'bo': ['bor', 'bodde', 'bo'], 'tro': ['tror', 'trodde', 'tro'],
  'må': ['mår', 'mådde', 'må'], 'klä': ['klär', 'klädde', 'klä'], 'be': ['ber', 'bad', 'be'],
  'hinna': ['hinner', 'hann', 'hinn'], 'lida': ['lider', 'led', 'lid'], 'rinna': ['rinner', 'rann', 'rinn'],
  'slippa': ['slipper', 'slapp', 'slipp'], 'skola': ['ska', 'skulle'], 'böra': ['bör', 'borde'],
  'låta': ['låter', 'lät', 'låt'],
};

/**
 * @param {string} base     grundformen (infinitiv), t.ex. "äta"
 * @param {string[]} keys   valda indikatornycklar, t.ex. ['past_action']
 * @param {{c?:string}} [sym] symbolposten (ordklass 'RED' = verb)
 * @returns {string|null}   böjd form, eller null = behåll grundformen
 */
function svInflect(base, keys, sym) {
  const tense = keys.includes('past_action') ? 1 : keys.includes('present_action') ? 0
              : keys.includes('future_action') ? 2 : keys.includes('imperative_form') ? 3 : -1;
  if (tense < 0) return null;
  const b = String(base || '').toLowerCase().trim();
  if (!b || /\s/.test(b)) return null;
  if (tense === 2) return 'ska ' + b;               // analytiskt futurum — alltid säkert
  const t = SV_VERBS[b];
  if (t) return t[tense === 3 ? 2 : tense] || null;
  if (b.endsWith('s')) return null;                 // deponens (hoppas, trivas): lämna som skrivet
  if (!sym || sym.c !== 'RED') return null;         // reglerna nedan litar bara på riktiga verb
  if (b.endsWith('a') && b.length > 2)              // den produktiva klassen: hoppa→hoppar/hoppade
    return tense === 0 ? b + 'r' : tense === 1 ? b + 'de' : b;
  if (/[åäöoueiy]$/.test(b))                        // vokalverb: bo→bor/bodde, tro, må, sy, klä
    return tense === 0 ? b + 'r' : tense === 1 ? b + 'dde' : b;
  return null;
}

let LEMMAS = null;
const FORM_KEYS = ['present_action', 'past_action', 'imperative_form'];
/**
 * Grundform(er) + vilken form det är, för en böjd form ur samma kuraterade
 * lista — en SLUTEN klass, alltså säkert: "åt"->äta (past_action), "är"->vara
 * (present_action), "gick"->gå, "vill"->vilja. Ett ord kan ha flera ("var" =
 * vara dåtid / uppmaning) — alla returneras, dåtid före uppmaning. Grundformen
 * själv (äta->äta) ger tomt svar.
 * @returns {Array<{base:string, key:string}>}
 */
function svFormsOf(form) {
  if (!LEMMAS) {
    LEMMAS = new Map();
    for (const [base, forms] of Object.entries(SV_VERBS)) {
      forms.forEach((f, i) => {
        if (!f || f === base) return;
        if (!LEMMAS.has(f)) LEMMAS.set(f, []);
        const list = LEMMAS.get(f);
        const key = FORM_KEYS[i];
        if (!list.some((x) => x.base === base)) list.push({ base, key });
      });
    }
  }
  return (LEMMAS.get(String(form || '').toLowerCase().trim()) || []).slice();
}

/** Bara grundformerna (äldre API — kandidatlistan). */
function svLemmasOf(form) {
  return [...new Set(svFormsOf(form).map((x) => x.base))];
}

/**
 * Svensk morfologi för blissmaiker: böjd form -> grundform + vilken FORM det är
 * (presens, dåtid, plural, bestämd …), validerad mot det verkliga BCI-AV-
 * vokabuläret. Deterministisk — ingen AI behövs för "barnen sjunger glatt".
 *
 * ÄRLIGHETSREGELN (samma som src/inflect.js, ur WinBliss² workbench 2): en
 * analys godtas bara om grundformen FINNS i vokabuläret OCH dess ordklass
 * stämmer med regelns ordklass (verb->RED, substantiv->YELLOW/BLUE,
 * adjektiv->GREEN). Hittas ingen validerad grundform lämnas ordet som text —
 * hellre en synlig lucka än en felaktig symbol.
 *
 * Reglerna är skrivna för att täcka det regelbundna (ca 9 av 10 löpande
 * ord); det oregelbundna bärs av slutna tabeller (verb i src/inflect.js,
 * substantiv och adjektiv nedan). Tvetydigheter som regler inte kan avgöra
 * ("hoppar" verb/substantiv, "-en" bestämd singular/bestämd plural) returneras
 * som flera analyser i prioritetsordning — word-läget tar den första, AI:n
 * ser alla.
 */


// Ordklass hos BCI-AV-posten som reglerna får landa på.
const POS_CLASSES = { V: ['RED'], N: ['YELLOW', 'BLUE'], A: ['GREEN', 'WHITE'] };   // hel/all är klassade som funktionsord i BCI-AV

/**
 * Vanliga ETT-ord (neutrum) som slutar på konsonant: för dem betyder "-en"
 * bestämd PLURAL ("barnen", "husen"), för en-ord bestämd singular ("bilen").
 * Genus finns inte i BCI-AV, så det här är en kuraterad slutten lista — saknas
 * ordet tolkas "-en" som bestämd singular (och plural-läsningen finns kvar
 * som alternativ för AI:n).
 */
const NEUTER = new Set(('barn hus bord ben träd rum tak golv fönster land hål hav kök mål par plan pris ris skal ' +
  'skepp slag spel svar sår tåg tält tecken kors lås lån mjöl papper foto kort ljus ljud glas bad blad brev bröd ' +
  'djur fel fjäll fält frö gift hjul hår huvud hörn jobb knä kvarter lager lag lejon läger mynt märke möte namn ' +
  'nät ord område paket parti program rep rör språk steg tal underverk vin vete väder yrke år ägg öl dike ' +
  'exempel medel mönster tema konto ställe tillfälle äpple päron').split(/\s+/));

/** Oregelbundna substantivformer: form -> [grundform, nycklar]. */
const NOUN_IRR = {
  'män': ['man', ['plural']], 'männen': ['man', ['plural', 'definite_form']],
  'fötter': ['fot', ['plural']], 'fötterna': ['fot', ['plural', 'definite_form']],
  'tänder': ['tand', ['plural']], 'tänderna': ['tand', ['plural', 'definite_form']],
  'böcker': ['bok', ['plural']], 'böckerna': ['bok', ['plural', 'definite_form']],
  'händer': ['hand', ['plural']], 'händerna': ['hand', ['plural', 'definite_form']],
  'bröder': ['bror', ['plural']], 'bröderna': ['bror', ['plural', 'definite_form']],
  'systrar': ['syster', ['plural']], 'systrarna': ['syster', ['plural', 'definite_form']],
  'döttrar': ['dotter', ['plural']], 'döttrarna': ['dotter', ['plural', 'definite_form']],
  'söner': ['son', ['plural']], 'sönerna': ['son', ['plural', 'definite_form']],
  'ögon': ['öga', ['plural']], 'ögonen': ['öga', ['plural', 'definite_form']],
  'öron': ['öra', ['plural']], 'öronen': ['öra', ['plural', 'definite_form']],
  'gäss': ['gås', ['plural']], 'möss': ['mus', ['plural']],
  'bönder': ['bonde', ['plural']], 'bönderna': ['bonde', ['plural', 'definite_form']],
  'städer': ['stad', ['plural']], 'städerna': ['stad', ['plural', 'definite_form']],
  'länder': ['land', ['plural']], 'länderna': ['land', ['plural', 'definite_form']],
  'nätter': ['natt', ['plural']], 'nätterna': ['natt', ['plural', 'definite_form']],
  'stränder': ['strand', ['plural']], 'rötter': ['rot', ['plural']], 'kvinnorna': ['kvinna', ['plural', 'definite_form']],
  // dubbelteckning som reglerna inte ser: man -> mannen, himmel -> himlen
  'mannen': ['man', ['definite_form']],
  'himlen': ['himmel', ['definite_form']], 'himlar': ['himmel', ['plural']], 'himlarna': ['himmel', ['plural', 'definite_form']],
};

/** Oregelbundna adjektiv/adverb: form -> [grundform, nycklar]. Komparativ/superlativ saknar egen BCI-indikator, nycklar tomma. */
const ADJ_IRR = {
  'bättre': ['bra', []], 'bäst': ['bra', []], 'bästa': ['bra', []],
  'större': ['stor', []], 'störst': ['stor', []], 'största': ['stor', []],
  'mindre': ['liten', []], 'minst': ['liten', []], 'minsta': ['liten', []],
  'litet': ['liten', []], 'lilla': ['liten', []], 'små': ['liten', []],
  'äldre': ['gammal', []], 'äldst': ['gammal', []], 'äldsta': ['gammal', []], 'gamla': ['gammal', []], 'gammalt': ['gammal', []],
  'yngre': ['ung', []], 'yngst': ['ung', []], 'yngsta': ['ung', []],
  'sämre': ['dålig', []], 'sämst': ['dålig', []], 'sämsta': ['dålig', []],
  'mer': ['mycket', []], 'mest': ['mycket', []], 'fler': ['många', []], 'flest': ['många', []],
  'goda': ['god', []], 'gott': ['god', []], 'gärna': ['gärna', []],
};

/** Synkope: fågl- -> fågel, fönstr- -> fönster, cykl- -> cykel (e försvinner i böjning när ordet slutar -el/-en/-er). */
const syncope = (stem) => (/[^aeiouyåäö][lnr]$/.test(stem) ? stem.slice(0, -1) + 'e' + stem.slice(-1) : null);

/**
 * Suffixregler. `add` = vad som sätts på stammen för att få grundformen (flera
 * = flera möjliga stammar, t.ex. pojkar -> pojk+e). `keys` = BCI-indikatornycklar
 * (samma namn som i bliss-grammar.js). Lägre `pri` = hellre.
 */
const RULES = [
  // --- verb: dåtid (svaga) ---
  { suf: 'ade', add: ['a'], keys: ['past_action'], pos: 'V', pri: 3 },
  { suf: 'dde', add: [''], keys: ['past_action'], pos: 'V', pri: 7 },
  { suf: 'de', add: ['a', ''], keys: ['past_action'], pos: 'V', pri: 7 },
  { suf: 'te', add: ['a', ''], keys: ['past_action'], pos: 'V', pri: 7 },
  // --- verb: presens ---
  { suf: 'ar', add: ['a'], keys: ['present_action'], pos: 'V', pri: 4 },
  { suf: 'er', add: ['a', ''], keys: ['present_action'], pos: 'V', pri: 5 },
  { suf: 'r', add: [''], keys: ['present_action'], pos: 'V', pri: 6 },
  // --- substantiv: bestämd plural, plural, bestämd singular ---
  { suf: 'orna', add: ['a'], keys: ['plural', 'definite_form'], pos: 'N', pri: 10 },
  { suf: 'arna', add: ['', 'e', 'a', '*e'], keys: ['plural', 'definite_form'], pos: 'N', pri: 10 },
  { suf: 'erna', add: ['', 'e', '*e'], keys: ['plural', 'definite_form'], pos: 'N', pri: 10 },
  { suf: 'ena', add: ['', 'e'], keys: ['plural', 'definite_form'], pos: 'N', pri: 11 },
  { suf: 'na', add: [''], keys: ['plural', 'definite_form'], pos: 'N', pri: 12 },
  { suf: 'or', add: ['a'], keys: ['plural'], pos: 'N', pri: 12 },
  { suf: 'ar', add: ['', 'e', 'a', '*e'], keys: ['plural'], pos: 'N', pri: 12 },
  { suf: 'er', add: ['', 'e', '*e'], keys: ['plural'], pos: 'N', pri: 4.5 },
  { suf: 'en', add: ['', '*e'], keys: ['definite_form'], pos: 'N', pri: 13, genus: true },   // bilen; öknen -> öken
  { suf: 'et', add: ['', '*e'], keys: ['definite_form'], pos: 'N', pri: 13 },        // huset; fönstret -> fönster
  { suf: 't', add: [''], keys: ['definite_form'], pos: 'N', pri: 14, vowelEnd: true }, // äpplet -> äpple, hjärtat -> hjärta (inte högt -> hög)
  { suf: 'n', add: [''], keys: ['definite_form'], pos: 'N', pri: 14, nStem: true }, // flickan -> flicka, äpplen -> äpple
  // --- adjektiv (och adverb på -t) ---
  { suf: 'tt', add: ['d', 't'], keys: [], pos: 'A', pri: 20 },               // glatt -> glad, vitt -> vit
  { suf: 't', add: [''], keys: [], pos: 'A', pri: 21 },                      // stort -> stor, snabbt -> snabb
  { suf: 'a', add: [''], keys: [], pos: 'A', pri: 22 },                      // stora -> stor
  { suf: 'are', add: ['', 'e'], keys: [], pos: 'A', pri: 23 },
  { suf: 'aste', add: ['', 'e'], keys: [], pos: 'A', pri: 23 },
  { suf: 'ast', add: ['', 'e'], keys: [], pos: 'A', pri: 23 },
  // --- verb: supinum/particip (BCI har inga motsvarande indikatorer här -> etiketten bär formen) ---
  { suf: 'ande', add: ['a'], keys: ['present_participle'], pos: 'V', pri: 30 },
  { suf: 'ende', add: ['a', ''], keys: ['present_participle'], pos: 'V', pri: 30 },
  { suf: 'it', add: ['a', ''], keys: [], pos: 'V', pri: 31 },                // sjungit -> sjunga
  { suf: 'at', add: ['a'], keys: [], pos: 'V', pri: 31 },                    // hoppat -> hoppa
  { suf: 'ad', add: ['a'], keys: [], pos: 'V', pri: 32 },                    // älskad -> älska
  { suf: 't', add: ['a', ''], keys: [], pos: 'V', pri: 33 },                 // köpt -> köpa, läst -> läsa
  // --- genitiv (BCI-AV har ingen aktuell possessiv-indikator) ---
  { suf: 's', add: [''], keys: [], pos: 'N', pri: 90, possessive: true },
];

/**
 * @param {string} token  ordet som skrivet (skiftlägesokänsligt)
 * @param {(key:string)=>Array<{c:string}>} senses  uppslag av en grundform -> BCI-poster (rangordnade)
 * @returns {Array<{lemma:string, keys:string[], pos:string, rule:string, pri:number, entry:object, ambiguous?:boolean, possessive?:boolean}>}
 */
function analyze(token, senses) {
  const t = String(token || '').toLowerCase().trim();
  if (t.length < 2) return [];
  const out = [];
  const seen = new Set();
  const take = (lemma, keys, pos, rule, pri, extra) => {
    const classes = POS_CLASSES[pos];
    const entries = (senses(lemma) || []).filter((e) => classes.includes(e.c));
    if (!entries.length) return;
    const id = lemma + '|' + keys.join('+') + '|' + pos;
    if (seen.has(id)) return;
    seen.add(id);
    const weak = pos === 'A' && entries[0].c === 'WHITE';        // funktionsord-träff: efter riktiga adjektiv
    out.push({ lemma, keys, pos, rule, pri: pri + (weak ? 5 : 0), entry: entries[0], senses: entries, ...extra });
  };

  // 1) oregelbundna verb (sluten, kuraterad klass)
  for (const { base, key } of svFormsOf(t)) take(base, [key], 'V', 'irr-verb', 1);
  // 2) oregelbundna substantiv/adjektiv
  if (NOUN_IRR[t]) take(NOUN_IRR[t][0], NOUN_IRR[t][1], 'N', 'irr-noun', 2);
  if (ADJ_IRR[t]) take(ADJ_IRR[t][0], ADJ_IRR[t][1], 'A', 'irr-adj', 2);

  // 3) regelbundna ändelser
  for (const r of RULES) {
    if (!t.endsWith(r.suf)) continue;
    const stem = t.slice(0, t.length - r.suf.length);
    if (stem.length < 1) continue;
    for (const add of r.add) {
      let lemma0;
      if (add === '*e') { lemma0 = syncope(stem); if (!lemma0) continue; }
      else lemma0 = stem + add;
      // dubbelteckning i böjningen: rummet -> rum, mannen -> man
      const lemmas = add === '' && r.pos === 'N' && /(mm|nn)$/.test(lemma0) ? [lemma0, lemma0.slice(0, -1)] : [lemma0];
      for (const lemma of lemmas) {
        if (lemma.length < 2 || lemma === t) continue;
        let keys = r.keys;
        let extra = {};
        if (r.possessive) extra.possessive = true;
        if (r.genus) {
          // "-en": ett-ord -> bestämd plural, annars bestämd singular (genus finns inte i BCI-AV)
          if (NEUTER.has(lemma)) keys = ['plural', 'definite_form'];
          else extra.ambiguous = true;
        }
        if (r.vowelEnd && !/[aeiouyåäö]$/.test(lemma)) continue;
        if (r.nStem) {
          // flickan (stam på -a) = bestämd singular; stam på -e: ett-ord (äpple -> äpplen) = plural,
          // annars en-ord (läraren, pojken) = bestämd singular; fågeln/cykeln (-el/-en/-er) = bestämd singular
          if (/e$/.test(lemma)) keys = NEUTER.has(lemma) ? ['plural'] : ['definite_form'];
          else if (/(el|en|er)$/.test(lemma)) keys = ['definite_form'];
          else if (!/a$/.test(lemma)) continue;
        }
        take(lemma, keys, r.pos, `${r.pos}:-${r.suf}`, r.pri, extra);
      }
    }
  }
  out.sort((a, b) => a.pri - b.pri);
  return out;
}

// ---- kontext: ordet FÖRE avgör verb/substantiv-tvetydigheten ("två cyklar" / "han cyklar") ----
const NOUN_CTX = new Set(('en ett två tre fyra fem sex sju åtta nio tio många några flera alla båda mina dina sina våra era ' +
  'deras dessa min din sin vår mitt ditt sitt stora små nya gamla röda gröna blå gula vita svarta fina snälla några').split(/\s+/));
const VERB_CTX = new Set(('jag du han hon vi ni de man som kan ska vill måste får brukar inte också sedan sen då nu ' +
  'aldrig alltid ofta ibland gärna').split(/\s+/));

/** @returns {'N'|'V'|null} vilken ordklass ordet före gynnar */
function contextPrefers(prev) {
  const p = String(prev || '').toLowerCase().trim();
  if (!p) return null;
  if (NOUN_CTX.has(p)) return 'N';
  if (VERB_CTX.has(p)) return 'V';
  return null;
}

window.BlissLemma = { analyze, contextPrefers, svFormsOf };
})();
