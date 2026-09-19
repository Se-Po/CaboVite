#!/usr/bin/env node
// Construiește un petic de rezoluție mai mare, cusut în harta de bază.
//
// Sursa: dalele MDT-50cm ale DGT din date-sursa/lidar-50cm/. Peticul se scrie la
// pasul cerut (implicit 1 m, adică medie pe blocuri 2 × 2 din 0,5 m), iar baza
// primește o gaură exact sub el.
//
// Rulează: npm run build-petic          (pas de 1 m)
//          npm run build-petic -- 0.5   (rezoluția nativă)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const NUME = 'harta_v1';
const BAZA = 'harta_v0';

const DIR = 'date-sursa/lidar-50cm';
const IESIRE = 'public/data';
const NODATA = -999;
const REZ_SURSA = 0.5;

// Conturul zonei, longitudine latitudine. Peticul e dreptunghiul care îl
// cuprinde — vezi comentariul de la alinierea nodurilor.
const POLIGON_GEO = [
  [-9.2184, 38.4265],
  [-9.2128, 38.4246],
  [-9.2132, 38.4215],
  [-9.2136, 38.4204],
  [-9.2153, 38.4203],
  [-9.2186, 38.4196],
  [-9.2189, 38.4213],
  [-9.2188, 38.4220],
];

const ADANCIME_APA = -8;
const esteApa = (v) => v === 0 || v <= NODATA + 1;

// Lățimea trecerii de la relieful bazei la cel al peticului, în noduri. Inelul
// exterior e impus de bază (vezi „cusătura” din main); dincolo de bandă, peticul e
// numai datele lui.
const BANDA_CUSATURA = 4;

const pas = Number(process.argv[2]) || 1;
if (Math.round(pas / REZ_SURSA) * REZ_SURSA !== pas || pas < REZ_SURSA)
  throw new Error(`pasul trebuie să fie multiplu de ${REZ_SURSA} m`);

// --------------------------------------------------- ETRS89 / PT-TM06 (3763)
const A = 6378137, F = 1 / 298.257222101;
const E2 = F * (2 - F), EP2 = E2 / (1 - E2);
const LAT0 = (39.6682583333333 * Math.PI) / 180;
const LON0 = (-8.13310833333333 * Math.PI) / 180;

const arcMeridian = (lat) =>
  A * ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * lat
     - ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * lat)
     + ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * lat)
     - ((35 * E2 ** 3) / 3072) * Math.sin(6 * lat));
const M0 = arcMeridian(LAT0);

function laTM06(lonGrade, latGrade) {
  const lat = (latGrade * Math.PI) / 180, lon = (lonGrade * Math.PI) / 180;
  const N = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2;
  const C = EP2 * Math.cos(lat) ** 2;
  const a = (lon - LON0) * Math.cos(lat);
  return {
    x: N * (a + ((1 - T + C) * a ** 3) / 6
          + ((5 - 18 * T + T ** 2 + 72 * C - 58 * EP2) * a ** 5) / 120),
    y: arcMeridian(lat) - M0 + N * Math.tan(lat) * (a ** 2 / 2
          + ((5 - T + 9 * C + 4 * C ** 2) * a ** 4) / 24
          + ((61 - 58 * T + T ** 2 + 600 * C - 330 * EP2) * a ** 6) / 720),
  };
}

// ------------------------------------------------------------------ GeoTIFF

