// Verifică, în Node, împrejurimile: ce încarcă pagina, ce construiește și cum sunt
// cusute nivelurile între ele.
//
//   npm run verifica-imprejurimi
//
// Nu scrie nimic. Construiește alpha (baza cu peticul) și cele patru niveluri ale
// împrejurimilor cu CODUL PAGINII — incarcaRelief, mascaBazei, creeazaTeren,
// incarcaImprejurimi, creeazaImprejurimi, fermoar —, cu `fetch` înlocuit de o citire
// din public/. Iese cu cod 1 dacă pică vreo probă.
//
// Proba de fond e cea a crăpăturilor: o muchie de uscat care aparține unui singur
// triunghi, în afara marginii exterioare a lui harta_v8, e o crăpătură prin care se
// vede marea. Controlul negativ: același nivel construit fără fâșia de cusătură
// trebuie să le aibă.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { IN_DOUA_TREPTE } from '../src/scene/satelit.js';
import { incarcaRelief, straturiNdvi } from '../src/scene/loaders.js';
import { campNeted, creeazaTeren, INELE_APA, mascaBazei } from '../src/scene/terrain.js';
import { culoareTeren, incarcaPaleta, paletaCurenta, SPRE_LINIAR } from '../src/scene/palette.js';
import { creeazaImprejurimi, incarcaImprejurimi, NIVELURI_IMPREJURIMI, NIVELURI_NETEZITE } from '../src/scene/imprejurimi.js';
import { buclaNoduri, dreptunghiExterior, dreptunghiGrila, fermoar, geometriaGrilei, ndviNod } from '../src/scene/cusatura.js';
import { laOklab } from './comun/oklab.mjs';
import { gama } from './comun/oklab.mjs';

const BUGET = { triunghiuri: 600000, octeti_fisiere: 8 * 1048576 };
const TRIUNGHIURI_ALPHA = 1923948;

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const cuantila = (v, q) => { const s = Float64Array.from(v).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };

// ------------------------------------------------------------ fetch din public/

const INDEX = readFileSync('index.html');
const dinDisc = async (url) => {
  const f = 'public' + url;
  if (!existsSync(f)) return new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html' } });
  return new Response(readFileSync(f), { status: 200 });
};
globalThis.fetch = dinDisc;
let avertismente = [];
const warnOriginal = console.warn;
console.warn = (...a) => { avertismente.push(a.join(' ')); };

// ------------------------------------------------------------ 1. încărcătorul

console.log('\nÎncărcătorul: o cale de eșec dă null și un singur avertisment, fără să arunce');
const cuFetch = async (f, cerere) => {
  globalThis.fetch = f; avertismente = [];
  try { return { r: await cerere(), e: null, avert: avertismente.slice() }; } catch (e) { return { r: undefined, e, avert: avertismente.slice() }; } finally { globalThis.fetch = dinDisc; }
};
{
  const lipsa = await cuFetch(async (url) => (url.includes('harta_v7-dem') ? new Response(INDEX, { status: 200 }) : dinDisc(url)), () => incarcaImprejurimi());
  proba(lipsa.r === null && !lipsa.e && lipsa.avert.length >= 1, `un nivel lipsă (serverul dă index.html): ${lipsa.r === null ? 'null' : 'a trecut'}, „${lipsa.avert.at(-1)?.slice(0, 70)}”`);
  const strain = await cuFetch(async (url) => {
    if (!url.includes('harta_v7-dem.json')) return dinDisc(url);
    const m = JSON.parse(readFileSync('public' + url, 'utf8'));
    return new Response(JSON.stringify({ ...m, interior: 'harta_v4' }), { status: 200 });
  }, () => incarcaImprejurimi());
  proba(strain.r === null && !strain.e, `un nivel cusut de alt interior: ${strain.r === null ? 'null' : 'a trecut'}`);
  // Gaura lui harta_v7 mutată cu un pas al lui harta_v9 spre nord: nu mai e cutia ei.
  // Recenzia a mărit-o cu 96 m și toate probele de mai jos treceau.
  const gaura = await cuFetch(async (url) => {
    if (!url.includes('harta_v7-dem.json')) return dinDisc(url);
    const m = JSON.parse(readFileSync('public' + url, 'utf8'));
    return new Response(JSON.stringify({ ...m, interior_noduri_tm06: { ...m.interior_noduri_tm06, y1: m.interior_noduri_tm06.y1 + 12 } }), { status: 200 });
  }, () => incarcaImprejurimi());
  proba(gaura.r === null && !gaura.e, `o gaură care nu e cutia nodurilor nivelului dinăuntru: ${gaura.r === null ? 'null' : 'a trecut'}, „${gaura.avert.at(-1)?.slice(0, 70)}”`);
  const farăStrat = await cuFetch(async (url) => (url.includes('harta_v8-ndvi') ? new Response('', { status: 404 }) : dinDisc(url)), () => incarcaImprejurimi());
  proba(Array.isArray(farăStrat.r) && farăStrat.r.every((L) => !L.ndvi), 'un strat NDVI lipsă: niciun nivel nu-și folosește stratul (totul sau nimic)');
  const bun = await cuFetch(dinDisc, () => incarcaImprejurimi());
  proba(Array.isArray(bun.r) && bun.r.length === NIVELURI_IMPREJURIMI.length && bun.r.every((L) => L.ndvi), `fișierele adevărate se încarcă, cu toate cele ${NIVELURI_IMPREJURIMI.length} straturi (${bun.avert.length} avertismente)`);
}

