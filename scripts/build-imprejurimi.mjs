#!/usr/bin/env node
// Hărțile împrejurimilor zonei alpha: relieful care continuă dincolo de marginile
// tăiate, până unde ceața scenei îl acoperă de tot.
//
//   npm run build-imprejurimi -- harta_v6    dalele DGT de 2 m de pe disc, la 4 m
//   npm run build-imprejurimi -- harta_v9    aceleași dale, banda de ~2,4 km, la 12 m
//   npm run build-imprejurimi -- harta_v7    Copernicus GLO-30, la 32 m
//   npm run build-imprejurimi -- harta_v8    Copernicus GLO-30, la 256 m
//
// Se construiesc în ordinea asta: fiecare nivel își coase marginea pe cel dinăuntru,
// deci îl citește. Unde stă fiecare grilă: scripts/comun/imprejurimi.mjs.
//
// Ce sunt: decor, nu hărți pe care se măsoară. Pagina nu culege puncte pe ele și nu
// lasă camera să se rotească deasupra lor (vezi src/scene/alpha.js). Datele sunt
// reale — nimic din relief nu e inventat —, dar Copernicus e un model de SUPRAFAȚĂ,
// la ~30 m, în alt datum, cu coroanele copacilor și acoperișurile în el.
//
// Formatul e al hărților: <nume>-dem.bin (Uint16 LE, rândul 0 = nord) + .json, în
// convenția „noduri” (bbox_tm06 dă primul și ultimul nod). Nodurile din mijlocul
// găurii — unde se vede nivelul dinăuntru — nu se folosesc și primesc cota apei, ca
// fișierul să se comprime; inelul de lângă gaură păstrează datele.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { citesteTiffDGT } from './comun/tiff.mjs';
import { dinTM06, laTM06 } from './comun/tm06.mjs';
import { incarcaHarta } from './comun/relief.mjs';
import { deschideCog } from './comun/cog.mjs';
import { CUTIE_ALPHA, DALE_COPERNICUS, NIVELURI, NODURI_ALPHA, RAZA_V8, SURSA_COPERNICUS, dirCopernicus, urlCopernicus } from './comun/imprejurimi.mjs';

const IESIRE = 'public/data';
const ADANCIME_APA = -8;            // ca la harta_v4: umplutura apei, nu batimetrie
const CENTRU = { x: (CUTIE_ALPHA.xMin + CUTIE_ALPHA.xMax) / 2, y: (CUTIE_ALPHA.yMin + CUTIE_ALPHA.yMax) / 2 };

const nume = process.argv[2];
const N = NIVELURI[nume];
if (!N) throw new Error(`dă numele unei hărți a împrejurimilor: ${Object.keys(NIVELURI).join(', ')}`);

