"use client";

import { useState } from "react";

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
}

export function JoinInvitationButton({ groupId }: { groupId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  async function acceptInvitation() {
    setError(null);
    setIsJoining(true);
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/join`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) ?? "The invitation could not be accepted. Refresh and try again.");
        return;
      }
      window.location.assign(`/dashboard/groups/${encodeURIComponent(groupId)}`);
    } catch {
      setError("We could not reach the invitation service. Check your connection and try again.");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div>
      {error ? <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      <button type="button" onClick={acceptInvitation} disabled={isJoining} className="primary-button w-full gap-2">
        {isJoining ? "Joining group…" : "Accept invitation"}
      </button>
    </div>
  );
}