// ------------------------------------------------------------ 2. construcția

console.log('\nConstrucția, cu codul paginii');
await incarcaPaleta();
const paleta = paletaCurenta();
const incarcat = await incarcaRelief();
const relief = incarcat.baza, reliefPetic = incarcat;
const { pastreaza } = mascaBazei(relief, reliefPetic);
const ndvi = straturiNdvi(relief, reliefPetic);
const teren = creeazaTeren(relief, { pastreaza, paleta, ndvi: ndvi.baza });
const petic = creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena, paleta, ndvi: ndvi.petic });
const margineAlpha = buclaNoduri(relief, { x: 0, z: 0 }, ndvi.baza, dreptunghiGrila(relief));
proba(teren.nrTriunghiuri + petic.nrTriunghiuri === TRIUNGHIURI_ALPHA, `alpha rămâne la ${teren.nrTriunghiuri + petic.nrTriunghiuri} triunghiuri (${TRIUNGHIURI_ALPHA} înainte)`);

const niveluri = await incarcaImprejurimi();
const t0 = performance.now();
const imp = creeazaImprejurimi({ niveluri, margineAlpha, paleta });
const ms = performance.now() - t0;
let total = 0;
for (const p of imp.plase) {
  console.log(`    ${p.nume}: ${p.teren.nrTriunghiuri} triunghiuri, din care fâșia ${p.cusatura.triunghiuri} (${p.cusatura.aruncate} aruncate: apă sau degenerate)`);
  total += p.teren.nrTriunghiuri;
}
const atribute = imp.plase.reduce((a, p) => a + Object.values(p.teren.obiect.geometry.attributes).reduce((b, at) => b + at.array.byteLength, 0), 0);
proba(total <= BUGET.triunghiuri, `împrejurimile: ${total} triunghiuri (+${(100 * total / TRIUNGHIURI_ALPHA).toFixed(1)}% față de alpha), buget ${BUGET.triunghiuri}; ${(atribute / 1048576).toFixed(1)} MB de atribute; construite în ${ms.toFixed(0)} ms`);
{
  let oct = 0;
  for (const n of NIVELURI_IMPREJURIMI) for (const s of ['-dem.bin', '-dem.json', '-ndvi.bin', '-ndvi.json', '-orto_v1.ktx2', '-orto_v1.json']) oct += statSync(`public/data/${n}${s}`).size;
  for (const n of IN_DOUA_TREPTE) for (const s of ['-orto_v1-mic.ktx2', '-orto_v1-mic.json']) oct += statSync(`public/data/${n}${s}`).size;
  proba(oct <= BUGET.octeti_fisiere, `fișierele împrejurimilor, cu texturile mici ale primei trepte: ${(oct / 1048576).toFixed(2)} MB necomprimate, buget ${BUGET.octeti_fisiere / 1048576} MB`);
  // Textura mică a primei trepte e aceeași cutie, mai grosieră, și chiar fișierul descris.
  for (const n of IN_DOUA_TREPTE) {
    const mare = JSON.parse(readFileSync(`public/data/${n}-orto_v1.json`, 'utf8')), mic = JSON.parse(readFileSync(`public/data/${n}-orto_v1-mic.json`, 'utf8'));
    const bin = readFileSync(`public/data/${n}-orto_v1-mic.ktx2`), k = Math.log2(mic.pas_m / mare.pas_m);
    const cutie = ['xMin', 'xMax', 'yMin', 'yMax'].every((c) => mic.bbox_tm06[c] === mare.bbox_tm06[c]);
    const ok = cutie && Number.isInteger(k) && k > 0 && mic.latime === mare.latime >> k && mic.inaltime === mare.inaltime >> k
      && bin.length === mic.octeti && createHash('sha256').update(bin).digest('hex') === mic.sha256;
    proba(ok, `${n}: textura primei trepte are cutia celei întregi, ${mic.pas_m} m pe texel față de ${mare.pas_m}, ${mic.latime} × ${mic.inaltime}, ${(mic.octeti / 1048576).toFixed(2)} MB; sha256 se potrivește`);
  }
}

// ------------------------------------------------------------ 3. crăpăturile

