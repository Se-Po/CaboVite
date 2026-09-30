// Datele sanctuarului pentru pagină: public/data/sanctuar_vN.json.
//
//   npm run build-sanctuar -- sanctuar_vN
//
// Adună măsurătorile (masoara-sanctuar), instantaneul OSM (osm-sanctuar), culorile
// (culori-sanctuar) și intrările scrise de mână din scripts/sanctuar/, și le scrie
// în coordonatele scenei — x = X_TM06 + 94624, z = −137899 − Y_TM06, ancorate pe
// centrul cutiei lui harta_v2 —, ca pagina să nu mai proiecteze nimic.
//
// Un nume se scrie o singură dată, ca hărțile: o reparație de date primește numele următor.
//
// Licența fișierului e ODbL 1.0, fiindcă numele, drumurile și suprafețele vin din
// OpenStreetMap; valorile măsurate pe LiDAR și pe ortofotoul DGT rămân CC BY 4.0,
// iar atribuirile lor călătoresc cu fișierul.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cereFisier } from './comun/cere.mjs';
import { cadru } from './comun/rastru-sanctuar.mjs';

const nume = process.argv[2];
if (!/^sanctuar_v\d+$/.test(nume ?? '')) throw new Error('dă un nume: npm run build-sanctuar -- sanctuar_vN');
const iesire = `public/data/${nume}.json`;
// `--suprascrie-lucru` rescrie un nume încă în lucru — numai dacă git nu-l urmărește.
// Odată comis, numele e publicat (pushul pe main pleacă live), iar o reparație e alt nume.
if (existsSync(iesire)) {
  const urmarit = spawnSync('git', ['ls-files', '--error-unmatch', iesire], { stdio: 'ignore' }).status === 0;
  if (urmarit || !process.argv.includes('--suprascrie-lucru'))
    throw new Error(`${iesire} există${urmarit ? ' și e în git' : ''}; un nume se scrie o singură dată (o reparație e alt nume)`);
}

cereFisier('date-sursa/derivate/masuratori-sanctuar.json', 'măsurătorile', 'Rulează `npm run masoara-sanctuar`.');
const M = JSON.parse(readFileSync('date-sursa/derivate/masuratori-sanctuar.json', 'utf8'));
// Baza hărții pe care o încarcă pagina. harta_v4 are aceeași cutie ca harta_v2,
// deci aceeași ancoră: sanctuar_v2 se așază neschimbat.
const HARTA_BAZA = 'harta_v4';
const baza = JSON.parse(readFileSync(`public/data/${HARTA_BAZA}-dem.json`, 'utf8'));
const b = baza.bbox_tm06;
const ANCORA = { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 };
if (ANCORA.x !== -94624 || ANCORA.y !== -137899) throw new Error(`ancora hărții s-a schimbat: (${ANCORA.x}, ${ANCORA.y})`);
const cadre = Object.fromEntries(Object.entries(M.cadre).map(([k, c]) => [k, cadru(c)]));

const r2 = (v) => Math.round(v * 100) / 100;
const laScena = ([X, Y]) => [r2(X - ANCORA.x), r2(ANCORA.y - Y)];
/** Planul TM06 z = A·X + B·Y + C → în scenă y = a·x + b·z + c. */
const planScena = ({ A, B, C }) => [+A.toFixed(6), +(-B).toFixed(6), +(C + A * ANCORA.x + B * ANCORA.y).toFixed(4)];
const inchis = (p) => (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1] ? p.slice(0, -1) : p);
const parte = (k) => { const p = M.parti.find((q) => q.cheie === k); if (!p) throw new Error(`lipsește partea ${k}`); return p; };

