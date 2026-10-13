"use client";

import { useState } from "react";

type RotationMember = { id: string; name: string; rotationOrder: number | null };

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
}

export function RotationEditor({ groupId, members }: { groupId: string; members: RotationMember[] }) {
  const [orders, setOrders] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    members.forEach((member, index) => { initial[member.id] = member.rotationOrder ?? index + 1; });
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveRotation() {
    setError(null);
    const assigned = Object.values(orders);
    if (assigned.length !== members.length || new Set(assigned).size !== members.length) {
      setError("Assign a different turn number to every member.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/rotation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: members.map((member) => ({ memberId: member.id, rotationOrder: orders[member.id] })) }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) ?? "The rotation could not be saved. Refresh and try again.");
        return;
      }
      window.location.reload();
    } catch {
      setError("We could not reach the group service. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{member.name}</span>
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
              Turn
              <select value={orders[member.id] ?? 1} onChange={(event) => setOrders((current) => ({ ...current, [member.id]: Number(event.currentTarget.value) }))} className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-900" aria-label={`Rotation turn for ${member.name}`}>
                {members.map((_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
              </select>
            </label>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm leading-5 text-red-700">{error}</p> : null}
      <button type="button" onClick={saveRotation} disabled={isSaving || members.length === 0} className="rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm font-bold text-green-900 transition hover:bg-green-50 disabled:opacity-50">
        {isSaving ? "Saving order…" : "Save rotation order"}
      </button>
      <p className="text-xs leading-5 text-slate-500">Each active or invited member needs a unique sequential turn. This control locks as soon as the group advances or a contribution is recorded.</p>
    </div>
  );
}