console.log('\nCusăturile: fiecare muchie de uscat e a două triunghiuri');
const A = { x: (relief.latime - 1) / 2 * relief.pasX, z: (relief.inaltime - 1) / 2 * relief.pasZ };
const peMargineAlpha = (x, z) => Math.abs(Math.abs(x) - A.x) < 1e-3 || Math.abs(Math.abs(z) - A.z) < 1e-3;
const inAlpha = (x, z) => Math.abs(x) < A.x - 1e-3 && Math.abs(z) < A.z - 1e-3;
const ultim = imp.plase.at(-1).cutie;
const peMargineaLumii = (x, z) => Math.abs(x - ultim.x0) < 1e-3 || Math.abs(x - ultim.x1) < 1e-3 || Math.abs(z - ultim.z0) < 1e-3 || Math.abs(z - ultim.z1) < 1e-3;
const COTA_APA = -8 + 0.01;

/** Muchiile cu un singur triunghi care nu sunt nici apă, nici marginea lumii, nici interiorul lui alpha. */
function crapaturi(plase, cuAlpha) {
  const muchii = new Map();
  const cheie = (p, k) => `${p[k * 3]},${p[k * 3 + 1]},${p[k * 3 + 2]}`;
  const adauga = (poz, filtru) => {
    for (let t = 0; t < poz.length / 9; t++) {
      if (filtru && !filtru(poz, t)) continue;
      const k = [t * 3, t * 3 + 1, t * 3 + 2].map((v) => cheie(poz, v));
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const m = k[a] < k[b] ? `${k[a]}|${k[b]}` : `${k[b]}|${k[a]}`;
        muchii.set(m, (muchii.get(m) ?? 0) + 1);
      }
    }
  };
  if (cuAlpha) adauga(teren.obiect.geometry.attributes.position.array, (p, t) => [0, 1, 2].some((v) => peMargineAlpha(p[t * 9 + v * 3], p[t * 9 + v * 3 + 2])));
  for (const q of plase) adauga(q.obiect.geometry.attributes.position.array);
  let rupte = 0, prea = 0;
  const exemple = [];
  for (const [m, n] of muchii) {
    if (n > 2) { prea++; continue; }
    if (n === 2) continue;
    const [a, b] = m.split('|').map((s) => s.split(',').map(Number));
    if (a[1] <= COTA_APA && b[1] <= COTA_APA) continue;
    if (inAlpha(a[0], a[2]) || inAlpha(b[0], b[2])) continue;            // interiorul lui alpha, netestat aici
    if (peMargineaLumii(a[0], a[2]) && peMargineaLumii(b[0], b[2])) continue;
    rupte++;
    if (exemple.length < 3) exemple.push(`(${a.map((v) => v.toFixed(1)).join(', ')}) – (${b.map((v) => v.toFixed(1)).join(', ')})`);
  }
  return { muchii: muchii.size, rupte, prea, exemple };
}
const c = crapaturi(imp.plase.map((p) => p.teren), true);
proba(c.rupte === 0, `${c.muchii} muchii: ${c.rupte} crăpături${c.exemple.length ? ` — ${c.exemple.join('; ')}` : ''}`);
proba(c.prea === 0, `nicio muchie cu mai mult de două triunghiuri (${c.prea}): fâșiile nu se suprapun cu plasele`);
{
  // Controlul: harta_v6 fără fâșia de cusătură trebuie să aibă crăpături.
  const L = niveluri[0], m = L.meta, R = dreptunghiExterior(L, m.deplasare_scena, { x0: m.interior_noduri_scena.x0, x1: m.interior_noduri_scena.x1, z0: m.interior_noduri_scena.z0, z1: m.interior_noduri_scena.z1 });
  const fara = creeazaTeren(L, { deplasare: m.deplasare_scena, paleta, pastreaza: (x, z) => !(x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1) });
  const cc = crapaturi([fara, ...imp.plase.slice(1).map((p) => p.teren)], true);
  proba(cc.rupte > 0, `control: harta_v6 fără fâșie are ${cc.rupte} crăpături — proba le vede`);
  fara.dispose();
}

// ------------------------------------------------------------ 4. culoarea peste cusături

// Nivelurile încărcate încă o dată, cu straturile NDVI: creeazaImprejurimi() le golește
// după ce coace culoarea, iar probele de mai jos o recalculează.
const proaspete = await incarcaImprejurimi();
const nivel = (n) => proaspete.find((L) => L.meta.nume === n);
const plasa = (n) => imp.plase.find((p) => p.nume === n);
const geo = (L) => geometriaGrilei(L, L.meta.deplasare_scena);
const gauraDe = (m) => { const s = m.interior_noduri_scena; return { x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1 }; };
const dreptunghiR = (L) => dreptunghiExterior(L, L.meta.deplasare_scena, gauraDe(L.meta));
const inAfaraR = (r) => (x, z) => !(x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);

