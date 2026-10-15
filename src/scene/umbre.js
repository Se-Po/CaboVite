import * as THREE from 'three';

// Umbrele clădirilor: sanctuarul și, din v0.1.0, cele din afara lui.
//
// Soarele vederii Relief stă la 18° deasupra orizontului, din vest-sud-vest, ca
// straturile falezei să se citească în lumină razantă. La 18° o clădire de 15 m
// aruncă o umbră de ~46 m; fără ea, volumele par lipite pe teren, iar arcadele și
// portalurile par desenate. Vederea Satelit pune soarele zborului (39,5° / 94°).
//
// Ieftin, fiindcă nici clădirile, nici lumina nu se mișcă de la un cadru la altul:
//   - o singură hartă de umbre, de 2048², strânsă pe complex — nu pe cei 4 km²
//     ai hărții, unde un texel ar avea 2 m;
//   - `autoUpdate = false`: se desenează la pornire și apoi numai când se mută
//     soarele sau grupul privit, nu la fiecare cadru;
//   - aruncă umbră clădirile; primesc ele, suprafețele de pe teren și terenul. În
//     afara cutiei umbrei, shaderul găsește „luminat", deci restul hărții rămâne
//     neschimbat.
//
// Camera de umbră stă unde stă lumina, la 4 km, și privește spre ținta ei; numai
// marginile ei se strâng pe complex, oriunde ar fi el în cadru. Așa terenul din
// afara cutiei primește exact aceeași lumină ca înainte — o poziție mutată, chiar
// pe aceeași direcție, ar fi rotunjit altfel vectorul luminii și ar fi schimbat
// pixeli pe toată harta. Soarele se mută numai între vederi (Relief ↔ Satelit), iar
// atunci `potriveste()` reîncadrează cutia și redesenează harta o dată.
//
// Clădirile stau în trei grupuri — sanctuarul, farul, Casa da Ronca —, la sute de
// metri unul de altul. O cutie peste toate ar lărgi texelul peste pragul ales mai
// jos (`TEXEL_MAXIM`); atunci harta se strânge pe grupul privit (`incadreazaPe`), tot cu o
// singură redesenare, iar celelalte grupuri rămân fără umbră cât nu sunt privite.

/**
 * @param {{renderer: THREE.WebGLRenderer, soare: THREE.DirectionalLight, cutie: THREE.Box3,
 *          arunca: THREE.Mesh[], primesc: THREE.Mesh[], lungimeUmbra?: number}} o
 */
