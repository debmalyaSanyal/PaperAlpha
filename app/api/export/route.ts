import { createDocx } from "@/lib/export/docx";
import type { GeneratedPaper } from "@/types/paperalpha";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const paper = await request.json() as GeneratedPaper;
    const docx = createDocx(paper);
    const safeName = (paper.title || "paperalpha-paper").replace(/[^\w.-]+/g, "-").toLowerCase();
    return new Response(docx, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${safeName}.docx"`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "DOCX export failed." },
      { status: 400 },
    );
  }
}
