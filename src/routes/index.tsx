import { createResource, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { fetchLatestAlbums, fetchFrequentAlbums, fetchArtists } from "~/lib/jellyfin";
import type { MusicAlbum, MusicArtist } from "~/lib/types";
import AlbumCard from "~/components/AlbumCard";
import ArtistCard from "~/components/ArtistCard";
import { useAuth } from "~/stores/auth";

export default function Home() {
  const { authVersion } = useAuth();
  const [latest] = createResource(() => authVersion(), () => fetchLatestAlbums(12), { initialValue: [] });
  const [frequent] = createResource(() => authVersion(), () => fetchFrequentAlbums(12), { initialValue: [] });
  const [artists] = createResource(() => authVersion(), () => fetchArtists(), { initialValue: [] });

  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold text-white mb-6">Home</h1>

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
