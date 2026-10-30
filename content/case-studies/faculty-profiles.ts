import type { CaseStudy } from "../types.ts";

export const facultyProfiles: CaseStudy = {
  slug: "faculty-profiles",
  title: "Research profiles from ten sources that disagree about who wrote what",
  summary:
    "Building per-person research keyword profiles from ORCID, OpenAlex, Crossref, Scopus, Dimensions, an institutional repository and full text: an author-confirmed spine of papers, affiliation gates on everything else, explicit source weights, and a language model that may only remove terms.",
  status: "In development",
  context: "University of Mississippi Libraries",
  role: "Designed and built five successive versions",
  period: "2026",
  topics: ["Entity resolution", "Weighting noisy sources", "Constraining an LLM", "Spending a daily API budget fairly"],
  stack: ["Python", "OpenAlex, ORCID, Crossref, Scopus, Dimensions APIs", "OAI-PMH", "sentence-transformers", "rapidfuzz", "Ollama"],
  evidence: {
    label: "Verified against code",
    text: "Checked against the source of the fifth version and its predecessors. The code is private. People, their identifiers and their outputs are left out, and the examples are described generically. There's no labelled evaluation set, so this page describes design decisions, not measured accuracy.",
  },
  sections: [
    {
      id: "problem",
      title: "The problem",
      blocks: [
        {
          type: "p",
          text: "The goal is a short list of research keywords for each faculty member, good enough for a librarian to use for outreach, collection decisions or matching collaborators. Every source has an opinion, and they disagree:",
        },
        {
          type: "list",
          items: [
            "**Identity is unreliable.** Bibliographic databases sometimes merge several people with the same name into one author record, even one that carries an ORCID.",
            "**Coverage differs.** Some work exists only in the institutional repository; some only in a commercial index; some only in the person's ORCID record.",
            "**Keyword quality varies enormously.** Author-assigned keywords are precise. Machine \"concepts\" extracted from full text are noisy, and they're often the most plentiful.",
          ],
        },
      ],
    },
    {
      id: "status",
      title: "My role and status",
      blocks: [
        {
          type: "p",
          text: "I built five versions, each in its own folder, and the fifth is the current design. The first two ranked OpenAlex topics and mined phrases with TF-IDF. The third and fourth added Crossref and Scopus, embeddings, clustering and a hybrid score. The fifth is a rebuild, prompted by finding that the fourth version's ranking put noise first by construction. It's in active development and hasn't been validated against librarian-labelled profiles.",
        },
      ],
    },
    {
      id: "identity",
      title: "Deciding which papers belong to a person",
      blocks: [
        {
          type: "p",
          text: "Everything downstream depends on getting the paper set right, so the pipeline is strict about what's allowed in.",
        },
        {
          type: "list",
          ordered: true,
          items: [
            "**An author-confirmed spine.** The papers listed in the person's own ORCID record, plus any DOIs a librarian adds by hand, are trusted outright.",
            "**Discovery must prove affiliation.** OpenAlex resolves the person ORCID-first, falling back to a name match that also requires the institution. Any paper found that way that isn't already in the spine must show the institution's affiliation before it joins.",
            "**Search results are proposals, not facts.** Candidate papers from scholarly search become seeds only if OpenAlex shows that the **matching author on that paper**, not merely some co-author, carried the institution's affiliation.",
            "**De-duplication on two keys.** Papers merge on DOI, or on a normalized title and year when there's no DOI.",
          ],
        },
        {
          type: "p",
          text: "The spine rule came from a real failure, recorded in the code: one upstream author record that carried an ORCID turned out to be several same-named people merged together. Trusting it wholesale imported 194 unrelated papers and produced a profile about a completely different field.",
        },
      ],
    },
    {
      id: "scoring",
      title: "Weighting sources by how much they deserve to be believed",
      blocks: [
        {
          type: "table",
          caption: "Source authority weights in the current version (excerpt)",
          columns: ["Source", "Weight", "Why"],
          rows: [
            ["Keywords the researcher entered in ORCID", "1.20", "Typed by the person about their own work"],
            ["Author keywords (Scopus)", "1.00", "Assigned by the paper's authors"],
            ["Institutional repository subjects", "0.95", "Human-assigned, often the only metadata for work the indexes missed"],
            ["Crossref subjects", "0.85", "Curated, but coarse"],
            ["OpenAlex keywords and topics", "0.60–0.65", "Machine-assigned"],
            ["Dimensions concepts", "0.40", "A phrase extractor over full text, not a vocabulary"],
            ["Mined from title and abstract", "0.35", "Weakest; mostly breaks ties"],
          ],
        },
        {
          type: "p",
          text: "Dimensions concepts were originally weighted above every curated source. Measured over the cohort, they supplied 69 of 150 final keywords, 32 of them backed by a single paper and no other source. It was the same structural mistake the fourth version made with OpenAlex concepts: the noisiest, most plentiful source ranked first. It now sits just above mined text.",
        },
        {
          type: "list",
          items: [
            "**Five-part score.** Source authority, saturating frequency, recency, presence in the ten most recent papers, and a cohort IDF that lowers terms everyone shares, all with explicit weights.",
            "**Single-paper terms must earn their place.** A term backed by one paper needs additional support to survive.",
            "**Near-duplicates merge.** Terms with a fuzzy similarity of 90 or more are folded together, after part-of-speech filtering and a word-frequency check remove generic words.",
          ],
        },
      ],
    },
    {
      id: "niche",
      title: "Telling a niche from a field",
      blocks: [
        {
          type: "p",
          text: "The profile also surfaces each person's narrow specialties. Specificity is measured, not guessed: the number of OpenAlex works that use a phrase. Above 300,000 a phrase names a field; below 20 it's more likely an extraction artifact than a discovery. Phrase depth (more specific wording) then decides how much of that rarity score a term can reach.",
        },
        {
          type: "code",
          label: "Python",
          caption: "Depth modulates rarity instead of adding to it (from the source).",
          code: `# Rarity is the measurement and sets the ceiling; depth only decides how much
# of that ceiling a term reaches, so a common phrase can never be rescued by
# being wordy.
return rarity(term) * (config.SPEC_DEPTH_FLOOR
                       + (1.0 - config.SPEC_DEPTH_FLOOR) * depth(term))`,
        },
        {
          type: "p",
          text: "Those rarity lookups spend a daily request budget. Instead of exhausting it on the first few people, candidates are interleaved by rank across the whole cohort (everyone's first candidate, then everyone's second), so a cut-off budget degrades every profile slightly rather than leaving some empty.",
        },
      ],
    },
    {
      id: "llm",
      title: "A language model that can only remove",
      blocks: [
        {
          type: "p",
          text: "Earlier versions asked a local model for free-form summaries, which can invent topics a person has never worked on. The current version gives the model the ranked candidate list and asks which terms to keep. Anything it returns that isn't in the candidate set is discarded and logged as invented. Kept terms use the pipeline's own wording, not the model's. If the model is unavailable or returns nothing usable, the deterministic list stands.",
        },
        {
          type: "code",
          label: "Python",
          caption: "Enforcing the constraint (from the source).",
          code: `for item in parsed["keep"]:
    key = canonical_key(item)
    if key in allowed and key not in seen:
        seen.add(key)
        kept.append(allowed[key])       # use OUR surface form, not the model's
    elif key:
        hallucinated.append(item)

if not kept:
    return candidates[:top_k]           # fall back to the deterministic list`,
        },
      ],
    },
    {
      id: "engineering",
      title: "Running against ten rate-limited APIs",
      blocks: [
        {
          type: "list",
          items: [
            "**Per-host pacing and retries.** A shared HTTP layer spaces requests per host, retries with backoff, and honors `Retry-After`, but caps the wait at 30 seconds so an exhausted daily quota fails the source instead of hanging the run overnight.",
            "**On-disk caches** for specificity counts, reference lists, repository records and search results (30-day TTL), so reruns while tuning cost almost nothing.",
            "**Three passes.** Harvest and build candidates per person; score across the whole cohort, since IDF needs everyone; then add the niche facet.",
            "**Preflight.** Before a run it reports which sources are configured and reachable, so a missing key degrades one source visibly rather than silently.",
            "**Review workbooks.** The run exports a per-person spreadsheet for a librarian to mark keywords, so validation has somewhere to happen.",
          ],
        },
      ],
    },
    {
      id: "what-i-would-change",
      title: "What I would change today",
      feature: true,
      blocks: [
        {
          type: "note",
          tone: "proposal",
          title: "Present-day assessment, not implemented",
          text: "The design reasoning is sound, but much of it was tuned by looking at examples. The next step is to make it measurable.",
        },
        {
          type: "h3",
          text: "1. Turn the review workbooks into a labelled set",
        },
        {
          type: "p",
          text: "Five versions were compared by reading their output. I'd collect the librarians' marks from the review workbooks into a labelled set and report precision at the top of each profile per version and per source. Then a weight change becomes a measured decision, and the choice between versions has a number behind it.",
        },
        {
          type: "h3",
          text: "2. Apply the person-level affiliation check everywhere",
        },
        {
          type: "p",
          text: "The search-candidate path checks that the matched author carried the affiliation. The OpenAlex discovery path checks only that someone on the paper did. That's looser, since a co-author can satisfy it. I'd use the person-level check on both paths, and match the institution by identifier rather than by name, so affiliated institutions with similar names can't pass.",
        },
        {
          type: "h3",
          text: "3. Tests and packaging",
        },
        {
          type: "p",
          text: "There are no automated tests, and dependencies are listed only in the README. The pure pieces are easy to test (the source weighting, the rarity curve, the LLM constraint, de-duplication), and they're where a regression would quietly change every profile. I'd add those tests, pin dependencies, and keep secrets in the environment only.",
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
            "No measured accuracy; profiles haven't yet been validated against librarian judgments.",
            "Small scale by design: a cohort of about a dozen people, run sequentially, stored as JSON files.",
            "Depends on the coverage and licensing terms of external bibliographic sources.",
          ],
        },
      ],
    },
  ],
};
