// Profile and links. Profile URLs come from the hyperlink annotations in the
// supplied resume PDF; the impact document URL was supplied directly.

export const profile = {
  name: "Mahek Sota",
  role: "Backend engineer",
  email: "sotamahek@gmail.com",
  github: "https://github.com/mahek-sota",
  linkedin: "https://www.linkedin.com/in/mahek-sota/",
  resumePath: "/mahek-sota-resume.pdf",
  impactDoc: "https://impact-doc.vercel.app/",
  description:
    "Engineering deep dives by Mahek Sota, a backend engineer: durable job processing, permission boundaries, graph expansion behind a rate-limited API, and moderation that fails closed.",
} as const;

/** Illustrative demos, listed on the home page and at /demo. */
export const demos: { href: string; title: string; text: string }[] = [
  {
    href: "/demo/collaboration-graph",
    title: "Co-authorship graph explorer",
    text: "Search a fictional campus, expand a co-authorship graph up to three hops, and watch the rules that shape it: per-person caps, campus scoping, merged identities and a pre-warmed cache. Modeled on the researcher explorer.",
  },
  {
    href: "/demo/idempotency",
    title: "Idempotent transaction handling",
    text: "Submit, retry and reverse transactions in a small browser-local ledger: retries that don't double-apply, key reuse that conflicts, and reversals as compensating entries.",
  },
];
