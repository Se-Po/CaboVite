#!/usr/bin/env node
// Sursele împrejurimilor: aduce din rețea, o singură dată, numai ferestrele de care
// au nevoie harta_v7 și harta_v8 — relieful Copernicus și fotografia Sentinel-2.
//
//   npm run surse-imprejurimi
//
// Tot ce vine se ține în date-sursa/copernicus/ și date-sursa/sentinel/, în afara
// depozitului, dală cu dală, așa cum a sosit — și itemii STAC ai scenelor. A doua
// rulare nu mai cere nimic din rețea. În depozit intră numai manifestul,
// scripts/imprejurimi/surse.json: ce fișiere, ce ferestre, ce scenă, câți octeți au
// dalele fiecărei ferestre — ca o construcție să se poată reface și să se știe exact
// ce s-a folosit. Cât a venit din rețea la prima descărcare se păstrează din
// manifestul de dinainte: o rulare de pe disc nu-l mai rescrie cu zerouri.
//
// Ce se aduce (autorul a aprobat, pe 2026-10-07, ~20–40 MB Copernicus și ~30–60 MB
// Sentinel):
//   - Copernicus GLO-30, dalele N38 W010 și N38 W009: relieful (DEM), masca de
//     umplere (FLM) și masca de apă (WBM), pe fereastra lui harta_v8;
//   - Sentinel-2 L2A, scena din 24.07.2025, cele patru dale MGRS: culoarea (TCI, 8
//     biți, trei benzi) la 10 m pe harta_v7 și la 80 m pe harta_v8; roșul și
//     infraroșul (B04, B08) la 20 m și 80 m, pentru NDVI; clasificarea scenei (SCL),
//     pentru nori și apă.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deschideCog, descarcat } from './comun/cog.mjs';
import { dinTM06, UTM29 } from './comun/tm06.mjs';
import {
  DALE_COPERNICUS, DALE_SENTINEL, NIVELURI, SCENA_SENTINEL,
  dirCopernicus, dirSentinel, idSentinel, urlCopernicus, urlSentinel,
} from './comun/imprejurimi.mjs';

const MARGINE = 600;   // m în jurul fiecărei grile: filtrele citesc și dincolo de margine
const MANIFEST = 'scripts/imprejurimi/surse.json';

/** Punctele de pe perimetrul unui dreptunghi TM06, cu margine — o proiecție nu duce dreptunghiuri în dreptunghiuri. */
function perimetru(r) {
  const x0 = r.x0 - MARGINE, x1 = r.x1 + MARGINE, y0 = r.y0 - MARGINE, y1 = r.y1 + MARGINE, p = [];
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    p.push([x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]);
  }
  return p;
}
const lonLat = (r) => {
  const g = perimetru(r).map(([x, y]) => dinTM06(x, y, null));
  return { lonMin: Math.min(...g.map((q) => q.lon)), lonMax: Math.max(...g.map((q) => q.lon)),
    latMin: Math.min(...g.map((q) => q.lat)), latMax: Math.max(...g.map((q) => q.lat)) };
};
const utm = (r) => {
  const u = perimetru(r).map(([x, y]) => { const g = dinTM06(x, y, null); return UTM29.inainte(g.lon, g.lat); });
  return { xMin: Math.min(...u.map((q) => q.x)), xMax: Math.max(...u.map((q) => q.x)),
    yMin: Math.min(...u.map((q) => q.y)), yMax: Math.max(...u.map((q) => q.y)) };
};

/**
 * Fereastra de pixeli (cu centrele în dreptunghi, plus un pixel de margine) a
 * nivelului k al unui COG, tăiată la raster. null dacă nu se ating.
 */
