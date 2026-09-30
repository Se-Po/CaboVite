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
// amprentele (mutate 2 m), drapajul (față de relieful interpolat, altă suprafață)
// și zborul (pe nordul grilei). Bugetul n-are nevoie de unul, iar vârfurile
// turnurilor sunt o probă de CONSISTENȚĂ, nu una independentă: `varf` e chiar
// maximul MDS al părții, deci proba prinde doar o greșeală de transport a lui.

import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { incarcaRelief, incarcaSanctuar } from '../src/scene/loaders.js';
import { creeazaTeren, mascaBazei } from '../src/scene/terrain.js';
import { incarcaPaleta, paletaCurenta } from '../src/scene/palette.js';
import { creeazaSanctuar } from '../src/scene/sanctuar.js';
import { yMinim } from '../src/scene/sanctuar-forme.js';
import { creeazaZbor } from '../src/scene/zbor.js';
import { convergentaDinColturi } from '../src/scene/busola.js';

const BUGET = { cladiri: 70000, drapaj: 80000, json_kb: 150 };
const FISIER = 'public/data/sanctuar_v2.json';

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
    const camera = new THREE.PerspectiveCamera(45, 1.5, 10, 60000);
    camera.position.set(500, 900, 1800);
    const controale = new OrbitControls(camera, null);
    controale.target.set(144, 60, 581);
    controale.minDistance = 80; controale.maxDistance = 8000; controale.maxPolarAngle = Math.PI / 2 - 0.04;
    controale.enableDamping = true; controale.dampingFactor = 0.08;
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
    for (; pasi < 400 && zbor.activ; pasi++) { ceas += 16.7; zbor.pas(); controale.update(); }
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
