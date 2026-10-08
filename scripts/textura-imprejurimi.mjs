#!/usr/bin/env node
// Texturile Satelit și straturile NDVI ale împrejurimilor zonei alpha.
//
//   npm run textura-imprejurimi                      toate nivelurile
//   npm run textura-imprejurimi -- harta_v9 harta_v7  numai acestea
//
// Scrie, pentru harta_v6, harta_v9, harta_v7 și harta_v8, `<hartă>-orto_v1.ktx2` +
// `.json`, iar pentru harta_v9, harta_v7 și harta_v8 și `<hartă>-ndvi.bin` + `.json`.
// Stratul NDVI al lui harta_v6 îl scrie `npm run strat-ndvi -- harta_v6`, din ortofoto,
// exact ca la alpha.
//
// De unde vine culoarea:
//   - ortofotoul DGT — dala lui alpha, 464-3, și cea de la nord de ea, 464-1, citite
//     ca un singur mozaic — peste tot unde acoperă: harta_v6 și harta_v9 întregi, iar
//     din harta_v7 ce stă până la ~5,5 km spre est și ~6,4 km spre nord de marginea
//     lui alpha (x −88000, y −130000);
//   - în rest, Sentinel-2 L2A din 24.07.2025, adus la culorile ortofotoului printr-o
//     transformare liniară (matrice 3 × 3 plus decalaj, în lumină liniară), potrivită
//     pe suprapunere și verificată pe o jumătate ținută deoparte. Pe ultimii 300 m
//     dinspre marginea ortofotoului, cele două se amestecă.
// La fel NDVI-ul: din ortofoto unde acoperă; altfel din roșul și infraroșul Sentinel,
// calibrat liniar pe NDVI-ul ortofotoului.
//
// Apa se topește în apa adâncă măsurată pentru alpha (harta_v4-orto_v1.json), pe
// aceeași distanță de la mal: planul mării din afara texturilor are culoarea ei.
//
// Texturile publicate se rescriu numai cu aceiași octeți (scripts/comun/publicat.mjs):
// vercel.json le ține un an în cache-ul cititorilor, deci o textură nouă primește o
// versiune nouă. Straturile NDVI nu: vercel.json le lasă pe revalidare.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { deschideMozaic, fereastra, ndvi as ndviDin } from './comun/ortofoto.mjs';
import { incarcaHarta } from './comun/relief.mjs';
import { laOklab } from './comun/oklab.mjs';
import { dinTM06, UTM29 } from './comun/tm06.mjs';
import { deschideCog } from './comun/cog.mjs';
import { cereFisier } from './comun/cere.mjs';
import { citestePngRgb } from './comun/png.mjs';
import { scrieNepublicat } from './comun/publicat.mjs';
import { DALE_SENTINEL, NIVELURI as GRILE, SURSA_SENTINEL, dirSentinel, idSentinel, urlSentinel } from './comun/imprejurimi.mjs';
import { KTX, LIN, NIVELURI_MIP, codeazaKtx, distanta, laOctet, lantMipuri, multiplu, octeti, pierdere, scriePngNiveluri } from './comun/textura.mjs';