/** Citește antetul unui TIFF little-endian și întoarce ce ne trebuie. */
function citesteTiff(cale) {
  const buf = readFileSync(cale);
  if (buf.readUInt16LE(0) !== 0x4949) throw new Error(`${cale}: nu e TIFF little-endian`);
  const off = buf.readUInt32LE(4);
  const n = buf.readUInt16LE(off);
  const t = new Map();
  for (let i = 0; i < n; i++) {
    const b = off + 2 + i * 12;
    t.set(buf.readUInt16LE(b), { tip: buf.readUInt16LE(b + 2), nr: buf.readUInt32LE(b + 4), val: buf.readUInt32LE(b + 8) });
  }
  const scalar = (tag) => { const e = t.get(tag); return e && (e.tip === 3 ? e.val & 0xffff : e.val); };
  const lung = (tag) => {
    const e = t.get(tag);
    if (!e) return null;
    if (e.nr === 1) return [e.val];
    const out = [];
    for (let i = 0; i < e.nr; i++)
      out.push(e.tip === 4 ? buf.readUInt32LE(e.val + i * 4) : buf.readUInt16LE(e.val + i * 2));
    return out;
  };
  const dubluri = (tag) => {
    const e = t.get(tag);
    if (!e) return null;
    const out = [];
    for (let i = 0; i < e.nr; i++) out.push(buf.readDoubleLE(e.val + i * 8));
    return out;
  };

  const compresie = scalar(259) ?? 1;
  // Colecția MDT-50cm e inegal comprimată: unele dale sunt brute, altele nu, iar
  // codecul nu e documentat nicăieri. Nu ghicim — oprim cu un mesaj limpede.
  if (compresie !== 1)
    throw new Error(`${cale}: compresie ${compresie}. Dalele comprimate nu sunt acceptate; cere din catalog una necomprimată (dimensiune = lățime·înălțime·4 + rânduri·6 + 379).`);

  const ps = dubluri(33550), tp = dubluri(33922);
  return {
    buf,
    latime: scalar(256), inaltime: scalar(257), rezolutie: ps[0],
    x0: tp[3], y0: tp[4],
    randuriPeStrip: scalar(278), stripOffsets: lung(273),
  };
}

/** Un rând de float32 dintr-un TIFF necomprimat cu benzi. */
function randTiff(t, r) {
  const strip = Math.floor(r / t.randuriPeStrip);
  const start = t.stripOffsets[strip] + (r - strip * t.randuriPeStrip) * t.latime * 4;
  const out = new Float32Array(t.latime);
  for (let i = 0; i < t.latime; i++) out[i] = t.buf.readFloatLE(start + i * 4);
  return out;
}

// -------------------------------------------------------------- harta de bază

/**
 * Încarcă baza și dă acces la ea în coordonate TM06.
 *
 * `terrain.js` așază valoarea (r, c) într-un NOD de plasă, nu într-o celulă, iar
 * nodul cade în centrul celulei din care a venit valoarea: TM06 x = xMin + 2c + 1
 * pentru un pas de 2 m. De aici pornește toată alinierea de mai jos.
 */
function incarcaBaza() {
  const meta = JSON.parse(readFileSync(join(IESIRE, `${BAZA}-dem.json`), 'utf8'));
  const brut = readFileSync(join(IESIRE, `${BAZA}-dem.bin`));
  const { latime: w, inaltime: h, pasX_m: p, bbox_tm06: b } = meta;
  const z = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) z[i] = meta.zMin_m + brut.readUInt16LE(i * 2) * meta.zScara;

  const nodX = (c) => b.xMin + c * p + p / 2;
  const nodY = (r) => b.yMax - r * p - p / 2;

  return {
    meta, w, h, pas: p, bbox: b, z, nodX, nodY,
    centru: { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 },
    /** Valoarea într-un nod, cu indicii prinși în grilă. */
    laNod(r, c) {
      const rr = Math.max(0, Math.min(h - 1, r));
      const cc = Math.max(0, Math.min(w - 1, c));
      return z[rr * w + cc];
    },
    /** Interpolare biliniară între noduri, în TM06. */
    laTM(x, y) {
      const fc = (x - b.xMin - p / 2) / p;
      const fr = (b.yMax - p / 2 - y) / p;
      const c0 = Math.floor(fc), r0 = Math.floor(fr);
      const tx = fc - c0, ty = fr - r0;
      const sus = this.laNod(r0, c0) + (this.laNod(r0, c0 + 1) - this.laNod(r0, c0)) * tx;
      const jos = this.laNod(r0 + 1, c0) + (this.laNod(r0 + 1, c0 + 1) - this.laNod(r0 + 1, c0)) * tx;
      return sus + (jos - sus) * ty;
    },
  };
}

