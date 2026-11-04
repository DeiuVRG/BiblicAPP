# Reguli editoriale pentru traducerile bibliotecii (română)

Versiunea 0.1 (noiembrie 2026). Se aplică tuturor traducerilor în română din biblioteca aplicației,
indiferent de limba-sursă (engleză, latină, germană, greacă veche, franceză). Regulile specifice
unei lucrări stau în `profiles/<slug>.md` și au prioritate asupra celor de aici atunci când spun
explicit altceva. Glosarul (`glossary-ro.csv`) și lista de calcuri (`calques-ro.json`) sunt
citite și de verificările automate; aici sunt doar principiile.

Doctrina de bază este preluată, cu acordul de reutilizare al principiilor, din skill-ul
GP_AI_Translate (Kenneth E. Bailey, „Poet și Țăran”): originalul guvernează sensul, regulile
aprobate guvernează stilul, orice schimbare de sens este o eroare, chiar dacă fraza românească
este elegantă.

## 1. Ordinea priorităților

1. fidelitate semantică față de original;
2. română academică naturală, publicabilă, care se citește ca text scris direct în română;
3. consecvență terminologică (glosar + profilul lucrării);
4. gramatică și ortografie (normele Academiei Române, DOOM3);
5. punctuație și tehnoredactare.

O formulare mai elegantă nu are voie să simplifice, să atenueze, să intensifice sau să completeze
ideea autorului. Nu se adaugă explicații, nu se omit propoziții, nu se trag concluzii noi.

## 2. Unitatea de lucru și alinierea

- Un paragraf-sursă devine exact un paragraf țintă, cu același `sourceId`. Nu se contopesc, nu se
  despart și nu se reordonează paragrafe. Dacă o despărțire pare necesară, se traduce ca un singur
  paragraf și se pune un flag `DE_VERIFICAT` (MINOR) cu propunerea.
- Titlurile de secțiune se traduc (câmpul `headingRo` în partea 0 a secțiunii) și păstrează
  numerotarea originalului (de ex. „II. Împărăția și Vechiul Testament”).
- Textul paragrafului este un singur paragraf, fără linii noi, în forma Unicode NFC, cu diacritice
  cu virgulă (ș, ț), niciodată cu sedilă (ş, ţ).

## 3. Preanaliză înainte de traducere

Pentru fiecare paragraf identifică, înainte de a scrie româna:

- relațiile cauzale, logice, temporale și condiționale;
- negațiile, cuantificatorii și modalitatea (`may`, `must`, `probably`, `only`, `no doubt`,
  `presumably`, `it is plain that`, `it would seem`);
- referenții pronominali și agentivitatea (cine acționează, cine primește, ce este mijloc și ce
  este obiect);
- termenii teologici și tehnici, termenii din limbile vechi, jocurile de cuvinte;
- citatele biblice: ce este citat, ce este parafrază a autorului, ce este aluzie.

## 4. Traducerea

- Tradu integral sensul, nu topica originalului. Reordonează constituenții când româna o cere.
- Română sobră, academică, fluentă; fără calcuri, fără anglicisme reflexe, fără „în mod” în exces,
  fără „acest lucru” pentru fiecare `this`, fără „a realiza” pentru `realize`.
- Păstrează modalitatea și forța evaluativă a autorului. `no doubt` nu devine „poate”; `it may be`
  nu devine „este”.
- Păstrează persoana și registrul autorului. Vos scrie la persoana I plural academică („we”)
  → „noi” implicit, verbe la persoana I plural („vom vedea”, „am observat”).
- Păstrează titlurile, listele, numerotările, evidențierile semantice (cursiv pentru termeni
  străini), ghilimelele și indicii de notă, dacă există.
- Nu moderniza și nu „corecta” teologia autorului. Nu adăuga cuvinte confesionale pe care
  originalul nu le are.
- Numele proprii biblice urmează forma consacrată în tradiția lucrării (vezi profilul).
  Numele unor autori antici și medievali se scriu în forma românească consacrată (Augustin,
  Ioan Gură de Aur, Toma de Aquino); numele moderne rămân în original.
- Cuvintele grecești, ebraice, latine din original se copiază exact (caracter cu caracter, în
  NFC), fără transliterare nouă și fără „corectarea” accentelor; dacă OCR-ul pare stricat, se
  pune flag `SURSA_POSIBIL_ERONATA`.

## 5. Citate și referințe biblice

- Textul biblic citat de autor se traduce **ca text al autorului**, din limba-sursă, fidel
  formulării lui (autorii vechi citează adesea din memorie sau din versiuni proprii). Nu se
  înlocuiește cu o traducere românească a Bibliei scrisă din memorie: modelul nu are voie să
  producă textul unui verset „așa cum sună în Cornilescu/Sinodală”. Fiecare citat se marchează în
  `scripture` cu `mode: "quote-author-rendering"` și referința, ca aplicația să îl poată înlocui
  ulterior cu o ediție licențiată. Aluziile se marchează `allusion`; simplele trimiteri
  `reference`.
