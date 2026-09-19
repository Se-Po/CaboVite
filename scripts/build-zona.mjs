#!/usr/bin/env node
// Extrage zona selectată în pagină din dalele LiDAR ale DGT.
//
// Poligonul vine din selectorul din pagină, în longitudine/latitudine. Aici e
// proiectat în ETRS89 / Portugal TM06, decupat din mozaicul dalelor și scris ca
// heightmap, împreună cu poligonul în coordonate de scenă — ca plasa să se
// genereze numai înăuntrul lui, nu pe toată cutia dreptunghiulară.
//
// Sursa: Levantamento LiDAR de Portugal Continental 2024-2025 (DGT), MDT 2 m,
// 10 puncte/m², CC BY 4.0. Dalele sunt GeoTIFF float32 NECOMPRIMATE.
//
// Rulează: npm run build-zona          (pas de 2 m, rezoluția nativă)
//          npm run build-zona -- 4     (mediere pe blocuri 2 × 2)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Numele hărții produse. Hărțile proiectului sunt numerotate harta_vN: o
// hartă nouă înseamnă alt contur sau altă rezoluție, deci alt nume, nu un
// fișier suprascris. Fișierele ies ca public/data/<NUME>-dem.bin + .json.
const NUME = 'harta_v0';

const DIR = 'date-sursa/lidar';
const IESIRE = 'public/data';
const NODATA = -999;
const REZ_SURSA = 2;

// Poligonul desenat în pagină, longitudine latitudine. Îl schimbi de aici când
// alegi altă zonă — panoul „Coordonate" îl dă exact în forma asta.
const POLIGON_GEO = [
  [-9.2202, 38.4345],
  [-9.2034, 38.4256],
  [-9.2121, 38.4077],
  [-9.2298, 38.4110],
];

// Marea, în aceste date, NU e NODATA: LiDAR-ul o dă ca 0.0 m exact. Lăsată așa,
// ar fi coplanară cu planul mării al scenei și ar produce z-fighting pe sute de
// metri. O coborâm, ca linia țărmului să fie intersecția onestă a terenului cu
// y = 0. Nu e o afirmație despre adâncime.
const ADANCIME_APA = -8;
const esteApa = (v) => v === 0 || v <= NODATA + 1;

const pas = Number(process.argv[2]) || REZ_SURSA;
if (pas % REZ_SURSA !== 0) throw new Error(`pasul trebuie să fie multiplu de ${REZ_SURSA} m`);
const FACTOR = pas / REZ_SURSA;

// --------------------------------------------------- ETRS89 / PT-TM06 (3763)
//
// Mercator transversal pe GRS80, fără deplasări false. Formulele complete, nu
// aproximarea „grade × metri pe grad": la 95 km de meridianul central aceea
// greșește cu zeci de metri, adică zeci de celule la rezoluția asta.
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

/** Inversa: TM06 → longitudine/latitudine, ca sidecar-ul să poarte colțurile. */
function dinTM06(x, y) {
  const mu = (y + M0) / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const lat1 = mu
    + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const C1 = EP2 * Math.cos(lat1) ** 2;
  const T1 = Math.tan(lat1) ** 2;
  const s = 1 - E2 * Math.sin(lat1) ** 2;
  const N1 = A / Math.sqrt(s);
  const R1 = (A * (1 - E2)) / s ** 1.5;
  const D = x / N1;
  const lat = lat1 - ((N1 * Math.tan(lat1)) / R1) * (D ** 2 / 2
    - ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6) / 720);
  const lon = LON0 + (D - ((1 + 2 * T1 + C1) * D ** 3) / 6
    + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5) / 120) / Math.cos(lat1);
  return { lon: +((lon * 180) / Math.PI).toFixed(6), lat: +((lat * 180) / Math.PI).toFixed(6) };
}

/** Regula par-impar, aceeași ca în src/scene/selectie.js. */
function inPoligon(x, y, p) {
  let inauntru = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i].y > y) !== (p[j].y > y) &&
        x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x)
      inauntru = !inauntru;
  return inauntru;
}

const arie = (p) => {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    s += (p[j].x + p[i].x) * (p[j].y - p[i].y);
  return Math.abs(s / 2);
};

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
  if (compresie !== 1) throw new Error(`${cale}: compresie ${compresie}, aștept necomprimat`);
  const ps = dubluri(33550), tp = dubluri(33922);
  return {
    buf,
    latime: scalar(256), inaltime: scalar(257), rezolutie: ps[0],
    x0: tp[3], y0: tp[4], // TiePoint dă colțul stânga-sus; în TM06 Y crește spre nord
    randuriPeStrip: scalar(278), stripOffsets: lung(273),
  };
}

