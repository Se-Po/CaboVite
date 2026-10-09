import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { creeazaRotita } from './rotita.js';
import { punctVazut } from './raza.js';
import { COTA_MARE } from './mare.js';

// Camera și controalele.
//
// Pornirea e o vedere aleasă de autor pe pagină: dinspre mare, din nord-vest,
// peste faleze, cu sanctuarul sus și farul în dreapta. Clicul pe busolă o reface.
//
// Harta se mânuiește ca o hartă, la cererea autorului (2026-10-07): butonul stâng o
// mută, cel drept schimbă unghiul — rotește și înclină —, rotița apropie și
// depărtează spre locul de sub cursor. Așa fac ArcGIS SceneView, Mapbox/MapLibre și
// Potree EarthControls; model viewer-ele (Sketchfab, OrbitControls implicit) fac
// invers. Pe telefon la fel: un deget mută, două degete ciupesc pentru zoom și,
// trase împreună, rotesc și înclină. Shift, Ctrl sau Cmd cu butonul stâng rotesc și
// ele — calea unui touchpad sau a unui mouse cu un singur buton.

// Camera stă la sute de metri de subiect, deci near poate fi generos: ridicat de
// la 1 la 10 m, raportul near/far scade de zece ori și cu el riscul de z-fighting
// pe planul mării. Pivotul nu se apropie de cameră sub 80 m (DIST_MIN).
export const NEAR = 10;
export const FAR = 60000;

// Fațetele au 2 m, deci se poate intra mult mai aproape fără ca terenul să se
// destrame; sub ~80 m camera ajunge în interiorul reliefului. De sus, 8 km
// cuprind toată harta pe orice ecran.
export const DIST_MIN = 80;
export const DIST_MAX = 8000;

// Vederea de pornire, în coordonatele scenei: poziția camerei și ținta, citite
// din pagină pe 2026-09-30 — busola scrie acolo 306° NV (306,28°), cu privirea
// la 19,85° sub orizontală. Scrise ca puncte, nu ca azimut: azimutul adevărat
// cere γ, care se află abia din sidecarul hărții, după ce camera există.
//
// Ținta citită stătea la y = −61, sub mare — vederea fusese trasă lateral. Ținta
// e și pivotul OrbitControls, iar sub apă limita maxPolarAngle ar lăsa camera să
// coboare sub planul mării. Deci s-a mutat pe raza privirii, până la y = 60, cota
// platoului: aceeași cameră, aceeași direcție, aceeași imagine; doar pivotul e
// mai aproape, la 611,22 m în loc de 968,53. Rotunjirea la centimetru rotește
// privirea cu 0,0006°.
//
// Pe orice ecran aceeași: unghiul de deschidere e vertical, deci un ecran îngust
// taie lateralele. Așa a cerut autorul.
//
// Tablouri simple, înghețate: zbor.js le indexează, iar scena i le dă zborului la
// fiecare clic pe busolă.
export const VEDERE_START = Object.freeze({
  pozitie: Object.freeze([-633.06, 267.56, -511.25]),
  tinta: Object.freeze([-173.65, 60, -165.63]),
});

// Stările controalelor: `state` e public (Controls.js), dar valorile lui sunt
// `_STATE` din OrbitControls.js:45-54, privat modulului. Scrise aici; proba Node
// (verifica-controale) le citește înapoi din controalele adevărate.
export const STARE = Object.freeze({
  NIMIC: -1, ROTIRE: 0, ZOOM: 1, MUTARE: 2,
  DEGET_ROTIRE: 3, DEGET_MUTARE: 4, DEGETE_ZOOM_MUTARE: 5, DEGETE_ZOOM_ROTIRE: 6,
});

// Pașii de la tastatură (`ControaleHarta.comanda`): mutarea cu 5% din înălțimea vederii,
// la distanța țintei; rotirea cu 15°, oricât de înalt e ecranul; zoomul, o treaptă de rotiță.
export const PAS_MUTARE = 0.05;
export const UNGHI_PAS = (15 * Math.PI) / 180;
export const COMENZI = Object.freeze(['sus', 'jos', 'stanga', 'dreapta',
  'roteste-stanga', 'roteste-dreapta', 'urca', 'coboara', 'apropie', 'departeaza']);

// Drona: Shift urcă, Ctrl coboară, cu privirea neschimbată (tastatura.js), la cererea
// autorului (2026-10-09). Un pas e PAS_VERTICAL din înălțimea camerei peste ce e sub ea:
// sus urcă repede, aproape de sol coboară încet. Niciun pas de la tastatură — mutarea,
// rotirea, zoomul, coborârea — nu duce camera la mai puțin de LIBER_SOL peste relief, mare
// sau un acoperiș, pe tot discul planului apropiat (`_solSub`): de două ori planul apropiat.
// Pasul alunecă TAU_VERTICAL, cât amortizarea mutării (0,08 pe cadru, la 60 de cadre pe
// secundă). Toate trei sunt alegeri, nu măsurători.
export const PAS_VERTICAL = 0.1;
export const LIBER_SOL = 2 * NEAR;
const TAU_VERTICAL = 200; // ms
const COADA_VERTICAL = 4; // pași

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _raza = new THREE.Ray();
const _jos = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
const _q = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const rectDin = (el) => el?.getBoundingClientRect?.() ?? null;

