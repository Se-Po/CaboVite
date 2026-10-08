import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { antetePentru, reguliVercel } from './scripts/comun/vercel.mjs';

/**
 * Versiunea paginii, din prefixul `0.1.N.xx` al subiectului de commit: versiunea e
 * `v0.1.N`, cea a ultimului push. Fiecare commit poartă prefixul, deci nu există o
 * a doua cifră de ținut la zi. Pe Vercel subiectul vine din `VERCEL_GIT_COMMIT_MESSAGE`,
 * fiindcă clona de acolo e scurtă; altfel din `git log`, primul subiect cu prefix — un
 * commit de îmbinare nu-l are. Fără niciunul, pagina nu scrie nicio versiune: una
 * greșită ar fi mai rea decât lipsa ei.
 *
 * Pe serverul de dezvoltare e versiunea ultimului commit, fără ce nu e încă salvat.
 */
const PREFIX = /^(\d+\.\d+\.\d+)\.(\d+)\s/;

function subiecte() {
  const vercel = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0];
  let git = [];
  try {
    git = execFileSync('git', ['log', '-50', '--format=%s'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n');
  } catch { /* fără git: rămâne Vercel, dacă e */ }
  return [vercel, ...git].filter(Boolean);
}

function versiune() {
  for (const s of subiecte()) {
    const m = PREFIX.exec(s);
    if (m) return { versiune: m[1], commit: `${m[1]}.${m[2]}` };
  }
  console.warn('versiune: niciun subiect de commit cu prefixul 0.1.N.xx; pagina nu scrie versiunea');
  return null;
}

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Scrie versiunea în `index.html`, în locul comentariului `<!-- versiune -->`. */
function scrieVersiunea() {
  const v = versiune();
  const marcaj = v
    ? `<p id="versiune" title="commitul ${escape(v.commit)}"><span class="ascuns">Versiunea paginii: </span>v${escape(v.versiune)}</p>`
    : '';
  return {
    name: 'versiune',
    transformIndexHtml: (html) => html.replace('<!-- versiune -->', marcaj),
  };
}

/**
 * `npm run preview` trimite antetele de securitate din vercel.json, ca build-ul încercat
 * local să aibă aceeași politică (CSP) ca pagina publicată. Cu `--mode csp-impus` politica
 * pleacă impusă în loc de Report-Only: așa se vede local, înainte de a o impune pe Vercel,
 * ce ar bloca. Cache-Control NU se trimite local: un fișier în lucru, rescris sub același
 * nume, ar rămâne un an vechi în browserul de probă. Serverul de dezvoltare nu primește
 * nimic — Vite servește acolo scripturi inline și un websocket, pe care politica le oprește.
 */
function anteteVercel() {
  return {
    name: 'antete-vercel',
    configurePreviewServer(server) {
      const reguli = reguliVercel();
      const impus = server.config.mode === 'csp-impus';
      server.middlewares.use((req, res, next) => {
        const cale = new URL(req.url, 'http://local').pathname;
        for (const [k, v] of Object.entries(antetePentru(reguli, cale))) {
          if (k === 'cache-control') continue;
          res.setHeader(k === 'content-security-policy-report-only' && impus ? 'content-security-policy' : k, v);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [scrieVersiunea(), anteteVercel()],
  server: { port: 5173 },
  // Hărțile de cod se publică, dar Vercel le dă numai membrilor echipei autentificați
  // („Protected Source Maps”); publicul primește 403. Rămân pentru depanarea paginii
  // publicate, cu stivele arătate pe sursă (alegerea autorului, 2026-10-08).
  //
  // Ținta: es2022, plus Safari și iOS 15.4. three r186 are șase blocuri `static {}`, pe care
  // es2022 le lasă neatinse, iar Safari le parsează abia de la 16.4: sub el tot graful de module
  // cădea, cu pagina goală. Coborâte, devin atribuiri după clasă (+62 B în three.core). Proba:
  // `npm run verifica-livrare` numără blocurile din dist/assets.
  build: { target: ['es2022', 'safari15.4', 'ios15.4'], sourcemap: true },
});
