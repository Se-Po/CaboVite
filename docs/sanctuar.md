# Sanctuarul

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

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
  **greșit**: măsurat din umbre, soarele zborului stă la 94,0° / 39,5°
  (vezi `docs/fotografii.md`, „Zborul ortofotoului”), iar 96° / 22,5° nu e o poziție a soarelui în fereastra de
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
  spre VNV cu ~0,09 m pe metru de înălțime (vezi `docs/fotografii.md`, „Zborul ortofotoului”).

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
- `loveste(raza)` dă clădirea din fața razei: întâi cutia tuturor (din 2026-10-14), apoi
  cutia fiecărui element, apoi Möller–Trumbore numai pe triunghiurile lui. Panoul punctului o
  preferă terenului când e mai aproape și scrie și cota solului. `lovesteCladiri(...seturi)`
  (sanctuar.js) alege lovitura cea mai apropiată din sanctuar și din celelalte clădiri, pentru
  pagină și pentru probe. Cutia tuturor a venit când `verifica-controale` a început să lovească
  și sanctuarul, ca pagina: probele dronei, cu paza solului pe tot trunchiul vederii, trimit
  mii de raze, cele mai multe departe de complex, iar fiecare cerceta cutiile tuturor
  elementelor — proba a urcat de la 12 s la 55 s. Cu verificarea, 10 s, cu aceleași rezultate
  (o rază care ratează cutia tuturor nu poate atinge cutia unui element).
- Eticheta e un buton DOM, proiectat în ramura de randare, după
  `camera.updateMatrixWorld()`: `OrbitControls.update()` cheamă `lookAt()`, care
  reface matricea cu poziția nouă și rotația VECHE, iar `render()` o reface abia
  după. Fără ea, la o orbitare de 3° pe cadru pinul stătea la 44 px de biserică;
  cu ea, la 0,06 px. Ocolește panourile,
  trece la marginea ecranului cu o săgeată când ancora iese din cadru și se face
  punctată când relieful o acoperă. **Vizibil = `getClientRects().length`**, nu
  `offsetParent`: acela e null și pentru `position: fixed`, adică pentru fișa de pe
  telefon, sub care eticheta ajungea fără să știe.
- **Eticheta și rândul surselor** (2026-10-14). Pe un Pixel 8 Pro (448 × 867), cu
  „Coordonate” deschis, imaginea urcă, ancora ajunge la y ≈ 1 și toate patru pozițiile
  ating rândul surselor; cea care acoperea cel mai puțin stătea peste „© OpenStreetMap”,
  deși atribuirea se vede fără nicio interacțiune. Acum, când toate patru ating ceva,
  fiecare se mută lângă fiecare obstacol pe care îl atinge — sub, deasupra, după,
  înainte — și se ia mutarea liberă cea mai scurtă; pentru mutări, pinul vizibil e și el
  obstacol. Fără niciun loc liber câștigă cea care acoperă cel mai puțin din obstacolele
  tari (rândul surselor), apoi din toate. Unde una din cele patru poziții era liberă,
  alegerea e aceeași. `verifica-controale`, pe dreptunghiurile măsurate pe telefon (cutia
  goală, cutia cu o clădire, „Coordonate” minimizat): eticheta la (162,2; 60), chiar sub
  rând; pe o grilă de 4 px, cu pinul și fără, 0 din 147 126 poziții peste surse (6 780
  înainte); cu pinul vizibil (±6 px, din main.css), 2 248 din 73 563 îl ating, toate
  dintre cele patru poziții împinse de marginea ecranului, niciuna mutată (înainte, 11 681);
  la ancora (276; 764), minimizat, mutarea liberă cea mai scurtă, (8; 722). Trei cazuri
  construite: fără loc liber, sursele rămân libere chiar dacă eticheta acoperă mai mult din
  rest; dintre pozițiile care le lasă libere, cea care acoperă cel mai puțin (10 160 px², nu
  12 800); o mutare care ar acoperi pinul pierde. Unde una din cele patru poziții era
  liberă, 0 schimbate din 88 880 față de `2c5c680`; fără git pică numai comparația asta.
  Apoi `creeazaEticheta` întreagă, pe un DOM fals cu dreptunghiuri: rândul surselor și pinul
  ajung din DOM la `alegePozitie`. Controale, care pică: eticheta.js de la `2c5c680`; fără
  prioritatea atribuirii; rezerva numai pe obstacolele tari; fără pin; raza pinului de 2 px;
  prima mutare liberă; cea mai lungă; mutările fără margine; fără întâietatea celor patru
  poziții; în DOM, `TARI` gol, `{ pin: false }` și dreptunghiurile fără `tare`.
- Clicul deschide fișa, APOI zboară: zborul primește cutia fișei. Cât fișa e
  deschisă, un decalaj de obiectiv (`setViewOffset`) mută imaginea în partea liberă —
  foaia de jos pe telefon, panoul din dreapta pe desktop — iar distanța crește cât
  să încapă complexul (~110 m în jurul terreiro-ului). Camera și pivotul nu se mută.
  Decalajul îl aplică `cadru-liber.js`, comun cu cutia „Coordonate” deschisă
  (vezi `docs/punctul.md`, „Punctul de sub clic”); distanța se socotește pe partea liberă de amândouă.
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
de departe, cutia unită a grupurilor, 0,50–0,60 m — vezi `docs/cladiri.md`, „Umbrele pe grupuri”. Cutia
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
shader (vezi `docs/imprejurimi.md`, „Fără codul umbrelor”). Cutia trece între grupuri — vezi
`docs/cladiri.md`, „Umbrele pe grupuri”.

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
  (60 866 pe `harta_v4`/`harta_v5`; 60 855 pe v2/v3), JSON ≤ 150 KiB (94,7);
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

