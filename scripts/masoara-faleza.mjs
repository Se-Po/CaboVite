// Falezele în vederea Satelit: de la ce pantă fotografia verticală nu mai spune
// nimic și cu ce lumină s-ar colora acolo stânca.
//
//   npm run masoara-faleza
//
// Ortofotoul privește drept în jos: un perete de 70° are, pe 1 m de hartă, 2,9 m de
// stâncă, iar fotografia îl vede întins, în dungi. Varianta măsurată aici: peste un
// prag, vederea Satelit ar lua culoarea din regula de albedo (`culoareTeren`, ca
// vederea Relief), luminată cu soarele FOTOGRAFIEI, ca trecerea să nu se vadă —
// respinsă, vezi mai jos:
//
//   stâncă = albedo · (α · max(0, n · s_zbor) + β)
//
// Totul se măsoară aici, pe plasa construită cu codul paginii:
// - α și β, pe stânca de 30°–70° fără vegetație — acolo unde s-ar folosi —, prin
//   cele mai mici pătrate, cu jumătate din fațete ținute deoparte pentru control;
// - pragurile: cât „detaliu” are fotografia pe metrul de SUPRAFAȚĂ, pe clase de
//   pantă — gradientul luminanței pe metrul orizontal, înmulțit cu cos θ. Pragul de
//   sus e panta la care cade sub 50% din cel de pe terenul plat; amestecul ar
//   începe cu 15° mai jos.
//
// Scrie date-sursa/derivate/faleza.json.
//
// Rezultatul NU se folosește în pagină. Stânca pictată după prag ieșea uniformă și
// ternă, iar fotografia întinsă arată, pe calcar, ca stratele adevărate; autorul a
// ales fotografia (2026-09-30, comparația în CLAUDE.md). Scriptul rămâne ca
// măsurătoare: pragul la care fotografia își pierde detaliul și lumina ei pe stâncă.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { deschideOrtofoto, fereastra } from './comun/ortofoto.mjs';
import { linear } from './comun/oklab.mjs';
import { laOklab } from './comun/oklab.mjs';
import { cereFisier } from './comun/cere.mjs';
import { incarcaRelief, straturiNdvi } from '../src/scene/loaders.js';
import { creeazaTeren, mascaBazei } from '../src/scene/terrain.js';
import { culoareTeren, incarcaPaleta, paletaCurenta, SPRE_LINIAR } from '../src/scene/palette.js';

const ORTO = 'date-sursa/ortofoto/ortos2025_cog_25cm_rgbi_jpg_464-3_v02.tif';
const ZBOR = 'date-sursa/derivate/zbor.json';
const IESIRE = 'date-sursa/derivate/faleza.json';
cereFisier(ORTO, 'dala de ortofoto', 'Vezi „Ortofotoul” în CLAUDE.md.');
cereFisier(ZBOR, 'măsurătorile zborului', 'Rulează întâi: npm run masoara-zbor');
const zbor = JSON.parse(readFileSync(ZBOR, 'utf8'));

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };

// ------------------------------------------------------------ plasa, cu codul paginii
const INDEX = readFileSync('index.html');
globalThis.fetch = async (url) => (existsSync('public' + url) ? new Response(readFileSync('public' + url)) : new Response(INDEX));
await incarcaPaleta();
const inc = await incarcaRelief();
const relief = inc.baza ?? inc, reliefPetic = inc.baza ? inc : null;
const { pastreaza } = mascaBazei(relief, reliefPetic);
const ndvi = straturiNdvi(relief, reliefPetic);
const fatete = [];   // [hex, ndvi]
const teren = creeazaTeren(relief, { pastreaza, paleta: paletaCurenta(), ndvi: ndvi.baza,
  culoare: (panta, alt, p, n) => { const c = culoareTeren(panta, alt, p, n); fatete.push([c, n]); return c; } });
const poz = teren.obiect.geometry.attributes.position.array;
const b = relief.meta.bbox_tm06, centru = { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 };
console.log(`${relief.meta.nume}: ${fatete.length} fațete`);

// ------------------------------------------------------------ fotografia, la 1 m
const o = deschideOrtofoto(ORTO, 1);
const c0 = Math.round(b.xMin - o.x0), r0 = Math.round(o.y0 - b.yMax), W = Math.round(b.xMax - b.xMin), H = Math.round(b.yMax - b.yMin);
const [bR, bG, bB] = [0, 1, 2].map((k) => fereastra(o, k, c0, r0, W, H));
const LIN = Float32Array.from({ length: 256 }, (_, v) => linear(v / 255));
const Yf = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) Yf[i] = 0.2126 * LIN[bR[i]] + 0.7152 * LIN[bG[i]] + 0.0722 * LIN[bB[i]];
const la = (x, y) => { const c = Math.floor(x - b.xMin), r = Math.floor(b.yMax - y); return c < 1 || r < 1 || c >= W - 1 || r >= H - 1 ? -1 : r * W + c; };

