// Decompresia LZW din TIFF (Compression = 5) și anularea predictorului (tag 317).
//
// Unele dale DGT vin comprimate, altele nu, fără nicio regulă scrisă: MDT-50cm-105162
// e LZW, vecina ei 105163 e brută. Până aici `citesteTiffDGT` refuza orice dală
// comprimată; MDS-urile sanctuarului cad pe aceleași dale, deci decodorul trebuie
// să existe, și să fie al nostru — proiectul nu ia dependențe pentru citirea datelor.
//
// Varianta e cea din TIFF 6.0, nu cea din GIF:
//   - codurile se citesc de la bitul cel mai semnificativ (MSB-first);
//   - lățimea crește cu un cod mai DEVREME decât ar cere tabelul — la 511, 1023,
//     2047, nu la 512, 1024, 2048 („early change"). Așa scrie libtiff, deci așa
//     citim; cu regula GIF fluxul se rupe exact la prima creștere de lățime.
// Un flux care nu începe cu codul Clear e varianta veche, dinaintea TIFF 5.0, cu
// bitul cel mai puțin semnificativ întâi. N-o ghicim: oprim cu mesaj limpede.

const CLEAR = 256, EOI = 257, PRIMUL_LIBER = 258, LATIME_MAX = 12;

/**
 * Decomprimă o bandă LZW și întoarce exact `lungime` octeți.
 *
 * Aruncă dacă ieșirea iese mai scurtă sau mai lungă, sau dacă apare un cod care nu
 * există încă în tabel: o bandă stricată nu trebuie să producă tăcut un relief greșit.
 *
 * @param {Uint8Array} src
 * @param {number} lungime — octeții așteptați (lățime · rânduri · octeți pe eșantion)
 */
export function decodeazaLzw(src, lungime) {
  const out = new Uint8Array(lungime);
  // Tabelul ca listă înlănțuită înapoi: fiecare intrare e intrarea-prefix plus un
  // octet. Lungimea și primul octet se țin separat, ca scrierea să nu mai caute.
  const prefix = new Int16Array(4096);
  const sufix = new Uint8Array(4096);
  const prim = new Uint8Array(4096);
  const lung = new Uint16Array(4096);
  for (let i = 0; i < 256; i++) { prefix[i] = -1; sufix[i] = i; prim[i] = i; lung[i] = 1; }

  let acc = 0, nAcc = 0, p = 0, latime = 9;
  const citeste = () => {
    while (nAcc < latime) {
      // După ultimul octet se completează cu zerouri; un flux corect se oprește la
      // EOI înainte să ajungă aici, iar unul trunchiat pică la verificarea lungimii.
      if (p > src.length + 2) throw new Error('LZW: fluxul s-a terminat fără EOI');
      acc = ((acc << 8) | (p < src.length ? src[p] : 0)) & 0xffffff;
      p++;
      nAcc += 8;
    }
    nAcc -= latime;
    return (acc >>> nAcc) & ((1 << latime) - 1);
  };

  let poz = 0;
  const scrie = (cod) => {
    const n = lung[cod];
    if (poz + n > lungime) throw new Error(`LZW: ieșirea depășește ${lungime} octeți`);
    for (let i = n - 1, c = cod; i >= 0; i--, c = prefix[c]) out[poz + i] = sufix[c];
    poz += n;
  };

  let urm = PRIMUL_LIBER, vechi = -1, primul = true;
  for (;;) {
    let cod = citeste();
    if (primul && cod !== CLEAR)
      throw new Error('LZW: fluxul nu începe cu Clear — e varianta veche (LSB-first), pe care n-o citim');
    primul = false;
    if (cod === EOI) break;
    if (cod === CLEAR) {
      latime = 9; urm = PRIMUL_LIBER;
      cod = citeste();
      if (cod === EOI) break;
      if (cod > 255) throw new Error(`LZW: după Clear vine codul ${cod}, aștept un octet`);
      scrie(cod);
      vechi = cod;
      continue;
    }
    if (cod < urm) {
      scrie(cod);
      if (urm < 4096) adauga(vechi, prim[cod]);
    } else if (cod === urm) {
      // Cazul KwKwK: codul abia urmează să intre în tabel — e șirul vechi plus
      // propriul lui prim octet. Se adaugă întâi, apoi se scrie.
      adauga(vechi, prim[vechi]);
      scrie(cod);
    } else {
      throw new Error(`LZW: codul ${cod} nu există încă (următorul liber e ${urm})`);
    }
    vechi = cod;
    if (urm >= (1 << latime) - 1 && latime < LATIME_MAX) latime++;
  }
  if (poz !== lungime) throw new Error(`LZW: au ieșit ${poz} octeți, aștept ${lungime}`);
  return out;

  function adauga(pref, oct) {
    prefix[urm] = pref;
    sufix[urm] = oct;
    prim[urm] = prim[pref];
    lung[urm] = lung[pref] + 1;
    urm++;
  }
}

