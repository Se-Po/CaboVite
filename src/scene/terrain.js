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
// ținta nu coboară sub cota mării (cutia lui alpha), `minDistance` e 80 și
// `maxPolarAngle` e π/2 − 0,04, deci camera stă cu cel puțin 80 · sin 0,04 = 3,2 m
// peste țintă, deasupra mării. Triunghiurile acelea erau desenate la
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
  /** Culoarea nodului de uscat `i`, cu normala lui `v` deja calculată, ca trei valori liniare pe 16 biți. */
  const culoareUscat = (i, v, out, k) => {
    let nd;
    if (coduri) { const q = niveluri[(coduri[i >> 1] >> ((i & 1) << 2)) & 15]; nd = q === q ? q : undefined; }
    const hex = culoareFateta(1 - Math.abs(v[1]), Y[i], pal, nd, regula);
    out[k] = Math.round(SPRE_LINIAR[(hex >> 16) & 255] * CUANTA);
    out[k + 1] = Math.round(SPRE_LINIAR[(hex >> 8) & 255] * CUANTA);
    out[k + 2] = Math.round(SPRE_LINIAR[hex & 255] * CUANTA);
  };
  const scrieUscat = (r, c, out, k) => culoareUscat(r * w + c, normala(r, c), out, k);
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
  // Tamponul în care `uscat` scrie culoarea unui vecin: un singur tablou, nu două
  // noi la fiecare nod de apă. Valorile sunt întregi pe 16 biți, deci încap exact.
  const vecin = new Uint16Array(3);
  const scrieApa = (r, c, out, k, uscat, inele) => {
    let s0 = 0, s1 = 0, s2 = 0;
    for (let inel = 1; inel <= inele; inel++) {
      let m = 0;
      for (let dr = -inel; dr <= inel; dr++) for (let dc = -inel; dc <= inel; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== inel) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= h || cc < 0 || cc >= w || apa(rr * w + cc)) continue;
        uscat(rr, cc, vecin, 0);
        s0 += vecin[0]; s1 += vecin[1]; s2 += vecin[2]; m++;
      }
      if (m) { out[k] = Math.round(s0 / m); out[k + 1] = Math.round(s1 / m); out[k + 2] = Math.round(s2 / m); return true; }
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
     * deci rămâne cu zero, și normala, și culoarea — altfel marea întreagă și-ar căuta
     * uscatul pe opt inele. Apa e 62–78% din nodurile lui harta_v9, v7 și v8.
     *
     * Normala uscatului se calculează o singură dată, pentru ea și pentru culoare. Normalele
     * cerute la construcția împrejurimilor scad de la 645 357 la 158 789, cu aceleași
     * atribute la bit; proba e în `npm run verifica-imprejurimi`.
     */
    tot() {
      const normale = new Int8Array(w * h * 3), culori = new Uint16Array(w * h * 3);
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (apa(i)) continue;
        const v = normala(r, c);
        normale[i * 3] = Math.round(v[0] * 127); normale[i * 3 + 1] = Math.round(v[1] * 127); normale[i * 3 + 2] = Math.round(v[2] * 127);
        culoareUscat(i, v, culori, i * 3);
      }
      const dinTablou = (rr, cc, out, k) => { const j = (rr * w + cc) * 3; out[k] = culori[j]; out[k + 1] = culori[j + 1]; out[k + 2] = culori[j + 2]; };
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (apa(i) && scrieApa(r, c, culori, i * 3, dinTablou, 1)) scrieNormala(r, c, normale, i * 3);
      }
      return { normale, culori };
    },
  };
}

/**
 * Fațetele plate: celulele din `masca`, câte două triunghiuri, apoi fâșia de cusătură,
 * dacă a venit. Scrie în `pozitii` și `culori` de la început și întoarce câte valori a
 * scris și marginile pe verticală.
 *
 * Funcție de modul și numai cu scalari. Bucla de dinainte, o închidere în creeazaTeren,
 * făcea patru tablouri pe celulă și un tablou cu iterator pe fiecare triunghi; mutată
 * aici, baza se construiește mai repede, cu cifrele în CLAUDE.md („Cum se generează
 * plasa terenului”). Aritmetica e aceeași, operație cu operație — produsul vectorial și
 * `normalize()` din Vector3 r186, scrise de mână, `Xc`/`Zr` chiar valorile lui X(c) și
 * Z(r) —, deci atributele ies identice la bit: sha256-ul lor e probă în
 * `npm run verifica-teren` și `verifica-imprejurimi`.
 */