/** Un rând de float32 dintr-un TIFF necomprimat cu strip-uri. */
function randTiff(t, r) {
  const strip = Math.floor(r / t.randuriPeStrip);
  const start = t.stripOffsets[strip] + (r - strip * t.randuriPeStrip) * t.latime * 4;
  const out = new Float32Array(t.latime);
  for (let i = 0; i < t.latime; i++) out[i] = t.buf.readFloatLE(start + i * 4);
  return out;
}

// --------------------------------------------------------------------- main

const main = () => {
  const poligon = POLIGON_GEO.map(([lon, lat]) => laTM06(lon, lat));
  const xMin = Math.min(...poligon.map((p) => p.x)), xMax = Math.max(...poligon.map((p) => p.x));
  const yMin = Math.min(...poligon.map((p) => p.y)), yMax = Math.max(...poligon.map((p) => p.y));

  // Cutia se aliniază la pasul de ieșire, ca să nu iasă o jumătate de celulă la
  // margine când se face medierea pe blocuri.
  const X_MIN = Math.floor(xMin / pas) * pas, X_MAX = Math.ceil(xMax / pas) * pas;
  const Y_MIN = Math.floor(yMin / pas) * pas, Y_MAX = Math.ceil(yMax / pas) * pas;
  const w = Math.round((X_MAX - X_MIN) / pas), h = Math.round((Y_MAX - Y_MIN) / pas);

  console.log(`poligon: ${POLIGON_GEO.length} vârfuri, ${(arie(poligon) / 1e6).toFixed(2)} km²`);
  console.log(`cutie TM06: X ${X_MIN} .. ${X_MAX}   Y ${Y_MIN} .. ${Y_MAX}`);
  console.log(`grilă: ${w} × ${h} la ${pas} m = ${(w * h / 1e6).toFixed(2)} M celule`);

  // ----------------------------------------------------- mozaicul la 2 m
  const ws = Math.round((X_MAX - X_MIN) / REZ_SURSA), hs = Math.round((Y_MAX - Y_MIN) / REZ_SURSA);
  const sursa = new Float32Array(ws * hs).fill(NaN);

  const fisiere = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.tif'));
  if (!fisiere.length) throw new Error(`niciun .tif în ${DIR}`);
  const dale = fisiere.map((f) => ({ nume: f, ...citesteTiff(join(DIR, f)) }));
  if (dale.some((d) => d.rezolutie !== REZ_SURSA)) throw new Error('dale cu altă rezoluție decât 2 m');

  const folosite = [];
  for (const d of dale) {
    const dx1 = d.x0, dx2 = d.x0 + d.latime * REZ_SURSA;
    const dy2 = d.y0, dy1 = d.y0 - d.inaltime * REZ_SURSA;
    if (dx2 <= X_MIN || dx1 >= X_MAX || dy2 <= Y_MIN || dy1 >= Y_MAX) continue;
    folosite.push(d.nume);
    for (let r = 0; r < d.inaltime; r++) {
      const y = d.y0 - (r + 0.5) * REZ_SURSA;
      const gr = Math.floor((Y_MAX - y) / REZ_SURSA);
      if (gr < 0 || gr >= hs) continue;
      const rand = randTiff(d, r);
      for (let c = 0; c < d.latime; c++) {
        const x = d.x0 + (c + 0.5) * REZ_SURSA;
        const gc = Math.floor((x - X_MIN) / REZ_SURSA);
        if (gc < 0 || gc >= ws) continue;
        sursa[gr * ws + gc] = esteApa(rand[c]) ? NaN : rand[c];
      }
    }
  }
  console.log(`dale folosite: ${folosite.length} din ${fisiere.length}`);

  // --------------------------------------- reducerea la pasul cerut
  //
  // Medie pe blocuri, nu eșantionare: a lua o celulă din patru ar păstra
  // zgomotul punctual al LiDAR-ului și ar arunca restul. Media pe uscat ignoră
  // celulele de apă, altfel prima linie de țărm ar fi trasă în jos artificial.
  const grila = new Float32Array(w * h).fill(NaN);
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      let suma = 0, n = 0;
      for (let dr = 0; dr < FACTOR; dr++)
        for (let dc = 0; dc < FACTOR; dc++) {
          const v = sursa[(r * FACTOR + dr) * ws + (c * FACTOR + dc)];
          if (!Number.isNaN(v)) { suma += v; n++; }
        }
      if (n) grila[r * w + c] = suma / n;
    }

  // ------------------------------------------------- poligonul în scenă
  //
  // terrain.js centrează grila pe origine și pune rândul 0 la nord, deci
  // scenă.x = TM06.x − centrul pe X, iar scenă.z = centrul pe Y − TM06.y
  // (Z crește spre sud, Y crește spre nord).
  const centruX = (X_MIN + X_MAX) / 2, centruY = (Y_MIN + Y_MAX) / 2;
  const poligonScena = poligon.map((p) => ({
    x: +(p.x - centruX).toFixed(2),
    z: +(centruY - p.y).toFixed(2),
  }));

  let uscat = 0, inPolig = 0, uscatInPolig = 0, zmin = Infinity, zmax = -Infinity;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const v = grila[r * w + c];
      const inp = inPoligon(X_MIN + (c + 0.5) * pas, Y_MAX - (r + 0.5) * pas, poligon);
      if (inp) inPolig++;
      if (Number.isNaN(v)) continue;
      uscat++;
      if (!inp) continue;
      uscatInPolig++;
      if (v < zmin) zmin = v;
      if (v > zmax) zmax = v;
    }
  const celuleMesh = inPolig;
  console.log(`în poligon: ${inPolig} celule (${(100 * inPolig / (w * h)).toFixed(0)}% din cutie)`);
  console.log(`  din care uscat măsurat: ${uscatInPolig} (${(100 * uscatInPolig / inPolig).toFixed(0)}%)`);
  console.log(`altitudine: ${zmin.toFixed(2)} .. ${zmax.toFixed(2)} m`);
  console.log(`triunghiuri estimate: ${(2 * celuleMesh / 1000).toFixed(0)}k`);

  // Golurile devin apă. Nu interpolăm: o gaură în mijlocul uscatului ar fi o
  // problemă de date, nu ceva de umplut pe tăcute.
  const final = new Float32Array(grila.length);
  for (let i = 0; i < grila.length; i++)
    final[i] = Number.isNaN(grila[i]) ? ADANCIME_APA : grila[i];

  const zMin = ADANCIME_APA, zMax = zmax;
  const scara = (zMax - zMin) / 65535;
  const u16 = new Uint16Array(grila.length);
  for (let i = 0; i < final.length; i++)
    u16[i] = Math.round((final[i] - zMin) / scara);

  mkdirSync(IESIRE, { recursive: true });
  writeFileSync(join(IESIRE, `${NUME}-dem.bin`), Buffer.from(u16.buffer));
  writeFileSync(join(IESIRE, `${NUME}-dem.json`), JSON.stringify({
    nume: NUME,
    descriere: `Zona selectată la Cabo Espichel. LiDAR DGT 2024-2025, MDT 2 m, redus la ${pas} m. Uint16 little-endian, rând 0 = nord.`,
    latime: w, inaltime: h,
    crs: 'ETRS89 / Portugal TM06 (EPSG:3763)',
    bbox_tm06: { xMin: X_MIN, xMax: X_MAX, yMin: Y_MIN, yMax: Y_MAX },
    pasX_m: pas, pasZ_m: pas,
    // Cele patru colțuri în longitudine/latitudine. Un dreptunghi TM06 NU e un
    // dreptunghi geografic — convergența meridianelor îl rotește cu ~0,7° aici,
    // adică vreo 35 m pe diagonala zonei. De aceea sidecar-ul poartă colțurile,
    // nu un „bbox": pagina interpolează între ele și păstrează rotația.
    colturi_geo: {
      nv: dinTM06(X_MIN, Y_MAX), ne: dinTM06(X_MAX, Y_MAX),
      sv: dinTM06(X_MIN, Y_MIN), se: dinTM06(X_MAX, Y_MIN),
    },
    zMin_m: +zMin.toFixed(2), zMax_m: +zMax.toFixed(2), zScara: scara,
    // Plasa se generează numai înăuntrul poligonului. Fără el, cutia
    // dreptunghiulară ar avea de 1,7 ori mai multe celule, mai toate apă.
    poligon_scena: poligonScena,
    poligon_geo: POLIGON_GEO.map(([lon, lat]) => ({ lon, lat })),
    acoperire: {
      celule_in_poligon: inPolig,
      uscat_masurat_in_poligon: uscatInPolig,
      uscat_masurat_in_cutie: uscat,
      regula_apa: 'exact 0.0 m sau NODATA (-999); plaja, care are valori mici dar nenule, rămâne uscat',
      nota_colt_fara_dala: 'Colțul de nord-vest al cutiei iese din acoperirea LiDAR (dala MDT-2m-104164 nu există). Verificat pe Copernicus GLO-30: acolo e mare, nu uscat — deci nu lipsește relief.',
    },
    prelucrare: {
      exagerare_verticala: 1.0,
      ascutire: 'niciuna',
      reducere: FACTOR === 1 ? 'niciuna — rezoluția nativă de 2 m'
        : `medie pe blocuri ${FACTOR} × ${FACTOR}, ignorând celulele de apă`,
      nota: `La ${pas} m faleza e măsurată direct. Ascuțirea folosită pe datele de 30 m ar falsifica măsurători reale, deci nu se aplică. Celulele fără date (apă) sunt coborâte la ${ADANCIME_APA} m — artificiu de randare, nu batimetrie.`,
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
  }, null, 2));

  console.log(`scris: public/data/${NUME}-dem.bin (${(u16.byteLength / 1048576).toFixed(2)} MB) + .json`);
};

main();
