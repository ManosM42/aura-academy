import { useState } from "react";
import { Plus } from "lucide-react";
import { useAsync } from "@/lib/useAsync";
import { getActiveStories } from "@/lib/queries";
import CreateStoryModal from "@/components/aura/CreateStoryModal";
import StoryViewer from "@/components/aura/StoryViewer";

export default function StoriesBar({
  currentUserId,
  currentUserAvatar,
  currentUserName,
}: {
  currentUserId: string;
  currentUserAvatar: string | null;
  currentUserName: string | null;
}) {
  const stories = useAsync(getActiveStories, []);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);

  const groups = stories.data ?? [];
  const myGroup = groups.find((g) => g.author.id === currentUserId);

  return (
    <div className="mb-2">
      <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
        {/* Your Story */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            onClick={() =>
              myGroup
                ? setViewerGroupIndex(groups.indexOf(myGroup))
                : setCreateOpen(true)
            }
            className="relative"
          >
            <div
              className={`h-16 w-16 rounded-full p-[2px] ${
                myGroup && !myGroup.allViewed
                  ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
                  : "bg-white/15"
              }`}
            >
              <div className="h-full w-full rounded-full bg-[#070707] p-[2px]">
                {currentUserAvatar ? (
                  <img src={currentUserAvatar} className="h-full w-full rounded-full object-cover" alt="" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                    {currentUserName?.[0]?.toUpperCase() ?? "A"}
                  </div>
                )}
              </div>
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setCreateOpen(true);
              }}
              className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#070707] bg-white text-black"
            >
              <Plus size={12} strokeWidth={3} />
            </span>
          </button>
          <span className="max-w-[64px] truncate text-[11px] text-white/70">Εσύ</span>
        </div>

        {/* Everyone else */}
        {groups
          .filter((g) => g.author.id !== currentUserId)
          .map((g) => (
            <div key={g.author.id} className="flex shrink-0 flex-col items-center gap-1">
              <button onClick={() => setViewerGroupIndex(groups.indexOf(g))}>
                <div
                  className={`h-16 w-16 rounded-full p-[2px] ${
                    g.allViewed
                      ? "bg-white/15"
                      : "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
                  }`}
                >
                  <div className="h-full w-full rounded-full bg-[#070707] p-[2px]">
                    {g.author.avatar_url ? (
                      <img src={g.author.avatar_url} className="h-full w-full rounded-full object-cover" alt="" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                        {g.author.full_name?.[0]?.toUpperCase() ?? "A"}
                      </div>
                    )}
                  </div>
                </div>
              </button>
              <span className="max-w-[64px] truncate text-[11px] text-white/70">
                {g.author.full_name ?? "Χρήστης"}
              </span>
            </div>
          ))}
      </div>

      <CreateStoryModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => stories.reload?.()}
      />

      {viewerGroupIndex !== null && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          startGroupIndex={viewerGroupIndex}
          currentUserId={currentUserId}
          onClose={() => {
            setViewerGroupIndex(null);
            stories.reload?.();
          }}
          onDeleted={() => stories.reload?.()}
        />
      )}
    </div>
  );
}