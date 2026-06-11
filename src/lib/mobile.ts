import { createSignal, onMount, onCleanup } from "solid-js";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = createSignal(false);

  onMount(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    onCleanup(() => mq.removeEventListener("change", handler));
  });

  return isMobile;
}
