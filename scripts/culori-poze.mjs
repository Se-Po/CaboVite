// Culorile măsurate în fotografiile din date-sursa/poze/.
//
//   npm run culori-poze
//
// Pasul care urmează după `citeste-poze`. Acolo am aflat unde stătea aparatul;
// aici aflăm ce culori a văzut. Rezultatul nu e o hartă colorată — e materia
// primă pentru culoareTeren() din src/scene/palette.js: culori reale, grupate,
// fiecare cu ce parte din cadru ocupă și în ce poze apare.
//
// Ce NU face: nu decide ce e fiecare culoare. Calcarul și o piatră de pe potecă
// pot avea același gri; marea și cerul, același albastru. Distincția cere ochi
// omenesc, așa că scriptul scoate o pagină de etichetat.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { pngDataUri } from './comun/png.mjs';
import { cereFisier } from './comun/cere.mjs';
import { laOklab } from './comun/oklab.mjs';

const DIR = 'date-sursa/poze';
const LAT_MIC = 220;    // pentru grupare: destul pentru culoare, 1/340 din pixeli
const LAT_MEDIU = 900;  // pentru decupaje: destul cât să se vadă textura
const K_POZA = 6;       // grupuri de culoare într-o poză
const K_TOTAL = 12;     // grupuri peste toate pozele
const DECUPAJ = 72;

// -------------------------------------------------------------------- OKLab
//
// Gruparea se face în OKLab, nu în RGB. În RGB distanța euclidiană nu seamănă cu
// cât de diferite par două culori: două verzuri depărtate numeric pot fi aproape
// identice pentru ochi, iar două griuri apropiate numeric, vizibil diferite.
// OKLab e construit tocmai ca distanța din el să corespundă percepției.
// Conversia stă în scripts/comun/oklab.mjs, comună cu ortofoto și paleta.

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/**
 * Generator pseudoaleator cu sămânță fixă (mulberry32).
 *
 * k-means++ are nevoie de hazard ca să-și aleagă centrele de pornire, dar cu
 * `Math.random()` fiecare rulare dă alte grupuri. Asta strică tot ce se sprijină
 * pe ele: etichetele puse de om pe „grupul 5" ajung pe alt material la următoarea
 * rulare. Cu sămânță fixă, aceleași poze dau aceleași grupuri, mereu.
 */
function hazard(samanta = 20260802) {
  return () => {
    samanta |= 0; samanta = (samanta + 0x6d2b79f5) | 0;
    let t = Math.imul(samanta ^ (samanta >>> 15), 1 | samanta);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * k-means cu pornire k-means++.
 *
 * Pornirea contează: cu centre alese la întâmplare, două pot cădea în același
 * nor de culoare și un material întreg rămâne fără grup. k-means++ alege fiecare
 * centru nou cu probabilitate proporțională cu distanța față de cele deja alese.
 */
function kmeans(puncte, greutati, k, pasi = 24, samanta = 20260802) {
  const n = puncte.length;
  if (n <= k) return puncte.map((p, i) => ({ centru: p, membri: [i] }));

  const zar = hazard(samanta);
  const centre = [puncte[0]];
  const d = new Float64Array(n).fill(Infinity);
  while (centre.length < k) {
    const ultim = centre[centre.length - 1];
    let total = 0;
    for (let i = 0; i < n; i++) { d[i] = Math.min(d[i], dist2(puncte[i], ultim)); total += d[i] * greutati[i]; }
    let prag = zar() * total, ales = n - 1;
    for (let i = 0; i < n; i++) { prag -= d[i] * greutati[i]; if (prag <= 0) { ales = i; break; } }
    centre.push(puncte[ales]);
  }

  const atribuiri = new Int32Array(n).fill(-1);
  for (let pas = 0; pas < pasi; pas++) {
    let schimbat = false;
    for (let i = 0; i < n; i++) {
      let cel = 0, md = Infinity;
      for (let c = 0; c < centre.length; c++) {
        const dd = dist2(puncte[i], centre[c]);
        if (dd < md) { md = dd; cel = c; }
      }
      if (atribuiri[i] !== cel) { atribuiri[i] = cel; schimbat = true; }
    }
    for (let c = 0; c < centre.length; c++) {
      let s0 = 0, s1 = 0, s2 = 0, g = 0;
      for (let i = 0; i < n; i++) if (atribuiri[i] === c) {
        const w = greutati[i];
        s0 += puncte[i][0] * w; s1 += puncte[i][1] * w; s2 += puncte[i][2] * w; g += w;
      }
      if (g > 0) centre[c] = [s0 / g, s1 / g, s2 / g];
    }
    if (!schimbat) break;
  }

  const membri = centre.map(() => []);
  for (let i = 0; i < n; i++) membri[atribuiri[i]].push(i);
  return centre.map((centru, c) => ({ centru, membri: membri[c] }));
}

// ----------------------------------------------------------------- micșorare

/** Micșorare prin medie pe blocuri — nu prin eșantionare, care ar da zgomot. */
function micsoreaza(data, w, h, latNoua) {
  const k = Math.max(1, Math.round(w / latNoua));
  const W = Math.floor(w / k), H = Math.floor(h / k);
  const out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < k; j++)
        for (let i = 0; i < k; i++) {
          const p = ((y * k + j) * w + (x * k + i)) * 4;
          r += data[p]; g += data[p + 1]; b += data[p + 2];
        }
      const q = (y * W + x) * 3, nn = k * k;
      out[q] = r / nn; out[q + 1] = g / nn; out[q + 2] = b / nn;
    }
  return { data: out, w: W, h: H };
}

