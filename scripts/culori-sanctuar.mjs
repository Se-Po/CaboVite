// Culorile sanctuarului, ca albedo — aceeași convenție ca paleta terenului.
//
//   npm run culori-sanctuar
//
// Scrie date-sursa/derivate/culori-sanctuar.json, pe care îl citește build-sanctuar.
//
// Două surse, după aceeași regulă ca `SURSA` din paleta.mjs:
//   - ce se vede de sus — acoperișurile, pavajele, crestele zidurilor — din
//     ortofotoul DGT;
//   - ce e vertical — varul și cantaria fațadelor — din fotografiile autorului.
//
// Ortofotoul are soarele copt în el: o apă de acoperiș spre soare iese mai
// luminoasă decât una spre umbră, deși e aceeași țiglă. Lumina nu se ghicește, se
// măsoară. Modulele în patru ape ale aripii N au pante spre toate punctele
// cardinale, din același material; pe normalele lor, măsurate pe MDS, se potrivește
// Y = k·max(0, n·s) + a, iar direcția s e soarele ortofotoului. Fiecare apă se
// aduce apoi „la plat": cum ar arăta țigla culcată, sub aceeași lumină, ca terenul
// pictat din același ortofoto. Pe plat cos i = sin(elevație).
//
// Ortofotoul nu e true-ortho: un acoperiș apare deplasat față de locul lui, cu cât
// e mai înalt și mai departe de nadir. Deplasarea se măsoară înainte de orice
// eșantionare, pe corelația dintre acoperișurile LiDAR și roșul țiglei.

import { readFileSync, writeFileSync } from 'node:fs';
import { cadru, incarcaRastru, inPoligon } from './comun/rastru-sanctuar.mjs';
import { deschideOrtofoto, fereastra } from './comun/ortofoto.mjs';
import { dinOklab, gama, hex, laOklab, linear } from './comun/oklab.mjs';
import { plicMinim } from '../src/scene/sanctuar-forme.js';

const R = incarcaRastru();
const { W, H, F, pas } = R;
const M = JSON.parse(readFileSync('date-sursa/derivate/masuratori-sanctuar.json', 'utf8'));
const model = new Float32Array(readFileSync('date-sursa/derivate/model-sanctuar.bin').buffer.slice(0));
const r3 = (v) => Math.round(v * 1000) / 1000;
const cuantila = (v, q) => { const a = Float64Array.from(v).sort(); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };

// ------------------------------------------------------------ ortofotoul, la 0,25 m

const o = deschideOrtofoto('date-sursa/ortofoto/ortos2025_cog_25cm_rgbi_jpg_464-3_v02.tif', 0.25);
const OW = W * 2, OH = H * 2;
const oc0 = (F.x0 - o.x0) / 0.25, or0 = (o.y0 - F.y1) / 0.25;
const [OR, OG, OB] = [0, 1, 2].map((b) => fereastra(o, b, oc0, or0, OW, OH));
/** Pixelul de ortofoto (0,25 m) care conține punctul TM06, deplasat cu (dx, dy). */
const oIdx = (x, y, dx = 0, dy = 0) => {
  const c = Math.floor((x + dx - F.x0) / 0.25), r = Math.floor((F.y1 - (y + dy)) / 0.25);
  return c < 0 || r < 0 || c >= OW || r >= OH ? -1 : r * OW + c;
};
const lin = (i) => [linear(OR[i] / 255), linear(OG[i] / 255), linear(OB[i] / 255)];
const Y = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// ------------------------------------------------------------ deplasarea ortofotoului

