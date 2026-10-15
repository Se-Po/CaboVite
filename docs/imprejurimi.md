# Zona alpha și împrejurimile

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

## Zona alpha și împrejurimile

**Zona alpha** e harta pe care se lucrează: `harta_v4` cu peticul `harta_v5`, numită
așa de autor pe 2026-10-07. E singurul spațiu de interacțiune: pe ea se măsoară, pe
ea stau etichetele, în jurul ei se rotește camera. `src/scene/alpha.js` îi dă
cutia NODURILOR — x ∈ [−1163; 1163], z ∈ [−1492; 1492], nu ±1164 / ±1493 ale
dreptunghiului de decupare — și ține ținta camerei în ea: dacă a ieșit, ținta și
camera se mută înapoi cu ACELAȘI vector, deci orientarea și distanța rămân
(măsurat: 1·10⁻¹³ m). Sfera din OrbitControls (`cursor` + `maxTargetRadius`) ar fi
lăsat ținta cu ~730 m dincolo de marginile de est și vest și cu ~400 m dincolo de
cele de nord și sud (raza ei e 1 892 m). Limita se prinde la `change` — și sub
reduced-motion, când OrbitControls își cheamă singur `update()` — și în buclă, pentru
restul pe care îl mai împinge amortizarea. Redesenare cere numai o mutare de peste un
milimetru, pragul lui OrbitControls: amortizarea împinge ținta în perete sute de
cadre cu fracțiuni de milimetru, iar pe podeaua y = 0 resturile ajung denormale și
țin ~8 900 de cadre — recenzia măsurase redesenări continue până la ~2,5 minute.
Acum, după o panoramare împinsă în podea sau în perete, 0 cadre în 2 s după inerție.
De când harta se mută ca o hartă, mutarea e orizontală: pe verticală ținta o mută
numai zborurile, zoomul spre cursor și pivotul pus pe teren, iar zoomul o așază din
capul locului în cutie (`intervalRaza`). Cât mutarea ține un punct apucat sub cursor,
limita mută și punctul: altfel, după ce tragi harta în perete, înapoi n-ar răspunde
nimic până când cursorul n-ar ajunge din nou unde e punctul.

**Împrejurimile** sunt peisajul real de dincolo de marginile tăiate ale lui alpha,
până unde ceața scenei îl acoperă de tot. Fără ele, din nord-est harta arăta ca o
foaie care plutește peste planul mării. Sunt decor: nu primesc umbre, nu au etichete,
nu se măsoară pe ele.

| nivel | sursă | pas | noduri de uscat | triunghiuri | textura Satelit |
|---|---|---|---|---|---|
| `harta_v6` | dalele DGT de 2 m, filtru cort 1-2-1 | 4 m | 109 248 | 216 105 | ortofoto, 2 m, 0,62 MiB |
| `harta_v9` | dalele DGT de 2 m, filtru cort 1-2-…-6-…-2-1 | 12 m | 69 151 | 138 203 | ortofoto, 2 m, 3,09 MiB |
| `harta_v7` | Copernicus GLO-30 | 32 m | 37 853 | 75 834 | ortofoto unde acoperă, altfel Sentinel-2; 16 m, 0,22 MiB |
| `harta_v8` | Copernicus GLO-30, media a 8 × 8 eșantioane, pe un disc de 50 km | 256 m | 30 931 | 64 457 | Sentinel-2, 64 m, 0,59 MiB |

În total +494 599 de triunghiuri (+25,7%), 27,9 MiB de atribute (cu normalele nivelurilor
netezite), 7,14 MiB de fișiere — din care 3,09 MiB textura de 2 m a lui `harta_v9`. ETC1S ar fi
dat 0,62 MiB, cu ΔE_OK×100 1,35 după decodare față de 0,22 (p99 6,0 față de 1,6); s-a păstrat
UASTC, alegerea autorului pentru alpha.
De ce până la 50 km: ceața three e PLANĂ (`vFogDepth = −mvPosition.z`), camera poate
sta la ~10 km de centru, iar colțurile unui ecran 16:9 văd până la ~30 km; la 25 km
uscatul ar fi fost în ceață numai pe jumătate, lângă o mare deja ~78% în ceață. Și de
ce nu mai departe: camera stă la cel mult ~9,9 km de centru (1,9 km până la colțul lui alpha,
plus 8 km), iar planul îndepărtat e la
60 km; colțurile pătratului lui `harta_v8`, la 68 km, ar fi fost retezate drept de el.
Dincolo de disc (`RAZA_V8`) nodurile sunt apă — 24 156 —, și tot de aceea lipsesc
dalele GLO-30 N37: uscatul de la sud de 38°, lângă Sines, e la peste 50 km.

