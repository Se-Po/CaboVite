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
- JavaScript modern, module ES, fără framework. Nu introduce React, TypeScript
  sau alt strat fără să întrebi întâi.

## Comenzi

| Comandă | Ce face |
|---|---|
| `npm run dev` | dev server pe http://localhost:5173 |
| `npm run build` | build de producție în `dist/` |
| `npm run preview` | servește build-ul de producție |
| `npm run copy-decoders` | copiază decodoarele Draco/KTX2 în `public/`; nu se rulează: nimic nu le cere, iar `verifica-livrare` pică pe un `dist/` care le are |
| `npm run citeste-poze` | inventarul fotografiilor din `date-sursa/poze/` |
| `npm run culori-poze` | grupează culorile din poze, scoate pagina de etichetat |
| `npm run ortofoto` | culori din ortofotoul aerian DGT (RGB + infraroșu) |
| `npm run paleta` | culorile etichetate → `public/data/paleta-teren.json` |
| `npm run strat-ndvi` | infraroșul ortofotoului → `public/data/<hartă>-ndvi.bin` + `.json`, pe fiecare nod |
| `npm run verifica-teren` | construiește plasa cu codul paginii, în Node, și verifică ce primește și ce pictează regula de culoare |
| `npm run verifica-tiff` | verifică decodorul LZW și predictorii TIFF, sintetic și pe dalele DGT din `date-sursa/` |
| `npm run osm-sanctuar` | instantaneul OSM al sanctuarului, cu versiuni fixate; `-- --din-manifest` îl reface și îl compară |
| `npm run nmds-sanctuar` | MDS − MDT la 50 cm pe fereastra sanctuarului: probele de sosire ale dalelor, straturile PNG, candidații din afara OSM |
| `npm run masoara-sanctuar` | acoperișuri, turnuri, cupole, ziduri, apeduct și coșuri măsurate pe MDS → `date-sursa/derivate/` |
| `npm run culori-sanctuar` | albedoul materialelor sanctuarului, din ortofoto și din fotografii |
| `npm run suprafete-sanctuar` | terreiro-ul, parcarea și drumurile ca poligoane, din OSM și ortofoto |
| `npm run build-sanctuar -- sanctuar_vN` | adună tot în `public/data/sanctuar_vN.json`, în coordonatele scenei; un nume se scrie o singură dată (`--suprascrie-lucru` rescrie numai un nume pe care git încă nu-l urmărește) |
| `npm run verifica-sanctuar` | construiește sanctuarul cu codul paginii, în Node, și îl confruntă cu LiDAR-ul, cu numărătoarea din 1880 și cu el însuși |
| `npm run masoara-zbor` | soarele ortofotoului din umbre, deplasarea lui pe sol și înclinarea acoperișurilor → `date-sursa/derivate/zbor.json` |
| `npm run textura-ortofoto` | texturile vederii Satelit, KTX2 UASTC, pentru bază și petic → `public/data/<hartă>-orto_v1.ktx2` + `.json`; cere KTX-Software 4.4 |
| `npm run masoara-faleza` | de la ce pantă fotografia își pierde detaliul și cu ce lumină s-ar colora stânca → `date-sursa/derivate/faleza.json`; măsurătoare, nefolosită de pagină |
| `npm run osm-cladiri` | instantaneul OSM al clădirilor din afara sanctuarului, cu versiuni fixate; `-- --din-manifest` îl reface și îl compară |
| `npm run build-cladiri -- cladiri_vN` | farul și celelalte clădiri, înregistrate și măsurate pe LiDAR → `public/data/cladiri_vN.json`; `--proba` numai măsoară |
| `npm run verifica-cladiri` | construiește clădirile cu codul paginii, în Node, și le confruntă cu LiDAR-ul |
| `npm run surse-imprejurimi` | aduce o singură dată, prin HTTP pe intervale, ferestrele Copernicus DEM și Sentinel-2 ale împrejurimilor → `date-sursa/copernicus/`, `date-sursa/sentinel/`, cu manifestul `scripts/imprejurimi/surse.json` |
| `npm run build-imprejurimi -- harta_vN` | împrejurimile: `harta_v6` și `harta_v9` din dalele DGT numite în `scripts/comun/imprejurimi.mjs`, `harta_v7` și `harta_v8` din Copernicus, în ordinea lanțului: v6, v9, v7, v8 |
| `npm run textura-imprejurimi` | texturile Satelit ale împrejurimilor și NDVI-ul lui `harta_v9`/`harta_v7`/`harta_v8`, din ortofoto (464-3 și 464-1) și Sentinel-2; `-- harta_vN …` numai acelea; cere KTX-Software 4.4 |
| `npm run verifica-imprejurimi` | construiește alpha și împrejurimile cu codul paginii, în Node: crăpăturile cusăturilor, bugetul și fișierele fiecărui nivel, culoarea peste cusături, netezirea, shaderul fără codul umbrelor |
| `npm run verifica-controale` | mânuirea hărții, cu codul paginii, în Node: treptele rotiței, zoomul spre cursor și limitele lui, stările gesturilor, punctul panoului „Coordonate”, harta cu pagina mărită |
| `npm run verifica-livrare` | după `npm run build`: cache-ul și antetele de securitate din `vercel.json` pe fiecare fișier publicat, CSP-ul față de ce face pagina, garda numelor publicate, blocurile `static {}` din `dist/assets` și plasa ES5; `-- --live` le compară cu sebastians.life |
| `npm run verifica-pagina` | ce nu acoperă celelalte probe, cu codul paginii, în Node: textura Satelit când transcodorul KTX2 nu răspunde (limita de timp, abandonul, pagina ascunsă, verificarea dinaintea descărcării); foaia de stil: fără `:has()`, `dvh` numai cu rezervă, selecția oprită numai pe hartă, animațiile numai pe transform/opacity și oprite sub reduced-motion; ordinea de desenare (cerul ultimul, marea după teren); mărimea canvasului (raportul de pixeli cel mult 2); cascada încărcării (stratul NDVI cerut odată cu sidecarul hărții); garda pornirii (20 s fără niciun octet abandonează pornirea); Satelit la pornire (cele șase texturi întregi cerute înaintea construcției, procentul, garda fotografiei, ieșirea fără Satelit; peticul oprit fără compresie); harta o singură dată (pe sursă: compilarea, apoi așteptarea fotografiei, apoi bucla; panourile ascunse și canvasul fără pointer până la `data-scena`; mesajul cu procentul și butonul „Arată relieful acum”) |
| `npm run iconite` | iconițele paginii, din sfera cursorului → `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` |

Scripturile de construit hărți (`build-zona`, `build-petic`) cer date-sursă care
nu sunt în depozit; vezi mai jos. La fel `ortofoto` și `strat-ndvi`, care citesc
dala de ortofoto. Codul lor comun — proiecția TM06, mersul prin IFD-urile unui
TIFF și decompresia LZW, citirea unei hărți gata făcute, citirea și alinierea ortofotoului, OKLab,
EXIF-ul — stă în `scripts/comun/`.

## Arhitectură

- `src/main.js` — punctul de intrare; leagă scena de conținut, nimic altceva
- `src/scene/` — tot codul three.js. Nimic din three.js nu trăiește în afara acestui director.
- `src/chapters/` — câte un modul per capitol narativ, cu un `init()` și un `dispose()`
- `src/content/` — textele în română, ca date, separate de cod
- `public/` — modele, texturi, fotografii, decodoare. Servite ca atare.

## Convenții three.js r186 (esențiale)

- Bucla de animație: `renderer.setAnimationLoop(animate)`. **Nu** `requestAnimationFrame`
  — documentația oficială cere `setAnimationLoop` pentru compatibilitate.
- O animație proprie — întoarcerea camerei spre un punct de privire, un zbor de
  capitol — **nu** deschide al doilea `requestAnimationFrame`. Bucla rulează deja
  la fiecare cadru și decide doar *dacă* desenează, deci animația se agață în ea.
  Modelul e `zbor.pas()`, chemat ca primă instrucțiune din buclă.
- O excepție în buclă nu se lasă să se repete. three cere cadrul următor ÎNAINTEA
  buclei (`WebGLAnimation.js:10`), deci una persistentă ar arunca la fiecare cadru,
  și în repaus, cu imaginea înghețată: măsurat în pagină, cu `zbor.pas` aruncând
  mereu, 61 de erori neprinse în 1 s și 0 cadre. Corpul buclei din `scena.js`
  (`cadru()`) stă într-un `try`: la prima excepție, un singur `console.error`, iar
  cadrul se cere din nou; contorul se golește numai după ce `render()` a întors. La
  al treilea eșec la rând, `setAnimationLoop(null)` și `laEsec`, opțiunea lui
  `porneste()`: `main.js` cheamă `dispose()`, prin aceeași listă ca la pornire, apoi
  `forceContextLoss()` — canvasul e abandonat, deci contextul n-are de ce să rămână viu,
  ca pe calea de eroare de la pornire — și calea fără scenă
  (`data-scena="indisponibila"`, subsolul ascuns). Probe, în
  pagină: aruncând mereu, trei apeluri, un `console.error`, 0 erori neprinse, de la
  14 geometrii și 9 texturi la 0 și 1; o excepție o singură dată, în `zbor.pas` sau
  în `gest.pas` (după `cerut = false`), costă un cadru, redesenat la cel următor,
  iar scena rămâne activă — pe codul de dinainte, cea din `gest.pas` lăsa cadrul
  cerut nedesenat (0 cadre în 0,5 s).
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

1. `npm run build` trebuie să treacă fără erori.
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
- Pagina își arată versiunea, `v0.1.N`, în colțul din dreapta-jos (`#versiune`), odată cu harta
  — cât se încarcă stă ascunsă, cu celelalte panouri (vezi „Pornirea”) — și, fără JavaScript, imediat.
  N-o scrie nimeni de mână: build-ul (`vite.config.js`) o ia din prefixul subiectului
  ultimului commit — pe Vercel din `VERCEL_GIT_COMMIT_MESSAGE`, altfel din `git log` —,
  deci prefixul `0.1.N.xx` e obligatoriu. Fără niciun subiect cu prefix, pagina nu scrie
  nicio versiune. Pe serverul de dezvoltare e a ultimului commit, fără lucrul nesalvat.
  Ce stă pe marginea de jos urcă deasupra ei cu `--versiune` (1,15rem): pe desktop
  „Coordonate” și Satelit, pe aceeași linie; pe telefon busola, Satelit și panoul.
  Variabila stă pe `#versiune ~ *` — panourile vin după versiune în `<body>` —, nu pe
  `:root:has(#versiune)`: Firefox 115 ESR n-are `:has()`, iar acolo „Coordonate” intra
  13,1 px peste versiune. Proba, în pagină: `--versiune` e 1,15rem pe busolă, Satelit,
  panou și fișă; cu versiunea mutată la sfârșitul lui `<body>`, gol.

## Livrarea: `vercel.json`

Vercel servește `dist/` cu antetele din `vercel.json`. Până la v0.1.5 nu exista: totul
venea cu `public, max-age=0, must-revalidate`, iar la fiecare revenire pe pagină se
revalidau 45 de fișiere, în lanț — HTML, JS, apoi cele trei niveluri de date.

**Cache-ul.**
- `/assets/*.js|css|wasm`: imutabil un an. Vite pune în nume hash-ul conținutului.
  Hărțile de cod NU: numele lor vine din hash-ul JS-ului, iar un commit numai cu comentarii
  le schimbă conținutul fără să le schimbe numele. Un fișier nou în `/assets`, de alt tip,
  pică proba până i se hotărăște regula.
- `/data/`: imutabile un an numai numele cu versiune: `harta_vN-dem.*`,
  `harta_vN-orto_vM.*`, `sanctuar_vN.json`, `cladiri_vN.json`. Cine a deschis
  pagina o dată nu mai cere un nume publicat timp de un an, deci un conținut nou
  primește un nume nou. Scripturile build-* refuzau deja un nume urmărit de git;
  `textura-ortofoto` și `textura-imprejurimi` îl rescriu acum numai cu aceiași octeți
  (`scrieNepublicat` din `scripts/comun/publicat.mjs`). Altfel aruncă, înainte de scriere.
  Octeții se compară ca blob git (`hash-object --path`): cu `core.autocrlf`, un .json
  poate avea pe disc alte capete de rând decât în depozit.
- Rămân pe revalidare (ETag, 304) documentul, iconițele, `plasa.js`, `paleta-teren.json` și straturile
  `-ndvi`. Paleta se reface sub același nume și are patru versiuni în istoric. Numele unui
  strat NDVI vine din al hărții (`loaders.js`), deci un strat refăcut n-ar avea unde primi
  alt nume. Paleta ține și după reparație un dus-întors pe drumul spre primul cadru
  (`incarcaPaleta()`, așteptată în `scena.js`); un nume versionat l-ar scoate.

**Securitatea.** `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
(cameră, microfon, geolocație oprite) și CSP-ul, deocamdată `Content-Security-Policy-Report-Only`:
numai scrie în consolă. Fiecare sursă are un motiv:
- `script-src 'self' 'unsafe-eval'`: transcodorul Basis al KTX2Loader face `new Function`
  (embind) și compilează WebAssembly, în worker. Fără `'unsafe-eval'`, `verificaTranscodorul`
  (`loaders.js`) oprește Satelit în firul principal, înaintea oricărei descărcări, cu un
  avertisment, iar Relief rămâne. Un worker mort din alt motiv îl prinde limita de 30 s a
  transcodării. Înainte de impunere mai rămâne încercarea din Firefox și Safari/iOS (mai jos).
- `worker-src 'self' blob:`: workerul KTX2Loader e făcut dintr-un Blob. `child-src` repetă
  sursele pentru browserele care nu citesc `worker-src` <!-- NEVERIFICAT: Safari vechi -->.
- `img-src 'self' data:`: cursoarele, ca URI de date în CSS.
- `style-src 'self'`, fără `'unsafe-inline'`: niciun atribut `style` în marcaj. Stilurile
  puse din cod trec prin CSSOM (`el.style.x = …`), pe care CSP nu-l oprește. Așa face și
  legenda din `?previzualizare=ndvi`.
- Fără `frame-ancestors`: pagina se poate încadra în alta. E o alegere, nu o scăpare.

**Local.** `npm run preview` trimite aceleași antete de securitate, dar nu și Cache-Control:
un fișier în lucru rescris sub același nume ar rămâne un an vechi în browserul de probă.
`npm run preview -- --mode csp-impus` (configurația `cabo-espichel-csp-impus`, portul 4174)
trimite politica impusă. Proba din 2026-10-08, în Chromium, cu politica impusă:
- Satelit, Relief, „Coordonate” cu Copiază, modala surselor și
  `?previzualizare=ndvi` merg toate, cu 0 încălcări;
- un worker din `blob:` cu `new Function` și `WebAssembly.compile` merge;
- controlul, un atribut style pus din cod, e blocat.
Cu Report-Only, aceleași căi nu dau niciun mesaj; controlul apare în consolă.

**Hărțile de cod** se publică, dar Vercel le dă numai membrilor echipei autentificați
(„Protected Source Maps”), iar publicul primește 403. Rămân pentru depanarea paginii
publicate, la alegerea autorului.

**Iconițele.** `npm run iconite` le desenează din sfera cursorului, din aceeași descriere:
SVG-ul ca text, PNG-urile (16, 32 și 48 în ICO, 180 pentru iOS, pe fondul paginii) cu
gradientul calculat ca în SVG. Față de SVG-ul desenat de Chromium, PNG-urile diferă cu
0,8–1,5 niveluri în medie și cu 9–19 pe marginea cercului; mutat cu un pixel, SVG-ul
diferă de el însuși cu 226. Fișierele ies identice la fiecare rulare. `og:image` lipsește
până când autorul alege o imagine.

**Proba: `npm run verifica-livrare`**, după `npm run build`:
- politica de cache pe fiecare fișier publicat. Clasa fiecărui fel de fișier din `/data`
  e scrisă în probă (`clasaData`), deci un fel nou pică până i se hotărăște politica;
- un nume imutabil care a avut în istoric două conținuturi pică;
- `dist/` local n-are voie să aibă fișiere din `public/` gitignorat. Vercel construiește
  din commit, deci `public/draco`, rămas de la `copy-decoders`, făcea `npm run preview` să
  servească 763 341 de octeți pe care pagina publicată nu-i are;
- un fișier din `public/` încă neadăugat în git se spune, fără să pice: Vercel nu-l publică
  până nu intră în commit;
- antetele de securitate, CSP-ul față de ce face pagina, marcajul fără inline și garda;
- 0 blocuri `static {}` în `dist/assets` (parserul lui Vite), `plasa.js` numai cu forme ES5 —
  o listă de noduri PERMISE, deci o formă pe care n-o știe pică; nu se vede numai ce nu lasă
  urmă în arbore, virgula de după ultimul parametru (ES2017) —, cu `defer` și fără `type`, semnul `__modulPornit` în intrare și în plasă, mesajul de
  încărcare: `role="status"` pe paragraf, procentul `aria-hidden`, butonul „Arată relieful
  acum” ascuns (vezi „Pornirea”); marcajul de dinainte și butonul fără `hidden` pică.

Controalele:
- `/data/(.*)` imutabil pică pe paletă și pe NDVI;
- `/assets/(.*)` imutabil pică pe hărțile de cod;
- un max-age de un an fără `immutable`, pe paletă sau pe document, pică: revalidarea se cere
  pozitiv (`no-cache` sau `max-age=0`), nu ca „nu e imutabil”;
- fără regula de `/assets`, pică;
- fără `'unsafe-eval'` sau fără `blob:`, pică;
- legenda veche, cu `style=` în `innerHTML`, e prinsă;
- un octet în plus pe un nume publicat aruncă; o copie locală care diferă de HEAD, cu
  conținutul nou egal cu cel publicat, se reface (încercat într-un depozit de unică folosință);
- paleta din HEAD, în forma de checkout (CRLF), comparată ca octeți bruți, ar fi părut
  rescrisă;
- three.core trecut prin ținta de dinainte (`es2022`) are 6 blocuri `static {}`; 35 de forme de
  după ES5, fiecare singură — de la `const` și `??` la parametrii impliciți, `catch {}`, `/u` și
  `1_000` — sunt prinse, iar o bucată de ES5 cu getteri, for-in, etichete și `/gim` trece. Lista
  de dinainte, de forme interzise, scăpa 15 dintre ele (recenzia).

`-- --live` compară antetele de pe sebastians.life cu `vercel.json`. Înainte de primul
deploy cu el, pe 2026-10-08, au picat toate cele 54 de căi.

path-to-regexp, cu care citește Vercel `source`, nu e instalat. `scripts/comun/vercel.mjs`
simulează numai subsetul folosit — text literal și grupuri `( … )` — și aruncă pe rest,
inclusiv pe ce respinge path-to-regexp: un grup care capturează, unul gol sau care începe
cu `?`.

Report-Only n-are destinație pentru rapoarte, deci de la vizitatori nu vine nimic. Înainte
de impunere, `cabo-espichel-csp-impus` se încearcă de mână și în Firefox și în Safari/iOS
(`-- --host`, de pe telefon).

## Pornirea: mesajul de încărcare și plasa

**Mesajul.** `#incarcare`, frate al lui `#continut`, în mijlocul ecranului: `<p role="status">`
„Se încarcă harta 3D…” și butonul ascuns „Arată relieful acum”. Roata se mișcă numai prin
`transform` și stă sub reduced-motion; contrast `--ink` pe `--surface` 13,7:1. Când pornirea mai
așteaptă numai fotografia, scena.js cheamă `laIncarcare({ faza: 'fotografie' })` (main.js): „Se
încarcă fotografia aeriană…”, procentul într-un `<span aria-hidden="true">` — cititorul de ecran
aude numai faza <!-- NEVERIFICAT: cu un cititor de ecran adevărat --> — și butonul. Clicul pe el
abandonează `faraSatelit`: harta apare pe loc, pe Relief, cu focusul pe butonul Satelit, iar
preferința rămâne. Pastila e text, nu flex: ca flex, la 195 px procentul ieșea din ea. Mesajul
pleacă la `data-scena` pe `<body>` (`activa` sau `indisponibila`); fără JavaScript, prin
`@media (scripting: none)`.

**Panourile** — busola, Satelit, „Coordonate”, sursele, versiunea, eticheta și fișa, pivotul —
au `visibility: hidden` până la `data-scena`: apar toate odată cu harta și nu iau focus până
atunci. Canvasul n-are pointer până atunci: o tragere de 400 px în timpul încărcării muta camera
cu 560 m înaintea primului cadru (control, în pagină). Măsurat pe build: `data-scena` se pune cu
`frame` 0, cu Satelit deja aplicat, iar primul cadru e Satelit (5 din 5 încărcări). La
1600 × 900, 390 × 844, 844 × 390, 320 × 568 și 195 × 422, cu „5%” și cu „100%”, pastila și
butonul stau în ecran, fără defilare orizontală.

**Browserele vechi.** three r186 are șase blocuri `static {}`, pe care Safari/iOS le
parsează abia de la 16.4. Un modul care nu se parsează oprește tot graful, deci nici
try/catch-ul din main.js, nici calea fără scenă: pagina rămânea goală. `build.target` e acum
`['es2022', 'safari15.4', 'ios15.4']`; se schimbă numai three.core, +62 B (185 999 →
186 061), restul iese identic în afara numelor de chunk, CSS-ul la octet. Pe un aparat cu
iOS 15.4–16.3 nu s-a încercat <!-- NEVERIFICAT: iPhone/iPad pe iOS 15.4–16.3 -->.

**Plasa** (`public/plasa.js`), un script clasic extern cu `defer` (CSP-ul n-are
`'unsafe-inline'`), în ES5. main.js pune `__modulPornit` la prima instrucțiune; modulele rulează
înaintea lui `load`, deci dacă la `load` semnul lipsește, plasa scoate canvasul, pune
`data-scena="indisponibila"` și scrie „Harta 3D nu a putut porni.”. Fără niciun temporizator.
Pe un server de probă local, cu build-ul de producție:
- three.core cu o eroare de parsare la început: mesajul, fără canvas, fără mesajul de încărcare.
  Control, același modul fără plasă: „Se încarcă harta 3D…” pe vecie, `#continut` gol;
- `index-*.js` cu 404 (HTML vechi după un deploy): mesajul;
- `index-*.js` întârziat 4 s: `load` vine la 4,04 s, după modul, harta pornește, fără mesaj.

## Hărțile de relief

Hărțile se numesc `harta_vN` și trăiesc în `public/data/<nume>-dem.bin` +
`.json`. O hartă nouă — alt contur, altă rezoluție sau alt conținut — primește un nume nou;
nu se suprascrie una existentă. Numele e scris și în sidecar, la cheia `nume`. Regula nu e
numai de ordine: un nume publicat stă un an în cache-ul cititorilor (vezi „Livrarea”).

| hartă | sursă | acoperire |
|---|---|---|
| `harta_v5` | LiDAR DGT, MDT 50 cm mediat | petic de 534 × 700 m la 1 m, peste `harta_v4`; `harta_v3` cu inelul de cusătură refăcut pe baza nouă |
| `harta_v4` | LiDAR DGT 2024-2025, MDT 2 m; fâșia 104162 din MDT 50 cm | toată cutia, 2328 × 2986 m, cu tot uscatul ei; `harta_v2` fără conturul ales în pagină și fără noduri tăiate |
| `harta_v6` | LiDAR DGT, MDT 2 m, la 4 m | împrejurimi: banda de ~400 m de lângă marginile de nord și est ale lui alpha |
| `harta_v9` | LiDAR DGT, MDT 2 m, la 12 m, cu cele 14 dale aduse de autor pe 2026-10-07 | împrejurimi: banda până la x −91 000 și y −134 000, ~2,4 km dincolo de alpha |
| `harta_v7` | Copernicus DEM GLO-30, la 32 m | împrejurimi: ~4,5 km dincolo de `harta_v9` |
| `harta_v8` | Copernicus DEM GLO-30, la 256 m | împrejurimi: ~48 km în jurul capului |

`harta_v4` cu peticul ei sunt **zona alpha**, harta pe care se lucrează;
`harta_v6`, `harta_v9`, `harta_v7` și `harta_v8`, în ordinea asta, din interior spre orizont, sunt
decorul din jur. Numele nu urmează ordinea: `harta_v9` s-a adăugat ultima, între v6 și v7.
Vezi „Zona alpha și împrejurimile”.

O hartă poate avea cheia `baza`: atunci e un **petic** de rezoluție mai mare,
iar `incarcaRelief()` încarcă și baza. Scena generează două plase — baza, cu o
gaură exact sub petic, și peticul deasupra. Nodurile peticului cad peste ale
bazei din doi în doi, iar inelul lui exterior ia relieful bazei, așa că muchia
comună e aceeași linie și nu rămâne nicio crăpătură.

**Stratul NDVI pleacă odată cu sidecarul hărții** (`incarcaRelief`), nu după el: numele
lui e al hărții, iar al hărții stă în URL (`/data/<nume>-dem.json`). Lățimea și înălțimea
se verifică după ce sosește sidecarul; un sidecar cu alt `nume` oprește cererea, iar stratul
se cere după numele din sidecar, ca înainte. Baza pleacă tot după sidecarul peticului, deci
alpha are două dus-întorsuri până la date, nu trei, iar împrejurimile unul, nu două. Fără
preload în `index.html`: în modelul auditului întârzie JS-ul pe rețele lente, iar fără WebGL
ar descărca degeaba 2,19 MB. Proba, `npm run verifica-pagina`, cu un `fetch` care răspunde
în ture: pe datele paginii 2 ture, 24 de cereri, fiecare o dată; control, compunerea de
dinainte, 3. Sidecarul 404 sau index.html, relieful trunchiat, stratul de lungime greșită,
de altă grilă, cu 404, sidecarul fără `nume` sau cu alt nume dau aceleași rezultate și
aceleași avertismente; 0 respingeri netratate. O hartă care cade înainte să predea stratul
lui `incarcaStrat` — sidecarul 404 sau index.html — îi oprește cererile: pe un nivel al
împrejurimilor pornirea merge mai departe, iar garda nu le mai abandona (recenzia; pe codul
de dinainte proba pică pe ambele căi). În pagină (dev și producție, localhost),
fiecare `-ndvi.bin` pornește odată cu sidecarul hărții lui; pe codul de dinainte, după
`responseEnd`-ul lui (`harta_v5` 81 față de 79 ms, `harta_v4` 102 față de 85).

