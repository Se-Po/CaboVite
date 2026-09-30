#!/usr/bin/env node
// Extrage o zonă din dalele LiDAR ale DGT: o cutie TM06, decupată din mozaicul
// dalelor și scrisă ca heightmap, împreună cu conturul ei în coordonate de scenă —
// plasa se generează numai înăuntrul lui.
//
// Sursa: Levantamento LiDAR de Portugal Continental 2024-2025 (DGT), MDT 2 m,
// 10 puncte/m², CC BY 4.0. Dalele sunt GeoTIFF float32 NECOMPRIMATE.
//
// Rulează: npm run build-zona                    (pas de 2 m, rezoluția nativă → NUME)
//          npm run build-zona -- 4 harta_vN       (mediere 2 × 2: altă hartă, alt nume)
import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { dinTM06, inPoligon, arie } from './comun/tm06.mjs';
import { citesteTiffDGT, randTiff } from './comun/tiff.mjs';

// Numele hărții produse. Hărțile proiectului sunt numerotate harta_vN: o
// hartă nouă înseamnă alt contur, altă rezoluție sau alt conținut, deci alt
// nume, nu un fișier suprascris. Fișierele ies ca public/data/<NUME>-dem.bin + .json.
//
// harta_v2 = harta_v0 cu fâșia dalei 104162 refăcută din 50 cm: acolo harta_v0
// avea fiecare pixel cu 1 m spre est. Vezi `refaDin50cm`.
// harta_v4 = aceeași cutie și aceleași date ca harta_v2, dar conturul e toată
// cutia, nu poligonul ales în pagină: uscatul din afara lui (1,1 km²) se vedea ca
// mare. Și zScara se ia pe toată cutia, ca niciun nod să nu mai fie tăiat.
const NUME = 'harta_v4';

const DIR = 'date-sursa/lidar';
const DIR_50 = 'date-sursa/lidar-50cm';
const IESIRE = 'public/data';
const NODATA = -999;
const REZ_SURSA = 2;
const REZ_50 = 0.5;

// Cutia zonei, în TM06, cu muchiile pe metri întregi. Singurul loc din care se
// schimbă zona extrasă.
//
// Se scrie în TM06, nu ca un poligon în longitudine/latitudine: colțurile lui
// harta_v2 proiectate înapoi au o eroare de ±0,1 m, iar floor(−95788,05 / 2)·2 dă
// −95790 — cutia ar crește cu o celulă, iar peticul n-ar mai cădea pe noduri.
// Aceeași cutie ca harta_v2 păstrează și ancora sanctuarului (centrul ei), γ-ul
// busolei și gaura de sub petic.
const CUTIE_TM06 = { xMin: -95788, xMax: -93460, yMin: -139392, yMax: -136406 };

// Marea, în aceste date, NU e NODATA: LiDAR-ul o dă ca 0.0 m exact. Lăsată așa,
// ar fi coplanară cu planul mării al scenei și ar produce z-fighting pe sute de
// metri. O coborâm, ca linia țărmului să fie intersecția onestă a terenului cu
// y = 0. Nu e o afirmație despre adâncime.
const ADANCIME_APA = -8;
const esteApa = (v) => v === 0 || v <= NODATA + 1;

const pas = Number(process.argv[2]) || REZ_SURSA;
if (pas % REZ_SURSA !== 0) throw new Error(`pasul trebuie să fie multiplu de ${REZ_SURSA} m`);
const FACTOR = pas / REZ_SURSA;

// Alt pas înseamnă altă hartă, deci alt nume — niciodată scrisă peste NUME, pe care
// o încarcă pagina și pe care stau peticul și stratul NDVI.
const nume = pas === REZ_SURSA ? NUME : process.argv[3];
if (!nume || (pas !== REZ_SURSA && nume === NUME))
  throw new Error(`la pasul de ${pas} m iese altă hartă decât ${NUME}: dă-i un nume nou — npm run build-zona -- ${pas} harta_vN`);

