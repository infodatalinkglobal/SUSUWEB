"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setErrorMessage("Could not sign out. Please try again.");
        return;
      }
      router.replace("/auth/login");
      router.refresh();
    } catch {
      setErrorMessage("Could not reach the sign-out service. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-green-300 hover:text-green-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoggingOut ? "Signing out…" : "Sign out"}
      </button>
      {errorMessage ? <p role="alert" className="max-w-44 text-right text-xs text-red-700">{errorMessage}</p> : null}
    </div>
  );
}
