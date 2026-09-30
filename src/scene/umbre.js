import * as THREE from 'three';

// Umbrele sanctuarului.
//
// Soarele vederii Relief stă la 18° deasupra orizontului, din vest-sud-vest, ca
// straturile falezei să se citească în lumină razantă; vederea Satelit îl pune pe
// al zborului (39,5° / 94°). La unghiul ăsta o clădire de 15 m
// aruncă o umbră de ~46 m; fără ea, volumele par lipite pe teren, iar arcadele și
// portalurile par desenate.
//
// Ieftin, fiindcă nici clădirile, nici lumina nu se mișcă de la un cadru la altul:
//   - o singură hartă de umbre, de 2048², strânsă pe complex — nu pe cei 4 km²
//     ai hărții, unde un texel ar avea 2 m;
//   - `autoUpdate = false`: se desenează la pornire și apoi numai când se mută
//     soarele, nu la fiecare cadru;
//   - aruncă umbră numai sanctuarul; primesc sanctuarul, suprafețele de pe teren
//     și terenul. În afara cutiei umbrei, shaderul găsește „luminat", deci restul
//     hărții rămâne neschimbat.
//
// Camera de umbră stă unde stă lumina, la 4 km, și privește spre ținta ei; numai
// marginile ei se strâng pe complex, oriunde ar fi el în cadru. Așa terenul din
// afara cutiei primește exact aceeași lumină ca înainte — o poziție mutată, chiar
// pe aceeași direcție, ar fi rotunjit altfel vectorul luminii și ar fi schimbat
// pixeli pe toată harta. Soarele se mută numai între vederi (Relief ↔ Satelit), iar
// atunci `potriveste()` reîncadrează cutia și redesenează harta o dată.

/**
 * @param {{renderer: THREE.WebGLRenderer, soare: THREE.DirectionalLight, cutie: THREE.Box3,
 *          arunca: THREE.Mesh[], primesc: THREE.Mesh[], lungimeUmbra?: number}} o
 */
export function creeazaUmbre({ renderer, soare, cutie, arunca, primesc, lungimeUmbra = 60 }) {
  const cam = soare.shadow.camera;
  let texel = 0;
  // Cutia camerei de umbră: colțurile complexului, lărgite cu lungimea umbrei, în
  // spațiul luminii — aceeași rotație pe care și-o face LightShadow.updateMatrices.
  // Se reface ori de câte ori soarele se mută (vederea Satelit îl pune pe soarele
  // zborului): altfel cutia veche, rotită altfel, ar tăia umbrele.
  const incadreaza = () => {
    soare.updateMatrixWorld();
    soare.target.updateMatrixWorld();
    const ochi = new THREE.Vector3().setFromMatrixPosition(soare.matrixWorld);
    const tinta = new THREE.Vector3().setFromMatrixPosition(soare.target.matrixWorld);
    const invers = new THREE.Matrix4().lookAt(ochi, tinta, cam.up).invert();
    const b = cutie.clone().expandByScalar(lungimeUmbra);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const p = new THREE.Vector3(x, y, z).sub(ochi).applyMatrix4(invers);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    cam.left = x0; cam.right = x1; cam.bottom = y0; cam.top = y1;
    cam.near = Math.max(1, -z1 - 10); cam.far = -z0 + 10;
    cam.updateProjectionMatrix();
    texel = Math.max(x1 - x0, y1 - y0) / 2048;
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
  for (const m of arunca) m.castShadow = true;
  for (const m of primesc) m.receiveShadow = true;

  let viu = true;
  return {
    /** Cere refacerea hărții de umbre — de pildă după pierderea contextului. */
    refa() { soare.shadow.needsUpdate = true; },
    /** Soarele s-a mutat: cutia se reîncadrează, iar harta se redesenează o dată. */
    potriveste() { incadreaza(); soare.shadow.needsUpdate = true; },
    get texelMetri() { return texel; },
    dispose() {
      if (!viu) return;
      viu = false;
      soare.castShadow = false;
      for (const m of arunca) m.castShadow = false;
      for (const m of primesc) m.receiveShadow = false;
      soare.shadow.dispose();          // harta de umbre e un WebGLRenderTarget
      renderer.shadowMap.enabled = false;
    },
  };
}
