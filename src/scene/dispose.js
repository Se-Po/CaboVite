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
