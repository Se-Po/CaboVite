import * as THREE from 'three';
import { incarcaRelief } from './loaders.js';
import { ceataCer } from './mare.js';
import { campNeted, creeazaTeren } from './terrain.js';
import { buclaNoduri, dreptunghiExterior, dreptunghiGrila, fermoar, geometriaGrilei } from './cusatura.js';

// Împrejurimile zonei alpha: peisajul care continuă dincolo de marginile tăiate ale
// hărții, până unde ceața scenei îl acoperă de tot (~45 km).
//
// Patru niveluri, fiecare o hartă cu gaură, cusută de cel dinăuntru:
//   harta_v6 — LiDAR DGT la 4 m, banda de ~400 m de lângă marginile de nord și est;
//   harta_v9 — LiDAR DGT la 12 m, până la ~2,4 km de alpha;
//   harta_v7 — Copernicus GLO-30 la 32 m, ~4,5 km mai încolo;
//   harta_v8 — Copernicus GLO-30 la 256 m, până la ~48 km.
// Numele nu urmează ordinea: harta_v9 s-a adăugat după celelalte, când autorul a adus
// dalele DGT ale benzii. Ordinea e cea din listă și din cheia `interior` a fiecăruia.
// Le construiește `npm run build-imprejurimi`; vezi acolo de unde vin și ce s-a făcut
// cu ele.
//
// Sunt decor. Nu primesc umbre, nu au etichete, nu se măsoară pe ele, iar ținta
// camerei nu iese din alpha (alpha.js). Dar sunt relief adevărat: un deal din
// împrejurimi ascunde ce e în spatele lui, deci `inaltimeLa` de aici intră în raza
// panoului punctului și în ocluzia etichetei.

export const NIVELURI_IMPREJURIMI = ['harta_v6', 'harta_v9', 'harta_v7', 'harta_v8'];

// Nivelurile NETEZITE: cele de la 12 m încolo. Cu fațete plate de 32 m, `harta_v7` se
// vedea pe Relief de la ~2 km ca pete, fiecare fațetă cu lumina și culoarea ei, iar
// autorul a cerut relieful netezit (2026-10-07); `harta_v9`, cu fațete de 12 m văzute
// de la 0,4–2,4 km, la fel. `harta_v6` rămâne cu fațete, ca alpha: e LiDAR la 4 m,
// lângă alpha la 2 m.
export const NIVELURI_NETEZITE = new Set(['harta_v9', 'harta_v7', 'harta_v8']);

/**
 * Încarcă nivelurile, cu straturile lor NDVI. NU aruncă: fără ele pagina
 * rămâne cum era, cu marginile tăiate, și spune o dată de ce.
 *
 * Totul sau nimic, și la relief, și la straturi. Un nivel lipsă ar lăsa un inel de
 * mare între două uscaturi; un strat lipsă ar colora un inel după altă regulă.
 *
 * `garda`: garda pornirii (loaders.js); abandonată, `null` fără avertisment.
 *
 * @returns {Promise<object[]|null>}
 */
