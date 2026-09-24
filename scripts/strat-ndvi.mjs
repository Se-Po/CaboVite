// Stratul NDVI al paginii: pe fiecare nod al hărții, cât de verde e în infraroșu.
//
//   npm run strat-ndvi [nume-hartă]        implicit harta_v1, plus baza ei
//
// De ce e nevoie de el. `culoareTeren()` primea numai panta și altitudinea, iar
// din ele nu se poate afla unde e vegetația: tufărișul și vegetația uscată au
// aceeași pantă mediană (14,1° față de 12,6°) și aceeași altitudine mediană
// (103,3 față de 103,4 m). Cea mai bună regulă posibilă pe cele două iese la
// întâmplare între ele, pe date nevăzute. Informația stă în banda de infraroșu a
// ortofotoului — iar dala de 283 MB nu intră în depozit, deci pagina primește
// NDVI-ul gata măsurat, într-un fișier mic, ca relieful.
//
// Scrie public/data/<nume>-ndvi.bin + .json. Un strat al aceleiași grile, nu o
// hartă nouă: același contur, aceeași rezoluție, aceleași noduri.
//
// Formatul, pe scurt — detaliile sunt scrise și în sidecar:
//   - 4 biți pe nod; nodul i în octetul i >> 1, pe jumătatea de JOS dacă i e par.
//     Rândul 0 e nordul, ca în -dem.bin.
//   - codul 0 = fără NDVI: apă, pixel fără date, sau nod pe care plasa nu-l
//     folosește. Codurile 1–15 = NDVI cuantizat, după tabelul `niveluri`.
//   - pagina decodează din tabelul din sidecar, nu dintr-o formulă scrisă în cod.
//
// De ce 15 niveluri și nu 255: pasul de 0,05 e cât zgomotul datelor citite. Pe
// harta_v0, NDVI-ul nivelului de 2 m diferă de media aceleiași imagini la 0,25 m
// cu mediana 0,014 și p90 0,040 — zgomotul de recomprimare al nivelului, nu al
// terenului. Un octet întreg l-ar stoca, cu +36% la transfer în loc de +13%
// (brotli, ca totalul tipărit la sfârșit).

import { closeSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { brotliCompressSync, constants as zlibC, gzipSync } from 'node:zlib';
import { PRAG_NDVI, aliniaza, cuantila, deschideOrtofoto, fereastra, fereastraMedie, ndvi } from './comun/ortofoto.mjs';
import { incarcaHarta } from './comun/relief.mjs';
import { inPoligon as inPoligonTM, laTM06 } from './comun/tm06.mjs';
import { cereDirector, cereFisier } from './comun/cere.mjs';
// Testul de poligon al PAGINII, nu al scripturilor: acoperirea stratului trebuie
// să cadă exact pe celulele pe care pagina le păstrează, deci același cod decide.
import { inPoligon } from '../src/scene/terrain.js';

const DIR = 'date-sursa/ortofoto';
const IESIRE = 'public/data';
const RAPORT_ORTOFOTO = join(DIR, 'ortofoto-culori.json');

/**
 * Tabelul de decodare: indicele e codul, valoarea e NDVI-ul.
 *
 * Pas 0,05 pe [−0,10; 0,60]. Regula de culoare n-are praguri tăiate, ci rampe
 * liniare între 0,017 (roca), 0,261 (vegetația uscată) și 0,410 (tufărișul), iar
 * NDVI-ul fațetei e media a trei noduri: punctele acestea nu trebuie să cadă pe
 * niveluri, și nici nu cad (cel mai departe e 0,017, la 0,017 de 0,00). Efectul
 * cuantizării e măsurat: 0,37 ΔE în medie, p99 1,95 — vezi palette.js. Sub −0,10
 * e oricum rocă goală, peste 0,60 oricum vegetație deasă: capetele se prind.
 * Rotunjit la două zecimale: fără asta, −0,10 + 0,05·3 iese 0,05000000000000002.
 */
const NIVELURI = [null, ...Array.from({ length: 15 }, (_, i) => +(-0.10 + 0.05 * i).toFixed(2))];

/** Codul nivelului cel mai apropiat; la egalitate câștigă cel de jos. */
function codeaza(v) {
  let k = 1, d = Math.abs(v - NIVELURI[1]);
  for (let j = 2; j <= 15; j++) {
    const e = Math.abs(v - NIVELURI[j]);
    if (e < d) { d = e; k = j; }
  }
  return k;
}

const sha = (b) => createHash('sha256').update(b).digest('hex');
const brotli = (b) => brotliCompressSync(b, { params: { [zlibC.BROTLI_PARAM_QUALITY]: 11 } }).length;

/** Cel mai grosier nivel de piramidă pe care nodurile hărții se aliniază exact. */
function deschideAliniat(cale, harta) {
  const prima = deschideOrtofoto(cale, 0.25);
  const pasi = prima.niveluri.map((n) => n.pas).filter((p) => p <= harta.pas + 1e-9).sort((a, b) => b - a);
  closeSync(prima.fd);
  const respinse = [];
  for (const p of pasi) {
    if (Math.abs(harta.pas / p - Math.round(harta.pas / p)) > 1e-9) continue;
    const o = deschideOrtofoto(cale, p);
    try {
      return { o, al: aliniaza(harta, o), respinse };
    } catch (e) {
      closeSync(o.fd);
      respinse.push(`${p} m`);
    }
  }
  throw new Error(`${harta.nume}: niciun nivel al ortofotoului nu se aliniază cu nodurile`);
}

/**
 * Care noduri primesc NDVI.
 *
 * La o hartă cu `poligon_scena` (baza): nodurile care sunt colț al unei celule cu
 * centrul în poligon — aceeași regulă după care pagina își păstrează celulele. Nu
 * se ține seama de gaura de sub petic și nici de tăietura de apă: stratul depinde
 * numai de datele hărții, nu de masca pe care o face azi pagina din ele.
 * La o hartă fără poligon (peticul): tot nodul.
 */
function acoperire(harta) {
  const { w, h, meta } = harta;
  const poli = meta.poligon_scena;
  const da = new Uint8Array(w * h);
  if (!Array.isArray(poli) || poli.length < 3) { da.fill(1); return { da, regula: 'tot uscatul' }; }
  // Aceleași coordonate de scenă ca în terrain.js: centrate pe grilă.
  const pasX = meta.pasX_m, pasZ = meta.pasZ_m;
  const X = (c) => (c - (w - 1) / 2) * pasX, Z = (r) => (r - (h - 1) / 2) * pasZ;
  for (let r = 0; r < h - 1; r++)
    for (let c = 0; c < w - 1; c++) {
      if (!inPoligon(X(c) + pasX / 2, Z(r) + pasZ / 2, poli)) continue;
      da[r * w + c] = da[r * w + c + 1] = da[(r + 1) * w + c] = da[(r + 1) * w + c + 1] = 1;
    }
  return { da, regula: 'nodurile de uscat ale celulelor cu centrul în poligon_scena' };
}

/** Citește R, NIR și alfa, calculează NDVI-ul pe nod și îl codează. */
function masoara(cale, harta) {
  const t0 = performance.now();
  const { o, al, respinse } = deschideAliniat(cale, harta);
  const { w, h } = harta;
  const R = fereastraMedie(o, 0, al.c0, al.r0, w, h, al.bloc);
  const N = fereastraMedie(o, 3, al.c0, al.r0, w, h, al.bloc);
  const A = o.benzi >= 5 ? fereastraMedie(o, 4, al.c0, al.r0, w, h, al.bloc) : null;

  const { da, regula } = acoperire(harta);
  const zApa = harta.meta.zMin_m + 0.01;
  const v = new Float32Array(w * h).fill(NaN);
  const coduri = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (harta.z[i] <= zApa || (A && A[i] < 128)) continue;
    v[i] = ndvi(R[i], N[i]);
    if (da[i]) coduri[i] = codeaza(v[i]);
  }
  const bin = new Uint8Array(Math.ceil((w * h) / 2));
  for (let i = 0; i < w * h; i++) bin[i >> 1] |= coduri[i] << ((i & 1) << 2);

  return { o, al, respinse, R, N, A, v, coduri, bin, regula, ms: performance.now() - t0 };
}

