// src/lib/courses.ts
import { db } from "@/lib/db";
import { isPlanId, type PlanId } from "@/lib/plans";
import { isContentRole } from "@/lib/roles";
import { deleteCourseFile, getCourseFileUrl, uploadCourseFile } from "@/lib/course-files";
import type { AuraLevel } from "@/lib/database.types";
import type {
  AuraCourse,
  CourseCategory,
  CourseListItem,
  CourseProgress,
  CourseStep,
  CourseWithVideo,
  CoursesPageData,
  StepDraft,
} from "@/lib/courses.types";
import { planUnlocks } from "@/lib/courses.types";

export const COURSE_VIDEO_BUCKET = "course-videos"; // legacy Supabase Storage bucket — reads only, no new writes
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
// 60-minute 4K masters can comfortably exceed 20GB; this is a safety
// ceiling with real headroom, not a soft target. Server-side, the
// course-file-init-upload Edge Function enforces its own (kind-specific)
// maximum independently — this constant must not exceed that one.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024 * 1024; // 50GB
export const MAX_VIDEO_DURATION_SECONDS = 3600; // 60 minutes
const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60;

/** New uploads always go to B2; every B2 key starts with "courses/" by
 *  construction (see supabase/functions/_shared/b2.ts:buildObjectKey).
 *  Legacy Supabase Storage paths are "<courseId>/<uuid>.<ext>" and never
 *  match this prefix, so this is an unambiguous, cheap way to tell old
 *  and new videos apart without a DB round-trip. */
function isB2ObjectKey(path: string): boolean {
  return path.startsWith("courses/");
}

const COURSE_COLUMNS =
  "id, title, slug, summary, outcome, audience, level, status, required_plan, " +
  "estimated_hours, cover_url, sort_order, step_count, created_by, published_at, " +
  "created_at, updated_at, category, video_path, video_duration_seconds, " +
  "video_storage_provider, video_status, video_size_bytes, video_mime_type, " +
  "video_original_filename, video_uploaded_at";

const STEP_COLUMNS =
  "id, course_id, position, title, description, video_path, video_duration_seconds, " +
  "video_storage_provider, video_status, video_size_bytes, video_mime_type, " +
  "video_original_filename, video_uploaded_at";

// ── helpers ─────────────────────────────────────────────────────────

