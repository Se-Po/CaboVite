# Farul și celelalte clădiri

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

## Farul și celelalte clădiri

Farol do Cabo Espichel, cele șase clădiri de lângă el și cele trei de la Casa da
Ronca, la ~400 m spre sud-vest, intră pe hartă ca geometrie, în schema sanctuarului:
`public/data/cladiri_v1.json`, construit în pagină de același `creeazaSanctuar()`.

### Contururile: OSM, înregistrate pe LiDAR

- `npm run osm-cladiri` e un profil separat: `osm-sanctuar` își rescrie manifestul
  la fiecare rulare. Ia căile cu `building` sau `man_made=lighthouse` din cutia lui
  `harta_v4`, fără cele ale sanctuarului. Instantaneul e
  `date-sursa/osm/cladiri-osm-2026-09-30.json`, manifestul
  `scripts/cladiri/osm-manifest.json`. Sunt 10 căi, niciuna atinsă de changesetul
  120423250.
- `scripts/cladiri/inventar.json` ține câte o decizie pentru fiecare element, cu
  motivul. `build-cladiri` refuză un element fără decizie și un inventar scris pe
  alt instantaneu. Toate 10 intră.
- **Candidații fără OSM** (nMDS > 1 m, NDVI < 0,15, ≥ 5 m², la peste 1 m de
  amprente) sunt doi, de 12 și 5 m². Rămân pe dinafară, cu motivul scris.
- **Aici amprentele OSM NU cad pe clădiri**, spre deosebire de sanctuar. Pe
  nMDS > 1 m acoperă 72–95% din aria lor (farul, pe pixelii de peste 12 m, 68%) și
  sunt mutate cu 0,4–2,2 m, fiecare altfel. `build-cladiri` caută translația, în pași de 0,25 m pe ±3,5 m, care
  maximizează „pixeli de clădire − pixeli de sol” în amprentă. Forma rămâne a
  OSM-ului, iar acoperirea urcă la 86–99%. Cea mai mare mutare e la Casa da Ronca,
  (1,25; 1,75) m.
- **Farul are hexagonul OSM mai mare decât turnul:** la ~5,5 m de ax, MDS-ul
  coboară pe acoperișul casei lipite de el. Se înregistrează cu translație și cu
  scară, pe pixelii de peste 12 m: ×0,84 și (−0,75; 0,25) m. Acoperirea urcă de la
  68% la 95%. Lanterna cade la 0,18 m de axul hexagonului înregistrat — probă de
  consistență, nu independentă: lanterna e în masca pe care s-a potrivit.
- `build-cladiri` scrie și `date-sursa/derivate/cladiri-grup-N.png`: ortofotoul
  mărit de 3 ori, cu amprenta OSM roșu, cea înregistrată galben și farul cyan.

### Formele

- **Amprenta concavă** se taie în părți convexe (urechi, apoi Hertel–Mehlhorn).
  Nodurile de pe laturi se scot întâi: 156262936 are cinci, la 1–5 mm, iar unul la
  −1 mm ar face concav un dreptunghi.
- **Fiecare parte** ia minimul planelor RANSAC (`scripts/comun/plane.mjs`, mutat din
  `masoara-sanctuar` cu rezultat identic), pe pixelii de la cel puțin 0,75 m de
  marginea clădirii. O parte sub 40 de pixeli ia planele clădirii.
- **Treptele.** Un acoperiș în trepte nu e un minim de plane: planul de jos,
  prelungit, taie prin cel de sus. Pe 156262922, mediana abaterii ieșea 0,92 m.
  Unde p90 trece de 0,5 m, partea se taie pe dreapta care desparte cele două plane
  mai mari. Tăietura rămâne dacă p90 scade cu cel puțin 0,2 m; acolo a scăzut de la
  1,11 la 0,05 m.
