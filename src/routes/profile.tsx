import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { updateMyProfile, uploadAvatar } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { profile, loading, session, refresh } = useAuth();

  const [form, setForm] = useState({
    full_name: "",
    headline: "",
    bio: "",
    city: "",
    instagram: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        headline: profile.headline ?? "",
        bio: profile.bio ?? "",
        city: profile.city ?? "",
        instagram: profile.instagram ?? "",
      });
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [profile]);

  async function handleAvatar(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const url = await uploadAvatar(file);
      await updateMyProfile({ avatar_url: url });
      setAvatarUrl(url);
      refresh();
      setMsg("Η φωτογραφία ενημερώθηκε.");
    } catch (e) {
      setMsg("Αποτυχία: " + (e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    try {
      await updateMyProfile(form);
      refresh();
      setMsg("Το προφίλ αποθηκεύτηκε.");
    } catch (e) {
      setMsg("Αποτυχία: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/90 outline-none focus:border-white/30";

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12 text-white">
        <LoadingSkeleton rows={4} />
      </main>
    );
  }

  if (!session || !profile) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12 text-white">
        <ErrorState message="Πρέπει να συνδεθείς για να δεις το προφίλ σου." />
      </main>
    );
  }

  const initials = (form.full_name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12 text-white">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Το προφίλ μου</h1>
      </header>

      {/* Avatar */}
      <section className="mb-8 flex items-center gap-5">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-20 w-20 rounded-full object-cover ring-1 ring-white/20"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-lg font-medium text-white/70">
            {initials || "?"}
          </span>
        )}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatar(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            {uploading ? "Ανέβασμα…" : "Αλλαγή φωτογραφίας"}
          </button>
          <p className="mt-1 text-xs text-white/40">JPG/PNG, έως 5MB.</p>
        </div>
      </section>

      {/* Read-only status */}
      <section className="mb-8 grid grid-cols-3 gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">Ρόλος</p>
          <p className="mt-1 text-white/80">{profile.role}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">Level</p>
          <p className="mt-1 text-white/80">{profile.level}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">Status</p>
          <p className="mt-1 text-white/80">{profile.status}</p>
        </div>
      </section>

      {/* Editable fields */}
      <section className="space-y-4">
        <Labeled label="Ονοματεπώνυμο">
          <input
            className={field}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </Labeled>
        <Labeled label="Τίτλος (headline)">
          <input
            className={field}
            placeholder="π.χ. Master Barber · Athens"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
          />
        </Labeled>
        <Labeled label="Bio">
          <textarea
            rows={4}
            className={field}
            placeholder="Πες λίγα λόγια για σένα, τη διαδρομή και το στυλ σου…"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </Labeled>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Πόλη">
            <input
              className={field}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Labeled>
          <Labeled label="Instagram">
            <input
              className={field}
              placeholder="@username"
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            />
          </Labeled>
        </div>
      </section>

      {msg && (
        <p className="mt-4 text-sm text-white/70" role="status">
          {msg}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={busy}
        className="mt-6 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {busy ? "Αποθήκευση…" : "Αποθήκευση προφίλ"}
      </button>
    </main>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-white/70">{label}</span>
      {children}
    </label>
  );
}