console.log('\nCuloarea Relief de o parte și de alta a fiecărei cusături (ΔE_OK×100 al medianelor, pe tronsoane)');
const lab = (r, g, b) => laOklab(...[r, g, b].map((v) => Math.round(gama(v / 65535) * 255)));
/**
 * Mediana culorii triunghiurilor de uscat cu centrul într-o bandă, pe tronsoane de-a lungul
 * unei laturi. `pana`: indicele primului triunghi care NU se ia — fâșia de cusătură, pe care
 * creeazaTeren() o scrie la urmă. Fâșia face 82% din triunghiurile benzii de lângă gaură, iar
 * vârfurile ei dinăuntru au culoarea nivelului dinăuntru: cu ea, proba ar fi comparat mai mult
 * nivelul dinăuntru cu el însuși (recenzia: 5,20 la harta_v8, unde nivelurile diferă cu ~8).
 */
function tronsoane(obiect, inBanda, latura, lung, pana = Infinity) {
  const p = obiect.geometry.attributes.position.array, c = obiect.geometry.attributes.color.array;
  const t = new Map();
  // Culoarea triunghiului e media vârfurilor: pe fațete plate sunt egale, pe plasele
  // netezite fiecare vârf are culoarea nodului lui.
  const med = (k, j) => (c[k * 9 + j] + c[k * 9 + 3 + j] + c[k * 9 + 6 + j]) / 3;
  for (let k = 0; k < Math.min(pana, p.length / 9); k++) {
    const x = (p[k * 9] + p[k * 9 + 3] + p[k * 9 + 6]) / 3, y = (p[k * 9 + 1] + p[k * 9 + 4] + p[k * 9 + 7]) / 3, z = (p[k * 9 + 2] + p[k * 9 + 5] + p[k * 9 + 8]) / 3;
    if (y < 2 || !inBanda(x, z)) continue;
    const s = Math.floor(latura(x, z) / lung);
    if (!t.has(s)) t.set(s, []);
    t.get(s).push(lab(med(k, 0), med(k, 1), med(k, 2)));
  }
  return new Map([...t].filter(([, v]) => v.length >= 4).map(([s, v]) => [s, [0, 1, 2].map((j) => cuantila(v.map((q) => q[j]), 0.5))]));
}
/**
 * Pe tronsoanele comune ale laturilor de nord și de est ale găurii `H`: nivelul dinăuntru
 * pe o bandă de `bInt` m, cel din afară pe `bInt` plus două rânduri ale lui, fără fâșie.
 * Tronsonul are cel puțin un pas al nivelului din afară, altfel la harta_v8 (256 m) n-ar
 * rămâne niciunul cu patru triunghiuri. Întoarce ΔE-ul fiecărui tronson și diferența cu
 * semn (dinăuntru − din afară) pe L, a, b, toate ×100.
 */
