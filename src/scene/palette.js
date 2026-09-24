// Culorile scenei. Marea din tema deschisă e `--c-i` din pagina existentă
// (CaboEspichel/index.html); cerul și ambele culori ale temei întunecate sunt
// alese aici; terenul e măsurat la fața locului.

// O capcană de care m-am lovit: variabilele paginii vechi sunt culori de
// INTERFAȚĂ. În tema întunecată `--c-i` devine #8cbcdb — albastru deschis,
// potrivit pentru un marcaj de text pe fond negru, nepotrivit pentru apă. Apa
// rămâne apă în ambele teme; doar lumina scade. Deci nu mapăm fiecare variabilă
// CSS naiv pe un rol din scenă.
//
// Paleta de interfață avea și `platou`, `calcar`, `ocru`, `teracota`, `cerneala`.
// Nu le citea nimic: stăteau pentru culoareTeren(), cât a fost goală. Terenul
// se pictează acum din măsurători, deci au plecat — și cu ele capcana în care
// `p.calcar` (culoarea hârtiei, 0xf7f3ea) și `p.masurat.calcar` (piatra, 0x9d958c)
// stăteau pe același obiect, la o literă distanță.

/** Paleta pentru lumină. */
export const PALETA = {
  mare: 0x2b5c7c,      // --c-i, albastrul adânc
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
  cer: 0x7d92a6,       // trebuie să rămână clar mai deschis decât marea,
                       // altfel orizontul dispare
};

export const esteNoapte = () =>
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

/** Culoarea terenului când nu există măsurători: gri cald, neutru. */
export const GRI_REZERVA = 0x8a8578;

/**
 * sRGB → liniar, o dată pentru fiecare din cele 256 de valori posibile.
 *
 * `culoare.setHex(hex, SRGBColorSpace)` face trei `Math.pow` la fiecare apel, iar
 * plasa cheamă o dată pe fațetă: 1,36 milioane de fațete, deci 4 milioane de
 * `pow` la fiecare pornire. Intrarea are însă doar 256 de valori distincte pe
 * canal — e un octet.
 *
 * Tabelul e BIT-IDENTIC cu ce face three, nu doar apropiat: aceeași formulă din
 * `ColorManagement.SRGBToLinear`, pe aceeași intrare `octet / 255`. Verificat în
 * pagină, comparând cu `Color.setHex` însuși pe 0x8a8578, 0x24211c, 0x3d6b4c,
 * 0x9d958c, alb, negru și 0x010101: potrivire exactă pe toate șapte.
 *
 * Float64, nu Float32: terrain.js înmulțește valorile cu 65535 înainte de
 * rotunjire, iar o rotunjire intermediară la float32 ar intra în cifra cuantizată.
 *
 * Stătea în terrain.js. S-a mutat aici fiindcă îl cere și regula de culoare, iar
 * două copii ale aceleiași conversii ar fi putut să se despartă.
 */
export const SPRE_LINIAR = (() => {
  const t = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
  }
  return t;
})();

/**
 * Liniar → sRGB pe 8 biți, dintr-un tabel de 16 384 de intrări.
 *
 * Regula amestecă în liniar și întoarce un octet sRGB: fără tabel, trei `pow` pe
 * fațetă. Măsurat în Node pe cele 860 522 de fațete ale bazei: 52 ms cu `pow`,
 * 31 ms cu tabelul. Tabelul greșește cu cel mult un nivel din 255, pe 0,78% din
 * canale — pe cele foarte întunecate, unde curba sRGB e cea mai abruptă.
 */
const PASI_SRGB = 16383;
const SPRE_SRGB = (() => {
  const t = new Uint8Array(PASI_SRGB + 1);
  for (let i = 0; i <= PASI_SRGB; i++) {
    const c = i / PASI_SRGB;
    t[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  }
  return t;
})();

/**
 * Culorile măsurate în fotografiile de la fața locului și în ortofoto.
 *
 * Se încarcă din `public/data/paleta-teren.json`, produs de `npm run paleta`. Stau
 * separat de PALETA, care e o paletă de fundal pentru cer și mare — ce se adoptă
 * din măsurători și ce nu e o decizie, nu o suprascriere automată.
 *
 * Fiecare material are `rgb`, `culoare` (0xRRGGBB) și `liniar` — cele trei canale
 * în RGB liniar, calculate aici o singură dată, ca regula să nu le reconvertească
 * pe fiecare fațetă.
 */
let masurat = null;
let atribuireOrtofoto = null;

export async function incarcaPaleta(url = '/data/paleta-teren.json') {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    masurat = Object.fromEntries(Object.entries(j.materiale).map(([nume, m]) => [nume, {
      ...m,
      culoare: (m.rgb[0] << 16) | (m.rgb[1] << 8) | m.rgb[2],
      liniar: m.rgb.map((v) => SPRE_LINIAR[v]),
    }]));
    atribuireOrtofoto = j.ortofoto?.atributie ? j.ortofoto : null;
    const lipsa = MATERIALE_TEREN.filter((n) => !masurat[n]);
    if (lipsa.length) console.warn(`paleta măsurată n-are: ${lipsa.join(', ')} — terenul rămâne gri`);
  } catch (e) {
    // Pagina trebuie să rămână o pagină. Fără măsurători, culoareTeren() întoarce
    // griul de rezervă — exact cum arăta terenul înainte să existe fotografiile.
    console.warn('paleta măsurată nu s-a încărcat:', e.message);
    masurat = null;
    atribuireOrtofoto = null;
  }
  return masurat;
}

