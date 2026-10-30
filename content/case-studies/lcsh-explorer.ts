import type { CaseStudy } from "../types.ts";

export const lcshExplorer: CaseStudy = {
  slug: "lcsh-explorer",
  title: "Mapping faculty keywords to library subject headings",
  summary:
    "A service that turns free-form research keywords into Library of Congress Subject Headings, call-number ranges and book suggestions, built on slow public APIs with a fallback chain, embeddings that must be confirmed by the authority, and caches that never store a ranking.",
  status: "In development",
  context: "University of Mississippi Libraries",
  role: "Designed and built the service",
  period: "2026",
  topics: ["Fallback chains", "Validating model output", "Layered caching", "Deadline-bounded fan-out"],
  stack: ["Python", "FastAPI", "sentence-transformers", "rapidfuzz", "NSSM + nginx (Windows)"],
  evidence: {
    label: "Verified against code",
    text: "Checked against the source. The code is private, so snippets are simplified. The caching and deployment work is recent and not yet committed. Faculty profiles in examples are synthetic.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "Faculty describe their research in their own words: \"computational social science\", \"cyber\", \"environmental justice\". Librarians buying books for those faculty work in Library of Congress Subject Headings (LCSH) and call-number ranges. Translating one into the other is skilled, slow, manual work, and a department can have dozens of faculty with several keywords each.",
        },
        {
          type: "p",
          text: "The service takes a list of keywords, or a CSV of faculty profiles, and returns for each keyword a heading, related headings and call-number letters, plus a call-number range for the whole profile and ranked book suggestions with the reason each one was chosen.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I designed and built it. The current version adds caching, environment-based configuration and an on-premises deployment as a Windows service behind nginx. That work is recent. There's no labelled evaluation set yet, so the quality claims on this page are about mechanisms, not measured accuracy.",
        },
      ],
    },
    {
      id: "matching",
      title: "Finding a heading: a chain of increasingly loose attempts",
      blocks: [
        {
          type: "p",
          text: "There is no local copy of LCSH. Headings come live from the Library of Congress suggest API, and candidates are ranked lexically: an exact match scores 100, a substring 92, and anything else the better of two fuzzy token scores. If the literal keyword returns nothing, the service tries progressively looser forms.",
        },
        {
          type: "table",
          caption: "Fallback order, as implemented",
          columns: ["Step", "What it tries", "Why"],
          rows: [
            ["A", "The keyword as written", "Most keywords already resemble a heading"],
            ["B", "Strip a suffix (\"…studies\", \"…research\")", "Faculty phrasing adds words headings don't use"],
            ["C", "Strip a weak prefix", "Same, at the front"],
            ["D", "A curated parent term", "Very specific terms have no heading of their own"],
            ["Local", "A small curated dictionary", "Known problem terms with a known answer"],
            ["Semantic", "Embedding search, only if nothing matched or the best score is under 80", "Catch meaning when spelling fails"],
          ],
        },
        {
          type: "p",
          text: "Every result records which step produced it, so a librarian can see at a glance whether a heading came from a direct match or from three steps of loosening.",
        },
      ],
    },
    {
      id: "validation",
      title: "The model proposes, the authority decides",
      blocks: [
        {
          type: "p",
          text: "The semantic step embeds the keyword with a small sentence-transformer and finds the nearest headings in a curated seed list. A model can easily suggest a heading that sounds right but doesn't exist. So each proposal is looked up again in the Library of Congress API, and it's kept only if the authority returns a heading whose normalized label matches it exactly. Only then is it accepted, and only above a 0.60 similarity threshold.",
        },
        {
          type: "code",
          label: "Python",
          caption: "Validating each embedding hit against the authority (simplified from the source).",
          code: `for label, sim in semantic_hits:                    # nearest seed headings
    label_norm = normalize_keyword(label)
    scored = attempt_lcsh_with_scored(label_norm, label_norm)   # ask id.loc.gov
    validated = choose_best(scored) if scored else None
    if validated and normalize_keyword(validated.label) == label_norm:
        accepted.append((validated, sim))               # the authority agrees

best = max(accepted, key=lambda a: a[1], default=None)
if best and best[1] >= SEMANTIC_ACCEPT_THRESHOLD:       # 0.60
    return best[0], "SEM"
return None, "none"`,
        },
        {
          type: "p",
          text: "The model is optional at runtime. It loads lazily on first use, and if the ML dependencies aren't installed the service logs it and keeps working with lexical matching only.",
        },
      ],
    },
    {
      id: "serving",
      title: "Serving on slow upstreams",
      blocks: [
        {
          type: "list",
          items: [
            "**Bounded fan-out with a deadline.** Book suggestions come from a de-duplicated plan of roughly 40–60 queries to Open Library and Google Books, run 12 at a time under a 20-second budget. When the budget runs out, the service ranks what has arrived rather than waiting on a straggler; the query plan is redundant by design.",
            "**Deterministic results despite concurrency.** Responses arrive in any order, so they're reassembled in plan order before ranking. Ties break the same way every time.",
            "**One pooled HTTP session** with retries on `429` and `5xx` and short timeouts, shared by all upstream calls.",
            "**Blocking work off the event loop.** Lookups run in a thread pool so the FastAPI loop stays responsive.",
          ],
        },
        {
          type: "code",
          label: "Python",
          caption: "Rank what arrived by the deadline (from the source).",
          code: `futures = {pool.submit(run_call, call): i for i, call in enumerate(plan)}
try:
    for future in concurrent.futures.as_completed(
        futures, timeout=max(0.1, deadline - time.monotonic()),
    ):
        by_index[futures[future]] = future.result()
except concurrent.futures.TimeoutError:
    # Budget spent. Rank what arrived rather than making the user wait
    # on a straggler; the pool is redundant by design.
    pass`,
        },
      ],
    },
    {
      id: "caching",
      title: "Caching inputs, never rankings",
      blocks: [
        {
          type: "p",
          text: "The expensive part of a lookup is network I/O. The part that depends on the whole profile (cross-keyword scoring, the relevance gate, semantic similarity) is CPU work that takes milliseconds. So the caches sit strictly below the ranking and store only things that depend on one narrow key.",
        },
        {
          type: "table",
          caption: "Three bounded, thread-safe TTL + LRU caches",
          columns: ["Layer", "Key → value", "TTL", "Why"],
          rows: [
            ["L1", "keyword → resolved heading and call numbers", "24 h", "Shared by every profile that uses the keyword"],
            ["L2", "upstream query → raw candidate books", "6 h", "Shared by profiles that overlap partly"],
            ["L3", "exact keyword set → finished response", "1 h", "An exact repeat costs nothing"],
          ],
        },
        {
          type: "p",
          text: "A new faculty member who shares three keywords with a colleague reuses those three resolutions and every book query they have in common, then gets a ranking computed fresh for their own full profile. Cached book lists are copied on the way out so one request's scoring can't mutate another's. A test script with stubbed upstreams counts calls to check that each layer is hit or skipped when it should be, and that a ranking is never reused across profiles.",
        },
      ],
    },
    {
      id: "deployment",
      title: "Running on-premises on Windows",
      blocks: [
        {
          type: "list",
          items: [
            "**A Windows service via NSSM**, with auto-start, restart on exit with throttling, daily or size-based log rotation, and a grace period on stop.",
            "**Absolute paths everywhere.** A Windows service starts with its working directory set to System32, so every file and model-cache path is resolved from the project root.",
            "**nginx in front** with a long read timeout and buffering off for the bulk CSV endpoint; uvicorn trusts proxy headers.",
            "**One worker by design,** so the in-process caches are shared by every request instead of split across processes.",
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
          text: "The serving and caching design holds up. The matching quality is where I'd spend the next round of work, starting with measuring it.",
        },
        {
          type: "h3",
          text: "1. Build a labelled set before tuning anything else",
        },
        {
          type: "p",
          text: "Today a heading is \"found\" whenever the chain produces one, which says nothing about whether a librarian would agree with it. I'd have librarians label a few hundred real keywords with the heading they'd choose, then report precision per fallback step. That would show which steps earn their place and where the thresholds should sit.",
        },
        {
          type: "h3",
          text: "2. Give step A a quality floor",
        },
        {
          type: "p",
          text: "The first attempt accepts the top suggestion whatever its score, and later steps only run when the first returns nothing at all. A weak first match therefore beats a strong later one. The curated block-list of known bad matches is the symptom. I'd require a minimum score at every step and fall through when it isn't met, so the chain is chosen by quality rather than by order.",
        },
        {
          type: "h3",
          text: "3. Don't cache an outage as an answer",
        },
        {
          type: "p",
          text: "When the subject-heading API fails, the error becomes an empty result, and the keyword cache stores that \"no match\" for 24 hours. The book-query cache is already protected against this, with a test to prove it; the keyword cache should be too, by caching only results from calls that actually succeeded.",
        },
        {
          type: "h3",
          text: "4. Move bulk work off the request",
        },
        {
          type: "p",
          text: "The CSV endpoint processes every faculty row inside one request. With a single worker, a large upload holds up everyone else until it finishes. I'd run CSV jobs in the existing thread pool as background jobs with a status endpoint, and stream rows as they complete.",
        },
        {
          type: "h3",
          text: "5. Replace hand-tuning with data",
        },
        {
          type: "p",
          text: "The semantic seed list is about thirty headings, and parts of the book scoring are curated term lists. Both work for the profiles they were tuned on and won't generalize. I'd embed a real slice of LCSH offline and load it as the semantic index, and use the labelled set from the first change to fit the scoring weights.",
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
            "No measured accuracy yet; see the first change above.",
            "Depends on public APIs (Library of Congress, Open Library, Google Books) and their availability.",
            "The automated tests cover caching behavior with stubbed upstreams; matching and ranking have no automated tests.",
          ],
        },
      ],
    },
  ],
};
