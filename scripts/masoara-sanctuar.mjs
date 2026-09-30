// Măsurătorile sanctuarului pe MDS și MDT: acoperișuri, turnuri, profile.
//
//   npm run masoara-sanctuar
//
// Intră: rastrul lui nmds-sanctuar și scripts/sanctuar/parti.json — descompunerea
// clădirilor în părți, scrisă de mână pe hărțile de cote. Iese:
// date-sursa/derivate/masuratori-sanctuar.json și rezidual.png.
//
// Un acoperiș e reprezentat ca MINIMUL unor plane peste un poligon convex. Așa ies
// fără cazuri speciale acoperișul într-o apă (un plan), în două (două plane care se
// taie pe coamă), în trei și în patru ape (cu teșituri): la orice punct, suprafața
// e planul cel mai jos. Planele nu se aleg: se găsesc, cu RANSAC, în pixelii MDS ai
// părții. Ce scriu eu în parti.json e numai unde e partea și câte ape să caute.
//
// Marginile exterioare ale unei părți se măsoară pe MDS: acolo unde acoperișul cade
// la sol, pe profile perpendiculare, cu mediana lor. Marginile comune cu o altă parte
// nu au salt și rămân cum sunt scrise.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cadru, incarcaRastru, inPoligon } from './comun/rastru-sanctuar.mjs';
import { scriePng } from './comun/png.mjs';
import { laTM06 } from './comun/tm06.mjs';
import { scheletZiduri } from './comun/schelet.mjs';

const R = incarcaRastru();
const { mds, mdt, W, H, F, pas } = R;
const PARTI = JSON.parse(readFileSync('scripts/sanctuar/parti.json', 'utf8'));
const cadre = Object.fromEntries(Object.entries(PARTI.cadre).map(([k, c]) => [k, cadru(c)]));

const TOL = 0.12;         // inlier la RANSAC, m
const PRAG_CLADIRE = 1.0; // nMDS peste care un pixel e construcție

let s = 20260929;
const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
const cuantila = (v, q) => { const a = Float64Array.from(v).sort(); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };
const r2 = (x) => Math.round(x * 100) / 100;

// ------------------------------------------------------------ marginile

/**
 * Unde cade acoperișul la sol pe o latură a părții: pe stații de 0,5 m de-a lungul
 * laturii, profilul MDS perpendicular pe ea; marginea e locul unde MDS trece prin
 * jumătatea dintre acoperișul de lângă margine și solul de dincolo. Mediana stațiilor.
 */
function rafineaza(c, u, v, latura) {
  const [a, b] = latura[0] === 'u' ? v : u;          // de-a lungul laturii
  const pe = latura[0] === 'u' ? 'u' : 'v';           // coordonata care se rafinează
  const nominal = latura === 'u0' ? u[0] : latura === 'u1' ? u[1] : latura === 'v0' ? v[0] : v[1];
  const spre = latura.endsWith('1') ? 1 : -1;         // în afară
  const gasite = [];
  for (let t = a + 0.5; t <= b - 0.5; t += 0.5) {
    const pt = (d) => (pe === 'u' ? c.laXY(nominal + d, t) : c.laXY(t, nominal + d));
    // Dincolo de margine se ia MDS, nu MDT: o parte se poate sprijini pe alta, mai joasă.
    const zIn = R.biliniar(mds, ...pt(-spre * 1.2)), zOut = R.biliniar(mds, ...pt(spre * 2));
    if (!(zIn - zOut > 1.5)) continue;
    const prag = (zIn + zOut) / 2;
    let gasit = null;
    for (let d = -1.5; d <= 1.5; d += 0.05) {
      const z1 = R.biliniar(mds, ...pt(spre * d)), z2 = R.biliniar(mds, ...pt(spre * (d + 0.05)));
      if (z1 >= prag && z2 < prag) { gasit = d + 0.05 * (z1 - prag) / (z1 - z2); break; }
    }
    if (gasit !== null) gasite.push(gasit);
  }
  if (gasite.length < 3) return { nominal, masurat: null, n: gasite.length };
  const d = cuantila(gasite, 0.5);
  return { nominal, masurat: r2(nominal + spre * d), n: gasite.length, abatere: r2(spre * d) };
}

// ------------------------------------------------------------ planele

