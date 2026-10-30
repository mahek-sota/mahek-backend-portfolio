import Link from "next/link";
import type { ReactNode } from "react";

// Renders the small inline markdown subset used in content/: `code`, **bold**
// and [label](href). Anything else is plain text.
const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

export function Inline({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return <>{parts.map((part, i) => renderPart(part, i))}</>;
}

function renderPart(part: string, key: number): ReactNode {
  if (part.startsWith("`") && part.endsWith("`")) {
    return <code key={key}>{part.slice(1, -1)}</code>;
  }
  if (part.startsWith("**") && part.endsWith("**")) {
    return <strong key={key}>{part.slice(2, -2)}</strong>;
  }
  const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
  if (link) {
    const [, label, href] = link;
    const children = <Inline text={label} />;
    return href.startsWith("/") ? (
      <Link key={key} href={href}>
        {children}
      </Link>
    ) : (
      <a key={key} href={href}>
        {children}
      </a>
    );
  }
  return part;
}
