// Zona alpha: harta pe care se lucrează — `harta_v4`, cu peticul ei `harta_v5`.
//
// Numele l-a dat autorul, pe 2026-10-07: alpha e singurul spațiu de interacțiune.
// Pe ea se măsoară (panoul punctului), pe ea stau etichetele și în jurul ei se
// rotește camera. Împrejurimile, care duc peisajul până la orizont, sunt decor:
// date reale, dar mai grosiere și din alte surse, deci nici nu se măsoară pe ele,
// nici nu se zboară deasupra lor.
//
// Cutia e a NODURILOR bazei, nu dreptunghiul de decupare din `bbox_tm06`: în
// convenția „muchii de celulă” primul nod stă la o jumătate de celulă în interior,
// deci alpha merge pe x ∈ [−1163; 1163] și z ∈ [−1492; 1492], nu ±1164 / ±1493.

/**
 * @param {object} meta — sidecarul bazei, de la incarcaRelief()
 * @returns {{xMin: number, xMax: number, zMin: number, zMax: number, yMin: number, yMax: number,
 *            contine: (x: number, z: number) => boolean, limiteaza: Function} | null}
 */
export function creeazaAlpha(meta) {
  const { latime: w, inaltime: h, pasX_m: pasX, pasZ_m: pasZ } = meta ?? {};
  if (![w, h, pasX, pasZ, meta?.zMax_m].every(Number.isFinite)) {
    console.warn('alpha: sidecarul bazei n-are dimensiunile sau zMax_m — ținta camerei rămâne nelimitată');
    return null;
  }
  const xMax = ((w - 1) / 2) * pasX, zMax = ((h - 1) / 2) * pasZ;
  const a = { xMin: -xMax, xMax, zMin: -zMax, zMax, yMin: 0, yMax: meta.zMax_m };

  return {
    ...a,
    contine: (x, z) => x >= a.xMin && x <= a.xMax && z >= a.zMin && z <= a.zMax,

    /**
     * Ține ținta camerei în alpha. Dacă a ieșit, ținta ȘI camera se mută înapoi cu
     * același vector: orientarea și distanța rămân, deci imaginea nu sare și nici
     * nu se rotește — doar nu mai merge mai departe. Întoarce true dacă a mutat.
     *
     * OrbitControls din r186 are numai o limită sferică (`cursor` + `maxTargetRadius`).
     * Sfera care cuprinde dreptunghiul de 2,3 × 3 km are raza de 1 892 m, deci ar lăsa
     * ținta să iasă cu ~730 m dincolo de marginile de est și vest și cu ~400 m dincolo
     * de cele de nord și sud. De aceea dreptunghiul se scrie aici.
     *
     * `y` e limitat și el, la cota mării și la cea mai înaltă cotă a lui alpha:
     * panoramarea în planul ecranului (`screenSpacePanning`) mută ținta și pe
     * verticală.
     *
     * Întoarce true numai pentru o mutare care se vede, peste un milimetru — pragul
     * lui OrbitControls (_EPS pe pătratul distanței). Amortizarea mai împinge ținta în
     * perete câteva sute de cadre cu fracțiuni de milimetru, iar pe podeaua y = 0
     * resturile ajung denormale și țin ~8 900 de cadre: fiecare ar fi cerut o
     * redesenare a unui cadru identic.
     */
    limiteaza(tinta, camera) {
      const dx = Math.min(a.xMax, Math.max(a.xMin, tinta.x)) - tinta.x;
      const dy = Math.min(a.yMax, Math.max(a.yMin, tinta.y)) - tinta.y;
      const dz = Math.min(a.zMax, Math.max(a.zMin, tinta.z)) - tinta.z;
      if (!dx && !dy && !dz) return false;
      tinta.x += dx; tinta.y += dy; tinta.z += dz;
      camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
      return dx * dx + dy * dy + dz * dz > 1e-6;
    },
  };
}
