# Cerul și randarea

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

## Cerul și ceața mării

`src/scene/cer.js`: cerul Preetham din three (`Sky.js`), **senin** — norii lui cer un
`time` care curge, iar scena desenează la cerere. Cutia are 40 km și stă pe planul
îndepărtat (`gl_Position.z = w`); camera ajunge la cel mult 8 km de țintă.

**Expunerea se calculează.** Sky.js e scris pentru ~0,5 sub ACES; sub AgX la 1 iese
altfel. `expunereCer` e factorul la care orizontul OPUS soarelui are luminanța culorii
de cer a paletei (`paleta.cer`, 0x7d92a6), deci pagina rămâne la fel de luminoasă ca
înainte: 0,21 cu soarele Relief (18° / 244°), 0,075 cu al zborului (39,5° / 94°) —
Preetham e mult mai luminos cu soarele sus. Tema deschisă de până la v0.1.1, cu
cerul 0xdfe8ef, avea 2,18 și 0,79.

**Portul JS.** `cerLiniar()` și `agx()` refac în JS exact formulele shaderului și
ale lui `AgXToneMapping` din r186 (matricile coloană cu coloană, ca în GLSL). Cu ele
se află expunerea și media orizontului fără să se citească pixeli. Proba, în pagină,
pe cinci direcții (orizont spre soare și opus, 30°, 60°, zenit): pixelii GPU și
portul dau **aceiași octeți**, ΔE_OK×100 sub 0,1.

**Ceața mării e pe fiecare pixel**, cu culoarea cerului la orizont pe azimutul
privirii (`GLSL_CER`, cu uniformele cerului), trecută prin AgX și prin conversia de
ieșire — ceața three se amestecă DUPĂ ele. O ceață de o singură culoare nu se poate
potrivi cu un cer care variază după azimut. Legea e și ea alta decât a scenei:
exponențială, `LUNGIME_CEATA_MARE` = 10 km. Cu cea liniară de 5–24 km, de la câteva
sute de metri înălțime ceața completă cădea la 6 pixeli sub orizont, iar marea
rămânea închisă până la linia cerului — o dungă. Planul mării are 120 km, de două
ori planul îndepărtat, deci marginea lui nu se vede niciodată.

Cusătura orizontului, cu privirea orizontală din larg, rândul de cer față de marea
de sub el: ΔE 0,50 / 0 / 0,53 opus soarelui / spre el / lateral; o ceață de culoare
constantă ar da 2,85 / 4,54 / 0,59. Alpha stă sub 5 km de cameră și primește ceața
obișnuită, liniară, cu media orizontului ca culoare — aceeași lege ca înainte, deci
terenul de aproape iese neschimbat. Împrejurimile, până la 50 km, păstrează legea
liniară, dar iau culoarea cerului de pe azimut — vezi `docs/imprejurimi.md`, „Ceața”. Cadre desenate în 2 s de repaus: 0.

## Randarea: ordinea de desenare, mărimea canvasului, compilarea

### Cerul ultimul, marea după teren

three sortează lista opacă întâi după `renderOrder`, apoi după `material.id`
(WebGLRenderLists.js:7-13), iar cerul și marea își fac materialele înaintea terenului. Se
desenau deci primele: cerul, Preetham și AgX pe fiecare pixel, se umbrea pe tot ecranul și
se acoperea apoi pe 93% din pixeli la pornire și pe 100% de aproape; marea, cu ceața pe
pixel, se umbrea sub teren pe 37% la pornire și pe 89–100% de aproape (acoperirea, din
recenzie). În Satelit marea trecea și înaintea împrejurimilor și a terenului.

Acum cerul are `renderOrder = 2` (cer.js), marea 1 (mare.js) — pe obiect, deci și când
Satelit îi schimbă materialul. Marea, desenată după teren, are `depthFunc = LessDepth` în
ambele materiale (mare.js și `mareM` din satelit.js): la egalitate de adâncime câștigă tot
terenul, ca înainte, când el venea al doilea pe `LessEqual`. Cerul rămâne pe `LessEqual`:
adâncimea lui e exact 1,0, cât a curățării, deci cu `Less` n-ar trece nicăieri. Nu scrie
adâncime, deci nici transparentele de după el nu se schimbă.

