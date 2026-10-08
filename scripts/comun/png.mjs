import { deflateSync, inflateSync } from 'node:zlib';

// Scrierea unui PNG, ca să putem arăta imagini fără încă o dependență.
//
// Merită scris de mână: un PNG e zlib plus patru bucăți cu sumă de control, iar
// `node:zlib` e deja în Node. Un decodor JPEG nu s-ar fi putut scrie la fel de
// ieftin — de aceea acolo am luat o bibliotecă, iar aici nu.

const TABEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABEL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const bucata = (tip, date) => {
  const cap = Buffer.alloc(8);
  cap.writeUInt32BE(date.length, 0);
  cap.write(tip, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tip, 'latin1'), date])), 0);
  return Buffer.concat([cap, date, crc]);
};

/**
 * PNG RGB pe 8 biți, fără filtrare (tipul 0 pe fiecare rând).
 *
 * Filtrele PNG ajută compresia pe imagini cu gradienți; pe decupaje mici de
 * fotografie câștigul e neglijabil, iar codul ar crește de trei ori.
 *
 * Exportat deși nimic din afară nu-l cheamă, și anume: `pngDataUri` întoarce
 * numai base64, deci asta e singura cale spre un PNG scris pe disc. O poartă
 * lăsată deschisă, nu un rest.
 *
 * @param {number} w @param {number} h
 * @param {Uint8Array} rgb — w·h·3 octeți
 */
export function scriePng(w, h, rgb) {
  const brut = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    brut[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(brut, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 biți pe canal, culoare adevărată
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bucata('IHDR', ihdr),
    bucata('IDAT', deflateSync(brut, { level: 9 })),
    bucata('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * La fel, dar cu bucata `sRGB`: spune explicit că octeții sunt sRGB, ca un codor
 * de texturi să nu ghicească funcția de transfer.
 */
export function scriePngSrgb(w, h, rgb) {
  const png = scriePng(w, h, rgb);
  const srgb = bucata('sRGB', Buffer.from([0])); // intenția „perceptual"
  // după semnătură (8) și IHDR (8 + 13 + 4)
  return Buffer.concat([png.subarray(0, 33), srgb, png.subarray(33)]);
}

/**
 * PNG RGBA pe 8 biți, fără filtrare: pentru iconițele paginii (`npm run iconite`), care
 * au nevoie de transparență. Alfa nu e premultiplicat, cum cere formatul.
 *
 * @param {number} w @param {number} h
 * @param {Uint8Array} rgba — w·h·4 octeți
 */
export function scriePngRgba(w, h, rgba) {
  const brut = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    brut[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(brut, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 biți pe canal, culoare adevărată cu alfa
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bucata('IHDR', ihdr),
    bucata('IDAT', deflateSync(brut, { level: 9 })),
    bucata('IEND', Buffer.alloc(0)),
  ]);
}

/** Același PNG, ca URI de date, pentru încorporat într-o pagină. */
export const pngDataUri = (w, h, rgb) => `data:image/png;base64,${scriePng(w, h, rgb).toString('base64')}`;

/**
 * Citirea înapoi a unui PNG scris de `scriePng`: RGB pe 8 biți, fără filtrare.
 * Numai atât — orice alt format aruncă, în loc să citească greșit. Îl cere proba
 * texturilor împrejurimilor, care compară cu nivelurile PNG ale texturii bazei.
 *
 * @returns {{w: number, h: number, rgb: Uint8Array}}
 */
export function citestePngRgb(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('nu e PNG');
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p), tip = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n);
    if (tip === 'IHDR') {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4);
      if (d[8] !== 8 || d[9] !== 2 || d[12] !== 0) throw new Error('PNG care nu e RGB pe 8 biți, neîntrețesut');
    } else if (tip === 'IDAT') idat.push(d);
    p += 12 + n;
  }
  const brut = inflateSync(Buffer.concat(idat));
  if (brut.length !== (w * 3 + 1) * h) throw new Error(`PNG: ${brut.length} octeți, aștept ${(w * 3 + 1) * h}`);
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    if (brut[y * (w * 3 + 1)] !== 0) throw new Error('PNG cu filtre: se citesc numai cele scrise de scriePng');
    rgb.set(brut.subarray(y * (w * 3 + 1) + 1, (y + 1) * (w * 3 + 1)), y * w * 3);
  }
  return { w, h, rgb };
}