export function creeazaUmbre({ renderer, soare, cutie, arunca, primesc, lungimeUmbra = 60 }) {
  const cam = soare.shadow.camera;
  let curenta = cutie;
  let texel = 0;
  // Crește la fiecare mutare a soarelui: cine ține minte un texel știe când s-a învechit.
  let versiuneSoare = 0;
  // Cutia camerei de umbră: colțurile complexului, lărgite cu lungimea umbrei, în
  // spațiul luminii — aceeași rotație pe care și-o face LightShadow.updateMatrices.
  // Funcție pură: nu atinge camera, deci servește și la întrebarea „cât ar avea
  // texelul pe cutia asta?”.
  const limite = (c) => {
    soare.updateMatrixWorld();
    soare.target.updateMatrixWorld();
    const ochi = new THREE.Vector3().setFromMatrixPosition(soare.matrixWorld);
    const tinta = new THREE.Vector3().setFromMatrixPosition(soare.target.matrixWorld);
    const invers = new THREE.Matrix4().lookAt(ochi, tinta, cam.up).invert();
    const b = c.clone().expandByScalar(lungimeUmbra);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const p = new THREE.Vector3(x, y, z).sub(ochi).applyMatrix4(invers);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    return { x0, x1, y0, y1, z0, z1, texel: Math.max(x1 - x0, y1 - y0) / 2048 };
  };
  // Se reface ori de câte ori soarele se mută (vederea Satelit îl pune pe soarele
  // zborului): altfel cutia veche, rotită altfel, ar tăia umbrele.
  const incadreaza = () => {
    const l = limite(curenta);
    cam.left = l.x0; cam.right = l.x1; cam.bottom = l.y0; cam.top = l.y1;
    cam.near = Math.max(1, -l.z1 - 10); cam.far = -l.z0 + 10;
    cam.updateProjectionMatrix();
    texel = l.texel;
  };
  incadreaza();
  soare.shadow.mapSize.set(2048, 2048);
  // Fără atributul `normal` (vezi terrain.js), `normalBias` n-are pe ce lucra; un
  // bias mic pe adâncime oprește acneea pe fațetele plate.
  soare.shadow.bias = -0.0004;
  soare.shadow.autoUpdate = false;
  soare.shadow.needsUpdate = true;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  soare.castShadow = true;

  // Materialul de adâncime cu care se desenează harta e al lui three: WebGLShadowMap își face
  // unul (`_depthMaterial`) și nu-l eliberează nimeni, nici `renderer.dispose()`, deci după
  // `dispose()` îi rămânea programul pe placă. three i-l dă fiecărui obiect care aruncă umbră,
  // în `onBeforeShadow`, chiar înaintea desenului: îl ținem minte de acolo și îl eliberăm în
  // `dispose()`, care trece prin listă înaintea lui `renderer.dispose()`. După un context
  // refăcut, three face un WebGLShadowMap nou, cu alt material: după primul cadru cu umbre se
  // prind amândouă, iar cel vechi pleacă fără nicio ștergere pe contextul pierdut. O variantă
  // clonată (alphaTest, decupare) o eliberează three oricum, odată cu materialul obiectului.
  // Vezi `docs/randarea.md`, „Eliberarea: programul de adâncime al umbrelor”.
  const adancime = new Set();
  const prinde = (_r, _o, _c, _cu, _g, material) => { adancime.add(material); };
  for (const m of arunca) {
    m.castShadow = true;
    m.onBeforeShadow = prinde;
  }
  for (const m of primesc) m.receiveShadow = true;

  let viu = true;
  return {
    /** Cere refacerea hărții de umbre — de pildă după pierderea contextului. */
    refa() { soare.shadow.needsUpdate = true; },
    /** Soarele s-a mutat: cutia se reîncadrează, iar harta se redesenează o dată. */
    potriveste() { versiuneSoare++; incadreaza(); soare.shadow.needsUpdate = true; },
    /** Harta se strânge pe altă cutie — alt grup de clădiri — și se redesenează o dată. */
    incadreazaPe(c) { curenta = c; incadreaza(); soare.shadow.needsUpdate = true; },
    get cutie() { return curenta; },
    get texelMetri() { return texel; },
    /** Texelul pe care l-ar avea harta strânsă pe cutia `c`, cu soarele de acum. */
    texelPentru: (c) => limite(c).texel,
    get versiuneSoare() { return versiuneSoare; },
    dispose() {
      if (!viu) return;
      viu = false;
      soare.castShadow = false;
      for (const m of arunca) {
        m.castShadow = false;
        // Numai cârligul nostru: rămâne metoda goală de pe prototip.
        if (m.onBeforeShadow === prinde) delete m.onBeforeShadow;
      }
      for (const m of primesc) m.receiveShadow = false;
      for (const material of adancime) material.dispose();
      adancime.clear();
      soare.shadow.dispose();          // harta de umbre e un WebGLRenderTarget
      renderer.shadowMap.enabled = false;
    },
  };
}

/** Texelul cel mai mare, în metri, cu care harta de umbre rămâne pe cutia tuturor grupurilor. */
export const TEXEL_MAXIM = 0.3;

/**
 * Grupurile umbrelor — sanctuarul, apoi grupurile clădirilor (farul, Casa da Ronca) —, fără cele
 * goale, și cutia unită peste ele. Aici, nu în scena.js, ca proba (verifica-cladiri) să încerce
 * aceleași grupuri ca pagina.
 *
 * @param {{sanctuar?: {cutieCladiri: THREE.Box3}|null, cladiri?: {cutiiGrupuri: Map<string, THREE.Box3>}|null}} o
 */
export function grupuriUmbre({ sanctuar = null, cladiri = null } = {}) {
  const grupuri = [
    ...(sanctuar ? [{ nume: 'sanctuar', cutie: sanctuar.cutieCladiri }] : []),
    ...(cladiri ? [...cladiri.cutiiGrupuri].map(([nume, cutie]) => ({ nume, cutie })) : []),
  ].filter((g) => !g.cutie.isEmpty());
  return { grupuri, unita: grupuri.reduce((a, g) => a.union(g.cutie), new THREE.Box3()) };
}