// ------------------------------------------------------------ culorile
// PROVIZORIU până la culori-sanctuar: valorile de mai jos sunt aparența din
// ortofoto și din fotografii, nu albedo; se înlocuiesc toate la pasul culorilor.
const CULORI = existsSync('date-sursa/derivate/culori-sanctuar.json')
  ? JSON.parse(readFileSync('date-sursa/derivate/culori-sanctuar.json', 'utf8')).materiale
  : {
    var: { rgb: [226, 222, 212], sursa: 'provizoriu' },
    var_spate: { rgb: [178, 172, 162], sursa: 'provizoriu' },
    cantaria: { rgb: [152, 148, 136], sursa: 'provizoriu' },
    tigla_biserica: { rgb: [180, 110, 88], sursa: 'provizoriu' },
    tigla_aripi: { rgb: [190, 128, 100], sursa: 'provizoriu' },
    terasa: { rgb: [196, 190, 176], sursa: 'provizoriu' },
    zidarie: { rgb: [150, 140, 128], sursa: 'provizoriu' },
    cupola: { rgb: [236, 234, 228], sursa: 'provizoriu' },
  };

// Suprafețele de pe teren. Ortofotoul e ars pe pietrișul deschis — parcarea are
// 95,6% din pixeli la 254–255, terreiro-ul și potecile 3–4% —, deci nu e o
// măsurătoare acolo, la fel ca la var. Pietrișul se ia din prim-planul însorit al
// terreiro-ului, în fotografia autorului; potecile și pistele iau „poteca" din
// paleta terenului, adică solul de pământ măsurat de ea; asfaltul Avenidei 25 de
// Abril n-are nicio măsurătoare curată și ia pietrișul (NEVERIFICAT).
const SUPR = existsSync('date-sursa/derivate/suprafete-sanctuar.json') ? JSON.parse(readFileSync('date-sursa/derivate/suprafete-sanctuar.json', 'utf8')) : null;
const paletaTeren = JSON.parse(readFileSync('public/data/paleta-teren.json', 'utf8'));
const MATERIAL_SUPRAFATA = { terreiro: 'pietris', parcare: 'pietris', esplanada: 'pietris', drum_principal: 'pietris', drum_serviciu: 'pietris', poteca: 'poteca', pista: 'poteca' };
if (!CULORI.poteca) CULORI.poteca = { rgb: paletaTeren.materiale.poteca.rgb, sursa: 'fotografii', de_ce: 'din paleta terenului (public/data/paleta-teren.json), solul de pământ de sub picioare' };
const suprafete = (SUPR?.bucati ?? []).map((q) => ({ contur: q.poligon.map(laScena), material: MATERIAL_SUPRAFATA[q.material] ?? q.material, strat: q.strat }));

// ------------------------------------------------------------ corpurile

// Toaletele și căsuța de lângă cercado au acoperiș plat, alb în ortofoto: „terasa".
const materialAcoperis = (k) => (k.startsWith('biserica.') ? 'tigla_biserica' : /terasa|^toalete$|^casuta_cercado$/.test(k) ? 'terasa' :k === 'aripa_n.spate_m1' ? 'acoperis_spate_m1' : k.startsWith('aripa_n.') ? 'tigla_aripa_n' : 'tigla_aripa_s');
const corpuri = M.parti.filter((p) => p.tip === 'acoperis' && p.plane?.length).map((p) => ({
  cheie: p.cheie,
  contur: inchis(p.poligon_tm06).map(laScena),
  plane: p.plane.map(planScena),
  perete: 'var',
  acoperis: materialAcoperis(p.cheie),
}));
const faraPlane = M.parti.filter((p) => p.tip === 'acoperis' && !p.plane?.length).map((p) => p.cheie);
if (faraPlane.length) console.warn(`fără plane, deci lăsate deoparte: ${faraPlane.join(', ')}`);

const turnuri = M.parti.filter((p) => p.tip === 'turn').map((p) => ({
  cheie: p.cheie,
  contur: inchis(p.poligon_tm06).map(laScena),
  platforma: p.platforma,
  varf: p.varf.z,
  // Cornișa nu se vede de sus. Pe fotografia rectificată (fatade.json) banda ei
  // stă la 146,6–147,1 pe ambele turnuri; planșa REVIVE dădea ~146,5.
  cornisa: 146.6,
}));

const fatada = (() => {
  const p = parte('biserica.fatada');
  const c = cadre[p.cadru];
  return {
    cheie: p.cheie,
    // linia de bază pe fața fațadei și grosimea spre interior
    a: laScena(c.laXY(p.u[1], p.profil[0][0])), b: laScena(c.laXY(p.u[1], p.profil[p.profil.length - 1][0])),
    spre_interior: laScena(c.laXY(p.u[0], p.profil[0][0])),
    profil: p.profil.map(([v, y]) => [r2((v - p.profil[0][0]) / (p.profil[p.profil.length - 1][0] - p.profil[0][0])), y]),
  };
})();

