// Harta de la tastatură, ca o dronă, la cererea autorului (2026-10-09):
//
//   săgețile, W A S D   mută harta; ↑ și W duc înainte, pe direcția privirii
//   Q, E                rotesc privirea cu 15°, în jurul centrului; E crește citirea busolei
//   Shift               urcă: camera se ridică pe verticală, privirea rămâne
//   Ctrl                coboară, până deasupra terenului
//   + și − (= și _)     apropie, depărtează: o treaptă de rotiță, spre centrul vederii
//   Home                acasă, la vederea de pornire
//
// Pașii îi face `controale.comanda()` (camera.js), cu limitele obișnuite; aici se hotărăște
// numai CE tastă, UNDE și CÂT. Tastele se recunosc după poziție (`code`), nu după literă:
// pe AZERTY, W A S D sunt Z Q S D, sub aceleași degete. Plusul și minusul, după semn (`key`).
// Butoanele hărții de la lotul E au plecat la cererea autorului: harta rămâne pe tastatură,
// pe mouse și pe degete.
//
// ─────────────────────────────────────────────────────────────────────── unde
//
// Tastele rămân ale locului în care au alt rost: un câmp, fișa sau panoul care defilează,
// textul capitolelor, o modală deschisă (UNDE_NU). „Locul” e elementul cu focus; când
// focusul e pe <body> — după un clic pe text care nu ia focus, un rând din fișă —, locul
// ultimei apăsări. Altfel Home ar fi închis fișa în loc s-o ducă sus.
//
// Home merge de oriunde altundeva. Celelalte numai pe hartă: cu focusul pe canvas, sau pe
// <body> după o apăsare pe hartă — ori înaintea oricărei apăsări. Un buton sau un link își
// păstrează săgețile. Fără Alt și Cmd (Alt + ← e „înapoi”). Cu Ctrl ținut, mutarea și
// rotirea merg mai departe, cu coborârea, dar plusul și minusul rămân ale paginii: Ctrl +
// plus o mărește. Ctrl + W închide fila în toate browserele, iar pagina nu-l poate opri:
// autorul a ales așa. Pe macOS, Ctrl + săgeți mută desktopurile; acolo, cu W A S D. Cu
// pagina mărită cu degetele controalele sunt oprite (camera.js), iar tastele rămân ale ei.
//
// ─────────────────────────────────────────────────────────────────────── cât
//
// O apăsare face un pas. Ținută, tasta face câte unul la INTERVAL_REPETARE ms, numărați de
// bucla scenei (`pas()`), nu de repetarea sistemului: aceea vine abia după ~0,5 s, iar pe
// macOS Shift și Ctrl nu se repetă deloc. Pașii alunecă (amortizarea, camera.js), deci
// ținută, harta curge. Repetările sistemului se ignoră. Ridicarea oprește pașii; un `blur`,
// o filă ascunsă sau focusul plecat de pe hartă îi opresc pe toți.
//
// Shift și Ctrl sunt și taste de modificare: Shift + Tab, Shift + = („+”), Ctrl + F,
// Ctrl + plus, Shift sau Ctrl cu mouse-ul (rotire, zoom). De aceea urcarea și coborârea
// pornesc abia după GRATIE ms ținute, iar o altă tastă apăsată între timp — oricare în
// afară de mutare și rotire —, un clic sau rotița le anulează până la ridicare. Venită după
// GRATIE, anularea oprește și urcarea care încă alunecă: camera rămâne unde a ajuns (Shift
// ținut 300 ms, apoi Tab, urca 27 m, recenzia). Apăsate scurt nu fac nimic: NVDA oprește
// vorbirea cu Ctrl, iar un Shift apăsat înaintea unei litere n-are de ce să mute harta.
// Shift și Ctrl ținute deodată nu fac nimic.
//
// ──────────────────────────────────────────────────────────────────── canvasul
//
// Canvasul devine elementul hărții: se ajunge la el cu Tab, are nume și descrierea
// tastelor, iar `role="application"` le spune cititoarelor de ecran să-i lase tastele.
// Inelul de focus e un element separat (`.inel-harta`, main.css): conturul obișnuit, pus
// în afara canvasului de pe tot ecranul, n-ar avea unde să se vadă. Toate se pun la creare
// și se scot la `dispose()`; scena.js o creează abia cu harta gata de primul cadru, ca o
// tastă apăsată cât se încarcă să nu mute camera nevăzut.

