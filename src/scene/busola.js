// Busola: o rozetă fixă în colțul paginii, cu acul spre nordul ADEVĂRAT.
//
// Trei lucruri face: arată unde e nordul, spune în cifre dinspre ce direcție
// privești, și la clic cere scenei să te ducă acasă — la vederea de pornire.
// Zborul acela e al lui zbor.js; busola doar îl pornește, prin `acasa()` din scenă.
//
// ─────────────────────────────────────────────────────────────────── nordul
//
// Scena e așezată pe grila TM06: `+X` e estul grilei, `−Z` e nordul GRILEI.
// Nordul adevărat nu e același lucru. Meridianele converg spre pol, iar zona
// asta stă la ~95 km VEST de meridianul central al proiecției (−8,133108°),
// deci meridianul locului e înclinat față de liniile grilei. Unghiul e
// convergența meridianelor, γ, și valorează aici −0,6737°: nordul adevărat cade
// cu 0,67° la EST de nordul grilei.
//
// Pe o rozetă cu acul de 42 px asta face 0,47 px — sub o jumătate de pixel.
// Deci NU se vede, și tocmai de aceea nu se poate lăsa pe seama ochiului: se
// verifică din cifră: la vederea de pornire, 306 și 307 sunt doi întregi diferiți.
//
// γ nu e scris ca o constantă. Se calculează din `colturi_geo` al hărții de
// BAZĂ, deci o hartă nouă, cu alt contur, își aduce propriul γ. Fără cheia
// aceea, busola nu se creează deloc — mai bine lipsește decât să arate cu
// convingere un nord care nu e nordul.
//
// ──────────────────────────────────────────────────────────── unghiuri, semne
//
// `OrbitControls.getAzimuthalAngle()` întoarce `Spherical.theta` al vectorului
// de la țintă la cameră, iar `Spherical` folosește `theta = atan2(x, z)`. Deci
// theta = 0 înseamnă offsetul spre `+Z`: camera la SUD, privind spre NORD.
//
//   unghiul acului pe ecran    = theta + azimutNordAdevarat   (orar, de la „sus")
//   azimutul POZIȚIEI camerei  = 180 − unghiul acului          ← cifra afișată
//   „nordul în sus"            = theta = γ,  NU theta = 0
//
// Ultima e cea care se ratează cel mai ușor. `theta = 0` pune în sus nordul
// GRILEI, alături cu 0,67°.

const GRADE = 180 / Math.PI;
const RADIANI = Math.PI / 180;

// GRS80 — elipsoidul lui ETRS89, deci al lui TM06. Aceleași numere ca în
// scripts/comun/tm06.mjs; acela e cod de build și nu se încarcă în pagină.
const A_GRS80 = 6378137;
const F_GRS80 = 1 / 298.257222101;
const E2_GRS80 = F_GRS80 * (2 - F_GRS80);

const PUNCTE = ['N', 'NE', 'E', 'SE', 'S', 'SV', 'V', 'NV'];
const NUME_PUNCTE = ['nord', 'nord-est', 'est', 'sud-est',
                     'sud', 'sud-vest', 'vest', 'nord-vest'];

/**
 * Cât valorează un grad de longitudine față de unul de latitudine, pe elipsoid.
 *
 * NU `cos(φ)`. Un grad de latitudine măsoară M(φ) metri, unul de longitudine
 * măsoară cos(φ)·N(φ), iar N și M diferă: raportul lor, 1 + e′²cos²φ, e 1,004137
 * la 38,42°. Cu `cos(φ)` singur convergența iese sistematic mai mică cu 0,414% —
 * −0,670929° în loc de −0,673704°. Diferența e sub pragul vizibil, dar e greșită
 * fără să fie nevoie, și strică singura verificare independentă pe care o avem.
 */
function factorLongitudine(latGrade) {
  const s = Math.sin(latGrade * RADIANI);
  const w = 1 - E2_GRS80 * s * s;
  const N = A_GRS80 / Math.sqrt(w);
  const M = (A_GRS80 * (1 - E2_GRS80)) / (w * Math.sqrt(w));
  return Math.cos(latGrade * RADIANI) * (N / M);
}

/** Azimutul adevărat al unei muchii verticale a cutiei — adică al nordului grilei. */
function azimutMuchie(jos, sus) {
  const latMediu = (jos.lat + sus.lat) / 2;
  const dLon = (sus.lon - jos.lon) * factorLongitudine(latMediu);
  return Math.atan2(dLon, sus.lat - jos.lat) * GRADE;
}

