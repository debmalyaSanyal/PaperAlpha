import Link from "next/link";
import { BookOpen, FileText, PlusCircle, CheckCircle2, Clock, AlertCircle } from "lucide-react";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function SetupNotice({ title, message }: { title: string; message: string }) {
  const isDbIssue = /database|DATABASE_URL|postgres|sqlite|prisma/i.test(`${title} ${message}`);
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
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h2 className="font-semibold text-amber-900">{title}</h2>
        <p className="mt-2 text-sm text-amber-800 whitespace-pre-line">{message}</p>
        {isDbIssue ? (
          <div className="mt-4 rounded-lg bg-white/70 border border-amber-200 p-4 text-xs text-amber-900 space-y-2">
            <p className="font-semibold">How to make this production site fully work (persistent data)</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Create a free Postgres DB (Neon https://neon.tech or Supabase https://supabase.com) and copy its connection string.</li>
              <li>In Netlify → Site configuration → Environment variables, set DATABASE_URL to postgresql://... and AUTH_SECRET to a 32+ char random string.</li>
              <li>In prisma/schema.prisma change datasource provider to &quot;postgresql&quot;, run npx prisma generate, commit, and redeploy. Then run npx prisma db push once against that DATABASE_URL to create tables.</li>
            </ol>
            <p>
              Why: this repo ships SQLite (file:./dev.db). Netlify serverless functions have a read-only
              filesystem (only /tmp is writable, and it is wiped between invocations), so SQLite can
              never persist there — projects/files created on the live site would vanish.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-amber-700">
            Set AUTH_SECRET (≥16 chars), ALLOW_ANONYMOUS_DEV_USER=true, and DATABASE_URL in Netlify → Site
            configuration → Environment variables, then redeploy.
          </p>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await getSessionUser();
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    return <SetupNotice title="Server configuration needed" message={msg} />;
  }

  if (!user) {
    return (
      <SetupNotice
        title="Authentication required"
        message="No session found and anonymous demo access is disabled. Set ALLOW_ANONYMOUS_DEV_USER=true in Netlify for a public demo, or add a login flow."
      />
    );
  }

  // Ephemeral fallback user (no reachable DB in production) — render shell UI
  // instead of throwing a Digest error.
  if (user.id === "demo-ephemeral") {
    return (
      <SetupNotice
        title="Database not configured"
        message={`Signed in as ${user.email} (ephemeral, DB unreachable).\nThis Netlify deploy has no reachable DATABASE_URL, so projects can't be listed yet. Add a Postgres DATABASE_URL (e.g. Neon/Supabase) in Netlify env vars and redeploy.`}
      />
    );
  }

  let projects: Array<{
    status: string;
    files: Array<{ id: string }>;
    sections: Array<{ id: string; wordCount: number }>;
    citations: Array<{ id: string }>;
    validation: {
      verifiedResults: boolean;
      verifiedReferences: boolean;
      verifiedMethodology: boolean;
      reviewedAiContent: boolean;
      verifiedCompliance: boolean;
    } | null;
    jobs: Array<{ status: string; stage: string | null; progress: number }>;
  } & {
    id: string;
    title: string;
    topic: string;
    paperFormat: string;
    updatedAt: Date;
  }>;
  try {
    projects = await prisma.project.findMany({
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
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    return (
      <SetupNotice
        title="Database unreachable"
        message={`Could not load projects: ${msg}\n\nIf DATABASE_URL is still "file:./dev.db", SQLite won't work on Netlify serverless functions. Switch to Postgres (see prisma/schema.prisma header + .env.example) and set DATABASE_URL in Netlify.`}
      />
    );
  }

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
