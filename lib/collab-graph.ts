// Collaboration-graph expansion for the illustrative demo. The rules mirror the
// production researcher explorer described in the "Research data ingestion and
// discovery" case study:
//
// - Expansion is breadth-first, one level at a time, to at most 3 hops.
// - An author's collaborators come from a cache; a miss is fetched from the
//   upstream source and stored.
// - Duplicate identities are folded into one canonical person before anything
//   else, so a fragment never appears as its own node.
// - Only on-campus co-authors are kept.
// - Each expanded author contributes at most `maxPerNode` collaborators, the
//   ones with the most shared works.
// - Edges are undirected and weighted by shared works.
//
// Everything is a pure function of its inputs so the demo is deterministic and
// testable. The data is fictional (lib/collab-data.ts).

import type { Person } from "./collab-data.ts";

export const MAX_DEPTH = 3;

export interface Raw {
  id: string;
  works: number;
}

/** Author id → that author's raw collaborators as last fetched upstream. */
export type Cache = Record<string, Raw[]>;

export interface GraphNode {
  id: string;
  depth: number;
}

export interface GraphEdge {
  /** source < target, so each undirected edge has one key. */
  source: string;
  target: string;
  weight: number;
}

export interface Graph {
  rootId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LevelTrace {
  level: number;
  expanded: string[];
  cacheHits: number;
  upstreamFetches: number;
  offCampusDropped: number;
  fragmentsMerged: number;
  overCapDropped: number;
  newNodes: number;
}

export type ExpandResult =
  | { ok: true; graph: Graph; cache: Cache; trace: LevelTrace[] }
  | { ok: false; status: 404 | 422; message: string };

export interface Dataset {
  byId: Map<string, Person>;
  /** Canonical id → ids of every record folded into it (including itself). */
  members: Map<string, string[]>;
  canonical: (id: string) => string;
  /** The upstream source: raw co-authors of one record, uncapped and unfiltered. */
  upstream: (id: string) => Raw[];
}

export function createDataset(
  people: Person[],
  merges: Record<string, string>,
  pairs: [string, string, number][],
): Dataset {
  const byId = new Map(people.map((p) => [p.id, p]));
  const canonical = (id: string) => merges[id] ?? id;
  const members = new Map<string, string[]>();
  for (const p of people) {
    const c = canonical(p.id);
    members.set(c, [...(members.get(c) ?? []), p.id]);
  }
  const adjacency = new Map<string, Raw[]>();
  for (const [a, b, works] of pairs) {
    adjacency.set(a, [...(adjacency.get(a) ?? []), { id: b, works }]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), { id: a, works }]);
  }
  return {
    byId,
    members,
    canonical,
    upstream: (id) => [...(adjacency.get(id) ?? [])].sort((x, y) => x.id.localeCompare(y.id)),
  };
}

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function isCampus(ds: Dataset, id: string): boolean {
  return ds.byId.get(id)?.campus === true;
}

interface Collaborators {
  list: Raw[];
  /** Same, before the cap: used by "connect visible". */
  all: Raw[];
  cache: Cache;
  cacheHits: number;
  upstreamFetches: number;
  offCampusDropped: number;
  fragmentsMerged: number;
  overCapDropped: number;
}

function collaboratorsOf(ds: Dataset, cache: Cache, nodeId: string, maxPerNode: number): Collaborators {
  let next = cache;
  let cacheHits = 0;
  let upstreamFetches = 0;
  const raw: Raw[] = [];
  for (const member of ds.members.get(nodeId) ?? [nodeId]) {
    let hit = next[member];
    if (hit === undefined) {
      // An empty list is a valid cached answer ("fetched, nobody found"), so
      // authors without co-authors aren't refetched on every request.
      hit = ds.upstream(member);
      next = { ...next, [member]: hit };
      upstreamFetches++;
    } else {
      cacheHits++;
    }
    raw.push(...hit);
  }

  let fragmentsMerged = 0;
  const merged = new Map<string, number>();
  for (const c of raw) {
    const id = ds.canonical(c.id);
    if (id === nodeId) continue; // a fragment of this same person
    if (id !== c.id) fragmentsMerged++;
    merged.set(id, (merged.get(id) ?? 0) + c.works);
  }

  const candidates = [...merged].map(([id, works]) => ({ id, works }));
  const all = candidates
    .filter((c) => isCampus(ds, c.id))
    .sort((a, b) => b.works - a.works || a.id.localeCompare(b.id));
  return {
    list: all.slice(0, maxPerNode),
    all,
    cache: next,
    cacheHits,
    upstreamFetches,
    offCampusDropped: candidates.length - all.length,
    fragmentsMerged,
    overCapDropped: Math.max(0, all.length - maxPerNode),
  };
}

