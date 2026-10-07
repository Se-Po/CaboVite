// Cusătura dintre două niveluri de relief: o fâșie de triunghiuri care leagă
// marginea nivelului dinăuntru de nodurile nivelului din afară, fără nicio crăpătură.
//
// Nivelurile au pași diferiți (2 m în alpha, 4, 32, 256 m în împrejurimi), iar
// nodurile lor nu cad unele peste altele: nodurile lui alpha merg pe ±1163 și ±1492,
// iar 1163 e prim, deci niciun pas mai mare de 2 m nu le prinde pe amândouă
// marginile. O muchie comună cu pași diferiți lasă joncțiuni în T — vârfuri ale unei
// plase care stau în mijlocul unei muchii a celeilalte —, iar pe ele se deschid
// crăpături prin care se vede marea.
//
// De aceea nivelul din afară NU se lipește de cel dinăuntru. Se oprește cu un
// dreptunghi mai încolo — primul dreptunghi pe nodurile lui care cuprinde strict
// gaura —, iar între cele două margini se coase un fermoar: fiecare vârf de pe
// marginea dinăuntru și fiecare de pe cea din afară e vârf al fâșiei, deci fiecare
// muchie de margine a unei plase e muchie și a fâșiei. Pozițiile se scriu din
// aceleași formule ca plasele (`geometriaGrilei`), deci vârfurile coincid la bit.
//
// Ordinea în care se cos: cele două bucle se parcurg în sensul acelor de ceasornic,
// de la colțul de nord-vest, iar fiecare vârf primește poziția proiecției lui pe
// dreptunghiul dinăuntru, ca lungime de arc. Două bucle convexe, una în cealaltă,
// cusute în ordinea asta nu se încalecă.

/**
 * Pozițiile nodurilor unei grile în scenă — aceleași formule ca în terrain.js, ca
 * vârfurile fâșiei să cadă exact pe ale plaselor.
 */
export function geometriaGrilei(relief, deplasare) {
  const { latime: w, inaltime: h, pasX, pasZ } = relief;
  const dep = deplasare ?? { x: 0, z: 0 };
  return {
    w, h, pasX, pasZ, dep,
    X: (c) => (c - (w - 1) / 2) * pasX + dep.x,
    Z: (r) => (r - (h - 1) / 2) * pasZ + dep.z,
    /** Indicele coloanei / rândului unui x / z de pe grilă (rotunjit). */
    col: (x) => Math.round((x - dep.x) / pasX + (w - 1) / 2),
    rand: (z) => Math.round((z - dep.z) / pasZ + (h - 1) / 2),
  };
}

/** NDVI-ul unui nod dintr-un strat (4 biți pe nod), sau NaN. */
export function ndviNod(strat, i) {
  if (!strat) return NaN;
  return strat.niveluri[(strat.coduri[i >> 1] >> ((i & 1) << 2)) & 15];
}

/**
 * Primul dreptunghi pe nodurile grilei care cuprinde STRICT dreptunghiul `H` (în
 * scenă): pe fiecare latură, cel mai apropiat nod de dincolo de ea. Între cele două
 * rămâne o fâșie lată de cel mult un pas — locul fermoarului.
 */
export function dreptunghiExterior(relief, deplasare, H) {
  const g = geometriaGrilei(relief, deplasare);
  const EPS = 1e-6;
  const cA = Math.ceil((H.x0 - EPS - g.dep.x) / g.pasX + (g.w - 1) / 2) - 1;
  const cB = Math.floor((H.x1 + EPS - g.dep.x) / g.pasX + (g.w - 1) / 2) + 1;
  const rA = Math.ceil((H.z0 - EPS - g.dep.z) / g.pasZ + (g.h - 1) / 2) - 1;
  const rB = Math.floor((H.z1 + EPS - g.dep.z) / g.pasZ + (g.h - 1) / 2) + 1;
  if (cA < 0 || rA < 0 || cB > g.w - 1 || rB > g.h - 1)
    throw new Error(`grila nu ajunge dincolo de gaură pe toate laturile (${cA}…${cB} × ${rA}…${rB} din ${g.w} × ${g.h})`);
  return { c0: cA, c1: cB, r0: rA, r1: rB, x0: g.X(cA), x1: g.X(cB), z0: g.Z(rA), z1: g.Z(rB) };
}

/**
 * Nodurile unei grile de pe un dreptunghi al ei (indici c0…c1 × r0…r1), ca buclă în
 * sensul acelor de ceasornic văzut de sus, de la colțul de nord-vest: nordul spre
 * est, estul spre sud, sudul spre vest, vestul spre nord. Fiecare nod o singură dată.
 *
 * `camp` (opțional, `campNeted` din terrain.js) adaugă fiecărui nod normala și
 * culoarea lui (`nrm`, `rgb`), pentru o fâșie care intră într-o plasă netezită.
 *
 * @returns {{x: number, y: number, z: number, ndvi: number, nrm?: Int8Array, rgb?: Uint16Array}[]}
 */
