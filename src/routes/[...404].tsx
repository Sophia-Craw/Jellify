import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <main class="text-center mx-auto text-gray-400 p-4">
      <h1 class="max-6-xs text-6xl text-[#555] font-thin uppercase my-16">404</h1>
      <p class="mb-4">Page not found</p>
      <A href="/" class="text-[#1db954] hover:underline transition-all duration-150 inline-block active:scale-95">
        Go home
      </A>
    </main>
  );
}