// Masca acoperișurilor de țiglă din modelul LiDAR (bisericile și aripile), față de
// roșul OKLab a* al ortofotoului, la 0,25 m. Pearson pe deplasări de ±4 m.
const tigla = M.parti.filter((p) => p.tip === 'acoperis' && p.plane?.length && !/terasa/.test(p.cheie));
const esantion = [];
for (const p of tigla) for (const i of R.pixeliIn(p.poligon_tm06)) esantion.push(R.centru(i));
const vecinatate = new Set();
for (const p of tigla) for (const i of R.pixeliIn(p.poligon_tm06.map(([x, y]) => [x, y]))) vecinatate.add(i);
// fundal: un inel de 3 m în jurul acoperișurilor, ca Pearson să aibă și zerouri
const fundal = [];
{
  const toate = new Set(esantion.map((q) => R.indice(q.x, q.y)));
  for (const i of toate) {
    const c = i % W, r = Math.floor(i / W);
    for (let d = 1; d <= 6; d++) for (const [dc, dr] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
      const j = (r + dr) * W + c + dc;
      if (!toate.has(j)) fundal.push(R.centru(j));
    }
  }
}
const aStar = (i) => laOklab(OR[i], OG[i], OB[i])[1];
function corelatie(dx, dy) {
  const xs = [], ys = [];
  for (const q of esantion) { const i = oIdx(q.x, q.y, dx, dy); if (i >= 0) { xs.push(1); ys.push(aStar(i)); } }
  for (const q of fundal) { const i = oIdx(q.x, q.y, dx, dy); if (i >= 0) { xs.push(0); ys.push(aStar(i)); } }
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; syy += (ys[k] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
let depl = { r: -Infinity };
for (let dy = -4; dy <= 4; dy += 0.5) for (let dx = -4; dx <= 4; dx += 0.5) { const r = corelatie(dx, dy); if (r > depl.r) depl = { dx, dy, r }; }
// rafinare la 0,25 m în jurul maximului
for (let dy = depl.dy - 0.5; dy <= depl.dy + 0.5; dy += 0.25) for (let dx = depl.dx - 0.5; dx <= depl.dx + 0.5; dx += 0.25) { const r = corelatie(dx, dy); if (r > depl.r) depl = { dx, dy, r }; }
const r0 = corelatie(0, 0);
console.log(`Ortofotoul față de LiDAR, pe acoperișurile de țiglă: deplasare (${depl.dx}; ${depl.dy}) m, r ${depl.r.toFixed(3)} (la (0; 0): ${r0.toFixed(3)})`);

// ------------------------------------------------------------ soarele ortofotoului

// Pe fiecare plan de țiglă: pixelii fațetei lui (unde e planul cel mai jos),
// micșorați cu 0,5 m, mediana luminanței liniare în ortofoto (deplasat).
function fatete(p) {
  const pl = p.plane.map((q) => [q.A, q.B, q.C]);
  const contur = p.poligon_tm06.slice(0, -1);
  return plicMinim(contur, pl).map((f) => {
    const n = [-p.plane[f.plan].A, -p.plane[f.plan].B, 1];
    const L = Math.hypot(...n);
    const cx = f.poligon.reduce((a, q) => a + q[0], 0) / f.poligon.length, cy = f.poligon.reduce((a, q) => a + q[1], 0) / f.poligon.length;
    const mic = f.poligon.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; const k = Math.max(0, (d - 0.5) / d); return [cx + (x - cx) * k, cy + (y - cy) * k]; });
    const pix = [];
    const xs = mic.map((q) => q[0]), ys = mic.map((q) => q[1]);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.25) for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) {
      if (!inPoligon(x, y, mic.concat([mic[0]]))) continue;
      const i = oIdx(x, y, depl.dx, depl.dy);
      if (i >= 0) pix.push(i);
    }
    return { parte: p.cheie, n: n.map((q) => q / L), pix };
  }).filter((f) => f.pix.length >= 20);
}
const planeTigla = tigla.flatMap(fatete);
for (const f of planeTigla) f.Y = cuantila(f.pix.map((i) => Y(lin(i))), 0.5);

