// Inventarul fotografiilor din date-sursa/poze/.
//
//   npm run citeste-poze
//
// Nu decodează niciun pixel și n-are nicio dependență: citește doar EXIF-ul și
// întreabă hărțile de relief unde cade fiecare poză. Nu decide nimic — spune ce
// există, ca pasul următor (culorile) să pornească de la date, nu de la păreri.
//
// Ideea care face scriptul să merite: GPS-ul unui telefon e bun lateral (~5 m) și
// slab pe verticală (±15 m). Altitudinea din EXIF nu e de încredere. Dar dacă
// știm unde stătea aparatul cu o eroare de câțiva metri, citim înălțimea din
// LiDAR acolo — la 1 m. Harta e un altimetru mai bun decât telefonul. Tot de
// acolo iese și panta. Așa fiecare poză devine o probă etichetată
// (pantă, altitudine), adică exact ce cere culoareTeren() din src/scene/palette.js.

import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { citesteExif } from './comun/exif.mjs';
import { cereDirector, cereFisier } from './comun/cere.mjs';
import { incarcaHarta } from './comun/relief.mjs';
import { laTM06, inPoligon } from './comun/tm06.mjs';

const DIR = 'date-sursa/poze';
// Ondulația geoidului la Cabo Espichel: înălțimea geoidului EGM2008 deasupra
// elipsoidului WGS84. Sursă: GeoidEval (GeographicLib), 38.421 N / 9.2166 W →
// EGM2008 = 52.92 m.
//
// Contează fiindcă Android scrie în EXIF înălțimea deasupra ELIPSOIDULUI, deși
// o etichetează cu GPSAltitudeRef = 0, adică „deasupra nivelului mării". LiDAR-ul
// DGT e ortometric, deci deasupra geoidului. Fără scăderea asta, cele două par
// să difere cu ~58 m și nu se poate spune cât din diferență e eroare de GPS.
const GEOID_M = 52.92;
const HARTA_BAZA = 'harta_v0';
const HARTA_FINA = 'harta_v1';

const grade = (p) => `${(Math.acos(Math.max(-1, Math.min(1, 1 - p))) * 180 / Math.PI).toFixed(0)}°`;