function decupeaza(img, cx, cy, lat) {
  const x0 = Math.max(0, Math.min(img.w - lat, cx - (lat >> 1)));
  const y0 = Math.max(0, Math.min(img.h - lat, cy - (lat >> 1)));
  const out = new Uint8Array(lat * lat * 3);
  for (let y = 0; y < lat; y++)
    for (let x = 0; x < lat; x++) {
      const s = ((y0 + y) * img.w + (x0 + x)) * 3, d = (y * lat + x) * 3;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2];
    }
  return out;
}

const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// Cod pentru mașină, text pentru om — și e o deosebire care s-a plătit deja.
// Pagina oferea numai textul, iar `paleta.mjs` cere codul fără diacritice
// (`tufaris`, nu `tufăriș verde`), pe care nu-l verifică nimeni: o etichetă
// necunoscută trece tăcut drept fundal. Se vede în `repere` din
// paleta-teren.json că omul a tradus manual, de mână. Acum nu mai are ce.
const ETICHETE = [
  { cod: 'calcar',           text: 'calcar' },
  { cod: 'tufaris',          text: 'tufăriș verde' },
  { cod: 'vegetatie_uscata', text: 'vegetație uscată' },
  { cod: 'poteca',           text: 'pământ / potecă' },
  { cod: 'mare',             text: 'mare' },
  { cod: 'cer',              text: 'cer' },
  { cod: 'plaja',            text: 'plajă / nisip' },
  { cod: 'umbra',            text: 'umbră' },
  { cod: 'altceva',          text: 'altceva' },
];

// --------------------------------------------------------------------- main

