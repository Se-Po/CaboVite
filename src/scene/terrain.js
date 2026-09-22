import * as THREE from 'three';
import { culoareTeren, paletaCurenta } from './palette.js';

// Terenul: din grila de înălțimi într-un singur mesh cu fațete plate.
//
// Funcție pură — primește datele, întoarce mesh-ul. Nu încarcă nimic și nu atinge
// rendererul, ca să rămână limpede cine cere randarea și cine tratează erorile.
//
// ───────────────────────────────────────────── ce NU se generează, și de ce
//
// Jumătate din celulele hărții sunt apă: toate patru nodurile la `zMin_m`, cota
// de umplutură pe care sidecarul o numește „artificiu de randare, nu batimetrie".
// Numărate din fișierele .bin: 477 166 din cele 907 427 de celule păstrate ale
// bazei (52,6%) și 122 858 din cele 373 800 ale peticului (32,9%).
//
// Marea e un plan OPAC de 40 km la −0,25 m, iar camera nu poate coborî sub el:
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
// de `Math.pow`, deși intrarea are 256 de valori posibile pe canal.

let avertizat = false;
const GRI_PROVIZORIU = 0x8a8578;

/**
 * sRGB → liniar, o dată pentru fiecare din cele 256 de valori posibile.
 *
 * `culoare.setHex(hex, SRGBColorSpace)` face trei `Math.pow` la fiecare apel, iar
 * apelul e unul pe fațetă: 2,56 milioane de fațete înseamnă 7,7 milioane de `pow`
 * la fiecare pornire a paginii. Intrarea are însă doar 256 de valori distincte pe
 * canal — e un octet.
 *
 * Tabelul e BIT-IDENTIC cu ce face three, nu doar apropiat: aceeași formulă din
 * `ColorManagement.SRGBToLinear`, pe aceeași intrare `octet / 255`. Verificat în
 * pagină, comparând cu `Color.setHex` însuși pe 0x8a8578, 0x24211c, 0x3d6b4c,
 * 0x9d958c, alb, negru și 0x010101: potrivire exactă pe toate șapte.
 *
 * Float64, nu Float32: valorile se înmulțesc mai jos cu 65535 înainte de
 * rotunjire, iar o rotunjire intermediară la float32 ar intra în cifra cuantizată.
 */
const SPRE_LINIAR = (() => {
  const t = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
  }
  return t;
})();

// Culoarea stă pe 16 biți normalizați, nu pe 32 în virgulă mobilă: 6 octeți pe
// vârf în loc de 12.
//
// Uint8 ar fi fost 3, dar nu merge, și se poate arăta de ce: valorile din atribut
// sunt LINIARE, iar un pas de 1/255 în liniar înseamnă la luminozitate mică vreo
// 2,5 niveluri de afișare — benzi vizibile tocmai pe faleza umbrită, unde scena
// are cel mai mult de spus. Pe 16 biți eroarea măsurată în pagină, față de ce
// scria codul dinainte, e 0,0005–0,0011 dintr-un nivel de afișare din 255.
const CUANTA = 65535;

