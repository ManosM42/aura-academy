// src/lib/courses.types.ts
import type { AuraLevel, CourseStatus } from "@/lib/database.types";
import type { PlanId } from "@/lib/plans";

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
}

export interface CourseStep {
  id: string;
  course_id: string;
  position: number;
  title: string;
  description: string | null;
  video_path: string | null;
  video_duration_seconds: number | null;
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

export interface CourseWithSteps {
  course: AuraCourse;
  steps: CourseStep[];
  progress: CourseProgress | null;
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
}

export const PLAN_RANK: Record<PlanId, number> = {
  starter: 1,
  core: 2,
  full: 3,
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