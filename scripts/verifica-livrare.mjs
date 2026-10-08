// Verifică livrarea: ce antete pune Vercel, după vercel.json, pe fiecare fișier publicat,
// și dacă politica lor se potrivește cu ce face pagina.
//
//   npm run build && npm run verifica-livrare        pe configurație, fără rețea
//   npm run verifica-livrare -- --live [origine]      și pe pagina publicată, cu cereri HEAD
//                                                     (implicit https://sebastians.life)
//
// Nu scrie nimic în public/. Iese cu cod 1 dacă pică vreo probă. Ce verifică:
//   - cache-ul: /assets imutabil (numele au hash), documentul pe revalidare; în /data,
//     imutabile numai hărțile, texturile și clădirile cu versiune în nume, și numai dacă
//     git nu le-a schimbat niciodată conținutul; NDVI-ul și paleta, pe revalidare;
//   - antetele de securitate, pe fiecare cale;
//   - CSP-ul față de ce face pagina: transcodorul KTX2 (worker din blob:, new Function,
//     WebAssembly), cursoarele (data:), fetch-urile pe aceeași origine; și că nici
//     marcajul, nici codul nu pun stiluri sau scripturi inline;
//   - garda numelor publicate (scripts/comun/publicat.mjs).
// Fiecare probă de fond are un control negativ: aceeași probă pe o greșeală cunoscută
// trebuie să pice.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CACHE_IMPLICIT, antetePentru, regexSursa, reguliVercel } from './comun/vercel.mjs';
import { blobHead, blobPentru, scrieNepublicat } from './comun/publicat.mjs';

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const scurt = (a, n = 4) => (a.length > n ? `${a.slice(0, n).join(', ')} și încă ${a.length - n}` : a.join(', '));
const git = (args, input) => spawnSync('git', args, { input, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout;

if (!existsSync('dist/index.html')) throw new Error('lipsește dist/: rulează întâi npm run build');
const CFG = JSON.parse(readFileSync('vercel.json', 'utf8'));
const REGULI = reguliVercel(CFG);

// ------------------------------------------------------------ ce publică Vercel

// Vercel construiește din commit, deci din public/ ajunge numai ce e în git. Un dist/ local
// cu fișiere gitignorate (public/draco, rămas de la copy-decoders) ar servi la `npm run
// preview` fișiere pe care pagina publicată nu le are, deci pică. Un fișier nou, încă
// neadăugat, e firesc înainte de commit: se spune, fără să pice.
const toate = [];
(function umbla(dir, cale) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f), c = `${cale}/${f}`;
    if (statSync(p).isDirectory()) umbla(p, c);
    else toate.push(c);
  }
})('dist', '');
const dinPublic = toate.filter((c) => c !== '/index.html' && !c.startsWith('/assets/'));
const ignorate = new Set(git(['check-ignore', '--stdin'], dinPublic.map((c) => `public${c}`).join('\n')).split('\n').filter(Boolean).map((p) => p.slice('public'.length)));
proba(ignorate.size === 0, `dist/ n-are nimic din public/ gitignorat${ignorate.size ? `; are: ${scurt([...ignorate])}` : ''}`);
const neadaugate = git(['ls-files', '--others', '--exclude-standard', '--', 'public']).split('\n').filter(Boolean).map((p) => p.slice('public'.length));
if (neadaugate.length) console.log(`  !!   în dist/, dar încă neadăugate în git — Vercel le publică numai după git add și commit: ${neadaugate.join(', ')}`);
const HARTI_COD = toate.filter((c) => c.endsWith('.map'));
const CAI = ['/', ...toate.filter((c) => !ignorate.has(c) && !c.endsWith('.map') && c !== '/index.html')];
// Hărțile de cod intră numai în proba de cache: pe Vercel, publicul primește 403 pe ele.
const CAI_CACHE = [...CAI, ...HARTI_COD];
console.log(`${CAI.length} căi publicate (fără cele ${HARTI_COD.length} hărți de cod)`);

