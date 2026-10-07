import * as THREE from 'three';
import { GRI_REZERVA, SPRE_LINIAR, culoareTeren, paletaCurenta } from './palette.js';
import { geometriaGrilei } from './cusatura.js';

// Terenul: din grila de înălțimi într-un singur mesh cu fațete plate (sau netezit,
// la nivelurile de la 12 m încolo ale împrejurimilor — vezi `campNeted`).
//
// Funcție pură — primește datele, întoarce mesh-ul. Nu încarcă nimic și nu atinge
// rendererul, ca să rămână limpede cine cere randarea și cine tratează erorile.
//
// ───────────────────────────────────────────── ce NU se generează, și de ce
//
// Jumătate din celulele hărții sunt apă: toate patru nodurile la `zMin_m`, cota
// de umplutură pe care sidecarul o numește „artificiu de randare, nu batimetrie".
// Numărate din fișierele .bin: 930 714 din cele 1 641 746 de celule păstrate ale
// bazei harta_v4 (56,7%) și 122 858 din cele 373 800 ale peticului (32,9%).
//
// Marea e un plan OPAC de 120 km la −0,25 m, iar camera nu poate coborî sub el:
// ținta stă la y = 60, `minDistance` e 80 și `maxPolarAngle` e π/2 − 0,04, deci
// camera rămâne mereu peste 64,6 m. Triunghiurile acelea erau desenate la
// fiecare cadru și nu puteau fi văzute niciodată.
//
// Se taie numai celulele cu TOATE patru nodurile la cota de umplutură. Malul,
// unde nodurile sunt amestecate, rămâne întreg — acolo chiar se vede unde se
// termină uscatul.
//
// `inaltimeLa` citește din `grila`, nu din plasă, deci măsurarea peste apă merge
// mai departe la fel: eticheta „apă" din panoul punctului vine din date, nu din
// geometrie.
//
// ──────────────────────────────────── ce nu se mai calculează de două ori
//
// `computeVertexNormals()` a plecat, și cu el întreg atributul de normale.
// Comentariul care stătea aici spunea, de la bun început, că normala fațetei se
// calculează oricum pentru culoare „deci nu mai cerem computeVertexNormals() să
// o redescopere" — iar codul de dedesubt o chema totuși. Măsurat pe geometrii de
// mărimea adevărată: 91,8 ms pe bază și 35,2 ms pe petic, pentru un rezultat pe
// care bucla îl avea deja în mână.
//
// La fel, conversia sRGB → liniar se făcea o dată pe fațetă, adică 7,7 milioane
// de `Math.pow`, deși intrarea are 256 de valori posibile pe canal. Tabelul
// `SPRE_LINIAR` stă acum în palette.js, lângă regula care îl folosește și ea.

let avertizat = false;

// Culoarea stă pe 16 biți normalizați, nu pe 32 în virgulă mobilă: 6 octeți pe
// vârf în loc de 12.
//
// Uint8 ar fi fost 3, dar nu merge, și se poate arăta de ce: valorile din atribut
// sunt LINIARE, iar un pas de 1/255 în liniar înseamnă la luminozitate mică vreo
// 2,5 niveluri de afișare — benzi vizibile tocmai pe faleza umbrită, unde scena
// are cel mai mult de spus. Pe 16 biți eroarea măsurată în pagină, față de ce
// scria codul dinainte, e 0,0005–0,0011 dintr-un nivel de afișare din 255.
const CUANTA = 65535;

// Cât de departe caută un nod de apă din fâșia de cusătură uscatul de la care își ia
// culoarea, în pași ai grilei lui: cât lățimea fâșiei, un pas al nivelului din afară,
// adică 8 pași ai celui dinăuntru (4 → 32 m, 32 → 256 m).
export const INELE_APA = 8;

function culoareFateta(panta, altitudine, paleta, ndvi, culoare) {
  const c = culoare(panta, altitudine, paleta, ndvi);
  // `Math.floor`, ca `Color.setHex`: o culoare cu parte zecimală n-ar trebui să
  // se rotunjească altfel aici decât s-ar fi rotunjit acolo.
  if (typeof c === 'number' && Number.isFinite(c)) return Math.floor(c);
  if (!avertizat) {
    avertizat = true;
    console.warn(`regula de culoare a întors ${c}, nu o culoare — folosesc gri de rezervă.`);
  }
  return GRI_REZERVA;
}

