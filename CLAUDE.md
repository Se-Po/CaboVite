# Cabo Espichel — pagină 3D interactivă

Pagină web narativă despre promontoriul Cabo Espichel (Sesimbra, Portugalia):
geologie, urme de dinozauri, legendă mariană, far, fotografie personală.
Scenă 3D interactivă + text lung, într-o singură pagină.

**Limba proiectului este româna.** Tot textul vizibil, comentariile din cod,
numele de capitole și mesajele de commit se scriu în română. Discuția cu mine
se poartă în română.

## Stack

- three.js **0.186.0 (r186)**, versiune fixă în `package.json`, fără `^`
- Vite 8.3.0 (dev server + build), tot fără `^`
- three e fixat și pentru că `camera.js` folosește membri privați ai OrbitControls, iar
  `loaders.js` `KTX2Loader.init()`: o versiune nouă trece întâi prin `verifica-controale` și
  `verifica-pagina`, care îi verifică.
- JavaScript modern, module ES, fără framework. Nu introduce React, TypeScript
  sau alt strat fără să întrebi întâi.

## Comenzi

| Comandă | Ce face |
|---|---|
| `npm run dev` | dev server pe http://localhost:5173 |
| `npm run build` | build de producție în `dist/` |
| `npm run preview` | servește build-ul de producție |
| `npm run citeste-poze` | inventarul fotografiilor din `date-sursa/poze/` |
| `npm run culori-poze` | grupează culorile din poze, scoate pagina de etichetat |
| `npm run ortofoto` | culori din ortofotoul aerian DGT (RGB + infraroșu) |
| `npm run paleta` | culorile etichetate → `public/data/paleta-teren.json` |
| `npm run strat-ndvi` | infraroșul ortofotoului → `public/data/<hartă>-ndvi.bin` + `.json`, pe fiecare nod |
| `npm run build-zona` / `build-petic` | baza și peticul lui alpha → `public/data/harta_vN-dem.*`; un nume nou pe fiecare hartă |
| `npm run verifica-teren` | plasa și culoarea terenului, cu codul paginii, în Node |
| `npm run verifica-tiff` | decodorul LZW și predictorii TIFF, sintetic și pe dalele DGT |
| `npm run osm-sanctuar` | instantaneul OSM al sanctuarului, cu versiuni fixate; `-- --din-manifest` îl reface |
| `npm run nmds-sanctuar` | MDS − MDT la 50 cm pe fereastra sanctuarului: probele dalelor, straturile, candidații |
| `npm run masoara-sanctuar` | formele sanctuarului, măsurate pe MDS → `date-sursa/derivate/` |
| `npm run culori-sanctuar` | albedoul materialelor sanctuarului, din ortofoto și din fotografii |
| `npm run suprafete-sanctuar` | terreiro-ul, parcarea și drumurile ca poligoane, din OSM și ortofoto |
| `npm run build-sanctuar -- sanctuar_vN` | adună tot în `public/data/sanctuar_vN.json`; un nume se scrie o singură dată |
| `npm run verifica-sanctuar` | sanctuarul, cu codul paginii, în Node, față de LiDAR, de numărătoarea din 1880 și de el însuși |
| `npm run masoara-zbor` | soarele, deplasarea și înclinarea ortofotoului → `date-sursa/derivate/zbor.json` |
| `npm run textura-ortofoto` | texturile Satelit ale lui alpha (KTX2 UASTC) → `public/data/<hartă>-orto_v1.*`; cere KTX-Software 4.4 |
| `npm run masoara-faleza` | de la ce pantă fotografia își pierde detaliul; măsurătoare, nefolosită de pagină |
| `npm run osm-cladiri` | instantaneul OSM al celorlalte clădiri, cu versiuni fixate; `-- --din-manifest` îl reface |
| `npm run build-cladiri -- cladiri_vN` | farul și celelalte clădiri, măsurate pe LiDAR → `public/data/cladiri_vN.json`; `--proba` numai măsoară |
| `npm run verifica-cladiri` | construiește clădirile cu codul paginii, în Node, și le confruntă cu LiDAR-ul |
| `npm run surse-imprejurimi` | aduce o singură dată Copernicus DEM și Sentinel-2, cu manifestul `scripts/imprejurimi/surse.json` |
| `npm run build-imprejurimi -- harta_vN` | un nivel al împrejurimilor, în ordinea lanțului: v6, v9, v7, v8 |
| `npm run textura-imprejurimi` | texturile Satelit și NDVI-ul împrejurimilor; `-- harta_vN …` numai acelea; cere KTX-Software 4.4 |
| `npm run verifica-imprejurimi` | alpha și împrejurimile, cu codul paginii, în Node: cusăturile, bugetul, culoarea, netezirea |
| `npm run verifica-controale` | mouse-ul, degetele, tastatura și drona, busola, Escape, panoul „Coordonate”, cu codul paginii, în Node |
| `npm run verifica-livrare` | după build: cache, antete și CSP, numele publicate, ES5, marcajul; `-- --live` pe sebastians.life |
| `npm run verifica-pagina` | restul, cu codul paginii, în Node: Satelit, foaia de stil, ordinea de desenare, canvasul, pornirea, pagina fără scenă |
| `npm run verifica-documentatie` | CLAUDE.md și `docs/`: mărimea, indexul, trimiterile, căile decodoarelor, comentariile vechi, sursele etichetelor |
| `npm run iconite` | iconițele paginii, din sfera cursorului → `public/favicon.*`, `apple-touch-icon.png` |

