import { registerPlugin } from "@capacitor/core";
import type { PermissionState } from "@capacitor/core";

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentIndex: number;
  queueSize: number;
  repeatMode: number;
  currentTime: number;
  duration: number;
}

export interface PermissionResult {
  foreground_service: PermissionState;
}

export interface JellifyPlayerPlugin {
  setQueue(params: { items: QueueItem[]; startIndex: number }): Promise<void>;
  replaceQueue(params: { items: QueueItem[]; currentIndex: number }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
  seekTo(params: { timeSec: number }): Promise<void>;
  setVolume(params: { volume: number }): Promise<void>;
  getCurrentTime(): Promise<{ currentTime: number }>;
  getDuration(): Promise<{ duration: number }>;
  getPlayerState(): Promise<PlayerState>;
  setRepeatMode(params: { mode: number }): Promise<void>;
  addToQueue(params: { items: QueueItem[]; atIndex?: number }): Promise<void>;
  removeFromQueue(params: { index: number }): Promise<void>;
  reorderQueue(params: { fromIndex: number; toIndex: number }): Promise<void>;
  requestBatteryOptimization(): Promise<{ exempt: boolean }>;
  requestPermissions?: () => Promise<PermissionResult>;
  checkPermissions?: () => Promise<PermissionResult>;
}

const JellifyPlayer = registerPlugin<JellifyPlayerPlugin>("JellifyPlayer");

let jellifyInitialized = false;

export function isJellifyPlayerAvailable(): boolean {
  return jellifyInitialized;
}

export async function initJellifyPlayer(): Promise<boolean> {
  try {
    // On Android 16+ (API 36), FOREGROUND_SERVICE is a runtime permission.
    // Request it before trying to start the foreground service.
    if (JellifyPlayer.requestPermissions) {
      const permResult = await JellifyPlayer.requestPermissions();
      if (permResult.foreground_service !== "granted") {
        console.warn("JellifyPlayer: FOREGROUND_SERVICE permission not granted");
        return false;
      }
    }

    // Make sure the plugin is reachable
    await JellifyPlayer.setQueue({ items: [], startIndex: 0 });
    jellifyInitialized = true;
    return true;
  } catch (e) {
    console.warn("JellifyPlayer not available:", e);
    return false;
  }
}

function trackToQueueItem(
  track: { Id: string; Name?: string; Artists?: string[]; ArtistItems?: { Name?: string }[]; Album?: string },
  streamUrl: string,
  artworkUrl: string
): QueueItem {
  return {
    id: track.Id,
    url: streamUrl,
    title: track.Name || "",
    artist: track.ArtistItems?.[0]?.Name || track.Artists?.join(", ") || "",
    album: track.Album || "",
    artworkUrl,
  };
}

export async function jellifyPlay(
  queue: { Id: string; Name?: string; Artists?: string[]; ArtistItems?: { Name?: string }[]; Album?: string }[],
  startIndex: number,
  getStreamUrl: (id: string) => string,
  getArtworkUrl: (id: string) => string
): Promise<void> {
  const items = queue.map((t) =>
    trackToQueueItem(t, getStreamUrl(t.Id), getArtworkUrl(t.Id))
  );
  await JellifyPlayer.setQueue({ items, startIndex });
  await JellifyPlayer.play();
}

export async function jellifyChangeTrack(
  track: { Id: string; Name?: string; Artists?: string[]; ArtistItems?: { Name?: string }[]; Album?: string },
  streamUrl: string,
  artworkUrl: string
): Promise<void> {
  // Replace current track in native queue
  const result = await JellifyPlayer.getCurrentTime();
  const currentTimeSec = result.currentTime;
  await JellifyPlayer.removeFromQueue({ index: 0 });
  await JellifyPlayer.addToQueue({
    items: [trackToQueueItem(track, streamUrl, artworkUrl)],
    atIndex: 0,
  });
  await JellifyPlayer.seekTo({ timeSec: currentTimeSec });
}

export type PlayerStateChangeCallback = (state: PlayerState) => void;

export async function onPlayerStateChange(
  callback: PlayerStateChangeCallback
): Promise<() => Promise<void>> {
  const handle = await JellifyPlayer.addListener("playerStateChange", callback);
  return () => handle.remove();
}

export default JellifyPlayer;
