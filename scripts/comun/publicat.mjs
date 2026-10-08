// Un fișier din public/data care e în HEAD e publicat, iar vercel.json îl ține un an în
// cache-ul cititorilor (`immutable`): o rescriere sub același nume n-ar mai ajunge la
// cine a deschis pagina o dată. De aceea un nume publicat se rescrie numai cu aceiași
// octeți — o refacere deterministă trece —, iar un conținut nou aruncă, ÎNAINTE de
// scriere, și cere un nume nou. Un nume care nu e în HEAD se scrie liber: e în lucru.
//
// Octeții se compară ca blob git (`hash-object --path`), nu pe disc: cu
// `core.autocrlf` un .json poate avea pe disc alte capete de rând decât în depozit.
//
// Scripturile build-* au garda lor, mai strictă: un nume urmărit nu se rescrie deloc.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const git = (args, input) => {
  const r = spawnSync('git', args, { input, encoding: 'utf8' });
  if (r.error) throw new Error(`garda numelor publicate cere git: ${r.error.message}`);
  return r;
};

let radacina;
/** Calea față de rădăcina depozitului, cu bare drepte, cum o cere git. */
export function caleGit(cale) {
  radacina ??= (() => {
    const r = git(['rev-parse', '--show-toplevel']);
    if (r.status !== 0) throw new Error('garda numelor publicate: nu sunt într-un depozit git');
    return r.stdout.trim();
  })();
  return relative(radacina, resolve(cale)).replace(/\\/g, '/');
}

/** Blobul din HEAD al căii, sau null dacă HEAD n-o are. */
export function blobHead(cale) {
  const r = git(['rev-parse', '--verify', '--quiet', `HEAD:${caleGit(cale)}`]);
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Blobul pe care l-ar avea în depozit octeții dați, la calea dată. */
export function blobPentru(cale, octeti) {
  const r = git(['hash-object', `--path=${caleGit(cale)}`, '--stdin'], octeti);
  if (r.status !== 0) throw new Error(`git hash-object: ${r.stderr}`);
  return r.stdout.trim();
}

/**
 * Scrie `octeti` la `cale`, dacă numele nu e publicat sau dacă iese identic.
 * @returns {boolean} true dacă a scris; false dacă discul avea deja exact conținutul publicat
 */
export function scrieNepublicat(cale, octeti) {
  const b = typeof octeti === 'string' ? Buffer.from(octeti) : Buffer.from(octeti.buffer, octeti.byteOffset, octeti.byteLength);
  const head = blobHead(cale);
  if (head) {
    if (blobPentru(cale, b) === head) {
      if (existsSync(cale) && blobPentru(cale, readFileSync(cale)) === head) {
        console.log(`  ${caleGit(cale)}: identic cu cel publicat, nerescris`);
        return false;
      }
      // Conținutul nou e cel publicat, dar copia de pe disc nu: o rulare întreruptă sau
      // una de dinainte de gardă. Se reface, altfel un commit ar publica copia stricată.
      writeFileSync(cale, b);
      console.log(`  ${caleGit(cale)}: copia locală diferea de cea publicată; refăcută`);
      return true;
    }
    throw new Error(`${caleGit(cale)} e publicat (în HEAD), iar conținutul nou diferă. vercel.json îl ține un an în ` +
      'cache-ul cititorilor, deci un conținut nou primește un nume nou (de pildă orto_v2), nu se scrie peste cel vechi.');
  }
  writeFileSync(cale, b);
  return true;
}
