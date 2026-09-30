// Clădirile din afara sanctuarului: farul, clădirile de lângă el și ruinele de la
// sud-vest.
//
//   npm run build-cladiri -- cladiri_vN [--suprascrie-lucru]
//   npm run build-cladiri -- cladiri_vN --proba      numai măsoară și tipărește
//
// Intră: instantaneul OSM al lui osm-cladiri (amprentele), inventarul
// (scripts/cladiri/inventar.json: ce intră și de ce), dalele MDS/MDT de 50 cm
// (înălțimile) și ortofotoul (materialul acoperișurilor). Iese
// public/data/cladiri_vN.json, în schema sanctuarului — corpuri cu plane de
// acoperiș, o cupolă —, pe care pagina îl va construi cu același cod
// (creeazaSanctuar), și
// date-sursa/derivate/masuratori-cladiri.json.
//
// Pe fiecare clădire:
// - AMPRENTA OSM SE ÎNREGISTREAZĂ PE LiDAR. La sanctuar amprentele cad pe clădiri
//   (98,3%); aici nu: sunt mutate cu 0,4–2,2 m, fiecare altfel. Se caută
//   translația, în pași de 0,25 m pe ±3,5 m, care maximizează pixelii de clădire
//   (nMDS > 1 m) din amprentă minus pixelii de sol. Forma rămâne a OSM-ului;
// - o amprentă concavă se taie în părți convexe (triangulare prin tăierea urechilor,
//   apoi lipirea poligoanelor vecine cât rămân convexe — Hertel–Mehlhorn): generatorul
//   de corpuri cere contur convex;
// - acoperișul fiecărei părți e MINIMUL planelor găsite cu RANSAC (comun/plane.mjs)
//   pe pixelii MDS de la cel puțin 0,75 m de marginea clădirii, ca la sanctuar. O
//   parte cu prea puțini pixeli ia planele clădirii întregi;
// - materialul acoperișului: referința sanctuarului cea mai apropiată, după apa cea
//   mai puțin arsă în ortofoto (alegeMaterial). Nu după pantă: 156262880 are ape de
//   48° și e țiglă, dar ortofotoul îl dă aproape neutru. Albedourile sunt ale
//   sanctuarului, aplicate prin asemănare — scris ca atare în date.
//
// Farul (man_made=lighthouse) e o cupolă: prismă hexagonală până la platformă, apoi
// profilul radial al MDS-ului, rotit — ca la Casa da Água. Hexagonul OSM e mai mare
// decât turnul: la ~5,5 m de ax MDS-ul coboară pe acoperișul casei lipite de el. Se
// înregistrează deci și cu scară, pe pixelii de peste PRAG_TURN; clădirile care îl
// ating își caută acoperișul fără pixelii lui.
//
// Licența: ODbL 1.0 (amprentele OSM), cu MDS/MDT și ortofoto DGT, CC BY 4.0.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fereastraLidar } from './comun/lidar.mjs';
import { laTM06, inPoligon, arie } from './comun/tm06.mjs';
import { creeazaRansac, zMin, zPlan } from './comun/plane.mjs';
import { deschideOrtofoto, fereastra } from './comun/ortofoto.mjs';
import { laOklab } from './comun/oklab.mjs';
import { cereFisier } from './comun/cere.mjs';
import { scriePng } from './comun/png.mjs';

const PRAG_CLADIRE = 1;     // m peste sol: clădire
const PRAG_TURN = 12;       // m peste sol: turnul farului; casa lipită de el are cel mult ~7
const CAUTARE = 3.5;        // m, raza căutării translației
const PAS_CAUTARE = 0.25;
const MARGINE_PLAN = 0.75;  // m de la marginea clădirii: pixelii acoperișului
const MIN_PARTE = 40;       // pixeli: sub atât, partea ia planele clădirii
const PRAG_TREAPTA = 0.5;   // m, p90 al abaterii peste care o parte se cercetează ca treaptă
// Acoperișurile sanctuarului cu care se compară culoarea, măsurate la fel pe ortofoto.
const REFERINTE = ['tigla_biserica', 'tigla_aripa_n', 'tigla_aripa_s', 'terasa', 'acoperis_spate_m1'];
// Albul se arde în ortofoto (un canal ≥ 254). Arsă peste atât chiar pe apa cea mai puțin
// luminată, suprafața e albă: țiglele au acolo 0–4%, acoperișurile albe 82–94%.
const PRAG_ALB = 0.5;
const ORTO = 'date-sursa/ortofoto/ortos2025_cog_25cm_rgbi_jpg_464-3_v02.tif';
const ZBOR = 'date-sursa/derivate/zbor.json';
const INVENTAR = 'scripts/cladiri/inventar.json';

const nume = process.argv[2];
if (!/^cladiri_v\d+$/.test(nume ?? '')) throw new Error('dă un nume: npm run build-cladiri -- cladiri_vN');
const iesire = `public/data/${nume}.json`;
const doarProba = process.argv.includes('--proba');
if (existsSync(iesire) && !doarProba) {
  const urmarit = spawnSync('git', ['ls-files', '--error-unmatch', iesire], { stdio: 'ignore' }).status === 0;
  if (urmarit || !process.argv.includes('--suprascrie-lucru'))
    throw new Error(`${iesire} există${urmarit ? ' și e în git' : ''}; un nume se scrie o singură dată`);
}

const MAN = 'scripts/cladiri/osm-manifest.json';
cereFisier(MAN, 'manifestul OSM al clădirilor', 'Rulează întâi: npm run osm-cladiri');
const man = JSON.parse(readFileSync(MAN, 'utf8'));
const inst = JSON.parse(readFileSync(`date-sursa/osm/${man.fisier}`, 'utf8'));
const inventar = existsSync(INVENTAR) ? JSON.parse(readFileSync(INVENTAR, 'utf8')) : null;
const baza = JSON.parse(readFileSync('public/data/harta_v4-dem.json', 'utf8'));
const bb = baza.bbox_tm06;
const ANCORA = { x: (bb.xMin + bb.xMax) / 2, y: (bb.yMin + bb.yMax) / 2 };
const sanctuar = JSON.parse(readFileSync('public/data/sanctuar_v2.json', 'utf8'));

const ransac = creeazaRansac({ saminta: 20260930, tol: 0.12 });
const r2 = (v) => Math.round(v * 100) / 100;
const laScena = ([X, Y]) => [r2(X - ANCORA.x), r2(ANCORA.y - Y)];
const planScena = ({ A, B, C }) => [+A.toFixed(6), +(-B).toFixed(6), +(C + A * ANCORA.x + B * ANCORA.y).toFixed(4)];
const cuantila = (v, q) => { const a = Float64Array.from(v).sort(); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };
const xy = (P) => P.map(([x, y]) => ({ x, y }));
const c_id = (c) => +c.cheie.split('.')[1];
const panta = (pl) => (Math.atan(Math.hypot(pl.A, pl.B)) * 180) / Math.PI;

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };

