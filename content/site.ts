// Profile, links and the short experience list shown on the home page.
// Profile URLs come from the hyperlink annotations in the supplied resume PDF.

export const profile = {
  name: "Mahek Sota",
  role: "Backend engineer",
  email: "sotamahek@gmail.com",
  github: "https://github.com/mahek-sota",
  linkedin: "https://www.linkedin.com/in/mahek-sota/",
  resumePath: "/mahek-sota-resume.pdf",
  description:
    "Backend engineer building data pipelines, durable job processing and APIs for research systems at the University of Mississippi.",
} as const;

export const focusAreas: { title: string; text: string }[] = [
  {
    title: "Ingestion and sync",
    text: "Batching, delta synchronization and streaming for large record sets.",
  },
  {
    title: "Durable work",
    text: "Explicit state machines, leases, retries that can't double-apply, dead letters.",
  },
  {
    title: "Access boundaries",
    text: "API keys, least-privilege database roles, rate limits, tool isolation.",
  },
  {
    title: "Operability",
    text: "Traces, metrics and logs that line up on one request or run ID.",
  },
];

export interface ExperienceItem {
  org: string;
  title: string;
  period: string;
  points: string[];
}

export const experience: ExperienceItem[] = [
  {
    org: "University of Mississippi",
    title: "Software Engineer (Backend & AI)",
    period: "Jul 2024 – Present",
    points: [
      "Lead end-to-end development of production research systems, turning faculty and administrator needs into applications supporting 10K+ students and 100+ faculty.",
      "Designed and operate Python, PostgreSQL and Kafka pipelines that have processed 50M+ records, with batching, delta synchronization, failure handling and observability; ingestion latency down 30%.",
      "Modernized legacy services into containerized Go services on AWS EKS, with GitHub Actions CI/CD, centralized logging, JWT authentication and Redis-backed rate limiting.",
      "Built research discovery and analytics platforms on OpenAlex and Dimensions data, including subsecond name search across about 6,900 researcher profiles.",
    ],
  },
  {
    org: "Stealth startup",
    title: "Software Engineer Intern",
    period: "Jun 2023 – Aug 2023",
    points: [
      "Built a React and FastAPI geospatial application; integrated external space datasets through 5+ REST APIs with caching, validation, error handling and 30-second automated refreshes.",
    ],
  },
  {
    org: "USC Viterbi School of Engineering",
    title: "Course Producer",
    period: "Jan 2023 – May 2023",
    points: [
      "Taught SQL, ER modeling and relational database design to 100+ students in weekly labs and office hours; wrote 15+ practice problems and database case studies.",
    ],
  },
  {
    org: "Ashtech",
    title: "Software Engineer Intern",
    period: "Jun 2021 – Aug 2021",
    points: [
      "Client-facing engineer translating business requirements into features; built accessible web and PayPal payment workflows with pytest and Jest tests.",
    ],
  },
];

export const education = [
  { school: "University of Southern California", degree: "M.S. Computer Science", period: "2022 – 2024" },
  { school: "Mumbai University (TSEC)", degree: "B.Tech. Computer Science", period: "2018 – 2022" },
];

/** Smaller public repositories, described only from what their code shows. */
export const otherWork: { name: string; href: string; text: string }[] = [
  {
    name: "modular-finance-tracking-system",
    href: "https://github.com/mahek-sota/modular-finance-tracking-system",
    text: "FastAPI, PostgreSQL and Redis, split into vertical-slice modules. Money is stored as `NUMERIC(18,4)`, rounded half-up only at display boundaries, and serialized to JSON as strings so it never passes through a float.",
  },
  {
    name: "go-task-manager-api",
    href: "https://github.com/mahek-sota/go-task-manager-api",
    text: "A small in-memory REST API on Go's standard `net/http` only: explicit status codes (201, 204, 400, 404, 405) and JSON validation at the edges.",
  },
  {
    name: "openaq-kafka",
    href: "https://github.com/mahek-sota/openaq-kafka",
    text: "A learning project using Kafka as an event backbone: one producer and four consumer services (alerts, storage, analytics, dashboard) reading the same topic in their own consumer groups.",
  },
];

/** Illustrative demos, listed on the home page and at /demo. */
export const demos: { href: string; title: string; text: string }[] = [
  {
    href: "/demo/collaboration-graph",
    title: "Co-authorship graph explorer",
    text: "Search a fictional campus, expand a co-authorship graph up to three hops, and watch the rules that shape it: per-person caps, campus scoping, merged identities and a pre-warmed cache. Modeled on a production system I built.",
  },
  {
    href: "/demo/idempotency",
    title: "Idempotent transaction handling",
    text: "Submit, retry and reverse transactions in a small browser-local ledger: retries that don't double-apply, key reuse that conflicts, and reversals as compensating entries.",
  },
];