export const UNDE_NU = 'input, textarea, select, [contenteditable], dialog[open], #sanctuar-fisa, #punct .cutie, #continut';
export const INTERVAL_REPETARE = 150; // ms între doi pași ai unei taste ținute
export const GRATIE = 250;            // ms ținute înainte ca Shift sau Ctrl să urce sau să coboare
export const DESCRIERE_TASTE = 'Săgețile sau W, A, S, D mută harta, iar Q și E o rotesc. '
  + 'Shift urcă, Ctrl coboară. Plus și minus o apropie și o depărtează. '
  + 'Home o aduce la vederea de pornire.';

// Mutarea și rotirea, după poziția tastei: merg și cu Shift sau Ctrl ținute.
export const MISCARI = Object.freeze({
  ArrowUp: 'sus', KeyW: 'sus',
  ArrowDown: 'jos', KeyS: 'jos',
  ArrowLeft: 'stanga', KeyA: 'stanga',
  ArrowRight: 'dreapta', KeyD: 'dreapta',
  KeyQ: 'roteste-stanga', KeyE: 'roteste-dreapta',
});
export const VERTICALE = Object.freeze({
  ShiftLeft: 'urca', ShiftRight: 'urca', ControlLeft: 'coboara', ControlRight: 'coboara',
});

const ATRIBUTE = {
  tabindex: '0',
  role: 'application',
  'aria-roledescription': 'hartă',
  'aria-label': 'Harta 3D a promontoriului Cabo Espichel',
  'aria-describedby': 'harta-taste',
};

/**
 * Comanda hărții (camera.js, `comanda`) pentru o tastă, sau null: mutarea și rotirea după
 * `code`, oricum ar fi Shift sau Ctrl; zoomul după `key`, fără Ctrl. Fără Alt sau Cmd, nimic.
 * Shift și Ctrl singure nu sunt aici: le hotărăște `creeazaTastatura`, cu grația lor.
 * @param {{code?: string, key: string, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean}} e
 */
export function comandaTastei(e) {
  if (e.altKey || e.metaKey) return null;
  if (MISCARI[e.code]) return MISCARI[e.code];
  if (e.ctrlKey) return null;
  switch (e.key) {
    case '+': case '=': return 'apropie';
    case '-': case '_': return 'departeaza';
    default: return null;
  }
}

/**
 * @param {{canvas: HTMLCanvasElement, controale: {comanda: (n: string) => boolean, enabled: boolean},
 *          acasa?: () => void, doc?: Document, ceas?: () => number}} o
 * @returns {{pas: () => void, readonly tinute: string[], dispose: () => void}}
 */