/**
 * Proba de control: clasificarea din ortofoto.mjs, refăcută pe NDVI-ul de aici,
 * trebuie să dea exact numerele din raportul lui. Dovedește că strat-ndvi citește
 * același nivel, aceeași fereastră și același NDVI ca ortofoto.mjs, și că raportul
 * e la zi. NU dovedește alinierea absolută: amândouă cheamă aliniaza() și
 * fereastra() din comun/, deci un decalaj comun le-ar da aceleași numere.
 * Alinierea bazei se sprijină pe aritmetică — nodul cade pe centrul pixelului,
 * decalajul 106 × 703 iese întreg —, nu pe proba asta.
 */
function probaClase(harta, m, raport) {
  const contur = harta.meta.poligon_geo.map((p) => laTM06(p.lon, p.lat));
  const veg = [], roca = [];
  for (let r = 0; r < harta.h; r++)
    for (let c = 0; c < harta.w; c++) {
      const i = r * harta.w + c;
      if (m.A && m.A[i] < 128) continue;
      const x = harta.nodX(c), y = harta.nodY(r);
      if (!inPoligonTM(x, y, contur) || harta.esteApa(x, y)) continue;
      const v = ndvi(m.R[i], m.N[i]);
      (v >= PRAG_NDVI ? veg : roca).push({ v, panta: harta.pantaLa(x, y) ?? 0 });
    }
  const pragVerde = cuantila(veg.map((p) => p.v), 0.5);
  const pragPanta = cuantila(roca.map((p) => p.panta), 0.75);
  const aici = {
    tufaris: veg.filter((p) => p.v >= pragVerde).length,
    vegetatie_uscata: veg.filter((p) => p.v < pragVerde).length,
    calcar: roca.filter((p) => p.panta >= pragPanta).length,
    poteca: roca.filter((p) => p.panta < pragPanta).length,
  };
  const acolo = Object.fromEntries(Object.keys(aici).map((k) => [k, raport.clase[k]?.celule]));
  const bun = Object.keys(aici).every((k) => aici[k] === acolo[k]);
  return { bun, aici, acolo, pragVerde };
}

/**
 * Proba de aliniere ABSOLUTĂ a peticului: față de bază, nu față de alt nivel al
 * ortofotoului calculat cu aceeași funcție — o greșeală comună de indice ar trece
 * de aceea nevăzută. Baza însăși nu e dovedită aici, ci prin aritmetică — vezi
 * probaClase. Proba de față prinde ce diferă între cele două: convenția de noduri
 * a peticului față de cea de muchii a bazei, nivelul și blocul.
 *
 * Nodurile peticului cad din doi în doi peste nodurile bazei. Pe cele comune, de
 * uscat în amândouă, NDVI-ul peticului se recalculează cu blocul mutat cu câte
 * un pixel de 0,5 m în fiecare direcție, și se corelează cu al bazei. Maximul
 * trebuie să cadă la (0, 0). Un prag fix n-ar merge: vecinii sunt la 0,003.
 */
