// Shared origin gate for webhook- and cron-triggered edge functions.
//
// These functions run with the service-role key and act on caller-supplied
// payloads (recipient ids, comment bodies, feedback rows). The platform's
// default JWT check is NOT sufficient authentication here: with open signup,
// ANY authenticated user holds a valid JWT and could POST a forged payload
// directly to the function URL — spoofing push notifications, friend-request
// pings, or feedback-pipeline actions.
//
// So every such function must additionally prove the request came from our own
// DB webhook / cron configuration by presenting a shared secret. Set the secret
// once (`supabase secrets set WEBHOOK_SECRET=...`) and add the matching
// `x-webhook-secret` header to each webhook and scheduled invocation.

// Returns a 401 Response when the request is not authenticated, or null when it
// is. Fails closed if WEBHOOK_SECRET is unset (misconfiguration ≠ open door).
export function verifyWebhookSecret(req: Request): Response | null {
  const expected = Deno.env.get("WEBHOOK_SECRET");
  if (!expected) {
    console.error("WEBHOOK_SECRET is not configured; rejecting request");
    return unauthorized();
  }
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!constantTimeEqual(provided, expected)) return unauthorized();
  return null;
}

// Length-independent, content constant-time comparison to avoid leaking the
// secret through response timing.
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Compare against a fixed-length digest so differing lengths don't short
  // out early.
  let mismatch = ab.length ^ bb.length;
  for (let i = 0; i < ab.length; i++) {
    mismatch |= ab[i] ^ bb[i % bb.length];
  }
  return mismatch === 0;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
