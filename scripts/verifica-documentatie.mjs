// Verifică documentația: CLAUDE.md scurt, fiecare fișier din docs/ legat din el, trimiterile
// spre docs/ întregi, nicio cale de decodor moartă, niciun comentariu vechi în src/ și sursa
// fiecărei etichete care spune la ce servește o clădire.
//
//   npm run verifica-documentatie
//
// Nu scrie nimic. Iese cu cod 1 dacă pică vreo probă. Ce verifică:
//   1. CLAUDE.md are cel mult 25 000 de octeți și 40 000 de caractere: se încarcă întreg în
//      fiecare sesiune și în fiecare subagent;
//   2. fiecare docs/*.md e numit în indexul lui CLAUDE.md, fiecare docs/x.md numit oriunde
//      (CLAUDE.md, docs/, src/, scripts/, .claude/) există, iar fiecare rând din „Decizii în
//      vigoare” se încheie cu „→ a, b”, cu docs/a.md și docs/b.md pe disc (numele pot trece pe
//      rândul de continuare);
//   3. trimiterile:
//      - fiecare trimitere `docs/x.md`, „Titlu” (și „Titlu2” legate cu virgulă, „și” sau „sau”;
//        sau „Titlu” în docs/x.md) își găsește titlul în fișierul țintă, într-un rând de titlu
//        (#…) sau într-un segment **…**, comparat fără backtick-uri. Citatul se închide cu ” sau
//        cu ". O trimitere stă pe un singur rând: un titlu care începe sau se închide pe rândul
//        următor pică, ca să-l găsească grep;
//      - un citat „X” fără cale lângă el — fără `docs/x.md` înainte, „în docs/x.md” după sau
//        CLAUDE.md lipit — pică dacă X e titlu (egal, sau început de titlu urmat de spațiu sau
//        de , : ; . () în alt fișier din docs/ sau în CLAUDE.md și nu e titlu în fișierul lui.
//        Titlurile sunt aici rândurile #… și segmentele **…** de la început de rând (titlurile
//        de paragraf): un **…** din mijlocul frazei e o subliniere, ca **noduri** sau **liniar**.
//        Nu se citesc: citatele din rândurile de titlu (un titlu nu trimite; „mutat din „X”” e
//        istoric) și numele de pe ecran care sunt și titluri (NUME_PE_ECRAN). Se citesc
//        CLAUDE.md, docs/, .claude/, src/ și scripts/;
//      - o mențiune a lui CLAUDE.md în src/, scripts/, .claude/ și docs/: citatul lipit de ea
//        („X” în CLAUDE.md; CLAUDE.md, „X”; CLAUDE.md la „X”) e un titlu ## din CLAUDE.md. În
//        src/, scripts/ și .claude/, un rând fără citat lipit are pe el un citat care e titlu ##;
//        în docs/, unde antetul numește CLAUDE.md ca fișier („Mutat cuvânt cu cuvânt din
//        CLAUDE.md…”), un rând fără citat lipit trece;
//   4. în .claude/, CLAUDE.md și package.json nu apar căile decodoarelor din public/
//      (setTranscoderPath('/basis/'), setDecoderPath('/draco/')), copy-decoders și nici
//      formula memoriei „indiferent de format”, falsă pentru KTX2;
//   5. în src/ nu apare niciun comentariu vechi, cu cifrele de dinaintea lui alpha întregi și a
//      împrejurimilor; nicio linie din src/ și scripts/ care împarte la 2²⁰ nu scrie „MB”, iar
//      în src/, scripts/, docs/, CLAUDE.md și .claude/ nimeni nu redefinește „MB = 2^20”
//      (MB = 10⁶ B, MiB = 2²⁰ B);
//   6. conținutul, cu codul paginii (numeElement din src/scene/nume.js și src/content/): eticheta
//      clădirii Casa da Ronca își spune sursa, iar orice etichetă cu o folosință (cafenea,
//      toalete, bar, barul…, nu bară) are deasupra, în sursă, un comentariu cu OSM, NEVERIFICAT
//      sau „observat”.
// Fiecare probă are un control negativ, rulat în memorie, pe o copie a textelor: aceeași probă pe
// o greșeală cunoscută trebuie să pice, iar o mutație care nu se mai aplică pică și ea. Controalele
// care cer git se sar, cu mesaj, fără git.
// Fișierele gitignorate (.claude/settings.local.json, .claude/worktrees/) nu sunt ale depozitului
// și nu se citesc; nici scriptul acesta, care conține tiparele căutate, pentru controale.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { numeElement } from '../src/scene/nume.js';
import { SANCTUAR } from '../src/content/sanctuar.js';
import { CLADIRI } from '../src/content/cladiri.js';

