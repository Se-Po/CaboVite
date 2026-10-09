// Punctul de sub cursor: clic pe teren, iar panoul spune unde e și cât de sus.
//
// ─────────────────────────────────────────────────────── cum se află punctul
//
// NU prin `raycaster.intersectObject()` pe plasă, ci mergând pe rază peste câmpul
// de înălțimi (`marsPeTeren`, în raza.js, cu motivele și cifrele ei).
//
// Punctul e ce SE VEDE sub cursor, ca la zoomul rotiței și la apucarea hărții
// (`punctVazut`): relieful, suprafața mării la `COTA_MARE` sau o clădire. Pe apă
// relieful e umplutura de −8 m, iar raza care mergea numai pe relief trecea de
// suprafață și se oprea pe ea: din vederea de pornire, punctul de pe mare ieșea
// mutat de-a lungul razei cu mediana 13,5 m, până la 34,5 m.
//
// ──────────────────────────────────────────── clic față de mutarea hărții
//
// Butonul stâng e al controalelor — mută harta, ca la o hartă (camera.js) — și NU
// se confiscă: pagina trebuie să rămână o hartă care se mișcă, nu o unealtă de
// măsurat. Controalele nu cheamă `preventDefault()` la apăsare, deci evenimentele
// native ajung oricum pe canvas. Ce le deosebește e un prag de deplasare: peste
// câțiva pixeli, gestul a fost o mutare. Pe telefon la fel, cu un deget; al doilea
// deget anulează clicul — două degete înseamnă zoom sau rotire.
//
// ───────────────────────────────────────────────────────────── minimizat
//
// Panoul pornește minimizat: în dreapta-jos se vede numai butonul „Coordonate”,
// iar clicul pe scenă nu culege nimic — nicio rază, niciun rând scris. Activat,
// face tot ce e descris aici; minimizat din nou, se suspendă, dar ține ultimul
// punct. Mișcarea camerei nu depinde de el: e a controalelor în ambele stări.
// Fără mouse, butonul „Măsoară centrul” culege, la fel, punctul din centrul vederii.
// Escape îl minimizează, după fișa sanctuarului, dacă e deschisă.
//
// ─────────────────────────────────────────────── semnul și imaginea mutată
//
// Punctul cules are pe hartă un semn — crucea de vizare a butonului „Coordonate” —, cât
// panoul e deschis: se proiectează pe cadrul care se desenează, ca eticheta, iar când
// relieful sau o clădire îl acoperă se face punctat. Pe telefon cutia deschisă stă jos,
// peste mijlocul ecranului: centrul vederii, de unde culege „Măsoară centrul”, cădea sub
// ea, cu punctul cu tot (recenzia: 320 × 568, 640 × 360, 390 × 844 pe o clădire). Cât e
// deschisă și acoperă mijlocul, imaginea se mută deasupra ei — sau alături, ori dedesubt,
// unde deasupra nu mai e loc —, cu decalajul de obiectiv al fișei (cadru-liber.js): ținta,
// deci centrul vederii, cade pe mijlocul părții libere.
//
// Cutia are de la deschidere înălțimea pe care o are cu un punct: îndemnul și cifrele stau
// în aceeași celulă, iar ce nu se arată e `visibility: hidden`, nu `display: none`. Altfel
// primul clic o creștea peste banda pe care se așezase imaginea, iar punctul cules și
// centrul vederii ajungeau sub ea (recenzia: 320 × 568, 640 × 360). Mai crește numai cu
// rândurile unei clădiri — ~70 px la 390 × 844, unde centrul vederii rămâne deasupra —, iar
// un punct cules chiar în banda aceea rămâne sub ea.
//
// Cadrul se reașază la deschidere, la minimizare și după „Măsoară centrul” — punctul de acolo
// stă pe raza țintei, deci după mutare rămâne pe mijlocul părții libere —, nu după un clic pe
// hartă: imaginea ar fugi de sub deget (control: semnul de la y 120 la 85,2).
//
// ────────────────────────────────────────────────── ce cifre au acoperire
//
// Coordonatele sunt ÎNTOTDEAUNA adevărate — pe apă, raza se oprește pe suprafața
// mării, care e un loc real. Altitudinea nu. `inaltimeLa` prinde indicii la
// marginea grilei, deci în afara hărții întoarce valoarea nodului de margine cu
// aceeași convingere ca înăuntru, fără să semnaleze nimic. Iar peste mare întoarce
// umplutura de −8 m — sidecarul o numește „artificiu de randare, nu batimetrie".
//
// Deci altitudinea primește etichetă, iar regula nu e aleasă din ochi. Sidecarul
// scrie `regula_apa`: „exact 0.0 m sau NODATA (−999); plaja, care are valori mici
// dar nenule, rămâne uscat". Prin construcție, uscatul măsurat e STRICT POZITIV.
// Orice valoare negativă e fie umplutura, fie interpolarea dintre ea și mal —
// niciuna nu e o cotă.
//
// ───────────────────────────────────────────────── numai în zona alpha
//
// Se măsoară numai în zona alpha — harta, nu împrejurimile din jurul ei —, cum a
// cerut autorul. Un clic dincolo spune „în afara zonei alpha” și atât: împrejurimile
// sunt decor — banda de lângă hartă e tot LiDAR DGT, dar la 4 m, iar de acolo încolo
// un model de suprafață de 30 m —, iar `geo.js` ar extrapola coordonatele din
// colțurile hărții. Raza merge totuși și peste împrejurimi (`limiteMars`), cu
// relieful lor: un clic pe un deal din fața hărții se oprește pe deal, nu pe
// alpha din spatele lui.

