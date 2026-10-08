// Verifică, în Node, sanctuarul: ce încarcă pagina, ce construiește și cât de
// aproape stă de măsurători.
//
//   npm run verifica-sanctuar
//
// Nu scrie nimic. Construiește terenul și sanctuarul cu CODUL PAGINII —
// incarcaRelief, mascaBazei, creeazaTeren, incarcaSanctuar, creeazaSanctuar,
// creeazaZbor —, cu `fetch` înlocuit de o citire din public/. Rulează toate
// probele și iese cu cod 1 dacă a picat vreuna.
//
// Probele de măsurătoare (înălțimi, amprente) cer rastrul din date-sursa/, care
// nu intră în depozit; fără el se sar și se spune. Un prag pe care nu-l poate pica
// nimic nu dovedește nimic, deci probele de fond au control negativ — aceeași
// probă pe o greșeală cunoscută trebuie să pice: acoperișurile (ridicate cu 1 m),
// amprentele (mutate 2 m), drapajul (față de relieful interpolat, altă suprafață),
// zborul (pe nordul grilei), sha256-ul plasei (un vârf de turn mutat 1 mm) și fișa cu
// ecranul rotit (fără zbor nou, ca pe codul de până pe 2026-10-08). Turnul
// pe 5, 6 și 8 colțuri pica pe codul de dinainte de 2026-10-08, cu flișa la 34–140 m
// de el; zborul cu un punct incomplet sau cu camera NaN, în cinci din șase cazuri.
// Bugetul n-are nevoie de control, iar vârfurile
// turnurilor sunt o probă de CONSISTENȚĂ, nu una independentă: `varf` e chiar
// maximul MDS al părții, deci proba prinde doar o greșeală de transport a lui.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { incarcaRelief, incarcaSanctuar } from '../src/scene/loaders.js';
import { creeazaTeren, mascaBazei } from '../src/scene/terrain.js';
import { incarcaPaleta, paletaCurenta } from '../src/scene/palette.js';
import { creeazaSanctuar } from '../src/scene/sanctuar.js';
import { creeazaScriitor, turn, yMinim } from '../src/scene/sanctuar-forme.js';
import { creeazaZbor } from '../src/scene/zbor.js';
import { creeazaCamera } from '../src/scene/camera.js';
import { creeazaCadruFisa, distantaLaFisa, parteLibera, PRAG_ZBOR_NOU, RAZA_COMPLEX } from '../src/scene/fisa-cadru.js';
import { convergentaDinColturi } from '../src/scene/busola.js';
import { VEDERE_START } from '../src/scene/camera.js';

const BUGET = { cladiri: 70000, drapaj: 80000, json_kb: 150 };
const FISIER = 'public/data/sanctuar_v2.json';
// Amprenta plasei clădirilor, sha256 pe atributele ei, pe `sanctuar_v2` așezat pe
// `harta_v5` + `harta_v4` (talpa pereților vine din relief). O refactorizare a formelor
// trebuie s-o lase la bit; o schimbare voită a datelor, a reliefului sau a formelor o
// rescrie aici, cu motivul în commit. Citită pe 2026-10-08, înainte de turn() pe orice
// număr de colțuri.
const AMPRENTA = {
  position: '80849bfb6118470886b683fa4731c37c4d9ef40610f9fe35996c8fcee63b9f9e',
  color: '1c28d835408390bcfbfc0893f5db2cb20f003fb1544ab7ddf1c59ad7fb66987e',
  ocluzie: '5132591b4f8a24ccf918f9fc80de64e23419f47503000e3eed68ea04a39e5fbd',
};

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
const cuRaspuns = (raspuns) => async () => { globalThis.fetch = async () => raspuns(); try { return await incarcaSanctuar(); } finally { globalThis.fetch = dinDisc; } };
const json = (o) => new Response(JSON.stringify(o), { status: 200 });
const cai = [
  ['fișier lipsă (serverul dă index.html cu 200)', () => new Response(INDEX, { status: 200 })],
  ['HTTP 404', () => new Response('', { status: 404 })],
  ['JSON trunchiat', () => new Response(JSON.stringify(original).slice(0, 5000), { status: 200 })],
  ['nume străin', () => json({ ...original, nume: 'harta_v0' })],
  ['schemă necunoscută', () => json({ ...original, versiune_schema: 2 })],
  ['material fără rgb', () => json({ ...original, materiale: { ...original.materiale, var: { rgb: [300, 0, 0] } } })],
  ['listă lipsă', () => { const o = { ...original }; delete o.turnuri; return json(o); }],
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
const t0 = performance.now();
const incarcat = await incarcaRelief();
const relief = incarcat.baza ?? incarcat;
const reliefPetic = incarcat.baza ? incarcat : null;
const { pastreaza, subPetic } = mascaBazei(relief, reliefPetic);
const paleta = paletaCurenta();
const teren = creeazaTeren(relief, { pastreaza, paleta });
const petic = reliefPetic ? creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena, paleta }) : null;
const inaltimeLa = (x, z) => (petic && subPetic?.(x, z) ? petic.inaltimeLa(x, z) : teren.inaltimeLa(x, z));
const tTeren = performance.now();
const b = relief.meta.bbox_tm06;
const ancora = { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 };
const date = await incarcaSanctuar();
const retea = { relief, reliefPetic, pastreaza, subPetic };
const { r: sanctuar, avert: avertConstructie } = await cuAvertismente(() => creeazaSanctuar({ date, inaltimeLa, ancora, retea }));
const tSanctuar = performance.now();
console.log(`       terenul în ${(tTeren - t0).toFixed(0)} ms, sanctuarul în ${(tSanctuar - tTeren).toFixed(0)} ms`);
proba(sanctuar !== null, 'sanctuarul se construiește');
if (!sanctuar) { console.log(`\n${picate} probe picate`); process.exit(1); }
proba(avertConstructie.length === 0, `niciun element sărit (${avertConstructie.length} avertismente${avertConstructie.length ? `: ${avertConstructie.slice(0, 3).join(' | ')}` : ''})`);
const kb = readFileSync(FISIER).length / 1024;
proba(sanctuar.nrTriunghiuri.cladiri <= BUGET.cladiri, `clădiri: ${sanctuar.nrTriunghiuri.cladiri} triunghiuri, buget ${BUGET.cladiri}`);
proba(sanctuar.nrTriunghiuri.drapaj <= BUGET.drapaj, `suprafețe pe teren: ${sanctuar.nrTriunghiuri.drapaj} triunghiuri, buget ${BUGET.drapaj}`);
proba(kb <= BUGET.json_kb, `${FISIER}: ${kb.toFixed(1)} KB, buget ${BUGET.json_kb} KB`);

