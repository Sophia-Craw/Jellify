import { createResource, createMemo, createSignal, For, onMount, onCleanup } from "solid-js";
import { useSearchParams, A } from "@solidjs/router";
import { fetchAlbums, fetchArtists, fetchGenres, fetchSinglesTracks, fetchOrphanedTracks, getImageUrl } from "~/lib/jellyfin";
import type { AlbumTab, Genre, Audio, MusicAlbum, VirtualAlbum } from "~/lib/types";
import AlbumCard from "~/components/AlbumCard";
import ArtistCard from "~/components/ArtistCard";
import TrackMenu from "~/components/TrackMenu";
import TrackRowCard from "~/components/TrackRowCard";
import { usePlayer } from "~/stores/player";
import { usePlaylists } from "~/stores/playlists";
import { useAuth } from "~/stores/auth";
import { useInfiniteScroll } from "~/lib/useInfiniteScroll";
import { useIsMobile } from "~/lib/mobile";
import { Music } from "lucide-solid";

const TABS: { key: AlbumTab; label: string }[] = [
  { key: "playlists", label: "Playlists" },
  { key: "artists", label: "Artists" },
  { key: "albums", label: "Albums" },
  { key: "singles", label: "Singles" },
];

function formatSinglesDuration(ticks?: number): string {
  if (!ticks) return "0:00";
  const totalSeconds = ticks / 10000000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const player = usePlayer();
  const { state } = player;
  const { playlists } = usePlaylists();
  const [hydrated, setHydrated] = createSignal(false);
  onMount(() => setHydrated(true));
  const activeTab = createMemo<AlbumTab>(() =>
    (searchParams.tab as AlbumTab) || "playlists"
  );
  const { authVersion } = useAuth();
  const [genres] = createResource(() => authVersion(), () => fetchGenres());
  const selectedGenre = createMemo(() => searchParams.genre || "");
  const selectedGenreId = createMemo(() => {
    const name = selectedGenre();
    if (!name) return "";
    const g = genres();
    return g?.find((g) => g.Name === name)?.Id || "";
  });
  const [albums] = createResource(() => ({ v: authVersion(), genre: selectedGenreId() }), (s) => fetchAlbums("ChildCount", s.genre || undefined));
  const [artists] = createResource(() => ({ v: authVersion(), genre: selectedGenreId() }), (s) => fetchArtists(s.genre || undefined));
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

  const [singlesTracks] = createResource(() => ({ v: authVersion(), genre: selectedGenreId() }), (s) => fetchSinglesTracks(s.genre || undefined));
  const [virtualAlbums] = createResource(() => authVersion(), () => fetchOrphanedTracks());

  const filteredAlbums = createMemo(() => {
    const all = albums();
    if (!all) return [];
    if (activeTab() === "albums") {
      return all.filter((a) => (a.ChildCount ?? 1) > 1);
    }
    if (activeTab() === "singles") {
      return all.filter((a) => (a.ChildCount ?? 1) === 1);
    }
    return [];
  });

  const virtualSinglesTracks = createMemo(() => {
    const va = virtualAlbums();
    if (!va) return [];
    return va
      .filter((v) => v.trackCount === 1)
      .map((v) => v.tracks[0])
      .filter(Boolean);
  });

  const allSinglesTracks = createMemo(() => {
    const real = singlesTracks();
    const virtual = virtualSinglesTracks();
    if (!real) return virtual || [];
    return [...real, ...virtual];
  });

  const albumsGridItems = createMemo(() => {
    if (activeTab() !== "albums") return [];
    const real = filteredAlbums();
    const virtual = (virtualAlbums() || []).filter((v) => v.trackCount > 1);
    type GridItem =
      | { kind: "real"; data: MusicAlbum }
      | { kind: "virtual"; data: VirtualAlbum };
    const items: GridItem[] = [
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

  const albumScroll = useInfiniteScroll(albumsGridItems, 50);
  const artistScroll = useInfiniteScroll(() => artists() || [], 50);
  const singlesScroll = useInfiniteScroll(allSinglesTracks, 50);

  function setTab(tab: AlbumTab) {
    setSearchParams({ tab, genre: selectedGenre() || undefined });
  }

  function toggleGenre(name: string) {
    if (selectedGenre() === name) {
      setSearchParams({ tab: activeTab(), genre: undefined });
    } else {
      setSearchParams({ tab: activeTab(), genre: name });
    }
  }

  function playSingle(track: Audio, index: number) {
    const tracks = allSinglesTracks();
    if (!tracks.length) return;
    player.play(track, tracks, index);
  }

  return (
    <div class="pt-6 px-6 pb-2">
      <div
        class="sticky top-0 z-30 transition-all duration-200 -mx-6 px-6 mb-6"
        classList={{
          "bg-[#121212]/95 backdrop-blur border-b border-[#2a2a2a]": showSticky() && isMobile(),
        }}
      >
        <h1 class="text-2xl font-bold text-white py-3">Library</h1>
      </div>
      <div ref={sentinelRef} class="h-px" />

      <div class="flex gap-1 mb-4 bg-[#1a1a1a] rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            onClick={() => setTab(tab.key)}
            class={`px-4 py-2 text-sm rounded-md transition-colors cursor-pointer ${
              activeTab() === tab.key
                ? "bg-white text-black font-medium"
                : "text-[#888] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab() !== "playlists" && (
      <div class="mb-6 overflow-x-auto scrollbar-thin">
        <div class="flex gap-2 pb-2 min-w-max">
          <For each={genres()}>
            {(genre) => (
              <button
                onClick={() => toggleGenre(genre.Name)}
                class={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  selectedGenre() === genre.Name
                    ? "bg-[#333] text-white font-medium"
                    : "bg-[#121212] text-[#888] hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                {genre.Name}
              </button>
            )}
          </For>
        </div>
      </div>)}

      {activeTab() !== "playlists" && selectedGenre() && (
        <p class="text-[#888] text-xs mb-4">
          Filtering by: <span class="text-white font-medium">{selectedGenre()}</span>
          <button
            onClick={() => setSearchParams({ tab: activeTab(), genre: undefined })}
            class="ml-2 text-[#555] hover:text-white underline text-xs cursor-pointer"
          >
            Clear
          </button>
        </p>
      )}

      {activeTab() === "artists" && (() => {
        const items = artistScroll.visible();
        return (
          <div>
            {items.length > 0 ? (
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.map((artist) => (
                  <ArtistCard artist={artist} />
                ))}
              </div>
            ) : (
              <p class="text-[#888] text-sm mt-8 text-center">No artists found</p>
            )}
            {artistScroll.hasMore() && <div ref={artistScroll.sentinelRef} class="h-4" />}
          </div>
        );
      })()}

      {activeTab() === "albums" && (() => {
        const items = albumScroll.visible();
        return (
          <div>
            {items.length > 0 ? (
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <For each={items}>
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
                      imageId={
                        item.data.tracks[0]?.ImageTags?.Primary
                          ? item.data.tracks[0].Id
                          : undefined
                      }
                      subtitle={`${item.data.trackCount} tracks`}
                    />
                  )}
                </For>
              </div>
            ) : (
              <p class="text-[#888] text-sm mt-8 text-center">No albums found</p>
            )}
            {albumScroll.hasMore() && <div ref={albumScroll.sentinelRef} class="h-4" />}
          </div>
        );
      })()}

      {activeTab() === "singles" && (() => {
        const combined = allSinglesTracks();
        const visibleTracks = singlesScroll.visible();
        return (
          <div>
            {singlesTracks.loading ? (
              <div class="space-y-2">
                {Array.from({ length: 8 }).map(() => (
                  <div class="flex items-center gap-3 h-14 bg-[#1a1a1a] rounded animate-pulse px-2">
                    <div class="w-4 h-3 bg-[#2a2a2a] rounded" />
                    <div class="w-8 h-8 rounded-md bg-[#2a2a2a]" />
                    <div class="flex-1 h-3 bg-[#2a2a2a] rounded max-w-[200px]" />
                    <div class="w-16 h-3 bg-[#2a2a2a] rounded" />
                    <div class="w-8 h-3 bg-[#2a2a2a] rounded" />
                  </div>
                ))}
              </div>
            ) : combined.length > 0 ? (
              isMobile() ? (
                <div class="space-y-1">
                  {visibleTracks.map((track) => {
                    const globalIndex = combined.indexOf(track);
                    const isActive = state.isPlaying
                      && state.queue[state.queueIndex]?.Id === track.Id;
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
                  {visibleTracks.map((track) => {
                    const globalIndex = combined.indexOf(track);
                    const isActive = state.isPlaying
                      && state.queue[state.queueIndex]?.Id === track.Id;
                    const coverUrl = track.AlbumId || track.Id;
                    const hasCover = track.AlbumPrimaryImageTag || track.ImageTags?.Primary;
                    return (
                      <tr
                        class={`group cursor-pointer transition-colors ${
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
                          {formatSinglesDuration(track.RunTimeTicks)}
                        </td>
                        <td class="py-2 px-2">
                          <div onClick={(e) => e.stopPropagation()}>
                            <TrackMenu track={track} queue={combined} queueIndex={globalIndex} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )
            ) : (
              <p class="text-[#888] text-sm mt-8 text-center">No singles found</p>
            )}
            {singlesScroll.hasMore() && <div ref={singlesScroll.sentinelRef} class="h-4" />}
          </div>
        );
      })()}



      {activeTab() === "playlists" && (() => {
        const items = playlists;
        return (
          <div>
            {hydrated() && items.length > 0 ? (
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.map((p) => (
                  <A
                    href={`/playlist/${p.id}`}
                    class="block bg-[#1a1a1a] hover:bg-[#242424] rounded-lg overflow-hidden transition-colors"
                  >
                    <div
                      class="aspect-square flex items-center justify-center"
                      style={{ "background-color": p.color }}
                    >
                      {p.coverDataUrl ? (
                        <img src={p.coverDataUrl} alt={p.name} class="w-full h-full object-cover" />
                      ) : (
                        <Music size={48} class="text-white/60" />
                      )}
                    </div>
                    <div class="p-3">
                      <p class="text-sm text-white font-medium truncate">{p.name}</p>
                      <p class="text-xs text-[#888]">{p.trackIds.length} tracks</p>
                    </div>
                  </A>
                ))}
              </div>
            ) : hydrated() && items.length === 0 ? (
              <p class="text-[#888] text-sm mt-8 text-center">No playlists yet. Create one from the sidebar.</p>
            ) : (
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map(() => (
                  <div class="bg-[#1a1a1a] rounded-lg overflow-hidden animate-pulse">
                    <div class="aspect-square bg-[#2a2a2a]" />
                    <div class="p-3 space-y-2">
                      <div class="h-3 bg-[#2a2a2a] rounded w-3/4" />
                      <div class="h-2 bg-[#2a2a2a] rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}


    </div>
  );
}
