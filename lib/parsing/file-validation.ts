const SUPPORTED_EXTENSIONS = new Set([
  ".ipynb",
  ".py",
  ".csv",
  ".xlsx",
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
]);

export const MAX_FILE_SIZE = 12 * 1024 * 1024;

export function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

export function validateResearchFile(file: { name: string; size: number }) {
  const extension = getExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return { valid: false, reason: `Unsupported file type: ${extension || "unknown"}` };
  }
  if (file.size <= 0) {
    return { valid: false, reason: "The file is empty." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, reason: "The file is larger than the 12 MB MVP limit." };
  }
  return { valid: true, reason: "" };
}

export function supportedExtensions() {
  return Array.from(SUPPORTED_EXTENSIONS);
}