// ------------------------------------------------------------ geometrie plană

const cruce = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** Cât iese vârful q din coarda vecinilor lui, în metri; negativ = concav (CCW). */
const iesire_ = (a, q, b) => cruce(a, q, b) / Math.hypot(b[0] - a[0], b[1] - a[1]);
const COLINIAR = 0.05;   // m: un vârf mai aproape de coarda vecinilor e doar un nod pe latură
const convex = (p, tol = 0.02) => p.every((q, i) => iesire_(p[(i + p.length - 1) % p.length], q, p[(i + 1) % p.length]) >= -tol);

/**
 * Amprenta în TM06, fără nodul de închidere, în sens trigonometric, fără nodurile
 * de pe laturi. 156262936 are cinci, la 1–5 mm de latură — nodurile comune cu
 * vecinii —, iar unul la −1 mm ar face concav un dreptunghi.
 */
const tm = (el) => {
  let p = el.noduri.map(([, , la, lo]) => { const q = laTM06(lo, la); return [q.x, q.y]; });
  if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  const A = p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0);
  if (A < 0) p = p.reverse();
  for (let scos = true; scos && p.length > 3;) {
    scos = false;
    const i = p.findIndex((q, i) => Math.abs(iesire_(p[(i + p.length - 1) % p.length], q, p[(i + 1) % p.length])) < COLINIAR);
    if (i >= 0) { p.splice(i, 1); scos = true; }
  }
  return p;
};
const inTri = (q, a, b, c) => cruce(a, b, q) >= 0 && cruce(b, c, q) >= 0 && cruce(c, a, q) >= 0;
const centroid = (P) => {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], c = x0 * y1 - x1 * y0;
    A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  return [cx / (3 * A), cy / (3 * A)];
};

/** Tăierea urechilor: triunghiuri ca indici în p (CCW). */
function triunghiuri(p) {
  const idx = p.map((_, i) => i), out = [];
  for (let paza = 0; idx.length > 3; paza++) {
    if (paza > 10000) throw new Error('triangularea nu se termină: poligonul nu e simplu');
    const k = idx.findIndex((ib, k) => {
      const ia = idx[(k + idx.length - 1) % idx.length], ic = idx[(k + 1) % idx.length];
      return cruce(p[ia], p[ib], p[ic]) > 1e-9
        && !idx.some((j) => j !== ia && j !== ib && j !== ic && inTri(p[j], p[ia], p[ib], p[ic]));
    });
    if (k < 0) throw new Error('nicio ureche: poligonul nu e simplu');
    out.push([idx[(k + idx.length - 1) % idx.length], idx[k], idx[(k + 1) % idx.length]]);
    idx.splice(k, 1);
  }
  out.push(idx.slice());
  return out;
}

/** Hertel–Mehlhorn: lipește poligoanele vecine cât rezultatul rămâne convex. */
function parti(p) {
  if (convex(p)) return [p];
  const poli = triunghiuri(p);
  for (let schimbat = true; schimbat;) {
    schimbat = false;
    cauta: for (let a = 0; a < poli.length; a++) for (let b = a + 1; b < poli.length; b++) {
      const A = poli[a], B = poli[b];
      for (let i = 0; i < A.length; i++) {
        // muchia comună: (u, v) în A, (v, u) în B
        const u = A[i], v = A[(i + 1) % A.length];
        const k = B.findIndex((w, t) => w === v && B[(t + 1) % B.length] === u);
        if (k < 0) continue;
        // A de la v până la u, apoi B de după u până înainte de v
        const unit = [];
        for (let t = 1; t <= A.length; t++) unit.push(A[(i + t) % A.length]);
        for (let t = 2; t < B.length; t++) unit.push(B[(k + t) % B.length]);
        if (!convex(unit.map((j) => p[j]))) continue;
        poli.splice(b, 1); poli[a] = unit; schimbat = true;
        break cauta;
      }
    }
  }
  return poli.map((q) => q.map((j) => p[j]));
}

function distMargine(P, x, y) {
  let d = Infinity;
  for (let k = 0; k < P.length; k++) {
    const a = P[k], b = P[(k + 1) % P.length], ux = b[0] - a[0], uy = b[1] - a[1], L2 = ux * ux + uy * uy;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (y - a[1]) * uy) / L2));
    d = Math.min(d, Math.hypot(x - a[0] - t * ux, y - a[1] - t * uy));
  }
  return d;
}

/** Partea unui poligon convex din semiplanul n·p ≤ t (Sutherland–Hodgman, o singură tăietură). */
function taie(P, n, t) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const sa = n[0] * a[0] + n[1] * a[1] - t, sb = n[0] * b[0] + n[1] * b[1] - t;
    if (sa <= 0) out.push(a);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) { const u = sa / (sa - sb); out.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]); }
  }
  return out;
}

// ------------------------------------------------------------ acoperișul unei părți

/** Planele unei părți și abaterile pixelilor față de minimul lor. */
function potriveste(pts, planeRezerva, maxPlane = 3) {
  let plane = pts.length >= MIN_PARTE ? ransac(pts, maxPlane, 12) : [];
  const proprii = plane.length > 0;
  if (!proprii) plane = planeRezerva;
  const rez = pts.map((q) => q.z - zMin(plane, q.x, q.y));
  return { plane, proprii, rez, p90: rez.length ? cuantila(rez.map(Math.abs), 0.9) : 0 };
}

/**
 * Un acoperiș în TREPTE nu e minimul unor plane: planul de jos, prelungit, taie prin
 * cel de sus. Dacă pe o parte minimul lasă un p90 peste PRAG_TREAPTA, pixelii se
 * etichetează după planul cel mai apropiat, iar partea se taie cu dreapta care
 * desparte cel mai bine cele două plane mai mari. Tăietura rămâne numai dacă p90
 * scade cu cel puțin 0,2 m.
 */