export function expand(ds: Dataset, cache: Cache, rootId: string, depth: number, maxPerNode: number): ExpandResult {
  if (!Number.isInteger(depth) || depth < 0 || depth > MAX_DEPTH) {
    return { ok: false, status: 422, message: `depth must be an integer from 0 to ${MAX_DEPTH}` };
  }
  if (!Number.isInteger(maxPerNode) || maxPerNode < 1) {
    return { ok: false, status: 422, message: "max_per_node must be a positive integer" };
  }
  const root = ds.canonical(rootId);
  if (!isCampus(ds, root)) {
    return { ok: false, status: 404, message: `${rootId} is not an on-campus author` };
  }

  let current = cache;
  const nodeDepth = new Map<string, number>([[root, 0]]);
  const edges = new Map<string, number>();
  const trace: LevelTrace[] = [];
  let frontier = [root];

  for (let level = 0; level < depth && frontier.length > 0; level++) {
    const row: LevelTrace = {
      level,
      expanded: frontier,
      cacheHits: 0,
      upstreamFetches: 0,
      offCampusDropped: 0,
      fragmentsMerged: 0,
      overCapDropped: 0,
      newNodes: 0,
    };
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      const c = collaboratorsOf(ds, current, nodeId, maxPerNode);
      current = c.cache;
      row.cacheHits += c.cacheHits;
      row.upstreamFetches += c.upstreamFetches;
      row.offCampusDropped += c.offCampusDropped;
      row.fragmentsMerged += c.fragmentsMerged;
      row.overCapDropped += c.overCapDropped;
      for (const { id, works } of c.list) {
        const key = edgeKey(nodeId, id);
        edges.set(key, Math.max(edges.get(key) ?? 0, works));
        if (!nodeDepth.has(id)) {
          nodeDepth.set(id, level + 1);
          nextFrontier.push(id);
          row.newNodes++;
        }
      }
    }
    trace.push(row);
    frontier = nextFrontier;
  }

  return { ok: true, graph: buildGraph(root, nodeDepth, edges), cache: current, trace };
}

function buildGraph(rootId: string, nodeDepth: Map<string, number>, edges: Map<string, number>): Graph {
  return {
    rootId,
    nodes: [...nodeDepth]
      .map(([id, depth]) => ({ id, depth }))
      .sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id)),
    edges: [...edges]
      .map(([key, weight]) => {
        const [source, target] = key.split("|");
        return { source, target, weight };
      })
      .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)),
  };
}

/**
 * Adds an expansion made from a node already in `graph`. `offset` is that node's
 * depth, so incoming depths become depths from the original root; a node keeps
 * the shorter of its two depths.
 */
export function mergeGraph(graph: Graph, incoming: Graph, offset: number): Graph {
  const depths = new Map(graph.nodes.map((n) => [n.id, n.depth]));
  for (const n of incoming.nodes) {
    const d = n.depth + offset;
    depths.set(n.id, Math.min(depths.get(n.id) ?? d, d));
  }
  const edges = new Map(graph.edges.map((e) => [edgeKey(e.source, e.target), e.weight]));
  for (const e of incoming.edges) {
    const key = edgeKey(e.source, e.target);
    edges.set(key, Math.max(edges.get(key) ?? 0, e.weight));
  }
  return buildGraph(graph.rootId, depths, edges);
}

