"use client";

import { useState, type FormEvent } from "react";
import type { MemberRole } from "@prisma/client";

type PaymentMode = "MOMO_MANUAL" | "PAYSTACK" | "CASH";
type MemberOption = { id: string; name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readError(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : null;
}

export function ContributionForm({
  groupId,
  groupAmount,
  currentCycle,
  viewerRole,
  activeMembers,
  selectedMemberId,
  ownContributionStatus,
  ownReviewNote,
  mayContribute,
}: {
  groupId: string;
  groupAmount: string;
  currentCycle: number;
  viewerRole: MemberRole;
  activeMembers: MemberOption[];
  selectedMemberId: string;
  ownContributionStatus: string | null;
  ownReviewNote: string | null;
  mayContribute: boolean;
}) {
  const [mode, setMode] = useState<PaymentMode>("MOMO_MANUAL");
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [cashMemberId, setCashMemberId] = useState(selectedMemberId || activeMembers[0]?.id || "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOrganizer = viewerRole === "ORGANIZER";
  const cycleIsOpen = currentCycle > 0;
  const ownStatusIsPending = ownContributionStatus === null || ownContributionStatus === "PENDING";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode !== "CASH" && (!mayContribute || !ownStatusIsPending)) {
      setError("Your contribution for this cycle is already recorded or is not open.");
      return;
    }
    if (mode === "PAYSTACK" && !email.trim()) {
      setError("Enter an email address for the Paystack receipt.");
      return;
    }
    if (mode === "CASH" && !isOrganizer) {
      setError("Only the group organizer can record cash received.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "PAYSTACK") {
        const response = await fetch("/api/payments/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId, email: email.trim() }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setError(readError(payload) ?? "Paystack could not start the payment. Please try again.");
          return;
        }
        if (!isRecord(payload) || typeof payload.authorizationUrl !== "string") {
          setError("Paystack did not return a payment link. No payment has been marked as paid.");
          return;
        }
        window.location.assign(payload.authorizationUrl);
        return;
      }

      const contributionPayload = mode === "CASH"
        ? { method: "CASH", memberId: cashMemberId, ...(note.trim() ? { note: note.trim() } : {}) }
        : { method: "MOMO_MANUAL", reference: reference.trim() };
      const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contributionPayload),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) ?? "The contribution could not be recorded. Please try again.");
        return;
      }
      window.location.assign(`/dashboard/groups/${encodeURIComponent(groupId)}`);
    } catch {
      setError("We could not reach the payment service. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!cycleIsOpen) {
    return <p className="surface-card mt-7 p-5 text-sm leading-6 text-slate-600">This group has not opened a contribution cycle yet.</p>;
  }

  const tabs: { mode: PaymentMode; title: string; detail: string }[] = [
    { mode: "MOMO_MANUAL", title: "MoMo reference", detail: "You paid through your MoMo provider" },
    { mode: "PAYSTACK", title: "Pay online", detail: "Card or MoMo through Paystack" },
    ...(isOrganizer ? [{ mode: "CASH" as const, title: "Cash received", detail: "Organizer records cash in hand" }] : []),
  ];

  return (
    <form onSubmit={handleSubmit} className="surface-card mt-7 space-y-5 p-5 sm:p-7" noValidate>
      {ownContributionStatus ? (
        <div className={`rounded-xl p-4 text-sm leading-6 ${ownContributionStatus === "VERIFIED" ? "border border-green-200 bg-green-50 text-green-950" : ownContributionStatus === "RECORDED" ? "border border-amber-200 bg-amber-50 text-amber-950" : ownContributionStatus === "MISSED" ? "border border-red-200 bg-red-50 text-red-950" : "bg-slate-50 text-slate-700"}`}>
          Your status this cycle: <strong>{statusLabel(ownContributionStatus)}</strong>.
          {ownReviewNote ? <span className="mt-1 block">Organizer note: {ownReviewNote}</span> : null}
        </div>
      ) : null}

      {isOrganizer ? (
        <fieldset>
          <legend className="field-label">Record method</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {tabs.map((tab) => (
              <button key={tab.mode} type="button" onClick={() => { setMode(tab.mode); setError(null); }} aria-pressed={mode === tab.mode} className={`rounded-xl border p-3 text-left transition ${mode === tab.mode ? "border-green-500 bg-green-50 ring-2 ring-green-100" : "border-slate-200 bg-white hover:border-green-200"}`}>
                <span className="block text-sm font-bold text-slate-900">{tab.title}</span>
                <span className="mt-1 block text-xs leading-4 text-slate-500">{tab.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset>
          <legend className="field-label">How did you pay?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {tabs.map((tab) => (
              <button key={tab.mode} type="button" onClick={() => { setMode(tab.mode); setError(null); }} aria-pressed={mode === tab.mode} className={`rounded-xl border p-3 text-left transition ${mode === tab.mode ? "border-green-500 bg-green-50 ring-2 ring-green-100" : "border-slate-200 bg-white hover:border-green-200"}`}>
                <span className="block text-sm font-bold text-slate-900">{tab.title}</span>
                <span className="mt-1 block text-xs leading-4 text-slate-500">{tab.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {mode === "MOMO_MANUAL" ? (
        <div>
          <label htmlFor="momo-reference" className="field-label">MoMo transaction reference</label>
          <input id="momo-reference" className="form-input font-mono" value={reference} onChange={(event) => setReference(event.currentTarget.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64))} minLength={6} maxLength={64} autoCapitalize="characters" placeholder="e.g. ABC12345" required disabled={!mayContribute || !ownStatusIsPending} />
          <p className="mt-2 text-xs leading-5 text-slate-500">Your reference will be marked Review due until an organizer checks it. SusuApp does not verify the external MoMo payment automatically.</p>
        </div>
      ) : null}

      {mode === "PAYSTACK" ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="paystack-email" className="field-label">Email for Paystack receipt</label>
            <input id="paystack-email" className="form-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} placeholder="you@example.com" required disabled={!mayContribute || !ownStatusIsPending} />
          </div>
          <p className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-950">The server initializes the group&apos;s exact GHS contribution amount. Return from Paystack does not mark it paid; only a verified Paystack webhook can do that.</p>
        </div>
      ) : null}

      {mode === "CASH" && isOrganizer ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="cash-member" className="field-label">Member who paid cash</label>
            <select id="cash-member" className="form-input" value={cashMemberId} onChange={(event) => setCashMemberId(event.currentTarget.value)} required>
              {activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cash-note" className="field-label">Note (optional)</label>
            <input id="cash-note" className="form-input" value={note} onChange={(event) => setNote(event.currentTarget.value)} maxLength={500} placeholder="Optional receipt note" />
          </div>
          <p className="rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-950">Only record cash you actually received. This entry is verified immediately and attributed to your organizer account.</p>
        </div>
      ) : null}

      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">{error}</p> : null}
      <button type="submit" disabled={isSubmitting || (mode !== "CASH" && (!mayContribute || !ownStatusIsPending)) || (mode === "CASH" && (!isOrganizer || activeMembers.length === 0))} className="primary-button w-full gap-2">
        {isSubmitting ? "Saving…" : mode === "MOMO_MANUAL" ? "Submit MoMo reference" : mode === "PAYSTACK" ? "Continue to Paystack" : "Record cash received"}
      </button>
      <p className="text-center text-xs text-slate-500">Expected amount: GHS {groupAmount} · Cycle {currentCycle}</p>
    </form>
  );
}

function statusLabel(status: string): string {
  if (status === "VERIFIED") return "Verified";
  if (status === "RECORDED") return "Review due";
  if (status === "MISSED") return "Missed";
  return "Pending";
}
