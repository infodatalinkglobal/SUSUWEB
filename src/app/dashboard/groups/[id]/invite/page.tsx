import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MemberRole, MemberStatus } from "@prisma/client";
import { InviteMembersForm } from "@/components/groups/invite-members-form";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Invite members" };

export default async function InviteMembersPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || !session.phone || session.isDemo) redirect("/auth/login");
  const membership = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: session.userId, status: MemberStatus.ACTIVE, role: MemberRole.ORGANIZER },
    include: { group: { select: { name: true, type: true, totalCycles: true, currentCycle: true, isActive: true } } },
  });
  if (!membership) notFound();
  if (!membership.group.isActive) redirect(`/dashboard/groups/${encodeURIComponent(id)}`);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/groups/${encodeURIComponent(id)}`} className="text-sm font-semibold text-green-800 hover:text-green-950">← Back to {membership.group.name}</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-800">Invite members</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Bring your circle together.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Add Ghana phone numbers for <span className="font-semibold text-slate-900">{membership.group.name}</span>. Each valid invite gets an individual WhatsApp link; SusuApp will not send the message.</p>
      </div>
      {membership.group.type === "ROSCA" ? (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          This ROSCA has {membership.group.totalCycles} planned turns. The organizer is turn 1; new members take the next available rotation order. Current cycle: {membership.group.currentCycle}.
        </p>
      ) : null}
      <InviteMembersForm groupId={id} />
    </div>
  );
}
