import { notFound } from "next/navigation";

import { requireProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectWorkspace } from "./workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await requireProjectAccess(id);
  } catch (error: any) {
    if (error?.name === "NotFoundError" || error?.name === "ForbiddenError") {
      notFound();
    }
    // UnauthorizedError (no session + anonymous disabled) or DB unreachable:
    // render the dashboard-style notice via notFound-safe fallback instead of
    // a Digest crash. Re-throwing here is what produced the Digest on Netlify.
    if (error?.name === "UnauthorizedError" || /database|prisma|connect|AUTH_SECRET/i.test(error?.message ?? "")) {
      const { redirect } = await import("next/navigation");
      redirect("/dashboard");
    }
    throw error;
  }

  let project: Awaited<ReturnType<typeof prisma.project.findUnique>> | null = null;
  try {
    project = await prisma.project.findUnique({
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
  } catch {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }

  if (!project) {
    notFound();
  }

  return <ProjectWorkspace initialProject={project} />;
}
