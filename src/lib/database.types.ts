// Hand-written types that mirror the AURA core schema.
// Keep in sync if you later run `supabase gen types`.

export type UserRole =
  | "student" | "educator" | "senior_educator"
  | "content_manager" | "operations" | "admin" | "super_admin";

export type AuraLevel =
  | "foundation" | "professional" | "advanced" | "master" | "educator";

export type AccountStatus = "active" | "suspended" | "deleted";

export type CourseStatus =
  | "draft" | "review" | "approved" | "scheduled" | "published" | "archived";

export type LessonType = "video" | "theory" | "practice";

export type SkillCategory =
  | "foundation" | "technical" | "analysis" | "design" | "business" | "educator";

export type SkillState =
  | "locked" | "learning" | "practicing" | "verified" | "mastered";

export type SubmissionStatus =
  | "draft" | "submitted" | "in_review" | "needs_revision" | "passed";

export type ReviewDecision = "passed" | "needs_revision" | "failed";

export type CertificationStatus =
  | "not_started" | "in_progress" | "passed"
  | "needs_improvement" | "failed" | "issued";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  level: AuraLevel;
  status: AccountStatus;
  country: string | null;
  bio: string | null;
  headline: string | null;
  avatar_url: string | null;
  city: string | null;
  instagram: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  outcome: string | null;
  audience: string | null;
  level: AuraLevel;
  estimated_hours: number | null;
  status: CourseStatus;
  version: number;
  cover_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  objective: string | null;
  sort_order: number;
}

export interface ResourceLink {
  label: string;
  url: string;
}

export interface LessonTimestamp {
  label: string;
  seconds: number;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  type: LessonType;
  objective: string | null;
  video_url: string | null;
  transcript: string | null;
  resources: ResourceLink[];
  timestamps: LessonTimestamp[];
  sort_order: number;
}

export interface LessonProgress {
  user_id: string;
  lesson_id: string;
  completed: boolean;
  seconds_watched: number;
  notes: string | null;
  completed_at: string | null;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category: SkillCategory;
  definition: string | null;
  why_it_matters: string | null;
  mastery_rule: string | null;
  prerequisites: string[];
  sort_order: number;
}

export interface UserSkill {
  user_id: string;
  skill_id: string;
  state: SkillState;
  score: number | null;
  verified_at: string | null;
}

export interface RubricCriterion {
  criterion: string;
  weight: number;
  max: number;
}

export interface Assignment {
  id: string;
  lesson_id: string | null;
  skill_id: string | null;
  title: string;
  brief: string | null;
  objective: string | null;
  tools: string | null;
  restrictions: string | null;
  checklist: string[];
  rubric: RubricCriterion[];
}

export interface Submission {
  id: string;
  assignment_id: string;
  user_id: string;
  status: SubmissionStatus;
  before_media: string[];
  process_media: string[];
  after_media: string[];
  client_context: string | null;
  observations: string | null;
  intended_result: string | null;
  technique: string | null;
  self_evaluation: string | null;
  attempt: number;
  submitted_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  submission_id: string;
  educator_id: string;
  score: number | null;
  rubric_scores: { criterion: string; score: number }[];
  strengths: string | null;
  technical_gaps: string | null;
  method_gaps: string | null;
  next_actions: string | null;
  decision: ReviewDecision;
  created_at: string;
}

// Composite shapes returned by queries
export type CourseWithTree = Course & {
  modules: (Module & { lessons: Lesson[] })[];
};

export type SkillWithState = Skill & { userSkill: UserSkill | null };