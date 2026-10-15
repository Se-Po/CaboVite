# Vederea Satelit

Mutat cuvânt cu cuvânt din CLAUDE.md pe 2026-10-09. Măsurătorile, probele și istoricul
noi ale subsistemului se scriu aici, nu în CLAUDE.md.

## Vederea Satelit

Butonul „Satelit”, jos-stânga (pe telefon deasupra busolei), comută între
fotografia aeriană pe relief și vederea Relief — culorile din albedo (`docs/teren.md`, „Cum se colorează terenul”).
Pornește pe Satelit, iar harta apare abia cu fotografia întreagă pe placă — vezi „O singură
încărcare”, mai jos. Alegerea se ține în `localStorage`, în try/catch.

### Texturile: `npm run textura-ortofoto`

Scrie `public/data/<hartă>-orto_v2.ktx2` + `.json`, pentru bază și petic: `orto_v1` cu
acoperișurile fantomă retușate, din 0.1.7.07 (mai jos). `-- --fara-retus` face `orto_v1` și îl
compară cu cel publicat până atunci (db067f8): trebuie să iasă la octet; nu scrie în `public/data`.
Textura are versiune proprie: un retuș înseamnă alt
`_vN`, harta rămâne; pagina știe versiunea fiecărei hărți (`VERSIUNI_ORTO`, `numeOrto` din
satelit.js), iar împrejurimile au rămas pe `orto_v1`. Un nume publicat se rescrie numai
cu aceiași octeți (garda din `scripts/comun/publicat.mjs`, vezi `docs/livrarea.md`, „Cache-ul”). Cere KTX-Software 4.4
(`ktx`); scriptul îl caută și în `C:/Program Files/KTX-Software/bin` sau în
`KTX_BIN`, fiindcă un shell pornit înainte de instalare nu vede PATH-ul nou.

- **Geometria.** „Muchii de pixel”, cu marginile în TM06 în sidecar. Baza:
  2368 × 3008 la 1 m, colțul NV (−95792; −136402); peticul: 2176 × 2880 la 0,25 m,
  (−94823; −137295). Dimensiuni multipli de 64, deci toate cele 5 niveluri sunt
  multipli de 4, cât blocurile KTX2. Colțurile cad pe metri întregi unul față de
  altul, deci al treilea nivel al peticului (1 m) cade texel pe texel peste bază.
- **Culoarea.** Ortofotoul la 0,25 m, mutat cu deplasarea măsurată pe sol (+0,25 m
  spre est, `zbor.json`); toate mediile — baza, mipurile — în lumină LINIARĂ.
  Probă: nivelul de 1 m al peticului iese identic cu baza pe cei 266 162 de texeli
  de uscat comuni, **0 diferiți**; mutat cu 1 m, 264 797 diferă.
- **Pixelii fără date.** Pe marginea datelor, în colțul NV, media se face numai pe
  pixelii cu alfa ≥ 128. Înăuntru, banda alfa are pixeli izolați sub 128 —
  artefacte JPEG —, deci cu cel puțin jumătate de pixeli valizi media e pe toți.
  Uscatul bazei are date pe toți cei 3 092 832 de texeli.
- **Marea.** Apa adâncă, măsurată în OKLab pe benzi de 25 m de la mal: sRGB
  25, 54, 84. Fotografia se topește în ea între 25 și 50 m de la mal — de acolo
  încolo nicio bandă nu mai stă la ΔE 2 de apa adâncă —, iar pixelii fără date o
  primesc direct. Amestecul e copt în RGB, fără canal alfa: mipurile ar media
  altfel culoarea și ponderea separat. Planul mării din afara texturii are exact
  culoarea aceasta, deci marginea nu se vede.
- **Codarea.** UASTC, calitate 2, cu RDO și zstd 18 — aleasă de autor: 3,88 MiB baza
  și 6,03 MiB peticul (9,9 MiB), ΔE_OK×100 după decodare 0,25 / 0,52 (p99 1,42 /
  1,94). ETC1S ar fi dat 0,77 + 1,20 MiB, cu ΔE 1,32 / 1,34 (p99 5,8 / 6,6).
  `--threads 1` și `--uastc-rdo-m`: aceleași date dau același fișier, la octet;
  numai cu al doilea, peticul ieșea diferit de la o rulare la alta. Pe GPU, UASTC
  devine ASTC 4×4 pe telefon și BC7 pe desktop, un octet pe pixel: ~18 MB cu tot
  cu mipurile, nu ~71 MB cât ar ocupa necomprimat.