/**
 * Cât de departe de cameră ajunge cel mai depărtat colț al planului apropiat, din
 * fereastra pe care o calculează `updateProjectionMatrix` din r186 — cu decalajul de
 * obiectiv, dacă e unul. Fără decalaj: NEAR·√(1 + tg²(fov/2)·(1 + aspect²)). Cu imaginea
 * mutată din calea fișei sau a cutiei „Coordonate” (cadru-liber.js), fereastra nu mai stă
 * în mijloc, iar colțul dinspre partea mutată iese mai departe: la 320 × 568, cu imaginea sub
 * cutie, 12,35 m, peste discul de dinainte, de 12,18 m cu tot cu marja de 10%
 * (verifica-controale).
 */
export function razaPlanApropiat(cam) {
  let top = (cam.near * Math.tan((cam.fov * Math.PI) / 360)) / cam.zoom;
  let h = 2 * top, w = cam.aspect * h, left = -0.5 * w;
  const v = cam.view;
  if (v?.enabled) {
    left += (v.offsetX * w) / v.fullWidth;
    top -= (v.offsetY * h) / v.fullHeight;
    w *= v.width / v.fullWidth;
    h *= v.height / v.fullHeight;
  }
  const x = Math.max(Math.abs(left), Math.abs(left + w)), y = Math.max(Math.abs(top), Math.abs(top - h));
  return Math.sqrt(cam.near * cam.near + x * x + y * y);
}

/**
 * MapControls din r186 — stânga mută, dreapta rotește, mutarea pe orizontală, un
 * deget mută și două ciupesc și rotesc —, cu patru lucruri în plus:
 *
 * - **rotița** trece prin rotita.js: trepte fixe, line, spre cursor. `onMouseWheel`
 *   face mai departe `preventDefault`, ignoră rotița cât ții un buton apăsat și emite
 *   `start`/`end`, deci un zbor în curs se oprește la rotiță ca la orice atingere;
 * - **mutarea apucă terenul**: punctul de teren de sub cursor rămâne sub cursor, fără
 *   întârzierea amortizării. MapControls apucă planul orizontal prin țintă — la
 *   vederea de pornire, 60 m: plaja rămânea în urma cursorului cu ~22%, platoul o lua
 *   înainte cu ~50% —, iar o tragere pornită pe cer lăsa un punct de start vechi
 *   (`intersectPlane` nul nu-și scrie ținta), deci prima mișcare sărea. Pe cer, sau
 *   mai departe de 4·r, mutarea rămâne cea obișnuită;
 * - **pivotul pe teren**: la începutul unei rotiri ținta coboară pe raza privirii până
 *   pe teren. Imaginea nu se mișcă, iar camera se rotește în jurul locului privit, nu
 *   al unui punct care plutește la 60 m deasupra mării;
 * - **ciupirea** apropie spre punctul dintre degete, ca rotița spre cursor;
 * - **gestul se încheie și fără `pointerup`** (`incheieGestul`): la un zbor pornit cu
 *   harta ținută, la pierderea capturii pointerului și la pierderea focusului ferestrei;
 * - **pașii de la tastatură** (`comanda`, chemată de tastatura.js): mutare, rotire,
 *   urcare și coborâre ca o dronă, zoom, cu limitele obișnuite. `listenToKeyEvents` al lui
 *   OrbitControls nu se folosește: rotea cu 0,4° pe apăsare, n-avea zoom și nici pivotul
 *   pe teren.
 *
 * `connect()` și `update()` rulează din constructorul lui OrbitControls, înaintea
 * câmpurilor de mai jos: nimic de aici nu se sprijină pe ele.
 */