/**
 * Anulează predictorul TIFF, pe loc, rând cu rând. Un singur eșantion pe pixel.
 *
 * - 1: fără predictor.
 * - 2: diferențe orizontale pe întregi de `octetiPeEsantion`, little-endian.
 * - 3: predictorul pentru virgulă mobilă (Adobe, TIFF Technical Note 3): pe rând,
 *      octeții sunt întâi diferențiați ca șir de octeți, apoi rearanjați pe plane —
 *      toți octeții cei mai semnificativi ai rândului, apoi următorii. Se adună,
 *      apoi se pun la loc în ordinea little-endian a mașinii.
 *
 * @param {Uint8Array} octeti — banda decomprimată
 * @param {number} latime — eșantioane pe rând
 * @param {number} octetiPeEsantion
 * @param {number} predictor
 */
export function anuleazaPredictor(octeti, latime, octetiPeEsantion, predictor) {
  if (predictor === 1) return octeti;
  const pr = latime * octetiPeEsantion;
  if (octeti.length % pr) throw new Error(`predictor: banda de ${octeti.length} octeți nu are rânduri întregi de ${pr}`);
  const randuri = octeti.length / pr;

  if (predictor === 2) {
    const dv = new DataView(octeti.buffer, octeti.byteOffset, octeti.byteLength);
    const [cit, scr, masca] = {
      1: [(o) => dv.getUint8(o), (o, v) => dv.setUint8(o, v), 0xff],
      2: [(o) => dv.getUint16(o, true), (o, v) => dv.setUint16(o, v, true), 0xffff],
      4: [(o) => dv.getUint32(o, true), (o, v) => dv.setUint32(o, v >>> 0, true), 0xffffffff],
    }[octetiPeEsantion] ?? [];
    if (!cit) throw new Error(`predictor 2 pe ${octetiPeEsantion} octeți pe eșantion: necunoscut`);
    for (let r = 0; r < randuri; r++) {
      const b = r * pr;
      for (let i = 1; i < latime; i++) {
        const o = b + i * octetiPeEsantion;
        const s = cit(o) + cit(o - octetiPeEsantion);
        scr(o, masca === 0xffffffff ? s >>> 0 : s & masca);
      }
    }
    return octeti;
  }

  if (predictor === 3) {
    const tmp = new Uint8Array(pr);
    for (let r = 0; r < randuri; r++) {
      const b = r * pr;
      for (let i = 1; i < pr; i++) octeti[b + i] = (octeti[b + i] + octeti[b + i - 1]) & 0xff;
      tmp.set(octeti.subarray(b, b + pr));
      for (let i = 0; i < latime; i++)
        for (let k = 0; k < octetiPeEsantion; k++)
          octeti[b + i * octetiPeEsantion + k] = tmp[(octetiPeEsantion - 1 - k) * latime + i];
    }
    return octeti;
  }

  throw new Error(`predictor ${predictor}: necunoscut (aștept 1, 2 sau 3)`);
}
