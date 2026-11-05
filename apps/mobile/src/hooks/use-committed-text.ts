import { useEffect, useState } from 'react';

/** How long after the last key a search field commits what was typed. */
export const COMMIT_DELAY_MS = 180;

/**
 * The text of a search field that lives in the state of its screen (and so in the address): the
 * field shows what is typed at once, and `commit` gets the trimmed text 180 ms after the last key.
 * When the committed value changes from outside (the filters were cleared, a link to the same page
 * with another query), the field follows it.
 */
export function useCommittedText(
  committed: string,
  commit: (text: string) => void,
  delay: number = COMMIT_DELAY_MS,
): [string, (text: string) => void] {
  const [text, setText] = useState(committed);
  const [seen, setSeen] = useState(committed);

  // Adjusting state while rendering (not in an effect): the field follows the committed value.
  if (seen !== committed) {
    setSeen(committed);
    if (text.trim() !== committed) setText(committed);
  }

  useEffect(() => {
    if (text.trim() === committed) return undefined;
    const timer = setTimeout(() => commit(text.trim()), delay);
    return () => clearTimeout(timer);
  }, [text, committed, commit, delay]);

  return [text, setText];
}