function culoareFateta(panta, altitudine, paleta) {
  const c = culoareTeren(panta, altitudine, paleta);
  // `Math.floor`, ca `Color.setHex`: o culoare cu parte zecimală n-ar trebui să
  // se rotunjească altfel aici decât s-ar fi rotunjit acolo.
  if (typeof c === 'number' && Number.isFinite(c)) return Math.floor(c);
  if (!avertizat) {
    avertizat = true;
    console.warn('culoareTeren() nu întoarce încă o culoare — folosesc gri provizoriu.');
  }
  return GRI_PROVIZORIU;
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
 * @param {{latime,inaltime,pasX,pasZ,inaltimi,meta?}} relief — de la incarcaRelief()
 * @param {{material?: THREE.Material, pastreaza?: (x: number, z: number) => boolean,
 *          deplasare?: {x: number, z: number}, paleta?: object}} optiuni
 *   `pastreaza` primește centrul unei celule, în metri de scenă, și decide dacă
 *   ea intră în plasă. Așa capătă harta forma conturului cu care a fost extrasă
 *   (`poligon_scena` din sidecar) și așa se taie gaura de sub petic: celulele
 *   din afară nu se generează deloc, deci scade și numărul de triunghiuri.
 *   `deplasare` mută întreaga grilă în scenă — vezi comentariul de la `dep`.
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
  const dep = optiuni.deplasare ?? { x: 0, z: 0 };
  const X = (c) => (c - (w - 1) / 2) * pasX + dep.x;
  const Z = (r) => (r - (h - 1) / 2) * pasZ + dep.z;
  const Y = (r, c) => grila[r * w + c];

  // Paleta se primește, nu se ia singură din modul. Culorile se coc o singură
  // dată, aici, în atributul de vârf: dacă cineva ar chema creeazaTeren() înainte
  // ca `incarcaPaleta()` să fi terminat, terenul ar ieși tăcut cu culoarea de
  // rezervă, iar remedierea ar cere regenerarea întregii geometrii. Ca parametru,
  // răspunderea stă la apelant, care știe ce-a așteptat. `paletaCurenta()` rămâne
  // ca rezervă, ca fișierul să-și țină promisiunea din capul lui: funcție pură.
  const paleta = optiuni.paleta ?? paletaCurenta();
  const pastreaza = optiuni.pastreaza;

  // Cota de umplutură. Fără sidecar nu se taie nicio celulă de apă — mai bine
  // desenăm în plus decât să ștergem uscat pe baza unei presupuneri.
  const cotaApa = relief.meta?.zMin_m;
  const taieApa = Number.isFinite(cotaApa);

  // O SINGURĂ trecere de decizie, nu două.
  //
  // Înainte, `pastreaza` se chema o dată la numărat și încă o dată la scris:
  // 3 470 392 de apeluri pe bază, fiecare cu o buclă peste laturile poligonului.
  // Masca costă 1 735 196 de octeți temporari — 0,6% din ce alocă plasa — și
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

  const pozitii = new Float32Array(nrCelule * 2 * 9);
  const culori = new Uint16Array(nrCelule * 2 * 9);

  let p = 0;
  let yMin = Infinity, yMax = -Infinity;
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();

  const scrieTriunghi = (a, b, c) => {
    // Normala fațetei se calculează, dar NU se scrie nicăieri: îi trebuie doar
    // pantei, de unde iese culoarea. Vezi nota despre `flatShading` de mai jos.
    ab.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    ac.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    n.crossVectors(ab, ac).normalize();

    const panta = 1 - Math.abs(n.y);
    const alt = (a[1] + b[1] + c[1]) / 3;
    const hex = culoareFateta(panta, alt, paleta);
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

  for (let r = 0; r < h - 1; r++) {
    for (let c = 0; c < w - 1; c++) {
      if (!masca[r * (w - 1) + c]) continue;

      const A = [X(c), Y(r, c), Z(r)];
      const B = [X(c + 1), Y(r, c + 1), Z(r)];
      const C = [X(c), Y(r + 1, c), Z(r + 1)];
      const D = [X(c + 1), Y(r + 1, c + 1), Z(r + 1)];

      // Alegem diagonala cu diferența de nivel mai mică. Contează la faleză: o
      // diagonală fixă ar tăia linia peretelui în zigzag și ar înclina o fațetă
      // peste treaptă, întinzând-o.
      if (Math.abs(A[1] - D[1]) <= Math.abs(B[1] - C[1])) {
        scrieTriunghi(A, C, D);
        scrieTriunghi(A, D, B);
      } else {
        scrieTriunghi(A, C, B);
        scrieTriunghi(C, D, B);
      }
    }
  }

  const nrTriunghiuri = p / 9;
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.BufferAttribute(pozitii, 3));
  // Al treilea argument e `normalized`: GL împarte el însuși la 65535, deci în
  // shader ajung tot valori în [0, 1], exact ca înainte.
  geometrie.setAttribute('color', new THREE.BufferAttribute(culori, 3, true));

  // NU există atribut `normal`, și nu e o scăpare.
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

  // Sfera de încadrare se SCRIE, nu se calculează.
  //
  // `computeBoundingSphere()` mai face o trecere peste toate vârfurile — 56,8 ms
  // pe bază — deși marginile le știm deja din buclele de mai sus. Dar nu se poate
  // nici lăsa `null`: `WebGLRenderer` o calculează el însuși pe calea de sortare,
  // care e activă implicit, deci n-am fi economisit nimic, doar am fi mutat
  // costul în primul cadru. O punem noi, dintr-o cutie care cuprinde sigur tot
  // ce s-a scris.
  if (nrCelule > 0) {
    geometrie.boundingBox = new THREE.Box3(
      new THREE.Vector3(X(cMin), yMin, Z(rMin)),
      new THREE.Vector3(X(cMax + 1), yMax, Z(rMax + 1)),
    );
    geometrie.boundingSphere = geometrie.boundingBox.getBoundingSphere(new THREE.Sphere());
  } else {
    geometrie.boundingBox = new THREE.Box3();
    geometrie.boundingSphere = new THREE.Sphere();
  }

  const materialPropriu = !optiuni.material;
  const material =
    optiuni.material ??
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });

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
      // Materialul se eliberează doar dacă l-am făcut noi; dacă a fost injectat,
      // e al apelantului. Fără texturi aici — culorile sunt pe vertecși.
      if (materialPropriu) material.dispose();
      obiect.removeFromParent(); // nu eliberează nimic singur, doar rupe legătura
      grila = null;
    },
  };
}