// Un nume se scrie o singură dată, ca la build-zona.
{
  const urmarit = spawnSync('git', ['ls-files', '--error-unmatch', `${IESIRE}/${nume}-dem.bin`], { stdio: 'ignore' }).status === 0;
  if (urmarit) throw new Error(`${IESIRE}/${nume}-dem.bin e deja în depozit; o hartă nouă primește un nume nou`);
  if (existsSync(`${IESIRE}/${nume}-dem.bin`) && !process.argv.includes('--suprascrie-lucru'))
    throw new Error(`${IESIRE}/${nume}-dem.bin există (neurmărit); rescrie-l cu --suprascrie-lucru`);
}

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const mediana = (v) => { const s = Float64Array.from(v).sort(); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const cuantila = (v, q) => { const s = Float64Array.from(v).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };

// ------------------------------------------------------------ grila

const pas = N.pas;
const w = (N.x1 - N.x0) / pas + 1, h = (N.y1 - N.y0) / pas + 1;
if (!Number.isInteger(w) || !Number.isInteger(h)) throw new Error(`${nume}: cutia nu se împarte la pasul de ${pas} m`);
const nodX = (c) => N.x0 + c * pas, nodY = (r) => N.y1 - r * pas;

// Gaura: nodurile nivelului dinăuntru. Cele aflate cu mai mult de un pas în
// interiorul ei nu le folosește nimic; inelul de lângă margine rămâne cu date,
// fiindcă `inaltimeLa` interpolează peste el până la nivelul dinăuntru.
const H = N.interior === 'harta_v4' ? NODURI_ALPHA : (() => { const I = NIVELURI[N.interior]; return { x0: I.x0, x1: I.x1, y0: I.y0, y1: I.y1 }; })();
const inGaura = (x, y) => x > H.x0 + pas && x < H.x1 - pas && y > H.y0 + pas && y < H.y1 - pas;
// Gaura e cutia nodurilor nivelului dinăuntru AȘA CUM E PE DISC, nu numai cum o scrie
// NIVELURI: un nivel dinăuntru refăcut cu alt contur ar lăsa altfel o fâșie de cusătură
// lungă, peste un gol fără date — și ar trece de toate probele (recenzia a încercat).
{
  const I = incarcaHarta(N.interior);
  const pe = { x0: I.nodX(0), x1: I.nodX(I.w - 1), y0: I.nodY(I.h - 1), y1: I.nodY(0) };
  if (pe.x0 !== H.x0 || pe.x1 !== H.x1 || pe.y0 !== H.y0 || pe.y1 !== H.y1)
    throw new Error(`gaura (${H.x0}…${H.x1} × ${H.y0}…${H.y1}) nu e cutia nodurilor lui ${N.interior} de pe disc (${pe.x0}…${pe.x1} × ${pe.y0}…${pe.y1})`);
}

console.log(`${nume}: ${w} × ${h} noduri la ${pas} m; X ${N.x0} … ${N.x1}, Y ${N.y0} … ${N.y1}; gaura ${N.interior}`);

// ------------------------------------------------------------ harta_v6, harta_v9: DGT

async function dinDGT() {
  const DIR = 'date-sursa/lidar';
  const REZ = 2;
  const k = pas / REZ;
  if (!Number.isInteger(k)) throw new Error(`pasul de ${pas} m nu e un multiplu al pixelului de ${REZ} m`);
  // Dalele se numesc în NIVELURI, nu se caută în director (vezi acolo). Toate cele
  // numite trebuie să fie pe disc; una de pe disc, nenumită, care atinge amprenta
  // filtrului — cutia ± (k − 1) pixeli — oprește construcția: ar schimba relieful tăcut.
  const indice = (f) => f.match(/^MDT-2m-(\d{6})-/i)?.[1];
  const peDisc = new Map(readdirSync(DIR).filter((f) => /^MDT-2m-\d{6}-.*\.tif$/i.test(f)).map((f) => [indice(f), f]));
  const lipsa = N.dale.filter((d) => !peDisc.has(d));
  if (lipsa.length) throw new Error(`${nume}: lipsesc de pe disc dalele ${lipsa.join(', ')} (${DIR})`);
  const amp = { x0: N.x0 - (k - 1) * REZ, x1: N.x1 + (k - 1) * REZ, y0: N.y0 - (k - 1) * REZ, y1: N.y1 + (k - 1) * REZ };
  const patrat = (ind) => { const c = +ind.slice(0, 3), r = +ind.slice(3); return { x0: (c - 200) * 1000, x1: (c - 199) * 1000, y0: (r - 301) * 1000, y1: (r - 300) * 1000 }; };
  const atinge = (p) => p.x0 < amp.x1 && p.x1 > amp.x0 && p.y0 < amp.y1 && p.y1 > amp.y0;
  const straine = [...peDisc.keys()].filter((d) => !N.dale.includes(d) && atinge(patrat(d)));
  if (straine.length) throw new Error(`${nume}: dalele ${straine.join(', ')} sunt pe disc, nu sunt în lista lui și ating amprenta lui — ar schimba nodurile de pe margine. Adaugă-le în NIVELURI (o hartă nouă) sau mută-le.`);
  const dale = N.dale.map((d) => ({ f: peDisc.get(d), ...citesteTiffDGT(join(DIR, peDisc.get(d))) }));
  const folosite = [], sarite = [];
  const mozaic = new Map();   // "col,rand" de dală → { t, valori }
  for (const d of dale) {
    const ind = d.f.match(/-(\d{3})(\d{3})-/);
    const col = +ind[1], rand = +ind[2];
    // Probele de sosire, ca la nmds-sanctuar: sistemul, felul pixelului, NoData, colțul.
    if (d.epsg !== 3763 || d.tipRaster !== 1 || d.nodata !== '-999' || d.rezolutie !== REZ)
      throw new Error(`${d.f}: EPSG ${d.epsg}, raster ${d.tipRaster}, NoData ${d.nodata}, pas ${d.rezolutie}`);
    if (d.x0 !== (col - 200) * 1000 || d.y0 !== (rand - 300) * 1000) {
      // Dalele 104xxx au colțul la x −95441 (vezi „Dalele 104xxx” în CLAUDE.md). Dincolo
      // de alpha nu au uscat — verificat la construcție, mai jos —, deci se sar.
      sarite.push({ dala: d.f, motiv: `colțul (${d.x0}, ${d.y0}) nu e cel al indicelui; dincolo de alpha numai apă` });
      continue;
    }
    const v = new Float32Array(d.latime * d.inaltime);
    for (let r = 0; r < d.inaltime; r++) v.set(d.rand(r), r * d.latime);
    mozaic.set(`${col},${rand}`, { d, v });
    folosite.push(d.f);
  }
  const esteApa = (v) => v === 0 || v <= -998;
  /** Pixelul de 2 m cu centrul în (x, y) — metri impari —, sau NaN (apă, fără dală). */
  const pixel = (x, y) => {
    const col = Math.floor(x / 1000) + 200, rand = Math.floor(y / 1000) + 301;
    const m = mozaic.get(`${col},${rand}`);
    if (!m) return NaN;
    const c = (x - m.d.x0 - 1) / REZ, r = (m.d.y0 - y - 1) / REZ;
    if (!Number.isInteger(c) || !Number.isInteger(r)) throw new Error(`(${x}, ${y}) nu e centrul unui pixel`);
    const v = m.v[r * m.d.latime + c];
    return esteApa(v) ? NaN : v;
  };

  // Proba de sosire a grilei: pe muchiile de nord și de est ale lui alpha, pixelii
  // citiți aici trebuie să fie exact nodurile lui harta_v4 (aceleași dale, aceleași
  // centre), în limita unei cuante. Controlul: mutați cu un pixel, nu mai sunt.
  const alpha = incarcaHarta('harta_v4');
  const muchie = [];
  for (let x = NODURI_ALPHA.x0; x <= NODURI_ALPHA.x1; x += REZ) muchie.push([x, NODURI_ALPHA.y1]);
  for (let y = NODURI_ALPHA.y0; y < NODURI_ALPHA.y1; y += REZ) muchie.push([NODURI_ALPHA.x1, y]);
  const abatere = (dx, dy) => {
    let max = 0, n = 0;
    for (const [x, y] of muchie) {
      const a = alpha.laTM(x, y), p = pixel(x + dx, y + dy);
      if (a === null || Number.isNaN(p) || a <= alpha.meta.zMin_m + 0.01) continue;
      max = Math.max(max, Math.abs(a - p)); n++;
    }
    return { max, n };
  };
  const a0 = abatere(0, 0), a1 = abatere(REZ, 0);
  proba(a0.max <= alpha.meta.zScara, `muchia lui alpha, pe ${a0.n} noduri de uscat: dalele dau exact harta_v4 (abatere maximă ${(a0.max * 1000).toFixed(2)} mm, o cuantă = ${(alpha.meta.zScara * 1000).toFixed(2)} mm)`);
  proba(a1.max > 0.5, `control: mutate cu un pixel, abaterea maximă e ${a1.max.toFixed(2)} m`);

  // Uscatul dalelor sărite, dincolo de alpha: trebuie să fie zero.
  let uscatSarit = 0;
  for (const s of sarite) {
    const d = dale.find((q) => q.f === s.dala);
    for (let r = 0; r < d.inaltime; r++) {
      const rr = d.rand(r), y = d.y0 - (r + 0.5) * REZ;
      for (let c = 0; c < d.latime; c++) {
        const x = d.x0 + (c + 0.5) * REZ;
        if (esteApa(rr[c])) continue;
        if (x > CUTIE_ALPHA.xMin && x < CUTIE_ALPHA.xMax && y > CUTIE_ALPHA.yMin && y < CUTIE_ALPHA.yMax) continue;
        uscatSarit++;
      }
    }
  }
  proba(uscatSarit === 0, `dalele sărite (${sarite.length}) n-au uscat dincolo de alpha (${uscatSarit} pixeli)`);

  // Nodul: filtrul cort pe pixelii de 2 m în jurul lui, numai pe uscat — la 4 m 1-2-1
  // pe 3 × 3, la 12 m 1-2-…-6-…-2-1 pe 11 × 11, cât amprenta a doi pași, ca relieful
  // mai fin decât grila să nu se plieze în ea. Nodul e apă dacă pixelul lui e apă —
  // țărmul rămâne unde e.
  const K =Array.from({ length: 2 * k - 1 }, (_, j) => k - Math.abs(j - (k - 1)));
  const z = new Float32Array(w * h);
  let uscat = 0;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const x = nodX(c), y = nodY(r), i = r * w + c;
      if (inGaura(x, y)) { z[i] = ADANCIME_APA; continue; }
      if (Number.isNaN(pixel(x, y))) { z[i] = ADANCIME_APA; continue; }
      let s = 0, p = 0;
      for (let dy = -(k - 1); dy <= k - 1; dy++)
        for (let dx = -(k - 1); dx <= k - 1; dx++) {
          const v = pixel(x + dx * REZ, y + dy * REZ);
          if (Number.isNaN(v)) continue;
          const g = K[dx + k - 1] * K[dy + k - 1];
          s += v * g; p += g;
        }
      z[i] = s / p;
      uscat++;
    }

  // Dalele noi sunt la locul lor: pe fiecare dală, nodurile de uscat față de Copernicus
  // GLO-30 (minus decalajul de datum măsurat pe alpha), care e un model de suprafață
  // independent. O dală pusă cu un indice greșit ar ieși cu zeci de metri. Numai pe
  // pantă mică (sub 15%, cu toți vecinii uscat): pe faleză un model de 30 m diferă de
  // LiDAR cu zeci de metri fără nicio greșeală — dala 108162, aproape numai faleză, ieșea
  // cu mediana 3,3 m și p90 14 m. Control: aceeași comparație cu fiecare dală citită de
  // la vecina ei de la est. O dală cu uscat dar cu sub 50 de noduri plate nu se poate
  // verifica așa — 108162 e numai faleză —, deci se scrie NEVERIFICATĂ, nu trecută.
  const perDala = new Map();
  const cop = await grilaCopernicus();
  {
    // Pătratele de 1 km fără dală — nici în listă, nici sărite — trebuie să fie numai
    // mare: o dală lipsă ar deveni altfel tăcut un pătrat de mare (recenzia a construit
    // harta_v9 fără 107165 și toate probele au trecut). Martorul independent e masca de
    // apă a lui GLO-30: niciun nod din ele nu are voie să fie uscat acolo.
    const sariteInd = new Set(sarite.map((s) => indice(s.dala)));
    const absente = new Map();
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        const x = nodX(c), y = nodY(r);
        if (inGaura(x, y)) continue;
        const ind = `${Math.floor(x / 1000) + 200}${Math.floor(y / 1000) + 301}`;
        if (N.dale.includes(ind) || sariteInd.has(ind)) continue;
        const g = dinTM06(x, y, null), m = cop.masca('WBM', g.lon, g.lat);
        if (!absente.has(ind)) absente.set(ind, { noduri: 0, uscat_glo30: 0 });
        const q = absente.get(ind);
        q.noduri++;
        if (m === 0) q.uscat_glo30++;
      }
    const uscatAbsent = [...absente.values()].reduce((a, q) => a + q.uscat_glo30, 0);
    proba(uscatAbsent === 0, `pătratele fără dală (${[...absente.keys()].sort().join(', ') || 'niciunul'}): ${[...absente.values()].reduce((a, q) => a + q.noduri, 0)} noduri, ${uscatAbsent} uscat pe GLO-30 — sunt numai mare`);
    perDala.absente = Object.fromEntries([...absente].sort());
  }
  {
    const dec = decalajSiInregistrare(cop).decalaj;
    const fata = (x, y, z0) => { const g = dinTM06(x, y, null); return Math.abs(cop.cota(g.lon, g.lat) - dec - z0); };
    const uscatNod = (r, c) => r >= 0 && c >= 0 && r < h && c < w && z[r * w + c] > ADANCIME_APA + 0.01;
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        const x = nodX(c), y = nodY(r), i = r * w + c;
        if (![[r, c], [r, c - 1], [r, c + 1], [r - 1, c], [r + 1, c]].every(([a, b]) => uscatNod(a, b))) continue;
        const gx = (z[i + 1] - z[i - 1]) / (2 * pas), gy = (z[i + w] - z[i - w]) / (2 * pas);
        if (Math.hypot(gx, gy) > 0.15) continue;
        const cheie = `${Math.floor(x / 1000) + 200}${Math.floor(y / 1000) + 301}`;
        if (!perDala.has(cheie)) perDala.set(cheie, { d: [], mutat: [] });
        const q = perDala.get(cheie);
        q.d.push(fata(x, y, z[i]));
        if (x + 1000 < N.x1) q.mutat.push(fata(x + 1000, y, z[i]));
      }
    console.log('\n  pe dale, |DGT − (GLO-30 − decalaj)| pe nodurile de uscat:');
    for (const [cheie, q] of [...perDala].sort()) {
      const med = mediana(q.d), medMutat = q.mutat.length ? mediana(q.mutat) : NaN;
      console.log(`    ${cheie}: ${q.d.length} noduri, mediană ${med.toFixed(2)} m, p90 ${cuantila(q.d, 0.9).toFixed(2)} m; control, la 1 km est: ${Number.isNaN(medMutat) ? '—' : medMutat.toFixed(2) + ' m'}`);
    }
    const toate = [...perDala.values()];
    proba(toate.every((q) => q.d.length < 50 || mediana(q.d) < 3), `fiecare dală cu cel puțin 50 de noduri plate stă pe GLO-30 la sub 3 m (mediană; GLO-30 are și coroanele copacilor)`);
    const mutate = toate.filter((q) => q.mutat.length >= 50).map((q) => mediana(q.mutat));
    proba(mutate.length > 0 && mediana(mutate) > 10, `control: citite la 1 km spre est, mediana lor ar fi ${mediana(mutate).toFixed(1)} m`);
    // Dalele cu uscat în hartă, dar fără destule noduri plate: NEVERIFICATE de proba asta.
    const cuUscat = new Map();
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        if (z[r * w + c] <= ADANCIME_APA + 0.01) continue;
        const ind = `${Math.floor(nodX(c) / 1000) + 200}${Math.floor(nodY(r) / 1000) + 301}`;
        cuUscat.set(ind, (cuUscat.get(ind) ?? 0) + 1);
      }
    perDala.neverificate = [...cuUscat].filter(([ind]) => (perDala.get(ind)?.d.length ?? 0) < 50).map(([ind, n]) => ({ dala: ind, noduri_uscat: n, noduri_plate: perDala.get(ind)?.d.length ?? 0 })).sort((a, b) => a.dala.localeCompare(b.dala));
    if (perDala.neverificate.length) console.log(`  NEVERIFICATE față de GLO-30 (sub 50 de noduri plate): ${perDala.neverificate.map((q) => `${q.dala} (${q.noduri_plate} din ${q.noduri_uscat})`).join(', ')}`);
  }

  const banda = pas > 4;
  return {
    z, uscat,
    descriere: banda
      ? `Împrejurimile zonei alpha, banda de ~2,4 km dincolo de harta_v6, spre nord și est. LiDAR DGT 2024-2025, MDT 2 m, la ${pas} m.`
      : 'Împrejurimile zonei alpha, banda de lângă marginile de nord și de est. LiDAR DGT 2024-2025, MDT 2 m, la 4 m.',
    prelucrare: {
      reducere: `filtru cort ${K.join('-')} pe ${2 * k - 1} × ${2 * k - 1} pixeli de 2 m, centrat pe nod, numai pe uscat; nodul e apă dacă pixelul lui e apă`,
      noduri: banda
        ? `pe metri impari, ancorate în colțul de nord-est al lui ${N.interior}; cad peste nodurile lui din ${pas / 4} în ${pas / 4}`
        : 'pe metri impari, ca harta_v4: pe muchiile de nord și de est ale lui alpha cad din doi în doi peste nodurile ei',
      dale_sarite: sarite,
      patrate_fara_dala: { nota: 'pătratele de 1 km din cutie fără dală în catalogul DGT; nodurile lor sunt apă, iar GLO-30 (WBM) nu vede uscat în ele', ...perDala.absente },
      dale_fata_de_copernicus: {
        nota: '|DGT − (GLO-30 − decalaj)|, mediana pe nodurile de uscat cu panta sub 15%; o dală cu sub 50 de astfel de noduri e NEVERIFICATĂ de proba asta',
        ...Object.fromEntries([...perDala].sort().map(([k2, q]) => [k2, { noduri: q.d.length, mediana_m: +mediana(q.d).toFixed(2) }])),
        neverificate: perDala.neverificate,
      },
    },
    sursa: {
      nume: 'Levantamento LiDAR de Portugal Continental 2024-2025 — Modelo Digital do Terreno 2 m',
      producator: 'Direção-Geral do Território (DGT)',
      densitate: '10 puncte/m²',
      licenta: 'CC BY 4.0',
      atributie: 'Dados LiDAR: © Direção-Geral do Território, Levantamento LiDAR de Portugal Continental 2024-2025, CC BY 4.0',
      portal: 'https://cdd.dgterritorio.gov.pt/',
      dale: folosite,
    },
  };
}