// Potrivirea: pentru fiecare direcție s (azimut, elevație) pe grilă, k și a prin
// cele mai mici pătrate; se păstrează s cu eroarea cea mai mică. Numai planele
// modulelor și ale acoperișurilor lungi ale aripilor — aceeași țiglă, orientări
// diferite. Biserica are țiglă mai roșie și intră separat, mai jos.
const antrenare = planeTigla.filter((f) => f.parte.startsWith('aripa_n.'));
const sDin = (az, el) => [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
let soare = { e: Infinity };
for (let azg = 0; azg < 360; azg += 1) for (let elg = 5; elg <= 85; elg += 0.5) {
  const s = sDin((azg * Math.PI) / 180, (elg * Math.PI) / 180);
  const X = antrenare.map((f) => Math.max(0, f.n[0] * s[0] + f.n[1] * s[1] + f.n[2] * s[2])), Yv = antrenare.map((f) => f.Y);
  const n = X.length, mx = X.reduce((a, b) => a + b) / n, my = Yv.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0;
  for (let k = 0; k < n; k++) { sxy += (X[k] - mx) * (Yv[k] - my); sxx += (X[k] - mx) ** 2; }
  const k = sxy / sxx, a = my - k * mx;
  let e = 0;
  for (let q = 0; q < n; q++) e += (Yv[q] - (k * X[q] + a)) ** 2;
  if (k > 0 && e < soare.e) soare = { e, az: azg, el: elg, k, a, n };
}
const rms = Math.sqrt(soare.e / soare.n);
console.log(`Soarele ortofotoului, din ${soare.n} ape de țiglă ale aripii N: azimut ${soare.az}°, elevație ${soare.el}°; `
  + `Y = ${soare.k.toFixed(3)}·cos i + ${soare.a.toFixed(3)}, RMS ${rms.toFixed(4)} (Y mediu ${(antrenare.reduce((s0, f) => s0 + f.Y, 0) / antrenare.length).toFixed(3)})`);



// Cât de bine e determinată lumina: pentru culoarea „la plat" contează Y_plat =
// k·sin(el) + a, nu elevația în sine. Se tipărește Y_plat pe toate potrivirile cu
// eroarea sub 1,1 × minimul.
{
  const plate = [];
  for (let azg = 0; azg < 360; azg += 2) for (let elg = 5; elg <= 85; elg += 1) {
    const s = sDin((azg * Math.PI) / 180, (elg * Math.PI) / 180);
    const X = antrenare.map((f) => Math.max(0, f.n[0] * s[0] + f.n[1] * s[1] + f.n[2] * s[2])), Yv = antrenare.map((f) => f.Y);
    const n = X.length, mx = X.reduce((a, b) => a + b) / n, my = Yv.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0;
    for (let k = 0; k < n; k++) { sxy += (X[k] - mx) * (Yv[k] - my); sxx += (X[k] - mx) ** 2; }
    const k = sxy / sxx, a = my - k * mx;
    let e = 0; for (let q = 0; q < n; q++) e += (Yv[q] - (k * X[q] + a)) ** 2;
    if (k > 0 && e <= soare.e * 1.1) plate.push({ azg, elg, yPlat: k * Math.sin((elg * Math.PI) / 180) + a });
  }
  const ys = plate.map((q) => q.yPlat);
  console.log(`Potriviri sub 1,1 × eroarea minimă: ${plate.length}; azimut ${Math.min(...plate.map((q) => q.azg))}–${Math.max(...plate.map((q) => q.azg))}°, elevație ${Math.min(...plate.map((q) => q.elg))}–${Math.max(...plate.map((q) => q.elg))}°; Y_plat ${Math.min(...ys).toFixed(3)}–${Math.max(...ys).toFixed(3)}`);
  console.log('Apele aripii N (azimutul pantei, panta, Y măsurat, Y prezis):');
  const s = sDin((soare.az * Math.PI) / 180, (soare.el * Math.PI) / 180);
  for (const f of antrenare.sort((p, q) => Math.atan2(p.n[0], p.n[1]) - Math.atan2(q.n[0], q.n[1]))) {
    const az = ((Math.atan2(f.n[0], f.n[1]) * 180) / Math.PI + 360) % 360, pa = (Math.acos(f.n[2]) * 180) / Math.PI;
    const pr = soare.k * Math.max(0, f.n[0] * s[0] + f.n[1] * s[1] + f.n[2] * s[2]) + soare.a;
    console.log(`  ${f.parte.padEnd(22)} ${az.toFixed(0).padStart(4)}° ${pa.toFixed(0).padStart(3)}°  ${f.Y.toFixed(3)}  ${pr.toFixed(3)}  (${f.pix.length} px)`);
  }
}

// ------------------------------------------------------------ materialele

import jpeg from 'jpeg-js';

const PRAG_LUMINA = 0.8;   // ca în paleta.mjs
const PRAG_CROMA = 0.02;
const sPlat = Math.sin((soare.el * Math.PI) / 180);
const yPlat = soare.k * sPlat + soare.a;
const sVec = sDin((soare.az * Math.PI) / 180, (soare.el * Math.PI) / 180);

/**
 * Convenția paletei pe o listă de culori sRGB: L din cuantila 0,8, nuanța din
 * pixelii peste mediana luminozității (umbra e albastră de la cer și ar trage
 * nuanța spre rece). Întoarce și statistica, ca s-o poată scrie fișierul.
 */
function albedoDin(rgbs) {
  const lab = rgbs.map(([r, g, b]) => laOklab(r, g, b));
  const L = lab.map((q) => q[0]);
  const lumina = cuantila(L, PRAG_LUMINA), med = cuantila(L, 0.5);
  const sus = lab.filter((q) => q[0] >= med);
  const a = sus.reduce((s0, q) => s0 + q[1], 0) / sus.length, b = sus.reduce((s0, q) => s0 + q[2], 0) / sus.length;
  const croma = Math.hypot(a, b);
  const rgb = dinOklab([lumina, a, b]);
  return { rgb, culoare: hex(rgb), oklab: { L: r3(lumina), a: r3(a), b: r3(b) }, croma: r3(croma), nuanta_de_incredere: croma >= PRAG_CROMA, n: rgbs.length };
}

/** Pixelii de ortofoto ai unor ape, aduși „la plat" sub lumina măsurată. */
function laPlat(fat) {
  const out = [];
  for (const f of fat) {
    const cos = f.n[0] * sVec[0] + f.n[1] * sVec[1] + f.n[2] * sVec[2];
    if (cos < 0.2) continue; // numai apele în soare: la umbră nuanța e a cerului
    const k = yPlat / (soare.k * cos + soare.a);
    for (const i of f.pix) out.push(lin(i).map((c) => Math.round(255 * gama(Math.min(1, c * k)))));
  }
  return out;
}

const materiale = {};
const pune = (cheie, rez, sursa, de_ce) => { materiale[cheie] = { ...rez, sursa, de_ce }; };

// Țigla, pe grupuri: biserica are altă țiglă decât aripile, iar aripile diferă între ele.
const grup = (f) => planeTigla.filter(f);
pune('tigla_biserica', albedoDin(laPlat(grup((f) => f.parte.startsWith('biserica.')))), 'ortofoto', 'apele în soare ale bisericii, aduse la plat');
pune('tigla_aripa_n', albedoDin(laPlat(grup((f) => f.parte.startsWith('aripa_n.') && f.parte !== 'aripa_n.spate_m1'))), 'ortofoto', 'apele în soare ale aripii N, aduse la plat');
pune('tigla_aripa_s', albedoDin(laPlat(grup((f) => f.parte.startsWith('aripa_s.')))), 'ortofoto', 'apele în soare ale aripii S și ale capătului ei de est, aduse la plat');

// Suprafețe aproape plate: acoperișul terasă al aripii N și acoperișul întunecat
// din spatele modulului 1. Panta lor e sub 12°, deci aducerea la plat e mică.
const plat = (chei) => albedoDin(laPlat(fatete2(chei)));
function fatete2(chei) { return planeTigla.filter((f) => chei.includes(f.parte)).concat(M.parti.filter((p) => chei.includes(p.cheie) && /terasa/.test(p.cheie)).flatMap(fatete)); }
pune('terasa', plat(['aripa_n.terasa_a', 'aripa_n.terasa_b']), 'ortofoto', 'acoperișul plan din spatele modulelor aripii N');
pune('acoperis_spate_m1', plat(['aripa_n.spate_m1']), 'ortofoto', 'acoperișul întunecat din spatele modulului 1');

// Cupola Casei da Água: pixelii cupolei în soare. Albul poate fi ars — se spune.
{
  const cup = M.parti.find((p) => p.cheie === 'casa_agua');
  const [cx, cy] = cup.centru;
  const px = [];
  for (let y = cy - 4; y <= cy + 4; y += 0.25) for (let x = cx - 4; x <= cx + 4; x += 0.25) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > 4) continue;
    // numai jumătatea dinspre soare (est), unde cupola e luminată
    if ((x - cx) * sVec[0] + (y - cy) * sVec[1] < 0.5) continue;
    const i = oIdx(x, y, depl.dx, depl.dy);
    if (i >= 0) px.push([OR[i], OG[i], OB[i]]);
  }
  const arse = px.filter((q) => q.some((c) => c >= 254)).length / px.length;
  pune('cupola', albedoDin(px), 'ortofoto', `jumătatea dinspre soare a cupolei Casei da Água; ${(arse * 100).toFixed(1)}% din pixeli arși`);
  materiale.cupola.arse = r3(arse);
}

