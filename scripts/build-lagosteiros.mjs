#!/usr/bin/env node
// Coase dalele LiDAR ale DGT într-o grilă unică și decupează golful Lagosteiros.
//
// Sursa: Levantamento LiDAR de Portugal Continental 2024-2025 (DGT), MDT 2 m,
// 10 puncte/m², CC BY 4.0. Dalele sunt GeoTIFF float32 NECOMPRIMATE, în
// ETRS89 / Portugal TM06 (EPSG:3763) — proiecție metrică, deci celulele sunt
// pătrate de 2 m și nu mai avem anizotropia grilei WGS84.
//
// STARE: nelegat de pagină. Scena arată o singură hartă — promontoriul întreg,
// din Copernicus GLO-30 (scripts/fetch-dem.mjs). Scriptul, dalele din
// date-sursa/lidar/ și ieșirea din public/data/lagosteiros-dem.* rămân pe loc,
// pentru că metoda de aici e mai bună, doar zona e prea mică. Ca să reintre în
// pagină e nevoie de o singură schimbare: argumentele implicite ale lui
// incarcaRelief() din src/scene/loaders.js.
//
// Rulează: npm run build-lagosteiros
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { citesteTiffDGT, randTiff } from './comun/tiff.mjs';

const DIR = 'date-sursa/lidar';
const IESIRE = 'public/data';
const NODATA = -999;

// Fereastra, în metri TM06, centrată pe golful Lagosteiros.
//
// Golful l-am localizat în date, nu pe hartă: marea intră adânc între Y −138730
// (unde uscatul începe pe la X −95159) și Y −138886 (unde începe abia pe la
// X −94148). Prima încadrare era prea la est, pe zona Pedra da Mua / far.
//
// Marginile de vest și sud cad în apă — adică ies ca țărm real, nu ca tăietură.
const X_MIN = -95600, X_MAX = -94100;
const Y_MIN = -139300, Y_MAX = -138200;

// Est și nord nu pot avea margine naturală: promontoriul continuă dincolo de
// dalele existente, iar la vest de X −96000 pur și simplu nu există LiDAR (e
// mare). Un perete vertical de 140 m la marginea ferestrei arată ca o eroare,
// așa că terenul coboară lin la nivelul apei pe ultimii metri. E o convenție de
// prezentare, ca marginea unei machete în relief — consemnată în sidecar.
const RAMPA_MARGINE = 30; // celule, adică 60 m la rezoluția de 2 m

// Marea, în aceste date, NU e NODATA: LiDAR-ul o dă ca 0.0 m exact. Lăsată așa,
// devine o suprafață coplanară cu planul mării al scenei, pe sute de metri —
// adică z-fighting pe toată zona de apă (se vede ca dungi orizontale).
// O coborâm, ca planul mării să aibă albie și linia țărmului să fie intersecția
// onestă a terenului cu y = 0. Nu e o afirmație despre adâncime; batimetria
// vine separat, din EMODnet.
const ADANCIME_APA = -8;

// Marea e marcată ca exact 0.0 — nu „aproape zero". Verificat pe date: în dalele
// cu uscat există 2660 de celule între 0 și 1 m (plaja și zona de țărm), dar
// nicio valoare intermediară în dalele numai-apă. Deci testul de egalitate
// strictă separă apa de plajă, iar un prag mai lat (0,3 m) îneca plaja degeaba.
const esteApa = (v) => v === 0 || v <= NODATA + 1;


