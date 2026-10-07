import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';

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

export default defineConfig({
  plugins: [scrieVersiunea()],
  server: { port: 5173 },
  build: { target: 'es2022', sourcemap: true },
});