function peCusatura(interior, exterior, meta, bInt, pana) {
  const H = gauraDe(meta), pas = meta.pasX_m, bExt = bInt + 2 * pas, lung = Math.max(64, pas);
  const dE = [], semn = [];
  for (const [inInt, inExt, latura] of [
    [(x, z) => z > H.z0 && z < H.z0 + bInt && x > H.x0 && x < H.x1, (x, z) => z < H.z0 && z > H.z0 - bExt && x > H.x0 && x < H.x1, (x) => x],
    [(x, z) => x < H.x1 && x > H.x1 - bInt && z > H.z0 && z < H.z1, (x, z) => x > H.x1 && x < H.x1 + bExt && z > H.z0 && z < H.z1, (x, z) => z],
  ]) {
    const ai = tronsoane(interior, inInt, latura, lung), be = tronsoane(exterior, inExt, latura, lung, pana);
    for (const [s, va] of ai) {
      if (!be.has(s)) continue;
      const vb = be.get(s);
      dE.push(100 * Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]));
      semn.push([0, 1, 2].map((j) => 100 * (va[j] - vb[j])));
    }
  }
  return { dE, semn, med: cuantila(dE, 0.5), medSemn: [0, 1, 2].map((j) => cuantila(semn.map((q) => q[j]), 0.5)) };
}
// Banda dinăuntru: 16 m la alpha (8 pași de 2 m); altfel două rânduri ale nivelului din
// afară, cel puțin 64 m. Benzile late măsoară variația terenului, nu cusătura: v9 → v7 dădea
// 5,59 pe 64 m și 8,28 pe 192 m, fără nicio treaptă de culoare (recenzia).
const bandaInt = (k) => (k ? Math.max(64, 2 * imp.plase[k].meta.pasX_m) : 16);
// Două probe pe fiecare cusătură, cu pragurile scrise mai jos: ΔE-ul median (cât de diferite
// sunt cele două niveluri, firesc la altă rezoluție și alt model) și mediana diferenței CU
// SEMN pe L, a, b (o treaptă de culoare de-a lungul întregii cusături — un strat sau o regulă
// stricată). Fiecare nivel colorat cu NDVI ± 0,10 trebuie să pice măcar una dintre ele.
// Pragurile, pe 2026-10-07: ΔE ~1,5 × cât iese azi (1,63 / 5,49 / 5,47 / 7,77); cu semn,
// 2,5 — azi |ΔL| e cel mult 1,63 (harta_v8, unde Sentinel la 80 m e mai închis), iar NDVI ±
// 0,10 pe oricare nivel dă cel puțin 3,17.
const PRAG_DE = { harta_v6: 2.5, harta_v9: 8, harta_v7: 8, harta_v8: 10 };
const PRAG_SEMN = 2.5;
const fmt = (v) => v.map((x) => x.toFixed(2)).join(' / ');
const trece = (r, nume) => r.dE.length >= 10 && r.med < PRAG_DE[nume] && r.medSemn.every((v) => Math.abs(v) < PRAG_SEMN);
for (const [k, p] of imp.plase.entries()) {
  const r = peCusatura(k ? imp.plase[k - 1].teren.obiect : teren.obiect, p.teren.obiect, p.meta, bandaInt(k), p.teren.nrTriunghiuri - p.cusatura.triunghiuri);
  proba(trece(r, p.nume), `${p.meta.interior} → ${p.nume}, benzi de ${bandaInt(k)} m, fără fâșie: ${r.dE.length} tronsoane de uscat — ΔE mediană ${r.med.toFixed(2)} (prag ${PRAG_DE[p.nume]}), cu semn ΔL/Δa/Δb ${fmt(r.medSemn)} (prag ±${PRAG_SEMN})`);
}
for (const [k, p] of imp.plase.entries()) {
  const L = nivel(p.nume), rez = [];
  for (const delta of [-0.1, 0.1]) {
    const f = (panta, alt, pp, nd) => culoareTeren(panta, alt, pp, nd === undefined ? undefined : nd + delta);
    const tc = creeazaTeren(L, { deplasare: L.meta.deplasare_scena, paleta, ndvi: L.ndvi, culoare: f, neted: NIVELURI_NETEZITE.has(p.nume), pastreaza: inAfaraR(dreptunghiR(L)) });
    const r = peCusatura(k ? imp.plase[k - 1].teren.obiect : teren.obiect, tc.obiect, L.meta, bandaInt(k), Infinity);
    tc.dispose();
    rez.push({ delta, r });
  }
  proba(rez.every((q) => !trece(q.r, p.nume)), `control: ${p.nume} cu NDVI ± 0,10 pică — ${rez.map((q) => `${q.delta > 0 ? '+' : '−'}: ΔE ${q.r.med.toFixed(2)}, ΔL/Δa/Δb ${fmt(q.r.medSemn)}`).join('; ')}`);
}

// ------------------------------------------------------------ 5. netezirea

console.log('\nNetezirea nivelurilor de la 12 m încolo');
for (const p of imp.plase) {
  const n = p.teren.obiect.geometry.attributes.normal, mat = p.teren.obiect.material;
  const bun = p.neted
    ? !!n && n.array instanceof Int8Array && n.normalized && mat.flatShading === false
    : !n && mat.flatShading === true;
  proba(bun, `${p.nume}: ${p.neted ? 'netezit — normală pe 8 biți normalizați, flatShading fals' : 'fațete plate, fără atribut normal'}`);
}
proba(imp.plase.filter((p) => p.neted).map((p) => p.nume).join() === 'harta_v9,harta_v7,harta_v8', 'se netezesc exact nivelurile de la 12 m încolo: harta_v9, harta_v7 și harta_v8');

const cheiePoz = (P, v) => `${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]}`;
/**
 * Pozițiile la care copiile aceluiași vârf — din triunghiuri vecine, din fâșie, din
 * cele două plase — au altă normală sau altă culoare: acolo s-ar vedea o linie.
 */
