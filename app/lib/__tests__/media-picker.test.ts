import { normalizePickedAsset } from '../media-picker';

describe('normalizePickedAsset', () => {
  it('uses the asset mime type when present', () => {
    const out = normalizePickedAsset({
      uri: 'file:///v.mov', mimeType: 'video/quicktime', type: 'video',
      fileSize: 123, duration: 5000, width: 1920, height: 1080,
    });
    expect(out).toEqual({
      uri: 'file:///v.mov', mimeType: 'video/quicktime', byteSize: 123,
      durationSeconds: 5, width: 1920, height: 1080,
    });
  });

  it('falls back by kind when mime type is missing, and converts ms to seconds', () => {
    expect(
      normalizePickedAsset({ uri: 'u', type: 'video', duration: 30000 }),
    ).toMatchObject({ mimeType: 'video/mp4', durationSeconds: 30 });
    // Whole seconds only: duration_seconds is an INTEGER column — Postgres
    // rejects 8.44 with 'invalid input syntax for type integer'.
    expect(
      normalizePickedAsset({ uri: 'u', type: 'video', duration: 8440 }),
    ).toMatchObject({ durationSeconds: 8 });
    expect(
      normalizePickedAsset({ uri: 'u', type: 'video', duration: 8600 }),
    ).toMatchObject({ durationSeconds: 9 });
    expect(normalizePickedAsset({ uri: 'u', type: 'image' })).toMatchObject({
      mimeType: 'image/jpeg', byteSize: 0, durationSeconds: undefined,
    });
  });
});
