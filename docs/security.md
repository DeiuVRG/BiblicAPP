# Securitate – baseline M0 și ce este amânat

Stare la sfârșitul M0: aplicația nu are conturi, server, plăți sau AI. Suprafața de atac este deci mică: lanțul de livrare (dependențe, GitHub Actions, APK-ul și site-ul static), conținutul (pachete semnate) și schema Supabase scrisă dar neaplicată. Documentul de arhitectură (`docs/arhitectura-app-biblica.md`, secțiunile 5 și 7) rămâne referința pentru ce urmează.

## 1. Principii

1. **Nimic secret în repo și nimic secret în client.** Tot ce are prefixul `EXPO_PUBLIC_` ajunge în bundle-ul web și în APK și este vizibil oricui. În client intră doar chei publice (URL, cheie „publishable"/anon, chei publice de semnare).
2. **Refuz implicit.** Baza de date: RLS pe toate tabelele, drepturi revocate și acordate unul câte unul, schema `content` neexpusă. CI: `permissions: contents: read` și extinderi doar pe job.
3. **Conținutul se verifică, nu se presupune.** Aplicația nu afișează un pachet fără sha256 și semnătură Ed25519 valide față de o cheie fixată în cod.
4. **Orice abatere se scrie.** Excepțiile (de exemplu o vulnerabilitate tolerată) au motiv și dată de expirare, în repo.

## 2. Checklist baseline (M0)

| # | Control | Stare | Unde se verifică |
| - | ------- | ----- | ---------------- |
| 1 | Fără secrete în repo; doar `.env.example` cu valori publice; `.env*` și `content/keys/` ignorate de git | făcut | `.gitignore`, revizuire la PR |
| 2 | Script care pică dacă o valoare `EXPO_PUBLIC_*` arată a secret (prefixe `sk_`, `pk_live_`, `ghp_`, JWT `service_role`, nume `*_SECRET`/`*_TOKEN`, șiruri lungi cu entropie mare, valori din `secrets.*`) | făcut | `scripts/check-public-env.mjs` (+ teste), pas în `ci.yml`, `web-pages.yml`, `android-apk.yml` |
| 3 | Pachete de conținut: schemă Zod, sha256, semnătură Ed25519 cu două chei publice fixate (curentă + următoare), `minAppVersion`; un pachet neverificat nu este afișat | făcut | `apps/mobile/src/content/verify-pack.ts`, `trusted-keys.ts`, teste Jest |
| 4 | Chei private de semnare în afara repo-ului | făcut (cheie de dezvoltare în `content/keys/`, ignorat) | `.gitignore` |
| 5 | Lockfile înghețat în CI, scripturile de instalare ale dependențelor limitate la o listă explicită | făcut | `pnpm install --frozen-lockfile`; `pnpm.onlyBuiltDependencies` în `package.json` |
| 6 | Dependabot săptămânal, grupat (npm și GitHub Actions) | făcut | `.github/dependabot.yml` |
| 7 | `pnpm audit --prod`, nivel moderate, plus `pnpm audit` pe tot arborele (unelte de build incluse), nivel high: pică la orice avizare neexceptată; fără remediere = avertisment doar sub nivelul high; excepțiile au motiv și expirare; `minimumReleaseAge` în pnpm și `cooldown` în Dependabot | făcut | `scripts/audit-gate.mjs`, `scripts/audit-allowlist.json`, job `audit` din `ci.yml`, `pnpm-workspace.yaml`, `.github/dependabot.yml` |
| 8 | GitHub Actions cu privilegii minime: `contents: read` implicit, `pages: write` + `id-token: write` doar la deploy, `contents: write` doar la atașarea la release (cu `gh release`, fără acțiune de la terți); `persist-credentials: false`; numele tag-ului nu este niciodată expandat în script (trece prin `env`); tag-urile `v*` se construiesc doar dacă punctează într-un commit din `main`; fără `pull_request_target`; fără secrete necesare în M0 | făcut | `.github/workflows/*.yml` |
| 9 | Versiuni de instrumente fixate: Node 22.23.4, pnpm 10.28.0, Java 17 (Temurin); acțiunile oficiale (`actions/*`, `pnpm/*`) fixate la versiune majoră, acțiunile de la terți (`android-actions/setup-android`, `gradle/actions/wrapper-validation`) fixate pe SHA complet, CLI Supabase și gitleaks fixate la versiune (gitleaks și cu SHA-256); Dependabot le ține la zi | făcut | variabilele `env` din workflow-uri |
| 10 | `concurrency` pe workflow-uri (nu se suprapun deploy-urile; build-urile vechi se anulează) | făcut | `.github/workflows/*.yml` |
| 11 | Schema Supabase: RLS peste tot, politici de proprietar cu `(select auth.uid())`, `REVOKE ALL ON SCHEMA content`, funcții `SECURITY DEFINER` cu `search_path` fixat, `EXECUTE` doar pentru gateway, tabele `entitlements`/`audit_log`/`edition_revisions` fără acces din client | scris și revizuit, **neaplicat** | `supabase/migrations/0001_init.sql` |
| 12 | Test pgTAP care enumeră drepturile rolurilor `anon`/`authenticated` și pică la orice drept în afara listei permise, plus teste RLS între utilizatori | scris (53 de verificări, inclusiv privilegiile implicite pentru funcții noi, tabelele append-only și mărginirea ID-urilor ciornă), rulat pe PostgreSQL 16 cu un înlocuitor pentru rolurile Supabase și pentru pgTAP; pe stack-ul Supabase real rulează în CI la orice PR care atinge `supabase/` (de făcut verificare obligatorie în ruleset) | `supabase/tests/grants.sql`, `.github/workflows/supabase-tests.yml` |
| 13 | APK de test semnat cu cheia de debug, marcat ca nedistribuibil în magazine; verificarea semnăturii APK este blocantă în CI, alinierea la 16 KB este informativă; release-urile GitHub sunt mereu „pre-release” cu text „doar test”; `allowBackup: false` | făcut | `android-apk.yml`, ADR-003 |
| 14 | Web: export static, fără cookie-uri, fără scripturi de la terți, fără analitice | făcut | `apps/mobile` |
| 15 | Date personale: niciuna colectată; setările și poziția de lectură rămân local pe dispozitiv | făcut | `apps/mobile/src/storage` |
| 16 | Rădăcina de încredere (chei publice fixate, pachete semnate), lanțul CI/release, schema SQL și scripturile au proprietar de cod; `main` cere revizuirea proprietarului (vezi setările de mai jos) | fișierul făcut, regula de ruleset o pune proprietarul | `.github/CODEOWNERS` |
| 17 | Scanare de secrete în istoric la fiecare push/PR (gitleaks, binar verificat cu SHA-256) și scanare a bundle-ului construit (web și APK) pentru token-uri în formă de secret; `EXPO_PUBLIC_*` din mediul runner-ului este clasificat la fel ca cel din sursă | făcut | job `secrets` din `ci.yml`, `check-public-env.mjs --env --dist` |
| 18 | Verificarea pachetelor: cheia de semnare se caută doar în lista fixată; Ed25519 strict RFC 8032 (`zip215: false`); manifestul nu acceptă câmpuri necunoscute (ar rămâne nesemnate); versiune necunoscută a aplicației = „prea veche” pentru pachetele cu `minAppVersion` > 0.0.0 | făcut | `verify-pack.ts`, `schemas.ts`, teste |
| 19 | Tabelele `audit_log` și `content.paragraph_revisions` sunt append-only inclusiv față de `TRUNCATE` și față de `service_role`; funcțiile noi nu primesc `EXECUTE` pentru PUBLIC (privilegii implicite globale); cote pe rânduri pentru notițe, evidențieri, semne de carte; ID-urile ciornă nu pot fi sondate prin FK | făcut în migrare, **neaplicat** | `0001_init.sql`, `grants.sql` |

### Setări de depozit GitHub (le face proprietarul, nu pot fi puse din cod)

- Settings, Branches: protecție pe `main` (PR obligatoriu, status check-uri `Typecheck, lint, tests, web export, smoke` și `Dependency audit (production)`, fără force-push).
- Settings, Code security: activează Dependabot alerts și security updates, secret scanning cu push protection, private vulnerability reporting.
- Settings, Actions, General: „Workflow permissions" pe **Read repository contents**; „Require approval for first-time contributors" pe toți colaboratorii externi.
- Settings, Rules (ruleset pe `main`): activează „Require review from Code Owners” și „Require status checks” (inclusiv `Secret scan (gitleaks)` și, când schema se aplică, `pgTAP`). Fără aceasta, `CODEOWNERS` nu are efect: un PR care schimbă cheia fixată și re-semnează pachetul ar trece toate verificările CI, care dovedesc doar că pachetul e coerent, nu că cheia e a proprietarului.
- Settings, Rules (tag ruleset): protejează tag-urile `v*` (creare doar de către proprietar, fără ștergere/mutare). Workflow-ul verifică și el că tag-ul punctează în `main`.
- Releases: APK-ul este semnat cu cheia de debug publică a șablonului Expo, deci oricine poate construi un APK acceptat ca actualizare. Nu îl folosi ca sursă de descărcare pe pagina Releases a unui depozit public până nu există un keystore de upload real (secret GitHub + `signingConfigs` printr-un config plugin).
- Settings, Pages: Source = **GitHub Actions** (vezi `README.md`).
- Autentificare în doi pași obligatorie pentru toți cei cu drept de scriere; mediul `github-pages` cu ramura `main` ca singură ramură permisă la deploy.

## 3. Chei de semnare a pachetelor

- Aplicația fixează **două** chei publice în `apps/mobile/src/content/trusted-keys.ts`: `current` și `next`. Cheia privată a lui `current` (dezvoltare) este în `content/keys/` (ignorat de git); cheia `next` este un placeholder fără deținător.
- Cheia de dezvoltare **nu** este o garanție pentru utilizatori reali: oricine are repo-ul poate regenera pachetele de test. Înainte de orice distribuție:
  1. se generează cheia de producție offline (`content-tools keygen`), cu copie de siguranță cifrată în două locuri;
  2. cheia publică înlocuiește `next`, se lansează o versiune a aplicației;
  3. după ce versiunea este larg instalată, se semnează pachetele cu noua cheie și aceasta devine `current`; vechea cheie se retrage într-o versiune ulterioară.
- Cheia privată de producție nu se pune în GitHub Actions în M0. Semnarea rulează local sau, mai târziu, în serviciul `ops` cu aprobare dublă (vezi arhitectura, secțiunea 7).
- Dacă o cheie privată se compromite: se oprește publicarea, se publică o versiune a aplicației care scoate cheia din lista fixată, se resemnează pachetele cu cheia `next`.

## 4. Dacă s-a comis un secret

1. Consideră secretul compromis și **rotește-l întâi** la furnizor (cheie nouă, cheia veche revocată).
2. Abia apoi curăță istoricul (`git filter-repo`) dacă merită; rotirea este singura remediere sigură.
3. Notează incidentul în `docs/decizii.md` (fără valoarea secretului).

## 5. Amânat (cu motiv și declanșator)

| Subiect | De ce nu în M0 | Declanșator |
| ------- | -------------- | ----------- |
| Autentificare (Supabase Auth, chei ES256, MFA `aal2` pentru admin) | Nu există conturi în M0 | începutul milestone-ului cu conturi/sincronizare |
| Atestare de aplicație (Play Integrity, App Attest) | Nu există server care să decidă pe baza ei | când gateway-ul/`get_chapter` sunt reale; semnal moale la început |
| RLS la rulare | Migrarea nu este aplicată; testele reale pgTAP rulează pe stack-ul Supabase | prima aplicare pe un proiect (staging); rulează apoi la fiecare PR |
| Corpurile `get_chapter`/`get_paragraphs`, limite de viteză, `chapter_fetch_log` | Sunt stub-uri (`0A000`) | când conținutul se servește din server |
| Politici RLS pentru `gateway_role` | Rolul are doar `SELECT` și nu are politici; accesul trece prin funcții | migrarea care implementează funcțiile |
| Roluri de personal (admin, revizor) în RLS | Aplicația de administrare nu există | milestone-ul de revizie |
| Descărcarea pachetelor de membru: URL-uri presemnate, plafoane, marcaj forensic | Nu există membri | milestone-ul de plăți |
| Antete HTTP (CSP, HSTS, Referrer-Policy, Permissions-Policy) pentru web | GitHub Pages nu permite antete proprii | mutarea pe Cloudflare (Workers/Pages) sau, până atunci, `<meta>` CSP după ce există conexiuni de rețea |
| Keystore de upload, Play App Signing, EAS | Nu există cont Play; APK-ul este de test | înainte de prima distribuție prin magazin |
| Revizuirea manifestului Android generat (trafic necriptat, componente exportate); `allowBackup` este deja `false` | Se face pe un build real | înainte de TestFlight/Play internal; verificat și cu `expo-doctor` |
| Build iOS și semnare | Cere macOS runner și cont Apple Developer | cont Apple disponibil |
| CodeQL, SBOM, atestări de proveniență (`actions/attest-build-provenance`), fixarea pe SHA a acțiunilor oficiale (`actions/*`, `pnpm/*`) | Cost/beneficiu mic pentru un depozit cu un singur contribuitor; acțiunile de la terți sunt deja fixate pe SHA | depozit public sau mai mulți contribuitori |
| Semnarea pachetelor într-un GitHub Environment cu aprobare obligatorie și cheie ținută în CI (`--key-env`); chei de producție separate de pipeline-ul de dezvoltare | Un singur proprietar; cheia de dezvoltare e doar pentru test | înainte de prima distribuție reală (vezi secțiunea 3) |
| Anti-rollback pentru pachete (verificarea `revision` față de starea stocată) | Pachetele sunt incluse în aplicație, nu descărcate | orice cale de descărcare/actualizare a pachetelor |
| Metadatele cataloagelor (titluri de secțiuni, ID-uri de paragrafe) sunt vizibile oricui pentru edițiile publicate, inclusiv cele `member` | Intenționat: cuprins public ca teaser; textul rămâne în schema `content` | revizuire când apar ediții cu cuprins confidențial |
| Corpul `get_chapter`/`get_paragraphs` trebuie să verifice singur `editions.access` și dreptul utilizatorului (rulează ca proprietar, ocolesc RLS); proprietar dedicat cu `BYPASSRLS` limitat la `content` în loc de `postgres` | Sunt stub-uri | migrarea care implementează funcțiile |
| Test de penetrare, checklist MASVS | Înainte de lansare, nu pe schelet | faza de beta |
| Consimțământ GDPR art. 9, ștergerea contului, registre, DPIA | Nu se colectează date în M0; ecranele se construiesc cu conturile | milestone-ul cu conturi |
| Telemetrie (Sentry/PostHog) cu curățare de date | Nu există telemetrie | după consimțământ |
| Certificate pinning, detecție root/jailbreak, ofuscare | Decizie: nu (cost de mentenanță mai mare decât câștigul) | revizuire la pen test |

## 6. Avizări de dependențe tolerate

`scripts/audit-allowlist.json` conține avizările pe care CI le tolerează temporar, fiecare cu motiv și dată de expirare. La data curentă sunt două (`minimatch` și `glob`, ambele dependențe de timp de build ale `@expo/cli`, remediate doar printr-un salt major pe care îl poate face doar Expo). După expirare (31 ianuarie 2027) CI pică din nou până la o nouă decizie. Avizările fără nicio remediere publicată apar ca avertismente sub nivelul high; la high și critical blochează la fel ca restul. Avizarea `compression` (high, prin `serve`) a fost rezolvată printr-un `pnpm.overrides` în `package.json` (`>=1.8.2`).

## 7. Raportarea vulnerabilităților

Până există o politică publică: se folosește „Report a vulnerability" din fila Security a depozitului (private vulnerability reporting) sau contact direct cu proprietarul. Nu se deschid issue-uri publice cu detalii exploatabile.