/**
 * Normala și culoarea fiecărui nod, pentru plasele NETEZITE — nivelurile de la 12 m
 * încolo ale împrejurimilor (`NIVELURI_NETEZITE`). Restul hărții are fațete plate; vezi
 * `neted` la creeazaTeren().
 *
 * Normala vine din diferențe centrale pe grilă (la margine, de o parte), deci nu
 * depinde de ce celule păstrează plasa și nici de diagonala aleasă. Culoarea, din
 * aceeași regulă ca fațetele, cu panta normalei și NDVI-ul nodului; un nod fără NDVI
 * ia calea fără strat, ca o fațetă fără niciun nod cu valoare.
 *
 * Un nod de APĂ ia media culorilor uscatului celui mai apropiat (vezi `scrieApa`).
 * Stă sub planul mării, dar culoarea lui se întinde pe partea vizibilă a
 * triunghiurilor de la mal: o fațetă de 32 m care coboară de la 10 m la −8 m iese din
 * mare abia la 57% din drum, deci acolo ar fi avut mai mult din culoarea apei decât a
 * uscatului.
 *
 * Valorile se dau deja cuantizate — normala pe 8 biți cu semn, culoarea pe 16 —, iar
 * calea leneșă (`nod`, pentru buclele cusăturii) și cea completă (`tot`, pentru
 * plasă) dau aceleași numere pe orice nod pe care îl folosește plasa: fâșia de
 * cusătură și plasa au aceleași vârfuri, deci aceeași normală și aceeași culoare în
 * ele, la bit. Altfel s-ar vedea o linie.
 */
