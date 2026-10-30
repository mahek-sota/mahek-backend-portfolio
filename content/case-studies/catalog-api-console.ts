import type { CaseStudy } from "../types.ts";

export const catalogApiConsole: CaseStudy = {
  slug: "catalog-api-console",
  title: "A safe, server-side console over a library catalog API",
  summary:
    "An internal tool that replaces hand-written curl calls against the library system's REST API: credentials and tokens stay on the server, writes are blocked by default, borrower links are stripped before anything reaches the browser, and a mock mode mirrors the API's quirks.",
  status: "Internal tool",
  context: "University of Mississippi Libraries",
  role: "Designed and built it",
  period: "2026",
  topics: ["OAuth client credentials", "Single-flight token refresh", "Fail-safe proxying", "Contract-faithful mocks"],
  stack: ["TypeScript", "Next.js 15 (route handlers)", "React 19", "TanStack Query", "zod", "Vitest"],
  evidence: {
    label: "Verified against code and tests",
    text: "Checked against the source, and the test suite was run for this page: 174 tests, all passing. The code is private; hostnames, credentials and catalog records are left out.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "The library's integrated library system (Sierra) has a REST API for bibliographic and item records. Looking a record up meant writing curl commands by hand: get an OAuth token, remember the range syntax, build JSON query bodies, and decode a response full of fixed-field codes. That's slow, easy to get wrong, and it puts a client secret on whoever's laptop is running the commands.",
        },
        {
          type: "p",
          text: "The tool turns those lookups into forms: lookups by ID, ID list, ID range and dates; keyword search; a visual builder for the API's JSON query language; and results with a column picker, a detail view, CSV and JSON export, and \"copy as curl\". It supports exactly what the API key's roles allow: bibs and items, read-only.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I designed and built it. Everything the current key's roles can reach is implemented; the rest is listed as out of scope until those roles are granted.",
        },
      ],
    },
    {
      id: "boundary",
      title: "The browser never talks to the catalog",
      blocks: [
        {
          type: "diagram",
          title: "Request path",
          provenance: "Reconstructed from the source code. The catalog host is left out.",
          rows: [
            { nodes: [{ label: "Browser", detail: "forms · query builder · results", kind: "client" }], edge: "/api/sierra/* (same origin)" },
            {
              nodes: [{ label: "Next.js route handler", detail: "write gate · timeouts · error normalization · borrower-link stripping", kind: "process" }],
              edge: "bearer token (server memory only)",
            },
            { nodes: [{ label: "Token manager", detail: "client credentials · refresh 60 s early · single flight", kind: "process" }], edge: "HTTPS" },
            { nodes: [{ label: "Sierra REST API", kind: "external" }] },
          ],
        },
        {
          type: "list",
          items: [
            "**Server-only configuration.** The base URL, client key and secret are read from server environment variables and validated with zod at startup. None of them are exposed to the client bundle; the browser only ever learns the host for display.",
            "**Writes blocked by default.** Anything that isn't a read is refused before it leaves the server unless writes are explicitly enabled. The API's JSON search is a `POST`, so the gate is defined by what an endpoint does, not by HTTP method: `POST /{type}/query` counts as a read.",
            "**Borrower links never reach the browser.** Item records can carry a fixed field linking to the last borrower. The proxy removes those entries from every response outright, rather than masking them, so a \"[redacted]\" cell can't end up in a CSV export.",
            "**Logs are redacted by key name.** Tokens, Basic auth, the secret and patron-identifying fields are stripped before anything is logged, so redaction keeps working as response shapes change.",
          ],
        },
      ],
    },
    {
      id: "tokens",
      title: "Tokens: refresh early, refresh once",
      blocks: [
        {
          type: "p",
          text: "The token manager obtains a bearer token with OAuth client credentials and keeps it in server memory. It treats a token as stale 60 seconds before it actually expires, so a request never starts with a token about to lapse. When several requests arrive during a refresh, they all await the same in-flight promise instead of each fetching their own.",
        },
        {
          type: "code",
          label: "TypeScript",
          caption: "Single-flight token refresh (from the source).",
          code: `async getToken(): Promise<string> {
  if (this.isFresh()) return this.cached!.token;
  if (this.inFlight) return this.inFlight;

  this.inFlight = this.fetchToken()
    .then((t) => { this.cached = t; return t.token; })
    .finally(() => { this.inFlight = null; });

  return this.inFlight;
}`,
        },
        {
          type: "p",
          text: "If the API still answers `401`, because a token was revoked or expired early, the client invalidates the cache, fetches a new token and retries exactly once. Tests cover concurrent refresh, the early-refresh skew, the `401` path and recovery after a failed refresh.",
        },
      ],
    },
    {
      id: "api-shape",
      title: "Working with the API's actual behavior",
      blocks: [
        {
          type: "list",
          items: [
            "**Timeouts sized per endpoint.** Every request has an abort timeout. JSON queries scan rather than use an index, so they get 120 seconds; keyword search and MARC get 60; plain lookups get less.",
            "**\"No results\" is not an error.** The API answers an empty list with a `404` and a specific error code. On list reads the proxy turns that into an empty result with a marker, so the UI shows \"nothing matched\" instead of an error.",
            "**Errors keep their detail.** The API's error fields pass through unchanged, with a plain-English hint per error code added. Gateway errors and HTML error pages are truncated instead of dumped into the UI.",
            "**Fetch-all by ID cursor, not offset.** Exporting every match walks an open-ended ID range (`id=[cursor,]`) page by page, capped at 50 pages, rather than using offsets.",
            "**Deleted records stay visible.** Lookups always request the deleted markers, because a narrow field list would otherwise hide that a record was deleted.",
          ],
        },
      ],
    },
    {
      id: "query-builder",
      title: "A query builder that can't produce an invalid body",
      blocks: [
        {
          type: "p",
          text: "The API's JSON query language nests conditions inside `queries` arrays, with `and`/`or` strings placed **between** operands. That's easy to get wrong by hand. The builder models a query as a tree of groups (each with one join) and conditions (a field, MARC tag or special field, an operator, and its operands), and generates the body by recursion.",
        },
        {
          type: "code",
          label: "TypeScript",
          caption: "Placing the join between each pair of children (from the source).",
          code: `const kids = n.children.filter(Boolean);
if (kids.length === 0) throw new QueryBuildError("A group must contain at least one condition.");
if (kids.length === 1) return buildNode(kids[0]);
const queries: unknown[] = [];
kids.forEach((child, i) => {
  if (i > 0) queries.push(n.join);
  queries.push(buildNode(child));
});
return { queries };`,
        },
        {
          type: "p",
          text: "Hand-edited JSON is checked by a structural validator: operands and joins must alternate, each target must name exactly one kind of field, and cycles are rejected while a shared sub-query is still allowed. The live preview uses a non-throwing variant, so the UI shows the problem instead of crashing.",
        },
      ],
    },
    {
      id: "mock",
      title: "A mock that behaves like the real thing",
      blocks: [
        {
          type: "p",
          text: "Running without credentials uses a mock mode that intercepts requests before any token or network call. The mock reproduces the parts of the API that the UI depends on: the response envelope, field projection, ID ranges, the shape of deleted records, the `404` for an empty list, and a small artificial delay. Fixtures are synthetic. That lets the whole UI be developed and tested without touching production, and without anyone holding the secret.",
        },
        {
          type: "facts",
          items: [{ value: "174", label: "tests across 13 files, all passing when run for this page", source: "code" }],
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
          text: "The credential boundary is the strongest part. These changes would make the proxy as deliberate as the token handling.",
        },
        {
          type: "h3",
          text: "1. Put the proxy behind identity and an allowlist",
        },
        {
          type: "p",
          text: "The proxy forwards any path to the API using the server's key. That's fine for a tool on a trusted internal host, and the write gate and role limits bound the damage. Before it serves a wider audience, I'd add sign-in in front of the route and replace the catch-all with an explicit list of the endpoints the UI uses.",
        },
        {
          type: "h3",
          text: "2. Treat retries and rate limits as part of the client",
        },
        {
          type: "p",
          text: "Only `401` is retried today. I'd add bounded backoff for `429` and `5xx` on reads, and throttle fetch-all, which currently pages as fast as the API answers.",
        },
        {
          type: "h3",
          text: "3. Test the seams, not just the units",
        },
        {
          type: "p",
          text: "The 174 tests cover the pure modules thoroughly: serialization, the query builder, tokens, redaction, the mock. The request client and the two route handlers, where those pieces meet, have none. I'd add tests that drive the route handler against the mock: the write gate, the empty-list translation and borrower-link stripping end to end.",
        },
        {
          type: "h3",
          text: "4. Make the mock cover what the builder can produce",
        },
        {
          type: "p",
          text: "The mock evaluates single conditions, but nested `and`/`or` queries return `501`. Since the builder's main job is nested queries, I'd extend the mock's evaluator so those can be developed and tested without credentials too.",
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
            "Read-only by design, and limited to the record types the API key's roles allow.",
            "The token cache is per process, which is fine for a single internal instance.",
          ],
        },
      ],
    },
  ],
};
