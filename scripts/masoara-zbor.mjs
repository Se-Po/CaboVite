// Zborul ortofotoului ORTOS-2025, măsurat pe el însuși: soarele din umbre,
// deplasarea imaginii față de LiDAR pe sol și cât se înclină acoperișurile.
//
//   npm run masoara-zbor
//
// De ce: vederea Satelit a paginii arată fotografia neiluminată, iar clădirile și
// cerul trebuie luminate cu soarele din ea, altfel umbrele modelelor merg într-o
// parte și cele din fotografie în alta. Cifra de până acum — azimut 96°, elevație
// 22,5° — venea dintr-o potrivire Lambert pe apele de țiglă ale aripii de nord
// (culori-sanctuar.mjs), iar cu fereastra de zbor a lotului 4 (24.05–25.07.2025) nu
// se împăca: la azimut 96° soarele n-a stat în vara aceea la 22,5°.
//
// Soarele se caută deci din UMBRE: pentru fiecare (azimut, elevație) se calculează
// pe MDS ce pixeli de sol stau în umbră — o rază spre soare care lovește ceva mai
// înalt —, iar scorul e cât de bine desparte masca aceea pixelii întunecați de cei
// luminați în ortofoto. Pe două zone, independent: sanctuarul și farul.
//
// Proba independentă nu e o a doua metodă pe aceeași imagine, ci cerul: perechea
// (azimut, elevație) trebuie să fie o poziție pe care soarele chiar a avut-o
// deasupra capului în fereastra de zbor. O pereche greșită, luată la întâmplare,
// n-ar cădea pe drumul soarelui; cea veche, 96° / 22,5°, nu cade. Vârful umbrei
// farului a fost încercat și lăsat: umbra turnului traversează acoperișurile și o
// curte deja în umbră, iar capătul ei nu se citește fără ambiguitate.
//
// Scrie date-sursa/derivate/zbor.json și imaginile de control zbor-<zonă>.png.
// Azimuturile sunt de GRILĂ (TM06), ca scena; efemeridele dau azimut adevărat, iar
// A_grilă = A_adevărat + 0,674°.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deschideOrtofoto, fereastra, ndvi, PRAG_NDVI } from './comun/ortofoto.mjs';
import { fereastraLidar } from './comun/lidar.mjs';
import { linear } from './comun/oklab.mjs';
import { pozitieSoare } from './comun/soare.mjs';
import { dinTM06 } from './comun/tm06.mjs';
import { scriePng } from './comun/png.mjs';
import { cereFisier } from './comun/cere.mjs';

const ORTO = 'date-sursa/ortofoto/ortos2025_cog_25cm_rgbi_jpg_464-3_v02.tif';
const IESIRE = 'date-sursa/derivate';
const GAMMA_GRILA = 0.673704; // A_grilă − A_adevărat, grade (CLAUDE.md, „Busola”)
const FEREASTRA_ZBOR = ['2025-05-24', '2025-07-25']; // lotul 4 al ORTOS-2025, după SNIG

// Zonele, în TM06, pe metri întregi (pixelii LiDAR de 0,5 m cad pe ele).
const ZONE = {
  sanctuar: { x0: -94640, x1: -94340, y0: -138130, y1: -137880 },
  far: { x0: -94760, x1: -94500, y0: -138620, y1: -138420 },
};
// Pentru înregistrarea pe sol trebuie relief, nu platou: versanții de lângă far.
const ZONA_SOL = { x0: -94900, x1: -94500, y0: -138800, y1: -138420 };

cereFisier(ORTO, 'dala de ortofoto ORTOS-2025 464-3', 'Vezi „Ortofotoul” în CLAUDE.md.');
mkdirSync(IESIRE, { recursive: true });
const o = deschideOrtofoto(ORTO, 0.25);
const R = Math.PI / 180;

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };

// ------------------------------------------------------------ datele unei zone

