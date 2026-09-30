# Cabo Espichel — pagină 3D interactivă

Pagină web narativă despre promontoriul Cabo Espichel (Sesimbra, Portugalia):
geologie, urme de dinozauri, legendă mariană, far, fotografie personală.
Scenă 3D interactivă + text lung, într-o singură pagină.

**Limba proiectului este româna.** Tot textul vizibil, comentariile din cod,
numele de capitole și mesajele de commit se scriu în română. Discuția cu mine
se poartă în română.

## Stack

- three.js **0.186.0 (r186)**, versiune fixă în `package.json`, fără `^`
- Vite 8 (dev server + build)
- JavaScript modern, module ES, fără framework. Nu introduce React, TypeScript
  sau alt strat fără să întrebi întâi.

## Comenzi

| Comandă | Ce face |
|---|---|
| `npm run dev` | dev server pe http://localhost:5173 |
| `npm run build` | build de producție în `dist/` |
| `npm run preview` | servește build-ul de producție |
| `npm run copy-decoders` | copiază decodoarele Draco/KTX2 în `public/` |
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
  Modelul e `busola.pas()`, chemat ca primă instrucțiune din buclă.
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
3. Citește consola browserului. Avertismentele WebGL contează.
4. Verifică la lățime de 390px, nu doar pe desktop.

Nu declara nimic funcțional fără dovadă. Dacă nu poți verifica, spune asta.

## Flux de lucru

- Nu comite și nu împinge nimic fără să-ți cer eu explicit.
- Versiunea se schimbă o dată la fiecare push, cu etichetă `v0.1.N`. Fiecare
  commit are un număr `0.1.N.xx`, scris ca prefix în subiect. Numărătoarea
  `0.1` pornește de la `v0.1.0` (2026-09-30), aceeași cifră ca `version` din
  `package.json`; până atunci etichetele au fost `v0.0.N`, până la `v0.0.11`.

## Hărțile de relief

Hărțile se numesc `harta_vN` și trăiesc în `public/data/<nume>-dem.bin` +
`.json`. O hartă nouă — alt contur, altă rezoluție sau alt conținut — primește un nume nou;
nu se suprascrie una existentă. Numele e scris și în sidecar, la cheia `nume`.

| hartă | sursă | acoperire |
|---|---|---|
| `harta_v5` | LiDAR DGT, MDT 50 cm mediat | petic de 534 × 700 m la 1 m, peste `harta_v4`; `harta_v3` cu inelul de cusătură refăcut pe baza nouă |
| `harta_v4` | LiDAR DGT 2024-2025, MDT 2 m; fâșia 104162 din MDT 50 cm | toată cutia, 2328 × 2986 m, cu tot uscatul ei; `harta_v2` fără conturul ales în pagină și fără noduri tăiate |

O hartă poate avea cheia `baza`: atunci e un **petic** de rezoluție mai mare,
iar `incarcaRelief()` încarcă și baza. Scena generează două plase — baza, cu o
gaură exact sub petic, și peticul deasupra. Nodurile peticului cad peste ale
bazei din doi în doi, iar inelul lui exterior ia relieful bazei, așa că muchia
comună e aceeași linie și nu rămâne nicio crăpătură.

Pagina încarcă o singură hartă (plus baza ei), aleasă în `src/scene/loaders.js`. Datele-sursă
(`date-sursa/`) nu intră în depozit; hărțile produse, da — altfel pagina nu se
poate încărca dintr-o clonă curată.

Depozitul păstrează **exact** harta pe care o încarcă pagina, cu straturile ei, și
nimic altceva: `harta_v5` plus baza ei, `harta_v4`, fiecare cu `-ndvi` alături. `harta_v0` și `harta_v1` au plecat odată
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
  gaura de sub petic rămân; busola scrie tot 213° SV;
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
taie uscat drept; relieful de dincolo ar cere dalele MDT 107xxx.

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
nu al privirii. La pornire scrie `213° SV`, coerent cu `AZIMUT = 214` din
`camera.js` și cu fotografia de referință.

