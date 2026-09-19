// Încărcarea resurselor. Loaderele grele (glTF/Draco/KTX2) se vor adăuga aici,
// ca o singură instanță refolosită — deocamdată doar relieful.

/**
 * Încarcă heightmap-ul produs de `npm run fetch-dem`.
 *
 * Fișierul e Uint16 little-endian, rând 0 = nord. Verificăm lungimea, pentru că
 * un fișier trunchiat ar produce un teren aberant în loc de o eroare limpede.
 *
 * Implicit: harta_v1 — peticul de 1 m, care își aduce singur baza (harta_v0, la
 * 2 m) prin cheia `baza` din sidecar. Celelalte hărți rămân pe disc și se cer
 * prin argumente, fără să se schimbe nimic aici:
 *   `/data/harta_v0-dem.*`     zona aleasă în pagină, LiDAR 2 m
 *   `/data/espichel-dem.*`     promontoriul întreg, Copernicus GLO-30 (30 m)
 *   `/data/lagosteiros-dem.*`  golful Lagosteiros, LiDAR 2 m
 *
 * `adancime` oprește lanțul de baze. O hartă care s-ar referi la ea însăși — o
 * greșeală de tastare în sidecar — ar încărca la nesfârșit altfel.
 */
export async function incarcaRelief(
  urlBin = '/data/harta_v1-dem.bin',
  urlMeta = '/data/harta_v1-dem.json',
  adancime = 0,
) {
  const [rMeta, rBin] = await Promise.all([fetch(urlMeta), fetch(urlBin)]);
  if (!rMeta.ok) throw new Error(`metadatele reliefului: HTTP ${rMeta.status} la ${urlMeta}`);
  if (!rBin.ok) throw new Error(`relieful: HTTP ${rBin.status} la ${urlBin}`);

  const meta = await rMeta.json();
  const buf = await rBin.arrayBuffer();
  const asteptat = meta.latime * meta.inaltime * 2;
  if (buf.byteLength !== asteptat)
    throw new Error(`relief trunchiat: ${buf.byteLength} octeți, așteptat ${asteptat}`);

  const brut = new Uint16Array(buf);
  const inaltimi = new Float32Array(brut.length);
  for (let i = 0; i < brut.length; i++) inaltimi[i] = meta.zMin_m + brut[i] * meta.zScara;

  const relief = {
    latime: meta.latime,
    inaltime: meta.inaltime,
    pasX: meta.pasX_m,
    pasZ: meta.pasZ_m,
    inaltimi,
    meta,
  };

  if (meta.baza && adancime < 1)
    relief.baza = await incarcaRelief(
      `/data/${meta.baza}-dem.bin`, `/data/${meta.baza}-dem.json`, adancime + 1);

  return relief;
}