function discontinuitati(obiecte) {
  const m = new Map();
  let dif = 0, comune = 0;
  obiecte.forEach((o, j) => {
    const a = o.geometry.attributes, P = a.position.array, N = a.normal.array, C = a.color.array;
    for (let v = 0; v < P.length / 3; v++) {
      const k = cheiePoz(P, v);
      const val = `${N[v * 3]},${N[v * 3 + 1]},${N[v * 3 + 2]}|${C[v * 3]},${C[v * 3 + 1]},${C[v * 3 + 2]}`;
      const ant = m.get(k);
      if (!ant) { m.set(k, { val, plase: 1 << j }); continue; }
      if (!(ant.plase & (1 << j))) { if (ant.plase === (1 << (j - 1))) comune++; ant.plase |= 1 << j; }
      if (ant.val !== val && !ant.rupt) { dif++; ant.rupt = true; }
    }
  });
  return { pozitii: m.size, comune, dif };
}
const netezite = imp.plase.filter((p) => p.neted);
{
  const d = discontinuitati(netezite.map((p) => p.teren.obiect));
  proba(d.dif === 0 && d.comune > 0, `${d.pozitii} poziții de vârf în ${netezite.map((p) => p.nume).join(', ')}, ${d.comune} comune pe cusăturile dintre ele: ${d.dif} cu altă normală sau culoare`);
}
{
  // Controlul: fâșia lui harta_v8 cusută de o buclă a lui harta_v7 colorată fără
  // NDVI — o fâșie care și-ar lua culoarea din altă parte decât plasa de lângă ea.
  const L7 = nivel('harta_v7'), L8 = nivel('harta_v8'), m8 = L8.meta, d8 = m8.deplasare_scena, R8 = dreptunghiR(L8);
  const gresit = buclaNoduri(L7, L7.meta.deplasare_scena, L7.ndvi, dreptunghiGrila(L7), campNeted(L7, { paleta, ndvi: null }));
  const cus = fermoar(gresit, buclaNoduri(L8, d8, L8.ndvi, R8, campNeted(L8, { paleta, ndvi: L8.ndvi })), { cotaApa: m8.zMin_m });
  const t8 = creeazaTeren(L8, { deplasare: d8, paleta, ndvi: L8.ndvi, cusatura: cus, neted: true, pastreaza: inAfaraR(R8) });
  const d = discontinuitati([plasa('harta_v7').teren.obiect, t8.obiect]);
  proba(d.dif > 0, `control: cu bucla lui harta_v7 colorată fără NDVI, ${d.dif} poziții de pe cusătură diferă — proba le vede`);
  t8.dispose();
}

/**
 * Câmpul nodurilor, recalculat AICI, nu importat din campNeted(): normala din diferențe
 * centrale (de o parte, la margine), culoarea din culoareTeren() cu panta ei și cu NDVI-ul
 * din ndviNod() (cusatura.js), un nod de apă din media uscatului de pe cel mai apropiat inel.
 * `decalaj` citește NDVI-ul altui nod — pentru control.
 */
function campIndependent(L, { decalaj = 0 } = {}) {
  const { latime: w, inaltime: h, pasX, pasZ } = L, Y = L.inaltimi, zApa = L.meta.zMin_m, strat = L.ndvi;
  const apa = (r, c) => Y[r * w + c] <= zApa;
  const normala = (r, c) => {
    const ca = Math.max(0, c - 1), cb = Math.min(w - 1, c + 1), ra = Math.max(0, r - 1), rb = Math.min(h - 1, r + 1);
    const gx = (Y[r * w + cb] - Y[r * w + ca]) / ((cb - ca) * pasX), gz = (Y[rb * w + c] - Y[ra * w + c]) / ((rb - ra) * pasZ);
    const l = Math.hypot(gx, 1, gz);
    return [-gx / l, 1 / l, -gz / l];
  };
  const memo = new Map();
  const uscat = (r, c) => {
    const i = r * w + c;
    if (memo.has(i)) return memo.get(i);
    const nd = ndviNod(strat, i + decalaj);
    const hex = Math.floor(culoareTeren(1 - Math.abs(normala(r, c)[1]), Y[i], paleta, nd === nd ? nd : undefined));
    const v = [16, 8, 0].map((s) => Math.round(SPRE_LINIAR[(hex >> s) & 255] * 65535));
    memo.set(i, v);
    return v;
  };
  const izolate = new Set();
  const culoare = (r, c) => {
    if (!apa(r, c)) return uscat(r, c);
    for (let inel = 1; inel <= INELE_APA; inel++) {
      const s = [0, 0, 0];
      let m = 0;
      for (let rr = r - inel; rr <= r + inel; rr++) for (let cc = c - inel; cc <= c + inel; cc++) {
        if (Math.max(Math.abs(rr - r), Math.abs(cc - c)) !== inel || rr < 0 || rr >= h || cc < 0 || cc >= w || apa(rr, cc)) continue;
        const u = uscat(rr, cc);
        s[0] += u[0]; s[1] += u[1]; s[2] += u[2]; m++;
      }
      if (m) return s.map((v) => Math.round(v / m));
    }
    izolate.add(r * w + c);
    return uscat(r, c);
  };
  return { normala, culoare, izolate };
}

