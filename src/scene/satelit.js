import * as THREE from 'three';
import { creeazaIncarcatorKtx2, incarcaOrto, incarcaSidecarOrto } from './loaders.js';
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

// Împrejurimile încărcate în două trepte: întâi `<hartă>-orto_v1-mic`, aceeași cutie la 4 m
// pe texel (0,79 MB), odată cu restul; textura întreagă, de 2 m (3,1 MB), imediat după ce
// Satelit e pe ecran. Din vederea de pornire se vede din harta_v9 numai o fâșie la orizont,
// în spatele capului — ~1% din ecran pe desktop, 0,1% pe telefon, la 3–5 km. Satelit apare
// astfel după ~12,1 MB, nu după 14,4. Schimbul se vede foarte puțin: din vederea de pornire,
// la 1600 × 900, 205 pixeli diferă cu peste 8 niveluri și 3 526 cu peste 2 (maximum 43). Cu
// 8 m pe texel (0,20 MB) ar fi fost 1 259 și 7 333 (maximum 61): la ~4 km un pixel are ~3,7 m,
// deci 8 m se vedeau mai moi. Lista e și în textura-imprejurimi (TEXTURA_MICA), care scrie
// fișierul mic.
export const IN_DOUA_TREPTE = new Set(['harta_v9']);

const citestePreferinta = () => { try { return localStorage.getItem(CHEIE_PREFERINTA); } catch { return null; } };
const scriePreferinta = (v) => { try { localStorage.setItem(CHEIE_PREFERINTA, v); } catch { /* stocare blocată: alegerea ține cât pagina */ } };

/** Matricea care duce (x, z) de scenă în coordonatele texturii; v crește spre SUD. */
function matriceUV(meta, centru) {
  const b = meta.bbox_tm06, L = b.xMax - b.xMin, H = b.yMax - b.yMin;
  const x0 = b.xMin - centru.x, z0 = centru.y - b.yMax;
  return new THREE.Matrix3().set(1 / L, 0, -x0 / L, 0, 1 / H, -z0 / H, 0, 0, 1);
}

const UV_DIN_POZITIE = '#include <uv_vertex>\n\tvMapUv = ( mapTransform * vec3( position.xz, 1.0 ) ).xy;';

/**
 * @param {{renderer: THREE.WebGLRenderer, scena: THREE.Scene, camera: THREE.Camera,
 *   teren: object, petic: object|null, mare: object, drapaj: THREE.Object3D[],
 *   soare: THREE.DirectionalLight, cer: object|null, umbre: object|null,
 *   centru: {x: number, y: number}, numeBaza: string, numePetic: string|null,
 *   gazda: HTMLElement, cereRandare: () => void, laSoareNou: () => void,
 *   laSursa: (sursa: object) => void, fortatRelief: boolean,
 *   imprejurimi?: {nume: string, obiect: THREE.Mesh}[]}} o
 *   `imprejurimi`: plasele de dincolo de alpha, fiecare cu textura ei
 *   (`<hartă>-orto_v1`). Fără textură, plasa aceea rămâne pe culorile Relief.
 */
