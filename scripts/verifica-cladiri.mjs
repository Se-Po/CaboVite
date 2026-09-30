// Verifică, în Node, clădirile din afara sanctuarului: ce încarcă pagina, ce
// construiește și cât de aproape stă de LiDAR.
//
//   npm run verifica-cladiri
//
// Nu scrie nimic. Construiește terenul și clădirile cu CODUL PAGINII —
// incarcaRelief, mascaBazei, creeazaTeren, incarcaCladiri, creeazaSanctuar —, cu
// `fetch` înlocuit de o citire din public/. Iese cu cod 1 dacă a picat vreo probă.
//
// Probele de fond au control negativ: acoperișurile (ridicate cu 1 m) și amprentele
// (mutate 2 m). Cer dalele MDS/MDT de 50 cm din date-sursa/; fără ele se sar și se
// spune. Vârful farului e o probă de CONSISTENȚĂ: e chiar maximul MDS, deci prinde
// numai o greșeală de transport până în pagină.

import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { incarcaCladiri, incarcaRelief } from '../src/scene/loaders.js';
import { creeazaTeren, mascaBazei } from '../src/scene/terrain.js';
import { incarcaPaleta, paletaCurenta } from '../src/scene/palette.js';
import { creeazaSanctuar } from '../src/scene/sanctuar.js';
import { fereastraLidar, fisierDala, daleFereastra } from './comun/lidar.mjs';

const BUGET = { triunghiuri: 6000, json_kb: 20 };
const FISIER = 'public/data/cladiri_v1.json';
const MDS_FAR = 168.28;