// Crestele zidurilor, pe grupuri: zidăria ruinelor, zidurile văruite ale incintei, apeductul.
function creste(chei) {
  const px = [];
  for (const p of M.parti.filter((q) => chei.includes(q.cheie))) for (const z of p.ziduri ?? []) {
    for (let k = 1; k < z.linie.length; k++) {
      const [a, b] = [z.linie[k - 1], z.linie[k]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 0; d <= L; d += 0.25) {
        const i = oIdx(a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L, depl.dx, depl.dy);
        if (i >= 0) px.push([OR[i], OG[i], OB[i]]);
      }
    }
  }
  return px;
}
for (const [cheie, chei, ce] of [['zidarie', ['casa_opera', 'ruina_nv', 'ruina_se'], 'crestele zidurilor ruinelor (Casa da Ópera, ruinele NV și SE)'],
  ['zid_var', ['cercado', 'ermida_adro_ziduri'], 'crestele zidurilor incintei Casei da Água și ale adro-ului Ermidei']]) {
  const px = creste(chei);
  const arse = px.filter((q) => q.some((c) => c >= 254)).length / px.length;
  pune(cheie, albedoDin(px), 'ortofoto', `${ce}; ${(arse * 100).toFixed(1)}% din pixeli arși`);
  materiale[cheie].arse = r3(arse);
}

