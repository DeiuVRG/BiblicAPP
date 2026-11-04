// Cleaning of text that comes from outside (questions, earlier turns of a dialogue) before it is
// searched, logged or sent to the model.

/** Lone surrogates: a high one not followed by a low one, or a low one not preceded by a high one. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Replaces lone surrogates (invalid UTF-16 that `JSON.parse` accepts from `"\ud800"`) with U+FFFD, as
 * `String.prototype.toWellFormed` does (ES2024; the project's TypeScript target is ES2022).
 */
export function toWellFormed(text: string): string {
  return text.replace(LONE_SURROGATE, '�');
}

/** Whether the text holds a NUL character, which no question or earlier turn has a reason to carry. */
export function hasNul(text: string): boolean {
  return text.includes('\u0000');
}
