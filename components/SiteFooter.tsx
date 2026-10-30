import { profile } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </p>
        <ul className="link-row">
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
      </div>
    </footer>
  );
}
