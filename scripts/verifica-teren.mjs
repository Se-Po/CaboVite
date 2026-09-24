// Verifică, în Node, ce primește și ce pictează regula de culoare a terenului.
//
//   npm run verifica-teren
//
// Nu scrie nimic. Construiește plasa cu CODUL PAGINII — incarcaRelief,
// mascaBazei, creeazaTeren din src/scene/ — cu `fetch` înlocuit de o citire din
// public/, și o confruntă cu o recalculare independentă. Rulează toate probele —
// o singură rulare arată tot ce a picat — și iese cu cod 1 dacă a picat vreuna.
//
// De ce în Node și nu în browser: în pagină culoarea se coace în atribut și
// argumentele regulii nu mai există după construcție. Aici se pot înregistra,
// fațetă cu fațetă, și se pot încerca toate căile de eșec ale încărcătorului
// fără să strici un fișier pe disc.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { incarcaRelief, straturiNdvi } from '../src/scene/loaders.js';
import { creeazaTeren, inPoligon, mascaBazei } from '../src/scene/terrain.js';
import { GRI_REZERVA, PALETA, PALETA_NOAPTE, culoareTeren, incarcaPaleta, paletaCurenta } from '../src/scene/palette.js';
import { COTA_MARE } from '../src/scene/mare.js';
import { laOklab } from './comun/oklab.mjs';
import { aliniaza, deschideOrtofoto, fereastra } from './comun/ortofoto.mjs';
import { incarcaHarta } from './comun/relief.mjs';

const TRIUNGHIURI = 1362406;          // bază 860 522 + petic 501 884
const OCTETI_ATRIBUTE = 73569924;     // position Float32 + color Uint16, ambele plase
// ΔE_OK×100 față de ortofoto, pe fațetele de uscat ale bazei. Regula dă 10,22;
// pragul stă sub griul de rezervă măsurat pe aceleași fațete — tipărit alături —,
// deci o regulă care a căzut înapoi pe gri, sau una stricată, pică.
const PRAG_ORTOFOTO = 11;

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
  const fatete = [], apa = [], sus = [], cx = [], cz = [], noduri = [];
  let fara = 0;
  const f = (...n) => {
    const v = n.map(ndvi).filter((x) => x !== null);
    for (const i of n) if (z[i] > zApa + 0.01 && ndvi(i) === null) fara++;
    fatete.push(v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined);
    apa.push(n.filter((i) => z[i] <= zApa + 0.01).length);
    sus.push(Math.max(...n.map((i) => z[i])));
    cx.push(n.reduce((s, i) => s + X(i % w), 0) / 3);
    cz.push(n.reduce((s, i) => s + Z(Math.floor(i / w)), 0) / 3);
    noduri.push(n);
  };
  for (let r = 0; r < h - 1; r++)
    for (let c = 0; c < w - 1; c++) {
      if (pastreaza && !pastreaza(X(c) + pasX / 2, Z(r) + pasZ / 2)) continue;
      const a = r * w + c, b = a + 1, cc = a + w, d = cc + 1;
      if (z[a] <= zApa && z[b] <= zApa && z[cc] <= zApa && z[d] <= zApa) continue;
      if (Math.abs(z[a] - z[d]) <= Math.abs(z[b] - z[cc])) { f(a, cc, d); f(a, d, b); }
      else { f(a, cc, b); f(cc, d, b); }
    }
  return { fatete, fara, apa, sus, cx, cz, noduri };
}

// ------------------------------------------------------------ culoarea, în OKLab

