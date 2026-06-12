import { createSignal, onCleanup } from "solid-js";
import { ListMusic, Plus, Trash2 } from "lucide-solid";
import { usePlayer } from "~/stores/player";
import { usePlaylists } from "~/stores/playlists";
import MobileCreatePlaylist from "./MobileCreatePlaylist";
import type { Audio } from "~/lib/types";

interface Props {
  track: Audio;
  playlistId?: string;
  onClose: () => void;
}

export default function TrackBottomSheet(props: Props) {
  const player = usePlayer();
  const { removeTrack } = usePlaylists();
  const [showAddSheet, setShowAddSheet] = createSignal(false);
  const [closing, setClosing] = createSignal(false);
  const [removed, setRemoved] = createSignal(false);

  function close() {
    if (closing()) return;
    setClosing(true);
    setTimeout(() => {
      setRemoved(true);
      props.onClose();
    }, 250);
  }

  onCleanup(() => setRemoved(true));

  function handleAddToQueue() {
    player.addToQueue(props.track);
    close();
  }

  function handleRemoveFromPlaylist() {
    if (props.playlistId) {
      removeTrack(props.playlistId, props.track.Id);
    }
    close();
  }

  if (removed()) return null;

  return (
    <>
      <div
        class="fixed inset-0 z-[100] bg-black/50"
        style={{ opacity: closing() ? "0" : "1", transition: "opacity 0.25s ease-out" }}
        onClick={close}
      />
      <div
        class="fixed bottom-0 left-0 right-0 z-[110] bg-[#1a1a1a] rounded-t-2xl border-t border-[#2a2a2a]"
        classList={{
          "animate-slide-up": !closing(),
          "animate-slide-down": closing(),
        }}
      >
        <div class="flex justify-center pt-2 pb-1">
          <div class="w-8 h-1 rounded-full bg-[#555]" />
        </div>
        <div class="px-2 pb-2">
          <div class="px-3 py-2">
            <p class="text-sm font-medium text-white truncate">{props.track.Name}</p>
            <p class="text-xs text-[#888] truncate">{props.track.Artists?.join(", ") || props.track.AlbumArtist || ""}</p>
          </div>
        </div>
        <div class="border-t border-[#2a2a2a]">
          <button
            onClick={handleAddToQueue}
            class="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-[#e0e0e0] hover:bg-[#242424] transition-colors cursor-pointer"
          >
            <ListMusic size={18} />
            Add to queue
          </button>
          <button
            onClick={() => { setShowAddSheet(true); }}
            class="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-[#e0e0e0] hover:bg-[#242424] transition-colors cursor-pointer"
          >
            <Plus size={18} />
            Add to playlist
          </button>
          {props.playlistId && (
            <button
              onClick={handleRemoveFromPlaylist}
              class="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-red-400 hover:bg-[#242424] transition-colors cursor-pointer"
            >
              <Trash2 size={18} />
              Remove from playlist
            </button>
          )}
        </div>
        <div class="h-safe-area-bottom" />
      </div>

      {showAddSheet() && (
        <MobileCreatePlaylist
          trackId={props.track.Id}
          onClose={() => { setShowAddSheet(false); close(); }}
        />
      )}
    </>
  );
}
