"use client";

import { FormEvent, useState } from "react";

type InviteResult = {
  phone: string;
  status: string;
  name: string | null;
  whatsappUrl: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readError(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : null;
}

function readInviteResults(payload: unknown): InviteResult[] {
  if (!isRecord(payload) || !Array.isArray(payload.results)) return [];
  return payload.results.flatMap((item): InviteResult[] => {
    if (!isRecord(item) || typeof item.phone !== "string" || typeof item.status !== "string") return [];
    return [{
      phone: item.phone,
      status: item.status,
      name: typeof item.name === "string" ? item.name : null,
      whatsappUrl: typeof item.whatsappUrl === "string" ? item.whatsappUrl : null,
    }];
  });
}

function readStringArray(payload: unknown, key: string): string[] {
  if (!isRecord(payload) || !Array.isArray(payload[key])) return [];
  return payload[key].filter((item): item is string => typeof item === "string");
}

function statusLabel(status: string): string {
  if (status === "invited") return "Invitation created";
  if (status === "already-invited") return "Already invited — link can be resent";
  if (status === "already-active") return "Already an active member";
  if (status === "rotation-full") return "No ROSCA turn available";
  return status;
}

export function InviteMembersForm({ groupId }: { groupId: string }) {
  const [phones, setPhones] = useState("");
  const [results, setResults] = useState<InviteResult[]>([]);
  const [invalidNumbers, setInvalidNumbers] = useState<string[]>([]);
  const [duplicateNumbers, setDuplicateNumbers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResults([]);
    setInvalidNumbers([]);
    setDuplicateNumbers([]);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) ?? "Invitations could not be created. Please try again.");
        return;
      }
      setResults(readInviteResults(payload));
      setInvalidNumbers(readStringArray(payload, "invalidNumbers"));
      setDuplicateNumbers(readStringArray(payload, "duplicateNumbers"));
      setPhones("");
    } catch {
      setError("We could not reach the invitation service. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="surface-card mt-7 space-y-5 p-5 sm:p-7" noValidate>
        <div>
          <label htmlFor="invite-phones" className="field-label">Member phone numbers</label>
          <textarea
            id="invite-phones"
            className="form-input min-h-36 resize-y py-3"
            value={phones}
            onChange={(event) => setPhones(event.currentTarget.value)}
            placeholder={"024 412 3456\n020 123 4567"}
            aria-describedby="invite-help"
            required
          />
          <p id="invite-help" className="mt-2 text-xs leading-5 text-slate-500">Separate numbers with commas or new lines. Local Ghana numbers are normalized to +233. Duplicate and invalid numbers are reported.</p>
        </div>
        {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
        <button type="submit" disabled={isSubmitting || phones.trim().length === 0} className="primary-button w-full gap-2">
          {isSubmitting ? "Preparing invitations…" : "Create invitation links"}
        </button>
        <p className="text-center text-xs leading-5 text-slate-500">Links open a human-sent WhatsApp message. Review each message and press Send in WhatsApp.</p>
      </form>

      {results.length > 0 || invalidNumbers.length > 0 || duplicateNumbers.length > 0 ? (
        <section aria-live="polite" className="mt-7 space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Invitation results</h2>
            <p className="mt-1 text-sm text-slate-500">New invitations are pending until the matching phone signs in and accepts.</p>
          </div>
          {results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((result) => (
                <li key={`${result.phone}-${result.status}`} className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{result.name ?? result.phone}</p>
                    {result.name ? <p className="text-xs text-slate-500">{result.phone}</p> : null}
                    <p className="mt-1 text-xs text-slate-600">{statusLabel(result.status)}</p>
                  </div>
                  {result.whatsappUrl ? (
                    <a href={result.whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-900 hover:bg-green-100">
                      Open WhatsApp ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {invalidNumbers.length > 0 ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><strong>Invalid:</strong> {invalidNumbers.join(", ")}</p> : null}
          {duplicateNumbers.length > 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Duplicate numbers in this request:</strong> {duplicateNumbers.join(", ")}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
