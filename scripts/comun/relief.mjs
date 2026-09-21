import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const IESIRE = 'public/data';

/**
 * Deschide o hartă produsă de scripturi (public/data/<nume>-dem.bin + .json) și
 * dă acces la ea în coordonate TM06.
 *
 * Valoarea (r, c) stă într-un NOD, nu într-o celulă — la fel ca în
 * src/scene/terrain.js. Unde cade nodul față de `bbox_tm06` depinde însă de
 * scriptul care a scris harta, iar cele două scriu altfel:
 *
 *   build-zona.mjs      bbox = dreptunghiul de DECUPARE, muchii de celulă.
 *                       Primul nod e la xMin + pas/2, în centrul primei celule.
 *                       Semn: xMax − xMin === lățime · pas.
 *
 *   build-petic.mjs     bbox = {X0, X1}, adică poziții de NODURI ale bazei,
 *                       fiindcă peticul se aliniază pe nodurile ei.
 *                       Primul nod e chiar la xMin. Semn: === (lățime − 1) · pas.
 *
 * Diferența e o jumătate de celulă. Pe petic, la 1 m, înseamnă 0,5 m — sub
 * zgomotul unui GPS de telefon, dar destul cât să strice o unealtă de măsurat.
 * De aceea convenția se DEDUCE din aritmetică, nu se presupune: cele două
 * valori nu se pot confunda (2328 față de 2326 pe harta_v0, 534 față de 535 pe
 * harta_v1), deci deducția e sigură. Dacă nu se potrivește niciuna, oprim —
 * mai bine o eroare limpede decât coordonate greșite spuse cu convingere.
 */
export function incarcaHarta(nume) {
  const meta = JSON.parse(readFileSync(join(IESIRE, `${nume}-dem.json`), 'utf8'));
  const brut = readFileSync(join(IESIRE, `${nume}-dem.bin`));
  const { latime: w, inaltime: h, pasX_m: pas, bbox_tm06: b } = meta;

  const z = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) z[i] = meta.zMin_m + brut.readUInt16LE(i * 2) * meta.zScara;

  const cam = (a, bb) => Math.abs(a - bb) < 1e-6;
  let jum, conventie;
  if (cam(b.xMax - b.xMin, w * pas) && cam(b.yMax - b.yMin, h * pas)) {
    jum = pas / 2; conventie = 'muchii de celulă';
  } else if (cam(b.xMax - b.xMin, (w - 1) * pas) && cam(b.yMax - b.yMin, (h - 1) * pas)) {
    jum = 0; conventie = 'noduri';
  } else {
    throw new Error(`${nume}: bbox_tm06 de ${b.xMax - b.xMin} × ${b.yMax - b.yMin} m nu se `
      + `potrivește nici cu ${w * pas} × ${h * pas} (muchii), nici cu `
      + `${(w - 1) * pas} × ${(h - 1) * pas} (noduri). Nu ghicesc unde cad nodurile.`);
  }

  const nodX = (c) => b.xMin + c * pas + jum;
  const nodY = (r) => b.yMax - r * pas - jum;
  const colIn = (x) => (x - b.xMin - jum) / pas;
  const randIn = (y) => (b.yMax - jum - y) / pas;

  const inauntru = (x, y) => {
    const c = colIn(x), r = randIn(y);
    return c >= 0 && c <= w - 1 && r >= 0 && r <= h - 1;
  };

  /** Înălțimea interpolată biliniar. `null` în afara hărții. */
  const laTM = (x, y) => {
    if (!inauntru(x, y)) return null;
    const fc = colIn(x), fr = randIn(y);
    const c0 = Math.min(w - 2, Math.floor(fc)), r0 = Math.min(h - 2, Math.floor(fr));
    const tx = fc - c0, ty = fr - r0;
    const g = (r, c) => z[r * w + c];
    const sus = g(r0, c0) + (g(r0, c0 + 1) - g(r0, c0)) * tx;
    const jos = g(r0 + 1, c0) + (g(r0 + 1, c0 + 1) - g(r0 + 1, c0)) * tx;
    return sus + (jos - sus) * ty;
  };

  /**
   * Panta, în aceeași convenție ca terrain.js: 0 orizontal, 1 vertical.
   *
   * Acolo panta vine din normala fațetei, ca `1 - |n.y|`. Pentru un câmp de
   * înălțimi cu gradienții (gx, gy), normala e (-gx, 1, -gy) normalizată, deci
   * n.y = 1/√(1+gx²+gy²). Formula de mai jos e exact aceea — nu o aproximare —
   * ca valorile de aici să poată intra direct în culoareTeren().
   */
  const pantaLa = (x, y) => {
    const d = pas;
    const e = laTM(x + d, y), v = laTM(x - d, y);
    const n = laTM(x, y + d), s = laTM(x, y - d);
    if (e === null || v === null || n === null || s === null) return null;
    const gx = (e - v) / (2 * d), gy = (n - s) / (2 * d);
    return 1 - 1 / Math.sqrt(1 + gx * gx + gy * gy);
  };

  return {
    nume, meta, w, h, pas, bbox: b, z, conventie,
    nodX, nodY, inauntru, laTM, pantaLa,
    centru: { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 },
    /** Apa e coborâtă artificial la zMin_m de scripturile de construcție. */
    esteApa: (x, y) => { const v = laTM(x, y); return v !== null && v <= meta.zMin_m + 0.01; },
  };
}