export class ControaleHarta extends MapControls {
  constructor(camera, element) {
    super(camera, element);
    // `pointermove` vine de pe document, iar OrbitControls nu întreabă dacă pointerul e
    // al gestului (OrbitControls.js:1592). Un deget pus pe busolă, sau unul rămas pe
    // sticlă după un gest încheiat de zbor sau de `blur`, ar fi mutat harta ca și cum ar fi
    // fost degetul care o ține: măsurat, 242–322 m de salt. Se învelește numai mișcarea —
    // OrbitControls o înscrie abia la apăsare, prin proprietatea asta —, nu și ridicarea,
    // pe care `connect()` a legat-o deja de `pointercancel`.
    this._onPointerMoveOrbit = this._onPointerMove;
    this._onPointerMove = (e) => { if (this._isTrackingPointer(e)) this._onPointerMoveOrbit(e); };
    // `connect()` trece prin `disconnect()`, care scrie pe canvas `style.cursor =
    // 'auto'` (OrbitControls.js:536): inline, ar bate cursoarele din CSS.
    element?.style?.removeProperty('cursor');
    this.rotita = creeazaRotita({ camera, controale: this });
    this._teren = null;
    this._apucat = null;
    this._vertical = 0;      // metrii de urcare (negativ: coborâre) care mai au de alunecat
    this._tVertical = null;
    this._pazaSol = false;   // un pas de la tastatură încă alunecă: camera rămâne peste sol
    this._panAmanat = new THREE.Vector3();   // partea din mutare care așteaptă urcarea
    // Pentru treptele de la tastatură (rotita.js, `pasZoom`): cât stă un punct peste ce e sub
    // el, și cât trebuie să stea.
    this.liberLa = (p) => p.y - this._solSub(p.x, p.y, p.z);
    this.liberMin = LIBER_SOL;
    // O tragere sau o rotire iau camera: treptele rotiței și urcarea rămase nu mai alunecă
    // peste ea. Rotița și tastele emit și ele `start`, dar cu starea NIMIC.
    this.addEventListener('start', () => {
      if (this.state === STARE.NIMIC) return;
      this.rotita.opreste();
      this.opresteVertical();
    });
    // OrbitControls încheie gestul numai la `pointerup` sau `pointercancel`, iar
    // `pointermove` îl ascultă pe document, fără să citească `buttons`
    // (OrbitControls.js:1592). Fără `pointerup` — Alt+Tab în mijlocul unei trageri —
    // harta urma mouse-ul fără buton, și peste textul paginii: măsurat, pe 200 px,
    // 128,8 m de mutare sau 900,7 m de rotire. Captura pierdută încheie numai
    // pointerul ei: dacă unul din două degete își pierde captura fără să se ridice,
    // celălalt mută mai departe. După un `pointerup` obișnuit pointerul nu mai e urmărit,
    // deci captura pierdută de atunci — browserul o pierde implicit după ridicare — nu
    // face nimic.
    this._laCapturaPierduta = (e) => {
      if (!this._isTrackingPointer(e)) return;
      if (this._pointers.length > 1) this._onPointerUp(e); else this.incheieGestul();
    };
    this._laBlur = () => this.incheieGestul();
    element?.addEventListener?.('lostpointercapture', this._laCapturaPierduta);
    globalThis.addEventListener?.('blur', this._laBlur);
  }

  /**
   * Încheie gestul în curs ca la ridicarea ultimului pointer — eliberează captura, lasă
   * documentul, emite `end` —, fără să mai aștepte `pointerup`. Fără pointer apăsat nu
   * face nimic, deci nici `end` fără `start`.
   *
   * Îl cheamă și zborul (zbor.js): `_apucat` e un punct de LUME, iar o tragere lăsată
   * deschisă peste zbor l-ar fi adus înapoi sub cursor la prima mișcare — măsurat, harta
   * sărea cu 1,47 km de acasă. Nu ajunge să uiți punctul: `_panStart` rămâne cel de la
   * apăsare, iar mutarea lui OrbitControls ar sări cu 169 m.
   */
  incheieGestul() {
    const ids = [...this._pointers];
    if (!ids.length) return;
    // Întâi se uită pointerii: `lostpointercapture` poate veni chiar din eliberare.
    this._pointers.length = 0;
    this._pointerPositions = {};
    const el = this.domElement;
    el.ownerDocument.removeEventListener('pointermove', this._onPointerMove);
    el.ownerDocument.removeEventListener('pointerup', this._onPointerUp);
    for (const id of ids) {
      // Pe un pointer care nu mai e activ, specificația cere NotFoundError.
      try { el.releasePointerCapture(id); } catch { /* n-are ce elibera */ }
    }
    this._apucat = null;
    this.dispatchEvent({ type: 'end' });
    this.state = STARE.NIMIC;
  }

  /** Relieful randat, cu limitele lui, și alpha: pentru rotiță, apucare și pivot. */
  seteazaTeren(teren) {
    this._teren = teren;
    this.rotita.seteazaTeren(teren);
  }

  /** Limita alpha a mutat ținta (dx, dz): punctul apucat se mută odată cu ea. */
  mutaApucarea(dx, dz) {
    if (!this._apucat || (!dx && !dz)) return;
    this._apucat.x += dx;
    this._apucat.z += dz;
  }

  _razaLa(clientX, clientY) {
    const r = rectDin(this.domElement);
    if (!r?.width || !r?.height) return null;
    this.object.updateMatrixWorld();
    _ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    _raycaster.setFromCamera(_ndc, this.object);
    return _raycaster.ray;
  }

  /** Punctul de teren de sub cursor devine cel apucat; null dacă nu e niciunul aproape. */
  _apuca(clientX, clientY) {
    this._apucat = null;
    const t = this._teren, raza = t && this._razaLa(clientX, clientY);
    if (!raza) return;
    // Ce se vede: pe mare, suprafața ei, nu umplutura de −8 m de sub ea; o clădire, dacă e în față.
    const d = punctVazut(raza, t, 4 * this.object.position.distanceTo(this.target));
    if (d !== null) this._apucat = raza.at(d, new THREE.Vector3());
  }

  /** Mută harta cât punctul apucat să ajungă sub cursor; numai pe orizontală. */
  _trage(clientX, clientY) {
    const g = this._apucat, raza = this._razaLa(clientX, clientY);
    if (!raza) return;
    _plan.constant = -g.y;
    // Cursorul a urcat peste orizontul planului, sau aproape de el: mișcarea se sare.
    if (!raza.intersectPlane(_plan, _q)) return;
    if (_q.distanceTo(raza.origin) > 10 * this.object.position.distanceTo(this.target)) return;
    const dx = g.x - _q.x, dz = g.z - _q.z;
    this.target.x += dx; this.target.z += dz;
    this.object.position.x += dx; this.object.position.z += dz;
  }