let picate = 0;
const proba = (bun, text) => { console.log(`${bun ? '  ok ' : '  PICĂ'}  ${text}`); if (!bun) picate++; };
const sarit = (text) => console.log(`  --    ${text}`);
const scurt = (a, n = 4) => (a.length > n ? `${a.slice(0, n).join('; ')} și încă ${a.length - n}` : a.join('; '));
const grupat = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const LF = (s) => s.replace(/\r\n/g, '\n');
const fara = (s) => s.replace(/`/g, '').replace(/\s+/g, ' ').trim();

const SINE = 'scripts/verifica-documentatie.mjs';
const COMMIT_VECHI = '4a5e337';   // ultimul commit cu CLAUDE.md întreg, de dinaintea mutării în docs/

/** Un fișier dintr-un commit, ca Buffer; null fără git sau fără fișier. */
const dinGit = (ref) => {
  const r = spawnSync('git', ['show', ref], { maxBuffer: 64 << 20 });
  return r.status === 0 ? r.stdout : null;
};

// ------------------------------------------------------------ textele

const TEXT = /\.(md|js|mjs|cjs|json|css|html|svg|txt)$/;
const GITIGNORATE = new Set(['.claude/settings.local.json', '.claude/worktrees', 'node_modules']);
const umbla = (dir) => readdirSync(dir).flatMap((n) => {
  const p = `${dir}/${n}`;
  if (GITIGNORATE.has(p) || n === 'node_modules') return [];
  return statSync(p).isDirectory() ? umbla(p) : TEXT.test(n) ? [p] : [];
});
/** cale → text cu LF. Probele primesc o hartă, deci controalele lucrează pe o copie. */
const CORPUS = new Map();
for (const f of ['CLAUDE.md', 'package.json', ...['docs', 'src', 'scripts', '.claude'].flatMap(umbla)]) {
  if (f !== SINE) CORPUS.set(f, LF(readFileSync(f, 'utf8')));
}
const cu = (schimbari) => { const c = new Map(CORPUS); for (const [k, v] of Object.entries(schimbari)) c.set(k, v); return c; };
/** O copie cu o înlocuire în fișierul f; null dacă textul căutat nu mai e acolo. */
const cuInlocuit = (f, vechi, nou) => {
  const t = CORPUS.get(f);
  if (t === undefined || !(typeof vechi === 'string' ? t.includes(vechi) : vechi.test(t))) return null;
  return cu({ [f]: t.replace(vechi, () => nou) });
};
const linieLa = (t, i) => t.slice(0, i).split('\n').length;
const NUME_MD = String.raw`[\p{L}\p{N}_.-]+?\.md(?![\p{L}\p{N}_])`;
// Un citat „…”, închis cu ” sau cu " (ambele forme sunt în depozit).
const CITAT = String.raw`„([^„”"\n]+)[”"]`;
/** Rezultatul unui control: „pică (…)” sau „TRECE”, ori „MUTAȚIA NU S-A APLICAT”. */
const pica = (aplicat, gasite, n = 2) => (!aplicat ? 'MUTAȚIA NU S-A APLICAT' : gasite.length ? `pică (${scurt(gasite, n)})` : 'TRECE');

// ------------------------------------------------------------ 1. mărimea lui CLAUDE.md

console.log('\n1. CLAUDE.md: cel mult 25 000 de octeți și 40 000 de caractere');
const marime = (buf) => ({ octeti: buf.length, caractere: [...buf.toString('utf8')].length });
const incape = (m) => m.octeti <= 25000 && m.caractere <= 40000;
const descrieMarime = (m) => `${grupat(m.octeti)} B, ${grupat(m.caractere)} de caractere`;
{
  const m = marime(readFileSync('CLAUDE.md'));
  proba(incape(m), `CLAUDE.md, pe disc: ${descrieMarime(m)}`);
  const vechi = dinGit(`${COMMIT_VECHI}:CLAUDE.md`);
  if (!vechi) sarit(`control sărit: git sau commitul ${COMMIT_VECHI} nu e disponibil`);
  else proba(!incape(marime(vechi)), `control: CLAUDE.md de la ${COMMIT_VECHI}, ${descrieMarime(marime(vechi))} — pică`);
}

// ------------------------------------------------------------ 2. indexul și fișierele numite

console.log('\n2. Fiecare docs/*.md e în indexul lui CLAUDE.md, fiecare docs/x.md numit există, fiecare „→” din „Decizii în vigoare” are fișierul');
const INDEX = 'Documentația pe subsisteme';
const DECIZII = 'Decizii în vigoare';
/** Rândurile unei secțiuni ## din CLAUDE.md, până la următoarea, cu numărul primului; null dacă lipsește. */
const sectiuneLinii = (t, titlu) => {
  const linii = t.split('\n');
  const i = linii.findIndex((l) => /^##\s/.test(l) && fara(l.slice(2)).startsWith(titlu));
  if (i < 0) return null;
  const j = linii.findIndex((l, k) => k > i && /^##?\s/.test(l));
  return { linii: linii.slice(i, j < 0 ? undefined : j), prima: i + 1 };
};
/** Textul unei secțiuni ## din CLAUDE.md; null dacă lipsește. */
const sectiune = (t, titlu) => sectiuneLinii(t, titlu)?.linii.join('\n') ?? null;
const fisiereDocs = (c) => [...c.keys()].filter((k) => /^docs\/[^/]+\.md$/.test(k));
function verificaIndex(c) {
  const index = sectiune(c.get('CLAUDE.md'), INDEX);
  const nelegate = index === null ? ['(lipsește secțiunea indexului)'] : fisiereDocs(c).filter((d) => !index.includes(`\`${d}\``));
  const lipsa = [];
  let numite = 0;
  for (const [f, t] of c) {
    for (const m of t.matchAll(new RegExp(String.raw`docs\/(${NUME_MD})`, 'gu'))) {
      numite++;
      if (!c.has(`docs/${m[1]}`)) lipsa.push(`${f}:${linieLa(t, m.index)} → docs/${m[1]}`);
    }
  }
  return { nelegate, lipsa, numite, docs: fisiereDocs(c).length };
}
{
  const r = verificaIndex(CORPUS);
  proba(r.docs > 0 && r.nelegate.length === 0, `${r.docs} fișiere în docs/${r.nelegate.length ? `; NELEGATE din „${INDEX}”: ${r.nelegate.join(', ')}` : `, toate în „${INDEX}”`}`);
  proba(r.lipsa.length === 0, `${r.numite} mențiuni docs/x.md în CLAUDE.md, docs/, src/, scripts/ și .claude/${r.lipsa.length ? `; LIPSĂ: ${scurt(r.lipsa)}` : ', toate spre fișiere care există'}`);
  const nou = verificaIndex(cu({ 'docs/nou.md': '# Nou\n\nUn fișier pe care nu-l leagă nimic.\n' }));
  proba(nou.nelegate.includes('docs/nou.md'), `control: un docs/nou.md nelegat — ${nou.nelegate.length ? `pică (${nou.nelegate.join(', ')})` : 'TRECE'}`);
  const lipsa = verificaIndex(cu({ 'CLAUDE.md': `${CORPUS.get('CLAUDE.md')}\nVezi \`docs/lipsa.md\`.\n` }));
  proba(lipsa.lipsa.some((x) => x.endsWith('docs/lipsa.md')), `control: o trimitere la docs/lipsa.md — ${lipsa.lipsa.length ? `pică (${scurt(lipsa.lipsa)})` : 'TRECE'}`);
}