function fereastraPixeli(c, k, b) {
  const g = c.geometrie(k);
  const cA = Math.max(0, Math.floor((b.xMin - g.x0) / g.pasX) - 1), cB = Math.min(g.w - 1, Math.ceil((b.xMax - g.x0) / g.pasX) + 1);
  const rA = Math.max(0, Math.floor((g.y0 - b.yMax) / g.pasY) - 1), rB = Math.min(g.h - 1, Math.ceil((g.y0 - b.yMin) / g.pasY) + 1);
  if (cB < cA || rB < rA) return null;
  return { k, c0: cA, r0: rA, L: cB - cA + 1, H: rB - rA + 1, pas: [g.pasX, g.pasY] };
}

/** Aduce o fereastră (dalele ei ajung în cache) și spune câți octeți au venit acum. */
async function adu(et, url, dir, k, cutie, b = 0) {
  const inainte = descarcat.octeti;
  const c = await deschideCog(url, { dir });
  // Nivelul cerut se recunoaște după pas, nu după indice: piramidele diferă între benzi.
  const f = fereastraPixeli(c, k, cutie);
  if (!f) { console.log(`  ${et}: nu atinge fereastra`); return null; }
  const v = await c.fereastra(k, f.c0, f.r0, f.L, f.H, NaN, b);
  let fara = 0; for (const x of v) if (Number.isNaN(x)) fara++;
  const veniti = descarcat.octeti - inainte;
  console.log(`  ${et}: nivelul ${k} (${f.pas[0].toPrecision(3)}), ${f.L} × ${f.H} pixeli, ${(veniti / 1048576).toFixed(2)} MB acum`);
  // `octeti_dale`: mărimea dalelor care ating fereastra, din antet — aceeași la orice
  // rulare; `octeti_adusi` e numai ce a venit din rețea acum.
  return { url, nivel: k, pas: f.pas, fereastra: { c0: f.c0, r0: f.r0, latime: f.L, inaltime: f.H }, octeti_dale: c.octetiFereastra(k, f.c0, f.r0, f.L, f.H), octeti_adusi: veniti, pixeli_in_afara: fara };
}

/** Nivelul unui COG al cărui pas e cel cerut (± 1%). */
async function nivelCuPas(url, dir, pas) {
  const c = await deschideCog(url, { dir });
  for (let k = 0; k < c.niveluri.length; k++) if (Math.abs(c.geometrie(k).pasX / pas - 1) < 0.01) return k;
  throw new Error(`${url}: niciun nivel la ${pas} (are ${c.niveluri.map((_, k) => c.geometrie(k).pasX.toPrecision(3)).join(', ')})`);
}

