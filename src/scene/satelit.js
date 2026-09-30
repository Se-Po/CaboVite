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
 *   laSursa: (sursa: object) => void, fortatRelief: boolean}} o
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
  const vizibilDrapaj = drapaj.map((d) => d.visible);
  const soareRelief = soare.position.clone();
  let soareZbor = null;
  let materiale = null;           // { teren, petic, mare }
  let texturi = [];
  let activ = false, viu = true, incarcare = null;

  const construiesteMateriale = (b, p) => {
    const anizo = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const pregateste = (t, meta) => {
      t.anisotropy = anizo;
      t.matrixAutoUpdate = false;
      t.matrix.copy(matriceUV(meta, centru));
      return t;
    };
    const tB = pregateste(b.textura, b.meta), tP = p ? pregateste(p.textura, p.meta) : null;
    texturi = [tB, ...(tP ? [tP] : [])];
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
    return { teren: terenM(tB), petic: petic ? terenM(tP ?? tB) : null, mare: mareM };
  };

  const aplica = (satelit) => {
    activ = satelit;
    teren.obiect.material = satelit ? materiale.teren : originale.teren;
    if (petic) petic.obiect.material = satelit ? materiale.petic : originale.petic;
    mare.obiect.material = satelit ? materiale.mare : originale.mare;
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
      let ktx2 = null;
      try {
        ktx2 = await creeazaIncarcatorKtx2(renderer);
        const [b, p] = await Promise.all([incarcaOrto(numeB, ktx2), numeP ? incarcaOrto(numeP, ktx2) : null]);
        if (!b) { p?.textura.dispose(); return false; }
        if (!viu) { b.textura.dispose(); p?.textura.dispose(); return false; }
        const s = b.meta.soare_zbor;
        if (!Number.isFinite(s?.azimut_grila) || !Number.isFinite(s?.elevatie) || !Array.isArray(b.meta.mare?.srgb)) {
          console.warn(`textura Satelit ${numeB}: sidecarul n-are soarele zborului sau marea`);
          b.textura.dispose(); p?.textura.dispose();
          return false;
        }
        // Un GPU fără niciun format comprimat primește RGBA necomprimat: ~71 MB pe
        // placă în loc de ~18. Atunci peticul folosește textura bazei.
        let pp = p;
        if (p && b.textura.format === THREE.RGBAFormat) {
          console.info('texturile Satelit au ieșit necomprimate: peticul folosește textura bazei');
          p.textura.dispose(); pp = null;
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
        try { await renderer.compileAsync(proxy, camera, scena); } catch { /* se compilează la prima randare */ }
        for (const t of texturi) renderer.initTexture(t);
        if (!viu) return false;
        o.laSursa?.({ ...b.meta.sursa, prelucrare: 'fotografia aeriană, drapată pe relief în vederea Satelit' });
        return true;
      } catch (e) {
        console.warn('vederea Satelit nu se poate încărca:', e?.message ?? e);
        return false;
      } finally {
        ktx2?.dispose();
      }
    })();
    return incarcare;
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
      try { await incarcaSidecarOrto(numeB); } catch (e) { console.warn(`textura Satelit ${numeB}: ${e.message}`); return false; }
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
    /** Comută de mână (pentru probe); întoarce promisiunea încărcării, dacă trebuie. */
    async comuta(satelit) {
      if (satelit && !materiale && !(await pregateste())) return false;
      aplica(satelit);
      return true;
    },
    dispose() {
      if (!viu) return;
      viu = false;
      buton.removeEventListener('click', laClic);
      if (activ) aplica(false);
      teren.obiect.material = originale.teren;
      if (petic) petic.obiect.material = originale.petic;
      mare.obiect.material = originale.mare;
      if (materiale) for (const m of Object.values(materiale)) m?.dispose();
      for (const t of texturi) t.dispose();
      materiale = null; texturi = [];
      radacina.remove();
    },
  };
}