Pe larg: `docs/comenzi.md`. Scripturile de construit hărți și texturi cer `date-sursa/`, care nu e
în depozit; codul lor comun stă în `scripts/comun/`.

## Arhitectură

- `src/main.js` — punctul de intrare: pornește scena și ține mesajul de încărcare, atribuirea cu
  modala surselor (`scrieSurse`) și calea fără scenă (`faraScena`), cu scena eliberată la eșec
- `src/scene/` — tot codul three.js. Nimic din three.js nu trăiește în afara acestui director.
- `src/chapters/` — câte un modul per capitol narativ, numai DOM, cu un `init()` și un `dispose()`.
  Azi `sanctuar.js`: fișa etichetei (`creeazaFisa`, din eticheta.js) și textul ei pe calea fără scenă
- `src/content/` — textele în română, ca date, separate de cod
- `src/styles/` — `main.css`, foaia de stil a paginii, și `cursoare/`, cursoarele SVG ale hărții
- `public/` — servit ca atare: `data/` (hărțile, straturile, texturile KTX2, sanctuarul,
  clădirile, paleta), `plasa.js`, iconițele; `models/`, `photos/`, `textures/` goale, de rezervă.
- `docs/` — notele pe subsisteme: de ce e fiecare lucru cum e, măsurătorile, probele, istoricul
  (indexul, mai jos)

## Convenții three.js r186 (esențiale)

- Bucla de animație: `renderer.setAnimationLoop(animate)`. **Nu** `requestAnimationFrame`
  — documentația oficială cere `setAnimationLoop` pentru compatibilitate.
- O animație proprie — întoarcerea camerei spre un punct de privire, un zbor de
  capitol — **nu** deschide al doilea `requestAnimationFrame`. Bucla rulează deja
  la fiecare cadru și decide doar *dacă* desenează, deci animația se agață în ea.
  Modelul e `zbor.pas()`, chemat ca primă instrucțiune din buclă.
- O excepție în buclă nu se lasă să se repete: corpul buclei (`cadru()` din `scena.js`) stă
  într-un `try`, cu un singur `console.error`; la al treilea eșec la rând, `setAnimationLoop(null)`
  și calea fără scenă (`laEsec`). Detaliile și probele: `docs/randarea.md`.
- Importă addon-urile ca `three/addons/...`, nu `three/examples/jsm/...`.
- `THREE.Clock` e deprecat din r183 → folosește `THREE.Timer`.
- `PCFSoftShadowMap` a fost **eliminat** în r186 → `THREE.PCFShadowMap`.
- Texturile de culoare (`.map`, `.emissiveMap`) primesc `texture.colorSpace = THREE.SRGBColorSpace`.
  Cele de date (`.normalMap`, `.roughnessMap`, `.metalnessMap`) rămân `NoColorSpace`.
