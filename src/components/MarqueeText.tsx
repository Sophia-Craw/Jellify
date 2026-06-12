import { createSignal, createEffect } from "solid-js";

export default function MarqueeText(props: {
  children: any;
  class?: string;
  key?: string;
}) {
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  const [overflow, setOverflow] = createSignal({ active: false, dist: "0px" });

  createEffect(() => {
    const _ = props.key;
    if (containerRef && contentRef) {
      const ow = contentRef.scrollWidth > containerRef.clientWidth;
      if (ow) {
        const dist = -(contentRef.scrollWidth - containerRef.clientWidth);
        setOverflow({ active: true, dist: `${dist}px` });
      } else {
        setOverflow({ active: false, dist: "0px" });
      }
    }
  });

  return (
    <div ref={containerRef} class={`overflow-hidden ${props.class || ""}`}>
      <div
        ref={contentRef}
        class={`whitespace-nowrap ${overflow().active ? "inline-block animate-teeter" : ""}`}
        style={{ "--scroll-dist": overflow().dist } as any}
      >
        {props.children}
      </div>
    </div>
  );
}
