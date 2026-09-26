import { notFound } from "next/navigation";

import { requireProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectWorkspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await requireProjectAccess(id);
  } catch (error: any) {
    if (error.name === "NotFoundError" || error.name === "ForbiddenError") {
      notFound();
    }
    throw error;
  }

  const project = await prisma.project.findUnique({
    where: { id },
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
      documents: { orderBy: { createdAt: "desc" } },
      qualityReports: { orderBy: { createdAt: "desc" }, take: 1 },
      jobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!project) {
    notFound();
  }

  return <ProjectWorkspace initialProject={project} />;
}