function ransac(pts, maxPlane, minim = 12) {
  const plane = [];
  let rest = pts.slice();
  while (plane.length < maxPlane && rest.length >= minim) {
    let best = null;
    for (let it = 0; it < 4000; it++) {
      const [p, q, t] = [0, 0, 0].map(() => rest[Math.floor(rnd() * rest.length)]);
      const ux = q.x - p.x, uy = q.y - p.y, uz = q.z - p.z, vx = t.x - p.x, vy = t.y - p.y, vz = t.z - p.z;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz);
      if (L < 1e-6) continue;
      nx /= L; ny /= L; nz /= L;
      if (Math.abs(nz) < 0.4) continue; // mai abrupt de ~66°: perete, nu acoperiș
      const d = -(nx * p.x + ny * p.y + nz * p.z);
      let n = 0;
      for (const r of rest) if (Math.abs(nx * r.x + ny * r.y + nz * r.z + d) < TOL * Math.abs(nz)) n++;
      if (!best || n > best.n) best = { nx, ny, nz, d, n };
    }
    if (!best || best.n < Math.max(minim, 0.05 * pts.length)) break;
    const inl = rest.filter((r) => Math.abs(best.nx * r.x + best.ny * r.y + best.nz * r.z + best.d) < TOL * Math.abs(best.nz));
    plane.push(celeMaiMiciPatrate(inl));
    rest = rest.filter((r) => !inl.includes(r));
  }
  return plane;
}

/** z = A·x + B·y + C, cu x, y relative la media punctelor (numere mici). */
function celeMaiMiciPatrate(p) {
  const mx = p.reduce((a, q) => a + q.x, 0) / p.length, my = p.reduce((a, q) => a + q.y, 0) / p.length;
  let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0, sz = 0;
  for (const q of p) { const x = q.x - mx, y = q.y - my; sxx += x * x; sxy += x * y; syy += y * y; sxz += x * q.z; syz += y * q.z; sz += q.z; }
  const det = sxx * syy - sxy * sxy;
  const A = det ? (sxz * syy - syz * sxy) / det : 0, B = det ? (syz * sxx - sxz * sxy) / det : 0, C = sz / p.length;
  return { A, B, C: C - A * mx - B * my, n: p.length };
}

const zPlan = (pl, x, y) => pl.A * x + pl.B * y + pl.C;
const zMin = (plane, x, y) => Math.min(...plane.map((pl) => zPlan(pl, x, y)));

// ------------------------------------------------------------ rularea

const iesire = { generat: new Date().toISOString(), sursa: 'MDS/MDT DGT 50 cm (sanctuar-rastru)', cadre: PARTI.cadre, parti: [] };
const model = new Float32Array(W * H).fill(NaN);
let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };

// OSM, pentru părțile date prin element: geometria de lucru (Ermida de dinainte de 2022).
const osm = (() => {
  const man = JSON.parse(readFileSync('scripts/sanctuar/osm-manifest.json', 'utf8'));
  const inst = JSON.parse(readFileSync(`date-sursa/osm/${man.fisier}`, 'utf8'));
  const ERMIDA = new Set([999972306, 999972305, 999972304]);
  return (id, varianta) => {
    const el = inst.elemente.find((e) => e.id === id);
    if (!el) throw new Error(`OSM ${id} nu e în instantaneu`);
    const n = (varianta === 'inainte' || (ERMIDA.has(id) && varianta !== 'azi')) && el.inainte?.noduri ? el.inainte.noduri : el.noduri;
    return n.map(([, , lat, lon]) => { const q = laTM06(lon, lat); return [q.x, q.y]; });
  };
})();

/** Poligonul TM06 al unei părți: dreptunghi în cadru, poligon în cadru sau element OSM. */
function geometrie(p, c, u, v) {
  if (p.osm) return osm(p.osm, p.varianta);
  if (p.poligon) { const q = p.poligon.map(([a, b]) => c.laXY(a, b)); return q.concat([q[0]]); }
  return c.dreptunghi(u, v);
}
/** Același poligon, micșorat spre centroid cu `e` metri (aproximativ, pentru poligoane convexe). */
function micsoreaza(poli, e) {
  const n = poli.length - 1, cx = poli.slice(0, n).reduce((s, q) => s + q[0], 0) / n, cy = poli.slice(0, n).reduce((s, q) => s + q[1], 0) / n;
  return poli.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; const k = Math.max(0, (d - e) / d); return [cx + (x - cx) * k, cy + (y - cy) * k]; });
}

