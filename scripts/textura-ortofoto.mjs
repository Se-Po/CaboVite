// Texturile vederii Satelit: ortofotoul DGT pe cutia bazei, la 1 m, și pe peticul
// de la sanctuar, la 0,25 m.
//
//   npm run textura-ortofoto [-- harta_v5]
//
// Scrie public/data/<bază>-orto_v1.ktx2 + .json și <petic>-orto_v1.ktx2 + .json.
// Textura are versiune proprie: un retuș, alte setări de compresie înseamnă _v2,
// fără ca harta să se schimbe.
//
// Geometria. Marginile de pixel ale texturii sunt metri TM06 scriși în sidecar
// (`conventie: muchii de pixel`); pagina calculează din ei coordonatele texturii,
// în shader, din poziția fiecărui vârf. Colțurile de nord-vest cad pe metri întregi
// (baza −95792 / −136402, peticul −94823 / −137295), deci al treilea nivel al
// peticului (1 m) cade texel pe texel peste bază. Dimensiunile sunt multipli de 64,
// ca toate cele 5 niveluri să fie multipli de 4 — blocurile KTX2 au 4 × 4.
//
// Culoarea. Se citește ortofotoul la 0,25 m, mutat cu deplasarea măsurată pe sol
// (date-sursa/derivate/zbor.json), iar orice medie — bază, mipuri — se face în
// lumină LINIARĂ, cum reflectă suprafața; o medie a octeților sRGB ar întuneca
// trecerile dintre lumină și umbră.
//
// Marea. Planul mării are în afara texturii o singură culoare: apa adâncă,
// măsurată pe ortofoto. Ca textura să se topească în el fără margine, pe mare
// fotografia se amestecă, cu distanța de la mal, în culoarea aceea, iar pixelii
// fără date (colțurile de vest) o primesc direct. Amestecul e copt în RGB, nu ținut
// într-un canal alfa: mipurile ar media altfel culoarea și ponderea separat.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { deschideOrtofoto, fereastra } from './comun/ortofoto.mjs';
import { incarcaHarta } from './comun/relief.mjs';
import { laOklab } from './comun/oklab.mjs';
import { cereFisier } from './comun/cere.mjs';
import {
  KTX, LIN, LUCRU, NIVELURI_MIP as NIVELURI, codeazaKtx, dE, distanta, injumatateste, laOctet, multiplu, octeti, pierdere, scriePngNiveluri,
} from './comun/textura.mjs';

const VERSIUNE = 'orto_v1';
const ORTO = 'date-sursa/ortofoto/ortos2025_cog_25cm_rgbi_jpg_464-3_v02.tif';
const ZBOR = 'date-sursa/derivate/zbor.json';
const IESIRE = 'public/data';
const MARGINE_M = 4;          // în jurul cutiei hărții, ca filtrarea să nu citească dincolo de ea
const PRAG_MB = 8;            // peste atât, pe fișier, scriptul se oprește și spune (autorul a acceptat +4–7 MB)

cereFisier(ORTO, 'dala de ortofoto ORTOS-2025 464-3', 'Vezi „Ortofotoul” în CLAUDE.md.');
cereFisier(ZBOR, 'măsurătorile zborului', 'Rulează întâi: npm run masoara-zbor');
const zbor = JSON.parse(readFileSync(ZBOR, 'utf8'));
const o = deschideOrtofoto(ORTO, 0.25);

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };

// Deplasarea: fotografia stă pe sol cu (dx, dy) față de LiDAR; se citește deci
// mutată cu atât, în pixeli întregi de 0,25 m.
const dxPx = Math.round(zbor.deplasare_sol.dx_m / o.pas), dyPx = Math.round(zbor.deplasare_sol.dy_m / o.pas);
if (Math.abs(dxPx * o.pas - zbor.deplasare_sol.dx_m) > 1e-9 || Math.abs(dyPx * o.pas - zbor.deplasare_sol.dy_m) > 1e-9)
  throw new Error(`deplasarea (${zbor.deplasare_sol.dx_m}; ${zbor.deplasare_sol.dy_m}) m nu e un număr întreg de pixeli de ${o.pas} m`);

