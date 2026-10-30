import type { CaseStudy } from "../types.ts";

export const researcherExplorer: CaseStudy = {
  slug: "researcher-explorer",
  title: "A co-authorship graph explorer behind a rate-limited API",
  summary:
    "Expanding a researcher's collaboration network up to three hops, when every new person means paging through their whole publication history on a public API with a strict rate limit, and the same person often appears under several IDs.",
  status: "Production",
  context: "University of Mississippi",
  role: "Built the backend and frontend",
  period: "2026",
  topics: ["Graph expansion", "Caching a slow upstream", "Rate limiting", "Identity resolution"],
  stack: ["Python", "FastAPI", "SQLAlchemy", "PostgreSQL", "Alembic", "React", "TypeScript"],
  evidence: {
    label: "Verified against code",
    text: "Behavior and defaults here were checked against the source. The code is private, so the snippets are simplified, and institution identifiers, deployment details and real researchers are left out. The [illustrative demo](/demo/collaboration-graph) runs the same expansion rules on fictional data.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "Staff wanted to see who on campus works with whom: search for a researcher, see their co-authors, and keep expanding outward. The data comes from OpenAlex, a public scholarly database. Author records are easy to fetch, but co-authorship isn't stored on them. To learn who someone has worked with you page through every work they've published and tally the other authors.",
        },
        {
          type: "p",
          text: "That makes one graph expansion expensive. Three hops out from a prolific researcher can mean crawling the publication histories of hundreds of people, against an API that asks clients to stay around ten requests a second. On top of that, OpenAlex often splits one real person across several author IDs, so a naive graph shows the same person two or three times.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I built it end to end: the import pipeline, schema, API and the React graph UI. It's in production, with name search across about 6,900 researcher profiles.",
        },
      ],
    },
    {
      id: "architecture",
      title: "What lives where",
      blocks: [
        {
          type: "diagram",
          title: "Two data paths with different freshness needs",
          provenance: "Reconstructed from the source code. Deployment topology is left out.",
          rows: [
            {
              nodes: [{ label: "OpenAlex", detail: "authors · works", kind: "external" }],
              edge: "importer: cursor paging · pre-warm: rate-limited crawl",
            },
            {
              nodes: [
                { label: "JSONL snapshot", detail: "raw author records, source of truth", kind: "store" },
                { label: "Collaborator crawl", detail: "tally co-authors across all works", kind: "process" },
              ],
              edge: "batched upsert · cache write",
            },
            {
              nodes: [
                { label: "authors", detail: "typed columns + raw JSONB · trigram name index", kind: "store" },
                { label: "collaborators", detail: "cached edges · PK (author, collaborator)", kind: "store" },
              ],
              edge: "read",
            },
            {
              nodes: [{ label: "FastAPI", detail: "search · browse · expand · links", kind: "process" }],
              edge: "JSON",
            },
            { nodes: [{ label: "React + Cytoscape graph", kind: "client" }] },
          ],
        },
        {
          type: "list",
          items: [
            "**Author records are preloaded.** The importer cursor-pages every author for the institution, appends each raw record to a JSONL snapshot, then upserts in batches from a single writer. The database can be rebuilt from the snapshot without calling OpenAlex again.",
            "**Typed columns plus the raw record.** Names and counts are real columns, and topics and affiliations are their own tables, so they can be sorted, filtered and indexed (a trigram index serves partial name search). The full upstream record sits beside them in `JSONB` for the detail panel.",
            "**Co-authorship is cached, not preloaded.** Edges are fetched per person and stored in a `collaborators` table keyed by `(author_id, collaborator_id)`. A pre-warm job fills that table offline, so live requests normally never reach OpenAlex.",
          ],
        },
      ],
    },
    {
      id: "expansion",
      title: "Expanding the graph",
      blocks: [
        {
          type: "p",
          text: "Expansion is a breadth-first search, one level at a time. All the people on one level are resolved concurrently, and the next level is built from whoever was newly discovered. Each person is placed at the hop where they were first seen, so the UI can draw rings.",
        },
        {
          type: "code",
          label: "Python",
          caption: "The shape of the expansion (simplified from the repository).",
          code: `async def expand(db, root_id, depth=1, *, max_per_node=40):
    mm = get_merge_map(db)
    root = mm.canonical(root_id)
    if not author_exists(db, root):
        raise LookupError(root)                   # -> 404

    node_depth = {root: 0}
    frontier = [root]
    edges = {}                                    # frozenset({a, b}) -> weight
    for level in range(depth):
        results = await asyncio.gather(*[
            collaborators_in_dataset(db, n, max_per_node=max_per_node, mm=mm)
            for n in frontier
        ])
        next_frontier = []
        for n, collabs in zip(frontier, results):
            for c in collabs:
                key = frozenset({n, c.id})
                edges[key] = max(edges.get(key, 0), c.work_count)
                if c.id not in node_depth:
                    node_depth[c.id] = level + 1
                    next_frontier.append(c.id)
        frontier = next_frontier
    return build_payload(node_depth, edges)`,
        },
        {
          type: "table",
          caption: "Request limits and per-person rules",
          columns: ["Rule", "Value", "Why it matters"],
          rows: [
            ["Depth", "0–3 hops, validated at the route", "Bounds the crawl; each hop can multiply the number of people to resolve."],
            ["Per-person cap", "Default 40, accepted range 1–200", "Keeps a prolific researcher from flooding the graph. The strongest ties, by shared works, are kept."],
            ["Raw co-author pull", "Top 200 per person, before filtering", "Co-authors are filtered to the local dataset after the pull, so the net is cast wider than the cap."],
            ["Edge weight", "Number of shared works; the larger count wins", "Both people's lists can report the same pair, and an edge is stored once per unordered pair."],
            ["Unknown root", "`404`", "The root must be in the local dataset; anyone else is outside the graph's scope."],
            ["Upstream failure", "`502`", "A failed live fetch is reported as a gateway error, not a server bug."],
          ],
        },
        {
          type: "p",
          text: "A second endpoint, `GET /api/graph/links`, returns only the edges **among** a set of nodes already on screen and never adds new people. The UI uses it for \"connect visible\": after expanding several people separately, it fills in the links between them that each one's cap had hidden. It reads the cache sequentially on one session, fetches all the misses concurrently under a semaphore, then writes the results back one at a time.",
        },
      ],
    },
    {
      id: "identity",
      title: "Merging duplicate people without deleting anything",
      blocks: [
        {
          type: "p",
          text: "Upstream data routinely splits one person into several author IDs, often spelled differently, with only one of them carrying an ORCID. Deleting or rewriting rows would lose works and make the next import fight the cleanup. Instead, a merge map is computed at read time. It maps every fragment to one canonical ID and holds the combined counts, and the database rows stay exactly as imported.",
        },
        {
          type: "list",
          ordered: true,
          items: [
            "**Shared ORCID means same person.** Records sharing an ORCID form one cluster. The canonical ID is the record with the most citations, then works, then h-index.",
            "**Corrupt fragments don't inflate counts.** A record with works but zero citations and zero h-index is treated as a stub. It still maps to the person, so it never shows up separately, but it's excluded from the combined counts.",
            "**Two ORCID identities merge only on an exact first-name match.** Occasionally one person has two ORCIDs. Joining two established identities is the riskiest merge, so it requires the same spelled-out first name and compatible middle initials. \"Sara\" and \"Sarah\" stay apart.",
            "**Name variants fold in only when unambiguous.** A record without an ORCID joins an anchor when the surname matches, the first name or initials are compatible and no middle initial conflicts. It also has to be the **only** compatible anchor for that surname. A bare \"D. Ellis\" next to two different D. Ellises is left alone.",
            "**Counts are combined, not replaced.** Works and citations are summed across real fragments; h-index takes the maximum, because h-indexes don't add.",
          ],
        },
        {
          type: "table",
          caption: "How the name rule behaves (fictional names)",
          columns: ["Anchor (has ORCID)", "Candidate (no ORCID)", "Result"],
          rows: [
            ["Dana R. Ellis", "D. R. Ellis", "Merged: initials agree"],
            ["Dana R. Ellis", "Dana Ellis", "Merged: a missing middle initial isn't a conflict"],
            ["Dana R. Ellis", "Dana K. Ellis", "Kept apart: middle initials conflict"],
            ["Dana R. Ellis and David M. Ellis", "D. Ellis", "Kept apart: two compatible anchors, so it's ambiguous"],
          ],
        },
        {
          type: "p",
          text: "Every read path goes through the map. Search and browse hide fragment IDs and show combined counts. Fetching a fragment's ID returns the canonical person. In the graph, collaborators are remapped to canonical IDs before the cap is applied, so a duplicate can never take a second slot. Expanding a merged person unions the co-authors of their heaviest fragments, capped at six to bound the crawl.",
        },
      ],
    },
    {
      id: "rate-limits",
      title: "Staying under the rate limit",
      blocks: [
        {
          type: "list",
          items: [
            "**Pre-warm the cache offline.** A job crawls exactly the set of IDs the graph could ever ask for: every canonical person plus the fragments it would union. It skips IDs already cached, so it can be stopped and resumed, and `--force` refreshes everything. One failed person is logged and skipped instead of aborting the run.",
            "**Pace requests, not just count them.** A process-wide limiter spaces request start times at `1 / rate` (8 per second by default). Requests still overlap in flight; only their scheduling is serialized.",
            "**A `429` pauses everyone.** On a rate-limit response the client prefers the server's `Retry-After`, falls back to exponential backoff capped at 60 seconds, and adds up to a second of jitter. It then pushes the **shared** schedule forward rather than sleeping only itself, so queued requests wait out the cooldown together instead of retrying in lockstep. Concurrent `429`s take the later deadline instead of stacking.",
            "**Keep blocking work off the event loop.** Search, browse and detail routes only talk to Postgres, so they're plain `def` handlers that FastAPI runs in its threadpool; a slow query can't stall the graph requests sharing that worker.",
            "**Size the pool against the server.** With `N` workers the total connection count is `N × (pool + overflow)`; the defaults (10 + 5) leave room under Postgres's default of 100 connections for four workers.",
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
          text: "Design changes I'd make with what I know now. Each one tightens an assumption the first version made about the cache or the process model.",
        },
        {
          type: "h3",
          text: "1. Record that a fetch happened, separately from what it found",
        },
        {
          type: "p",
          text: "The cache uses the presence of edge rows to mean \"already fetched\". That conflates two questions: have we asked upstream, and what did it say? Someone whose co-authors all sit outside the dataset legitimately has no rows. I'd add a small `collaborator_fetches (author_id, fetched_at)` table, written in the same transaction as the edges. An empty answer is then a cached answer, and `fetched_at` gives the pre-warm job a real refresh policy instead of all-or-nothing `--force`.",
        },
        {
          type: "h3",
          text: "2. Make cache writes safe to run concurrently by construction",
        },
        {
          type: "p",
          text: "A cache refresh replaces a person's rows with delete-then-insert. Inside one worker process that sequence can't interleave, and pre-warming keeps writes off the live path. I'd still rather the write be correct regardless of how many processes run: an `INSERT … ON CONFLICT (author_id, collaborator_id) DO UPDATE` under a per-person transaction-level advisory lock, so concurrent refreshes serialize without depending on deployment shape.",
        },
        {
          type: "h3",
          text: "3. Give the expand route the same treatment as the others",
        },
        {
          type: "list",
          items: [
            "**Keep database calls off the event loop.** The author routes run in FastAPI's threadpool. The expand route has to be `async` because it awaits HTTP, so its synchronous database calls run on the loop. I'd move it to the async driver, or wrap those calls in `run_in_threadpool`.",
            "**Share one concurrency bound for live fetches.** The links endpoint bounds concurrent crawls with a semaphore. I'd have expand use the same one, so the limit on open crawls is a property of the process rather than of each endpoint.",
          ],
        },
        {
          type: "h3",
          text: "4. Move upstream fetching to one place",
        },
        {
          type: "list",
          items: [
            "**One process owns the upstream rate.** The limiter is per process, so the true ceiling scales with the worker count, a trade-off noted in the configuration. Rather than add a shared limiter service, I'd take fetching off the request path entirely: on a miss, return what's cached, mark the person as pending, and let the single pre-warm process, where the rate is exact, do the fetch.",
            "**Version the merge map.** It's built once per process, so picking up a new import means a restart. I'd have the importer write the map to a table with an import version, and have workers rebuild their copy only when that version changes.",
          ],
        },
        {
          type: "h3",
          text: "5. Pin the merge rules down with tests",
        },
        {
          type: "p",
          text: "A wrong merge is the most expensive mistake this system can make, because the result still looks plausible. I'd grow a table-driven suite from cases like the one above, covering name compatibility and the single-anchor rule, plus a property check that every fragment ID resolves to exactly one canonical ID.",
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
            "The values above are configuration defaults, not measured performance. I don't have load-test numbers for the expansion path to publish.",
            "Merge quality hasn't been measured against a labelled set of known duplicates. The rules are deliberately conservative, so they likely leave some duplicates unmerged rather than wrongly merging people.",
            "The [co-authorship graph demo](/demo/collaboration-graph) reproduces the expansion rules, cap, campus scoping, merging and cache on fictional data, in the browser.",
          ],
        },
      ],
    },
  ],
};
