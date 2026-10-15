// Pagina construită (dist/), deschisă în Microsoft Edge fără interfață, prin protocolul DevTools
// (CDP), pentru capturi și măsurători pe pixeli. Folosită de captura-og și masoara-pixeli.
//
// Edge pornește cu un profil TEMPORAR, într-un director nou din tmp, șters la închidere: nu atinge
// profilul autorului, cookie-urile sau istoricul lui. Build-ul îl servește `vite preview`, pe un port
// liber, numai pe 127.0.0.1. Nimic nu se descarcă: Edge e cel instalat în Windows, iar CDP merge
// prin WebSocket-ul din Node.
//
// Curățenia ține și pe căile de eroare: un eșec la pornire, o cerere fără răspuns, fila căzută sau
// Ctrl+C închid Edge și serverul și șterg profilul; dacă profilul tot rămâne, se spune cu calea lui.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

/**
 * Un PNG al capturii (`Page.captureScreenshot`): 8 biți, RGB sau RGBA, neîntrețesut, cu oricare din
 * cele cinci filtre. Întoarce `{ w, h, px(x, y) → [r, g, b] }`, cu `null` în afara imaginii; alt
 * format aruncă.
 */
export function decodeazaPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('nu e PNG');
  let p = 8, w = 0, h = 0, canale = 0;
  const idat = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p), tip = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n);
    if (tip === 'IHDR') {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4);
      canale = { 2: 3, 6: 4 }[d[9]];
      if (d[8] !== 8 || !canale || d[12] !== 0) throw new Error('PNG care nu e RGB/RGBA pe 8 biți, neîntrețesut');
    } else if (tip === 'IDAT') idat.push(d);
    p += 12 + n;
  }
  const brut = inflateSync(Buffer.concat(idat)), L = w * canale;
  const out = new Uint8Array(L * h);
  for (let y = 0; y < h; y++) {
    const f = brut[y * (L + 1)], src = brut.subarray(y * (L + 1) + 1, (y + 1) * (L + 1));
    for (let x = 0; x < L; x++) {
      const a = x >= canale ? out[y * L + x - canale] : 0, b = y ? out[(y - 1) * L + x] : 0, c = x >= canale && y ? out[(y - 1) * L + x - canale] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * L + x] = v & 255;
    }
  }
  const px = (x, y) => {
    if (!(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h)) return null;
    const i = (y * w + x) * canale;
    return [out[i], out[i + 1], out[i + 2]];
  };
  return { w, h, px };
}