// ancora greșită și un element cu o coordonată lipsă
{
  const { r, avert } = await cuAvertismente(() => creeazaSanctuar({ date, inaltimeLa, ancora: { x: ancora.x + 1, y: ancora.y }, retea: null }));
  proba(r === null && avert.length === 1, `ancoră greșită: null, „${avert[0]?.slice(0, 60)}"`);
  const stricat = structuredClone(date);
  stricat.corpuri[0].contur[1] = [null, stricat.corpuri[0].contur[1][1]];
  const { r: r2, avert: a2 } = await cuAvertismente(() => creeazaSanctuar({ date: stricat, inaltimeLa, ancora, retea: null }));
  const poz = r2?.obiect.geometry.attributes.position.array;
  const finite = poz ? poz.every(Number.isFinite) : false;
  proba(r2 !== null && a2.length >= 1 && finite && a2.some((w) => w.includes(stricat.corpuri[0].cheie)),
    `coordonată lipsă în ${stricat.corpuri[0].cheie}: elementul sărit, restul construit, ${finite ? 'nicio' : 'CU'} valoare nefinită pe placă`);
  r2?.dispose();
}

// ------------------------------------------------------------ 3. geometria

console.log('\nGeometria');
const poz = sanctuar.obiect.geometry.attributes.position.array;
proba(poz.every(Number.isFinite), `toate cele ${poz.length / 3} vârfuri sunt finite`);
const ocl = sanctuar.obiect.geometry.attributes.ocluzie;
proba(ocl?.count === poz.length / 3 && ocl.normalized, `ocluzia: un octet normalizat pe vârf (${ocl?.count} vârfuri)`);
{
  // fiecare arcadă: stâlpii în ordine, cu goluri de cel puțin 0,2 m între ei
  const rele = [];
  for (const a of date.arcade) for (let k = 0; k + 1 < a.stalpi.length; k++) {
    const [ua, wa] = a.stalpi[k], [ub, wb] = a.stalpi[k + 1];
    if (ub - wb / 2 - (ua + wa / 2) < 0.2) rele.push(`${a.cheie}#${k}`);
  }
  proba(rele.length === 0, `stâlpii arcadelor sunt în ordine, cu goluri ≥ 0,2 m${rele.length ? `: ${rele.slice(0, 5).join(', ')}` : ''}`);
  // numărătoarea din sursă (Pinho Leal, 1880) trebuie să ajungă întreagă în pagină
  const FAT = JSON.parse(readFileSync('scripts/sanctuar/fatade.json', 'utf8'));
  for (const A of FAT.arcade) {
    const a = date.arcade.find((q) => q.cheie === A.cheie), F = FAT.ferestre_etaj.find((q) => q.arcada === A.cheie);
    const arce = a ? a.stalpi.length - 1 : null;
    const ferestre = date.detalii.filter((d) => d.cheie.startsWith(`${A.aripa}.fereastra.`)).length;
    proba(arce === A.arce_total && ferestre === 2 * F.perechi,
      `${A.aripa}: ${arce} arce și ${ferestre} ferestre la etaj, cât în sursă (${A.arce_total} și ${2 * F.perechi})`);
  }
  // corpurile rămân convexe după retragerea laturilor dinspre terreiro
  const convex = (c) => { let semn = 0; for (let k = 0; k < c.length; k++) { const p = c[k], q = c[(k + 1) % c.length], r = c[(k + 2) % c.length]; const x = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); if (Math.abs(x) < 1e-9) continue; if (semn && Math.sign(x) !== semn) return false; semn = Math.sign(x); } return true; };
  const neconvexe = date.corpuri.filter((c) => !convex(c.contur)).map((c) => c.cheie);
  proba(neconvexe.length === 0, `toate cele ${date.corpuri.length} corpuri au contur convex${neconvexe.length ? `: ${neconvexe.join(', ')}` : ''}`);
}
{
  // amprenta plasei: o refactorizare a formelor o lasă la bit
  const at = sanctuar.obiect.geometry.attributes;
  const sha = (a) => createHash('sha256').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
  const citit = Object.fromEntries(Object.keys(AMPRENTA).map((k) => [k, sha(at[k].array)]));
  const diferite = Object.keys(AMPRENTA).filter((k) => citit[k] !== AMPRENTA[k]);
  proba(diferite.length === 0, `sha256 pe position, color și ocluzie, cât în AMPRENTA${diferite.length ? `; diferă ${diferite.map((k) => `${k} (${citit[k]})`).join(', ')}` : ''}`);
  // control: vârful unui turn mutat cu 1 mm schimbă amprenta
  const mutat = structuredClone(date);
  mutat.turnuri[0].varf += 0.001;
  const r = creeazaSanctuar({ date: mutat, inaltimeLa, ancora, retea });
  proba(r && sha(r.obiect.geometry.attributes.position.array) !== AMPRENTA.position, `control negativ: ${mutat.turnuri[0].cheie} cu vârful mutat 1 mm dă altă amprentă position`);
  r?.dispose();
}
{
  // turn() pe orice număr de colțuri. Turnurile din date au câte 4, dar nimic nu cere
  // asta: încărcătorul verifică listele, `valid` numai numerele. Până pe 2026-10-08,
  // centrul flișei era suma colțurilor împărțită la 4: la 5 colțuri vârful ei ieșea la
  // 34,09 m de turn, la 6 la 69,44 m, fără niciun avertisment. Poligoane regulate cu
  // centrul în (100; 100) și raza de 3 m: vârful flișei cade pe centru, inelul ei de sus
  // stă la 1,27 m de el, iar nimic nu iese din amprenta lărgită cu cornișa (0,25 m).
  // Pragul, 0,1 mm, e de vreo 13 ori pasul Float32 de la 100 m.
  const C = [100, 100], R = 3, Y = { registru: 10, cornisa: 12, platforma: 14, varf: 20 };
  const cul = { var: [240, 240, 235], cantaria: [200, 190, 170] };
  const m = (v) => (v < 1e-3 ? v.toExponential(0) : v.toFixed(2));
  for (const n of [4, 5, 6, 8]) {
    const contur = Array.from({ length: n }, (_, k) => { const a = (2 * Math.PI * k) / n + 0.3; return [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]; });
    const s = creeazaScriitor();
    turn(s, contur, 0, Y, cul);
    const { pozitii: p } = s.preda();
    const yVarf = Math.fround(Y.varf), yInel = Math.fround(Y.platforma + 0.3);
    let varf = 0, nVarf = 0, inel = 0, nInel = 0, iesit = 0;
    for (let i = 0; i < p.length; i += 3) {
      const d = Math.hypot(p[i] - C[0], p[i + 2] - C[1]);
      if (p[i + 1] === yVarf) { varf = Math.max(varf, d); nVarf++; }
      if (p[i + 1] === yInel) { inel = Math.max(inel, Math.abs(d - 1.27)); nInel++; }
      iesit = Math.max(iesit, d - (R + 0.25));
    }
    proba(nVarf > 0 && nInel > 0 && varf < 1e-4 && inel < 1e-4 && iesit < 1e-4,
      `turn cu ${n} colțuri: vârful flișei la ${m(varf)} m de centru, inelul ei la ${m(inel)} m de 1,27 m, ${m(iesit)} m în afara amprentei`);
  }
}