function treapta(Q, pts, p) {
  if (p.plane.length < 2 || p.p90 <= PRAG_TREAPTA) return null;
  const et = pts.map((q) => { let k = 0; p.plane.forEach((pl, j) => { if (Math.abs(q.z - zPlan(pl, q.x, q.y)) < Math.abs(q.z - zPlan(p.plane[k], q.x, q.y))) k = j; }); return k; });
  const nr = p.plane.map((_, j) => et.filter((k) => k === j).length);
  const [A, B] = nr.map((n, j) => [n, j]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, j]) => j);
  const cen = (j) => { const s = pts.filter((_, i) => et[i] === j); return [s.reduce((a, q) => a + q.x, 0) / s.length, s.reduce((a, q) => a + q.y, 0) / s.length]; };
  const [ca, cb] = [cen(A), cen(B)], L = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
  if (L < 0.5) return null;
  const n = [(cb[0] - ca[0]) / L, (cb[1] - ca[1]) / L];
  // pragul t: cele mai puține etichete A dincolo și B dincoace
  const s = pts.map((q, i) => ({ v: n[0] * q.x + n[1] * q.y, e: et[i] })).filter((q) => q.e === A || q.e === B).sort((a, b) => a.v - b.v);
  let best = { t: 0, gresite: Infinity }, bDincoace = 0, aDincolo = s.filter((q) => q.e === A).length;
  for (let i = 0; i < s.length; i++) {
    if (s[i].e === A) aDincolo--; else bDincoace++;
    const g = aDincolo + bDincoace;
    if (g < best.gresite && i + 1 < s.length) best = { t: (s[i].v + s[i + 1].v) / 2, gresite: g };
  }
  const Q1 = taie(Q, n, best.t), Q2 = taie(Q, [-n[0], -n[1]], -best.t);
  if (Q1.length < 3 || Q2.length < 3) return null;
  const Pxy1 = xy(Q1), Pxy2 = xy(Q2);
  const p1 = pts.filter((q) => inPoligon(q.x, q.y, Pxy1)), p2 = pts.filter((q) => inPoligon(q.x, q.y, Pxy2));
  const r1 = potriveste(p1, [p.plane[A]], 2), r2_ = potriveste(p2, [p.plane[B]], 2);
  const p90 = cuantila([...r1.rez, ...r2_.rez].map(Math.abs), 0.9);
  if (p90 > p.p90 - 0.2) return null;
  return [{ Q: Q1, pts: p1, ...r1 }, { Q: Q2, pts: p2, ...r2_ }];
}

// ------------------------------------------------------------ LiDAR

/** Fereastra de pixeli din jurul unui poligon, cu marginea dată: MDS, MDT, nMDS. */
function fereastraPixeli(P, margine) {
  const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
  const F = { x0: Math.floor(Math.min(...xs) - margine), x1: Math.ceil(Math.max(...xs) + margine), y0: Math.floor(Math.min(...ys) - margine), y1: Math.ceil(Math.max(...ys) + margine) };
  const s = fereastraLidar('MDS', F), t = fereastraLidar('MDT', F);
  const nm = new Float32Array(s.W * s.H);
  for (let i = 0; i < nm.length; i++) nm[i] = s.v[i] === -999 || t.v[i] === -999 ? NaN : s.v[i] - t.v[i];
  return { F, W: s.W, H: s.H, mds: s.v, mdt: t.v, nm, x: (c) => F.x0 + (c + 0.5) * 0.5, y: (r) => F.y1 - (r + 0.5) * 0.5 };
}

/** Pixelii ferestrei dintr-un poligon. */
function pixeliIn(f, P) {
  const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]), Pxy = xy(P), out = [];
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - f.F.x0) / 0.5)), c1 = Math.min(f.W - 1, Math.ceil((Math.max(...xs) - f.F.x0) / 0.5));
  const r0 = Math.max(0, Math.floor((f.F.y1 - Math.max(...ys)) / 0.5)), r1 = Math.min(f.H - 1, Math.ceil((f.F.y1 - Math.min(...ys)) / 0.5));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const x = f.x(c), y = f.y(r), i = r * f.W + c;
    if (inPoligon(x, y, Pxy)) out.push({ i, x, y, z: f.mds[i], sol: f.mdt[i], nm: f.nm[i] });
  }
  return out;
}

const transforma = (P, dx, dy, s = 1, c = [0, 0]) => P.map(([x, y]) => [c[0] + (x - c[0]) * s + dx, c[1] + (y - c[1]) * s + dy]);

/**
 * Translația (și, la cerere, scara) care pune amprenta pe structură: maximul lui
 * „pixeli peste prag − pixeli sub prag" din amprentă. Un pixel fără date nu contează.
 */
function inregistreaza(f, P, prag, scari = [1]) {
  const c = centroid(P);
  const scor = (Q) => { let v = 0; for (const q of pixeliIn(f, Q)) if (!Number.isNaN(q.nm)) v += q.nm > prag ? 1 : -1; return v; };
  let best = null;
  const n = Math.round(CAUTARE / PAS_CAUTARE);
  for (const s of scari) for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    const dx = a * PAS_CAUTARE, dy = b * PAS_CAUTARE, v = scor(transforma(P, dx, dy, s, c));
    // la egalitate, cea mai mică mutare
    if (!best || v > best.v || (v === best.v && Math.hypot(dx, dy) + Math.abs(s - 1) < Math.hypot(best.dx, best.dy) + Math.abs(best.s - 1))) best = { dx, dy, s, v };
  }
  const acoperire = (Q) => { const px = pixeliIn(f, Q).filter((q) => !Number.isNaN(q.nm)); return px.filter((q) => q.nm > prag).length / px.length; };
  return { ...best, centru: c, P: transforma(P, best.dx, best.dy, best.s, c), acoperire_osm: acoperire(P), acoperire: acoperire(transforma(P, best.dx, best.dy, best.s, c)) };
}

// ------------------------------------------------------------ ortofotoul: materialul acoperișurilor
const zbor = existsSync(ZBOR) ? JSON.parse(readFileSync(ZBOR, 'utf8')) : null;
const DEPL = zbor ? { x: zbor.deplasare_sol.dx_m, y: zbor.deplasare_sol.dy_m } : null;
const orto = existsSync(ORTO) && DEPL ? deschideOrtofoto(ORTO, 0.25) : null;

// Ortofotoul nu e true-ortho: un acoperiș de h metri apare mutat cu h × înclinarea față
// de amprenta lui (masoara-zbor, pe clădirile sanctuarului: grupul de 2–9 m, iar peste
// 9 m grupul de peste 9 m). Măsurată la sanctuar, la ~400 m de far: o aproximare.
const inclinare = (h) => { const a = zbor.acoperisuri[h > 9 ? 'nMDS peste 9 m' : 'nMDS 2–9 m']; return { x: (a.dx_m / a.inaltime_medie_m) * h, y: (a.dy_m / a.inaltime_medie_m) * h }; };

/**
 * Pixelii OKLab ai ortofotoului care arată acoperișul din P, la înălțimea h peste
 * sol: marginea erodată, iar `exclus(x, y)` scoate ce acoperă altceva în fotografie.
 */
