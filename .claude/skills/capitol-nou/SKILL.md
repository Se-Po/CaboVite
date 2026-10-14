---
name: capitol-nou
description: Creează un capitol narativ nou, cu modulul, conținutul și legăturile de navigație. Invocă cu /capitol-nou [nume].
argument-hint: [nume-capitol]
disable-model-invocation: true
---

Creează capitolul: $ARGUMENTS

1. Citește un capitol existent din `src/chapters/`, dacă există unul potrivit, și
   urmează exact aceeași formă; altfel, forma de la pasul 2. Azi e unul singur,
   `sanctuar.js`: fișa sanctuarului, numai DOM, cu `init({ gazda, continut })` și
   `dispose()`, cu textul în `src/content/sanctuar.js`. Nu inventa o structură nouă.
2. Creează `src/chapters/<slug>.js` care exportă `init(context)` și `dispose()`.
   `dispose()` trebuie să elibereze tot ce alocă `init()` — geometrii, materiale,
   texturi, ascultători de evenimente. Nu lăsa `dispose()` gol „pentru moment".
3. Creează `src/content/<slug>.js` cu textul în română, ca date, separat de cod.
4. Dacă există navigație și scrollspy, înregistrează capitolul în ele; altfel
   întreabă-mă înainte să le creezi. Azi nu există: `index.html` n-are `<nav>`.
5. Fiecare afirmație factuală nouă are nevoie de sursă. Cele fără sursă se
   marchează `<!-- NEVERIFICAT -->`. Nu inventa date sau cifre.
6. Rulează `/verifica-scena <slug>` la final.

Dacă textul capitolului nu mi-l dau eu, scrie o schiță și marcheaz-o clar ca
schiță — nu ca material gata de publicat.