// ------------------------------------------------------------ 4. suprafețele pe teren

console.log('\nSuprafețele de pe teren stau pe triunghiurile randate');
{
  /** Index pe celule al triunghiurilor unei plase randate, din atributul ei `position`. */
  const index = (t) => {
    const p = t.obiect.geometry.attributes.position.array;
    const m = new Map();
    const cheie = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
    for (let i = 0; i < p.length; i += 9) {
      const cx = (p[i] + p[i + 3] + p[i + 6]) / 3, cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      const k = cheie(cx, cz);
      (m.get(k) ?? m.set(k, []).get(k)).push(i);
    }
    return { p, m, cheie };
  };
  const ib = index(teren), ip = petic ? index(petic) : null;
  const pePlasa = ({ p, m, cheie }, x, z) => {
    const cx = Math.floor(x / 2), cz = Math.floor(z / 2);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const i of m.get(`${cx + dx},${cz + dz}`) ?? []) {
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5], qx = p[i + 6], qz = p[i + 8];
        const det = (bz - qz) * (ax - qx) + (qx - bx) * (az - qz);
        if (Math.abs(det) < 1e-12) continue;
        const l1 = ((bz - qz) * (x - qx) + (qx - bx) * (z - qz)) / det, l2 = ((qz - az) * (x - qx) + (ax - qx) * (z - qz)) / det, l3 = 1 - l1 - l2;
        if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * p[i + 1] + l2 * p[i + 4] + l3 * p[i + 7];
      }
    }
    return null;
  };
  let n = 0, afara = 0, maxDy = 0, unde = null;
  const dys = [];
  for (const o of sanctuar.obiecte.slice(1)) {
    const q = o.geometry.attributes.position.array;
    for (let i = 0; i < q.length; i += 3) {
      const x = q[i], y = q[i + 1], z = q[i + 2];
      // Pe cusătură amândouă plasele sunt randate; vârful trebuie să stea pe una din ele.
      const sub = [[ib, 'bază'], ...(ip ? [[ip, 'petic']] : [])]
        .map(([pl, nume]) => [pePlasa(pl, x, z), nume]).filter(([yt]) => yt !== null)
        .map(([yt, nume]) => [Math.abs(y - yt), nume]).sort((a, bb) => a[0] - bb[0]);
      n++;
      if (!sub.length) { afara++; continue; }
      const [dy, nume] = sub[0];
      dys.push(dy);
      if (dy > maxDy) { maxDy = dy; unde = [x, y, z, nume]; }
    }
  }
  proba(afara === 0, `${n} vârfuri: ${afara} în afara oricărui triunghi randat`);
  proba(maxDy <= 1e-3, `abaterea verticală față de triunghiul de sub ele: p99 ${(cuantila(dys, 0.99) * 1000).toFixed(3)} mm, maximă ${(maxDy * 1000).toFixed(3)} mm (prag 1 mm) la (${unde?.slice(0, 3).map((v) => v.toFixed(2)).join(', ')}) pe ${unde?.[3]}`);
  // Control negativ: aceleași vârfuri față de relieful interpolat biliniar — altă
  // suprafață decât triunghiurile, pe care ar fi stat un drapaj naiv. Trebuie să pice.
  let maxBiliniar = 0;
  for (const o of sanctuar.obiecte.slice(1)) {
    const q = o.geometry.attributes.position.array;
    for (let i = 0; i < q.length; i += 3) maxBiliniar = Math.max(maxBiliniar, Math.abs(q[i + 1] - inaltimeLa(q[i], q[i + 2])));
  }
  proba(maxBiliniar > 1e-3, `control negativ: față de relieful interpolat biliniar, abaterea maximă e ${(maxBiliniar * 1000).toFixed(1)} mm — un drapaj pe el ar pica`);
}

// ------------------------------------------------------------ 5. măsurătorile

