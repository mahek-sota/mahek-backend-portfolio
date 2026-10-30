import Link from "next/link";
import { profile } from "@/content/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark">
          {profile.name}
        </Link>
        <nav aria-label="Primary">
          <ul>
            <li>
              <Link href="/#work">Deep dives</Link>
            </li>
            <li>
              <Link href="/demo">Demos</Link>
            </li>
            <li>
              <a href={profile.resumePath}>Resume</a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
