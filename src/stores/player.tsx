import { createContext, useContext, JSX, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { Audio } from "~/lib/types";
import { isCapacitor } from "~/lib/capacitor";
import { getImageUrl } from "~/lib/jellyfin";

// ── Native audio backends ───────────────────────────────────────

type JellifyPlayerModule = typeof import("~/lib/jellify-player");
type MediaGridModule = typeof import("@mediagrid/capacitor-native-audio");

let jellifyPlayer: JellifyPlayerModule | undefined;
let mediaGrid: MediaGridModule["NativeAudio"] | undefined;
let nativeBackend: "jellify" | "mediagrid" | "none" = "none";
let timePollTimer: ReturnType<typeof setInterval> | undefined;

const REPEAT_MODE_MAP: Record<string, number> = { off: 0, all: 1, one: 2 };

function pollCurrentTime() {
  clearInterval(timePollTimer);
  timePollTimer = setInterval(async () => {
    try {
      if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
        const ps = await jellifyPlayer.default.getPlayerState();
        setter?.("currentTime", ps.currentTime);
        setStateRef?.("duration", ps.duration);
        setStateRef?.("isPlaying", ps.isPlaying);
        if (ps.currentIndex >= 0 && ps.currentIndex !== stateRef?.queueIndex) {
          setStateRef?.("queueIndex", ps.currentIndex);
        }
      } else if (nativeBackend === "mediagrid" && mediaGrid) {
        const { currentTime } = await mediaGrid.getCurrentTime({ audioId: "main" });
        setter?.("currentTime", currentTime);
      }
    } catch {}
  }, 1000);
}

function clearTimePoll() {
  clearInterval(timePollTimer);
  timePollTimer = undefined;
}

let setter: ((key: "currentTime", val: number) => void) | undefined;

function directStreamUrl(trackId: string): string {
  try {
    const stored = localStorage.getItem("jusic_auth");
    if (stored) {
      const auth = JSON.parse(stored);
      return `${auth.serverUrl}/Audio/${trackId}/stream?static=true&api_key=${auth.accessToken}`;
    }
  } catch {}
  return `/api/stream/${trackId}`;
}

function getStreamUrl(trackId: string): string {
  return isCapacitor() ? directStreamUrl(trackId) : `/api/stream/${trackId}`;
}

function trackMeta(track: Audio) {
  return {
    friendlyTitle: track.Name || "",
    artistName: track.ArtistItems?.[0]?.Name || track.Artists?.join(", ") || "",
    albumTitle: track.Album || "",
    artworkSource: getImageUrl(track.AlbumId || track.Id, "Primary", 512),
  };
}

// ── State types ─────────────────────────────────────────────────

