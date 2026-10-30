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

## Scope (revised 2026-10-30)

The site is now deep dives only, to be sent alongside the resume and impact
document. Removed because they repeated those documents: the experience list,
education, focus areas, the "other code" repo list, the home-page summary
figures (50M+ records, −30%, 10K+ students), and the citation-verification
case study (every claim came from the impact document). The research
ingestion/discovery case study was replaced by a code-verified deep dive on the
researcher explorer. The home page links to the resume and impact document
(https://impact-doc.vercel.app/, supplied by the user) instead.

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

## Researcher explorer (`~/Desktop/um-work/researcher-explorer`, private; sole committer)

| Claim | Source |
|---|---|
| Production; ~6,900 profiles; subsecond name search | R |
| Period 2026 | C (first commit 2026-06-23, migration 2026-06-01) |
| Importer: cursor paging, JSONL snapshot, single-writer batched upsert | C (`importer.py`), D |
| Typed columns + raw JSONB; trigram name index; concepts/affiliations tables | C (migration 0001, `db_models.py`) |
| `collaborators` cache, PK (author_id, collaborator_id) | C (`db_models.py`, migration) |
| BFS per level with `asyncio.gather`; first-seen depth; edge = max count per unordered pair | C (`graph.py` `expand`) |
| depth 0–3, max_per_node default 40 range 1–200; 404 / 502 | C (`routes/graph.py`, `config.py`) |
| Raw pull top 200 before filtering | C (`_RAW_FETCH_CAP`) |
| Links endpoint: sequential cache reads, semaphore-bounded fetches, sequential writes | C (`internal_links`) |
| Merge rules (ORCID clusters, phantom exclusion, exact-first-name anchor union, single compatible anchor, summed works/citations, max h-index, 6 fetch members) | C (`merge.py`) |
| Name-rule table | Fictional names; outcomes traced through `_name_compatible` by hand |
| Read paths hide aliases / resolve canonical | C (`repository.py`, `routes/authors.py`) |
| Pre-warm: exact crawl set, resumable, `--force`, failures skipped | C (`prewarm.py`) |
| Limiter 8 rps default, 429: Retry-After else 2^n capped 60 s + ≤1 s jitter, shared pause with max() | C (`openalex.py`, `config.py`) |
| `def` routes run in threadpool; pool 10 + 5 | C (`routes/authors.py`, `config.py`) |
| What I'd change: no tests; empty results uncached; delete+insert PK race across workers → 502; expand blocks loop and has no semaphore; per-process limiter (acknowledged in config comment); merge map never reset (`reset_cache` unused) | C; present-day assessment |
| Not published | Institution ID/name filter value, hostnames, Windows/IIS deployment, real names in merge examples |

## Finance tracker (`mahek-sota/modular-finance-tracking-system`, public; 3 commits by the user)

| Claim | Source |
|---|---|
| Modules, unit of work in `get_session`, repositories only flush | C (`app/core/db.py`, `app/modules/*`) |
| NUMERIC(18,4)/(18,8), CHAR(3), Decimal validation, `parse_float=Decimal` | C (migrations, schemas, `currency/rate_provider.py`) |
| `quantize_money` half-up 2 dp, Money serialized as string | C (`app/core/money.py`) |
| Version-keyed report cache, INCR on transaction writes and category delete, version 0 default | C (`app/core/cache.py`, `reporting/service.py`, `tracking/service.py`) |
| Rate tiers, TTL 1 h latest / 7 d historical, 422/502 | C (`currency/service.py`, `rate_provider.py`) |
| Budget half-open month, same-currency only, `spent > limit` | C (`budgets/service.py`) |
| 46 tests (27 unit, 19 integration), savepoint isolation | C (grep `def test_`; `tests/conftest.py`). Not run (needs Postgres/Redis) |
| What I'd change | Present-day assessment: bump before commit (README calls window sub-millisecond; entry persists to TTL), Redis errors fail writes, check-then-insert races, no CHECKs, PATCH null, weekend rate-date mismatch, float utilization, server-local month, unenforced module boundaries |
| README overstatements not repeated | "never serve a stale report", full module independence |

## DeFi tracker (`mahek-sota/defi-portfolio-tracker`, public)

Page describes committed HEAD (`5fa43f0`) only. The local value-over-time chart service, its route and 6 integration tests are uncommitted, so they are not on the page.

| Claim | Source |
|---|---|
| Four chains, static config upserted at boot, internal-transfer flag | C (`backend/src/config/chains.ts`, `src/db/chains.ts`) |
| `Promise.allSettled` fan-out, per-chain DB transaction rollback | C (`src/services/ingest.ts`, `txIngest.ts`) |
| withRetry 4 attempts, 250 ms base, 4 s cap, full jitter; price retry only network/429/5xx; receipts 8 at a time | C (`src/util/retry.ts`, `src/pricing/alchemyProvider.ts`, `src/chain/transactions.ts`) |
| Redis 60 s → provider (batches of 25) → stale snapshot | C (`src/pricing/priceService.ts`) |
| NUMERIC(78,0)/(38,18), BigInt formatting, decimals 0–36, decimal.js precision 80 | C (migration, `src/domain/amount.ts`, `usd.ts`) |
| FIFO lots, proportional partial consumption, unknown cost → incomplete, 48 h price window, 50-token backfill cap | C (`src/domain/costBasis.ts`, `src/services/pnl.ts`) |
| 73 tests at HEAD | C (count of `it(`/`test(` in committed test files); agent ran 79 in working tree, all passing |
| Read-only, no signing code | C (grep of src and frontend) |
| What I'd change | Present-day assessment: totals include incomplete tokens (contradicts README), oversell realizes unmatched proceeds, sync in request with no timeouts, last_synced_block unused, gas only for value transfers, self-transfers, bridges |
| **Not published, tell user** | ethers error messages can include the RPC URL with the API key, which `withRetry` copies into API responses; no auth on delete/list endpoints; `rejectUnauthorized:false` for production DB TLS |

## Research ingestion collector (`~/Desktop/um-work/um-research-dashboard/data_collection_server`, private, uncommitted)

| Claim | Source |
|---|---|
| Entity types and sources | C (`extract.py`, `collector/*`) |
| Old Dimensions client fetched one 1,000-record page | C (docstring `collector/dimensions.py`); R2 `dimensions_client.py` |
| Task state, skip-if-fresh, resume running/failed, advisory lock | C (`collector/db.py`, `extract.py`) |
| Page upsert + checkpoint one transaction; ON CONFLICT upserts; authorship dedup per page | C (`collector/db.py`, `collector/openalex.py`) |
| Keyset paging and no-advance guard | C (`collector/dimensions.py`) |
| Completeness: expected from API, distinct rows by `last_seen_at`, 1% tolerance, exit 1 | C (`collector/db.py`, `extract.py`) |
| Skip paging 76% / 95%, keyset 100% | Run logs (25,486 and 31,832 of 33,675; then 33,675). Absolute counts not published |
| HTTP throttle 0.15 s / 2.1 s, 8 attempts, 5 s backoff doubling capped 300 s, +0–20% jitter, Retry-After floor | C (`collector/http.py`, `openalex.py`, `dimensions.py`) |
| Error-in-200, token refresh, heavy-field split retry, ≥100-author refetch | C (`collector/dimensions.py`, `openalex.py`) |
| Daily timer ±15 min, `--skip-if-fresh 160` | C (`deploy/um-extract.timer`, `um-extract.service`) |
| Status "In development" | Collector uncommitted; logs only from 2026-10-28/29, run locally |
| What I'd change | Present-day assessment: incomplete run resumes at end and fails again, tolerance invisible, aggregates rebuild after failures, no alerting, no stale-row retirement, no tests, API key in query string |
| Not published | Institution OpenAlex/GRID/ROR IDs, hostnames, `/opt` paths, service users, absolute counts, real author IDs |
| v2 (`um-research-info-dashboard`) | Not described: its checkpoints are never read and its "minutes–<1h" claim has no evidence |

## um-work additions (2026-10-30)

All private; behavior only. No names, hostnames, credentials, vendor figures or institution IDs published.

| Page | Source | Key verified claims | Not published |
|---|---|---|---|
| `catalog-api-console` | `~/Desktop/um-work/sierra-ui` (not a git repo) | Proxy route, zod server-only config, single-flight token with 60 s skew, one 401 retry, write gate treating `POST */query` as read, LPATRON stripping, per-endpoint timeouts, 404/107 → empty, id-cursor fetch-all capped at 50 pages, query-builder join placement, mock mode; **174 tests run, all passing** | Sierra hostname (`recording.md`, `docs/ENDPOINTS.md`), credentials in `.env.local`, record IDs in docs, key's role list |
| `lcsh-explorer` | `~/Desktop/um-work/keyword-recomender/v2` | Live id.loc.gov suggest, scoring 100/92/fuzzy, fallback A→B→C→D→local→semantic (<80), semantic proposals re-validated (accept ≥0.60), lazy optional model, 12-way fan-out under 20 s budget with plan-order reassembly, L1 24 h / L2 6 h / L3 1 h caches below ranking, NSSM + nginx, single worker | Docx/xlsx author metadata; README fallback order is wrong (code order used); "97%" claims omitted |
| `faculty-profiles` | `~/Desktop/um-work/faculty-data` (method1–5) | ORCID spine, affiliation-gated discovery, matched-author check for search candidates, source weights (`config.py`), Dimensions 69/150 & 32 single-paper (code comment), 194 unrelated papers (code comment), rarity band 20–300,000, depth × rarity, rank-interleaved budget, constrained LLM, 30 s Retry-After cap | All names/ORCIDs/outputs; **method3 has committed Scopus and Semantic Scholar keys in a public repo** |
| `collection-decisions` | `collection-usage-dashboard`, `collection-value`, `ill-acquisition-on-demand` | Content-based report detection, encodings, two-pass selection and month ownership, 417/417 and 6,824/6,848 (TESTING_NOTES.md), weights/bands/overrides (`config.yaml`), bounded Rule of Five, ISSN union-find, gzip+base64 single HTML; **41 + 39 tests run, all passing** | Vendor names, usage, invoices, royalty figures, staff names, personal email in `config.yaml` |
| HalluCheck | `~/Desktop/um-work/HalluCheck` | **Not published.** DOI verification can never succeed (author field bug), outages read as hallucinations, no tests; committed Semantic Scholar key and Google API key in history; named people's documents in history | Everything |
| university-collab-risk | — | Not published: sensitive subject (country-based review list); user to decide | — |

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
| Production, 2025 – present | I |
| No third party sees a submission; model downloaded once from Hugging Face, inference in-process | C (`package.json`, `moderation.js`), D (README) |
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
