# Comenzile, pe larg

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

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
| `npm run verifica` | toate cele nouă `verifica-*` de mai jos, fiecare în procesul lui, în paralel, cu un singur rezumat: probele picate, cele căzute (ieșite fără rezumat), secțiunile sărite; `-- --strict` face din săritură un eșec, `-- --serie` le rulează pe rând, `-- --tot` tipărește jurnalele întregi, `-- teren pagina` numai acelea. `verifica-livrare` se sare dacă `dist/` lipsește sau e mai vechi decât sursele. Vezi „Baza probelor”, mai jos |
| `npm run verifica-teren` | construiește plasa cu codul paginii, în Node, și verifică ce primește și ce pictează regula de culoare; previzualizarea NDVI (scara viridis, magenta fără strat, legenda cu modul din adresă numai ca text) |
| `npm run verifica-tiff` | verifică decodorul LZW și predictorii TIFF, sintetic și pe dalele DGT din `date-sursa/`; `build-zona -- --proba` reface `harta_v4` din dalele numite, identică la octet cu git |
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
| `npm run verifica-cladiri` | construiește clădirile cu codul paginii, în Node, și le confruntă cu LiDAR-ul; umbrele pe grupuri (texelul cutiilor, pragurile și histerezisul lui `urmaresteGrupul`) |
| `npm run surse-imprejurimi` | aduce o singură dată, prin HTTP pe intervale, ferestrele Copernicus DEM și Sentinel-2 ale împrejurimilor → `date-sursa/copernicus/`, `date-sursa/sentinel/`, cu manifestul `scripts/imprejurimi/surse.json` |
| `npm run build-imprejurimi -- harta_vN` | împrejurimile: `harta_v6` și `harta_v9` din dalele DGT numite în `scripts/comun/imprejurimi.mjs`, `harta_v7` și `harta_v8` din Copernicus, în ordinea lanțului: v6, v9, v7, v8 |
| `npm run textura-imprejurimi` | texturile Satelit ale împrejurimilor și NDVI-ul lui `harta_v9`/`harta_v7`/`harta_v8`, din ortofoto (464-3 și 464-1) și Sentinel-2; `-- harta_vN …` numai acelea; cere KTX-Software 4.4 |
| `npm run verifica-imprejurimi` | construiește alpha și împrejurimile cu codul paginii, în Node: încărcarea și construcția fără avertismente, crăpăturile cusăturilor, bugetul și fișierele fiecărui nivel, culoarea peste cusături, netezirea, shaderul fără codul umbrelor |
| `npm run verifica-controale` | mânuirea hărții, cu codul paginii, în Node: construcția scenei de probă fără avertismente, treptele rotiței, zoomul spre cursor și limitele lui, stările gesturilor, punctul panoului „Coordonate” și ieșirea lui „Măsoară centrul”, harta cu pagina mărită, tastatura și drona (urcarea, coborârea, paza solului pe tot trunchiul vederii, la mutare, rotire și zoom, Shift și Ctrl ca taste de modificare), anunțul busolei, Escape pe fișă și pe cutia „Coordonate”, imaginea mutată din calea cutiei „Coordonate” și semnul punctului cules, îndemnul panoului după pointer („Atinge” sau „Dă clic”), planul apropiat cu imaginea mutată, eticheta sanctuarului lângă rândul surselor; conversiile lui `geo.js`, cursorul gestului și pivotul (`gest.js`) |
| `npm run verifica-livrare` | după `npm run build`: cache-ul și antetele de securitate din `vercel.json` pe fiecare fișier publicat, CSP-ul față de ce face pagina, garda numelor publicate, blocurile `static {}` din `dist/assets` și plasa ES5, titlul (`h1`) și `<noscript>` în afara lui `#continut`; `-- --live` le compară cu sebastians.life |
| `npm run verifica-pagina` | ce nu acoperă celelalte probe, cu codul paginii, în Node: textura Satelit când transcodorul KTX2 nu răspunde (limita de timp, abandonul, pagina ascunsă, verificarea dinaintea descărcării); foaia de stil: fără `:has()`, `dvh` numai cu rezervă, selecția oprită numai pe hartă, animațiile numai pe transform/opacity și oprite sub reduced-motion, haloul focusului peste hartă, golul dintre fișă și cutia „Coordonate” pe ecrane înalte, bifa lui Satelit în afara numelui, busola în contrast forțat, panoul „Coordonate” fără text sub 14 px; ordinea de desenare (cerul ultimul, marea după teren); mărimea canvasului (raportul de pixeli cel mult 2; mărirea paginii, cu bufferul neschimbat, tot o redimensionare); cascada încărcării (stratul NDVI cerut odată cu sidecarul hărții); garda pornirii (20 s fără niciun octet abandonează pornirea); Satelit la pornire (cele șase texturi întregi cerute înaintea construcției, procentul, garda fotografiei, ieșirea fără Satelit; peticul oprit fără compresie); harta o singură dată (pe sursă: compilarea, apoi așteptarea fotografiei, apoi bucla; panourile ascunse și canvasul fără pointer până la `data-scena`; mesajul cu procentul și butonul „Arată relieful acum”); LUT-ul DFG al lui three, eliberat de scenă înaintea rendererului (contractul r186, eliberarea cu codul three al texturilor, ordinea pe sursă); programul de adâncime al umbrelor și contextul refăcut (`WebGLRenderer`-ul din build peste un context WebGL2 fals: programul eliberat și după o refacere, ștergerile lui three pe contextul pierdut egale cu ce era viu la pierdere minus ce face constructorul, renderer nou pe același context cu 4 texturi și 3 framebuffere; pe sursă, înscrierea umbrelor în listă și redesenarea lor la refacere); pagina fără scenă (textul fișei sanctuarului cu sursele, un `h1`, niciun id dublu; fișa etichetei neschimbată la outerHTML); legăturile din atribuire numai http(s) (`hrefSigur`); matricea UV a texturilor Satelit pe fiecare sidecar; sursele unite (`unesteSurse`) |
| `npm run verifica-documentatie` | documentația, în Node: mărimea lui CLAUDE.md (cel mult 25 000 de octeți și 40 000 de caractere); indexul (fiecare fișier din `docs/` legat din CLAUDE.md) și săgețile din CLAUDE.md, „Decizii în vigoare” (fiecare nume are fișierul lui în `docs/`); trimiterile spre `docs/`, cu titlul citat, din `src/`, `scripts/`, `.claude/`, CLAUDE.md și `docs/` (fișierul și titlul există, titlul nu se rupe pe două rânduri); citatele „X” fără cale care numesc un titlu din alt fișier; mențiunile lui CLAUDE.md numai cu o secțiune `##` de azi; în `.claude/`, CLAUDE.md și `package.json`, niciun `setTranscoderPath('/basis/')`, `setDecoderPath('/draco/')`, `copy-decoders` sau formula „indiferent de format”; comentariile vechi din `src/`, cifrele împărțite la 2²⁰ scrise „MB” și MB redefinit ca 2²⁰ octeți; sursa fiecărei etichete cu o folosință (cafenea, toalete, restaurant, magazin, bar) |
| `npm run iconite` | iconițele paginii, din sfera cursorului → `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` |