const VERSIUNE = 'orto_v1';
// Dalele de 8 × 5 km ale foii 464: 3 e sfertul de sud-vest, al lui alpha; 1, cel de
// deasupra lui, adus de autor pe 2026-10-07 pentru harta_v9.
const ORTO = ['464-3', '464-1'].map((d) => `date-sursa/ortofoto/ortos2025_cog_25cm_rgbi_jpg_${d}_v02.tif`);
const ZBOR = 'date-sursa/derivate/zbor.json';
const IESIRE = 'public/data';
const PRAG_MB = 4;
for (const f of ORTO) cereFisier(f, `dala de ortofoto ORTOS-2025 ${f.match(/464-\d/)[0]}`, 'Vezi „Ortofotoul” în CLAUDE.md.');
cereFisier(ZBOR, 'măsurătorile zborului', 'Rulează întâi: npm run masoara-zbor');
const zbor = JSON.parse(readFileSync(ZBOR, 'utf8'));
const bazaOrto = JSON.parse(readFileSync(join(IESIRE, `harta_v4-${VERSIUNE}.json`), 'utf8'));
const manifest = JSON.parse(readFileSync('scripts/imprejurimi/surse.json', 'utf8'));

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const cuantila = (v, q) => { const s = Float64Array.from(v).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const neted = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Apa adâncă, în liniar, și estomparea de la mal: ale lui alpha.
const APA = bazaOrto.mare.srgb.map((v) => LIN[v]);
const [D0, D1] = bazaOrto.mare.estompare_m;

// Colțul texturii lui alpha: toate cadrele de aici cad pe metri întregi față de el,
// deci texelii lor se aliniază cu ai bazei (2:1, 16:1, 64:1).
const X0_ALPHA = bazaOrto.bbox_tm06.xMin, Y1_ALPHA = bazaOrto.bbox_tm06.yMax;

/** Cadrul texturii unei hărți a împrejurimilor: muchii de texel, multipli de 64 pe latură. */
function cadru(N, pas) {
  const x0 = X0_ALPHA - Math.ceil((X0_ALPHA - (N.x0 - pas)) / pas) * pas;
  const y1 = Y1_ALPHA + Math.ceil(((N.y1 + pas) - Y1_ALPHA) / pas) * pas;
  const W = multiplu((N.x1 + pas - x0) / pas, 64), H = multiplu((y1 - (N.y0 - pas)) / pas, 64);
  return { x0, y1, pas, W, H, x1: x0 + W * pas, y0: y1 - H * pas };
}

// ------------------------------------------------------------ ortofotoul

const o25 = deschideMozaic(ORTO, 0.25);
const o2 = deschideMozaic(ORTO, 2);
const o1 = deschideMozaic(ORTO, 1);
const ORTO_EXT = { x0: o25.x0, x1: o25.x0 + o25.w * o25.pas, y1: o25.y0, y0: o25.y0 - o25.h * o25.pas };
console.log(`ortofotoul (${o25.fisiere.join(' + ')}) acoperă X ${ORTO_EXT.x0} … ${ORTO_EXT.x1}, Y ${ORTO_EXT.y0} … ${ORTO_EXT.y1}`);
// Mozaicul trebuie să fie un dreptunghi plin: `inOrto` și marginea de amestec cu
// Sentinel îl tratează așa.
proba(o25.dale.reduce((a, d) => a + d.o.w * d.o.h, 0) === o25.w * o25.h, `dalele umplu dreptunghiul mozaicului (${o25.w} × ${o25.h} pixeli la 0,25 m)`);
// Deplasarea pe sol (+0,25 m spre est), ca la alpha: la 0,25 m e un pixel întreg.
// Măsurată pe 464-3 (masoara-zbor); pe 464-1 se presupune aceeași — la 2 m pe texel e
// o optime de texel.
const dxPx = Math.round(zbor.deplasare_sol.dx_m / o25.pas), dyPx = Math.round(zbor.deplasare_sol.dy_m / o25.pas);

/**
 * Cusătura dintre două dale una sub alta, la 0,25 m, în două probe. Termenul de
 * comparație e o pereche de rânduri din aceeași dală care stă și ea pe o margine de
 * bloc JPEG, la 8 rânduri de cusătură de fiecare parte. Dalele sunt tăiate din același
 * mozaic, deci cusătura nu trebuie să se deosebească de o astfel de margine.
 *   - Înregistrarea: |Δ| mediu de luminozitate peste cusătură ≤ 1,25 × cel de pe marginile
 *     de bloc. Pică de la 2 pixeli (0,5 m, un sfert de texel de 2 m); 1 pixel e sub ce
 *     rezolvă textura, cât deplasarea pe sol presupusă la 464-1.
 *   - Culoarea: diferența medie CU SEMN pe fiecare bandă (R, G, B, infraroșu) ≤ max(1
 *     nivel, 2 × cea mai mare de pe marginile de bloc). Prima probă e oarbă la nuanță:
 *     cu R și B inversate pe o dală trecea neschimbată (recenzia).
 * Controalele trebuie să PICE: dala de jos mutată 1 m spre est (prima probă), cu +2
 * niveluri pe roșu și cu R și B inversate (a doua).
 */
function cusaturaDale(o) {
  const rez = [];
  for (const A of o.dale) for (const B of o.dale) {
    if (A === B || A.r + A.o.h !== B.r || A.c !== B.c || A.o.w !== B.o.w) continue;
    const r0 = B.r - 16, n = 32, L = o.w;
    // R, G, B, infraroșu, alfa. Rândurile ferestrei: 16 e primul al dalei de jos.
    const benzi = [0, 1, 2, 3, 4].map((b) => fereastra(o, b, 0, r0, L, n));
    const masoara = (bz, dc = 0) => {
      const valid = (ra, rb, c) => bz[4][ra * L + c] >= 128 && bz[4][rb * L + c + dc] >= 128;
      const abs = (ra, rb) => {
        let s = 0, k = 0;
        for (let c = 0; c + dc < L; c++) {
          if (!valid(ra, rb, c)) continue;
          s += Math.abs(bz[0][ra * L + c] + bz[1][ra * L + c] + bz[2][ra * L + c] - bz[0][rb * L + c + dc] - bz[1][rb * L + c + dc] - bz[2][rb * L + c + dc]) / 3; k++;
        }
        return k ? s / k : NaN;
      };
      const semn = (ra, rb) => [0, 1, 2, 3].map((b) => {
        let s = 0, k = 0;
        for (let c = 0; c < L; c++) { if (!valid(ra, rb, c)) continue; s += bz[b][rb * L + c] - bz[b][ra * L + c]; k++; }
        return k ? s / k : NaN;
      });
      const peste = abs(15, 16), inauntru = (abs(7, 8) + abs(23, 24)) / 2;
      const sPeste = semn(15, 16), sBloc = Math.max(...[...semn(7, 8), ...semn(23, 24)].map(Math.abs));
      const pragSemn = Math.max(1, 2 * sBloc);
      return { peste, inauntru, sPeste, pragSemn, inreg: peste <= 1.25 * inauntru, culoare: sPeste.every((v) => Math.abs(v) <= pragSemn) };
    };
    // Dala de jos schimbată, pentru controale: numai rândurile ei (16 încolo).
    const jos = (f) => benzi.map((b, k) => { const c = Uint8Array.from(b); for (let i = 16 * L; i < c.length; i++) c[i] = f(k, i, b); return c; });
    rez.push({
      sus: o.fisiere[o.dale.indexOf(A)], jos: o.fisiere[o.dale.indexOf(B)],
      real: masoara(benzi),
      mutat: masoara(benzi, 4),
      rosu: masoara(jos((k, i, b) => (k === 0 ? Math.min(255, b[i] + 2) : b[i]))),
      inversat: masoara(jos((k, i, b) => (k === 0 ? benzi[2][i] : k === 2 ? benzi[0][i] : b[i]))),
    });
  }
  return rez;
}
for (const q of cusaturaDale(o25)) {
  const f = (v) => v.map((x) => x.toFixed(2)).join(' / ');
  console.log(`cusătura ${q.sus} | ${q.jos}: |Δ| peste ea ${q.real.peste.toFixed(2)}, pe margini de bloc ${q.real.inauntru.toFixed(2)}; cu semn, R/G/B/IR: ${f(q.real.sPeste)} (prag ${q.real.pragSemn.toFixed(2)})`);
  proba(q.real.inreg, `cusătura dintre dale e înregistrată: |Δ| ${q.real.peste.toFixed(2)} ≤ 1,25 × ${q.real.inauntru.toFixed(2)}`);
  proba(q.real.culoare, `cusătura dintre dale nu schimbă culoarea: diferența cu semn pe fiecare bandă sub ${q.real.pragSemn.toFixed(2)} niveluri`);
  // Mutarea se aplică numai peste cusătură; termenul de comparație rămâne cel nemutat.
  proba(q.mutat.peste > 1.25 * q.real.inauntru, `control: dala de jos mutată 1 m spre est pică înregistrarea (${q.mutat.peste.toFixed(2)} > 1,25 × ${q.real.inauntru.toFixed(2)})`);
  proba(!q.rosu.culoare, `control: cu +2 niveluri pe roșu, proba de culoare pică (${f(q.rosu.sPeste)})`);
  proba(!q.inversat.culoare, `control: cu R și B inversate, proba de culoare pică (${f(q.inversat.sPeste)})`);
}
const inOrto = (x, y, m = 0) => x >= ORTO_EXT.x0 + m && x <= ORTO_EXT.x1 - m && y >= ORTO_EXT.y0 + m && y <= ORTO_EXT.y1 - m;
const laMargineaOrto = (x, y) => Math.min(x - ORTO_EXT.x0, ORTO_EXT.x1 - x, y - ORTO_EXT.y0, ORTO_EXT.y1 - y);

/**
 * Culoarea medie, în liniar, a texelilor cadrului din ortofoto, pe blocuri, numai unde
 * `trebuie(q, r)`. Pixelii cu alfa < 128 nu intră în medie (marginea datelor).
 * `o` e nivelul citit, `dx`/`dy` deplasarea în pixeli ai lui.
 */
function dinOrtofoto(c, o, trebuie, dx = 0, dy = 0) {
  const bloc = Math.round(c.pas / o.pas);
  if (Math.abs(bloc * o.pas - c.pas) > 1e-9) throw new Error(`pasul ${c.pas} nu e multiplu al nivelului de ${o.pas} m`);
  const fc = (c.x0 - o.x0) / o.pas, fr = (o.y0 - c.y1) / o.pas;
  if (Math.abs(fc - Math.round(fc)) > 1e-9 || Math.abs(fr - Math.round(fr)) > 1e-9) throw new Error(`cadrul nu cade pe pixelii nivelului de ${o.pas} m`);
  const lin = new Float32Array(c.W * c.H * 3).fill(NaN), date = new Uint8Array(c.W * c.H);
  const RB = Math.max(1, Math.floor(512 / bloc));
  for (let rb = 0; rb < c.H; rb += RB) {
    const nr = Math.min(RB, c.H - rb);
    // Fereastra de citit pe banda asta: numai texelii care trebuie și cad în ortofoto.
    let qa = c.W, qb = -1, ra = Infinity, rz = -1;
    for (let r = rb; r < rb + nr; r++) for (let q = 0; q < c.W; q++) {
      const x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas;
      if (!trebuie(q, r) || !inOrto(x, y, c.pas)) continue;
      if (q < qa) qa = q; if (q > qb) qb = q;
      if (r < ra) ra = r; if (r > rz) rz = r;
    }
    if (qb < qa) continue;
    const c0 = Math.round(fc) + qa * bloc + dx, r0 = Math.round(fr) + ra * bloc - dy;
    const L = (qb - qa + 1) * bloc, nrr = rz - ra + 1;
    const benzi = [0, 1, 2, 4].map((k) => fereastra(o, k, c0, r0, L, nrr * bloc));
    for (let r = 0; r < nrr; r++) for (let q = qa; q <= qb; q++) {
      const x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (ra + r + 0.5) * c.pas;
      if (!trebuie(q, ra + r) || !inOrto(x, y, c.pas)) continue;
      // Aceeași regulă ca textura lui alpha (`citesteNivel0` din textura-ortofoto):
      // pe marginea datelor, sub jumătate de pixeli valizi, media e numai pe ei; altfel
      // pe toți — alfa sub 128 înăuntru e artefact JPEG, nu gol. Așa, unde se
      // suprapun, texelii ies ca ai bazei.
      let s0 = 0, s1 = 0, s2 = 0, a = 0, t0 = 0, t1 = 0, t2 = 0;
      for (let yy = 0; yy < bloc; yy++) for (let xx = 0; xx < bloc; xx++) {
        const k = (r * bloc + yy) * L + (q - qa) * bloc + xx;
        t0 += LIN[benzi[0][k]]; t1 += LIN[benzi[1][k]]; t2 += LIN[benzi[2][k]];
        if (benzi[3][k] < 128) continue;
        s0 += LIN[benzi[0][k]]; s1 += LIN[benzi[1][k]]; s2 += LIN[benzi[2][k]]; a++;
      }
      if (!a) continue;    // niciun pixel cu date: fără ortofoto aici
      const i = (ra + r) * c.W + q, n = bloc * bloc;
      if (a * 2 < n) { lin[i * 3] = s0 / a; lin[i * 3 + 1] = s1 / a; lin[i * 3 + 2] = s2 / a; }
      else { lin[i * 3] = t0 / n; lin[i * 3 + 1] = t1 / n; lin[i * 3 + 2] = t2 / n; }
      date[i] = 1;
    }
    process.stdout.write('.');
  }
  console.log('');
  return { lin, date };
}

// ------------------------------------------------------------ Sentinel-2

/** Rasterele Sentinel ale unei rezoluții, din cache, cu eșantionare biliniară în UTM 29N. */
async function rastereSentinel(pas) {
  const dale = [];
  for (const g of DALE_SENTINEL) {
    const intrare = manifest.sentinel.dale.find((d) => d.id === idSentinel(g));
    if (!intrare) throw new Error(`manifestul n-are ${idSentinel(g)}`);
    if (intrare.decalaj_boa_aplicat !== true) throw new Error(`${intrare.id}: decalajul BOA nu e aplicat; NDVI-ul ar ieși greșit`);
    const benzi = {};
    for (const banda of ['TCI', 'B04', 'B08', 'SCL']) {
      // Pasul piramidei nu e rotund (10 m × 10980 / 1373 = 79,97 m): toleranță de 1%.
      const dorit = banda === 'TCI' && pas === 20 ? 10 : pas;
      const f = intrare.ferestre.find((q) => q.banda === banda && Math.abs(q.pas[0] / dorit - 1) < 0.01);
      if (!f) continue;
      const c = await deschideCog(urlSentinel(g, banda), { dir: dirSentinel(g, banda), descarca: false });
      const geo = c.geometrie(f.nivel), F = f.fereastra;
      const v = [];
      for (let b = 0; b < (banda === 'TCI' ? 3 : 1); b++) v.push(await c.fereastra(f.nivel, F.c0, F.r0, F.latime, F.inaltime, NaN, b));
      benzi[banda] = { v, L: F.latime, H: F.inaltime, x0: geo.x0 + F.c0 * geo.pasX, y1: geo.y0 - F.r0 * geo.pasY, pas: geo.pasX };
    }
    if (benzi.TCI) dale.push({ g, benzi });
  }
  /** Valoarea biliniară a benzii `banda` (indicele b) în punctul UTM; null fără date. */
  const esantion = (banda, b, ux, uy) => {
    for (const d of dale) {
      const B = d.benzi[banda]; if (!B) continue;
      const fc = (ux - B.x0) / B.pas - 0.5, fr = (B.y1 - uy) / B.pas - 0.5;
      const c0 = Math.floor(fc), r0 = Math.floor(fr);
      if (c0 < 0 || r0 < 0 || c0 + 1 >= B.L || r0 + 1 >= B.H) continue;
      const tx = fc - c0, ty = fr - r0, g = (r, c) => B.v[b][r * B.L + c];
      const v00 = g(r0, c0), v01 = g(r0, c0 + 1), v10 = g(r0 + 1, c0), v11 = g(r0 + 1, c0 + 1);
      if (!(v00 > 0 && v01 > 0 && v10 > 0 && v11 > 0)) continue;   // 0 = fără date
      return (v00 * (1 - tx) + v01 * tx) * (1 - ty) + (v10 * (1 - tx) + v11 * tx) * ty;
    }
    return null;
  };
  /** Clasa SCL a pixelului cel mai apropiat. */
  const clasa = (ux, uy) => {
    for (const d of dale) {
      const B = d.benzi.SCL; if (!B) continue;
      const c = Math.floor((ux - B.x0) / B.pas), r = Math.floor((B.y1 - uy) / B.pas);
      if (c < 0 || r < 0 || c >= B.L || r >= B.H) continue;
      const v = B.v[0][r * B.L + c]; if (v > 0) return v;
    }
    return 0;
  };
  return { esantion, clasa, dale: dale.map((d) => d.g) };
}
// SCL: 3 umbră de nor, 8–10 nori și cirrus, 6 apă. Pixelii aceștia nu intră în potriviri.
const SCL_RAU = new Set([0, 1, 3, 8, 9, 10, 11]);

/**
 * Mediile unor benzi Sentinel pe amprenta unui texel/nod TM06 (n × n eșantioane
 * biliniare), și dacă vreun eșantion e nor, umbră sau fără clasă. Proiecția —
 * TM06 → lon/lat → UTM — se face o singură dată pe eșantion, pentru toate benzile.
 * `cereri` e o listă de [bandă, indice]; null dacă vreo bandă n-are niciun eșantion.
 */
function mediiPeAmprenta(S, cereri, x, y, latura, n) {
  const s = new Float64Array(cereri.length), k = new Uint32Array(cereri.length);
  let rai = 0;
  for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) {
    const xx = x - latura / 2 + (a + 0.5) * (latura / n), yy = y - latura / 2 + (c + 0.5) * (latura / n);
    const g = dinTM06(xx, yy, null), u = UTM29.inainte(g.lon, g.lat);
    let vreuna = false;
    cereri.forEach(([banda, b], j) => { const v = S.esantion(banda, b, u.x, u.y); if (v !== null) { s[j] += v; k[j]++; vreuna = true; } });
    if (vreuna && SCL_RAU.has(S.clasa(u.x, u.y))) rai++;
  }
  if ([...k].some((v) => !v)) return null;
  return { v: [...s].map((v, j) => v / k[j]), bun: rai === 0 };
}
const TCI3 = [['TCI', 0], ['TCI', 1], ['TCI', 2]];
const ROSU_NIR = [['B04', 0], ['B08', 0]];
const esantioanePe = (pas) => (pas >= 64 ? 2 : 4);