const main = async () => {
  const manifest = { generat: new Date().toISOString(), copernicus: [], sentinel: { scena: SCENA_SENTINEL, dale: [] } };

  // ------------------------------------------------------------ Copernicus
  const g8 = lonLat(NIVELURI.harta_v8);
  const cutieGeo = { xMin: g8.lonMin, xMax: g8.lonMax, yMin: g8.latMin, yMax: g8.latMax };
  console.log(`Copernicus GLO-30, fereastra lui harta_v8: lon ${g8.lonMin.toFixed(4)} … ${g8.lonMax.toFixed(4)}, lat ${g8.latMin.toFixed(4)} … ${g8.latMax.toFixed(4)}`);
  for (const d of DALE_COPERNICUS)
    for (const aux of ['DEM', 'FLM', 'WBM']) {
      const r = await adu(`${d} ${aux}`, urlCopernicus(d, aux), dirCopernicus(d, aux), 0, cutieGeo);
      if (r) manifest.copernicus.push({ dala: d, strat: aux, ...r });
    }

  // ------------------------------------------------------------ Sentinel-2
  // Proprietățile scenei, de la catalogul STAC: baza de procesare și dacă decalajul
  // de reflectanță e deja aplicat în fișiere — fără ele NDVI-ul ar ieși greșit.
  const u7 = utm(NIVELURI.harta_v7), u8 = utm(NIVELURI.harta_v8);
  for (const g of DALE_SENTINEL) {
    const id = idSentinel(g);
    // Itemul STAC, ținut pe disc ca dalele: a doua rulare nu-l mai cere.
    const caleItem = `date-sursa/sentinel/${id}/item.json`;
    let item;
    if (existsSync(caleItem)) item = JSON.parse(readFileSync(caleItem, 'utf8'));
    else {
      const r = await fetch(`https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/${id}`);
      if (!r.ok) throw new Error(`STAC ${id}: HTTP ${r.status}`);
      item = await r.json();
      mkdirSync(`date-sursa/sentinel/${id}`, { recursive: true });
      writeFileSync(caleItem, JSON.stringify(item));
    }
    const p = item.properties;
    const intrare = {
      id, datetime: p.datetime, platforma: p.platform, nori_procent: p['eo:cloud_cover'],
      baza_procesare: p['s2:processing_baseline'], decalaj_boa_aplicat: p['earthsearch:boa_offset_applied'],
      epsg: p['proj:epsg'], scara_offset_red: item.assets.red?.['raster:bands']?.[0] ?? null, ferestre: [],
    };
    if (intrare.epsg !== 32629) throw new Error(`${id}: EPSG ${intrare.epsg}, aștept 32629`);
    console.log(`\n${id}: ${p.datetime}, nori ${p['eo:cloud_cover']}%, baza ${intrare.baza_procesare}, decalaj BOA aplicat: ${intrare.decalaj_boa_aplicat}`);
    const cereri = [
      ['TCI', 10, u7, 'culoarea, harta_v7'], ['B04', 20, u7, 'roșul, NDVI harta_v7'], ['B08', 20, u7, 'infraroșul, NDVI harta_v7'], ['SCL', 20, u7, 'clasificarea, harta_v7'],
      ['TCI', 80, u8, 'culoarea, harta_v8'], ['B04', 80, u8, 'roșul, NDVI harta_v8'], ['B08', 80, u8, 'infraroșul, NDVI harta_v8'], ['SCL', 80, u8, 'clasificarea, harta_v8'],
    ];
    for (const [banda, pas, cutie, rost] of cereri) {
      const url = urlSentinel(g, banda), dir = dirSentinel(g, banda);
      const k = await nivelCuPas(url, dir, pas);
      const benzi = banda === 'TCI' ? [0, 1, 2] : [0];
      // TCI are trei benzi în aceleași dale: prima le aduce, celelalte le citesc de pe
      // disc. Octeții aduși se adună, ca să nu rămână cei ai ultimei benzi (zero).
      let rez = null, adusi = 0;
      for (const b of benzi) {
        const q = await adu(`${g} ${banda}${benzi.length > 1 ? `[${b}]` : ''} la ${pas} m`, url, dir, k, cutie, b);
        if (q) { rez = q; adusi += q.octeti_adusi; }
      }
      if (rez) intrare.ferestre.push({ banda, rost, ...rez, octeti_adusi: adusi });
    }
    manifest.sentinel.dale.push(intrare);
  }

  manifest.octeti_dale = [...manifest.copernicus, ...manifest.sentinel.dale.flatMap((d) => d.ferestre)].reduce((a, f) => a + f.octeti_dale, 0);
  manifest.octeti_adusi_la_rularea_asta = descarcat.octeti;
  manifest.cereri_la_rularea_asta = descarcat.cereri;
  // Prima descărcare rămâne cum a fost, oricâte rulări de pe disc ar urma.
  const vechi = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;
  manifest.prima_descarcare = vechi?.prima_descarcare
    ?? (vechi ? { data: vechi.generat, octeti: vechi.octeti_adusi_la_rularea_asta, cereri: vechi.cereri_la_rularea_asta }
      : { data: manifest.generat, octeti: descarcat.octeti, cereri: descarcat.cereri });
  mkdirSync('scripts/imprejurimi', { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(`\nadus din rețea la rularea asta: ${(descarcat.octeti / 1048576).toFixed(2)} MB în ${descarcat.cereri} cereri`);
  console.log(`scris ${MANIFEST}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
