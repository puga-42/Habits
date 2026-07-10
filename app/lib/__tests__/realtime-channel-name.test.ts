import { uniqueChannelName } from '../realtime-channel-name';

describe('uniqueChannelName', () => {
  it('preserves the base topic for debuggability', () => {
    expect(uniqueChannelName('feed')).toMatch(/^feed:\d+$/);
  });

  it('never returns the same name twice, even for the same base', () => {
    // Regression: supabase.channel(name) returns an EXISTING channel when the
    // topic matches one still registered (removeChannel is async) — chaining
    // .on() onto that already-subscribed instance throws "cannot add
    // 'postgres_changes' callbacks ... after subscribe()". Unique topics make
    // the reuse impossible.
    const a = uniqueChannelName('unread-notifications:u1');
    const b = uniqueChannelName('unread-notifications:u1');
    expect(a).not.toBe(b);
  });
});