// Ce e vertical: din fotografia autorului.
{
  const P0 = JSON.parse(readFileSync('scripts/sanctuar/petice-culoare.json', 'utf8'));
  for (const P of [{ poza: P0.poza, petice: P0.petice }, ...(P0.alte ?? [])]) {
  const img = jpeg.decode(readFileSync(P.poza), { useTArray: true, maxMemoryUsageInMB: 1024 });
  for (const [mat, dr] of Object.entries(P.petice)) {
    const px = [];
    for (const [x0, y0, x1, y1] of dr) for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const i = (y * img.width + x) * 4;
      px.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
    }
    const arse = px.filter((q) => q.some((c) => c >= 254)).length / px.length;
    if (arse > 0.02) throw new Error(`${mat}: ${(arse * 100).toFixed(1)}% din pixeli sunt arși — albul ars nu e o măsurătoare`);
    pune(mat, albedoDin(px), 'fotografii', `peticele din ${P.poza.split('/').pop()}, ${(arse * 100).toFixed(2)}% arși`);
  }
  }
}

// Țigla din fotografie, nu din ortofoto. Pe același pietriș ortofotoul dă L 0,966
// (și e ars), fotografia 0,843: ortofotoul e mai luminos și mai spălat decât
// fotografiile din care vin varul și pietrișul. Amestecate, raportul dintre țiglă
// și var ar fi fals. Țigla bisericii nu se vede de pe terreiro: ia țigla
// fotografiată plus diferența OKLab dintre biserică și aripa N, măsurată pe
// ortofoto — o diferență între două măsurători ale aceluiași instrument.
if (materiale.tigla) {
  const ft = materiale.tigla.oklab, ob = materiale.tigla_biserica.oklab, on = materiale.tigla_aripa_n.oklab, os = materiale.tigla_aripa_s.oklab;
  const deriv = (d, de_ce) => { const L = ft.L + d[0], a = ft.a + d[1], b = ft.b + d[2]; const rgb = dinOklab([L, a, b]); return { rgb, culoare: hex(rgb), oklab: { L: r3(L), a: r3(a), b: r3(b) }, sursa: 'fotografii+ortofoto', de_ce }; };
  materiale.tigla_aripa_n_ortofoto = materiale.tigla_aripa_n; materiale.tigla_biserica_ortofoto = materiale.tigla_biserica; materiale.tigla_aripa_s_ortofoto = materiale.tigla_aripa_s;
  materiale.tigla_aripa_n = { ...materiale.tigla, de_ce: 'panta însorită a aripii N, pe fotografia de pe terreiro' };
  materiale.tigla_biserica = deriv([ob.L - on.L, ob.a - on.a, ob.b - on.b], 'țigla aripii N din fotografie, plus diferența biserică − aripa N din ortofoto');
  materiale.tigla_aripa_s = deriv([os.L - on.L, os.a - on.a, os.b - on.b], 'țigla aripii N din fotografie, plus diferența aripa S − aripa N din ortofoto');
}

