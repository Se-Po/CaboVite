// GeoTIFF-uri cu dale (COG) citite prin HTTP, pe intervale de octeți, cu tot ce
// vine ținut pe disc.
//
// Copernicus DEM și Sentinel-2 stau pe AWS ca fișiere publice de zeci sau sute de
// MB. Nu ne trebuie decât câteva ferestre din ele, iar un COG e făcut tocmai
// pentru asta: antetul spune unde stă fiecare dală, deci se cer numai octeții
// dalelor care ating fereastra.
//
// Tot ce sosește — antetul și fiecare dală, așa cum vine, comprimată — se scrie în
// `date-sursa/`, care nu intră în depozit. A doua rulare nu mai cere nimic din
// rețea, iar o construcție poate cere explicit să nu descarce (`descarca: false`):
// atunci o dală lipsă e o eroare, nu o descărcare tăcută.
//
// Ce NU se presupune: originea, pasul și felul pixelului se citesc din antet
// (ModelTiepoint, ModelPixelScale, GTRasterTypeGeoKey). Vechiul fetch-dem.mjs le
// scria de mână și rotunjea indicii, deci o eroare de jumătate de pixel — 12–15 m
// pe Copernicus — ar fi trecut neobservată.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { cheiGeo, citesteIfd } from './tiff.mjs';
import { anuleazaPredictor, decodeazaLzw } from './lzw.mjs';

// Numai ASCII: antetele HTTP nu primesc diacritice.
const UA = 'CaboVite/0.1 (pagina despre Cabo Espichel; cereri rare, cu cache pe disc)';

/** Contorul octeților aduși din rețea, pe toată rularea. */
export const descarcat = { octeti: 0, cereri: 0 };