- Referințele se scriu în notația românească: carte abreviată, capitol arab, două puncte, versete
  (`Mat. 4:17; Mc. 1:15; Lc. 4:43`), intervale cu linie de unire fără spații (`1 Cor. 15:23–28`),
  liste cu virgulă și spațiu (`In. 3:3, 5`), „ș.urm.” pentru `ff.`, `v.` pentru `vs.`. Lista de
  abrevieri și conversia din notația cu cifre romane sunt date în fiecare job (câmpul
  `references`): folosește exact acele forme. În interiorul unei serii cartea nu se repetă
  (`Mat. 5:12; 6:20`).
- Dacă autorul dă o referință care pare greșită (verset inexistent, capitol greșit), se traduce
  cum e și se pune flag `SURSA_POSIBIL_ERONATA` (MAJOR) cu explicația. Nu se corectează în tăcere.

## 6. Terminologie

- Aplică rândurile `FIX` din glosar când contextul se potrivește; pentru `PREFER`/`WARN` decide
  contextual și consecvent în toată lucrarea. Nu aplatiza distincții pe care autorul le menține
  între doi termeni (de ex. `kingdom`/`kingship`, `church`/`congregation`, `righteousness`/
  `justice`).
- Un termen nou, repetat, pentru care glosarul nu are rând, primește flag `TERMEN_NOU` (INFO) cu
  redarea aleasă, ca să poată fi adăugat după aprobare. Nu modifica glosarul.
- Termenii tehnici ai autorului (de ex. `theological cluster`, `Heilsgeschichte`) se redau
  consecvent și, la prima apariție, cu originalul în paranteză dacă profilul o cere.

## 7. Punctuație și tehnoredactare

- Ghilimele românești: „…” la primul nivel, «…» pentru citat în citat, ’…’ la al treilea nivel.
  Nu se folosesc ghilimelele englezești “…” și nici cele drepte "…".
- Linia de pauză „–” (en dash) pentru intervale și pentru incidente, cu spații când are funcție
  incidentă; cratima „-” doar în cuvinte compuse și forme legate (s-a, într-o, de-a).
- Puncte de suspensie: semnul unic „…”.
- Secole: „secolul I”, „secolul al XIX-lea” în proză; în note, „sec. XIX”.
- Majuscule: „Împărăția lui Dumnezeu”, „Împărăția cerurilor”, „Biserica” (instituția), „Legea”
  (mozaică), „Evanghelie/Evangheliile”, „Vechiul Testament”, „Noul Testament”, „Scriptura”,
  „Duhul Sfânt”, „Fiul Omului”, „Mesia”, „Mântuitorul”, „Domnul”. Pronumele referitoare la
  Dumnezeu cu literă mică (uz academic), dacă profilul nu cere altfel.
- Numerele: cifrele din original rămân cifre; numerele în litere rămân în litere.

## 8. Flag-uri (ce semnalezi, cum)

Fiecare flag are `code`, `severity`, `note` și, ori de câte ori se poate, `quoteSource` și
`quoteTarget` (citate exacte, niciodată poziții).

- `CRITIC`: nu ai putut reda sensul fără pierdere sau ambiguitatea schimbă doctrina/argumentul;
  paragraful nu poate fi publicat fără om.
- `MAJOR`: ambiguitate reală cu două lecturi plauzibile, referință sau citat de verificat, termen
  fără precedent în glosar cu miză teologică.
- `MINOR`: alegere stilistică de revizuit, posibil calc, formulare nefirească de care nu ești sigur.
- `INFO`: termen nou propus, observație pentru revizor.

Codurile: `DE_VERIFICAT`, `SURSA_POSIBIL_ERONATA`, `TERMEN_NOU`, `CITAT_BIBLIC`, `AMBIGUITATE`,
`ALTA`. Nu inventa verificări pe care nu le-ai făcut; nu certifica niciodată traducerea drept
„publicabilă”.

## 9. Auditul criticului (rol separat)

Criticul primește originalul, traducerea și regulile, nu și raționamentul traducătorului. Verifică
în ambele direcții, propoziție cu propoziție:

1. fiecare afirmație din original are corespondent în română?
2. fiecare afirmație din română există în original?
3. negațiile, întrebările, condiționalele și cauzalele sunt păstrate?
4. modalitatea și gradul de certitudine sunt păstrate?
5. rolurile participanților (agent, pacient, instrument, obiect) sunt păstrate?
6. citatele biblice și termenii din limbile vechi sunt redate integral și exact?
7. numele, cifrele, referințele sunt identice?
8. terminologia urmează glosarul și profilul; calcurile din listă lipsesc?

Coduri de severitate: `CRITIC` (omisiune/adaos de sens, negație, agentivitate, citat sau referință
schimbată), `MAJOR` (ambiguitate ce poate induce o interpretare greșită, termen inconsecvent),
`MINOR` (formulare, calc, punctuație), `SURSA_POSIBIL_ERONATA`. Fiecare constatare are citatul
exact din sursă și din traducere, problema și o propunere concretă. O listă goală cu verdict `ok`
este un rezultat legitim; nu se inventează probleme pentru a umple raportul.

## 10. Regula de aur

Mai întâi verifică dacă fiecare sens din original a ajuns în română și dacă fiecare sens din
română are justificare în original. Abia după aceea optimizează naturalețea și stilul.
