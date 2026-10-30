import type { CaseStudy } from "../types.ts";

export const carePlatform: CaseStudy = {
  slug: "care-platform",
  title: "Object-level permissions for a care coordination platform",
  summary:
    "Patients, coordinators and admins see different slices of the same cases. One SQL access filter drives every read, out-of-scope cases return 404, and refresh tokens are single-use.",
  status: "Personal project",
  context: "Private repository",
  role: "Sole author",
  period: "2026",
  stack: ["Python", "FastAPI", "PostgreSQL", "SQLAlchemy 2.0", "Alembic", "React", "TypeScript"],
  evidence: {
    label: "Verified against code",
    text: "Checked against my local repository; it isn't public. The test count is from the test files.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "Patients seeking treatment abroad compare providers, submit records and track a case, while coordinators manage those cases from the other side. Medical cases are the kind of data where a permissions bug is the worst bug: a patient must never see, or even learn of, another patient's case.",
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "A personal project I'm building alone. Done: the domain model and initial migration, authentication with role-based and object-level access, provider search and comparison, and a React frontend. Not started: the document upload and extraction pipeline, and the full case workflow. The case status endpoints that exist are a deliberately conservative first pass, so the access rules have something real to guard.",
        },
      ],
    },
    {
      id: "access",
      title: "One access rule, used everywhere",
      blocks: [
        {
          type: "table",
          caption: "Which cases each role can see",
          columns: ["Role", "Cases visible"],
          rows: [
            ["patient", "Only their own."],
            ["coordinator", "Cases assigned to them, plus unassigned cases (their intake queue)."],
            ["admin", "All."],
          ],
        },
        {
          type: "p",
          text: "That rule exists in exactly one place: a function that returns a SQL condition for the current user. The single-case dependency and every list endpoint build on the same condition, so listing and fetching can't disagree. A case you can't `GET` can never appear in your list. A role added later without a rule fails with `403` instead of silently seeing nothing, or everything.",
        },
        {
          type: "code",
          label: "Python",
          caption: "The shape of the access filter (simplified from the repository).",
          code: `def case_access_filter(user: User) -> ColumnElement[bool]:
    match user.role:
        case UserRole.ADMIN:
            return Case.id.is_not(None)
        case UserRole.COORDINATOR:
            return or_(Case.coordinator_id == user.id,
                       Case.coordinator_id.is_(None))
        case UserRole.PATIENT:
            return Case.patient_id == user.id
        case _:
            raise HTTPException(403, "Role has no case access rule")`,
        },
        {
          type: "p",
          text: "Cases outside your scope return **`404`, not `403`**, so the API never confirms that another patient's case exists. Tests cover it for both patients and coordinators, and an unknown ID is a `404` for everyone, admins included.",
        },
      ],
    },
    {
      id: "auth",
      title: "Authentication",
      blocks: [
        {
          type: "list",
          items: [
            "**Short-lived access tokens.** A 15-minute JWT carrying subject, role, type and a token ID.",
            "**Single-use refresh tokens.** Each refresh token's ID is stored. Refreshing always rotates and revokes the old one, so a stolen refresh token stops working the moment the real holder uses theirs. Logout revokes, and is idempotent.",
            "**Role from the database, not the token.** The user is loaded on every request, so a demotion or deactivation takes effect immediately rather than when the token expires.",
            "**No self-promotion.** Registration always creates a patient and ignores any `role` in the body. Coordinators and admins are created by an admin.",
          ],
        },
      ],
    },
    {
      id: "data",
      title: "Data and search",
      blocks: [
        {
          type: "list",
          items: [
            "**Audit trail in the same transaction.** `case_events` is append-only. Every write goes through one function that stages the event on the caller's session without committing, so the event and the change it describes commit together. A rejected transition writes no event, and a test checks that.",
            "**Intake queue index.** A partial index on `cases (created_at) WHERE coordinator_id IS NULL` serves the coordinator queue.",
            "**Search that survives typos.** Provider search combines full-text search, which matches meaning but not misspellings, with `pg_trgm` similarity, which matches spelling but not meaning. A provider matches if either hits; full-text matches count double, so a real term match outranks a lucky fuzzy one.",
            "**Weighted search vector by trigger.** The vector is maintained by a trigger because the array-to-string function it needs isn't immutable, so Postgres won't accept it in a generated column.",
            "**NULL means unknown.** A minimum-rating filter excludes unrated providers rather than treating them as zero.",
          ],
        },
      ],
    },
    {
      id: "outcomes",
      title: "Testing",
      blocks: [
        {
          type: "facts",
          items: [
            { value: "79", label: "tests: authentication, role and object-level access, provider search", source: "code" },
          ],
        },
        {
          type: "p",
          text: "The suite runs against a real PostgreSQL database, because the schema relies on arrays, JSONB, enums, partial indexes and `pg_trgm`. It recreates the schema through Alembic on every run, so the migration itself is tested too.",
        },
      ],
    },
    {
      id: "limitations",
      title: "Limitations",
      blocks: [
        {
          type: "list",
          items: [
            "The document pipeline and full case workflow aren't built. The case transition table is a first pass that will be replaced when they are.",
            "Loading the user on every request trades one primary-key lookup per call for immediate revocation of roles. At this scale that is the right side of the trade.",
            "It runs on Docker Compose locally and isn't deployed.",
          ],
        },
      ],
    },
  ],
};
