// Împrejurimile zonei alpha: unde stau cele patru hărți și de unde vin datele lor.
//
// Un singur loc, citit de `surse-imprejurimi` (descarcă) și de `build-imprejurimi`
// (construiește): ce se descarcă trebuie să acopere exact ce se construiește.
//
// Toate grilele au nodurile pe metri IMPARI, ca harta_v4 (nodurile ei stau în
// centrele celulelor de 2 m ale dalelor DGT), și sunt ancorate în colțul de
// nord-est al nivelului dinăuntru. Coordonatele sunt TM06, în convenția „noduri”:
// `bbox_tm06` dă primul și ultimul nod, nu marginile celulelor.

/** Cutia lui harta_v4, ca în build-zona.mjs: muchii de celulă. */
export const CUTIE_ALPHA = { xMin: -95788, xMax: -93460, yMin: -139392, yMax: -136406 };
/** Nodurile de margine ale lui alpha. */
export const NODURI_ALPHA = { x0: -95787, x1: -93461, y0: -139391, y1: -136407 };

/**
 * Cele patru niveluri, de la cel dinăuntru spre orizont.
 *
 * harta_v6 — dalele DGT de 2 m dimprejurul lui alpha, decimate la 4 m: 406 m spre
 *   nord (până la y −136000) și 460 m spre est (până la x −93000); la vest și la sud
 *   e mare. Grila merge pe aceleași noduri ca alpha pe muchiile de nord și de est
 *   (−136407, −93461 sunt noduri ale ei).
 * harta_v9 — aceleași dale DGT de 2 m, plus cele 14 aduse de autor pe 2026-10-07
 *   (rândurile 165–166 și coloanele 107–108), la 12 m: banda până la y −134000 și
 *   x −91000, ~2,4 km dincolo de alpha. La 4 m ar fi costat ~1,4 milioane de
 *   triunghiuri; la 12 m, ~140 000. Pașii cresc 4 → 12 → 32 m, iar textura rămâne de
 *   2 m pe toată banda.
 * harta_v7 — Copernicus GLO-30, la 32 m, ~4,5 km dincolo de v9 spre nord și est,
 *   ~4 km spre vest și 3 km spre sud.
 * harta_v8 — Copernicus GLO-30, la 256 m, pe un disc de 50 km rază în jurul
 *   centrului lui alpha (`RAZA_V8`): dincolo de 24 km de cameră ceața scenei e
 *   completă, iar camera stă la cel mult ~9,6 km de centru, deci nimic din disc nu
 *   trece de planul îndepărtat (FAR, 60 km). Grila e pătratul care cuprinde discul.
 */
export const RAZA_V8 = 50000;

/** Indicii CCCRRR ai dalelor DGT de 1 km, pe coloane și rânduri. */
const dale = (cols, rows) => cols.flatMap((c) => rows.map((r) => `${c}${r}`));

export const NIVELURI = {
  // Un rând sub alpha și o coloană la vest de ea (numai apă), ca fâșia de cusătură
  // să aibă noduri pe toate cele patru laturi. La fel harta_v9 față de harta_v6.
  //
  // `dale`: dalele MDT-2m pe care le citește nivelul — toate cele din catalogul DGT care
  // ating amprenta filtrului lui (cutia ± jumătate din cort). Se numesc, nu se caută în
  // director: o dală adusă mai târziu ar schimba altfel tăcut nodurile de pe margine,
  // iar una care lipsește ar deveni mare (vezi build-imprejurimi). 104161–104163 au
  // colțul mutat și se sar; 104164–104166, 105166 și 108161 nu există în catalog, sunt
  // numai mare. harta_v6 citește și coloana 107 (cortul nodurilor de la x −93001 ajunge
  // la x −92999), deși a fost construită întâi fără ea.
  harta_v6: { pas: 4, x0: -95789, x1: -93001, y0: -139395, y1: -136003, interior: 'harta_v4', sursa: 'DGT',
    dale: [...dale([104], [161, 162, 163]), ...dale([105, 106, 107], [161, 162, 163, 164])] },
  // Ancorată în colțul de NE al lui harta_v6 (−93001, −136003); ultimul nod sub marginea
  // datelor (x −91000, y −134000).
  harta_v9: { pas: 12, x0: -95797, x1: -91009, y0: -139399, y1: -134011, interior: 'harta_v6', sursa: 'DGT',
    dale: [...dale([104], [161, 162, 163]), ...dale([105], [161, 162, 163, 164, 165]), ...dale([106, 107], [161, 162, 163, 164, 165, 166]), ...dale([108], [162, 163, 164, 165, 166])] },
  // Grila de dinainte de harta_v9, neschimbată: numai gaura s-a mărit.
  harta_v7: { pas: 32, x0: -99817, x1: -86505, y0: -142403, y1: -129507, interior: 'harta_v9', sursa: 'Copernicus' },
  harta_v8: { pas: 256, x0: -142825, x1: -46569, y0: -186083, y1: -89827, interior: 'harta_v7', sursa: 'Copernicus' },
};

