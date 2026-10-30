import type { CaseStudy } from "../types.ts";

export const lettersAnonymous: CaseStudy = {
  slug: "letters-anonymous",
  title: "Letters Anonymous: automated moderation that fails closed",
  summary:
    "An anonymous wall of encouraging notes for students, moderated automatically on local models, with no human approval queue and no third-party services.",
  status: "Production",
  context: "University of Mississippi",
  role: "Built the platform end to end",
  period: "2025 – Present",
  stack: ["Node.js", "Express", "PostgreSQL", "React", "Transformers.js (local model)"],
  evidence: {
    label: "Verified against code",
    text: "Behavior here was checked against the source. The code is private; specific moderation rules and thresholds are left out on purpose.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "A wall of anonymous, kind notes for students only works if every submission is screened, and nobody has time to read them all. Notes are written by students, so they shouldn't be sent to a third-party moderation API either.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I built it, frontend to database. It is in production use.",
        },
      ],
    },
    {
      id: "design",
      title: "Moderation pipeline",
      blocks: [
        {
          type: "diagram",
          title: "One submission",
          provenance: "Reconstructed from the source code.",
          rows: [
            { nodes: [{ label: "POST /api/letters", detail: "≤ 280 characters", kind: "client" }], edge: "global rate limit, then per-IP" },
            { nodes: [{ label: "Rules", detail: "links · emails · phone numbers · profanity · harassment phrases · spam", kind: "process" }], edge: "passes" },
            { nodes: [{ label: "Local toxicity model", detail: "waits for the model to load; any inference error rejects", kind: "process" }], edge: "verdict" },
            {
              nodes: [
                { label: "letters table", detail: "approved or rejected, with a reason", kind: "store" },
                { label: "Same response for everyone", detail: "201 · \"your note will appear once reviewed\"", kind: "client" },
              ],
            },
          ],
        },
        {
          type: "list",
          items: [
            "**Cheap first, model second.** The rules stage answers instantly, even while the model is still loading after a restart, and catches clean-worded cruelty the model misses. The model is a backstop for overt toxicity.",
            "**One entry point.** Moderation is a single function returning a status and a reason, so swapping in a different model is a one-file change.",
            "**The response never leaks the verdict.** Approved and rejected submissions get the same `201` and the same message, so nobody can probe the filter by submitting variations.",
            "**Rejections are kept.** Rejected notes are stored with their reason, so the filter can be tuned from what it actually caught. Two admin views show them, protected by a shared secret.",
          ],
        },
      ],
    },
    {
      id: "failures",
      title: "What happens when things fail",
      blocks: [
        {
          type: "table",
          columns: ["Condition", "Behavior"],
          rows: [
            ["Model still loading", "The request waits for it rather than skipping the model stage."],
            ["Model errors during a request", "Rejected with reason `moderation-error`. Never auto-approved."],
            ["Moderation throws anywhere", "The handler catches it and rejects. A second layer of the same rule."],
            ["Model never loads", "The server keeps running on rules alone and reports `rules-only` in its readiness check."],
            ["Database write fails", "`500` with a generic message; nothing is shown on the wall."],
            ["Database unreachable", "Readiness check returns `503`; liveness stays `200`."],
            ["Submission flood", "A global per-minute cap runs before a per-IP cap, so a flood is rejected cheaply."],
          ],
        },
      ],
    },
    {
      id: "data",
      title: "Data model",
      blocks: [
        {
          type: "code",
          label: "SQL",
          code: `CREATE TABLE letters (
  id            SERIAL PRIMARY KEY,
  body          TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT,
  source        TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','house')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX letters_status_idx ON letters (status);`,
        },
      ],
    },
    {
      id: "outcomes",
      title: "Outcome",
      blocks: [
        {
          type: "facts",
          items: [
            { value: "0", label: "third-party APIs: every submission is screened on local infrastructure", source: "impact-doc" },
            { value: "0", label: "human approval steps on the submission path", source: "code" },
          ],
        },
      ],
    },
    {
      id: "what-i-would-change",
      title: "What I would change today",
      blocks: [
        {
          type: "note",
          tone: "proposal",
          title: "Present-day assessment, not implemented",
          text: "Small changes I'd make after reading the code again.",
        },
        {
          type: "list",
          items: [
            "**Close the rules-only gap.** Inference errors fail closed, but if the model never loads, notes that pass the rules are approved without it. The schema already allows `pending`. In rules-only mode I'd store notes as `pending` and keep them off the wall until the model is back, which makes the whole path fail closed.",
            "**Compare secrets in constant time.** The admin checks use plain string equality; `crypto.timingSafeEqual` removes a timing side channel.",
            "**Index the query the wall runs.** The wall reads approved notes newest first, capped at 200. A partial index on `created_at DESC WHERE status = 'approved'` serves that directly, where an index on a three-value status column barely narrows anything.",
          ],
        },
      ],
    },
  ],
};
