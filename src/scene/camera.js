import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Camera și controalele.
//
// Încadrarea pornește de la fotografia de referință: privire dinspre mare, din
// sud-vest, de la vreo 40° deasupra orizontului.

// Camera stă la kilometri de subiect, deci near poate fi generos: ridicat de la
// 1 la 10 m, raportul near/far scade de zece ori și cu el riscul de z-fighting
// pe planul mării. Nimic nu se apropie de cameră sub 400 m (DIST_MIN).
export const NEAR = 10;
export const FAR = 60000;

// Azimut geografic: 0 = nord, 90 = est. În scenă nordul e −Z și estul +X, deci
// conversia cere z = −rază·cos(az). Fără minus, 214° ajunge la nord-vest în loc
// de sud-vest — exact greșeala care întorcea promontoriul cu spatele.
//
// Promontoriul întreg, privit dinspre mare, din sud-vest: direcția fotografiei
// de referință.
//
// DIST și TINTA nu sunt alese din ochi. Le rezolv numeric în browser: proiectez
// celulele de uscat pe ecran, măsor cutia lor, și caut perechea (țintă,
// distanță) pentru care uscatul umple 80% din cadru și stă centrat, la raportul
// de referință 1,5. Pe harta de 30 m, prima încercare aleasă „logic" — ținta în
// centrul uscatului — tăia 64 de celule sub marginea de jos, adică exact vârful
// capului, cel care iese spre cameră. Nu s-ar fi văzut într-un screenshot.
//
// Valorile de acum sunt pentru zona selectată: 2326 × 2984 m la 2 m.
const DIST = 1610, ELEVATIE = 36, AZIMUT = 214;

// Fațetele au 2 m, deci se poate intra mult mai aproape fără ca terenul să se
// destrame; sub ~80 m camera ajunge în interiorul reliefului. Limita de sus
// trebuie să depășească DIST × 3,2 — factorul maxim din incadreazaLaAspect() —
// altfel încadrarea pe ecran îngust se blochează tăcut la plafon și zona rămâne
// tăiată.
export const DIST_MIN = 80;
export const DIST_MAX = 8000;

// Ținta: nu centrul grilei, ci punctul care centrează uscatul PE ECRAN —
// altceva, pentru că privirea e oblică și vârful capului, ieșit spre cameră,
// ocupă mult mai mult cadru decât suprafața lui. Rezultatul rezolvării de mai sus.
//
// Înălțimea o țin la 60 m, cota platoului, deși optimizarea liberă cobora ținta
// sub nivelul mării. Ținta e și pivotul OrbitControls: sub apă, limita
// maxPolarAngle ar fi lăsat camera să coboare sub linia de plutire.
export const TINTA = new THREE.Vector3(144, 60, 581);

export function creeazaCamera(canvas, tinta = TINTA.clone()) {
  const camera = new THREE.PerspectiveCamera(45, 1, NEAR, FAR);

  const el = (ELEVATIE * Math.PI) / 180;
  const az = (AZIMUT * Math.PI) / 180;
  const raza = DIST * Math.cos(el);
  camera.position.set(
    tinta.x + raza * Math.sin(az),
    tinta.y + DIST * Math.sin(el),
    tinta.z - raza * Math.cos(az)
  );
  camera.lookAt(tinta);

  const controale = new OrbitControls(camera, canvas);
  controale.target.copy(tinta);
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
 * Reîncadrează promontoriul după forma ecranului.
 *
 * Camera are unghi de deschidere vertical fix, deci pe un ecran îngust vede mai
 * puțin pe orizontală și promontoriul iese din cadru — la 390 px era tăiat pe
 * ambele laturi. Compensăm dând camera înapoi, păstrând direcția de privire.
 *
 * Se aplică doar cât timp utilizatorul nu a mișcat singur camera: după aceea
 * încadrarea e a lui, nu a noastră.
 */
export function incadreazaLaAspect(camera, controale, aspect) {
  const referinta = 1.5; // aspectul pentru care e aleasă DIST
  const factor = Math.min(3.2, Math.max(1, referinta / Math.max(aspect, 0.2)));
  const dorita = Math.min(DIST_MAX, DIST * factor);
  const directie = camera.position.clone().sub(controale.target).normalize();
  camera.position.copy(controale.target).addScaledVector(directie, dorita);
  controale.update();
}
