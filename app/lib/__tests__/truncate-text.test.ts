import { truncateAtWord } from '../truncate-text';

describe('truncateAtWord', () => {
  it('returns short text untouched', () => {
    expect(truncateAtWord('Run every day', 80)).toEqual({
      text: 'Run every day',
      truncated: false,
    });
  });

  it('treats text exactly at the limit as not truncated', () => {
    const s = 'x'.repeat(80);
    expect(truncateAtWord(s, 80)).toEqual({ text: s, truncated: false });
  });

  it('cuts at a word boundary within the limit', () => {
    const out = truncateAtWord(
      'Fifteen minutes of stretching with a focus on hips and hamstrings every single morning',
      40,
    );
    expect(out.truncated).toBe(true);
    expect(out.text).toBe('Fifteen minutes of stretching with a');
    expect(out.text.length).toBeLessThanOrEqual(40);
  });

  it('hard-cuts an unbroken run (no word boundary to back up to)', () => {
    const out = truncateAtWord('a'.repeat(120), 40);
    expect(out.truncated).toBe(true);
    expect(out.text).toBe('a'.repeat(40));
  });

  it('drops trailing whitespace and orphan punctuation at the cut', () => {
    const out = truncateAtWord('Read a chapter, then summarize it aloud tomorrow', 16);
    expect(out.truncated).toBe(true);
    expect(out.text).toBe('Read a chapter');
  });
});