console.log('\nFață de LiDAR (cere rastrul din date-sursa/)');
const RASTRU = 'date-sursa/derivate/sanctuar-rastru.json';
if (!existsSync(RASTRU)) console.log('       SĂRIT: lipsește rastrul; rulează `npm run nmds-sanctuar` cu dalele MDS pe disc');
else {
  const { incarcaRastru } = await import('./comun/rastru-sanctuar.mjs');
  const r = incarcaRastru();
  const laTM = (x, z) => [x + ancora.x, ancora.y - z];
  const laScena = (X, Y) => [X - ancora.x, ancora.y - Y];
  const inPoli = (x, z, c) => { let in_ = false; for (let i = 0, j = c.length - 1; i < c.length; j = i++) { const [xi, zi] = c[i], [xj, zj] = c[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) in_ = !in_; } return in_; };
  const cutie = (c) => [Math.min(...c.map((p) => p[0])), Math.max(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[1]))];
  // pixelii rastrului dintr-un contur de scenă
  const pixeli = function* (c) {
    const [x0, x1, z0, z1] = cutie(c);
    for (let x = Math.floor(x0 * 2) / 2 + 0.25; x < x1; x += 0.5) for (let z = Math.floor(z0 * 2) / 2 + 0.25; z < z1; z += 0.5) if (inPoli(x, z, c)) yield [x, z];
  };
  const mds = (x, z) => r.biliniar(r.mds, ...laTM(x, z)), mdt = (x, z) => r.biliniar(r.mdt, ...laTM(x, z));
  const jos = new THREE.Vector3(0, -1, 0);
  const cotaModel = (x, z) => sanctuar.loveste(new THREE.Ray(new THREE.Vector3(x, 400, z), jos))?.y ?? NaN;

  // a. acoperișurile, pe pixelii corpurilor fără coșuri: modelul față de MDS
  const cosuri = date.cosuri.map((c) => c.contur);
  const langaCos = (x, z) => cosuri.some((c) => { const [a0, a1, b0, b1] = cutie(c); return x > a0 - 0.75 && x < a1 + 0.75 && z > b0 - 0.75 && z < b1 + 0.75; });
  // Pixelii de lângă pereți amestecă acoperișul cu solul (pixelul are 0,5 m), deci
  // proba acoperișului îi lasă deoparte: numai pixelii la cel puțin 0,75 m de contur.
  // Conturul original al unei aripi e corpul + etajul + streașina, lipite pe laturi
  // comune; latura dintre ele nu e perete. Deci „interior" se judecă pe reuniunea lor:
  // punctul rămâne înăuntru mutat cu 0,75 m în opt direcții.
  const familie = (k) => date.corpuri.filter((c) => c.cheie === k || c.cheie === `${k}.etaj` || c.cheie === `${k}.streasina`).map((c) => c.contur);
  const OPT = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [0.71, -0.71], [-0.71, 0.71], [-0.71, -0.71]].map(([a, bb]) => [a * 0.75, bb * 0.75]);
  const abateri = [], peCorp = new Map();
  for (const c of date.corpuri) {
    if (/\.(etaj|streasina)$/.test(c.cheie)) continue;
    const fam = familie(c.cheie), inFam = (x, z) => fam.some((f) => inPoli(x, z, f));
    for (const cc of fam) for (const [x, z] of pixeli(cc)) {
      if (langaCos(x, z)) continue;
      if (!OPT.every(([dx, dz]) => inFam(x + dx, z + dz))) continue;
      const m = mds(x, z), t = mdt(x, z), y = cotaModel(x, z);
      if (!Number.isFinite(m) || !Number.isFinite(t) || !Number.isFinite(y) || m - t < 1) continue;
      abateri.push(y - m);
      (peCorp.get(c.cheie) ?? peCorp.set(c.cheie, []).get(c.cheie)).push(Math.abs(y - m));
    }
  }
  const med = cuantila(abateri, 0.5), p90 = cuantila(abateri.map(Math.abs), 0.9);
  proba(Math.abs(med) <= 0.25 && p90 <= 0.8, `acoperișurile față de MDS pe ${abateri.length} pixeli: mediana ${med.toFixed(3)} m, p90 |Δ| ${p90.toFixed(3)} m (prag 0,25 / 0,8)`);
  const rai = [...peCorp].map(([k, v]) => [k, cuantila(v, 0.9), v.length]).filter(([, p]) => p > 0.8).sort((a, b) => b[1] - a[1]);
  if (rai.length) console.log(`       peste 0,8 m la p90: ${rai.map(([k, p, n]) => `${k} ${p.toFixed(2)} (${n} px)`).join(', ')}`);
  const med1 = cuantila(abateri.map((d) => d + 1), 0.5);
  proba(Math.abs(med1) > 0.25, `control negativ: modelul ridicat cu 1 m pică (mediana ${med1.toFixed(3)} m)`);

  // b. vârfurile turnurilor: CONSISTENȚĂ, nu probă independentă — `varf` e maximul
  //    MDS pe interiorul erodat al părții, deci aici se prinde doar o greșeală de
  //    transport (cadru, rotunjire, cheie schimbată) între măsurare și pagină.
  for (const t of date.turnuri) {
    let max = -Infinity;
    for (const [x, z] of pixeli(t.contur)) { const m = mds(x, z); if (Number.isFinite(m)) max = Math.max(max, m); }
    proba(Math.abs(t.varf - max) <= 0.6, `consistență, ${t.cheie}: vârful ${t.varf.toFixed(2)} m, maximul MDS din contur ${max.toFixed(2)} m (prag 0,6)`);
  }

  // c. amprentele: corpurile + turnurile față de pixelii de clădire (nMDS > 1 m), pe o
  //    fereastră în jurul lor. Controlul negativ: toate amprentele mutate cu 2 m
  //    perpendicular pe aripi.
  const amprente = [...date.corpuri.map((c) => c.contur), ...date.turnuri.map((t) => t.contur), ...date.cupole.map((c) => c.contur)];
  const toate = amprente.flat(), [X0, X1, Z0, Z1] = cutie(toate);
  const perp = (() => { const a = date.arcade.find((q) => q.cheie === 'aripa_n.arcada'); return [a.m[0] * 2, a.m[1] * 2]; })();
  const iou = (dx, dz) => {
    let inter = 0, uniune = 0, amp = 0;
    for (let x = X0 - 3 + 0.25; x < X1 + 3; x += 0.5) for (let z = Z0 - 3 + 0.25; z < Z1 + 3; z += 0.5) {
      const m = mds(x, z), t = mdt(x, z);
      if (!Number.isFinite(m) || !Number.isFinite(t)) continue;
      const cladire = m - t > 1;
      const inAmp = amprente.some((c) => inPoli(x - dx, z - dz, c));
      if (inAmp) amp++;
      if (inAmp && cladire) inter++;
      if (inAmp || cladire) uniune++;
    }
    return { iou: inter / uniune, acoperire: inter / amp };
  };
  const bun = iou(0, 0), mutat = iou(perp[0], perp[1]);
  proba(bun.acoperire >= 0.95, `amprentele cad pe clădire (nMDS > 1 m) în ${(bun.acoperire * 100).toFixed(1)}% din aria lor (prag 95%)`);
  proba(mutat.acoperire < 0.95, `control negativ: mutate 2 m perpendicular pe aripi, ${(mutat.acoperire * 100).toFixed(1)}% — pică`);
  console.log(`       IoU față de toți pixelii de clădire din fereastră: ${bun.iou.toFixed(3)} (mutate: ${mutat.iou.toFixed(3)}); restul sunt ziduri, ruine, apeduct, coșuri — nu corpuri`);
}

// ------------------------------------------------------------ 6. cotele „REVIVE”, informativ

