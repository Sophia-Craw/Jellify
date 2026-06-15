import type { ItemsResponse, MusicAlbum, MusicArtist, Audio, Genre, SearchHintResult, SearchHint, VirtualAlbum } from "./types";

let cachedUserId: string | null = null;
let authCache: StoredAuth | null | undefined = undefined;

const albumsCache = new Map<string, MusicAlbum[]>();

export function invalidateAlbumCache() {
  albumsCache.clear();
}

let orphanCache: { albums: VirtualAlbum[]; version: number; sortBy: string; sortOrder: string } | null = null;

export interface StoredAuth {
  serverUrl: string;
  accessToken: string;
  userId: string;
}

export function setAuthCache(auth: StoredAuth | null) {
  authCache = auth;
}

function readAuth(): StoredAuth | null {
  if (authCache !== undefined) return authCache;
  if (typeof document === "undefined") return null;
  try {
    const raw = localStorage.getItem("jusic_auth");
    authCache = raw ? JSON.parse(raw) : null;
    return authCache;
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
  if (!auth?.serverUrl || !auth.accessToken) return "";
  try {
    const res = await fetch(`${auth.serverUrl}/Users`, {
      headers: { "X-Emby-Token": auth.accessToken },
    });
    if (!res.ok) return "";
    const users: { Id: string }[] = await res.json();
    cachedUserId = users[0]?.Id;
    return cachedUserId || "";
  } catch { return ""; }
}

async function api<T>(path: string, params?: Record<string, string>): Promise<T> {
  const auth = readAuth();
  if (!auth?.serverUrl || !auth.accessToken) {
    return { Items: [] } as unknown as T;
  }
  const uid = auth.userId || await getUserId();
  if (!uid) return { Items: [] } as unknown as T;
  const url = new URL(`${auth.serverUrl}${path.replace("{userId}", uid)}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { "X-Emby-Token": auth.accessToken },
  });
  if (!res.ok) return { Items: [] } as unknown as T;
  return res.json();
}

export function getImageUrl(itemId: string, imageType = "Primary", quality = 90): string {
  const auth = readAuth();
  return `${auth?.serverUrl || ""}/Items/${itemId}/Images/${imageType}?quality=${quality}&api_key=${auth?.accessToken || ""}`;
}

export function getStreamUrl(itemId: string): string {
  const auth = readAuth();
  return `${auth?.serverUrl || ""}/Audio/${itemId}/stream?static=true&api_key=${auth?.accessToken || ""}`;
}

let albumIdsCache: Set<string> | null = null;

export function invalidateAlbumIdsCache() {
  albumIdsCache = null;
}

export async function fetchAllAlbumIds(): Promise<Set<string>> {
  if (albumIdsCache) return albumIdsCache;
  const albums = await fetchAllItems<MusicAlbum>("/Users/{userId}/Items", {
    Recursive: "true",
    IncludeItemTypes: "MusicAlbum",
    Fields: "Id",
  });
  albumIdsCache = new Set(albums.map((a) => a.Id));
  return albumIdsCache;
}

export async function fetchAlbumsPage(
  startIndex: number,
  limit: number,
  fields?: string,
  genreId?: string,
  sortBy = "SortName",
  sortOrder = "Ascending"
): Promise<{ items: MusicAlbum[]; totalCount: number }> {
  const params: Record<string, string> = {
    Recursive: "true",
    IncludeItemTypes: "MusicAlbum",
    SortBy: sortBy,
    SortOrder: sortOrder,
    StartIndex: String(startIndex),
    Limit: String(limit),
  };
  if (fields) params.Fields = fields;
  if (genreId) params.GenreIds = genreId;
  const data = await api<ItemsResponse<MusicAlbum>>("/Users/{userId}/Items", params);
  return { items: data.Items, totalCount: data.TotalRecordCount ?? 0 };
}

export async function fetchArtistsPage(
  startIndex: number,
  limit: number,
  genreId?: string,
  sortBy = "SortName",
  sortOrder = "Ascending"
): Promise<{ items: MusicArtist[]; totalCount: number }> {
  const params: Record<string, string> = {
    UserId: await getUserId(),
    SortBy: sortBy,
    SortOrder: sortOrder,
    StartIndex: String(startIndex),
    Limit: String(limit),
  };
  if (genreId) params.GenreIds = genreId;
  const data = await api<ItemsResponse<MusicArtist>>("/Artists/AlbumArtists", params);
  return { items: data.Items, totalCount: data.TotalRecordCount ?? 0 };
}

export async function fetchAudioPage(
  startIndex: number,
  limit: number,
  sortBy = "SortName",
  sortOrder = "Ascending"
): Promise<{ items: Audio[]; totalCount: number }> {
  const data = await api<ItemsResponse<Audio>>("/Users/{userId}/Items", {
    Recursive: "true",
    IncludeItemTypes: "Audio",
    Fields: "Album,Artists,AlbumArtists,ArtistItems,AlbumArtist,AlbumId,PremiereDate,DateCreated,PlayCount,CommunityRating,IndexNumber",
    SortBy: sortBy,
    SortOrder: sortOrder,
    StartIndex: String(startIndex),
    Limit: String(limit),
  });
  return { items: data.Items, totalCount: data.TotalRecordCount ?? 0 };
}

export async function fetchAlbums(fields?: string, genreId?: string, sortBy = "SortName", sortOrder = "Ascending"): Promise<MusicAlbum[]> {
  const key = `${fields || ""}|${genreId || ""}|${sortBy}|${sortOrder}`;
  const cached = albumsCache.get(key);
  if (cached) return cached;
  const params: Record<string, string> = {
    Recursive: "true",
    IncludeItemTypes: "MusicAlbum",
    SortBy: sortBy,
    SortOrder: sortOrder,
  };
  if (fields) params.Fields = fields;
  if (genreId) params.GenreIds = genreId;
  const data = await api<ItemsResponse<MusicAlbum>>("/Users/{userId}/Items", params);
  albumsCache.set(key, data.Items);
  return data.Items;
}

export async function fetchArtists(genreId?: string, sortBy = "SortName", sortOrder = "Ascending"): Promise<MusicArtist[]> {
  const params: Record<string, string> = { UserId: await getUserId() };
  if (genreId) params.GenreIds = genreId;
  params.SortBy = sortBy;
  params.SortOrder = sortOrder;
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

export async function fetchSinglesTracks(genreId?: string, preFetchedAlbums?: MusicAlbum[], sortBy = "SortName", sortOrder = "Ascending"): Promise<Audio[]> {
  const albums = preFetchedAlbums || await fetchAlbums("ChildCount", genreId, sortBy, sortOrder);
  const singles = albums.filter((a) => (a.ChildCount ?? 1) === 1);
  if (!singles.length) return [];
  const batchSize = 15;
  const results: Audio[] = [];
  for (let i = 0; i < singles.length; i += batchSize) {
    const batch = singles.slice(i, i + batchSize);
    const tracks = await Promise.all(batch.map((a) => fetchAlbumTracks(a.Id)));
    results.push(...tracks.flat());
  }
  return results;
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

async function fetchAllItems<T>(path: string, params: Record<string, string>, pageSize = 1000): Promise<T[]> {
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

export async function fetchOrphanedTracks(version = 0, sortBy = "SortName", sortOrder = "Ascending"): Promise<VirtualAlbum[]> {
  if (orphanCache && orphanCache.version === version && orphanCache.sortBy === sortBy && orphanCache.sortOrder === sortOrder) return orphanCache.albums;

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

  if (sortBy === "SortName" || sortBy === "name") {
    virtual.sort((a, b) => sortOrder === "Ascending"
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name));
  } else if (sortBy === "ProductionYear" || sortBy === "PremiereDate" || sortBy === "DateCreated") {
    virtual.sort((a, b) => {
      const dateA = a.tracks[0]?.PremiereDate || a.tracks[0]?.DateCreated || "";
      const dateB = b.tracks[0]?.PremiereDate || b.tracks[0]?.DateCreated || "";
      return sortOrder === "Ascending" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });
  } else if (sortBy === "PlayCount") {
    virtual.sort((a, b) => sortOrder === "Ascending"
      ? (a.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0) - b.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0))
      : (b.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0) - a.tracks.reduce((s, t) => s + (t.PlayCount || 0), 0)));
  } else if (sortBy === "CommunityRating") {
    virtual.sort((a, b) => sortOrder === "Ascending"
      ? ((a.tracks[0]?.CommunityRating || 0) - (b.tracks[0]?.CommunityRating || 0))
      : ((b.tracks[0]?.CommunityRating || 0) - (a.tracks[0]?.CommunityRating || 0)));
  } else if (sortBy === "trackCount") {
    virtual.sort((a, b) => sortOrder === "Ascending"
      ? a.trackCount - b.trackCount
      : b.trackCount - a.trackCount);
  }
  orphanCache = { albums: virtual, version, sortBy, sortOrder };
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