**Clicul nu întoarce scena cu nordul în sus.** Duce camera la un punct de
privire ales, `AZIMUT_TINTA` din `busola.js`, acum **300° NV** — privirea dinspre
nord-vest peste promontoriu. Eticheta butonului se scrie din constanta aceea, ca
textul și comportamentul să nu se poată despărți. Dacă vrei totuși „nordul în
sus", valoarea e 180: cifra fiind a poziției, stai în sud ca să privești spre nord.

**Camera se rotește punând `theta` ABSOLUT**, nu cu `rotateLeft()`. Acela există
și e public în r186, dar adaugă un *delta* într-un acumulator care se scurge
exponențial; deltele se compun, deci două clicuri repezi trec de nord cu exact
cât mai rămăsese de aplicat. `setAzimuthalAngle()` nu există.

**Theta absolut nu ajunge, totuși — inerția trebuie descărcată întâi.**
`update()` nu citește doar poziția camerei, ci îi ADAUGĂ acumulatorul:
`_spherical.theta += _sphericalDelta.theta * dampingFactor` (OrbitControls.js:717).
Cu amortizare pornită acumulatorul nu se golește niciodată — se stinge doar cu
×(1 − dampingFactor) pe cadru (:801). Singura ramură care îl golește e cea fără
amortizare (:808), iar `_sphericalDelta` e privat, deci aceea e toată calea
publică spre el. `laClic()` stinge amortizarea, cheamă `update()` o dată și o
repune — o singură dată la clic, nu pe fiecare cadru al zborului.

`laStart` nu acoperă cazul: butonul rozetei nu e copil al canvasului, deci
OrbitControls nu emite niciodată „start" la clicul pe el.

Cât greșea, măsurat: după o aruncare de 66° urmată imediat de clic, zborul
ateriza la **0,098°** de țintă — puțin, fiindcă `aplicaTheta` reașază poziția la
fiecare cadru și aruncă astfel contaminarea cadrului trecut, deci supraviețuia
numai ultima felie. Pe calea `prefers-reduced-motion` însă, unde `aplicaTheta`
se cheamă o SINGURĂ dată, se pierdea toată prima felie: `inerție × dampingFactor`,
măsurat exact **0,8°** pentru 10° rămase. Tocmai calea de accesibilitate greșea
cel mai mult.

Inerția se APLICĂ, nu se aruncă: ramura fără amortizare o adaugă întreagă înainte
să golească. Camera ajunge unde se ducea gestul, iar zborul pleacă de acolo.

**Probe care pot eșua.** La încadrarea de pornire busola scrie **213° SV**; cu
nordul grilei ar scrie 214°, cu semnul lui γ inversat 215°. După clic,
`__scena.controale.getAzimuthalAngle() * 180/Math.PI` trebuie să fie
**−120,673704** — pe grilă ar fi fost exact −120, deci zecimalele sunt chiar
dovada că punctul e cel adevărat, nu cel al grilei. Iar
`__scena.busola.convergenta` trebuie să cadă la mai puțin de 0,001 de valoarea
analitică: pragul e ales ca să pice dacă factorul elipsoidal lipsește.

## Punctul de sub clic

`src/scene/punct.js` — clic stâng pe scenă, iar panoul din stânga spune unde e
punctul, în trei sisteme, și cât de sus. Butonul copiază tot, cu punct zecimal:
panoul e text românesc și se citește, textul copiat pleacă în altă parte.

**Nu se dă raycast pe plasă.** `raycaster.intersectObject()` pe geometria
neindexată costă **53 ms pe rază**, măsurat pe cele 2,56 milioane de triunghiuri
de atunci. Pe un câmp de înălțimi nu e nevoie: se merge pe rază cu pasul de
8 m, se prinde schimbarea de semn față de `inaltimeLa`, apoi 22 de bisecții. Măsurat acum:
**0,19 ms**. Și e *mai* exact — pe fiecare celulă testează chiar interpolarea pe
care o citește `inaltimeLa`, nu triunghiurile plasei decupate.

**Butonul stâng rămâne al lui OrbitControls.** Selectorul de altădată îl
confisca; aici nu. Ce deosebește clicul de rotire e un prag de **5 px** între
apăsare și ridicare. Ridicarea se ascultă pe `globalThis`, nu pe canvas:
OrbitControls mută `pointermove`/`pointerup` pe `ownerDocument` cât ține
tragerea, deci o tragere care se termină în afara canvasului n-ar mai declanșa
niciodată ridicarea pe el, iar apăsarea ar rămâne agățată.

