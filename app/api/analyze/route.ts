import { analyzeResearchFiles, buildDemoAnalysis } from "@/lib/analysis/research";
import type { ResearchBasics } from "@/types/paperalpha";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const demo = formData.get("demo") === "true";
    if (demo) {
      return Response.json({ analysis: buildDemoAnalysis() });
    }

    const basicsRaw = String(formData.get("basics") || "{}");
    const basics = JSON.parse(basicsRaw) as ResearchBasics;
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);
    const analysis = await analyzeResearchFiles(files, basics);
    return Response.json({ analysis });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Research analysis failed." },
      { status: 400 },
    );
  }
}
