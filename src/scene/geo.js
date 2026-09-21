// Conversiile dintre metrii scenei și lumea reală.
//
// Pagina lucrează în metri față de centrul hărții; datele vin în TM06 (metri,
// proiectați) și se raportează în longitudine/latitudine. Trei sisteme, două
// conversii, într-un singur loc — altfel fiecare unealtă ar avea versiunea ei.
//
// Partea din `scripts/comun/tm06.mjs` care proiectează elipsoidul NU se repetă
// aici: pagina n-are nevoie de ea. Tot ce-i trebuie e interpolare între colțurile
// pe care scriptul le-a scris deja în sidecar, iar asta e mult mai puțin cod și
// zero riscuri de a diverge de la ce s-a scris în fișier.

/**
 * Leagă o hartă încărcată de coordonatele lumii.
 *
 * @param {object} meta — sidecar-ul, de la incarcaRelief()
 */
export function creeazaGeo(meta) {
  const { latime: w, inaltime: h, pasX_m: pasX, pasZ_m: pasZ } = meta;
  const b = meta.bbox_tm06;

  // Ancorăm pe CENTRUL cutiei, nu pe un colț.
  //
  // Cele două scripturi scriu `bbox_tm06` în convenții diferite: build-zona
  // scrie dreptunghiul de decupare (muchii de celulă), build-petic scrie poziții
  // de noduri. Diferența e o jumătate de celulă — destulă cât să strice o unealtă
  // de măsurat. Dar nodurile sunt simetrice față de centru în AMBELE convenții:
  // la muchii fiindcă stau în centrele celulelor, la noduri fiindcă marginea e
  // chiar primul nod. Deci ancorat pe centru, conversia nu mai depinde de care e.
  // Verificat pe harta_v0, harta_v1 și lagosteiros: diferență exact zero.
  const centru = b ? { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 } : null;

  /** Metri de scenă → metri TM06. Exactă, nu aproximativă: e o translație. */
  const laTM06 = (x, z) => (centru ? { x: x + centru.x, y: centru.y - z } : null);

  /** Inversa. */
  const dinTM06 = (X, Y) => (centru ? { x: X - centru.x, z: centru.y - Y } : null);

  /**
   * Metri de scenă → longitudine/latitudine.
   *
   * Interpolare biliniară între cele patru colțuri din sidecar, nu liniară pe
   * fiecare axă separat. Motivul: un dreptunghi TM06 NU e un dreptunghi
   * geografic. Convergența meridianelor îl rotește cu ~0,7° la longitudinea
   * asta, adică vreo 35 m pe diagonala zonei — peste zece celule. De aceea
   * scriptul scrie patru colțuri și nu un „bbox".
   *
   * Poziția relativă se ia din TM06, nu din indicele nodului: `colturi_geo` sunt
   * colțurile CUTIEI, iar nodurile nu ating marginea cutiei în convenția cu
   * muchii de celulă. Diferența ar fi o jumătate de celulă, adică ~1 m aici.
   */
  const laGeo = (x, z) => {
    // Copernicus dă direct un bbox geografic; acolo nu e nimic de rotit.
    const geo = meta.bbox;
    if (geo) {
      const u = (x / pasX + (w - 1) / 2) / (w - 1);
      const v = (z / pasZ + (h - 1) / 2) / (h - 1);
      return {
        lon: +(geo.vest + u * (geo.est - geo.vest)).toFixed(6),
        lat: +(geo.nord - v * (geo.nord - geo.sud)).toFixed(6),
      };
    }

    const c = meta.colturi_geo;
    if (!c || !b) return null;
    const t = laTM06(x, z);
    const u = (t.x - b.xMin) / (b.xMax - b.xMin); // 0 la vest, 1 la est
    const v = (b.yMax - t.y) / (b.yMax - b.yMin); // 0 la nord, 1 la sud
    const amesteca4 = (cheie) =>
      (c.nv[cheie] * (1 - u) + c.ne[cheie] * u) * (1 - v) +
      (c.sv[cheie] * (1 - u) + c.se[cheie] * u) * v;
    return { lon: +amesteca4('lon').toFixed(6), lat: +amesteca4('lat').toFixed(6) };
  };

  return {
    laTM06, dinTM06, laGeo, centruTM06: centru,
    /** Marginile hărții în metri de scenă — cât poate cuprinde o selecție. */
    limite: {
      xMin: -(w - 1) / 2 * pasX, xMax: (w - 1) / 2 * pasX,
      zMin: -(h - 1) / 2 * pasZ, zMax: (h - 1) / 2 * pasZ,
      yMin: meta.zMin_m, yMax: meta.zMax_m,
    },
  };
}