**Sursele noi**, deschise, aduse o singură dată (`npm run surse-imprejurimi`, aprobat
de autor: 52,1 MiB în 208 cereri, plus 0,45 MB de antete citite întâi, la probă —
dalele Copernicus au 23 956 988 B, cele Sentinel 29 683 274 B, după manifest). Manifestul `scripts/imprejurimi/surse.json` ține
prima descărcare și, pe fiecare fereastră, mărimea dalelor ei din antet (53,6 MB în
total); o rulare de pe disc, care nu mai cere nimic — nici itemii STAC, ținuți și ei
pe disc —, nu le rescrie. `scripts/comun/cog.mjs` citește COG-uri pe intervale de octeți și ține pe
disc fiecare dală adusă; o construcție cere `descarca: false`, deci o dală lipsă e
eroare, nu descărcare tăcută. Originea, pasul și felul pixelului se citesc din antet:
- **Copernicus DEM GLO-30** (`copernicus-dem-30m` pe AWS), dalele N38 W010 și N38 W009,
  cu măștile FLM și WBM. PixelIsPoint: centrul pixelului (0, 0) e exact la (−9°; 39°).
  E un model de SUPRAFAȚĂ, cu coroane și acoperișuri, în EGM2008; nu se corectează.
- **Sentinel-2 L2A**, scena din 24.07.2025 (S2A, aceeași trecere peste dalele MGRS
  29SMC/SMD/SNC/SND, sub 0,04% nori), din fereastra zborului DGT. Decalajul BOA e deja
  aplicat în fișiere: reflectanța e DN × 0,0001 — pe apă B08 are mediana 259, deci
  0,026; cu încă −0,1 ar ieși negativă. Culoarea din TCI la 10 și 80 m, NDVI-ul din
  B04/B08 la 20 și 80 m, norii din SCL.

**Relieful.** `harta_v6` și `harta_v9` citesc dalele DGT numite în `NIVELURI`
(`scripts/comun/imprejurimi.mjs`), nu directorul: toate cele din catalog care ating amprenta
filtrului. Una numită care lipsește oprește construcția; una de pe disc, nenumită, care
atinge amprenta, la fel — altfel o dală adusă mai târziu ar schimba tăcut nodurile de pe
margine (recenzia: `harta_v6` s-ar fi schimbat pe coloana de est, cu până la 1,07 m, la o
simplă rescriere). De aceea `harta_v6` citește acum și coloana 107: cortul nodurilor de la
x −93001 ajunge la x −92999; refăcută, diferă exact acolo. Pătratele de 1 km din cutie fără
dală — 104164–104166, 105166, 108161, care nu există în catalog — trebuie să fie numai mare,
iar martorul e masca de apă GLO-30: 0 noduri de uscat în ele. Fără garda asta, `harta_v9`
construită fără 107165 pierdea ~1 km² de deal și toate probele treceau. Pe muchiile de nord
și est ale lui alpha, dalele dau exact `harta_v4` (1,21 mm, sub o cuantă de 2,41 mm; mutate cu
un pixel, 19,9 m); dalele 104xxx se sar, n-au uscat dincolo de alpha. `harta_v9`: filtrul cort
pe 11 × 11 pixeli, cât doi pași; fiecare dală stă pe GLO-30 minus decalaj la 0,30–1,85 m
(mediana pe nodurile plate; citite cu 1 km alături, 34,8 m). Patru dale au sub 50 de noduri
plate și sunt scrise în sidecar NEVERIFICATE de proba asta: 105165, 106161, 106162, 108162
(aceasta, numai faleză). Din 0.1.7.06, `verifica-tiff` le judecă față de vecinele lor DGT, pe
cusătură:
- **Măsura:**
  - Pe fiecare rând cu uscat de ambele părți, fără pixelul de margine (artefactul din
    `docs/harti-relief.md`), treapta e diferența peste cusătură minus panta. Panta se ia din
    pixelii 2–5 de fiecare parte.
  - Intră numai rândurile cu aceeași pantă de ambele părți: o vale care taie cusătura oblic
    strică extrapolarea cu metri.
  - Pe cusătură se iau mediana treptei și împrăștierea ei. O cusătură contează de la 50 de
    rânduri.
