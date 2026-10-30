import type { CaseStudy } from "../types.ts";

export const researcherMatchmaker: CaseStudy = {
  slug: "researcher-matchmaker",
  title: "An explainable matching engine for research teams",
  summary:
    "A zero-dependency prototype that turns a short questionnaire into ranked, explained matches and a suggested team, with a test suite that asserts on scoring relationships so weights can be retuned safely.",
  status: "Prototype",
  context: "University of Mississippi",
  role: "Built the prototype",
  period: "2025 – Present",
  stack: ["Node.js (no dependencies)", "Vanilla HTML/CSS/JS", "node:test"],
  evidence: {
    label: "Verified against code",
    text: "Checked against the source and by running its test suite (77 tests, all passing). It runs on dummy data only; no real researchers are involved. The code is private.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "Assembling a research team, grant group or dissertation committee across a large campus runs on word of mouth, so people find the collaborators they already know. The prototype asks a short questionnaire (purpose, domain, methods, skills, keywords, team size) and returns ranked matches and a suggested team.",
        },
        {
          type: "p",
          text: "The design rule was that every score has to explain itself. A ranking nobody can explain is worse than no ranking.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "A prototype I built, running on 28 invented researcher profiles. It has a JSON API and a browser UI served by one Node process using only the standard library: no framework, no build step, no `npm install`.",
        },
      ],
    },
    {
      id: "engine",
      title: "How the engine works",
      blocks: [
        {
          type: "list",
          items: [
            "**Transparent weights.** Each signal (exact domain, adjacent domain, matched method, technique, skill, keyword, department, seniority, purpose fit) adds a fixed weight, and every awarded signal records a human-readable reason shown on the card.",
            "**Normalized against the best possible answer.** Scores are a percentage of the ideal score for that exact query, so results are comparable across very different questions.",
            "**Diminishing returns.** Repeated hits of one kind taper, so a broad query doesn't push every percentage toward zero. Score and ideal use the same curve.",
            "**Partial credit, labelled as such.** Someone in the parent method family of a requested technique earns 40% of a direct hit, and the reason says it's indirect.",
            "**Hard rules beat preferences.** Committee mode removes anyone ineligible to serve, even if the user pinned them. A domain filter is applied before scoring, so nothing can be smuggled past it.",
            "**Team builder.** Starts from pinned members and the top match, then greedily adds people who bring new method or domain coverage, and reports what the team still lacks.",
          ],
        },
        {
          type: "code",
          label: "HTTP",
          caption: "Representative request to the matching endpoint (dummy data).",
          code: `POST /api/match
Content-Type: application/json

{"role": "domain-expert", "purpose": "research-paper",
 "domain": "Natural Language Processing",
 "methodologies": ["Deep Learning", "Experimental Design"],
 "keywords": "misinformation, evaluation",
 "teamSize": 4, "pinned": ["r01"], "excluded": ["r16"]}`,
        },
      ],
    },
    {
      id: "testing",
      title: "Testing the invariants, not the numbers",
      blocks: [
        {
          type: "p",
          text: "The suite asserts on relationships, not point totals: an exact domain match outranks an adjacent one, a perfect match reaches exactly 100% under every purpose and role, and every taxonomy term a researcher uses exists. Weights can be retuned freely; breaking the scoring model fails a test.",
        },
        {
          type: "list",
          items: [
            "Every signal that can raise a score must also raise the ideal score, or people exceed 100% or nobody reaches it. An earlier version capped one purpose at 86% for exactly this reason.",
            "Every awarded signal must produce a reason, or a card shows a score it can't explain.",
            "A role multiplier and a filter must apply to both the score and the ideal.",
          ],
        },
        {
          type: "facts",
          items: [{ value: "77", label: "engine tests, all passing when run for this page", source: "code" }],
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
            "Dummy data only. The weights are hand-chosen and haven't been validated against real team outcomes.",
            "No persistence or accounts. Queries are stateless.",
            "Matching is a weighted sum over declared profile fields; it doesn't use publication data. Connecting it to the researcher data from the [discovery work](/work/research-discovery) would be the obvious next step.",
          ],
        },
      ],
    },
  ],
};
