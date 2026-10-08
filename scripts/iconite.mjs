// Iconițele paginii: sfera aurie a cursorului (src/styles/cursoare/sfera.svg), singură.
//
//   npm run iconite
//
// Scrie în public/:
//   favicon.svg           — fila browserelor care citesc SVG;
//   favicon.ico           — celelalte, plus cererea automată a lui /favicon.ico: PNG-uri
//                           de 16, 32 și 48 px într-un ICO (formatul acceptă PNG din Vista);
//   apple-touch-icon.png  — 180 px, pe fondul paginii: iOS umple transparența cu negru
//                           și rotunjește colțurile, deci sfera stă cu margine.
//
// Toate vin din aceeași descriere. SVG-ul se scrie ca text, iar PNG-urile se desenează aici,
// cu aceeași formulă ca a browserului: gradientul radial al sferei în octeți sRGB, cum îl
// interpolează SVG implicit, apoi conturul, cu 8 × 8 eșantioane pe pixel. Fișierele ies
// identice la fiecare rulare.

import { writeFileSync } from 'node:fs';
import { scriePngRgba } from './comun/png.mjs';

// Sfera din sfera.svg: centrul (16, 16), raza 5,5, contur de 1,2 în culoarea fondului.
const C = 16, R = 5.5, CONTUR = 1.2;
const GRAD = { cx: 0.38, cy: 0.32, r: 0.75 }; // în cutia cercului, ca objectBoundingBox
const OPRIRI = [[0, '#fff3cf'], [0.45, '#e0bd68'], [1, '#8a6626']];
const FOND = '#17150f'; // --bg din main.css
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Fereastra de privire în jurul sferei: latura lasă `margine` din latură liberă pe fiecare parte. */
const fereastra = (margine) => {
  const jum = (R + CONTUR / 2) / (1 - 2 * margine);
  return { x0: C - jum, y0: C - jum, l: 2 * jum };
};

function svg(f) {
  const n = (v) => +v.toFixed(4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(f.x0)} ${n(f.y0)} ${n(f.l)} ${n(f.l)}">` +
    `<defs><radialGradient id="g" cx="${GRAD.cx}" cy="${GRAD.cy}" r="${GRAD.r}">` +
    OPRIRI.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') +
    `</radialGradient></defs><circle cx="${C}" cy="${C}" r="${R}" fill="url(#g)" stroke="${FOND}" stroke-width="${CONTUR}"/></svg>\n`;
}

function culoareGradient(x, y) {
  const gx = C - R + GRAD.cx * 2 * R, gy = C - R + GRAD.cy * 2 * R, gr = GRAD.r * 2 * R;
  const t = Math.min(1, Math.hypot(x - gx, y - gy) / gr);
  for (let i = 1; i < OPRIRI.length; i++) {
    const [o1, c1] = OPRIRI[i];
    if (t > o1) continue;
    const [o0, c0] = OPRIRI[i - 1], u = (t - o0) / (o1 - o0), a = rgb(c0), b = rgb(c1);
    return a.map((v, k) => v + (b[k] - v) * u);
  }
  return rgb(OPRIRI.at(-1)[1]);
}

/** RGBA, `n` × `n` pixeli, pe fereastra `f`; fără `fond`, transparent. */
function deseneaza(n, f, fond) {
  const E = 8, out = new Uint8Array(n * n * 4), contur = rgb(FOND), f0 = fond && rgb(fond);
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const s = [0, 0, 0];
    let a = 0;
    for (let j = 0; j < E; j++) for (let i = 0; i < E; i++) {
      const x = f.x0 + (px + (i + 0.5) / E) * f.l / n, y = f.y0 + (py + (j + 0.5) / E) * f.l / n;
      const d = Math.hypot(x - C, y - C);
      const c = Math.abs(d - R) <= CONTUR / 2 ? contur : d <= R ? culoareGradient(x, y) : f0;
      if (!c) continue;
      for (let k = 0; k < 3; k++) s[k] += c[k];
      a++;
    }
    const o = (py * n + px) * 4;
    for (let k = 0; k < 3; k++) out[o + k] = a ? Math.round(s[k] / a) : 0;
    out[o + 3] = Math.round((a / (E * E)) * 255);
  }
  return out;
}

/** ICO cu PNG-uri înăuntru: antet, câte o intrare de 16 octeți, apoi imaginile. */
function ico(imagini) {
  const cap = Buffer.alloc(6 + 16 * imagini.length);
  cap.writeUInt16LE(0, 0); cap.writeUInt16LE(1, 2); cap.writeUInt16LE(imagini.length, 4);
  let pozitie = cap.length;
  imagini.forEach(({ n, png }, i) => {
    const e = 6 + 16 * i;
    cap[e] = n; cap[e + 1] = n; // sub 256, deci încape într-un octet
    cap.writeUInt16LE(1, e + 4); cap.writeUInt16LE(32, e + 6);
    cap.writeUInt32LE(png.length, e + 8); cap.writeUInt32LE(pozitie, e + 12);
    pozitie += png.length;
  });
  return Buffer.concat([cap, ...imagini.map((x) => x.png)]);
}

const fila = fereastra(0.03);
writeFileSync('public/favicon.svg', svg(fila));
writeFileSync('public/favicon.ico', ico([16, 32, 48].map((n) => ({ n, png: scriePngRgba(n, n, deseneaza(n, fila)) }))));
writeFileSync('public/apple-touch-icon.png', scriePngRgba(180, 180, deseneaza(180, fereastra(0.2), FOND)));
console.log('scrise: public/favicon.svg, public/favicon.ico (16, 32, 48 px), public/apple-touch-icon.png (180 px)');