- **Pragurile** sunt 0,3 m pentru treaptă și 0,5 m pentru împrăștiere. Cele 23 de cusături
  dintre dale verificate dau cel mult 0,101 m și 0,396 m.
- **Dalele:**
  - 106162 trece pe toate patru cusăturile (−0,031 … +0,068 m; cea de sud e cu 106161, tot
    neverificată);
  - 108162 trece pe cea de nord (−0,032 m, 145 de rânduri), iar cea de vest are numai 12;
  - 106161 trece pe nord (−0,031 m) și pe est (−0,255 ± 0,462 m, 75 de rânduri, cea mai
    aproape de prag);
  - 105165 rămâne neverificată: are cel mult 25 de rânduri pe o cusătură.
- **Controale,** care pică:
  - dala ridicată sau coborâtă cu 1 m, pe toate cele 6 cusături;
  - 106162 cusută de 107163 în loc de 107162: treapta e mică, 0,29 m, dar împrăștierea are
    4,95 m.
- **Ce nu se poate judeca așa:** o deplasare de un pixel. Pe faleze, curbura terenului o
  acoperă, iar o coloană sărită sau dublată nu dă o deplasare de ±1 pixel pe toate
  cusăturile.

`harta_v7` și `harta_v8`: GLO-30 se
înregistrează pe alpha — abaterea mediană minimă, 0,161 m, e exact la (0, 0); cu solul
mutat un pixel, minimul se mută cu el (0,154 față de 0,537 m) — și se coboară cu
decalajul măsurat, **−0,778 m** (IQR −0,931 … −0,612), pe 632 de pixeli de sol gol
măsurat (FLM = 2, NDVI < 0,15, pantă mică), cu DGT netezit la amprenta pixelului.
Pe o bandă de 300 m (512 la `harta_v8`) se adaugă diferența față de nivelul
dinăuntru, netezită pe 150 m, scăzută liniar la zero; numai unde amândouă au uscat.
Diferența se ia cu aceeași regulă ca nodurile — la `harta_v8` media 8 × 8, nu un
eșantion punctual, care o anula —, iar un nod de pe marginea găurii ia latura cea mai
apropiată. Înainte de bandă, p90 |Δ| e 3,82 / 3,77 m la `harta_v7` față de `harta_v9` (N / E) și
3,55 / 6,39 m la `harta_v8`. Gaura fiecărui nivel trebuie să fie cutia nodurilor nivelului
dinăuntru de pe disc: o verifică și construcția, și pagina (`incarcaImprejurimi`). Gaura lui
`harta_v6`, primul nivel, se verifică în pagină pe geometrie, nu pe numele bazei
(`creeazaImprejurimi`, din 2026-10-14): cutia nodurilor de margine ale lui alpha trebuie să fie
`interior_noduri_scena`, în metri de scenă — în TM06 nu se poate, cutia bazei e scrisă pe muchii,
gaura pe noduri. Înainte, numele `harta_v4` stătea scris în `imprejurimi.js`, iar o bază
refăcută cu alt contur, dar cu numele păstrat, se cosea tăcut: mutată cu 4 m, fâșia scădea de la
2 645 de triunghiuri la 556, fără nicio eroare. Acum numele bazei nu mai e în cod (îl dau datele,
ca în `loaders.js`), iar o bază cu alt nume și aceeași cutie se încarcă.
Apa: oceanul din masca WBM, lacurile și râurile numai sub 1 m — un lac de baraj e
relief —, coborâtă la −8 m ca la alpha. Nodurile din adâncul găurii au cota apei, ca
fișierul să se comprime. Pământul rămâne plat (~159 m de curbură la 45 km, sub ceață).

