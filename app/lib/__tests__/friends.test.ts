import {
  canonicalA,
  canonicalB,
  mergeFriendsPages,
  mergeRequestPages,
  type FriendProfile,
  type FriendRequest,
} from '../friends';

function makeProfile(overrides: Partial<FriendProfile> = {}): FriendProfile {
  return {
    id: 'u1',
    handle: 'alice',
    display_name: 'Alice',
    avatar_url: null,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<FriendRequest> = {}): FriendRequest {
  return {
    id: 'r1',
    from_user: 'u1',
    to_user: 'u2',
    status: 'pending',
    created_at: '2026-05-15T10:00:00Z',
    responded_at: null,
    profile: makeProfile(),
    ...overrides,
  };
}

describe('canonicalA / canonicalB', () => {
  it('returns the lesser UUID as A regardless of argument order', () => {
    expect(canonicalA('aaa', 'zzz')).toBe('aaa');
    expect(canonicalA('zzz', 'aaa')).toBe('aaa');
  });

  it('returns the greater UUID as B regardless of argument order', () => {
    expect(canonicalB('aaa', 'zzz')).toBe('zzz');
    expect(canonicalB('zzz', 'aaa')).toBe('zzz');
  });

  it('handles equal values', () => {
    expect(canonicalA('same', 'same')).toBe('same');
    expect(canonicalB('same', 'same')).toBe('same');
  });
});

describe('mergeFriendsPages', () => {
  it('appends the next page', () => {
    const existing = [makeProfile({ id: 'u1', display_name: 'Alice' })];
    const next = [makeProfile({ id: 'u2', display_name: 'Bob' })];
    const merged = mergeFriendsPages(existing, next);
    expect(merged.map((p) => p.id)).toEqual(['u1', 'u2']);
  });

  it('dedupes by id, preferring the newer copy from next', () => {
    const existing = [makeProfile({ id: 'u1', display_name: 'Alice Old' })];
    const next = [makeProfile({ id: 'u1', display_name: 'Alice New' })];
    const merged = mergeFriendsPages(existing, next);
    expect(merged).toHaveLength(1);
    expect(merged[0].display_name).toBe('Alice New');
  });

  it('sorts by display_name ascending then id ascending', () => {
    const existing = [
      makeProfile({ id: 'u3', display_name: 'Charlie' }),
      makeProfile({ id: 'u1', display_name: 'Alice' }),
    ];
    const next = [
      makeProfile({ id: 'u2', display_name: 'Bob' }),
      makeProfile({ id: 'u4', display_name: 'Alice' }),
    ];
    const merged = mergeFriendsPages(existing, next);
    expect(merged.map((p) => p.id)).toEqual(['u1', 'u4', 'u2', 'u3']);
  });

  it('is idempotent when merging the same page', () => {
    const page = [
      makeProfile({ id: 'u1', display_name: 'Alice' }),
      makeProfile({ id: 'u2', display_name: 'Bob' }),
    ];
    const merged = mergeFriendsPages(page, page);
    expect(merged).toEqual(page);
  });

  it('handles empty existing list', () => {
    const next = [makeProfile({ id: 'u1', display_name: 'Alice' })];
    expect(mergeFriendsPages([], next)).toEqual(next);
  });

  it('handles empty next list', () => {
    const existing = [makeProfile({ id: 'u1', display_name: 'Alice' })];
    expect(mergeFriendsPages(existing, [])).toEqual(existing);
  });
});

describe('mergeRequestPages', () => {
  it('appends the next page', () => {
    const existing = [makeRequest({ id: 'r1', created_at: '2026-05-15T12:00:00Z' })];
    const next = [makeRequest({ id: 'r2', created_at: '2026-05-15T10:00:00Z' })];
    const merged = mergeRequestPages(existing, next);
    expect(merged.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('dedupes by id, preferring the newer copy from next', () => {
    const existing = [makeRequest({ id: 'r1', status: 'pending' })];
    const next = [makeRequest({ id: 'r1', status: 'accepted' })];
    const merged = mergeRequestPages(existing, next);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('accepted');
  });

  it('sorts by created_at descending then id descending', () => {
    const existing = [
      makeRequest({ id: 'r1', created_at: '2026-05-15T10:00:00Z' }),
      makeRequest({ id: 'r3', created_at: '2026-05-15T12:00:00Z' }),
    ];
    const next = [
      makeRequest({ id: 'r2', created_at: '2026-05-15T11:00:00Z' }),
      makeRequest({ id: 'r4', created_at: '2026-05-15T12:00:00Z' }),
    ];
    const merged = mergeRequestPages(existing, next);
    expect(merged.map((r) => r.id)).toEqual(['r4', 'r3', 'r2', 'r1']);
  });

  it('is idempotent when merging the same page', () => {
    const page = [
      makeRequest({ id: 'r1', created_at: '2026-05-15T12:00:00Z' }),
      makeRequest({ id: 'r2', created_at: '2026-05-15T10:00:00Z' }),
    ];
    const merged = mergeRequestPages(page, page);
    expect(merged).toEqual(page);
  });

  it('handles empty existing list', () => {
    const next = [makeRequest({ id: 'r1' })];
    expect(mergeRequestPages([], next)).toEqual(next);
  });
});
