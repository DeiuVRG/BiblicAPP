// A small in-memory BM25 index (Okapi BM25, Lucene-style idf). Documents are arrays of terms;
// the caller decides what a term is (see `text/analyzer.ts`).

export interface Bm25Params {
  k1: number;
  b: number;
}

export interface Bm25Hit {
  score: number;
  /** Sum of the idf of the query terms found in the document (for coverage checks). */
  matchedIdf: number;
}

interface Postings {
  docs: Uint32Array;
  freqs: Uint32Array;
  idf: number;
}

export class Bm25Index {
  readonly size: number;
  private readonly lengths: Uint32Array;
  private readonly averageLength: number;
  private readonly postings = new Map<string, Postings>();

  constructor(
    documents: ReadonlyArray<readonly string[]>,
    private readonly params: Bm25Params = { k1: 1.2, b: 0.75 },
  ) {
    this.size = documents.length;
    this.lengths = new Uint32Array(documents.length);
    const building = new Map<string, { docs: number[]; freqs: number[] }>();
    let totalLength = 0;
    documents.forEach((terms, docIndex) => {
      this.lengths[docIndex] = terms.length;
      totalLength += terms.length;
      const counts = new Map<string, number>();
      for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
      for (const [term, count] of counts) {
        let entry = building.get(term);
        if (entry === undefined) {
          entry = { docs: [], freqs: [] };
          building.set(term, entry);
        }
        entry.docs.push(docIndex);
        entry.freqs.push(count);
      }
    });
    this.averageLength = documents.length === 0 ? 0 : totalLength / documents.length;
    for (const [term, entry] of building) {
      const df = entry.docs.length;
      this.postings.set(term, {
        docs: Uint32Array.from(entry.docs),
        freqs: Uint32Array.from(entry.freqs),
        idf: Math.log(1 + (this.size - df + 0.5) / (df + 0.5)),
      });
    }
  }

  /** Number of documents containing `term`. */
  documentFrequency(term: string): number {
    return this.postings.get(term)?.docs.length ?? 0;
  }

  /** idf of a term, or `null` when the term is not in the index. */
  idf(term: string): number | null {
    return this.postings.get(term)?.idf ?? null;
  }

  /**
   * Scores every document that contains at least one of the query terms. The terms are given as
   * a list (each distinct term counts once, with weight 1) or as a map from term to weight (a
   * synonym that should count for less than the word the person wrote). `accept` lets the caller
   * skip documents (edition filters) before they are scored.
   */
  search(
    queryTerms: Iterable<string> | ReadonlyMap<string, number>,
    accept?: (docIndex: number) => boolean,
  ): Map<number, Bm25Hit> {
    const hits = new Map<number, Bm25Hit>();
    if (this.size === 0) return hits;
    const { k1, b } = this.params;
    const weights: ReadonlyMap<string, number> =
      queryTerms instanceof Map
        ? (queryTerms as ReadonlyMap<string, number>)
        : new Map([...new Set(queryTerms as Iterable<string>)].map((term) => [term, 1] as const));
    for (const [term, weight] of weights) {
      const postings = this.postings.get(term);
      if (postings === undefined) continue;
      for (let i = 0; i < postings.docs.length; i += 1) {
        const docIndex = postings.docs[i] as number;
        if (accept !== undefined && !accept(docIndex)) continue;
        const tf = postings.freqs[i] as number;
        const length = this.lengths[docIndex] as number;
        const norm = tf + k1 * (1 - b + (b * length) / (this.averageLength || 1));
        const contribution = weight * postings.idf * ((tf * (k1 + 1)) / norm);
        const hit = hits.get(docIndex);
        if (hit === undefined)
          hits.set(docIndex, { score: contribution, matchedIdf: postings.idf });
        else {
          hit.score += contribution;
          hit.matchedIdf += postings.idf;
        }
      }
    }
    return hits;
  }
}
