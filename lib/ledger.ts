// Browser-local model of idempotent transaction handling, used by the
// illustrative demo. Pure functions over plain JSON state: every operation takes
// a state and returns a new one, so the same sequence of requests always produces
// the same state.
//
// Rules this module enforces:
// - Amounts are positive integers in minor units (cents). No floats.
// - The balance is never stored; it is the sum of ledger entries.
// - Entries are append-only. A reversal adds a compensating entry and leaves the
//   original in place.
// - A key replayed with the same payload returns the stored response and changes
//   nothing. The same key with a different payload is a 409.
// - A transaction can be reversed once. Later reversal attempts change nothing.
// - Requests that fail validation are not stored, so the key stays usable.

export type Kind = "credit" | "debit";
export type Operation = "create" | "reverse";

export const CURRENCY = "USD";
export const MAX_AMOUNT_MINOR = 100_000_000; // $1,000,000.00
export const MAX_ENTRIES = 500;
const MAX_LOG = 50;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const MAX_MEMO = 80;

export interface CreateRequest {
  idempotencyKey: string;
  kind: Kind;
  amountMinor: number;
  memo: string;
}

export interface ReverseRequest {
  idempotencyKey: string;
  transactionId: string;
}

export interface Entry {
  id: string;
  seq: number;
  transactionId: string;
  type: "posting" | "reversal";
  /** Signed: credits positive, debits negative. */
  amountMinor: number;
  reversesEntryId: string | null;
}

export interface Transaction {
  id: string;
  kind: Kind;
  amountMinor: number;
  memo: string;
  status: "posted" | "reversed";
  entryIds: string[];
}

export interface ApiResponse {
  status: 200 | 201 | 404 | 409 | 422;
  body: Record<string, unknown>;
}

export interface IdempotencyRecord {
  key: string;
  operation: Operation;
  fingerprint: string;
  response: ApiResponse;
  seq: number;
  replays: number;
}

export interface LogItem {
  seq: number;
  request: string;
  key: string;
  status: ApiResponse["status"];
  replayed: boolean;
  balanceChangeMinor: number;
}

export interface LedgerState {
  version: 1;
  seq: number;
  nextTransaction: number;
  nextEntry: number;
  transactions: Transaction[];
  entries: Entry[];
  idempotency: IdempotencyRecord[];
  log: LogItem[];
}

export interface Result {
  state: LedgerState;
  response: ApiResponse;
  /** True when the response was served from a stored idempotency record. */
  replayed: boolean;
}

export function initialState(): LedgerState {
  return {
    version: 1,
    seq: 0,
    nextTransaction: 1,
    nextEntry: 1,
    transactions: [],
    entries: [],
    idempotency: [],
    log: [],
  };
}

export function balance(state: LedgerState): number {
  return state.entries.reduce((sum, entry) => sum + entry.amountMinor, 0);
}