/**
 * Săgețile din „Decizii în vigoare”: fiecare rând („- …”, cu rândurile lui de continuare, mai
 * adânci) se încheie cu „→ a, b”, iar fiecare nume are docs/<nume>.md.
 */
function verificaSageti(c) {
  const s = sectiuneLinii(c.get('CLAUDE.md'), DECIZII);
  if (s === null) return { randuri: 0, nume: 0, rele: [`(lipsește secțiunea „${DECIZII}”)`] };
  const randuri = [];
  s.linii.forEach((l, k) => {
    const nr = s.prima + k;
    if (/^- /.test(l)) randuri.push([{ l, nr }]);
    else if (/^\s+\S/.test(l) && randuri.length && randuri.at(-1).at(-1).nr === nr - 1) randuri.at(-1).push({ l, nr });
  });
  const rele = [];
  let nume = 0;
  for (const r of randuri) {
    const text = r.map((x) => x.l.trim()).join(' ');
    const i = text.lastIndexOf('→');
    // rândul pe care stă săgeata, pentru mesaj
    const unde = `CLAUDE.md:${(r.findLast((x) => x.l.includes('→')) ?? r[0]).nr}`;
    if (i < 0) { rele.push(`${unde}: rândul nu se încheie cu „→”`); continue; }
    for (const n of text.slice(i + 1).trim().split(/\s*,\s*/)) {
      nume++;
      if (!/^[a-z0-9-]+$/.test(n)) rele.push(`${unde} → „${n}”: nu e un nume de fișier din docs/`);
      else if (!c.has(`docs/${n}.md`)) rele.push(`${unde} → ${n}: docs/${n}.md lipsește`);
    }
  }
  return { randuri: randuri.length, nume, rele };
}
{
  const r = verificaSageti(CORPUS);
  proba(r.randuri > 0 && r.rele.length === 0, `„${DECIZII}”: ${r.randuri} rânduri, ${r.nume} nume după „→”${r.rele.length ? `; RELE: ${scurt(r.rele)}` : ', fiecare cu docs/<nume>.md'}`);
  // Mutația se face numai în secțiune: „→ livrarea” poate apărea și în altă parte.
  const t = CORPUS.get('CLAUDE.md'), s = sectiune(t, DECIZII);
  const s2 = s?.replace(/→ livrarea(?![\p{L}\p{N}_-])/u, '→ livrara');
  const m = s && s2 !== s ? verificaSageti(cu({ 'CLAUDE.md': t.replace(s, () => s2) })).rele.filter((x) => x.includes('livrara')) : [];
  proba(m.length === 1, `control: „→ livrarea” scris „→ livrara” — ${pica(s && s2 !== s, m)}`);
}

// ------------------------------------------------------------ 3. trimiterile

