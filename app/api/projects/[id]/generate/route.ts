import { NextResponse } from "next/server";
import { z } from "zod";

import { requireProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getQueue } from "@/lib/queue";
import { ensureWorkerLoop, processJobById } from "@/lib/queue/worker";

const GenerateRequestSchema = z.object({
  stages: z.array(z.string()).optional(),
  regenerate: z
    .object({
      sectionKey: z.string().optional(),
      instructions: z.string().optional(),
      discardManualEdits: z.boolean().optional(),
    })
    .optional(),
  inline: z.boolean().optional(), // Run synchronously in request if requested (e.g. testing)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);
    const body = await request.json().catch(() => ({}));

    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid generate parameters", details: parsed.error.format() }, { status: 400 });
    }

    const { stages, regenerate, inline } = parsed.data;

    // Check if there is already an active job for this project
    const activeJob = await prisma.generationJob.findFirst({
      where: {
        projectId: project.id,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeJob) {
      return NextResponse.json(
        {
          message: "A generation job is already active for this project.",
          job: {
            id: activeJob.id,
            status: activeJob.status,
            stage: activeJob.stage,
            progress: activeJob.progress,
            createdAt: activeJob.createdAt,
          },
        },
        { status: 200 }
      );
    }

    // Enqueue the generation job
    const queue = getQueue();
    const { jobId } = await queue.enqueue({
      projectId: project.id,
      type: regenerate?.sectionKey ? "section_regenerate" : "full_paper",
      payload: {
        stages: stages ?? null,
        regenerate: regenerate ?? null,
      },
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "GENERATING" },
    });

    if (inline) {
      // Run right now in the current thread (useful for offline/mock tests)
      await processJobById(jobId);
    } else {
      // In dev mode, ensure our background worker loop is running to claim & execute
      ensureWorkerLoop({
        onLog: (line) => console.log(`[QueueWorker] ${line}`),
      });
    }

    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });

    return NextResponse.json({
      jobId,
      status: job?.status || "QUEUED",
      stage: job?.stage || "QUEUED",
      progress: job?.progress || 0,
    }, { status: 202 });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to trigger generation" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);

    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");

    const job = jobId
      ? await prisma.generationJob.findFirst({
          where: { id: jobId, projectId: project.id },
        })
      : await prisma.generationJob.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
        });

    if (!job) {
      return NextResponse.json({ error: "No generation job found for project" }, { status: 404 });
    }

    // Also fetch associated artifacts for intermediate agent outputs
    const artifacts = await prisma.artifact.findMany({
      where: { projectId: project.id },
      select: { stage: true, key: true, updatedAt: true },
    });

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        createdAt: job.createdAt,
      },
      artifacts,
    });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to retrieve status" }, { status: 500 });
  }
}
