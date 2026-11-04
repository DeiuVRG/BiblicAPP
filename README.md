# Biblioteca creștină

Aplicație de bibliotecă creștină (cărți vechi traduse în română + Biblie + asistent AI), livrată pentru iOS, Android și web dintr-un singur cod (Expo). Arhitectura: `docs/arhitectura-app-biblica.md`. Reguli de lucru: `CLAUDE.md`. Specificația M0: `docs/m0-spec.md`. Decizii: `docs/decizii.md`.

## Structură

| Cale                     | Conținut                                                       |
| ------------------------ | -------------------------------------------------------------- |
| `apps/mobile`            | aplicația Expo (iOS, Android, web), Expo Router, `src/app`     |
| `packages/shared`        | scheme Zod (`PackManifest`, `Pack`), `stableId`, `canonicalJson` |
| `packages/content-tools` | CLI: `ingest-text`, `build-pack`, `verify-pack`, `keygen`      |
| `content/`               | surse și lucrări canonice (cheile private în `content/keys/`, ignorat de git) |
| `.github/workflows`      | CI, Pages, APK                                                 |

## Rulare locală

Cerințe: Node 22, pnpm 10.

```bash
scripts/pnpm-install.sh          # sau: pnpm install
pnpm --filter mobile web         # dezvoltare în browser
pnpm --filter mobile android     # necesită un build de dezvoltare (fără Expo Go)
pnpm --filter mobile export:web  # export static în apps/mobile/dist
```

Pentru GitHub Pages, exportul folosește baza `/BiblicAPP`:

```bash
EXPO_PUBLIC_WEB_BASE_URL=/BiblicAPP pnpm --filter mobile export:web
```

## Verificare

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm --filter mobile export:web
pnpm format:check   # pnpm format pentru a formata
```
