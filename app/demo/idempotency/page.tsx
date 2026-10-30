import type { Metadata } from "next";
import Link from "next/link";

import { IdempotencyDemo } from "@/components/demo/IdempotencyDemo";

export const metadata: Metadata = {
  title: "Illustrative demo: idempotent transactions",
  description:
    "A browser-local demonstration of idempotency keys, key-reuse conflicts and reversals as compensating ledger entries, with integer minor units.",
  alternates: { canonical: "/demo/idempotency" },
};

export default function IdempotencyDemoPage() {
  return (
    <div className="page demo-page">
      <header className="case-header">
        <p className="eyebrow">Illustrative engineering demo</p>
        <h1>Idempotent transaction handling</h1>
        <p className="lead">
          Submit a transaction, retry it, reuse its key with a different payload, and reverse it. Watch which requests
          change the ledger and which don&apos;t.
        </p>
        <aside className="note note--illustrative">
          <p className="note-title">
            <span className="tag">Illustrative</span> What this is and isn&apos;t
          </p>
          <p>
            Everything runs in your browser and is saved only to this browser&apos;s local storage. It demonstrates
            request-level behavior. It is not durable storage, it says nothing about concurrency safety on a server,
            and it isn&apos;t a claim of production payments or ledger experience. The same rules sketch the{" "}
            <Link href="/work/agent-mesh#what-i-would-change">idempotent run creation</Link> I propose for agent-mesh.
          </p>
        </aside>
      </header>

      <section className="prose" aria-labelledby="try-title">
        <h2 id="try-title">Things to try</h2>
        <ol>
          <li>
            <strong>Send request.</strong> A new key applies once: <code>201 Created</code> and the balance moves.
          </li>
          <li>
            <strong>Retry last request.</strong> Same key, same payload: the stored response comes back with{" "}
            <code>Idempotent-Replayed: true</code> and the ledger doesn&apos;t change.
          </li>
          <li>
            <strong>Same key, different amount.</strong> <code>409 Conflict</code>. A key identifies one request, not
            one client.
          </li>
          <li>
            <strong>Reverse</strong> a transaction. A compensating entry is appended; the original stays. Reversing
            again, with the same key or a new one, changes nothing.
          </li>
          <li>
            Try <code>12.50</code> as the amount. Fractions of a cent are rejected with <code>422</code>, and the key
            isn&apos;t consumed, so you can fix the request and reuse it.
          </li>
        </ol>
      </section>

      <IdempotencyDemo />

      <section className="prose" aria-labelledby="rules-title">
        <h2 id="rules-title">Rules the demo enforces</h2>
        <ul>
          <li>Amounts are positive integers in minor units (cents). No floating-point money anywhere.</li>
          <li>The balance is the sum of the entries. It is never stored, so it can&apos;t drift from them.</li>
          <li>Entries are append-only. A reversal is a new entry with the opposite sign that points at the original.</li>
          <li>
            A key is bound to a hash of the canonical request. Same hash: replay. Different hash: <code>409</code>.
          </li>
          <li>A transaction can be reversed once. A refused second reversal is itself stored under its key.</li>
          <li>
            State is deterministic: IDs come from counters, not clocks or random numbers, so the same requests always
            produce the same ledger.
          </li>
        </ul>
        <p>
          These invariants are covered by tests in this site&apos;s source, including a 400-step seeded sequence that
          checks after every request that the balance moved only on a fresh <code>201</code> and that no existing
          entry changed.
        </p>

        <h2>What a server implementation would also need</h2>
        <p>The demo leaves out the parts that make this hard in production:</p>
        <ul>
          <li>
            A unique constraint on <code>(account_id, idempotency_key)</code>, written in the same database
            transaction as the ledger entries, so a crash can&apos;t store one without the other.
          </li>
          <li>
            A rule for concurrent requests with the same key while the first is still in flight: block on the row
            lock, or return <code>409</code> and let the client retry.
          </li>
          <li>
            A partial unique index such as <code>UNIQUE (reverses_entry_id) WHERE reverses_entry_id IS NOT NULL</code>{" "}
            so the database, not application code, guarantees one reversal per entry.
          </li>
          <li>A retention window for stored keys, and a decision about which failures are stored and which aren&apos;t.</li>
        </ul>
      </section>
    </div>
  );
}