const cupole = M.parti.filter((p) => p.tip === 'cupola' && p.cheie !== 'cruzeiro').map((p) => {
  const contur = inchis(p.poligon_tm06).map(laScena);
  const centru = laScena(p.centru);
  const raza = Math.max(...contur.map(([x, z]) => Math.hypot(x - centru[0], z - centru[1])));
  // Cornișa: unde profilul radial încetează să fie plat la margine. Aproximativ,
  // cota la 85% din rază; profilul de deasupra ei devine cupola.
  const pr = p.profil_radial.map(([r, y]) => [r, y]);
  const la = (r) => { let best = pr[0]; for (const q of pr) if (Math.abs(q[0] - r) < Math.abs(best[0] - r)) best = q; return best[1]; };
  const cornisa = r2(la(raza * 0.85));
  const profil = pr.filter(([r, y]) => r <= raza * 0.85 && y >= cornisa).sort((q, w) => w[0] - q[0]).map(([r, y]) => [r2(r), r2(y)]);
  profil.push([0, profil[profil.length - 1][1]]);
  return { cheie: p.cheie, contur, centru, cornisa, profil, laturi: contur.length === 6 ? 6 : 16, material: 'cupola' };
});

const ziduri = M.parti.filter((p) => p.tip === 'ziduri').flatMap((p) => p.ziduri.map((z, k) => ({
  cheie: `${p.cheie}.${k}`, linie: z.linie.map(laScena), sus: z.sus, grosime: z.grosime, material: ['cercado', 'ermida_adro_ziduri'].includes(p.cheie) ? 'zid_var' : 'zidarie',
})));

const apeduct = (() => {
  const p = parte('apeduct');
  const lin = p.poligon_tm06;
  // stațiile de 1 m ale profilului, înapoi în plan: s pe linia OSM
  const cum = [0];
  for (let k = 1; k < lin.length; k++) cum.push(cum[k - 1] + Math.hypot(lin[k][0] - lin[k - 1][0], lin[k][1] - lin[k - 1][1]));
  const la = (s) => {
    let k = 1; while (k < lin.length - 1 && cum[k] < s) k++;
    const t = (s - cum[k - 1]) / (cum[k] - cum[k - 1]);
    return [lin[k - 1][0] + (lin[k][0] - lin[k - 1][0]) * t, lin[k - 1][1] + (lin[k][1] - lin[k - 1][1]) * t];
  };
  // Tronsoanele înălțate: stații consecutive cu vârful la cel puțin 0,5 m peste sol.
  const tronsoane = [];
  let cur = null;
  for (const [s, sus, sol] of p.profil) {
    if (Number.isFinite(sus) && Number.isFinite(sol) && sus - sol >= 0.5) {
      if (!cur) { cur = { linie: [], sus: [] }; tronsoane.push(cur); }
      cur.linie.push(laScena(la(s))); cur.sus.push(r2(sus));
    } else cur = null;
  }
  return tronsoane.filter((t) => t.linie.length >= 3).map((t, k) => ({ cheie: `apeduct.${k}`, linie: t.linie, sus: t.sus.slice(0, -1), grosime: 0.9, material: 'zid_var' }));
})();

// Coșurile: pătrate orientate ca aripa lor, de la acoperiș până la vârful măsurat.
const cosuri = (M.cosuri ?? []).map((q, k) => {
  const c = cadre[q.cadru], [u, v] = c.laUV(q.x, q.y), l = q.latura / 2;
  const contur = [[u - l, v - l], [u + l, v - l], [u + l, v + l], [u - l, v + l]].map(([a, bb]) => laScena(c.laXY(a, bb)));
  return { cheie: `cos.${k}`, parte: q.parte, contur, baza: r2(q.acoperis - 0.3), sus: q.sus, material: 'var' };
});