// ------------------------------------------------------------ harta_v7, harta_v8: Copernicus

/**
 * Cele două dale GLO-30, lipite într-o singură grilă de longitudine/latitudine.
 * PixelIsPoint: pixelul (c, r) al dalei NxxWyyy are centrul exact la
 * (lon0 + c/3600, 39 − r/3600) — citit din antet, nu presupus. Ultima coloană a
 * dalei de vest (−9,000278°) și prima a celei de est (−9°) sunt vecine la exact un
 * pas, deci lipite dau o grilă continuă.
 */
async function grilaCopernicus() {
  const manifest = JSON.parse(readFileSync('scripts/imprejurimi/surse.json', 'utf8'));
  const strat = {};
  for (const aux of ['DEM', 'FLM', 'WBM']) {
    const bucati = [];
    for (const d of DALE_COPERNICUS) {
      const m = manifest.copernicus.find((q) => q.dala === d && q.strat === aux);
      if (!m) throw new Error(`manifestul n-are ${d} ${aux}; rulează npm run surse-imprejurimi`);
      const c = await deschideCog(urlCopernicus(d, aux), { dir: dirCopernicus(d, aux), descarca: false });
      if (c.tipRaster !== 2) throw new Error(`${d} ${aux}: raster ${c.tipRaster}, aștept PixelIsPoint (2)`);
      const f = m.fereastra;
      const v = await c.fereastra(0, f.c0, f.r0, f.latime, f.inaltime);
      const p0 = c.centru(f.c0, f.r0), g = c.geometrie(0);
      bucati.push({ d, v, f, lon0: p0.x, lat0: p0.y, pas: g.pasX });
    }
    // Cele două ferestre au aceleași rânduri; coloanele se pun cap la cap.
    const [A, B] = bucati;
    if (A.f.r0 !== B.f.r0 || A.f.inaltime !== B.f.inaltime) throw new Error(`${aux}: ferestrele au alte rânduri`);
    if (Math.abs(A.lon0 + A.f.latime * A.pas - B.lon0) > 1e-9) throw new Error(`${aux}: dalele nu se ating la un pas (${A.lon0 + A.f.latime * A.pas} față de ${B.lon0})`);
    const L = A.f.latime + B.f.latime, Hh = A.f.inaltime, v = new Float32Array(L * Hh);
    for (let r = 0; r < Hh; r++) {
      v.set(A.v.subarray(r * A.f.latime, (r + 1) * A.f.latime), r * L);
      v.set(B.v.subarray(r * B.f.latime, (r + 1) * B.f.latime), r * L + A.f.latime);
    }
    strat[aux] = { v, L, H: Hh, lon0: A.lon0, lat0: A.lat0, pas: A.pas };
  }
  const D = strat.DEM;
  const ci = (lon) => (lon - D.lon0) / D.pas, ri = (lat) => (D.lat0 - lat) / D.pas;
  return {
    strat,
    /** Cota biliniară; NaN în afara ferestrei. */
    cota(lon, lat) {
      const fc = ci(lon), fr = ri(lat), c0 = Math.floor(fc), r0 = Math.floor(fr);
      if (c0 < 0 || r0 < 0 || c0 + 1 >= D.L || r0 + 1 >= D.H) return NaN;
      const tx = fc - c0, ty = fr - r0, g = (r, c) => D.v[r * D.L + c];
      return (g(r0, c0) * (1 - tx) + g(r0, c0 + 1) * tx) * (1 - ty) + (g(r0 + 1, c0) * (1 - tx) + g(r0 + 1, c0 + 1) * tx) * ty;
    },
    /** Masca pixelului cel mai apropiat. */
    masca(aux, lon, lat) {
      const S = strat[aux], c = Math.round(ci(lon)), r = Math.round(ri(lat));
      if (c < 0 || r < 0 || c >= S.L || r >= S.H) return NaN;
      return S.v[r * S.L + c];
    },
  };
}

