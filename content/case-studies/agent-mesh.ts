import type { CaseStudy } from "../types.ts";

const repo = "https://github.com/mahek-sota/agent-ai-platform";

export const agentMesh: CaseStudy = {
  slug: "agent-mesh",
  title: "agent-mesh: durable, observable agent runs over MCP tools",
  summary:
    "A job platform that treats every LLM agent run as a durable, leased unit of work: a Postgres state machine, at-least-once delivery, fenced retries, scoped tool access and one trace per run.",
  status: "Personal project",
  context: "Public repository",
  role: "Sole author: design, implementation, tests and documentation",
  period: "2026",
  topics: ["Run state machines", "Leases and fenced retries", "Postgres vs Redis Streams", "Live progress over SSE"],
  stack: ["Python", "FastAPI", "PostgreSQL + pgvector", "Redis Streams", "OpenTelemetry", "Prometheus", "Docker Compose"],
  evidence: {
    label: "Verified against code",
    text: `Behavior, schema and API details on this page were checked against the public repository ([mahek-sota/agent-ai-platform](${repo}), commit \`47c1961\`). Performance and retrieval numbers are the ones documented in that repository; I did not rerun them for this page. It is a personal project, not a deployed production service.`,
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "An LLM agent run is a long, failure-prone job. It calls a model several times, executes tools that can hang or misbehave, and can take minutes. Handled as a single request, a client disconnect, a worker crash or a slow provider loses the work and leaves nothing to inspect.",
        },
        {
          type: "p",
          text: "agent-mesh treats each run as a durable unit of work. A client starts a **run** of a named **workflow** over REST and gets `202 Accepted` immediately. A worker claims it, runs the agent loop (model ⇄ tools) under hard limits, records every step in PostgreSQL and streams progress back over server-sent events. The intended users are developers or internal tools that start workflows through the API, and whoever operates the stack.",
        },
        {
          type: "p",
          text: "Six workflows ship with it: summarizing a workspace, answering questions with citations from a pgvector index, read-only SQL over past runs, a web digest, GitHub issue triage and a Slack digest. Each can call only the tools it lists.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I designed and built it on my own as a personal project. It runs locally on Docker Compose and works fully offline: without a model key, a deterministic scripted model drives every workflow, which is also what the tests use. Anthropic and local Ollama models are supported through the same interface. Nobody depends on it in production, and nothing here describes production traffic.",
        },
      ],
    },
    {
      id: "constraints",
      title: "Constraints that shaped the design",
      blocks: [
        {
          type: "list",
          items: [
            "**Runs must survive process death.** Workers can crash or be stopped mid-run; the system has to notice and either retry or fail the run with its last error intact.",
            "**Delivery is at-least-once.** A queue can deliver a message twice, so execution correctness can't depend on the queue.",
            "**Tools are an attack surface.** A model can be manipulated by the content it reads, so tools get least privilege: read-only by default, allowlists, and no API secrets in tool processes.",
            "**Offline and reproducible.** The demo and all tests need nothing but Docker, which ruled out depending on a hosted model for correctness.",
            "**SDK lifecycle rules.** The MCP SDK's cancel scopes must be entered and exited in the same task, so each MCP server connection is owned by one supervisor task that also handles reconnection.",
          ],
        },
      ],
    },
    {
      id: "architecture",
      title: "Architecture",
      blocks: [
        {
          type: "diagram",
          title: "Request path for one run",
          provenance:
            "Reconstructed from the repository README and docs/architecture.md. Jaeger, Prometheus and Grafana are omitted.",
          rows: [
            {
              nodes: [{ label: "Client", detail: "POST /runs · SSE /runs/{id}/events", kind: "client" }],
              edge: "API key · rate limit",
            },
            {
              nodes: [{ label: "API (FastAPI)", detail: "validate · create run · publish job · stream events", kind: "process" }],
              edge: "commit run, then XADD",
            },
            {
              nodes: [
                { label: "PostgreSQL", detail: "source of truth: runs, events, steps, tool calls, keys", kind: "store" },
                { label: "Redis", detail: "Streams queue · pub/sub wake-ups · rate-limit counters", kind: "store" },
              ],
              edge: "XREADGROUP → claim in Postgres",
            },
            {
              nodes: [{ label: "Worker", detail: "claim · agent loop · heartbeat · recovery · retention", kind: "process" }],
              edge: "model calls · tool calls",
            },
            {
              nodes: [
                { label: "LLM provider", detail: "Anthropic · Ollama · scripted fake", kind: "external" },
                { label: "stdio MCP servers", detail: "filesystem · github · slack", kind: "process" },
                { label: "MCP gateway (HTTP)", detail: "postgres · vector · web", kind: "process" },
              ],
            },
          ],
        },
        {
          type: "table",
          caption: "Processes and what each owns",
          columns: ["Process", "Responsibility"],
          rows: [
            ["API", "Authenticates keys, rate limits, validates input against the workflow's schema, creates runs, publishes jobs, serves SSE."],
            ["Worker", "Consumes jobs, runs the agent loop, heart-beats its lease, recovers abandoned work, applies retention."],
            ["MCP gateway", "One HTTP process hosting the postgres, vector and web tool servers behind a shared bearer token. Holds the embedding model."],
            ["stdio MCP servers", "Subprocesses of each worker (filesystem, GitHub, Slack), each started with only the environment variables listed for it."],
          ],
        },
      ],
    },
    {
      id: "lifecycle",
      title: "Run lifecycle and delivery",
      blocks: [
        {
          type: "p",
          text: "A run has six states. `queued`, `running`, and four terminal ones: `completed`, `failed`, `cancelled`, `timed_out`. Terminal states have no outgoing transitions.",
        },
        {
          type: "table",
          caption: "Allowed transitions (runs/state.py)",
          columns: ["From", "To", "When"],
          rows: [
            ["`queued`", "`running`", "A worker claims it"],
            ["`queued`", "`cancelled` · `failed`", "Cancelled before pickup · could not be enqueued"],
            ["`running`", "`completed` · `failed` · `timed_out` · `cancelled`", "Final answer · error or iteration limit · run deadline · cancel request"],
            ["`running`", "`queued`", "Lease expired or the attempt crashed, and attempts remain"],
          ],
        },
        {
          type: "p",
          text: "Every transition is one conditional `UPDATE` whose `WHERE` clause lists the only states that can reach the target. Two processes racing on a run cannot both win, and the losing caller learns the current state. Worker writes are additionally fenced on the attempt number, so a worker that stalled and lost its lease can't overwrite the attempt that replaced it. Each transition inserts its event row in the same transaction.",
        },
        {
          type: "code",
          label: "SQL",
          caption: "SQL equivalent of the claim statement built in runs/service.py (simplified).",
          code: `UPDATE runs
SET    status       = 'running',
       attempts     = attempts + 1,
       worker_id    = :worker_id,
       started_at   = now(),
       heartbeat_at = now(),
       deadline_at  = now() + :run_timeout
WHERE  id = :run_id
  AND  status IN ('queued')        -- sources_for(RUNNING)
RETURNING *;
-- no row returned: another worker won, or the run was cancelled`,
        },
        { type: "h3", text: "At-least-once delivery, one execution per attempt" },
        {
          type: "list",
          ordered: true,
          items: [
            "The API commits the run as `queued`, then `XADD`s a message with the run ID and trace context. If the publish fails, the run is marked `failed` and the client gets `503`.",
            "A worker reads the message with `XREADGROUP` and re-reads the run from Postgres. The message is only a hint.",
            "The worker claims the run. Only one claim can succeed, so a duplicate message is harmless.",
            "While executing, the worker heart-beats the run every 5 seconds (defaults throughout). The heartbeat also delivers cancellation.",
            "The terminal state is committed first; the message is acknowledged afterwards.",
          ],
        },
      ],
    },
    {
      id: "data-model",
      title: "Data model",
      blocks: [
        {
          type: "p",
          text: "Alembic owns the schema. A test builds a fresh database from the migrations and asserts it matches the ORM models exactly. Relationships and the constraints that matter:",
        },
        {
          type: "code",
          label: "Schema relationships",
          caption: "From migrations 0001–0004. FK = foreign key.",
          code: `api_keys    1 ──< runs          FK created_by_key_id  ON DELETE SET NULL
runs        1 ──< run_events    FK  ON DELETE CASCADE
runs        1 ──< agent_steps   FK  ON DELETE CASCADE
agent_steps 1 ──< tool_calls    FK step_id, FK run_id  ON DELETE CASCADE
documents   1 ──< chunks        FK  ON DELETE CASCADE`,
        },
        {
          type: "table",
          caption: "Constraints and indexes, and the query each one serves",
          columns: ["Table", "Constraint or index", "Why it exists"],
          rows: [
            ["`runs`", "`CHECK` on `status` (six values)", "An invalid state can't be written even by a buggy caller."],
            ["`runs`", "index `(status, enqueued_at)`", "Recovery scan for queued runs that were never picked up."],
            ["`runs`", "index `(status, heartbeat_at)`", "Recovery scan for running runs whose lease expired."],
            ["`run_events`", "`bigint GENERATED ALWAYS AS IDENTITY`; index `(run_id, id)`", "The ID doubles as the SSE event ID, so replay is `WHERE run_id = ? AND id > ?` in order."],
            ["`agent_steps`", "`UNIQUE (run_id, attempt, index)`", "Steps are numbered per attempt, so a retried attempt can't collide with the one it replaced."],
            ["`tool_calls`", "`CHECK` on `status` (`succeeded`, `failed`, `rejected`); index `(run_id)`", "Rejected (disallowed or invalid) calls are recorded, not dropped."],
            ["`api_keys`", "`UNIQUE (key_hash)`", "Keys are stored only as SHA-256 digests and looked up by digest."],
            ["`chunks`", "`UNIQUE (document_id, index)`; HNSW cosine index on `embedding`", "Ordered chunks per document; approximate nearest-neighbour search in pgvector."],
          ],
        },
        {
          type: "p",
          text: "The postgres tool server connects through `agent_mesh_readonly`, a `NOLOGIN` role with `SELECT` on runs, events, steps, tool calls, documents and chunks. It has no grant on `api_keys`. A login user inherits from it, queries run in read-only transactions with a statement timeout.",
        },
      ],
    },
    {
      id: "api",
      title: "API behavior",
      blocks: [
        {
          type: "p",
          text: "Every endpoint except `/health`, `/ready` and `/metrics` needs an API key, as a bearer token or `X-API-Key`. Request bodies reject unknown fields. Run listing uses a keyset cursor over `(created_at, id)`, not offsets.",
        },
        {
          type: "code",
          label: "HTTP",
          caption: "Captured from the Compose stack, from docs/api-examples.md. IDs shortened.",
          code: `POST /runs
Authorization: Bearer am_…
Content-Type: application/json

{"workflow": "workspace_summary", "input": {"path": "sample-project"}}

HTTP/1.1 202 Accepted
location: /runs/c8767189-…
x-request-id: 5cef92d18c824915b698dbe2c6ce7a16
x-ratelimit-limit: 60
x-ratelimit-remaining: 59

{"id": "c8767189-…", "workflow": "workspace_summary", "status": "queued",
 "attempts": 0, "cancel_requested": false, "result": null, "error": null, …}`,
        },
        {
          type: "code",
          label: "SSE",
          caption: "Live progress. Reconnect with Last-Event-ID (or ?after=) to receive exactly the later events.",
          code: `GET /runs/c8767189-…/events

id: 1212
event: run.started
data: {"type": "run.started", "data": {"status": "running", "worker_id": "…"}}

id: 1213
event: run.step
data: {"type": "run.step", "data": {"index": 0, "attempt": 1,
       "tool_calls": [{"name": "filesystem__list_directory", "status": "succeeded"}]}}

id: 1215
event: run.completed
data: {"type": "run.completed", "data": {"status": "completed", "iterations": 2}}`,
        },
        {
          type: "table",
          caption: "Error responses",
          columns: ["Status", "When"],
          rows: [
            ["`401`", "Missing or invalid API key (`WWW-Authenticate: Bearer`)."],
            ["`404`", "Unknown run ID."],
            ["`409`", "Cancelling a run that is already terminal."],
            ["`422`", "Unknown workflow, input that fails the workflow's schema, unknown fields, or a malformed cursor."],
            ["`429`", "Per-key rate limit exceeded; includes `Retry-After`."],
            ["`503`", "Queue unavailable at creation (the run is recorded as `failed`), or `/ready` when Postgres or Redis is unreachable."],
          ],
        },
        {
          type: "p",
          text: "The SSE endpoint subscribes before it replays, treats each Redis pub/sub message only as a wake-up, and always reads new events from Postgres in ID order. A dropped or reordered publish can delay an event but can't create a gap. It also polls as a fallback and closes after the terminal event.",
        },
      ],
    },
    {
      id: "failures",
      title: "Failure handling and retries",
      blocks: [
        {
          type: "table",
          columns: ["Failure", "What happens"],
          rows: [
            ["Publish fails after the run is committed", "Run marked `failed`, client gets `503`."],
            ["API dies between commit and publish", "Workers re-publish `queued` runs older than the stale threshold (300 s)."],
            ["Duplicate queue message", "The conditional claim lets one worker win; the others leave their message pending until the run is terminal."],
            ["Worker dies mid-run", "Its heartbeat stops. After the 30 s lease the run is requeued, or failed once out of attempts (3) with the last error kept. Idle pending messages are taken over with `XAUTOCLAIM`."],
            ["A stalled worker wakes up after being replaced", "Its writes are fenced on `attempts` and match no rows."],
            ["Exception escapes the agent", "Requeued with exponential backoff (2 s doubling, 60 s cap), then failed and dead-lettered after the last attempt."],
            ["Tool error, timeout, bad arguments or disallowed tool", "Returned to the model as an error observation and recorded on the step. Never crashes the run."],
            ["Model provider error", "Typed errors (`llm_rate_limited`, `llm_unavailable`, …) become the run's error code."],
            ["stdio tool server dies", "Detected on the next call and restarted in the background."],
            ["`SIGTERM`", "Worker stops reading, lets active runs finish within 30 s, then abandons the rest. Their leases expire and another worker picks them up."],
          ],
        },
      ],
    },
    {
      id: "authorization",
      title: "Authorization and tool isolation",
      blocks: [
        {
          type: "list",
          items: [
            "**API keys** are random `am_…` tokens stored only as SHA-256 digests, verified per request with a 30-second in-process cache. Each run records which key created it.",
            "**Rate limiting** is a fixed window per key in Redis, returning `429` with `Retry-After`. It fails open if Redis is down, a deliberate availability-over-enforcement choice listed as a residual risk.",
            "**Workflow allowlists.** A workflow can only call the tools it names; anything else is recorded as `rejected`.",
            "**Filesystem** access is read-only and confined to the workspace; hidden files such as `.env` and `.git` are unreachable.",
            "**Web fetching** only reaches public addresses, and every redirect is re-validated.",
            "**GitHub and Slack writes** are off unless explicitly enabled, and can be limited to listed repositories and channels.",
          ],
        },
      ],
    },
    {
      id: "observability",
      title: "Observability",
      blocks: [
        {
          type: "p",
          text: "One OpenTelemetry trace follows a run across processes. The trace context travels inside the Redis message as `traceparent`, so the worker's spans join the API request's trace. Spans carry metadata only (model, token counts, tool name and status), never prompts or tool output.",
        },
        {
          type: "code",
          label: "Trace",
          code: `POST /runs (api) → queue.publish → run.handle (worker) → run.execute
                                   ├─ llm.complete
                                   └─ tool filesystem__list_directory → MCP tools/call`,
        },
        {
          type: "list",
          items: [
            "**Metrics** (`agent_mesh_*`): queue wait, run duration, runs finished by status, retries by reason, dead letters, queue length and pending, LLM latency and errors, tool latency and timeouts, auth failures and rate-limited requests.",
            "**Logs** are one JSON object per line with `request_id`, `run_id`, `trace_id` and `span_id`. A validated `X-Request-ID` is echoed back and carried to the worker.",
            "**Health**: `/health` for liveness; `/ready` checks Postgres and Redis and returns `503` with per-dependency detail when degraded or draining.",
          ],
        },
      ],
    },
    {
      id: "outcomes",
      title: "What it demonstrates",
      blocks: [
        {
          type: "facts",
          items: [
            { value: "150", label: "test functions: unit tests, plus integration tests against real Postgres and Redis via testcontainers", source: "code" },
            { value: "recall@3 0.923", label: "on the retrieval eval set (13 questions over 8 documents); CI fails below 0.9", source: "repo-docs" },
            { value: "~76 runs/s", label: "200 runs at concurrency 25 on a laptop with the scripted model; p95 end-to-end 0.57 s", source: "repo-docs" },
          ],
        },
        {
          type: "p",
          text: "The load-test numbers measure orchestration overhead only. With a real model, throughput is bounded by the provider. The retrieval eval set is small and fixed; it catches regressions, not general retrieval quality. CI runs ruff, strict mypy, the test suite and the retrieval gate.",
        },
      ],
    },
    {
      id: "limitations",
      title: "Tradeoffs and limitations",
      blocks: [
        {
          type: "list",
          items: [
            "**Single tenant.** Any valid key can read any run. `created_by_key_id` exists for audit, but reads aren't scoped by it. The threat model says so explicitly.",
            "**Run creation isn't idempotent.** A client that times out and retries `POST /runs` creates a second run, and pays for a second set of model calls.",
            "**Revocation delay.** A revoked key keeps working for up to 30 seconds on each API process because of the verification cache.",
            "**Fail-open rate limiting.** If Redis is unreachable, requests are allowed.",
            "**Slow recovery paths.** A run whose publish was lost waits for the 300-second stale-queued sweep. A retry's backoff is an in-memory timer, so if that worker dies, the same sweep is what recovers the run.",
            "**Footprint.** Locally it's three application processes, two datastores and three observability services. Redis needs AOF persistence for the queue to survive restarts.",
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
          tone: "evidence",
          title: "How to read this section",
          text: "The repository documents what the system does and the constraints it was built under, not every reason behind each choice. What follows is a present-day design review of that system, not a reconstruction of past motives.",
        },
        { type: "h3", text: "What the system does now" },
        {
          type: "list",
          items: [
            "**Postgres already owns execution state.** Status, attempts, the lease (`worker_id`, `heartbeat_at`, `deadline_at`), the event log and every step live in Postgres. Claims, fencing and recovery decisions are all conditional `UPDATE` statements in Postgres.",
            "**Redis carries delivery, wake-ups and counters.** Redis Streams holds a message per run that the worker treats as a hint, pub/sub wakes SSE streams, and rate-limit counters live there.",
            "**Recovery exists twice.** Redis tracks pending messages and reclaims idle ones with `XAUTOCLAIM`. Postgres separately finds expired leases and stale queued runs and re-publishes them. The Postgres path is the one that must be correct; the Redis path speeds it up.",
            "**Three application processes.** API, worker, and an MCP gateway that hosts the postgres, vector and web tools plus the embedding model. The API calls the gateway for `/documents`, which returns `503` when the gateway is down. The gateway's postgres tool reads the application database through the read-only role.",
          ],
        },
        { type: "h3", text: "Constraints worth preserving" },
        {
          type: "list",
          items: [
            "**The gateway split is a trust boundary.** The threat model depends on tool processes never holding API secrets, on the web tool running where it can't reach internal services, and on database tools using a separate least-privilege role. That is not a service boundary I would undo.",
            "**API and worker have different workloads.** Short, latency-sensitive HTTP versus long-running jobs with their own concurrency limit and drain behavior. Keeping them as separate processes from one codebase and image costs little.",
            "**At-least-once delivery with a race-safe claim.** The conditional-update state machine and attempt fencing are what make duplicate delivery harmless. Any redesign has to keep them.",
          ],
        },
        { type: "h3", text: "Limitations the evidence supports" },
        {
          type: "list",
          ordered: true,
          items: [
            "**Two sources of delivery truth.** The commit-then-publish sequence has a window where a run exists without a message, closed only by a 300-second sweep. Backoff before a retry is an in-memory timer covered by the same sweep. Every recovery behavior has to be reasoned about in both Redis and Postgres.",
            "**Duplicate runs on client retry.** There is no idempotency key on `POST /runs`.",
            "**Reads aren't scoped to a principal.** The creating key is recorded but never checked.",
            "**Operational surface for the scale it targets.** For a single team, a second stateful datastore that must be persisted, backed up and monitored is real cost. Model latency, not queue throughput, bounds real workloads.",
          ],
        },
        { type: "h3", text: "Proposed redesign" },
        {
          type: "note",
          tone: "proposal",
          title: "Proposal, not implemented",
          text: "Nothing below exists in the repository. It is the design I would move toward, with its costs stated.",
        },
        {
          type: "p",
          text: "**1. Make Postgres the queue.** The run row already is the job. Add `available_at` and claim with `FOR UPDATE SKIP LOCKED`, keeping the existing status guard and attempt increment. Creating a run and enqueueing it become one transaction, which removes the commit/publish window and the stale-queued sweep. Backoff becomes `available_at = now() + delay`, which survives a worker crash. Wake-ups use `NOTIFY` inside the transaction (delivered on commit) with polling as the fallback, the same pattern the SSE endpoint already uses for events.",
        },
        {
          type: "code",
          label: "SQL",
          caption: "Illustrative claim query for the proposed design.",
          code: `WITH next AS (
  SELECT id FROM runs
  WHERE  status = 'queued' AND available_at <= now()
  ORDER  BY available_at
  LIMIT  1
  FOR UPDATE SKIP LOCKED
)
UPDATE runs r
SET    status = 'running', attempts = r.attempts + 1,
       worker_id = :worker_id, heartbeat_at = now(),
       deadline_at = now() + :run_timeout
FROM   next
WHERE  r.id = next.id
RETURNING r.*;`,
        },
        {
          type: "p",
          text: "**Cost:** queue polling and claims now compete with application writes on the same database, and each `LISTEN` needs a dedicated connection per process. At the throughput this system targets, that is a good trade. If claim contention ever shows up in queue-wait latency, Redis can return as a pure accelerator in front of a Postgres queue that stays authoritative.",
        },
        {
          type: "p",
          text: "**2. Idempotent run creation.** Accept an `Idempotency-Key` header. Store `(key_id, idempotency_key, request_hash, run_id)` with a primary key on the first two columns, inserted in the same transaction as the run. The same key and body returns the original run; the same key with a different body returns `409`. Concurrent duplicates are settled by the unique constraint, not by application code. The [illustrative demo](/demo/idempotency) on this site shows the request-level behavior.",
        },
        {
          type: "p",
          text: "**3. Scope reads to a principal.** Introduce a project (or tenant) that keys belong to, add `runs.project_id`, and make the repository layer require it on every read. Cross-project reads return `404`, not `403`, so run IDs don't leak existence.",
        },
        {
          type: "p",
          text: "**Unchanged:** the gateway process, the read-only database role, the event log and SSE replay, attempt fencing, and the API/worker split.",
        },
        { type: "h3", text: "Migration and verification" },
        {
          type: "list",
          ordered: true,
          items: [
            "**Additive schema.** Add `available_at` (backfilled from `enqueued_at`) and an index on `(status, available_at)`. No reader depends on it yet.",
            "**Run both delivery paths.** Put the Postgres claimer behind a flag while the API keeps publishing to Redis. The conditional claim already guarantees one winner per attempt, so a run can't execute twice when both paths deliver it. That existing invariant is what makes the overlap safe.",
            "**Compare before cutting over.** Watch `agent_mesh_run_queue_wait_seconds` p95, runs finished by status, retries by reason and dead letters on both paths, and rerun `make loadtest` at the documented settings.",
            "**Remove the Redis path.** Drop `XADD`, `XAUTOCLAIM`, the stale-queued sweep and the dead-letter stream. A failed run already keeps its last error. Keep Redis for rate limits until those move or are accepted as fail-open.",
            "**Idempotency and scoping.** Add the idempotency table with the header optional, then document it. For tenancy: backfill a project per existing key, make `project_id` `NOT NULL`, then enforce it in queries.",
          ],
        },
        {
          type: "p",
          text: "**Tests that would gate each step:** retarget the existing resilience and worker end-to-end suites at the Postgres claimer. Add a test that N workers draining M runs produce exactly one `run.started` event per attempt, one that a run is claimable immediately after `POST /runs` commits, one that a worker killed during backoff doesn't delay the retry past `available_at`, one where concurrent `POST /runs` calls with the same key create exactly one run, and one where a key from another project gets `404` on every run endpoint.",
        },
      ],
    },
  ],
};
