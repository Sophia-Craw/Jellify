import { A, useLocation } from "@solidjs/router";
import { createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { House, Library, Search, LogIn, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Music, Pencil, GripVertical, ArrowUpDown } from "lucide-solid";
import Sortable from "sortablejs";
import { usePlaylists } from "~/stores/playlists";
import { useAuth } from "~/stores/auth";
import PlaylistEditDialog from "./PlaylistEditDialog";

export default function Sidebar() {
  const location = useLocation();
  const { auth, logout } = useAuth();
  const [collapsed, setCollapsed] = createSignal(false);
  const [reorderMode, setReorderMode] = createSignal(false);
  const { playlists, createPlaylist, setPlaylistOrder } = usePlaylists();
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [hydrated, setHydrated] = createSignal(false);
  let sortableContainer: HTMLDivElement | undefined;
  let sortableInstance: Sortable | undefined;
  let creating = false;
  onMount(() => setHydrated(true));

  function createSortableInstance() {
    if (!reorderMode() || collapsed() || !sortableContainer || typeof document === "undefined") return;
    
    sortableInstance = new Sortable(sortableContainer, {
      handle: ".drag-handle",
      animation: 200,
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      onStart: (evt) => {
        // Store the original order before drag starts
        if (!sortableContainer) return;
        const els = sortableContainer.querySelectorAll<HTMLElement>("[data-playlist-id]");
        const originalOrder = Array.from(els).map(el => el.dataset.playlistId!);
        sortableContainer.dataset.originalOrder = JSON.stringify(originalOrder);
      },
      onEnd: (evt) => {
        if (!sortableContainer) return;
        
        // Get the original order
        const originalOrder: string[] = JSON.parse(sortableContainer.dataset.originalOrder || "[]");
        
        // Get the new order from DOM (after SortableJS moved elements)
        const els = sortableContainer.querySelectorAll<HTMLElement>("[data-playlist-id]");
        const newOrder = Array.from(els).map(el => el.dataset.playlistId!);
        
        // Revert DOM back to original order
        originalOrder.forEach(id => {
          const el = sortableContainer!.querySelector(`[data-playlist-id="${id}"]`);
          if (el) sortableContainer!.appendChild(el);
        });
        
        // Destroy Sortable before updating store
        sortableInstance?.destroy();
        sortableInstance = undefined;
        
        // Update store - SolidJS will handle the DOM reordering
        setPlaylistOrder(newOrder);
        
        // Recreate Sortable after store update
        setTimeout(() => createSortableInstance(), 0);
      },
    });
  }

  createEffect(() => {
    if (reorderMode() && !collapsed()) {
      createSortableInstance();
    } else {
      sortableInstance?.destroy();
      sortableInstance = undefined;
    }
  });

  onCleanup(() => {
    sortableInstance?.destroy();
  });

  function toggleReorder() {
    setReorderMode(!reorderMode());
  }

  function handleCollapse() {
    setCollapsed(!collapsed());
    setReorderMode(false);
  }

  function handleCreate() {
    if (creating) return;
    creating = true;
    const id = createPlaylist(`Playlist ${playlists.length + 1}`);
    creating = false;
    setEditingId(id);
  }

  const coverIcon = (p: { color: string; coverDataUrl?: string }) => (
    <span class="w-6 flex items-center justify-center flex-shrink-0">
      <span class="w-4 h-4 rounded flex items-center justify-center overflow-hidden" style={{ "background-color": p.color }}>
        {p.coverDataUrl ? (
          <img src={p.coverDataUrl} alt="" class="w-full h-full object-cover" />
        ) : (
          <Music size={10} class="text-white" />
        )}
      </span>
    </span>
  );

  return (
    <aside
      class="flex flex-col bg-[#121212] border-r border-[#2a2a2a] transition-all duration-200"
      classList={{ "w-14": collapsed(), "w-48": !collapsed() }}
    >
      <div class="flex items-center h-14 border-b border-[#2a2a2a]" classList={{ "justify-center": collapsed(), "px-3": !collapsed() }}>
        <button
          onClick={handleCollapse}
          class="text-[#888] hover:text-white transition-colors p-1 cursor-pointer"
          title={collapsed() ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed() ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        {!collapsed() && (
          <span class="ml-3 text-white font-semibold text-sm tracking-wide">Jellify</span>
        )}
      </div>

      <nav class="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href
            || (item.href !== "/" && location.pathname.startsWith(item.href));
          return (
            <A
              href={item.href}
              class={`flex items-center h-10 rounded-md transition-colors ${
                collapsed() ? "justify-center w-full" : "px-3 mx-1"
              } ${isActive ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"}`}
            >
              <span class="w-6 flex items-center justify-center">{item.icon()}</span>
              {!collapsed() && <span class="ml-3 text-sm">{item.label}</span>}
            </A>
          );
        })}

        <div class="flex items-center mt-2 mb-1" classList={{ "justify-between px-3": !collapsed(), "justify-center": collapsed() }}>
          <span class="text-[#555] text-xs font-semibold uppercase tracking-wider">{collapsed() ? "P" : "Playlists"}</span>
          {!collapsed() && (
            <button
              onClick={toggleReorder}
              class="p-1 rounded cursor-pointer transition-colors"
              classList={{ "bg-[#1db954] text-white": reorderMode(), "text-[#555] hover:text-white": !reorderMode() }}
              title={reorderMode() ? "Done reordering" : "Reorder playlists"}
            >
              <ArrowUpDown size={14} />
            </button>
          )}
        </div>
        {!hydrated() && !auth && !collapsed() && (
          <div class="px-3 py-1.5 text-xs text-[#555]">Loading...</div>
        )}
        {hydrated() && !auth && (
          <A
            href="/auth"
            class={`flex items-center h-9 rounded-md transition-colors text-[#888] hover:text-white hover:bg-[#1a1a1a] ${
              collapsed() ? "justify-center w-full" : "px-3 mx-1"
            }`}
          >
            <span class="w-6 flex items-center justify-center"><LogIn size={16} /></span>
            {!collapsed() && <span class="ml-3 text-sm">Sign in</span>}
          </A>
        )}
        <button
          onClick={handleCreate}
          class={`flex items-center text-sm text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors rounded-md cursor-pointer ${
            collapsed()
              ? "justify-center w-full py-2"
              : "gap-2 w-full px-3 py-1.5"
          }`}
        >
          <Plus size={16} />
          {!collapsed() && "New playlist"}
        </button>
        {hydrated() && playlists.length > 0 && (
          <div ref={(el) => { sortableContainer = el; }}>
            {playlists.map((p) => {
              const isActive = location.pathname === `/playlist/${p.id}`;
              return (
                <div
                  data-playlist-id={p.id}
                  class={`relative flex items-center h-9 rounded-md transition-colors group ${
                    collapsed() ? "justify-center w-full" : "mx-1 px-3"
                  }`}
                  classList={{ "bg-[#1a1a1a]": isActive && !reorderMode() }}
                >
                  {reorderMode() && !collapsed() ? (
                    <>
                      <span class="flex items-center flex-1 min-w-0 text-[#888] pointer-events-none select-none">
                        {coverIcon(p)}
                        <span class="ml-3 text-sm truncate">{p.name}</span>
                      </span>
                      <span class="drag-handle text-[#555] px-1 flex-shrink-0 select-none" style={{ cursor: "grab" }}>
                        <GripVertical size={14} />
                      </span>
                    </>
                  ) : (
                    <>
                      <A
                        href={`/playlist/${p.id}`}
                        class={`flex items-center flex-1 min-w-0 h-full ${isActive ? "text-white" : "text-[#888] hover:text-white"}`}
                        classList={{ "justify-center": collapsed() }}
                      >
                        {coverIcon(p)}
                        {!collapsed() && <span class="ml-3 text-sm truncate">{p.name}</span>}
                      </A>
                      {!collapsed() && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingId(p.id); }}
                          class="text-[#555] hover:text-white transition-colors px-1 opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0"
                          title="Edit playlist"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {hydrated() && auth && (
        <div class="border-t border-[#2a2a2a] px-3 py-2">
          {!collapsed() && (
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-[#555] truncate max-w-[120px]">{auth.userId}</span>
              <button onClick={logout} class="text-[#555] hover:text-white transition-colors cursor-pointer" title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          )}
          {collapsed() && (
            <button onClick={logout} class="text-[#555] hover:text-white transition-colors cursor-pointer p-1 mx-auto block w-full" title="Sign out">
              <LogOut size={16} class="mx-auto" />
            </button>
          )}
        </div>
      )}

      {editingId() && (
        <PlaylistEditDialog
          playlistId={editingId()!}
          onClose={() => setEditingId(null)}
        />
      )}
    </aside>
  );
}

const navItems: { href: string; label: string; icon: () => any }[] = [
  { href: "/", label: "Home", icon: () => <House size={20} /> },
  { href: "/search", label: "Search", icon: () => <Search size={20} /> },
  { href: "/library", label: "Library", icon: () => <Library size={20} /> },

];
