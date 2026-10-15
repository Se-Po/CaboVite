# Fotografiile, culorile și ortofotoul

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

## Fotografiile de la fața locului

Originalele stau în `date-sursa/poze/` — date-sursă, deci în afara depozitului,
lângă `lidar/`. `public/photos/` e altceva: fotografiile pe care le *afișează*
pagina, redimensionate; azi directorul e gol (numai `.gitkeep`). Copiază-le prin USB; WhatsApp, Telegram și descărcarea
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

`ORTOS-2025` de la DGT, dala `ORTOS-2025-cog-25cm-464-3` (296 MB, în
`date-sursa/ortofoto/`, deci în afara depozitului). Lângă ea stă, din 2026-10-07, și
464-1, dala de la nord (335 MB), pentru împrejurimi; scripturile lui alpha numesc dala
lor (`ORTOFOTO_ALPHA` din `scripts/comun/ortofoto.mjs`), nu iau „primul .tif din
director” — alfabetic, 464-1 vine înaintea lui 464-3, iar `verifica-teren` chiar a picat. **BigTIFF**, nu TIFF clasic:
magic 43, numărul de intrări dintr-un IFD pe 8 octeți, intrări de 20 de octeți,
valori inline până în 8 octeți. `citesteIfd(..., big)` din `scripts/comun/tiff.mjs`
tratează ambele.

**Atribuirea.** Datele DGT sunt CC BY 4.0, iar metadatele lor din SNIG cer, la orice
publicare, și adaptată, textul „Informação geográfica cedida pela Direção-Geral do
Território”. Îl scrie `scrieSurse()` din `src/main.js`, o singură dată, cu
`lang="pt"`, ori de câte ori subsolul are o sursă DGT. Sidecarurile publicate nu
s-au rescris pentru asta. Imaginea `og:image` îl poartă și ea, în XMP (`dc:rights`), cu
atribuirile întregi, luate din aceeași modală (docs/livrarea.md, din 0.1.8.01).

În pagină rămâne un singur rând, fără fundal, sus-stânga: „© DGT · © Copernicus ·
© OpenStreetMap”. Copernicus vine cu împrejurimile — relieful GLO-30 și Sentinel-2;
o sursă își poate scrie singură numele scurt (`scurt`), iar două surse cu același
nume scurt apar o dată. Licențele fără adresă cunoscută iau `licenta_url` din sursă,
iar clauza de răspundere a licenței Copernicus DEM (`raspundere`) intră în modală
lângă atribuiri. Se citește prin contur: opt umbre de 1–1,5 px fără estompare
desenează în jurul literelor un inel plin din culoarea fundalului, deci contrastul e
al lui `--ink` pe `--bg`, peste 14:1. Numai cu umbre estompate, recenzia măsurase pe
cerul de pornire, pe tema întunecată, mediana 3,47:1. Inelul de focus al rândului e
de culoarea textului, între două chenare din culoarea fundalului: cel auriu obișnuit
avea ~1:1 față de cer. Regulile OSM (OSMF,
Attribution Guidelines) cer ca atribuirea să se vadă fără interacțiune; „©
OpenStreetMap” e o formă acceptată, iar legătura duce la pagina lor de copyright.
„© DGT” deschide o modală cu tot restul — textul SNIG, atribuțiile, licențele,
prelucrările —, un `<dialog>` deschis cu `showModal()`: focusul rămâne înăuntru,
Escape o închide, pagina de dedesubt e inertă. Rândul și modala se fac o singură
dată. Pe calea automată sursele Satelit sosesc înaintea lui `data-scena` și intră în prima
scriere a subsolului; Satelit cerut din buton, după pornire, rescrie numai textele, deci o
modală deschisă rămâne deschisă. Cât e deschisă, Escape-ul e al ei: fișa
sanctuarului, inertă dedesubt, nu-l mai fură.

Adresele din surse (`licenta_url`, `portal`, portalul OSM al rândului) trec prin
`hrefSigur()` și devin legături numai dacă sunt http(s). Una cu `javascript:` sau `data:`, ori
fără schemă, rămâne text. Portalul OSM se recunoaște după începutul adresei — schema, gazda
(openstreetmap.org, cu sau fără www) și calea `/copyright` —, nu după o bucată de oriunde din ea. Proba, în `verifica-pagina` (din 0.1.7.05), rulează `main.js` cu o scenă falsă:
- cu surse ostile, toate cele 4 legături ies http(s);
- cu surse bune, „© OpenStreetMap” duce la pagina lor de copyright;
- un portal https pe altă gazdă, care numai conține „openstreetmap.org/copyright”, nu ajunge în
  rând; controlul, fără ancora gazdei, îl pune acolo;
- controlul, `main.js` de la 5ec413f, lega `javascript:` de două ori.

Piramida lui are nivel la **2 m** și la **1 m** — exact pașii lui `harta_v4` și
`harta_v5`. Colțul e la TM06 (−96000, −135000) cu pas 0,25 m, iar decalajul până
la `harta_v4` (aceeași cutie ca `harta_v2`) iese **106 × 703 pixeli, întregi**:
pixelul ortofotoului cade peste nodul LiDAR fără reeșantionare. La `harta_v5` pasul se potrivește, dar
alinierea NU: pe convenția „noduri", amprenta primului nod începe la 1180,5 ×
2298,5 pixeli, deci nodurile cad pe colțurile pixelilor. Peticul se citește de la
nivelul de 0,5 m, mediat 2 × 2 — vezi `docs/harti-relief.md`, „Stratul NDVI”. Scriptul verifică asta și se oprește dacă nu iese.
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

Pagina folosește soarele sanctuarului.

**Proba independentă e cerul.** Perechea (azimut, elevație) trebuie să fie o
poziție prin care soarele chiar a trecut în fereastra de zbor a lotului 4
(24.05–25.07.2025). Soarele sanctuarului cade la 0,08° de poziția din 17 iulie,
09:00 UTC, sau din 25 mai, 08:51 UTC; cel al farului, la 0,01° de 2 iunie, 08:49 UTC.
Cifra veche, 96° / 22,5°, cade la 9,76° de orice poziție posibilă — deci era greșită. Din
`sanctuar_v3`, acoperișurile sanctuarului se aduc la plat sub soarele acesta (`docs/sanctuar.md`).
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