Probele:
- `npm run verifica-pagina`, cu sortarea lui three însuși: cerul ultimul și marea înaintea
  lui, și cu materialul mării din Satelit (`materialMareSatelit`, același ca în pagină);
  marea pe `Less` în ambele materiale, cerul pe `LessEqual` fără să scrie adâncime. Control: fără `renderOrder`, cerul iese primul. Codul de dinainte
  pică pe trei;
- în pagină (panoul Browser, țintă fixă 640 × 400, fără MSAA, ieșire sRGB, cutia umbrelor
  pusă de mână pe fiecare vedere): acasă, sanctuarul, farul și de la 8 km, pe Relief și pe
  Satelit, față de codul de dinainte — **0 pixeli diferiți** în toate opt. Ordinea, din
  `onBeforeRender`: Relief „teren, teren, sanctuar, drapaj-1…4, clădiri, harta_v6, v9, v7,
  v8, mare, cer”, Satelit „sanctuar, clădiri, harta_v6…v8, teren, teren, mare, cer”;
  înainte, Relief începea cu „cer, mare”, iar Satelit cu „cer, sanctuar, clădiri, mare”:
  materialele Satelit se fac abia când sosesc texturile. Controale: fără `Less` pe mare, 19 pixeli
  diferiți pe țărm de la 8 km pe Relief (18 pe Satelit, cel mult 83 pe un canal) și 2 acasă;
  cerul ultimul, dar fără test de adâncime, schimbă 93% / 100% / 100% / 87,65% din cadru
  (acasă / sanctuarul / farul / 8 km);
- timpul GPU (EXT_disjoint_timer_query_webgl2, Intel UHD 770 prin ANGLE D3D11, panoul
  vizibil, mediana a 15 randări, vechi și nou alternate în aceeași sesiune), pe canvasul de
  916 × 914 cu MSAA:

  | vederea | Relief | Satelit |
  |---|---|---|
  | acasă | 17,45 → 17,38 ms | 12,49 → 11,98 ms |
  | sanctuarul | 18,99 → 17,54 | 12,89 → 11,93 |
  | farul | 18,12 → 16,81 | 12,56 → 11,80 |
  | 8 km | 17,15 → 16,53 | 12,67 → 12,14 |

  Într-o țintă de 1600 × 900 cu MSAA 4 cifrele merg la fel (sanctuarul, Relief: 23,39 →
  21,83), cu o excepție: Relief acasă iese +0,2 ms (21,45 → 21,63). Desfăcut, acolo
  câștigul vine numai din cer (pe canvas −0,17 ms, în țintă ~0), iar marea mutată după
  teren costă puțin (+0,05 pe canvas, +0,18 în țintă), fiindcă acum se umbrește și
  terenul de sub suprafața ei, pe care înainte îl oprea testul de adâncime. Pe
  GPU-urile Apple, care nu umbresc fragmentele opace acoperite, câștigul ar trebui să fie
  aproape zero <!-- NEVERIFICAT: raționament, nu măsurătoare -->.

### Mărimea canvasului

`redimensioneaza()` din `renderer.js` are două plafoane: raportul de pixeli, cel mult 2 —
alegerea autorului, 2026-10-08 —, și 2560 × 1440 de pixeli de dispozitiv. MSAA rămâne. Un
telefon de 390 × 844 la 3× avea 1170 × 2532 (2,96 MP), sub plafonul de pixeli; acum are
780 × 1688 (1,32 MP). Pe GPU-ul desktopului, Satelit la mărimea aceea costa 15,8 ms față de
13,0 la 2× (linia de bază); pe un telefon adevărat câștigul nu e măsurat. Desktopul
(1600 × 900 la 1×, 1440 × 900 la 2× → 2428 × 1517) și tableta (1024 × 1366 la 2× →
1662 × 2217) nu se schimbă. Bufferul de desen la 390 × 844 la 3× e, calculat și nemăsurat,
35,5–47,4 MB cu rezolvarea MSAA implicită și 118,5–130,3 MB cu cea explicită; la 2× e de
2,25 ori mai mic <!-- NEVERIFICAT: ce rezolvare MSAA alege Chrome pe telefon -->.
Întoarce true și la o mărime CSS nouă cu același buffer — mărirea paginii, 1280 × 720 la 1× →
640 × 360 la 2× —, ca bucla să refacă decalajul imaginii (vezi `docs/punctul.md`, „Punctul de sub clic”).

