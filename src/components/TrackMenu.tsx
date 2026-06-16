import { createSignal, onMount, onCleanup } from "solid-js";
import { usePlayer } from "~/stores/player";
import { usePlaylists } from "~/stores/playlists";
import { ListMusic, Plus, Trash2, MoreHorizontal } from "lucide-solid";
import type { Audio } from "~/lib/types";
import AddToPlaylistDialog from "./AddToPlaylistDialog";

interface Props {
  track: Audio;
  queue?: Audio[];
  queueIndex: number;
  playlistId?: string;
}

export default function TrackMenu(props: Props) {
  const player = usePlayer();
  const { removeTrack } = usePlaylists();
  const [open, setOpen] = createSignal(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = createSignal(false);
  let menuRef: HTMLDivElement | undefined;

  function handleClickOutside(e: MouseEvent) {
    if (open() && menuRef && !menuRef.contains(e.target as Node)) {
      setOpen(false);
    }
  }

  onMount(() => document.addEventListener("click", handleClickOutside));
  onCleanup(() => typeof document !== "undefined" && document.removeEventListener("click", handleClickOutside));

  function handleAddToQueue() {
    player.addToQueue(props.track);
    setOpen(false);
  }

  function handleRemoveFromPlaylist() {
    if (props.playlistId) {
      removeTrack(props.playlistId, props.track.Id);
    }
    setOpen(false);
  }

  return (
    <div ref={menuRef} class="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open()); }}
        class="text-[#888] hover:text-white transition-all duration-150 px-1 cursor-pointer active:scale-90"
        title="More"
      >
        <MoreHorizontal size={16} />
      </button>

      {open() && (
        <div class="absolute right-0 top-full mt-1 w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-[60] py-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleAddToQueue}
            class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#e0e0e0] hover:bg-[#242424] transition-all duration-150 text-left cursor-pointer active:scale-[0.97]"
          >
            <ListMusic size={16} />
            Add to queue
          </button>
          <button
            onClick={() => { setOpen(false); setShowPlaylistDialog(true); }}
            class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#e0e0e0] hover:bg-[#242424] transition-all duration-150 text-left cursor-pointer active:scale-[0.97]"
          >
            <Plus size={16} />
            Add to playlist
          </button>
          {props.playlistId && (
            <button
              onClick={handleRemoveFromPlaylist}
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#242424] transition-all duration-150 text-left cursor-pointer active:scale-[0.97]"
            >
              <Trash2 size={16} />
              Remove from playlist
            </button>
          )}
        </div>
      )}

      {showPlaylistDialog() && (
        <AddToPlaylistDialog
          trackId={props.track.Id}
          trackName={props.track.Name}
          onClose={() => setShowPlaylistDialog(false)}
        />
      )}
    </div>
  );
}