**Cusătura** (`src/scene/cusatura.js`). Nodurile lui alpha merg pe ±1163 și ±1492, iar
1163 e prim: niciun pas mai mare de 2 m nu le prinde pe amândouă marginile, deci o
muchie comună ar avea joncțiuni în T și crăpături. Fiecare nivel se oprește pe primul
dreptunghi al grilei lui care cuprinde STRICT gaura, iar între cele două margini se
coase un fermoar: vârfurile ambelor bucle, în sensul acelor de ceasornic, ordonate
după proiecția lor pe dreptunghiul dinăuntru. Pozițiile vin din aceleași formule ca
plasele (`geometriaGrilei`, folosită și de `terrain.js`), deci coincid la bit;
fâșia intră în plasa nivelului din afară, cu NDVI-ul vârfurilor.

**Ceața.** Împrejurimile au un material al lor, pe Relief și pe Satelit: ceața
scenei, cu legea ei liniară, dar pe culoarea cerului de pe azimutul fiecărui pixel,
ca marea (`ceataCer` din `mare.js`, cu `lege: 'scena'`). Cu media orizontului,
uscatul de la 24–50 km ieșea o fâșie gri-albicioasă, cu ΔE 7–9 față de cerul de
deasupra (măsurat de recenzie). Lângă alpha, sub 5 km, ceața e zero în ambele legi.

**Culoarea.** Relief: aceeași regulă, cu NDVI-ul fiecărui nivel. `harta_v6` îl ia din
ortofoto, ca alpha (`npm run strat-ndvi -- harta_v6`, nivelul de 1 m în blocuri de
4 × 4; proba de clase se sare, e a lui alpha); `harta_v9` tot din ortofoto, în
`textura-imprejurimi`, pe blocuri de 12 × 12 la 1 m. `harta_v7` și `harta_v8`: din ortofoto
unde acoperă, altfel din Sentinel, calibrat liniar pe ortofoto și verificat pe blocuri
ținute deoparte — `NDVI_orto ≈ −0,171 + 0,834 · NDVI_S2`, R² 0,934 la `harta_v7`;
`−0,165 + 0,815 ·`, R² 0,961 la `harta_v8`. Ortofotoul e mozaicul dalelor 464-3 și 464-1
(`deschideMozaic`), X −96 000 … −88 000, Y −140 000 … −130 000. Cusătura dintre ele nu se
vede: |Δ| de luminozitate peste ea 6,14 niveluri, pe o margine de bloc JPEG din aceeași dală
6,36, iar diferența medie cu semn pe R/G/B/infraroșu −0,06 / 0,01 / 0,02 / 0,04. Controale:
mutată 1 m, 10,92; cu +2 niveluri pe roșu sau cu R și B inversate, proba cu semn pică.
Deplasarea pe sol (+0,25 m spre est) e măsurată pe 464-3 și presupusă și pe 464-1 — o
optime de texel la 2 m. Satelit: ortofotoul unde acoperă (`harta_v6` și `harta_v9` întregi,
din `harta_v7` până la ~5,5 km spre est și ~6,4 km spre nord de marginea lui alpha), altfel
Sentinel-2 adus la ortofoto printr-o matrice 3 × 3 plus decalaj, în lumină liniară: ΔE_OK×100
3,24 la 10 m (TCI citit ca sRGB; ca liniar 3,75) și 3,93 la 80 m (TCI liniar; ca sRGB 4,01),
pe jumătatea de verificare, față de 8,77 / 17,85 fără transfer. Varianta se alege pe nivel.
Uscatul pe texeli se citește din tot lanțul, cu nivelurile din afară la urmă: texelii de
dincolo de ultimul nod ieșeau înainte apă adâncă, iar mipurile întunecau marginea (ΔL_OK×100
−5,3 la mipul 1 pe marginea de nord a lui `harta_v9`, −7 la `harta_v7`). Unde nu e nicio
culoare — la est de `harta_v7`, cadrul trece cu ~1 km de grilă, dincolo de ferestrele
Sentinel aduse —, uscatul ia culoarea vecinului colorat (7 291 de texeli). Proba: pe fiecare
latură, texelul de margine față de vecinul lui are |ΔL| cât între doi vecini dinăuntru
(`harta_v9` 3,61 față de 3,85), și niciun texel de uscat nu are culoarea mării. Pe ultimii 300 m dinspre
marginea ortofotoului, cele două se amestecă. Pe marginea datelor ortofotoului, media
urmează regula texturii lui alpha (sub jumătate de pixeli valizi, numai pe ei; altfel
pe toți), iar uscatul se citește întâi din nivelul dinăuntru. Apa se topește în apa
adâncă a lui alpha. Proba cusăturii texturii: unde `harta_v6` și baza se suprapun,
54 726 din 54 727 de texeli de uscat sunt identici cu nivelul de 2 m al bazei, iar
abaterea maximă e un nivel; citită cu un texel alături, baza mai are 164 identici.
Funcțiile comune ale texturilor (mipuri, KTX2, pierdere) stau în `scripts/comun/textura.mjs`;
`textura-ortofoto` refăcut după mutare dă aceleași fișiere, la sha256.