const cruzeiro = (() => {
  const p = parte('cruzeiro');
  return { cheie: 'cruzeiro', centru: laScena(inchis(p.poligon_tm06).reduce((a, q, _, v) => [a[0] + q[0] / v.length, a[1] + q[1] / v.length], [0, 0])), varf_platforma: p.profil_radial[0][1] };
})();

// ------------------------------------------------------------ fațadele
// Din scripts/sanctuar/fatade.json: arcadele aripilor, ferestrele etajului, fațada
// bisericii, golurile turnurilor, pasajele corpurilor de legătură. Toate au fost
// citite pe fotografia autorului, rectificată prin camera ei calibrată pe model.

cereFisier('scripts/sanctuar/fatade.json', 'fațadele', 'Fișierul e scris de mână; vezi nota din el.');
const FAT = JSON.parse(readFileSync('scripts/sanctuar/fatade.json', 'utf8'));
const arcade = [];
const detalii = [];
const r3 = (v) => Math.round(v * 1000) / 1000;

/** O linie de fațadă în scenă: `la(u, v)` cu u de-a lungul ei și v spre `interior`. */
function linieScena([A, B], interior) {
  const a = laScena(A), b = laScena(B);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  let m = [-d[1], d[0]];
  if ((interior[0] - a[0]) * m[0] + (interior[1] - a[1]) * m[1] < 0) m = [-m[0], -m[1]];
  return {
    a, d, m,
    la: (u, v = 0) => [r3(a[0] + d[0] * u + m[0] * v), r3(a[1] + d[1] * u + m[1] * v)],
    uv: ([x, z]) => [(x - a[0]) * d[0] + (z - a[1]) * d[1], (x - a[0]) * m[0] + (z - a[1]) * m[1]],
  };
}
const centroid = (c) => c.reduce((s, p) => [s[0] + p[0] / c.length, s[1] + p[1] / c.length], [0, 0]);
const yRoof = (c, x, z) => Math.min(...c.plane.map((pl) => pl[0] * x + pl[1] * z + pl[2]));
/** O placă dreptunghiulară pe o linie de fațadă: u în [u0, u1], cote [y0, y1], scoasă spre terreiro. */
const placaPe = (lin, v, [u0, u1], [y0, y1], iesire, material, cheie, extra = {}) => ({
  cheie, o: lin.la(0, v), d: lin.d.map(r3), n: lin.m.map((q) => r3(-q)),
  contur: [[r3(u0), y0], [r3(u1), y0], [r3(u1), y1], [r3(u0), y1]], iesire, material, ...extra,
});
/** O ramă în jurul golului [u0, u1] × [y0, y1], cu bare late de `l`; pagina o împarte în bare. */
const rama = (lin, v, u, y, l, iesire, material, cheie, { faraJos = false } = {}) => ({
  cheie, tip: 'rama', o: lin.la(0, v), d: lin.d.map(r3), n: lin.m.map((q) => r3(-q)),
  u: u.map(r3), y, l, iesire, material, ...(faraJos ? { fara_jos: true } : {}),
});

