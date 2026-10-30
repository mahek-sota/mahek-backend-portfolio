"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";

import {
  balance,
  createTransaction,
  formatMinor,
  initialState,
  reverseTransaction,
  shortHash,
  type ApiResponse,
  type CreateRequest,
  type Kind,
  type LedgerState,
  type Result,
  type ReverseRequest,
} from "@/lib/ledger";
import { commit, getServerSnapshot, getSnapshot, subscribe } from "./store";

type SentRequest = { op: "create"; req: CreateRequest } | { op: "reverse"; req: ReverseRequest };

interface Exchange {
  sent: SentRequest;
  result: Result;
}

const statusText: Record<ApiResponse["status"], string> = {
  200: "OK",
  201: "Created",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Content",
};

function unusedKey(state: LedgerState, prefix: string, start = 1): string {
  const used = new Set(state.idempotency.map((r) => r.key));
  let n = start;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

function parseAmount(value: string): number {
  const trimmed = value.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed);
}

export function IdempotencyDemo() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [key, setKey] = useState("order-1001");
  const [kind, setKind] = useState<Kind>("credit");
  const [amount, setAmount] = useState("2500");
  const [memo, setMemo] = useState("Sample deposit");
  const [last, setLast] = useState<Exchange | null>(null);
  const [lastCreate, setLastCreate] = useState<CreateRequest | null>(null);
  const formId = useId();

  function send(sent: SentRequest) {
    const result =
      sent.op === "create" ? createTransaction(getSnapshot(), sent.req) : reverseTransaction(getSnapshot(), sent.req);
    commit(result.state);
    setLast({ sent, result });
    if (sent.op === "create") setLastCreate(sent.req);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send({ op: "create", req: { idempotencyKey: key.trim(), kind, amountMinor: parseAmount(amount), memo } });
  }

  function conflictingRetry() {
    if (!lastCreate) return;
    const changed = { ...lastCreate, amountMinor: Number.isSafeInteger(lastCreate.amountMinor) ? lastCreate.amountMinor + 100 : 100 };
    send({ op: "create", req: changed });
  }

  function reset() {
    commit(initialState());
    setLast(null);
    setLastCreate(null);
    setKey("order-1001");
  }

  const parsedAmount = parseAmount(amount);
  const amountHint = Number.isSafeInteger(parsedAmount) && parsedAmount > 0 ? `= ${formatMinor(parsedAmount)}` : "whole cents only";

  return (
    <div className="demo">
      <div className="demo-grid">
        <section className="demo-panel" aria-labelledby={`${formId}-request`}>
          <h2 id={`${formId}-request`} className="demo-heading">
            Request
          </h2>
          <p className="demo-endpoint">
            <code>POST /transactions</code>
          </p>
          <form onSubmit={onSubmit} className="demo-form">
            <div className="field">
              <label htmlFor={`${formId}-key`}>Idempotency-Key</label>
              <div className="field-row">
                <input
                  id={`${formId}-key`}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" className="button button--quiet" onClick={() => setKey(unusedKey(state, "order-", 1001))}>
                  New key
                </button>
              </div>
            </div>
            <div className="field-pair">
              <div className="field">
                <label htmlFor={`${formId}-kind`}>kind</label>
                <select id={`${formId}-kind`} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  <option value="credit">credit</option>
                  <option value="debit">debit</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${formId}-amount`}>amount_minor</label>
                <input
                  id={`${formId}-amount`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-describedby={`${formId}-amount-hint`}
                />
                <span id={`${formId}-amount-hint`} className="field-hint">
                  {amountHint}
                </span>
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${formId}-memo`}>memo</label>
              <input id={`${formId}-memo`} value={memo} onChange={(e) => setMemo(e.target.value)} autoComplete="off" />
            </div>
            <div className="button-row">
              <button type="submit" className="button">
                Send request
              </button>
              <button type="button" className="button button--quiet" disabled={!last} onClick={() => last && send(last.sent)}>
                Retry last request
              </button>
              <button type="button" className="button button--quiet" disabled={!lastCreate} onClick={conflictingRetry}>
                Same key, different amount
              </button>
            </div>
          </form>
        </section>

        <section className="demo-panel" aria-labelledby={`${formId}-response`}>
          <h2 id={`${formId}-response`} className="demo-heading">
            Response
          </h2>
          <div aria-live="polite" aria-atomic="true">
            {last ? <ResponseView exchange={last} /> : <p className="muted">Send a request to see the response here.</p>}
          </div>
        </section>
      </div>

      <section className="demo-panel" aria-labelledby={`${formId}-state`}>
        <div className="demo-state-head">
          <h2 id={`${formId}-state`} className="demo-heading">
            Ledger state
          </h2>
          <button type="button" className="button button--quiet" onClick={reset}>
            Reset demo
          </button>
        </div>
        <p className="balance">
          <span className="balance-label">Balance</span>
          <span className="balance-value">{formatMinor(balance(state))}</span>
          <span className="muted">
            sum of {state.entries.length} {state.entries.length === 1 ? "entry" : "entries"}, never stored separately
          </span>
        </p>

        <h3 className="demo-subheading">Transactions</h3>
        {state.transactions.length === 0 ? (
          <p className="muted">No transactions yet.</p>
        ) : (
          <ul className="txn-list">
            {state.transactions.map((txn) => {
              const reversed = txn.status === "reversed";
              const reverseKey = reversed ? unusedKey(state, `reverse-${txn.id}-`, 2) : `reverse-${txn.id}`;
              return (
                <li key={txn.id}>
                  <span className="mono">{txn.id}</span>
                  <span>
                    {txn.kind} {formatMinor(txn.amountMinor)}
                    {txn.memo ? ` · ${txn.memo}` : ""}
                  </span>
                  <span className={reversed ? "tag tag--muted" : "tag"}>{txn.status}</span>
                  <button
                    type="button"
                    className="button button--quiet button--small"
                    onClick={() => send({ op: "reverse", req: { idempotencyKey: reverseKey, transactionId: txn.id } })}
                  >
                    {reversed ? "Reverse again (new key)" : "Reverse"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="demo-subheading">Entries (append-only)</h3>
        {state.entries.length === 0 ? (
          <p className="muted">No entries yet.</p>
        ) : (
          <div className="table-wrap" role="region" aria-label="Ledger entries" tabIndex={0}>
            <table className="compact">
              <thead>
                <tr>
                  <th scope="col">Entry</th>
                  <th scope="col">Transaction</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{entry.id}</td>
                    <td className="mono">{entry.transactionId}</td>
                    <td>{entry.type === "reversal" ? `reversal of ${entry.reversesEntryId}` : "posting"}</td>
                    <td className="mono num">{formatMinor(entry.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="demo-subheading">Idempotency records</h3>
        {state.idempotency.length === 0 ? (
          <p className="muted">No keys stored yet. Requests that fail validation are not stored.</p>
        ) : (
          <div className="table-wrap" role="region" aria-label="Idempotency records" tabIndex={0}>
            <table className="compact">
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Operation</th>
                  <th scope="col">Request hash</th>
                  <th scope="col">Stored status</th>
                  <th scope="col" className="num">
                    Replays
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.idempotency.map((record) => (
                  <tr key={record.key}>
                    <td className="mono">{record.key}</td>
                    <td>{record.operation}</td>
                    <td className="mono">{shortHash(record.fingerprint)}</td>
                    <td className="mono">{record.response.status}</td>
                    <td className="mono num">{record.replays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="raw-state">
          <summary>Raw state (JSON)</summary>
          <pre tabIndex={0}>
            <code>{JSON.stringify(state, null, 2)}</code>
          </pre>
        </details>
      </section>
    </div>
  );
}

function ResponseView({ exchange }: { exchange: Exchange }) {
  const { sent, result } = exchange;
  const { response, replayed } = result;
  const path = sent.op === "create" ? "/transactions" : `/transactions/${sent.req.transactionId}/reverse`;
  const ok = response.status < 400;
  const balanceChange = result.state.log.at(-1)?.balanceChangeMinor ?? 0;

  return (
    <div className="response">
      <p className="response-request mono">
        POST {path}
        <br />
        Idempotency-Key: {sent.req.idempotencyKey || "(empty)"}
      </p>
      <p className={`response-status mono ${ok ? "response-status--ok" : "response-status--error"}`}>
        HTTP/1.1 {response.status} {statusText[response.status]}
        {replayed ? (
          <>
            <br />
            Idempotent-Replayed: true
          </>
        ) : null}
      </p>
      <p className="response-summary">
        {replayed
          ? "Served from the stored record. Nothing was applied again."
          : balanceChange !== 0
            ? `Applied. Balance changed by ${formatMinor(balanceChange)}.`
            : "No balance change."}
      </p>
      <pre tabIndex={0}>
        <code>{JSON.stringify(response.body, null, 2)}</code>
      </pre>
    </div>
  );
}