function probaAliniere(petic, mp, baza, mb) {
  const M = 2, b = mp.al.bloc;
  const L = petic.w * b + 2 * M, H = petic.h * b + 2 * M;
  const R = fereastra(mp.o, 0, mp.al.c0 - M, mp.al.r0 - M, L, H);
  const N = fereastra(mp.o, 3, mp.al.c0 - M, mp.al.r0 - M, L, H);
  const perechi = [];
  for (let r = 0; r < petic.h; r++)
    for (let c = 0; c < petic.w; c++) {
      const cb = (petic.nodX(c) - baza.nodX(0)) / baza.pas, rb = (baza.nodY(0) - petic.nodY(r)) / baza.pas;
      if (Math.abs(cb - Math.round(cb)) > 1e-9 || Math.abs(rb - Math.round(rb)) > 1e-9) continue;
      const ib = Math.round(rb) * baza.w + Math.round(cb);
      if (Number.isNaN(mp.v[r * petic.w + c]) || Number.isNaN(mb.v[ib])) continue;
      perechi.push([r, c, mb.v[ib]]);
    }
  const grila = [];
  let max = { r: -Infinity };
  for (let sy = -2; sy <= 2; sy++)
    for (let sx = -2; sx <= 2; sx++) {
      let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (const [r, c, vb] of perechi) {
        let rs = 0, ns = 0;
        for (let y = 0; y < b; y++)
          for (let x = 0; x < b; x++) {
            const k = (M + r * b + sy + y) * L + M + c * b + sx + x;
            rs += R[k]; ns += N[k];
          }
        const va = ndvi(rs / (b * b), ns / (b * b));
        n++; sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
      }
      const cor = (sab - (sa * sb) / n) / Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n));
      // Estul e +x; nordul e în SUS, iar rândurile cresc spre sud.
      const cel = { est: sx * mp.o.pas, nord: -sy * mp.o.pas, r: cor };
      grila.push(cel);
      if (cor > max.r) max = cel;
    }
  return { perechi: perechi.length, grila, max, bun: max.est === 0 && max.nord === 0 };
}

/**
 * Dezacordul pe inelul exterior al peticului, unde cele două plase se ating.
 *
 * „Cod diferit" singur ar speria degeaba: cu pasul de 0,05, o diferență de
 * 0,016 schimbă codul ori de câte ori valoarea stă lângă o margine de nivel.
 * Ce s-ar vedea ca margine de culoare e un salt de DOUĂ niveluri sau mai mult.
 */
function cusatura(petic, mp, baza, mb) {
  const d = [];
  let alt = 0, doua = 0;
  for (let r = 0; r < petic.h; r++)
    for (let c = 0; c < petic.w; c++) {
      if (r > 0 && r < petic.h - 1 && c > 0 && c < petic.w - 1) continue;
      const cb = (petic.nodX(c) - baza.nodX(0)) / baza.pas, rb = (baza.nodY(0) - petic.nodY(r)) / baza.pas;
      if (Math.abs(cb - Math.round(cb)) > 1e-9 || Math.abs(rb - Math.round(rb)) > 1e-9) continue;
      const ip = r * petic.w + c, ib = Math.round(rb) * baza.w + Math.round(cb);
      if (Number.isNaN(mp.v[ip]) || Number.isNaN(mb.v[ib])) continue;
      d.push(Math.abs(mp.v[ip] - mb.v[ib]));
      const dk = Math.abs(codeaza(mp.v[ip]) - codeaza(mb.v[ib]));
      if (dk) alt++;
      if (dk >= 2) doua++;
    }
  return { noduri: d.length, mediana: cuantila(d, 0.5), p90: cuantila(d, 0.9),
    cod_diferit: alt / d.length, cod_diferit_2: doua / d.length };
}