### În pagină: `src/scene/satelit.js`

- **Neiluminat**, ca 3D Tiles de la Google: `MeshBasicMaterial`, `toneMapped:
  false`, deci octeții fotografiei ajung pe ecran așa cum sunt. Lumina e deja în
  fotografie; pe un material luminat umbrele s-ar dubla, iar soarele scenei (244°)
  e aproape opus celui din zbor (94°). Umbrele modelelor nu cad pe teren în
  Satelit: fotografia le are deja, pe ale clădirilor adevărate.
- **Coordonatele texturii se calculează în shader**, din `position.xz` (matricea
  plaselor e identitatea): `vMapUv = mapTransform · (x, z, 1)`, cu `texture.matrix`
  scris din bbox. v crește spre SUD — KTX2 comprimat nu se întoarce la încărcare.
  Un atribut `uv` ar fi costat 23–46 MB (5 771 844 de vârfuri ale lui alpha, cu 4 sau 8 octeți
  pe vârf). Matricea o face `matriceUV(meta, centru)`, cu centrul bazei pentru orice textură.
  Proba ei, în `verifica-pagina` (din 0.1.7.05):
  - pe toate cele șase sidecare `*-orto_vN.json` (alpha pe `orto_v2`, împrejurimile pe
    `orto_v1`), centrul texelilor din colțuri și din mijloc, socotit după `conventie` (muchii de pixel, rândul 0 la nord), cu `latime` și
    `inaltime`, nu cu cutia, cade pe texelul lui (abatere 4,5·10⁻¹³ texeli);
  - controlul, cu v întors, iese la 3 007 texeli.
- **Soarele** trece pe al zborului (94,0° / 39,5°; poziția o dă `soareZborDin`, exportată și
  pentru verifica-cladiri), ca clădirile modelate și cerul să arate ora fotografiei; umbrele se reîncadrează (`umbre.potriveste()`), cerul
  își reface expunerea, ceața și fundalul iau noul orizont. Înapoi, soarele se pune
  DIN COPIE, nu recalculat.
- **Marea**, în cutia texturii, e fotografia; în afara ei, apa adâncă măsurată;
  ceața pe pixel rămâne (cu AgX inclus de mână: materialul nu e tone-mapped).