**Coordonatele au mereu acoperire, altitudinea nu.** Raza lovește un loc real
chiar și pe apă, deci lon/lat, scena și TM06 se arată întotdeauna. Altitudinea
primește etichetă, după două reguli verificabile:

- **„în afara hărții"** dacă punctul cade în afara lui `poligon_scena`. Contează:
  `inaltimeLa` prinde indicii la marginea grilei, deci dincolo de ea întoarce cota
  nodului de pe margine — la (1300, 0), la 136 m est de cutie, iese 139,72 m, care
  pare măsurătoare și nu e.
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

## Cum se generează plasa terenului

`src/scene/terrain.js` transformă grila de înălțimi într-un singur mesh cu
fațete plate. Patru lucruri de acolo nu se pot ghici din cod fără măsurătoarea
care le-a motivat.

**Celulele de apă nu se generează.** Toate patru nodurile la `zMin_m` înseamnă
umplutură, nu batimetrie — o spune `regula_apa` din sidecar. Sunt 930 714 din
cele 1 641 746 de celule păstrate ale bazei `harta_v4` (56,7%) și 122 858 din cele
373 800 ale peticului (32,9%), iar marea e un plan **opac** de 120 km la `COTA_MARE`, pe
sub care camera nu poate coborî: ținta stă la y = 60, `minDistance` e 80 și
`maxPolarAngle` e π/2 − 0,04, deci camera rămâne peste 64,6 m. Erau desenate la
fiecare cadru și nu se puteau vedea niciodată. Triunghiuri, pe `harta_v2`:
2 562 454 → 1 362 122; pe `harta_v4`, cu uscatul din afara conturului, 1 923 948.

Se taie numai celulele cu TOATE patru nodurile la cotă; malul rămâne întreg. Iar
`inaltimeLa` citește din `grila`, nu din plasă, deci panoul punctului măsoară
peste apă exact ca înainte — verificat: un clic pe mare întoarce punctul la
centimetru și eticheta „apă".

**Nu există atribut `normal`.** Cu `flatShading: true`, shaderul r186 nu-l
citește: sub `FLAT_SHADED` varianta `vNormal` nici nu se declară, iar
`normal_fragment_begin` calculează `normalize(cross(dFdx, dFdy))` — planul
fațetei, adică exact ce am fi scris. Pe geometrie neindexată cu normale de
fațetă cele două sunt același plan. Scapă 92 248 344 de octeți din RAM și de pe
placă, plus 127 ms de `computeVertexNormals()` la fiecare pornire.

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
- **0** fațete diferă între tema de zi și cea de noapte;
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

Regula costă +23 ms la construcția bazei, în Node.

## Cerul și ceața mării

`src/scene/cer.js`: cerul Preetham din three (`Sky.js`), **senin** — norii lui cer un
`time` care curge, iar scena desenează la cerere. Cutia are 40 km și stă pe planul
îndepărtat (`gl_Position.z = w`); camera ajunge la cel mult 8 km de țintă.

**Expunerea se calculează.** Sky.js e scris pentru ~0,5 sub ACES; sub AgX la 1 iese
altfel. `expunereCer` e factorul la care orizontul OPUS soarelui are luminanța culorii
de cer a temei (`paleta.cer`), deci pagina rămâne la fel de luminoasă ca înainte:
2,18 ziua și 0,21 în tema întunecată, cu soarele Relief (18° / 244°); iar cu soarele
zborului (39,5° / 94°), al vederii Satelit care vine, 0,79 și 0,075 — Preetham e mult mai luminos cu soarele sus.

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
constantă ar da 2,85 / 4,54 / 0,59. Restul scenei stă sub 5 km și primește ceața
obișnuită, liniară, cu media orizontului ca culoare — aceeași lege ca înainte, deci
terenul de aproape iese neschimbat. Cadre desenate în 2 s de repaus: 0.

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
Măsurat: 182 565 de vârfuri, maximum 0,021 mm față de triunghiul de sub ele.

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
  lăsa complexul sub ea.
- `creeazaSanctuar()` își golește scriitorul imediat după predare, iar `dispose()`
  stinge pozițiile pe care le ține `loveste`: obiectul întors trăiește în
  `globalThis.__scena`, deci altfel rămâneau 2,38 MiB după dispose(); acum 0.