// ------------------------------------------------------------ cache-ul

const imutabil = (cc) => /\bimmutable\b/.test(cc ?? '') && Number(/max-age=(\d+)/.exec(cc ?? '')?.[1]) >= 31536000;
// Pe revalidare: browserul întreabă serverul la fiecare folosire. Un max-age lung fără
// `immutable` nu e revalidare: ar ține un nume rescris vechi la fel de mult.
const revalidat = (cc) => /\bno-cache\b/.test(cc) || /(^|[\s,])max-age=0\b/.test(cc);

/** Ce politică cere fiecare fel de fișier din /data. Un fel nou trebuie trecut aici. */
function clasaData(nume) {
  if (/^harta_v\d+-dem\.(bin|json)$/.test(nume)) return 'imutabil';
  // Regula din vercel.json mai prinde și `-mic`, varianta mică a lui harta_v9, scoasă din
  // depozit: un fișier care ar reveni cu numele ăsta e un fel nou și pică până i se hotărăște.
  if (/^harta_v\d+-orto_v\d+\.(ktx2|json)$/.test(nume)) return 'imutabil';
  if (/^(sanctuar|cladiri)_v\d+\.json$/.test(nume)) return 'imutabil';
  // NDVI-ul ia numele hărții, deci un strat refăcut n-ar avea unde primi alt nume;
  // paleta se reface sub același nume (`npm run paleta`) și are deja patru versiuni.
  if (/^harta_v\d+-ndvi\.(bin|json)$/.test(nume) || nume === 'paleta-teren.json') return 'revalidat';
  return null;
}

// Blobul fiecărui fișier din public/data, în tot istoricul: un nume imutabil n-are voie
// să fi avut două conținuturi, altfel cine l-a văzut pe primul nu-l mai primește pe al doilea.
const bloburi = new Map();
for (const linie of git(['log', '--all', '--no-renames', '--no-abbrev', '--raw', '--format=', '--', 'public/data']).split('\n')) {
  const m = /^:\d+ \d+ [0-9a-f]+ ([0-9a-f]+) \w+\t(.+)$/.exec(linie);
  if (!m) continue;
  if (/^0+$/.test(m[1])) continue; // ștergere
  if (!bloburi.has(m[2])) bloburi.set(m[2], new Set());
  bloburi.get(m[2]).add(m[1]);
}

/** Căile care încalcă politica de cache, după regulile date. */
function verificaCache(reguli) {
  const rele = [];
  for (const c of CAI_CACHE) {
    const cc = antetePentru(reguli, c)['cache-control'] ?? CACHE_IMPLICIT, e = imutabil(cc), v = revalidat(cc);
    if (!e && !v) { rele.push(`${c}: „${cc}” nu e nici imutabil, nici pe revalidare`); continue; }
    if (c === '/') { if (e) rele.push(`${c}: documentul imutabil`); continue; }
    // numele unei hărți de cod vine din hash-ul JS-ului: un commit numai cu comentarii
    // îi schimbă conținutul fără să-i schimbe numele
    if (c.endsWith('.map')) { if (e) rele.push(`${c}: harta de cod imutabilă`); continue; }
    if (c.startsWith('/assets/')) {
      if (!e) rele.push(`${c}: nu e imutabil`);
      if (!/-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/.test(c)) rele.push(`${c}: imutabil fără hash în nume`);
      continue;
    }
    if (c.startsWith('/data/')) {
      const nume = c.slice(6), clasa = clasaData(nume), p = `public${c}`;
      if (!clasa) { rele.push(`${c}: fel de fișier necunoscut probei; hotărăște-i politica în clasaData`); continue; }
      if ((clasa === 'imutabil') !== e) rele.push(`${c}: ${e ? 'imutabil' : 'pe revalidare'}, dar trebuie ${clasa}`);
      if (e) {
        const n = bloburi.get(p)?.size ?? 0;
        if (n > 1) rele.push(`${c}: imutabil, dar git i-a schimbat conținutul (${n} versiuni)`);
        const head = blobHead(p);
        if (head && blobPentru(p, readFileSync(p)) !== head) rele.push(`${c}: imutabil, dar rescris față de HEAD`);
      }
      continue;
    }
    if (e) rele.push(`${c}: imutabil, deși numele nu se schimbă la o versiune nouă`);
  }
  return rele;
}