let picate = 0;
const proba = (bun, text) => {
  console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`);
  if (!bun) picate++;
};
const cuantila = (v, q) => { const s = v.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// ------------------------------------------------------------ fetch din public/

// Ca Vite: o cale care nu există întoarce 200 și pagina index, nu 404.
const INDEX = readFileSync('index.html');
const dinDisc = async (url) => {
  const f = 'public' + url;
  if (!existsSync(f)) return new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html' } });
  return new Response(readFileSync(f), { status: 200 });
};
globalThis.fetch = dinDisc;

let avertismente = [];
console.warn = (...a) => { avertismente.push(a.join(' ')); };
const cuAvertismente = async (f) => { avertismente = []; let r, e = null; try { r = await f(); } catch (x) { e = x; } return { r, e, avert: avertismente.slice() }; };

// ------------------------------------------------------------ 1. încărcătorul

console.log('\nÎncărcătorul: fiecare cale de eșec întoarce null, cu un avertisment, fără să arunce');
const original = JSON.parse(readFileSync(FISIER, 'utf8'));
const cuRaspuns = (raspuns) => async () => { globalThis.fetch = async () => raspuns(); try { return await incarcaCladiri(); } finally { globalThis.fetch = dinDisc; } };
const json = (o) => new Response(JSON.stringify(o), { status: 200 });
const cai = [
  ['fișier lipsă (serverul dă index.html cu 200)', () => new Response(INDEX, { status: 200 })],
  ['HTTP 404', () => new Response('', { status: 404 })],
  ['JSON trunchiat', () => new Response(JSON.stringify(original).slice(0, 2000), { status: 200 })],
  // datele sanctuarului au aceeași schemă: un încărcător care le-ar primi ar construi sanctuarul de două ori
  ['sanctuarul în locul clădirilor', () => new Response(readFileSync('public/data/sanctuar_v2.json'), { status: 200 })],
  ['schemă necunoscută', () => json({ ...original, versiune_schema: 2 })],
  ['material fără rgb', () => json({ ...original, materiale: { ...original.materiale, var: { rgb: [300, 0, 0] } } })],
  ['listă lipsă', () => { const o = { ...original }; delete o.cupole; return json(o); }],
];
for (const [nume, r] of cai) {
  const { r: d, e, avert } = await cuAvertismente(cuRaspuns(r));
  proba(d === null && !e && avert.length === 1, `${nume}: ${e ? `ARUNCĂ ${e.message}` : d === null ? `null, „${avert[0]?.slice(0, 70)}"` : 'a trecut'}`);
}
{
  const { r: d, avert } = await cuAvertismente(cuRaspuns(() => json(original)));
  proba(d?.nume === original.nume && avert.length === 0, 'fișierul adevărat se încarcă, fără avertismente');
}

// ------------------------------------------------------------ 2. construcția

console.log('\nConstrucția, cu codul paginii');
await incarcaPaleta();
const incarcat = await incarcaRelief();
const relief = incarcat.baza ?? incarcat;
const reliefPetic = incarcat.baza ? incarcat : null;
const { pastreaza, subPetic } = mascaBazei(relief, reliefPetic);
const paleta = paletaCurenta();
const teren = creeazaTeren(relief, { pastreaza, paleta });
const petic = reliefPetic ? creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena, paleta }) : null;
const inaltimeLa = (x, z) => (petic && subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z));
const b = relief.meta.bbox_tm06;
const ancora = { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 };
const date = await incarcaCladiri();
const { r: cladiri, avert: avertConstructie } = await cuAvertismente(() => creeazaSanctuar({ date, inaltimeLa, ancora, eticheta: 'clădiri' }));
proba(cladiri !== null, 'clădirile se construiesc');
if (!cladiri) { console.log(`\n${picate} probe picate`); process.exit(1); }
proba(avertConstructie.length === 0, `niciun element sărit (${avertConstructie.length} avertismente${avertConstructie.length ? `: ${avertConstructie.slice(0, 3).join(' | ')}` : ''})`);
proba(cladiri.nrTriunghiuri.cladiri <= BUGET.triunghiuri, `${cladiri.nrTriunghiuri.cladiri} triunghiuri, buget ${BUGET.triunghiuri}`);
const kb = readFileSync(FISIER).length / 1024;
proba(kb <= BUGET.json_kb, `${FISIER}: ${kb.toFixed(1)} KB, buget ${BUGET.json_kb} KB`);
proba(cladiri.poi === null && cladiri.obiecte.length === 1, 'fără etichetă și fără suprafețe pe teren: un singur obiect');
const grupuri = [...cladiri.cutiiGrupuri.keys()].sort();
proba(grupuri.join() === 'casa_da_ronca,far', `grupurile pentru umbre: ${grupuri.join(', ')}`);
{
  const { r, avert } = await cuAvertismente(() => creeazaSanctuar({ date, inaltimeLa, ancora: { x: ancora.x + 1, y: ancora.y }, eticheta: 'clădiri' }));
  proba(r === null && avert.length === 1 && avert[0].startsWith('clădiri:'), `ancoră greșită: null, „${avert[0]?.slice(0, 60)}"`);
  // o cheie de material inexistentă în profilul farului: altfel cupola ieșea neagră, tăcut
  const stricat = structuredClone(date);
  stricat.cupole[0].materiale_profil[0] = 'inexistent';
  const { r: r2, avert: a2 } = await cuAvertismente(() => creeazaSanctuar({ date: stricat, inaltimeLa, ancora, eticheta: 'clădiri' }));
  proba(r2 !== null && a2.some((w) => w.includes('far.turn') && w.includes('materiale_profil')) && r2.nrTriunghiuri.cladiri < cladiri.nrTriunghiuri.cladiri,
    `material inexistent în profilul farului: farul sărit, cu avertisment, restul construit (${r2?.nrTriunghiuri.cladiri} triunghiuri)`);
  r2?.dispose();
}

// ------------------------------------------------------------ 3. geometria

