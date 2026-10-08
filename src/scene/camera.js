import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { creeazaRotita } from './rotita.js';
import { punctVazut } from './raza.js';

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

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _raza = new THREE.Ray();
const _q = new THREE.Vector3();
const _u = new THREE.Vector3();
const rectDin = (el) => el?.getBoundingClientRect?.() ?? null;

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
 *   harta ținută, la pierderea capturii pointerului și la pierderea focusului ferestrei.
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
    // O tragere sau o rotire iau camera: treptele rămase nu mai alunecă peste ea.
    // Rotița emite și ea `start`, dar cu starea NIMIC.
    this.addEventListener('start', () => { if (this.state !== STARE.NIMIC) this.rotita.opreste(); });
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
 * Treptele rotiței care încă alunecă se golesc și ele: altfel ar împinge camera
 * peste zbor, de la primul cadru.
 */
export function descarcaInertia(controale) {
  controale.rotita?.opreste();
  const amortiza = controale.enableDamping;
  controale.enableDamping = false;
  controale.update();
  controale.enableDamping = amortiza;
}
