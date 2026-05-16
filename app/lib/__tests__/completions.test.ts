import {
  validateAttachment,
  computeSortOrders,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  MAX_ATTACHMENTS,
} from '../completions';

describe('validateAttachment', () => {
  it('returns null for a valid JPEG under size limit', () => {
    const result = validateAttachment(
      { mimeType: 'image/jpeg', byteSize: 5 * 1024 * 1024 },
      0,
    );
    expect(result).toBeNull();
  });

  it('returns null for a valid MP4 under size and duration limits', () => {
    const result = validateAttachment(
      { mimeType: 'video/mp4', byteSize: 40 * 1024 * 1024, durationSeconds: 25 },
      0,
    );
    expect(result).toBeNull();
  });

  it('returns cap_reached when existing count is at max', () => {
    const result = validateAttachment(
      { mimeType: 'image/jpeg', byteSize: 1024 },
      MAX_ATTACHMENTS,
    );
    expect(result).toEqual({ kind: 'cap_reached', max: MAX_ATTACHMENTS });
  });

  it('returns null when existing count is one below max', () => {
    const result = validateAttachment(
      { mimeType: 'image/jpeg', byteSize: 1024 },
      MAX_ATTACHMENTS - 1,
    );
    expect(result).toBeNull();
  });

  it('returns unsupported_type for GIF', () => {
    const result = validateAttachment(
      { mimeType: 'image/gif', byteSize: 1024 },
      0,
    );
    expect(result).toEqual({ kind: 'unsupported_type', mime: 'image/gif' });
  });

  it('returns unsupported_type for WebM', () => {
    const result = validateAttachment(
      { mimeType: 'video/webm', byteSize: 1024 },
      0,
    );
    expect(result).toEqual({ kind: 'unsupported_type', mime: 'video/webm' });
  });

  it('returns too_large for a photo exceeding 10 MB', () => {
    const overSize = MAX_PHOTO_BYTES + 1;
    const result = validateAttachment(
      { mimeType: 'image/png', byteSize: overSize },
      0,
    );
    expect(result).toEqual({
      kind: 'too_large',
      maxMb: 10,
      actualMb: overSize / (1024 * 1024),
    });
  });

  it('returns null for a photo at exactly 10 MB', () => {
    const result = validateAttachment(
      { mimeType: 'image/png', byteSize: MAX_PHOTO_BYTES },
      0,
    );
    expect(result).toBeNull();
  });

  it('returns too_large for a video exceeding 50 MB', () => {
    const overSize = MAX_VIDEO_BYTES + 1;
    const result = validateAttachment(
      { mimeType: 'video/mp4', byteSize: overSize, durationSeconds: 10 },
      0,
    );
    expect(result).toEqual({
      kind: 'too_large',
      maxMb: 50,
      actualMb: overSize / (1024 * 1024),
    });
  });

  it('returns null for a video at exactly 50 MB', () => {
    const result = validateAttachment(
      { mimeType: 'video/mp4', byteSize: MAX_VIDEO_BYTES, durationSeconds: 10 },
      0,
    );
    expect(result).toBeNull();
  });

  it('returns too_long for a video exceeding 30 seconds', () => {
    const result = validateAttachment(
      { mimeType: 'video/mp4', byteSize: 1024, durationSeconds: 30.1 },
      0,
    );
    expect(result).toEqual({
      kind: 'too_long',
      maxSeconds: MAX_VIDEO_SECONDS,
      actualSeconds: 30.1,
    });
  });

  it('returns null for a video at exactly 30 seconds', () => {
    const result = validateAttachment(
      { mimeType: 'video/mp4', byteSize: 1024, durationSeconds: 30 },
      0,
    );
    expect(result).toBeNull();
  });

  it('returns null for a video without duration info', () => {
    const result = validateAttachment(
      { mimeType: 'video/quicktime', byteSize: 20 * 1024 * 1024 },
      0,
    );
    expect(result).toBeNull();
  });

  it('accepts HEIC photos', () => {
    const result = validateAttachment(
      { mimeType: 'image/heic', byteSize: 3 * 1024 * 1024 },
      0,
    );
    expect(result).toBeNull();
  });

  it('accepts HEIF photos', () => {
    const result = validateAttachment(
      { mimeType: 'image/heif', byteSize: 3 * 1024 * 1024 },
      0,
    );
    expect(result).toBeNull();
  });

  it('checks cap before type validation', () => {
    const result = validateAttachment(
      { mimeType: 'image/gif', byteSize: 1024 },
      MAX_ATTACHMENTS,
    );
    expect(result?.kind).toBe('cap_reached');
  });
});

describe('computeSortOrders', () => {
  it('assigns sequential sort_order values', () => {
    const result = computeSortOrders(['a', 'b', 'c']);
    expect(result).toEqual([
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ]);
  });

  it('handles reordering', () => {
    const result = computeSortOrders(['c', 'a', 'b']);
    expect(result).toEqual([
      { id: 'c', sort_order: 0 },
      { id: 'a', sort_order: 1 },
      { id: 'b', sort_order: 2 },
    ]);
  });

  it('handles single item', () => {
    const result = computeSortOrders(['x']);
    expect(result).toEqual([{ id: 'x', sort_order: 0 }]);
  });

  it('handles empty array', () => {
    const result = computeSortOrders([]);
    expect(result).toEqual([]);
  });
});
