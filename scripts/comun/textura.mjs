// Ce au în comun texturile Satelit: lumina liniară, mipurile, PNG-urile de lucru și
// codarea KTX2 cu `ktx` (KTX-Software 4.4).
//
// A stat în textura-ortofoto.mjs. A cerut-o al doilea script — texturile
// împrejurimilor —, deci s-a mutat aici, neschimbată: aceleași date dau aceleași
// fișiere, la octet (proba: textura-ortofoto refăcută după mutare dă același sha256).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { laOklab, linear, gama } from './oklab.mjs';
import { scriePngSrgb } from './png.mjs';

export const NIVELURI_MIP = 5;
export const LUCRU = 'date-sursa/derivate/textura';

export const LIN = Float32Array.from({ length: 256 }, (_, v) => linear(v / 255));
export const laOctet = (v) => Math.max(0, Math.min(255, Math.round(gama(Math.max(0, Math.min(1, v))) * 255)));
export const multiplu = (v, m) => Math.ceil(v / m) * m;
export const dE = (a, b) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Nivelul următor: media 2 × 2, în liniar. */
export function injumatateste(lin, W, H) {
  const w = W / 2, h = H / 2, out = new Float32Array(w * h * 3);
  for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) for (let k = 0; k < 3; k++) {
    const a = (i, j) => lin[((2 * r + j) * W + 2 * q + i) * 3 + k];
    out[(r * w + q) * 3 + k] = (a(0, 0) + a(1, 0) + a(0, 1) + a(1, 1)) / 4;
  }
  return out;
}

/** Lanțul de mipuri, în liniar, pornind de la nivelul 0. */
export function lantMipuri(n0, W, H) {
  const lin = [n0];
  for (let k = 1; k < NIVELURI_MIP; k++) lin.push(injumatateste(lin[k - 1], W >> (k - 1), H >> (k - 1)));
  return lin;
}

export const octeti = (lin) => { const b = new Uint8Array(lin.length); for (let i = 0; i < lin.length; i++) b[i] = laOctet(lin[i]); return b; };

/** Distanța euclidiană (în texeli) până la cel mai apropiat texel marcat — două treceri, 3-4 aproximat. */
export function distanta(m, W, H) {
  const D = new Float32Array(W * H).fill(1e9);
  for (let i = 0; i < W * H; i++) if (m[i]) D[i] = 0;
  const d1 = 1, d2 = Math.SQRT2;
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
    const i = r * W + q; let v = D[i];
    if (q > 0) v = Math.min(v, D[i - 1] + d1);
    if (r > 0) { v = Math.min(v, D[i - W] + d1); if (q > 0) v = Math.min(v, D[i - W - 1] + d2); if (q < W - 1) v = Math.min(v, D[i - W + 1] + d2); }
    D[i] = v;
  }
  for (let r = H - 1; r >= 0; r--) for (let q = W - 1; q >= 0; q--) {
    const i = r * W + q; let v = D[i];
    if (q < W - 1) v = Math.min(v, D[i + 1] + d1);
    if (r < H - 1) { v = Math.min(v, D[i + W] + d1); if (q < W - 1) v = Math.min(v, D[i + W + 1] + d2); if (q > 0) v = Math.min(v, D[i + W - 1] + d2); }
    D[i] = v;
  }
  return D;
}

export function scriePngNiveluri(nume, niveluri) {
  const dir = join(LUCRU, nume);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return niveluri.map((n, k) => {
    const f = join(dir, `nivel-${k}.png`);
    writeFileSync(f, scriePngSrgb(n.W, n.H, n.b));
    return f;
  });
}

/**
 * Unealta `ktx` (KTX-Software 4.4). Din PATH, din KTX_BIN, sau din locul în care o
 * pune installerul pe Windows — un shell pornit înainte de instalare nu vede PATH-ul nou.
 */
export const KTX = (() => {
  for (const c of [process.env.KTX_BIN, 'ktx', 'C:/Program Files/KTX-Software/bin/ktx.exe'].filter(Boolean)) {
    const v = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (!v.error && v.status === 0) return { cale: c, versiune: v.stdout.trim() };
  }
  return null;
})();

/** KTX2 prin `ktx create`, cu nivelurile scrise de noi (implicit NIVELURI_MIP, câte PNG-uri). */
export function codeazaKtx(pnguri, iesire, codare, niveluri = NIVELURI_MIP) {
  if (!KTX)
    throw new Error('lipsește `ktx` (KTX-Software 4.4, https://github.com/KhronosGroup/KTX-Software/releases). '
      + `Nivelurile sunt scrise ca PNG în ${LUCRU}/; instalează-l și rulează din nou (sau dă-i calea în KTX_BIN).`);
  // --threads 1 și --uastc-rdo-m: fără fire paralele, aceleași date dau același
  // fișier, la octet, iar sha256-ul din sidecar se poate reface. Numai --uastc-rdo-m
  // nu ajunge: peticul ieșea diferit de la o rulare la alta.
  const arg = codare === 'uastc'
    ? ['--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-m', '--zstd', '18']
    : ['--encode', 'basis-lz', '--qlevel', '255', '--clevel', '4'];
  arg.push('--threads', '1');
  const r = spawnSync(KTX.cale, ['create', '--format', 'R8G8B8_SRGB', '--levels', String(niveluri), ...arg, ...pnguri, iesire], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ktx create a eșuat:\n${r.stderr || r.stdout}`);
  const val = spawnSync(KTX.cale, ['validate', iesire], { encoding: 'utf8' });
  if (val.status !== 0) throw new Error(`ktx validate:\n${val.stdout}${val.stderr}`);
  return readFileSync(iesire);
}

/**
 * Cât s-a pierdut la codare: nivelul 0 decodat înapoi (`ktx extract --transcode
 * rgba8 --raw`) față de octeții din care s-a făcut, ΔE_OK×100 pe un pixel din 16.
 */
export function pierdere(ktx2, sursa, W, H) {
  const raw = ktx2.replace(/\.ktx2$/, '.rgba');
  const r = spawnSync(KTX.cale, ['extract', '--transcode', 'rgba8', '--raw', '--level', '0', ktx2, raw], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ktx extract a eșuat:\n${r.stderr || r.stdout}`);
  const d = readFileSync(raw);
  if (d.length !== W * H * 4) throw new Error(`${raw}: ${d.length} octeți, aștept ${W * H * 4}`);
  const v = [];
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
    const i = y * W + x;
    v.push(dE(laOklab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]), laOklab(sursa[i * 3], sursa[i * 3 + 1], sursa[i * 3 + 2])));
  }
  rmSync(raw);
  const s = Float64Array.from(v).sort();
  return { medie: +(s.reduce((a, x) => a + x, 0) / s.length).toFixed(3), p99: +s[Math.floor(0.99 * s.length)].toFixed(3), max: +s[s.length - 1].toFixed(3) };
}