- Orice `BufferGeometry`, `Material`, `Texture`, `WebGLRenderTarget` creat trebuie
  să aibă un `.dispose()` corespunzător. Scoaterea din scenă **nu** eliberează memoria GPU.
- Rămânem pe `WebGLRenderer`. `WebGPURenderer` e încă experimental în r186.

Detaliile complete sunt în `.claude/rules/three-scene.md`, încărcate automat
când lucrezi în `src/scene/`.

## Cum îți verifici munca

Înainte să spui că o modificare e gata:

1. `npm run build` trebuie să treacă fără erori, apoi probele Node: `npm run verifica-tiff`,
   `-teren`, `-sanctuar`, `-cladiri`, `-imprejurimi`, `-controale`, `-pagina` și `-documentatie`
   (`verifica-livrare`, la pasul 5). Fără `date-sursa/`, probele pe date reale se sar, cu mesaj:
   asta nu e un eșec.
2. Deschide panoul Browser (Ctrl+Shift+B / Cmd+Shift+B), încarcă pagina,
   fă un screenshot și **uită-te la el**. O scenă 3D poate compila perfect și
   afișa un ecran negru.
3. Citește consola browserului. Avertismentele WebGL contează, la fel încălcările CSP.
4. Verifică la lățime de 390px, nu doar pe desktop.
5. Dacă ai atins `vercel.json`, `index.html`, `public/` sau un script care scrie în
   `public/data`: `npm run verifica-livrare`; după push, `-- --live`.

Nu declara nimic funcțional fără dovadă. Dacă nu poți verifica, spune asta.

## Flux de lucru

- Nu comite și nu împinge nimic fără să-ți cer eu explicit.
- Versiunea se schimbă o dată la fiecare push, cu etichetă `v0.1.N`. Fiecare
  commit are un număr `0.1.N.xx`, scris ca prefix în subiect. Numărătoarea
  `0.1` pornește de la `v0.1.0` (2026-09-30), aceeași cifră ca `version` din
  `package.json`; până atunci etichetele au fost `v0.0.N`, până la `v0.0.11`.
- Pagina își arată versiunea, `v0.1.N`, în colțul din dreapta-jos (`#versiune`). O scrie build-ul
  (`vite.config.js`) din prefixul subiectului ultimului commit, deci prefixul e obligatoriu.
  Detaliile: `docs/livrarea.md`.
- Măsurătorile, probele și istoricul unei modificări se scriu în `docs/<subsistem>.md`, nu aici.
  În CLAUDE.md intră numai o regulă sau o decizie nouă, ca rând în „Decizii în vigoare”.

## Decizii în vigoare

Regulile care țin de tot proiectul, nu de un singur fișier. Fiecare e pe larg, cu motivul și
proba ei, în fișierul din `docs/` numit la capătul rândului. Unitățile: MB = 10⁶ B, MiB = 2²⁰ B; KB = 10³ B, KiB = 2¹⁰ B.

**Date, nume, depozit**
- Un nume publicat în `/data` (`harta_vN-dem.*`, `harta_vN-orto_vM.*`, `sanctuar_vN.json`,
  `cladiri_vN.json`) stă un an în cache: un conținut nou primește un nume nou. Scripturile
  build-* refuză un nume urmărit de git (`--suprascrie-lucru` rescrie numai unul neurmărit), iar
  texturile se rescriu numai cu aceiași octeți (`scrieNepublicat`). → livrarea, harti-relief
- Pe revalidare rămân documentul, iconițele, `plasa.js`, `paleta-teren.json` și straturile
  `-ndvi`. Un fel nou de fișier în `/data` sau în `/assets` pică `verifica-livrare` până i se
  hotărăște politica. → livrarea
- Depozitul păstrează exact hărțile pe care le încarcă pagina, cu straturile și texturile lor;
  cele vechi rămân în istoricul git. `date-sursa/` nu intră în depozit, datele produse în
  `public/data` da. O hartă nouă — alt contur, alt pas, alt conținut — primește un nume nou.
  → harti-relief