import * as THREE from 'three';
import { NEAR } from './camera.js';
import { inPoligon } from './terrain.js';
import { punctVazut } from './raza.js';
import { COTA_MARE } from './mare.js';

const PRAG_CLIC = 5;   // px între apăsare și ridicare; peste atât, harta a fost mutată

/**
 * Cât de departe de punct poate ieși RELIEFUL văzut de rază dinspre cameră, fără ca punctul
 * să fie socotit acoperit: punctul a fost cules de pe aceeași suprafață, dar de la altă
 * cameră, iar o rază razantă taie relieful de lângă el cu câțiva metri mai devreme. Numai
 * pentru relief și mare: un zid are 0,58–1,27 m, deci cu toleranța asta un punct de pe fața
 * lui îndepărtată n-ar fi ieșit niciodată acoperit (recenzia).
 */
const toleranta = (d) => 2 + 0.002 * d;
/** Clădirile: Möller–Trumbore e exact, deci ajunge o margine de rotunjire. */
const margineCladire = (d) => 0.05 + 1e-5 * d;

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
 * @param {{xMin: number, xMax: number, zMin: number, zMax: number}} [o.limiteMars] — cât
 *   de departe merge raza pe relief: harta cu împrejurimile ei. Implicit, numai harta.
 * @param {(x: number, z: number) => boolean} [o.inAlpha] — zona în care se măsoară
 * @param {number} [o.zMin] — `zMin_m`, cota umpluturii, pentru explicație
 * @param {(raza: THREE.Ray) => ({t: number, cheie: string, x: number, y: number, z: number}|null)} [o.loveste]
 *   — clădirile sanctuarului: prima lovită de rază, dacă e una
 * @param {(cheie: string) => string} [o.numeElement] — numele de afișat al unui element
 * @param {() => ({x: number, y: number}|null)} [o.centru] — centrul vederii, în coordonatele
 *   ferestrei, pentru „Măsoară centrul”; implicit, centrul canvasului
 * @param {{seteazaCutie: Function, aplica: Function}} [o.cadru] — cadrul liber al scenei
 *   (cadru-liber.js): cutia deschisă care acoperă mijlocul mută imaginea deasupra ei
 * @param {() => void} [o.cereRandare] — un cadru, pe care semnul punctului se așază
 * @returns {{dispose: () => void, culegeLa: Function, activeaza: Function, minimizeaza: Function, pas: Function,
 *   activ: boolean, semn: object}|null}
 */
