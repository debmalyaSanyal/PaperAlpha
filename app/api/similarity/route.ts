import { analyzeSimilarity } from "@/lib/similarity/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text: string; sources: Array<{ title: string; text: string }> };
    return Response.json({ result: analyzeSimilarity(body.text || "", body.sources || []) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Similarity analysis failed." },
      { status: 400 },
    );
  }
}
