#!/usr/bin/env node
// Extrage relieful promontoriului Cabo Espichel din Copernicus DEM GLO-30
// și scrie un heightmap mic în public/data/. Zero dependențe: doar zlib din Node.
//
// De ce nu descărcăm tot: fișierul e un Cloud-Optimized GeoTIFF, împărțit în
// tile-uri de 1024×1024 indexate în antet. Fereastra noastră cade în două
// tile-uri, deci cerem doar acei octeți — ~850 KB în loc de 8,6 MB.
//
// Rulează: npm run fetch-dem
import { inflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { citesteIfd } from './comun/tiff.mjs';

const BAZA =
  'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N38_00_W010_00_DEM';
const URL_DEM = `${BAZA}/Copernicus_DSM_COG_10_N38_00_W010_00_DEM.tif`;
const URL_FLM = `${BAZA}/AUXFILES/Copernicus_DSM_COG_10_N38_00_W010_00_FLM.tif`;

// Fereastra, aleasă uitându-ne la datele reale: promontoriul se îngustează spre
// sud-vest, cu vârful pe la 38.411 / −9.220. O fereastră mai la sud ar fi fost
// două treimi mare goală.
const NORD = 38.44, SUD = 38.405, VEST = -9.232, EST = -9.185;

// Tile-ul acoperă 1°×1° la 1 arcsecundă, colțul stânga-sus la (−10, 39).
const REZ = 1 / 3600, LON0 = -10, LAT0 = 39, LAT_TILE = 3600, TILE = 1024;

// La 38.4°N o arcsecundă înseamnă mai puțin pe longitudine decât pe latitudine.
// Grila e anizotropă în indici și pătrată în metri — nu o „corecta" la celule
// pătrate, altfel promontoriul iese întins.
const M_PE_GRAD_LAT = 111320;
const PAS_Z = REZ * M_PE_GRAD_LAT;                                   // ~30,9 m N–S
const PAS_X = REZ * M_PE_GRAD_LAT * Math.cos(((NORD + SUD) / 2) * Math.PI / 180); // ~24,2 m E–V

// Ascuțirea falezei. Vezi comentariul de la ascuteFaleza().
const LAMBDA = 0.35, ITERATII = 3, PRAG_JOS = 8, PRAG_SUS = 20;
const ADANCIME_APA = -6; // vezi coboaraApa()

// Rampa de margine — metodă adusă înapoi din constructorul de 2 m.
//
// Nordul și estul ferestrei nu pot avea țărm natural: promontoriul continuă
// dincolo de ea. Un perete vertical de 160 m la marginea grilei arată ca o
// eroare de date. În loc de asta, terenul coboară lin la nivelul apei pe
// ultimele celule, ca marginea unei machete în relief. E convenție de
// prezentare, nu date — se consemnează în sidecar.
//
// Rampa se aplică pe toate patru laturile, dar asta e sigur doar cât timp
// uscatul stă mai departe de latura de apă decât lățimea rampei. La fereastra
// de acum uscatul începe la 35 de celule de marginea de vest și 16 de cea de
// sud, deci țărmul real rămâne neatins — verificat, nu presupus, și verificat
// din nou de fiecare rulare (vezi verificaRampa).
const RAMPA_MARGINE = 6; // celule: ~145 m est-vest, ~185 m nord-sud

// Masca de umplere (FLM), după Copernicus DEM Product Handbook v5.0, Tabelul 7.
// Doar valoarea 2 e măsurătoare TanDEM-X neatinsă; 3 și următoarele sunt goluri
// umplute din DEM-uri mai vechi și mai grosiere.
const FLM_LEGENDA = {
  0: 'gol (fără date)', 1: 'editat', 2: 'nemodificat (TanDEM-X brut)',
  3: 'umplut: ASTER', 4: 'umplut: SRTM90', 5: 'umplut: SRTM30',
  6: 'umplut: GMTED2010', 7: 'umplut: SRTM30plus',
  8: 'umplut: TerraSAR-X radargrametric', 9: 'umplut: AW3D30',
  100: 'umplut: Norway DEM', 101: 'umplut: DSM05 Spania', 102: 'umplut: Norway DEM v2',
};

async function ia(url, start, len) {
  const r = await fetch(url, { headers: { Range: `bytes=${start}-${start + len - 1}` } });
  if (!r.ok && r.status !== 206) throw new Error(`${url} → HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Antetul unui COG little-endian, cu dale (nu benzi, ca la DGT).
 *
 * Mersul prin IFD e comun cu cel al dalelor DGT si cu EXIF-ul pozelor; difera
 * doar ce se scoate din el. Aici ne trebuie tabelul de dale (324/325), ca sa
 * putem cere prin HTTP doar dalele care ne intereseaza, nu tot fisierul.
 */
function citesteAntet(buf) {
  if (buf.readUInt16LE(0) !== 0x4949) throw new Error('nu e TIFF little-endian');
  const d = citesteIfd(buf, buf.readUInt32LE(4));
  return {
    latime: d.scalar(256), inaltime: d.scalar(257), biti: d.scalar(258),
    compresie: d.scalar(259), predictor: d.scalar(317) ?? 1, tile: d.scalar(322),
    offsets: d.valori(324), octeti: d.valori(325),
  };
}

/**
 * Inversează predictorul TIFF 3 (virgulă mobilă) pentru un rând de float32.
 *
 * Formatul stochează octeții pe „plane": întâi octetul cel mai semnificativ al
 * tuturor eșantioanelor din rând, apoi al doilea, ș.a.m.d., fiecare codificat ca
 * diferență față de vecinul din stânga. Motivul e că exponenții unui teren vecin
 * seamănă mult între ei — separarea pe plane face datele compresibile. Fără
 * inversare, valorile ies de ordinul 1e38.
 */
function rand_f32(raw, r, latime) {
  const bps = 4, ro = latime * bps, row = Buffer.from(raw.subarray(r * ro, (r + 1) * ro));
  for (let i = 1; i < ro; i++) row[i] = (row[i] + row[i - 1]) & 0xff;
  const out = Buffer.allocUnsafe(ro);
  for (let j = 0; j < latime; j++)
    for (let k = 0; k < bps; k++) out[j * bps + (bps - 1 - k)] = row[k * latime + j]; // MSB întâi
  const f = new Float32Array(latime);
  for (let j = 0; j < latime; j++) f[j] = out.readFloatLE(j * 4);
  return f;
}

/** Predictorul 2 (orizontal) pe octeți — masca FLM e pe 8 biți. */
function rand_u8(raw, r, latime) {
  const row = Buffer.from(raw.subarray(r * latime, (r + 1) * latime));
  for (let i = 1; i < latime; i++) row[i] = (row[i] + row[i - 1]) & 0xff;
  return row;
}

async function decupeaza(url, antet, r0, r1, c0, c1, cititorRand) {
  const peRand = Math.ceil(antet.latime / antet.tile);
  const cache = new Map();
  const tileFor = async (idx) => {
    if (!cache.has(idx))
      cache.set(idx, inflateSync(await ia(url, antet.offsets[idx], antet.octeti[idx])));
    return cache.get(idx);
  };
  const tc = Math.floor(c0 / antet.tile);
  if (Math.floor(c1 / antet.tile) !== tc)
    throw new Error('fereastra traversează tile-uri pe orizontală — necesită alt cod');
  const randuri = [];
  for (let r = r0; r <= r1; r++) {
    const tr = Math.floor(r / antet.tile);
    const raw = await tileFor(tr * peRand + tc);
    randuri.push(cititorRand(raw, r - tr * antet.tile, antet.tile).slice(c0 - tc * antet.tile, c1 - tc * antet.tile + 1));
  }
  return { randuri, tileFolosite: cache.size };
}

/**
 * Ascute faleza, orizontal.
 *
 * Problema nu e că DEM-ul subestimează înălțimea — cei ~130 m sunt acolo. E că
 * tranziția e întinsă pe ~3 celule, ceea ce dă o pantă de ~60°: un deal abrupt,
 * nu un perete. Exagerarea verticală ar fi unealta greșită pe axa greșită: ar
 * face faleza de 340 m și ar umfla și platoul, care chiar e plat.
 *
 * În schimb mutăm tranziția pe orizontală, în interiorul celor ±15 m pe care
 * eșantionarea la 30 m îi lasă oricum nedeterminați:
 *   - unde terenul e convex (laplacian < 0) împingem spre vecinul mai înalt;
 *   - unde e concav, spre cel mai jos;
 *   - rezultatul se limitează ÎNTOTDEAUNA la intervalul vecinilor.
 *
 * Limitarea e cea care face operația onestă: nicio altitudine nouă nu apare în
 * grilă. Cota platoului și nivelul mării rămân exacte, deci „faleza are ~130 m"
 * continuă să fie adevărat. Poarta pe relief local lasă neatins ce e deja plat.
 */
function ascuteFaleza(g, w, h) {
  const idx = (r, c) => r * w + c;
  const poarta = new Float32Array(w * h); // calculată o dată, din grila originală
  for (let r = 1; r < h - 1; r++)
    for (let c = 1; c < w - 1; c++) {
      const v = [g[idx(r - 1, c)], g[idx(r + 1, c)], g[idx(r, c - 1)], g[idx(r, c + 1)]];
      const relief = Math.max(...v) - Math.min(...v);
      const t = Math.min(1, Math.max(0, (relief - PRAG_JOS) / (PRAG_SUS - PRAG_JOS)));
      poarta[idx(r, c)] = t * t * (3 - 2 * t); // smoothstep
    }
  let a = g;
  for (let it = 0; it < ITERATII; it++) {
    const b = Float32Array.from(a);
    for (let r = 1; r < h - 1; r++)
      for (let c = 1; c < w - 1; c++) {
        const p = poarta[idx(r, c)];
        if (p <= 0.001) continue;
        const hc = a[idx(r, c)];
        const N = a[idx(r - 1, c)], S = a[idx(r + 1, c)], E = a[idx(r, c + 1)], V = a[idx(r, c - 1)];
        const lap = N + S + E + V - 4 * hc;
        const lo = Math.min(N, S, E, V), hi = Math.max(N, S, E, V);
        const tinta = lap < 0 ? hi : lo;
        b[idx(r, c)] = Math.min(hi, Math.max(lo, hc + p * LAMBDA * (tinta - hc)));
      }
    a = b;
  }
  return a;
}

/**
 * Coboară celulele de apă sub zero.
 *
 * Copernicus pune oceanul la exact 0 m, iar planul mării din scenă stă tot la 0 —
 * cele două ar fi coplanare pe kilometri întregi și ar pâlpâi. Coborând apa,
 * planul mării capătă o albie, iar linia țărmului devine intersecția onestă a
 * terenului cu y = 0. Nu e o afirmație despre adâncimea reală: GLO-30 nu conține
 * batimetrie. Se consemnează ca atare în fișierul de metadate.
 */
function coboaraApa(g) {
  const out = Float32Array.from(g);
  for (let i = 0; i < out.length; i++) if (out[i] <= 0.5) out[i] = ADANCIME_APA;
  return out;
}

/**
 * Câte celule de uscat ating fiecare latură.
 *
 * Diagnosticul care spune, fără hartă, care margine e țărm adevărat și care e
 * doar capătul ferestrei: zero celule de uscat înseamnă că acolo chiar e mare.
 */
function marginiUscat(g, w, h) {
  const uscat = (i) => g[i] > 0.5;
  let nord = 0, sud = 0, vest = 0, est = 0;
  for (let c = 0; c < w; c++) {
    if (uscat(c)) nord++;
    if (uscat((h - 1) * w + c)) sud++;
  }
  for (let r = 0; r < h; r++) {
    if (uscat(r * w)) vest++;
    if (uscat(r * w + w - 1)) est++;
  }
  return { nord, sud, vest, est };
}

/**
 * Avertizează dacă rampa ar mânca țărm real.
 *
 * O latură fără nicio celulă de uscat e țărm adevărat. Dacă uscatul se apropie
 * totuși de ea mai mult decât lățimea rampei, atenuarea ar coborî coastă
 * măsurată — adică ar falsifica datele în loc să ascundă o tăietură.
 */
function verificaRampa(g, w, h, margini) {
  const uscat = (r, c) => g[r * w + c] > 0.5;
  let minC = Infinity, maxC = -1, minR = Infinity, maxR = -1;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++)
      if (uscat(r, c)) {
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
      }
  const distante = { nord: minR, sud: h - 1 - maxR, vest: minC, est: w - 1 - maxC };
  for (const [nume, d] of Object.entries(distante))
    if (margini[nume] === 0 && d < RAMPA_MARGINE)
      console.warn(`  ATENȚIE: ${nume} e țărm real, dar uscatul e la ${d} celule — rampa de ${RAMPA_MARGINE} l-ar coborî`);
  return distante;
}

/** Coboară lin marginile la nivelul apei. Vezi RAMPA_MARGINE. */
function atenueazaMargini(g, w, h) {
  const neted = (t) => t * t * (3 - 2 * t); // smoothstep
  const out = Float32Array.from(g);
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const d = Math.min(r, c, h - 1 - r, w - 1 - c);
      if (d >= RAMPA_MARGINE) continue;
      const k = neted(d / RAMPA_MARGINE);
      const i = r * w + c;
      out[i] = ADANCIME_APA + (out[i] - ADANCIME_APA) * k;
    }
  return out;
}

const main = async () => {
  const r0 = Math.round((LAT0 - NORD) / REZ), r1 = Math.round((LAT0 - SUD) / REZ);
  const c0 = Math.round((VEST - LON0) / REZ), c1 = Math.round((EST - LON0) / REZ);
  const w = c1 - c0 + 1, h = r1 - r0 + 1;
  console.log(`fereastră: ${w} × ${h} eșantioane (${(w * PAS_X / 1000).toFixed(2)} × ${(h * PAS_Z / 1000).toFixed(2)} km)`);

  const antetDem = citesteAntet(await ia(URL_DEM, 0, 65536));
  if (antetDem.compresie !== 8 || antetDem.predictor !== 3)
    throw new Error(`format DEM neașteptat: compresie ${antetDem.compresie}, predictor ${antetDem.predictor}`);
  const dem = await decupeaza(URL_DEM, antetDem, r0, r1, c0, c1, rand_f32);

  const flmBuf = Buffer.from(await (await fetch(URL_FLM)).arrayBuffer());
  const antetFlm = citesteAntet(flmBuf);
  const flm = await decupeaza(URL_FLM, antetFlm, r0, r1, c0, c1, rand_u8);

  const brut = new Float32Array(w * h);
  dem.randuri.forEach((row, r) => brut.set(row, r * w));
  const masca = {};
  flm.randuri.forEach((row) => row.forEach((v) => (masca[v] = (masca[v] || 0) + 1)));

  // reduce, nu Math.min(...): zeci de mii de argumente pe stivă e o cădere care
  // apare abia când cineva mărește fereastra
  const minim = (a) => a.reduce((m, v) => (v < m ? v : m), Infinity);
  const maxim = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);

  const zMinBrut = minim(brut), zMaxBrut = maxim(brut);
  const dupaApa = coboaraApa(ascuteFaleza(brut, w, h));

  const margini = marginiUscat(dupaApa, w, h);
  for (const [nume, n] of Object.entries(margini))
    console.log(`  margine ${nume.padEnd(5)}: ${n ? `${n} celule de uscat — tăiată, se atenuează` : 'numai apă — țărm real'}`);

  const distanteUscat = verificaRampa(dupaApa, w, h, margini);
  const prelucrat = atenueazaMargini(dupaApa, w, h);

  const zMin = minim(prelucrat), zMax = maxim(prelucrat);
  const scara = (zMax - zMin) / 65535;
  const u16 = new Uint16Array(w * h);
  for (let i = 0; i < u16.length; i++) u16[i] = Math.round((prelucrat[i] - zMin) / scara);

  await mkdir('public/data', { recursive: true });
  await writeFile('public/data/espichel-dem.bin', Buffer.from(u16.buffer));
  await writeFile(
    'public/data/espichel-dem.json',
    JSON.stringify(
      {
        descriere: 'Relief Cabo Espichel, din Copernicus DEM GLO-30. Uint16 little-endian, rând 0 = nord.',
        latime: w, inaltime: h,
        bbox: { nord: NORD, sud: SUD, vest: VEST, est: EST },
        pasX_m: +PAS_X.toFixed(3), pasZ_m: +PAS_Z.toFixed(3),
        zMin_m: +zMin.toFixed(2), zMax_m: +zMax.toFixed(2), zScara: scara,
        brut: { zMin_m: +zMinBrut.toFixed(2), zMax_m: +zMaxBrut.toFixed(2) },
        acoperire: {
          margini_uscat: margini,
          distanta_uscat_la_margine_celule: distanteUscat,
          nota: 'Numărul de celule de uscat care ating fiecare latură. Zero = țărm real; altceva = fereastra taie promontoriul.',
        },
        prelucrare: {
          ascutire: { algoritm: 'laplacian cu poartă pe relief, limitat la intervalul vecinilor',
                      lambda: LAMBDA, iteratii: ITERATII, prag_m: [PRAG_JOS, PRAG_SUS] },
          exagerare_verticala: 1.0,
          apa_coborata_la_m: ADANCIME_APA,
          margini_atenuate: {
            latime_celule: RAMPA_MARGINE,
            latime_m: [+(RAMPA_MARGINE * PAS_X).toFixed(0), +(RAMPA_MARGINE * PAS_Z).toFixed(0)],
            nota: 'Marginile tăiate de fereastră coboară lin la nivelul apei, ca marginea unei machete. Artificiu de prezentare, nu date.',
          },
          nota: 'Ascuțirea mută tranziția pe orizontală în limitele eșantionării de 30 m; nu introduce altitudini noi. Coborârea apei e un artificiu de randare — GLO-30 nu conține batimetrie.',
        },
        masca_umplere: {
          histograma: masca,
          legenda: FLM_LEGENDA,
          sursa_legenda: 'Copernicus DEM Product Handbook v5.0 (29.11.2022), cap. 1.2.5.2, Tabelul 7',
          nota: 'Valorile 3 și 5 NU sunt măsurători TanDEM-X, ci umpleri de goluri din ASTER, respectiv SRTM30 — surse mai grosiere. La Cabo Espichel ele se grupează pe muchia falezei. Gruparea e consistentă cu umbra radar pe pante abrupte, dar manualul nu afirmă asta. <!-- NEVERIFICAT: cauza golurilor -->',
        },
        atributie: {
          // Litera (b) din licență: forma cerută pentru date ADAPTATE sau MODIFICATE.
          // Noi generăm o plasă 3D din DEM, deci nu se aplică forma pentru date brute.
          obligatorie:
            'produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved',
          // Litera (c): obligatorie la distribuire publică. Poate fi tradusă.
          neraspundere:
            'The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30',
          licenta:
            'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf',
        },
        sursa: URL_DEM,
      },
      null, 2
    )
  );

  console.log(`tile-uri descărcate : ${dem.tileFolosite} (DEM) + ${flm.tileFolosite} (mască)`);
  console.log(`altitudine brută    : ${zMinBrut.toFixed(1)} .. ${zMaxBrut.toFixed(1)} m`);
  console.log(`după prelucrare     : ${zMin.toFixed(1)} .. ${zMax.toFixed(1)} m`);
  console.log(`histograma măștii   : ${JSON.stringify(masca)}`);
  console.log(`scris               : public/data/espichel-dem.bin (${(u16.byteLength / 1024).toFixed(1)} KB) + .json`);
};

main().catch((e) => { console.error('eșec:', e.message); process.exit(1); });
