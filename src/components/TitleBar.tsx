import { createSignal } from "solid-js";
import { useAuth } from "~/stores/auth";
import UserMenu from "./UserMenu";

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

const isElectron = typeof navigator !== "undefined" && navigator.userAgent.includes("Electron");
const isMac = typeof navigator !== "undefined" && navigator.platform?.toLowerCase().includes("mac");

export default function TitleBar() {
  const [maximized, setMaximized] = createSignal(false);
  const { auth } = useAuth();

  function handleMaximize() {
    setMaximized(!maximized());
    window.electronAPI?.maximize();
  }

  const showWindowControls = isElectron && !isMac;

  return (
    <div
      class="flex items-center bg-[#121212] border-b border-[#2a2a2a] select-none shrink-0"
      classList={{ "pl-20 h-9": isMac, "h-9 justify-between px-3": !showWindowControls }}
      style={{ "-webkit-app-region": "drag" as any }}
    >
      <div class="flex items-center gap-2">
        <img src="/jellify.png" alt="Jellify" class="w-5 h-5 rounded" />
        <span class="text-sm font-semibold text-white tracking-wide">Jellify</span>
      </div>
      {isMac && isElectron && auth() && (
        <div class="self-start pt-1 pr-2" style={{ "-webkit-app-region": "no-drag" as any }}>
          <UserMenu compact />
        </div>
      )}
      {showWindowControls && (
        <div class="flex h-full" style={{ "-webkit-app-region": "no-drag" as any }}>
          <button
            onClick={() => window.electronAPI?.minimize()}
            class="w-10 h-full flex items-center justify-center text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-all duration-150 cursor-pointer active:scale-90"
            title="Minimize"
          >
            <span class="text-sm leading-none">─</span>
          </button>
          <button
            onClick={handleMaximize}
            class="w-10 h-full flex items-center justify-center text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-all duration-150 cursor-pointer active:scale-90"
            title="Maximize"
          >
            <span class="text-sm leading-none">□</span>
          </button>
          <button
            onClick={() => window.electronAPI?.close()}
            class="w-10 h-full flex items-center justify-center text-[#888] hover:text-white hover:bg-red-600 transition-all duration-150 cursor-pointer active:scale-90"
            title="Close"
          >
            <span class="text-sm leading-none">✕</span>
          </button>
        </div>
      )}
    </div>
  );
}
