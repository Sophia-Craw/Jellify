import { Router, A, useLocation, useIsRouting, useNavigate } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, Show, createEffect, createSignal, onMount, onCleanup } from "solid-js";
import { ChevronLeft, ChevronRight, Search } from "lucide-solid";
import Sidebar from "~/components/Sidebar";
import Player from "~/components/Player";
import MobilePlayer from "~/components/MobilePlayer";
import MobileNavBar from "~/components/MobileNavBar";
import MobileProfileSheet from "~/components/MobileProfileSheet";
import Visualizer from "~/components/Visualizer";
import UserMenu from "~/components/UserMenu";
import AuthModal from "~/components/AuthModal";
import TitleBar from "~/components/TitleBar";
import { useIsMobile } from "~/lib/mobile";
import { setupStatusBar, setupKeepAwake, setupWebviewGuardian, setupBatteryOptimization, isCapacitor } from "~/lib/capacitor";
import { headerTitle, headerSubtitle, headerImageUrl, headerImageShape, showHeaderExtra, playerExpanded, playerBgColor } from "~/lib/mobileHeader";
import { PlayerProvider, usePlayer } from "~/stores/player";
import { PlaylistsProvider } from "~/stores/playlists";
import { AuthProvider, useAuth } from "~/stores/auth";
import "./app.css";