Scripturile de construit hărți (`build-zona`, `build-petic`) cer date-sursă care
nu sunt în depozit; vezi `docs/harti-relief.md`, „Hărțile de relief”. Amândouă își numesc dalele
(`DALE`); `npm run build-zona -- --proba` reface `harta_v4` în memorie și o compară cu git. La fel `ortofoto` și `strat-ndvi`, care citesc
dala de ortofoto. Codul lor comun — proiecția TM06, mersul prin IFD-urile unui
TIFF și decompresia LZW, citirea unei hărți gata făcute, citirea și alinierea ortofotoului, OKLab,
EXIF-ul — stă în `scripts/comun/`.

## Baza probelor

Din 2026-10-14 (lotul F al auditului), cele nouă `verifica-*` stau pe două module comune, în loc
de câte o copie în fiecare script, copii care ajunseseră să difere (trei feluri de a anunța un
eșec, patru de a anunța o săritură, `process.exit` în șase și `exitCode` în trei):

- `scripts/comun/proba.mjs`:
  - `proba(bun, text)`: rândurile `  ok ` și `  PICĂ`, în formatul de dinainte;
  - `sari(text)`: `  --    SĂRIT: …`, o secțiune care n-a rulat (fără `date-sursa/`, fără git),
    numărată;
  - `rezumat()`: „N ok, M picate, K sărite”, codul de ieșire și, cu `VERIFICA_REZUMAT=1`, linia
    de mașină `##verifica {…}` pentru `npm run verifica`, cu vârful de memorie al procesului;
    `{ iesi: true }` iese după golirea stdout, pentru scripturile care lasă ceva viu în buclă;
  - `opreste(motiv)`: ieșirea timpurie, când o probă de care depind toate celelalte a picat;
  - `cuAvertismente(f)`, `cuFetch(fals, cerere)`: avertismentele unui singur apel, prinse;
  - `dinDisc`, `INDEX`: `fetch` pe `public/`, ca serverul de dezvoltare; `cuantila`.
  - Un `console.warn` care ajunge la consolă — neprins de `cuAvertismente` sau de captura proprie
    a unui script — e „neașteptat”: se tipărește pe loc și pică la rezumat. Înainte,
    `verifica-controale` înghițea tot ce avertiza construcția, iar `verifica-imprejurimi` nu citea
    deloc avertismentele construcției; acum amândouă le cer 0, cu control (un `console.warn` pus
    prin mutație în `creeazaImprejurimi` trebuie prins).
