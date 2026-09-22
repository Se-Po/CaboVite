// Culorile adevărate ale terenului, din ortofotoul aerian DGT.
//
//   npm run ortofoto [nume-hartă]
//
// De ce era nevoie de el: fotografiile de la fața locului au dat culori bune
// pentru ce era aproape de aparat, dar pentru faleza și tufărișul de peste golf
// croma măsurată a ieșit sub prag — kilometrii de aer dintre lentilă și subiect
// spală culoarea. Ortofotoul privește drept în jos de la câteva sute de metri,
// deci nu are drumul acela de aer, și are pe deasupra o bandă de infraroșu, în
// care vegetația se aprinde și roca rămâne stinsă.
//
// Nu înlocuiește fotografiile: ele arată locul de la înălțimea ochiului, cu
// materialele pe care le-ai atins. Ortofotoul le completează acolo unde ele
// n-aveau ce să măsoare.
//
// Alinierea e exactă, nu potrivită: colțul ortofotoului e la TM06
// (-96000, -135000) cu pas 0,25 m, iar nivelul 3 al piramidei lui are exact 2 m,
// pasul lui harta_v0. Decalajul iese număr întreg de pixeli, deci pixelul
// ortofotoului cade peste nodul LiDAR fără reeșantionare.

import { openSync, readSync, closeSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { citesteIfd, deschideTiff } from './comun/tiff.mjs';
import { incarcaHarta } from './comun/relief.mjs';
import { inPoligon, laTM06 } from './comun/tm06.mjs';
import { cereDirector } from './comun/cere.mjs';

const DIR = 'date-sursa/ortofoto';
// Două directoare, două înțelesuri, și nu se pot amesteca: `public/` e ce
// SERVEȘTE pagina, iar paleta de acolo chiar se încarcă în browser. Raportul
// de ortofoto nu — e intrare pentru pasul următor al lanțului, deci stă lângă
// datele-sursă. Amândouă au stat până acum sub aceeași constantă, iar
// rezultatul era un fișier livrat vizitatorului pe care nimic nu-l cerea.
const PALETA_POZE = 'public/data';
const IESIRE = DIR;
const HARTA = process.argv[2] || 'harta_v0';

// Pragul de vegetație pe indicele de infraroșu. Ales după histograma datelor,
// nu din literatură: vezi raportul pe care-l scrie scriptul.
const PRAG_NDVI = 0.15;

/** Deschide COG-ul și întoarce nivelul de piramidă cu rezoluția cerută. */
function deschideOrtofoto(cale, pasDorit) {
  const fd = openSync(cale, 'r');
  const cap = Buffer.alloc(4 * 1024 * 1024);
  readSync(fd, cap, 0, cap.length, 0);
  const { le, big, off } = deschideTiff(cap);

  const niveluri = [];
  let d = citesteIfd(cap, off, le, 0, big), i = 0;
  const pasBaza = d.valori(33550)[0];
  const tp = d.valori(33922);
  const x0 = tp[3], y0 = tp[4];
  const latimeBaza = d.scalar(256);
  while (d && i < 12) {
    niveluri.push({ nivel: i, d, pas: pasBaza * (latimeBaza / d.scalar(256)) });
    if (!d.urmator) break;
    d = citesteIfd(cap, d.urmator, le, 0, big);
    i++;
  }

  const ales = niveluri.find((n) => Math.abs(n.pas - pasDorit) < 1e-6);
  if (!ales)
    throw new Error(`ortofotoul n-are un nivel la ${pasDorit} m; are ${niveluri.map((n) => n.pas.toFixed(2)).join(', ')}`);

  const t = ales.d;
  const tabeleE = t.etichete.get(347);
  const tabele = Buffer.alloc(tabeleE ? tabeleE.nr : 0);
  if (tabeleE) readSync(fd, tabele, 0, tabele.length, tabeleE.date);

  return {
    fd, x0, y0, pas: ales.pas, nivel: ales.nivel, niveluri,
    w: t.scalar(256), h: t.scalar(257),
    tw: t.scalar(322), th: t.scalar(323),
    benzi: t.scalar(277),
    offsets: t.valori(324), octeti: t.valori(325),
    tabele,
  };
}

/**
 * O dală, decodată.
 *
 * Fiecare dală e un flux JPEG *prescurtat*: îi lipsește tabela de cuantizare,
 * care stă o singură dată în tag-ul JPEGTables, ca să nu se repete de 12600 de
 * ori. Se lipește înapoi imediat după marcajul SOI al dalei. Cu
 * PlanarConfiguration = 2 fiecare bandă are dalele ei, deci fiecare flux e o
 * imagine cu un singur canal — fără subeșantionare de crominanță.
 */
function citesteDala(o, banda, tx, ty) {
  const nx = Math.ceil(o.w / o.tw), ny = Math.ceil(o.h / o.th);
  const idx = banda * nx * ny + ty * nx + tx;
  const n = o.octeti[idx];
  if (!n) return null;
  const brut = Buffer.alloc(n);
  readSync(o.fd, brut, 0, n, o.offsets[idx]);
  const flux = o.tabele.length
    ? Buffer.concat([brut.subarray(0, 2), o.tabele.subarray(2, o.tabele.length - 2), brut.subarray(2)])
    : brut;
  const img = jpeg.decode(flux, { useTArray: true });
  // jpeg-js dă RGBA chiar și pentru o imagine cu un singur canal; luăm primul.
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) out[i] = img.data[i * 4];
  return { date: out, w: img.width, h: img.height };
}

