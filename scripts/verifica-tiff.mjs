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

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anuleazaPredictor, decodeazaLzw } from './comun/lzw.mjs';
import { citesteTiffDGT } from './comun/tiff.mjs';
import { muta, NEAPLICATA, textLa, textSursa } from './comun/mutatii.mjs';
import { proba, rezumat, sari } from './comun/proba.mjs';

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
  sari('dalele MDT din date-sursa/ lipsesc, deci probele pe date reale');
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

// ------------------------------------------------------------ cusăturile lui harta_v9

// Patru dale ale lui harta_v9 au prea puține noduri plate ca proba față de GLO-30 să le judece:
// sidecarul le scrie NEVERIFICATE (`dale_fata_de_copernicus.neverificate`). Aici se judecă față de
// vecinele lor DGT, pe cusătură: pe fiecare rând (sau coloană) cu uscat în primii 6 pixeli de
// ambele părți, fără pixelul de margine — coloana exterioară a unei dale citește un gol de
// 2,6–3,6 m în loc de 2 (docs/harti-relief.md) —, treapta e = B₁ − A₁ − 3·ḡ, cu panta ḡ luată din
// pixelii 2–5, care nu intră în diferență. Numai rândurile cu aceeași pantă de ambele părți
// (|g_A − g_B| ≤ 0,3 m pe pixel): peste o vale sau o creastă care taie cusătura oblic,
// extrapolarea liniară greșește cu metri. Treapta cusăturii e mediana lui e, împrăștierea ei abaterea
// mediană față de ea (o vecină greșită poate avea treapta mică, dar împrăștierea de metri); o cusătură
// contează de la 50 de rânduri. Pragurile, 0,3 m și 0,5 m, se sprijină pe cusăturile dintre dalele
// verificate, măsurate la fel. Controale: dala neverificată ridicată și coborâtă cu 1 m, o vecină greșită.
// O deplasare de un pixel nu se poate judeca așa la 2 m: pe faleze curbura terenului o acoperă.
console.log('\nCusăturile lui harta_v9: dalele neverificate față de GLO-30, judecate față de vecinele lor');
{
  const sidecar = JSON.parse(readFileSync('public/data/harta_v9-dem.json', 'utf8'));
  const NEVER = sidecar.prelucrare.dale_fata_de_copernicus.neverificate.map((q) => q.dala);
  const { NIVELURI } = await import('./comun/imprejurimi.mjs');
  // 104xxx au colțul nealiniat și n-au uscat dincolo de alpha; harta_v9 le sare.
  const DALE = NIVELURI.harta_v9.dale.filter((d) => !d.startsWith('104'));
  const cale = (ind) => `date-sursa/lidar/MDT-2m-${ind}-06-2024_v01.tif`;
  const lipsa = DALE.filter((d) => !existsSync(cale(d)));
  if (lipsa.length) sari(`cusăturile lui harta_v9: lipsesc dale, ${lipsa.length} din ${DALE.length} (${lipsa.slice(0, 3).join(', ')}${lipsa.length > 3 ? ', …' : ''})`);
  else {
    const dala = new Map(DALE.map((ind) => {
      const t = citesteTiffDGT(cale(ind));
      const v = new Float32Array(t.latime * t.inaltime);
      for (let r = 0; r < t.inaltime; r++) v.set(t.rand(r), r * t.latime);
      return [ind, { ...t, v }];
    }));
    // Pătratul de 1 km al indicelui CCCRRR: x0 = (CCC − 200) km, colțul de nord y0 = (RRR − 300) km.
    const peGrila = [...dala].filter(([ind, t]) => t.x0 !== (+ind.slice(0, 3) - 200) * 1000 || t.y0 !== (+ind.slice(3) - 300) * 1000
      || t.latime !== 500 || t.inaltime !== 500 || t.rezolutie !== 2);
    proba(peGrila.length === 0, `cele ${DALE.length} de dale stau pe pătratele lor de 1 km, 500 × 500 la 2 m${peGrila.length ? `; altfel: ${peGrila.map(([i]) => i).join(', ')}` : ''}`);
    const uscat = (z) => z > 0.01 && z > -900;
    /** Treapta pe cusătura dintre A și B (B la est de A, sau la nord); `dz` ridică B. */
    const cusatura = (a, b, est, dz = 0) => {
      const A = dala.get(a), B = dala.get(b);
      if (!A || !B) return { n: 0, o: NaN };
      const e = [];
      for (let k = 0; k < 500; k++) {
        const pa = (i) => (est ? A.v[k * 500 + 499 - i] : A.v[i * 500 + k]);
        const pb = (i) => (est ? B.v[k * 500 + i] : B.v[(499 - i) * 500 + k]) + dz;
        const va = [1, 2, 3, 4, 5].map(pa), vb = [1, 2, 3, 4, 5].map(pb);
        if (!uscat(pa(0)) || !uscat(pb(0)) || !va.every(uscat) || !vb.every(uscat)) continue;
        const gA = (va[1] - va[4]) / 3, gB = (vb[4] - vb[1]) / 3;
        if (Math.abs(gA - gB) > 0.3) continue;
        e.push(vb[0] - va[0] - 3 * (gA + gB) / 2);
      }
      e.sort((x, y) => x - y);
      const o = e.length ? e[e.length >> 1] : NaN;
      const d = e.map((x) => Math.abs(x - o)).sort((x, y) => x - y);
      return { n: e.length, o, mad: d.length ? d[d.length >> 1] : NaN };
    };
    // Toate cusăturile dintre dale de pe disc: [A, B, est].
    const toate = DALE.flatMap((a) => {
      const c = +a.slice(0, 3), r = +a.slice(3);
      return [[`${c + 1}${r}`, true], [`${c}${r + 1}`, false]].filter(([b]) => dala.has(b)).map(([b, est]) => [a, b, est]);
    });
    const PRAG = 0.3, PRAG_MAD = 0.5, MIN = 50;
    const bun = (x) => Math.abs(x.o) <= PRAG && x.mad <= PRAG_MAD;
    const nume = ([a, b, est]) => `${a}|${b}${est ? '' : ' (N)'}`;
    const verificate = toate.filter(([a, b]) => !NEVER.includes(a) && !NEVER.includes(b)).map((p) => ({ p, ...cusatura(...p) })).filter((x) => x.n >= MIN);
    const maxRef = Math.max(...verificate.map((x) => Math.abs(x.o))), madRef = Math.max(...verificate.map((x) => x.mad));
    proba(verificate.length >= 10 && verificate.every(bun), `${verificate.length} cusături între dale verificate, cu cel puțin ${MIN} de rânduri: treapta cel mult ${maxRef.toFixed(3)} m, împrăștierea cel mult ${madRef.toFixed(3)} m (praguri ${PRAG} și ${PRAG_MAD})`);
    const ale = toate.filter(([a, b]) => NEVER.includes(a) || NEVER.includes(b)).map((p) => ({ p, ...cusatura(...p) }));
    const numarate = ale.filter((x) => x.n >= MIN);
    for (const ind of NEVER) {
      const ale_ = ale.filter((x) => x.p[0] === ind || x.p[1] === ind);
      const num = ale_.filter((x) => x.n >= MIN);
      const desc = ale_.map((x) => `${nume(x.p)} ${x.n} rânduri${x.n ? `, ${x.o >= 0 ? '+' : ''}${x.o.toFixed(3)} ± ${x.mad.toFixed(3)} m` : ''}`).join('; ');
      if (!num.length) console.log(`        ${ind}: rămâne neverificată, nicio cusătură cu ${MIN} de rânduri (${desc})`);
      else proba(num.every(bun), `${ind}: ${desc}`);
    }
    // Controale, pe cusăturile numărate.
    // dala neverificată mutată cu h metri: B ridicat cu h dacă ea e B, cu −h dacă e A
    const mutata = (h) => numarate.map((x) => cusatura(...x.p, NEVER.includes(x.p[1]) ? h : -h));
    for (const [h, ce] of [[1, 'ridicată'], [-1, 'coborâtă']]) {
      const m = mutata(h);
      proba(m.every((x) => !bun(x)), `control, dala neverificată ${ce} cu 1 m: treptele ${m.map((x) => x.o.toFixed(2)).join(', ')} m — pică pe toate cele ${m.length} cusături`);
    }
    // Vecina greșită: în locul vecinei de est a lui 106162 (107162), cea de deasupra ei (107163).
    const gresita = cusatura('106162', '107163', true);
    proba(!(gresita.n >= MIN && bun(gresita)), `control, 106162 cusută de 107163 în loc de 107162: ${gresita.n} rânduri, treapta ${Number.isFinite(gresita.o) ? `${gresita.o.toFixed(2)} ± ${gresita.mad.toFixed(2)}` : '—'} m — pică`);
  }
}