- `build-petic`, `build-imprejurimi` și scripturile ortofotoului își numesc sursele (`DALE`,
  `NIVELURI`, `ORTOFOTO_ALPHA`), nu iau „primul din director”; `build-imprejurimi` se oprește la
  o dală nenumită care îi atinge amprenta. `build-zona` încă citește toate `.tif` din
  `date-sursa/lidar` care ating cutia. → harti-relief, imprejurimi, fotografii
- Sursele pe care le aduce un script (Copernicus, Sentinel-2, OSM) se aduc o singură dată, cu
  manifest; dalele DGT le aduce autorul de mână, din CDD. O construcție nu descarcă nimic. OSM:
  versiuni fixate, instantanee care nu se suprascriu, fără Overpass, sub o cerere pe secundă.
  → imprejurimi, sanctuar
- Texturile KTX2 ies la octet din aceleași date (`--threads 1`, `--uastc-rdo-m`); fișierele JSON
  scrise de build-*, `paleta` și `strat-ndvi` poartă `generat`, deci nu. Octeții
  comparați cu git se compară ca blob git (`hash-object --path`): cu `core.autocrlf`, capetele
  de rând diferă. Extragerile binare din git, în Git Bash, nu în PowerShell 5.1. → livrarea,
  satelit, harti-relief

**Licențe și atribuire**
- DGT: CC BY 4.0, plus textul SNIG „Informação geográfica cedida pela Direção-Geral do
  Território”, scris de `scrieSurse()` din `main.js`, cu `lang="pt"`, oricând subsolul are o
  sursă DGT. → fotografii
- Tot ce derivă din contururile OSM e bază de date derivată, deci ODbL 1.0, cu atribuirea
  „© contribuitorii OpenStreetMap”. → sanctuar
- Rândul „© DGT · © Copernicus · © OpenStreetMap” se vede fără nicio interacțiune (regulile
  OSMF); „© DGT” deschide modala cu restul, inclusiv clauza de răspundere a Copernicus DEM.
  → fotografii

**Coordonate, nord, altitudine**
- Scena stă pe grila TM06: +X e estul grilei, −Z nordul grilei, Y altitudinea. → busola, punctul
- γ nu e o constantă: se deduce din `colturi_geo` al bazei, cu `cos φ · N/M` pe GRS80. Fără
  `colturi_geo`, busola nu se creează. → busola
- Capcana semnului: theta = 0 înseamnă camera la SUD; „nordul în sus” e theta = γ. Cifra busolei
  e azimutul poziției camerei, nu al privirii. → busola
- Azimuturile scenei și ale lui `zbor.json` sunt de grilă: A_grilă = A_adevărat + 0,674°.
  Soarele zborului e 94,0° / 39,5°; 96° / 22,5° e greșit, dar albedoul acoperișurilor din
  `sanctuar_v2` încă îl poartă (refacerea e un `sanctuar_v3`). → fotografii, sanctuar
- Convenția `bbox_tm06` se deduce din aritmetică (`scripts/comun/relief.mjs`), nu se presupune.
  Peticul se citește din ortofoto la 0,5 m, în blocuri 2 × 2, nu la 1 m. → harti-relief
- Altitudinea din EXIF e elipsoidală (ondulația geoidului, 52,92 m aici): se folosește
  LiDAR-ul. Direcția GPS e tagul 0x0011, nu 0x0010. → fotografii
- GLO-30 e un model de suprafață, în EGM2008: nu se curăță de coroane și acoperișuri, ci se
  coboară cu decalajul măsurat pe alpha. → imprejurimi
- Pozițiile se verifică pe LiDAR, nu pe ortofoto, care nu e true-ortho. → sanctuar
- Longitudinea și latitudinea se dau cu 6 zecimale, câte are `colturi_geo`. → punctul

**Harta și interacțiunea**
- Se măsoară numai în zona alpha (`harta_v4` cu peticul `harta_v5`). Împrejurimile sunt decor:
  fără umbre, fără etichete, fără măsurători. → punctul, imprejurimi
- Marea e un plan opac la `COTA_MARE` (−0,25 m); umplutura de −8 m nu e batimetrie. O
  altitudine care nu e strict pozitivă e „apă”; fără acoperire, „—”. → punctul, teren