// Un nume se scrie o singură dată: o hartă pe care git o urmărește deja nu se
// rescrie, oricât de mică ar fi schimbarea — pe ea stau peticul, NDVI-ul și pagina.
// Cât încă nu e urmărită, se poate reface (`--suprascrie-lucru`), ca la sanctuar.
{
  const urmarit = spawnSync('git', ['ls-files', '--error-unmatch', `public/data/${nume}-dem.bin`], { stdio: 'ignore' }).status === 0;
  if (urmarit) throw new Error(`public/data/${nume}-dem.bin e deja în depozit; o hartă nouă primește un nume nou`);
  if (existsSync(`public/data/${nume}-dem.bin`) && !process.argv.includes('--suprascrie-lucru'))
    throw new Error(`public/data/${nume}-dem.bin există (neurmărit); rescrie-l cu --suprascrie-lucru`);
}


// ------------------------------------------------ dalele nealiniate, din 50 cm

/**
 * Un bloc de 4 × 4 celule de 50 cm → valoarea unei celule de 2 m, sau NaN = apă.
 *
 * `v` are 16 valori brute din dala MDT-50cm: înălțimi, 0 exact pentru mare,
 * −999 pentru fără date. Regula trebuie să imite produsul DGT de 2 m, fiindcă
 * celula refăcută stă lângă celule de 2 m adevărate.
 *
 * Calibrat pe 105163, unde există ambele produse (250 000 de celule):
 *   - k sub-celule de apă din 16. Pentru k = 1…15 DGT dă ÎNTOTDEAUNA uscat;
 *     pentru k = 16, apă la 99,3% (632 de celule rămân uscat, cu valori ~0,05 m).
 *   - masca: „apă dacă oricare” greșește 1 829 de celule, „majoritatea” 1 170,
 *     „toate” 632.
 *   - valoarea la k = 1…15, RMS față de DGT: media sub-celulelor de uscat
 *     0,14–0,62 m; media tuturor 16, cu apa ca 0, 0,07–0,12 m (ca la k = 0: 0,097).
 */
function blocDin50cm(v) {
  // Apă numai dacă tot blocul e apă; altfel media pe toate 16, cu marea ca 0 m.
  // NODATA se socotește ca marea: pe 104162 și 105163 nu există niciun bloc în
  // care NODATA să stea lângă uscat — apare numai în larg, deci regula n-o simte.
  let suma = 0, apa = 0;
  for (const x of v) if (esteApa(x)) apa++; else suma += x;
  return apa === v.length ? NaN : suma / v.length;
}
// Descrierea regulii de mai sus, într-o frază; ajunge în sidecar, la `corectii`.
const REGULA_BLOC = 'apă numai dacă toate cele 16 sub-celule de 50 cm sunt apă (0 sau NODATA); altfel media '
  + 'celor 16, cu apa socotită 0 m — regula care reproduce produsul DGT de 2 m pe 105163 (632 de celule cu '
  + 'altă mască din 250 000; RMS 0,07–0,12 m pe blocurile amestecate, ca pe uscatul curat)';

/**
 * Reface, din dala de 50 cm cu același indice, celulele unei dale de 2 m al cărei
 * colț nu cade pe muchiile de celulă ale hărții.
 *
 * O asemenea dală are centrele pixelilor la jumătate de celulă de nodurile hărții.
 * Cu floor-ul din bucla principală, (x − X_MIN) / 2 iese un întreg exact — o
 * egalitate —, iar floor alege nodul estic: fiecare pixel ajunge cu 1 m spre est,
 * fără niciun semn. Așa a intrat 104162 (x0 = −95441) în harta_v0. Nicio rotunjire
 * nu repară asta; numai datele de pe grila cea bună.
 *
 * Primește celulele cuprinse ÎNTREGI în amprenta dalei de 2 m: marginea de est a
 * lui 104162 (−94999) taie celula de la −94999 în două, iar aceea e a lui 105162.
 */