/** Citește o fereastră dreptunghiulară dintr-o bandă, în pixeli ai nivelului. */
function fereastra(o, banda, c0, r0, lat, inalt) {
  const out = new Uint8Array(lat * inalt);
  const txMin = Math.floor(c0 / o.tw), txMax = Math.floor((c0 + lat - 1) / o.tw);
  const tyMin = Math.floor(r0 / o.th), tyMax = Math.floor((r0 + inalt - 1) / o.th);
  for (let ty = tyMin; ty <= tyMax; ty++)
    for (let tx = txMin; tx <= txMax; tx++) {
      const d = citesteDala(o, banda, tx, ty);
      if (!d) continue;
      const px0 = tx * o.tw, py0 = ty * o.th;
      const x1 = Math.max(c0, px0), x2 = Math.min(c0 + lat, px0 + d.w);
      const y1 = Math.max(r0, py0), y2 = Math.min(r0 + inalt, py0 + d.h);
      for (let y = y1; y < y2; y++)
        for (let x = x1; x < x2; x++)
          out[(y - r0) * lat + (x - c0)] = d.date[(y - py0) * d.w + (x - px0)];
    }
  return out;
}

// ------------------------------------------------------------------- OKLab

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gama = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function laOklab(R, G, B) {
  const r = linear(R / 255), g = linear(G / 255), b = linear(B / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function dinOklab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map((c) => Math.round(Math.min(255, Math.max(0, gama(Math.min(1, Math.max(0, c))) * 255))));
}

const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

function cuantila(v, q) {
  const s = Float64Array.from(v).sort();
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

// --------------------------------------------------------------------- main

const main = () => {
  cereDirector(DIR, 'dala de ortofoto DGT (.tif)',
           'Colecția ORTOS-2025 de la cdd.dgterritorio.gov.pt; descărcarea cere cont.');
  const fisiere = readdirSync(DIR).filter((f) => /\.tif{1,2}$/i.test(f));
  if (!fisiere.length) throw new Error(`niciun .tif în ${DIR}`);
  if (fisiere.length > 1) console.log(`${fisiere.length} fișiere, îl folosesc pe ${fisiere[0]}`);

  const harta = incarcaHarta(HARTA);
  const o = deschideOrtofoto(join(DIR, fisiere[0]), harta.pas);

  console.log(`ortofoto: ${fisiere[0]}`);
  console.log(`  piramidă: ${o.niveluri.map((n) => n.pas.toFixed(2) + ' m').join(' · ')}`);
  console.log(`  ales nivelul ${o.nivel}, ${o.pas} m/px — pasul lui ${HARTA}`);
  console.log(`  colț TM06: ${o.x0}, ${o.y0}   dale ${o.tw}×${o.th}, ${o.benzi} benzi\n`);

  // Alinierea. Dacă decalajul nu iese întreg, grilele nu se potrivesc și orice
  // culoare ar fi deplasată cu o fracțiune de celulă — mai bine oprim.
  const b = harta.bbox;
  const fc0 = (b.xMin - o.x0) / o.pas, fr0 = (o.y0 - b.yMax) / o.pas;
  if (Math.abs(fc0 - Math.round(fc0)) > 1e-6 || Math.abs(fr0 - Math.round(fr0)) > 1e-6)
    throw new Error(`grilele nu se aliniază: decalaj ${fc0.toFixed(3)}, ${fr0.toFixed(3)} pixeli`);
  const c0 = Math.round(fc0), r0 = Math.round(fr0);
  console.log(`aliniere: decalaj ${c0} × ${r0} pixeli, exact — fără reeșantionare`);

  const W = harta.w, H = harta.h;
  if (c0 < 0 || r0 < 0 || c0 + W > o.w || r0 + H > o.h)
    throw new Error(`${HARTA} iese din ortofoto`);

  process.stdout.write(`citesc ${W}×${H} px din 4 benzi `);
  const banda = [];
  for (let i = 0; i < 4; i++) { banda.push(fereastra(o, i, c0, r0, W, H)); process.stdout.write('.'); }
  const alfa = o.benzi >= 5 ? fereastra(o, 4, c0, r0, W, H) : null;
  console.log(' gata\n');
  closeSync(o.fd);

  // Conturul hărții, în TM06, ca să nu măsurăm marea din colțurile cutiei.
  const contur = harta.meta.poligon_geo.map((p) => laTM06(p.lon, p.lat));

  const clase = {
    vegetatie: [], roca: [],
    vegetatie_umbra: [], roca_umbra: [],
  };
  let nrApa = 0, nrAfara = 0, nrFaraDate = 0;
  const histNdvi = new Int32Array(41);

  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (alfa && alfa[i] < 128) { nrFaraDate++; continue; }
      const x = harta.nodX(c), y = harta.nodY(r);
      if (!inPoligon(x, y, contur)) { nrAfara++; continue; }
      if (harta.esteApa(x, y)) { nrApa++; continue; }

      const R = banda[0][i], G = banda[1][i], B = banda[2][i], N = banda[3][i];
      const ndvi = (N + R) ? (N - R) / (N + R) : 0;
      histNdvi[Math.max(0, Math.min(40, Math.round((ndvi + 1) * 20)))]++;

      const lab = laOklab(R, G, B);
      const vegetal = ndvi >= PRAG_NDVI;
      // Umbra se separă, nu se amestecă: la fel ca la fotografii, albedoul se ia
      // din partea luminată, altfel iese materialul plus o dominantă rece.
      (vegetal ? clase.vegetatie : clase.roca).push({ lab, ndvi, R, G, B, N, x, y,
        panta: harta.pantaLa(x, y) ?? 0, alt: harta.laTM(x, y) });
    }

  const total = clase.vegetatie.length + clase.roca.length;
  console.log(`${total} celule de uscat în contur  (apă ${nrApa}, în afara conturului ${nrAfara}, fără date ${nrFaraDate})\n`);

  console.log('histograma indicelui de vegetație (NDVI), pe celule de uscat:');
  for (let k = 0; k <= 40; k += 2) {
    const n = histNdvi[k] + (histNdvi[k + 1] ?? 0);
    if (!n) continue;
    const v = (k / 20 - 1).toFixed(1);
    console.log('  ' + v.padStart(5) + ' ' + '█'.repeat(Math.max(1, Math.round(60 * n / total))) + ' ' + (100 * n / total).toFixed(1) + '%');
  }
  console.log(`  pragul folosit: ${PRAG_NDVI}\n`);

  // Distribuțiile după care se aleg pragurile de mai jos. Le tipărim ca să se
  // vadă că nu sunt scoase din burtă.
  const cuart = (v, q) => cuantila(v, q).toFixed(3);
  const panteVeg = clase.vegetatie.map((p) => p.panta), panteRoca = clase.roca.map((p) => p.panta);
  const ndviVeg = clase.vegetatie.map((p) => p.ndvi);
  const grade = (p) => (Math.acos(Math.max(-1, 1 - p)) * 180 / Math.PI).toFixed(0) + '°';
  console.log('distribuții, pe cuartile:');
  console.log(`  NDVI în vegetație : ${cuart(ndviVeg, 0.25)} · ${cuart(ndviVeg, 0.5)} · ${cuart(ndviVeg, 0.75)}`);
  console.log(`  panta în vegetație: ${grade(cuantila(panteVeg, 0.25))} · ${grade(cuantila(panteVeg, 0.5))} · ${grade(cuantila(panteVeg, 0.75))}`);
  console.log(`  panta în rocă     : ${grade(cuantila(panteRoca, 0.25))} · ${grade(cuantila(panteRoca, 0.5))} · ${grade(cuantila(panteRoca, 0.75))}\n`);

  // Cele patru materiale, despărțite după infraroșu și pantă.
  //
  // Pragurile sunt cuartilele de mai sus, nu cifre alese de mine: mediana NDVI a
  // vegetației desparte tufărișul viu de vegetația uscată (planta uscată reflectă
  // mai puțin în infraroșu), iar cuartila 3 a pantei rocii desparte faleza de
  // solul de pe platou. Așa pragul se mută singur dacă se schimbă zona.
  const PRAG_VERDE = cuantila(ndviVeg, 0.5);
  const PRAG_PANTA = cuantila(panteRoca, 0.75);
  console.log(`praguri derivate: NDVI verde/uscat ${PRAG_VERDE.toFixed(3)}, pantă faleză/platou ${grade(PRAG_PANTA)}\n`);

  const patru = {
    tufaris: clase.vegetatie.filter((p) => p.ndvi >= PRAG_VERDE),
    vegetatie_uscata: clase.vegetatie.filter((p) => p.ndvi < PRAG_VERDE),
    calcar: clase.roca.filter((p) => p.panta >= PRAG_PANTA),
    poteca: clase.roca.filter((p) => p.panta < PRAG_PANTA),
  };

  const rezultat = {};
  for (const [nume, ps] of Object.entries({ ...patru, vegetatie: clase.vegetatie, roca: clase.roca })) {
    if (!ps.length) continue;
    const L = ps.map((p) => p.lab[0]);
    const lumina = cuantila(L, 0.8), median = cuantila(L, 0.5);
    const sus = ps.filter((p) => p.lab[0] >= median);
    const A = sus.reduce((s, p) => s + p.lab[1], 0) / sus.length;
    const B2 = sus.reduce((s, p) => s + p.lab[2], 0) / sus.length;
    const albedo = dinOklab([lumina, A, B2]);
    rezultat[nume] = {
      culoare: hex(albedo), rgb: albedo,
      croma: +Math.hypot(A, B2).toFixed(4),
      oklab: { L: +lumina.toFixed(4), a: +A.toFixed(4), b: +B2.toFixed(4) },
      ndvi_median: +cuantila(ps.map((p) => p.ndvi), 0.5).toFixed(3),
      celule: ps.length,
      parte: +(ps.length / total).toFixed(4),
      panta_mediana: +cuantila(ps.map((p) => p.panta), 0.5).toFixed(4),
      altitudine_mediana: +cuantila(ps.map((p) => p.alt), 0.5).toFixed(1),
    };
  }

  console.log(' material          culoare   croma   NDVI   pantă  altitudine  parte');
  console.log(' ───────────────── ───────── ─────── ────── ────── ─────────── ──────');
  for (const k of ['tufaris', 'vegetatie_uscata', 'calcar', 'poteca', 'vegetatie', 'roca']) {
    const v = rezultat[k];
    if (!v) continue;
    if (k === 'vegetatie') console.log(' ── clasele-părinte, pentru control ──');
    console.log(` ${k.padEnd(17)} ${v.culoare}  ${v.croma.toFixed(4)}  ${v.ndvi_median.toFixed(3).padStart(6)} `
      + ` ${(Math.acos(Math.max(-1, 1 - v.panta_mediana)) * 180 / Math.PI).toFixed(0).padStart(4)}°  `
      + `${v.altitudine_mediana.toFixed(0).padStart(8)} m ${(100 * v.parte).toFixed(1).padStart(6)}%`);
  }

  // Comparația cu fotografiile: acolo unde cele două se despart, diferența spune
  // ceva despre drumul luminii, nu despre teren.
  try {
    const poze = JSON.parse(readFileSync(join(PALETA_POZE, 'paleta-teren.json'), 'utf8')).materiale;
    console.log('\n fotografii de la sol  vs  ortofoto de sus');
    console.log(' ───────────────────────────────────────────');
    for (const k of ['calcar', 'poteca', 'vegetatie_uscata', 'tufaris']) {
      if (!poze[k] || !rezultat[k]) continue;
      const a = poze[k], b2 = rezultat[k];
      const dr = b2.rgb[0] - a.rgb[0], dg = b2.rgb[1] - a.rgb[1], db = b2.rgb[2] - a.rgb[2];
      const semn = (v) => (v >= 0 ? '+' : '') + v;
      console.log(` ${k.padEnd(17)} ${a.culoare} → ${b2.culoare}   R${semn(dr)} G${semn(dg)} B${semn(db)}`
        + `   croma ${a.masurat.croma.toFixed(3)} → ${b2.croma.toFixed(3)}`);
    }
  } catch { /* paleta din poze poate lipsi; ortofotoul stă singur în picioare */ }

  writeFileSync(join(IESIRE, 'ortofoto-culori.json'), JSON.stringify({
    generat: new Date().toISOString(),
    sursa: {
      nume: 'Ortofotomapa digital de Portugal Continental 2025, 25 cm',
      fisier: fisiere[0],
      producator: 'Direção-Geral do Território (DGT)',
      licenta: 'CC BY 4.0',
      atributie: 'Ortofotos: © Direção-Geral do Território, ORTOS-2025, CC BY 4.0',
      portal: 'https://cdd.dgterritorio.gov.pt/',
    },
    metoda: {
      harta: HARTA,
      nivel_piramida: o.nivel,
      rezolutie_m: o.pas,
      aliniere: `decalaj ${c0} × ${r0} pixeli față de colțul ortofotoului, număr întreg — fără reeșantionare`,
      clasificare: `NDVI = (NIR - roșu) / (NIR + roșu), prag ${PRAG_NDVI}`,
      albedo: 'cuantila 0,8 a luminozității; nuanța numai din celulele peste mediană',
    },
    clase: rezultat,
  }, null, 1));
  console.log(`\nscris ${join(IESIRE, 'ortofoto-culori.json')}`);
};

main();
