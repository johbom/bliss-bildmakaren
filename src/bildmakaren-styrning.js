/**
 * Bildmakarens styrsätt utöver pekskärm och mus:
 *  - kontakter med scanning: 1 kontakt (knapparna markeras en i taget, tryck när rätt är markerat) eller
 *    2 kontakter (mellanslag/1 = nästa, Enter/2 = välj). Bara knapparna scannas; saker i bilden väljs med "välja".
 *  - ögonstyrning (dwell): titta på en knapp en stund så trycks den. Knappar som flyttar, vrider och ändrar
 *    storlek fortsätter så länge man tittar kvar.
 *  - tangentbord: Tab och Enter som vanligt, piltangenter flyttar, + och − storlek, Delete tar bort,
 *    Ctrl/⌘+Z ångrar, Escape går tillbaka.
 * Allt som kan väljas är <button data-scan data-act> i panelen eller i den öppna dialogen.
 */
(() => {
const B = window.Bildmakaren;
const S = B.SET;

const scope = () => document.querySelector('dialog[open]') || document.getElementById('panel');
const visible = (el) => !el.disabled && el.offsetParent !== null;
const items = () => [...scope().querySelectorAll('[data-scan]')].filter(visible);
const editable = (t) => t && (t.closest?.('textarea, input, select, [contenteditable="true"]'));

// ---------------------------------------------------------------- scanning
// Knapp för knapp, eller rad för rad (först raden, sedan knappen i raden). Med uppläsning på läses den
// markerade knappen (eller radens knappar) upp med enhetens egen röst.
const label = (el) => el.getAttribute('aria-label') || el.textContent.trim();
const talk = (t) => { if (S.speakButtons) B.speak(t); };
const byRow = () => S.scanMode === 'rad';
let timer = null, marked = null, markedRow = null, rowList = null, rowIdx = -1, rowPasses = 0;
function rowsOf(list) {
  const rows = [];
  for (const el of list) {
    const top = Math.round(el.getBoundingClientRect().top);
    let r = rows.find((x) => Math.abs(x.top - top) < 12);
    if (!r) rows.push(r = { top, els: [] });
    r.els.push(el);
  }
  return rows.sort((a, b) => a.top - b.top).map((r) => r.els);
}
function clearMarks() {
  marked?.classList.remove('scan-on');
  markedRow?.forEach((el) => el.classList.remove('scan-row'));
  marked = null; markedRow = null;
}
function mark(el) {
  clearMarks();
  marked = el;
  if (el) { el.classList.add('scan-on'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); talk(label(el)); }
}
function markRow(els) {
  clearMarks();
  markedRow = els;
  els.forEach((el) => el.classList.add('scan-row'));
  els[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  talk(els.map(label).join(', '));
}
function step() {
  const it = items();
  if (!it.length) { clearMarks(); return; }
  if (byRow() && !rowList) {
    const rows = rowsOf(it);
    rowIdx = (rowIdx + 1) % rows.length;
    markRow(rows[rowIdx]);
    return;
  }
  const list = rowList ? rowList.filter((el) => document.contains(el) && visible(el)) : it;
  if (!list.length) { rowList = null; step(); return; }
  let next = (marked ? list.indexOf(marked) : -1) + 1;
  if (next >= list.length) {
    // Två varv i en rad utan val: tillbaka till raderna (samma rad markeras igen härnäst).
    if (rowList && ++rowPasses >= 2) { rowList = null; rowPasses = 0; rowIdx -= 1; step(); return; }
    next = 0;
  }
  mark(list[next]);
}
function activate(el) {
  const act = el.dataset.act, inDialog = !!el.closest('dialog');
  clearMarks(); rowList = null; rowPasses = 0;
  el.click();
  // Efter valet: står samma knapp kvar (t.ex. "upp" när man flyttar) fortsätter man där, annars på
  // sidans förstaval (mitt / ruta 1) eller från början.
  requestAnimationFrame(() => {
    const it = items();
    const same = it.find((x) => x.dataset.act === act && !!x.closest('dialog') === inDialog)
      || it.find((x) => x.hasAttribute('data-first'));
    if (same && byRow()) {
      const rows = rowsOf(it), r = rows.findIndex((x) => x.includes(same));
      rowList = rows[r]; rowIdx = r;
    } else rowIdx = -1;
    mark(same || null);
    restart();
  });
}
function pick() {
  if (byRow() && !rowList) {
    if (!markedRow || !markedRow.every((el) => document.contains(el))) { step(); return; }
    if (markedRow.length === 1) { activate(markedRow[0]); return; }
    rowList = markedRow; rowPasses = 0; clearMarks();
    step(); restart();
    return;
  }
  if (!marked || !document.contains(marked)) { step(); return; }
  activate(marked);
}
function restart() {
  clearInterval(timer); timer = null;
  if (S.scan === 'auto') timer = setInterval(step, S.scanTime);
}
function resetScan() { clearMarks(); rowList = null; rowIdx = -1; rowPasses = 0; }
function setupScan() {
  document.body.classList.toggle('scanning', S.scan !== 'av');
  resetScan();
  if (S.scan === 'av') { clearInterval(timer); timer = null; return; }
  restart();
}

// ---------------------------------------------------------------- ögonstyrning (dwell)
let dwellEl = null, dwellTimer = null, dwellDone = false, lastXY = null;
function stopDwell() {
  clearTimeout(dwellTimer); dwellTimer = null;
  dwellEl?.classList.remove('dwelling');
  dwellEl = null; dwellDone = false;
}
function startDwell(el) {
  dwellEl = el; dwellDone = false;
  el.style.setProperty('--dwell', `${S.dwell}ms`);
  el.classList.remove('dwelling'); void el.offsetWidth;   // starta om ringen
  el.classList.add('dwelling');
  dwellTimer = setTimeout(() => {
    const act = el.dataset.act, repeat = el.hasAttribute('data-repeat');
    el.classList.remove('dwelling');
    el.click();
    requestAnimationFrame(() => {
      // Panelen ritas om: hitta knappen igen under blicken.
      const under = lastXY && document.elementFromPoint(lastXY[0], lastXY[1])?.closest('[data-scan]');
      const again = under && under.dataset.act === act ? under : null;
      dwellEl = again; dwellDone = true;
      if (again && repeat && visible(again)) startDwell(again);
    });
  }, S.dwell);
}
document.addEventListener('pointermove', (e) => {
  if (!S.dwell || e.pointerType === 'touch') return;
  lastXY = [e.clientX, e.clientY];
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-scan]');
  const ok = el && visible(el) && el.closest('dialog[open], #panel') && (!document.querySelector('dialog[open]') || el.closest('dialog'));
  const target = ok ? el : null;
  if (target === dwellEl) return;
  if (dwellEl && target && dwellDone && target.dataset.act === dwellEl.dataset.act) { dwellEl = target; return; }
  stopDwell();
  if (target) { talk(label(target)); startDwell(target); }
}, { passive: true });
document.addEventListener('pointerleave', stopDwell);
window.addEventListener('blur', stopDwell);

// ---------------------------------------------------------------- tangentbord och kontakter
document.addEventListener('keydown', (e) => {
  const inText = editable(e.target);
  if (e.key === 'Escape') {
    if (inText) { e.target.blur(); return; }
    e.preventDefault();
    if (B.dialogOpen()) B.closeDialog(); else if (B.st.page !== 'start' && B.st.page !== 'edit') B.goBack(); else if (B.hasSel()) B.select(null);
    return;
  }
  if (inText) return;
  // Kontakter: mellanslag och Enter (de flesta kontaktboxar), eller 1 och 2.
  const sw = switchKind(e);
  if (sw) {
    e.preventDefault();
    if (e.repeat) return;
    if (S.hold > 0) downAt.set(e.key, Date.now()); else fire(sw);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); B.undo(); return; }
  if (B.dialogOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  const arrows = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (B.hasSel() && arrows[e.key]) { e.preventDefault(); B.move(...arrows[e.key]); return; }
  if (B.hasSel() && (e.key === '+' || e.key === '=')) { e.preventDefault(); B.resize(1.2); return; }
  if (B.hasSel() && (e.key === '-' || e.key === '−')) { e.preventDefault(); B.resize(1 / 1.2); return; }
  if (B.hasSel() && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); B.removeSel(); return; }
}, true);

// Hålltid: med "håll kontakten nere minst …" räknas trycket först när kontakten släpps, och bara om den
// hölls nere tillräckligt länge (ofrivilliga korta tryck räknas inte). Två tryck tätare än 0,25 s blir ett.
const downAt = new Map();
let lastFire = 0;
function switchKind(e) {
  if (S.scan === 'av' || e.ctrlKey || e.metaKey || e.altKey || editable(e.target)) return null;
  const next = e.key === ' ' || e.key === '1', choose = e.key === 'Enter' || e.key === '2';
  if (S.scan === 'auto') return next || choose ? 'pick' : null;
  return next ? 'next' : choose ? 'pick' : null;
}
function fire(kind) {
  const now = Date.now();
  if (now - lastFire < 250) return;
  lastFire = now;
  if (kind === 'next') step(); else pick();
}
document.addEventListener('keyup', (e) => {
  const sw = switchKind(e);
  if (!sw) return;
  e.preventDefault();
  if (!downAt.has(e.key)) return;
  const held = Date.now() - downAt.get(e.key);
  downAt.delete(e.key);
  if (held >= S.hold) fire(sw);
}, true);

// Dialoger som öppnas och stängs: scanningen börjar om i den nya delen.
new MutationObserver(() => {
  if (S.scan === 'av') return;
  if ((marked && !document.contains(marked)) || (markedRow && !markedRow.every((el) => document.contains(el)))) resetScan();
}).observe(document.body, { subtree: true, childList: true });

B.onSettings = () => { setupScan(); stopDwell(); };
setupScan();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearInterval(timer); timer = null; } else setupScan(); });
})();
