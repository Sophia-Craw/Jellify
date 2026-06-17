import { createContext, useContext, createSignal, onMount, type JSX } from "solid-js";
import { setAuthCache, invalidateAlbumCache } from "~/lib/jellyfin";

const STORAGE_KEY = "jusic_auth";
const DEVICE_ID_KEY = "jusic_device_id";

function getDeviceId(): string {
  if (typeof document === "undefined") return "jusic-server";
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

interface AuthData {
  serverUrl: string;
  accessToken: string;
  userId: string;
  username: string;
}

interface AuthContextValue {
  auth: AuthData | null;
  authVersion: () => number;
  ready: () => boolean;
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>();

function loadAuth(): AuthData | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveAuth(auth: AuthData | null) {
  if (auth) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  setAuthCache(auth);
  invalidateAlbumCache();
}

export function AuthProvider(props: { children: JSX.Element }) {
  const [auth, setAuth] = createSignal<AuthData | null>(null);
  const [authVersion, setAuthVersion] = createSignal(0);
  const [ready, setReady] = createSignal(false);

  onMount(() => {
    const stored = loadAuth();
    setAuthCache(stored);
    if (stored) {
      setAuth(stored);
      setAuthVersion((v) => v + 1);
    }
    setReady(true);
  });

  async function login(serverUrl: string, username: string, password: string) {
    let base = serverUrl.replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
    const res = await fetch(`${base}/Users/AuthenticateByName`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization": `MediaBrowser Client="Jusic", Device="Browser", DeviceId="${getDeviceId()}", Version="1.0.0"`,
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Login failed (${res.status}): ${body || res.statusText}`);
    }
    const data = await res.json();
    const authData: AuthData = {
      serverUrl: base,
      accessToken: data.AccessToken,
      userId: data.User.Id,
      username: data.User.Name,
    };
    saveAuth(authData);
    setAuth(authData);
    setAuthVersion((v) => v + 1);
  }

  function logout() {
    saveAuth(null);
    setAuth(null);
    setAuthVersion((v) => v + 1);
  }

  return (
    <AuthContext.Provider value={{ auth, authVersion, ready, login, logout }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