// --- arcadele aripilor: corpurile dinspre terreiro se retrag în spatele galeriei
for (const A of FAT.arcade) {
  const lunga = corpuri.find((c) => c.cheie === `${A.aripa}.lunga`);
  const lin = linieScena(A.zid, centroid(lunga.contur));
  const D = A.adancime_galerie, G = D + 0.1; // peretele corpului, cu 10 cm în spatele fundului galeriei
  let uCapat = -Infinity;
  const noi = [];
  for (const c of corpuri.filter((q) => q.cheie.startsWith(`${A.aripa}.`) && !q.cheie.includes('legatura'))) {
    const n = c.contur.length;
    // latura dinspre terreiro: paralelă cu zidul (sub 10°) și la cel mult 1,5 m de el
    const k = c.contur.findIndex((p, i) => {
      const q = c.contur[(i + 1) % n], [, vp] = lin.uv(p), [, vq] = lin.uv(q);
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const par = Math.abs(((q[0] - p[0]) * lin.m[0] + (q[1] - p[1]) * lin.m[1]) / L) < Math.sin(10 * Math.PI / 180);
      // … și cel puțin în parte la est de joncțiunea cu corpul de legătură (u > 0,5)
      return par && vp > -1.5 && vp < 0.5 && vq > -1.5 && vq < 0.5 && Math.max(lin.uv(p)[0], lin.uv(q)[0]) > 0.5;
    });
    if (k < 0) continue;
    const P = c.contur[k], Q = c.contur[(k + 1) % n];
    const [uP, vP] = lin.uv(P), [uQ, vQ] = lin.uv(Q);
    uCapat = Math.max(uCapat, uP, uQ);
    // corpul: latura dinspre terreiro mutată pe fundul galeriei
    c.contur[k] = lin.la(uP, G); c.contur[(k + 1) % n] = lin.la(uQ, G);
    // etajul de peste galerie: de la tavan până la acoperișul aceluiași corp
    noi.push({ cheie: `${c.cheie}.etaj`, contur: [lin.la(uP, 0), lin.la(uQ, 0), lin.la(uQ, G), lin.la(uP, G)],
      plane: c.plane, perete: c.perete, acoperis: c.acoperis, baza: A.cote.tavan });
    // streașina: fâșia de acoperiș dintre zid și muchia măsurată pe LiDAR, cu dedesubt drept
    // Numai dacă muchia e în fața zidului la ambele capete: altfel patrulaterul s-ar
    // răsuci, iar un contur neconvex n-are ce căuta în plicMinim.
    if (Math.max(vP, vQ) < -0.05) {
      const contur = [P, Q, lin.la(uQ, 0), lin.la(uP, 0)];
      const jos = r2(Math.min(...contur.map(([x, z]) => yRoof(c, x, z))) - 0.15);
      noi.push({ cheie: `${c.cheie}.streasina`, contur, plane: c.plane, perete: c.perete, acoperis: c.acoperis, baza: jos, jos: true });
    }
  }
  corpuri.push(...noi);
  // stâlpii: cei măsurați, apoi arcele rămase până la `arce_total` împărțite egal până
  // la capăt (NEVERIFICAT). Primul stâlp măsurat e semistâlpul de la vest, deci n stâlpi
  // închid n − 1 arce.
  const w = A.latime_stalp, masurati = A.stalpi_masurati;
  const capat = uCapat - w / 2, ultim = masurati[masurati.length - 1];
  const nr = A.arce_total - (masurati.length - 1);
  if (!(nr >= 0)) throw new Error(`${A.cheie}: arce_total ${A.arce_total} < arcele măsurate (${masurati.length - 1})`);
  const pas = nr ? (capat - ultim) / nr : 0;
  const stalpi = [...masurati, ...Array.from({ length: nr }, (_, i) => ultim + pas * (i + 1))].map((u) => [r3(u), w]);
  arcade.push({ cheie: A.cheie, a: lin.a.map(r3), d: lin.d.map(r3), m: lin.m.map(r3), stalpi,
    pardoseala: A.cote.pardoseala, nastere: A.cote.nastere, cheie_arc: A.cote.cheie, tavan: A.cote.tavan, adancime: D,
    masurati: masurati.length, pas_extrapolat: r3(pas) });
  console.log(`${A.cheie}: ${masurati.length} stâlpi măsurați, ${nr} extrapolați la pasul ${pas.toFixed(3)} m, capăt la u = ${capat.toFixed(2)}`);

  // ferestrele etajului: perechile măsurate rămân unde sunt; celelalte umplu zidul înainte
  // și după ele, la pas egal pe fiecare parte, cu o jumătate de pas la capăt — cum stă
  // prima pereche măsurată a aripii de sud. Câte vin înainte se alege cât toți pașii,
  // măsurați și puși, să fie cât mai egali (NEVERIFICAT).
  const F = FAT.ferestre_etaj.find((q) => q.arcada === A.cheie);
  if (F) {
    const m = F.centre_masurate, rest = F.perechi - m.length, c0 = m[0], c1 = m[m.length - 1];
    if (!(rest >= 0)) throw new Error(`${F.cheie}: perechi ${F.perechi} < perechile măsurate (${m.length})`);
    let ales = null;
    for (let nb = 0; nb <= rest; nb++) {
      const na = rest - nb, sb = c0 / (nb + 0.5), sa = (uCapat - c1) / (na + 0.5);
      const pasi = [...Array(nb).fill(sb), ...m.slice(1).map((c, i) => c - m[i]), ...Array(na).fill(sa)];
      const med = pasi.reduce((s, p) => s + p, 0) / pasi.length;
      const abatere = pasi.reduce((s, p) => s + (p - med) ** 2, 0);
      if (!ales || abatere < ales.abatere) ales = { nb, na, sb, sa, abatere };
    }
    const centre = [...Array.from({ length: ales.nb }, (_, i) => c0 - ales.sb * (ales.nb - i)), ...m,
      ...Array.from({ length: ales.na }, (_, i) => c1 + ales.sa * (i + 1))];
    console.log(`${F.cheie}: ${ales.nb} perechi înainte de cele ${m.length} măsurate (pas ${ales.sb.toFixed(2)} m), ${ales.na} după (pas ${ales.sa.toFixed(2)} m)`);
    for (let i = 0; i < centre.length; i++) {
      const c = centre[i];
      for (const semn of [-1, 1]) {
        const uc = c + (semn * F.distanta_in_pereche) / 2;
        // numărul vine dintr-o sursă, deci o fereastră care iese din zid oprește, nu dispare
        if (uc - F.latime / 2 < 0.3 || uc + F.latime / 2 > uCapat - 0.3) throw new Error(`${F.cheie}: fereastra ${i} iese din zid (u ${uc.toFixed(2)} din ${uCapat.toFixed(2)})`);
        detalii.push({ ...rama(lin, 0, [uc - F.latime / 2, uc + F.latime / 2], F.cote, 0.14, 0.07, 'cantaria', `${A.aripa}.fereastra.${i}.${semn < 0 ? 'a' : 'b'}`), parte: `${A.aripa}.etaj` });
      }
    }
  }
}