- Suprafețele sanctuarului de pe teren (drapajul) se ascund: fotografia le are.
- **Acoperișurile fantomă ale sanctuarului se retușează, din `orto_v2` (0.1.7.07).**
  - **Ce sunt:** ortofotoul nu e true-ortho. Acoperișul unei clădiri de h metri apare mutat
    cu h × înclinarea din `zbor.json`: 0,095 m/m spre 296,6° sub 9 m, 0,085 m/m spre 284°
    peste. Direcția o măsoară `masoara-zbor`, prin corelația acoperișurilor. Pagina desenează
    clădirea pe amprenta ei din LiDAR, deci pe solul din jur, spre vest-nord-vest, textura
    arăta perete și acoperiș.
  - **Ce nu se retușează:** farul, casele lui și Casa da Ronca (`cladiri_v1`). Stau în afara
    rastrului nMDS al sanctuarului, iar turnul farului cade oricum peste acoperișul casei lui,
    care e modelată.
  - **Masca** (`scripts/comun/fantome.mjs`):
    - fiecare pixel nMDS de 50 cm dintr-o amprentă a sanctuarului încărcat de pagină
      (corpurile, turnurile și cupolele din `SANCTUAR_URL`) își trage segmentul de la sol la
      acoperiș peste texeli;
    - masca e ce acoperă segmentele în afara amprentelor, lărgit cu un texel. Pe petic,
      lărgirea prinde marginea JPEG a acoperișului; pe bază, texelii de 1 m din jurul
      fantomei sunt pe jumătate clădire.
  - **Mărimea:** 236 m² pe petic (3 772 de texeli) și 1 174 m² pe bază. Din a doua, 610 m²
    cad în afara golului peticului (`gaura_scena`), unde pagina desenează baza: sub
    jumătatea de sud a sanctuarului și la est.
  - **Amprentele** intră în sidecar cu sha256 (`retus.amprente`). `verifica-sanctuar` cere ca
    ele să fie ale sanctuarului încărcat de pagină; controlul, un vârf mutat 1 mm, pică.
  - **Umplerea:** difuzie din solul din jur, în lumină liniară, cu 300 de treceri
    Gauss–Seidel în ordine fixă. Amprentele nu dau nimic. Două rulări dau aceiași octeți.
    Texelii fără niciun drum spre sol rămân fotografia: 27 pe bază și 32 pe petic, în curți
    închise între amprente și acoperite toate de mască.
  - **Probele**, în `textura-ortofoto` (`-- --numai-retus` se oprește după ele). Măsura e
    ΔE_OK×100 față de solul din jur, pe 4 texeli (1 m pe petic, 4 m pe bază; o alegere). Toate
    măsurile au aceeași referință de sol: tot ce nu e mască, mască opusă (aceleași clădiri,
    înclinarea întoarsă) sau amprentă. Cifrele sunt pentru petic / bază:
    - pe partea VNV a clădirilor, fotografia se depărtează de sol cu 8,26 / 15,90; pe partea
      ESE, martorul, cu 3,84 / 4,74. Asta nu dovedește direcția fantomei, fiindcă umbrele
      soarelui de 94° cad tot spre vest;
    - retușul scoate cel puțin 90% din excesul față de martor (o alegere): 106% / 96% pe
      partea exclusivă, 111% / 98% pe toată masca, cu inelul comun al celor două măști;
    - controlul, aceeași difuzie fără pereți, scoate −30% / 81% și pică;
    - în afara măștii, 0 texeli atinși; controlul, retușul pe masca opusă, atinge 1 748 /
      373;
    - pe 3 și pe 5 texeli verdictul rămâne (pe bază, la 5, 91%). Pe petic, la 3 m
      (12 texeli), referința amestecă umbra de la vest de clădiri cu solul însorit, iar
      măsura nu mai deosebește nimic;
    - nivelul de 1 m al peticului e tot identic cu baza, în afara celor 1 215 texeli
      retușați;
    - `--fara-retus` reface `orto_v1` de la db067f8, comparat ca blob git, la octet. `orto_v2`
      diferă de el.
  - **Turnul de nord:** fantoma lui, ~1,3 m la colțul de NV, cade pe sol, pe poteca dintre
    aripa de nord și navă. Fâșia întunecată de acolo e umbra turnului, nu un acoperiș.
    Retușul înlocuiește fâșia de zid cu solul umbrit de lângă ea.
- **Falezele rămân fotografia.** `npm run masoara-faleza` a măsurat, pe plasa
  paginii, cât detaliu are fotografia pe metrul de SUPRAFAȚĂ, pe clase de pantă:
  sub 50% din cel de pe terenul plat de la 46,6° încolo, 17% la 70–75°, 2% la
  85–90°. Stânca pictată de acolo încolo din regula de albedo, luminată cu soarele
  zborului (α 1,26, β 0,29, potriviți pe stânca de 30–70°; R² 0,33 la antrenare, 0,29
  pe fațetele ținute deoparte; soarele zborului o potrivește mai bine decât cel Relief, ΔE 10,3
  față de 11,8), ieșea însă uniformă și ternă, iar numai pe pereții de 70–85°, în
  dungi. Fotografia întinsă arată, pe calcar, ca stratele: autorul a ales-o. Scriptul
  rămâne, ca măsurătoare, nefolosit de pagină.
- **Încărcarea.** `creeazaIncarcatorKtx2` importă KTX2Loader dinamic — `loaders.js`
  e importat și de uneltele Node. Transcodorul NU se copiază în `public/`:
  KTX2Loader din r186 îl găsește cu `new URL(…, import.meta.url)`, iar Vite îl emite
  la build; cu `setTranscoderPath('/basis/')` s-ar fi livrat de două ori (585 KB).
  `incarcaOrto()` nu aruncă și verifică mărimea, sha256 (înainte de `parse`, care
  mută bufferul în worker) și antetul KTX2. Fără `crypto.subtle` — un telefon pe
  `http://192.168…`, la serverul de dezvoltare — se sare numai sha256. Shaderele
  Satelit se compilează cu `compileAsync` pe plase-proxy cu aceeași geometrie, nu pe
  cele vii (un cadru desenat între timp ar fi arătat o stare amestecată), iar
  texturile urcă pe placă cu `initTexture`, înainte de prima comutare. Baza și
  peticul împart un program. Pe un GPU fără niciun format comprimat transcodarea ar
  da RGBA (~71 MB): cererea peticului, pornită devreme, se oprește înaintea primei transcodări
  (`cuCompresie`, din `workerConfig`), iar plasa lui rămâne pe textura bazei;
  formatul bazei rămâne a doua plasă. `pregateste()` nu respinge —
  un import eșuat al încărcătorului, după un deploy, lasă Relief și un avertisment,
  nu un buton blocat. Cu preferința Relief nu se descarcă nimic până la primul
  clic; butonul are `aria-busy` cât se încarcă. `?previzualizare` forțează Relief,
  fără buton. Crearea e în `try`, ca la cer și la umbre.
  Recenzia three.js a găsit exact aceste șase lucruri; sunt reparate.
