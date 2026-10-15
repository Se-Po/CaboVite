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
//   - garda numelor publicate (scripts/comun/publicat.mjs);
//   - titlul paginii (`h1`) și `<noscript>`, în sursă și în dist/, în afara lui `#continut`.
// Fiecare probă de fond are un control negativ: aceeași probă pe o greșeală cunoscută
// trebuie să pice.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CACHE_IMPLICIT, antetePentru, regexSursa, reguliVercel } from './comun/vercel.mjs';
import { blobHead, blobPentru, scrieNepublicat } from './comun/publicat.mjs';
import { proba, rezumat } from './comun/proba.mjs';

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
  // Mesajul de încărcare (`docs/pornirea.md`, „Pornirea: mesajul de încărcare și plasa”): un
  // <div id="incarcare"> cu paragraful anunțat (`role="status"`), în care procentul stă într-un
  // <span aria-hidden="true"> gol — cititorul de ecran aude numai faza —, și butonul
  // „Arată relieful acum”, ascuns până la faza fotografiei.
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

// ------------------------------------------------------------ titlul și <noscript>

// Pagina are un titlu (`<h1>`, ascuns vizual) și, fără JavaScript, o propoziție (`<noscript>`), amândouă în
// afara lui `<main id="continut">`, care rămâne gol: main.js scrie calea fără scenă numai într-un
// `#continut` gol, iar cu JavaScript pornit conținutul lui <noscript> e text
// (`docs/pornirea.md`, „Titlul și pagina fără scenă”). În sursă și în ce publică build-ul.
// Controale: index.html de la 6ad3a47, fără ele, și titlul pus în `#continut`.
{
  const titlu = (h) => {
    const main = /<main id="continut">([\s\S]*?)<\/main>/.exec(h);
    const h1 = [...h.matchAll(/<h1\b[^>]*>([^<]*)<\/h1>/g)];
    const ns = [...h.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)];
    return { main: Boolean(main), gol: main?.[1] === '', h1: h1.length, text: h1[0]?.[1] ?? null, ascuns: /<h1 class="ascuns">/.test(h),
      noscript: ns.length, propozitie: ns[0]?.[1].replace(/<[^>]+>/g, '').trim() ?? '' };
  };
  const bun = (x) => x.main && x.gol && x.h1 === 1 && x.text === 'Cabo Espichel' && x.ascuns && x.noscript === 1 && x.propozitie.length > 0;
  const descrie = (x) => `h1 ${x.h1}${x.text ? ` „${x.text}”${x.ascuns ? ', ascuns vizual' : ''}` : ''}, <noscript> ${x.noscript}${x.propozitie ? ` („${x.propozitie}”)` : ''}, <main id="continut"> ${x.main ? (x.gol ? 'gol' : 'CU CONȚINUT') : 'LIPSĂ'}`;
  for (const [nume, h] of [['index.html', readFileSync('index.html', 'utf8')], ['dist/index.html', html]]) {
    const x = titlu(h);
    proba(bun(x), `${nume}: ${descrie(x)}`);
  }
  const vechi = git(['show', '6ad3a47:index.html']);
  const v = titlu(vechi ?? '');
  proba(Boolean(vechi) && !bun(v), `control, index.html de la 6ad3a47: ${vechi ? descrie(v) : 'NECITIT'} — pică`);
  // Mutația se aplică întreagă sau deloc: altfel ar pica din alt motiv (două titluri).
  const HEADER = '<header><h1 class="ascuns">Cabo Espichel</h1></header>', MAIN = '<main id="continut"></main>';
  const inMain = html.includes(HEADER) && html.includes(MAIN)
    ? titlu(html.replace(HEADER, '').replace(MAIN, '<main id="continut"><h1 class="ascuns">Cabo Espichel</h1></main>')) : null;
  proba(inMain !== null && !bun(inMain), `control, titlul pus în #continut: ${inMain === null ? 'MUTAȚIA NU S-A APLICAT' : descrie(inMain)} — pică`);
}

// ------------------------------------------------------------ imaginea de previzualizare (og:image)