- Nu se dă raycast pe plasă: raza merge pe câmpul de înălțimi (`marsPeTeren`, raza.js). Panoul,
  zoomul și apucarea culeg același `punctVazut`. → punctul
- „Coordonate” pornește minimizat și, minimizat, nu culege nimic; textul copiat are punct
  zecimal. → punctul
- Harta se mânuiește ca o hartă (stânga mută, dreapta rotește, rotița spre cursor), iar
  tastatura ca o dronă; harta n-are butoane pe ecran. Mutarea, rotirea, Shift și Ctrl se recunosc
  după poziție (`code`, și pe AZERTY); plusul, minusul și Home, după semn (`key`). → controale
- Camera stă între 80 m și 8 km de țintă, cu ținta în cutia nodurilor lui alpha; niciun pas de
  la tastatură n-o duce sub 20 m peste ce e sub ea. Zborul pune poziția absolut, după ce
  descarcă inerția și încheie gestul în curs. → controale, busola
- `VEDERE_START` (poziția și ținta) e aceeași pe orice ecran, cu lateralele tăiate pe cele
  înguste; „Acasă” înseamnă ea. → busola
- O constantă aleasă se scrie „o alegere”, nu ca măsurătoare (`INACTIVITATE_PORNIRE_MS`,
  `PAS_VERTICAL`, `LIBER_SOL`, `GRATIE`). → pornirea, controale

**Randarea**
- Scena desenează la cerere: în repaus, 0 cadre (de aceea și cerul e senin). O animație se
  agață în buclă, fără al doilea `requestAnimationFrame`. → randarea
- Raportul de pixeli e cel mult 2, iar canvasul cel mult 2560 · 1440 ≈ 3,69 milioane de pixeli
  de dispozitiv (o arie, nu laturi); MSAA rămâne. → randarea
- Cerul se desenează ultimul (`renderOrder` 2), marea după teren (1, `LessDepth`); programele
  se compilează cu `compileAsync` înaintea buclei. → randarea
- Construcția plaselor rămâne pe firul principal, fără workeri: decizia autorului. → satelit
- Alpha n-are atribut `normal` (`flatShading`), culoarea stă pe Uint16 normalizat, iar celulele
  de apă nu se generează. → teren
- Culoarea e albedo, nu aparență: lumina se reglează în lumini sau în expunere. O nuanță pe
  care fotografiile n-o susțin nu se inventează. → teren, fotografii
- Împrejurimile se încarcă totul sau nimic și n-au codul umbrelor în shader; bugetul lor e
  600 000 de triunghiuri și 8 MiB de fișiere. → imprejurimi
- Umbrele: o singură hartă de 2048², cu `autoUpdate = false`, refăcută la
  `webglcontextrestored`; soarele nu se mută ca să încadreze umbra. → sanctuar
- Ce stă în DOM peste hartă (eticheta, semnul punctului, pivotul) se proiectează pe cadrul
  desenat, după `camera.updateMatrixWorld()`; „vizibil” se citește cu
  `getClientRects().length`. → sanctuar, punctul, controale

**Satelit**
- Pagina pornește pe Satelit și arată harta o singură dată, cu cele șase texturi întregi; cu
  preferința Relief (în `localStorage`, în try/catch) nu se descarcă nimic până la primul clic.
  → satelit
- Satelit e neiluminat, cu soarele zborului; înapoi pe Relief, soarele se pune din copie, iar
  Relief rămâne la octet. → satelit
- Texturile sunt KTX2 UASTC (alegerea autorului), cu versiune proprie (`orto_vN`). Transcodorul
  nu se copiază în `public/`: îl emite Vite. → satelit, livrarea
- Falezele rămân fotografia: alegerea autorului. Acoperișurile fantomă încă nu s-au retușat;
  retușul (`orto_v2`) e opțional, iar primul loc de retușat e turnul de nord. → satelit
- Gărzile: 20 s fără niciun octet opresc pornirea sau fotografia; transcodarea are 30 s,
  numărate numai cât pagina e vizibilă. → pornirea, satelit

