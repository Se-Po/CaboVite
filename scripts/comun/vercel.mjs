// Antetele din vercel.json, calculate pe o cale, așa cum le pune Vercel. Le folosesc
// proba livrării (scripts/verifica-livrare.mjs) și `npm run preview` (vite.config.js),
// ca build-ul încercat local să trimită aceeași politică de securitate ca pagina publicată.
//
// Vercel citește `source` cu path-to-regexp: textul din afara parantezelor se potrivește
// literal, iar un grup `( … )` e o expresie regulată, nevidă, care nu începe cu `?` (în
// grup, numai `(?:`, nu grupuri care capturează). Aici se simulează numai atât. `:nume`, `*`, un modificator după grup
// sau o condiție `has` aruncă: proba n-are voie să spună „trece” pe o regulă pe care
// n-o înțelege. Tot de aceea o cheie pusă de două reguli pe aceeași cale aruncă —
// ordinea în care le aplică Vercel nu e simulată. Literele mari și o bară la capăt se
// potrivesc aici oricum; dacă Vercel e mai strict, simularea greșește spre „prinde mai
// mult”, adică spre mai multe căi verificate ca imutabile, nu mai puține.

import { readFileSync } from 'node:fs';

/** Ce trimite Vercel pe un fișier static fără nicio regulă (curl, 2026-10-07). */
export const CACHE_IMPLICIT = 'public, max-age=0, must-revalidate';

/** `source` → RegExp, pe subsetul de mai sus. */
export function regexSursa(source) {
  let re = '', i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '(') {
      if (source[i + 1] === '?') throw new Error(`vercel.json: grupul din ${source} începe cu „?”; path-to-regexp îl respinge`);
      let adancime = 1, j = i + 1;
      for (; j < source.length && adancime; j++) {
        if (source[j] === '\\') j++;
        else if (source[j] === '(') {
          if (source[j + 1] !== '?') throw new Error(`vercel.json: grup care capturează în ${source}; path-to-regexp cere (?: … )`);
          adancime++;
        }
        else if (source[j] === ')') adancime--;
      }
      if (adancime) throw new Error(`vercel.json: paranteză neînchisă în ${source}`);
      if (j - 1 === i + 1) throw new Error(`vercel.json: grup gol în ${source}`);
      re += `(${source.slice(i + 1, j - 1)})`;
      i = j;
      if (/[?*+]/.test(source[i] ?? '')) throw new Error(`vercel.json: modificatorul de după grup din ${source} nu e simulat`);
    } else if (/[:*+?{}]/.test(c)) {
      throw new Error(`vercel.json: „${c}” din ${source} nu e simulat; scrie regula cu un grup ( … )`);
    } else {
      re += c.replace(/[.\\^$|[\]]/g, '\\$&');
      i++;
    }
  }
  // path-to-regexp lasă, implicit, o bară de la capăt opțională
  return new RegExp(`^${re}/?$`, 'i');
}

/** Regulile `headers` din vercel.json (sau dintr-un obiect deja citit). */
export function reguliVercel(cfg = JSON.parse(readFileSync('vercel.json', 'utf8'))) {
  return (cfg.headers ?? []).map((r) => {
    if (r.has || r.missing) throw new Error(`vercel.json: condițiile has/missing din ${r.source} nu sunt simulate`);
    return { source: r.source, re: regexSursa(r.source), antete: r.headers };
  });
}

/** Antetele pe care le pune vercel.json pe o cale, cu cheile scrise mic. */
export function antetePentru(reguli, cale) {
  const o = {};
  for (const r of reguli) {
    if (!r.re.test(cale)) continue;
    for (const { key, value } of r.antete) {
      const k = key.toLowerCase();
      if (k in o) throw new Error(`${cale}: „${key}” vine din două reguli; ordinea lor pe Vercel nu e simulată`);
      o[k] = value;
    }
  }
  return o;
}