export async function incarcaImprejurimi(nume = NIVELURI_IMPREJURIMI, { garda = null } = {}) {
  try {
    const niveluri = await Promise.all(nume.map((n) => incarcaRelief(`/data/${n}-dem.bin`, `/data/${n}-dem.json`, { garda })));
    // Abandonată cât mai sosea un strat: straturile au ieșit `null` tăcut, deci n-are rost
    // nici avertismentul „numai X din Y”.
    if (garda?.semnal.aborted) return null;
    let interior = 'harta_v4';
    for (const [k, L] of niveluri.entries()) {
      const m = L.meta;
      if (m?.nume !== nume[k]) throw new Error(`${nume[k]}: sidecarul e al lui ${m?.nume}`);
      if (m.rol !== 'imprejurimi') throw new Error(`${m.nume}: rolul ${m.rol}, nu „imprejurimi”`);
      if (m.interior !== interior) throw new Error(`${m.nume}: cusută de ${m.interior}, aștept ${interior}`);
      const s = m.interior_noduri_scena, d = m.deplasare_scena;
      if (![s?.x0, s?.x1, s?.z0, s?.z1, d?.x, d?.z].every(Number.isFinite)) throw new Error(`${m.nume}: lipsesc gaura sau deplasarea`);
      // Gaura trebuie să fie chiar cutia nodurilor nivelului dinăuntru. Numele nu
      // ajunge: un nivel dinăuntru refăcut cu alt contur ar lăsa o fâșie de cusătură
      // lungă peste un gol fără date, iar fermoarul o coase fără să se plângă.
      if (k > 0) {
        const g = m.interior_noduri_tm06, b = niveluri[k - 1].meta.bbox_tm06;
        if (g?.x0 !== b?.xMin || g?.x1 !== b?.xMax || g?.y0 !== b?.yMin || g?.y1 !== b?.yMax)
          throw new Error(`${m.nume}: gaura nu e cutia nodurilor lui ${interior}`);
      }
      interior = m.nume;
    }
    const cuStrat = niveluri.filter((L) => L.ndvi).length;
    if (cuStrat && cuStrat < niveluri.length) {
      console.warn(`împrejurimi: numai ${cuStrat} din ${niveluri.length} straturi NDVI — nu folosesc niciunul, ca inelele să se coloreze la fel`);
      for (const L of niveluri) L.ndvi = null;
    }
    return niveluri;
  } catch (e) {
    if (!garda?.semnal.aborted) console.warn(`împrejurimile lipsesc (${e.message}) — harta rămâne cu marginile tăiate`);
    return null;
  }
}

/**
 * Plasele nivelurilor, cu fâșiile de cusătură.
 *
 * `margineAlpha` e bucla nodurilor de margine ale lui alpha (`buclaNoduri` pe grila
 * ei întreagă), luată cât stratul NDVI al lui alpha mai era viu: fâșia dintre alpha
 * și harta_v6 se colorează și cu el.
 *
 * Materialul e al terenului, cu ceața scenei pe culoarea cerului de pe azimutul
 * fiecărui pixel (`ceataCer`, legea scenei). Uscatul de la 24–48 km se topește
 * astfel în cer și în marea de lângă el, nu într-o fâșie de culoarea medie a
 * orizontului. Fără cer rămâne ceața obișnuită. Sunt două: cu fațete plate și
 * netezit (`NIVELURI_NETEZITE`), altfel la fel.
 *
 * O fâșie de cusătură stă în plasa nivelului din AFARĂ, deci e netezită dacă el e.
 * Vârfurile ei vin atunci cu normala și culoarea nodului lor, luate din nivelul căruia
 * îi aparține nodul — și din `harta_v6`, care e plată: ce stă de partea ei e oricum o
 * margine între fațete și neted. Între două niveluri netezite (`harta_v9` | `harta_v7`
 * | `harta_v8`) fâșia continuă exact plasa dinăuntru.
 *
 * @param {{niveluri: object[], margineAlpha: object[], paleta: object, culoare?: Function,
 *          cer?: {uniforme: object}|null}} o
 */
