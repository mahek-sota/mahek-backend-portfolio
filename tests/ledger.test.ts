import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_AMOUNT_MINOR,
  balance,
  canonicalJson,
  checkInvariants,
  createTransaction,
  formatMinor,
  initialState,
  parseState,
  reverseTransaction,
  type CreateRequest,
  type LedgerState,
} from "../lib/ledger.ts";

const credit = (key: string, amountMinor: number, memo = "sample"): CreateRequest => ({
  idempotencyKey: key,
  kind: "credit",
  amountMinor,
  memo,
});

function apply(state: LedgerState, ...requests: CreateRequest[]): LedgerState {
  return requests.reduce((s, r) => createTransaction(s, r).state, state);
}

describe("creating transactions", () => {
  it("applies a new key once and derives the balance from entries", () => {
    const { state, response, replayed } = createTransaction(initialState(), credit("order-1", 12_50));
    assert.equal(response.status, 201);
    assert.equal(replayed, false);
    assert.equal(balance(state), 12_50);
    assert.equal(state.entries.length, 1);
  });

  it("debits are negative entries", () => {
    let state = apply(initialState(), credit("a", 10_00));
    state = createTransaction(state, { idempotencyKey: "b", kind: "debit", amountMinor: 3_25, memo: "" }).state;
    assert.equal(balance(state), 6_75);
    assert.equal(state.entries[1].amountMinor, -3_25);
  });
});

describe("retrying with the same key", () => {
  it("returns the stored response without changing the ledger", () => {
    const first = createTransaction(initialState(), credit("order-1", 12_50));
    const retry = createTransaction(first.state, credit("order-1", 12_50));

    assert.equal(retry.replayed, true);
    assert.deepEqual(retry.response, first.response);
    assert.deepEqual(retry.state.entries, first.state.entries);
    assert.deepEqual(retry.state.transactions, first.state.transactions);
    assert.equal(balance(retry.state), 12_50);
    assert.equal(retry.state.idempotency[0].replays, 1);
  });

  it("treats payloads that differ only in memo whitespace as the same request", () => {
    const first = createTransaction(initialState(), credit("k", 500, "rent"));
    const retry = createTransaction(first.state, credit("k", 500, "  rent "));
    assert.equal(retry.replayed, true);
    assert.equal(balance(retry.state), 500);
  });

  it("survives many retries with exactly one balance change", () => {
    let state = initialState();
    for (let i = 0; i < 25; i++) state = createTransaction(state, credit("k", 1_00)).state;
    assert.equal(balance(state), 1_00);
    assert.equal(state.entries.length, 1);
    assert.equal(state.idempotency[0].replays, 24);
  });
});

describe("reusing a key with a different payload", () => {
  for (const [name, changed] of [
    ["amount", credit("order-1", 99_99)],
    ["memo", credit("order-1", 12_50, "something else")],
    ["kind", { ...credit("order-1", 12_50), kind: "debit" } as CreateRequest],
  ] as const) {
    it(`returns 409 when the ${name} changes, and leaves the ledger untouched`, () => {
      const first = createTransaction(initialState(), credit("order-1", 12_50));
      const conflict = createTransaction(first.state, changed);

      assert.equal(conflict.response.status, 409);
      assert.equal((conflict.response.body.error as { code: string }).code, "idempotency_key_reused");
      assert.deepEqual(conflict.state.entries, first.state.entries);
      assert.deepEqual(conflict.state.idempotency, first.state.idempotency);
      assert.equal(balance(conflict.state), 12_50);
    });
  }

  it("treats a key used for a reversal as taken for transaction creation", () => {
    let state = apply(initialState(), credit("pay-1", 4_00));
    state = reverseTransaction(state, { idempotencyKey: "shared", transactionId: "txn_0001" }).state;
    const reuse = createTransaction(state, credit("shared", 4_00));
    assert.equal(reuse.response.status, 409);
    assert.equal(balance(reuse.state), 0);
  });
});

describe("validation", () => {
  for (const [name, amount] of [
    ["fractional", 12.5],
    ["zero", 0],
    ["negative", -100],
    ["over-limit", MAX_AMOUNT_MINOR + 1],
    ["unsafe-integer", Number.MAX_SAFE_INTEGER + 2],
    ["NaN", Number.NaN],
  ] as const) {
    it(`rejects ${name} amounts with 422 without consuming the key`, () => {
      const rejected = createTransaction(initialState(), credit("k", amount));
      assert.equal(rejected.response.status, 422);
      assert.equal(rejected.state.idempotency.length, 0);
      assert.equal(rejected.state.entries.length, 0);

      const valid = createTransaction(rejected.state, credit("k", 1_00));
      assert.equal(valid.response.status, 201);
    });
  }

  it("rejects malformed idempotency keys", () => {
    for (const key of ["", "has space", "x".repeat(65)]) {
      assert.equal(createTransaction(initialState(), credit(key, 100)).response.status, 422);
    }
  });
});