**Garda pornirii** (`creeazaGardaPornirii` din `loaders.js`, în `scena.js`). Niciun `fetch`
al pornirii n-avea semnal sau termen: un corp care începe și apoi tace ținea ecranul gol
oricât, chiar pe un fișier opțional. Acum relieful cu straturile, paleta, sanctuarul,
clădirile și împrejurimile poartă un singur semnal de abandon, iar un singur ceas se
rearmează la orice antet sau bucată de corp sosită, a oricărei cereri (corpurile se citesc
cu `getReader`): o cerere lentă sau la coadă nu e omorâtă cât altele curg. După 20 s fără
niciun octet nicăieri (`INACTIVITATE_PORNIRE_MS`, o alegere, nu o măsurătoare) totul se
abandonează: opționalele întorc `null` fără avertisment, `asteapta()` din `scena.js` aruncă
după fiecare așteptare (altfel harta ar fi pornit tăcut fără sanctuar), iar main.js scrie
„Harta 3D nu a putut porni: datele hărții n-au mai sosit.” cu butonul „Reîncearcă”, care
reîncarcă pagina. Un termen în care pagina a fost ascunsă, sau al cărui temporizator sună
cu peste 1 s întârziere — o filă înghețată; după ultima dată, o construcție care trece de
termen cu ceasul încă armat —, nu se numără. `curata()` oprește cererile încă în zbor la
orice eșec. Ceasul se oprește imediat după ce au sosit toate datele (`garda.opreste()` în
`construieste`): cât se construiește și cât se așteaptă fotografia ar fi expirat fals, iar o
excepție de mai târziu ar fi ieșit drept „datele n-au mai sosit”. Fotografia are garda ei
(vezi „Vederea Satelit”); cererile ei pleacă abia după datele pornirii, deci nu le țin la coadă.

Proba, `verifica-pagina`, pe ceas virtual: corpul bazei tace după 1 KB — în așteptare la
19,999 s, TimeoutError la 20 s, 0 avertismente (control, fără gardă: în așteptare după
200 s); baza în 10 bucăți la 15 s vine întreagă la 165 s (control, fără rearmare: abandon
la 20 s); baza la coadă 60 s, cât peticul curge la 5 s, vine (control, fără nimic care
curge: 20 s); paleta, sanctuarul, clădirile și un strat blocate dau `null` cu 0
avertismente (control, aceleași cu 404: 5); pagina ascunsă 10–35 s: abandon la 60 s
(control: 20); firul ocupat 15–26 s: la 46 s (control: 26); datele citite pe bucăți sunt
identice cu cele fără gardă; `scena.js` dă garda celor 5 încărcători și verifică fiecare
așteptare (codul vechi: 5 fără gardă, 5 neverificate) și o oprește după date (lipsă pe
scena.js de la `30a22c9`). În pagină (dev, `fetch` înlocuit),
cu `harta_v4-dem.bin` tăcut după 1 KB și, separat, cu `sanctuar_v2.json` fără antet:
anunțul și butonul la 20,1 s, fără avertismente; butonul reîncarcă și harta pornește; la
390 px butonul are 118 × 46 px, fără defilare orizontală. `harta_v4-dem.bin` citit pe
bucăți din cache: 6,9 ms, față de 7,4 cu `arrayBuffer()` (mediana a 7).

Pagina încarcă o singură hartă (plus baza ei), aleasă în `src/scene/loaders.js`, plus cele patru
niveluri ale împrejurimilor (`src/scene/imprejurimi.js`). Datele-sursă
(`date-sursa/`) nu intră în depozit; hărțile produse, da — altfel pagina nu se
poate încărca dintr-o clonă curată.

