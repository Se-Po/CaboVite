// Planele acoperișurilor, găsite cu RANSAC pe pixelii MDS.
//
// Un acoperiș e MINIMUL unor plane peste un poligon convex: la orice punct, suprafața
// e planul cel mai jos. Așa ies fără cazuri speciale acoperișurile într-o apă, în
// două, în trei și în patru, cu teșituri.
//
// Stătea în masoara-sanctuar.mjs. Îl cere și build-cladiri, deci s-a mutat aici, cu
// generatorul de numere cu sămânță fixă: fără el, fiecare rulare ar da alte plane.
// Fiecare apelant își face generatorul lui (`creeazaRansac`), ca ordinea tragerilor —
// deci planele — să nu depindă de ce a mai rulat altcineva înainte.

/** z = A·x + B·y + C, cu x, y relative la media punctelor (numere mici). */
export function celeMaiMiciPatrate(p) {
  const mx = p.reduce((a, q) => a + q.x, 0) / p.length, my = p.reduce((a, q) => a + q.y, 0) / p.length;
  let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0, sz = 0;
  for (const q of p) { const x = q.x - mx, y = q.y - my; sxx += x * x; sxy += x * y; syy += y * y; sxz += x * q.z; syz += y * q.z; sz += q.z; }
  const det = sxx * syy - sxy * sxy;
  const A = det ? (sxz * syy - syz * sxy) / det : 0, B = det ? (syz * sxx - sxz * sxy) / det : 0, C = sz / p.length;
  return { A, B, C: C - A * mx - B * my, n: p.length };
}

export const zPlan = (pl, x, y) => pl.A * x + pl.B * y + pl.C;
export const zMin = (plane, x, y) => Math.min(...plane.map((pl) => zPlan(pl, x, y)));

/**
 * RANSAC cu sămânța dată. Întoarce `ransac(pts, maxPlane, minim)`: până la `maxPlane`
 * plane, fiecare cu cel puțin max(minim, 5% din puncte) de puncte la sub `tol` metri.
 */
export function creeazaRansac({ saminta = 20260929, tol = 0.12 } = {}) {
  let s = saminta;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  return function ransac(pts, maxPlane, minim = 12) {
    const plane = [];
    let rest = pts.slice();
    while (plane.length < maxPlane && rest.length >= minim) {
      let best = null;
      for (let it = 0; it < 4000; it++) {
        const [p, q, t] = [0, 0, 0].map(() => rest[Math.floor(rnd() * rest.length)]);
        const ux = q.x - p.x, uy = q.y - p.y, uz = q.z - p.z, vx = t.x - p.x, vy = t.y - p.y, vz = t.z - p.z;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const L = Math.hypot(nx, ny, nz);
        if (L < 1e-6) continue;
        nx /= L; ny /= L; nz /= L;
        if (Math.abs(nz) < 0.4) continue; // mai abrupt de ~66°: perete, nu acoperiș
        const d = -(nx * p.x + ny * p.y + nz * p.z);
        let n = 0;
        for (const r of rest) if (Math.abs(nx * r.x + ny * r.y + nz * r.z + d) < tol * Math.abs(nz)) n++;
        if (!best || n > best.n) best = { nx, ny, nz, d, n };
      }
      if (!best || best.n < Math.max(minim, 0.05 * pts.length)) break;
      const inl = rest.filter((r) => Math.abs(best.nx * r.x + best.ny * r.y + best.nz * r.z + best.d) < tol * Math.abs(best.nz));
      plane.push(celeMaiMiciPatrate(inl));
      rest = rest.filter((r) => !inl.includes(r));
    }
    return plane;
  };
}
