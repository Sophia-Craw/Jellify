import { createResource, createMemo, Show } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { fetchAlbumInfo, fetchAlbumTracks, getImageUrl } from "~/lib/jellyfin";
import { Music } from "lucide-solid";
import TrackTable from "~/components/TrackTable";

export default function AlbumPage() {
  const params = useParams();
  const [album] = createResource(() => params.id, fetchAlbumInfo);
  const [tracks] = createResource(() => params.id, fetchAlbumTracks);

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
    <div class="p-6">
      {album() && (
        <div class="flex flex-col sm:flex-row gap-6 mb-8">
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
          <div class="flex flex-col justify-end">
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
            <div class="flex items-center gap-2 mt-2 text-xs text-[#555]">
              {album()!.ProductionYear && <span>{album()!.ProductionYear}</span>}
              {album()!.ProductionYear && tracks() && <span>•</span>}
              {tracks() && <span>{tracks()!.length} tracks</span>}
              <span>•</span>
              <span>{duration()}</span>
            </div>
          </div>
        </div>
      )}

      {tracks() && <TrackTable tracks={tracks()!} />}
    </div>
  );
}
