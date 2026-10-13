import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MemberRole, MemberStatus } from "@prisma/client";
import { ContributionForm } from "@/components/contributions/contribution-form";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { cycleStartDate, formatAccraDate, formatGhs } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string; memberId?: string }>;
};

export const metadata: Metadata = { title: "Record a contribution" };

export default async function ContributePage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const session = await getSession();
  if (!session.userId || !session.phone || session.isDemo) redirect("/auth/login");

  const membership = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: session.userId, status: MemberStatus.ACTIVE },
    select: { id: true, role: true },
  });
  if (!membership) notFound();

  const group = await prisma.susuGroup.findUnique({
    where: { id },
    include: {
      members: {
        where: { status: MemberStatus.ACTIVE },
        include: { user: { select: { name: true, phone: true } } },
        orderBy: [{ rotationOrder: "asc" }, { joinedAt: "asc" }],
      },
    },
  });
  if (!group || !group.isActive) notFound();

  const ownContribution = await prisma.contribution.findUnique({
    where: { memberId_cycle: { memberId: membership.id, cycle: group.currentCycle } },
    select: { status: true, paymentMethod: true, reviewNote: true },
  });
  const selectedMember = membership.role === MemberRole.ORGANIZER
    ? group.members.find((member) => member.id === query.memberId)
    : undefined;
  const mayContribute = group.currentCycle <= group.totalCycles && (!ownContribution || ownContribution.status === "PENDING");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/groups/${encodeURIComponent(id)}`} className="text-sm font-semibold text-green-800 hover:text-green-950">← Back to {group.name}</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">Cycle {group.currentCycle} of {group.totalCycles}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Record a contribution.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{group.name} · {formatGhs(group.contributionAmount.toFixed(2))} due per active member · {group.frequency.toLowerCase()} cycle starting {formatAccraDate(cycleStartDate(group.startDate, group.frequency, group.currentCycle))}.</p>
      </div>

      {query.payment === "returning" ? (
        <p role="status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">You returned from Paystack. This page does not confirm payment: the contribution changes to Verified only after SusuApp validates Paystack&apos;s signed webhook.</p>
      ) : null}

      <ContributionForm
        groupId={id}
        groupAmount={group.contributionAmount.toFixed(2)}
        currentCycle={group.currentCycle}
        viewerRole={membership.role}
        activeMembers={group.members.map((member) => ({ id: member.id, name: member.user.name ?? member.user.phone }))}
        selectedMemberId={selectedMember?.id ?? ""}
        ownContributionStatus={ownContribution?.status ?? null}
        ownReviewNote={ownContribution?.reviewNote ?? null}
        mayContribute={mayContribute}
      />

      <p className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">MoMo references are marked Review due until an organizer checks them. Cash is marked Verified only when an organizer records cash actually received. SusuApp never holds the funds.</p>
    </div>
  );
}
