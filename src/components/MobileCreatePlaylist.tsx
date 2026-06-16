import { createSignal } from "solid-js";
import { usePlaylists, type Playlist } from "~/stores/playlists";
import { X, Music, Trash2, Plus, ChevronRight, Check } from "lucide-solid";

interface Props {
  onClose: () => void;
  trackId?: string;
  trackIds?: string[];
}

export default function MobileCreatePlaylist(props: Props) {
  const { playlists, createPlaylist, renamePlaylist, deletePlaylist, addTrack } = usePlaylists();
  const [name, setName] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal("");
  const [closing, setClosing] = createSignal(false);
  const [deleteConfirmId, setDeleteConfirmId] = createSignal<string | null>(null);

  const ids = () => props.trackIds ?? (props.trackId ? [props.trackId] : []);
  const isPicker = () => ids().length > 0;

  function handleCreate() {
    const n = name().trim();
    if (!n) return;
    const id = createPlaylist(n);
    if (isPicker()) {
      for (const tid of ids()) addTrack(id, tid);
      close();
    }
    setName("");
  }

  function handleSelect(p: Playlist) {
    if (isPicker()) {
      for (const tid of ids()) addTrack(p.id, tid);
      close();
      return;
    }
    // Not in picker mode — fall through to regular playlist list behavior
  }

  function startEdit(p: Playlist) {
    setEditingId(p.id);
    setEditName(p.name);
    setDeleteConfirmId(null);
  }

  function saveEdit() {
    const id = editingId();
    if (!id) return;
    const n = editName().trim();
    if (!n) return;
    renamePlaylist(id, n);
    setEditingId(null);
    setEditName("");
  }

  function handleDelete(id: string) {
    if (deleteConfirmId() === id) {
      deletePlaylist(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  }

  function close() {
    if (closing()) return;
    setClosing(true);
    setTimeout(props.onClose, 250);
  }

  return (
    <>
      <div
        class="fixed inset-0 z-[100] bg-black/50"
        classList={{ "opacity-0": closing() }}
        style={{ transition: "opacity 0.25s ease-out" }}
        onClick={close}
      />
      <div
        class="fixed bottom-0 left-0 right-0 z-[110] bg-[#1a1a1a] border-t border-[#2a2a2a] rounded-t-2xl max-h-[75vh] flex flex-col"
        classList={{
          "animate-slide-up": !closing(),
          "animate-slide-down": closing(),
        }}
      >
        <div class="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <p class="text-lg font-semibold text-white">{isPicker() ? "Add to playlist" : "Playlists"}</p>
          <button onClick={close} class="w-8 h-8 flex items-center justify-center text-[#888] hover:text-white transition-all duration-150 cursor-pointer active:scale-90">
            <X size={20} />
          </button>
        </div>

        <div class="flex items-center gap-2 px-4 pb-4 shrink-0">
            <input
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="New playlist name..."
              class="flex-1 bg-[#121212] text-white text-sm px-3 py-2.5 rounded-lg border border-[#2a2a2a] outline-none focus:border-[#1db954] placeholder-[#555]"
            />
            <button
              onClick={handleCreate}
              disabled={!name().trim()}
              class="w-10 h-10 rounded-full bg-[#1db954] text-black flex items-center justify-center hover:bg-[#1ed760] transition-all duration-150 disabled:opacity-50 disabled:hover:bg-[#1db954] cursor-pointer shrink-0 active:scale-90"
            >
              <Plus size={20} />
            </button>
          </div>

        <div class="overflow-y-auto px-4 pb-6 space-y-1">
          {playlists.length === 0 ? (
            <p class="text-center text-[#555] text-sm py-8">No playlists yet</p>
          ) : (
            playlists.map((p) => (
              <div
                class="flex items-center gap-3 py-2.5 group"
                classList={{ "cursor-pointer hover:bg-[#242424] rounded-lg px-2 -mx-2 transition-all duration-150 active:scale-[0.97]": isPicker() }}
                onClick={() => isPicker() && handleSelect(p)}
              >
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ "background-color": p.color }}
                >
                  {p.coverDataUrl ? (
                    <img src={p.coverDataUrl} alt="" class="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Music size={16} class="text-white" />
                  )}
                </div>

                {editingId() === p.id ? (
                  <div class="flex-1 flex items-center gap-2 min-w-0">
                    <input
                      value={editName()}
                      onInput={(e) => setEditName(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      class="flex-1 bg-[#121212] text-white text-sm px-2 py-1.5 rounded border border-[#2a2a2a] outline-none focus:border-[#1db954]"
                      autoFocus
                    />
                    <button onClick={saveEdit} class="text-xs text-[#1db954] font-medium cursor-pointer hover:underline transition-colors active:scale-90">Save</button>
                    <button onClick={() => setEditingId(null)} class="text-xs text-[#888] cursor-pointer hover:underline transition-colors active:scale-90">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-white truncate">{p.name}</p>
                      <p class="text-[10px] text-[#555]">{p.trackIds.length} tracks</p>
                    </div>
                    {isPicker() ? (
                      <Check size={18} class="text-[#1db954] opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                          class="text-[#555] hover:text-white transition-all duration-150 cursor-pointer active:scale-90"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                          class={`transition-all duration-150 cursor-pointer active:scale-90 ${
                            deleteConfirmId() === p.id ? "text-red-400" : "text-[#555] hover:text-red-400"
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
