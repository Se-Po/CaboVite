// Numele de afișat al unui element de pe hartă — ce scrie panoul „Coordonate” când un clic
// cade pe o clădire —, după prefixul cheii lui din sanctuar_vN.json sau cladiri_vN.json.
// Etichetele stau în conținut (`nume_elemente` din src/content/sanctuar.js și cladiri.js),
// cu sursele lor în comentarii, acolo.
//
// Fără three și fără DOM: îl folosește scena (scena.js), iar o probă din Node îl poate
// importa ca atare, deci verifică funcția paginii, nu o copie a ei.

/**
 * @param {string} cheie — cheia elementului, de pildă `aripa_s.est_cafenea`
 * @param {{sanctuar?: {nume_elemente?: Array<[string, string]>},
 *   cladiri?: {nume_elemente?: Array<[string, string]>}}} [continut]
 * @returns {string} eticheta primului prefix care se potrivește — întâi lista sanctuarului,
 *   apoi a clădirilor, fiecare în ordinea ei, deci un prefix mai lung trebuie să stea înaintea
 *   celui mai scurt —, altfel cheia însăși
 */
export function numeElement(cheie, continut) {
  return [...(continut?.sanctuar?.nume_elemente ?? []), ...(continut?.cladiri?.nume_elemente ?? [])]
    .find(([p]) => cheie.startsWith(p))?.[1] ?? cheie;
}
