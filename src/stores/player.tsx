import { createContext, useContext, JSX, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { Audio } from "~/lib/types";

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
}

const PlayerContext = createContext<PlayerContextValue>();

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

  function currentTrack(): Audio | null {
    if (state.queueIndex < 0 || state.queueIndex >= state.queue.length) return null;
    return state.queue[state.queueIndex];
  }

  function play(track: Audio, queue?: Audio[], startIndex?: number) {
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

    audioRef.src = `/api/stream/${track.Id}`;
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

  function togglePlay() {
    if (!audioRef) return;
    if (audioRef.paused) {
      audioRef.play();
      setState("isPlaying", true);
    } else {
      audioRef.pause();
      setState("isPlaying", false);
    }
  }

  function pause() {
    audioRef?.pause();
    setState("isPlaying", false);
  }

  function resume() {
    audioRef?.play();
    setState("isPlaying", true);
  }

  function playIndex(idx: number) {
    if (idx < 0 || idx >= state.queue.length) return;
    setState("queueIndex", idx);
    const track = state.queue[idx];
    if (audioRef) {
      audioRef.src = `/api/stream/${track.Id}`;
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
        if (audioRef && audioRef.currentTime > 3) {
          audioRef.currentTime = 0;
          return;
        }
        return;
      }
    }
    playIndex(idx);
  }

  function seek(time: number) {
    if (audioRef) {
      audioRef.currentTime = time;
      setState("currentTime", time);
    }
  }

  function setVolume(vol: number) {
    setState("volume", vol);
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