  _handleMouseDownPan(event) {
    OrbitControls.prototype._handleMouseDownPan.call(this, event);
    this._panOffset.set(0, 0, 0);
    this._apuca(event.clientX, event.clientY);
  }

  _handleMouseMovePan(event) {
    if (!this._apucat) { OrbitControls.prototype._handleMouseMovePan.call(this, event); return; }
    this._trage(event.clientX, event.clientY);
    this.update();
  }

  // Pe atingere coordonatele sunt de pagină; canvasul e fix, deci cele de fereastră
  // sunt pagina minus defilarea. Evenimentul de la ridicarea unui deget, cu care
  // OrbitControls reface starea, are numai pageX/pageY.
  _handleTouchStartPan(event) {
    OrbitControls.prototype._handleTouchStartPan.call(this, event);
    this._panOffset.set(0, 0, 0);
    if (this._pointers.length === 1) this._apuca(event.pageX - (globalThis.scrollX ?? 0), event.pageY - (globalThis.scrollY ?? 0));
    else this._apucat = null;
  }

  _handleTouchMovePan(event) {
    // onTouchMove cheamă singur update() după
    if (this._apucat && this._pointers.length === 1) this._trage(event.pageX - (globalThis.scrollX ?? 0), event.pageY - (globalThis.scrollY ?? 0));
    else OrbitControls.prototype._handleTouchMovePan.call(this, event);
  }

  _handleMouseDownRotate(event) {
    super._handleMouseDownRotate(event);
    this.pivotPeTeren();
  }

  _handleTouchStartDollyRotate(event) {
    super._handleTouchStartDollyRotate(event);
    this.pivotPeTeren();
  }

  // Butonul din mijloc apropie spre țintă, cu dolly-ul lui OrbitControls. După un zoom
  // spre cursor ținta poate sta sub platou, la înălțimea pe care o avea: fără pivotul pus
  // pe teren, recenzia a dus camera la 4,31 m sub relief.
  _handleMouseDownDolly(event) {
    super._handleMouseDownDolly(event);
    this.pivotPeTeren();
  }

  /**
   * Ținta coboară pe raza privirii până la ce se vede — teren, suprafața mării, o
   * clădire —, cât îi permit distanțele și cutia lui alpha. Raza e aceeași, deci imaginea
   * nu se mișcă.
   */
  pivotPeTeren() {
    const t = this._teren;
    if (!t) return;
    const C = this.object.position;
    _u.copy(this.target).sub(C);
    const r = _u.length();
    if (!(r > 0)) return;
    _u.divideScalar(r);
    _raza.set(C, _u);
    const d = punctVazut(_raza, t, this.maxDistance);
    if (d === null) return;
    let lo = this.minDistance, hi = this.maxDistance;
    if (t.alpha) {
      const iv = t.alpha.intervalRaza(C, _u);
      if (!iv) return;
      lo = Math.max(lo, iv[0]); hi = Math.min(hi, iv[1]);
    }
    if (lo > hi) return;
    this.target.copy(C).addScaledVector(_u, Math.min(hi, Math.max(lo, d)));
  }

  /**
   * Unde cade ținta pe ecran, în coordonatele ferestrei: centrul vederii. Fără decalaj de
   * obiectiv e centrul canvasului; cu fișa deschisă, centrul părții libere. Spre el apropie
   * „+” și de acolo culege „Măsoară centrul” (punct.js). Null fără canvas cu mărime.
   */
  centruVederii() {
    const r = rectDin(this.domElement);
    if (!r?.width || !r?.height) return null;
    this.object.updateMatrixWorld();
    _q.copy(this.target).project(this.object);
    if (!Number.isFinite(_q.x) || !Number.isFinite(_q.y)) return null;
    return { x: r.left + ((_q.x + 1) / 2) * r.width, y: r.top + ((1 - _q.y) / 2) * r.height };
  }

  /**
   * Cota a ce e sub (x, z), văzut de la înălțimea y: relieful randat, suprafața mării sau
   * acoperișul unei clădiri — cel mai sus —, pe tot discul pe care îl ocupă planul apropiat
   * cu camera în (x, z). Raza e a colțurilor planului apropiat (`razaPlanApropiat`, cu
   * decalajul de obiectiv), cu 10% marjă pentru eșantionare: fără decalaj, 14,4 m la 16:9 și
   * 12,1 m în portret. Centrul,
   * 16 puncte pe cerc și 16 la jumătatea razei. Numai pe verticala punctului, drona ținută la
   * 20 m peste plajă ajungea cu planul apropiat în peretele falezei, iar stânca din centrul
   * ecranului la 1,31 m (recenzia); cu un disc de NEAR, pe margini tot rămâneau tăieturi.
   */
  _solSub(x, y, z) {
    const t = this._teren;
    let sol = COTA_MARE;
    if (!t) return sol;
    const l = t.lim;
    const raza = 1.1 * razaPlanApropiat(this.object);
    for (let k = -1; k < 32; k++) {
      const a = (k * Math.PI) / 8, q = k < 0 ? 0 : k < 16 ? raza : raza / 2;
      const px = x + q * Math.cos(a), pz = z + q * Math.sin(a);
      if (!l || (px >= l.xMin && px <= l.xMax && pz >= l.zMin && pz <= l.zMax)) {
        const h = t.inaltimeLa(px, pz);
        if (Number.isFinite(h)) sol = Math.max(sol, h);
      }
      if (t.loveste) {
        _jos.origin.set(px, y, pz);
        const c = t.loveste(_jos);
        if (c && c.t > 0) sol = Math.max(sol, y - c.t);
      }
    }
    return sol;
  }

