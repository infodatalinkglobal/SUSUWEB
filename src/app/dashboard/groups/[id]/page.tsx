import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContributionStatus, MemberRole, MemberStatus } from "@prisma/client";
import { MarkMissedButton } from "@/components/contributions/mark-missed-button";
import { ReviewContributionButtons } from "@/components/contributions/review-buttons";
import { ContributionStatusBadge } from "@/components/contributions/status-badge";
import { AdvanceCycleButton } from "@/components/groups/advance-cycle-button";
import { ReminderLinks } from "@/components/groups/reminder-links";
import { RotationEditor } from "@/components/groups/rotation-editor";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { amountToPesewas, cycleStartDate, formatAccraDate, formatGhs, formatPesewas } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Group ledger" };

export default async function GroupDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || !session.phone || session.isDemo) redirect("/auth/login");

  const viewerMembership = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: session.userId, status: MemberStatus.ACTIVE },
    select: { id: true, role: true },
  });
  if (!viewerMembership) notFound();
  const isOrganizer = viewerMembership.role === MemberRole.ORGANIZER;

  const group = await prisma.susuGroup.findUnique({
    where: { id },
    include: {
      members: {
        where: isOrganizer
          ? { status: { in: [MemberStatus.ACTIVE, MemberStatus.INVITED] } }
          : { status: MemberStatus.ACTIVE },
        include: { user: { select: { name: true, phone: true } } },
        orderBy: [{ rotationOrder: "asc" }, { joinedAt: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!group || !group.isActive) notFound();

  const firstVisibleCycle = Math.max(1, group.currentCycle - 4);
  const lastVisibleCycle = Math.min(group.totalCycles, group.currentCycle + 1);
  const visibleCycleNumbers = Array.from(
    { length: Math.max(0, lastVisibleCycle - firstVisibleCycle + 1) },
    (_, index) => firstVisibleCycle + index,
  );
  const [currentContributions, history, cycleMatrixContributions, collectorTotals] = await Promise.all([
    prisma.contribution.findMany({
      where: { groupId: id, cycle: group.currentCycle },
      include: { member: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contribution.findMany({
      where: { groupId: id, cycle: { lt: group.currentCycle } },
      include: { member: { include: { user: { select: { name: true } } } } },
      orderBy: [{ cycle: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.contribution.findMany({
      where: { groupId: id, cycle: { gte: firstVisibleCycle, lte: lastVisibleCycle } },
      select: { memberId: true, cycle: true, status: true },
    }),
    group.type === "COLLECTOR"
      ? prisma.contribution.groupBy({
          by: ["memberId", "status"],
          where: { groupId: id, status: { in: [ContributionStatus.VERIFIED, ContributionStatus.RECORDED] } },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  const activeMembers = group.members.filter((member) => member.status === MemberStatus.ACTIVE);
  const invitedMembers = group.members.filter((member) => member.status === MemberStatus.INVITED);
  const currentByMember = new Map(currentContributions.map((contribution) => [contribution.memberId, contribution]));
  const cycleStatusByMember = new Map(cycleMatrixContributions.map((contribution) => [`${contribution.memberId}:${contribution.cycle}`, contribution.status]));
  const verifiedCurrent = currentContributions.filter((entry) => entry.status === ContributionStatus.VERIFIED).length;
  const recordedCurrent = currentContributions.filter((entry) => entry.status === ContributionStatus.RECORDED).length;
  const periodStart = cycleStartDate(group.startDate, group.frequency, group.currentCycle);
  const nextRecipient = group.type === "ROSCA"
    ? group.members.find((member) => member.rotationOrder === group.currentCycle)
    : undefined;
  const estimatedPot = BigInt(amountToPesewas(group.contributionAmount.toFixed(2))) * BigInt(activeMembers.length);
  const totalsByMember = new Map<string, { verified: bigint; recorded: bigint }>();
  for (const row of collectorTotals) {
    const current = totalsByMember.get(row.memberId) ?? { verified: BigInt(0), recorded: BigInt(0) };
    const total = row._sum.amount ? BigInt(amountToPesewas(row._sum.amount.toFixed(2))) : BigInt(0);
    if (row.status === ContributionStatus.VERIFIED) current.verified += total;
    if (row.status === ContributionStatus.RECORDED) current.recorded += total;
    totalsByMember.set(row.memberId, current);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm font-semibold text-green-800 hover:text-green-950">← All groups</Link>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">{group.type === "ROSCA" ? "ROSCA group" : "Collector group"}</p>
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-800">Active</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{group.name}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {formatGhs(group.contributionAmount.toFixed(2))} per member · {group.frequency.toLowerCase()} · starts {formatAccraDate(group.startDate)} · Cycle {group.currentCycle} of {group.totalCycles}
          </p>
          <p className="mt-1 text-xs text-slate-500">This cycle starts {formatAccraDate(periodStart)} (Africa/Accra). Cycles advance manually.</p>
        </div>
        {isOrganizer ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/groups/${encodeURIComponent(id)}/invite`} className="primary-button gap-2">Invite members <span aria-hidden="true">+</span></Link>
            <AdvanceCycleButton groupId={id} currentCycle={group.currentCycle} totalCycles={group.totalCycles} />
          </div>
        ) : null}
      </div>

      <section aria-label="Group summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Active members" value={String(activeMembers.length)} detail={invitedMembers.length > 0 && isOrganizer ? `${invitedMembers.length} invitation${invitedMembers.length === 1 ? "" : "s"} pending` : "Only active members count"} />
        <SummaryCard label="Verified this cycle" value={`${verifiedCurrent} / ${activeMembers.length}`} detail={`${recordedCurrent} awaiting organizer review`} />
        <SummaryCard label={group.type === "ROSCA" ? "Estimated group pot" : "Contribution per cycle"} value={group.type === "ROSCA" ? formatPesewas(estimatedPot) : formatGhs(group.contributionAmount.toFixed(2))} detail={group.type === "ROSCA" ? "Estimate only; no funds are held or guaranteed" : group.frequency.toLowerCase()} />
        <SummaryCard label={group.type === "ROSCA" ? "Current turn recipient" : "Schedule"} value={group.type === "ROSCA" ? nextRecipient?.user.name ?? (nextRecipient?.status === MemberStatus.INVITED ? "Invited member" : nextRecipient ? "Susu member" : "Turn not assigned") : group.frequency === "WEEKLY" ? "Weekly" : "Monthly"} detail={group.type === "ROSCA" ? `Turn ${group.currentCycle} of ${group.totalCycles}` : "Collector settlements happen offline"} />
      </section>

      {group.type === "ROSCA" ? (
        <section className="surface-card p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Rotation schedule</h2>
              <p className="mt-1 text-sm text-slate-500">The estimate is not a payout promise. Settlements happen outside SusuApp.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{activeMembers.length} active eligible members</span>
          </div>
          {isOrganizer && group.currentCycle === 1 && currentContributions.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-green-100 bg-green-50/60 p-4">
              <h3 className="text-sm font-extrabold text-slate-900">Review the agreed rotation before the first contribution</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">Reorder active and invited members now. Once the group advances or records contributions, completed history is protected and the order locks.</p>
              <RotationEditor groupId={id} members={group.members.map((member) => ({ id: member.id, name: member.user.name ?? member.user.phone, rotationOrder: member.rotationOrder }))} />
            </div>
          ) : null}
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: group.totalCycles }, (_, index) => index + 1).map((cycle) => {
              const rotationMember = group.members.find((member) => member.rotationOrder === cycle);
              const cycleDate = cycleStartDate(group.startDate, group.frequency, cycle);
              return (
                <li key={cycle} className={`rounded-2xl border p-4 ${cycle === group.currentCycle ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Turn {cycle}</span>
                    {cycle === group.currentCycle ? <span className="rounded-full bg-green-700 px-2 py-0.5 text-[10px] font-bold text-white">Current</span> : null}
                  </div>
                  <p className="mt-2 font-bold text-slate-900">{rotationMember?.user.name ?? (rotationMember?.status === MemberStatus.INVITED ? "Invited member" : rotationMember ? "Susu member" : isOrganizer ? "Recipient to be invited" : "Recipient not active yet")}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatAccraDate(cycleDate)}{rotationMember ? ` · ${formatGhs(group.contributionAmount.toFixed(2))} × ${activeMembers.length} active members` : ""}</p>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Cycle {group.currentCycle} contribution ledger</h2>
            <p className="mt-1 text-sm text-slate-500">Statuses are shown as recorded; pending does not mean a payment was automatically missed.</p>
          </div>
          {!isOrganizer && group.currentCycle <= group.totalCycles ? (
            <Link href={`/dashboard/groups/${encodeURIComponent(id)}/contribute`} className="primary-button gap-2">Record my contribution <span aria-hidden="true">→</span></Link>
          ) : null}
        </div>
        {activeMembers.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Invite and activate members to start the ledger.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activeMembers.map((member) => {
              const contribution = currentByMember.get(member.id);
              const status = contribution?.status ?? ContributionStatus.PENDING;
              const totals = totalsByMember.get(member.id) ?? { verified: BigInt(0), recorded: BigInt(0) };
              const memberName = member.user.name ?? "Susu member";
              return (
                <li key={member.id} className="flex flex-col gap-3 p-4 sm:px-7 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{memberName}</p>
                      {member.role === MemberRole.ORGANIZER ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Organizer</span> : null}
                      {group.type === "ROSCA" && member.rotationOrder ? <span className="text-xs text-slate-500">Turn {member.rotationOrder}</span> : null}
                    </div>
                    {isOrganizer ? <p className="mt-1 text-xs text-slate-500">{member.user.phone}</p> : null}
                    {group.type === "COLLECTOR" ? <p className="mt-2 text-xs text-slate-500">Verified total: <strong className="text-slate-700">{formatPesewas(totals.verified)}</strong> · Awaiting review: {formatPesewas(totals.recorded)}</p> : null}
                    {contribution?.reviewNote && (isOrganizer || contribution.userId === session.userId) ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">Organizer note: {contribution.reviewNote}</p> : null}
                    {isOrganizer && contribution?.momoReference ? <p className="mt-2 text-xs text-slate-500">MoMo reference: <span className="font-mono font-semibold text-slate-700">{contribution.momoReference}</span></p> : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <ContributionStatusBadge status={status} />
                    {contribution?.paymentMethod ? <span className="text-[11px] text-slate-500">{paymentMethodLabel(contribution.paymentMethod)}</span> : null}
                    {isOrganizer && status === ContributionStatus.RECORDED && contribution ? <ReviewContributionButtons contributionId={contribution.id} /> : null}
                    {isOrganizer && (status === ContributionStatus.PENDING || status === ContributionStatus.MISSED) ? (
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/groups/${encodeURIComponent(id)}/contribute?memberId=${encodeURIComponent(member.id)}`} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-900">Record cash received</Link>
                        {status === ContributionStatus.PENDING ? <MarkMissedButton groupId={id} memberId={member.id} memberName={memberName} /> : null}
                      </div>
                    ) : null}
                    {!isOrganizer && member.userId === session.userId && status === ContributionStatus.PENDING ? (
                      <Link href={`/dashboard/groups/${encodeURIComponent(id)}/contribute`} className="text-xs font-bold text-green-800 underline underline-offset-2">Submit MoMo reference or pay</Link>
                    ) : null}
                    {!isOrganizer && member.userId === session.userId && status === ContributionStatus.RECORDED ? <span className="text-xs text-amber-800">Your reference is awaiting organizer review.</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="surface-card p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Cycle-by-cycle ledger</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">Recent cycles for each active member. Pending is not automatically marked missed.</p>
          </div>
          <span className="text-xs text-slate-500">Showing cycles {visibleCycleNumbers[0] ?? group.currentCycle}–{visibleCycleNumbers[visibleCycleNumbers.length - 1] ?? group.currentCycle}</span>
        </div>
        {activeMembers.length === 0 ? <p className="mt-4 text-sm text-slate-500">No active members to show.</p> : (
          <ul className="mt-4 space-y-3">
            {activeMembers.map((member) => (
              <li key={member.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-bold text-slate-900">{member.user.name ?? "Susu member"}{isOrganizer ? <span className="ml-2 text-xs font-normal text-slate-500">{member.user.phone}</span> : null}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {visibleCycleNumbers.map((cycle) => {
                    const status = cycle > group.currentCycle
                      ? "FUTURE"
                      : cycleStatusByMember.get(`${member.id}:${cycle}`) ?? ContributionStatus.PENDING;
                    return (
                      <div key={cycle} className="rounded-xl bg-slate-50 p-2.5">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Cycle {cycle}</p>
                        <ContributionStatusBadge status={status} />
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOrganizer ? (
        <section className="surface-card p-5 sm:p-7">
          <h2 className="text-lg font-extrabold text-slate-950">Human-sent WhatsApp reminders</h2>
          <p className="mt-1 mb-4 text-sm leading-6 text-slate-500">Prepare one-to-one reminders for members who have not recorded a payment. SusuApp never sends them automatically.</p>
          <ReminderLinks groupId={id} />
        </section>
      ) : null}

      {invitedMembers.length > 0 && isOrganizer ? (
        <section className="surface-card p-5 sm:p-7">
          <h2 className="text-lg font-extrabold text-slate-950">Invitations awaiting acceptance</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {invitedMembers.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm font-semibold text-slate-800">{member.user.name ?? member.user.phone}</p><p className="text-xs text-slate-500">{member.user.phone}{member.rotationOrder ? ` · ROSCA turn ${member.rotationOrder}` : ""}</p></div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">Invited</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-100 p-5 sm:px-7"><h2 className="text-lg font-extrabold text-slate-950">Recent contribution history</h2><p className="mt-1 text-sm text-slate-500">Showing up to the 100 most recent completed-cycle records. Verified contributions remain in the ledger.</p></div>
        {history.length === 0 ? <p className="p-6 text-sm text-slate-500">No earlier-cycle contributions yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {history.map((contribution) => (
              <li key={contribution.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div><p className="text-sm font-semibold text-slate-900">{contribution.member.user.name ?? "Susu member"} · Cycle {contribution.cycle}</p><p className="mt-1 text-xs text-slate-500">{formatGhs(contribution.amount.toFixed(2))}{contribution.paymentMethod ? ` · ${paymentMethodLabel(contribution.paymentMethod)}` : ""}{isOrganizer && contribution.momoReference ? ` · Ref ${contribution.momoReference}` : ""}</p></div>
                <ContributionStatusBadge status={contribution.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">SusuApp is a ledger, not a wallet. It does not hold or guarantee savings. WhatsApp messages are sent only when a person opens WhatsApp and presses Send.</p>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="surface-card p-4 sm:p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-xl font-extrabold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function paymentMethodLabel(method: string): string {
  if (method === "MOMO_MANUAL") return "MoMo reference";
  if (method === "PAYSTACK") return "Paystack";
  if (method === "CASH") return "Cash received";
  return method;
}
