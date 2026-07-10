// Unique Realtime channel topics. supabase.channel(name) RETURNS THE EXISTING
// channel if one with that topic is still registered — and removeChannel() is
// async, so a fast unmount/remount (e.g. sign out → sign in) can hand the new
// subscriber an already-subscribed instance, where chaining .on() throws
// "cannot add 'postgres_changes' callbacks ... after subscribe()". A per-call
// suffix keeps the base topic readable while making reuse impossible.
let seq = 0;

export function uniqueChannelName(base: string): string {
  seq += 1;
  return `${base}:${seq}`;
}
