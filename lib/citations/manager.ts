import type { Citation, CitationStyle, Reference } from "@/types/paperalpha";

export function verifiedReferences(references: Reference[]) {
  return references.filter((reference) => {
    const hasIdentity = Boolean(reference.doi || reference.url);
    const isDemo = /demo/i.test(reference.source);
    return hasIdentity && !isDemo;
  });
}

export function buildCitations(references: Reference[], style: CitationStyle = "IEEE"): Citation[] {
  return verifiedReferences(references).map((reference, index) => ({
    id: `citation-${index + 1}`,
    referenceId: reference.id,
    marker: citationMarker(style, reference, index + 1),
  }));
}

export function citationMarker(style: CitationStyle | string, reference: Reference, index: number) {
  if (style === "APA 7") {
    const author = reference.authors[0]?.split(/\s+/).at(-1) || "Author";
    return `(${author}, ${reference.year || "n.d."})`;
  }
  return `[${index}]`;
}

export function formatReference(reference: Reference, index: number, style: CitationStyle | string) {
  const authors = reference.authors.join(", ") || "Unknown author";
  const locator = reference.doi || reference.url || "";
  if (style === "APA 7") {
    return `${authors} (${reference.year || "n.d."}). ${reference.title}. ${reference.venue || reference.source}. ${locator}`.trim();
  }
  return `[${index}] ${authors}, "${reference.title}," ${reference.venue || reference.source}, ${reference.year || "n.d."}. ${locator}`.trim();
}

export function citationIssues(citations: Citation[], references: Reference[]) {
  const referenceIds = new Set(references.map((reference) => reference.id));
  const citedIds = new Set(citations.map((citation) => citation.referenceId));
  return {
    missingReferences: citations.filter((citation) => !referenceIds.has(citation.referenceId)),
    unusedReferences: references.filter((reference) => !citedIds.has(reference.id)),
  };
}