  /**
   * Drona: camera urcă (dy > 0) sau coboară pe verticală, cu privirea neschimbată, iar
   * ținta trece pe raza privirii, pe ce se vede — ca la `pivotPeTeren`, între 80 m și 8 km
   * și în alpha. Pe verticală nu se poate muta ținta împreună cu camera: limita alpha o
   * ține între cota mării și cea mai înaltă cotă a hărții, deci urcarea s-ar fi oprit după
   * ~100 m, iar coborârea pe plajă după câțiva metri.
   *
   * Coborârea se oprește la LIBER_SOL peste ce e sub cameră și cât ce se vede în față e
   * la mai puțin de 80 m (DIST_MIN, garda zoomului); urcarea, unde privirea nu mai găsește
   * nimic în alpha la cel mult 8 km — privind spre orizont, mai jos decât privind în jos.
   * Coborârea numai apropie ce se vede, deci nu se refuză când acum nu se vede nimic în 8 km
   * (după „−” sau rotița înapoi): ținta trece atunci la capătul ei în alpha. Altfel Ctrl nu
   * cobora deloc după opt trepte înapoi (recenzia). Un pas care nu încape se scurtează, prin
   * înjumătățire, până încape.
   *
   * @returns {number} cât a urcat camera (negativ: a coborât), în metri
   */
  _mutaVertical(dy) {
    const C = this.object.position;
    _u.copy(this.target).sub(C);
    const r = _u.length();
    if (!dy || !Number.isFinite(dy) || !(r > 0)) return 0;
    _u.divideScalar(r);
    const t = this._teren;
    if (!t) {
      C.y += dy;
      this.target.y += dy;
      return dy;
    }
    const sol = dy < 0 ? this._solSub(C.x, C.y, C.z) + LIBER_SOL : -Infinity;
    // Unde ar sta ținta cu camera la cota y, sau null dacă acolo nu se poate.
    const tintaLa = (y) => {
      if (y < sol) return null;
      _q.set(C.x, y, C.z);
      _raza.set(_q, _u);
      const d = punctVazut(_raza, t, this.maxDistance);
      if (d === null ? dy > 0 : dy < 0 && d < this.minDistance) return null;
      let lo = this.minDistance, hi = this.maxDistance;
      if (t.alpha) {
        const iv = t.alpha.intervalRaza(_q, _u);
        if (!iv) return null;
        lo = Math.max(lo, iv[0]); hi = Math.min(hi, iv[1]);
      }
      return lo > hi ? null : Math.min(hi, Math.max(lo, d ?? Infinity));
    };
    let f = 1, d = tintaLa(C.y + dy);
    if (d === null) {
      let a = 0, b = 1;
      for (let i = 0; i < 12; i++) {
        const m = (a + b) / 2, dm = tintaLa(C.y + dy * m);
        if (dm === null) b = m; else { a = m; d = dm; }
      }
      if (d === null) return 0;
      f = a;
    }
    C.y += dy * f;
    this.target.copy(C).addScaledVector(_u, d);
    return dy * f;
  }

