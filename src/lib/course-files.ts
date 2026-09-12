// src/lib/course-files.ts
//
// Generic Backblaze B2 storage layer for ALL course files — lesson
// videos, course thumbnails, lesson documents/PDFs, lesson images, course
// resources. Nothing in here ever sees a B2 credential; every operation
// goes through the course-file-* Edge Functions, which hold the
// credentials server-side and do the actual authorization checks.
//
// Specialized helpers (uploadCourseVideo, removeCourseVideo,
// getStepVideoUrl in src/lib/courses.ts) call the functions below
// internally so the rest of the app doesn't need to know how B2 works.

import { supabase } from "@/lib/supabase";

export type CourseFileKind = "video" | "thumbnail" | "document" | "image" | "resource";

export interface CourseFileRecord {
  id: string;
  courseId: string;
  lessonId: string | null;
  kind: CourseFileKind;
  objectKey: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  updatedAt: string | null;
}

export interface UploadCourseFileParams {
  courseId: string;
  /** Real course_steps.id if the lesson is already saved; omit for a
   *  brand-new, not-yet-saved lesson (the server mints a namespacing id). */
  lessonId?: string | null;
  kind: CourseFileKind;
  file: File;
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(name, {
    body: body as Record<string, unknown>,
  });
  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) throw new Error(payload.error);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message) throw parseErr;
      }
    }
    throw new Error(error.message || "Το αίτημα απέτυχε.");
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  if (!data) throw new Error("Άδεια απάντηση από τον server.");
  return data;
}

interface InitSingleResponse {
  fileId: string;
  objectKey: string;
  mode: "single";
  uploadUrl: string;
}
interface InitMultipartResponse {
  fileId: string;
  objectKey: string;
  mode: "multipart";
  uploadId: string;
  partSize: number;
  partUrls: string[];
}
type InitResponse = InitSingleResponse | InitMultipartResponse;

interface CompleteResponse {
  file: {
    id: string;
    course_id: string;
    lesson_id: string | null;
    kind: CourseFileKind;
    b2_object_key: string;
    original_filename: string | null;
    mime_type: string | null;
    file_size_bytes: number | null;
    upload_status: string;
    updated_at: string | null;
  };
}

function toRecord(row: CompleteResponse["file"]): CourseFileRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    kind: row.kind,
    objectKey: row.b2_object_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.file_size_bytes,
    status: row.upload_status,
    updatedAt: row.updated_at,
  };
}

/** PUTs `blob` to `url` directly (no auth headers — the URL is presigned),
 *  reporting bytes sent so callers can compute aggregate progress, and
 *  resolving the response ETag header for multipart completion. */
function putToPresignedUrl(
  url: string,
  blob: Blob,
  contentType: string,
  onBytes: (loaded: number) => void,
): Promise<{ etag: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onBytes(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ etag: xhr.getResponseHeader("ETag") });
        return;
      }
      reject(new Error(`Το upload απέτυχε (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Το upload απέτυχε λόγω δικτύου."));
    xhr.onabort = () => reject(new Error("Το upload ακυρώθηκε."));
    xhr.send(blob);
  });
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** i));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Το upload απέτυχε.");
}

/**
 * Uploads a file to B2 for a course, reporting progress in [0, 1].
 * Chooses single-PUT vs multipart server-side based on file size. Aborts
 * and cleans up the pending row on any failure — never leaves a half
 * -finished multipart upload dangling in B2.
 */
export async function uploadCourseFile(
  params: UploadCourseFileParams,
  onProgress?: (ratio: number) => void,
): Promise<CourseFileRecord> {
  const init = await invoke<InitResponse>("course-file-init-upload", {
    courseId: params.courseId,
    lessonId: params.lessonId ?? null,
    kind: params.kind,
    filename: params.file.name,
    mimeType: params.file.type,
    fileSize: params.file.size,
  });

  try {
    if (init.mode === "single") {
      await withRetries(() =>
        putToPresignedUrl(init.uploadUrl, params.file, params.file.type, (loaded) =>
          onProgress?.(Math.min(0.99, loaded / Math.max(1, params.file.size))),
        ),
      );
      const completed = await invoke<CompleteResponse>("course-file-complete-upload", {
        fileId: init.fileId,
      });
      onProgress?.(1);
      return toRecord(completed.file);
    }

    // multipart
    const total = params.file.size;
    const partSize = init.partSize;
    const parts: { partNumber: number; etag: string }[] = [];
    let bytesDoneBeforeCurrentPart = 0;

    for (let i = 0; i < init.partUrls.length; i += 1) {
      const start = i * partSize;
      const end = Math.min(start + partSize, total);
      const chunk = params.file.slice(start, end);
      const partNumber = i + 1;
      const chunkStart = bytesDoneBeforeCurrentPart;

      const { etag } = await withRetries(() =>
        putToPresignedUrl(init.partUrls[i]!, chunk, params.file.type, (loaded) => {
          onProgress?.(Math.min(0.99, (chunkStart + loaded) / Math.max(1, total)));
        }),
      );
      if (!etag) {
        throw new Error(
          "Το B2 δεν επέστρεψε ETag για το part — έλεγξε τις CORS ρυθμίσεις του bucket (Access-Control-Expose-Headers: ETag).",
        );
      }
      parts.push({ partNumber, etag });
      bytesDoneBeforeCurrentPart = end;
    }

    const completed = await invoke<CompleteResponse>("course-file-complete-upload", {
      fileId: init.fileId,
      parts,
    });
    onProgress?.(1);
    return toRecord(completed.file);
  } catch (err) {
    await invoke("course-file-abort-upload", { fileId: init.fileId }).catch((abortErr) =>
      console.error("Αποτυχία καθαρισμού μετά από failed upload:", abortErr),
    );
    throw err;
  }
}

export type CourseFileTarget = { fileId: string } | { objectKey: string; courseId: string };

export async function deleteCourseFile(target: CourseFileTarget): Promise<void> {
  await invoke<{ ok: true }>("course-file-delete", target);
}

export async function getCourseFileUrl(target: CourseFileTarget): Promise<string> {
  const res = await invoke<{ url: string }>("course-file-url", target);
  return res.url;
}