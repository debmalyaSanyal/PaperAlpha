"use client";

import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface CitationsTabProps {
  project: any;
}

export function CitationsTab({ project }: CitationsTabProps) {
  const citations = project.citations || [];

  if (citations.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
        No citations compiled yet. Run the generation pipeline to search and format academic references.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">Academic Literature &amp; References</h4>
        <span className="text-xs text-slate-500">{citations.length} citation(s) ({project.citationStyle} style)</span>
      </div>

      <div className="divide-y divide-slate-200">
        {citations.map((c: any) => {
          const src = c.source;
          return (
            <div key={c.id} className="p-4 hover:bg-slate-50 transition-colors space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-mono text-xs font-bold rounded">
                    {c.citationKey}
                  </span>
                  {src?.verified ? (
                    <span className="inline-flex items-center text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Verified Source
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs text-amber-600 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 mr-1" />
                      Unverified
                    </span>
                  )}
                </div>
                {src?.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 hover:underline inline-flex items-center"
                  >
                    <span>View Publication</span>
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
              </div>

              <div className="text-sm text-slate-800 font-serif">
                {c.raw || src?.title || "No formatted text"}
              </div>

              {src && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
                  {src.venue && <span>Venue: {src.venue}</span>}
                  {src.year && <span>({src.year})</span>}
                  {src.doi && <span>DOI: {src.doi}</span>}
                  {src.theme && (
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                      Theme: {src.theme}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
