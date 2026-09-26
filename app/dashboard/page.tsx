import Link from "next/link";
import { BookOpen, FileText, PlusCircle, CheckCircle2, Clock, AlertCircle } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      files: { select: { id: true } },
      sections: { select: { id: true, wordCount: true } },
      citations: { select: { id: true } },
      validation: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, stage: true, progress: true },
      },
    },
  });

  const total = projects.length;
  const generating = projects.filter((p) => p.status === "GENERATING" || p.status === "RUNNING").length;
  const verified = projects.filter(
    (p) =>
      p.validation?.verifiedResults &&
      p.validation?.verifiedReferences &&
      p.validation?.verifiedMethodology &&
      p.validation?.reviewedAiContent &&
      p.validation?.verifiedCompliance
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Research Papers</h1>
          <p className="mt-1 text-sm text-slate-500">Autonomous multi-agent research paper drafting &amp; formatting.</p>
        </div>
        <Link
          href="/projects/create"
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Paper</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center">
          <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600"><FileText className="w-6 h-6" /></div>
          <div className="ml-4">
            <dt className="text-xs font-semibold text-slate-400 uppercase">Total Papers</dt>
            <dd className="text-2xl font-bold text-slate-900">{total}</dd>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center">
          <div className="bg-amber-50 p-3 rounded-lg text-amber-600"><Clock className="w-6 h-6" /></div>
          <div className="ml-4">
            <dt className="text-xs font-semibold text-slate-400 uppercase">Generating</dt>
            <dd className="text-2xl font-bold text-amber-600">{generating}</dd>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center">
          <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600"><CheckCircle2 className="w-6 h-6" /></div>
          <div className="ml-4">
            <dt className="text-xs font-semibold text-slate-400 uppercase">Verified &amp; Ready</dt>
            <dd className="text-2xl font-bold text-emerald-600">{verified}</dd>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">All Papers</h2>
          <span className="text-xs text-slate-500">{projects.length} paper(s)</span>
        </div>
        {projects.length === 0 ? (
          <div className="text-center py-16 px-4">
            <BookOpen className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No research papers yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              Get started by creating a paper project, uploading datasets or notebooks, and letting the pipeline run.
            </p>
            <div className="mt-6">
              <Link
                href="/projects/create"
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Paper</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {projects.map((project) => {
              const totalWords = project.sections.reduce((acc, s) => acc + s.wordCount, 0);
              const latestJob = project.jobs[0];

              return (
                <div
                  key={project.id}
                  className="p-6 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center space-x-2.5">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-lg font-semibold text-indigo-600 hover:text-indigo-800 hover:underline line-clamp-1"
                      >
                        {project.title}
                      </Link>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {project.paperFormat}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 line-clamp-2">{project.topic}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                      <span>Updated {formatDate(project.updatedAt)}</span>
                      <span>&bull;</span>
                      <span>{project.files.length} files</span>
                      <span>&bull;</span>
                      <span>{project.sections.length} sections ({totalWords.toLocaleString()} words)</span>
                      <span>&bull;</span>
                      <span>{project.citations.length} citations</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 self-start md:self-center flex-shrink-0">
                    {latestJob?.status === "RUNNING" || project.status === "GENERATING" ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Generating ({latestJob?.progress || 0}%)
                      </span>
                    ) : project.status === "FAILED" ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {project.status}
                      </span>
                    )}

                    <Link
                      href={`/projects/${project.id}`}
                      className="px-3.5 py-1.5 border border-slate-300 hover:border-slate-400 text-slate-700 font-medium text-xs rounded-md bg-white hover:bg-slate-50"
                    >
                      Workspace &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
