import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { A } from "@solidjs/router";
import { usePlayer } from "~/stores/player";
import { getImageUrl, makeSlug } from "~/lib/jellyfin";
import MarqueeText from "./MarqueeText";
import { playerExpanded, setPlayerExpanded, setPlayerBgColor, playerBgColor } from "~/lib/mobileHeader";
import { extractDominantColor } from "~/lib/colorExtractor";
import { getOutputDeviceName, clearOutputDeviceCache } from "~/lib/jellify-player";
import { isCapacitor } from "~/lib/capacitor";
import {
  Music, ChevronDown, MoreHorizontal, Shuffle, SkipBack,
  Play, Pause, SkipForward, Repeat, Repeat1, ListMusic, Plus, Volume2
} from "lucide-solid";
import AddToPlaylistDialog from "./AddToPlaylistDialog";
import TrackBottomSheet from "./TrackBottomSheet";

export default function MobilePlayer() {
  const player = usePlayer();
  const { state, currentTrack } = player;
  const [dragY, setDragY] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  const [showTrackOptions, setShowTrackOptions] = createSignal(false);
  const [showSaveQueue, setShowSaveQueue] = createSignal(false);
  const [showQueue, setShowQueue] = createSignal(false);
  const [queueClosing, setQueueClosing] = createSignal(false);
  const [queueRemoved, setQueueRemoved] = createSignal(true);

  let startY = 0;
  let startX = 0;
  let coverStartX = 0;
  let fullPlayerRef: HTMLDivElement | undefined;
  const [coverX, setCoverX] = createSignal(0);
  const [coverAnimating, setCoverAnimating] = createSignal(false);

  const track = currentTrack;

  createEffect(() => {
    const t = track();
    if (!t) { setPlayerBgColor(""); return; }
    const url = getImageUrl(t.AlbumId || t.Id, "Primary", 60);
    extractDominantColor(url).then(setPlayerBgColor);
  });

  const [outputDeviceName, setOutputDeviceName] = createSignal("");

  onCleanup(() => {
    clearOutputDeviceCache();
  });

  if (isCapacitor()) {
    getOutputDeviceName().then(setOutputDeviceName);
    const interval = setInterval(() => {
      clearOutputDeviceCache();
      getOutputDeviceName().then(setOutputDeviceName);
    }, 3000);
    onCleanup(() => clearInterval(interval));
  }

  function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const trackHasImage = () => {
    const t = track();
    return t && (t.AlbumPrimaryImageTag || t.ImageTags?.Primary);
  };

  function handleTouchStart(e: TouchEvent) {
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    setIsDragging(true);
  }

  function handleCoverTouchStart(e: TouchEvent) {
    if (coverAnimating()) return;
    coverStartX = e.touches[0].clientX;
    setCoverX(0);
  }

  function handleCoverTouchMove(e: TouchEvent) {
    if (coverAnimating()) return;
    const diff = e.touches[0].clientX - coverStartX;
    setCoverX(diff);
  }

  function handleCoverTouchEnd(e: TouchEvent) {
    if (coverAnimating()) return;
    const diff = e.changedTouches[0].clientX - coverStartX;
    if (Math.abs(diff) > 60) {
      const goingNext = diff < 0;
      const screenW = window.innerWidth;
      setCoverAnimating(true);
      setCoverX(goingNext ? -screenW : screenW);
      setTimeout(() => {
        setCoverAnimating(false);
        setCoverX(goingNext ? screenW : -screenW);
        requestAnimationFrame(() => {
          if (goingNext) player.next(); else player.prev();
          requestAnimationFrame(() => {
            setCoverAnimating(true);
            setCoverX(0);
            setTimeout(() => setCoverAnimating(false), 250);
          });
        });
      }, 250);
    } else {
      setCoverX(0);
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging()) return;
    const diff = e.touches[0].clientY - startY;
    if (diff < 0) return; // don't allow dragging up
    setDragY(diff);
  }

  function handleTouchEnd() {
    setIsDragging(false);
    if (dragY() > 120) {
      setPlayerExpanded(false);
    }
    setDragY(0);
  }

  function closeQueue() {
    if (queueClosing()) return;
    setQueueClosing(true);
    setTimeout(() => {
      setQueueRemoved(true);
      setShowQueue(false);
      setQueueClosing(false);
    }, 250);
  }

  function toggleQueue() {
    if (showQueue()) {
      closeQueue();
    } else {
      setQueueRemoved(false);
      setShowQueue(true);
    }
  }

  const translateY = () => {
    if (playerExpanded()) {
      return isDragging() ? dragY() : 0;
    }
    return "100%";
  };

  const transitionClass = () => isDragging() ? "transition-none" : "transition-[transform,background-color] duration-300 ease-out";

  return (
    <>
      {/* Mini player chip */}
      {track() && !playerExpanded() && (
        <div
          onClick={() => setPlayerExpanded(true)}
          class="mx-3 mb-1 rounded-xl border border-[#2a2a2a] overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
          style={{ "background-color": playerBgColor() || "#1a1a1a" }}
        >
          <div class="h-0.5 bg-[#2a2a2a] relative">
            <div
              class="absolute inset-y-0 left-0 bg-[#1db954] transition-all duration-300"
              style={{ width: `${state.duration ? (state.currentTime / state.duration) * 100 : 0}%` }}
            />
          </div>
          <div class="flex items-center gap-3 p-2">
            {trackHasImage() ? (
              <img
                src={getImageUrl(track()!.AlbumId || track()!.Id, "Primary", 60)}
                alt={track()?.Name}
                class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-[#242424] text-[#555] flex-shrink-0">
                <Music size={18} />
              </div>
            )}
            <div class="flex-1 min-w-0">
              <MarqueeText key={track()?.Id}>
                <p class="text-sm text-white">{track()?.Name || "No track playing"}</p>
              </MarqueeText>
              <p class="text-xs text-[#888] truncate">{track()?.Artists?.join(", ") || track()?.AlbumArtist || ""}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); player.togglePlay(); }}
              class="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center flex-shrink-0 cursor-pointer"
            >
              {state.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} class="ml-0.5" fill="currentColor" />}
            </button>
          </div>
        </div>
      )}

      {/* Full screen player overlay */}
      {track() && (
        <div
          ref={fullPlayerRef}
          class={`fixed left-0 right-0 bottom-0 z-[90] flex flex-col ${transitionClass()}`}
          style={{
            transform: `translateY(${translateY()})`,
            top: "calc(env(safe-area-inset-top, var(--safe-area-inset-top, 0px)) + 1.5rem)",
            "background-color": playerBgColor() || "#121212",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-4 pt-2 pb-1 shrink-0">
            <button
              onClick={() => setPlayerExpanded(false)}
              class="w-9 h-9 flex items-center justify-center text-[#888] hover:text-white transition-colors cursor-pointer"
            >
              <ChevronDown size={24} />
            </button>
            <button
              onClick={() => setShowTrackOptions(true)}
              class="w-9 h-9 flex items-center justify-center text-[#888] hover:text-white transition-colors cursor-pointer"
            >
              <MoreHorizontal size={22} />
            </button>
          </div>

          {/* Centered unit: cover art + track info + controls */}
          <div class="flex-1 flex flex-col items-center justify-center px-6 min-h-0 gap-4">
            {/* Cover art */}
            <div
              class="w-full max-w-[350px] overflow-hidden"
              onTouchStart={handleCoverTouchStart}
              onTouchMove={handleCoverTouchMove}
              onTouchEnd={handleCoverTouchEnd}
            >
              <div
                class="w-full"
                style={{
                  transform: `translateX(${coverX()}px)`,
                  transition: coverAnimating() ? "transform 250ms ease-out" : "none"
                }}
              >
              {trackHasImage() ? (
                <img
                  src={getImageUrl(track()!.AlbumId || track()!.Id, "Primary", 400)}
                  alt={track()?.Name}
                  class="w-full aspect-square rounded-2xl object-cover shadow-2xl"
                />
              ) : (
                <div class="w-full aspect-square rounded-2xl flex items-center justify-center bg-[#1a1a1a] text-[#555]">
                  <Music size={80} />
                </div>
              )}
              </div>
            </div>

            {/* Track info */}
            <div class="w-full max-w-[350px] mt-4">
              <MarqueeText class="w-full" key={track()?.Id}>
                <A
                  href={track()?.AlbumId ? `/album/${track()!.AlbumId}` : `/virtual-album/${makeSlug(track()?.Album || "Unknown Album")}`}
                  onClick={() => setPlayerExpanded(false)}
                  class="text-2xl font-semibold text-white hover:underline"
                >
                  {track()?.Name}
                </A>
              </MarqueeText>
              <A
                href={`/artist/${track()?.AlbumArtists?.[0]?.Id || ""}`}
                onClick={() => setPlayerExpanded(false)}
                class="text-sm text-[#888] hover:text-white hover:underline truncate block"
              >
                {track()?.Artists?.join(", ") || track()?.AlbumArtist || ""}
              </A>
            </div>

            {/* Scrub bar */}
            <div class="w-full max-w-[350px] mt-4">
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-[#888] w-8 text-right">{formatTime(state.currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={state.duration || 0}
                  value={state.currentTime}
                  onInput={(e) => player.seek(Number(e.currentTarget.value))}
                  class="flex-1 h-1.5 cursor-pointer"
                  style={{ "--fill": `${state.duration ? (state.currentTime / state.duration) * 100 : 0}%` } as any}
                />
                <span class="text-[10px] text-[#888] w-8">{formatTime(state.duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div class="flex items-center justify-center gap-6 mt-4 w-full max-w-[350px]">
              <button
                onClick={() => player.toggleShuffle()}
                class={`transition-colors cursor-pointer ${state.shuffle ? "text-[#1db954]" : "text-white"}`}
              >
                <Shuffle size={22} />
              </button>
              <button
                onClick={() => player.prev()}
                class="text-white transition-colors cursor-pointer"
              >
                <SkipBack size={26} fill="currentColor" />
              </button>
              <button
                onClick={() => player.togglePlay()}
                class="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
              >
                {state.isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} class="ml-1" fill="currentColor" />}
              </button>
              <button
                onClick={() => player.next()}
                class="text-white transition-colors cursor-pointer"
              >
                <SkipForward size={26} fill="currentColor" />
              </button>
              <button
                onClick={() => player.toggleRepeat()}
                class={`transition-colors cursor-pointer ${state.repeat !== "off" ? "text-[#1db954]" : "text-white"}`}
              >
                {state.repeat === "one" ? <Repeat1 size={22} /> : <Repeat size={22} />}
              </button>
            </div>
          </div>

          {/* Output device & Queue */}
          <div class="flex items-center justify-between px-6 mt-3 mb-6 shrink-0">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <Volume2 size={16} class="text-white shrink-0" />
              <span class="text-xs text-[#888] truncate">{outputDeviceName() || "Unknown"}</span>
            </div>
            <button
              onClick={toggleQueue}
              class="text-white hover:text-white transition-colors relative cursor-pointer ml-4"
            >
              <ListMusic size={22} />
              {state.queue.length > 0 && (
                <span class="absolute -top-2 -right-2 text-[9px] bg-[#1db954] text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {state.queue.length}
                </span>
              )}
            </button>
          </div>

          {/* Spacer for safe area */}
          <div class="h-safe-area-bottom shrink-0" />
        </div>
      )}

      {/* Queue popup in full player */}
      {!queueRemoved() && state.queue.length > 0 && (
        <div
          class="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center"
          style={{ opacity: queueClosing() ? "0" : "1", transition: "opacity 0.25s ease-out" }}
          onClick={closeQueue}
        >
          <div
            class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-t-2xl w-full max-w-lg max-h-[50vh] overflow-y-auto"
            classList={{
              "animate-slide-up": !queueClosing(),
              "animate-slide-down": queueClosing(),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between p-4 border-b border-[#2a2a2a] sticky top-0 bg-[#1a1a1a]">
              <p class="text-sm font-semibold text-white">Queue</p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowSaveQueue(true); }}
                class="text-xs text-[#888] hover:text-[#1db954] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                Save
              </button>
            </div>
            {state.queue.map((t, i) => (
              <div
                class={`flex items-center gap-3 px-4 py-3 text-sm transition-colors cursor-pointer ${
                  i === state.queueIndex
                    ? "bg-[#1db954]/10 text-[#1db954]"
                    : "text-[#888] hover:bg-[#242424] hover:text-white"
                }`}
                onClick={() => { player.play(t, state.queue, i); closeQueue(); }}
              >
                <span class="text-xs w-4 text-right">{i + 1}.</span>
                <span class="truncate flex-1">{t.Name}</span>
                <span class="text-xs text-[#555]">{formatTime((t.RunTimeTicks || 0) / 10000000)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Track options bottom sheet */}
      {showTrackOptions() && track() && (
        <TrackBottomSheet
          track={track()!}
          onClose={() => setShowTrackOptions(false)}
        />
      )}

      {/* Save queue dialog */}
      {showSaveQueue() && (
        <AddToPlaylistDialog
          trackIds={state.queue.map((t) => t.Id)}
          onClose={() => setShowSaveQueue(false)}
        />
      )}
    </>
  );
}