export function creeazaSatelit(o) {
  const { renderer, scena, camera, teren, petic, mare, drapaj, soare, cer, umbre, centru, gazda, cereRandare } = o;
  const numeB = `${o.numeBaza}-${VERSIUNE_ORTO}`, numeP = o.numePetic ? `${o.numePetic}-${VERSIUNE_ORTO}` : null;

  // ------------------------------------------------------------ butonul
  const radacina = document.createElement('div');
  radacina.id = 'straturi';
  radacina.hidden = true;
  const buton = document.createElement('button');
  buton.type = 'button';
  // Eticheta nu se schimbă: starea o spune `aria-pressed`, iar un buton comutator
  // care își schimbă și eticheta s-ar contrazice pentru un cititor de ecran.
  buton.textContent = 'Satelit';
  buton.title = 'Fotografia aeriană pe relief (apăsat) sau relieful colorat după material';
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

  const construiesteMateriale = (b, p) => {
    const pregateste = pregatesteTextura;
    const tB = pregateste(b.textura, b.meta), tP = p ? pregateste(p.textura, p.meta) : null;
    texturi = [tB, ...(tP ? [tP] : [])];
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
    // Marea: în cutia texturii, fotografia (pe apă, amestecată deja cu apa adâncă);
    // în afara ei, culoarea apei adânci, măsurată pe aceeași fotografie.
    const mareM = new THREE.MeshBasicMaterial({ map: tB, toneMapped: false });
    mareM.color.setRGB(...b.meta.mare.srgb.map((v) => v / 255), THREE.SRGBColorSpace);
    mareM.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', UV_DIN_POZITIE);
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
	vec4 texSat = texture2D( map, vMapUv );
	float inCutie = step( 0.0, vMapUv.x ) * step( vMapUv.x, 1.0 ) * step( 0.0, vMapUv.y ) * step( vMapUv.y, 1.0 );
	diffuseColor.rgb = mix( diffuse, texSat.rgb, inCutie );`);
      if (cer) ceataCer(sh, cer);
    };
    mareM.customProgramCacheKey = () => 'satelit-mare';
    for (const p of imprejurimi) {
      if (!p.tex) continue;
      const t = pregateste(p.tex.textura, p.tex.meta);
      texturi.push(t);
      p.material = imprejurimiM(t);
    }
    return { teren: terenM(tB), petic: petic ? terenM(tP ?? tB) : null, mare: mareM };
  };

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
      // Încărcătorul trece la a doua treaptă (`predat`), care îl eliberează ea: altfel
      // și-ar face altul, cu transcodorul cerut din nou și un worker nou.
      let ktx2 = null, predat = false;
      const semnal = abandon.signal;
      try {
        ktx2 = await creeazaIncarcatorKtx2(renderer);
        const [b, p, ...imp] = await Promise.all([
          incarcaOrto(numeB, ktx2, null, semnal), numeP ? incarcaOrto(numeP, ktx2, null, semnal) : null,
          ...imprejurimi.map((q) => incarcaOrto(`${q.nume}-${VERSIUNE_ORTO}${IN_DOUA_TREPTE.has(q.nume) ? '-mic' : ''}`, ktx2, null, semnal)),
        ]);
        const elibereaza = () => { b?.textura.dispose(); p?.textura.dispose(); for (const t of imp) t?.textura.dispose(); };
        if (!b || !viu) { elibereaza(); return false; }
        imprejurimi.forEach((q, k) => { q.tex = imp[k]; });
        const s = b.meta.soare_zbor;
        if (!Number.isFinite(s?.azimut_grila) || !Number.isFinite(s?.elevatie) || !Array.isArray(b.meta.mare?.srgb)) {
          console.warn(`textura Satelit ${numeB}: sidecarul n-are soarele zborului sau marea`);
          elibereaza();
          return false;
        }
        // Un GPU fără niciun format comprimat primește RGBA necomprimat: de patru ori
        // cât BC7 sau ASTC. Atunci peticul folosește textura bazei, iar împrejurimile de
        // 2 m pe texel (harta_v6, harta_v9) pierd primul nivel de mip (`faraPrimulMip`).
        // Rămân ~67 MB, față de ~103 MB cu totul și ~34 MB comprimat.
        let pp = p;
        if (b.textura.format === THREE.RGBAFormat) {
          faraCompresie = true;
          console.info('texturile Satelit au ieșit necomprimate: peticul folosește textura bazei, împrejurimile de 2 m merg la 4 m');
          if (p) { p.textura.dispose(); pp = null; }
          for (const t of imp) faraPrimulMip(t);
        }
        const R = Math.PI / 180, d = soareRelief.length();
        soareZbor = new THREE.Vector3(
          d * Math.cos(s.elevatie * R) * Math.sin(s.azimut_grila * R),
          d * Math.sin(s.elevatie * R),
          -d * Math.cos(s.elevatie * R) * Math.cos(s.azimut_grila * R),
        );
        materiale = construiesteMateriale(b, pp);
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
        // A doua treaptă pornește abia acum, ca să nu împartă banda cu prima. Workerii
        // primei, cu memoria crescută de transcodarea bazei și a peticului, se opresc;
        // a doua își face unul singur, din transcodorul deja adus (`workerPool` îl
        // recreează la cerere, cu același `workerCreator`).
        ktx2.workerPool.dispose();
        ktx2.setWorkerLimit(1);
        predat = true;
        treaptaDoua = aduTexturileFine(ktx2);
        return true;
      } catch (e) {
        console.warn('vederea Satelit nu se poate încărca:', e?.message ?? e);
        return false;
      } finally {
        if (!predat) ktx2?.dispose();
      }
    })();
    return incarcare;
  };

  /**
   * A doua treaptă (`IN_DOUA_TREPTE`): textura întreagă ia locul celei mici în același
   * material — aceeași cutie, deci aceeași matrice UV; programul nu se schimbă. NU
   * respinge: dacă textura fină nu vine, rămâne cea mică, cu un avertisment. Dacă nici cea
   * mică n-a venit, materialul se face acum, cu cea fină. Primește încărcătorul primei
   * trepte și îl eliberează, pe orice cale.
   */
  const aduTexturileFine = async (ktx2) => {
    try {
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
      console.warn('texturile fine ale împrejurimilor nu s-au putut încărca:', e?.message ?? e);
    } finally {
      ktx2.dispose();
    }
  };

  const laClic = async () => {
    const tinta = !activ;
    scriePreferinta(tinta ? 'satelit' : 'relief');
    if (tinta && !materiale) {
      buton.setAttribute('aria-busy', 'true');
      anunt.textContent = 'Se încarcă fotografia aeriană…';
      let bun = false;
      try { bun = await pregateste(); } finally { buton.removeAttribute('aria-busy'); }
      if (!bun) {
        // Pleacă butonul, nu rădăcina: un subarbore `hidden` iese din arborele de
        // accesibilitate, iar mesajul scris în el nu l-ar mai anunța nimeni.
        buton.hidden = true;
        anunt.textContent = 'Fotografia aeriană nu s-a putut încărca.';
        return;
      }
      anunt.textContent = '';
    }
    aplica(tinta);
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
    const bun = await pregateste();
    if (!bun || !viu) return false;
    radacina.hidden = false;
    aplica(true);
    return true;
  })();

  return {
    gata,
    get activ() { return activ; },
    /** A doua treaptă a texturilor (pentru probe): null până pornește. */
    get treaptaDoua() { return treaptaDoua; },
    /** Comută de mână (pentru probe); întoarce promisiunea încărcării, dacă trebuie. */
    async comuta(satelit) {
      if (satelit && !materiale && !(await pregateste())) return false;
      aplica(satelit);
      return true;
    },
    dispose() {
      if (!viu) return;
      viu = false;
      abandon.abort();
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
