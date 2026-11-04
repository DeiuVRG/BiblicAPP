import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ENV_NAMES } from './config';
import { isExcluded, parseDockerignore } from './dockerignore';
import { API_DIR, REPO_ROOT } from './paths';

const read = (path: string): string => readFileSync(join(REPO_ROOT, path), 'utf8');

function walkFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkFiles(path, found);
    else found.push(path);
  }
  return found;
}

describe('the Docker build context', () => {
  const patterns = parseDockerignore(read('apps/api/.dockerignore'));
  const sent = (file: string): boolean => !isExcluded(patterns, file);

  it('keeps the two ignore files identical (Docker reads one, flyctl the other)', () => {
    expect(read('apps/api/Dockerfile.dockerignore')).toBe(read('apps/api/.dockerignore'));
  });

  it('sends what the image build needs', () => {
    for (const file of [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      '.npmrc',
      'tsconfig.base.json',
      'apps/api/package.json',
      'apps/api/Dockerfile',
      'apps/api/src/server.ts',
      'apps/api/scripts/build.mjs',
      'apps/mobile/package.json',
      'apps/mobile/assets/packs/vos-1903-kingdom-en/pack.json',
      'apps/mobile/assets/packs/vos-1903-kingdom-en/manifest.json',
      'packages/shared/src/schemas.ts',
      'packages/shared/package.json',
      'packages/content-tools/src/signing.ts',
      'packages/content-tools/package.json',
      'content/keys/dev.pub',
      'content/keys/next-placeholder.pub',
    ]) {
      expect(sent(file), file).toBe(true);
    }
  });

  it('never sends secrets, dependencies or the rest of the monorepo', () => {
    for (const file of [
      'content/keys/dev.key',
      'content/keys/anything.key',
      'content/ask/eval-v0.json',
      'content/ask/suggestions.en.json',
      'apps/api/.env',
      'apps/api/.env.local',
      '.env',
      '.git/config',
      'node_modules/hono/package.json',
      'apps/api/node_modules/hono/package.json',
      'apps/api/dist/server.js',
      'packages/shared/node_modules/zod/package.json',
      'apps/mobile/src/app/index.tsx',
      'apps/mobile/node_modules/expo/package.json',
      'content/works/vos-1903-kingdom/edition-en.json',
      'supabase/migrations/0001_init.sql',
      'docs/arhitectura-app-biblica.md',
      'scripts/pnpm-install.sh',
      '.github/workflows/ci.yml',
    ]) {
      expect(sent(file), file).toBe(false);
    }
  });

  it('matches Docker on the rules it relies on', () => {
    const rules = parseDockerignore('*\n!keep\n!a/b\n**/skip\n');
    expect(isExcluded(rules, 'other')).toBe(true);
    expect(isExcluded(rules, 'keep')).toBe(false);
    expect(isExcluded(rules, 'a/b/c/d.txt')).toBe(false); // a re-included folder brings its files
    expect(isExcluded(rules, 'a/x.txt')).toBe(true);
    expect(isExcluded(rules, 'a/b/skip/f.txt')).toBe(true); // a later rule excludes again
    expect(isExcluded(rules, 'a/b/c/skip')).toBe(true);
  });
});