/**
 * Convergența meridianelor, γ, dedusă din colțurile geografice ale hărții.
 *
 * Media celor două muchii verticale, nu una singură: γ crește cu longitudinea,
 * iar media marginilor dă valoarea de la mijlocul hărții — exact unde stă
 * originea scenei. Pe harta asta muchiile dau −0,682084° și −0,665325°.
 *
 * Verificare independentă, din parametrii proiecției, nu din aceeași formulă:
 * γ = atan(tan(λ−λ₀)·sin φ) cu λ₀ = −8,133108333° dă −0,673397°. Cele 0,0003°
 * rămase sunt rotunjirea colțurilor la șase zecimale în sidecar, adică ~0,1 m pe
 * o muchie de 2986 m.
 *
 * @returns {number|null} γ în grade, sau null dacă datele nu susțin un răspuns.
 */
export function convergentaDinColturi(colturi) {
  if (!colturi) return null;
  for (const cheie of ['nv', 'ne', 'sv', 'se']) {
    const p = colturi[cheie];
    if (!p || !Number.isFinite(p.lon) || !Number.isFinite(p.lat)) return null;
  }
  // Nordul trebuie să fie la nord. Un sidecar cu colțurile încurcate ar da un γ
  // de ~180°, iar busola ar arăta fix pe dos — greșeala care se vede cel mai greu.
  if (!(colturi.nv.lat > colturi.sv.lat)) return null;
  if (!(colturi.ne.lat > colturi.se.lat)) return null;

  const gamma = (azimutMuchie(colturi.sv, colturi.nv)
               + azimutMuchie(colturi.se, colturi.ne)) / 2;
  // TM06 acoperă Portugalia continentală, unde |γ| nu trece de ~2°. Peste 5°
  // înseamnă altă proiecție sau alte date, nu o busolă mai interesantă.
  if (!Number.isFinite(gamma) || Math.abs(gamma) > 5) return null;
  return gamma;
}

/** Unghi adus în [0, 360). */
const normalizeaza = (g) => ((g % 360) + 360) % 360;

/** „1 grad", „19 grade", „20 de grade" — regula lui „de" din română. */
function grade(n) {
  if (n === 1) return '1 grad';
  const r = n % 100;
  return (n !== 0 && (r === 0 || r >= 20)) ? `${n} de grade` : `${n} grade`;
}

// Rozeta. viewBox centrat pe origine, ca rotirile să nu ceară centru explicit.
// Literele stau la raza 38 și se contra-rotesc în jurul propriei ancore, ca să
// rămână drepte oricât s-ar învârti cadranul: un „S" cu capul în jos la o
// privire dinspre nord ar fi exact opusul lizibilității cerute de proiect.
const ROZETA = `
<svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
  <circle class="disc" cx="0" cy="0" r="47"/>
  <g class="cadran">
    <polygon class="ac-nord" points="0,-33 7.5,4 -7.5,4"/>
    <polygon class="ac-sud"  points="0,33 7.5,-4 -7.5,-4"/>
    <circle class="pivot" cx="0" cy="0" r="3.4"/>
    <text class="eticheta nord" x="0" y="-38">N</text>
    <text class="eticheta"      x="38" y="0">E</text>
    <text class="eticheta"      x="0" y="38">S</text>
    <text class="eticheta"      x="-38" y="0">V</text>
  </g>
</svg>`;

/**
 * @param {object} o
 * @param {HTMLElement} o.gazda — unde se agață elementul
 * @param {object} o.controale — OrbitControls; de la ele vine unghiul și `change`
 * @param {object} [o.colturi] — `colturi_geo` din sidecarul hărții de BAZĂ
 * @param {() => void} [o.laClic] — clicul pe rozetă; scena te duce atunci acasă,
 *   la vederea de pornire
 * @returns {{dispose, convergenta, azimutNordAdevarat}|null}
 *   null dacă nordul adevărat nu se poate afla din date.
 */
