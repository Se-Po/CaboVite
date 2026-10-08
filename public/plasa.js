// Plasa de siguranță a paginii: un script CLASIC, extern și scris fără nimic din JavaScript-ul
// modern, ca să ruleze și acolo unde modulul paginii nu pornește. Extern, nu inline: CSP-ul din
// vercel.json are `script-src 'self'`, fără 'unsafe-inline'.
//
// Un modul care nu se parsează — blocurile `static {}` din three pe Safari/iOS sub 16.4, un chunk
// lipsă după un deploy, un browser fără module — oprește tot graful, deci nu rulează nici
// try/catch-ul din main.js, nici calea fără scenă. Pagina rămânea pe fundalul gol, cu „Se încarcă
// harta 3D…” pe vecie.
//
// main.js își pune semnul (`__modulPornit`) la prima lui instrucțiune. Modulele fără `async`
// rulează înaintea lui DOMContentLoaded, deci înaintea lui `load`: dacă la `load` semnul lipsește,
// modulul n-a pornit deloc. Fără niciun temporizator — `load` așteaptă descărcarea modulului
// oricât de lentă ar fi rețeaua; încărcarea datelor de după e a gărzii pornirii (loaders.js).
(function () {
  'use strict';
  window.addEventListener('load', function () {
    if (window.__modulPornit) return;
    var corp = document.body;
    if (!corp || corp.hasAttribute('data-scena')) return;
    var canvas = document.getElementById('scena');
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    // Aceeași stare ca `faraScena()` din main.js: foaia de stil ascunde mesajul de încărcare.
    corp.setAttribute('data-scena', 'indisponibila');
    var continut = document.getElementById('continut');
    if (continut && !/\S/.test(continut.textContent)) {
      var p = document.createElement('p');
      p.textContent = 'Harta 3D nu a putut porni.';
      continut.appendChild(p);
    }
    if (window.console) console.info('Pagina rulează fără scenă 3D: modulul paginii n-a pornit');
  });
})();
