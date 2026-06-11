import { createSignal, onMount, onCleanup } from "solid-js";
import { LogOut } from "lucide-solid";
import { useAuth } from "~/stores/auth";

export default function UserMenu() {
  const { auth, logout } = useAuth();
  const [open, setOpen] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  function handleClickOutside(e: MouseEvent) {
    if (ref && !ref.contains(e.target as Node)) {
      setOpen(false);
    }
  }

  onMount(() => document.addEventListener("click", handleClickOutside));
  onCleanup(() => {
    if (typeof document !== "undefined") {
      document.removeEventListener("click", handleClickOutside);
    }
  });

  const user = auth();
  if (!user) return null;

  const imgSrc = `${user.serverUrl}/Users/${user.userId}/Images/Primary?api_key=${user.accessToken}&quality=90`;

  return (
    <div ref={ref} class="relative">
      <button
        onClick={() => setOpen(!open())}
        class="w-8 h-8 rounded-full overflow-hidden border-2 border-[#2a2a2a] hover:border-[#1db954] transition-colors cursor-pointer"
        title="User menu"
      >
        <img src={imgSrc} alt="User" class="w-full h-full object-cover" />
      </button>

      {open() && (
        <div class="absolute right-0 top-full mt-2 w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-[60] py-1">
          <button
            onClick={() => { logout(); setOpen(false); }}
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#ccc] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
