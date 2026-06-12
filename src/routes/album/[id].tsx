import { createResource, createMemo, createEffect, onMount, onCleanup, Show } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { fetchAlbumInfo, fetchAlbumTracks, getImageUrl } from "~/lib/jellyfin";
import { Music, AlertTriangle } from "lucide-solid";
import TrackTable from "~/components/TrackTable";
import { setHeaderTitle, setHeaderSubtitle, setHeaderImageUrl, setShowHeaderExtra } from "~/lib/mobileHeader";

export default function AlbumPage() {
  const params = useParams();
  const [album, albumRes] = createResource(() => params.id, fetchAlbumInfo);
  const [tracks, tracksRes] = createResource(() => params.id, fetchAlbumTracks);

  const hasError = () => albumRes.error || tracksRes.error;

  let sentinelRef: HTMLDivElement | undefined;

  onMount(() => {
    setHeaderTitle("");
    setHeaderSubtitle("");
    setHeaderImageUrl("");
    setShowHeaderExtra(false);
    if (!sentinelRef) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowHeaderExtra(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinelRef);
    onCleanup(() => {
      observer.disconnect();
      setShowHeaderExtra(false);
    });
  });

  createEffect(() => {
    const a = album();
    if (!a) return;
    setHeaderTitle(a.Name);
    setHeaderSubtitle(a.AlbumArtist || a.Artists?.join(", ") || "");
    setHeaderImageUrl(a.ImageTags?.Primary ? getImageUrl(a.Id, "Primary", 60) : "");
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
    <div class="pt-32 px-6 pb-2">
      {album() && (
        <>
          <div class="flex flex-col sm:flex-row gap-6 mb-8 items-center sm:items-start text-center sm:text-left">
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

      <Show when={hasError()}>
        <div class="flex items-center gap-2 mb-4 px-3 py-2 bg-red-900/20 border border-red-900/30 rounded-lg text-xs text-red-400">
          <AlertTriangle size={14} />
          <span>Failed to load album data. Check your connection and server settings.</span>
        </div>
      </Show>

      {tracks() && <TrackTable tracks={tracks()!} />}
    </div>
  );
}
