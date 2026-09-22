// Paleta măsurată: din culorile grupate + etichetele omului, o culoare pe material.
//
//   npm run paleta
//
// Ultimul pas al lanțului: citeste-poze → culori-poze → (etichetat de om) → paleta.
// Scrie public/data/paleta-teren.json, singurul rezultat din lanț care intră în
// depozit, fiindcă pagina îl încarcă.
//
// Problema pe care o rezolvă scriptul, și care nu e evidentă: o fotografie nu
// măsoară culoarea unui material, ci culoarea lui ÎNMULȚITĂ cu lumina care cădea
// pe el. Calcarul a ieșit în trei grupuri — #585a5a, #767067, #a89f99 — care nu
// sunt trei pietre, ci aceeași piatră în umbră, la umbră deschisă și în soare.
// Media lor ar fi o valoare care nu există nicăieri pe promontoriu.
//
// Contează fiindcă three.js înmulțește culoarea vârfului cu propria lui lumină.
// Dacă umbra e deja coaptă în culoare, se înmulțește a doua oară și faleza iese
// neagră. Ce trebuie pus în vârf e albedoul — cum arată materialul în lumină
// plină — iar umbrele le pune scena.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cereFisier } from './comun/cere.mjs';

const DIR = 'date-sursa/poze';
const DIR_ORTO = 'date-sursa/ortofoto';
// `public/` înseamnă „ce servește pagina", iar `paleta-teren.json` chiar se
// încarcă în browser. Raportul de ortofoto NU: e intrare pentru pasul ăsta,
// deci stă lângă datele-sursă, de unde îl și scrie `ortofoto.mjs`. Au stat
// amândouă sub aceeași constantă, iar unul dintre ele ajungea livrat
// vizitatorului degeaba.
const IESIRE = 'public/data';
const PRAG_LUMINA = 0.8;   // cuantila de luminozitate luată drept „în soare"
const PRAG_CROMA = 0.02;   // sub atât, nuanța măsurată nu mai înseamnă nimic

// Din ce sursă se ia culoarea fiecărui material, și de ce.
//
// Cele două surse sunt oarbe una acolo unde cealaltă vede, și nu e o chestiune
// de preferință, ci de geometrie:
//
//   - Fotografiile de la sol măsoară bine numai ce era aproape de aparat. Tot ce
//     era peste golf a venit prin kilometri de aer, care împrăștie albastrul și
//     spală culoarea. Se vede în cifre: tufărișul avea B > G în poze și G > B în
//     ortofoto, cu croma dublă.
//   - Ortofotoul n-are drumul acela de aer, dar privește drept în jos, deci vede
//     o suprafață verticală din muchie. Cu cât peretele e mai drept, cu atât mai
//     puțini pixeli pe metru pătrat de rocă.
//
// Deci: platoul de la ortofoto, faleza și ce-ai avut sub picioare din fotografii.
const SURSA = {
  poteca: 'fotografii',        // sub picioare, la un metru de lentilă: fără aer între
  calcar: 'fotografii',        // peretele falezei, pe care privirea de sus îl vede din muchie
  tufaris: 'ortofoto',         // peste golf în poze; de sus, fără ceață
  vegetatie_uscata: 'ortofoto',
  mare: 'fotografii',          // ortofotoul n-are clasă de apă
  cer: 'fotografii',           // nu apare deloc în ortofoto
};

// Materialele care sunt teren; restul sunt fundal de scenă.
// `poteca` a fost etichetată întâi `plaja`. Reașezată după ce datele au arătat că
// apare aproape numai la unghi larg, în talpa cadrului și în niciun cadru la
// teleobiectiv — o plajă văzută de pe faleză ar fi apărut tocmai acolo. E solul
// de sub picioare, la 130 m pe platou, nu nisipul din golf. Distincția contează:
// cele două ar sta la capete opuse ale hărții pe verticală.
const TEREN = new Set(['calcar', 'tufaris', 'vegetatie_uscata', 'poteca']);

