export type Language = 'ro' | 'en';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** The same passage in another installed edition (original or translation). */
export interface AlignedVersion {
  editionId: string;
  sectionId: string;
  paragraphId: string;
  language: string;
  kind: 'source' | 'translation';
  sectionHeading: string;
  excerpt: string;
}

/** A retrieved passage, numbered by its position in the `sources` array (the `[n]` of the answer). */
export interface Source {
  /** Stable id of the passage, the same for every language version (the source paragraph id). */
  id: string;
  workId: string;
  /** Edition of the version shown: the asked language when installed, else the original. */
  editionId: string;
  sectionId: string;
  paragraphId: string;
  workTitle: string;
  sectionHeading: string;
  language: string;
  excerpt: string;
  /** Whether the version shown is the original text or a translation. */
  kind: 'source' | 'translation';
  author: string;
  tradition: string;
  score: number;
  /** References named in the question that this passage cites (canonical, e.g. "Matt 4:17"). */
  matchedRefs: string[];
  /** The same passage in the other installed editions (the original first). */
  aligned: AlignedVersion[];
}

export interface Citation {
  /** 1-based index into `sources`, as written in the answer. */
  sourceIndex: number;
  /** The sentence or clause of the answer that carries the marker (markers removed). */
  text: string;
  /** Position of the marker in the final answer text (UTF-16 offset). */
  offset: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export const EMPTY_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
};