describe('the Dockerfile', () => {
  const dockerfile = read('apps/api/Dockerfile');

  it('is a multi-stage build on node:22-alpine that runs as an unprivileged user', () => {
    expect(dockerfile.match(/^FROM node:22-alpine AS /gm)).toHaveLength(2);
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(dockerfile).toMatch(/^EXPOSE 8787$/m);
    expect(dockerfile).toMatch(/^CMD \["node", "dist\/server\.js"\]$/m);
    expect(dockerfile).toContain('pnpm install --frozen-lockfile');
    expect(dockerfile).toContain('HEALTHCHECK');
  });

  it('copies the build output, the packs and the public keys only', () => {
    expect(dockerfile).toContain('COPY --from=build /repo/apps/api/dist ./dist');
    expect(dockerfile).toContain('apps/mobile/assets/packs ./packs');
    expect(dockerfile).toMatch(/content\/keys\/\*\.pub \.\/keys\//);
    expect(dockerfile).not.toMatch(/\.key\b/);
  });

  // The instructions only: the comments explain what is left out and may name it.
  const instructions = dockerfile
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

  it('does not bake a trusted-proxy mode into the image (only fly.toml sets it)', () => {
    // With TRUST_PROXY=fly in the image, a plain `docker run` or any host that is not Fly's proxy
    // would believe a forged Fly-Client-IP header and the per-address limit could be dodged.
    expect(instructions).not.toMatch(/TRUST_PROXY/);
    expect(read('apps/api/fly.toml')).toMatch(/^\s*TRUST_PROXY = "fly"$/m);
  });

  it('leaves the code, the packs and the pinned keys owned by root, readable for the service', () => {
    // A process that is compromised must not be able to rewrite dist/server.js or add a key.
    expect(instructions).not.toMatch(/--chown/);
    expect(instructions).toMatch(/^USER node$/m);
  });

  it('ships only files that the service user can read (COPY keeps the modes of the checkout)', () => {
    // The image is root-owned, so what the "node" user can read is decided by the "other" bits. A
    // checkout made under a umask of 077 has 0600 files: the packs would not load, the health check
    // would fail and the deploy would roll back.
    const shipped = [
      ...walkFiles(join(REPO_ROOT, 'apps/mobile/assets/packs')),
      ...readdirSync(join(REPO_ROOT, 'content/keys'))
        .filter((name) => name.endsWith('.pub'))
        .map((name) => join(REPO_ROOT, 'content/keys', name)),
    ];
    expect(shipped.length).toBeGreaterThanOrEqual(4);
    for (const file of shipped) {
      expect(
        statSync(file).mode & 0o004,
        `${relative(REPO_ROOT, file)} is not world-readable`,
      ).not.toBe(0);
    }
  });

  it('does not enable source maps at run time (they cost 30 to 40 MB of a 256 MB machine)', () => {
    expect(instructions).not.toMatch(/enable-source-maps/);
    expect(instructions).not.toMatch(/NODE_OPTIONS/);
  });

  it('points the service at the copied folders and holds no secret', () => {
    expect(dockerfile).toContain('PACKS_DIR=/app/packs');
    expect(dockerfile).toContain('KEYS_DIR=/app/keys');
    expect(dockerfile).not.toMatch(/^\s*(ENV\s+)?ANTHROPIC_API_KEY\s*=/m);
  });
});

describe('fly.toml', () => {
  const toml = read('apps/api/fly.toml');

  it('describes the app the task asks for', () => {
    expect(toml).toMatch(/^app = "biblioteca-api"$/m);
    expect(toml).toMatch(/^primary_region = "fra"$/m);
    expect(toml).toMatch(/internal_port = 8787/);
    expect(toml).toMatch(/memory = "256mb"/);
    expect(toml).toMatch(/auto_stop_machines = "stop"/);
    expect(toml).toMatch(/auto_start_machines = true/);
    expect(toml).toMatch(/path = "\/v1\/health"/);
    expect(toml).toMatch(/dockerfile = "Dockerfile"/);
    expect(toml).toMatch(/ignorefile = "\.dockerignore"/);
  });

  it('does not contain the model key', () => {
    expect(toml).not.toMatch(/^\s*ANTHROPIC_API_KEY\s*=/m); // the comment may show the flyctl command
    expect(toml).toMatch(/TRUST_PROXY = "fly"/);
  });
});

describe('the deploy workflow', () => {
  const workflow = read('.github/workflows/api-deploy.yml');

  it('pins the Fly action to a full commit SHA with a version comment', () => {
    expect(workflow).toMatch(
      /uses: superfly\/flyctl-actions\/setup-flyctl@[0-9a-f]{40} # \d+\.\d+/,
    );
    expect(workflow).toMatch(/FLYCTL_VERSION: \d+\.\d+\.\d+/);
  });

  it('has least-privilege permissions and safe checkouts', () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(workflow).not.toMatch(/pull_request_target/);
    expect(workflow).not.toMatch(/contents: write|id-token: write|packages: write/);
    const checkouts = workflow.match(/uses: actions\/checkout@v4/g) ?? [];
    expect(checkouts.length).toBeGreaterThanOrEqual(2);
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(checkouts.length);
  });

  it('deploys only from main, only on a push or a manual run, and only when the secret exists', () => {
    expect(workflow).toMatch(/branches: \[main\]/);
    expect(workflow).toContain("if: github.event_name != 'pull_request'");
    expect(workflow).toContain(
      "if: needs.gate.outputs.deploy == 'true' && github.ref == 'refs/heads/main'",
    );
    // The secret only ever reaches the steps that need it, through env, never an expression in a script.
    for (const use of workflow.match(/.*secrets\.FLY_API_TOKEN.*/g) ?? []) {
      expect(use).toMatch(/^ {10,}FLY_API_TOKEN: \$\{\{ secrets\.FLY_API_TOKEN \}\}$/);
    }
    expect(workflow).toContain('apps/api/**');
    expect(workflow).toContain('apps/mobile/assets/packs/**');
  });
});

