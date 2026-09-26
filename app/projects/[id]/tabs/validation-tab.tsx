"use client";

import { useState } from "react";
import { CheckSquare, Square, Download, ShieldCheck, AlertCircle } from "lucide-react";

interface ValidationTabProps {
  project: any;
  onRefresh: () => void;
}

export function ValidationTab({ project, onRefresh }: ValidationTabProps) {
  const initial = project.validation || {};
  const [checklist, setChecklist] = useState({
    verifiedResults: Boolean(initial.verifiedResults),
    verifiedReferences: Boolean(initial.verifiedReferences),
    verifiedMethodology: Boolean(initial.verifiedMethodology),
    reviewedAiContent: Boolean(initial.reviewedAiContent),
    verifiedCompliance: Boolean(initial.verifiedCompliance),
  });
  const [saving, setSaving] = useState(false);

  const allChecked =
    checklist.verifiedResults &&
    checklist.verifiedReferences &&
    checklist.verifiedMethodology &&
    checklist.reviewedAiContent &&
    checklist.verifiedCompliance;

  const handleToggle = (field: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/validation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checklist),
      });
      if (!res.ok) throw new Error("Failed to update validation");
      alert("Verification status updated.");
      onRefresh();
    } catch {
      alert("Error saving checklist");
    } finally {
      setSaving(false);
    }
  };

  const latestDoc = project.documents?.[0];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Human Review &amp; Publication Verification</span>
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Academic integrity and compliance policy: final camera-ready unwatermarked manuscript export requires
            explicit verification of all 5 review criteria.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {[
            {
              key: "verifiedResults",
              label: "Verified Experimental Results & Metrics",
              desc: "All quantitative numbers, figures, tables, and claims accurately reflect true experimental data.",
            },
            {
              key: "verifiedReferences",
              label: "Verified Citations & Literature Sources",
              desc: "All bibliographic citations exist, were checked against scholarly indices, and are not hallucinated.",
            },
            {
              key: "verifiedMethodology",
              label: "Verified Methodology & Technical Soundness",
              desc: "The equations, architectures, formulations, and algorithms are mathematically and scientifically correct.",
            },
            {
              key: "reviewedAiContent",
              label: "Reviewed Agent Drafting & Factuality",
              desc: "All AI-synthesized sections were read and scrutinized by a human researcher for factual validity.",
            },
            {
              key: "verifiedCompliance",
              label: "Target Venue & Format Compliance",
              desc: `Layout, font, margins, columns, and section headers adhere to ${project.paperFormat} author instructions.`,
            },
          ].map((item) => {
            const checked = checklist[item.key as keyof typeof checklist];
            return (
              <div
                key={item.key}
                onClick={() => handleToggle(item.key as keyof typeof checklist)}
                className={`p-4 rounded-lg border flex items-start space-x-3 cursor-pointer transition-all ${
                  checked
                    ? "border-emerald-300 bg-emerald-50/50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="mt-0.5 text-emerald-600">
                  {checked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-slate-900">{item.label}</h5>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-md shadow-xs cursor-pointer"
          >
            {saving ? "Saving..." : "Save Checklist State"}
          </button>

          {allChecked ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center space-x-1">
              <ShieldCheck className="w-4 h-4" />
              <span>All Checks Cleared &mdash; Publication Release Unlocked</span>
            </span>
          ) : (
            <span className="text-xs text-amber-600 flex items-center space-x-1">
              <AlertCircle className="w-4 h-4" />
              <span>Pending Human Verification</span>
            </span>
          )}
        </div>
      </div>

      {/* Download Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Download Manuscript (.docx)</h4>
          <p className="text-xs text-slate-500 mt-1">
            {latestDoc
              ? `Compiled ${project.paperFormat} manuscript (${(latestDoc.sizeBytes / 1024).toFixed(1)} KB)`
              : "Generate the paper to compile the DOCX publication artifact."}
          </p>
        </div>

        {latestDoc ? (
          <a
            href={`/api/files/download?key=${encodeURIComponent(latestDoc.storageKey)}`}
            className={`inline-flex items-center space-x-2 px-4 py-2 font-medium text-xs rounded-md shadow-xs transition-colors ${
              allChecked
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            onClick={(e) => {
              if (!allChecked) {
                e.preventDefault();
                alert("Please clear all 5 verification checkboxes before downloading the camera-ready manuscript.");
              }
            }}
          >
            <Download className="w-4 h-4" />
            <span>Download Paper ({allChecked ? "Release" : "Locked"})</span>
          </a>
        ) : (
          <button disabled className="px-4 py-2 bg-slate-100 text-slate-400 text-xs font-medium rounded-md cursor-not-allowed">
            No Document Yet
          </button>
        )}
      </div>
    </div>
  );
}
