import * as THREE from 'three';
import { creeazaRenderer, redimensioneaza } from './renderer.js';
import { creeazaCamera, incadreazaLaAspect } from './camera.js';
import { creeazaLumini } from './lights.js';
import { creeazaTeren, mascaBazei } from './terrain.js';
import { creeazaMare } from './mare.js';
import { incarcaRelief, straturiNdvi } from './loaders.js';
import { creeazaLegenda, culoarePrevizualizare, modPrevizualizare } from './previzualizare.js';
import { atribuirePaleta, incarcaPaleta, paletaCurenta, terenMasurat } from './palette.js';
import { creeazaBusola } from './busola.js';
import { creeazaGeo } from './geo.js';
import { creeazaPunct } from './punct.js';
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

  // Tot ce se alocă de aici încolo se înscrie aici, în ordinea creării.
  //
  // Pornirea poate eșua în mai multe locuri, nu doar la încărcarea reliefului:
  // `creeazaTeren()` alocă tablouri proporționale cu grila — ~48 MB pentru baza
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
    return await construieste(canvas, renderer, deEliberat, curata);
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

async function construieste(canvas, renderer, deEliberat, curata) {
  // Relieful pleacă ACUM, înaintea așteptării de mai jos.
  //
  // Paleta măsurată e un JSON de 6,5 KB; relieful, cu straturile NDVI, e 5,29 MB
  // în opt fișiere. N-au
  // nimic de împărțit, dar stăteau în serie: un dus-întors întreg, 50–200 ms pe
  // mobil, doar ca să aștepte cine vine primul.
  //
  // `catch`-ul gol nu înghite nimic: marchează promisiunea ca tratată, ca o
  // respingere sosită în fereastra de până la `await` să nu iasă ca
  // `unhandledrejection`. Tratarea adevărată e mai jos, la `await`, de unde
  // excepția urcă în `porneste()` ca înainte.
  const reliefGata = incarcaRelief();
  reliefGata.catch(() => {});

  // Culorile măsurate trebuie să fie acolo înainte să se genereze plasa: culoarea
  // fiecărei fațete se coace în atributul de vârf, o singură dată, la construcție.
  // Dacă ar veni după, ar trebui regenerată toată geometria ca să se vadă. Deci
  // se așteaptă aici — dar acum așteptarea se suprapune peste descărcarea hărții,
  // nu stă înaintea ei.
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
  const incarcat = await reliefGata;

  // Fișierul cerut poate fi un petic de rezoluție mai mare, care își aduce baza
  // cu el. Terenul principal rămâne baza; peticul e o a doua plasă, așezată în
  // gaura lăsată de ea. Două plase, nu una cu densitate variabilă: o singură
  // grilă are un singur pas, prin definiție.
  // `let`, nu `const`: getterul de mai jos îl captează, iar obiectul întors
  // trăiește în `globalThis.__scena` pe vecie. Fără să poată fi golit, `viu = false`
  // ar ascunde doar referința, nu ar stinge-o — cei 6,63 MiB ai bazei ar rămâne
  // vii după dispose(), exact ce spunea comentariul de jos că NU se întâmplă.
  let relief = incarcat.baza ?? incarcat;
  const reliefPetic = incarcat.baza ? incarcat : null;

  // Masca bazei — conturul hărții, minus gaura de sub petic. Stă în terrain.js,
  // cu motivele ei, ca unealta de verificare să construiască aceeași plasă.
  // Peticul NU o primește; vezi acolo de ce.
  const { limitaDatelor, subPetic, pastreaza } = mascaBazei(relief, reliefPetic);

  let cerut = true;
  const cereRandare = () => { cerut = true; };

  // Straturile NDVI, totul sau nimic, desprinse de pe relief ca să nu rămână vii
  // după coacerea culorii. `let`, și golit după ce ambele plase s-au construit.
  let ndvi = straturiNdvi(relief, reliefPetic);

  // `?previzualizare=ndvi` pictează datele din care se face culoarea, nu culoarea.
  // Cu o scară vădit nenaturală, ca nimeni să n-o ia drept teren.
  const mod = modPrevizualizare();
  const culoare = culoarePrevizualizare(mod);
  if (culoare) {
    const legenda = creeazaLegenda(canvas.parentElement ?? document.body, mod);
    deEliberat.push(() => legenda.dispose());
  }

  // Atribuirile datelor care chiar ajung pe ecran, fără dubluri, fiecare cu ce
  // s-a făcut din ea. Licența lor, CC BY 4.0, le cere oriunde se afișează datele
  // și cere și mențiunea prelucrării. Se strâng ACUM, cât straturile mai sunt
  // legate de variabila de mai sus.
  //
  // „Pe ecran" contează: fără paletă completă terenul iese gri și regula nu mai
  // citește nici NDVI-ul; în previzualizare se vede NDVI-ul, dar nu culorile.
  const culoriMasurate = !culoare && terenMasurat(paleta);
  const ndviPeEcran = Boolean(ndvi.baza) && (Boolean(culoare) || culoriMasurate);
  const RELIEF = 'relieful, decupat după conturul zonei și adus la grila scenei';
  const NDVI = 'indicele de vegetație, calculat din roșul și infraroșul ortofotoului';
  const surse = [...new Map([
    [relief.meta?.sursa, RELIEF],
    [reliefPetic?.meta?.sursa, RELIEF],
    [culoriMasurate ? atribuirePaleta() : null, 'culorile vegetației, măsurate pe ortofoto'],
    [ndviPeEcran ? ndvi.baza?.meta?.sursa : null, NDVI],
    [ndviPeEcran ? ndvi.petic?.meta?.sursa : null, NDVI],
  ].filter(([s]) => s?.atributie).map(([s, prelucrare]) => [s.atributie, { ...s, prelucrare }])).values()];

  const teren = creeazaTeren(relief, { pastreaza, paleta, ndvi: ndvi.baza, culoare });
  scena.add(teren.obiect);
  // Înregistrat imediat, nu amândouă la sfârșit: dacă peticul aruncă, baza de
  // ~48 MB trebuie să fie deja în listă ca s-o elibereze `curata()`.
  deEliberat.push(() => teren.dispose());

  const petic = reliefPetic
    ? creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena, paleta, ndvi: ndvi.petic, culoare })
    : null;
  if (petic) {
    scena.add(petic.obiect);
    deEliberat.push(() => petic.dispose());
  }
  ndvi = null;

  // Cât timp utilizatorul nu a atins camera, încadrarea e a noastră și se
  // reașază la fiecare schimbare de formă a ecranului. La prima lui mișcare,
  // încadrarea devine a lui și nu i-o mai luăm.
  let incadrareAutomata = true;
  const laStart = () => { incadrareAutomata = false; };
  controale.addEventListener('start', laStart);

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

  // Busola. E DOM peste scenă, nu geometrie, dar aparține scenei: fără cameră
  // n-are ce arăta, iar fără WebGL nici nu se creează. Metadatele sunt ale BAZEI
  // — peticul n-are `colturi_geo` — și de acolo își deduce nordul adevărat.
  // Întoarce null dacă nu-l poate deduce; atunci pagina rămâne fără ea.
  const busola = creeazaBusola({
    gazda: canvas.parentElement ?? document.body,
    camera, controale, cereRandare,
    colturi: relief.meta?.colturi_geo,
  });
  if (busola) deEliberat.push(() => busola.dispose());

  // Conversiile se fac pe metadatele BAZEI, nu ale peticului: scena e centrată
  // pe ea, iar peticul e doar o plasă mai fină așezată înăuntru. Tot de acolo
  // vin și `colturi_geo`, pe care peticul nici nu le are.
  const geo = creeazaGeo(relief.meta);

  // Panoul punctului. Primește `inaltimeLa` COMPUS — cel care alege peticul de
  // 1 m acolo unde există — fiindcă e o unealtă de măsurat, iar diferența dintre
  // plase pe cusătură s-a măsurat la 0,153 m. Întoarce null dacă harta nu poate
  // exprima un punct în longitudine/latitudine.
  const punct = creeazaPunct({
    gazda: canvas.parentElement ?? document.body,
    canvas, camera, geo,
    inaltimeLa: (x, z) =>
      (petic && subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z)),
    limitaDatelor,
    zMin: relief.meta?.zMin_m,
  });
  if (punct) deEliberat.push(() => punct.dispose());

  renderer.setAnimationLoop(() => {
    // Un singur ceas în pagină. Bucla rulează oricum la fiecare cadru — decide
    // doar dacă desenează — deci animația busolei se agață aici, nu într-un al
    // doilea requestAnimationFrame, pe care regulile proiectului îl interzic.
    busola?.pas();
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

  // Relieful se dă printr-un getter, iar referința se STINGE la dispose(), nu se
  // ascunde doar.
  //
  // Deosebirea nu e teoretică, s-a măsurat. Comentariul de aici spunea înainte că
  // `terrain.js` își pune `grila = null` și că steagul de mai jos completează
  // treaba — dar acolo `Y` citea tabloul printr-un AL DOILEA nume, `inaltimi`,
  // deci `grila = null` nu elibera nimic: 0 din 6,63 MiB, pe modulul adevărat.
  // Iar aici `relief` era `const`, deci `viu = false` ascundea referința fără s-o
  // poată rupe, iar `main.js` ține obiectul în `globalThis.__scena` pe vecie.
  //
  // Amândouă s-au reparat, și era nevoie de amândouă: `terrain.js` ține peticul
  // (1,43 MiB), getterul de aici ține baza (6,63 MiB). Una singură ar fi lăsat
  // impresia unui dispose() curat fără să fie.
  //
  // Nu e memorie GPU, dar e memorie — iar atributele plasei, mult mai mari, le
  // eliberează `teren.dispose()` prin `curata()`: și de pe placă, și din RAM,
  // fiindcă îi scoate atributele din geometrie. Vezi acolo de ce nu ajungea
  // `geometrie.dispose()` singur.
  let viu = true;

  return {
    renderer, scena, camera, controale, teren, petic, busola, punct, geo, surse,
    get relief() { return viu ? relief : null; },
    nrTriunghiuri: teren.nrTriunghiuri + (petic?.nrTriunghiuri ?? 0),
    // Peticul e mai fin, deci acolo unde există el dă altitudinea; baza n-are
    // nicio valoare sub gaură. Nimic nu-l cheamă acum, dar e accesorul firesc
    // pentru așezarea unui reper pe teren, la capitolele care urmează.
    inaltimeLa: (x, z) =>
      (petic && subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z)),
    cereRandare,
    memorie: () => instantaneuMemorie(renderer),
    dispose() {
      viu = false;
      relief = null;
      renderer.setAnimationLoop(null);
      controale.removeEventListener('change', cereRandare);
      controale.removeEventListener('start', laStart);
      globalThis.removeEventListener('resize', laResize);
      faraMiscare?.removeEventListener?.('change', aplicaMiscare);
      // Aceeași listă ca la eșecul pornirii, nu o copie scrisă de mână.
      //
      // Două căi care eliberează aceleași resurse se despart încet: una capătă o
      // resursă nouă, cealaltă n-o află niciodată, iar ce rămâne viu sunt tocmai
      // lucrurile pe care nu le mai caută nimeni. Cu o singură listă, orice se
      // adaugă de acum încolo se eliberează pe amândouă căile fără să-și mai
      // amintească cineva de ea. `curata()` e idempotent.
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
