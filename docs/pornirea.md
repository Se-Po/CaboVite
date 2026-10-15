# Pornirea

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

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
atunci. Titlul (`<header>`) și `<noscript>` rămân: fără JavaScript `data-scena` nu vine. Canvasul n-are pointer până atunci: o tragere de 400 px în timpul încărcării muta camera
cu 560 m înaintea primului cadru (control, în pagină). Măsurat pe build: `data-scena` se pune cu
`frame` 0, cu Satelit deja aplicat, iar primul cadru e Satelit (5 din 5 încărcări). La
1600 × 900, 390 × 844, 844 × 390, 320 × 568 și 195 × 422, cu „5%” și cu „100%”, pastila și
butonul stau în ecran, fără defilare orizontală.

**Titlul și pagina fără scenă.** `<header><h1 class="ascuns">Cabo Espichel</h1></header>`
(ascuns vizual, ca `.ascuns` al versiunii) și `<noscript>`, cu o propoziție, stau înaintea lui
`#continut`, nu în el: `faraScena()` scrie numai într-un `#continut` gol, iar cu JavaScript
pornit conținutul lui `<noscript>` e text. Fără scenă, după anunț vine capitolul sanctuarului
(`src/chapters/sanctuar.js`): textul fișei, cu sursele ca legături, fără nota despre model și
fără id-uri — calea fără scenă poate veni și după o excepție cu eticheta încă vie.
- `verifica-pagina`: fără WebGL2 și după o excepție, `#continut` are 2 994 de caractere; cu garda
  expirată, cu butonul „Reîncearcă”, 3 034. Pe toate trei, 20 de legături, un singur `h1`, în afara
  lui, și 0 id-uri duble. Controale: main.js de la 6ad3a47, 26 de caractere; `h1` pus în
  `#continut`, 13; `<noscript>` acolo, 72; capitolul cu id-urile fișei, `sanctuar-fisa` ×2. Fișa
  etichetei, eticheta.js de la 6ad3a47 față de azi: outerHTML identic, 7 281 de caractere
  (controale: fără `rel`, fără `tabIndex`, diferă);
- `verifica-livrare`: index.html și dist/ au un `h1` și un `<noscript>`, cu `#continut` gol;
- în pagină (2026-10-09), build-ul fără WebGL pe serverul de probă, cu CSP impus: 3 006 caractere
  vizibile; textul 17,76 px, `--ink` pe `--bg` 14,6:1; sursele 16 px, 7,1:1; legăturile 7,2:1,
  subliniate, cu focus; la 390 px fără defilare orizontală; 0 încălcări CSP. Fără JavaScript
  (iframe `sandbox` fără scripturi): propoziția se vede, mesajul de încărcare nu; control, regula
  panourilor de la 6ad3a47 ascunde propoziția și titlul. Cu scena (4174 la 916 × 579, 4173 și la
  390 × 844): `h1` 1 × 1 px, tăiat; scos `<header>`, 0 din 148 de cutii se mută (control, `h1`
  fără `.ascuns`: 2). Cu un cititor de ecran adevărat nu s-a încercat
  <!-- NEVERIFICAT: titlul și capitolul cu NVDA/VoiceOver -->.
- Anunțul e `role="alert"`: mesajul de încărcare, singura regiune live de până atunci, pleacă
  odată cu `data-scena`, iar harta poate cădea și sub un cititor care o folosea. După garda
  pornirii focusul trece pe „Reîncearcă”, după o cădere de după pornire pe anunț, numai dacă era
  pe <body> sau pe canvasul scos; la încărcare, fără WebGL2, nu se mută. O excepție de după
  `porneste()` eliberează acum scena, ca `laEsec` (`elibereazaScena`): busola, Satelit și
  eticheta rămâneau peste capitol, iar tastatura hărții îi oprea defilarea (recenzia).
  `verifica-pagina`: rolul, focusul pe fiecare cale și scena eliberată o dată, cu contextul
  pierdut; controale: scena neeliberată, anunțul fără rol, focusul nemutat.

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
Capitolul sanctuarului nu-l poate importa — e un modul, iar plasa rulează tocmai când modulele
nu pornesc —, deci rămâne propoziția.
Pe un server de probă local, cu build-ul de producție:
- three.core cu o eroare de parsare la început: mesajul, fără canvas, fără mesajul de încărcare.
  Control, același modul fără plasă: „Se încarcă harta 3D…” pe vecie, `#continut` gol;
- `index-*.js` cu 404 (HTML vechi după un deploy): mesajul;
- `index-*.js` întârziat 4 s: `load` vine la 4,04 s, după modul, harta pornește, fără mesaj.

## Încărcarea datelor: stratul NDVI și garda pornirii (mutat din „Hărțile de relief”)

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
(vezi `docs/satelit.md`, „Garda fotografiei”); cererile ei pleacă abia după datele pornirii, deci nu le țin la coadă.

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
