import * as THREE from 'three';
import { cereOrto, creeazaIncarcatorKtx2, cuCompresie, elibereazaKtx2, incarcaOrto, incarcaSidecarOrto, verificaTranscodorul } from './loaders.js';
import { ceataCer } from './mare.js';

// Vederea Satelit: ortofotoul DGT pe relieful LiDAR, ca vederea satelit a unei
// hărți. Comutabilă cu vederea Relief — terenul colorat din albedo —, iar pornită
// implicit.
//
// Fotografia e NEILUMINATĂ, ca în 3D Tiles de la Google: lumina e deja în ea,
// fotografiată. Pe un material luminat s-ar dubla umbrele, iar soarele scenei
// (244°) e aproape opus celui din zbor (94°). De aceea terenul și marea iau aici
// `MeshBasicMaterial`, fără tone mapping: octeții fotografiei ajung pe ecran așa
// cum sunt. Umbrele modelelor nu cad pe ea — fotografia le are deja, pe ale
// clădirilor adevărate.
//
// Soarele scenei trece însă pe al zborului: clădirile modelate, luminate, și cerul
// trebuie să arate aceeași oră ca fotografia de sub ele. La întoarcere se pune la
// loc DIN COPIE, nu recalculat: vederea Relief trebuie să iasă la octet ca înainte.
//
// Coordonatele texturii nu stau în geometrie: se calculează în shader din poziția
// vârfului, care e deja în metri de scenă (matricea plaselor e identitatea). Un
// atribut `uv` ar fi costat 16–33 MB pe cele 4 milioane de vârfuri.

export const VERSIUNE_ORTO = 'orto_v1';
const CHEIE_PREFERINTA = 'cabo-espichel:strat';
const PRELUCRARE_IMPREJURIMI = 'fotografia împrejurimilor, drapată pe relief în vederea Satelit';

// Texturile vin în două trepte (MB = 2^20 octeți). Prima: baza (3,88 MB) și împrejurimile,
// harta_v9 ca `<hartă>-orto_v1-mic`, aceeași cutie la 4 m pe texel (0,79 MB) — 6,10 MB în total.
// A doua, imediat după ce Satelit e pe ecran: întâi peticul (6,03 MB) — până sosește, plasa lui
// stă pe textura bazei, de 1 m pe texel, identică texel cu texel cu nivelul de 1 m al peticului —,
// apoi harta_v9 întreagă, de 2 m (3,09 MB). Satelit apare astfel după 6,10 MB, nu după 12,14
// (alegerea autorului, 2026-10-08): mai moale câteva secunde pe zona peticului — 29% din ecran
// pe desktop, 39% pe telefon, măsurat geometric de audit, nu în pixeli. Din vederea de pornire
// se vede din harta_v9 numai o fâșie la orizont, în spatele capului — ~1% din ecran pe desktop,
// 0,1% pe telefon, la 3–5 km. Schimbul ei se vede foarte puțin: din vederea de pornire, la
// 1600 × 900, 205 pixeli diferă cu peste 8 niveluri și 3 526 cu peste 2 (maximum 43). Cu 8 m
// pe texel (0,20 MB) ar fi fost 1 259 și 7 333 (maximum 61): la ~4 km un pixel are ~3,7 m,
// deci 8 m se vedeau mai moi. Lista e și în textura-imprejurimi (TEXTURA_MICA), care scrie
// fișierul mic.
export const IN_DOUA_TREPTE = new Set(['harta_v9']);

const citestePreferinta = () => { try { return localStorage.getItem(CHEIE_PREFERINTA); } catch { return null; } };
const scriePreferinta = (v) => { try { localStorage.setItem(CHEIE_PREFERINTA, v); } catch { /* stocare blocată: alegerea ține cât pagina */ } };

/** Numele texturii primei trepte a unui nivel al împrejurimilor. */
const numeTreaptaUnu = (nume) => `${nume}-${VERSIUNE_ORTO}${IN_DOUA_TREPTE.has(nume) ? '-mic' : ''}`;

/**
 * Cererile primei trepte — sidecarurile și fișierele, încărcătorul KTX2 și transcodorul —,
 * fără nicio verificare a preferinței. Întoarce un mâner: `preia()` le dă lui
 * `pregateste()`, care le judecă și eliberează încărcătorul; `abandoneaza()` oprește
 * texturile, iar încărcătorul nepreluat îl eliberează singur. Transcodorul pornit nu se mai
 * oprește: `init()` din r186 nu primește semnal. Fără transcodor (`verificaTranscodorul`), nu
 * pleacă nimic: `ktx2` respinge, iar `pregateste()` lasă Relief cu un avertisment.
 */