function plasaPlata(G, w, h, masca, Xc, Zr, cus, pozitii, culori, coduri, niveluri, paleta, culoare) {
  let p = 0, yMin = Infinity, yMax = -Infinity;
  // NDVI-ul fațetei: media nodurilor care AU valoare (NaN !== NaN: codul 0 nu intră).
  const ndviNod = (i) => niveluri[(coduri[i >> 1] >> ((i & 1) << 2)) & 15];
  const ndviFateta = (ia, ib, ic) => {
    if (!coduri) return undefined;
    let s = 0, n = 0;
    const a = ndviNod(ia), b = ndviNod(ib), c = ndviNod(ic);
    if (a === a) { s += a; n++; }
    if (b === b) { s += b; n++; }
    if (c === c) { s += c; n++; }
    return n ? s / n : undefined;
  };
  const fateta = (ax, ay, az, bx, by, bz, cx, cy, cz, ndviT) => {
    // Normala fațetei se calculează, dar NU se scrie nicăieri: îi trebuie doar
    // pantei, de unde iese culoarea. Vezi nota despre `flatShading` din creeazaTeren.
    // n = (B − A) × (C − A), apoi `normalize()`: împărțirea e o înmulțire cu 1 / lungime.
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const panta = 1 - Math.abs(ny * (1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1)));
    const hex = culoareFateta(panta, (ay + by + cy) / 3, paleta, ndviT, culoare);
    const cr = Math.round(SPRE_LINIAR[(hex >> 16) & 255] * CUANTA);
    const cg = Math.round(SPRE_LINIAR[(hex >> 8) & 255] * CUANTA);
    const cb = Math.round(SPRE_LINIAR[hex & 255] * CUANTA);
    pozitii[p] = ax; pozitii[p + 1] = ay; pozitii[p + 2] = az;
    pozitii[p + 3] = bx; pozitii[p + 4] = by; pozitii[p + 5] = bz;
    pozitii[p + 6] = cx; pozitii[p + 7] = cy; pozitii[p + 8] = cz;
    culori[p] = cr; culori[p + 1] = cg; culori[p + 2] = cb;
    culori[p + 3] = cr; culori[p + 4] = cg; culori[p + 5] = cb;
    culori[p + 6] = cr; culori[p + 7] = cg; culori[p + 8] = cb;
    p += 9;
    if (ay < yMin) yMin = ay;
    if (ay > yMax) yMax = ay;
    if (by < yMin) yMin = by;
    if (by > yMax) yMax = by;
    if (cy < yMin) yMin = cy;
    if (cy > yMax) yMax = cy;
  };

  for (let r = 0; r < h - 1; r++) {
    const z0 = Zr[r], z1 = Zr[r + 1];
    for (let c = 0; c < w - 1; c++) {
      if (!masca[r * (w - 1) + c]) continue;
      const iA = r * w + c, iB = iA + 1, iC = iA + w, iD = iC + 1;   // nodurile, pentru strat
      const x0 = Xc[c], x1 = Xc[c + 1];
      const yA = G[iA], yB = G[iB], yC = G[iC], yD = G[iD];
      // Alegem diagonala cu diferența de nivel mai mică. Contează la faleză: o
      // diagonală fixă ar tăia linia peretelui în zigzag și ar înclina o fațetă
      // peste treaptă, întinzând-o.
      if (Math.abs(yA - yD) <= Math.abs(yB - yC)) {
        fateta(x0, yA, z0, x0, yC, z1, x1, yD, z1, ndviFateta(iA, iC, iD));   // A, C, D
        fateta(x0, yA, z0, x1, yD, z1, x1, yB, z0, ndviFateta(iA, iD, iB));   // A, D, B
      } else {
        fateta(x0, yA, z0, x0, yC, z1, x1, yB, z0, ndviFateta(iA, iC, iB));   // A, C, B
        fateta(x0, yC, z1, x1, yD, z1, x1, yB, z0, ndviFateta(iC, iD, iB));   // C, D, B
      }
    }
  }

  // Fâșia de cusătură: aceleași fațete, aceeași regulă de culoare; NDVI-ul fațetei e
  // media vârfurilor care au valoare, ca la grilă.
  if (cus) {
    const v = cus.varfuri, t = cus.triunghiuri, nd = cus.ndvi;
    for (let k = 0; k < t.length; k += 3) {
      const a = t[k] * 3, b = t[k + 1] * 3, c = t[k + 2] * 3;
      const na = nd[t[k]], nb = nd[t[k + 1]], nc = nd[t[k + 2]];
      let s = 0, m = 0;
      if (na === na) { s += na; m++; }
      if (nb === nb) { s += nb; m++; }
      if (nc === nc) { s += nc; m++; }
      fateta(v[a], v[a + 1], v[a + 2], v[b], v[b + 1], v[b + 2], v[c], v[c + 1], v[c + 2], m ? s / m : undefined);
    }
  }
  return { p, yMin, yMax };
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

