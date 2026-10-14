# Panoul „Coordonate”

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

## Punctul de sub clic

`src/scene/punct.js` — clic stâng pe scenă, iar panoul din dreapta-jos spune unde
e punctul, în trei sisteme, și cât de sus. Butonul copiază tot, cu punct zecimal:
panoul e text românesc și se citește, textul copiat pleacă în altă parte.

**Pornește minimizat.** Se vede numai butonul „Coordonate”. Cât e minimizat,
clicul pe scenă nu culege nimic — nicio rază, niciun rând —, iar `culegeLa()`
întoarce `null`; o apăsare începută înainte de minimizare nu mai culege nici ea.
Activat, focusul trece pe „–”, care îl minimizează la loc, iar ultimul punct
rămâne. Mișcarea camerei nu depinde de el. Fără mouse, butonul **„Măsoară centrul”**
(următorul după „–” cu Tab) culege, cu aceeași culegere ca un clic, punctul din centrul
vederii — ținta camerei pe ecran (`centruVederii` din camera.js), deci centrul părții
libere de fișă și de cutie (mai jos). Stă pe un rând cu „Copiază” pe desktop, pe telefon unul sub altul.
Escape îl minimizează (vezi „Focusul, Escape și contrastul forțat”). Unde stă:
- pe desktop, dreapta-jos, sub coloana busolei, deasupra versiunii paginii;
- pe ecranele late dar scunde (≤ 32rem), la stânga coloanei busolei;
- pe telefon, pe rândul de jos, la stânga coloanei busolei și a lui Satelit;
- sub 22,5rem, deschis, urcă deasupra lui Satelit, pe toată lățimea; sub 17rem
  butonul rămâne numai cu semnul. Așa ajunge și un telefon de 390 px cu pagina
  mărită de două ori. Îngust și sub 30rem înălțime, cutia coboară peste Satelit.

**Imaginea din calea cutiei și semnul punctului** (2026-10-09, alegerea autorului). Pe ecranele
mici cutia deschisă stă peste mijlocul hărții, iar „Măsoară centrul” culegea un loc acoperit
chiar de ea, fără niciun semn pe hartă (recenzia: 640 × 360, adică 1280 × 720 la 200%, 320 × 568,
390 × 844 pe o clădire). Acum:
- cât cutia intră în partea liberă și stă în coloana ei din mijloc, imaginea se mută cu decalajul
  de obiectiv al fișei — `cadru-liber.js`, unul pentru amândouă —: deasupra cutiei, dacă rămâne
  un sfert din înălțime, altfel alături, în partea mai lată, altfel dedesubt. Pe desktop și pe
  telefonul culcat cutia stă într-o parte și nu mută nimic; la 195 × 422 acoperă aproape tot,
  deci nu se mută nimic, iar punctul rămâne sub ea. Fișa pe telefon, peste panou, ia partea de
  deasupra foii; la 320 × 568, cu amândouă deschise, cutia trece de foaie până la y 100 și nu
  mai rămâne loc nicăieri, deci ținta stă sub ea, ca înainte;
- cutia are de la deschidere înălțimea pe care o are cu un punct: îndemnul și cifrele stau în
  aceeași celulă, iar ce nu se arată e `visibility: hidden` (`data-stare`), cu cifrele „—”
  nevăzute. Cu `display: none`, primul clic o creștea peste partea pe care se așezase imaginea,
  cu punctul și centrul vederii sub ea (recenzia). Mai crește numai cu rândurile unei clădiri,
  ~70 px la 390 × 844: un punct cules chiar în banda aceea rămâne sub cutie;
- se reașază la deschidere, la minimizare, după „Măsoară centrul” (punctul stă pe raza țintei,
  deci ajunge pe mijlocul părții libere), la redimensionare — și la mărirea paginii, cu bufferul
  neschimbat (`redimensioneaza` întoarce true și la o mărime CSS nouă) — și cu fișa; nu după un
  clic pe hartă, care ar muta imaginea de sub deget;
- punctul cules are pe hartă un semn, cât panoul e deschis: crucea de vizare a butonului, aurie pe
  un contur din culoarea fundalului, proiectată pe cadrul desenat, ca eticheta. Punctat când e
  acoperit: relieful cu toleranța de 2 m + 0,2% (o rază razantă îl taie lângă punct), clădirile
  exact — un zid are 0,58–1,27 m. `aria-hidden`: punctul îl spune panoul;
- cu imaginea mutată, fereastra planului apropiat nu mai stă în mijloc: paza solului (`_solSub`)
  îi ia colțurile din fereastra reală (`razaPlanApropiat`), nu din formula fără decalaj.