**Netezirea.** `harta_v9`, `harta_v7` și `harta_v8` nu au fațete plate (`NIVELURI_NETEZITE`):
fațetele de 32 m se vedeau pe Relief, de la ~2 km, ca pete — fiecare cu lumina și
culoarea ei —, iar autorul a cerut relieful netezit (2026-10-07); cele de 12 m ale lui
`harta_v9`, văzute de la 0,4–2,4 km, la fel. `harta_v6` rămâne cu fațete, ca alpha. Normala e pe nod, din diferențe centrale pe grilă, pe 8 biți cu semn
(`normal` normalizat, 3 octeți pe vârf: +2,5 MB pe cele 835 482 de vârfuri netezite, suma nodurilor și
fâșiilor numărate de `verifica-imprejurimi`); culoarea, tot pe nod, din aceeași
regulă, cu panta normalei și NDVI-ul nodului, iar GPU-ul le interpolează peste triunghi.
Un nod de apă ia media culorilor uscatului de pe cel mai apropiat inel de noduri din
jurul lui: o fațetă de 32 m care coboară de la 10 m la −8 m iese din mare abia la 57% din
drum, deci culoarea apei s-ar fi întins pe mal. În grilă ajunge inelul 1 — o celulă
păstrată are un colț de uscat —; în fâșia de cusătură, un nod de pe marginea grilei lui
poate avea uscatul abia la lățimea fâșiei, deci se caută până la `INELE_APA` = 8 pași
(un pas al nivelului din afară). Recenzia găsise 4 vârfuri ale fâșiei `harta_v6` |
`harta_v7` colorate cu regula pe nodul însuși, la −8 m, ca un mal deschis la culoare.
Fâșia de cusătură e în plasa nivelului din afară, deci e netezită odată cu el;
vârfurile ei iau normala și culoarea nodului lor din nivelul căruia îi aparține nodul
(`campNeted` din `terrain.js`, prin `buclaNoduri`), deci între două niveluri netezite
plasa continuă fără linie. Pe Satelit nu schimbă nimic: materialul e
neiluminat. `tot()` scrie normala numai pe uscat și pe apa cu uscat pe inelul 1 (restul
mării nu intră în nicio celulă), o singură dată pe nod, iar `imprejurimi.js` îl cheamă o
dată și îl dă lui `creeazaTeren` (`camp`): normalele cerute scad de la 645 357 la 158 789,
iar împrejurimile se construiesc în 125 ms în loc de 160 (cu bucla plată a lui `harta_v6`;
la rece, mediana a 7), cu aceleași atribute la bit.

