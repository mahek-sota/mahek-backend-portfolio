import type { CaseStudy } from "../types.ts";
import { agentMesh } from "./agent-mesh.ts";
import { carePlatform } from "./care-platform.ts";
import { catalogApiConsole } from "./catalog-api-console.ts";
import { collectionDecisions } from "./collection-decisions.ts";
import { defiTracker } from "./defi-tracker.ts";
import { facultyProfiles } from "./faculty-profiles.ts";
import { financeTracker } from "./finance-tracker.ts";
import { lcshExplorer } from "./lcsh-explorer.ts";
import { lettersAnonymous } from "./letters-anonymous.ts";
import { researchIngestion } from "./research-ingestion.ts";
import { researcherExplorer } from "./researcher-explorer.ts";
import { researcherMatchmaker } from "./researcher-matchmaker.ts";

/** Display order on the home page. The first entry is the featured deep dive. */
export const caseStudies: CaseStudy[] = [
  agentMesh,
  researchIngestion,
  researcherExplorer,
  catalogApiConsole,
  financeTracker,
  facultyProfiles,
  collectionDecisions,
  carePlatform,
  lettersAnonymous,
  defiTracker,
  lcshExplorer,
  researcherMatchmaker,
];

export const retrospective = {
  slug: agentMesh.slug,
  sectionId: "what-i-would-change",
  title: "What I would change about agent-mesh today",
  summary:
    "Postgres already owns every run's state and lease; Redis Streams duplicates delivery and recovery around it. A review of where that split helps, where it doesn't, a Postgres-only queue with idempotent run creation, and how to migrate without a flag day.",
};

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.find((study) => study.slug === slug);
}