// Culoarea TCI ca vector: varianta „liniar” ia octeții drept reflectanță scalată,
// varianta „sRGB” îi decodează întâi. Se alege cea care se potrivește mai bine pe
// jumătatea ținută deoparte.
const VARIANTE = { liniar: (v) => v / 255, sRGB: (v) => LIN[Math.max(0, Math.min(255, Math.round(v)))] };

/** Cele mai mici pătrate pentru y ≈ M·x + b, pe fiecare canal: M 3 × 3, b 3. */
function potriveste(X, Y) {
  const n = X.length, A = Array.from({ length: 4 }, () => new Float64Array(4)), out = [];
  for (const x of X) { const v = [x[0], x[1], x[2], 1]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) A[i][j] += v[i] * v[j]; }
  for (let k = 0; k < 3; k++) {
    const B = new Float64Array(4);
    for (let t = 0; t < n; t++) { const v = [X[t][0], X[t][1], X[t][2], 1]; for (let i = 0; i < 4; i++) B[i] += v[i] * Y[t][k]; }
    out.push(rezolva(A.map((r) => Float64Array.from(r)), B));
  }
  return (x) => out.map((c) => c[0] * x[0] + c[1] * x[1] + c[2] * x[2] + c[3]);
}
function rezolva(A, B) {
  const n = B.length;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [B[i], B[p]] = [B[p], B[i]];
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; B[r] -= f * B[i]; }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = B[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
}
const oklabLin = (l) => laOklab(...l.map((v) => laOctet(v)));
const dEok = (a, b) => { const p = oklabLin(a), q = oklabLin(b); return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/**
 * Transferul de culoare Sentinel → ortofoto pe un cadru: perechi pe texelii de uscat cu
 * ortofoto și Sentinel bun, potrivite pe blocurile „pare” (de 512 m) și verificate pe
 * cele „impare”. Întoarce funcția de transfer și cifrele.
 */
function transferCuloare(c, orto, s2, uscat) {
  const perechi = [];
  for (let i = 0; i < c.W * c.H; i++) {
    if (!orto.date[i] || !s2.bun[i] || !uscat[i]) continue;
    const q = i % c.W, r = (i / c.W) | 0;
    const bloc = (Math.floor((c.x0 + q * c.pas) / 512) + Math.floor((c.y1 - r * c.pas) / 512)) & 1;
    perechi.push({ o: [orto.lin[i * 3], orto.lin[i * 3 + 1], orto.lin[i * 3 + 2]], s: [s2.tci[i * 3], s2.tci[i * 3 + 1], s2.tci[i * 3 + 2]], bloc });
  }
  let cel = null;
  const rez = {};
  for (const [nume, f] of Object.entries(VARIANTE)) {
    const antr = perechi.filter((p) => !p.bloc), ver = perechi.filter((p) => p.bloc);
    const T = potriveste(antr.map((p) => p.s.map(f)), antr.map((p) => p.o));
    const d = ver.map((p) => dEok(T(p.s.map(f)), p.o));
    const brut = ver.map((p) => dEok(p.s.map(f), p.o));
    rez[nume] = { antrenare: antr.length, verificare: ver.length, dE_medie: +(d.reduce((a, x) => a + x, 0) / d.length).toFixed(2), dE_p90: +cuantila(d, 0.9).toFixed(2), fara_transfer_dE_medie: +(brut.reduce((a, x) => a + x, 0) / brut.length).toFixed(2) };
    if (!cel || rez[nume].dE_medie < rez[cel].dE_medie) cel = nume;
    rez[nume].T = T; rez[nume].f = f;
  }
  for (const [k, v] of Object.entries(rez)) console.log(`    TCI „${k}”: ${v.antrenare} perechi la potrivire, ${v.verificare} la verificare — ΔE medie ${v.dE_medie} (p90 ${v.dE_p90}); fără transfer ${v.fara_transfer_dE_medie}`);
  const ales = rez[cel];
  return { transfer: (s) => ales.T(s.map(ales.f)), cifre: Object.fromEntries(Object.entries(rez).map(([k, v]) => [k, { antrenare: v.antrenare, verificare: v.verificare, dE_medie: v.dE_medie, dE_p90: v.dE_p90, fara_transfer_dE_medie: v.fara_transfer_dE_medie }])), varianta: cel };
}

// ------------------------------------------------------------ uscatul pe texeli

/** Uscatul pe texelii cadrului: nodul cel mai apropiat al hărții, cu alpha și nivelurile dinăuntru peste ea. */
function uscatPeTexeli(c, harti) {
  const m = new Uint8Array(c.W * c.H);
  for (let r = 0; r < c.H; r++) for (let q = 0; q < c.W; q++) {
    const x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas;
    for (const hh of harti) {
      if (!hh.inauntru(x, y)) continue;
      const jum = hh.conventie === 'noduri' ? 0 : hh.pas / 2;
      const cc = Math.round((x - hh.bbox.xMin - jum) / hh.pas), rr = Math.round((hh.bbox.yMax - jum - y) / hh.pas);
      if (cc < 0 || rr < 0 || cc >= hh.w || rr >= hh.h) continue;
      if (hh.z[rr * hh.w + cc] > hh.meta.zMin_m + 0.01) m[r * c.W + q] = 1;
      break;
    }
  }
  return m;
}

// ------------------------------------------------------------ NDVI

// Tabelul de decodare, ca în strat-ndvi.mjs: pas 0,05 pe [−0,10; 0,60].
const NIV_NDVI = [null, ...Array.from({ length: 15 }, (_, i) => +(-0.10 + 0.05 * i).toFixed(2))];
const codeaza = (v) => { let k = 1, d = Math.abs(v - NIV_NDVI[1]); for (let j = 2; j <= 15; j++) { const e = Math.abs(v - NIV_NDVI[j]); if (e < d) { d = e; k = j; } } return k; };

// Nivelul de 1 m al ortofotoului, citit o singură dată, întreg (8 × 5 km, 4 benzi de
// câte 40 MB): NDVI-ul pe noduri l-ar decoda altfel de zeci de mii de ori.
let O1 = null;
const ortoLa1m = () => {
  if (!O1) O1 = Object.fromEntries([['R', 0], ['N', 3], ['A', 4]].map(([k, b]) => [k, fereastra(o1, b, 0, 0, o1.w, o1.h)]));
  return O1;
};

/** NDVI-ul ortofotoului pe amprenta unui nod (nivelul de 1 m, blocuri întregi), sau NaN. */
function ndviOrto(x, y, latura) {
  const n = Math.round(latura / o1.pas);
  const c0 = Math.round((x - latura / 2 - o1.x0) / o1.pas), r0 = Math.round((o1.y0 - (y + latura / 2)) / o1.pas);
  if (c0 < 0 || r0 < 0 || c0 + n > o1.w || r0 + n > o1.h) return NaN;
  const { R, N: Nn, A } = ortoLa1m();
  let sr = 0, sn = 0, k = 0;
  for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) {
    const i = r * o1.w + c;
    if (A[i] < 128) continue;
    sr += R[i]; sn += Nn[i]; k++;
  }
  return k * 2 >= n * n ? ndviDin(sr / k, sn / k) : NaN;
}