const rele = verificaCache(REGULI);
for (const r of rele) proba(false, r);
const nrImutabile = CAI_CACHE.filter((c) => imutabil(antetePentru(REGULI, c)['cache-control'])).length;
proba(rele.length === 0, `cache: ${nrImutabile} căi imutabile, ${CAI_CACHE.length - nrImutabile} pe revalidare, conform politicii`);
const vechi = [...bloburi].filter(([, s]) => s.size > 1).map(([p]) => p.slice('public/data/'.length));
console.log(`        (în istoric, cu mai multe versiuni: ${vechi.join(', ') || 'niciunul'})`);

// Control: tot /data imutabil trebuie să pice pe paletă și pe NDVI.
{
  const cfg = structuredClone(CFG);
  cfg.headers = cfg.headers.filter((h) => !h.source.startsWith('/data/'));
  cfg.headers.unshift({ source: '/data/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] });
  const r = verificaCache(reguliVercel(cfg));
  proba(r.some((x) => x.startsWith('/data/paleta-teren.json')) && r.some((x) => /-ndvi\./.test(x)),
    `control: cu „/data/(.*)” imutabil pică ${r.length} căi, între ele paleta și NDVI-ul`);
}
// Control: fără regula de /assets, fișierele cu hash pică.
{
  const cfg = structuredClone(CFG);
  cfg.headers = cfg.headers.filter((h) => !h.source.startsWith('/assets/'));
  const r = verificaCache(reguliVercel(cfg));
  proba(r.some((x) => x.startsWith('/assets/')), `control: fără regula de /assets pică ${r.length} căi`);
}
// Control: tot /assets imutabil, cu hărțile de cod, pică pe hărți.
{
  const cfg = structuredClone(CFG);
  cfg.headers = cfg.headers.filter((h) => !h.source.startsWith('/assets/'));
  cfg.headers.unshift({ source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] });
  const r = verificaCache(reguliVercel(cfg));
  proba(HARTI_COD.length > 0 && r.length === HARTI_COD.length && r.every((x) => x.includes('.map')), `control: cu „/assets/(.*)” imutabil pică cele ${r.length} hărți de cod`);
}
// Control: un max-age de un an fără `immutable`, pe paletă și pe document, pică.
{
  const cfg = structuredClone(CFG);
  cfg.headers.unshift({ source: '/data/(paleta-teren[.]json)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000' }] },
    { source: '/', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] });
  const r = verificaCache(reguliVercel(cfg));
  proba(r.some((x) => x.startsWith('/data/paleta-teren.json')) && r.some((x) => x.startsWith('/:')), `control: max-age lung fără immutable, pe paletă și pe document, pică`);
}

// ------------------------------------------------------------ antetele de securitate

const SECURITATE = ['x-content-type-options', 'referrer-policy', 'permissions-policy'];
const fara = CAI.filter((c) => {
  const a = antetePentru(REGULI, c);
  return a['x-content-type-options'] !== 'nosniff' || SECURITATE.some((k) => !a[k])
    || !!a['content-security-policy'] === !!a['content-security-policy-report-only'];
});
proba(fara.length === 0, `antetele de securitate (nosniff, Referrer-Policy, Permissions-Policy și un singur CSP) pe toate căile${fara.length ? `; lipsesc pe ${scurt(fara)}` : ''}`);

// ------------------------------------------------------------ CSP-ul față de pagină

