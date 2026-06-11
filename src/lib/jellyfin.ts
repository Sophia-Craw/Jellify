import type { ItemsResponse, MusicAlbum, MusicArtist, Audio, Genre, SearchHintResult, SearchHint, VirtualAlbum } from "./types";

let cachedUserId: string | null = null;

interface StoredAuth {
  serverUrl: string;
  accessToken: string;
  userId: string;
}

function readAuth(): StoredAuth | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = localStorage.getItem("jusic_auth");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getBaseUrl(): string {
  const auth = readAuth();
  return auth?.serverUrl || "";
}

function getToken(): string {
  const auth = readAuth();
  return auth?.accessToken || "";
}

async function getUserId(): Promise<string> {
  const auth = readAuth();
  if (auth?.userId) return auth.userId;
  if (cachedUserId) return cachedUserId;
  const baseUrl = getBaseUrl();
  const token = getToken();
  if (!baseUrl || !token) return "";
  try {
    const res = await fetch(`${baseUrl}/Users`, {
      headers: { "X-Emby-Token": token },
    });
    if (!res.ok) return "";
    const users: { Id: string }[] = await res.json();
    cachedUserId = users[0]?.Id;
    return cachedUserId || "";
  } catch { return ""; }
}

async function api<T>(path: string, params?: Record<string, string>): Promise<T> {
  const uid = await getUserId();
  const baseUrl = getBaseUrl();
  const token = getToken();
  if (!uid || !baseUrl || !token) {
    return { Items: [] } as unknown as T;
  }
  const url = new URL(`${baseUrl}${path.replace("{userId}", uid)}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { "X-Emby-Token": token },
  });
  if (!res.ok) return { Items: [] } as unknown as T;
  return res.json();
}

export function getImageUrl(itemId: string, imageType = "Primary", quality = 90): string {
  return `${getBaseUrl()}/Items/${itemId}/Images/${imageType}?quality=${quality}&api_key=${getToken()}`;
}

export function getStreamUrl(itemId: string): string {
  return `${getBaseUrl()}/Audio/${itemId}/stream?static=true&api_key=${getToken()}`;
}

export async function fetchAlbums(fields?: string, genreId?: string): Promise<MusicAlbum[]> {
  const params: Record<string, string> = {
    Recursive: "true",
    IncludeItemTypes: "MusicAlbum",
    SortBy: "SortName",
    SortOrder: "Ascending",
  };
  if (fields) params.Fields = fields;
  if (genreId) params.GenreIds = genreId;
  const data = await api<ItemsResponse<MusicAlbum>>("/Users/{userId}/Items", params);
  return data.Items;
}

export async function fetchArtists(genreId?: string): Promise<MusicArtist[]> {
  const params: Record<string, string> = { UserId: await getUserId() };
  if (genreId) params.GenreIds = genreId;
  const data = await api<ItemsResponse<MusicArtist>>(`/Artists/AlbumArtists`, params);
  return data.Items;
}

export async function fetchArtistAlbums(artistId: string): Promise<MusicAlbum[]> {
  const data = await api<ItemsResponse<MusicAlbum>>("/Users/{userId}/Items", {
    Recursive: "true",
    IncludeItemTypes: "MusicAlbum",
    ArtistIds: artistId,
    SortBy: "ProductionYear,SortName",
    SortOrder: "Ascending",
  });
  return data.Items;
}

export async function fetchAlbumTracks(albumId: string): Promise<Audio[]> {
  const data = await api<ItemsResponse<Audio>>("/Users/{userId}/Items", {
    ParentId: albumId,
    SortBy: "IndexNumber",
    SortOrder: "Ascending",
    Fields: "Artists,AlbumArtists,ArtistItems",
  });
  return data.Items;
}

export async function fetchArtistInfo(artistId: string): Promise<MusicArtist> {
  return api<MusicArtist>(`/Users/{userId}/Items/${artistId}`);
}

export async function fetchAlbumInfo(albumId: string): Promise<MusicAlbum> {
  return api<MusicAlbum>(`/Users/{userId}/Items/${albumId}`);
}

export async function fetchLatestAlbums(limit = 10): Promise<MusicAlbum[]> {
  const data = await api<MusicAlbum[]>(`/Users/${await getUserId()}/Items/Latest`, {
    Limit: String(limit),
    IncludeItemTypes: "MusicAlbum",
  });
  return data;
}

export async function fetchFrequentAlbums(limit = 10): Promise<MusicAlbum[]> {
  const data = await api<ItemsResponse<MusicAlbum>>("/Users/{userId}/Items", {
    Recursive: "true",
    IncludeItemTypes: "MusicAlbum",
    SortBy: "PlayCount",
    SortOrder: "Descending",
    Limit: String(limit),
    Fields: "ChildCount",
  });
  return data.Items;
}

export async function fetchSinglesTracks(genreId?: string): Promise<Audio[]> {
  const albums = await fetchAlbums("ChildCount", genreId);
  const singles = albums.filter((a) => (a.ChildCount ?? 1) === 1);
  const results = await Promise.all(singles.map((a) => fetchAlbumTracks(a.Id)));
  return results.flat();
}

export async function fetchGenres(): Promise<Genre[]> {
  const data = await api<ItemsResponse<Genre>>("/MusicGenres", {
    UserId: await getUserId(),
  });
  return data.Items;
}

export async function searchAll(term: string, limit = 30): Promise<SearchHintResult> {
  const uid = await getUserId();
  return api<SearchHintResult>("/Search/Hints", {
    SearchTerm: term,
    UserId: uid,
    Limit: String(limit),
    IncludeItemTypes: "Audio,MusicAlbum,MusicArtist",
  });
}

let orphanCache: { albums: VirtualAlbum[]; version: number } | null = null;

async function fetchAllItems<T>(path: string, params: Record<string, string>, pageSize = 200): Promise<T[]> {
  const all: T[] = [];
  let startIndex = 0;
  while (true) {
    const data = await api<ItemsResponse<T>>(path, { ...params, StartIndex: String(startIndex), Limit: String(pageSize) });
    if (!data.Items?.length) break;
    all.push(...data.Items);
    if (data.Items.length < pageSize) break;
    startIndex += pageSize;
  }
  return all;
}

export async function fetchOrphanedTracks(version = 0): Promise<VirtualAlbum[]> {
  if (orphanCache && orphanCache.version === version) return orphanCache.albums;

  const albums = await fetchAllItems<MusicAlbum>("/Users/{userId}/Items", {
    Recursive: "true",
    IncludeItemTypes: "MusicAlbum",
    Fields: "Id",
  });
  const realAlbumIds = new Set(albums.map((a) => a.Id));

  const allTracks = await fetchAllItems<Audio>("/Users/{userId}/Items", {
    Recursive: "true",
    IncludeItemTypes: "Audio",
    Fields: "Album,Artists,AlbumArtists,ArtistItems,AlbumArtist,AlbumId",
    SortBy: "Album,SortName",
  });

  const orphaned = allTracks.filter((t) => !t.AlbumId || !realAlbumIds.has(t.AlbumId));

  const groups = new Map<string, Audio[]>();
  const unknown: Audio[] = [];

  for (const track of orphaned) {
    const albumName = track.Album?.trim();
    if (albumName) {
      const list = groups.get(albumName);
      if (list) list.push(track);
      else groups.set(albumName, [track]);
    } else {
      unknown.push(track);
    }
  }

  const virtual: VirtualAlbum[] = [];

  for (const [name, tracks] of groups) {
    const sorted = tracks.sort((a, b) => (a.IndexNumber || 999) - (b.IndexNumber || 999));
    const first = sorted[0];
    virtual.push({
      name,
      albumArtist: first.AlbumArtist || first.Artists?.join(", ") || "Unknown Artist",
      artistItems: first.ArtistItems,
      tracks: sorted,
      trackCount: sorted.length,
      id: makeSlug(name),
    });
  }

  if (unknown.length > 0) {
    virtual.push({
      name: "Unknown Album",
      albumArtist: "Various Artists",
      tracks: unknown,
      trackCount: unknown.length,
      id: "__unknown__",
    });
  }

  virtual.sort((a, b) => a.name.localeCompare(b.name));
  orphanCache = { albums: virtual, version };
  return virtual;
}

export function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

export function clearOrphanCache() {
  orphanCache = null;
}

export async function fetchOrphanedTracksByArtist(artistId: string, version: number): Promise<Audio[]> {
  const albums = await fetchOrphanedTracks(version);
  const result: Audio[] = [];
  for (const album of albums) {
    for (const track of album.tracks) {
      if (track.ArtistItems?.some((a) => a.Id === artistId) || track.Artists?.some((a) => a === artistId)) {
        result.push(track);
      }
    }
  }
  return result;
}
