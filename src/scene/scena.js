import * as THREE from 'three';
import { creeazaRenderer, redimensioneaza } from './renderer.js';
import { creeazaCamera, incadreazaLaAspect } from './camera.js';
import { creeazaLumini } from './lights.js';
import { creeazaTeren, inPoligon } from './terrain.js';
import { creeazaMare } from './mare.js';
import { incarcaRelief } from './loaders.js';
import { incarcaPaleta, paletaCurenta } from './palette.js';
import { creeazaGeo } from './geo.js';
import { creeazaSelectie3d } from './selectie3d.js';
import { instantaneuMemorie } from './dispose.js';

// Orchestrarea scenei și randarea la cerere.
//
// Scena e statică între interacțiuni: nu are rost să randăm 60 de cadre pe
// secundă cu același conținut. Randăm când se schimbă ceva — controale, mărime,
// capitol. Bucla rulează prin setAnimationLoop, dar decide de fiecare dată dacă
// are ce desena; asta ține și amortizarea controalelor lină.

/** @param {HTMLCanvasElement} canvas */
export async function porneste(canvas, laSelectie) {
  const renderer = creeazaRenderer(canvas);
  if (!renderer) return null;

  // Tot ce se alocă de aici încolo se înscrie aici, în ordinea creării.
  //
  // Pornirea poate eșua în mai multe locuri, nu doar la încărcarea reliefului:
  // `creeazaTeren()` alocă tablouri proporționale cu grila — ~250 MB pentru baza
  // de 1164 × 1493 — iar un RangeError acolo e plauzibil tocmai pe telefonul de
  // 390 px. `main.js` prinde excepția și scoate canvasul, dar scoaterea din DOM
  // nu eliberează nimic: contextul WebGL rămâne viu până îl adună browserul, iar
  // browserele țin puține contexte deodată. Deci curățăm noi, oriunde s-ar rupe.
  const deEliberat = [];
  const curata = () => {
    // Fiecare eliberare în try-ul ei: dacă una ar arunca, ar ascunde excepția
    // adevărată, iar mesajul care ajunge la utilizator ar fi despre altceva.
    for (const f of deEliberat.reverse()) {
      try { f(); } catch (x) { console.warn('eliberare eșuată la pornire:', x.message); }
    }
    deEliberat.length = 0;
  };

  try {
    return await construieste(canvas, renderer, deEliberat, curata, laSelectie);
  } catch (e) {
    curata();
    renderer.dispose();
    // Numai pe calea asta. `dispose()` nu dă drumul contextului, iar aici
    // canvasul e abandonat — `main.js` îl scoate din pagină — deci contextul n-are
    // de ce să mai trăiască. Pe calea normală de `dispose()` NU se cheamă, anume:
    // după `loseContext()` același element canvas nu mai poate servi un renderer
    // nou, iar acolo vrem să putem reporni scena pe același canvas.
    renderer.forceContextLoss();
    throw e;
  }
}