describe('package.json', () => {
  const manifest = JSON.parse(read('apps/api/package.json')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  it('pins every dependency to an exact version (workspace links aside), dev tools included', () => {
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    expect(Object.keys(all).length).toBeGreaterThan(10);
    for (const [name, version] of Object.entries(all)) {
      expect(version, name).toMatch(/^(workspace:\*|\d+\.\d+\.\d+)$/);
    }
  });

  it('keeps the lockfile in step with those pins', () => {
    const lock = read('pnpm-lock.yaml');
    const importer = lock.slice(
      lock.indexOf('\n  apps/api:\n'),
      lock.indexOf('\n  apps/mobile:\n'),
    );
    for (const [name, version] of Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })) {
      const quoted = name.startsWith('@') ? `'${name}'` : name;
      expect(importer, name).toContain(`      ${quoted}:\n        specifier: ${version}\n`);
    }
  });
});

describe('secrets and documentation', () => {
  it('keeps key-shaped strings out of the package', () => {
    const files = [
      ...walkFiles(API_DIR),
      join(REPO_ROOT, '.github/workflows/api-deploy.yml'),
      join(REPO_ROOT, 'docs/ask-api.md'),
    ].filter(existsSync);
    expect(files.length).toBeGreaterThan(20);
    const shapes = [
      /sk-ant-[A-Za-z0-9_-]{8,}/,
      /\bFlyV1 [A-Za-z0-9+/=_-]{20,}/,
      /fo1_[A-Za-z0-9_-]{20,}/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /ghp_[A-Za-z0-9]{20,}/,
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const shape of shapes) expect(text, relative(REPO_ROOT, file)).not.toMatch(shape);
    }
  });

  it('documents every variable the service reads, in .env.example and in docs/ask-api.md', () => {
    const example = read('apps/api/.env.example');
    const docs = read('docs/ask-api.md');
    expect(ENV_NAMES).toContain('ANTHROPIC_API_KEY');
    for (const name of ENV_NAMES) {
      expect(example, `.env.example: ${name}`).toMatch(new RegExp(`^#? ?${name}=`, 'm'));
      expect(docs, `docs/ask-api.md: ${name}`).toContain(name);
    }
  });

  it('leaves the API key empty in .env.example', () => {
    expect(read('apps/api/.env.example')).toMatch(/^# ANTHROPIC_API_KEY=$/m);
  });

  it('keeps the tester access code a secret: not in .env.example, fly.toml or the image', () => {
    expect(ENV_NAMES).toContain('ACCESS_CODE');
    expect(read('apps/api/.env.example')).toMatch(/^# ACCESS_CODE=$/m);
    expect(read('apps/api/fly.toml')).not.toMatch(/^\s*ACCESS_CODE\s*=/m);
    expect(read('apps/api/Dockerfile')).not.toMatch(/^\s*(ENV\s+)?ACCESS_CODE\s*=/m);
    expect(read('.github/workflows/api-deploy.yml')).not.toMatch(/ACCESS_CODE\s*[:=]\s*\S/);
  });
});
