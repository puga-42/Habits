// Human-readable message from any thrown value. Supabase's PostgrestError is
// a plain object (NOT an Error instance), so the widespread
// `err instanceof Error ? err.message : String(err)` pattern rendered
// "[object Object]" in alerts — this helper unwraps .message from anything
// that carries one. Use this in every catch that feeds an Alert.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    err !== null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return String(err);
}
