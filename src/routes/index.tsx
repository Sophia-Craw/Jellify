import { createResource, onMount, onCleanup, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { fetchLatestAlbums, fetchFrequentAlbums, fetchArtists } from "~/lib/jellyfin";
import type { MusicAlbum, MusicArtist } from "~/lib/types";
import AlbumCard from "~/components/AlbumCard";
import ArtistCard from "~/components/ArtistCard";
import { useAuth } from "~/stores/auth";
import { AlertTriangle } from "lucide-solid";
import { setHeaderTitle, setHeaderSubtitle, setHeaderImageUrl, setShowHeaderExtra } from "~/lib/mobileHeader";

export default function Home() {
  const { authVersion } = useAuth();

  onMount(() => {
    setHeaderTitle("Home");
    setHeaderSubtitle("");
    setHeaderImageUrl("");
    setShowHeaderExtra(false);
  });

  const [latest, latestRes] = createResource(() => authVersion(), () => fetchLatestAlbums(12), { initialValue: [] });
  const [frequent, frequentRes] = createResource(() => authVersion(), () => fetchFrequentAlbums(12), { initialValue: [] });
  const [artists, artistsRes] = createResource(() => authVersion(), () => fetchArtists(), { initialValue: [] });

  const hasError = () => latestRes.error || frequentRes.error || artistsRes.error;

  let sentinelRef: HTMLDivElement | undefined;

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
    <div class="pt-32 px-6 pb-2">
      <Show when={hasError()}>
        <div class="flex items-center gap-2 mb-4 px-3 py-2 bg-red-900/20 border border-red-900/30 rounded-lg text-xs text-red-400">
          <AlertTriangle size={14} />
          <span>Failed to load some content. Check your connection and server settings.</span>
        </div>
      </Show>
      <h1 class="text-2xl font-bold text-white mb-6">Home</h1>
      <div ref={sentinelRef} class="h-px" />

      <Show when={latest().length > 0}>
        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Recently Added</h2>
            <A href="/library?tab=albums" class="text-sm text-[#888] hover:text-white transition-colors">
              Show all
            </A>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <For each={latest()}>{(album) => <AlbumCard album={album} />}</For>
          </div>
        </section>
      </Show>

      <Show when={frequent().length > 0}>
        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Most Played</h2>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <For each={frequent()}>{(album) => <AlbumCard album={album} />}</For>
          </div>
        </section>
      </Show>

      <Show when={artists().length > 0}>
        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Artists</h2>
            <A href="/library?tab=artists" class="text-sm text-[#888] hover:text-white transition-colors">
              Show all
            </A>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <For each={artists().slice(0, 6)}>{(artist) => <ArtistCard artist={artist} />}</For>
          </div>
        </section>
      </Show>
    </div>
  );
}