/** Cadrul texturii unei hărți: colțul NV, pasul și dimensiunile, multipli de 64. */
function cadru(harta, pas) {
  const b = harta.meta.bbox_tm06;
  const x0 = Math.floor(b.xMin) - MARGINE_M, y1 = Math.ceil(b.yMax) + MARGINE_M;
  const W = multiplu((Math.ceil(b.xMax) + MARGINE_M - x0) / pas, 64);
  const H = multiplu((y1 - (Math.floor(b.yMin) - MARGINE_M)) / pas, 64);
  return { x0, y1, pas, W, H, x1: x0 + W * pas, y0: y1 - H * pas };
}

/**
 * Nivelul 0 al unui cadru, în lumină liniară (Float32, 3 canale), plus masca de
 * date (alfa-ul ortofotoului ≥ 128). Citit pe benzi de rânduri, ca memoria să
 * rămână mică: o bandă de fereastră de 0,25 m pe toată lățimea bazei are 9 472 de
 * pixeli, iar baza ar avea 12 032 de rânduri.
 */
function citesteNivel0(c) {
  const bloc = Math.round(c.pas / o.pas);
  const lin = new Float32Array(c.W * c.H * 3), date = new Uint8Array(c.W * c.H);
  const c0 = Math.round((c.x0 - o.x0) / o.pas) + dxPx, r0 = Math.round((o.y0 - c.y1) / o.pas) - dyPx;
  const RB = Math.max(1, Math.floor(512 / bloc));
  for (let rb = 0; rb < c.H; rb += RB) {
    const nr = Math.min(RB, c.H - rb);
    const benzi = [0, 1, 2, 4].map((k) => fereastra(o, k, c0, r0 + rb * bloc, c.W * bloc, nr * bloc));
    const L = c.W * bloc, n = bloc * bloc;
    // Pe marginea datelor, în colțul de nord-vest, un texel de 1 m are uneori doar o
    // parte din cei 16 pixeli de 0,25 m: atunci media se face numai pe cei cu date
    // (alfa ≥ 128). Înăuntru banda alfa are și pixeli izolați sub 128 — artefacte
    // JPEG, nu goluri —, deci cu cel puțin jumătate din pixeli valizi media e pe toți,
    // exact ca în lanțul de mipuri al peticului.
    for (let r = 0; r < nr; r++) for (let q = 0; q < c.W; q++) {
      let s0 = 0, s1 = 0, s2 = 0, a = 0, t0 = 0, t1 = 0, t2 = 0;
      for (let y = 0; y < bloc; y++) for (let x = 0; x < bloc; x++) {
        const k = (r * bloc + y) * L + q * bloc + x;
        t0 += LIN[benzi[0][k]]; t1 += LIN[benzi[1][k]]; t2 += LIN[benzi[2][k]];
        if (benzi[3][k] < 128) continue;
        s0 += LIN[benzi[0][k]]; s1 += LIN[benzi[1][k]]; s2 += LIN[benzi[2][k]];
        a++;
      }
      const i = (rb + r) * c.W + q;
      if (a && a * 2 < n) { lin[i * 3] = s0 / a; lin[i * 3 + 1] = s1 / a; lin[i * 3 + 2] = s2 / a; }
      else { lin[i * 3] = t0 / n; lin[i * 3 + 1] = t1 / n; lin[i * 3 + 2] = t2 / n; }
      date[i] = a ? 1 : 0;
    }
    process.stdout.write('.');
  }
  console.log('');
  return { lin, date };
}

/** Masca de uscat a bazei, pe texelii cadrului (nodul cel mai apropiat al hărții). */
function uscatPeTexeli(harta, c) {
  const m = new Uint8Array(c.W * c.H);
  const zApa = harta.meta.zMin_m + 0.01;
  const jum = harta.conventie === 'noduri' ? 0 : harta.pas / 2, b = harta.bbox;
  for (let r = 0; r < c.H; r++) for (let q = 0; q < c.W; q++) {
    const x = c.x0 + (q + 0.5) * c.pas, y = c.y1 - (r + 0.5) * c.pas;
    const cc = Math.round((x - b.xMin - jum) / harta.pas), rr = Math.round((b.yMax - jum - y) / harta.pas);
    if (cc < 0 || rr < 0 || cc >= harta.w || rr >= harta.h) continue;
    if (harta.z[rr * harta.w + cc] > zApa) m[r * c.W + q] = 1;
  }
  return m;
}

