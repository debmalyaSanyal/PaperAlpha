"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Layers, Files, Quote, CheckCircle2 } from "lucide-react";

import { OverviewTab } from "./tabs/overview-tab";
import { SectionsTab } from "./tabs/sections-tab";
import { FilesTab } from "./tabs/files-tab";
import { CitationsTab } from "./tabs/citations-tab";
import { ValidationTab } from "./tabs/validation-tab";

interface ProjectWorkspaceProps {
  initialProject: any;
}

export function ProjectWorkspace({ initialProject }: ProjectWorkspaceProps) {
  const [project, setProject] = useState(initialProject);
  const [activeTab, setActiveTab] = useState<"overview" | "sections" | "files" | "citations" | "validation">("overview");
  const [generating, setGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState(initialProject.jobs?.[0] || null);

  const refreshProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (data.jobs?.[0]) {
          setActiveJob(data.jobs[0]);
        }
      }
    } catch {
      // quiet fail on poll
    }
  }, [project.id]);

  // Polling loop for active jobs
  useEffect(() => {
    if (activeJob?.status === "RUNNING" || activeJob?.status === "QUEUED" || generating) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/projects/${project.id}/generate`);
          if (res.ok) {
            const data = await res.json();
            setActiveJob(data.job);
            if (data.job?.status === "SUCCEEDED" || data.job?.status === "FAILED") {
              setGenerating(false);
              refreshProject();
            }
          }
        } catch {
          // ignore network glitches
        }
      }, 2500);

      return () => clearInterval(interval);
    }
  }, [activeJob?.status, generating, project.id, refreshProject]);

  const handleTriggerGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to start generation");
        setGenerating(false);
        return;
      }

      const data = await res.json();
      setActiveJob({
        id: data.jobId,
        status: data.status,
        stage: data.stage,
        progress: data.progress,
      });
      refreshProject();
    } catch {
      alert("Network error triggering generation");
      setGenerating(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Pipeline & Overview", icon: Layers },
    { id: "sections", label: `Sections (${project.sections?.length || 0})`, icon: BookOpen },
    { id: "files", label: `Files (${project.files?.length || 0})`, icon: Files },
    { id: "citations", label: `Citations (${project.citations?.length || 0})`, icon: Quote },
    { id: "validation", label: "Verification & Release", icon: CheckCircle2 },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Dashboard
          </Link>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.title}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {project.paperFormat}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl line-clamp-1">{project.topic}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-1 sm:space-x-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            activeJob={activeJob}
            onGenerate={handleTriggerGenerate}
            generating={generating}
          />
        )}
        {activeTab === "sections" && <SectionsTab project={project} onRefresh={refreshProject} />}
        {activeTab === "files" && <FilesTab project={project} onRefresh={refreshProject} />}
        {activeTab === "citations" && <CitationsTab project={project} />}
        {activeTab === "validation" && <ValidationTab project={project} onRefresh={refreshProject} />}
      </div>
    </div>
  );
}
