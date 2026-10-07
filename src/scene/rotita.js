import * as THREE from 'three';
import { punctVazut } from './raza.js';

// Zoomul rotiței: trepte fixe, line, spre locul de sub cursor.
//
// OrbitControls din r186 schimbă distanța cu 0,95^(Δ·0,01) pe eveniment: un clic de
// rotiță în Chrome (Δ = 100 px) o mută cu 5%, deci de la 80 m la 8 km erau ~90 de
// clicuri, iar în Firefox, unde Δ vine în linii (3 × 16), ~190. Autorul a cerut mai
// puține (2026-10-07): o treaptă înmulțește distanța cu 1,4, deci tot drumul ține
// 14 clicuri, în orice browser, iar fiecare alunecă ~0,2 s.
//
// Spre cursor, ca Google Maps și Mapbox: camera merge pe raza cursorului, deci tot ce
// e pe raza aceea — și punctul de teren de sub cursor — rămâne pe același pixel, iar
// orientarea nu se schimbă. Ținta (pivotul) se pune apoi pe raza privirii, la
// înălțimea pe care o avea, cât îi permit distanțele și cutia lui alpha. Imaginea nu
// depinde de unde stă ținta pe raza privirii, numai rotirile de după.
//
// `zoomToCursor` din OrbitControls nu ajungea: cu `screenSpacePanning` oprit și
// privirea la mai puțin de 20° sub orizont — vederea de pornire are 19,85° — el doar
// întoarce camera spre ținta veche, iar punctul de sub cursor fuge.

export const FACTOR_TREAPTA = 1.4;
const LN = Math.log(FACTOR_TREAPTA);
const COADA = 4 * LN;   // câte trepte se pot aduna înainte să se aplice
const TAU = 60;         // ms; ~95% dintr-o treaptă în 0,18 s
const RAPEL = 1e-3;     // sub atât, restul se aplică dintr-odată: exponențiala n-ar ajunge la zero

// Pe macOS, în Safari și în Chrome, un clic de rotiță e un multiplu exact al acestui
// număr de pixeli; MapLibre recunoaște rotița tot așa (scroll_zoom.ts).
const CLIC_MACOS = 4.000244140625;

/**
 * Cât din distanță cere un eveniment de rotiță, ca logaritm: + depărtează, − apropie.
 *
 * Un clic de rotiță e o treaptă întreagă, oricum l-ar raporta browserul:
 * - în linii (Firefox: 3) sau în pagini;
 * - pe macOS, un multiplu de `CLIC_MACOS` (~4 px);
 * - în pixeli, cât un clic, singur sau repetat la fel. Chrome împarte delta la mărirea
 *   paginii — 100 px la 100%, 40 la 250%, 33 la 300% —, dar `devicePixelRatio` o
 *   conține, deci în pixeli de dispozitiv clicul rămâne mare; Windows cu „1 linie pe
 *   clic” dă 33. De la 20 de pixeli de dispozitiv în sus, un eveniment singur (fără
 *   altul în 300 ms) sau egal cu cel dinainte e un clic.
 * Restul vine de la un touchpad: rafale de zeci de evenimente pe gest, cu valori care
 * se schimbă de la unul la altul. Acelea merg proporțional (100 px, o treaptă) și se
 * aplică pe loc, la fel ca ciupirea pe touchpad, pe care browserul o trimite ca rotiță
 * cu Ctrl. Recenzia a găsit pragul de dinainte, 50 px CSS, fără efect de la mărirea de
 * 250% în sus și pe macOS, unde un clic ajungea 4% dintr-o treaptă.
 *
 * @param {{deltaY: number, deltaMode?: number, ciupire?: boolean}} e
 * @param {{dpr?: number, izolat?: boolean, precedent?: number|null}} [ritm] — pixelii de
 *   dispozitiv pe pixel CSS, dacă n-a mai venit niciun eveniment în ultimele 300 ms și
 *   |deltaY| al celui dinainte
 * @returns {{ln: number, imediat: boolean}|null}
 */
