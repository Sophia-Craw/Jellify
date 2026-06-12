import { createResource, createMemo, createEffect, onMount, onCleanup, Show } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { fetchOrphanedTracks, getImageUrl } from "~/lib/jellyfin";
import { useInfiniteScroll } from "~/lib/useInfiniteScroll";
import { useAuth } from "~/stores/auth";
import { usePlayer } from "~/stores/player";
import { Music } from "lucide-solid";
import TrackMenu from "~/components/TrackMenu";
import TrackRowCard from "~/components/TrackRowCard";
import { useIsMobile } from "~/lib/mobile";
import type { Audio, VirtualAlbum } from "~/lib/types";
import { setHeaderTitle, setHeaderSubtitle, setHeaderImageUrl, setShowHeaderExtra } from "~/lib/mobileHeader";

function formatDuration(ticks?: number): string {
  if (!ticks) return "0:00";
  const totalSeconds = ticks / 10000000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VirtualAlbumPage() {
  const params = useParams();
  const { authVersion } = useAuth();
  const player = usePlayer();
  const { state } = player;
  const isMobile = useIsMobile();

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

  const [orphans] = createResource(() => authVersion(), (v) => fetchOrphanedTracks(v));

  const album = createMemo<VirtualAlbum | null>(() => {
    const all = orphans();
    return all?.find((a) => a.id === params.slug) || null;
  });

  const tracks = createMemo<Audio[]>(() => album()?.tracks || []);

  const trackScroll = useInfiniteScroll(tracks as () => Audio[], 50);

  createEffect(() => {
    const a = album();
    if (!a) return;
    setHeaderTitle(a.name);
    setHeaderSubtitle(a.albumArtist);
    setHeaderImageUrl(a.tracks[0]?.ImageTags?.Primary ? getImageUrl(a.tracks[0].Id, "Primary", 60) : "");
  });

  const totalDuration = createMemo(() => {
    const t = tracks();
    if (!t.length) return "0:00";
    const total = t.reduce((sum, tr) => sum + (tr.RunTimeTicks || 0), 0);
    const seconds = total / 10000000;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  });

  function handlePlay(track: Audio, index: number) {
    const t = tracks();
    if (t.length) player.play(track, t, index);
  }

  const firstTrack = createMemo(() => tracks()[0]);

  const hasCover = createMemo(() => {
    const ft = firstTrack();
    return !!ft?.ImageTags?.Primary;
  });

  return (
    <div class="pt-32 px-6 pb-2">
      <Show when={!orphans() || orphans.loading} fallback={
        <Show when={album()} fallback={
          <p class="text-[#888] text-sm mt-8 text-center">Album not found</p>
        }>
          <>
          <div class="flex flex-col sm:flex-row gap-6 mb-8 items-center sm:items-start text-center sm:text-left">
            <Show when={hasCover()} fallback={
              <div class="w-48 h-48 rounded-lg flex items-center justify-center bg-[#242424] text-[#555] flex-shrink-0">
                <Music size={48} />
              </div>
            }>
              <img
                src={getImageUrl(firstTrack()!.Id, "Primary", 300)}
                alt={album()!.name}
                class="w-48 h-48 rounded-lg object-cover shadow-lg flex-shrink-0"
              />
            </Show>
            <div class="flex flex-col justify-end items-center sm:items-start">
              <p class="text-xs text-[#888] uppercase tracking-wider mb-1">
                Album
              </p>
              <h1 class="text-3xl font-bold text-white mb-2">{album()!.name}</h1>
              {album()!.artistItems?.[0] ? (
                <A
                  href={`/artist/${album()!.artistItems[0].Id}`}
                  class="text-sm text-[#888] hover:text-white hover:underline transition-colors"
                >
                  {album()!.albumArtist}
                </A>
              ) : (
                <p class="text-sm text-[#888]">{album()!.albumArtist}</p>
              )}
              <div class="flex items-center justify-center sm:justify-start gap-2 mt-2 text-xs text-[#555]">
                <span>{album()!.trackCount} tracks</span>
                <span>•</span>
                <span>{totalDuration()}</span>
              </div>
            </div>
          </div>

          <div ref={sentinelRef} class="h-px" />

          {(() => {
            const allTracks = tracks();
            const visibleTracks = trackScroll.visible();
            return isMobile() ? (
              <div class="space-y-1">
                {visibleTracks.map((track) => {
                  const globalIndex = allTracks.indexOf(track);
                  const isActive = state.isPlaying
                    && state.queue[state.queueIndex]?.Id === track.Id;
                  return (
                    <TrackRowCard
                      track={track}
                      index={globalIndex}
                      isActive={isActive}
                      onClick={() => handlePlay(track, globalIndex)}
                    />
                  );
                })}
              </div>
            ) : (
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[#888] text-xs uppercase tracking-wider border-b border-[#2a2a2a]">
                  <th class="text-left py-2 px-2 w-8">#</th>
                  <th class="text-left py-2 px-2">Title</th>
                  <th class="text-left py-2 px-2">Artist</th>
                  <th class="text-right py-2 px-2 w-16">Duration</th>
                  <th class="py-2 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {visibleTracks.map((track) => {
                  const globalIndex = allTracks.indexOf(track);
                  const isActive = state.isPlaying
                    && state.queue[state.queueIndex]?.Id === track.Id;
                  return (
                    <tr
                      class={`group cursor-pointer transition-colors ${
                        isActive
                          ? "bg-[#1db954]/10 text-[#1db954]"
                          : "text-[#e0e0e0] hover:bg-[#1a1a1a]"
                      }`}
                      onClick={() => handlePlay(track, globalIndex)}
                    >
                      <td class="py-2 px-2 text-xs">
                        <span class="group-hover:hidden">{globalIndex + 1}</span>
                        <span class="hidden group-hover:inline-flex items-center text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                        </span>
                      </td>
                      <td class="py-2 px-2">
                        <p class="truncate max-w-[300px] sm:max-w-none">{track.Name}</p>
                      </td>
                      <td class="py-2 px-2 text-xs truncate max-w-[150px]">
                        {track.ArtistItems?.[0] ? (
                          <A href={`/artist/${track.ArtistItems[0].Id}`} class="text-[#888] hover:text-white hover:underline">{track.ArtistItems[0].Name}</A>
                        ) : (
                          <span class="text-[#888]">{track.Artists?.join(", ") || track.AlbumArtist || ""}</span>
                        )}
                      </td>
                      <td class="py-2 px-2 text-right text-xs text-[#888]">
                        {formatDuration(track.RunTimeTicks)}
                      </td>
                      <td class="py-2 px-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <TrackMenu track={track} queue={allTracks} queueIndex={globalIndex} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            );
          })()}
          {trackScroll.hasMore() && <div ref={trackScroll.sentinelRef} class="h-4" />}
          </>
        </Show>
      }>
        {/* skeleton */}
        <div class="flex flex-col sm:flex-row gap-6 mb-8">
          <div class="w-48 h-48 rounded-lg bg-[#242424] animate-pulse flex-shrink-0" />
          <div class="flex flex-col justify-end gap-3 flex-1">
            <div class="h-3 bg-[#2a2a2a] rounded w-16 animate-pulse" />
            <div class="h-8 bg-[#2a2a2a] rounded w-64 animate-pulse" />
            <div class="h-4 bg-[#2a2a2a] rounded w-40 animate-pulse" />
            <div class="h-3 bg-[#2a2a2a] rounded w-24 animate-pulse" />
          </div>
        </div>
        <div class="space-y-2">
          {Array.from({ length: 8 }).map(() => (
            <div class="h-10 bg-[#1a1a1a] rounded animate-pulse" />
          ))}
        </div>
      </Show>
    </div>
  );
}
