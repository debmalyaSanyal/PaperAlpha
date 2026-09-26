"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, UploadCloud, AlertCircle } from "lucide-react";
import Link from "next/link";

const PRESET_OPTIONS = ["IEEE", "Springer", "Elsevier", "ACM", "APA", "Nature", "Custom"] as const;
const CITATION_OPTIONS = ["IEEE", "APA", "Vancouver", "Harvard", "Chicago", "MLA"] as const;

export default function CreateProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    topic: "",
    problem: "",
    objectives: "",
    paperFormat: "IEEE",
    citationStyle: "IEEE",
    targetPages: 8,
  });

  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          targetPages: Number(form.targetPages),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();

      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));

        await fetch(`/api/projects/${project.id}/files`, {
          method: "POST",
          body: formData,
        }).catch(() => {});
      }

      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Research Paper</h1>
        <p className="text-sm text-slate-500 mt-1">
          Provide your research core ideas and materials. The multi-agent pipeline will synthesize literature, outline sections, and format the paper.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Paper Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Robust Multi-Modal Contrastive Learning for Autonomous Driving"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Topic &amp; Domain <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Deep Learning, Computer Vision, Representation Learning"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Problem Statement &amp; Motivation <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={4}
            placeholder="Describe the research problem, limitations of current methods, and the significance of your proposed solution (min 20 characters)..."
            value={form.problem}
            onChange={(e) => setForm({ ...form, problem: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Target Format</label>
            <select
              value={form.paperFormat}
              onChange={(e) => setForm({ ...form, paperFormat: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
            >
              {PRESET_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Citation Style</label>
            <select
              value={form.citationStyle}
              onChange={(e) => setForm({ ...form, citationStyle: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
            >
              {CITATION_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">Target Pages</label>
          <input
            type="number"
            min={2}
            max={60}
            value={form.targetPages}
            onChange={(e) => setForm({ ...form, targetPages: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">
            Attach Research Materials (Notebooks, Code, Datasets, Notes)
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors">
            <div className="space-y-1 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
              <div className="flex text-sm text-slate-600 justify-center">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                  <span>Select files</span>
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1">or drag &amp; drop</p>
              </div>
              <p className="text-xs text-slate-500">.ipynb, .py, .csv, .json, .pdf, .md, images up to 64MB</p>
              {files.length > 0 && (
                <div className="mt-3 text-xs font-semibold text-indigo-600">
                  {files.length} file(s) selected: {files.map((f) => f.name).join(", ")}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-slate-300 text-slate-700 font-medium text-sm rounded-md hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-md shadow-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? "Creating..." : "Create Paper Workspace"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