export function treapta({ deltaY, deltaMode = 0, ciupire = false }, { dpr = 1, izolat = true, precedent = null } = {}) {
  if (!deltaY || !Number.isFinite(deltaY)) return null;
  const semn = Math.sign(deltaY), a = Math.abs(deltaY);
  if (ciupire) return { ln: deltaY * 0.01, imediat: true };
  if (deltaMode === 1) return { ln: semn * Math.min(1, a / 3) * LN, imediat: false };
  if (deltaMode === 2 || a % CLIC_MACOS === 0) return { ln: semn * LN, imediat: false };
  if (a * dpr >= 20 && (izolat || a === precedent)) return { ln: semn * LN, imediat: false };
  return { ln: (deltaY / 100) * LN, imediat: true };
}

const _u = new THREE.Vector3(), _c = new THREE.Vector3();

/**
 * Un pas de zoom, ancorat în P: distanța × e^ln, cât se poate.
 *
 * Camera merge pe dreapta P–cameră: `C' = P + (C − P)·s`. Ținta se pune pe raza
 * privirii din C', la înălțimea ei de dinainte, între `dMin` și `dMax` și în cutia lui
 * alpha. Dacă pasul întreg nu încape — camera ar ajunge la mai puțin de `dMin` de P
 * (din vederea de pornire spre platou ar fi ajuns la ~5 m de sol, sub planul apropiat)
 * sau ținta n-ar mai avea loc pe raza privirii —, `s` se înjumătățește geometric până
 * încape. Zoomul înapoi n-are voie să se blocheze: ce n-a încăput spre P se face spre
 * țintă — camera se retrage pe raza privirii, iar ținta, deja în alpha, rămâne —, până
 * la `dMax`. Recenzia găsise rotița blocată, în ambele sensuri, cu ținta lipită de o
 * muchie a cutiei: retragerea de dinainte, tot prin cutie, cădea și ea.
 *
 * @returns {number} logaritmul aplicat de fapt; mai mic decât `ln` la o limită
 */
export function pasZoom({ camera, tinta, P, ln, dMin, dMax, alpha }) {
  const C = camera.position;
  _u.copy(tinta).sub(C);
  const r = _u.length();
  if (!(r > 0) || !ln) return 0;
  _u.divideScalar(r);
  const y0 = tinta.y;

  // Unde stă ținta pe raza privirii din c, sau null dacă nu are unde.
  const asezare = (c) => {
    let lo = dMin, hi = dMax;
    if (alpha) {
      const iv = alpha.intervalRaza(c, _u);
      if (!iv) return null;
      lo = Math.max(lo, iv[0]); hi = Math.min(hi, iv[1]);
    } else if (_u.y < 0) hi = Math.min(hi, c.y / -_u.y);   // nu sub mare
    if (lo > hi) return null;
    const dorit = _u.y < -1e-6 ? (c.y - y0) / -_u.y : r;
    return Math.min(hi, Math.max(lo, dorit));
  };
  const incearca = (s, ancora) => {
    _c.copy(C).sub(ancora).multiplyScalar(s).add(ancora);
    if (s < 1 && _c.distanceTo(ancora) < dMin) return null;
    return asezare(_c);
  };
  const cauta = (ancora) => {
    const s = Math.exp(ln);
    if (incearca(s, ancora) !== null) return s;
    if (incearca(1, ancora) === null) return null;
    let a = 1, b = s;
    for (let i = 0; i < 40; i++) {
      const m = Math.sqrt(a * b);
      if (incearca(m, ancora) !== null) a = m; else b = m;
    }
    return Math.abs(Math.log(a)) > 1e-9 ? a : null;
  };

  let aplicat = 0;
  const s = cauta(P);
  if (s !== null) {
    const t = incearca(s, P);
    C.copy(_c);
    tinta.copy(_c).addScaledVector(_u, t);
    aplicat = Math.log(s);
  }
  if (ln > 0 && aplicat < ln - 1e-12) {
    const rT = C.distanceTo(tinta);
    const sT = Math.min(Math.exp(ln - aplicat), dMax / rT);
    if (sT > 1 + 1e-12) {
      C.sub(tinta).multiplyScalar(sT).add(tinta);
      aplicat += Math.log(sT);
    }
  }
  return aplicat;
}