Ce a costat: un telefon în peisaj pornește cu umbrele pe cutia unită
(vezi `docs/cladiri.md`, „Umbrele pe grupuri”), iar cu pagina mărită de două ori pe telefon (195 × 422 la 6×) canvasul rămâne
390 × 844 — un pixel randat pe 3 × 3 ai ecranului. Un buget de pixeli pe
`(pointer: coarse)`, care n-ar depinde de mărire, nu s-a ales.

Probele: `npm run verifica-pagina`, pe un renderer fals — telefonul 780 × 1688, în peisaj
1688 × 780, un Android de 412 × 915 la 3,5× 824 × 1830, desktopul, laptopul și tableta ca
înainte, `setSize` mereu cu `false`; codul de dinainte pică pe patru (1170 × 2532). În
pagină: presetul mobil al panoului (375 × 812, DPR 2) dă 750 × 1624, iar cu
`devicePixelRatio` forțat la 3, 390 × 844 dă 780 × 1688 și 844 × 390 dă 1688 × 780.

### Compilarea, înaintea primului cadru

three compilează programele la prima randare și așteaptă acolo, sincron, legarea fiecăruia.
`construieste()` le compilează întâi — `await renderer.compileAsync(scena, camera)`, în `try`,
după ultima plasă și chiar înaintea buclei —: cu KHR_parallel_shader_compile se leagă în
paralel, fără să blocheze firul. Fără extensie programele trec drept gata (WebGLProgram.js:995),
iar promisiunea se rezolvă după un temporizator de ~10 ms (WebGLRenderer.js:1567), cu legarea tot
pe primul cadru <!-- NEVERIFICAT: calea fără extensie, citită în cod -->. Programul umbrei
rămâne pe primul cadru (`compile()` nu face trecerea de umbre). Satelit își compilează
materialele pe plase-proxy, înaintea lui: între `compileAsync` și buclă stă numai așteptarea
fotografiei (vezi `docs/satelit.md`, „O singură încărcare”). Pe un context pierdut Chromium dă `COMPLETION_STATUS_KHR`
adevărat, deci așteptarea nu se agață.

Măsurat pe build, în panou, cu fila în față (Intel UHD 770, ANGLE D3D11, canvas 916 × 914),
din Long Animation Frames, câte 4 încărcări alternate, când primul cadru era încă Relief.
„Rece” = programe noi pentru cache-ul ANGLE: un script injectat de serverul de probă pune în
fiecare shader un `#define` unic; codul vechi dă așa cam cât auditul pe un profil nou de browser
(391–393 ms).

| | primul cadru | din el, legarea | cadrul gata, de la ultima dată sosită |
|---|---|---|---|
| rece, înainte | 370–383 ms | 298–315 ms | 659–702 ms |
| rece, după | 99–109 ms | 32–38 ms | 459–508 ms |
| cald, înainte | 119–131 ms | 48–59 ms | 402–434 ms |
| cald, după | 96–101 ms | 31–33 ms | 409–447 ms |