/** Nodul (r, c) al grilei lui L pe care cade exact vârful (x, y, z), sau null. */
function peNod(L, x, y, z) {
  const g = geo(L), c = g.col(x), r = g.rand(z);
  if (c < 0 || c >= L.latime || r < 0 || r >= L.inaltime) return null;
  if (Math.fround(g.X(c)) !== x || Math.fround(g.Z(r)) !== z || Math.fround(L.inaltimi[r * L.latime + c]) !== y) return null;
  return [r, c];
}
const unghi = (a, b) => {
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
  const u = Math.acos(Math.min(1, cos)) * 180 / Math.PI;
  return u === u ? u : Infinity;   // o normală nulă dă NaN, care altfel ar trece
};
/**
 * Fiecare vârf al unei plase netezite, pus pe nodul lui: al grilei nivelului (triunghiurile
 * grilei și bucla din afară a fâșiei, pe dreptunghiul R) sau al nivelului dinăuntru (bucla
 * dinăuntru a fâșiei). Normala scrisă față de cea recalculată, în grade; culoarea, la bit.
 */
function verificaPlasa(p, L, Lint, camp, campInt) {
  const a = p.teren.obiect.geometry.attributes, P = a.position.array, N = a.normal.array, C = a.color.array;
  const pana = p.teren.nrTriunghiuri - p.cusatura.triunghiuri, R = dreptunghiR(L);
  const peR = (x, z) => [R.x0, R.x1].some((q) => Math.fround(q) === x) || [R.z0, R.z1].some((q) => Math.fround(q) === z);
  const rez = { grila: { varfuri: 0, culori: 0, unghi: 0 }, interior: { varfuri: 0, culori: 0, unghi: 0 }, nepuse: 0, nule: 0 };
  for (let v = 0; v < P.length / 3; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const dinGrila = Math.floor(v / 3) < pana || peR(x, z);
    const nod = dinGrila ? peNod(L, x, y, z) : peNod(Lint, x, y, z);
    if (!nod) { rez.nepuse++; continue; }
    const cmp = dinGrila ? camp : campInt, t = dinGrila ? rez.grila : rez.interior;
    t.varfuri++;
    const n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    if (!n[0] && !n[1] && !n[2]) rez.nule++;
    t.unghi = Math.max(t.unghi, unghi(n, cmp.normala(...nod)));
    const c = cmp.culoare(...nod);
    if (c[0] !== C[v * 3] || c[1] !== C[v * 3 + 1] || c[2] !== C[v * 3 + 2]) t.culori++;
  }
  return rez;
}
// Pragul normalei: 0,5°. Cuantizarea pe 8 biți greșește cu cel mult 0,5/127 pe componentă,
// adică ~0,39°.
const campuri = new Map(proaspete.map((L) => [L.meta.nume, campIndependent(L)]));
// Fiecare plasă netezită, cu nivelul ei și cu cel dinăuntru (de la care vine bucla
// dinăuntru a fâșiei): în ordinea lanțului, nivelul dinăuntru e cel de dinainte.
const cuInterior = imp.plase.map((p, k) => ({ p, L: proaspete[k], Lint: proaspete[k - 1] })).filter((q) => q.p.neted);
for (const { p, L, Lint } of cuInterior) {
  const r = verificaPlasa(p, L, Lint, campuri.get(L.meta.nume), campuri.get(Lint.meta.nume));
  proba(r.nepuse === 0 && r.grila.culori === 0 && r.grila.unghi <= 0.5 && r.nule === 0,
    `${p.nume}, recalculat independent: ${r.grila.varfuri} vârfuri pe nodurile lui — ${r.grila.culori} culori diferite, normala la cel mult ${r.grila.unghi.toFixed(2)}° (prag 0,5°); ${r.nule} normale nule, ${r.nepuse} vârfuri care nu cad pe niciun nod`);
  proba(r.interior.varfuri > 0 && r.interior.culori === 0 && r.interior.unghi <= 0.5,
    `${p.nume}, bucla dinăuntru a fâșiei, recalculată pe ${Lint.meta.nume}: ${r.interior.varfuri} vârfuri — ${r.interior.culori} culori diferite, normala la cel mult ${r.interior.unghi.toFixed(2)}°`);
}
proba([...campuri.values()].every((c) => c.izolate.size === 0), `niciun nod de apă al plaselor netezite fără uscat la ${INELE_APA} pași (${[...campuri.values()].map((c) => c.izolate.size).join(' / ')})`);
{
  // Controalele, pe harta_v9 — prima plasă netezită, cusută de harta_v6, care e plată:
  // NDVI-ul citit de pe nodul de alături; bucla dinăuntru a fâșiei luată din grila lui
  // harta_v9 în loc de a lui harta_v6 (greșeala încercată de recenzie pe harta_v7,
  // `campNeted(urm)`: trecea de toate probele de dinainte).
  const L6 = nivel('harta_v6'), L9 = nivel('harta_v9'), c9 = campuri.get('harta_v9');
  const decalat = verificaPlasa(plasa('harta_v9'), L9, L6, campIndependent(L9, { decalaj: 1 }), campuri.get('harta_v6'));
  proba(decalat.grila.culori > 0, `control: cu NDVI-ul nodului de alături, ${decalat.grila.culori} culori diferite — proba le vede`);
  const altNivel = verificaPlasa(plasa('harta_v9'), L9, L6, c9, { normala: (r, c) => c9.normala(Math.min(r, L9.inaltime - 1), Math.min(c, L9.latime - 1)), culoare: (r, c) => c9.culoare(Math.min(r, L9.inaltime - 1), Math.min(c, L9.latime - 1)) });
  proba(altNivel.interior.culori > 0 || altNivel.interior.unghi > 0.5, `control: bucla dinăuntru citită din grila lui harta_v9, ${altNivel.interior.culori} culori diferite, normala până la ${altNivel.interior.unghi.toFixed(1)}° — proba o vede`);
}