- **O singură încărcare** (2026-10-08, la cererea autorului: harta o singură dată, direct pe
  Satelit, cu tot la detaliul întreg). `descarcaSatelit`, chemată de scena.js după TOATE datele
  pornirii și înaintea construcției plaselor, cere deodată cele șase texturi întregi — baza,
  peticul și cele patru împrejurimi, 14,44 MiB (15 138 749 de octeți). Sidecarul și
  fișierul pleacă deodată (`cereOrto`); transcodorul, după sidecarul bazei, deci un deploy fără
  texturi nu-l descarcă. Pornit, nu se mai poate opri: `init()` din r186 nu primește semnal. Un
  încărcător eliberat cu transcodorul în drum îi revocă URL-ul workerului la sosire
  (`elibereazaKtx2`); `dispose()` singur îl lăsa, ~60 KB, cât trăiește pagina. `detectSupport`
  rulează la sosirea încărcătorului: pe un context pierdut atunci ieșea RGBA, fără petic, toată
  sesiunea, deci `pregateste()` așteaptă refacerea contextului și reface configurația înaintea
  primei transcodări. Urmează materialele, compilarea pe proxy, `initTexture` și eliberarea
  încărcătorului. Construcția rămâne pe firul principal (decizia autorului: fără workeri).
  După `compileAsync`, numai pe calea automată (`satelit.automat`: fără `?previzualizare`, fără
  preferința Relief, fără ieșirea dată înainte), scena.js cheamă `laIncarcare({ faza:
  'fotografie' })` și așteaptă `asteaptaSatelitul(gata, faraSatelit)` — o cursă care nu respinge
  și își scoate ascultătorul —, abia apoi bucla. Primul cadru e deci Satelit, cu tot. Un eșec
  arată harta pe Relief, fără butonul Satelit; „Fotografia aeriană nu s-a putut încărca.” e numai
  pentru cititorul de ecran. Scris cât panourile erau ascunse, anunțul nu ajungea la nimeni:
  regiunea live era în afara arborelui de accesibilitate, iar la apariție textul deja prezent nu
  se anunță (recenzia, măsurat în Edge cu evenimentele de accesibilitate). La fel primul anunț
  al busolei. Acum main.js cheamă `scena.arata()` după `data-scena`, iar după două cadre ale
  paginii busola și Satelit își golesc anunțul și îl scriu din nou (`reanunta`)
  <!-- NEVERIFICAT: cu un cititor de ecran adevărat -->.
  - **Baza căzută oprește tot, pe loc** — fișierul lipsă sau stricat, sidecarul fără soarele
    zborului și fără mare (`areSoareSiMare`): `garda.abandoneaza()` oprește cererile, citirile și
    încărcarea. Înainte, celelalte cinci texturi se descărcau și se transcodau degeaba, cu harta
    ținută pe mesaj: recenzia a măsurat 66 s pe o legătură lentă, pentru un eșec știut de la 0 s.
  - **Procentul:** suma lui `octeti` din sidecarurile de încărcat, luată după ce s-au așezat
    toate (să nu sară pe un total parțial), și octeții din `laOcteti`, pe fiecare bucată
    (`citesteOcteti`). `laProgres` se cheamă numai când crește procentul întreg, de la 0 la 1.
  - **Garda fotografiei**, aceeași `creeazaGardaPornirii`, cu ceasul ei: 20 s fără niciun octet
    pe nicio cerere Satelit le opresc pe toate, iar `gata` iese `false`, cu un `console.warn`. Se
    oprește când fiecare textură și-a citit fișierul și are transcodorul (`laDescarcat`):
    transcodarea rămâne pe limita ei de 30 s. Importul încărcătorului și încercarea veche se
    așteaptă prin `panaLa`, deci nici un import agățat nu ține `gata` pe vecie.
  - **Ieșirea**, `faraSatelit`: cât se încarcă, o renunțare fără preferință; înaintea creării,
    cererile devreme se opresc. Butonul rămâne vizibil, neapăsat și liber.

  Măsurat pe build, cu fila în față (916 × 914, DPR 1): la `data-scena`, în 5 din 5 încărcări,
  `frame` 0, Satelit activ, peticul pe 2176 de texeli, `harta_v9` pe 2432; primul cadru e Satelit.
  Mediane, `data-scena` / primul cadru: 705 / 768 ms pe `cabo-espichel-productie` (cache cu
  revalidare), 701 / 766 ms pe `cabo-espichel-csp-impus` (0 încălcări), 684 / 754 ms fără cache,
  pe loopback. Cu preferința Relief, harta la ~400 ms, fără nicio cerere `.ktx2`. Cu `.ktx2` la
  500 KB/s pe cerere (server de probă): procentul urcă de la 1% (416 ms) la 100% (13 202 ms), harta
  apare la 13 359 ms, pe Satelit; „Arată relieful acum” la 75% o arată după 2 ms, pe Relief, cu
  cererile bazei și peticului oprite și preferința neatinsă; Satelit cerut apoi din buton se aplică
  după 13,3 s, fără avertisment. Pe un telefon prima imagine vine abia după 14,44 MiB: ~13,5 s la
  9 Mbit/s <!-- NEVERIFICAT: calculat; telefon și rețea mobilă nemăsurate -->.

  `npm run verifica-pagina`, cu fișierele adevărate, un `fetch` fals și ceasul virtual: 6 din 6
  `.ktx2` cerute înaintea construcției, 0 `-mic`; la `gata` peticul pe `harta_v5-orto_v2`,
  `harta_v9` la 2432 de texeli, 14,44 MiB transcodate; cu baza sosită singură procentul e 0,26 =
  ⌊100 × 4 069 741 / 15 138 749⌋ / 100, iar 1 vine o dată, înaintea compilării; baza tăcută după
  1 KB e în așteptare la 19,999 s și `false` la 20 s, cu un avertisment și 0 temporizatoare, dar o
  bază în 10 bucăți la 15 s și o transcodare de 25 s după ultimul octet trec; ieșirea în descărcare
  oprește 6 din 6, cu preferința neatinsă, iar un clic apoi aplică tot; fără compresie peticul e
  oprit și `harta_v9` la 1216 (4 m); `cuCompresie` față de `getTranscoderFormat`, 0 nepotriviri pe
  96 de configurații × 6 texturi. Pe sursă, ordinea din scena.js: date → garda oprită →
  `descarcaSatelit` cu peticul → `creeazaTeren` → `creeazaSatelit` → `compileAsync` → faza și
  așteptarea, numai pe calea automată → bucla. Controale: satelit.js de la `30a22c9` (2 cereri
  `-mic`, `harta_v9` la 1216; fără gardă și fără `faraSatelit`, tot în așteptare după 300 s);
  mutațiile de azi (fără `laOcteti` procentul rămâne 0; garda nerearmată pierde baza lentă, cea
  oprită numai în `finally` transcodarea de 25 s; fără `panaLa`, un import agățat ține 300 s);
  scena.js de la `30a22c9` și așteptarea mutată după buclă; `Promise.race` simplu (1 ascultător
  rămas); „oricare format” (6 nepotriviri: PVRTC cere laturi putere a lui 2). Controalele de la
  `30a22c9` cer varianta mică: o primesc din git (`DIN_ISTORIC`), altfel ar pica din alt motiv.
  Din recenzie: baza cu 404, cu celelalte cinci lente, dă `false` la 0 s, cu 5 din 5 cereri oprite și
  0 transcodate (control, fără oprire: 66 s și 5 transcodate); `reanunta` golește anunțul eșecului și
  îl scrie din nou la +150 ms, busola la +600 ms, iar `arata()` le cheamă la al doilea cadru (controale:
  fără golire, 0 schimbări; chemate pe loc; main.js fără `arata`). Textul citit din `src/` se aduce la
  LF, iar o mutație care nu se aplică pică singură: probele trec și pe o clonă LF, și pe una CRLF.
  Fiecare caz își numără numai încărcătoarele lui: o probă pica în ~1 din 3 rulări, din cauza unui
  control pe codul vechi care se elibera în cazul următor; acum 20 de rulări la rând, 0 eșecuri.
