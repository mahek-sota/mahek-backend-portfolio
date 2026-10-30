import type { MetadataRoute } from "next";

import { caseStudies } from "@/content/case-studies";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const paths = ["/", ...caseStudies.map((study) => `/work/${study.slug}`), "/demo", "/demo/collaboration-graph", "/demo/idempotency"];
  return paths.map((path) => ({ url: new URL(path, base).toString() }));
}
