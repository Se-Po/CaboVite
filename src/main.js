// Punctul de intrare. Leagă scena de conținut — și atât.
//
// Textul e conținutul, scena îl servește. Dacă WebGL nu pornește, canvasul
// dispare și pagina rămâne o pagină, nu un ecran de eroare.
import { porneste } from './scene/scena.js';
import { SANCTUAR } from './content/sanctuar.js';
import { CLADIRI } from './content/cladiri.js';

// Semnul pentru plasa de siguranță (public/plasa.js): modulul a pornit. Prima instrucțiune —
// ajunge aici numai dacă tot graful lui s-a parsat și s-a evaluat —, înaintea oricărei
// așteptări. Fără el, la `load`, plasa trece pagina pe calea fără scenă.
globalThis.__modulPornit = true;

const canvas = document.querySelector('#scena');
const continut = document.querySelector('#continut');
const subsol = document.querySelector('#surse');

/**
 * Mesajul de încărcare (index.html), până la `data-scena` pe <body>: „Se încarcă harta 3D…”,
 * apoi, cât mai lipsește numai fotografia aeriană, „Se încarcă fotografia aeriană…” cu
 * procentul și butonul „Arată relieful acum”. Clicul nu mai așteaptă fotografia (`faraSatelit`):
 * harta se arată pe loc, pe Relief, iar Satelit rămâne de cerut din butonul lui. Preferința
 * salvată nu se schimbă — omul n-a ales Relief, a ales să nu mai aștepte.
 *
 * Cititorul de ecran aude numai schimbarea fazei: `role="status"` stă pe paragraf, iar
 * procentul, într-un `<span aria-hidden="true">`, nu se anunță la fiecare pas. O fracție venită
 * înaintea fazei — octeții curg și cât se compilează programele — se ține minte și se scrie
 * odată cu ea.
 */
const asteptare = (() => {
  const radacina = document.getElementById('incarcare');
  const mesaj = radacina?.querySelector('[role="status"]');
  const procent = mesaj?.querySelector('span');
  const buton = radacina?.querySelector('button');
  const iesire = new AbortController();
  let fotografie = false, cat = null;
  const scrie = () => { if (procent && fotografie && cat !== null) procent.textContent = `${cat}%`; };
  buton?.addEventListener('click', () => {
    buton.disabled = true;
    iesire.abort();
  });
  return {
    faraSatelit: iesire.signal,
    laIncarcare({ faza, fractie } = {}) {
      if (faza === 'fotografie' && !fotografie) {
        fotografie = true;
        mesaj?.replaceChildren('Se încarcă fotografia aeriană…', ...(procent ? [procent] : []));
        if (buton) buton.hidden = false;
      }
      if (Number.isFinite(fractie)) cat = Math.round(100 * Math.min(1, Math.max(0, fractie)));
      scrie();
    },
    /**
     * Harta e pe ecran: mesajul pleacă (main.css, după `data-scena`). Un focus rămas în el —
     * pe butonul apăsat, sau numai ajuns acolo cu Tab — ar cădea pe <body>; trece pe butonul
     * Satelit, de unde fotografia se poate cere sau lăsa.
     */
    laHarta() {
      if (!radacina?.contains(document.activeElement)) return;
      const satelit = document.querySelector('#straturi:not([hidden]) button:not([hidden])');
      if (satelit) satelit.focus();
      else document.activeElement.blur?.();
    },
  };
})();

/**
 * Atribuirea datelor. Relieful LiDAR și ortofotoul DGT sunt sub CC BY 4.0, care
 * cere numele autorului, licența și mențiunea că datele au fost schimbate —
 * oriunde se afișează. Subsolul apare numai când scena chiar le afișează: fără
 * WebGL, pagina nu arată nimic din ele și n-are ce atribui.
 *
 * În pagină rămâne un singur rând, fără fundal, în colțul de sus-stânga:
 * „© DGT · © Copernicus · © OpenStreetMap". E cât cer regulile OSM (OSMF, Attribution
 * Guidelines): atribuirea se vede fără niciun clic, iar „© OpenStreetMap" duce la
 * pagina lor de copyright. Tot restul — textul cerut de SNIG, atribuțiile
 * întregi, licențele, ce s-a prelucrat — stă într-o modală deschisă din „© DGT".
 * `<dialog>` nativ, cu `showModal()`: focusul rămâne înăuntru, Escape o închide,
 * iar pagina de dedesubt e inertă, fără niciun cod pentru asta.
 *
 * Atribuirile vin din sidecaruri; ce s-a prelucrat spune scena, fiindcă numai ea
 * știe ce a folosit. `textContent`, nu `innerHTML`: sunt date, nu marcaj.
 *
 * Nu aruncă. E chemată după ce scena a pornit; o excepție de aici ar ajunge în
 * `catch`-ul de mai jos, care scoate canvasul — și ar lăsa scena vie, cu bucla ei
 * și cei 73 MB de plasă, sub o pagină care pretinde că n-are scenă.
 */