`verifica-controale`, cu panoul, cadrul și camera adevărate, pe un DOM fals care pornește ca
marcajul și pe cutiile măsurate în pagină: deschis, primul clic pe centru, „Măsoară centrul”,
minimizat — semnul pe centrul vederii, în afara cutiei, în ecran, (195; 232,5) la 390 × 844,
(187,5; 144) la 375 × 667, (160; 470,8) la 320 × 568, sub cutie și în afara busolei și a lui
Satelit, (120; 180) la 640 × 360; fără decalaj la 1600 × 900, la 844 × 390 și la 195 × 422; minimizat,
fără decalaj și fără semn. La 390 × 844 un clic pe o clădire lasă decalajul (189,45 px) și pune
semnul pe pixelul clicului, iar „Măsoară centrul” pe far îl reașază pe cutia crescută (224,25 px).
Un zid de 1 m la 0,3 m de punct îl face punctat. Raza planului apropiat e cel mai depărtat colț, la
5·10⁻¹⁵ m, pe șapte decalaje, iar `_solSub` vede un inel de relief dincolo de colț. Pe sursă:
celula comună și `visibility`. `verifica-pagina`: mărirea paginii, 1280 × 720 la 1× → 640 × 360
la 2× → înapoi, `true false true false true false`. Controale, care pică: punct.js, main.css și
renderer.js de la `491e7e4`; cutia goală de dinainte, cu îndemnul singur (la 320 × 568, 640 × 360
și 195 × 422 semnul sub cutie după primul clic); numai deasupra cutiei; cadrul refăcut și după clic
(semnul fuge de la y 120 la 85,2); „Măsoară centrul” fără reașezare (189,45 în loc de 224,25);
clădirile cu toleranța reliefului (zidul nu acoperă); formula fără decalaj (12,18 m față de colțul
de la 12,35 m la 320 × 568). În pagină (build, 2026-10-09, fila ascunsă, deci cadrele desenate de
mână): aceleași cutii și poziții la toate șapte ecranele, deschis = cu un punct, `elementFromPoint`
pe canvas sub semn; capturile la 390 × 844, 320 × 568 și 640 × 360; fișa pe telefon peste panou și
închisă la loc; 0 erori în consolă. Mărirea adevărată cu Ctrl + și un telefon adevărat nu s-au
încercat <!-- NEVERIFICAT: Ctrl + în browser, telefon -->.

Cutia deschisă primește clicurile: are înălțime maximă și defilează, cu antetul
lipit sus, deci „–” se vede mereu. Prin ea nu se culege și nu se rotește camera;
o cutie prin care treceau rotița și degetul nu defila deloc — măsurat la 195 px,
rotița muta camera cu 66 m. Pe desktop fișa sanctuarului și panoul deschis stau în
aceeași coloană: pe ecrane înalte fișa se oprește deasupra panoului (28rem rezervă, plus
versiunea), iar cutia are cel mult restul, 26,25rem, și defilează: cu plafonul ei de jumătate,
spațierea textului din WCAG 1.4.12 o ducea sub fișă, cu tot cu „–”, cu 60,8 px la 1280 × 1200
(recenzia). `verifica-pagina` calculează golul pe sursă, de la 545 la 2 200 px: cel puțin 16 px
(controale: jumătatea, −60,8 px la 1 200; 27,25rem, 0 px). Sub ~65rem își împart înălțimea
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

**Textul de 14 px** (alegerea autorului, 2026-10-08): etichetele și rândurile mici au
0,875rem pe orice lățime (erau 0,72–0,8rem), iar rândurile mici stau pe o coloană, eticheta
deasupra cifrelor. Măsurat în pagină (build), cu punctul în colțul lui alpha (−1162,50;
−1491,90), pe lanterna farului (`far.turn`, 168,28 m) și cu valorile cele mai lungi scrise
de mână (X −1163,00 · Y 168,28 · Z −1492,00; TM06 X −95790,00 · Y −138900,00; clădirea
„zidul cercado-ului, incinta Casei da Água”): la 1440 × 900, 700 × 800, 844 × 390,
390 × 844, 361 × 800 și 320 × 568, `scrollWidth` = `clientWidth` și fiecare rând mic pe o
linie; la 195 × 422 pe două, tot fără defilare orizontală; nicio axă ruptă. Control, la
390 × 844 cu valorile cele mai lungi: pe două coloane rândul trece pe două linii, iar cu
`white-space: nowrap` cutia defilează (255 față de 230 px). `verifica-pagina` cere 0 mărimi
sub 0,875rem în `#punct` și o coloană; pe main.css de la 6ad3a47 găsește 0,8 / 0,78 /
0,72rem. Golul dintre axe, cu bara de defilare clasică simulată la 195 px, nu s-a remăsurat
la 14 px <!-- NEVERIFICAT: bara clasică, la 14 px -->.