/** Edges among the nodes already shown. Adds no nodes. */
export function connectVisible(
  ds: Dataset,
  cache: Cache,
  graph: Graph,
): { graph: Graph; cache: Cache; added: number; cacheHits: number; upstreamFetches: number } {
  const visible = new Set(graph.nodes.map((n) => n.id));
  const edges = new Map(graph.edges.map((e) => [edgeKey(e.source, e.target), e.weight]));
  const before = edges.size;
  let current = cache;
  let cacheHits = 0;
  let upstreamFetches = 0;
  for (const { id } of graph.nodes) {
    const c = collaboratorsOf(ds, current, id, Number.MAX_SAFE_INTEGER);
    current = c.cache;
    cacheHits += c.cacheHits;
    upstreamFetches += c.upstreamFetches;
    for (const other of c.all) {
      if (!visible.has(other.id)) continue;
      const key = edgeKey(id, other.id);
      edges.set(key, Math.max(edges.get(key) ?? 0, other.works));
    }
  }
  const depths = new Map(graph.nodes.map((n) => [n.id, n.depth]));
  return {
    graph: buildGraph(graph.rootId, depths, edges),
    cache: current,
    added: edges.size - before,
    cacheHits,
    upstreamFetches,
  };
}

/** Fills the cache for every record up front, so expansions never go upstream. */
export function prewarm(ds: Dataset): Cache {
  const cache: Cache = {};
  for (const [id, person] of ds.byId) {
    if (person.campus) cache[id] = ds.upstream(id);
  }
  return cache;
}

/** Case-insensitive substring search over canonical on-campus people, most works first. */
export function search(ds: Dataset, query: string, limit = 8): Person[] {
  const q = query.trim().toLowerCase();
  return [...ds.byId.values()]
    .filter((p) => p.campus && ds.canonical(p.id) === p.id && p.name.toLowerCase().includes(q))
    .sort((a, b) => b.works - a.works || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Display totals for a merged person: the canonical record plus folded fragments. */
export function personTotals(ds: Dataset, id: string): { person: Person; works: number; citations: number; records: number } {
  const ids = ds.members.get(id) ?? [id];
  const records = ids.map((m) => ds.byId.get(m)).filter((p): p is Person => p !== undefined);
  const person = ds.byId.get(id);
  if (!person) throw new Error(`unknown person ${id}`);
  return {
    person,
    works: records.reduce((s, p) => s + p.works, 0),
    citations: records.reduce((s, p) => s + p.citations, 0),
    records: records.length,
  };
}

/**
 * Radial layout: the root at the center and one ring per depth. Nodes on each
 * ring are ordered by the angle of their strongest link to the ring inside it,
 * which keeps branches together and edges short.
 */
export function layout(graph: Graph, size: number): Map<string, { x: number; y: number }> {
  const center = size / 2;
  const radii = [0, size * 0.2, size * 0.33, size * 0.44];
  const positions = new Map<string, { x: number; y: number }>();
  const angles = new Map<string, number>();
  const byDepth = new Map<number, string[]>();
  for (const n of graph.nodes) byDepth.set(n.depth, [...(byDepth.get(n.depth) ?? []), n.id]);
  const depthOf = new Map(graph.nodes.map((n) => [n.id, n.depth]));

  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const ring = byDepth.get(depth) ?? [];
    if (depth === 0) {
      for (const id of ring) {
        positions.set(id, { x: center, y: center });
        angles.set(id, -Math.PI / 2);
      }
      continue;
    }
    const parentAngle = (id: string) => {
      let best: { angle: number; weight: number } | null = null;
      for (const e of graph.edges) {
        const other = e.source === id ? e.target : e.target === id ? e.source : null;
        if (other === null || depthOf.get(other) !== depth - 1) continue;
        const angle = angles.get(other) ?? 0;
        if (!best || e.weight > best.weight) best = { angle, weight: e.weight };
      }
      return best?.angle ?? 0;
    };
    const ordered = ring
      .map((id) => ({ id, key: parentAngle(id) }))
      .sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));
    const radius = radii[Math.min(depth, radii.length - 1)];
    const start = depth === 1 ? -Math.PI / 2 : (ordered[0]?.key ?? 0);
    ordered.forEach(({ id }, i) => {
      const angle = start + (2 * Math.PI * i) / ordered.length;
      angles.set(id, angle);
      positions.set(id, { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) });
    });
  }
  return positions;
}