export function buclaNoduri(relief, deplasare, strat, d, camp = null) {
  const g = geometriaGrilei(relief, deplasare);
  const Y = relief.inaltimi;
  const nod = (r, c) => {
    const i = r * g.w + c;
    const v = { x: g.X(c), y: Y[i], z: g.Z(r), ndvi: ndviNod(strat, i) };
    return camp ? Object.assign(v, camp.nod(r, c)) : v;
  };
  const out = [];
  for (let c = d.c0; c < d.c1; c++) out.push(nod(d.r0, c));       // nord, spre est
  for (let r = d.r0; r < d.r1; r++) out.push(nod(r, d.c1));       // est, spre sud
  for (let c = d.c1; c > d.c0; c--) out.push(nod(d.r1, c));       // sud, spre vest
  for (let r = d.r1; r > d.r0; r--) out.push(nod(r, d.c0));       // vest, spre nord
  return out;
}

/** Dreptunghiul de noduri al unei grile întregi (pentru marginea nivelului dinăuntru). */
export function dreptunghiGrila(relief) {
  return { c0: 0, c1: relief.latime - 1, r0: 0, r1: relief.inaltime - 1 };
}

/**
 * Fermoarul dintre bucla dinăuntru și cea din afară.
 *
 * `cotaApa`: un triunghi cu toate trei vârfurile la cota de umplutură se aruncă, ca
 * celulele de apă din terrain.js — stă sub planul mării și nu se vede niciodată.
 *
 * Dacă vârfurile buclelor au normală și culoare (`buclaNoduri` cu `camp`), fâșia le
 * poartă mai departe, în `normale` și `culori`, pentru o plasă netezită. Ori amândouă
 * buclele le au, ori niciuna.
 *
 * @returns {{varfuri: Float32Array, ndvi: Float32Array, triunghiuri: Uint32Array, aruncate: number,
 *            normale?: Int8Array, culori?: Uint16Array}}
 */
export function fermoar(interior, exterior, { cotaApa = -Infinity } = {}) {
  // Dreptunghiul dinăuntru, din bucla lui.
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const v of interior) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
  const L = x1 - x0, Hh = z1 - z0, P = 2 * (L + Hh);
  // Lungimea de arc a proiecției unui punct pe dreptunghi, de la colțul NV, în sensul
  // acelor de ceasornic (nord: z = z0; x crește spre est, z spre sud).
  const arc = (x, z) => {
    const px = Math.min(x1, Math.max(x0, x)), pz = Math.min(z1, Math.max(z0, z));
    const dN = pz - z0, dE = x1 - px, dS = z1 - pz, dV = px - x0;
    const m = Math.min(dN, dE, dS, dV);
    if (m === dN && !(dV === 0 && pz > z0)) return px - x0;
    if (m === dE) return L + (pz - z0);
    if (m === dS) return L + Hh + (x1 - px);
    return 2 * L + Hh + (z1 - pz);
  };
  // Parametrii, monotoni de-a lungul buclei: o întoarcere peste colțul NV adaugă P.
  const param = (bucla) => {
    const t = new Float64Array(bucla.length);
    let ant = -Infinity;
    for (let k = 0; k < bucla.length; k++) {
      let v = arc(bucla[k].x, bucla[k].z);
      if (k > 0 && v < ant - 1e-9) v += P;
      t[k] = v; ant = v;
    }
    return t;
  };
  const tI = param(interior), tE = param(exterior);
  const m = interior.length, n = exterior.length;

  const cuCamp = !!interior[0]?.nrm;
  if ([...interior, ...exterior].some((v) => !!v.nrm !== cuCamp))
    throw new Error('fermoar: numai o parte din vârfuri au normală și culoare');
  const varfuri = [], ndvi = [], tri = [], nrm = [], rgb = [];
  const adauga = (v) => {
    varfuri.push(v.x, v.y, v.z); ndvi.push(v.ndvi);
    if (cuCamp) { nrm.push(...v.nrm); rgb.push(...v.rgb); }
    return ndvi.length - 1;
  };
  const iI = interior.map(adauga), iE = exterior.map(adauga);
  const V = (k) => [varfuri[k * 3], varfuri[k * 3 + 1], varfuri[k * 3 + 2]];
  let aruncate = 0;
  const triunghi = (a, b, c) => {
    const A = V(a), B = V(b), C = V(c);
    if (A[1] <= cotaApa + 0.01 && B[1] <= cotaApa + 0.01 && C[1] <= cotaApa + 0.01) { aruncate++; return; }
    // Fața în sus: (B − A) × (C − A) are componenta y pozitivă, ca la plase.
    const ux = B[0] - A[0], uz = B[2] - A[2], vx = C[0] - A[0], vz = C[2] - A[2];
    const cy = uz * vx - ux * vz;
    if (Math.abs(cy) < 1e-9) { aruncate++; return; }   // degenerat
    if (cy > 0) tri.push(a, b, c); else tri.push(a, c, b);
  };

  // Cusutul: la fiecare pas avansează bucla al cărei vârf următor vine primul.
  let i = 0, j = 0;
  while (i < m || j < n) {
    const tin = i + 1 < m ? tI[i + 1] : tI[0] + P;
    const ten = j + 1 < n ? tE[j + 1] : tE[0] + P;
    if (j >= n || (i < m && tin <= ten)) {
      triunghi(iI[i % m], iI[(i + 1) % m], iE[j % n]);
      i++;
    } else {
      triunghi(iI[i % m], iE[(j + 1) % n], iE[j % n]);
      j++;
    }
  }
  const rez = { varfuri: Float32Array.from(varfuri), ndvi: Float32Array.from(ndvi), triunghiuri: Uint32Array.from(tri), aruncate };
  if (cuCamp) { rez.normale = Int8Array.from(nrm); rez.culori = Uint16Array.from(rgb); }
  return rez;
}
