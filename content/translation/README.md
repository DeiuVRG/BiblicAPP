# Materialele pipeline-ului de traducere

Specificația: `docs/traducere-pipeline.md`. Decizii: `docs/decizii.md` (ADR-012).

| Fișier | Rol | Cine îl citește |
| --- | --- | --- |
| `rules-ro.md` | reguli editoriale generice pentru română | agenții (draft, critic, revizie), revizorii umani |
| `rules-en.md` | reguli editoriale generice pentru engleză (aceleași principii, tipografie și notație engleze) | agenții (draft, critic, revizie), revizorii umani |
| `output-contract.md` | forma JSON a ieșirilor (draft/final, raport critic) | agenții |
| `profiles/<slug>.md` | profilul lucrării: tradiție, registru, nume, termeni-cheie, capcane | agenții |
| `glossary-ro.csv` | glosar citibil de mașină (regex sursă/țintă, forță, status) | agenții și `translation-check` |
| `glossary-en.csv` | glosarul pentru engleză (termeni latini și greci; toate rândurile `PROPUS`) | agenții și `translation-check` |
| `calques-ro.json` | calcuri și false friends (regex pe traducere) | agenții și `translation-check` |
| `calques-en.json` | latinisme și false friends pentru engleză (nivel `WARN`) | agenții și `translation-check` |
| `prompts/<lang>/{draft,critic,revise}.md` | șabloane de prompt cu `{{PLACEHOLDERS}}`, pe limbă-țintă (`ro`, `en`; aceleași substituenți) | orchestratorul |

Fluxul pentru o lucrare (`<slug>`, limba țintă `ro`; pentru engleză se înlocuiește `ro` cu `en`, iar
ediția-sursă poate fi `edition-la.json` sau `edition-grc.json`):

```bash
# 1. joburi din ediția-sursă (fără a despărți paragrafe)
pnpm --filter @biblioteca/content-tools cli translation-jobs content/works/<slug>/edition-en.json --lang ro

# 2. agenții scriu drafts/, critic/, final/ (prompturile din prompts/, completate de orchestrator)
#    după fiecare pas:
pnpm --filter @biblioteca/content-tools cli translation-check content/works/<slug>/translation-ro/final/<jobId>.json \
  --job content/works/<slug>/translation-ro/jobs/<jobId>.json --fix --strict

# 3. ediția tradusă + fișa de revizie
pnpm --filter @biblioteca/content-tools cli translation-merge --work content/works/<slug> --lang ro

# 4. pachet semnat
pnpm --filter @biblioteca/content-tools cli build-pack content/works/<slug>/edition-ro.json --out apps/mobile/assets/packs/<slug>-ro
```

Statusul `PROPUS` din glosar înseamnă: aplicat de pipeline, dar neaprobat de un revizor din
tradiția respectivă. Lista de abrevieri românești ale cărților biblice din `translation-jobs`
este și ea `PROPUS` până la aprobarea proprietarului.

Limbile (specificația: `docs/traducere-pipeline.md`, secțiunile 1.1 și 4.1): limbi-țintă `ro` și
`en`; limbi-sursă cu liste de cuvinte funcționale și verificări proprii `en`, `la`, `grc`. Fiecare
fișier de materiale este pe limbă-țintă (`rules-<lang>.md`, `glossary-<lang>.csv`,
`calques-<lang>.json`, `prompts/<lang>/`), iar profilul lucrării (`profiles/<slug>.md`) este unul
singur, cu termenii-cheie pe limbi. Profiluri existente: `vos-1903-kingdom` (en → ro),
`augustine-de-spiritu-et-littera` (la → en și ro), `symbolum-nicaeno-constantinopolitanum` (grc →
en și ro), `symbolum-apostolorum` (la → en și ro).