La prima vizită imaginea apare cu ~0,2 s mai devreme; la reveniri, cam la fel: legarea trece
din cadru în așteptarea de dinaintea lui. Construcția, ~0,3 s, e altă sarcină, neatinsă.
Probele, în pagină: primul cadru citit din canvas și vederea de pornire în țintă fixă
640 × 400, pe Relief, **0 pixeli diferiți** față de codul de dinainte (control: Satelit în
aceeași țintă, 255 639); 7 programe la primul cadru Relief și 11 după Satelit; contextul
pierdut în timpul compilării și refăcut după 0,5 s: harta pe ecran, 0 erori; 0 încălcări CSP pe
`cabo-espichel-productie`. `npm run verifica-pagina` păzește ordinea, pe sursă: pică pe scena.js
de la `30a22c9` și cu compilarea mutată după buclă. Pe telefon nemăsurat
<!-- NEVERIFICAT: câștigul pe un GPU mobil -->.

## Bucla: o excepție nu se repetă (mutat din „Convenții three.js r186”)

- O excepție în buclă nu se lasă să se repete. three cere cadrul următor ÎNAINTEA
  buclei (`WebGLAnimation.js:10`), deci una persistentă ar arunca la fiecare cadru,
  și în repaus, cu imaginea înghețată: măsurat în pagină, cu `zbor.pas` aruncând
  mereu, 61 de erori neprinse în 1 s și 0 cadre. Corpul buclei din `scena.js`
  (`cadru()`) stă într-un `try`: la prima excepție, un singur `console.error`, iar
  cadrul se cere din nou; contorul se golește numai după ce `render()` a întors. La
  al treilea eșec la rând, `setAnimationLoop(null)` și `laEsec`, opțiunea lui
  `porneste()`: `main.js` cheamă `dispose()`, prin aceeași listă ca la pornire, apoi
  `forceContextLoss()` — canvasul e abandonat, deci contextul n-are de ce să rămână viu,
  ca pe calea de eroare de la pornire — și calea fără scenă
  (`data-scena="indisponibila"`, subsolul ascuns). Probe, în
  pagină: aruncând mereu, trei apeluri, un `console.error`, 0 erori neprinse, de la
  14 geometrii și 9 texturi la 0 și 1 (textura rămasă era LUT-ul DFG al lui three; din
  2026-10-14, 0 și 0, vezi mai jos); o excepție o singură dată, în `zbor.pas` sau
  în `gest.pas` (după `cerut = false`), costă un cadru, redesenat la cel următor,
  iar scena rămâne activă — pe codul de dinainte, cea din `gest.pas` lăsa cadrul
  cerut nedesenat (0 cadre în 0,5 s).

## Eliberarea: LUT-ul DFG al lui three

Măsurat pe 2026-10-14. După cadre desenate, `renderer.info.memory` era `{ geometries: 10,
textures: 9 }`, iar după `__scena.dispose()` `{ 0, 1 }`: pe v0.1.6 publicat și, după
măsurătoarea autorului, pe build-ul local de dinainte. Fără cadre (panoul Browser ascuns),
`{ 0, 6 }` → `{ 0, 0 }`: textura rămasă se făcea abia la randare.

**Cum s-a găsit.** În panoul Browser, imediat după navigare și înaintea scenei, s-au înfășurat
pe `WebGL2RenderingContext.prototype` `createTexture`, `deleteTexture`, `activeTexture`,
`bindTexture`, `texStorage2D`, `texImage2D` și `compressedTexImage2D`: fiecare textură, cu
formatul și mărimea primului ei nivel, și care s-a șters. S-au prins exact nouă:

| # | formatul | mărimea | ce e |
|---|---|---|---|
| 1–6 | BC7 (0x8E8D), 5 niveluri | 2368 × 3008 … 896 × 832 | texturile Satelit (KTX2), urcate înaintea buclei |
| 7 | RGBA8 (0x8058) | 2048² | culoarea hărții de umbre |
| 8 | DEPTH_COMPONENT24 (0x81A6) | 2048² | adâncimea ei |
| 9 | RG16F (0x822F) | 16² | `DFG_LUT`, urcată de `WebGLUniforms.upload` |

După `dispose()` numai #9 mai era vie (`gl.isTexture`).