// Nu e o probă. Cotele au fost atribuite, la cercetarea de la început, unei planșe
// REVIVE 2019, dar nu apar pe niciuna dintre cele șapte planșe publicate, citite cu tot
// cu textul din desene: acelea au numai cote de teren. O cifră cu sursă necunoscută nu
// dovedește nimic, nici când se potrivește. Modelul stă direct pe LiDAR; diferențele se
// tipăresc numai ca să se vadă, fără prag.
console.log('\nCotele atribuite planșei REVIVE 2019 — informativ, proveniență neconfirmată, fără prag');
{
  const corp = (k) => date.corpuri.find((c) => c.cheie === k);
  const maxAcoperis = (c) => Math.max(...c.contur.map(([x, z]) => yMinim(c.plane, x, z)), ...(() => {
    // coama poate cădea în interiorul conturului: se caută pe o grilă de 0,5 m
    const xs = c.contur.map((p) => p[0]), zs = c.contur.map((p) => p[1]), v = [];
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.5) v.push(yMinim(c.plane, x, z));
    return v;
  })());
  const aripa = (k) => {
    const c = corp(`${k}.lunga.streasina`) ?? corp(`${k}.lunga`);
    const [p, q] = c.contur;
    return yMinim(c.plane, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  };
  const cazuri = [
    ['streașina aripii N', aripa('aripa_n'), 137.75],
    ['streașina aripii S', aripa('aripa_s'), 137.75],
    ['coama aripii N', maxAcoperis(corp('aripa_n.lunga')), 139.4],
    ['coama aripii S', maxAcoperis(corp('aripa_s.lunga')), 139.4],
    ['coama navei', maxAcoperis(corp('biserica.nava')), 145.9],
    ['vârful turnului cel mai înalt', Math.max(...date.turnuri.map((t) => t.varf)), 149.75],
    ['Casa da Água, vârful cupolei', Math.max(...date.cupole.filter((c) => c.cheie.includes('agua')).flatMap((c) => c.profil.map((p) => p[1]))), 143.27],
  ];
  for (const [nume, model, cota] of cazuri) {
    const d = model - cota;
    console.log(`  info  ${nume}: model ${model.toFixed(2)}, cota ${cota.toFixed(2)}, diferența ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} m`);
  }
}

// ------------------------------------------------------------ 7. zborul