**Pagina: CSS, browsere, accesibilitate**
- CSP-ul rămâne Report-Only până la încercarea de mână în Firefox și Safari/iOS
  (`cabo-espichel-csp-impus`). Fără `'unsafe-inline'`: niciun atribut `style` în marcaj, iar
  stilurile puse din cod trec prin CSSOM. → livrarea
- Fără `:has()` (Firefox 115 ESR): starea se scrie ca atribute pe `<html>`. `dvh` numai sub
  `@supports`, cu rezerva `vh` în `--vizibil`. → punctul, livrarea
- Textul panoului „Coordonate” are cel puțin 14 px (0,875rem). → punctul
- Animațiile CSS numai pe `transform` și `opacity`, oprite sub reduced-motion; selecția e
  oprită numai pe hartă și pe butoanele de peste ea. → comenzi, controale
- Focusul de peste hartă are haloul `0 0 0 7px var(--bg)`; în contrast forțat, busola trece
  pe `CanvasText`. → controale
- Un singur `h1` și `<noscript>`, în afara lui `#continut`; panourile ascunse și canvasul fără
  pointer până la `data-scena`. → pornirea
- `build.target` e `['es2022', 'safari15.4', 'ios15.4']`; `public/plasa.js` e ES5, script clasic
  cu `defer`. → pornirea
- Fără `frame-ancestors`, ales: pagina se poate încadra. `og:image` lipsește până alege autorul
  o imagine. Hărțile de cod se publică, închise publicului, la alegerea autorului. → livrarea

**Probele**
- Fiecare probă de fond are un control negativ: aceeași probă pe o greșeală cunoscută, care
  trebuie să pice. Codul încercat e al paginii, importat, nu copiat; valoarea de referință se
  calculează independent în probă, nu se importă. → sanctuar, controale, teren, imprejurimi
- O probă pe sursă aduce textul la LF, iar o mutație care nu se aplică pică singură: probele trec
  pe o clonă LF și pe una CRLF. → satelit
- `AMPRENTA` (sha256 pe atribute) ține refactorizările la bit; o schimbare voită o rescrie, cu
  motivul în commit. → teren, imprejurimi, sanctuar, cladiri
- „Identic la pixel” se scrie numai când chiar e; o cifră pe care n-o reface niciun cod sau cu
  sursă necunoscută nu dovedește nimic. → teren, sanctuar
- Încărcătoarele opționale nu aruncă: la eșec, `null` și un singur avertisment; la abandonul
  gărzii sau la `dispose()`, `null` fără avertisment. Un `null` din JSON se verifică: în
  aritmetică ar intra drept 0. → satelit, sanctuar, pornirea
- Câte arce și ferestre are fiecare aripă spune Pinho Leal (1880); `build-sanctuar` se oprește
  dacă numărul ar scădea tăcut. → sanctuar
- Fotografiile se copiază prin USB și nu pictează harta. Platoul ia culoarea din ortofoto,
  faleza din fotografii (`SURSA` din `scripts/paleta.mjs`); k-means pornește cu sămânță fixă, iar
  etichetele stau pe culoare. → fotografii

## Documentația pe subsisteme: `docs/`

Istoricul, măsurătorile și probele fiecărui subsistem stau în `docs/`, mutate cuvânt cu cuvânt
din CLAUDE.md pe 2026-10-09. Înainte să schimbi ceva, citește fișierul subsistemului: acolo e de
ce e fiecare lucru cum e și ce probă pică dacă îl strici.

