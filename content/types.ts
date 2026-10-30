// Content model for the portfolio. Pages render these structures; editing a case
// study means editing data in content/, not JSX.
//
// Inline text in any `text`, list item or table cell supports a small markdown
// subset: `code`, **bold** and [label](href).

export type Status = "Production" | "Internal tool" | "In development" | "Personal project" | "Prototype";

/** Where a figure comes from. Shown next to outcomes so readers can weigh them. */
export type Provenance = "resume" | "repo-docs" | "code";

export interface DiagramNode {
  label: string;
  detail?: string;
  kind?: "process" | "store" | "external" | "client";
}

export interface DiagramRow {
  nodes: DiagramNode[];
  /** Label for the connector drawn below this row. Omit on the last row. */
  edge?: string;
}

export type Block =
  | { type: "p"; text: string }
  | { type: "h3"; text: string; id?: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "code"; label: string; code: string; caption?: string }
  | {
      type: "table";
      caption?: string;
      columns: string[];
      rows: string[][];
    }
  | {
      type: "diagram";
      title: string;
      /** States how the diagram was produced, e.g. reconstructed from docs. */
      provenance: string;
      rows: DiagramRow[];
    }
  | {
      type: "note";
      tone: "evidence" | "illustrative" | "proposal";
      title: string;
      text: string;
    }
  | {
      type: "facts";
      items: { value: string; label: string; source: Provenance }[];
    };

export interface Section {
  id: string;
  title: string;
  /** Visually emphasised section, used for the retrospective. */
  feature?: boolean;
  blocks: Block[];
}

export interface CaseStudy {
  slug: string;
  title: string;
  /** One sentence for cards, metadata and social previews. */
  summary: string;
  status: Status;
  context: string;
  role: string;
  period: string;
  /** What a reader will learn from this deep dive; shown on the home page. */
  topics: string[];
  stack: string[];
  evidence: { label: string; text: string };
  sections: Section[];
}
