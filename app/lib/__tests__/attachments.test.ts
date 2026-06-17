import {
  attachmentKindForMime,
  extensionForMime,
  storagePathFor,
} from '../attachments';

describe('extensionForMime', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/heic', 'heic'],
    ['image/heif', 'heif'],
    ['video/mp4', 'mp4'],
    ['video/quicktime', 'mov'],
  ])('maps %s to .%s', (mime, ext) => {
    expect(extensionForMime(mime)).toBe(ext);
  });

  it('falls back to bin for an unknown mime', () => {
    expect(extensionForMime('application/octet-stream')).toBe('bin');
  });
});

describe('attachmentKindForMime', () => {
  it('classifies allowed video mimes as video', () => {
    expect(attachmentKindForMime('video/mp4')).toBe('video');
    expect(attachmentKindForMime('video/quicktime')).toBe('video');
  });

  it('classifies everything else as photo', () => {
    expect(attachmentKindForMime('image/jpeg')).toBe('photo');
    expect(attachmentKindForMime('image/png')).toBe('photo');
  });
});

describe('storagePathFor', () => {
  it('builds an {owner}/{parent}/{uuid}.{ext} path', () => {
    expect(storagePathFor('owner1', 'rest9', 'uuidA', 'image/jpeg')).toBe(
      'owner1/rest9/uuidA.jpg',
    );
  });

  it('uses the mime-derived extension for videos', () => {
    expect(storagePathFor('o', 'p', 'u', 'video/quicktime')).toBe('o/p/u.mov');
  });
});
