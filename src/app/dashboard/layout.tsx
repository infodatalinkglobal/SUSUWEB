import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { getSession, isDemoPreviewEnabled } from "@/lib/session";

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getSession();
  const demoPreviewEnabled = isDemoPreviewEnabled();
  const isDemoPreview = Boolean(session.isDemo) || (demoPreviewEnabled && !session.userId);
  // The development preview is an empty shell, so allow it when the browser blocks iframe cookies.
  if ((!session.userId && !demoPreviewEnabled) || (session.userId && !session.phone && !session.isDemo)) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-[#f6faf6]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="SusuApp dashboard">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-green-800 text-lg font-black text-white">S</span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">SusuApp</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            {isDemoPreview ? (
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-900">Preview demo</span>
            ) : null}
            {session.phone || session.displayName || isDemoPreview ? (
              <span className="hidden text-sm text-slate-600 sm:inline">
                {session.phone ?? session.displayName ?? "Preview member"}
              </span>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}
