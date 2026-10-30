import type { Block, Provenance } from "@/content/types";
import { Diagram } from "./Diagram";
import { Inline } from "./Inline";

const provenanceLabel: Record<Provenance, string> = {
  resume: "Resume",
  "repo-docs": "Repo docs",
  code: "Verified in code",
};

const noteLabel = {
  evidence: "Context",
  illustrative: "Illustrative",
  proposal: "Proposal",
} as const;

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
    case "h3":
      return <h3 id={block.id}>{block.text}</h3>;
    case "list": {
      const items = block.items.map((item) => (
        <li key={item}>
          <Inline text={item} />
        </li>
      ));
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case "code":
      return (
        <figure className="code">
          <div className="code-label">{block.label}</div>
          <pre tabIndex={0}>
            <code>{block.code}</code>
          </pre>
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      );
    case "table":
      return (
        <div className="table-wrap" role="region" aria-label={block.caption ?? "Table"} tabIndex={0}>
          <table>
            {block.caption ? <caption>{block.caption}</caption> : null}
            <thead>
              <tr>
                {block.columns.map((col) => (
                  <th key={col} scope="col">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} data-label={block.columns[c]}>
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "diagram":
      return <Diagram title={block.title} provenance={block.provenance} rows={block.rows} />;
    case "note":
      return (
        <aside className={`note note--${block.tone}`}>
          <p className="note-title">
            <span className="tag">{noteLabel[block.tone]}</span> {block.title}
          </p>
          <p>
            <Inline text={block.text} />
          </p>
        </aside>
      );
    case "facts":
      return (
        <dl className="facts">
          {block.items.map((item) => (
            <div key={item.label} className="fact">
              <dt>
                <Inline text={item.label} />
              </dt>
              <dd>
                <span className="fact-value">{item.value}</span>
                <span className={`source source--${item.source}`}>{provenanceLabel[item.source]}</span>
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}