/**
 * Formula față de geometrie: normala scrisă față de media normalelor fațetelor din jur,
 * ponderată cu aria, pe vârfurile de uscat ale grilei unde panta medie trece de 2° — pe
 * terenul aproape plat al lui harta_v8 orice normală aproape verticală ar trece.
 * `vecin`: în locul normalei scrise, cea recalculată pe nodul de la est — controlul.
 */
function abatereFete(p, L, camp, vecin = false) {
  const P = p.teren.obiect.geometry.attributes.position.array, N = p.teren.obiect.geometry.attributes.normal.array;
  const fete = new Map(), primul = new Map();
  for (let t = 0; t < P.length / 9; t++) {
    const a = t * 3, b = a + 1, c = a + 2;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    // (B − A) × (C − A), în sus pe toate triunghiurile; lungimea e de două ori aria.
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      const k = cheiePoz(P, v);
      const s = fete.get(k);
      if (s) { s[0] += nx; s[1] += ny; s[2] += nz; } else { fete.set(k, [nx, ny, nz]); primul.set(k, v); }
    }
  }
  const unghiuri = [];
  for (const [k, v] of primul) {
    if (P[v * 3 + 1] <= COTA_APA) continue;
    const s = fete.get(k);
    if (unghi(s, [0, 1, 0]) < 2) continue;
    const nod = peNod(L, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    if (!nod) continue;
    const n = vecin ? camp.normala(nod[0], Math.min(L.latime - 1, nod[1] + 1)) : [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    unghiuri.push(unghi(s, n));
  }
  return unghiuri;
}
// Pragul: 1° pe mediană. Diferențele centrale nu sunt exact media fațetelor, iar cuantizarea
// adaugă până la ~0,39°. Controlul, normala nodului de alături, trebuie să iasă peste 1° și
// peste dublul medianei bune.
for (const { p, L } of cuInterior) {
  const camp = campuri.get(L.meta.nume);
  const u = abatereFete(p, L, camp), vec = abatereFete(p, L, camp, true);
  const med = cuantila(u, 0.5), medVec = cuantila(vec, 0.5);
  proba(u.length > 1000 && med < 1 && medVec > Math.max(1, 2 * med),
    `${p.nume}: normala față de fațetele din jur, pe ${u.length} vârfuri de uscat cu panta de peste 2° — mediană ${med.toFixed(2)}°, p99 ${cuantila(u, 0.99).toFixed(2)}°; control, normala nodului de la est: mediană ${medVec.toFixed(2)}°`);
}

// ------------------------------------------------------------ 6. altitudinea compusă

console.log('\nAltitudinea împrejurimilor');
{
  const m = niveluri.find((L) => L.meta.nume === 'harta_v8').meta;
  const h = imp.inaltimeLa(30000, -30000), apa = imp.inaltimeLa(1e6, 1e6);
  proba(Number.isFinite(h), `un punct la 42 km spre nord-est are cotă (${h.toFixed(1)} m)`);
  proba(apa === m.zMin_m, `în afara tuturor nivelurilor, cota apei (${apa})`);
  // Pe un nod al lui harta_v7, din afara găurii, inaltimeLa dă exact nodul.
  const L7 = imp.plase.find((p) => p.nume === 'harta_v7'), g = L7.teren, N7 = niveluri.find((L) => L.meta.nume === 'harta_v7');
  const x = L7.cutie.x1 - 32 * 5, z = L7.cutie.z0 + 32 * 5;
  const c7 = Math.round((x - L7.meta.deplasare_scena.x) / 32 + (N7.latime - 1) / 2), r7 = Math.round((z - L7.meta.deplasare_scena.z) / 32 + (N7.inaltime - 1) / 2);
  proba(Math.abs(imp.inaltimeLa(x, z) - g.inaltimeLa(x, z)) < 1e-9 && Number.isInteger(c7) && Number.isInteger(r7), `pe un nod al lui harta_v7, altitudinea compusă e a lui (${imp.inaltimeLa(x, z).toFixed(2)} m)`);
}

imp.dispose();
teren.dispose(); petic.dispose();
console.warn = warnOriginal;
console.log(picate ? `\n${picate} probe picate` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