const mediana = (v) => { const s = Float64Array.from(v).sort(); return s[Math.floor(s.length / 2)]; };

/**
 * Marea adâncă și distanța de la mal până la care fotografia mai aduce ceva.
 * Culoarea mării se măsoară în OKLab pe benzi de 25 m de la mal; apa adâncă e
 * mediana benzilor de 600–1000 m. `d1` e prima bandă de la care toate cele mai
 * îndepărtate stau la sub ΔE 2 de ea; amestecul începe la d1 / 2.
 */
function masoaraMarea(lin, date, uscat, D, c) {
  const benzi = new Map();
  for (let i = 0; i < c.W * c.H; i++) {
    if (uscat[i] || !date[i]) continue;
    const dm = D[i] * c.pas; if (dm > 1000) continue;
    const k = Math.floor(dm / 25);
    if (!benzi.has(k)) benzi.set(k, [[], [], []]);
    const lab = laOklab(...[0, 1, 2].map((j) => laOctet(lin[i * 3 + j])));
    benzi.get(k).forEach((arr, j) => arr.push(lab[j]));
  }
  const med = (k) => benzi.get(k).map(mediana);
  const adanc = [0, 1, 2].map((j) => mediana([...benzi.keys()].filter((k) => k >= 24).flatMap((k) => benzi.get(k)[j])));
  const chei = [...benzi.keys()].sort((a, b) => a - b);
  let d1 = 1000;
  for (let t = chei.length - 1; t >= 0; t--) { if (dE(med(chei[t]), adanc) >= 2) { d1 = (chei[t] + 1) * 25; break; } }
  // înapoi în sRGB, prin liniar
  const deep = (() => {
    const [L, A, B] = adanc;
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  })();
  return { deepLin: deep, deepOctet: deep.map(laOctet), d1, d0: d1 / 2, benzi: chei.map((k) => ({ de_la_m: k * 25, dE_fata_de_adanc: +dE(med(k), adanc).toFixed(2) })) };
}

// ------------------------------------------------------------ main

const petic = incarcaHarta(process.argv[2] || 'harta_v5');
if (!petic.meta.baza) throw new Error(`${petic.nume} nu e un petic; cer peticul, care își aduce baza`);
const baza = incarcaHarta(petic.meta.baza);
const cB = cadru(baza, 1), cP = cadru(petic, 0.25);
console.log(`${baza.nume}: ${cB.W} × ${cB.H} la ${cB.pas} m, colțul NV (${cB.x0}; ${cB.y1})`);
console.log(`${petic.nume}: ${cP.W} × ${cP.H} la ${cP.pas} m, colțul NV (${cP.x0}; ${cP.y1})`);
proba(Number.isInteger(cP.x0 - cB.x0) && Number.isInteger(cB.y1 - cP.y1), `colțurile cad pe metri întregi unul față de altul (${cP.x0 - cB.x0}; ${cB.y1 - cP.y1}) m: nivelul de 1 m al peticului stă texel pe texel peste bază`);
for (const c of [cB, cP]) proba([...Array(NIVELURI).keys()].every((k) => (c.W >> k) % 4 === 0 && (c.H >> k) % 4 === 0), `toate cele ${NIVELURI} niveluri de ${c.W} × ${c.H} sunt multipli de 4`);

console.log(`\ncitesc ortofotoul la ${o.pas} m, mutat cu (${dxPx}; ${-dyPx}) pixeli`);
const nB = citesteNivel0(cB);
const nP = citesteNivel0(cP);

// Acoperirea: orice texel de uscat trebuie să aibă date.
const uscat = uscatPeTexeli(baza, cB);
let uscatTot = 0, uscatDate = 0;
for (let i = 0; i < cB.W * cB.H; i++) if (uscat[i]) { uscatTot++; if (nB.date[i]) uscatDate++; }
proba(uscatDate === uscatTot, `uscatul bazei are date peste tot: ${uscatDate} / ${uscatTot} texeli`);
{
  // Controlul: aceeași numărătoare, pe o fereastră mutată în colțul de vest fără date.
  let n = 0, cu = 0;
  const q0 = 0, q1 = 200;
  for (let r = 0; r < cB.H; r++) for (let q = q0; q < q1; q++) { const i = r * cB.W + q; n++; if (nB.date[i]) cu++; }
  proba(cu < n, `control: fâșia de vest a cutiei are texeli fără date (${n - cu} din ${n})`);
}

