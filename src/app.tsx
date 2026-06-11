import { Router, useLocation, useIsRouting } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, Show } from "solid-js";
import { ChevronLeft, ChevronRight } from "lucide-solid";
import Sidebar from "~/components/Sidebar";
import Player from "~/components/Player";
import Visualizer from "~/components/Visualizer";
import UserMenu from "~/components/UserMenu";
import AuthModal from "~/components/AuthModal";
import TitleBar from "~/components/TitleBar";
import { PlayerProvider, usePlayer } from "~/stores/player";
import { PlaylistsProvider } from "~/stores/playlists";
import { AuthProvider, useAuth } from "~/stores/auth";
import "./app.css";

function AppLayout(props: { children: any }) {
  const { auth, ready } = useAuth();
  const location = useLocation();
  const isRouting = useIsRouting();
  const { showVisualizer } = usePlayer();

  const showChrome = () => location.pathname !== "/auth";
  const showHeader = () => showChrome() && ready() && auth();

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
        <Show when={showChrome()}>
          <TitleBar />
        </Show>
        <div class="flex flex-1 overflow-hidden">
        <Show when={showChrome()}>
          <Sidebar />
        </Show>
        <main class="flex-1 overflow-y-auto pb-20 relative">
          <Show when={showHeader()}>
            <div class="sticky top-0 z-30 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <div class="flex items-center justify-between px-4 py-3 pointer-events-auto">
                <div class="flex items-center gap-2">
                  <button
                    onClick={() => window.history.back()}
                    class="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => window.history.forward()}
                    class="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <UserMenu />
              </div>
            </div>
          </Show>
          <Suspense>{props.children}</Suspense>
        </main>
        <Show when={showChrome() && showVisualizer()}>
          <Visualizer />
        </Show>
        <Show when={showChrome()}>
          <Player />
        </Show>
        </div>
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
