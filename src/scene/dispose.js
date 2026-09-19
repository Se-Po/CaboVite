// Eliberarea resurselor GPU.
//
// Scoaterea din scenă NU eliberează nimic: `remove()` rupe doar legătura din
// graf. Geometriile, materialele și texturile rămân pe placă până la `dispose()`.

/** Eliberează tot ce atârnă de un obiect și de descendenții lui. */
export function elibereazaArbore(radacina) {
  if (!radacina) return;
  radacina.traverse((obj) => {
    obj.geometry?.dispose();
    const materiale = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of materiale) {
      if (!m) continue;
      // Un material nu își eliberează singur texturile — trebuie parcurse.
      for (const valoare of Object.values(m)) {
        if (valoare?.isTexture) valoare.dispose();
      }
      m.dispose();
    }
  });
  radacina.removeFromParent();
}

/** Citire a contoarelor de memorie, pentru a prinde scurgeri între capitole. */
export function instantaneuMemorie(renderer) {
  const { geometries, textures } = renderer.info.memory;
  return { geometrii: geometries, texturi: textures, apeluri: renderer.info.render.calls };
}
