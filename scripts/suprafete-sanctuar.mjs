// Suprafețele de pe teren ale sanctuarului: terreiro-ul, parcarea, drumurile,
// potecile, esplanada. Din instantaneul OSM, cu lățimea drumurilor măsurată pe
// ortofoto și culorile ca albedo, după convenția paletei.
//
//   npm run suprafete-sanctuar
//
// Scrie date-sursa/derivate/suprafete-sanctuar.json, citit de build-sanctuar.
//
// Totul iese ca POLIGOANE CONVEXE (triunghiuri și patrulatere), fiindcă pagina le
// așază pe teren tăindu-le cu triunghiurile plasei, iar tăietura a două poligoane
// convexe e tot convexă. Ariile OSM se triangulează; un drum devine un
// dreptunghi pe fiecare segment, cu un pătrat la fiecare îmbinare.
//
// Se păstrează numai ce cade în zona pozei de referință — decizii.json, `zona` —,
// ca drumurile să nu se întindă până la far.

import { readFileSync, writeFileSync } from 'node:fs';
import { cadru, incarcaRastru } from './comun/rastru-sanctuar.mjs';
import { deschideOrtofoto, fereastra } from './comun/ortofoto.mjs';
import { dinOklab, hex, laOklab } from './comun/oklab.mjs';
import { laTM06 } from './comun/tm06.mjs';
import { taie } from '../src/scene/sanctuar-forme.js';

const R = incarcaRastru();
const { W, H, F } = R;
const D = JSON.parse(readFileSync('scripts/sanctuar/decizii.json', 'utf8'));
const man = JSON.parse(readFileSync('scripts/sanctuar/osm-manifest.json', 'utf8'));
const inst = JSON.parse(readFileSync(`date-sursa/osm/${man.fisier}`, 'utf8'));
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const cuantila = (v, q) => { const a = Float64Array.from(v).sort(); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };

// ------------------------------------------------------------ zona și geometria

const zc = cadru(D.zona.cadru);
const zona = [[D.zona.u[0], D.zona.v[0]], [D.zona.u[1], D.zona.v[0]], [D.zona.u[1], D.zona.v[1]], [D.zona.u[0], D.zona.v[1]]].map(([u, v]) => zc.laXY(u, v));
/** Taie un poligon convex cu zona (convexă), latură cu latură. */
function inZona(p) {
  let out = p;
  for (let k = 0; k < zona.length && out.length >= 3; k++) {
    const a = zona[k], b = zona[(k + 1) % zona.length];
    // interiorul e la stânga lui a→b (zona e în sens trigonometric în TM06)
    out = taie(out, b[1] - a[1], -(b[0] - a[0]), -((b[1] - a[1]) * a[0] - (b[0] - a[0]) * a[1]));
  }
  return out.length >= 3 ? out : null;
}

const element = (id) => inst.elemente.find((e) => e.id === id);
const varianta = (id) => D.variante_osm?.[String(id)] ?? 'azi';
const geo = (el) => {
  const n = varianta(el.id) === 'inainte' && el.inainte?.noduri ? el.inainte.noduri : el.noduri;
  return n.map(([, , lat, lon]) => { const q = laTM06(lon, lat); return [q.x, q.y]; });
};

/** Triangulare prin tăierea urechilor, pe un poligon simplu (x, y) închis sau nu. */
function triunghiuri(p) {
  let v = p.slice();
  if (v.length > 3 && v[0][0] === v[v.length - 1][0] && v[0][1] === v[v.length - 1][1]) v.pop();
  let arie = 0; for (let k = 0; k < v.length; k++) { const a = v[k], b = v[(k + 1) % v.length]; arie += a[0] * b[1] - b[0] * a[1]; }
  if (arie < 0) v.reverse();
  const out = [];
  const cruce = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inTri = (p0, a, b, c) => cruce(a, b, p0) >= 0 && cruce(b, c, p0) >= 0 && cruce(c, a, p0) >= 0;
  let paza = 0;
  while (v.length > 3 && paza++ < 10000) {
    let taiat = false;
    for (let k = 0; k < v.length; k++) {
      const a = v[(k + v.length - 1) % v.length], b = v[k], c = v[(k + 1) % v.length];
      if (cruce(a, b, c) <= 0) continue;
      if (v.some((q) => q !== a && q !== b && q !== c && inTri(q, a, b, c))) continue;
      out.push([a, b, c]); v.splice(k, 1); taiat = true; break;
    }
    if (!taiat) break;
  }
  if (v.length === 3) out.push(v);
  return out;
}

// ------------------------------------------------------------ ortofotoul

const o = deschideOrtofoto('date-sursa/ortofoto/ortos2025_cog_25cm_rgbi_jpg_464-3_v02.tif', 0.25);
const OW = W * 2, OH = H * 2;
const oc0 = (F.x0 - o.x0) / 0.25, or0 = (o.y0 - F.y1) / 0.25;
const [OR, OG, OB] = [0, 1, 2].map((b) => fereastra(o, b, oc0, or0, OW, OH));
const oPix = (x, y) => {
  const c = Math.floor((x - F.x0) / 0.25), r = Math.floor((F.y1 - y) / 0.25);
  return c < 0 || r < 0 || c >= OW || r >= OH ? null : [OR[r * OW + c], OG[r * OW + c], OB[r * OW + c]];
};

/**
 * Lățimea unui drum, pe ortofoto: la fiecare 5 m, profilul perpendicular pe
 * ±8 m; culoarea drumului e mediana pe ±0,5 m de ax, iar marginea e primul loc
 * de unde, pe 1 m la rând, ΔE OKLab trece de prag. Mediana stațiilor.
 */