for (const p of PARTI.parti) {
  const c = cadre[p.cadru ?? 'biserica'];
  const u = p.u?.slice(), v = p.v?.slice();
  const margini = {};
  if (u && v) for (const l of p.libere ?? []) {
    const m = rafineaza(c, u, v, l);
    margini[l] = m;
    if (m.masurat !== null && Math.abs(m.abatere) <= 1.5) {
      if (l === 'u0') u[0] = m.masurat; else if (l === 'u1') u[1] = m.masurat; else if (l === 'v0') v[0] = m.masurat; else v[1] = m.masurat;
    }
  }
  const poligon = geometrie(p, c, u, v);
  // pixelii interiori, la `e` de margini: acolo nu se amestecă acoperișul cu peretele
  const e = p.eroziune ?? 0.5;
  const interior = u && v && !p.poligon ? c.dreptunghi([u[0] + e, u[1] - e], [v[0] + e, v[1] - e]) : micsoreaza(poligon, e);
  const linie = p.tip === 'zid_linie';
  const idx = linie ? [] : R.pixeliIn(interior);
  const inel = linie ? [] : R.pixeliIn(micsoreaza(poligon, -1.5));
  const sol = inel.filter((i) => !inPoligon(R.centru(i).x, R.centru(i).y, poligon) && mds[i] - mdt[i] < 0.3 && !R.esteApa(mdt[i])).map((i) => mdt[i]);
  const solSub = linie ? [] : R.pixeliIn(poligon).map((i) => mdt[i]).filter((z) => z > 0);
  const rez = { cheie: p.cheie, tip: p.tip, cadru: p.cadru ?? 'biserica', margini,
    ...(u && v && !p.poligon && !p.osm ? { u: u.map(r2), v: v.map(r2) } : {}),
    poligon_tm06: poligon.map(([x, y]) => [r2(x), r2(y)]),
    sol: { min: solSub.length || sol.length ? r2(solSub.concat(sol).reduce((a, z) => Math.min(a, z), Infinity)) : null, mediana_inel: sol.length ? r2(cuantila(sol, 0.5)) : null } };

  const pts = idx.filter((i) => mds[i] - mdt[i] > PRAG_CLADIRE).map((i) => ({ ...R.centru(i), z: mds[i], i }));
  if (p.tip === 'acoperis') {
    const plane = ransac(pts, p.ape ?? 4, p.minim ?? 12);
    const res = [];
    for (const q of pts) { const zm = zMin(plane, q.x, q.y); res.push(q.z - zm); }
    for (const i of R.pixeliIn(poligon)) { const { x, y } = R.centru(i); if (plane.length) model[i] = zMin(plane, x, y); }
    const abs = res.map(Math.abs);
    rez.plane = plane.map((pl) => {
      const panta = Math.atan(Math.hypot(pl.A, pl.B)) * 180 / Math.PI;
      const azJos = ((Math.atan2(-pl.A, -pl.B) * 180) / Math.PI + 360) % 360;
      return { A: pl.A, B: pl.B, C: pl.C, n: pl.n, panta: r2(panta), azimut_jos: r2(azJos) };
    });
    rez.reziduu = res.length ? { n: res.length, mediana: r2(cuantila(res, 0.5)), p90_abs: r2(cuantila(abs, 0.9)) } : null;
    const zs = pts.map((q) => q.z);
    rez.cote = zs.length ? { min: r2(Math.min(...zs)), max: r2(Math.max(...zs)) } : null;
  } else if (p.tip === 'turn') {
    const zs = pts.map((q) => q.z);
    const varf = pts.reduce((a, q) => (q.z > a.z ? q : a), { z: -Infinity });
    rez.varf = { z: r2(varf.z), uv: varf.x ? c.laUV(varf.x, varf.y).map(r2) : null };
    rez.platforma = r2(cuantila(zs, 0.5));
    rez.cote = { p25: r2(cuantila(zs, 0.25)), p75: r2(cuantila(zs, 0.75)) };
    for (const q of pts) model[q.i] = q.z;
  } else if (p.tip === 'profil') {
    // Profilul de sus pe v: maximul MDS pe fâșia u, la pas de 0,5 m.
    rez.profil = [];
    for (let t = v[0]; t <= v[1] + 1e-9; t += 0.5) {
      let m = -Infinity;
      for (let q = u[0]; q <= u[1] + 1e-9; q += 0.25) m = Math.max(m, R.biliniar(mds, ...c.laXY(q, t)));
      rez.profil.push([r2(t), r2(m)]);
    }
  } else if (p.tip === 'cupola') {
    // Profilul radial al MDS în jurul centrului: pe inele de 0,25 m, cuantila 0,9
    // (vârful inelului, nu marginea lui amestecată cu peretele).
    const n = poligon.length - 1;
    const cx = poligon.slice(0, n).reduce((s, q) => s + q[0], 0) / n, cy = poligon.slice(0, n).reduce((s, q) => s + q[1], 0) / n;
    const pix = R.pixeliIn(micsoreaza(poligon, -1));
    const inele = new Map();
    for (const i of pix) { const q = R.centru(i); const r = Math.floor(Math.hypot(q.x - cx, q.y - cy) / 0.25); if (!inele.has(r)) inele.set(r, []); inele.get(r).push(mds[i]); }
    rez.centru = [r2(cx), r2(cy)];
    rez.profil_radial = [...inele.keys()].sort((a, b) => a - b).map((r) => [r2((r + 0.5) * 0.25), r2(cuantila(inele.get(r), 0.9)), inele.get(r).length]);
    for (const i of R.pixeliIn(poligon)) model[i] = mds[i];
  } else if (p.tip === 'ziduri') {
    // Zidurile din regiune: nMDS peste prag, fără vegetație, subțiate la axă.
    const pix = R.pixeliIn(p.extinde ? micsoreaza(poligon, -p.extinde) : poligon);
    const cs = pix.map((i) => i % W), rs = pix.map((i) => Math.floor(i / W));
    const c0 = Math.min(...cs) - 1, r0 = Math.min(...rs) - 1, w = Math.max(...cs) - c0 + 2, h = Math.max(...rs) - r0 + 2;
    const prag = p.prag ?? 0.8;
    const m = new Uint8Array(w * h);
    for (const i of pix) {
      if (mds[i] - mdt[i] > prag && R.ndvi[i] < (p.ndvi ?? 0.2) && Number.isNaN(model[i])) m[(Math.floor(i / W) - r0) * w + (i % W) - c0] = 1;
    }
    const linii = scheletZiduri(m, w, h, { tolPx: (p.toleranta ?? 0.3) / pas, minPx: Math.round((p.lungime_min ?? 1.5) / pas) });
    const laTM = ([x, y]) => [F.x0 + (c0 + x + 0.5) * pas, F.y1 - (r0 + y + 0.5) * pas];
    rez.ziduri = linii.map((l) => {
      const pts3 = l.map(laTM);
      // sus: cuantila 0,75 a MDS pe pixelii măștii la cel mult 0,6 m de linie; grosime: aria lor / lungime
      let L = 0; for (let k = 1; k < pts3.length; k++) L += Math.hypot(pts3[k][0] - pts3[k - 1][0], pts3[k][1] - pts3[k - 1][1]);
      const aproape = [];
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        if (!m[yy * w + xx]) continue;
        const [X, Y] = laTM([xx, yy]);
        let dmin = Infinity;
        for (let k = 1; k < pts3.length; k++) {
          const [ax, ay] = pts3[k - 1], [bx, by] = pts3[k], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
          const t = Math.max(0, Math.min(1, ((X - ax) * dx + (Y - ay) * dy) / L2));
          dmin = Math.min(dmin, Math.hypot(X - ax - t * dx, Y - ay - t * dy));
        }
        if (dmin <= 0.6) aproape.push((r0 + yy) * W + c0 + xx);
      }
      const sus = aproape.length ? cuantila(aproape.map((i) => mds[i]), 0.75) : NaN;
      const solZ = aproape.length ? cuantila(aproape.map((i) => mdt[i]), 0.5) : NaN;
      const grosime = (aproape.length * pas * pas) / Math.max(L, 0.5);
      const drept = Math.hypot(pts3[pts3.length - 1][0] - pts3[0][0], pts3[pts3.length - 1][1] - pts3[0][1]) / Math.max(L, 1e-9);
      return { linie: pts3.map(([x, y]) => [r2(x), r2(y)]), lungime: r2(L), sus: r2(sus), sol: r2(solZ), grosime: r2(grosime), drept: r2(drept), aproape };
    }).filter((z) => {
      // Ce nu e zid: bucăți scurte, pete groase sau înalte — coroane de copaci, mașini.
      const bun = z.lungime >= (p.lungime_min ?? 1.5) && z.grosime <= (p.grosime_max ?? 1.3) && z.sus - z.sol <= (p.inaltime_max ?? 4.5) && z.sus - z.sol >= 0.4;
      if (bun) for (const i of z.aproape) model[i] = z.sus;
      delete z.aproape;
      return bun;
    });
  } else if (p.tip === 'zid_linie') {
    // Un zid dat ca linie (OSM): sus pe stații de 1 m, maximul MDS la ±0,75 m de linie.
    const lin = poligon;
    rez.profil = [];
    let s0 = 0;
    for (let k = 1; k < lin.length; k++) {
      const [ax, ay] = lin[k - 1], [bx, by] = lin[k], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
      for (let d = 0; d < L; d += 1) {
        const x = ax + ((bx - ax) * d) / L, y = ay + ((by - ay) * d) / L;
        if (Number.isNaN(R.biliniar(mds, x, y))) continue;
        let mx = -Infinity, sol0 = Infinity;
        for (let o = -0.75; o <= 0.75; o += 0.25) { mx = Math.max(mx, R.biliniar(mds, x + nx * o, y + ny * o)); sol0 = Math.min(sol0, R.biliniar(mdt, x + nx * o, y + ny * o)); }
        rez.profil.push([r2(s0 + d), r2(mx), r2(sol0)]);
      }
      s0 += L;
    }
  }
  iesire.parti.push(rez);
  const m = Object.entries(margini).map(([l, x]) => `${l} ${x.masurat === null ? '—' : (x.abatere >= 0 ? '+' : '') + x.abatere}`).join(' ');
  const pl = rez.plane ? rez.plane.map((q) => `${q.panta}°→${q.azimut_jos.toFixed(0)}°`).join(', ') : '';
  console.log(`${p.cheie.padEnd(28)} ${rez.u ? `u ${rez.u.join('..')} v ${rez.v.join('..')}` : `${poligon.length - 1} vârfuri`}  sol ${rez.sol.min}` +
    (rez.plane ? `  ${rez.plane.length} plane [${pl}]` + (rez.cote ? ` cote ${rez.cote.min}..${rez.cote.max}` : '') + (rez.reziduu ? ` reziduu med ${rez.reziduu.mediana} p90 ${rez.reziduu.p90_abs}` : '') : '') +
    (rez.varf ? `  vârf ${rez.varf.z} la (${rez.varf.uv}), platformă ${rez.platforma}` : '') +
    (rez.profil_radial ? `  cupolă: ${rez.profil_radial.filter((q, k) => k % 4 === 0).map(([r, z]) => `${r} m→${z}`).join(', ')}` : '') +
    (rez.ziduri ? `  ${rez.ziduri.length} ziduri, ${r2(rez.ziduri.reduce((s0, z) => s0 + z.lungime, 0))} m, sus ${r2(Math.min(...rez.ziduri.map((z) => z.sus)))}..${r2(Math.max(...rez.ziduri.map((z) => z.sus)))}` : '') +
    (p.tip === 'zid_linie' ? (() => { const f2 = rez.profil.filter((q) => Number.isFinite(q[1]) && Number.isFinite(q[2])); return `  ${f2.length} stații, înălțime peste sol ${r2(Math.min(...f2.map((q) => q[1] - q[2])))}..${r2(Math.max(...f2.map((q) => q[1] - q[2])))}`; })() : '') +
    (m ? `  margini: ${m}` : ''));
}