// Un alb ars nu e o măsurătoare: peste 2% din pixeli la 254–255, materialul ia
// varul din fotografie — e același var, iar SIPA le spune la fel pe toate:
// „rebocadas e pintadas de branco".
for (const [k, m] of Object.entries(materiale)) {
  if (!(m.arse > 0.02)) continue;
  // Ruinele sunt zidărie de piatră brută, nevăruită (SIPA: Casa da Ópera „em
  // ruínas"; fotografia Commons din 2021 arată piatra goală): iau cantaria, același
  // calcar. Restul — incinta, adro-ul, cupola — sunt văruite și iau varul.
  const inlocuitor = k === 'zidarie' ? 'cantaria' : 'var';
  materiale[k] = { ...materiale[inlocuitor], sursa: 'fotografii', de_ce: `în ortofoto ${(m.arse * 100).toFixed(1)}% din pixeli sunt arși; ia ${inlocuitor === 'var' ? 'varul' : 'cantaria'} din fotografie (${m.de_ce})`, ortofoto_respins: { culoare: m.culoare, arse: m.arse } };
}

console.log('\nMaterialele (albedo, ca în paleta terenului):');
for (const [k, m] of Object.entries(materiale))
  console.log(`  ${k.padEnd(20)} ${m.culoare}  L ${m.oklab.L.toFixed(3)} a ${m.oklab.a.toFixed(3)} b ${m.oklab.b.toFixed(3)}  ${m.sursa.padEnd(10)} n ${m.n}  — ${m.de_ce}`);

writeFileSync('date-sursa/derivate/culori-sanctuar.json', JSON.stringify({
  generat: new Date().toISOString(),
  conventie: 'albedo ca în paleta-teren.json: L din cuantila 0,8, nuanța din pixelii peste mediană; apele de acoperiș aduse la plat sub lumina măsurată a ortofotoului',
  ortofoto: { deplasare_fata_de_lidar_m: [depl.dx, depl.dy], corelatie: r3(depl.r) },
  soare_ortofoto: { azimut: soare.az, elevatie: soare.el, k: r3(soare.k), a: r3(soare.a), y_plat: r3(yPlat), rms: r3(Math.sqrt(soare.e / soare.n)), ape: soare.n },
  materiale,
}, null, 1));
console.log('\nscris: date-sursa/derivate/culori-sanctuar.json');
