// Înălțimea construcțiilor deasupra terenului, la 50 cm: nMDS = MDS − MDT.
//
//   npm run nmds-sanctuar
//
// MDT-ul DGT e terenul fără clădiri — punctele de sol, cu golurile de sub clădiri
// interpolate plan. MDS-ul e suprafața de sus: acoperișuri, ziduri, vegetație. Din
// același zbor, pe aceeași grilă de 50 cm, deci diferența lor e înălțimea a tot ce
// stă pe sol. De aici vin înălțimile sanctuarului: nicio altă sursă nu le dă.
//
// Ce face:
//   1. probele de sosire pe dalele descărcate — oprește la prima picată;
//   2. mozaicul MDS, MDT și NDVI pe fereastra complexului;
//   3. probele pe date: același datum, aceeași grilă, fără deplasare;
//   4. straturile PNG în date-sursa/derivate/ — umbrire, nMDS, ortofoto, golurile
//      TIN, suprapunerea cu OSM —, ca ochiul să poată verifica ce spun cifrele;
//   5. candidații: ce stă deasupra solului și nu e în OSM.
//
// Scrie numai în date-sursa/derivate/, care e regenerabil: acolo se poate suprascrie.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cereFisier } from './comun/cere.mjs';
import { PRAG_NDVI, deschideOrtofoto, fereastraMedie, fereastra, ndvi } from './comun/ortofoto.mjs';
import { scriePng } from './comun/png.mjs';
import { citesteTiffDGT } from './comun/tiff.mjs';
import { laTM06 } from './comun/tm06.mjs';

const DIR = 'date-sursa/lidar-50cm';
const DERIVATE = 'date-sursa/derivate';
const ORTOFOTO = 'date-sursa/ortofoto/ortos2025_cog_25cm_rgbi_jpg_464-3_v02.tif';
const PAS = 0.5;
// Complexul cu esplanada și Ermida la vest, parcarea la sud, apeductul spre est
// până iese din contur. Colțurile pe grila de 50 cm, deci pixelii cad exact pe
// ai dalelor și, la 0,25 m, pe ai ortofotoului.
const F = { x0: -94690, x1: -93700, y0: -138130, y1: -137895 };
const W = (F.x1 - F.x0) / PAS, H = (F.y1 - F.y0) / PAS;
// Mărimile din catalogul DGT (STAC), acolo unde le știm dinainte.
const MARIMI = { 'MDS-50cm-105162-06-2024_v01.tif': 10714853, 'MDS-50cm-105163-06-2024_v01.tif': 16012379 };
const TIN = 0.003;    // a doua diferență sub 3 mm: fațetă plană, adică interpolare
const PRAG_NMDS = 1;  // candidat: peste 1 m deasupra solului

const esteApa = (v) => v === -999 || v === 0;
const px = (c, r) => ({ x: F.x0 + (c + 0.5) * PAS, y: F.y1 - (r + 0.5) * PAS });

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const opreste = () => { if (picate) { console.log(`\n${picate} probe picate — m-am oprit.`); process.exit(1); } };

// ------------------------------------------------------------ 1. sosirea dalelor

console.log('Dalele');
const indici = [];
for (const col of [Math.floor(F.x0 / 1000) + 200, Math.floor((F.x1 - 1) / 1000) + 200])
  for (const rand of [Math.floor(F.y0 / 1000) + 301, Math.floor((F.y1 - 1) / 1000) + 301])
    if (!indici.includes(`${col}${rand}`)) indici.push(`${col}${rand}`);

