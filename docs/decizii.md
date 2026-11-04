# Decizii de arhitectură (ADR)

Format: decizie, context, consecințe. Orice abatere de la `docs/arhitectura-app-biblica.md` se notează aici cu motiv.

## ADR-001 – Pachete de conținut JSON în M0, SQLite în M1

- Decizie: în M0 conținutul se livrează ca pachete semnate (`pack.json` + `manifest.json`) încărcate în memorie printr-o interfață `ContentRepository`. În M1 aceeași interfață primește o implementare SQLite.
- Motiv: JSON-ul se verifică ușor (sha256 + Ed25519), merge identic pe iOS, Android și web, și nu cere un modul nativ în plus. Interfața izolează UI-ul de stocare.
- Consecințe: căutarea din M0 este un scan liniar în memorie (suficient pentru câteva cărți); nu scalează la biblioteca întreagă, de aceea M1.

## ADR-002 – Web pe GitHub Pages sub subcale (`/BiblicAPP`)

- Decizie: exportul web (`expo export -p web`, output `static`) se publică pe GitHub Pages ca „project site", deci sub `/BiblicAPP`. Baza se setează la export prin `EXPO_PUBLIC_WEB_BASE_URL` (sau `WEB_BASE_URL`), citită în `app.config.ts` ca `experiments.baseUrl`. Local și pe un domeniu propriu rămâne nesetată.
- Consecințe: rutele dinamice (`/work/[id]`, `/read/[id]/[section]`) sunt exportate ca un singur fișier HTML fiecare, iar GitHub Pages nu are rewrite; deep-link-urile către id-uri concrete necesită un `404.html` care încarcă aplicația (SPA fallback) sau `generateStaticParams`. Se rezolvă în fluxul de deploy. Pages trebuie activat cu sursa „GitHub Actions".

## ADR-003 – APK de test semnat cu cheia de debug

- Decizie: APK-ul produs în CI (`assembleRelease`) folosește semnarea de debug din șablonul generat de `expo prebuild`. Este un artefact de test, nu pentru Play Store.
- Motiv: nu există încă cheie de upload sau cont Play; nu se pun secrete în repo.
- Consecințe: APK-ul nu poate fi publicat în magazine; înainte de distribuție reală se introduce un keystore în GitHub Secrets (sau EAS) și se schimbă pasul de semnare.

## ADR-004 – Fără Expo Go; build-uri de dezvoltare / CNG

- Decizie: Expo Go nu este folosit. Aplicația rulează ca build de dezvoltare sau ca APK, iar directoarele `ios/` și `android/` nu se comit (Continuous Native Generation, `expo prebuild` în CI).
- Motiv: Expo Go limitează modulele native și nu reflectă aplicația reală (fonturi, arhitectura nouă, aliniere la pagini de 16 KB).
- Consecințe: web (`pnpm --filter mobile web`) este calea rapidă de dezvoltare; pe telefon se folosește APK-ul din CI.

## ADR-005 – Rădăcina rutelor este `apps/mobile/src/app`

- Decizie: se păstrează structura șablonului Expo SDK 58 (`src/app`), nu `app/`. Rutele cerute există: `index`, `work/[id]`, `read/[id]/[section]`, `search`, `settings`.
- Motiv: șablonul și `@/*` → `src/*` sunt convenția curentă; cod ne-rută (components, content, i18n) rămâne în afara `src/app`.

## ADR-006 – `pack.json` este stocat în formă canonică

- Decizie: `pack.json` se scrie cu `canonicalJson()` (chei sortate, fără spații). `sha256` din manifest este hash-ul acestor octeți; aplicația îl recalculează din obiectul parsat (`canonicalJsonBytes(pack)`), deoarece Metro importă JSON-ul ca obiect, nu ca octeți.
- Semnătura: Ed25519 peste `manifestSigningPayload(manifest)` (JSON canonic al manifestului fără câmpul `signature`).
- Consecințe: `build-pack` trebuie să scrie fișierul exact în formă canonică; fișierele din `assets/packs` sunt excluse din Prettier.

## ADR-007 – Verificarea semnăturii este deocamdată stub

- Starea la scaffold: `verifyPack()` (`apps/mobile/src/content/verify-pack.ts`) validează schemele, identitatea, dimensiunea și sha256, dar NU verifică încă semnătura Ed25519 și `minAppVersion`; rezultatul are `signatureVerified: false`. Lista cheilor fixate (`trusted-keys.ts`) este goală.
- Pachetul `placeholder` are semnătură de zerouri și `signingKeyId: "placeholder-unsigned"`. Se înlocuiește când `build-pack` și cheia de dezvoltare sunt gata. Până atunci NU este o garanție de securitate.

## ADR-008 – ID-uri stabile și schema `Pack`