describe("reversals", () => {
  it("adds a compensating entry and preserves the original", () => {
    const created = createTransaction(initialState(), credit("pay-1", 40_00));
    const reversed = reverseTransaction(created.state, { idempotencyKey: "rev-1", transactionId: "txn_0001" });

    assert.equal(reversed.response.status, 201);
    assert.equal(balance(reversed.state), 0);
    assert.equal(reversed.state.entries.length, 2);
    assert.deepEqual(reversed.state.entries[0], created.state.entries[0]);
    assert.equal(reversed.state.entries[1].amountMinor, -40_00);
    assert.equal(reversed.state.entries[1].reversesEntryId, "ent_0001");
    assert.equal(reversed.state.transactions[0].status, "reversed");
  });

  it("replays a repeated reversal with the same key without another balance change", () => {
    let state = apply(initialState(), credit("pay-1", 40_00), credit("pay-2", 5_00));
    state = reverseTransaction(state, { idempotencyKey: "rev-1", transactionId: "txn_0001" }).state;
    const again = reverseTransaction(state, { idempotencyKey: "rev-1", transactionId: "txn_0001" });

    assert.equal(again.replayed, true);
    assert.equal(balance(again.state), 5_00);
    assert.equal(again.state.entries.length, 3);
  });

  it("refuses a second reversal under a new key", () => {
    let state = apply(initialState(), credit("pay-1", 40_00));
    state = reverseTransaction(state, { idempotencyKey: "rev-1", transactionId: "txn_0001" }).state;
    const second = reverseTransaction(state, { idempotencyKey: "rev-2", transactionId: "txn_0001" });

    assert.equal(second.response.status, 409);
    assert.equal((second.response.body.error as { code: string }).code, "already_reversed");
    assert.equal(balance(second.state), 0);
    assert.equal(second.state.entries.length, 2);

    // The refusal is itself stored, so retrying rev-2 replays the 409.
    const retry = reverseTransaction(second.state, { idempotencyKey: "rev-2", transactionId: "txn_0001" });
    assert.equal(retry.replayed, true);
    assert.equal(retry.response.status, 409);
  });

  it("returns 404 for an unknown transaction without consuming the key", () => {
    const missing = reverseTransaction(initialState(), { idempotencyKey: "rev-x", transactionId: "txn_9999" });
    assert.equal(missing.response.status, 404);
    assert.equal(missing.state.idempotency.length, 0);
  });
});

describe("invariants over a long deterministic sequence", () => {
  // Small linear congruential generator so the sequence is identical on every run.
  function* random(seed: number) {
    let x = seed;
    for (;;) {
      x = (Math.imul(x, 1_103_515_245) + 12_345) >>> 0;
      yield x / 2 ** 32;
    }
  }

  function run(seed: number): LedgerState {
    const rnd = random(seed);
    const next = () => rnd.next().value as number;
    let state = initialState();
    for (let i = 0; i < 400; i++) {
      const before = state;
      const keyNo = Math.floor(next() * 40);
      const roll = next();
      const result =
        roll < 0.6
          ? createTransaction(state, {
              idempotencyKey: `k-${keyNo}`,
              kind: next() < 0.7 ? "credit" : "debit",
              amountMinor: 1 + Math.floor(next() * 3) * 100, // few distinct payloads → frequent replays and conflicts
              memo: "",
            })
          : reverseTransaction(state, {
              idempotencyKey: `r-${keyNo}`,
              transactionId: `txn_${String(1 + Math.floor(next() * 30)).padStart(4, "0")}`,
            });
      state = result.state;

      assert.deepEqual(checkInvariants(state), []);
      // Append-only: every earlier entry is still present and unchanged.
      assert.deepEqual(state.entries.slice(0, before.entries.length), before.entries);
      // Only a fresh 201 may move the balance.
      if (result.replayed || result.response.status !== 201) {
        assert.equal(balance(state), balance(before));
      }
    }
    return state;
  }

  it("holds after every step and is reproducible", () => {
    const a = run(42);
    const b = run(42);
    assert.deepEqual(a, b);
    assert.ok(a.entries.length > 20, "sequence should exercise the ledger");
    assert.ok(a.log.some((l) => l.replayed), "sequence should include replays");
    assert.ok(a.log.some((l) => l.status === 409), "sequence should include conflicts");
  });
});

describe("persistence and helpers", () => {
  it("round-trips through JSON and rejects corrupt state", () => {
    const state = apply(initialState(), credit("a", 1_00), credit("b", 2_00));
    assert.deepEqual(parseState(JSON.stringify(state)), state);
    assert.equal(parseState(null), null);
    assert.equal(parseState("{not json"), null);
    assert.equal(parseState(JSON.stringify({ ...state, version: 2 })), null);

    const tampered = structuredClone(state);
    tampered.entries[0].amountMinor = 1.5;
    assert.equal(parseState(JSON.stringify(tampered)), null);
  });

  it("canonicalizes key order", () => {
    assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("formats minor units without floating point", () => {
    assert.equal(formatMinor(0), "$0.00");
    assert.equal(formatMinor(5), "$0.05");
    assert.equal(formatMinor(123_456_78), "$123,456.78");
    assert.equal(formatMinor(-1_250), "−$12.50");
  });
});