// Marea
const D = distanta(uscat, cB.W, cB.H);
const mare = masoaraMarea(nB.lin, nB.date, uscat, D, cB);
console.log(`\nmarea adâncă: sRGB ${mare.deepOctet.join(', ')}; fotografia se estompează între ${mare.d0} și ${mare.d1} m de la mal`);
const neted = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
for (let i = 0; i < cB.W * cB.H; i++) {
  if (uscat[i]) continue;
  const q = i % cB.W, r = (i / cB.W) | 0;
  const laMargine = Math.min(q, r, cB.W - 1 - q, cB.H - 1 - r) * cB.pas;
  let a = nB.date[i] ? 1 - neted(mare.d0, mare.d1, D[i] * cB.pas) : 0;
  a *= neted(0, 16, laMargine);
  for (let k = 0; k < 3; k++) nB.lin[i * 3 + k] = mare.deepLin[k] + (nB.lin[i * 3 + k] - mare.deepLin[k]) * a;
}

// Mipurile, în liniar
const lanț = (n0, c) => {
  const lin = [n0];
  for (let k = 1; k < NIVELURI; k++) lin.push(injumatateste(lin[k - 1], c.W >> (k - 1), c.H >> (k - 1)));
  return lin;
};
const linB = lanț(nB.lin, cB), linP = lanț(nP.lin, cP);

// Nivelul de 1 m al peticului față de bază, pe suprapunere: aceeași medie 4 × 4 în
// liniar, din aceiași pixeli — deci aceiași octeți.
{
  const nivel = 2, wP = cP.W >> nivel, hP = cP.H >> nivel;
  const oq = cP.x0 - cB.x0, or = cB.y1 - cP.y1;
  const cmp = (dq) => {
    let dif = 0, n = 0;
    for (let r = 0; r < hP; r++) for (let q = 0; q < wP; q++) {
      const ib = (r + or) * cB.W + q + oq + dq, ip = r * wP + q;
      if (uscat[(r + or) * cB.W + q + oq] !== 1) continue;
      n++;
      for (let k = 0; k < 3; k++) if (laOctet(linB[0][ib * 3 + k]) !== laOctet(linP[nivel][ip * 3 + k])) { dif++; break; }
    }
    return { dif, n };
  };
  const a = cmp(0), b = cmp(1);
  proba(a.dif === 0, `nivelul de 1 m al peticului e identic cu baza pe ${a.n} texeli de uscat (${a.dif} diferiți)`);
  proba(b.dif > a.n / 4, `control: mutat cu 1 m, ${b.dif} din ${b.n} texeli diferă`);
}

// Scrierea
const rezultat = {};
for (const [h, c, lin] of [[baza, cB, linB], [petic, cP, linP]]) {
  const niveluri = lin.map((l, k) => ({ W: c.W >> k, H: c.H >> k, b: octeti(l) }));
  const pnguri = scriePngNiveluri(`${h.nume}-${VERSIUNE}`, niveluri);
  console.log(`\n${h.nume}: ${NIVELURI} niveluri PNG în ${join(LUCRU, `${h.nume}-${VERSIUNE}`)}`);
  rezultat[h.nume] = { c, niveluri, pnguri };
}

