/** One entry of what the list reports as being in view (the shape FlatList hands to its callback). */
export interface ViewToken {
  item: unknown;
  index?: number | null;
}

interface WithId {
  id: string;
}

/**
 * The paragraph of the edition being read that is highest in view, or null when nothing readable
 * is. A plain list item holds one paragraph; a lane row holds one per side, and the side of the
 * driving edition (the one the route belongs to) is the one that counts.
 */
export function paragraphInView(
  tokens: readonly ViewToken[],
  driverIsFirst: boolean,
): string | null {
  const ordered = tokens
    .filter((token) => token.index != null)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const token of ordered) {
    const item = token.item as
      | { kind?: string; paragraph?: WithId; row?: { first: WithId | null; second: WithId | null } }
      | undefined;
    if (item?.kind === 'paragraph' && item.paragraph) return item.paragraph.id;
    if (item?.kind === 'row' && item.row) {
      const paragraph = driverIsFirst ? item.row.first : item.row.second;
      if (paragraph) return paragraph.id;
    }
  }
  return null;
}