async function currentUserId(): Promise<string | null> {
  const { data, error } = await db.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

/**
 * Surfaces the real Postgres/PostgREST error detail during development
 * instead of a generic message, without leaking internals to end users
 * in production. Supabase error objects carry message/details/hint/code —
 * these map directly to Postgres error fields and are the fastest way to
 * pinpoint a constraint violation (NOT NULL, CHECK, FK, etc.).
 */
function logSupabaseError(context: string, error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[courses] ${context} failed:`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Greeklish-safe slug. Ποτέ κενό: πέφτει σε random suffix. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i",
    ή: "i", θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k", λ: "l", μ: "m",
    ν: "n", ξ: "x", ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t",
    υ: "y", ύ: "y", ϋ: "y", ΰ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
  };
  const base = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `course-${randomId().slice(0, 8)}`;
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    let query = db.from("courses").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) query = query.neq("id", ignoreId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${randomId().slice(0, 6)}`;
}

function asCourse(row: unknown): AuraCourse {
  const c = row as AuraCourse;
  return {
    ...c,
    required_plan: (isPlanId(c.required_plan) ? c.required_plan : "low") as PlanId,
    step_count: c.step_count ?? 0,
    sort_order: c.sort_order ?? 0,
  };
}

// ── viewer: /courses ────────────────────────────────────────────────

export async function getCoursesPageData(): Promise<CoursesPageData> {
  const uid = await currentUserId();

  const coursesReq = db
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!uid) {
    const { data, error } = await coursesReq;
    if (error) throw error;
    const items: CourseListItem[] = (data ?? []).map((row) => ({
      course: asCourse(row),
      progress: null,
      locked: true,
    }));
    return { items, planId: null, planRank: 0, isContent: false, signedIn: false };
  }

  const [courses, progress, profile, subscription] = await Promise.all([
    coursesReq,
    db
      .from("course_progress")
      .select("*")
      .eq("user_id", uid),
    db.from("profiles").select("role").eq("id", uid).maybeSingle(),
    db
      .from("subscriptions")
      .select("plan_id, status, created_at")
      .eq("user_id", uid)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (courses.error) throw courses.error;
  if (progress.error) throw progress.error;

  const role = (profile.data as { role?: string } | null)?.role ?? null;
  const isContent = isContentRole(role);
  const rawPlan = (subscription.data as { plan_id?: string } | null)?.plan_id;
  const planId = isPlanId(rawPlan) ? rawPlan : null;

  const progressByCourse = new Map<string, CourseProgress>();
  for (const row of (progress.data ?? []) as CourseProgress[]) {
    progressByCourse.set(row.course_id, row);
  }

  const items: CourseListItem[] = (courses.data ?? []).map((row) => {
    const course = asCourse(row);
    return {
      course,
      progress: progressByCourse.get(course.id) ?? null,
      locked: !isContent && !planUnlocks(planId, course.required_plan),
    };
  });

  return {
    items,
    planId,
    planRank: planId ? planUnlocks(planId, planId) ? 1 : 0 : 0,
    isContent,
    signedIn: true,
  };
}

// ── viewer: /courses/$slug ──────────────────────────────────────────

export async function getCourseForPlay(slug: string): Promise<CourseWithVideo> {
  const uid = await currentUserId();

  const { data: courseRow, error: courseError } = await db
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!courseRow) throw new Error("Το video δεν βρέθηκε.");

  const course = asCourse(courseRow);

  if (!uid) {
    return { course, locked: true, isContent: false };
  }

  const [profile, subscription] = await Promise.all([
    db.from("profiles").select("role").eq("id", uid).maybeSingle(),
    db
      .from("subscriptions")
      .select("plan_id, status, created_at")
      .eq("user_id", uid)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const isContent = isContentRole((profile.data as { role?: string } | null)?.role ?? null);
  const rawPlan = (subscription.data as { plan_id?: string } | null)?.plan_id;
  const planId = isPlanId(rawPlan) ? rawPlan : null;
  const locked = !isContent && !planUnlocks(planId, course.required_plan);

  return { course, locked, isContent };
}

/**
 * Signed preview URL for a lesson video. Requires courseId because B2
 * access is authorized per-course (enrolled + plan check) — see
 * course-file-url Edge Function / public.user_can_access_course.
 */
export async function getStepVideoUrl(path: string, courseId: string): Promise<string> {
  if (isB2ObjectKey(path)) {
    return getCourseFileUrl({ objectKey: path, courseId });
  }
  // Legacy Supabase Storage video — unchanged behaviour.
  const { data, error } = await db.storage
    .from(COURSE_VIDEO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Δεν δημιουργήθηκε σύνδεσμος βίντεο.");
  return data.signedUrl;
}

// ── progress ────────────────────────────────────────────────────────

export async function markCourseStep(
  courseId: string,
  stepId: string,
): Promise<CourseProgress> {
  const { data, error } = await db.rpc("mark_course_step", {
    p_course_id: courseId,
    p_step_id: stepId,
  });
  if (error) throw error;
  return data as CourseProgress;
}

export async function resetCourseProgress(courseId: string): Promise<CourseProgress> {
  const { data, error } = await db.rpc("reset_course_progress", {
    p_course_id: courseId,
  });
  if (error) throw error;
  return data as CourseProgress;
}

export interface CompletedCourse {
  course: Pick<AuraCourse, "id" | "title" | "slug" | "level" | "required_plan" | "step_count">;
  completedAt: string;
  replays: number;
}

export async function getMyCompletedCourses(): Promise<CompletedCourse[]> {
  const uid = await currentUserId();
  if (!uid) return [];

  const { data, error } = await db
    .from("course_progress")
    .select(
      "completed_at, replays, course:courses(id, title, slug, level, required_plan, step_count)",
    )
    .eq("user_id", uid)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  if (error) throw error;

  type Row = {
    completed_at: string;
    replays: number;
    course: CompletedCourse["course"] | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((row): row is Row & { course: CompletedCourse["course"] } => row.course !== null)
    .map((row) => ({
      course: row.course,
      completedAt: row.completed_at,
      replays: row.replays ?? 0,
    }));
}

// ── admin ───────────────────────────────────────────────────────────

export async function listAllCourses(): Promise<AuraCourse[]> {
  const { data, error } = await db
    .from("courses")
    .select(COURSE_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(asCourse);
}

export async function getCourseForEdit(courseId: string): Promise<{ course: AuraCourse }> {
  const { data, error } = await db
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Το video δεν βρέθηκε.");
  return { course: asCourse(data) };
}

export interface CourseInput {
  title: string;
  summary: string;
  category: CourseCategory;
  level: AuraLevel;
  requiredPlan: PlanId;
  status: "draft" | "published" | "archived";
}

export async function createCourse(input: CourseInput): Promise<AuraCourse> {
  const uid = await currentUserId();
  if (!uid) {
    throw new Error("Δεν υπάρχει συνδεδεμένος χρήστης.");
  }

  const slug = await uniqueSlug(slugify(input.title));

  const { data, error } = await db
    .from("courses")
    .insert({
      title: input.title.trim(),
      slug,
      summary: input.summary.trim() || null,
      category: input.category,
      level: input.level,
      required_plan: input.requiredPlan,
      status: input.status,
      sort_order: 0,
      created_by: uid,
      published_at: input.status === "published" ? new Date().toISOString() : null,
    })
    .select(COURSE_COLUMNS)
    .single();

  if (error) {
    logSupabaseError("createCourse", error);
    throw error;
  }
  return asCourse(data);
}

export async function updateCourse(
  courseId: string,
  input: CourseInput,
  currentSlug: string,
  currentStatus: string,
): Promise<AuraCourse> {
  const desiredSlug = slugify(input.title);
  const slug =
    desiredSlug === currentSlug ? currentSlug : await uniqueSlug(desiredSlug, courseId);

  const publishing = input.status === "published" && currentStatus !== "published";

  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    slug,
    summary: input.summary.trim() || null,
    category: input.category,
    level: input.level,
    required_plan: input.requiredPlan,
    status: input.status,
  };
  if (publishing) patch["published_at"] = new Date().toISOString();

  const { data, error } = await db
    .from("courses")
    .update(patch)
    .eq("id", courseId)
    .select(COURSE_COLUMNS)
    .single();

  if (error) {
    logSupabaseError("updateCourse", error);
    throw error;
  }
  return asCourse(data);
}

/** Persists the result of a completed VideoDropzone upload onto the course row. */
export async function setCourseVideo(
  courseId: string,
  video: {
    path: string;
    durationSeconds: number | null;
    storageProvider: "backblaze_b2";
    sizeBytes: number | null;
    mimeType: string | null;
    originalFilename: string | null;
    uploadedAt: string | null;
  },
): Promise<AuraCourse> {
  const { data, error } = await db
    .from("courses")
    .update({
      video_path: video.path,
      video_duration_seconds: video.durationSeconds,
      video_storage_provider: video.storageProvider,
      video_status: "ready",
      video_size_bytes: video.sizeBytes,
      video_mime_type: video.mimeType,
      video_original_filename: video.originalFilename,
      video_uploaded_at: video.uploadedAt,
    })
    .eq("id", courseId)
    .select(COURSE_COLUMNS)
    .single();
  if (error) {
    logSupabaseError("setCourseVideo", error);
    throw error;
  }
  return asCourse(data);
}

export async function clearCourseVideo(courseId: string): Promise<AuraCourse> {
  const { data, error } = await db
    .from("courses")
    .update({
      video_path: null,
      video_duration_seconds: null,
      video_storage_provider: null,
      video_status: null,
      video_size_bytes: null,
      video_mime_type: null,
      video_original_filename: null,
      video_uploaded_at: null,
    })
    .eq("id", courseId)
    .select(COURSE_COLUMNS)
    .single();
  if (error) throw error;
  return asCourse(data);
}

export async function deleteCourse(courseId: string): Promise<void> {
  // Τα βίντεο του course φεύγουν πρώτα: το on delete cascade σβήνει μόνο
  // τις γραμμές, όχι τα objects στο storage (ούτε B2 ούτε legacy Supabase).
  const { data: steps, error: readError } = await db
    .from("course_steps")
    .select("video_path")
    .eq("course_id", courseId);
  if (readError) throw readError;

  const paths = ((steps ?? []) as { video_path: string | null }[])
    .map((s) => s.video_path)
    .filter((p): p is string => Boolean(p));

  const legacyPaths = paths.filter((p) => !isB2ObjectKey(p));
  const b2Paths = paths.filter(isB2ObjectKey);

  if (legacyPaths.length > 0) {
    const { error: removeError } = await db.storage
      .from(COURSE_VIDEO_BUCKET)
      .remove(legacyPaths);
    if (removeError) console.error("Αποτυχία διαγραφής βίντεο:", removeError.message);
  }
  for (const path of b2Paths) {
    try {
      await deleteCourseFile({ objectKey: path, courseId });
    } catch (err) {
      console.error("Αποτυχία διαγραφής βίντεο (B2):", err);
    }
  }

  const { error } = await db.from("courses").delete().eq("id", courseId);
  if (error) throw error;
}

export interface UploadResult {
  path: string;
  durationSeconds: number | null;
  storageProvider: "backblaze_b2";
  sizeBytes: number | null;
  mimeType: string | null;
  originalFilename: string | null;
  uploadedAt: string | null;
}

/** Διαβάζει τη διάρκεια τοπικά, χωρίς να ανεβάσει τίποτα. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const cleanup = () => URL.revokeObjectURL(url);

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const seconds = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      cleanup();
      resolve(seconds);
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

/**
 * Uploads a lesson video to Backblaze B2 (all new uploads go there — see
 * MAX_VIDEO_BYTES / ALLOWED_VIDEO_TYPES above). `lessonId` is optional: a
 * brand-new step in the course builder has no persisted id yet, and the
 * Edge Function mints a namespacing id for the B2 key in that case.
 */
export async function uploadCourseVideo(
  courseId: string,
  file: File,
  onProgress?: (ratio: number) => void,
  lessonId?: string | null,
): Promise<UploadResult> {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new Error("Δεκτά μόνο αρχεία mp4, mov ή webm.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Το βίντεο ξεπερνά το όριο των ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024 * 1024))}GB.`,
    );
  }

  const duration = await readVideoDuration(file);
  if (duration !== null && duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error(
      `Το βίντεο διαρκεί ${Math.round(duration / 60)} λεπτά — το όριο είναι ${
        MAX_VIDEO_DURATION_SECONDS / 60
      } λεπτά.`,
    );
  }

  const record = await uploadCourseFile(
    { courseId, lessonId: lessonId ?? null, kind: "video", file },
    onProgress,
  );

  return {
    path: record.objectKey,
    durationSeconds: duration,
    storageProvider: "backblaze_b2",
    sizeBytes: record.sizeBytes,
    mimeType: record.mimeType,
    originalFilename: record.originalFilename,
    uploadedAt: record.updatedAt,
  };
}

/** Deletes a lesson video. Branches on legacy Supabase Storage vs B2 —
 *  see isB2ObjectKey. Does not touch any DB row; callers clear
 *  video_path etc. themselves (VideoDropzone's onCleared / saveCourseSteps). */
export async function removeCourseVideo(path: string, courseId: string): Promise<void> {
  if (isB2ObjectKey(path)) {
    await deleteCourseFile({ objectKey: path, courseId });
    return;
  }
  const { error } = await db.storage.from(COURSE_VIDEO_BUCKET).remove([path]);
  if (error) throw error;
}