// --- pasajele corpurilor de legătură: etajul pe tavan, pasajul boltit dedesubt
for (const Lg of FAT.legaturi) {
  const c = corpuri.find((q) => q.cheie === Lg.corp);
  const lin = linieScena(Lg.fata, centroid(c.contur));
  const len = lin.uv(laScena(Lg.fata[1]))[0];
  const T = Math.max(...c.contur.map((p) => lin.uv(p)[1]));
  c.baza = Lg.tavan;
  const j = Lg.ancadrament, R = (len - 2 * j) / 2;
  arcade.push({ cheie: `${Lg.corp}.pasaj`, a: lin.a.map(r3), d: lin.d.map(r3), m: lin.m.map(r3),
    stalpi: [[r3(j / 2), j], [r3(len - j / 2), j]], nastere: r2(Lg.cheie - R), cheie_arc: Lg.cheie, tavan: Lg.tavan, adancime: 0, grosime: r3(T) });
  detalii.push({ ...rama(lin, 0, Lg.fereastra.u, Lg.fereastra.y, 0.12, 0.08, 'cantaria', `${Lg.corp}.fereastra`), parte: Lg.corp });
  detalii.push({ ...placaPe(lin, 0, Lg.fereastra.u, Lg.fereastra.y, [0, 0.02], 'lemn', `${Lg.corp}.fereastra.lemn`), parte: Lg.corp, ocluzie: 0.8 });
  detalii.push({ ...placaPe(lin, 0, Lg.balcon.u, Lg.balcon.y, [0, Lg.balcon.iesire], 'cantaria', `${Lg.corp}.balcon`), parte: Lg.corp });
  detalii.push({ ...placaPe(lin, 0, [-0.1, len + 0.1], [Lg.cornisa - 0.25, Lg.cornisa], [0, 0.2], 'var', `${Lg.corp}.cornisa`), parte: Lg.corp });
}

