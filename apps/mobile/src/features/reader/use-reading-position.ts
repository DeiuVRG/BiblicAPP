import { useEffect, useState } from 'react';

import { PositionWriter } from '@/reading/position-writer';
import { useStorage } from '@/storage/key-value-store';

/** A stable PositionWriter for one section of an edition; pending writes are flushed on unmount. */
export function useReadingPositionWriter(editionId: string, sectionId: string): PositionWriter {
  const store = useStorage();
  const [writer] = useState(() => new PositionWriter(store, editionId, sectionId));

  useEffect(() => {
    writer.configure(store, editionId, sectionId);
  }, [writer, store, editionId, sectionId]);

  useEffect(() => () => writer.flush(), [writer]);

  return writer;
}