// ----------------------------------------------------------------- OKLab dus-întors

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gama = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function laOklab(R, G, B) {
  const r = linear(R / 255), g = linear(G / 255), b = linear(B / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function dinOklab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const rgb = [
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return rgb.map((c) => Math.round(Math.min(255, Math.max(0, gama(Math.min(1, Math.max(0, c))) * 255))));
}

const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Cuantila unei valori ponderate — media ar fi trasă de petice mari și întunecate. */
function cuantila(perechi, q) {
  const s = [...perechi].sort((a, b) => a.v - b.v);
  const total = s.reduce((t, p) => t + p.g, 0);
  let c = 0;
  for (const p of s) { c += p.g; if (c >= q * total) return p.v; }
  return s[s.length - 1].v;
}

// --------------------------------------------------------------------- main

const main = () => {
  cereFisier(join(DIR, 'culori.json'), 'culorile grupate', 'Rulează întâi: npm run culori-poze');
  cereFisier(join(DIR, 'etichete.json'), 'etichetele puse de om',
         'Deschide date-sursa/poze/culori.html, alege ce e fiecare grup, și scrie etichete.json.');
  const culori = JSON.parse(readFileSync(join(DIR, 'culori.json'), 'utf8'));
  const { repere } = JSON.parse(readFileSync(join(DIR, 'etichete.json'), 'utf8'));

  // Ortofotoul e opțional: lanțul trebuie să meargă și numai din fotografii,
  // fiindcă dala de 283 MB nu intră în depozit și cine clonează n-o are.
  let orto = {};
  try {
    orto = JSON.parse(readFileSync(join(DIR_ORTO, 'ortofoto-culori.json'), 'utf8')).clase;
    console.log('ortofoto găsit — îl folosesc pentru materialele pe care pozele le-au văzut de departe\n');
  } catch {
    console.log('fără ortofoto — paleta iese numai din fotografii\n');
  }

  // Reperele omului, în OKLab. Fiecare petic primește eticheta celui mai apropiat.
  //
  // Atribuirea se face pe culoare, nu pe numărul grupului: numărul e doar ordinea
  // de afișare și se schimbă dacă se schimbă pozele sau numărul de grupuri, pe
  // când culoarea e lucrul la care omul s-a uitat efectiv când a pus eticheta.
  const ancore = Object.entries(repere).map(([h, material]) => ({
    material, hex: h,
    oklab: laOklab(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))),
  }));

  // O etichetă pe care n-o cunoaștem trece mai jos drept `rol: 'fundal'`,
  // `sursa: 'fotografii'`, fără nicio eroare — iar dacă era de fapt un material
  // de teren scris altfel (`tufăriș verde` în loc de `tufaris`), culoarea lui
  // măsurată nu ajunge niciodată în hartă și nimeni nu află. De aceea se spune.
  const stiute = new Set([...TEREN, ...Object.keys(SURSA)]);
  const straine = [...new Set(ancore.map((a) => a.material))].filter((m) => !stiute.has(m));
  if (straine.length) {
    console.log(`ATENȚIE — etichete pe care nu le cunosc: ${straine.join(', ')}`);
    console.log(` Le trec drept fundal. Codurile așteptate: ${[...stiute].sort().join(', ')}.`);
    console.log(' Dacă una dintre ele era un material de teren scris altfel, culoarea lui');
    console.log(' nu va ajunge în paletă — iar terenul se va picta fără ea, fără nicio eroare.\n');
  }

  const peMaterial = new Map();
  let nrPetice = 0;
  for (const g of culori.grupuri)
    for (const p of g.petice) {
      let cel = ancore[0], md = Infinity;
      for (const a of ancore) { const d = dist2(p.oklab, a.oklab); if (d < md) { md = d; cel = a; } }
      if (!peMaterial.has(cel.material)) peMaterial.set(cel.material, []);
      peMaterial.get(cel.material).push(p);
      nrPetice++;
    }

  const totalG = [...peMaterial.values()].flat().reduce((s, p) => s + p.greutate, 0);
  const materiale = {};

  for (const [material, petice] of peMaterial) {
    const G = petice.reduce((s, p) => s + p.greutate, 0);
    const L = petice.map((p) => ({ v: p.oklab[0], g: p.greutate }));
    const lumina = cuantila(L, PRAG_LUMINA);
    const median = cuantila(L, 0.5);

    // Nuanța se ia numai de la peticele bine luminate. La umbră, lumina vine din
    // cer, care e albastru — umbra unei pietre calde nu e piatra mai închisă, e
    // piatra plus o dominantă rece. Amestecate, ar trage albedoul spre albastru.
    const luminate = petice.filter((p) => p.oklab[0] >= median);
    const GL = luminate.reduce((s, p) => s + p.greutate, 0);
    const A = luminate.reduce((s, p) => s + p.oklab[1] * p.greutate, 0) / GL;
    const B = luminate.reduce((s, p) => s + p.oklab[2] * p.greutate, 0) / GL;

    const albedo = dinOklab([lumina, A, B]);
    const croma = Math.hypot(A, B);

    const dinPoze = { culoare: hex(albedo), rgb: albedo, croma: +croma.toFixed(4) };
    const dinOrto = orto[material]
      ? { culoare: orto[material].culoare, rgb: orto[material].rgb, croma: orto[material].croma }
      : null;
    const sursa = dinOrto && SURSA[material] === 'ortofoto' ? 'ortofoto' : 'fotografii';
    const ales = sursa === 'ortofoto' ? dinOrto : dinPoze;

    materiale[material] = {
      culoare: ales.culoare,
      rgb: ales.rgb,
      sursa,
      de_ce: sursa === 'ortofoto'
        ? 'măsurat de sus: materialul e departe în fotografii, iar aerul dintre îi spală culoarea'
        : dinOrto
          ? 'măsurat de la sol: e fie sub picioare, fie o suprafață prea dreaptă ca privirea de sus s-o vadă'
          : 'numai din fotografii — ortofotoul n-are clasă pentru el',
      fotografii: dinPoze,
      ortofoto: dinOrto,
      rol: TEREN.has(material) ? 'teren' : 'fundal',
      oklab: { L: +lumina.toFixed(4), a: +A.toFixed(4), b: +B.toFixed(4) },
      masurat: {
        L_minim: +cuantila(L, 0.02).toFixed(3),
        L_median: +median.toFixed(3),
        L_lumina: +lumina.toFixed(3),
        croma: +croma.toFixed(4),
        // Sub pragul de cromă, nuanța măsurată e zgomot: materialul a fost
        // fotografiat numai la umbră sau se confundă cu altul la lumina aceea.
        nuanta_de_incredere: croma >= PRAG_CROMA,
      },
      pondere: +(G / totalG).toFixed(4),
      poze: new Set(petice.map((p) => p.poza)).size,
      petice: petice.length,
    };
  }

  const ordine = [...Object.keys(materiale)].sort((a, b) => materiale[b].pondere - materiale[a].pondere);

  console.log(`${nrPetice} petice din ${culori.grupuri.length} grupuri → ${ordine.length} materiale\n`);
  console.log(' material          ales      sursă        fotografii  ortofoto   rol');
  console.log(' ───────────────── ───────── ──────────── ─────────── ────────── ──────');
  for (const m of ordine) {
    const x = materiale[m];
    console.log(` ${m.padEnd(17)} ${x.culoare}   ${x.sursa.padEnd(12)} ${x.fotografii.culoare}     `
      + `${(x.ortofoto ? x.ortofoto.culoare : '—').padEnd(10)} ${x.rol}`);
  }

  const inca = ordine.filter((m) => materiale[m].sursa === 'fotografii' && !materiale[m].masurat.nuanta_de_incredere);
  if (inca.length) {
    console.log(`\nNuanță încă nesigură la: ${inca.join(', ')} (croma sub ${PRAG_CROMA}).`);
    console.log(' Fotografiile nu susțin nicio culoare anume acolo, iar ortofotoul nu le poate');
    console.log(' înlocui: sunt fie suprafețe prea drepte ca să le vadă de sus, fie fundal.');
    console.log(' Rămân cum au fost măsurate. Nu inventez o culoare.');
  }

  writeFileSync(join(IESIRE, 'paleta-teren.json'), JSON.stringify({
    generat: new Date().toISOString(),
    sursa: {
      nume: 'Fotografii proprii, Cabo Espichel',
      aparat: 'Google Pixel 8 Pro',
      poze: new Set([...peMaterial.values()].flat().map((p) => p.poza)).size,
      data: '2026-08-02, 11:48–13:31 ora locală',
      nota: 'O singură sesiune de fotografiat, deci o singură lumină — de aceea nu s-a mai făcut corecție de alb între poze.',
    },
    // Reperele se scriu și aici, nu doar în date-sursa/poze/etichete.json, fiindcă
    // acela e gitignorat. Etichetele nu sunt date descărcate de undeva: sunt
    // judecata omului care a fost acolo și s-a uitat la decupaje, singura bucată
    // din lanț care nu se poate reface automat. Fără ele în depozit, paleta n-ar
    // mai fi reproductibilă dintr-o clonă curată.
    repere,
    metoda: {
      spatiu: 'OKLab',
      albedo: `cuantila ${PRAG_LUMINA} a luminozității, ca să prindă materialul în soare, nu la umbră`,
      nuanta: 'media ponderată a peticelor peste mediana luminozității; umbra e albastră de la cer și ar falsifica nuanța',
      atribuire: 'fiecare petic ia eticheta reperului celui mai apropiat în OKLab',
      avertisment: `croma sub ${PRAG_CROMA} = nuanța nu e de încredere, materialul e practic neutru`,
    },
    materiale: Object.fromEntries(ordine.map((m) => [m, materiale[m]])),
  }, null, 1));

  console.log(`\nscris ${join(IESIRE, 'paleta-teren.json')}`);
};

main();
