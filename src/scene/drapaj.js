import * as THREE from 'three';
import { creeazaScriitor, taie } from './sanctuar-forme.js';

// Suprafețele de pe teren — terreiro-ul, parcarea, drumurile, potecile —, puse
// EXACT pe triunghiurile randate ale terenului.
//
// Nu pe `inaltimeLa`: aceea interpolează biliniar, pe când plasa are două
// triunghiuri plane pe celulă, cu diagonala aleasă după diferența de nivel mai
// mică. O suprafață pusă pe interpolare ar pluti sau s-ar îngropa cu centimetri
// între noduri, iar pe distanțe mari ar pâlpâi. Aici fiecare poligon convex se
// taie cu fiecare triunghi al fiecărei celule pe care o atinge, iar vârfurile
// primesc cota din planul acelui triunghi: suprafața e COPLANARĂ cu terenul.
//
// Coplanar înseamnă aceeași adâncime, deci lupta z. Se rezolvă cu polygonOffset,
// nu cu o ridicare în metri. Cu NEAR = 10 m și 24 de biți, adâncimea are ~1,5 cm
// rezoluție la 1,6 km și ~15 cm la 5 km, cadrul de pornire pe telefon: o ridicare
// destul de mare pentru 5 km s-ar vedea plutind la 80 m. Decalajul poligonal e în
// unități de adâncime și crește cu panta, deci ține la orice distanță.
//
// Straturile se suprapun — un drum intră în parcare, parcarea atinge un drum —,
// deci fiecare strat are materialul lui, cu un decalaj mai mare: stratul de sus
// câștigă. Patru straturi, patru apeluri de desenare.

/** Celulele unei plase, ca în terrain.js: nodurile, apa, masca, diagonala. */
function retea(relief, dep, pastreaza) {
  const { latime: w, inaltime: h, pasX, pasZ } = relief;
  const g = relief.inaltimi;
  const X = (c) => (c - (w - 1) / 2) * pasX + dep.x;
  const Z = (r) => (r - (h - 1) / 2) * pasZ + dep.z;
  const Y = (r, c) => g[r * w + c];
  const cota = relief.meta?.zMin_m;
  const apa = (r, c) => Number.isFinite(cota) && Y(r, c) <= cota && Y(r, c + 1) <= cota && Y(r + 1, c) <= cota && Y(r + 1, c + 1) <= cota;
  return {
    X, Z,
    /** Coloana celulei în care cade x (fără limitare la grilă). */
    col: (x) => Math.floor((x - dep.x) / pasX + (w - 1) / 2),
    /** Intervalul de celule care acoperă cutia [x0, x1] × [z0, z1]. */
    interval(x0, x1, z0, z1) {
      const c0 = Math.max(0, Math.floor((x0 - dep.x) / pasX + (w - 1) / 2)), c1 = Math.min(w - 2, Math.floor((x1 - dep.x) / pasX + (w - 1) / 2));
      const r0 = Math.max(0, Math.floor((z0 - dep.z) / pasZ + (h - 1) / 2)), r1 = Math.min(h - 2, Math.floor((z1 - dep.z) / pasZ + (h - 1) / 2));
      return { c0, c1, r0, r1 };
    },
    /** Cele două triunghiuri ale celulei (r, c), sau null dacă celula nu e randată. */
    triunghiuri(r, c) {
      if (pastreaza && !pastreaza(X(c) + pasX / 2, Z(r) + pasZ / 2)) return null;
      if (apa(r, c)) return null;
      const A = [X(c), Y(r, c), Z(r)], B = [X(c + 1), Y(r, c + 1), Z(r)];
      const C = [X(c), Y(r + 1, c), Z(r + 1)], D = [X(c + 1), Y(r + 1, c + 1), Z(r + 1)];
      return Math.abs(A[1] - D[1]) <= Math.abs(B[1] - C[1]) ? [[A, C, D], [A, D, B]] : [[A, C, B], [C, D, B]];
    },
  };
}

/**
 * Cât acoperă conturul pe x în fâșia închisă z ∈ [za, zb]: din vârfurile aflate în
 * fâșie și din intersecțiile laturilor cu cele două drepte. Exact așa e întinderea pe x
 * a bucății de poligon din fâșie, oricare ar fi poligonul. null dacă nu atinge fâșia.
 */
