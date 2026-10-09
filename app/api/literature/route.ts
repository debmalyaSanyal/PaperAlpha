import { fallbackLiterature, searchLiterature } from "@/lib/literature/providers";

export async function POST(request: Request) {
  try {
    const { query, demo } = await request.json() as { query?: string; demo?: boolean };
    if (demo) {
      return Response.json({
        references: [
          {
            id: "demo-ref-1",
            title: "Machine learning in diabetes prediction: a review",
            authors: ["A. Researcher", "B. Clinician"],
            year: 2024,
            venue: "Demo Literature Review",
            abstract: "A demo-only literature record used to exercise the citation workflow.",
            url: "https://openalex.org",
            source: "Demo reviewed source",
          },
          {
            id: "demo-ref-2",
            title: "Interpretable tabular models for clinical risk prediction",
            authors: ["C. Analyst"],
            year: 2023,
            venue: "Demo Health AI",
            abstract: "A clearly marked sample reference for PaperAlpha demo mode.",
            url: "https://crossref.org",
            source: "Demo reviewed source",
          },
        ],
      });
    }

    const references = await searchLiterature(query || "");
    return Response.json({ references: references.length ? references : fallbackLiterature(query || "research topic") });
  } catch {
    return Response.json({ references: fallbackLiterature("research topic"), warning: "Free literature APIs were unavailable; demo fallback returned." });
  }
}
