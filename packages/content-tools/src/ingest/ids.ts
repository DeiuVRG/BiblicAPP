import type { Paragraph, Section } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared';

import { dice } from './text';

export interface DraftSection {
  ordinal: number;
  kind: Section['kind'];
  heading: string;
  paragraphs: { kind: Paragraph['kind']; text: string }[];
}

export interface IdSource {
  sections: readonly Section[];
  paragraphs: readonly Paragraph[];
}

const FUZZY_THRESHOLD = 0.55;

function key(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Longest common subsequence of equal keys; returns matched index pairs (old, new). */
export function lcsPairs(
  oldKeys: readonly string[],
  newKeys: readonly string[],
): [number, number][] {
  const rows = oldKeys.length;
  const cols = newKeys.length;
  const table: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i]![j] =
        oldKeys[i] === newKeys[j]
          ? (table[i + 1]![j + 1] as number) + 1
          : Math.max(table[i + 1]![j] as number, table[i]![j + 1] as number);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (oldKeys[i] === newKeys[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if ((table[i + 1]![j] as number) >= (table[i]![j + 1] as number)) i += 1;
    else j += 1;
  }
  return pairs;
}

/**
 * Assigns stable ids to a freshly ingested draft, reusing the ids of `previous` wherever the
 * same section/paragraph is recognised. Unchanged text always keeps its id; lightly edited
 * text (similar enough, in the same position between unchanged neighbours) keeps it too.
 * New material gets new ids; ids of removed material are never reused.
 */
export function assignIds(
  draft: readonly DraftSection[],
  previous?: IdSource,
): { sections: Section[]; paragraphs: Paragraph[]; reused: number; created: number } {
  const oldSections = previous?.sections ?? [];
  const oldBySection = new Map<string, Paragraph[]>();
  for (const paragraph of previous?.paragraphs ?? []) {
    const list = oldBySection.get(paragraph.sectionId) ?? [];
    list.push(paragraph);
    oldBySection.set(paragraph.sectionId, list);
  }

  const usedSections = new Set<string>();
  const sections: Section[] = [];
  const paragraphs: Paragraph[] = [];
  let reused = 0;
  let created = 0;

  for (const draftSection of draft) {
    // Section matching: same heading first, then same ordinal and kind.
    const byHeading = oldSections.find(
      (s) => !usedSections.has(s.id) && key(s.heading) === key(draftSection.heading),
    );
    const byOrdinal = oldSections.find(
      (s) =>
        !usedSections.has(s.id) &&
        s.ordinal === draftSection.ordinal &&
        s.kind === draftSection.kind,
    );
    const matched = byHeading ?? byOrdinal;
    let sectionId: string;
    if (matched) {
      usedSections.add(matched.id);
      sectionId = matched.id;
      reused += 1;
    } else {
      sectionId = stableId();
      created += 1;
    }
    sections.push({
      id: sectionId,
      ordinal: draftSection.ordinal,
      kind: draftSection.kind,
      heading: draftSection.heading,
    });

    const oldParagraphs = (matched ? oldBySection.get(matched.id) : undefined) ?? [];
    const oldKeys = oldParagraphs.map((p) => key(p.text));
    const newKeys = draftSection.paragraphs.map((p) => key(p.text));
    const assigned = new Array<string | undefined>(newKeys.length).fill(undefined);
    const taken = new Set<number>();
    for (const [oi, ni] of lcsPairs(oldKeys, newKeys)) {
      assigned[ni] = (oldParagraphs[oi] as Paragraph).id;
      taken.add(oi);
    }
    // Between unchanged anchors, pair remaining paragraphs in order when they are similar.
    let oldCursor = 0;
    for (let ni = 0; ni < newKeys.length; ni += 1) {
      if (assigned[ni] !== undefined) {
        const matchedOld = oldParagraphs.findIndex((p) => p.id === assigned[ni]);
        oldCursor = matchedOld + 1;
        continue;
      }
      let nextAnchor = oldParagraphs.length;
      for (let k = ni + 1; k < newKeys.length; k += 1) {
        if (assigned[k] !== undefined) {
          nextAnchor = oldParagraphs.findIndex((p) => p.id === assigned[k]);
          break;
        }
      }
      for (let oi = oldCursor; oi < nextAnchor; oi += 1) {
        if (taken.has(oi)) continue;
        if (dice(oldKeys[oi] as string, newKeys[ni] as string) >= FUZZY_THRESHOLD) {
          assigned[ni] = (oldParagraphs[oi] as Paragraph).id;
          taken.add(oi);
          oldCursor = oi + 1;
          break;
        }
      }
    }

    draftSection.paragraphs.forEach((draftParagraph, ordinal) => {
      let id = assigned[ordinal];
      if (id === undefined) {
        id = stableId();
        created += 1;
      } else {
        reused += 1;
      }
      paragraphs.push({
        id,
        sectionId,
        ordinal,
        kind: draftParagraph.kind,
        text: draftParagraph.text,
      });
    });
  }
  return { sections, paragraphs, reused, created };
}