console.log('\nZborul spre sanctuar');
{
  const gamma = convergentaDinColturi(relief.meta.colturi_geo);
  const n = -gamma, RAD = Math.PI / 180;
  // `nZbor`: nordul pe care îl primește zborul; busola se citește mereu pe cel adevărat.
  const faZbor = (inertie, faraMiscare = false, nZbor = n) => {
    // prefers-reduced-motion: zborul îl citește o dată, la creare
    globalThis.matchMedia = faraMiscare ? () => ({ matches: true, addEventListener() {} }) : undefined;
    // Camera și controalele paginii (camera.js), nu o copie scrisă de mână: copia de
    // dinainte n-avea nici `minPolarAngle`.
    const { camera, controale } = creeazaCamera(null);
    camera.aspect = 1.5; camera.updateProjectionMatrix();
    camera.position.set(500, 900, 1800);
    controale.target.set(144, 60, 581);
    controale.update();
    // o aruncare a utilizatorului: acumulatorul intern plin, încă neaplicat
    if (inertie) controale.rotateLeft(inertie);
    let ceas = 0;
    const acum = performance.now;
    performance.now = () => ceas;
    const zbor = creeazaZbor({ camera, controale, cereRandare: () => {}, azimutNordAdevarat: nZbor });
    zbor.spre(date.poi.zbor);
    const activDupaSpre = zbor.activ;
    let pasi = 0;
    for (; pasi < 400 && zbor.activ; pasi++) { ceas += 16.7; zbor.pas(); controale.rotita.pas(); controale.update(); }
    performance.now = acum;
    const t = controale.target, p = camera.position;
    const dx = p.x - t.x, dy = p.y - t.y, dz = p.z - t.z, R = Math.hypot(dx, dy, dz);
    const theta = Math.atan2(dx, dz), phi = Math.acos(dy / R);
    const z = date.poi.zbor;
    const eTinta = Math.hypot(t.x - z.tinta[0], t.y - z.tinta[1], t.z - z.tinta[2]);
    const eTheta = Math.abs(((theta - (180 - z.azimut - n) * RAD + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    const ePhi = Math.abs(phi - (90 - z.elevatie) * RAD), eR = Math.abs(R - z.distanta);
    // ce citește busola: azimutul poziției camerei față de nordul adevărat
    const busola = ((180 - theta / RAD - n) % 360 + 360) % 360;
    globalThis.matchMedia = undefined;
    return { eTinta, eTheta, ePhi, eR, busola, activ: zbor.activ, activDupaSpre, pasi };
  };
  for (const [inertie, faraMiscare] of [[0, false], [0.6, false], [0.6, true]]) {
    const z = faZbor(inertie, faraMiscare);
    const bun = !z.activ && z.eTinta < 1e-6 && z.eTheta < 1e-6 && z.ePhi < 1e-6 && z.eR < 1e-6;
    const cum = faraMiscare ? 'sub prefers-reduced-motion, după o aruncare' : inertie ? 'după o aruncare de 0,6 rad' : 'din repaus';
    proba(bun, `${cum}: aterizează la ${Math.max(z.eTinta, z.eR).toExponential(1)} m, ${Math.max(z.eTheta, z.ePhi).toExponential(1)} rad, în ${z.pasi} cadre`);
    if (faraMiscare) proba(!z.activDupaSpre && z.pasi === 0, 'sub prefers-reduced-motion nu există animație: camera e la capăt imediat după clic');
    proba(Math.abs(z.busola - date.poi.zbor.azimut) < 1e-6, `busola citește ${z.busola.toFixed(6)}°, cerut ${date.poi.zbor.azimut}°`);
  }
  // Control negativ: un zbor care ar fi luat nordul grilei drept nordul adevărat.
  const grila = faZbor(0, false, 0);
  proba(Math.abs(grila.busola - date.poi.zbor.azimut) > 0.5, `control negativ: pe nordul grilei busola ar citi ${grila.busola.toFixed(6)}° — pică`);

  // Înapoi la vederea de pornire: clicul pe busolă, în timp ce zborul spre sanctuar
  // e încă în aer. Vederea e dată ca puncte, deci nu depinde de nord.
  console.log('\nZborul înapoi la vederea de pornire');
  const faStart = ({ inertie = 0, redusLaClic = false, nZbor = n }) => {
    // prefers-reduced-motion citit la fiecare pas, ca să se poată schimba în zbor
    let redus = false;
    globalThis.matchMedia = () => ({ get matches() { return redus; }, addEventListener() {} });
    const { camera, controale } = creeazaCamera(null);
    camera.aspect = 1.5; camera.updateProjectionMatrix();
    camera.position.set(500, 900, 1800);
    controale.target.set(144, 60, 581);
    controale.update();
    let ceas = 0;
    const acum = performance.now;
    performance.now = () => ceas;
    const zbor = creeazaZbor({ camera, controale, cereRandare: () => {}, azimutNordAdevarat: nZbor });
    zbor.spre(date.poi.zbor);
    for (let i = 0; i < 10; i++) { ceas += 16.7; zbor.pas(); controale.rotita.pas(); controale.update(); }
    if (inertie) controale.rotateLeft(inertie);
    redus = redusLaClic;
    zbor.spre(VEDERE_START);
    const activDupaSpre = zbor.activ;
    let pasi = 0;
    for (; pasi < 400 && zbor.activ; pasi++) { ceas += 16.7; zbor.pas(); controale.rotita.pas(); controale.update(); }
    // Încă un cadru: sub reduced-motion, zborul vechi spre sanctuar nu trebuie să mai
    // ia camera înapoi.
    ceas += 16.7; zbor.pas(); controale.update();
    zbor.spre(VEDERE_START);   // al doilea clic, pe loc
    const peLoc = zbor.activ;
    performance.now = acum;
    globalThis.matchMedia = undefined;
    const t = controale.target, p = camera.position;
    const [px, py, pz] = VEDERE_START.pozitie, [tx, ty, tz] = VEDERE_START.tinta;
    return { eP: Math.hypot(p.x - px, p.y - py, p.z - pz), eT: Math.hypot(t.x - tx, t.y - ty, t.z - tz),
      activ: zbor.activ, activDupaSpre, peLoc, pasi, p: p.clone(), t: t.clone() };
  };
  const repaus = faStart({});
  for (const [z, cum] of [[repaus, 'din zborul spre sanctuar'], [faStart({ inertie: 0.6 }), 'după o aruncare de 0,6 rad'],
    [faStart({ inertie: 0.6, redusLaClic: true }), 'sub prefers-reduced-motion, cu zborul spre sanctuar în aer']]) {
    proba(!z.activ && z.eP < 1e-9 && z.eT < 1e-9, `${cum}: aterizează la ${Math.max(z.eP, z.eT).toExponential(1)} m, în ${z.pasi} cadre`);
  }
  const faraMiscare = faStart({ inertie: 0.6, redusLaClic: true });
  proba(!faraMiscare.activDupaSpre && faraMiscare.pasi === 0, 'sub prefers-reduced-motion camera e la capăt imediat după clic');
  proba(!repaus.peLoc, 'al doilea clic, deja acolo, nu pornește niciun zbor');
  const faraNord = faStart({ nZbor: 0 });
  proba(faraNord.p.distanceTo(repaus.p) < 1e-9 && faraNord.t.distanceTo(repaus.t) < 1e-9,
    `aterizarea nu depinde de nord: cu nordul grilei, la ${faraNord.p.distanceTo(repaus.p).toExponential(1)} m`);
  // Ce scrie busola în vederea de pornire: 306° NV. Pe nordul grilei ar scrie 307.
  const [px, , pz] = VEDERE_START.pozitie, [tx, , tz] = VEDERE_START.tinta;
  const thetaStart = Math.atan2(px - tx, pz - tz) / RAD;
  const citeste = (nord) => ((180 - thetaStart - nord) % 360 + 360) % 360;
  proba(Math.round(citeste(n)) === 306 && Math.round(citeste(0)) === 307,
    `busola citește ${citeste(n).toFixed(2)}° (306° NV); pe nordul grilei ar citi ${citeste(0).toFixed(2)}°`);

  // Un punct de privire incomplet și o cameră NaN. Math.min și Math.max lasă NaN să
  // treacă: până pe 2026-10-08, cu `distanta` lipsă zborul nu se mai termina și randa la
  // fiecare cadru, cu `azimut` lipsă se termina, dar cu camera NaN, cu un `null` în
  // țintă ducea ținta tăcut la cota 0, iar Home, animat, nu mai repara o cameră NaN. Pe codul
  // de atunci pică primele cinci. Control: același Home sub reduced-motion, care sărea
  // la capăt și înainte.
  console.log('\nZborul cu un punct incomplet sau cu camera NaN');
  const faNaN = ({ punct, cameraNaN = false, redus = false }) => {
    globalThis.matchMedia = () => ({ matches: redus, addEventListener() {} });
    const { camera, controale } = creeazaCamera(null);
    camera.aspect = 1.5; camera.updateProjectionMatrix();
    camera.position.set(500, 900, 1800);
    controale.target.set(144, 60, 581);
    controale.update();
    if (cameraNaN) camera.position.x = NaN;
    const p0 = camera.position.clone(), t0 = controale.target.clone();
    let ceas = 0, avertismente = 0;
    const acum = performance.now, warn = console.warn;
    performance.now = () => ceas;
    console.warn = () => { avertismente++; };
    const zbor = creeazaZbor({ camera, controale, cereRandare: () => {}, azimutNordAdevarat: n });
    zbor.spre(punct);
    let pasi = 0;
    for (; pasi < 2000 && zbor.activ; pasi++) { ceas += 16.7; zbor.pas(); controale.update(); }
    performance.now = acum; console.warn = warn;
    globalThis.matchMedia = undefined;
    const p = camera.position, t = controale.target;
    const [px, py, pz] = VEDERE_START.pozitie, [tx, ty, tz] = VEDERE_START.tinta;
    return {
      activ: zbor.activ, pasi, avertismente,
      finita: [p.x, p.y, p.z, t.x, t.y, t.z].every(Number.isFinite),
      neatinsa: p.equals(p0) && t.equals(t0),
      eStart: Math.max(Math.hypot(p.x - px, p.y - py, p.z - pz), Math.hypot(t.x - tx, t.y - ty, t.z - tz)),
    };
  };
  const poi = date.poi.zbor;
  for (const [punct, cum] of [
    [{ ...poi, distanta: undefined }, '`distanta` lipsă'],
    [{ ...poi, azimut: undefined }, '`azimut` lipsă'],
    [{ ...poi, tinta: [poi.tinta[0], null, poi.tinta[2]] }, 'un `null` în țintă'],
    [{ tinta: VEDERE_START.tinta, pozitie: VEDERE_START.tinta }, 'poziția chiar în țintă'],
  ]) {
    const z = faNaN({ punct });
    proba(!z.activ && z.pasi === 0 && z.neatinsa && z.avertismente === 1,
      `${cum}: zborul ${z.activ ? 'încă activ' : 'inactiv'} după ${z.pasi} cadre, camera ${z.neatinsa ? 'neatinsă' : 'mutată'}${z.finita ? '' : ' (NaN)'}, ${z.avertismente} avertisment(e)`);
  }
  const homeNaN = faNaN({ punct: VEDERE_START, cameraNaN: true });
  proba(!homeNaN.activ && homeNaN.finita && homeNaN.eStart < 1e-9,
    `camera NaN, apoi Home animat: zborul ${homeNaN.activ ? 'încă activ' : 'încheiat'} după ${homeNaN.pasi} cadre, camera ${homeNaN.finita ? `acasă, la ${homeNaN.eStart.toExponential(1)} m` : 'NaN'}`);
  const homeNaNRedus = faNaN({ punct: VEDERE_START, cameraNaN: true, redus: true });
  proba(!homeNaNRedus.activ && homeNaNRedus.finita && homeNaNRedus.eStart < 1e-9,
    `control: camera NaN, apoi Home sub reduced-motion, cum trecea și înainte: acasă, la ${homeNaNRedus.eStart.toExponential(1)} m`);
}

// ------------------------------------------------------------ 7b. fișa și ecranul rotit

// Fișa deschisă, apoi ecranul rotit: cadrul fișei (fisa-cadru.js), zborul și camera
// paginii. Canvasul e un obiect cu mărimea ecranului; cutia fișei se socotește după
// main.css — foaie jos până la 34rem, laterală peste —, cu textul mai înalt decât
// `max-height`, cum iese în pagină (la 390 × 844: 374 × 464 px, sus la 372; la
// 844 × 390: 384 × 134, la 444; 160). Pe codul de până pe 2026-10-08 rotirea refăcea
// numai decalajul: 844 × 390 → 390 × 844 lăsa ancora etichetei la x = −18, iar
// 1024 × 768 → 768 × 1024, la x = −68. Controlul e calea aceea, care a rămas pentru
// o cameră atinsă de utilizator după deschidere: aceeași măsurătoare trebuie să pice.
console.log('\nFișa deschisă, apoi ecranul rotit');
{
  const n = -convergentaDinColturi(relief.meta.colturi_geo);
  const REM = 16, poi = date.poi.zbor;
  const fisaLa = (w, h) => {
    if (w <= 34 * REM) {
      const H = 0.55 * h, bottom = h - 0.5 * REM;
      return { left: 0.5 * REM, right: w - 0.5 * REM, top: bottom - H, bottom, width: w - REM, height: H };
    }
    const width = Math.min(24 * REM, w - 2 * REM), right = w - REM, top = 10 * REM, H = Math.max(8 * REM, h - 16 * REM);
    return { left: right - width, right, top, bottom: top + H, width, height: H };
  };
  let ceas = 0;
  const acum = performance.now;
  performance.now = () => ceas;
  const sesiune = ({ redus = false } = {}) => {
    globalThis.matchMedia = () => ({ matches: redus, addEventListener() {} });
    const ecran = { w: 0, h: 0 };
    const canvas = {
      get clientWidth() { return ecran.w; }, get clientHeight() { return ecran.h; },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: ecran.w, height: ecran.h }),
    };
    const { camera, controale } = creeazaCamera(null);
    const zbor = creeazaZbor({ camera, controale, cereRandare: () => {}, azimutNordAdevarat: n });
    const cadru = creeazaCadruFisa({ camera, controale, zbor, poi, canvas, cutieFisa: () => fisaLa(ecran.w, ecran.h), cereRandare: () => {} });
    globalThis.matchMedia = undefined;
    const s = {
      camera, controale, zbor, cadru, ecran,
      // Ca bucla din scena.js: mărimea nouă, aspectul, apoi cadrul fișei.
      marime(w, h) { ecran.w = w; ecran.h = h; camera.aspect = w / h; camera.updateProjectionMatrix(); cadru.laRedimensionare(); },
      deschide() { cadru.laDeschidere(fisaLa(ecran.w, ecran.h)); },
      cadre(max = 400) { let k = 0; for (; k < max && zbor.activ; k++) { ceas += 16.7; zbor.pas(); controale.update(); } return k; },
      get poz() { return [camera.position.clone(), controale.target.clone()]; },
    };
    return s;
  };
  const deLa = (a, b) => Math.max(a[0].distanceTo(b[0]), a[1].distanceTo(b[1]));
  // Ce iese din partea liberă — din canvas sau sub fișă: 64 de puncte pe cercul
  // complexului, la cota țintei, ancora etichetei și colțurile corpurilor, pe teren.
  const masoara = ({ camera, controale, ecran }) => {
    camera.updateMatrixWorld();
    const f = fisaLa(ecran.w, ecran.h), v = new THREE.Vector3();
    const pe = (x, y, z) => { v.set(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * ecran.w, (-v.y * 0.5 + 0.5) * ecran.h, v.z]; };
    const liber = ([x, y, z]) => z < 1 && x >= 0 && x <= ecran.w && y >= 0 && y <= ecran.h && !(x >= f.left && x <= f.right && y >= f.top && y <= f.bottom);
    let cerc = 0, corp = 0, corpN = 0, bis = 0, bisN = 0;
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * 2 * Math.PI;
      if (!liber(pe(poi.tinta[0] + RAZA_COMPLEX * Math.cos(a), poi.tinta[1], poi.tinta[2] + RAZA_COMPLEX * Math.sin(a)))) cerc++;
    }
    for (const c of date.corpuri) for (const [x, z] of c.contur) {
      const afara = liber(pe(x, inaltimeLa(x, z), z)) ? 0 : 1;
      corp += afara; corpN++;
      if (c.cheie.startsWith('biserica.')) { bis += afara; bisN++; }
    }
    const anc = pe(...date.poi.ancora);
    return { cerc, corp, corpN, bis, bisN, anc, ancLibera: liber(anc), r: camera.position.distanceTo(controale.target) };
  };
  const scrie = (m) => `${m.r.toFixed(0)} m; din cercul complexului ${m.cerc}/64 afară, din colțurile corpurilor ${m.corp}/${m.corpN}, `
    + `ale bisericii ${m.bis}/${m.bisN}, ancora la (${m.anc[0].toFixed(0)}; ${m.anc[1].toFixed(0)})${m.ancLibera ? '' : ', afară'}`;
  const deschisLa = (w, h, o) => { const s = sesiune(o); s.marime(w, h); s.deschide(); s.cadre(); return s; };

  // Peisaj → portret: un zbor nou, până unde ar fi ajuns o deschidere direct în portret.
  for (const [[w0, h0], [w1, h1]] of [[[844, 390], [390, 844]], [[1024, 768], [768, 1024]]]) {
    const direct = deschisLa(w1, h1), mD = masoara(direct);
    const s = deschisLa(w0, h0);
    s.marime(w1, h1);
    const zboara = s.zbor.activ, pasi = s.cadre(), m = masoara(s), e = deLa(s.poz, direct.poz);
    proba(zboara && e < 1e-6 && m.ancLibera && m.cerc <= mD.cerc,
      `${w0} × ${h0} → ${w1} × ${h1}: zbor nou, ${pasi} cadre, la ${e.toExponential(1)} m de o deschidere direct în ${w1} × ${h1}: ${scrie(m)}`);
    // Control: o atingere după deschidere — camera e a utilizatorului, rotirea reface numai decalajul, ca înainte.
    const c = deschisLa(w0, h0), p0 = c.poz;
    c.controale.dispatchEvent({ type: 'start' });
    c.marime(w1, h1);
    const zboaraC = c.zbor.activ; c.cadre();
    const mC = masoara(c), eC = deLa(c.poz, p0);
    proba(!zboaraC && eC === 0 && !(mC.ancLibera && mC.cerc <= mD.cerc),
      `control, cu o atingere după deschidere: camera rămâne (${eC} m), ca pe codul vechi: ${scrie(mC)} — pică`);
  }

  // Portret → peisaj: camera stă doar mai departe; nicio mișcare.
  for (const [[w0, h0], [w1, h1]] of [[[390, 844], [844, 390]], [[768, 1024], [1024, 768]]]) {
    const s = deschisLa(w0, h0), p0 = s.poz;
    s.marime(w1, h1);
    const zboara = s.zbor.activ, m = masoara(s), mD = masoara(deschisLa(w1, h1));
    proba(!zboara && deLa(s.poz, p0) === 0 && m.ancLibera && m.cerc <= mD.cerc,
      `${w0} × ${h0} → ${w1} × ${h1}: niciun zbor, camera la ${deLa(s.poz, p0)} m de unde era: ${scrie(m)}`);
  }

  // Bara de adrese: ±56 px pe înălțime nu trec de prag.
  {
    const s = deschisLa(390, 844), p0 = s.poz, r0 = masoara(s).r;
    const cerute = [];
    for (const h of [900, 790, 844]) {
      s.marime(390, h);
      cerute.push(distantaLaFisa(poi, s.camera, parteLibera(fisaLa(390, h), { left: 0, top: 0, width: 390, height: h })));
      if (s.zbor.activ) break;
    }
    proba(!s.zbor.activ && deLa(s.poz, p0) === 0 && Math.max(...cerute) <= PRAG_ZBOR_NOU * r0,
      `390 × 844 → 900 → 790 → 844 px de înălțime (bara de adrese): niciun zbor; cerute ${cerute.map((d) => d.toFixed(0)).join(' / ')} m față de ${r0.toFixed(0)} m, prag ×${PRAG_ZBOR_NOU}`);
  }

  // Fișa închisă: rotirea nu mută camera și nu lasă decalaj.
  {
    const s = sesiune(), p0 = s.poz;
    s.marime(844, 390); s.marime(390, 844);
    proba(!s.zbor.activ && deLa(s.poz, p0) === 0 && !s.camera.view?.enabled, `fără fișă: rotirea nu mută camera (${deLa(s.poz, p0)} m) și nu lasă decalaj`);
    s.deschide(); s.cadre(); s.cadru.laInchidere();
    proba(!s.camera.view?.enabled && !s.cadru.deschisa, 'fișa închisă: decalajul se șterge');
  }

  // Rotirea în timpul zborului de la deschidere: zborul nou merge până unde trebuie,
  // deși camera, încă pe drum, era mai departe decât cere portretul.
  {
    const direct = deschisLa(390, 844), rD = masoara(direct).r;
    const s = sesiune();
    s.marime(844, 390); s.deschide();
    for (let k = 0; k < 3; k++) { ceas += 16.7; s.zbor.pas(); s.controale.update(); }
    const rPeDrum = masoara(s).r;
    s.marime(390, 844); s.cadre();
    const e = deLa(s.poz, direct.poz);
    proba(e < 1e-6, `rotit după 3 cadre de zbor, cu camera la ${rPeDrum.toFixed(0)} m: aterizează la ${e.toExponential(1)} m de o deschidere în portret (${rD.toFixed(0)} m)`
      + `${rD <= PRAG_ZBOR_NOU * rPeDrum ? '; o comparație cu distanța de atunci n-ar fi zburat' : ''}`);
  }

  // Sub prefers-reduced-motion, zborul nou sare la capăt, în 0 cadre.
  {
    const direct = deschisLa(390, 844);
    const s = deschisLa(844, 390, { redus: true });
    s.marime(390, 844);
    const activ = s.zbor.activ, e = deLa(s.poz, direct.poz);
    proba(!activ && e < 1e-6, `sub prefers-reduced-motion: camera în portret imediat, la ${e.toExponential(1)} m, fără zbor animat`);
  }
  performance.now = acum;
}

