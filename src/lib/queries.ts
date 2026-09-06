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

export async function getSkillAssignments(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("assignments")
    .select("id, skill_id")
    .not("skill_id", "is", null);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { id: string; skill_id: string }[]) {
    map[row.skill_id] = row.id;
  }
  return map;
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
      "*, assignment:assignments(*, skill:skills(id,name)), student:profiles!submissions_user_id_fkey(id,full_name,level)",
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
// ============================================================
// ACADEMY FEED (screen: /academy — posts / likes / comments)
// Πρόσθεσε στο τέλος του υπάρχοντος queries.ts.
// ============================================================

export interface AcademyPostAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
}

export interface AcademyPostComment {
  id: string;
  content: string;
  created_at: string;
  author: AcademyPostAuthor | null;
}

export interface AcademyPost {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author: AcademyPostAuthor | null;
  likes: { user_id: string }[];
  comments: AcademyPostComment[];
}

export async function getAcademyFeed(): Promise<AcademyPost[]> {
  const { data, error } = await supabase
    .from("academy_posts")
    .select(
      `id, content, image_url, created_at,
       author:profiles!academy_posts_author_id_fkey(id,full_name,avatar_url,role),
       likes:academy_post_likes(user_id),
       comments:academy_post_comments(
         id, content, created_at,
         author:profiles!academy_post_comments_author_id_fkey(id,full_name,avatar_url,role)
       )`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AcademyPost[];
}

export async function createAcademyPost(
  content: string,
  imageFile?: File,
): Promise<void> {
  const uid = await getCurrentUserId();

  let imageUrl: string | null = null;
  if (imageFile) {
    const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("academy-posts")
      .upload(path, imageFile, {
        upsert: false,
        contentType: imageFile.type,
      });
    if (upErr) throw upErr;
    const { data } = supabase.storage
      .from("academy-posts")
      .getPublicUrl(path);
    imageUrl = data.publicUrl;
  }

  const { error } = await supabase
    .from("academy_posts")
    .insert({ author_id: uid, content, image_url: imageUrl });
  if (error) throw error;
}

export async function toggleAcademyPostLike(
  postId: string,
  currentlyLiked: boolean,
): Promise<void> {
  const uid = await getCurrentUserId();
  if (currentlyLiked) {
    const { error } = await supabase
      .from("academy_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("academy_post_likes")
      .insert({ post_id: postId, user_id: uid });
    if (error) throw error;
  }
}

export async function addAcademyPostComment(
  postId: string,
  content: string,
): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase
    .from("academy_post_comments")
    .insert({ post_id: postId, author_id: uid, content });
  if (error) throw error;
}

export async function deleteAcademyPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from("academy_posts")
    .delete()
    .eq("id", postId);
  if (error) throw error;
}

// --- Leaderboard ----------------------------------------------

export interface LeaderboardEntry {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  totalPoints: number;
}

// Calls the get_leaderboard() SQL function (see
// supabase/migrations/20260906130000_get_leaderboard_rpc.sql). It's
// SECURITY DEFINER so it can read every student's aggregate points even
// though `profiles` RLS only allows reading your own row — it only ever
// returns name / avatar / total points, nothing sensitive.
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("get_leaderboard");
  if (error) throw error;
  return (
    (data as
      | {
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          total_points: number;
        }[]
      | null) ?? []
  ).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
        totalPoints: Number(row.total_points),
  }));
}
// ============================================================
// STORIES (screen: /academy — 24h ephemeral stories)
// ============================================================

export interface StoryAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Story {
  id: string;
  author_id: string;
  media_url: string;
  media_type: "image" | "video";
  audio_url: string | null;
  audio_title: string | null;
  created_at: string;
  expires_at: string;
}

export interface StoryGroup {
  author: StoryAuthor;
  stories: Story[];
  allViewed: boolean;
}

interface RawStoryRow {
  id: string;
  author_id: string;
  media_url: string;
  media_type: "image" | "video";
  audio_url: string | null;
  audio_title: string | null;
  created_at: string;
  expires_at: string;
  author: StoryAuthor | null;
}

export async function getActiveStories(): Promise<StoryGroup[]> {
  const uid = await getCurrentUserId();
  const nowIso = new Date().toISOString();

  const [{ data: rows, error: sErr }, { data: myViews, error: vErr }] =
    await Promise.all([
      supabase
        .from("stories")
        .select(
          `id, author_id, media_url, media_type, audio_url, audio_title, created_at, expires_at,
           author:profiles!stories_author_id_fkey(id, full_name, avatar_url)`,
        )
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: true }),
      supabase.from("story_views").select("story_id").eq("viewer_id", uid),
    ]);
  if (sErr) throw sErr;
  if (vErr) throw vErr;

  const viewedIds = new Set((myViews ?? []).map((v) => v.story_id as string));
  const groups = new Map<string, StoryGroup>();

  for (const row of (rows ?? []) as unknown as RawStoryRow[]) {
    if (!row.author) continue;
    if (!groups.has(row.author.id)) {
      groups.set(row.author.id, { author: row.author, stories: [], allViewed: true });
    }
    groups.get(row.author.id)!.stories.push({
      id: row.id,
      author_id: row.author_id,
      media_url: row.media_url,
      media_type: row.media_type,
      audio_url: row.audio_url,
      audio_title: row.audio_title,
      created_at: row.created_at,
      expires_at: row.expires_at,
    });
  }

  for (const group of groups.values()) {
    group.allViewed = group.stories.every((s) => viewedIds.has(s.id));
  }

  const list = Array.from(groups.values());
  list.sort((a, b) => {
    if (a.author.id === uid) return -1;
    if (b.author.id === uid) return 1;
    if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
    const aLatest = a.stories.at(-1)?.created_at ?? "";
    const bLatest = b.stories.at(-1)?.created_at ?? "";
    return bLatest.localeCompare(aLatest);
  });

  return list;
}

export async function createStory(
  file: File,
  audio?: { file: File; title: string } | null,
): Promise<void> {
  const uid = await getCurrentUserId();

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    throw new Error("Επίτρεψε μόνο εικόνες ή βίντεο για το story.");
  }
  const maxBytes = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      isVideo ? "Το βίντεο ξεπερνά τα 50MB." : "Η εικόνα ξεπερνά τα 10MB.",
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
  const path = `${uid}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("stories")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const { data: mediaData } = supabase.storage.from("stories").getPublicUrl(path);

  let audioUrl: string | null = null;
  if (audio) {
    if (audio.file.size > 10 * 1024 * 1024) {
      throw new Error("Το αρχείο ήχου ξεπερνά τα 10MB.");
    }
    const audioExt = audio.file.name.split(".").pop()?.toLowerCase() || "mp3";
    const audioPath = `${uid}/audio-${Date.now()}.${audioExt}`;
    const { error: audioErr } = await supabase.storage
      .from("stories")
      .upload(audioPath, audio.file, { upsert: false, contentType: audio.file.type });
    if (audioErr) throw audioErr;
    const { data: audioData } = supabase.storage.from("stories").getPublicUrl(audioPath);
    audioUrl = audioData.publicUrl;
  }

  const { error } = await supabase.from("stories").insert({
    author_id: uid,
    media_url: mediaData.publicUrl,
    media_type: isVideo ? "video" : "image",
    audio_url: audioUrl,
    audio_title: audio?.title ?? null,
  });
  if (error) throw error;
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase
    .from("story_views")
    .upsert({ story_id: storyId, viewer_id: uid }, { onConflict: "story_id,viewer_id" });
  if (error) throw error;
}

export async function deleteStory(storyId: string): Promise<void> {
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw error;
}