export function creeazaBusola({ gazda, controale, colturi, laClic }) {
  const gamma = convergentaDinColturi(colturi);
  if (gamma === null) {
    console.warn('busolă: `colturi_geo` lipsește din sidecarul hărții de bază sau '
      + 'nu e folosibil, deci nordul adevărat nu se poate deduce. Busola nu se '
      + 'arată — la Cabo Espichel nordul grilei e alături cu 0,67°, iar o rozetă '
      + 'greșită cu atât nu se deosebește de una bună la nicio privire.');
    return null;
  }
  // γ e rotația grilei față de nordul adevărat; nordul adevărat față de grilă e
  // exact minus ea. Semnul ăsta e jumătate din tot modulul.
  const azimutNordAdevarat = -gamma;

  const radacina = document.createElement('div');
  radacina.id = 'busola';
  // Numai literaluri în innerHTML. Ce vine din măsurători — cifra, anunțul — se
  // scrie mai jos cu textContent.
  radacina.innerHTML =
    `<button class="roza" type="button">${ROZETA}</button>`
    + '<span class="citire" aria-hidden="true"></span>'
    + '<span class="anunt" role="status" aria-live="polite"></span>';

  const buton = radacina.querySelector('.roza');
  const cadran = radacina.querySelector('.cadran');
  const citire = radacina.querySelector('.citire');
  const anunt = radacina.querySelector('.anunt');
  const etichete = [...radacina.querySelectorAll('.eticheta')]
    .map((el) => [el, el.getAttribute('x'), el.getAttribute('y')]);

  // Eticheta spune ce face clicul. Se pune cu setAttribute, ca innerHTML de mai
  // sus să rămână numai literaluri.
  buton.setAttribute('aria-label', 'Acasă — vederea de pornire');
  buton.setAttribute('title',
    'Dinspre ce direcție privești, față de nordul adevărat.'
    + ' Apasă (sau tasta Home) ca să revii acasă, la vederea de pornire.');

  gazda.appendChild(radacina);

  let viu = true;
  let cronometru = 0;
  let ultimulUnghi = NaN;

  /** Unghiul acului pe ecran, în grade, sens orar de la „sus". */
  const unghiAc = () => controale.getAzimuthalAngle() * GRADE + azimutNordAdevarat;

  /** Azimutul adevărat al POZIȚIEI camerei: dinspre ce direcție privești. */
  const azimutCamerei = () => normalizeaza(180 - unghiAc());

  function deseneaza() {
    const u = unghiAc();
    // Sub o zecime de grad nu se mișcă nici o zecime de pixel pe rozetă.
    if (Math.abs(u - ultimulUnghi) < 0.1) return;
    ultimulUnghi = u;

    cadran.setAttribute('transform', `rotate(${u.toFixed(2)})`);
    // Contra-rotire în jurul ancorei NEROTITE a fiecărei litere: compunerea
    // rotate(u, O) ∘ rotate(−u, L) duce L exact unde trebuie, cu partea liniară
    // identitate. Deci litera ajunge la locul ei și rămâne dreaptă.
    const invers = (-u).toFixed(2);
    for (const [el, x, y] of etichete)
      el.setAttribute('transform', `rotate(${invers} ${x} ${y})`);

    const a = azimutCamerei();
    citire.textContent = `${Math.round(a) % 360}° ${PUNCTE[Math.round(a / 45) % 8]}`;
  }

  function programeazaAnunt() {
    // Cititoarele de ecran n-au de ce să turuie la fiecare cadru de amortizare.
    // Un singur anunț, după ce camera s-a liniștit — și numai dacă direcția s-a schimbat:
    // o mutare sau un zoom fără rotire scriau aceeași propoziție din nou, 10 din 10 (recenzia),
    // iar cu săgețile ar fi repetat-o după fiecare apăsare. Comparația stă aici, nu în
    // `laSchimbare`: o rotire întoarsă la același grad în timpul gestului tot programează
    // cronometrul. `reanunta()` golește întâi regiunea, deci acolo textul se scrie din nou.
    clearTimeout(cronometru);
    cronometru = setTimeout(() => {
      const a = azimutCamerei();
      const text = `Privești dinspre ${NUME_PUNCTE[Math.round(a / 45) % 8]}, `
        + `${grade(Math.round(a) % 360)}.`;
      if (anunt.textContent !== text) anunt.textContent = text;
    }, 600);
  }

  const laSchimbare = () => { deseneaza(); programeazaAnunt(); };
  const laApasare = () => laClic?.();

  controale.addEventListener('change', laSchimbare);
  buton.addEventListener('click', laApasare);

  deseneaza();
  programeazaAnunt();

  return {
    /** Azimutul în grilă al nordului adevărat, în grade. Expus pentru verificare. */
    azimutNordAdevarat,
    /** γ, dedus din date. Expus pentru verificare. */
    convergenta: gamma,
    /**
     * Harta a apărut (scena.js, `arata`). Primul anunț s-a scris cât busola era ascunsă până la
     * `data-scena` (main.css), deci nu l-a auzit nimeni: se scrie din nou, după aceeași pauză.
     */
    reanunta() {
      if (!viu) return;
      anunt.textContent = '';
      programeazaAnunt();
    },
    dispose() {
      if (!viu) return;
      viu = false;
      controale.removeEventListener('change', laSchimbare);
      buton.removeEventListener('click', laApasare);
      clearTimeout(cronometru);
      radacina.remove();
    },
  };
}