console.log('\nGeometria');
const poz = cladiri.obiect.geometry.attributes.position.array;
proba(poz.every(Number.isFinite), `toate cele ${poz.length / 3} vârfuri sunt finite`);
{
  const convex = (c) => { let semn = 0; for (let k = 0; k < c.length; k++) { const p = c[k], q = c[(k + 1) % c.length], r = c[(k + 2) % c.length]; const x = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); if (Math.abs(x) < 1e-9) continue; if (semn && Math.sign(x) !== semn) return false; semn = Math.sign(x); } return true; };
  const neconvexe = date.corpuri.filter((c) => !convex(c.contur)).map((c) => c.cheie);
  proba(neconvexe.length === 0, `toate cele ${date.corpuri.length} corpuri au contur convex${neconvexe.length ? `: ${neconvexe.join(', ')}` : ''}`);
  let yMax = -Infinity;
  for (let i = 1; i < poz.length; i += 3) yMax = Math.max(yMax, poz[i]);
  proba(Math.abs(yMax - MDS_FAR) < 0.01, `cel mai înalt vârf e la ${yMax.toFixed(2)} m, cât vârful MDS al farului (${MDS_FAR})`);
  const [xf, zf] = date.cupole[0].centru;
  const lov = cladiri.loveste(new THREE.Ray(new THREE.Vector3(xf, 400, zf), new THREE.Vector3(0, -1, 0)));
  proba(lov?.cheie === 'far.turn' && Math.abs(lov.y - MDS_FAR) < 0.01, `raza verticală pe axul farului lovește ${lov?.cheie} la ${lov?.y.toFixed(3)} m`);
}

// ------------------------------------------------------------ 4. față de LiDAR

