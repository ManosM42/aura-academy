// src/components/aura/elite/EliteCommunity.tsx
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Copy,
  FileText,
  Gem,
  Loader2,
  Lock,
  Mic,
  Paperclip,
  Pause,
  Pencil,
  Play,
  Plus,
  Reply,
  Send,
  Smile,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  MAX_FILE_BYTES,
  displayName,
  useEliteChat,
  type EliteMessage,
  type Member,
} from "@/lib/useEliteChat";
import {
  LIVE_BARS,
  MAX_VOICE_MS,
  MIN_VOICE_MS,
  useVoiceRecorder,
  type VoiceClip,
} from "@/lib/useVoiceRecorder";

/* ------------------------------------------------------------------ */
/* Constants + helpers                                                 */
/* ------------------------------------------------------------------ */

const QUICK = ["❤️", "😂", "😮", "😢", "😡", "👍"];
const EMOJI_GRID = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤩", "🥳", "😏", "🤔",
  "😮", "😢", "😭", "😡", "🙏", "👍", "👎", "👏", "🙌", "💪", "🔥", "💎",
  "❤️", "🖤", "🤍", "💯", "✨", "⭐", "🚀", "🎯", "💈", "✂️", "👑", "🏆",
];
const GROUP_GAP_MS = 5 * 60 * 1000;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function initials(m?: Member | null): string {
  return displayName(m).slice(0, 1).toUpperCase();
}