function scrie(harta, m, fisier, verificari) {
  const cale = join(IESIRE, `${harta.nume}-ndvi`);
  // Un strat existent cu altă codare nu se suprascrie: pagina publicată l-ar
  // decoda cu tabelul nou. O codare nouă primește un nume nou.
  if (existsSync(cale + '.json')) {
    const vechi = JSON.parse(readFileSync(cale + '.json', 'utf8'));
    if (JSON.stringify(vechi.niveluri) !== JSON.stringify(NIVELURI))
      throw new Error(`${cale}.json există, cu alt tabel de niveluri. Nu-l suprascriu: dă stratului nou alt nume.`);
  }
  const pe = new Array(16).fill(0);
  for (const k of m.coduri) pe[k]++;
  const e = [];
  for (let i = 0; i < m.coduri.length; i++) if (m.coduri[i]) e.push(Math.abs(m.v[i] - NIVELURI[m.coduri[i]]));
  const meta = {
    nume: `${harta.nume}-ndvi`,
    harta: harta.nume,
    descriere: 'Indicele de vegetație (NDVI) pe fiecare nod al hărții, din ortofotoul DGT. '
      + 'Intră în culoarea terenului: spune unde e vegetație și cât de verde e.',
    generat: new Date().toISOString(),
    latime: harta.w,
    inaltime: harta.h,
    codare: {
      biti: 4,
      ordine: 'nodul i în octetul i >> 1: jumătatea de jos dacă i e par, cea de sus dacă e impar; rândul 0 = nord, ca în -dem.bin',
      santinela: 0,
      santinela_inseamna: 'fără NDVI: apă (z ≤ zMin_m + 0,01), pixel fără date (alfa < 128) sau nod pe care plasa nu-l folosește',
      decodare: 'NDVI = niveluri[cod]',
    },
    niveluri: NIVELURI,
    acoperire: m.regula,
    ortofoto: {
      nivel_piramida: m.o.nivel,
      pas_m: m.o.pas,
      bloc: m.al.bloc,
      decalaj_pixeli: { coloana: m.al.c0, rand: m.al.r0 },
      // Niveluri mai grosiere pe care amprenta nodului nu începe pe o margine de pixel.
      niveluri_respinse_m: m.respinse.map((s) => parseFloat(s)),
      ndvi: 'NDVI = (NIR − R) / (NIR + R), calculat DUPĂ media benzilor pe bloc — cum e construită și piramida',
    },
    numarate: {
      noduri: harta.w * harta.h,
      cu_ndvi: m.coduri.length - pe[0],
      pe_cod: pe,
      eroare_cuantizare: { medie: +(e.reduce((s, x) => s + x, 0) / e.length).toFixed(4), max: +e.reduce((a, x) => (x > a ? x : a), 0).toFixed(4) },
    },
    verificari,
    sursa: {
      nume: 'Ortofotomapa digital de Portugal Continental 2025, 25 cm',
      fisier,
      producator: 'Direção-Geral do Território (DGT)',
      licenta: 'CC BY 4.0',
      atributie: 'Indice de vegetație (NDVI) derivat din Ortofotos © Direção-Geral do Território, ORTOS-2025, CC BY 4.0',
      portal: 'https://cdd.dgterritorio.gov.pt/',
    },
  };
  writeFileSync(cale + '.bin', m.bin);
  writeFileSync(cale + '.json', JSON.stringify(meta, null, 1));
  return { cale, meta };
}

