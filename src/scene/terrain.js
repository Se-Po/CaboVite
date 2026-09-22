import * as THREE from 'three';
import { culoareTeren, paletaCurenta } from './palette.js';

// Terenul: din grila de înălțimi într-un singur mesh cu fațete plate.
//
// Funcție pură — primește datele, întoarce mesh-ul. Nu încarcă nimic și nu atinge
// rendererul, ca să rămână limpede cine cere randarea și cine tratează erorile.

let avertizat = false;
const GRI_PROVIZORIU = 0x8a8578;

function culoareFateta(panta, altitudine, paleta) {
  const c = culoareTeren(panta, altitudine, paleta);
  if (typeof c === 'number' && Number.isFinite(c)) return c;
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
 * @param {{latime,inaltime,pasX,pasZ,inaltimi}} relief — de la incarcaRelief()
 * @param {{material?: THREE.Material, pastreaza?: (x: number, z: number) => boolean,
 *          deplasare?: {x: number, z: number}, paleta?: object}} optiuni
 *   `pastreaza` primește centrul unei celule, în metri de scenă, și decide dacă
 *   ea intră în plasă. Așa capătă harta forma conturului cu care a fost extrasă
 *   (`poligon_scena` din sidecar) și așa se taie gaura de sub petic: celulele
 *   din afară nu se generează deloc, deci scade și numărul de triunghiuri.
 *   `deplasare` mută întreaga grilă în scenă — vezi comentariul de la `dep`.
 */
export function creeazaTeren(relief, optiuni = {}) {
  const { latime: w, inaltime: h, pasX, pasZ, inaltimi } = relief;
  const latimeM = (w - 1) * pasX;
  const adancimeM = (h - 1) * pasZ;

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
  const Y = (r, c) => inaltimi[r * w + c];

  // Paleta se primește, nu se ia singură din modul. Culorile se coc o singură
  // dată, aici, în atributul de vârf: dacă cineva ar chema creeazaTeren() înainte
  // ca `incarcaPaleta()` să fi terminat, terenul ar ieși tăcut cu culoarea de
  // rezervă, iar remedierea ar cere regenerarea întregii geometrii. Ca parametru,
  // răspunderea stă la apelant, care știe ce-a așteptat. `paletaCurenta()` rămâne
  // ca rezervă, ca fișierul să-și țină promisiunea din capul lui: funcție pură.
  const paleta = optiuni.paleta ?? paletaCurenta();
  const pastreaza = optiuni.pastreaza;

  // Cu o selecție activă numărăm întâi celulele păstrate, abia apoi alocăm.
  // Trecerea în plus e ieftină — un test pe celulă — iar fără ea am aloca după
  // grila întreagă: pe zona de 1164 × 1493 înseamnă 250 MB de tablouri din care
  // 42% n-ar fi folosiți niciodată.
  let nrCelule = 0;
  if (pastreaza) {
    for (let r = 0; r < h - 1; r++)
      for (let c = 0; c < w - 1; c++)
        if (pastreaza(X(c) + pasX / 2, Z(r) + pasZ / 2)) nrCelule++;
  } else {
    nrCelule = (w - 1) * (h - 1);
  }

  const pozitii = new Float32Array(nrCelule * 2 * 9);
  const culori = new Float32Array(nrCelule * 2 * 9);

  let p = 0;
  const culoare = new THREE.Color();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();

  const scrieTriunghi = (a, b, c) => {
    // Normala fațetei — o calculăm oricum pentru culoare, deci nu mai cerem
    // computeVertexNormals() să o redescopere.
    ab.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    ac.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    n.crossVectors(ab, ac).normalize();

    const panta = 1 - Math.abs(n.y);
    const alt = (a[1] + b[1] + c[1]) / 3;
    culoare.setHex(culoareFateta(panta, alt, paleta), THREE.SRGBColorSpace);

    for (const v of [a, b, c]) {
      pozitii[p] = v[0]; pozitii[p + 1] = v[1]; pozitii[p + 2] = v[2];
      culori[p] = culoare.r; culori[p + 1] = culoare.g; culori[p + 2] = culoare.b;
      p += 3;
    }
  };

  for (let r = 0; r < h - 1; r++) {
    for (let c = 0; c < w - 1; c++) {
      // Decizia se ia pe centrul celulei, nu pe un colț: altfel o margine de
      // poligon care trece exact printre două rânduri ar păstra sau ar arunca
      // celula după colțul din stânga-sus, iar conturul ar ieși deplasat cu
      // jumătate de celulă într-o direcție.
      if (pastreaza && !pastreaza(X(c) + pasX / 2, Z(r) + pasZ / 2)) continue;

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
  geometrie.setAttribute('color', new THREE.BufferAttribute(culori, 3));
  geometrie.computeVertexNormals(); // pe geometrie neindexată → normala fațetei
  geometrie.computeBoundingSphere();

  const materialPropriu = !optiuni.material;
  const material =
    optiuni.material ??
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });

  const obiect = new THREE.Mesh(geometrie, material);
  obiect.name = 'teren';
  obiect.matrixAutoUpdate = false; // nu se mișcă niciodată
  obiect.updateMatrix();

  let viu = true;
  let grila = inaltimi;

  return {
    obiect,
    limite: { latimeM, adancimeM, zMin: Math.min(...[0]), zMax: 0 },
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
