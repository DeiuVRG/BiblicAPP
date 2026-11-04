import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(__dirname, '..');

/** Every source file of the app except the tests and the one file that defines the colours. */
function sourceFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => !file.split(sep).includes('__tests__'))
    .filter((file) => file !== join('theme', 'palettes.ts'))
    .map((file) => join(SRC, file));
}

describe('colours', () => {
  it('are written down only in theme/palettes.ts', () => {
    const colour = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/;
    const offences: string[] = [];
    for (const file of sourceFiles()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (colour.test(line))
            offences.push(`${relative(SRC, file)}:${index + 1}: ${line.trim()}`);
        });
    }
    // Components read colours from useTheme(); a hard-coded one would ignore dark mode and sepia.
    expect(offences).toEqual([]);
  });

  it('scans the sources it is meant to (guard against an empty file list)', () => {
    const files = sourceFiles().map((file) => relative(SRC, file));
    expect(files).toContain(join('components', 'button.tsx'));
    expect(files).toContain(join('features', 'reader', 'reader-screen.tsx'));
    expect(files).not.toContain(join('theme', 'palettes.ts'));
  });
});
