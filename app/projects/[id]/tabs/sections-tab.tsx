"use client";

import { useState } from "react";
import { Save, RefreshCw, Check } from "lucide-react";

interface SectionsTabProps {
  project: any;
  onRefresh: () => void;
}

export function SectionsTab({ project, onRefresh }: SectionsTabProps) {
  const sections = project.sections || [];
  const [selectedKey, setSelectedKey] = useState<string>(sections[0]?.key || "");
  const [editingContent, setEditingContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [instructions, setInstructions] = useState("");

  const activeSection = sections.find((s: any) => s.key === selectedKey) || sections[0];

  const handleSelectSection = (key: string) => {
    setSelectedKey(key);
    const sec = sections.find((s: any) => s.key === key);
    if (sec) setEditingContent(sec.content || "");
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!activeSection) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/projects/${project.id}/sections/${activeSection.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingContent }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setSaveSuccess(true);
      onRefresh();
    } catch {
      alert("Error saving section");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!activeSection) return;
    setRegenerating(true);

    try {
      const res = await fetch(`/api/projects/${project.id}/sections/${activeSection.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions, force: true }),
      });

      if (!res.ok) throw new Error("Failed to regenerate");
      alert("Regeneration enqueued. Check Overview tab for progress.");
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  if (sections.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
        No sections generated yet. Click &quot;Generate Paper&quot; on the Overview tab.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Sections List */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sections</div>
        {sections.map((sec: any) => {
          const isSelected = (activeSection?.key || "") === sec.key;
          return (
            <button
              key={sec.key}
              onClick={() => handleSelectSection(sec.key)}
              className={`w-full text-left p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50 text-indigo-900 font-medium"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-400">{sec.numberLabel || ""}</span>
                {sec.isUserEdited && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                    Edited
                  </span>
                )}
              </div>
              <div className="truncate mt-0.5">{sec.title}</div>
              <div className="text-xs text-slate-400 mt-1">{sec.wordCount || 0} words</div>
            </button>
          );
        })}
      </div>

      {/* Editor Content */}
      <div className="md:col-span-3 bg-white rounded-xl border border-slate-200 p-6 flex flex-col space-y-4">
        {activeSection && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{activeSection.title}</h3>
                <span className="text-xs text-slate-500">
                  Key: <code>{activeSection.key}</code> &bull; Word Count: {activeSection.wordCount || 0} words
                </span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-md shadow-xs cursor-pointer"
              >
                {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saving ? "Saving..." : saveSuccess ? "Saved!" : "Save Edits"}</span>
              </button>
            </div>

            <textarea
              rows={16}
              value={editingContent || activeSection.content || ""}
              onChange={(e) => {
                setEditingContent(e.target.value);
                setSaveSuccess(false);
              }}
              className="w-full p-4 border border-slate-200 rounded-lg text-sm font-serif leading-relaxed text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
              placeholder="Section content..."
            />

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row items-center gap-3">
              <input
                type="text"
                placeholder="Optional instructions for regeneration..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="inline-flex items-center space-x-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-md whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
                <span>{regenerating ? "Enqueuing..." : "Regenerate"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
