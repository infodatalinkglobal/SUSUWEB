"use client";

import { useState } from "react";

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
}

export function MarkMissedButton({ groupId, memberId, memberName }: { groupId: string; memberId: string; memberName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function markMissed() {
    if (isSaving || !window.confirm(`Mark ${memberName}'s current-cycle contribution as missed? This is a manual ledger action.`)) return;
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/contributions/missed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) ?? "The contribution could not be updated.");
        return;
      }
      window.location.reload();
    } catch {
      setError("We could not reach the contribution service. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={markMissed} disabled={isSaving} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-50 disabled:opacity-50">
        {isSaving ? "Saving…" : "Mark missed"}
      </button>
      {error ? <p role="alert" className="mt-1 max-w-56 text-xs leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}
