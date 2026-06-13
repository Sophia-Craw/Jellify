import { createSignal } from "solid-js";

export const [headerTitle, setHeaderTitle] = createSignal("");
export const [headerSubtitle, setHeaderSubtitle] = createSignal("");
export const [headerImageUrl, setHeaderImageUrl] = createSignal("");
export const [headerImageShape, setHeaderImageShape] = createSignal<"square" | "circle">("square");
export const [showHeaderExtra, setShowHeaderExtra] = createSignal(false);
export const [playerExpanded, setPlayerExpanded] = createSignal(false);
export const [playerBgColor, setPlayerBgColor] = createSignal("");