function latime(linie, implicita) {
  const g = [];
  for (let k = 1; k < linie.length; k++) {
    const [a, b] = [linie[k - 1], linie[k]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1) continue;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
    for (let d = 2.5; d < L - 2.5; d += 5) {
      const x = a[0] + ux * d, y = a[1] + uy * d;
      const ax = [];
      for (let o2 = -0.5; o2 <= 0.5; o2 += 0.25) { const q = oPix(x + nx * o2, y + ny * o2); if (q) ax.push(laOklab(...q)); }
      if (ax.length < 3) continue;
      const m = [0, 1, 2].map((c) => cuantila(ax.map((q) => q[c]), 0.5));
      const margine = (sens) => {
        let rau = 0;
        for (let o2 = 0.5; o2 <= 8; o2 += 0.25) {
          const q = oPix(x + nx * o2 * sens, y + ny * o2 * sens);
          if (!q) return null;
          const l = laOklab(...q);
          if (Math.hypot(l[0] - m[0], l[1] - m[1], l[2] - m[2]) > 0.06) { if (++rau >= 4) return o2 - 0.75; } else rau = 0;
        }
        return null;
      };
      const s = margine(1), dr = margine(-1);
      if (s !== null && dr !== null) g.push(s + dr);
    }
  }
  if (g.length < 3) return { latime: implicita, masurata: false, statii: g.length };
  const l = cuantila(g, 0.5);
  return { latime: r2(Math.min(12, Math.max(1, l))), masurata: true, statii: g.length };
}

// ------------------------------------------------------------ suprafețele

const bucati = [];
const adauga = (poli, material, strat, sursa) => {
  const t = inZona(poli);
  if (t) bucati.push({ poligon: t.map(([x, y]) => [r2(x), r2(y)]), material, strat, sursa });
};

for (const a of D.suprafete.arii) {
  const el = element(a.osm);
  for (const t of triunghiuri(geo(el))) adauga(t, a.material, a.strat, `osm way/${a.osm}@${el.v}`);
}
const drumuri = [];
for (const d of D.suprafete.drumuri) {
  const el = element(d.osm);
  if (!el) throw new Error(`OSM ${d.osm} nu e în instantaneu`);
  const lin = geo(el);
  const l = d.latime ? { latime: d.latime, masurata: false, statii: 0, fortata: true } : latime(lin, d.implicita);
  drumuri.push({ osm: d.osm, material: d.material, ...l });
  const g = l.latime / 2;
  for (let k = 1; k < lin.length; k++) {
    const [a, b] = [lin[k - 1], lin[k]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.05) continue;
    const nx = (-(b[1] - a[1]) / L) * g, ny = ((b[0] - a[0]) / L) * g;
    adauga([[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny]], d.material, d.strat, `osm way/${d.osm}@${el.v}`);
    // îmbinarea: un pătrat pe nod, ca la cotituri să nu rămână o fantă
    if (k < lin.length - 1) adauga([[b[0] - g, b[1] - g], [b[0] + g, b[1] - g], [b[0] + g, b[1] + g], [b[0] - g, b[1] + g]], d.material, d.strat, `osm way/${d.osm}@${el.v}`);
  }
}

// ------------------------------------------------------------ culorile

// Albedo ca în paletă: L din cuantila 0,8, nuanța din pixelii peste mediană. Pe
// sol plat lumina ortofotoului e aceeași ca la vegetația terenului — nu se
// corectează nimic, ca cele două să rămână comparabile.
function albedo(px) {
  const lab = px.map((q) => laOklab(...q));
  const L = lab.map((q) => q[0]);
  const lumina = cuantila(L, 0.8), med = cuantila(L, 0.5);
  const sus = lab.filter((q) => q[0] >= med);
  const a = sus.reduce((s0, q) => s0 + q[1], 0) / sus.length, b = sus.reduce((s0, q) => s0 + q[2], 0) / sus.length;
  const rgb = dinOklab([lumina, a, b]);
  const arse = px.filter((q) => q.some((c) => c >= 254)).length / px.length;
  return { rgb, culoare: hex(rgb), oklab: { L: r3(lumina), a: r3(a), b: r3(b) }, n: px.length, arse: r3(arse), sursa: 'ortofoto' };
}
const materiale = {};
for (const mat of [...new Set(bucati.map((b) => b.material))]) {
  const px = [];
  for (const b of bucati.filter((q) => q.material === mat)) {
    const p = b.poligon, xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.25) for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) {
      let in_ = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) in_ = !in_;
      if (!in_) continue;
      const q = oPix(x, y); if (q) px.push(q);
    }
  }
  materiale[mat] = { ...albedo(px), de_ce: `pixelii de ortofoto din suprafețele „${mat}"` };
}

console.log(`Suprafețe: ${bucati.length} poligoane convexe în zona pozei.`);
console.log('Drumurile (lățimea măsurată pe ortofoto, altfel cea implicită):');
for (const d of drumuri) console.log(`  way/${d.osm} ${d.material.padEnd(10)} ${d.latime} m ${d.fortata ? '(din decizii.json)' : d.masurata ? `(${d.statii} stații)` : `(implicită; ${d.statii} stații)`}`);
console.log('Materialele:');
for (const [k, m] of Object.entries(materiale)) console.log(`  ${k.padEnd(12)} ${m.culoare}  L ${m.oklab.L} a ${m.oklab.a} b ${m.oklab.b}  n ${m.n}, arși ${(m.arse * 100).toFixed(1)}%`);

writeFileSync('date-sursa/derivate/suprafete-sanctuar.json', JSON.stringify({ generat: new Date().toISOString(), zona: zona.map(([x, y]) => [r2(x), r2(y)]), drumuri, materiale, bucati }, null, 1));
console.log('scris: date-sursa/derivate/suprafete-sanctuar.json');