export function creeazaTastatura({ canvas, controale, acasa, doc = globalThis.document, ceas = () => performance.now() }) {
  const vechi = Object.fromEntries(Object.keys(ATRIBUTE).map((k) => [k, canvas.getAttribute(k)]));
  for (const [k, v] of Object.entries(ATRIBUTE)) canvas.setAttribute(k, v);
  const inel = doc.createElement('div');
  inel.className = 'inel-harta';
  inel.setAttribute('aria-hidden', 'true');
  const descriere = doc.createElement('p');
  descriere.id = ATRIBUTE['aria-describedby'];
  descriere.textContent = DESCRIERE_TASTE;
  canvas.after(inel, descriere);

  // Tastele ținute, după `code`: comanda, când e următorul pas, dacă e Shift sau Ctrl și,
  // pentru ele, dacă au fost anulate ori au apucat să pășească.
  /** @type {Map<string, {nume: string, urmatorul: number, vertical: boolean, anulat: boolean, pornit: boolean}>} */
  const tinute = new Map();
  let ultimaApasare = null;

  const peHarta = (tinta) => {
    const pePagina = !tinta || tinta === doc.body || tinta === doc.documentElement;
    const unde = pePagina ? ultimaApasare : tinta;
    return unde === canvas || (pePagina && unde === null);
  };
  const anuleazaVerticale = () => {
    let pornit = false;
    for (const h of tinute.values()) {
      if (!h.vertical || h.anulat) continue;
      h.anulat = true;
      if (h.pornit) pornit = true;
    }
    if (pornit) controale.opresteUrcarea?.();
  };
  const golesteTot = () => tinute.clear();
  const pasul = (nume) => controale.comanda(nume);

  const laApasare = (e) => { ultimaApasare = e.target; anuleazaVerticale(); };
  const laRotita = () => anuleazaVerticale();
  const laTasta = (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const pePagina = e.target === doc.body || e.target === doc.documentElement;
    const unde = pePagina ? ultimaApasare : e.target;
    if (unde?.closest?.(UNDE_NU)) return;
    // O tastă deja ținută: repetarea sistemului. Pașii îi numără bucla; săgeata nu defilează.
    if (tinute.has(e.code)) {
      if (!VERTICALE[e.code]) e.preventDefault();
      return;
    }
    const vertical = VERTICALE[e.code];
    if (vertical) {
      if (e.repeat || e.altKey || e.metaKey || !controale.enabled || !peHarta(e.target)) return;
      // Shift și Ctrl deodată: o combinație a browserului, nu o dronă.
      const celalalt = [...tinute.values()].some((h) => h.vertical);
      anuleazaVerticale();
      tinute.set(e.code, { nume: vertical, urmatorul: ceas() + GRATIE, vertical: true, anulat: celalalt, pornit: false });
      return;
    }
    const nume = comandaTastei(e);
    // Orice altă tastă decât mutarea și rotirea: Shift sau Ctrl erau taste de modificare.
    if (!MISCARI[e.code]) anuleazaVerticale();
    if (e.key === 'Home') {
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      if (!e.repeat) acasa?.();
      return;
    }
    if (!nume || !peHarta(e.target) || !controale.enabled) return;
    e.preventDefault();
    // O tastă ținută de dinainte — de la încărcare, sau de pe alt element — nu pornește nimic.
    if (e.repeat) return;
    tinute.set(e.code, { nume, urmatorul: ceas() + INTERVAL_REPETARE, vertical: false, anulat: false, pornit: true });
    pasul(nume);
  };
  const laRidicare = (e) => { tinute.delete(e.code); };
  const laAscundere = () => { if (doc.visibilityState === 'hidden') golesteTot(); };

  doc.addEventListener('pointerdown', laApasare, true);
  doc.addEventListener('wheel', laRotita, { capture: true, passive: true });
  doc.addEventListener('keydown', laTasta);
  doc.addEventListener('keyup', laRidicare);
  doc.addEventListener('visibilitychange', laAscundere);
  globalThis.addEventListener?.('blur', golesteTot);

  let viu = true;
  return {
    /** Din bucla scenei, la fiecare cadru: pașii tastelor ținute. */
    pas() {
      if (!tinute.size) return;
      if (!controale.enabled || !peHarta(doc.activeElement)) { golesteTot(); return; }
      const acum = ceas();
      for (const h of tinute.values()) {
        if (h.anulat || acum < h.urmatorul) continue;
        // Pe ceasul tastei, nu de la cadrul în care a căzut pasul: altfel fiecare ar întârzia
        // cu până la un cadru. După o pauză lungă — o filă înghețată —, de la capăt, fără rafală.
        h.pornit = true;
        h.urmatorul = acum - h.urmatorul < INTERVAL_REPETARE ? h.urmatorul + INTERVAL_REPETARE : acum + INTERVAL_REPETARE;
        pasul(h.nume);
      }
    },
    get tinute() { return [...tinute.keys()]; },
    dispose() {
      if (!viu) return;
      viu = false;
      doc.removeEventListener('pointerdown', laApasare, true);
      doc.removeEventListener('wheel', laRotita, { capture: true });
      doc.removeEventListener('keydown', laTasta);
      doc.removeEventListener('keyup', laRidicare);
      doc.removeEventListener('visibilitychange', laAscundere);
      globalThis.removeEventListener?.('blur', golesteTot);
      for (const [k, v] of Object.entries(vechi)) { if (v === null) canvas.removeAttribute(k); else canvas.setAttribute(k, v); }
      inel.remove();
      descriere.remove();
      tinute.clear();
      ultimaApasare = null;
    },
  };
}