**De ce.** three r186 ține LUT-ul DFG — tabelul reflexiei speculare al materialelor fizice —
într-un singleton al modulului: `getDFGLUT()` din `DFGLUTData.js` îl face la prima chemare.
`setProgram` (WebGLRenderer.js:2743) îl pune în uniforma `dfgLUT` a oricărui material care o
are, prin `UniformsLib.envmap`: Basic, Lambert, Phong, Standard, Physical. Pe placă urcă abia
când un program fizic îl eșantionează, deci la primul cadru (sanctuarul și clădirile, Standard,
pe Satelit), nu la `compileAsync`, care nu cheamă `setProgram`: de aceea fără cadre nu apărea.
`renderer.dispose()` golește numai ce ține rendererul, iar `getDFGLUT` nu e exportat, deci nu-l
elibera nimeni.

Ceilalți candidați se eliberează: umbrele (`soare.shadow.dispose()`; `deallocateRenderTarget`,
WebGLTextures.js:413, ia și `depthTexture`), texturile Satelit (`satelit.js`); cerul și marea
n-au texturi, fundalul e un `Color`, PMREM nu există. `emptyTexture` și `emptyShadowTexture`
(WebGLUniforms.js:51-53) au `version` 0, deci nu urcă niciodată.

**Reparația.** `urmaresteLutDFG(renderer)` din `dispose.js`: `prinde(material)` citește LUT-ul
din uniformele unui material desenat (`renderer.properties`), iar `dispose()` îl eliberează.
scena.js îl prinde imediat după `render()`, din materialul terenului — desenat în fiecare cadru,
cu uniforma pe ambele vederi —, și îl înscrie în `deEliberat`, deci pleacă prin `curata()`,
înaintea lui `renderer.dispose()`. Înscrierea, `lutDFG.dispose(scena)`, îl mai caută o dată în
toate materialele scenei: un `render()` care aruncă după ce a desenat un material fizic îl urcă,
dar sare peste `prinde` (recenzia `threejs-reviewer`; cu trei cadre la rând așa, `laEsec`).
Lista se golește de la coadă, deci LUT-ul trebuie înscris DUPĂ terenul, marea, sanctuarul,
clădirile, împrejurimile și Satelit: altfel `material.dispose()` le-ar fi scos deja uniformele
din `renderer.properties`. Prinderea de după cadru rămâne calea principală: acoperă și
materialele pe care Satelit le-a schimbat chiar înaintea eliberării, încă nedesenate.

Ordinea contează și față de renderer: după `renderer.dispose()` proprietățile rendererului sunt
golite, iar `Texture.dispose()` nu mai ajunge la placă. Eliberarea unui singleton e sigură:
`dispose()` doar anunță ascultătorii texturii, datele rămân, iar un renderer nou îl urcă din nou.
Printre ascultători sunt, după un context pierdut și refăcut, și ai modulelor de dinaintea
pierderii: aceia mai șterg o dată mânerul vechi (vezi mai jos, „Ce rămâne”). Ne sprijinim pe un
interior al lui three (`renderer.properties`, uniforma `dfgLUT`), deci o versiune nouă de three
trece întâi prin `verifica-pagina`.

**Probele.** `npm run verifica-pagina`, secțiunea LUT-ului DFG:
- contractul r186, citit în build-ul pe care îl încarcă pagina: singletonul, uniforma pusă de
  `setProgram`, `renderer.properties`, `renderer.dispose()` care nu-l atinge, uniforma în basic,
  standard și physical. Controale: `setProgram` fără LUT și un `dispose()` care l-ar elibera
  singur, cu apelul la coada corpului — corpul se găsește, deci pică detectorul, nu ancora — pică;
- eliberarea, cu `WebGLTextures`, `WebGLProperties` și `WebGLInfo` din three peste un context
  WebGL fals: de la 1 la 0 în contor și în context, și încă o dată într-un renderer nou, pe
  același LUT; cu `render()` aruncat după sanctuar, `dispose(scena)` îl găsește și într-un
  tablou de materiale. Controale: fără eliberare, 1; eliberat după `renderer.dispose()`, 1; același
  `render()` aruncat, cu `dispose()` fără scenă, 1;