| Când atingi… | Citește |
|---|---|
| `vercel.json`, versiunea din `vite.config.js`, antetele și CSP-ul, iconițele, `verifica-livrare`, `scripts/comun/vercel.mjs`, `publicat.mjs` | `docs/livrarea.md` |
| pornirea din `main.js` (încărcarea, `faraScena`), `index.html`, `public/plasa.js`, `src/chapters/`, `build.target`, garda din `loaders.js` | `docs/pornirea.md` |
| `harta_v4` și `harta_v5`, `build-zona`, `build-petic`, `strat-ndvi`, `ortofoto`, `verifica-tiff`, `scripts/comun/relief.mjs`, `tiff.mjs`, `lzw.mjs`, `tm06.mjs` | `docs/harti-relief.md` |
| `busola.js`, `zbor.js`, `VEDERE_START` și `acasa()` din `camera.js` | `docs/busola.md` |
| `punct.js`, `geo.js`, `raza.js`, `cadru-liber.js`, `#punct` din `main.css` | `docs/punctul.md` |
| `ControaleHarta` și drona din `camera.js`, `rotita.js`, `gest.js`, `tastatura.js`, cursoarele, focusul, `verifica-controale` | `docs/controale.md` |
| `terrain.js`, `palette.js`, `previzualizare.js`, `verifica-teren` | `docs/teren.md` |
| `cer.js`, `mare.js`, `renderer.js`, `lights.js`, `dispose.js`, bucla, `renderOrder` și `compileAsync` din `scena.js` | `docs/randarea.md` |
| `alpha.js`, `imprejurimi.js`, `cusatura.js`, `harta_v6`, `v9`, `v7`, `v8`, `*-imprejurimi.mjs`, `scripts/comun/imprejurimi.mjs`, `cog.mjs`, `textura.mjs` | `docs/imprejurimi.md` |
| `satelit.js`, KTX2 din `loaders.js`, `*-orto_v1.*`, `textura-ortofoto`, `masoara-faleza` | `docs/satelit.md` |
| `sanctuar.js`, `sanctuar-forme.js`, `drapaj.js`, `eticheta.js`, `fisa-cadru.js`, `umbre.js`, `src/content/sanctuar.js`, `*-sanctuar.mjs`, `scripts/sanctuar/`, `scripts/comun/osm.mjs`, `plane.mjs` | `docs/sanctuar.md` |
| `cladiri_v1.json`, `*-cladiri.mjs`, `scripts/cladiri/`, `src/content/cladiri.js`, `src/scene/nume.js`, umbrele pe grupuri (`urmaresteGrupul`) | `docs/cladiri.md` |
| `citeste-poze`, `culori-poze`, `paleta`, `masoara-zbor`, `scripts/comun/soare.mjs`, `paleta-teren.json`, `scripts/comun/exif.mjs`, `oklab.mjs`, atribuirea și modala „© DGT” | `docs/fotografii.md` |
| comenzile din `package.json`, `verifica-pagina`, `verifica-documentatie` | `docs/comenzi.md` |

## Principii de design (nenegociabile)

- **Accesibilitate:** fonturi mari, contrast ridicat. Cititorii pot fi vârstnici.
- **O singură temă, întunecată**, oricum ar fi setat sistemul: `:root` din
  `main.css` și `PALETA` din `palette.js` (cerul și marea scenei). `color-scheme:
  dark`, în CSS și în `index.html`, ține întunecate și controalele native, cu
  barele de defilare. Tema deschisă, aleasă după `prefers-color-scheme`, a plecat
  după v0.1.1, la cererea autorului.
- **Responsivitate** reală, pe toate dimensiunile și nivelurile de zoom.
- **Navigare clară:** nav sticky, breadcrumbs, scrollspy (neimplementat încă: singurul capitol, al
  sanctuarului, e fișa și textul de pe calea fără scenă).
- **Degradare grațioasă:** pagina trebuie să rămână lizibilă și fără WebGL.
  Textul este conținutul; scena 3D îl servește, nu invers. Fără WebGL2, `#continut` are textul
  fișei sanctuarului, cu sursele; fără JavaScript, o propoziție (vezi `docs/pornirea.md`, „Titlul și pagina fără scenă”).
- `prefers-reduced-motion` oprește animațiile automate ale camerei.

## Acuratețe factuală

Conținutul se sprijină pe surse primare portugheze (Diocese de Setúbal,
Câmara Municipal de Sesimbra, monumentos.gov.pt / SIPA, literatura
paleontologică). Nu inventa date, cifre sau nume. Dacă o afirmație nu are
sursă, marcheaz-o `<!-- NEVERIFICAT -->` și spune-mi.

IMPORTANT: diferența de vârstă dintre siturile Pedra da Mua (Jurasic superior)
și Lagosteiros (Cretacic inferior) este de ~15–20 milioane de ani. Cifra
„50 de milioane" care circulă în versiunile vechi ale textului este greșită.
