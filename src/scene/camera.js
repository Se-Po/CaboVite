import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Camera și controalele.
//
// Pornirea e o vedere aleasă de autor pe pagină: dinspre mare, din nord-vest,
// peste faleze, cu sanctuarul sus și farul în dreapta. Clicul pe busolă o reface.

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

export function creeazaCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(45, 1, NEAR, FAR);
  camera.position.fromArray(VEDERE_START.pozitie);

  const controale = new OrbitControls(camera, canvas);
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

/**
 * Golește inerția rămasă de la utilizator, APLICÂND-O întâi.
 *
 * `update()` nu citește doar poziția camerei, ci îi adaugă acumulatorul privat
 * `_sphericalDelta` (OrbitControls.js:717). Cu amortizare pornită el nu se
 * golește niciodată, doar se stinge; singura ramură care îl golește e cea fără
 * amortizare (:808), care îl și adaugă întreg înainte. Un zbor care n-ar trece
 * pe aici ar ateriza alături de țintă cu cât mai rămăsese de aplicat — pe calea
 * `prefers-reduced-motion`, măsurat, 0,8° din 10°. Vezi zbor.js.
 */
export function descarcaInertia(controale) {
  const amortiza = controale.enableDamping;
  controale.enableDamping = false;
  controale.update();
  controale.enableDamping = amortiza;
}
