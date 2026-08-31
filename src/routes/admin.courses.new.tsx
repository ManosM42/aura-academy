// src/routes/admin.courses.new.tsx
import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import CourseBuilder from "@/components/aura/CourseBuilder";
import { createCourse, saveCourseSteps, type CourseInput } from "@/lib/courses";
import { getMyProfile } from "@/lib/queries";
import { isContentRole } from "@/lib/roles";
import { useAsync } from "@/lib/useAsync";
import type { StepDraft } from "@/lib/courses.types";

export const Route = createFileRoute("/admin/courses/new")({
  head: () => ({ meta: [{ title: "AURA — Νέο Course" }] }),
  component: NewCoursePage,
});

function NewCoursePage() {
  const navigate = useNavigate();
  const { data: profile, error: profileError, loading } = useAsync(getMyProfile, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(
    async (input: CourseInput, steps: StepDraft[]) => {
      setSaving(true);
      setError(null);
      try {
        const course = await createCourse(input);
        // Τα βήματα χωρίς βίντεο μπορούν να σωθούν αμέσως. Για upload βίντεο
        // ο builder χρειάζεται course id, οπότε συνεχίζει στο edit screen.
        await saveCourseSteps(course.id, steps);
        await navigate({
          to: "/admin/courses/$courseId",
          params: { courseId: course.id },
          replace: true,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Η αποθήκευση απέτυχε.");
      } finally {
        setSaving(false);
      }
    },
    [navigate],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-5 pb-28 pt-32">
        <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
      </main>
    );
  }

  if (profileError || !profile || !isContentRole(profile.role)) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-28 pt-32 text-center">
        <h1 className="text-2xl font-semibold text-neutral-100">Χωρίς πρόσβαση</h1>
        <p className="mt-4 text-sm text-neutral-400">
          Η δημιουργία courses απαιτεί ρόλο content manager και πάνω.
        </p>
        <Link
          to="/dashboard"
          className="mt-8 inline-block text-[10px] uppercase tracking-[0.4em] text-neutral-500 hover:text-neutral-200"
        >
          ← DASHBOARD
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-28 pt-28 sm:pt-32">
      <Link
        to="/admin/courses"
        className="text-[10px] uppercase tracking-[0.4em] text-neutral-500 transition hover:text-neutral-200"
      >
        ← COURSES
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-100">
        Νέο course
      </h1>

      <div className="mt-12">
        <CourseBuilder
          course={null}
          initialSteps={[]}
          saving={saving}
          error={error}
          notice={null}
          onSave={handleSave}
        />
      </div>
    </main>
  );
}