- `stableId()` produce ULID (26 caractere). Schema acceptă orice id URL-safe `[A-Za-z0-9_-]{1,64}`, ca să nu blocheze ID-uri de alt tip; instrumentele generează însă ULID, o singură dată, la ingest.
- `PackManifest.version` este semver al pachetului; `revision` este întreg ≥ 1 (revizia textului). `born`, `died`, `year` sunt `number | null` (an întreg, negativ pentru î.Hr.).
- `PackSchema` verifică și integritatea referințelor (id-uri unice, `sectionId` și `parentId` existente).

## ADR-009 – Versiuni de instrumente

- TypeScript `~6.0.3` (cel din Expo SDK 58; `typescript-eslint` 8.x acceptă `<6.1`). În TS 6, `types` implicit este gol: fiecare tsconfig declară explicit `types` (`node`, `jest`).
- ESLint 9 (flat config) cu `eslint-config-expo` 58; ESLint 10 nu este încă acceptat de toate pluginurile din preset.
- `@react-native-async-storage/async-storage` fixat la `2.2.0` (versiunea din `bundledNativeModules.json` al SDK 58), nu la 3.x.
- `experiments.reactCompiler` din șablon a fost scos (nu e necesar în M0, reduce riscul de build). Se poate reactiva ulterior.
- `newArchEnabled: true` este setat explicit în `app.config.ts`, dar nu mai există în tipul `ExpoConfig` din SDK 58 (arhitectura nouă este singura); se folosește un cast.
- Rutele tipizate (`typedRoutes`) sunt activate, dar fișierul `.expo/types` se generează doar la `expo start`, nu la `typecheck`/`export`; `tsc` în CI nu verifică deci `href`-urile.
- `react-native-reanimated`, `-worklets`, `-gesture-handler`, `expo-image`, `expo-symbols` și altele din șablon au fost scoase (nefolosite); se adaugă la nevoie, după verificarea compatibilității cu arhitectura nouă și cu paginile de 16 KB.
- Testele de componente: `@testing-library/react-native` 14 cere pachetul `test-renderer` (nu `react-test-renderer`).

## ADR-UI – Decizii de interfață (cititor, căutare, setări)

- Structură: `src/features/<ecran>` conține ecranele (testabile fără router), `src/app/*` sunt doar rute subțiri; `src/settings`, `src/reading`, `src/search`, `src/storage`, `src/theme` conțin logica fără UI. Persistența trece prin interfața `KeyValueStore` (AsyncStorage implicit, înlocuibil în teste).
- Ordinea secțiunilor: `ordinal` al secțiunilor este tratat ca ordine globală în document (navigarea anterior/următor merge pe lista plată ordonată). `parentId` este folosit doar pentru indentarea cuprinsului. O secțiune fără paragrafe (de exemplu un titlu de parte) se afișează cu titlul și butoanele de navigare, nu este sărită.
- Poziția de lectură: una singură pe lucrare (`biblioteca:position:v1:<workId>` = secțiune + primul paragraf vizibil), salvată cu debounce de 500 ms și la ieșire; restaurarea face `scrollToIndex`, iar un capitol cu poziție salvată randează din start paragrafele până la țintă (max. 400) ca poziția să poată fi măsurată. Căutarea trece `p` (paragraf) și `q` (interogare) prin parametrii rutei și are prioritate față de poziția salvată.
- Temă: `Automat` (sistem), `Luminos`, `Sepia`, `Întunecat`; „Automat" este adăugat peste cele trei cerute. Mărime text 14–26 pt, spațiere rânduri 1,3–2,0, ambele cu butoane − / + (fără dependență de slider).
- Fonturi: Literata (lectură) și Inter (interfață) din `@expo-google-fonts/*`, importate pe variante individuale (nu din index) ca bundle-ul să conțină doar 6 fișiere. Pe nativ, splash-ul rămâne până se încarcă fonturile și setările; pe web nu se blochează randarea statică, cu fallback Georgia/system-ui. `fontWeight` nu se combină cu fonturile personalizate (Android alege fișierul după nume).
- Scalarea fonturilor de sistem este respectată; plafon `maxFontSizeMultiplier` 1,6 pentru text de lectură și 1,5 pentru interfață.
- Căutarea: normalizare care păstrează lungimea (`foldText`), ca pozițiile potrivirilor să se mapeze direct pe textul original; accentele (inclusiv ș/ş, ț/ţ) și majusculele sunt ignorate.
- `Link asChild`: stilul copilului trebuie să fie obiect plat (Slot-ul din expo-router îl „împrăștie"; array sau funcție produce erori sau stil pierdut pe web).
- Jest: `jest.setup.js` mock-uiește AsyncStorage pentru toate testele; `src/test-support/` conține mock-ul `expo-router` și helperul de randare cu provideri.