// ------------------------------------------------------------ build-zona, din dalele numite

// build-zona își numește dalele (`DALE`, `DALE_50`), nu ia tot ce e în date-sursa/lidar, unde
// stau și dalele altor hărți. `--proba` reface harta_v4 în memorie și o compară cu HEAD, ca blob
// git: trebuie să iasă identică la octet, .bin și .json. Dacă se sare o hotărăsc datele, nu
// ieșirea scriptului: dalele pe care le numește sidecarul lui harta_v4 din git (`sursa.dale`,
// `dale_sarite`, `corectii`), căutate pe disc. Cu ele pe disc, orice eșec al scriptului pică —
// și o listă DALE greșită. Controale: fără dala 106163 (`--proba-fara`) harta iese altfel; un
// nume greșit în DALE oprește proba; 106164 scoasă din DALE, dar lăsată pe disc, oprește scriptul.
console.log('\nbuild-zona: harta_v4 din dalele numite, identică la octet cu git');
{
  const sidecar = textLa('HEAD', 'public/data/harta_v4-dem.json');
  const m = sidecar === null ? null : JSON.parse(sidecar);
  const necesare = m === null ? [] : [...m.sursa.dale, ...m.dale_sarite.map((d) => d.dala), ...m.corectii.map((c) => c.dala)]
    .map((f) => (f.startsWith('MDT-50cm-') ? `date-sursa/lidar-50cm/${f}` : `date-sursa/lidar/${f}`));
  const lipsa = necesare.filter((f) => !existsSync(f));
  if (m === null) sari('build-zona --proba: sidecarul lui harta_v4 nu se poate citi din git');
  else if (lipsa.length) sari(`build-zona --proba: lipsesc ${lipsa.length} din cele ${necesare.length} dale ale lui harta_v4 (${lipsa.map((f) => f.split('/').pop()).slice(0, 3).join(', ')}${lipsa.length > 3 ? ', …' : ''})`);
  else {
    const ruleaza = (fisier, ...argumente) => {
      const r = spawnSync(process.execPath, [fisier, ...argumente], { encoding: 'utf8' });
      return { cod: r.status, iesire: `${r.stdout}${r.stderr}` };
    };
    // Rândul care spune ce s-a întâmplat: rezumatul probei, sau mesajul erorii, nu linia de cod din stivă.
    const motiv = (x) => x.iesire.match(/^(?:proba: |Error: )[^\n]*/m)?.[0] ?? `cod ${x.cod}`;
    // Scriptul schimbat, din text, cu importurile duse la scripts/comun.
    const mutat = (...perechi) => {
      const src = muta(textSursa('scripts/build-zona.mjs'), ...perechi);
      if (src === null) return null;
      const tmp = join(tmpdir(), `cabo-build-zona-${process.pid}.mjs`);
      writeFileSync(tmp, src.replace(/from '\.\/comun\/([^']+)'/g, (_, f) => `from '${new URL(`./comun/${f}`, import.meta.url).href}'`));
      try { return ruleaza(tmp, '--proba'); } finally { rmSync(tmp, { force: true }); }
    };
    const azi = ruleaza('scripts/build-zona.mjs', '--proba');
    proba(azi.cod === 0 && /^proba: harta_v4 iese identică la octet cu HEAD/m.test(azi.iesire) && (azi.iesire.match(/: identic la octet cu HEAD/g) ?? []).length === 2,
      `build-zona --proba, cu cele ${necesare.length} dale ale sidecarului pe disc: „${motiv(azi)}” (cod ${azi.cod})`);
    const fara = ruleaza('scripts/build-zona.mjs', '--proba', '--proba-fara', '106163');
    proba(fara.cod === 1 && /harta_v4-dem\.bin: DIFERĂ de HEAD/.test(fara.iesire),
      `control, fără dala 106163: harta (.bin) iese altfel, „${motiv(fara)}” (cod ${fara.cod}) — pică`);
    const gresit = mutat(["'106163', '106164']", "'106163', '106146']"]);
    proba(gresit !== null && gresit.cod !== 0 && /lipsesc din date-sursa\/lidar: MDT-2m-106146/.test(gresit.iesire),
      `control, 106164 scris greșit în DALE: ${gresit === null ? NEAPLICATA : `„${motiv(gresit)}”`} — proba pică, nu se sare`);
    const scoasa = mutat(["'106163', '106164']", "'106163']"]);
    proba(scoasa !== null && scoasa.cod !== 0 && /106164[^\n]*nenumite în DALE/.test(scoasa.iesire),
      `control, 106164 scoasă din DALE, lăsată pe disc: scriptul se oprește (${scoasa === null ? NEAPLICATA : `„${motiv(scoasa).slice(0, 90)}”`})`);
  }
}

rezumat();
