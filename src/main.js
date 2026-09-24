// Punctul de intrare. Leagă scena de conținut — și atât.
//
// Textul e conținutul, scena îl servește. Dacă WebGL nu pornește, canvasul
// dispare și pagina rămâne o pagină, nu un ecran de eroare.
import { porneste } from './scene/scena.js';

const canvas = document.querySelector('#scena');
const continut = document.querySelector('#continut');
const subsol = document.querySelector('#surse');

/**
 * Atribuirea datelor. Relieful LiDAR și ortofotoul DGT sunt sub CC BY 4.0, care
 * cere numele autorului, licența și mențiunea că datele au fost schimbate —
 * oriunde se afișează. Subsolul apare numai când scena chiar le afișează: fără
 * WebGL, pagina nu arată nimic din ele și n-are ce atribui.
 *
 * Un rând scurt, care e el însuși atribuire întreagă — autor, licență,
 * „prelucrate" —, iar dedesubt, deschise la cerere, textele complete. Varianta
 * cu toate trei atribuirile afișate stătea, cu textul provizoriu de azi, chiar
 * în mijlocul ecranului, peste scenă. `<details>` se deschide și de la tastatură,
 * fără niciun cod.
 *
 * Textul vine din sidecaruri, nu e scris aici: se schimbă o dată cu datele.
 * `textContent`, nu `innerHTML`: sunt date, nu marcaj.
 */
function arataSurse(surse) {
  if (!subsol || !surse?.length) return;
  const el = (tag, text) => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };
  const unice = (cheie) => [...new Set(surse.map((s) => s[cheie]).filter(Boolean))];

  const rezumat = el('summary', `Date: © ${unice('producator').join(', ')} · ${unice('licenta').join(', ')} · prelucrate`);
  const lista = el('ul');
  for (const s of surse) lista.append(el('li', s.atributie));
  const nota = el('p', 'Prelucrate pentru această pagină: relieful decupat și reeșantionat, culorile terenului '
    + 'și indicele de vegetație derivate din ortofoto. Licența: ');
  const licenta = el('a', 'CC BY 4.0');
  licenta.href = 'https://creativecommons.org/licenses/by/4.0/';
  nota.append(licenta, '.');
  for (const p of unice('portal')) {
    const a = el('a', new URL(p).host);
    a.href = p;
    nota.append(' Datele: ', a, '.');
  }
  const detalii = el('details');
  detalii.append(rezumat, lista, nota);
  subsol.replaceChildren(detalii);
  subsol.hidden = false;
}

function faraScena(motiv) {
  canvas?.remove();
  document.body.dataset.scena = 'indisponibila';
  console.info('Pagina rulează fără scenă 3D:', motiv);
}

// Textul ÎNAINTE de scenă, nu după.
//
// Blocul ăsta stătea sub `try`, deci prima vopsire aștepta 4 225 774 de octeți
// de relief și construirea a 1,36 milioane de triunghiuri. Principiul
// proiectului spune că textul e conținutul și scena îl servește; codul spunea
// invers. Mutat aici, nu mai așteaptă nimic.
if (continut && !continut.textContent.trim()) {
  continut.innerHTML =
    '<p class="provizoriu">Textul capitolelor se adaugă la pasul următor.</p>';
}

try {
  const scena = await porneste(canvas);
  if (!scena) {
    faraScena('WebGL indisponibil');
  } else {
    document.body.dataset.scena = 'activa';
    arataSurse(scena.surse);
    // Linia de bază pentru verificările de memorie de mai târziu.
    console.info('scenă pornită —', scena.nrTriunghiuri, 'triunghiuri',
      scena.petic ? `(bază ${scena.teren.nrTriunghiuri} + petic ${scena.petic.nrTriunghiuri})` : '',
      scena.memorie());
    globalThis.__scena = scena; // cârlig pentru verificare din consolă
  }
} catch (e) {
  faraScena(e.message);
}
