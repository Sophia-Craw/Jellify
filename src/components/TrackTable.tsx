import { type Component } from "solid-js";
import type { Audio } from "~/lib/types";
import { usePlayer } from "~/stores/player";
import { useIsMobile } from "~/lib/mobile";
import { A } from "@solidjs/router";
import { Play } from "lucide-solid";
import TrackMenu from "./TrackMenu";
import TrackRowCard from "./TrackRowCard";

export default function TrackTable(props: {
  tracks: Audio[];
  queue?: Audio[];
  playlistId?: string;
}) {
  const player = usePlayer();
  const { state } = player;
  const isMobile = useIsMobile();

  function playTrack(track: Audio, index: number) {
    const queue = props.queue ?? props.tracks;
    player.play(track, queue, index);
  }

  function formatTicks(ticks?: number): string {
    if (!ticks) return "0:00";
    const totalSeconds = ticks / 10000000;
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <>
      {isMobile() ? (
        <div class="space-y-1">
          {props.tracks.map((track, index) => {
            const isActive = state.isPlaying
              && state.queue[state.queueIndex]?.Id === track.Id;
            return (
              <TrackRowCard
                track={track}
                index={index}
                isActive={isActive}
                onClick={() => playTrack(track, index)}
                playlistId={props.playlistId}
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
          <th class="text-left py-2 px-2 hidden sm:table-cell">Artist</th>
          <th class="text-right py-2 px-2 w-16">Duration</th>
          <th class="py-2 px-2 w-8"></th>
        </tr>
      </thead>
      <tbody>
        {props.tracks.map((track, index) => {
          const isActive = state.isPlaying
            && state.queue[state.queueIndex]?.Id === track.Id;
          return (
            <tr
              class={`group cursor-pointer transition-colors ${
                isActive
                  ? "bg-[#1db954]/10 text-[#1db954]"
                  : "text-[#e0e0e0] hover:bg-[#1a1a1a]"
              }`}
              onClick={() => playTrack(track, index)}
            >
              <td class="py-2 px-2 text-xs">
                <span class="group-hover:hidden">{index + 1}</span>
                <span class="hidden group-hover:inline-flex items-center text-white"><Play size={12} fill="currentColor" /></span>
              </td>
              <td class="py-2 px-2">
                <p class="truncate max-w-[200px] sm:max-w-none">{track.Name}</p>
              </td>
              <td class="py-2 px-2 text-xs hidden sm:table-cell truncate max-w-[150px]">
                {track.ArtistItems?.[0] ? (
                  <A href={`/artist/${track.ArtistItems[0].Id}`} class="text-[#888] hover:text-white hover:underline">{track.ArtistItems[0].Name}</A>
                ) : (
                  <span class="text-[#888]">{track.Artists?.join(", ") || track.AlbumArtist || ""}</span>
                )}
              </td>
              <td class="py-2 px-2 text-right text-xs text-[#888]">
                {formatTicks(track.RunTimeTicks)}
              </td>
              <td class="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                <TrackMenu track={track} queue={props.queue ?? props.tracks} queueIndex={index} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
      )}
    </>
  );
}