const directive = (csp) => Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k.toLowerCase(), v]));
const sursele = (d, ...lant) => d[lant.find((k) => d[k])] ?? [];
const transcodor = toate.some((c) => /^\/assets\/basis_transcoder-.*\.wasm$/.test(c));
const css = toate.filter((c) => c.endsWith('.css')).map((c) => readFileSync(`dist${c}`, 'utf8')).join('\n');
const cssData = /url\(\s*["']?data:/.test(css);

/** Ce lipsește din CSP față de ce face pagina. */
function nevoiCsp(csp) {
  const d = directive(csp), lipsa = [];
  const script = sursele(d, 'script-src', 'default-src');
  if (!script.includes("'self'")) lipsa.push("script-src fără 'self'");
  if (script.includes("'unsafe-inline'") || script.includes('*')) lipsa.push("script-src cu 'unsafe-inline' sau *");
  // embind din transcodorul Basis face new Function; WebAssembly cere și el eval
  if (transcodor && !script.includes("'unsafe-eval'")) lipsa.push("script-src fără 'unsafe-eval' (transcodorul KTX2)");
  if (!sursele(d, 'worker-src', 'child-src', 'script-src', 'default-src').includes('blob:')) lipsa.push('worker-src fără blob: (workerul KTX2Loader)');
  if (cssData && !sursele(d, 'img-src', 'default-src').includes('data:')) lipsa.push('img-src fără data: (cursoarele din CSS)');
  if (!sursele(d, 'connect-src', 'default-src').includes("'self'")) lipsa.push("connect-src fără 'self' (datele hărții)");
  if (!sursele(d, 'style-src', 'default-src').includes("'self'")) lipsa.push("style-src fără 'self'");
  return lipsa;
}
const cspAntet = Object.values(Object.fromEntries(Object.entries(antetePentru(REGULI, '/')).filter(([k]) => k.startsWith('content-security-policy'))))[0] ?? '';
const lipsaCsp = nevoiCsp(cspAntet);
proba(cspAntet && lipsaCsp.length === 0, `CSP-ul acoperă ce face pagina (transcodor: ${transcodor ? 'da' : 'nu'}, data: în CSS: ${cssData ? 'da' : 'nu'})${lipsaCsp.length ? `; ${lipsaCsp.join('; ')}` : ''}`);
proba(nevoiCsp(cspAntet.replace(" 'unsafe-eval'", '')).some((x) => x.includes('unsafe-eval')), "control: fără 'unsafe-eval' pică");
proba(nevoiCsp(cspAntet.replace(/ blob:/g, '')).some((x) => x.includes('blob:')), 'control: fără blob: pică');

// Marcajul și codul: nimic inline, ca politica să nu aibă nevoie de 'unsafe-inline'.
const html = readFileSync('dist/index.html', 'utf8');
const inlineHtml = [
  ...[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/g)].map(() => 'un <script> fără src'),
  ...[...html.matchAll(/<style\b/g)].map(() => 'un <style>'),
  ...[...html.matchAll(/\s(on[a-z]+|style)\s*=/g)].map((m) => `un atribut ${m[1]}=`),
];
proba(inlineHtml.length === 0, `dist/index.html fără scripturi, stiluri sau handlere inline${inlineHtml.length ? `: ${scurt(inlineHtml)}` : ''}`);
const STIL_INLINE = /<[a-z][^>]*\s(style|on[a-z]+)\s*=|setAttribute\(\s*['"](style|on[a-z]+)['"]/;
const surse = [];
(function umbla(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) umbla(p);
    else if (f.endsWith('.js')) surse.push(p);
  }
})('src');
const cuInline = surse.filter((p) => STIL_INLINE.test(readFileSync(p, 'utf8')));
proba(cuInline.length === 0, `src/: niciun atribut style= sau on…= în marcajul scris din cod (${surse.length} fișiere)${cuInline.length ? `; îl au ${cuInline.join(', ')}` : ''}`);
proba(STIL_INLINE.test('<div class="bara" style="background: red"></div>'), 'control: legenda veche din previzualizare.js, cu style= în innerHTML, e prinsă');

// ------------------------------------------------------------ browserele vechi și plasa

// three r186 are șase blocuri `static {}`; Safari și iOS le parsează abia de la 16.4, iar un
// modul care nu se parsează oprește tot graful: pagina rămânea goală, fără niciun mesaj. Ținta
// din vite.config.js le coboară. Numărate cu parserul lui Vite, în JS-ul livrat.
{
  const { parseAst, transformWithOxc } = await import('vite');
  const noduri = (src, tipuri) => {
    const gasite = [];
    const umbla = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(umbla); return; }
      if (tipuri(o)) gasite.push(o.type === 'VariableDeclaration' ? `${o.type} ${o.kind}` : o.type);
      for (const k in o) if (k !== 'type') umbla(o[k]);
    };
    umbla(parseAst(src));
    return gasite;
  };
  const blocuri = (src) => noduri(src, (o) => o.type === 'StaticBlock').length;
  const js = toate.filter((c) => c.startsWith('/assets/') && c.endsWith('.js'));
  const cu = js.map((c) => [c, blocuri(readFileSync(`dist${c}`, 'utf8'))]).filter(([, n]) => n > 0);
  proba(js.length > 0 && cu.length === 0, `blocuri \`static {}\` în dist/assets: ${cu.length ? cu.map(([c, n]) => `${n} în ${c}`).join(', ') : `0, în ${js.length} fișiere JS`}`);
  const three = readFileSync('node_modules/three/build/three.core.js', 'utf8');
  const vechi = blocuri((await transformWithOxc(three, 'three.core.js', { target: 'es2022' })).code);
  proba(vechi > 0, `control, three.core trecut prin ținta de dinainte (es2022): ${vechi} blocuri — pică`);

  // Plasa de siguranță (public/plasa.js): un script clasic, cu `defer`, care la `load` scrie
  // „Harta 3D nu a putut porni.” dacă modulul n-a pornit. Trebuie să se parseze și unde
  // modulul nu se parsează, deci fără sintaxă de după ES5. Listă de forme PERMISE, nu de
  // interzise: un nod pe care lista nu-l știe pică, deci o formă nouă nu trece neobservată.
  // Ce nu lasă urmă în arbore nu se vede: virgula de după ultimul parametru (ES2017).
  const ES5 = new Set(['Program', 'ExpressionStatement', 'BlockStatement', 'EmptyStatement', 'DebuggerStatement',
    'ReturnStatement', 'LabeledStatement', 'BreakStatement', 'ContinueStatement', 'IfStatement', 'SwitchStatement',
    'SwitchCase', 'ThrowStatement', 'TryStatement', 'CatchClause', 'WhileStatement', 'DoWhileStatement', 'ForStatement',
    'ForInStatement', 'FunctionDeclaration', 'FunctionExpression', 'VariableDeclaration', 'VariableDeclarator',
    'ThisExpression', 'ArrayExpression', 'ObjectExpression', 'Property', 'UnaryExpression', 'UpdateExpression',
    'BinaryExpression', 'AssignmentExpression', 'LogicalExpression', 'MemberExpression', 'ConditionalExpression',
    'CallExpression', 'NewExpression', 'SequenceExpression', 'Identifier', 'Literal']);
  const ATRIBUIRI_ES5 = new Set(['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=', '|=', '^=', '&=']);
  const nuEsteES5 = (o) => {
    if (typeof o.type !== 'string') return false;
    if (!ES5.has(o.type)) return true;
    switch (o.type) {
      case 'VariableDeclaration': return o.kind !== 'var';
      case 'FunctionDeclaration': case 'FunctionExpression': return Boolean(o.async || o.generator);
      case 'Property': return Boolean(o.method || o.shorthand || o.computed) || !['init', 'get', 'set'].includes(o.kind);
      case 'CatchClause': return !o.param;
      case 'BinaryExpression': return o.operator === '**';
      case 'AssignmentExpression': return !ATRIBUIRI_ES5.has(o.operator);
      case 'LogicalExpression': return o.operator !== '&&' && o.operator !== '||';
      case 'MemberExpression': case 'CallExpression': return Boolean(o.optional);
      case 'Literal': return typeof o.value === 'bigint' || /[^gim]/.test(o.regex?.flags ?? '')
        || (typeof o.value === 'number' && /_|^0[bBoO]/.test(o.raw ?? '')) || /\\u\{/.test(o.raw ?? '');
      default: return false;
    }
  };
  const moderne = (src) => { try { return noduri(src, nuEsteES5); } catch (e) { return [`neparsat: ${e.message}`]; } };
  const plasa = existsSync('dist/plasa.js') ? readFileSync('dist/plasa.js', 'utf8') : '';
  const m = moderne(plasa);
  proba(plasa && m.length === 0, `plasa.js publicată și scrisă în ES5${m.length ? `; are ${[...new Set(m)].join(', ')}` : ''}`);
  // Controalele: fiecare formă de după ES5 pică singură; o bucată de ES5 cu tot ce are el mai
  // rar — getteri, for-in, etichete, regex /gim, hexazecimal, virgula ca operator — trece.
  const NOI = ['const a = 1;', 'let a = 1;', 'var f = () => 1;', 'var s = `x`;', 'var t = tag`x`;', 'var a = b ?? c;',
    'try {} catch {}', 'function f(a = 1) {}', 'function f(...a) {}', 'f(...a);', 'function* g() {}', 'async function h() {}',
    'var o = { a };', 'var o = { b() {} };', 'var o = { [k]: 1 };', 'function F() { return new.target; }', 'class A {}',
    'var r = /a/u;', 'var r = /a/y;', 'var r = /a/s;', 'var n = 0b101;', 'var n = 0o17;', 'var n = 1_000;', 'var n = 10n;',
    'var s = "\\u{1F600}";', 'var x = 2 ** 3;', 'x **= 2;', 'x ??= 1;', 'x ||= 1;', 'var a = o?.b;', 'var a = f?.();',
    'for (var x of y) {}', 'var [a] = b;', 'var { a } = b;', 'label: { await x; }'];
  const scapate = NOI.filter((s) => moderne(s).length === 0);
  proba(scapate.length === 0, `control, ${NOI.length - scapate.length} din ${NOI.length} forme de după ES5 prinse, fiecare singură${scapate.length ? `; SCAPĂ: ${scapate.join('  ')}` : ''}`);
  const VECHI = "'use strict'; var o = { get a() { return 1; }, set a(v) {}, b: function () {}, 'c': 2, 3: 4 };\n"
    + 'for (var k in o) { if (!o.hasOwnProperty(k)) continue; }\nlbl: for (var i = 0; i < 2; i++) { break lbl; }\n'
    + "var r = /a+/gim, n = 0x1f + 1e3 + .5, s = 'x\\u00e9';\ntry { throw new Error('x'); } catch (e) { void e; } finally {}\n"
    + 'switch (n) { case 1: break; default: }\ndo { i--; } while (i > 0);\n'
    + "var f = function g(a, b) { return typeof a === 'undefined' ? b : (a, b); };\nx = y || z && !w; x += 1; x >>>= 1; delete o.a; new Date;";
  const vechi5 = moderne(VECHI);
  proba(vechi5.length === 0, `control, ES5 cu getteri, for-in, etichete, /gim și hexazecimal trece: ${vechi5.length ? `PRINS ${vechi5.join(', ')}` : '0 noduri prinse'}`);
  const tag = /<script\b[^>]*\bsrc="\/plasa\.js"[^>]*>/.exec(html)?.[0] ?? '';
  const intrare = /\/assets\/index-[\w-]+\.js/.exec(html)?.[0];
  const semnal = intrare && readFileSync(`dist${intrare}`, 'utf8').includes('__modulPornit') && plasa.includes('window.__modulPornit');
  // Mesajul de încărcare (vezi „Pornirea”): un <div id="incarcare"> cu paragraful anunțat
  // (`role="status"`), în care procentul stă într-un <span aria-hidden="true"> gol — cititorul de
  // ecran aude numai faza —, și butonul „Arată relieful acum”, ascuns până la faza fotografiei.
  // Fără atribute de stil sau handlere: le prinde și proba de mai sus, pe tot documentul.
  const mesajNou = (h) => {
    const div = /<div id="incarcare">([\s\S]*?)<\/div>/.exec(h)?.[1] ?? null;
    const p = div && /^\s*<p role="status">([^<]+)<span aria-hidden="true"><\/span><\/p>/.exec(div);
    const buton = div && /<button type="button" hidden>([^<]+)<\/button>\s*$/.exec(div);
    return { ok: Boolean(p && buton && !/\s(style|on[a-z]+)\s*=/.test(div)), text: p?.[1] ?? null, buton: buton?.[1] ?? null };
  };
  const mesaj = mesajNou(html);
  proba(tag && /\bdefer\b/.test(tag) && !/type=/.test(tag) && semnal && mesaj.ok && mesaj.text === 'Se încarcă harta 3D…' && mesaj.buton === 'Arată relieful acum',
    `index.html: plasa clasică, cu defer (${tag || 'LIPSĂ'}); semnul __modulPornit în ${intrare ?? 'intrare LIPSĂ'} și în plasă: ${semnal ? 'da' : 'NU'}; mesajul de încărcare: ${mesaj.ok ? `„${mesaj.text}” cu role="status" pe paragraf, procentul aria-hidden, butonul „${mesaj.buton}” ascuns` : 'NU în forma cerută'}`);
  // Controale: marcajul de dinainte (un singur <p>, fără buton) și un buton fără `hidden`, care s-ar
  // vedea de la început.
  const mesajVechi = mesajNou('<p id="incarcare" role="status">Se încarcă harta 3D…</p>');
  const vizibil = mesajNou(html.replace('<button type="button" hidden>', '<button type="button">'));
  proba(!mesajVechi.ok && !vizibil.ok, `control, marcajul de dinainte și butonul fără \`hidden\`: ${mesajVechi.ok ? 'TRECE' : 'pică'} / ${vizibil.ok ? 'TRECE' : 'pică'}`);
}