function cereTreaptaUnu({ renderer, numeBaza, imprejurimi = [] }) {
  const abandon = new AbortController();
  let refuz = null;
  try { verificaTranscodorul(); } catch (e) { refuz = e; }
  const ktx2 = refuz ? Promise.reject(refuz) : creeazaIncarcatorKtx2(renderer);
  ktx2.catch(() => {});   // tratarea adevărată e în `pregateste()`
  const nume = refuz ? [] : [`${numeBaza}-${VERSIUNE_ORTO}`, ...imprejurimi.map(numeTreaptaUnu)];
  const cereri = new Map(nume.map((n) => [n, cereOrto(n, abandon.signal)]));
  // Transcodorul (`init()`, ~0,6 MB) pleacă odată cu texturile, nu după prima sosită și
  // verificată — `parse()` trece prin aceeași promisiune, deci nu se cere de două ori —, dar
  // după sidecarul bazei: un deploy fără texturi nu-l mai descarcă degeaba. Sidecarul are
  // câțiva KB, fișierele megaocteți, deci transcodorul tot sosește înaintea lor.
  const metaBaza = cereri.get(nume[0])?.meta;
  if (metaBaza) Promise.all([ktx2, metaBaza]).then(([k]) => { if (!abandon.signal.aborted) k.init().catch(() => {}); }, () => {});
  let preluat = false;
  return {
    preia() { preluat = true; return { ktx2, cereri }; },
    abandoneaza() {
      abandon.abort();
      if (!preluat) { preluat = true; ktx2.then(elibereazaKtx2, () => {}); }
    },
  };
}

/**
 * Prima treaptă, cerută DEVREME: scena.js o pornește după ce au sosit datele pornirii și
 * înaintea construcției plaselor, nu după ea. Cere numai renderer-ul și numele. Construcția
 * ține firul principal ~0,3–0,5 s pe desktop, iar rețeaua stătea în timpul ei degeaba;
 * acum descărcarea curge cât se construiește. Materialele, compilarea și urcarea pe placă
 * rămân după construcție, în `creeazaSatelit`, abia după primul cadru.
 *
 * Nimic nu pleacă cu `?previzualizare` (`fortatRelief`) sau cu preferința Relief: atunci
 * nu se descarcă nimic până la primul clic, ca înainte.
 *
 * @returns {null | {preia: () => object, abandoneaza: () => void}}
 */
export function descarcaSatelit({ renderer, numeBaza, imprejurimi = [], fortatRelief = false }) {
  if (fortatRelief || citestePreferinta() === 'relief') return null;
  return cereTreaptaUnu({ renderer, numeBaza, imprejurimi });
}

/** Matricea care duce (x, z) de scenă în coordonatele texturii; v crește spre SUD. */
function matriceUV(meta, centru) {
  const b = meta.bbox_tm06, L = b.xMax - b.xMin, H = b.yMax - b.yMin;
  const x0 = b.xMin - centru.x, z0 = centru.y - b.yMax;
  return new THREE.Matrix3().set(1 / L, 0, -x0 / L, 0, 1 / H, -z0 / H, 0, 0, 1);
}

const UV_DIN_POZITIE = '#include <uv_vertex>\n\tvMapUv = ( mapTransform * vec3( position.xz, 1.0 ) ).xy;';

/**
 * Materialul mării în Satelit: în cutia texturii, fotografia (pe apă, amestecată deja cu
 * apa adâncă); în afara ei, culoarea apei adânci, `srgb`, măsurată pe aceeași fotografie.
 * Exportat pentru proba din Node (verifica-pagina), care îi citește `depthFunc`.
 */