function arataSurse(surse) {
  try {
    scrieSurse(surse);
  } catch (e) {
    console.warn('atribuirea datelor nu s-a putut afișa:', e.message);
  }
}

// Licențele cunoscute, cu textul lor oficial. Una necunoscută rămâne text simplu.
const LICENTE = {
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'ODbL 1.0': 'https://opendatacommons.org/licenses/odbl/1-0/',
};

const el = (tag, text) => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };

// Numele scurt al unui producător, pentru rândul vizibil: acronimul dintre
// paranteze („Direção-Geral do Território (DGT)" → „DGT"), „OpenStreetMap" pentru
// contribuitorii lui, altfel numele întreg.
// Dacă sursa își scrie singură numele scurt (`scurt` — Copernicus, al cărui producător
// e o frază întreagă), acela câștigă.
const numeScurt = (p, surse = []) => surse.find((s) => s.producator === p && s.scurt)?.scurt
  ?? p.match(/\(([^)]+)\)\s*$/)?.[1] ?? (/OpenStreetMap/.test(p) ? 'OpenStreetMap' : p);

/**
 * Rândul și modala se fac o singură dată. Scrierile de după — sursa Satelit cerută din
 * buton, după pornire — schimbă numai textele: o modală deschisă rămâne
 * deschisă, iar butonul nu-și pierde focusul.
 */
let dom = null;
function construiesteSubsol() {
  const buton = el('button');
  buton.type = 'button';
  buton.className = 'atribuire';
  buton.setAttribute('aria-haspopup', 'dialog');
  const legaturi = el('span');
  const rand = el('p');
  rand.className = 'rand';
  rand.append(buton, legaturi);

  const dialog = el('dialog');
  dialog.className = 'surse-modala';
  dialog.setAttribute('aria-labelledby', 'surse-titlu');
  // Închiderea la clic în afară, unde browserul o știe singur; mai jos, pentru rest.
  dialog.setAttribute('closedby', 'any');
  const titlu = el('h2', 'Sursele datelor');
  titlu.id = 'surse-titlu';
  const inchide = el('button', 'Închide');
  inchide.type = 'button';
  inchide.className = 'inchide';
  const antet = el('div');
  antet.className = 'antet';
  antet.append(titlu, inchide);
  const corp = el('div');
  corp.className = 'corp';
  // Învelișul acoperă tot dialogul, deci un clic pe dialogul însuși e pe fundal.
  const invelis = el('div');
  invelis.className = 'invelis';
  invelis.append(antet, corp);
  dialog.append(invelis);
  subsol.replaceChildren(rand, dialog);

  buton.addEventListener('click', () => dialog.showModal());
  inchide.addEventListener('click', () => dialog.close());
  // Safari nu readuce singur focusul pe butonul care a deschis-o.
  dialog.addEventListener('close', () => buton.focus());
  // Pe fundal numai dacă și apăsarea, și ridicarea au fost acolo: o selecție de
  // text trasă din modală până pe fundal nu o închide.
  let apasatPeFundal = false;
  dialog.addEventListener('pointerdown', (e) => { apasatPeFundal = e.target === dialog; });
  dialog.addEventListener('click', (e) => {
    if (apasatPeFundal && e.target === dialog) dialog.close();
    apasatPeFundal = false;
  });
  return { buton, legaturi, dialog, corp, inchide };
}

