import { createResource, createMemo, createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { useSearchParams, A } from "@solidjs/router";
import { fetchAlbumsPage, fetchArtistsPage, fetchAudioPage, fetchAllAlbumIds, fetchAlbumTracks, fetchGenres, getImageUrl } from "~/lib/jellyfin";
import type { AlbumTab, Genre, Audio, MusicAlbum, VirtualAlbum } from "~/lib/types";
import AlbumCard from "~/components/AlbumCard";
import ArtistCard from "~/components/ArtistCard";
import TrackMenu from "~/components/TrackMenu";
import TrackRowCard from "~/components/TrackRowCard";
import { usePlayer } from "~/stores/player";
import { usePlaylists } from "~/stores/playlists";
import { useAuth } from "~/stores/auth";
import { usePaginatedScroll } from "~/lib/usePaginatedScroll";
import { useIsMobile } from "~/lib/mobile";
import { setHeaderTitle, setHeaderSubtitle, setHeaderImageUrl, setShowHeaderExtra } from "~/lib/mobileHeader";
import { Music, AlertTriangle, ArrowUpDown } from "lucide-solid";

const TABS: { key: AlbumTab; label: string }[] = [
  { key: "playlists", label: "Playlists" },
  { key: "artists", label: "Artists" },
  { key: "albums", label: "Albums" },
  { key: "singles", label: "Singles" },
];

const SORT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  albums: [
    { value: "SortName", label: "Name" },
    { value: "ProductionYear", label: "Year" },
    { value: "DateCreated", label: "Date Added" },
    { value: "PlayCount", label: "Play Count" },
    { value: "CommunityRating", label: "Rating" },
  ],
  singles: [
    { value: "SortName", label: "Name" },
    { value: "ProductionYear", label: "Year" },
    { value: "DateCreated", label: "Date Added" },
    { value: "PlayCount", label: "Play Count" },
    { value: "CommunityRating", label: "Rating" },
  ],
  artists: [
    { value: "SortName", label: "Name" },
  ],
  playlists: [
    { value: "name", label: "Name" },
    { value: "trackCount", label: "Track Count" },
  ],
};

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
  const [sortOpen, setSortOpen] = createSignal(false);
  let sortRef: HTMLDivElement | undefined;
  onMount(() => setHydrated(true));
  const activeTab = createMemo<AlbumTab>(() =>
    (searchParams.tab as AlbumTab) || "playlists"
  );
  const { authVersion } = useAuth();
  const isMobile = useIsMobile();

  function defaultSortBy(tab: AlbumTab): string {
    if (tab === "playlists") return "name";
    return "SortName";
  }

  const sortBy = createMemo(() => {
    const sb = searchParams.sortBy;
    if (Array.isArray(sb)) return sb[0] || defaultSortBy(activeTab());
    return sb || defaultSortBy(activeTab());
  });
  const sortOrder = createMemo(() => {
    const so = searchParams.sortOrder;
    if (Array.isArray(so)) return so[0] === "Descending" ? "Descending" : "Ascending";
    return so === "Descending" ? "Descending" : "Ascending";
  });

  function handleSortClick(field: string) {
    if (sortBy() === field) {
      setSearchParams({
        tab: activeTab(),
        genre: selectedGenre() || undefined,
        sortBy: field,
        sortOrder: sortOrder() === "Ascending" ? "Descending" : "Ascending",
      });
    } else {
      setSearchParams({
        tab: activeTab(),
        genre: selectedGenre() || undefined,
        sortBy: field,
        sortOrder: "Ascending",
      });
    }
    setSortOpen(false);
  }

  const currentSortLabel = createMemo(() => {
    const options = SORT_OPTIONS[activeTab()] || [];
    const found = options.find((o) => o.value === sortBy());
    return found?.label || sortBy();
  });

  const [genres, genresRes] = createResource(() => authVersion(), () => fetchGenres());
  const selectedGenre = createMemo(() => searchParams.genre || "");
  const selectedGenreId = createMemo(() => {
    const name = selectedGenre();
    if (!name) return "";
    const g = genres();
    return g?.find((g) => g.Name === name)?.Id || "";
  });

  // Album IDs (cached, used for orphan detection)
  const [albumIdsRes] = createResource(() => authVersion(), () => fetchAllAlbumIds());

  // Paginated albums from Jellyfin
  const albumScroll = usePaginatedScroll((startIndex) =>
    fetchAlbumsPage(startIndex, 100, "ChildCount", selectedGenreId() || undefined, sortBy(), sortOrder())
  );

  // Paginated artists from Jellyfin
  const artistScroll = usePaginatedScroll((startIndex) =>
    fetchArtistsPage(startIndex, 100, selectedGenreId() || undefined, sortBy(), sortOrder())
  );

  // Paginated audio tracks (used for orphan/virtual album computation)
  const audioScroll = usePaginatedScroll((startIndex) =>
    fetchAudioPage(startIndex, 200, sortBy(), sortOrder())
  );

  // Reset all pagination when sort or genre changes, and load first page for active tab
  let prevSortKey = "";
  createEffect(() => {
    const key = `${sortBy()}:${sortOrder()}:${selectedGenreId()}`;
    if (key === prevSortKey) return;
    prevSortKey = key;
    console.log("library sort effect: key=", key, "tab=", activeTab(), "items:", { a: albumScroll.items().length, ar: artistScroll.items().length, au: audioScroll.items().length });

    // Only reset scrolls for the active tab — other tabs keep their cache
    const tab = activeTab();
    if (tab === "albums" || tab === "singles") {
      if (albumScroll.items().length > 0) albumScroll.reset();
      if (audioScroll.items().length > 0) audioScroll.reset();
      setRealSinglesTracks([]);
      processedSingles.clear();
      albumScroll.loadMore();
      audioScroll.loadMore();
      console.log("library: loadedMore albums+audio");
    } else if (tab === "artists") {
      if (artistScroll.items().length > 0) artistScroll.reset();
      artistScroll.loadMore();
      console.log("library: loadedMore artists");
    }
  });

  // Load first page for active tab on mount and tab switches (only if not yet loaded)
  createEffect(() => {
    const tab = activeTab();
    if (tab === "albums" || tab === "singles") {
      if (albumScroll.initializing()) albumScroll.loadMore();
      if (audioScroll.initializing()) audioScroll.loadMore();
    } else if (tab === "artists") {
      if (artistScroll.initializing()) artistScroll.loadMore();
    }
  });

  // Orphan audio: tracks not belonging to any known album
  const orphanAudio = createMemo(() => {
    const ids = albumIdsRes();
    const audio = audioScroll.items();
    if (!ids || !audio.length) return [];
    return audio.filter((t) => !t.AlbumId || !ids.has(t.AlbumId));
  });

  // Virtual albums computed reactively from orphan audio
  const virtualAlbums = createMemo(() => {
    const orphans = orphanAudio();
    if (!orphans.length) return [];

    const groups = new Map<string, Audio[]>();
    const unknown: Audio[] = [];

    for (const track of orphans) {
      const albumName = track.Album?.trim();
      if (albumName) {
        const list = groups.get(albumName);
        if (list) list.push(track);
        else groups.set(albumName, [track]);
      } else {
        unknown.push(track);
      }
    }

    const result: VirtualAlbum[] = [];

    for (const [name, tracks] of groups) {
      const sorted = tracks.sort((a, b) => (a.IndexNumber || 999) - (b.IndexNumber || 999));
      const first = sorted[0];
      result.push({
        name,
        albumArtist: first.AlbumArtist || first.Artists?.join(", ") || "Unknown Artist",
        artistItems: first.ArtistItems,
        tracks: sorted,
        trackCount: sorted.length,
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled",
      });
    }

    if (unknown.length > 0) {
      result.push({
        name: "Unknown Album",
        albumArtist: "Various Artists",
        tracks: unknown,
        trackCount: unknown.length,
        id: "__unknown__",
      });
    }

    const sb = sortBy(), so = sortOrder();
    if (sb === "SortName" || sb === "name") {
      result.sort((a, b) => so === "Ascending" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (sb === "ProductionYear" || sb === "PremiereDate" || sb === "DateCreated") {
      result.sort((a, b) => {
        const dateA = a.tracks[0]?.PremiereDate || a.tracks[0]?.DateCreated || "";
        const dateB = b.tracks[0]?.PremiereDate || b.tracks[0]?.DateCreated || "";
        return so === "Ascending" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      });
    } else if (sb === "PlayCount") {
      result.sort((a, b) => so === "Ascending"
        ? (a.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0) - b.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0))
        : (b.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0) - a.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0)));
    } else if (sb === "CommunityRating") {
      result.sort((a, b) => so === "Ascending"
        ? ((a.tracks[0]?.CommunityRating || 0) - (b.tracks[0]?.CommunityRating || 0))
        : ((b.tracks[0]?.CommunityRating || 0) - (a.tracks[0]?.CommunityRating || 0)));
    } else if (sb === "trackCount") {
      result.sort((a, b) => so === "Ascending" ? a.trackCount - b.trackCount : b.trackCount - a.trackCount);
    }
    return result;
  });

  // Albums tab: real albums (ChildCount > 1) from paginated albums
  const albumsTabAlbums = createMemo(() =>
    albumScroll.items().filter((a) => (a.ChildCount ?? 1) > 1)
  );

  // Real singles: tracks from single-track albums (ChildCount === 1)
  const [realSinglesTracks, setRealSinglesTracks] = createSignal<Audio[]>([]);
  let processedSingles = new Set<string>();

  createEffect(() => {
    const albums = albumScroll.items();
    const newSingles = albums.filter((a) => (a.ChildCount ?? 1) === 1 && !processedSingles.has(a.Id));
    if (newSingles.length === 0) return;
    for (const a of newSingles) processedSingles.add(a.Id);
    (async () => {
      const batchSize = 15;
      const results: Audio[] = [];
      for (let i = 0; i < newSingles.length; i += batchSize) {
        const batch = newSingles.slice(i, i + batchSize);
        const tracks = await Promise.all(batch.map((a) => fetchAlbumTracks(a.Id)));
        results.push(...tracks.flat());
      }
      setRealSinglesTracks((prev) => [...prev, ...results]);
    })();
  });

  // Virtual singles: orphan tracks that form single-track virtual albums
  const virtualSingles = createMemo(() =>
    virtualAlbums()
      .filter((v) => v.trackCount === 1)
      .map((v) => v.tracks[0])
      .filter(Boolean)
  );

  // All singles combined
  const allSingles = createMemo(() => {
    const real = realSinglesTracks();
    const virtual = virtualSingles();
    return [...real, ...virtual];
  });

  // Playlist sorting (local data, unchanged)
  const sortedPlaylists = createMemo(() => {
    const items = playlists;
    if (activeTab() !== "playlists") return items;
    const sb = sortBy();
    const so = sortOrder();
    const sorted = [...items];
    if (sb === "name") {
      sorted.sort((a, b) => so === "Ascending" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (sb === "trackCount") {
      sorted.sort((a, b) => so === "Ascending" ? a.trackIds.length - b.trackIds.length : b.trackIds.length - a.trackIds.length);
    }
    return sorted;
  });

  // Albums grid: merges real albums + multi-track virtual albums, with sort
  const albumsGridItems = createMemo(() => {
    if (activeTab() !== "albums") return [];
    const real = albumsTabAlbums();
    const virtual = virtualAlbums().filter((v) => v.trackCount > 1);
    type GridItem =
      | { kind: "real"; data: MusicAlbum }
      | { kind: "virtual"; data: VirtualAlbum };
    const items: GridItem[] = [
      ...real.map((a) => ({ kind: "real" as const, data: a })),
      ...virtual.map((v) => ({ kind: "virtual" as const, data: v })),
    ];
    const so = sortOrder();
    if (sortBy() === "ProductionYear" || sortBy() === "PremiereDate" || sortBy() === "DateCreated") {
      items.sort((a, b) => {
        const dateA = a.kind === "real" ? (a.data.PremiereDate || a.data.DateCreated || "") : (a.data.tracks[0]?.PremiereDate || a.data.tracks[0]?.DateCreated || "");
        const dateB = b.kind === "real" ? (b.data.PremiereDate || b.data.DateCreated || "") : (b.data.tracks[0]?.PremiereDate || b.data.tracks[0]?.DateCreated || "");
        return so === "Ascending" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      });
    } else if (sortBy() === "PlayCount") {
      items.sort((a, b) => {
        const ca = a.kind === "real" ? (a.data.PlayCount || 0) : a.data.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0);
        const cb = b.kind === "real" ? (b.data.PlayCount || 0) : b.data.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0);
        return so === "Ascending" ? ca - cb : cb - ca;
      });
    } else if (sortBy() === "CommunityRating") {
      items.sort((a, b) => {
        const ra = a.kind === "real" ? (a.data.CommunityRating || 0) : (a.data.tracks[0]?.CommunityRating || 0);
        const rb = b.kind === "real" ? (b.data.CommunityRating || 0) : (b.data.tracks[0]?.CommunityRating || 0);
        return so === "Ascending" ? ra - rb : rb - ra;
      });
    } else {
      items.sort((a, b) => {
        const an = a.kind === "real" ? a.data.Name : a.data.name;
        const bn = b.kind === "real" ? b.data.Name : b.data.name;
        return so === "Ascending" ? an.localeCompare(bn) : bn.localeCompare(an);
      });
    }
    return items;
  });

  const hasError = () => genresRes.error;

  function setTab(tab: AlbumTab) {
    setSearchParams({ tab, genre: undefined, sortBy: undefined, sortOrder: undefined });
  }

  function toggleGenre(name: string) {
    if (selectedGenre() === name) {
      setSearchParams({ tab: activeTab(), genre: undefined });
    } else {
      setSearchParams({ tab: activeTab(), genre: name });
    }
  }

  function playSingle(track: Audio, index: number) {
    const tracks = allSingles();
    if (!tracks.length) return;
    player.play(track, tracks, index);
  }

  let sentinelRef: HTMLDivElement | undefined;

  onMount(() => {
    setHeaderTitle("Library");
    setHeaderSubtitle("");
    setHeaderImageUrl("");
    setShowHeaderExtra(false);
    function handleClickOutside(e: MouseEvent) {
      if (sortOpen() && sortRef && !sortRef.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  onMount(() => {
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

  return (
    <div class="pt-32 md:pt-12 px-6 pb-2">
      <h1 class="text-2xl font-bold text-white mb-6">Library</h1>
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
          <Show when={genresRes.loading}>
            <For each={[0,0,0,0,0,0,0,0]}>
              {() => <div class="w-16 h-6 bg-[#2a2a2a] rounded-full animate-pulse" />}
            </For>
          </Show>
          <Show when={!genresRes.loading}>
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
          </Show>
        </div>
      </div>)}

      {activeTab() !== "playlists" && selectedGenre() && (
        <p class="text-[#888] text-xs mb-4">
          Filtering by: <span class="text-white font-medium">{selectedGenre()}</span>
          <button
            onClick={() => setSearchParams({ tab: activeTab(), genre: undefined, sortBy: sortBy(), sortOrder: sortOrder() })}
            class="ml-2 text-[#555] hover:text-white underline text-xs cursor-pointer"
          >
            Clear
          </button>
        </p>
      )}

      {/* Sort dropdown */}
      <div ref={sortRef} class="relative mb-4">
        <button
          onClick={() => setSortOpen(!sortOpen())}
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] text-[#888] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowUpDown size={12} />
          {currentSortLabel()} {sortOrder() === "Ascending" ? "↑" : "↓"}
        </button>

        <div
          classList={{
            "visible opacity-100 scale-100": sortOpen(),
            "invisible opacity-0 scale-95 pointer-events-none": !sortOpen(),
          }}
          class="absolute left-0 top-full mt-1 w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1 transition-all duration-200 ease-out origin-top-left"
        >
          <div class="px-3 py-1.5 text-[10px] text-[#555] uppercase tracking-wider">Sort by</div>
          <For each={SORT_OPTIONS[activeTab()] || []}>
            {(opt) => (
              <button
                onClick={() => handleSortClick(opt.value)}
                class="w-full flex items-center justify-between px-3 py-2 text-sm text-[#e0e0e0] hover:bg-[#242424] transition-colors text-left cursor-pointer"
              >
                <span classList={{ "text-white font-medium": sortBy() === opt.value }}>
                  {opt.label}
                </span>
                {sortBy() === opt.value && (
                  <span class="text-[#888] text-xs">{sortOrder() === "Ascending" ? "↑" : "↓"}</span>
                )}
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={hasError()}>
        <div class="flex items-center gap-2 mb-4 px-3 py-2 bg-red-900/20 border border-red-900/30 rounded-lg text-xs text-red-400">
          <AlertTriangle size={14} />
          <span>Failed to load some data. Check your connection and server settings.</span>
        </div>
      </Show>

      {activeTab() === "artists" && (() => {
        return (
          <div>
            <Show when={artistScroll.initializing()}>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <For each={[0,0,0,0,0,0,0,0,0,0,0,0]}>
                  {() => <div class="animate-pulse bg-[#2a2a2a] rounded-lg" style="aspect-ratio: 1" />}
                </For>
              </div>
            </Show>
            <Show when={!artistScroll.initializing()}>
              {artistScroll.items().length > 0 ? (
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <For each={artistScroll.items()}>
                  {(artist) => (
                    <ArtistCard artist={artist} />
                  )}
                </For>
              </div>
            ) : (
              <p class="text-[#888] text-sm mt-8 text-center">No artists found</p>
            )}
            </Show>
            {artistScroll.hasMore() && <div ref={artistScroll.sentinelRef} class="h-4" />}
          </div>
        );
      })()}

      {activeTab() === "albums" && (() => {
        return (
          <div>
            <Show when={albumScroll.initializing()}>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <For each={[0,0,0,0,0,0,0,0,0,0,0,0]}>
                  {() => <div class="animate-pulse bg-[#2a2a2a] rounded-lg" style="aspect-ratio: 1" />}
                </For>
              </div>
            </Show>
            <Show when={!albumScroll.initializing()}>
              {albumsGridItems().length > 0 ? (
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <For each={albumsGridItems()}>
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
            </Show>
            {albumScroll.hasMore() && <div ref={albumScroll.sentinelRef} class="h-4" />}
          </div>
        );
      })()}

      {activeTab() === "singles" && (() => {
        const combined = allSingles();
        return (
          <div>
            {audioScroll.initializing() ? (
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
                  <For each={combined}>{(track, index) => {
                    const isActive = () => player.state.isPlaying
                      && player.state.queue[player.state.queueIndex]?.Id === track.Id;
                    return (
                      <TrackRowCard
                        track={track}
                        index={index()}
                        isActive={isActive()}
                        onClick={() => playSingle(track, index())}
                      />
                    );
                  }}</For>
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
                  <For each={combined}>{(track, index) => {
                    const isActive = () => player.state.isPlaying
                      && player.state.queue[player.state.queueIndex]?.Id === track.Id;
                    const coverUrl = track.AlbumId || track.Id;
                    const hasCover = track.AlbumPrimaryImageTag || track.ImageTags?.Primary;
                    return (
                      <tr
                        class={`${audioScroll.page() > 1 ? "animate-scale-fade-in " : ""}group cursor-pointer transition-colors ${
                          isActive()
                            ? "bg-[#1db954]/10 text-[#1db954]"
                            : "text-[#e0e0e0] hover:bg-[#1a1a1a]"
                        }`}
                        onClick={() => playSingle(track, index())}
                      >
                        <td class="py-2 px-2 text-xs">
                          <span class="group-hover:hidden">{index() + 1}</span>
                          <span class="hidden group-hover:inline-flex items-center text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                          </span>
                        </td>
                        <td class="py-2 px-2">
                          <div class="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 relative">
                            <div class="absolute inset-0 bg-[#2a2a2a] animate-pulse rounded-md" />
                            {hasCover ? (
                              <img
                                src={getImageUrl(coverUrl, "Primary", 60)}
                                alt=""
                                class="w-full h-full object-cover relative"
                                style="opacity: 0"
                                onLoad={(e) => {
                                  const img = e.currentTarget;
                                  img.style.opacity = "1";
                                  const skeleton = img.parentElement?.firstElementChild as HTMLElement | null;
                                  if (skeleton) skeleton.style.display = "none";
                                }}
                              />
                            ) : (
                              <div class="w-full h-full flex items-center justify-center relative bg-[#333] rounded-md">
                                <Music size={14} class="text-[#555]" />
                              </div>
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
                            <TrackMenu track={track} queue={combined} queueIndex={index()} />
                          </div>
                        </td>
                      </tr>
                    );
                  }}</For>
                </tbody>
              </table>
              )
            ) : (
              <p class="text-[#888] text-sm mt-8 text-center">No singles found</p>
            )}
            {audioScroll.hasMore() && <div ref={audioScroll.sentinelRef} class="h-4" />}
          </div>
        );
      })()}



      {activeTab() === "playlists" && (() => {
        const items = sortedPlaylists();
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