function mostreOrto(P, h, eroziune, exclus = () => false) {
  const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  // Fotografia stă pe sol cu (dx, dy) față de LiDAR, ca în textura-ortofoto, plus înclinarea.
  const d = inclinare(h), dx = DEPL.x + d.x, dy = DEPL.y + d.y;
  const c0 = Math.round((x0 + dx - orto.x0) / 0.25), r0 = Math.round((orto.y0 - (y1 + dy)) / 0.25), W = (x1 - x0) * 4, H = (y1 - y0) * 4;
  const benzi = [0, 1, 2].map((k) => fereastra(orto, k, c0, r0, W, H));
  const Pxy = xy(P), lab = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const x = x0 + (c + 0.5) * 0.25, y = y1 - (r + 0.5) * 0.25;
    if (!inPoligon(x, y, Pxy) || distMargine(P, x, y) < eroziune || exclus(x + dx, y + dy)) continue;
    const i = r * W + c, rgb = [benzi[0][i], benzi[1][i], benzi[2][i]];
    lab.push({ x, y, lab: laOklab(...rgb), ars: rgb.some((v) => v >= 254) });
  }
  return lab;
}
const mediana = (ms) => (ms.length ? [0, 1, 2].map((k) => +cuantila(ms.map((m) => m.lab[k]), 0.5).toFixed(4)) : null);
const arsi = (ms) => ms.filter((m) => m.ars).length / Math.max(1, ms.length);
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// Soarele zborului (masoara-zbor), în grila scenei: cosinusul unghiului de incidență pe un plan z = A·x + B·y + C.
const SOARE = zbor ? (() => { const a = (zbor.soare_zbor.azimut_grila * Math.PI) / 180, e = (zbor.soare_zbor.elevatie * Math.PI) / 180; return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]; })() : null;
const cosSoare = (pl) => { const L = Math.hypot(pl.A, pl.B, 1); return (-pl.A * SOARE[0] - pl.B * SOARE[1] + SOARE[2]) / L; };

// Referințele: acoperișurile sanctuarului, pe materialul lor, măsurate exact ca mai jos.
const referinte = orto ? Object.fromEntries(REFERINTE.map((k) => {
  const lab = [];
  for (const c of sanctuar.corpuri.filter((q) => q.acoperis === k)) {
    const P = c.contur.map(([x, z]) => [x + ANCORA.x, ANCORA.y - z]);
    const f = fereastraPixeli(P, 1);
    const h = cuantila(pixeliIn(f, P).filter((q) => !Number.isNaN(q.nm)).map((q) => q.nm), 0.5);
    lab.push(...mostreOrto(P, h, MARGINE_PLAN));
  }
  return [k, { oklab: mediana(lab), pixeli: lab.length, arsi: arsi(lab) }];
})) : null;

/**
 * Materialul unui acoperiș, după apele lui în ortofoto. Hotărăște apa cea mai puțin
 * arsă — de obicei cea din umbră, care își păstrează nuanța:
 * - arsă și ea peste PRAG_ALB: suprafața e albă chiar și fără soare ⇒ var
 *   (156262911 și 156262922: 82–94% pe fiecare apă; o țiglă are apa din umbră la 0–4%);
 * - roșcată ⇒ țiglă. Pragul lui a stă la jumătatea dintre terasa sanctuarului și
 *   cea mai puțin roșcată țiglă a lui, măsurate la fel (aripa N: 0,015);
 * - altfel, referința neutră cea mai apropiată: terasa sau acoperișul întunecat.
 * Albedoul țiglei e cel din fotografie (`tigla`), nu varianta unei aripi anume.
 */
function alegeMaterial(ape) {
  const a = ape.filter((q) => q.pixeli >= 20).sort((p, q) => p.arsi - q.arsi)[0];
  if (!a) return null;
  if (a.arsi > PRAG_ALB) return 'var';
  const pragA = (referinte.terasa.oklab[1] + Math.min(...['tigla_biserica', 'tigla_aripa_n', 'tigla_aripa_s'].map((k) => referinte[k].oklab[1]))) / 2;
  if (a.oklab_nears[1] > pragA) return 'tigla';
  return ['terasa', 'acoperis_spate_m1'].sort((p, q) => dE(a.oklab_nears, referinte[p].oklab) - dE(a.oklab_nears, referinte[q].oklab))[0];
}

// ------------------------------------------------------------ grupurile
// Clădirile la mai puțin de 60 m una de alta: farul cu casele lui, iar la ~400 m spre
// sud-vest Casa da Ronca cu vecinele ei. Umbrele paginii se vor strânge pe câte un grup.
const elemente = inst.elemente.map((el) => ({ el, P: tm(el) }));
const farEl = elemente.find(({ el }) => el.tags?.man_made === 'lighthouse');
const grupuri = [];
for (const q of elemente.map(({ el, P }) => ({ id: el.id, P0: P, el }))) {
  const [cx, cy] = centroid(q.P0);
  const g = grupuri.find((w) => w.some((e) => Math.hypot(centroid(e.P0)[0] - cx, centroid(e.P0)[1] - cy) < 60));
  if (g) g.push(q); else grupuri.push([q]);
}
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const numeGrup = new Map();
grupuri.forEach((g, n) => {
  const nume = g.some((q) => q.el === farEl?.el) ? 'far' : slug(g.find((q) => q.el.tags?.name)?.el.tags.name ?? `grup_${n}`);
  for (const q of g) numeGrup.set(q.id, nume);
});

