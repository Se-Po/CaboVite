import { readFileSync } from 'node:fs';
import { citesteIfd } from './tiff.mjs';

// EXIF-ul dintr-un JPEG, citit cu același mers prin IFD-uri ca dalele DGT.
//
// Structura: după SOI (FF D8) vin segmente `FF <marcaj> <lungime pe 2 octeți>`.
// Segmentul APP1 (FF E1) care începe cu "Exif\0\0" conține un antet TIFF
// complet. De acolo încolo e exact TIFF: IFD0, cu doi pointeri de urmat —
// ExifIFD (0x8769) pentru optică și timp, GPS IFD (0x8825) pentru poziție.
//
// Offset-urile din EXIF se măsoară de la începutul antetului TIFF, nu de la
// începutul fișierului. De aceea `citesteIfd` primește o bază.

const TAG = {
  producator: 0x010f, model: 0x0110, orientare: 0x0112,
  exifIfd: 0x8769, gpsIfd: 0x8825,
  // ExifIFD
  moment: 0x9003, fusOrar: 0x9011, expunere: 0x829a, diafragma: 0x829d,
  iso: 0x8827, focala: 0x920a, focala35: 0xa405,
  latimePx: 0xa002, inaltimePx: 0xa003, obiectiv: 0xa434,
  // GPS IFD
  latRef: 0x0001, lat: 0x0002, lonRef: 0x0003, lon: 0x0004,
  altRef: 0x0005, alt: 0x0006, oraGps: 0x0007, dop: 0x000b,
  // Atentie la perechea asta: 0x0010 e REFERINTA (ASCII "M" sau "T"), 0x0011 e
  // unghiul. Inversate, litera "M" citita ca numar da 77 la fiecare poza --
  // exact genul de valoare constanta care pare masuratoare si nu e.
  directieRef: 0x0010, directie: 0x0011, datum: 0x0012,
  eroareGps: 0x001f, dataGps: 0x001d,
};

/** Ce fel de fișier e, după octeții de la început — nu după extensie. */
export function formatImagine(buf) {
  if (buf.length < 12) return 'necunoscut';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'JPEG';
  if (buf.toString('latin1', 4, 8) === 'ftyp') {
    const marca = buf.toString('latin1', 8, 12);
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(marca)) return 'HEIC';
    if (/^avif/.test(marca)) return 'AVIF';
    return `ISO-BMFF (${marca})`;
  }
  if (buf.toString('latin1', 1, 4) === 'PNG') return 'PNG';
  if (buf.readUInt16LE(0) === 0x4949 || buf.readUInt16LE(0) === 0x4d4d) return 'TIFF/DNG';
  return 'necunoscut';
}

/** Găsește antetul TIFF din segmentul APP1. Întoarce offsetul lui sau -1. */
function gasesteExif(buf) {
  let p = 2;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) break;
    const marcaj = buf[p + 1];
    if (marcaj === 0xd8 || (marcaj >= 0xd0 && marcaj <= 0xd9)) { p += 2; continue; }
    if (marcaj === 0xda) break; // începe imaginea propriu-zisă
    const lung = buf.readUInt16BE(p + 2);
    // Un Pixel scrie mai multe APP1: EXIF, apoi XMP. Îl vrem pe primul.
    if (marcaj === 0xe1 && buf.toString('latin1', p + 4, p + 10) === 'Exif\0\0') return p + 10;
    p += 2 + lung;
  }
  return -1;
}

/** Grade-minute-secunde + referință (N/S/E/W) → grade zecimale cu semn. */
function gms(v, ref) {
  if (!v || v.length < 3) return null;
  const g = v[0] + v[1] / 60 + v[2] / 3600;
  return ref === 'S' || ref === 'W' ? -g : g;
}

/**
 * Citește EXIF-ul unui fișier. Nu decodează pixeli — nu-i trebuie niciun decodor.
 *
 * Întoarce întotdeauna un obiect, chiar și pentru un fișier fără EXIF: câmpul
 * `format` spune ce e, iar `gps` e `null` dacă lipsește. Un script care
 * inventariază nu trebuie să se oprească la primul fișier ciudat.
 */