- **Butonul.** La pornire nu se vede: panourile apar odată cu harta. Cât se încarcă după un clic,
  e apăsat (starea spre care merge), `aria-busy`, cu roata în locul bifei și „se încarcă…” pe al
  doilea rând (din CSS, `/ ""`, deci nu intră în nume acolo unde browserul știe forma: Chrome 77+,
  Firefox 128+, Safari 17.4+; pe Firefox 115 ESR numele devine „Satelit se încarcă…”), fără
  estompare; anunțul e pentru cititoarele de ecran <!-- NEVERIFICAT: fără cititoare de ecran -->.
  Un clic atunci înseamnă „rămân pe Relief” (`renunta`): preferința `relief`, cererile oprite, iar
  un clic următor le cere de la capăt; după ultima așteptare a texturilor încărcarea se termină,
  dar nu se aplică. Un eșec scoate butonul, cu anunțul; cu preferința Relief, butonul apare după
  sidecar. Un dublu-clic cu compilarea încă în curs aplica Satelit pe jumătate (recenzia): acum
  decide `pregatit`, pus abia la capătul încărcării. O încercare nouă o așteaptă întâi pe cea
  oprită (`incarcareOprita`): pornit–oprit–pornit dădea avertismentul three „Multiple active KTX2
  loaders”. `verifica-pagina`, pe calea Relief → clic: al doilea clic rămâne pe Relief, cu 6 din 6
  cereri oprite, al treilea aplică; renunțarea cu compilarea în curs, apoi un clic, aplică pe loc,
  cu 0 cereri noi; pe o rețea care oprește încet cererile, cel mult un încărcător viu, iar un al
  patrulea clic oprește încercarea nouă fără nicio cerere; baza 404 scoate butonul. Control,
  satelit.js de la `30a22c9`: al doilea clic în descărcare aplică Satelit și scrie `satelit`.
