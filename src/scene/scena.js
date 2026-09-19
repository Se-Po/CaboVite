import * as THREE from 'three';
import { creeazaRenderer, redimensioneaza } from './renderer.js';
import { creeazaCamera, incadreazaLaAspect } from './camera.js';
import { creeazaLumini } from './lights.js';
import { creeazaTeren } from './terrain.js';
import { creeazaMare } from './mare.js';
import { incarcaRelief } from './loaders.js';
import { paletaCurenta } from './palette.js';
import { instantaneuMemorie } from './dispose.js';
import { creeazaSelectie, inPoligon } from './selectie.js';

// Orchestrarea scenei și randarea la cerere.
//
// Scena e statică între interacțiuni: nu are rost să randăm 60 de cadre pe
// secundă cu același conținut. Randăm când se schimbă ceva — controale, mărime,
// capitol. Bucla rulează prin setAnimationLoop, dar decide de fiecare dată dacă
// are ce desena; asta ține și amortizarea controalelor lină.

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{laSelectie?: (stare: object) => void}} optiuni
 *   `laSelectie` primește starea selectorului de poligon la fiecare schimbare.
 *   Scena nu știe nimic despre butoane sau DOM; interfața se leagă în main.js.
 */
export async function porneste(canvas, { laSelectie } = {}) {
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

  const relief = await incarcaRelief();

  // Datele extrase pentru o zonă aleasă poartă poligonul cu ele. Plasa se
  // generează numai înăuntrul lui: cutia dreptunghiulară din care e decupată
  // are cu 74% mai multe celule, aproape toate apă.
  const poligonDate = relief.meta?.poligon_scena;
  const limitaDatelor = Array.isArray(poligonDate) && poligonDate.length >= 3
    ? poligonDate
    : null;

  const masca = (puncte) => (puncte ? { pastreaza: (x, z) => inPoligon(x, z, puncte) } : {});

  let teren = creeazaTeren(relief, masca(limitaDatelor));
  scena.add(teren.obiect);

  let cerut = true;
  const cereRandare = () => { cerut = true; };

  /**
   * Reconstruiește terenul păstrând numai celulele din poligon.
   *
   * Remeshuire, nu ascundere. Cu `null` se revine la limita datelor — poligonul
   * pentru care a fost extras fișierul, dacă există — nu la dreptunghiul întreg:
   * în afara lui datele sunt apă umplută, nu relief măsurat.
   *
   * Terenul vechi se eliberează întâi; altfel fiecare selecție ar lăsa o
   * geometrie pe placă, iar zece contururi ar scurge zece geometrii.
   */
  function aplicaMasca(puncte) {
    const alese = puncte && puncte.length >= 3 ? puncte : limitaDatelor;
    teren.dispose();
    teren = creeazaTeren(relief, masca(alese));
    scena.add(teren.obiect);
    cereRandare();
    return teren;
  }

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

  const selectie = creeazaSelectie({
    canvas, camera, controale, scena, meta: relief.meta,
    terenObiect: () => teren.obiect,
    inaltimeLa: (x, z) => teren.inaltimeLa(x, z),
    aplica: aplicaMasca,
    // Datele extrase poartă deja un contur; „Arată tot" revine la el, nu la
    // dreptunghiul din care a fost decupat. Panoul trebuie s-o poată spune.
    areLimitaProprie: !!limitaDatelor,
    laSchimbare: (stare) => laSelectie?.(stare),
    cereRandare,
  });
  selectie.seteazaNrTriunghiuri(teren.nrTriunghiuri);
  selectie.incarca(); // o selecție salvată se reaplică la reîncărcare

  return {
    renderer, scena, camera, controale, relief, selectie,
    // Terenul se înlocuiește la fiecare selecție, deci se citește prin getter:
    // o referință prinsă la pornire ar rămâne la plasa dinainte de tăiere.
    get teren() { return teren; },
    cereRandare,
    memorie: () => instantaneuMemorie(renderer),
    dispose() {
      renderer.setAnimationLoop(null);
      controale.removeEventListener('change', cereRandare);
      globalThis.removeEventListener('resize', laResize);
      faraMiscare?.removeEventListener?.('change', aplicaMiscare);
      selectie.dispose();
      teren.dispose();
      mare.dispose();
      lumini.dispose();
      controale.dispose();
      renderer.dispose();
    },
  };
}
