// supabase/functions/course-file-complete-upload/index.ts
//
// Step 2 of 2. Called after the browser has PUT the file (or every part)
// directly to B2. Confirms with B2 that the object really exists
// (HeadObject) before marking the row "ready" — we never trust the
// browser's word alone that an upload succeeded.
import {
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
} from "npm:@aws-sdk/client-s3@^3";
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";
import { json, preflight } from "../_shared/cors.ts";
import { authenticateCaller, requireContentRole } from "../_shared/auth.ts";
import { b2Client, isUuid, loadB2Config } from "../_shared/b2.ts";

interface CompleteBody {
  fileId?: unknown;
  parts?: unknown; // [{ partNumber: number, etag: string }] — multipart only
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

  let body: CompleteBody;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const { fileId, parts } = body;
  if (!isUuid(fileId)) return json({ error: "Invalid fileId" }, 400, origin);

  const { data: row, error: rowError } = await auth.admin
    .from("course_files")
    .select("id, b2_object_key, b2_upload_id, upload_status")
    .eq("id", fileId)
    .maybeSingle();
  if (rowError) {
    console.error("course_files lookup failed", rowError);
    return json({ error: "Could not load upload record" }, 500, origin);
  }
  if (!row) return json({ error: "Upload not found" }, 404, origin);

  const record = row as {
    id: string;
    b2_object_key: string;
    b2_upload_id: string | null;
    upload_status: string;
  };

  // Idempotent: retried "complete" call after a flaky response just
  // returns the already-finalized row instead of erroring.
  if (record.upload_status === "ready" || record.upload_status === "uploaded") {
    return json({ file: await loadFullRow(auth.admin, record.id) }, 200, origin);
  }

  const s3 = b2Client(b2Config);

  try {
    if (record.b2_upload_id) {
      if (!Array.isArray(parts) || parts.length === 0) {
        return json({ error: "Missing parts for multipart completion" }, 400, origin);
      }
      const cleanParts = parts
        .map((p) =>
          p && typeof p === "object"
            ? {
                PartNumber: Number((p as Record<string, unknown>).partNumber),
                ETag: String((p as Record<string, unknown>).etag ?? ""),
              }
            : null,
        )
        .filter(
          (p): p is { PartNumber: number; ETag: string } =>
            p !== null && Number.isFinite(p.PartNumber) && p.ETag.length > 0,
        )
        .sort((a, b) => a.PartNumber - b.PartNumber);

      if (cleanParts.length === 0) {
        return json({ error: "No valid parts supplied" }, 400, origin);
      }

      await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: b2Config.bucket,
          Key: record.b2_object_key,
          UploadId: record.b2_upload_id,
          MultipartUpload: { Parts: cleanParts },
        }),
      );
    }

    const head = await s3.send(
      new HeadObjectCommand({ Bucket: b2Config.bucket, Key: record.b2_object_key }),
    );

    const { error: updateError } = await auth.admin
      .from("course_files")
      .update({
        upload_status: "ready",
        b2_upload_id: null,
        file_size_bytes: head.ContentLength ?? undefined,
      })
      .eq("id", record.id);
    if (updateError) {
      console.error("Could not mark course_files row ready", updateError);
      return json({ error: "Upload finished but could not be recorded" }, 500, origin);
    }

    return json({ file: await loadFullRow(auth.admin, record.id) }, 200, origin);
  } catch (err) {
    console.error("B2 complete-upload failed", err);
    await auth.admin
      .from("course_files")
      .update({ upload_status: "failed" })
      .eq("id", record.id);
    return json({ error: "Could not finalize upload with storage provider" }, 502, origin);
  }
});

async function loadFullRow(admin: SupabaseClient, id: string) {
  const { data } = await admin
    .from("course_files")
    .select(
      "id, course_id, lesson_id, kind, b2_object_key, original_filename, mime_type, file_size_bytes, upload_status, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}