// ------------------------------------------------------------ main

const alpha = incarcaHarta('harta_v4');
// Lanțul nivelurilor, de la cel dinăuntru spre orizont (cheile lui NIVELURI sunt în
// ordinea asta).
const LANT = Object.keys(GRILE);
const harti = Object.fromEntries(LANT.map((n) => [n, incarcaHarta(n)]));
const PAS_TEX = { harta_v6: 2, harta_v9: 2, harta_v7: 16, harta_v8: 64 };
// Hărțile care spun unde e uscat pe texelii unui cadru, de la cea dinăuntru spre
// exterior: fiecare are cota apei în gaura ei, deci întâi trebuie întrebată cea care
// chiar se vede acolo.
const ordine = Object.fromEntries(LANT.map((n, k) => [n, [alpha, ...LANT.slice(0, k + 1).map((m) => harti[m])]]));
const S20 = await rastereSentinel(20), S80 = await rastereSentinel(80);
console.log(`Sentinel: la 10/20 m dalele ${S20.dale.join(', ')}; la 80 m ${S80.dale.join(', ')}`);

const cerute = process.argv.slice(2).filter((a) => !a.startsWith('--'));
for (const n of cerute) if (!LANT.includes(n)) throw new Error(`${n} nu e un nivel al împrejurimilor (${LANT.join(', ')})`);
for (const nume of LANT.filter((n) => !cerute.length || cerute.includes(n))) {
  const dgt = GRILE[nume].sursa === 'DGT';
  const N = GRILE[nume], hh = harti[nume], c = cadru(N, PAS_TEX[nume]);
  console.log(`\n${nume}: textura ${c.W} × ${c.H} la ${c.pas} m, X ${c.x0} … ${c.x1}, Y ${c.y0} … ${c.y1}`);
  proba([...Array(NIVELURI_MIP).keys()].every((k) => (c.W >> k) % 4 === 0 && (c.H >> k) % 4 === 0), `toate cele ${NIVELURI_MIP} niveluri sunt multipli de 4`);
  proba(Number.isInteger((c.x0 - X0_ALPHA) / c.pas) && Number.isInteger((Y1_ALPHA - c.y1) / c.pas), `texelii cad pe texelii bazei (colțul la ${(c.x0 - X0_ALPHA)} / ${(Y1_ALPHA - c.y1)} m de al ei)`);

  // Ce texeli contează: în afara găurii, cu o margine de 64 m înăuntru (cât prinde
  // cel mai grosier mip de lângă cusătură).
  const I = N.interior === 'harta_v4' ? { x0: alpha.bbox.xMin, x1: alpha.bbox.xMax, y0: alpha.bbox.yMin, y1: alpha.bbox.yMax } : GRILE[N.interior];
  const MARJA = Math.max(64, 16 * c.pas);
  const trebuie = (q, r) => {
    const x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas;
    return !(x > I.x0 + MARJA && x < I.x1 - MARJA && y > I.y0 + MARJA && y < I.y1 - MARJA);
  };
  // Uscatul pe texeli, din tot lanțul: dinăuntru spre exterior, cu nivelurile din AFARĂ
  // la urmă. Cadrul trece cu un texel de ultimul nod, iar acolo hotărăște nivelul din
  // afară; fără el, texelii de dincolo de grilă ieșeau apă adâncă, iar mipurile
  // întunecau marginea pe cusătură (recenzia: ΔL_OK×100 −5,3 la mipul 1, pe marginea de
  // nord a lui harta_v9; −7 la harta_v7).
  const uscat = uscatPeTexeli(c, [alpha, ...LANT.map((m) => harti[m])]);

  // Ortofotoul, unde acoperă.
  const orto = dgt ? dinOrtofoto(c, o25, trebuie, dxPx, dyPx)
    : nume === 'harta_v7' ? dinOrtofoto(c, o2, trebuie) : { lin: new Float32Array(c.W * c.H * 3).fill(NaN), date: new Uint8Array(c.W * c.H) };
  let cuOrto = 0, uscatTot = 0, uscatOrto = 0;
  for (let i = 0; i < c.W * c.H; i++) { if (orto.date[i]) cuOrto++; if (uscat[i] && trebuie(i % c.W, (i / c.W) | 0)) { uscatTot++; if (orto.date[i]) uscatOrto++; } }
  console.log(`  ortofoto pe ${cuOrto} texeli; uscatul care contează: ${uscatTot}, din care cu ortofoto ${uscatOrto}`);
  if (dgt) proba(uscatOrto === uscatTot, `${nume}: tot uscatul are ortofoto (${uscatOrto} / ${uscatTot})`);
  // Dalele de ortofoto care cad în cadru, pentru surse.
  const daleCadru = o25.dale.filter((d) => { const x0 = o25.x0 + d.c * o25.pas, y1 = o25.y0 - d.r * o25.pas; return x0 < c.x1 && x0 + d.o.w * o25.pas > c.x0 && y1 > c.y0 && y1 - d.o.h * o25.pas < c.y1; }).map((d) => d.cale.split('/').pop());

  // Sentinel, unde nu e ortofoto sau lângă marginea lui.
  const lin = new Float32Array(c.W * c.H * 3).fill(0);
  let surseFolosite = new Set(orto.date.some((v) => v) ? ['orto'] : []);
  let transfer = null;
  if (!dgt) {
    const S = nume === 'harta_v7' ? S20 : S80;
    const tci = new Float32Array(c.W * c.H * 3).fill(NaN), bun = new Uint8Array(c.W * c.H);
    for (let r = 0; r < c.H; r++) {
      for (let q = 0; q < c.W; q++) {
        if (!trebuie(q, r)) continue;
        const i = r * c.W + q, x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas;
        if (orto.date[i] && laMargineaOrto(x, y) > 300) continue;   // ortofoto curat: Sentinel nu trebuie
        const m = mediiPeAmprenta(S, TCI3, x, y, c.pas, esantioanePe(c.pas));
        if (!m) continue;
        for (let k = 0; k < 3; k++) tci[i * 3 + k] = m.v[k];
        bun[i] = m.bun ? 1 : 0;
      }
      if (r % 64 === 0) process.stdout.write('.');
    }
    console.log('');
    // Transferul se potrivește pe suprapunere: la harta_v7 pe texelii ei cu ortofoto; la
    // harta_v8, pe un cadru de 64 m citit din nivelul de 2 m al ortofotoului.
    let potrivire = { c, orto, s2: { tci, bun } };
    if (nume === 'harta_v8') {
      const cp = { ...c };
      const op = dinOrtofoto(cp, o2, (q, r) => { const x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas; return inOrto(x, y, 64); });
      const tp = new Float32Array(c.W * c.H * 3).fill(NaN), bp = new Uint8Array(c.W * c.H);
      for (let i = 0; i < c.W * c.H; i++) {
        if (!op.date[i]) continue;
        const q = i % c.W, r = (i / c.W) | 0, x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas;
        const m = mediiPeAmprenta(S, TCI3, x, y, c.pas, esantioanePe(c.pas));
        if (!m) continue;
        for (let k = 0; k < 3; k++) tp[i * 3 + k] = m.v[k];
        bp[i] = m.bun ? 1 : 0;
      }
      const uscatP = uscatPeTexeli(c, ordine.harta_v8);
      potrivire = { c, orto: op, s2: { tci: tp, bun: bp }, uscat: uscatP };
    }
    console.log(`  transferul Sentinel → ortofoto (${nume === 'harta_v7' ? '10 m' : '80 m'}):`);
    transfer = transferCuloare(potrivire.c, potrivire.orto, potrivire.s2, potrivire.uscat ?? uscat);
    proba(transfer.cifre[transfer.varianta].dE_medie < transfer.cifre[transfer.varianta].fara_transfer_dE_medie, `transferul apropie Sentinel de ortofoto pe jumătatea de verificare (ΔE ${transfer.cifre[transfer.varianta].dE_medie} față de ${transfer.cifre[transfer.varianta].fara_transfer_dE_medie} fără)`);
    const faraCuloare = new Uint8Array(c.W * c.H);
    for (let i = 0; i < c.W * c.H; i++) {
      const q = i % c.W, r = (i / c.W) | 0, x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas;
      const areS = !Number.isNaN(tci[i * 3]);
      const s = areS ? transfer.transfer([tci[i * 3], tci[i * 3 + 1], tci[i * 3 + 2]]).map((v) => Math.max(0, v)) : null;
      if (orto.date[i]) {
        const w = s ? neted(0, 300, laMargineaOrto(x, y)) : 1;
        for (let k = 0; k < 3; k++) lin[i * 3 + k] = orto.lin[i * 3 + k] * w + (s ? s[k] * (1 - w) : 0);
      } else if (s) {
        for (let k = 0; k < 3; k++) lin[i * 3 + k] = s[k];
        surseFolosite.add('sentinel');
      } else {
        for (let k = 0; k < 3; k++) lin[i * 3 + k] = APA[k];
        if (uscat[i] && trebuie(q, r)) faraCuloare[i] = 1;
      }
    }
    // Uscatul fără nicio culoare: texelii de dincolo de grilă — cadrul are laturi multiplu
    // de 64 de texeli, deci la est de harta_v7 trece cu ~1 km de ea —, unde ferestrele
    // Sentinel aduse (cutia ± 600 m) nu mai ajung, iar harta_v8 spune uscat. Nu se văd
    // direct, dar intră în mipuri; colorați ca marea, ar întuneca marginea. Iau culoarea
    // celui mai apropiat texel colorat, din vecin în vecin.
    let ramase = faraCuloare.reduce((a, v) => a + v, 0);
    const umplute = ramase;
    while (ramase) {
      const noi = [];
      for (let i = 0; i < c.W * c.H; i++) {
        if (!faraCuloare[i]) continue;
        const q = i % c.W, r = (i / c.W) | 0, s = [0, 0, 0];
        let m = 0;
        for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const qq = q + dq, rr = r + dr, j = rr * c.W + qq;
          if (qq < 0 || rr < 0 || qq >= c.W || rr >= c.H || !uscat[j] || faraCuloare[j] || !trebuie(qq, rr)) continue;
          s[0] += lin[j * 3]; s[1] += lin[j * 3 + 1]; s[2] += lin[j * 3 + 2]; m++;
        }
        if (m) noi.push([i, s.map((v) => v / m)]);
      }
      if (!noi.length) break;
      for (const [i, v] of noi) { lin.set(v, i * 3); faraCuloare[i] = 0; }
      ramase -= noi.length;
    }
    if (umplute) console.log(`  ${umplute} texeli de uscat fără culoare, dincolo de grilă: culoarea vecinului colorat (${ramase} rămași)`);
  } else {
    for (let i = 0; i < c.W * c.H; i++) for (let k = 0; k < 3; k++) lin[i * 3 + k] = orto.date[i] ? orto.lin[i * 3 + k] : APA[k];
  }

  // Apa: în apa adâncă, cu distanța de la mal, ca la alpha. Texelii din adâncul găurii
  // primesc și ei apa adâncă: acolo se vede nivelul dinăuntru.
  const D = distanta(uscat, c.W, c.H);
  for (let i = 0; i < c.W * c.H; i++) {
    const q = i % c.W, r = (i / c.W) | 0;
    if (!trebuie(q, r)) { for (let k = 0; k < 3; k++) lin[i * 3 + k] = APA[k]; continue; }
    if (uscat[i]) continue;
    const laMargine = Math.min(q, r, c.W - 1 - q, c.H - 1 - r) * c.pas;
    let a = 1 - neted(D0, D1, D[i] * c.pas);
    a *= neted(0, 16, laMargine);
    for (let k = 0; k < 3; k++) lin[i * 3 + k] = APA[k] + (lin[i * 3 + k] - APA[k]) * a;
  }

  // Marginea cadrului nu e mai închisă decât interiorul: pe fiecare latură, pe uscat,
  // |ΔL| dintre texelul de margine și vecinul lui dinăuntru față de |ΔL| dintre vecin și
  // următorul. Cu texelii de dincolo de grilă puși apă adâncă, ca înainte, marginea de
  // nord a lui harta_v9 avea 1 052 de texeli de uscat colorați ca marea.
  {
    const L = (i) => 100 * oklabLin([lin[i * 3], lin[i * 3 + 1], lin[i * 3 + 2]])[0];
    let sM = 0, sI = 0, n = 0, apaPeUscat = 0;
    const pune = (a, b, d) => {
      if (!uscat[a] || !trebuie(a % c.W, (a / c.W) | 0)) return;
      if (Math.hypot(...[0, 1, 2].map((k) => lin[a * 3 + k] - APA[k])) < 1e-6) apaPeUscat++;
      if (!uscat[b] || !uscat[d]) return;
      sM += Math.abs(L(a) - L(b)); sI += Math.abs(L(b) - L(d)); n++;
    };
    for (let q = 0; q < c.W; q++) { pune(q, c.W + q, 2 * c.W + q); const j = (c.H - 1) * c.W + q; pune(j, j - c.W, j - 2 * c.W); }
    for (let r = 0; r < c.H; r++) { const j = r * c.W; pune(j, j + 1, j + 2); const e = j + c.W - 1; pune(e, e - 1, e - 2); }
    const m = n ? sM / n : 0, ii = n ? sI / n : 0;
    proba(apaPeUscat === 0 && m <= 1.5 * ii + 0.5, `${nume}: marginea cadrului, pe ${n} texeli de uscat — |ΔL×100| față de vecin ${m.toFixed(2)}, între vecini ${ii.toFixed(2)}; ${apaPeUscat} texeli de uscat cu culoarea mării`);
  }

  // Proba cusăturii cu alpha, la harta_v6: unde cele două texturi se suprapun — banda
  // de 64 m dinăuntrul lui alpha, păstrată pentru mipuri —, texelii de 2 m de aici față
  // de nivelul de 2 m al texturii bazei (PNG-ul ei de lucru): aceeași dală, aceeași
  // deplasare, aceeași regulă de mediere în liniar. Numai pe uscat la cel puțin doi
  // texeli de apă: la mal baza și-a amestecat marea înainte de mipuri. Control: baza
  // citită cu un texel alături.
  if (nume === 'harta_v6') {
    const cale = join('date-sursa/derivate/textura', `harta_v4-${VERSIUNE}`, 'nivel-1.png');
    if (!existsSync(cale)) console.log(`  PROBA CUSĂTURII SĂRITĂ: lipsește ${cale} (rulează npm run textura-ortofoto)`);
    else {
      const baza = citestePngRgb(readFileSync(cale));
      const apa = new Uint8Array(c.W * c.H);
      for (let i = 0; i < apa.length; i++) apa[i] = uscat[i] ? 0 : 1;
      const Dw = distanta(apa, c.W, c.H);
      const compara = (decalaj) => {
        let n = 0, egal = 0, max = 0;
        for (let r = 0; r < c.H; r++) for (let q = 0; q < c.W; q++) {
          const i = r * c.W + q;
          if (!uscat[i] || !orto.date[i] || Dw[i] < 2 || !trebuie(q, r)) continue;
          const x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas;
          if (!(x > alpha.bbox.xMin && x < alpha.bbox.xMax && y > alpha.bbox.yMin && y < alpha.bbox.yMax)) continue;
          const qb = Math.round((x - X0_ALPHA) / 2 - 0.5) + decalaj, rb = Math.round((Y1_ALPHA - y) / 2 - 0.5);
          if (qb < 0 || rb < 0 || qb >= baza.w || rb >= baza.h) continue;
          n++;
          let d = 0;
          for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(laOctet(lin[i * 3 + k]) - baza.rgb[(rb * baza.w + qb) * 3 + k]));
          if (!d) egal++;
          max = Math.max(max, d);
        }
        return { n, egal, max };
      };
      const p0 = compara(0), p1 = compara(1);
      proba(p0.n > 1000 && p0.max <= 1 && p0.egal >= 0.99 * p0.n, `cusătura cu textura bazei: pe ${p0.n} texeli de uscat comuni, ${p0.egal} identici, abaterea maximă ${p0.max} nivel(e)`);
      proba(p1.egal < 0.5 * p1.n, `control: baza citită cu un texel alături, numai ${p1.egal} din ${p1.n} identici`);
    }
  }

  // Scrierea: mipuri, PNG, KTX2.
  const mip = lantMipuri(lin, c.W, c.H);
  const niveluri = mip.map((l, k) => ({ W: c.W >> k, H: c.H >> k, b: octeti(l) }));
  const pnguri = scriePngNiveluri(`${nume}-${VERSIUNE}`, niveluri);
  if (!KTX) throw new Error('lipsește ktx (KTX-Software 4.4)');
  const f = join('date-sursa/derivate/textura', `${nume}-${VERSIUNE}`, 'uastc.ktx2');
  const b = codeazaKtx(pnguri, f, 'uastc');
  const p = pierdere(f, niveluri[0].b, c.W, c.H);
  console.log(`  KTX2 UASTC: ${(b.length / 1048576).toFixed(2)} MB; după decodare ΔE medie ${p.medie}, p99 ${p.p99}`);
  proba(b.length <= PRAG_MB * 1048576, `${nume}: ${(b.length / 1048576).toFixed(2)} MB, sub pragul de ${PRAG_MB} MB`);
  scrieNepublicat(join(IESIRE, `${nume}-${VERSIUNE}.ktx2`), b);
  const surse = [...surseFolosite].map((s) => (s === 'orto'
    ? { nume: 'Ortofotomapa digital de Portugal Continental 2025, 25 cm', fisiere: daleCadru, producator: 'Direção-Geral do Território (DGT)', licenta: 'CC BY 4.0', atributie: 'Ortofotos: © Direção-Geral do Território, ORTOS-2025, CC BY 4.0', portal: 'https://cdd.dgterritorio.gov.pt/' }
    : { ...SURSA_SENTINEL, scena: manifest.sentinel.scena }));
  const sidecar = {
    nume: `${nume}-${VERSIUNE}`, harta: nume, versiune: VERSIUNE, rol: 'imprejurimi',
    format: `KTX2, UASTC cu RDO și zstd, R8G8B8_SRGB, ${NIVELURI_MIP} niveluri de mip`,
    conventie: 'muchii de pixel: texelul (q, r) acoperă [x0 + q·pas, x0 + (q + 1)·pas] × [y1 − (r + 1)·pas, y1 − r·pas]; rândul 0 e nordul',
    bbox_tm06: { xMin: c.x0, xMax: c.x1, yMin: c.y0, yMax: c.y1 },
    pas_m: c.pas, latime: c.W, inaltime: c.H, niveluri: NIVELURI_MIP,
    octeti: b.length, sha256: createHash('sha256').update(b).digest('hex'),
    pierdere_dE: p,
    culoare: {
      ortofoto: dgt ? 'nivelul de 0,25 m, mutat cu deplasarea pe sol, mediat în liniar' : nume === 'harta_v7' ? 'nivelul de 2 m, mediat în liniar, unde acoperă' : 'nefolosit',
      sentinel: transfer ? { varianta_tci: transfer.varianta, transfer: transfer.cifre, amestec: 'pe ultimii 300 m dinspre marginea ortofotoului' } : 'nefolosit',
      apa: { srgb: bazaOrto.mare.srgb, estompare_m: [D0, D1], sursa: `harta_v4-${VERSIUNE}.json` },
      gaura: `texelii aflați la mai mult de ${MARJA} m în interiorul lui ${N.interior} au culoarea apei: acolo se vede ${N.interior}`,
    },
    unealta: KTX.versiune,
    surse,
    sursa: surse[0],
  };
  scrieNepublicat(join(IESIRE, `${nume}-${VERSIUNE}.json`), JSON.stringify(sidecar, null, 1));
  console.log(`  ${IESIRE}/${nume}-${VERSIUNE}.ktx2 + .json, gata`);

  // NDVI-ul, pentru harta_v9, harta_v7 și harta_v8.
  if (nume === 'harta_v6') continue;
  const surseOrtoNdvi = { nume: 'Ortofotomapa digital de Portugal Continental 2025, 25 cm', fisiere: daleCadru, producator: 'Direção-Geral do Território (DGT)', licenta: 'CC BY 4.0', atributie: 'Indice de vegetație (NDVI) derivat din Ortofotos © Direção-Geral do Território, ORTOS-2025, CC BY 4.0', portal: 'https://cdd.dgterritorio.gov.pt/' };
  if (dgt) {
    // harta_v9 stă toată în ortofoto: NDVI-ul vine numai de acolo, pe amprenta nodului la
    // nivelul de 1 m — ca harta_v6, care îl ia în blocuri de 4 × 4 (strat-ndvi).
    const coduri = new Uint8Array(hh.w * hh.h);
    let n = 0, lipsa = 0;
    for (let r = 0; r < hh.h; r++) for (let q = 0; q < hh.w; q++) {
      const i = r * hh.w + q;
      if (hh.z[i] <= hh.meta.zMin_m + 0.01) continue;
      const v = ndviOrto(hh.nodX(q), hh.nodY(r), hh.pas);
      if (Number.isNaN(v)) { lipsa++; continue; }
      coduri[i] = codeaza(v); n++;
    }
    proba(lipsa === 0, `${nume}: fiecare nod de uscat are NDVI din ortofoto (${n}; fără: ${lipsa})`);
    const bin = new Uint8Array(Math.ceil((hh.w * hh.h) / 2));
    for (let i = 0; i < hh.w * hh.h; i++) bin[i >> 1] |= coduri[i] << ((i & 1) << 2);
    writeFileSync(join(IESIRE, `${nume}-ndvi.bin`), bin);
    writeFileSync(join(IESIRE, `${nume}-ndvi.json`), JSON.stringify({
      nume: `${nume}-ndvi`, harta: nume,
      descriere: `Indicele de vegetație pe fiecare nod al hărții, din ortofotoul DGT: media benzilor roșu și infraroșu pe amprenta nodului (${hh.pas} × ${hh.pas} pixeli de 1 m, numai cu alfa ≥ 128, cel puțin jumătate), apoi NDVI-ul.`,
      latime: hh.w, inaltime: hh.h,
      codare: { biti: 4, ordine: 'nodul i în octetul i >> 1: jumătatea de jos dacă i e par; rândul 0 = nord', santinela: 0, santinela_inseamna: 'fără NDVI: apă sau gaură', decodare: 'NDVI = niveluri[cod]' },
      niveluri: NIV_NDVI,
      numarate: { din_ortofoto: n },
      surse: [surseOrtoNdvi],
      sursa: surseOrtoNdvi,
    }, null, 1));
    console.log(`  NDVI: ${n} noduri din ortofoto; scris ${IESIRE}/${nume}-ndvi.bin + .json`);
    continue;
  }
  const S = nume === 'harta_v7' ? S20 : S80;
  const coduri = new Uint8Array(hh.w * hh.h), valori = new Float32Array(hh.w * hh.h).fill(NaN), dinOrto = new Uint8Array(hh.w * hh.h);
  const perechi = [];
  const s2ndvi = (x, y) => {
    const m = mediiPeAmprenta(S, ROSU_NIR, x, y, hh.pas, esantioanePe(hh.pas));
    return m ? { v: ndviDin(m.v[0], m.v[1]), bun: m.bun } : null;
  };
  // Uscatul după hărțile dinăuntru: la harta_v8, tot ce acoperă ortofotoul cade în
  // gaura ei, deci perechile de calibrare se iau pe nodurile din gaură, cu uscatul
  // spus de nivelurile care se văd acolo.
  const inauntru = ordine[nume].filter((m) => m !== hh);
  const uscatDinauntru = (x, y) => inauntru.some((m) => { const v = m.inauntru(x, y) ? m.laTM(x, y) : null; return v !== null && v > m.meta.zMin_m + 0.01; });
  for (let r = 0; r < hh.h; r++) {
    for (let q = 0; q < hh.w; q++) {
      const x = hh.nodX(q), y = hh.nodY(r), i = r * hh.w + q;
      const propriu = hh.z[i] > hh.meta.zMin_m + 0.01;
      if (!propriu && !(inOrto(x, y, hh.pas) && uscatDinauntru(x, y))) continue;
      const o = inOrto(x, y, hh.pas) ? ndviOrto(x, y, hh.pas) : NaN;
      const s = s2ndvi(x, y);
      if (!Number.isNaN(o) && s?.bun) perechi.push({ o, s: s.v, bloc: (Math.floor(x / 1024) + Math.floor(y / 1024)) & 1 });
      if (!propriu) continue;   // nod din gaură: numai pentru calibrare
      if (!Number.isNaN(o)) { valori[i] = o; dinOrto[i] = 1; } else if (s) valori[i] = s.v;
    }
    if (r % 32 === 0) process.stdout.write('.');
  }
  console.log('');
  // Calibrarea Sentinel → ortofoto, pe blocurile pare; verificată pe cele impare.
  const antr = perechi.filter((p) => !p.bloc), ver = perechi.filter((p) => p.bloc);
  const mx = antr.reduce((a, p) => a + p.s, 0) / antr.length, my = antr.reduce((a, p) => a + p.o, 0) / antr.length;
  const panta = antr.reduce((a, p) => a + (p.s - mx) * (p.o - my), 0) / antr.reduce((a, p) => a + (p.s - mx) ** 2, 0);
  const tai = my - panta * mx;
  const pred = ver.map((p) => tai + panta * p.s), my2 = ver.reduce((a, p) => a + p.o, 0) / ver.length;
  const r2 = 1 - ver.reduce((a, p, k) => a + (p.o - pred[k]) ** 2, 0) / ver.reduce((a, p) => a + (p.o - my2) ** 2, 0);
  const abat = ver.map((p, k) => Math.abs(p.o - pred[k]));
  console.log(`  NDVI Sentinel → ortofoto: NDVI_orto ≈ ${tai.toFixed(4)} + ${panta.toFixed(4)} · NDVI_S2, pe ${antr.length} noduri; la verificare (${ver.length}): R² ${r2.toFixed(3)}, |abatere| mediană ${cuantila(abat, 0.5).toFixed(3)}`);
  proba(r2 > 0.5, `${nume}: calibrarea NDVI explică peste jumătate din variație pe nodurile ținute deoparte (R² ${r2.toFixed(3)})`);
  let nOrto = 0, nS2 = 0;
  for (let i = 0; i < hh.w * hh.h; i++) {
    if (Number.isNaN(valori[i])) continue;
    const v = dinOrto[i] ? valori[i] : tai + panta * valori[i];
    coduri[i] = codeaza(v);
    if (dinOrto[i]) nOrto++; else nS2++;
  }
  const bin = new Uint8Array(Math.ceil((hh.w * hh.h) / 2));
  for (let i = 0; i < hh.w * hh.h; i++) bin[i >> 1] |= coduri[i] << ((i & 1) << 2);
  writeFileSync(join(IESIRE, `${nume}-ndvi.bin`), bin);
  writeFileSync(join(IESIRE, `${nume}-ndvi.json`), JSON.stringify({
    nume: `${nume}-ndvi`, harta: nume,
    descriere: 'Indicele de vegetație pe fiecare nod al hărții: din ortofotoul DGT unde acoperă, altfel din Sentinel-2, calibrat pe ortofoto.',
    latime: hh.w, inaltime: hh.h,
    codare: { biti: 4, ordine: 'nodul i în octetul i >> 1: jumătatea de jos dacă i e par; rândul 0 = nord', santinela: 0, santinela_inseamna: 'fără NDVI: apă, gaură sau fără date', decodare: 'NDVI = niveluri[cod]' },
    niveluri: NIV_NDVI,
    numarate: { din_ortofoto: nOrto, din_sentinel: nS2 },
    calibrare_sentinel: { formula: 'NDVI_orto ≈ a + b · NDVI_S2', a: +tai.toFixed(4), b: +panta.toFixed(4), antrenare: antr.length, verificare: ver.length, r2_verificare: +r2.toFixed(3), abatere_mediana: +cuantila(abat, 0.5).toFixed(3) },
    // La harta_v8 ortofotoul n-are noduri, dar perechile de calibrare vin din el.
    surse: [surseOrtoNdvi, { ...SURSA_SENTINEL, scena: manifest.sentinel.scena }],
    sursa: { ...SURSA_SENTINEL, scena: manifest.sentinel.scena },
  }, null, 1));
  console.log(`  NDVI: ${nOrto} noduri din ortofoto, ${nS2} din Sentinel; scris ${IESIRE}/${nume}-ndvi.bin + .json`);
}

console.log(picate ? `\n${picate} probe picate` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
