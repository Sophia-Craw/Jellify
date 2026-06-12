import { createContext, useContext, JSX, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { Audio } from "~/lib/types";
import { isCapacitor } from "~/lib/capacitor";
import { getImageUrl } from "~/lib/jellyfin";

let nativeAudio: typeof import("@mediagrid/capacitor-native-audio")["NativeAudio"] | undefined;
let nativeInitialized = false;
let timePollTimer: ReturnType<typeof setInterval> | undefined;

function pollCurrentTime() {
  clearInterval(timePollTimer);
  timePollTimer = setInterval(async () => {
    if (!nativeAudio || !nativeInitialized) return;
    try {
      const { currentTime } = await nativeAudio.getCurrentTime({ audioId: "main" });
      setter("currentTime", currentTime);
    } catch {}
  }, 1000);
}

function clearTimePoll() {
  clearInterval(timePollTimer);
  timePollTimer = undefined;
}

// We need a reference to setState from outside the component
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

function registerOnAudioEnd() {
  if (!nativeAudio) return;
  nativeAudio.onAudioEnd({ audioId: "main" }, async () => {
    const s = contextStateRef;
    if (!s) return;
    if (s.repeat === "one") {
      await nativeAudio!.seek({ audioId: "main", timeInSeconds: 0 });
      await nativeAudio!.play({ audioId: "main" });
    } else {
      nextRef?.();
    }
  });
}

async function initNativeAudio(track: Audio) {
  const mod = await import("@mediagrid/capacitor-native-audio");
  nativeAudio = mod.NativeAudio;
  await nativeAudio.create({
    audioSource: getStreamUrl(track.Id),
    audioId: "main",
    useForNotification: true,
    ...trackMeta(track),
  });
  const readyPromise = new Promise<void>((resolve) => {
    nativeAudio!.onAudioReady({ audioId: "main" }, () => {
      resolve();
    });
  });
  registerOnAudioEnd();
  nativeAudio.onPlaybackStatusChange({ audioId: "main" }, (result) => {
    if (result.status === "playing") {
      storeSetState?.("isPlaying", true);
    } else if (result.status === "paused") {
      storeSetState?.("isPlaying", false);
    }
  });
  await nativeAudio.initialize({ audioId: "main" });
  await readyPromise;
  nativeInitialized = true;
}

var contextStateRef: PlayerState | undefined;
var storeSetState: any;
var nextRef: (() => void) | undefined;

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

  // Expose state and setState for native callbacks
  contextStateRef = state;
  storeSetState = setState;
  nextRef = next;
  setter = (key, val) => setState(key, val);

  function currentTrack(): Audio | null {
    if (state.queueIndex < 0 || state.queueIndex >= state.queue.length) return null;
    return state.queue[state.queueIndex];
  }

  async function play(track: Audio, queue?: Audio[], startIndex?: number) {
    const newQueue = queue ?? [track];
    let idx = startIndex ?? newQueue.indexOf(track);
    setState("originalQueue", newQueue);
    if (state.shuffle && newQueue.length > 1) {
      const shuffled = shuffleArray(newQueue, idx);
      setState("queue", shuffled);
      setState("queueIndex", idx);
    } else {
      setState("queue", newQueue);
      setState("queueIndex", idx);
    }
    setState("isPlaying", true);

    if (isCapacitor()) {
      try {
        if (!nativeInitialized) {
          await initNativeAudio(track);
          const { duration } = await nativeAudio!.getDuration({ audioId: "main" });
          setState("duration", duration);
          await nativeAudio!.play({ audioId: "main" });
          pollCurrentTime();
          return;
        } else if (nativeAudio) {
          await nativeAudio.changeAudioSource({ audioId: "main", source: getStreamUrl(track.Id) });
          await nativeAudio.changeMetadata({ audioId: "main", ...trackMeta(track) });
          await nativeAudio.initialize({ audioId: "main" });
          const { duration } = await nativeAudio.getDuration({ audioId: "main" });
          setState("duration", duration);
          await nativeAudio.play({ audioId: "main" });
          pollCurrentTime();
          return;
        }
      } catch (e) {
        console.error("Native audio error, falling back to web audio:", e);
      }
      // fall through to web audio
    }

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

  function addToQueue(track: Audio) {
    if (state.queue.length === 0) {
      play(track);
      return;
    }
    setState("queue", [...state.queue, track]);
    if (state.shuffle) {
      setState("originalQueue", [...state.originalQueue, track]);
    }
  }

  async function togglePlay() {
    if (isCapacitor() && nativeAudio) {
      const { isPlaying } = await nativeAudio.isPlaying({ audioId: "main" });
      if (isPlaying) {
        await nativeAudio.pause({ audioId: "main" });
        setState("isPlaying", false);
        clearTimePoll();
      } else {
        await nativeAudio.play({ audioId: "main" });
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
    if (isCapacitor() && nativeAudio) {
      await nativeAudio.pause({ audioId: "main" });
      setState("isPlaying", false);
      clearTimePoll();
      return;
    }
    audioRef?.pause();
    setState("isPlaying", false);
  }

  async function resume() {
    if (isCapacitor() && nativeAudio) {
      await nativeAudio.play({ audioId: "main" });
      setState("isPlaying", true);
      pollCurrentTime();
      return;
    }
    audioRef?.play();
    setState("isPlaying", true);
  }

  async function playIndex(idx: number) {
    if (idx < 0 || idx >= state.queue.length) return;
    setState("queueIndex", idx);
    const track = state.queue[idx];

    if (isCapacitor() && nativeAudio) {
      try {
        await nativeAudio.changeAudioSource({ audioId: "main", source: getStreamUrl(track.Id) });
        await nativeAudio.changeMetadata({ audioId: "main", ...trackMeta(track) });
        await nativeAudio.initialize({ audioId: "main" });
        registerOnAudioEnd();
        const { duration } = await nativeAudio.getDuration({ audioId: "main" });
        setState("duration", duration);
        await nativeAudio.play({ audioId: "main" });
        setState("isPlaying", true);
        pollCurrentTime();
      } catch (e) {
        console.error("Native audio error:", e);
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

  async function seek(time: number) {
    if (isCapacitor() && nativeAudio) {
      await nativeAudio.seek({ audioId: "main", timeInSeconds: time });
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
    if (isCapacitor() && nativeAudio) {
      await nativeAudio.setVolume({ audioId: "main", volume: vol });
      return;
    }
    if (audioRef) audioRef.volume = vol;
  }

  function toggleShuffle() {
    if (state.shuffle) {
      const track = state.queue[state.queueIndex];
      const origIdx = state.originalQueue.indexOf(track);
      setState("queue", state.originalQueue);
      setState("queueIndex", origIdx >= 0 ? origIdx : 0);
      setState("shuffle", false);
    } else {
      setState("originalQueue", state.queue);
      if (state.queue.length > 1) {
        const shuffled = shuffleArray(state.queue, state.queueIndex);
        setState("queue", shuffled);
        setState("queueIndex", state.queueIndex);
      }
      setState("shuffle", true);
    }
  }

  function getAudioElement(): HTMLAudioElement | undefined {
    return audioRef;
  }

  function toggleRepeat() {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const curr = modes.indexOf(state.repeat);
    setState("repeat", modes[(curr + 1) % modes.length]);
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
    if (isCapacitor() && nativeAudio) {
      try {
        const { currentTime } = await nativeAudio.getCurrentTime({ audioId: "main" });
        const { duration } = await nativeAudio.getDuration({ audioId: "main" });
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
