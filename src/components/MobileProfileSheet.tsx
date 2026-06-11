import { createSignal, Show } from "solid-js";
import { LogOut, User } from "lucide-solid";
import { useAuth } from "~/stores/auth";

interface Props {
  onClose: () => void;
}

export default function MobileProfileSheet(props: Props) {
  const { auth, logout } = useAuth();
  const [closing, setClosing] = createSignal(false);
  const [removed, setRemoved] = createSignal(false);

  function close() {
    if (closing()) return;
    setClosing(true);
    setTimeout(() => {
      setRemoved(true);
      props.onClose();
    }, 250);
  }

  const user = auth();
  if (!user || removed()) return null;

  const imgSrc = `${user.serverUrl}/Users/${user.userId}/Images/Primary?api_key=${user.accessToken}&quality=90`;

  return (
    <>
      <div
        class="fixed inset-0 z-[100] bg-black/50"
        style={{ opacity: closing() ? "0" : "1", transition: "opacity 0.25s ease-out" }}
        onClick={close}
      />
      <div
        class="fixed bottom-0 left-0 right-0 z-[110] bg-[#1a1a1a] rounded-t-2xl border-t border-[#2a2a2a]"
        classList={{
          "animate-slide-up": !closing(),
          "animate-slide-down": closing(),
        }}
      >
        <div class="flex justify-center pt-2 pb-1">
          <div class="w-8 h-1 rounded-full bg-[#555]" />
        </div>
        <div class="px-5 py-4 flex items-center gap-4">
          <div class="w-14 h-14 rounded-full overflow-hidden bg-[#242424] flex-shrink-0">
            <img src={imgSrc} alt="" class="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = "none"; (e.target as HTMLElement).parentElement!.classList.add("flex", "items-center", "justify-center"); }} />
            <div class="w-full h-full flex items-center justify-center text-[#555] hidden">
              <User size={28} />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-base font-semibold text-white truncate">{user.username}</p>
            <p class="text-xs text-[#888] truncate">{user.serverUrl}</p>
          </div>
        </div>
        <div class="border-t border-[#2a2a2a]">
          <button
            onClick={() => { logout(); close(); }}
            class="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-red-400 hover:bg-[#242424] transition-colors cursor-pointer"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
        <div class="h-safe-area-bottom" />
      </div>
    </>
  );
}
