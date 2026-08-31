// src/lib/courses.ts
import { db } from "@/lib/db";
import { isPlanId, type PlanId } from "@/lib/plans";
import { isContentRole } from "@/lib/roles";
import type {
  AuraCourse,
  CourseListItem,
  CourseProgress,
  CourseStep,
  CourseWithSteps,
  CoursesPageData,
  StepDraft,
} from "@/lib/courses.types";
import { planUnlocks } from "@/lib/courses.types";

export const COURSE_VIDEO_BUCKET = "course-videos";
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60;

const COURSE_COLUMNS =
  "id, title, slug, summary, outcome, audience, level, status, required_plan, " +
  "estimated_hours, cover_url, sort_order, step_count, created_by, published_at, " +
  "created_at, updated_at";

const STEP_COLUMNS =
  "id, course_id, position, title, description, video_path, video_duration_seconds";

// ── helpers ─────────────────────────────────────────────────────────

async function currentUserId(): Promise<string | null> {
  const { data, error } = await db.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
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
    required_plan: (isPlanId(c.required_plan) ? c.required_plan : "starter") as PlanId,
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

export async function getCourseForPlay(slug: string): Promise<CourseWithSteps> {
  const uid = await currentUserId();

  const { data: courseRow, error: courseError } = await db
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!courseRow) throw new Error("Το course δεν βρέθηκε.");

  const course = asCourse(courseRow);

  if (!uid) {
    return { course, steps: [], progress: null, locked: true, isContent: false };
  }

  const [steps, progress, profile] = await Promise.all([
    db
      .from("course_steps")
      .select(STEP_COLUMNS)
      .eq("course_id", course.id)
      .order("position", { ascending: true }),
    db
      .from("course_progress")
      .select("*")
      .eq("user_id", uid)
      .eq("course_id", course.id)
      .maybeSingle(),
    db.from("profiles").select("role").eq("id", uid).maybeSingle(),
  ]);

  if (steps.error) throw steps.error;
  if (progress.error) throw progress.error;

  const stepRows = (steps.data ?? []) as CourseStep[];
  const isContent = isContentRole(
    (profile.data as { role?: string } | null)?.role ?? null,
  );

  // Το RLS κρύβει τα βήματα όταν λείπει το πλάνο: 0 βήματα με step_count > 0
  // σημαίνει κλειδωμένο, όχι κενό course.
  const locked = !isContent && stepRows.length === 0 && course.step_count > 0;

  return {
    course,
    steps: stepRows,
    progress: (progress.data as CourseProgress | null) ?? null,
    locked,
    isContent,
  };
}

export async function getStepVideoUrl(path: string): Promise<string> {
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

export async function getCourseForEdit(
  courseId: string,
): Promise<{ course: AuraCourse; steps: CourseStep[] }> {
  const [course, steps] = await Promise.all([
    db.from("courses").select(COURSE_COLUMNS).eq("id", courseId).maybeSingle(),
    db
      .from("course_steps")
      .select(STEP_COLUMNS)
      .eq("course_id", courseId)
      .order("position", { ascending: true }),
  ]);
  if (course.error) throw course.error;
  if (steps.error) throw steps.error;
  if (!course.data) throw new Error("Το course δεν βρέθηκε.");
  return { course: asCourse(course.data), steps: (steps.data ?? []) as CourseStep[] };
}

export interface CourseInput {
  title: string;
  summary: string;
  outcome: string;
  level: AuraCourse["level"];
  requiredPlan: PlanId;
  status: "draft" | "published" | "archived";
  sortOrder: number;
  estimatedHours: number | null;
}

export async function createCourse(input: CourseInput): Promise<AuraCourse> {
  const uid = await currentUserId();
  const slug = await uniqueSlug(slugify(input.title));

  const { data, error } = await db
    .from("courses")
    .insert({
      title: input.title.trim(),
      slug,
      summary: input.summary.trim() || null,
      outcome: input.outcome.trim() || null,
      level: input.level,
      required_plan: input.requiredPlan,
      status: input.status,
      sort_order: input.sortOrder,
      estimated_hours: input.estimatedHours,
      created_by: uid,
      published_at: input.status === "published" ? new Date().toISOString() : null,
    })
    .select(COURSE_COLUMNS)
    .single();

  if (error) throw error;
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
    outcome: input.outcome.trim() || null,
    level: input.level,
    required_plan: input.requiredPlan,
    status: input.status,
    sort_order: input.sortOrder,
    estimated_hours: input.estimatedHours,
  };
  if (publishing) patch.published_at = new Date().toISOString();

  const { data, error } = await db
    .from("courses")
    .update(patch)
    .eq("id", courseId)
    .select(COURSE_COLUMNS)
    .single();

  if (error) throw error;
  return asCourse(data);
}

