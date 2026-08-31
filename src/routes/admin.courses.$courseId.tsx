// src/routes/admin.courses.$courseId.tsx
import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import CourseBuilder from "@/components/aura/CourseBuilder";
import {
  deleteCourse,
  getCourseForEdit,
  saveCourseSteps,
  updateCourse,
  type CourseInput,
} from "@/lib/courses";
import { getMyProfile } from "@/lib/queries";
import { isContentRole } from "@/lib/roles";
import { useAsync } from "@/lib/useAsync";
import type { StepDraft } from "@/lib/courses.types";

export const Route = createFileRoute("/admin/courses/$courseId")({
  head: () => ({ meta: [{ title: "AURA — Επεξεργασία Course" }] }),
  component: EditCoursePage,
});

function EditCoursePage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();

  const [reloadToken, setReloadToken] = useState(0);
  const load = useCallback(async () => {
    const profile = await getMyProfile();
    if (!isContentRole(profile.role)) {
      throw new Error("Η επεξεργασία courses απαιτεί ρόλο content manager και πάνω.");
    }
    return getCourseForEdit(courseId);
  }, [courseId]);

  const { data, error, loading } = useAsync(load, [courseId, reloadToken]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSave = useCallback(
    async (input: CourseInput, steps: StepDraft[]) => {
      if (!data) return;
      setSaving(true);
      setSaveError(null);
      setNotice(null);
      try {
        await updateCourse(courseId, input, data.course.slug, data.course.status);
        await saveCourseSteps(courseId, steps);
        setNotice("Αποθηκεύτηκε.");
        setReloadToken((n) => n + 1);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Η αποθήκευση απέτυχε.");
      } finally {
        setSaving(false);
      }
    },
    [courseId, data],
  );

  const handleDelete = useCallback(async () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Το course, τα βήματα και τα βίντεό του θα διαγραφούν οριστικά. Συνέχεια;",
      );
      if (!ok) return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await deleteCourse(courseId);
      await navigate({ to: "/admin/courses", replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Η διαγραφή απέτυχε.");
      setSaving(false);
    }
  }, [courseId, navigate]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-5 pb-28 pt-32">
        <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
        <div className="mt-10 h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-28 pt-32 text-center">
        <h1 className="text-2xl font-semibold text-neutral-100">Δεν φορτώθηκε</h1>
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error instanceof Error ? error.message : "Άγνωστο σφάλμα."}
        </p>
        <Link
          to="/admin/courses"
          className="mt-8 inline-block text-[10px] uppercase tracking-[0.4em] text-neutral-500 hover:text-neutral-200"
        >
          ← COURSES
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
        {data.course.title}
      </h1>
      <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
        /courses/{data.course.slug}
      </p>

      <div className="mt-12">
        <CourseBuilder
          key={`${data.course.id}-${reloadToken}`}
          course={data.course}
          initialSteps={data.steps}
          saving={saving}
          error={saveError}
          notice={notice}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </div>
    </main>
  );
}