// Simularea regulilor refuză ce nu înțelege, în loc să potrivească greșit.
const arunca = (f) => { try { f(); return false; } catch { return true; } };
proba(['/data/:fisier', '/data/(a(b))', '/data/(x)?', '/data/(?:x)', '/data/()'].every((s) => arunca(() => regexSursa(s))),
  'simularea lui path-to-regexp refuză :nume, grupurile care capturează, modificatorii, grupul care începe cu ? și grupul gol');

// ------------------------------------------------------------ garda numelor publicate

{
  const p = 'public/data/harta_v7-orto_v1.json', inainte = readFileSync(p), timp = statSync(p).mtimeMs;
  proba(scrieNepublicat(p, inainte) === false && statSync(p).mtimeMs === timp, `garda: ${p}, cu aceiași octeți, rămâne nescris`);
  proba(arunca(() => scrieNepublicat(p, Buffer.concat([inainte, Buffer.from(' ')]))) && readFileSync(p).equals(inainte),
    'garda: același nume cu un octet în plus aruncă înainte de scriere');
  {
    // O copie locală stricată, cu conținutul nou egal cu cel publicat, se reface. Se
    // încearcă într-un depozit de unică folosință, ca proba să nu atingă public/.
    const d = mkdtempSync(join(tmpdir(), 'garda-'));
    const g = (...a) => spawnSync('git', ['-c', 'user.name=proba', '-c', 'user.email=proba@local', ...a], { cwd: d, encoding: 'utf8' });
    g('init', '-q'); writeFileSync(join(d, 'a.ktx2'), 'KTX publicat'); g('add', '.'); g('commit', '-q', '-m', 'p');
    writeFileSync(join(d, 'a.ktx2'), 'KTX stricat');
    const cod = `import { scrieNepublicat } from ${JSON.stringify(pathToFileURL(resolve('scripts/comun/publicat.mjs')).href)};\n` +
      "console.log('ÎNTORS', scrieNepublicat('a.ktx2', 'KTX publicat'), scrieNepublicat('a.ktx2', 'KTX publicat'));";
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', cod], { cwd: d, encoding: 'utf8' });
    const disc = readFileSync(join(d, 'a.ktx2'), 'utf8'), stare = g('status', '--porcelain').stdout.trim();
    rmSync(d, { recursive: true, force: true });
    proba(/ÎNTORS true false/.test(r.stdout) && disc === 'KTX publicat' && stare === '',
      `garda: o copie locală care diferă de HEAD se reface, iar a doua oară rămâne nescrisă (${r.stdout.match(/ÎNTORS.*/)?.[0] ?? r.stderr.trim().split('\n').at(-1)})`);
  }
  const nou = 'dist/.proba-garda.json';
  proba(scrieNepublicat(nou, '{}') === true && existsSync(nou), 'garda: un nume care nu e în HEAD se scrie');
  unlinkSync(nou);
  // Cu core.autocrlf, paleta iese la checkout cu CRLF, iar în depozit are LF: comparată ca
  // octeți bruți, ar părea rescrisă. Garda o compară ca blob, după filtrele git. Martorul e
  // forma de checkout a lui HEAD, nu discul: paleta are voie să se schimbe (`npm run paleta`).
  const pal = 'public/data/paleta-teren.json';
  const b = spawnSync('git', ['cat-file', '--filters', `HEAD:${pal}`]).stdout;
  const brut = git(['hash-object', '--no-filters', '--stdin'], b).trim();
  proba(blobPentru(pal, b) === blobHead(pal), `garda: paleta din HEAD, în forma de checkout, e recunoscută ca publicată${brut !== blobHead(pal) ? ' (control: ca octeți bruți diferă — capetele de rând)' : ''}`);
}

