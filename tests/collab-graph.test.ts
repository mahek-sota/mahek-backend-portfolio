import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coauthorships, merges, people } from "../lib/collab-data.ts";
import {
  MAX_DEPTH,
  connectVisible,
  createDataset,
  expand,
  layout,
  mergeGraph,
  prewarm,
  search,
  type ExpandResult,
} from "../lib/collab-graph.ts";

const ds = createDataset(people, merges, coauthorships);

function ok(result: ExpandResult) {
  assert.ok(result.ok, result.ok ? "" : result.message);
  return result;
}

describe("dataset", () => {
  it("has only known ids in co-authorships", () => {
    for (const [a, b, w] of coauthorships) {
      assert.ok(ds.byId.has(a) && ds.byId.has(b), `${a}–${b}`);
      assert.ok(Number.isInteger(w) && w > 0);
    }
  });
});

describe("expand", () => {
  it("returns only the root at depth 0", () => {
    const r = ok(expand(ds, {}, "R01", 0, 5));
    assert.deepEqual(r.graph.nodes, [{ id: "R01", depth: 0 }]);
    assert.equal(r.graph.edges.length, 0);
  });

  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    it(`keeps every node within ${depth} hop(s), on campus, canonical, and without self-loops`, () => {
      const r = ok(expand(ds, {}, "R01", depth, 5));
      for (const n of r.graph.nodes) {
        assert.ok(n.depth <= depth);
        assert.equal(ds.byId.get(n.id)?.campus, true, `${n.id} is off campus`);
        assert.equal(ds.canonical(n.id), n.id, `${n.id} is a merged fragment`);
      }
      const keys = r.graph.edges.map((e) => `${e.source}|${e.target}`);
      assert.equal(new Set(keys).size, keys.length);
      for (const e of r.graph.edges) assert.ok(e.source < e.target);
    });
  }

  it("gives each node its shortest discovered depth", () => {
    const r = ok(expand(ds, {}, "R01", 3, 10));
    const depth = new Map(r.graph.nodes.map((n) => [n.id, n.depth]));
    for (const e of r.graph.edges) {
      assert.ok(Math.abs(depth.get(e.source)! - depth.get(e.target)!) <= 1, `${e.source}–${e.target} skips a ring`);
    }
  });

  it("caps each expanded node's contribution and reports what was dropped", () => {
    const uncapped = ok(expand(ds, {}, "R01", 1, 100));
    const capped = ok(expand(ds, {}, "R01", 1, 3));
    assert.equal(capped.graph.edges.length, 3);
    assert.equal(capped.trace[0].overCapDropped, uncapped.graph.edges.length - 3);
    // The kept collaborators are the ones with the most shared works.
    const top = [...uncapped.graph.edges].sort((a, b) => b.weight - a.weight).slice(0, 3);
    assert.deepEqual(
      capped.graph.edges.map((e) => e.weight).sort((a, b) => b - a),
      top.map((e) => e.weight),
    );
  });

  it("filters off-campus co-authors and counts them", () => {
    const r = ok(expand(ds, {}, "R01", 1, 100));
    assert.ok(r.trace[0].offCampusDropped >= 2);
    assert.ok(!r.graph.nodes.some((n) => n.id.startsWith("X")));
  });

  it("folds a duplicate identity into its canonical person and sums shared works", () => {
    const r = ok(expand(ds, {}, "R02", 1, 100));
    const edge = r.graph.edges.find((e) => e.source === "R02" && e.target === "R22");
    assert.equal(edge?.weight, 7 + 3);
    assert.ok(r.trace[0].fragmentsMerged >= 1);
    assert.ok(!r.graph.nodes.some((n) => n.id === "R22b"));
  });

  it("expanding a canonical person includes its fragment's co-authors", () => {
    const r = ok(expand(ds, {}, "R22", 1, 100));
    // R22b co-authored with R09; R22 itself never did.
    assert.ok(r.graph.nodes.some((n) => n.id === "R09"));
  });

  it("resolves a fragment id used as the root", () => {
    const r = ok(expand(ds, {}, "R22b", 1, 5));
    assert.equal(r.graph.rootId, "R22");
  });

  it("rejects off-campus or unknown roots with 404 and bad parameters with 422", () => {
    for (const id of ["X01", "nope"]) {
      const r = expand(ds, {}, id, 1, 5);
      assert.equal(r.ok ? 0 : r.status, 404);
    }
    for (const [depth, cap] of [[4, 5], [-1, 5], [1.5, 5], [1, 0]] as const) {
      const r = expand(ds, {}, "R01", depth, cap);
      assert.equal(r.ok ? 0 : r.status, 422);
    }
  });

  it("is deterministic", () => {
    assert.deepEqual(expand(ds, {}, "R05", 3, 4), expand(ds, {}, "R05", 3, 4));
  });
});

