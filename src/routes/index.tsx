import { createResource, createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { fetchLatestAlbums, fetchFrequentAlbums, fetchArtists } from "~/lib/jellyfin";
import type { MusicAlbum, MusicArtist } from "~/lib/types";
import AlbumCard from "~/components/AlbumCard";
import ArtistCard from "~/components/ArtistCard";
import { useAuth } from "~/stores/auth";
import { useIsMobile } from "~/lib/mobile";

export default function Home() {
  const { authVersion } = useAuth();
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

  const [latest] = createResource(() => authVersion(), () => fetchLatestAlbums(12), { initialValue: [] });
  const [frequent] = createResource(() => authVersion(), () => fetchFrequentAlbums(12), { initialValue: [] });
  const [artists] = createResource(() => authVersion(), () => fetchArtists(), { initialValue: [] });

  return (
    <div class="pt-6 px-6 pb-2">
      <div
        class="sticky top-0 z-30 transition-all duration-200 -mx-6 px-6 mb-6"
        classList={{
          "bg-[#121212]/95 backdrop-blur border-b border-[#2a2a2a]": showSticky() && isMobile(),
        }}
      >
        <h1 class="text-2xl font-bold text-white py-3">Home</h1>
      </div>
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
