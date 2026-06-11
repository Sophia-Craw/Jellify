import { createSignal } from "solid-js";
import { usePlaylists } from "~/stores/playlists";
import { Plus, X, Music } from "lucide-solid";

interface Props {
  trackId?: string;
  trackName?: string;
  trackIds?: string[];
  onClose: () => void;
}

export default function AddToPlaylistDialog(props: Props) {
  const { playlists, createPlaylist, addTrack } = usePlaylists();
  const [newName, setNewName] = createSignal("");
  const ids = () => props.trackIds ?? (props.trackId ? [props.trackId] : []);
  const isQueue = () => !!props.trackIds;

  function handleCreate() {
    const name = newName().trim();
    if (!name) return;
    const id = createPlaylist(name);
    for (const tid of ids()) addTrack(id, tid);
    props.onClose();
  }

  function handleSelect(playlistId: string) {
    for (const tid of ids()) addTrack(playlistId, tid);
    props.onClose();
  }

  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={props.onClose}>
      <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl w-80 max-h-96 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between p-3 border-b border-[#2a2a2a]">
          <p class="text-sm font-semibold text-white">{isQueue() ? "Save queue to playlist" : "Add to playlist"}</p>
          <button onClick={props.onClose} class="text-[#888] hover:text-white transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div class="p-3 border-b border-[#2a2a2a] flex gap-2">
          <input
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            placeholder="New playlist name..."
            class="flex-1 bg-[#121212] text-white text-sm px-2 py-1.5 rounded border border-[#2a2a2a] outline-none focus:border-[#1db954]"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={!newName().trim()}
            class="bg-[#1db954] text-black px-2 py-1.5 rounded text-sm font-medium hover:bg-[#1ed760] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          {playlists.length === 0 && (
            <p class="text-[#555] text-xs text-center py-6">No playlists yet</p>
          )}
          {playlists.map((p) => (
            <button
              onClick={() => handleSelect(p.id)}
              class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-[#242424] transition-colors text-left cursor-pointer"
            >
              <div class="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ "background-color": p.color }}>
                {p.coverDataUrl ? (
                  <img src={p.coverDataUrl} alt="" class="w-full h-full object-cover" />
                ) : (
                  <Music size={14} class="text-white" />
                )}
              </div>
              <span class="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
