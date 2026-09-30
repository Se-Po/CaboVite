import * as THREE from 'three';
import { creeazaRenderer, redimensioneaza } from './renderer.js';
import { creeazaCamera, VEDERE_START } from './camera.js';
import { creeazaLumini } from './lights.js';
import { creeazaTeren, mascaBazei } from './terrain.js';
import { creeazaMare } from './mare.js';
import { creeazaCer } from './cer.js';
import { creeazaSatelit } from './satelit.js';
import { incarcaCladiri, incarcaRelief, incarcaSanctuar, straturiNdvi } from './loaders.js';
import { creeazaSanctuar } from './sanctuar.js';
import { creeazaZbor } from './zbor.js';
import { creeazaEticheta } from './eticheta.js';
import { creeazaUmbre } from './umbre.js';
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
export async function porneste(canvas, { continut, laSurse } = {}) {
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
    return await construieste(canvas, renderer, deEliberat, curata, continut, laSurse);
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

async function construieste(canvas, renderer, deEliberat, curata, continut, laSurse) {
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
  // Sanctuarul pleacă odată cu relieful: n-au nimic de împărțit. Nu respinge
  // niciodată — întoarce null și spune de ce —, deci nici n-are nevoie de catch.
  const sanctuarGata = incarcaSanctuar();
  // La fel clădirile din afara lui: farul, casele lui, Casa da Ronca.
  const cladiriGata = incarcaCladiri();

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
  // termină. Scalată pentru zona de ~3 km: din vederea de pornire, cel mai
  // depărtat colț al hărții e la ~2,7 km de cameră, deci ceața începe abia după
  // el — altfel platoul s-ar decolora în culoarea cerului și ar părea că se topește.
  scena.fog = new THREE.Fog(paleta.cer, 5000, 24000);

  const { camera, controale } = creeazaCamera(canvas);
  deEliberat.push(() => controale.dispose());

  const lumini = creeazaLumini(paleta);
  scena.add(lumini.obiect);
  deEliberat.push(() => lumini.dispose());

  // Cerul, cu soarele scenei. Separabil: dacă nu se poate face, rămân fundalul și
  // ceața plate de mai sus.
  let cer = null;
  try {
    cer = creeazaCer({ paleta, soare: lumini.soare });
    scena.add(cer.obiect);
    const c = cer;
    deEliberat.push(() => c.dispose());
    // Ce nu e mare, și stă oricum sub 5 km, se topește în media orizontului; tot ea
    // e fundalul, acolo unde cerul n-ar ajunge.
    const orizont = new THREE.Color().setRGB(...cer.orizont, THREE.SRGBColorSpace);
    scena.fog.color.copy(orizont);
    scena.background = orizont.clone();
  } catch (e) {
    console.warn('cerul sărit, rămâne fundalul plat:', e.message);
  }

  const mare = creeazaMare(paleta, cer);
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
  let surse = [...new Map([
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

  // Un singur accesor al altitudinii randate: peticul de 1 m unde există, baza de
  // 2 m în rest. Îl folosesc sanctuarul — pentru talpa pereților —, panoul punctului
  // și obiectul întors.
  const inaltimeLa = (x, z) => (petic && subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z));

  // Santuário de Nossa Senhora do Cabo Espichel. Se adaugă peste teren; dacă
  // lipsește sau nu se poate construi, scena merge mai departe fără el.
  const b = relief.meta?.bbox_tm06;
  const sanctuar = creeazaSanctuar({
    date: await sanctuarGata, inaltimeLa,
    ancora: b ? { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 } : null,
    retea: { relief, reliefPetic, pastreaza, subPetic },
  });
  if (sanctuar) {
    for (const o of sanctuar.obiecte) scena.add(o);
    deEliberat.push(() => sanctuar.dispose());
    const PRELUCRARE = {
      osm: 'conturul unor clădiri, al zidurilor, al apeductului și al suprafețelor de pe teren, verificat pe LiDAR',
      mds: 'înălțimile și formele clădirilor, măsurate pe modelul de suprafață, deasupra terenului',
      ortofoto: 'culorile acoperișurilor sanctuarului și lățimea drumurilor, măsurate pe ortofoto',
    };
    surse = unesteSurse(surse, sanctuar.surse.map((s) => ({ ...s, prelucrare: PRELUCRARE[s.cheie] ?? 'geometria sanctuarului' })));
  }

  // Farul și celelalte clădiri: același cod, alte date, fără suprafețe pe teren.
  const cladiri = creeazaSanctuar({
    date: await cladiriGata, inaltimeLa, eticheta: 'clădiri',
    ancora: b ? { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 } : null,
  });
  if (cladiri) {
    scena.add(cladiri.obiect);
    deEliberat.push(() => cladiri.dispose());
    const PRELUCRARE = {
      osm: 'conturul farului și al clădirilor din afara sanctuarului, înregistrat pe LiDAR',
      mds: 'înălțimile și acoperișurile farului și ale clădirilor din afara sanctuarului',
      ortofoto: 'materialul acoperișurilor din afara sanctuarului, după culoarea lor',
    };
    surse = unesteSurse(surse, cladiri.surse.map((s) => ({ ...s, prelucrare: PRELUCRARE[s.cheie] ?? 'geometria clădirilor' })));
  }

  // Umbrele clădirilor: o hartă strânsă pe complex, desenată la pornire și apoi
  // numai când se mută soarele (Relief ↔ Satelit) sau grupul privit.
  // Separabile — dacă nu se pot face, clădirile rămân, doar fără umbră.
  //
  // Grupurile — sanctuarul, farul, Casa da Ronca — stau la sute de metri unul de
  // altul. Dacă o cutie peste toate ține texelul sub TEXEL_MAXIM, rămâne ea; altfel
  // harta trece între cutia unită (de departe) și grupul cel mai apropiat de ținta
  // camerei (de aproape), cu o redesenare la fiecare schimbare (`umbreGrup`, în buclă).
  // Măsurat, cu soarele Relief: cutia unită 0,60 m pe texel, farul singur 0,12 m.
  const TEXEL_MAXIM = 0.3;
  let umbre = null, umbreGrup = null;
  const grupuriUmbra = [
    ...(sanctuar ? [{ nume: 'sanctuar', cutie: sanctuar.cutieCladiri }] : []),
    ...(cladiri ? [...cladiri.cutiiGrupuri].map(([nume, cutie]) => ({ nume, cutie })) : []),
  ].filter((g) => !g.cutie.isEmpty());
  if (grupuriUmbra.length) {
    try {
      const unita = grupuriUmbra.reduce((a, g) => a.union(g.cutie), new THREE.Box3());
      umbre = creeazaUmbre({
        renderer, soare: lumini.soare,
        cutie: unita,
        arunca: [sanctuar?.obiect, cladiri?.obiect].filter(Boolean),
        primesc: [...(sanctuar ? sanctuar.obiecte : []), ...(cladiri ? [cladiri.obiect] : []), teren.obiect, ...(petic ? [petic.obiect] : [])],
      });
      const u = umbre;
      deEliberat.push(() => u.dispose());
      // Pragul se judecă în buclă, nu aici: soarele se mută între Relief și Satelit.
      if (grupuriUmbra.length > 1)
        umbreGrup = urmaresteGrupul({ umbre: u, grupuri: grupuriUmbra, unita, texelMaxim: TEXEL_MAXIM, camera, controale, canvas: renderer.domElement });
      // Harta nu se redesenează singură (autoUpdate = false). După pierderea
      // contextului WebGL, three face un WebGLShadowMap nou, dar lumina ar fi sărită
      // de-acum încolo: umbrele s-ar compara cu o textură nedesenată. Ascultătorul
      // three.js e înregistrat înaintea noastră, deci contextul e deja refăcut aici.
      const laRestaurare = () => { u.refa(); cereRandare(); };
      canvas.addEventListener('webglcontextrestored', laRestaurare);
      deEliberat.push(() => canvas.removeEventListener('webglcontextrestored', laRestaurare));
    } catch (e) {
      console.warn('umbrele sanctuarului sărite:', e.message);
    }
  }

  // Vederea Satelit: ortofotoul pe relief, comutabil cu vederea de mai sus. Pornește
  // pe Relief și trece singur pe Satelit când texturile sunt gata — dacă omul nu
  // și-a ales altfel data trecută. Separabil: fără textură, sau dacă nu se poate
  // crea deloc, rămâne Relief — ca la cer și la umbre.
  let satelit = null;
  try {
    if (!b) throw new Error('harta n-are bbox_tm06');
    satelit = creeazaSatelit({
      renderer, scena, camera, teren, petic, mare, soare: lumini.soare, cer, umbre,
      drapaj: sanctuar ? sanctuar.obiecte.slice(1) : [],
      centru: { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 },
      numeBaza: relief.meta.nume, numePetic: reliefPetic?.meta.nume ?? null,
      gazda: canvas.parentElement ?? document.body,
      cereRandare,
      // Soarele s-a mutat: ceața și fundalul iau noul orizont al cerului.
      laSoareNou: () => {
        if (!cer) return;
        const orizont = new THREE.Color().setRGB(...cer.orizont, THREE.SRGBColorSpace);
        scena.fog.color.copy(orizont);
        scena.background = orizont;
      },
      laSursa: (s) => { surse = unesteSurse(surse, [s]); laSurse?.(surse); },
      fortatRelief: Boolean(culoare),
    });
    const sat = satelit;
    deEliberat.push(() => sat.dispose());
  } catch (e) {
    console.warn('vederea Satelit sărită, rămâne Relief:', e.message);
  }

  // Declarate aici, fiindcă clicul pe busolă, creată înaintea lor, le folosește.
  let zbor = null, eticheta = null;
  // Fiecare ascultător, înscris în listă imediat: dacă un pas de mai jos aruncă,
  // `resize` și `matchMedia` ar ține viu tot contextul lui construieste(), cu relieful.
  controale.addEventListener('change', cereRandare);
  deEliberat.push(() => controale.removeEventListener('change', cereRandare));
  const laResize = () => cereRandare();
  globalThis.addEventListener('resize', laResize);
  deEliberat.push(() => globalThis.removeEventListener('resize', laResize));

  // Amortizarea e mișcare care continuă după ce utilizatorul a dat drumul —
  // exact ce cere prefers-reduced-motion să nu se întâmple.
  const faraMiscare = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const aplicaMiscare = () => {
    controale.enableDamping = !(faraMiscare?.matches ?? false);
    cereRandare();
  };
  aplicaMiscare();
  faraMiscare?.addEventListener?.('change', aplicaMiscare);
  deEliberat.push(() => faraMiscare?.removeEventListener?.('change', aplicaMiscare));

  // Busola. E DOM peste scenă, nu geometrie, dar aparține scenei: fără cameră
  // n-are ce arăta, iar fără WebGL nici nu se creează. Metadatele sunt ale BAZEI
  // — peticul n-are `colturi_geo` — și de acolo își deduce nordul adevărat.
  // Întoarce null dacă nu-l poate deduce; atunci pagina rămâne fără ea.
  //
  // Clicul pe ea readuce vederea de pornire. Fișa sanctuarului se închide întâi:
  // închiderea șterge sincron decalajul de obiectiv, altfel zborul ar ateriza cu
  // imaginea încă mutată. Focusul, rămas în fișa ascunsă, trece pe rozetă —
  // Safari nu-l mută singur pe butonul apăsat.
  const busola = creeazaBusola({
    gazda: canvas.parentElement ?? document.body,
    controale,
    colturi: relief.meta?.colturi_geo,
    laClic: () => {
      if (eticheta?.stare.deschisa) {
        eticheta.inchide();
        document.querySelector('#busola .roza')?.focus();
      }
      zbor?.spre(VEDERE_START);
    },
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
    inaltimeLa,
    limitaDatelor,
    zMin: relief.meta?.zMin_m,
    // Clădirea cea mai apropiată de-a lungul razei, din oricare set.
    loveste: sanctuar || cladiri ? (raza) => {
      const a = sanctuar?.loveste(raza) ?? null, c = cladiri?.loveste(raza) ?? null;
      return !a ? c : !c ? a : a.t <= c.t ? a : c;
    } : undefined,
    numeElement: (cheie) => [...(continut?.sanctuar?.nume_elemente ?? []), ...(continut?.cladiri?.nume_elemente ?? [])].find(([p]) => cheie.startsWith(p))?.[1] ?? cheie,
  });
  if (punct) deEliberat.push(() => punct.dispose());

  // Zborul camerei, unul singur: spre sanctuar, de la etichetă, și înapoi la
  // vederea de pornire, de la busolă. Un zbor nou îl înlocuiește pe cel în curs.
  zbor = creeazaZbor({
    camera, controale, cereRandare,
    azimutNordAdevarat: busola?.azimutNordAdevarat ?? 0,
  });
  deEliberat.push(() => zbor.dispose());

  // Cât fișa e deschisă, imaginea se mută în partea de ecran pe care n-o acoperă:
  // pe telefon fișa e foaie jos și acoperă peste jumătate, pe desktop stă la
  // dreapta. Un decalaj de obiectiv (`setViewOffset`), nu altă țintă: camera și
  // pivotul rămân unde le-a pus zborul, deci rozeta, raza panoului punctului și
  // proiecția etichetei merg neschimbate — toate citesc matricea de proiecție.
  let decalaj = null; // fracțiunile părții libere, sau null
  const aplicaDecalaj = () => {
    const c = renderer.domElement, cw = c.clientWidth, ch = c.clientHeight;
    if (!decalaj || !cw || !ch) { camera.clearViewOffset(); cereRandare(); return; }
    camera.setViewOffset(cw, ch, (0.5 - (decalaj.x0 + decalaj.x1) / 2) * cw, (0.5 - (decalaj.y0 + decalaj.y1) / 2) * ch, cw, ch);
    cereRandare();
  };
  const potrivesteLaFisa = (fisa) => {
    const c = renderer.domElement.getBoundingClientRect();
    decalaj = { x0: 0, x1: 1, y0: 0, y1: 1 };
    if (fisa && c.width && c.height) {
      if (fisa.width >= 0.8 * c.width && fisa.top > c.top + 0.25 * c.height) decalaj.y1 = Math.min(1, (fisa.top - c.top) / c.height);
      // Laterală până la trei sferturi din lățime: între 545 și 666 px fișa trece de
      // 60% — și mai mult cu textul mărit —, iar un prag la 40% lăsa complexul sub
      // ea. Peste trei sferturi nu mai rămâne loc în care să încapă ceva.
      else if (fisa.left > c.left + 0.25 * c.width) decalaj.x1 = Math.min(1, (fisa.left - c.left) / c.width);
    }
    aplicaDecalaj();
  };
  // Distanța zborului: cel puțin cât cere punctul de privire, și destul ca
  // complexul — ~110 m de la centrul terreiro-ului până la biserică și la capetele
  // aripilor — să încapă în partea liberă, pe lățime și pe înălțime.
  const RAZA_COMPLEX = 110;
  const zborLaFisa = () => {
    const z = sanctuar.poi.zbor, t = Math.tan((camera.fov * Math.PI) / 360), L = decalaj ?? { x0: 0, x1: 1, y0: 0, y1: 1 };
    const distanta = Math.max(z.distanta, RAZA_COMPLEX / (t * camera.aspect * (L.x1 - L.x0)), (0.6 * RAZA_COMPLEX) / (t * (L.y1 - L.y0)));
    return { ...z, distanta };
  };
  eticheta = sanctuar?.poi?.zbor ? creeazaEticheta({
    gazda: canvas.parentElement ?? document.body,
    canvas, camera, inaltimeLa, cereRandare,
    ancora: sanctuar.poi.ancora,
    continut: continut?.sanctuar,
    laDeschidere: (fisa) => { potrivesteLaFisa(fisa); zbor.spre(zborLaFisa()); },
    laInchidere: () => { decalaj = null; aplicaDecalaj(); },
  }) : null;
  if (eticheta) deEliberat.push(() => eticheta.dispose());

  renderer.setAnimationLoop(() => {
    // Un singur ceas în pagină. Bucla rulează oricum la fiecare cadru — decide
    // doar dacă desenează — deci zborul camerei se agață aici, nu într-un al
    // doilea requestAnimationFrame, pe care regulile proiectului îl interzic.
    zbor.pas();
    const seMisca = controale.enableDamping && controale.update();
    if (redimensioneaza(renderer)) {
      const c = renderer.domElement;
      camera.aspect = c.clientWidth / c.clientHeight;
      camera.updateProjectionMatrix();
      // decalajul fișei se socotește din nou: fișa și canvasul și-au schimbat mărimea
      if (decalaj) potrivesteLaFisa(document.getElementById('sanctuar-fisa')?.getBoundingClientRect());
      cerut = true;
    }
    if (!cerut && !seMisca) return;
    cerut = false;
    // Eticheta se așază pe cadrul care se desenează acum, nu pe cel de dinainte.
    // Pentru asta îi trebuie matricea de acum: OrbitControls.update() cheamă
    // lookAt(), care reface matrixWorld cu poziția nouă dar rotația VECHE, iar
    // render() o reface abia după. Fără linia de mai jos, la o orbitare de 3° pe
    // cadru pinul stătea la 44 px de biserică.
    camera.updateMatrixWorld();
    eticheta?.pas();
    // Camera s-a apropiat de alt grup de clădiri, sau s-a depărtat: harta de umbre se
    // strânge pe cutia potrivită, în cadrul acesta.
    umbreGrup?.pas();
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
    renderer, scena, camera, controale, teren, petic, sanctuar, cladiri, busola, punct, geo,
    // Getter: vederea Satelit adaugă o sursă când îi sosește textura, după pornire.
    get surse() { return surse; },
    zbor, eticheta, umbre, umbreGrup, satelit,
    get relief() { return viu ? relief : null; },
    nrTriunghiuri: teren.nrTriunghiuri + (petic?.nrTriunghiuri ?? 0),
    // Peticul e mai fin, deci acolo unde există el dă altitudinea; baza n-are
    // nicio valoare sub gaură. Nimic nu-l cheamă acum, dar e accesorul firesc
    // pentru așezarea unui reper pe teren, la capitolele care urmează.
    inaltimeLa,
    cereRandare,
    memorie: () => instantaneuMemorie(renderer),
    dispose() {
      viu = false;
      relief = null;
      renderer.setAnimationLoop(null);
      // Ascultătorii se scot tot prin listă. Aceeași listă ca la eșecul pornirii, nu o copie scrisă de mână.
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

/**
 * Unește două liste de surse pe `atributie`. Două intrări cu aceeași atribuire —
 * ortofotoul, de pildă, folosit și de teren și de sanctuar — devin una, cu
 * prelucrările amândurora: un Map simplu ar fi păstrat-o numai pe a doua.
 */
function unesteSurse(a, b) {
  const m = new Map(a.map((s) => [s.atributie, { ...s }]));
  for (const s of b) {
    const vechi = m.get(s.atributie);
    if (!vechi) { m.set(s.atributie, { ...s }); continue; }
    if (s.prelucrare && !vechi.prelucrare?.includes(s.prelucrare))
      vechi.prelucrare = vechi.prelucrare ? `${vechi.prelucrare}; ${s.prelucrare}` : s.prelucrare;
  }
  return [...m.values()];
}

/**
 * Pe ce cutie se strânge harta de umbre, la fiecare cadru desenat.
 *
 * Cât texelul cutiei peste toate grupurile nu trece de `texelMaxim`, rămâne ea.
 * Altfel, de departe tot ea: cât texelul ei nu trece de mărimea unui pixel de ecran
 * la țintă, o hartă mai strânsă n-ar desena nimic în plus. Pixelul e al CANVASULUI
 * (`canvas.height`), deci de dispozitiv, nu CSS. De aproape, grupul cel mai
 * apropiat de țintă.
 *
 * La pornire ținta e la 611 m, iar texelul cutiei unite 0,50–0,60 m. Primul cadru
 * are soarele Relief — Satelit își pune soarele abia când i-a sosit textura —,
 * deci cutia unită rămâne numai pe un canvas înalt de cel mult ~922 px de
 * dispozitiv; sub Satelit histerezisul păstrează apoi alegerea (întoarcerea la
 * cutia unită cere ≤ ~917 px). Pe telefoane și pe ecranele dense harta pornește
 * strânsă pe sanctuar (~430 m de țintă; farul e la ~800 m), cu 0,21–0,22 m pe
 * texel — farul își primește umbra când te apropii de el.
 *
 * Două praguri cu histerezis — ±10% pe pixel,
 * HISTEREZIS metri între grupuri —, ca o cameră care stă pe o margine să nu
 * redeseneze harta la fiecare cadru; o schimbare costă o singură redesenare.
 *
 * Texelul cutiei unite depinde de soare (0,60 m cu soarele Relief, 0,50 m cu al
 * zborului), deci se recitește când `umbre.versiuneSoare` s-a schimbat.
 *
 * @param {{incadreazaPe: (c: THREE.Box3) => void, texelPentru: (c: THREE.Box3) => number,
 *          texelMetri: number, versiuneSoare: number}} o.umbre
 * @param {{nume: string, cutie: THREE.Box3}[]} o.grupuri
 */
function urmaresteGrupul({ umbre, grupuri, unita, texelMaxim, camera, controale, canvas }) {
  const HISTEREZIS = 20;
  const p = new THREE.Vector3();
  const tinta = controale.target;
  const distanta = (g) => g.cutie.distanceToPoint(p.set(tinta.x, (g.cutie.min.y + g.cutie.max.y) / 2, tinta.z));
  const toate = { nume: 'toate', cutie: unita };
  const texel = new Map();
  let curent = toate, texelUnit = 0, versiune = -1;
  const pas = () => {
    if (versiune !== umbre.versiuneSoare) {
      versiune = umbre.versiuneSoare;
      texelUnit = umbre.texelPentru(unita);
      texel.clear();
      texel.set('toate', texelUnit);
      if (curent !== toate) texel.set(curent.nume, umbre.texelMetri);
    }
    let ales = toate;
    if (texelUnit > texelMaxim) {
      // mărimea unui pixel de ecran la distanța țintei, în metri
      const pixel = (camera.position.distanceTo(tinta) * 2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, canvas.height);
      if (texelUnit > pixel * (curent === toate ? 1.1 : 0.9)) {
        let cel = grupuri[0], dCel = distanta(cel);
        for (let k = 1; k < grupuri.length; k++) { const d = distanta(grupuri[k]); if (d < dCel) { cel = grupuri[k]; dCel = d; } }
        ales = curent !== toate && cel !== curent && distanta(curent) - dCel < HISTEREZIS ? curent : cel;
      }
    }
    if (ales === curent) return;
    curent = ales;
    umbre.incadreazaPe(curent.cutie);
    texel.set(curent.nume, umbre.texelMetri);
  };
  pas();
  return {
    pas,
    get grup() { return curent.nume; },
    /** Texelul fiecărei cutii deja încadrate cu soarele de acum, în metri. */
    get texel() { return Object.fromEntries(texel); },
  };
}
