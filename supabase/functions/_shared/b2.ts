// supabase/functions/_shared/b2.ts
//
// One place that knows how to talk to Backblaze B2. Every course-file
// Edge Function imports this instead of touching the AWS SDK directly,
// so the credential handling and key-sanitization logic exists exactly
// once.
//
// B2_KEY_ID / B2_APPLICATION_KEY / B2_ENDPOINT / B2_REGION / B2_BUCKET_NAME
// are read from Deno.env — Supabase Edge Function secrets — and NEVER
// returned to a client, logged, or embedded in a response body.

import { S3Client } from "npm:@aws-sdk/client-s3@^3";

export interface B2Config {
  endpoint: string;
  region: string;
  bucket: string;
  keyId: string;
  applicationKey: string;
}

export function loadB2Config(): B2Config | null {
  const endpoint = Deno.env.get("B2_ENDPOINT");
  const region = Deno.env.get("B2_REGION");
  const bucket = Deno.env.get("B2_BUCKET_NAME");
  const keyId = Deno.env.get("B2_KEY_ID");
  const applicationKey = Deno.env.get("B2_APPLICATION_KEY");

  if (!endpoint || !region || !bucket || !keyId || !applicationKey) {
    return null;
  }
  return { endpoint, region, bucket, keyId, applicationKey };
}

export function b2Client(config: B2Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
    },
    // B2's S3-compatible API is virtual-host style per bucket like AWS,
    // but path-style is the documented/reliable option for B2 specifically.
    forcePathStyle: true,
  });
}

// ---- object keys ---------------------------------------------------

export type CourseFileKind = "video" | "thumbnail" | "document" | "image" | "resource";

const KIND_SEGMENT: Record<CourseFileKind, string> = {
  video: "video",
  thumbnail: "thumbnail",
  document: "documents",
  image: "images",
  resource: "resources",
};

/** Strips path separators and anything that isn't safe in an object key. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return (cleaned || "file").slice(0, 150);
}

/**
 * Builds `courses/{courseId}/lessons/{lessonSegment}/{kindSegment}/{uuid}-{safeFilename}`
 * (or `courses/{courseId}/thumbnail/{uuid}-{safeFilename}` for course-level
 * thumbnails, or `courses/{courseId}/resources/{uuid}-{safeFilename}` for
 * course-level resources — those two kinds have no lesson).
 *
 * `courseId` and `lessonSegment` MUST already be validated as UUIDs (or, for
 * lessonSegment, a server-minted upload id — see course-file-init-upload)
 * by the caller before this runs. This function only sanitizes the
 * filename; it does not validate ids, so it must never receive raw,
 * unchecked path segments from a request body.
 */
export function buildObjectKey(params: {
  courseId: string;
  lessonSegment?: string | null;
  kind: CourseFileKind;
  filename: string;
}): string {
  const uuid = crypto.randomUUID();
  const safeName = sanitizeFilename(params.filename);
  const kindSegment = KIND_SEGMENT[params.kind];

  if (params.kind === "thumbnail" || params.kind === "resource") {
    return `courses/${params.courseId}/${kindSegment}/${uuid}-${safeName}`;
  }

  if (!params.lessonSegment) {
    throw new Error(`kind "${params.kind}" requires a lessonSegment`);
  }
  return `courses/${params.courseId}/lessons/${params.lessonSegment}/${kindSegment}/${uuid}-${safeName}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ---- upload sizing ---------------------------------------------------

/** B2/S3 multipart parts must be >=5MB (except the last one). */
export const MULTIPART_PART_SIZE_BYTES = 64 * 1024 * 1024; // 64MB
/** Below this, a single PutObject presigned URL is simpler than multipart. */
export const SINGLE_PUT_THRESHOLD_BYTES = 32 * 1024 * 1024; // 32MB
/** S3 multipart hard cap. 20GB / 64MB ≈ 320 parts, nowhere near this. */
export const MAX_MULTIPART_PARTS = 10_000;

export const PRESIGN_TTL_SECONDS = {
  upload: 60 * 60, // 1h per part URL — generous for slow uplinks on huge files
  download: 4 * 60 * 60, // matches courses.ts SIGNED_URL_TTL_SECONDS
} as const;