const oklabHex = (c) => laOklab((c >> 16) & 255, (c >> 8) & 255, c & 255);
const dE = (a, b) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
// Fără rotunjire la octet: media a două plase poate diferi cu o fracțiune de
// nivel, iar o rotunjire ar face din ea exact 0 sau exact un nivel întreg.
const gam = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
/** Culoarea medie a unor fațete, mediată în liniar — cum le-ar amesteca ochiul de departe. */
function medie(culori) {
  const s = [0, 0, 0];
  for (const c of culori) { s[0] += lin((c >> 16) & 255); s[1] += lin((c >> 8) & 255); s[2] += lin(c & 255); }
  return laOklab(...s.map((x) => gam(x / culori.length)));
}
const cuantile = (v) => {
  const s = Float64Array.from(v).sort();
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { medie: s.reduce((a, x) => a + x, 0) / s.length, mediana: q(0.5), p90: q(0.9), p99: q(0.99) };
};

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
  avertismente = [];

  console.log('\n4. Regula, pe datele adevărate');
  const primite = { baza: [], petic: [] };
  const cuRegula = (care) => (panta, altitudine, p, ndvi) => {
    const c = culoareTeren(panta, altitudine, p, ndvi);
    primite[care].push([panta, altitudine, ndvi, c]);
    return c;
  };
  const sr = await construieste(cuRegula);
  // Timpul regulii: aceeași plasă a bazei, cu regula și cu o culoare fixă, cel
  // mai bun din trei. Diferența e ce adaugă regula la pornire.
  const cronometru = (culoare) => {
    let min = Infinity;
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      creeazaTeren(sr.relief, { pastreaza: sr.pastreaza, paleta: paletaCurenta(), ndvi: sr.ndvi.baza, culoare }).dispose();
      min = Math.min(min, performance.now() - t0);
    }
    return min;
  };
  const msRegula = cronometru(culoareTeren), msGri = cronometru(() => 0x8a8578);
  console.log(`      baza, construită: ${msRegula.toFixed(0)} ms cu regula, ${msGri.toFixed(0)} ms cu o culoare fixă `
    + `(+${(msRegula - msGri).toFixed(0)} ms)`);
  proba(avertismente.length === 0, `niciun avertisment de la regulă (${avertismente.length})`);

  const masurat = paletaCurenta().masurat;
  const calcar = masurat.calcar.culoare;
  const lang = { baza: fateteDeLaZero(sr.relief, sr.pastreaza), petic: fateteDeLaZero(sr.reliefPetic, undefined) };
  for (const care of ['baza', 'petic']) {
    const p = primite[care], L = lang[care];
    let mal = 0, malAlt = 0, malSub = 0, faraStrat = 0, faraStratVizibil = 0, invalide = 0, tema = 0;
    for (let i = 0; i < p.length; i++) {
      const [panta, alt, ndvi, c] = p[i];
      // Fațetele de la apă care ies deasupra mării. Cele care stau întregi sub ea nu
      // se văd niciodată — marea e opacă și camera nu coboară sub ea —, iar pe
      // petic există câteva: în inelul de cusătură relieful e interpolat între
      // umplutura de −8 m și uscat, deci un vârf „de uscat" poate sta la −7 m.
      if ((L.apa[i] === 1 || L.apa[i] === 2) && L.sus[i] <= COTA_MARE) malSub++;
      else if (L.apa[i] === 1 || L.apa[i] === 2) {
        mal++;
        const d = [16, 8, 0].map((s) => Math.abs(((c >> s) & 255) - ((calcar >> s) & 255)));
        if (Math.max(...d) > 1) malAlt++;
      }
      if (ndvi === undefined) { faraStrat++; if (L.apa[i] < 3) faraStratVizibil++; }
      for (const [pp, nn] of [[{ masurat }, undefined], [{ masurat: null }, ndvi], [{ masurat: null }, undefined]]) {
        const x = culoareTeren(panta, alt, pp, nn);
        if (!Number.isInteger(x) || x < 0 || x > 0xffffff) invalide++;
      }
      if (culoareTeren(panta, alt, { ...PALETA, masurat }, ndvi) !== culoareTeren(panta, alt, { ...PALETA_NOAPTE, masurat }, ndvi)) tema++;
    }
    proba(malAlt === 0, `${care}: ${mal} fațete de la apă peste nivelul mării, ${malAlt} care nu ies calcar (${malSub} întregi sub mare)`);
    proba(faraStratVizibil === 0, `${care}: ${faraStrat} fațete pe calea fără strat, toate scufundate întregi (${faraStratVizibil} vizibile)`);
    proba(invalide === 0, `${care}: căile degradate (fără strat, fără măsurători, fără amândouă) — ${invalide} culori invalide`);
    proba(tema === 0, `${care}: ${tema} fațete care se schimbă între tema de zi și cea de noapte`);
  }

  // Peticul față de ce ar picta baza sub el. Baza n-are fațete acolo — gaura —,
  // deci se construiește o a treia plasă, numai din celulele găurii.
  const { limitaDatelor, subPetic } = mascaBazei(sr.relief, sr.reliefPetic);
  const inGaura = (x, zz) => (!limitaDatelor || inPoligon(x, zz, limitaDatelor)) && subPetic(x, zz);
  primite.baza = [];
  const sub = creeazaTeren(sr.relief, { pastreaza: inGaura, paleta: paletaCurenta(), ndvi: sr.ndvi.baza, culoare: cuRegula('baza') });
  const lSub = fateteDeLaZero(sr.relief, inGaura);
  const g = sr.reliefPetic.meta.gaura_scena;
  const langaMargine = (x, zz) => Math.min(x - g.x0, g.x1 - x, zz - g.z0, g.z1 - zz) < 20;
  const vizibile = (p, L, f) => p.filter((_, i) => L.apa[i] < 3 && f(L.cx[i], L.cz[i])).map((a) => a[3]);
  const tot = () => true;
  const dZona = dE(medie(vizibile(primite.baza, lSub, tot)), medie(vizibile(primite.petic, lang.petic, tot)));
  const dFasie = dE(medie(vizibile(primite.baza, lSub, langaMargine)), medie(vizibile(primite.petic, lang.petic, langaMargine)));
  proba(dZona <= 1, `peticul față de baza de sub el: ΔE al mediilor ${dZona.toFixed(3)} pe toată zona (prag 1)`);
  proba(dFasie <= 1, `  și ${dFasie.toFixed(3)} pe fâșia de 20 m de la margine`);
  sub.dispose();

  // Față de ortofotoul însuși — numai dacă dala e pe disc; nu intră în depozit.
  const DIR = 'date-sursa/ortofoto';
  const tif = existsSync(DIR) && readdirSync(DIR).find((f) => /\.tif{1,2}$/i.test(f));
  if (tif) {
    const h = incarcaHarta(sr.relief.meta.nume);
    const o = deschideOrtofoto(join(DIR, tif), h.pas);
    const { c0, r0 } = aliniaza(h, o);
    const benzi = [0, 1, 2].map((b) => fereastra(o, b, c0, r0, h.w, h.h));
    const lab = (i) => laOklab(benzi[0][i], benzi[1][i], benzi[2][i]);
    const d = [];
    const toate = [];
    const inreg = (panta, alt, p, ndvi) => { const c = culoareTeren(panta, alt, p, ndvi); toate.push(c); return c; };
    creeazaTeren(sr.relief, { pastreaza: sr.pastreaza, paleta: paletaCurenta(), ndvi: sr.ndvi.baza, culoare: inreg }).dispose();
    for (let i = 0; i < toate.length; i++) {
      if (lang.baza.apa[i] !== 0) continue;
      const v = lang.baza.noduri[i].map(lab);
      d.push(dE(oklabHex(toate[i]), [0, 1, 2].map((k) => (v[0][k] + v[1][k] + v[2][k]) / 3)));
    }
    const q = cuantile(d);
    // Pe aceleași fațete, griul de rezervă — terenul de dinainte de regulă.
    const gri = oklabHex(GRI_REZERVA);
    let sGri = 0;
    for (let i = 0; i < toate.length; i++) {
      if (lang.baza.apa[i] !== 0) continue;
      const v = lang.baza.noduri[i].map(lab);
      sGri += dE(gri, [0, 1, 2].map((k) => (v[0][k] + v[1][k] + v[2][k]) / 3));
    }
    const qGri = sGri / d.length;
    proba(q.medie <= PRAG_ORTOFOTO, `față de ortofoto, pe ${d.length} fațete de uscat ale bazei: ΔE medie ${q.medie.toFixed(2)} `
      + `(prag ${PRAG_ORTOFOTO}; griul de rezervă, pe aceleași fațete: ${qGri.toFixed(2)}), `
      + `mediană ${q.mediana.toFixed(2)}, p90 ${q.p90.toFixed(2)}`);
  } else {
    console.log('      față de ortofoto: sărit, dala nu e în date-sursa/ortofoto');
  }

  console.warn = warnOriginal;
  console.log(picate ? `\n${picate} probe picate.` : '\nToate probele au trecut.');
  process.exitCode = picate ? 1 : 0;
}

await main();