// ------------------------------------------------------------ farul
const masuratori = [], corpuri = [], cupole = [], excluse = [], candidati = [];
let far = null;
if (farEl) {
  const f = fereastraPixeli(farEl.P, CAUTARE + 2);
  const scari = Array.from({ length: 31 }, (_, k) => +(0.5 + 0.02 * k).toFixed(2));
  const reg = inregistreaza(f, farEl.P, PRAG_TURN, scari);
  const P = reg.P, [ax, ay] = centroid(P), px = pixeliIn(f, P).filter((q) => !Number.isNaN(q.nm));
  const razeV = P.map(([x, y]) => Math.hypot(x - ax, y - ay));
  const apotema = Math.min(...P.map((q, k) => { const [x0, y0] = q, [x1, y1] = P[(k + 1) % P.length]; return Math.abs((x1 - x0) * (y0 - ay) - (x0 - ax) * (y1 - y0)) / Math.hypot(x1 - x0, y1 - y0); }));
  const inele = new Map();
  for (const q of px) { const k = Math.floor(Math.hypot(q.x - ax, q.y - ay) / 0.5); if (!inele.has(k)) inele.set(k, []); inele.get(k).push(q.z); }
  const pr = [...inele.keys()].sort((a, b) => a - b).map((k) => ({ r: (k + 0.5) * 0.5, z: cuantila(inele.get(k), 0.9), n: inele.get(k).length }));
  // Platforma: mediana MDS-ului pe inelul dintre 0,6 și 0,95 din apotemă.
  const platforma = cuantila(px.filter((q) => { const r = Math.hypot(q.x - ax, q.y - ay); return r >= 0.6 * apotema && r <= 0.95 * apotema; }).map((q) => q.z), 0.5);
  const varf = Math.max(...px.map((q) => q.z));
  // Lanterna: inelele care trec de jumătatea dintre platformă și vârf. Marginea ei e
  // marginea exterioară a ultimului astfel de inel; de acolo profilul urcă vertical.
  // Profilul începe la platformă, nu la marginea prismei: capacul prismei e chiar
  // platforma, iar un inel plat la aceeași cotă ar pâlpâi cu el.
  const lant = pr.filter((q) => q.z > (platforma + varf) / 2);
  const rL = Math.max(...lant.map((q) => q.r)) + 0.25;
  const profil = [[r2(rL), r2(platforma)], ...lant.sort((a, b) => b.r - a.r).map((q, k) => [r2(k ? q.r : rL), r2(q.z)]), [0, r2(varf)]];
  const sus = px.filter((q) => q.z > (platforma + varf) / 2);
  const lx = sus.reduce((a, q) => a + q.x, 0) / sus.length, ly = sus.reduce((a, q) => a + q.y, 0) / sus.length;
  far = { el: farEl.el, P, apotema, inaltime: varf - cuantila(px.map((q) => q.sol), 0.5) };
  // Lanterna văzută de sus: cercul ei, la înălțimea vârfului, cu înclinarea fotografiei.
  const cerc = Array.from({ length: 16 }, (_, k) => [ax + (rL - 0.25) * Math.cos((k * Math.PI) / 8), ay + (rL - 0.25) * Math.sin((k * Math.PI) / 8)]);
  const mLant = orto ? mostreOrto(cerc, far.inaltime, 0) : [];
  const apaLant = { pixeli: mLant.length, arsi: arsi(mLant), oklab_nears: mediana(mLant.filter((q) => !q.ars)) };
  const materialLanterna = orto ? alegeMaterial([apaLant]) : 'var';
  const m = {
    osm: farEl.el.id, v: farEl.el.v, nume: farEl.el.tags?.name ?? null, tip: 'cupola',
    arie_osm_m2: +arie(xy(farEl.P)).toFixed(1), arie_m2: +arie(xy(P)).toFixed(1),
    inregistrare: { dx: reg.dx, dy: reg.dy, scara: reg.s, prag_m: PRAG_TURN, acoperire_osm: +reg.acoperire_osm.toFixed(3), acoperire: +reg.acoperire.toFixed(3) },
    apotema: r2(apotema), raza_varfuri: r2(Math.max(...razeV)), platforma: r2(platforma), varf: r2(varf), raza_lanterna: r2(rL),
    sol_mediana: r2(cuantila(px.map((q) => q.sol), 0.5)), lanterna_fata_de_ax_m: r2(Math.hypot(lx - ax, ly - ay)),
    profil_radial: pr.map((q) => [r2(q.r), r2(q.z), q.n]),
    lanterna: { pixeli_ortofoto: apaLant.pixeli, arsi: +apaLant.arsi.toFixed(3), oklab: apaLant.oklab_nears, material: materialLanterna },
  };
  masuratori.push(m);
  // Un material pe segment de profil: primul e camera lanternei, verticală, pe care
  // fotografia de sus n-o vede — rămâne var, ca turnul, NEVERIFICAT; restul e cupola,
  // cu materialul măsurat.
  cupole.push({
    cheie: 'far.turn', grup: numeGrup.get(farEl.el.id), contur: P.map(laScena), centru: laScena([ax, ay]), cornisa: r2(platforma), profil, laturi: P.length,
    material: materialLanterna, materiale_profil: profil.slice(1).map((_, k) => (k === 0 ? 'var' : materialLanterna)),
  });
}
const inFar = (x, y) => far && (inPoligon(x, y, xy(far.P)) || distMargine(far.P, x, y) < MARGINE_PLAN);
// Imaginea turnului în ortofoto: amprenta lui mutată cu înclinarea, de la sol până la vârf.
const inImagineFar = (x, y) => far && zbor && [0, 0.25, 0.5, 0.75, 1].some((t) => {
  const h = t * far.inaltime;
  const d = inclinare(h);
  return inFar(x - d.x, y - d.y) || distMargine(far.P, x - d.x, y - d.y) < 1;
});

