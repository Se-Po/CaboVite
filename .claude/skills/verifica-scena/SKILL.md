---
name: verifica-scena
description: Listă de verificare pentru o modificare în scena 3D, în panoul Browser. Invocă cu /verifica-scena.
argument-hint: [ce s-a schimbat]
disable-model-invocation: true
allowed-tools: Bash(npm run build *)
---

Verifică modificarea: $ARGUMENTS

O scenă 3D poate compila perfect și afișa un ecran negru. Testele nu prind asta;
ochii prind. Parcurge lista și raportează fiecare punct cu dovadă.

1. **Build** — rulează `npm run build`. Trebuie să treacă fără erori.
2. **Se vede ceva?** Deschide pagina în panoul Browser, fă un screenshot și
   uită-te efectiv la el. Descrie ce vezi. Ecran negru, model lipsă sau cameră
   în interiorul geometriei sunt eșecuri, nu detalii.
3. **Consola** — citește mesajele. Avertismentele WebGL, texturile 404 și
   avertismentele de deprecare three.js contează toate.
4. **Interacțiune** — mișcă camera. Se rotește lin? Controalele răspund?
   Se blochează la limite?
5. **Mobil** — redimensionează la 390px lățime. Scena se reîncadrează? Textul
   rămâne lizibil? Nu apare scroll orizontal?
6. **Memorie** — dacă modificarea schimbă capitolul sau încarcă/descarcă obiecte,
   loghează `renderer.info.memory` înainte și după. Numerele trebuie să revină
   la loc. Dacă urcă monoton, e scurgere.
7. **Fără motion** — cu `prefers-reduced-motion: reduce` activ, animațiile
   automate ale camerei trebuie să fie oprite.

Raportează ce ai verificat și cum. Dacă un punct nu a putut fi verificat, spune
de ce în loc să-l sari. Nu declara nimic funcțional fără dovadă.
