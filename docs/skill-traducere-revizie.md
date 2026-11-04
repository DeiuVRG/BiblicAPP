# Skill-ul de traducere GP_AI_Translate: evaluare și plan

Data: 4 noiembrie 2026. Obiect: `DeiuVRG/GP_AI_Translate` (fork al `gpaulro/GP_AI_Translate`, commit 530faaa, un singur commit, fără tag-uri). Metodă: patru revizii independente (inginerie de skill, editorial română, potrivire cu pipeline-ul nostru, analiză adversarială), o sinteză și două contra-verificări (perspectiva autorului, rigoarea planului). Toate rulate pe Sonnet, conform regulii de proiect.

## Ce este

Un skill Claude v2.0 pentru traducerea academică EN → RO a lucrării lui Kenneth E. Bailey, „Poet și Țăran", capitol cu capitol, cu editor uman. Șapte fișiere: `SKILL.md` (workflow), reguli editoriale, glosar CSV cu statusuri, decizii editoriale, listă de calcuri și false friends, profil stilistic al capitolului 1 aprobat.

**Ce e foarte bun și reutilizăm direct în pipeline-ul aplicației**: principiul de autoritate (originalul guvernează sensul), auditul de fidelitate bidirecțional din §5 (devine corpul prompt-ului de critic), codurile de severitate CRITIC/MAJOR/MINOR/SURSA_POSIBIL_ERONATĂ și câmpurile `[DE VERIFICAT]` (vocabularul nostru de flag-uri), preanaliza semantică din §3 (modalitate, negații, instrument versus obiect), distincția CITAT_BIBLIC versus RECONSTRUCȚIE_LITERARĂ_A_AUTORULUI, guvernanța APROBAT/PROPUS din §11, detectorul de sintaxă englezească și regula anti-supranormalizare din fișierul de calcuri, cele trei niveluri de revizie din regulile editoriale, regula „nu inventa verificări pe care nu le-ai executat".

## Slăbiciuni structurale

1. **Depinde de materiale care nu sunt în repo**: capitolul 1 aprobat, documentul `Reguli traducere și tehno.docx`, corpusul EDCR/EDC100, imaginile paginilor, scripturile de „verificări automate" din §7. Fără ele, modelul fie marchează totul, fie improvizează.
2. **Auditul „independent" nu e independent**: §5 permite „schimbă explicit rolul" în aceeași sesiune, deci traducătorul și auditorul împart aceleași puncte oarbe (cazul Luca 16:9, mijloc versus obiect, e exact un astfel de caz).
3. **Aceeași regulă trăiește în până la trei locuri** (13 din 29 rânduri de glosar se repetă în decizii și în calcuri, cu etichete diferite), ordinea de prioritate diferă între `SKILL.md` §0 și regulile editoriale §1, statusul APROBAT/PROPUS apare doar în `SKILL.md`, iar regula de actualizare din decizii lasă agentul să scrie memorie fără aprobare.
4. **Nimic nu e verificabil mecanic**: fără schemă de ieșire, ID-urile de paragraf sunt ținute în afara livrabilului, fără sintaxă fixă a markerilor de notă, fără regulă NFC/diacritice cu virgulă.

Observație importantă a contra-verificării: mai multe „conflicte" semnalate de revizii sunt doar inconsecvențe de etichetă fără efect pe comportament, iar o parte din planul inițial ar fi schimbat alegeri deja aprobate de autor. Planul de mai jos e versiunea tăiată după aceste obiecții.

## Verdict

- **Pentru Bailey, azi**: utilizabil ca atare de autorul lui, cu trei precauții: eticheta sinceră a modului de audit (apel separat sau aceeași sesiune), niciun text de verset scris din memorie (doar din sursa furnizată sau marcat `[DE VERIFICAT – CITAT EDCR]`), nicio scriere în glosar/decizii înainte de aprobare explicită.
- **Pentru pipeline-ul aplicației**: nu e drop-in. Doctrina e bună; forma e un dosar de prompt, nu o componentă de pipeline. Devine utilă printr-un skill generic nou (v3), construit lângă `packages/content-tools`, care reutilizează textele de mai sus și adaugă date, scheme și scripturi.

## Plan v2.1, minim și compatibil, pentru Bailey (propus ca pull request pentru gpaulro, nu commit-uri directe)