// ------------------------------------------------------------ celelalte clădiri
for (const { el, P: P0 } of elemente) {
  if (farEl && el === farEl.el) continue;
  const f = fereastraPixeli(P0, CAUTARE + 2);
  const reg = inregistreaza(f, P0, PRAG_CLADIRE);
  const P = reg.P;
  const px = pixeliIn(f, P).filter((q) => !Number.isNaN(q.nm));
  const peste = px.filter((q) => q.nm > PRAG_CLADIRE).length / px.length;
  const m = {
    osm: el.id, v: el.v, nume: el.tags?.name ?? null, ruina: el.tags?.ruins === 'yes',
    arie_m2: +arie(xy(P)).toFixed(1), pixeli: px.length,
    inregistrare: { dx: reg.dx, dy: reg.dy, acoperire_osm: +reg.acoperire_osm.toFixed(3), acoperire: +reg.acoperire.toFixed(3) },
    nmds_mediana: r2(cuantila(px.map((q) => q.nm), 0.5)),
  };
  masuratori.push(m);
  if (peste < 0.6) { m.tip = 'exclus'; excluse.push({ osm: el.id, motiv: `numai ${(100 * peste).toFixed(0)}% din amprentă stă peste ${PRAG_CLADIRE} m pe LiDAR` }); continue; }

  const deAcoperis = (Q) => pixeliIn(f, Q).filter((q) => q.nm > PRAG_CLADIRE && distMargine(P, q.x, q.y) >= MARGINE_PLAN && !inFar(q.x, q.y)).map(({ x, y, z }) => ({ x, y, z }));
  const toate = deAcoperis(P);
  let planeCladire = ransac(toate, 4, 12);
  if (!planeCladire.length) planeCladire = [{ A: 0, B: 0, C: cuantila(toate.map((q) => q.z), 0.5), n: toate.length }];
  // Părțile convexe ale amprentei, fiecare cu planele ei; o parte în trepte se taie în două.
  const bucati = [];
  for (const Q of parti(P)) {
    const pts = deAcoperis(Q), p = potriveste(pts, planeCladire), t = treapta(Q, pts, p);
    if (t) bucati.push(...t.map((b) => ({ ...b, treapta: true })));
    else bucati.push({ Q, pts, ...p, treapta: false });
  }
  const rez = bucati.flatMap((b) => b.rez);
  const partiM = bucati.map((b, k) => {
    const pante = b.pts.map((q) => panta(b.plane.reduce((a, pl) => (zPlan(pl, q.x, q.y) < zPlan(a, q.x, q.y) ? pl : a))));
    return { k, pixeli: b.pts.length, plane_proprii: b.proprii, plane: b.plane.length, treapta: b.treapta, panta_mediana: b.pts.length ? r2(cuantila(pante, 0.5)) : null, p90: b.pts.length ? r2(b.p90) : null };
  });
  // Materialul acoperișului: referința sanctuarului cea mai apropiată în OKLab; un alb
  // ars nu e o măsurătoare, deci ia varul.
  const h = cuantila(toate.map((q) => q.z), 0.5) - cuantila(px.map((q) => q.sol), 0.5);
  const mostre = orto ? mostreOrto(P, h, MARGINE_PLAN, inImagineFar) : [];
  const lab = mediana(mostre);
  // Pe ape: fiecare mostră ia planul care dă minimul în partea ei.
  const ape = new Map();
  for (const q of mostre) {
    const k = bucati.findIndex((b) => inPoligon(q.x, q.y, xy(b.Q)));
    if (k < 0) continue;
    const pl = bucati[k].plane.reduce((a, w) => (zPlan(w, q.x, q.y) < zPlan(a, q.x, q.y) ? w : a));
    if (!ape.has(pl)) ape.set(pl, []);
    ape.get(pl).push(q);
  }
  const apeM = [...ape.entries()].map(([pl, ms]) => ({
    pixeli: ms.length, panta: r2(panta(pl)), expozitie: r2(((Math.atan2(-pl.A, -pl.B) * 180) / Math.PI + 360) % 360),
    cos_i: +cosSoare(pl).toFixed(3), arsi: +arsi(ms).toFixed(3), oklab: mediana(ms), oklab_nears: mediana(ms.filter((q) => !q.ars)),
  })).sort((a, b) => b.pixeli - a.pixeli);
  const distante = lab ? Object.entries(referinte).map(([k, r]) => [k, dE(lab, r.oklab)]).sort((a, b) => a[1] - b[1]) : [];
  const acoperis = alegeMaterial(apeM);
  bucati.forEach((b, k) => corpuri.push({
    cheie: `${m.ruina ? 'ruina' : 'cladire'}.${el.id}${bucati.length > 1 ? `.${k}` : ''}`, grup: numeGrup.get(el.id),
    contur: b.Q.map(laScena), plane: b.plane.map(planScena), perete: m.ruina ? 'zidarie' : 'var', acoperis,
  }));
  Object.assign(m, {
    tip: 'corp', pixeli_acoperis: toate.length, suprapus_far: px.filter((q) => inFar(q.x, q.y)).length,
    abatere_mediana: r2(cuantila(rez.map(Math.abs), 0.5)), abatere_p90: r2(cuantila(rez.map(Math.abs), 0.9)),
    sub_plan_1m: +(rez.filter((v) => v < -1).length / rez.length).toFixed(3), peste_plan_1m: +(rez.filter((v) => v > 1).length / rez.length).toFixed(3),
    panta_mediana: r2(cuantila(partiM.flatMap((q) => (q.panta_mediana == null ? [] : Array(q.pixeli).fill(q.panta_mediana))), 0.5)),
    inaltime_acoperis: r2(h), acoperis, arsi: +arsi(mostre).toFixed(4), pixeli_ortofoto: mostre.length, oklab_ortofoto: lab, ape: apeM, dE_referinte: distante.map(([k, d]) => [k, +d.toFixed(4)]), parti: partiM,
  });
  m.rez = rez;
}

