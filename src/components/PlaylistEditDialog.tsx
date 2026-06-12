import { createSignal } from "solid-js";
import { usePlaylists } from "~/stores/playlists";
import { X, Music, Trash2, Camera } from "lucide-solid";

interface Props {
  playlistId: string;
  onClose: () => void;
  mobile?: boolean;
}

export default function PlaylistEditDialog(props: Props) {
  const { playlists, renamePlaylist, setCover, deletePlaylist } = usePlaylists();
  const playlist = () => playlists.find((p) => p.id === props.playlistId);

  const [name, setName] = createSignal(playlist()?.name ?? "");
  const [deleteConfirm, setDeleteConfirm] = createSignal(false);
  const [closing, setClosing] = createSignal(false);

  function handleSave() {
    const n = name().trim();
    if (!n) return;
    renamePlaylist(props.playlistId, n);
    close();
  }

  function handleDelete() {
    if (!deleteConfirm()) {
      setDeleteConfirm(true);
      return;
    }
    deletePlaylist(props.playlistId);
    close();
  }

  function handleCoverUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCover(props.playlistId, reader.result as string);
    reader.readAsDataURL(file);
  }

  function close() {
    if (props.mobile) {
      if (closing()) return;
      setClosing(true);
      setTimeout(props.onClose, 250);
    } else {
      props.onClose();
    }
  }

  const p = playlist;
  const color = () => p()?.color ?? "#333";

  if (props.mobile) {
    return (
      <>
        <div
          class="fixed inset-0 z-[100] bg-black/50"
          classList={{ "opacity-0": closing() }}
          style={{ transition: "opacity 0.25s ease-out" }}
          onClick={close}
        />
        <div
          class="fixed bottom-0 left-0 right-0 z-[110] bg-[#1a1a1a] border-t border-[#2a2a2a] rounded-t-2xl flex flex-col"
          classList={{
            "animate-slide-up": !closing(),
            "animate-slide-down": closing(),
          }}
        >
          <div class="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
            <p class="text-lg font-semibold text-white">Edit playlist</p>
            <button onClick={close} class="w-8 h-8 flex items-center justify-center text-[#888] hover:text-white transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <div class="px-4 pb-6 space-y-4">
            <div class="flex items-center gap-4">
              <label class="w-20 h-20 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden shrink-0 relative group" style={{ "background-color": color() }}>
                {p()?.coverDataUrl ? (
                  <img src={p()!.coverDataUrl} alt="" class="w-full h-full object-cover" />
                ) : (
                  <Music size={28} class="text-white" />
                )}
                <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                  <Camera size={18} class="text-white" />
                </div>
                <input type="file" accept="image/*" onChange={handleCoverUpload} class="hidden" />
              </label>
              <div class="flex-1 min-w-0">
                <input
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  class="w-full bg-[#121212] text-white text-sm px-3 py-2.5 rounded-lg border border-[#2a2a2a] outline-none focus:border-[#1db954] placeholder-[#555]"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <p class="text-[#555] text-[10px] mt-1.5">{p()?.trackIds.length ?? 0} tracks</p>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <button
                onClick={handleDelete}
                class={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                  deleteConfirm() ? "text-red-400" : "text-[#555] hover:text-red-400"
                }`}
              >
                <Trash2 size={14} />
                {deleteConfirm() ? "Confirm delete?" : "Delete playlist"}
              </button>
              <button
                onClick={handleSave}
                disabled={!name().trim()}
                class="px-4 py-2 text-xs bg-[#1db954] text-black rounded-lg font-medium hover:bg-[#1ed760] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>

          <div class="h-safe-area-bottom" />
        </div>
      </>
    );
  }

  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={close}>
      <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl w-80" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between p-3 border-b border-[#2a2a2a]">
          <p class="text-sm font-semibold text-white">Edit playlist</p>
          <button onClick={close} class="text-[#888] hover:text-white transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div class="p-3 space-y-3">
          <div class="flex items-center gap-3">
            <label class="w-14 h-14 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0 relative group" style={{ "background-color": color() }}>
              {p()?.coverDataUrl ? (
                <img src={p()!.coverDataUrl} alt="" class="w-full h-full object-cover" />
              ) : (
                <Music size={22} class="text-white" />
              )}
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span class="text-[10px] text-white font-medium">Edit</span>
              </div>
              <input type="file" accept="image/*" onChange={handleCoverUpload} class="hidden" />
            </label>
            <div class="flex-1 min-w-0">
              <input
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                class="w-full bg-[#121212] text-white text-sm px-2 py-1.5 rounded border border-[#2a2a2a] outline-none focus:border-[#1db954]"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <p class="text-[#555] text-[10px] mt-1">{p()?.trackIds.length ?? 0} tracks</p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between p-3 border-t border-[#2a2a2a]">
          <button
            onClick={handleDelete}
            class={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
              deleteConfirm() ? "text-red-400" : "text-[#555] hover:text-red-400"
            }`}
          >
            <Trash2 size={14} />
            {deleteConfirm() ? "Confirm delete?" : "Delete"}
          </button>
          <div class="flex gap-2">
            <button
              onClick={close}
              class="px-3 py-1.5 text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name().trim()}
              class="px-3 py-1.5 text-xs bg-[#1db954] text-black rounded font-medium hover:bg-[#1ed760] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
