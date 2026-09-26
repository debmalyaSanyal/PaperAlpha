import { z } from "zod";

import { PRESET_NAMES } from "@/lib/formats/registry";
import { getEnv } from "@/lib/env";
import { CITATION_STYLES, LANGUAGES } from "./common";

/** Validation for the Create Project form and POST /api/projects. */

const trimmed = (min: number, max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(min, `Must be at least ${min} character(s).`).max(max, `Must be at most ${max} characters.`));

export const CreateProjectFieldsSchema = z.object({
    title: trimmed(5, 300),
    topic: trimmed(3, 500),
    problem: trimmed(20, 6000),
    objectives: z.string().max(6000).optional().or(z.literal("")),
    questions: z.string().max(4000).optional().or(z.literal("")),
    notes: z.string().max(40000).optional().or(z.literal("")),

    paperFormat: z.enum(PRESET_NAMES),
    customFormat: z.string().max(4000).optional().or(z.literal("")),
    /** Optional structured custom format patch (JSON), used when paperFormat is "Custom". */
    customFormatPatch: z.unknown().optional(),

    citationStyle: z.enum(CITATION_STYLES).default("IEEE"),
    language: z.enum(LANGUAGES).default("English"),

    targetPages: z.coerce.number().int().min(2).max(60).default(8),
    targetWords: z
      .union([z.coerce.number().int().min(150).max(40000), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" || v === null || v === undefined ? undefined : Number(v))),

    additionalInstructions: z.string().max(4000).optional().or(z.literal("")),
});

/**
 * Create-project validation.
 *
 * The plain object is kept separate so `UpdateProjectSchema` can derive a
 * partial version of it (ZodEffects produced by `.superRefine` has no
 * `.partial()`), while create requests still get the cross-field check below.
 */
export const CreateProjectSchema = CreateProjectFieldsSchema.superRefine((value, ctx) => {
  if (value.paperFormat === "Custom" && !value.customFormat?.trim() && value.customFormatPatch === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customFormat"],
      message: "Describe the required paper format when Custom is selected.",
    });
  }
});

export type CreateProjectInput = z.input<typeof CreateProjectSchema>;
export type CreateProjectValues = z.output<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectFieldsSchema.partial();

export const UpdateSectionSchema = z.object({
  content: z.string().max(120000),
  title: z.string().max(300).optional(),
});

export const RegenerateSectionSchema = z.object({
  instructions: z.string().max(4000).optional(),
  /** When true, discard manual edits and rebuild from the pipeline state. */
  force: z.boolean().default(true),
  targetWords: z.coerce.number().int().min(50).max(20000).optional(),
});

export const ValidationChecklistSchema = z.object({
  verifiedResults: z.boolean(),
  verifiedReferences: z.boolean(),
  verifiedMethodology: z.boolean(),
  reviewedAiContent: z.boolean(),
  verifiedCompliance: z.boolean(),
});

export const ListProjectsQuerySchema = z.object({
  status: z.string().optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export interface FileRejection {
  name: string;
  reason: string;
}

export interface FileValidationResult {
  accepted: Array<{ name: string; extension: string; sizeBytes: number }>;
  rejected: FileRejection[];
}

/**
 * Validate upload metadata before accepting any bytes.
 * Enforces extension allow-list, per-file size and per-project file count.
 */
export function validateUploadBatch(
  files: Array<{ name: string; size: number }>,
  existingCount = 0,
): FileValidationResult {
  const env = getEnv();
  const allowed = new Set(
    env.ALLOWED_FILE_EXTENSIONS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
  const accepted: FileValidationResult["accepted"] = [];
  const rejected: FileRejection[] = [];

  for (const file of files) {
    const name = file.name ?? "unnamed";
    const dotIndex = name.lastIndexOf(".");
    const extension = dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
    const basename = name.replace(/\\/g, "/").split("/").pop() ?? name;

    // Path traversal / control characters in the submitted file name.
    if (/[\\/]|\.\.|[\u0000-\u001f]/.test(basename)) {
      rejected.push({ name, reason: "Invalid file name." });
      continue;
    }
    if (!extension || !allowed.has(extension)) {
      rejected.push({ name, reason: `Unsupported file type "${extension || "(none)"}".` });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ name, reason: "File is empty." });
      continue;
    }
    if (file.size > maxBytes) {
      rejected.push({ name, reason: `Exceeds the ${env.MAX_FILE_SIZE_MB} MB per-file limit.` });
      continue;
    }
    accepted.push({ name: basename, extension, sizeBytes: file.size });
  }

  if (existingCount + accepted.length > env.MAX_FILES_PER_PROJECT) {
    const overflow = existingCount + accepted.length - env.MAX_FILES_PER_PROJECT;
    for (const item of accepted.splice(accepted.length - overflow, overflow)) {
      rejected.push({
        name: item.name,
        reason: `Project file limit of ${env.MAX_FILES_PER_PROJECT} reached.`,
      });
    }
  }

  return { accepted, rejected };
}
