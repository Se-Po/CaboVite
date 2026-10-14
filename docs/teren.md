# Terenul: plasa și culoarea

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

## Cum se generează plasa terenului

`src/scene/terrain.js` transformă grila de înălțimi într-un singur mesh cu
fațete plate. Patru lucruri de acolo nu se pot ghici din cod fără măsurătoarea
care le-a motivat.

**Celulele de apă nu se generează.** Toate patru nodurile la `zMin_m` înseamnă
umplutură, nu batimetrie — o spune `regula_apa` din sidecar. Sunt 930 714 din
cele 1 641 746 de celule păstrate ale bazei `harta_v4` (56,7%) și 122 858 din cele
373 800 ale peticului (32,9%), iar marea e un plan **opac** de 120 km la `COTA_MARE`, pe
sub care camera nu poate coborî: ținta nu coboară sub cota mării (cutia lui alpha),
`minDistance` e 80 și `maxPolarAngle` e π/2 − 0,04, deci camera stă cu cel puțin
80 · sin 0,04 = 3,2 m peste țintă. Cifra de dinainte, 64,6 m, era pentru ținta la
y = 60 și ieșea greșit: 60 + 3,2 = 63,2. Erau desenate la
fiecare cadru și nu se puteau vedea niciodată. Triunghiuri, pe `harta_v2`:
2 562 454 → 1 362 122; pe `harta_v4`, cu uscatul din afara conturului, 1 923 948.

Se taie numai celulele cu TOATE patru nodurile la cotă; malul rămâne întreg. Iar
`inaltimeLa` citește din `grila`, nu din plasă, deci tăierea nu atinge panoul
punctului: un clic pe mare întoarce punctul de pe suprafața mării, la `COTA_MARE`, și
eticheta „apă" (vezi „Punctul de sub clic”).

**Nu există atribut `normal`.** Cu `flatShading: true`, shaderul r186 nu-l
citește: sub `FLAT_SHADED` varianta `vNormal` nici nu se declară, iar
`normal_fragment_begin` calculează `normalize(cross(dFdx, dFdy))` — planul
fațetei, adică exact ce am fi scris. Pe geometrie neindexată cu normale de
fațetă cele două sunt același plan. Scapă 92 248 344 de octeți din RAM și de pe
placă, plus 127 ms de `computeVertexNormals()` la fiecare pornire. Excepția sunt
nivelurile de la 12 m încolo ale împrejurimilor, netezite (`neted`, `campNeted`): vezi
„Zona alpha și împrejurimile”.

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

**Bucla plată e o funcție de modul, numai cu scalari** (`plasaPlata`, 2026-10-08), pentru
grilă și fâșie; închiderea de dinainte făcea patru tablouri pe celulă și unul cu iterator
pe triunghi. Apa se întreabă înaintea lui `pastreaza` (pe bază, 1 735 196 → 774 562 de
apeluri), iar `mascaBazei` sare `inPoligon` în interiorul strict al unui contur-dreptunghi
(al lui `harta_v4` e cutia). La rece, în Node, mediana a 7 rulări: baza 151 → 115 ms,
peticul 63 → 45. Atributele sunt identice la bit, și în pagină: `verifica-teren` cere
sha256 pe position, color, cutie și sferă cât în `AMPRENTA` (citită pe codul vechi) și
cel mult 774 562 de apeluri, iar codul vechi pică. Controale: diagonala cu `<` schimbă
sha-ul (2 747 de nepotriviri la proba 2); scurtătura cu muchiile incluse greșește 140 de
puncte din 1 736 496. Cu câmpul netezit și cu drapajul (în „Zona alpha și împrejurimile”
și „Sanctuarul”), cadrul lung de la
pornire scade în pagină de la 524 la 406 ms (build de producție, Long Animation Frames,
mediana a 5 încărcări).

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

Regula costă ~+45 ms la construcția bazei, în Node; `verifica-teren` tipărește cifra.