/**
 * Starea rotiței: treptele care încă alunecă și punctul spre care.
 *
 * @param {{camera: THREE.PerspectiveCamera, controale: object}} o — controalele dau
 *   ținta, limitele de distanță și `enableDamping`: cu el oprit (prefers-reduced-motion,
 *   scena.js) treptele se aplică pe loc, fără alunecare
 */
export function creeazaRotita({ camera, controale }) {
  let teren = null;          // { inaltimeLa, lim, alpha, loveste }
  let rest = 0;              // logaritmul care mai are de alunecat
  let tPrec = null;
  let tUltim = -Infinity, precedent = null;   // ritmul rotiței: clic sau touchpad
  const P = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  /**
   * P: ce se vede sub cursor — teren, suprafața mării sau o clădire; fără nimic sub el,
   * un punct de pe raza cursorului. Cu clădirile: altfel garda de 80 m se măsura față de
   * terenul din spatele farului, iar camera trecea prin turn.
   */
  const ancoreaza = (clientX, clientY, rect) => {
    camera.updateMatrixWorld();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const raza = raycaster.ray, r = camera.position.distanceTo(controale.target);
    // Mai departe de 3·r nu se caută: împrejurimile merg până la 50 km, iar o treaptă
    // spre un deal de la 30 km ar sări kilometri. Orice punct de pe raza cursorului
    // rămâne oricum pe același pixel.
    const t = teren ? punctVazut(raza, teren, 3 * r) : null;
    raza.at(t ?? r, P);
  };
  const aplica = (ln) => pasZoom({
    camera, tinta: controale.target, P, ln,
    dMin: controale.minDistance, dMax: controale.maxDistance, alpha: teren?.alpha ?? null,
  });

  return {
    /** Relieful pe care se caută punctul de sub cursor; până atunci, raza cursorului. */
    seteazaTeren(t) { teren = t; },

    /**
     * Un eveniment de rotiță. Întoarce true dacă a mutat camera pe loc (touchpad,
     * ciupire, reduced-motion); altfel treapta așteaptă în coadă și o duce `pas()`.
     */
    adauga(ev, rect) {
      const acum = performance.now();
      const tr = treapta(ev, { dpr: globalThis.devicePixelRatio || 1, izolat: acum - tUltim > 300, precedent });
      tUltim = acum;
      precedent = Math.abs(ev.deltaY);
      if (!tr || !rect?.width || !rect?.height) return false;
      ancoreaza(ev.clientX, ev.clientY, rect);
      if (!controale.enableDamping) {
        rest = 0;
        return aplica(tr.ln) !== 0;
      }
      // Touchpadul se aplică pe loc, dar treptele încă nealunecate rămân în coadă: un
      // gest care amestecă evenimente mari și mici nu-și mai pierde treptele.
      if (tr.imediat) return aplica(tr.ln) !== 0;
      rest = Math.max(-COADA, Math.min(COADA, rest + tr.ln));
      tPrec = null;
      return false;
    },

    /** Zoom pe loc, cu `ln` dat, spre punctul de sub (clientX, clientY): ciupirea cu degetele. */
    imediat(ln, clientX, clientY, rect) {
      if (!ln || !rect?.width || !rect?.height) return false;
      rest = 0;
      ancoreaza(clientX, clientY, rect);
      return aplica(ln) !== 0;
    },

    /** Un cadru de alunecare, chemat din buclă înaintea lui `controale.update()`. Întoarce true dacă a mișcat. */
    pas() {
      if (!rest) return false;
      const acum = performance.now();
      const dt = tPrec === null ? 1000 / 60 : Math.min(100, acum - tPrec);
      tPrec = acum;
      const ln = Math.abs(rest) < RAPEL ? rest : rest * (1 - Math.exp(-dt / TAU));
      const aplicat = aplica(ln);
      // La o limită pasul a ieșit mai scurt: restul nu mai are unde merge.
      rest = Math.abs(aplicat - ln) > 1e-12 || ln === rest ? 0 : rest - ln;
      return aplicat !== 0;
    },

    /** Golește coada: un zbor, o tragere sau o rotire iau camera. */
    opreste() { rest = 0; tPrec = null; },
    get activa() { return rest !== 0; },
  };
}