Depozitul păstrează **exact** harta pe care o încarcă pagina, cu straturile ei, și
nimic altceva: `harta_v5` plus baza ei, `harta_v4`, fiecare cu `-ndvi` alături, și împrejurimile
`harta_v6`, `harta_v9`, `harta_v7` și `harta_v8`, cu straturile și texturile lor. `harta_v0` și `harta_v1` au plecat odată
cu reparația dalei 104162 (vezi „Dalele 104xxx"), `harta_v2` și `harta_v3` odată cu
lărgirea la toată cutia (vezi „Uscatul din afara conturului"). Hărțile de probă de dinainte — promontoriul
întreg din Copernicus GLO-30 și golful Lagosteiros — au fost șterse împreună cu
scripturile lor, tocmai ca să nu mai existe îndoială care hartă e „cea bună".
Sunt recuperabile din istoricul git.

Baza se decupează după cutia `CUTIE_TM06` din capul lui `scripts/build-zona.mjs`,
scrisă direct în TM06; peticul, după conturul `POLIGON_GEO` din `build-petic.mjs`,
în longitudine/latitudine, pe care scriptul îl proiectează. Pagina doar citește
conturul din sidecar; nu are unealtă de desenat sau de măsurat contururi. Ambele
scripturi refuză un nume pe care git îl urmărește deja; unul încă neurmărit se
rescrie numai cu `--suprascrie-lucru`.

### Uscatul din afara conturului: `harta_v4` și `harta_v5`

`harta_v2` se tăia după un poligon ales în pagină, 4,00 km². În aceeași cutie mai
erau 281 313 celule de uscat, 1,1 km², cu relieful deja în `.bin` — scena arăta
acolo planul mării. `harta_v4` are conturul egal cu cutia; celulele de mare le taie
oricum `terrain.js`, după `regula_apa`. Cutia se scrie în TM06: colțurile lui v2
proiectate înapoi au ±0,1 m eroare, iar `floor(−95788,05 / 2)·2` dă −95790 — cutia
ar crește cu o celulă și peticul n-ar mai cădea pe noduri.

Acceptarea, față de `harta_v2`, pe `.bin`-uri:
- cutia, dimensiunile și `colturi_geo` sunt identice, deci ancora sanctuarului, γ și
  gaura de sub petic rămân; busola scria tot 213° SV, pe vederea de pornire de atunci;
- pe cele 492 837 de noduri de uscat ale conturului vechi, |Δz| ≤ 2,4 mm (o cuantă:
  zScara crește de la 0,00231 la 0,00241 m). Control: toate cele 14 203 noduri care
  în v2 stăteau pe 65535 sunt acum peste 143,64 m, până la 150,00;
- `harta_v5` față de `harta_v3`: aceeași cutie, deplasare, gaură și zScara; diferă
  1 120 de noduri, toate în banda de cusătură de 4 m, cu cel mult o cuantă (2,2 mm);
- NDVI-ul lui v4 e identic cu al lui v2 pe toate cele 492 837 de noduri codate
  acolo (0 diferențe; citirea mutată cu 1 px: 259 871), plus 280 371 de noduri noi;
  al lui v5, identic cu al lui v3;
- culoarea Relief pe conturul vechi: din 1 359 696 de fațete regăsite, 10 118
  (0,74%) diferă cu cel mult un nivel pe un canal; 2 426 și-au schimbat diagonala
  după recuantizare.

Plasa crește la 1 923 948 de triunghiuri (bază 1 422 064), adică +561 826, și
103 893 192 de octeți de atribute (+30,3 MB). Marginile de nord și de est ale cutiei
taie uscat drept; dincolo de ele continuă împrejurimile (vezi „Zona alpha și
împrejurimile”).

`ortofoto.mjs` scrie acum un raport pe hartă, `ortofoto-culori.<hartă>.json`:
`paleta.mjs` citește fix raportul lui `harta_v2`, ca albedourile vederii Relief să
nu se mute, iar `strat-ndvi` pe al bazei pe care lucrează. `ortofoto.mjs` citește
harta din `public/data/`, deci raportul lui `harta_v2` se reface numai cu harta
scoasă din istoric: `harta_v2-dem.bin` și `-dem.json` din `v0.0.11`, puse temporar
în `public/data/`, apoi `npm run ortofoto -- harta_v2` și, la sfârșit, scoase.
Extrase cu redirecționare în Git Bash, nu în PowerShell 5.1, care strică octeții.

### Stratul NDVI: `<nume>-ndvi.bin`

Pe fiecare nod al hărții, indicele de vegetație din infraroșul ortofotoului. E un
strat al aceleiași grile, nu o hartă nouă — de aceea poartă numele hărții, ca
`-dem`. Îl produce `npm run strat-ndvi` și intră în depozit, fiindcă dala de
ortofoto nu intră.

- **4 biți pe nod**: nodul `i` în octetul `i >> 1`, pe jumătatea de jos dacă `i` e
  par. Codul 0 = fără NDVI (apă, pixel fără date, nod pe care plasa nu-l
  folosește); 1–15 = NDVI după tabelul `niveluri` din sidecar, pas 0,05 pe
  [−0,10; 0,60]. Pagina decodează din tabel, nu dintr-o formulă.
- **De ce 15 niveluri:** pasul e cât zgomotul datelor citite. Pe `harta_v0`,
  NDVI-ul nivelului de 2 m diferă de media aceleiași imagini la 0,25 m cu mediana
  0,014, p90 0,040 — recomprimarea JPEG a nivelului, nu terenul. Un octet întreg
  l-ar stoca, cu +36% la transfer în loc de +13%. Măsurat: regula de culoare pe
  NDVI cuantizat față de necuantizat diferă cu ΔE_OK×100 medie 0,37, p99 1,95.
- **Baza citește nivelul de 2 m ca atare, cu zgomotul lui.** Nivelul de 0,5 m
  mediat 4 × 4 ar avea mediana 0,002 față de 0,25 m, iar nivelul de 2 m dă alt cod
  decât datele fine la 34% din noduri. Pe culoare efectul e în jur de 0,35 ΔE, sub
  prag. S-a păstrat nivelul de 2 m ca proba de clase să rămână comparabilă cu
  `ortofoto.mjs`; trecerea la 0,5 m e o îmbunătățire posibilă, nu o reparație.
- **Peticul NU se citește de la nivelul de 1 m.** Nodurile lui cad acolo pe
  COLȚURILE pixelilor (convenția „noduri", vezi mai jos), deci culorile ar ieși
  deplasate cu 0,707 m spre sud-est. Se ia media benzilor pe blocuri 2×2 de la
  nivelul de 0,5 m, iar NDVI-ul se calculează după medie. Nivelul îl alege
  `deschideAliniat()` din `scripts/strat-ndvi.mjs`: cel mai grosier pe care
  nodurile se aliniază exact (2 m la `harta_v4`, 0,5 m cu blocuri 2×2 la
  `harta_v5`). `aliniaza()` din `scripts/comun/ortofoto.mjs` nu alege nimic:
  primește un nivel, ține cont de convenția de noduri și aruncă dacă nu se
  aliniază. Verificarea de dinainte compara `bbox.xMin`, iar la `harta_v1`
  trecea tăcut. Tot în `comun/`, `fereastra()` refuză o fereastră care iese din
  dală, în loc să citească tăcut dale din alt loc.

Scriptul se oprește singur dacă pică una dintre probe:
- clasificarea din `ortofoto.mjs`, refăcută pe NDVI-ul lui, dă exact 208 700 /
  208 570 / 88 985 / 266 953 (tufăriș / uscată / calcar / potecă) pe `harta_v4`;
  pe `harta_v2` erau 122 388 / 122 256 / 61 813 / 185 438. Raportul trebuie să
  fie al bazei hărții cerute: cu o bază încărcată, altfel scriptul aruncă —
  înainte sărea proba în tăcere. O hartă fără bază o sare, scris cu majuscule. Dovedește că
  cele două scripturi citesc același lucru, NU alinierea absolută: amândouă
  folosesc `aliniaza()` și `fereastra()`, deci un decalaj comun ar trece.
  Alinierea bazei stă pe aritmetică — nodul cade pe centrul pixelului, decalajul
  106 × 703 iese întreg;
- corelația NDVI dintre petic și bază, pe cele 62 902 noduri comune de uscat, are
  maximul la deplasare (0, 0): **0,9840**, iar vecinii de ±0,5 m sunt la 0,98. Proba e
  față de bază, nu față de alt nivel al ortofotoului: o greșeală comună de indice
  ar trece de a doua.

### Convenția `bbox_tm06`: două scripturi, două înțelesuri

`build-zona.mjs` scrie dreptunghiul de **decupare** (muchii de celulă), deci
primul nod cade la `xMin + pas/2`. `build-petic.mjs` scrie poziții de **noduri**
ale bazei, deci primul nod cade chiar la `xMin`. Diferența e o jumătate de celulă.

Semnul care le distinge, fără ambiguitate: `xMax − xMin` e `lățime · pas` la
prima și `(lățime − 1) · pas` la a doua (2328 față de 2326; 534 față de 535).
`scripts/comun/relief.mjs` **deduce** convenția din aritmetică și aruncă dacă nu
se potrivește niciuna. Nu presupune.

### Dalele 104xxx: o jumătate de celulă

Dalele de 2 m din coloana de vest — `MDT-2m-104161`, `104162`, `104163` — nu stau
pe grila celorlalte. Au colțul la x0 = −95441 (impar) și 221 de coloane, iar a
221-a e NODATA pe toate rândurile: umplutură, fiindcă 441 m nu se împart la 2.
Centrele pixelilor cad la x par, nodurile hărții la x impar. În `build-zona`,
`(x − X_MIN) / 2` ieșea atunci un întreg exact — o egalitate —, iar `floor` alegea
nodul estic: **`harta_v0` avea fiecare pixel din 104162 cu 1 m spre est**. Erau
6 421 de noduri de uscat, în vârful de vest; pe faleză, înălțimea greșea cu până
la 14,5 m (mediana 0,48 m). 104161 și 104163 n-au uscat.

Ce a dovedit-o, nu doar a sugerat-o:
- `MDT-50cm-104162` are aceeași origine, −95441, și se termină exact la −95000.
  Înregistrarea 2 m ↔ 50 cm iese la (0, 0), dar e **relativă**: două antete
  greșite la fel ar trece.
- Proba **absolută** e cusătura la 0,5 m cu `MDT-50cm-105162`, dală standard:
  distanța dintre centrele ultimei coloane din stânga și ale primei din dreapta
  iese **0,50 / 0,47 m**, pe 432 de rânduri. Antet corect ⇒ 0,5; dală mutată cu
  1 m ⇒ −0,5. Controalele, între ele cusătura standard 105163/105162, citesc
  0,40–0,55.
- `MDT-50cm-105162` e **LZW** (`Compression = 5`, predictor 1, un rând pe bandă).
  Proba de atunci l-a decodat cu un decodor scris pe loc, verificat prin
  înregistrarea față de dala de 2 m 105162: minim la (0, 0). Acum îl citește
  `tiff.mjs` — vezi „Dalele comprimate", mai jos.

Reparația, în `build-zona.mjs`:
- O dală de 2 m al cărei colț nu cade pe muchiile de celulă ale hărții nu se mai
  lipește cu `floor`. Fără uscat (104161, 104163) se sare; cu uscat, celulele
  cuprinse ÎNTREGI în amprenta ei se refac din dala de 50 cm cu același indice;
  dacă aceea lipsește, `throw`. Marginea de est a lui 104162 (−94999) taie celula
  de la −94999 în două, iar aceea rămâne a lui 105162.
- Regula unui bloc 4 × 4, calibrată pe 105163, unde există ambele produse: apă
  numai dacă toate 16 sub-celule sunt apă, altfel media celor 16 cu marea ca 0 m.
  Așa își face DGT produsul de 2 m: 632 de celule cu altă mască din 250 000
  („apă dacă oricare": 1 829), RMS 0,07–0,12 m pe blocurile amestecate („media pe
  uscat": 0,14–0,62). NODATA nu stă niciodată lângă uscat, deci regula n-o simte.
  `build-petic` ignoră apa la medie — altă convenție, fără urmări acolo, fiindcă
  peticul e în interior.
- Proba de înregistrare rămâne în script și oprește dacă minimul nu e la (0, 0)
  sau dacă 1 m nu se deosebește de 0: azi 0,435 m la (0, 0), 1,52 m la 1 m.
- Alt pas înseamnă altă hartă: `npm run build-zona -- 4` cere acum și un nume nou
  (`-- 4 harta_vN`). Înainte scria tăcut peste harta pe care stau peticul și NDVI-ul.

Acceptarea, pe `harta_v2`: diferă de `harta_v0` exact 6 406 noduri din fâșie (161
trec din uscat în apă) și cele 14 190 limitate, de mai jos; **0** în rest. Refăcută
independent din 50 cm, fâșia iese la RMS 0,0007 m, sub o cuantă; mutată cu 0,5 m,
0,86 m. Pe cusătura cu 105162, testul pe perechi de rânduri dă 35% de rânduri
care preferă un gol de 3 m — cât nulul, 0,34 —, față de 49% pe `harta_v0`.

**Cusăturile dalelor DGT de 2 m au un artefact propriu.** Coloana exterioară a
fiecărei dale citește, pe cusături sigur bune, un gol de 2,6–3,6 m în loc de 2.
O probă de continuitate pe cusătură trebuie să sară o coloană de margine de
fiecare parte și să aibă controale pe cusături cunoscute; altfel confirmă ce te
aștepți. La 0,5 m artefactul nu apare.

**Uint16 nu taie.** Până la `harta_v2`, zMax era maximul din CONTUR, dar cutia
avea relief mai înalt în afara lui, până la 150 m. În `harta_v0`, 14 190 de noduri
de acolo treceau de 65535 și se înfășurau până la „apă"; `harta_v2` le limita la
65535, adică la 143,64 m. Cât conturul le ținea în afara plasei nu se vedeau. Acum
conturul e cutia, deci zMax e maximul cutiei, iar un nod limitat oprește
`build-zona`.

**`build-petic` citește o listă, nu un director.** `DALE` numește dalele de
50 cm. Cutia lor (`acop`) reteză conturul peticului, care coboară la −138063,
sub marginea lui 105163. Orice dală în plus care coboară sub −138000 lărgește
cutia și, odată cu ea, peticul, cu 64 de rânduri. Cu 104162 sau 106162, care nu
stau sub petic, banda ar rămâne fără date: 34 240 de noduri fără nicio probă și
~26 500 de celule de uscat tăiate ca apă — găuri în teren. Cu 105162 banda ar avea
date, dar peticul tot s-ar schimba, deci ar fi altă hartă. O gardă numără probele
fiecărui nod, cu tot cu apa: un nod acoperit întreg are exact (pas / 0,5)², oricâte
dale i-ar împărți pătratul. `date-sursa/lidar-50cm/` are acum și 104163 (numai apă și NODATA)
și 105162 (LZW), pe care nu le citește niciun script de hartă.

### Dalele comprimate

Catalogul DGT nu spune care dală e comprimată: 105162 e LZW, vecina 105163 e
brută. `citesteTiffDGT()` citește acum compresia 1 și 5, cu predictorii 1, 2 și 3
(`scripts/comun/lzw.mjs`); orice altceva aruncă, cu codul compresiei. Întoarce și
`epsg`, `tipRaster` (1 = PixelIsArea) și `nodata`, pe care le cer probele de
sosire ale unei dale noi. Rândurile se cer prin `t.rand(r)`, cu o bandă decodată
ținută minte; `randTiff(t, r)` a rămas, ca alias.

LZW-ul din TIFF nu e cel din GIF: lățimea codului crește cu un cod mai devreme
(la 511, nu la 512). Cu regula GIF fluxul se rupe — sau, mai rău, trece pe
bucăți. `npm run verifica-tiff` are un codor scris numai pentru probă și cere
ca decodorul să refuze fluxul cu regula GIF. Pe date reale:
- 105162 se decodează întreagă în ~180 ms;
- media blocurilor 4 × 4 față de dala de 2 m are minimul la (0, 0): 0,176 m,
  față de 0,659 m la 1 m;
- cusătura 105163 (brută) | 105162 (LZW) arată 0,109 m între rândurile vecine,
  cât între două rânduri din aceeași dală, 0,111 m.

**`build-zona` caută în `lidar-50cm/` numai `MDT-50cm-*`.** În același director
stau și MDS-urile sanctuarului, cu aceiași indici; „MDS" vine alfabetic înaintea
lui „MDT", deci înainte ar fi fost găsit primul.

## Busola și nordul adevărat

Scena e așezată pe grila TM06: `+X` e estul grilei, `−Z` e **nordul grilei**.
Nordul adevărat e altceva. Zona stă la ~95 km vest de meridianul central al
proiecției (λ₀ = −8,133108°), deci convergența meridianelor e **γ = −0,673704°**:
nordul adevărat cade cu 0,67° la **est** de nordul grilei. Pe rozetă asta face
0,47 px — deci nu se vede, și tocmai de aceea nu se verifică din ochi.

γ **nu e scris ca o constantă.** `src/scene/busola.js` îl deduce din
`colturi_geo` al hărții de **bază** — peticul `harta_v5` n-are cheia asta, numai
`harta_v4` — ca media azimutului celor două muchii verticale. Scalarea
longitudinii NU e `cos(φ)`, ci `cos(φ)·N(φ)/M(φ)` pe GRS80; cu `cos(φ)` singur γ
iese sistematic mai mic cu 0,414%. Fără `colturi_geo`, busola **nu se creează**
și spune de ce: mai bine lipsește decât să arate cu convingere un nord care nu e.

Verificare independentă, din parametrii proiecției:
`γ = atan(tan(λ−λ₀)·sin φ)` dă −0,673397°. Cele 0,0003° rămase sunt rotunjirea
colțurilor la șase zecimale în sidecar (~0,1 m pe o muchie de 2986 m). Un sidecar
cu mai puține zecimale ar lărgi eroarea proporțional, tăcut.

**Capcana semnului.** `OrbitControls.getAzimuthalAngle()` întoarce
`Spherical.theta = atan2(x, z)` al vectorului de la țintă la cameră, deci
`theta = 0` înseamnă camera la SUD, privind spre nord. `theta` **nu** e azimutul
privirii, ci minus el. „Nordul în sus" e `theta = γ`, nu `theta = 0`.

Cifra afișată e azimutul **poziției** camerei — dinspre ce direcție privești —,
nu al privirii. La pornire scrie `306° NV` (306,28°).

**Vederea de pornire** e `VEDERE_START` din `camera.js`: poziția camerei și
ținta, în coordonatele scenei, citite din pagină pe 2026-09-30, pe vederea aleasă
de autor — dinspre mare, peste faleze, cu sanctuarul sus și farul în dreapta.
Scrise ca puncte, nu ca azimut: azimutul adevărat cere γ, care se află abia din
sidecar, după ce camera există. Ținta citită stătea la y = −61, sub mare, fiindcă
vederea fusese trasă lateral; s-a mutat pe raza privirii până la y = 60, cota pe
care o cere `maxPolarAngle` ca să nu lase camera sub planul mării. Aceeași
imagine — rotunjirea la centimetru rotește privirea cu 0,0006° —, pivotul la
611,22 m în loc de 968,53. Pe orice ecran e aceeași, cu lateralele tăiate pe
cele înguste: așa a cerut autorul. `incadreazaLaAspect()`, care dădea camera
înapoi pe ecranele înguste, a plecat.

**Clicul duce acasă** — la vederea de pornire —, cu ținta, distanța și înălțimea, nu numai
azimutul: busola cheamă `acasa()` din scenă, care cheamă `zbor.spre(VEDERE_START)`, același zbor din `zbor.js` cu
care eticheta duce la sanctuar. Busola nu mai are zbor propriu. Dacă fișa
sanctuarului e deschisă, se închide întâi — închiderea șterge sincron decalajul
de obiectiv, altfel zborul ar ateriza cu imaginea mutată —, iar focusul trece pe
rozetă. Un al doilea clic, cu camera deja acolo, nu mai zboară. Tasta **Home** face
același lucru, numai unde nu are deja alt rost: nu într-un câmp, într-o fișă sau un
panou care defilează, în textul capitolelor sau într-o modală deschisă. Decide
elementul cu focus, iar când acela e `<body>` — după un clic pe text care nu ia
focus, un rând din fișă —, locul ultimei apăsări: altfel Home închidea fișa în loc
s-o ducă sus. Ținută apăsată, contează numai prima apăsare; repetările ar fi pornit
zborul de la capăt la fiecare 33 ms.

**Zborul pune poziția ABSOLUT**, nu cu `rotateLeft()`. Acela există și e public
în r186, dar adaugă un *delta* într-un acumulator care se scurge exponențial;
deltele se compun, deci două clicuri repezi ar trece de țintă.

**Absolut nu ajunge, totuși — inerția trebuie descărcată întâi**
(`descarcaInertia`, în `camera.js`). `update()` nu citește doar poziția camerei,
ci îi ADAUGĂ acumulatorul:
`_spherical.theta += _sphericalDelta.theta * dampingFactor` (OrbitControls.js:717).
Cu amortizare pornită acumulatorul nu se golește niciodată — se stinge doar cu
×(1 − dampingFactor) pe cadru (:801). Singura ramură care îl golește e cea fără
amortizare (:808), iar `_sphericalDelta` e privat, deci aceea e toată calea
publică spre el: amortizarea se stinge, `update()` se cheamă o dată, apoi se
repune. Butonul rozetei nu e copil al canvasului, deci OrbitControls nu emite
„start" la clicul pe el. Tot acolo se golesc treptele rotiței care încă alunecă
(vezi „Mouse-ul, degetele și cursorul”): sub reduced-motion zborul sare direct la
capăt, iar treptele rămase l-ar fi împins de acolo — măsurat, 375,7 m.

Cât greșea, măsurat pe vechiul zbor al busolei, care rotea numai theta: după o
aruncare de 66° urmată imediat de clic, ateriza la **0,098°** de țintă; pe calea
`prefers-reduced-motion`, unde poziția se scria o singură dată, se pierdea toată
prima felie, `inerție × dampingFactor`: măsurat exact **0,8°** pentru 10° rămase.
Inerția se APLICĂ, nu se aruncă: ramura fără amortizare o adaugă întreagă înainte
să golească. Camera ajunge unde se ducea gestul, iar zborul pleacă de acolo.

Tot la început, `spre()` golește zborul în curs. Altfel un zbor spre sanctuar încă
în aer, urmat de un clic pe busolă sub `prefers-reduced-motion`, ar fi dus camera
înapoi la sanctuar la cadrul următor: măsurat, la 1 092 m de vederea de pornire.

Și, înaintea inerției, `spre()` încheie gestul în curs (`incheieGestul`, în
`camera.js`). Home apăsat cu harta ținută — butonul stâng, sau un deget pe o tabletă
cu tastatură — lăsa apucarea legată de un punct de LUME: zborul ateriza exact, iar la
prima mișcare harta sărea înapoi după el, măsurat **1 469,8 m**. Nu ajunge să uiți
punctul: `_panStart` rămâne cel de la apăsare, iar mutarea lui OrbitControls sărea
169,3 m. Zborul eliberează captura, lasă documentul și emite `end`, ca o ridicare;
fără pointer apăsat nu face nimic, deci nici `end` fără `start`. Ca să tragi din nou,
apeși din nou. Spre deosebire de o ridicare, un deget rămas pe sticlă trimite mai departe
`pointermove` la document: `ControaleHarta` le lasă să treacă numai pe ale pointerilor
urmăriți. Altfel, un deget nou pus pe hartă era deturnat de cel vechi — măsurat, salturi de
321,7 m după zbor și de 327,1 m după `blur` —, iar un deget mișcat pe busolă cât altul ține
harta muta harta cu 344,5 m. Probele, cu controlul fără filtru, sunt în `verifica-controale`. Busola și eticheta pornesc zborul la `click`: cu mouse-ul nu se poate în
timpul unei trageri, fiindcă pointerul e capturat de canvas.

**NaN-ul nu intră în zbor.** `Math.min` și `Math.max` lasă NaN să treacă, deci un
punct de privire cu un câmp lipsă ajungea în cameră: cu `distanta` lipsă durata ieșea
NaN, iar zborul nu se mai termina și randa la fiecare cadru; cu `azimut` lipsă se
termina, cu camera NaN; un `null` în țintă, socotit 0, ducea ținta tăcut la cota 0. Azi
nu se cunoaște nicio sursă: `poi.zbor` e o constantă din `build-sanctuar`, verificată de
proba zborului. Trei gărzi:
- `spre()` judecă valorile CALCULATE — ținta, distanța, unghiurile, pe ambele forme —
  și refuză, cu un avertisment, înainte să atingă ceva: gestul, inerția și zborul în
  curs rămân cum erau;
- o cameră deja NaN, de oriunde ar veni, sare la capăt, ca sub reduced-motion. Animat,
  Home și busola n-o mai reparau;
- `pas()` încheie zborul pe `!(t < 1)`, nu pe `t >= 1`: o durată NaN nu-l mai ține activ.

Pe traiectoriile obișnuite reparația e identică la bit: cinci zboruri — spre sanctuar,
după o aruncare, acasă în zbor, sub reduced-motion, cu ambele forme ale punctului —,
7 343 de valori ale camerei și ale țintei, cadru cu cadru, 0 diferite cu `Object.is`.

**Probe care pot eșua.** La pornire busola scrie **306° NV**; cu nordul grilei ar
scrie 307°, cu semnul lui γ inversat 308°. Poziția și ținta camerei sunt exact
`VEDERE_START` la pornire și după clicul pe busolă, de oriunde ar pleca: în pagină,
de la 2,3 km, la 4·10⁻¹⁴ m. Iar `__scena.busola.convergenta` trebuie să cadă la
mai puțin de 0,001 de valoarea analitică: pragul e ales ca să pice dacă factorul
elipsoidal lipsește. Zborul înapoi are probele lui și în `npm run verifica-sanctuar`:
din zborul spre sanctuar, după o aruncare și sub reduced-motion (0 cadre), la
sub 10⁻¹² m; aterizarea nu depinde de nord; al doilea clic nu pornește nimic. Tot
acolo, NaN-ul: `distanta` lipsă, `azimut` lipsă, un `null` în țintă și poziția chiar în
țintă se refuză, cu camera neatinsă și un avertisment; camera NaN urmată de Home
animat ajunge acasă la 3·10⁻¹⁴ m. Pe codul de dinainte pică toate cinci — zborul încă
activ după 2 000 de cadre, sau încheiat cu camera NaN ori cu ținta la cota 0 în loc de
132,67 m. Control:
același Home sub reduced-motion, care trecea și înainte.

## Punctul de sub clic

`src/scene/punct.js` — clic stâng pe scenă, iar panoul din dreapta-jos spune unde
e punctul, în trei sisteme, și cât de sus. Butonul copiază tot, cu punct zecimal:
panoul e text românesc și se citește, textul copiat pleacă în altă parte.

**Pornește minimizat.** Se vede numai butonul „Coordonate”. Cât e minimizat,
clicul pe scenă nu culege nimic — nicio rază, niciun rând —, iar `culegeLa()`
întoarce `null`; o apăsare începută înainte de minimizare nu mai culege nici ea.
Activat, focusul trece pe „–”, care îl minimizează la loc, iar ultimul punct
rămâne. Mișcarea camerei nu depinde de el. Unde stă:
- pe desktop, dreapta-jos, sub coloana busolei, deasupra versiunii paginii;
- pe ecranele late dar scunde (≤ 32rem), la stânga coloanei busolei;
- pe telefon, pe rândul de jos, la stânga coloanei busolei și a lui Satelit;
- sub 22,5rem, deschis, urcă deasupra lui Satelit, pe toată lățimea; sub 17rem
  butonul rămâne numai cu semnul. Așa ajunge și un telefon de 390 px cu pagina
  mărită de două ori. Îngust și sub 30rem înălțime, cutia coboară peste Satelit.

Cutia deschisă primește clicurile: are înălțime maximă și defilează, cu antetul
lipit sus, deci „–” se vede mereu. Prin ea nu se culege și nu se rotește camera;
o cutie prin care treceau rotița și degetul nu defila deloc — măsurat la 195 px,
rotița muta camera cu 66 m. Pe desktop fișa sanctuarului și panoul deschis stau în
aceeași coloană: pe ecrane înalte fișa se oprește deasupra panoului (24rem rezervă;
pe o clădire panoul ocupă de jos 21,64rem), iar sub ~56rem își împart înălțimea
dintre 10rem și marginea de jos și defilează fiecare. Pe telefon fișa e o foaie jos,
peste busolă, Satelit și panou, ca înainte.

Cine e deschis spun atributele `data-punct-deschis` (punct.js) și `data-fisa-deschisa`
(eticheta.js) de pe `<html>`, scoase la `dispose()`; înainte, `:has()`, pe care Firefox
115 ESR nu-l are. Înălțimile maxime ale cutiei se scriu cu `--vizibil`: `100dvh` sub
`@supports`, altfel `100vh`. O linie cu `vh` pusă înaintea celei cu `dvh` n-ar fi ajuns:
declarațiile au `env()` și `var()`, deci se acceptă la parsare și devin invalide abia la
calcul, iar `max-height` ajunge `none`. Proba, în panoul Browser (2026-10-08), cu foaia
simulată:
- fără `:has()` — regulile șterse din `document.styleSheets` —, la 1280 × 720, cu panoul
  pe `far.turn` și fișa deschise: fișa trecea cu 250,3 px peste cutie, cu tot cu antetul;
  acum se oprește cu 16 px deasupra ei, cât și cu `:has()`;
- fără `dvh` — foaia reinjectată cu `dvh` → `dvhx` —, la 844 × 390, cu panoul pe
  `far.turn`: `max-height` era `none`, iar cutia urca până la y 25,3, în banda rândului cu
  sursele; acum 299,6 px, cu cutia de la y 60, ca în Chromium cu `dvh`. Control: o linie
  cu `vh` înainte dă tot `none`;
- la 320 × 256, cu panoul deschis, versiunea e ascunsă; minimizat, se vede;
- `npm run verifica-pagina` păzește foaia: niciun `:has(`, `dvh` numai în rezervă; pe
  foaia de dinainte pică.

Pe Firefox 115 și pe Chrome 94–107 adevărate nu s-a încercat
<!-- NEVERIFICAT: pagina în Firefox 115 ESR și într-un Chrome sub 108 -->.

**Nu se dă raycast pe plasă.** `raycaster.intersectObject()` pe geometria
neindexată costă **53 ms pe rază**, măsurat pe cele 2,56 milioane de triunghiuri
de atunci. Pe un câmp de înălțimi nu e nevoie: se merge pe rază cu pasul de
8 m, se prinde schimbarea de semn față de `inaltimeLa`, apoi 22 de bisecții. Măsurat acum:
**0,19 ms**. Și e *mai* exact — pe fiecare celulă testează chiar interpolarea pe
care o citește `inaltimeLa`, nu triunghiurile plasei decupate. Bucla stă în
`src/scene/raza.js` (`marsPeTeren`), de când o folosesc și rotița, apucarea hărții și
pivotul; mutată, dă aceleași rezultate, cu `Object.is`, pe 20 000 de raze.

**Butonul stâng rămâne al controalelor** — mută harta. Selectorul de altădată îl
confisca; aici nu. Ce deosebește clicul de mutare e un prag de **5 px** între
apăsare și ridicare. Ridicarea se ascultă pe `globalThis`, nu pe canvas:
controalele mută `pointermove`/`pointerup` pe `ownerDocument` cât ține
tragerea, deci o tragere care se termină în afara canvasului n-ar mai declanșa
niciodată ridicarea pe el, iar apăsarea ar rămâne agățată. Pe telefon, o atingere
măsoară; al doilea deget anulează clicul — înainte îl înlocuia pe primul, deci o
ciupire cu un deget ținut pe loc ajungea să măsoare.

**Se măsoară numai în zona alpha**, cum a cerut autorul. Un clic dincolo de ea — pe
mare sau pe împrejurimi — scrie „În afara zonei alpha: aici nu se măsoară” și nimic
de copiat. Împrejurimile sunt decor: banda de lângă hartă (`harta_v6`) e tot LiDAR
DGT, dar la 4 m, iar de acolo încolo un model de suprafață de 30 m; `geo.js` ar
extrapola coordonatele din colțurile hărții, iar `inaltimeLa` al lui alpha prinde
indicii la marginea grilei — la (1300, 0), la 136 m est de cutie, ar fi dat
139,72 m, care pare măsurătoare și nu e. Raza merge totuși peste relieful
împrejurimilor (`inaltimeRandata`, `limiteMars`): un clic pe un deal din fața hărții
se oprește pe deal, nu pe alpha din spatele lui — măsurat: clicul țintit pe
(2600; −3000), din nord-est, cade la (2600; −3000).

**Punctul e ce se VEDE sub cursor**, cu același `punctVazut` ca zoomul rotiței și
apucarea hărții: relieful, o clădire sau, pe apă, suprafața mării la `COTA_MARE`
(−0,25 m) — nu umplutura de −8 m de sub ea. În alpha, lon/lat, scena și TM06 se arată
deci întotdeauna, iar pe mare sunt ale locului atins. Înainte, raza panoului mergea
numai pe relief, trecea de suprafață și se oprea pe umplutură: din vederea de pornire,
la 1600 × 900, pe marea din alpha (47% din pixeli) punctul ieșea mutat de-a lungul
razei cu 7,75 m / tan(elevație) — mediana 13,54 m, până la 34,52 m, de ~100 de ori
precizia afișată. Planul de rezervă, pentru marea de dincolo de capătul mersului, a
trecut și el de la y = 0 la `COTA_MARE`; fără el, un clic acolo ar lăsa pe ecran
punctul de dinainte, în loc de „În afara zonei alpha”. Clădirile rămân în `cuCladire`,
care le ține și numele, cu aceeași prioritate ca în `punctVazut`: la egalitate,
terenul. Altitudinea primește etichetă după o regulă verificabilă:

- **„apă"** dacă altitudinea nu e strict pozitivă. Regula vine din sidecar, nu
  din ochi: `regula_apa` spune „exact 0.0 m sau NODATA (−999); plaja, care are
  valori mici dar nenule, rămâne uscat", iar celulele acelea sunt coborâte la
  `zMin_m = −8`, „artificiu de randare, nu batimetrie". Deci uscatul măsurat e
  strict pozitiv prin construcție; orice valoare negativă e umplutură sau
  interpolare cu ea.

`Y` din coordonatele de scenă **este** altitudinea, deci primește exact același
tratament: fără acoperire, se scrie „—", nu o cifră.

Altitudinea vine din `inaltimeLa` **compus** — peticul de 1 m acolo unde există,
baza de 2 m în rest. Nu e cosmetic: diferența dintre plase e ~2 mm în mijlocul
peticului și până la 0,153 m pe cusătură.

`src/scene/geo.js` face conversiile scenă ↔ TM06 ↔ longitudine/latitudine,
ancorate pe **centrul** lui `bbox_tm06` — vezi convenția de mai sus. Longitudinea
și latitudinea se dau cu **6 zecimale**, exact câte are `colturi_geo` în sidecar:
mai multe ar fi precizie inventată peste o sursă rotunjită.

**Rândurile mici** — scena și TM06 — au câte un element pe axă (`.axa`), în linie,
despărțite de un spațiu lărgit cu `word-spacing` cât două spații. Erau un text cu două spații între
axe, pe care `white-space` le strângea într-unul (CSS Text 3): pe ecran rămânea unul.
Pe un rând prea îngust o axă trece întreagă pe rândul următor, în loc să iasă din
cutie, iar litera nu se mai desparte de cifra ei: la 195 px (390 cu pagina mărită de
două ori), textul vechi lăsa „Z” la capăt de rând și cifra pe rândul următor. Textul
copiat nu se schimbă, iar o selecție făcută de mână peste rând iese tot pe o linie. Ca itemi
flex, axele erau blocuri, iar selecția le scotea câte una pe rând (recenzia).

**Probele.** `npm run verifica-controale` cheamă panoul adevărat, cu un DOM falsificat,
prin `culegeLa`, pe 100 × 56 de pixeli ai vederii de pornire, la 1600 × 900: pe cei
5 200 cu ceva sub cursor, punctul e al lui `punctVazut` la 0 m; pe cei 2 645 de pe
marea din alpha eticheta e „apă” peste tot, iar fiecare axă stă în elementul ei.
Control: compunerea veche, înghețată în probă, pune punctul de pe mare la mediana
13,53 m (cel mult 33,99 m); cu `punct.js` vechi pus la loc pică două probe, cu 3 107
pixeli la peste 1 µm. În pagină, la 916 × 417, pe 625 de pixeli: 0 la peste 1 µm,
„apă” pe 316 din 316.

Rândurile mici, în pagină, cu valorile cele mai lungi (X −1163,00 · Y 168,28 ·
Z −1492,00; TM06 X −95790,00 · Y −138900,00): golul dintre axe e de 2,0 spații
(6,86 px pe desktop, 6,33 px pe telefon); textul cu două spații avea lățimea celui cu
unul. Rândul scenei stă pe o linie pe desktop, la 360, 320 și 844 × 390; la 390 × 844,
390 × 330 și 195 px, Z trece pe al doilea rând. Rândurile mici nu fac cutia să
defileze pe orizontală la nicio lățime, nici cu o bară de defilare clasică de 15 px,
simulată cu o margine de 16 px, și nicio axă nu se rupe. Singura depășire nu vine de
la ele: la 195 px, cu bara simulată, cutia iese cu 6 px din cauza rândurilor mari
(altitudine, longitudine, latitudine), la fel și înainte.

## Mouse-ul, degetele și cursorul

Harta se mânuiește ca o hartă, la cererea autorului (2026-10-07):

| | desktop | telefon |
|---|---|---|
| mutare | butonul stâng | un deget |
| unghiul (rotire și înclinare) | butonul drept; Shift, Ctrl sau Cmd + stâng | două degete trase împreună (punctul lor de mijloc, nu răsucire) |
| zoom | rotița, spre cursor; butonul din mijloc tras | ciupire, spre punctul dintre degete |

Așa fac ArcGIS SceneView, Mapbox/MapLibre și Potree EarthControls; model viewer-ele
(Sketchfab, OrbitControls implicit) au stânga = rotire. Controalele sunt
`ControaleHarta` din `camera.js`: `MapControls` din r186, care are deja așezarea asta și
mutarea pe orizontală, cu patru lucruri în plus.

**Rotița** (`src/scene/rotita.js`). OrbitControls schimbă distanța cu 0,95^(Δ · 0,01) pe
eveniment: de la 80 m la 8 km erau ~90 de clicuri în Chrome (Δ = 100 px) și ~190 în
Firefox (3 linii × 16). Acum un clic e o treaptă de ×1,4 — 14 clicuri pe tot drumul —
oricum l-ar raporta browserul:
- în linii sau în pagini;
- pe macOS (Safari și Chrome), un multiplu exact de 4,000244140625 px, cum îl recunoaște
  și MapLibre;
- în pixeli, un eveniment de cel puțin 20 de pixeli de DISPOZITIV, singur (niciunul în
  300 ms) sau egal cu cel dinainte. Chrome împarte delta la mărirea paginii — 100 px la
  100%, 40 la 250%, 33 la 300% —, dar `devicePixelRatio` o conține; Windows cu „1 linie pe
  clic” dă 33. Pragul de dinainte, 50 px CSS, nu mai vedea clicul de la 250% în sus, iar
  pe macOS un clic ajungea 4% dintr-o treaptă (recenzia).

Restul vine de la un touchpad — rafale cu valori care se schimbă — și merge proporțional
(100 px, o treaptă) și pe loc, la fel ca ciupirea pe touchpad, pe care browserul o
trimite ca rotiță cu Ctrl. Un eveniment aplicat pe loc nu golește treptele din coadă:
înainte, 120, 120, apoi 30 px făceau 0,97 trepte în loc de 2,3. Fiecare treaptă
alunecă ~0,2 s (`1 − e^(−dt/60 ms)`, iar restul sub 10⁻³ se aplică dintr-odată), în buclă,
fără al doilea ceas; sub reduced-motion, pe loc. Coada ține cel mult patru trepte.
`deltaMode` se citește înaintea lui `deltaY`: Firefox raportează în linii numai dacă e
întrebat întâi de mod.

**Spre cursor.** Camera merge pe raza cursorului — `C' = P + (C − P) · s` —, deci punctul de
teren de sub cursor, P, rămâne pe același pixel, iar orientarea nu se schimbă. Ținta se
pune apoi pe raza privirii, la înălțimea pe care o avea, între 80 m și 8 km și în cutia lui
alpha (`intervalRaza`); imaginea nu depinde de unde stă ținta pe raza aceea. Dacă pasul
întreg nu încape, `s` se înjumătățește geometric până încape. Gărzile:
- camera nu ajunge la mai puțin de 80 m de P. Fără gardă, din vederea de pornire spre
  platou, 40 de clicuri o duceau la 1 m de el, sub planul apropiat;
- P e ce se VEDE sub cursor (`punctVazut` din raza.js): relieful, suprafața mării la
  `COTA_MARE` — nu umplutura de −8 m de sub ea — sau o clădire (`loveste` al sanctuarului
  și al celorlalte, ca la panoul punctului). Fără clădiri, garda se măsura față de terenul
  din spatele farului: 14 clicuri spre lanternă duceau camera la 0,58 m de ea;
- P se caută până la 3 · r: o treaptă spre un deal din împrejurimi, la 30 km, ar fi sărit
  kilometri. Fără nimic sub cursor, P e un punct al razei, la distanța r;
- zoomul înapoi n-are voie să se blocheze: ce n-a încăput spre P se face spre țintă —
  camera se retrage pe raza privirii, ținta rămâne —, până la 8 km. Cu ținta lipită de o
  muchie a cutiei (pe mare, la perete), raza privirii doar atinge cutia, iar din rotunjire
  intervalul ieșea gol: recenzia a găsit rotița blocată în ambele sensuri, în 20% din
  astfel de stări. `intervalRaza` are acum o toleranță de 10⁻⁹ · t.

`zoomToCursor` din OrbitControls nu ajungea: cu mutarea pe orizontală și privirea la mai
puțin de 20° sub orizont — vederea de pornire are 19,85° — el doar întoarce camera spre
ținta veche, iar punctul de sub cursor fuge.

**Apucarea.** Butonul stâng și un deget apucă punctul de **teren** de sub cursor și îl țin
sub cursor, prin planul orizontal al lui, fără întârzierea amortizării — tot `punctVazut`,
deci pe mare suprafața, nu umplutura (altfel marea aluneca sub cursor cu 11–23%). MapControls apucă
planul prin țintă — la vederea de pornire, 60 m: plaja rămânea în urma cursorului cu ~22%,
platoul o lua înainte cu ~50% —, iar o tragere pornită pe cer îi lăsa un punct de start
vechi (`intersectPlane` nul nu-și scrie ținta). Pe cer, sau mai departe de 4 · r, mutarea
rămâne cea obișnuită. Lângă orizont un pixel acoperă sute de metri, deci acolo harta se
mută repede: așa face și apucarea din Google Earth.

**Pivotul pe teren.** La începutul unei rotiri — butonul drept, sau două degete — și al
zoomului cu butonul din mijloc, ținta coboară pe raza privirii până la ce se vede: teren,
suprafața mării, o clădire. Raza e aceeași, deci imaginea nu se mișcă, iar camera se
rotește în jurul locului privit, nu al unui punct care plutește la 60 m deasupra mării.
Zoomul spre cursor lasă ținta la înălțimea ei, deci după câteva clicuri spre platou ea
stă sub relief; butonul din mijloc, care apropie spre țintă, ducea atunci camera la 4,31 m
sub teren.

**Cursoarele**, numai pe desktop (`@media (hover: hover) and (pointer: fine)`), desenate ca
SVG de 32 × 32 cu hotspotul în centru (`src/styles/cursoare/`; Vite le pune în CSS ca data
URI), în culorile paginii:
- în repaus, o sferă aurie mică; cât e deschis panoul „Coordonate”, sfera cu un punct
  central (`data-culege` pe canvas, din punct.js);
- cât ții butonul stâng, patru săgeți aurii în jurul sferei;
- cât ții butonul drept, două arce cu săgeți în jurul ei — cursorul „orbită” al
  programelor Autodesk.

Gestul îl scrie `src/scene/gest.js` pe `<html>` (`data-gest`), din `controale.state` citit la
`start` — după ce controalele au hotărât ce fac, deci și cu Shift. Pe `<html>` și cu
`!important`, ca o tragere care trece peste text sau peste un panou să-și păstreze
cursorul. Valorile stărilor sunt `_STATE`, privat în OrbitControls, scrise în `STARE`;
proba le citește înapoi. `connect()` trece prin `disconnect()`, care scrie pe canvas
`style.cursor = 'auto'` inline: `ControaleHarta` îl scoate la creare și la `dispose()`.

**Gestul se încheie și fără `pointerup`.** OrbitControls îl încheie numai la `pointerup`
sau `pointercancel`, iar `pointermove` îl ascultă pe document, fără să citească `buttons`.
Dacă fereastra pierdea focusul în mijlocul unei trageri (Alt+Tab) și `pointerup` nu mai
venea, gest.js ștergea cursorul, dar controalele rămâneau în MUTARE sau ROTIRE: harta urma
mouse-ul fără buton, și peste textul paginii, până la primul clic. Acum `ControaleHarta`
încheie gestul la `blur` pe fereastră și la `lostpointercapture` pe canvas, iar gest.js
ascultă numai `start` și `end`. Captura pierdută încheie numai pointerul ei — dacă unul din
două degete o pierde fără să se ridice, celălalt mută mai departe —, iar după un `pointerup`
obișnuit pointerul nu mai e urmărit, deci ea nu mai face nimic: browserul o pierde implicit
abia după ridicare. Proba ei o face fără `pointerup`; cu ridicarea înainte, ramura nu s-ar
atinge. Eliberarea capturii stă
în `try`: pe un pointer care nu mai e activ specificația cere NotFoundError, iar
`_onPointerUp` al lui OrbitControls s-ar fi oprit chiar acolo, cu gestul deschis. Dacă
browserele trimit totuși `pointerup` la Alt+Tab nu s-a încercat de mână
<!-- NEVERIFICAT: Alt+Tab adevărat în mijlocul unei trageri, în Chrome, Firefox și Safari -->;
reparația nu depinde de asta.

**Pagina mărită cu degetele.** Canvasul acoperă tot ecranul, iar OrbitControls îi scrie
`touch-action: none`. Mărită pe textul fișei sau pe fundalul modalei „© DGT”, unde
ciupirea e a paginii, pagina nu se mai putea micșora de pe hartă: un deget muta harta, două
o apropiau, iar busola, Satelit și „Coordonate”, fixe, puteau rămâne în afara zonei mărite.
Acum, cât `visualViewport.scale` trece de 1,01, canvasul ia `touch-action: manipulation`
(sinonimul lui `pan-x pan-y pinch-zoom`, cunoscut și de Safari pe iOS), iar controalele se
opresc: `urmaresteMarireaPaginii` din camera.js, chemată de scena.js după `creeazaCamera`
și eliberată prin `deEliberat`. Degetele și rotița sunt atunci ale paginii; o atingere
scurtă măsoară mai departe. Starea se citește și la creare: pagina poate porni mărită, cu
scara restaurată la reîncărcare sau din bfcache. Consecința pe desktop: o mărire cu
touchpadul, pornită pe un panou, oprește și mouse-ul pe hartă, până la micșorare; ciupirea
pe hartă micșorează atunci pagina, fiindcă rotița cu Ctrl nu mai e oprită de controale.
<!-- NEVERIFICAT: pe telefon, în Android Chrome și iOS Safari — modala „© DGT” mărită pe fundal, închisă, apoi micșorată cu două degete pe hartă; la fel cu fișa sanctuarului -->

**Atingerea lungă.** Canvasul are `user-select: none`, `-webkit-touch-callout: none` și
`-webkit-tap-highlight-color: transparent`; rozeta, Satelit, „Coordonate”, „–” și eticheta
sanctuarului, numai `user-select: none` — n-au stare `:active`, deci pe iOS evidențierea
atingerii e singurul lor semn. Textele fișei, ale panoului, ale capitolelor și rândul cu
sursele rămân selectabile, iar linkurile surselor își păstrează previzualizarea. Pe iOS
`contextmenu` nu vine la atingere, deci OrbitControls nu oprea selecția, iar
`touch-action` acoperă numai mutarea și ciupirea — din cunoștințe
<!-- NEVERIFICAT: apăsare de 1 s pe hartă, peste platou și peste mare, pe un iPhone, înainte și după; dacă nici înainte nu apare lupa sau selecția, constatarea se închide -->.
În pagină: `#scena` și cele cinci butoane dau `user-select: none`; `dd` din panou, `li`
din fișă, un `p` pus în `#continut` și rândul cu sursele, `auto`. Control: cu
`body { user-select: none }` toate trei textele ies `none`; pe codul de dinainte, `#scena`
dădea `auto`.

**Pivotul rotirii** e o sferă aurie (`.pivot-rotire`) pe ținta camerei, cât ține rotirea —
ca la Revit și Potree. Se proiectează pe cadrul care se desenează, după
`camera.updateMatrixWorld()`, ca eticheta, și se stinge printr-o tranziție CSS de 250 ms,
fără niciun cadru cerut. Clasa nu e `.pivot`: acela e cercul din mijlocul busolei, pe care
l-ar fi făcut invizibil.

**Probele** — `npm run verifica-controale`, cu codul paginii, pe 1600 × 900:
- treptele, trecute prin `_customWheelEvent` al controalelor: 100 și 120 px, 3 linii, o
  pagină, 4,000244 px pe macOS, 40 px la 250% și 33 px la 300%, 33 px cu „1 linie pe clic”
  dau exact o treaptă; 12 × 8,33 px de touchpad, una ± 1%; o rafală 60, 75, 90 px, 2,25,
  proporțional; control: prin normarea lui OrbitControls, 3 linii dau 0,48 trepte;
- ce a găsit recenzia, fiecare cu controlul ei: 120, 120 și 30 px fac 2,3 trepte (cu coada
  golită, 0,97); cu ținta în peretele de vest, pe mare, 45 de stări, 10 tangente, 0 clicuri
  fără efect; spre lanterna farului camera rămâne la 80 m (fără clădiri, 0,58 m); butonul
  din mijloc după un zoom spre platou o ține cu 68 m peste relief (fără pivot, −4,31 m);
  marea apucată rămâne sub cursor la 10⁻¹³ px (umplutura de −8 m, la 4,6 px);
- zoomul spre cursor, pe o grilă de 9 cursoare, din vederea de pornire și cu decalajul
  fișei: punctul de sub cursor rămâne la 2·10⁻¹² px, azimutul și înclinarea la 2·10⁻¹⁶ rad;
- spre platou, camera la cel puțin 80 m de punct (control fără gardă: 1 m); spre plajă,
  camera cu cel puțin 3,2 m peste țintă, iar ținta deasupra mării; spre împrejurimi,
  limita lui alpha n-are ce muta (control fără cutie: ținta iese de 6 ori din 12); 40 de
  clicuri înapoi ajung exact la 8 000 m; de la 8 km la 80 m, 14 clicuri;
- o treaptă: 22 de cadre, ln aplicat egal cu ln 1,4 la 10⁻¹⁵, apoi 0 cadre cerute;
- rotiță, apoi zborul acasă: aterizarea la 10⁻¹³ m (control cu treptele lăsate în coadă:
  375,7 m);
- gestul întrerupt, cu un canvas, un document și o fereastră care chiar își țin
  ascultătorii și captura (eliberarea emite `lostpointercapture`, iar pe un pointer
  inactiv aruncă NotFoundError):
  - tras 290 px, Home cu harta ținută, cu mouse-ul și cu un deget, zbor animat și sub
    reduced-motion: aterizarea la 4·10⁻¹³ m, iar 1 px și 300 de cadre o lasă acolo, cu un
    singur `end`; o apăsare nouă apucă din nou terenul. Controale: fără gestul încheiat,
    1 469,8 m; uitând numai punctul apucat, 169,3 m;
  - `blur` sau `lostpointercapture` în mijlocul unei mutări sau rotiri, fără `pointerup`:
    200 px fără buton mută camera cu 0 m, cu un `end`. Control, fără ascultătorii noi:
    128,8 m la mutare, 900,7 m la rotire, 0 `end`;
  - o tragere obișnuită, apoi `blur`: un singur `end`; două degete, ridicat A: B mută
    harta cu 128,8 m, fără `end` până la ridicarea lui (control, captura pierdută încheie
    `_pointers[0]`: 0 m); un deget inactiv, apoi `blur`: gestul se încheie, nimic aruncat
    (control, prin `_onPointerUp`: NotFoundError, gestul rămâne deschis);
  - pe codul de dinainte pică șapte dintre ele;
- stările citite la `start`: drept → rotire, stâng → mutare, Shift + stâng → rotire,
  mijloc → zoom, un deget → mutare, două → zoom și rotire, ridicat unul → mutare;
- metodele și câmpurile private folosite există — dacă three se schimbă, aici pică;
- panoul „Coordonate” culege același punct ca zoomul și apucarea, și pe mare (vezi
  „Punctul de sub clic”): 0 m pe 5 200 de pixeli; control, compunerea veche: pe mare,
  mediana 13,53 m;
- pagina mărită, cu un `visualViewport` fals pus înainte de creare: pornită la scara 2,
  fără niciun `resize`, `touch-action: manipulation` și controalele oprite, iar o atingere
  nu pornește niciun gest; la scara 1 și sub prag (1,005), `none`, iar atingerea mută
  harta; un ascultător cât trăiește scena, 0 după eliberare; fără `visualViewport`,
  `none`. Controale: codul de dinainte și urmărirea numai la `resize` lasă `none` și
  controalele pornite la scara 2.

`verifica-sanctuar` construiește acum controalele zborului cu `creeazaCamera`, nu cu un
OrbitControls copiat de mână, care n-avea nici `minPolarAngle`.

În pagină, cu evenimente sintetice (panoul ascuns, deci bucla condusă de mână):
- punctul apucat rămâne sub cursor, cu mouse-ul și cu un deget, la 0 px;
- trasă în peretele lui alpha și înapoi 25 px, harta răspunde imediat;
- la rotire, pivotul cade pe teren (la 14,62 m, pe relieful de acolo), imaginea nu se mișcă,
  iar sfera stă pe ținta proiectată la 0 px;
- un clic măsoară, o tragere de 40 px nu, o atingere da, două degete nu;
- Home în mijlocul unei trageri de 290 px (2026-10-08): pe loc starea −1, 0 pointeri,
  fără `data-gest`, un `end`; zborul aterizează la 3,6·10⁻¹³ m, iar 1 px de mișcare cu
  butonul ținut o lasă acolo, fără al doilea `end` la ridicare;
- `blur` sau `lostpointercapture` în mijlocul unei mutări sau rotiri, cu inerția stinsă
  de mână: 200 px fără buton, 0,000 m și un `end`; cu ascultătorii noi scoși, 128,2 m
  (după `blur`) și 91,6 m (după captura pierdută) la mutare, 940,5 m la rotire, 0 `end`;
- `visualViewport.scale` falsificat la 2, cu `resize` (2026-10-08): `touch-action:
  manipulation` și controalele oprite, iar un `pointerdown` pe canvas nu pornește niciun
  gest; înapoi la 1, `none`, iar același `pointerdown` pornește mutarea. Pe codul de
  dinainte rămânea `none`, cu controalele pornite;
- după `dispose()`: niciun `data-gest`, niciun pivot, niciun cursor inline, 0 geometrii.

## Cum se generează plasa terenului

`src/scene/terrain.js` transformă grila de înălțimi într-un singur mesh cu
fațete plate. Patru lucruri de acolo nu se pot ghici din cod fără măsurătoarea
care le-a motivat.

**Celulele de apă nu se generează.** Toate patru nodurile la `zMin_m` înseamnă
umplutură, nu batimetrie — o spune `regula_apa` din sidecar. Sunt 930 714 din
cele 1 641 746 de celule păstrate ale bazei `harta_v4` (56,7%) și 122 858 din cele
373 800 ale peticului (32,9%), iar marea e un plan **opac** de 120 km la `COTA_MARE`, pe
sub care camera nu poate coborî: ținta nu coboară sub cota mării (cutia lui alpha),
`minDistance` e 80 și `maxPolarAngle` e π/2 − 0,04, deci camera stă cu cel puțin
80 · sin 0,04 = 3,2 m peste țintă. Cifra de dinainte, 64,6 m, era pentru ținta la
y = 60 și ieșea greșit: 60 + 3,2 = 63,2. Erau desenate la
fiecare cadru și nu se puteau vedea niciodată. Triunghiuri, pe `harta_v2`:
2 562 454 → 1 362 122; pe `harta_v4`, cu uscatul din afara conturului, 1 923 948.

Se taie numai celulele cu TOATE patru nodurile la cotă; malul rămâne întreg. Iar
`inaltimeLa` citește din `grila`, nu din plasă, deci tăierea nu atinge panoul
punctului: un clic pe mare întoarce punctul de pe suprafața mării, la `COTA_MARE`, și
eticheta „apă" (vezi „Punctul de sub clic”).

**Nu există atribut `normal`.** Cu `flatShading: true`, shaderul r186 nu-l
citește: sub `FLAT_SHADED` varianta `vNormal` nici nu se declară, iar
`normal_fragment_begin` calculează `normalize(cross(dFdx, dFdy))` — planul
fațetei, adică exact ce am fi scris. Pe geometrie neindexată cu normale de
fațetă cele două sunt același plan. Scapă 92 248 344 de octeți din RAM și de pe
placă, plus 127 ms de `computeVertexNormals()` la fiecare pornire. Excepția sunt
nivelurile de la 12 m încolo ale împrejurimilor, netezite (`neted`, `campNeted`): vezi
„Zona alpha și împrejurimile”.

**Culoarea stă pe `Uint16` normalizat**, 6 octeți pe vârf în loc de 12. `Uint8`
NU merge: valorile din atribut sunt liniare, iar un pas de 1/255 în liniar
înseamnă la luminozitate mică ~2,5 niveluri de afișare — benzi pe faleza
umbrită. Pe 16 biți eroarea e 0,0005–0,0011 dintr-un nivel din 255.

**Conversia sRGB → liniar se face dintr-un tabel de 256 de intrări**, nu prin
`Color.setHex` pe fiecare fațetă. E bit-identică — aceeași formulă din
`ColorManagement.SRGBToLinear`, pe aceeași intrare `octet / 255` —, verificată
în pagină față de `setHex` însuși pe șapte culori, inclusiv alb, negru și
0x010101.

**Sfera de încadrare se scrie, nu se calculează.** Dar nu se poate nici lăsa
`null`: `WebGLRenderer` o calculează el pe calea de sortare, activă implicit.

Efectul cumulat, măsurat pe pagină: atributele de vârf scad de la 276 745 032 la
**73 554 588 de octeți (−73,4%)**, în RAM și pe GPU deodată. Pe `harta_v4`, cu
+561 826 de triunghiuri, sunt 103 893 192 — tot 54 de octeți pe triunghi.

Proba care contează: randare într-o țintă fixă de 640 × 400, aceeași cameră,
înainte și după. Din 256 000 de pixeli **diferă 176, adică 0,069%, fiecare cu
exact 1 din 255 pe un singur canal** — cuantizarea culorii, răsturnând rotunjirea
acolo unde pixelul stătea chiar pe pragul ei. Nu e „identic la pixel", și nu se
scrie așa.

**Bucla plată e o funcție de modul, numai cu scalari** (`plasaPlata`, 2026-10-08), pentru
grilă și fâșie; închiderea de dinainte făcea patru tablouri pe celulă și unul cu iterator
pe triunghi. Apa se întreabă înaintea lui `pastreaza` (pe bază, 1 735 196 → 774 562 de
apeluri), iar `mascaBazei` sare `inPoligon` în interiorul strict al unui contur-dreptunghi
(al lui `harta_v4` e cutia). La rece, în Node, mediana a 7 rulări: baza 151 → 115 ms,
peticul 63 → 45. Atributele sunt identice la bit, și în pagină: `verifica-teren` cere
sha256 pe position, color, cutie și sferă cât în `AMPRENTA` (citită pe codul vechi) și
cel mult 774 562 de apeluri, iar codul vechi pică. Controale: diagonala cu `<` schimbă
sha-ul (2 747 de nepotriviri la proba 2); scurtătura cu muchiile incluse greșește 140 de
puncte din 1 736 496. Cu câmpul netezit și cu drapajul (în „Zona alpha și împrejurimile”
și „Sanctuarul”), cadrul lung de la
pornire scade în pagină de la 524 la 406 ms (build de producție, Long Animation Frames,
mediana a 5 încărcări).

## Cum se colorează terenul

`culoareTeren(panta, altitudine, p, ndvi)` din `src/scene/palette.js`. Regula a fost
multă vreme `TODO(human)`, ca decizie de autor; autorul a delegat-o explicit, iar
ea s-a scris din măsurători. Comentariul de deasupra ei poartă cifra care a decis
fiecare parametru.

**De ce are nevoie de NDVI.** Numai din pantă și altitudine nu se află unde e
vegetația. Tufărișul și vegetația uscată au aceeași pantă mediană (14,1° față de
12,6°) și aceeași altitudine mediană (103,4 m amândouă); cea mai bună regulă
posibilă pe cele două le desparte la întâmplare pe date nevăzute, iar antrenată pe
sudul hărții și aplicată pe nord cade sub clasa majoritară. Informația stă în
infraroșul ortofotoului — vezi stratul NDVI, la hărți.

**Ce face:**
- roca: potecă → calcar după pantă, lin între 20° și 40°;
- vegetația: uscată → tufăriș după NDVI, liniar între medianele claselor, 0,261 →
  0,410. Nu sunt două populații: NDVI-ul vegetației are un singur vârf, iar pragul
  vechi de 0,341 îl tăia la mediană;
- cât din fiecare: rampă pe NDVI, de la mediana rocii (0,017) la a vegetației uscate;
- faleza: peste 55° vegetația se stinge, peste 70° e numai rocă — ortofotoul vede
  peretele din muchie;
- amestecul se face în RGB **liniar**, cum reflectă o fațetă acoperită pe jumătate;
- fără strat: vegetația după cotă, în patru noduri măsurate;
- fără `p.masurat`: `GRI_REZERVA`.

**Apa n-are caz special, și nu trebuie să aibă.** Fațetele de la mal coboară la
umplutura de −8 m pe cel mult 2 m în plan, deci au panta de peste 76° și ies calcar
exact. Pe petic câteva fațete de la apă stau întregi sub mare, în inelul de
cusătură, unde relieful e interpolat între −8 m și uscat: nu se văd niciodată.

**Albedo, nu aparență.** Regula nu corectează lumina. Cu soarele la 18°, platoul
chiar iese mai închis decât în pozele de la amiază; asta se reglează în lumini sau
în expunere, nu în culoare.

**Probe care pot eșua** — toate în `npm run verifica-teren`:
- argumentul primit de fiecare din cele 1 923 948 de fațete e egal cu o recalculare
  independentă din `.bin`: **0 nepotriviri**. Proba chiar pică dacă un indice de nod
  e greșit — încercat;
- toate fațetele de la apă de deasupra mării ies calcar (5 378 pe bază, 2 714 pe petic);
- calea fără strat o iau numai fațetele scufundate întregi (1 001 + 549);
- peticul față de ce ar picta baza sub el: ΔE_OK×100 al mediilor **0,245** pe toată
  zona, 0,116 pe fâșia de 20 m de la margine — dreptunghiul peticului nu se vede;
- numai cu dala de ortofoto pe disc: ΔE față de ortofoto, pe cele 1 415 685 de
  fațete de uscat ale bazei `harta_v4`, **10,27** medie / 8,51 mediană (pe
  `harta_v2`, pe 855 495 de fațete: 10,21); pragul e 11. Pe aceleași fațete griul
  de rezervă dă 11,62 (pe v2: 11,70), iar regula fără strat 15,55 (pe v2; 15,56 pe
  `harta_v0`) — deci
  pragul prinde o regulă căzută înapoi pe gri sau un strat ignorat. Cu ancore potrivite pe
  ortofoto ar fi 5,46 (măsurat pe `harta_v0`): diferența e că paleta e albedo, iar ortofotoul are umbrele
  în el. Cifra aceea nu se calculează în unealtă.

Regula costă ~+45 ms la construcția bazei, în Node; `verifica-teren` tipărește cifra.

## Cerul și ceața mării

`src/scene/cer.js`: cerul Preetham din three (`Sky.js`), **senin** — norii lui cer un
`time` care curge, iar scena desenează la cerere. Cutia are 40 km și stă pe planul
îndepărtat (`gl_Position.z = w`); camera ajunge la cel mult 8 km de țintă.

**Expunerea se calculează.** Sky.js e scris pentru ~0,5 sub ACES; sub AgX la 1 iese
altfel. `expunereCer` e factorul la care orizontul OPUS soarelui are luminanța culorii
de cer a paletei (`paleta.cer`, 0x7d92a6), deci pagina rămâne la fel de luminoasă ca
înainte: 0,21 cu soarele Relief (18° / 244°), 0,075 cu al zborului (39,5° / 94°) —
Preetham e mult mai luminos cu soarele sus. Tema deschisă de până la v0.1.1, cu
cerul 0xdfe8ef, avea 2,18 și 0,79.

**Portul JS.** `cerLiniar()` și `agx()` refac în JS exact formulele shaderului și
ale lui `AgXToneMapping` din r186 (matricile coloană cu coloană, ca în GLSL). Cu ele
se află expunerea și media orizontului fără să se citească pixeli. Proba, în pagină,
pe cinci direcții (orizont spre soare și opus, 30°, 60°, zenit): pixelii GPU și
portul dau **aceiași octeți**, ΔE_OK×100 sub 0,1.

**Ceața mării e pe fiecare pixel**, cu culoarea cerului la orizont pe azimutul
privirii (`GLSL_CER`, cu uniformele cerului), trecută prin AgX și prin conversia de
ieșire — ceața three se amestecă DUPĂ ele. O ceață de o singură culoare nu se poate
potrivi cu un cer care variază după azimut. Legea e și ea alta decât a scenei:
exponențială, `LUNGIME_CEATA_MARE` = 10 km. Cu cea liniară de 5–24 km, de la câteva
sute de metri înălțime ceața completă cădea la 6 pixeli sub orizont, iar marea
rămânea închisă până la linia cerului — o dungă. Planul mării are 120 km, de două
ori planul îndepărtat, deci marginea lui nu se vede niciodată.

Cusătura orizontului, cu privirea orizontală din larg, rândul de cer față de marea
de sub el: ΔE 0,50 / 0 / 0,53 opus soarelui / spre el / lateral; o ceață de culoare
constantă ar da 2,85 / 4,54 / 0,59. Alpha stă sub 5 km de cameră și primește ceața
obișnuită, liniară, cu media orizontului ca culoare — aceeași lege ca înainte, deci
terenul de aproape iese neschimbat. Împrejurimile, până la 50 km, păstrează legea
liniară, dar iau culoarea cerului de pe azimut — vezi „Zona alpha și împrejurimile”. Cadre desenate în 2 s de repaus: 0.

## Randarea: ordinea de desenare, mărimea canvasului, compilarea

### Cerul ultimul, marea după teren

three sortează lista opacă întâi după `renderOrder`, apoi după `material.id`
(WebGLRenderLists.js:7-13), iar cerul și marea își fac materialele înaintea terenului. Se
desenau deci primele: cerul, Preetham și AgX pe fiecare pixel, se umbrea pe tot ecranul și
se acoperea apoi pe 93% din pixeli la pornire și pe 100% de aproape; marea, cu ceața pe
pixel, se umbrea sub teren pe 37% la pornire și pe 89–100% de aproape (acoperirea, din
recenzie). În Satelit marea trecea și înaintea împrejurimilor și a terenului.

Acum cerul are `renderOrder = 2` (cer.js), marea 1 (mare.js) — pe obiect, deci și când
Satelit îi schimbă materialul. Marea, desenată după teren, are `depthFunc = LessDepth` în
ambele materiale (mare.js și `mareM` din satelit.js): la egalitate de adâncime câștigă tot
terenul, ca înainte, când el venea al doilea pe `LessEqual`. Cerul rămâne pe `LessEqual`:
adâncimea lui e exact 1,0, cât a curățării, deci cu `Less` n-ar trece nicăieri. Nu scrie
adâncime, deci nici transparentele de după el nu se schimbă.

Probele:
- `npm run verifica-pagina`, cu sortarea lui three însuși: cerul ultimul și marea înaintea
  lui, și cu materialul mării din Satelit (`materialMareSatelit`, același ca în pagină);
  marea pe `Less` în ambele materiale, cerul pe `LessEqual` fără să scrie adâncime. Control: fără `renderOrder`, cerul iese primul. Codul de dinainte
  pică pe trei;
- în pagină (panoul Browser, țintă fixă 640 × 400, fără MSAA, ieșire sRGB, cutia umbrelor
  pusă de mână pe fiecare vedere): acasă, sanctuarul, farul și de la 8 km, pe Relief și pe
  Satelit, față de codul de dinainte — **0 pixeli diferiți** în toate opt. Ordinea, din
  `onBeforeRender`: Relief „teren, teren, sanctuar, drapaj-1…4, clădiri, harta_v6, v9, v7,
  v8, mare, cer”, Satelit „sanctuar, clădiri, harta_v6…v8, teren, teren, mare, cer”;
  înainte, Relief începea cu „cer, mare”, iar Satelit cu „cer, sanctuar, clădiri, mare”:
  materialele Satelit se fac abia când sosesc texturile. Controale: fără `Less` pe mare, 19 pixeli
  diferiți pe țărm de la 8 km pe Relief (18 pe Satelit, cel mult 83 pe un canal) și 2 acasă;
  cerul ultimul, dar fără test de adâncime, schimbă 93% / 100% / 100% / 87,65% din cadru
  (acasă / sanctuarul / farul / 8 km);
- timpul GPU (EXT_disjoint_timer_query_webgl2, Intel UHD 770 prin ANGLE D3D11, panoul
  vizibil, mediana a 15 randări, vechi și nou alternate în aceeași sesiune), pe canvasul de
  916 × 914 cu MSAA:

  | vederea | Relief | Satelit |
  |---|---|---|
  | acasă | 17,45 → 17,38 ms | 12,49 → 11,98 ms |
  | sanctuarul | 18,99 → 17,54 | 12,89 → 11,93 |
  | farul | 18,12 → 16,81 | 12,56 → 11,80 |
  | 8 km | 17,15 → 16,53 | 12,67 → 12,14 |

  Într-o țintă de 1600 × 900 cu MSAA 4 cifrele merg la fel (sanctuarul, Relief: 23,39 →
  21,83), cu o excepție: Relief acasă iese +0,2 ms (21,45 → 21,63). Desfăcut, acolo
  câștigul vine numai din cer (pe canvas −0,17 ms, în țintă ~0), iar marea mutată după
  teren costă puțin (+0,05 pe canvas, +0,18 în țintă), fiindcă acum se umbrește și
  terenul de sub suprafața ei, pe care înainte îl oprea testul de adâncime. Pe
  GPU-urile Apple, care nu umbresc fragmentele opace acoperite, câștigul ar trebui să fie
  aproape zero <!-- NEVERIFICAT: raționament, nu măsurătoare -->.

### Mărimea canvasului

`redimensioneaza()` din `renderer.js` are două plafoane: raportul de pixeli, cel mult 2 —
alegerea autorului, 2026-10-08 —, și 2560 × 1440 de pixeli de dispozitiv. MSAA rămâne. Un
telefon de 390 × 844 la 3× avea 1170 × 2532 (2,96 MP), sub plafonul de pixeli; acum are
780 × 1688 (1,32 MP). Pe GPU-ul desktopului, Satelit la mărimea aceea costa 15,8 ms față de
13,0 la 2× (linia de bază); pe un telefon adevărat câștigul nu e măsurat. Desktopul
(1600 × 900 la 1×, 1440 × 900 la 2× → 2428 × 1517) și tableta (1024 × 1366 la 2× →
1662 × 2217) nu se schimbă. Bufferul de desen la 390 × 844 la 3× e, calculat și nemăsurat,
35,5–47,4 MB cu rezolvarea MSAA implicită și 118,5–130,3 MB cu cea explicită; la 2× e de
2,25 ori mai mic <!-- NEVERIFICAT: ce rezolvare MSAA alege Chrome pe telefon -->.

Ce a costat: un telefon în peisaj pornește cu umbrele pe cutia unită (vezi „Umbrele pe
grupuri”), iar cu pagina mărită de două ori pe telefon (195 × 422 la 6×) canvasul rămâne
390 × 844 — un pixel randat pe 3 × 3 ai ecranului. Un buget de pixeli pe
`(pointer: coarse)`, care n-ar depinde de mărire, nu s-a ales.

Probele: `npm run verifica-pagina`, pe un renderer fals — telefonul 780 × 1688, în peisaj
1688 × 780, un Android de 412 × 915 la 3,5× 824 × 1830, desktopul, laptopul și tableta ca
înainte, `setSize` mereu cu `false`; codul de dinainte pică pe patru (1170 × 2532). În
pagină: presetul mobil al panoului (375 × 812, DPR 2) dă 750 × 1624, iar cu
`devicePixelRatio` forțat la 3, 390 × 844 dă 780 × 1688 și 844 × 390 dă 1688 × 780.

### Compilarea, înaintea primului cadru

three compilează programele la prima randare și așteaptă acolo, sincron, legarea fiecăruia.
`construieste()` le compilează întâi — `await renderer.compileAsync(scena, camera)`, în `try`,
după ultima plasă și chiar înaintea buclei —: cu KHR_parallel_shader_compile se leagă în
paralel, fără să blocheze firul. Fără extensie programele trec drept gata (WebGLProgram.js:995),
iar promisiunea se rezolvă după un temporizator de ~10 ms (WebGLRenderer.js:1567), cu legarea tot
pe primul cadru <!-- NEVERIFICAT: calea fără extensie, citită în cod -->. Programul umbrei
rămâne pe primul cadru (`compile()` nu face trecerea de umbre). Satelit își compilează
materialele pe plase-proxy, înaintea lui: între `compileAsync` și buclă stă numai așteptarea
fotografiei (vezi „Vederea Satelit”). Pe un context pierdut Chromium dă `COMPLETION_STATUS_KHR`
adevărat, deci așteptarea nu se agață.

Măsurat pe build, în panou, cu fila în față (Intel UHD 770, ANGLE D3D11, canvas 916 × 914),
din Long Animation Frames, câte 4 încărcări alternate, când primul cadru era încă Relief.
„Rece” = programe noi pentru cache-ul ANGLE: un script injectat de serverul de probă pune în
fiecare shader un `#define` unic; codul vechi dă așa cam cât auditul pe un profil nou de browser
(391–393 ms).

| | primul cadru | din el, legarea | cadrul gata, de la ultima dată sosită |
|---|---|---|---|
| rece, înainte | 370–383 ms | 298–315 ms | 659–702 ms |
| rece, după | 99–109 ms | 32–38 ms | 459–508 ms |
| cald, înainte | 119–131 ms | 48–59 ms | 402–434 ms |
| cald, după | 96–101 ms | 31–33 ms | 409–447 ms |

La prima vizită imaginea apare cu ~0,2 s mai devreme; la reveniri, cam la fel: legarea trece
din cadru în așteptarea de dinaintea lui. Construcția, ~0,3 s, e altă sarcină, neatinsă.
Probele, în pagină: primul cadru citit din canvas și vederea de pornire în țintă fixă
640 × 400, pe Relief, **0 pixeli diferiți** față de codul de dinainte (control: Satelit în
aceeași țintă, 255 639); 7 programe la primul cadru Relief și 11 după Satelit; contextul
pierdut în timpul compilării și refăcut după 0,5 s: harta pe ecran, 0 erori; 0 încălcări CSP pe
`cabo-espichel-productie`. `npm run verifica-pagina` păzește ordinea, pe sursă: pică pe scena.js
de la `30a22c9` și cu compilarea mutată după buclă. Pe telefon nemăsurat
<!-- NEVERIFICAT: câștigul pe un GPU mobil -->.

## Zona alpha și împrejurimile

**Zona alpha** e harta pe care se lucrează: `harta_v4` cu peticul `harta_v5`, numită
așa de autor pe 2026-10-07. E singurul spațiu de interacțiune: pe ea se măsoară, pe
ea stau etichetele, în jurul ei se rotește camera. `src/scene/alpha.js` îi dă
cutia NODURILOR — x ∈ [−1163; 1163], z ∈ [−1492; 1492], nu ±1164 / ±1493 ale
dreptunghiului de decupare — și ține ținta camerei în ea: dacă a ieșit, ținta și
camera se mută înapoi cu ACELAȘI vector, deci orientarea și distanța rămân
(măsurat: 1·10⁻¹³ m). Sfera din OrbitControls (`cursor` + `maxTargetRadius`) ar fi
lăsat ținta cu ~730 m dincolo de marginile de est și vest și cu ~400 m dincolo de
cele de nord și sud (raza ei e 1 892 m). Limita se prinde la `change` — și sub
reduced-motion, când OrbitControls își cheamă singur `update()` — și în buclă, pentru
restul pe care îl mai împinge amortizarea. Redesenare cere numai o mutare de peste un
milimetru, pragul lui OrbitControls: amortizarea împinge ținta în perete sute de
cadre cu fracțiuni de milimetru, iar pe podeaua y = 0 resturile ajung denormale și
țin ~8 900 de cadre — recenzia măsurase redesenări continue până la ~2,5 minute.
Acum, după o panoramare împinsă în podea sau în perete, 0 cadre în 2 s după inerție.
De când harta se mută ca o hartă, mutarea e orizontală: pe verticală ținta o mută
numai zborurile, zoomul spre cursor și pivotul pus pe teren, iar zoomul o așază din
capul locului în cutie (`intervalRaza`). Cât mutarea ține un punct apucat sub cursor,
limita mută și punctul: altfel, după ce tragi harta în perete, înapoi n-ar răspunde
nimic până când cursorul n-ar ajunge din nou unde e punctul.

**Împrejurimile** sunt peisajul real de dincolo de marginile tăiate ale lui alpha,
până unde ceața scenei îl acoperă de tot. Fără ele, din nord-est harta arăta ca o
foaie care plutește peste planul mării. Sunt decor: nu primesc umbre, nu au etichete,
nu se măsoară pe ele.

| nivel | sursă | pas | noduri de uscat | triunghiuri | textura Satelit |
|---|---|---|---|---|---|
| `harta_v6` | dalele DGT de 2 m, filtru cort 1-2-1 | 4 m | 109 248 | 216 105 | ortofoto, 2 m, 0,62 MB |
| `harta_v9` | dalele DGT de 2 m, filtru cort 1-2-…-6-…-2-1 | 12 m | 69 151 | 138 203 | ortofoto, 2 m, 3,09 MB |
| `harta_v7` | Copernicus GLO-30 | 32 m | 37 853 | 75 834 | ortofoto unde acoperă, altfel Sentinel-2; 16 m, 0,22 MB |
| `harta_v8` | Copernicus GLO-30, media a 8 × 8 eșantioane, pe un disc de 50 km | 256 m | 30 931 | 64 457 | Sentinel-2, 64 m, 0,59 MB |

În total +494 599 de triunghiuri (+25,7%), 27,9 MB de atribute (cu normalele nivelurilor
netezite), 7,14 MB de fișiere — din care 3,09 MB textura de 2 m a lui `harta_v9`. ETC1S ar fi
dat 0,62 MB, cu ΔE_OK×100 1,35 după decodare față de 0,22 (p99 6,0 față de 1,6); s-a păstrat
UASTC, alegerea autorului pentru alpha.
De ce până la 50 km: ceața three e PLANĂ (`vFogDepth = −mvPosition.z`), camera poate
sta la ~10 km de centru, iar colțurile unui ecran 16:9 văd până la ~30 km; la 25 km
uscatul ar fi fost în ceață numai pe jumătate, lângă o mare deja ~78% în ceață. Și de
ce nu mai departe: camera stă la cel mult ~9,6 km de centru, iar planul îndepărtat e la
60 km; colțurile pătratului lui `harta_v8`, la 68 km, ar fi fost retezate drept de el.
Dincolo de disc (`RAZA_V8`) nodurile sunt apă — 24 156 —, și tot de aceea lipsesc
dalele GLO-30 N37: uscatul de la sud de 38°, lângă Sines, e la peste 50 km.

**Sursele noi**, deschise, aduse o singură dată (`npm run surse-imprejurimi`, aprobat
de autor: 52,1 MB în 208 cereri, plus 0,45 MB de antete citite întâi, la probă —
Copernicus ~23 MB, Sentinel ~29,5 MB). Manifestul `scripts/imprejurimi/surse.json` ține
prima descărcare și, pe fiecare fereastră, mărimea dalelor ei din antet (53,6 MB în
total); o rulare de pe disc, care nu mai cere nimic — nici itemii STAC, ținuți și ei
pe disc —, nu le rescrie. `scripts/comun/cog.mjs` citește COG-uri pe intervale de octeți și ține pe
disc fiecare dală adusă; o construcție cere `descarca: false`, deci o dală lipsă e
eroare, nu descărcare tăcută. Originea, pasul și felul pixelului se citesc din antet:
- **Copernicus DEM GLO-30** (`copernicus-dem-30m` pe AWS), dalele N38 W010 și N38 W009,
  cu măștile FLM și WBM. PixelIsPoint: centrul pixelului (0, 0) e exact la (−9°; 39°).
  E un model de SUPRAFAȚĂ, cu coroane și acoperișuri, în EGM2008; nu se corectează.
- **Sentinel-2 L2A**, scena din 24.07.2025 (S2A, aceeași trecere peste dalele MGRS
  29SMC/SMD/SNC/SND, sub 0,04% nori), din fereastra zborului DGT. Decalajul BOA e deja
  aplicat în fișiere: reflectanța e DN × 0,0001 — pe apă B08 are mediana 259, deci
  0,026; cu încă −0,1 ar ieși negativă. Culoarea din TCI la 10 și 80 m, NDVI-ul din
  B04/B08 la 20 și 80 m, norii din SCL.

**Relieful.** `harta_v6` și `harta_v9` citesc dalele DGT numite în `NIVELURI`
(`scripts/comun/imprejurimi.mjs`), nu directorul: toate cele din catalog care ating amprenta
filtrului. Una numită care lipsește oprește construcția; una de pe disc, nenumită, care
atinge amprenta, la fel — altfel o dală adusă mai târziu ar schimba tăcut nodurile de pe
margine (recenzia: `harta_v6` s-ar fi schimbat pe coloana de est, cu până la 1,07 m, la o
simplă rescriere). De aceea `harta_v6` citește acum și coloana 107: cortul nodurilor de la
x −93001 ajunge la x −92999; refăcută, diferă exact acolo. Pătratele de 1 km din cutie fără
dală — 104164–104166, 105166, 108161, care nu există în catalog — trebuie să fie numai mare,
iar martorul e masca de apă GLO-30: 0 noduri de uscat în ele. Fără garda asta, `harta_v9`
construită fără 107165 pierdea ~1 km² de deal și toate probele treceau. Pe muchiile de nord
și est ale lui alpha, dalele dau exact `harta_v4` (1,21 mm, sub o cuantă de 2,41 mm; mutate cu
un pixel, 19,9 m); dalele 104xxx se sar, n-au uscat dincolo de alpha. `harta_v9`: filtrul cort
pe 11 × 11 pixeli, cât doi pași; fiecare dală stă pe GLO-30 minus decalaj la 0,30–1,85 m
(mediana pe nodurile plate; citite cu 1 km alături, 34,8 m). Patru dale au sub 50 de noduri
plate și sunt scrise în sidecar NEVERIFICATE de proba asta: 105165, 106161, 106162, 108162
(aceasta, numai faleză). `harta_v7` și `harta_v8`: GLO-30 se
înregistrează pe alpha — abaterea mediană minimă, 0,161 m, e exact la (0, 0); cu solul
mutat un pixel, minimul se mută cu el (0,154 față de 0,537 m) — și se coboară cu
decalajul măsurat, **−0,778 m** (IQR −0,931 … −0,612), pe 632 de pixeli de sol gol
măsurat (FLM = 2, NDVI < 0,15, pantă mică), cu DGT netezit la amprenta pixelului.
Pe o bandă de 300 m (512 la `harta_v8`) se adaugă diferența față de nivelul
dinăuntru, netezită pe 150 m, scăzută liniar la zero; numai unde amândouă au uscat.
Diferența se ia cu aceeași regulă ca nodurile — la `harta_v8` media 8 × 8, nu un
eșantion punctual, care o anula —, iar un nod de pe marginea găurii ia latura cea mai
apropiată. Înainte de bandă, p90 |Δ| e 3,82 / 3,77 m la `harta_v7` față de `harta_v9` (N / E) și
3,55 / 6,39 m la `harta_v8`. Gaura fiecărui nivel trebuie să fie cutia nodurilor nivelului
dinăuntru de pe disc: o verifică și construcția, și pagina (`incarcaImprejurimi`).
Apa: oceanul din masca WBM, lacurile și râurile numai sub 1 m — un lac de baraj e
relief —, coborâtă la −8 m ca la alpha. Nodurile din adâncul găurii au cota apei, ca
fișierul să se comprime. Pământul rămâne plat (~159 m de curbură la 45 km, sub ceață).

**Cusătura** (`src/scene/cusatura.js`). Nodurile lui alpha merg pe ±1163 și ±1492, iar
1163 e prim: niciun pas mai mare de 2 m nu le prinde pe amândouă marginile, deci o
muchie comună ar avea joncțiuni în T și crăpături. Fiecare nivel se oprește pe primul
dreptunghi al grilei lui care cuprinde STRICT gaura, iar între cele două margini se
coase un fermoar: vârfurile ambelor bucle, în sensul acelor de ceasornic, ordonate
după proiecția lor pe dreptunghiul dinăuntru. Pozițiile vin din aceleași formule ca
plasele (`geometriaGrilei`, folosită și de `terrain.js`), deci coincid la bit;
fâșia intră în plasa nivelului din afară, cu NDVI-ul vârfurilor.

**Ceața.** Împrejurimile au un material al lor, pe Relief și pe Satelit: ceața
scenei, cu legea ei liniară, dar pe culoarea cerului de pe azimutul fiecărui pixel,
ca marea (`ceataCer` din `mare.js`, cu `lege: 'scena'`). Cu media orizontului,
uscatul de la 24–50 km ieșea o fâșie gri-albicioasă, cu ΔE 7–9 față de cerul de
deasupra (măsurat de recenzie). Lângă alpha, sub 5 km, ceața e zero în ambele legi.

**Culoarea.** Relief: aceeași regulă, cu NDVI-ul fiecărui nivel. `harta_v6` îl ia din
ortofoto, ca alpha (`npm run strat-ndvi -- harta_v6`, nivelul de 1 m în blocuri de
4 × 4; proba de clase se sare, e a lui alpha); `harta_v9` tot din ortofoto, în
`textura-imprejurimi`, pe blocuri de 12 × 12 la 1 m. `harta_v7` și `harta_v8`: din ortofoto
unde acoperă, altfel din Sentinel, calibrat liniar pe ortofoto și verificat pe blocuri
ținute deoparte — `NDVI_orto ≈ −0,171 + 0,834 · NDVI_S2`, R² 0,934 la `harta_v7`;
`−0,165 + 0,815 ·`, R² 0,961 la `harta_v8`. Ortofotoul e mozaicul dalelor 464-3 și 464-1
(`deschideMozaic`), X −96 000 … −88 000, Y −140 000 … −130 000. Cusătura dintre ele nu se
vede: |Δ| de luminozitate peste ea 6,14 niveluri, pe o margine de bloc JPEG din aceeași dală
6,36, iar diferența medie cu semn pe R/G/B/infraroșu −0,06 / 0,01 / 0,02 / 0,04. Controale:
mutată 1 m, 10,92; cu +2 niveluri pe roșu sau cu R și B inversate, proba cu semn pică.
Deplasarea pe sol (+0,25 m spre est) e măsurată pe 464-3 și presupusă și pe 464-1 — o
optime de texel la 2 m. Satelit: ortofotoul unde acoperă (`harta_v6` și `harta_v9` întregi,
din `harta_v7` până la ~5,5 km spre est și ~6,4 km spre nord de marginea lui alpha), altfel
Sentinel-2 adus la ortofoto printr-o matrice 3 × 3 plus decalaj, în lumină liniară: ΔE_OK×100
3,24 la 10 m (TCI citit ca sRGB; ca liniar 3,75) și 3,93 la 80 m (TCI liniar; ca sRGB 4,01),
pe jumătatea de verificare, față de 8,77 / 17,85 fără transfer. Varianta se alege pe nivel.
Uscatul pe texeli se citește din tot lanțul, cu nivelurile din afară la urmă: texelii de
dincolo de ultimul nod ieșeau înainte apă adâncă, iar mipurile întunecau marginea (ΔL_OK×100
−5,3 la mipul 1 pe marginea de nord a lui `harta_v9`, −7 la `harta_v7`). Unde nu e nicio
culoare — la est de `harta_v7`, cadrul trece cu ~1 km de grilă, dincolo de ferestrele
Sentinel aduse —, uscatul ia culoarea vecinului colorat (7 291 de texeli). Proba: pe fiecare
latură, texelul de margine față de vecinul lui are |ΔL| cât între doi vecini dinăuntru
(`harta_v9` 3,61 față de 3,85), și niciun texel de uscat nu are culoarea mării. Pe ultimii 300 m dinspre
marginea ortofotoului, cele două se amestecă. Pe marginea datelor ortofotoului, media
urmează regula texturii lui alpha (sub jumătate de pixeli valizi, numai pe ei; altfel
pe toți), iar uscatul se citește întâi din nivelul dinăuntru. Apa se topește în apa
adâncă a lui alpha. Proba cusăturii texturii: unde `harta_v6` și baza se suprapun,
54 726 din 54 727 de texeli de uscat sunt identici cu nivelul de 2 m al bazei, iar
abaterea maximă e un nivel; citită cu un texel alături, baza mai are 164 identici.
Funcțiile comune ale texturilor (mipuri, KTX2, pierdere) stau în `scripts/comun/textura.mjs`;
`textura-ortofoto` refăcut după mutare dă aceleași fișiere, la sha256.

**Netezirea.** `harta_v9`, `harta_v7` și `harta_v8` nu au fațete plate (`NIVELURI_NETEZITE`):
fațetele de 32 m se vedeau pe Relief, de la ~2 km, ca pete — fiecare cu lumina și
culoarea ei —, iar autorul a cerut relieful netezit (2026-10-07); cele de 12 m ale lui
`harta_v9`, văzute de la 0,4–2,4 km, la fel. `harta_v6` rămâne cu fațete, ca alpha. Normala e pe nod, din diferențe centrale pe grilă, pe 8 biți cu semn
(`normal` normalizat, 3 octeți pe vârf: +1,4 MB); culoarea, tot pe nod, din aceeași
regulă, cu panta normalei și NDVI-ul nodului, iar GPU-ul le interpolează peste triunghi.
Un nod de apă ia media culorilor uscatului de pe cel mai apropiat inel de noduri din
jurul lui: o fațetă de 32 m care coboară de la 10 m la −8 m iese din mare abia la 57% din
drum, deci culoarea apei s-ar fi întins pe mal. În grilă ajunge inelul 1 — o celulă
păstrată are un colț de uscat —; în fâșia de cusătură, un nod de pe marginea grilei lui
poate avea uscatul abia la lățimea fâșiei, deci se caută până la `INELE_APA` = 8 pași
(un pas al nivelului din afară). Recenzia găsise 4 vârfuri ale fâșiei `harta_v6` |
`harta_v7` colorate cu regula pe nodul însuși, la −8 m, ca un mal deschis la culoare.
Fâșia de cusătură e în plasa nivelului din afară, deci e netezită odată cu el;
vârfurile ei iau normala și culoarea nodului lor din nivelul căruia îi aparține nodul
(`campNeted` din `terrain.js`, prin `buclaNoduri`), deci între două niveluri netezite
plasa continuă fără linie. Pe Satelit nu schimbă nimic: materialul e
neiluminat. `tot()` scrie normala numai pe uscat și pe apa cu uscat pe inelul 1 (restul
mării nu intră în nicio celulă), o singură dată pe nod, iar `imprejurimi.js` îl cheamă o
dată și îl dă lui `creeazaTeren` (`camp`): normalele cerute scad de la 645 357 la 158 789,
iar împrejurimile se construiesc în 125 ms în loc de 160 (cu bucla plată a lui `harta_v6`;
la rece, mediana a 7), cu aceleași atribute la bit.

**În pagină** (`src/scene/imprejurimi.js`): totul sau nimic, la relief și la
straturi; fără date, pagina rămâne cu marginile tăiate și un avertisment. Pe un GPU fără
niciun format comprimat, unde KTX2 iese RGBA, împrejurimile de 2 m pe texel (`harta_v6`,
`harta_v9`) pierd primul mip, ca peticul care folosește atunci textura bazei: ~67 MB pe
placă în loc de ~103 <!-- NEVERIFICAT: calea RGBA, pe un GPU fără compresie -->.

**Fără codul umbrelor.** r186 definește `USE_SHADOWMAP` pe renderer, nu pe obiect
(WebGLPrograms.js:363), deci orice material luminat calcula pe fiecare vârf poziția în harta
de umbre — un mat4 × vec4, normala în lume pentru deplasarea de normală și un varying
vec4 —, și împrejurimile, care n-au `receiveShadow` și
stau toate în afara hărții: 1 483 797 de vârfuri, 20% din terenul desenat în Relief.
`onBeforeCompile`-ul ambelor materiale (cu fațete și netezit) pune `#undef USE_SHADOWMAP`
în fața ambelor shadere, după prefixul cu `#define`; și fără cer, cu cheia
`teren-imprejurimi-fara-cer`. Cheia cu cer rămâne `teren-imprejurimi`, iar numărul de
programe nu crește. `ceataCer` își calculează singură poziția în lume, deci nu-i trebuie
`worldPosition`, pe care `worldpos_vertex` îl face numai pentru umbre. În pagină:
programele `teren-imprejurimi` n-au nici `directionalShadowMatrix`, nici
`directionalShadowMap` printre uniforme — 0 din 8, față de 4 din 8 înainte —, iar în aceeași
sesiune, cu materialele de dinainte puse înapoi, Relief dă 0 pixeli diferiți în cele patru
vederi (țintă fixă 640 × 400). Timpul GPU, alternat vechi/nou, mediana a 15: pe canvasul de
916 × 914 cu MSAA, acasă 17,71 → 17,40 ms, sanctuarul 17,84 → 17,53, de la 8 km 16,87 →
16,54; în 1600 × 900 cu MSAA 4, −0,23…−0,33 ms. Același câștig în toate vederile: e în
vârfuri. Satelit nu e atins — materialul lui e neiluminat.

**Textura lui `harta_v9`** se cere întreagă, la 2 m pe texel (3,09 MB), odată cu celelalte.
De la 0.1.3.02 până pe 2026-10-08 venea în două trepte: întâi `harta_v9-orto_v1-mic`,
nivelurile de mip 1–4 ale celei întregi (4 m, 0,79 MB), apoi cea de 2 m, după ce Satelit era
pe ecran. Pe 2026-10-08 autorul a văzut harta încărcându-se în etape și a cerut s-o vadă o
singură dată, direct pe Satelit, cu tot la detaliul întreg (vezi „Vederea Satelit”).
Varianta mică a ieșit din depozit, cu `TEXTURA_MICA` din `textura-imprejurimi`; regula ei din
`vercel.json`, `(?:-mic)?`, a rămas și nu mai prinde nimic, iar pentru `verifica-livrare` un
`-mic` revenit e un fel necunoscut și pică (încercat cu fișierele încă în `dist/`). Compresia
n-ar fi ajutat: setarea UASTC e deja cea implicită, iar cu RDO mai tare fișierul scade cu 5%
(2,93 MB) sau, cu pierderea p99 triplată, cu 17%; ETC1S ar avea 0,62 MB, cu ΔE de șase ori mai
mare.
Cine revine nu le mai cere deloc: `vercel.json` le ține un an în cache (vezi „Livrarea”). În
`?previzualizare` nu se încarcă. Satelit le comută materialele cu ale lui alpha, pe
același program. `inaltimeRandata` din scenă — alpha unde e alpha, împrejurimile în
rest — e cea pe care merg raza panoului punctului și ocluzia etichetei; măsurătorile
rămân pe `inaltimeLa` al lui alpha.

**Acasă** e vederea de pornire, `VEDERE_START`: de acolo pornește pagina, acolo duc
busola (`acasa()`) și tasta Home. Rozeta poartă eticheta „Acasă — vederea de pornire”.

**Probele.** `npm run verifica-imprejurimi`:
- încărcătorul: un nivel lipsă, un nivel cusut de alt interior → `null`; un strat lipsă
  → niciun strat (totul sau nimic);
- alpha rămâne la 1 923 948 de triunghiuri;
- **0 crăpături** pe 749 971 de muchii: fiecare muchie de uscat e a două triunghiuri, în
  afara marginii exterioare a lui `harta_v8`, și niciuna a trei; control: `harta_v6`
  fără fâșie are 2 640;
- o gaură care nu e cutia nodurilor nivelului dinăuntru (a lui `harta_v7`, mutată un pas)
  → `null`;
- culoarea Relief peste cusături, pe tronsoane de-a lungul laturilor de nord și de est (de
  64 m, sau un pas al nivelului din afară), FĂRĂ triunghiurile fâșiei: ele fac 82% din banda
  de lângă gaură, iar vârfurile lor dinăuntru au culoarea nivelului dinăuntru. Benzile au
  16 m la alpha, altfel două rânduri ale nivelului din afară, cel puțin 64 m: una mai lată
  măsoară variația terenului, nu cusătura (v9 → v7: 5,59 pe 64 m, 8,28 pe 192 m, fără nicio
  treaptă). Două probe: ΔE_OK×100 al medianelor — 1,63 / 5,49 / 5,47 / 7,77 (alpha → v6 →
  v9 → v7 → v8), praguri 2,5 / 8 / 8 / 10 — și mediana diferenței CU SEMN pe L, a, b, o
  treaptă de culoare de-a lungul cusăturii: azi |ΔL| ≤ 1,63, prag 2,5. Controale: fiecare
  nivel colorat cu NDVI ± 0,10 pică, cu |ΔL| de cel puțin 3,17;
- netezirea: `harta_v9`, `harta_v7` și `harta_v8` au normală pe vârf și `flatShading` fals,
  `harta_v6` nu; în plasele netezite, cu fâșiile lor, fiecare poziție de vârf are o singură
  normală și o singură culoare — 141 482 de poziții, dintre care 840 pe cusăturile dintre ele;
  control: o buclă a lui `harta_v7` colorată fără NDVI dă 387 de poziții diferite;
- câmpul nodurilor, recalculat în probă, nu importat (diferențe centrale, `culoareTeren`,
  `ndviNod`, inelele apei): pe toate vârfurile — 412 145 la `harta_v9`, 226 415 la `harta_v7`,
  192 548 la `harta_v8` —, 0 culori diferite și normala la cel mult 0,38° (prag 0,5°:
  cuantizarea pe 8 biți dă cel mult ~0,39°), 0 normale nule; la fel bucla dinăuntru a fiecărei
  fâșii, recalculată pe nivelul ei — 2 464 de vârfuri pe `harta_v6`, 1 087 pe `harta_v9`, 823
  pe `harta_v7`. Niciun nod de apă folosit fără uscat la 8 pași (cu 3 ar fi rămas unul).
  Controale, pe `harta_v9`: NDVI-ul nodului de alături dă 267 343 de culori diferite; bucla
  dinăuntru a fâșiei citită din grila lui `harta_v9` în loc de a lui `harta_v6`, 2 329 —
  greșeala, încercată de recenzie pe `harta_v7`, trecea de toate probele de dinainte;
- formula față de geometrie: normala scrisă față de media fațetelor din jur, ponderată cu
  aria, pe vârfurile de uscat cu panta de peste 2° (sub ea, pe terenul aproape plat al lui
  `harta_v8`, orice normală aproape verticală ar trece): mediană 0,42° / 0,56° / 0,56°, p99
  4,32° / 3,30° / 3,42° (`harta_v9` / `harta_v7` / `harta_v8`), prag 1°; control: normala
  nodului de la est dă 2,10° / 2,52° / 2,10°;
- bugetul: 600 000 de triunghiuri, 8 MB de fișiere (azi 7,14); fiecare nivel are în
  `public/data` numai cele șase fișiere pe care le cere pagina — cu varianta mică încă acolo,
  `harta_v9` pica;
- la bit: sha256 pe fiecare atribut al celor patru plase, cu fâșiile, cât în `AMPRENTA`
  (citită pe codul de dinainte de `plasaPlata` și de `tot()` cel nou), și cel mult 160 000
  de normale de nod (`Math.hypot`) la construcție — codul vechi cere 645 357 și pică.
  Controale: un nod al lui `harta_v8` ridicat cu 1 mm schimbă numai amprenta lui; `tot()`
  fără normala apei de pe inelul 1 lasă 2 081 / 1 187 / 7 830 de normale nule și pică;
- fără codul umbrelor: shaderul lui MeshStandardMaterial, trecut prin `onBeforeCompile`-ul
  fiecărui nivel, cu definițiile pe care le pune three pentru o lumină cu umbră (PCF, culori,
  ceață) și preprocesat cu bucățile lui three (`#include`, `#if`, `#define`, `#undef`), n-are
  `directionalShadowMatrix`, `vDirectionalShadowCoord`, `directionalShadowMap` sau
  `getShadow(` — pe cele patru niveluri fără cer și pe `harta_v6` și `harta_v9` cu cer, unde
  ceața pe cer rămâne. Control: MeshStandardMaterial fără `onBeforeCompile` le are pe toate
  patru; codul de dinainte pică pe toate șase.

În pagină (panoul Browser, țintă fixă 640 × 400): alpha cu și fără împrejurimi dă
**0 pixeli diferiți** în afara pixelilor în care se văd împrejurimile — scoși dintr-o
randare a lor în magenta neiluminat —, în patru vederi (acasă, sanctuarul, farul, de
la 8 km), pe Relief și pe Satelit; control: împrejurimile desenate fără test de
adâncime ies peste alpha în toate patru (376, 419, 48, 1 231 de pixeli, pe Relief).
Relief iese la octet după zece comutări Satelit; programele și texturile nu cresc;
după `dispose()`, 0 geometrii și numai `DFG_LUT`; în repaus, 0 cadre.

**Banda DGT, `harta_v9`** (2026-10-07). Textura de 16 m a lui `harta_v7` se vedea ca o
trecere de la 2 m, la ~400 m dincolo de alpha; acum trecerea e la ~2,4 km. Autorul a adus din
catalogul CDD (`MDT-2m`, câte 1 001 129 de octeți, sufixul `-06-2024`, versiunea 01;
verificate pe API-ul STAC public al CDD, `https://cdd.dgterritorio.gov.pt/dgt-be/v1`) 14 dale:
105165, 106165, 106166, 107161–107166, 108162–108166, plus ortofotoul
`ortos2025_cog_25cm_rgbi_jpg_464-1_v02.tif` (464-1, colțul NV la (−96 000; −130 000);
sferturile foii sunt 1 = NV, 2 = NE, 3 = SV, 4 = SE, câte 8 × 5 km). Celelalte patru pătrate
din dreptunghi — 104165, 104166, 105166, 108161 — nu există în catalog. La 4 m, ca
`harta_v6`, banda ar fi costat ~1,4 milioane de triunghiuri; la 12 m costă 138 203, iar
pașii cresc 4 → 12 → 32 m. `harta_v7` s-a refăcut cu gaura mărită (`--suprascrie-lucru`,
nefiind încă publicată); `harta_v8` a ieșit identică la octet. Pe Satelit se vede de departe
o pată închisă pe malul de nord, la (−92 978; −134 120): o faleză spre vest, în umbră pe
fotografia de dimineață — relieful DGT o prinde abruptă, Copernicus o netezea; fotografia
rămâne, ca la falezele lui alpha.

## Vederea Satelit

Butonul „Satelit”, jos-stânga (pe telefon deasupra busolei), comută între
fotografia aeriană pe relief și vederea Relief — culorile din albedo, de mai sus.
Pornește pe Satelit, iar harta apare abia cu fotografia întreagă pe placă — vezi „O singură
încărcare”, mai jos. Alegerea se ține în `localStorage`, în try/catch.

### Texturile: `npm run textura-ortofoto`

Scrie `public/data/<hartă>-orto_v1.ktx2` + `.json`, pentru bază și petic. Textura are
versiune proprie: un retuș înseamnă `_v2`, harta rămâne. Un nume publicat se rescrie numai
cu aceiași octeți (garda din `scripts/comun/publicat.mjs`, vezi „Livrarea”). Cere KTX-Software 4.4
(`ktx`); scriptul îl caută și în `C:/Program Files/KTX-Software/bin` sau în
`KTX_BIN`, fiindcă un shell pornit înainte de instalare nu vede PATH-ul nou.

- **Geometria.** „Muchii de pixel”, cu marginile în TM06 în sidecar. Baza:
  2368 × 3008 la 1 m, colțul NV (−95792; −136402); peticul: 2176 × 2880 la 0,25 m,
  (−94823; −137295). Dimensiuni multipli de 64, deci toate cele 5 niveluri sunt
  multipli de 4, cât blocurile KTX2. Colțurile cad pe metri întregi unul față de
  altul, deci al treilea nivel al peticului (1 m) cade texel pe texel peste bază.
- **Culoarea.** Ortofotoul la 0,25 m, mutat cu deplasarea măsurată pe sol (+0,25 m
  spre est, `zbor.json`); toate mediile — baza, mipurile — în lumină LINIARĂ.
  Probă: nivelul de 1 m al peticului iese identic cu baza pe cei 266 162 de texeli
  de uscat comuni, **0 diferiți**; mutat cu 1 m, 264 797 diferă.
- **Pixelii fără date.** Pe marginea datelor, în colțul NV, media se face numai pe
  pixelii cu alfa ≥ 128. Înăuntru, banda alfa are pixeli izolați sub 128 —
  artefacte JPEG —, deci cu cel puțin jumătate de pixeli valizi media e pe toți.
  Uscatul bazei are date pe toți cei 3 092 832 de texeli.
- **Marea.** Apa adâncă, măsurată în OKLab pe benzi de 25 m de la mal: sRGB
  25, 54, 84. Fotografia se topește în ea între 25 și 50 m de la mal — de acolo
  încolo nicio bandă nu mai stă la ΔE 2 de apa adâncă —, iar pixelii fără date o
  primesc direct. Amestecul e copt în RGB, fără canal alfa: mipurile ar media
  altfel culoarea și ponderea separat. Planul mării din afara texturii are exact
  culoarea aceasta, deci marginea nu se vede.
- **Codarea.** UASTC, calitate 2, cu RDO și zstd 18 — aleasă de autor: 3,88 MB baza
  și 6,03 MB peticul (9,9 MB), ΔE_OK×100 după decodare 0,25 / 0,52 (p99 1,42 /
  1,94). ETC1S ar fi dat 0,77 + 1,20 MB, cu ΔE 1,32 / 1,34 (p99 5,8 / 6,6).
  `--threads 1` și `--uastc-rdo-m`: aceleași date dau același fișier, la octet;
  numai cu al doilea, peticul ieșea diferit de la o rulare la alta. Pe GPU, UASTC
  devine ASTC 4×4 pe telefon și BC7 pe desktop, un octet pe pixel: ~18 MB cu tot
  cu mipurile, nu ~71 MB cât ar ocupa necomprimat.

### În pagină: `src/scene/satelit.js`

- **Neiluminat**, ca 3D Tiles de la Google: `MeshBasicMaterial`, `toneMapped:
  false`, deci octeții fotografiei ajung pe ecran așa cum sunt. Lumina e deja în
  fotografie; pe un material luminat umbrele s-ar dubla, iar soarele scenei (244°)
  e aproape opus celui din zbor (94°). Umbrele modelelor nu cad pe teren în
  Satelit: fotografia le are deja, pe ale clădirilor adevărate.
- **Coordonatele texturii se calculează în shader**, din `position.xz` (matricea
  plaselor e identitatea): `vMapUv = mapTransform · (x, z, 1)`, cu `texture.matrix`
  scris din bbox. v crește spre SUD — KTX2 comprimat nu se întoarce la încărcare.
  Un atribut `uv` ar fi costat 16–33 MB.
- **Soarele** trece pe al zborului (94,0° / 39,5°), ca clădirile modelate și cerul
  să arate ora fotografiei; umbrele se reîncadrează (`umbre.potriveste()`), cerul
  își reface expunerea, ceața și fundalul iau noul orizont. Înapoi, soarele se pune
  DIN COPIE, nu recalculat.
- **Marea**, în cutia texturii, e fotografia; în afara ei, apa adâncă măsurată;
  ceața pe pixel rămâne (cu AgX inclus de mână: materialul nu e tone-mapped).
- Suprafețele sanctuarului de pe teren (drapajul) se ascund: fotografia le are.
- **Acoperișurile fantomă nu se retușează.** Ortofotoul nu e true-ortho: acoperișul
  unei clădiri de h metri apare mutat cu h × înclinarea din `zbor.json` (0,095 m/m
  sub 9 m, 0,085 peste). Imaginea iese din amprentele modelate cu ~0,6 m în lungul
  pereților de 6–9 m — pe bază sub un texel, pe petic ~2 texeli — și cu până la
  ~1,3 m (15 m × 0,085) la colțul de NV al turnului de nord, peste poteca de la
  nord de biserică: pe petic, ~5 texeli. Turnul farului se mută cu ~2,7 m, dar
  cade peste acoperișul casei lui, care e modelată. Retușul prin difuzie
  (`orto_v2`), prevăzut ca opțional, nu s-a făcut; dacă se vede, turnul de nord e
  primul loc de retușat.
- **Falezele rămân fotografia.** `npm run masoara-faleza` a măsurat, pe plasa
  paginii, cât detaliu are fotografia pe metrul de SUPRAFAȚĂ, pe clase de pantă:
  sub 50% din cel de pe terenul plat de la 46,6° încolo, 17% la 70–75°, 2% la
  85–90°. Stânca pictată de acolo încolo din regula de albedo, luminată cu soarele
  zborului (α 1,26, β 0,29, potriviți pe stânca de 30–70°; R² 0,33 la antrenare, 0,29
  pe fațetele ținute deoparte; soarele zborului o potrivește mai bine decât cel Relief, ΔE 10,3
  față de 11,8), ieșea însă uniformă și ternă, iar numai pe pereții de 70–85°, în
  dungi. Fotografia întinsă arată, pe calcar, ca stratele: autorul a ales-o. Scriptul
  rămâne, ca măsurătoare, nefolosit de pagină.
- **Încărcarea.** `creeazaIncarcatorKtx2` importă KTX2Loader dinamic — `loaders.js`
  e importat și de uneltele Node. Transcodorul NU se copiază în `public/`:
  KTX2Loader din r186 îl găsește cu `new URL(…, import.meta.url)`, iar Vite îl emite
  la build; cu `setTranscoderPath('/basis/')` s-ar fi livrat de două ori (585 KB).
  `incarcaOrto()` nu aruncă și verifică mărimea, sha256 (înainte de `parse`, care
  mută bufferul în worker) și antetul KTX2. Fără `crypto.subtle` — un telefon pe
  `http://192.168…`, la serverul de dezvoltare — se sare numai sha256. Shaderele
  Satelit se compilează cu `compileAsync` pe plase-proxy cu aceeași geometrie, nu pe
  cele vii (un cadru desenat între timp ar fi arătat o stare amestecată), iar
  texturile urcă pe placă cu `initTexture`, înainte de prima comutare. Baza și
  peticul împart un program. Pe un GPU fără niciun format comprimat transcodarea ar
  da RGBA (~71 MB): cererea peticului, pornită devreme, se oprește înaintea primei transcodări
  (`cuCompresie`, din `workerConfig`), iar plasa lui rămâne pe textura bazei;
  formatul bazei rămâne a doua plasă. `pregateste()` nu respinge —
  un import eșuat al încărcătorului, după un deploy, lasă Relief și un avertisment,
  nu un buton blocat. Cu preferința Relief nu se descarcă nimic până la primul
  clic; butonul are `aria-busy` cât se încarcă. `?previzualizare` forțează Relief,
  fără buton. Crearea e în `try`, ca la cer și la umbre.
  Recenzia three.js a găsit exact aceste șase lucruri; sunt reparate.
- **O singură încărcare** (2026-10-08, la cererea autorului: harta o singură dată, direct pe
  Satelit, cu tot la detaliul întreg). `descarcaSatelit`, chemată de scena.js după TOATE datele
  pornirii și înaintea construcției plaselor, cere deodată cele șase texturi întregi — baza,
  peticul și cele patru împrejurimi, 14,44 MB (15 138 469 de octeți; MB = 2^20). Sidecarul și
  fișierul pleacă deodată (`cereOrto`); transcodorul, după sidecarul bazei, deci un deploy fără
  texturi nu-l descarcă. Pornit, nu se mai poate opri: `init()` din r186 nu primește semnal. Un
  încărcător eliberat cu transcodorul în drum îi revocă URL-ul workerului la sosire
  (`elibereazaKtx2`); `dispose()` singur îl lăsa, ~60 KB, cât trăiește pagina. `detectSupport`
  rulează la sosirea încărcătorului: pe un context pierdut atunci ieșea RGBA, fără petic, toată
  sesiunea, deci `pregateste()` așteaptă refacerea contextului și reface configurația înaintea
  primei transcodări. Urmează materialele, compilarea pe proxy, `initTexture` și eliberarea
  încărcătorului. Construcția rămâne pe firul principal (decizia autorului: fără workeri).
  După `compileAsync`, numai pe calea automată (`satelit.automat`: fără `?previzualizare`, fără
  preferința Relief, fără ieșirea dată înainte), scena.js cheamă `laIncarcare({ faza:
  'fotografie' })` și așteaptă `asteaptaSatelitul(gata, faraSatelit)` — o cursă care nu respinge
  și își scoate ascultătorul —, abia apoi bucla. Primul cadru e deci Satelit, cu tot. Un eșec
  arată harta pe Relief, fără butonul Satelit; „Fotografia aeriană nu s-a putut încărca.” e numai
  pentru cititorul de ecran. Scris cât panourile erau ascunse, anunțul nu ajungea la nimeni:
  regiunea live era în afara arborelui de accesibilitate, iar la apariție textul deja prezent nu
  se anunță (recenzia, măsurat în Edge cu evenimentele de accesibilitate). La fel primul anunț
  al busolei. Acum main.js cheamă `scena.arata()` după `data-scena`, iar după două cadre ale
  paginii busola și Satelit își golesc anunțul și îl scriu din nou (`reanunta`)
  <!-- NEVERIFICAT: cu un cititor de ecran adevărat -->.
  - **Baza căzută oprește tot, pe loc** — fișierul lipsă sau stricat, sidecarul fără soarele
    zborului și fără mare (`areSoareSiMare`): `garda.abandoneaza()` oprește cererile, citirile și
    încărcarea. Înainte, celelalte cinci texturi se descărcau și se transcodau degeaba, cu harta
    ținută pe mesaj: recenzia a măsurat 66 s pe o legătură lentă, pentru un eșec știut de la 0 s.
  - **Procentul:** suma lui `octeti` din sidecarurile de încărcat, luată după ce s-au așezat
    toate (să nu sară pe un total parțial), și octeții din `laOcteti`, pe fiecare bucată
    (`citesteOcteti`). `laProgres` se cheamă numai când crește procentul întreg, de la 0 la 1.
  - **Garda fotografiei**, aceeași `creeazaGardaPornirii`, cu ceasul ei: 20 s fără niciun octet
    pe nicio cerere Satelit le opresc pe toate, iar `gata` iese `false`, cu un `console.warn`. Se
    oprește când fiecare textură și-a citit fișierul și are transcodorul (`laDescarcat`):
    transcodarea rămâne pe limita ei de 30 s. Importul încărcătorului și încercarea veche se
    așteaptă prin `panaLa`, deci nici un import agățat nu ține `gata` pe vecie.
  - **Ieșirea**, `faraSatelit`: cât se încarcă, o renunțare fără preferință; înaintea creării,
    cererile devreme se opresc. Butonul rămâne vizibil, neapăsat și liber.

  Măsurat pe build, cu fila în față (916 × 914, DPR 1): la `data-scena`, în 5 din 5 încărcări,
  `frame` 0, Satelit activ, peticul pe 2176 de texeli, `harta_v9` pe 2432; primul cadru e Satelit.
  Mediane, `data-scena` / primul cadru: 705 / 768 ms pe `cabo-espichel-productie` (cache cu
  revalidare), 701 / 766 ms pe `cabo-espichel-csp-impus` (0 încălcări), 684 / 754 ms fără cache,
  pe loopback. Cu preferința Relief, harta la ~400 ms, fără nicio cerere `.ktx2`. Cu `.ktx2` la
  500 KB/s pe cerere (server de probă): procentul urcă de la 1% (416 ms) la 100% (13 202 ms), harta
  apare la 13 359 ms, pe Satelit; „Arată relieful acum” la 75% o arată după 2 ms, pe Relief, cu
  cererile bazei și peticului oprite și preferința neatinsă; Satelit cerut apoi din buton se aplică
  după 13,3 s, fără avertisment. Pe un telefon prima imagine vine abia după 14,44 MB: ~13,5 s la
  9 Mbit/s <!-- NEVERIFICAT: calculat; telefon și rețea mobilă nemăsurate -->.

  `npm run verifica-pagina`, cu fișierele adevărate, un `fetch` fals și ceasul virtual: 6 din 6
  `.ktx2` cerute înaintea construcției, 0 `-mic`; la `gata` peticul pe `harta_v5-orto_v1`,
  `harta_v9` la 2432 de texeli, 14,44 MB transcodate; cu baza sosită singură procentul e 0,26 =
  ⌊100 × 4 069 665 / 15 138 469⌋ / 100, iar 1 vine o dată, înaintea compilării; baza tăcută după
  1 KB e în așteptare la 19,999 s și `false` la 20 s, cu un avertisment și 0 temporizatoare, dar o
  bază în 10 bucăți la 15 s și o transcodare de 25 s după ultimul octet trec; ieșirea în descărcare
  oprește 6 din 6, cu preferința neatinsă, iar un clic apoi aplică tot; fără compresie peticul e
  oprit și `harta_v9` la 1216 (4 m); `cuCompresie` față de `getTranscoderFormat`, 0 nepotriviri pe
  96 de configurații × 6 texturi. Pe sursă, ordinea din scena.js: date → garda oprită →
  `descarcaSatelit` cu peticul → `creeazaTeren` → `creeazaSatelit` → `compileAsync` → faza și
  așteptarea, numai pe calea automată → bucla. Controale: satelit.js de la `30a22c9` (2 cereri
  `-mic`, `harta_v9` la 1216; fără gardă și fără `faraSatelit`, tot în așteptare după 300 s);
  mutațiile de azi (fără `laOcteti` procentul rămâne 0; garda nerearmată pierde baza lentă, cea
  oprită numai în `finally` transcodarea de 25 s; fără `panaLa`, un import agățat ține 300 s);
  scena.js de la `30a22c9` și așteptarea mutată după buclă; `Promise.race` simplu (1 ascultător
  rămas); „oricare format” (6 nepotriviri: PVRTC cere laturi putere a lui 2). Controalele de la
  `30a22c9` cer varianta mică: o primesc din git (`DIN_ISTORIC`), altfel ar pica din alt motiv.
  Din recenzie: baza cu 404, cu celelalte cinci lente, dă `false` la 0 s, cu 5 din 5 cereri oprite și
  0 transcodate (control, fără oprire: 66 s și 5 transcodate); `reanunta` golește anunțul eșecului și
  îl scrie din nou la +150 ms, busola la +600 ms, iar `arata()` le cheamă la al doilea cadru (controale:
  fără golire, 0 schimbări; chemate pe loc; main.js fără `arata`). Textul citit din `src/` se aduce la
  LF, iar o mutație care nu se aplică pică singură: probele trec și pe o clonă LF, și pe una CRLF.
  Fiecare caz își numără numai încărcătoarele lui: o probă pica în ~1 din 3 rulări, din cauza unui
  control pe codul vechi care se elibera în cazul următor; acum 20 de rulări la rând, 0 eșecuri.
- **Butonul.** La pornire nu se vede: panourile apar odată cu harta. Cât se încarcă după un clic,
  e apăsat (starea spre care merge), `aria-busy`, cu roata în locul bifei și „se încarcă…” pe al
  doilea rând (din CSS, `/ ""`, deci nu intră în nume acolo unde browserul știe forma: Chrome 77+,
  Firefox 128+, Safari 17.4+; pe Firefox 115 ESR numele devine „Satelit se încarcă…”), fără
  estompare; anunțul e pentru cititoarele de ecran <!-- NEVERIFICAT: fără cititoare de ecran -->.
  Un clic atunci înseamnă „rămân pe Relief” (`renunta`): preferința `relief`, cererile oprite, iar
  un clic următor le cere de la capăt; după ultima așteptare a texturilor încărcarea se termină,
  dar nu se aplică. Un eșec scoate butonul, cu anunțul; cu preferința Relief, butonul apare după
  sidecar. Un dublu-clic cu compilarea încă în curs aplica Satelit pe jumătate (recenzia): acum
  decide `pregatit`, pus abia la capătul încărcării. O încercare nouă o așteaptă întâi pe cea
  oprită (`incarcareOprita`): pornit–oprit–pornit dădea avertismentul three „Multiple active KTX2
  loaders”. `verifica-pagina`, pe calea Relief → clic: al doilea clic rămâne pe Relief, cu 6 din 6
  cereri oprite, al treilea aplică; renunțarea cu compilarea în curs, apoi un clic, aplică pe loc,
  cu 0 cereri noi; pe o rețea care oprește încet cererile, cel mult un încărcător viu, iar un al
  patrulea clic oprește încercarea nouă fără nicio cerere; baza 404 scoate butonul. Control,
  satelit.js de la `30a22c9`: al doilea clic în descărcare aplică Satelit și scrie `satelit`.
- **Transcodorul care nu pornește.** Workerul Basis cere WebAssembly și `new Function`
  (embind). Fără ele — un CSP fără `'unsafe-eval'`, WebAssembly oprit de un mod de
  securitate — workerul se agață tăcut: își așteaptă transcodorul la nesfârșit,
  WorkerPool nu ascultă `error`, iar `parse()` nu mai cheamă nimic. Satelit rămânea
  atunci fără buton și fără avertisment, cu preferința Relief un buton `aria-busy` pe
  vecie, iar `dispose()` nu mai oprea workerii. Acum, două gărzi:
  - `creeazaIncarcatorKtx2` încearcă întâi, în firul principal, un modul WASM gol și
    `new Function('')` (`verificaTranscodorul`): un worker din `blob:` moștenește
    CSP-ul documentului. Dacă una cade, aruncă, iar `pregateste()` lasă Relief cu un
    avertisment, înaintea oricărei descărcări;
  - `incarcaOrto` așteaptă întâi `ktx2.init()` — aceeași promisiune pe care o cheamă
    `parse()`, deci transcodorul nu se cere de două ori —, apoi pune pe `parse()` o
    limită, `LIMITA_TRANSCODARE_MS` = 30 s, numărată numai cât pagina e vizibilă: pe
    telefon o filă ascunsă poate fi înghețată cu workeri cu tot, iar la întoarcere
    temporizatorul ar suna primul <!-- NEVERIFICAT: dedus, nemăsurat pe un telefon -->.
    Un termen atins de o ascundere pornește din nou, întreg. Descărcările nu intră în
    limită: pe o legătură lentă ar fi oprit încărcări bune. Trecută, `null` cu un
    avertisment; un abandon (`dispose()`), `null` pe loc, fără avertisment.
  Pe desktop (Chrome, 20 de fire) cele șapte texturi de atunci, cu varianta mică, trec
  printr-un singur worker, cu pornirea lui, în 0,40 s (BC7) și 0,29 s (RGBA); cu patru, 0,21 s. Pe
  telefon limita lasă o margine de cel puțin patru ori dacă el e de 10–20 de ori mai
  lent <!-- NEVERIFICAT: nemăsurat pe un telefon -->. `init()` e public în r186, dar
  marcat „TODO: Make this method private”: `npm run verifica-pagina` pică dacă dispare
  sau dacă `parse()` nu mai trece prin el. Un `worker-src` care oprește `blob:` sau un
  worker mort din alt motiv nu se văd dinainte; pe acelea le prinde numai limita.
  Proba, `npm run verifica-pagina`, cu un încărcător fals și un ceas virtual: un
  `parse()` tăcut e încă în așteptare la 29 999 ms și `null` la 30 000, cu un
  avertisment; abandonul în timpul transcodării sau al descărcării transcodorului dă
  `null` pe loc; transcodorul sosit după 60 s, cu transcodarea de 0,1 s, dă textura;
  pagina ascunsă de la 10 la 40 s, cu transcodarea gata la 50 s, la fel. Controalele:
  fără limită, tot în așteptare după 300 s; descărcarea transcodorului pusă în limită
  pierde textura; fără semnalul de vizibilitate, pagina ascunsă dă `null`. Pe
  `loaders.js` de dinainte pică 9 probe din 18.

Probele, în pagină (panoul Browser):
- **Relief rămâne la octet:** trei vederi 640 × 400 în țintă fixă, înainte de orice
  comutare și după Relief → Satelit → Relief: **0 pixeli diferiți** în toate trei.
  Control: cu soarele lăsat pe al zborului, ~255 000 diferă pe fiecare;
- **înregistrarea:** vedere ortografică de sus, 0,25 m pe pixel, pe două ferestre de
  platou din petic, fotografia față de culorile Relief NEILUMINATE (NDVI-ul vine din
  aceeași fotografie): maximul corelației (0,86 / 0,83) la (−0,25; 0) m — exact
  deplasarea pe sol aplicată fotografiei și nu și NDVI-ului. Control: textura mutată
  cu 2 m mută maximul cu exact 8 pixeli. Cu culorile Relief LUMINATE maximul ieșea
  la 1 m: umbrirea mută aparent formele pe pante;
- **culoarea:** ferestrele de referință din sidecar (terreiro, platoul de lângă far,
  versantul de nord) ies în pagină cu aceiași octeți, ΔE 0; textura citită fără sRGB
  ar da 2,72 pe terreiro. Marea din larg, privită de la 2 m, iese 25, 54, 84;
- **resursele:** zece comutări lasă programele (11) și texturile (6) neschimbate;
  după `dispose()`, 0 geometrii și o singură textură — `DFG_LUT`, tabelul de 16 × 16
  pe care three îl ține global pentru materialele PBR, și fără Satelit;
- **căile de eșec:** sidecar lipsă (Vite dă index.html), KTX2 trunchiat, un octet
  schimbat, HTTP 404, rețea căzută — fiecare `null` cu un singur avertisment;
- **transcodorul care nu răspunde** (2026-10-08), cu preferința Relief și workerii
  înlocuiți cu unii care nu răspund niciodată: după clic, la 30,1 s butonul pleacă,
  `aria-busy` se scoate, anunțul spune „Fotografia aeriană nu s-a putut încărca.”,
  câte un avertisment pe fiecare din cele șase texturi, 4 workeri porniți și 4 opriți,
  3 texturi pe placă, cât Relief. `dispose()` cu cei 4 workeri agățați îi oprește în
  7 ms, fără avertisment. Controlul, cu `loaders.js` de dinainte: la 36 s butonul
  e tot `aria-busy`, cu „Se încarcă fotografia aeriană…”, niciun avertisment, iar la
  5 s după `dispose()` 0 workeri opriți din 4. Cu un CSP pus prin `<meta>`: fără
  `'unsafe-eval'`, clicul eșuează în 11 ms pe WebAssembly, iar numai cu
  `'wasm-unsafe-eval'`, tot în 11 ms, pe `new Function`, amândouă fără niciun octet
  de textură sau de transcodor descărcat. Ocolind verificarea, workerul adevărat sub
  al doilea CSP aruncă `EvalError` numai în consolă, fără eveniment `error`, iar
  `incarcaOrto` cu limita de 3 s întoarce `null` la 3,01 s;
- la 390 px butonul nu atinge busola, panoul punctului — minimizat sau deschis pe
  o clădire —, rândul cu sursele sau eticheta; la fel la 320, 700, 1440 și
  844 × 390 (2026-09-30);
  build-ul de producție încarcă Satelit cu transcodorul din `/assets/`.

## Sanctuarul

Santuário de Nossa Senhora do Cabo Espichel intră pe hartă ca geometrie: toate
construcțiile din poza de referință a autorului, plus Ermida da Memória. A intrat
în v0.0.10, în cinci commit-uri, 0.0.10.01–05. În v0.0.11 arcele și ferestrele
aripilor au trecut pe numărătoarea din 1880, iar datele au devenit `sanctuar_v2`.

### Contururile: OpenStreetMap, cu versiuni fixate

`npm run osm-sanctuar` citește din API-ul OSM 0.6 tot ce e construit sau călcat
în cutia complexului: clădiri, ziduri, garduri, apeductul, drumurile, potecile și
parcarea. Se alege după etichete, nu după o listă scrisă de mână. Scrie două lucruri:
- instantaneul `date-sursa/osm/sanctuar-osm-<data>.json`, care nu se suprascrie;
- `scripts/sanctuar/osm-manifest.json`, cu versiunea fiecărei căi și a fiecărui nod.

Versiunile OSM sunt imuabile, deci `-- --din-manifest` reface instantaneul numai
din ele și cere să iasă identic. Pe 2026-09-29 a ieșit identic: 63 de elemente.

**Licența.** OSM e ODbL 1.0. Manifestul, inventarul și tot ce se derivă din
contururi sunt bază de date derivată, deci ODbL. Pagina îi datorează atribuirea
„© contribuitorii OpenStreetMap”.

**Fără Overpass.** La cercetare a căzut de două ori cu 504, pe două servere.
API-ul principal e pentru editare, deci cererile stau sub una pe secundă, cu
User-Agent propriu și cu așteptare la 429/5xx.

**Changesetul 120423250** („Update Cabo Espichel”, 2022-05-01) a retrasat o bună
parte din complex: 97 de noduri modificate. Numai într-un loc mutarea e o translație
comună, deci mutarea unui obiect întreg: Ermida da Memória, cu adro-ul și terasa,
9 noduri, toate cu (+12,84; −13,80) m.
- Poziția de dinainte e cea bună: pe ea cade blocul alb din ortofotoul DGT, cu
  umbra lui, iar pinul Google stă la 5,7 m de ea, față de 13 m pe cea de azi.
- În rest mutările sunt individuale, de la centimetri la zeci de metri, deci nu se
  răstoarnă mecanic. Exemple: esplanada are 10 790 → 6 917 m², Estrada do Farol s-a
  mutat cu 47 m.
- Pentru fiecare cale atinsă, instantaneul păstrează și varianta de dinainte. Ce
  se folosește e scris în DOUĂ locuri, nu unul: `variante_osm` din
  `scripts/sanctuar/decizii.json` (esplanada și grupul Ermidei, citit numai de
  `suprafete-sanctuar`), iar grupul Ermidei încă o dată, în cod, în
  `nmds-sanctuar` și `masoara-sanctuar`. Tot restul ia versiunea de azi — între
  ele Casa da Água, ruina de SE și cercado-ul, pe care changesetul le-a atins
  (87 → 76, 250 → 366, 3 521 → 3 666 m²). Pentru acelea judecă proba amprentelor,
  mai jos.

Amprentele nu sunt deplasate față de LiDAR. Proba e în `npm run verifica-sanctuar`:
conturul modelului cade pe pixeli de clădire (nMDS > 1 m) în 98,3% din aria lui,
iar mutat 2 m perpendicular pe aripi, în 84,7%. Și golurile TIN ale MDT-ului — unde
DGT a scos clădirile și a interpolat plan — stau în amprente: ~93% din pixelii TIN
aflați la cel mult 10 m de ele cad înăuntru. Invers nu: TIN-ul acoperă numai 28%
din amprente (cât tipărește `nmds-sanctuar`), fiindcă DGT a interpolat doar acolo
unde n-a avut puncte de sol. Cifrele din cercetare — „98–100% pe golurile TIN”,
corelația 0,512 → 0,520 — nu le reface niciun cod și au fost scoase.
Ortofotoul nu e true-ortho: avionul a văzut clădirile oblic. Poziția se verifică pe
LiDAR, nu pe ortofoto.

`scripts/sanctuar/inventar.json` leagă fiecare construcție din poza de referință
de un element OSM, de o trasare pe straturile DGT sau de o excludere cu motiv.
Poza, din Google Maps 3D, e numai o listă a ce există: nu se trasează nimic pe ea.

### Înălțimile: MDS − MDT, la 50 cm

Nicio sursă nu dă înălțimile construcțiilor, iar OSM nu are nici acoperișuri.
DGT publică însă, din același zbor, și **MDS-ul**: suprafața de sus, cu clădiri,
ziduri și vegetație, pe aceeași grilă de 50 cm ca MDT-ul. Diferența lor, nMDS, e
înălțimea a tot ce stă pe sol.

Dalele necesare sunt MDS 105162, 105163, 106162 și 106163, plus MDT 106162 și
106163. Au fost descărcate de autor în `date-sursa/lidar-50cm/`. Catalogul are
MDS 104162 și 104163, dar nu le folosește nimic.

`npm run nmds-sanctuar` le verifică la sosire: mărimea, acolo unde catalogul o dă,
colțul `((CCC−200)·1000, (RRR−300)·1000)`, EPSG 3763, PixelIsArea, NoData −999 și
aceeași grilă pentru MDS și MDT. Pe 2026-09-29 a măsurat:
- **același datum:** pe 28 149 de pixeli de sol gol (terreiro-ul și parcarea,
  erodate, fără goluri TIN și fără vegetație), mediana |MDS − MDT| e **0,000 m**;
- **fără deplasare:** mediana minimă e la (0, 0);
- MDS − MDT ≥ −0,15 m pe 99,99% din uscat;
- cusăturile MDS: 0,121 m peste y −138000 față de 0,105 între rânduri vecine;
  0,046 m peste x −94000 față de 0,051.

Scriptul scrie în `date-sursa/derivate/` rastrul (MDS, MDT, NDVI) pentru pașii
următori și straturile de privit: umbrirea, nMDS, ortofotoul la 0,25 m, golurile
TIN și suprapunerea cu OSM.

**Candidații** sunt ce stă peste 1 m deasupra solului, fără vegetație, în afara
clădirilor OSM și a parcării: 67. Din ei ies:
- zidurile cercado-ului și ale ruinelor;
- apeductul, înălțat de la Casa da Água spre est pe ~100 m și din nou de la
  x ≈ −93990; între ele nu se ridică deasupra solului;
- corpul de legătură de nord al bisericii;
- căsuța din afara colțului de SE al cercado-ului.

Parcarea e scoasă din căutare: LiDAR-ul a prins mașinile și autobuzele ca blocuri
de 1,5–2,5 m.

### Formele: plane pe MDS, nu contururi ridicate

`npm run masoara-sanctuar` descompune fiecare clădire în părți convexe, scrise de
mână în `scripts/sanctuar/parti.json`, pe cadre cu originea și azimutul măsurate
pe LiDAR. Pe fiecare parte:
- **acoperișul** e MINIMUL unor plane găsite prin RANSAC pe pixelii MDS. Așa ies
  fără cazuri speciale acoperișurile în una, două, trei și patru ape, cu teșituri;
  pereții primesc marginea de sus din același minim, frântă unde se schimbă planul;
- marginile libere se remăsoară pe profile MDS, cu pragul la jumătatea dintre
  acoperișul dinăuntru și MDS-ul de afară;
- **zidurile** ruinelor și ale incintei: schelet Zhang–Suen, lanțuri, Douglas–Peucker,
  filtre de lungime, grosime și înălțime (0,4–4,5 m; 9 m la ruine);
- **coșurile**: reziduul MDS − model peste 0,5 m, cel mult 2,5 m și 8 px, nu pe biserică.

Ce a măsurat: nava în două ape cu p90 0,06 m; modulele 2–5 ale aripii N cu p90
≤ 0,11 m (modul_1: 0,37); platforma turnurilor 147,27, vârfurile 148,64 și 149,28;
frontonul până la 148,3; Ermida 5,5 × 5,7 m; 42 de coșuri; apeductul înălțat
0,5–3,0 m, numai pe tronsoane (3,0 la joncțiunea cu Casa da Água). Rămân potrivite
slab, cu p90 de ~1 m: `aripa_s.est_sud`, `est_mic`, `est_lean`, `est_jos` și
`aripa_n.spate_v`; proba le tipărește pe cele de peste 0,8 m, cu tot cu
`biserica.intre_s` (8 px).

### Culorile: albedo, ca paleta terenului

`npm run culori-sanctuar` folosește convenția din `paleta.mjs`: luminozitatea din
cuantila 0,8, nuanța din pixelii de peste mediană.
- **Acoperișurile** din ortofoto, „reluminate la plat": o potrivire Lambert pe
  normalele RANSAC dă Y = 0,627·cos i + 0,345, iar culoarea se împarte la factorul
  fiecărei ape. Potrivirea dădea și un soare, azimut 96°, elevație 22,5°, care e
  **greșit**: măsurat din umbre, soarele zborului stă la 94,0° / 39,5° (vezi
  „Zborul ortofotoului”), iar 96° / 22,5° nu e o poziție a soarelui în fereastra de
  zbor. Albedoul acoperișurilor din `sanctuar_v2` e deci reluminat cu un soare
  greșit; refacerea lui e un `sanctuar_v3`, încă nefăcut.
- **Ortofotoul e ars** pe tot ce e alb: cupola Casei da Água are 98,8% din pixeli la
  254–255, parcarea 95,6%. Peste 2% arși, materialul NU se ia de acolo: varul,
  cantaria și pietrișul vin din fotografiile autorului, pe petice curate
  (`scripts/sanctuar/petice-culoare.json`).
- **Țigla** se ia din fotografie; a bisericii și a aripii S, din diferența OKLab
  față de aripa N în ortofoto — altfel s-ar coace în ea iluminarea zborului.
- Deplasarea ortofotoului față de LiDAR se măsoară O DATĂ, pe pixelii de țiglă ai
  tuturor acoperișurilor: (−0,25; +0,25) m, corelația 0,369 față de 0,341 la
  (0, 0). Se aplică la fel peste tot. E o deplasare a ACOPERIȘURILOR, nu a
  imaginii: pe sol fotografia stă cu ~0,35 m spre est, iar acoperișurile se înclină
  spre VNV cu ~0,09 m pe metru de înălțime (vezi „Zborul ortofotoului”).

### Suprafețele de pe teren

`npm run suprafete-sanctuar` scrie terreiro-ul, parcarea, esplanada și drumurile
ca poligoane: ariile OSM triangulate, drumurile ca benzi, decupate după „zona
pozei" din `decizii.json`. Din cele 37 de drumuri de acolo, 29 au bucăți în zonă.
Lățimea e măsurată pe ortofoto la 19; celelalte 18, cu mai puțin de trei stații
măsurabile, iau lățimea implicită a tipului lor.

În pagină, `src/scene/drapaj.js` le așază **exact pe triunghiurile randate**: fiecare
poligon se decupează cu cele două triunghiuri ale fiecărei celule, cu aceeași
diagonală ca `terrain.js`, pe petic acolo unde e peticul. Sunt coplanare cu terenul,
deci nu se ridică în metri: cu NEAR 10, adâncimea are 0,15 m rezoluție la 5 km și
ar pâlpâi. Fiecare strat are materialul lui, cu `polygonOffset` în trepte.
Măsurat: 182 598 de vârfuri pe `harta_v4`/`harta_v5` (182 565 pe v2/v3), maximum 0,021 mm
față de triunghiul de sub ele.
Pe fiecare rând se cercetează numai coloanele pe care poligonul le atinge în fâșia
rândului, cu o celulă de margine, nu toată cutia lui (26 807 m² de suprafețe, 156 953 m²
de cutii): 151 750 → 35 783 de celule, 247 090 → 56 418 tăieri, 65 → 44 ms la rece, în Node
(mediana a 7). Ordinea celulelor e aceeași, deci straturile ies la octet.

### Fațadele: o fotografie calibrată pe model

Arcadele, ferestrele, portalurile și golurile clopotnițelor sunt citite pe
`PXL_20260802_104852949` (terreiro-ul spre vest), în `scripts/sanctuar/fatade.json`.

**Camera** se calibrează pe liniile modelului văzute contra cerului: coama aripii S
(124 de puncte după tăierea coșurilor, rms 0,55 px) și muchiile de est ale
turnurilor (rms 0,54 și 0,73 px). Focala e fixată din EXIF (24 mm echivalent pe
diagonala 4:3 → 2830 px), altfel distanța și focala se schimbă una pe alta și
potrivirea fuge la infinit. Coama văzută stă cu 0,12 m peste intersecția planelor:
țigla de coamă. GPS-ul fotografiei cădea cu ~15 m mai la est. Control, nefolosit la
potrivire: streașina și solul ambelor aripi și profilul frontonului cad peste
fotografie la câțiva pixeli.

**Planul zidului** contează mai mult decât camera: aripile se văd razant, deci o
eroare de 0,4 m în adâncime mută un stâlp îndepărtat cu ~1,5 m. Zidul trece prin
joncțiunea cu fața de est a corpului de legătură — raza intersectată cu fața aceea,
văzută aproape frontal — și are direcția muchiei acoperișului lung. Stă cu 0,72 m
(S) și ~0,4 m (N) în spatele muchiei LiDAR: streașina. Corpurile aripilor se retrag
pe fundul galeriei; peste galerie stă un etaj cu acoperișul acelorași plane, iar
între zid și muchia LiDAR, o streașină.

Capcana, prinsă de probă: al doilea punct al liniei aripii N fusese calculat greșit,
cu 0,29° rotație. La capătul de est linia zidului ieșea în afara streașinii, iar
pozițiile citite se mutau cu până la 0,37 m. Le-a mutat înapoi o intersecție de
raze cu planul corect, nu o nouă citire.

**Ce e măsurat și ce nu:**
- stâlpii: pe aripa S 16 măsurați, pas mediu 2,41 m; pe N 15, pas 2,57 m. Pasul
  variază 2,1–2,7 m, cum spune SIPA („sensivelmente diferente”);
- **câte arce și câte ferestre** are fiecare aripă nu se măsoară: le numără Pinho
  Leal, *Portugal Antigo e Moderno*, vol. IX (1880), p. 137 — **63 de arce la N, 47
  la S**; 46 de ferestre pe fața aripii N, 36 la S. Aceeași pagină dă încăperile
  (22 / 21 la N, 18 / 18 la S) exact ca SIPA, de aceea i se dă crezare. Rezerva:
  numărătoarea e dinaintea restaurării din 1964–1975;
- fotografia vede fațadele numai până la u ≈ 37 m din 119 și 154. Mai departe,
  arcele rămase până la numărul din 1880 se împart egal până la capăt: pas 2,57 m
  la S, 2,41 la N — invers decât pașii măsurați, dar în plaja lor. Pozițiile sunt
  **NEVERIFICAT**. Că arcada merge pe toată lungimea o sprijină Pinho Leal (casele,
  „tudo com uma arcada geral”, o arcadă comună), Paulo Pereira („arcaria contínua”),
  SIPA și fotografiile Commons ale lui Alvesgaspar din 2015 (CC BY-SA 4.0),
  folosite numai ca să se vadă, nu copiate. La treimea de est a aripii S planurile
  nu se împacă: al Câmarei din 2015 are arcada pe toată lungimea, unul scanat, fără
  dată, ~30 m fără stâlpi;
- ferestrele etajului: perechi, „num módulo de duas a duas” (SIPA), deci 23 la N și
  18 la S. La N sunt mai multe perechi decât încăperi (21). Perechile măsurate
  rămân unde sunt; celelalte umplu zidul la pas egal pe fiecare parte, cu o
  jumătate de pas la capete, iar câte vin înaintea celor măsurate se alege cât toți
  pașii să iasă cât mai egali (4 la N, 0 la S) — NEVERIFICAT. Înainte, un pas egal pe
  toată aripa, cu faza potrivită, muta perechile măsurate ale aripii S cu până la
  1,24 m și scotea tăcut câte o fereastră care ieșea din zid: la S prima, peste
  corpul de legătură, la N ultima. Acum `build-sanctuar` se oprește dacă o fereastră
  iese din zid: numărul vine dintr-o sursă, deci nu are voie să scadă tăcut;
- fațada bisericii e rectificată frontal, la 4 cm/px: soclu, cornișa dintre
  registre (142,0–142,6), cunhais, trei ferestre, trei portaluri, nișa, ceasul
  solar al turnului N (SIPA: „relógio de sol circular, em cantaria”). Cornișa de
  sus a turnurilor iese la 146,6, nu la 146,5 din cotele „REVIVE” (vezi probele);
- golurile clopotnițelor: „em duas faces”, SIPA; fața de est măsurată, a doua
  presupusă cea exterioară, NEVERIFICAT.

**Ocluzia.** Soarele are umbre adevărate; lumina cerului (HemisphereLight) nu, iar
fundul unei galerii ar primi exact cât fațada. Aripa S stă mereu în umbră, deci
acolo arcada n-ar mai avea deloc contrast. Fiecare vârf poartă o ocluzie
(`ocluzie`, un octet): cât cer vede suprafața, ca aproximare pe tipuri — fundul
galeriei 0,4, tavanul 0,3, intradosul 0,55. Shaderul o aplică NUMAI luminii
indirecte, după `aomap_fragment`, ca un `aoMap`. Albedoul rămâne cel măsurat.

### În pagină

- `creeazaSanctuar()` nu aruncă. Fiecare element e în `try`-ul lui, iar datele lui se
  verifică întâi: JSON n-are NaN, dar are `null`, iar `null` intră în aritmetică drept
  0 — un colț mutat tăcut în originea scenei.
- Talpa pereților: cel mai jos punct al reliefului paginii (`inaltimeLa`, interpolat
  biliniar) în colțurile și la mijlocul laturilor conturului, minus 0,5 m — marja
  acoperă diferența dintre interpolare și triunghiurile plasei.
- `loveste(raza)` dă clădirea din fața razei: cutia fiecărui element, apoi
  Möller–Trumbore numai pe triunghiurile lui. Panoul punctului o preferă terenului
  când e mai aproape și scrie și cota solului.
- Eticheta e un buton DOM, proiectat în ramura de randare, după
  `camera.updateMatrixWorld()`: `OrbitControls.update()` cheamă `lookAt()`, care
  reface matricea cu poziția nouă și rotația VECHE, iar `render()` o reface abia
  după. Fără ea, la o orbitare de 3° pe cadru pinul stătea la 44 px de biserică;
  cu ea, la 0,06 px. Ocolește panourile,
  trece la marginea ecranului cu o săgeată când ancora iese din cadru și se face
  punctată când relieful o acoperă. **Vizibil = `getClientRects().length`**, nu
  `offsetParent`: acela e null și pentru `position: fixed`, adică pentru fișa de pe
  telefon, sub care eticheta ajungea fără să știe.
- Clicul deschide fișa, APOI zboară: zborul primește cutia fișei. Cât fișa e
  deschisă, un decalaj de obiectiv (`setViewOffset`) mută imaginea în partea liberă —
  foaia de jos pe telefon, panoul din dreapta pe desktop — iar distanța crește cât
  să încapă complexul (~110 m în jurul terreiro-ului). Camera și pivotul nu se mută.
  Pe telefon, fără el, biserica ieșea din ecran la x = −18. Fișa laterală contează
  de la un sfert din lățime: între 545 și 666 px trece de 60%, iar un prag la 40%
  lăsa complexul sub ea. Regulile stau în `src/scene/fisa-cadru.js`, ca proba Node
  să ruleze același cod.
- **Ecranul rotit cu fișa deschisă** reface decalajul și, dacă trebuie, distanța.
  Până pe 2026-10-08 refăcea numai decalajul: din peisaj în portret partea liberă
  devine foaia îngustă de deasupra fișei, iar camera rămânea la distanța de la
  deschidere — în pagină, 844 × 390 → 390 × 844 lăsa ancora etichetei la x = −17,6
  (eticheta în modul „margine”), iar 1024 × 768 → 768 × 1024, la x = −67,5. Acum
  pornește un zbor nou, numai dacă distanța cerută trece de cea de acum cu peste
  10% (`PRAG_ZBOR_NOU`) — cât zborul deschiderii e încă în aer, de cea spre care
  merge — și numai dacă utilizatorul n-a atins controalele de la deschidere
  (`start`, pe care îl emit mutarea, rotirea, rotița și degetele, dar nu zborul).
  Din portret în peisaj camera stă doar mai departe, fără mișcare; bara de adrese,
  câteva procente din înălțime, nu trece de prag. După o atingere camera e a
  utilizatorului: rotirea reface numai decalajul, ca înainte. Măsurat în pagină,
  după rotire: 574,71 m și ancora la (85,7; 191,5) pe telefon, 738,96 m și (83,0;
  517,2) pe tabletă, eticheta în modul „ancora”; după o rotiță pe canvas, camera
  rămâne la 228,31 m.
- `creeazaSanctuar()` își golește scriitorul imediat după predare, iar `dispose()`
  stinge pozițiile pe care le ține `loveste`: obiectul întors trăiește în
  `globalThis.__scena`, deci altfel rămâneau 2,38 MiB după dispose(); acum 0.

### Umbrele

`src/scene/umbre.js`: o singură hartă de 2048², strânsă pe clădiri plus lungimea
umbrei (60 m; la 18° o clădire de 15 m aruncă 46 m): 0,211 m pe texel pe sanctuar;
de departe, cutia unită a grupurilor, 0,50–0,60 m — vezi „Umbrele pe grupuri”. Cutia
lasă apeductul afară: merge ~550 m spre est și dubla fereastra luminii (0,336 m pe
texel) pentru umbre de 2–8 m. Harta ține ~32 MiB pe placă — adâncime plus culoare,
pe care r186 o alocă oricum.
`autoUpdate = false`: se desenează la pornire și apoi numai când soarele se mută
între vederi sau camera trece la alt grup de clădiri. Tocmai de aceea trebuie refăcută la
`webglcontextrestored`: three face atunci un WebGLShadowMap nou, iar o lumină cu
`autoUpdate = false` și fără `needsUpdate` e sărită. Proba: contextul pierdut și
refăcut dă 0 pixeli diferiți; fără umbre, pe aceeași vedere, diferă 8 393.

Ascultătorul de restaurare e unul singur și se înscrie oricum, după blocul umbrelor:
cere un cadru și, dacă sunt umbre, le reface (`umbre?.refa()`). Stătea înainte numai
pe ramura umbrelor, iar cât contextul e pierdut `render()` iese devreme și bucla tot
consumă cererile: fără sanctuar și fără clădiri, canvasul rămânea gol până la prima
atingere. Probe, în pagină, cu `WEBGL_lose_context`, 1 s fără nicio atingere:
- fără umbre (cererile `sanctuar_v2.json` și `cladiri_v1.json` cu 404): 1 cadru și
  harta pe ecran; pe codul de dinainte, 0 cadre și fundalul gol;
- cu umbre, din vederea de pornire, în țintă fixă 640 × 400: `refa()` chemat o dată,
  1 cadru, 0 pixeli diferiți; control, cu `refa()` ocolit: 37;
- pierdut și refăcut în timpul pornirii, cu relieful întârziat 2 s: 0 erori, harta pe
  ecran — ascultătorul nu era încă înscris, dar bucla pornește cu `cerut = true`.
  Mai devreme nu poate sta: `cereRandare` și `umbre` se declară în `construieste()`,
  iar înscris la începutul ei ar fi aruncat ReferenceError la o restaurare venită în
  timpul unui `await` (dedus din cod, nemăsurat).

Aruncă umbră sanctuarul și, din v0.1.0, clădirile din afara lui; primesc
clădirile, suprafețele și terenul. Împrejurimile nu primesc și n-au nici codul umbrelor în
shader (vezi „Zona alpha și împrejurimile”). Cutia trece între grupuri — vezi „Umbrele pe
grupuri”, la far.

Soarele nu se mută ca să încadreze umbra — numai între vederi, Relief ↔ Satelit,
unde `potriveste()` reîncadrează cutia și redesenează harta o dată. Camera de umbră
stă unde stă lumina, la 4 km, și doar marginile ei se strâng pe complex. O poziție mutată, chiar pe aceeași direcție, ar fi rotunjit
altfel vectorul luminii pe toată harta. Proba: în țintă fixă 640 × 400, în trei
vederi, **0 pixeli diferiți** în afara dreptunghiului umbrei; la fel cu sanctuarul
cu totul ascuns.

### Probele: `npm run verifica-sanctuar`

Codul paginii, în Node, cu `fetch` înlocuit. Probele de fond au control negativ —
aceeași probă pe o greșeală cunoscută, care trebuie să pice: acoperișurile,
amprentele, drapajul, zborul, sha256-ul plasei și fișa cu ecranul rotit. Bugetul
n-are nevoie de unul.
- **încărcătorul:** index.html cu 200, 404, JSON trunchiat, nume străin, schemă
  necunoscută, material fără rgb, listă lipsă — `null` și un avertisment, fără
  aruncare; ancoră greșită; o coordonată `null` sare numai elementul ei;
- **bugetul:** clădiri ≤ 70 000 de triunghiuri (azi 17 745), suprafețe ≤ 80 000
  (60 866 pe `harta_v4`/`harta_v5`; 60 855 pe v2/v3), JSON ≤ 150 KB (94,7);
- **geometria:** vârfuri finite, ocluzie pe fiecare, stâlpi în ordine cu goluri
  ≥ 0,2 m, corpuri convexe — proba care a prins linia rotită a aripii N;
- **amprenta plasei:** sha256 pe position, color și ocluzie, egal cu `AMPRENTA` din
  capul scriptului, citită pe 2026-10-08 (`sanctuar_v2` pe `harta_v5` + `harta_v4`). O
  refactorizare a formelor o lasă la bit; o schimbare voită o rescrie acolo, cu motivul
  în commit. Pagina dă aceleași trei sume, citite cu `crypto.subtle` din
  `__scena.sanctuar`. Control: vârful lui `biserica.turn_n` mutat 1 mm dă altă sumă;
- **turnul pe orice număr de colțuri:** `turn()` pe poligoane regulate de 4, 5, 6 și 8
  colțuri, cu centrul în (100; 100): vârful flișei cade pe centru (0 m), inelul ei de
  sus la 1,27 m de el (abatere ≤ 4·10⁻⁶ m, Float32), iar nimic nu iese din amprenta
  lărgită cu cornișa. Până pe 2026-10-08 centrul flișei era suma colțurilor împărțită
  la 4: proba pica la 5, 6 și 8 colțuri, cu vârful la 34,09 / 69,44 / 140,15 m de
  centru, fără niciun avertisment. Turnurile din date au toate câte 4 colțuri, deci
  pagina n-a arătat niciodată greșeala, dar nimic n-o cerea: încărcătorul verifică
  listele, `valid` numai numerele. Media colțurilor e acum o singură funcție,
  `mediaColturi`, pentru turn, piramidă, `micsorat` și plăci;
- **numărătoarea din 1880** ajunge întreagă în pagină: 47 / 63 de arce, 36 / 46 de
  ferestre. Pe `sanctuar_v1` ar fi picat: 49 / 60 de arce, 35 / 41 de ferestre;
- **suprafețele** stau pe triunghiurile randate: 0 vârfuri în afară, maximum 1 mm;
  control: față de relieful interpolat biliniar, abaterea ar fi 175 mm;
- **drapajul la bit:** sha256 pe cele patru straturi cât în `AMPRENTA_DRAPAJ`, cel mult
  40 000 de celule cercetate (codul vechi: 151 750, pică) și contururi convexe (le scrie
  în evantai). Controale: o suprafață mutată 1 mm schimbă amprenta; intervalul de pe rând
  fără traversările laturilor trece de proba de mai sus și pică pe aceasta;
- **față de LiDAR** (cere rastrul): acoperișurile pe pixelii interiori, la cel puțin
  0,75 m de pereți — mediana 0,000, p90 0,249 m (prag 0,25 / 0,8), iar ridicat cu
  1 m pică; amprentele cad pe clădire în 98,3% din aria lor, iar mutate 2 m
  perpendicular pe aripi, 84,7%. Vârfurile turnurilor sunt numai o probă de
  consistență: `varf` e chiar maximul MDS al părții, deci ea prinde doar o
  greșeală de transport până în pagină;
- **cotele „REVIVE 2019”** se tipăresc numai informativ, fără prag. Au fost
  atribuite unei planșe REVIVE la cercetarea de la început, dar nu apar pe niciuna
  dintre cele șapte planșe publicate, citite cu tot cu textul din desene: acelea au
  numai cote de teren. O cifră cu sursă necunoscută nu dovedește nimic, nici când se
  potrivește. Pe LiDAR, nimic de pe biserică nu stă la 145,90: coama navei e
  orizontală la 146,85, capela-mor ajunge la 144,0;
- **zborul** aterizează la 1e-13 m din repaus, după o aruncare și sub
  `prefers-reduced-motion` (acolo în 0 cadre), iar busola citește 205°; control:
  pe nordul grilei ar citi 204,33°;
- **fișa cu ecranul rotit**, cu `fisa-cadru.js`, zborul și camera paginii, pe un
  canvas fals și cu cutia fișei socotită după main.css (cum iese în pagină: la
  390 × 844, 374 × 464 px, sus la 372). Ce iese din partea liberă: 64 de puncte pe
  cercul complexului, ancora și cele 200 de colțuri ale corpurilor. 844 × 390 →
  390 × 844 și 1024 × 768 → 768 × 1024 zboară până la o deschidere direct în portret
  (la 10⁻¹³ m; 575 și 739 m): 6/64 puncte afară, 4/200 colțuri, 0/28 ale bisericii,
  ancora liberă. Control, o atingere după deschidere — calea veche: camera rămâne la
  320 / 327 m, cu 48/64 și 46/64 puncte afară, 24/28 și 28/28 colțuri ale bisericii,
  ancora la x = −18 și −68 — pică. Invers, din portret, niciun zbor și 0/64; bara de
  adrese (înălțimea 844 → 900 → 790 px, cerute 613 / 538 m față de 575), niciun zbor; fără fișă, camera nu se mișcă; rotit după
  3 cadre ale zborului deschiderii, cu camera încă la 611 m, aterizează tot la
  575 m — o comparație cu distanța de atunci n-ar fi zburat; sub reduced-motion, în
  0 cadre;
- **raza** verticală pe navă lovește acoperișul la 1 mm; una prin golul unui arc
  trece de fațadă și lovește fundul galeriei la 11,8 m; una în stâlp, la 10 m.

## Farul și celelalte clădiri

Farol do Cabo Espichel, cele șase clădiri de lângă el și cele trei de la Casa da
Ronca, la ~400 m spre sud-vest, intră pe hartă ca geometrie, în schema sanctuarului:
`public/data/cladiri_v1.json`, construit în pagină de același `creeazaSanctuar()`.

### Contururile: OSM, înregistrate pe LiDAR

- `npm run osm-cladiri` e un profil separat: `osm-sanctuar` își rescrie manifestul
  la fiecare rulare. Ia căile cu `building` sau `man_made=lighthouse` din cutia lui
  `harta_v4`, fără cele ale sanctuarului. Instantaneul e
  `date-sursa/osm/cladiri-osm-2026-09-30.json`, manifestul
  `scripts/cladiri/osm-manifest.json`. Sunt 10 căi, niciuna atinsă de changesetul
  120423250.
- `scripts/cladiri/inventar.json` ține câte o decizie pentru fiecare element, cu
  motivul. `build-cladiri` refuză un element fără decizie și un inventar scris pe
  alt instantaneu. Toate 10 intră.
- **Candidații fără OSM** (nMDS > 1 m, NDVI < 0,15, ≥ 5 m², la peste 1 m de
  amprente) sunt doi, de 12 și 5 m². Rămân pe dinafară, cu motivul scris.
- **Aici amprentele OSM NU cad pe clădiri**, spre deosebire de sanctuar. Pe
  nMDS > 1 m acoperă 72–95% din aria lor (farul, pe pixelii de peste 12 m, 68%) și
  sunt mutate cu 0,4–2,2 m, fiecare altfel. `build-cladiri` caută translația, în pași de 0,25 m pe ±3,5 m, care
  maximizează „pixeli de clădire − pixeli de sol” în amprentă. Forma rămâne a
  OSM-ului, iar acoperirea urcă la 86–99%. Cea mai mare mutare e la Casa da Ronca,
  (1,25; 1,75) m.
- **Farul are hexagonul OSM mai mare decât turnul:** la ~5,5 m de ax, MDS-ul
  coboară pe acoperișul casei lipite de el. Se înregistrează cu translație și cu
  scară, pe pixelii de peste 12 m: ×0,84 și (−0,75; 0,25) m. Acoperirea urcă de la
  68% la 95%. Lanterna cade la 0,18 m de axul hexagonului înregistrat — probă de
  consistență, nu independentă: lanterna e în masca pe care s-a potrivit.
- `build-cladiri` scrie și `date-sursa/derivate/cladiri-grup-N.png`: ortofotoul
  mărit de 3 ori, cu amprenta OSM roșu, cea înregistrată galben și farul cyan.

### Formele

- **Amprenta concavă** se taie în părți convexe (urechi, apoi Hertel–Mehlhorn).
  Nodurile de pe laturi se scot întâi: 156262936 are cinci, la 1–5 mm, iar unul la
  −1 mm ar face concav un dreptunghi.
- **Fiecare parte** ia minimul planelor RANSAC (`scripts/comun/plane.mjs`, mutat din
  `masoara-sanctuar` cu rezultat identic), pe pixelii de la cel puțin 0,75 m de
  marginea clădirii. O parte sub 40 de pixeli ia planele clădirii.
- **Treptele.** Un acoperiș în trepte nu e un minim de plane: planul de jos,
  prelungit, taie prin cel de sus. Pe 156262922, mediana abaterii ieșea 0,92 m.
  Unde p90 trece de 0,5 m, partea se taie pe dreapta care desparte cele două plane
  mai mari. Tăietura rămâne dacă p90 scade cu cel puțin 0,2 m; acolo a scăzut de la
  1,11 la 0,05 m.
- **Farul** e o prismă hexagonală până la platformă, apoi lanterna.
  - Platforma: mediana MDS pe inelul 0,6–0,95 din apotemă, 158,59 m (solul e la
    136,71 m).
  - Lanterna: inelele de peste jumătatea dintre platformă și vârf, adică r ≤ 2,5 m.
    Urcă vertical până la 166,40 m, iar cupola ajunge la vârful MDS, 168,28 m.
  - Profilul pornește de la platformă, nu de la marginea prismei: un inel plat la
    cota capacului ar pâlpâi cu el.
  - Înălțimea: de la sol la vârf, 31,57 m. OSM are `height=32`, pe care nicio
    măsurătoare de aici nu-l citește.
- **Măsurat pe clădirile întregi:** mediana abaterii 0,025 m, p90 0,076 m.

### Materialele: după apa cea mai puțin arsă

- **Nu după pantă și nu după culoarea medie.** 156262880 are ape de 48° și e
  țiglă, dar ortofotoul îl dă aproape neutru: apa din est e arsă, cea din vest în
  umbră. La sanctuar, țigla aripii N are a = 0,015 în OKLab, terasa 0,000.
- **Regula.** Pe fiecare apă se numără pixelii arși (un canal ≥ 254). Hotărăște
  apa cea mai puțin arsă:
  - arsă și ea peste 50% ⇒ alb, `var`: 156262911 și 156262922, cu 82–94% pe
    fiecare apă. O țiglă are apa din umbră la 0–4%;
  - roșcată ⇒ `tigla`, albedoul din fotografie. Pragul lui a stă la jumătatea
    dintre terasa sanctuarului și cea mai puțin roșcată țiglă a lui, măsurate la
    fel;
  - altfel, referința neutră cea mai apropiată: terasa (303868633) sau acoperișul
    întunecat.
- **Cum se citește ortofotoul.** Cu deplasarea pe sol și cu înclinarea
  acoperișului: h × înclinarea măsurată la sanctuar, iar la far cea a grupului de
  peste 9 m. Pe casa lipită de far se scoate imaginea turnului, înclinată de la sol
  până la vârf.
- **Controlul a fost privirea**, pe straturile `cladiri-grup-N.png`: toate cele
  zece acoperișuri ies cum se văd acolo, iar cupola lanternei iese roșcată.
- **Presupuneri**, scrise și în date, la `presupuneri`: pereții — var la clădirile
  întregi, zidărie la cele pe care OSM le dă ruine — și camera lanternei, var. Nu se
  văd de sus: **NEVERIFICAT**.
- **Casa da Ronca și 96521147 sunt `ruins=yes` în OSM**, dar LiDAR-ul vede acoperiș
  întreg (96% din amprentă pe două ape de 30°), iar ortofotoul, țiglă. Se construiesc
  cu acoperiș, cu pereții din zidărie. Numele „Casa da Ronca” vine numai din OSM —
  **NEVERIFICAT** într-o sursă primară.

### În pagină

- `incarcaCladiri()` și `incarcaSanctuar()` stau pe aceeași funcție din
  `loaders.js`. Fiecare refuză datele celeilalte, după prefixul lui `nume`.
- `creeazaSanctuar({ ..., eticheta: 'clădiri' })` are `fatada`, `cruzeiro` și `poi`
  opționale. `materiale_profil` dă câte o culoare pe segment de profil. Fiecare
  element poartă un `grup`, iar obiectul întors are `cutiiGrupuri`.
- Proba refactorizării: `sanctuar_v2` dă același sha256 pe position, color și
  ocluzie, înainte și după. Din 2026-10-08 sumele stau în `verifica-sanctuar` și
  `verifica-cladiri` (`AMPRENTA`), deci orice refactorizare trece prin ele.
- Clădirile sunt al doilea Mesh, pe același program (`sanctuar-ocluzie`): un apel
  de desenare în plus și 232 de triunghiuri.
- Panoul punctului ia clădirea cea mai apropiată din oricare set. Numele vin din
  `src/content/cladiri.js`, după prefixul cheii.

### Umbrele pe grupuri

- **Trei grupuri:** sanctuarul, farul, Casa da Ronca. Texelul, în metri:

  | soarele | cutia unită | sanctuarul | farul | Casa da Ronca |
  |---|---|---|---|---|
  | Relief (18° / 244°) | 0,604 | 0,211 | 0,124 | 0,102 |
  | al zborului (39,5° / 94°) | 0,497 | 0,216 | 0,118 | 0,097 |

- **`urmaresteGrupul()`** din `scena.js` alege cutia la fiecare cadru desenat:
  - cutia unită, dacă texelul ei stă sub TEXEL_MAXIM (0,3 m) sau nu trece de
    pixelul ecranului la țintă. Pixelul e al canvasului (`canvas.height`), nu CSS și nu
    neapărat de dispozitiv: raportul e plafonat la 2, iar canvasul la 2560 × 1440;
  - la pornire ținta e la 611 m, iar primul cadru are de acum soarele zborului (harta apare
    direct pe Satelit): cutia unită rămâne pe un canvas înalt de cel mult ~1 121 px
    (1120 → „toate”, 1122 → „sanctuar”); cu preferința Relief, cu soarele Relief, ~922 px
    (920 / 925). Se alege la primul cadru: la creare canvasul are încă 300 × 150. Măsurat în
    pagină, la primul cadru, pe Satelit: 1440 × 900 la DPR 1 dă „toate”, 0,497 m pe texel; la
    DPR 2 (canvas 2428 × 1517) „sanctuar”, 0,216 m; telefonul în portret, 390 × 844 la 3×
    (780 × 1688), „sanctuar”; în PEISAJ, 844 × 390 la 3× (1688 × 780), „toate”, 0,497 m —
    raportul de pixeli e plafonat la 2 (vezi „Mărimea canvasului”), iar fără plafon canvasul
    ar avea 1170 px înălțime, peste prag. Farul își primește umbra când te apropii de el.
    Cutia unită, forțată, ar fi
    făcut umbrele sanctuarului, din mijlocul imaginii, de 2,3 ori mai difuze sub
    Satelit și de 2,9 ori sub Relief;
  - altfel, grupul cel mai apropiat de țintă.
- **Texelul cutiei unite depinde de soare**, deci pragul se judecă în buclă, nu la
  creare. `umbre.potriveste()` crește `versiuneSoare`, iar `pas()` recitește atunci
  texelul cu `texelPentru(cutie)`, o proiecție care nu atinge camera. Înainte de
  recenzia three.js, pragul rămânea cel al soarelui Relief și sub Satelit: pe un
  ecran de 1 000 px, grupurile nealese pierdeau umbra de la 663 m de țintă în loc
  de 546 m.
- **Histerezis:** ±10% pe pixel și 20 m între grupuri. O schimbare costă o
  redesenare a hărții, în același cadru: `needsUpdate` se pune înainte de `render`.
- **Consecința:** de departe umbrele se văd pe toate grupurile, la 0,50–0,60 m pe texel;
  de aproape, numai pe grupul privit.

### Probele: `npm run verifica-cladiri`

- **încărcătorul:** șapte căi de eșec dau `null` și un avertisment, fără aruncare.
  Una dintre ele sunt datele sanctuarului;
- **construcția:** 0 elemente sărite, 232 de triunghiuri (buget 6 000), 6,5 KB
  (buget 20), două grupuri. O cheie inexistentă în `materiale_profil` sare farul,
  cu avertisment; înainte, culoarea nedefinită se scria tăcut ca negru;
- **vârful:** cel mai înalt vârf e la 168,28 m, iar raza verticală pe ax lovește
  `far.turn` la 168,280 m;
- **amprenta plasei:** sha256 pe position, color și ocluzie, egal cu `AMPRENTA` din
  capul scriptului (2026-10-08), ca în pagină; control: vârful lanternei coborât 1 mm
  dă altă sumă. `cladiri_v1` n-are `turnuri`: farul e o cupolă cu `laturi`;
- **față de LiDAR** (cere dalele):
  - acoperișurile, pe 3 774 de pixeli: mediana −0,001 m, p90 0,085 m. Ridicate cu
    1 m, pică;
  - amprentele stau pe clădire în 97,3% din aria lor; mutate 2 m, cel mult 85,2%.
    **Proba amprentelor nu e independentă:** înregistrarea a maximizat chiar mărimea
    asta, deci prinde numai o greșeală de transport până în pagină.

## Principii de design (nenegociabile)

- **Accesibilitate:** fonturi mari, contrast ridicat. Cititorii pot fi vârstnici.
- **O singură temă, întunecată**, oricum ar fi setat sistemul: `:root` din
  `main.css` și `PALETA` din `palette.js` (cerul și marea scenei). `color-scheme:
  dark`, în CSS și în `index.html`, ține întunecate și controalele native, cu
  barele de defilare. Tema deschisă, aleasă după `prefers-color-scheme`, a plecat
  după v0.1.1, la cererea autorului.
- **Responsivitate** reală, pe toate dimensiunile și nivelurile de zoom.
- **Navigare clară:** nav sticky, breadcrumbs, scrollspy.
- **Degradare grațioasă:** pagina trebuie să rămână lizibilă și fără WebGL.
  Textul este conținutul; scena 3D îl servește, nu invers.
- `prefers-reduced-motion` oprește animațiile automate ale camerei.

## Acuratețe factuală

Conținutul se sprijină pe surse primare portugheze (Diocese de Setúbal,
Câmara Municipal de Sesimbra, monumentos.gov.pt / SIPA, literatura
paleontologică). Nu inventa date, cifre sau nume. Dacă o afirmație nu are
sursă, marcheaz-o `<!-- NEVERIFICAT -->` și spune-mi.

IMPORTANT: diferența de vârstă dintre siturile Pedra da Mua (Jurasic superior)
și Lagosteiros (Cretacic inferior) este de ~15–20 milioane de ani. Cifra
„50 de milioane" care circulă în versiunile vechi ale textului este greșită.

## Fotografiile de la fața locului

Originalele stau în `date-sursa/poze/` — date-sursă, deci în afara depozitului,
lângă `lidar/`. `public/photos/` e altceva: fotografiile pe care le *afișează*
pagina, redimensionate. Copiază-le prin USB; WhatsApp, Telegram și descărcarea
din Google Photos pe web șterg sau degradează GPS-ul din EXIF.

`npm run citeste-poze` citește EXIF-ul fără să decodeze niciun pixel și întreabă
hărțile de relief unde cade fiecare poză. Scrie `date-sursa/poze/indice.json`.

Două lucruri pe care le-a scos la iveală și care rămân valabile:

- **Altitudinea din EXIF e elipsoidală**, deși Android o etichetează cu
  `GPSAltitudeRef = 0`, „deasupra nivelului mării". LiDAR-ul DGT e ortometric.
  Diferența e ondulația geoidului, 52,92 m aici (EGM2008, via GeoidEval). Fără
  scăderea ei, cele două par să difere cu ~58 m. Altitudinea de folosit e cea din
  LiDAR: GPS-ul telefonului e bun lateral (~5 m) și slab pe verticală (~±10 m).
- **`0x0010` din GPS IFD e `GPSImgDirectionRef`, nu direcția** — direcția e
  `0x0011`. Inversate, litera „M" citită ca număr dă 77 la fiecare poză, adică o
  valoare constantă care pare măsurătoare și nu e.

Ce **nu** pot face pozele: să picteze harta. EXIF-ul nu conține înclinarea și
rotația camerei, deci o poză nu se poate proiecta pe relief. Rolul lor e să dea
culorile măsurate cu care `culoareTeren()` pictează toată harta.

### Lanțul culorilor

`citeste-poze` → `culori-poze` → *etichetat de om* → `paleta`

`culori-poze` grupează culorile în **OKLab**, nu în RGB: distanța din OKLab
corespunde diferenței percepute, deci grupurile ies acolo unde le-ar vedea și
ochiul. k-means pornește cu **sămânță fixă** — fără ea, fiecare rulare dă alte
grupuri, iar etichetele puse de om pe „grupul 5" ajung pe alt material.

Etichetele stau în `date-sursa/poze/etichete.json`, **cheie pe culoare, nu pe
numărul grupului**: numărul e doar ordinea de afișare, culoarea e lucrul la care
omul s-a uitat. Fiecare petic primește eticheta reperului celui mai apropiat în
OKLab, deci etichetele supraviețuiesc unei regrupări.

`paleta` scoate **albedo, nu aparență**. O fotografie măsoară materialul înmulțit
cu lumina care cădea pe el; calcarul a ieșit în trei grupuri care sunt aceeași
piatră în umbră, la umbră deschisă și în soare. Media lor n-ar exista nicăieri pe
promontoriu. three.js înmulțește culoarea vârfului cu propria lui lumină, deci o
umbră coaptă în culoare s-ar aplica de două ori. Luminozitatea se ia din cuantila
0,8 (materialul în soare), iar nuanța numai din peticele peste mediană — umbra e
albastră de la cer și ar trage albedoul spre rece.

`masurat.nuanta_de_incredere` e fals când croma e sub 0,02: fotografiile nu susțin
nicio nuanță anume și materialul iese practic neutru. **Nu se inventează una.**
La calcar, vegetație uscată și tufăriș e fals — vezi nota din `paleta-teren.json`.

### Ortofotoul, și de ce nu înlocuiește fotografiile

`ORTOS-2025` de la DGT, dala `ORTOS-2025-cog-25cm-464-3` (283 MB, în
`date-sursa/ortofoto/`, deci în afara depozitului). Lângă ea stă, din 2026-10-07, și
464-1, dala de la nord (335 MB), pentru împrejurimi; scripturile lui alpha numesc dala
lor (`ORTOFOTO_ALPHA` din `scripts/comun/ortofoto.mjs`), nu iau „primul .tif din
director” — alfabetic, 464-1 vine înaintea lui 464-3, iar `verifica-teren` chiar a picat. **BigTIFF**, nu TIFF clasic:
magic 43, numărul de intrări dintr-un IFD pe 8 octeți, intrări de 20 de octeți,
valori inline până în 8 octeți. `citesteIfd(..., big)` din `scripts/comun/tiff.mjs`
tratează ambele.

**Atribuirea.** Datele DGT sunt CC BY 4.0, iar metadatele lor din SNIG cer, la orice
publicare, și adaptată, textul „Informação geográfica cedida pela Direção-Geral do
Território”. Îl scrie `scrieSurse()` din `src/main.js`, o singură dată, cu
`lang="pt"`, ori de câte ori subsolul are o sursă DGT. Sidecarurile publicate nu
s-au rescris pentru asta.

În pagină rămâne un singur rând, fără fundal, sus-stânga: „© DGT · © Copernicus ·
© OpenStreetMap”. Copernicus vine cu împrejurimile — relieful GLO-30 și Sentinel-2;
o sursă își poate scrie singură numele scurt (`scurt`), iar două surse cu același
nume scurt apar o dată. Licențele fără adresă cunoscută iau `licenta_url` din sursă,
iar clauza de răspundere a licenței Copernicus DEM (`raspundere`) intră în modală
lângă atribuiri. Se citește prin contur: opt umbre de 1–1,5 px fără estompare
desenează în jurul literelor un inel plin din culoarea fundalului, deci contrastul e
al lui `--ink` pe `--bg`, peste 14:1. Numai cu umbre estompate, recenzia măsurase pe
cerul de pornire, pe tema întunecată, mediana 3,47:1. Inelul de focus al rândului e
de culoarea textului, între două chenare din culoarea fundalului: cel auriu obișnuit
avea ~1:1 față de cer. Regulile OSM (OSMF,
Attribution Guidelines) cer ca atribuirea să se vadă fără interacțiune; „©
OpenStreetMap” e o formă acceptată, iar legătura duce la pagina lor de copyright.
„© DGT” deschide o modală cu tot restul — textul SNIG, atribuțiile, licențele,
prelucrările —, un `<dialog>` deschis cu `showModal()`: focusul rămâne înăuntru,
Escape o închide, pagina de dedesubt e inertă. Rândul și modala se fac o singură
dată. Pe calea automată sursele Satelit sosesc înaintea lui `data-scena` și intră în prima
scriere a subsolului; Satelit cerut din buton, după pornire, rescrie numai textele, deci o
modală deschisă rămâne deschisă. Cât e deschisă, Escape-ul e al ei: fișa
sanctuarului, inertă dedesubt, nu-l mai fură.

Piramida lui are nivel la **2 m** și la **1 m** — exact pașii lui `harta_v4` și
`harta_v5`. Colțul e la TM06 (−96000, −135000) cu pas 0,25 m, iar decalajul până
la `harta_v4` (aceeași cutie ca `harta_v2`) iese **106 × 703 pixeli, întregi**:
pixelul ortofotoului cade peste nodul LiDAR fără reeșantionare. La `harta_v5` pasul se potrivește, dar
alinierea NU: pe convenția „noduri", amprenta primului nod începe la 1180,5 ×
2298,5 pixeli, deci nodurile cad pe colțurile pixelilor. Peticul se citește de la
nivelul de 0,5 m, mediat 2 × 2 — vezi stratul NDVI, mai sus. Scriptul verifică asta și se oprește dacă nu iese.
Control independent: numărul de celule de uscat din contur, 773 208 pe `harta_v4`
(491 895 pe `harta_v2`, 492 056 pe `harta_v0`), e identic cu
`acoperire.uscat_masurat_in_poligon` din sidecar, iar
`ortofoto.mjs` aruncă dacă cele patru clase nu-l acoperă exact.

Dalele sunt JPEG cu `JPEGTables` partajate (73 de octeți: SOI + o tabelă de
cuantizare + EOI) și `PlanarConfiguration = 2`, deci fiecare dală e un flux JPEG
**prescurtat**, cu un singur canal. Se lipește tabela imediat după SOI-ul dalei,
altfel nu se decodează.

**Cele două surse sunt oarbe una acolo unde cealaltă vede, și e geometrie, nu
preferință:**

- fotografiile de la sol măsoară bine numai ce era aproape de aparat; restul a
  venit prin kilometri de aer, care împrăștie albastrul. Tufărișul avea `B > G`
  în poze (`#3b4447`) și `G > B` în ortofoto (`#516868`), cu croma dublă.
- ortofotoul n-are drumul acela de aer, dar privește drept în jos, deci vede o
  faleză aproape din muchie.

Deci: platoul de la ortofoto, faleza și ce-a fost sub picioare din fotografii.
Tabelul `SURSA` din `scripts/paleta.mjs` ține regula, iar fiecare material din
`paleta-teren.json` poartă ambele măsurători, cu `sursa` și `de_ce`.

`npm run paleta` merge și fără ortofoto — dala nu intră în depozit, deci cine
clonează trebuie să poată reface paleta numai din fotografii.

### Zborul ortofotoului: soarele, deplasarea, înclinarea

`npm run masoara-zbor` le măsoară pe ortofoto însuși și scrie
`date-sursa/derivate/zbor.json`, plus imaginile de control `zbor-<zonă>.png`.
Azimuturile sunt de GRILĂ, ca scena; efemeridele dau azimut adevărat, iar
A_grilă = A_adevărat + 0,674°.

**Soarele, din umbre.** Pentru fiecare (azimut, elevație), MDS-ul de 50 cm spune ce
pixeli de sol stau în umbră — o rază spre soare lovește ceva mai înalt —, iar scorul
e cât de bine desparte masca asta pixelii întunecați de cei luminați. Luminanța se
ia RELATIV la solul din ±15 m: fără asta scorul compara materiale, nu umbre, iar pe
jumătățile zonei câștigau sori absurzi (147° la 9°), fiindcă terreiro-ul e mult mai
deschis decât pământul de alături. Solul: nMDS < 0,3 m, fără vegetație, deasupra
mării, la cel mult 40 m de ceva mai înalt de 3 m.
- sanctuarul: **azimut 94,0°, elevație 39,5°**; jumătățile de nord și de sud,
  căutate separat, diferă cu 1,1°;
- farul, independent: 92,25° / 39,5°, la 1,75° de sanctuar; jumătățile, 2,1°;
- controale: soarele opus dă scorul ~0 (0,004 față de 0,446), iar elevația ± 5° îl
  scade.

Pagina folosește soarele sanctuarului.

**Proba independentă e cerul.** Perechea (azimut, elevație) trebuie să fie o
poziție prin care soarele chiar a trecut în fereastra de zbor a lotului 4
(24.05–25.07.2025). Soarele sanctuarului cade la 0,08° de poziția din 17 iulie,
09:00 UTC, sau din 25 mai, 08:51 UTC; cel al farului, la 0,01° de 2 iunie, 08:49 UTC.
Cifra veche, 96° / 22,5°, cade la 9,76° de orice poziție posibilă — deci era greșită.
Mozaicul poate avea linii de zbor din zile diferite; ora exactă nu contează, direcția
da. Vârful umbrei farului a fost încercat ca a doua metodă și lăsat: umbra turnului
traversează acoperișurile și o curte deja umbrită, iar capătul ei nu se citește
fără ambiguitate.

**Deplasarea pe sol.** Umbrirea MDT-ului, cu soarele măsurat, corelată cu luminanța,
pe ~200 000 de pixeli de sol gol de pe versanții de lângă far: maximul la
(+0,25; 0) m, între pixeli (+0,35; +0,01) m — fotografia stă cu o treime de metru
spre est. Controale: fotografia mutată sintetic cu 0,5 m mută maximul exact cu 2
pixeli fini; cu soarele opus corelația devine negativă.

**Înclinarea.** Aceeași corelație pe acoperișuri (umbrirea MDS-ului), minus
deplasarea solului: 0,095 m/m spre 297° la clădirile de 2–9 m, 0,085 m/m spre 284°
la cele peste 9 m. Ortofotoul nu e true-ortho: un acoperiș de 6 m apare mutat cu
~0,5 m, vârful farului (31,5 m) cu ~2,7 m, spre VNV. Afirmația mai veche „~3 m
spre vest” pentru toate acoperișurile nu era măsurată și nu se confirmă.