const perechi = [];
for (const ind of indici) {
  const pereche = {};
  for (const tip of ['MDS', 'MDT']) {
    const nume = `${tip}-50cm-${ind}-06-2024_v01.tif`;
    cereFisier(`${DIR}/${nume}`, `dala ${tip} de 50 cm cu indicele ${ind}`,
      'Se descarcă de pe cdd.dgterritorio.gov.pt (cont gratuit), colecția LiDAR 2024-2025, 50 cm.');
    const t = citesteTiffDGT(`${DIR}/${nume}`);
    const col = Number(ind.slice(0, 3)), rnd = Number(ind.slice(3));
    const marime = readFileSync(`${DIR}/${nume}`).length;
    const bun = t.latime === 2000 && t.inaltime === 2000 && t.rezolutie === PAS && t.rezolutieY === PAS
      && t.epsg === 3763 && t.tipRaster === 1 && t.nodata === '-999'
      && t.x0 === (col - 200) * 1000 && t.y0 === (rnd - 300) * 1000
      && (MARIMI[nume] === undefined || MARIMI[nume] === marime);
    proba(bun, `${nume}: ${t.latime}×${t.inaltime} la ${t.rezolutie} m, colț (${t.x0}, ${t.y0}), EPSG ${t.epsg}, `
      + `${t.tipRaster === 1 ? 'PixelIsArea' : 'tip ' + t.tipRaster}, NoData ${t.nodata}, ${t.compresie === 5 ? 'LZW' : 'brută'}, ${marime} B`
      + (MARIMI[nume] ? ` (catalog: ${MARIMI[nume]})` : ''));
    pereche[tip] = t;
  }
  proba(pereche.MDS.x0 === pereche.MDT.x0 && pereche.MDS.y0 === pereche.MDT.y0, `${ind}: MDS și MDT pe aceeași grilă`);
  perechi.push({ ind, ...pereche });
}
opreste();

// ------------------------------------------------------------ 2. mozaicul

console.log('\nMozaicul pe fereastră');
const mds = new Float32Array(W * H).fill(NaN), mdt = new Float32Array(W * H).fill(NaN);
for (const p of perechi) {
  for (let r = 0; r < H; r++) {
    const yTop = F.y1 - r * PAS;
    const rr = (p.MDS.y0 - yTop) / PAS;
    if (rr < 0 || rr >= p.MDS.inaltime) continue;
    const a = p.MDS.rand(rr), b = p.MDT.rand(rr);
    for (let c = 0; c < W; c++) {
      const cc = (F.x0 + c * PAS - p.MDS.x0) / PAS;
      if (cc < 0 || cc >= p.MDS.latime) continue;
      mds[r * W + c] = a[cc];
      mdt[r * W + c] = b[cc];
    }
  }
}
let lipsa = 0;
for (let i = 0; i < W * H; i++) if (Number.isNaN(mds[i])) lipsa++;
proba(lipsa === 0, `${W} × ${H} pixeli, ${lipsa} fără date`);

// NDVI la 0,5 m: nivelul de 0,25 m al ortofotoului, mediat 2 × 2, NDVI după medie.
const o = deschideOrtofoto(ORTOFOTO, 0.25);
const oc0 = (F.x0 - o.x0) / o.pas, or0 = (o.y0 - F.y1) / o.pas;
proba(Number.isInteger(oc0) && Number.isInteger(or0), `ortofotoul se aliniază: fereastra începe la pixelul (${oc0}, ${or0}) al nivelului de 0,25 m`);
opreste();
const R = fereastraMedie(o, 0, oc0, or0, W, H, 2), N = fereastraMedie(o, 3, oc0, or0, W, H, 2);
const veg = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) veg[i] = ndvi(R[i], N[i]);

// ------------------------------------------------------------ OSM, rasterizat

const man = JSON.parse(readFileSync('scripts/sanctuar/osm-manifest.json', 'utf8'));
const inst = JSON.parse(readFileSync(`date-sursa/osm/${man.fisier}`, 'utf8'));
const tm = ([, , lat, lon]) => { const p = laTM06(lon, lat); return [p.x, p.y]; };
const ERMIDA = new Set([999972306, 999972305, 999972304]);
// Geometria de lucru: azi, cu excepția grupului Ermidei, luat de dinainte de 2022.
const cale = (el) => (ERMIDA.has(el.id) && el.inainte?.noduri ? el.inainte.noduri : el.noduri).map(tm);
const inchisa = (el) => el.noduri.length > 3 && el.noduri[0][0] === el.noduri[el.noduri.length - 1][0];
const cladiri = inst.elemente.filter((e) => e.tip === 'way' && inchisa(e) && e.tags?.building);
const cauta = (id) => inst.elemente.find((e) => e.id === id);