  /**
   * Un cadru al dronei, din buclă, înaintea lui `update()`: urcarea sau coborârea care încă
   * alunecă și, cât alunecă un pas de la tastatură, paza solului. `update()` adaugă țintei, și
   * camerei cu ea, `_panOffset` ori fracțiunea lui de amortizare și rotește camera în jurul
   * țintei cu `_sphericalDelta.theta` ori fracțiunea lui, deci locul în care ajunge camera se
   * știe dinainte:
   * - **mutarea**: urcarea care îi lipsește până la capătul ei intră în urcarea care alunecă,
   *   cu aceeași lege, deci pe o pantă obișnuită camera urcă odată cu mutarea. Partea din
   *   mutare care n-ar încăpea la cota de acum așteaptă cadrul următor (`_panAmanat`), nu se
   *   pierde. Dacă nu mai poate urca — tavanul din `_mutaVertical` —, drona stă în fața
   *   peretelui. Ridicată dintr-odată, cum era întâi, camera sărea până la 41 m într-un cadru
   *   (recenzia); scurtată fără amânare, mutarea se târa pe orice pantă;
   * - **rotirea** (Q, E): pe cercul ei în jurul țintei camera își păstrează cota, iar pe cerc
   *   relieful poate urca — recenzia o dusese la 61,7 m sub sol. Camera urcă pe loc la
   *   LIBER_SOL peste locul în care o duce cadrul; ridicarea mută ținta pe raza privirii,
   *   deci prezicerea se reface, de cel mult 12 ori. Dacă nu poate urca, rotirea se oprește.
   * @returns {boolean} true dacă a mișcat camera
   */
  pasVertical() {
    let mutat = false;
    const po = this._panOffset, am = this._panAmanat;
    const f = this.enableDamping ? this.dampingFactor : 1, C = this.object.position;
    const lipsa = (x, z) => this._solSub(x, C.y, z) + LIBER_SOL - C.y;
    if (this._pazaSol) {
      po.add(am);
      am.set(0, 0, 0);
      const nevoie = Math.max(lipsa(C.x + po.x, C.z + po.z), lipsa(C.x + po.x * f, C.z + po.z * f));
      if (nevoie > this._vertical) {
        if (!this._vertical) this._tVertical = null;
        this._vertical = nevoie;
      }
    }
    if (this._vertical) {
      const acum = performance.now();
      const dt = this._tVertical === null ? 1000 / 60 : Math.min(100, acum - this._tVertical);
      this._tVertical = acum;
      const rest = this._vertical;
      const dy = Math.abs(rest) < 1e-3 ? rest : rest * (1 - Math.exp(-dt / TAU_VERTICAL));
      const facut = this._mutaVertical(dy);
      // La o limită pasul a ieșit mai scurt: restul nu mai are unde merge.
      this._vertical = Math.abs(facut - dy) > 1e-9 || dy === rest ? 0 : rest - dy;
      if (!this._vertical) this._tVertical = null;
      mutat = facut !== 0;
    }
    if (this._pazaSol) {
      if (lipsa(C.x + po.x * f, C.z + po.z * f) > 1e-9) {
        if (!(this._vertical > 0)) {
          po.set(0, 0, 0);
          am.set(0, 0, 0);
        } else {
          // Cea mai lungă parte a mutării de pe cadrul acesta care încape la cota de acum. O
          // cameră deja prea jos se poate depărta: nu se cere mai mult decât are.
          const aici = Math.max(0, lipsa(C.x, C.z));
          let a = 0, b = 1;
          for (let i = 0; i < 14; i++) {
            const m = (a + b) / 2;
            if (lipsa(C.x + po.x * f * m, C.z + po.z * f * m) <= aici + 1e-6) a = m; else b = m;
          }
          am.copy(po).multiplyScalar(1 - a);
          po.multiplyScalar(a);
        }
      }
      if (this._sphericalDelta.theta && this._pazesteRotirea(f)) mutat = true;
      if (po.lengthSq() < 1e-8 && am.lengthSq() < 1e-8 && !this._vertical && Math.abs(this._sphericalDelta.theta) < 1e-6) {
        this._pazaSol = false;
      }
    }
    return mutat;
  }

  /** Rotirea de pe cadrul acesta (fracțiunea `f`), cu camera la LIBER_SOL peste locul în care ajunge. */
  _pazesteRotirea(f) {
    let mutat = false;
    const C = this.object.position, T = this.target, po = this._panOffset;
    for (let i = 0; i < 12; i++) {
      const th = this._sphericalDelta.theta * f, c = Math.cos(th), s = Math.sin(th);
      const ox = C.x - T.x, oz = C.z - T.z;
      const lipsa = this._solSub(T.x + po.x * f + ox * c + oz * s, C.y, T.z + po.z * f + oz * c - ox * s) + LIBER_SOL - C.y;
      if (!(lipsa > 1e-9)) break;
      const facut = this._mutaVertical(lipsa);
      if (facut) mutat = true;
      if (this._vertical > 0) this._vertical = Math.max(0, this._vertical - facut);
      if (facut < lipsa - 1e-6) {
        this._sphericalDelta.set(0, 0, 0);
        po.set(0, 0, 0);
        this._panAmanat.set(0, 0, 0);
        break;
      }
    }
    return mutat;
  }

  /** Golește urcarea rămasă, mutarea amânată și paza solului: un zbor, o tragere sau o rotire iau camera. */
  opresteVertical() {
    this._vertical = 0;
    this._tVertical = null;
    this._pazaSol = false;
    this._panAmanat.set(0, 0, 0);
  }

  /**
   * Oprește urcarea sau coborârea care încă alunecă, fără paza solului: Shift sau Ctrl s-au
   * dovedit taste de modificare (tastatura.js). Ce i-ar trebui mutării, paza pune la loc.
   */
  opresteUrcarea() {
    this._vertical = 0;
    this._tVertical = null;
  }

  /** Urcarea de `dy` metri: alunecă, sau pe loc fără amortizare (reduced-motion). */
  _adaugaVertical(dy, limita) {
    if (!this.enableDamping) {
      this.opresteUrcarea();
      this._mutaVertical(dy);
      return;
    }
    this._vertical = Math.max(-limita, Math.min(limita, this._vertical + dy));
    this._tVertical = null;
  }

  /**
   * Mutarea pe orizontală de la tastatură, ca `_pan`. Jos, drona urcă peste ce are în cale,
   * prin paza solului din `pasVertical`. Fără amortizare mutarea se face pe loc, la `update()`
   * din `comanda()`, deci și urcarea: o mutare spre un loc în care nu poate urca nu se face.
   * Nu coboară după relief: își păstrează înălțimea, ca o dronă.
   */
  _mutaOrizontal(dx, dy) {
    this._pazaSol = true;
    if (this.enableDamping) {
      this._pan(dx, dy);
      return;
    }
    _v.copy(this._panOffset);
    this._pan(dx, dy);
    _w.subVectors(this._panOffset, _v);
    const C = this.object.position;
    const lipsa = this._solSub(C.x + _w.x, C.y, C.z + _w.z) + LIBER_SOL - C.y;
    if (lipsa > 0 && this._mutaVertical(lipsa) < lipsa - 1e-6) this._panOffset.copy(_v);
  }