// ------------------------------------------------------------ coșurile

// Un coș e o pată mică unde MDS-ul trece cu peste 0,5 m de acoperișul modelat:
// 1–24 de pixeli (0,25–6 m²), toată în interiorul unei părți cu acoperiș. Cota lui
// e maximul MDS din pată; mărimea, latura pătratului de aceeași arie — la 50 cm
// un coș de 0,6 m apare pe un pixel sau doi, deci latura e o margine de jos.
{
  const eticheta = new Int32Array(W * H).fill(-1);
  const inRoof = new Uint8Array(W * H);
  for (const p of iesire.parti) if (p.tip === 'acoperis' && p.plane?.length) for (const i of R.pixeliIn(p.poligon_tm06)) inRoof[i] = 1;
  const peste = (i) => inRoof[i] && !Number.isNaN(model[i]) && mds[i] - model[i] > 0.5;
  iesire.cosuri = [];
  for (let s0 = 0; s0 < W * H; s0++) {
    if (!peste(s0) || eticheta[s0] >= 0) continue;
    const st = [s0], pix = [];
    eticheta[s0] = s0;
    while (st.length) {
      const i = st.pop(); pix.push(i);
      for (const d of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) { const j = i + d; if (j >= 0 && j < W * H && peste(j) && eticheta[j] < 0) { eticheta[j] = s0; st.push(j); } }
    }
    if (pix.length < 1 || pix.length > 8) continue;
    const c = pix.map((i) => R.centru(i));
    const x = c.reduce((a, q) => a + q.x, 0) / c.length, y = c.reduce((a, q) => a + q.y, 0) / c.length;
    const sus = Math.max(...pix.map((i) => mds[i]));
    const acoperis = Math.min(...pix.map((i) => model[i]));
    // Peste 2,5 m nu mai e coș: e o parte vecină mai înaltă (turnul lângă navă,
    // frontonul navei peste capela-mor), unde planele unei părți ies din ea.
    if (sus - acoperis < 0.5 || sus - acoperis > 2.5) continue;
    const parteCos = iesire.parti.find((p) => p.tip === 'acoperis' && p.plane?.length && inPoligon(x, y, p.poligon_tm06));
    // Biserica n-are coșuri în nicio fotografie; ce iese acolo sunt crucile de pe
    // frontoane și îmbinările dintre corpuri.
    if (!parteCos || parteCos.cheie.startsWith('biserica.')) continue;
    iesire.cosuri.push({ parte: parteCos.cheie, cadru: PARTI.parti.find((q) => q.cheie === parteCos.cheie)?.cadru ?? 'biserica', acoperis: r2(acoperis), x: r2(x), y: r2(y), sus: r2(sus), peste_acoperis: r2(sus - acoperis), latura: r2(Math.min(2, Math.max(0.6, Math.sqrt(pix.length) * pas))), pixeli: pix.length });
  }
  console.log(`
coșuri: ${iesire.cosuri.length}; ${iesire.cosuri.map((q) => `${q.peste_acoperis} m`).join(', ')}`);
}

