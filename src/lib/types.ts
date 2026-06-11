export interface JellyfinUser {
  Name: string;
  Id: string;
}

export interface ArtistItem {
  Name: string;
  Id: string;
}

export interface BaseItem {
  Name: string;
  Id: string;
  ServerId: string;
  Type: string;
  IsFolder: boolean;
  ImageTags: Record<string, string>;
  BackdropImageTags: string[];
  ImageBlurHashes?: Record<string, Record<string, string>>;
  UserData?: {
    PlaybackPositionTicks: number;
    PlayCount: number;
    IsFavorite: boolean;
    Played: boolean;
  };
  LocationType?: string;
  MediaType?: string;
}

export interface MusicAlbum extends BaseItem {
  PremiereDate?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  Artists?: string[];
  ArtistItems?: ArtistItem[];
  AlbumArtist?: string;
  AlbumArtists?: ArtistItem[];
  ChildCount?: number;
  ParentLogoItemId?: string;
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  ParentLogoImageTag?: string;
}

export interface MusicArtist extends BaseItem {
  RunTimeTicks?: number;
  ParentLogoItemId?: string;
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  ParentLogoImageTag?: string;
}

export interface Audio extends BaseItem {
  Container?: string;
  PremiereDate?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  Artists?: string[];
  ArtistItems?: ArtistItem[];
  Album?: string;
  AlbumId?: string;
  AlbumPrimaryImageTag?: string;
  AlbumArtist?: string;
  AlbumArtists?: ArtistItem[];
  IndexNumber?: number;
  ParentIndexNumber?: number;
  HasLyrics?: boolean;
}

export interface ItemsResponse<T> {
  Items: T[];
  TotalRecordCount?: number;
  StartIndex?: number;
}

export interface VirtualAlbum {
  name: string;
  albumArtist: string;
  artistItems?: ArtistItem[];
  tracks: Audio[];
  trackCount: number;
  id: string;
}

export type AlbumTab = "playlists" | "artists" | "albums" | "singles";

export interface Genre {
  Name: string;
  Id: string;
}

export interface SearchHint {
  ItemId: string;
  Name: string;
  Type: "MusicAlbum" | "MusicArtist" | "Audio" | string;
  Artists?: string[];
  AlbumArtist?: string;
  Album?: string;
  AlbumId?: string;
  RunTimeTicks?: number;
  PrimaryImageTag?: string;
  ImageTags?: Record<string, string>;
  AlbumPrimaryImageTag?: string;
  IndexNumber?: number;
  ProductionYear?: number;
}

export interface SearchHintResult {
  TotalRecordCount: number;
  SearchHints: SearchHint[];
}

