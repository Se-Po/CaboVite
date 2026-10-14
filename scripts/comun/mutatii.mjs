// Uneltele controalelor negative din probe: textul paginii — de pe disc sau dintr-un commit —,
// mutațiile lui și modulele încărcate din text.
//
// Capetele de rând: în index toate fișierele sunt LF, dar cu core.autocrlf copia de lucru poate
// avea, fișier cu fișier, CRLF sau LF. Textul se citește numai prin funcțiile de aici, care îl
// aduc la LF o singură dată; probele, mutațiile și inserțiile se scriu numai cu '\n'.

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LF = (t) => t.replace(/\r\n/g, '\n');

/** Un fișier al depozitului, de pe disc, ca text cu LF. */
export const textSursa = (cale) => LF(readFileSync(cale, 'utf8'));

/** Același fișier la un commit, ca text cu LF; `null` fără git sau fără fișierul acela acolo. */
export const textLa = (reper, cale) => {
  try {
    return LF(execFileSync('git', ['show', `${reper}:${cale}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }));
  } catch { return null; }
};

export const NEAPLICATA = 'MUTAȚIA NU S-A APLICAT';

/**
 * O mutație a unui text, din perechi [text sau regex, înlocuire], aplicate pe rând. `null` dacă
 * textul e `null` sau dacă una nu se aplică — textul de înlocuit nu mai există —, ca un control
 * să nu treacă degeaba pe codul neschimbat: controlul pică atunci cu NEAPLICATA. Un text se
 * înlocuiește ca atare (fără `$&` și rudele lui); un regex, cu grupurile lui.
 */
export const muta = (text, ...perechi) => {
  if (text === null) return null;
  let s = text;
  for (const [din, inLoc] of perechi) {
    if (typeof din === 'string' ? !s.includes(din) : !din.test(s)) return null;
    s = typeof din === 'string' ? s.replace(din, () => inLoc) : s.replace(din, inLoc);
  }
  return s;
};

/**
 * Un modul din src/scene, încărcat din text: `three` (cu subcăile lui) și importurile relative
 * duse la fișierele de azi — `./x` în src/scene, `../x` în src/. `null` pentru un text `null`.
 * Fișierul stă o clipă în directorul temporar al sistemului.
 */
let nrModul = 0;
export const modulDin = async (src) => {
  if (src === null) return null;
  src = src.replace(/from '(three(?:\/[^']*)?)'/g, (_, s) => `from '${import.meta.resolve(s)}'`)
    .replace(/from '\.\/([^']+)'/g, (_, f) => `from '${new URL(`../../src/scene/${f}`, import.meta.url).href}'`)
    .replace(/from '\.\.\/([^']+)'/g, (_, f) => `from '${new URL(`../../src/${f}`, import.meta.url).href}'`);
  const f = join(tmpdir(), `cabo-modul-${process.pid}-${nrModul++}.mjs`);
  writeFileSync(f, src);
  try { return await import(pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
};
