// Acoperișurile fantomă ale ortofotoului și retușul lor (orto_v2).
//
// Ortofotoul DGT nu e true-ortho: avionul a văzut clădirile oblic, deci un punct aflat la h metri
// deasupra solului apare în fotografie mutat cu h × înclinare, spre direcția din zbor.json
// (`acoperisuri`: 0,0951 m/m spre 296,6° sub 9 m, 0,0852 m/m spre 284° peste). Coloana dintre sol și
// acoperiș acoperă în fotografie tot segmentul de la amprentă până la acoperișul mutat. Pagina
// desenează clădirea pe amprenta ei adevărată (LiDAR), deci pe solul din jur, în direcția aceea,
// textura arată perete și acoperiș: „fantoma”. Cel mai mult la colțul de NV al turnului de nord,
// ~1,3 m (docs/satelit.md).
//
// Masca: fiecare pixel nMDS de 50 cm cu centrul într-o amprentă a modelului (corpuri, turnuri,
// cupole din sanctuar_vN) își trage segmentul [0, h] × înclinare peste texelii cadrului; masca e ce
// acoperă segmentele în afara amprentelor, lărgit cu un texel (marginea JPEG a acoperișului).
// Retușul: difuzie din solul din jur — texelii din afara măștii și din afara amprentelor —, cu
// amprentele ca pereți (nu dau nimic), un număr fix de treceri Gauss–Seidel în ordine fixă, deci
// același rezultat la octet.

import { laOklab } from './oklab.mjs';
import { laOctet } from './textura.mjs';

/** Amprentele clădirilor modelului, în TM06: corpuri, turnuri, cupole. */
export function amprente(sanctuar) {
  const A = sanctuar.ancora_tm06;
  const tm = (c) => c.map(([x, z]) => [x + A.x, A.y - z]);
  return [...sanctuar.corpuri, ...sanctuar.turnuri, ...sanctuar.cupole].map((e) => ({ cheie: e.cheie, poligon: tm(e.contur) }));
}

const inPoligon = (x, y, p) => {
  let in_ = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) in_ = !in_;
  }
  return in_;
};

/** Texelii cadrului `c` ({x0, y1, pas, W, H}) cu centrul într-unul din poligoane. */
export function rasterizeaza(poligoane, c) {
  const m = new Uint8Array(c.W * c.H);
  for (const p of poligoane) {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    const q0 = Math.max(0, Math.floor((Math.min(...xs) - c.x0) / c.pas)), q1 = Math.min(c.W - 1, Math.floor((Math.max(...xs) - c.x0) / c.pas));
    const r0 = Math.max(0, Math.floor((c.y1 - Math.max(...ys)) / c.pas)), r1 = Math.min(c.H - 1, Math.floor((c.y1 - Math.min(...ys)) / c.pas));
    for (let r = r0; r <= r1; r++) for (let q = q0; q <= q1; q++)
      if (inPoligon(c.x0 + (q + 0.5) * c.pas, c.y1 - (r + 0.5) * c.pas, p)) m[r * c.W + q] = 1;
  }
  return m;
}

/** Înclinarea fotografiei la înălțimea h: vectorul TM06 (m pe m de înălțime), din zbor.json. */
export function inclinare(zbor, h) {
  const a = zbor.acoperisuri;
  const z = h > 9 ? a['nMDS peste 9 m'] : a['nMDS 2–9 m'];
  const t = (z.directie_grila * Math.PI) / 180;
  return [z.inclinare_m_pe_m * Math.sin(t), z.inclinare_m_pe_m * Math.cos(t)];
}

/**
 * Masca fantomelor pe cadrul `c`. `rastru` e rastrul sanctuarului (incarcaRastru: mds, mdt, F, pas,
 * W, H); `poligoane`, amprentele în TM06. `semn` = −1 întoarce înclinarea (controlul probei).
 * Întoarce masca (1 = fantomă), amprentele rasterizate și câteva numere.
 */
export function mascaFantome({ rastru, poligoane, zbor, c, semn = 1, largire = 1 }) {
  const amp = rasterizeaza(poligoane, c);
  const acoperit = new Uint8Array(c.W * c.H);
  const R = rastru;
  let coloane = 0, hMax = 0;
  for (const p of poligoane) {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - R.F.x0) / R.pas)), c1 = Math.min(R.W - 1, Math.floor((Math.max(...xs) - R.F.x0) / R.pas));
    const r0 = Math.max(0, Math.floor((R.F.y1 - Math.max(...ys)) / R.pas)), r1 = Math.min(R.H - 1, Math.floor((R.F.y1 - Math.min(...ys)) / R.pas));
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      const x = R.F.x0 + (cc + 0.5) * R.pas, y = R.F.y1 - (rr + 0.5) * R.pas;
      if (!inPoligon(x, y, p)) continue;
      const i = rr * R.W + cc;
      const s = R.mds[i], t = R.mdt[i];
      if (s === -999 || t === -999) continue;
      const h = s - t;
      if (!(h > 0)) continue;
      coloane++; hMax = Math.max(hMax, h);
      const [kx, ky] = inclinare(zbor, h);
      const dx = semn * kx * h, dy = semn * ky * h;
      // pixelul de 50 cm, ca 2 × 2 puncte, fiecare cu segmentul lui, la cel mult 5 cm între eșantioane
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.05));
      for (const [ox, oy] of [[-0.125, -0.125], [0.125, -0.125], [-0.125, 0.125], [0.125, 0.125]]) {
        for (let k = 0; k <= n; k++) {
          const px = x + ox + (dx * k) / n, py = y + oy + (dy * k) / n;
          const q = Math.floor((px - c.x0) / c.pas), r = Math.floor((c.y1 - py) / c.pas);
          if (q >= 0 && r >= 0 && q < c.W && r < c.H) acoperit[r * c.W + q] = 1;
        }
      }
    }
  }
  let masca = new Uint8Array(c.W * c.H);
  for (let i = 0; i < masca.length; i++) masca[i] = acoperit[i] && !amp[i] ? 1 : 0;
  for (let l = 0; l < largire; l++) {
    const m2 = masca.slice();
    for (let r = 0; r < c.H; r++) for (let q = 0; q < c.W; q++) {
      const i = r * c.W + q;
      if (masca[i] || amp[i]) continue;
      if ((q > 0 && masca[i - 1]) || (q < c.W - 1 && masca[i + 1]) || (r > 0 && masca[i - c.W]) || (r < c.H - 1 && masca[i + c.W])) m2[i] = 1;
    }
    masca = m2;
  }
  let n = 0;
  for (const v of masca) n += v;
  return { masca, amp, texeli: n, coloane, hMax };
}