// De aici încolo trebuie `ktx`.
const referinte = [
  { nume: 'terreiro', x: -94470, y: -137990, latura_m: 10 },
  { nume: 'platoul de lângă far', x: -94700, y: -138560, latura_m: 10 },
  { nume: 'versantul de nord', x: -94300, y: -137100, latura_m: 10 },
];
for (const [numeH, R] of Object.entries(rezultat)) {
  const iesire = join(IESIRE, `${numeH}-${VERSIUNE}.ktx2`);
  const variante = {};
  for (const codare of ['uastc', 'etc1s']) {
    const f = join(LUCRU, `${numeH}-${VERSIUNE}`, `${codare}.ktx2`);
    const b = codeazaKtx(R.pnguri, f, codare);
    const p = pierdere(f, R.niveluri[0].b, R.c.W, R.c.H);
    variante[codare] = { octeti: b.length, fisier: f, pierdere_dE: p };
    console.log(`  ${numeH}, ${codare}: ${(b.length / 1048576).toFixed(2)} MB; după decodare ΔE medie ${p.medie}, p99 ${p.p99}, max ${p.max}`);
  }
  // Se alege UASTC: fotografia aeriană are detaliu fin; ETC1S e mai mic, dar
  // pierde mai mult — cifrele de deasupra, pe același nivel decodat.
  const ales = readFileSync(variante.uastc.fisier);
  proba(variante.uastc.pierdere_dE.medie < variante.etc1s.pierdere_dE.medie, `${numeH}: UASTC pierde mai puțin decât ETC1S (${variante.uastc.pierdere_dE.medie} față de ${variante.etc1s.pierdere_dE.medie})`);
  if (ales.length > PRAG_MB * 1048576)
    throw new Error(`${numeH}: ${(ales.length / 1048576).toFixed(2)} MB peste pragul de ${PRAG_MB} MB — oprește-te și spune autorului`);
  writeFileSync(iesire, ales);
  const c = R.c;
  const refs = referinte.map((q) => {
    const q0 = Math.round((q.x - q.latura_m / 2 - c.x0) / c.pas), r0 = Math.round((c.y1 - (q.y + q.latura_m / 2)) / c.pas), n = Math.round(q.latura_m / c.pas);
    if (q0 < 0 || r0 < 0 || q0 + n > c.W || r0 + n > c.H) return null;
    const s = [0, 0, 0];
    for (let r = r0; r < r0 + n; r++) for (let x = q0; x < q0 + n; x++) for (let k = 0; k < 3; k++) s[k] += LIN[R.niveluri[0].b[(r * c.W + x) * 3 + k]];
    return { ...q, srgb: s.map((v) => laOctet(v / (n * n))) };
  }).filter(Boolean);
  const meta = {
    nume: `${numeH}-${VERSIUNE}`,
    harta: numeH,
    versiune: VERSIUNE,
    format: 'KTX2, UASTC cu RDO și zstd, R8G8B8_SRGB, 5 niveluri de mip',
    conventie: 'muchii de pixel: texelul (q, r) acoperă [x0 + q·pas, x0 + (q + 1)·pas] × [y1 − (r + 1)·pas, y1 − r·pas]; rândul 0 e nordul',
    bbox_tm06: { xMin: c.x0, xMax: c.x1, yMin: c.y0, yMax: c.y1 },
    pas_m: c.pas, latime: c.W, inaltime: c.H, niveluri: NIVELURI,
    octeti: ales.length,
    sha256: createHash('sha256').update(ales).digest('hex'),
    deplasare_aplicata_m: { dx: dxPx * o.pas, dy: -dyPx * o.pas, sursa: 'deplasarea pe sol din masoara-zbor' },
    soare_zbor: zbor.soare_zbor,
    ...(numeH === baza.nume ? { mare: { srgb: mare.deepOctet, estompare_m: [mare.d0, mare.d1], benzi: mare.benzi } } : {}),
    unealta: KTX.versiune,
    variante: Object.fromEntries(Object.entries(variante).map(([k, v]) => [k, { octeti: v.octeti, pierdere_dE: v.pierdere_dE }])),
    referinte_pagina: refs,
    sursa: {
      nume: 'Ortofotomapa digital de Portugal Continental 2025, 25 cm',
      fisier: ORTO.split('/').pop(),
      producator: 'Direção-Geral do Território (DGT)',
      licenta: 'CC BY 4.0',
      atributie: 'Ortofotos: © Direção-Geral do Território, ORTOS-2025, CC BY 4.0',
      portal: 'https://cdd.dgterritorio.gov.pt/',
    },
  };
  writeFileSync(join(IESIRE, `${numeH}-${VERSIUNE}.json`), JSON.stringify(meta, null, 1));
  console.log(`  scris ${iesire} (${(ales.length / 1048576).toFixed(2)} MB) + .json`);
}
console.log(picate ? `\n${picate} probe picate` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