### Umbrele

`src/scene/umbre.js`: o singură hartă de 2048², strânsă pe clădiri plus lungimea
umbrei (60 m; la 18° o clădire de 15 m aruncă 46 m), deci 0,211 m pe texel. Cutia
lasă apeductul afară: merge ~550 m spre est și dubla fereastra luminii (0,336 m pe
texel) pentru umbre de 2–8 m. Harta ține ~32 MiB pe placă — adâncime plus culoare,
pe care r186 o alocă oricum.
`autoUpdate = false`: se desenează o dată. Aruncă umbră numai sanctuarul; primesc
sanctuarul, suprafețele și terenul. Tocmai de aceea trebuie refăcută la
`webglcontextrestored`: three face atunci un WebGLShadowMap nou, iar o lumină cu
`autoUpdate = false` și fără `needsUpdate` e sărită. Proba: contextul pierdut și
refăcut dă 0 pixeli diferiți; fără umbre, pe aceeași vedere, diferă 8 393.

Soarele NU se mută: camera de umbră stă unde stă lumina, la 4 km, și doar marginile
ei se strâng pe complex. O poziție mutată, chiar pe aceeași direcție, ar fi rotunjit
altfel vectorul luminii pe toată harta. Proba: în țintă fixă 640 × 400, în trei
vederi, **0 pixeli diferiți** în afara dreptunghiului umbrei; la fel cu sanctuarul
cu totul ascuns.

### Probele: `npm run verifica-sanctuar`

Codul paginii, în Node, cu `fetch` înlocuit. Probele de fond au control negativ —
aceeași probă pe o greșeală cunoscută, care trebuie să pice: acoperișurile,
amprentele, drapajul și zborul. Bugetul n-are nevoie de unul.
- **încărcătorul:** index.html cu 200, 404, JSON trunchiat, nume străin, schemă
  necunoscută, material fără rgb, listă lipsă — `null` și un avertisment, fără
  aruncare; ancoră greșită; o coordonată `null` sare numai elementul ei;
- **bugetul:** clădiri ≤ 70 000 de triunghiuri (azi 17 745), suprafețe ≤ 80 000
  (60 866 pe `harta_v4`/`harta_v5`; 60 855 pe v2/v3), JSON ≤ 150 KB (94,7);
- **geometria:** vârfuri finite, ocluzie pe fiecare, stâlpi în ordine cu goluri
  ≥ 0,2 m, corpuri convexe — proba care a prins linia rotită a aripii N;
- **numărătoarea din 1880** ajunge întreagă în pagină: 47 / 63 de arce, 36 / 46 de
  ferestre. Pe `sanctuar_v1` ar fi picat: 49 / 60 de arce, 35 / 41 de ferestre;
- **suprafețele** stau pe triunghiurile randate: 0 vârfuri în afară, maximum 1 mm;
  control: față de relieful interpolat biliniar, abaterea ar fi 175 mm;
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
- **raza** verticală pe navă lovește acoperișul la 1 mm; una prin golul unui arc
  trece de fațadă și lovește fundul galeriei la 11,8 m; una în stâlp, la 10 m.

## Principii de design (nenegociabile)

- **Accesibilitate:** fonturi mari, contrast ridicat. Cititorii pot fi vârstnici.
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
`date-sursa/ortofoto/`, deci în afara depozitului). **BigTIFF**, nu TIFF clasic:
magic 43, numărul de intrări dintr-un IFD pe 8 octeți, intrări de 20 de octeți,
valori inline până în 8 octeți. `citesteIfd(..., big)` din `scripts/comun/tiff.mjs`
tratează ambele.

**Atribuirea.** Datele DGT sunt CC BY 4.0, iar metadatele lor din SNIG cer, la orice
publicare, și adaptată, textul „Informação geográfica cedida pela Direção-Geral do
Território”. Îl scrie `scrieSurse()` din `src/main.js`, o singură dată, cu
`lang="pt"`, ori de câte ori subsolul are o sursă DGT. Sidecarurile publicate nu
s-au rescris pentru asta.

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

Vederea Satelit, care vine, va folosi soarele sanctuarului.

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