// ------------------------------------------------------------ fiecare fațetă
const R = Math.PI / 180, s = zbor.soare_zbor;
const soare = [Math.sin(s.azimut_grila * R) * Math.cos(s.elevatie * R), Math.sin(s.elevatie * R), -Math.cos(s.azimut_grila * R) * Math.cos(s.elevatie * R)];
const date = [];
for (let f = 0; f < fatete.length; f++) {
  const k = f * 9;
  const ax = poz[k], ay = poz[k + 1], az = poz[k + 2], bx = poz[k + 3], by = poz[k + 4], bz = poz[k + 5], cx = poz[k + 6], cy = poz[k + 7], cz = poz[k + 8];
  if (ay < 0.5 || by < 0.5 || cy < 0.5) continue;                // malul și apa
  const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const x = (ax + bx + cx) / 3 + centru.x, y = centru.y - (az + bz + cz) / 3;
  const i = la(x, y); if (i < 0) continue;
  const [hex, nd] = fatete[f];
  const alb = [SPRE_LINIAR[(hex >> 16) & 255], SPRE_LINIAR[(hex >> 8) & 255], SPRE_LINIAR[hex & 255]];
  const foto = [LIN[bR[i]], LIN[bG[i]], LIN[bB[i]]];
  const grad = Math.hypot(Yf[i + 1] - Yf[i - 1], Yf[i + W] - Yf[i - W]) / 2;   // pe metru orizontal
  date.push({ panta: Math.acos(Math.min(1, ny)) / R, ns: Math.max(0, nx * soare[0] + ny * soare[1] + nz * soare[2]), alb, foto, grad, nd, f });
}
console.log(`${date.length} fațete de uscat cu fotografie`);

// ------------------------------------------------------------ α și β
const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const potrivire = (set) => {
  // Y_foto = Y_alb·ns·α + Y_alb·β, cele mai mici pătrate pe (α, β)
  let s11 = 0, s12 = 0, s22 = 0, t1 = 0, t2 = 0;
  for (const d of set) { const a1 = Y(d.alb) * d.ns, a2 = Y(d.alb), yv = Y(d.foto); s11 += a1 * a1; s12 += a1 * a2; s22 += a2 * a2; t1 += a1 * yv; t2 += a2 * yv; }
  const det = s11 * s22 - s12 * s12;
  return { alfa: (t1 * s22 - t2 * s12) / det, beta: (s11 * t2 - s12 * t1) / det };
};
const r2 = (set, p) => { let sr = 0, st = 0, m = 0; for (const d of set) m += Y(d.foto); m /= set.length;
  for (const d of set) { const pr = Y(d.alb) * (p.alfa * d.ns + p.beta); sr += (Y(d.foto) - pr) ** 2; st += (Y(d.foto) - m) ** 2; } return 1 - sr / st; };
// Lumina se potrivește acolo unde s-ar folosi: pe pantele abrupte, 30°–70°, fără
// vegetație. Pe terenul plat n·s abia variază, deci direcția soarelui n-ar conta
// și n-ar avea cum să fie verificată — acolo R² ieșea 0,18, iar soarele Relief
// potrivea la fel de bine ca al zborului.
const stanca = date.filter((d) => d.panta >= 30 && d.panta < 70 && d.nd !== undefined && d.nd < 0.15);
const antr = stanca.filter((d) => d.f % 2 === 0), ctrl = stanca.filter((d) => d.f % 2 === 1);
const p = potrivire(antr);
const r2a = r2(antr, p), r2c = r2(ctrl, p);
console.log(`\nα = ${p.alfa.toFixed(4)}, β = ${p.beta.toFixed(4)} pe ${antr.length} fațete de stâncă de 30°–70°; R² ${r2a.toFixed(3)} la antrenare, ${r2c.toFixed(3)} pe cele ținute deoparte (${ctrl.length})`);
proba(p.alfa > 0 && p.beta > 0, 'α și β pozitive');
proba(Math.abs(r2a - r2c) < 0.05, `R² ținut deoparte la sub 0,05 de cel de antrenare (${r2c.toFixed(3)} / ${r2a.toFixed(3)})`);

