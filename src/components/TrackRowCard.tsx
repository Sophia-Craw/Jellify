import { createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
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

  function handleTouchStart(e: TouchEvent) {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      navigator.vibrate?.(10);
      setShowSheet(true);
    }, 500);
  }

  function handleTouchEnd(e: TouchEvent) {
    clearTimeout(longPressTimer);
    if (!isLongPress) {
      props.onClick();
    }
  }

  function handleTouchMove() {
    clearTimeout(longPressTimer);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    setShowSheet(true);
  }

  const coverUrl = props.track.AlbumId || props.track.Id;
  const hasCover = props.track.AlbumPrimaryImageTag || props.track.ImageTags?.Primary;

  return (
    <>
      <div
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors select-none"
        classList={{
          "bg-[#1db954]/10": props.isActive,
          "hover:bg-[#1a1a1a]": true,
        }}
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
        ontouchmove={handleTouchMove}
        oncontextmenu={handleContextMenu}
      >
        <div class="w-10 h-10 rounded-md bg-[#333] overflow-hidden flex items-center justify-center flex-shrink-0">
          {hasCover ? (
            <img src={getImageUrl(coverUrl, "Primary", 60)} alt="" class="w-full h-full object-cover" />
          ) : (
            <Music size={16} class="text-[#555]" />
          )}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate" classList={{ "text-[#1db954]": props.isActive, "text-white": !props.isActive }}>
            {props.track.Name}
          </p>
          <p class="text-xs text-[#888] truncate mt-0.5">
            {props.track.ArtistItems?.[0] ? (
              <A href={`/artist/${props.track.ArtistItems[0].Id}`} class="hover:underline">
                {props.track.ArtistItems[0].Name}
              </A>
            ) : (
              props.track.Artists?.join(", ") || props.track.AlbumArtist || ""
            )}
          </p>
        </div>
        <span class="text-xs text-[#555] tabular-nums flex-shrink-0">{formatMobileDuration(props.track.RunTimeTicks)}</span>
      </div>

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