/** Ortofotoul la 0,25 m pe fereastra F lărgită cu `m` pixeli, benzile R G B N. */
function orto025(F, m = 0) {
  const c0 = Math.round((F.x0 - o.x0) / o.pas) - m, r0 = Math.round((o.y0 - F.y1) / o.pas) - m;
  const W = Math.round((F.x1 - F.x0) / o.pas) + 2 * m, H = Math.round((F.y1 - F.y0) / o.pas) + 2 * m;
  const b = [0, 1, 2, 3].map((k) => fereastra(o, k, c0, r0, W, H));
  const LIN = Float32Array.from({ length: 256 }, (_, v) => linear(v / 255));
  const Y = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) Y[k] = 0.2126 * LIN[b[0][k]] + 0.7152 * LIN[b[1][k]] + 0.0722 * LIN[b[2][k]];
  return { W, H, m, b, Y };
}

/** Luminanța blocului 2 × 2 al pixelului LiDAR i (lățimea W), decalat cu (di, dj) pixeli fini. */
const lumLa = (q, W, i, di = 0, dj = 0) => {
  const c = i % W, r = (i / W) | 0, k = (2 * r + q.m + dj) * q.W + (2 * c + q.m + di);
  return (q.Y[k] + q.Y[k + 1] + q.Y[k + q.W] + q.Y[k + q.W + 1]) / 4;
};

/**
 * Luminanța liniară la 0,5 m, din blocuri 2 × 2 de la 0,25 m începute la (i, j)
 * pixeli fini față de așezarea exactă. (0, 0) = pixelul LiDAR (c, r) acoperă exact
 * pixelii fini (2c, 2r)…(2c+1, 2r+1).
 */
function luminanta(q, W, H, i = 0, j = 0) {
  const Y = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) Y[k] = lumLa(q, W, k, i, j);
  return Y;
}

/** Corelația Pearson dintre a[i] și luminanța decalată, numai pe pixelii idx. */
function corelatieDecalata(a, q, W, idx, di, dj) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (const i of idx) {
    const x = a[i]; if (!Number.isFinite(x)) continue;
    const y = lumLa(q, W, i, di, dj);
    n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
  }
  return (sab - (sa * sb) / n) / Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n));
}

function incarcaZona(nume, F) {
  const mds = fereastraLidar('MDS', F), mdt = fereastraLidar('MDT', F);
  const { W, H, pas } = mds;
  const q = orto025(F, 8);
  const lum = luminanta(q, W, H);
  const nd = new Float32Array(W * H), nm = new Float32Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    let sR = 0, sN = 0;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const k = (2 * r + y + q.m) * q.W + (2 * c + x + q.m);
      sR += q.b[0][k]; sN += q.b[3][k];
    }
    const i = r * W + c;
    nd[i] = ndvi(sR, sN);
    nm[i] = mds.v[i] > -900 && mdt.v[i] > -900 ? mds.v[i] - mdt.v[i] : NaN;
  }
  let zMax = -Infinity;
  for (const z of mds.v) if (z > zMax) zMax = z;
  // Solul pe care se judecă: gol, fără vegetație, deasupra mării.
  const sol = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) sol[i] = nm[i] < 0.3 && nd[i] < PRAG_NDVI && mdt.v[i] > 1 ? 1 : 0;
  // Luminanța raportată la media solului din pătratul de ±15 m din jur, în
  // logaritm. Fără ea scorul compara materiale, nu umbre: terreiro-ul e mult mai
  // deschis decât pământul de alături, iar o mască absurdă care „umbrea" pământul
  // câștiga. O umbră rămâne mai întunecată decât vecinătatea ei; un material nu.
  const lumRel = relativLocal(lum, sol, W, H, 30);
  return { nume, F, W, H, pas, mds: mds.v, mdt: mdt.v, nm, nd, lum, lumRel, sol, q, zMax };
}