export function creeazaImprejurimi({ niveluri, margineAlpha, paleta, culoare, cer = null }) {
  const plase = [];
  const fa = (plat) => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: plat });
    // Fără codul umbrelor. r186 definește USE_SHADOWMAP pe renderer, nu pe obiect
    // (WebGLPrograms.js:363), deci orice material luminat calcula pe fiecare vârf
    // poziția în harta de umbre (un mat4 × vec4 și un varying vec4) — și împrejurimile, care n-au
    // `receiveShadow` și stau toate în afara hărții. După prefixul cu `#define`, deci
    // îl anulează; `ceataCer` își calculează singură poziția în lume.
    const faraUmbre = (sh) => {
      sh.vertexShader = '#undef USE_SHADOWMAP\n' + sh.vertexShader;
      sh.fragmentShader = '#undef USE_SHADOWMAP\n' + sh.fragmentShader;
    };
    if (cer) {
      m.onBeforeCompile = (sh) => { faraUmbre(sh); ceataCer(sh, cer, { lege: 'scena' }); };
      m.customProgramCacheKey = () => 'teren-imprejurimi';
    } else {
      m.onBeforeCompile = faraUmbre;
      m.customProgramCacheKey = () => 'teren-imprejurimi-fara-cer';
    }
    return m;
  };
  const materiale = { plat: fa(true), neted: fa(false) };
  const curata = () => {
    for (const p of plase) p.teren.dispose();
    plase.length = 0;
    materiale.plat.dispose(); materiale.neted.dispose();
  };
  try {
    let interior = margineAlpha;
    for (const [k, L] of niveluri.entries()) {
      const m = L.meta, dep = m.deplasare_scena, s = m.interior_noduri_scena;
      const H = { x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1 };
      const R = dreptunghiExterior(L, dep, H);
      const strat = L.ndvi ?? null;
      const neted = NIVELURI_NETEZITE.has(m.nume);
      const camp = neted ? campNeted(L, { paleta, ndvi: strat, culoare }) : null;
      const cus = fermoar(interior, buclaNoduri(L, dep, strat, R, camp), { cotaApa: m.zMin_m });
      // Grila se oprește pe dreptunghiul R; între el și gaură stă fâșia.
      const pastreaza = (x, z) => !(x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1);
      const teren = creeazaTeren(L, {
        deplasare: dep, pastreaza, paleta, ndvi: strat, culoare, cusatura: cus, neted,
        camp: camp?.tot(),   // același câmp, nu încă unul făcut în creeazaTeren
        material: neted ? materiale.neted : materiale.plat,
      });
      teren.obiect.name = m.nume;
      const g = geometriaGrilei(L, dep);
      plase.push({
        nume: m.nume, teren, meta: m, neted,
        cutie: { x0: g.X(0), x1: g.X(L.latime - 1), z0: g.Z(0), z1: g.Z(L.inaltime - 1) },
        cusatura: { triunghiuri: cus.triunghiuri.length / 3, aruncate: cus.aruncate },
      });
      // Marginea nivelului acesta e interiorul următorului — cu normala și culoarea
      // nodurilor, dacă următorul e netezit.
      const urm = niveluri[k + 1];
      const campUrm = urm && NIVELURI_NETEZITE.has(urm.meta.nume)
        ? camp ?? campNeted(L, { paleta, ndvi: strat, culoare })
        : null;
      interior = buclaNoduri(L, dep, strat, dreptunghiGrila(L), campUrm);
      L.ndvi = null;   // culoarea s-a copt; stratul nu mai folosește la nimic
    }
  } catch (e) {
    curata();
    throw e;
  }

  const ultima = plase[plase.length - 1];
  return {
    plase,
    obiecte: plase.map((p) => p.teren.obiect),
    nrTriunghiuri: plase.reduce((a, p) => a + p.teren.nrTriunghiuri, 0),
    /** Marginile împrejurimilor în scenă: cât merge raza panoului punctului. */
    limite: { xMin: ultima.cutie.x0, xMax: ultima.cutie.x1, zMin: ultima.cutie.z0, zMax: ultima.cutie.z1 },
    /**
     * Cota în (x, z), din nivelul cel mai fin care acoperă punctul. Alpha nu e aici:
     * scena o întreabă întâi pe ea. În afara tuturor, cota apei.
     */
    inaltimeLa(x, z) {
      for (const p of plase) {
        const c = p.cutie;
        if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return p.teren.inaltimeLa(x, z);
      }
      return ultima?.meta.zMin_m ?? -8;
    },
    dispose: curata,
  };
}
