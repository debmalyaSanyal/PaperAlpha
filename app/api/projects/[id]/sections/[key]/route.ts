import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getQueue } from "@/lib/queue";
import { RegenerateSectionSchema, UpdateSectionSchema } from "@/lib/schemas/project";
import { countWords } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    const { id, key } = await params;
    const { project } = await requireProjectAccess(id);

    const section = await prisma.paperSection.findUnique({
      where: { projectId_key: { projectId: project.id, key } },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json(section);
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to get section" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    const { id, key } = await params;
    const { project } = await requireProjectAccess(id);
    const body = await request.json();

    const parsed = UpdateSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid section update", details: parsed.error.format() }, { status: 400 });
    }

    const currentSection = await prisma.paperSection.findUnique({
      where: { projectId_key: { projectId: project.id, key } },
    });

    if (!currentSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const { content, title } = parsed.data;
    const newWordCount = countWords(content);

    const updated = await prisma.paperSection.update({
      where: { id: currentSection.id },
      data: {
        content,
        title: title || currentSection.title,
        wordCount: newWordCount,
        isUserEdited: true,
        revision: { increment: 1 },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to update section" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    const { id, key } = await params;
    const { project } = await requireProjectAccess(id);
    const body = await request.json().catch(() => ({}));

    const parsed = RegenerateSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid regenerate parameters", details: parsed.error.format() }, { status: 400 });
    }

    const { instructions, force, targetWords } = parsed.data;

    // Enqueue section regeneration job
    const queue = getQueue();
    const { jobId } = await queue.enqueue({
      projectId: project.id,
      type: "section_regenerate",
      payload: {
        stages: ["drafting", "verification", "citations", "quality"],
        regenerate: {
          sectionKey: key,
          instructions,
          force,
          targetWords,
        },
      },
    });

    return NextResponse.json({
      jobId,
      message: `Regeneration enqueued for section ${key}`,
    }, { status: 202 });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to regenerate section" }, { status: 500 });
  }
}