export function creeazaPunct({ gazda, canvas, camera, inaltimeLa, geo, limitaDatelor, limiteMars, inAlpha, zMin, loveste, numeElement, centru,
  cadru, cereRandare }) {
  // Proba e un apel adevărat, nu o verificare de chei: `laGeo` întoarce null
  // dacă lipsesc `colturi_geo` sau `bbox_tm06`, iar un panou care arată
  // longitudinea „null" e mai rău decât unul care lipsește.
  if (!geo?.laGeo || !geo.laTM06 || !geo.limite || !geo.laGeo(0, 0)) {
    console.warn('punct: harta nu poartă `colturi_geo` și `bbox_tm06`, deci un '
      + 'punct nu se poate exprima în longitudine/latitudine. Panoul nu se arată.');
    return null;
  }

  const lim = limiteMars ?? geo.limite;
  const raycaster = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  // Suprafața mării, ca în `punctVazut`: y + (−COTA_MARE) = 0.
  const planApa = new THREE.Plane(new THREE.Vector3(0, 1, 0), -COTA_MARE);
  const temp = new THREE.Vector3();
  const v = new THREE.Vector3();
  const razaSemn = new THREE.Ray();

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

    // Cât de departe are rost să mergem: diagonala reliefului plus distanța până la
    // el. Dincolo, raza a ieșit demult din zonă.
    const diag = Math.hypot(lim.xMax - lim.xMin, lim.zMax - lim.zMin);
    const maxim = raza.origin.length() + diag * 1.5;

    // Relieful sau suprafața mării, cel mai apropiat. Clădirile NU intră aici, ci în
    // `cuCladire`, care le ține și cheia; prioritatea e aceeași: la egalitate, terenul.
    const t = punctVazut(raza, { inaltimeLa, lim }, maxim);
    if (t !== null) {
      raza.at(t, temp);
      return cuCladire({ x: temp.x, y: temp.y, z: temp.z, t });
    }

    // Marea de dincolo de `maxim`: punctul cade tot pe suprafața ei, ca panoul să
    // spună „în afara zonei alpha”, nu să lase pe ecran punctul de dinainte.
    if (raza.intersectPlane(planApa, temp)) return cuCladire({ x: temp.x, y: temp.y, z: temp.z, t: temp.distanceTo(raza.origin) });
    return cuCladire(null);
  }

  /**
   * O clădire a sanctuarului lovită ÎNAINTEA terenului câștigă: punctul e pe ea.
   * Raycast-ul pe plasa terenului costa 53 ms; pe clădiri e ieftin — câteva mii de
   * triunghiuri, cu respingere pe cutii —, deci aici se folosește.
   */
  function cuCladire(pTeren) {
    if (!loveste) return pTeren;
    const c = loveste(raycaster.ray);
    if (!c || (pTeren && pTeren.t <= c.t)) return pTeren;
    return { x: c.x, y: c.y, z: c.z, t: c.t, cladire: { cheie: c.cheie, y: c.y } };
  }

  /** Punctul e în zona în care se măsoară? */
  const inZona = (x, z) => (inAlpha ? inAlpha(x, z) : true) && (!limitaDatelor || inPoligon(x, z, limitaDatelor));

  /** Ce se poate spune despre altitudinea într-un punct. Ordinea contează. */
  function altitudineaLa(x, z) {
    if (!inZona(x, z)) return { h: null, eticheta: 'în afara zonei alpha' };
    const h = inaltimeLa(x, z);
    if (!(h > 0)) return { h: null, eticheta: 'apă' };
    return { h, eticheta: null };
  }

  // ----------------------------------------------------------------- panoul

  const radacina = document.createElement('div');
  radacina.id = 'punct';
  // Numai literaluri. Cifrele se scriu mai jos cu textContent.
  //
  // Semnul butonului e desenat, nu o literă: glifa ⌖ lipsește din unele fonturi
  // de telefon, iar o cititoare de ecran ar rosti-o.
  radacina.innerHTML =
    '<button class="activeaza" type="button" aria-expanded="false" aria-controls="punct-cutie"'
    + ' title="Arată coordonatele punctului pe care dai clic">'
    + '<svg class="semn" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<circle cx="12" cy="12" r="6.5"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6"/></svg>'
    + '<span class="text">Coordonate</span></button>'
    + '<div class="cutie" id="punct-cutie" data-stare="gol" hidden>'
    + '<div class="antet"><h2 class="titlu">Coordonate</h2>'
    + '<button class="minimizeaza" type="button" aria-label="Minimizează coordonatele"'
    + ' title="Minimizează: clicul pe hartă nu mai măsoară"><span aria-hidden="true">–</span></button></div>'
    // Îndemnul și cifrele stau în aceeași celulă (`.date`), iar cutia ține starea în
    // `data-stare`: ce nu se arată e ascuns cu `visibility`, deci cutia are de la deschidere
    // înălțimea pe care o are cu un punct (main.css). Cifrele pornesc cu „—”, nevăzute: goale,
    // rândurile ar fi mai scunde, iar cutia tot ar crește la primul punct (cu 49,8 px la 390 × 844).
    + '<div class="date">'
    + '<p class="indemn">Dă clic pe teren ca să afli unde e punctul, sau măsoară centrul hărții.</p>'
    + '<div class="valori">'
    + '<dl class="mari">'
    + '<dt class="cl" hidden>clădire</dt><dd class="cl" hidden></dd>'
    + '<dt>altitudine</dt><dd class="alt">—</dd>'
    + '<dt class="sol" hidden>sol</dt><dd class="sol" hidden></dd>'
    + '<dt>longitudine</dt><dd class="lon">—</dd>'
    + '<dt>latitudine</dt><dd class="lat">—</dd>'
    + '</dl>'
    // Câte un element pe axă, nu un text cu două spații între axe: spațiile la rând se
    // strâng într-unul (`white-space`, CSS Text 3), deci pe ecran rămânea unul singur.
    // Golul îl face CSS-ul, lărgind spațiul dintre ele, care rămâne și pentru textContent,
    // cititoare și selecție: selectat, rândul iese pe o singură linie.
    + '<dl class="mici">'
    + '<dt>scenă (m)</dt><dd class="sc"><span class="axa">X —</span> <span class="axa">Y —</span> <span class="axa">Z —</span></dd>'
    + '<dt>TM06 (m)</dt><dd class="tm"><span class="axa">X —</span> <span class="axa">Y —</span></dd>'
    + '</dl></div></div>'
    // Fără mouse: punctul din centrul vederii, cu aceeași culegere ca un clic.
    + '<div class="actiuni">'
    + '<button class="centru" type="button" title="Măsoară punctul din centrul hărții">Măsoară centrul</button>'
    + '<button class="copiaza" type="button">Copiază</button>'
    + '</div>'
    + '<span class="anunt" role="status" aria-live="polite"></span>'
    + '</div>';

  const activeazaBtn = radacina.querySelector('.activeaza');
  const minimizeazaBtn = radacina.querySelector('.minimizeaza');
  const cutie = radacina.querySelector('.cutie');
  const indemn = radacina.querySelector('.indemn');
  const dlMari = radacina.querySelector('.mari');
  const dlMici = radacina.querySelector('.mici');
  const buton = radacina.querySelector('.copiaza');
  const centruBtn = radacina.querySelector('.centru');
  const anunt = radacina.querySelector('.anunt');
  const camp = {
    alt: radacina.querySelector('.alt'),
    lon: radacina.querySelector('.lon'),
    lat: radacina.querySelector('.lat'),
    sc: [...radacina.querySelectorAll('.sc .axa')],
    tm: [...radacina.querySelectorAll('.tm .axa')],
    cl: radacina.querySelector('dd.cl'),
    sol: radacina.querySelector('dd.sol'),
  };
  const randuriCladire = [...radacina.querySelectorAll('.cl, .sol')];

  if (Number.isFinite(zMin)) {
    camp.alt.title = `Apa e codată la ${nr(zMin, 0)} m în hartă — artificiu de `
      + 'randare, nu batimetrie. De aceea peste mare scrie „apă", nu o cifră.';
  }

  gazda.appendChild(radacina);

  // Semnul punctului cules: aceeași cruce de vizare ca pe butonul „Coordonate”, de două
  // ori — dedesubt un contur lat din culoarea fundalului, deasupra linia aurie —, ca să se
  // vadă și pe calcarul alb, și pe marea închisă. Decorativ: punctul îl spune panoul.
  const semn = document.createElement('span');
  semn.className = 'punct-semn';
  semn.setAttribute('aria-hidden', 'true');
  semn.hidden = true;
  const CRUCE = '<circle cx="12" cy="12" r="6.5"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6"/>';
  semn.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">'
    + `<g class="contur">${CRUCE}</g><g class="linie">${CRUCE}</g><circle class="mijloc" cx="12" cy="12" r="1.6"/></svg>`;
  gazda.appendChild(semn);

  let viu = true;
  let activ = false;    // minimizat: nu culege nimic
  let ales = null;      // ultimul punct cules, gata de copiat
  let cronoCopiere = 0;

  // ------------------------------------------------------------- semnul

  /** Punctul e acoperit, privit de la cameră? Raza spre el, pe ce se vede: relief, mare, clădiri. */
  function acoperit(p) {
    razaSemn.origin.copy(camera.position);
    razaSemn.direction.set(p.x, p.y, p.z).sub(camera.position);
    const d = razaSemn.direction.length();
    if (!(d > NEAR)) return false;
    razaSemn.direction.divideScalar(d);
    const t = punctVazut(razaSemn, { inaltimeLa, lim }, d + toleranta(d));
    if (t !== null && t < d - toleranta(d)) return true;
    const c = loveste?.(razaSemn);
    return Boolean(c) && c.t < d - margineCladire(d);
  }

  /**
   * Semnul, pe cadrul care se desenează, după `camera.updateMatrixWorld()`: pe punctul cules,
   * cât panoul e deschis, punctul e în alpha și cade în canvas, în fața camerei.
   */
  function pas() {
    const p = activ ? ales?.p : null;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!p || !cw || !ch) { semn.hidden = true; return; }
    v.set(p.x, p.y, p.z).project(camera);
    const x = (v.x * 0.5 + 0.5) * cw, y = (-v.y * 0.5 + 0.5) * ch;
    if (!(v.z < 1) || !(x >= 0 && x <= cw && y >= 0 && y <= ch)) { semn.hidden = true; return; }
    const r = canvas.getBoundingClientRect();
    semn.style.transform = `translate(${(r.left + x).toFixed(1)}px, ${(r.top + y).toFixed(1)}px)`;
    semn.classList.toggle('ocluzat', acoperit(p));
    semn.hidden = false;
  }

  /**
   * Cutia s-a deschis, s-a minimizat sau a primit punctul din centru: cadrul liber o măsoară
   * din nou, iar semnul se așază pe cadrul următor. Până atunci semnul nu se mută: imaginea
   * de pe ecran e încă a cadrului de dinainte.
   */
  const reasaza = () => {
    cadru?.aplica();
    cereRandare?.();
  };

  function arata(p) {
    // În afara zonei alpha nu se scrie nicio cifră și nu rămâne nimic de copiat.
    if (!p.cladire && !inZona(p.x, p.z)) {
      for (const r of randuriCladire) r.hidden = true;
      indemn.textContent = 'În afara zonei alpha: aici nu se măsoară. Dă clic pe hartă.';
      cutie.setAttribute('data-stare', 'gol');
      ales = null;
      cereRandare?.();
      anunt.textContent = 'Punctul e în afara zonei alpha; acolo nu se măsoară.';
      return;
    }
    const teren = altitudineaLa(p.x, p.z);
    // Pe o clădire, altitudinea e a punctului de pe ea; solul de dedesubt se spune separat.
    const { h, eticheta } = p.cladire ? { h: p.cladire.y, eticheta: null } : teren;
    const numeCl = p.cladire ? (numeElement?.(p.cladire.cheie) ?? p.cladire.cheie) : null;
    for (const r of randuriCladire) r.hidden = !p.cladire;
    if (p.cladire) {
      camp.cl.textContent = numeCl;
      camp.sol.textContent = teren.h === null ? teren.eticheta : `${nr(teren.h, 2)} m`;
    }
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
    [`X ${nr(p.x, 2)}`, `Y ${y}`, `Z ${nr(p.z, 2)}`].forEach((s, i) => { camp.sc[i].textContent = s; });
    [`X ${nr(t.x, 2)}`, `Y ${nr(t.y, 2)}`].forEach((s, i) => { camp.tm[i].textContent = s; });

    cutie.setAttribute('data-stare', 'punct');

    ales = { p, h, eticheta, g, t, numeCl, sol: teren };
    cereRandare?.();
    anunt.textContent = numeCl
      ? `${numeCl}: punct la altitudinea ${nr(h, 2)} metri; solul de dedesubt la ${teren.h === null ? teren.eticheta : `${nr(teren.h, 2)} metri`}.`
      : h === null
      ? `Punct la longitudinea ${nr(g.lon, 6)}, latitudinea ${nr(g.lat, 6)}. Altitudine: ${eticheta}.`
      : `Punct la longitudinea ${nr(g.lon, 6)}, latitudinea ${nr(g.lat, 6)}, altitudinea ${nr(h, 2)} metri.`;
  }

  /** Blocul de copiat. Aceleași cifre ca în panou, cu punct zecimal. */
  function textDeCopiat() {
    if (!ales) return '';
    const { p, h, eticheta, g, t, numeCl, sol } = ales;
    return [
      'Cabo Espichel — punct ales',
      ...(numeCl ? [`clădire      ${numeCl}`, `sol          ${sol.h === null ? sol.eticheta : `${brut(sol.h, 2)} m`}`] : []),
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
    if (!activ || ev.button !== 0) return;
    // Al doilea deget: e zoom sau rotire, nu clic. Înainte îl înlocuia pe primul, iar o
    // ciupire cu un deget ținut pe loc ajungea să măsoare la ridicare.
    if (apasat && apasat.id !== ev.pointerId) { apasat = null; return; }
    apasat = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  };

  const laRidicare = (ev) => {
    if (!activ) { apasat = null; return; }
    if (!apasat || ev.pointerId !== apasat.id) return;
    const dist = Math.hypot(ev.clientX - apasat.x, ev.clientY - apasat.y);
    apasat = null;
    if (dist > PRAG_CLIC) return;   // a fost o mutare a hărții, nu clic
    culege(ev.clientX, ev.clientY);
  };

  const laAnulare = () => { apasat = null; };

  /** Culege punctul de sub (clientX, clientY) și îl arată. Minimizat, null. */
  const culege = (clientX, clientY) => {
    if (!activ) return null;
    const p = punctSubCursor({ clientX, clientY });
    if (p) arata(p);
    return p;
  };

  // „Măsoară centrul”: panoul se folosește și fără mouse — de la tastatură, cu un cititor
  // de ecran. Centrul e al vederii (`centru`, din controale): al părții libere de fișă și de
  // cutie; fără `centru`, al canvasului. Apoi cadrul se reașază pe cutia crescută.
  const laCentru = () => {
    const r = canvas.getBoundingClientRect();
    const c = centru?.() ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (activ && !culege(c.x, c.y)) anunt.textContent = 'În centrul hărții nu se vede niciun punct de măsurat.';
    if (activ) reasaza();
  };

  /**
   * Activează sau minimizează. Focusul trece pe butonul care apare: cel apăsat
   * tocmai dispare, iar focusul lăsat pe un element ascuns cade pe <body>.
   */
  function seteaza(stare, cuFocus) {
    if (!viu) return;
    activ = stare;
    apasat = null;   // o apăsare începută înainte nu mai culege
    // Cursorul hărții devine sfera cu punct cât se măsoară (main.css).
    canvas.toggleAttribute('data-culege', stare);
    // Pe <html>, pentru CSS-ul fișei și al versiunii, care stau în afara panoului
    // (main.css). Nu `:has()`: lipsește în Firefox sub 121, deci și în 115 ESR.
    document.documentElement.toggleAttribute('data-punct-deschis', stare);
    cutie.hidden = !stare;
    activeazaBtn.hidden = stare;
    activeazaBtn.setAttribute('aria-expanded', String(stare));
    if (!stare) semn.hidden = true;
    reasaza();
    if (cuFocus) (stare ? minimizeazaBtn : activeazaBtn).focus();
  }
  const laActivare = () => seteaza(true, true);
  const laMinimizare = () => seteaza(false, true);

  // Escape minimizează cutia deschisă. Îngustă și scundă (320 × 256, pagina mărită de patru
  // ori), ea coboară peste Satelit și busolă, iar Tab ajunge totuși la ele: Escape le dezvăluie
  // fără să mute focusul de pe ele. Numai focusul din cutie trece pe „Coordonate” — altfel ar
  // cădea pe <body>, cu cutia. Cât fișa sanctuarului e deschisă, Escape-ul e al ei (eticheta.js):
  // ascultătorul de aici e înscris înaintea ei, deci fără condiția asta o apăsare ar închide
  // amândouă. La fel, al modalei surselor.
  const laTasta = (e) => {
    if (e.key !== 'Escape' || !activ || e.defaultPrevented || e.target?.closest?.('dialog[open]')) return;
    if (document.documentElement.hasAttribute('data-fisa-deschisa')) return;
    e.preventDefault();
    seteaza(false, cutie.contains(e.target));
  };

  // Cutia deschisă, pentru cadrul liber; minimizată, nimic. Cadrul o mai măsoară la fiecare
  // redimensionare a canvasului și la deschiderea sau închiderea fișei (scena.js).
  cadru?.seteazaCutie(() => (activ && !cutie.hidden ? cutie.getBoundingClientRect() : null));

  canvas.addEventListener('pointerdown', laApasare);
  // Ridicarea se ascultă pe fereastră, nu pe canvas: controalele mută
  // `pointermove`/`pointerup` pe `ownerDocument` cât ține tragerea, iar o tragere
  // care iese din canvas și se termină afară n-ar mai declanșa niciodată
  // ridicarea pe el. `apasat` ar rămâne agățat, și primul clic de după ar fi
  // măsurat din locul greșit.
  globalThis.addEventListener('pointerup', laRidicare);
  globalThis.addEventListener('pointercancel', laAnulare);
  buton.addEventListener('click', laCopiere);
  centruBtn.addEventListener('click', laCentru);
  activeazaBtn.addEventListener('click', laActivare);
  minimizeazaBtn.addEventListener('click', laMinimizare);
  document.addEventListener('keydown', laTasta);

  return {
    /** Pentru verificare din consolă: culege fără eveniment de pointer. Minimizat, null. */
    culegeLa: culege,
    activeaza: () => seteaza(true, false),
    minimizeaza: () => seteaza(false, false),
    pas,
    get activ() { return activ; },
    /** Pentru probe: semnul de pe hartă. */
    semn,
    dispose() {
      if (!viu) return;
      viu = false;
      cadru?.seteazaCutie(null);
      canvas.removeEventListener('pointerdown', laApasare);
      globalThis.removeEventListener('pointerup', laRidicare);
      globalThis.removeEventListener('pointercancel', laAnulare);
      buton.removeEventListener('click', laCopiere);
      centruBtn.removeEventListener('click', laCentru);
      activeazaBtn.removeEventListener('click', laActivare);
      minimizeazaBtn.removeEventListener('click', laMinimizare);
      document.removeEventListener('keydown', laTasta);
      clearTimeout(cronoCopiere);
      canvas.removeAttribute('data-culege');
      document.documentElement.removeAttribute('data-punct-deschis');
      apasat = null;
      ales = null;
      semn.remove();
      radacina.remove();
    },
  };
}
