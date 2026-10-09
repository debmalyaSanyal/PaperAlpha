import type { Reference } from "@/types/paperalpha";

export interface LiteratureProvider {
  search(query: string): Promise<Reference[]>;
  getPaper?(id: string): Promise<Reference | null>;
  getReferences?(id: string): Promise<Reference[]>;
}

function normalizeAuthorList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((author) => {
      if (typeof author === "string") return author;
      if (author && typeof author === "object" && "author" in author) {
        const nested = (author as { author?: { display_name?: string } }).author;
        return nested?.display_name || "";
      }
      if (author && typeof author === "object" && "name" in author) {
        return String((author as { name?: unknown }).name || "");
      }
      return "";
    })
    .filter(Boolean);
}

export class OpenAlexProvider implements LiteratureProvider {
  async search(query: string): Promise<Reference[]> {
    if (!query.trim()) return [];
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5`;
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) throw new Error("OpenAlex search failed.");
    const data = await response.json() as { results?: Array<Record<string, unknown>> };
    return (data.results || []).map((work, index) => ({
      id: String(work.id || `openalex-${index}`),
      title: String(work.title || "Untitled work"),
      authors: normalizeAuthorList(work.authorships),
      year: typeof work.publication_year === "number" ? work.publication_year : undefined,
      venue: (work.primary_location as { source?: { display_name?: string } } | undefined)?.source?.display_name,
      abstract: abstractFromInvertedIndex(work.abstract_inverted_index),
      doi: typeof work.doi === "string" ? work.doi : undefined,
      url: typeof work.id === "string" ? work.id : undefined,
      source: "OpenAlex",
    }));
  }

  async getPaper(id: string): Promise<Reference | null> {
    const response = await fetch(id.startsWith("http") ? id : `https://api.openalex.org/works/${encodeURIComponent(id)}`, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) return null;
    const work = await response.json() as Record<string, unknown>;
    return mapOpenAlexWork(work, 0);
  }

  async getReferences(id: string): Promise<Reference[]> {
    const paper = await this.getPaper(id);
    if (!paper) return [];
    const response = await fetch(`https://api.openalex.org/works?filter=cites:${encodeURIComponent(paper.id)}&per-page=10`, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) return [];
    const data = await response.json() as { results?: Array<Record<string, unknown>> };
    return (data.results || []).map(mapOpenAlexWork);
  }
}

export class CrossrefProvider implements LiteratureProvider {
  async search(query: string): Promise<Reference[]> {
    if (!query.trim()) return [];
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=5`;
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) throw new Error("Crossref search failed.");
    const data = await response.json() as { message?: { items?: Array<Record<string, unknown>> } };
    return (data.message?.items || []).map((item, index) => ({
      id: String(item.DOI || `crossref-${index}`),
      title: Array.isArray(item.title) ? String(item.title[0]) : "Untitled work",
      authors: Array.isArray(item.author)
        ? item.author.map((author) => `${(author as { given?: string }).given || ""} ${(author as { family?: string }).family || ""}`.trim()).filter(Boolean)
        : [],
      year: Array.isArray((item.published as { "date-parts"?: number[][] } | undefined)?.["date-parts"])
        ? (item.published as { "date-parts": number[][] })["date-parts"][0]?.[0]
        : undefined,
      venue: Array.isArray(item["container-title"]) ? String(item["container-title"][0]) : undefined,
      abstract: typeof item.abstract === "string" ? item.abstract.replace(/<[^>]+>/g, "") : undefined,
      doi: typeof item.DOI === "string" ? item.DOI : undefined,
      url: typeof item.URL === "string" ? item.URL : undefined,
      source: "Crossref",
    }));
  }

  async getPaper(id: string): Promise<Reference | null> {
    const doi = id.replace(/^https?:\/\/doi.org\//, "");
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) return null;
    const data = await response.json() as { message?: Record<string, unknown> };
    return data.message ? mapCrossrefItem(data.message, 0) : null;
  }

  async getReferences(id: string): Promise<Reference[]> {
    const paper = await this.getPaper(id);
    return paper ? [paper] : [];
  }
}

export async function searchLiterature(query: string) {
  const providers: LiteratureProvider[] = [new OpenAlexProvider(), new CrossrefProvider()];
  const settled = await Promise.allSettled(providers.map((provider) => provider.search(query)));
  const references = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = reference.doi || reference.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

export function fallbackLiterature(query: string): Reference[] {
  return [
    {
      id: "demo-openalex-1",
      title: `Search-ready literature placeholder for "${query}"`,
      authors: ["PaperAlpha Demo"],
      year: new Date().getFullYear(),
      venue: "Demo Mode",
      abstract: "This is a clearly labeled demo reference used only when free literature services are unavailable. It must be reviewed or replaced before real citation use.",
      url: "https://openalex.org",
      source: "Demo fallback",
    },
  ];
}

function abstractFromInvertedIndex(index: unknown) {
  if (!index || typeof index !== "object") return undefined;
  const words: Array<{ word: string; position: number }> = [];
  for (const [word, positions] of Object.entries(index as Record<string, number[]>)) {
    if (Array.isArray(positions)) {
      positions.forEach((position) => words.push({ word, position }));
    }
  }
  return words.sort((a, b) => a.position - b.position).map((item) => item.word).join(" ");
}

function mapOpenAlexWork(work: Record<string, unknown>, index: number): Reference {
  return {
    id: String(work.id || `openalex-${index}`),
    title: String(work.title || "Untitled work"),
    authors: normalizeAuthorList(work.authorships),
    year: typeof work.publication_year === "number" ? work.publication_year : undefined,
    venue: (work.primary_location as { source?: { display_name?: string } } | undefined)?.source?.display_name,
    abstract: abstractFromInvertedIndex(work.abstract_inverted_index),
    doi: typeof work.doi === "string" ? work.doi : undefined,
    url: typeof work.id === "string" ? work.id : undefined,
    source: "OpenAlex",
  };
}

function mapCrossrefItem(item: Record<string, unknown>, index: number): Reference {
  return {
    id: String(item.DOI || `crossref-${index}`),
    title: Array.isArray(item.title) ? String(item.title[0]) : "Untitled work",
    authors: Array.isArray(item.author)
      ? item.author.map((author) => `${(author as { given?: string }).given || ""} ${(author as { family?: string }).family || ""}`.trim()).filter(Boolean)
      : [],
    year: Array.isArray((item.published as { "date-parts"?: number[][] } | undefined)?.["date-parts"])
      ? (item.published as { "date-parts": number[][] })["date-parts"][0]?.[0]
      : undefined,
    venue: Array.isArray(item["container-title"]) ? String(item["container-title"][0]) : undefined,
    abstract: typeof item.abstract === "string" ? item.abstract.replace(/<[^>]+>/g, "") : undefined,
    doi: typeof item.DOI === "string" ? item.DOI : undefined,
    url: typeof item.URL === "string" ? item.URL : undefined,
    source: "Crossref",
  };
}
