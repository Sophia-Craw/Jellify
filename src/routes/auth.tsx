import { Navigate } from "@solidjs/router";
import { useAuth } from "~/stores/auth";

export default function AuthPage() {
  const { auth } = useAuth();
  if (auth()) return <Navigate href="/" />;
  return <Navigate href="/" />;
}
