import { createSignal, Show } from "solid-js";
import { getImageUrl } from "~/lib/jellyfin";
import { Music } from "lucide-solid";
import TrackBottomSheet from "./TrackBottomSheet";
import type { Audio } from "~/lib/types";

interface Props {
  track: Audio;
  index: number;
  isActive: boolean;
  onClick: () => void;
  playlistId?: string;
}

export default function TrackRowCard(props: Props) {
  const [showSheet, setShowSheet] = createSignal(false);
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  let isLongPress = false;

  function handleTouchStart() {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      navigator.vibrate?.(10);
      setShowSheet(true);
    }, 500);
  }

  function handleTouchEnd(e: TouchEvent) {
    clearTimeout(longPressTimer);
    if (isLongPress) {
      e.preventDefault();
    }
  }

  function handleTouchMove() {
    clearTimeout(longPressTimer);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    setShowSheet(true);
  }

  function handleClick(e: MouseEvent) {
    if (isLongPress) {
      isLongPress = false;
      return;
    }
    props.onClick();
  }

  const coverUrl = props.track.AlbumId || props.track.Id;
  const hasCover = props.track.AlbumPrimaryImageTag || props.track.ImageTags?.Primary;

  return (
    <>
      <button
        type="button"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors select-none w-full text-left cursor-pointer active:scale-[0.97] active:opacity-80"
        classList={{
          "bg-[#1db954]/10": props.isActive,
          "hover:bg-[#1a1a1a]": true,
        }}
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
        ontouchmove={handleTouchMove}
        oncontextmenu={handleContextMenu}
        onClick={handleClick}
      >
        <div class="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 relative">
          <div class="absolute inset-0 bg-[#2a2a2a] animate-pulse rounded-md" />
          {hasCover ? (
            <img
              src={getImageUrl(coverUrl, "Primary", 60)}
              alt=""
              class="w-full h-full object-cover relative"
              style="opacity: 0"
              onLoad={(e) => {
                const img = e.currentTarget;
                img.style.opacity = "1";
                const skeleton = img.parentElement?.firstElementChild as HTMLElement | null;
                if (skeleton) skeleton.style.display = "none";
              }}
            />
          ) : (
            <div class="w-full h-full flex items-center justify-center relative bg-[#333] rounded-md">
              <Music size={16} class="text-[#555]" />
            </div>
          )}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate" classList={{ "text-[#1db954]": props.isActive, "text-white": !props.isActive }}>
            {props.track.Name}
          </p>
          <p class="text-xs text-[#888] truncate mt-0.5">
            {props.track.ArtistItems?.[0]?.Name || props.track.Artists?.join(", ") || props.track.AlbumArtist || ""}
          </p>
        </div>
        <span class="text-xs text-[#555] tabular-nums flex-shrink-0">{formatMobileDuration(props.track.RunTimeTicks)}</span>
      </button>

      {showSheet() && (
        <TrackBottomSheet
          track={props.track}
          playlistId={props.playlistId}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
  );
}

function formatMobileDuration(ticks?: number): string {
  if (!ticks) return "0:00";
  const totalSeconds = ticks / 10000000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
