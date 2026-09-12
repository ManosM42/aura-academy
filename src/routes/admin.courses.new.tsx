// src/routes/admin.courses.new.tsx
import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import VideoEntryForm from "@/components/aura/VideoEntryForm";
import type { VideoUploadMeta } from "@/components/aura/VideoDropzone";
import { createCourse, setCourseVideo, type CourseInput } from "@/lib/courses";
import { getMyProfile } from "@/lib/queries";
import { isContentRole } from "@/lib/roles";
import { useAsync } from "@/lib/useAsync";

export const Route = createFileRoute("/admin/courses/new")({
  head: () => ({ meta: [{ title: "AURA — Νέο Video" }] }),
  component: NewCoursePage,
});

function NewCoursePage() {
  const navigate = useNavigate();
  const { data: profile, error: profileError, loading } = useAsync(getMyProfile, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);

  const handleSave = useCallback(
    async (input: CourseInput) => {
      setSaving(true);
      setError(null);
      try {
        const course = await createCourse(input);
        setCreatedId(course.id);
        setSaving(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Η αποθήκευση απέτυχε.");
        setSaving(false);
      }
    },
    [],
  );

  const handleVideoUploaded = useCallback(
    async (path: string, durationSeconds: number | null, meta: VideoUploadMeta) => {
      setVideoPath(path);
      if (!createdId) return;
      try {
        await setCourseVideo(createdId, {
          path,
          durationSeconds,
          storageProvider: meta.storageProvider,
          sizeBytes: meta.sizeBytes,
          mimeType: meta.mimeType,
          originalFilename: meta.originalFilename,
          uploadedAt: meta.uploadedAt,
        });
        await navigate({
          to: "/admin/courses/$courseId",
          params: { courseId: createdId },
          replace: true,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Η αποθήκευση του βίντεο απέτυχε.");
      }
    },
    [createdId, navigate],
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
          Η δημιουργία video απαιτεί ρόλο content manager και πάνω.
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
        ← VIDEOS
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-100">Νέο video</h1>

      <div className="mt-12">
        <VideoEntryForm
          course={null}
          saving={saving}
          error={error}
          notice={
            createdId && !videoPath
              ? "Το video δημιουργήθηκε — ανέβασε τώρα το αρχείο βίντεο."
              : null
          }
          onSave={handleSave}
          onVideoUploaded={handleVideoUploaded}
          onVideoCleared={() => setVideoPath(null)}
          videoPath={videoPath}
          courseId={createdId}
        />
      </div>
    </main>
  );
}