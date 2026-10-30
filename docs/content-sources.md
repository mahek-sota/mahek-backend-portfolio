# Content sources and checklist (private)

Not published: nothing outside `app/` and `public/` is served. This file
records where each substantive claim on the site comes from, and what was
left out and why. Reviewed 2026-10-30.

Source keys:

- **R**: `Mahek_Sota_Resume.pdf` (dated 2026-09-10), text and link annotations.
- **I**: impact document, https://impact-doc.vercel.app/ (pages: overview,
  colleagues, work, prototypes, reliable-ai, tech-blogs; "last updated
  September 2026").
- **C**: public repository code, read directly.
- **D**: public repository documentation (README, docs/), not re-run.

## Profile and links

| Claim | Source |
|---|---|
| Email sotamahek@gmail.com | User instruction; R (mailto annotation) |
| GitHub https://github.com/mahek-sota | R annotation; I |
| LinkedIn https://www.linkedin.com/in/mahek-sota/ | R annotation (see discrepancy below) |
| Phone number | **Not published** (user instruction); removed from the public PDF |

## Home page

| Claim | Source |
|---|---|
| Software Engineer (Backend & AI), University of Mississippi, Jul 2024 – Present | R, I |
| Applications supporting 10K+ students and 100+ faculty | R ("applications supporting"); I ("serving"). Kept R's wording; not a claim of active users |
| Python/PostgreSQL/Kafka pipelines, 50M+ records, batching, delta sync, failure handling, observability, −30% ingestion latency | R; I |
| Go services on AWS EKS, GitHub Actions CI/CD, centralized logging, JWT, Redis-backed rate limiting | R |
| OpenAlex and Dimensions; subsecond search over ~6,900 researcher profiles | R ("6,900+"); I ("~6,900", "subsecond name search") |
| Citation pipeline runs on local models, nothing leaves the institution | I |
| Stealth startup internship details | R |
| USC Course Producer details | R |
| Ashtech internship: client-facing, accessible web and PayPal workflows, pytest and Jest | R |
| Education (degrees, dates) | R; I |
| modular-finance-tracking-system: NUMERIC(18,4), half-up rounding at boundaries, money as JSON strings | C (`app/core/money.py`, module models) |
| go-task-manager-api: stdlib net/http, status codes 201/204/400/404/405 | C (`main.go`) |
| openaq-kafka: one producer, four consumer services with their own group IDs | C (`backend/app/consumers/*`) |

## agent-mesh (repo `mahek-sota/agent-ai-platform`, commit 47c1961)

Personal project; sole contributor per the GitHub contributors API. Matches
R's "AI Agent Platform with MCP Integrations".

| Claim | Source |
|---|---|
| Processes, request path, offline scripted model, six workflows | C, D (README, docs/architecture.md) |
| State machine and allowed transitions | C (`runs/state.py`) |
| Conditional UPDATE transitions, attempt fencing, event row in same transaction | C (`runs/service.py`) |
| Delivery steps, recovery mechanisms, SIGTERM drain | D (architecture.md), C (`worker/executor.py`) |
| Defaults: heartbeat 5 s, lease 30 s, 3 attempts, backoff 2 s → 60 s cap, stale queued 300 s, drain 30 s, key cache 30 s, 60 req/min | C (`settings.py`), D (deployment.md) |
| Retry backoff is an in-memory timer covered by the stale-queued sweep | C (`_enqueue_later` in `worker/executor.py`) |
| Schema, FKs, CHECK constraints, unique constraints, indexes, HNSW params | C (migrations 0001–0004) |
| Read-only role and grants (no api_keys) | C (migrations 0002, 0003); `BEGIN READ ONLY` + statement timeout in `mcp_servers/postgres.py` |
| `rejected` status for disallowed tools and invalid args | C (`tools/base.py`) |
| API request/response and SSE examples | D (docs/api-examples.md, captured from Compose) |
| Error responses 401/404/409/422/429/503 | C (`api/runs.py`, `api/security.py`), D |
| Keyset cursor over (created_at, id); extra fields forbidden | C (`api/runs.py`) |
| SSE subscribe-then-replay, pub/sub as wake-up only | C (`api/runs.py`), D |
| Tracing, metrics, logs, `/ready` | D, C |
| 150 test functions | C (count of `def test_` under `tests/`) |
| recall@3 0.923, MRR 0.904, CI gate 0.9/0.8, 13 questions over 8 docs | D (architecture.md), C (`.github/workflows/ci.yml`) |
| ~76 runs/s, p95 0.57 s, 200 runs at concurrency 25, fake LLM, laptop | D (deployment.md). Not reproduced |
| Single tenant, revocation delay, rate limiter fails open, AOF note | D (threat-model.md, deployment.md) |
| No idempotency key on POST /runs | C (no such handling in `api/runs.py`; grep for "idempot" finds only ingestion) |
| "What I would change today": proposal | Present-day design assessment, framed as such on the page. Not implemented |

