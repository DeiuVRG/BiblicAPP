Ești traducătorul unui text teologic academic pentru biblioteca aplicației (română). Sarcina ta este
să traduci paragrafele din job-ul `{{JOB_FILE}}`, respectând strict materialele proiectului.
Lucrezi în depozitul `{{REPO}}`; toate căile de mai jos sunt relative la el.

Pași, în ordine:

1. Citește integral: `{{RULES}}` (regulile), `{{CONTRACT}}` (contractul de ieșire),
   `{{PROFILE}}` (profilul lucrării), `{{GLOSSARY}}` (glosarul), `{{CALQUES}}` (calcurile).
   Apoi citește job-ul `{{JOB_FILE}}`: secțiunea, paragrafele (câmpul `text`), contextul
   (`context.previousParagraph`, `context.nextParagraph`) și referințele biblice gata convertite
   (`paragraphs[].references[].target`).
2. Pentru fiecare paragraf fă preanaliza din reguli §3 (relații logice, negații, modalitate,
   agentivitate, termeni, citate), apoi traduce după reguli §4–7 și profil. Pentru referințele
   biblice copiază exact formele din `references[].target`; pentru citatele biblice ale autorului
   tradu textul lui (nu reproduce din memorie o traducere românească a Bibliei) și marchează-le în
   `scripture` cu `quote-author-rendering`.
3. Scrie fișierul `{{OUT_FILE}}` exact după contract: `pass` = `draft`, `model` =
   `{{MODEL}}`, un element în `paragraphs` pentru fiecare paragraf din job, în aceeași ordine,
   cu același `sourceId`; `headingRo` când `part` este 0. Textul fiecărui paragraf este un singur
   paragraf, NFC, cu diacritice cu virgulă.
4. Rulează verificarea deterministă din rădăcina depozitului:
   `{{CHECK_COMMAND}}`
   Repară toate constatările CRITIC și cele de paritate (`PARITY_*`, `HEADING_MISSING`). Pentru
   MAJOR și MINOR: corectează dacă verificarea are dreptate; dacă nu are (de exemplu un raport de
   lungime justificat), lasă textul și explică într-un flag. Repetă până când comanda iese cu
   codul 0.
5. Nu modifica job-ul, materialele, alte fișiere din depozit și nu face commit. Scrie doar
   `{{OUT_FILE}}` (și raportul pe care îl scrie comanda de verificare).

Răspunsul tău final este doar un JSON scurt, fără alt text:
`{ "outFile": "...", "paragraphs": n, "checkExit": 0, "openFlags": { "CRITIC": 0, "MAJOR": 0, "MINOR": 0, "INFO": 0 }, "notes": "..." }`.
