import type { Metadata } from "next";
import Link from "next/link";

import { CollabExplorer } from "@/components/demo/CollabExplorer";

export const metadata: Metadata = {
  title: "Illustrative demo: co-authorship graph explorer",
  description:
    "An interactive co-authorship graph over fictional data, using the same expansion rules as a production researcher explorer: hop limits, fan-out caps, campus scoping, identity merging and an edge cache.",
  alternates: { canonical: "/demo/collaboration-graph" },
};

export default function CollaborationGraphPage() {
  return (
    <div className="page demo-page">
      <header className="case-header">
        <p className="eyebrow">Illustrative engineering demo</p>
        <h1>Exploring a co-authorship graph</h1>
        <p className="lead">
          Pick a researcher, choose how far to look, and watch the expansion rules decide who appears: hop limits,
          per-person caps, campus scoping, merged identities and a cache in front of a slow upstream API.
        </p>
        <aside className="note note--illustrative">
          <p className="note-title">
            <span className="tag">Illustrative</span> What this is and isn&apos;t
          </p>
          <p>
            Every researcher, department and number here is fictional. The expansion rules mirror the production
            researcher explorer behind the{" "}
            <Link href="/work/research-discovery">research discovery case study</Link>; its code and data stay
            private. This version runs entirely in your browser, with no server, network calls or concurrency.
          </p>
        </aside>
      </header>

      <section className="prose" aria-labelledby="try-title">
        <h2 id="try-title">Things to try</h2>
        <ol>
          <li>
            Switch <strong>depth</strong> between 1 and 3. Rings fill outward, and the inspector shows each level of
            the breadth-first expansion.
          </li>
          <li>
            Lower the <strong>cap</strong> to 2, then press <strong>Connect visible</strong>. Links between people
            already on screen come back without adding anyone new.
          </li>
          <li>
            Search for <strong>Okafor</strong>. Two source records for one person become a single node, and the
            totals include both.
          </li>
          <li>
            Press <strong>Clear cache</strong> and reload a graph: every expansion goes upstream. Then{" "}
            <strong>Pre-warm cache</strong> and do it again: zero upstream calls.
          </li>
          <li>
            Click a node to inspect it, and double-click or press <strong>Expand from here</strong> to grow the graph
            from that person.
          </li>
        </ol>
      </section>

      <CollabExplorer />

      <section className="prose" aria-labelledby="rules-title">
        <h2 id="rules-title">The rules, and why they exist</h2>
        <ul>
          <li>
            <strong>Breadth-first, at most three hops.</strong> Each level is expanded before the next, so every
            person gets their shortest distance from the root. The API rejects deeper requests.
          </li>
          <li>
            <strong>A cap per person, keeping the strongest ties.</strong> A prolific author can have hundreds of
            co-authors. Keeping the ones with the most shared works stops one person from flooding the graph.
            Connect visible fills in links among people already shown without growing the graph outward.
          </li>
          <li>
            <strong>Scoped to campus.</strong> Co-authors from elsewhere are fetched with everyone else, then dropped.
            The inspector counts them so the filter isn&apos;t invisible.
          </li>
          <li>
            <strong>One person, one node.</strong> Bibliographic sources often split one researcher across several
            records. Records that share an ORCID, or an ORCID-less name variant with exactly one compatible anchor,
            fold into one canonical person. Nothing is deleted; totals are summed at read time.
          </li>
          <li>
            <strong>A cache in front of the upstream API.</strong> Collaborators are fetched once per record and
            stored. Production also runs a pre-warm job, so live traffic is served from the database and never waits
            on, or gets rate-limited by, the upstream API.
          </li>
        </ul>

        <h2>Where the demo differs from production</h2>
        <ul>
          <li>Upstream fetches here are instant lookups, not paginated network calls behind a rate limiter.</li>
          <li>The layout is a simple radial one; production uses a force-directed graph library.</li>
          <li>
            The demo caches an empty result as a real answer. In production, a person with no co-authors found has
            nothing stored, so they&apos;re fetched again on every request. Storing an explicit empty marker is the
            change I&apos;d make.
          </li>
        </ul>
        <p>
          The rules are covered by tests in this site&apos;s source: depth bounds, the cap keeping the strongest ties,
          campus scoping, identity merging, cache and pre-warm behavior, and that connect visible never adds nodes.
        </p>
      </section>
    </div>
  );
}
