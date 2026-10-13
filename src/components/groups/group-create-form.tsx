"use client";

import { FormEvent, useState } from "react";

function readError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
}

function readFieldErrors(payload: unknown): Record<string, string> {
  if (typeof payload !== "object" || payload === null || !("issues" in payload) || !Array.isArray(payload.issues)) return {};
  const errors: Record<string, string> = {};
  for (const issue of payload.issues) {
    if (typeof issue !== "object" || issue === null || !("field" in issue) || !("message" in issue)) continue;
    if (typeof issue.field === "string" && typeof issue.message === "string" && issue.field) errors[issue.field] ??= issue.message;
  }
  return errors;
}

export function GroupCreateForm() {
  const [name, setName] = useState("");
  const [type, setType] = useState<"COLLECTOR" | "ROSCA">("COLLECTOR");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalCycles, setTotalCycles] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, contributionAmount: amount, frequency, startDate, totalCycles: Number(totalCycles) }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errors = readFieldErrors(payload);
        setFieldErrors(errors);
        setError(Object.keys(errors).length > 0 ? "Please correct the highlighted group details." : readError(payload) ?? "The group could not be created. Check the details and try again.");
        return;
      }
      if (typeof payload !== "object" || payload === null || !("group" in payload)) {
        setError("The group was created, but we could not open it. Return to your dashboard.");
        return;
      }
      const group = payload.group;
      if (typeof group !== "object" || group === null || !("id" in group) || typeof group.id !== "string") {
        setError("The group was created, but we could not open it. Return to your dashboard.");
        return;
      }
      window.location.assign(`/dashboard/groups/${encodeURIComponent(group.id)}`);
    } catch {
      setError("We could not reach the group service. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card mt-7 space-y-5 p-5 sm:p-7" noValidate>
      <div>
        <label htmlFor="group-name" className="field-label">Group name</label>
        <input id="group-name" className="form-input" value={name} onChange={(event) => { setName(event.currentTarget.value); clearFieldError("name"); }} minLength={2} maxLength={80} placeholder="e.g. Adom Market Women" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "group-name-error" : undefined} required />
        {fieldErrors.name ? <p id="group-name-error" role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.name}</p> : null}
      </div>

      <div>
        <label htmlFor="group-type" className="field-label">Savings model</label>
        <select id="group-type" className="form-input" value={type} onChange={(event) => { setType(event.currentTarget.value as "COLLECTOR" | "ROSCA"); clearFieldError("type"); }} aria-invalid={Boolean(fieldErrors.type)} aria-describedby={fieldErrors.type ? "group-type-error" : undefined}>
          <option value="COLLECTOR">Collector Susu — track each member&apos;s periodic savings</option>
          <option value="ROSCA">ROSCA — members take turns receiving the estimated pot</option>
        </select>
        {fieldErrors.type ? <p id="group-type-error" role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.type}</p> : null}
        <p className="mt-2 text-xs leading-5 text-slate-500">The app records activity; Collector settlements and ROSCA payouts happen outside SusuApp.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contribution-amount" className="field-label">Contribution per cycle (GHS)</label>
          <input id="contribution-amount" className="form-input" type="number" min="1.00" max="99999999.99" step="0.01" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.currentTarget.value); clearFieldError("contributionAmount"); }} placeholder="50.00" aria-invalid={Boolean(fieldErrors.contributionAmount)} aria-describedby={fieldErrors.contributionAmount ? "amount-error" : undefined} required />
          {fieldErrors.contributionAmount ? <p id="amount-error" role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.contributionAmount}</p> : null}
        </div>
        <div>
          <label htmlFor="frequency" className="field-label">Frequency</label>
          <select id="frequency" className="form-input" value={frequency} onChange={(event) => { setFrequency(event.currentTarget.value as "WEEKLY" | "MONTHLY"); clearFieldError("frequency"); }} aria-invalid={Boolean(fieldErrors.frequency)} aria-describedby={fieldErrors.frequency ? "frequency-error" : undefined}>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          {fieldErrors.frequency ? <p id="frequency-error" role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.frequency}</p> : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="start-date" className="field-label">First cycle starts</label>
          <input id="start-date" className="form-input" type="date" value={startDate} onChange={(event) => { setStartDate(event.currentTarget.value); clearFieldError("startDate"); }} aria-invalid={Boolean(fieldErrors.startDate)} aria-describedby={fieldErrors.startDate ? "start-date-error" : undefined} required />
          {fieldErrors.startDate ? <p id="start-date-error" role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.startDate}</p> : null}
          <p className="mt-2 text-xs leading-5 text-slate-500">Schedule dates use the Africa/Accra calendar.</p>
        </div>
        <div>
          <label htmlFor="total-cycles" className="field-label">Planned cycles</label>
          <input id="total-cycles" className="form-input" type="number" min={type === "ROSCA" ? 2 : 1} max="100" step="1" value={totalCycles} onChange={(event) => { setTotalCycles(event.currentTarget.value); clearFieldError("totalCycles"); }} aria-invalid={Boolean(fieldErrors.totalCycles)} aria-describedby={fieldErrors.totalCycles ? "total-cycles-error" : undefined} required />
          {fieldErrors.totalCycles ? <p id="total-cycles-error" role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.totalCycles}</p> : null}
          <p className="mt-2 text-xs leading-5 text-slate-500">{type === "ROSCA" ? "Set this to the planned number of recipients/turns. The organizer starts at turn 1." : "Cycles advance only when the organizer chooses to advance."}</p>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">{error}</p> : null}

      <button type="submit" disabled={isSubmitting} className="primary-button w-full gap-2">
        {isSubmitting ? "Creating group…" : "Create group"}
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">The signed-in organizer is added as the first active member. No money is moved by this action.</p>
    </form>
  );
}
