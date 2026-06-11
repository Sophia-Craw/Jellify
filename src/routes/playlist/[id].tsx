import { createResource, createMemo, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { usePlaylists } from "~/stores/playlists";
import { fetchAlbumInfo, getImageUrl } from "~/lib/jellyfin";
import { useIsMobile } from "~/lib/mobile";
import { Music, ArrowLeft, Play, ArrowUpDown, GripVertical } from "lucide-solid";
import { usePlayer } from "~/stores/player";
import type { Audio } from "~/lib/types";
import Sortable from "sortablejs";
import TrackMenu from "~/components/TrackMenu";
import TrackRowCard from "~/components/TrackRowCard";

export default function PlaylistPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { playlists, reorderPlaylistTracks } = usePlaylists();
  const player = usePlayer();
  const isMobile = useIsMobile();
  const [hydrated, setHydrated] = createSignal(false);
  const [reorderMode, setReorderMode] = createSignal(false);
  const [showSticky, setShowSticky] = createSignal(false);
  let sentinelRef: HTMLDivElement | undefined;
  let sortableContainer: HTMLTableSectionElement | undefined;
  let sortableInstance: Sortable | undefined;

  onMount(() => {
    if (!sentinelRef) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinelRef);
    onCleanup(() => observer.disconnect());
  });
  
  // Cache for track data to avoid refetching on reorder
  const trackCache = new Map<string, Audio>();
  
  onMount(() => setHydrated(true));
  const playlist = () => playlists.find((p) => p.id === params.id);

  function createSortableInstance() {
    if (!reorderMode() || !sortableContainer || typeof document === "undefined") return;
    
    sortableInstance = new Sortable(sortableContainer, {
      handle: ".drag-handle",
      animation: 200,
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      onStart: (evt) => {
        if (!sortableContainer) return;
        const els = sortableContainer.querySelectorAll<HTMLElement>("[data-track-id]");
        const originalOrder = Array.from(els).map(el => el.dataset.trackId!);
        sortableContainer.dataset.originalOrder = JSON.stringify(originalOrder);
      },
      onEnd: (evt) => {
        if (!sortableContainer) return;
        
        const originalOrder: string[] = JSON.parse(sortableContainer.dataset.originalOrder || "[]");
        const els = sortableContainer.querySelectorAll<HTMLElement>("[data-track-id]");
        const newOrder = Array.from(els).map(el => el.dataset.trackId!);
        
        // Revert DOM back to original order
        originalOrder.forEach(id => {
          const el = sortableContainer!.querySelector(`[data-track-id="${id}"]`);
          if (el) sortableContainer!.appendChild(el);
        });
        
        // Destroy Sortable before updating store
        sortableInstance?.destroy();
        sortableInstance = undefined;
        
        // Update store
        reorderPlaylistTracks(params.id, newOrder);
        
        // Recreate Sortable after store update
        setTimeout(() => createSortableInstance(), 0);
      },
    });
  }

  createEffect(() => {
    if (reorderMode()) {
      createSortableInstance();
    } else {
      sortableInstance?.destroy();
      sortableInstance = undefined;
    }
  });

  onCleanup(() => {
    sortableInstance?.destroy();
  });

  const [tracks] = createResource(() => playlist()?.trackIds ?? [], async (ids) => {
    // Check which tracks we need to fetch
    const newIds = ids.filter(id => !trackCache.has(id));
    
    // Fetch only new tracks
    if (newIds.length > 0) {
      for (const id of newIds) {
        try {
          const item = await fetchAlbumInfo(id);
          trackCache.set(id, item as unknown as Audio);
        } catch {
          // skip items that fail
        }
      }
    }
    
    // Return tracks in the correct order from cache
    return ids.map(id => trackCache.get(id)).filter(Boolean) as Audio[];
  });

  const currentTrackId = createMemo(() => {
    const q = player.state.queue;
    const i = player.state.queueIndex;
    return q[i]?.Id;
  });

  const totalDuration = createMemo(() => {
    const t = tracks();
    if (!t) return "0:00";
    const total = t.reduce((sum, track) => sum + (track.RunTimeTicks || 0), 0);
    const seconds = total / 10000000;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  });

  function formatTicks(ticks?: number): string {
    if (!ticks) return "0:00";
    const totalSeconds = ticks / 10000000;
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const p = playlist;

  return (
    <div class="pt-6 px-6 pb-2">
      {!hydrated() ? (
        <div class="animate-pulse space-y-4">
          <div class="w-24 h-4 bg-[#2a2a2a] rounded" />
          <div class="flex gap-6">
            <div class="w-48 h-48 bg-[#2a2a2a] rounded-lg" />
            <div class="flex-1 space-y-2">
              <div class="w-16 h-3 bg-[#2a2a2a] rounded" />
              <div class="w-40 h-8 bg-[#2a2a2a] rounded" />
              <div class="w-24 h-3 bg-[#2a2a2a] rounded" />
            </div>
          </div>
        </div>
      ) : p() ? (
        <>
          <button
            onClick={() => navigate(-1)}
            class="flex items-center gap-1 text-sm text-[#888] hover:text-white transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div
            class="sticky top-0 z-30 -mx-6 px-4 bg-[#121212]/95 backdrop-blur border-b border-[#2a2a2a] transition-all duration-300 ease-out"
            classList={{
              "opacity-0": !showSticky() || !isMobile(),
              "opacity-100": showSticky() && isMobile(),
            }}
            style={{
              transform: showSticky() && isMobile() ? 'translateY(0)' : 'translateY(-100%)',
            }}
          >
            <div class="flex items-center gap-3 h-12">
              <div
                class="w-8 h-8 rounded overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ "background-color": p()?.color }}
              >
                {p()!.coverDataUrl ? (
                  <img src={p()!.coverDataUrl} alt={p()!.name} class="w-full h-full object-cover" />
                ) : (
                  <Music size={14} class="text-white/60" />
                )}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{p()!.name}</p>
                <p class="text-xs text-[#888] truncate">Playlist</p>
              </div>
            </div>
          </div>

          <div
            class="flex flex-col sm:flex-row gap-6 mb-8 items-center sm:items-start text-center sm:text-left transition-all duration-300 ease-out origin-top"
            style={{
              transform: showSticky() && isMobile()
                ? 'scale(0.85) translateY(-20px)'
                : 'scale(1) translateY(0)',
              opacity: showSticky() && isMobile() ? 0 : 1,
            }}
          >
            <div
              class="w-48 h-48 rounded-lg shadow-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ "background-color": p()!.color }}
            >
              {p()!.coverDataUrl ? (
                <img src={p()!.coverDataUrl} alt={p()!.name} class="w-full h-full object-cover" />
              ) : (
                <Music size={64} class="text-white/60" />
              )}
            </div>
            <div class="flex flex-col justify-end items-center sm:items-start">
              <p class="text-xs text-[#888] uppercase tracking-wider mb-1">Playlist</p>
              <h1 class="text-3xl font-bold text-white mb-2">{p()!.name}</h1>
              <div class="flex items-center justify-center sm:justify-start gap-2 text-xs text-[#555]">
                {tracks() && <span>{tracks()!.length} tracks</span>}
                {tracks() && tracks()!.length > 0 && <span>•</span>}
                <span>{totalDuration()}</span>
              </div>

              {tracks() && tracks()!.length > 0 && (
                <div class="flex items-center justify-center sm:justify-start gap-3 mt-4">
                  <button
                    onClick={() => player.play(tracks()![0], tracks()!, 0)}
                    class="w-10 h-10 rounded-full bg-[#1db954] text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
                    title="Play all"
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => setReorderMode(!reorderMode())}
                    class={`p-2 rounded-full transition-colors cursor-pointer ${
                      reorderMode() 
                        ? "bg-[#1db954] text-black" 
                        : "bg-[#2a2a2a] text-[#888] hover:text-white hover:bg-[#333]"
                    }`}
                    title={reorderMode() ? "Done reordering" : "Reorder tracks"}
                  >
                    <ArrowUpDown size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div ref={sentinelRef} class="h-px" />

          {tracks() && tracks()!.length > 0 ? isMobile() ? (
            <div class="space-y-1">
              {tracks()!.map((track, index) => {
                const isActive = player.state.isPlaying && currentTrackId() === track.Id;
                return (
                  <TrackRowCard
                    track={track}
                    index={index}
                    isActive={isActive}
                    onClick={() => player.play(track, tracks()!, index)}
                    playlistId={params.id}
                  />
                );
              })}
            </div>
          ) : (
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[#888] text-xs uppercase tracking-wider border-b border-[#2a2a2a]">
                  <th class="text-left py-2 px-2 w-8">#</th>
                  {reorderMode() && <th class="w-8"></th>}
                  <th class="text-left py-2 px-2">Title</th>
                  <th class="text-left py-2 px-2 hidden sm:table-cell">Artist</th>
                  <th class="text-right py-2 px-2 w-16">Duration</th>
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody ref={(el) => { sortableContainer = el; }}>
                {tracks()!.map((track, index) => (
                    <tr
                      data-track-id={track.Id}
                      class={`group transition-colors ${
                        reorderMode() ? "cursor-default" : "cursor-pointer"
                      } ${
                        player.state.isPlaying && currentTrackId() === track.Id
                          ? "bg-[#1db954]/10 text-[#1db954]"
                          : "text-[#e0e0e0] hover:bg-[#1a1a1a]"
                      }`}
                      onClick={() => !reorderMode() && player.play(track, tracks()!, index)}
                    >
                      <td class="py-2 px-2 text-xs">{index + 1}</td>
                      {reorderMode() && (
                        <td class="py-2 px-2">
                          <span class="drag-handle text-[#555] cursor-grab active:cursor-grabbing select-none">
                            <GripVertical size={16} />
                          </span>
                        </td>
                      )}
                      <td class="py-2 px-2">
                        <p class="truncate max-w-[200px] sm:max-w-none">{track.Name}</p>
                      </td>
                      <td class="py-2 px-2 text-[#888] text-xs hidden sm:table-cell truncate max-w-[150px]">
                        {track.Artists?.join(", ") || track.AlbumArtist || ""}
                      </td>
                      <td class="py-2 px-2 text-right text-xs text-[#888]">
                        {formatTicks(track.RunTimeTicks)}
                      </td>
                      <td class="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <TrackMenu track={track} queue={tracks()} queueIndex={index} playlistId={params.id} />
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p class="text-[#555] text-sm text-center mt-8">This playlist is empty</p>
          )}
        </>
      ) : (
        <p class="text-[#888] text-sm mt-8 text-center">Playlist not found</p>
      )}
    </div>
  );
}
