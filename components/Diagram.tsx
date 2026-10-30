import type { DiagramRow } from "@/content/types";

// A vertical flow diagram built from HTML rather than a fixed-size SVG, so it
// reflows to any width without horizontal scrolling. Nodes in a row sit side by
// side when there is room and stack when there isn't.
export function Diagram({ title, provenance, rows }: { title: string; provenance: string; rows: DiagramRow[] }) {
  return (
    <figure className="diagram">
      <figcaption className="diagram-title">
        <span>{title}</span>
        <span className="diagram-provenance">{provenance}</span>
      </figcaption>
      <ol className="diagram-rows">
        {rows.map((row, i) => (
          <li key={i} className="diagram-row">
            <ul className="diagram-nodes">
              {row.nodes.map((node) => (
                <li key={node.label} className={`diagram-node diagram-node--${node.kind ?? "process"}`}>
                  <span className="diagram-node-label">{node.label}</span>
                  {node.detail ? <span className="diagram-node-detail">{node.detail}</span> : null}
                </li>
              ))}
            </ul>
            {row.edge ? (
              <div className="diagram-edge">
                <span aria-hidden="true" className="diagram-arrow" />
                <span className="diagram-edge-label">{row.edge}</span>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}
