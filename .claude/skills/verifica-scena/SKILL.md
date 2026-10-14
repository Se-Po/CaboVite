---
name: verifica-scena
description: Listă de verificare pentru o modificare în scena 3D — build-ul, probele Node și pagina în panoul Browser. Invocă cu /verifica-scena.
argument-hint: [ce s-a schimbat]
disable-model-invocation: true
allowed-tools: Bash(npm run build *), Bash(npm run verifica), Bash(npm run verifica -- *), Bash(npm run verifica-*)
---

Verifică modificarea: $ARGUMENTS

O scenă 3D poate compila perfect și afișa un ecran negru. Testele nu prind asta;
ochii prind. Parcurge lista și raportează fiecare punct cu dovadă.

1. **Build** — rulează `npm run build`. Trebuie să treacă fără erori.
2. **Probele Node** — după build, înaintea browserului, rulează `npm run verifica`:
   toate cele nouă `verifica-*`, în paralel, cu un singur rezumat. Trebuie să iasă
   cu „Toate probele au trecut”, fără nicio probă picată sau căzută. Fără
   `date-sursa/`, care nu e în depozit, probele pe date reale se sar cu un rând
   `SĂRIT`: asta nu e un eșec, dar spune în raport care s-au sărit (rezumatul le
   numără și le listează).
3. **Se vede ceva?** Deschide pagina în panoul Browser, fă un screenshot și
   uită-te efectiv la el. Descrie ce vezi. Ecran negru, model lipsă sau cameră
   în interiorul geometriei sunt eșecuri, nu detalii.
4. **Consola** — citește mesajele. Avertismentele WebGL, texturile 404 și
   avertismentele de deprecare three.js contează toate.
5. **Interacțiune** — mișcă camera. Se rotește lin? Controalele răspund?
   Se blochează la limite? Ținta nu iese din zona alpha, iar busola și tasta
   Home duc acasă? Dincolo de alpha, împrejurimile continuă fără crăpături?
6. **Mobil** — redimensionează la 390px lățime. Vederea de pornire e aceeași pe
   orice ecran, cu lateralele tăiate: sanctuarul rămâne în cadru? Butoanele și
   panourile nu se ating între ele? Textul rămâne lizibil? Nu apare scroll
   orizontal?
7. **Memorie** — dacă modificarea schimbă capitolul sau încarcă/descarcă obiecte,
   loghează `renderer.info.memory` înainte și după. Numerele trebuie să revină
   la loc. Dacă urcă monoton, e scurgere.
8. **Fără motion** — cu `prefers-reduced-motion: reduce` activ, animațiile
   automate ale camerei trebuie să fie oprite.

Raportează ce ai verificat și cum. Dacă un punct nu a putut fi verificat, spune
de ce în loc să-l sari. Nu declara nimic funcțional fără dovadă.
