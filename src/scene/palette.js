// Culorile scenei, moștenite din pagina existentă (CaboEspichel/index.html).
// O singură sursă de adevăr: dacă se schimbă paleta paginii, se schimbă aici.

// O capcană de care m-am lovit: variabilele paginii vechi sunt culori de
// INTERFAȚĂ. În tema întunecată `--c-i` devine #8cbcdb — albastru deschis,
// potrivit pentru un marcaj de text pe fond negru, nepotrivit pentru apă. Apa
// rămâne apă în ambele teme; doar lumina scade. Deci nu mapăm fiecare variabilă
// CSS naiv pe un rol din scenă.

/** Paleta pentru lumină. */
export const PALETA = {
  mare: 0x2b5c7c,      // --c-i, albastrul adânc
  platou: 0x3d6b4c,    // --c-f, verdele
  calcar: 0xf7f3ea,    // --bg, calcarul cald
  ocru: 0x94752f,      // --gold
  teracota: 0x7a3b2e,  // --accent
  cerneala: 0x24211c,  // --ink
  cer: 0xdfe8ef,       // cerul atlantic — nu există în pagina veche
};

/**
 * Tema întunecată.
 *
 * Nu e „noapte la Cabo Espichel": e doar interfața paginii care e întunecată.
 * Peisajul rămâne diurn — lumină de după-amiază târzie, mai caldă și mai joasă,
 * dar nu stinsă. Prima variantă cobora cerul la #4a5c6b și, trecută prin AgX,
 * marea ieșea aproape neagră și terenul părea să plutească în gol.
 */
export const PALETA_NOAPTE = {
  mare: 0x27536e,      // albastru adânc, lizibil — NU --c-i din tema dark a paginii
  platou: 0x3a6250,
  calcar: 0xc9bfad,    // calcarul nu devine cenușiu pentru că pagina e dark
  ocru: 0x9d7e3f,
  teracota: 0xd99177,
  cerneala: 0x17150f,
  cer: 0x7d92a6,       // trebuie să rămână clar mai deschis decât marea,
                       // altfel orizontul dispare
};

export const esteNoapte = () =>
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export const paletaCurenta = () => (esteNoapte() ? PALETA_NOAPTE : PALETA);

/** Interpolare liniară între două culori date ca 0xRRGGBB. Întoarce tot 0xRRGGBB. */
export function amesteca(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  const c = (dep) => {
    const ca = (a >> dep) & 0xff, cb = (b >> dep) & 0xff;
    return Math.round(ca + (cb - ca) * k) << dep;
  };
  return c(16) | c(8) | c(0);
}

/**
 * Decide culoarea unei fațete de teren.
 *
 * `panta` — 0 pentru o fațetă perfect orizontală, 1 pentru una verticală.
 *           Vine din normala fațetei: panta = 1 - normala.y.
 * `altitudine` — metri deasupra nivelului mării, negativ sub apă.
 * `p` — paleta curentă (zi sau noapte).
 *
 * Întoarce o culoare 0xRRGGBB.
 */
export function culoareTeren(panta, altitudine, p) {
  // TODO(human)
}
