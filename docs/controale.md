# Controalele hărții

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

## Mouse-ul, degetele și cursorul

Harta se mânuiește ca o hartă, la cererea autorului (2026-10-07):

| | desktop | telefon | tastatură (2026-10-09) |
|---|---|---|---|
| mutare | butonul stâng | un deget | săgețile sau W A S D; ↑ și W înainte, pe direcția privirii |
| unghiul (rotire și înclinare) | butonul drept; Shift, Ctrl sau Cmd + stâng | două degete trase împreună (punctul lor de mijloc, nu răsucire) | Q și E rotesc cu 15° pe apăsare, în jurul centrului; înclinarea, numai cu mouse-ul și degetele |
| înălțimea | — | — | Shift urcă, Ctrl coboară, ca o dronă: privirea rămâne |
| zoom | rotița, spre cursor; butonul din mijloc tras | ciupire, spre punctul dintre degete | + și − (= și _), spre centrul vederii |

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
Proba lui gest.js, în `verifica-controale` (din 0.1.7.05), merge cu controalele paginii și un
DOM fals:
- butonul drept scrie `rotire` și aprinde pivotul, cel stâng `mutare`, iar `end` le șterge;
- un `start` cu starea NIMIC — rotița în timpul unei rotiri — lasă cursorul neatins;
- `dispose()` lasă 0 ascultători pe controale.

Două controale pică: fără garda NIMIC, cursorul se șterge; fără `removeEventListener`, rămân 2
ascultători.

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

**Tastatura** (`src/scene/tastatura.js`; pașii, în `comanda()` din camera.js), ca o dronă, la
cererea autorului (2026-10-09): săgețile sau W A S D mută, Q și E rotesc, Shift urcă, Ctrl
coboară, + și − (= și _) apropie și depărtează, Home duce acasă. Butoanele hărții de la lotul E
(zece, pe ecran) au plecat odată cu cererea: harta rămâne pe tastatură, pe mouse și pe degete.
Cu harta pornită, canvasul e focusabil — Tab ajunge întâi pe el —, cu `role="application"`,
`aria-roledescription` „hartă”, numele hărții și descrierea tastelor (`#harta-taste`, ascunsă
vizual); cum o citesc NVDA și VoiceOver nu s-a încercat <!-- NEVERIFICAT: cu un cititor de ecran -->.
Inelul de focus e `.inel-harta`, o bandă aurie între două din culoarea fundalului, pe marginea
ecranului: conturul obișnuit ar sta în afara canvasului.
- **Pașii.** Mutarea, 5% din înălțimea vederii la distanța țintei; rotirea, 15° în jurul
  centrului, nu prin `keyRotateSpeed`, care se împarte la înălțimea canvasului (0,4° pe apăsare
  cu valoarea implicită), și după `pivotPeTeren`, ca butonul drept; zoomul, o treaptă de rotiță
  spre centrul vederii (`treaptaTasta`, care nu atinge ritmul rotiței). Tastele se recunosc după
  poziție (`code`): pe AZERTY, W A S D sunt Z Q S D, sub aceleași degete; plusul și minusul,
  după semn. Înclinarea de la tastatură a plecat: Shift + săgețile mută acum, cu urcarea.
- **Ținute.** O apăsare face un pas; ținută, tasta face câte unul la 150 ms, numărați de bucla
  scenei, pe ceasul tastei, nu de repetarea sistemului — aceea vine abia după ~0,5 s, iar pe
  macOS Shift și Ctrl nu se repetă deloc. Pașii alunecă, deci harta curge. Ridicarea, `blur`, o
  filă ascunsă, focusul plecat de pe hartă și pagina mărită îi opresc.
- **Drona** (`_mutaVertical`, camera.js): camera urcă sau coboară pe verticală, cu privirea
  neschimbată, iar ținta trece pe ce se vede pe raza privirii, între 80 m și 8 km și în alpha.
  Ținta nu urcă odată cu camera: limita alpha o ține sub cea mai înaltă cotă a hărții, deci
  urcarea s-ar fi oprit după ~90 m. Un pas e 10% din înălțimea camerei peste ce e sub ea
  (`PAS_VERTICAL`, o alegere). Coborârea se oprește la 20 m (`LIBER_SOL`, de două ori planul
  apropiat, o alegere) peste ce e sub cameră și cât ce se vede în față e la mai puțin de 80 m,
  garda zoomului; urcarea, unde privirea nu mai găsește nimic în alpha la cel mult 8 km — de la
  vederea de pornire, la 961,5 m. Coborârea nu se refuză când acum nu se vede nimic în 8 km:
  după „−” de opt ori, Ctrl nu cobora deloc (recenzia).