**În pagină** (`src/scene/imprejurimi.js`): totul sau nimic, la relief și la
straturi; fără date, pagina rămâne cu marginile tăiate și un avertisment. Pe un GPU fără
niciun format comprimat, unde KTX2 iese RGBA, împrejurimile de 2 m pe texel (`harta_v6`,
`harta_v9`) pierd primul mip, ca peticul care folosește atunci textura bazei: ~67 MB pe
placă în loc de ~103 <!-- NEVERIFICAT: calea RGBA, pe un GPU fără compresie -->.

**Fără codul umbrelor.** r186 definește `USE_SHADOWMAP` pe renderer, nu pe obiect
(WebGLPrograms.js:363), deci orice material luminat calcula pe fiecare vârf poziția în harta
de umbre — un mat4 × vec4, normala în lume pentru deplasarea de normală și un varying
vec4 —, și împrejurimile, care n-au `receiveShadow` și
stau toate în afara hărții: 1 483 797 de vârfuri, 20% din terenul desenat în Relief.
`onBeforeCompile`-ul ambelor materiale (cu fațete și netezit) pune `#undef USE_SHADOWMAP`
în fața ambelor shadere, după prefixul cu `#define`; și fără cer, cu cheia
`teren-imprejurimi-fara-cer`. Cheia cu cer rămâne `teren-imprejurimi`, iar numărul de
programe nu crește. `ceataCer` își calculează singură poziția în lume, deci nu-i trebuie
`worldPosition`, pe care `worldpos_vertex` îl face numai pentru umbre. În pagină:
programele `teren-imprejurimi` n-au nici `directionalShadowMatrix`, nici
`directionalShadowMap` printre uniforme — 0 din 8, față de 4 din 8 înainte —, iar în aceeași
sesiune, cu materialele de dinainte puse înapoi, Relief dă 0 pixeli diferiți în cele patru
vederi (țintă fixă 640 × 400). Timpul GPU, alternat vechi/nou, mediana a 15: pe canvasul de
916 × 914 cu MSAA, acasă 17,71 → 17,40 ms, sanctuarul 17,84 → 17,53, de la 8 km 16,87 →
16,54; în 1600 × 900 cu MSAA 4, −0,23…−0,33 ms. Același câștig în toate vederile: e în
vârfuri. Satelit nu e atins — materialul lui e neiluminat.

**Textura lui `harta_v9`** se cere întreagă, la 2 m pe texel (3,09 MiB), odată cu celelalte.
De la 0.1.3.02 până pe 2026-10-08 venea în două trepte: întâi `harta_v9-orto_v1-mic`,
nivelurile de mip 1–4 ale celei întregi (4 m, 0,79 MiB), apoi cea de 2 m, după ce Satelit era
pe ecran. Pe 2026-10-08 autorul a văzut harta încărcându-se în etape și a cerut s-o vadă o
singură dată, direct pe Satelit, cu tot la detaliul întreg (vezi `docs/satelit.md`, „O singură încărcare”).
Varianta mică a ieșit din depozit, cu `TEXTURA_MICA` din `textura-imprejurimi`; regula ei din
`vercel.json`, `(?:-mic)?`, a rămas și nu mai prinde nimic, iar pentru `verifica-livrare` un
`-mic` revenit e un fel necunoscut și pică (încercat cu fișierele încă în `dist/`). Compresia
n-ar fi ajutat: setarea UASTC e deja cea implicită, iar cu RDO mai tare fișierul scade cu 5%
(2,93 MiB) sau, cu pierderea p99 triplată, cu 17%; ETC1S ar avea 0,62 MiB, cu ΔE de șase ori mai
mare.
Cine revine nu le mai cere deloc: `vercel.json` le ține un an în cache (vezi `docs/livrarea.md`, „Cache-ul”). În
`?previzualizare` nu se încarcă. Satelit le comută materialele cu ale lui alpha, pe
același program. `inaltimeRandata` din scenă — alpha unde e alpha, împrejurimile în
rest — e cea pe care merg raza panoului punctului și ocluzia etichetei; măsurătorile
rămân pe `inaltimeLa` al lui alpha.

**Acasă** e vederea de pornire, `VEDERE_START`: de acolo pornește pagina, acolo duc
busola (`acasa()`) și tasta Home. Rozeta poartă eticheta „Acasă — vederea de pornire”.