// --- biserica: registrul turnurilor, golurile clopotelor, detaliile fațadei
{
  const B = FAT.biserica;
  const nava = corpuri.find((c) => c.cheie === 'biserica.nava');
  const lin = linieScena(B.linie, centroid(nava.contur));
  for (const t of turnuri) t.registru = B.registru_turnuri;
  // latura unui turn pe o direcție: normala spre afară cea mai apropiată de `spre`
  const latura = (t, spre) => {
    const cc = centroid(t.contur);
    let best = -1, bestDot = -Infinity;
    t.contur.forEach((p, k) => {
      const q = t.contur[(k + 1) % t.contur.length], mx = (p[0] + q[0]) / 2 - cc[0], mz = (p[1] + q[1]) / 2 - cc[1];
      const L = Math.hypot(mx, mz), dot = (mx * spre[0] + mz * spre[1]) / L;
      if (dot > bestDot) { bestDot = dot; best = k; }
    });
    return best;
  };
  const DIR = { E: [-lin.m[0], -lin.m[1]], N: [0, -1], S: [0, 1] };
  for (const g of B.goluri_turn) {
    const t = turnuri.find((q) => q.cheie === g.turn);
    t.adancime_gol = B.adancime_gol;
    t.goluri = g.fete.map((f) => {
      const k = latura(t, DIR[f]), p = t.contur[k], q = t.contur[(k + 1) % t.contur.length];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), w = g.u[1] - g.u[0];
      let uc;
      if (f === 'E') {
        // centrul măsurat, proiectat pe latura turnului
        const cPt = lin.la((g.u[0] + g.u[1]) / 2, 0);
        uc = ((cPt[0] - p[0]) * (q[0] - p[0]) + (cPt[1] - p[1]) * (q[1] - p[1])) / L;
      } else uc = L / 2; // a doua față: centrată, NEVERIFICAT
      return { latura: k, fata: f, u: [r3(uc - w / 2), r3(uc + w / 2)], prag: g.prag, cheie: g.cheie };
    });
  }
  // suprafața pe care stă un detaliu: fața de est a turnului sau placa fațadei
  const fataTurn = (t) => { const k = latura(t, DIR.E), p = t.contur[k], q = t.contur[(k + 1) % t.contur.length]; return [lin.uv(p), lin.uv(q)]; };
  const suprafete = [
    { pana: 4.4, capete: fataTurn(turnuri.find((q) => q.cheie === 'biserica.turn_s')) },
    { pana: 15.8, capete: [lin.uv(fatada.a), lin.uv(fatada.b)] },
    { pana: Infinity, capete: fataTurn(turnuri.find((q) => q.cheie === 'biserica.turn_n')) },
  ];
  const vLa = (u) => {
    const s = suprafete.find((q) => u < q.pana).capete, [[u0, v0], [u1, v1]] = s;
    return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
  };
  for (const q of B.detalii) {
    const um = (q.u[0] + q.u[1]) / 2, v = vLa(um);
    const y = q.y.map((h) => (h === 'talpa' ? 131.6 : h));
    const parte = `biserica.${q.cheie}`;
    if (q.tip === 'rama') {
      detalii.push({ ...rama(lin, v, q.u, y, q.latime_rama, q.iesire, q.material, parte, { faraJos: q.fara_jos }), parte: 'biserica.fatada' });
      if (q.umplutura) detalii.push({ ...placaPe(lin, v, q.u, y, [0, 0.03], q.umplutura, `${parte}.umplutura`), parte: 'biserica.fatada', ocluzie: 0.8 });
    } else if (q.tip === 'semicerc' || q.tip === 'disc') {
      const uc = um, hw = (q.u[1] - q.u[0]) / 2, n = q.tip === 'disc' ? 20 : 12;
      const contur = q.tip === 'disc'
        ? Array.from({ length: n }, (_, k) => [r3(uc + hw * Math.cos((2 * Math.PI * k) / n)), r3((y[0] + y[1]) / 2 + ((y[1] - y[0]) / 2) * Math.sin((2 * Math.PI * k) / n))])
        : Array.from({ length: n + 1 }, (_, k) => [r3(uc + hw * Math.cos((Math.PI * k) / n)), r3(y[0] + (y[1] - y[0]) * Math.sin((Math.PI * k) / n))]);
      detalii.push({ cheie: parte, parte: 'biserica.fatada', o: lin.la(0, v), d: lin.d.map(r3), n: lin.m.map((m) => r3(-m)), contur, iesire: [0, q.iesire], material: q.material });
    } else if (q.tip === 'pinaclu') {
      const l = (q.u[1] - q.u[0]) / 2, [cx, cz] = lin.la(um, v - q.iesire / 2);
      const e = [lin.d[0] * l, lin.d[1] * l], f = [lin.m[0] * l, lin.m[1] * l];
      detalii.push({ cheie: parte, parte: 'biserica.fatada', tip: 'pinaclu', material: q.material, y,
        baza: [[cx - e[0] - f[0], cz - e[1] - f[1]], [cx + e[0] - f[0], cz + e[1] - f[1]], [cx + e[0] + f[0], cz + e[1] + f[1]], [cx - e[0] + f[0], cz - e[1] + f[1]]].map((p) => p.map(r3)) });
    } else {
      // cutie: ușă, pilastru, cornișă, soclu, treaptă
      detalii.push({ ...placaPe(lin, v, q.u, y, [0, q.iesire], q.material, parte), parte: 'biserica.fatada', ...(q.material === 'lemn' ? { ocluzie: 0.8 } : {}) });
    }
  }
}

