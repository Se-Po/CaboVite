// Contoarele de memorie GPU.
//
// Scoaterea din scenă NU eliberează nimic: `remove()` rupe doar legătura din
// graf. Geometriile, materialele și texturile rămân pe placă până la `dispose()`.
// Cine le eliberează e fiecare modul pentru ce-a alocat el, printr-o singură
// listă — vezi `deEliberat` din scena.js.

/** Citire a contoarelor de memorie, pentru a prinde scurgeri între capitole. */
export function instantaneuMemorie(renderer) {
  const { geometries, textures } = renderer.info.memory;
  return { geometrii: geometries, texturi: textures, apeluri: renderer.info.render.calls };
}

/**
 * LUT-ul DFG al lui three r186: o textură de 16 × 16, RG16F, pe care n-o eliberează nimeni
 * din three.
 *
 * `getDFGLUT()` (DFGLUTData.js) o creează o singură dată pe modul, nu pe renderer, iar
 * `setProgram` o pune în uniforma `dfgLUT` a oricărui material care o are: Basic, Lambert,
 * Phong, Standard, Physical (`UniformsLib.envmap`). Pe placă urcă abia când un program fizic
 * o eșantionează, deci la primul cadru, nu la `compileAsync`. `renderer.dispose()` golește
 * numai ce ține rendererul, iar `getDFGLUT` nu e exportat: după `__scena.dispose()` rămânea
 * o textură, `{ geometries: 0, textures: 1 }`, măsurat pe v0.1.6. Măsurătorile și probele:
 * `docs/randarea.md`, „Eliberarea: LUT-ul DFG al lui three”.
 *
 * Scena o ia din uniformele unui material desenat (`prinde`, după `render()`) și o
 * eliberează prin `deEliberat`. Ordinea contează: după `renderer.dispose()` proprietățile
 * rendererului sunt golite, iar `dispose()` pe textură nu mai ajunge la placă. Eliberarea
 * unui singleton e sigură: `Texture.dispose()` doar anunță ascultătorii texturii, datele
 * rămân, iar un renderer nou o urcă din nou la nevoie. După un context pierdut și refăcut,
 * printre ascultători sunt și modulele de dinaintea pierderii: ele mai șterg o dată mânerul
 * vechi, cu un avertisment WebGL în consolă, fără alt efect.
 */
export function urmaresteLutDFG(renderer) {
  let lut = null;
  /** După un cadru desenat: LUT-ul, din uniformele materialului (Basic sau Standard). */
  const prinde = (material) => {
    if (lut || !material) return;
    const v = renderer.properties.get(material).uniforms?.dfgLUT?.value;
    if (v?.isTexture) lut = v;
  };
  return {
    prinde,
    /**
     * Înaintea lui `renderer.dispose()`, nu după. Cu `radacina`, întâi încă o căutare în
     * materialele ei: dacă `render()` a aruncat după ce un material fizic urcase LUT-ul,
     * `prinde` de după el n-a mai rulat (recenzia; `laEsec`, cu trei cadre la rând așa).
     */
    dispose(radacina) {
      radacina?.traverse((o) => { for (const m of [o.material].flat()) prinde(m); });
      lut?.dispose();
      lut = null;
    },
  };
}