export function campNeted(relief, { paleta, ndvi, culoare } = {}) {
  const { latime: w, inaltime: h, pasX, pasZ } = relief;
  const Y = relief.inaltimi;
  const cotaApa = relief.meta?.zMin_m;
  const apa = (i) => Number.isFinite(cotaApa) && Y[i] <= cotaApa;
  const pal = paleta ?? paletaCurenta();
  const regula = culoare ?? culoareTeren;
  const coduri = ndvi?.coduri ?? null, niveluri = ndvi?.niveluri ?? null;
  const n = [0, 0, 0];

  /** Normala nodului, unitară, în virgulă mobilă. */
  const normala = (r, c) => {
    const c0 = c > 0 ? c - 1 : c, c1 = c < w - 1 ? c + 1 : c;
    const r0 = r > 0 ? r - 1 : r, r1 = r < h - 1 ? r + 1 : r;
    // z crește spre sud, odată cu rândul; suprafața y = f(x, z) are normala (−fx, 1, −fz).
    const gx = (Y[r * w + c1] - Y[r * w + c0]) / ((c1 - c0) * pasX);
    const gz = (Y[r1 * w + c] - Y[r0 * w + c]) / ((r1 - r0) * pasZ);
    const l = Math.hypot(gx, 1, gz);
    n[0] = -gx / l; n[1] = 1 / l; n[2] = -gz / l;
    return n;
  };
  const scrieNormala = (r, c, out, k) => {
    const v = normala(r, c);
    out[k] = Math.round(v[0] * 127); out[k + 1] = Math.round(v[1] * 127); out[k + 2] = Math.round(v[2] * 127);
  };
  /** Culoarea unui nod de uscat, ca trei valori liniare pe 16 biți. */
  const scrieUscat = (r, c, out, k) => {
    const i = r * w + c;
    const v = normala(r, c);
    let nd;
    if (coduri) { const q = niveluri[(coduri[i >> 1] >> ((i & 1) << 2)) & 15]; nd = q === q ? q : undefined; }
    const hex = culoareFateta(1 - Math.abs(v[1]), Y[i], pal, nd, regula);
    out[k] = Math.round(SPRE_LINIAR[(hex >> 16) & 255] * CUANTA);
    out[k + 1] = Math.round(SPRE_LINIAR[(hex >> 8) & 255] * CUANTA);
    out[k + 2] = Math.round(SPRE_LINIAR[hex & 255] * CUANTA);
  };
  /**
   * Culoarea unui nod de apă: media nodurilor de uscat de pe cel mai apropiat inel din
   * jurul lui (inelul 1 sunt cei opt vecini, inelul 2 următorii 16, până la `inele`);
   * `uscat(r, c, out, k)` dă culoarea lor. Întoarce false dacă n-a găsit uscat.
   *
   * Un nod de apă dintr-o celulă păstrată are mereu uscat pe inelul 1: celula are un
   * colț de uscat, iar colțurile unei celule sunt vecine între ele. Inelele mai largi
   * sunt pentru fâșia de cusătură, unde un nod de pe marginea grilei lui poate să nu
   * aibă uscat în jur, dar să stea într-un triunghi care urcă la uscatul celuilalt nivel
   * și iese din mare pe jumătate. Recenzia l-a găsit pe marginea de est a lui harta_v6:
   * 4 vârfuri, colorate înainte cu regula pe nodul însuși, la −8 m, ca un mal deschis la
   * culoare, cu ΔE ~10 față de uscatul de lângă.
   */
  const scrieApa = (r, c, out, k, uscat, inele) => {
    const t = [0, 0, 0], s = [0, 0, 0];
    for (let inel = 1; inel <= inele; inel++) {
      let m = 0;
      for (let dr = -inel; dr <= inel; dr++) for (let dc = -inel; dc <= inel; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== inel) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= h || cc < 0 || cc >= w || apa(rr * w + cc)) continue;
        uscat(rr, cc, t, 0);
        s[0] += t[0]; s[1] += t[1]; s[2] += t[2]; m++;
      }
      if (m) { out[k] = Math.round(s[0] / m); out[k + 1] = Math.round(s[1] / m); out[k + 2] = Math.round(s[2] / m); return true; }
    }
    return false;
  };

  return {
    /** Un nod: `{nrm, rgb}`, gata cuantizate. */
    nod(r, c) {
      const nrm = new Int8Array(3), rgb = new Uint16Array(3);
      scrieNormala(r, c, nrm, 0);
      // Niciun uscat nici la lățimea fâșiei: nodul stă în larg; ia regula, pe el însuși.
      if (!apa(r * w + c)) scrieUscat(r, c, rgb, 0);
      else if (!scrieApa(r, c, rgb, 0, scrieUscat, INELE_APA)) scrieUscat(r, c, rgb, 0);
      return { nrm, rgb };
    },
    /**
     * Toate nodurile pe care le poate folosi grila, trei valori pe nod. Uscatul întâi: apa
     * ia media lui. Un nod de apă fără uscat pe inelul 1 n-ajunge în nicio celulă păstrată,
     * deci rămâne cu zero — altfel marea întreagă și-ar căuta uscatul pe opt inele.
     */
    tot() {
      const normale = new Int8Array(w * h * 3), culori = new Uint16Array(w * h * 3);
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const i = r * w + c;
        scrieNormala(r, c, normale, i * 3);
        if (!apa(i)) scrieUscat(r, c, culori, i * 3);
      }
      const dinTablou = (rr, cc, out, k) => { const j = (rr * w + cc) * 3; out[k] = culori[j]; out[k + 1] = culori[j + 1]; out[k + 2] = culori[j + 2]; };
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++)
        if (apa(r * w + c)) scrieApa(r, c, culori, (r * w + c) * 3, dinTablou, 1);
      return { normale, culori };
    },
  };
}

/**
 * Testul punct-în-poligon, regula par-impar.
 *
 * Trage o rază spre est din (x, z) și numără laturile traversate: impar
 * înseamnă înăuntru. Comparația `(a.z > z) !== (b.z > z)` tratează o latură ca
 * închisă la un capăt și deschisă la celălalt, ceea ce face ca un punct aflat
 * exact pe orizontala unui vârf să fie numărat o singură dată — altfel conturul
 * ar avea găuri pe rândurile care trec fix prin vârfuri.
 *
 * Stă aici, lângă mesher, fiindcă asta face: decide ce celulă intră în plasă.
 */
export function inPoligon(x, z, puncte) {
  let inauntru = false;
  for (let i = 0, j = puncte.length - 1; i < puncte.length; j = i++) {
    const a = puncte[i], b = puncte[j];
    if ((a.z > z) !== (b.z > z) &&
        x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x)
      inauntru = !inauntru;
  }
  return inauntru;
}