const main = () => {
  cereFisier(join(DIR, 'indice.json'), 'inventarul fotografiilor',
         'Rulează întâi: npm run citeste-poze');
  const indice = JSON.parse(readFileSync(join(DIR, 'indice.json'), 'utf8'));

  // O poziție GPS cu șapte cadre nu trebuie să cântărească de șapte ori mai mult
  // decât una cu unul singur: ar fi aceeași bucată de teren numărată de șapte ori.
  const laPozitie = new Map();
  for (const p of indice.poze) if (p.gps) {
    const k = `${p.gps.lon},${p.gps.lat}`;
    laPozitie.set(k, (laPozitie.get(k) ?? 0) + 1);
  }

  const petice = [];
  const miniaturi = [];

  // Chiar dacă inventarul e vechi și a prins ceva ce nu e fotografie, nu murim
  // pe el: `citesteExif` a scris deja formatul, deci știm exact ce sărim.
  const deDecodat = indice.poze.filter((p) => p.format === 'JPEG');
  if (deDecodat.length < indice.poze.length)
    console.log(`sar peste ${indice.poze.length - deDecodat.length} fișiere care nu sunt JPEG`);
  // Anunțul vine DUPĂ declarația pe care o citește. Mai sus, `deDecodat` era
  // în zona moartă temporală, iar scriptul murea cu ReferenceError înainte să
  // decodeze prima poză — cu lanțul întreg rupt la mijloc.
  process.stdout.write(`decodez ${deDecodat.length} poze `);
  for (const p of deDecodat) {
    const brut = jpeg.decode(readFileSync(join(DIR, p.fisier)), { useTArray: true, maxMemoryUsageInMB: 1024 });
    const mediu = micsoreaza(brut.data, brut.width, brut.height, LAT_MEDIU);
    const mic = micsoreaza(brut.data, brut.width, brut.height, LAT_MIC);
    const mini = micsoreaza(brut.data, brut.width, brut.height, 168);

    const puncte = new Array(mic.w * mic.h);
    const unu = new Float64Array(mic.w * mic.h).fill(1);
    for (let i = 0; i < puncte.length; i++)
      puncte[i] = laOklab(mic.data[i * 3], mic.data[i * 3 + 1], mic.data[i * 3 + 2]);

    const grupuri = kmeans(puncte, unu, K_POZA);
    // Fără fixare GPS, ponderea e 1. Poza măsoară culori la fel de bine, doar
    // că nu se știe unde — iar ponderea de mai sus există numai ca aceeași
    // bucată de teren să nu fie numărată de N ori pentru N cadre din același
    // loc. Fără poziție, n-are cu ce se dubla.
    const greutatePoza = p.gps
      ? 1 / (laPozitie.get(`${p.gps.lon},${p.gps.lat}`) ?? 1)
      : 1;
    const scara = mediu.w / mic.w;

    for (const g of grupuri) {
      if (!g.membri.length) continue;
      let r = 0, vv = 0, bb = 0, sy = 0;
      for (const i of g.membri) {
        r += mic.data[i * 3]; vv += mic.data[i * 3 + 1]; bb += mic.data[i * 3 + 2];
        sy += Math.floor(i / mic.w);
      }
      const n = g.membri.length;
      // Reprezentantul: membrul cel mai apropiat de centru, ca decupajul să arate
      // materialul, nu o margine între două materiale.
      let cel = g.membri[0], md = Infinity;
      for (const i of g.membri) { const dd = dist2(puncte[i], g.centru); if (dd < md) { md = dd; cel = i; } }

      petice.push({
        poza: p.fisier,
        rgb: [r / n, vv / n, bb / n],
        oklab: g.centru,
        inaltimeInCadru: (sy / n) / mic.h, // 0 = sus, 1 = jos
        greutate: (n / (mic.w * mic.h)) * greutatePoza,
        decupaj: pngDataUri(DECUPAJ, DECUPAJ, decupeaza(mediu,
          Math.round((cel % mic.w) * scara), Math.round(Math.floor(cel / mic.w) * scara), DECUPAJ)),
      });
    }

    miniaturi.push({
      poza: p.fisier, moment: p.moment, focala35: p.focala35_mm,
      uri: pngDataUri(mini.w, mini.h, mini.data),
    });
    process.stdout.write('.');
  }
  console.log('');

  const grupuri = kmeans(petice.map((p) => p.oklab), petice.map((p) => p.greutate), K_TOTAL)
    .filter((g) => g.membri.length)
    .map((g) => {
      const membri = g.membri.map((i) => petice[i]).sort((a, b) => b.greutate - a.greutate);
      const G = membri.reduce((s, m) => s + m.greutate, 0);
      return {
        culoare: hex([0, 1, 2].map((c) => membri.reduce((s, m) => s + m.rgb[c] * m.greutate, 0) / G)),
        rgb: [0, 1, 2].map((c) => Math.round(membri.reduce((s, m) => s + m.rgb[c] * m.greutate, 0) / G)),
        pondere: G,
        poze: [...new Set(membri.map((m) => m.poza))],
        inaltimeInCadru: membri.reduce((s, m) => s + m.inaltimeInCadru * m.greutate, 0) / G,
        decupaje: membri.slice(0, 6).map((m) => m.decupaj),
        // Peticele individuale, nu doar media lor. Media unui material fotografiat
        // și în soare, și în umbră nu e albedoul lui — e o valoare care nu există
        // nicăieri pe teren. Separarea se poate face doar având distribuția.
        petice: membri.map((m) => ({
          poza: m.poza,
          rgb: m.rgb.map((v) => Math.round(v)),
          oklab: m.oklab.map((v) => +v.toFixed(4)),
          greutate: +m.greutate.toFixed(5),
          inaltimeInCadru: +m.inaltimeInCadru.toFixed(3),
        })),
      };
    })
    .sort((a, b) => b.pondere - a.pondere);

  const total = grupuri.reduce((s, g) => s + g.pondere, 0);
  console.log(`\n${grupuri.length} grupuri de culoare peste ${indice.poze.length} poze:\n`);
  console.log('  #  culoare   parte  poze  în cadru');
  console.log(' ─── ───────── ────── ───── ────────');
  grupuri.forEach((g, i) => {
    const unde = g.inaltimeInCadru < 0.38 ? 'sus' : g.inaltimeInCadru > 0.62 ? 'jos' : 'mijloc';
    console.log(` ${String(i + 1).padStart(2)}. ${g.culoare} ${(100 * g.pondere / total).toFixed(1).padStart(6)}% `
      + `${String(g.poze.length).padStart(5)}  ${unde}`);
  });

  writeFileSync(join(DIR, 'culori.json'), JSON.stringify({
    generat: new Date().toISOString(),
    nota: 'Culori măsurate, negrupate pe materiale. Eticheta o dă omul, în culori.html.',
    grupuri: grupuri.map(({ decupaje, ...g }) => ({ ...g, pondere: +(g.pondere / total).toFixed(4) })),
  }, null, 1));

  writeFileSync(join(DIR, 'culori.html'), pagina(grupuri, miniaturi, total));
  console.log(`\nscris ${join(DIR, 'culori.json')}`);
  console.log(`scris ${join(DIR, 'culori.html')}`);
};

