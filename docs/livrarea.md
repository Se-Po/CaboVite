# Livrarea și versiunea

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

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
- Rămân pe revalidare (ETag, 304) documentul, iconițele, imaginea `og:image`, `plasa.js`,
  `paleta-teren.json` și straturile `-ndvi`. Paleta se reface sub același nume și are patru versiuni în istoric. Numele unui
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
diferă de el însuși cu 226. Fișierele ies identice la fiecare rulare.

**Imaginea de previzualizare (`og:image`), din 0.1.7.08.** Alegerea autorului: harta pe Satelit,
din vederea de pornire.
- **Captura:** `npm run captura-og`, după build, scrie `public/og-cabo-espichel.jpg`, 1200 × 630,
  cel mult 300 KB (azi 100,7 KB, JPEG la calitatea 85).
  - Pagina se deschide în Edge fără interfață, cu un profil temporar, șters la închidere
    (`scripts/comun/edge.mjs`), pe build-ul servit local. Edge desenează harta pe placă (ANGLE,
    Direct3D11).
  - Panourile de peste hartă se ascund, printr-o foaie construită (`adoptedStyleSheets`), nu
    printr-un `<style>` pe care CSP-ul l-ar raporta. Rămâne rândul surselor, „© DGT · ©
    Copernicus · © OpenStreetMap”, pe care licențele îl cer oriunde se arată harta.
  - Cu erori, avertismente sau încălcări CSP în consolă (și cele scrise de browser, prin
    `Log.entryAdded`), imaginea nu se scrie.
  - Două capturi pe același build au ieșit identice la octet.
- **Cache-ul:** imaginea are un nume fix și stă pe revalidare, ca iconițele, deci o captură
  nouă se scrie peste ea.
- **`index.html`:**
  - `og:image`, cu adresa absolută, `og:image:type`, `:width` și `:height`;
  - `og:image:alt`, care descrie imaginea și numește sursele cu licențele lor — DGT cu
    CC BY 4.0, Copernicus pentru relieful și imaginile împrejurimilor depărtate, OpenStreetMap
    cu ODbL —, pentru cine nu vede imaginea;
  - `twitter:card` `summary_large_image`.
- **Ce nu ține:** fișierul n-are metadate (EXIF, XMP), deci, salvat și repostat singur,
  păstrează numai rândul din pixeli, fără licențe și fără textul SNIG pe care îl scrie
  `scrieSurse()`. Metadatele în fișier rămân la alegerea autorului
  <!-- NEVERIFICAT: dacă textul SNIG trebuie să însoțească și fișierul -->.
- **Proba,** în `verifica-livrare`, pe sursă și pe build:
  - meta-urile, dimensiunile reale ale fișierului (din antetul JPEG, SOF), mărimea și textul
    alternativ, cu fiecare dintre DGT, CC BY 4.0, Copernicus, OpenStreetMap și ODbL;
  - 13 controale, fiecare cu problema pe care trebuie s-o numească. Pe marcaj: fără `og:image`,
    adresa relativă, înălțimea 631, tipul `image/png`, `twitter:card` `summary` și textul
    alternativ fără fiecare dintre cele cinci. Pe fișier, copii în memorie: 1200 × 631 în SOF,
    peste 300 KB, un PNG sub numele lui;
  - cu `--live`: imaginea de pe domeniu, aceiași octeți ca în `dist/`.

**Proba: `npm run verifica-livrare`**, după `npm run build`:
- politica de cache pe fiecare fișier publicat. Clasa fiecărui fel de fișier din `/data`
  e scrisă în probă (`clasaData`), deci un fel nou pică până i se hotărăște politica;
- un nume imutabil care a avut în istoric două conținuturi pică;
- `dist/` local n-are voie să aibă fișiere din `public/` gitignorat. Vercel construiește
  din commit, deci `public/draco`, rămas de la `copy-decoders` (scriptul a fost scos pe 2026-10-09), făcea `npm run preview` să
  servească 763 341 de octeți pe care pagina publicată nu-i are;
- un fișier din `public/` încă neadăugat în git se spune, fără să pice: Vercel nu-l publică
  până nu intră în commit;
- antetele de securitate, CSP-ul față de ce face pagina, marcajul fără inline și garda;
- 0 blocuri `static {}` în `dist/assets` (parserul lui Vite), `plasa.js` numai cu forme ES5 —
  o listă de noduri PERMISE, deci o formă pe care n-o știe pică; nu se vede numai ce nu lasă
  urmă în arbore, virgula de după ultimul parametru (ES2017) —, cu `defer` și fără `type`, semnul `__modulPornit` în intrare și în plasă, mesajul de
  încărcare: `role="status"` pe paragraf, procentul `aria-hidden`, butonul „Arată relieful
  acum” ascuns (vezi `docs/pornirea.md`, „Mesajul”); marcajul de dinainte și butonul fără `hidden` pică.

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

## Versiunea din pagină (mutat din „Flux de lucru”)

- Pagina își arată versiunea, `v0.1.N`, în colțul din dreapta-jos (`#versiune`), odată cu harta
  — cât se încarcă stă ascunsă, cu celelalte panouri (vezi `docs/pornirea.md`, „Panourile”) — și, fără JavaScript, imediat.
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
