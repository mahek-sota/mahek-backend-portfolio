import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Blocks } from "@/components/Blocks";
import { Inline } from "@/components/Inline";
import { caseStudies, getCaseStudy } from "@/content/case-studies";
import { profile } from "@/content/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return caseStudies.map((study) => ({ slug: study.slug }));
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return {};
  return {
    title: study.title,
    description: study.summary,
    alternates: { canonical: `/work/${study.slug}` },
    // Setting openGraph here replaces the inherited object, so the shared image is listed again.
    openGraph: {
      type: "article",
      title: study.title,
      description: study.summary,
      url: `/work/${study.slug}`,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${profile.name}, backend engineer` }],
    },
  };
}

export default async function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) notFound();

  const index = caseStudies.indexOf(study);
  const next = caseStudies[(index + 1) % caseStudies.length];

  return (
    <article className="page case-study">
      <header className="case-header">
        <p className="work-meta">
          <span className="tag">{study.status}</span>
          <span>{study.context}</span>
          <span>{study.period}</span>
        </p>
        <h1>{study.title}</h1>
        <p className="lead">{study.summary}</p>
        <dl className="case-facts">
          <div>
            <dt>Role</dt>
            <dd>{study.role}</dd>
          </div>
          <div>
            <dt>Stack</dt>
            <dd className="stack">{study.stack.join(" · ")}</dd>
          </div>
        </dl>
        <aside className="evidence">
          <p className="note-title">
            <span className="tag">Evidence</span> {study.evidence.label}
          </p>
          <p>
            <Inline text={study.evidence.text} />
          </p>
        </aside>
      </header>

      <div className="case-layout">
        <nav className="toc" aria-label="On this page">
          <p className="toc-title">On this page</p>
          <ol>
            {study.sections.map((section) => (
              <li key={section.id} className={section.feature ? "toc-feature" : undefined}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="case-body">
          {study.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className={section.feature ? "case-section case-section--feature" : "case-section"}
            >
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <Blocks blocks={section.blocks} />
            </section>
          ))}

          <footer className="case-next">
            <Link href="/#work">← All work</Link>
            <Link href={`/work/${next.slug}`}>Next: {next.title} →</Link>
          </footer>
        </div>
      </div>
    </article>
  );
}
