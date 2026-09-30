// Poziția soarelui la o dată și o oră UTC — algoritmul NOAA (foaia de calcul
// „Solar Calculations”, după Meeus, Astronomical Algorithms).
//
// Precizia declarată e sub un minut de arc pentru anii 1800–2100; aici trebuie
// numai ca să spună la ce oră a putut zbura avionul ortofotoului, deci o zecime
// de grad ar ajunge. Refracția atmosferică se adaugă: la 20° ridică soarele cu
// ~0,04°, la 40° cu ~0,02°.
//
// Azimutul e ADEVĂRAT, măsurat de la nordul geografic, în sensul acelor de ceas.
// Scena e pe grila TM06, unde nordul e altul: aici A_grilă = A_adevărat − γ, cu
// γ = −0,673704° (vezi „Busola și nordul adevărat” în CLAUDE.md), adică
// A_grilă = A_adevărat + 0,674°.

const R = Math.PI / 180;

/** Ziua iuliană a unei date JavaScript (UTC). */
export const ziIuliana = (d) => d.getTime() / 86400000 + 2440587.5;

/**
 * @param {Date} data   momentul, în UTC
 * @param {number} lat  grade, nord pozitiv
 * @param {number} lon  grade, est pozitiv
 * @returns {{azimut: number, elevatie: number, declinatie: number}} în grade;
 *   azimutul adevărat, în [0, 360)
 */
export function pozitieSoare(data, lat, lon) {
  const T = (ziIuliana(data) - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * R) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * R);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * R);
  const decl = Math.asin(Math.sin(eps * R) * Math.sin(lambda * R));
  const y = Math.tan((eps / 2) * R) ** 2;
  const ecTimp = 4 / R * (y * Math.sin(2 * L0 * R) - 2 * e * Math.sin(M * R)
    + 4 * e * y * Math.sin(M * R) * Math.cos(2 * L0 * R)
    - 0.5 * y * y * Math.sin(4 * L0 * R) - 1.25 * e * e * Math.sin(2 * M * R));
  const minute = data.getUTCHours() * 60 + data.getUTCMinutes() + data.getUTCSeconds() / 60;
  const tsa = (((minute + ecTimp + 4 * lon) % 1440) + 1440) % 1440;
  const H = (tsa / 4 < 0 ? tsa / 4 + 180 : tsa / 4 - 180) * R;
  const phi = lat * R;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
  const Z = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const a = Math.acos(Math.max(-1, Math.min(1, (Math.sin(phi) * Math.cos(Z) - Math.sin(decl)) / (Math.cos(phi) * Math.sin(Z))))) / R;
  const azimut = H > 0 ? (a + 180) % 360 : (540 - a) % 360;
  let el = 90 - Z / R;
  // Refracția, formula NOAA pe trepte.
  const te = Math.tan(el * R);
  const refr = el > 85 ? 0
    : el > 5 ? 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5
      : el > -0.575 ? 1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)))
        : -20.772 / te;
  el += refr / 3600;
  return { azimut, elevatie: el, declinatie: decl / R };
}