- **Paza solului.** Niciun pas de la tastatură — mutarea, rotirea, zoomul, coborârea — nu duce
  camera la mai puțin de 20 m peste ce e sub ea: relief, mare sau acoperiș, pe tot discul
  planului apropiat (`_solSub`: raza colțurilor lui, `razaPlanApropiat`, din fereastra reală
  și cu imaginea mutată de fișă sau de cutia „Coordonate”, cu 10% marjă: fără decalaj, 14,4 m la
  16:9; centrul și 32 de puncte). Numai pe verticala punctului, drona ținută jos ajungea cu planul apropiat în
  peretele falezei, iar stânca din centrul ecranului la 1,3 m (recenzia). Cât alunecă un pas,
  `pasVertical` (din buclă, și din `comanda()` înaintea lui `update()`) știe unde ajunge camera
  la cadrul acesta: la mutare, urcarea care lipsește alunecă odată cu ea, iar partea din mutare
  care n-ar încăpea la cota de acum așteaptă cadrul următor; la Q și E, camera urcă pe loc peste
  locul în care o duce rotirea (recenzia o dusese la 61,7 m sub sol); la „+” și „−”, treapta nu
  coboară camera sub prag (`pasZoom`, numai pentru tastatură; rotița și degetele rămân ca
  înainte). Dacă nu mai poate urca, pasul se oprește: drona stă în fața peretelui. Un zbor
  golește urcarea rămasă, ca treptele rotiței.
- **Shift și Ctrl sunt și taste de modificare.** Urcarea și coborârea pornesc abia după 250 ms
  ținute (`GRATIE`, o alegere); orice altă tastă apăsată între timp, în afară de mutare și
  rotire, un clic sau rotița le anulează până la ridicare; venită după cele 250 ms, anularea
  oprește și urcarea care încă alunecă (Shift ținut 300 ms, apoi Tab: 5,9 m, nu 26,8). Apăsate
  scurt nu fac nimic: NVDA oprește vorbirea cu Ctrl. Shift + Tab, Shift + = („+”), Ctrl + F, Ctrl + plus și Shift cu
  mouse-ul rămân ce erau; Shift și Ctrl ținute deodată nu fac nimic. Ctrl + W închide fila în
  Chrome, Edge și Firefox, iar pagina nu-l poate opri: autorul a ales Ctrl fără protecție. Pe
  macOS, Ctrl + săgeți mută desktopurile <!-- NEVERIFICAT: pe un Mac -->; acolo, cu W A S D.
- **Unde.** Numai pe hartă — focusul pe canvas, sau pe `<body>` după o apăsare pe hartă ori
  înaintea oricărei apăsări —, nu în `UNDE_NU`, nu pe butoane și nu cu Alt sau Cmd; cu Ctrl,
  mutarea și rotirea merg, plusul nu (Ctrl + plus mărește pagina). Cu pagina mărită tastele
  sunt ale paginii. Tastatura se creează abia cu harta gata de primul cadru: o tastă apăsată
  cât se încarcă ar fi mutat camera nevăzut. Limitele sunt cele obișnuite, `start` și `end` vin
  cu starea NIMIC (un zbor se oprește) — numai fără un gest deschis: cu harta ținută de mouse,
  `end`-ul tastei stingea cursorul gestului și sfera pivotului —, iar sub reduced-motion pasul
  e pe loc.

Probele, în `verifica-controale`, fiecare cu controlul ei:
- săgețile și W A S D: ținta se mută cu 25,32 m pe direcția cerută, camera cu ea, cu
  amortizare și pe loc; „+” ×1,400000 pe distanța cameră–punctul din centru, care rămâne pe
  pixel la 7,5·10⁻¹³ px, și cu decalajul fișei; „=”, „_”, plusul și minusul tastaturii
  numerice, la fel; E −15,0000° și Q +15,0000° în theta, la înălțimea 900 și 700; Shift + →
  nu rotește; după 6 clicuri spre platou, 6 × E țin punctul din centru la 4·10⁻¹² px (fără
  pivot, 534,4 px); controale pe 6ad3a47: fără tastatură, 0 m și 0°;
- W ținut o secundă: 7 pași, și cu repetările sistemului la 33 ms, 0 după ridicare (fără
  ceasul buclei, 1); `blur`, fila ascunsă, focusul pe un buton, pagina mărită: 0 pași după
  (fără oprire, 6; fără ascultătorul de `blur`, 6);
- Shift ținut o secundă: 6 pași, +193,5 m, nimic în primele 200 ms, x și z la 6·10⁻¹² m,
  privirea neschimbată, ținta pe ce se vede la 10⁻¹³ m (ținta urcată odată cu camera: +90 m);
  ținut 20 s: tavanul la 961,5 m, fără mutare pe orizontală (fără intervalul lui alpha, 4,9 km);
