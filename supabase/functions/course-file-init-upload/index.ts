// supabase/functions/course-file-init-upload/index.ts
//
// Step 1 of 2 for uploading a course file (video/thumbnail/document/
// image/resource) to Backblaze B2. Returns presigned URL(s) the browser
// PUTs the file to DIRECTLY — this function never sees the file bytes,
// so it works the same for a 10MB PDF and a 20GB 4K master.
//
// Auth: content roles only (content_manager/operations/admin/super_admin).
import {
  CreateMultipartUploadCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "npm:@aws-sdk/client-s3@^3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3";
import { corsHeaders, json, preflight } from "../_shared/cors.ts";
import { authenticateCaller, requireContentRole } from "../_shared/auth.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";
import {
  MAX_MULTIPART_PARTS,
  MULTIPART_PART_SIZE_BYTES,
  PRESIGN_TTL_SECONDS,
  SINGLE_PUT_THRESHOLD_BYTES,
  b2Client,
  buildObjectKey,
  isUuid,
  loadB2Config,
  type CourseFileKind,
} from "../_shared/b2.ts";

const ALLOWED_KINDS: CourseFileKind[] = ["video", "thumbnail", "document", "image", "resource"];

const ALLOWED_MIME_BY_KIND: Record<CourseFileKind, string[]> = {
  video: ["video/mp4", "video/quicktime", "video/webm"],
  thumbnail: ["image/jpeg", "image/png", "image/webp"],
  image: ["image/jpeg", "image/png", "image/webp"],
  document: ["application/pdf"],
  resource: ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/zip"],
};

// 60-minute 4K masters can comfortably exceed 20GB; 50GB gives real
// headroom without leaving the ceiling effectively unbounded.
const MAX_BYTES_BY_KIND: Record<CourseFileKind, number> = {
  video: 50 * 1024 * 1024 * 1024, // 50GB
  thumbnail: 15 * 1024 * 1024, // 15MB
  image: 25 * 1024 * 1024, // 25MB
  document: 100 * 1024 * 1024, // 100MB
  resource: 500 * 1024 * 1024, // 500MB
};

interface InitBody {
  courseId?: unknown;
  lessonId?: unknown; // real course_steps.id if the step is already saved, else absent
  kind?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get("Origin");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const b2Config = loadB2Config();
  if (!b2Config) {
    console.error("Missing B2 environment configuration");
    return json({ error: "Server misconfigured" }, 500, origin);
  }

  const auth = await authenticateCaller(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status, origin);
  const roleError = requireContentRole(auth);
  if (roleError) return json({ error: roleError.error }, roleError.status, origin);

  let body: InitBody;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const { courseId, lessonId, kind, filename, mimeType, fileSize } = body;

  if (!isUuid(courseId)) return json({ error: "Invalid courseId" }, 400, origin);
  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind as CourseFileKind)) {
    return json({ error: "Invalid kind" }, 400, origin);
  }
  const fileKind = kind as CourseFileKind;
  if (typeof filename !== "string" || filename.trim().length === 0) {
    return json({ error: "Missing filename" }, 400, origin);
  }
  if (typeof mimeType !== "string" || !ALLOWED_MIME_BY_KIND[fileKind].includes(mimeType)) {
    return json(
      { error: `Unsupported file type for ${fileKind}: ${String(mimeType)}` },
      400,
      origin,
    );
  }
  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    return json({ error: "Invalid fileSize" }, 400, origin);
  }
  if (fileSize > MAX_BYTES_BY_KIND[fileKind]) {
    return json(
      {
        error: `File too large for ${fileKind}: max ${(
          MAX_BYTES_BY_KIND[fileKind] /
          (1024 * 1024)
        ).toFixed(0)}MB`,
      },
      400,
      origin,
    );
  }
  if (lessonId !== undefined && lessonId !== null && !isUuid(lessonId)) {
    return json({ error: "Invalid lessonId" }, 400, origin);
  }

  // Course must actually exist — never trust courseId blindly.
  const { data: course, error: courseError } = await auth.admin
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .maybeSingle();
  if (courseError) {
    console.error("Course lookup failed", courseError);
    return json({ error: "Could not verify course" }, 500, origin);
  }
  if (!course) return json({ error: "Course not found" }, 404, origin);

  // If a real lessonId was given, it must belong to this course. If not
  // (new, not-yet-saved step in the builder — this is the normal case for
  // a brand-new lesson video), mint a fresh id purely to namespace the B2
  // key; it does not need to match the eventual course_steps.id.
  let lessonSegment: string | null = null;
  if (fileKind === "video" || fileKind === "document" || fileKind === "image") {
    if (isUuid(lessonId)) {
      const { data: step, error: stepError } = await auth.admin
        .from("course_steps")
        .select("id")
        .eq("id", lessonId)
        .eq("course_id", courseId)
        .maybeSingle();
      if (stepError) {
        console.error("Lesson lookup failed", stepError);
        return json({ error: "Could not verify lesson" }, 500, origin);
      }
      if (!step) return json({ error: "Lesson not found on this course" }, 404, origin);
      lessonSegment = lessonId;
    } else {
      lessonSegment = crypto.randomUUID();
    }
  }

  let objectKey: string;
  try {
    objectKey = buildObjectKey({ courseId, lessonSegment, kind: fileKind, filename });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Invalid key" }, 400, origin);
  }

  const s3 = b2Client(b2Config);
  const useMultipart = fileSize > SINGLE_PUT_THRESHOLD_BYTES;

  try {
    if (!useMultipart) {
      const putUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: b2Config.bucket,
          Key: objectKey,
          ContentType: mimeType,
        }),
        { expiresIn: PRESIGN_TTL_SECONDS.upload },
      );

      const insertResult = await insertPendingRow(auth.admin, {
        courseId,
        lessonId: isUuid(lessonId) ? lessonId : null,
        kind: fileKind,
        objectKey,
        filename,
        mimeType,
        fileSize,
        createdBy: auth.caller.userId,
        uploadId: null,
      });
      if (!insertResult.ok) return json({ error: insertResult.error }, 500, origin);

      return json(
        {
          fileId: insertResult.id,
          objectKey,
          mode: "single",
          uploadUrl: putUrl,
        },
        200,
        origin,
      );
    }

    const partSize = MULTIPART_PART_SIZE_BYTES;
    const partCount = Math.ceil(fileSize / partSize);
    if (partCount > MAX_MULTIPART_PARTS) {
      return json({ error: "File too large for configured part size" }, 400, origin);
    }

    const created = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: b2Config.bucket,
        Key: objectKey,
        ContentType: mimeType,
      }),
    );
    if (!created.UploadId) {
      console.error("B2 did not return an UploadId", created);
      return json({ error: "Could not start upload" }, 502, origin);
    }

    const partUrls: string[] = [];
    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: b2Config.bucket,
          Key: objectKey,
          UploadId: created.UploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: PRESIGN_TTL_SECONDS.upload },
      );
      partUrls.push(url);
    }

    const insertResult = await insertPendingRow(auth.admin, {
      courseId,
      lessonId: isUuid(lessonId) ? lessonId : null,
      kind: fileKind,
      objectKey,
      filename,
      mimeType,
      fileSize,
      createdBy: auth.caller.userId,
      uploadId: created.UploadId,
    });
    if (!insertResult.ok) return json({ error: insertResult.error }, 500, origin);

    return json(
      {
        fileId: insertResult.id,
        objectKey,
        mode: "multipart",
        uploadId: created.UploadId,
        partSize,
        partUrls,
      },
      200,
      origin,
    );
  } catch (err) {
    console.error("B2 init-upload failed", err);
    return json({ error: "Could not reach storage provider" }, 502, origin);
  }
});

async function insertPendingRow(
  admin: SupabaseClient,
  params: {
    courseId: string;
    lessonId: string | null;
    kind: CourseFileKind;
    objectKey: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    createdBy: string;
    uploadId: string | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("course_files")
    .insert({
      course_id: params.courseId,
      lesson_id: params.lessonId,
      kind: params.kind,
      storage_provider: "backblaze_b2",
      b2_object_key: params.objectKey,
      original_filename: params.filename,
      mime_type: params.mimeType,
      file_size_bytes: params.fileSize,
      upload_status: "uploading",
      b2_upload_id: params.uploadId,
      created_by: params.createdBy,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Could not create course_files row", error);
    return { ok: false, error: "Could not record upload" };
  }
  return { ok: true, id: (data as { id: string }).id };
}