function intervalX(contur, za, zb) {
  let lo = Infinity, hi = -Infinity;
  const n = contur.length;
  for (let k = 0; k < n; k++) {
    const [px, pz] = contur[k], [qx, qz] = contur[(k + 1) % n];
    if (pz >= za && pz <= zb) { if (px < lo) lo = px; if (px > hi) hi = px; }
    // Vârfurile de pe dreaptă sunt prinse mai sus; aici numai traversările stricte.
    if ((pz < za && qz > za) || (pz > za && qz < za)) {
      const x = px + ((qx - px) * (za - pz)) / (qz - pz);
      if (x < lo) lo = x; if (x > hi) hi = x;
    }
    if ((pz < zb && qz > zb) || (pz > zb && qz < zb)) {
      const x = px + ((qx - px) * (zb - pz)) / (qz - pz);
      if (x < lo) lo = x; if (x > hi) hi = x;
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

/** Planul y = a·x + b·z + c prin trei puncte. */
function plan([p, q, s]) {
  const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = s[0] - p[0], vy = s[1] - p[1], vz = s[2] - p[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  return [-nx / ny, -nz / ny, (nx * p[0] + ny * p[1] + nz * p[2]) / ny];
}

/** Taie poligonul convex (x, z) cu triunghiul (x, z) — trei semiplane. */
function taieCuTriunghi(poli, t) {
  // orientarea triunghiului în (x, z), ca semiplanele să țină interiorul
  const s = (t[1][0] - t[0][0]) * (t[2][2] - t[0][2]) - (t[1][2] - t[0][2]) * (t[2][0] - t[0][0]);
  let out = poli;
  for (let k = 0; k < 3 && out.length >= 3; k++) {
    const a = t[k], b = t[(k + 1) % 3];
    // interiorul: semnul lui s pentru produsul (b − a) × (p − a)
    const A = -(b[2] - a[2]) * Math.sign(s), B = (b[0] - a[0]) * Math.sign(s);
    out = taie(out, -A, -B, A * a[0] + B * a[2]);
  }
  return out;
}

/**
 * @param {{ suprafete: Array<{contur: number[][], material: string, strat: number}>,
 *           culori: Record<string, number[]>, relief: object, reliefPetic: object|null,
 *           pastreaza?: Function, subPetic?: Function }} o
 */
export function creeazaDrapaj({ suprafete, culori, relief, reliefPetic, pastreaza, subPetic }) {
  const baza = retea(relief, { x: 0, z: 0 }, pastreaza);
  const petic = reliefPetic ? retea(reliefPetic, reliefPetic.meta?.deplasare_scena ?? { x: 0, z: 0 }, undefined) : null;
  const straturi = new Map();
  // Câte celule cercetează și câte tăieri face: proba din `npm run verifica-sanctuar`.
  const numar = { celule: 0, taieri: 0 };
  for (const sup of suprafete) {
    const rgb = culori[sup.material];
    if (!rgb) continue;
    if (!straturi.has(sup.strat)) straturi.set(sup.strat, creeazaScriitor());
    const s = straturi.get(sup.strat);
    const xs = sup.contur.map((p) => p[0]), zs = sup.contur.map((p) => p[1]);
    const cutie = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    for (const [plasa, sub] of [[petic, true], [baza, false]]) {
      if (!plasa) continue;
      const { c0, c1, r0, r1 } = plasa.interval(...cutie);
      for (let r = r0; r <= r1; r++) {
        // Pe fiecare rând, numai coloanele pe care poligonul le atinge în fâșia
        // rândului, nu toată cutia lui: suprafețele acoperă 26 807 m², iar cutiile lor
        // 156 953. Cu o celulă de margine de fiecare parte:
        // o celulă cu poligonul doar pe muchie poate da tot un poligon degenerat, iar
        // una mai departe stă la cel puțin un pas de el, deci nu dă nimic. Ordinea
        // celulelor rămâne aceeași, deci și ce se scrie, la octet.
        const iv = intervalX(sup.contur, plasa.Z(r), plasa.Z(r + 1));
        if (!iv) continue;
        const ca = Math.max(c0, plasa.col(iv[0]) - 1), cb = Math.min(c1, plasa.col(iv[1]) + 1);
        for (let c = ca; c <= cb; c++) {
          numar.celule++;
          // Peticul acoperă numai gaura; în afara ei celulele lui nu sunt randate. Colțul
          // (X(c), Z(r)) e primul vârf al ambelor triunghiuri, deci testul de dinainte,
          // pe triunghiul gata făcut, dădea același răspuns.
          if (sub && subPetic && !subPetic(plasa.X(c) + 0.25, plasa.Z(r) + 0.25)) continue;
          const tt = plasa.triunghiuri(r, c);
          if (!tt) continue;
          for (const t of tt) {
            numar.taieri++;
            const q = taieCuTriunghi(sup.contur, t);
            if (q.length < 3) continue;
            const pl = plan(t);
            s.poligon(q.map(([x, z]) => [x, pl[0] * x + pl[1] * z + pl[2], z]), rgb, [0, 1, 0]);
          }
        }
      }
    }
  }

  const obiecte = [], resurse = [];
  let nrTriunghiuri = 0;
  for (const [strat, s] of [...straturi].sort((a, b) => a[0] - b[0])) {
    const { pozitii, culori: cul, cutie } = s.preda();
    if (!pozitii.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pozitii, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cul, 3, true));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(cutie.xMin, cutie.yMin, cutie.zMin), new THREE.Vector3(cutie.xMax, cutie.yMax, cutie.zMax));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 * strat,
    });
    const o = new THREE.Mesh(g, m);
    o.name = `drapaj-${strat}`;
    o.matrixAutoUpdate = false;
    o.updateMatrix();
    obiecte.push(o);
    resurse.push([g, m]);
    nrTriunghiuri += pozitii.length / 9;
  }
  return {
    obiecte, nrTriunghiuri, numar,
    dispose() {
      for (const [g, m] of resurse) {
        g.dispose(); g.deleteAttribute('position'); g.deleteAttribute('color'); m.dispose();
      }
      for (const o of obiecte) o.removeFromParent();
      resurse.length = 0;
    },
  };
}
