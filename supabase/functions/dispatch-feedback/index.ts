// Edge Function: triage user feedback and create a GitHub issue.
//
// Triggered by a DB webhook on the feedback table (INSERT).
// Calls Claude API to classify feedback, then creates a labeled GitHub issue.
// The Claude Code scheduled routine picks up issues labeled "automated" for implementation.
//
// Configure in Supabase Studio → Database → Webhooks:
//   feedback_inserted │ feedback │ INSERT │ POST → this function
//   Authorization: Bearer <service_role_key>
//
// Required secrets (set via `supabase secrets set`):
//   ANTHROPIC_API_KEY — for Claude triage calls
//   GITHUB_TOKEN     — fine-grained PAT with Issues (read/write) on puga-42/Habits
//   GITHUB_OWNER     — "puga-42"
//   GITHUB_REPO      — "Habits"

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_API = "https://api.github.com";
const CLAUDE_API = "https://api.anthropic.com/v1/messages";

interface FeedbackRecord {
  id: string;
  category: "bug" | "feature";
  desired_behavior: string;
  current_behavior: string | null;
  screenshot_path: string | null;
}

interface TriageResult {
  title: string;
  priority: "low" | "medium" | "high";
  summary: string;
}

serve(async (req) => {
  const payload = await req.json();
  if (payload.type !== "INSERT") {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const record = payload.record as FeedbackRecord;

  const { data: claimed } = await supabase
    .from("feedback")
    .update({ status: "processing" })
    .eq("id", record.id)
    .eq("status", "pending")
    .select("id")
    .single();

  if (!claimed) {
    return new Response(JSON.stringify({ skipped: "already claimed" }), {
      status: 200,
    });
  }

  try {
    const triage = await triageFeedback(record);
    const issueNumber = await createGitHubIssue(triage, record);

    await supabase
      .from("feedback")
      .update({
        status: "done",
        title: triage.title,
        github_issue_number: issueNumber,
        processed_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    return new Response(JSON.stringify({ issueNumber }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("dispatch-feedback error:", err);
    await supabase.from("feedback").update({ status: "failed" }).eq("id", record.id);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});

async function triageFeedback(record: FeedbackRecord): Promise<TriageResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  let feedbackText = `Category: ${record.category}\n\nDesired behavior:\n${record.desired_behavior}`;
  if (record.current_behavior) {
    feedbackText += `\n\nCurrent behavior:\n${record.current_behavior}`;
  }
  if (record.screenshot_path) {
    feedbackText += `\n\n[Screenshot attached: ${record.screenshot_path}]`;
  }

  const res = await fetch(CLAUDE_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are triaging user feedback for a habit-tracking iOS app.
The user has already classified this as a ${record.category === "bug" ? "bug report" : "feature request"}.

${feedbackText}

Respond with JSON only, no markdown fences:
{
  "title": "<concise issue title, under 70 chars>",
  "priority": "low" | "medium" | "high",
  "summary": "<2-3 sentence description for a GitHub issue body>"
}

Context:
- The app tracks habits (scheduled via RRULE, or flex with targets).
- It has a social feed with friends, likes, comments.
- No streaks or gamification — never suggest adding those.
- Stack: React Native/Expo + Supabase.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.content[0].text;
  return JSON.parse(text);
}

async function createGitHubIssue(
  triage: TriageResult,
  record: FeedbackRecord,
): Promise<number> {
  const token = Deno.env.get("GITHUB_TOKEN")!;
  const owner = Deno.env.get("GITHUB_OWNER")!;
  const repo = Deno.env.get("GITHUB_REPO")!;

  const sectionHeader = record.category === "bug"
    ? "Expected behavior"
    : "Desired feature";

  let issueBody = `## ${sectionHeader}\n\n${record.desired_behavior}`;
  if (record.current_behavior) {
    issueBody += `\n\n## Current behavior\n\n${record.current_behavior}`;
  }
  if (record.screenshot_path) {
    issueBody += `\n\n## Screenshot\n\n_Attached in Supabase Storage: \`${record.screenshot_path}\`_`;
  }
  issueBody += `\n\n## Triage\n\n${triage.summary}\n\n**Priority:** ${triage.priority}`;
  issueBody += `\n\n---\n_Auto-triaged by feedback pipeline_`;

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      title: triage.title,
      body: issueBody,
      labels: ["automated", record.category, `priority:${triage.priority}`],
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }

  const issue = await res.json();
  return issue.number;
}
