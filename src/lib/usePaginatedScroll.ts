import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";

export function usePaginatedScroll<T>(
  fetcher: (startIndex: number) => Promise<{ items: T[]; totalCount: number }>,
  pageSize = 50
) {
  const [items, setItems] = createSignal<T[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [initializing, setInitializing] = createSignal(true);
  const [page, setPage] = createSignal(0);
  const [sentinel, setSentinel] = createSignal<HTMLDivElement | undefined>();

  let offset = 0;
  let currentFetch = 0;

  const hasMore = createMemo(() => {
    const total = totalCount();
    const current = items().length;
    return total === 0 || current < total;
  });

  async function loadMore() {
    if (loading() || !hasMore()) { console.log("usePaginatedScroll: skipping, loading:", loading(), "hasMore:", hasMore()); return; }
    const fetchId = ++currentFetch;
    setLoading(true);
    console.log("usePaginatedScroll: fetching at offset", offset, "fetchId", fetchId);
    try {
      const result = await fetcher(offset);
      console.log("usePaginatedScroll: got", result.items.length, "items, total", result.totalCount, "fetchId", fetchId, "currentFetch", currentFetch);
      if (fetchId !== currentFetch) { console.log("usePaginatedScroll: stale, ignoring"); return; }
      setItems((prev) => [...prev, ...result.items]);
      setTotalCount(result.totalCount);
      setPage((p) => p + 1);
      offset += result.items.length;
    } catch (err) {
      console.error("usePaginatedScroll fetch error:", err);
    } finally {
      if (fetchId === currentFetch) {
        setLoading(false);
        setInitializing(false);
      }
    }
  }

  createEffect(() => {
    const el = sentinel();
    if (typeof document === "undefined" || !el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });

  function reset() {
    currentFetch++;
    setItems([]);
    setTotalCount(0);
    setLoading(false);
    setInitializing(true);
    setPage(0);
    offset = 0;
  }

  return { items, totalCount, loading, initializing, page, hasMore, sentinelRef: setSentinel, loadMore, reset };
}