## Research data ingestion and discovery (production, private code)

| Claim | Source |
|---|---|
| Owned pipeline lifecycle (requirements → monitoring); delta sync, real-time streaming | I |
| 50M+ records, −30% latency | R, I |
| OpenAlex, Dimensions | R |
| Discovery explorer: co-authorship graph, name search, up to 3 hops, ~6,900, subsecond, weeks → minutes; FastAPI/React/TS/PostgreSQL/Docker | I; R |
| Cross-school platform: 100K+ records, 5+ years, −25% query time | I |
| 44.5K+ publications tracked | R; I (attributes to reporting dashboards; the page attributes it to reporting) |
| Identity collisions, inconsistent identifiers; 4 methods, 3 identity sources, in progress | I |
| Collaboration review tool framed as signal for human review | I |
| Usage analytics used for renewals/cancellations | I; R ("evidence-based collection decisions") |
| Conceptual diagram and many-to-many authorship relationship | Reconstruction, labelled as such |

## Citation verification (production, private code)

| Claim | Source |
|---|---|
| ~30 min manual review; naive approach produced confident hallucinations | I (reliable-ai) |
| 30 → 2 min | R, I |
| 10–30 faculty hours per semester | I |
| No paid APIs, Ollama, on-prem corpus, reviewer trust as budget | I |
| Seven stages | I (reliable-ai diagram) |
| Six failure modes; per-slice evaluation | I |
| ~12% routed to humans | I |
| Verifier doubled latency; order of improvements | I |

## Demos

Both are illustrative and labelled on the page.

- Idempotency demo: behavior verified by `tests/ledger.test.ts` and exercised
  in a browser.
- Co-authorship graph demo: fictional data (`lib/collab-data.ts`). Rules taken
  from `~/Desktop/um-work/researcher-explorer` (private): `backend/app/graph.py`
  (BFS, `depth` 0–3 enforced in `routes/graph.py`, per-node cap sorted by shared
  works, UM-only filter, canonical merge with summed work counts, edge weight =
  max), `backend/app/merge.py` (ORCID + name-variant anchor rule, nothing
  deleted), README (pre-warm job keeps OpenAlex off the request path; graph
  links endpoint). The "empty result isn't cached" note is from
  `repository.put_collaborators` / `get_cached_collaborators` (no rows → None).
  Not published: institution ID, hostnames, deployment details, real names.

## Care platform (`~/Desktop/personal-projects/cross-border-care-platform`, not public)

| Claim | Source |
|---|---|
| Done/not-started status | C (README status table; `app/worker/tasks.py` is a ping only) |
| `case_access_filter`, 403 for a role without a rule | C (`app/api/deps.py`) |
| 404 not 403; peer-coordinator and other-patient tests | C (`tests/test_rbac_cases.py`) |
| 15-min access JWT, 14-day refresh, rotation + revocation, idempotent logout | C (`app/core/config.py`, `app/services/auth.py`) |
| User loaded per request (role, `is_active`) | C (`app/api/deps.py`) |
| Registration always creates patient | C (`app/api/v1/auth.py`) |
| `record_event` stages on caller's session | C (`app/services/case_events.py`) |
| Partial index, trigram/GIN indexes, trigger-maintained search vector | C (migration 0001), D |
| 79 tests | C (15 + 27 + 37 `def test_`) |

