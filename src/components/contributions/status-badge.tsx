import type { ContributionStatus } from "@prisma/client";

type DisplayStatus = ContributionStatus | "FUTURE";

const statusStyles: Record<DisplayStatus, string> = {
  VERIFIED: "bg-green-100 text-green-900",
  RECORDED: "bg-amber-100 text-amber-950",
  PENDING: "bg-slate-100 text-slate-700",
  MISSED: "bg-red-100 text-red-900",
  FUTURE: "bg-blue-50 text-blue-800",
};

const statusLabels: Record<DisplayStatus, string> = {
  VERIFIED: "✓ Verified",
  RECORDED: "◷ Review due",
  PENDING: "— Pending",
  MISSED: "× Missed",
  FUTURE: "· Future",
};

export function ContributionStatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={`inline-flex min-h-7 items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