const main = () => {
  const fisiere = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.tif'));
  if (!fisiere.length) throw new Error(`niciun .tif în ${DIR}`);
  console.log(`${fisiere.length} dale găsite`);

  const dale = fisiere.map((f) => ({ nume: f, ...citesteTiffDGT(join(DIR, f)) }));
  const rez = dale[0].rezolutie;
  if (dale.some((d) => d.rezolutie !== rez)) throw new Error('dale cu rezoluții diferite');

  const w = Math.round((X_MAX - X_MIN) / rez);
  const h = Math.round((Y_MAX - Y_MIN) / rez);
  console.log(`fereastră: ${w} × ${h} = ${(w * h / 1e6).toFixed(2)} milioane eșantioane, la ${rez} m`);

  // Grila de ieșire: rândul 0 e nordul (Y maxim), ca la restul proiectului.
  const grila = new Float32Array(w * h).fill(NaN);
  let scrise = 0;

  for (const d of dale) {
    // Suprapunerea dintre dală și fereastră, în metri.
    const dx1 = d.x0, dx2 = d.x0 + d.latime * rez;
    const dy2 = d.y0, dy1 = d.y0 - d.inaltime * rez;
    if (dx2 <= X_MIN || dx1 >= X_MAX || dy2 <= Y_MIN || dy1 >= Y_MAX) continue;

    for (let r = 0; r < d.inaltime; r++) {
      const y = d.y0 - (r + 0.5) * rez;
      const gr = Math.floor((Y_MAX - y) / rez);
      if (gr < 0 || gr >= h) continue;
      const rand = randTiff(d, r);
      for (let c = 0; c < d.latime; c++) {
        const x = d.x0 + (c + 0.5) * rez;
        const gc = Math.floor((x - X_MIN) / rez);
        if (gc < 0 || gc >= w) continue;
        const v = rand[c];
        grila[gr * w + gc] = esteApa(v) ? NaN : v;
        scrise++;
      }
    }
    process.stdout.write('.');
  }
  console.log(`\n${scrise} celule scrise din dale`);

  // Diagnostic: cât din fereastră e uscat măsurat și cât e apă/gol.
  let uscat = 0, gol = 0, zmin = Infinity, zmax = -Infinity;
  for (const v of grila) {
    if (Number.isNaN(v)) gol++;
    else { uscat++; if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
  }
  console.log(`uscat măsurat : ${uscat} (${(100 * uscat / grila.length).toFixed(1)}%)`);
  console.log(`apă / fără date: ${gol} (${(100 * gol / grila.length).toFixed(1)}%) — mare (LiDAR dă 0.0 m), NODATA, sau în afara dalelor`);
  console.log(`altitudine    : ${zmin.toFixed(2)} .. ${zmax.toFixed(2)} m`);

  // Câte celule de uscat ating fiecare margine — spune care laturi sunt țărm
  // real și care sunt tăiate de fereastră.
  const peMargine = (indici) => indici.filter((i) => !Number.isNaN(grila[i])).length;
  const sus = [], jos = [], stanga = [], dreapta = [];
  for (let c = 0; c < w; c++) { sus.push(c); jos.push((h - 1) * w + c); }
  for (let r = 0; r < h; r++) { stanga.push(r * w); dreapta.push(r * w + w - 1); }
  const margini = { nord: peMargine(sus), sud: peMargine(jos), vest: peMargine(stanga), est: peMargine(dreapta) };
  for (const [nume, n] of Object.entries(margini))
    console.log(`  margine ${nume.padEnd(6)}: ${n ? `${n} celule de uscat — tăiată, se atenuează` : 'numai apă — țărm real'}`);

  // Golurile devin apă. Fără interpolare: o gaură în mijlocul uscatului ar fi o
  // problemă de date, nu ceva de umplut pe tăcute — o raportăm mai sus.
  const final = new Float32Array(grila.length);
  for (let i = 0; i < grila.length; i++) final[i] = Number.isNaN(grila[i]) ? ADANCIME_APA : grila[i];

  // Rampa de margine. Unde latura e deja apă nu schimbă nimic, deci se poate
  // aplica pe toate patru fără să strice țărmul real.
  const neted = (t) => t * t * (3 - 2 * t);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const d = Math.min(r, c, h - 1 - r, w - 1 - c);
      if (d >= RAMPA_MARGINE) continue;
      const k = neted(d / RAMPA_MARGINE);
      const i = r * w + c;
      final[i] = ADANCIME_APA + (final[i] - ADANCIME_APA) * k;
    }
  }

  const zMin = ADANCIME_APA, zMax = zmax;
  const scara = (zMax - zMin) / 65535;
  const u16 = new Uint16Array(grila.length);
  for (let i = 0; i < final.length; i++) u16[i] = Math.round((final[i] - zMin) / scara);

  mkdirSync(IESIRE, { recursive: true });
  writeFileSync(join(IESIRE, 'lagosteiros-dem.bin'), Buffer.from(u16.buffer));
  writeFileSync(join(IESIRE, 'lagosteiros-dem.json'), JSON.stringify({
    descriere: 'Golful Lagosteiros, Cabo Espichel. LiDAR DGT 2024-2025, MDT 2 m. Uint16 little-endian, rând 0 = nord.',
    latime: w, inaltime: h,
    crs: 'ETRS89 / Portugal TM06 (EPSG:3763)',
    bbox_tm06: { xMin: X_MIN, xMax: X_MAX, yMin: Y_MIN, yMax: Y_MAX },
    pasX_m: rez, pasZ_m: rez,
    zMin_m: +zMin.toFixed(2), zMax_m: +zMax.toFixed(2), zScara: scara,
    acoperire: {
      uscat_masurat: uscat, apa_sau_fara_date: gol,
      regula_apa: 'exact 0.0 m sau NODATA (-999); plaja, care are valori mici dar nenule, rămâne uscat',
      margini_uscat: margini,
      procent_masurat: +(100 * uscat / grila.length).toFixed(1),
    },
    prelucrare: {
      exagerare_verticala: 1.0,
      ascutire: 'niciuna',
      margini_atenuate: { latime_m: RAMPA_MARGINE * 2, nota: 'Marginile tăiate de fereastră coboară lin la nivelul apei, ca marginea unei machete. Artificiu de prezentare, nu date.' },
      nota: 'La 2 m faleza e măsurată direct. Ascuțirea folosită pe datele de 30 m ar falsifica măsurători reale, deci nu se aplică. Celulele fără date (apă) sunt coborâte la ' + ADANCIME_APA + ' m — artificiu de randare, nu batimetrie.',
    },
    sursa: {
      nume: 'Levantamento LiDAR de Portugal Continental 2024-2025 — Modelo Digital do Terreno 2 m',
      producator: 'Direção-Geral do Território (DGT)',
      densitate: '10 puncte/m²',
      licenta: 'CC BY 4.0',
      atributie: 'Dados LiDAR: © Direção-Geral do Território, Levantamento LiDAR de Portugal Continental 2024-2025, CC BY 4.0',
      portal: 'https://cdd.dgterritorio.gov.pt/',
      dale: fisiere,
    },
  }, null, 2));

  console.log(`scris: public/data/lagosteiros-dem.bin (${(u16.byteLength / 1048576).toFixed(2)} MB) + .json`);
};

main();