// ------------------------------------------------------------ 8. clădirea lovită

console.log('\nPanoul punctului: ce lovește o rază');
{
  const nava = date.corpuri.find((c) => c.cheie === 'biserica.nava');
  const [cx, cz] = nava.contur.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
  const h = sanctuar.loveste(new THREE.Ray(new THREE.Vector3(cx, 400, cz), new THREE.Vector3(0, -1, 0)));
  const asteptat = yMinim(nava.plane, cx, cz);
  proba(h?.cheie === 'biserica.nava' && Math.abs(h.y - asteptat) < 1e-3, `vertical pe navă: ${h?.cheie} la ${h?.y.toFixed(3)} m, acoperișul ${asteptat.toFixed(3)} m`);
  const a = date.arcade.find((q) => q.cheie === 'aripa_s.arcada');
  const la = (u, v, y) => new THREE.Vector3(a.a[0] + a.d[0] * u + a.m[0] * v, y, a.a[1] + a.d[1] * u + a.m[1] * v);
  const dir = new THREE.Vector3(a.m[0], 0, a.m[1]);
  const [u5, w5] = a.stalpi[5], [u6] = a.stalpi[6], y = (a.pardoseala + a.nastere) / 2;
  const gol = sanctuar.loveste(new THREE.Ray(la((u5 + u6) / 2, -10, y), dir));
  proba(gol && Math.abs(gol.t - (10 + a.adancime)) < 0.02, `prin golul unui arc: trece de fațadă și lovește fundul galeriei la ${gol?.t.toFixed(3)} m (aștept ${10 + a.adancime})`);
  const stalp = sanctuar.loveste(new THREE.Ray(la(u5, -10, y), dir));
  proba(stalp && Math.abs(stalp.t - 10) < 0.02 && stalp.cheie === 'aripa_s.arcada', `în stâlp: ${stalp?.cheie} la ${stalp?.t.toFixed(3)} m (aștept 10, lățime ${w5})`);
  const cer = sanctuar.loveste(new THREE.Ray(new THREE.Vector3(cx, 400, cz), new THREE.Vector3(0, 1, 0)));
  proba(cer === null, 'o rază spre cer nu lovește nimic');
}

sanctuar.dispose();
console.log(picate ? `\n${picate} probe picate` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
