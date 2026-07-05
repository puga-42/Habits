// Run with: deno test supabase/functions/notification-dispatcher/compose.test.ts
import { assertEquals } from "https://deno.land/std@0.190.0/assert/mod.ts";
import { composeMessages, type ClaimedRow } from "./compose.ts";

function row(p: Partial<ClaimedRow>): ClaimedRow {
  return {
    id: "n1", recipient_id: "u1", kind: "completion_like", actor_handle: "alice",
    target_id: "t1", comment_id: null, comment_body: null, batch_key: null, ...p,
  };
}

Deno.test("collapses same-target likes into one message with a count", () => {
  const rows = [
    row({ id: "n1", actor_handle: "alice", kind: "completion_like", batch_key: "completion_like:t1" }),
    row({ id: "n2", actor_handle: "bob", kind: "completion_like", batch_key: "completion_like:t1" }),
    row({ id: "n3", actor_handle: "cara", kind: "completion_like", batch_key: "completion_like:t1" }),
  ];
  const [g] = composeMessages(rows);
  assertEquals(g.notificationIds.sort(), ["n1", "n2", "n3"]);
  assertEquals(g.title, "@alice and 2 others");
  assertEquals(g.body, "liked your post");
});

Deno.test("a single like has no count", () => {
  const [g] = composeMessages([row({ batch_key: "completion_like:t1" })]);
  assertEquals(g.title, "@alice");
  assertEquals(g.body, "liked your post");
});

Deno.test("does not merge likes across different recipients or targets", () => {
  const rows = [
    row({ id: "n1", recipient_id: "u1", batch_key: "completion_like:t1" }),
    row({ id: "n2", recipient_id: "u2", batch_key: "completion_like:t1" }),
    row({ id: "n3", recipient_id: "u1", batch_key: "completion_like:t2" }),
  ];
  assertEquals(composeMessages(rows).length, 3);
});

Deno.test("comment includes a truncated body", () => {
  const [g] = composeMessages([row({
    kind: "completion_comment", comment_id: "c1", comment_body: "great job keeping it up!",
  })]);
  assertEquals(g.title, "@alice");
  assertEquals(g.body, "commented: great job keeping it up!");
});

Deno.test("friend request and acceptance render distinctly", () => {
  const [req] = composeMessages([row({ kind: "friend_request", actor_handle: "bob" })]);
  assertEquals(req.body, "sent you a friend request");
  const [acc] = composeMessages([row({ kind: "friend_request_accepted", actor_handle: "bob" })]);
  assertEquals(acc.body, "accepted your friend request");
});

Deno.test("missing handle falls back to Someone", () => {
  const [g] = composeMessages([row({ kind: "habit_adopted", actor_handle: null })]);
  assertEquals(g.title, "Someone");
  assertEquals(g.body, "adopted your habit");
});
