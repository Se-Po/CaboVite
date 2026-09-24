// OKLab, dus și întors.
//
// Toate grupările și comparațiile de culoare din lanț se fac în OKLab, nu în
// RGB. În RGB distanța euclidiană nu seamănă cu cât de diferite par două culori:
// două verzuri depărtate numeric pot fi aproape identice pentru ochi, iar două
// griuri apropiate numeric, vizibil diferite. OKLab e construit tocmai ca
// distanța din el să corespundă percepției.
//
// Stătea copiat în trei scripturi — ortofoto, paleta, culori-poze. Acum stă aici.
// `hex` din culori-poze.mjs NU e aceeași funcție și rămâne acolo: rotunjește,
// fiindcă primește medii, pe când aceasta primește deja octeți.

/** sRGB → liniar, pe o valoare în [0, 1]. */
export const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Liniar → sRGB, pe o valoare în [0, 1]. */
export const gama = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Trei octeți sRGB → [L, a, b]. */
export function laOklab(R, G, B) {
  const r = linear(R / 255), g = linear(G / 255), b = linear(B / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** [L, a, b] → trei octeți sRGB, tăiați la gamă. */
export function dinOklab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const rgb = [
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return rgb.map((c) => Math.round(Math.min(255, Math.max(0, gama(Math.min(1, Math.max(0, c))) * 255))));
}

/** Octeți întregi → „#rrggbb". */
export const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
