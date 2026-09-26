import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id, fileId } = await params;
    const { project } = await requireProjectAccess(id);
    const storage = getStorage();

    const file = await prisma.uploadedFile.findFirst({
      where: { id: fileId, projectId: project.id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const downloadUrl = await storage.getSignedDownloadUrl(file.storageKey);

    return NextResponse.json({
      ...file,
      downloadUrl,
    });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to retrieve file" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id, fileId } = await params;
    const { project } = await requireProjectAccess(id);
    const storage = getStorage();

    const file = await prisma.uploadedFile.findFirst({
      where: { id: fileId, projectId: project.id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await storage.delete(file.storageKey).catch(() => {});

    await prisma.uploadedFile.delete({
      where: { id: file.id },
    });

    return NextResponse.json({ success: true, deletedId: file.id });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error.name === "NotFoundError") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ error: error.message || "Failed to delete file" }, { status: 500 });
  }
}
