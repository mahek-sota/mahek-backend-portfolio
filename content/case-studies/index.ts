import type { CaseStudy } from "../types.ts";
import { agentMesh } from "./agent-mesh.ts";
import { carePlatform } from "./care-platform.ts";
import { citationVerification } from "./citation-verification.ts";
import { lettersAnonymous } from "./letters-anonymous.ts";
import { researchDiscovery } from "./research-discovery.ts";
import { researcherMatchmaker } from "./researcher-matchmaker.ts";

/** Display order on the home page. The first entry is the featured case study. */
export const caseStudies: CaseStudy[] = [
  agentMesh,
  researchDiscovery,
  carePlatform,
  lettersAnonymous,
  citationVerification,
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
