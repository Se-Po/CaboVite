// ETRS89 / Portugal TM06 (EPSG:3763) — proiecția în care sunt toate datele DGT.
//
// Mercator transversal pe GRS80, fără deplasări false. Formulele complete, nu
// aproximarea „grade × metri pe grad": la 95 km de meridianul central aceea
// greșește cu zeci de metri, adică zeci de celule la rezoluțiile cu care lucrăm.
//
// Codul a stat identic în build-zona.mjs și build-petic.mjs. Acum stă aici.

const A = 6378137, F = 1 / 298.257222101;
const E2 = F * (2 - F), EP2 = E2 / (1 - E2);
const LAT0 = (39.6682583333333 * Math.PI) / 180;
const LON0 = (-8.13310833333333 * Math.PI) / 180;

const arcMeridian = (lat) =>
  A * ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * lat
     - ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * lat)
     + ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * lat)
     - ((35 * E2 ** 3) / 3072) * Math.sin(6 * lat));
const M0 = arcMeridian(LAT0);

/** Longitudine/latitudine în grade → metri TM06. */
export function laTM06(lonGrade, latGrade) {
  const lat = (latGrade * Math.PI) / 180, lon = (lonGrade * Math.PI) / 180;
  const N = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2;
  const C = EP2 * Math.cos(lat) ** 2;
  const a = (lon - LON0) * Math.cos(lat);
  return {
    x: N * (a + ((1 - T + C) * a ** 3) / 6
          + ((5 - 18 * T + T ** 2 + 72 * C - 58 * EP2) * a ** 5) / 120),
    y: arcMeridian(lat) - M0 + N * Math.tan(lat) * (a ** 2 / 2
          + ((5 - T + 9 * C + 4 * C ** 2) * a ** 4) / 24
          + ((61 - 58 * T + T ** 2 + 600 * C - 330 * EP2) * a ** 6) / 720),
  };
}

/**
 * Inversa: TM06 → longitudine/latitudine, ca sidecar-ul să poarte colțurile.
 *
 * `zecimale` e 6 implicit, fiindcă așa au fost scrise sidecar-urile existente și
 * nu vrem să se schimbe niciun octet din ele. Controlul de precizie al
 * proiecției cere însă valoarea nerotunjită — de aceea e parametru, nu constantă.
 */
export function dinTM06(x, y, zecimale = 6) {
  const mu = (y + M0) / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const lat1 = mu
    + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const C1 = EP2 * Math.cos(lat1) ** 2;
  const T1 = Math.tan(lat1) ** 2;
  const s = 1 - E2 * Math.sin(lat1) ** 2;
  const N1 = A / Math.sqrt(s);
  const R1 = (A * (1 - E2)) / s ** 1.5;
  const D = x / N1;
  const lat = lat1 - ((N1 * Math.tan(lat1)) / R1) * (D ** 2 / 2
    - ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6) / 720);
  const lon = LON0 + (D - ((1 + 2 * T1 + C1) * D ** 3) / 6
    + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5) / 120) / Math.cos(lat1);
  const g = (v) => (zecimale === null ? (v * 180) / Math.PI : +(((v * 180) / Math.PI).toFixed(zecimale)));
  return { lon: g(lon), lat: g(lat) };
}

/** Regula par-impar, aceeași ca inPoligon() din src/scene/terrain.js. */
export function inPoligon(x, y, p) {
  let inauntru = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i].y > y) !== (p[j].y > y) &&
        x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x)
      inauntru = !inauntru;
  return inauntru;
}

/** Aria unui poligon, prin formula șiretului. */
export const arie = (p) => {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    s += (p[j].x + p[i].x) * (p[j].y - p[i].y);
  return Math.abs(s / 2);
};
