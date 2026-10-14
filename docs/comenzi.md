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
| `npm run verifica-controale` | mânuirea hărții, cu codul paginii, în Node: treptele rotiței, zoomul spre cursor și limitele lui, stările gesturilor, punctul panoului „Coordonate” și ieșirea lui „Măsoară centrul”, harta cu pagina mărită, tastatura și drona (urcarea, coborârea, paza solului pe tot trunchiul vederii, la mutare, rotire și zoom, Shift și Ctrl ca taste de modificare), anunțul busolei, Escape pe fișă și pe cutia „Coordonate”, imaginea mutată din calea cutiei „Coordonate” și semnul punctului cules, îndemnul panoului după pointer („Atinge” sau „Dă clic”), planul apropiat cu imaginea mutată, eticheta sanctuarului lângă rândul surselor |
| `npm run verifica-livrare` | după `npm run build`: cache-ul și antetele de securitate din `vercel.json` pe fiecare fișier publicat, CSP-ul față de ce face pagina, garda numelor publicate, blocurile `static {}` din `dist/assets` și plasa ES5, titlul (`h1`) și `<noscript>` în afara lui `#continut`; `-- --live` le compară cu sebastians.life |
| `npm run verifica-pagina` | ce nu acoperă celelalte probe, cu codul paginii, în Node: textura Satelit când transcodorul KTX2 nu răspunde (limita de timp, abandonul, pagina ascunsă, verificarea dinaintea descărcării); foaia de stil: fără `:has()`, `dvh` numai cu rezervă, selecția oprită numai pe hartă, animațiile numai pe transform/opacity și oprite sub reduced-motion, haloul focusului peste hartă, golul dintre fișă și cutia „Coordonate” pe ecrane înalte, bifa lui Satelit în afara numelui, busola în contrast forțat, panoul „Coordonate” fără text sub 14 px; ordinea de desenare (cerul ultimul, marea după teren); mărimea canvasului (raportul de pixeli cel mult 2; mărirea paginii, cu bufferul neschimbat, tot o redimensionare); cascada încărcării (stratul NDVI cerut odată cu sidecarul hărții); garda pornirii (20 s fără niciun octet abandonează pornirea); Satelit la pornire (cele șase texturi întregi cerute înaintea construcției, procentul, garda fotografiei, ieșirea fără Satelit; peticul oprit fără compresie); harta o singură dată (pe sursă: compilarea, apoi așteptarea fotografiei, apoi bucla; panourile ascunse și canvasul fără pointer până la `data-scena`; mesajul cu procentul și butonul „Arată relieful acum”); pagina fără scenă (textul fișei sanctuarului cu sursele, un `h1`, niciun id dublu; fișa etichetei neschimbată la outerHTML) |
| `npm run verifica-documentatie` | documentația, în Node: mărimea lui CLAUDE.md (cel mult 25 000 de octeți și 40 000 de caractere); indexul (fiecare fișier din `docs/` legat din CLAUDE.md) și săgețile din CLAUDE.md, „Decizii în vigoare” (fiecare nume are fișierul lui în `docs/`); trimiterile spre `docs/`, cu titlul citat, din `src/`, `scripts/`, `.claude/`, CLAUDE.md și `docs/` (fișierul și titlul există, titlul nu se rupe pe două rânduri); citatele „X” fără cale care numesc un titlu din alt fișier; mențiunile lui CLAUDE.md numai cu o secțiune `##` de azi; în `.claude/`, CLAUDE.md și `package.json`, niciun `setTranscoderPath('/basis/')`, `setDecoderPath('/draco/')`, `copy-decoders` sau formula „indiferent de format”; comentariile vechi din `src/`, cifrele împărțite la 2²⁰ scrise „MB” și MB redefinit ca 2²⁰ octeți; sursa fiecărei etichete cu o folosință (cafenea, toalete, restaurant, magazin, bar) |
| `npm run iconite` | iconițele paginii, din sfera cursorului → `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` |

Scripturile de construit hărți (`build-zona`, `build-petic`) cer date-sursă care
nu sunt în depozit; vezi `docs/harti-relief.md`, „Hărțile de relief”. La fel `ortofoto` și `strat-ndvi`, care citesc
dala de ortofoto. Codul lor comun — proiecția TM06, mersul prin IFD-urile unui
TIFF și decompresia LZW, citirea unei hărți gata făcute, citirea și alinierea ortofotoului, OKLab,
EXIF-ul — stă în `scripts/comun/`.
