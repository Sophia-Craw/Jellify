import { onMount, onCleanup, createEffect } from "solid-js";
import { usePlayer } from "~/stores/player";

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let gainNode: GainNode | null = null;
let sourceCreated = false;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface BlobConfig {
  color: string;
  bandStart: number;
  bandEnd: number;
  xBase: number;
  yBase: number;
  phase: number;
  speed: number;
}

const BLOBS: BlobConfig[] = [
  { color: "#1db954", bandStart: 0, bandEnd: 3, xBase: 0.3, yBase: 0.5, phase: 0, speed: 0.4 },
  { color: "#00bcd4", bandStart: 4, bandEnd: 9, xBase: 0.7, yBase: 0.4, phase: 1.2, speed: 0.5 },
  { color: "#aa66ff", bandStart: 10, bandEnd: 28, xBase: 0.5, yBase: 0.7, phase: 2.5, speed: 0.35 },
  { color: "#ff6b9d", bandStart: 29, bandEnd: 50, xBase: 0.2, yBase: 0.3, phase: 3.8, speed: 0.55 },
  { color: "#ffcc00", bandStart: 51, bandEnd: 127, xBase: 0.8, yBase: 0.6, phase: 5.0, speed: 0.45 },
];

function lerpColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const SORTED_BLOBS = [...BLOBS].sort((a, b) => a.xBase - b.xBase);

function getSpectrumColor(pos: number): string {
  if (pos <= SORTED_BLOBS[0].xBase) return SORTED_BLOBS[0].color;
  if (pos >= SORTED_BLOBS[SORTED_BLOBS.length - 1].xBase) return SORTED_BLOBS[SORTED_BLOBS.length - 1].color;
  for (let i = 0; i < SORTED_BLOBS.length - 1; i++) {
    const a = SORTED_BLOBS[i];
    const b = SORTED_BLOBS[i + 1];
    if (pos >= a.xBase && pos <= b.xBase) {
      const t = (pos - a.xBase) / (b.xBase - a.xBase);
      return lerpColor(a.color, b.color, t);
    }
  }
  return SORTED_BLOBS[0].color;
}

export default function Visualizer() {
  const { state, getAudioElement } = usePlayer();
  let canvasRef: HTMLCanvasElement | undefined;
  let frameId: number | undefined;

  onMount(() => {
    const canvas = canvasRef;
    if (!canvas) return;
    const el = getAudioElement();
    if (!el) return;
    if (typeof window === "undefined") return;

    if (!audioCtx) {
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      gainNode = audioCtx.createGain();
      gainNode.gain.value = state.volume;
    }
    if (!sourceCreated && audioCtx && analyser && gainNode) {
      const source = audioCtx.createMediaElementSource(el);
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      sourceCreated = true;
    }

    if (audioCtx?.state === "suspended") {
      audioCtx.resume();
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const dpr = devicePixelRatio || 1;
      canvas!.width = canvas!.offsetWidth * dpr;
      canvas!.height = canvas!.offsetHeight * dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    const data = new Uint8Array(analyser?.frequencyBinCount ?? 128);
    let time = 0;
    let animating = false;

    function draw() {
      if (!animating) return;
      analyser?.getByteFrequencyData(data);
      if (gainNode && gainNode.gain.value !== state.volume) {
        gainNode.gain.value = state.volume;
      }

      const W = canvas!.offsetWidth;
      const H = canvas!.offsetHeight;
      const dpr = devicePixelRatio || 1;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx!.fillStyle = "#121212";
      ctx!.fillRect(0, 0, W, H);

      ctx!.filter = "blur(100px)";

      time += 0.02;

      for (const blob of BLOBS) {
        let sum = 0;
        const count = blob.bandEnd - blob.bandStart + 1;
        for (let i = blob.bandStart; i <= blob.bandEnd && i < data.length; i++) {
          sum += data[i];
        }
        const energy = sum / count / 255;

        const driftX = Math.sin(time * blob.speed + blob.phase) * 60;
        const driftY = Math.cos(time * blob.speed * 0.7 + blob.phase) * 60;

        const cx = blob.xBase * W + driftX;
        const cy = blob.yBase * H + driftY;
        const radius = 80 + energy * 200;

        const gradient = ctx!.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, hexToRgba(blob.color, 0.5 + energy * 0.5));
        gradient.addColorStop(0.4, hexToRgba(blob.color, 0.25 + energy * 0.3));
        gradient.addColorStop(1, hexToRgba(blob.color, 0));
        ctx!.beginPath();
        ctx!.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx!.fillStyle = gradient;
        ctx!.fill();
      }

      ctx!.filter = "none";

      const spectrumH = 50;
      const specY = H - spectrumH;
      const barCount = 64;
      const barW = W / barCount;

      for (let i = 0; i < barCount; i++) {
        const binStart = Math.floor((i / barCount) * data.length);
        const binEnd = Math.floor(((i + 1) / barCount) * data.length);
        let sum = 0;
        const count = binEnd - binStart;
        for (let j = binStart; j < binEnd; j++) sum += data[j];
        const energy = count > 0 ? sum / count / 255 : 0;

        const barH = energy * spectrumH;
        const barX = i * barW;

        const barCenter = (i + 0.5) / barCount;
        const gradColor = getSpectrumColor(barCenter);

        ctx!.fillStyle = hexToRgba(gradColor, 0.25 + energy * 0.6);
        ctx!.fillRect(barX, specY + spectrumH - barH, Math.max(1, barW - 1), barH);
      }

      frameId = requestAnimationFrame(draw);
    }

    createEffect(() => {
      if (state.isPlaying) {
        if (!animating) {
          animating = true;
          draw();
        }
      } else {
        animating = false;
        if (frameId !== undefined) {
          cancelAnimationFrame(frameId);
          frameId = undefined;
        }
      }
    });

    onCleanup(() => {
      animating = false;
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    });
  });

  return (
    <canvas
      ref={canvasRef}
      class="fixed inset-0 w-full h-full z-40 pointer-events-auto"
      style="bottom: 80px; height: calc(100% - 80px);"
    />
  );
}
