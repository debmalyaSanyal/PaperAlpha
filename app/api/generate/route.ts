import { getAIProvider } from "@/lib/ai/provider";
import { buildQualityReport } from "@/lib/validation/quality";
import type { GenerationJob } from "@/types/paperalpha";

export async function POST(request: Request) {
  try {
    const job = await request.json() as GenerationJob;
    const provider = getAIProvider();
    const paper = await provider.generatePaper(job);
    const quality = buildQualityReport(paper, job.analysis, 0);
    return Response.json({ paper, quality });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Paper generation failed." },
      { status: 400 },
    );
  }
}
