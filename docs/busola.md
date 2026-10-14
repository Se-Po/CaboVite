# Busola, vederea de pornire și zborul

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

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
zborul de la capăt la fiecare 33 ms. Home stă în `tastatura.js`, cu celelalte taste ale
hărții (vezi „Mouse-ul, degetele și cursorul”).

**Anunțul busolei** (regiunea live, 600 ms după ce camera s-a liniștit) se scrie numai
când textul se schimbă: o mutare sau un zoom fără rotire îl rescriau identic, 10 din 10.
`reanunta()` golește întâi regiunea, deci la apariția hărții se scrie tot. Proba, în
`verifica-controale`: 10 mutări și zoomuri, 0 scrieri; o rotire de 15°, una; pe busola.js
de la 6ad3a47, 10 scrieri identice.

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

