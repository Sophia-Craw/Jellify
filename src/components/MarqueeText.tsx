import { createSignal, onMount } from "solid-js";

export default function MarqueeText(props: {
  children: any;
  class?: string;
}) {
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  const [overflowing, setOverflowing] = createSignal(false);

  onMount(() => {
    if (containerRef && contentRef) {
      setOverflowing(contentRef.scrollWidth > containerRef.clientWidth);
    }
  });

  return (
    <div ref={containerRef} class={`overflow-hidden ${props.class || ""}`}>
      <div
        ref={contentRef}
        class={`whitespace-nowrap ${overflowing() ? "inline-block animate-marquee" : ""}`}
      >
        {props.children}
      </div>
    </div>
  );
}