// ------------------------------------------------------------ raport
if (referinte) console.log(`referințele, pe ortofoto: ${Object.entries(referinte).map(([k, r]) => `${k} ${r.oklab.map((v) => v.toFixed(3)).join(' ')} (${r.pixeli} px, ${(100 * r.arsi).toFixed(1)}% arși)`).join('; ')}`);
console.log('\n       osm  arie m²  mutare (m)   pe clădire OSM→înreg.  nMDS  |Δ|med  p90  sub/peste 1 m  pantă  părți  arși  acoperiș, ΔE_OK×100 față de primele două      OKLab ortofoto');
for (const m of masuratori) {
  const g = m.inregistrare;
  const baza_ = `${String(m.osm).padStart(10)}  ${String(m.arie_m2).padStart(7)}  (${g.dx.toFixed(2).padStart(5)};${g.dy.toFixed(2).padStart(5)})${g.scara ? ` ×${g.scara}` : '      '}  ${(100 * g.acoperire_osm).toFixed(0).padStart(3)}% → ${(100 * g.acoperire).toFixed(0).padStart(3)}%`;
  if (m.tip === 'cupola') console.log(`${baza_}   far: apotema ${m.apotema} (vârfuri ${m.raza_varfuri}), platforma ${m.platforma}, vârf ${m.varf}, sol ${m.sol_mediana}, lanterna la ${m.lanterna_fata_de_ax_m} m de ax`);
  else if (m.tip === 'exclus') console.log(`${baza_}   exclus`);
  else console.log(`${baza_}   ${String(m.nmds_mediana).padStart(5)}  ${String(m.abatere_mediana).padStart(6)}  ${String(m.abatere_p90).padStart(4)}  ${(100 * m.sub_plan_1m).toFixed(0).padStart(4)}%/${(100 * m.peste_plan_1m).toFixed(0).padStart(3)}%  ${String(m.panta_mediana).padStart(5)}°  ${String(m.parti.length).padStart(4)}  ${(100 * m.arsi).toFixed(1).padStart(4)}%  ${m.acoperis}${m.acoperis === 'var' ? ' (alb)' : ''}: ${m.dE_referinte.slice(0, 2).map(([k, d]) => `${k} ${(100 * d).toFixed(1)}`).join(', ').padEnd(40)}  ${m.oklab_ortofoto?.map((v) => v.toFixed(3)).join(' ') ?? '—'}`);
}
console.log('\npe ape (pixeli ortofoto, pantă, expoziție, cos i cu soarele zborului, arși, OKLab fără arși):');
for (const m of masuratori.filter((q) => q.ape?.length)) console.log(`  ${m.osm}: ${m.ape.filter((a) => a.pixeli >= 20).map((a) => `${a.pixeli} px ${a.panta}°/${a.expozitie.toFixed(0)}° cos ${a.cos_i} ars ${(100 * a.arsi).toFixed(0)}% [${a.oklab_nears?.map((v) => v.toFixed(3)).join(' ') ?? '—'}]`).join(' | ')}`);
for (const m of masuratori.filter((q) => q.parti?.length > 1)) console.log(`  ${m.osm}, părțile: ${m.parti.map((q) => `#${q.k} ${q.pixeli} px, ${q.plane_proprii ? `${q.plane} plane proprii` : 'planele clădirii'}${q.treapta ? ', treaptă' : ''}, pantă ${q.panta_mediana}°, p90 ${q.p90}`).join('; ')}`);
const farM = masuratori.find((m) => m.tip === 'cupola');
if (farM) console.log(`\nlanterna farului: ${farM.lanterna.pixeli_ortofoto} px, ${(100 * farM.lanterna.arsi).toFixed(0)}% arși, OKLab ${farM.lanterna.oklab?.map((v) => v.toFixed(3)).join(' ')} ⇒ ${farM.lanterna.material}`);
if (farM) console.log(`\nprofilul farului (r: cuantila 0,9 a MDS, n): ${farM.profil_radial.map(([r, z, n]) => `${r}:${z}(${n})`).join('  ')}`);

// ------------------------------------------------------------ straturile de privit
// Ortofotoul pe fiecare grup de clădiri, mărit de 3 ori: amprenta OSM cu roșu,
// cea înregistrată cu galben, iar farul cu cyan. Acoperișurile apar mutate cu
// înclinarea (ortofotoul nu e true-ortho); amprentele sunt pe sol.
if (orto) {
  mkdirSync('date-sursa/derivate', { recursive: true });
  grupuri.forEach((g, n) => {
    const tot = g.flatMap((q) => q.P0);
    const x0 = Math.floor(Math.min(...tot.map((q) => q[0]))) - 8, x1 = Math.ceil(Math.max(...tot.map((q) => q[0]))) + 8;
    const y0 = Math.floor(Math.min(...tot.map((q) => q[1]))) - 8, y1 = Math.ceil(Math.max(...tot.map((q) => q[1]))) + 8;
    const W = (x1 - x0) * 4, H = (y1 - y0) * 4, Z = 3;
    const c0 = Math.round((x0 + DEPL.x - orto.x0) / 0.25), r0 = Math.round((orto.y0 - (y1 + DEPL.y)) / 0.25);
    const b = [0, 1, 2].map((k) => fereastra(orto, k, c0, r0, W, H));
    const img = new Uint8Array(W * Z * H * Z * 3);
    for (let r = 0; r < H * Z; r++) for (let c = 0; c < W * Z; c++) {
      const i = Math.floor(r / Z) * W + Math.floor(c / Z), o = (r * W * Z + c) * 3;
      img[o] = b[0][i]; img[o + 1] = b[1][i]; img[o + 2] = b[2][i];
    }
    const linie = (P, rgb) => P.forEach((a, k) => {
      const q = P[(k + 1) % P.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]);
      for (let t = 0; t <= L; t += 0.02) {
        const x = a[0] + ((q[0] - a[0]) * t) / L, y = a[1] + ((q[1] - a[1]) * t) / L;
        const c = Math.floor((x - x0) * 4 * Z), r = Math.floor((y1 - y) * 4 * Z);
        if (c >= 0 && c < W * Z && r >= 0 && r < H * Z) img.set(rgb, (r * W * Z + c) * 3);
      }
    });
    for (const q of g) linie(q.P0, [255, 40, 40]);
    for (const c of corpuri.filter((w) => g.some((q) => c_id(w) === q.id))) linie(c.contur.map(([x, z]) => [x + ANCORA.x, ANCORA.y - z]), [255, 230, 0]);
    if (far && g.some((q) => q.id === far.el.id)) linie(far.P, [0, 230, 255]);
    writeFileSync(`date-sursa/derivate/cladiri-grup-${n}.png`, scriePng(W * Z, H * Z, img));
    console.log(`  strat de privit: date-sursa/derivate/cladiri-grup-${n}.png (${g.map((q) => q.id).join(', ')})`);

    // Candidații: ce stă peste PRAG_CLADIRE în fereastra grupului, fără vegetație
    // (NDVI < 0,15, media 2 × 2 de la 0,25 m) și la peste 1 m de orice amprentă
    // înregistrată. Componente conexe, de cel puțin 5 m².
    const F = { x0, x1, y0, y1 }, ms = fereastraLidar('MDS', F), mt = fereastraLidar('MDT', F);
    const nir = fereastra(orto, 3, c0, r0, W, H);
    const Ps = [...corpuri.map((c) => c.contur.map(([x, z]) => [x + ANCORA.x, ANCORA.y - z])), ...(far ? [far.P] : [])];
    const e = new Uint8Array(ms.W * ms.H);
    for (let r = 0; r < ms.H; r++) for (let c = 0; c < ms.W; c++) {
      const i = r * ms.W + c;
      if (ms.v[i] === -999 || mt.v[i] === -999 || ms.v[i] - mt.v[i] <= PRAG_CLADIRE) continue;
      let R = 0, N = 0;
      for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const j = (2 * r + dr) * W + 2 * c + dc; R += b[0][j]; N += nir[j]; }
      if ((N + R) && (N - R) / (N + R) >= 0.15) continue;
      const x = x0 + (c + 0.5) * 0.5, y = y1 - (r + 0.5) * 0.5;
      if (Ps.some((P) => inPoligon(x, y, xy(P)) || distMargine(P, x, y) < 1)) continue;
      e[i] = 1;
    }
    for (let i = 0; i < e.length; i++) {
      if (e[i] !== 1) continue;
      const coada = [i], comp = []; e[i] = 2;
      while (coada.length) {
        const k = coada.pop(); comp.push(k);
        const r = Math.floor(k / ms.W), c = k % ms.W;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc, j = rr * ms.W + cc;
          if (rr >= 0 && rr < ms.H && cc >= 0 && cc < ms.W && e[j] === 1) { e[j] = 2; coada.push(j); }
        }
      }
      if (comp.length * 0.25 < 5) continue;
      const cx = comp.reduce((a, k) => a + x0 + ((k % ms.W) + 0.5) * 0.5, 0) / comp.length, cy = comp.reduce((a, k) => a + y1 - (Math.floor(k / ms.W) + 0.5) * 0.5, 0) / comp.length;
      const h = comp.map((k) => ms.v[k] - mt.v[k]);
      candidati.push({ grup: n, centru_tm06: [r2(cx), r2(cy)], arie_m2: comp.length * 0.25, nmds_mediana: r2(cuantila(h, 0.5)), nmds_max: r2(Math.max(...h)) });
    }
  });
  console.log(`\ncandidați în afara OSM (nMDS > ${PRAG_CLADIRE} m, fără vegetație, ≥ 5 m²): ${candidati.length}`);
  for (const q of candidati) console.log(`  grup ${q.grup}: (${q.centru_tm06.join('; ')}) ${q.arie_m2} m², nMDS mediana ${q.nmds_mediana}, max ${q.nmds_max}`);
}