// Masca de apă (WBM) din Copernicus DEM Product Handbook: 0 fără apă, 1 ocean, 2 lac,
// 3 râu. Masca de umplere (FLM): 2 = măsurătoare TanDEM-X nemodificată; restul e
// editat sau umplut din alte modele.
const OCEAN = 1;

/**
 * Decalajul GLO-30 − DGT și înregistrarea, pe zona alpha.
 *
 * Datele de 2 m se netezesc întâi la amprenta unui pixel GLO-30 (~24 × 31 m), apoi se
 * compară numai pe pixelii măsurați (FLM = 2), de uscat, cu NDVI mic (fără vegetație,
 * deci fără coroane în modelul de suprafață), pe pantă mică. Mutarea care face
 * abaterea cea mai mică trebuie să fie zero; controlul mută GLO-30 cu un pixel și
 * cere ca minimul să se mute cu el.
 */
function decalajSiInregistrare(cop) {
  const alpha = incarcaHarta('harta_v4');
  const ndviMeta = JSON.parse(readFileSync(`${IESIRE}/harta_v4-ndvi.json`, 'utf8'));
  const ndviBin = readFileSync(`${IESIRE}/harta_v4-ndvi.bin`);
  const ndviNod = (r, c) => { const i = r * alpha.w + c; const k = (ndviBin[i >> 1] >> ((i & 1) << 2)) & 15; return k ? ndviMeta.niveluri[k] : NaN; };
  const D = cop.strat.DEM, F = cop.strat.FLM, W = cop.strat.WBM;
  // Media DGT pe amprenta pixelului GLO-30 centrat în (x, y) TM06: ±12 m pe est, ±15 m pe nord.
  const dgt30 = (x, y) => {
    let s = 0, n = 0, nd = 0, sn = 0;
    for (let yy = y - 15; yy <= y + 15; yy += 2)
      for (let xx = x - 12; xx <= x + 12; xx += 2) {
        const c = Math.round((xx - alpha.nodX(0)) / alpha.pas), r = Math.round((alpha.nodY(0) - yy) / alpha.pas);
        if (c < 0 || r < 0 || c >= alpha.w || r >= alpha.h) return null;
        const v = alpha.z[r * alpha.w + c];
        if (v <= alpha.meta.zMin_m + 0.01) return null;   // amestec cu apa: nu e sol curat
        s += v; n++;
        const q = ndviNod(r, c); if (!Number.isNaN(q)) { sn += q; nd++; }
      }
    return { z: s / n, ndvi: nd ? sn / nd : NaN, panta: Math.abs((alpha.laTM(x + 12, y) - alpha.laTM(x - 12, y)) / 24) + Math.abs((alpha.laTM(x, y + 15) - alpha.laTM(x, y - 15)) / 30) };
  };
  // Pixelii GLO-30 din alpha, cu marginea de 60 m. Numai rândurile și coloanele
  // care pot cădea în alpha: fereastra e a lui harta_v8, de ~100 km.
  const colturi = [[CUTIE_ALPHA.xMin, CUTIE_ALPHA.yMin], [CUTIE_ALPHA.xMax, CUTIE_ALPHA.yMin], [CUTIE_ALPHA.xMin, CUTIE_ALPHA.yMax], [CUTIE_ALPHA.xMax, CUTIE_ALPHA.yMax]].map(([x, y]) => dinTM06(x, y, null));
  const cA = Math.max(0, Math.floor((Math.min(...colturi.map((g) => g.lon)) - D.lon0) / D.pas) - 2), cB = Math.min(D.L - 1, Math.ceil((Math.max(...colturi.map((g) => g.lon)) - D.lon0) / D.pas) + 2);
  const rA = Math.max(0, Math.floor((D.lat0 - Math.max(...colturi.map((g) => g.lat))) / D.pas) - 2), rB = Math.min(D.H - 1, Math.ceil((D.lat0 - Math.min(...colturi.map((g) => g.lat))) / D.pas) + 2);
  const perechi = [];
  for (let r = rA; r <= rB; r++)
    for (let c = cA; c <= cB; c++) {
      const lon = D.lon0 + c * D.pas, lat = D.lat0 - r * D.pas;
      const t = laTM(lon, lat);
      if (t.x < CUTIE_ALPHA.xMin + 60 || t.x > CUTIE_ALPHA.xMax - 60 || t.y < CUTIE_ALPHA.yMin + 60 || t.y > CUTIE_ALPHA.yMax - 60) continue;
      if (F.v[r * F.L + c] !== 2 || W.v[r * W.L + c] !== 0) continue;
      const q = dgt30(t.x, t.y);
      if (!q || !(q.ndvi < 0.15) || q.panta > 0.1) continue;
      perechi.push({ lon, lat, dgt: q.z, glo: D.v[r * D.L + c] });
    }
  const d = perechi.map((p) => p.glo - p.dgt);
  const dec = mediana(d);
  console.log(`\ndecalajul GLO-30 − DGT, pe ${perechi.length} pixeli de sol gol măsurat din alpha: mediana ${dec.toFixed(3)} m, IQR ${cuantila(d, 0.25).toFixed(3)} … ${cuantila(d, 0.75).toFixed(3)} m`);

  // Înregistrarea: GLO-30 citit mutat cu (dx, dy) pixeli, față de DGT în aceleași puncte.
  const abatere = (dc, dr) => mediana(perechi.map((p) => Math.abs(cop.cota(p.lon + dc * D.pas, p.lat - dr * D.pas) - dec - p.dgt)).filter(Number.isFinite));
  const pasi = [-1, -0.5, -0.25, 0, 0.25, 0.5, 1];
  const tabel = pasi.map((dr) => pasi.map((dc) => abatere(dc, dr)));
  let min = { v: Infinity };
  pasi.forEach((dr, i) => pasi.forEach((dc, j) => { if (tabel[i][j] < min.v) min = { v: tabel[i][j], dc, dr }; }));
  console.log('  abaterea mediană |GLO − decalaj − DGT| [m], GLO-30 mutat cu (dc, dr) pixeli:');
  console.log('    dr \\ dc ' + pasi.map((x) => String(x).padStart(7)).join(''));
  pasi.forEach((dr, i) => console.log('    ' + String(dr).padStart(7) + ' ' + tabel[i].map((x) => x.toFixed(3).padStart(7)).join('')));
  proba(Math.abs(min.dc) <= 0.25 && Math.abs(min.dr) <= 0.25, `minimul e la (${min.dc}; ${min.dr}) pixeli, cel mult un sfert de pixel de (0, 0)`);
  // Controlul: cu DGT mutat cu un pixel spre est (x + ~24 m), minimul trebuie să plece cu el.
  const abatereMutat = (dc) => mediana(perechi.map((p) => Math.abs(cop.cota(p.lon + dc * D.pas, p.lat) - dec - (alphaLa(alpha, p.lon + D.pas, p.lat) ?? NaN))).filter(Number.isFinite));
  const m0 = abatereMutat(0), m1 = abatereMutat(1);
  proba(m1 < m0, `control: cu solul mutat un pixel spre est, GLO-30 mutat la fel se potrivește mai bine (${m1.toFixed(3)} față de ${m0.toFixed(3)} m)`);
  return { decalaj: dec, n: perechi.length, iqr: [cuantila(d, 0.25), cuantila(d, 0.75)], minim_la: [min.dc, min.dr] };
}

