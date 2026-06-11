import { createMemo } from "solid-js";
import { A } from "@solidjs/router";
import type { MusicAlbum } from "~/lib/types";
import { getImageUrl } from "~/lib/jellyfin";
import { Music } from "lucide-solid";

export default function AlbumCard(props: {
  album: MusicAlbum;
  href?: string;
  imageId?: string;
  subtitle?: string;
}) {
  const { album, href, imageId, subtitle } = props;
  const hasImage = createMemo(() => !!album.ImageTags?.Primary || !!imageId);
  const linkHref = href || `/album/${album.Id}`;
  const imgSrc = createMemo(() =>
    imageId
      ? getImageUrl(imageId, "Primary", 200)
      : getImageUrl(album.Id, "Primary", 200)
  );

  return (
    <A
      href={linkHref}
      class="group block bg-[#1a1a1a] rounded-lg p-3 hover:bg-[#242424] transition-colors"
    >
      <div class="relative aspect-square mb-3 rounded overflow-hidden bg-[#242424]">
        {hasImage() ? (
          <img
            src={imgSrc()}
            alt={album.Name}
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div class="w-full h-full flex items-center justify-center text-[#555]">
            <Music size={32} />
          </div>
        )}
      </div>
      <h3 class="text-sm font-semibold text-white truncate">{album.Name}</h3>
      <p class="text-xs text-[#888] truncate mt-1">
        {album.AlbumArtist || album.Artists?.join(", ") || "Unknown Artist"}
      </p>
      {subtitle ? (
        <p class="text-xs text-[#555] mt-0.5">{subtitle}</p>
      ) : album.ProductionYear ? (
        <p class="text-xs text-[#555] mt-0.5">{album.ProductionYear}</p>
      ) : null}
    </A>
  );
}