1. Tag `v2.0-bailey` pe commit-ul 530faaa; `CHANGELOG.md`; README aliniat la `SKILL.md` (pasul 4 despre capitolul 1).
2. Legendă unică a etichetelor (FIX, FIX_CONTEXT, PREFER, WARN, FORBID, FORBID_CONTEXT, AVOID_CALQUE, FALSE_FRIEND) și o singură frază de departajare: un rând APROBAT din glosar bate un WARN din calcuri. Ordinea de prioritate rămâne întrebare pentru gpaulro (cele două ordini existente se confruntă cu documentul docx).
3. Propoziția lipsă în regula de actualizare a deciziilor („după aprobarea utilizatorului") și etichete APROBAT/PROPUS pe intrări.
4. Eticheta `audit_mode` în livrabil (model diferit, același model în context nou, același context). `(OBLIGATORIU)` rămâne.
5. Subsol de trei linii doar când ceva nu a rulat sau rămâne un CRITIC deschis: ce verificări au rulat, ce nu, câte probleme deschise. Fără hash-uri sau numărători pe care modelul nu le poate calcula fără unelte.
6. §9 redus la o propoziție: formularea unui verset vine doar din textul-sursă din fața modelului (tradus ca text al autorului) sau dintr-o ediție furnizată, copiată verbatim; niciodată din memorie; niciodată etichetată EDCR dacă nu e din EDCR.
7. Descriere de frontmatter cu termeni de declanșare (Bailey, Poet și Țăran, capitol, notă, glosar), verificată la limita de lungime; numele rămâne neschimbat.

Tot ce schimbă textul produs (notația diagramelor, modificări în glosar, reguli noi de convenții, ordinea de prioritate) e decizia lui gpaulro și intră doar cu acordul lui.

## Plan v3, skill generic pentru biblioteca noastră (în `biblicapp`, lângă `content-tools`)

- **Strat de date unic, citibil de mașină**: glosar CSV cu `term_id`, concept, formă sursă și regex, redare RO (o valoare pe rând, variante permise separat), tradiție, scop (lucrare/context), forță, tip, status, deviație, decizie, aprobator; calcuri cu regex rezistent la flexiune (`asum[a-zăâîșț]* că`); decizii append-only cu ID și `supersedes`. Fișierele de proză ale lui Bailey devin vederi generate; o migrare unică a celor 29 de rânduri.
- **Profiluri pe lucrare și tradiție**: vocabularul se alege după tradiția autorului (nedespărțită, ortodoxă, catolică, protestantă), nu după licența Bibliei și nu după cititor; registru, formă de adresare, politică de majuscule pentru numele divine, ediție biblică și versificare, 3–8 pasaje-exemplar. Alegerile Bailey (pildă, Hristos, Yahweh, „cluster teologic", persoana a II-a) devin suprascrieri pe lucrare, nu reguli generale. Rânduri-semință pentru perechile confesionale (Iisus/Isus, Hristos/Cristos, Duhul Sfânt/Spiritul Sfânt, Născătoare de Dumnezeu/Maica Domnului, Euharistie/Împărtășanie, taină/sacrament, episcop/presbiter/preot/pastor) toate PROPUS până le aprobă un revizor din tradiția respectivă.
- **Contract de ieșire per paragraf**: o unitate de intrare = o unitate de ieșire, același ID (ULID atribuit la ingest, niciodată de model), fără contopiri sau tăieri (o tăiere necesară e flag, nu acțiune); textul tradus NFC cu diacritice cu virgulă; markerii de notă păstrați în ordine; Scriptura ca sloturi `{{S1}}` cu moduri `verbatim | loose | allusion | reconstruction` (în `verbatim` aplicația umple slotul din ediția licențiată din DB, modelul nu scrie text de verset); pasajele ne-latine copiate byte cu byte; flag-uri cu citate exacte, niciodată offset-uri (codul le rezolvă în puncte de cod NFC); status doar `drafted | needs_human`. Validare pe server cu respingere și reîncercare.
- **Mod Batch**: prefix înghețat și cache-uibil (reguli + profil + felia de glosar pe tradiție + calcuri FORBID + exemplare, cu hash), context doar din sursă (nu din drafturi anterioare), fără opriri interactive (flag-uri cu opțiuni), joburi separate: draft → critic (prompt-ul §5) → pas editorial doar pe română → retro-traducere ca semnal de triaj.
- **Scripturi deterministe**: markeri de note, caractere grecești/ebraice/siriace byte-identice (NFC, niciodată NFKC), paritate A/B/A′ și săgeți, tipografie (sedilă, non-NFC, ghilimele, linii), aderență la glosar, calcuri, paritate referințe biblice/numere/nume, reziduuri netraduse, raport de lungime. Toate emit flag-uri în aceeași schemă.
- **Evaluări pe proprietăți**, nu pe diff (ieșirile LLM variază): set de markeri egal, transliterări identice, săgeți numărate, zero sedile, „mamona nu e obiectul prieteniei" judecat de un grader; cazuri de regresie versus cazuri de comportament nou; textul lui Bailey rămâne în repo privat (e sub drepturi de autor).
- **Fișa de revizor, proveniența, poarta de licență**: export/import cu ID-uri stricte (o editare creează revizie nouă, nu suprascrie), ordonare după risc, JSON de proveniență pentru panoul „Transparența traducerii", refuzul job-urilor fără înregistrare de licență pentru ediția-sursă.
- **Mai târziu**: modernizarea ortografică a edițiilor românești vechi (cod determinist în `content-tools`, nu sarcină de model), liste de calcuri pentru surse germane, latine și grecești, tabele de nume proprii și termeni dogmatici pe tradiție.

## Întrebări

Pentru gpaulro (deciziile lui, nu ale planului): ordinea de prioritate corectă; cele șase redări aprobate care extind sau nuanțează sensul (de exemplu „bill" → „factură", „leave the building" → „predă registrele și pleacă") rămân cum sunt?; cum se tratează versetele pe care Bailey le comentează (Luca 16:9, 16:16): textul lui în proză și EDCR în notă?; sintaxa markerilor de notă și notația diagramelor din capitolul 1; mediul în care rulează skill-ul (Claude.ai, Project sau Claude Code), care decide dacă fișierele de stare și scripturile sunt posibile; dacă acceptă v2.1 ca pull request.

Pentru noi: v3 trăiește în `biblicapp` (propus); cine aprobă glosarul pe fiecare tradiție; care sunt primele lucrări ne-engleze (decide dacă listele de calcuri pentru latină, greacă și germană vin înainte de primul lot); ediția biblică licențiată care umple sloturile la lansare și cine întreține mapările de versificare.
