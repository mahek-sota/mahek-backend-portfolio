import type { Metadata } from "next";
import Link from "next/link";

import { demos } from "@/content/site";

export const metadata: Metadata = {
  title: "Illustrative engineering demos",
  description: "Small interactive demonstrations of backend behavior. They run in the browser on fictional data.",
  alternates: { canonical: "/demo" },
};

export default function DemosPage() {
  return (
    <div className="page demo-page">
      <header className="case-header">
        <p className="eyebrow">Illustrative engineering demos</p>
        <h1>Demos</h1>
        <p className="lead">
          Small, interactive demonstrations of backend behavior. They run in your browser on fictional data and are
          meant to make a design rule visible, not to stand in for production systems.
        </p>
      </header>
      <ul className="demo-list">
        {demos.map((demo) => (
          <li key={demo.href}>
            <h2>
              <Link href={demo.href}>{demo.title}</Link>
            </h2>
            <p>{demo.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
