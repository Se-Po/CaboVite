// Punctul de intrare. Leagă scena de conținut — și atât.
//
// Textul e conținutul, scena îl servește. Dacă WebGL nu pornește, canvasul
// dispare și pagina rămâne o pagină, nu un ecran de eroare.
import { porneste } from './scene/scena.js';

const canvas = document.querySelector('#scena');
const continut = document.querySelector('#continut');

function faraScena(motiv) {
  canvas?.remove();
  document.body.dataset.scena = 'indisponibila';
  console.info('Pagina rulează fără scenă 3D:', motiv);
}

try {
  const scena = await porneste(canvas);
  if (!scena) {
    faraScena('WebGL indisponibil');
  } else {
    document.body.dataset.scena = 'activa';
    // Linia de bază pentru verificările de memorie de mai târziu.
    console.info('scenă pornită —', scena.nrTriunghiuri, 'triunghiuri',
      scena.petic ? `(bază ${scena.teren.nrTriunghiuri} + petic ${scena.petic.nrTriunghiuri})` : '',
      scena.memorie());
    globalThis.__scena = scena; // cârlig pentru verificare din consolă
  }
} catch (e) {
  faraScena(e.message);
}

if (continut && !continut.textContent.trim()) {
  continut.innerHTML =
    '<p class="provizoriu">Textul capitolelor se adaugă la pasul următor.</p>';
}