export const paletaCurenta = () => ({ ...(esteNoapte() ? PALETA_NOAPTE : PALETA), masurat });

/** Cele patru materiale de teren, fără de care regula întoarce GRI_REZERVA. */
const MATERIALE_TEREN = ['poteca', 'calcar', 'vegetatie_uscata', 'tufaris'];

/**
 * Dacă terenul se pictează chiar din măsurători cu paleta dată — adică dacă
 * regula are toate cele patru materiale. Altfel iese gri, iar ce e în paletă nu
 * ajunge pe ecran și n-are ce atribui.
 */
export const terenMasurat = (p) => MATERIALE_TEREN.every((n) => p?.masurat?.[n]?.liniar);

/**
 * Sursa care cere atribuire pentru culorile măsurate — `{atributie, producator,
 * licenta, portal}` —, sau null. Albedourile vegetației vin din ortofotoul DGT,
 * sub CC BY 4.0: se afișează pe fiecare fațetă de vegetație, deci atribuirea e
 * datorată ori de câte ori terenul e pictat din paletă.
 */
export const atribuirePaleta = () => (masurat ? atribuireOrtofoto : null);

// ------------------------------------------------------------------ regula

const grade = (g) => 1 - Math.cos((g * Math.PI) / 180);   // panta = 1 − cos θ
const S20 = grade(20), S40 = grade(40), S55 = grade(55), S70 = grade(70);

// Medianele NDVI ale claselor din ortofoto, pe harta_v0: roca, vegetația uscată,
// tufărișul. Sunt populațiile pe care s-au măsurat chiar albedourile vegetației.
const ROCA = 0.017, USCAT = 0.261, TUFARIS = 0.410;

// Fără strat NDVI: câtă vegetație e la o cotă dată, citit din fracțiunea
// măsurată pe benzi de 10 m (sub 33° de pantă). Patru noduri, liniar între ele.
const VEGETATIE_PE_COTA = [[15, 0.05], [55, 0.80], [110, 0.80], [140, 0.15]];

