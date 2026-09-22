// Punctul de sub cursor: clic pe teren, iar panoul spune unde e și cât de sus.
//
// ─────────────────────────────────────────────────────── cum se află punctul
//
// NU prin `raycaster.intersectObject()` pe plasă. Aceea e neindexată și are 2,75
// milioane de triunghiuri: măsurat, 53 ms pe rază pe desktop. Pe un câmp de
// înălțimi nu e nevoie să testezi triunghiuri — mergi pe rază și compari
// înălțimea ei cu a terenului dedesubt; unde semnul se schimbă, ai trecut prin
// suprafață, apoi bisectezi. Vreo 1400 de căutări biliniare în loc de 2,75
// milioane de teste, adică 0,34 ms, și e MAI exact: pe fiecare celulă suprafața
// testată e chiar interpolarea pe care o citește `inaltimeLa`, nu triunghiurile
// plasei decupate.
//
// ──────────────────────────────────────────── clic față de rotire de cameră
//
// Butonul stâng e al lui OrbitControls (MOUSE.ROTATE, implicitul r186) și NU se
// confiscă: pagina trebuie să rămână o scenă care se rotește, nu o unealtă de
// măsurat. OrbitControls nu cheamă `preventDefault()` la apăsare, deci
// evenimentele native ajung oricum pe canvas. Ce le deosebește e un prag de
// deplasare: peste câțiva pixeli, gestul a fost rotire.
//
// ────────────────────────────────────────────────── ce cifre au acoperire
//
// Coordonatele sunt ÎNTOTDEAUNA adevărate — raza lovește un loc real chiar și pe
// apă. Altitudinea nu. `inaltimeLa` prinde indicii la marginea grilei, deci în
// afara hărții întoarce valoarea nodului de margine cu aceeași convingere ca
// înăuntru, fără să semnaleze nimic. Iar peste mare întoarce umplutura de
// −8 m — sidecarul o numește „artificiu de randare, nu batimetrie".
//
// Deci altitudinea primește etichetă, iar regula nu e aleasă din ochi. Sidecarul
// scrie `regula_apa`: „exact 0.0 m sau NODATA (−999); plaja, care are valori mici
// dar nenule, rămâne uscat". Prin construcție, uscatul măsurat e STRICT POZITIV.
// Orice valoare negativă e fie umplutura, fie interpolarea dintre ea și mal —
// niciuna nu e o cotă.

import * as THREE from 'three';
import { inPoligon } from './terrain.js';

const PAS_MARS = 8;    // metri; sub mărimea unei celule de teren văzută de sus
const BISECTII = 22;   // 8 m / 2²² — mult sub un milimetru
const PRAG_CLIC = 5;   // px între apăsare și ridicare; peste atât, a fost rotire

/**
 * Număr pentru CITIT, în română: virgulă zecimală, fără separator de mii.
 *
 * Gruparea ar face din TM06 „−94.500,55", corect dar greu de citit dintr-o
 * ochire, tocmai unde cifra se schimbă la fiecare clic.
 */
const nr = (v, zec) => v.toLocaleString('ro-RO',
  { minimumFractionDigits: zec, maximumFractionDigits: zec, useGrouping: false });

/**
 * Același număr, dar pentru CLIPBOARD: punct zecimal.
 *
 * Panoul e text românesc și se citește; textul copiat pleacă în altă parte — o
 * foaie de calcul, un script, o hartă — unde virgula zecimală ar fi citită ca
 * despărțitor. Aceleași cifre, alt semn zecimal, și numai atât.
 */
const brut = (v, zec) => v.toFixed(zec);

/**
 * @param {object} o
 * @param {HTMLElement} o.gazda
 * @param {HTMLCanvasElement} o.canvas
 * @param {import('three').PerspectiveCamera} o.camera
 * @param {(x: number, z: number) => number} o.inaltimeLa — cel COMPUS: peticul
 *   de 1 m acolo unde există, baza de 2 m în rest. Diferența măsurată pe cusătură
 *   a fost 0,153 m, deci nu e o alegere cosmetică.
 * @param {object} o.geo — de la creeazaGeo()
 * @param {Array<{x,z}>} [o.limitaDatelor] — `poligon_scena` din sidecar
 * @param {number} [o.zMin] — `zMin_m`, cota umpluturii, pentru explicație
 * @returns {{dispose: () => void, culegeLa: Function}|null}
 */
