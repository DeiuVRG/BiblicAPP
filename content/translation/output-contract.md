# Contractul de ieșire al traducerii (per job)

Fiecare job de traducere (`translation-<lang>/jobs/<jobId>.json`) conține paragrafele-sursă ale
unei porțiuni de secțiune, cu ID-uri stabile. Ieșirea traducătorului și a revizorului este un
singur fișier JSON (`drafts/<jobId>.json`, respectiv `final/<jobId>.json`) cu forma de mai jos.
Fișierul este validat strict: orice cheie necunoscută este o eroare.

```json
{
  "jobId": "vos-1903-kingdom-ro-01-00",
  "pass": "draft",
  "model": "claude-sonnet-5-5",
  "headingRo": "I. Introducere",
  "paragraphs": [
    {
      "sourceId": "01M6JQPD948SXM9E7GNT39CV00",
      "text": "În ansamblul învățăturii Domnului nostru, așa cum este consemnată în Evanghelii, …",
      "flags": [
        {
          "code": "CITAT_BIBLIC",
          "severity": "INFO",
          "quoteSource": "the kingdom was at hand",
          "quoteTarget": "Împărăția era aproape",
          "note": "Parafrază a autorului după Mat. 4:17, tradusă ca text al autorului."
        }
      ],
      "scripture": [
        { "ref": "Mat. 4:17", "mode": "reference" },
        { "ref": "Mc. 1:15", "mode": "reference" },
        { "ref": "Lc. 4:43", "mode": "reference" }
      ]
    }
  ],
  "notes": "Observații pentru revizor, opțional."
}
```

Reguli:

1. `jobId` identic cu cel din job. `pass` este `draft` pentru prima traducere și `revised` pentru
   textul revizuit după critic. `model` este identificatorul modelului care a scris textul.
2. `headingRo` este obligatoriu când `part` din job este `0` (prima parte a secțiunii): titlul
   secțiunii în română, cu numerotarea originalului.
3. `paragraphs` are **exact** un element pentru fiecare paragraf din job, în aceeași ordine, cu
   același `sourceId`. Nicio contopire, nicio despărțire, nicio omisiune.
4. `text`: un singur paragraf, fără linii noi, NFC, diacritice cu virgulă. Niciodată gol. Nu
   conține ID-uri, note de traducător în paranteze drepte sau markup Markdown; observațiile merg în
   `flags`.
5. `flags`: lista poate fi goală. Codurile și severitățile sunt cele din `rules-ro.md` §8.
   Citatele (`quoteSource`, `quoteTarget`) sunt fragmente exacte, copiate, nu poziții.
6. `scripture`: toate referințele și citatele biblice din paragraf, în notația românească din job
   (câmpul `references[].target`), cu `mode` ∈ `reference | quote-author-rendering | allusion`.
7. `notes`: opțional, scurt, pentru revizorul uman. Nu este text publicabil.

Raportul criticului (`critic/<jobId>.json`):

```json
{
  "jobId": "vos-1903-kingdom-ro-01-00",
  "pass": "critic",
  "model": "claude-sonnet-5-5",
  "findings": [
    {
      "sourceId": "01M6JQPD948SXM9E7GNT39CV02",
      "severity": "CRITIC",
      "category": "negatie",
      "quoteSource": "indeed occurs only twice altogether",
      "quoteTarget": "apare de mai multe ori",
      "problem": "Cuantificatorul „only twice” a fost pierdut; sensul este inversat.",
      "proposal": "apare, de fapt, doar de două ori în total"
    }
  ],
  "verdict": "revise",
  "summary": "O omisiune critică, două calcuri."
}
```

`category` ∈ `omisiune | adaos | negatie | modalitate | agentivitate | referinta | termen | calc |
gramatica | punctuatie | alta`. `verdict` este `ok` când nu există constatări CRITIC sau MAJOR.

Verificarea automată (`translation-check`) rulează după fiecare pas și scrie
`checks/<jobId>.json`. Codul de ieșire 0 înseamnă: paritate completă, fără constatări CRITIC.
Cu `--strict`, și fără MAJOR.
