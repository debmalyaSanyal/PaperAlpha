import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateProjectSchema, ListProjectsQuerySchema } from "@/lib/schemas/project";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());

    const parsedQuery = ListProjectsQuerySchema.safeParse(searchParams);
    if (!parsedQuery.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: parsedQuery.error.format() }, { status: 400 });
    }

    const { status, q, limit, cursor } = parsedQuery.data;

    const where: any = {
      userId: user.id,
    };

    if (status) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { topic: { contains: q } },
        { problem: { contains: q } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        files: { select: { id: true, originalName: true, category: true, sizeBytes: true } },
        _count: {
          select: {
            sections: true,
            citations: true,
            figures: true,
            tables: true,
          },
        },
        jobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, stage: true, progress: true, errorMessage: true, createdAt: true },
        },
      },
    });

    const total = await prisma.project.count({ where });

    return NextResponse.json({
      items: projects,
      total,
      limit,
    });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to list projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const parseResult = CreateProjectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        title: data.title,
        topic: data.topic,
        problem: data.problem,
        objectives: data.objectives || null,
        questions: data.questions || null,
        notes: data.notes || null,
        paperFormat: data.paperFormat,
        customFormat: data.customFormat || null,
        customFormatPatch: data.customFormatPatch ? JSON.stringify(data.customFormatPatch) : null,
        citationStyle: data.citationStyle,
        language: data.language,
        targetPages: data.targetPages,
        targetWords: data.targetWords || null,
        additionalInstructions: data.additionalInstructions || null,
        status: "CREATED",
        researchInput: {
          create: {
            topic: data.topic,
            problem: data.problem,
            objectives: data.objectives || null,
            questions: data.questions || null,
            notes: data.notes || null,
          },
        },
        validation: {
          create: {
            verifiedResults: false,
            verifiedReferences: false,
            verifiedMethodology: false,
            reviewedAiContent: false,
            verifiedCompliance: false,
          },
        },
      },
      include: {
        researchInput: true,
        validation: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to create project" }, { status: 500 });
  }
}

