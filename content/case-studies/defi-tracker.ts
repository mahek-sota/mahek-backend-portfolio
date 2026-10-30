import type { CaseStudy } from "../types.ts";

const repo = "https://github.com/mahek-sota/defi-portfolio-tracker";

export const defiTracker: CaseStudy = {
  slug: "defi-tracker",
  title: "Aggregating wallet data across four blockchains without losing precision",
  summary:
    "A read-only portfolio tracker that fans out across four EVM chains, keeps every amount as an exact integer, degrades one chain at a time, and reconstructs profit and loss with FIFO lots that say when their history is incomplete.",
  status: "Personal project",
  context: "Public repository",
  role: "Sole author",
  period: "2026",
  topics: ["Partial-failure fan-out", "Exact integer arithmetic", "Stale-but-labelled fallbacks", "FIFO lot reconstruction"],
  stack: ["TypeScript", "Node.js", "Express", "PostgreSQL", "Redis", "ethers v6", "decimal.js", "Vitest"],
  evidence: {
    label: "Verified against code",
    text: `Checked against the committed code in the [public repository](${repo}). The test count is for that commit. This is an engineering exercise, not financial software: the profit-and-loss figures are reconstructions, not tax or accounting numbers.`,
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "Holdings on Ethereum, Arbitrum, Base and Polygon live on four separate chains with four block explorers. Pulling them into one view means calling several upstream APIs per chain, and any of them can be slow, rate-limited or down. Token amounts are integers up to 256 bits, with anywhere from 0 to 36 decimal places, and they don't fit in a JavaScript number. Profit and loss requires rebuilding a cost history from transfers whose prices may be unknown.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "A personal project I built alone. It tracks balances, USD values, transaction history, gas spent and FIFO profit and loss for any public address. It is **read-only**: it accepts only public addresses, and no code path takes a private key or signs anything. It has no user accounts and is meant to run locally.",
        },
      ],
    },
    {
      id: "architecture",
      title: "Architecture",
      blocks: [
        {
          type: "diagram",
          title: "Sync and read paths",
          provenance: "Reconstructed from the source code.",
          rows: [
            {
              nodes: [
                { label: "Ethereum", kind: "external" },
                { label: "Arbitrum", kind: "external" },
                { label: "Base", kind: "external" },
                { label: "Polygon", kind: "external" },
              ],
              edge: "JSON-RPC via ethers · per-chain, in parallel · retry with jitter",
            },
            {
              nodes: [
                { label: "Ingest", detail: "balances + transfers, one DB transaction per chain", kind: "process" },
                { label: "Price service", detail: "Redis 60 s → provider → last snapshot (stale)", kind: "process" },
              ],
              edge: "write",
            },
            {
              nodes: [{ label: "PostgreSQL", detail: "NUMERIC(78,0) amounts · NUMERIC(38,18) prices · price snapshots", kind: "store" }],
              edge: "read",
            },
            { nodes: [{ label: "Express API → React dashboard", kind: "client" }] },
          ],
        },
        {
          type: "p",
          text: "Chains are a static configuration (ID, name, native token, capability flags) upserted into the database at startup. Per-chain differences live in that configuration; for example, a flag skips internal-transfer queries on the chain whose provider doesn't support them.",
        },
      ],
    },
    {
      id: "fan-out",
      title: "One chain failing is not an outage",
      blocks: [
        {
          type: "p",
          text: "A sync fans out with `Promise.allSettled`, not `Promise.all`, so a rejected chain becomes an entry in the result instead of failing the request. Each chain's writes run in their own database transaction. A chain that fails rolls back alone, keeps its last good positions, and the dashboard marks just that chain as failed.",
        },
        {
          type: "code",
          label: "TypeScript",
          caption: "Per-chain fan-out (simplified from the repository).",
          code: `const settled = await Promise.allSettled(
  chains.map((c) => syncWalletBalancesOnChain(wallet, c.chainId)),
);
return settled.map((res, i) =>
  res.status === "fulfilled"
    ? res.value
    : { chainId: chains[i].chainId, ok: false, error: messageOf(res.reason) },
);`,
        },
        {
          type: "list",
          items: [
            "**Retries with full jitter.** Upstream calls get four attempts, with exponential backoff from 250 ms capped at 4 s and a random delay anywhere up to that bound, so parallel retries don't line up against a shared node.",
            "**Retry only what can succeed.** RPC calls retry on any error. Price calls retry only on network errors, `429` and `5xx`; any other `4xx` is a bad request and won't improve.",
            "**Bounded concurrency inside a chain.** Transaction receipts are fetched eight at a time.",
          ],
        },
      ],
    },
    {
      id: "prices",
      title: "Prices: fresh, cached, or stale and labelled",
      blocks: [
        {
          type: "list",
          ordered: true,
          items: [
            "**Redis**, 60-second TTL, keyed by chain and contract (or chain and native token).",
            "**The provider**, behind a `PriceProvider` interface. Contract prices are batched 25 at a time. Every fetched price is also written to a `price_snapshots` table.",
            "**The last snapshot**, if the provider fails. It is returned with `stale: true` and its original timestamp, so the UI can show an old price as old instead of as current.",
          ],
        },
        {
          type: "p",
          text: "Cache writes and snapshot writes are best-effort: a failure there never fails the read. A token with no price at all is left unpriced rather than shown as zero.",
        },
      ],
    },
    {
      id: "precision",
      title: "Amounts stay exact",
      blocks: [
        {
          type: "table",
          caption: "Number handling by stage",
          columns: ["Stage", "Representation"],
          rows: [
            ["Database", "`NUMERIC(78,0)` raw amounts (fits any 256-bit value); `NUMERIC(38,18)` prices"],
            ["In memory", "Raw amounts as strings and `BigInt`; decimals validated to 0–36"],
            ["Formatting", "Raw to human-readable by string and `BigInt` arithmetic; parsing rejects more precision than the token supports"],
            ["USD math", "`decimal.js` at 80 significant digits, round half-up; formatted to 2 places only for output"],
          ],
        },
      ],
    },
    {
      id: "pnl",
      title: "Reconstructing profit and loss",
      blocks: [
        {
          type: "p",
          text: "Every incoming transfer opens a lot, per token per chain, ordered by block time and log index. Every outgoing transfer consumes the oldest lots first. A partly consumed lot gives up cost in proportion to the quantity taken, so its remaining cost stays exact.",
        },
        {
          type: "code",
          label: "TypeScript",
          caption: "Consuming lots for one disposal (from the repository).",
          code: `while (toConsume > 0n && lots.length > 0) {
  const lot = lots[0]!;
  const take = toConsume < lot.remainingRaw ? toConsume : lot.remainingRaw;
  if (lot.costUsd == null) {
    costConsumedKnown = false;
  } else {
    const fraction = new Decimal(take.toString()).div(new Decimal(lot.remainingRaw.toString()));
    const portion = lot.costUsd.mul(fraction);
    costConsumed = costConsumed.plus(portion);
    lot.costUsd = lot.costUsd.minus(portion);
  }
  lot.remainingRaw -= take;
  toConsume -= take;
  if (lot.remainingRaw === 0n) lots.shift();
}`,
        },
        {
          type: "list",
          items: [
            "**Unknown is not zero.** A transfer with no price within 48 hours opens a lot with an unknown cost. A disposal that touches one adds nothing to realized P&L, and the token is marked `complete: false`.",
            "**Backfill once, bounded.** If events are unpriced, the service makes one historical price backfill per token, capped at 50 tokens per request.",
            "**Tested at the edges.** Ten cost-basis tests cover partial sells, multiple lots, selling to zero, 6-decimal tokens, missing buy and sell prices, selling more than is held, and floating-point drift.",
          ],
        },
        {
          type: "facts",
          items: [{ value: "73", label: "unit tests in the committed code, mocking all database, cache and network I/O", source: "code" }],
        },
      ],
    },
    {
      id: "what-i-would-change",
      title: "What I would change today",
      feature: true,
      blocks: [
        {
          type: "note",
          tone: "proposal",
          title: "Present-day assessment, not implemented",
          text: "The per-token logic is careful; the places I'd change are where it gets summarized, and where the work runs.",
        },
        {
          type: "h3",
          text: "1. Carry completeness into the totals",
        },
        {
          type: "p",
          text: "Each token knows whether its history is complete, but portfolio totals add every token either way. A lot with an unknown cost contributes zero basis, which makes its unrealized gain look larger than it is. I'd total complete tokens only, and report the incomplete ones beside the total with their quantity and the reason, so a reader never mistakes a partial number for a whole one.",
        },
        {
          type: "h3",
          text: "2. Never realize more than you can match",
        },
        {
          type: "p",
          text: "When a disposal exceeds the known lots, the token is flagged incomplete, but the realized figure still counts the full proceeds against the partial cost. I'd split the disposal: realize only the matched quantity, and record the excess as an unmatched disposal with no P&L.",
        },
        {
          type: "h3",
          text: "3. Move syncing off the request path",
        },
        {
          type: "list",
          items: [
            "**Sync runs inside the request** that adds a wallet, with retries but no overall deadline. I'd enqueue a sync job, return `202`, and let the dashboard read progress, which the per-chain results already model.",
            "**Resume from where it stopped.** The last synced block is already recorded per wallet and chain. I'd start each sync from it instead of from genesis, and batch the transfer inserts.",
            "**Explicit timeouts** on every upstream call, so one slow provider fails fast into the per-chain error path that already exists.",
          ],
        },
        {
          type: "h3",
          text: "4. Model a few more real-world events",
        },
        {
          type: "list",
          items: [
            "**Gas on every sent transaction**, including approvals and failed transactions, not only those that moved value.",
            "**Self-transfers** as a no-op rather than a disposal.",
            "**Bridges** as a move between chains rather than a sale and a new purchase. Lots are per chain today, so a bridge resets cost basis.",
          ],
        },
      ],
    },
    {
      id: "limitations",
      title: "Limitations",
      blocks: [
        {
          type: "list",
          items: [
            "Single-user and unauthenticated; it's meant to run locally, not as a shared service.",
            "Profit and loss is reconstructed from on-chain transfers and historical prices; it isn't suitable for tax or accounting purposes.",
            "The tests cover the domain math and HTTP layer with mocked I/O. Ingestion and the price service have no tests against real services.",
          ],
        },
      ],
    },
  ],
};
