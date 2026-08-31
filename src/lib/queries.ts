import { supabase } from "@/lib/supabase";
import type {
  AccountStatus, Assignment, Course, CourseWithTree, Lesson, LessonProgress,
  Profile, Review, ReviewDecision, Skill, SkillWithState,
  Submission, UserRole, UserSkill,
} from "@/lib/database.types";

// --- helpers -------------------------------------------------

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Δεν υπάρχει ενεργή συνεδρία.");
  return data.user.id;
}

export async function getMyProfile(): Promise<Profile> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", uid).single();
  if (error) throw error;
  return data as Profile;
}

const STAFF_ROLES = [
  "educator", "senior_educator", "content_manager",
  "operations", "admin", "super_admin",
];
export const isStaffRole = (role: string) => STAFF_ROLES.includes(role);

// --- Academy (screen 10) ------------------------------------

export async function getPublishedCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Course[];
}

// --- Course overview (screen 11) ----------------------------

export async function getCourseBySlug(slug: string): Promise<CourseWithTree> {
  const { data, error } = await supabase
    .from("courses")
    .select("*, modules(*, lessons(*))")
    .eq("slug", slug)
    .single();
  if (error) throw error;

  const course = data as unknown as CourseWithTree;
  course.modules = (course.modules ?? []).sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  for (const m of course.modules) {
    m.lessons = (m.lessons ?? []).sort((a, b) => a.sort_order - b.sort_order);
  }
  return course;
}

// --- Lesson player (screen 13) ------------------------------

export async function getLesson(lessonId: string): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons").select("*").eq("id", lessonId).single();
  if (error) throw error;
  return data as Lesson;
}

export async function getLessonProgress(
  lessonId: string,
): Promise<LessonProgress | null> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", uid)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw error;
  return (data as LessonProgress) ?? null;
}

export async function saveLessonProgress(
  lessonId: string,
  patch: { completed?: boolean; seconds_watched?: number; notes?: string },
): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: uid,
      lesson_id: lessonId,
      ...patch,
      completed_at: patch.completed ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) throw error;
}

// --- Assignments (screen 15) --------------------------------

export async function getAssignment(id: string): Promise<Assignment> {
  const { data, error } = await supabase
    .from("assignments").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Assignment;
}

// --- Submissions (screen 16) --------------------------------

export async function getOrCreateDraft(
  assignmentId: string,
): Promise<Submission> {
  const uid = await getCurrentUserId();

  const { data: existing, error: readErr } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing as Submission;

  const { data: created, error: insErr } = await supabase
    .from("submissions")
    .insert({ assignment_id: assignmentId, user_id: uid, status: "draft" })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return created as Submission;
}

export async function uploadSubmissionMedia(
  submissionId: string,
  kind: "before" | "process" | "after",
  file: File,
): Promise<string> {
  const uid = await getCurrentUserId();
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${uid}/${submissionId}/${kind}-${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("submissions")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function signedMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("submissions")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function saveSubmission(
  id: string,
  patch: Partial<Submission>,
): Promise<void> {
  const { error } = await supabase.from("submissions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function submitSubmission(id: string): Promise<void> {
  const { error } = await supabase
    .from("submissions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getSubmissionReview(
  submissionId: string,
): Promise<Review | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Review) ?? null;
}

// --- Skills (screen 19) -------------------------------------

export async function getMySkills(): Promise<SkillWithState[]> {
  const uid = await getCurrentUserId();
  const [{ data: skills, error: sErr }, { data: mine, error: uErr }] =
    await Promise.all([
      supabase.from("skills").select("*").order("sort_order"),
      supabase.from("user_skills").select("*").eq("user_id", uid),
    ]);
  if (sErr) throw sErr;
  if (uErr) throw uErr;

  const byId = new Map<string, UserSkill>();
  (mine ?? []).forEach((u) => byId.set((u as UserSkill).skill_id, u as UserSkill));

  return (skills ?? []).map((s) => ({
    ...(s as Skill),
    userSkill: byId.get((s as Skill).id) ?? null,
  }));
}

// --- Educator review queue (screens 17–18) ------------------

export type QueueRow = Submission & {
  assignment: Pick<Assignment, "id" | "title"> | null;
  student: Pick<Profile, "id" | "full_name"> | null;
};

export async function getReviewQueue(): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "*, assignment:assignments(id,title), student:profiles!submissions_user_id_fkey(id,full_name)",
    )
    .in("status", ["submitted", "in_review", "needs_revision"])
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as QueueRow[];
}

export type ReviewDetail = Submission & {
  assignment: Assignment | null;
  student: Pick<Profile, "id" | "full_name" | "level"> | null;
};