// Cota DGT netezită la un punct lon/lat (pentru control).
function alphaLa(alpha, lon, lat) {
  const t = laTM(lon, lat);
  let s = 0, n = 0;
  for (let yy = t.y - 15; yy <= t.y + 15; yy += 2)
    for (let xx = t.x - 12; xx <= t.x + 12; xx += 2) { const v = alpha.laTM(xx, yy); if (v === null || v <= alpha.meta.zMin_m + 0.01) return null; s += v; n++; }
  return s / n;
}

const laTM = (lon, lat) => laTM06(lon, lat);

async function dinCopernicus() {
  const cop = await grilaCopernicus();
  const reg = decalajSiInregistrare(cop);
  const interior = incarcaHarta(N.interior);

  // Câte eșantioane pe latura nodului: la 32 m nodul e cam un pixel GLO-30, deci
  // ajunge cota biliniară; la 256 m se face media a 8 × 8 eșantioane pe amprenta lui.
  const sub = pas >= 128 ? 8 : 1;
  /**
   * Cota unui nod pus oriunde — în nodurile grilei și pe laturile găurii, la cusătură,
   * cu ACEEAȘI regulă, ca diferența de acolo să fie chiar cea dintre niveluri: NaN
   * pentru apă, null fără date.
   */
  const valoareNod = (x, y) => {
    let s = 0, n = 0, ocean = 0, tot = 0, lac = 0;
    for (let a = 0; a < sub; a++)
      for (let b = 0; b < sub; b++) {
        const xx = sub === 1 ? x : x - pas / 2 + (a + 0.5) * (pas / sub);
        const yy = sub === 1 ? y : y - pas / 2 + (b + 0.5) * (pas / sub);
        const g = dinTM06(xx, yy, null);
        const v = cop.cota(g.lon, g.lat), m = cop.masca('WBM', g.lon, g.lat);
        if (Number.isNaN(v) || Number.isNaN(m)) continue;
        tot++;
        // Oceanul se taie; lacurile și râurile numai cât stau la nivelul mării —
        // un lac de baraj e relief, nu o gaură spre planul mării.
        if (m === OCEAN || (m > 1 && v <= 1)) { ocean++; continue; }
        if (m > 1) lac++;
        s += v; n++;
      }
    if (!tot) return { v: null, lac };
    if (ocean * 2 >= tot || !n) return { v: NaN, lac };
    return { v: s / n - reg.decalaj, lac };
  };
  // harta_v8 e un disc: dincolo de RAZA_V8 de centrul lui alpha, nodurile sunt apă.
  const disc = nume === 'harta_v8' ? RAZA_V8 : Infinity;
  const z = new Float32Array(w * h);
  let uscat = 0, faraDate = 0, lacuri = 0, dincoloDeDisc = 0;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const x = nodX(c), y = nodY(r), i = r * w + c;
      if (inGaura(x, y)) { z[i] = ADANCIME_APA; continue; }
      if (Math.hypot(x - CENTRU.x, y - CENTRU.y) > disc) { z[i] = ADANCIME_APA; dincoloDeDisc++; continue; }
      const q = valoareNod(x, y);
      lacuri += q.lac;
      if (q.v === null) { z[i] = ADANCIME_APA; faraDate++; continue; }
      if (Number.isNaN(q.v)) { z[i] = ADANCIME_APA; continue; }
      z[i] = q.v;
      uscat++;
    }

  // Cusătura cu nivelul dinăuntru: pe fiecare latură a găurii, diferența dintre
  // nivelul dinăuntru și acesta, pe uscat în amândouă, netezită cu mediana pe ~150 m,
  // se adaugă nodurilor din bandă și scade liniar la zero spre exterior. Numai pe
  // uscat: unde un nivel vede mare și celălalt mal, diferența e de țărm, nu de datum.
  const BANDA = Math.max(300, 2 * pas);
  const laturi = {
    N: { lung: [H.x0, H.x1], fix: H.y1, pe: (t) => [t, H.y1] },
    S: { lung: [H.x0, H.x1], fix: H.y0, pe: (t) => [t, H.y0] },
    V: { lung: [H.y0, H.y1], fix: H.x0, pe: (t) => [H.x0, t] },
    E: { lung: [H.y0, H.y1], fix: H.x1, pe: (t) => [H.x1, t] },
  };
  const proprii = (x, y) => valoareNod(x, y).v ?? NaN;
  const PAS_LATURA = Math.min(pas, 16), FEREASTRA = 150;
  const rest = {};
  const statistici = [];
  for (const [k, L] of Object.entries(laturi)) {
    const t0 = L.lung[0], n = Math.floor((L.lung[1] - t0) / PAS_LATURA) + 1, brut = new Float64Array(n).fill(NaN);
    for (let j = 0; j < n; j++) {
      const [x, y] = L.pe(t0 + j * PAS_LATURA);
      const a = interior.laTM(x, y), b = proprii(x, y);
      if (a === null || a <= interior.meta.zMin_m + 0.01 || Number.isNaN(b)) continue;
      brut[j] = a - b;
    }
    const jum = Math.round(FEREASTRA / 2 / PAS_LATURA), net = new Float64Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      if (Number.isNaN(brut[j])) continue;
      const v = [];
      for (let q = Math.max(0, j - jum); q <= Math.min(n - 1, j + jum); q++) if (!Number.isNaN(brut[q])) v.push(brut[q]);
      net[j] = mediana(v);
    }
    rest[k] = { t0, n, net };
    const valide = [...brut].filter((v) => !Number.isNaN(v));
    if (valide.length) statistici.push({ latura: k, puncte: valide.length, mediana: +mediana(valide).toFixed(2), p90_abs: +cuantila(valide.map(Math.abs), 0.9).toFixed(2) });
  }
  const restLa = (k, t) => {
    const R = rest[k], j = Math.round((t - R.t0) / PAS_LATURA);
    return j < 0 || j >= R.n ? 0 : R.net[j];
  };
  let atinse = 0;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const x = nodX(c), y = nodY(r), i = r * w + c;
      if (z[i] <= ADANCIME_APA + 0.01 || inGaura(x, y)) continue;
      // Distanța până la dreptunghiul găurii și latura cea mai apropiată.
      const dx = Math.max(H.x0 - x, 0, x - H.x1), dy = Math.max(H.y0 - y, 0, y - H.y1);
      const d = Math.hypot(dx, dy);
      if (d >= BANDA) continue;
      // Pe dreptunghiul găurii sau în inelul dinăuntru (d = 0), latura cea mai
      // apropiată; altfel, cea dinspre care vine nodul.
      let k;
      if (d === 0) {
        const L = { V: x - H.x0, E: H.x1 - x, S: y - H.y0, N: H.y1 - y };
        k = Object.keys(L).reduce((p, q) => (L[q] < L[p] ? q : p));
      } else k = dx >= dy ? (x < H.x0 ? 'V' : 'E') : (y < H.y0 ? 'S' : 'N');
      const t = k === 'N' || k === 'S' ? Math.min(H.x1, Math.max(H.x0, x)) : Math.min(H.y1, Math.max(H.y0, y));
      z[i] += restLa(k, t) * (1 - d / BANDA);
      atinse++;
    }
  console.log(`cusătura cu ${N.interior}: ${atinse} noduri în banda de ${BANDA} m; diferența pe laturi, înainte de bandă:`);
  for (const s of statistici) console.log(`    ${s.latura}: ${s.puncte} puncte de uscat, mediana ${s.mediana} m, p90 |Δ| ${s.p90_abs} m`);

  return {
    z, uscat,
    descriere: `Împrejurimile zonei alpha, din Copernicus DEM GLO-30, la ${pas} m. Model de SUPRAFAȚĂ: cu coroanele copacilor și acoperișurile. Decor, nu măsurătoare.`,
    prelucrare: {
      esantionare: sub === 1 ? 'cota biliniară în nod' : `media a ${sub} × ${sub} eșantioane biliniare pe amprenta nodului, numai pe uscat`,
      apa: 'oceanul din masca WBM (1); lacurile și râurile (2, 3) numai sub 1 m; nodul e apă dacă jumătate din eșantioane sunt apă. Coborâtă la −8 m, ca la alpha: artificiu de randare, nu batimetrie',
      decalaj_datum: {
        scazut_m: +reg.decalaj.toFixed(3), pixeli: reg.n, iqr_m: reg.iqr.map((v) => +v.toFixed(3)), minim_inregistrare_pixeli: reg.minim_la,
        nota: 'mediana GLO-30 − DGT pe solul gol măsurat (FLM = 2, NDVI < 0,15, pantă mică) din alpha, cu DGT netezit la amprenta pixelului. Copernicus are altitudini EGM2008; DGT, PT-TM06 ortometric.',
      },
      cusatura: { banda_m: BANDA, laturi: statistici, nota: `diferența față de ${N.interior}, netezită cu mediana pe ${FEREASTRA} m, adăugată nodurilor din bandă și scăzută liniar la zero spre exterior; numai unde amândouă nivelurile au uscat. Artificiu de îmbinare, nu date.` },
      model_de_suprafata: 'GLO-30 e un MDS: coroanele copacilor și clădirile sunt în cote. Nu se corectează.',
      curbura: 'pământul rămâne plat, ca planul mării: ~159 m la 45 km, sub ceața completă',
      fara_date: faraDate,
      ...(disc < Infinity ? { disc: { raza_m: disc, noduri_dincolo: dincoloDeDisc, nota: 'dincolo de raza asta de centrul lui alpha nodurile sunt apă: ceața e completă, iar planul îndepărtat (60 km) nu le-ar mai prinde' } } : {}),
      noduri_cu_lac_sau_rau: lacuri,
    },
    sursa: { ...SURSA_COPERNICUS, dale: DALE_COPERNICUS },
  };
}