// Reziduul, ca imagine: MDS minus modelul, pe părțile modelate.
const cutie = (() => {
  let c0 = W, c1 = 0, r0 = H, r1 = 0;
  for (let i = 0; i < W * H; i++) if (!Number.isNaN(model[i])) { const c = i % W, r = Math.floor(i / W); c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
  return { c0: Math.max(0, c0 - 10), c1: Math.min(W - 1, c1 + 10), r0: Math.max(0, r0 - 10), r1: Math.min(H - 1, r1 + 10) };
})();
const SC = 4, w = (cutie.c1 - cutie.c0 + 1) * SC, h = (cutie.r1 - cutie.r0 + 1) * SC, rgb = new Uint8Array(w * h * 3);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = (cutie.r0 + Math.floor(y / SC)) * W + cutie.c0 + Math.floor(x / SC);
  let col;
  if (Number.isNaN(model[i])) { const n = mds[i] - mdt[i]; const g = n > PRAG_CLADIRE ? 90 : 30; col = [g, g, g]; }
  else { const d = Math.max(-1, Math.min(1, mds[i] - model[i])); col = d > 0 ? [255, Math.round(255 * (1 - d)), Math.round(255 * (1 - d))] : [Math.round(255 * (1 + d)), Math.round(255 * (1 + d)), 255]; }
  rgb.set(col, (y * w + x) * 3);
}
mkdirSync('date-sursa/derivate', { recursive: true });
writeFileSync('date-sursa/derivate/rezidual.png', scriePng(w, h, rgb));
writeFileSync('date-sursa/derivate/masuratori-sanctuar.json', JSON.stringify(iesire, null, 1));
writeFileSync('date-sursa/derivate/model-sanctuar.bin', Buffer.from(model.buffer));
console.log(`\nscris: date-sursa/derivate/masuratori-sanctuar.json, rezidual.png (${w}×${h}; roșu = MDS peste model, albastru = sub, alb = potrivit)`);
console.log(picate ? `\n${picate} probe picate.` : '');
process.exitCode = picate ? 1 : 0;
