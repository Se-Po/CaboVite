// Verifică, în Node, ce primește și ce pictează regula de culoare a terenului.
//
//   npm run verifica-teren
//
// Nu scrie nimic. Construiește plasa cu CODUL PAGINII — incarcaRelief,
// mascaBazei, creeazaTeren din src/scene/ — cu `fetch` înlocuit de o citire din
// public/, și o confruntă cu o recalculare independentă. Oprește cu cod 1 la
// prima probă picată.
//
// De ce în Node și nu în browser: în pagină culoarea se coace în atribut și
// argumentele regulii nu mai există după construcție. Aici se pot înregistra,
// fațetă cu fațetă, și se pot încerca toate căile de eșec ale încărcătorului
// fără să strici un fișier pe disc.

import { existsSync, readFileSync } from 'node:fs';
import { incarcaRelief, straturiNdvi } from '../src/scene/loaders.js';
import { creeazaTeren, mascaBazei } from '../src/scene/terrain.js';
import { incarcaPaleta, paletaCurenta } from '../src/scene/palette.js';

const TRIUNGHIURI = 1362406;          // bază 860 522 + petic 501 884
const OCTETI_ATRIBUTE = 73569924;     // position Float32 + color Uint16, ambele plase

let picate = 0;
const proba = (bun, text) => {
  console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`);
  if (!bun) picate++;
};

// ------------------------------------------------------------ fetch din public/

// Ca Vite: o cale care nu există întoarce 200 și pagina index, nu 404. Exact
// cazul pe care încărcătorul trebuie să-l prindă din conținut.
const INDEX = readFileSync('index.html');
const dinDisc = async (url) => {
  const f = 'public' + url;
  if (!existsSync(f)) return new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html' } });
  return new Response(readFileSync(f), { status: 200 });
};
globalThis.fetch = dinDisc;

// Avertismentele se numără, nu se tipăresc: la căile de eșec sunt chiar proba.
let avertismente = [];
const warnOriginal = console.warn;
console.warn = (...a) => { avertismente.push(a.join(' ')); };

// ------------------------------------------------------------ construcția

async function construieste(culoare) {
  const incarcat = await incarcaRelief();
  const relief = incarcat.baza ?? incarcat;
  const reliefPetic = incarcat.baza ? incarcat : null;
  const { pastreaza } = mascaBazei(relief, reliefPetic);
  const ndvi = straturiNdvi(relief, reliefPetic);
  const paleta = paletaCurenta();
  const teren = creeazaTeren(relief, { pastreaza, paleta, ndvi: ndvi.baza, culoare: culoare?.('baza') });
  const petic = reliefPetic
    ? creeazaTeren(reliefPetic, { deplasare: reliefPetic.meta.deplasare_scena, paleta, ndvi: ndvi.petic, culoare: culoare?.('petic') })
    : null;
  return { relief, reliefPetic, pastreaza, teren, petic, ndvi };
}

const octeti = (t) => Object.values(t.obiect.geometry.attributes).reduce((s, a) => s + a.array.byteLength, 0);

// ------------------------------------------------------------ recalcularea independentă

/** Stratul, decodat din fișierul de pe disc, fără codul paginii. */
function stratDeLaZero(nume) {
  const bin = readFileSync(`public/data/${nume}-ndvi.bin`);
  const niv = JSON.parse(readFileSync(`public/data/${nume}-ndvi.json`, 'utf8')).niveluri;
  return (i) => {
    const k = i % 2 === 0 ? bin[Math.floor(i / 2)] % 16 : Math.floor(bin[Math.floor(i / 2)] / 16);
    return k === 0 ? null : niv[k];
  };
}

/**
 * Pentru fiecare fațetă, în ordinea în care le scrie pagina: nodurile ei și
 * NDVI-ul mediu recalculat. Ordinea celulelor și diagonala se refac aici din
 * relief; masca e a paginii, fiindcă nu ea e ce se verifică.
 */
function fateteDeLaZero(relief, pastreaza) {
  const { latime: w, inaltime: h, pasX, pasZ, inaltimi: z } = relief;
  const dep = relief.meta.deplasare_scena ?? { x: 0, z: 0 };
  const X = (c) => (c - (w - 1) / 2) * pasX + dep.x, Z = (r) => (r - (h - 1) / 2) * pasZ + dep.z;
  const zApa = relief.meta.zMin_m;
  const ndvi = stratDeLaZero(relief.meta.nume);
  const fatete = [];
  let fara = 0;
  const f = (...n) => {
    const v = n.map(ndvi).filter((x) => x !== null);
    for (const i of n) if (z[i] > zApa + 0.01 && ndvi(i) === null) fara++;
    fatete.push(v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined);
  };
  for (let r = 0; r < h - 1; r++)
    for (let c = 0; c < w - 1; c++) {
      if (pastreaza && !pastreaza(X(c) + pasX / 2, Z(r) + pasZ / 2)) continue;
      const a = r * w + c, b = a + 1, cc = a + w, d = cc + 1;
      if (z[a] <= zApa && z[b] <= zApa && z[cc] <= zApa && z[d] <= zApa) continue;
      if (Math.abs(z[a] - z[d]) <= Math.abs(z[b] - z[cc])) { f(a, cc, d); f(a, d, b); }
      else { f(a, cc, b); f(cc, d, b); }
    }
  return { fatete, fara };
}

// ------------------------------------------------------------ probele

async function main() {
  await incarcaPaleta();

  console.log('\n1. Plasa, construită cu codul paginii');
  const primit = { baza: [], petic: [] };
  const inregistreaza = (care) => (panta, altitudine, p, ndvi) => { primit[care].push(ndvi); return 0x8a8578; };
  const t0 = performance.now();
  const s = await construieste(inregistreaza);
  const ms = performance.now() - t0;
  const tri = s.teren.nrTriunghiuri + (s.petic?.nrTriunghiuri ?? 0);
  proba(tri === TRIUNGHIURI, `${tri} triunghiuri (așteptat ${TRIUNGHIURI})`);
  const oct = octeti(s.teren) + (s.petic ? octeti(s.petic) : 0);
  proba(oct === OCTETI_ATRIBUTE, `${oct} octeți de atribute (așteptat ${OCTETI_ATRIBUTE})`);
  proba(avertismente.length === 0, `niciun avertisment la încărcare (${avertismente.length})`);
  proba(s.relief.ndvi === null && s.reliefPetic?.ndvi === null, 'straturile desprinse de pe relief după construcție');
  console.log(`      construcția, cu încărcarea: ${ms.toFixed(0)} ms`);

  console.log('\n2. Ce primește regula pe fiecare fațetă, față de o recalculare independentă');
  for (const [care, relief, pastreaza] of [['baza', s.relief, s.pastreaza], ['petic', s.reliefPetic, undefined]]) {
    const { fatete, fara } = fateteDeLaZero(relief, pastreaza);
    const p = primit[care];
    let nepotrivite = 0;
    for (let i = 0; i < Math.max(p.length, fatete.length); i++) {
      const a = p[i], b = fatete[i];
      if (a === undefined && b === undefined) continue;
      if (a === undefined || b === undefined || Math.abs(a - b) > 1e-12) nepotrivite++;
    }
    const cu = p.filter((x) => x !== undefined).length;
    proba(p.length === fatete.length && nepotrivite === 0,
      `${care}: ${p.length} fațete, ${nepotrivite} nepotriviri; ${cu} cu NDVI, ${p.length - cu} fără`);
    proba(fara === 0, `${care}: ${fara} vârfuri de uscat fără NDVI`);
  }

  console.log('\n3. Căile de eșec ale stratului: scena trebuie să pornească la fiecare');
  const citeste = (u) => readFileSync('public' + u);
  const variante = {
    'fișier lipsă, servit ca pagina index (Vite)': (u) => (u.includes('harta_v0-ndvi') ? dinDisc('/nu-exista') : dinDisc(u)),
    'HTTP 404 pe .bin': (u) => (u.endsWith('harta_v0-ndvi.bin') ? new Response('', { status: 404 }) : dinDisc(u)),
    '.bin trunchiat': (u) => (u.endsWith('harta_v0-ndvi.bin') ? new Response(citeste(u).subarray(0, 1000)) : dinDisc(u)),
    'sidecar al altei hărți': (u) => (u.endsWith('harta_v0-ndvi.json')
      ? new Response(JSON.stringify({ ...JSON.parse(citeste(u)), harta: 'harta_v9' })) : dinDisc(u)),
    'JSON stricat': (u) => (u.endsWith('harta_v1-ndvi.json') ? new Response('{') : dinDisc(u)),
    'eroare de rețea': (u) => (u.endsWith('harta_v1-ndvi.bin') ? Promise.reject(new TypeError('Failed to fetch')) : dinDisc(u)),
  };
  for (const [nume, f] of Object.entries(variante)) {
    globalThis.fetch = async (u) => f(u);
    avertismente = [];
    let r, eroare = null;
    try {
      const inc = await incarcaRelief();
      r = straturiNdvi(inc.baza ?? inc, inc.baza ? inc : null);
    } catch (e) { eroare = e; }
    proba(!eroare && r.baza === undefined && r.petic === undefined && avertismente.length >= 1,
      `${nume}: ${eroare ? 'ARUNCĂ ' + eroare.message : `amândouă fără strat, ${avertismente.length} avertisment(e)`}`);
  }
  globalThis.fetch = dinDisc;

  console.warn = warnOriginal;
  console.log(picate ? `\n${picate} probe picate.` : '\nToate probele au trecut.');
  process.exitCode = picate ? 1 : 0;
}

await main();
