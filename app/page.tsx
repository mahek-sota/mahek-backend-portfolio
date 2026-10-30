import Link from "next/link";

import { caseStudies, retrospective } from "@/content/case-studies";
import { demos, profile } from "@/content/site";

export default function HomePage() {
  const [featured] = caseStudies;

  return (
    <div className="page">
      <section className="hero" aria-labelledby="intro-title">
        <p className="eyebrow">Engineering deep dives · Backend</p>
        <h1 id="intro-title">{profile.name}</h1>
        <p className="lead">
          Systems I&apos;ve built, each taken apart in detail: the data model, how requests flow, where it can
          fail, the trade-offs I made and, for the larger ones, what I would change now.
        </p>
        <p>
          This site is for the technical detail behind my work. For roles, dates and results, see my{" "}
          <a href={profile.resumePath}>resume</a> and <a href={profile.impactDoc}>impact document</a>. Every page
          says where its facts come from, and simplified or fictional examples are labelled.
        </p>

        <Link className="start-here" href={`/work/${featured.slug}`}>
          <span className="start-here-label">If you read one</span>
          <span className="start-here-title">{featured.title}</span>
          <span className="start-here-meta">
            Durable runs, leases and fenced retries in Postgres, including what I would change today →
          </span>
        </Link>

        <ul className="link-row hero-links" aria-label="Contact and profiles">
          <li>
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </li>
          <li>
            <a href={profile.github}>GitHub</a>
          </li>
          <li>
            <a href={profile.linkedin}>LinkedIn</a>
          </li>
          <li>
            <a href={profile.resumePath} download>
              Resume (PDF)
            </a>
          </li>
        </ul>
      </section>

      <section id="work" className="section" aria-labelledby="work-title">
        <h2 id="work-title" className="section-title">
          Deep dives
        </h2>
        <ol className="work-list">
          {caseStudies.map((study, i) => (
            <li key={study.slug} className="work-item">
              <span className="work-index" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="work-body">
                <p className="work-meta">
                  <span className="tag">{study.status}</span>
                  <span>{study.context}</span>
                  <span>{study.period}</span>
                </p>
                <h3>
                  <Link href={`/work/${study.slug}`}>{study.title}</Link>
                </h3>
                <p>{study.summary}</p>
                <p className="topics">
                  <span className="topics-label">Covers</span> {study.topics.join(" · ")}
                </p>
                <p className="stack">{study.stack.join(" · ")}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="retro-title">
        <div className="retro-callout">
          <p className="eyebrow">Architectural retrospective</p>
          <h2 id="retro-title">{retrospective.title}</h2>
          <p>{retrospective.summary}</p>
          <Link href={`/work/${retrospective.slug}#${retrospective.sectionId}`} className="arrow-link">
            Read the retrospective →
          </Link>
        </div>
      </section>

      <section className="section" aria-labelledby="demo-title">
        <h2 id="demo-title" className="section-title">
          Illustrative engineering demos
        </h2>
        <p className="section-intro">
          Interactive, in-browser, on fictional data. They make a design rule visible; they aren&apos;t production
          systems.
        </p>
        <ul className="demo-list">
          {demos.map((demo) => (
            <li key={demo.href}>
              <h3>
                <Link href={demo.href}>{demo.title}</Link>
              </h3>
              <p>{demo.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