// ------------------------------------------------------------ scrierea

const rez = N.sursa === 'DGT' ? await dinDGT() : await dinCopernicus();
const { z } = rez;
let zmax = -Infinity;
for (const v of z) if (v > zmax) zmax = v;
const zMin = ADANCIME_APA, scara = (zmax - zMin) / 65535;
const u16 = new Uint16Array(w * h);
let limitate = 0;
for (let i = 0; i < z.length; i++) {
  const q = Math.round((z[i] - zMin) / scara);
  if (q < 0 || q > 65535) limitate++;
  u16[i] = Math.min(65535, Math.max(0, q));
}
proba(limitate === 0, `nicio cotă tăiată în Uint16 (${limitate}); maximul ${zmax.toFixed(2)} m`);
proba(rez.uscat > 0, `${rez.uscat} noduri de uscat`);

const meta = {
  nume,
  rol: 'imprejurimi',
  interior: N.interior,
  descriere: `${rez.descriere} Uint16 little-endian, rând 0 = nord.`,
  latime: w, inaltime: h,
  crs: 'ETRS89 / Portugal TM06 (EPSG:3763)',
  conventie: 'noduri: bbox_tm06 dă primul și ultimul nod',
  bbox_tm06: { xMin: N.x0, xMax: N.x1, yMin: N.y0, yMax: N.y1 },
  pasX_m: pas, pasZ_m: pas,
  zMin_m: zMin, zMax_m: +zmax.toFixed(2), zScara: scara,
  deplasare_scena: { x: (N.x0 + N.x1) / 2 - CENTRU.x, z: CENTRU.y - (N.y0 + N.y1) / 2 },
  // Nodurile nivelului dinăuntru, în TM06 și în scenă: pagina taie aici gaura și
  // coase marginea.
  interior_noduri_tm06: { x0: H.x0, x1: H.x1, y0: H.y0, y1: H.y1 },
  interior_noduri_scena: { x0: H.x0 - CENTRU.x, x1: H.x1 - CENTRU.x, z0: CENTRU.y - H.y1, z1: CENTRU.y - H.y0 },
  acoperire: {
    noduri_uscat: rez.uscat,
    regula_apa: `cota ${zMin} m: apă sau fără date. Nodurile cu mai mult de un pas în interiorul găurii au și ele cota apei: acolo se vede ${N.interior}.`,
  },
  prelucrare: rez.prelucrare,
  sursa: rez.sursa,
};
writeFileSync(join(IESIRE, `${nume}-dem.bin`), Buffer.from(u16.buffer));
writeFileSync(join(IESIRE, `${nume}-dem.json`), JSON.stringify(meta, null, 2));
console.log(`\nscris ${IESIRE}/${nume}-dem.bin (${(u16.byteLength / 1048576).toFixed(2)} MB) + .json`);
console.log(picate ? `\n${picate} probe picate` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