// ------------------------------------------------------------ pagina publicată

const iLive = process.argv.indexOf('--live');
if (iLive >= 0) {
  const origine = (process.argv[iLive + 1] ?? 'https://sebastians.life').replace(/\/$/, '');
  console.log(`\npe ${origine}:`);
  const doc = await fetch(origine + '/');
  const intrare = (h) => /\/assets\/index-[\w-]+\.js/.exec(h)?.[0];
  const viu = intrare(await doc.text()), local = intrare(html);
  proba(viu === local, `pagina publicată e același build ca dist/ (${viu ?? 'fără intrare'} față de ${local})`);
  const nepotrivite = [];
  for (const c of CAI) {
    const r = await fetch(origine + c, { method: 'HEAD', redirect: 'manual' });
    const a = Object.fromEntries(r.headers), e = antetePentru(REGULI, c);
    const asteptat = { 'cache-control': CACHE_IMPLICIT, ...e };
    const dif = r.status !== 200 ? [`HTTP ${r.status}`] : Object.entries(asteptat).filter(([k, v]) => a[k] !== v).map(([k]) => `${k}: „${a[k] ?? '(lipsă)'}”`);
    if (dif.length) nepotrivite.push(`${c} → ${dif.join('; ')}`);
  }
  for (const n of nepotrivite.slice(0, 12)) console.log(`        ${n}`);
  proba(nepotrivite.length === 0, `antetele de pe ${CAI.length} căi sunt cele din vercel.json${nepotrivite.length ? ` (${nepotrivite.length} diferă)` : ''}`);
  if (HARTI_COD.length && viu) {
    // harta intrării publicate, nu a celei locale: dacă build-urile diferă, numele diferă
    const r = await fetch(`${origine}${viu}.map`, { method: 'HEAD', redirect: 'manual' });
    proba(r.status === 403, `hărțile de cod sunt închise publicului (Protected Source Maps): ${viu}.map → HTTP ${r.status}`);
  }
}

console.log(picate ? `\n${picate} probe au picat` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