// index.html numește imaginea de previzualizare (`og:image`), cu adresa absolută pe domeniu, tipul,
// dimensiunile și textul alternativ; `twitter:card` cere imaginea mare. Fișierul, scris de
// `npm run captura-og`, trebuie să fie chiar acela: JPEG, cu dimensiunile din antetul lui (SOF),
// 1200 × 630, cel mult 300 KB. Textul alternativ numește fiecare sursă cu licența ei — DGT cu
// CC BY 4.0, Copernicus, OpenStreetMap cu ODbL —, pentru cine nu vede imaginea.
//
// Fișierul poartă și el atribuirea întreagă, ca XMP, ca s-o aibă și salvat singur. Cititorul de
// aici e al probei, independent de captura-og (care scrie din modala paginii), și citește cum
// citește un cititor XMP: un singur segment înaintea imaginii, în xpacket; XML bine format, cu
// spațiile de nume (prefixe declarate, atribute unice, o singură rădăcină); structura
// x:xmpmeta > rdf:RDF > rdf:Description; proprietățile după URI-ul spațiului de nume, nu după
// prefix. Referința se calculează aici:
// - în `dc:rights`: textul SNIG (scris aici, din metadatele SNIG — niciun sidecar nu-l are),
//   fiecare `atributie` și `raspundere` ale sidecarurilor din public/data — depozitul ține exact
//   hărțile pe care le încarcă pagina — și nota „Prelucrate pentru această pagină: …”, cu o listă
//   care nu e goală (CC BY cere să se spună ce s-a schimbat; frazele le scrie scena, la rulare,
//   deci nu au referință în sidecaruri);
// - în `xmpRights:UsageTerms`: adresele CC BY 4.0 și ODbL 1.0 (scrise aici; sidecarurile le dau
//   numai numele), fiecare `licenta_url` și fiecare `portal`;
// - `dc:description` e chiar `og:image:alt`, iar `xmpRights:WebStatement`, `og:url`.
// O sursă nouă sau un text alternativ schimbat cer deci o captură nouă.
//
// În sursă (cu public/) și în build (cu dist/). Controale, fiecare cu problema pe care trebuie s-o
// numească: pe marcaj, zece index.html stricate; pe fișier, JPEG-uri stricate în memorie — alte
// dimensiuni în SOF, peste prag, un PNG sub numele lui; XMP-ul lipsă, dublat, fără xpacket, fără
// textul SNIG, fără o atribuire, fără prelucrări, fără o licență, fără un portal, cu altă pagină,
// cu descrierea veche; XML rupt, un prefix nedeclarat, un atribut dublat, a doua rădăcină,
// dc:rights în afara rdf:Description, URI-ul xmpRights greșit.
const OG = { domeniu: 'https://sebastians.life/', W: 1200, H: 630, kb: 300 };
const ALT_OG = ['DGT', 'CC BY 4.0', 'Copernicus', 'OpenStreetMap', 'ODbL'];
const meta = (h, k) => new RegExp(`<meta (?:property|name)="${k.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`).exec(h)?.[1] ?? null;
const SNIG = 'Informação geográfica cedida pela Direção-Geral do Território';
const NS_XMP = 'http://ns.adobe.com/xap/1.0/\0';
// Spațiile de nume, din specificația XMP (ISO 16684-1) și din Dublin Core.
const NS = {
  x: 'adobe:ns:meta/', rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', xml: 'http://www.w3.org/XML/1998/namespace',
  dc: 'http://purl.org/dc/elements/1.1/', xmpRights: 'http://ns.adobe.com/xap/1.0/rights/', photoshop: 'http://ns.adobe.com/photoshop/1.0/',
};
/** Ce trebuie să ducă XMP-ul, din sidecaruri (adresele normalizate ca în pagină, `new URL().href`). */
const REF_XMP = (() => {
  const din = { drepturi: new Set(), licente: new Set(), portaluri: new Set() };
  const adresa = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
  const umbla = (o) => {
    if (Array.isArray(o)) { o.forEach(umbla); return; }
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v !== 'string') umbla(v);
      else if (k === 'atributie' || k === 'raspundere') din.drepturi.add(v);
      else if (k === 'licenta_url' && adresa(v)) din.licente.add(adresa(v));
      else if (k === 'portal' && adresa(v)) din.portaluri.add(adresa(v));
    }
  };
  for (const f of readdirSync('public/data').filter((n) => n.endsWith('.json'))) umbla(JSON.parse(readFileSync(`public/data/${f}`, 'utf8')));
  const fixe = { drepturi: [SNIG], licente: ['https://creativecommons.org/licenses/by/4.0/', 'https://opendatacommons.org/licenses/odbl/1-0/'] };
  const licente = new Set([...fixe.licente, ...din.licente]);
  return {
    drepturi: [...fixe.drepturi, ...din.drepturi],
    termeni: [...licente, ...din.portaluri],
    descrie: `în dc:rights textul SNIG, ${din.drepturi.size} atribuiri și clauze din sidecaruri și nota prelucrărilor; `
      + `în UsageTerms ${licente.size} adrese de licențe (CC BY 4.0 și ODbL 1.0 cerute aici, restul din licenta_url) și ${din.portaluri.size} portaluri`,
  };
})();
/** Segmentele APP1 cu XMP de dinaintea imaginii (până la SOF sau SOS): `{ i, L, pachet }`. */
const segmenteXmp = (b) => {
  const g = [];
  for (let i = 2; i + 4 <= b.length;) {
    if (b[i] !== 0xff) break;
    if (b[i + 1] === 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xda || (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))) break;
    const L = b.readUInt16BE(i + 2);
    if (m === 0xe1 && b.toString('latin1', i + 4, i + 4 + NS_XMP.length) === NS_XMP) g.push({ i, L, pachet: b.toString('utf8', i + 4 + NS_XMP.length, i + 2 + L) });
    i += 2 + L;
  }
  return g;
};
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const textXml = (s) => s.replace(/&(#x[\da-fA-F]+|#\d+|\w+);/g, (_, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e]));
/**
 * Un XML mic, citit cu spațiile de nume: `{ radacina }`, cu elemente `{ nume, uri, local, atr, copii,
 * text }` (`atr`: „URI local” → valoare), sau `{ eroare }`. Cere o singură rădăcină, etichetele
 * închise în ordine, numai entitățile XML, fiecare prefix declarat (`xml` e predeclarat) și
 * atributele unice, și după nume, și după spațiul de nume. Comentariile, CDATA și DTD-urile nu le
 * citește: le refuză, ca orice nu înțelege.
 */
const citesteXml = (x) => {
  const re = /<\?[\s\S]*?\?>|<(\/?)([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*"[^"<]*")*)\s*(\/?)>|([^<]+)/y;
  const ent = (s) => /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(s);
  const rezolva = (nume, ns, atribut) => {
    const [p, l] = nume.includes(':') ? nume.split(':') : [null, nume];
    if (p === 'xml') return { uri: NS.xml, local: l };
    if (p === null) return { uri: atribut ? '' : ns.get('') ?? '', local: l };
    return ns.has(p) ? { uri: ns.get(p), local: l } : null;
  };
  const radacini = [], stiva = [];
  for (let p = 0; p < x.length;) {
    re.lastIndex = p;
    const m = re.exec(x);
    if (!m) return { eroare: `nimic de citit la ${p}` };
    p = re.lastIndex;
    if (m[5] !== undefined) {
      if (ent(m[5])) return { eroare: 'un & fără entitate' };
      if (stiva.length) stiva.at(-1).text += textXml(m[5]);
      else if (m[5].trim()) return { eroare: 'text în afara rădăcinii' };
      continue;
    }
    if (!m[2]) continue; // o instrucțiune de procesare (xpacket)
    if (m[1]) {
      if (stiva.pop()?.nume !== m[2]) return { eroare: `</${m[2]}> închide altceva` };
      continue;
    }
    if (!stiva.length && radacini.length) return { eroare: `a doua rădăcină, <${m[2]}>` };
    const brute = [...m[3].matchAll(/([A-Za-z_][\w.:-]*)\s*=\s*"([^"<]*)"/g)].map((a) => [a[1], a[2]]);
    if (new Set(brute.map(([k]) => k)).size !== brute.length) return { eroare: `atribut dublat în <${m[2]}>` };
    if (brute.some(([, v]) => ent(v))) return { eroare: `un & fără entitate în <${m[2]}>` };
    const ns = new Map(stiva.at(-1)?.ns ?? []);
    for (const [k, v] of brute) if (k === 'xmlns') ns.set('', textXml(v)); else if (k.startsWith('xmlns:')) ns.set(k.slice(6), textXml(v));
    const r = rezolva(m[2], ns, false);
    if (!r) return { eroare: `prefix nedeclarat în <${m[2]}>` };
    const atr = new Map();
    for (const [k, v] of brute) {
      if (k === 'xmlns' || k.startsWith('xmlns:')) continue;
      const ra = rezolva(k, ns, true);
      if (!ra) return { eroare: `prefix nedeclarat în atributul ${k}` };
      if (atr.has(`${ra.uri} ${ra.local}`)) return { eroare: `atribut dublat (după spațiul de nume) în <${m[2]}>` };
      atr.set(`${ra.uri} ${ra.local}`, textXml(v));
    }
    const e = { nume: m[2], ...r, ns, atr, copii: [], text: '' };
    (stiva.at(-1)?.copii ?? radacini).push(e);
    if (!m[4]) stiva.push(e);
  }
  if (stiva.length) return { eroare: `<${stiva.at(-1).nume}> neînchis` };
  return radacini.length === 1 ? { radacina: radacini[0] } : { eroare: 'fără rădăcină' };
};
/**
 * Proprietățile XMP: x:xmpmeta > un rdf:RDF > rdf:Description-uri cu rdf:about; fiecare
 * proprietate, element sau atribut, după „URI local”. `{ prop }` sau `{ eroare }`.
 */
const proprietatiXmp = (rad) => {
  if (rad.uri !== NS.x || rad.local !== 'xmpmeta') return { eroare: 'rădăcina nu e x:xmpmeta' };
  if (rad.copii.length !== 1 || rad.copii[0].uri !== NS.rdf || rad.copii[0].local !== 'RDF') return { eroare: 'x:xmpmeta nu are exact un rdf:RDF' };
  const desc = rad.copii[0].copii;
  if (!desc.length || desc.some((d) => d.uri !== NS.rdf || d.local !== 'Description')) return { eroare: 'rdf:RDF are altceva decât rdf:Description' };
  if (desc.some((d) => !d.atr.has(`${NS.rdf} about`))) return { eroare: 'rdf:Description fără rdf:about' };
  const prop = new Map();
  for (const d of desc) {
    for (const [k, v] of d.atr) if (!k.startsWith(`${NS.rdf} `)) prop.set(k, { copii: [], text: v });
    for (const c of d.copii) prop.set(`${c.uri} ${c.local}`, c);
  }
  return { prop };
};
/** Valoarea unei proprietăți: textul ei simplu sau `rdf:li` x-default din `rdf:Alt`; null dacă lipsește. */
const valoareXmp = (prop, uri, local) => {
  const c = prop.get(`${uri} ${local}`);
  if (!c) return null;
  if (!c.copii.length) return c.text;
  const alt = c.copii.length === 1 && c.copii[0].uri === NS.rdf && c.copii[0].local === 'Alt' ? c.copii[0] : null;
  return alt?.copii.find((l) => l.uri === NS.rdf && l.local === 'li' && l.atr.get(`${NS.xml} lang`) === 'x-default')?.text ?? null;
};
/** Primul marcaj SOF al unui JPEG: `{ W, H, i }`, cu `i` poziția marcajului; null dacă nu e JPEG. */
const dimJpeg = (b) => {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    if (b[i + 1] === 0xff) { i++; continue; } // octeți de umplere înaintea marcajului (T.81, B.1.1.2)
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { W: b.readUInt16BE(i + 7), H: b.readUInt16BE(i + 5), i };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
};
const deLaDisc = (dir) => (cale) => (existsSync(`${dir}/${cale}`) ? readFileSync(`${dir}/${cale}`) : null);
const imagineaOg = (h, citeste) => {
  const url = meta(h, 'og:image'), alt = meta(h, 'og:image:alt') ?? '';
  const cale = url?.startsWith(OG.domeniu) ? url.slice(OG.domeniu.length) : null;
  const b = cale ? citeste(cale) : null, d = b ? dimJpeg(b) : null;
  const probleme = [];
  if (!url) probleme.push('fără og:image');
  else if (!cale) probleme.push(`adresa „${url}” nu e absolută pe ${OG.domeniu}`);
  else if (!b) probleme.push(`${cale} lipsește`);
  if (b && !d) probleme.push('fișierul nu e JPEG');
  if (meta(h, 'og:image:type') !== 'image/jpeg') probleme.push(`og:image:type „${meta(h, 'og:image:type')}”`);
  if (Number(meta(h, 'og:image:width')) !== OG.W || Number(meta(h, 'og:image:height')) !== OG.H) probleme.push(`meta ${meta(h, 'og:image:width')} × ${meta(h, 'og:image:height')}, nu ${OG.W} × ${OG.H}`);
  if (d && (d.W !== OG.W || d.H !== OG.H)) probleme.push(`fișierul are ${d.W} × ${d.H}`);
  if (b && b.length > OG.kb * 1000) probleme.push(`${(b.length / 1000).toFixed(0)} KB, peste ${OG.kb}`);
  for (const s of ALT_OG) if (!alt.includes(s)) probleme.push(`textul alternativ nu numește ${s}`);
  if (meta(h, 'twitter:card') !== 'summary_large_image') probleme.push(`twitter:card „${meta(h, 'twitter:card')}”`);
  // XMP-ul
  const xmp = d ? segmenteXmp(b) : [], p = xmp[0]?.pachet ?? '';
  if (d && xmp.length !== 1) probleme.push(xmp.length ? `fișierul are ${xmp.length} segmente XMP` : 'fișierul n-are XMP');
  if (xmp.length) {
    if (!/^<\?xpacket begin="﻿?" id="W5M0MpCehiHzreSzNTczkc9d"\?>/.test(p) || !/<\?xpacket end="[rw]"\?>\s*$/.test(p)) probleme.push('XMP-ul n-are învelișul xpacket');
    const doc = citesteXml(p), x = doc.radacina ? proprietatiXmp(doc.radacina) : null;
    if (doc.eroare) probleme.push(`XMP-ul nu e XML bine format: ${doc.eroare}`);
    else if (x.eroare) probleme.push(`XMP-ul n-are structura XMP: ${x.eroare}`);
    else {
      const v = (pre, local) => {
        const val = valoareXmp(x.prop, NS[pre], local);
        if (val === null) probleme.push(`XMP-ul n-are ${pre}:${local} (${NS[pre]})`);
        return val;
      };
      const drepturi = v('dc', 'rights'), termeni = v('xmpRights', 'UsageTerms');
      if (drepturi !== null) for (const s of REF_XMP.drepturi) if (!drepturi.includes(s)) probleme.push(`XMP-ul (dc:rights) n-are „${s.slice(0, 48)}${s.length > 48 ? '…' : ''}”`);
      if (drepturi !== null && !/Prelucrate pentru această pagină: [^.;]+(?:; [^.;]+)*\./.test(drepturi)) probleme.push('XMP-ul (dc:rights) n-are lista prelucrărilor');
      if (termeni !== null) for (const s of REF_XMP.termeni) if (!termeni.includes(s)) probleme.push(`XMP-ul (xmpRights:UsageTerms) n-are ${s}`);
      const descriere = v('dc', 'description'), pagina = v('xmpRights', 'WebStatement');
      if (descriere !== null && descriere !== meta(h, 'og:image:alt')) probleme.push('descrierea din XMP (dc:description) diferă de og:image:alt (cere o captură nouă)');
      if (pagina !== null && pagina !== meta(h, 'og:url')) probleme.push('xmpRights:WebStatement diferă de og:url');
    }
  }
  return { url, kb: b ? +(b.length / 1000).toFixed(1) : null, d, xmp: xmp.length === 1 ? Buffer.byteLength(p) : null, probleme };
};
{
  const src = readFileSync('index.html', 'utf8');
  for (const [nume, h, dir] of [['index.html', src, 'public'], ['dist/index.html', html, 'dist']]) {
    const x = imagineaOg(h, deLaDisc(dir));
    proba(x.probleme.length === 0, `${nume}: og:image ${x.url}, ${x.d ? `${x.d.W} × ${x.d.H}` : 'fără dimensiuni'}, ${x.kb} KB, textul alternativ cu ${ALT_OG.join(', ')}, twitter:card; `
      + `XMP ${x.xmp ?? '—'} octeți: ${REF_XMP.descrie}${x.probleme.length ? `; ${x.probleme.join('; ')}` : ''}`);
  }
  const LINIE = /[ \t]*<meta property="og:image" content="[^"]*" \/>\r?\n/;
  const inlocuieste = (a, b) => (html.includes(a) ? html.replace(a, b) : null);
  const faraInAlt = (s) => {
    const alt = meta(html, 'og:image:alt');
    return alt?.includes(s) ? html.replace(`content="${alt}"`, () => `content="${alt.split(s).join('')}"`) : null;
  };
  // Fișierul: copii în memorie ale JPEG-ului din dist/, stricate.
  const jpeg = deLaDisc('dist')('og-cabo-espichel.jpg'), sof = jpeg ? dimJpeg(jpeg) : null;
  const dinDist = deLaDisc('dist');
  const strica = (f) => (sof ? (cale) => (cale === 'og-cabo-espichel.jpg' ? f(Buffer.from(jpeg)) : dinDist(cale)) : null);
  // XMP-ul stricat: segmentul scos, dublat sau rescris (o mutație care nu se aplică lasă fișierul
  // neatins, deci controlul pică singur).
  const faraXmp = (b) => { const [s] = segmenteXmp(b); return s ? Buffer.concat([b.subarray(0, s.i), b.subarray(s.i + 2 + s.L)]) : b; };
  const dublat = (b) => { const [s] = segmenteXmp(b); return s ? Buffer.concat([b.subarray(0, s.i + 2 + s.L), b.subarray(s.i, s.i + 2 + s.L), b.subarray(s.i + 2 + s.L)]) : b; };
  const cuPachet = (f) => (b) => {
    const [s] = segmenteXmp(b), nou = s ? f(s.pachet) : null;
    if (!s || nou === s.pachet) return b;
    const date = Buffer.concat([Buffer.from(NS_XMP, 'latin1'), Buffer.from(nou, 'utf8')]), antet = Buffer.from([0xff, 0xe1, 0, 0]);
    antet.writeUInt16BE(date.length + 2, 2);
    return Buffer.concat([b.subarray(0, s.i), antet, date, b.subarray(s.i + 2 + s.L)]);
  };
  for (const [ce, h, citeste, asteptat] of [
    ['fără og:image', LINIE.test(html) ? html.replace(LINIE, '') : null, dinDist, /fără og:image/],
    ['adresa relativă', inlocuieste(`content="${OG.domeniu}og-`, 'content="/og-'), dinDist, /nu e absolută/],
    ['înălțimea 631 în meta', inlocuieste('og:image:height" content="630"', 'og:image:height" content="631"'), dinDist, /meta 1200 × 631/],
    ['tipul image/png', inlocuieste('og:image:type" content="image/jpeg"', 'og:image:type" content="image/png"'), dinDist, /og:image:type „image\/png”/],
    ['twitter:card summary', inlocuieste('twitter:card" content="summary_large_image"', 'twitter:card" content="summary"'), dinDist, /twitter:card „summary”/],
    ...ALT_OG.map((s) => [`textul alternativ fără ${s}`, faraInAlt(s), dinDist, new RegExp(`nu numește ${s.replace(/[.]/g, '\\.')}$`)]),
    ['fișierul cu 1200 × 631 în SOF', html, strica((b) => { b.writeUInt16BE(631, sof.i + 5); return b; }), /fișierul are 1200 × 631/],
    ['fișierul peste 300 KB', html, strica((b) => Buffer.concat([b, Buffer.alloc(OG.kb * 1000)])), /KB, peste 300/],
    ['un PNG sub numele lui', html, strica(() => readFileSync('public/apple-touch-icon.png')), /fișierul nu e JPEG/],
    ['fișierul fără XMP', html, strica(faraXmp), /n-are XMP/],
    ['XMP-ul de două ori', html, strica(dublat), /2 segmente XMP/],
    ['XMP-ul fără textul SNIG', html, strica(cuPachet((p) => p.replace(SNIG, ''))), /dc:rights\) n-are „Informação geográfica/],
    ['XMP-ul fără atribuirea Sentinel-2', html, strica(cuPachet((p) => p.replace('Contains modified Copernicus Sentinel data 2025', ''))), /dc:rights\) n-are „Contains modified Copernicus Sentinel/],
    ['XMP-ul fără adresa ODbL', html, strica(cuPachet((p) => p.replace('https://opendatacommons.org/licenses/odbl/1-0/', ''))), /UsageTerms\) n-are https:\/\/opendatacommons/],
    ['XMP-ul fără prelucrări', html, strica(cuPachet((p) => p.replace(/(Prelucrate pentru această pagină: )[^.]*\./, '$1.'))), /dc:rights\) n-are lista prelucrărilor/],
    ['XMP-ul fără adresa OpenStreetMap', html, strica(cuPachet((p) => p.replace('https://www.openstreetmap.org/copyright', ''))), /UsageTerms\) n-are https:\/\/www\.openstreetmap\.org\/copyright/],
    ['XMP-ul fără portalul DGT', html, strica(cuPachet((p) => p.replace('https://cdd.dgterritorio.gov.pt/', ''))), /UsageTerms\) n-are https:\/\/cdd\.dgterritorio/],
    ['XMP-ul cu altă pagină', html, strica(cuPachet((p) => p.replace('<xmpRights:WebStatement>https://sebastians.life/<', '<xmpRights:WebStatement>https://text.sebastians.life/<'))), /WebStatement diferă de og:url/],
    ['XMP-ul fără xpacket', html, strica(cuPachet((p) => p.replace(/<\?xpacket[^>]*\?>/g, ''))), /n-are învelișul xpacket/],
    ['XMP-ul fără </dc:rights>', html, strica(cuPachet((p) => p.replace('</dc:rights>', ''))), /nu e XML bine format: <\/rdf:Description> închide altceva/],
    ['XMP-ul fără xmlns:dc', html, strica(cuPachet((p) => p.replace(/\s+xmlns:dc="[^"]*"/, ''))), /prefix nedeclarat în <dc:title>/],
    ['XMP-ul cu rdf:about dublat', html, strica(cuPachet((p) => p.replace('rdf:about=""', 'rdf:about="" rdf:about=""'))), /atribut dublat/],
    ['XMP-ul cu a doua rădăcină', html, strica(cuPachet((p) => p.replace('</x:xmpmeta>', '</x:xmpmeta>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"/>'))), /a doua rădăcină/],
    ['XMP-ul cu dc:rights în afara rdf:Description', html, strica(cuPachet((p) => {
      const m = /<dc:rights>[\s\S]*?<\/dc:rights>/.exec(p);
      return m ? p.replace(m[0], '').replace('</x:xmpmeta>', () => `${m[0].replace('<dc:rights>', `<dc:rights xmlns:dc="${NS.dc}" xmlns:rdf="${NS.rdf}">`)}</x:xmpmeta>`) : p;
    })), /structura XMP: x:xmpmeta nu are exact un rdf:RDF/],
    ['XMP-ul cu URI-ul xmpRights greșit', html, strica(cuPachet((p) => p.replace(`xmlns:xmpRights="${NS.xmpRights}"`, 'xmlns:xmpRights="http://ns.adobe.com/xap/1.0/right/"'))), /n-are xmpRights:UsageTerms/],
    ['XMP-ul cu descrierea veche', html, strica(cuPachet((p) => p.replace('plaja de la poalele ei', 'plaja'))), /diferă de og:image:alt/],
  ]) {
    const x = h === null || citeste === null ? null : imagineaOg(h, citeste);
    proba(x !== null && x.probleme.some((p) => asteptat.test(p)), `control, ${ce}: ${x === null ? 'MUTAȚIA NU S-A APLICAT' : x.probleme.join('; ') || 'nicio problemă'} — pică`);
  }
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
  {
    // imaginea de previzualizare publicată: aceeași adresă în documentul viu, aceiași octeți
    const og = meta(await (await fetch(origine + '/')).text(), 'og:image');
    const local = readFileSync(`dist/${meta(html, 'og:image').slice(OG.domeniu.length)}`);
    const r = og ? await fetch(og.replace(OG.domeniu, origine + '/')) : null;
    const b = r?.ok ? Buffer.from(await r.arrayBuffer()) : null;
    proba(og === meta(html, 'og:image') && r?.status === 200 && r.headers.get('content-type') === 'image/jpeg' && b?.equals(local),
      `og:image publicată: ${og ?? 'lipsă'} → ${r ? `HTTP ${r.status}, ${r.headers.get('content-type')}, ${b ? `${b.length} octeți, ${b.equals(local) ? 'aceiași ca în dist/' : 'ALȚII decât în dist/'}` : 'fără corp'}` : 'necerută'}`);
  }
  if (HARTI_COD.length && viu) {
    // harta intrării publicate, nu a celei locale: dacă build-urile diferă, numele diferă
    const r = await fetch(`${origine}${viu}.map`, { method: 'HEAD', redirect: 'manual' });
    proba(r.status === 403, `hărțile de cod sunt închise publicului (Protected Source Maps): ${viu}.map → HTTP ${r.status}`);
  }
}

await rezumat({ iesi: true });