// ------------------------------------------------------------ pragurile
const clase = [];
for (let a = 0; a < 90; a += 5) {
  const v = date.filter((d) => d.panta >= a && d.panta < a + 5).map((d) => d.grad * Math.cos((d.panta + 2.5) * R));
  if (v.length < 200) continue;
  v.sort((x, y) => x - y);
  clase.push({ de_la: a, n: v.length, detaliu: v[v.length >> 1] });
}
const plat = clase.filter((c) => c.de_la < 10).reduce((s0, c) => s0 + c.detaliu * c.n, 0) / clase.filter((c) => c.de_la < 10).reduce((s0, c) => s0 + c.n, 0);
console.log('\npanta   fațete   detaliu pe metrul de suprafață, față de terenul plat');
for (const c of clase) console.log(`${String(c.de_la).padStart(3)}–${String(c.de_la + 5).padEnd(3)} ${String(c.n).padStart(8)}   ${(c.detaliu / plat).toFixed(3)}`);
const sub = clase.find((c) => c.de_la >= 20 && c.detaliu / plat < 0.5);
if (!sub) throw new Error('detaliul nu scade sub 50% pe nicio clasă de pantă; pragul nu se poate măsura');
// interpolare liniară între clasa de dinainte și prima sub 50%
const ant = clase[clase.indexOf(sub) - 1];
const t = (ant.detaliu / plat - 0.5) / (ant.detaliu / plat - sub.detaliu / plat);
const panta1 = +(ant.de_la + 2.5 + t * 5).toFixed(1), panta0 = +(panta1 - 15).toFixed(1);
console.log(`\ndetaliul cade sub 50% la ${panta1}°; amestecul spre stâncă: ${panta0}° → ${panta1}°`);

// ------------------------------------------------------------ controlul culorii la prag
const lab = (c) => laOklab(...c.map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))));
const dE = (a, c) => 100 * Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
const med = (v) => { const q = Float64Array.from(v).sort(); return q[q.length >> 1]; };
// Fațetele ținute deoparte din zona în care s-ar folosi stânca.
const langa = ctrl.filter((d) => d.panta >= panta0);
const model = (d, pp, ns) => d.alb.map((v) => v * (pp.alfa * ns + pp.beta));
const dSoare = med(langa.map((d) => dE(lab(model(d, p, d.ns)), lab(d.foto))));
// Control: aceeași stâncă, luminată cu soarele Relief (244° / 18°), cu α, β potrivite pe el.
const RR = [Math.sin(244 * R) * Math.cos(18 * R), Math.sin(18 * R), -Math.cos(244 * R) * Math.cos(18 * R)];
const nsR = (d) => {
  // n din ns nu se poate reface; se refac din fațetă
  const k = d.f * 9;
  const ux = poz[k + 3] - poz[k], uy = poz[k + 4] - poz[k + 1], uz = poz[k + 5] - poz[k + 2], vx = poz[k + 6] - poz[k], vy = poz[k + 7] - poz[k + 1], vz = poz[k + 8] - poz[k + 2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return Math.max(0, nx * RR[0] + ny * RR[1] + nz * RR[2]);
};
const antrR = antr.map((d) => ({ ...d, ns: nsR(d) }));
const pR = potrivire(antrR);
const dRelief = med(langa.map((d) => dE(lab(model(d, pR, nsR(d))), lab(d.foto))));
console.log(`\npe stânca de peste ${panta0}° (${langa.length} fațete ținute deoparte): ΔE median stâncă−fotografie ${dSoare.toFixed(2)} cu soarele zborului, ${dRelief.toFixed(2)} cu soarele Relief`);
proba(dSoare < dRelief, 'soarele zborului potrivește stânca cu fotografia mai bine decât soarele Relief (control)');
const falezaSat = date.filter((d) => d.panta >= panta1).length;
console.log(`fațete de uscat peste ${panta1}°: ${falezaSat} din ${date.length} (${(100 * falezaSat / date.length).toFixed(1)}%)`);

writeFileSync(IESIRE, JSON.stringify({
  generat: new Date().toISOString(),
  harta: relief.meta.nume,
  soare_zbor: s,
  lumina: { alfa: +p.alfa.toFixed(4), beta: +p.beta.toFixed(4), r2_antrenare: +r2a.toFixed(3), r2_control: +r2c.toFixed(3), fatete: antr.length },
  prag_grade: [panta0, panta1],
  detaliu_pe_clase: clase.map((c) => ({ de_la: c.de_la, fatete: c.n, fata_de_plat: +(c.detaliu / plat).toFixed(3) })),
  control: { dE_soare_zbor: +dSoare.toFixed(2), dE_soare_relief: +dRelief.toFixed(2), fatete: langa.length },
}, null, 2));
teren.dispose();
console.log(`\nscris ${IESIRE}`);
console.log(picate ? `${picate} probe picate` : 'toate probele au trecut');
process.exit(picate ? 1 : 0);