export function creeazaPunct({ gazda, canvas, camera, inaltimeLa, geo, limitaDatelor, zMin }) {
  // Proba e un apel adevărat, nu o verificare de chei: `laGeo` întoarce null
  // dacă lipsesc `colturi_geo` sau `bbox_tm06`, iar un panou care arată
  // longitudinea „null" e mai rău decât unul care lipsește.
  if (!geo?.laGeo || !geo.laTM06 || !geo.limite || !geo.laGeo(0, 0)) {
    console.warn('punct: harta nu poartă `colturi_geo` și `bbox_tm06`, deci un '
      + 'punct nu se poate exprima în longitudine/latitudine. Panoul nu se arată.');
    return null;
  }

  const lim = geo.limite;
  const raycaster = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const planApa = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const temp = new THREE.Vector3();

  // ------------------------------------------------------------ culegerea

  function razaDinEveniment(ev) {
    const r = canvas.getBoundingClientRect();
    cursor.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    cursor.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(cursor, camera);
  }

  /** Punctul de pe teren de sub cursor, în metri de scenă. */
  function punctSubCursor(ev) {
    razaDinEveniment(ev);
    const raza = raycaster.ray;
    const inHarta = (p) => p.x >= lim.xMin && p.x <= lim.xMax
                        && p.z >= lim.zMin && p.z <= lim.zMax;
    const subTeren = (t) => {
      raza.at(t, temp);
      return inHarta(temp) ? temp.y - inaltimeLa(temp.x, temp.z) : null;
    };

    // Cât de departe are rost să mergem: diagonala hărții plus distanța până la
    // ea. Dincolo, raza a ieșit demult din zonă.
    const diag = Math.hypot(lim.xMax - lim.xMin, lim.zMax - lim.zMin);
    const maxim = raza.origin.length() + diag * 1.5;

    let tAnterior = null, semnAnterior = null;
    for (let t = 0; t <= maxim; t += PAS_MARS) {
      const d = subTeren(t);
      // Pașii din afara hărții rup lanțul, ca reintrarea în ea să nu producă o
      // falsă traversare.
      if (d === null) { tAnterior = null; semnAnterior = null; continue; }
      if (semnAnterior !== null && semnAnterior > 0 && d <= 0) {
        let a = tAnterior, b = t;
        for (let i = 0; i < BISECTII; i++) {
          const m = (a + b) / 2;
          const dm = subTeren(m);
          if (dm === null || dm > 0) a = m; else b = m;
        }
        raza.at((a + b) / 2, temp);
        return { x: temp.x, z: temp.z };
      }
      tAnterior = t; semnAnterior = d;
    }

    // Dincolo de uscat, raza cade pe planul apei — ca să se poată arăta și marea.
    if (raza.intersectPlane(planApa, temp)) return { x: temp.x, z: temp.z };
    return null;
  }

  /** Ce se poate spune despre altitudinea într-un punct. Ordinea contează. */
  function altitudineaLa(x, z) {
    if (limitaDatelor && !inPoligon(x, z, limitaDatelor))
      return { h: null, eticheta: 'în afara hărții' };
    const h = inaltimeLa(x, z);
    if (!(h > 0)) return { h: null, eticheta: 'apă' };
    return { h, eticheta: null };
  }

  // ----------------------------------------------------------------- panoul

  const radacina = document.createElement('div');
  radacina.id = 'punct';
  // Numai literaluri. Cifrele se scriu mai jos cu textContent.
  radacina.innerHTML =
    '<div class="cutie">'
    + '<p class="indemn">Dă clic pe teren ca să afli unde e punctul.</p>'
    + '<dl class="mari" hidden>'
    + '<dt>altitudine</dt><dd class="alt"></dd>'
    + '<dt>longitudine</dt><dd class="lon"></dd>'
    + '<dt>latitudine</dt><dd class="lat"></dd>'
    + '</dl>'
    + '<dl class="mici" hidden>'
    + '<dt>scenă (m)</dt><dd class="sc"></dd>'
    + '<dt>TM06 (m)</dt><dd class="tm"></dd>'
    + '</dl>'
    + '<button class="copiaza" type="button" hidden>Copiază</button>'
    + '<span class="anunt" role="status" aria-live="polite"></span>'
    + '</div>';

  const indemn = radacina.querySelector('.indemn');
  const dlMari = radacina.querySelector('.mari');
  const dlMici = radacina.querySelector('.mici');
  const buton = radacina.querySelector('.copiaza');
  const anunt = radacina.querySelector('.anunt');
  const camp = {
    alt: radacina.querySelector('.alt'),
    lon: radacina.querySelector('.lon'),
    lat: radacina.querySelector('.lat'),
    sc: radacina.querySelector('.sc'),
    tm: radacina.querySelector('.tm'),
  };

  if (Number.isFinite(zMin)) {
    camp.alt.title = `Apa e codată la ${nr(zMin, 0)} m în hartă — artificiu de `
      + 'randare, nu batimetrie. De aceea peste mare scrie „apă", nu o cifră.';
  }

  gazda.appendChild(radacina);

  let viu = true;
  let ales = null;      // ultimul punct cules, gata de copiat
  let cronoCopiere = 0;

  function arata(p) {
    const { h, eticheta } = altitudineaLa(p.x, p.z);
    const g = geo.laGeo(p.x, p.z);
    const t = geo.laTM06(p.x, p.z);

    // `Y` din scenă E altitudinea, deci primește exact același tratament: dacă
    // nu e o cotă, nu se scrie o cifră nicăieri. Unitatea stă în etichetă, ca
    // cele trei axe să se alinieze la fel de late.
    const y = h === null ? '—' : nr(h, 2);

    camp.alt.textContent = h === null ? eticheta : `${nr(h, 2)} m`;
    camp.alt.classList.toggle('fara', h === null);
    camp.lon.textContent = nr(g.lon, 6);
    camp.lat.textContent = nr(g.lat, 6);
    camp.sc.textContent = `X ${nr(p.x, 2)}  Y ${y}  Z ${nr(p.z, 2)}`;
    camp.tm.textContent = `X ${nr(t.x, 2)}  Y ${nr(t.y, 2)}`;

    indemn.hidden = true;
    dlMari.hidden = false;
    dlMici.hidden = false;
    buton.hidden = false;

    ales = { p, h, eticheta, g, t };
    anunt.textContent = h === null
      ? `Punct la longitudinea ${nr(g.lon, 6)}, latitudinea ${nr(g.lat, 6)}. Altitudine: ${eticheta}.`
      : `Punct la longitudinea ${nr(g.lon, 6)}, latitudinea ${nr(g.lat, 6)}, altitudinea ${nr(h, 2)} metri.`;
  }

  /** Blocul de copiat. Aceleași cifre ca în panou, cu punct zecimal. */
  function textDeCopiat() {
    if (!ales) return '';
    const { p, h, eticheta, g, t } = ales;
    return [
      'Cabo Espichel — punct ales',
      `longitudine  ${brut(g.lon, 6)}`,
      `latitudine   ${brut(g.lat, 6)}`,
      `altitudine   ${h === null ? eticheta : `${brut(h, 2)} m`}`,
      `scenă        X ${brut(p.x, 2)} m   Y ${h === null ? '—' : `${brut(h, 2)} m`}   Z ${brut(p.z, 2)} m`,
      `TM06         X ${brut(t.x, 2)} m   Y ${brut(t.y, 2)} m   (EPSG:3763)`,
    ].join('\n');
  }

  async function laCopiere() {
    const text = textDeCopiat();
    if (!text) return;
    clearTimeout(cronoCopiere);
    try {
      await navigator.clipboard.writeText(text);
      buton.textContent = 'Copiat';
      anunt.textContent = 'Coordonatele au fost copiate.';
      cronoCopiere = setTimeout(() => { buton.textContent = 'Copiază'; }, 1400);
    } catch {
      // Fără permisiune de clipboard, sau în afara unui context securizat.
      // Selectăm cifrele, ca să se poată copia cu tastatura: o unealtă care tace
      // când nu reușește e mai rea decât una care spune ce s-a întâmplat.
      const sel = globalThis.getSelection?.();
      if (sel) {
        const r = document.createRange();
        r.setStartBefore(dlMari);
        r.setEndAfter(dlMici);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      buton.textContent = 'Selectat';
      anunt.textContent = 'Nu am putut copia singur. Cifrele sunt selectate — apasă Ctrl+C.';
      cronoCopiere = setTimeout(() => { buton.textContent = 'Copiază'; }, 2400);
    }
  }

  // ------------------------------------------------------------ ascultătorii

  let apasat = null;

  const laApasare = (ev) => {
    // Pe atingere `button` e tot 0, deci un tap trece pe aceeași cale.
    if (ev.button !== 0) return;
    apasat = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  };

  const laRidicare = (ev) => {
    if (!apasat || ev.pointerId !== apasat.id) return;
    const dist = Math.hypot(ev.clientX - apasat.x, ev.clientY - apasat.y);
    apasat = null;
    if (dist > PRAG_CLIC) return;   // a fost rotire de cameră, nu clic
    const p = punctSubCursor(ev);
    if (p) arata(p);
  };

  const laAnulare = () => { apasat = null; };

  canvas.addEventListener('pointerdown', laApasare);
  // Ridicarea se ascultă pe fereastră, nu pe canvas: OrbitControls mută
  // `pointermove`/`pointerup` pe `ownerDocument` cât ține tragerea, iar o tragere
  // care iese din canvas și se termină afară n-ar mai declanșa niciodată
  // ridicarea pe el. `apasat` ar rămâne agățat, și primul clic de după ar fi
  // măsurat din locul greșit.
  globalThis.addEventListener('pointerup', laRidicare);
  globalThis.addEventListener('pointercancel', laAnulare);
  buton.addEventListener('click', laCopiere);

  return {
    /** Pentru verificare din consolă: culege fără eveniment de pointer. */
    culegeLa: (clientX, clientY) => {
      const p = punctSubCursor({ clientX, clientY });
      if (p) arata(p);
      return p;
    },
    dispose() {
      if (!viu) return;
      viu = false;
      canvas.removeEventListener('pointerdown', laApasare);
      globalThis.removeEventListener('pointerup', laRidicare);
      globalThis.removeEventListener('pointercancel', laAnulare);
      buton.removeEventListener('click', laCopiere);
      clearTimeout(cronoCopiere);
      apasat = null;
      ales = null;
      radacina.remove();
    },
  };
}