  /**
   * Un pas al hărții, de la tastatură (tastatura.js):
   * - `sus`, `jos`, `stanga`, `dreapta` mută harta pe orizontală cu PAS_MUTARE din
   *   înălțimea vederii la distanța țintei; `sus` duce înainte, pe direcția privirii;
   * - `roteste-dreapta` întoarce privirea spre dreapta cu 15° — citirea busolei crește cu
   *   15 —, ca o tragere spre dreapta cu butonul drept; `roteste-stanga`, invers;
   * - `urca` și `coboara`: drona, cu PAS_VERTICAL din înălțimea camerei peste ce e sub ea
   *   (`_mutaVertical`);
   * - `apropie` și `departeaza`: o treaptă de rotiță (×1,4), spre centrul vederii.
   *
   * Unghiul se dă direct: `keyRotateSpeed` al lui OrbitControls se împarte la înălțimea
   * canvasului. Înaintea rotirii ținta coboară pe ce se vede, ca la butonul drept
   * (`pivotPeTeren`): fără el, după șase clicuri de rotiță spre platou, șase rotiri
   * mutau punctul din centrul ecranului cu 534 px (verifica-controale). Limitele sunt cele
   * obișnuite: alpha (scena.js, la `change`), 80 m – 8 km, unghiurile polare. Emite
   * `start` și `end` cu starea NIMIC, ca rotița: un zbor în curs se oprește, iar fișa
   * știe că harta a fost atinsă. Cu amortizare pasul alunecă; sub reduced-motion, pe loc.
   *
   * @param {string} nume — una dintre COMENZI
   * @returns {boolean} false dacă n-a făcut nimic: comandă necunoscută, controale oprite
   *   (pagina mărită) sau canvas fără mărime
   */
  comanda(nume) {
    if (!this.enabled) return false;
    const h = this.domElement?.clientHeight;
    if (!(h > 0)) return false;
    this.object.updateMatrixWorld();
    const p = PAS_MUTARE * h;
    let pas;
    switch (nume) {
      case 'sus': pas = () => this._mutaOrizontal(0, p); break;
      case 'jos': pas = () => this._mutaOrizontal(0, -p); break;
      case 'stanga': pas = () => this._mutaOrizontal(p, 0); break;
      case 'dreapta': pas = () => this._mutaOrizontal(-p, 0); break;
      case 'roteste-dreapta': pas = () => { this.pivotPeTeren(); this._rotateLeft(UNGHI_PAS); this._pazaSol = true; }; break;
      case 'roteste-stanga': pas = () => { this.pivotPeTeren(); this._rotateLeft(-UNGHI_PAS); this._pazaSol = true; }; break;
      case 'urca':
      case 'coboara': {
        const C = this.object.position;
        const s = PAS_VERTICAL * Math.max(LIBER_SOL, C.y - this._solSub(C.x, C.y, C.z));
        pas = () => this._adaugaVertical(nume === 'urca' ? s : -s, COADA_VERTICAL * s);
        break;
      }
      case 'apropie':
      case 'departeaza': {
        const c = this.centruVederii();
        if (!c) return false;
        pas = () => this.rotita.treaptaTasta(nume === 'apropie' ? -1 : 1, c.x, c.y, rectDin(this.domElement));
        break;
      }
      default: return false;
    }
    // `start` și `end` numai fără un gest deschis: cu harta ținută de mouse sau de un deget,
    // `end`-ul tastei ar fi stins cursorul gestului și sfera pivotului (gest.js) în mijlocul
    // tragerii (recenzia). Zborul îl oprise deja `start`-ul gestului.
    const liber = this.state === STARE.NIMIC;
    if (liber) this.dispatchEvent({ type: 'start' });
    pas();
    // `update()`, chiar acum, aplică din mutare și din rotire cât aplică bucla pe un cadru —
    // fără amortizare, tot —, deci paza solului trece întâi, ca în buclă. Fără ea, fiecare pas
    // al unei taste ținute muta camera nepăzită cu 1–2 m: măsurat, 7,1 m peste sol.
    if (this._pazaSol) this.pasVertical();
    this.update();
    if (liber) this.dispatchEvent({ type: 'end' });
    return true;
  }

  /**
   * Ciupirea: zoom spre punctul dintre degete, cu raportul distanței dintre ele.
   * OrbitControls apropie spre țintă (`_updateZoomParameters` nu face nimic fără
   * `zoomToCursor`), deci locul dintre degete fugea.
   */
  _handleTouchMoveDolly(event) {
    const p = this._getSecondPointerPosition(event);
    const dist = Math.hypot(event.pageX - p.x, event.pageY - p.y);
    const ln = Math.log(this._dollyStart.y / dist);
    this._dollyStart.set(0, dist);
    if (!Number.isFinite(ln) || !ln) return;
    const sx = globalThis.scrollX ?? 0, sy = globalThis.scrollY ?? 0;
    this.rotita.imediat(ln, (event.pageX + p.x) / 2 - sx, (event.pageY + p.y) / 2 - sy, rectDin(this.domElement));
  }

