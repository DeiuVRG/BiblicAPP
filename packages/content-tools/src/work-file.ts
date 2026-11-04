import fs from 'node:fs';

import { AuthorSchema, EditionSchema, IdSchema, WorkSchema } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared/ids';
import type { Edition, Work } from '@biblioteca/shared';
import { z } from 'zod';

/**
 * `content/works/<slug>/work.json`: hand-written metadata of a work and one edition. The ids
 * may be omitted in a new file: `ensureIds` generates them once and they are then stored.
 */
export const WorkMetaFileSchema = z.object({
  work: WorkSchema.extend({ id: IdSchema.optional(), author: AuthorSchema }),
  edition: EditionSchema.extend({ id: IdSchema.optional() }),
});
export type WorkMetaFile = z.infer<typeof WorkMetaFileSchema>;

export interface ResolvedWorkMeta {
  work: Work;
  edition: Edition;
}

export function loadWorkMeta(file: string): WorkMetaFile {
  return WorkMetaFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown);
}

/** Returns the metadata with ids; `changed` tells whether new ids were generated. */
export function ensureIds(meta: WorkMetaFile): { meta: ResolvedWorkMeta; changed: boolean } {
  let changed = false;
  const workId = meta.work.id ?? ((changed = true), stableId());
  const editionId = meta.edition.id ?? ((changed = true), stableId());
  return {
    changed,
    meta: {
      work: { ...meta.work, id: workId },
      edition: { ...meta.edition, id: editionId },
    },
  };
}

export function saveWorkMeta(file: string, meta: ResolvedWorkMeta): void {
  const parsed = WorkMetaFileSchema.parse(meta);
  fs.writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`);
}
