import { A } from "@solidjs/router";
import type { MusicArtist } from "~/lib/types";
import { getImageUrl } from "~/lib/jellyfin";
import { createMemo } from "solid-js";
import { User } from "lucide-solid";

export default function ArtistCard(props: { artist: MusicArtist }) {
  const { artist } = props;
  const hasImage = createMemo(() => !!artist.ImageTags?.Primary);

  return (
    <A
      href={`/artist/${artist.Id}`}
      class="group block rounded-lg p-3 transition-all duration-200 active:scale-[0.97] hover:bg-[#242424]"
    >
      <div class="relative aspect-square mb-3 rounded-full overflow-hidden bg-[#242424]">
        {hasImage() ? (
          <img
            src={getImageUrl(artist.Id, "Primary", 200)}
            alt={artist.Name}
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div class="w-full h-full flex items-center justify-center text-[#555]">
            <User size={32} />
          </div>
        )}
      </div>
      <h3 class="text-sm font-semibold text-white text-center truncate">{artist.Name || "Unknown Artist"}</h3>
    </A>
  );
}