const EDGE = [
  process.env.EDGE_BIN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find((f) => existsSync(f));

const asteapta = (ms) => new Promise((r) => setTimeout(r, ms));

/** O promisiune cu limită de timp; ceasul nu ține procesul viu. */
function cuLimita(p, ms, mesaj) {
  let ceas;
  const limita = new Promise((_, rej) => { ceas = setTimeout(() => rej(new Error(mesaj)), ms); ceas.unref(); });
  return Promise.race([p, limita]).finally(() => clearTimeout(ceas));
}

/**
 * Un client CDP minimal: `trimite(metodă, parametri, ms)`, `pe(eveniment, f)` și
 * `urmatorul(eveniment, ms)`. O cerere fără răspuns în `ms` (30 s) se respinge; la închiderea
 * conexiunii, la căderea filei sau la oprirea lui Edge (`respingeTot`) se resping toate, ca
 * apelantul să ajungă la `finally` și să închidă, nu să aștepte la nesfârșit.
 */
function client(url) {
  const ws = new WebSocket(url);
  let id = 0, cauza = null;
  // cererile, după id (număr), și evenimentele așteptate, după un Symbol
  const asteptate = new Map(), ascultatori = new Map();
  const asteapta1 = (cheie, ms, mesaj, extra = {}) => new Promise((res, rej) => {
    if (cauza) { rej(new Error(`CDP: ${cauza}`)); return; }
    const ceas = setTimeout(() => { asteptate.delete(cheie); rej(new Error(`CDP: ${mesaj}`)); }, ms);
    asteptate.set(cheie, { res, rej, ceas, ...extra });
  });
  const respingeTot = (motiv) => {
    cauza ??= motiv;
    for (const { rej, ceas } of asteptate.values()) { clearTimeout(ceas); rej(new Error(`CDP: ${cauza}`)); }
    asteptate.clear();
  };
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && asteptate.has(m.id)) {
      const { res, rej, ceas } = asteptate.get(m.id);
      clearTimeout(ceas);
      asteptate.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result);
    } else if (m.method) {
      for (const f of ascultatori.get(m.method) ?? []) f(m.params);
      for (const [k, a] of asteptate) if (a.ev === m.method) { clearTimeout(a.ceas); asteptate.delete(k); a.res(m.params); }
      if (m.method === 'Inspector.targetCrashed') respingeTot('fila a căzut');
      if (m.method === 'Inspector.detached') respingeTot(`fila s-a desprins (${m.params?.reason})`);
    }
  });
  ws.addEventListener('close', () => respingeTot('conexiunea s-a închis'));
  ws.addEventListener('error', () => respingeTot('eroare pe conexiune'));
  const deschis = new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  return {
    deschis,
    trimite(method, params = {}, ms = 30_000) {
      const n = ++id;
      const p = asteapta1(n, ms, `${method} fără răspuns în ${ms / 1000} s`);
      if (!cauza) ws.send(JSON.stringify({ id: n, method, params }));
      return p;
    },
    pe: (ev, f) => { if (!ascultatori.has(ev)) ascultatori.set(ev, []); ascultatori.get(ev).push(f); },
    urmatorul: (ev, ms) => asteapta1(Symbol(ev), ms, `${ev} n-a venit în ${ms / 1000} s`, { ev }),
    respingeTot,
    inchide: () => { respingeTot('închis de script'); ws.close(); },
  };
}

/**
 * Pornește serverul și Edge, deschide o filă goală și întoarce `{ pagina, url, inchide }`.
 * `pagina.evalueaza(expr)` întoarce valoarea expresiei (await inclus); `pagina.trimite` e CDP-ul brut;
 * `pagina.probleme()` dă erorile, avertismentele și mesajele de securitate (CSP) din consolă.
 */