/**
 * Cât se depărtează texelii `sel` de solul din jur: media ΔE_OK×100 dintre fiecare texel și media
 * solului din jur — texelii la cel mult `raza` care NU sunt în `exclus` —, în culoarea pe care o
 * desenează pagina (octeții sRGB). Referința de sol se dă explicit, ca toate măsurile de comparat
 * (înainte, după, martorul) s-o aibă pe aceeași: altfel o vecinătate mai curată trece drept retuș.
 */
export function departareDeSol(lin, c, sel, exclus, raza = 4) {
  const { W, H } = c;
  const lab = (i) => laOklab(laOctet(lin[i * 3]), laOctet(lin[i * 3 + 1]), laOctet(lin[i * 3 + 2]));
  let s = 0, n = 0;
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
    const i = r * W + q;
    if (!sel[i]) continue;
    const m = [0, 0, 0];
    let k = 0;
    for (let y = Math.max(0, r - raza); y <= Math.min(H - 1, r + raza); y++) for (let x = Math.max(0, q - raza); x <= Math.min(W - 1, q + raza); x++) {
      const j = y * W + x;
      if (exclus[j]) continue;
      const L = lab(j);
      m[0] += L[0]; m[1] += L[1]; m[2] += L[2]; k++;
    }
    if (!k) continue;
    const L = lab(i);
    s += 100 * Math.hypot(L[0] - m[0] / k, L[1] - m[1] / k, L[2] - m[2] / k);
    n++;
  }
  return { medie: n ? s / n : NaN, n };
}

/** Reuniunea măștilor date (Uint8Array de aceeași lungime). */
export const sau = (...m) => m[0].map((_, i) => (m.some((x) => x[i]) ? 1 : 0));

/** Texelii din `a` care nu sunt în `b`. */
export const fara = (a, b) => a.map((v, i) => (v && !b[i] ? 1 : 0));

/**
 * Difuzia: texelii din mască iau, pe rând, media vecinilor (4-conexi) care nu sunt amprente, în
 * lumină liniară (`lin`, Float32, 3 canale), `treceri` treceri Gauss–Seidel în ordinea rândurilor.
 * Pornesc de la cel mai apropiat texel cunoscut (o trecere în lățime, în ordine fixă). Schimbă
 * `lin` pe loc, numai în mască. Întoarce câți texeli are masca și câți n-au niciun drum spre sol
 * (închiși între amprente): aceia rămân cum erau.
 */
export function difuzie(lin, c, masca, amp, treceri = 300) {
  const { W, H } = c;
  const stare = new Uint8Array(W * H); // 0 cunoscut, 1 necunoscut, 2 perete
  for (let i = 0; i < W * H; i++) stare[i] = amp[i] && !masca[i] ? 2 : masca[i] ? 1 : 0;
  // umplerea inițială: din cunoscuți spre mască, strat cu strat
  let front = [];
  for (let i = 0; i < W * H; i++) if (stare[i] === 1) {
    const q = i % W;
    for (const j of [q > 0 ? i - 1 : -1, q < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && stare[j] === 0) { front.push(i); break; }
  }
  const umplut = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (stare[i] === 0) umplut[i] = 1;
  const inUrm = new Uint8Array(W * H);
  while (front.length) {
    const urm = [];
    const valori = front.map((i) => {
      const q = i % W, s = [0, 0, 0];
      let n = 0;
      for (const j of [q > 0 ? i - 1 : -1, q < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= W * H || !umplut[j] || stare[j] === 2) continue;
        for (let k = 0; k < 3; k++) s[k] += lin[j * 3 + k];
        n++;
      }
      return [i, s.map((v) => v / n)];
    });
    for (const [i, v] of valori) { for (let k = 0; k < 3; k++) lin[i * 3 + k] = v[k]; umplut[i] = 1; }
    for (const [i] of valori) {
      const q = i % W;
      for (const j of [q > 0 ? i - 1 : -1, q < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && stare[j] === 1 && !umplut[j] && !inUrm[j]) { inUrm[j] = 1; urm.push(j); }
    }
    front = urm;
  }
  const ind = [];
  for (let i = 0; i < W * H; i++) if (stare[i] === 1) ind.push(i);
  for (let t = 0; t < treceri; t++) {
    for (const i of ind) {
      const q = i % W, s = [0, 0, 0];
      let n = 0;
      for (const j of [q > 0 ? i - 1 : -1, q < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= W * H || stare[j] === 2) continue;
        for (let k = 0; k < 3; k++) s[k] += lin[j * 3 + k];
        n++;
      }
      if (n) for (let k = 0; k < 3; k++) lin[i * 3 + k] = s[k] / n;
    }
  }
  let fara = 0;
  for (const i of ind) if (!umplut[i]) fara++;
  return { texeli: ind.length, faraDrum: fara };
}
