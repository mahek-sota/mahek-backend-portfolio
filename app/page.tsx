import Link from "next/link";

import { Inline } from "@/components/Inline";
import { caseStudies, retrospective } from "@/content/case-studies";
import { demos, education, experience, focusAreas, otherWork, profile } from "@/content/site";

export default function HomePage() {
  const [featured] = caseStudies;

  return (
    <div className="page">
      <section className="hero" aria-labelledby="intro-title">
        <div className="hero-main">
          <p className="eyebrow">Backend engineer · University of Mississippi</p>
          <h1 id="intro-title">{profile.name}</h1>
          <p className="lead">
            I build the backend systems behind research discovery and reporting at the University of Mississippi:
            pipelines that have processed 50M+ records, search across about 6,900 researcher profiles, and a
            citation-verification pipeline that runs entirely on local models so nothing leaves the institution.
          </p>
          <p>
            Most of my attention goes to the parts that decide whether a system can be trusted: explicit state,
            retries that can&apos;t apply twice, permissions enforced at the boundary, and enough telemetry to explain
            a bad run after the fact.
          </p>

          <Link className="start-here" href={`/work/${featured.slug}`}>
            <span className="start-here-label">Start with the strongest case study</span>
            <span className="start-here-title">{featured.title}</span>
            <span className="start-here-meta">
              Durable runs, leases and fenced retries in Postgres, including what I would change today →
            </span>
          </Link>

          <ul className="link-row hero-links" aria-label="Contact and profiles">
            <li>
              <a href={profile.resumePath} download>
                Resume (PDF)
              </a>
            </li>
            <li>
              <a href={profile.github}>GitHub</a>
            </li>
            <li>
              <a href={profile.linkedin}>LinkedIn</a>
            </li>
            <li>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
            </li>
          </ul>
        </div>

        <aside className="hero-aside" aria-labelledby="focus-title">
          <h2 id="focus-title" className="aside-title">
            Problems I work on
          </h2>
          <dl className="focus">
            {focusAreas.map((area) => (
              <div key={area.title}>
                <dt>{area.title}</dt>
                <dd>{area.text}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section id="work" className="section" aria-labelledby="work-title">
        <h2 id="work-title" className="section-title">
          Selected work
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

      <section id="experience" className="section" aria-labelledby="experience-title">
        <h2 id="experience-title" className="section-title">
          Experience
        </h2>
        <ol className="experience">
          {experience.map((item) => (
            <li key={`${item.org}-${item.period}`}>
              <div className="experience-head">
                <h3>
                  {item.title}, <span className="org">{item.org}</span>
                </h3>
                <p className="period">{item.period}</p>
              </div>
              <ul>
                {item.points.map((point) => (
                  <li key={point}>
                    <Inline text={point} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <h3 className="subhead">Education</h3>
        <ul className="education">
          {education.map((item) => (
            <li key={item.school}>
              <span>
                {item.degree}, {item.school}
              </span>
              <span className="period">{item.period}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="code-title">
        <h2 id="code-title" className="section-title">
          Other code you can read
        </h2>
        <p className="section-intro">Smaller personal and learning projects, described only from what their code shows.</p>
        <ul className="repo-list">
          {otherWork.map((repo) => (
            <li key={repo.name}>
              <a href={repo.href} className="repo-name">
                {repo.name}
              </a>
              <p>
                <Inline text={repo.text} />
              </p>
            </li>
          ))}
        </ul>
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