// ------------------------------------------------------------ Copernicus DEM

const COP = 'https://copernicus-dem-30m.s3.amazonaws.com';
/**
 * Dalele GLO-30 de 1° × 1° care ating harta_v8. Pătratul grilei coboară puțin sub 38°,
 * unde ar trebui dalele N37; nu se aduc: colțurile acelea, cu uscat lângă Sines,
 * stau la peste 50 km de centru, deci în afara discului lui harta_v8.
 */
export const DALE_COPERNICUS = ['N38_00_W010_00', 'N38_00_W009_00'];
export const urlCopernicus = (dala, aux = 'DEM') => (aux === 'DEM'
  ? `${COP}/Copernicus_DSM_COG_10_${dala}_DEM/Copernicus_DSM_COG_10_${dala}_DEM.tif`
  : `${COP}/Copernicus_DSM_COG_10_${dala}_DEM/AUXFILES/Copernicus_DSM_COG_10_${dala}_${aux}.tif`);
export const dirCopernicus = (dala, aux = 'DEM') => `date-sursa/copernicus/${dala}_${aux}`;

export const SURSA_COPERNICUS = {
  // Ediția nu o spune nici bucketul, nici readme-ul lui: „COP-DEM_GLO-30-DGED”.
  nume: 'Copernicus DEM GLO-30 (COP-DEM_GLO-30-DGED, din bucketul AWS copernicus-dem-30m)',
  producator: 'DLR e.V. și Airbus Defence and Space GmbH, prin programul Copernicus (UE și ESA)',
  // Numele scurt din rândul vizibil al paginii; producătorul e prea lung pentru el.
  scurt: 'Copernicus',
  // Atribuirea și clauza sunt în engleză, cum le cere licența.
  lang: 'en',
  licenta: 'Copernicus DEM — licența pentru publicul larg (COPDEM-30)',
  // Textul cerut de licență pentru date adaptate sau modificate, întocmai.
  atributie: 'produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved',
  raspundere: 'The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.',
  portal: 'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM',
  licenta_url: 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf',
};

// ------------------------------------------------------------ Sentinel-2

/**
 * Scena: 24 iulie 2025, Sentinel-2A, aceeași trecere peste toate cele patru dale
 * MGRS, fiecare cu sub 0,04% nori. Aleasă din fereastra zborului DGT
 * (24.05–25.07.2025), ca vegetația să fie a aceluiași anotimp ca ortofotoul.
 */
export const SCENA_SENTINEL = '20250724';
export const DALE_SENTINEL = ['MC', 'MD', 'NC', 'ND'];
export const idSentinel = (g) => `S2A_29S${g}_${SCENA_SENTINEL}_0_L2A`;
export const urlSentinel = (g, banda) =>
  `https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/29/S/${g}/2025/7/${idSentinel(g)}/${banda}.tif`;
export const dirSentinel = (g, banda) => `date-sursa/sentinel/${idSentinel(g)}/${banda}`;

export const SURSA_SENTINEL = {
  nume: `Sentinel-2 L2A, ${SCENA_SENTINEL.slice(0, 4)}-${SCENA_SENTINEL.slice(4, 6)}-${SCENA_SENTINEL.slice(6)}`,
  producator: 'Agenția Spațială Europeană, programul Copernicus; COG-uri de la Element 84 / AWS Open Data',
  scurt: 'Copernicus',
  lang: 'en',
  licenta: 'Copernicus Sentinel data licence (rev. 1)',
  licenta_url: 'https://ewds.climate.copernicus.eu/licences/ec-sentinel',
  // Forma cerută de licență pentru date adaptate sau modificate, verificată pe
  // 2026-10-07 pe pagina licenței (licenta_url).
  atributie: 'Contains modified Copernicus Sentinel data 2025',
  portal: 'https://registry.opendata.aws/sentinel-2-l2a-cogs/',
};
