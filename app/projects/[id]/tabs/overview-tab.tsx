"use client";

import { CheckCircle2, Clock, Play, AlertCircle } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/pipeline/stages";

interface OverviewTabProps {
  project: any;
  activeJob: any;
  onGenerate: () => void;
  generating: boolean;
}

export function OverviewTab({ project, activeJob, onGenerate, generating }: OverviewTabProps) {
  const quality = project.qualityReports?.[0];
  const totalWords = (project.sections ?? []).reduce((acc: number, s: any) => acc + (s.wordCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Multi-Agent Pipeline</h3>
          <p className="text-sm text-slate-500 mt-1">
            Status: <span className="font-semibold text-slate-800">{project.status}</span>
            {project.statusDetail && ` &bull; ${project.statusDetail}`}
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating || activeJob?.status === "RUNNING"}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-sm transition-all cursor-pointer"
        >
          {generating || activeJob?.status === "RUNNING" ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              <span>Pipeline Running ({activeJob?.progress || 0}%)...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>{project.sections.length > 0 ? "Regenerate Full Paper" : "Generate Paper"}</span>
            </>
          )}
        </button>
      </div>

      {/* Pipeline Stages Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Pipeline Execution Stages</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCompleted = activeJob?.progress >= ((idx + 1) / PIPELINE_STAGES.length) * 100 || (project.sections?.length > 0 && !generating);
            const isCurrent = activeJob?.stage === stage;

            return (
              <div
                key={stage}
                className={`p-3 rounded-lg border text-xs flex flex-col justify-between h-20 ${
                  isCurrent
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-bold"
                    : isCompleted
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75">#{idx + 1}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : isCurrent ? (
                    <Clock className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                  ) : null}
                </div>
                <div className="capitalize truncate font-medium">{stage}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics & Quality Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase">Total Words Generated</span>
          <div className="text-2xl font-bold text-slate-900">{totalWords.toLocaleString()}</div>
          <p className="text-xs text-slate-500">Across {project.sections?.length || 0} outlined sections</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase">Citations &amp; References</span>
          <div className="text-2xl font-bold text-slate-900">{project.citations?.length || 0}</div>
          <p className="text-xs text-slate-500">Style: {project.citationStyle} &bull; Verified sources</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase">Quality Assessment</span>
          <div className="text-2xl font-bold text-emerald-600">
            {quality ? `${quality.overallScore}/100` : "Pending"}
          </div>
          <p className="text-xs text-slate-500">
            {quality ? `Academic rigor: ${quality.academicRigorScore || 85}/100` : "Run pipeline to evaluate"}
          </p>
        </div>
      </div>
    </div>
  );
}