console.log('\nFață de LiDAR (cere dalele MDS/MDT de 50 cm din date-sursa/)');
const laTM = (x, z) => [x + ancora.x, ancora.y - z];
const inPoli = (x, z, c) => { let in_ = false; for (let i = 0, j = c.length - 1; i < c.length; j = i++) { const [xi, zi] = c[i], [xj, zj] = c[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) in_ = !in_; } return in_; };
const cutie = (c) => [Math.min(...c.map((p) => p[0])), Math.max(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[1]))];
// Clădirea întreagă: părțile ei au cheia „tip.osm[.k]”; farul e cupola.
const cladire = (c) => c.cheie.split('.').slice(0, 2).join('.');
const familii = new Map();
for (const c of [...date.corpuri, ...date.cupole]) (familii.get(cladire(c)) ?? familii.set(cladire(c), []).get(cladire(c))).push(c.contur);
const toateC = [...familii.values()].flat();
const [X0, X1, Z0, Z1] = cutie(toateC.flat());
// Fereastra LiDAR peste toate clădirile, pe grupuri (sunt la ~400 m una de alta).
const lipsa = [...familii.values()].flatMap((f) => {
  const [a0, a1, b0, b1] = cutie(f.flat()); const [x0, y1] = laTM(a0 - 4, b0 - 4), [x1, y0] = laTM(a1 + 4, b1 + 4);
  return ['MDS', 'MDT'].flatMap((tip) => daleFereastra({ x0: Math.floor(x0), x1: Math.ceil(x1), y0: Math.floor(y0), y1: Math.ceil(y1) }).filter((d) => !fisierDala(tip, d)).map((d) => `${tip}-${d}`));
});
if (lipsa.length) console.log(`       SĂRIT: lipsesc dalele ${[...new Set(lipsa)].join(', ')}`);
else {
  void X0; void X1; void Z0; void Z1;
  // Câte o fereastră pe clădire, cu 4 m de margine; pixelul (x, z) al scenei → MDS, MDT.
  const lidar = new Map();
  for (const [k, f] of familii) {
    const [a0, a1, b0, b1] = cutie(f.flat());
    const [x0, y1] = laTM(a0 - 4, b0 - 4), [x1, y0] = laTM(a1 + 4, b1 + 4);
    const F = { x0: Math.floor(x0), x1: Math.ceil(x1), y0: Math.floor(y0), y1: Math.ceil(y1) };
    const s = fereastraLidar('MDS', F), t = fereastraLidar('MDT', F);
    const la = (r, X, Y) => { const c = Math.floor((X - F.x0) / 0.5), rr = Math.floor((F.y1 - Y) / 0.5); if (c < 0 || c >= r.W || rr < 0 || rr >= r.H) return NaN; const v = r.v[rr * r.W + c]; return v === -999 ? NaN : v; };
    lidar.set(k, { mds: (x, z) => la(s, ...laTM(x, z)), mdt: (x, z) => la(t, ...laTM(x, z)) });
  }
  // pixelii LiDAR (centre la x.25 / x.75 în TM06, deci și în scenă) dintr-un contur
  const pixeli = function* (c, dx = 0, dz = 0) {
    const [x0, x1, z0, z1] = cutie(c);
    for (let x = Math.floor((x0 + dx) * 2) / 2 + 0.25; x < x1 + dx; x += 0.5) for (let z = Math.floor((z0 + dz) * 2) / 2 + 0.25; z < z1 + dz; z += 0.5) if (inPoli(x - dx, z - dz, c)) yield [x, z];
  };
  const jos = new THREE.Vector3(0, -1, 0);
  const cotaModel = (x, z) => cladiri.loveste(new THREE.Ray(new THREE.Vector3(x, 400, z), jos))?.y ?? NaN;
  const OPT = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [0.71, -0.71], [-0.71, 0.71], [-0.71, -0.71]].map(([a, bb]) => [a * 0.75, bb * 0.75]);

  // a. acoperișurile, pe pixelii de la cel puțin 0,75 m de marginea clădirii
  const abateri = [], peCladire = new Map();
  for (const [k, f] of familii) {
    if (k.startsWith('far.')) continue;
    const L = lidar.get(k), inF = (x, z) => f.some((c) => inPoli(x, z, c));
    for (const c of f) for (const [x, z] of pixeli(c)) {
      if (!OPT.every(([dx, dz]) => inF(x + dx, z + dz))) continue;
      // nu pe far: casa lipită de el își are acoperișul fără pixelii lui
      if (familii.get('far.turn').some((cf) => inPoli(x, z, cf) || OPT.some(([dx, dz]) => inPoli(x + dx, z + dz, cf)))) continue;
      const m = L.mds(x, z), t = L.mdt(x, z), y = cotaModel(x, z);
      if (!Number.isFinite(m) || !Number.isFinite(t) || !Number.isFinite(y) || m - t < 1) continue;
      abateri.push(y - m);
      (peCladire.get(k) ?? peCladire.set(k, []).get(k)).push(Math.abs(y - m));
    }
  }
  const med = cuantila(abateri, 0.5), p90 = cuantila(abateri.map(Math.abs), 0.9);
  proba(Math.abs(med) <= 0.25 && p90 <= 0.8, `acoperișurile față de MDS pe ${abateri.length} pixeli: mediana ${med.toFixed(3)} m, p90 |Δ| ${p90.toFixed(3)} m (prag 0,25 / 0,8)`);
  const rai = [...peCladire].map(([k, v]) => [k, cuantila(v, 0.9), v.length]).filter(([, p]) => p > 0.8);
  if (rai.length) console.log(`       peste 0,8 m la p90: ${rai.map(([k, p, n]) => `${k} ${p.toFixed(2)} (${n} px)`).join(', ')}`);
  const med1 = cuantila(abateri.map((d) => d + 1), 0.5);
  proba(!(Math.abs(med1) <= 0.25), `control negativ: acoperișurile ridicate cu 1 m dau mediana ${med1.toFixed(3)} m — proba ar pica`);

  // b. amprentele: partea din fiecare care stă pe clădire (nMDS > 1 m), față de ele mutate 2 m
  const peCladireFrac = (dx, dz) => {
    let n = 0, pe = 0;
    for (const [k, f] of familii) {
      const L = lidar.get(k);
      for (const c of f) for (const [x, z] of pixeli(c, dx, dz)) {
        const m = L.mds(x, z), t = L.mdt(x, z);
        if (!Number.isFinite(m) || !Number.isFinite(t)) continue;
        n++; if (m - t > 1) pe++;
      }
    }
    return pe / n;
  };
  const f0 = peCladireFrac(0, 0);
  const mutate = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dz]) => peCladireFrac(dx, dz));
  proba(f0 >= 0.9, `amprentele stau pe clădire (nMDS > 1 m) în ${(100 * f0).toFixed(1)}% din aria lor (prag 90%)`);
  proba(Math.max(...mutate) < f0 - 0.08, `control negativ: mutate 2 m, cel mult ${(100 * Math.max(...mutate)).toFixed(1)}% (${mutate.map((v) => (100 * v).toFixed(1)).join(' / ')}) — proba le deosebește`);
}

console.log(picate ? `\n${picate} probe picate` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