**Probele.** `npm run verifica-imprejurimi`:
- încărcătorul: un nivel lipsă (cu un singur avertisment), un nivel cusut de alt interior →
  `null`; un strat lipsă → niciun strat (totul sau nimic); fișierele adevărate, fără niciun
  avertisment; o bază cu alt nume (`harta_v10`) se încarcă, iar codul de la 5ec413f, cu numele
  scris, o respingea (control);
- alpha rămâne la 1 923 948 de triunghiuri; construcția împrejurimilor, fără avertismente
  (control: un `console.warn` pus prin mutație în `creeazaImprejurimi` e prins);
- marginea lui alpha mutată cu 4 m pe x: construcția aruncă; control, `imprejurimi.js` de la
  5ec413f: cusută tăcut, fâșia cu 556 de triunghiuri în loc de 2 645;
- **0 crăpături** pe 749 971 de muchii: fiecare muchie de uscat e a două triunghiuri, în
  afara marginii exterioare a lui `harta_v8`, și niciuna a trei; control: `harta_v6`
  fără fâșie are 2 640;
- o gaură care nu e cutia nodurilor nivelului dinăuntru (a lui `harta_v7`, mutată un pas)
  → `null`;
- culoarea Relief peste cusături, pe tronsoane de-a lungul laturilor de nord și de est (de
  64 m, sau un pas al nivelului din afară), FĂRĂ triunghiurile fâșiei: ele fac 82% din banda
  de lângă gaură, iar vârfurile lor dinăuntru au culoarea nivelului dinăuntru. Benzile au
  16 m la alpha, altfel două rânduri ale nivelului din afară, cel puțin 64 m: una mai lată
  măsoară variația terenului, nu cusătura (v9 → v7: 5,59 pe 64 m, 8,28 pe 192 m, fără nicio
  treaptă). Două probe: ΔE_OK×100 al medianelor — 1,63 / 5,49 / 5,47 / 7,77 (alpha → v6 →
  v9 → v7 → v8), praguri 2,5 / 8 / 8 / 10 — și mediana diferenței CU SEMN pe L, a, b, o
  treaptă de culoare de-a lungul cusăturii: azi |ΔL| ≤ 1,63, prag 2,5. Controale: fiecare
  nivel colorat cu NDVI ± 0,10 pică, cu |ΔL| de cel puțin 3,17;
- netezirea: `harta_v9`, `harta_v7` și `harta_v8` au normală pe vârf și `flatShading` fals,
  `harta_v6` nu; în plasele netezite, cu fâșiile lor, fiecare poziție de vârf are o singură
  normală și o singură culoare — 141 482 de poziții, dintre care 840 pe cusăturile dintre ele;
  control: o buclă a lui `harta_v7` colorată fără NDVI dă 387 de poziții diferite;
- câmpul nodurilor, recalculat în probă, nu importat (diferențe centrale, `culoareTeren`,
  `ndviNod`, inelele apei): pe toate vârfurile — 412 145 la `harta_v9`, 226 415 la `harta_v7`,
  192 548 la `harta_v8` —, 0 culori diferite și normala la cel mult 0,38° (prag 0,5°:
  cuantizarea pe 8 biți dă cel mult ~0,39°), 0 normale nule; la fel bucla dinăuntru a fiecărei
  fâșii, recalculată pe nivelul ei — 2 464 de vârfuri pe `harta_v6`, 1 087 pe `harta_v9`, 823
  pe `harta_v7`. Niciun nod de apă folosit fără uscat la 8 pași (cu 3 ar fi rămas unul).
  Controale, pe `harta_v9`: NDVI-ul nodului de alături dă 267 343 de culori diferite; bucla
  dinăuntru a fâșiei citită din grila lui `harta_v9` în loc de a lui `harta_v6`, 2 329 —
  greșeala, încercată de recenzie pe `harta_v7`, trecea de toate probele de dinainte;
- formula față de geometrie: normala scrisă față de media fațetelor din jur, ponderată cu
  aria, pe vârfurile de uscat cu panta de peste 2° (sub ea, pe terenul aproape plat al lui
  `harta_v8`, orice normală aproape verticală ar trece): mediană 0,42° / 0,56° / 0,56°, p99
  4,32° / 3,30° / 3,42° (`harta_v9` / `harta_v7` / `harta_v8`), prag 1°; control: normala
  nodului de la est dă 2,10° / 2,52° / 2,10°;