async function construieste(canvas, renderer, deEliberat, curata, laSelectie) {
  // Culorile măsurate trebuie să fie acolo înainte să se genereze plasa: culoarea
  // fiecărei fațete se coace în atributul de vârf, o singură dată, la construcție.
  // Dacă ar veni după, ar trebui regenerată toată geometria ca să se vadă.
  await incarcaPaleta();

  const paleta = paletaCurenta();
  const scena = new THREE.Scene();
  scena.background = new THREE.Color(paleta.cer);
  // Ceața topește marginea îndepărtată a planului mării înainte să se vadă că se
  // termină. Scalată pentru zona de ~3 km: cel mai depărtat colț de uscat e la
  // ~3,5 km de cameră, deci ceața începe abia după el — altfel platoul s-ar
  // decolora în culoarea cerului și ar părea că se topește.
  scena.fog = new THREE.Fog(paleta.cer, 5000, 24000);

  const { camera, controale } = creeazaCamera(canvas);
  deEliberat.push(() => controale.dispose());

  const lumini = creeazaLumini(paleta);
  scena.add(lumini.obiect);
  deEliberat.push(() => lumini.dispose());

  const mare = creeazaMare(paleta);
  scena.add(mare.obiect);
  deEliberat.push(() => mare.dispose());

  // Aruncă la HTTP eșuat sau la fișier trunchiat — verificate amândouă în loaders.js.
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

  // Banda de altitudine poate veni gata scrisă în sidecar, ca și poligonul.
  // Datele rămân un DEM întreg — banda taie la randare, nu în fișier — deci e
  // reversibilă și harta rămâne validă pentru orice alt folos.
  const bandaDate = relief.meta?.banda_altitudine;

  // Cutia curentă. Se umple mai jos, DIN selector: el e singura sursă de adevăr,
  // ca panoul să nu scrie „toată harta" în timp ce terenul e tăiat pe verticală.
  let cutie = null;

  let cerut = true;
  const cereRandare = () => { cerut = true; };

  /** Testul cutiei. `y` e înălțimea în centrul celulei. */
  const inCutie = (x, z, y) => !cutie || (
    x >= cutie.xMin && x <= cutie.xMax &&
    z >= cutie.zMin && z <= cutie.zMax &&
    y >= cutie.yMin && y <= cutie.yMax);

  /**
   * Măștile celor două plase — și nu sunt aceeași.
   *
   * Baza se taie după conturul hărții, după gaura de sub petic și după cutie.
   * Peticul se taie NUMAI după cutie: masca bazei cere `!subPetic`, iar peticul
   * stă în întregime înăuntrul acelui dreptunghi, deci aplicată lui l-ar șterge
   * cu totul. Două plase, două măști.
   *
   * Testul pe verticală aruncă celule întregi, deci marginea urmează curbele de
   * nivel — terenul e o pânză, n-are interior de tăiat.
   */
  const mascaBaza = () => (limitaDatelor || subPetic || cutie)
    ? (x, z, y) => (!limitaDatelor || inPoligon(x, z, limitaDatelor)) &&
                   !(subPetic && subPetic(x, z)) && inCutie(x, z, y)
    : undefined;
  const mascaPetic = () => (cutie ? inCutie : undefined);

  // Un singur material pentru amândouă plasele, creat o dată.
  //
  // Dacă l-ar face `creeazaTeren()` de fiecare dată, regenerarea ar elibera
  // materialul vechi — ducând `usedTimes` la zero și ștergând programul din
  // cache — ca să ceară imediat altul identic: o recompilare de shader la
  // fiecare selecție aplicată. Injectat, `terrain.js` nu-l mai eliberează
  // (`materialPropriu`), deci îl eliberăm noi.
  const materialTeren = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0,
  });
  deEliberat.push(() => materialTeren.dispose());

  let teren = null, petic = null;
  // Citesc variabilele la apel, nu la înregistrare: după o regenerare, se
  // eliberează plasa curentă, nu cea moartă.
  deEliberat.push(() => teren?.dispose());
  deEliberat.push(() => petic?.dispose());

  function regenereaza() {
    // Eliberăm înainte să construim, ca să nu ținem două plase deodată: la
    // 1164 × 1493 ar însemna un vârf de o jumătate de gigaoctet. Prețul e că, la
    // o excepție, scena rămâne goală — deci o prindem aici și o spunem, în loc
    // s-o lăsăm să plece dintr-un ascultător de `pointerup`, unde n-o prinde nimeni.
    teren?.dispose();
    petic?.dispose();
    teren = null;
    petic = null;
    try {
      teren = creeazaTeren(relief, { pastreaza: mascaBaza(), paleta, material: materialTeren });
      scena.add(teren.obiect);
      if (reliefPetic) {
        petic = creeazaTeren(reliefPetic, {
          deplasare: reliefPetic.meta.deplasare_scena,
          paleta,
          pastreaza: mascaPetic(),
          material: materialTeren,
        });
        scena.add(petic.obiect);
      }
    } catch (e) {
      console.error('terenul nu s-a putut genera:', e.message);
      cereRandare();
      return { nrTriunghiuri: 0, eroare: e.message };
    }
    cereRandare();
    return { nrTriunghiuri: teren.nrTriunghiuri + (petic?.nrTriunghiuri ?? 0) };
  }

  // Conversiile se fac pe metadatele BAZEI, nu ale peticului: scena e centrată pe
  // ea, iar peticul e doar o plasă mai fină așezată înăuntru. Tot de acolo vin și
  // `colturi_geo`, pe care peticul nici nu le are.
  const geo = creeazaGeo(relief.meta);

  const selectie = creeazaSelectie3d({
    canvas, camera, controale, scena, geo,
    terenObiect: () => teren?.obiect,   // se schimbă la fiecare regenerare
    inaltimeLa: (x, z) => teren?.inaltimeLa(x, z) ?? 0,
    aplica(noua) { cutie = noua; return regenereaza(); },
    laSchimbare: laSelectie,
    cereRandare,
    // Banda din sidecar intră prin selector, nu pe lângă el.
    cutieInitiala: bandaDate
      ? { xMin: -Infinity, xMax: Infinity, zMin: -Infinity, zMax: Infinity,
          yMin: bandaDate.min, yMax: bandaDate.max }
      : null,
  });
  deEliberat.push(() => selectie.dispose());

  // O selecție salvată se aplică la reîncărcare: asta înseamnă „folosesc numai
  // acea selecție". Panoul arată limpede că e una activă, cu un buton de golit.
  //
  // Se citește ÎNAINTE de prima construcție: altfel terenul s-ar genera o dată
  // întreg și imediat a doua oară tăiat, cu un vârf dublu de memorie tocmai pe
  // calea cea mai fragilă.
  selectie.incarca();
  cutie = selectie.cutieCurenta();
  regenereaza();
  selectie.seteazaNrTriunghiuri((teren?.nrTriunghiuri ?? 0) + (petic?.nrTriunghiuri ?? 0));

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

  // Relieful se dă printr-un getter care se stinge la dispose().
  //
  // `terrain.js` își pune anume `grila = null` când se eliberează, dar tabloul de
  // înălțimi trăiește și aici, iar `main.js` ține obiectul în `globalThis.__scena`
  // pentru totdeauna. Fără stingerea asta, cele 2,1 milioane de valori — bază plus
  // petic, ~8,4 MB — ar rămâne vii după dispose() și ar anula intenția de acolo.
  // Nu e memorie GPU, dar e memorie.
  let viu = true;

  return {
    renderer, scena, camera, controale, selectie, geo,
    get relief() { return viu ? relief : null; },
    // Plasele se înlocuiesc la fiecare selecție, deci se dau prin gettere:
    // o proprietate fixată la pornire ar rămâne la plasa moartă.
    get teren() { return teren; },
    get petic() { return petic; },
    get nrTriunghiuri() { return (teren?.nrTriunghiuri ?? 0) + (petic?.nrTriunghiuri ?? 0); },
    // Peticul e mai fin, deci acolo unde există el dă altitudinea; baza n-are
    // nicio valoare sub gaură. Nimic nu-l cheamă acum, dar e accesorul firesc
    // pentru așezarea unui reper pe teren, la capitolele care urmează.
    inaltimeLa: (x, z) =>
      (petic && subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z)),
    cereRandare,
    memorie: () => instantaneuMemorie(renderer),
    dispose() {
      viu = false;
      renderer.setAnimationLoop(null);
      controale.removeEventListener('change', cereRandare);
      globalThis.removeEventListener('resize', laResize);
      faraMiscare?.removeEventListener?.('change', aplicaMiscare);
      // Aceeași listă ca la eșecul pornirii, nu o copie scrisă de mână.
      //
      // Înainte, `dispose()` înșira resursele pe de rost — și sărise peste
      // selector: trei geometrii rămase vii, patru ascultători de pointer încă
      // pe canvas, iar o tragere de după `dispose()` reconstruia 250 MB de plase
      // într-o scenă moartă, cu un renderer deja eliberat. Cu o singură listă,
      // orice resursă adăugată de acum încolo se eliberează pe amândouă căile
      // fără să-și mai amintească nimeni de ea. `curata()` e idempotent.
      curata();
      renderer.dispose();
      // Aici NU se cheamă `forceContextLoss()`, spre deosebire de calea de eroare
      // din `porneste()`. După `loseContext()` același element canvas nu mai poate
      // sluji un renderer nou, iar de aici scena trebuie să se poată reporni pe
      // canvasul existent — la schimbarea de capitol, de pildă. Contextul rămâne
      // deci viu intenționat, nu din scăpare.
    },
  };
}
