import type { Section } from '@biblioteca/shared';

import { foldText } from '@/search/fold';

// The outline of an edition (docs/ui-spec-v2.md, 8.3): its sections in order, each with its depth and
// whether it has children, what a search of the headings leaves, and which branches are open.
// Pure: the panel only draws it.

export interface OutlineEntry {
  section: Section;
  /** 0 for a top-level section. */
  depth: number;
  /** The ids of the sections above it, the top one first. */
  ancestors: readonly string[];
  hasChildren: boolean;
}

/** The deepest level the outline indents: a cyclic or absurd `parentId` chain stops here. */
const MAX_DEPTH = 6;

export function buildOutline(sections: readonly Section[]): OutlineEntry[] {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const parents = new Set<string>();
  for (const section of sections) {
    if (section.parentId !== undefined && byId.has(section.parentId)) parents.add(section.parentId);
  }
  return sections.map((section) => {
    const ancestors: string[] = [];
    let parent = section.parentId === undefined ? undefined : byId.get(section.parentId);
    while (parent && ancestors.length < MAX_DEPTH && !ancestors.includes(parent.id)) {
      ancestors.unshift(parent.id);
      parent = parent.parentId === undefined ? undefined : byId.get(parent.parentId);
    }
    return { section, depth: ancestors.length, ancestors, hasChildren: parents.has(section.id) };
  });
}

/** True when the outline has branches: "Desfășoară tot" and "Pliază tot" appear only then. */
export const isHierarchical = (entries: readonly OutlineEntry[]): boolean =>
  entries.some((entry) => entry.hasChildren);

/** Every section that has children. */
export const branchIds = (entries: readonly OutlineEntry[]): string[] =>
  entries.filter((entry) => entry.hasChildren).map((entry) => entry.section.id);

/** A search of the headings: accents and case ignored; a blank search keeps everything. */
export function matchesHeading(heading: string, query: string): boolean {
  const needle = foldText(query.trim());
  return needle === '' || foldText(heading).includes(needle);
}

/**
 * What the panel lists. With a search: the entries whose heading has the words, flat, wherever they
 * are (a branch that is shut does not hide a match). Without: the entries whose every ancestor is
 * open.
 */
export function visibleOutline(
  entries: readonly OutlineEntry[],
  open: ReadonlySet<string>,
  query: string,
): OutlineEntry[] {
  if (query.trim() !== '')
    return entries.filter((entry) => matchesHeading(entry.section.heading, query));
  return entries.filter((entry) => entry.ancestors.every((id) => open.has(id)));
}

/** The open branches plus the ones above a section, so that it can be seen ("Arată curentul"). */
export function revealing(
  entries: readonly OutlineEntry[],
  open: ReadonlySet<string>,
  sectionId: string,
): Set<string> {
  const next = new Set(open);
  for (const id of entries.find((entry) => entry.section.id === sectionId)?.ancestors ?? []) {
    next.add(id);
  }
  return next;
}

/** Left padding of an entry: 8, 21.6 and 35.2 points, and 0.85 rem (13.6) for each level after. */
export function outlineIndent(depth: number): number {
  if (depth <= 0) return 8;
  if (depth === 1) return 21.6;
  if (depth === 2) return 35.2;
  return Math.round((35.2 + (depth - 2) * 13.6) * 10) / 10;
}
