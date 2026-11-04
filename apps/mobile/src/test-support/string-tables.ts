type Tree = { [key: string]: unknown };

/** Sample arguments for the functions of a string table: numbers, then a title. */
const SAMPLES: readonly unknown[][] = [
  [1, 1, 1],
  [2, 11, 100],
  [20, 20, 20],
  ['Titlu', 'Titlu', 'Titlu'],
];

/** One string of a table (or the string a function of it gives for some arguments), with its path. */
export interface TableText {
  path: string;
  text: string;
}

/**
 * Every string a table can produce, with the path of its key: strings as they are, functions
 * called with sample numbers and with a title (a function that takes one kind is not called with
 * the other; what throws is skipped).
 */
export function tableTexts(tree: object, prefix = ''): TableText[] {
  return Object.entries(tree as Tree).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    if (typeof value === 'string') return [{ path, text: value }];
    if (typeof value === 'function') {
      const call = value as (...args: unknown[]) => unknown;
      const results: TableText[] = [];
      for (const args of SAMPLES) {
        try {
          const result = call(...args);
          if (typeof result === 'string') results.push({ path, text: result });
        } catch {
          // A function that takes numbers is not called with a title, and the other way round.
        }
      }
      return results;
    }
    return tableTexts(value as object, `${path}.`);
  });
}

/** The value at a dotted path of a table. */
export function tableValue(tree: object, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], tree);
}

/** What the value at a path says: a string, or what a function gives for each sample. */
export function tableOutputs(tree: object, path: string): string[] {
  return tableTexts({ [path]: tableValue(tree, path) }).map((entry) => entry.text);
}