interface PlayerState {
  queue: Audio[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  originalQueue: Audio[];
}

function shuffleArray<T>(arr: T[], keepIndex: number): T[] {
  const result = [...arr];
  const current = result[keepIndex];
  result.splice(keepIndex, 1);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  result.splice(keepIndex, 0, current);
  return result;
}

interface PlayerContextValue {
  state: PlayerState;
  play: (track: Audio, queue?: Audio[], startIndex?: number) => void;
  addToQueue: (track: Audio) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  currentTrack: () => Audio | null;
  getAudioElement: () => HTMLAudioElement | undefined;
  showVisualizer: () => boolean;
  setShowVisualizer: (v: boolean) => void;
  reorderQueue: (newOrder: Audio[]) => void;
  checkAndAdvance: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue>();

// ── Native backend initialisation ───────────────────────────────

async function tryInitJellify() {
  try {
    const mod = await import("~/lib/jellify-player");
    const ok = await mod.initJellifyPlayer();
    if (ok) {
      jellifyPlayer = mod;
      nativeBackend = "jellify";
      return true;
    }
  } catch {}
  return false;
}

async function tryInitMediaGrid() {
  try {
    const mod = await import("@mediagrid/capacitor-native-audio");
    mediaGrid = mod.NativeAudio;
    nativeBackend = "mediagrid";
    return true;
  } catch {}
  return false;
}

async function ensureNativeBackend() {
  if (nativeBackend !== "none") return;
  if (!isCapacitor()) return;
  if (await tryInitJellify()) return;
  await tryInitMediaGrid();
}

// ── Helpers shared between backends ────────────────────────────

function currentQueueForPlay(track: Audio, queue?: Audio[], startIndex?: number): {
  newQueue: Audio[];
  idx: number;
} {
  const newQueue = queue ?? [track];
  let idx = startIndex ?? newQueue.indexOf(track);
  if (stateRef && stateRef.shuffle && newQueue.length > 1) {
    const shuffled = shuffleArray(newQueue, idx);
    return { newQueue: shuffled, idx };
  }
  return { newQueue, idx };
}

var stateRef: PlayerState | undefined;
var setStateRef: any;

export function PlayerProvider(props: { children: JSX.Element }) {
  const [showVisualizer, setShowVisualizer] = createSignal(false);
  let audioRef: HTMLAudioElement | undefined;

  const [state, setState] = createStore<PlayerState>({
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    shuffle: false,
    repeat: "off",
    originalQueue: [],
  });

  stateRef = state;
  setStateRef = setState;
  setter = (key, val) => setState(key, val);

  function currentTrack(): Audio | null {
    if (state.queueIndex < 0 || state.queueIndex >= state.queue.length) return null;
    return state.queue[state.queueIndex];
  }

  // ── play / queue ────────────────────────────────────────

  async function play(track: Audio, queue?: Audio[], startIndex?: number) {
    const { newQueue, idx } = currentQueueForPlay(track, queue, startIndex);
    setState("originalQueue", queue ?? [track]);
    setState("queue", newQueue);
    setState("queueIndex", idx);
    setState("isPlaying", true);

    await ensureNativeBackend();

    if (nativeBackend === "jellify" && jellifyPlayer) {
      try {
        const items = newQueue.map((t) => ({
          id: t.Id,
          url: getStreamUrl(t.Id),
          title: t.Name || "",
          artist: t.ArtistItems?.[0]?.Name || t.Artists?.join(", ") || "",
          album: t.Album || "",
          artworkUrl: getImageUrl(t.AlbumId || t.Id, "Primary", 512),
        }));
        await jellifyPlayer.default.setQueue({ items, startIndex: idx });
        await jellifyPlayer.default.setRepeatMode({ mode: REPEAT_MODE_MAP[state.repeat] ?? 0 });
        await jellifyPlayer.default.play();
        const pd = await jellifyPlayer.default.getDuration();
        setState("duration", pd.duration);
        pollCurrentTime();
        return;
      } catch (e) {
        console.error("JellifyPlayer error, falling back:", e);
        nativeBackend = "none";
      }
    }

    if (nativeBackend === "mediagrid" && mediaGrid) {
      try {
        const readyPromise = new Promise<void>((resolve) => {
          mediaGrid!.onAudioReady({ audioId: "main" }, () => resolve());
        });
        await mediaGrid.create({
          audioSource: getStreamUrl(track.Id),
          audioId: "main",
          useForNotification: true,
          ...trackMeta(track),
        });
        mediaGrid.onAudioEnd({ audioId: "main" }, async () => {
          const s = stateRef;
          if (!s) return;
          if (s.repeat === "one") {
            await mediaGrid!.seek({ audioId: "main", timeInSeconds: 0 });
            await mediaGrid!.play({ audioId: "main" });
          } else {
            next();
          }
        });
        mediaGrid.onPlaybackStatusChange({ audioId: "main" }, (result) => {
          if (result.status === "playing") {
            setStateRef?.("isPlaying", true);
          } else if (result.status === "paused") {
            setStateRef?.("isPlaying", false);
          }
        });
        await mediaGrid.initialize({ audioId: "main" });
        await readyPromise;
        const { duration } = await mediaGrid.getDuration({ audioId: "main" });
        setState("duration", duration);
        await mediaGrid.play({ audioId: "main" });
        pollCurrentTime();
        return;
      } catch (e) {
        console.error("MediaGrid error, falling back to web audio:", e);
        nativeBackend = "none";
      }
    }

    // ── Web audio fallback ──────────────────────────────

    if (!audioRef) {
      audioRef = new Audio();
      audioRef.crossOrigin = "anonymous";
      audioRef.addEventListener("timeupdate", () => {
        setState("currentTime", audioRef!.currentTime);
      });
      audioRef.addEventListener("durationchange", () => {
        setState("duration", audioRef!.duration);
      });
      audioRef.addEventListener("ended", () => {
        if (state.repeat === "one") {
          audioRef!.currentTime = 0;
          audioRef!.play();
        } else {
          next();
        }
      });
    }

    audioRef.src = getStreamUrl(track.Id);
    audioRef.volume = state.volume;
    audioRef.play();
  }

  async function addToQueue(track: Audio) {
    if (state.queue.length === 0) {
      play(track);
      return;
    }
    setState("queue", [...state.queue, track]);
    if (state.shuffle) {
      setState("originalQueue", [...state.originalQueue, track]);
    }
    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      try {
        await jellifyPlayer.default.addToQueue({
          items: [{
            id: track.Id,
            url: getStreamUrl(track.Id),
            title: track.Name || "",
            artist: track.ArtistItems?.[0]?.Name || track.Artists?.join(", ") || "",
            album: track.Album || "",
            artworkUrl: getImageUrl(track.AlbumId || track.Id, "Primary", 512),
          }],
        });
      } catch {}
    }
  }