/**
 * Masca bazei: înăuntrul conturului cu care a fost extrasă harta și în afara
 * găurii de sub petic.
 *
 * Datele extrase pentru o zonă aleasă poartă poligonul cu ele. Plasa se
 * generează numai înăuntrul lui: cutia dreptunghiulară din care e decupată are
 * cu 74% mai multe celule, aproape toate apă. Gaura e exact dreptunghiul
 * peticului; marginile lui sunt noduri ale bazei, deci cele două plase se
 * termină pe aceeași linie.
 *
 * Peticul NU o primește: masca cere `!subPetic`, iar peticul stă în întregime
 * înăuntrul acelui dreptunghi, deci aplicată lui l-ar șterge cu totul. Cine
 * „repară" asimetria dând-o amândurora pierde peticul fără nicio eroare.
 *
 * Stă aici, nu în scena.js, ca unealta `npm run verifica-teren` să construiască
 * în Node EXACT plasa paginii, cu același cod, nu cu o copie care se desparte încet.
 *
 * @returns {{limitaDatelor: Array|null, subPetic: Function|null, pastreaza: Function|undefined}}
 */
export function mascaBazei(relief, reliefPetic) {
  const poligonDate = relief.meta?.poligon_scena;
  const limitaDatelor = Array.isArray(poligonDate) && poligonDate.length >= 3
    ? poligonDate
    : null;

  const g = reliefPetic?.meta?.gaura_scena;
  const subPetic = g
    ? (x, z) => x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1
    : null;

  const pastreaza = (limitaDatelor || subPetic)
    ? (x, z) => (!limitaDatelor || inPoligon(x, z, limitaDatelor)) &&
                !(subPetic && subPetic(x, z))
    : undefined;

  return { limitaDatelor, subPetic, pastreaza };
}

/**
 * @param {{latime,inaltime,pasX,pasZ,inaltimi,meta?}} relief — de la incarcaRelief()
 * @param {{material?: THREE.Material, pastreaza?: (x: number, z: number) => boolean,
 *          deplasare?: {x: number, z: number}, paleta?: object,
 *          ndvi?: {coduri: Uint8Array, niveluri: Float64Array} | null,
 *          culoare?: Function,
 *          cusatura?: {varfuri: Float32Array, ndvi: Float32Array, triunghiuri: Uint32Array}}} optiuni
 *   `pastreaza` primește centrul unei celule, în metri de scenă, și decide dacă
 *   ea intră în plasă. Așa capătă harta forma conturului cu care a fost extrasă
 *   (`poligon_scena` din sidecar) și așa se taie gaura de sub petic: celulele
 *   din afară nu se generează deloc, deci scade și numărul de triunghiuri.
 *   `deplasare` mută întreaga grilă în scenă — vezi comentariul de la `dep`.
 *   `ndvi` e stratul de la incarcaStrat(), pentru ACEEAȘI grilă; lipsă sau null,
 *   regula de culoare primește `undefined` și merge pe calea fără strat.
 *   `culoare` înlocuiește regula — pentru previzualizarea datelor și pentru
 *   unealta care verifică ce primește regula. Implicit e culoareTeren().
 *   `cusatura` adaugă fâșia care coase grila de nivelul dinăuntru (cusatura.js,
 *   `fermoar`): triunghiuri gata făcute, colorate după aceeași regulă, cu NDVI-ul
 *   din vârfurile lor.
 *   `neted` face plasa NETEZITĂ în loc de fațete plate: normală și culoare pe nod
 *   (`campNeted`), interpolate de GPU peste triunghi. Fâșia de cusătură trebuie
 *   atunci să le aducă și ea, pe fiecare vârf (`normale`, `culori`).
 */
