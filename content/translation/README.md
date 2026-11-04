# Materialele pipeline-ului de traducere

Specificația: `docs/traducere-pipeline.md`. Decizii: `docs/decizii.md` (ADR-012).

| Fișier | Rol | Cine îl citește |
| --- | --- | --- |
| `rules-ro.md` | reguli editoriale generice pentru română | agenții (draft, critic, revizie), revizorii umani |
| `output-contract.md` | forma JSON a ieșirilor (draft/final, raport critic) | agenții |
| `profiles/<slug>.md` | profilul lucrării: tradiție, registru, nume, termeni-cheie, capcane | agenții |
| `glossary-ro.csv` | glosar citibil de mașină (regex sursă/țintă, forță, status) | agenții și `translation-check` |
| `calques-ro.json` | calcuri și false friends (regex pe traducere) | agenții și `translation-check` |
| `prompts/<lang>/{draft,critic,revise}.md` | șabloane de prompt cu `{{PLACEHOLDERS}}`, pe limbă-țintă | orchestratorul |

Fluxul pentru o lucrare (`<slug>`, limba țintă `ro`):

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