async function cere(url, start, lung) {
  for (let incercare = 0; ; incercare++) {
    let r;
    try {
      r = await fetch(url, { headers: { Range: `bytes=${start}-${start + lung - 1}`, 'User-Agent': UA } });
    } catch (e) {
      if (incercare >= 4) throw new Error(`${url}: ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** incercare));
      continue;
    }
    if (r.status === 206 || (r.status === 200 && start === 0)) {
      const b = Buffer.from(await r.arrayBuffer());
      descarcat.octeti += b.length; descarcat.cereri++;
      // Un 200 la o cerere de interval întoarce tot fișierul: se taie la ce s-a cerut.
      return b.length > lung ? b.subarray(0, lung) : b;
    }
    if ((r.status === 429 || r.status >= 500) && incercare < 4) {
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** incercare));
      continue;
    }
    throw new Error(`${url}: HTTP ${r.status} la octeții ${start}–${start + lung - 1}`);
  }
}

/**
 * Deschide un COG. `dir` e directorul de cache al fișierului.
 *
 * @param {string} url
 * @param {{dir: string, descarca?: boolean}} o
 */
export async function deschideCog(url, { dir, descarca = true }) {
  mkdirSync(dir, { recursive: true });
  const caleAntet = join(dir, 'antet.bin');
  let cap;
  const citesteCap = async (lung) => {
    if (existsSync(caleAntet)) {
      const b = readFileSync(caleAntet);
      if (b.length >= lung) return b;
    }
    if (!descarca) throw new Error(`${url}: antetul nu e în ${dir} — rulează întâi npm run surse-imprejurimi`);
    const b = await cere(url, 0, lung);
    writeFileSync(caleAntet, b);
    return b;
  };

  // Antetul COG stă la început, dar mărimea lui nu se știe dinainte: tabelele de
  // offseturi cresc cu numărul de dale. Se cere tot mai mult până încape.
  let niveluri = null;
  for (const lung of [65536, 262144, 1048576, 4194304, 8388608]) {
    cap = await citesteCap(lung);
    try {
      niveluri = citesteNiveluri(cap);
      break;
    } catch (e) {
      if (!(e instanceof RangeError) && !/out of range|outside/i.test(e.message)) throw e;
    }
  }
  if (!niveluri) throw new Error(`${url}: antetul nu încape în 8 MB`);

  const n0 = niveluri[0];
  const ps = n0.d.valori(33550), tp = n0.d.valori(33922);
  if (!ps || !tp) throw new Error(`${url}: lipsesc ModelPixelScale sau ModelTiepoint`);
  const geo = cheiGeo(n0.d);
  const tipRaster = geo.get(1025) ?? 1;   // 1 = PixelIsArea, 2 = PixelIsPoint
  // Colțul din ModelTiepoint e muchia pixelului (0, 0) la PixelIsArea și CENTRUL
  // lui la PixelIsPoint. De aici, centrul pixelului (c, r) al nivelului 0:
  const jum = tipRaster === 2 ? 0 : 0.5;
  const sx = ps[0], sy = ps[1];
  const x0 = tp[3] - tp[0] * sx, y0 = tp[4] + tp[1] * sy;

  const dale = new Map();
  /** Octeții decodați ai dalei `idx` de la nivelul `k`, ca DataView. */
  async function dala(k, idx) {
    const cheie = `${k}:${idx}`;
    if (dale.has(cheie)) return dale.get(cheie);
    const n = niveluri[k];
    const off = n.offsets[idx], lung = n.octetiDale[idx];
    let v = null;
    if (lung) {
      const cale = join(dir, `n${k}-d${idx}.bin`);
      let brut;
      if (existsSync(cale)) brut = readFileSync(cale);
      else {
        if (!descarca) throw new Error(`${url}: dala ${idx} a nivelului ${k} nu e în ${dir} — rulează întâi npm run surse-imprejurimi`);
        brut = await cere(url, off, lung);
        writeFileSync(cale, brut);
      }
      if (brut.length !== lung) throw new Error(`${cale}: ${brut.length} octeți, aștept ${lung}`);
      const bps = n.biti / 8, plin = n.tw * n.th * bps * n.esantioane;
      let o;
      if (n.compresie === 1) o = new Uint8Array(brut);
      else if (n.compresie === 8 || n.compresie === 32946) o = new Uint8Array(inflateSync(brut));
      else if (n.compresie === 5) o = decodeazaLzw(new Uint8Array(brut), plin);
      else throw new Error(`${url}: compresia ${n.compresie} nu se citește (numai 1, 5, 8)`);
      if (o.length !== plin) throw new Error(`${url}: dala ${idx} are ${o.length} octeți decodați, aștept ${plin}`);
      if (n.esantioane === 1) o = anuleazaPredictor(o, n.tw, bps, n.predictor);
      else if (n.predictor === 2 && bps === 1) {
        // Mai multe benzi pe pixel (RGB „chunky”): diferența e față de ACEEAȘI bandă
        // a pixelului din stânga, deci pasul e numărul de benzi, nu un octet.
        const pr = n.tw * n.esantioane;
        for (let r = 0; r < n.th; r++)
          for (let i = n.esantioane; i < pr; i++) o[r * pr + i] = (o[r * pr + i] + o[r * pr + i - n.esantioane]) & 0xff;
      } else if (n.predictor !== 1) throw new Error(`${url}: predictorul ${n.predictor} pe ${n.esantioane} benzi de ${n.biti} biți nu se citește`);
      v = new DataView(o.buffer, o.byteOffset, o.byteLength);
    }
    dale.set(cheie, v);
    return v;
  }

  // `i` e indicele pixelului în dală, `b` banda (la imaginile „chunky”, benzile unui
  // pixel stau una lângă alta).
  const citeste = (n, v, i, b) => {
    i = i * n.esantioane + b;
    if (n.format === 3) return n.biti === 32 ? v.getFloat32(i * 4, true) : v.getFloat64(i * 8, true);
    if (n.biti === 8) return n.format === 2 ? v.getInt8(i) : v.getUint8(i);
    if (n.biti === 16) return n.format === 2 ? v.getInt16(i * 2, true) : v.getUint16(i * 2, true);
    return n.format === 2 ? v.getInt32(i * 4, true) : v.getUint32(i * 4, true);
  };

  return {
    url, niveluri, tipRaster, nodata: n0.d.text(42113),
    epsg: geo.get(3072) ?? geo.get(2048) ?? null,
    /** Centrul pixelului (c, r) la nivelul 0, în coordonatele fișierului. */
    centru: (c, r) => ({ x: x0 + (c + jum) * sx, y: y0 - (r + jum) * sy }),
    /** Pasul nivelului k, și colțul lui (muchia pixelului 0, 0). */
    geometrie: (k) => {
      const n = niveluri[k], f = n0.w / n.w;
      return { w: n.w, h: n.h, pasX: sx * f, pasY: sy * (n0.h / n.h), x0: x0 + (jum - 0.5) * sx, y0: y0 - (jum - 0.5) * sy };
    },
    /** Câți octeți au dalele care ating fereastra — mărimea lor din antet, deci a fișierelor din cache. */
    octetiFereastra(k, c0, r0, L, H) {
      const n = niveluri[k], nx = Math.ceil(n.w / n.tw);
      let s = 0;
      for (let ty = Math.max(0, Math.floor(r0 / n.th)); ty <= Math.min(Math.ceil(n.h / n.th) - 1, Math.floor((r0 + H - 1) / n.th)); ty++)
        for (let tx = Math.max(0, Math.floor(c0 / n.tw)); tx <= Math.min(nx - 1, Math.floor((c0 + L - 1) / n.tw)); tx++) s += n.octetiDale[ty * nx + tx];
      return s;
    },
    /**
     * Fereastra [c0, c0+L) × [r0, r0+H) a nivelului k, banda b, ca Float64Array.
     * Pixelii din afara rasterului primesc `inAfara`.
     */
    async fereastra(k, c0, r0, L, H, inAfara = NaN, b = 0) {
      const n = niveluri[k];
      if (b >= n.esantioane) throw new Error(`${url}: banda ${b}, fișierul are ${n.esantioane}`);
      const out = new Float64Array(L * H).fill(inAfara);
      const nx = Math.ceil(n.w / n.tw);
      const tx0 = Math.max(0, Math.floor(c0 / n.tw)), tx1 = Math.min(nx - 1, Math.floor((c0 + L - 1) / n.tw));
      const ty0 = Math.max(0, Math.floor(r0 / n.th)), ty1 = Math.min(Math.ceil(n.h / n.th) - 1, Math.floor((r0 + H - 1) / n.th));
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++) {
          const v = await dala(k, ty * nx + tx);
          const px0 = tx * n.tw, py0 = ty * n.th;
          const xa = Math.max(c0, px0), xb = Math.min(c0 + L, px0 + n.tw, n.w);
          const ya = Math.max(r0, py0), yb = Math.min(r0 + H, py0 + n.th, n.h);
          for (let y = ya; y < yb; y++)
            for (let x = xa; x < xb; x++)
              out[(y - r0) * L + (x - c0)] = v ? citeste(n, v, (y - py0) * n.tw + (x - px0), b) : n.nodataNum;
        }
      return out;
    },
  };
}

/** IFD-urile unui COG: nivelul 0 și piramida lui. Aruncă RangeError dacă antetul e prea scurt. */
function citesteNiveluri(cap) {
  if (cap.readUInt16LE(0) !== 0x4949) throw new Error('COG-ul nu e little-endian');
  const magic = cap.readUInt16LE(2);
  if (magic !== 42) throw new Error(`TIFF cu magic ${magic}; aici se citesc numai TIFF-uri clasice`);
  const out = [];
  let off = cap.readUInt32LE(4);
  while (off && out.length < 16) {
    if (off >= cap.length) throw new RangeError('IFD dincolo de antet');
    const d = citesteIfd(cap, off);
    // Măștile (NewSubfileType cu bitul 2) nu sunt niveluri de piramidă.
    if (((d.scalar(254) ?? 0) & 4) === 0) {
      const offsets = d.valori(324), octetiDale = d.valori(325);
      if (!offsets || !octetiDale) throw new Error('COG fără dale (TileOffsets / TileByteCounts)');
      const nod = d.text(42113);
      out.push({
        d, w: d.scalar(256), h: d.scalar(257), tw: d.scalar(322), th: d.scalar(323),
        biti: d.scalar(258), format: d.scalar(339) ?? 1, esantioane: d.scalar(277) ?? 1,
        compresie: d.scalar(259) ?? 1, predictor: d.scalar(317) ?? 1,
        offsets, octetiDale, nodataNum: nod === null ? NaN : Number(nod),
      });
      // Benzile pe planuri separate ar avea dale separate pe bandă; nu e cazul aici.
      if (out.at(-1).esantioane > 1 && (d.scalar(284) ?? 1) !== 1)
        throw new Error(`COG cu ${out.at(-1).esantioane} benzi pe planuri separate; se citesc numai cele „chunky”`);
    }
    off = d.urmator;
  }
  return out;
}