export function creeazaTeren(relief, optiuni = {}) {
  const { latime: w, inaltime: h, pasX, pasZ } = relief;

  // Un singur nume pentru tabloul de înălțimi, în toată sfera de închidere.
  //
  // Înainte, `inaltimi` era destructurat separat și `Y` îl citea de acolo, iar
  // `grila = null` din dispose() nu elibera nimic: închiderea lui `Y` ținea viu
  // celălalt nume, deci și tabloul. Măsurat pe modulul adevărat, 0 din 6,63 MiB
  // eliberați pe bază. Cu un singur nume mutabil, se eliberează tot.
  let grila = relief.inaltimi;

  // Centrăm pe origine. Rândul 0 e nordul, deci ajunge la Z negativ.
  //
  // `deplasare` mută grila față de acel centru. Îi trebuie unui petic de altă
  // rezoluție: el își are propriul centru, iar fără decalaj ar ateriza în
  // mijlocul scenei în loc de locul lui de pe hartă. Se calculează din diferența
  // dintre colțurile TM06 ale celor două seturi de date, deci e exactă, nu
  // potrivită din ochi.
  //
  // Formulele stau în cusatura.js (`geometriaGrilei`), nu aici: fâșia care coase un
  // nivel de altul își scrie vârfurile din ele, iar vârfurile acelea trebuie să cadă
  // la bit pe ale plaselor.
  const { X, Z, dep } = geometriaGrilei(relief, optiuni.deplasare);
  const Y = (r, c) => grila[r * w + c];

  // Paleta se primește, nu se ia singură din modul. Culorile se coc o singură
  // dată, aici, în atributul de vârf: dacă cineva ar chema creeazaTeren() înainte
  // ca `incarcaPaleta()` să fi terminat, terenul ar ieși tăcut cu culoarea de
  // rezervă, iar remedierea ar cere regenerarea întregii geometrii. Ca parametru,
  // răspunderea stă la apelant, care știe ce-a așteptat. `paletaCurenta()` rămâne
  // ca rezervă, ca fișierul să-și țină promisiunea din capul lui: funcție pură.
  const paleta = optiuni.paleta ?? paletaCurenta();
  const pastreaza = optiuni.pastreaza;
  const culoare = optiuni.culoare ?? culoareTeren;

  // Stratul NDVI, dacă a venit. Pe fațetă, media nodurilor care AU valoare:
  // la mal un vârf e apă (codul 0, NaN la decodare), iar apa n-are infraroșu de
  // vegetație — media cu el ar trage fațeta de uscat spre rocă fără temei.
  // Nicio valoare → `undefined`, aceeași cale ca un strat lipsă.
  //
  // `let`, și golite imediat după buclă. Închiderile de mai jos — `inaltimeLa`,
  // `dispose` — țin viu tot contextul funcției, deci și orice tablou la care se
  // mai ajunge dintr-un nume de aici; e capcana de la `grila`. Stratul nu mai
  // folosește la nimic după ce culoarea s-a copt.
  let coduri = optiuni.ndvi?.coduri ?? null;
  let niveluri = optiuni.ndvi?.niveluri ?? null;
  const ndviNod = (i) => niveluri[(coduri[i >> 1] >> ((i & 1) << 2)) & 15];
  const ndviFateta = (ia, ib, ic) => {
    if (!coduri) return undefined;
    let s = 0, n = 0;
    const a = ndviNod(ia), b = ndviNod(ib), c = ndviNod(ic);
    if (a === a) { s += a; n++; }   // NaN !== NaN: codul 0 nu intră în medie
    if (b === b) { s += b; n++; }
    if (c === c) { s += c; n++; }
    return n ? s / n : undefined;
  };

  // Cota de umplutură. Fără sidecar nu se taie nicio celulă de apă — mai bine
  // desenăm în plus decât să ștergem uscat pe baza unei presupuneri.
  const cotaApa = relief.meta?.zMin_m;
  const taieApa = Number.isFinite(cotaApa);

  // O SINGURĂ trecere de decizie, nu două.
  //
  // Înainte, `pastreaza` se chema o dată la numărat și încă o dată la scris:
  // 3 470 392 de apeluri pe bază, fiecare cu o buclă peste laturile poligonului.
  // Masca costă 1 735 196 de octeți temporari — 3,7% din atributele bazei — și
  // închide și o gaură de regresie: alocarea de mai jos se sprijinea pe faptul
  // că `pastreaza` dă de două ori exact același răspuns.
  //
  // Tot aici ies și marginile celulelor păstrate, din care se scrie mai jos sfera
  // de încadrare, fără încă o trecere peste vârfuri.
  const masca = new Uint8Array((w - 1) * (h - 1));
  let nrCelule = 0;
  let cMin = w, cMax = -1, rMin = h, rMax = -1;
  for (let r = 0; r < h - 1; r++) {
    for (let c = 0; c < w - 1; c++) {
      // Decizia se ia pe centrul celulei, nu pe un colț: altfel o margine de
      // poligon care trece exact printre două rânduri ar păstra sau ar arunca
      // celula după colțul din stânga-sus, iar conturul ar ieși deplasat cu
      // jumătate de celulă într-o direcție.
      if (pastreaza && !pastreaza(X(c) + pasX / 2, Z(r) + pasZ / 2)) continue;
      if (taieApa && Y(r, c) <= cotaApa && Y(r, c + 1) <= cotaApa
                  && Y(r + 1, c) <= cotaApa && Y(r + 1, c + 1) <= cotaApa) continue;
      masca[r * (w - 1) + c] = 1;
      nrCelule++;
      if (c < cMin) cMin = c;
      if (c > cMax) cMax = c;
      if (r < rMin) rMin = r;
      if (r > rMax) rMax = r;
    }
  }

  // `let`, golite după ce intră în geometrie: `scrieTriunghi` le citește, deci
  // altfel ar sta în contextul închiderilor lângă `inaltimeLa` și `dispose`, iar
  // după dispose() cei ~73 MB ai ambelor plase ar rămâne în RAM cât trăiește
  // `globalThis.__scena`. Aceeași capcană ca la `grila` și la strat.
  const cus = optiuni.cusatura ?? null;
  const nrCusatura = cus ? cus.triunghiuri.length / 3 : 0;
  const neted = !!optiuni.neted;
  if (neted && cus && !(cus.normale && cus.culori))
    throw new Error('plasă netezită cu o fâșie de cusătură fără normale și culori pe vârfuri');
  let pozitii = new Float32Array((nrCelule * 2 + nrCusatura) * 9);
  let culori = new Uint16Array((nrCelule * 2 + nrCusatura) * 9);
  // Normala pe 8 biți cu semn, normalizați: 3 octeți pe vârf. Pentru lumina difuză
  // ajunge — eroarea de unghi e sub 0,5°, iar GPU-ul o interpolează și o normalizează.
  let normale = neted ? new Int8Array((nrCelule * 2 + nrCusatura) * 9) : null;
  // Câmpul nodurilor, numai pentru o plasă netezită; golit după buclă, ca stratul.
  let campN = null, campC = null;
  if (neted) ({ normale: campN, culori: campC } = campNeted(relief, { paleta, ndvi: optiuni.ndvi, culoare }).tot());

  let p = 0;
  let yMin = Infinity, yMax = -Infinity;
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();

  const scrieTriunghi = (a, b, c, ndviT) => {
    // Normala fațetei se calculează, dar NU se scrie nicăieri: îi trebuie doar
    // pantei, de unde iese culoarea. Vezi nota despre `flatShading` de mai jos.
    ab.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    ac.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    n.crossVectors(ab, ac).normalize();

    const panta = 1 - Math.abs(n.y);
    const alt = (a[1] + b[1] + c[1]) / 3;
    const hex = culoareFateta(panta, alt, paleta, ndviT, culoare);
    const cr = Math.round(SPRE_LINIAR[(hex >> 16) & 255] * CUANTA);
    const cg = Math.round(SPRE_LINIAR[(hex >> 8) & 255] * CUANTA);
    const cb = Math.round(SPRE_LINIAR[hex & 255] * CUANTA);

    for (const v of [a, b, c]) {
      pozitii[p] = v[0]; pozitii[p + 1] = v[1]; pozitii[p + 2] = v[2];
      culori[p] = cr; culori[p + 1] = cg; culori[p + 2] = cb;
      p += 3;
      if (v[1] < yMin) yMin = v[1];
      if (v[1] > yMax) yMax = v[1];
    }
  };

  // Un vârf al plasei netezite: normala și culoarea vin din tablourile N și C, la
  // indicele `i` — nodul grilei sau vârful fâșiei.
  const scrieVarfNeted = (v, i, N, C) => {
    pozitii[p] = v[0]; pozitii[p + 1] = v[1]; pozitii[p + 2] = v[2];
    culori[p] = C[i * 3]; culori[p + 1] = C[i * 3 + 1]; culori[p + 2] = C[i * 3 + 2];
    normale[p] = N[i * 3]; normale[p + 1] = N[i * 3 + 1]; normale[p + 2] = N[i * 3 + 2];
    p += 3;
    if (v[1] < yMin) yMin = v[1];
    if (v[1] > yMax) yMax = v[1];
  };
  const scrieNeted = (a, b, c, ia, ib, ic, N, C) => {
    scrieVarfNeted(a, ia, N, C); scrieVarfNeted(b, ib, N, C); scrieVarfNeted(c, ic, N, C);
  };

  for (let r = 0; r < h - 1; r++) {
    for (let c = 0; c < w - 1; c++) {
      if (!masca[r * (w - 1) + c]) continue;

      const A = [X(c), Y(r, c), Z(r)];
      const B = [X(c + 1), Y(r, c + 1), Z(r)];
      const C = [X(c), Y(r + 1, c), Z(r + 1)];
      const D = [X(c + 1), Y(r + 1, c + 1), Z(r + 1)];
      const iA = r * w + c, iB = iA + 1, iC = iA + w, iD = iC + 1;   // nodurile, pentru strat

      // Alegem diagonala cu diferența de nivel mai mică. Contează la faleză: o
      // diagonală fixă ar tăia linia peretelui în zigzag și ar înclina o fațetă
      // peste treaptă, întinzând-o.
      if (Math.abs(A[1] - D[1]) <= Math.abs(B[1] - C[1])) {
        if (neted) { scrieNeted(A, C, D, iA, iC, iD, campN, campC); scrieNeted(A, D, B, iA, iD, iB, campN, campC); continue; }
        scrieTriunghi(A, C, D, ndviFateta(iA, iC, iD));
        scrieTriunghi(A, D, B, ndviFateta(iA, iD, iB));
      } else {
        if (neted) { scrieNeted(A, C, B, iA, iC, iB, campN, campC); scrieNeted(C, D, B, iC, iD, iB, campN, campC); continue; }
        scrieTriunghi(A, C, B, ndviFateta(iA, iC, iB));
        scrieTriunghi(C, D, B, ndviFateta(iC, iD, iB));
      }
    }
  }
  coduri = null;
  niveluri = null;
  campN = null;
  campC = null;

  // Fâșia de cusătură, dacă a venit: aceleași fațete plate, aceeași regulă de
  // culoare; NDVI-ul fațetei e media vârfurilor care au valoare, ca la grilă.
  let xCusMin = Infinity, xCusMax = -Infinity, zCusMin = Infinity, zCusMax = -Infinity;
  if (cus) {
    const v = cus.varfuri, t = cus.triunghiuri, nd = cus.ndvi;
    const P = (k) => [v[k * 3], v[k * 3 + 1], v[k * 3 + 2]];
    for (let k = 0; k < t.length; k += 3) {
      const a = t[k], b = t[k + 1], c = t[k + 2];
      if (neted) { scrieNeted(P(a), P(b), P(c), a, b, c, cus.normale, cus.culori); continue; }
      let s = 0, m = 0;
      for (const q of [a, b, c]) if (nd[q] === nd[q]) { s += nd[q]; m++; }
      scrieTriunghi(P(a), P(b), P(c), m ? s / m : undefined);
    }
    for (let k = 0; k < v.length; k += 3) {
      if (v[k] < xCusMin) xCusMin = v[k];
      if (v[k] > xCusMax) xCusMax = v[k];
      if (v[k + 2] < zCusMin) zCusMin = v[k + 2];
      if (v[k + 2] > zCusMax) zCusMax = v[k + 2];
    }
  }

  const nrTriunghiuri = p / 9;
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.BufferAttribute(pozitii, 3));
  // Al treilea argument e `normalized`: GL împarte el însuși la 65535, deci în
  // shader ajung tot valori în [0, 1], exact ca înainte.
  geometrie.setAttribute('color', new THREE.BufferAttribute(culori, 3, true));
  if (neted) geometrie.setAttribute('normal', new THREE.BufferAttribute(normale, 3, true));
  pozitii = null;
  culori = null;
  normale = null;

  // NU există atribut `normal` — cu o excepție, plasele netezite (`neted`).
  //
  // Cu `flatShading: true`, shaderul lui r186 nu-l citește: sub `FLAT_SHADED`
  // varianta `vNormal` nici nu se declară, iar `normal_fragment_begin` calculează
  // `normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)))` — adică planul
  // fațetei, chiar lucrul pe care l-am fi scris noi. Pe o geometrie NEINDEXATĂ
  // cu normale de fațetă cele două sunt același plan, deci rezultatul nu se
  // schimbă, iar atributul dispare cu totul: 92 248 344 de octeți, din RAM și de
  // pe placă deodată.
  //
  // Nu s-a luat pe încredere din documentație: 150 de pixeli așezați pe o grilă
  // peste tot cadrul, aceeași cameră, același buffer, comparați cu varianta care
  // scria atributul — zero diferențe, abatere maximă 0 pe orice canal.
  //
  // Prețul, ca să fie spus: normala se calculează acum pe fragment, nu pe vârf.
  // Aici nu se simte — terenul e opac, desenat o dată, cu randare la cerere —
  // dar pe o scenă cu multă suprapunere ar fi altă socoteală.
  //
  // Excepția: nivelurile netezite ale împrejurimilor (`NIVELURI_NETEZITE`), cu fațete de
  // 12, 32 și 256 m. Plate, de la ~2 km se vedeau ca pete — fiecare fațetă cu lumina și
  // culoarea ei —, iar autorul a cerut relieful netezit. Acolo normala e pe nod
  // (`campNeted`), iar materialul are `flatShading: false`.

  // Sfera de încadrare se SCRIE, nu se calculează.
  //
  // `computeBoundingSphere()` mai face o trecere peste toate vârfurile — 56,8 ms
  // pe bază — deși marginile le știm deja din buclele de mai sus. Dar nu se poate
  // nici lăsa `null`: `WebGLRenderer` o calculează el însuși pe calea de sortare,
  // care e activă implicit, deci n-am fi economisit nimic, doar am fi mutat
  // costul în primul cadru. O punem noi, dintr-o cutie care cuprinde sigur tot
  // ce s-a scris.
  if (nrCelule > 0 || nrCusatura > 0) {
    // Cutia celulelor, unită cu a fâșiei de cusătură.
    geometrie.boundingBox = new THREE.Box3(
      new THREE.Vector3(Math.min(nrCelule ? X(cMin) : Infinity, xCusMin), yMin, Math.min(nrCelule ? Z(rMin) : Infinity, zCusMin)),
      new THREE.Vector3(Math.max(nrCelule ? X(cMax + 1) : -Infinity, xCusMax), yMax, Math.max(nrCelule ? Z(rMax + 1) : -Infinity, zCusMax)),
    );
    geometrie.boundingSphere = geometrie.boundingBox.getBoundingSphere(new THREE.Sphere());
  } else {
    geometrie.boundingBox = new THREE.Box3();
    geometrie.boundingSphere = new THREE.Sphere();
  }

  const materialPropriu = !optiuni.material;
  const material =
    optiuni.material ??
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: !neted });

  const obiect = new THREE.Mesh(geometrie, material);
  obiect.name = 'teren';
  obiect.matrixAutoUpdate = false; // nu se mișcă niciodată
  obiect.updateMatrix();

  let viu = true;

  return {
    obiect,
    nrTriunghiuri,

    /** Altitudinea (metri) în coordonate de scenă, interpolată biliniar. */
    inaltimeLa(x, z) {
      if (!viu) return 0;
      const fc = (x - dep.x) / pasX + (w - 1) / 2;
      const fr = (z - dep.z) / pasZ + (h - 1) / 2;
      const c0 = Math.max(0, Math.min(w - 2, Math.floor(fc)));
      const r0 = Math.max(0, Math.min(h - 2, Math.floor(fr)));
      const tx = Math.min(1, Math.max(0, fc - c0));
      const tz = Math.min(1, Math.max(0, fr - r0));
      const g = (r, c) => grila[r * w + c];
      const sus = g(r0, c0) + (g(r0, c0 + 1) - g(r0, c0)) * tx;
      const jos = g(r0 + 1, c0) + (g(r0 + 1, c0 + 1) - g(r0 + 1, c0)) * tx;
      return sus + (jos - sus) * tz;
    },

    dispose() {
      if (!viu) return; // schimbarea de capitol poate chema de două ori
      viu = false;
      geometrie.dispose();
      // `dispose()` eliberează numai bufferele de pe placă; tablourile JS rămân în
      // atribute, iar obiectul întors trăiește în `globalThis.__scena`. Scoase din
      // geometrie, nu le mai ține nimic. DUPĂ dispose(): altfel three n-ar mai
      // găsi atributele ca să le elibereze bufferele.
      geometrie.deleteAttribute('position');
      geometrie.deleteAttribute('color');
      if (neted) geometrie.deleteAttribute('normal');
      // Materialul se eliberează doar dacă l-am făcut noi; dacă a fost injectat,
      // e al apelantului. Fără texturi aici — culorile sunt pe vertecși.
      if (materialPropriu) material.dispose();
      obiect.removeFromParent(); // nu eliberează nimic singur, doar rupe legătura
      grila = null;
    },
  };
}
