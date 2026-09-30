// Rastrul sanctuarului (MDS, MDT, NDVI la 50 cm), scris de nmds-sanctuar.mjs, și
// cadrele locale ale clădirilor.
//
// Un cadru e un punct TM06 și un azimut de grilă: u merge de-a lungul azimutului,
// v la 90° spre stânga lui. La biserică u e axa, spre fațadă, iar v spre nord. Fiecare
// clădire are cadrul ei, fiindcă aripile nu sunt paralele: aripa de sud e rotită cu
// 0,85° față de navă, adică 1,7 m pe lungimea ei.

import { readFileSync } from 'node:fs';
import { cereFisier } from './cere.mjs';

const DIR = 'date-sursa/derivate';

export function incarcaRastru() {
  cereFisier(`${DIR}/sanctuar-rastru.json`, 'rastrul sanctuarului', 'Rulează întâi `npm run nmds-sanctuar`.');
  const meta = JSON.parse(readFileSync(`${DIR}/sanctuar-rastru.json`, 'utf8'));
  const { latime: W, inaltime: H, fereastra_tm06: F, pas } = meta;
  const bin = readFileSync(`${DIR}/sanctuar-rastru.bin`);
  const strat = (k) => new Float32Array(bin.buffer.slice(bin.byteOffset + k * W * H * 4, bin.byteOffset + (k + 1) * W * H * 4));
  const mds = strat(0), mdt = strat(1), ndvi = strat(2);
  const esteApa = (v) => v === -999 || v === 0;

  /** Pixelul care conține punctul TM06, sau −1 în afara ferestrei. */
  const indice = (x, y) => {
    const c = Math.floor((x - F.x0) / pas), r = Math.floor((F.y1 - y) / pas);
    return c < 0 || r < 0 || c >= W || r >= H ? -1 : r * W + c;
  };
  /** Centrul pixelului i, în TM06. */
  const centru = (i) => ({ x: F.x0 + ((i % W) + 0.5) * pas, y: F.y1 - (Math.floor(i / W) + 0.5) * pas });
  /** Biliniar pe centrele pixelilor; NaN lângă NoData. */
  const biliniar = (a, x, y) => {
    const fc = (x - F.x0) / pas - 0.5, fr = (F.y1 - y) / pas - 0.5;
    const c = Math.floor(fc), r = Math.floor(fr), s = fc - c, t = fr - r;
    if (c < 0 || r < 0 || c + 1 >= W || r + 1 >= H) return NaN;
    const g = (cc, rr) => a[rr * W + cc];
    const v = [g(c, r), g(c + 1, r), g(c, r + 1), g(c + 1, r + 1)];
    if (v.some((q) => q === -999)) return NaN;
    return v[0] * (1 - s) * (1 - t) + v[1] * s * (1 - t) + v[2] * (1 - s) * t + v[3] * s * t;
  };
  /** Indicii pixelilor cu centrul într-un poligon TM06 ([[x, y], …]). */
  const pixeliIn = (p) => {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - F.x0) / pas)), c1 = Math.min(W - 1, Math.ceil((Math.max(...xs) - F.x0) / pas));
    const r0 = Math.max(0, Math.floor((F.y1 - Math.max(...ys)) / pas)), r1 = Math.min(H - 1, Math.ceil((F.y1 - Math.min(...ys)) / pas));
    const out = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = F.x0 + (c + 0.5) * pas, y = F.y1 - (r + 0.5) * pas;
      if (inPoligon(x, y, p)) out.push(r * W + c);
    }
    return out;
  };
  return { meta, W, H, F, pas, mds, mdt, ndvi, esteApa, indice, centru, biliniar, pixeliIn };
}

/** Regula par-impar pe [[x, y], …]. */
export function inPoligon(x, y, p) {
  let k = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) k = !k;
  return k;
}

/** Cadrul unei clădiri: TM06 ↔ (u, v). */
export function cadru({ origine: [ox, oy], azimut }) {
  const a = (azimut * Math.PI) / 180, ux = Math.sin(a), uy = Math.cos(a), vx = -uy, vy = ux;
  return {
    ox, oy, azimut,
    laXY: (u, v) => [ox + u * ux + v * vx, oy + u * uy + v * vy],
    laUV: (x, y) => [(x - ox) * ux + (y - oy) * uy, (x - ox) * vx + (y - oy) * vy],
    /** Dreptunghiul [u0, u1] × [v0, v1], ca poligon TM06 închis, în sens trigonometric. */
    dreptunghi(u, v) {
      return [[u[0], v[0]], [u[1], v[0]], [u[1], v[1]], [u[0], v[1]], [u[0], v[0]]].map(([p, q]) => this.laXY(p, q));
    },
  };
}
