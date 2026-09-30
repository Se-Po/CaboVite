// Formele sanctuarului: funcții pure care scriu triunghiuri colorate.
//
// Nimic de aici nu atinge three.js: primesc coordonate de scenă (x spre est, y în
// sus, z spre sud) și culori sRGB, și scriu într-un `Scriitor`. De aceea le poate
// chema și unealta de verificare din Node, pe aceleași numere ca pagina.
//
// Formatul e al terenului, ca cele două să se așeze la fel în lumină: fațete
// plate, fără atributul `normal` — shaderul cu `flatShading` își face normala din
// planul fațetei —, culoarea liniară pe Uint16 normalizat. Fiecare triunghi își
// verifică sensul față de o direcție „spre afară" dată de cine îl cere, fiindcă
// materialul desenează numai fața din față.

import { SPRE_LINIAR } from './palette.js';

const CUANTA = 65535;

/**
 * Tablouri care cresc, apoi se predau ca Float32Array / Uint16Array / Uint8Array.
 *
 * Pe lângă culoare, fiecare vârf poartă o ocluzie ambientală, 0–1: cât din cer
 * vede suprafața. Lumina soarelui are umbre adevărate; cea a cerului
 * (HemisphereLight) nu, și fără ocluzie fundul unei galerii ar primi exact cât
 * fațada din fața ei. Pe aripa de sud, care stă mereu în umbră, arcada n-ar mai
 * avea deloc contrast. Ocluzia NU e culoare: albedoul rămâne cel măsurat, iar
 * shaderul o aplică numai luminii indirecte — ce face și `aoMap` în three.js.
 * Valorile se dau pe tipuri de suprafață, ca aproximări geometrice, nu măsurători.
 */
export function creeazaScriitor() {
  let poz = new Float32Array(3 * 3 * 4096), cul = new Uint16Array(3 * 3 * 4096), occ = new Uint8Array(3 * 4096), n = 0;
  let ocluzieCurenta = 255;
  const creste = () => {
    const p = new Float32Array(poz.length * 2); p.set(poz); poz = p;
    const c = new Uint16Array(cul.length * 2); c.set(cul); cul = c;
    const o = new Uint8Array(occ.length * 2); o.set(occ); occ = o;
  };
  const liniar = new Map();
  const culoare = (rgb) => {
    const k = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    let v = liniar.get(k);
    if (!v) { v = rgb.map((q) => Math.round(SPRE_LINIAR[q] * CUANTA)); liniar.set(k, v); }
    return v;
  };
  let xMin = Infinity, yMin = Infinity, zMin = Infinity, xMax = -Infinity, yMax = -Infinity, zMax = -Infinity;
  return {
    /**
     * Un triunghi. `spre` e o direcție aproximativă spre afară; dacă normala
     * triunghiului o contrazice, ordinea se inversează.
     */
    tri(a, b, c, rgb, spre) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * nx + ny * ny + nz * nz < 1e-12) return; // degenerat
      if (spre && nx * spre[0] + ny * spre[1] + nz * spre[2] < 0) { const t = b; b = c; c = t; }
      if (n + 9 > poz.length) creste();
      const col = culoare(rgb);
      for (const p of [a, b, c]) {
        poz[n] = p[0]; poz[n + 1] = p[1]; poz[n + 2] = p[2];
        cul[n] = col[0]; cul[n + 1] = col[1]; cul[n + 2] = col[2];
        occ[n / 3] = ocluzieCurenta;
        n += 3;
        if (p[0] < xMin) xMin = p[0]; if (p[0] > xMax) xMax = p[0];
        if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1];
        if (p[2] < zMin) zMin = p[2]; if (p[2] > zMax) zMax = p[2];
      }
    },
    /** Un patrulater plan, ca două triunghiuri. */
    quad(a, b, c, d, rgb, spre) { this.tri(a, b, c, rgb, spre); this.tri(a, c, d, rgb, spre); },
    /** Un poligon plan convex, în evantai. */
    poligon(pts, rgb, spre) { for (let k = 1; k + 1 < pts.length; k++) this.tri(pts[0], pts[k], pts[k + 1], rgb, spre); },
    get nrTriunghiuri() { return n / 9; },
    /**
     * Adevărat dacă toate vârfurile scrise de la triunghiul `t0` încoace sunt finite.
     * Un NaN nu aruncă nicăieri: ar ajunge tăcut pe placă, ca fațete care nu se văd.
     */
    finite(t0) { for (let i = t0 * 9; i < n; i++) if (!Number.isFinite(poz[i])) return false; return true; },
    /** Uită tot ce s-a scris după triunghiul `t0`. Cutia rămâne cea largă, deci doar conservatoare. */
    inapoi(t0) { n = Math.min(n, t0 * 9); },
    /** Scrie tot ce cere `f` cu ocluzia `k` (0–1), apoi revine la cea de dinainte. */
    cuOcluzie(k, f) {
      const inainte = ocluzieCurenta;
      ocluzieCurenta = Math.round(Math.min(1, Math.max(0, k)) * 255);
      try { f(); } finally { ocluzieCurenta = inainte; }
    },
    /** Datele strânse, la mărimea exactă, plus cutia lor. */
    preda() {
      return { pozitii: poz.slice(0, n), culori: cul.slice(0, n), ocluzie: occ.slice(0, n / 3), cutie: { xMin, yMin, zMin, xMax, yMax, zMax } };
    },
  };
}

