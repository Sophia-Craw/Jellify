import { createSignal, Show } from "solid-js";
import { useAuth } from "~/stores/auth";
import { Loader2, CheckCircle, Server, User, KeyRound, ArrowRight } from "lucide-solid";

export default function AuthModal() {
  const { auth, login } = useAuth();
  const [step, setStep] = createSignal<"url" | "credentials">("url");
  const [serverUrl, setServerUrl] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [tested, setTested] = createSignal(false);

  function normalizeUrl(raw: string): string {
    let url = raw.trim().replace(/\/+$/, "");
    if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
    return url;
  }

  async function testConnection() {
    const url = normalizeUrl(serverUrl());
    if (!url) return;
    setTesting(true);
    setError("");
    setTested(false);
    try {
      const res = await fetch(`${url}/System/Info/Public`);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setTested(true);
      setTimeout(() => setStep("credentials"), 350);
    } catch (err: any) {
      setError(err.message || "Could not connect to server");
    } finally {
      setTesting(false);
    }
  }

  async function handleLogin(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(normalizeUrl(serverUrl()), username().trim(), password());
      try {
        const authData = auth();
        if (authData) {
          document.cookie = `jusic_auth=${encodeURIComponent(JSON.stringify(authData))}; path=/; max-age=604800; SameSite=Lax`;
        }
      } catch {}
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/80">
      <div class="w-full max-w-sm bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-8 shadow-2xl relative">
        <div class="flex items-center justify-center gap-2 mb-8">
          <div class={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 ${
            step() === "url" ? "bg-[#1db954] text-black" : "bg-[#333] text-[#888]"
          }`}>1</div>
          <div class={`h-px w-8 transition-colors duration-300 ${step() === "credentials" ? "bg-[#1db954]" : "bg-[#333]"}`} />
          <div class={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 ${
            step() === "credentials" ? "bg-[#1db954] text-black" : "bg-[#333] text-[#888]"
          }`}>2</div>
        </div>

        <h1 class="text-xl font-bold text-white text-center mb-1">Sign in to Jellyfin</h1>
        <p class="text-[#888] text-xs text-center mb-6 h-4">
          {step() === "url" ? "Enter your server URL to get started" : "Enter your credentials"}
        </p>

        <div class="relative">
          <div class={`transition-all duration-300 ease-in-out ${
            step() === "url"
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-2 pointer-events-none absolute inset-x-0 top-0"
          }`}>
            <div class="space-y-4">
              <div>
                <label for="auth-server" class="text-sm text-[#888] block mb-1 flex items-center gap-1.5">
                  <Server size={14} />
                  Server URL
                </label>
                <input
                  id="auth-server"
                  type="url"
                  value={serverUrl()}
                  onInput={(e) => { setServerUrl(e.currentTarget.value); setTested(false); }}
                  onKeyDown={(e) => e.key === "Enter" && testConnection()}
                  placeholder="https://jellyfin.example.com"
                  class="w-full bg-[#121212] text-white text-sm px-3 py-2.5 rounded-lg border border-[#2a2a2a] outline-none focus:border-[#1db954] transition-colors"
                />
              </div>
              <Show when={error() && step() === "url"}>
                <p class="text-red-400 text-xs">{error()}</p>
              </Show>
              <button
                onClick={testConnection}
                disabled={testing() || !serverUrl().trim()}
                class="w-full bg-[#1db954] hover:bg-[#1ed760] text-black font-medium text-sm py-2.5 rounded-lg transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97]"
              >
                <Show when={testing()} fallback={
                  <Show when={tested()} fallback={
                    <><ArrowRight size={16} /> Test Connection</>
                  }>
                    <><CheckCircle size={16} /> Connected!</>
                  </Show>
                }>
                  <Loader2 size={16} class="animate-spin" />
                  Testing...
                </Show>
              </button>
            </div>
          </div>

          <div class={`transition-all duration-300 ease-in-out ${
            step() === "credentials"
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-2 pointer-events-none absolute inset-x-0 top-0"
          }`}>
            <form onSubmit={handleLogin} class="space-y-4">
              <div>
                <label for="auth-username" class="text-sm text-[#888] block mb-1 flex items-center gap-1.5">
                  <User size={14} />
                  Username
                </label>
                <input
                  id="auth-username"
                  type="text"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  class="w-full bg-[#121212] text-white text-sm px-3 py-2.5 rounded-lg border border-[#2a2a2a] outline-none focus:border-[#1db954] transition-colors"
                />
              </div>
              <div>
                <label for="auth-password" class="text-sm text-[#888] block mb-1 flex items-center gap-1.5">
                  <KeyRound size={14} />
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  class="w-full bg-[#121212] text-white text-sm px-3 py-2.5 rounded-lg border border-[#2a2a2a] outline-none focus:border-[#1db954] transition-colors"
                />
              </div>
              <Show when={error() && step() === "credentials"}>
                <p class="text-red-400 text-xs">{error()}</p>
              </Show>
              <button
                type="submit"
                disabled={loading()}
                class="w-full bg-[#1db954] hover:bg-[#1ed760] text-black font-medium text-sm py-2.5 rounded-lg transition-all duration-150 disabled:opacity-50 cursor-pointer active:scale-[0.97]"
              >
                {loading() ? "Signing in..." : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("url"); setError(""); setTested(false); }}
                class="w-full text-[#888] hover:text-white text-xs transition-all duration-150 cursor-pointer active:scale-[0.97]"
              >
                ← Back to server URL
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