- **Transcodorul care nu pornește.** Workerul Basis cere WebAssembly și `new Function`
  (embind). Fără ele — un CSP fără `'unsafe-eval'`, WebAssembly oprit de un mod de
  securitate — workerul se agață tăcut: își așteaptă transcodorul la nesfârșit,
  WorkerPool nu ascultă `error`, iar `parse()` nu mai cheamă nimic. Satelit rămânea
  atunci fără buton și fără avertisment, cu preferința Relief un buton `aria-busy` pe
  vecie, iar `dispose()` nu mai oprea workerii. Acum, două gărzi:
  - `creeazaIncarcatorKtx2` încearcă întâi, în firul principal, un modul WASM gol și
    `new Function('')` (`verificaTranscodorul`): un worker din `blob:` moștenește
    CSP-ul documentului. Dacă una cade, aruncă, iar `pregateste()` lasă Relief cu un
    avertisment, înaintea oricărei descărcări;
  - `incarcaOrto` așteaptă întâi `ktx2.init()` — aceeași promisiune pe care o cheamă
    `parse()`, deci transcodorul nu se cere de două ori —, apoi pune pe `parse()` o
    limită, `LIMITA_TRANSCODARE_MS` = 30 s, numărată numai cât pagina e vizibilă: pe
    telefon o filă ascunsă poate fi înghețată cu workeri cu tot, iar la întoarcere
    temporizatorul ar suna primul <!-- NEVERIFICAT: dedus, nemăsurat pe un telefon -->.
    Un termen atins de o ascundere pornește din nou, întreg. Descărcările nu intră în
    limită: pe o legătură lentă ar fi oprit încărcări bune. Trecută, `null` cu un
    avertisment; un abandon (`dispose()`), `null` pe loc, fără avertisment.
  Pe desktop (Chrome, 20 de fire) cele șapte texturi de atunci, cu varianta mică, trec
  printr-un singur worker, cu pornirea lui, în 0,40 s (BC7) și 0,29 s (RGBA); cu patru, 0,21 s. Pe
  telefon limita lasă o margine de cel puțin patru ori dacă el e de 10–20 de ori mai
  lent <!-- NEVERIFICAT: nemăsurat pe un telefon -->. `init()` e public în r186, dar
  marcat „TODO: Make this method private”: `npm run verifica-pagina` pică dacă dispare
  sau dacă `parse()` nu mai trece prin el. Un `worker-src` care oprește `blob:` sau un
  worker mort din alt motiv nu se văd dinainte; pe acelea le prinde numai limita.
  Proba, `npm run verifica-pagina`, cu un încărcător fals și un ceas virtual: un
  `parse()` tăcut e încă în așteptare la 29 999 ms și `null` la 30 000, cu un
  avertisment; abandonul în timpul transcodării sau al descărcării transcodorului dă
  `null` pe loc; transcodorul sosit după 60 s, cu transcodarea de 0,1 s, dă textura;
  pagina ascunsă de la 10 la 40 s, cu transcodarea gata la 50 s, la fel. Controalele:
  fără limită, tot în așteptare după 300 s; descărcarea transcodorului pusă în limită
  pierde textura; fără semnalul de vizibilitate, pagina ascunsă dă `null`. Pe
  `loaders.js` de dinainte pică 9 probe din 18.