function scrieSurse(surse) {
  if (!subsol || !surse?.length) return;
  dom ??= construiesteSubsol();
  const unice = (cheie) => [...new Set(surse.map((s) => s[cheie]).filter(Boolean))];

  // Rândul vizibil. ODbL: „© OpenStreetMap" duce la pagina lor de copyright, dacă o
  // sursă are portalul acolo. Ceilalți producători sunt butonul care deschide modala.
  const portalOsm = (p) => surse.find((s) => s.producator === p && /openstreetmap\.org\/copyright/.test(s.portal ?? ''))?.portal;
  const producatori = unice('producator');
  // Două surse Copernicus — relieful și Sentinel-2 — au producători diferiți, dar
  // același nume scurt: în rând apare o dată.
  const altii = [...new Set(producatori.filter((p) => !portalOsm(p)).map((p) => `© ${numeScurt(p, surse)}`))];
  dom.buton.textContent = altii.length ? altii.join(' · ') : 'Sursele datelor';
  dom.buton.setAttribute('aria-label', `${dom.buton.textContent} — sursele și licențele`);
  // Legăturile se actualizează pe loc când sunt tot atâtea — de obicei, fiindcă
  // Satelit aduce tot o sursă DGT: una recreată și-ar pierde focusul.
  const osm = producatori.filter(portalOsm);
  const vechi = [...dom.legaturi.querySelectorAll('a')];
  if (vechi.length === osm.length) {
    osm.forEach((p, i) => { vechi[i].textContent = `© ${numeScurt(p)}`; vechi[i].href = portalOsm(p); });
  } else {
    dom.legaturi.replaceChildren(...osm.flatMap((p) => {
      const sep = el('span', ' · ');
      sep.setAttribute('aria-hidden', 'true');
      const a = el('a', `© ${numeScurt(p)}`);
      a.href = portalOsm(p);
      return [sep, a];
    }));
  }

  const lista = el('ul');
  // Metadatele SNIG ale datelor DGT cer, la orice publicare, și adaptată, textul
  // acesta, în portugheză. Se scrie o singură dată, oricâte surse DGT ar fi; `lang`
  // e pentru cititoarele de ecran, care altfel l-ar pronunța românește.
  if (surse.some((s) => /Direção-Geral do Território/.test(s.producator ?? ''))) {
    const dgt = el('li', 'Informação geográfica cedida pela Direção-Geral do Território');
    dgt.lang = 'pt';
    lista.append(dgt);
  }
  // O atribuire în altă limbă își spune limba (`lang`): cele Copernicus sunt în
  // engleză, iar o cititoare de ecran le-ar pronunța altfel românește.
  const li = (text, lang) => { const e = el('li', text); if (lang) e.lang = lang; return e; };
  for (const s of surse) lista.append(li(s.atributie, s.lang));
  // Clauza de răspundere a licenței Copernicus DEM, cerută lângă atribuire.
  for (const s of surse.filter((q, i) => q.raspundere && surse.findIndex((p) => p.raspundere === q.raspundere) === i))
    lista.append(li(s.raspundere, s.lang));
  // Aceeași prelucrare poate sta pe două surse — relieful împrejurimilor e și DGT,
  // și Copernicus —, iar o sursă le ține lipite cu „; ”. Se desfac, ca fiecare frază
  // să apară o dată.
  const prelucrari = [...new Set(surse.flatMap((s) => s.prelucrare?.split('; ') ?? []))];
  const nota = el('p', `Prelucrate pentru această pagină: ${prelucrari.join('; ')}. Licența: `);
  unice('licenta').forEach((l, i) => {
    if (i) nota.append(', ');
    const href = LICENTE[l] ?? surse.find((s) => s.licenta === l && s.licenta_url)?.licenta_url;
    if (!href) { nota.append(l); return; }
    const a = el('a', l);
    a.href = href;
    nota.append(a);
  });
  nota.append('.');
  for (const p of unice('portal')) {
    // Un portal scris fără schemă nu e un motiv să pierzi atribuirea: rămâne textul.
    let url;
    try { url = new URL(p); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    const a = el('a', url.host);
    a.href = url.href;
    nota.append(' Datele: ', a, '.');
  }
  // Un focus din conținutul care se rescrie ar cădea pe <body>, sub modală.
  if (dom.dialog.open && dom.corp.contains(document.activeElement)) dom.inchide.focus();
  dom.corp.replaceChildren(lista, nota);
  subsol.hidden = false;
}

// Fără scenă, pagina n-ar avea nimic de arătat până vin capitolele. Un anunț
// neutru: calea asta o iau WebGL-ul lipsă, o eroare la încărcare și bucla oprită
// după cadre eșuate la rând.
//
// `reincearca`: datele n-au mai sosit (garda pornirii, loaders.js). Atunci anunțul spune
// asta, iar butonul reîncarcă pagina — o rețea care a tăcut poate merge la a doua încercare.
function faraScena(motiv, { reincearca = false } = {}) {
  canvas?.remove();
  document.body.dataset.scena = 'indisponibila';
  // Pe ultima cale subsolul fusese scris, dar fără scenă n-are ce atribui. Modala se
  // închide întâi: altfel ar rămâne deschisă, modală, într-un subsol ascuns.
  if (dom?.dialog.open) dom.dialog.close();
  if (subsol) subsol.hidden = true;
  if (continut && !continut.textContent.trim()) {
    continut.append(el('p', reincearca ? 'Harta 3D nu a putut porni: datele hărții n-au mai sosit.' : 'Harta 3D nu a putut porni.'));
    if (reincearca) {
      const b = el('button', 'Reîncearcă');
      b.type = 'button';
      b.className = 'reincearca';
      b.addEventListener('click', () => location.reload());
      continut.append(b);
    }
  }
  console.info('Pagina rulează fără scenă 3D:', motiv);
}

// `let`, în afara lui `try`: `laEsec` o eliberează după ce a pornit.
let scena = null;
try {
  // `laSurse`: vederea Satelit își adaugă sursele când îi sosesc texturile. Pe calea automată
  // ele vin înaintea lui `data-scena` și intră în prima scriere a subsolului (`scena.surse`);
  // cerută din buton, după pornire, Satelit le adaugă când subsolul e deja scris: atunci se
  // scrie din nou.
  // `laEsec`: bucla s-a oprit după cadre eșuate la rând. Întâi `dispose()`, prin aceeași
  // listă ca la pornire, apoi calea fără scenă: `faraScena()` singur scoate numai
  // canvasul, iar bucla, plasa și ascultătorii ar rămâne vii. Canvasul e abandonat, deci
  // contextul se pierde și el, ca pe calea de eroare de la pornire: altfel ar rămâne viu,
  // cu bufferul de desen, cât trăiește pagina (canvasul e ținut de `canvas` și `__scena`).
  // `laIncarcare` și `faraSatelit`: mesajul de încărcare și ieșirea lui (`asteptare`, mai sus).
  scena = await porneste(canvas, {
    continut: { sanctuar: SANCTUAR, cladiri: CLADIRI },
    laSurse: (s) => { if (document.body.dataset.scena === 'activa') arataSurse(s); },
    laEsec: (e) => {
      const r = scena?.renderer;
      scena?.dispose();
      r?.forceContextLoss();
      faraScena(`cadre eșuate la rând: ${e?.message ?? e}`);
    },
    laIncarcare: asteptare.laIncarcare,
    faraSatelit: asteptare.faraSatelit,
  });
  if (!scena) {
    faraScena('WebGL indisponibil');
  } else {
    document.body.dataset.scena = 'activa';
    asteptare.laHarta();
    // Anunțurile scrise cât panourile erau ascunse — busola, eșecul fotografiei — se scriu din nou.
    scena.arata?.();
    arataSurse(scena.surse);
    // Linia de bază pentru verificările de memorie de mai târziu.
    console.info('scenă pornită —', scena.nrTriunghiuri, 'triunghiuri',
      scena.petic ? `(bază ${scena.teren.nrTriunghiuri} + petic ${scena.petic.nrTriunghiuri})` : '',
      scena.memorie(),
      scena.sanctuar ? `sanctuar: ${scena.sanctuar.nrTriunghiuri.cladiri} + ${scena.sanctuar.nrTriunghiuri.drapaj} pe teren` : '');
    globalThis.__scena = scena; // cârlig pentru verificare din consolă
  }
} catch (e) {
  faraScena(e.message, { reincearca: e?.name === 'TimeoutError' });
}
