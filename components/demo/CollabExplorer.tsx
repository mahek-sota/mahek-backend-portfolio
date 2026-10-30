"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";

import { coauthorships, merges, people } from "@/lib/collab-data";
import {
  MAX_DEPTH,
  connectVisible,
  createDataset,
  expand,
  layout,
  mergeGraph,
  personTotals,
  prewarm,
  search,
  type Cache,
  type Graph,
  type LevelTrace,
} from "@/lib/collab-graph";

const ds = createDataset(people, merges, coauthorships);
const SIZE = 640;
const CAPS = [2, 3, 5, 10];
const cacheable = people.filter((p) => p.campus).length;

interface RequestLog {
  line: string;
  status: number;
  summary: string;
  trace: LevelTrace[];
}

interface State {
  graph: Graph;
  cache: Cache;
  selected: string;
  request: RequestLog;
}

function run(cache: Cache, rootId: string, depth: number, cap: number): State | { error: string } {
  const result = expand(ds, cache, rootId, depth, cap);
  if (!result.ok) return { error: result.message };
  return {
    graph: result.graph,
    cache: result.cache,
    selected: result.graph.rootId,
    request: {
      line: `GET /api/graph/expand?author_id=${rootId}&depth=${depth}&max_per_node=${cap}`,
      status: 200,
      summary: summarize(result.trace),
      trace: result.trace,
    },
  };
}

function summarize(trace: LevelTrace[]): string {
  const fetches = trace.reduce((s, t) => s + t.upstreamFetches, 0);
  const hits = trace.reduce((s, t) => s + t.cacheHits, 0);
  return `${hits} cache ${hits === 1 ? "hit" : "hits"}, ${fetches} upstream ${fetches === 1 ? "fetch" : "fetches"}`;
}

const initial = run({}, "R01", 2, 3) as State;

