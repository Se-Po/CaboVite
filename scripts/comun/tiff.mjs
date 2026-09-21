import { readFileSync } from 'node:fs';

// Mersul prin structura de directoare a unui TIFF (IFD).
//
// Stătea copiat în patru scripturi. E aici fiindcă îl cer două feluri de fișiere
// care n-au nimic de-a face unul cu altul: dalele DGT și blocul EXIF dintr-un
// JPEG. EXIF *este* un TIFF — marcajul APP1 conține un antet TIFF complet — deci
// același cod le citește pe amândouă, pornit de la alt offset.
//
// Trei lucruri pe care dalele DGT nu le cer, dar celelalte fișiere da:
//   - big-endian (0x4D4D) — EXIF. Dalele MDT sunt mereu little-endian.
//   - valori scrise în interiorul intrării, când încap în câmpul ei — EXIF.
//   - BigTIFF — ortofotoul. Vezi mai jos.
//
// BigTIFF (magic 43 în loc de 42) e același format cu toate câmpurile de offset
// lărgite la 8 octeți, fiindcă TIFF-ul clasic nu poate trece de 4 GB. Concret:
// numărul de intrări dintr-un IFD e pe 8 octeți în loc de 2, o intrare are 20 de
// octeți în loc de 12, iar o valoare stă în intrare dacă încape în 8 octeți, nu 4.
// Nu e o variantă exotică — e ce scrie GDAL implicit pentru orice imagine mare.

const MARIMI = {
  1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8,
  16: 8, 17: 8, 18: 8, // LONG8 / SLONG8 / IFD8 — numai în BigTIFF
};

