// Word-boundary truncation for feed text (habit descriptions). Cuts to at
// most `limit` characters, backing up to the previous word break when one
// exists in the tail third (otherwise hard-cuts an unbroken run), and strips
// dangling whitespace/punctuation so the "… more" affordance never follows a
// comma. Pure + TDD'd; the tappable expand/collapse lives in
// components/expandable-text.tsx.

export type TruncateResult = { text: string; truncated: boolean };

export function truncateAtWord(text: string, limit: number): TruncateResult {
  if (text.length <= limit) return { text, truncated: false };
  const slice = text.slice(0, limit);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice;
  return { text: cut.replace(/[\s,;:.!?-]+$/u, ''), truncated: true };
}
