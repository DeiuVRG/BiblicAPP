# Biblioteca creștină – reguli de proiect

## Orchestrare și modele (regulă fixă, cerută de proprietar)

- Sesiunea principală (orchestratorul) rulează pe Claude Fable 5.1, cu effort maxim și ultracode activat. Doar orchestratorul este Fable.
- Orice subagent (tool-ul Agent, agenții `agent()` din Workflow, agenții din `.claude/agents/`) rulează pe Sonnet: `model: "sonnet"` (claude-sonnet-5-5), cu effort până la `max` dacă sarcina o cere. Niciodată Fable pentru subagenți.
- Opus (`claude-opus-5-5`) se folosește pentru subagenți doar în cazuri excepționale (de exemplu un judecător final de calitate pe un livrabil critic) și se spune explicit proprietarului când s-a folosit.
- Sarcinile triviale nu se delegă: orchestratorul face singur ce înseamnă câteva apeluri de tool.

## Prioritățile proiectului (stabilite de proprietar, noiembrie 2026)

1. Întâi produsul tehnic: aplicația (Expo: iOS + Android + web), backend-ul (Supabase + serviciul `api`), conținutul, cititorul, offline-ul, plățile.
2. Partea de AI se face spre final (gateway-ul și modurile „Întreabă" vin după ce cititorul și conținutul funcționează).
3. Partea legală și de conformitate se tratează după ce aplicația este gata. Deciziile tehnice care o fac ieftină mai târziu (schema `content` neexpusă, ecranele de consimțământ, ștergerea contului, tabelul de licențe) se construiesc totuși de la început, pentru că retrofit-ul costă mai mult.

## Reguli de produs (fixate de proprietar)

- Fiecare lucrare din bibliotecă se oferă la citire în **română și în engleză**, indiferent de limba originalului (4 noiembrie 2026). Pentru originalele englezești, ediția engleză este textul-sursă; pentru originalele latine, grecești, germane etc. se produc două traduceri din original (nu una din cealaltă), ambele aliniate paragraf cu paragraf la ediția-sursă. Traducerile englezești din domeniul public (de ex. NPNF pentru Augustin) se folosesc doar ca referință pentru critic, nu se copiază. Interfața aplicației urmează aceeași regulă: română și engleză, cu limba de lectură și limba interfeței alese de utilizator.

## Arhitectura de referință

- Documentul de referință este `docs/arhitectura-app-biblica.md` (v2, 4 noiembrie 2026). Deciziile de acolo sunt implicite; orice abatere se notează în `docs/decizii.md` cu motiv.
- Referințe de produs de reținut: The Faith Received (Mere Orthodoxy), Faclia Ebooks, modalul de membership Mere Orthodoxy. Detalii în documentul de arhitectură, secțiunea 2.

## Convenții

- Limba: răspunsurile către proprietar în română; codul, comentariile, numele de fișiere și mesajele de commit în engleză.
- Monorepo pnpm, TypeScript strict. Fără secrete în repo: în client ajung doar chei publice.
- Containerul sesiunii cloud este efemer: tot ce are valoare se comite și se împinge în repo-ul GitHub înainte de a opri lucrul.
- Înainte de a adăuga un modul nativ: verificare de compatibilitate cu arhitectura nouă React Native și cu alinierea la pagini de 16 KB pe Android.
