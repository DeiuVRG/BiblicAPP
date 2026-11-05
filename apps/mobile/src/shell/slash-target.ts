// The shortcut `/` (docs/ui-spec-v2.md, 4.1, 6.5 and 10): the brand bar opens the search from
// anywhere on web, but a screen that has a search field of its own (the library, Search) takes the
// key for it and focuses that field instead. A screen registers its field while it is in focus;
// the brand bar asks here before it navigates.

export interface SlashTarget {
  focus(): void;
}

let current: SlashTarget | null = null;

/** The field that `/` focuses, or null when the key should open the search page. */
export function getSlashTarget(): SlashTarget | null {
  return current;
}

/** Registers the field of the screen in focus (null when it loses the focus or unmounts). */
export function setSlashTarget(target: SlashTarget | null): void {
  current = target;
}