const intre01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const treapta = (x, a, b) => { const t = intre01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function vegetatieDupaCota(h) {
  const n = VEGETATIE_PE_COTA;
  if (h <= n[0][0]) return n[0][1];
  for (let i = 1; i < n.length; i++)
    if (h <= n[i][0]) return n[i - 1][1] + ((n[i][1] - n[i - 1][1]) * (h - n[i - 1][0])) / (n[i][0] - n[i - 1][0]);
  return n[n.length - 1][1];
}

/** Un canal: roca și vegetația amestecate, apoi octetul sRGB. Totul în liniar. */
function canal(p, k, u, t, spreCalcar, spreTufaris, vegetatie) {
  const roca = p + (k - p) * spreCalcar;
  const veg = u + (t - u) * spreTufaris;
  return SPRE_SRGB[(intre01(roca + (veg - roca) * vegetatie) * PASI_SRGB + 0.5) | 0];
}

/**
 * Culoarea unei fațete de teren.
 *
 * `panta` — 0 pentru o fațetă orizontală, 1 pentru una verticală: 1 − |n.y|.
 * `altitudine` — media celor trei vârfuri, în metri.
 * `p` — paleta curentă; regula citește NUMAI `p.masurat`, deci terenul nu
 *       depinde de temă și nu trebuie refăcut la schimbarea ei.
 * `ndvi` — indicele de vegetație al fațetei, din infraroșul ortofotoului: media
 *          nodurilor ei care au valoare. `undefined` dacă stratul lipsește.
 *
 * Întoarce 0xRRGGBB, sRGB.
 *
 * Regula a scris-o Claude, din măsurători, la cererea autorului — care a
 * delegat-o explicit. Fiecare număr de mai jos a fost ales numai acolo unde două
 * metrici au fost de acord: distanța față de culoarea ortofotoului cu albedourile
 * paletei, și aceeași distanță cu ancore potrivite pe ortofoto. Prima singură ar
 * fi înșelat: paleta e albedo, luat din partea luminată, iar ortofotoul are
 * umbrele în el, deci orice variantă care întunecă „câștigă" fără să fie mai bună.
 *
 * ─── De ce e nevoie de NDVI
 *
 * Numai din pantă și altitudine nu se află unde e vegetația. Tufărișul și
 * vegetația uscată au aceeași pantă mediană (14,1° față de 12,6°) și aceeași
 * altitudine mediană (103,3 față de 103,4 m). Cea mai bună regulă posibilă pe cele
 * două le desparte la întâmplare (53–57% pe date nevăzute), iar antrenată pe sudul
 * hărții și aplicată pe nord cade la 35,6%, sub clasa majoritară.
 *
 * ─── Cum decide
 *
 * roca       poteca → calcar după pantă, trecere lină între 20° și 40°. Între benzi
 *            (25–35°, 15–45°) diferența măsurată e ≤ 0,05 ΔE; un prag tăiat net
 *            e mai rău peste tot și se vede ca dungă.
 * vegetația  uscată → tufăriș după NDVI, liniar între medianele claselor (0,261 →
 *            0,410). Nu sunt două populații: NDVI-ul vegetației are un singur vârf,
 *            iar pragul de 0,341 care le despărțea îl taia la mediană.
 * cât din    rampă liniară pe NDVI, de la mediana rocii (0,017) la a vegetației
 * fiecare    uscate (0,261). Bate un prag la 0,15 și o trecere scurtă 0,10–0,20:
 *            5,45 ΔE față de 5,81 și 6,02, pe ancorele ortofotoului.
 * faleza     peste 55° vegetația se stinge, iar peste 70° e numai rocă: ortofotoul
 *            privește drept în jos și vede un perete aproape din muchie, deci NDVI-ul
 *            de acolo e al buzei de deasupra, nu al peretelui.
 * amestecul  în RGB LINIAR. O fațetă acoperită pe jumătate cu tufăriș reflectă media
 *            liniară a celor două. Datele n-au putut decide — piramida ortofotoului
 *            e ea însăși mediată în sRGB, deci favorizează sRGB prin construcție, cu
 *            0,02–0,16 ΔE —, așa că decide fizica.
 *
 * Fără strat NDVI, cât din fiecare vine din altitudine: fracțiunea de vegetație
 * măsurată pe benzi de cotă, în patru noduri. Câștigă 1,2–1,4 ΔE față de o
 * constantă. Pe metrica brută pierde 0,55: pune potecă deschisă pe platoul de peste
 * 130 m, acolo unde chiar este, iar metrica brută răsplătește întunecarea.
 *
 * ─── Ce NU are caz special, și de ce
 *
 * Apa. Fațetele de la mal coboară până la umplutura de −8 m pe cel mult 2 m în plan,
 * deci au panta de cel puțin 0,757 (76°), peste pragul falezei: ies calcar exact, pe
 * toate cele care se văd: 3 986 pe bază, 2 714 pe petic. Cele 700 + 549 cu toate
 * vârfurile la −8 m n-au NDVI și iau calea fără strat — stau întregi sub planul
 * opac al mării. Tot sub mare stau și 26 de fațete ale peticului, în inelul de
 * cusătură, unde relieful e interpolat între umplutură și uscat.
 *
 * ─── Cât de bine, măsurat pe cele 855 836 de fațete de uscat ale bazei
 *
 * ΔE_OK×100 față de culoarea ortofotoului în vârfuri: 10,22 medie cu albedourile
 * paletei (8,49 mediană), 5,46 cu ancorele ortofotoului — diferența e lumina, nu
 * regula. Fără strat: 15,56 / 9,56. Cuantizarea stratului pe 15 niveluri schimbă
 * culoarea cu 0,37 în medie, p99 1,95. Fațetele care ies în evidență față de
 * vecinii lor (ΔE > 5 față de media celor 3 × 3 celule din jur): 8,1% aici, 17% cu
 * patru clase tăiate net, 4,5% în ortofotoul însuși.
 *
 * ─── Albedo, nu aparență
 *
 * Culorile din `p.masurat` sunt albedouri: umbra a fost scoasă din ele, fiindcă
 * three.js o pune el, din normală. Regula NU corectează lumina. Dacă ecranul iese
 * prea închis — cu soarele la 18°, platoul chiar iese mai închis decât în pozele
 * făcute la amiază —, asta se reglează în lumini sau în expunere, nu aici.
 *
 * Fără `p.masurat` (fetch eșuat), sau fără unul din cele patru materiale:
 * GRI_REZERVA, cum era terenul înainte de măsurători.
 */
export function culoareTeren(panta, altitudine, p, ndvi) {
  const m = p.masurat;
  const P = m?.poteca?.liniar, K = m?.calcar?.liniar;
  const U = m?.vegetatie_uscata?.liniar, T = m?.tufaris?.liniar;
  if (!P || !K || !U || !T) return GRI_REZERVA;

  const spreCalcar = treapta(panta, S20, S40);
  let spreTufaris, vegetatie;
  if (Number.isFinite(ndvi)) {
    spreTufaris = intre01((ndvi - USCAT) / (TUFARIS - USCAT));
    vegetatie = intre01((ndvi - ROCA) / (USCAT - ROCA));
  } else {
    spreTufaris = 0.5;
    vegetatie = vegetatieDupaCota(altitudine);
  }
  vegetatie *= 1 - treapta(panta, S55, S70);

  return (canal(P[0], K[0], U[0], T[0], spreCalcar, spreTufaris, vegetatie) << 16)
       | (canal(P[1], K[1], U[1], T[1], spreCalcar, spreTufaris, vegetatie) << 8)
       |  canal(P[2], K[2], U[2], T[2], spreCalcar, spreTufaris, vegetatie);
}