export async function deschideEdge({ latime = 1200, inaltime = 800, dpr = 1 } = {}) {
  if (!EDGE) throw new Error('nu găsesc msedge.exe (EDGE_BIN, Program Files)');
  if (!existsSync('dist/index.html')) throw new Error('lipsește dist/: rulează întâi npm run build');
  const { preview } = await import('vite');
  let server = null, profil = null, edge = null, c = null, inchis = null;

  const curata = () => inchis ??= (async () => {
    process.off('SIGINT', laIntrerupere);
    c?.inchide();
    if (edge && edge.exitCode === null && edge.signalCode === null) {
      const iesit = new Promise((r) => edge.once('exit', r));
      edge.kill();
      await cuLimita(iesit, 5000, 'Edge nu s-a oprit în 5 s').catch((e) => console.warn(e.message));
    }
    await server?.close();
    if (profil) {
      try { rmSync(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* spus mai jos */ }
      if (existsSync(profil)) console.warn(`profilul temporar al lui Edge a rămas pe disc: ${profil}`);
    }
  })();
  function laIntrerupere() { curata().finally(() => process.exit(130)); }
  process.once('SIGINT', laIntrerupere);

  try {
    server = await preview({ logLevel: 'silent', preview: { host: '127.0.0.1', port: 0, strictPort: false, open: false } });
    const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
    profil = mkdtempSync(join(tmpdir(), 'cabo-edge-'));
    edge = spawn(EDGE, [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profil}`,
      '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
      '--disable-background-networking', '--disable-component-update', '--mute-audio',
      `--window-size=${latime},${inaltime}`, 'about:blank',
    ], { stdio: 'ignore' });
    edge.once('exit', (cod) => c?.respingeTot(`Edge s-a oprit (cod ${cod})`));

    // Portul DevTools: Edge îl scrie în profil; un fișier încă gol sau scris pe jumătate nu oprește
    // așteptarea.
    let port = null;
    for (let t = 0; t < 100 && !port; t++) {
      await asteapta(100);
      if (edge.exitCode !== null) throw new Error(`Edge s-a oprit la pornire (cod ${edge.exitCode})`);
      try {
        const n = Number(readFileSync(join(profil, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
        if (Number.isInteger(n) && n > 0) port = n;
      } catch { /* încă nu e scris */ }
    }
    if (!port) throw new Error('Edge n-a deschis portul DevTools în 10 s');
    let fila = null;
    for (let t = 0; t < 20 && !fila; t++) {
      const tinte = await cuLimita(fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()), 5000, 'DevTools nu răspunde la /json/list');
      fila = tinte.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
      if (!fila) await asteapta(250);
    }
    if (!fila) throw new Error('Edge n-a deschis nicio filă (/json/list fără „page”)');
    c = client(fila.webSocketDebuggerUrl);
    await cuLimita(c.deschis, 10_000, 'conexiunea DevTools nu s-a deschis în 10 s');
    for (const d of ['Inspector', 'Page', 'Runtime', 'Log']) await c.trimite(`${d}.enable`);
    await c.trimite('Emulation.setDeviceMetricsOverride', { width: latime, height: inaltime, deviceScaleFactor: dpr, mobile: false });

    // Consola: ce scrie pagina (Runtime) și ce scrie browserul (Log) — avertismentele WebGL,
    // încălcările CSP, cererile picate.
    const consola = [];
    c.pe('Runtime.consoleAPICalled', (p) => consola.push(`${p.type}: ${p.args.map((a) => a.value ?? a.description ?? '').join(' ')}`));
    c.pe('Runtime.exceptionThrown', (p) => consola.push(`excepție: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`));
    c.pe('Log.entryAdded', ({ entry: e }) => consola.push(`${e.level}: [${e.source}] ${e.text}${e.url ? ` (${e.url})` : ''}`));

    const pagina = {
      trimite: c.trimite,
      consola,
      probleme: () => consola.filter((m) => /^(error|warning|excepție)\b/.test(m) || /\[(security|violation)\]/.test(m)),
      async evalueaza(expr, ms = 30_000) {
        const r = await c.trimite('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, ms);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
        return r.result.value;
      },
      async du(cale = '', ms = 60_000) {
        const incarcat = c.urmatorul('Page.loadEventFired', ms);
        await c.trimite('Page.navigate', { url: url + cale });
        await incarcat;
      },
      /** O tastă apăsată și ridicată, ca de la tastatură (`key`, `code`, codul Windows). */
      async tasta(key, code = key, cod = 0) {
        for (const type of ['keyDown', 'keyUp']) await c.trimite('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: cod, nativeVirtualKeyCode: cod });
      },
      /** Un clic stâng în (x, y), în pixeli CSS ai ferestrei. */
      async clic(x, y) {
        await c.trimite('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        for (const type of ['mousePressed', 'mouseReleased']) await c.trimite('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      },
      /** Captura ferestrei, decodată (`decodeazaPng`), în pixeli de dispozitiv. */
      async captura() {
        const s = await c.trimite('Page.captureScreenshot', { format: 'png' });
        return decodeazaPng(Buffer.from(s.data, 'base64'));
      },
      /** Alt ecran: lățimea și înălțimea CSS și raportul de pixeli. */
      ecran: (w, h, d = 1) => c.trimite('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: d, mobile: false }),
      /**
       * Așteaptă până când expresia e adevărată, cel mult `ms`: fiecare evaluare are numai timpul
       * rămas (cel puțin 5 s), deci o pagină agățată nu trece de limită.
       */
      async panaCand(expr, ms = 60_000) {
        const t0 = Date.now();
        for (;;) {
          const rest = ms - (Date.now() - t0);
          if (rest <= 0) return false;
          if (await pagina.evalueaza(expr, Math.max(rest, 5000))) return true;
          await asteapta(250);
        }
      },
    };
    return { pagina, url, inchide: curata };
  } catch (e) {
    await curata();
    throw e;
  }
}