/** Cutia unui contur de patru puncte cu laturile pe rând orizontale și verticale, sau null. */
function dreptunghiAliniat(P) {
  if (!P || P.length !== 4) return null;
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4], c = P[(i + 2) % 4];
    const vertical = a.x === b.x && a.z !== b.z, orizontal = a.z === b.z && a.x !== b.x;
    // Latura următoare trebuie să fie cealaltă orientare.
    if (!(vertical ? b.z === c.z && b.x !== c.x : orizontal && b.x === c.x && b.z !== c.z)) return null;
  }
  const xs = P.map((q) => q.x), zs = P.map((q) => q.z);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
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

  // Un contur care e un dreptunghi aliniat la axe — al lui harta_v4 e chiar cutia —
  // se întreabă întâi pe interiorul lui STRICT: acolo inPoligon dă oricum adevărat
  // (o singură latură verticală la est de punct, cele orizontale nu se numără), deci
  // răspunsul nu se schimbă pentru niciun punct. Pe muchie și în afară decide tot el.
  const d = dreptunghiAliniat(limitaDatelor);
  const pastreaza = (limitaDatelor || subPetic)
    ? (x, z) => (!limitaDatelor || (d !== null && x > d.x0 && x < d.x1 && z > d.z0 && z < d.z1)
                 || inPoligon(x, z, limitaDatelor)) &&
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
 *   atunci să le aducă și ea, pe fiecare vârf (`normale`, `culori`). `camp` e
 *   câmpul gata calculat (`campNeted(...).tot()`); fără el se calculează aici.
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
  // Aceleași valori, o dată pe coloană și pe rând, pentru buclele fierbinți.
  const Xc = new Float64Array(w), Zr = new Float64Array(h);
  for (let c = 0; c < w; c++) Xc[c] = X(c);
  for (let r = 0; r < h; r++) Zr[r] = Z(r);

  // Paleta se primește, nu se ia singură din modul. Culorile se coc o singură
  // dată, aici, în atributul de vârf: dacă cineva ar chema creeazaTeren() înainte
  // ca `incarcaPaleta()` să fi terminat, terenul ar ieși tăcut cu culoarea de
  // rezervă, iar remedierea ar cere regenerarea întregii geometrii. Ca parametru,
  // răspunderea stă la apelant, care știe ce-a așteptat. `paletaCurenta()` rămâne
  // ca rezervă, ca fișierul să-și țină promisiunea din capul lui: funcție pură.
  const paleta = optiuni.paleta ?? paletaCurenta();
  const pastreaza = optiuni.pastreaza;
  const culoare = optiuni.culoare ?? culoareTeren;

  // Stratul NDVI, dacă a venit. Pe fațetă, media nodurilor care AU valoare
  // (`plasaPlata`): la mal un vârf e apă (codul 0, NaN la decodare), iar apa n-are
  // infraroșu de vegetație — media cu el ar trage fațeta de uscat spre rocă fără
  // temei. Nicio valoare → `undefined`, aceeași cale ca un strat lipsă.
  //
  // `let`, și golite imediat după buclă. Închiderile de mai jos — `inaltimeLa`,
  // `dispose` — țin viu tot contextul funcției, deci și orice tablou la care se
  // mai ajunge dintr-un nume de aici; e capcana de la `grila`. Stratul nu mai
  // folosește la nimic după ce culoarea s-a copt.
  let coduri = optiuni.ndvi?.coduri ?? null;
  let niveluri = optiuni.ndvi?.niveluri ?? null;

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
  //
  // Apa se întreabă ÎNAINTEA lui `pastreaza`: e un test pe patru noduri, pe când
  // `pastreaza` merge pe laturile conturului. Pe bază, apelurile scad de la
  // 1 735 196 la 774 562; proba e în `npm run verifica-teren`.
  const masca = new Uint8Array((w - 1) * (h - 1));
  let nrCelule = 0;
  let cMin = w, cMax = -1, rMin = h, rMax = -1;
  const G = grila;
  for (let r = 0; r < h - 1; r++) {
    // Decizia se ia pe centrul celulei, nu pe un colț: altfel o margine de
    // poligon care trece exact printre două rânduri ar păstra sau ar arunca
    // celula după colțul din stânga-sus, iar conturul ar ieși deplasat cu
    // jumătate de celulă într-o direcție.
    const zCentru = Zr[r] + pasZ / 2;
    for (let c = 0; c < w - 1; c++) {
      const i = r * w + c;
      if (taieApa && G[i] <= cotaApa && G[i + 1] <= cotaApa
                  && G[i + w] <= cotaApa && G[i + w + 1] <= cotaApa) continue;
      if (pastreaza && !pastreaza(Xc[c] + pasX / 2, zCentru)) continue;
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
  // Vine gata calculat (`optiuni.camp`, rezultatul lui `tot()`) când apelantul l-a
  // făcut deja pentru buclele cusăturii, din același relief, strat și regulă.
  let campN = null, campC = null;
  if (neted) ({ normale: campN, culori: campC } = optiuni.camp ?? campNeted(relief, { paleta, ndvi: optiuni.ndvi, culoare }).tot());

  let p = 0;
  let yMin = Infinity, yMax = -Infinity;

  if (!neted) {
    // Fațetele plate, grila și fâșia, într-o funcție de modul (vezi `plasaPlata`).
    ({ p, yMin, yMax } = plasaPlata(grila, w, h, masca, Xc, Zr, cus, pozitii, culori, coduri, niveluri, paleta, culoare));
  } else {
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
        const iA = r * w + c, iB = iA + 1, iC = iA + w, iD = iC + 1;

        // Aceeași diagonală ca la fațetele plate (`plasaPlata`).
        if (Math.abs(A[1] - D[1]) <= Math.abs(B[1] - C[1])) {
          scrieNeted(A, C, D, iA, iC, iD, campN, campC); scrieNeted(A, D, B, iA, iD, iB, campN, campC);
        } else {
          scrieNeted(A, C, B, iA, iC, iB, campN, campC); scrieNeted(C, D, B, iC, iD, iB, campN, campC);
        }
      }
    }
    if (cus) {
      const v = cus.varfuri, t = cus.triunghiuri;
      const P = (k) => [v[k * 3], v[k * 3 + 1], v[k * 3 + 2]];
      for (let k = 0; k < t.length; k += 3) {
        const a = t[k], b = t[k + 1], c = t[k + 2];
        scrieNeted(P(a), P(b), P(c), a, b, c, cus.normale, cus.culori);
      }
    }
  }
  coduri = null;
  niveluri = null;
  campN = null;
  campC = null;

  // Cutia fâșiei de cusătură, dacă a venit, pentru sfera de încadrare.
  let xCusMin = Infinity, xCusMax = -Infinity, zCusMin = Infinity, zCusMax = -Infinity;
  if (cus) {
    const v = cus.varfuri;
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
