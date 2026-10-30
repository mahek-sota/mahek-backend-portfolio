import type { CaseStudy } from "../types.ts";

export const researchDiscovery: CaseStudy = {
  slug: "research-discovery",
  title: "Research data ingestion and discovery",
  summary:
    "Pipelines that move large scholarly datasets into PostgreSQL with batching and delta sync, and the discovery and analytics tools built on top of them at the University of Mississippi.",
  status: "Production",
  context: "University of Mississippi",
  role: "Owned the ingestion pipelines end to end; built the discovery and analytics applications",
  period: "Jul 2024 – Present",
  stack: ["Python", "PostgreSQL", "Kafka", "FastAPI", "React", "TypeScript", "Docker"],
  evidence: {
    label: "Source-reported",
    text: "This work is in private institutional systems. Everything here comes from my resume and my written impact document. I'm not publishing schemas, code, hostnames or institutional data, so this case study is shorter than the others. The one exception is the graph-expansion behavior, which I checked against the code and model on fictional data in an [illustrative demo](/demo/collaboration-graph).",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "A university's research footprint is spread across external scholarly databases and internal systems. Before this work, finding who works on what across thousands of researchers mostly ran on word of mouth, publication data from several years sat in disconnected databases, and moving tens of millions of records between systems was a recurring bottleneck with little visibility into what had failed.",
        },
        {
          type: "p",
          text: "The people affected were librarians, research office staff, administrators and faculty looking for collaborators, reviewers or reporting numbers they could defend.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "In production. On the pipelines I owned the full lifecycle: requirements, system design, implementation, CI/CD and monitoring. I built the discovery explorer and the cross-school analytics platform as full-stack applications on top of that data.",
        },
      ],
    },
    {
      id: "constraints",
      title: "Constraints",
      blocks: [
        {
          type: "list",
          items: [
            "**Volume.** The pipelines have processed 50M+ records and are kept current through delta synchronization and real-time streaming.",
            "**External sources.** Much of the data comes from external scholarly sources, OpenAlex and Dimensions.",
            "**Identity is messy.** Researcher identities collide across sources, author identifiers are adopted inconsistently, and stated keywords are often missing or too generic. A later profiling effort, still in progress, evaluated four competing methods across three identity sources and chose one on measured results.",
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
          title: "Data flow at the level the sources describe",
          provenance:
            "Conceptual diagram reconstructed from my resume and impact document. It is not a diagram of the production deployment; the applications are shown together for readability.",
          rows: [
            {
              nodes: [
                { label: "OpenAlex", kind: "external" },
                { label: "Dimensions", kind: "external" },
              ],
              edge: "batch loads · delta sync · streaming (Kafka)",
            },
            {
              nodes: [{ label: "Python ingestion pipelines", detail: "batching · failure handling · monitoring", kind: "process" }],
              edge: "write",
            },
            {
              nodes: [{ label: "PostgreSQL", detail: "researchers · publications · co-authorship", kind: "store" }],
              edge: "query",
            },
            {
              nodes: [
                { label: "Discovery explorer", detail: "FastAPI + React/TypeScript", kind: "client" },
                { label: "Research analytics", detail: "trends across schools", kind: "client" },
                { label: "Reporting dashboards", detail: "publications · open access", kind: "client" },
              ],
            },
          ],
        },
        {
          type: "p",
          text: "The **discovery explorer** indexes researchers with their publication metrics and renders co-authorship as a graph. You search by name and expand outward from any person, up to three hops. The **cross-school platform** shows collaboration networks, growth and time-series trends over five-plus years of publication data. The **reporting dashboards** give the research office one current view of publication output and open-access progress.",
        },
        {
          type: "p",
          text: "The core relationship is many-to-many: researchers author many publications and publications have many authors. Co-authorship edges, and the hop-limited expansion, derive from that. I'm not publishing the production schema, so its constraints and indexes aren't described here.",
        },
      ],
    },
    {
      id: "reliability",
      title: "Failure handling and observability",
      blocks: [
        {
          type: "p",
          text: "The pipelines were built with batching, delta synchronization, explicit failure handling and observability, replacing a process with no real visibility. The specific retry policies and alerts are internal, and I've left them out rather than describe them loosely.",
        },
        {
          type: "p",
          text: "One judgment call carried through the related tools. A separate collaboration-review tool expands networks on demand against a large public scholarly dataset and surfaces indirect collaboration paths, with the supporting evidence attached to each result. Every screen frames the output as a signal for human review, never a determination about a person.",
        },
      ],
    },
    {
      id: "outcomes",
      title: "Outcomes",
      blocks: [
        {
          type: "facts",
          items: [
            { value: "50M+", label: "records processed by the ingestion pipelines", source: "resume" },
            { value: "−30%", label: "ingestion latency after the pipeline rework", source: "resume" },
            { value: "~6,900", label: "researcher profiles with subsecond name search", source: "resume" },
            { value: "−25%", label: "query time on the cross-school platform (100K+ records)", source: "impact-doc" },
            { value: "44.5K+", label: "publications tracked in research reporting", source: "resume" },
          ],
        },
        {
          type: "p",
          text: "Staff now get collaboration patterns from a search and a few clicks instead of weeks of manual digging. Collection-development staff use the related usage analytics to justify renewals and cancellations against actual demand.",
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
            "Latency and query-time improvements are measured against the systems they replaced. The sources don't record baselines in absolute terms.",
            "No code, schema or API examples are shown because the systems are private. For code you can read, see the [agent-mesh case study](/work/agent-mesh).",
            "The [co-authorship graph demo](/demo/collaboration-graph) shows how the explorer expands a graph: breadth-first to three hops, a per-person cap, campus scoping, merged duplicate identities and a pre-warmed cache.",
          ],
        },
      ],
    },
  ],
};
