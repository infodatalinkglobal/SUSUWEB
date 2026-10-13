"use client";

import { useState } from "react";

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
}

export function ReviewContributionButtons({ contributionId }: { contributionId: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"verify" | "reject" | null>(null);

  async function submitReview(kind: "verify" | "reject") {
    setError(null);
    if (kind === "reject" && note.trim().length < 3) {
      setError("Add a short reason before rejecting this reference.");
      return;
    }
    if (kind === "reject" && !window.confirm("Reject this MoMo reference? The member can submit a replacement.")) return;
    setAction(kind);
    try {
      const response = await fetch(`/api/contributions/${encodeURIComponent(contributionId)}/${kind}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "reject" ? { note: note.trim() } : { note: note.trim() || undefined }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) ?? "The contribution review could not be saved.");
        return;
      }
      window.location.reload();
    } catch {
      setError("We could not reach the contribution service. Try again.");
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-amber-50 p-3">
      <label htmlFor={`review-note-${contributionId}`} className="mb-1 block text-xs font-semibold text-slate-700">Review note (optional to verify, required to reject)</label>
      <input id={`review-note-${contributionId}`} value={note} onChange={(event) => setNote(event.currentTarget.value)} maxLength={500} className="form-input h-10 text-sm" placeholder="e.g. Reference not found" />
      {error ? <p role="alert" className="mt-2 text-xs leading-5 text-red-700">{error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => submitReview("verify")} disabled={action !== null} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800 disabled:opacity-50">
          {action === "verify" ? "Verifying…" : "Verify reference"}
        </button>
        <button type="button" onClick={() => submitReview("reject")} disabled={action !== null} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-50 disabled:opacity-50">
          {action === "reject" ? "Rejecting…" : "Reject & request replacement"}
        </button>
      </div>
    </div>
  );
}
