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
//
// Tot aici stă rețeta plaselor lui alpha (`pregatesteAlpha`, `construiesteAlpha`), una
// singură pentru pagină (scena.js) și pentru probe: copiată de mână în cinci probe, ajunsese
// să construiască altceva decât pagina (`docs/teren.md`, „Rețeta lui alpha”).

import { creeazaTeren, mascaBazei } from './terrain.js';
import { straturiNdvi } from './loaders.js';
import { buclaNoduri, dreptunghiGrila } from './cusatura.js';

/**
 * Rețeta lui alpha, înaintea plaselor: din ce a întors `incarcaRelief()` — un petic care își
 * aduce baza, sau numai o bază — relieful bazei, al peticului, masca bazei și straturile NDVI,
 * desprinse de pe relief (`straturiNdvi`), ca să nu rămână vii după coacerea culorii.
 *
 * @returns {{relief: object, reliefPetic: object|null, limitaDatelor: Array|null,
 *   subPetic: Function|null, pastreaza: Function|undefined, ndvi: {baza?: object, petic?: object}}}
 */
export function pregatesteAlpha(incarcat) {
  const relief = incarcat.baza ?? incarcat;
  const reliefPetic = incarcat.baza ? incarcat : null;
  const { limitaDatelor, subPetic, pastreaza } = mascaBazei(relief, reliefPetic);
  const ndvi = straturiNdvi(relief, reliefPetic);
  return { relief, reliefPetic, limitaDatelor, subPetic, pastreaza, ndvi };
}

/**
 * Rețeta lui alpha, plasele: baza, apoi peticul în gaura ei, marginea de care se cos
 * împrejurimile și altitudinea randată. Ce trebuie păstrat, cu motivul:
 *  - `inscrie` primește eliberarea bazei imediat după ea, ÎNAINTEA construcției peticului:
 *    dacă peticul aruncă, cei ~77 MB de atribute ai bazei trebuie să fie deja în lista
 *    de eliberat a pornirii;
 *  - aceeași `culoare` (previzualizarea) pe amândouă plasele;
 *  - `margineAlpha` se ia cât stratul NDVI al bazei mai e viu, și numai fără
 *    previzualizare: acolo împrejurimile nu se construiesc;
 *  - `inaltimeLa`: peticul de 1 m unde există, baza de 2 m în rest.
 * Straturile NDVI nu se întorc: cine le ține, le golește după apel.
 *
 * @returns {{teren: object, petic: object|null, margineAlpha: object[]|null, inaltimeLa: Function}}
 */
export function construiesteAlpha({ relief, reliefPetic, pastreaza, subPetic, ndvi }, { paleta, culoare, inscrie = () => {} } = {}) {
  const teren = creeazaTeren(relief, { pastreaza, paleta, ndvi: ndvi.baza, culoare });
  inscrie(() => teren.dispose());
  const petic = reliefPetic
    ? creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena, paleta, ndvi: ndvi.petic, culoare })
    : null;
  if (petic) inscrie(() => petic.dispose());
  const margineAlpha = culoare ? null : buclaNoduri(relief, { x: 0, z: 0 }, ndvi.baza ?? null, dreptunghiGrila(relief));
  const inaltimeLa = (x, z) => (petic && subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z));
  return { teren, petic, margineAlpha, inaltimeLa };
}

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
     * `y` e limitat și el, la cota mării și la cea mai înaltă cotă a lui alpha.
     * Mutarea hărții e orizontală (camera.js), deci pe verticală ținta o mută numai
     * zborurile, zoomul spre cursor (rotita.js) și reașezarea pivotului pe teren.
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

    /**
     * Pe ce interval de t stă raza `o + t·u` în cutia lui alpha — x, z și y între
     * cota mării și cea mai înaltă cotă —, sau null dacă n-o atinge. Zoomul spre cursor
     * și reașezarea pivotului pun ținta pe raza privirii numai în intervalul acesta,
     * deci limita de mai sus nu mai are ce muta, iar punctul de sub cursor rămâne pe loc.
     */
    intervalRaza(o, u) {
      let t0 = -Infinity, t1 = Infinity;
      for (const [k, lo, hi] of [['x', a.xMin, a.xMax], ['y', a.yMin, a.yMax], ['z', a.zMin, a.zMax]]) {
        if (Math.abs(u[k]) < 1e-12) {
          if (o[k] < lo || o[k] > hi) return null;
          continue;
        }
        const ta = (lo - o[k]) / u[k], tb = (hi - o[k]) / u[k];
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
      }
      // O rază care doar atinge cutia, pe o muchie — ținta lipită de perete, pe mare —
      // iese din rotunjire cu t0 > t1 cu ~1e-13: e tot un punct, nu nimic. Fără
      // toleranță, recenzia a găsit rotița blocată acolo în 20% din stări.
      if (t0 > t1 && t0 - t1 <= 1e-9 * Math.max(1, Math.abs(t1))) return [t1, t1];
      return t0 <= t1 ? [t0, t1] : null;
    },
  };
}