## Letters Anonymous (`~/Desktop/um-work/letters-anonymous`, private)

| Claim | Source |
|---|---|
| Production, 2025 – present, zero third-party APIs | I |
| Two-stage moderation, waits for model, rejects on inference error | C (`moderation.js`) |
| Handler-level catch rejects | C (`server.js`) |
| Model never loads → rules-only approval, reported in health | C (`moderation.js` `initModeration`, `moderationStatus`) |
| Uniform 201 response, rejected stored with reason, admin views | C (`server.js`), D |
| Global then per-IP limiter | C (`server.js`). README says 5/min/IP; code defaults are 100/IP and 600 global (env-configurable), so no numbers are published |
| Schema | C (`schema.sql`) |
| "What I would change": pending in rules-only mode, constant-time compare, partial index | Present-day assessment from the code |

## Researcher Matchmaker (`~/Desktop/um-work/researcher-matchmaker`, private)

| Claim | Source |
|---|---|
| Prototype, dummy data, 28 profiles, zero dependencies | C (`package.json`, `backend/server.js` requires only node built-ins), D |
| Weights, normalization, tapering, 40% parent credit, committee eligibility, filter before scoring, team builder | D (README), spot-checked in `backend/engine/matcher.js` |
| 77 tests passing | C (ran `node --test` on 2026-10-30). README says 65, I says 46; used the verified count |
| 86% cap in an earlier version | D (README) |

## Omitted or unresolved

| Item | Reason |
|---|---|
| Citation extraction accuracy (R: 95%+; I: 80%+) | Sources disagree; neither more specific. Omitted |
| Citation classification precision (R: 98%; I: 95%) | Sources disagree. Omitted, along with I's "62% → 95%" progression that depends on it |
| Reliable-AI page headline metrics (28% → 3% hallucination, 420+ fixtures) and benchmark matrix | Scope unclear (matrix includes hosted models, while the citation system uses no paid APIs). Omitted |
| Microservices modernization: 99.999% uptime, −40% unauthorized requests, API gateway with RBAC (I only) | No measurement window or scope; not on the resume. Kept only R's description in Experience |
| Not a standalone case study: microservices modernization | Evidence is two sentences; not enough for a credible case study |
| Ashtech "40%" (R: latency; I: reliability) and "+20% satisfaction" | Sources disagree on what the 40% measures. Omitted |
| Friends for Inclusion title (R: Machine Learning Intern; I: Volunteer Engineer) | Disagreement; role left out of the short experience list (it remains in the PDF) |
| Location (R: Oxford, MS; I: San Francisco, CA) | Disagreement; not stated on the site (the PDF still shows R's) |
| LinkedIn (R: /in/mahek-sota/; I: /in/maheksota) | Used R's annotation as instructed. **Confirm which profile is current** |
| Cross-Border Care Platform: R says "implemented asynchronous document processing" and "500+ synthetic provider records" | Code has a ping-only Celery task and a seed of 4 providers. **Resume claim not supported by the code**; case study describes only what exists. Consider updating the resume |
| CI/CD Observability Platform (R) | Public repo exists but not reviewed in depth; not described |
| Institutional figures: 2.9M+ citations, $508M+ grant funding, 21.8K+ OA publications (I) | Institutional data; left out to avoid publishing institutional details |
| Notion case study "Observability for Non-Deterministic Systems" (linked from I) | Requires JavaScript; could not be read |
| Mentoring/workshops ("Helping Colleagues"), tech blog posts | Not needed for the backend focus; could be added later |