/** log(v) − log(media lui v pe masca m în pătratul de ±n pixeli). */
function relativLocal(v, m, W, H, n) {
  const S = new Float64Array((W + 1) * (H + 1)), N = new Uint32Array((W + 1) * (H + 1));
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c, k = (r + 1) * (W + 1) + c + 1;
    S[k] = (m[i] ? v[i] : 0) + S[k - W - 1] + S[k - 1] - S[k - W - 2];
    N[k] = m[i] + N[k - W - 1] + N[k - 1] - N[k - W - 2];
  }
  const out = new Float32Array(W * H).fill(NaN);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const a = Math.max(0, c - n), b = Math.min(W, c + n + 1), p = Math.max(0, r - n), s = Math.min(H, r + n + 1);
    const k = (x, y) => y * (W + 1) + x;
    const nn = N[k(b, s)] - N[k(b, p)] - N[k(a, s)] + N[k(a, p)];
    if (nn < 50) continue;
    const med = (S[k(b, s)] - S[k(b, p)] - S[k(a, s)] + S[k(a, p)]) / nn;
    out[r * W + c] = Math.log((v[r * W + c] + 1e-4) / (med + 1e-4));
  }
  return out;
}

// ------------------------------------------------------------ umbra și scorul

/** Vectorul spre soare în (est, nord, sus). */
const spreSoare = (az, el) => [Math.sin(az * R) * Math.cos(el * R), Math.cos(az * R) * Math.cos(el * R), Math.sin(el * R)];

/** 1 dacă pixelul i e în umbră pentru soarele (az, el), pe MDS. */
function inUmbra(z, i, az, el) {
  const { W, H, pas, mds, zMax } = z;
  const c0 = i % W, r0 = (i / W) | 0, z0 = mds[i] + 0.2;
  const dc = Math.sin(az * R), dr = -Math.cos(az * R), tg = Math.tan(el * R);
  const dMax = (zMax - z0) / tg;
  for (let d = pas; d <= dMax; d += pas) {
    const c = Math.round(c0 + (dc * d) / pas), r = Math.round(r0 + (dr * d) / pas);
    if (c < 0 || r < 0 || c >= W || r >= H) return 0;
    if (mds[r * W + c] > z0 + d * tg) return 1;
  }
  return 0;
}

/**
 * Pixelii pe care se judecă soarele: sol (nMDS < 0,3 m), fără vegetație, cel mult
 * la 40 m de ceva mai înalt de 3 m — umbrele cad acolo. Plus un filtru de pas.
 */
function pixeliSol(z, pasEsantion = 1) {
  const { W, H, nm } = z;
  const inalt = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inalt[i] = nm[i] > 3 ? 1 : 0;
  // Imagine integrală: câți pixeli înalți în pătratul de ±80 px (40 m).
  const I = new Uint32Array((W + 1) * (H + 1));
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++)
    I[(r + 1) * (W + 1) + c + 1] = inalt[r * W + c] + I[r * (W + 1) + c + 1] + I[(r + 1) * (W + 1) + c] - I[r * (W + 1) + c];
  const n = 80, out = [];
  for (let r = 0; r < H; r += pasEsantion) for (let c = 0; c < W; c += pasEsantion) {
    const i = r * W + c;
    if (!z.sol[i] || !Number.isFinite(z.lumRel[i])) continue;
    const a = Math.max(0, c - n), b = Math.min(W, c + n + 1), p = Math.max(0, r - n), s = Math.min(H, r + n + 1);
    if (I[s * (W + 1) + b] - I[p * (W + 1) + b] - I[s * (W + 1) + a] + I[p * (W + 1) + a] > 0) out.push(i);
  }
  return out;
}

/** Corelația punct-biserială dintre „luminat” și luminanță: cât desparte masca. */
function scor(z, idx, az, el) {
  let n1 = 0, s1 = 0, n0 = 0, s0 = 0, ss = 0;
  for (const i of idx) {
    const y = z.lumRel[i];
    ss += y * y;
    if (inUmbra(z, i, az, el)) { n0++; s0 += y; } else { n1++; s1 += y; }
  }
  const n = n0 + n1;
  if (n0 < 20 || n1 < 20) return -1;
  const m = (s0 + s1) / n, sd = Math.sqrt(ss / n - m * m);
  return ((s1 / n1 - s0 / n0) / sd) * Math.sqrt((n1 / n) * (n0 / n));
}