export function citesteExif(cale) {
  const buf = readFileSync(cale);
  const format = formatImagine(buf);
  const rezultat = { cale, format, octeti: buf.length, exif: false, gps: null };
  if (format !== 'JPEG') return rezultat;

  const baza = gasesteExif(buf);
  if (baza < 0) return rezultat;

  const marca = buf.readUInt16LE(baza);
  if (marca !== 0x4949 && marca !== 0x4d4d) return rezultat;
  const le = marca === 0x4949;
  const ifd0 = citesteIfd(buf, baza + (le ? buf.readUInt32LE(baza + 4) : buf.readUInt32BE(baza + 4)), le, baza);
  rezultat.exif = true;

  rezultat.aparat = [ifd0.text(TAG.producator), ifd0.text(TAG.model)].filter(Boolean).join(' ') || null;
  rezultat.orientare = ifd0.scalar(TAG.orientare) ?? 1;

  const pExif = ifd0.scalar(TAG.exifIfd);
  if (pExif) {
    const d = citesteIfd(buf, baza + pExif, le, baza);
    rezultat.moment = d.text(TAG.moment);
    rezultat.fusOrar = d.text(TAG.fusOrar);
    rezultat.obiectiv = d.text(TAG.obiectiv);
    rezultat.focala_mm = d.scalar(TAG.focala) ?? null;
    rezultat.focala35_mm = d.scalar(TAG.focala35) ?? null;
    rezultat.latimePx = d.scalar(TAG.latimePx) ?? null;
    rezultat.inaltimePx = d.scalar(TAG.inaltimePx) ?? null;
    rezultat.iso = d.scalar(TAG.iso) ?? null;
    rezultat.expunere_s = d.scalar(TAG.expunere) ?? null;
    // Unghiul de cuprindere pe orizontală, din echivalentul 35 mm (cadru 36 mm).
    if (rezultat.focala35_mm)
      rezultat.unghi_grade = +(2 * Math.atan(36 / (2 * rezultat.focala35_mm)) * 180 / Math.PI).toFixed(1);
  }

  const pGps = ifd0.scalar(TAG.gpsIfd);
  if (pGps) {
    const d = citesteIfd(buf, baza + pGps, le, baza);
    const lat = gms(d.valori(TAG.lat), d.text(TAG.latRef));
    const lon = gms(d.valori(TAG.lon), d.text(TAG.lonRef));
    if (lat !== null && lon !== null) {
      const alt = d.scalar(TAG.alt);
      rezultat.gps = {
        lon: +lon.toFixed(7), lat: +lat.toFixed(7),
        // AltitudeRef 1 înseamnă sub nivelul mării.
        alt_gps_m: alt === undefined ? null : +(d.scalar(TAG.altRef) === 1 ? -alt : alt).toFixed(1),
        // Android scrie eroarea orizontală estimată. Când există, e mai onestă
        // decât orice presupunere a noastră despre precizia GPS-ului.
        eroare_m: d.are(TAG.eroareGps) ? +d.scalar(TAG.eroareGps).toFixed(1) : null,
        dop: d.are(TAG.dop) ? +d.scalar(TAG.dop).toFixed(2) : null,
        directie_grade: d.are(TAG.directie) ? +d.scalar(TAG.directie).toFixed(1) : null,
        directie_fata_de: d.text(TAG.directieRef) === 'M' ? 'nord magnetic' : d.text(TAG.directieRef) === 'T' ? 'nord geografic' : null,
        data: d.text(TAG.dataGps),
        ora_utc: (() => { const t = d.valori(TAG.oraGps); return t && t.length === 3
          ? t.map((v, i) => String(Math.round(i === 2 ? v : v)).padStart(2, "0")).join(":") : null; })(),
        datum: d.text(TAG.datum),
      };
    }
  }
  return rezultat;
}
