# @biblioteca/content-tools

CLI that turns source texts into signed content packs (see `docs/m0-spec.md` section 4).

```bash
pnpm --filter @biblioteca/content-tools cli -- --help
pnpm --filter @biblioteca/content-tools cli ingest-text content/sources/<slug>/raw.txt
```

| Command       | Purpose                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `ingest-text` | raw `pdftotext` output -> cleaned canonical work JSON (`content/works/`)   |
| `build-pack`  | canonical JSON -> `pack.json` + `manifest.json` (sha256 + Ed25519 signed)  |
| `verify-pack` | verify a pack against its manifest and a public key                        |
| `keygen`      | generate an Ed25519 keypair; private key to `content/keys/` (gitignored)   |

Status: the four commands are stubs wired through `src/cli.ts`; each lives in `src/commands/`.
Shared schemas and helpers (`canonicalJson`, `stableId`, `manifestSigningPayload`) come from
`@biblioteca/shared`.