- Ctrl ținut 20 s: de la vederea de pornire, la 27,17 m, cât cota mării a cutiei lui alpha lasă
  ținta la 80 m; pe platou, privind în jos la 45°, la 54,60 m peste el, cu ce se vede la 80 m
  (fără garda celor 80 m, 31,24 m); pe o faleză de 146,7 m, privind spre larg, la 20,00 m peste
  ea (fără garda solului, 10,45 m); deasupra farului, la 188,28 m, cu 20 m peste lanternă (fără
  clădirile de sub cameră, 168,28 m, lipită de ea); după „−” de opt ori (nimic văzut în 8 km),
  −506,98 m în 3 s (cu pasul refuzat, 0 m);
- W și S ținute 3 s la 20 m peste plajă, spre 16 faleze de peste 60 m și cu ele în spate, pe tot
  trunchiul (o grilă de 9 × 7 raze): planul apropiat nu taie nimic, adâncimea minimă 12,75 m,
  camera cel puțin 20,00 m peste sol, cel mult 10,76 m urcați pe un cadru (urcarea alunecă).
  Controale: `_solSub` numai pe verticală, 16 zboruri tăiate și 0,80 m; discul de rază NEAR, 2
  și 9,08 m; mutarea fără amânare, −9,00 m sub sol; partea care nu încape aruncată, 862 m
  parcurși în loc de 1 197; urcarea dintr-odată, 70,06 m pe un cadru;
- după o coborâre cu Ctrl la 20 m, E și Q ×6, „−” și „+” ×3, cu amortizare și pe loc: cel puțin
  20,00 m peste sol (rotirea fără pază, −34,24 m; zoomul fără pază, sau păzit numai spre P,
  −47,69 m);
- W și E cu harta ținută de mouse: 0 `start`, 0 `end` (control, 2 și 2);
- Shift scurt, Shift + Tab, Shift + „+”, Shift cu clicul sau cu rotița, Shift și Ctrl, Ctrl + F,
  Ctrl + „+”: nicio urcare și nicio coborâre; Shift + W și Ctrl + W: 7 pași înainte cu 6 de
  urcare sau coborâre (fără anulare, 4 cazuri greșite; fără grație, 11); Shift ținut 300 ms,
  apoi Tab: 5,92 m (fără oprirea urcării, 26,78);
- Shift ținut 400 ms, apoi zborul acasă sub reduced-motion: aterizarea la 9·10⁻¹⁴ m (cu urcarea
  lăsată în coadă, 143,7 m).

În pagină (build, 2026-10-09), cu tastele reale ale panoului Browser: W 25,2 m înainte după 1 s
(alunecarea încă în curs), E 306° → 321°, Q înapoi la 306°, = și = și − ×1,4 net; cu evenimente
sintetice, Shift ținut 1 s +142,4 m, x, z și privirea neschimbate, Ctrl ținut 8 s până la
27,17 m peste mare, Shift + Tab 0 m; fără `#butoane`, fără defilare orizontală la 390 × 844;
haloul focusului pe busolă, Satelit, „Coordonate” și etichetă; 0 erori și 0 mesaje CSP. După
paza solului, pe build: Ctrl până la 27,42 m peste mare, apoi Q ×6 (216° → 173°) și W ținut
1,5 s, cel mai jos tot 27,42 m; cadrul median 16,7 ms, p95 17,5 ms. Pe un telefon, costul pazei
(33 de puncte de relief pe apel) nu s-a măsurat <!-- NEVERIFICAT: telefon -->.

