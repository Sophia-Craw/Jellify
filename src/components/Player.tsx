import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { A } from "@solidjs/router";
import { usePlayer } from "~/stores/player";
import { getImageUrl, makeSlug } from "~/lib/jellyfin";
import MarqueeText from "./MarqueeText";
import { Music, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, ListMusic, Volume2, Plus, Waves, ArrowUpDown, GripVertical } from "lucide-solid";
import AddToPlaylistDialog from "./AddToPlaylistDialog";

export default function Player() {
  const player = usePlayer();
  const { state, currentTrack } = player;
  const [showQueue, setShowQueue] = createSignal(false);
  const [showSaveQueue, setShowSaveQueue] = createSignal(false);
  const [reorderQueueMode, setReorderQueueMode] = createSignal(false);
  let queueRef: HTMLDivElement | undefined;
  let toggleRef: HTMLButtonElement | undefined;
  let queueContainer: HTMLDivElement | undefined;
  let queueSortableInstance: any;

  async function createQueueSortableInstance() {
    if (!reorderQueueMode() || !queueContainer || typeof document === "undefined") return;
    const Sortable = (await import("sortablejs")).default;
    queueSortableInstance = new Sortable(queueContainer, {
      handle: ".queue-drag-handle",
      animation: 200,
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      onStart: (evt) => {
        if (!queueContainer) return;
        const els = queueContainer.querySelectorAll<HTMLElement>("[data-queue-id]");
        const originalOrder = Array.from(els).map(el => el.dataset.queueId!);
        queueContainer.dataset.originalOrder = JSON.stringify(originalOrder);
      },
      onEnd: (evt) => {
        if (!queueContainer) return;
        
        const originalOrder: string[] = JSON.parse(queueContainer.dataset.originalOrder || "[]");
        const els = queueContainer.querySelectorAll<HTMLElement>("[data-queue-id]");
        const newOrder = Array.from(els).map(el => el.dataset.queueId!);
        
        // Revert DOM back to original order
        originalOrder.forEach(id => {
          const el = queueContainer!.querySelector(`[data-queue-id="${id}"]`);
          if (el) queueContainer!.appendChild(el);
        });
        
        // Destroy Sortable before updating store
        queueSortableInstance?.destroy();
        queueSortableInstance = undefined;
        
        // Map track IDs back to Audio objects
        const newQueue = newOrder.map(id => state.queue.find(t => t.Id === id)).filter(Boolean) as typeof state.queue;
        
        // Update store
        player.reorderQueue(newQueue);
        
        // Recreate Sortable after store update
        setTimeout(() => createQueueSortableInstance(), 0);
      },
    });
  }

  createEffect(() => {
    if (reorderQueueMode()) {
      createQueueSortableInstance();
    } else {
      queueSortableInstance?.destroy();
      queueSortableInstance = undefined;
    }
  });

  onCleanup(() => {
    queueSortableInstance?.destroy();
  });

  function handleClickOutside(e: MouseEvent) {
    if (showQueue() && queueRef && !queueRef.contains(e.target as Node) && toggleRef && !toggleRef.contains(e.target as Node)) {
      setShowQueue(false);
    }
  }

  onMount(() => document.addEventListener("click", handleClickOutside));
  onCleanup(() => typeof document !== "undefined" && document.removeEventListener("click", handleClickOutside));

  function formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatTicks(ticks?: number): string {
    if (!ticks) return "0:00";
    return formatTime(ticks / 10000000);
  }

  const track = currentTrack;
  const trackHasImage = () => {
    const t = track();
    return t && (t.AlbumPrimaryImageTag || t.ImageTags?.Primary);
  };

  return (
    <div class="fixed bottom-0 left-0 right-0 h-20 bg-[#121212] border-t border-[#2a2a2a] flex items-center px-4 z-50">
      <div class="flex items-center w-1/4 min-w-0">
        {trackHasImage() ? (
          <img
            src={getImageUrl(track()!.AlbumId || track()!.Id, "Primary", 60)}
            alt={track()?.Name || "No track"}
            class="w-12 h-12 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div class="w-12 h-12 rounded flex items-center justify-center bg-[#242424] text-[#555] flex-shrink-0">
            <Music size={20} />
          </div>
        )}
        <div class="ml-3 min-w-0">
          <MarqueeText class="max-w-[200px]" key={track()?.Id}>
            <Show when={track()?.AlbumId} fallback={
              <A
                href={`/virtual-album/${makeSlug(track()?.Album || "Unknown Album")}`}
                class="text-sm text-white hover:underline"
              >
                {track()?.Name || "No track playing"}
              </A>
            }>
              <A
                href={`/album/${track()!.AlbumId}`}
                class="text-sm text-white hover:underline"
              >
                {track()?.Name || "No track playing"}
              </A>
            </Show>
          </MarqueeText>
          <A
            href={`/artist/${track()?.AlbumArtists?.[0]?.Id || ""}`}
            class="text-xs text-[#888] truncate max-w-[200px] block hover:text-white hover:underline"
          >
            {track()?.Artists?.join(", ") || track()?.AlbumArtist || ""}
          </A>
        </div>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center">
        <div class="flex items-center gap-4">
          <button
            onClick={() => player.toggleShuffle()}
            class={`transition-all duration-150 cursor-pointer active:scale-90 ${state.shuffle ? "text-[#1db954]" : "text-[#888] hover:text-white"}`}
            title={`Shuffle: ${state.shuffle ? "on" : "off"}`}
          >
            <Shuffle size={18} />
          </button>

          <button
            onClick={() => player.prev()}
            class="text-[#888] hover:text-white transition-all duration-150 cursor-pointer active:scale-90"
            title="Previous"
          >
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button
            onClick={() => player.togglePlay()}
            class="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform duration-150 cursor-pointer active:scale-90"
            title={state.isPlaying ? "Pause" : "Play"}
          >
            {state.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} class="ml-0.5" fill="currentColor" />}
          </button>

          <button
            onClick={() => player.next()}
            class="text-[#888] hover:text-white transition-all duration-150 cursor-pointer active:scale-90"
            title="Next"
          >
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            onClick={() => player.toggleRepeat()}
            class={`transition-all duration-150 cursor-pointer active:scale-90 ${state.repeat !== "off" ? "text-[#1db954]" : "text-[#888] hover:text-white"}`}
            title={`Repeat: ${state.repeat}`}
          >
            {state.repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>

        <div class="flex items-center gap-2 w-full max-w-[500px] mt-1">
          <span class="text-[10px] text-[#888] w-8 text-right">
            {formatTime(state.currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={state.duration || 0}
            value={state.currentTime}
            onInput={(e) => player.seek(Number(e.currentTarget.value))}
            class="flex-1 h-1 cursor-pointer"
            style={{ "--fill": `${(state.currentTime / (state.duration || 1)) * 100}%` } as any}
          />
          <span class="text-[10px] text-[#888] w-8">
            {formatTime(state.duration)}
          </span>
        </div>
      </div>

      <div class="flex items-center justify-end w-1/4 gap-3">
        <button
          onClick={() => player.setShowVisualizer(!player.showVisualizer())}
          class={`transition-all duration-150 cursor-pointer active:scale-90 ${player.showVisualizer() ? "text-[#1db954]" : "text-[#888] hover:text-white"}`}
          title="Visualizer"
        >
          <Waves size={20} />
        </button>
        <button
          ref={toggleRef}
          onClick={() => setShowQueue(!showQueue())}
          class="text-[#888] hover:text-white transition-all duration-150 relative cursor-pointer active:scale-90"
          title="Queue"
        >
          <ListMusic size={20} />
          {state.queue.length > 0 && (
            <span class="absolute -top-2 -right-2 text-[9px] bg-[#1db954] text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
              {state.queue.length}
            </span>
          )}
        </button>

        <div class="flex items-center gap-2">
          <Volume2 size={16} class="text-[#888]" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.volume}
            onInput={(e) => player.setVolume(Number(e.currentTarget.value))}
            class="w-20 h-1 cursor-pointer"
            style={{ "--fill": `${state.volume * 100}%` } as any}
          />
        </div>
      </div>

      {showQueue() && state.queue.length > 0 && (
        <div ref={queueRef} class="absolute bottom-20 right-4 w-72 max-h-80 overflow-y-auto bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50">
          <div class="p-3 border-b border-[#2a2a2a] sticky top-0 bg-[#1a1a1a] z-10 flex items-center justify-between">
            <p class="text-sm font-semibold text-white">Queue</p>
            <div class="flex items-center gap-2">
              <button
                onClick={() => setReorderQueueMode(!reorderQueueMode())}
                class={`p-1 rounded transition-all duration-150 cursor-pointer active:scale-90 ${
                  reorderQueueMode() 
                    ? "bg-[#1db954] text-black" 
                    : "text-[#888] hover:text-[#1db954]"
                }`}
                title={reorderQueueMode() ? "Done reordering" : "Reorder queue"}
              >
                <ArrowUpDown size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowSaveQueue(true); }}
                class="flex items-center gap-1 text-xs text-[#888] hover:text-[#1db954] transition-all duration-150 cursor-pointer active:scale-90"
              >
                <Plus size={14} />
                Save
              </button>
            </div>
          </div>
          <div ref={(el) => { queueContainer = el; }}>
            {state.queue.map((t, i) => (
              <div
                data-queue-id={t.Id}
                class={`flex items-center gap-2 px-3 py-2 text-sm transition-all duration-150 ${
                  reorderQueueMode() ? "cursor-default" : "cursor-pointer active:scale-[0.97]"
                } ${
                  i === state.queueIndex
                    ? "bg-[#1db954]/10 text-[#1db954]"
                    : "text-[#888] hover:bg-[#242424] hover:text-white"
                }`}
                onClick={() => {
                  if (!reorderQueueMode()) {
                    player.play(t, state.queue, i);
                    setShowQueue(false);
                  }
                }}
              >
                {reorderQueueMode() && (
                  <span class="queue-drag-handle text-[#555] cursor-grab active:cursor-grabbing select-none">
                    <GripVertical size={14} />
                  </span>
                )}
                <span class="text-xs w-4 text-right">{i + 1}.</span>
                <span class="truncate flex-1">{t.Name}</span>
                <span class="text-xs text-[#555]">{formatTicks(t.RunTimeTicks)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSaveQueue() && (
        <AddToPlaylistDialog
          trackIds={state.queue.map((t) => t.Id)}
          onClose={() => setShowSaveQueue(false)}
        />
      )}
    </div>
  );
}
