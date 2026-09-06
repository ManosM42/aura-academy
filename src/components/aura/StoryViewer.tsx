import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, Volume2, VolumeX, X } from "lucide-react";
import { markStoryViewed, deleteStory, type StoryGroup } from "@/lib/queries";

const STORY_DURATION_MS = 5000;

export default function StoryViewer({
  groups,
  startGroupIndex,
  currentUserId,
  onClose,
  onDeleted,
}: {
  groups: StoryGroup[];
  startGroupIndex: number;
  currentUserId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>();
  const startRef = useRef<number>(0);
  const viewedRef = useRef<Set<string>>(new Set());

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  function goNextStory() {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }

  function goPrevStory() {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((g) => g - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
  }

  // Mark as viewed once, drive the progress bar, and (re)start any attached audio.
  useEffect(() => {
    if (!story) return;
    if (!viewedRef.current.has(story.id)) {
      viewedRef.current.add(story.id);
      markStoryViewed(story.id).catch(() => {});
    }

    setProgress(0);
    startRef.current = performance.now();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (story.audio_url) {
        audioRef.current.src = story.audio_url;
        audioRef.current.muted = muted;
        audioRef.current.loop = true;
        audioRef.current.play().catch(() => {});
      }
    }

    const isVideo = story.media_type === "video";
    if (isVideo) return; // videos drive their own progress via timeupdate

    function tick(now: number) {
      if (paused) {
        startRef.current = now - (progress / 100) * STORY_DURATION_MS;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        goNextStory();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  // Stop any playing audio on unmount (closing the viewer).
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNextStory();
      if (e.key === "ArrowLeft") goPrevStory();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }

  async function handleDelete() {
    if (!story) return;
    await deleteStory(story.id);
    onDeleted();
    goNextStory();
  }

  if (!group || !story) return null;
  const isOwn = group.author.id === currentUserId;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black"
      >
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.6}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100) onClose();
          }}
          className="relative h-full w-full max-w-md overflow-hidden bg-black sm:h-[92vh] sm:rounded-2xl"
        >
          {/* progress bars */}
          <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-2">
            {group.stories.map((s, i) => (
              <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full bg-white"
                  style={{
                    width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* header */}
          <div className="absolute inset-x-0 top-4 z-10 flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              {group.author.avatar_url ? (
                <img src={group.author.avatar_url} className="h-8 w-8 rounded-full object-cover ring-1 ring-white/30" alt="" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
                  {group.author.full_name?.[0]?.toUpperCase() ?? "A"}
                </div>
              )}
              <span className="text-sm font-semibold text-white drop-shadow">
                {group.author.full_name ?? "Χρήστης"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {(story.audio_url || story.media_type === "video") && (
                <button
                  onClick={toggleMute}
                  className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
              {isOwn && (
                <button
                  onClick={handleDelete}
                  className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* media */}
          <div className="flex h-full w-full items-center justify-center">
            {story.media_type === "video" ? (
              <video
                ref={videoRef}
                src={story.media_url}
                className="h-full w-full object-contain"
                autoPlay
                muted={muted}
                playsInline
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setProgress((v.currentTime / v.duration) * 100);
                }}
                onEnded={goNextStory}
              />
            ) : (
              <img src={story.media_url} className="h-full w-full object-contain" alt="" />
            )}
          </div>

          {/* attached audio (image stories only — video has its own soundtrack) */}
          <audio ref={audioRef} className="hidden" />

          {story.audio_title && (
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur">
              🎵 <span className="max-w-[160px] truncate">{story.audio_title}</span>
            </div>
          )}

          {/* tap zones */}
          <button
            aria-label="Previous"
            onClick={goPrevStory}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            className="absolute inset-y-0 left-0 z-[5] w-1/3"
          />
          <button
            aria-label="Next"
            onClick={goNextStory}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            className="absolute inset-y-0 right-0 z-[5] w-2/3"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}