function refaDin50cm(d, g) {
  const indice = d.nume.match(/-(\d{6})-/)?.[1];
  const nume50 = indice && existsSync(DIR_50)
    // Numai MDT: în același director stau și MDS-urile sanctuarului, cu aceiași
    // indici, iar „MDS" vine alfabetic înaintea lui „MDT" — ar fi găsit primul.
    && readdirSync(DIR_50).find((f) => f.startsWith('MDT-50cm-') && f.includes(`-${indice}-`) && /\.tif$/i.test(f));
  if (!nume50)
    throw new Error(`${d.nume}: colțul (x0 ${d.x0}, y0 ${d.y0}) nu cade pe muchiile de celulă ale hărții, `
      + 'deci pixelii ei stau la o jumătate de celulă de noduri, iar dala are uscat — nu se poate sări. '
      + `Pune în ${DIR_50} dala MDT-50cm cu indicele ${indice} (cdd.dgterritorio.gov.pt): celulele ei se refac din ea.`);
  const m = { nume: nume50, ...citesteTiffDGT(join(DIR_50, nume50)) };
  if (m.rezolutie !== REZ_50) throw new Error(`${nume50}: rezoluție ${m.rezolutie} m, aștept ${REZ_50}`);
  const a = new Float32Array(m.latime * m.inaltime);
  for (let r = 0; r < m.inaltime; r++) a.set(randTiff(m, r), r * m.latime);

  const P = REZ_SURSA / REZ_50;
  // Blocul P × P de sub pătratul de 2 m cu colțul NV la (x, y); null dacă iese din dală.
  const bloc = (x, y) => {
    const c0 = (x - m.x0) / REZ_50, r0 = (m.y0 - y) / REZ_50;
    if (!Number.isInteger(c0) || !Number.isInteger(r0))
      throw new Error(`${nume50}: grila de 50 cm nu cade pe muchiile de 2 m (x0 ${m.x0}, y0 ${m.y0})`);
    if (c0 < 0 || r0 < 0 || c0 + P > m.latime || r0 + P > m.inaltime) return null;
    const v = new Float32Array(P * P);
    for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) v[i * P + j] = a[(r0 + i) * m.latime + c0 + j];
    return v;
  };

  // Proba de înregistrare. Pixelii de uscat ai dalei de 2 m, acolo unde spune
  // antetul ei, față de blocurile din 50 cm mutate cu dx, dy. Minimul trebuie să
  // fie la (0, 0): atunci antetul dalei de 2 m și al celei de 50 cm spun același
  // lucru, deci pixelii chiar stau unde scrie, iar harta_v0 îi mutase. Pe 105163,
  // unde ambele sunt aliniate, RMS e 0,097 m la (0, 0) și 0,54 m la 1 m.
  //
  // Proba e RELATIVĂ: două antete greșite la fel ar trece. Proba absolută e
  // cusătura cu dala vecină, făcută pe harta scrisă (vezi CLAUDE.md).
  const pixeli = [];
  for (let r = 0; r < d.inaltime; r++) {
    const rand = randTiff(d, r);
    for (let c = 0; c < d.latime; c++)
      if (!esteApa(rand[c])) pixeli.push([d.x0 + c * REZ_SURSA, d.y0 - r * REZ_SURSA, rand[c]]);
  }
  const PASI = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
  const rms = (dx, dy) => {
    let s = 0, n = 0;
    for (const [x, y, v] of pixeli) {
      const b = bloc(x + dx, y + dy);
      if (!b) continue;
      const u = blocDin50cm(b);
      if (Number.isNaN(u)) continue;
      s += (v - u) ** 2; n++;
    }
    return n ? Math.sqrt(s / n) : Infinity;
  };
  const tabel = PASI.map((dy) => PASI.map((dx) => rms(dx, dy)));
  let min = { r: Infinity };
  PASI.forEach((dy, i) => PASI.forEach((dx, j) => { if (tabel[i][j] < min.r) min = { r: tabel[i][j], dx, dy }; }));
  const i0 = PASI.indexOf(0), i1 = PASI.indexOf(1), im = PASI.indexOf(-1);
  const r0 = tabel[i0][i0];
  const r1 = Math.min(tabel[i0][i1], tabel[i0][im], tabel[i1][i0], tabel[im][i0]);
  console.log(`  ${d.nume} față de ${nume50}, pe ${pixeli.length} pixeli de uscat — RMS [m]:`);
  console.log('    dx  ' + PASI.map((x) => String(x).padStart(6)).join('') + '   (dy = 0)');
  console.log('        ' + tabel[i0].map((x) => x.toFixed(3).padStart(6)).join(''));
  console.log('    dy  ' + PASI.map((y) => String(y).padStart(6)).join('') + '   (dx = 0)');
  console.log('        ' + PASI.map((_, i) => tabel[i][i0].toFixed(3).padStart(6)).join(''));
  if (min.dx !== 0 || min.dy !== 0)
    throw new Error(`${d.nume}: minimul e la dx ${min.dx}, dy ${min.dy} m, nu la (0, 0). Antetele celor două dale `
      + 'nu spun același lucru; nu refac nimic până nu se lămurește care are dreptate.');
  if (r1 / r0 < 3)
    throw new Error(`${d.nume}: RMS ${r0.toFixed(3)} la (0, 0) și ${r1.toFixed(3)} la 1 m — proba nu deosebește 1 m.`);

  // Celulele cuprinse întregi în amprentă.
  const ax1 = d.x0, ax2 = d.x0 + d.latime * REZ_SURSA;
  const ay2 = d.y0, ay1 = d.y0 - d.inaltime * REZ_SURSA;
  let celule = 0, uscat = 0;
  for (let gr = 0; gr < g.hs; gr++) {
    const sus = g.Y_MAX - gr * REZ_SURSA;
    if (sus > ay2 || sus - REZ_SURSA < ay1) continue;
    for (let gc = 0; gc < g.ws; gc++) {
      const st = g.X_MIN + gc * REZ_SURSA;
      if (st < ax1 || st + REZ_SURSA > ax2) continue;
      const i = gr * g.ws + gc;
      if (g.scris[i]) throw new Error(`celula (${gr}, ${gc}) e în amprenta lui ${d.nume} și a scris-o și o dală aliniată`);
      const b = bloc(st, sus);
      if (!b) throw new Error(`${nume50} nu acoperă celula (${gr}, ${gc}) din amprenta lui ${d.nume}`);
      const v = blocDin50cm(b);
      g.sursa[i] = v; g.scris[i] = 2;
      celule++;
      if (!Number.isNaN(v)) uscat++;
    }
  }
  console.log(`  refăcute: ${celule} celule, ${uscat} de uscat\n`);

  return {
    dala: d.nume,
    problema: `colțul la x0 ${d.x0}, y0 ${d.y0}, decalat față de muchiile de celulă ale hărții; lipită cu floor, `
      + `fiecare pixel ar fi ajuns mutat cu ${g.mutare.est} m spre est și ${g.mutare.nord} m spre nord`,
    inlocuita_cu: nume50,
    regula_bloc: REGULA_BLOC,
    celule, uscat,
    proba: { pixeli: pixeli.length, rms_0: +r0.toFixed(4), rms_1m: +r1.toFixed(4), minim_la: [min.dx, min.dy] },
  };
}