/** Grila grosieră, apoi două rafinări în jurul maximului. */
function cautaSoare(z, idx, eticheta) {
  const rar = idx.filter((_, k) => k % 9 === 0);
  let best = { s: -Infinity };
  for (let az = 0; az < 360; az += 5) for (let el = 10; el <= 80; el += 5) {
    const s = scor(z, rar, az, el);
    if (s > best.s) best = { s, az, el };
  }
  const mediu = idx.filter((_, k) => k % 3 === 0);
  for (const [raza, pas, set] of [[7, 1, mediu], [1.5, 0.25, idx]]) {
    const c = best;
    best = { s: -Infinity };
    for (let az = c.az - raza; az <= c.az + raza + 1e-9; az += pas)
      for (let el = Math.max(5, c.el - raza); el <= Math.min(85, c.el + raza) + 1e-9; el += pas) {
        const s = scor(z, set, (az + 360) % 360, el);
        if (s > best.s) best = { s, az: (az + 360) % 360, el };
      }
  }
  console.log(`  ${eticheta}: azimut de grilă ${best.az.toFixed(2)}°, elevație ${best.el.toFixed(2)}°, scor ${best.s.toFixed(4)} pe ${idx.length} pixeli`);
  return best;
}

// ------------------------------------------------------------ 1. soarele din umbre

console.log('\n1. Soarele, din umbrele de pe sol');
const zone = {};
const rezultate = {};
for (const [nume, F] of Object.entries(ZONE)) {
  const z = zone[nume] = incarcaZona(nume, F);
  const idx = pixeliSol(z);
  const best = cautaSoare(z, idx, nume);
  const sOpus = scor(z, idx, (best.az + 180) % 360, best.el);
  const sJos = scor(z, idx, best.az, best.el - 5), sSus = scor(z, idx, best.az, best.el + 5);
  proba(sOpus < best.s / 3, `${nume}, control: soarele opus (azimut + 180°) dă scorul ${sOpus.toFixed(4)}, față de ${best.s.toFixed(4)}`);
  proba(sJos < best.s && sSus < best.s, `${nume}, control: elevația ± 5° scade scorul (${sJos.toFixed(4)} / ${sSus.toFixed(4)})`);
  // Jumătățile de nord și de sud ale zonei, căutate separat.
  const yMij = (z.H / 2) | 0;
  const nord = cautaSoare(z, idx.filter((i) => ((i / z.W) | 0) < yMij), `${nume}, jumătatea de nord`);
  const sud = cautaSoare(z, idx.filter((i) => ((i / z.W) | 0) >= yMij), `${nume}, jumătatea de sud`);
  const dJum = Math.hypot(((nord.az - sud.az + 540) % 360) - 180, nord.el - sud.el);
  rezultate[nume] = {
    fereastra_tm06: F, pixeli: idx.length,
    azimut_grila: +best.az.toFixed(2), elevatie: +best.el.toFixed(2), scor: +best.s.toFixed(4),
    control: { soare_opus: +sOpus.toFixed(4), elevatie_minus_5: +sJos.toFixed(4), elevatie_plus_5: +sSus.toFixed(4) },
    jumatati: { nord: { azimut_grila: nord.az, elevatie: nord.el }, sud: { azimut_grila: sud.az, elevatie: sud.el }, diferenta_grade: +dJum.toFixed(2) },
  };
  console.log(`  ${nume}: jumătățile diferă cu ${dJum.toFixed(2)}° (azimut ${nord.az.toFixed(2)} / ${sud.az.toFixed(2)}, elevație ${nord.el.toFixed(2)} / ${sud.el.toFixed(2)})`);
}
const [A, B] = [rezultate.sanctuar, rezultate.far];
const dAB = Math.hypot(((A.azimut_grila - B.azimut_grila + 540) % 360) - 180, A.elevatie - B.elevatie);
console.log(`  sanctuarul și farul diferă cu ${dAB.toFixed(2)}°`);
if (dAB > 2) console.log('  (peste 2°: mozaicul poate avea linii de zbor diferite; pagina folosește soarele sanctuarului)');

