// Zidurile dintr-o mască de pixeli: subțiere, lanțuri, linii frânte.
//
// Un zid de ruină sau de incintă apare în nMDS ca o fâșie de 1–3 pixeli, ridicată
// deasupra solului. Axa lui se scoate prin subțiere (Zhang–Suen, 1984): se decojesc
// marginile până rămâne o linie de un pixel, fără să se rupă legăturile. Linia se
// urmărește apoi de la capete și de la răscruci, iar fiecare lanț se simplifică
// Douglas–Peucker. Grosimea zidului e aria măștii din jurul lanțului împărțită la
// lungimea lui.

/**
 * @param {Uint8Array} m — masca, w × h, 1 = zid
 * @returns {Uint8Array} scheletul, pe loc
 */
export function subtiaza(m, w, h) {
  const a = Uint8Array.from(m);
  const N = (i) => [a[i - w], a[i - w + 1], a[i + 1], a[i + w + 1], a[i + w], a[i + w - 1], a[i - 1], a[i - w - 1]];
  let schimbat = true;
  while (schimbat) {
    schimbat = false;
    for (const pas of [0, 1]) {
      const sterge = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!a[i]) continue;
        const [p2, p3, p4, p5, p6, p7, p8, p9] = N(i);
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const s = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let A = 0;
        for (let k = 0; k < 8; k++) if (!s[k] && s[k + 1]) A++;
        if (A !== 1) continue;
        if (pas === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        sterge.push(i);
      }
      for (const i of sterge) a[i] = 0;
      if (sterge.length) schimbat = true;
    }
  }
  return a;
}

const VECINI = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Lanțurile scheletului: liste de [x, y] în pixeli, de la capăt sau răscruce la capăt sau răscruce. */
export function lanturi(s, w, h) {
  const vec = (i) => {
    const x = i % w, y = Math.floor(i / w), out = [];
    for (const [dx, dy] of VECINI) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h && s[Y * w + X]) out.push(Y * w + X);
    }
    return out;
  };
  const grad = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (s[i]) grad[i] = vec(i).length;
  const nod = (i) => grad[i] !== 2;
  const vizitat = new Set();
  const cheie = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const out = [];
  const urmareste = (start, urm) => {
    const lant = [start];
    let prev = start, cur = urm;
    vizitat.add(cheie(prev, cur));
    for (;;) {
      lant.push(cur);
      if (nod(cur)) break;
      const nx = vec(cur).find((j) => j !== prev && !vizitat.has(cheie(cur, j)));
      if (nx === undefined) break;
      vizitat.add(cheie(cur, nx));
      prev = cur; cur = nx;
    }
    return lant.map((i) => [i % w, Math.floor(i / w)]);
  };
  for (let i = 0; i < w * h; i++) {
    if (!s[i] || !nod(i)) continue;
    for (const j of vec(i)) if (!vizitat.has(cheie(i, j))) out.push(urmareste(i, j));
  }
  // bucle închise, fără niciun nod
  for (let i = 0; i < w * h; i++) {
    if (!s[i] || nod(i)) continue;
    const j = vec(i).find((k) => !vizitat.has(cheie(i, k)));
    if (j !== undefined) out.push(urmareste(i, j));
  }
  return out;
}

/** Douglas–Peucker pe puncte [x, y]. */
export function simplifica(p, tol) {
  if (p.length < 3) return p.slice();
  const [a, b] = [p[0], p[p.length - 1]];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  let max = -1, k = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / L;
    if (d > max) { max = d; k = i; }
  }
  if (max <= tol) return [a, b];
  return simplifica(p.slice(0, k + 1), tol).slice(0, -1).concat(simplifica(p.slice(k), tol));
}

/**
 * Tot lanțul: din mască, zidurile ca linii frânte în coordonatele pixelilor.
 * Lanțurile sub `minPx` pixeli se aruncă — cioturi ale subțierii, nu ziduri.
 */
export function scheletZiduri(m, w, h, { tolPx = 0.6, minPx = 4 } = {}) {
  const s = subtiaza(m, w, h);
  return lanturi(s, w, h).filter((l) => l.length >= minPx).map((l) => simplifica(l, tolPx));
}