// --------------------------------------------------------------------- main

const main = () => {
  const { xMin: X_MIN, xMax: X_MAX, yMin: Y_MIN, yMax: Y_MAX } = CUTIE_TM06;
  if ((X_MAX - X_MIN) % pas || (Y_MAX - Y_MIN) % pas || X_MIN % REZ_SURSA || Y_MAX % REZ_SURSA)
    throw new Error(`cutia ${JSON.stringify(CUTIE_TM06)} nu se împarte la pasul de ${pas} m sau nu cade pe grila de ${REZ_SURSA} m`);
  const w = Math.round((X_MAX - X_MIN) / pas), h = Math.round((Y_MAX - Y_MIN) / pas);
  // Conturul e chiar cutia, NV → NE → SE → SV.
  const poligon = [{ x: X_MIN, y: Y_MAX }, { x: X_MAX, y: Y_MAX }, { x: X_MAX, y: Y_MIN }, { x: X_MIN, y: Y_MIN }];

  console.log(`contur: cutia, ${(arie(poligon) / 1e6).toFixed(2)} km²`);
  console.log(`cutie TM06: X ${X_MIN} .. ${X_MAX}   Y ${Y_MIN} .. ${Y_MAX}`);
  console.log(`grilă: ${w} × ${h} la ${pas} m = ${(w * h / 1e6).toFixed(2)} M celule`);

  // ----------------------------------------------------- mozaicul la 2 m
  const ws = Math.round((X_MAX - X_MIN) / REZ_SURSA), hs = Math.round((Y_MAX - Y_MIN) / REZ_SURSA);
  const sursa = new Float32Array(ws * hs).fill(NaN);

  const fisiere = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.tif'));
  if (!fisiere.length) throw new Error(`niciun .tif în ${DIR}`);
  const dale = fisiere.map((f) => ({ nume: f, ...citesteTiffDGT(join(DIR, f)) }));
  if (dale.some((d) => d.rezolutie !== REZ_SURSA)) throw new Error('dale cu altă rezoluție decât 2 m');

  // Cine a scris fiecare celulă: 0 nimeni, 1 o dală aliniată, 2 o dală refăcută
  // din 50 cm. Două surse pe aceeași celulă ar însemna o amprentă greșit înțeleasă.
  const scris = new Uint8Array(ws * hs);
  const folosite = [], nealiniate = [], sarite = [], corectii = [];
  for (const d of dale) {
    const dx1 = d.x0, dx2 = d.x0 + d.latime * REZ_SURSA;
    const dy2 = d.y0, dy1 = d.y0 - d.inaltime * REZ_SURSA;
    if (dx2 <= X_MIN || dx1 >= X_MAX || dy2 <= Y_MIN || dy1 >= Y_MAX) continue;
    // Colțul trebuie să cadă pe o muchie de celulă a hărții; altfel floor-ul de
    // mai jos mută tăcut fiecare pixel cu o jumătate de celulă — vezi refaDin50cm.
    if ((d.x0 - X_MIN) % REZ_SURSA !== 0 || (Y_MAX - d.y0) % REZ_SURSA !== 0) {
      nealiniate.push(d);
      continue;
    }
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
        scris[gr * ws + gc] = 1;
      }
    }
  }

  // Dalele nealiniate: fără uscat în cutie nu aduc nimic (în harta_v0, 104161 și
  // 104163 erau numai 0 și NODATA); cu uscat, se refac din 50 cm. Contează numai
  // pixelii cu centrul în cutie — uscatul de dincolo de margine nu intră în hartă.
  for (const d of nealiniate) {
    let areUscat = false;
    for (let r = 0; r < d.inaltime && !areUscat; r++) {
      const y = d.y0 - (r + 0.5) * REZ_SURSA;
      if (y <= Y_MIN || y >= Y_MAX) continue;
      const rand = randTiff(d, r);
      for (let c = 0; c < d.latime && !areUscat; c++) {
        const x = d.x0 + (c + 0.5) * REZ_SURSA;
        if (x > X_MIN && x < X_MAX && !esteApa(rand[c])) areUscat = true;
      }
    }
    if (!areUscat) {
      sarite.push({ dala: d.nume, motiv: `colț nealiniat (x0 ${d.x0}, y0 ${d.y0}), dar numai apă și NODATA` });
      console.log(`${d.nume}: colț nealiniat, numai apă — sărită`);
      continue;
    }
    console.log(`${d.nume}: colț nealiniat (x0 ${d.x0}, y0 ${d.y0}), cu uscat — refăcută din 50 cm`);
    const cx = d.x0 + REZ_SURSA / 2, cy = d.y0 - REZ_SURSA / 2;
    const mutare = {
      est: X_MIN + (Math.floor((cx - X_MIN) / REZ_SURSA) + 0.5) * REZ_SURSA - cx,
      nord: Y_MAX - (Math.floor((Y_MAX - cy) / REZ_SURSA) + 0.5) * REZ_SURSA - cy,
    };
    const cor = refaDin50cm(d, { X_MIN, Y_MAX, ws, hs, sursa, scris, mutare });
    corectii.push(cor);
    folosite.push(cor.inlocuita_cu);
  }
  console.log(`dale folosite: ${folosite.length}; nealiniate ${nealiniate.length} (refăcute ${corectii.length}, sărite ${sarite.length})`);

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
      if (v < zmin) zmin = v;
      if (v > zmax) zmax = v;
      if (!inp) continue;
      uscatInPolig++;
    }
  console.log(`în poligon: ${inPolig} celule (${(100 * inPolig / (w * h)).toFixed(0)}% din cutie)`);
  console.log(`  din care uscat măsurat: ${uscatInPolig} (${(100 * uscatInPolig / inPolig).toFixed(0)}%)`);
  console.log(`altitudine: ${zmin.toFixed(2)} .. ${zmax.toFixed(2)} m`);
  console.log(`triunghiuri estimate: ${(2 * inPolig / 1000).toFixed(0)}k`);

  // Golurile devin apă. Nu interpolăm: o gaură în mijlocul uscatului ar fi o
  // problemă de date, nu ceva de umplut pe tăcute.
  const final = new Float32Array(grila.length);
  for (let i = 0; i < grila.length; i++)
    final[i] = Number.isNaN(grila[i]) ? ADANCIME_APA : grila[i];

  // zMax e maximul uscatului din toată CUTIA. Până la harta_v2 era al conturului,
  // iar relieful mai înalt din afara lui (până la 150 m) se tăia la 65535: 14 190
  // de noduri, podișuri false la 143,64 m. Acum nu se taie nimic, iar un nod
  // limitat oprește scriptul.
  const zMin = ADANCIME_APA, zMax = zmax;
  const scara = (zMax - zMin) / 65535;
  const u16 = new Uint16Array(grila.length);
  let limitate = 0;
  for (let i = 0; i < final.length; i++) {
    const q = Math.round((final[i] - zMin) / scara);
    if (q > 65535 || q < 0) limitate++;
    u16[i] = Math.min(65535, Math.max(0, q));
  }
  if (limitate) throw new Error(`${limitate} noduri ies din Uint16 cu zScara ${scara}: zMax nu e maximul cutiei`);

  mkdirSync(IESIRE, { recursive: true });
  writeFileSync(join(IESIRE, `${nume}-dem.bin`), Buffer.from(u16.buffer));
  writeFileSync(join(IESIRE, `${nume}-dem.json`), JSON.stringify({
    nume,
    descriere: `Cutia de la Cabo Espichel, cu tot uscatul ei. LiDAR DGT 2024-2025, MDT 2 m, redus la ${pas} m`
      + (corectii.length ? `; dalele nealiniate refăcute din MDT 50 cm (vezi corectii)` : '')
      + '. Uint16 little-endian, rând 0 = nord.',
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
    // Conturul e cutia; celulele de mare le taie oricum terrain.js, după regula_apa.
    poligon_scena: poligonScena,
    poligon_geo: poligon.map((p) => dinTM06(p.x, p.y)),
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
      limitare: 'niciuna: zMax e maximul uscatului din toată cutia',
    },
    // Dalele de 2 m al căror colț nu cade pe muchiile de celulă ale hărții.
    corectii,
    dale_sarite: sarite,
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

  console.log(`scris: public/data/${nume}-dem.bin (${(u16.byteLength / 1048576).toFixed(2)} MB) + .json`);
};

main();
