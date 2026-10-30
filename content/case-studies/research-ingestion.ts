import type { CaseStudy } from "../types.ts";

export const researchIngestion: CaseStudy = {
  slug: "research-ingestion",
  title: "A bulk collector that proves it got everything",
  summary:
    "Pulling an institution's full research record from two scholarly APIs into Postgres: checkpoints committed with the data, keyset paging, and a completeness check that caught an upstream paging bug silently dropping records.",
  status: "In development",
  context: "University of Mississippi",
  role: "Designed and built the collector",
  period: "2026",
  topics: ["Resumable ingestion", "Completeness checks", "Keyset vs offset paging", "Retry and rate limiting"],
  stack: ["Python", "PostgreSQL", "psycopg", "requests", "systemd"],
  evidence: {
    label: "Verified against code and run logs",
    text: "Behavior comes from the source, and the paging results come from the collector's own run logs. The code is private, so snippets are simplified. Institution identifiers, hosts and absolute record counts are left out; results are shown as percentages.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "A research analytics dashboard needs the institution's complete record: works, authors and authorships from OpenAlex, and publications, grants, clinical trials and patents from Dimensions. The earlier version fetched per request and per author, and its Dimensions client asked for one page of 1,000 records, so everything past the first thousand was silently missing. Nothing in the dashboard could tell you that.",
        },
        {
          type: "p",
          text: "The goal for the collector was simple to state: pull everything, survive interruptions, and **know** whether what landed is complete rather than assume it.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I designed and built the collector. It runs end to end against both APIs, and it ships with a systemd service and timer for scheduled runs. It's the newest part of the dashboard and is still being finalized.",
        },
      ],
    },
    {
      id: "design",
      title: "Shape of a run",
      blocks: [
        {
          type: "diagram",
          title: "One extraction run",
          provenance: "Reconstructed from the source code. Hosts and deployment paths are left out.",
          rows: [
            {
              nodes: [{ label: "systemd timer", detail: "daily, randomized ±15 min · Postgres advisory lock", kind: "process" }],
              edge: "for each task: skip if fresh · resume if running or failed",
            },
            {
              nodes: [
                { label: "OpenAlex", detail: "cursor paging, 200/page", kind: "external" },
                { label: "Dimensions", detail: "keyset paging by id", kind: "external" },
              ],
              edge: "rate-limited HTTP · retry with backoff",
            },
            {
              nodes: [{ label: "Page upsert + checkpoint", detail: "one transaction", kind: "process" }],
              edge: "commit",
            },
            {
              nodes: [
                { label: "Source tables", detail: "typed columns + raw JSONB · last_seen_at", kind: "store" },
                { label: "extraction_state / extraction_runs", detail: "progress · expected · status", kind: "store" },
              ],
              edge: "after pulls",
            },
            { nodes: [{ label: "Completeness check → aggregates → API reload", kind: "client" }] },
          ],
        },
        {
          type: "list",
          items: [
            "**Tasks, not one script.** Each source and entity type is its own task with its own state row, so a failure in one doesn't redo the others. A task completed within a configurable freshness window is skipped. The scheduled service sets that window to about a week, so the daily timer mostly resumes or skips and refreshes in full roughly weekly.",
            "**One collector at a time.** The process takes a Postgres advisory lock at startup and exits if another run holds it, so an overlapping timer can't run two collectors against the same tables.",
            "**Raw and typed.** Each source table keeps a few typed, indexed columns for the dashboard's queries, plus the full API record in `JSONB` so new fields don't require a re-pull.",
          ],
        },
      ],
    },
    {
      id: "resume",
      title: "Checkpoints that can't run ahead of the data",
      blocks: [
        {
          type: "p",
          text: "Each page is upserted and its checkpoint is written in the **same transaction**. The upsert doesn't commit; the checkpoint does, for both. A crash can only lose the page in flight, and the checkpoint never points past data that isn't there.",
        },
        {
          type: "code",
          label: "Python",
          caption: "One page of a Dimensions pull (simplified from the source).",
          code: `while True:
    page_where = where if p["after"] is None else f'{where} and id > "{p["after"]}"'
    records = query(f"search {source} where {page_where} "
                    f"return {source}[{fields}] sort by id asc limit {page_size}")
    if not records:
        break
    last = records[-1]["id"]
    if p["after"] is not None and last <= p["after"]:
        raise RuntimeError(f"paging did not advance past {p['after']}")
    db.upsert(conn, table, [to_row(r) for r in records])   # no commit
    p = {**p, "after": last}
    task.checkpoint(p, len(records))                       # commits page + progress
    if len(records) < page_size:
        break`,
        },
        {
          type: "list",
          items: [
            "**Idempotent writes.** Every table is written with `INSERT … ON CONFLICT DO UPDATE` on its natural key. Authorships are keyed by `(work_id, author_id)` and de-duplicated within each page, so replaying a page after a crash changes nothing.",
            "**A loop that must make progress.** If a page's last ID isn't past the previous one, the run stops with an error instead of looping or skipping forward.",
            "**Stale cursors restart cleanly.** If a saved OpenAlex cursor has expired, the task restarts that sweep from the beginning; the upserts make that safe.",
          ],
        },
      ],
    },
    {
      id: "completeness",
      title: "Proving the run is complete",
      blocks: [
        {
          type: "p",
          text: "At the start of a pull the collector records how many records the API says exist: OpenAlex's `meta.count`, or Dimensions' total count. At the end it counts the **distinct** rows touched since the run began, using a `last_seen_at` timestamp bumped on every upsert. Distinct rows matter: a duplicated page can't inflate the total. If the stored count falls more than 1% short, the run is recorded as incomplete and the process exits non-zero.",
        },
        {
          type: "h3",
          text: "What it caught",
        },
        {
          type: "p",
          text: "The first Dimensions publications pull used offset paging (`skip`), checkpointing the offset. The completeness check failed it twice: one run stored 76% of the records the API reported, the next 95%. Deep offsets in Dimensions aren't stable, and the same `skip` lands on different records depending on page size, so pages overlapped and records fell through the gaps without any error.",
        },
        {
          type: "table",
          caption: "Publications pull, from the collector's run logs",
          columns: ["Paging", "Distinct records stored vs API count", "Result"],
          rows: [
            ["Offset (`skip`)", "76%", "Failed completeness check"],
            ["Offset (`skip`)", "95%", "Failed completeness check"],
            ["Keyset (`id > last_id`, sorted by id)", "100%", "Complete"],
          ],
        },
        {
          type: "p",
          text: "Switching to keyset paging, where each page asks for IDs greater than the last one seen, fixed it: there's no offset to drift, and no 50,000-record window limit. Without the check, the dashboard would have shown confident totals that were 5–24% low.",
        },
      ],
    },
    {
      id: "upstream",
      title: "Being a good API client",
      blocks: [
        {
          type: "list",
          items: [
            "**Throttle per source.** A shared HTTP session enforces a minimum interval between requests under a lock: 0.15 s for OpenAlex, 2.1 s (about 30 requests a minute) for Dimensions.",
            "**Retry what's transient, fail on what isn't.** `429` and `500/502/503/504` are retried up to 8 attempts, with backoff starting at 5 s, doubling, capped at 5 minutes, plus up to 20% jitter. A numeric `Retry-After` raises the floor. Any other `4xx` fails immediately. A failure never turns into an empty page.",
            "**Errors inside a 200.** Dimensions can return HTTP 200 with an error payload; the client treats that as an error rather than as zero results.",
            "**Tokens refresh before they expire.** The Dimensions client refreshes its token proactively, and re-authenticates once on a `401` before giving up.",
            "**Heavy fields fetched separately, and verified.** Some fields make Dimensions drop records from large responses. Those fields are fetched by ID in a second pass. Any IDs missing from a response are retried; a batch that returns none of them is split in half until each record comes back, or one record fails by name.",
            "**Truncated lists refetched.** OpenAlex list results truncate authorships on very large papers, so works with 100 or more authors are fetched again individually.",
          ],
        },
      ],
    },
    {
      id: "what-i-would-change",
      title: "What I would change today",
      feature: true,
      blocks: [
        {
          type: "note",
          tone: "proposal",
          title: "Present-day assessment, not implemented",
          text: "The core loop is sound. These are the edges I'd tighten before calling it finished.",
        },
        {
          type: "h3",
          text: "1. An incomplete run should start over, not resume",
        },
        {
          type: "p",
          text: "A run that fails the completeness check keeps its final checkpoint, which already points at the end of the data. Resuming it sweeps nothing new and fails again until someone forces a fresh run. Incomplete should mean \"restart this task from the beginning\", automatically, with the upserts making the repeat cheap.",
        },
        {
          type: "h3",
          text: "2. Make the tolerance and the gaps visible",
        },
        {
          type: "p",
          text: "The 1% tolerance is reasonable for sources whose counts shift during a long pull, but a run that passes at 99.2% currently looks the same as one at 100%. I'd store the exact shortfall on every run and show it next to the dashboard's data-freshness indicator.",
        },
        {
          type: "h3",
          text: "3. Don't publish on a failed pull, and say so loudly",
        },
        {
          type: "list",
          items: [
            "**Aggregates rebuild unconditionally** after the pulls. I'd skip the rebuild for any aggregate whose inputs failed, so the dashboard keeps the last good numbers instead of mixing old and new.",
            "**No alerting yet.** A failed run exits non-zero and is recorded in the database, but nothing notifies anyone. A systemd `OnFailure=` unit that sends a message would close that gap.",
          ],
        },
        {
          type: "h3",
          text: "4. Account for records that disappear upstream",
        },
        {
          type: "p",
          text: "Every row has a `last_seen_at`, but nothing uses it to retire rows that a full sweep no longer returns, such as records merged upstream. Totals can drift upward over time. After a complete full sweep, I'd mark unseen rows as retired and have the API exclude them.",
        },
        {
          type: "h3",
          text: "5. Tests for the parts that are easy to get wrong",
        },
        {
          type: "p",
          text: "The split-and-retry fetch, the paging guard and the completeness arithmetic are all pure enough to unit-test with a fake client. I'd start there, along with sending the OpenAlex API key in a header rather than the query string, so it can't end up in an error message.",
        },
      ],
    },
    {
      id: "limitations",
      title: "Limits of this write-up",
      blocks: [
        {
          type: "list",
          items: [
            "Absolute record counts and run times are left out to avoid publishing institutional details. The percentages above come from the run logs.",
            "The collector is still being finalized. Scheduling is configured but hasn't yet run for an extended period.",
          ],
        },
      ],
    },
  ],
};