// ------------------------------------------------------------ 2. ora zborului

console.log('\n2. Ora zborului, din efemeride — proba independentă');
const soareZbor = { azimut_grila: A.azimut_grila, elevatie: A.elevatie, sursa: 'umbrele din zona sanctuarului' };
let ora;
{
  const [lon, lat] = (() => { const g = dinTM06(-94500, -138000); return [g.lon, g.lat]; })();
  const potriviriPentru = (azGrila, elev) => {
    const tinta = spreSoare(azGrila - GAMMA_GRILA, elev);
    const out = [];
    for (let t = Date.parse(FEREASTRA_ZBOR[0]); t <= Date.parse(FEREASTRA_ZBOR[1]); t += 86400000) {
      let zi = null;
      for (let m = 4 * 60; m <= 20 * 60; m++) {
        const p = pozitieSoare(new Date(t + m * 60000), lat, lon);
        const v = spreSoare(p.azimut, p.elevatie);
        const d = Math.acos(Math.min(1, v[0] * tinta[0] + v[1] * tinta[1] + v[2] * tinta[2])) / R;
        if (!zi || d < zi.d) zi = { d, m, ...p };
      }
      out.push({ zi: new Date(t).toISOString().slice(0, 10), ...zi });
    }
    return out.sort((a, b) => a.d - b.d);
  };
  const potriviri = potriviriPentru(soareZbor.azimut_grila, soareZbor.elevatie);
  const vechi = potriviriPentru(96, 22.5)[0];
  const farP = potriviriPentru(B.azimut_grila, B.elevatie)[0];
  const b0 = potriviri[0];
  const hh = (m) => `${String((m / 60) | 0).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  console.log(`  cea mai bună potrivire: ${b0.zi} la ${hh(b0.m)} UTC, la ${b0.d.toFixed(2)}° de soarele măsurat`);
  console.log(`  zile la sub 1°: ${potriviri.filter((p) => p.d < 1).map((p) => `${p.zi} ${hh(p.m)}`).join(', ') || '(niciuna)'}`);
  proba(b0.d < 1.5, `există o oră în fereastra de zbor ${FEREASTRA_ZBOR.join(' – ')} cu soarele la cel mult 1,5° de cel măsurat`);
  proba(farP.d < 1.5, `și pentru soarele măsurat la far: ${farP.zi} ${hh(farP.m)} UTC, la ${farP.d.toFixed(2)}°`);
  proba(vechi.d > 1.5, `control: cifra veche, 96° / 22,5°, nu e o poziție a soarelui în fereastră — cea mai apropiată e la ${vechi.d.toFixed(2)}°`);
  ora = { control_cifra_veche_96_22_5_grade: +vechi.d.toFixed(2), far: { zi: farP.zi, ora_utc: hh(farP.m), diferenta_grade: +farP.d.toFixed(2) }, cea_mai_buna: { zi: b0.zi, ora_utc: hh(b0.m), diferenta_grade: +b0.d.toFixed(2) },
    sub_1_grad: potriviri.filter((p) => p.d < 1).map((p) => ({ zi: p.zi, ora_utc: hh(p.m), diferenta_grade: +p.d.toFixed(2) })) };
}

// ------------------------------------------------------------ 3. deplasarea pe sol

console.log('\n3. Deplasarea ortofotoului față de LiDAR, pe sol');
const umbrire = (dem, W, H, pas, az, el) => {
  const s = spreSoare(az, el), out = new Float32Array(W * H).fill(NaN), panta = new Float32Array(W * H).fill(NaN);
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
    const i = r * W + c;
    const gx = (dem[i + 1] - dem[i - 1]) / (2 * pas), gy = (dem[i - W] - dem[i + W]) / (2 * pas);
    const n = Math.hypot(gx, gy, 1);
    out[i] = Math.max(0, (-gx * s[0] - gy * s[1] + s[2]) / n);
    panta[i] = Math.acos(1 / n) / R;
  }
  return { h: out, panta };
};
let deplasareSol;
{
  const F = ZONA_SOL;
  const mdt = fereastraLidar('MDT', F), mds = fereastraLidar('MDS', F);
  const { W, H, pas } = mdt;
  const M = 8;
  const q = orto025(F, M);
  const nd = new Float32Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    let sR = 0, sN = 0;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const k = (2 * r + y + M) * q.W + (2 * c + x + M); sR += q.b[0][k]; sN += q.b[3][k]; }
    nd[r * W + c] = ndvi(sR, sN);
  }
  const { h, panta } = umbrire(mdt.v, W, H, pas, soareZbor.azimut_grila, soareZbor.elevatie);
  let zMaxU = -Infinity; for (const v of mds.v) if (v > zMaxU) zMaxU = v;
  const zU = { W, H, pas, mds: mds.v, zMax: zMaxU };
  const idx = [];
  for (let r = 2; r < H - 2; r++) for (let c = 2; c < W - 2; c++) {
    const i = r * W + c;
    if (mds.v[i] - mdt.v[i] < 0.3 && nd[i] < PRAG_NDVI && panta[i] < 35 && mdt.v[i] > 1 && !inUmbra(zU, i, soareZbor.azimut_grila, soareZbor.elevatie)) idx.push(i);
  }
  const cauta = (extra = 0) => {
    let best = { r: -Infinity };
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const r = corelatieDecalata(h, q, W, idx, i - extra, j);
      if (r > best.r) best = { r, i, j };
    }
    return best;
  };
  const b = cauta();
  const vecini = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => corelatieDecalata(h, q, W, idx, b.i + di, b.j + dj));
  console.log(`  corelația la vecinii maximului (±0,25 m): ${vecini.map((v) => v.toFixed(4)).join(' / ')}; la (0, 0): ${corelatieDecalata(h, q, W, idx, 0, 0).toFixed(4)}`);
  // Semnul: (i, j) > 0 înseamnă că detaliul fotografiei stă la est / la sud de LiDAR.
  const dx = b.i * o.pas, dy = -b.j * o.pas;
  // Maximul fin, dintr-o parabolă prin maxim și cei doi vecini, pe fiecare axă.
  const parabola = (s, m, d) => 0.5 * (s - d) / (s - 2 * m + d);
  const dxFin = (b.i + parabola(vecini[1], b.r, vecini[0])) * o.pas, dyFin = -(b.j + parabola(vecini[3], b.r, vecini[2])) * o.pas;
  console.log(`  pe ${idx.length} pixeli de sol gol: maximul corelației ${b.r.toFixed(4)} la (${dx.toFixed(2)}; ${dy.toFixed(2)}) m (x est, y nord); `
    + `între pixeli, (${dxFin.toFixed(2)}; ${dyFin.toFixed(2)}) m`);
  const bC = cauta(2);
  // cauta(2) citește fotografia la (i − 2): conținutul ei se mută 2 pixeli fini, 0,5 m, spre est.
  proba(bC.i === b.i + 2 && bC.j === b.j, `control: fotografia mutată sintetic cu 0,5 m spre est dă maximul cu exact 0,5 m mai la est (${bC.i - b.i} px, ${bC.j - b.j} px)`);
  const hOpus = umbrire(mdt.v, W, H, pas, (soareZbor.azimut_grila + 180) % 360, soareZbor.elevatie).h;
  const rOpus = corelatieDecalata(hOpus, q, W, idx, b.i, b.j);
  proba(rOpus < b.r / 2, `control: cu soarele opus corelația cade la ${rOpus.toFixed(4)}`);
  deplasareSol = { dx_m: dx, dy_m: dy, dx_fin_m: +dxFin.toFixed(3), dy_fin_m: +dyFin.toFixed(3), corelatie: +b.r.toFixed(4), pixeli: idx.length, fereastra_tm06: F,
    control: { mutare_sintetica_px: bC.i - b.i, corelatie_soare_opus: +rOpus.toFixed(4) } };
}

// ------------------------------------------------------------ 4. acoperișurile

console.log('\n4. Cât se deplasează acoperișurile (înclinarea clădirilor în fotografie)');
let acoperisuri;
{
  const z = zone.sanctuar;
  const M = 20; // ±5 m
  const q = orto025(z.F, M);
  const { h, panta } = umbrire(z.mds, z.W, z.H, z.pas, soareZbor.azimut_grila, soareZbor.elevatie);
  const clase = { 'nMDS 2–9 m': [2, 9], 'nMDS peste 9 m': [9, 99] };
  acoperisuri = {};
  for (const [nume, [a, b]] of Object.entries(clase)) {
    const idx = [];
    let sh = 0;
    for (let i = 0; i < z.W * z.H; i++) if (z.nm[i] >= a && z.nm[i] < b && z.nd[i] < PRAG_NDVI && panta[i] > 8 && panta[i] < 55) { idx.push(i); sh += z.nm[i]; }
    let best = { r: -Infinity };
    for (let j = -M; j <= M; j++) for (let i = -M; i <= M; i++) {
      const r = corelatieDecalata(h, q, z.W, idx, i, j);
      if (r > best.r) best = { r, i, j };
    }
    const dx = best.i * o.pas - deplasareSol.dx_m, dy = -best.j * o.pas - deplasareSol.dy_m, hm = sh / idx.length;
    acoperisuri[nume] = { pixeli: idx.length, inaltime_medie_m: +hm.toFixed(2), dx_m: +dx.toFixed(2), dy_m: +dy.toFixed(2), corelatie: +best.r.toFixed(4),
      inclinare_m_pe_m: +(Math.hypot(dx, dy) / hm).toFixed(4), directie_grila: +((Math.atan2(dx, dy) / R + 360) % 360).toFixed(1) };
    console.log(`  ${nume}: ${idx.length} px, înălțime medie ${hm.toFixed(1)} m → deplasare (${dx.toFixed(2)}; ${dy.toFixed(2)}) m față de sol, `
      + `${acoperisuri[nume].inclinare_m_pe_m} m/m spre ${acoperisuri[nume].directie_grila}°, corelație ${best.r.toFixed(3)}`);
  }
}

// ------------------------------------------------------------ imaginile de control

for (const [nume, z] of Object.entries(zone)) {
  const rgb = new Uint8Array(z.W * z.H * 3);
  const um = new Uint8Array(z.W * z.H);
  for (let i = 0; i < z.W * z.H; i++) um[i] = z.nm[i] < 0.3 ? inUmbra(z, i, soareZbor.azimut_grila, soareZbor.elevatie) : 0;
  for (let r = 0; r < z.H; r++) for (let c = 0; c < z.W; c++) {
    const i = r * z.W + c, k = (2 * r + z.q.m) * z.q.W + (2 * c + z.q.m);
    const margine = um[i] && ((c > 0 && !um[i - 1]) || (c < z.W - 1 && !um[i + 1]) || (r > 0 && !um[i - z.W]) || (r < z.H - 1 && !um[i + z.W]));
    rgb.set(margine ? [255, 40, 40] : [z.q.b[0][k], z.q.b[1][k], z.q.b[2][k]], i * 3);
  }
  writeFileSync(`${IESIRE}/zbor-${nume}.png`, scriePng(z.W, z.H, rgb));
}

const iesire = {
  generat: new Date().toISOString(),
  ortofoto: ORTO.split('/').pop(),
  conventie: 'azimut de grilă TM06 (ca scena), în grade, sensul acelor de ceas de la nordul grilei; A_grilă = A_adevărat + 0,674°',
  soare_zbor: soareZbor,
  zone: rezultate,
  sanctuar_fata_de_far_grade: +dAB.toFixed(2),
  ora_zborului: ora,
  deplasare_sol: deplasareSol,
  acoperisuri,
};
writeFileSync(`${IESIRE}/zbor.json`, JSON.stringify(iesire, null, 2));
console.log(`\nscris ${IESIRE}/zbor.json și zbor-*.png`);
console.log(picate ? `${picate} probe picate` : 'toate probele au trecut');
process.exit(picate ? 1 : 0);