console.log('\n3. Trimiterile: `docs/x.md`, „Titlu” își găsește titlul; niciun titlu din alt fișier citat fără cale; CLAUDE.md, numai cu o secțiune ##');
/** Titlurile unui fișier: rândurile #… și segmentele **…**, fără backtick-uri. */
const titluriDin = (t) => [
  ...t.split('\n').map((l) => /^#{1,6}\s+(.*)$/.exec(l)?.[1]).filter(Boolean),
  ...[...t.matchAll(/\*\*([^*]+?)\*\*/g)].map((m) => m[1]),
].map(fara);
/** Titlurile de paragraf: rândurile #… și segmentele **…** de la început de rând (și după „- ”, „1. ”). */
const titluriParagraf = (t) => t.split('\n')
  .map((l) => /^#{1,6}\s+(.*)$/.exec(l)?.[1] ?? /^\s*(?:[-*+]\s+|\d+\.\s+)?\*\*([^*]+?)\*\*/.exec(l)?.[1])
  .filter(Boolean).map(fara);
/** Citatul q e titlul h, sau începutul lui urmat de spațiu sau de , : ; . ( — nu „MDS” din „MDS-ul”. */
const eTitlu = (q, h) => h === q || (q.length > 0 && h.startsWith(q) && /^[\s,:;.(]/u.test(h.slice(q.length)));
// Legătura dintre titlurile aceleiași trimiteri: „A”, „B”; „A” și „B”; „A” sau „B”.
const LEG = String.raw`[ \t]*(?:,|și|sau)?[ \t]*`;
const RE_TRIMITERE = new RegExp('`?docs/(' + NUME_MD + ')`?(?:,[ \\t]*' + CITAT
  + String.raw`((?:[ \t]*(?:,|și|sau)[ \t]*„[^„”"\n]+[”"])*))?`, 'gu');
const RUPT = new RegExp(`^${LEG}„[^”"]*$`, 'u');
const IN_DOCS = new RegExp(CITAT + String.raw`\s+în\s+$`, 'u');
function verificaTrimiteri(c) {
  const cache = new Map();
  const titluri = (f) => { if (!cache.has(f)) cache.set(f, titluriDin(c.get(f))); return cache.get(f); };
  const rele = [];
  let cuTitlu = 0, faraTitlu = 0;
  for (const [f, t] of c) {
    const linii = t.split('\n');
    linii.forEach((l, i) => {
      for (const m of l.matchAll(RE_TRIMITERE)) {
        const tinta = `docs/${m[1]}`, unde = `${f}:${i + 1}`;
        const rest = l.slice(m.index + m[0].length);
        // O trimitere ruptă pe două rânduri n-o poate citi nici proba, nici grep. Un titlu deschis
        // și neînchis pe rând pică, nu se lipește cu rândul următor: altfel ar trece drept
        // trimitere spre tot fișierul, iar titlul nu s-ar mai verifica.
        if (RUPT.test(rest)) { rele.push(`${unde} → ${tinta}: titlul trece pe rândul următor`); continue; }
        // forma a doua: „Titlu” în docs/x.md (mesajele scripturilor)
        const inainte = IN_DOCS.exec(l.slice(0, m.index))?.[1];
        const cerute = m[2] !== undefined ? [m[2], ...[...(m[3] ?? '').matchAll(new RegExp(CITAT, 'gu'))].map((x) => x[1])]
          : inainte !== undefined ? [inainte] : [];
        if (!cerute.length) {
          if (/^,\s*$/.test(rest) && /^\s*(?:\/\/|\/?\*|#|<!--|-)?\s*„/.test(linii[i + 1] ?? '')) rele.push(`${unde} → ${tinta}: titlul începe pe rândul următor`);
          else faraTitlu++;
          continue;
        }
        cuTitlu += cerute.length;
        if (!c.has(tinta)) { rele.push(`${unde} → ${tinta}: fișierul lipsește`); continue; }
        for (const titlu of cerute) {
          if (!titluri(tinta).some((h) => h.includes(fara(titlu)))) rele.push(`${unde} → ${tinta}, „${titlu}”: titlul nu e în fișier`);
        }
      }
    });
  }
  return { rele, cuTitlu, faraTitlu };
}

// Numele de pe ecran care sunt și titluri de paragraf: butonul „Coordonate” (CLAUDE.md,
// „Coordonate, nord, altitudine”), butonul „Satelit” (CLAUDE.md, **Satelit**) și rozeta „Acasă”
// (docs/imprejurimi.md, **Acasă**). Citate, ele numesc butonul, nu secțiunea.
const NUME_PE_ECRAN = new Set(['Coordonate', 'Satelit', 'Acasă']);
// Un citat are calea lângă el: după `docs/x.md`, (cu titlurile legate de el) sau după CLAUDE.md,
// ori înaintea lui „în docs/x.md” / „în CLAUDE.md”. Contextul de dinainte trece peste capătul
// rândului, fără semnele de comentariu: trimiterea ruptă o prinde deja proba de mai sus.
const CU_CALE_INAINTE = new RegExp('(?:docs/' + NUME_MD + '`?|CLAUDE\\.md`?)(?:' + LEG + '„[^„”"]*[”"])*' + LEG
  + String.raw`(?:(?:la|în|din|secțiunea)[ \t]+)?$`, 'u');
const CU_CALE_DUPA = /^[ \t]+(?:în|din)[ \t]+(?:`?docs\/|`?CLAUDE\.md)/u;
const SALT = /\n[ \t]*(?:\/\/+|\/?\*+|#+|<!--|-)?[ \t]*/g;
const RE_CITAT = new RegExp(CITAT, 'gu');
/** Citatele „X” fără cale care sunt titlu în alt fișier din docs/ sau în CLAUDE.md, nu și în al lor. */
function verificaCitate(c) {
  const titluri = new Map([...c.keys()].filter((f) => f === 'CLAUDE.md' || /^docs\/[^/]+\.md$/.test(f)).map((f) => [f, titluriParagraf(c.get(f))]));
  const rele = [];
  let citate = 0, peEcran = 0, cuCale = 0;
  for (const [f, t] of c) {
    if (f !== 'CLAUDE.md' && !/^(docs|src|scripts|\.claude)\//.test(f)) continue;
    const md = f.endsWith('.md'), proprii = md ? (titluri.get(f) ?? titluriParagraf(t)) : [];
    let start = 0;
    t.split('\n').forEach((l, i) => {
      const inceput = start;
      start += l.length + 1;
      if (md && /^#{1,6}\s/.test(l)) return;   // un titlu își definește citatele, nu trimite
      for (const m of l.matchAll(RE_CITAT)) {
        citate++;
        const q = fara(m[1]);
        if (NUME_PE_ECRAN.has(q)) { peEcran++; continue; }
        const poz = inceput + m.index;
        const inainte = t.slice(Math.max(0, poz - 240), poz).replace(SALT, ' ');
        if (CU_CALE_INAINTE.test(inainte) || CU_CALE_DUPA.test(l.slice(m.index + m[0].length))) { cuCale++; continue; }
        const alte = [...titluri].filter(([g, hs]) => g !== f && hs.some((h) => eTitlu(q, h))).map(([g]) => g);
        if (alte.length && !proprii.some((h) => eTitlu(q, h))) rele.push(`${f}:${i + 1} „${q}”, titlu în ${alte.join(', ')}, fără cale`);
      }
    });
  }
  return { rele, citate, peEcran, cuCale };
}

// CLAUDE.md numit: secțiunea trebuie să fie încă acolo, nu mutată în docs/. Citatul lipit de
// mențiune: „X” în CLAUDE.md, „X” din CLAUDE.md; CLAUDE.md, „X”; CLAUDE.md la „X”.
const LIPIT_DUPA = new RegExp('^`?[ \\t]*(?:[,;:(—–-][ \\t]*)?(?:(?:secțiunea|la|în|din)[ \\t]+)?' + CITAT, 'u');
const LIPIT_INAINTE = new RegExp(CITAT + '[ \\t]*(?:[,;:)—–-][ \\t]*)?(?:(?:în|din|de la|la)[ \\t]+)?`?$', 'u');
function verificaClaude(c) {
  const sectiuni = c.get('CLAUDE.md').split('\n').map((l) => /^##\s+(.*)$/.exec(l)?.[1]).filter(Boolean).map(fara);
  const eSectiune = (q) => sectiuni.some((h) => eTitlu(q, h));
  const rele = [], numit = { 'src/': 0, 'scripts/': 0, '.claude/': 0, 'docs/': 0 };
  for (const [f, t] of c) {
    const dir = /^(src\/|scripts\/|\.claude\/|docs\/)/.exec(f)?.[1];
    if (!dir) continue;
    t.split('\n').forEach((l, i) => {
      if (!l.includes('CLAUDE.md')) return;
      numit[dir]++;
      const unde = `${f}:${i + 1}`, lipite = [];
      for (const m of l.matchAll(/CLAUDE\.md/g)) {
        for (const x of [LIPIT_DUPA.exec(l.slice(m.index + m[0].length)), LIPIT_INAINTE.exec(l.slice(0, m.index))]) if (x) lipite.push(fara(x[1]));
      }
      if (lipite.length) {
        const nu = lipite.filter((q) => !eSectiune(q));
        if (nu.length) rele.push(`${unde} „${nu.join('”, „')}” nu e o secțiune ## din CLAUDE.md`);
        return;
      }
      if (dir === 'docs/') return;   // antetul numește CLAUDE.md ca fișier, nu o secțiune
      const citate = [...l.matchAll(RE_CITAT)].map((m) => fara(m[1]));
      if (!citate.some(eSectiune)) rele.push(`${unde} ${citate.length ? `„${citate.join('”, „')}” nu e o secțiune ## din CLAUDE.md` : 'numește CLAUDE.md fără nicio secțiune'}`);
    });
  }
  return { rele, numit };
}
{
  const r = verificaTrimiteri(CORPUS);
  proba(r.cuTitlu > 0 && r.rele.length === 0, `${r.cuTitlu} titluri în trimiteri (încă ${r.faraTitlu} trimiteri spre tot fișierul)${r.rele.length ? `; RELE: ${scurt(r.rele, 6)}` : ', toate găsite'}`);
  const z = verificaCitate(CORPUS);
  proba(z.citate > 0 && z.rele.length === 0, `${z.citate} citate „…” în CLAUDE.md, docs/, .claude/, src/ și scripts/ (${z.cuCale} cu calea lângă ele, ${z.peEcran} nume de pe ecran)${z.rele.length ? `; FĂRĂ CALE: ${scurt(z.rele, 6)}` : ': niciun titlu din alt fișier citat fără cale'}`);
  const k = verificaClaude(CORPUS);
  const numit = Object.entries(k.numit).map(([d, n]) => `${d} ${n}`).join(', ');
  proba(k.rele.length === 0, `CLAUDE.md numit pe rânduri din ${numit}${k.rele.length ? `; RELE: ${scurt(k.rele)}` : ': fiecare citat lipit e o secțiune ## de azi'}`);

  // Fiecare control cere să pice chiar pe mutația lui: o greșeală de bază nu-l face să treacă.
  // Mutația se aplică întreagă sau deloc: un titlu care nu mai e acolo ar trece degeaba.
  const redenumit = cuInlocuit('docs/cladiri.md', '### Umbrele pe grupuri', '### Umbrele, pe grupuri');
  const umbre = redenumit ? verificaTrimiteri(redenumit).rele.filter((x) => x.includes('„Umbrele pe grupuri”')) : [];
  proba(umbre.length > 0, `control: „Umbrele pe grupuri” din docs/cladiri.md redenumit în memorie — ${pica(redenumit, umbre)}`);
  const rupt = verificaTrimiteri(cu({ 'docs/proba-documentatie.md': 'Umbrele, de aproape (vezi `docs/cladiri.md`, „Umbrele\npe grupuri vechi”).\n' }))
    .rele.filter((x) => x.startsWith('docs/proba-documentatie.md:') && x.includes('trece pe rândul următor'));
  proba(rupt.length === 1, `control: „\`docs/cladiri.md\`, „Umbrele⏎pe grupuri vechi”” — ${pica(true, rupt)}`);

  const teren = cuInlocuit('docs/teren.md', '(vezi `docs/punctul.md`, „Punctul de sub clic”)', '(vezi „Punctul de sub clic”)');
  const t1 = teren ? verificaCitate(teren).rele.filter((x) => x.startsWith('docs/teren.md:') && x.includes('„Punctul de sub clic”')) : [];
  proba(t1.length === 1, `control: docs/teren.md cu „(vezi „Punctul de sub clic”)”, fără docs/punctul.md — ${pica(teren, t1)}`);
  const cod = verificaCitate(cu({ 'scripts/proba-documentatie.mjs': '// Mesajul de încărcare (vezi „Pornirea”): un rând.\n' }))
    .rele.filter((x) => x.startsWith('scripts/proba-documentatie.mjs:'));
  proba(cod.length === 1, `control: un comentariu „(vezi „Pornirea”)” într-un script — ${pica(true, cod)}`);

  const claude = (f, rand) => verificaClaude(cu({ [f]: `${CORPUS.get(f) ?? ''}\n${rand}\n` })).rele.filter((x) => x.startsWith(`${f}:`));
  const busola = claude('src/scene/proba-documentatie.js', '// Nordul adevărat (vezi „Busola și nordul adevărat” în CLAUDE.md).');
  proba(busola.length === 1, `control: „(vezi „Busola și nordul adevărat” în CLAUDE.md)” în src/ — ${pica(true, busola)}`);
  const regula = claude('.claude/rules/three-scene.md', 'Vezi „Vederea Satelit” în CLAUDE.md.');
  proba(regula.length === 1, `control: „Vezi „Vederea Satelit” în CLAUDE.md.” în .claude/rules/three-scene.md — ${pica(true, regula)}`);
  const pornirea = claude('docs/pornirea.md', 'Garda fotografiei (CLAUDE.md, „Vederea Satelit”).');
  proba(pornirea.length === 1, `control: „(CLAUDE.md, „Vederea Satelit”)” în docs/pornirea.md — ${pica(true, pornirea)}`);
}

// ------------------------------------------------------------ 4. căile decodoarelor

console.log('\n4. În .claude/, CLAUDE.md și package.json: nicio cale de decodor în public/, nici formula „indiferent de format”');
const INTERZISE = [
  ["setTranscoderPath('/basis/')", /setTranscoderPath\(\s*['"`]\/basis\/?['"`]\s*\)/],
  ["setDecoderPath('/draco/')", /setDecoderPath\(\s*['"`]\/draco\/?['"`]\s*\)/],
  ['copy-decoders', /copy-decoders/],
  ['„indiferent” … „de format”', /indiferent[\s*_„”"]*de\s+format/i],
];
const REGULI = (f) => f === 'CLAUDE.md' || f === 'package.json' || f.startsWith('.claude/');
function cautaInterzise(c) {
  const gasite = [];
  let citite = 0;
  for (const [f, t] of c) {
    if (!REGULI(f)) continue;
    citite++;
    for (const [nume, re] of INTERZISE) {
      const m = re.exec(t);
      if (m) gasite.push(`${f}:${linieLa(t, m.index)} ${nume}`);
    }
  }
  return { gasite, citite };
}
{
  const r = cautaInterzise(CORPUS);
  proba(r.citite > 2 && r.gasite.length === 0, `${r.citite} fișiere citite, ${r.gasite.length ? `GĂSITE: ${scurt(r.gasite)}` : 'niciun tipar'}`);
  const vechi = dinGit(`${COMMIT_VECHI}:.claude/rules/three-scene.md`);
  if (!vechi) sarit(`control sărit: git sau commitul ${COMMIT_VECHI} nu e disponibil`);
  else {
    const v = cautaInterzise(cu({ '.claude/rules/three-scene.md': LF(vechi.toString('utf8')) }));
    const regula = v.gasite.filter((x) => x.startsWith('.claude/rules/three-scene.md:'));
    proba(regula.length > 0, `control: .claude/rules/three-scene.md de la ${COMMIT_VECHI} — ${regula.length ? `pică (${regula.map((x) => x.replace(/^\S+:/, 'r. ')).join(', ')})` : 'TRECE'}`);
  }
}

// ------------------------------------------------------------ 5. comentariile vechi și MB

console.log('\n5. În src/, niciun comentariu vechi; în src/ și scripts/, nimic împărțit la 2²⁰ scris „MB”; nicăieri „MB = 2^20”');
const COMENTARII_VECHI = ['73 MB', '~48 MB', '4 milioane de vârfuri', '1,36 milioane', '(~45 km)',
  'ceața completă (24 km)', 'Primește `inaltimeLa` COMPUS', '3,7% din'];
const tipar = (s) => new RegExp(`${/^\d/.test(s) ? String.raw`(?<![\d.,])` : ''}${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const TIPARE = COMENTARII_VECHI.map((s) => [s, tipar(s)]);
// Împărțit la 2²⁰: 1048576, 2 ** 20, 1024 * 1024 sau 1 << 20, cu paranteze sau fără.
const LA_MIB = /\/\s*\(?\s*(?:1048576|1_048_576|2\s*\*\*\s*20|1024\s*\*\s*1024|1\s*<<\s*20)(?![\d_])/;
// MB redefinit ca 2²⁰ octeți: „MB = 2^20”, „MB = 2 ** 20”, „MB = 2²⁰”. Cifrele de lângă el ar fi
// MiB scrise „MB”, contrar convenției din CLAUDE.md.
const MB_BINAR = /\bMB\s*=\s*(?:2\s*(?:\^|\*\*)?\s*20(?!\d)|2²⁰)/u;
const UNDE_MB_BINAR = (f) => f === 'CLAUDE.md' || /^(src|scripts|docs|\.claude)\//.test(f);
function cautaVechi(c) {
  const vechi = [], mb = [], binar = [];
  let impartiri = 0, citite = 0;
  for (const [f, t] of c) {
    if (UNDE_MB_BINAR(f)) {
      citite++;
      t.split('\n').forEach((l, i) => { if (MB_BINAR.test(l)) binar.push(`${f}:${i + 1}`); });
    }
    if (!/^(src|scripts)\//.test(f)) continue;
    t.split('\n').forEach((l, i) => {
      if (f.startsWith('src/')) for (const [s, re] of TIPARE) if (re.test(l)) vechi.push(`${f}:${i + 1} „${s}”`);
      if (LA_MIB.test(l)) { impartiri++; if (/\bMB\b/.test(l)) mb.push(`${f}:${i + 1}`); }
    });
  }
  return { vechi, mb, impartiri, binar, citite };
}
{
  const r = cautaVechi(CORPUS);
  proba(r.vechi.length === 0, `${COMENTARII_VECHI.length} tipare vechi în src/: ${r.vechi.length ? `GĂSITE: ${scurt(r.vechi)}` : 'niciunul'}`);
  proba(r.impartiri > 0 && r.mb.length === 0, `${r.impartiri} linii împart la 2²⁰, ${r.mb.length ? `${r.mb.length} scriu „MB”: ${scurt(r.mb)}` : 'niciuna nu scrie „MB”'}`);
  const linie = cautaVechi(cu({ 'scripts/proba-documentatie.mjs': 'console.log(`${(x / 1048576).toFixed(2)} MB`);\n' }))
    .mb.filter((x) => x.startsWith('scripts/proba-documentatie.mjs:'));
  proba(linie.length === 1, `control: un rând cu \`(x / 1048576).toFixed(2)} MB\` — ${linie.length ? `pică (${linie.join(', ')})` : 'TRECE'}`);
  proba(r.citite > 0 && r.binar.length === 0, `„MB = 2^20” în ${r.citite} fișiere din src/, scripts/, docs/, CLAUDE.md și .claude/: ${r.binar.length ? `GĂSIT: ${scurt(r.binar)}` : 'niciunul'}`);
  const binar = cautaVechi(cu({ 'CLAUDE.md': `${CORPUS.get('CLAUDE.md')}\nTexturile au 14,44 MB (MB = 2^20 octeți).\n` }))
    .binar.filter((x) => x.startsWith('CLAUDE.md:'));
  proba(binar.length === 1, `control: rândul „(MB = 2^20 octeți)” în CLAUDE.md — ${pica(true, binar)}`);
  const mare = dinGit(`${COMMIT_VECHI}:src/scene/mare.js`);
  if (!mare) sarit(`control sărit: git sau commitul ${COMMIT_VECHI} nu e disponibil`);
  else {
    const v = cautaVechi(cu({ 'src/scene/mare.js': LF(mare.toString('utf8')) }));
    const m = v.vechi.filter((x) => x.startsWith('src/scene/mare.js:'));
    proba(m.length > 0, `control: src/scene/mare.js de la ${COMMIT_VECHI} — ${m.length ? `pică (${scurt(m)})` : 'TRECE'}`);
  }
}

// ------------------------------------------------------------ 6. conținutul

console.log('\n6. Conținutul, cu codul paginii: Casa da Ronca își spune sursa, folosințele au sursă');
const CONTINUT = { sanctuar: SANCTUAR, cladiri: CLADIRI };
const RONCA = 'ruina.96521141';
{
  const nume = numeElement(RONCA, CONTINUT);
  proba(nume.includes('OpenStreetMap'), `numeElement('${RONCA}') = „${nume}”`);
  // Cheia trebuie să fie a unei clădiri din datele pe care le încarcă pagina, altfel proba de mai
  // sus ar verifica o etichetă pe care n-o vede nimeni.
  const url = /incarcaCladiri\(url = '\/data\/([^']+)'/.exec(readFileSync('src/scene/loaders.js', 'utf8'))?.[1];
  const date = url ? readFileSync(`public/data/${url}`, 'utf8') : '';
  proba(date.includes(`"cheie":"${RONCA}"`), `${RONCA} e o clădire din ${url ?? '(fișierul clădirilor negăsit în loaders.js)'}`);
  const goala = { ...CONTINUT, cladiri: { nume_elemente: CLADIRI.nume_elemente.map(([p, e]) => [p, p === RONCA ? 'Casa da Ronca' : e]) } };
  const g = numeElement(RONCA, goala);
  proba(!g.includes('OpenStreetMap'), `control: CLADIRI cu eticheta goală „Casa da Ronca” — ${g.includes('OpenStreetMap') ? 'TRECE' : `pică („${g}”)`}`);
}
// „bar” și formele lui articulate (barul, barului, baruri, barurile), nu „bară” sau „barieră”.
const FOLOSINTA = /cafene|toalet|restaurant|magazin|(?<![\p{L}\p{N}_])bar(?:ul|ului|uri|urile)?(?![\p{L}\p{N}_])/iu;
const SURSA = /\bOSM\b|NEVERIFICAT|[Oo]bservat/;
/** Etichetele cu o folosință și rândul de deasupra lor, în textul sursă al listei. */
function surseEtichete(lista, text, fisier) {
  const linii = text.split('\n'), rele = [];
  let verificate = 0;
  for (const [prefix, eticheta] of lista) {
    if (!FOLOSINTA.test(eticheta)) continue;
    verificate++;
    const i = linii.findIndex((l) => (l.includes(`'${prefix}'`) || l.includes(`"${prefix}"`)) && l.includes(eticheta));
    if (i < 0) { rele.push(`${fisier}: „${eticheta}” nu se găsește în sursă`); continue; }
    const sus = (linii[i - 1] ?? '').trim();
    if (!/^(\/\/|\/?\*)/.test(sus) || !SURSA.test(sus)) rele.push(`${fisier}:${i + 1} „${eticheta}”, deasupra: „${sus.slice(0, 60)}”`);
  }
  return { rele, verificate };
}
{
  const LISTE = [[SANCTUAR.nume_elemente, 'src/content/sanctuar.js'], [CLADIRI.nume_elemente, 'src/content/cladiri.js']];
  const r = LISTE.map(([l, f]) => surseEtichete(l, CORPUS.get(f), f));
  const rele = r.flatMap((x) => x.rele), n = r.reduce((s, x) => s + x.verificate, 0);
  proba(n > 0 && rele.length === 0, `${n} etichete cu o folosință${rele.length ? `; RELE: ${scurt(rele)}` : ', fiecare cu sursa pe rândul de deasupra'}`);
  const text = CORPUS.get('src/content/sanctuar.js');
  const faraToalete = text.split('\n').filter((l) => !l.includes('amenity=toilets')).join('\n');
  const s = faraToalete !== text ? surseEtichete(SANCTUAR.nume_elemente, faraToalete, 'src/content/sanctuar.js') : null;
  proba(s !== null && s.rele.some((x) => x.includes('toalet')),
    `control: sanctuar.js cu comentariul toaletelor scos — ${s === null ? 'MUTAȚIA NU S-A APLICAT' : s.rele.length ? `pică (${s.rele.join('; ')})` : 'TRECE'}`);
  // Forma articulată: o etichetă „barul …”, fără comentariu, chiar sub începutul listei.
  const BAR = ['aripa_n.bar', 'barul aripii de nord'];
  const cuBar = text.replace(/nume_elemente: \[\n/, () => `nume_elemente: [\n    ['${BAR[0]}', '${BAR[1]}'],\n`);
  const b = cuBar !== text ? surseEtichete([...SANCTUAR.nume_elemente, BAR], cuBar, 'src/content/sanctuar.js').rele.filter((x) => x.includes(BAR[1])) : [];
  proba(b.length === 1, `control: eticheta „${BAR[1]}”, fără comentariu, în sanctuar.js — ${pica(cuBar !== text, b)}`);
  const forme = ['bar', 'barul', 'barului', 'baruri', 'barurile', 'Barul'].filter((x) => !FOLOSINTA.test(`${x} de pe terasă`));
  const altele = ['bară', 'bara', 'barieră', 'Barbosa', 'cabare'].filter((x) => FOLOSINTA.test(`${x} de pe terasă`));
  proba(!forme.length && !altele.length, `folosința „bar” prinde bar, barul, barului, baruri, barurile, nu bară, bara, barieră${forme.length || altele.length ? `; SCAPĂ: ${forme.join(', ') || '—'}; PRINDE GREȘIT: ${altele.join(', ') || '—'}` : ''}`);
}

console.log(picate ? `\n${picate} probe au picat` : '\ntoate probele au trecut');
process.exit(picate ? 1 : 0);