function renderBody(text: string, usernames: Set<string>): ReactNode {
  return text.split(/(@[a-zA-Z0-9_]{3,20})/g).map((part, i) =>
    part.startsWith("@") && usernames.has(part.slice(1).toLowerCase()) ? (
      <span key={i} className="ec-mention">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Avatar({
  member,
  size = 40,
  badge = false,
  online = false,
}: {
  member?: Member | null;
  size?: number;
  badge?: boolean;
  online?: boolean;
}) {
  return (
    <span className="ec-avatar" style={{ width: size, height: size }}>
      <span className="ec-avatar-in">
        {member?.avatar_url ? (
          <img src={member.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span style={{ fontSize: size * 0.4 }}>{initials(member)}</span>
        )}
      </span>
      {badge && (
        <span className="ec-avatar-gem" aria-hidden>
          <Gem className="size-2.5" />
        </span>
      )}
      {online && <span className="ec-online" aria-label="Online" />}
    </span>
  );
}

function EliteBadge({ small = false }: { small?: boolean }) {
  return (
    <span className={`ec-badge ${small ? "ec-badge-sm" : ""}`}>
      <Gem className="size-3" aria-hidden />
      Elite
    </span>
  );
}

/** Faceted chrome diamond, shown in the banner when /elite-bust.jpg is missing. */
function ChromeGem() {
  return (
    <svg className="ec-gem-art" viewBox="0 0 200 200" aria-hidden>
      <defs>
        <linearGradient id="ecg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#a3abb8" />
          <stop offset="1" stopColor="#3b4048" />
        </linearGradient>
        <linearGradient id="ecg-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef1f6" />
          <stop offset=".5" stopColor="#6b7280" />
          <stop offset="1" stopColor="#1c1e22" />
        </linearGradient>
        <linearGradient id="ecg-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="1" stopColor="#8b93a1" stopOpacity=".55" />
        </linearGradient>
      </defs>
      <g stroke="rgba(255,255,255,.4)" strokeWidth=".8" strokeLinejoin="round">
        <polygon points="40,70 70,34 130,34 160,70" fill="url(#ecg-c)" />
        <polygon points="70,34 100,70 40,70" fill="url(#ecg-a)" />
        <polygon points="130,34 160,70 100,70" fill="url(#ecg-b)" />
        <polygon points="70,34 130,34 100,70" fill="url(#ecg-c)" opacity=".75" />
        <polygon points="40,70 80,70 100,172" fill="url(#ecg-a)" />
        <polygon points="80,70 120,70 100,172" fill="url(#ecg-c)" opacity=".85" />
        <polygon points="120,70 160,70 100,172" fill="url(#ecg-b)" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Voice message player (Instagram style)                              */
/* ------------------------------------------------------------------ */

const SPEEDS = [1, 1.5, 2];
const PLAYER_BARS = 34;

// Only one voice message plays at a time.
let activeAudio: HTMLAudioElement | null = null;
let activeStop: (() => void) | null = null;

function resampleBars(src: number[] | null, n: number): number[] {
  if (!src || src.length === 0) {
    return Array.from({ length: n }, (_, i) => 22 + Math.round(Math.abs(Math.sin(i * 1.7)) * 46));
  }
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * src.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * src.length) / n));
    let peak = 0;
    for (let j = a; j < b && j < src.length; j += 1) peak = Math.max(peak, src[j] ?? 0);
    return Math.max(12, Math.min(100, peak));
  });
}

const VoiceBubble = memo(function VoiceBubble({ msg, url }: { msg: EliteMessage; url?: string }) {
  const src = msg.localUrl ?? url;
  const total = Math.max(1000, msg.voice_duration_ms ?? 1000);
  const bars = useMemo(() => resampleBars(msg.voice_waveform, PLAYER_BARS), [msg.voice_waveform]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const seekingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);

  const stopTick = useCallback(() => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
  }, []);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!seekingRef.current) setProgress(Math.min(1, (a.currentTime * 1000) / total));
    rafRef.current = requestAnimationFrame(tick);
  }, [total]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    stopTick();
    setPlaying(false);
  }, [stopTick]);

  // New source (e.g. local blob replaced by the signed url) or unmount: reset.
  useEffect(
    () => () => {
      stopTick();
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
      if (activeAudio === a) {
        activeAudio = null;
        activeStop = null;
      }
      audioRef.current = null;
    },
    [src, stopTick],
  );

  const ensureAudio = (): HTMLAudioElement | null => {
    if (!src) return null;
    if (audioRef.current) return audioRef.current;
    const a = new Audio();
    a.preload = "metadata";
    a.src = src;
    a.playbackRate = speed;
    a.onended = () => {
      stopTick();
      setPlaying(false);
      setProgress(0);
      a.currentTime = 0;
      if (activeAudio === a) {
        activeAudio = null;
        activeStop = null;
      }
    };
    a.onerror = () => {
      stopTick();
      setPlaying(false);
      setFailed(true);
    };
    audioRef.current = a;
    return a;
  };

  const toggle = async () => {
    if (playing) {
      pause();
      return;
    }
    const a = ensureAudio();
    if (!a) return;
    if (activeAudio && activeAudio !== a) activeStop?.();
    activeAudio = a;
    activeStop = pause;
    try {
      a.playbackRate = speed;
      await a.play();
      setFailed(false);
      setPlaying(true);
      stopTick();
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setFailed(true);
      setPlaying(false);
    }
  };

  const seekTo = (ratio: number) => {
    const a = ensureAudio();
    const r = Math.max(0, Math.min(1, ratio));
    setProgress(r);
    if (a) {
      try {
        a.currentTime = (r * total) / 1000;
      } catch {
        /* some formats cannot seek before they are loaded */
      }
    }
  };

  const ratioFrom = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return rect.width ? (e.clientX - rect.left) / rect.width : 0;
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const started = playing || progress > 0;
  const label = failed ? "Can’t play" : fmtClock(started ? total * (1 - progress) : total);

  return (
    <div className={`ec-voice ${failed ? "ec-voice-fail" : ""}`}>
      <button
        type="button"
        className="ec-voice-play"
        onClick={() => void toggle()}
        disabled={!src}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
      </button>

      <div
        className="ec-voice-wave"
        role="slider"
        tabIndex={0}
        aria-label="Voice message position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onPointerDown={(e) => {
          seekingRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          seekTo(ratioFrom(e));
        }}
        onPointerMove={(e) => {
          if (seekingRef.current) seekTo(ratioFrom(e));
        }}
        onPointerUp={() => {
          seekingRef.current = false;
        }}
        onPointerCancel={() => {
          seekingRef.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seekTo(progress + 0.05);
          if (e.key === "ArrowLeft") seekTo(progress - 0.05);
        }}
      >
        {bars.map((h, i) => (
          <i key={i} className={i / bars.length < progress ? "on" : ""} style={{ height: `${h}%` }} />
        ))}
      </div>

      <span className="ec-voice-time">{label}</span>

      {started && !failed && (
        <button type="button" className="ec-voice-speed" onClick={cycleSpeed} aria-label="Playback speed">
          {speed}x
        </button>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Message row                                                         */
/* ------------------------------------------------------------------ */

interface RowProps {
  meId: string;
  msg: EliteMessage;
  mine: boolean;
  showHead: boolean;
  author?: Member;
  members: Record<string, Member>;
  reply: { name: string; text: string } | null;
  seers: Member[] | null;
  url?: string;
  usernames: Set<string>;
  onMenu: (id: string, el: HTMLElement, mine: boolean) => void;
  onReact: (id: string, emoji: string) => void;
  onSeen: (id: string) => void;
  onJump: (id: string) => void;
  onMedia: () => void;
}

const Row = memo(function Row({
  meId,
  msg,
  mine,
  showHead,
  author,
  members,
  reply,
  seers,
  url,
  usernames,
  onMenu,
  onReact,
  onSeen,
  onJump,
  onMedia,
}: RowProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | undefined>(undefined);

  const cancelPress = () => {
    if (pressTimer.current !== undefined) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = undefined;
    }
  };

  const startPress = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" || msg.pending || msg.deleted_at) return;
    const el = e.currentTarget;
    cancelPress();
    pressTimer.current = window.setTimeout(() => onMenu(msg.id, el, mine), 420);
  };

  useEffect(() => cancelPress, []);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of msg.reactions) {
      const list = map.get(r.emoji) ?? [];
      list.push(r.user_id);
      map.set(r.emoji, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [msg.reactions]);

  const isImage = Boolean(msg.attachment_type?.startsWith("image/"));
  const isVoice = Boolean(msg.attachment_type?.startsWith("audio/"));
  const name = displayName(author);

  if (msg.deleted_at) {
    return (
      <div id={`msg-${msg.id}`} className={`ec-row ${mine ? "ec-mine" : ""}`}>
        {!mine && <div className="ec-av-col" />}
        <div className="ec-col">
          <div className="ec-tomb">{mine ? "You deleted a message" : `${name} deleted a message`}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`msg-${msg.id}`}
      className={`ec-row ${mine ? "ec-mine" : ""} ${msg.fresh ? "ec-pop" : ""} ${showHead ? "ec-head" : ""}`}
    >
      {!mine && <div className="ec-av-col">{showHead ? <Avatar member={author} size={44} badge /> : null}</div>}

      <div className="ec-col">
        {!mine && showHead && (
          <div className="ec-meta">
            <span className="ec-name">{name}</span>
            <EliteBadge small />
            <span className="ec-time">{timeOf(msg.created_at)}</span>
          </div>
        )}

        <div className="ec-bubble-wrap">
          <div
            ref={bubbleRef}
            className={`ec-bubble ${mine ? "ec-bubble-mine" : ""} ${isVoice ? "ec-bubble-voice" : ""} ${msg.pending ? "ec-pending" : ""}`}
            title={new Date(msg.created_at).toLocaleString()}
            onDoubleClick={() => !msg.pending && onReact(msg.id, "❤️")}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!msg.pending && bubbleRef.current) onMenu(msg.id, bubbleRef.current, mine);
            }}
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onTouchMove={cancelPress}
          >
            {reply && (
              <button type="button" className="ec-quote" onClick={() => msg.reply_to && onJump(msg.reply_to)}>
                <span className="ec-quote-name">{reply.name}</span>
                <span className="ec-quote-text">{reply.text}</span>
              </button>
            )}

            {isVoice && <VoiceBubble msg={msg} url={url} />}

            {msg.attachment_name && isImage && (
              <a href={url} target="_blank" rel="noreferrer" className="ec-img-link" aria-label="Open image">
                {url ? (
                  <img src={url} alt={msg.attachment_name} loading="lazy" onLoad={onMedia} />
                ) : (
                  <span className="ec-img-skel" />
                )}
              </a>
            )}

            {msg.attachment_name && !isImage && !isVoice && (
              <a href={url} target="_blank" rel="noreferrer" className="ec-file" download={msg.attachment_name}>
                <FileText className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate">{msg.attachment_name}</span>
                  <span className="block text-[11px] opacity-60">{fmtSize(msg.attachment_size)}</span>
                </span>
              </a>
            )}

            {msg.body && <p className="ec-text">{renderBody(msg.body, usernames)}</p>}

            {msg.edited_at && <span className="ec-edited">Edited</span>}
          </div>

          {!msg.pending && (
            <button
              type="button"
              className="ec-more"
              aria-label="Message options"
              onClick={(e) => {
                const el = bubbleRef.current ?? e.currentTarget;
                onMenu(msg.id, el, mine);
              }}
            >
              <Smile className="size-4" />
            </button>
          )}

          {grouped.length > 0 && (
            <div className="ec-reacts">
              {grouped.map(([emoji, ids]) => {
                const iReacted = ids.includes(meId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`ec-react ${iReacted ? "ec-react-on" : ""}`}
                    title={ids.map((id) => displayName(members[id])).join(", ")}
                    onClick={() => onReact(msg.id, emoji)}
                  >
                    <span>{emoji}</span>
                    <span>{ids.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {mine && <div className="ec-time-mine">{msg.pending ? "Sending…" : timeOf(msg.created_at)}</div>}

        {seers && seers.length > 0 && (
          <button type="button" className="ec-seen" onClick={() => onSeen(msg.id)}>
            <span className="ec-seen-avs">
              {seers.slice(0, 3).map((s) => (
                <Avatar key={s.id} member={s} size={18} />
              ))}
            </span>
            Seen by {seers.length}
          </button>
        )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Message menu (emoji bar + actions), Instagram style                 */
/* ------------------------------------------------------------------ */

interface MenuState {
  id: string;
  rect: DOMRect;
  mine: boolean;
}

function MessageMenu({
  state,
  msg,
  myReaction,
  onClose,
  onReact,
  onReply,
  onCopy,
  onEdit,
  onDelete,
}: {
  state: MenuState;
  msg: EliteMessage;
  myReaction?: string;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const vw = typeof window === "undefined" ? 400 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const width = Math.min(320, vw - 16);
  const left = Math.max(8, Math.min(state.mine ? state.rect.right - width : state.rect.left, vw - width - 8));
  const above = state.rect.top > 120;
  const top = above ? Math.max(8, state.rect.top - 64) : Math.min(vh - 260, state.rect.bottom + 8);

  return (
    <div className="ec-menu-layer" onPointerDown={onClose}>
      <div
        className="ec-menu"
        style={{ left, top, width }}
        onPointerDown={(e) => e.stopPropagation()}
        role="menu"
        aria-label="Message actions"
      >
        <div className="ec-emoji-bar">
          {QUICK.map((e) => (
            <button
              key={e}
              type="button"
              className={`ec-emoji-btn ${myReaction === e ? "ec-emoji-on" : ""}`}
              onClick={() => onReact(e)}
              aria-label={`React ${e}`}
            >
              {e}
            </button>
          ))}
          <button type="button" className="ec-emoji-btn" onClick={() => setMore((m) => !m)} aria-label="More emojis">
            <Plus className="size-5" />
          </button>
        </div>

        {more && (
          <div className="ec-emoji-grid ec-menu-grid">
            {EMOJI_GRID.map((e) => (
              <button key={e} type="button" onClick={() => onReact(e)}>
                {e}
              </button>
            ))}
          </div>
        )}

        <div className="ec-actions">
          {confirm ? (
            <div className="ec-confirm">
              <p>Delete this message for everyone?</p>
              <div>
                <button type="button" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="ec-danger" onClick={onDelete}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={onReply}>
                <Reply className="size-4" /> Reply
              </button>
              {msg.body && (
                <button type="button" role="menuitem" onClick={onCopy}>
                  <Copy className="size-4" /> Copy
                </button>
              )}
              {state.mine && !msg.attachment_type?.startsWith("audio/") && (
                <button type="button" role="menuitem" onClick={onEdit}>
                  <Pencil className="size-4" /> Edit
                </button>
              )}
              {state.mine && (
                <button type="button" role="menuitem" className="ec-danger" onClick={() => setConfirm(true)}>
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ec-sheet-layer" onPointerDown={onClose}>
      <div
        className="ec-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="ec-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="ec-iconbtn ec-iconbtn-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="ec-sheet-body">{children}</div>
      </div>
    </div>
  );
}

function MemberRow({ m, online, you }: { m: Member; online: boolean; you: boolean }) {
  return (
    <li className="ec-member">
      <Avatar member={m} size={40} badge online={online} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {displayName(m)}
          {you ? <span className="ec-you"> (you)</span> : null}
        </p>
        {m.username ? <p className="truncate text-[11px] text-white/40">@{m.username}</p> : null}
      </div>
      <EliteBadge small />
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

function Composer({
  members,
  sending,
  replyTo,
  replyName,
  editing,
  onCancelReply,
  onCancelEdit,
  onSend,
  onEditSubmit,
  onSendVoice,
  onTyping,
}: {
  members: Member[];
  sending: boolean;
  replyTo: EliteMessage | null;
  replyName: string;
  editing: EliteMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (text: string, file: File | null) => Promise<boolean>;
  onEditSubmit: (id: string, text: string) => Promise<boolean>;
  onSendVoice: (clip: VoiceClip) => Promise<boolean>;
  onTyping: () => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [caret, setCaret] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [slide, setSlide] = useState({ dx: 0, dy: 0 });
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gesture = useRef({ down: false, x: 0, y: 0, t0: 0, cancelArmed: false });
  const finishing = useRef(false);

  const rec = useVoiceRecorder();
  const recActive = rec.state !== "idle";
  const holding = recActive && !locked;
  const cancelArmed = holding && slide.dx < -110;
  const lockArmed = holding && slide.dy < -40;

  // Entering edit mode loads the old text; entering reply mode focuses the box.
  useEffect(() => {
    if (editing) {
      setText(editing.body);
      setFile(null);
      requestAnimationFrame(() => ref.current?.focus());
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) requestAnimationFrame(() => ref.current?.focus());
  }, [replyTo]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text, recActive]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    if (rec.error) setFileError(rec.error);
  }, [rec.error]);

  useEffect(() => {
    if (recActive) setEmojiOpen(false);
  }, [recActive]);

  const mention = useMemo(() => {
    const m = /(?:^|\s)@([a-zA-Z0-9_]{0,20})$/.exec(text.slice(0, caret));
    if (!m) return null;
    const q = (m[1] ?? "").toLowerCase();
    const list = members.filter((x) => x.username && x.username.toLowerCase().startsWith(q)).slice(0, 5);
    return list.length ? { q, list } : null;
  }, [text, caret, members]);

  const insertMention = (username: string) => {
    const before = text.slice(0, caret).replace(/@[a-zA-Z0-9_]{0,20}$/, `@${username} `);
    const next = before + text.slice(caret);
    setText(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(before.length, before.length);
      setCaret(before.length);
    });
  };

  const canSend = (text.trim().length > 0 || Boolean(file)) && !sending;
  const showMic = !editing && text.trim().length === 0 && !file;

  const submit = async () => {
    if (!canSend) return;
    if (editing) {
      const ok = await onEditSubmit(editing.id, text);
      if (ok) {
        setText("");
        onCancelEdit();
      }
      return;
    }
    const ok = await onSend(text, file);
    if (ok) {
      setText("");
      setFile(null);
      setEmojiOpen(false);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (editing) {
        setText("");
        onCancelEdit();
      } else if (replyTo) onCancelReply();
      setEmojiOpen(false);
      return;
    }
    const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const pickFile = (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setFileError("Files can be up to 10 MB.");
      return;
    }
    setFile(f);
  };

  /* ---------------- voice messages ---------------- */

  const resetGesture = () => {
    gesture.current.down = false;
    gesture.current.cancelArmed = false;
    setLocked(false);
    setSlide({ dx: 0, dy: 0 });
  };

  const finishVoice = async () => {
    if (finishing.current) return;
    finishing.current = true;
    resetGesture();
    try {
      const clip = await rec.stop();
      if (!clip) return;
      if (clip.durationMs < MIN_VOICE_MS) {
        setFileError("Hold the mic to record a voice message.");
        return;
      }
      await onSendVoice(clip);
    } finally {
      finishing.current = false;
    }
  };

  const cancelVoice = () => {
    resetGesture();
    rec.cancel();
  };

  // auto-send when the time limit is reached
  const finishRef = useRef(finishVoice);
  finishRef.current = finishVoice;
  useEffect(() => {
    if (rec.elapsedMs >= MAX_VOICE_MS && (rec.state === "recording" || rec.state === "paused")) {
      void finishRef.current();
    }
  }, [rec.elapsedMs, rec.state]);

  const onMicDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // Already recording in locked mode: this press sends it.
    if (rec.state !== "idle") {
      if (locked) {
        e.preventDefault();
        void finishVoice();
      }
      return;
    }

    setFileError(null);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    gesture.current = { down: true, x: e.clientX, y: e.clientY, t0: Date.now(), cancelArmed: false };
    setSlide({ dx: 0, dy: 0 });

    void (async () => {
      const ok = await rec.start();
      if (!ok) {
        gesture.current.down = false;
        return;
      }
      navigator.vibrate?.(12);
      // finger already lifted while the permission prompt was open: keep recording, locked
      if (!gesture.current.down) setLocked(true);
    })();
  };

  const onMicMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g.down || locked) return;
    const dx = Math.min(0, e.clientX - g.x);
    const dy = Math.min(0, e.clientY - g.y);
    setSlide({ dx, dy });
    g.cancelArmed = dx < -110;
    if (dy < -80 && rec.state === "recording") {
      g.down = false;
      setSlide({ dx: 0, dy: 0 });
      setLocked(true);
      navigator.vibrate?.(10);
    }
  };

  const onMicUp = () => {
    const g = gesture.current;
    if (!g.down) return;
    g.down = false;
    if (rec.state === "starting" || locked) return; // the start() continuation locks it
    const held = Date.now() - g.t0;
    if (held < 350) {
      // a quick tap: keep recording hands-free
      setSlide({ dx: 0, dy: 0 });
      setLocked(true);
      return;
    }
    if (g.cancelArmed) {
      cancelVoice();
      return;
    }
    void finishVoice();
  };

  const onMicCancel = () => {
    const g = gesture.current;
    if (!g.down) return;
    g.down = false;
    if (!locked && rec.state === "recording") cancelVoice();
  };

  const onMicKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (e.repeat) return;
    if (rec.state === "idle") {
      setFileError(null);
      void rec.start().then((ok) => {
        if (ok) setLocked(true);
      });
    } else if (rec.state === "recording" || rec.state === "paused") {
      void finishVoice();
    }
  };

  const slots = Array.from({ length: LIVE_BARS }, (_, i) => {
    const v = rec.live[rec.live.length - LIVE_BARS + i];
    return v === undefined ? 0.06 : v;
  });

  return (
    <div className="ec-composer-wrap">
      {(replyTo || editing) && !recActive && (
        <div className="ec-ctx">
          <div className="min-w-0">
            <span className="ec-ctx-title">{editing ? "Editing message" : `Replying to ${replyName}`}</span>
            <span className="ec-ctx-text">{(editing ?? replyTo)?.body || (replyTo ? replyTo.attachment_name : "") || "Attachment"}</span>
          </div>
          <button
            type="button"
            className="ec-iconbtn ec-iconbtn-sm"
            aria-label="Cancel"
            onClick={() => {
              if (editing) {
                setText("");
                onCancelEdit();
              } else onCancelReply();
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {file && !recActive && (
        <div className="ec-attach-preview">
          {preview ? <img src={preview} alt="" /> : <FileText className="size-5" aria-hidden />}
          <span className="truncate">{file.name}</span>
          <button type="button" className="ec-iconbtn ec-iconbtn-sm" onClick={() => setFile(null)} aria-label="Remove attachment">
            <X className="size-4" />
          </button>
        </div>
      )}

      {fileError && (
        <p className="ec-inline-error" role="alert">
          {fileError}
        </p>
      )}

      {mention && !recActive && (
        <ul className="ec-mentions" role="listbox" aria-label="Mention a member">
          {mention.list.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => insertMention(m.username as string)}>
                <Avatar member={m} size={28} />
                <span>{displayName(m)}</span>
                <span className="opacity-50">@{m.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {emojiOpen && !recActive && (
        <div className="ec-emoji-grid ec-emoji-pop">
          {EMOJI_GRID.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setText((t) => t + e);
                ref.current?.focus();
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className={`ec-composer ${recActive ? "ec-composer-rec" : ""}`}>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.doc,.docx"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {holding && (
          <span
            className={`ec-lock ${lockArmed ? "ec-lock-on" : ""}`}
            style={{ transform: `translateY(${Math.max(slide.dy * 0.35, -30)}px)` }}
            aria-hidden
          >
            <Lock className="size-4" />
            <ChevronUp className="size-4" />
          </span>
        )}

        {!recActive && (
          <>
            <button
              type="button"
              className="ec-compbtn"
              aria-label="Attach a file"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(editing)}
            >
              <Paperclip className="size-5" />
            </button>

            <textarea
              ref={ref}
              value={text}
              rows={1}
              placeholder={editing ? "Edit your message…" : "Type a message…"}
              aria-label="Message"
              enterKeyHint="send"
              maxLength={4000}
              onChange={(e) => {
                setText(e.target.value);
                setCaret(e.target.selectionStart ?? e.target.value.length);
                if (!editing) onTyping();
              }}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
              onKeyDown={onKeyDown}
              onFocus={() => window.setTimeout(() => ref.current?.scrollIntoView({ block: "nearest" }), 250)}
            />

            <button
              type="button"
              className="ec-compbtn"
              aria-label="Emoji"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((o) => !o)}
            >
              <Smile className="size-5" />
            </button>
          </>
        )}

        {recActive && (
          <div className="ec-rec" role="status" aria-label="Recording voice message">
            <button
              type="button"
              className={`ec-rec-trash ${cancelArmed ? "ec-rec-trash-armed" : ""}`}
              aria-label="Discard recording"
              onClick={cancelVoice}
            >
              <Trash2 className="size-4" />
            </button>
            <span className={`ec-rec-dot ${rec.state === "paused" ? "ec-rec-dot-paused" : ""}`} aria-hidden />
            <span className="ec-rec-time">{fmtClock(rec.elapsedMs)}</span>
            <div className="ec-rec-wave" aria-hidden>
              {slots.map((v, i) => (
                <i key={i} style={{ height: `${Math.max(10, v * 100)}%` }} />
              ))}
            </div>
            {locked ? (
              <button
                type="button"
                className="ec-compbtn"
                onClick={rec.togglePause}
                aria-label={rec.state === "paused" ? "Resume recording" : "Pause recording"}
              >
                {rec.state === "paused" ? <Mic className="size-5" /> : <Pause className="size-5" />}
              </button>
            ) : (
              <span className="ec-rec-slide" style={{ opacity: Math.max(0.15, 1 + slide.dx / 110) }}>
                <ChevronLeft className="size-4" /> Slide to cancel
              </span>
            )}
          </div>
        )}

        {recActive || showMic ? (
          <button
            type="button"
            className={`ec-send ec-mic ${holding ? "ec-mic-hot" : ""}`}
            aria-label={recActive ? "Send voice message" : "Hold to record a voice message"}
            disabled={sending && !recActive}
            style={
              holding
                ? { transform: `translate(${slide.dx * 0.5}px, ${slide.dy * 0.5}px) scale(1.18)`, transition: "none" }
                : undefined
            }
            onPointerDown={onMicDown}
            onPointerMove={onMicMove}
            onPointerUp={onMicUp}
            onPointerCancel={onMicCancel}
            onKeyDown={onMicKey}
            onContextMenu={(e) => e.preventDefault()}
          >
            {sending && !recActive ? (
              <Loader2 className="size-5 animate-spin" />
            ) : recActive && locked ? (
              <Send className="size-5" style={{ marginLeft: -2 }} />
            ) : (
              <Mic className="size-5" />
            )}
          </button>
        ) : (
          <button
            type="button"
            className="ec-send"
            aria-label={editing ? "Save edit" : "Send message"}
            disabled={!canSend}
            onClick={() => void submit()}
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" style={{ marginLeft: -2 }} />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export default function EliteCommunity({ meId, meName }: { meId: string; meName: string }) {
  const chat = useEliteChat(meId);
  const { messages, members, memberIds, reads, online, urls, markRead, setActionError } = chat;

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [seenFor, setSeenFor] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [bustOk, setBustOk] = useState(true);
  const [viewport, setViewport] = useState<{ h: number; top: number } | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const initialisedRef = useRef(false);
  const lastIdRef = useRef<string | undefined>(undefined);
  const preserveRef = useRef<number | null>(null);

  /* ---------- derived data ---------- */

  const memberList = useMemo(
    () => memberIds.map((id) => members[id]).filter((m): m is Member => Boolean(m)),
    [memberIds, members],
  );

  const usernames = useMemo(() => {
    const s = new Set<string>();
    for (const m of Object.values(members)) if (m.username) s.add(m.username.toLowerCase());
    return s;
  }, [members]);

  const byId = useMemo(() => {
    const map = new Map<string, EliteMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // The last message I sent is where Instagram shows "Seen by".
  const lastMine = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m && m.user_id === meId && !m.deleted_at && !m.pending) return m;
    }
    return null;
  }, [messages, meId]);

  const seersOf = useCallback(
    (msg: EliteMessage): Member[] =>
      Object.entries(reads)
        .filter(([uid, at]) => uid !== msg.user_id && at >= msg.created_at)
        .map(([uid]) => members[uid] ?? { id: uid, username: null, full_name: null, avatar_url: null }),
    [reads, members],
  );

  const items = useMemo(() => {
    const out: { msg: EliteMessage; showHead: boolean; day: string | null; unread: boolean }[] = [];
    let lastDay = "";
    let prev: EliteMessage | undefined;
    let unreadPlaced = false;

    for (const m of messages) {
      const dayKey = new Date(m.created_at).toDateString();
      const newDay = dayKey !== lastDay;
      lastDay = dayKey;

      const showHead =
        newDay ||
        !prev ||
        prev.user_id !== m.user_id ||
        Boolean(prev.deleted_at) ||
        Boolean(m.reply_to) ||
        new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > GROUP_GAP_MS;

      let unread = false;
      if (!unreadPlaced && chat.initialRead && m.user_id !== meId && m.created_at > chat.initialRead) {
        unread = true;
        unreadPlaced = true;
      }

      out.push({ msg: m, showHead, day: newDay ? dayLabel(m.created_at) : null, unread });
      prev = m;
    }
    return out;
  }, [messages, chat.initialRead, meId]);

  const replyTo = replyToId ? byId.get(replyToId) ?? null : null;
  const editing = editingId ? byId.get(editingId) ?? null : null;
  const menuMsg = menu ? byId.get(menu.id) ?? null : null;
  const seenMsg = seenFor ? byId.get(seenFor) ?? null : null;

  const sharedMedia = useMemo(
    () =>
      messages
        .filter((m) => !m.deleted_at && m.attachment_path && urls[m.attachment_path] && !m.attachment_type?.startsWith("audio/"))
        .slice(-8)
        .reverse(),
    [messages, urls],
  );

  /* ---------- keyboard-safe height on phones ---------- */

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewport({ h: Math.round(vv.height), top: Math.round(vv.offsetTop) });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  /* ---------- scrolling ---------- */

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const { hasMore, loadingMore, loading, loadOlder } = chat;

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const bottom = dist < 140;
    atBottomRef.current = bottom;
    if (bottom) {
      setNewCount(0);
      if (document.visibilityState === "visible") markRead();
    }
    if (el.scrollTop < 80 && hasMore && !loadingMore && !loading) {
      preserveRef.current = el.scrollHeight;
      void loadOlder().then((ok) => {
        if (!ok) preserveRef.current = null;
      });
    }
  }, [hasMore, loadingMore, loading, loadOlder, markRead]);

  // Keep the viewport anchored after older messages are prepended.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (preserveRef.current !== null && el) {
      el.scrollTop += el.scrollHeight - preserveRef.current;
      preserveRef.current = null;
    }
  }, [messages]);

  // First paint jumps to the newest message, later ones scroll or show a pill.
  useLayoutEffect(() => {
    if (loading) return;
    const el = scrollerRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];

    if (!initialisedRef.current) {
      initialisedRef.current = true;
      el.scrollTop = el.scrollHeight;
      lastIdRef.current = last?.id;
      if (document.visibilityState === "visible") markRead();
      return;
    }

    if (!last || last.id === lastIdRef.current) return;
    lastIdRef.current = last.id;

    if (last.user_id === meId || atBottomRef.current) {
      scrollToBottom(true);
      if (last.user_id !== meId && document.visibilityState === "visible") markRead();
    } else {
      setNewCount((n) => n + 1);
    }
  }, [messages, loading, meId, markRead, scrollToBottom]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && atBottomRef.current) markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [markRead]);

  const onMedia = useCallback(() => {
    if (atBottomRef.current) scrollToBottom(false);
  }, [scrollToBottom]);

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ec-flash");
    window.setTimeout(() => el.classList.remove("ec-flash"), 1400);
  }, []);

  /* ---------- actions ---------- */

  const openMenu = useCallback((id: string, el: HTMLElement, mine: boolean) => {
    setMenu({ id, rect: el.getBoundingClientRect(), mine });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  useEffect(() => {
    if (!chat.actionError) return;
    const t = window.setTimeout(() => setActionError(null), 6000);
    return () => window.clearTimeout(t);
  }, [chat.actionError, setActionError]);

  const { send, sendVoice, notifyTyping } = chat;

  const handleSend = useCallback(
    async (text: string, file: File | null) => {
      const ok = await send({ body: text, replyTo: replyToId, file });
      if (ok) setReplyToId(null);
      return ok;
    },
    [send, replyToId],
  );

  const handleSendVoice = useCallback(
    async (clip: VoiceClip) => {
      const ok = await sendVoice(clip, replyToId);
      if (ok) setReplyToId(null);
      return ok;
    },
    [sendVoice, replyToId],
  );

  const handleTyping = useCallback(() => notifyTyping(meName), [notifyTyping, meName]);

  const typingText = useMemo(() => {
    const names = chat.typingNames;
    if (names.length === 0) return "";
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    return "Several people are typing";
  }, [chat.typingNames]);

  const onlineMembers = memberList.filter((m) => online.includes(m.id));
  const shownAvatars = memberList.slice(0, 3);
  const extra = Math.max(0, memberList.length - shownAvatars.length);
  const myMenuReaction = menuMsg?.reactions.find((r) => r.user_id === meId)?.emoji;

  /* ---------- render ---------- */

  return (
    <div className="ec-root" style={viewport ? { height: viewport.h, top: viewport.top } : undefined}>
      <style>{css}</style>
      <div className="ec-wood" aria-hidden />

      <div className="ec-shell">
        {/* ============ CENTER ============ */}
        <section className="ec-center">
          <header className="ec-top">
            <span className="ec-online-chip" aria-label={`${onlineMembers.length} members online`}>
              <i aria-hidden />
              {onlineMembers.length} online
            </span>

            <span className="ec-elite-pill">
              <Gem className="size-4" aria-hidden />
              ELITE
            </span>

            <button type="button" className="ec-iconbtn" aria-label="Group members" onClick={() => setMembersOpen(true)}>
              <Users className="size-5" />
            </button>
          </header>

          <div
            ref={scrollerRef}
            className="ec-scroll"
            onScroll={onScroll}
            role="log"
            aria-live="polite"
            aria-label="Elite group conversation"
          >
            {/* ---- banner ---- */}
            <div className="ec-banner">
              <span className="ec-banner-sheen" aria-hidden />
              {bustOk ? (
                <img
                  className="ec-bust"
                  src="/elite-bust.jpg"
                  alt=""
                  loading="eager"
                  onError={() => setBustOk(false)}
                />
              ) : (
                <ChromeGem />
              )}
              <div className="ec-banner-copy">
                <Gem className="ec-banner-gem" aria-hidden />
                <h1 className="ec-chrome-text ec-banner-title">AURA ELITE</h1>
                <span className="ec-banner-group">GROUP</span>
                <span className="ec-banner-rule" aria-hidden />
                <p className="ec-banner-tag">LEARN. DISCUSS. EVOLVE.</p>

                <button type="button" className="ec-members-pill" onClick={() => setMembersOpen(true)}>
                  <span className="ec-pill-avs">
                    {shownAvatars.map((m) => (
                      <Avatar key={m.id} member={m} size={30} />
                    ))}
                    {extra > 0 && <span className="ec-pill-more">+{extra}</span>}
                  </span>
                  <span className="ec-pill-text">{memberList.length || "…"} Members</span>
                  <ChevronRight className="size-4 opacity-70" aria-hidden />
                </button>
              </div>
            </div>

            {/* ---- history ---- */}
            <div className="ec-thread">
              {chat.error ? (
                <div className="ec-state">
                  <AlertCircle className="size-8 opacity-70" />
                  <p>We couldn’t open the conversation.</p>
                  <p className="text-xs opacity-60">{chat.error}</p>
                </div>
              ) : chat.loading ? (
                <div className="ec-skel-list" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="ec-skel-row">
                      <span className="ec-skel ec-skel-av" />
                      <span className="ec-skel-col">
                        <span className="ec-skel ec-skel-line" style={{ width: 120 }} />
                        <span className="ec-skel ec-skel-bubble" style={{ width: `${70 - i * 10}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {chat.hasMore && (
                    <div className="ec-older">
                      {chat.loadingMore ? <Loader2 className="size-4 animate-spin" /> : "Scroll up for earlier messages"}
                    </div>
                  )}

                  {messages.length === 0 && (
                    <div className="ec-state">
                      <Gem className="size-8 opacity-60" />
                      <p>Be the first to say something.</p>
                    </div>
                  )}

                  {items.map(({ msg, showHead, day, unread }) => {
                    const mine = msg.user_id === meId;
                    const replyMsg = msg.reply_to ? byId.get(msg.reply_to) : undefined;
                    const reply = msg.reply_to
                      ? {
                          name: replyMsg ? displayName(members[replyMsg.user_id]) : "Message",
                          text: replyMsg
                            ? replyMsg.deleted_at
                              ? "Deleted message"
                              : replyMsg.body || replyMsg.attachment_name || "Attachment"
                            : "Original message",
                        }
                      : null;

                    return (
                      <div key={msg.id}>
                        {day && (
                          <div className="ec-day">
                            <span>{day}</span>
                          </div>
                        )}
                        {unread && (
                          <div className="ec-unread" role="separator">
                            <span>New messages</span>
                          </div>
                        )}
                        <Row
                          meId={meId}
                          msg={msg}
                          mine={mine}
                          showHead={showHead}
                          author={members[msg.user_id]}
                          members={members}
                          reply={reply}
                          seers={lastMine && msg.id === lastMine.id ? seersOf(msg) : null}
                          url={msg.attachment_path ? urls[msg.attachment_path] : undefined}
                          usernames={usernames}
                          onMenu={openMenu}
                          onReact={chat.react}
                          onSeen={setSeenFor}
                          onJump={jumpTo}
                          onMedia={onMedia}
                        />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {newCount > 0 && (
            <button
              type="button"
              className="ec-newpill"
              onClick={() => {
                scrollToBottom(true);
                setNewCount(0);
                markRead();
              }}
            >
              <ArrowDown className="size-4" />
              {newCount} new {newCount === 1 ? "message" : "messages"}
            </button>
          )}

          <div className="ec-typing" aria-live="polite">
            {typingText && (
              <>
                <span className="ec-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                {typingText}
              </>
            )}
          </div>

          {chat.actionError && (
            <div className="ec-toast" role="alert">
              <AlertCircle className="size-4 shrink-0" />
              <span>{chat.actionError}</span>
              <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          )}

          <Composer
            members={memberList}
            sending={chat.sending}
            replyTo={replyTo}
            replyName={replyTo ? displayName(members[replyTo.user_id]) : ""}
            editing={editing && !editing.deleted_at ? editing : null}
            onCancelReply={() => setReplyToId(null)}
            onCancelEdit={() => setEditingId(null)}
            onSend={handleSend}
            onEditSubmit={chat.edit}
            onSendVoice={handleSendVoice}
            onTyping={handleTyping}
          />
        </section>

        {/* ============ RIGHT SIDEBAR (desktop) ============ */}
        <aside className="ec-right" aria-label="Group information">
          <section>
            <h2 className="ec-side-title">
              Online <span>{onlineMembers.length}</span>
            </h2>
            <ul className="ec-list">
              {onlineMembers.length === 0 && <li className="text-xs text-white/35">Nobody is online right now.</li>}
              {onlineMembers.map((m) => (
                <MemberRow key={m.id} m={m} online you={m.id === meId} />
              ))}
            </ul>
          </section>

          <section>
            <h2 className="ec-side-title">About</h2>
            <p className="text-xs leading-relaxed text-white/50">
              {memberList.length} Elite members. A private space to learn, discuss and evolve together.
            </p>
            <ul className="ec-rules">
              <li>Respect every member.</li>
              <li>Share knowledge, not noise.</li>
              <li>No spam, no ads, no leaks of Elite content.</li>
            </ul>
          </section>

          <section>
            <h2 className="ec-side-title">Shared media</h2>
            {sharedMedia.length === 0 ? (
              <p className="text-xs text-white/35">Images and files shared in the group appear here.</p>
            ) : (
              <div className="ec-media-grid">
                {sharedMedia.map((m) => {
                  const u = m.attachment_path ? urls[m.attachment_path] : undefined;
                  const img = m.attachment_type?.startsWith("image/");
                  return (
                    <a key={m.id} href={u} target="_blank" rel="noreferrer" title={m.attachment_name ?? ""}>
                      {img ? <img src={u} alt="" loading="lazy" /> : <FileText className="size-5" />}
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* ============ OVERLAYS ============ */}
      {menu && menuMsg && !menuMsg.deleted_at && (
        <MessageMenu
          state={menu}
          msg={menuMsg}
          myReaction={myMenuReaction}
          onClose={closeMenu}
          onReact={(e) => {
            void chat.react(menu.id, e);
            closeMenu();
          }}
          onReply={() => {
            setEditingId(null);
            setReplyToId(menu.id);
            closeMenu();
          }}
          onCopy={() => {
            void navigator.clipboard?.writeText(menuMsg.body);
            closeMenu();
          }}
          onEdit={() => {
            setReplyToId(null);
            setEditingId(menu.id);
            closeMenu();
          }}
          onDelete={() => {
            void chat.remove(menu.id);
            closeMenu();
          }}
        />
      )}

      {membersOpen && (
        <Sheet title={`Members (${memberList.length})`} onClose={() => setMembersOpen(false)}>
          <ul className="ec-list">
            {[...memberList]
              .sort((a, b) => Number(online.includes(b.id)) - Number(online.includes(a.id)))
              .map((m) => (
                <MemberRow key={m.id} m={m} online={online.includes(m.id)} you={m.id === meId} />
              ))}
          </ul>
        </Sheet>
      )}

      {seenMsg && (
        <Sheet title={`Seen by ${seersOf(seenMsg).length}`} onClose={() => setSeenFor(null)}>
          <ul className="ec-list">
            {seersOf(seenMsg).map((m) => (
              <MemberRow key={m.id} m={m} online={online.includes(m.id)} you={false} />
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const css = `
.ec-root{
  /* Height of YOUR root navbar. Change if the page sits too high/low. */
  --ec-nav: 72px;
  /* Set this to your mobile bottom-bar height if your root layout has one. */
  --ec-bottom: 0px;
  /* Brushed chrome rim: used for every metallic border. */
  --ec-rim: conic-gradient(from 200deg, #ffffff 0deg, #7b828e 55deg, #eef1f6 110deg, #3f444c 170deg, #cfd4dc 230deg, #ffffff 290deg, #6b717c 330deg, #ffffff 360deg);
  --ec-brush: repeating-linear-gradient(90deg, rgba(255,255,255,.028) 0 1px, transparent 1px 3px);

  position: fixed; left: 0; right: 0; top: 0; height: 100dvh; z-index: 10;
  padding-top: var(--ec-nav);
  color: #f3f4f6; background: #050505; overflow: hidden;
  font-family: inherit;
}
@media (min-width: 1024px){ .ec-root{ --ec-nav: 88px; } }

.ec-wood{
  position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,.08), transparent 60%),
    radial-gradient(90% 60% at 100% 100%, rgba(232,236,242,.06), transparent 60%),
    linear-gradient(180deg,#0b0b0b,#050505);
}
.ec-wood::after{
  content:""; position:absolute; inset:0; opacity:.5; mix-blend-mode:screen;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='700' height='700'><filter id='n' x='0' y='0' width='100%25' height='100%25'><feTurbulence type='fractalNoise' baseFrequency='0.004 0.11' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 .62  0 0 0 0 .55  0 0 0 0 .48  0 0 0 .5 -.2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-size:700px 700px;
}

.ec-shell{
  position:relative; height:100%; display:grid; grid-template-columns:minmax(0,1fr);
  padding-bottom: calc(var(--ec-bottom) + env(safe-area-inset-bottom, 0px));
}
.ec-right{ display:none; }
@media (min-width:1024px){
  .ec-shell{ grid-template-columns:minmax(0,1fr) 320px; gap:18px; padding:8px 20px 20px; max-width:1400px; margin:0 auto; }
  .ec-right,.ec-center{ border-radius:1.5rem; }
  .ec-right{
    display:flex; flex-direction:column; gap:24px; min-height:0; overflow-y:auto; padding:24px;
    border:1.5px solid transparent;
    background: var(--ec-brush) padding-box, linear-gradient(180deg,rgba(20,20,22,.94),rgba(8,8,9,.96)) padding-box, var(--ec-rim) border-box;
    box-shadow: 0 30px 70px -34px #000, 0 0 60px -36px rgba(232,236,242,.5), inset 0 1px 0 rgba(255,255,255,.1);
  }
  .ec-center{
    border:1.5px solid transparent; overflow:hidden;
    background: var(--ec-brush) padding-box, linear-gradient(180deg,rgba(15,15,16,.9),rgba(7,7,8,.94)) padding-box, var(--ec-rim) border-box;
    box-shadow: 0 30px 70px -34px #000, 0 0 60px -36px rgba(232,236,242,.5), inset 0 1px 0 rgba(255,255,255,.1);
  }
}
.ec-center{ position:relative; display:flex; flex-direction:column; min-height:0; min-width:0; }

/* ---- chrome text ---- */
.ec-chrome-text{
  background: linear-gradient(115deg,#7d8593 0%,#ffffff 24%,#aeb4bf 44%,#ffffff 58%,#7d8593 80%,#f1f5f9 100%);
  background-size:260% 100%; -webkit-background-clip:text; background-clip:text; color:transparent;
  filter: drop-shadow(0 1px 0 rgba(255,255,255,.25)) drop-shadow(0 6px 14px rgba(0,0,0,.6));
  animation: ec-shimmer 8s linear infinite;
}
@keyframes ec-shimmer{ 0%{background-position:200% 0} 100%{background-position:-200% 0} }

.ec-crown{
  display:inline-grid; place-items:center; width:44px; height:44px; border-radius:9999px; margin-bottom:10px; color:#eef1f5; flex-shrink:0;
  border:1.5px solid transparent;
  background: radial-gradient(circle at 30% 22%,rgba(255,255,255,.28),rgba(255,255,255,.03) 70%) padding-box, var(--ec-rim) border-box;
  box-shadow:0 0 26px -6px rgba(232,236,242,.6), inset 0 1px 0 rgba(255,255,255,.35);
}

/* ---- top bar ---- */
.ec-top{
  display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px 12px;
  border-bottom:1px solid transparent; border-image:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent) 1;
}
.ec-iconbtn{
  display:inline-grid; place-items:center; width:46px; height:46px; border-radius:9999px; color:#f1f5f9; cursor:pointer;
  border:1.5px solid transparent;
  background: radial-gradient(circle at 30% 20%,rgba(255,255,255,.18),rgba(255,255,255,.02) 70%) padding-box, linear-gradient(#0e0e0f,#0e0e0f) padding-box, var(--ec-rim) border-box;
  box-shadow: 0 6px 14px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.2);
  transition: transform .15s, box-shadow .2s, filter .2s;
}
.ec-iconbtn:hover{ filter:brightness(1.15); box-shadow:0 8px 18px rgba(0,0,0,.6),0 0 24px -6px rgba(232,236,242,.6), inset 0 1px 0 rgba(255,255,255,.3); }
.ec-iconbtn:active{ transform:translateY(1px) scale(.96); }
.ec-iconbtn-sm{ width:30px; height:30px; flex-shrink:0; }
.ec-elite-pill{
  display:inline-flex; align-items:center; gap:10px; padding:.7rem 1.7rem; border-radius:9999px;
  font-size:13px; font-weight:600; letter-spacing:.3em; color:#f5f7fa;
  border:1.5px solid transparent;
  background: linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.02)) padding-box, linear-gradient(#0b0b0c,#0b0b0c) padding-box, var(--ec-rim) border-box;
  box-shadow:0 8px 18px rgba(0,0,0,.55), 0 0 30px -8px rgba(232,236,242,.6), inset 0 1px 0 rgba(255,255,255,.28);
}
.ec-online-chip{
  display:inline-flex; align-items:center; gap:8px; min-width:46px; height:36px; padding:0 .9rem; border-radius:9999px; font-size:12px; color:rgba(255,255,255,.75);
  border:1px solid rgba(232,236,242,.22); background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.01)),#0a0a0b;
}
.ec-online-chip i{ width:8px; height:8px; border-radius:9999px; background:#6ee7a0; box-shadow:0 0 10px rgba(110,231,160,.9); }

/* ---- scroll area ---- */
.ec-scroll{
  flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; scroll-behavior:auto;
  padding:14px 14px 10px; -webkit-overflow-scrolling:touch;
}
@media (min-width:1024px){ .ec-scroll{ padding:16px 26px 10px; } }
.ec-scroll::-webkit-scrollbar{ width:8px; }
.ec-scroll::-webkit-scrollbar-thumb{ background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.08)); border-radius:9999px; }

/* ---- banner ---- */
.ec-banner{
  position:relative; overflow:hidden; border-radius:1.5rem; min-height:220px; display:flex; justify-content:flex-end;
  border:1.5px solid transparent;
  background:
    radial-gradient(80% 100% at 20% 0%,rgba(232,236,242,.12),transparent 60%) padding-box,
    var(--ec-brush) padding-box,
    linear-gradient(180deg,#101011,#060606) padding-box,
    var(--ec-rim) border-box;
  box-shadow: 0 24px 60px -28px rgba(0,0,0,.9), 0 0 70px -30px rgba(232,236,242,.55), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -20px 40px -30px rgba(255,255,255,.12);
}
.ec-banner::before{
  content:""; position:absolute; left:8%; right:8%; top:0; height:1px; z-index:2;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,1),transparent); filter:blur(.5px);
}
.ec-banner::after{
  content:""; position:absolute; left:14%; right:14%; bottom:0; height:1px; z-index:2;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);
}
.ec-banner-sheen{
  position:absolute; inset:0; z-index:2; pointer-events:none; mix-blend-mode:screen;
  background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.16) 50%,transparent 58%);
  background-size:260% 100%; background-position:150% 0; animation: ec-sheen 7s ease-in-out infinite;
}
@keyframes ec-sheen{ 0%,55%{ background-position:150% 0 } 100%{ background-position:-60% 0 } }
.ec-bust{
  position:absolute; left:0; top:0; height:100%; width:auto; max-width:58%; object-fit:cover; object-position:center top;
  -webkit-mask-image:linear-gradient(90deg,#000 55%,transparent 100%); mask-image:linear-gradient(90deg,#000 55%,transparent 100%);
}
.ec-gem-art{
  position:absolute; left:4%; top:50%; width:min(44%,230px); height:auto; transform:translateY(-50%);
  filter:drop-shadow(0 0 28px rgba(232,236,242,.45)) drop-shadow(0 18px 24px rgba(0,0,0,.7));
}
.ec-banner-copy{
  position:relative; z-index:1; width:56%; padding:18px 16px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
}
.ec-banner-gem{ width:26px; height:26px; color:#e8ecf2; filter:drop-shadow(0 0 10px rgba(232,236,242,.8)); margin-bottom:6px; }
.ec-banner-title{ font-family:"Cormorant Garamond",Georgia,serif; font-size:clamp(1.55rem,6.2vw,2.6rem); line-height:1; letter-spacing:.04em; font-weight:500; }
.ec-banner-group{ margin-top:6px; font-size:clamp(.8rem,3vw,1.1rem); letter-spacing:.55em; padding-left:.55em; color:#d6dae1; text-shadow:0 1px 0 rgba(255,255,255,.2), 0 4px 10px rgba(0,0,0,.6); }
.ec-banner-rule{ position:relative; width:70%; height:1px; margin:12px 0 10px; background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); }
.ec-banner-rule::after{ content:""; position:absolute; left:50%; top:50%; width:7px; height:7px; transform:translate(-50%,-50%) rotate(45deg); background:linear-gradient(135deg,#fff,#7d8593); box-shadow:0 0 10px rgba(255,255,255,.8); }
.ec-banner-tag{ font-size:clamp(.5rem,2vw,.72rem); letter-spacing:.3em; color:rgba(255,255,255,.7); }
.ec-members-pill{
  margin-top:14px; display:inline-flex; align-items:center; gap:10px; max-width:100%; padding:.35rem .8rem .35rem .4rem; border-radius:9999px; cursor:pointer; color:#e5e7eb;
  border:1.5px solid transparent;
  background: linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.02)) padding-box, linear-gradient(#0a0a0b,#0a0a0b) padding-box, var(--ec-rim) border-box;
  box-shadow:0 8px 18px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.22);
  transition: filter .2s, box-shadow .2s, transform .15s;
}
.ec-members-pill:hover{ filter:brightness(1.15); box-shadow:0 8px 18px rgba(0,0,0,.5),0 0 24px -6px rgba(232,236,242,.6); }
.ec-members-pill:active{ transform:scale(.98); }
.ec-pill-avs{ display:inline-flex; align-items:center; }
.ec-pill-avs .ec-avatar{ margin-left:-8px; box-shadow:0 0 0 2px #0b0b0c; }
.ec-pill-avs .ec-avatar:first-child{ margin-left:0; }
.ec-pill-more{ margin-left:-8px; display:inline-grid; place-items:center; width:30px; height:30px; border-radius:9999px; font-size:11px; background:#1b1b1d; box-shadow:0 0 0 2px #0b0b0c; }
.ec-pill-text{ font-size:12px; white-space:nowrap; opacity:.9; }
@media (min-width:1024px){ .ec-banner{ min-height:290px; } .ec-banner-copy{ width:52%; padding:28px; } }

/* ---- thread ---- */
.ec-thread{ padding-top:14px; }
.ec-older{ display:flex; justify-content:center; padding:6px; font-size:11px; letter-spacing:.12em; color:rgba(255,255,255,.35); }
.ec-day{ display:flex; align-items:center; gap:14px; margin:18px 0 12px; }
.ec-day::before,.ec-day::after{ content:""; flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,.3)); }
.ec-day::after{ background:linear-gradient(270deg,transparent,rgba(255,255,255,.3)); }
.ec-day span{
  padding:.4rem 1.4rem; border-radius:9999px; font-size:12px; color:rgba(255,255,255,.8);
  border:1.5px solid transparent;
  background: linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.01)) padding-box, linear-gradient(#0a0a0b,#0a0a0b) padding-box, var(--ec-rim) border-box;
}
.ec-unread{ display:flex; align-items:center; gap:12px; margin:14px 0 8px; }
.ec-unread::before,.ec-unread::after{ content:""; flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(232,236,242,.6)); }
.ec-unread::after{ background:linear-gradient(270deg,transparent,rgba(232,236,242,.6)); }
.ec-unread span{ font-size:10px; letter-spacing:.3em; text-transform:uppercase; color:#e8ecf2; text-shadow:0 0 12px rgba(232,236,242,.8); }

.ec-row{ display:flex; gap:12px; margin-top:4px; }
.ec-row.ec-head{ margin-top:16px; }
.ec-row.ec-mine{ justify-content:flex-end; }
.ec-av-col{ width:44px; flex-shrink:0; }
.ec-col{ min-width:0; max-width:min(78%,560px); display:flex; flex-direction:column; }
.ec-mine .ec-col{ align-items:flex-end; }
.ec-meta{ display:flex; align-items:center; gap:10px; margin:0 0 6px 2px; flex-wrap:wrap; }
.ec-name{ font-size:15px; font-weight:500; color:#f3f4f6; }
.ec-time{ margin-left:auto; font-size:11px; color:rgba(255,255,255,.4); }
.ec-time-mine{ margin:4px 4px 0; font-size:11px; color:rgba(255,255,255,.38); }

.ec-bubble-wrap{ position:relative; max-width:100%; padding-bottom:0; }
.ec-bubble-wrap:has(.ec-reacts){ padding-bottom:14px; }
.ec-bubble{
  position:relative; max-width:100%; padding:.8rem 1rem; border-radius:1.15rem; touch-action:manipulation; -webkit-touch-callout:none;
  border:1px solid rgba(255,255,255,.1);
  background:linear-gradient(180deg,#1f1f22 0%,#111112 100%);
  box-shadow:0 10px 22px -12px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.1), inset 0 -1px 0 rgba(0,0,0,.6);
  overflow-wrap:anywhere;
}
.ec-bubble::before{
  content:""; position:absolute; left:6px; right:6px; top:1px; height:42%; border-radius:1rem 1rem 60% 60% / 1rem 1rem 30% 30%;
  background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,0)); pointer-events:none;
}
.ec-bubble-mine{
  border:1.5px solid transparent;
  background: linear-gradient(180deg,#34353b 0%,#18191c 100%) padding-box, var(--ec-rim) border-box;
  box-shadow:0 10px 22px -12px rgba(0,0,0,.9), 0 0 30px -14px rgba(232,236,242,.6), inset 0 1px 0 rgba(255,255,255,.2);
}
.ec-bubble-mine::before{ background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0)); }
.ec-pending{ opacity:.6; }
.ec-text{ position:relative; font-size:15px; line-height:1.5; color:#f3f4f6; white-space:pre-wrap; }
.ec-mention{ color:#e8ecf2; font-weight:600; text-shadow:0 0 12px rgba(232,236,242,.6); }
.ec-edited{ position:relative; display:block; margin-top:4px; text-align:right; font-size:10px; font-style:italic; letter-spacing:.06em; color:rgba(255,255,255,.45); }
.ec-tomb{ padding:.55rem .9rem; border-radius:9999px; font-size:12px; font-style:italic; color:rgba(255,255,255,.35); border:1px dashed rgba(255,255,255,.14); }

.ec-quote{
  position:relative; display:block; width:100%; text-align:left; margin-bottom:8px; padding:.45rem .7rem; border-radius:.7rem; cursor:pointer;
  background:rgba(255,255,255,.05); border-left:2px solid rgba(232,236,242,.65);
}
.ec-quote-name{ display:block; font-size:11px; font-weight:600; color:#e8ecf2; }
.ec-quote-text{ display:block; font-size:12px; color:rgba(255,255,255,.55); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:260px; }
.ec-img-link{ position:relative; display:block; margin-bottom:6px; overflow:hidden; border-radius:.8rem; }
.ec-img-link img{ display:block; max-width:min(100%,320px); max-height:320px; border-radius:.8rem; object-fit:cover; }
.ec-img-skel{ display:block; width:240px; height:160px; border-radius:.8rem; background:rgba(255,255,255,.06); }
.ec-file{ position:relative; display:flex; align-items:center; gap:10px; padding:.6rem .8rem; margin-bottom:6px; border-radius:.8rem; font-size:13px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); }

.ec-more{
  position:absolute; top:50%; transform:translateY(-60%); display:none; place-items:center; width:30px; height:30px; border-radius:9999px; color:#e5e7eb; cursor:pointer;
  border:1px solid rgba(232,236,242,.3); background:#0c0c0d; box-shadow:0 4px 10px rgba(0,0,0,.5);
}
.ec-row:not(.ec-mine) .ec-more{ left:calc(100% + 8px); }
.ec-mine .ec-more{ right:calc(100% + 8px); }
@media (hover:hover){ .ec-bubble-wrap:hover .ec-more{ display:grid; } }

.ec-reacts{ position:absolute; bottom:-2px; left:10px; display:flex; gap:4px; z-index:1; }
.ec-mine .ec-reacts{ left:auto; right:10px; }
.ec-react{
  display:inline-flex; align-items:center; gap:5px; padding:.12rem .5rem; border-radius:9999px; font-size:12px; color:#e5e7eb; cursor:pointer;
  border:1px solid rgba(232,236,242,.28); background:linear-gradient(180deg,#19191b,#0b0b0c); box-shadow:0 4px 10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.1);
  transition: transform .15s, border-color .2s; animation: ec-react-in .28s cubic-bezier(.2,1.4,.4,1);
}
.ec-react:hover{ transform:scale(1.08); }
.ec-react-on{ border-color:rgba(255,255,255,.8); background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.05)),#0d0d0e; box-shadow:0 0 18px -4px rgba(232,236,242,.7), inset 0 1px 0 rgba(255,255,255,.25); }
@keyframes ec-react-in{ from{ transform:scale(.4); opacity:0 } to{ transform:scale(1); opacity:1 } }

.ec-seen{ display:inline-flex; align-items:center; gap:6px; margin:4px 4px 0; font-size:11px; color:rgba(255,255,255,.55); cursor:pointer; }
.ec-seen:hover{ color:#fff; }
.ec-seen-avs{ display:inline-flex; }
.ec-seen-avs .ec-avatar{ margin-left:-5px; box-shadow:0 0 0 1px #0b0b0c; }
.ec-seen-avs .ec-avatar:first-child{ margin-left:0; }

.ec-pop{ animation: ec-pop .38s cubic-bezier(.22,1,.36,1); }
@keyframes ec-pop{ from{ opacity:0; transform:translateY(12px) scale(.97) } to{ opacity:1; transform:none } }
.ec-flash .ec-bubble{ animation: ec-flash 1.4s ease; }
@keyframes ec-flash{ 0%,100%{ box-shadow:none } 30%{ box-shadow:0 0 0 2px rgba(232,236,242,.8), 0 0 34px rgba(232,236,242,.6) } }

/* ---- avatar / badges ---- */
.ec-avatar{
  position:relative; display:inline-grid; place-items:center; flex-shrink:0; border-radius:9999px; padding:2px; color:#e5e7eb;
  background:var(--ec-rim); box-shadow:0 4px 10px rgba(0,0,0,.55), 0 0 14px -6px rgba(232,236,242,.6);
}
.ec-avatar-in{
  display:grid; place-items:center; width:100%; height:100%; border-radius:9999px; overflow:hidden;
  background:radial-gradient(circle at 30% 25%,#3a3b40,#16171a);
}
.ec-avatar-in img{ width:100%; height:100%; object-fit:cover; }
.ec-avatar-gem{ position:absolute; right:-3px; bottom:-3px; display:grid; place-items:center; width:18px; height:18px; border-radius:9999px; color:#f1f5f9; background:#17181b; border:1px solid rgba(232,236,242,.6); }
.ec-online{ position:absolute; right:0; top:0; width:10px; height:10px; border-radius:9999px; background:#6ee7a0; border:2px solid #0b0b0c; box-shadow:0 0 10px rgba(110,231,160,.8); }
.ec-badge{
  display:inline-flex; align-items:center; gap:5px; padding:.12rem .6rem; border-radius:9999px; font-size:11px; color:#eef1f5;
  border:1px solid transparent;
  background: linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.02)) padding-box, linear-gradient(#0b0b0c,#0b0b0c) padding-box, var(--ec-rim) border-box;
}
.ec-badge-sm{ padding:.05rem .5rem; }

/* ---- typing + toast + new pill ---- */
.ec-typing{ min-height:22px; display:flex; align-items:center; gap:8px; padding:0 22px; font-size:12px; color:rgba(255,255,255,.55); }
.ec-dots{ display:inline-flex; gap:3px; }
.ec-dots i{ width:5px; height:5px; border-radius:9999px; background:#e8ecf2; opacity:.35; animation: ec-dot 1.1s infinite; }
.ec-dots i:nth-child(2){ animation-delay:.18s } .ec-dots i:nth-child(3){ animation-delay:.36s }
@keyframes ec-dot{ 0%,80%,100%{ opacity:.25; transform:translateY(0) } 40%{ opacity:1; transform:translateY(-3px) } }
.ec-toast{ display:flex; align-items:center; gap:10px; margin:0 16px 8px; padding:.6rem .8rem; border-radius:.9rem; font-size:12px; color:#fecaca; background:rgba(127,29,29,.25); border:1px solid rgba(248,113,113,.35); }
.ec-toast span{ flex:1; }
.ec-newpill{
  position:absolute; left:50%; transform:translateX(-50%); bottom:128px; z-index:5; display:inline-flex; align-items:center; gap:8px; padding:.55rem 1rem; border-radius:9999px; font-size:12px; color:#0b0b0c; cursor:pointer;
  background:linear-gradient(180deg,#fff,#b9bec7); box-shadow:0 10px 24px rgba(0,0,0,.6), 0 0 26px -4px rgba(232,236,242,.7), inset 0 1px 0 #fff;
  animation: ec-pop .3s ease;
}

/* ---- composer ---- */
.ec-composer-wrap{ position:relative; flex-shrink:0; padding:0 14px 12px; }
@media (min-width:1024px){ .ec-composer-wrap{ padding:0 26px 22px; } }
.ec-composer{
  display:flex; align-items:center; gap:6px; padding:5px 5px 5px 8px; border-radius:9999px;
  border:1.5px solid transparent;
  background: linear-gradient(180deg,#141415,#09090a) padding-box, var(--ec-rim) border-box;
  box-shadow:0 14px 30px -14px rgba(0,0,0,.9), inset 0 2px 8px rgba(0,0,0,.65);
}
.ec-composer textarea{
  flex:1; min-width:0; resize:none; background:transparent; color:#f3f4f6; font-size:16px; line-height:1.4; padding:.7rem .4rem; max-height:132px; outline:none; border:0;
}
.ec-composer textarea::placeholder{ color:rgba(255,255,255,.35); }
.ec-composer:focus-within{ box-shadow:0 14px 30px -14px rgba(0,0,0,.9), inset 0 2px 8px rgba(0,0,0,.65), 0 0 36px -8px rgba(232,236,242,.6); }
.ec-compbtn{ display:inline-grid; place-items:center; width:40px; height:40px; border-radius:9999px; color:rgba(255,255,255,.7); cursor:pointer; flex-shrink:0; transition: color .2s, background .2s; }
.ec-compbtn:hover:not(:disabled){ color:#fff; background:rgba(255,255,255,.08); }
.ec-compbtn:disabled{ opacity:.3; cursor:not-allowed; }
.ec-send{
  position:relative; display:grid; place-items:center; width:54px; height:54px; border-radius:9999px; cursor:pointer; flex-shrink:0; color:#101012; overflow:hidden;
  border:2px solid transparent;
  background: radial-gradient(circle at 32% 22%,#ffffff 0%,#e0e4ea 20%,#98a0ab 55%,#4b5058 100%) padding-box, var(--ec-rim) border-box;
  box-shadow:0 1px 0 rgba(255,255,255,.95) inset, 0 -7px 12px rgba(0,0,0,.35) inset, 0 10px 18px rgba(0,0,0,.7), 0 0 28px -6px rgba(232,236,242,.7);
  transition: transform .15s, box-shadow .15s, filter .2s;
}
.ec-send::after{ content:""; position:absolute; left:14%; right:14%; top:6%; height:38%; border-radius:9999px; background:linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,0)); pointer-events:none; }
.ec-send:hover:not(:disabled){ filter:brightness(1.1); transform:translateY(-1px); }
.ec-send:active:not(:disabled){ transform:translateY(2px) scale(.96); box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 -4px 8px rgba(0,0,0,.4) inset, 0 3px 8px rgba(0,0,0,.7), 0 0 18px -6px rgba(232,236,242,.5); }
.ec-send:disabled{ opacity:.45; filter:grayscale(.5); cursor:not-allowed; }

.ec-ctx{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; padding:.5rem .8rem; border-radius:.9rem; background:rgba(255,255,255,.05); border-left:2px solid rgba(232,236,242,.7); }
.ec-ctx-title{ display:block; font-size:11px; font-weight:600; color:#e8ecf2; }
.ec-ctx-text{ display:block; font-size:12px; color:rgba(255,255,255,.5); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec-attach-preview{ display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:.45rem .6rem; border-radius:.9rem; font-size:12px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); }
.ec-attach-preview img{ width:38px; height:38px; border-radius:.5rem; object-fit:cover; }
.ec-attach-preview span{ flex:1; min-width:0; }
.ec-inline-error{ margin-bottom:6px; font-size:12px; color:#fca5a5; }

.ec-mentions{ position:absolute; left:20px; right:20px; bottom:100%; margin-bottom:6px; z-index:6; padding:6px; border-radius:1rem; background:#0c0c0d; border:1px solid rgba(232,236,242,.35); box-shadow:0 18px 40px rgba(0,0,0,.7); }
.ec-mentions button{ display:flex; align-items:center; gap:10px; width:100%; padding:.45rem .6rem; border-radius:.7rem; font-size:13px; text-align:left; cursor:pointer; }
.ec-mentions button:hover{ background:rgba(255,255,255,.08); }

.ec-emoji-grid{ display:grid; grid-template-columns:repeat(6,1fr); gap:2px; }
.ec-emoji-grid button{ font-size:22px; padding:.4rem; border-radius:.6rem; cursor:pointer; transition: transform .12s, background .2s; }
.ec-emoji-grid button:hover{ background:rgba(255,255,255,.1); transform:scale(1.15); }
.ec-emoji-pop{ position:absolute; right:14px; bottom:100%; margin-bottom:8px; z-index:6; width:min(320px,calc(100% - 28px)); padding:8px; border-radius:1rem; background:#0c0c0d; border:1px solid rgba(232,236,242,.35); box-shadow:0 18px 40px rgba(0,0,0,.7); }
.ec-menu-grid{ margin-top:6px; padding:6px; border-radius:1rem; background:#0c0c0d; border:1px solid rgba(232,236,242,.3); }

/* ---- message menu ---- */
.ec-menu-layer{ position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.5); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); }
.ec-menu{ position:fixed; animation: ec-pop .2s ease; }
.ec-emoji-bar{
  display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-radius:9999px;
  border:1.5px solid transparent;
  background: linear-gradient(180deg,#1c1c1e,#0b0b0c) padding-box, var(--ec-rim) border-box;
  box-shadow:0 18px 40px rgba(0,0,0,.7), 0 0 30px -10px rgba(232,236,242,.6);
}
.ec-emoji-btn{ display:grid; place-items:center; width:40px; height:40px; border-radius:9999px; font-size:24px; color:#e5e7eb; cursor:pointer; transition: transform .15s, background .2s; }
.ec-emoji-btn:hover{ transform:scale(1.25) translateY(-3px); }
.ec-emoji-on{ background:rgba(255,255,255,.16); box-shadow:0 0 18px -4px rgba(232,236,242,.8); }
.ec-actions{
  margin-top:8px; padding:6px; border-radius:1.1rem; border:1.5px solid transparent;
  background: linear-gradient(180deg,#19191b,#0a0a0b) padding-box, var(--ec-rim) border-box; box-shadow:0 18px 40px rgba(0,0,0,.7);
}
.ec-actions > button{ display:flex; align-items:center; gap:12px; width:100%; padding:.7rem .9rem; border-radius:.8rem; font-size:14px; text-align:left; color:#f3f4f6; cursor:pointer; }
.ec-actions > button:hover{ background:rgba(255,255,255,.08); }
.ec-danger{ color:#fca5a5 !important; }
.ec-confirm{ padding:.7rem .9rem; font-size:13px; }
.ec-confirm div{ display:flex; gap:8px; margin-top:10px; justify-content:flex-end; }
.ec-confirm button{ padding:.5rem 1rem; border-radius:9999px; font-size:13px; border:1px solid rgba(255,255,255,.2); cursor:pointer; }
.ec-confirm .ec-danger{ background:rgba(127,29,29,.35); border-color:rgba(248,113,113,.5); }

/* ---- sheets ---- */
.ec-sheet-layer{ position:fixed; inset:0; z-index:60; display:flex; align-items:flex-end; justify-content:center; background:rgba(0,0,0,.6); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); }
@media (min-width:640px){ .ec-sheet-layer{ align-items:center; } }
.ec-sheet{
  width:min(100%,440px); max-height:78dvh; display:flex; flex-direction:column; border-radius:1.5rem 1.5rem 0 0; animation: ec-sheet .3s cubic-bezier(.22,1,.36,1);
  border:1.5px solid transparent;
  background: var(--ec-brush) padding-box, linear-gradient(180deg,#161617,#080809) padding-box, var(--ec-rim) border-box;
  box-shadow:0 -20px 60px rgba(0,0,0,.7), 0 0 60px -30px rgba(232,236,242,.5);
  padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (min-width:640px){ .ec-sheet{ border-radius:1.5rem; } }
@keyframes ec-sheet{ from{ transform:translateY(40px); opacity:0 } to{ transform:none; opacity:1 } }
.ec-sheet-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 20px 12px; border-bottom:1px solid transparent; border-image:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent) 1; }
.ec-sheet-head h2{ font-size:12px; letter-spacing:.3em; text-transform:uppercase; color:#e8ecf2; }
.ec-sheet-body{ overflow-y:auto; padding:8px 14px 18px; }

.ec-list{ display:flex; flex-direction:column; gap:4px; }
.ec-member{ display:flex; align-items:center; gap:12px; padding:.5rem .4rem; border-radius:.8rem; }
.ec-you{ opacity:.45; }
.ec-side-title{
  display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding-bottom:10px;
  font-size:11px; letter-spacing:.3em; text-transform:uppercase; color:rgba(255,255,255,.55);
  border-bottom:1px solid transparent; border-image:linear-gradient(90deg,rgba(255,255,255,.5),transparent) 1;
}
.ec-side-title span{ color:#e8ecf2; }
.ec-rules{ margin-top:12px; display:flex; flex-direction:column; gap:8px; font-size:12px; color:rgba(255,255,255,.55); }
.ec-rules li{ position:relative; padding-left:16px; }
.ec-rules li::before{ content:""; position:absolute; left:2px; top:.5em; width:6px; height:6px; transform:rotate(45deg); background:linear-gradient(135deg,#fff,#7d8593); box-shadow:0 0 8px rgba(255,255,255,.6); }
.ec-media-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
.ec-media-grid a{ display:grid; place-items:center; aspect-ratio:1; overflow:hidden; border-radius:.7rem; background:rgba(255,255,255,.05); border:1px solid rgba(232,236,242,.2); }
.ec-media-grid img{ width:100%; height:100%; object-fit:cover; }

/* ---- states ---- */
.ec-state{ display:flex; flex-direction:column; align-items:center; gap:10px; padding:48px 20px; text-align:center; font-size:14px; color:rgba(255,255,255,.6); }
.ec-skel{ display:block; border-radius:.8rem; background:linear-gradient(100deg,rgba(255,255,255,.04) 30%,rgba(255,255,255,.12) 50%,rgba(255,255,255,.04) 70%); background-size:200% 100%; animation: ec-skel 1.5s linear infinite; }
@keyframes ec-skel{ 0%{background-position:-200% 0} 100%{background-position:200% 0} }
.ec-skel-list{ display:flex; flex-direction:column; gap:22px; padding-top:8px; }
.ec-skel-row{ display:flex; gap:12px; }
.ec-skel-av{ width:44px; height:44px; border-radius:9999px; flex-shrink:0; }
.ec-skel-col{ display:flex; flex-direction:column; gap:8px; flex:1; }
.ec-skel-line{ height:12px; } .ec-skel-bubble{ height:54px; }

/* ---- voice messages: player ---- */
.ec-bubble-voice{ padding:.55rem .8rem .55rem .55rem; }
.ec-voice{ position:relative; display:flex; align-items:center; gap:10px; width:min(270px,66vw); }
.ec-voice-play{
  display:grid; place-items:center; width:38px; height:38px; border-radius:9999px; flex-shrink:0; cursor:pointer; color:#101012;
  border:1.5px solid transparent;
  background: radial-gradient(circle at 32% 22%,#fff 0%,#e0e4ea 25%,#98a0ab 65%,#565c66 100%) padding-box, var(--ec-rim) border-box;
  box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 -4px 8px rgba(0,0,0,.3) inset, 0 6px 12px rgba(0,0,0,.6);
  transition: transform .15s, filter .2s;
}
.ec-voice-play:hover:not(:disabled){ filter:brightness(1.1); }
.ec-voice-play:active:not(:disabled){ transform:scale(.94); }
.ec-voice-play:disabled{ opacity:.45; cursor:not-allowed; }
.ec-voice-wave{ position:relative; flex:1; min-width:0; height:32px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; touch-action:none; user-select:none; }
.ec-voice-wave i{ display:block; width:3px; flex:none; border-radius:9999px; background:rgba(255,255,255,.27); transition:background .12s; }
.ec-voice-wave i.on{ background:linear-gradient(180deg,#ffffff,#b4bac5); box-shadow:0 0 8px rgba(255,255,255,.35); }
.ec-voice-time{ min-width:34px; text-align:right; font-size:12px; font-variant-numeric:tabular-nums; color:rgba(255,255,255,.78); }
.ec-voice-speed{
  flex-shrink:0; padding:.12rem .5rem; border-radius:9999px; font-size:11px; font-weight:600; color:#eef1f5; cursor:pointer;
  border:1px solid rgba(232,236,242,.4); background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.03)),#0b0b0c;
}
.ec-voice-fail .ec-voice-time{ color:#fca5a5; }
.ec-voice-fail .ec-voice-wave{ opacity:.45; }

/* ---- voice messages: recorder ---- */
.ec-composer{ position:relative; }
.ec-composer-rec{ border-color:transparent; }
.ec-rec{ flex:1; min-width:0; display:flex; align-items:center; gap:10px; height:48px; padding:0 6px 0 3px; }
.ec-rec-trash{
  display:grid; place-items:center; width:36px; height:36px; border-radius:9999px; flex-shrink:0; cursor:pointer; color:#e5e7eb;
  border:1px solid rgba(232,236,242,.3); background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.02)),#0b0b0c;
  transition:color .15s, border-color .15s, background .15s, transform .15s;
}
.ec-rec-trash-armed{ color:#fecaca; border-color:rgba(248,113,113,.8); background:rgba(127,29,29,.5); transform:scale(1.12); }
.ec-rec-dot{ width:10px; height:10px; border-radius:9999px; flex-shrink:0; background:#ef4444; box-shadow:0 0 12px rgba(239,68,68,.9); animation: ec-rec-pulse 1.1s ease-in-out infinite; }
.ec-rec-dot-paused{ animation:none; background:#6b7280; box-shadow:none; }
@keyframes ec-rec-pulse{ 0%,100%{ opacity:1; transform:scale(1) } 50%{ opacity:.35; transform:scale(.8) } }
.ec-rec-time{ min-width:38px; font-size:15px; font-variant-numeric:tabular-nums; color:#fff; }
.ec-rec-wave{ flex:1; min-width:0; height:30px; display:flex; align-items:center; justify-content:flex-end; gap:2px; overflow:hidden; }
.ec-rec-wave i{ display:block; width:3px; flex:none; border-radius:9999px; background:linear-gradient(180deg,#ffffff,#8f97a4); transition:height .08s linear; }
.ec-rec-slide{ display:inline-flex; align-items:center; gap:2px; flex-shrink:0; font-size:12px; color:rgba(255,255,255,.65); white-space:nowrap; }
@media (max-width:380px){ .ec-rec-slide{ display:none; } }

.ec-mic{ touch-action:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
.ec-mic-hot{
  z-index:3;
  background: radial-gradient(circle at 32% 22%,#ffffff 0%,#ffd5d5 22%,#e25555 58%,#7f1d1d 100%) padding-box, var(--ec-rim) border-box;
  box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 10px 22px rgba(0,0,0,.7), 0 0 34px -2px rgba(239,68,68,.7);
}
.ec-lock{
  position:absolute; right:7px; bottom:calc(100% + 10px); z-index:2; width:44px; height:84px; border-radius:9999px;
  display:flex; flex-direction:column; align-items:center; justify-content:space-around; padding:10px 0; color:rgba(255,255,255,.75); pointer-events:none;
  border:1.5px solid transparent;
  background: linear-gradient(180deg,#1c1c1e,#0a0a0b) padding-box, var(--ec-rim) border-box;
  box-shadow:0 14px 30px rgba(0,0,0,.7), 0 0 24px -8px rgba(232,236,242,.6);
  animation: ec-pop .2s ease;
}
.ec-lock-on{ color:#fff; box-shadow:0 14px 30px rgba(0,0,0,.7), 0 0 34px -4px rgba(232,236,242,.9); }

.ec-root a:focus-visible,.ec-root button:focus-visible,.ec-root textarea:focus-visible{ outline:2px solid rgba(232,236,242,.85); outline-offset:2px; }

@media (prefers-reduced-motion: reduce){
  .ec-root *, .ec-root *::before, .ec-root *::after{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
}
`;