const pagina = (grupuri, miniaturi, total) => `<!DOCTYPE html>
<html lang="ro"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Culorile din poze</title>
<style>
 :root { --ink:#24211c; --bg:#f7f3ea; --gold:#94752f; }
 @media (prefers-color-scheme: dark) { :root { --ink:#e8e2d5; --bg:#1a1814; } }
 body { background:var(--bg); color:var(--ink); font:17px/1.6 Georgia, serif; margin:0; padding:24px 16px 64px; }
 .invelis { max-width:1000px; margin:0 auto; }
 h1 { font-size:1.6rem; margin:0 0 .3em; } h2 { font-size:1.15rem; margin:2.2em 0 .6em; }
 p { max-width:62ch; }
 .grup { display:flex; gap:16px; align-items:flex-start; padding:14px 0; flex-wrap:wrap;
         border-top:1px solid color-mix(in srgb, var(--ink) 18%, transparent); }
 .proba { width:88px; height:88px; border-radius:6px; flex:none; box-shadow:inset 0 0 0 1px rgba(0,0,0,.25); }
 .desp { flex:1 1 250px; min-width:0; }
 .nr { font-weight:bold; font-size:1.15rem; }
 .mic { font-size:.85rem; opacity:.78; }
 .decupaje { display:flex; gap:5px; flex-wrap:wrap; }
 .decupaje img { width:60px; height:60px; border-radius:4px; display:block; }
 select { font:inherit; font-size:.95rem; padding:5px 7px; border-radius:6px; margin-top:6px;
          background:var(--bg); color:var(--ink);
          border:1px solid color-mix(in srgb, var(--ink) 40%, transparent); }
 select:focus-visible { outline:3px solid var(--gold); outline-offset:2px; }
 .raspuns { width:100%; min-height:120px; font:14px/1.55 ui-monospace, monospace; padding:10px;
            border-radius:8px; background:var(--bg); color:var(--ink); box-sizing:border-box;
            border:1px solid color-mix(in srgb, var(--ink) 40%, transparent); }
 .galerie { display:flex; gap:8px; flex-wrap:wrap; }
 .galerie figure { margin:0; width:168px; }
 .galerie img { width:168px; border-radius:5px; display:block; }
 .galerie figcaption { font-size:.72rem; opacity:.7; }
</style></head><body><div class="invelis">
<h1>Culorile măsurate în cele ${miniaturi.length} poze</h1>
<p>Fiecare grup de mai jos e o culoare reală, mediată peste pozele în care apare.
Decupajele din dreapta sunt bucăți din fotografii, la mărimea lor, ca să se vadă
ce material e. Spune la fiecare ce e — din asta iese paleta hărții.</p>
${grupuri.map((g, i) => `
<div class="grup">
 <div class="proba" style="background:${g.culoare}"></div>
 <div class="desp">
  <div><span class="nr">${i + 1}.</span> <code>${g.culoare}</code></div>
  <div class="mic">${(100 * g.pondere / total).toFixed(1)}% din suprafața fotografiată ·
   ${g.poze.length} poze · spre ${g.inaltimeInCadru < 0.38 ? 'partea de sus' : g.inaltimeInCadru > 0.62 ? 'partea de jos' : 'mijlocul'} cadrului</div>
  <label class="mic">ce e: <select data-culoare="${g.culoare}">
   <option value="">— alege —</option>
   ${ETICHETE.map((e) => `<option value="${e.cod}">${e.text}</option>`).join('')}
  </select></label>
 </div>
 <div class="decupaje">${g.decupaje.map((d) => `<img src="${d}" alt="decupaj din fotografie">`).join('')}</div>
</div>`).join('')}

<h2>Răspunsul, de copiat în discuție</h2>
<textarea class="raspuns" readonly id="out">Alege etichetele de mai sus.</textarea>

<h2>Pozele, pentru context</h2>
<div class="galerie">${miniaturi.map((m) => `
 <figure><img src="${m.uri}" alt="${m.poza}"><figcaption>${m.moment?.slice(5) ?? ''} · ${m.focala35 ?? '?'} mm</figcaption></figure>`).join('')}</div>
</div>
<script>
 const out = document.getElementById('out');
 document.addEventListener('change', () => {
   // Răspunsul se cheie pe culoare, nu pe numărul grupului: numărul e doar
   // ordinea de afișare, iar culoarea e lucrul la care te-ai uitat efectiv.
   const r = [...document.querySelectorAll('select')]
     .filter((s) => s.value).map((s) => s.dataset.culoare + ' = ' + s.value);
   out.value = r.length ? r.join('\\n') : 'Alege etichetele de mai sus.';
 });
</script></body></html>`;

main();