/**
 * Pe ce cutie se strânge harta de umbre, la fiecare cadru desenat. Stă aici, nu în scena.js,
 * ca probele (verifica-cladiri) s-o încerce pe ea, cu umbrele și luminile paginii.
 *
 * Cât texelul cutiei peste toate grupurile nu trece de `texelMaxim`, rămâne ea.
 * Altfel, de departe tot ea: cât texelul ei nu trece de mărimea unui pixel de ecran
 * la țintă, o hartă mai strânsă n-ar desena nimic în plus. Pixelul e al CANVASULUI
 * (`canvas.height`), nu CSS și nu neapărat de dispozitiv: raportul e plafonat la 2.
 * De aproape, grupul cel mai apropiat de țintă.
 *
 * La pornire ținta e la 611 m, iar texelul cutiei unite 0,50–0,60 m. Alegerea se face
 * abia la primul cadru: la creare canvasul n-are încă mărimea lui — o capătă în buclă —,
 * deci aici iese mereu cutia unită. Primul cadru are soarele zborului — harta apare direct
 * pe Satelit —, cu 0,497 m pe texel, deci cutia unită rămâne pe un canvas înalt de cel
 * mult ~1 120 px de canvas (măsurat în pagină: 1120 → cutia unită, 1122 → sanctuarul).
 * Cu preferința Relief primul cadru are soarele Relief, 0,604 m, iar pragul e ~922 px.
 * Pe telefoanele în portret și pe ecranele dense harta pornește strânsă pe sanctuar
 * (~430 m de țintă; farul e la ~800 m), cu 0,216 m pe texel — farul își primește umbra
 * când te apropii de el. Un telefon în peisaj rămâne pe cutia unită: cu raportul de
 * pixeli plafonat la 2 (renderer.js), canvasul de 844 × 390 la 3× are 780 px înălțime,
 * nu 1170. Măsurat în pagină, la primul cadru: 1440 × 900 la DPR 1 → cutia unită, la
 * DPR 2 (2428 × 1517) → sanctuarul; 390 × 844 la 3× (780 × 1688) → sanctuarul;
 * 844 × 390 la 3× (1688 × 780) → cutia unită.
 *
 * Două praguri cu histerezis — ±10% pe pixel,
 * HISTEREZIS metri între grupuri —, ca o cameră care stă pe o margine să nu
 * redeseneze harta la fiecare cadru; o schimbare costă o singură redesenare.
 *
 * Texelul cutiei unite depinde de soare (0,60 m cu soarele Relief, 0,50 m cu al
 * zborului), deci se recitește când `umbre.versiuneSoare` s-a schimbat.
 *
 * @param {{incadreazaPe: (c: THREE.Box3) => void, texelPentru: (c: THREE.Box3) => number,
 *          texelMetri: number, versiuneSoare: number}} o.umbre
 * @param {{nume: string, cutie: THREE.Box3}[]} o.grupuri
 */
export function urmaresteGrupul({ umbre, grupuri, unita, texelMaxim, camera, controale, canvas }) {
  const HISTEREZIS = 20;
  const p = new THREE.Vector3();
  const tinta = controale.target;
  const distanta = (g) => g.cutie.distanceToPoint(p.set(tinta.x, (g.cutie.min.y + g.cutie.max.y) / 2, tinta.z));
  const toate = { nume: 'toate', cutie: unita };
  const texel = new Map();
  let curent = toate, texelUnit = 0, versiune = -1;
  const pas = () => {
    if (versiune !== umbre.versiuneSoare) {
      versiune = umbre.versiuneSoare;
      texelUnit = umbre.texelPentru(unita);
      texel.clear();
      texel.set('toate', texelUnit);
      if (curent !== toate) texel.set(curent.nume, umbre.texelMetri);
    }
    let ales = toate;
    if (texelUnit > texelMaxim) {
      // mărimea unui pixel de ecran la distanța țintei, în metri
      const pixel = (camera.position.distanceTo(tinta) * 2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, canvas.height);
      if (texelUnit > pixel * (curent === toate ? 1.1 : 0.9)) {
        let cel = grupuri[0], dCel = distanta(cel);
        for (let k = 1; k < grupuri.length; k++) { const d = distanta(grupuri[k]); if (d < dCel) { cel = grupuri[k]; dCel = d; } }
        ales = curent !== toate && cel !== curent && distanta(curent) - dCel < HISTEREZIS ? curent : cel;
      }
    }
    if (ales === curent) return;
    curent = ales;
    umbre.incadreazaPe(curent.cutie);
    texel.set(curent.nume, umbre.texelMetri);
  };
  pas();
  return {
    pas,
    get grup() { return curent.nume; },
    /** Texelul fiecărei cutii deja încadrate cu soarele de acum, în metri. */
    get texel() { return Object.fromEntries(texel); },
  };
}
