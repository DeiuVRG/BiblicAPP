// A small implementation of the .dockerignore matching rules of Docker (moby/patternmatcher), so
// that a test can say which files a build context would contain without running Docker.

interface Pattern {
  regex: RegExp;
  exclusion: boolean;
}

function compile(raw: string): Pattern | null {
  let text = raw.trim();
  if (text === '' || text.startsWith('#')) return null;
  const exclusion = text.startsWith('!');
  if (exclusion) text = text.slice(1).trim();
  text = text.replace(/^\/+/, '').replace(/\/+$/, '');
  if (text === '') return null;
  let source = '^';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (ch === '*') {
      if (text[i + 1] === '*') {
        i += 1;
        if (text[i + 1] === '/') i += 1; // "**/" counts as "**"
        source += i + 1 === text.length ? '.*' : '(.*/)?';
      } else {
        source += '[^/]*';
      }
    } else if (ch === '?') {
      source += '[^/]';
    } else if ('.+()|{}$^'.includes(ch)) {
      source += `\\${ch}`;
    } else {
      source += ch;
    }
  }
  return { regex: new RegExp(`${source}$`), exclusion };
}

export function parseDockerignore(content: string): Pattern[] {
  return content
    .split(/\r?\n/)
    .map(compile)
    .filter((pattern): pattern is Pattern => pattern !== null);
}

/** True when the file is left out of the build context (the rules are applied in order). */
export function isExcluded(patterns: readonly Pattern[], file: string): boolean {
  const parents = file.split('/').slice(0, -1);
  let excluded = false;
  for (const pattern of patterns) {
    if (pattern.exclusion !== excluded) continue;
    let match = pattern.regex.test(file);
    if (!match) {
      for (let i = 0; i < parents.length && !match; i += 1) {
        match = pattern.regex.test(parents.slice(0, i + 1).join('/'));
      }
    }
    if (match) excluded = !pattern.exclusion;
  }
  return excluded;
}
