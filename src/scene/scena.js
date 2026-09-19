import * as THREE from 'three';
import { creeazaRenderer, redimensioneaza } from './renderer.js';
import { creeazaCamera, incadreazaLaAspect } from './camera.js';
import { creeazaLumini } from './lights.js';
import { creeazaTeren, inPoligon } from './terrain.js';
import { creeazaMare } from './mare.js';
import { incarcaRelief } from './loaders.js';
import { paletaCurenta } from './palette.js';
import { instantaneuMemorie } from './dispose.js';

// Orchestrarea scenei și randarea la cerere.
//
// Scena e statică între interacțiuni: nu are rost să randăm 60 de cadre pe
// secundă cu același conținut. Randăm când se schimbă ceva — controale, mărime,
// capitol. Bucla rulează prin setAnimationLoop, dar decide de fiecare dată dacă
// are ce desena; asta ține și amortizarea controalelor lină.

/** @param {HTMLCanvasElement} canvas */
export async function porneste(canvas) {
  const renderer = creeazaRenderer(canvas);
  if (!renderer) return null;

  const paleta = paletaCurenta();
  const scena = new THREE.Scene();
  scena.background = new THREE.Color(paleta.cer);
  // Ceața topește marginea îndepărtată a planului mării înainte să se vadă că se
  // termină. Scalată pentru zona de ~3 km: cel mai depărtat colț de uscat e la
  // ~3,5 km de cameră, deci ceața începe abia după el — altfel platoul s-ar
  // decolora în culoarea cerului și ar părea că se topește.
  scena.fog = new THREE.Fog(paleta.cer, 5000, 24000);

  const { camera, controale } = creeazaCamera(canvas);
  const lumini = creeazaLumini(paleta);
  scena.add(lumini.obiect);

  const mare = creeazaMare(paleta);
  scena.add(mare.obiect);

  const incarcat = await incarcaRelief();

  // Fișierul cerut poate fi un petic de rezoluție mai mare, care își aduce baza
  // cu el. Terenul principal rămâne baza; peticul e o a doua plasă, așezată în
  // gaura lăsată de ea. Două plase, nu una cu densitate variabilă: o singură
  // grilă are un singur pas, prin definiție.
  const relief = incarcat.baza ?? incarcat;
  const reliefPetic = incarcat.baza ? incarcat : null;

  // Datele extrase pentru o zonă aleasă poartă poligonul cu ele. Plasa se
  // generează numai înăuntrul lui: cutia dreptunghiulară din care e decupată
  // are cu 74% mai multe celule, aproape toate apă.
  const poligonDate = relief.meta?.poligon_scena;
  const limitaDatelor = Array.isArray(poligonDate) && poligonDate.length >= 3
    ? poligonDate
    : null;

  // Gaura din bază: exact dreptunghiul peticului. Marginile lui sunt noduri ale
  // bazei, deci cele două plase se termină pe aceeași linie.
  const g = reliefPetic?.meta?.gaura_scena;
  const subPetic = g
    ? (x, z) => x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1
    : null;

  // Masca bazei: înăuntrul conturului cu care a fost extrasă harta și în afara
  // găurii. Se calculează o singură dată — nimic nu o mai schimbă după pornire.
  const pastreaza = (limitaDatelor || subPetic)
    ? (x, z) => (!limitaDatelor || inPoligon(x, z, limitaDatelor)) &&
                !(subPetic && subPetic(x, z))
    : undefined;

  const teren = creeazaTeren(relief, { pastreaza });
  scena.add(teren.obiect);

  const petic = reliefPetic
    ? creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena })
    : null;
  if (petic) scena.add(petic.obiect);

  let cerut = true;
  const cereRandare = () => { cerut = true; };

  // Cât timp utilizatorul nu a atins camera, încadrarea e a noastră și se
  // reașază la fiecare schimbare de formă a ecranului. La prima lui mișcare,
  // încadrarea devine a lui și nu i-o mai luăm.
  let incadrareAutomata = true;
  controale.addEventListener('start', () => { incadrareAutomata = false; });

  controale.addEventListener('change', cereRandare);
  const laResize = () => cereRandare();
  globalThis.addEventListener('resize', laResize);

  // Amortizarea e mișcare care continuă după ce utilizatorul a dat drumul —
  // exact ce cere prefers-reduced-motion să nu se întâmple.
  const faraMiscare = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const aplicaMiscare = () => {
    controale.enableDamping = !(faraMiscare?.matches ?? false);
    cereRandare();
  };
  aplicaMiscare();
  faraMiscare?.addEventListener?.('change', aplicaMiscare);

  renderer.setAnimationLoop(() => {
    const seMisca = controale.enableDamping && controale.update();
    if (redimensioneaza(renderer)) {
      const c = renderer.domElement;
      camera.aspect = c.clientWidth / c.clientHeight;
      camera.updateProjectionMatrix();
      if (incadrareAutomata) incadreazaLaAspect(camera, controale, camera.aspect);
      cerut = true;
    }
    if (!cerut && !seMisca) return;
    cerut = false;
    renderer.render(scena, camera);
  });

  return {
    renderer, scena, camera, controale, relief, teren, petic,
    nrTriunghiuri: teren.nrTriunghiuri + (petic?.nrTriunghiuri ?? 0),
    // Peticul e mai fin, deci acolo unde există el dă altitudinea; baza n-are
    // nicio valoare sub gaură. Nimic nu-l cheamă acum, dar e accesorul firesc
    // pentru așezarea unui reper pe teren, la capitolele care urmează.
    inaltimeLa: (x, z) =>
      (petic && subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z)),
    cereRandare,
    memorie: () => instantaneuMemorie(renderer),
    dispose() {
      renderer.setAnimationLoop(null);
      controale.removeEventListener('change', cereRandare);
      globalThis.removeEventListener('resize', laResize);
      faraMiscare?.removeEventListener?.('change', aplicaMiscare);
      teren.dispose();
      petic?.dispose();
      mare.dispose();
      lumini.dispose();
      controale.dispose();
      renderer.dispose();
    },
  };
}
