import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

const ALLOWED_CATEGORIES = [
  "notebook",
  "python",
  "dataset",
  "document",
  "image",
  "other",
] as const;

function inferCategoryFromFilename(filename: string): (typeof ALLOWED_CATEGORIES)[number] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ipynb")) return "notebook";
  if (lower.endsWith(".py") || lower.endsWith(".r") || lower.endsWith(".sh") || lower.endsWith(".m")) return "python";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".json") || lower.endsWith(".parquet")) return "dataset";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".svg") || lower.endsWith(".webp")) {
    return "image";
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".pdf") || lower.endsWith(".docx")) return "document";
  return "other";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);

    const files = await prisma.uploadedFile.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(files);
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to list files" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project } = await requireProjectAccess(id);
    const storage = getStorage();

    const formData = await request.formData();
    const uploadedFiles: Array<{
      id: string;
      originalName: string;
      category: string;
      sizeBytes: number;
    }> = [];

    const formCategory = formData.get("category")?.toString();

    const entries = formData.getAll("files");
    if (entries.length === 0) {
      const single = formData.get("file");
      if (single) entries.push(single);
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: "No files provided in request" }, { status: 400 });
    }

    for (const entry of entries) {
      if (typeof entry === "string" || !(entry instanceof File)) {
        continue;
      }

      const file = entry as File;
      const originalName = file.name || "uploaded-file";
      const mimeType = file.type || "application/octet-stream";
      const sizeBytes = file.size;
      const extMatch = originalName.match(/\.([^.]+)$/);
      const extension = extMatch ? `.${extMatch[1].toLowerCase()}` : "";

      let category = formCategory && ALLOWED_CATEGORIES.includes(formCategory as any)
        ? (formCategory as (typeof ALLOWED_CATEGORIES)[number])
        : inferCategoryFromFilename(originalName);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const checksum = createHash("sha256").update(buffer).digest("hex");

      const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const safeFilename = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storedName = `${fileId}-${safeFilename}`;
      const storageKey = `projects/${project.id}/${storedName}`;

      await storage.put(storageKey, buffer, {
        contentType: mimeType,
      });

      const record = await prisma.uploadedFile.upsert({
        where: {
          projectId_checksum: {
            projectId: project.id,
            checksum,
          },
        },
        update: {
          originalName,
          storedName,
          storageKey,
          mimeType,
          extension,
          sizeBytes,
          category,
          status: "UPLOADED",
        },
        create: {
          projectId: project.id,
          originalName,
          storedName,
          storageKey,
          mimeType,
          extension,
          sizeBytes,
          checksum,
          category,
          status: "UPLOADED",
        },
      });

      uploadedFiles.push({
        id: record.id,
        originalName: record.originalName,
        category: record.category,
        sizeBytes: record.sizeBytes,
      });
    }

    return NextResponse.json({ files: uploadedFiles }, { status: 201 });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to upload file(s)" }, { status: 500 });
  }
}
