"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { normalizeGhanaPhone } from "@/lib/validators";

function responseError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  const error = payload.error;
  return typeof error === "string" ? error : null;
}

export default function VerifyPage() {
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    const storedPhone = window.sessionStorage.getItem("susuapp:pending-phone");
    setPhone(storedPhone && normalizeGhanaPhone(storedPhone) ? storedPhone : "");

    const timer = window.setInterval(() => {
      setResendIn((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!phone || !normalizeGhanaPhone(phone)) {
      setErrorMessage("Your sign-in number is missing. Return to the previous step and try again.");
      return;
    }
    if (code.length !== 6) {
      setErrorMessage("Enter the six-digit code from your SMS.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          termsAccepted: window.sessionStorage.getItem("susuapp:terms-accepted") === "true",
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setErrorMessage(responseError(payload) ?? "We could not verify that code. Please try again.");
        return;
      }

      window.sessionStorage.removeItem("susuapp:pending-phone");
      window.sessionStorage.removeItem("susuapp:terms-accepted");
      window.location.replace("/dashboard");
    } catch {
      setErrorMessage("We could not reach the verification service. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!phone || !normalizeGhanaPhone(phone) || resendIn > 0 || isResending) return;
    setErrorMessage(null);
    setIsResending(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setErrorMessage(responseError(payload) ?? "We could not send another code. Please try again later.");
        return;
      }
      setCode("");
      setResendIn(30);
    } catch {
      setErrorMessage("We could not reach the SMS service. Please try again later.");
    } finally {
      setIsResending(false);
    }
  }

  const phoneIsReady = phone !== null && phone.length > 0 && normalizeGhanaPhone(phone) !== null;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_#dcfce7_0,_#f5f8f5_42%,_#f5f8f5_100%)] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="SusuApp home">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-green-800 text-lg font-black text-white">S</span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">SusuApp</span>
          </Link>
          <Link href="/auth/login" className="text-sm font-semibold text-slate-600 hover:text-green-800">Change number</Link>
        </header>

        <div className="grid flex-1 place-items-center py-10">
          <section className="surface-card w-full max-w-md p-6 sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-green-100 text-xl text-green-800" aria-hidden="true">✉</div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-green-800">Phone verification</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Check your messages.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Enter the six-digit code sent to{" "}
              <span className="font-bold text-slate-900">{phoneIsReady ? phone : "your phone"}</span>.
              The code expires in five minutes.
            </p>

            {!phoneReadyOrLoaded(phone) ? (
              <div className="mt-7 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                {phone === null ? "Loading your sign-in details…" : "No phone number was found for this sign-in. Return to the login page to request a code."}
                {phone !== null ? <Link href="/auth/login" className="ml-1 font-bold underline underline-offset-2">Go to login</Link> : null}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
                <div>
                  <label htmlFor="otp-code" className="field-label">One-time code</label>
                  <input
                    id="otp-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.currentTarget.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="form-input h-14 text-center text-2xl font-bold tracking-[0.55em]"
                    aria-describedby="otp-help"
                    aria-invalid={Boolean(errorMessage)}
                    required
                    autoFocus
                  />
                  <p id="otp-help" className="mt-2 text-xs text-slate-500">For your security, don&apos;t share this code with anyone.</p>
                </div>

                {errorMessage ? (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-800">{errorMessage}</p>
                ) : null}

                <button type="submit" disabled={isSubmitting || code.length !== 6} className="primary-button w-full gap-2">
                  {isSubmitting ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Verifying…</>
                  ) : (
                    <>Verify and continue <span aria-hidden="true">→</span></>
                  )}
                </button>

                <div className="text-center text-sm text-slate-500">
                  Didn&apos;t receive a code?{" "}
                  {resendIn > 0 ? (
                    <span>Resend in {resendIn}s</span>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={isResending} className="font-bold text-green-800 underline underline-offset-2 disabled:text-slate-400">
                      {isResending ? "Sending…" : "Send a new code"}
                    </button>
                  )}
                </div>
              </form>
            )}

            <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">
              By continuing, you confirm your acceptance of the draft <Link href="/terms" className="font-semibold text-green-800 underline underline-offset-2">Terms</Link> and <Link href="/privacy" className="font-semibold text-green-800 underline underline-offset-2">Privacy Policy</Link>.
            </p>
          </section>
        </div>

        <footer className="border-t border-slate-200/80 pt-5 text-center text-xs text-slate-500">SusuApp is a ledger, not a wallet.</footer>
      </div>
    </main>
  );
}

function phoneReadyOrLoaded(phone: string | null): boolean {
  return phone !== null && phone.length > 0 && normalizeGhanaPhone(phone) !== null;
}
