import type { Section } from '@biblioteca/shared';

export interface SectionNeighbours {
  index: number;
  total: number;
  previous: Section | null;
  next: Section | null;
}

/** Position of a section in document order plus its neighbours. `sections` must be ordered. */
export function sectionNeighbours(sections: readonly Section[], sectionId: string): SectionNeighbours | null {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return null;
  return {
    index,
    total: sections.length,
    previous: sections[index - 1] ?? null,
    next: sections[index + 1] ?? null,
  };
}

/** Nesting depth of each section, following `parentId` links (capped to stay safe on bad data). */
export function sectionDepths(sections: readonly Section[]): Map<string, number> {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const depths = new Map<string, number>();
  for (const section of sections) {
    let depth = 0;
    let parent = section.parentId ? byId.get(section.parentId) : undefined;
    while (parent && depth < 4) {
      depth += 1;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    depths.set(section.id, depth);
  }
  return depths;
}

/** Whole-number percentage (0..100) of a 0..1 fraction. */
export function toPercent(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
}

/** Scroll fraction (0..1) from raw scroll metrics. A chapter that fits the screen counts as read. */
export function scrollFraction(offsetY: number, contentHeight: number, viewportHeight: number): number {
  const scrollable = contentHeight - viewportHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, offsetY / scrollable));
}