// ------------------------------------------------------------ plane și plic

/** y al planului [a, b, c] în (x, z): y = a·x + b·z + c. */
export const yPlan = (pl, x, z) => pl[0] * x + pl[1] * z + pl[2];
export const yMinim = (plane, x, z) => { let m = Infinity; for (const pl of plane) { const y = yPlan(pl, x, z); if (y < m) m = y; } return m; };

/**
 * Taie un poligon convex (x, z) cu semiplanul a·x + b·z + c ≤ 0 (Sutherland–Hodgman).
 */
export function taie(poli, a, b, c) {
  const out = [];
  for (let k = 0; k < poli.length; k++) {
    const p = poli[k], q = poli[(k + 1) % poli.length];
    const fp = a * p[0] + b * p[1] + c, fq = a * q[0] + b * q[1] + c;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/**
 * Acoperișul ca minimul planelor peste un poligon convex: pentru fiecare plan,
 * bucata de poligon unde el e cel mai jos. Așa ies, fără cazuri speciale,
 * acoperișul într-o apă, în două, în trei și în patru, cu teșituri.
 */
export function plicMinim(contur, plane) {
  const fatete = [];
  plane.forEach((pl, i) => {
    let reg = contur.slice();
    for (let j = 0; j < plane.length && reg.length >= 3; j++) {
      if (j === i) continue;
      const q = plane[j];
      reg = taie(reg, pl[0] - q[0], pl[1] - q[1], pl[2] - q[2]); // pl ≤ q
    }
    if (reg.length >= 3) fatete.push({ plan: i, poligon: reg });
  });
  return fatete;
}

/**
 * Marginea de sus a unui perete, pe latura [p, q]: cota acoperișului e liniară pe
 * bucăți, cu frângeri acolo unde se schimbă planul cel mai jos.
 */
export function profilLatura(p, q, plane) {
  const t = new Set([0, 1]);
  for (let i = 0; i < plane.length; i++) for (let j = i + 1; j < plane.length; j++) {
    const a = plane[i], b = plane[j];
    const fp = yPlan(a, p[0], p[1]) - yPlan(b, p[0], p[1]), fq = yPlan(a, q[0], q[1]) - yPlan(b, q[0], q[1]);
    if (fp * fq < 0) t.add(fp / (fp - fq));
  }
  return [...t].sort((x, y) => x - y).map((s) => {
    const x = p[0] + (q[0] - p[0]) * s, z = p[1] + (q[1] - p[1]) * s;
    return [x, yMinim(plane, x, z), z];
  });
}

/** Normala spre afară a laturii p→q a unui poligon în sens trigonometric (x, z). */
function afara(p, q, sens) {
  const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1;
  return [sens * dz / L, 0, sens * -dx / L];
}
/**
 * Semnul ariei în planul (x, z): +1 dacă interiorul e la stânga fiecărei laturi
 * p→q, adică normala spre afară e (dz, −dx). Verificat pe pătratul unitate
 * (0,0)→(1,0)→(1,1)→(0,1): aria cu semn e +1, iar latura de jos are normala
 * spre afară (0, −1).
 */
function sensul(poli) {
  let s = 0;
  for (let k = 0; k < poli.length; k++) { const p = poli[k], q = poli[(k + 1) % poli.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return s > 0 ? 1 : -1;
}

/**
 * Un corp: pereți de la talpă până la acoperiș și acoperișul din plane.
 *
 * @param {Array<[number, number]>} contur — poligon convex (x, z), fără închidere
 * @param {number} talpa — cota de jos a pereților, sub teren
 * @param {Array<[number, number, number]>} plane
 * @param {{jos?: boolean}} [opt] — `jos`: și fața de dedesubt, pentru un corp care
 *   nu stă pe teren (etajul de peste galerie, streașina)
 */
export function corp(s, contur, talpa, plane, perete, acoperis, { jos = false } = {}) {
  const sens = sensul(contur);
  for (let k = 0; k < contur.length; k++) {
    const p = contur[k], q = contur[(k + 1) % contur.length];
    const sus = profilLatura(p, q, plane), spre = afara(p, q, sens);
    for (let m = 0; m + 1 < sus.length; m++) {
      const [a, b] = [sus[m], sus[m + 1]];
      s.quad([a[0], talpa, a[2]], [b[0], talpa, b[2]], b, a, perete, spre);
    }
  }
  for (const f of plicMinim(contur, plane)) {
    const pl = plane[f.plan];
    s.poligon(f.poligon.map(([x, z]) => [x, yPlan(pl, x, z), z]), acoperis, [0, 1, 0]);
  }
  if (jos) s.poligon(contur.map(([x, z]) => [x, talpa, z]), perete, [0, -1, 0]);
}

/**
 * Poligonul convex (x, z) cu fiecare latură k retrasă spre interior cu `d[k]` metri:
 * dreptele laturilor se mută paralel, iar colțurile ies din intersecția lor.
 */
export function retrage(contur, d) {
  const sens = sensul(contur), n = contur.length;
  const drepte = contur.map((p, k) => {
    const q = contur[(k + 1) % n], o = afara(p, q, sens);
    return { p: [p[0] - o[0] * d[k], p[1] - o[2] * d[k]], v: [q[0] - p[0], q[1] - p[1]] };
  });
  return drepte.map((b, k) => {
    const a = drepte[(k + n - 1) % n];
    const det = a.v[0] * b.v[1] - a.v[1] * b.v[0];
    if (Math.abs(det) < 1e-9) return b.p;
    const t = ((b.p[0] - a.p[0]) * b.v[1] - (b.p[1] - a.p[1]) * b.v[0]) / det;
    return [a.p[0] + a.v[0] * t, a.p[1] + a.v[1] * t];
  });
}

/**
 * O placă într-un plan vertical: poligonul convex `contur` [[u, y], …], cu u de-a
 * lungul direcției `d` pornind din `o`, scos din perete spre `n` între v0 și v1
 * metri. Pentru rame, uși, cornișe, trepte. Fața din spate, lipită de perete
 * (v0 = 0), nu se scrie.
 */
export function placa(s, { o, d, n, contur, iesire: [v0, v1] }, rgb) {
  const P = (u, y, v) => [o[0] + d[0] * u + n[0] * v, y, o[1] + d[1] * u + n[1] * v];
  const nOut = [n[0], 0, n[1]];
  s.poligon(contur.map(([u, y]) => P(u, y, v1)), rgb, nOut);
  if (v0 > 1e-3) s.poligon(contur.map(([u, y]) => P(u, y, v0)), rgb, [-n[0], 0, -n[1]]);
  const cu = contur.reduce((a, q) => a + q[0], 0) / contur.length, cy = contur.reduce((a, q) => a + q[1], 0) / contur.length;
  for (let k = 0; k < contur.length; k++) {
    const [u0, y0] = contur[k], [u1, y1] = contur[(k + 1) % contur.length];
    const mu = (u0 + u1) / 2 - cu, my = (y0 + y1) / 2 - cy;
    s.quad(P(u0, y0, v0), P(u1, y1, v0), P(u1, y1, v1), P(u0, y0, v1), rgb, [d[0] * mu, my, d[1] * mu]);
  }
}

/**
 * O ramă de fereastră sau de ușă: patru bare late de `l` în jurul golului
 * [u0, u1] × [y0, y1], scoase din perete cu `iesire`. `fara_jos`: fără bara de
 * jos — la uși, unde rama coboară până în prag.
 */
export function rama(s, { o, d, n, u: [u0, u1], y: [y0, y1], l, iesire, fara_jos = false }, rgb) {
  const bara = (uu, yy) => placa(s, { o, d, n, iesire: [0, iesire], contur: [[uu[0], yy[0]], [uu[1], yy[0]], [uu[1], yy[1]], [uu[0], yy[1]]] }, rgb);
  const jos = fara_jos ? y0 : y0 + l;
  bara([u0, u1], [y1 - l, y1]);
  if (!fara_jos) bara([u0, u1], [y0, y0 + l]);
  bara([u0, u0 + l], [jos, y1 - l]);
  bara([u1 - l, u1], [jos, y1 - l]);
}

/** Punctele unui arc în mâner de coș (semielipsă) între uL și uR, de la naștere la cheie. */
function puncteArc(uL, uR, nastere, cheie, segmente = 8) {
  const hw = (uR - uL) / 2, uc = (uL + uR) / 2, sageata = Math.max(0, Math.min(cheie - nastere, hw * 1.2));
  return Array.from({ length: segmente + 1 }, (_, j) => {
    const t = (Math.PI * j) / segmente;
    return [uc - hw * Math.cos(t), nastere + sageata * Math.sin(t)];
  });
}

/**
 * O arcadă de-a lungul unui zid: stâlpi pătrați, arce în mâner de coș, zidăria de
 * deasupra până la tavan.
 *
 * Două feluri:
 *   - GALERIE (`adancime` > 0): în spatele arcelor, o galerie adâncă de `adancime`
 *     metri, cu pardoseală, tavan, perete de fund și pereți la capete. Stâlpii au
 *     adâncimea egală cu lățimea — „pilares quadrangulares”, SIPA.
 *   - PASAJ (`adancime` = 0): arcul trece prin toată `grosime`a, deschis la ambele
 *     capete; stâlpii sunt pereții pasajului. Cu `spate: false`, fața din spate nu
 *     se scrie — golul unui turn, al cărui fund e miezul turnului.
 *
 * Coordonate: `a` pe fața zidului, `d` de-a lungul lui, `m` spre interior; u în
 * metri de la `a`. `stalpi` = [[u, lățime], …] în ordine. `prag`: golurile încep
 * de la cota aceasta, nu de la pardoseală (sub ele, zidărie plină).
 */
export function arcada(s, { a, d, m, stalpi, talpa, pardoseala = null, nastere, cheie, tavan, adancime = 0, grosime = 0, prag = null, spate = true }, c) {
  const P = (u, y, v) => [a[0] + d[0] * u + m[0] * v, y, a[1] + d[1] * u + m[1] * v];
  const afaraV = [-m[0], 0, -m[1]], inV = [m[0], 0, m[1]], lungU = [d[0], 0, d[1]], invU = [-d[0], 0, -d[1]];
  const galerie = adancime > 0;
  const jos = pardoseala ?? talpa;
  const adStalp = (w) => (galerie ? w : grosime);
  const uStart = stalpi[0][0] - stalpi[0][1] / 2, uCapat = stalpi[stalpi.length - 1][0] + stalpi[stalpi.length - 1][1] / 2;

  // stâlpii: fața, spatele (spre galerie), laturile; și zidăria de deasupra lor
  for (const [u, w] of stalpi) {
    const u0 = u - w / 2, u1 = u + w / 2, t = adStalp(w);
    s.quad(P(u0, jos, 0), P(u1, jos, 0), P(u1, tavan, 0), P(u0, tavan, 0), c.stalp, afaraV);
    if (spate) s.cuOcluzie(galerie ? 0.5 : 1, () => s.quad(P(u0, jos, t), P(u1, jos, t), P(u1, tavan, t), P(u0, tavan, t), c.stalp, inV));
    s.cuOcluzie(0.6, () => {
      s.quad(P(u0, jos, 0), P(u0, jos, t), P(u0, nastere, t), P(u0, nastere, 0), c.stalp, invU);
      s.quad(P(u1, jos, 0), P(u1, jos, t), P(u1, nastere, t), P(u1, nastere, 0), c.stalp, lungU);
    });
  }

  // golurile dintre stâlpi: arcul, intradosul și zidăria de deasupra
  for (let k = 0; k + 1 < stalpi.length; k++) {
    const [ua, wa] = stalpi[k], [ub, wb] = stalpi[k + 1];
    const uL = ua + wa / 2, uR = ub - wb / 2;
    if (uR - uL < 0.2) continue;
    const t = Math.min(adStalp(wa), adStalp(wb));
    const arc = puncteArc(uL, uR, nastere, cheie);
    const uc = (uL + uR) / 2;
    for (let j = 0; j + 1 < arc.length; j++) {
      const [p0, y0] = arc[j], [p1, y1] = arc[j + 1];
      s.quad(P(p0, y0, 0), P(p1, y1, 0), P(p1, tavan, 0), P(p0, tavan, 0), c.perete, afaraV);
      if (spate) s.cuOcluzie(galerie ? 0.5 : 1, () => s.quad(P(p0, y0, t), P(p1, y1, t), P(p1, tavan, t), P(p0, tavan, t), c.perete, inV));
      const mu = uc - (p0 + p1) / 2, my = nastere - (y0 + y1) / 2;
      s.cuOcluzie(0.55, () => s.quad(P(p0, y0, 0), P(p1, y1, 0), P(p1, y1, t), P(p0, y0, t), c.perete, [d[0] * mu, my, d[1] * mu]));
    }
    // sub prag, zidărie plină: fața, pervazul (sus) și spatele
    if (prag != null && prag > jos + 0.01) {
      s.quad(P(uL, jos, 0), P(uR, jos, 0), P(uR, prag, 0), P(uL, prag, 0), c.perete, afaraV);
      s.cuOcluzie(0.6, () => s.quad(P(uL, prag, 0), P(uR, prag, 0), P(uR, prag, t), P(uL, prag, t), c.stalp, [0, 1, 0]));
    }
  }

  if (!galerie) return;
  // galeria: pardoseala (cu fața ei spre terreiro), tavanul, fundul, capetele
  const tMin = Math.min(...stalpi.map(([, w]) => w));
  if (pardoseala != null) {
    s.quad(P(uStart, talpa, 0), P(uCapat, talpa, 0), P(uCapat, pardoseala, 0), P(uStart, pardoseala, 0), c.stalp, afaraV);
    s.cuOcluzie(0.45, () => s.quad(P(uStart, pardoseala, 0), P(uCapat, pardoseala, 0), P(uCapat, pardoseala, adancime), P(uStart, pardoseala, adancime), c.pardoseala, [0, 1, 0]));
  }
  s.cuOcluzie(0.3, () => s.quad(P(uStart, tavan, tMin), P(uCapat, tavan, tMin), P(uCapat, tavan, adancime), P(uStart, tavan, adancime), c.perete, [0, -1, 0]));
  s.cuOcluzie(0.4, () => s.quad(P(uStart, jos, adancime), P(uCapat, jos, adancime), P(uCapat, tavan, adancime), P(uStart, tavan, adancime), c.perete, afaraV));
  for (const [u, spre] of [[uStart, lungU], [uCapat, invU]]) {
    s.cuOcluzie(0.45, () => s.quad(P(u, talpa, 0), P(u, talpa, adancime), P(u, tavan, adancime), P(u, tavan, 0), c.perete, spre));
    s.quad(P(u, talpa, 0), P(u, talpa, adancime), P(u, tavan, adancime), P(u, tavan, 0), c.perete, [-spre[0], 0, -spre[2]]);
  }
}

/** O prismă dreaptă, de la y0 la y1, pe un poligon convex (x, z); capac sus. */
export function prisma(s, contur, y0, y1, rgb, capac = rgb) {
  corp(s, contur, y0, [[0, 0, y1]], rgb, capac);
}

/** Un zid de-a lungul unei linii frânte (x, z), cu grosime, între talpă și sus. */
export function zid(s, linie, talpa, sus, grosime, rgb) {
  const g = grosime / 2;
  for (let k = 0; k + 1 < linie.length; k++) {
    const [p, q] = [linie[k], linie[k + 1]];
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
    if (L < 1e-3) continue;
    const ux = dx / L, uz = dz / L, nx = -uz * g, nz = ux * g;
    // un pic peste capete, ca îmbinările să nu lase fante
    const px = p[0] - ux * g, pz = p[1] - uz * g, qx = q[0] + ux * g, qz = q[1] + uz * g;
    prisma(s, [[px + nx, pz + nz], [qx + nx, qz + nz], [qx - nx, qz - nz], [px - nx, pz - nz]], talpa, typeof sus === 'number' ? sus : sus[k], rgb);
  }
}

/**
 * O cupolă din profilul ei măsurat, rotit în jurul axei: `profil` e [r, y] de la
 * margine spre vârf, `laturi` numărul de fațete pe cerc (6 la Casa da Água, care e
 * hexagonală).
 */
export function cupola(s, centru, profil, laturi, rotatie, rgb) {
  const inel = (r, y) => Array.from({ length: laturi }, (_, k) => {
    const a = rotatie + (2 * Math.PI * k) / laturi;
    return [centru[0] + r * Math.cos(a), y, centru[1] + r * Math.sin(a)];
  });
  for (let m = 0; m + 1 < profil.length; m++) {
    const [r0, y0] = profil[m], [r1, y1] = profil[m + 1];
    const A = inel(r0, y0), B = inel(r1, y1);
    for (let k = 0; k < laturi; k++) {
      const k2 = (k + 1) % laturi;
      const mid = [(A[k][0] + A[k2][0]) / 2 - centru[0], 0, (A[k][2] + A[k2][2]) / 2 - centru[1]];
      const spre = [mid[0], Math.max(0.2, (r0 - r1) / Math.max(1e-6, y1 - y0)), mid[2]];
      if (r1 < 1e-6) s.tri(A[k], A[k2], B[0], rgb, spre);
      else s.quad(A[k], A[k2], B[k2], B[k], rgb, spre);
    }
  }
}

/** O piramidă pe o bază pătrată (x, z) de la y0, cu vârful la y1. */
export function piramida(s, contur, y0, y1, rgb) {
  const cx = contur.reduce((a, p) => a + p[0], 0) / contur.length, cz = contur.reduce((a, p) => a + p[1], 0) / contur.length;
  const v = [cx, y1, cz];
  for (let k = 0; k < contur.length; k++) {
    const p = contur[k], q = contur[(k + 1) % contur.length];
    const spre = [(p[0] + q[0]) / 2 - cx, 0.3, (p[1] + q[1]) / 2 - cz];
    s.tri([p[0], y0, p[1]], [q[0], y0, q[1]], v, rgb, spre);
  }
}

/**
 * O placă verticală de-a lungul liniei a→b, cu marginea de sus după un profil
 * [t, y] (t de la 0 la 1 pe a→b), groasă spre `interior`. Pentru frontonul
 * fațadei: silueta măsurată pe MDS, nu un triunghi ghicit.
 */
export function placaVerticala(s, a, b, interior, profil, talpa, rgb, rgbSus = rgb) {
  // grosimea: distanța de la linia a→b la punctul interior, pe normală
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  let nx = -dz / L, nz = dx / L;
  let g = (interior[0] - a[0]) * nx + (interior[1] - a[1]) * nz;
  if (g < 0) { nx = -nx; nz = -nz; g = -g; }
  const fata = (t, y) => [a[0] + dx * t, y, a[1] + dz * t];
  const spate = (t, y) => [a[0] + dx * t + nx * g, y, a[1] + dz * t + nz * g];
  const inAfara = [-nx, 0, -nz], inauntru = [nx, 0, nz];
  for (let k = 0; k + 1 < profil.length; k++) {
    const [t0, y0] = profil[k], [t1, y1] = profil[k + 1];
    s.quad(fata(t0, talpa), fata(t1, talpa), fata(t1, y1), fata(t0, y0), rgb, inAfara);
    s.quad(spate(t0, talpa), spate(t1, talpa), spate(t1, y1), spate(t0, y0), rgb, inauntru);
    s.quad(fata(t0, y0), fata(t1, y1), spate(t1, y1), spate(t0, y0), rgbSus, [0, 1, 0]);
  }
  const [tA, yA] = profil[0], [tB, yB] = profil[profil.length - 1];
  s.quad(fata(tA, talpa), spate(tA, talpa), spate(tA, yA), fata(tA, yA), rgb, [-dx, 0, -dz]);
  s.quad(fata(tB, talpa), spate(tB, talpa), spate(tB, yB), fata(tB, yB), rgb, [dx, 0, dz]);
}

/** Poligonul (x, z) micșorat spre centroid cu `d` metri (convex, aproximativ). */
export function micsorat(contur, d) {
  const cx = contur.reduce((a, p) => a + p[0], 0) / contur.length, cz = contur.reduce((a, p) => a + p[1], 0) / contur.length;
  return contur.map(([x, z]) => { const r = Math.hypot(x - cx, z - cz) || 1; const k = Math.max(0, (r - d) / r); return [cx + (x - cx) * k, cz + (z - cz) * k]; });
}

/**
 * Un turn-clopotniță: corpul până la cornișă, cornișa ieșită în afară, parapetul
 * plin până la platformă, patru pinaclii la colțuri și flișa piramidală până la
 * vârful măsurat. Registrul de sus (`registru` → cornișă) e în cantaria.
 */
export function turn(s, contur, talpa, { registru, cornisa, platforma, varf, goluri = [], adancimeGol = 0.6 }, c) {
  corp(s, contur, talpa, [[0, 0, registru]], c.var, c.var);
  if (!goluri.length) corp(s, contur, registru, [[0, 0, cornisa]], c.cantaria, c.cantaria);
  else {
    // Golurile clopotelor: miezul registrului de sus, cu laturile care au gol retrase
    // cu adâncimea golului (+5 cm, ca fundul golului să nu se bată cu fața miezului),
    // și pe fiecare asemenea latură o coajă — două ancadramente, arcul, pervazul.
    const T = adancimeGol, n = contur.length, sens = sensul(contur);
    corp(s, retrage(contur, contur.map((_, k) => (goluri.some((g) => g.latura === k) ? T + 0.05 : 0))), registru, [[0, 0, cornisa]], c.cantaria, c.cantaria);
    const facute = new Set();
    for (const g of goluri) {
      const k = g.latura, p = contur[k], q = contur[(k + 1) % n];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), d = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
      const o = afara(p, q, sens), m = [-o[0], -o[2]];
      // colțul comun cu o coajă deja scrisă îi aparține aceleia
      const u0 = facute.has((k + n - 1) % n) ? T : 0, u1 = facute.has((k + 1) % n) ? L - T : L;
      facute.add(k);
      const [gA, gB] = g.u, nastere = g.cheie - (gB - gA) / 2;
      arcada(s, { a: p, d, m, stalpi: [[(u0 + gA) / 2, gA - u0], [(gB + u1) / 2, u1 - gB]], talpa: registru,
        nastere, cheie: g.cheie, tavan: cornisa, grosime: T, prag: g.prag, spate: false },
      { stalp: c.cantaria, perete: c.cantaria, pardoseala: c.cantaria });
      const P = (u, y) => [p[0] + d[0] * u + m[0] * T, y, p[1] + d[1] * u + m[1] * T];
      const fund = [[gA, g.prag], [gB, g.prag], ...puncteArc(gA, gB, nastere, g.cheie).reverse()];
      s.cuOcluzie(0.25, () => s.poligon(fund.map(([u, y]) => P(u, y)), c.cantaria, [-m[0], 0, -m[1]]));
    }
  }
  const iesit = micsorat(contur, -0.25);
  corp(s, iesit, cornisa, [[0, 0, cornisa + 0.3]], c.cantaria, c.cantaria);
  corp(s, micsorat(contur, 0.1), cornisa + 0.3, [[0, 0, platforma]], c.cantaria, c.cantaria);
  // pinaclii: piramide mici pe colțuri, puțin spre interior
  const cx = contur.reduce((a, p) => a + p[0], 0) / 4, cz = contur.reduce((a, p) => a + p[1], 0) / 4;
  for (const [x, z] of micsorat(contur, 0.45)) {
    const pin = [[x - 0.22, z - 0.22], [x + 0.22, z - 0.22], [x + 0.22, z + 0.22], [x - 0.22, z + 0.22]];
    piramida(s, pin, platforma, platforma + 1.2, c.cantaria);
  }
  // flișa: bază pătrată de ~1,8 m, orientată ca turnul
  const f = contur.map(([x, z]) => { const r = Math.hypot(x - cx, z - cz); const k = 1.27 / r; return [cx + (x - cx) * k, cz + (z - cz) * k]; });
  corp(s, f, platforma - 0.2, [[0, 0, platforma + 0.3]], c.cantaria, c.cantaria);
  piramida(s, f, platforma + 0.3, varf, c.cantaria);
}
