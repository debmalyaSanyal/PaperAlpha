"use client";

import { useState } from "react";
import { UploadCloud, FileText, Trash2, Download } from "lucide-react";

interface FilesTabProps {
  project: any;
  onRefresh: () => void;
}

export function FilesTab({ project, onRefresh }: FilesTabProps) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const files = project.files || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(e.target.files).forEach((f) => formData.append("files", f));

      const res = await fetch(`/api/projects/${project.id}/files`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      onRefresh();
    } catch {
      alert("Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    setDeletingId(fileId);

    try {
      const res = await fetch(`/api/projects/${project.id}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      onRefresh();
    } catch {
      alert("Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h4 className="text-sm font-bold text-slate-900 mb-3">Upload Additional Materials</h4>
        <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors">
          <div className="space-y-1 text-center">
            <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
            <div className="flex text-sm text-slate-600 justify-center">
              <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                <span>{uploading ? "Uploading..." : "Select files to upload"}</span>
                <input
                  type="file"
                  multiple
                  disabled={uploading}
                  className="sr-only"
                  onChange={handleUpload}
                />
              </label>
            </div>
            <p className="text-xs text-slate-500">Code, Notebooks (.ipynb), Datasets (.csv, .json), Papers (.pdf)</p>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Project Files</h4>
          <span className="text-xs text-slate-500">{files.length} file(s)</span>
        </div>

        {files.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No research files uploaded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {files.map((file: any) => (
              <div key={file.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-md">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 truncate max-w-md">{file.originalName}</p>
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <span className="uppercase font-semibold text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {file.category}
                      </span>
                      <span>&bull;</span>
                      <span>{(file.sizeBytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <a
                    href={`/api/files/download?key=${encodeURIComponent(file.storageKey)}`}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(file.id)}
                    disabled={deletingId === file.id}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
