// What the reader remembers about a work between the screens of its sections (docs/ui-spec-v2.md,
// 8.3 and 8.11): a section is a screen of its own, so the search of the outline, the branches that are
// open and the find bar would be lost at every "next chapter". It lives for the session only (in
// memory), per work. Nothing here is a setting and nothing is stored.

export interface FindOrigin {
  editionId: string;
  sectionId: string;
  /** The paragraph in view when the find bar was opened: where Escape puts the reader back. */
  paragraphId: string | null;
}

export interface WorkSession {
  outlineQuery: string;
  /** The ids of the branches of the outline that are open; null until the reader changed them. */
  openBranches: readonly string[] | null;
  /** Whether the outline panel is shown; null until the reader toggled it (then the window decides). */
  outlineOpen: boolean | null;
  /** The words of the find bar; the bar is open while this is not null. */
  findQuery: string | null;
  findOrigin: FindOrigin | null;
}

const EMPTY: WorkSession = {
  outlineQuery: '',
  openBranches: null,
  outlineOpen: null,
  findQuery: null,
  findOrigin: null,
};

const sessions = new Map<string, WorkSession>();

export function getWorkSession(workId: string): WorkSession {
  return sessions.get(workId) ?? EMPTY;
}

export function patchWorkSession(workId: string, patch: Partial<WorkSession>): WorkSession {
  const next = { ...getWorkSession(workId), ...patch };
  sessions.set(workId, next);
  return next;
}

/** Forgets everything (tests; and the end of a session). */
export function resetReaderSessions(): void {
  sessions.clear();
}