**Focusul, Escape și contrastul forțat** (2026-10-08):
- Inelul auriu (`:focus-visible`, 3 px la 2 px de buton) stă pe ce e în spate: pe cerul de la
  orizont, în jurul busolei, sub 3:1 (pe pixeli, mai jos; 1,2:1, cifra din 2026-10-08, n-o reface
  niciun cod). Busola, Satelit, „Coordonate” și eticheta
  au haloul `0 0 0 7px var(--bg)` — 2 px până la inel, 3 inelul, 2 dincolo —, cu umbra lor în
  aceeași declarație: inelul stă pe `--bg` de ambele părți, 8,8:1 (calculat). `verifica-pagina`
  cere haloul de cel puțin offset + grosime + 2 px, din regula generică, și umbra păstrată;
  controale: main.css de la 6ad3a47 (0 px), 5 px pe busolă, Satelit fără umbră, offsetul generic
  de 4 px (ar cere 9), banda dinăuntru a hărții de 1 px. În pagină (build, Tab real): `box-shadow`
  „rgb(23, 21, 15) 0px 0px 0px 7px, …” pe toate patru (2026-10-09, după plecarea butoanelor hărții), cu inelul la vedere în captură.
  Contrastul pe pixeli îl măsoară `npm run masoara-pixeli` (din 0.1.7.08), cu focusul adus cu Tab
  în Edge, la 1280 × 800 și DPR 2, la mijlocul fiecărei laturi, judecată fiecare în parte: cere
  cel puțin 3:1 de ambele părți ale inelului, pe toate patru.
  - Pe Satelit, „Coordonate” și etichetă, inelul (#d3b063) are 8,8:1 față de halou (#17150f) pe
    toate laturile, cât era calculat. Pe busolă tot 8,8:1, în afară de jos, 6,5:1: acolo, la
    0,4rem sub rozetă, începe chenarul citirii azimutului (`.citire`, `--line`, #332e24).
  - Pe rândul surselor, inelul are culoarea textului (#ece5d6): 14,6:1 pe toate laturile. Înainte,
    pe dreapta avea 1,0:1: separatorul „·” de după buton, cu umbrele lui de text din `--bg`, se
    desena peste inel. Butonul focusat are de atunci `position: relative; z-index: 1` (pe un
    element flex ajunge și numai `z-index`), păzit de `verifica-pagina`.
  - Controalele, pe aceeași măsurătoare, pică: rândul surselor fără `z-index`, cum era (1,0:1 pe
    dreapta), și busola fără halou (1,2–1,3:1 pe trei laturi).
  - Fără halou, inelul ar sta pe harta din spate: 1,2–1,4:1 la busolă (cerul, pe trei laturi; jos
    e citirea), 1,2–3,4:1 la etichetă, 1,5–1,9:1 la rândul surselor (pe trei laturi: sus, la 10 px,
    e marginea ecranului), 5,6–5,9:1 la Satelit și „Coordonate” (marea).
- Escape cu fișa deschisă o închide: focusul din fișă sau de pe `<body>` se întoarce pe
  etichetă, cel de pe alt control rămâne. Pe telefon foaia acoperă rozeta, Satelit și
  „Coordonate”, la care Shift+Tab ajunge (WCAG 2.4.11); Escape le dezvăluie fără să mute
  focusul. Cutia „Coordonate” se minimizează tot cu Escape — focusul din ea trece pe
  „Coordonate” —, dar numai cu fișa închisă: ascultătorul ei e înscris înaintea etichetei.
  `verifica-controale`, pe panoul și eticheta adevărate, cu un DOM fals: 9 cazuri; controale
  care pică: eticheta.js de la 6ad3a47 (focusul pe etichetă), punct.js de la 6ad3a47 (cutia
  rămâne), focusul întors numai din fișă (`<body>` rămâne pe `<body>`), panoul fără condiția
  fișei (un Escape minimizează panoul și lasă fișa). În pagină, la 390 × 844: rozeta
  (306–378 × 712–784) e în foaie (8–382 × 372–836); Escape o lasă cu focusul pe rozetă; din fișă,
  pe etichetă; din cutie, pe „Coordonate”.
- Bifa lui Satelit e în afara numelui: `content: "☐ "; content: "☐ " / "";`, deci „Satelit” în
  ambele stări (înainte „☐ Satelit” / „☑ Satelit”); fără forma cu text alternativ (Firefox sub
  128, Safari sub 17.4) rămâne prima declarație. Minificatorul le păstrează pe amândouă; în
  pagină `::before` dă `"☑ " / ""`. Numele din arborele de accesibilitate nu s-a citit
  <!-- NEVERIFICAT: fără CDP și fără cititor de ecran -->.
- Contrast forțat: Chromium nu forțează `fill`/`stroke` pe SVG, deci N-ul busolei
  (`#busola .eticheta.nord`, 1,2,0) bătea regula CanvasText (1,1,0) și rămânea `--accent`,
  2,54:1 pe o temă albă. Acum CanvasText; pivotul, Canvas cu conturul CanvasText. `verifica-pagina`
  judecă pe cascadă. În pagină, cu regulile blocului puse fără condiție prin CSSOM: N, E și
  conturul rgb(255, 255, 255), pivotul rgb(18, 18, 18); control, regulile de la 6ad3a47: N
  rgb(217, 145, 119). Contrastul forțat adevărat <!-- NEVERIFICAT: Windows High Contrast -->.

**Probele** — `npm run verifica-controale`, cu codul paginii, pe 1600 × 900. Scena de probă se
face cu rețeta paginii (`docs/teren.md`, „Rețeta lui alpha”), cu sanctuarul și clădirile, iar
camera, cu `creeazaCamera` (din 2026-10-14; înainte, două camere scrise din cifre, fără
amortizare, și controale care loveau numai clădirile):
- construcția scenei de probă, fără avertismente (înainte, înghițite);
- o rază verticală pe nava bisericii se oprește pe acoperiș, la cota 146,84 m; control: numai
  celelalte clădiri, cum dădea copia de dinainte probelor, nu lovesc nimic;
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
  `docs/punctul.md`, „Punctul de sub clic”): 0 m pe 5 200 de pixeli; control, compunerea veche: pe mare,
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

