// Capitolul sanctuarului: faptele despre Santuário de Nossa Senhora do Cabo Espichel, fiecare
// cu sursele ei, ca DOM. Textul, ca date, stă în src/content/sanctuar.js.
//
// Numai DOM, fără three: îl folosesc și eticheta de pe hartă, și pagina fără scenă. Două forme
// ale aceluiași text, din același cod:
//   - fișa etichetei (`creeazaFisa`, chemată de eticheta.js): un dialog nemodal, cu butonul
//     „Închide”, nota despre model și id-urile pe care le citesc eticheta (`aria-controls`),
//     foaia de stil și scena (cutia fișei, pentru zbor);
//   - capitolul din pagină (`init`, chemat de main.js pe calea fără scenă): titlul și faptele,
//     în `#continut`, după anunțul că harta n-a pornit. Fără id-uri: calea fără scenă poate
//     veni și după ce scena a pornit — o excepție de după `porneste()` lasă eticheta vie —, iar
//     id-urile ar ieși duble. Fără nota despre model: ea descrie harta, pe care pagina atunci
//     n-o arată.
//
// Plasa de siguranță (public/plasa.js) nu-l poate folosi: e un script clasic, care rulează
// tocmai când modulele paginii nu pornesc. Ea scrie numai propoziția.

const el = (tag, props = {}, text) => { const e = document.createElement(tag); Object.assign(e, props); if (text) e.textContent = text; return e; };

/** Un rând al listei: textul, apoi sursele, ca legături despărțite de „; ”. */
const cuSursa = (text, surse) => {
  const li = el('li', {}, text + ' ');
  const s = el('span', { className: 'sursa' });
  surse.forEach((q, k) => {
    if (k) s.append('; ');
    const a = el('a', { href: q.url, rel: 'noopener', target: '_blank' }, q.nume);
    s.append(a);
  });
  li.append(s);
  return li;
};

/** Faptele, apoi locurile în care sursele se contrazic, fiecare cu sursele lui. */
export function listaFaptelor(continut) {
  const lista = el('ul');
  for (const f of continut.fapte) lista.append(cuSursa(f.text, f.surse ?? [f.sursa]));
  for (const c of continut.conflicte ?? []) lista.append(cuSursa(c.text, c.surse));
  return lista;
}

/**
 * Fișa etichetei, ascunsă. Cine o cere o pune în pagină și îi leagă butonul „Închide”.
 * @returns {{fisa: HTMLElement, titlu: HTMLElement, inchide: HTMLButtonElement}}
 */
export function creeazaFisa(continut) {
  const fisa = el('section', { id: 'sanctuar-fisa', hidden: true });
  fisa.setAttribute('role', 'dialog');
  fisa.setAttribute('aria-modal', 'false');
  fisa.setAttribute('aria-labelledby', 'sanctuar-fisa-titlu');
  const titlu = el('h2', { id: 'sanctuar-fisa-titlu', tabIndex: -1 }, continut.nume);
  const inchide = el('button', { type: 'button', className: 'inchide' }, 'Închide');
  fisa.append(inchide, titlu, listaFaptelor(continut), el('p', { className: 'model' }, continut.despre_model));
  return { fisa, titlu, inchide };
}

let capitol = null;

/**
 * Capitolul în pagină: `<section class="capitol-sanctuar">` cu titlul și faptele, la sfârșitul
 * lui `gazda`. Un `init()` nou îl înlocuiește pe cel de dinainte. Întoarce secțiunea, sau `null`
 * fără gazdă ori fără text.
 * @param {{gazda: HTMLElement, continut: object}} context
 */
export function init({ gazda, continut } = {}) {
  dispose();
  if (!gazda || !continut?.nume || !Array.isArray(continut.fapte)) return null;
  capitol = el('section', { className: 'capitol-sanctuar' });
  capitol.append(el('h2', {}, continut.nume), listaFaptelor(continut));
  gazda.append(capitol);
  return capitol;
}

/** Scoate capitolul din pagină; fără capitol, nimic. */
export function dispose() {
  capitol?.remove();
  capitol = null;
}
