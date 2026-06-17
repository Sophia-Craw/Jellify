import { Navigate } from "@solidjs/router";
import { useAuth } from "~/stores/auth";
import AuthModal from "~/components/AuthModal";

export default function AuthPage() {
  const { auth } = useAuth();
  if (auth()) return <Navigate href="/" />;
  return (
    <div class="h-screen w-screen flex items-center justify-center bg-black">
      <AuthModal />
    </div>
  );
}
