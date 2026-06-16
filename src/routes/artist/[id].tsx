import { createResource, createMemo, createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { fetchArtistInfo, fetchArtistAlbums, fetchOrphanedTracks, fetchAlbumTracks, getImageUrl } from "~/lib/jellyfin";
import type { VirtualAlbum, MusicAlbum, Audio } from "~/lib/types";
import { useAuth } from "~/stores/auth";
import { usePlayer } from "~/stores/player";
import { useInfiniteScroll } from "~/lib/useInfiniteScroll";
import { fetchArtistBio } from "~/lib/wiki";
import AlbumCard from "~/components/AlbumCard";
import TrackMenu from "~/components/TrackMenu";
import TrackRowCard from "~/components/TrackRowCard";
import { useIsMobile } from "~/lib/mobile";
import { setHeaderTitle, setHeaderSubtitle, setHeaderImageUrl, setHeaderImageShape, setShowHeaderExtra } from "~/lib/mobileHeader";
import { User, Music, ExternalLink, Play, AlertTriangle } from "lucide-solid";

function formatDuration(ticks?: number): string {
  if (!ticks) return "0:00";
  const s = Math.floor(ticks / 10000000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function ArtistPage() {
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

  createEffect(() => {
    const a = artist();
    if (!a) return;
    setHeaderTitle(a.Name);
    setHeaderSubtitle(subtitle());
    setHeaderImageUrl(imageSrc() || "");
    setHeaderImageShape("circle");
  });

  const [artist, artistRes] = createResource(() => params.id, fetchArtistInfo);
  const [realAlbums, realAlbumsRes] = createResource(() => params.id, fetchArtistAlbums);
  const [orphanAlbums, orphanRes] = createResource(() => authVersion(), (v) => fetchOrphanedTracks(v));

  const artistOrphanAlbums = createMemo<VirtualAlbum[]>(() => {
    const all = orphanAlbums();
    if (!all) return [];
    return all.filter(
      (a) => a.artistItems?.some((ai) => ai.Id === params.id) || a.albumArtist === artist()?.Name
    );
  });

  const realMultiAlbums = createMemo(() =>
    (realAlbums() || []).filter((a) => (a.ChildCount ?? 1) > 1)
  );
  const realSingleAlbums = createMemo(() =>
    (realAlbums() || []).filter((a) => (a.ChildCount ?? 1) === 1)
  );

  const [realSingleTracks, realSingleRes] = createResource(
    () => realSingleAlbums().map((a) => a.Id).join(","),
    async () => {
      const ids = realSingleAlbums();
      if (!ids.length) return [];
      const results = await Promise.all(ids.map((a) => fetchAlbumTracks(a.Id)));
      return results.flat();
    }
  );

  const [wikiData, wikiRes] = createResource(() => artist()?.Name, fetchArtistBio);
  const [showFullBio, setShowFullBio] = createSignal(false);

  const hasError = () => artistRes.error || realAlbumsRes.error || orphanRes.error || realSingleRes.error;

  const virtualSingleTracks = createMemo<Audio[]>(() =>
    artistOrphanAlbums()
      .filter((v) => v.trackCount === 1)
      .map((v) => v.tracks[0])
      .filter(Boolean)
  );

  const allSingles = createMemo(() => {
    const real = realSingleTracks();
    const virtual = virtualSingleTracks();
    return [...(real || []), ...virtual];
  });

  const singleScroll = useInfiniteScroll(allSingles as () => Audio[], 50);

  const artistAlbumGrid = createMemo(() => {
    const real = realMultiAlbums();
    const virtual = artistOrphanAlbums().filter((v) => v.trackCount > 1);
    type Item =
      | { kind: "real"; data: MusicAlbum }
      | { kind: "virtual"; data: VirtualAlbum };
    const items: Item[] = [
      ...real.map((a) => ({ kind: "real" as const, data: a })),
      ...virtual.map((v) => ({ kind: "virtual" as const, data: v })),
    ];
    items.sort((a, b) => {
      const an = a.kind === "real" ? a.data.Name : a.data.name;
      const bn = b.kind === "real" ? b.data.Name : b.data.name;
      return an.localeCompare(bn);
    });
    return items;
  });

  const hasAlbums = createMemo(() => artistAlbumGrid().length > 0);
  const hasSingles = createMemo(() => allSingles().length > 0);

  const subtitle = createMemo(() => {
    const parts: string[] = [];
    if (hasAlbums()) parts.push(`${artistAlbumGrid().length} ${artistAlbumGrid().length === 1 ? "album" : "albums"}`);
    if (hasSingles()) parts.push(`${allSingles().length} ${allSingles().length === 1 ? "single" : "singles"}`);
    return parts.join(", ");
  });

  const imageSrc = createMemo(() => {
    if (artist()?.ImageTags?.Primary) return getImageUrl(artist()!.Id, "Primary", 300);
    const thumb = wikiData()?.thumbnail?.source;
    if (thumb) return thumb;
    return null;
  });

  function playSingle(track: Audio, index: number) {
    const all = allSingles();
    if (all.length) player.play(track, all, index);
  }

  function playDiscography() {
    const all = allSingles();
    if (all.length) player.play(all[0], all, 0);
  }

  return (
    <div class="px-6 pb-2">
      <Show when={artistRes.loading}>
        {isMobile() ? (
          <div class="-mx-6 -mt-[72px] mb-8 relative overflow-hidden" style="height: 120vw; max-height: 750px">
            <div class="absolute inset-0 w-full h-full bg-[#1a1a1a] animate-pulse" />
            <div class="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent" />
            <div class="absolute bottom-0 left-0 right-0 p-6">
              <div class="w-12 h-3 bg-[#2a2a2a] rounded animate-pulse mb-2" />
              <div class="w-40 h-8 bg-[#2a2a2a] rounded animate-pulse mb-2" />
              <div class="w-24 h-4 bg-[#2a2a2a] rounded animate-pulse" />
            </div>
          </div>
        ) : (
          <div class="flex items-center gap-6 mb-8">
            <div class="w-40 h-40 rounded-full bg-[#1a1a1a] animate-pulse flex-shrink-0" />
            <div class="flex-1">
              <div class="w-16 h-3 bg-[#2a2a2a] rounded animate-pulse mb-2" />
              <div class="w-48 h-8 bg-[#2a2a2a] rounded animate-pulse mb-2" />
              <div class="w-32 h-4 bg-[#2a2a2a] rounded animate-pulse" />
            </div>
          </div>
        )}
      </Show>
      <Show when={!artistRes.loading && artist()}>
        {isMobile() ? (
          <div class="-mx-6 -mt-[72px] mb-8 relative overflow-hidden" style="height: 120vw; max-height: 750px">
            {imageSrc() ? (
              <img src={imageSrc()} alt={artist()!.Name} class="absolute inset-0 w-full h-full object-cover object-top" />
            ) : (
              <div class="absolute inset-0 w-full h-full flex items-center justify-center bg-[#1a1a1a] text-[#555]">
                <User size={80} />
              </div>
            )}
            <div class="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent" />
            <div class="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
              <div class="flex-1">
                <p class="text-xs text-[#888] uppercase tracking-wider mb-1">Artist</p>
                <h1 class="text-3xl font-bold text-white">{artist()!.Name}</h1>
                {subtitle() && (
                  <p class="text-sm text-[#888] mt-1">{subtitle()}</p>
                )}
              </div>
              {allSingles().length > 0 && (
                <button
                  onClick={playDiscography}
                  class="w-12 h-12 rounded-full bg-[#1db954] text-black flex items-center justify-center hover:scale-105 transition-transform duration-150 shrink-0 cursor-pointer active:scale-90"
                >
                  <Play size={24} fill="currentColor" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div class="flex items-center gap-6 mb-8">
            <div class="w-40 h-40 rounded-full overflow-hidden bg-[#1a1a1a] flex-shrink-0">
              {imageSrc() ? (
                <img
                  src={imageSrc()}
                  alt={artist()!.Name}
                  class="w-full h-full object-cover"
                />
              ) : (
                <div class="w-full h-full flex items-center justify-center text-[#555]">
                  <User size={48} />
                </div>
              )}
            </div>
            <div>
              <p class="text-xs text-[#888] uppercase tracking-wider mb-1">Artist</p>
              <h1 class="text-3xl font-bold text-white">{artist()!.Name}</h1>
              {subtitle() && (
                <p class="text-sm text-[#888] mt-1">{subtitle()}</p>
              )}
            </div>
          </div>
        )}
      </Show>

      <div ref={sentinelRef} class="h-px" />

      <Show when={hasError()}>
        <div class="flex items-center gap-2 mb-4 px-3 py-2 bg-red-900/20 border border-red-900/30 rounded-lg text-xs text-red-400">
          <AlertTriangle size={14} />
          <span>Failed to load artist data. Check your connection and server settings.</span>
        </div>
      </Show>

      <section class="mb-8">
        <h2 class="text-lg font-semibold text-white mb-4">Albums</h2>
        <Show when={realAlbumsRes.loading}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <For each={[0,0,0,0,0,0]}>
              {() => <div class="animate-pulse bg-[#2a2a2a] rounded-lg" style="aspect-ratio: 1" />}
            </For>
          </div>
        </Show>
        <Show when={!realAlbumsRes.loading && hasAlbums()}>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <For each={artistAlbumGrid()}>
              {(item) => item.kind === "real" ? (
                <AlbumCard album={item.data} />
              ) : (
                <AlbumCard
                  album={{
                    Name: item.data.name,
                    Id: item.data.id,
                    AlbumArtist: item.data.albumArtist,
                    Artists: item.data.artistItems?.map((a) => a.Name),
                    ImageTags: item.data.tracks[0]?.ImageTags?.Primary
                      ? { Primary: item.data.tracks[0].ImageTags.Primary }
                      : undefined,
                    ChildCount: item.data.trackCount,
                  }}
                  href={`/virtual-album/${item.data.id}`}
                  imageId={item.data.tracks[0]?.ImageTags?.Primary ? item.data.tracks[0].Id : undefined}
                  subtitle={`${item.data.trackCount} tracks`}
                />
              )}
            </For>
          </div>
        </Show>
      </section>

      {(() => {
        const all = allSingles();
        const trackIndexMap = new Map<string, number>();
        all.forEach((t, i) => trackIndexMap.set(t.Id, i));
        const isLoading = realSingleRes.loading || orphanRes.loading;
        return (
        <Show when={isLoading || hasSingles()}>
        <section class="mb-8">
          <h2 class="text-lg font-semibold text-white mb-4">Singles</h2>
          <Show when={isLoading}>
            <div class="space-y-2">
              <For each={[0,0,0,0,0,0]}>
                {() => (
                  <div class="flex items-center gap-3 h-14 bg-[#1a1a1a] rounded animate-pulse px-2">
                    <div class="w-4 h-3 bg-[#2a2a2a] rounded" />
                    <div class="w-8 h-8 rounded-md bg-[#2a2a2a]" />
                    <div class="flex-1 h-3 bg-[#2a2a2a] rounded max-w-[200px]" />
                    <div class="w-16 h-3 bg-[#2a2a2a] rounded" />
                  </div>
                )}
              </For>
            </div>
          </Show>
          <Show when={!isLoading && hasSingles()}>
          {isMobile() ? (
            <div class="space-y-1">
              {singleScroll.visible().map((track) => {
                const globalIndex = trackIndexMap.get(track.Id) ?? 0;
                const isActive = state.isPlaying && state.queue[state.queueIndex]?.Id === track.Id;
                return (
                  <TrackRowCard
                    track={track}
                    index={globalIndex}
                    isActive={isActive}
                    onClick={() => playSingle(track, globalIndex)}
                  />
                );
              })}
            </div>
          ) : (
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[#888] text-xs uppercase tracking-wider border-b border-[#2a2a2a]">
                <th class="text-left py-2 px-2 w-8">#</th>
                <th class="text-left py-2 px-2 w-8"></th>
                <th class="text-left py-2 px-2">Title</th>
                <th class="text-left py-2 px-2">Artist</th>
                <th class="text-right py-2 px-2 w-16">Duration</th>
                <th class="py-2 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {singleScroll.visible().map((track) => {
                const globalIndex = trackIndexMap.get(track.Id) ?? 0;
                const isActive = state.isPlaying && state.queue[state.queueIndex]?.Id === track.Id;
                const coverUrl = track.AlbumId || track.Id;
                const hasCover = track.AlbumPrimaryImageTag || track.ImageTags?.Primary;
                return (
                  <tr
                    class={`group cursor-pointer transition-all duration-150 active:scale-[0.99] ${
                      isActive
                        ? "bg-[#1db954]/10 text-[#1db954]"
                        : "text-[#e0e0e0] hover:bg-[#1a1a1a]"
                    }`}
                    onClick={() => playSingle(track, globalIndex)}
                  >
                    <td class="py-2 px-2 text-xs">
                      <span class="group-hover:hidden">{globalIndex + 1}</span>
                      <span class="hidden group-hover:inline-flex items-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                      </span>
                    </td>
                    <td class="py-2 px-2">
                      <div class="w-8 h-8 rounded-md bg-[#333] overflow-hidden flex items-center justify-center flex-shrink-0">
                        {hasCover ? (
                          <img src={getImageUrl(coverUrl, "Primary", 60)} alt="" class="w-full h-full object-cover" />
                        ) : (
                          <Music size={14} class="text-[#555]" />
                        )}
                      </div>
                    </td>
                    <td class="py-2 px-2">
                      <p class="truncate max-w-[200px] sm:max-w-none">{track.Name}</p>
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
                        <TrackMenu track={track} queue={all} queueIndex={globalIndex} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
          </Show>
          {singleScroll.hasMore() && <div ref={singleScroll.sentinelRef} class="h-4" />}
        </section>
        </Show>
        );
      })()}

      {wikiData()?.extract && (
        <section class="mt-8 max-w-2xl">
          <h2 class="text-lg font-semibold text-white mb-3">About</h2>
          {(() => {
            const text = wikiData()!.extract;
            const isLong = text.length > 400;
            const display = !isLong || showFullBio() ? text : text.slice(0, 400).trimEnd() + "…";
            return (
              <>
                <p class="text-sm text-[#ccc] leading-relaxed whitespace-pre-line">{display}</p>
                <div class="flex items-center gap-4 mt-3">
                  {isLong && (
                    <button
                      onClick={() => setShowFullBio(!showFullBio())}
                      class="text-xs text-[#1db954] hover:underline transition-all duration-150 cursor-pointer active:scale-95"
                    >
                      {showFullBio() ? "Show less" : "Show more"}
                    </button>
                  )}
                  {wikiData()!.content_urls?.desktop?.page && (
                    <A
                      href={wikiData()!.content_urls.desktop.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs text-[#888] hover:text-white hover:underline inline-flex items-center gap-1 transition-all duration-150 active:scale-95"
                    >
                      Read more on Wikipedia <ExternalLink size={10} />
                    </A>
                  )}
                </div>
              </>
            );
          })()}
        </section>
      )}

      {wikiData.loading && artist() && (
        <section class="mt-8 max-w-2xl">
          <h2 class="text-lg font-semibold text-white mb-3">About</h2>
          <div class="animate-pulse space-y-2">
            <div class="h-3 bg-[#2a2a2a] rounded w-full" />
            <div class="h-3 bg-[#2a2a2a] rounded w-5/6" />
            <div class="h-3 bg-[#2a2a2a] rounded w-4/6" />
          </div>
        </section>
      )}

      {!wikiData.loading && !wikiData()?.extract && artist() && (
        <section class="mt-8">
          <p class="text-xs text-[#555]">No bio available</p>
        </section>
      )}

      {!realAlbumsRes.loading && !realSingleRes.loading && !orphanRes.loading && !artistRes.loading && !hasAlbums() && !hasSingles() && (
        <p class="text-[#888] text-sm mt-8 text-center mb-8">No albums found for this artist</p>
      )}
    </div>
  );
}
