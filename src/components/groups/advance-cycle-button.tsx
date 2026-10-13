"use client";

import { useState } from "react";

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
}

export function AdvanceCycleButton({ groupId, currentCycle, totalCycles }: { groupId: string; currentCycle: number; totalCycles: number }) {
  const [error, setError] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  async function advance() {
    if (currentCycle >= totalCycles || isAdvancing) return;
    const confirmed = window.confirm(`Advance this group from cycle ${currentCycle} to cycle ${currentCycle + 1}? Past contribution records will remain unchanged.`);
    if (!confirmed) return;
    setError(null);
    setIsAdvancing(true);
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/cycle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedCycle: currentCycle }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) ?? "The cycle could not be advanced. Refresh and try again.");
        return;
      }
      window.location.reload();
    } catch {
      setError("We could not reach the group service. Check your connection and try again.");
    } finally {
      setIsAdvancing(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={advance} disabled={isAdvancing || currentCycle >= totalCycles} className="rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm font-bold text-green-900 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50">
        {isAdvancing ? "Advancing…" : currentCycle >= totalCycles ? "All cycles complete" : `Advance to cycle ${currentCycle + 1}`}
      </button>
      {error ? <p role="alert" className="mt-2 max-w-sm text-xs leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}