const main = () => {
  cereDirector(DIR, 'fotografiile originale, direct de pe telefon',
           'Copiază-le prin USB: WhatsApp și Google Photos pe web degradează GPS-ul din EXIF.');
  // Listă de ACCEPTĂRI, nu de excluderi.
  //
  // Varianta veche era `!f.endsWith('.json')`, iar `culori-poze` scrie în același
  // director un `culori.html` de câțiva megaocteți. A doua oară când rulai lanțul,
  // pagina de etichetat intra în inventar ca fotografie, iar decodorul murea cu
  // „SOI not found". O excludere trebuie ținută minte de fiecare dată când apare
  // un fișier nou lângă date; o acceptare nu.
  const fisiere = readdirSync(DIR)
    .filter((f) => /\.(jpe?g|heic|heif|png|tiff?|dng)$/i.test(f))
    .sort();
  if (!fisiere.length) {
    console.log(`Nimic în ${DIR}/. Copiază pozele acolo — originalele, direct de pe telefon.`);
    return;
  }

  const baza = incarcaHarta(HARTA_BAZA);
  const fina = incarcaHarta(HARTA_FINA);
  const contur = baza.meta.poligon_geo.map((p) => laTM06(p.lon, p.lat));

  console.log(`${fisiere.length} fișiere în ${DIR}/`);
  console.log(`hărți: ${HARTA_BAZA} (${baza.pas} m) și ${HARTA_FINA} (${fina.pas} m)\n`);

  const cap = ['fișier', 'moment', 'longitudine', 'latitudine', '±m', 'buso', 'unde', 'alt.DEM', 'alt.GPS', 'pantă'];
  const lat = [30, 16, 11, 10, 4, 5, 9, 8, 8, 6];
  const rand = (c) => c.map((v, i) => String(v).padEnd(lat[i])).join(' ');
  console.log(rand(cap));
  console.log(lat.map((n) => '─'.repeat(n)).join(' '));

  const indice = [];
  const stat = { exif: 0, gps: 0, inContur: 0, subPetic: 0, pePamant: 0, cuBusola: 0 };
  const difAlt = [];

  for (const f of fisiere) {
    const e = citesteExif(join(DIR, f));
    if (e.exif) stat.exif++;

    const linie = { fisier: f, format: e.format, octeti: e.octeti };
    for (const k of ['aparat', 'moment', 'fusOrar', 'focala35_mm', 'unghi_grade', 'latimePx', 'inaltimePx', 'iso', 'orientare'])
      if (e[k] !== undefined && e[k] !== null) linie[k] = e[k];

    let unde = '—', altDem = '—', altGps = '—', panta = '—', eroare = '—', buso = '—';

    if (e.gps) {
      stat.gps++;
      const t = laTM06(e.gps.lon, e.gps.lat);
      linie.gps = e.gps;
      linie.tm06 = { x: +t.x.toFixed(2), y: +t.y.toFixed(2) };

      const inContur = inPoligon(t.x, t.y, contur);
      const subPetic = fina.inauntru(t.x, t.y);
      if (inContur) stat.inContur++;
      if (subPetic) stat.subPetic++;
      unde = subPetic ? `${HARTA_FINA}` : inContur ? `${HARTA_BAZA}` : baza.inauntru(t.x, t.y) ? 'în cutie' : 'în afară';

      // Peticul e mai fin, deci acolo unde există el dă altitudinea.
      const h = subPetic ? fina : baza;
      const z = h.laTM(t.x, t.y);
      if (z !== null) {
        const apa = h.esteApa(t.x, t.y);
        linie.relief = {
          harta: h.nume,
          altitudine_m: +z.toFixed(2),
          apa,
          panta: h.pantaLa(t.x, t.y) === null ? null : +h.pantaLa(t.x, t.y).toFixed(4),
        };
        if (!apa) stat.pePamant++;
        altDem = apa ? 'apă' : `${z.toFixed(1)} m`;
        if (linie.relief.panta !== null) panta = grade(linie.relief.panta);
        if (e.gps.alt_gps_m !== null && !apa) difAlt.push(e.gps.alt_gps_m - z);
      }
      if (e.gps.alt_gps_m !== null) altGps = `${e.gps.alt_gps_m.toFixed(1)} m`;
      if (e.gps.eroare_m !== null) eroare = e.gps.eroare_m.toFixed(1);
      if (e.gps.directie_grade !== null) { buso = `${e.gps.directie_grade.toFixed(0)}°`; stat.cuBusola++; }
    }

    console.log(rand([
      f.length > 30 ? f.slice(0, 29) + '…' : f,
      (e.moment ?? '—').replace(/^\d{4}:/, '').replace(':', '-'),
      e.gps ? e.gps.lon.toFixed(6) : '—',
      e.gps ? e.gps.lat.toFixed(6) : '—',
      eroare, buso, unde, altDem, altGps, panta,
    ]));
    indice.push(linie);
  }

  const cale = join(DIR, 'indice.json');
  writeFileSync(cale, JSON.stringify({
    generat: new Date().toISOString(),
    harti: { baza: HARTA_BAZA, fina: HARTA_FINA },
    numar: indice.length,
    poze: indice,
  }, null, 1));

  console.log(`\n── bilanț ──`);
  const p = (n) => `${n}/${fisiere.length}`;
  console.log(` cu EXIF citibil        ${p(stat.exif)}`);
  console.log(` cu poziție GPS         ${p(stat.gps)}`);
  console.log(` cu direcție de busolă  ${p(stat.cuBusola)}`);
  console.log(` în conturul ${HARTA_BAZA}    ${p(stat.inContur)}`);
  console.log(` peste peticul ${HARTA_FINA}  ${p(stat.subPetic)}`);
  console.log(` pe uscat, după LiDAR   ${p(stat.pePamant)}`);

  if (difAlt.length) {
    difAlt.sort((a, b) => a - b);
    const mediana = difAlt[difAlt.length >> 1];
    const rest = difAlt.map((v) => v - GEOID_M);
    const restMediana = rest[rest.length >> 1];
    console.log(`\n── altitudinea din EXIF față de LiDAR (${difAlt.length} poze de uscat) ──`);
    console.log(` brut:   mediană ${mediana >= 0 ? '+' : ''}${mediana.toFixed(1)} m,`
      + ` între ${difAlt[0].toFixed(1)} și ${difAlt[difAlt.length - 1].toFixed(1)} m`);
    console.log(` geoid:  ${GEOID_M} m — EXIF-ul dă înălțime elipsoidală, LiDAR-ul ortometrică`);
    console.log(` rămâne: mediană ${restMediana >= 0 ? '+' : ''}${restMediana.toFixed(1)} m,`
      + ` între ${rest[0].toFixed(1)} și ${rest[rest.length - 1].toFixed(1)} m`);
    console.log(` Restul e eroarea reală a GPS-ului pe verticală. De aceea altitudinea folosită`);
    console.log(` mai departe e cea din LiDAR, nu cea din EXIF.`);
  }

  const pozitii = new Set(indice.filter((l) => l.gps).map((l) => `${l.gps.lon},${l.gps.lat}`));
  if (pozitii.size < stat.gps)
    console.log(`\nAtenție: ${stat.gps} poze, dar numai ${pozitii.size} poziții GPS distincte —`
      + ` telefonul a refolosit aceeași fixare pentru cadre consecutive.`);

  const focale = [...new Set(indice.map((l) => l.focala35_mm).filter(Boolean))].sort((a, b) => a - b);
  const tele = indice.filter((l) => l.focala35_mm > 50).length;
  if (focale.length > 1) {
    console.log(`\nFocale folosite (echiv. 35 mm): ${focale.join(', ')} mm.`);
    // Prezumția „partea de jos a cadrului e pământul de sub picioare" ține la
    // unghi larg și cade la teleobiectiv, unde tot cadrul e un subiect depărtat.
    if (tele) console.log(` ${tele} poze peste 50 mm: acolo cadrul e un subiect depărtat, deci partea`
      + ` de jos NU e pământul de sub picioare. Contează la extragerea culorilor.`);
  }

  console.log(`\nscris ${cale}`);
};

main();
