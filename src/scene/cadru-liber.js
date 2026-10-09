// Partea de ecran pe care n-o acoperă panourile, și imaginea mutată în ea.
//
// Două panouri pot sta peste mijlocul hărții: fișa sanctuarului (fisa-cadru.js) și cutia
// „Coordonate” deschisă (punct.js). Cât stau acolo, imaginea se mută în partea liberă cu
// un decalaj de obiectiv (`setViewOffset`), nu cu altă țintă: camera și pivotul rămân, deci
// raza panoului punctului, proiecția etichetei și a semnului, zoomul spre centru și rotirea
// merg neschimbate — toate citesc matricea de proiecție. Ținta cade pe mijlocul părții
// libere: de acolo culege „Măsoară centrul”, spre el apropie „+”.
//
// Fișa își dă singură partea liberă (`parteLibera`, în fisa-cadru.js). Cutia „Coordonate”
// contează numai cât intră în ea și stă în coloana ei din mijloc: pe telefon, unde stă jos,
// la stânga busolei, sau pe ecranele mici și mărite. Pe desktop și pe telefonul culcat stă
// într-o parte și nu mută nimic. Imaginea urcă deasupra cutiei; dacă deasupra rămâne mai
// puțin de un sfert din înălțime, trece alături, în partea mai lată, iar dacă nici acolo nu
// rămâne un sfert din lățime, dedesubt. Pragul de un sfert e al fișei. Cazurile recenziei:
// 640 × 360 (1280 × 720 la 200%), cu un punct cules, cutia urcă până la y 60, deci imaginea
// trece la stânga ei; 320 × 568, cu cutia pe toată lățimea până la y 100, dedesubt; la
// 390 × 844, cu rândurile unei clădiri, centrul vederii cădea sub cutie, deci deasupra.
//
// Cutia se citește din DOM la fiecare `aplica()`, nu se presupune: crește după primul clic
// și cu rândurile unei clădiri. Un decalaj neschimbat nu cere niciun cadru.

/** Tot canvasul. */
export const PLIN = Object.freeze({ x0: 0, x1: 1, y0: 0, y1: 1 });

/**
 * Partea liberă `L`, fără cutia „Coordonate” `b`: deasupra ei, alături sau dedesubt, cât
 * rămâne cel puțin un sfert din canvasul `c` (mai sus). Cutia contează numai dacă intră în
 * `L` și stă în coloana din mijlocul ei. Toate în coordonatele ferestrei.
 * @param {{x0: number, x1: number, y0: number, y1: number}} L
 * @param {{left: number, right: number, top: number, bottom: number, width: number, height: number}|null|undefined} b
 * @param {{left: number, top: number, width: number, height: number}} c
 */
export function faraCutie(L, b, c) {
  if (!b || !(b.width > 0) || !(b.height > 0) || !c.width || !c.height) return L;
  const X0 = c.left + L.x0 * c.width, X1 = c.left + L.x1 * c.width;
  const Y0 = c.top + L.y0 * c.height, Y1 = c.top + L.y1 * c.height;
  if (b.right <= X0 || b.left >= X1 || b.bottom <= Y0 || b.top >= Y1) return L;
  const mijloc = (X0 + X1) / 2;
  if (!(b.left < mijloc && b.right > mijloc)) return L;
  const sfertW = 0.25 * c.width, sfertH = 0.25 * c.height;
  if (b.top - Y0 >= sfertH) return { ...L, y1: (b.top - c.top) / c.height };
  const st = b.left - X0, dr = X1 - b.right;
  if (st >= sfertW && st >= dr) return { ...L, x1: (b.left - c.left) / c.width };
  if (dr >= sfertW) return { ...L, x0: (b.right - c.left) / c.width };
  if (Y1 - b.bottom >= sfertH) return { ...L, y0: (b.bottom - c.top) / c.height };
  return L;
}

/**
 * @param {{camera: import('three').PerspectiveCamera,
 *          canvas: {clientWidth: number, clientHeight: number, getBoundingClientRect: () => object},
 *          cereRandare: () => void}} o
 */
export function creeazaCadruLiber({ camera, canvas, cereRandare }) {
  let fisa = null;   // partea liberă de fișă, sau null cât fișa e închisă
  let cutie = null;  // () => cutia „Coordonate” deschisă, sau null

  /** Partea liberă de acum, în fracțiuni din canvas: fără fișă și fără cutie. */
  const parte = () => {
    const L = fisa ?? PLIN;
    if (!cutie) return L;
    return faraCutie(L, cutie(), canvas.getBoundingClientRect());
  };

  const aplica = () => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const L = cw && ch ? parte() : PLIN;
    const ox = (0.5 - (L.x0 + L.x1) / 2) * cw, oy = (0.5 - (L.y0 + L.y1) / 2) * ch;
    const plin = !ox && !oy;
    // Ce are camera acum, nu ce s-a scris ultima dată: după o redimensionare `view` ține
    // mărimea veche a canvasului și se scrie din nou, chiar cu aceleași fracțiuni.
    const v = camera.view;
    if (plin ? !v?.enabled : v?.enabled && v.fullWidth === cw && v.fullHeight === ch && v.offsetX === ox && v.offsetY === oy
      && v.width === cw && v.height === ch) return;
    if (plin) camera.clearViewOffset();
    else camera.setViewOffset(cw, ch, ox, oy, cw, ch);
    cereRandare();
  };

  return {
    parte,
    aplica,
    /** Partea liberă de fișă (fisa-cadru.js), sau null la închidere; se aplică pe loc. */
    seteazaFisa(L) { fisa = L; aplica(); },
    /** Cine dă cutia „Coordonate” deschisă (punct.js): o funcție, sau null. */
    seteazaCutie(f) { cutie = f; aplica(); },
    dispose() { fisa = null; cutie = null; },
  };
}
