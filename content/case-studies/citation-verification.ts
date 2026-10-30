import type { CaseStudy } from "../types.ts";

export const citationVerification: CaseStudy = {
  slug: "citation-verification",
  title: "A staged verification pipeline for thesis citations",
  summary:
    "A production pipeline that checks thesis bibliographies with layered heuristic, semantic and local-model signals, and routes low-confidence references to a person instead of guessing.",
  status: "Production",
  context: "University of Mississippi",
  role: "Built the pipeline",
  period: "Jul 2024 – Present",
  stack: ["Python", "PostgreSQL", "Ollama (local LLMs)", "Sentence Transformers", "Regex heuristics"],
  evidence: {
    label: "Source-reported",
    text: "Drawn from my resume and impact document. The code is private. My two sources give different accuracy and precision figures, so I've left those numbers out and kept only the ones they agree on.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "Faculty reviewing theses verified citations by hand, roughly 30 minutes per thesis. The obvious automation, extracting each reference and asking a model whether it's real, produced confident hallucinations often enough that reviewers trusted it less than having no tool at all.",
        },
        {
          type: "p",
          text: "The real budget was reviewer attention. Faster and cheaper only mattered if reviewers trusted the output enough not to re-check it.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I built the pipeline, and it is in production use.",
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
            "**No paid APIs.** Every model runs locally on Ollama, and no thesis content leaves the institution.",
            "**On-premises corpus.** Retrieval for verification couldn't use a cloud service.",
            "**Messy input.** Bibliographies arrive through OCR, with ligature joins, hyphenation splits and dropped diacritics.",
          ],
        },
      ],
    },
    {
      id: "architecture",
      title: "Architecture",
      blocks: [
        {
          type: "p",
          text: "Instead of one model call, the pipeline is a series of cheap-to-expensive stages. The model is one signal among several, and it never makes the final call alone.",
        },
        {
          type: "diagram",
          title: "Verification stages",
          provenance: "Reconstructed from the architecture described in my impact document.",
          rows: [
            { nodes: [{ label: "Bibliography input", detail: "OCR'd thesis references", kind: "client" }], edge: "split" },
            { nodes: [{ label: "Reference parser", detail: "structured candidate records", kind: "process" }], edge: "gate" },
            { nodes: [{ label: "Heuristic scorer", detail: "regex + metadata patterns catch malformed references early", kind: "process" }], edge: "compare" },
            { nodes: [{ label: "Semantic similarity", detail: "against an indexed on-prem corpus; flags claim/source drift", kind: "process" }], edge: "verify" },
            { nodes: [{ label: "Local LLM verifier", detail: "parsed record + cited passage + retrieved metadata → structured output", kind: "process" }], edge: "combine" },
            { nodes: [{ label: "Confidence aggregator", detail: "one score from heuristic, semantic and model signals", kind: "process" }], edge: "below threshold" },
            { nodes: [{ label: "Human review queue", kind: "client" }] },
          ],
        },
      ],
    },
    {
      id: "failures",
      title: "Failure modes as test cases",
      blocks: [
        {
          type: "p",
          text: "Cataloguing failures was most of the work. Each named failure mode became a fixture in the evaluation set, and results were tracked per failure-mode slice rather than as a single average, so an improvement in one slice couldn't hide a regression in another.",
        },
        {
          type: "table",
          columns: ["Failure mode", "What it looks like"],
          rows: [
            ["Fabricated venues", "Plausible journal names that don't exist."],
            ["DOI mismatch", "The DOI resolves, but to a different paper."],
            ["OCR corruption", "Ligature joins, hyphenation splits, dropped diacritics."],
            ["Semantic drift", "High embedding similarity, wrong topic."],
            ["Malformed references", "Author and year swapped, missing volume, broken delimiters."],
            ["Phantom merges", "Two real papers partially overlapping into one citation that doesn't exist."],
          ],
        },
        {
          type: "p",
          text: "Evaluation tracks precision (of citations marked real, how many are), recall on fabricated citations, and the rate of confident answers that were wrong on review, broken down by discipline, OCR quality and reference style.",
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
            { value: "30 → 2 min", label: "review time per thesis", source: "resume" },
            { value: "10–30 h", label: "faculty time returned per semester", source: "impact-doc" },
            { value: "~12%", label: "of references deliberately routed to a human reviewer", source: "impact-doc" },
          ],
        },
      ],
    },
    {
      id: "tradeoffs",
      title: "Tradeoffs",
      blocks: [
        {
          type: "list",
          items: [
            "**Every reliability gain cost something.** Adding the model verifier doubled latency per reference. Adding human review cost reviewer time, which then had to be won back through better confidence calibration.",
            "**Order of improvements.** The gains came from parser hardening and heuristic gating first (cheap), then semantic verification, then the local model verifier with structured output (expensive), and finally confidence-based human routing, which costs the most operationally.",
            "**Honest accuracy includes the human queue.** The pipeline's accuracy figure is only meaningful alongside the share of references it declines to decide.",
          ],
        },
      ],
    },
  ],
};
