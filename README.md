# Mahek Sota — backend engineering portfolio

A small Next.js site: a home page, six case studies, and two illustrative
demos (a co-authorship graph explorer and idempotent transaction handling). Every page is statically rendered.
There is no database, authentication, analytics or contact form.

## Local setup

Requires Node.js 22.6 or newer (the tests use Node's built-in TypeScript
support).

```bash
npm install
npm run dev          # http://localhost:3000 with hot reload
```

To preview the production build exactly as it will be served:

```bash
npm run build
npm start            # http://localhost:3000
```

## Verification

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint with the Next.js core-web-vitals + TypeScript rules
npm test             # node:test — ledger invariants and content checks
npm run build        # production build
npm run verify       # all four, in that order
```

`tests/ledger.test.ts` covers the demo's invariants: a retried key changes
nothing, a reused key with a different payload is a 409, reversals append a
compensating entry and can only apply once, invalid amounts don't consume the
key, and a 400-step seeded sequence checks every invariant after each request.

`tests/content.test.ts` fails if content contains
placeholders (`TODO`, `TBD`, lorem ipsum…), a phone number, a link to an
unknown internal route or a non-https external link, or if the public resume
PDF contains the phone number.

## Content organization

Content is plain TypeScript data, separate from the pages that render it.

| What | Where |
|---|---|
| Name, email, profile links, focus areas, experience, education, smaller repos | `content/site.ts` |
| Case studies (one file each) | `content/case-studies/*.ts` |
| Case study order and the retrospective callout on the home page | `content/case-studies/index.ts` |
| Content types (sections and block kinds) | `content/types.ts` |
| Resume served for download | `public/mahek-sota-resume.pdf` |
| Demo logic (pure functions) | `lib/ledger.ts` |
| Private source record and content checklist (not published) | `docs/content-sources.md` |

### Editing a case study

Each case study is a list of sections; each section is a list of blocks:

- `p`, `h3`, `list` — prose. Inline text supports `` `code` ``, `**bold**` and
  `[label](/path-or-https-url)`.
- `code` — a labelled code or HTTP example with an optional caption.
- `table` — columns and rows. On narrow screens tables in case studies stack
  into labelled rows automatically.
- `diagram` — a vertical flow of rows of nodes with labelled connectors. It
  reflows to any width. Always say in `provenance` how the diagram was made.
- `note` — `evidence`, `illustrative` or `proposal` callouts.
- `facts` — outcome figures. Each needs a `source` (`resume`, `impact-doc`,
  `repo-docs` or `code`), which is shown next to the number.

Set `feature: true` on a section to give it the emphasized retrospective
style. To add a case study, create a file in `content/case-studies/`, add it
to the array in `index.ts`, and it gets a page, a home-page entry and a
sitemap entry. Order in that array is the order on the home page; the first
one is linked as the strongest case study.

When you change a claim, update `docs/content-sources.md` with its source.

### Resume

`public/mahek-sota-resume.pdf` is the supplied resume with the phone number
removed (the rest of the PDF, including its links, is unchanged). If you
replace it with a new export, remove the phone number first; the content test
will fail if it's present. `/resume` redirects to the PDF.

## Deploying to Vercel

1. Push this directory to a Git repository (GitHub, GitLab or Bitbucket).
2. In Vercel, choose **Add New → Project** and import the repository. The
   framework preset is detected as Next.js; keep the default build command
   (`next build`) and output settings.
3. Under **Settings → Environment Variables**, add `NEXT_PUBLIC_SITE_URL`
   (see below) for the Production environment.
4. Deploy. Afterwards, open `/sitemap.xml` and `/robots.txt` on the deployed
   site and confirm they show the right origin.

Using the CLI instead: `npm i -g vercel`, then `vercel` for a preview
deployment and `vercel --prod` for production, run from this directory.

### Configuring the public URL

The site URL is used for canonical links, Open Graph and Twitter tags, the
sitemap and robots.txt. It is resolved in `lib/site-url.ts` in this order:

1. `NEXT_PUBLIC_SITE_URL`, e.g. `https://your-domain.com` (no trailing slash).
2. Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, set automatically on Vercel.
3. `http://localhost:3000` for local development.

So the site works on its `*.vercel.app` address without configuration. Once
you attach a custom domain (Project → Settings → Domains), set
`NEXT_PUBLIC_SITE_URL` to it and redeploy, because the value is read at build
time. Copy `.env.example` to `.env.local` to try a value locally.
