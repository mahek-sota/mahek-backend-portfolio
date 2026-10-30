import type { CaseStudy } from "../types.ts";

export const collectionDecisions: CaseStudy = {
  slug: "collection-decisions",
  title: "Turning messy vendor usage reports into decisions a librarian can defend",
  summary:
    "Three connected tools that ingest years of inconsistent publisher usage reports and interlibrary-loan exports, pick one trustworthy source for every month, and produce keep, cancel, subscribe and purchase recommendations, each with its evidence, as single files that can be emailed.",
  status: "In development",
  context: "University of Mississippi Libraries",
  role: "Designed and built all three",
  period: "2026",
  topics: ["Data-quality engineering", "Choosing one source of truth", "Bounding what you can't measure", "Evidence-carrying recommendations"],
  stack: ["Python", "pandas", "Parquet", "OpenAlex API", "pytest / unittest", "Static HTML"],
  evidence: {
    label: "Verified against code and tests",
    text: "Checked against the source; both test suites were run for this page. The code is private. Vendor names, usage figures, prices and invoice amounts are left out.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "Libraries renew journal packages and decide what to buy based on usage. That usage arrives as COUNTER reports, a standard format that each of roughly a hundred vendors interprets differently: different encodings and file types, misnamed files, reports covering overlapping periods, restatements under a newer release of the standard, and aggregator platforms reporting slices of other publishers' content. Interlibrary-loan (ILL) data comes from separate exports with their own quirks.",
        },
        {
          type: "p",
          text: "Three tools share one approach to that data:",
        },
        {
          type: "table",
          caption: "The three tools",
          columns: ["Tool", "Question it answers", "Output"],
          rows: [
            ["Usage dashboard", "What did we actually use, by vendor, title and month?", "One self-contained HTML file plus a Parquet export"],
            ["Collection value", "For each journal: keep, review, negotiate, or a cancel candidate?", "One HTML report plus CSV"],
            ["ILL acquisition-on-demand", "For titles we keep borrowing: subscribe, buy, or keep borrowing?", "Two HTML pages plus CSVs"],
          ],
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I designed and built all three. The dashboard has been through structured UI testing. Its numbers are being verified with the collection owner before anyone uses them for decisions. The two recommendation tools are working drafts that librarians review.",
        },
      ],
    },
    {
      id: "ingest",
      title: "Reading reports by content, not by name",
      blocks: [
        {
          type: "list",
          items: [
            "**Detect by content.** A file is treated as a title report only if its header says so. Filenames lie: the archive includes a title report shipped under another report's name, spreadsheets with the wrong extension, and the data on the fifth sheet of a workbook.",
            "**Tolerate the formats vendors actually send.** UTF-16, UTF-8 and Windows-1252 text; ragged and trailing-delimiter rows; vendor-prefixed metric names; text variants of month headers; a corrupt header year repaired from the report's own reporting period; and rows shifted by a column.",
            "**Vendor identity from the data.** The vendor comes from each row's platform through an editable mapping file. Platforms that host many publishers fall back to the filename.",
          ],
        },
      ],
    },
    {
      id: "selection",
      title: "One owner for every platform-month",
      blocks: [
        {
          type: "p",
          text: "The archive often holds several files that cover the same platform and period. Adding them double-counts, so the dashboard works in two passes. The first pass inventories every candidate. It ranks sources per year and platform (single-year files over multi-year, more months, more usage, then file type) and collapses a restatement of the same year under a newer release. A second pass then gives every (platform, month) exactly one owning file:",
        },
        {
          type: "code",
          label: "Python",
          caption: "Assigning each platform-month to one source (from the source).",
          code: `month_owner = {}
for (year, pkey), picks in chosen.items():
    platform = pkey[0]
    for version, c in picks.items():
        for ym in c["platforms"][platform]["months"]:
            bid = (c["multi_year"], year != ym[:4],
                   -c["platforms"][platform]["usage"], str(c["path"]))
            cur = month_owner.get((pkey, ym))
            if cur is None or bid < cur[0]:
                month_owner[(pkey, ym)] = (bid, (year, pkey, version))`,
        },
        {
          type: "p",
          text: "The bid is a tuple, so the preference order reads left to right: a single-year file beats a multi-year one, a file whose year matches the month beats one that spans into it, more usage wins, and the path breaks ties deterministically. Only the winning slices are re-read, and exports that span several years are split into calendar years.",
        },
        {
          type: "p",
          text: "Before testing, an independent calculation that shared no code with the build checked every number on the page: 417 of 417 matched. Loaded data matched the raw reports exactly for all but 24 of 6,848 platform-months, and those differences all come from report rows with no title.",
        },
      ],
    },
    {
      id: "value",
      title: "Recommendations that carry their evidence",
      blocks: [
        {
          type: "p",
          text: "The collection-value tool matches journals to OpenAlex by ISSN (in batches, with a cache that also remembers ISSNs that can't be resolved), then adds signals: how often the institution's authors publish in and cite each journal, and how much of it is open access. Each component is a percentile within the vendor and is combined with weights from configuration.",
        },
        {
          type: "table",
          caption: "Scoring weights and bands (configurable)",
          columns: ["Component", "Weight"],
          rows: [
            ["Usage level", "0.30"],
            ["Cost efficiency", "0.25 (redistributed when there's no cost data)"],
            ["Institutional authorship", "0.15"],
            ["Institutional citation", "0.15"],
            ["Usage trend", "0.10"],
            ["Open-access share", "0.05"],
          ],
        },
        {
          type: "list",
          items: [
            "**Bands, then guardrails.** A score of 65 or more is Keep, 45 Review, 25 Negotiate, below that a Cancel candidate. Overrides then apply the judgments a weighted average shouldn't make alone: a journal where the institution's authors publish often, or one in the top usage decile, is never a cancel candidate.",
            "**Trend measured honestly.** Growth is a log-linear slope over the longest run of consecutive years that share one release of the standard, so a format change isn't mistaken for a change in use.",
            "**Every row explains itself.** Each recommendation carries the overrides and flags that applied and a one-sentence explanation, so a librarian can disagree with a specific reason rather than with a number.",
          ],
        },
      ],
    },
    {
      id: "ill",
      title: "Bounding what the data can't tell you",
      blocks: [
        {
          type: "p",
          text: "Copyright guidelines for interlibrary loan allow a fixed number of free article requests per journal per year, and further requests owe royalties. The real ILL exports are aggregated over a multi-year window, so the exact per-year count can't be computed. Instead of guessing, the tool computes both bounds and labels the result.",
        },
        {
          type: "code",
          label: "Python",
          caption: "Minimum and maximum royalties from an aggregated window (from the source).",
          code: `out["royalty_min"] = (out["in_scope"] - allotment * n_years).clip(lower=0)
out["royalty_max"] = (out["in_scope"] - allotment).clip(lower=0)
out["certainty"] = np.select(
    [out["royalty_min"] > 0, out["royalty_max"] > 0],
    ["certain", "possible"], default="clear")`,
        },
        {
          type: "p",
          text: "If the requests exceed the allotment even when spread evenly across every year, royalties are **certain**. If they'd exceed it only if concentrated in one year, they're **possible**. Otherwise the title is **clear**. Titles are matched to the usage dashboard's exported Parquet through a union-find over print and online ISSNs, with an explicit \"ambiguous\" outcome rather than a forced match. Books get a purchase recommendation only when borrowing would cost more than buying.",
        },
        {
          type: "code",
          label: "Python",
          caption: "Grouping ISSNs that identify the same journal (from the source).",
          code: `def find(x):
    while parent.setdefault(x, x) != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x

for print_issn, online_issn in pairs.itertuples(index=False):
    if print_issn and online_issn:
        a, b = find(print_issn), find(online_issn)
        if a != b:
            parent[max(a, b)] = min(a, b)`,
        },
      ],
    },
    {
      id: "delivery",
      title: "One file you can email",
      blocks: [
        {
          type: "p",
          text: "These reports go to people who won't run a build, so each tool produces a single static HTML file with its data embedded. The dashboard dictionary-encodes and gzips its payload, with a fixed timestamp so identical data builds byte-identical files, and the browser unpacks it with `DecompressionStream`. It opens offline from a file, and needs no server or login. A Parquet export lets the dashboard be rebuilt elsewhere without the raw archive, and it's the seam the ILL tool reads.",
        },
        {
          type: "facts",
          items: [
            { value: "41", label: "collection-value tests, all passing, with OpenAlex replaced by a fake client", source: "code" },
            { value: "39", label: "ILL tests, all passing", source: "code" },
            { value: "417 / 417", label: "dashboard figures matched by an independent calculation", source: "repo-docs" },
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
          text: "The ingestion is the most battle-tested part. The recommendation layers need the same rigor.",
        },
        {
          type: "h3",
          text: "1. Don't score what allocation can't distinguish",
        },
        {
          type: "p",
          text: "When only a package price is known, it's spread across titles by usage share. That makes every used title in the package come out at the same cost per use, so the cost component can't rank titles within a package; it only compares packages. I'd score cost efficiency only for titles with their own invoices, and show package-level cost per use as a separate figure.",
        },
        {
          type: "h3",
          text: "2. Treat \"unknown\" as unknown",
        },
        {
          type: "p",
          text: "A journal that couldn't be matched to OpenAlex currently scores as if the institution never publishes in or cites it, which pushes it toward cancellation for lack of data. Missing signals should score neutral and be flagged, the way an unmeasured open-access share already is.",
        },
        {
          type: "h3",
          text: "3. Share the parser instead of copying it",
        },
        {
          type: "p",
          text: "The collection-value tool re-implements the dashboard's report parser so both produce the same figures, and the copies have drifted: the copy handles fewer encodings and formats and lacks the month-ownership pass. I'd extract one package that both depend on, run the dashboard's ingestion test fixtures against it, and add the automated tests the dashboard doesn't have yet.",
        },
        {
          type: "h3",
          text: "4. Make the bounds strict",
        },
        {
          type: "p",
          text: "To avoid understating royalties, the ILL bound counts an article as in scope if it could fall inside the recency window for any request in the period. For publication years on the boundary, that can label a title \"certain\" when it's only \"possible\". I'd compute the in-scope count per request year where the export allows, and add a test whose publication year sits on that boundary.",
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
            "Recommendations are prompts for librarian review, not decisions; the scoring weights are judgment calls, not fitted to outcomes.",
            "Quality is bounded by the vendors' own reports; some usage arrives without an access type, and the tools surface that rather than guess.",
            "The ILL tool's per-transaction mode runs only on synthetic data; the real exports are aggregate.",
          ],
        },
      ],
    },
  ],
};
