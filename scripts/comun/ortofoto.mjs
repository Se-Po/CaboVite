// Citirea ortofotoului DGT (ORTOS-2025) și așezarea lui peste o hartă.
//
// A stat numai în scripts/ortofoto.mjs. L-a cerut un al doilea script — stratul
// NDVI al paginii —, deci s-a mutat aici în loc să se copieze.
//
// Fișierul e un COG BigTIFF: piramidă cu niveluri la 0,25 / 0,5 / 1 / 2 / 4 … m,
// dale JPEG de 512 × 512, cinci benzi (R, G, B, infraroșu apropiat, alfa), fiecare
// cu dalele ei (PlanarConfiguration = 2). Colțul e la TM06 (−96000, −135000), iar
// pixelul k al oricărui nivel acoperă [x0 + k·pas, x0 + (k + 1)·pas] — măsurat:
// fiecare nivel e media blocului corespunzător de la 0,25 m, cu corelația maximă
// exact la decalaj zero.

import { openSync, readSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { citesteIfd, deschideTiff } from './tiff.mjs';

/**
 * Pragul de vegetație pe indicele de infraroșu. Ales după histograma datelor,
 * nu din literatură: `npm run ortofoto` tipărește histograma pe care s-a ales.
 */
export const PRAG_NDVI = 0.15;

/** NDVI = (NIR − roșu) / (NIR + roșu). Zero acolo unde amândouă sunt zero. */
export const ndvi = (R, N) => ((N + R) ? (N - R) / (N + R) : 0);

/** Cuantila unui tablou de numere, fără ponderi. */
export function cuantila(v, q) {
  const s = Float64Array.from(v).sort();
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

/** Deschide COG-ul și întoarce nivelul de piramidă cu rezoluția cerută. */
export function deschideOrtofoto(cale, pasDorit) {
  const fd = openSync(cale, 'r');
  const cap = Buffer.alloc(4 * 1024 * 1024);
  readSync(fd, cap, 0, cap.length, 0);
  const { le, big, off } = deschideTiff(cap);

  const niveluri = [];
  let d = citesteIfd(cap, off, le, 0, big), i = 0;
  const pasBaza = d.valori(33550)[0];
  const tp = d.valori(33922);
  const x0 = tp[3], y0 = tp[4];
  const latimeBaza = d.scalar(256);
  while (d && i < 12) {
    niveluri.push({ nivel: i, d, pas: pasBaza * (latimeBaza / d.scalar(256)) });
    if (!d.urmator) break;
    d = citesteIfd(cap, d.urmator, le, 0, big);
    i++;
  }

  const ales = niveluri.find((n) => Math.abs(n.pas - pasDorit) < 1e-6);
  if (!ales)
    throw new Error(`ortofotoul n-are un nivel la ${pasDorit} m; are ${niveluri.map((n) => n.pas.toFixed(2)).join(', ')}`);

  const t = ales.d;
  const tabeleE = t.etichete.get(347);
  const tabele = Buffer.alloc(tabeleE ? tabeleE.nr : 0);
  if (tabeleE) readSync(fd, tabele, 0, tabele.length, tabeleE.date);

  return {
    fd, x0, y0, pas: ales.pas, nivel: ales.nivel, niveluri,
    w: t.scalar(256), h: t.scalar(257),
    tw: t.scalar(322), th: t.scalar(323),
    benzi: t.scalar(277),
    offsets: t.valori(324), octeti: t.valori(325),
    tabele,
  };
}

/**
 * O dală, decodată.
 *
 * Fiecare dală e un flux JPEG *prescurtat*: îi lipsește tabela de cuantizare,
 * care stă o singură dată în tag-ul JPEGTables, ca să nu se repete de 12600 de
 * ori. Se lipește înapoi imediat după marcajul SOI al dalei. Cu
 * PlanarConfiguration = 2 fiecare bandă are dalele ei, deci fiecare flux e o
 * imagine cu un singur canal — fără subeșantionare de crominanță.
 */
export function citesteDala(o, banda, tx, ty) {
  const nx = Math.ceil(o.w / o.tw), ny = Math.ceil(o.h / o.th);
  const idx = banda * nx * ny + ty * nx + tx;
  const n = o.octeti[idx];
  if (!n) return null;
  const brut = Buffer.alloc(n);
  readSync(o.fd, brut, 0, n, o.offsets[idx]);
  const flux = o.tabele.length
    ? Buffer.concat([brut.subarray(0, 2), o.tabele.subarray(2, o.tabele.length - 2), brut.subarray(2)])
    : brut;
  const img = jpeg.decode(flux, { useTArray: true });
  // jpeg-js dă RGBA chiar și pentru o imagine cu un singur canal; luăm primul.
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) out[i] = img.data[i * 4];
  return { date: out, w: img.width, h: img.height };
}

/**
 * Citește o fereastră dreptunghiulară dintr-o bandă, în pixeli ai nivelului.
 *
 * Fereastra trebuie să încapă întreagă în nivel. Nu se taie și nu se umple: un
 * indice de dală ieșit din grilă — tx = −1, de pildă — ar cădea în
 * `banda·nx·ny + ty·nx + tx` pe ULTIMA dală a rândului de deasupra, la 8 km
 * distanță, cu alfa 255. O hartă care trece de marginea dalei ar primi culori
 * din alt loc, fără nicio eroare.
 */
export function fereastra(o, banda, c0, r0, lat, inalt) {
  if (c0 < 0 || r0 < 0 || c0 + lat > o.w || r0 + inalt > o.h)
    throw new Error(`fereastra ${c0}…${c0 + lat - 1} × ${r0}…${r0 + inalt - 1} iese din nivelul de ${o.pas} m `
      + `(${o.w} × ${o.h} pixeli): harta nu încape în dala de ortofoto`);
  const out = new Uint8Array(lat * inalt);
  const txMin = Math.floor(c0 / o.tw), txMax = Math.floor((c0 + lat - 1) / o.tw);
  const tyMin = Math.floor(r0 / o.th), tyMax = Math.floor((r0 + inalt - 1) / o.th);
  for (let ty = tyMin; ty <= tyMax; ty++)
    for (let tx = txMin; tx <= txMax; tx++) {
      const d = citesteDala(o, banda, tx, ty);
      if (!d) continue;
      const px0 = tx * o.tw, py0 = ty * o.th;
      const x1 = Math.max(c0, px0), x2 = Math.min(c0 + lat, px0 + d.w);
      const y1 = Math.max(r0, py0), y2 = Math.min(r0 + inalt, py0 + d.h);
      for (let y = y1; y < y2; y++)
        for (let x = x1; x < x2; x++)
          out[(y - r0) * lat + (x - c0)] = d.date[(y - py0) * d.w + (x - px0)];
    }
  return out;
}

/**
 * La fel, dar fiecare valoare e media unui bloc de `bloc` × `bloc` pixeli.
 *
 * Pentru o hartă al cărei pas e un multiplu al pixelului: nodul primește media
 * exactă a amprentei lui. Așa se construiește și piramida ortofotoului — nivelul
 * de 2 m e media blocului de la 0,25 m.
 *
 * Un bloc de 1 × 1 de la nivelul potrivit și un bloc mai mare de la un nivel mai
 * fin estimează deci aceeași medie, dar NU dau aceeași valoare: fiecare nivel al
 * piramidei e recomprimat JPEG separat și are abaterea lui pe pixel. Citit ca
 * atare, un nivel grosier o păstrează întreagă; mediat pe bloc, unul fin o
 * micșorează. Pe harta_v0, față de media de la 0,25 m, NDVI-ul diferă cu mediana
 * 0,014 la nivelul de 2 m și 0,002 la cel de 0,5 m mediat 4 × 4.
 */
export function fereastraMedie(o, banda, c0, r0, lat, inalt, bloc) {
  const brut = fereastra(o, banda, c0, r0, lat * bloc, inalt * bloc);
  if (bloc === 1) return Float32Array.from(brut);
  const out = new Float32Array(lat * inalt);
  const L = lat * bloc, n = bloc * bloc;
  for (let r = 0; r < inalt; r++)
    for (let c = 0; c < lat; c++) {
      let s = 0;
      for (let y = 0; y < bloc; y++)
        for (let x = 0; x < bloc; x++) s += brut[(r * bloc + y) * L + c * bloc + x];
      out[r * lat + c] = s / n;
    }
  return out;
}

/**
 * Unde cade o hartă în pixelii unui nivel: primul pixel al amprentei nodului
 * (0, 0) și câți pixeli pe latura unui nod.
 *
 * Amprenta unui nod e [nod − pas/2, nod + pas/2]. Ea trebuie să înceapă EXACT pe
 * o margine de pixel, altfel orice culoare e deplasată cu o fracțiune de pixel.
 *
 * Verificarea de dinainte compara `bbox.xMin` cu marginile pixelilor, ceea ce e
 * corect numai pentru hărțile cu convenția „muchii de celulă" (build-zona), unde
 * xMin chiar e marginea amprentei primului nod. La cele cu convenția „noduri"
 * (build-petic), xMin e NODUL însuși — vezi `jum` din relief.mjs. Pe harta_v1,
 * la nivelul de 1 m, `bbox.xMin` cădea pe o margine de pixel, deci verificarea
 * trecea, dar nodurile cădeau pe COLȚURILE pixelilor: culori deplasate cu 0,5 m
 * spre est și 0,5 m spre sud, fără nicio eroare.
 *
 * Semnul pe Y e scris separat, nu copiat de pe X: rândurile cresc spre SUD, iar
 * y0 e marginea de NORD a ortofotoului.
 */
export function aliniaza(harta, o) {
  const bloc = harta.pas / o.pas;
  if (Math.abs(bloc - Math.round(bloc)) > 1e-9)
    throw new Error(`pasul hărții (${harta.pas} m) nu e multiplu al pixelului (${o.pas} m)`);
  const fc = (harta.nodX(0) - harta.pas / 2 - o.x0) / o.pas;
  const fr = (o.y0 - (harta.nodY(0) + harta.pas / 2)) / o.pas;
  if (Math.abs(fc - Math.round(fc)) > 1e-6 || Math.abs(fr - Math.round(fr)) > 1e-6)
    throw new Error(`${harta.nume} nu se aliniază cu nivelul de ${o.pas} m: amprenta primului nod `
      + `începe la ${fc} × ${fr} pixeli, nu pe o margine de pixel. `
      + `Pe o hartă cu convenția „${harta.conventie}" se aliniază un nivel mai fin, mediat pe blocuri — `
      + `așa citește strat-ndvi.mjs; ortofoto.mjs citește numai nivelul egal cu pasul hărții.`);
  return { c0: Math.round(fc), r0: Math.round(fr), bloc: Math.round(bloc) };
}
