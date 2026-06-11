import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";

export function useInfiniteScroll<T>(items: () => T[], pageSize = 50) {
  const [count, setCount] = createSignal(pageSize);
  const [sentinel, setSentinel] = createSignal<HTMLDivElement | undefined>();

  const visible = createMemo(() => {
    const all = items();
    return all.slice(0, Math.min(count(), all.length));
  });

  const hasMore = createMemo(() => items().length > count());

  createEffect(() => {
    const el = sentinel();
    if (typeof document === "undefined" || !el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCount((c) => c + pageSize);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });

  return {
    visible,
    hasMore,
    sentinelRef: setSentinel,
  };
}