Probele, în pagină (panoul Browser):
- **Relief rămâne la octet:** trei vederi 640 × 400 în țintă fixă, înainte de orice
  comutare și după Relief → Satelit → Relief: **0 pixeli diferiți** în toate trei.
  Control: cu soarele lăsat pe al zborului, ~255 000 diferă pe fiecare;
- **înregistrarea:** vedere ortografică de sus, 0,25 m pe pixel, pe două ferestre de
  platou din petic, fotografia față de culorile Relief NEILUMINATE (NDVI-ul vine din
  aceeași fotografie): maximul corelației (0,86 / 0,83) la (−0,25; 0) m — exact
  deplasarea pe sol aplicată fotografiei și nu și NDVI-ului. Control: textura mutată
  cu 2 m mută maximul cu exact 8 pixeli. Cu culorile Relief LUMINATE maximul ieșea
  la 1 m: umbrirea mută aparent formele pe pante;
- **culoarea:** ferestrele de referință din sidecar (terreiro, platoul de lângă far,
  versantul de nord) ies în pagină cu aceiași octeți, ΔE 0; textura citită fără sRGB
  ar da 2,72 pe terreiro. Marea din larg, privită de la 2 m, iese 25, 54, 84;
- **resursele:** zece comutări lasă programele (11) și texturile (9: cele șase hărți orto — baza, peticul,
  `harta_v6`, `harta_v9`, `harta_v7`, `harta_v8` —, culoarea și adâncimea hărții de umbre,
  `DFG_LUT`) neschimbate;
  după `dispose()`, 0 geometrii și o singură textură — `DFG_LUT`, tabelul de 16 × 16
  pe care three îl ține global pentru materialele PBR, și fără Satelit;
- **căile de eșec:** sidecar lipsă (Vite dă index.html), KTX2 trunchiat, un octet
  schimbat, HTTP 404, rețea căzută — fiecare `null` cu un singur avertisment;
- **transcodorul care nu răspunde** (2026-10-08), cu preferința Relief și workerii
  înlocuiți cu unii care nu răspund niciodată: după clic, la 30,1 s butonul pleacă,
  `aria-busy` se scoate, anunțul spune „Fotografia aeriană nu s-a putut încărca.”,
  câte un avertisment pe fiecare din cele șase texturi, 4 workeri porniți și 4 opriți,
  3 texturi pe placă, cât Relief. `dispose()` cu cei 4 workeri agățați îi oprește în
  7 ms, fără avertisment. Controlul, cu `loaders.js` de dinainte: la 36 s butonul
  e tot `aria-busy`, cu „Se încarcă fotografia aeriană…”, niciun avertisment, iar la
  5 s după `dispose()` 0 workeri opriți din 4. Cu un CSP pus prin `<meta>`: fără
  `'unsafe-eval'`, clicul eșuează în 11 ms pe WebAssembly, iar numai cu
  `'wasm-unsafe-eval'`, tot în 11 ms, pe `new Function`, amândouă fără niciun octet
  de textură sau de transcodor descărcat. Ocolind verificarea, workerul adevărat sub
  al doilea CSP aruncă `EvalError` numai în consolă, fără eveniment `error`, iar
  `incarcaOrto` cu limita de 3 s întoarce `null` la 3,01 s;
- la 390 px butonul nu atinge busola, panoul punctului — minimizat sau deschis pe
  o clădire —, rândul cu sursele sau eticheta; la fel la 320, 700, 1440 și
  844 × 390 (2026-09-30);
  build-ul de producție încarcă Satelit cu transcodorul din `/assets/`.