function rasterizeaza(p, masca, val = 1) {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - F.x0) / PAS)), c1 = Math.min(W - 1, Math.ceil((Math.max(...xs) - F.x0) / PAS));
  const r0 = Math.max(0, Math.floor((F.y1 - Math.max(...ys)) / PAS)), r1 = Math.min(H - 1, Math.ceil((F.y1 - Math.min(...ys)) / PAS));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const { x, y } = px(c, r);
    let in_ = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++)
      if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) in_ = !in_;
    if (in_) masca[r * W + c] = val;
  }
  return masca;
}
const dilata = (m, n) => {
  let a = m;
  for (let k = 0; k < n; k++) {
    const b = new Uint8Array(W * H);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      let v = 0;
      for (let dr = -1; dr <= 1 && !v; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < H && cc >= 0 && cc < W && a[rr * W + cc]) { v = 1; break; }
      }
      b[r * W + c] = v;
    }
    a = b;
  }
  return a;
};
const erodeaza = (m, n) => { const inv = m.map((v) => (v ? 0 : 1)); return dilata(inv, n).map((v) => (v ? 0 : 1)); };

const mCladiri = new Uint8Array(W * H);
for (const el of cladiri) rasterizeaza(cale(el), mCladiri);
const mTerreiro = rasterizeaza(cale(cauta(225800568)), new Uint8Array(W * H));
const mParcare = rasterizeaza(cale(cauta(708329399)), new Uint8Array(W * H));

// ------------------------------------------------------------ golurile TIN

// Unde LiDAR-ul n-a avut sol — sub clădiri —, MDT-ul e interpolat pe triunghiuri,
// deci fiecare pixel stă pe un plan: a doua diferență e zero, pe ambele axe. Pe
// solul măsurat zgomotul punctelor o ține de ordinul centimetrilor.
const mTin = new Uint8Array(W * H);
for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
  const i = r * W + c;
  if (esteApa(mdt[i])) continue;
  const dxx = mdt[i - 1] - 2 * mdt[i] + mdt[i + 1], dyy = mdt[i - W] - 2 * mdt[i] + mdt[i + W];
  if (Math.abs(dxx) < TIN && Math.abs(dyy) < TIN) mTin[i] = 1;
}
const mTinInchis = erodeaza(dilata(mTin, 1), 1);

// ------------------------------------------------------------ 3. probele pe date

console.log('\nAcelași datum, aceeași grilă');
let uscat = 0, subSol = 0;
const nmds = new Float32Array(W * H).fill(NaN);
for (let i = 0; i < W * H; i++) {
  if (esteApa(mdt[i]) || mds[i] === -999) continue;
  nmds[i] = mds[i] - mdt[i];
  uscat++;
  if (nmds[i] < -0.15) subSol++;
}
proba(subSol / uscat < 0.005, `MDS − MDT ≥ −0,15 m pe ${((1 - subSol / uscat) * 100).toFixed(2)}% din ${uscat} pixeli de uscat — cerut ≥ 99,5%`);

// Solul gol: terreiro-ul și parcarea, erodate cu 3 m, fără goluri TIN și fără vegetație.
const solGol = [];
const mSol = erodeaza(mTerreiro.map((v, i) => v | mParcare[i]), 6);
for (let i = 0; i < W * H; i++)
  if (mSol[i] && !mTinInchis[i] && veg[i] < PRAG_NDVI && Number.isFinite(nmds[i])) solGol.push(i);
const mediana = (v) => { const s = Float64Array.from(v).sort(); return s[Math.floor(s.length / 2)]; };
const dSol = (dc, dr) => mediana(solGol.map((i) => {
  const r = Math.floor(i / W) + dr, c = (i % W) + dc;
  return Math.abs(mds[r * W + c] - mdt[i]);
}));
const d0 = dSol(0, 0);
proba(d0 <= 0.05, `pe ${solGol.length} pixeli de sol gol (terreiro, parcare), mediana |MDS − MDT| = ${d0.toFixed(3)} m — cerut ≤ 0,05`);
let minD = { v: Infinity };
for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const v = dSol(dc, dr); if (v < minD.v) minD = { v, dc, dr }; }
proba(minD.dc === 0 && minD.dr === 0, `deplasarea MDS față de MDT cu mediana minimă: (${minD.dc * PAS}, ${-minD.dr * PAS}) m — cerut (0, 0)`);

