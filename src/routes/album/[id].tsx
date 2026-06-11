import { createResource, createMemo, createSignal, onMount, onCleanup, Show } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { fetchAlbumInfo, fetchAlbumTracks, getImageUrl } from "~/lib/jellyfin";
import { useIsMobile } from "~/lib/mobile";
import { Music } from "lucide-solid";
import TrackTable from "~/components/TrackTable";

export default function AlbumPage() {
  const params = useParams();
  const [album] = createResource(() => params.id, fetchAlbumInfo);
  const [tracks] = createResource(() => params.id, fetchAlbumTracks);

  const isMobile = useIsMobile();
  const [showSticky, setShowSticky] = createSignal(false);

  let sentinelRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!sentinelRef) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinelRef);
    onCleanup(() => observer.disconnect());
  });

  const duration = createMemo(() => {
    const t = tracks();
    if (!t) return "0:00";
    const total = t.reduce((sum, track) => sum + (track.RunTimeTicks || 0), 0);
    const seconds = total / 10000000;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  });

  return (
    <div class="pt-6 px-6 pb-2">
      {album() && (
        <>
          <div
            class="sticky top-0 z-30 -mx-6 px-4 bg-[#121212]/95 backdrop-blur border-b border-[#2a2a2a] transition-all duration-300 ease-out"
            classList={{
              "opacity-0 pointer-events-none translate-y-0": !showSticky() || !isMobile(),
              "opacity-100": showSticky() && isMobile(),
            }}
            style={{
              transform: showSticky() && isMobile() ? 'translateY(0)' : 'translateY(-100%)',
            }}
          >
            <div class="flex items-center gap-3 h-12">
              <Show when={album()!.ImageTags?.Primary} fallback={
                <div class="w-8 h-8 rounded bg-[#333] flex items-center justify-center flex-shrink-0">
                  <Music size={14} class="text-[#555]" />
                </div>
              }>
                <img
                  src={getImageUrl(album()!.Id, "Primary", 60)}
                  alt={album()!.Name}
                  class="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              </Show>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{album()!.Name}</p>
                <p class="text-xs text-[#888] truncate">{album()!.AlbumArtist || album()!.Artists?.join(", ")}</p>
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
            <Show when={album()!.ImageTags?.Primary} fallback={
              <div class="w-48 h-48 rounded-lg flex items-center justify-center bg-[#242424] text-[#555] flex-shrink-0">
                <Music size={48} />
              </div>
            }>
              <img
                src={getImageUrl(album()!.Id, "Primary", 300)}
                alt={album()!.Name}
                class="w-48 h-48 rounded-lg object-cover shadow-lg flex-shrink-0"
              />
            </Show>
            <div class="flex flex-col justify-end items-center sm:items-start">
              <p class="text-xs text-[#888] uppercase tracking-wider mb-1">
                Album
              </p>
              <h1 class="text-3xl font-bold text-white mb-2">{album()!.Name}</h1>
              <A
                href={`/artist/${album()!.AlbumArtists?.[0]?.Id || ""}`}
                class="text-sm text-[#888] hover:text-white hover:underline transition-colors"
              >
                {album()!.AlbumArtist || album()!.Artists?.join(", ") || "Unknown Artist"}
              </A>
              <div class="flex items-center justify-center sm:justify-start gap-2 mt-2 text-xs text-[#555]">
                {album()!.ProductionYear && <span>{album()!.ProductionYear}</span>}
                {album()!.ProductionYear && tracks() && <span>•</span>}
                {tracks() && <span>{tracks()!.length} tracks</span>}
                <span>•</span>
                <span>{duration()}</span>
              </div>
            </div>
          </div>

          <div ref={sentinelRef} class="h-px" />
        </>
      )}

      {tracks() && <TrackTable tracks={tracks()!} />}
    </div>
  );
}
