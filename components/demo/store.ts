import { initialState, parseState, type LedgerState } from "@/lib/ledger";

// Browser-local store for the demo, read through useSyncExternalStore. The
// server snapshot is always the empty ledger; the client loads whatever this
// browser saved. Storage can be unavailable (private mode, blocked site data),
// in which case the demo still works for the current page view.

const STORAGE_KEY = "idempotency-demo:v1";
const serverSnapshot = initialState();
const listeners = new Set<() => void>();
let current: LedgerState | null = null;

function load(): LedgerState {
  try {
    return parseState(window.localStorage.getItem(STORAGE_KEY)) ?? initialState();
  } catch {
    return initialState();
  }
}

export function getSnapshot(): LedgerState {
  current ??= load();
  return current;
}

export function getServerSnapshot(): LedgerState {
  return serverSnapshot;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function commit(next: LedgerState): void {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not persisted; the in-memory state is still correct for this view.
  }
  listeners.forEach((listener) => listener());
}