const main = () => {
  cereDirector(DIR, 'dala de ortofoto DGT (.tif)',
    'Colecția ORTOS-2025 de la cdd.dgterritorio.gov.pt; descărcarea cere cont.');
  cereFisier(RAPORT_ORTOFOTO, 'raportul ortofotoului, pentru proba de control', 'Rulează întâi: npm run ortofoto');
  const fisier = readdirSync(DIR).filter((f) => /\.tif{1,2}$/i.test(f))[0];
  if (!fisier) throw new Error(`niciun .tif în ${DIR}`);
  const cale = join(DIR, fisier);
  const raport = JSON.parse(readFileSync(RAPORT_ORTOFOTO, 'utf8'));

  const harta = incarcaHarta(process.argv[2] || 'harta_v1');
  const baza = harta.meta.baza ? incarcaHarta(harta.meta.baza) : null;
  const toate = baza ? [baza, harta] : [harta];

  const mas = new Map();
  for (const hh of toate) {
    const m = masoara(cale, hh);
    mas.set(hh.nume, m);
    console.log(`${hh.nume}: nivelul de ${m.o.pas} m, bloc ${m.al.bloc}×${m.al.bloc}, decalaj ${m.al.c0} × ${m.al.r0}`
      + (m.respinse.length ? `  (respinse: ${m.respinse.join('; ')})` : '') + `  — ${m.ms.toFixed(0)} ms`);
  }

  const verificari = new Map(toate.map((hh) => [hh.nume, {}]));

  // 1. Clasele de control, pe harta pe care s-a făcut raportul ortofotoului.
  const hc = toate.find((hh) => hh.nume === raport.metoda.harta);
  if (hc) {
    const p = probaClase(hc, mas.get(hc.nume), raport);
    console.log(`\nproba de clase pe ${hc.nume}: ${JSON.stringify(p.aici)}`);
    if (!p.bun) throw new Error(`clasele nu ies ca în ${RAPORT_ORTOFOTO}: ${JSON.stringify(p.acolo)}. Fereastra sau NDVI-ul diferă.`);
    console.log(`  identice cu ${RAPORT_ORTOFOTO}; pragul verde ${p.pragVerde}`);
    verificari.get(hc.nume).clase_ca_ortofoto = { ...p.aici, prag_verde: p.pragVerde };
  } else {
    console.log(`\nproba de clase sărită: raportul ortofotoului e pe ${raport.metoda.harta}`);
  }

  // 2. Alinierea absolută a peticului, și cusătura.
  if (baza) {
    const a = probaAliniere(harta, mas.get(harta.nume), baza, mas.get(baza.nume));
    console.log(`\nalinierea ${harta.nume} față de ${baza.nume}, pe ${a.perechi} noduri comune de uscat:`);
    const ep = [...new Set(a.grila.map((g) => g.est))];
    console.log('  nord \\ est ' + ep.map((x) => String(x).padStart(7)).join(''));
    for (const n of [...new Set(a.grila.map((g) => g.nord))].sort((x, y) => y - x))
      console.log('  ' + String(n).padStart(9) + ' ' + ep.map((x) => a.grila.find((g) => g.est === x && g.nord === n).r.toFixed(4).padStart(7)).join(''));
    if (!a.bun) throw new Error(`maximul corelației e la est ${a.max.est} m, nord ${a.max.nord} m — nu la (0, 0). Peticul e deplasat.`);
    console.log(`  maximul ${a.max.r.toFixed(4)} la (0, 0)`);
    verificari.get(harta.nume).aliniere_fata_de_baza = { noduri: a.perechi, corelatie_la_0: +a.max.r.toFixed(4), maxim_la: [0, 0] };

    const s = cusatura(harta, mas.get(harta.nume), baza, mas.get(baza.nume));
    console.log(`\ncusătura: ${s.noduri} noduri comune pe inel, |ΔNDVI| mediană ${s.mediana.toFixed(4)}, p90 ${s.p90.toFixed(4)}, `
      + `cod diferit la ${(100 * s.cod_diferit).toFixed(1)}%, cu două niveluri sau mai mult la ${(100 * s.cod_diferit_2).toFixed(2)}%`);
    verificari.get(harta.nume).cusatura = { noduri: s.noduri, mediana: +s.mediana.toFixed(4), p90: +s.p90.toFixed(4), cod_diferit: +s.cod_diferit.toFixed(4), cod_diferit_cu_2: +s.cod_diferit_2.toFixed(4) };
  }

  // 3. Scrierea, mărimile, amprentele.
  console.log('\n strat                  brut      gzip    brotli   relieful (brotli)  sha256');
  let tot = 0, totRelief = 0;
  for (const hh of toate) {
    const m = mas.get(hh.nume);
    const { cale: c } = scrie(hh, m, fisier, verificari.get(hh.nume));
    const rel = readFileSync(join(IESIRE, `${hh.nume}-dem.bin`));
    const br = brotli(m.bin), brRel = brotli(rel);
    tot += br; totRelief += brRel;
    console.log(` ${(hh.nume + '-ndvi').padEnd(18)} ${String(m.bin.length).padStart(9)} ${String(gzipSync(m.bin, { level: 9 }).length).padStart(9)} `
      + `${String(br).padStart(9)}   ${String(brRel).padStart(9)} (+${(100 * br / brRel).toFixed(1)}%)   ${sha(m.bin).slice(0, 16)}…`);
    closeSync(m.o.fd);
    console.log(`   scris ${c}.bin + .json`);
  }
  console.log(`\n în total, cu brotli: +${tot} octeți peste ${totRelief}, adică +${(100 * tot / totRelief).toFixed(1)}%`);
};

main();
