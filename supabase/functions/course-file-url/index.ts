// supabase/functions/course-file-url/index.ts
//
// Two request shapes, same as course-file-delete:
//   { fileId }               — course_files-tracked asset
//   { objectKey, courseId }  — lesson video (course_steps.video_path)
//
// Auth: any signed-in user, but must pass requireCourseAccess (content
// role OR enrolled + plan check via public.user_can_access_course). The
// returned URL expires — see PRESIGN_TTL_SECONDS.download.
import { GetObjectCommand } from "npm:@aws-sdk/client-s3@^3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3";
import { json, preflight } from "../_shared/cors.ts";
import { authenticateCaller, requireCourseAccess } from "../_shared/auth.ts";
import { PRESIGN_TTL_SECONDS, b2Client, isUuid, loadB2Config } from "../_shared/b2.ts";

interface UrlBody {
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

  let body: UrlBody;
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
      .select("id, course_id, b2_object_key, upload_status")
      .eq("id", body.fileId)
      .maybeSingle();
    if (rowError) {
      console.error("course_files lookup failed", rowError);
      return json({ error: "Could not load file record" }, 500, origin);
    }
    if (!row) return json({ error: "File not found" }, 404, origin);

    const record = row as {
      id: string;
      course_id: string;
      b2_object_key: string;
      upload_status: string;
    };

    const accessError = await requireCourseAccess(auth, record.course_id);
    if (accessError) return json({ error: accessError.error }, accessError.status, origin);

    if (record.upload_status !== "ready" && record.upload_status !== "uploaded") {
      return json({ error: "File is not ready yet" }, 409, origin);
    }

    try {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: b2Config.bucket, Key: record.b2_object_key }),
        { expiresIn: PRESIGN_TTL_SECONDS.download },
      );
      return json({ url }, 200, origin);
    } catch (err) {
      console.error("B2 presign (GetObject) failed", err);
      return json({ error: "Could not generate preview URL" }, 502, origin);
    }
  }

  // --- Shape 2: raw video object key (course_steps.video_path) -------
  const { objectKey, courseId } = body;
  if (typeof objectKey !== "string" || objectKey.length === 0) {
    return json({ error: "Missing fileId or objectKey" }, 400, origin);
  }
  if (!isUuid(courseId)) return json({ error: "Invalid courseId" }, 400, origin);

  const expectedPrefix = `courses/${courseId}/`;
  if (!objectKey.startsWith(expectedPrefix) || !objectKey.startsWith("courses/")) {
    return json({ error: "Object key does not belong to this course" }, 400, origin);
  }

  const accessError = await requireCourseAccess(auth, courseId);
  if (accessError) return json({ error: accessError.error }, accessError.status, origin);

  try {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: b2Config.bucket, Key: objectKey }),
      { expiresIn: PRESIGN_TTL_SECONDS.download },
    );
    return json({ url }, 200, origin);
  } catch (err) {
    console.error("B2 presign (GetObject) failed", err);
    return json({ error: "Could not generate preview URL" }, 502, origin);
  }
});