export async function getSubmissionForReview(
  submissionId: string,
): Promise<{ submission: ReviewDetail; history: Review[] }> {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "*, assignment:assignments(*), student:profiles!submissions_user_id_fkey(id,full_name,level)",
    )
    .eq("id", submissionId)
    .single();
  if (error) throw error;

  const { data: history, error: hErr } = await supabase
    .from("reviews")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false });
  if (hErr) throw hErr;

  return {
    submission: data as unknown as ReviewDetail,
    history: (history ?? []) as Review[],
  };
}

export async function submitReview(input: {
  submissionId: string;
  score: number;
  rubricScores: { criterion: string; score: number }[];
  strengths: string;
  technicalGaps: string;
  methodGaps: string;
  nextActions: string;
  decision: ReviewDecision;
}): Promise<string> {
  const { data, error } = await supabase.rpc("submit_review", {
    p_submission_id: input.submissionId,
    p_score: input.score,
    p_rubric_scores: input.rubricScores,
    p_strengths: input.strengths,
    p_technical_gaps: input.technicalGaps,
    p_method_gaps: input.methodGaps,
    p_next_actions: input.nextActions,
    p_decision: input.decision,
  });
  if (error) throw error;
  return data as string;
}

// --- Dashboard (screen 09) ----------------------------------

export interface DashboardData {
  profile: Profile;
  verifiedSkills: number;
  totalSkills: number;
  continueLesson: { id: string; title: string } | null;
  latestReview: Review | null;
  openSubmissions: number;
}

export async function getDashboard(): Promise<DashboardData> {
  const uid = await getCurrentUserId();
  const profile = await getMyProfile();

  const [skillsCount, verified, lastProgress, lastReview, openSubs] =
    await Promise.all([
      supabase.from("skills").select("id", { count: "exact", head: true }),
      supabase
        .from("user_skills")
        .select("skill_id", { count: "exact", head: true })
        .eq("user_id", uid)
        .in("state", ["verified", "mastered"]),
      supabase
        .from("lesson_progress")
        .select("lesson_id, lessons(id,title)")
        .eq("user_id", uid)
        .eq("completed", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("reviews")
        .select("*, submissions!inner(user_id)")
        .eq("submissions.user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .in("status", ["submitted", "in_review", "needs_revision"]),
    ]);

  const lp = lastProgress.data as { lessons: { id: string; title: string } } | null;

  return {
    profile,
    verifiedSkills: verified.count ?? 0,
    totalSkills: skillsCount.count ?? 0,
    continueLesson: lp?.lessons ?? null,
    latestReview: (lastReview.data as Review) ?? null,
    openSubmissions: openSubs.count ?? 0,
  };
}
// ============================================================
// ADMIN  (screen: /admin — staff view, role edits = admin-only)
// Πρόσθεσε στο τέλος του υπάρχοντος queries.ts.
// Βεβαιώσου ότι το import των types περιλαμβάνει: UserRole, AccountStatus
// ============================================================

const ADMIN_ROLES = ["operations", "admin", "super_admin"];
export const isAdminRole = (role: string) => ADMIN_ROLES.includes(role);

export interface AdminOverview {
  totalUsers: number;
  students: number;
  staff: number;
  pendingReviews: number;
  publishedCourses: number;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [users, students, pending, courses] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "in_review", "needs_revision"]),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
  ]);

  if (users.error) throw users.error;
  if (students.error) throw students.error;
  if (pending.error) throw pending.error;
  if (courses.error) throw courses.error;

  const total = users.count ?? 0;
  const studentCount = students.count ?? 0;

  return {
    totalUsers: total,
    students: studentCount,
    staff: Math.max(total - studentCount, 0),
    pendingReviews: pending.count ?? 0,
    publishedCourses: courses.count ?? 0,
  };
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateUserStatus(
  userId: string,
  status: AccountStatus,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);
  if (error) throw error;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getAuditLog(limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}
// ============================================================
// PROFILE editing + avatar upload
// Append to the end of the existing queries.ts.
// ============================================================

export async function updateMyProfile(
  patch: Partial<
    Pick<
      Profile,
      "full_name" | "bio" | "headline" | "avatar_url" | "city" | "instagram" | "country"
    >
  >,
): Promise<Profile> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", uid)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function uploadAvatar(file: File): Promise<string> {
  const uid = await getCurrentUserId();

  if (!file.type.startsWith("image/")) {
    throw new Error("Επίτρεψε μόνο εικόνες για το avatar.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Η εικόνα ξεπερνά τα 5MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${uid}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}