// --------------------------------------------------------------------- main

const main = () => {
  if (!existsSync(DIR)) throw new Error(`${DIR} nu există — pune acolo dalele MDT-50cm`);
  const fisiere = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.tif'));
  if (!fisiere.length) throw new Error(`niciun .tif în ${DIR}`);

  const baza = incarcaBaza();
  console.log(`bază: ${BAZA}, ${baza.w} × ${baza.h} la ${baza.pas} m`);

  const dale = fisiere.map((f) => ({ nume: f, ...citesteTiff(join(DIR, f)) }));
  if (dale.some((d) => d.rezolutie !== REZ_SURSA))
    throw new Error(`dale cu altă rezoluție decât ${REZ_SURSA} m`);
  const acop = {
    x0: Math.min(...dale.map((d) => d.x0)),
    x1: Math.max(...dale.map((d) => d.x0 + d.latime * REZ_SURSA)),
    y0: Math.min(...dale.map((d) => d.y0 - d.inaltime * REZ_SURSA)),
    y1: Math.max(...dale.map((d) => d.y0)),
  };
  console.log(`${dale.length} dale de ${REZ_SURSA} m, acoperire X ${acop.x0}..${acop.x1}  Y ${acop.y0}..${acop.y1}`);

  // --------------------------------------------- dreptunghiul, aliniat la bază
  //
  // Nodurile peticului trebuie să cadă peste nodurile bazei din două în două,
  // altfel marginea comună ar fi două linii diferite și ar rămâne o crăpătură.
  // Nodurile bazei stau la xMin + 2c + 1; deci colțul peticului se alege dintre
  // ele, iar pasul de 1 m face ca fiecare al doilea nod al lui să cadă pe unul
  // al bazei.
  const P = POLIGON_GEO.map(([lo, la]) => laTM06(lo, la));
  const cerut = {
    x0: Math.min(...P.map((p) => p.x)), x1: Math.max(...P.map((p) => p.x)),
    y0: Math.min(...P.map((p) => p.y)), y1: Math.max(...P.map((p) => p.y)),
  };
  // Tăiem la ce acoperă dalele; jumătate de celulă de sursă rămâne rezervă,
  // fiindcă valoarea unui nod se ia ca medie pe un pătrat centrat pe el.
  const marja = pas / 2;
  const lim = {
    x0: Math.max(cerut.x0, acop.x0 + marja), x1: Math.min(cerut.x1, acop.x1 - marja),
    y0: Math.max(cerut.y0, acop.y0 + marja), y1: Math.min(cerut.y1, acop.y1 - marja),
  };

  // Nodul bazei cel mai apropiat, spre interiorul dreptunghiului.
  const nodC = (x, spre) => Math[spre](( x - baza.bbox.xMin - baza.pas / 2) / baza.pas);
  const nodR = (y, spre) => Math[spre]((baza.bbox.yMax - baza.pas / 2 - y) / baza.pas);
  const c0 = nodC(lim.x0, 'ceil'), c1 = nodC(lim.x1, 'floor');
  const r0 = nodR(lim.y1, 'ceil'), r1 = nodR(lim.y0, 'floor');

  const X0 = baza.nodX(c0), X1 = baza.nodX(c1);
  const Y1 = baza.nodY(r0), Y0 = baza.nodY(r1);   // Y1 = nord, Y0 = sud
  const w = Math.round((X1 - X0) / pas) + 1;
  const h = Math.round((Y1 - Y0) / pas) + 1;

  console.log(`\npetic: X ${X0}..${X1}  Y ${Y0}..${Y1}   ${X1 - X0} × ${Y1 - Y0} m`);
  console.log(`grilă: ${w} × ${h} noduri la ${pas} m → ${(2 * (w - 1) * (h - 1) / 1e6).toFixed(2)} M triunghiuri`);
  if (cerut.y0 < lim.y0 - 0.01 || cerut.y1 > lim.y1 + 0.01 ||
      cerut.x0 < lim.x0 - 0.01 || cerut.x1 > lim.x1 + 0.01)
    console.log(`  (conturul cerut a fost retezat la acoperirea dalelor)`);

  // ------------------------------------------------- valorile, din dalele 0,5 m
  //
  // Valoarea unui nod e media pătratului de `pas` × `pas` centrat pe el, nu un
  // eșantion luat din patru în patru: eșantionarea ar păstra zgomotul punctual
  // al LiDAR-ului și ar arunca restul măsurătorilor.
  const sume = new Float64Array(w * h);
  const nrProbe = new Uint16Array(w * h);
  const jum = pas / 2;

  for (const d of dale) {
    const dx1 = d.x0, dx2 = d.x0 + d.latime * REZ_SURSA;
    const dy2 = d.y0, dy1 = d.y0 - d.inaltime * REZ_SURSA;
    if (dx2 <= X0 - jum || dx1 >= X1 + jum || dy2 <= Y0 - jum || dy1 >= Y1 + jum) continue;
    for (let rr = 0; rr < d.inaltime; rr++) {
      const y = d.y0 - (rr + 0.5) * REZ_SURSA;
      const nr = Math.round((Y1 - y) / pas);
      if (nr < 0 || nr >= h || Math.abs(Y1 - nr * pas - y) > jum) continue;
      const rand = randTiff(d, rr);
      for (let cc = 0; cc < d.latime; cc++) {
        const x = d.x0 + (cc + 0.5) * REZ_SURSA;
        const nc = Math.round((x - X0) / pas);
        if (nc < 0 || nc >= w) continue;
        const v = rand[cc];
        if (esteApa(v)) continue;
        sume[nr * w + nc] += v;
        nrProbe[nr * w + nc]++;
      }
    }
    process.stdout.write('.');
  }
  console.log('');

  const grila = new Float32Array(w * h);
  let uscat = 0, zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < grila.length; i++) {
    if (nrProbe[i]) {
      grila[i] = sume[i] / nrProbe[i];
      uscat++;
      if (grila[i] < zmin) zmin = grila[i];
      if (grila[i] > zmax) zmax = grila[i];
    } else {
      grila[i] = ADANCIME_APA;   // apă sau fără date, ca în restul proiectului
    }
  }
  console.log(`uscat măsurat: ${uscat} noduri (${(100 * uscat / grila.length).toFixed(0)}%), ${zmin.toFixed(2)} .. ${zmax.toFixed(2)} m`);

  // ------------------------------------------------------------- cusătura
  //
  // Inelul exterior primește exact relieful bazei, interpolat liniar de-a lungul
  // muchiei. Între două noduri ale bazei, peticul de 1 m are unul singur, iar
  // media celor două capete îl pune fix pe segmentul bazei: aceeași linie, deci
  // nici crăpătură, nici treaptă. Spre interior se trece lin la datele peticului.
  const neted = (t) => t * t * (3 - 2 * t);
  const cusut = Float32Array.from(grila);
  let atinse = 0;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const d = Math.min(r, c, h - 1 - r, w - 1 - c) / (BANDA_CUSATURA / pas);
      if (d >= 1) continue;
      const k = neted(d);
      const dinBaza = baza.laTM(X0 + c * pas, Y1 - r * pas);
      cusut[r * w + c] = dinBaza + (grila[r * w + c] - dinBaza) * k;
      atinse++;
    }
  console.log(`cusătură: ${atinse} noduri într-o bandă de ${BANDA_CUSATURA} m`);

  const zMin = Math.min(ADANCIME_APA, zmin), zMax = zmax;
  const scara = (zMax - zMin) / 65535;
  const u16 = new Uint16Array(grila.length);
  for (let i = 0; i < cusut.length; i++)
    u16[i] = Math.round(Math.min(65535, Math.max(0, (cusut[i] - zMin) / scara)));

  // ---------------------------------------- poziția în scenă și gaura din bază
  //
  // terrain.js centrează fiecare grilă pe origine; peticul are alt centru decât
  // baza, deci are nevoie de decalajul dintre ele.
  const deplasare = {
    x: +(X0 - baza.centru.x + (w - 1) / 2 * pas).toFixed(3),
    z: +(baza.centru.y - Y1 + (h - 1) / 2 * pas).toFixed(3),
  };
  const gaura = {
    x0: +(X0 - baza.centru.x).toFixed(3), x1: +(X1 - baza.centru.x).toFixed(3),
    z0: +(baza.centru.y - Y1).toFixed(3), z1: +(baza.centru.y - Y0).toFixed(3),
  };

  mkdirSync(IESIRE, { recursive: true });
  writeFileSync(join(IESIRE, `${NUME}-dem.bin`), Buffer.from(u16.buffer));
  writeFileSync(join(IESIRE, `${NUME}-dem.json`), JSON.stringify({
    nume: NUME,
    rol: 'petic',
    baza: BAZA,
    descriere: `Petic de ${pas} m peste ${BAZA}. LiDAR DGT 2024-2025, MDT 50 cm redus prin mediere. Uint16 little-endian, rând 0 = nord.`,
    latime: w, inaltime: h,
    crs: 'ETRS89 / Portugal TM06 (EPSG:3763)',
    bbox_tm06: { xMin: X0, xMax: X1, yMin: Y0, yMax: Y1 },
    pasX_m: pas, pasZ_m: pas,
    zMin_m: +zMin.toFixed(2), zMax_m: +zMax.toFixed(2), zScara: scara,
    deplasare_scena: deplasare,
    gaura_scena: gaura,
    poligon_geo: POLIGON_GEO.map(([lon, lat]) => ({ lon, lat })),
    acoperire: {
      noduri_uscat: uscat,
      procent_uscat: +(100 * uscat / grila.length).toFixed(1),
      regula_apa: 'exact 0.0 m sau NODATA (-999); plaja, care are valori mici dar nenule, rămâne uscat',
    },
    prelucrare: {
      exagerare_verticala: 1.0,
      ascutire: 'niciuna',
      reducere: pas === REZ_SURSA ? 'niciuna — rezoluția nativă de 50 cm'
        : `medie pe pătrate de ${pas} × ${pas} m din date de ${REZ_SURSA} m, ignorând celulele de apă`,
      cusatura: {
        latime_m: BANDA_CUSATURA,
        nota: `Inelul exterior ia exact relieful bazei (${BAZA}), interpolat de-a lungul muchiei comune, iar spre interior se trece lin la datele peticului. Fără asta, cele două rezoluții ar lăsa o crăpătură pe margine. Artificiu de îmbinare, nu date.`,
      },
      aliniere: `Nodurile peticului cad peste nodurile bazei din ${Math.round(baza.pas / pas)} în ${Math.round(baza.pas / pas)}; colțurile sunt noduri ale bazei.`,
    },
    sursa: {
      nume: 'Levantamento LiDAR de Portugal Continental 2024-2025 — Modelo Digital do Terreno 50 cm',
      producator: 'Direção-Geral do Território (DGT)',
      densitate: '10 puncte/m²',
      licenta: 'CC BY 4.0',
      atributie: 'Dados LiDAR: © Direção-Geral do Território, Levantamento LiDAR de Portugal Continental 2024-2025, CC BY 4.0',
      portal: 'https://cdd.dgterritorio.gov.pt/',
      dale: fisiere,
    },
  }, null, 2));

  console.log(`\ndeplasare în scenă: x ${deplasare.x}, z ${deplasare.z}`);
  console.log(`gaura din bază: x ${gaura.x0}..${gaura.x1}, z ${gaura.z0}..${gaura.z1}`);
  console.log(`scris: public/data/${NUME}-dem.bin (${(u16.byteLength / 1048576).toFixed(2)} MB) + .json`);
};

main();
