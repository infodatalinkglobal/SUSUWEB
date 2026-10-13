"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { formatGhanaNationalNumber, normalizeGhanaPhone } from "@/lib/validators";

function responseError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  const error = payload.error;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return "Please check the phone number and try again.";
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoSigningIn, setIsDemoSigningIn] = useState(false);
  const demoModeEnabled =
    process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_AUTH_DEMO_MODE === "true";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoModeEnabled) {
      await handleDemoSignIn();
      return;
    }
    setErrorMessage(null);

    const phone = normalizeGhanaPhone(phoneInput);
    if (!phone) {
      setErrorMessage("Enter a valid Ghana phone number with 9 digits after +233.");
      return;
    }
    if (!termsAccepted) {
      setErrorMessage("Please review and accept the draft Terms and Privacy Policy to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setErrorMessage(responseError(payload) ?? "We could not send a code right now. Please try again.");
        return;
      }

      window.sessionStorage.setItem("susuapp:pending-phone", phone);
      window.sessionStorage.setItem("susuapp:terms-accepted", "true");
      router.push("/auth/verify");
    } catch {
      setErrorMessage("We could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoSignIn() {
    setErrorMessage(null);
    const enteredPhone = phoneInput.trim();
    const phone = enteredPhone ? normalizeGhanaPhone(enteredPhone) : null;
    if (enteredPhone && !phone) {
      setErrorMessage("Enter a valid Ghana phone number, or leave the field blank for a generic preview identity.");
      return;
    }

    setIsDemoSigningIn(true);
    try {
      const response = await fetch("/api/auth/dev-sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(phone ? { phone } : {}),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setErrorMessage(responseError(payload) ?? "Preview sign-in is unavailable.");
        return;
      }
      window.location.replace("/dashboard");
    } catch {
      setErrorMessage("We could not open the preview workspace. Please try again.");
    } finally {
      setIsDemoSigningIn(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#dcfce7_0,_#f5f8f5_43%,_#f5f8f5_100%)] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="SusuApp home">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-green-800 text-lg font-black text-white">S</span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">SusuApp</span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-green-800">Back to home</Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
          <section className="mx-auto w-full max-w-md lg:mx-0">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-green-900">
              <span aria-hidden="true">🇬🇭</span> Secure sign-in for Ghana
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Welcome to SusuApp.</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {demoModeEnabled
                ? "Continue straight to the preview workspace. No SMS, account, or database is needed."
                : "Enter your phone number and we'll text you a one-time code. No password or email needed."}
            </p>

            <form onSubmit={handleSubmit} className="surface-card mt-8 space-y-5 p-5 sm:p-7" noValidate>
              <div>
                <label htmlFor="phone" className="field-label">{demoModeEnabled ? "Ghana phone number (optional in preview)" : "Ghana phone number"}</label>
                <div className="flex h-12 overflow-hidden rounded-xl border border-slate-300 bg-white transition focus-within:border-green-700 focus-within:ring-4 focus-within:ring-green-100">
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700">+233</span>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={phoneInput}
                    onChange={(event) => setPhoneInput(formatGhanaNationalNumber(event.currentTarget.value))}
                    placeholder="24 412 3456"
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 text-base text-slate-900 outline-none placeholder:text-slate-400"
                    aria-describedby="phone-help"
                    aria-invalid={Boolean(errorMessage && !normalizeGhanaPhone(phoneInput))}
                    required={!demoModeEnabled}
                  />
                </div>
                <p id="phone-help" className="mt-2 text-xs leading-5 text-slate-500">
                  {demoModeEnabled
                    ? "Optional in preview. Leave blank to use a generic temporary identity; no phone or account is saved."
                    : "We'll normalize local numbers to +233 format. Your number is used for sign-in and group membership."}
                </p>
              </div>

              {demoModeEnabled ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-5 text-amber-950">
                  <strong>Preview mode is active.</strong> This temporary sign-in needs no SMS and saves no account or contribution data.
                </div>
              ) : (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3.5 text-sm leading-5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.currentTarget.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-green-700"
                  />
                  <span>
                    I agree to the draft <Link href="/terms" className="font-semibold text-green-800 underline underline-offset-2">Terms</Link> and <Link href="/privacy" className="font-semibold text-green-800 underline underline-offset-2">Privacy Policy</Link>. I understand these documents need final legal review before production use.
                  </span>
                </label>
              )}

              {errorMessage ? (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{errorMessage}</p>
              ) : null}

              <button type="submit" disabled={isSubmitting || isDemoSigningIn} className="primary-button w-full gap-2">
                {demoModeEnabled ? (
                  isDemoSigningIn ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Opening preview…</>
                  ) : (
                    <>Continue to preview workspace <span aria-hidden="true">→</span></>
                  )
                ) : isSubmitting ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Sending code…</>
                ) : (
                  <>Continue with phone <span aria-hidden="true">→</span></>
                )}
              </button>
              <p className="text-center text-xs leading-5 text-slate-500">
                {demoModeEnabled
                  ? "Temporary preview only. No SMS is sent and nothing is saved."
                  : "By continuing, you’ll receive a one-time SMS code. Standard messaging rates may apply."}
              </p>
            </form>
          </section>

          <aside className="hidden lg:block">
            <div className="relative mx-auto max-w-md rounded-[2rem] bg-green-900 p-8 text-white shadow-2xl shadow-green-950/20">
              <div className="absolute right-8 top-8 h-24 w-24 rounded-full border border-white/10" />
              <div className="absolute right-14 top-14 h-12 w-12 rounded-full border border-white/10" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-200">Susu, made clearer</p>
              <h2 className="relative mt-5 max-w-xs text-3xl font-extrabold leading-tight tracking-tight">Keep the circle strong, one contribution at a time.</h2>
              <div className="mt-10 space-y-4">
                {[
                  ["01", "A clear record", "Contributions and review status in one place."],
                  ["02", "A fair turn", "ROSCA rotation order visible to the group."],
                  ["03", "Your choice", "Record MoMo, Paystack, or cash received."],
                ].map(([number, title, copy]) => (
                  <div key={number} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="text-xs font-black text-green-300">{number}</span>
                    <span><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-5 text-green-100/80">{copy}</span></span>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-xs text-green-200/80">SusuApp is a ledger, not a wallet. It does not hold or guarantee savings.</p>
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-5 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} SusuApp</span>
          <span>Save together, grow together. 🇬🇭</span>
        </footer>
      </div>
    </main>
  );
}
