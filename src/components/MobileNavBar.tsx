import { A, useLocation } from "@solidjs/router";
import { House, Search, Library } from "lucide-solid";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
];

export default function MobileNavBar() {
  const location = useLocation();

  return (
    <>
    <nav class="flex items-center justify-around h-14 bg-[#121212] border-t border-[#2a2a2a] shrink-0">
      {items.map((item) => {
        const isActive = location.pathname === item.href
          || (item.href !== "/" && location.pathname.startsWith(item.href));
        return (
          <A
            href={item.href}
            class="flex flex-col items-center gap-0.5 pt-1 px-3 transition-colors"
            classList={{ "text-[#1db954]": isActive, "text-[#888]": !isActive }}
          >
            <item.icon size={20} />
            <span class="text-[10px] font-medium">{item.label}</span>
          </A>
        );
      })}
    </nav>
    <div class="h-safe-area-bottom shrink-0 bg-[#121212]" />
    </>
  );
}
