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

/**
 * Culorile măsurate în fotografiile de la fața locului.
 *
 * Se încarcă din `public/data/paleta-teren.json`, produs de `npm run paleta` din
 * cele 30 de fotografii. Stau separat de PALETA, care e moștenită din pagina
 * veche și e o paletă de interfață — ce se adoptă din măsurători și ce nu e o
 * decizie, nu o suprascriere automată.
 *
 * Fiecare material are `rgb`, `culoare` (0xRRGGBB) și `masurat.nuanta_de_incredere`.
 * Steagul acela contează: la calcar, vegetație uscată și tufăriș, croma măsurată
 * e sub prag, adică fotografiile nu susțin nicio nuanță anume și culoarea iese
 * practic neutră. Nu e o scăpare a măsurătorii, e ce arată datele.
 */
let masurat = null;

export async function incarcaPaleta(url = '/data/paleta-teren.json') {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    masurat = Object.fromEntries(Object.entries(j.materiale).map(([nume, m]) => [nume, {
      ...m,
      culoare: (m.rgb[0] << 16) | (m.rgb[1] << 8) | m.rgb[2],
    }]));
  } catch (e) {
    // Pagina trebuie să rămână o pagină. Fără măsurători, culoareTeren() decide
    // ce face — exact ca înainte să existe fotografiile.
    console.warn('paleta măsurată nu s-a încărcat:', e.message);
    masurat = null;
  }
  return masurat;
}

export const paletaCurenta = () => ({ ...(esteNoapte() ? PALETA_NOAPTE : PALETA), masurat });

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
 * `p` — paleta curentă (zi sau noapte), plus `p.masurat` dacă s-a încărcat.
 *
 * Ce e în `p.masurat`, măsurat din cele 30 de fotografii ale tale:
 *
 *   p.masurat.calcar.culoare            0x9d958c   din fotografii
 *   p.masurat.poteca.culoare            0xdbc8b0   din fotografii
 *   p.masurat.tufaris.culoare           0x516868   din ortofoto
 *   p.masurat.vegetatie_uscata.culoare  0x717b76   din ortofoto
 *   p.masurat.mare.culoare              0x668dc6   (fundal, nu teren)
 *   p.masurat.cer.culoare               0xb7cff1   (fundal, nu teren)
 *
 * Fiecare are `sursa` și `de_ce`, plus măsurătorile amândurora sub `fotografii`
 * și `ortofoto`, ca să se poată compara. Alegerea nu e o preferință, e geometrie:
 * fotografiile de la sol măsoară bine numai ce era aproape de aparat, iar restul
 * a venit prin kilometri de aer, care spală culoarea; ortofotoul n-are drumul
 * acela, dar privește drept în jos, deci vede o faleză aproape din muchie.
 *
 * `poteca` e solul de pe platou, nu plaja: apare numai la unghi larg și în talpa
 * cadrului, deci e ce aveai sub picioare, la ~130 m. E și cel mai bine măsurat
 * material din toate — subiect apropiat, fără kilometri de aer între el și lentilă.
 *
 * Fiecare are și `masurat.L_minim` / `L_lumina` — cât de întunecat și cât de
 * luminat a fost văzut materialul — și `masurat.nuanta_de_incredere`.
 *
 * ATENȚIE la o capcană de tastat: `p.calcar` și `p.masurat.calcar` sunt lucruri
 * diferite. Primul e 0xf7f3ea, culoarea hârtiei din paleta de interfață a paginii
 * vechi; al doilea e 0x9d958c, calcarul măsurat. La fel `mare` și `cer`. Ambele
 * există pe același obiect, iar o literă lipsă dă o culoare plauzibilă și greșită,
 * fără nicio eroare. Măsurătorile sunt întotdeauna sub `p.masurat`.
 *
 * Ce e deja rezolvat și n-ai de ce să refaci: culorile de mai sus sunt albedouri,
 * nu aparențe. Umbra a fost scoasă din ele, fiindcă three.js o adaugă el, din
 * normală. Dacă le folosești ca atare, faleza iese o dată întunecată, nu de două ori.
 *
 * Ce rămâne de decis, și de-asta e al tău: cum se împart cele patru materiale de
 * teren după pantă și altitudine. Fotografiile spun ce culori există acolo, nu
 * unde. Câteva lucruri de cântărit — nu o rețetă:
 *   - poteca și tufărișul sunt amândouă pe platou, sus și pe orizontală;
 *   - o faleză aproape verticală e rocă goală, oricât de sus ar fi;
 *   - sub zero e apă: relieful coboară la -8 m acolo, artificiu de randare;
 *   - `amesteca(a, b, t)` face trecerea lină; praguri tăiate net se văd ca dungi;
 *   - la `p.masurat` lipsă (fetch eșuat) trebuie să întorci ceva oricum.
 *
 * Întoarce o culoare 0xRRGGBB.
 */
export function culoareTeren(panta, altitudine, p) {
  // TODO(human)
}