function AppLayout(props: { children: any }) {
  const { auth, ready } = useAuth();
  const location = useLocation();
  const isRouting = useIsRouting();
  const { state, showVisualizer, checkAndAdvance } = usePlayer();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const isMacElectron = typeof navigator !== "undefined" && navigator.platform?.toLowerCase().includes("mac") && navigator.userAgent.includes("Electron");
  const showChrome = () => location.pathname !== "/auth";
  const showHeader = () => showChrome() && ready() && auth();

  const [pageAnim, setPageAnim] = createSignal("");
  const [showProfileSheet, setShowProfileSheet] = createSignal(false);
  const [stuck, setStuck] = createSignal(false);
  let sentinelRef: HTMLDivElement | undefined;
  let prevPath = location.pathname;

  onMount(() => {
    setupStatusBar();
    setupKeepAwake();
    setupWebviewGuardian();
    setupBatteryOptimization();
    if (sentinelRef && isMobile()) {
      const observer = new IntersectionObserver(
        ([entry]) => setStuck(!entry.isIntersecting),
        { threshold: 0 }
      );
      observer.observe(sentinelRef);
      onCleanup(() => observer.disconnect());
    }
    if (isCapacitor()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            checkAndAdvance();
          }
        });
      });
    }
  });

  createEffect(() => {
    const current = location.pathname;
    if (current !== prevPath && isMobile()) {
      const prevDepth = prevPath.split("/").filter(Boolean).length;
      const currDepth = current.split("/").filter(Boolean).length;
      const dir = currDepth >= prevDepth ? "forward" : "back";
      setPageAnim("");
      setTimeout(() => setPageAnim(dir === "forward" ? "page-enter-forward" : "page-enter-back"), 20);
      prevPath = current;
    }
  });

  createEffect(() => {
    if (!isCapacitor()) return;
    const ka = (window as any).__keepAwake;
    if (!ka) return;
    if (state.isPlaying) {
      ka.keepAwake();
    } else {
      ka.allowSleep();
    }
  });

  return (
    <>
      <div
        class={`fixed top-0 left-0 right-0 h-0.5 z-[100] transition-opacity duration-300 ${isRouting() ? "opacity-100" : "opacity-0"}`}
      >
        <div
          class={`h-full bg-[#1db954] transition-all duration-[2s] ease-out ${isRouting() ? "w-[90%]" : "w-0"}`}
        />
      </div>

      <Show when={ready() && !auth() && location.pathname !== "/auth"}>
        <AuthModal />
      </Show>

      <div class="flex flex-col h-screen overflow-hidden">
        {/* TitleBar - desktop only */}
        <Show when={showChrome() && !isMobile()}>
          <TitleBar />
        </Show>

        {/* Mobile header - fixed overlay */}
        <Show when={showHeader() && isMobile()}>
          <div
            class="fixed top-0 left-0 right-0 z-40 pointer-events-none transition-all duration-300"
            classList={{
              "bg-gradient-to-b from-black/90 to-transparent": !stuck() && !playerExpanded(),
              "bg-[#121212]/95 backdrop-blur": stuck() && !playerExpanded(),
            }}
            style={{
              "padding-top": "env(safe-area-inset-top, var(--safe-area-inset-top, 0px))",
              "min-height": playerExpanded() ? undefined : "3rem",
              height: playerExpanded() ? "calc(env(safe-area-inset-top, var(--safe-area-inset-top, 0px)) + 1.5rem)" : undefined,
              "box-sizing": playerExpanded() ? "border-box" : undefined,
              "background-color": playerExpanded() && playerBgColor() ? playerBgColor() : undefined,
              overflow: playerExpanded() ? "hidden" : undefined,
            }}>
            <div class="flex items-center justify-between px-4 pointer-events-auto"
              classList={{
                "pointer-events-none opacity-0 h-0 overflow-hidden": playerExpanded(),
                "h-12": !playerExpanded(),
              }}
            >
              <button
                onClick={() => window.history.back()}
                class="w-9 h-9 flex items-center justify-center text-white hover:text-[#1db954] transition-all duration-150 cursor-pointer active:scale-90"
              >
                <ChevronLeft size={22} />
              </button>
              <div class="flex items-center gap-2 flex-1 min-w-0 mr-auto">
                <Show when={showHeaderExtra() && headerImageUrl()}>
                  <img
                    src={headerImageUrl()}
                    alt=""
                    class="w-8 h-8 object-cover flex-shrink-0"
                    classList={{
                      "rounded-full": headerImageShape() === "circle",
                      "rounded": headerImageShape() === "square",
                    }}
                  />
                </Show>
                <div
                  class="min-w-0 transition-opacity duration-300"
                  classList={{
                    "opacity-0": !showHeaderExtra(),
                    "opacity-100": showHeaderExtra(),
                  }}
                >
                  <p class="text-sm font-medium text-white truncate">{headerTitle()}</p>
                  <Show when={headerSubtitle()}>
                    <p class="text-xs text-[#888] truncate">{headerSubtitle()}</p>
                  </Show>
                </div>
              </div>
              <button
                onClick={() => setShowProfileSheet(true)}
                class="w-8 h-8 rounded-full overflow-hidden border border-[#2a2a2a] hover:border-[#1db954] transition-all duration-150 cursor-pointer active:scale-90"
              >
                <img
                  src={`${auth()!.serverUrl}/Users/${auth()!.userId}/Images/Primary?api_key=${auth()!.accessToken}&quality=90`}
                  alt=""
                  class="w-full h-full object-cover"
                />
              </button>
            </div>
          </div>
        </Show>

        <div class="flex flex-1 overflow-hidden">
          {/* Sidebar - desktop only */}
          <Show when={showChrome() && !isMobile()}>
            <Sidebar />
          </Show>

          <main
            class="flex-1 overflow-y-auto relative"
            classList={{
              "pb-20": showChrome() && !isMobile(),
              "pb-28": showChrome() && isMobile(),
            }}
            style={{
              paddingTop: showChrome() && isMobile() ? "calc(env(safe-area-inset-top, var(--safe-area-inset-top, 0px)) + 3rem)" : "",
            }}
          >
            {/* Header - desktop only */}
            <Show when={showHeader() && !isMobile()}>
              <div class="sticky top-0 z-30 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div class="flex items-center justify-between px-4 py-3 pointer-events-auto">
                  <div class="flex items-center gap-2">
                    <button
                      onClick={() => window.history.back()}
                      class="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-all duration-150 cursor-pointer active:scale-90"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={() => window.history.forward()}
                      class="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-all duration-150 cursor-pointer active:scale-90"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  {isMacElectron ? (
                    <button
                      onClick={() => navigate("/search")}
                      class="h-8 w-28 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-start gap-1.5 text-white transition-all duration-150 cursor-pointer px-3 active:scale-[0.97]"
                      title="Search"
                    >
                      <Search size={16} />
                      <span class="text-sm text-[#aaa]">Search...</span>
                    </button>
                  ) : (
                    <UserMenu />
                  )}
                </div>
              </div>
            </Show>
            <div ref={sentinelRef} class="h-px" />
            <div class={pageAnim()}>
              <Suspense>{props.children}</Suspense>
            </div>
          </main>

          {/* Visualizer - desktop only */}
          <Show when={showChrome() && showVisualizer() && !isMobile()}>
            <Visualizer />
          </Show>
        </div>

        {/* Mobile player + nav */}
        <Show when={showChrome() && isMobile()}>
          <MobilePlayer />
          <MobileNavBar />
        </Show>

        {/* Mobile profile sheet */}
        <Show when={showProfileSheet()}>
          <MobileProfileSheet onClose={() => setShowProfileSheet(false)} />
        </Show>

        {/* Desktop player */}
        <Show when={showChrome() && !isMobile()}>
          <Player />
        </Show>
      </div>
    </>
  );
}

export default function App() {
  return (
    <Router
      root={props => (
        <AuthProvider>
          <PlayerProvider>
            <PlaylistsProvider>
              <AppLayout>{props.children}</AppLayout>
            </PlaylistsProvider>
          </PlayerProvider>
        </AuthProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
