import { deflateSync } from 'node:zlib';

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

/** Acelaşi PNG, ca URI de date, pentru încorporat într-o pagină. */
export const pngDataUri = (w, h, rgb) => `data:image/png;base64,${scriePng(w, h, rgb).toString('base64')}`;
