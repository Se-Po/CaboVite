# Hărțile de relief

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

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

