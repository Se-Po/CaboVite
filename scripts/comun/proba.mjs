// Baza comună a probelor `verifica-*`: rândurile ok/PICĂ, săriturile numărate, rezumatul cu
// codul de ieșire, fetch-ul din public/ și avertismentele prinse pe un singur apel.
//
// Rândurile păstrează formatul de dinaintea bazei, ca jurnalele să rămână comparabile:
//   „  ok   text”, „  PICĂ  text”, „  --    SĂRIT: text”.
// O săritură e o secțiune care n-a rulat (fără date-sursa/, fără git), nu o probă: se numără
// și apare în rezumat. `rezumat()` încheie scriptul: „N ok, M picate, K sărite”, codul 1 dacă
// a picat ceva — sau, cu --strict ori VERIFICA_STRICT=1, și dacă s-a sărit ceva —, iar cu
// VERIFICA_REZUMAT=1 încă o linie pentru `npm run verifica`: `##verifica {"ok":…}`.
//
// Un console.warn care ajunge la consolă — în afara lui `cuAvertismente` și a capturilor
// proprii ale unui script — e neașteptat: se tipărește pe loc și pică la rezumat.

import { existsSync, readFileSync } from 'node:fs';

export const STRICT = process.argv.includes('--strict') || process.env.VERIFICA_STRICT === '1';
export const stare = { ok: 0, picate: 0, sarite: 0, neasteptate: [] };

/** Un rând „ok” sau „PICĂ”. Întoarce `bun`, ca boolean. */
export function proba(bun, text) {
  console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`);
  if (bun) stare.ok++;
  else stare.picate++;
  return Boolean(bun);
}

/** O secțiune care n-a rulat, cu motivul. Se numără; sub --strict e un eșec. */
export function sari(text) {
  console.log(`  --    SĂRIT: ${text}`);
  stare.sarite++;
}

const warnConsola = console.warn;
console.warn = (...a) => {
  stare.neasteptate.push(a.join(' '));
  warnConsola('  !!    avertisment neașteptat:', ...a);
};

/** Avertismentele de pe un singur apel, prinse fără să ajungă la consolă: `{ r, e, avert }`. */
export async function cuAvertismente(f) {
  const prinse = [], inainte = console.warn;
  console.warn = (...a) => { prinse.push(a.join(' ')); };
  let r, e = null;
  try { r = await f(); } catch (x) { e = x; } finally { console.warn = inainte; }
  return { r, e, avert: prinse };
}

/** Ca `cuAvertismente`, cu `fetch` înlocuit pe durata apelului. */
export async function cuFetch(fals, cerere) {
  const inainte = globalThis.fetch;
  globalThis.fetch = fals;
  try { return await cuAvertismente(cerere); } finally { globalThis.fetch = inainte; }
}

// Ca Vite: o cale care nu există întoarce 200 și pagina index, nu 404. Exact cazul pe care
// încărcătoarele trebuie să-l prindă din conținut.
export const INDEX = readFileSync('index.html');
/** `fetch` pe public/, ca serverul de dezvoltare. */
export async function dinDisc(url) {
  const f = 'public' + url;
  if (!existsSync(f)) return new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html' } });
  return new Response(readFileSync(f), { status: 200 });
}

/** Cuantila q a valorilor, pe rangul floor(q·n); NaN pe o listă goală. */
export function cuantila(v, q) {
  const s = Float64Array.from(v).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
}

/**
 * Încheie scriptul: avertismentele neașteptate (un rând PICĂ, numai dacă sunt), rezumatul și
 * codul de ieșire. Cu `iesi`, iese după ce s-a golit stdout — pentru scripturile care lasă în
 * urmă ceva viu în buclă; atunci se așteaptă (`await rezumat({ iesi: true })`).
 */
export function rezumat({ iesi = false } = {}) {
  if (stare.neasteptate.length) {
    const n = stare.neasteptate.length;
    proba(false, `${n} ${n === 1 ? 'avertisment neașteptat' : 'avertismente neașteptate'}: ${stare.neasteptate.slice(0, 3).join(' | ').slice(0, 300)}`);
  }
  const { ok, picate, sarite } = stare;
  const cod = picate || (STRICT && sarite) ? 1 : 0;
  const cifre = `${ok} ok, ${picate} picate, ${sarite} sărite`;
  if (picate) console.log(`\n${picate} ${picate === 1 ? 'probă a picat' : 'probe au picat'} (${cifre}).`);
  else if (sarite) console.log(`\nProbele care au rulat au trecut (${cifre})${STRICT ? '; --strict nu primește săriturile' : ''}.`);
  else console.log(`\nToate probele au trecut (${cifre}).`);
  if (process.env.VERIFICA_REZUMAT === '1') {
    const mib = Math.round(process.resourceUsage().maxRSS / 1024);
    console.log(`##verifica ${JSON.stringify({ ok, picate, sarite, strict: STRICT, memorie_mib: mib })}`);
  }
  process.exitCode = cod;
  if (iesi) return new Promise(() => process.stdout.write('', () => process.exit(cod)));
  return cod;
}

/**
 * Oprește scriptul aici, cu un eșec: o probă de care depind toate celelalte a picat. Eșecul e
 * de obicei deja numărat de rândul ei PICĂ; dacă nu, se numără aici.
 */
export function opreste(motiv) {
  console.log(`\nOprit: ${motiv}`);
  if (!stare.picate) stare.picate = 1;
  return rezumat({ iesi: true });
}
