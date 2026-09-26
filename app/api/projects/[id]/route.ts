import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UpdateProjectSchema } from "@/lib/schemas/project";
import { getStorage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);

    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        researchInput: true,
        validation: true,
        files: { orderBy: { createdAt: "desc" } },
        sections: { orderBy: { orderIndex: "asc" } },
        citations: {
          orderBy: { orderIndex: "asc" },
          include: { source: true },
        },
        figures: { orderBy: { number: "asc" } },
        tables: { orderBy: { number: "asc" } },
        experiments: { include: { results: true } },
        documents: { orderBy: { createdAt: "desc" } },
        qualityReports: { orderBy: { createdAt: "desc" }, take: 1 },
        jobs: { orderBy: { createdAt: "desc" }, take: 5 },
        versions: { orderBy: { version: "desc" }, take: 10 },
      },
    });

    return NextResponse.json(fullProject);
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to load project" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);
    const body = await request.json();

    const parseResult = UpdateProjectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const projectUpdate: any = {};
    if (data.title !== undefined) projectUpdate.title = data.title;
    if (data.topic !== undefined) projectUpdate.topic = data.topic;
    if (data.problem !== undefined) projectUpdate.problem = data.problem;
    if (data.objectives !== undefined) projectUpdate.objectives = data.objectives || null;
    if (data.questions !== undefined) projectUpdate.questions = data.questions || null;
    if (data.notes !== undefined) projectUpdate.notes = data.notes || null;
    if (data.paperFormat !== undefined) projectUpdate.paperFormat = data.paperFormat;
    if (data.customFormat !== undefined) projectUpdate.customFormat = data.customFormat || null;
    if (data.customFormatPatch !== undefined) {
      projectUpdate.customFormatPatch = data.customFormatPatch ? JSON.stringify(data.customFormatPatch) : null;
    }
    if (data.citationStyle !== undefined) projectUpdate.citationStyle = data.citationStyle;
    if (data.language !== undefined) projectUpdate.language = data.language;
    if (data.targetPages !== undefined) projectUpdate.targetPages = data.targetPages;
    if (data.targetWords !== undefined) projectUpdate.targetWords = data.targetWords || null;
    if (data.additionalInstructions !== undefined) {
      projectUpdate.additionalInstructions = data.additionalInstructions || null;
    }

    const researchInputUpdate: any = {};
    if (data.topic !== undefined) researchInputUpdate.topic = data.topic;
    if (data.problem !== undefined) researchInputUpdate.problem = data.problem;
    if (data.objectives !== undefined) researchInputUpdate.objectives = data.objectives || null;
    if (data.questions !== undefined) researchInputUpdate.questions = data.questions || null;
    if (data.notes !== undefined) researchInputUpdate.notes = data.notes || null;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(researchInputUpdate).length > 0) {
        await tx.researchInput.upsert({
          where: { projectId: project.id },
          update: researchInputUpdate,
          create: {
            projectId: project.id,
            topic: data.topic ?? project.topic,
            problem: data.problem ?? project.problem,
            ...researchInputUpdate,
          },
        });
      }

      return tx.project.update({
        where: { id: project.id },
        data: projectUpdate,
        include: { researchInput: true, validation: true },
      });
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);
    const storage = getStorage();

    const [files, docs, figures] = await Promise.all([
      prisma.uploadedFile.findMany({ where: { projectId: project.id }, select: { storageKey: true } }),
      prisma.document.findMany({ where: { projectId: project.id }, select: { storageKey: true } }),
      prisma.figure.findMany({ where: { projectId: project.id }, select: { storageKey: true } }),
    ]);

    const storageKeys = [
      ...files.map((f) => f.storageKey),
      ...docs.map((d) => d.storageKey),
      ...figures.map((fig) => fig.storageKey).filter((k): k is string => Boolean(k)),
    ];

    await Promise.allSettled(storageKeys.map((key) => storage.delete(key)));

    await prisma.project.delete({
      where: { id: project.id },
    });

    return NextResponse.json({ success: true, deletedId: project.id });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to delete project" }, { status: 500 });
  }
}