// Cusăturile dintre dalele de MDS, pe rânduri (y −138000) și pe coloane (x −94000):
// diferența peste cusătură trebuie să fie ca între două linii vecine din aceeași dală.
const cusatura = (linie, vecina, n, pas) => {
  let s = 0, k = 0, s2 = 0, k2 = 0;
  for (let t = 0; t < n; t++) {
    const a = mds[linie(t)], b = mds[linie(t) + pas], c = mds[vecina(t)];
    if ([a, b, c].some((v) => v === -999 || Number.isNaN(v)) || esteApa(mdt[linie(t)])) continue;
    s += Math.abs(a - b); k++;
    s2 += Math.abs(c - a); k2++;
  }
  return { peste: s / k, inauntru: s2 / k2, k };
};
const rCus = (F.y1 - -138000) / PAS; // primul rând al lui 162
const cr = cusatura((c) => (rCus - 1) * W + c, (c) => (rCus - 2) * W + c, W, W);
proba(cr.peste < 1.5 * cr.inauntru, `cusătura y −138000: ${cr.peste.toFixed(3)} m peste ea, ${cr.inauntru.toFixed(3)} m între rânduri vecine (${cr.k} px) — cerut sub 1,5×`);
const cCus = (-94000 - F.x0) / PAS; // prima coloană a lui 106
const cc = cusatura((r) => r * W + cCus - 1, (r) => r * W + cCus - 2, H, 1);
proba(cc.peste < 1.5 * cc.inauntru, `cusătura x −94000: ${cc.peste.toFixed(3)} m peste ea, ${cc.inauntru.toFixed(3)} m între coloane vecine (${cc.k} px) — cerut sub 1,5×`);

// Golurile TIN cad pe clădirile OSM — proba din cercetare, refăcută aici pe mozaic.
let tinInCladiri = 0, cladiriTin = 0, pxCladiri = 0;
for (let i = 0; i < W * H; i++) {
  if (mCladiri[i]) { pxCladiri++; if (mTinInchis[i]) cladiriTin++; }
  if (mTinInchis[i] && mCladiri[i]) tinInCladiri++;
}
console.log(`  (golurile TIN acoperă ${((cladiriTin / pxCladiri) * 100).toFixed(1)}% din pixelii clădirilor OSM, cu tot cu ruinele fără acoperiș)`);
opreste();

// ------------------------------------------------------------ 5. candidații

// Ce stă deasupra solului, fără vegetație, în afara clădirilor OSM lărgite cu 1 m
// și în afara parcării (autobuzele ar ieși clădiri). Componente conexe (8 vecini).
const mCand = new Uint8Array(W * H);
const inafara = dilata(mCladiri, 2);
for (let i = 0; i < W * H; i++)
  if (nmds[i] > PRAG_NMDS && veg[i] < PRAG_NDVI && !inafara[i] && !mParcare[i]) mCand[i] = 1;
const eticheta = new Int32Array(W * H).fill(-1);
const candidati = [];
for (let s = 0; s < W * H; s++) {
  if (!mCand[s] || eticheta[s] >= 0) continue;
  const stiva = [s], pix = [];
  eticheta[s] = candidati.length;
  while (stiva.length) {
    const i = stiva.pop(); pix.push(i);
    const r = Math.floor(i / W), c = i % W;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc2 = c + dc, j = rr * W + cc2;
      if (rr >= 0 && rr < H && cc2 >= 0 && cc2 < W && mCand[j] && eticheta[j] < 0) { eticheta[j] = candidati.length; stiva.push(j); }
    }
  }
  const arie = pix.length * PAS * PAS;
  if (arie < 1.5) { for (const i of pix) mCand[i] = 0; continue; }
  const pts = pix.map((i) => px(i % W, Math.floor(i / W)));
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length, my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my); }
  const t = (sxx + syy) / 2, d = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2);
  const alungire = Math.sqrt((t + d) / Math.max(t - d, 1e-9));
  candidati.push({ x: +mx.toFixed(1), y: +my.toFixed(1), arie: +arie.toFixed(1), hMax: +Math.max(...pix.map((i) => nmds[i])).toFixed(2), alungire: +alungire.toFixed(1) });
}
candidati.sort((a, b) => b.arie - a.arie);
console.log(`\nCandidați în afara OSM (nMDS > ${PRAG_NMDS} m, NDVI < ${PRAG_NDVI}, ≥ 1,5 m²): ${candidati.length}`);
for (const k of candidati.slice(0, 40))
  console.log(`  TM06 (${k.x}, ${k.y})  scena (${(k.x + 94624).toFixed(1)}, ${(-137899 - k.y).toFixed(1)})  ${k.arie} m², până la ${k.hMax} m, alungire ${k.alungire}${k.alungire > 5 ? ' — zid?' : ''}`);