- ordinea, pe sursa lui scena.js: `prinde` lipit de `render()`, înscrierea după cei șase care țin
  materiale și înaintea buclei, lista înaintea rendererului. Controale: înscris imediat după
  lumini (înaintea celor care țin materiale), fără înscrierea în listă, înscris fără scenă, cu
  `renderer.dispose()` înaintea listei, cu `prinde` înaintea lui `render()` — pe o scenă care
  desenează la cerere, un singur cadru nu l-ar mai prinde —, toate pică.

În pagină, pe build (`cabo-espichel-productie`), cu aceeași înfășurare. Panoul era ascuns, deci
`requestAnimationFrame` s-a înlocuit cu un temporizator de 16 ms: three îl cere din `self` la
fiecare cadru, deci bucla și `cadru()` rămân aceleași. Geometrii / texturi:

| calea | înainte de `dispose()` | după | v0.1.6, după |
|---|---|---|---|
| Satelit la pornire | 10 / 9 | 0 / 0, toate 9 șterse | 0 / 1 |
| comutat pe Relief | 14 / 9 | 0 / 0 | nemăsurat |
| preferința Relief | 14 / 3 | 0 / 0 | nemăsurat |
| context pierdut și refăcut | 10 / 9 | 0 / 0 | 0 / 1 |
| `laEsec`, trei excepții la rând în `zbor.pas` | 10 / 9 | 0 / 0 | nemăsurat |
| `laEsec`, `render()` care aruncă după ce a desenat, de la primul cadru | necitit / 9 | 0 / 0 | nemăsurat |
| 390 × 844 | 9 / 9 | 0 / 0 | nemăsurat |

Pe rândul al șaselea, `render()` s-a înfășurat înaintea primului cadru (cadrele, ținute într-o
coadă până atunci: `{ 0, 6 }`), deci `prinde` n-a rulat niciodată. În cele trei cadre, citit după
fiecare `render()`, contorul a ajuns la 9 texturi, cu LUT-ul urcat; geometriile de dinaintea
eliberării nu s-au citit. După `laEsec`, 0 / 0: LUT-ul l-a găsit căutarea din `dispose(scena)`.
Controlul acestui caz e cel din Node, cu `dispose()` fără scenă.

Rândurile 1 și 6 s-au refăcut pe build-ul final, mutat peste 0.1.7.02; celelalte s-au măsurat pe
build-ul de dinaintea căutării din `dispose(scena)` și a mutării, cu aceeași prindere după cadru.

Harta, privită pe desktop și la 390 px: neschimbată. Consola: 0 erori, 0 încălcări CSP.

**Ce rămâne, în afara contorului.** `WebGLState` face patru texturi goale de 1 × 1 — 2D, cub,
2D array, 3D (WebGLState.js:439-442) —, pe care three nu le șterge și nu le numără în
`info.memory`. Trăiesc cât contextul, pe care `dispose()` îl lasă viu intenționat (scena.js).
S-au văzut după un context refăcut, când se fac din nou. O repornire pe același canvas ar mai
adăuga patru; nu s-a reparat. Tot după un context refăcut, `dispose()` dă avertismente
`INVALID_OPERATION: delete: object does not belong to this context`, și pe v0.1.6. Cauza, citită
în cod: `onContextRestore` (WebGLRenderer.js) cheamă `initGLContext()`, care face module noi fără
să desprindă ascultătorii `dispose` ai celor vechi (de pildă `WebGLGeometries.js:55`). La
eliberare, aceștia șterg obiecte ale contextului pierdut. Reparația adaugă cel mult încă unul:
ascultătorul LUT-ului din `WebGLTextures`-ul vechi, pe care v0.1.6, care nu elibera LUT-ul, nu-l
declanșa (recenzia, într-o simulare în Node cu codul three; contoarele rămân corecte, scăderea
cade pe `WebGLInfo`-ul vechi). <!-- NEVERIFICAT: numărul avertismentelor, pe fiecare versiune -->
Nereparate.
