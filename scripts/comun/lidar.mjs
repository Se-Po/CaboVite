// O fereastră TM06 din dalele LiDAR de 50 cm ale DGT (MDS sau MDT), lipită din
// câte dale cere.
//
// Dala CCCRRR acoperă x ∈ [(CCC − 200)·1000, +1000] și y ∈ [(RRR − 300)·1000 − 1000,
// (RRR − 300)·1000]: colțul din antet e marginea de NORD (măsurat pe
// MDS-50cm-105162: x0 −95000, y0 −138000). Pixelul (c, r) al ferestrei are
// centrul la (x0 + (c + ½)·pas, y1 − (r + ½)·pas); cu fereastra pe metri întregi
// sau pe jumătăți de metru, cade exact pe centrele pixelilor dalelor.
//
// nmds-sanctuar.mjs își are copia lui, cu probele de sosire ale celor șase dale;
// asta e varianta pentru ferestre oarecare. Nu reface probele: o dală care n-a
// trecut pe acolo se citește tot, dar colțul și pasul din antet se verifică.

import { existsSync, readdirSync } from 'node:fs';
import { citesteTiffDGT } from './tiff.mjs';

export const DIR_LIDAR = 'date-sursa/lidar-50cm';
export const PAS_LIDAR = 0.5;

/** Indicele de dală (CCC, RRR) care conține punctul TM06. */
export const dalaLa = (x, y) => ({ col: Math.floor(x / 1000) + 200, rand: Math.floor(y / 1000) + 301 });

/** Dalele care acoperă fereastra, ca „CCCRRR”. */
export function daleFereastra(F) {
  const out = [];
  const a = dalaLa(F.x0, F.y0 + 1e-6), b = dalaLa(F.x1 - 1e-6, F.y1 - 1e-6);
  for (let col = a.col; col <= b.col; col++) for (let rand = a.rand; rand <= b.rand; rand++) out.push(`${col}${rand}`);
  return out;
}

/** Fișierul unei dale, sau null dacă nu e pe disc. */
export function fisierDala(tip, ind) {
  if (!existsSync(DIR_LIDAR)) return null;
  const f = readdirSync(DIR_LIDAR).find((n) => n.startsWith(`${tip}-50cm-${ind}-`) && n.endsWith('.tif'));
  return f ? `${DIR_LIDAR}/${f}` : null;
}

/**
 * Citește fereastra F = {x0, x1, y0, y1} (TM06, metri) dintr-un tip de dală.
 * Aruncă, cu lista dalelor lipsă, dacă fereastra nu e acoperită.
 *
 * @param {'MDS'|'MDT'} tip
 * @returns {{W: number, H: number, pas: number, F: object, v: Float32Array}} NoData rămâne −999
 */
export function fereastraLidar(tip, F) {
  const pas = PAS_LIDAR;
  const W = Math.round((F.x1 - F.x0) / pas), H = Math.round((F.y1 - F.y0) / pas);
  if (Math.abs(W * pas - (F.x1 - F.x0)) > 1e-9 || Math.abs(H * pas - (F.y1 - F.y0)) > 1e-9)
    throw new Error(`fereastra ${JSON.stringify(F)} nu cade pe pixelii de ${pas} m`);
  const dale = daleFereastra(F);
  const lipsa = dale.filter((d) => !fisierDala(tip, d));
  if (lipsa.length)
    throw new Error(`lipsesc dalele ${lipsa.map((d) => `${tip}-50cm-${d}`).join(', ')} în ${DIR_LIDAR}/ — `
      + 'se descarcă de pe cdd.dgterritorio.gov.pt (cont gratuit).');
  const v = new Float32Array(W * H).fill(-999);
  for (const ind of dale) {
    const t = citesteTiffDGT(fisierDala(tip, ind));
    const col = +ind.slice(0, 3), rand = +ind.slice(3);
    if (t.x0 !== (col - 200) * 1000 || t.y0 !== (rand - 300) * 1000 || t.rezolutie !== pas)
      throw new Error(`${tip}-50cm-${ind}: colțul (${t.x0}, ${t.y0}) sau pasul ${t.rezolutie} nu sunt cele așteptate`);
    // rândul ferestrei r are y = F.y1 − (r + ½)·pas; în dală, rândul (t.y0 − y)/pas − ½
    for (let r = 0; r < H; r++) {
      const rt = Math.round((t.y0 - (F.y1 - (r + 0.5) * pas)) / pas - 0.5);
      if (rt < 0 || rt >= t.inaltime) continue;
      const rand_ = t.rand(rt);
      for (let c = 0; c < W; c++) {
        const ct = Math.round((F.x0 + (c + 0.5) * pas - t.x0) / pas - 0.5);
        if (ct < 0 || ct >= t.latime) continue;
        v[r * W + c] = rand_[ct];
      }
    }
  }
  return { W, H, pas, F, v };
}