export function CollabExplorer() {
  const [state, setState] = useState<State>(initial);
  const [depth, setDepth] = useState(2);
  const [cap, setCap] = useState(3);
  const [query, setQuery] = useState("");
  const id = useId();

  const { graph, cache, selected, request } = state;
  const positions = useMemo(() => layout(graph, SIZE), [graph]);
  const results = query.trim() ? search(ds, query, 6) : [];
  const cachedCount = Object.keys(cache).length;

  function load(rootId: string, nextDepth = depth, nextCap = cap, nextCache = cache) {
    const next = run(nextCache, rootId, nextDepth, nextCap);
    if ("error" in next) return;
    setState(next);
  }

  function expandFrom(nodeId: string) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node || node.depth >= MAX_DEPTH) return;
    const result = expand(ds, cache, nodeId, 1, cap);
    if (!result.ok) return;
    const merged = mergeGraph(graph, result.graph, node.depth);
    const added = merged.nodes.length - graph.nodes.length;
    setState({
      graph: merged,
      cache: result.cache,
      selected: nodeId,
      request: {
        line: `GET /api/graph/expand?author_id=${nodeId}&depth=1&max_per_node=${cap}`,
        status: 200,
        summary: `${summarize(result.trace)}; ${added} new ${added === 1 ? "person" : "people"} added to the visible graph`,
        trace: result.trace,
      },
    });
  }

  function linkVisible() {
    const result = connectVisible(ds, cache, graph);
    setState({
      ...state,
      graph: result.graph,
      cache: result.cache,
      request: {
        line: `GET /api/graph/links?ids=${graph.nodes.map((n) => n.id).join(",")}`,
        status: 200,
        summary: `${result.added} hidden ${result.added === 1 ? "edge" : "edges"} revealed among visible nodes; ${result.cacheHits} cache hits, ${result.upstreamFetches} upstream fetches`,
        trace: [],
      },
    });
  }

  function onNodeKey(event: KeyboardEvent, nodeId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setState({ ...state, selected: nodeId });
    }
  }

  const neighbors = new Set(
    graph.edges.flatMap((e) => (e.source === selected ? [e.target] : e.target === selected ? [e.source] : [])),
  );
  const showAllLabels = graph.nodes.length <= 9;
  const selectedNode = graph.nodes.find((n) => n.id === selected);

  return (
    <div className="demo explorer">
      <section className="demo-panel explorer-controls" aria-label="Graph controls">
        <div className="field explorer-search">
          <label htmlFor={`${id}-q`}>Find a researcher (fictional directory)</label>
          <input
            id={`${id}-q`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Raman, Vega, Okafor"
            autoComplete="off"
            spellCheck={false}
          />
          {results.length > 0 ? (
            <ul className="search-results">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      load(p.id);
                      setQuery("");
                    }}
                  >
                    <span>{p.name}</span>
                    <span className="muted">
                      {p.department} · {personTotals(ds, p.id).works} works
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() ? (
            <p className="field-hint">No on-campus match.</p>
          ) : null}
        </div>

        <fieldset className="segmented">
          <legend>Depth (hops)</legend>
          {[1, 2, 3].map((d) => (
            <label key={d}>
              <input
                type="radio"
                name={`${id}-depth`}
                value={d}
                checked={depth === d}
                onChange={() => {
                  setDepth(d);
                  load(graph.rootId, d);
                }}
              />
              <span>{d}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="segmented">
          <legend>Max collaborators per person</legend>
          {CAPS.map((c) => (
            <label key={c}>
              <input
                type="radio"
                name={`${id}-cap`}
                value={c}
                checked={cap === c}
                onChange={() => {
                  setCap(c);
                  load(graph.rootId, depth, c);
                }}
              />
              <span>{c}</span>
            </label>
          ))}
        </fieldset>

        <div className="explorer-actions">
          <button type="button" className="button button--quiet" onClick={linkVisible}>
            Connect visible
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setState({ ...state, cache: prewarm(ds) })}
            disabled={cachedCount >= cacheable}
          >
            Pre-warm cache
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setState({ ...state, cache: {} })}
            disabled={cachedCount === 0}
          >
            Clear cache
          </button>
          <span className="field-hint">
            Cache: {cachedCount}/{cacheable} records
          </span>
        </div>
      </section>

      <div className="explorer-main">
        <figure className="demo-panel explorer-graph">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="group"
            aria-label={`Co-authorship graph around ${ds.byId.get(graph.rootId)?.name}: ${graph.nodes.length} researchers, ${graph.edges.length} links`}
          >
            {[1, 2, 3].map((d) => (
              <circle key={d} className="ring" cx={SIZE / 2} cy={SIZE / 2} r={SIZE * [0, 0.2, 0.33, 0.44][d]} />
            ))}
            <g>
              {graph.edges.map((e) => {
                const a = positions.get(e.source);
                const b = positions.get(e.target);
                if (!a || !b) return null;
                const active = e.source === selected || e.target === selected;
                return (
                  <line
                    key={`${e.source}|${e.target}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={active ? "edge edge--active" : "edge"}
                    strokeWidth={Math.min(1 + e.weight / 3, 7)}
                  />
                );
              })}
            </g>
            {graph.nodes.map((n) => {
              const p = positions.get(n.id);
              const person = ds.byId.get(n.id);
              if (!p || !person) return null;
              const r = 6 + Math.sqrt(personTotals(ds, n.id).works) * 0.85;
              const isSelected = n.id === selected;
              const labelled = showAllLabels || isSelected || n.depth === 0 || neighbors.has(n.id);
              return (
                <g
                  key={n.id}
                  className={`node node--d${n.depth}${isSelected ? " node--selected" : ""}`}
                  style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`${person.name}, ${person.department}, ${n.depth} ${n.depth === 1 ? "hop" : "hops"} from the root`}
                  onClick={() => setState({ ...state, selected: n.id })}
                  onDoubleClick={() => expandFrom(n.id)}
                  onKeyDown={(e) => onNodeKey(e, n.id)}
                >
                  <circle r={r} />
                  {labelled ? (
                    <text y={r + 15} textAnchor="middle">
                      {person.name}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          <figcaption className="explorer-legend">
            <span>
              <i className="swatch swatch--d0" /> root
            </span>
            <span>
              <i className="swatch swatch--d1" /> 1 hop
            </span>
            <span>
              <i className="swatch swatch--d2" /> 2 hops
            </span>
            <span>
              <i className="swatch swatch--d3" /> 3 hops
            </span>
            <span>Size: works · Line width: shared works · Double-click a node to expand it</span>
          </figcaption>
        </figure>

        <aside className="demo-panel explorer-panel" aria-live="polite">
          {selectedNode ? <PersonPanel id={selectedNode.id} depth={selectedNode.depth} graph={graph} /> : null}
          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={() => expandFrom(selected)}
              disabled={!selectedNode || selectedNode.depth >= MAX_DEPTH}
            >
              Expand from here
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => load(selected)}
              disabled={selected === graph.rootId}
            >
              Make root
            </button>
          </div>
          {selectedNode && selectedNode.depth >= MAX_DEPTH ? (
            <p className="field-hint">The API stops at {MAX_DEPTH} hops from the root.</p>
          ) : null}
        </aside>
      </div>

      <section className="demo-panel" aria-labelledby={`${id}-req`}>
        <h2 id={`${id}-req`} className="demo-heading">
          Request inspector
        </h2>
        <p className="response-request mono explorer-request">{request.line}</p>
        <p className="response-status mono response-status--ok">
          HTTP/1.1 {request.status} OK · {request.summary}
        </p>
        {request.trace.length > 0 ? (
          <div className="table-wrap" role="region" aria-label="Expansion trace by level" tabIndex={0}>
            <table className="compact">
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col" className="num">Expanded</th>
                  <th scope="col" className="num">Cache hits</th>
                  <th scope="col" className="num">Upstream</th>
                  <th scope="col" className="num">Off-campus dropped</th>
                  <th scope="col" className="num">Duplicates merged</th>
                  <th scope="col" className="num">Over cap</th>
                  <th scope="col" className="num">New nodes</th>
                </tr>
              </thead>
              <tbody>
                {request.trace.map((t) => (
                  <tr key={t.level}>
                    <td className="mono">
                      {t.level} → {t.level + 1}
                    </td>
                    <td className="mono num">{t.expanded.length}</td>
                    <td className="mono num">{t.cacheHits}</td>
                    <td className="mono num">{t.upstreamFetches}</td>
                    <td className="mono num">{t.offCampusDropped}</td>
                    <td className="mono num">{t.fragmentsMerged}</td>
                    <td className="mono num">{t.overCapDropped}</td>
                    <td className="mono num">{t.newNodes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PersonPanel({ id, depth, graph }: { id: string; depth: number; graph: Graph }) {
  const { person, works, citations, records } = personTotals(ds, id);
  const links = graph.edges.filter((e) => e.source === id || e.target === id);
  const rootEdge = links.find((e) => e.source === graph.rootId || e.target === graph.rootId);
  return (
    <div className="person">
      <p className="eyebrow">{depth === 0 ? "Root" : `${depth} ${depth === 1 ? "hop" : "hops"} from root`}</p>
      <h2 className="demo-heading">{person.name}</h2>
      <p className="muted">{person.department}</p>
      <dl className="person-stats">
        <div>
          <dt>Works</dt>
          <dd>{works}</dd>
        </div>
        <div>
          <dt>Citations</dt>
          <dd>{citations.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>h-index</dt>
          <dd>{person.hIndex}</dd>
        </div>
        <div>
          <dt>Visible links</dt>
          <dd>{links.length}</dd>
        </div>
      </dl>
      {records > 1 ? (
        <p className="person-note">
          Merged from {records} source records (a name-variant record without an ORCID was folded into this one).
          Totals include both.
        </p>
      ) : null}
      {rootEdge && id !== graph.rootId ? <p className="person-note">{rootEdge.weight} works shared with the root.</p> : null}
    </div>
  );
}
