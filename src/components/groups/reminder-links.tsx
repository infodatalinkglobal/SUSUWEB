"use client";

import { useState } from "react";

type Reminder = { memberId: string; name: string; phone: string; status: string; whatsappUrl: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readError(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : null;
}

function readReminders(payload: unknown): Reminder[] {
  if (!isRecord(payload) || !Array.isArray(payload.reminders)) return [];
  return payload.reminders.flatMap((item): Reminder[] => {
    if (!isRecord(item) || typeof item.memberId !== "string" || typeof item.name !== "string" || typeof item.phone !== "string" || typeof item.status !== "string" || typeof item.whatsappUrl !== "string") return [];
    return [{ memberId: item.memberId, name: item.name, phone: item.phone, status: item.status, whatsappUrl: item.whatsappUrl }];
  });
}

export function ReminderLinks({ groupId }: { groupId: string }) {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  async function prepare() {
    setError(null);
    setIsPreparing(true);
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) ?? "Reminder links could not be prepared.");
        return;
      }
      setReminders(readReminders(payload));
    } catch {
      setError("We could not reach the reminder service. Try again.");
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={prepare} disabled={isPreparing} className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-900 transition hover:bg-green-100 disabled:opacity-50">
        {isPreparing ? "Preparing links…" : "Prepare WhatsApp reminders"}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm leading-5 text-red-700">{error}</p> : null}
      {reminders !== null ? (
        <div aria-live="polite" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-900">{reminders.length === 0 ? "No members need a reminder for this cycle." : `${reminders.length} individual reminder link${reminders.length === 1 ? "" : "s"} ready`}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">SusuApp has not sent anything. Open each link, confirm the recipient and message, then press Send in WhatsApp.</p>
          {reminders.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {reminders.map((reminder) => (
                <li key={reminder.memberId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold text-slate-800">{reminder.name} <span className="font-normal text-slate-500">· {reminder.phone}</span></span>
                  <a href={reminder.whatsappUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-green-800 underline underline-offset-2">Open WhatsApp ↗</a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