  // ── transport controls ─────────────────────────────────

  async function togglePlay() {
    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      const ps = await jellifyPlayer.default.getPlayerState();
      if (ps.isPlaying) {
        await jellifyPlayer.default.pause();
        setState("isPlaying", false);
        clearTimePoll();
      } else {
        await jellifyPlayer.default.play();
        setState("isPlaying", true);
        pollCurrentTime();
      }
      return;
    }
    if (nativeBackend === "mediagrid" && mediaGrid) {
      const { isPlaying } = await mediaGrid.isPlaying({ audioId: "main" });
      if (isPlaying) {
        await mediaGrid.pause({ audioId: "main" });
        setState("isPlaying", false);
        clearTimePoll();
      } else {
        await mediaGrid.play({ audioId: "main" });
        setState("isPlaying", true);
        pollCurrentTime();
      }
      return;
    }
    if (!audioRef) return;
    if (audioRef.paused) {
      audioRef.play();
      setState("isPlaying", true);
    } else {
      audioRef.pause();
      setState("isPlaying", false);
    }
  }

  async function pause() {
    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      await jellifyPlayer.default.pause();
      setState("isPlaying", false);
      clearTimePoll();
      return;
    }
    if (nativeBackend === "mediagrid" && mediaGrid) {
      await mediaGrid.pause({ audioId: "main" });
      setState("isPlaying", false);
      clearTimePoll();
      return;
    }
    audioRef?.pause();
    setState("isPlaying", false);
  }

  async function resume() {
    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      await jellifyPlayer.default.play();
      setState("isPlaying", true);
      pollCurrentTime();
      return;
    }
    if (nativeBackend === "mediagrid" && mediaGrid) {
      await mediaGrid.play({ audioId: "main" });
      setState("isPlaying", true);
      pollCurrentTime();
      return;
    }
    audioRef?.play();
    setState("isPlaying", true);
  }

  // ── track navigation ───────────────────────────────────

  async function playIndex(idx: number) {
    if (idx < 0 || idx >= state.queue.length) return;
    setState("queueIndex", idx);
    const track = state.queue[idx];

    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      try {
        // Re-set queue with new start index
        const items = state.queue.map((t) => ({
          id: t.Id,
          url: getStreamUrl(t.Id),
          title: t.Name || "",
          artist: t.ArtistItems?.[0]?.Name || t.Artists?.join(", ") || "",
          album: t.Album || "",
          artworkUrl: getImageUrl(t.AlbumId || t.Id, "Primary", 512),
        }));
        await jellifyPlayer.default.setQueue({ items, startIndex: idx });
        await jellifyPlayer.default.play();
        const pd = await jellifyPlayer.default.getDuration();
        setState("duration", pd.duration);
        setState("isPlaying", true);
        pollCurrentTime();
      } catch (e) {
        console.error("JellifyPlayer error in playIndex:", e);
      }
      return;
    }

    if (nativeBackend === "mediagrid" && mediaGrid) {
      try {
        await mediaGrid.changeAudioSource({ audioId: "main", source: getStreamUrl(track.Id) });
        await mediaGrid.changeMetadata({ audioId: "main", ...trackMeta(track) });
        await mediaGrid.initialize({ audioId: "main" });
        mediaGrid.onAudioEnd({ audioId: "main" }, async () => {
          const s = stateRef;
          if (!s) return;
          if (s.repeat === "one") {
            await mediaGrid!.seek({ audioId: "main", timeInSeconds: 0 });
            await mediaGrid!.play({ audioId: "main" });
          } else {
            next();
          }
        });
        const { duration } = await mediaGrid.getDuration({ audioId: "main" });
        setState("duration", duration);
        await mediaGrid.play({ audioId: "main" });
        setState("isPlaying", true);
        pollCurrentTime();
      } catch (e) {
        console.error("MediaGrid error in playIndex:", e);
      }
      return;
    }

    if (audioRef) {
      audioRef.src = getStreamUrl(track.Id);
      audioRef.play();
      setState("isPlaying", true);
    }
  }

  function next() {
    if (state.queue.length === 0) return;
    let idx = state.queueIndex + 1;
    if (idx >= state.queue.length) {
      if (state.repeat === "all") {
        idx = 0;
      } else {
        pause();
        return;
      }
    }
    playIndex(idx);
  }

  function prev() {
    if (state.queue.length === 0) return;
    let idx = state.queueIndex - 1;
    if (idx < 0) {
      if (state.repeat === "all") {
        idx = state.queue.length - 1;
      } else {
        if (state.currentTime > 3) {
          seek(0);
          return;
        }
        return;
      }
    }
    playIndex(idx);
  }

  // ── seek / volume ──────────────────────────────────────

  async function seek(time: number) {
    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      await jellifyPlayer.default.seekTo({ timeSec: time });
      setState("currentTime", time);
      return;
    }
    if (nativeBackend === "mediagrid" && mediaGrid) {
      await mediaGrid.seek({ audioId: "main", timeInSeconds: time });
      setState("currentTime", time);
      return;
    }
    if (audioRef) {
      audioRef.currentTime = time;
      setState("currentTime", time);
    }
  }

  async function setVolume(vol: number) {
    setState("volume", vol);
    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      await jellifyPlayer.default.setVolume({ volume: vol });
      return;
    }
    if (nativeBackend === "mediagrid" && mediaGrid) {
      await mediaGrid.setVolume({ audioId: "main", volume: vol });
      return;
    }
    if (audioRef) audioRef.volume = vol;
  }

  // ── shuffle / repeat ───────────────────────────────────

  async function toggleShuffle() {
    if (state.shuffle) {
      const track = state.queue[state.queueIndex];
      const origIdx = state.originalQueue.indexOf(track);
      const newQueue = state.originalQueue;
      const newIdx = origIdx >= 0 ? origIdx : 0;
      setState("queue", newQueue);
      setState("queueIndex", newIdx);
      setState("shuffle", false);
      await syncNativeQueue(newQueue, newIdx);
    } else {
      setState("originalQueue", state.queue);
      let newQueue = state.queue;
      if (state.queue.length > 1) {
        newQueue = shuffleArray(state.queue, state.queueIndex);
        setState("queue", newQueue);
        setState("queueIndex", state.queueIndex);
      }
      setState("shuffle", true);
      await syncNativeQueue(newQueue, state.queueIndex);
    }
  }

  async function syncNativeQueue(queue: Audio[], currentIndex: number) {
    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      try {
        const items = queue.map((t) => ({
          id: t.Id,
          url: getStreamUrl(t.Id),
          title: t.Name || "",
          artist: t.ArtistItems?.[0]?.Name || t.Artists?.join(", ") || "",
          album: t.Album || "",
          artworkUrl: getImageUrl(t.AlbumId || t.Id, "Primary", 512),
        }));
        await jellifyPlayer.default.replaceQueue({ items, currentIndex });
      } catch (e) {
        console.error("JellifyPlayer sync error:", e);
      }
    }
  }

  async function toggleRepeat() {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const curr = modes.indexOf(state.repeat);
    const nextMode = modes[(curr + 1) % modes.length];
    setState("repeat", nextMode);

    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      try {
        await jellifyPlayer.default.setRepeatMode({ mode: REPEAT_MODE_MAP[nextMode] ?? 0 });
      } catch {}
    }
  }

  // ── misc ───────────────────────────────────────────────

  function getAudioElement(): HTMLAudioElement | undefined {
    return audioRef;
  }

  function reorderQueue(newOrder: Audio[]) {
    const currentTrack = state.queue[state.queueIndex];
    const newIndex = newOrder.indexOf(currentTrack);
    setState("queue", newOrder);
    if (newIndex >= 0) {
      setState("queueIndex", newIndex);
    }
    if (state.shuffle) {
      setState("originalQueue", newOrder);
    }
  }

  async function checkAndAdvance() {
    if (nativeBackend === "jellify" && jellifyPlayer?.isJellifyPlayerAvailable()) {
      try {
        const ps = await jellifyPlayer.default.getPlayerState();
        setState("currentTime", ps.currentTime);
        setState("duration", ps.duration);
        setState("isPlaying", ps.isPlaying);
        if (ps.currentIndex >= 0 && ps.currentIndex !== state.queueIndex) {
          setState("queueIndex", ps.currentIndex);
        }
      } catch {}
      return;
    }
    if (nativeBackend === "mediagrid" && mediaGrid) {
      try {
        const { currentTime } = await mediaGrid.getCurrentTime({ audioId: "main" });
        const { duration } = await mediaGrid.getDuration({ audioId: "main" });
        if (duration > 0 && currentTime >= duration - 1) {
          next();
        }
      } catch {}
    }
  }

  return (
      <PlayerContext.Provider
        value={{
          state,
          play,
          addToQueue,
          togglePlay,
          pause,
          resume,
          next,
          prev,
          seek,
          setVolume,
          toggleShuffle,
          toggleRepeat,
          currentTrack,
          getAudioElement,
          showVisualizer,
          setShowVisualizer,
          reorderQueue,
          checkAndAdvance,
        }}
      >
      {props.children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within <PlayerProvider>");
  return ctx;
}
