import { STARE } from './camera.js';
import { creeazaCadruLiber } from './cadru-liber.js';

// Cadrul camerei cât e deschisă fișa sanctuarului.
//
// Cât fișa e deschisă, imaginea se mută în partea de ecran pe care n-o acoperă:
// pe telefon fișa e foaie jos și acoperă peste jumătate, pe desktop stă la
// dreapta. Un decalaj de obiectiv (`setViewOffset`), nu altă țintă: camera și
// pivotul rămân unde le-a pus zborul, deci rozeta, raza panoului punctului și
// proiecția etichetei merg neschimbate — toate citesc matricea de proiecție. Decalajul
// îl aplică cadru-liber.js, cu cutia „Coordonate” deschisă scăzută și ea din partea
// liberă; zborul încadrează complexul în ce rămâne.
//
// La redimensionare — telefonul rotit, fereastra trasă — decalajul se reface
// mereu. Distanța, numai dacă trebuie să CREASCĂ cu peste 10%: din peisaj în
// portret partea liberă devine foaia îngustă de deasupra fișei, iar cu distanța
// de la deschidere biserica ieșea din ecran (844 × 390 → 390 × 844: ancora
// etichetei la x = −18, 48 din 64 de puncte ale complexului afară). Invers, din
// portret în peisaj, camera stă doar mai departe decât ar trebui: nu se mișcă
// degeaba. Pragul ține pe loc și bara de adrese, care schimbă înălțimea cu câteva
// procente. Și numai cât utilizatorul n-a atins controalele de la deschidere:
// după orice atingere camera e a lui, ca la zbor.
//
// Stă separat de scena.js ca `verifica-sanctuar` să ruleze același cod, în Node.

/** ~110 m de la centrul terreiro-ului până la biserică și la capetele aripilor. */
export const RAZA_COMPLEX = 110;
/** La redimensionare, un zbor nou numai dacă distanța cerută o întrece pe cea de acum de atâtea ori. */
export const PRAG_ZBOR_NOU = 1.1;

/**
 * Partea de canvas pe care n-o acoperă fișa, în fracțiuni din lățime și înălțime.
 * @param {{left: number, top: number, width: number}|undefined} fisa  cutia fișei
 * @param {{left: number, top: number, width: number, height: number}} c  cutia canvasului
 */
export function parteLibera(fisa, c) {
  const L = { x0: 0, x1: 1, y0: 0, y1: 1 };
  if (fisa && c.width && c.height) {
    if (fisa.width >= 0.8 * c.width && fisa.top > c.top + 0.25 * c.height) L.y1 = Math.min(1, (fisa.top - c.top) / c.height);
    // Laterală până la trei sferturi din lățime: între 545 și 666 px fișa trece de
    // 60% — și mai mult cu textul mărit —, iar un prag la 40% lăsa complexul sub
    // ea. Peste trei sferturi nu mai rămâne loc în care să încapă ceva.
    else if (fisa.left > c.left + 0.25 * c.width) L.x1 = Math.min(1, (fisa.left - c.left) / c.width);
  }
  return L;
}

/**
 * Distanța zborului: cel puțin cât cere punctul de privire, și destul ca complexul
 * să încapă în partea liberă, pe lățime și pe înălțime.
 * @param {{distanta: number}} poi  punctul de privire al sanctuarului
 * @param {{fov: number, aspect: number}} camera
 * @param {{x0: number, x1: number, y0: number, y1: number}} L  partea liberă
 */
export function distantaLaFisa(poi, camera, L) {
  const t = Math.tan((camera.fov * Math.PI) / 360);
  return Math.max(poi.distanta, RAZA_COMPLEX / (t * camera.aspect * (L.x1 - L.x0)), (0.6 * RAZA_COMPLEX) / (t * (L.y1 - L.y0)));
}

/**
 * @param {{camera, controale, zbor, poi: {tinta: number[], distanta: number, azimut: number, elevatie: number},
 *          canvas: {clientWidth: number, clientHeight: number, getBoundingClientRect: () => object},
 *          cutieFisa: () => object|undefined, cereRandare: () => void, cadru?: object}} o
 *   `cutieFisa`: cutia fișei de acum; se cere numai cât fișa e deschisă. `cadru`: cadrul liber
 *   al scenei (cadru-liber.js), comun cu panoul punctului; fără el, unul numai al fișei.
 */
export function creeazaCadruFisa({ camera, controale, zbor, poi, canvas, cutieFisa, cereRandare, cadru = null }) {
  const liber = cadru ?? creeazaCadruLiber({ camera, canvas, cereRandare });
  let decalaj = null; // fracțiunile părții libere de fișă, sau null cât fișa e închisă
  // Utilizatorul a atins controalele de la deschidere: mutare, rotire, rotiță, deget.
  // `start` îl emit toate; zborul nu-l emite.
  let atins = false;
  // Distanța cerută ultimului zbor. Cât zborul e încă în aer, ea e locul spre care
  // merge camera, nu distanța de acum, care trece prin tot drumul de la pornire.
  let ceruta = 0;
  const laStart = () => { atins = true; };
  controale.addEventListener('start', laStart);

  const potriveste = (fisa) => {
    decalaj = parteLibera(fisa, canvas.getBoundingClientRect());
    liber.seteazaFisa(decalaj);
  };
  // Distanța, pe partea liberă de tot: pe telefon, cutia „Coordonate” deschisă poate
  // trece de marginea de sus a foii.
  const zboara = () => {
    ceruta = distantaLaFisa(poi, camera, liber.parte());
    zbor.spre({ ...poi, distanta: ceruta });
  };

  return {
    /** Fișa tocmai s-a deschis: întâi locul ei, apoi zborul, care are nevoie de el. */
    laDeschidere(fisa) {
      atins = false;
      potriveste(fisa);
      zboara();
    },
    laInchidere() {
      decalaj = null;
      liber.seteazaFisa(null);
    },
    /** Canvasul și-a schimbat mărimea, iar `camera.aspect` e deja cel nou. */
    laRedimensionare() {
      if (!decalaj) return;
      potriveste(cutieFisa());
      // Un gest în curs nu se bate cu un zbor. `atins` îl acoperă deja — orice gest
      // început după deschidere a emis `start`, iar zborul deschiderii l-a încheiat pe
      // cel de dinainte (`incheieGestul`) —; starea e a doua gardă, ieftină.
      if (atins || controale.state !== STARE.NIMIC) return;
      const acum = zbor.activ ? ceruta : camera.position.distanceTo(controale.target);
      if (distantaLaFisa(poi, camera, liber.parte()) > PRAG_ZBOR_NOU * acum) zboara();
    },
    get deschisa() { return decalaj !== null; },
    get atins() { return atins; },
    dispose() {
      controale.removeEventListener('start', laStart);
      decalaj = null;
      if (!cadru) liber.dispose();
    },
  };
}
