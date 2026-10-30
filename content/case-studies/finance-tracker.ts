import type { CaseStudy } from "../types.ts";

const repo = "https://github.com/mahek-sota/modular-finance-tracking-system";

export const financeTracker: CaseStudy = {
  slug: "finance-tracker",
  title: "Money, currency and cache invalidation in a modular finance backend",
  summary:
    "A personal finance API split into four modules, where money never passes through a float, rounding happens only at the edges, and one Redis counter invalidates every cached report at once.",
  status: "Personal project",
  context: "Public repository",
  role: "Sole author",
  period: "2026",
  topics: ["Decimal money handling", "Version-keyed caching", "Unit of work per request", "Exchange-rate lookups"],
  stack: ["Python", "FastAPI", "SQLAlchemy 2.0 (async)", "PostgreSQL", "Redis", "Alembic"],
  evidence: {
    label: "Verified against code",
    text: `Checked against the [public repository](${repo}). The test count comes from the test files; I didn't rerun the suite for this page.`,
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "A finance tracker sounds simple: record income and expenses, report on them, set monthly budgets. The parts that are easy to get quietly wrong are money arithmetic, multiple currencies, and reports that stay fast without ever showing yesterday's numbers after a change. I built it to get those parts right, inside a structure where each feature could be read and changed on its own.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "A personal project I built alone. Done: tracking, reporting, currency conversion, budgets, Redis caching and a minimal UI over the API. There is no authentication; it's a single-user backend.",
        },
      ],
    },
    {
      id: "structure",
      title: "Structure",
      blocks: [
        {
          type: "p",
          text: "Four modules (tracking, reporting, currency, budgets) each own a router, service, repository and models. Dependencies point one way, from the API down to the database.",
        },
        {
          type: "list",
          items: [
            "**One unit of work per request.** A single dependency opens the session, commits if the handler succeeds and rolls back on any exception. Repositories only `flush()` to get IDs. They never commit, so a request that touches three tables either lands completely or not at all.",
            "**Shared session by dependency caching.** FastAPI resolves the session once per request, so every repository in that request joins the same transaction without passing it around.",
            "**Coupling through a constant, not an import.** Tracking invalidates reports and reporting reads them, but they share only a namespace name defined in `core/`, not each other's code.",
          ],
        },
      ],
    },
    {
      id: "money",
      title: "Money never touches a float",
      blocks: [
        {
          type: "table",
          caption: "Where precision is set",
          columns: ["Layer", "Representation"],
          rows: [
            ["Database", "`NUMERIC(18,4)` for amounts and budget limits; `NUMERIC(18,8)` for exchange rates; `CHAR(3)` currency codes"],
            ["Input", "`Decimal`, greater than zero, at most 18 digits and 4 decimal places, validated by Pydantic"],
            ["Exchange-rate parsing", "Provider JSON parsed with `parse_float=Decimal`, so a rate is never a float even for a moment"],
            ["Output", "Rounded once, to 2 places half-up, then serialized as a JSON **string**"],
          ],
        },
        {
          type: "code",
          label: "Python",
          caption: "The money boundary, from app/core/money.py in the repository.",
          code: `CENTS = Decimal("0.01")

def quantize_money(value: Decimal) -> Decimal:
    """Round to 2 decimal places, half-up — the explicit money rounding boundary."""
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)

# Render Decimal money as a string in JSON so precision is never lost to a float.
Money = Annotated[
    Decimal,
    PlainSerializer(lambda v: str(v), return_type=str, when_used="json"),
]`,
        },
        {
          type: "p",
          text: "Rounding happens at the boundary and nowhere else. A report computes net from the unrounded income and expense sums, then rounds the result; rounding each side first can be a cent off. Totals are grouped by currency and never added across currencies.",
        },
      ],
    },
    {
      id: "caching",
      title: "Invalidating every report with one write",
      blocks: [
        {
          type: "p",
          text: "Reports are expensive aggregations and change whenever a transaction does. Deleting the right cache keys on every write would mean knowing every report a transaction could appear in. Instead, every report key embeds a version number:",
        },
        {
          type: "code",
          label: "Python",
          caption: "Read-through cache keyed by version (simplified from the repository).",
          code: `version = await cache.get_version("reports")          # GET ver:reports, 0 if missing
suffix = ":".join(f"{k}={v}" for k, v in sorted(params.items()))
key = f"reports:v{version}:{kind}:{suffix}"

if (cached := await cache.get_json(key)) is not None:
    return Report.model_validate(cached)
result = await compute()
await cache.set_json(key, result.model_dump(mode="json"), ttl=300)
return result`,
        },
        {
          type: "list",
          items: [
            "**A write is one `INCR`.** Creating, updating or deleting a transaction, or deleting a category (which uncategorizes its transactions), increments `ver:reports`. Every old key becomes unreachable at once and expires on its own TTL. There's no `SCAN` and no per-report bookkeeping.",
            "**Over-invalidation on purpose.** Any write discards every cached report, including ones it couldn't have affected. A spurious miss just recomputes correct numbers; a missed invalidation shows wrong ones.",
            "**The starting version is chosen carefully.** A missing version key reads as `0`, and Redis initializes `INCR` on a missing key to `1`, so the very first write after a restart still moves readers to a new namespace.",
          ],
        },
      ],
    },
    {
      id: "currency",
      title: "Exchange rates",
      blocks: [
        {
          type: "list",
          items: [
            "**Three tiers.** A lookup checks Redis, then the database, then the provider (ECB reference rates via Frankfurter). Every fetched rate is written back to both.",
            "**History is immutable, today isn't.** A stored rate for a past date is trusted and cached for 7 days. \"Latest\" skips the database and is cached for an hour.",
            "**Errors keep their meaning.** An unsupported currency is a `422`; a provider outage is a `502`. Converting a currency to itself short-circuits with a rate of 1 and makes no call.",
          ],
        },
      ],
    },
    {
      id: "budgets",
      title: "Budgets",
      blocks: [
        {
          type: "p",
          text: "A budget is a monthly limit per category and currency, unique on that pair. Spending is summed over a half-open window, from the 1st up to but not including the next 1st, so the last day of a month is never counted twice or missed. Only expenses in the budget's own currency count. A budget is over only when spending exceeds the limit, and `remaining` is allowed to go negative so the overspend is visible.",
        },
      ],
    },
    {
      id: "testing",
      title: "Testing",
      blocks: [
        {
          type: "facts",
          items: [
            { value: "46", label: "tests: 27 service-level unit tests and 19 API-to-database integration tests", source: "code" },
          ],
        },
        {
          type: "p",
          text: "Unit tests run services against fake repositories, caches and rate providers. Integration tests drive the real app over HTTP against Postgres and Redis. Each test runs inside an outer transaction with SAVEPOINTs and is rolled back afterward, so the app's own commits stay inside the test's transaction. One integration test checks the core caching promise directly: a report changes after a transaction is added.",
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
          text: "Rereading the code, these are the places where the design is right in the common case but leans on an assumption I'd rather remove.",
        },
        {
          type: "h3",
          text: "1. Bump the cache version after commit, not before",
        },
        {
          type: "p",
          text: "The version is incremented inside the service, and the commit happens later at the request boundary. A report read in between recomputes from pre-commit data and caches it under the **new** version. That entry isn't just stale for the gap: it stays for the 300-second TTL. The README calls the window sub-millisecond and accepts it; I'd fix it instead, by moving the bump into an after-commit hook on the session, so the version can only move once the data it describes is visible.",
        },
        {
          type: "h3",
          text: "2. Treat Redis as an optimization",
        },
        {
          type: "p",
          text: "Cache calls aren't wrapped, so a Redis outage surfaces as a `500`. Because the version bump runs inside the write request, it also rolls back the transaction write. A cache shouldn't be able to block writes. I'd have reads fail open (compute and skip caching), and pair the after-commit bump with a short TTL as the backstop if the bump itself fails.",
        },
        {
          type: "h3",
          text: "3. Let the database enforce what it can",
        },
        {
          type: "list",
          items: [
            "**Uniqueness races.** Category names and budgets are checked for duplicates before inserting. Two concurrent requests can both pass the check; the unique constraint then rejects one, but as an unhandled `500`. I'd insert and translate the `IntegrityError` into the `409` the API already promises.",
            "**Invariants only in Pydantic.** Positive amounts and limits are validated at the API but not in the schema. I'd add `CHECK` constraints so a script or migration can't write what the API would reject.",
            "**Explicit nulls on PATCH.** A partial update with `{\"amount\": null}` passes validation and reaches a `NOT NULL` column. The update schema should reject nulls for required fields.",
          ],
        },
        {
          type: "h3",
          text: "4. Small correctness gaps in currency and budgets",
        },
        {
          type: "list",
          items: [
            "**Weekend dates miss the database tier.** For a weekend or holiday the provider returns the previous business day's rate, which is stored under that date. The lookup keeps asking for the requested date, so it never finds the stored row. I'd store the requested date alongside the effective one.",
            "**One float in the API.** Budget utilization is returned as a float percentage. It's display-only, but it's the one number in the API that breaks the strings-for-money rule.",
            "**Dates are server-local.** The default budget month comes from the server's clock; a user in another timezone sees the month change at the wrong time. The client should send the month.",
          ],
        },
        {
          type: "h3",
          text: "5. Enforce the module boundaries",
        },
        {
          type: "p",
          text: "The modules are separated by convention. Reporting and budgets read tracking's ORM models directly, which is a reasonable choice but an undeclared one. I'd make it explicit with an import-linter contract in CI: reporting and budgets may depend on tracking's models, nothing may depend on reporting, and core depends on no module.",
        },
      ],
    },
    {
      id: "limitations",
      title: "Limitations",
      blocks: [
        {
          type: "list",
          items: [
            "Single user, no authentication, and money is always rounded to 2 decimal places, which is wrong for currencies like JPY.",
            "The integration tests rely on seed data and share a Redis database, and the repository has no CI configuration.",
            "It's a learning-scale system, not a ledger. It records what you enter; it doesn't reconcile against a bank.",
          ],
        },
      ],
    },
  ],
};