  // `onMouseWheel` aplică întâi `_customWheelEvent`. Al lui OrbitControls înmulțea
  // liniile cu 16 și ciupirea cu 10; aici rămân cum vin, cu `deltaMode` alături, iar
  // rotita.js le citește pe fiecare în felul ei. `deltaMode` se citește întâi: Firefox
  // raportează în linii numai dacă e întrebat de mod înaintea lui `deltaY`.
  _customWheelEvent(event) {
    const deltaMode = event.deltaMode;
    return {
      clientX: event.clientX, clientY: event.clientY, deltaMode, deltaY: event.deltaY,
      ciupire: event.ctrlKey && !this._controlActive,
    };
  }

  _handleMouseWheel(event) {
    if (this.rotita.adauga(event, rectDin(this.domElement))) this.update();
  }

  dispose() {
    super.dispose();
    this.domElement?.removeEventListener?.('lostpointercapture', this._laCapturaPierduta);
    globalThis.removeEventListener?.('blur', this._laBlur);
    this._apucat = null;
    this.rotita.opreste();
    this.opresteVertical();
    // `disconnect()` scrie pe canvas `style.cursor = 'auto'` (OrbitControls.js:536):
    // la o repornire pe același canvas, cursorul inline ar bate cursoarele din CSS.
    this.domElement?.style?.removeProperty('cursor');
  }
}

export function creeazaCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(45, 1, NEAR, FAR);
  camera.position.fromArray(VEDERE_START.pozitie);

  const controale = new ControaleHarta(camera, canvas ?? null);
  controale.target.fromArray(VEDERE_START.tinta);
  controale.enableDamping = true;
  controale.dampingFactor = 0.08;
  controale.minDistance = DIST_MIN;
  controale.maxDistance = DIST_MAX;
  // Oprim camera deasupra orizontalei: de sub apă scena nu are ce arăta.
  controale.maxPolarAngle = Math.PI / 2 - 0.04;
  controale.minPolarAngle = 0.15;
  controale.update();

  return { camera, controale };
}

// Peste cât e pagina mărită: o scară de repaus poate ieși 1,0000001, nu 1.
export const PRAG_MARIRE = 1.01;

/**
 * Pagina mărită cu degetele dă harta înapoi paginii, până la micșorare.
 *
 * Canvasul acoperă tot ecranul, iar OrbitControls îi scrie `touch-action: none`
 * (OrbitControls.js:508). Pagina se poate mări pe textul fișei sau pe fundalul modalei
 * „© DGT”, unde ciupirea e a ei; după închiderea lor, sub degete rămânea numai harta: un
 * deget o muta, două o apropiau, iar pagina nu se mai micșora. Busola, Satelit și
 * „Coordonate” sunt fixe, deci puteau rămâne și ele în afara zonei mărite.
 *
 * Cât `visualViewport.scale` trece de PRAG_MARIRE, canvasul ia `touch-action:
 * manipulation` — mutarea și ciupirea paginii; după specificație, sinonimul lui `pan-x
 * pan-y pinch-zoom`, pe care Safari îl știe de la iOS 13 —, iar controalele se opresc:
 * oprite, nu pornesc nimic la apăsare (OrbitControls.js:1555) și nu mai opresc rotița,
 * deci și ciupirea pe touchpad micșorează pagina. O atingere scurtă măsoară mai departe
 * (punct.js). Pe desktop, o mărire cu touchpadul oprește și mouse-ul pe hartă, până la
 * micșorare. touch-action se citește la începutul atingerii, deci schimbarea contează de
 * la gestul următor.
 *
 * Starea se citește și la creare, nu numai la `resize`: pagina poate porni mărită —
 * scara restaurată la reîncărcare sau din bfcache.
 *
 * @returns {() => void} scoate ascultătorul
 */
export function urmaresteMarireaPaginii(controale, vv = globalThis.visualViewport) {
  const el = controale.domElement;
  if (!vv?.addEventListener || !el?.style) return () => {};
  const aplica = () => {
    const marita = vv.scale > PRAG_MARIRE;
    el.style.touchAction = marita ? 'manipulation' : 'none';
    controale.enabled = !marita;
  };
  aplica();
  vv.addEventListener('resize', aplica);
  return () => vv.removeEventListener('resize', aplica);
}

/**
 * Golește inerția rămasă de la utilizator, APLICÂND-O întâi.
 *
 * `update()` nu citește doar poziția camerei, ci îi adaugă acumulatorul privat
 * `_sphericalDelta` (OrbitControls.js:717). Cu amortizare pornită el nu se
 * golește niciodată, doar se stinge; singura ramură care îl golește e cea fără
 * amortizare (:808), care îl și adaugă întreg înainte. Un zbor care n-ar trece
 * pe aici ar ateriza alături de țintă cu cât mai rămăsese de aplicat — pe calea
 * `prefers-reduced-motion`, măsurat, 0,8° din 10°. Vezi zbor.js.
 *
 * Treptele rotiței și urcarea dronei care încă alunecă se golesc și ele: altfel ar
 * împinge camera peste zbor, de la primul cadru.
 */
export function descarcaInertia(controale) {
  controale.rotita?.opreste();
  controale.opresteVertical?.();
  const amortiza = controale.enableDamping;
  controale.enableDamping = false;
  controale.update();
  controale.enableDamping = amortiza;
}