const biserica = parte('biserica.nava');
const poi = {
  // Ancora etichetei: deasupra vârfului celui mai înalt al bisericii.
  ancora: (() => { const [x, z] = laScena(cadre.biserica.laXY(-12, 0)); return [x, r2(Math.max(...turnuri.map((t) => t.varf)) + 6), z]; })(),
  tinta: (() => { const [x, z] = laScena(cadre.biserica.laXY(60, 0)); return [x, r2(biserica.sol.mediana_inel ?? 132.3), z]; })(),
  // Punctul de privire al zborului: dinspre SSV, ca poza de referință — biserica în
  // față, aripile spre Casa da Água în fund —, la 320 m și 30° deasupra orizontului.
  // Azimutul e al poziției camerei, față de nordul adevărat, ca cifra busolei.
  zbor: null,
};

poi.zbor = { tinta: poi.tinta, distanta: 320, azimut: 205, elevatie: 30 };

const date = {
  nume, versiune_schema: 1, generat: new Date().toISOString(),
  baza: HARTA_BAZA, ancora_tm06: ANCORA,
  licenta: 'ODbL 1.0', licenta_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  surse: [
    { cheie: 'osm', nume: 'OpenStreetMap', producator: 'contribuitorii OpenStreetMap', licenta: 'ODbL 1.0',
      atributie: '© contribuitorii OpenStreetMap, ODbL 1.0', portal: 'https://www.openstreetmap.org/copyright' },
    { cheie: 'mds', nume: 'Levantamento LiDAR de Portugal Continental 2024-2025 — MDS și MDT 50 cm', producator: 'Direção-Geral do Território (DGT)',
      licenta: 'CC BY 4.0', atributie: 'Dados LiDAR (MDS e MDT 50 cm): © Direção-Geral do Território, Levantamento LiDAR de Portugal Continental 2024-2025, CC BY 4.0',
      portal: 'https://cdd.dgterritorio.gov.pt/' },
    // Ortofotoul DGT: culorile acoperișurilor (culori-sanctuar) și lățimea drumurilor
    // (suprafete-sanctuar). Atribuirea e luată la caracter din paleta terenului, ca
    // pagina s-o contopească cu a terenului într-un singur rând, cu ambele prelucrări.
    { cheie: 'ortofoto', nume: 'ORTOS-2025', producator: paletaTeren.ortofoto.producator,
      licenta: paletaTeren.ortofoto.licenta, atributie: paletaTeren.ortofoto.atributie, portal: paletaTeren.ortofoto.portal },
  ],
  materiale: CULORI,
  corpuri, turnuri, fatada, arcade, detalii, cupole, ziduri, apeduct, cosuri, cruzeiro, suprafete, poi,
};
writeFileSync(iesire, JSON.stringify(date));
const kb = (readFileSync(iesire).length / 1024).toFixed(1);
console.log(`scris ${iesire}: ${corpuri.length} corpuri, ${arcade.length} arcade, ${detalii.length} detalii, ${turnuri.length} turnuri, ${cupole.length} cupole, ${ziduri.length} ziduri, ${apeduct.length} tronsoane de apeduct, ${cosuri.length} coșuri, ${suprafete.length} suprafețe; ${kb} KB`);