- `scripts/comun/mutatii.mjs`: `LF`, `textSursa`, `textLa(reper, cale)` (`null` fără git),
  `muta` (text sau regex; `null` dacă una nu se aplică) și `modulDin` (un modul din text, cu
  `three` și importurile relative duse la fișierele de azi).

`scripts/verifica.mjs` le rulează în paralel, cel mult câte procesoare sunt și câte încap cu
~1,5 GiB fiecare în jumătate din memorie (o alegere). Măsurat pe 2026-10-14, pe PC-ul autorului
(20 de procesoare, 31,8 GiB): toate nouă în 12,2 s; vârfurile proceselor, adunate, 4 052 MiB
(cel mai mare, `verifica-teren`, 1 277 MiB; `verifica-imprejurimi` 779 MiB). Înaintea probelor,
hamul se verifică pe el însuși, cu opt scripturi de câte un rând scrise în directorul temporar:
o probă bună (cod 0), una picată (cod 1), o excepție (căzută), o săritură (cod 0; sub `--strict`,
cod 1), o ieșire 0 fără rezumat (căzută, nu trecută), un avertisment neașteptat (cod 1) și o
ieșire grăbită (nimic după ea). Dacă unul nu se clasează exact, se oprește.

Identitatea mutării: rândurile ok/PICĂ ale celor nouă jurnale, de dinainte (5ec413f) și de după, cu
duratele normalizate, sunt aceleași (624 de rânduri), în afară de cele schimbate voit: proba nouă
din controale, două titluri și două probe noi în împrejurimi, iar în documentație două numărători
care cresc cu fișierele noi.

Pe o clonă curată (`git clone` al depozitului, cu modificările de lucru copiate peste, fără
`date-sursa/` și fără `dist/`), `npm run verifica` dădea la 0.1.7.01 „578 ok, 0 picate, 5 sărite”:
tiff, teren, sanctuarul și clădirile câte o secțiune pe date reale (19 probe), plus
`verifica-livrare`; cu `--strict`, cod 1. Înainte, aceeași clonă trecea ca „toate probele au
trecut”, fără nicio cifră. La 0.1.7.05, pe o clonă cu CRLF și pe una cu LF: „671 ok, 0 picate, 6
sărite”. tiff are acum două secțiuni pe date reale, dalele MDT și `build-zona -- --proba`, iar pe
date reale se sar 23 de probe; cu `--strict`, cod 1.
