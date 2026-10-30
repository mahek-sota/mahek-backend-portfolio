// Fictional dataset for the collaboration-graph demo. Every person, department
// and number here is invented. It is shaped to exercise the expansion rules:
// off-campus co-authors that must be filtered out, a duplicate identity that
// must be merged, and prolific researchers whose fan-out gets capped.

export interface Person {
  id: string;
  name: string;
  department: string;
  works: number;
  citations: number;
  hIndex: number;
  /** Present on canonical records; a fragment without one may be merged into an anchor. */
  orcid: string | null;
  campus: boolean;
}

export const people: Person[] = [
  { id: "R01", name: "Avery Holt", department: "Pharmacognosy", works: 212, citations: 6110, hIndex: 41, orcid: "0000-0000-0000-0001", campus: true },
  { id: "R02", name: "Priya Raman", department: "Chemistry", works: 148, citations: 3920, hIndex: 33, orcid: "0000-0000-0000-0002", campus: true },
  { id: "R03", name: "Marcus Bell", department: "Biology", works: 97, citations: 2210, hIndex: 26, orcid: "0000-0000-0000-0003", campus: true },
  { id: "R04", name: "Lena Okoro", department: "Pharmacology", works: 131, citations: 3375, hIndex: 30, orcid: "0000-0000-0000-0004", campus: true },
  { id: "R05", name: "Tomás Vega", department: "Computer Science", works: 76, citations: 1490, hIndex: 19, orcid: "0000-0000-0000-0005", campus: true },
  { id: "R06", name: "Hannah Sato", department: "Psychology", works: 64, citations: 1702, hIndex: 21, orcid: "0000-0000-0000-0006", campus: true },
  { id: "R07", name: "Daniel Price", department: "Economics", works: 58, citations: 980, hIndex: 15, orcid: "0000-0000-0000-0007", campus: true },
  { id: "R08", name: "Grace Whitfield", department: "Public Health", works: 89, citations: 2044, hIndex: 24, orcid: "0000-0000-0000-0008", campus: true },
  { id: "R09", name: "Omar Haddad", department: "Physics", works: 120, citations: 2860, hIndex: 28, orcid: "0000-0000-0000-0009", campus: true },
  { id: "R10", name: "Sofia Lindqvist", department: "Mathematics", works: 45, citations: 610, hIndex: 12, orcid: "0000-0000-0000-0010", campus: true },
  { id: "R11", name: "Ethan Moore", department: "Computer Science", works: 39, citations: 522, hIndex: 11, orcid: null, campus: true },
  { id: "R12", name: "Nadia Petrova", department: "Chemistry", works: 71, citations: 1333, hIndex: 18, orcid: "0000-0000-0000-0012", campus: true },
  { id: "R13", name: "Kwame Asante", department: "Biology", works: 52, citations: 871, hIndex: 14, orcid: "0000-0000-0000-0013", campus: true },
  { id: "R14", name: "Isabel Duarte", department: "Public Health", works: 47, citations: 905, hIndex: 15, orcid: null, campus: true },
  { id: "R15", name: "Ryan Caldwell", department: "Pharmacology", works: 33, citations: 455, hIndex: 10, orcid: "0000-0000-0000-0015", campus: true },
  { id: "R16", name: "Mei Tanaka", department: "Psychology", works: 29, citations: 388, hIndex: 9, orcid: "0000-0000-0000-0016", campus: true },
  { id: "R17", name: "Samuel Greene", department: "Economics", works: 41, citations: 640, hIndex: 13, orcid: "0000-0000-0000-0017", campus: true },
  { id: "R18", name: "Fatima Noor", department: "Physics", works: 36, citations: 702, hIndex: 12, orcid: null, campus: true },
  { id: "R19", name: "Lucas Ferreira", department: "Mathematics", works: 22, citations: 210, hIndex: 7, orcid: "0000-0000-0000-0019", campus: true },
  { id: "R20", name: "Chloe Brennan", department: "Pharmacognosy", works: 54, citations: 1120, hIndex: 17, orcid: "0000-0000-0000-0020", campus: true },
  { id: "R21", name: "Arjun Mehta", department: "Computer Science", works: 18, citations: 140, hIndex: 6, orcid: "0000-0000-0000-0021", campus: true },
  { id: "R22", name: "Jordan Okafor", department: "Chemistry", works: 63, citations: 1288, hIndex: 19, orcid: "0000-0000-0000-0022", campus: true },
  // A name-variant fragment of R22 with no ORCID. It must never appear as its
  // own node; its co-authorships fold into R22.
  { id: "R22b", name: "J. Okafor", department: "Chemistry", works: 9, citations: 120, hIndex: 4, orcid: null, campus: true },
  // Off-campus co-authors. They exist upstream but are filtered out of the graph.
  { id: "X01", name: "Off-campus co-author 1", department: "Another university", works: 300, citations: 9000, hIndex: 50, orcid: null, campus: false },
  { id: "X02", name: "Off-campus co-author 2", department: "Another university", works: 80, citations: 1500, hIndex: 20, orcid: null, campus: false },
  { id: "X03", name: "Off-campus co-author 3", department: "A national lab", works: 120, citations: 2500, hIndex: 25, orcid: null, campus: false },
  { id: "X04", name: "Off-campus co-author 4", department: "Industry", works: 40, citations: 600, hIndex: 12, orcid: null, campus: false },
];

/** Fragment id → canonical id. */
export const merges: Record<string, string> = { R22b: "R22" };

/** Undirected co-authorships: [a, b, shared works]. */
export const coauthorships: [string, string, number][] = [
  ["R01", "R02", 14], ["R01", "R04", 11], ["R01", "R20", 19], ["R01", "R03", 6],
  ["R01", "R12", 4], ["R01", "R15", 3], ["R01", "R22", 5], ["R01", "X01", 22],
  ["R01", "X03", 9], ["R01", "R08", 2], ["R02", "R12", 12], ["R02", "R22", 7],
  ["R02", "R22b", 3], ["R02", "R09", 4], ["R02", "X02", 6], ["R02", "R04", 5],
  ["R03", "R13", 10], ["R03", "R08", 4], ["R03", "R14", 3], ["R03", "X04", 2],
  ["R04", "R15", 9], ["R04", "R08", 6], ["R04", "R06", 2], ["R04", "R20", 4],
  ["R05", "R11", 8], ["R05", "R21", 6], ["R05", "R10", 3], ["R05", "R09", 2],
  ["R05", "R06", 4], ["R05", "X02", 5], ["R06", "R16", 7], ["R06", "R08", 5],
  ["R06", "R07", 2], ["R07", "R17", 9], ["R07", "R08", 3], ["R07", "R10", 2],
  ["R08", "R14", 11], ["R08", "R16", 2], ["R08", "R17", 2], ["R09", "R18", 13],
  ["R09", "R10", 5], ["R09", "R19", 2], ["R10", "R19", 6], ["R11", "R21", 4],
  ["R12", "R22", 8], ["R12", "R22b", 2], ["R13", "R14", 2], ["R20", "R12", 3],
  ["R22b", "R09", 2], ["R15", "X03", 3],
];
