import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { getStorage } from "@/lib/storage";
import { verifyDownloadSignature } from "@/lib/storage/local";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const expires = url.searchParams.get("expires");
    const signature = url.searchParams.get("signature");

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    // If signature & expires provided, verify HMAC signature
    if (expires && signature) {
      const expNum = parseInt(expires, 10);
      const secret = getEnv().AUTH_SECRET || "researchpaper-agent-development-secret";
      const check = verifyDownloadSignature(key, expNum, signature, secret);

      if (!check.ok) {
        return NextResponse.json({ error: `Signature verification failed: ${check.reason}` }, { status: 403 });
      }
    }

    const storage = getStorage();
    const buffer = await storage.get(key);

    if (!buffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filename = key.split("/").pop() || "download";
    let contentType = "application/octet-stream";
    if (filename.endsWith(".docx")) {
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (filename.endsWith(".pdf")) {
      contentType = "application/pdf";
    } else if (filename.endsWith(".png")) {
      contentType = "image/png";
    } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to download file" }, { status: 500 });
  }
}