/** Antetul unui fișier TIFF: ordinea octeților, dacă e BigTIFF, unde începe IFD0. */
export function deschideTiff(buf) {
  const marca = buf.readUInt16LE(0);
  if (marca !== 0x4949 && marca !== 0x4d4d) throw new Error('nu e TIFF');
  const le = marca === 0x4949;
  const u16 = (p) => (le ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
  const magic = u16(2);
  if (magic !== 42 && magic !== 43) throw new Error(`TIFF cu magic ${magic}, aștept 42 sau 43`);
  const big = magic === 43;
  if (big && u16(4) !== 8) throw new Error('BigTIFF cu offset-uri de altă mărime decât 8 octeți');
  const off = big
    ? Number(le ? buf.readBigUInt64LE(8) : buf.readBigUInt64BE(8))
    : (le ? buf.readUInt32LE(4) : buf.readUInt32BE(4));
  return { le, big, off };
}

/**
 * Citește un IFD și întoarce accesoare pentru tag-urile lui.
 *
 * `baza` e originea offset-urilor din fișier. La un TIFF e 0; la EXIF e poziția
 * antetului TIFF din interiorul JPEG-ului, fiindcă toate offset-urile din EXIF
 * se măsoară de acolo, nu de la începutul fișierului.
 *
 * `big` comută pe BigTIFF. Implicit e fals, deci toate apelurile existente merg
 * neschimbate.
 */
export function citesteIfd(buf, off, le = true, baza = 0, big = false) {
  const u16 = (p) => (le ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
  const u32 = (p) => (le ? buf.readUInt32LE(p) : buf.readUInt32BE(p));
  const u64 = (p) => Number(le ? buf.readBigUInt64LE(p) : buf.readBigUInt64BE(p));
  const f64 = (p) => (le ? buf.readDoubleLE(p) : buf.readDoubleBE(p));

  const antet = big ? 8 : 2;       // lățimea numărului de intrări
  const pas = big ? 20 : 12;       // lungimea unei intrări
  const camp = big ? 12 : 8;       // unde începe câmpul valoare/offset în intrare
  const incape = big ? 8 : 4;      // câți octeți încap chiar în intrare
  const lung = big ? u64 : u32;    // cum se citește un offset

  const n = big ? u64(off) : u16(off);
  const t = new Map();
  for (let i = 0; i < n; i++) {
    const b = off + antet + i * pas;
    const tip = u16(b + 2), nr = big ? u64(b + 4) : u32(b + 4);
    const octeti = nr * (MARIMI[tip] ?? 1);
    // Sub prag valoarea stă chiar în intrare; peste, intrarea ține un offset.
    // La big-endian un SHORT inline stă în primii doi octeți ai câmpului, adică
    // în jumătatea *înaltă* a întregului — de aici decalajul.
    t.set(u16(b), {
      tip, nr,
      val: octeti <= incape ? u32(b + camp) : lung(b + camp),
      date: octeti <= incape ? b + camp : baza + lung(b + camp),
      inline: octeti <= incape,
    });
  }

  const citesteUnul = (tip, p) => {
    switch (tip) {
      case 1: case 2: case 7: return buf.readUInt8(p);
      case 3: return u16(p);
      case 4: return u32(p);
      case 5: return u32(p) / (u32(p + 4) || 1);
      case 8: return le ? buf.readInt16LE(p) : buf.readInt16BE(p);
      case 9: return le ? buf.readInt32LE(p) : buf.readInt32BE(p);
      case 10: return (le ? buf.readInt32LE(p) : buf.readInt32BE(p)) / ((le ? buf.readInt32LE(p + 4) : buf.readInt32BE(p + 4)) || 1);
      case 11: return le ? buf.readFloatLE(p) : buf.readFloatBE(p);
      case 12: return f64(p);
      case 16: case 18: return u64(p);
      case 17: return Number(le ? buf.readBigInt64LE(p) : buf.readBigInt64BE(p));
      default: return u32(p);
    }
  };

  /** Toate valorile unui tag, ca tablou. `null` dacă tag-ul lipsește. */
  const valori = (tag) => {
    const e = t.get(tag);
    if (!e) return null;
    const m = MARIMI[e.tip] ?? 1;
    const out = [];
    for (let i = 0; i < e.nr; i++) out.push(citesteUnul(e.tip, e.date + i * m));
    return out;
  };

  return {
    etichete: t,
    are: (tag) => t.has(tag),
    /** Prima valoare a unui tag. */
    scalar: (tag) => { const v = valori(tag); return v ? v[0] : undefined; },
    valori,
    /** Șir ASCII, fără octetul de terminare. */
    text: (tag) => {
      const e = t.get(tag);
      if (!e) return null;
      return buf.toString('latin1', e.date, e.date + e.nr).replace(/\0.*$/, '').trim() || null;
    },
    /** Offset-ul IFD-ului următor (la EXIF miniatura, la COG nivelul de piramidă). */
    urmator: lung(off + antet + n * pas),
  };
}

// ----------------------------------------------------------- dalele DGT (MDT)

/**
 * Antetul unei dale MDT de la DGT: TIFF little-endian, necomprimat, cu benzi.
 *
 * Versiunea unificată a celor trei copii din build-zona / build-petic /
 * build-lagosteiros. `stripOcteti` era întors doar de una dintre ele; îl întoarce
 * acum pentru toate, fiindcă nu costă nimic și lipsa lui era o inconsecvență.
 */
export function citesteTiffDGT(cale) {
  const buf = readFileSync(cale);
  if (buf.readUInt16LE(0) !== 0x4949) throw new Error(`${cale}: nu e TIFF little-endian`);
  const d = citesteIfd(buf, buf.readUInt32LE(4));

  const compresie = d.scalar(259) ?? 1;
  // Colecțiile DGT sunt inegal comprimate: unele dale sunt brute, altele nu, iar
  // codecul nu e documentat nicăieri. Nu ghicim — oprim cu un mesaj limpede.
  if (compresie !== 1)
    throw new Error(`${cale}: compresie ${compresie}, aștept necomprimat. Cere din catalog o dală necomprimată (dimensiunea ei = lățime·înălțime·4 + rânduri·6 + 379).`);

  const ps = d.valori(33550), tp = d.valori(33922);
  return {
    buf,
    latime: d.scalar(256), inaltime: d.scalar(257), rezolutie: ps[0],
    x0: tp[3], y0: tp[4], // TiePoint dă colțul stânga-sus; în TM06 Y crește spre nord
    randuriPeStrip: d.scalar(278),
    stripOffsets: d.valori(273), stripOcteti: d.valori(279),
  };
}

/** Un rând de float32 dintr-un TIFF necomprimat cu benzi. */
export function randTiff(t, r) {
  const strip = Math.floor(r / t.randuriPeStrip);
  const start = t.stripOffsets[strip] + (r - strip * t.randuriPeStrip) * t.latime * 4;
  const out = new Float32Array(t.latime);
  for (let i = 0; i < t.latime; i++) out[i] = t.buf.readFloatLE(start + i * 4);
  return out;
}