describe("cache", () => {
  it("serves a repeated expansion entirely from cache with an identical graph", () => {
    const cold = ok(expand(ds, {}, "R01", 2, 5));
    assert.ok(cold.trace.every((t) => t.cacheHits === 0));
    const warm = ok(expand(ds, cold.cache, "R01", 2, 5));
    assert.deepEqual(warm.graph, cold.graph);
    assert.equal(warm.trace.reduce((s, t) => s + t.upstreamFetches, 0), 0);
  });

  it("never goes upstream after a pre-warm", () => {
    const cache = prewarm(ds);
    for (const p of people.filter((x) => x.campus)) {
      const r = ok(expand(ds, cache, p.id, 3, 5));
      assert.equal(r.trace.reduce((s, t) => s + t.upstreamFetches, 0), 0, p.id);
    }
  });

  it("caches an empty result instead of refetching it", () => {
    const lonely = createDataset(
      [{ id: "L1", name: "Solo", department: "x", works: 1, citations: 0, hIndex: 1, orcid: null, campus: true }],
      {},
      [],
    );
    const first = ok(expand(lonely, {}, "L1", 1, 5));
    const second = ok(expand(lonely, first.cache, "L1", 1, 5));
    assert.equal(first.trace[0].upstreamFetches, 1);
    assert.equal(second.trace[0].upstreamFetches, 0);
  });
});

describe("incremental exploration", () => {
  it("merges an expansion from a visible node, keeping shorter depths", () => {
    const base = ok(expand(ds, {}, "R01", 1, 3));
    const from = base.graph.nodes.find((n) => n.depth === 1)!;
    const more = ok(expand(ds, base.cache, from.id, 1, 3));
    const merged = mergeGraph(base.graph, more.graph, from.depth);
    assert.equal(merged.nodes.find((n) => n.id === "R01")?.depth, 0);
    assert.ok(merged.nodes.length >= base.graph.nodes.length);
    for (const e of base.graph.edges) {
      assert.ok(merged.edges.some((m) => m.source === e.source && m.target === e.target));
    }
  });

  it("connect visible adds edges among shown nodes only", () => {
    const base = ok(expand(ds, {}, "R01", 2, 2));
    const linked = connectVisible(ds, base.cache, base.graph);
    assert.deepEqual(
      linked.graph.nodes.map((n) => n.id),
      base.graph.nodes.map((n) => n.id),
    );
    assert.equal(linked.graph.edges.length, base.graph.edges.length + linked.added);
    assert.ok(linked.added > 0, "the cap should have hidden some edges");
  });
});

describe("search and layout", () => {
  it("finds canonical on-campus people, most works first", () => {
    const results = search(ds, "o");
    assert.ok(results.length > 0);
    assert.ok(results.every((p) => p.campus && ds.canonical(p.id) === p.id));
    for (let i = 1; i < results.length; i++) assert.ok(results[i - 1].works >= results[i].works);
    assert.deepEqual(search(ds, "okafor").map((p) => p.id), ["R22"]);
  });

  it("places every node inside the canvas, with the root at the center", () => {
    const r = ok(expand(ds, {}, "R01", 3, 10));
    const pos = layout(r.graph, 640);
    assert.equal(pos.size, r.graph.nodes.length);
    assert.deepEqual(pos.get("R01"), { x: 320, y: 320 });
    for (const { x, y } of pos.values()) assert.ok(x > 0 && x < 640 && y > 0 && y < 640);
  });
});
