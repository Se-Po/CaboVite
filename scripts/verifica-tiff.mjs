// Verifică decodorul LZW și predictorii din scripts/comun/lzw.mjs.
//
//   npm run verifica-tiff
//
// Nu scrie nimic. Rulează toate probele — o singură rulare arată tot ce a picat — și
// iese cu cod 1 dacă a picat vreuna. Probele pe date reale cer dalele din
// date-sursa/; fără ele se sar, cu mesaj, iar cele sintetice rulează oricum.
//
// De ce e nevoie de ea: un decodor LZW greșit nu aruncă neapărat. Cu regula de
// lățime din GIF în loc de cea din TIFF, fluxul se poate rupe abia la al 254-lea
// cod — sau poate trece, cu un relief deplasat pe bucăți. Deci codorul de mai jos,
// scris numai pentru probă, produce fluxuri cu ambele reguli, iar decodorul
// trebuie să le citească pe cea bună și să le refuze pe cea greșită.

import { existsSync } from 'node:fs';
import { anuleazaPredictor, decodeazaLzw } from './comun/lzw.mjs';
import { citesteTiffDGT } from './comun/tiff.mjs';

let picate = 0;
const proba = (bun, text) => {
  console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`);
  if (!bun) picate++;
};

// ------------------------------------------------------------ codorul de probă

/**
 * Codorul LZW din TIFF, după libtiff (LZWEncode): coduri MSB-first, Clear la
 * început și când tabelul ajunge la 4094, lățimea crește când următorul cod liber
 * trece de 2^lățime − 1. `devreme: false` mută creșterea cu un cod mai târziu,
 * ca în GIF — fluxul pe care decodorul NU trebuie să-l accepte.
 */
function codeazaLzw(date, { devreme = true } = {}) {
  const iesire = [];
  let acc = 0, nAcc = 0;
  const pune = (cod, lat) => {
    acc = (acc << lat) | cod;
    nAcc += lat;
    while (nAcc >= 8) { nAcc -= 8; iesire.push((acc >>> nAcc) & 0xff); }
    acc &= (1 << nAcc) - 1;
  };
  let dict = new Map(), liber = 258, lat = 9;
  const prag = () => (devreme ? (1 << lat) : (1 << lat) + 1);
  const dupaCod = () => {
    liber++;
    if (liber >= prag() && lat < 12) lat++;
  };
  pune(256, lat);
  let w = -1;
  for (const b of date) {
    if (w < 0) { w = b; continue; }
    const cheie = w * 256 + b;
    const c = dict.get(cheie);
    if (c !== undefined) { w = c; continue; }
    pune(w, lat);
    dict.set(cheie, liber);
    dupaCod();
    if (liber > 4094) { pune(256, lat); dict = new Map(); liber = 258; lat = 9; }
    w = b;
  }
  if (w >= 0) { pune(w, lat); dupaCod(); }
  pune(257, lat);
  if (nAcc) iesire.push((acc << (8 - nAcc)) & 0xff);
  return Uint8Array.from(iesire);
}

// Predictorii, în sensul în care îi aplică un scriitor — inversul lui anuleazaPredictor.
function aplicaPredictor2(u8, latime) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  for (let b = 0; b < u8.length; b += latime * 4)
    for (let i = latime - 1; i > 0; i--)
      dv.setUint32(b + i * 4, (dv.getUint32(b + i * 4, true) - dv.getUint32(b + (i - 1) * 4, true)) >>> 0, true);
  return u8;
}
function aplicaPredictor3(u8, latime) {
  const pr = latime * 4, tmp = new Uint8Array(pr);
  for (let b = 0; b < u8.length; b += pr) {
    for (let i = 0; i < latime; i++) for (let k = 0; k < 4; k++) tmp[(3 - k) * latime + i] = u8[b + i * 4 + k];
    for (let j = pr - 1; j > 0; j--) tmp[j] = (tmp[j] - tmp[j - 1]) & 0xff;
    u8.set(tmp, b);
  }
  return u8;
}

const egale = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const incearca = (f) => { try { return { r: f() }; } catch (e) { return { e }; } };

// ------------------------------------------------------------ probele sintetice

console.log('\nLZW, dus-întors cu codorul de probă');
{
  // Pseudo-aleator determinist: 64 KB umplu tabelul de mai multe ori, deci
  // trec prin Clear-ul din mijlocul fluxului, nu numai prin cel de la început.
  let s = 12345;
  const aleator = Uint8Array.from({ length: 65536 }, () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 16) & 0xff);
  const constant = new Uint8Array(40000);           // cazul KwKwK, la fiecare cod
  const scurt = Uint8Array.from([7]);                // un singur octet
  // Float32 cu o pantă lină: aproape ca un rând de relief.
  const panta = new Uint8Array(Float32Array.from({ length: 2000 }, (_, i) => 132 + i * 0.013).buffer);
  for (const [nume, date] of [['aleator 64 KB', aleator], ['constant 40 KB', constant], ['un octet', scurt], ['pantă float32', panta]]) {
    const flux = codeazaLzw(date);
    const { r, e } = incearca(() => decodeazaLzw(flux, date.length));
    proba(!e && egale(r, date), `${nume}: ${flux.length} octeți comprimați → ${e ? e.message : 'identic'}`);
  }

  // Controlul negativ: aceleași date, cu regula de lățime din GIF. Trebuie să
  // arunce sau să iasă altceva — altfel proba de mai sus n-ar dovedi regula.
  const flux = codeazaLzw(aleator, { devreme: false });
  const { r, e } = incearca(() => decodeazaLzw(flux, aleator.length));
  proba(Boolean(e) || !egale(r, aleator), `regula GIF (lățimea crește târziu) e refuzată: ${e ? e.message : 'iese altceva'}`);

  const trunchiat = codeazaLzw(aleator).subarray(0, 30000);
  proba(Boolean(incearca(() => decodeazaLzw(trunchiat, aleator.length)).e), 'un flux trunchiat aruncă');
  proba(Boolean(incearca(() => decodeazaLzw(codeazaLzw(panta), panta.length + 4)).e), 'o lungime așteptată greșită aruncă');
}

console.log('\nPredictorii, dus-întors');
{
  const latime = 500;
  const rand = new Uint8Array(Float32Array.from({ length: latime * 3 }, (_, i) => 100 + Math.sin(i / 7) * 3 - (i % latime) * 0.01).buffer);
  const p2 = anuleazaPredictor(aplicaPredictor2(rand.slice(), latime), latime, 4, 2);
  proba(egale(p2, rand), 'predictorul 2 pe 32 de biți, trei rânduri');
  const aplicat3 = aplicaPredictor3(rand.slice(), latime);
  proba(!egale(aplicat3, rand), 'predictorul 3 chiar schimbă octeții (altfel proba de mai jos n-ar dovedi nimic)');
  proba(egale(anuleazaPredictor(aplicat3, latime, 4, 3), rand), 'predictorul 3 (virgulă mobilă), trei rânduri');
  proba(Boolean(incearca(() => anuleazaPredictor(rand.slice(), latime, 4, 7)).e), 'un predictor necunoscut aruncă');
}

// ------------------------------------------------------------ probele pe date reale

const MDT50_105162 = 'date-sursa/lidar-50cm/MDT-50cm-105162-06-2024_v01.tif';
const MDT50_105163 = 'date-sursa/lidar-50cm/MDT-50cm-105163-06-2024_v01.tif';
const MDT2_105162 = 'date-sursa/lidar/MDT-2m-105162-06-2024_v01.tif';
const apa = (v) => v === -999 || v === 0;

if (![MDT50_105162, MDT50_105163, MDT2_105162].every(existsSync)) {
  console.log('\n(dalele MDT din date-sursa/ lipsesc — probele pe date reale se sar)');
} else {
  const m = citesteTiffDGT(MDT50_105162);
  const n = citesteTiffDGT(MDT50_105163);
  const d2 = citesteTiffDGT(MDT2_105162);

  console.log('\nAntetele');
  proba(m.compresie === 5, `${MDT50_105162.split('/').pop()}: LZW (compresie ${m.compresie}, predictor ${m.predictor})`);
  for (const [f, t] of [[MDT50_105162, m], [MDT50_105163, n], [MDT2_105162, d2]])
    proba(t.epsg === 3763 && t.tipRaster === 1 && t.nodata === '-999',
      `${f.split('/').pop()}: EPSG ${t.epsg}, PixelIsArea ${t.tipRaster === 1}, NoData ${t.nodata}, colț (${t.x0}, ${t.y0})`);

  // Toată dala se decodează: fiecare bandă iese la exact lungimea ei, altfel aruncă.
  console.log('\nDecodarea întregii dale LZW');
  const t0 = performance.now();
  const a = new Float32Array(m.latime * m.inaltime);
  const { e } = incearca(() => { for (let r = 0; r < m.inaltime; r++) a.set(m.rand(r), r * m.latime); });
  let valid = 0, uscat = 0;
  for (const v of a) { if (Number.isFinite(v) && (v === -999 || (v > -50 && v < 400))) valid++; if (!apa(v)) uscat++; }
  proba(!e && valid === a.length,
    `${m.inaltime} benzi în ${(performance.now() - t0).toFixed(0)} ms; ${valid} din ${a.length} valori în [−50; 400] sau NoData; ${uscat} de uscat${e ? ' — ' + e.message : ''}`);

  // Înregistrarea: media blocurilor 4 × 4 de uscat din dala de 50 cm, față de
  // pixelii dalei de 2 m, cu blocurile mutate cu (dx, dy). Minimul trebuie să
  // cadă la (0, 0), cu cifre de același ordin ca pe 105163 (0,097 m la (0, 0) și
  // 0,54 m la 1 m, build-zona.mjs). Un decodor care ar amesteca rândurile sau ar
  // deplasa octeții n-ar da minimul acolo.
  console.log('\nÎnregistrarea 50 cm ↔ 2 m pe 105162');
  if (m.x0 !== d2.x0 || m.y0 !== d2.y0) proba(false, 'dalele de 50 cm și de 2 m n-au același colț');
  const P = 4, randuri2 = Array.from({ length: d2.inaltime }, (_, r) => d2.rand(r));
  const rms = (dx, dy) => {
    let s = 0, k = 0;
    for (let r = 0; r < d2.inaltime; r += 3) for (let c = 0; c < d2.latime; c += 3) {
      const v2 = randuri2[r][c];
      if (apa(v2)) continue;
      const r0 = r * P + dy, c0 = c * P + dx;
      if (r0 < 0 || c0 < 0 || r0 + P > m.inaltime || c0 + P > m.latime) continue;
      let sum = 0, ok = true;
      for (let i = 0; i < P && ok; i++) for (let j = 0; j < P; j++) {
        const v = a[(r0 + i) * m.latime + c0 + j];
        if (apa(v)) { ok = false; break; }
        sum += v;
      }
      if (!ok) continue;
      s += (sum / 16 - v2) ** 2; k++;
    }
    return Math.sqrt(s / k);
  };
  let min = { v: Infinity };
  const tabel = [];
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const v = rms(dx, dy);
    if (v < min.v) min = { v, dx, dy };
    if (dy === 0 && (dx === 0 || dx === 2)) tabel.push(`${(dx / 2).toFixed(1)} m: ${v.toFixed(3)}`);
  }
  const la0 = rms(0, 0), la1m = rms(2, 0);
  proba(min.dx === 0 && min.dy === 0 && la0 < 0.2 && la1m > 2.5 * la0,
    `minimul RMS la (${min.dx / 2}, ${min.dy / 2}) m; ${tabel.join(', ')} — cerut (0, 0), sub 0,2 m, de 2,5 ori sub cel de la 1 m`);

  // Cusătura absolută: ultimul rând al dalei 105163 (brută) și primul al lui 105162
  // (LZW) sunt vecine la 0,5 m. Diferența dintre ele trebuie să fie ca între două
  // rânduri vecine din aceeași dală, nu mai mare — altfel una e deplasată față de
  // cealaltă, iar decodorul sau antetul ar fi de vină.
  console.log('\nCusătura 105163 (brută) | 105162 (LZW)');
  proba(n.x0 === m.x0 && n.y0 - n.inaltime * n.rezolutie === m.y0, `105163 se termină la y ${n.y0 - n.inaltime * n.rezolutie}, 105162 începe la ${m.y0}`);
  const difMedie = (u, v) => {
    let s = 0, k = 0;
    for (let i = 0; i < u.length; i++) if (!apa(u[i]) && !apa(v[i])) { s += Math.abs(u[i] - v[i]); k++; }
    return { d: s / k, k };
  };
  const ultim = n.rand(n.inaltime - 1), penultim = n.rand(n.inaltime - 2);
  const prim = m.rand(0), alDoilea = m.rand(1);
  const peste = difMedie(ultim, prim), in63 = difMedie(penultim, ultim), in62 = difMedie(prim, alDoilea);
  const inauntru = (in63.d + in62.d) / 2;
  proba(peste.d < 1.5 * inauntru,
    `peste cusătură ${peste.d.toFixed(3)} m (${peste.k} px), între rânduri vecine în dală ${inauntru.toFixed(3)} m — cerut sub 1,5×`);
}

console.log(picate ? `\n${picate} probe picate.` : '\nToate probele au trecut.');
process.exitCode = picate ? 1 : 0;
