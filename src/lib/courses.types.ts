// src/lib/courses.types.ts
import type { AuraLevel, CourseStatus } from "@/lib/database.types";
import type { PlanId } from "@/lib/plans";

export type CourseCategory = "graduation" | "layers" | "fade" | "creative";

export const COURSE_CATEGORIES: { key: CourseCategory; label: string }[] = [
  { key: "graduation", label: "Graduation" },
  { key: "layers", label: "Layers" },
  { key: "fade", label: "Fade" },
  { key: "creative", label: "Creative" },
];

export interface AuraCourse {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  outcome: string | null;
  audience: string | null;
  level: AuraLevel;
  status: CourseStatus;
  required_plan: PlanId;
  estimated_hours: number | null;
  cover_url: string | null;
  sort_order: number;
  step_count: number;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category: CourseCategory | null;
  video_path: string | null;
  video_duration_seconds: number | null;
  video_storage_provider: "backblaze_b2" | "supabase_storage" | null;
  video_status: "pending" | "uploading" | "uploaded" | "processing" | "ready" | "failed" | null;
  video_size_bytes: number | null;
  video_mime_type: string | null;
  video_original_filename: string | null;
  video_uploaded_at: string | null;
}

export interface CourseStep {
  id: string;
  course_id: string;
  position: number;
  title: string;
  description: string | null;
  video_path: string | null;
  video_duration_seconds: number | null;
  /** "backblaze_b2" for new uploads, "supabase_storage" for legacy rows, null if no video yet. */
  video_storage_provider: "backblaze_b2" | "supabase_storage" | null;
  video_status: "pending" | "uploading" | "uploaded" | "processing" | "ready" | "failed" | null;
  video_size_bytes: number | null;
  video_mime_type: string | null;
  video_original_filename: string | null;
  video_uploaded_at: string | null;
}

export interface CourseProgress {
  user_id: string;
  course_id: string;
  completed_step_ids: string[];
  last_step_index: number;
  replays: number;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

/** Ό,τι χρειάζεται μια κάρτα στο /courses. */
export interface CourseListItem {
  course: AuraCourse;
  progress: CourseProgress | null;
  locked: boolean;
}

export interface CoursesPageData {
  items: CourseListItem[];
  planId: PlanId | null;
  planRank: number;
  isContent: boolean;
  signedIn: boolean;
}

export interface CourseWithVideo {
  course: AuraCourse;
  locked: boolean;
  isContent: boolean;
}

/** Draft βήματος μέσα στον builder — δεν έχει ακόμα id στη βάση. */
export interface StepDraft {
  key: string;
  id: string | null;
  title: string;
  description: string;
  videoPath: string | null;
  videoDurationSeconds: number | null;
  videoStorageProvider: "backblaze_b2" | "supabase_storage" | null;
  videoSizeBytes: number | null;
  videoMimeType: string | null;
  videoOriginalFilename: string | null;
  videoUploadedAt: string | null;
}

// Matches the real PlanId values in src/lib/plans.ts (the four actual
// Stripe products: low/mid/high/limited). "limited" (physical book) sits
// on top since its feature list is a strict superset of "high"'s.
export const PLAN_RANK: Record<PlanId, number> = {
  low: 1,
  mid: 2,
  high: 3,
  limited: 4,
};

export function planRank(plan: string | null | undefined): number {
  if (!plan) return 0;
  const key = plan.trim().toLowerCase();
  return key in PLAN_RANK ? PLAN_RANK[key as PlanId] : 0;
}

/** Ίδια λογική με το public.can_access_course, για instant UI. */
export function planUnlocks(
  userPlan: string | null | undefined,
  requiredPlan: string | null | undefined,
): boolean {
  return planRank(userPlan) >= planRank(requiredPlan);
}