import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, it } from "node:test";

import { caseStudies, retrospective } from "../content/case-studies/index.ts";
import { demos, profile } from "../content/site.ts";

const root = join(import.meta.dirname, "..");
const routes = new Set(["/", "/demo", "/demo/collaboration-graph", "/demo/idempotency", ...caseStudies.map((c) => `/work/${c.slug}`)]);

/** Every string reachable from a value, for scanning content. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const allText = strings({ caseStudies, retrospective, profile, demos });

describe("content", () => {
  it("has case studies with unique slugs and section ids", () => {
    assert.ok(caseStudies.length >= 3);
    assert.equal(new Set(caseStudies.map((c) => c.slug)).size, caseStudies.length);
    for (const study of caseStudies) {
      const ids = study.sections.map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length, `${study.slug} has duplicate section ids`);
      assert.ok(study.sections.every((s) => s.blocks.length > 0), `${study.slug} has an empty section`);
      assert.ok(study.topics.length > 0, `${study.slug} has no topics`);
    }
  });

  it("points the retrospective link at a real section", () => {
    const study = caseStudies.find((c) => c.slug === retrospective.slug);
    assert.ok(study?.sections.some((s) => s.id === retrospective.sectionId && s.feature));
  });

  it("contains no placeholders or editorial notes", () => {
    const pattern = /\b(TODO|TBD|FIXME|lorem|ipsum|placeholder|XXX)\b|\[citation needed\]/i;
    for (const text of allText) assert.doesNotMatch(text, pattern);
  });

  it("never includes upstream institution identifiers from private code", () => {
    for (const text of allText) assert.doesNotMatch(text, /\bI\d{6,}\b/);
  });

  it("never includes a phone number", () => {
    const phone = /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
    for (const text of allText) assert.doesNotMatch(text, phone);
  });

  it("links only to known internal routes and https URLs", () => {
    const links = allText.flatMap((t) => [...t.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]));
    links.push(...demos.map((d) => d.href), profile.github, profile.linkedin, profile.impactDoc);
    assert.ok(links.length > 0);
    for (const href of links) {
      if (href.startsWith("/")) {
        assert.ok(routes.has(href.split("#")[0]), `unknown internal link ${href}`);
      } else {
        assert.match(href, /^https:\/\//, `non-https link ${href}`);
      }
    }
  });
});

describe("public files", () => {
  it("ships the resume under its public name", () => {
    assert.ok(existsSync(join(root, "public", profile.resumePath)));
  });

  it("does not publish the phone number in the resume or any public text file", () => {
    // Inflate every compressed stream so the check sees the text the PDF draws.
    const pdf = readFileSync(join(root, "public", profile.resumePath));
    const raw = pdf.toString("latin1");
    const streams = [raw];
    for (const match of raw.matchAll(/stream\r?\n/g)) {
      const start = match.index + match[0].length;
      const end = raw.indexOf("endstream", start);
      try {
        streams.push(inflateSync(pdf.subarray(start, end)).toString("latin1"));
      } catch {
        // Not a Flate stream (images, fonts in other encodings); nothing textual to check.
      }
    }
    assert.ok(streams.some((s) => s.includes("sotamahek")), "expected to find decoded page text");
    for (const text of streams) assert.doesNotMatch(text, /551|8645/);
    for (const name of readdirSync(join(root, "public"))) {
      if (/\.(txt|svg|json|xml|html)$/.test(name)) {
        assert.doesNotMatch(readFileSync(join(root, "public", name), "utf8"), /551.?8645/);
      }
    }
  });
});