export function materialMareSatelit(textura, srgb, cer) {
  const m = new THREE.MeshBasicMaterial({ map: textura, toneMapped: false });
  m.color.setRGB(...srgb.map((v) => v / 255), THREE.SRGBColorSpace);
  // Marea se desenează după teren (renderOrder pe obiect, mare.js); `Less` strict
  // lasă terenului egalitățile de adâncime, ca înainte de reordonare.
  m.depthFunc = THREE.LessDepth;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', UV_DIN_POZITIE);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
	vec4 texSat = texture2D( map, vMapUv );
	float inCutie = step( 0.0, vMapUv.x ) * step( vMapUv.x, 1.0 ) * step( 0.0, vMapUv.y ) * step( vMapUv.y, 1.0 );
	diffuseColor.rgb = mix( diffuse, texSat.rgb, inCutie );`);
    if (cer) ceataCer(sh, cer);
  };
  m.customProgramCacheKey = () => 'satelit-mare';
  return m;
}

/**
 * @param {{renderer: THREE.WebGLRenderer, scena: THREE.Scene, camera: THREE.Camera,
 *   teren: object, petic: object|null, mare: object, drapaj: THREE.Object3D[],
 *   soare: THREE.DirectionalLight, cer: object|null, umbre: object|null,
 *   centru: {x: number, y: number}, numeBaza: string, numePetic: string|null,
 *   gazda: HTMLElement, cereRandare: () => void, laSoareNou: () => void,
 *   laSursa: (sursa: object) => void, fortatRelief: boolean,
 *   imprejurimi?: {nume: string, obiect: THREE.Mesh}[],
 *   descarcare?: object|null, primulCadru?: Promise<void>}} o
 *   `imprejurimi`: plasele de dincolo de alpha, fiecare cu textura ei
 *   (`<hartă>-orto_v1`). Fără textură, plasa aceea rămâne pe culorile Relief.
 *   `descarcare`: prima treaptă, pornită devreme (`descarcaSatelit`); de aici încolo e a
 *   lui `creeazaSatelit`, care o oprește la `dispose()`. Fără ea, se cere la `pregateste()`.
 *   `primulCadru`: se rezolvă după primul cadru desenat; materialele și texturile urcă pe
 *   placă abia după el.
 */
export function creeazaSatelit(o) {
  const { renderer, scena, camera, teren, petic, mare, drapaj, soare, cer, umbre, centru, gazda, cereRandare } = o;
  const numeB = `${o.numeBaza}-${VERSIUNE_ORTO}`, numeP = o.numePetic ? `${o.numePetic}-${VERSIUNE_ORTO}` : null;
  let descarcare = o.descarcare ?? null;

  // ------------------------------------------------------------ butonul
  const radacina = document.createElement('div');
  radacina.id = 'straturi';
  radacina.hidden = true;
  const buton = document.createElement('button');
  buton.type = 'button';
  // Eticheta nu se schimbă: starea o spune `aria-pressed`, iar un buton comutator
  // care își schimbă și eticheta s-ar contrazice pentru un cititor de ecran.
  buton.textContent = 'Satelit';
  const TITLU = 'Fotografia aeriană pe relief (apăsat) sau relieful colorat după material';
  buton.title = TITLU;
  buton.setAttribute('aria-pressed', 'false');
  const anunt = document.createElement('span');
  anunt.className = 'anunt';
  anunt.setAttribute('aria-live', 'polite');
  radacina.append(buton, anunt);
  gazda.appendChild(radacina);

  // ------------------------------------------------------------ starea
  const originale = { teren: teren.obiect.material, petic: petic?.obiect.material, mare: mare.obiect.material };
  const imprejurimi = (o.imprejurimi ?? []).map((p) => ({ ...p, original: p.obiect.material, material: null }));
  const vizibilDrapaj = drapaj.map((d) => d.visible);
  const soareRelief = soare.position.clone();
  let soareZbor = null;
  let materiale = null;           // { teren, petic, mare }
  let texturi = [];
  let activ = false, viu = true, incarcare = null, treaptaDoua = null, faraCompresie = false;
  // `dispose()` îl oprește: cererile în zbor ale ambelor trepte se anulează, iar ce a
  // sosit deja nu se mai transcodează.
  const abandon = new AbortController();
  // Oprirea primei trepte în curs (`pregateste`): `dispose()`, sau omul care renunță la
  // Satelit cât se descarcă (`renunta`). null după ce texturile ei au trecut de ultima
  // așteptare: de acolo încolo se termină, dar nu se aplică.
  let oprireUnu = null;
  // Încărcătorul primei trepte, păstrat pentru a doua; pornește la prima aplicare a lui
  // Satelit (`aplica`), nu la sfârșitul primei: cine a renunțat între timp nu descarcă nici
  // peticul, nici harta_v9 întreagă.
  let incarcatorDoi = null;
  // O trecere pe Satelit în curs (`treciPeSatelit`): crește la fiecare pornire și renunțare,
  // deci o încărcare veche, încheiată după un clic, nu mai atinge butonul.
  let incercare = 0, inCurs = false;
  // Încărcarea oprită de o renunțare, încă neterminată: cea nouă o așteaptă întâi, ca
  // încărcătorul ei să fie eliberat înainte să pornească altul (`renunta`, `pregateste`).
  let incarcareOprita = null;
  // Prima treaptă s-a terminat: compilată, urcată pe placă, cu încărcătorul a doua pregătit.
  // `materiale` nu ajunge: ele există de dinaintea compilării, iar un clic aplicat atunci —
  // după o renunțare din aceeași fereastră — ar fi ocolit a doua treaptă pe toată sesiunea.
  let pregatit = false;

  /**
   * Contextul WebGL pierdut: se așteaptă refacerea lui, sau abandonul. `detectSupport` citește
   * extensiile plăcii, iar pe un context pierdut le dă pe toate lipsă.
   */
  const contextViu = (semnal) => {
    if (!renderer.getContext?.().isContextLost?.()) return null;
    return new Promise((res) => {
      const gata = () => {
        renderer.domElement.removeEventListener('webglcontextrestored', gata);
        semnal.removeEventListener('abort', gata);
        res();
      };
      renderer.domElement.addEventListener('webglcontextrestored', gata);
      semnal.addEventListener('abort', gata);
    });
  };

  /** Anizotropia și matricea UV, din cutia sidecarului. */
  const pregatesteTextura = (t, meta) => {
    t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    t.matrixAutoUpdate = false;
    t.matrix.copy(matriceUV(meta, centru));
    return t;
  };
  // Împrejurimile: un program al lor, cu ceața scenei pe culoarea cerului de pe
  // azimut, ca uscatul de la orizont să se topească în cer (vezi imprejurimi.js);
  // fiecare nivel cu textura și matricea lui.
  const imprejurimiM = (t) => {
    const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', UV_DIN_POZITIE);
      if (cer) ceataCer(sh, cer, { lege: 'scena' });
    };
    m.customProgramCacheKey = () => 'satelit-teren-imprejurimi';
    return m;
  };
  /**
   * Pe un GPU fără niciun format comprimat, KTX2 iese RGBA necomprimat: de patru ori cât
   * BC7 sau ASTC. Atunci o textură a împrejurimilor de 2 m pe texel pierde primul nivel de
   * mip — harta_v9 ar fi ocupat singură 35,7 MB, mai mult decât economisește peticul.
   */
  const faraPrimulMip = (t) => {
    const tx = t?.textura;
    if (!tx || tx.format !== THREE.RGBAFormat || !(t.meta.pas_m <= 2) || !(tx.mipmaps?.length > 1)) return;
    tx.mipmaps = tx.mipmaps.slice(1);
    tx.image = { width: tx.mipmaps[0].width, height: tx.mipmaps[0].height };
  };

  // Peticul n-are textură aici: plasa lui pornește pe a bazei, iar a doua treaptă îi pune
  // textura proprie în același material (`aduTexturileFine`).
  const construiesteMateriale = (b) => {
    const pregateste = pregatesteTextura;
    const tB = pregateste(b.textura, b.meta);
    texturi = [tB];
    // Falezele rămân fotografia. Pe un perete abrupt ea e întinsă — ortofotoul
    // privește drept în jos —, dar pe calcar dungile acelea arată ca stratele, iar
    // stânca pictată din regula de albedo ieșea uniformă și ternă. Măsurătoarea
    // (npm run masoara-faleza) și comparația sunt în CLAUDE.md; autorul a ales fotografia.
    //
    // Același program pentru bază și petic: diferă numai textura, iar r186 cheamă
    // onBeforeCompile pe fiecare material chiar când programul e refolosit.
    const terenM = (t) => {
      const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
      m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', UV_DIN_POZITIE); };
      m.customProgramCacheKey = () => 'satelit-teren';
      return m;
    };
    const mareM = materialMareSatelit(tB, b.meta.mare.srgb, cer);
    for (const p of imprejurimi) {
      if (!p.tex) continue;
      const t = pregateste(p.tex.textura, p.tex.meta);
      texturi.push(t);
      p.material = imprejurimiM(t);
    }
    return { teren: terenM(tB), petic: petic ? terenM(tB) : null, mare: mareM };
  };

  /**
   * După primul cadru desenat — sau pe loc, la abandon. Pe o legătură rapidă, sau din
   * cache, texturile pot sosi înaintea lui, iar urcarea lor pe placă nu trebuie să-l întârzie.
   */
  const dupaPrimulCadru = (semnal) => (!o.primulCadru ? null : new Promise((res) => {
    if (semnal.aborted) return res();
    const gata = () => { semnal.removeEventListener('abort', gata); res(); };
    semnal.addEventListener('abort', gata);
    o.primulCadru.then(gata);
  }));

  const aplica = (satelit) => {
    activ = satelit;
    teren.obiect.material = satelit ? materiale.teren : originale.teren;
    if (petic) petic.obiect.material = satelit ? materiale.petic : originale.petic;
    mare.obiect.material = satelit ? materiale.mare : originale.mare;
    for (const p of imprejurimi) p.obiect.material = satelit && p.material ? p.material : p.original;
    drapaj.forEach((d, i) => { d.visible = satelit ? false : vizibilDrapaj[i]; });
    soare.position.copy(satelit ? soareZbor : soareRelief);
    umbre?.potriveste();
    cer?.potriveste();
    o.laSoareNou?.();
    buton.setAttribute('aria-pressed', String(satelit));
    // A doua treaptă pleacă la prima aplicare: imediat după prima treaptă, ca înainte, dacă
    // nu s-a renunțat între timp; altfel abia când omul cere Satelit.
    if (satelit && incarcatorDoi) {
      const k = incarcatorDoi;
      incarcatorDoi = null;
      treaptaDoua = aduTexturileFine(k);
    }
    cereRandare();
  };

  /**
   * Descarcă, decodează și compilează — o singură dată. NU respinge: orice eroare,
   * și un import eșuat al încărcătorului (un chunk vechi după un deploy, rețeaua),
   * întoarce `false` cu un avertisment, iar pagina rămâne pe Relief.
   */
  const pregateste = () => {
    if (incarcare) return incarcare;
    incarcare = (async () => {
      if (!viu) return false;
      // Încărcătorul trece la a doua treaptă (`predat`), care îl eliberează ea: altfel
      // și-ar face altul, cu transcodorul cerut din nou și un worker nou.
      let ktx2 = null, predat = false, maner = null;
      // Semnalul primei trepte: `dispose()` (prin `abandon`) sau o renunțare (`renunta`).
      // Prin ascultător, nu cu `AbortSignal.any`, pe care Safari 15 și Firefox 115 nu-l au.
      const oprire = new AbortController(), laAbandon = () => oprire.abort();
      abandon.signal.addEventListener('abort', laAbandon, { once: true });
      oprireUnu = oprire;
      const semnal = oprire.signal;
      // O încercare oprită de o renunțare se termină întâi și își eliberează încărcătorul:
      // altfel, pe o rețea care oprește încet cererile, două ar trăi deodată, cu avertismentul
      // three „Multiple active KTX2 loaders”. Cât o așteaptă, și asta se poate opri.
      const oprita = incarcareOprita;
      incarcareOprita = null;
      try {
        if (oprita) await oprita;
        if (semnal.aborted) return false;
        // Cererile primei trepte: pornite devreme de scena.js sau, la primul clic cu
        // preferința Relief, acum. De aici încolo încărcătorul e al lui `pregateste()`.
        // Ținute și aici: o renunțare golește `descarcare`, ca un clic următor să ceară din nou.
        maner = (descarcare ??= cereTreaptaUnu({ renderer, numeBaza: o.numeBaza, imprejurimi: imprejurimi.map((q) => q.nume) }));
        const { ktx2: incarcator, cereri } = maner.preia();
        // Cererile pornite devreme pentru împrejurimi care n-au ajuns în scenă se opresc.
        const folosite = new Set([numeB, ...imprejurimi.map((q) => numeTreaptaUnu(q.nume))]);
        for (const [n, c] of cereri) if (!folosite.has(n)) c.opreste();
        ktx2 = await incarcator;
        // `detectSupport` a rulat la sosirea încărcătorului, poate pe un context pierdut chiar
        // atunci, la pornire: extensiile ieșeau toate lipsă, iar Satelit rămânea pe RGBA (~71 MB
        // pe placă), fără petic, toată sesiunea. Cu contextul viu, configurația se reface înaintea
        // primei transcodări: workerii o primesc abia când se creează.
        await contextViu(semnal);
        if (semnal.aborted) return false;
        if (!cuCompresie(ktx2.workerConfig)) ktx2.detectSupport(renderer);
        // Fără niciun format comprimat, peticul nici nu se mai cere (`cuCompresie`).
        faraCompresie = !cuCompresie(ktx2.workerConfig);
        const cere = (n) => incarcaOrto(n, ktx2, null, semnal, { cereri: cereri.get(n) });
        const [b, ...imp] = await Promise.all([cere(numeB), ...imprejurimi.map((q) => cere(numeTreaptaUnu(q.nume)))]);
        const elibereaza = () => { b?.textura.dispose(); for (const t of imp) t?.textura.dispose(); };
        if (!b || semnal.aborted) { elibereaza(); return false; }
        const s = b.meta.soare_zbor;
        if (!Number.isFinite(s?.azimut_grila) || !Number.isFinite(s?.elevatie) || !Array.isArray(b.meta.mare?.srgb)) {
          console.warn(`textura Satelit ${numeB}: sidecarul n-are soarele zborului sau marea`);
          elibereaza();
          return false;
        }
        // Un GPU fără niciun format comprimat primește RGBA necomprimat: de patru ori
        // cât BC7 sau ASTC. Atunci peticul rămâne pe textura bazei — nici nu se cere —, iar
        // împrejurimile de 2 m pe texel (harta_v6, harta_v9) pierd primul nivel de mip
        // (`faraPrimulMip`). Rămân ~67 MB, față de ~103 MB cu totul și ~34 MB comprimat.
        // Formatul bazei rămâne a doua plasă, după `workerConfig`: o textură viitoare cu alfa
        // sau cu laturi putere a lui 2, ori un tabel de formate schimbat în three.
        if (faraCompresie || b.textura.format === THREE.RGBAFormat) {
          faraCompresie = true;
          console.info('texturile Satelit ies necomprimate: peticul rămâne pe textura bazei, împrejurimile de 2 m merg la 4 m');
          for (const t of imp) faraPrimulMip(t);
        }
        const R = Math.PI / 180, d = soareRelief.length();
        soareZbor = new THREE.Vector3(
          d * Math.cos(s.elevatie * R) * Math.sin(s.azimut_grila * R),
          d * Math.sin(s.elevatie * R),
          -d * Math.cos(s.elevatie * R) * Math.cos(s.azimut_grila * R),
        );
        await dupaPrimulCadru(semnal);
        if (semnal.aborted) { elibereaza(); return false; }
        // Ultima așteptare a texturilor: de aici încolo prima treaptă se termină, iar o
        // renunțare doar n-o mai aplică.
        oprireUnu = null;
        imprejurimi.forEach((q, k) => { q.tex = imp[k]; });
        materiale = construiesteMateriale(b);
        // Shaderele și texturile ajung pe placă înainte de prima comutare, ca ea să nu
        // sacadeze. Pe plase-proxy, cu aceeași geometrie, nu pe cele vii: altfel un
        // cadru desenat cât ține compilarea ar arăta o stare amestecată.
        const proxy = new THREE.Group();
        proxy.add(new THREE.Mesh(teren.obiect.geometry, materiale.teren), new THREE.Mesh(mare.obiect.geometry, materiale.mare));
        if (petic) proxy.add(new THREE.Mesh(petic.obiect.geometry, materiale.petic));
        for (const q of imprejurimi) if (q.material) proxy.add(new THREE.Mesh(q.obiect.geometry, q.material));
        try { await renderer.compileAsync(proxy, camera, scena); } catch { /* se compilează la prima randare */ }
        for (const t of texturi) renderer.initTexture(t);
        if (!viu) return false;
        o.laSursa?.({ ...b.meta.sursa, prelucrare: 'fotografia aeriană, drapată pe relief în vederea Satelit' });
        for (const q of imprejurimi)
          for (const s of q.tex?.meta.surse ?? [])
            o.laSursa?.({ ...s, prelucrare: PRELUCRARE_IMPREJURIMI });
        // A doua treaptă pornește la prima aplicare (`aplica`), ca să nu împartă banda cu
        // prima. Workerii primei, cu memoria crescută de transcodarea bazei și a
        // împrejurimilor, se opresc; a doua își face unul singur, din transcodorul deja adus
        // (`workerPool` îl recreează la cerere, cu același `workerCreator`).
        ktx2.workerPool.dispose();
        ktx2.setWorkerLimit(1);
        predat = true;
        incarcatorDoi = ktx2;
        pregatit = true;
        return true;
      } catch (e) {
        console.warn('vederea Satelit nu se poate încărca:', e?.message ?? e);
        maner?.abandoneaza();   // cererile încă în zbor, dacă încărcătorul n-a venit
        return false;
      } finally {
        abandon.signal.removeEventListener('abort', laAbandon);
        if (oprireUnu === oprire) oprireUnu = null;
        if (!predat) elibereazaKtx2(ktx2);
      }
    })();
    return incarcare;
  };

  /**
   * Omul renunță la Satelit cât se încarcă: rămâne Relief. Ce mai e în drum din prima treaptă
   * se oprește — fără avertismente —, iar un clic următor o cere din nou, de la capăt. Dacă
   * texturile au trecut deja de ultima așteptare, se termină, dar nu se aplică, iar a doua
   * treaptă nu pleacă. Un clic următor, chiar în timpul compilării, așteaptă aceeași încărcare
   * (`pregatit` e încă fals) și aplică la capăt, cu a doua treaptă.
   */
  const renunta = () => {
    incercare++;
    inCurs = false;
    ocupat(false);
    buton.setAttribute('aria-pressed', 'false');
    if (oprireUnu) {
      oprireUnu.abort();
      oprireUnu = null;
      incarcareOprita = incarcare;
      incarcare = null;
      descarcare?.abandoneaza();
      descarcare = null;
    }
  };

  /** Starea de încărcare a butonului: `aria-busy`, roata și textul din CSS, anunțul. */
  const ocupat = (da) => {
    if (da) buton.setAttribute('aria-busy', 'true');
    else buton.removeAttribute('aria-busy');
    buton.title = da ? 'Se încarcă fotografia aeriană; un clic rămâne pe Relief' : TITLU;
    anunt.textContent = da ? 'Se încarcă fotografia aeriană…' : '';
  };

  /**
   * Încarcă și aplică Satelit. Cât se încarcă, butonul e apăsat — starea spre care merge — și
   * ocupat; un clic în timpul ăsta e o renunțare (`laClic`). `true` numai dacă Satelit a
   * ajuns pe ecran.
   */
  const treciPeSatelit = async () => {
    const id = ++incercare;
    inCurs = true;
    buton.setAttribute('aria-pressed', 'true');
    ocupat(true);
    const bun = await pregateste();
    if (!viu || id !== incercare) return false;   // eliberat, sau omul a renunțat între timp
    inCurs = false;
    ocupat(false);
    if (!bun) {
      // Pleacă butonul, nu rădăcina: un subarbore `hidden` iese din arborele de
      // accesibilitate, iar mesajul scris în el nu l-ar mai anunța nimeni.
      buton.hidden = true;
      anunt.textContent = 'Fotografia aeriană nu s-a putut încărca.';
      return false;
    }
    aplica(true);
    return true;
  };

  /**
   * Peticul, primul în a doua treaptă: textura lui ia locul celei a bazei în materialul
   * plasei lui — același program, numai `map` (cu matricea UV a cutiei lui) se schimbă. Pe
   * un GPU fără compresie nu se cere deloc: transcodat RGBA ar ocupa mai mult decât
   * economisește, iar plasa rămâne pe textura bazei. Dacă nu vine, rămâne tot așa.
   */
  const aduPeticul = async (ktx2) => {
    if (!numeP || !materiale?.petic || faraCompresie || !viu) return;
    const t = await incarcaOrto(numeP, ktx2, null, abandon.signal);
    if (!t) return;
    if (!viu) { t.textura.dispose(); return; }
    // A doua plasă, după `cuCompresie`: o placă pe care predicatul n-a prevăzut-o.
    if (t.textura.format === THREE.RGBAFormat) {
      console.info('textura peticului a ieșit necomprimată: peticul rămâne pe textura bazei');
      t.textura.dispose();
      return;
    }
    pregatesteTextura(t.textura, t.meta);
    renderer.initTexture(t.textura);
    // Textura bazei rămâne pe bază și pe mare; peticul o ADAUGĂ pe a lui, nu o înlocuiește.
    materiale.petic.map = t.textura;
    texturi.push(t.textura);
    cereRandare();
  };

  /**
   * A doua treaptă: întâi peticul (`aduPeticul`), apoi texturile fine ale împrejurimilor
   * (`IN_DOUA_TREPTE`). Textura întreagă ia locul celei mici în același
   * material — aceeași cutie, deci aceeași matrice UV; programul nu se schimbă. NU
   * respinge: dacă textura fină nu vine, rămâne cea mică, cu un avertisment. Dacă nici cea
   * mică n-a venit, materialul se face acum, cu cea fină. Primește încărcătorul primei
   * trepte și îl eliberează, pe orice cale.
   */
  const aduTexturileFine = async (ktx2) => {
    try {
      await aduPeticul(ktx2);
      // Fără compresie, textura întreagă ar pierde oricum primul mip (`faraPrimulMip`) și
      // ar ieși la 4 m, cât cea mică: n-ar aduce nimic în afară de 3,1 MB.
      const deAdus = imprejurimi.filter((q) => IN_DOUA_TREPTE.has(q.nume) && !(faraCompresie && q.tex?.meta.pas_m <= 4));
      for (const q of deAdus) {
        if (!viu) return;
        const t = await incarcaOrto(`${q.nume}-${VERSIUNE_ORTO}`, ktx2, null, abandon.signal);
        if (!t) continue;
        if (!viu) { t.textura.dispose(); return; }
        const b = t.meta.bbox_tm06, m = q.tex?.meta.bbox_tm06;
        if (m && (b.xMin !== m.xMin || b.xMax !== m.xMax || b.yMin !== m.yMin || b.yMax !== m.yMax)) {
          console.warn(`textura Satelit ${q.nume}: cea întreagă are altă cutie decât cea mică — rămâne cea mică`);
          t.textura.dispose();
          continue;
        }
        faraPrimulMip(t);
        pregatesteTextura(t.textura, t.meta);
        renderer.initTexture(t.textura);
        if (q.material) {
          const veche = q.material.map;
          q.material.map = t.textura;
          texturi = texturi.map((x) => (x === veche ? t.textura : x));
          veche.dispose();
        } else {
          q.material = imprejurimiM(t.textura);
          texturi.push(t.textura);
          try { await renderer.compileAsync(new THREE.Mesh(q.obiect.geometry, q.material), camera, scena); } catch { /* la prima randare */ }
          if (!viu) return;
          if (activ) q.obiect.material = q.material;
        }
        q.tex = t;
        // Pe calea de rezervă, fără textura mică, sursele n-au trecut încă prin laSursa;
        // altfel se rescrie numai textul modalei, cu aceleași surse.
        for (const s of t.meta.surse ?? []) o.laSursa?.({ ...s, prelucrare: PRELUCRARE_IMPREJURIMI });
        cereRandare();
      }
    } catch (e) {
      console.warn('texturile celei de-a doua trepte nu s-au putut încărca:', e?.message ?? e);
    } finally {
      elibereazaKtx2(ktx2);
    }
  };

  // Un clic cât se încarcă Satelit — pornit singur sau de un clic de dinainte — înseamnă
  // „rămân pe Relief”: fără asta, butonul arătat în timpul descărcării ar fi cerut tot Satelit.
  const laClic = () => {
    if (inCurs) {
      scriePreferinta('relief');
      renunta();
      return;
    }
    const tinta = !activ;
    scriePreferinta(tinta ? 'satelit' : 'relief');
    if (tinta && !pregatit) treciPeSatelit();
    else aplica(tinta);
  };
  buton.addEventListener('click', laClic);

  // ------------------------------------------------------------ pornirea
  // Cu `?previzualizare`, pagina arată datele culorii: Relief, fără buton.
  const gata = (async () => {
    if (o.fortatRelief) return false;
    if (citestePreferinta() === 'relief') {
      // Nu se descarcă nimic până la primul clic; se verifică doar că textura există.
      try { await incarcaSidecarOrto(numeB, abandon.signal); } catch (e) { if (viu) console.warn(`textura Satelit ${numeB}: ${e.message}`); return false; }
      if (viu) radacina.hidden = false;
      return false;
    }
    // Pornirea automată: butonul se vede de acum, ocupat, nu abia când Satelit e gata — omul
    // vede ce se încarcă și poate rămâne pe Relief înaintea celor ~6 MB. Pe un deploy fără
    // texturi apare și pleacă, cu anunțul eșecului.
    radacina.hidden = false;
    return treciPeSatelit();
  })();

  return {
    gata,
    get activ() { return activ; },
    /** A doua treaptă a texturilor (pentru probe): null până pornește. */
    get treaptaDoua() { return treaptaDoua; },
    /** Comută de mână (pentru probe); întoarce promisiunea încărcării, dacă trebuie. */
    async comuta(satelit) {
      if (satelit && !pregatit && !(await pregateste())) return false;
      aplica(satelit);
      return true;
    },
    dispose() {
      if (!viu) return;
      viu = false;
      abandon.abort();
      // Și cererile pornite devreme, încă nepreluate sau încă în zbor.
      descarcare?.abandoneaza();
      // Încărcătorul păstrat pentru a doua treaptă, dacă n-a mai plecat (s-a renunțat).
      elibereazaKtx2(incarcatorDoi);
      incarcatorDoi = null;
      buton.removeEventListener('click', laClic);
      if (activ) aplica(false);
      teren.obiect.material = originale.teren;
      if (petic) petic.obiect.material = originale.petic;
      mare.obiect.material = originale.mare;
      for (const q of imprejurimi) { q.obiect.material = q.original; q.material?.dispose(); q.material = null; q.tex = null; }
      if (materiale) for (const m of Object.values(materiale)) m?.dispose();
      for (const t of texturi) t.dispose();
      materiale = null; texturi = [];
      radacina.remove();
    },
  };
}
