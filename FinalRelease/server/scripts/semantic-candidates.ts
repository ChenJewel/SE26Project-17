import data from "./semantic-candidate-sources.json" assert { type: "json" };
import { buildSemanticTagMappingCandidates, type SemanticCandidateSource } from "../src/modules/semanticTagMappings.js";

const fixture = data as {
  expectedCandidates: Array<{ normalizedText: string; canonicalTag: string }>;
  sources: SemanticCandidateSource[];
};

const candidates = buildSemanticTagMappingCandidates(fixture.sources);
const missingExpected = fixture.expectedCandidates.filter(
  (expected) =>
    !candidates.some(
      (candidate) =>
        candidate.normalizedText === expected.normalizedText &&
        candidate.canonicalTag === expected.canonicalTag &&
        candidate.status === "pending"
    )
);
const privateLeaks = candidates.filter((candidate) =>
  candidate.sampleSources.some((source) => source.sourceType === "private_chat" || source.sourceId.startsWith("private-"))
);
const nonPendingCandidates = candidates.filter((candidate) => candidate.status !== "pending");

const summary = {
  candidateCount: candidates.length,
  expectedCount: fixture.expectedCandidates.length,
  missingExpected,
  privateLeakCount: privateLeaks.length,
  nonPendingCount: nonPendingCandidates.length,
  candidates,
};

console.log(JSON.stringify(summary, undefined, 2));

if (missingExpected.length || privateLeaks.length || nonPendingCandidates.length) {
  process.exitCode = 1;
}
