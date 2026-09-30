import { descarcaInertia } from './camera.js';

// Zborul camerei spre un punct de privire: ținta, distanța, direcția, înălțimea.
//
// Busola întoarce numai azimutul; aici se mută tot — ținta de la promontoriu la
// sanctuar, distanța de la kilometri la sute de metri. Aceleași reguli ca la
// busolă, pe care nu le repet decât pe scurt:
//   - un singur ceas: `pas()` se cheamă din `setAnimationLoop`, niciun al doilea
//     requestAnimationFrame;
//   - inerția utilizatorului se descarcă întâi (camera.js, `descarcaInertia`),
//     altfel zborul ar ateriza alături;
//   - sub `prefers-reduced-motion` se sare direct la capăt;
//   - orice atingere a controalelor anulează zborul: camera e a utilizatorului.
//
// Azimutul cerut e al POZIȚIEI camerei față de nordul ADEVĂRAT, ca cifra pe care o
// scrie busola: „privești dinspre 200°". Pe grilă, theta = (180 − azimut − n) grade,
// unde n e azimutul în grilă al nordului adevărat — formula busolei, inversată.

const RAD = Math.PI / 180;
const drumScurt = (d) => ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

/**
 * @param {{camera, controale, cereRandare: () => void, azimutNordAdevarat?: number, laPornire?: () => void}} o
 */
export function creeazaZbor({ camera, controale, cereRandare, azimutNordAdevarat = 0, laPornire }) {
  const faraMiscare = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let zbor = null;
  let viu = true;

  /** Coordonatele sferice ale camerei față de țintă, ca OrbitControls. */
  const sferic = () => {
    const t = controale.target, p = camera.position;
    const dx = p.x - t.x, dy = p.y - t.y, dz = p.z - t.z;
    const r = Math.hypot(dx, dy, dz);
    return { r, theta: Math.atan2(dx, dz), phi: Math.acos(Math.min(1, Math.max(-1, dy / r))) };
  };
  const pune = (t, r, theta, phi) => {
    controale.target.set(t[0], t[1], t[2]);
    camera.position.set(
      t[0] + r * Math.sin(phi) * Math.sin(theta),
      t[1] + r * Math.cos(phi),
      t[2] + r * Math.sin(phi) * Math.cos(theta),
    );
    controale.update();
  };

  const laStart = () => { zbor = null; };
  controale.addEventListener('start', laStart);

  return {
    /**
     * Pornește zborul.
     * @param {{tinta: number[], distanta: number, azimut: number, elevatie: number}} spre
     *   `azimut` în grade, al poziției camerei față de nordul adevărat; `elevatie` în grade.
     */
    spre({ tinta, distanta, azimut, elevatie }) {
      if (!viu) return;
      descarcaInertia(controale);
      laPornire?.();
      const de = sferic();
      const la = {
        t: tinta,
        r: Math.min(controale.maxDistance, Math.max(controale.minDistance, distanta)),
        theta: (180 - azimut - azimutNordAdevarat) * RAD,
        phi: Math.min(controale.maxPolarAngle, Math.max(controale.minPolarAngle, (90 - elevatie) * RAD)),
      };
      if (faraMiscare?.matches) { pune(la.t, la.r, la.theta, la.phi); cereRandare(); return; }
      const t0 = [controale.target.x, controale.target.y, controale.target.z];
      // Durata crește cu cât se schimbă scara și cu cât se mută ținta: de la 5 km
      // la 300 m se zboară mai mult decât o corecție de câteva zeci de metri.
      const scara = Math.abs(Math.log(de.r / la.r));
      const mutare = Math.hypot(t0[0] - la.t[0], t0[2] - la.t[2]) / Math.max(de.r, 1);
      zbor = { t0, de, la, dTheta: drumScurt(la.theta - de.theta), inceput: performance.now(),
        durata: Math.min(2400, 900 + 450 * scara + 400 * Math.min(1, mutare)) };
    },
    /** Un pas, chemat primul din buclă, ca busola. */
    pas() {
      if (!viu || !zbor) return;
      const z = zbor;
      const t = faraMiscare?.matches ? 1 : Math.min(1, (performance.now() - z.inceput) / z.durata);
      const u = easeInOutCubic(t);
      const tinta = z.t0.map((v, k) => v + (z.la.t[k] - v) * u);
      const r = Math.exp(Math.log(z.de.r) + (Math.log(z.la.r) - Math.log(z.de.r)) * u);
      pune(tinta, r, z.de.theta + z.dTheta * u, z.de.phi + (z.la.phi - z.de.phi) * u);
      cereRandare();
      if (t >= 1) zbor = null;
    },
    opreste() { zbor = null; },
    get activ() { return Boolean(zbor); },
    dispose() {
      if (!viu) return;
      viu = false;
      zbor = null;
      controale.removeEventListener('start', laStart);
    },
  };
}