console.log('\nProbe');
const MDS_FAR = 168.28;
proba(corpuri.every((c) => convex(c.contur.map(([x, z]) => [x, -z]))), `toate cele ${corpuri.length} părți sunt convexe`);
const arieParti = (id) => corpuri.filter((c) => c.cheie.split('.')[1] === String(id)).reduce((s, c) => s + arie(xy(c.contur)), 0);
proba(masuratori.filter((m) => m.tip === 'corp').every((m) => Math.abs(arieParti(m.osm) - m.arie_m2) < 0.01 * m.arie_m2), 'părțile unei amprente o acoperă exact (aria, la 1%)');
const locuite = masuratori.filter((m) => m.tip === 'corp' && !m.ruina), rezTot = locuite.flatMap((m) => m.rez.map(Math.abs));
const med = cuantila(rezTot, 0.5), p90 = cuantila(rezTot, 0.9);
proba(med <= 0.25 && p90 <= 0.8, `acoperișurile clădirilor întregi stau pe MDS: mediana ${med.toFixed(3)} m, p90 ${p90.toFixed(3)} m (prag 0,25 / 0,8, ca la sanctuar)`);
for (const m of masuratori.filter((q) => q.tip === 'corp' && q.abatere_p90 > 0.8)) console.log(`        potrivit slab: ${m.osm}${m.ruina ? ' (ruină)' : ''}, p90 ${m.abatere_p90} m`);
proba(masuratori.every((m) => m.tip === 'exclus' || m.inregistrare.acoperire >= m.inregistrare.acoperire_osm), 'înregistrarea nu scade acoperirea nicăieri');
if (farM) {
  proba(Math.abs(farM.varf - MDS_FAR) < 0.01, `vârful farului la ${farM.varf} m, cât maximul MDS de pe amprenta lui, scris aici (${MDS_FAR})`);
  proba(farM.lanterna_fata_de_ax_m < 0.75, `lanterna cade la ${farM.lanterna_fata_de_ax_m} m de axul hexagonului înregistrat`);
}
// Amprentele înregistrate nu se suprapun, în afară de far cu clădirea lipită de el.
const reg = masuratori.filter((m) => m.tip === 'corp').map((m) => ({ id: m.osm, P: corpuri.filter((c) => c.cheie.split('.')[1] === String(m.osm)).flatMap((c) => [c.contur]) }));
let suprapuse = 0;
for (let a = 0; a < reg.length; a++) for (let b = a + 1; b < reg.length; b++) {
  const A = reg[a].P.flatMap((c) => c), B = reg[b].P.flatMap((c) => c);
  const [x0, x1, z0, z1] = [Math.max(Math.min(...A.map((q) => q[0])), Math.min(...B.map((q) => q[0]))), Math.min(Math.max(...A.map((q) => q[0])), Math.max(...B.map((q) => q[0]))),
    Math.max(Math.min(...A.map((q) => q[1])), Math.min(...B.map((q) => q[1]))), Math.min(Math.max(...A.map((q) => q[1])), Math.max(...B.map((q) => q[1])))];
  let n = 0;
  for (let x = x0; x < x1; x += 0.25) for (let z = z0; z < z1; z += 0.25)
    if (reg[a].P.some((c) => inPoligon(x, z, xy(c))) && reg[b].P.some((c) => inPoligon(x, z, xy(c)))) n++;
  if (n * 0.0625 > 1) { suprapuse++; console.log(`        ${reg[a].id} și ${reg[b].id} se suprapun pe ${(n * 0.0625).toFixed(1)} m²`); }
}
proba(suprapuse === 0, 'amprentele înregistrate nu se suprapun (sub 1 m²)');

// ------------------------------------------------------------ inventarul
const lipsa = elemente.filter(({ el }) => !inventar?.elemente?.some((q) => q.osm === el.id));
if (!doarProba) {
  proba(inventar?.osm === man.fisier, `inventarul e scris pe instantaneul curent (${inventar?.osm} față de ${man.fisier})`);
  proba(lipsa.length === 0, `fiecare element OSM are o decizie în ${INVENTAR}${lipsa.length ? `; lipsesc ${lipsa.map(({ el }) => el.id).join(', ')}` : ''}`);
}

if (doarProba || picate || !orto) {
  console.log(doarProba ? '\n--proba: nu se scrie nimic' : picate ? `\n${picate} probe picate; nu se scrie nimic` : '\nfără ortofoto și zbor.json nu se scrie nimic');
  process.exit(picate ? 1 : 0);
}

const exclusDeOm = new Set(inventar.elemente.filter((q) => !q.inclus).map((q) => q.osm));
const pastrat = (c) => !exclusDeOm.has(+c.cheie.split('.')[1]);
const mat = (k) => ({ ...sanctuar.materiale[k], nota: 'albedoul sanctuarului, aplicat prin asemănare — nemăsurat pe clădirea aceasta' });
const date = {
  nume, versiune_schema: 1, generat: new Date().toISOString(), baza: baza.nume, ancora_tm06: ANCORA,
  licenta: 'ODbL 1.0', licenta_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  surse: sanctuar.surse,
  presupuneri: [
    'pereții nu se văd nici pe LiDAR, nici în ortofoto: var la clădirile întregi, zidărie la cele pe care OSM le dă ruine — NEVERIFICAT',
    'camera lanternei farului, verticală, nu se vede de sus: var, ca turnul — NEVERIFICAT; cupola ei ia materialul măsurat',
    'albedourile sunt ale sanctuarului, alese după culoarea acoperișului în ortofoto',
  ],
  inregistrare: masuratori.map((m) => ({ osm: m.osm, dx: m.inregistrare.dx, dy: m.inregistrare.dy, ...(m.inregistrare.scara ? { scara: m.inregistrare.scara } : {}) })),
  materiale: Object.fromEntries([...new Set(['var', 'cupola', ...corpuri.flatMap((c) => [c.perete, c.acoperis]), ...cupole.map((c) => c.material)])].sort().map((k) => [k, mat(k)])),
  corpuri: corpuri.filter(pastrat), turnuri: [], cupole: farEl && !exclusDeOm.has(farEl.el.id) ? cupole : [], ziduri: [], apeduct: [], cosuri: [],
  excluse: [...excluse, ...inventar.elemente.filter((q) => !q.inclus).map((q) => ({ osm: q.osm, motiv: q.motiv }))],
};
writeFileSync(iesire, JSON.stringify(date));
mkdirSync('date-sursa/derivate', { recursive: true });
writeFileSync('date-sursa/derivate/masuratori-cladiri.json', JSON.stringify({ generat: date.generat, osm: man.fisier, deplasare_ortofoto: DEPL, masuratori: masuratori.map(({ rez, ...m }) => m) }, null, 1));
console.log(`\nscris ${iesire}: ${date.corpuri.length} corpuri, ${date.cupole.length} cupolă, ${date.excluse.length} excluse; ${(readFileSync(iesire).length / 1024).toFixed(1)} KB`);
console.log('toate probele au trecut');
