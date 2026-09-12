// supabase/functions/course-file-delete/index.ts
//
// Two request shapes:
//   { fileId }               — course_files-tracked asset (thumbnail/doc/image/resource)
//   { objectKey, courseId }  — lesson video (tracked in course_steps.video_path, not
//                               course_files — see 20260907090000_b2_course_video_metadata.sql)
//
// Auth: content roles only. Deleting an already-missing object is treated
// as success (idempotent) rather than an error — a retry or a double
// click must never leave the admin stuck.
import { DeleteObjectCommand } from "npm:@aws-sdk/client-s3@^3";
import { json, preflight } from "../_shared/cors.ts";
import { authenticateCaller, requireContentRole } from "../_shared/auth.ts";
import { b2Client, isUuid, loadB2Config } from "../_shared/b2.ts";

interface DeleteBody {
  fileId?: unknown;
  objectKey?: unknown;
  courseId?: unknown;
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

  let body: DeleteBody;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const s3 = b2Client(b2Config);

  // --- Shape 1: course_files row -------------------------------------
  if (body.fileId !== undefined) {
    if (!isUuid(body.fileId)) return json({ error: "Invalid fileId" }, 400, origin);

    const { data: row, error: rowError } = await auth.admin
      .from("course_files")
      .select("id, b2_object_key")
      .eq("id", body.fileId)
      .maybeSingle();
    if (rowError) {
      console.error("course_files lookup failed", rowError);
      return json({ error: "Could not load file record" }, 500, origin);
    }
    if (!row) return json({ ok: true }, 200, origin); // already gone

    const record = row as { id: string; b2_object_key: string };

    try {
      await s3.send(
        new DeleteObjectCommand({ Bucket: b2Config.bucket, Key: record.b2_object_key }),
      );
    } catch (err) {
      console.error("B2 delete failed", err);
      return json({ error: "Could not delete file from storage" }, 502, origin);
    }

    const { error: deleteError } = await auth.admin
      .from("course_files")
      .delete()
      .eq("id", record.id);
    if (deleteError) {
      console.error("Could not delete course_files row", deleteError);
      return json({ error: "Deleted from storage but could not update database" }, 500, origin);
    }

    return json({ ok: true }, 200, origin);
  }

  // --- Shape 2: raw video object key (course_steps.video_path) -------
  const { objectKey, courseId } = body;
  if (typeof objectKey !== "string" || objectKey.length === 0) {
    return json({ error: "Missing fileId or objectKey" }, 400, origin);
  }
  if (!isUuid(courseId)) return json({ error: "Invalid courseId" }, 400, origin);

  // Sanity check: the key must genuinely belong to this course. Content
  // roles can manage every course in this app, so this isn't a privilege
  // boundary — it's a guard against a malformed/forged key silently
  // deleting an unrelated object.
  const expectedPrefix = `courses/${courseId}/`;
  if (!objectKey.startsWith(expectedPrefix)) {
    return json({ error: "Object key does not belong to this course" }, 400, origin);
  }
  // Legacy Supabase Storage paths never start with "courses/" (see
  // course_files migration comment) — this function only ever deletes B2
  // objects, so a legacy path reaching here would be a client bug.
  if (!objectKey.startsWith("courses/")) {
    return json({ error: "Not a Backblaze B2 object key" }, 400, origin);
  }

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: b2Config.bucket, Key: objectKey }));
  } catch (err) {
    console.error("B2 delete failed", err);
    return json({ error: "Could not delete file from storage" }, 502, origin);
  }

  return json({ ok: true }, 200, origin);
});