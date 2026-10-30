import Link from "next/link";

import { caseStudies } from "@/content/case-studies";
import { demos } from "@/content/site";

export default function NotFound() {
  return (
    <div className="page not-found">
      <p className="eyebrow">404</p>
      <h1>There&apos;s no page at this address.</h1>
      <p className="lead">It may have moved, or the link may be mistyped. These are the pages that exist:</p>
      <ul className="not-found-links">
        {caseStudies.map((study) => (
          <li key={study.slug}>
            <Link href={`/work/${study.slug}`}>{study.title}</Link>
          </li>
        ))}
        {demos.map((demo) => (
          <li key={demo.href}>
            <Link href={demo.href}>Illustrative demo: {demo.title.toLowerCase()}</Link>
          </li>
        ))}
        <li>
          <Link href="/">Home</Link>
        </li>
      </ul>
    </div>
  );
}