- **Farul** e o prismă hexagonală până la platformă, apoi lanterna.
  - Platforma: mediana MDS pe inelul 0,6–0,95 din apotemă, 158,59 m (solul e la
    136,71 m).
  - Lanterna: inelele de peste jumătatea dintre platformă și vârf, adică r ≤ 2,5 m.
    Urcă vertical până la 166,40 m, iar cupola ajunge la vârful MDS, 168,28 m.
  - Profilul pornește de la platformă, nu de la marginea prismei: un inel plat la
    cota capacului ar pâlpâi cu el.
  - Înălțimea: de la sol la vârf, 31,57 m. OSM are `height=32`, pe care nicio
    măsurătoare de aici nu-l citește.
- **Măsurat pe clădirile întregi:** mediana abaterii 0,025 m, p90 0,076 m.

### Materialele: după apa cea mai puțin arsă

- **Nu după pantă și nu după culoarea medie.** 156262880 are ape de 48° și e
  țiglă, dar ortofotoul îl dă aproape neutru: apa din est e arsă, cea din vest în
  umbră. La sanctuar, țigla aripii N are a = 0,015 în OKLab, terasa 0,000.
- **Regula.** Pe fiecare apă se numără pixelii arși (un canal ≥ 254). Hotărăște
  apa cea mai puțin arsă:
  - arsă și ea peste 50% ⇒ alb, `var`: 156262911 și 156262922, cu 82–94% pe
    fiecare apă. O țiglă are apa din umbră la 0–4%;
  - roșcată ⇒ `tigla`, albedoul din fotografie. Pragul lui a stă la jumătatea
    dintre terasa sanctuarului și cea mai puțin roșcată țiglă a lui, măsurate la
    fel;
  - altfel, referința neutră cea mai apropiată: terasa (303868633) sau acoperișul
    întunecat.
- **Cum se citește ortofotoul.** Cu deplasarea pe sol și cu înclinarea
  acoperișului: h × înclinarea măsurată la sanctuar, iar la far cea a grupului de
  peste 9 m. Pe casa lipită de far se scoate imaginea turnului, înclinată de la sol
  până la vârf.
- **Controlul a fost privirea**, pe straturile `cladiri-grup-N.png`: toate cele
  zece acoperișuri ies cum se văd acolo, iar cupola lanternei iese roșcată.
- **Presupuneri**, scrise și în date, la `presupuneri`: pereții — var la clădirile
  întregi, zidărie la cele pe care OSM le dă ruine — și camera lanternei, var. Nu se
  văd de sus: **NEVERIFICAT**.
- **Casa da Ronca și 96521147 sunt `ruins=yes` în OSM**, dar LiDAR-ul vede acoperiș
  întreg (96% din amprentă pe două ape de 30°), iar ortofotoul, țiglă. Se construiesc
  cu acoperiș, cu pereții din zidărie. Numele „Casa da Ronca” vine numai din OSM —
  **NEVERIFICAT** într-o sursă primară.

### În pagină

- `incarcaCladiri()` și `incarcaSanctuar()` stau pe aceeași funcție din
  `loaders.js`. Fiecare refuză datele celeilalte, după prefixul lui `nume`.
- `creeazaSanctuar({ ..., eticheta: 'clădiri' })` are `fatada`, `cruzeiro` și `poi`
  opționale. `materiale_profil` dă câte o culoare pe segment de profil. Fiecare
  element poartă un `grup`, iar obiectul întors are `cutiiGrupuri`.
- Proba refactorizării: `sanctuar_v2` dă același sha256 pe position, color și
  ocluzie, înainte și după. Din 2026-10-08 sumele stau în `verifica-sanctuar` și
  `verifica-cladiri` (`AMPRENTA`), deci orice refactorizare trece prin ele.
- Clădirile sunt al doilea Mesh, pe același program (`sanctuar-ocluzie`): un apel
  de desenare în plus și 232 de triunghiuri.
- Panoul punctului ia clădirea cea mai apropiată din oricare set. Numele vin din
  `src/content/cladiri.js`, după prefixul cheii.

### Umbrele pe grupuri

- **Trei grupuri:** sanctuarul, farul, Casa da Ronca. Texelul, în metri:

  | soarele | cutia unită | sanctuarul | farul | Casa da Ronca |
  |---|---|---|---|---|
  | Relief (18° / 244°) | 0,604 | 0,211 | 0,124 | 0,102 |
  | al zborului (39,5° / 94°) | 0,497 | 0,216 | 0,118 | 0,097 |

