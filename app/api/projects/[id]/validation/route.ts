import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ValidationChecklistSchema } from "@/lib/schemas/project";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);

    const validation = await prisma.researchValidation.findUnique({
      where: { projectId: project.id },
    });

    return NextResponse.json(
      validation || {
        verifiedResults: false,
        verifiedReferences: false,
        verifiedMethodology: false,
        reviewedAiContent: false,
        verifiedCompliance: false,
        confirmedAt: null,
      }
    );
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to load validation" }, { status: 500 });
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

    const parsed = ValidationChecklistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid validation checklist", details: parsed.error.format() }, { status: 400 });
    }

    const {
      verifiedResults,
      verifiedReferences,
      verifiedMethodology,
      reviewedAiContent,
      verifiedCompliance,
    } = parsed.data;

    const allChecked =
      verifiedResults &&
      verifiedReferences &&
      verifiedMethodology &&
      reviewedAiContent &&
      verifiedCompliance;

    const updated = await prisma.researchValidation.upsert({
      where: { projectId: project.id },
      update: {
        verifiedResults,
        verifiedReferences,
        verifiedMethodology,
        reviewedAiContent,
        verifiedCompliance,
        confirmedAt: allChecked ? new Date() : null,
      },
      create: {
        projectId: project.id,
        verifiedResults,
        verifiedReferences,
        verifiedMethodology,
        reviewedAiContent,
        verifiedCompliance,
        confirmedAt: allChecked ? new Date() : null,
      },
    });

    if (allChecked) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          statusDetail: "All human verification checks cleared. Production publication download unlocked.",
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to update validation" }, { status: 500 });
  }
}

