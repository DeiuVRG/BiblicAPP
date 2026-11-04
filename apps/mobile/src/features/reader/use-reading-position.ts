import { useEffect, useState } from 'react';

import { PositionWriter } from '@/reading/position-writer';
import { useStorage } from '@/storage/key-value-store';

/** A stable PositionWriter for one section; pending writes are flushed on unmount. */
export function useReadingPositionWriter(workId: string, sectionId: string): PositionWriter {
  const store = useStorage();
  const [writer] = useState(() => new PositionWriter(store, workId, sectionId));

  useEffect(() => {
    writer.configure(store, workId, sectionId);
  }, [writer, store, workId, sectionId]);

  useEffect(() => () => writer.flush(), [writer]);

  return writer;
}