- **`urmaresteGrupul()`** din `scena.js` alege cutia la fiecare cadru desenat:
  - cutia unită, dacă texelul ei stă sub TEXEL_MAXIM (0,3 m) sau nu trece de
    pixelul ecranului la țintă. Pixelul e al canvasului (`canvas.height`), nu CSS și nu
    neapărat de dispozitiv: raportul e plafonat la 2, iar canvasul la 2560 × 1440;
  - la pornire ținta e la 611 m, iar primul cadru are de acum soarele zborului (harta apare
    direct pe Satelit): cutia unită rămâne pe un canvas înalt de cel mult ~1 121 px
    (1120 → „toate”, 1122 → „sanctuar”); cu preferința Relief, cu soarele Relief, ~922 px
    (920 / 925). Se alege la primul cadru: la creare canvasul are încă 300 × 150. Măsurat în
    pagină, la primul cadru, pe Satelit: 1440 × 900 la DPR 1 dă „toate”, 0,497 m pe texel; la
    DPR 2 (canvas 2428 × 1517) „sanctuar”, 0,216 m; telefonul în portret, 390 × 844 la 3×
    (780 × 1688), „sanctuar”; în PEISAJ, 844 × 390 la 3× (1688 × 780), „toate”, 0,497 m —
    raportul de pixeli e plafonat la 2 (vezi `docs/randarea.md`, „Mărimea canvasului”), iar fără plafon canvasul
    ar avea 1170 px înălțime, peste prag. Farul își primește umbra când te apropii de el.
    Cutia unită, forțată, ar fi
    făcut umbrele sanctuarului, din mijlocul imaginii, de 2,3 ori mai difuze sub
    Satelit și de 2,9 ori sub Relief;
  - altfel, grupul cel mai apropiat de țintă.
- **Texelul cutiei unite depinde de soare**, deci pragul se judecă în buclă, nu la
  creare. `umbre.potriveste()` crește `versiuneSoare`, iar `pas()` recitește atunci
  texelul cu `texelPentru(cutie)`, o proiecție care nu atinge camera. Înainte de
  recenzia three.js, pragul rămânea cel al soarelui Relief și sub Satelit: pe un
  ecran de 1 000 px, grupurile nealese pierdeau umbra de la 663 m de țintă în loc
  de 546 m.
- **Histerezis:** ±10% pe pixel și 20 m între grupuri. O schimbare costă o
  redesenare a hărții, în același cadru: `needsUpdate` se pune înainte de `render`.
- **Consecința:** de departe umbrele se văd pe toate grupurile, la 0,50–0,60 m pe texel;
  de aproape, numai pe grupul privit.

### Probele: `npm run verifica-cladiri`

- **încărcătorul:** șapte căi de eșec dau `null` și un avertisment, fără aruncare.
  Una dintre ele sunt datele sanctuarului;
- **construcția:** 0 elemente sărite, 232 de triunghiuri (buget 6 000), 6,5 KiB
  (buget 20), două grupuri. O cheie inexistentă în `materiale_profil` sare farul,
  cu avertisment; înainte, culoarea nedefinită se scria tăcut ca negru;
- **vârful:** cel mai înalt vârf e la 168,28 m, iar raza verticală pe ax lovește
  `far.turn` la 168,280 m;
- **amprenta plasei:** sha256 pe position, color și ocluzie, egal cu `AMPRENTA` din
  capul scriptului (2026-10-08), ca în pagină; control: vârful lanternei coborât 1 mm
  dă altă sumă. `cladiri_v1` n-are `turnuri`: farul e o cupolă cu `laturi`;
- **față de LiDAR** (cere dalele):
  - acoperișurile, pe 3 774 de pixeli: mediana −0,001 m, p90 0,085 m. Ridicate cu
    1 m, pică;
  - amprentele stau pe clădire în 97,3% din aria lor; mutate 2 m, cel mult 85,2%.
    **Proba amprentelor nu e independentă:** înregistrarea a maximizat chiar mărimea
    asta, deci prinde numai o greșeală de transport până în pagină.

