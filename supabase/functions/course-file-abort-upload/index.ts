// supabase/functions/course-file-abort-upload/index.ts
//
// Called when an upload fails, the user cancels, or the browser gives up
// retrying. Cleans up on the B2 side (aborts the multipart upload / best
// -effort deletes a partial single-PUT object) and removes the pending
// course_files row so it doesn't show up as a ghost "uploading forever"
// entry.
import { AbortMultipartUploadCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@^3";
import { json, preflight } from "../_shared/cors.ts";
import { authenticateCaller, requireContentRole } from "../_shared/auth.ts";
import { b2Client, isUuid, loadB2Config } from "../_shared/b2.ts";

interface AbortBody {
  fileId?: unknown;
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

  let body: AbortBody;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }
  if (!isUuid(body.fileId)) return json({ error: "Invalid fileId" }, 400, origin);

  const { data: row, error: rowError } = await auth.admin
    .from("course_files")
    .select("id, b2_object_key, b2_upload_id, upload_status")
    .eq("id", body.fileId)
    .maybeSingle();
  if (rowError) {
    console.error("course_files lookup failed", rowError);
    return json({ error: "Could not load upload record" }, 500, origin);
  }
  if (!row) return json({ ok: true }, 200, origin); // already gone — nothing to abort

  const record = row as {
    id: string;
    b2_object_key: string;
    b2_upload_id: string | null;
    upload_status: string;
  };

  // Never abort/delete an already-finished upload through this endpoint —
  // that's what course-file-delete is for.
  if (record.upload_status === "ready" || record.upload_status === "uploaded") {
    return json({ error: "This file has already finished uploading" }, 400, origin);
  }

  const s3 = b2Client(b2Config);
  try {
    if (record.b2_upload_id) {
      await s3
        .send(
          new AbortMultipartUploadCommand({
            Bucket: b2Config.bucket,
            Key: record.b2_object_key,
            UploadId: record.b2_upload_id,
          }),
        )
        .catch((err) => console.warn("AbortMultipartUpload (non-fatal)", err));
    } else {
      // Single-PUT mode: the browser may or may not have actually sent
      // bytes yet. Best-effort delete; B2 doesn't error on a missing key.
      await s3
        .send(new DeleteObjectCommand({ Bucket: b2Config.bucket, Key: record.b2_object_key }))
        .catch((err) => console.warn("DeleteObject cleanup (non-fatal)", err));
    }
  } catch (err) {
    console.error("B2 abort-upload cleanup failed", err);
    // Fall through — we still remove the DB row so the UI doesn't get stuck.
  }

  const { error: deleteError } = await auth.admin
    .from("course_files")
    .delete()
    .eq("id", record.id);
  if (deleteError) {
    console.error("Could not delete aborted course_files row", deleteError);
    return json({ error: "Could not clean up upload record" }, 500, origin);
  }

  return json({ ok: true }, 200, origin);
});