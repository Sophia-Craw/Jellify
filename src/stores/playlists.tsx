import { createContext, useContext, JSX } from "solid-js";
import { createStore } from "solid-js/store";
import { randomColor } from "~/lib/colors";

export interface Playlist {
  id: string;
  name: string;
  color: string;
  coverDataUrl?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface PlaylistsContextValue {
  playlists: Playlist[];
  createPlaylist: (name: string) => string;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  setCover: (id: string, dataUrl: string | undefined) => void;
  addTrack: (playlistId: string, trackId: string) => void;
  removeTrack: (playlistId: string, trackId: string) => void;
  hasTrack: (playlistId: string, trackId: string) => boolean;
  reorderPlaylist: (id: string, targetId: string, position: "above" | "below") => void;
  setPlaylistOrder: (orderedIds: string[]) => void;
  reorderPlaylistTracks: (playlistId: string, orderedTrackIds: string[]) => void;
}

const PlaylistsContext = createContext<PlaylistsContextValue>();

function load(): Playlist[] {
  if (typeof document === "undefined") return [];
  try {
    const raw = localStorage.getItem("jusic_playlists");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(playlists: Playlist[]) {
  localStorage.setItem("jusic_playlists", JSON.stringify(playlists));
}

function uid(): string {
  return crypto.randomUUID();
}

export function PlaylistsProvider(props: { children: JSX.Element }) {
  const [playlists, setPlaylists] = createStore<Playlist[]>(load());

  function persist() {
    save(JSON.parse(JSON.stringify(playlists)));
  }

  function createPlaylist(name: string): string {
    const id = uid();
    const playlist: Playlist = {
      id,
      name,
      color: randomColor(),
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setPlaylists([...playlists, playlist]);
    persist();
    return id;
  }

  function deletePlaylist(id: string) {
    setPlaylists(playlists.filter((p) => p.id !== id));
    persist();
  }

  function renamePlaylist(id: string, name: string) {
    const idx = playlists.findIndex((p) => p.id === id);
    if (idx === -1) return;
    setPlaylists(idx, "name", name);
    setPlaylists(idx, "updatedAt", Date.now());
    persist();
  }

  function setCover(id: string, dataUrl: string | undefined) {
    const idx = playlists.findIndex((p) => p.id === id);
    if (idx === -1) return;
    setPlaylists(idx, "coverDataUrl", dataUrl);
    setPlaylists(idx, "updatedAt", Date.now());
    persist();
  }

  function addTrack(playlistId: string, trackId: string) {
    const idx = playlists.findIndex((p) => p.id === playlistId);
    if (idx === -1) return;
    if (playlists[idx].trackIds.includes(trackId)) return;
    setPlaylists(idx, "trackIds", [trackId, ...playlists[idx].trackIds]);
    setPlaylists(idx, "updatedAt", Date.now());
    persist();
  }

  function removeTrack(playlistId: string, trackId: string) {
    const idx = playlists.findIndex((p) => p.id === playlistId);
    if (idx === -1) return;
    setPlaylists(idx, "trackIds", playlists[idx].trackIds.filter((t) => t !== trackId));
    setPlaylists(idx, "updatedAt", Date.now());
    persist();
  }

  function hasTrack(playlistId: string, trackId: string): boolean {
    const p = playlists.find((p) => p.id === playlistId);
    return p ? p.trackIds.includes(trackId) : false;
  }

  function reorderPlaylist(id: string, targetId: string, position: "above" | "below") {
    const fromIdx = playlists.findIndex((p) => p.id === id);
    const toIdx = playlists.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const list = [...playlists];
    const [item] = list.splice(fromIdx, 1);
    const newToIdx = list.findIndex((p) => p.id === targetId);
    list.splice(position === "above" ? newToIdx : newToIdx + 1, 0, item);
    setPlaylists(list);
    save(list);
  }

  function setPlaylistOrder(orderedIds: string[]) {
    const newList = orderedIds.map(id => playlists.find(p => p.id === id)).filter(Boolean) as Playlist[];
    setPlaylists(newList);
    save(newList);
  }

  function reorderPlaylistTracks(playlistId: string, orderedTrackIds: string[]) {
    const idx = playlists.findIndex(p => p.id === playlistId);
    if (idx === -1) return;
    setPlaylists(idx, "trackIds", orderedTrackIds);
    setPlaylists(idx, "updatedAt", Date.now());
    persist();
  }

  return (
    <PlaylistsContext.Provider
      value={{ playlists, createPlaylist, deletePlaylist, renamePlaylist, setCover, addTrack, removeTrack, hasTrack, reorderPlaylist, setPlaylistOrder, reorderPlaylistTracks }}
    >
      {props.children}
    </PlaylistsContext.Provider>
  );
}

export function usePlaylists() {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error("usePlaylists must be used within <PlaylistsProvider>");
  return ctx;
}