- bugetul: 600 000 de triunghiuri, 8 MiB de fișiere (azi 7,14); fiecare nivel are în
  `public/data` numai cele șase fișiere pe care le cere pagina — cu varianta mică încă acolo,
  `harta_v9` pica;
- la bit: sha256 pe fiecare atribut al celor patru plase, cu fâșiile, cât în `AMPRENTA`
  (citită pe codul de dinainte de `plasaPlata` și de `tot()` cel nou), și cel mult 160 000
  de normale de nod (`Math.hypot`) la construcție — codul vechi cere 645 357 și pică.
  Controale: un nod al lui `harta_v8` ridicat cu 1 mm schimbă numai amprenta lui; `tot()`
  fără normala apei de pe inelul 1 lasă 2 081 / 1 187 / 7 830 de normale nule și pică;
- fără codul umbrelor: shaderul lui MeshStandardMaterial, trecut prin `onBeforeCompile`-ul
  fiecărui nivel, cu definițiile pe care le pune three pentru o lumină cu umbră (PCF, culori,
  ceață) și preprocesat cu bucățile lui three (`#include`, `#if`, `#define`, `#undef`), n-are
  `directionalShadowMatrix`, `vDirectionalShadowCoord`, `directionalShadowMap` sau
  `getShadow(` — pe cele patru niveluri fără cer și pe `harta_v6` și `harta_v9` cu cer, unde
  ceața pe cer rămâne. Control: MeshStandardMaterial fără `onBeforeCompile` le are pe toate
  patru; codul de dinainte pică pe toate șase.

În pagină (panoul Browser, țintă fixă 640 × 400): alpha cu și fără împrejurimi dă
**0 pixeli diferiți** în afara pixelilor în care se văd împrejurimile — scoși dintr-o
randare a lor în magenta neiluminat —, în patru vederi (acasă, sanctuarul, farul, de
la 8 km), pe Relief și pe Satelit; control: împrejurimile desenate fără test de
adâncime ies peste alpha în toate patru (376, 419, 48, 1 231 de pixeli, pe Relief).
Relief iese la octet după zece comutări Satelit; programele și texturile nu cresc;
după `dispose()`, 0 geometrii și numai `DFG_LUT`; în repaus, 0 cadre.

**Banda DGT, `harta_v9`** (2026-10-07). Textura de 16 m a lui `harta_v7` se vedea ca o
trecere de la 2 m, la ~400 m dincolo de alpha; acum trecerea e la ~2,4 km. Autorul a adus din
catalogul CDD (`MDT-2m`, câte 1 001 129 de octeți, sufixul `-06-2024`, versiunea 01;
verificate pe API-ul STAC public al CDD, `https://cdd.dgterritorio.gov.pt/dgt-be/v1`) 14 dale:
105165, 106165, 106166, 107161–107166, 108162–108166, plus ortofotoul
`ortos2025_cog_25cm_rgbi_jpg_464-1_v02.tif` (464-1, colțul NV la (−96 000; −130 000);
sferturile foii sunt 1 = NV, 2 = NE, 3 = SV, 4 = SE, câte 8 × 5 km). Celelalte patru pătrate
din dreptunghi — 104165, 104166, 105166, 108161 — nu există în catalog. La 4 m, ca
`harta_v6`, banda ar fi costat ~1,4 milioane de triunghiuri; la 12 m costă 138 203, iar
pașii cresc 4 → 12 → 32 m. `harta_v7` s-a refăcut cu gaura mărită (`--suprascrie-lucru`,
nefiind încă publicată); `harta_v8` a ieșit identică la octet. Pe Satelit se vede de departe
o pată închisă pe malul de nord, la (−92 978; −134 120): o faleză spre vest, în umbră pe
fotografia de dimineață — relieful DGT o prinde abruptă, Copernicus o netezea; fotografia
rămâne, ca la falezele lui alpha.