/** JSON with object keys sorted at every level, so equal payloads compare equal. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Short FNV-1a hash for display. Comparisons use the full canonical string. */
export function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function formatMinor(amountMinor: number): string {
  const sign = amountMinor < 0 ? "−" : "";
  const abs = Math.abs(amountMinor);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const cents = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars}.${cents}`;
}

/** API representations use snake_case, matching the request fields. */
function txnBody(txn: Transaction) {
  return {
    id: txn.id,
    kind: txn.kind,
    amount_minor: txn.amountMinor,
    currency: CURRENCY,
    memo: txn.memo,
    status: txn.status,
    entry_ids: txn.entryIds,
  };
}

function entryBody(entry: Entry) {
  return {
    id: entry.id,
    transaction_id: entry.transactionId,
    type: entry.type,
    amount_minor: entry.amountMinor,
    reverses_entry_id: entry.reversesEntryId,
  };
}

function error(status: ApiResponse["status"], code: string, message: string, extra: Record<string, unknown> = {}): ApiResponse {
  return { status, body: { error: { code, message, ...extra } } };
}

function validateKey(key: string): ApiResponse | null {
  if (!KEY_PATTERN.test(key)) {
    return error(422, "invalid_idempotency_key", "Use 1–64 characters: letters, digits, '.', '_', ':' or '-'.");
  }
  return null;
}

function validateCreate(req: CreateRequest): ApiResponse | null {
  const keyError = validateKey(req.idempotencyKey);
  if (keyError) return keyError;
  if (req.kind !== "credit" && req.kind !== "debit") {
    return error(422, "invalid_kind", "kind must be 'credit' or 'debit'.");
  }
  if (!Number.isSafeInteger(req.amountMinor)) {
    return error(422, "invalid_amount", "amount_minor must be an integer number of cents.");
  }
  if (req.amountMinor <= 0 || req.amountMinor > MAX_AMOUNT_MINOR) {
    return error(422, "invalid_amount", `amount_minor must be between 1 and ${MAX_AMOUNT_MINOR}.`);
  }
  if (req.memo.trim().length > MAX_MEMO) {
    return error(422, "invalid_memo", `memo must be at most ${MAX_MEMO} characters.`);
  }
  return null;
}

function fingerprint(operation: Operation, payload: Record<string, unknown>): string {
  return canonicalJson({ operation, ...payload });
}

function describe(operation: Operation, req: CreateRequest | ReverseRequest): string {
  return operation === "create"
    ? "POST /transactions"
    : `POST /transactions/${(req as ReverseRequest).transactionId}/reverse`;
}

function withLog(state: LedgerState, item: Omit<LogItem, "seq">): LedgerState {
  const log = [...state.log, { seq: state.seq, ...item }];
  return { ...state, log: log.slice(-MAX_LOG) };
}

/**
 * Shared path for both operations: validation, then idempotency lookup, then
 * the operation itself. `execute` runs only for a key that has never been used.
 */
function handle(
  state: LedgerState,
  operation: Operation,
  req: CreateRequest | ReverseRequest,
  payload: Record<string, unknown>,
  invalid: ApiResponse | null,
  execute: (state: LedgerState) => { state: LedgerState; response: ApiResponse; store: boolean },
): Result {
  const next: LedgerState = { ...state, seq: state.seq + 1 };
  const request = describe(operation, req);
  const key = req.idempotencyKey;
  const before = balance(state);

  if (invalid) {
    return {
      state: withLog(next, { request, key, status: invalid.status, replayed: false, balanceChangeMinor: 0 }),
      response: invalid,
      replayed: false,
    };
  }

  const print = fingerprint(operation, payload);
  const existing = state.idempotency.find((r) => r.key === key);
  if (existing) {
    if (existing.fingerprint !== print) {
      const response = error(409, "idempotency_key_reused", "This key was already used with a different request.", {
        original_request_hash: shortHash(existing.fingerprint),
        this_request_hash: shortHash(print),
      });
      return {
        state: withLog(next, { request, key, status: 409, replayed: false, balanceChangeMinor: 0 }),
        response,
        replayed: false,
      };
    }
    const idempotency = state.idempotency.map((r) => (r === existing ? { ...r, replays: r.replays + 1 } : r));
    return {
      state: withLog(
        { ...next, idempotency },
        { request, key, status: existing.response.status, replayed: true, balanceChangeMinor: 0 },
      ),
      response: existing.response,
      replayed: true,
    };
  }

  const outcome = execute(next);
  let after = outcome.state;
  if (outcome.store) {
    const record: IdempotencyRecord = {
      key,
      operation,
      fingerprint: print,
      response: outcome.response,
      seq: next.seq,
      replays: 0,
    };
    after = { ...after, idempotency: [...after.idempotency, record] };
  }
  return {
    state: withLog(after, {
      request,
      key,
      status: outcome.response.status,
      replayed: false,
      balanceChangeMinor: balance(after) - before,
    }),
    response: outcome.response,
    replayed: false,
  };
}

export function createTransaction(state: LedgerState, req: CreateRequest): Result {
  const memo = typeof req.memo === "string" ? req.memo.trim() : "";
  const payload = { kind: req.kind, amount_minor: req.amountMinor, currency: CURRENCY, memo };
  let invalid = validateCreate({ ...req, memo });
  if (!invalid && state.entries.length >= MAX_ENTRIES) {
    invalid = error(422, "demo_limit_reached", "The demo holds at most 500 entries. Reset to continue.");
  }

  return handle(state, "create", req, payload, invalid, (s) => {
    const txnId = `txn_${String(s.nextTransaction).padStart(4, "0")}`;
    const entryId = `ent_${String(s.nextEntry).padStart(4, "0")}`;
    const signed = req.kind === "credit" ? req.amountMinor : -req.amountMinor;
    const entry: Entry = {
      id: entryId,
      seq: s.seq,
      transactionId: txnId,
      type: "posting",
      amountMinor: signed,
      reversesEntryId: null,
    };
    const txn: Transaction = {
      id: txnId,
      kind: req.kind,
      amountMinor: req.amountMinor,
      memo,
      status: "posted",
      entryIds: [entryId],
    };
    const next: LedgerState = {
      ...s,
      nextTransaction: s.nextTransaction + 1,
      nextEntry: s.nextEntry + 1,
      transactions: [...s.transactions, txn],
      entries: [...s.entries, entry],
    };
    return {
      state: next,
      response: { status: 201, body: { transaction: txnBody(txn), entry: entryBody(entry), balance_minor: balance(next) } },
      store: true,
    };
  });
}

export function reverseTransaction(state: LedgerState, req: ReverseRequest): Result {
  const payload = { transaction_id: req.transactionId };
  let invalid = validateKey(req.idempotencyKey);
  if (!invalid && state.entries.length >= MAX_ENTRIES) {
    invalid = error(422, "demo_limit_reached", "The demo holds at most 500 entries. Reset to continue.");
  }

  return handle(state, "reverse", req, payload, invalid, (s) => {
    const txn = s.transactions.find((t) => t.id === req.transactionId);
    if (!txn) {
      // Nothing was executed, so the key is not consumed.
      return { state: s, response: error(404, "transaction_not_found", "No such transaction."), store: false };
    }
    if (txn.status === "reversed") {
      const reversal = s.entries.find((e) => e.transactionId === txn.id && e.type === "reversal");
      return {
        state: s,
        response: error(409, "already_reversed", "This transaction has already been reversed.", {
          reversal_entry_id: reversal?.id ?? null,
        }),
        store: true,
      };
    }
    const original = s.entries.find((e) => e.id === txn.entryIds[0]);
    if (!original) throw new Error(`ledger corrupt: ${txn.id} has no posting entry`);
    const entry: Entry = {
      id: `ent_${String(s.nextEntry).padStart(4, "0")}`,
      seq: s.seq,
      transactionId: txn.id,
      type: "reversal",
      amountMinor: -original.amountMinor,
      reversesEntryId: original.id,
    };
    const reversed: Transaction = { ...txn, status: "reversed", entryIds: [...txn.entryIds, entry.id] };
    const next: LedgerState = {
      ...s,
      nextEntry: s.nextEntry + 1,
      transactions: s.transactions.map((t) => (t.id === txn.id ? reversed : t)),
      entries: [...s.entries, entry],
    };
    return {
      state: next,
      response: { status: 201, body: { transaction: txnBody(reversed), entry: entryBody(entry), balance_minor: balance(next) } },
      store: true,
    };
  });
}

/** Checks the invariants the demo promises. Returns a list of violations. */
export function checkInvariants(state: LedgerState): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const entry of state.entries) {
    if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor === 0) {
      problems.push(`${entry.id}: amount is not a non-zero integer`);
    }
    if (ids.has(entry.id)) problems.push(`${entry.id}: duplicate entry id`);
    ids.add(entry.id);
  }
  for (const txn of state.transactions) {
    const entries = state.entries.filter((e) => e.transactionId === txn.id);
    const reversals = entries.filter((e) => e.type === "reversal");
    if (reversals.length > 1) problems.push(`${txn.id}: reversed more than once`);
    if ((txn.status === "reversed") !== (reversals.length === 1)) {
      problems.push(`${txn.id}: status does not match its entries`);
    }
    const net = entries.reduce((sum, e) => sum + e.amountMinor, 0);
    if (txn.status === "reversed" && net !== 0) problems.push(`${txn.id}: reversal does not net to zero`);
  }
  const keys = new Set<string>();
  for (const record of state.idempotency) {
    if (keys.has(record.key)) problems.push(`${record.key}: duplicate idempotency record`);
    keys.add(record.key);
  }
  return problems;
}

/** Parses persisted state, returning null for anything malformed or inconsistent. */
export function parseState(raw: string | null): LedgerState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LedgerState>;
    if (
      value?.version !== 1 ||
      !Number.isSafeInteger(value.seq) ||
      !Number.isSafeInteger(value.nextTransaction) ||
      !Number.isSafeInteger(value.nextEntry) ||
      !Array.isArray(value.transactions) ||
      !Array.isArray(value.entries) ||
      !Array.isArray(value.idempotency) ||
      !Array.isArray(value.log)
    ) {
      return null;
    }
    const state = value as LedgerState;
    return checkInvariants(state).length === 0 ? state : null;
  } catch {
    return null;
  }
}
