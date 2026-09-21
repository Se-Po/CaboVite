import { existsSync } from 'node:fs';

// Oprirea limpede când lipsesc datele-sursă.
//
// Scripturile care citesc din `date-sursa/` presupuneau că directorul lor există,
// fiindcă în proiectul din care vine acesta exista. Într-o clonă curată nu
// există — `date-sursa/` e gitignorat — iar `readdirSync` arunca un ENOENT cu
// urmă de stivă prin `binding.readdir`. Cine îl vedea afla că undeva în Node
// s-a stricat ceva, nu că trebuie să pună niște fișiere într-un folder.
//
// Verificarea făcută pe o clonă curată a scos-o la iveală. Merită păstrată: un
// script offline își petrece jumătate din viață fiind rulat fără datele lui.

/**
 * Se oprește cu un mesaj despre DATE dacă directorul lipsește.
 *
 * @param {string} dir    calea cerută
 * @param {string} cesunt ce trebuie pus acolo, în cuvinte
 * @param {string} [cum]  de unde se iau, dacă nu e evident
 */
export function cereDirector(dir, cesunt, cum) {
  if (existsSync(dir)) return;
  throw new Error(
    `lipsește ${dir}/ — acolo trebuie puse ${cesunt}.`
    + (cum ? `\n  ${cum}` : '')
    + '\n  Directorul nu intră în depozit, deci o clonă curată nu-l are.',
  );
}

/** La fel, pentru un fișier anume — de obicei rezultatul pasului dinainte. */
export function cereFisier(cale, cesunt, cum) {
  if (existsSync(cale)) return;
  throw new Error(
    `lipsește ${cale} — ${cesunt}.` + (cum ? `\n  ${cum}` : ''),
  );
}