export async function deleteCourse(courseId: string): Promise<void> {
  // Τα βίντεο του course φεύγουν πρώτα: το on delete cascade σβήνει μόνο
  // τις γραμμές, όχι τα objects στο storage.
  const { data: steps, error: readError } = await db
    .from("course_steps")
    .select("video_path")
    .eq("course_id", courseId);
  if (readError) throw readError;

  const paths = ((steps ?? []) as { video_path: string | null }[])
    .map((s) => s.video_path)
    .filter((p): p is string => Boolean(p));

  if (paths.length > 0) {
    const { error: removeError } = await db.storage
      .from(COURSE_VIDEO_BUCKET)
      .remove(paths);
    if (removeError) console.error("Αποτυχία διαγραφής βίντεο:", removeError.message);
  }

  const { error } = await db.from("courses").delete().eq("id", courseId);
  if (error) throw error;
}

/**
 * Συγχρονίζει τα βήματα: σβήνει όσα αφαιρέθηκαν, ενημερώνει τα υπάρχοντα,
 * εισάγει τα νέα. Οι θέσεις γράφονται 1..n με τη σειρά του builder.
 */
export async function saveCourseSteps(
  courseId: string,
  drafts: StepDraft[],
): Promise<CourseStep[]> {
  const { data: existing, error: readError } = await db
    .from("course_steps")
    .select("id, video_path")
    .eq("course_id", courseId);
  if (readError) throw readError;

  const existingRows = (existing ?? []) as { id: string; video_path: string | null }[];
  const keptIds = new Set(drafts.map((d) => d.id).filter((id): id is string => Boolean(id)));
  const removed = existingRows.filter((row) => !keptIds.has(row.id));

  if (removed.length > 0) {
    const orphanPaths = removed
      .map((row) => row.video_path)
      .filter((p): p is string => Boolean(p));
    if (orphanPaths.length > 0) {
      const { error: removeError } = await db.storage
        .from(COURSE_VIDEO_BUCKET)
        .remove(orphanPaths);
      if (removeError) console.error("Αποτυχία διαγραφής βίντεο:", removeError.message);
    }
    const { error: deleteError } = await db
      .from("course_steps")
      .delete()
      .in(
        "id",
        removed.map((row) => row.id),
      );
    if (deleteError) throw deleteError;
  }

  // Δύο πάσα ώστε το unique (course_id, position) να μη συγκρούεται σε reorder:
  // πρώτα προσωρινές αρνητικές θέσεις, μετά οι τελικές.
  const updates = drafts
    .map((draft, index) => ({ draft, index }))
    .filter((entry) => entry.draft.id !== null);

  for (const { draft, index } of updates) {
    const { error } = await db
      .from("course_steps")
      .update({ position: -(index + 1) })
      .eq("id", draft.id as string);
    if (error) throw error;
  }

  const results: CourseStep[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    const payload = {
      course_id: courseId,
      position: index + 1,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      video_path: draft.videoPath,
      video_duration_seconds: draft.videoDurationSeconds,
    };

    if (draft.id) {
      const { data, error } = await db
        .from("course_steps")
        .update(payload)
        .eq("id", draft.id)
        .select(STEP_COLUMNS)
        .single();
      if (error) throw error;
      results.push(data as CourseStep);
    } else {
      const { data, error } = await db
        .from("course_steps")
        .insert(payload)
        .select(STEP_COLUMNS)
        .single();
      if (error) throw error;
      results.push(data as CourseStep);
    }
  }

  return results;
}

// ── upload ──────────────────────────────────────────────────────────

export interface UploadResult {
  path: string;
  durationSeconds: number | null;
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

export async function uploadCourseVideo(
  courseId: string,
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<UploadResult> {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new Error("Δεκτά μόνο αρχεία mp4, mov ή webm.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Το βίντεο ξεπερνά τα 2GB.");
  }

  const duration = await readVideoDuration(file);
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `${courseId}/${randomId()}.${ext}`;

  const { data, error } = await db.storage
    .from(COURSE_VIDEO_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(error?.message ?? "Δεν δημιουργήθηκε signed upload URL.");
  }

  const absolute = data.signedUrl.startsWith("http") ? data.signedUrl : null;

  // Χωρίς XHR (ή με relative signedUrl) πέφτουμε στο SDK: χάνουμε το
  // progress, όχι το upload.
  if (!absolute || typeof XMLHttpRequest === "undefined") {
    const { error: uploadError } = await db.storage
      .from(COURSE_VIDEO_BUCKET)
      .uploadToSignedUrl(path, data.token, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    onProgress?.(1);
    return { path, durationSeconds: duration };
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", absolute, true);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(0.99, event.loaded / event.total));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      reject(new Error(`Το upload απέτυχε (HTTP ${xhr.status}). ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("Το upload απέτυχε λόγω δικτύου."));
    xhr.onabort = () => reject(new Error("Το upload ακυρώθηκε."));
    xhr.send(file);
  });

  return { path, durationSeconds: duration };
}

export async function removeCourseVideo(path: string): Promise<void> {
  const { error } = await db.storage.from(COURSE_VIDEO_BUCKET).remove([path]);
  if (error) throw error;
}