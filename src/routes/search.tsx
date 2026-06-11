import { createResource, createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { searchAll, getImageUrl, fetchGenres, makeSlug } from "~/lib/jellyfin";
import { Search, X, Music, Play, Clock } from "lucide-solid";
import { colorFromString } from "~/lib/colors";
import type { SearchHintResult, Genre } from "~/lib/types";
import { usePlayer } from "~/stores/player";
import { useAuth } from "~/stores/auth";
import { useIsMobile } from "~/lib/mobile";

function loadRecent(): { term: string; ts: number }[] {
  if (typeof document === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("jusic_recent_searches") || "[]");
  } catch { return []; }
}

function saveRecent(term: string) {
  const recent = loadRecent().filter((r) => r.term !== term);
  recent.unshift({ term, ts: Date.now() });
  localStorage.setItem("jusic_recent_searches", JSON.stringify(recent.slice(0, 10)));
}

export default function SearchPage() {
  const { authVersion } = useAuth();
  const isMobile = useIsMobile();
  const [query, setQuery] = createSignal("");
  const [searchTerm, setSearchTerm] = createSignal("");
  const [hydrated, setHydrated] = createSignal(false);
  const [recent, setRecent] = createSignal<{ term: string; ts: number }[]>([]);
  const [showSticky, setShowSticky] = createSignal(false);
  let sentinelRef: HTMLDivElement | undefined;

  const [genres] = createResource(() => authVersion(), () => fetchGenres(), { initialValue: [] });

  onMount(() => {
    setRecent(loadRecent());
    setHydrated(true);

    if (!sentinelRef) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinelRef);
    onCleanup(() => observer.disconnect());
  });

  const [results] = createResource(searchTerm, async (term) => {
    if (!term.trim()) return null;
    return searchAll(term, 30);
  });

  function doSearch(val: string) {
    setSearchTerm(val);
    saveRecent(val);
    setRecent(loadRecent());
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    const val = query().trim();
    if (!val) return;
    doSearch(val);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      const val = query().trim();
      if (!val) return;
      doSearch(val);
    }
  }

  function clearSearch() {
    setQuery("");
    setSearchTerm("");
  }

  const showDefault = () => !searchTerm().trim();

  return (
    <div class="pt-6 px-6 pb-2">
      <div
        class="sticky top-0 z-30 transition-all duration-200 -mx-6 px-6 mb-6"
        classList={{
          "bg-[#121212]/95 backdrop-blur border-b border-[#2a2a2a]": showSticky() && isMobile(),
        }}
      >
        <form onSubmit={handleSubmit} class="relative py-3">
          <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
        <input
          type="text"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search artists, albums, tracks..."
          class="w-full bg-[#1a1a1a] text-white text-sm pl-10 pr-16 py-2.5 rounded-lg border border-[#2a2a2a] outline-none focus:border-[#1db954] transition-colors"
        />
        <Show when={!query()}>
          <kbd class="absolute right-3 top-1/2 -translate-y-1/2 text-[#aaa] text-xs bg-[#2a2a2a] px-1.5 py-0.5 rounded font-mono pointer-events-none">
            Enter
          </kbd>
        </Show>
        <Show when={query()}>
          <button type="button" onClick={clearSearch} class="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </Show>
      </form>
      </div>
      <div ref={sentinelRef} class="h-px" />

      <Show when={showDefault()}>
        <div class="mb-8">
          <h2 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Clock size={16} class="text-[#555]" />
            Recent searches
          </h2>
          <Show when={hydrated() && recent().length > 0}>
            <div class="flex flex-wrap gap-2">
              <For each={recent()}>
                {(r) => (
                  <button
                    onClick={() => { setQuery(r.term); doSearch(r.term); }}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#888] bg-[#1a1a1a] hover:bg-[#242424] hover:text-white rounded-full transition-colors cursor-pointer"
                  >
                    <Clock size={12} />
                    {r.term}
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={hydrated() && recent().length === 0}>
            <p class="text-[#555] text-xs">No recent searches yet</p>
          </Show>
        </div>

        <GenreSection genres={genres()} loaded={genres().length > 0 || !genres.loading} />
      </Show>

      <Show when={!showDefault()}>
        <Show when={results.loading}>
          <div class="flex items-center justify-center py-12">
            <div class="w-6 h-6 border-2 border-[#1db954] border-t-transparent rounded-full animate-spin" />
          </div>
        </Show>
        <Show when={!results.loading && results()}>
          <SearchResultsView results={results()!} />
        </Show>
      </Show>
    </div>
  );
}

function SearchResultsView(props: { results: SearchHintResult }) {
  const player = usePlayer();
  const artists = () => props.results.SearchHints.filter((h) => h.Type === "MusicArtist");
  const albums = () => props.results.SearchHints.filter((h) => h.Type === "MusicAlbum");
  const tracks = () => props.results.SearchHints.filter((h) => h.Type === "Audio");

  return (
    <div class="space-y-6">
      <Show when={artists().length > 0}>
        <section>
          <h2 class="text-sm font-semibold text-white mb-3">Artists</h2>
          <div class="flex flex-wrap gap-3">
            <For each={artists()}>
              {(a) => (
                <a
                  href={`/artist/${a.ItemId}`}
                  class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm text-white hover:bg-[#1a1a1a]"
                >
                  <div class="w-8 h-8 rounded-full bg-[#333] overflow-hidden flex-shrink-0">
                    {a.PrimaryImageTag && (
                      <img src={getImageUrl(a.ItemId, "Primary", 60)} alt="" class="w-full h-full object-cover" />
                    )}
                  </div>
                  <span class="truncate max-w-[150px]">{a.Name}</span>
                </a>
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={albums().length > 0}>
        <section>
          <h2 class="text-sm font-semibold text-white mb-3">Albums</h2>
          <div class="flex flex-wrap gap-3">
            <For each={albums()}>
              {(a) => (
                <a
                  href={`/album/${a.ItemId}`}
                  class="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#242424] rounded-lg transition-colors text-sm text-white"
                >
                  <div class="w-8 h-8 rounded bg-[#333] overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {a.PrimaryImageTag ? (
                      <img src={getImageUrl(a.ItemId, "Primary", 60)} alt="" class="w-full h-full object-cover" />
                    ) : (
                      <Music size={14} class="text-[#555]" />
                    )}
                  </div>
                  <div class="min-w-0">
                    <p class="text-white truncate max-w-[200px]">{a.Name}</p>
                    {a.AlbumArtist && <p class="text-[#888] text-xs truncate">{a.AlbumArtist}</p>}
                  </div>
                </a>
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={tracks().length > 0}>
        <section>
          <h2 class="text-sm font-semibold text-white mb-3">Tracks</h2>
          <div class="space-y-1">
            <For each={tracks()}>
              {(t) => {
                function formatTicks(ticks?: number): string {
                  if (!ticks) return "0:00";
                  const s = Math.floor(ticks / 10000000);
                  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
                }
                const isActive = () => player.state.isPlaying
                  && player.state.queue[player.state.queueIndex]?.Id === t.ItemId;
                const inner = (
                  <>
                    <div class="w-8 h-8 rounded-md bg-[#333] overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                      {t.AlbumId ? (
                        <img src={getImageUrl(t.AlbumId, "Primary", 60)} alt="" class="w-full h-full object-cover" onError={(e) => { e.currentTarget.remove() }} />
                      ) : (
                        <img src={getImageUrl(t.ItemId, "Primary", 60)} alt="" class="w-full h-full object-cover" onError={(e) => { e.currentTarget.remove() }} />
                      )}
                      <span class="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/40 text-white">
                        <Play size={12} fill="currentColor" />
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class={`truncate ${isActive() ? "text-[#1db954]" : "text-white"}`}>{t.Name}</p>
                      <p class={`text-xs truncate ${isActive() ? "text-[#1db954]/70" : "text-[#888]"}`}>{t.Artists?.join(", ") || t.AlbumArtist || ""}</p>
                    </div>
                    <span class={`text-xs ${isActive() ? "text-[#1db954]/70" : "text-[#555]"}`}>{formatTicks(t.RunTimeTicks)}</span>
                  </>
                );
                return (
                  <Show when={t.AlbumId || t.Album} fallback={
                    <div class={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive() ? "bg-[#1db954]/10 text-[#1db954]" : ""}`}>
                      {inner}
                    </div>
                  }>
                    <a
                      href={t.AlbumId ? `/album/${t.AlbumId}` : `/virtual-album/${makeSlug(t.Album!)}`}
                      class={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer group text-sm ${isActive() ? "bg-[#1db954]/10 text-[#1db954]" : "hover:bg-[#1a1a1a]"}`}
                    >
                      {inner}
                    </a>
                  </Show>
                );
              }}
            </For>
          </div>
        </section>
      </Show>

      <Show when={artists().length === 0 && albums().length === 0 && tracks().length === 0}>
        <p class="text-[#555] text-sm text-center mt-8">No results found</p>
      </Show>
    </div>
  );
}

function GenreSection(props: { genres: Genre[]; loaded: boolean }) {
  return (
    <div>
      <h2 class="text-sm font-semibold text-white mb-3">Browse genres</h2>
      <Show when={!props.loaded} fallback={
        <Show when={props.genres.length > 0}>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
            <For each={props.genres}>
              {(genre) => {
                const color = colorFromString(genre.Name);
                return (
                  <a
                    href={`/library?tab=albums&genre=${encodeURIComponent(genre.Name)}`}
                    class="px-3 py-2 rounded text-sm font-medium text-white transition-transform hover:scale-105 text-left truncate"
                    style={{
                      "background-color": color,
                      "background-image": "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35))",
                      "background-blend-mode": "overlay",
                    }}
                  >
                    {genre.Name}
                  </a>
                );
              }}
            </For>
          </div>
        </Show>
      }>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          <For each={Array.from({ length: 12 })}>
            {() => (
              <div class="px-3 py-2 rounded bg-[#1a1a1a] animate-pulse h-[36px]" />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