// ------------------------------------------------------------ 4. straturile

mkdirSync(DERIVATE, { recursive: true });
const umbrire = new Float32Array(W * H);
{
  const az = (315 * Math.PI) / 180, alt = (45 * Math.PI) / 180;
  const lx = Math.sin(az) * Math.cos(alt), ly = Math.cos(az) * Math.cos(alt), lz = Math.sin(alt);
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
    const i = r * W + c;
    const z = (j) => (mds[j] === -999 ? 0 : mds[j]);
    const gx = (z(i + 1) - z(i - 1)) / (2 * PAS), gy = (z(i - W) - z(i + W)) / (2 * PAS);
    const n = Math.hypot(gx, gy, 1);
    umbrire[i] = Math.max(0, (-gx * lx - gy * ly + lz) / n);
  }
}
const png = (nume, f, w = W, h = H) => {
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const [a, b, c] = f(i); rgb[i * 3] = a; rgb[i * 3 + 1] = b; rgb[i * 3 + 2] = c; }
  writeFileSync(`${DERIVATE}/${nume}`, scriePng(w, h, rgb));
};
const gri = (v) => { const g = Math.round(255 * Math.min(1, Math.max(0, v))); return [g, g, g]; };
const rampa = (t) => { // albastru închis → turcoaz → galben, pe [0, 1]
  const s = Math.min(1, Math.max(0, t));
  return [Math.round(255 * Math.min(1, s * 1.8 - 0.4 < 0 ? 0 : s * 1.8 - 0.4)), Math.round(255 * Math.min(1, s * 1.4)), Math.round(255 * (1 - s) * 0.9 + 30)];
};
png('mds-umbrire.png', (i) => gri(umbrire[i]));
png('nmds.png', (i) => (Number.isNaN(nmds[i]) ? [20, 40, 90] : nmds[i] < 0.3 ? gri(umbrire[i] * 0.6) : rampa(nmds[i] / 20)));
png('goluri-tin.png', (i) => (mTinInchis[i] ? [230, 90, 40] : gri(umbrire[i] * 0.7)));
{
  const Rr = fereastra(o, 0, oc0, or0, W * 2, H * 2), G = fereastra(o, 1, oc0, or0, W * 2, H * 2), B = fereastra(o, 2, oc0, or0, W * 2, H * 2);
  png('ortofoto.png', (i) => [Rr[i], G[i], B[i]], W * 2, H * 2);
}
// Suprapunerea: umbrirea, conturul clădirilor OSM (galben), golurile TIN (portocaliu),
// candidații (magenta).
const contur = (m) => { const e = erodeaza(m, 1); return m.map((v, i) => (v && !e[i] ? 1 : 0)); };
const cCladiri = contur(mCladiri);
png('suprapunere-osm.png', (i) => (cCladiri[i] ? [255, 220, 0] : mCand[i] ? [230, 40, 200] : mTinInchis[i] ? [255, 140, 60] : gri(umbrire[i] * 0.8)));

// Rastrul pentru pașii următori: MDS, MDT, NDVI, pe aceeași fereastră.
const bin = Buffer.alloc(W * H * 4 * 3);
[mds, mdt, veg].forEach((a, k) => Buffer.from(a.buffer).copy(bin, k * W * H * 4));
writeFileSync(`${DERIVATE}/sanctuar-rastru.bin`, bin);
writeFileSync(`${DERIVATE}/sanctuar-rastru.json`, JSON.stringify({
  fereastra_tm06: F, pas: PAS, latime: W, inaltime: H, rand0: 'nord', straturi: ['mds', 'mdt', 'ndvi'], tip: 'float32le',
  dale: perechi.map((p) => p.ind), candidati, generat: new Date().toISOString(),
}, null, 1));
console.log(`\nscris în ${DERIVATE}/: mds-umbrire.png, nmds.png, goluri-tin.png, ortofoto.png, suprapunere-osm.png, sanctuar-rastru.bin/.json`);

console.log(picate ? `\n${picate} probe picate.` : '\nToate probele au trecut.');
process.exitCode = picate ? 1 : 0;
